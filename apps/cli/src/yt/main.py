import os
import shutil
import subprocess
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from .cloud import (
    get_missing_video_ids,
    is_connected,
    load_config,
    save_config,
    upload_video,
)
from .metadata import read_video_metadata
from .server import run_server
from .storage import (
    find_by_video_id,
    list_transcripts,
    parse_folder_name,
    read_brief_summary,
    read_summary,
    read_transcript,
)
from .summarizer import (
    BRIEF_SUMMARY_PROMPT_KEY,
    resolve_summary_metadata,
    save_brief_summary,
    save_summary,
    summarize,
    summarize_brief,
)
from .transcript import (
    build_prompt_transcript,
    extract_video_id,
    fetch_metadata,
    fetch_transcript,
    save_transcript,
)

console = Console()
DEFAULT_BATCH_SIZE = 100
CONFIG_KEYS = {"api_key", "convex_url", "model", "ai_engine", BRIEF_SUMMARY_PROMPT_KEY}
RESETTABLE_CONFIG_KEYS = {BRIEF_SUMMARY_PROMPT_KEY}
SECRET_CONFIG_KEYS = {"api_key"}
MODEL_ALIAS_FLAGS = {
    "--sonnet": "sonnet",
    "--opus": "opus",
    "--fable": "fable",
}


def parse_batch_options(
    parts: tuple[str, ...] | list[str], command: str, default_limit: int
) -> int | None:
    """Parse --limit N and --all for list-like commands."""
    limit: int | None = default_limit
    saw_all = False
    saw_limit = False
    i = 0
    while i < len(parts):
        part = parts[i]
        if part == "--all":
            if saw_limit:
                console.print(f"[red]Usage:[/red] {command} [--limit N | --all]")
                sys.exit(1)
            saw_all = True
            limit = None
            i += 1
        elif part == "--limit":
            if saw_all or i + 1 >= len(parts):
                console.print(f"[red]Usage:[/red] {command} [--limit N | --all]")
                sys.exit(1)
            try:
                parsed_limit = int(parts[i + 1])
            except ValueError:
                console.print("[red]--limit must be a positive integer.[/red]")
                sys.exit(1)
            if parsed_limit < 1:
                console.print("[red]--limit must be a positive integer.[/red]")
                sys.exit(1)
            saw_limit = True
            limit = parsed_limit
            i += 2
        else:
            console.print(f"[red]Unknown option for {command}:[/red] {part}")
            console.print(f"[red]Usage:[/red] {command} [--limit N | --all]")
            sys.exit(1)
    return limit


def parse_model_options(args: tuple[str, ...]) -> tuple[str | None, tuple[str, ...]]:
    """Parse leading model options before the command or URL."""
    model, _, remaining = parse_ai_options(args)
    return model, remaining


def parse_ai_options(
    args: tuple[str, ...],
) -> tuple[str | None, str | None, tuple[str, ...]]:
    """Parse leading AI options before the command or URL."""
    model: str | None = None
    ai_engine: str | None = None
    remaining = list(args)

    while remaining:
        part = remaining[0]
        if part in MODEL_ALIAS_FLAGS:
            model = MODEL_ALIAS_FLAGS[part]
            remaining.pop(0)
        elif part == "--model":
            if len(remaining) < 2 or remaining[1].startswith("--"):
                console.print("[red]Usage:[/red] yt --model <model> <url>")
                sys.exit(1)
            model = remaining[1]
            del remaining[:2]
        elif part.startswith("--model="):
            model = part.split("=", 1)[1]
            if not model:
                console.print("[red]Usage:[/red] yt --model=<model> <url>")
                sys.exit(1)
            remaining.pop(0)
        elif part == "--ai_engine":
            if len(remaining) < 2 or remaining[1].startswith("--"):
                console.print("[red]Usage:[/red] yt --ai_engine <engine> <url>")
                sys.exit(1)
            ai_engine = remaining[1]
            del remaining[:2]
        elif part.startswith("--ai_engine="):
            ai_engine = part.split("=", 1)[1]
            if not ai_engine:
                console.print("[red]Usage:[/red] yt --ai_engine=<engine> <url>")
                sys.exit(1)
            remaining.pop(0)
        else:
            break

    return model, ai_engine, tuple(remaining)


