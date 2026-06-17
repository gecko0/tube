import json
from pathlib import Path


METADATA_FILE = "metadata.json"


def youtube_url(video_id: str) -> str:
    return f"https://youtube.com/watch?v={video_id}"


def build_video_metadata(
    *,
    video_id: str,
    title: str,
    author: str,
    fetched_at: str,
) -> dict:
    return {
        "version": 1,
        "videoId": video_id,
        "url": youtube_url(video_id),
        "title": title,
        "author": author,
        "fetchedAt": fetched_at,
    }


def read_video_metadata(folder: Path) -> dict | None:
    path = folder / METADATA_FILE
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def write_video_metadata(folder: Path, metadata: dict) -> None:
    path = folder / METADATA_FILE
    path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


def update_video_metadata(folder: Path, updates: dict) -> dict:
    metadata = read_video_metadata(folder) or {"version": 1}
    metadata.update({key: value for key, value in updates.items() if value is not None})
    write_video_metadata(folder, metadata)
    return metadata
