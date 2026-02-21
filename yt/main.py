import subprocess
import sys

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .storage import find_by_video_id, list_transcripts, read_summary, read_transcript
from .summarizer import save_summary, summarize
from .transcript import extract_video_id, fetch_metadata, fetch_transcript, save_transcript

console = Console()


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
    console.print(f"\n[bold green]Done![/bold green] {folder}")


def show_list():
    """Display all saved transcripts as a table."""
    transcripts = list_transcripts()
    if not transcripts:
        console.print("[dim]No transcripts saved yet.[/dim]")
        return

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


def view_transcript(video_id: str):
    folder = find_by_video_id(video_id)
    if not folder:
        console.print(f"[red]No transcript found for {video_id}[/red]")
        sys.exit(1)
    content = read_transcript(folder)
    if content:
        console.print(content)
    else:
        console.print("[red]transcript.md not found.[/red]")


def view_summary(video_id: str):
    folder = find_by_video_id(video_id)
    if not folder:
        console.print(f"[red]No transcript found for {video_id}[/red]")
        sys.exit(1)
    content = read_summary(folder)
    if content:
        console.print(content)
    else:
        console.print("[red]summary.md not found.[/red]")


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
        console.print("[3] View transcript")
        console.print("[4] View summary")
        console.print("[5] Exit")
        console.print()

        choice = click.prompt(">", type=str).strip()

        if choice == "1":
            url = click.prompt("YouTube URL")
            add_video(url)
        elif choice == "2":
            show_list()
        elif choice == "3":
            vid = click.prompt("Video ID")
            view_transcript(vid)
        elif choice == "4":
            vid = click.prompt("Video ID")
            view_summary(vid)
        elif choice == "5":
            break
        else:
            console.print("[dim]Invalid choice.[/dim]")


@click.command()
@click.argument("url", required=False)
@click.option("--list", "list_all", is_flag=True, help="List all saved transcripts.")
@click.option("--view", "view_id", default=None, help="Print transcript for a video ID.")
@click.option("--summary", "summary_id", default=None, help="Print summary for a video ID.")
def cli(url, list_all, view_id, summary_id):
    """yt — YouTube Transcript & Summary CLI.

    Run with no arguments for interactive mode, or pass a YouTube URL to fetch + summarize.
    """
    if list_all:
        show_list()
    elif view_id:
        view_transcript(view_id)
    elif summary_id:
        view_summary(summary_id)
    elif url:
        add_video(url)
    else:
        interactive_mode()