def parse_config_options(parts: tuple[str, ...] | list[str]) -> dict[str, str]:
    """Parse --key value and --key=value options for persisted app config."""
    updates: dict[str, str] = {}
    i = 0
    while i < len(parts):
        part = parts[i]
        if not part.startswith("--"):
            console.print(f"[red]Unknown argument for yt config:[/red] {part}")
            console.print(
                "[red]Usage:[/red] yt config "
                "[--api_key KEY] [--convex_url URL] "
                "[--model MODEL] [--ai_engine ENGINE] "
                "[--brief_summary_prompt PROMPT|@FILE]"
            )
            sys.exit(1)

        raw_key = part[2:]
        if "=" in raw_key:
            key, value = raw_key.split("=", 1)
            if not value:
                console.print(f"[red]Missing value for --{key}.[/red]")
                sys.exit(1)
            i += 1
        else:
            key = raw_key
            if i + 1 >= len(parts) or parts[i + 1].startswith("--"):
                console.print(f"[red]Missing value for --{key}.[/red]")
                sys.exit(1)
            value = parts[i + 1]
            i += 2

        if key not in CONFIG_KEYS:
            console.print(f"[red]Unknown config key:[/red] {key}")
            console.print(
                "[dim]Supported keys: ai_engine, api_key, "
                "brief_summary_prompt, convex_url, model[/dim]"
            )
            sys.exit(1)

        if key == BRIEF_SUMMARY_PROMPT_KEY and value.startswith("@"):
            prompt_path = Path(value[1:]).expanduser()
            try:
                value = prompt_path.read_text(encoding="utf-8")
            except OSError as e:
                console.print(f"[red]Unable to read prompt file:[/red] {e}")
                sys.exit(1)

        updates[key] = value

    return updates


def parse_config_reset_options(parts: tuple[str, ...] | list[str]) -> set[str]:
    """Parse reset options for persisted app config."""
    if not parts:
        console.print("[red]Usage:[/red] yt config reset --brief_summary_prompt")
        sys.exit(1)

    reset_keys: set[str] = set()
    for part in parts:
        if not part.startswith("--"):
            console.print(f"[red]Unknown argument for yt config reset:[/red] {part}")
            console.print("[red]Usage:[/red] yt config reset --brief_summary_prompt")
            sys.exit(1)

        key = part[2:]
        if key not in RESETTABLE_CONFIG_KEYS:
            console.print(f"[red]Unknown reset key:[/red] {key}")
            console.print("[dim]Resettable keys: brief_summary_prompt[/dim]")
            sys.exit(1)
        reset_keys.add(key)

    return reset_keys


def format_config_value(key: str, value: str) -> str:
    if key in SECRET_CONFIG_KEYS and value:
        return f"{value[:4]}...{value[-4:]}" if len(value) > 8 else "****"
    if key == BRIEF_SUMMARY_PROMPT_KEY and len(value) > 80:
        return f"{value[:77]}..."
    return value


def config_cmd(parts: tuple[str, ...] | list[str]):
    """View or update persisted app config."""
    config = load_config()

    if parts and parts[0] == "reset":
        reset_keys = parse_config_reset_options(parts[1:])
        for key in reset_keys:
            config.pop(key, None)
        save_config(config)
        for key in sorted(reset_keys):
            console.print(f"[green]Reset[/green] {key}")
        return

    updates = parse_config_options(parts)

    if updates:
        config.update(updates)
        save_config(config)
        for key, value in updates.items():
            console.print(f"[green]Set[/green] {key}={format_config_value(key, value)}")
        return

    if not config:
        console.print("[dim]No config saved yet.[/dim]")
        return

    table = Table(title="Config")
    table.add_column("Key")
    table.add_column("Value")
    for key in sorted(config):
        table.add_row(key, format_config_value(key, str(config[key])))
    console.print(table)


