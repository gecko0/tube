import os
import subprocess
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from .server import run_server
from .storage import find_by_video_id, list_transcripts, read_summary, read_transcript
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
    table.add_column("Date", width=12)
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
        console.print("[6] Exit")
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
        elif action in ("6", "q", "exit"):
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
      yt web,     yt w [port]   Open web viewer (default port 8765)
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
    elif cmd in ("w", "web"):
        port = int(ref) if ref else 8765
        run_server(port)
    elif cmd == "setup-shell":
        setup_shell()
    else:
        # Treat as a URL
        add_video(cmd)
