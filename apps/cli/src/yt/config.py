import os
from pathlib import Path

TRANSCRIPTS_DIR = Path(
    os.environ.get("YT_TRANSCRIPTS_DIR", Path.home() / ".yt" / "transcripts")
)

OEMBED_URL = "https://www.youtube.com/oembed?url={video_url}&format=json"

MAX_TITLE_LENGTH = 60

AI_ENGINE = os.environ.get("YT_AI_ENGINE", "claude")

CLAUDE_MODEL = os.environ.get("YT_CLAUDE_MODEL", "sonnet")

CODEX_MODEL = os.environ.get("YT_CODEX_MODEL", "gpt-5.5")

CODEX_REASONING_EFFORT = os.environ.get("YT_CODEX_REASONING_EFFORT", "medium")