def resolve_ref(ref: str | None) -> tuple[Path, str]:
    """Resolve a video ID or None for latest to a (folder, video_id) tuple."""

    if ref is None:
        transcripts = list_transcripts(limit=1, newest_first=True)
        if not transcripts:
            console.print("[red]No transcripts saved yet.[/red]")
            sys.exit(1)
        entry = transcripts[0]
        return entry["folder"], entry["video_id"]

    # Treat as video ID
    folder = find_by_video_id(ref)
    if not folder:
        console.print(f"[red]No transcript found for {ref}[/red]")
        sys.exit(1)
    return folder, ref


def add_video(
    url: str,
    regenerate: bool = False,
    model: str | None = None,
    ai_engine: str | None = None,
):
    """Core flow: fetch transcript, summarize, save."""
    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)

    # Check if already exists
    existing = find_by_video_id(video_id)
    if existing and not regenerate:
        console.print(f"[yellow]Already saved:[/yellow] {existing.name}")
        if not click.confirm("Regenerate?"):
            return

    console.print("[dim]Fetching metadata...[/dim]")
    metadata = fetch_metadata(video_id)
    title = metadata["title"]
    author = metadata["author"]
    console.print(f"[bold]{title}[/bold] by {author}")

    console.print("[dim]Fetching transcript...[/dim]")
    try:
        entries = fetch_transcript(video_id)
    except Exception as e:
        error_msg = str(e).lower()
        if "no transcript" in error_msg or "subtitles" in error_msg:
            console.print(
                "[red]No transcript available.[/red] "
                "This video may have captions disabled."
            )
        elif "unavailable" in error_msg or "private" in error_msg:
            console.print("[red]Video is unavailable or private.[/red]")
        else:
            console.print(f"[red]Error fetching transcript:[/red] {e}")
        sys.exit(1)

    console.print(f"[dim]Got {len(entries)} transcript segments.[/dim]")

    folder = save_transcript(video_id, title, author, entries)
    console.print(f"[green]Transcript saved.[/green]")

    try:
        summary_metadata = resolve_summary_metadata(model=model, ai_engine=ai_engine)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)

    console.print(
        f"[dim]Creating brief summary with "
        f"{summary_metadata.ai_engine.title()}...[/dim]"
    )
    brief_transcript_text = build_prompt_transcript(entries)
    try:
        brief_summary_text = summarize_brief(
            brief_transcript_text,
            title,
            video_id,
            model=model,
            ai_engine=ai_engine,
            metadata=summary_metadata,
        )
    except FileNotFoundError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Summarizer returned an error:[/red] {e.stderr or e}")
        sys.exit(1)

    save_brief_summary(
        folder,
        brief_summary_text,
        ai_engine=summary_metadata.ai_engine,
        model=summary_metadata.model,
    )
    console.print("[green]Brief summary saved.[/green]")

    console.print(
        f"[dim]Creating detailed summary with "
        f"{summary_metadata.ai_engine.title()}...[/dim]"
    )
    transcript_text = read_transcript(folder)
    try:
        summary_text = summarize(
            transcript_text,
            title,
            model=model,
            ai_engine=ai_engine,
            metadata=summary_metadata,
        )
    except FileNotFoundError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Summarizer returned an error:[/red] {e.stderr or e}")
        sys.exit(1)

    save_summary(
        folder,
        summary_text,
        title,
        video_id,
        ai_engine=summary_metadata.ai_engine,
        model=summary_metadata.model,
    )
    brief_summary_md = read_brief_summary(folder)
    summary_md = read_summary(folder) or summary_text
    metadata = read_video_metadata(folder)
    console.print("[green]Summary saved.[/green]")

    # Upload to cloud if connected
    if is_connected():
        parsed = parse_folder_name(folder.name)
        date = parsed["date"] if parsed else ""
        success = upload_video(
            video_id=video_id,
            date=date,
            title=title,
            transcript_md=transcript_text,
            summary_md=summary_md,
            brief_summary_md=brief_summary_md,
            metadata=metadata,
        )
        if success:
            console.print("[dim]Synced to cloud.[/dim]")
        else:
            console.print("[yellow]Warning: cloud sync failed.[/yellow]")

    console.print()
    console.print(Markdown(summary_text))
    console.print(f"\n[bold green]Done![/bold green] {folder}")


