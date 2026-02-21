import os
from pathlib import Path

TRANSCRIPTS_DIR = Path(
    os.environ.get("YT_TRANSCRIPTS_DIR", Path.home() / ".yt" / "transcripts")
)

OEMBED_URL = "https://www.youtube.com/oembed?url={video_url}&format=json"

MAX_TITLE_LENGTH = 60
