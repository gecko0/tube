import re
from datetime import datetime
from pathlib import Path

import requests
from youtube_transcript_api import YouTubeTranscriptApi

from .config import MAX_TITLE_LENGTH, OEMBED_URL, TRANSCRIPTS_DIR


def extract_video_id(url: str) -> str:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r"(?:v=|/v/)([a-zA-Z0-9_-]{11})",
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Maybe it's already a bare video ID
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", url):
        return url
    raise ValueError(f"Could not extract video ID from: {url}")


def fetch_metadata(video_id: str) -> dict:
    """Fetch video metadata via YouTube oEmbed. Returns title and author."""
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        resp = requests.get(
            OEMBED_URL.format(video_url=video_url), timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "title": data.get("title", video_id),
            "author": data.get("author_name", "Unknown"),
        }
    except (requests.RequestException, ValueError):
        return {"title": video_id, "author": "Unknown"}


def sanitize_title(title: str) -> str:
    """Strip special chars, normalize spaces, truncate."""
    title = re.sub(r"[^\w\s-]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title[:MAX_TITLE_LENGTH]


def build_folder_name(video_id: str, title: str, now: datetime) -> str:
    timestamp = now.strftime("%Y-%m-%dT%H%M%S")
    safe_title = sanitize_title(title)
    return f"{timestamp} - {video_id} - {safe_title}"


def fetch_transcript(video_id: str) -> list[dict]:
    """Fetch transcript entries. Returns list of {text, start} dicts."""
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id)
    return [
        {"text": entry.text, "start": entry.start}
        for entry in transcript.snippets
    ]


def format_timestamp(seconds: float) -> str:
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def build_transcript_md(
    entries: list[dict], title: str, author: str, video_id: str, now: datetime
) -> str:
    url = f"https://youtube.com/watch?v={video_id}"
    today = now.isoformat(timespec="seconds")

    lines = [
        f"# {title}",
        "",
        f"**URL**: {url}",
        f"**Author**: {author}",
        f"**Fetched**: {today}",
        f"**Video ID**: {video_id}",
        "",
        "---",
        "",
    ]
    for entry in entries:
        ts = format_timestamp(entry["start"])
        lines.append(f"[{ts}] {entry['text']}")

    return "\n".join(lines) + "\n"


def save_transcript(
    video_id: str, title: str, author: str, entries: list[dict]
) -> Path:
    """Save transcript to disk. Returns the folder path."""
    now = datetime.now().astimezone()
    folder_name = build_folder_name(video_id, title, now)
    folder = TRANSCRIPTS_DIR / folder_name
    folder.mkdir(parents=True, exist_ok=True)

    content = build_transcript_md(entries, title, author, video_id, now)
    (folder / "transcript.md").write_text(content, encoding="utf-8")
    return folder