def show_list(limit: int | None = DEFAULT_BATCH_SIZE):
    """Display saved transcripts as a table. Returns the displayed list."""
    fetch_limit = limit + 1 if limit is not None else None
    fetched = list_transcripts(limit=fetch_limit, newest_first=True)
    has_more = limit is not None and len(fetched) > limit
    transcripts = fetched[:limit] if limit is not None else fetched
    if not transcripts:
        console.print("[dim]No transcripts saved yet.[/dim]")
        return transcripts

    table = Table(title="Saved Transcripts")
    table.add_column("Date", width=19)
    table.add_column("Video ID", width=13)
    table.add_column("Title")
    table.add_column("Summary", width=8)

    for t in transcripts:
        summary_mark = "[green]yes[/green]" if t["has_summary"] else "[dim]no[/dim]"
        table.add_row(t["date"], t["video_id"], t["title"], summary_mark)

    console.print(table)
    if has_more:
        console.print(
            f"[dim]Showing latest {limit}. Use --all or --limit N to change this.[/dim]"
        )
    return transcripts


def view_transcript(folder: Path):
    """Print a transcript from its folder."""
    content = read_transcript(folder)
    if content:
        console.print(Markdown(content))
    else:
        console.print("[red]transcript.md not found.[/red]")


def view_summary(folder: Path):
    """Print a summary from its folder."""
    content = read_summary(folder)
    if content:
        console.print(Markdown(content))
    else:
        console.print("[red]summary.md not found.[/red]")


def delete_video_cmd(ref: str | None):
    """Delete a saved transcript and summary."""
    folder, video_id = resolve_ref(ref)
    parsed = parse_folder_name(folder.name)
    title = parsed["title"] if parsed else folder.name
    date_str = parsed["date"] if parsed else "unknown"

    console.print(f"[bold]{title}[/bold]")
    console.print(f"[dim]{date_str} — {video_id}[/dim]")
    console.print()

    if not click.confirm("Delete this video?"):
        console.print("[dim]Cancelled.[/dim]")
        return

    shutil.rmtree(folder)
    console.print("[green]Deleted.[/green]")


