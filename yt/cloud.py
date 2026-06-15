import hashlib
import json
from pathlib import Path

import requests

CONFIG_PATH = Path.home() / ".yt" / "config.json"
DEFAULT_CONVEX_URL = "https://yt-tube.convex.site"


def load_config() -> dict:
    """Load config from ~/.yt/config.json, return empty dict if missing."""
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def save_config(config: dict):
    """Save config to ~/.yt/config.json."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


def is_connected() -> bool:
    """Check if an API key is configured."""
    config = load_config()
    return bool(config.get("api_key"))


def upload_video(
    video_id: str,
    date: str,
    title: str,
    transcript_md: str,
    summary_md: str | None,
) -> bool:
    """Upload video data to Convex. Returns True on success, False on failure."""
    config = load_config()
    api_key = config.get("api_key")
    if not api_key:
        return False

    convex_url = config.get("convex_url", DEFAULT_CONVEX_URL)
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    payload = {
        "videoId": video_id,
        "date": date,
        "title": title,
        "transcriptMd": transcript_md,
        "thumbnailUrl": thumbnail_url,
    }
    if summary_md:
        payload["summaryMd"] = summary_md

    try:
        resp = requests.post(
            f"{convex_url}/api/upload",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        return resp.status_code == 200
    except requests.RequestException:
        return False
