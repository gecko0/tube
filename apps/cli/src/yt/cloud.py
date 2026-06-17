import hashlib
import json
from pathlib import Path

import requests

CONFIG_PATH = Path.home() / ".yt" / "config.json"
DEFAULT_CONVEX_URL = "https://sensible-alligator-750.convex.site"
MISSING_CHECK_CHUNK_SIZE = 500


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


def get_missing_video_ids(video_ids: list[str]) -> list[str] | None:
    """Return the subset of video IDs not present in Convex, or None on failure."""
    config = load_config()
    api_key = config.get("api_key")
    if not api_key:
        return None

    convex_url = config.get("convex_url", DEFAULT_CONVEX_URL)
    missing: list[str] = []

    try:
        for start in range(0, len(video_ids), MISSING_CHECK_CHUNK_SIZE):
            chunk = video_ids[start : start + MISSING_CHECK_CHUNK_SIZE]
            resp = requests.post(
                f"{convex_url}/api/missing",
                json={"videoIds": chunk},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            chunk_missing = data.get("missingVideoIds")
            if not isinstance(chunk_missing, list) or not all(
                isinstance(video_id, str) for video_id in chunk_missing
            ):
                return None
            missing.extend(chunk_missing)
    except (requests.RequestException, ValueError):
        return None

    return missing


def upload_video(
    video_id: str,
    date: str,
    title: str,
    transcript_md: str,
    summary_md: str | None,
    brief_summary_md: str | None = None,
    metadata: dict | None = None,
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
    if brief_summary_md:
        payload["briefSummaryMd"] = brief_summary_md
    if metadata:
        payload["metadata"] = metadata

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