def sync_missing_videos(limit: int | None = DEFAULT_BATCH_SIZE):
    """Upload local transcripts that are missing from the cloud backend."""
    if not is_connected():
        console.print("[red]Connect first:[/red] yt connect <api-key>")
        sys.exit(1)

    transcripts = list_transcripts(limit=limit, newest_first=True)
    if not transcripts:
        console.print("[dim]No transcripts saved yet.[/dim]")
        return

    video_ids = [entry["video_id"] for entry in transcripts]
    missing_video_ids = get_missing_video_ids(video_ids)
    if missing_video_ids is None:
        console.print("[red]Unable to check cloud sync status.[/red]")
        sys.exit(1)

    if not missing_video_ids:
        console.print("[green]All local transcripts are already synced.[/green]")
        return

    missing = set(missing_video_ids)
    uploaded = 0
    failed = 0
    skipped = 0

    scope = "all local videos" if limit is None else f"latest {limit} local video(s)"
    console.print(f"[dim]Checking {scope}.[/dim]")
    console.print(f"[dim]Found {len(missing_video_ids)} missing video(s).[/dim]")
    for entry in transcripts:
        video_id = entry["video_id"]
        if video_id not in missing:
            continue

        folder = entry["folder"]
        transcript_md = read_transcript(folder)
        if not transcript_md:
            skipped += 1
            console.print(f"[yellow]Skipped {video_id}: transcript.md not found.[/yellow]")
            continue

        summary_md = read_summary(folder)
        brief_summary_md = read_brief_summary(folder)
        metadata = read_video_metadata(folder)
        success = upload_video(
            video_id=video_id,
            date=entry["date"],
            title=entry["title"],
            transcript_md=transcript_md,
            summary_md=summary_md,
            brief_summary_md=brief_summary_md,
            metadata=metadata,
        )
        if success:
            uploaded += 1
            console.print(f"[green]Uploaded[/green] {video_id}")
        else:
            failed += 1
            console.print(f"[red]Failed[/red] {video_id}")

    console.print(
        f"[green]Uploaded {uploaded} missing video(s).[/green] "
        f"[dim]{skipped} skipped, {failed} failed.[/dim]"
    )
    if failed:
        sys.exit(1)


def setup_shell():
    """Add noglob aliases to the user's shell config so URLs work without quoting."""
    shell = os.environ.get("SHELL", "")
    if "zsh" in shell:
        rc_file = Path.home() / ".zshrc"
    elif "bash" in shell:
        rc_file = Path.home() / ".bashrc"
    else:
        console.print(f"[red]Unsupported shell:[/red] {shell or 'unknown'}")
        console.print("Manually add these aliases to your shell config:")
        console.print("  alias yt='noglob yt'")
        console.print("  alias tube='noglob tube'")
        return

    aliases = {
        "alias yt='noglob yt'",
        "alias tube='noglob tube'",
    }

    # Read existing content to check what's already there
    existing = rc_file.read_text() if rc_file.exists() else ""
    to_add = [a for a in sorted(aliases) if a not in existing]

    if not to_add:
        console.print("[green]Shell already configured.[/green] noglob aliases are present.")
        return

    with rc_file.open("a") as f:
        f.write("\n# yt: allow unquoted URLs with special characters\n")
        for alias in to_add:
            f.write(f"{alias}\n")

    console.print(f"[green]Added aliases to {rc_file}[/green]")
    console.print(f"Run [bold]source {rc_file}[/bold] or open a new terminal to apply.")


def interactive_mode():
    """Interactive menu when yt is called with no arguments."""
    console.print(
        Panel(
            "[bold]yt[/bold] — YouTube Transcripts",
            expand=False,
        )
    )

    while True:
        console.print()
        console.print("[1] Add new video")
        console.print("[2] List transcripts")
        console.print("[3] View transcript  [dim](3 <video_id>)[/dim]")
        console.print("[4] View summary     [dim](4 <video_id>)[/dim]")
        console.print("[5] Open web viewer")
        console.print("[6] Delete transcript [dim](6 <video_id>)[/dim]")
        console.print("[7] Sync missing videos")
        console.print("[8] Exit")
        console.print()

        parts = click.prompt(">", type=str).strip().split()
        if not parts:
            continue

        action = parts[0]
        ref = parts[1] if len(parts) > 1 else None

        if action == "1":
            url = ref or click.prompt("YouTube URL")
            add_video(url)
        elif action == "2":
            show_list()
        elif action == "3":
            if ref is None:
                ref = click.prompt("Video ID")
            folder, _ = resolve_ref(ref)
            view_transcript(folder)
        elif action == "4":
            if ref is None:
                ref = click.prompt("Video ID")
            folder, _ = resolve_ref(ref)
            view_summary(folder)
        elif action == "5":
            port = int(ref) if ref else 8765
            run_server(port)
        elif action == "6":
            if ref is None:
                ref = click.prompt("Video ID")
            delete_video_cmd(ref)
        elif action == "7":
            sync_missing_videos()
        elif action in ("8", "q", "exit"):
            break
        else:
            console.print("[dim]Invalid choice.[/dim]")


