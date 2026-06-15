import re
import shutil
from pathlib import Path

from .config import TRANSCRIPTS_DIR


def list_transcripts() -> list[dict]:
    """List all saved transcripts, sorted by date ascending (oldest first)."""
    if not TRANSCRIPTS_DIR.exists():
        return []

    results = []
    for folder in sorted(TRANSCRIPTS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        parsed = parse_folder_name(folder.name)
        if not parsed:
            continue
        parsed["folder"] = folder
        parsed["has_summary"] = (folder / "summary.md").exists()
        results.append(parsed)
    return results


def parse_folder_name(name: str) -> dict | None:
    """Parse 'YYYY-MM-DD - video_id - title' folder name."""
    match = re.match(r"^(\d{4}-\d{2}-\d{2}(?:T\d{6})?) - ([a-zA-Z0-9_-]+) - (.+)$", name)
    if not match:
        return None
    return {
        "date": match.group(1),
        "video_id": match.group(2),
        "title": match.group(3),
    }


def find_by_video_id(video_id: str) -> Path | None:
    """Find an existing transcript folder by video ID."""
    if not TRANSCRIPTS_DIR.exists():
        return None
    for folder in TRANSCRIPTS_DIR.iterdir():
        if not folder.is_dir():
            continue
        parsed = parse_folder_name(folder.name)
        if parsed and parsed["video_id"] == video_id:
            return folder
    return None


def delete_video(video_id: str) -> bool:
    """Delete a saved transcript folder by video ID. Returns True if deleted, False if not found."""
    folder = find_by_video_id(video_id)
    if not folder:
        return False
    shutil.rmtree(folder)
    return True


def read_transcript(folder: Path) -> str | None:
    path = folder / "transcript.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def read_summary(folder: Path) -> str | None:
    path = folder / "summary.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None
