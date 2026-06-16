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
from .server import run_server
from .storage import (
    find_by_video_id,
    list_transcripts,
    parse_folder_name,
    read_summary,
    read_transcript,
)
from .summarizer import save_summary, summarize
from .transcript import extract_video_id, fetch_metadata, fetch_transcript, save_transcript

console = Console()


def resolve_ref(ref: str | None) -> tuple[Path, str]:
    """Resolve a reference (index number, video ID, or None for latest) to a (folder, video_id) tuple."""
    transcripts = list_transcripts()

    if ref is None:
        # Default to latest (last item, since list is ascending)
        if not transcripts:
            console.print("[red]No transcripts saved yet.[/red]")
            sys.exit(1)
        entry = transcripts[-1]
        return entry["folder"], entry["video_id"]

    if ref.isdigit():
        index = int(ref)
        if index < 1 or index > len(transcripts):
            console.print(f"[red]Invalid index: {ref}[/red] (have {len(transcripts)} transcripts)")
            sys.exit(1)
        entry = transcripts[index - 1]
        return entry["folder"], entry["video_id"]

    # Treat as video ID
    folder = find_by_video_id(ref)
    if not folder:
        console.print(f"[red]No transcript found for {ref}[/red]")
        sys.exit(1)
    return folder, ref


def add_video(url: str, regenerate: bool = False):
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

    console.print("[dim]Summarizing with Claude...[/dim]")
    transcript_text = read_transcript(folder)
    try:
        summary_text = summarize(transcript_text, title)
    except FileNotFoundError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Claude returned an error:[/red] {e.stderr or e}")
        sys.exit(1)

    save_summary(folder, summary_text, title, video_id)
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
            summary_md=summary_text,
        )
        if success:
            console.print("[dim]Synced to cloud.[/dim]")
        else:
            console.print("[yellow]Warning: cloud sync failed.[/yellow]")

    console.print()
    console.print(Markdown(summary_text))
    console.print(f"\n[bold green]Done![/bold green] {folder}")


def show_list():
    """Display all saved transcripts as a table. Returns the list."""
    transcripts = list_transcripts()
    if not transcripts:
        console.print("[dim]No transcripts saved yet.[/dim]")
        return transcripts

    table = Table(title="Saved Transcripts")
    table.add_column("#", style="dim", width=4)
    table.add_column("Date", width=19)
    table.add_column("Video ID", width=13)
    table.add_column("Title")
    table.add_column("Summary", width=8)

    for i, t in enumerate(transcripts, 1):
        summary_mark = "[green]yes[/green]" if t["has_summary"] else "[dim]no[/dim]"
        table.add_row(str(i), t["date"], t["video_id"], t["title"], summary_mark)

    console.print(table)
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


def sync_missing_videos():
    """Upload local transcripts that are missing from the cloud backend."""
    if not is_connected():
        console.print("[red]Connect first:[/red] yt connect <api-key>")
        sys.exit(1)

    transcripts = list_transcripts()
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
        success = upload_video(
            video_id=video_id,
            date=entry["date"],
            title=entry["title"],
            transcript_md=transcript_md,
            summary_md=summary_md,
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
        console.print("[3] View transcript  [dim](3 <#|id>)[/dim]")
        console.print("[4] View summary     [dim](4 <#|id>)[/dim]")
        console.print("[5] Open web viewer")
        console.print("[6] Delete transcript [dim](6 <#|id>)[/dim]")
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
                ref = click.prompt("Video # or ID")
            folder, _ = resolve_ref(ref)
            view_transcript(folder)
        elif action == "4":
            if ref is None:
                ref = click.prompt("Video # or ID")
            folder, _ = resolve_ref(ref)
            view_summary(folder)
        elif action == "5":
            port = int(ref) if ref else 8765
            run_server(port)
        elif action == "6":
            if ref is None:
                ref = click.prompt("Video # or ID")
            delete_video_cmd(ref)
        elif action == "7":
            sync_missing_videos()
        elif action in ("8", "q", "exit"):
            break
        else:
            console.print("[dim]Invalid choice.[/dim]")


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("args", nargs=-1)
def cli(args):
    """yt — YouTube Transcript & Summary CLI.

    \b
    Commands:
      yt                        Interactive mode
      yt <url>                  Fetch transcript & summarize a video
      yt list,    yt l          List all saved transcripts
      yt view,    yt v [ref]    View transcript (latest if no ref)
      yt summary, yt s [ref]    View summary (latest if no ref)
      yt delete,  yt d [ref]    Delete transcript & summary (latest if no ref)
      yt web,     yt w [port]   Open web viewer (default port 8765)
      yt connect  <key>         Connect to cloud with API key
      yt sync                   Upload local videos missing from cloud
      yt disconnect             Remove cloud connection
      yt setup-shell            Configure shell aliases for URLs

    [ref] can be a # index from the list or a video ID.
    """
    if not args:
        interactive_mode()
        return

    cmd = args[0]
    ref = args[1] if len(args) > 1 else None

    if cmd in ("l", "list"):
        show_list()
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
    elif cmd == "sync":
        sync_missing_videos()
    elif cmd == "disconnect":
        config = load_config()
        config.pop("api_key", None)
        save_config(config)
        console.print("[green]Disconnected.[/green] API key removed.")
    elif cmd == "setup-shell":
        setup_shell()
    else:
        # Treat as a URL
        add_video(cmd)