@click.command(
    context_settings={
        "help_option_names": ["-h", "--help"],
        "ignore_unknown_options": True,
        "allow_extra_args": True,
    }
)
@click.argument("args", nargs=-1, type=click.UNPROCESSED)
def cli(args):
    """yt — YouTube Transcript & Summary CLI.

    \b
    Commands:
      yt                        Interactive mode
      yt <url>                  Fetch transcript & summarize a video
      yt --ai_engine codex <url> Summarize with Codex instead of Claude
      yt --model opus <url>     Summarize with a specific Claude model/alias
      yt --opus <url>           Shortcut for yt --model opus <url>
      yt list,    yt l          List latest 100 saved transcripts
      yt list --all             List all saved transcripts
      yt list --limit N         List latest N saved transcripts
      yt view,    yt v [video_id]    View transcript (latest if omitted)
      yt summary, yt s [video_id]    View summary (latest if omitted)
      yt delete,  yt d [video_id]    Delete transcript & summary (latest if omitted)
      yt web,     yt w [port]   Open web viewer (default port 8765)
      yt connect  <key>         Connect to cloud with API key
      yt config                 Show saved config
      yt config --ai_engine codex Set default AI engine
      yt config --model opus    Set default summarization model
      yt config --brief_summary_prompt @prompt.md Set brief summary prompt
      yt config reset --brief_summary_prompt Reset brief summary prompt
      yt config --api_key KEY   Set cloud API key
      yt sync                   Upload latest 100 local videos missing from cloud
      yt sync --all             Upload all local videos missing from cloud
      yt sync --limit N         Upload latest N local videos missing from cloud
      yt disconnect             Remove cloud connection
      yt setup-shell            Configure shell aliases for URLs

    [video_id] is a YouTube video ID.
    """
    if not args:
        interactive_mode()
        return

    model, ai_engine, args = parse_ai_options(args)
    if not args:
        console.print(
            "[red]Usage:[/red] yt "
            "[--ai_engine <engine>] "
            "[--model <model> | --sonnet | --opus | --fable] <url>"
        )
        sys.exit(1)

    cmd = args[0]
    ref = args[1] if len(args) > 1 else None

    if cmd in ("l", "list"):
        limit = parse_batch_options(args[1:], "yt list", DEFAULT_BATCH_SIZE)
        show_list(limit)
    elif cmd in ("v", "view"):
        folder, _ = resolve_ref(ref)
        view_transcript(folder)
    elif cmd in ("s", "summary"):
        folder, _ = resolve_ref(ref)
        view_summary(folder)
    elif cmd in ("d", "delete"):
        delete_video_cmd(ref)
    elif cmd in ("w", "web"):
        port = int(ref) if ref else 8765
        run_server(port)
    elif cmd in ("c", "connect"):
        if ref is None:
            console.print("[red]Usage: yt connect <api-key>[/red]")
            sys.exit(1)
        config = load_config()
        config["api_key"] = ref
        save_config(config)
        console.print("[green]Connected![/green] API key saved to ~/.yt/config.json")
    elif cmd == "config":
        config_cmd(args[1:])
    elif cmd == "sync":
        limit = parse_batch_options(args[1:], "yt sync", DEFAULT_BATCH_SIZE)
        sync_missing_videos(limit)
    elif cmd == "disconnect":
        config = load_config()
        config.pop("api_key", None)
        save_config(config)
        console.print("[green]Disconnected.[/green] API key removed.")
    elif cmd == "setup-shell":
        setup_shell()
    else:
        # Treat as a URL
        add_video(cmd, model=model, ai_engine=ai_engine)
