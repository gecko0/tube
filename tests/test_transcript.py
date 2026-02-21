from unittest.mock import MagicMock, patch

import pytest
import requests

from yt.transcript import (
    build_folder_name,
    build_transcript_md,
    extract_video_id,
    fetch_metadata,
    fetch_transcript,
    format_timestamp,
    sanitize_title,
    save_transcript,
)


# ---------------------------------------------------------------------------
# extract_video_id
# ---------------------------------------------------------------------------
class TestExtractVideoId:
    @pytest.mark.parametrize(
        "url, expected",
        [
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            (
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120",
                "dQw4w9WgXcQ",
            ),
            (
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
                "dQw4w9WgXcQ",
            ),
            ("https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtu.be/abc_d-fg1Hj", "abc_d-fg1Hj"),
            (
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=30",
                "dQw4w9WgXcQ",
            ),
            ("https://www.youtube.com/shorts/abc_d-fg1Hj", "abc_d-fg1Hj"),
        ],
    )
    def test_valid_urls(self, url, expected):
        assert extract_video_id(url) == expected

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.google.com",
            "not-a-url",
            "",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/channel/UCxxxxx",
        ],
    )
    def test_invalid_urls_raise(self, url):
        with pytest.raises(ValueError, match="Could not extract video ID"):
            extract_video_id(url)


# ---------------------------------------------------------------------------
# sanitize_title
# ---------------------------------------------------------------------------
class TestSanitizeTitle:
    def test_removes_special_chars(self):
        assert sanitize_title("Hello! World@#$%") == "Hello World"

    def test_normalizes_spaces(self):
        assert sanitize_title("too   many    spaces") == "too many spaces"

    def test_truncates_at_60(self):
        long = "a" * 100
        assert len(sanitize_title(long)) == 60

    def test_empty_string(self):
        assert sanitize_title("") == ""

    def test_preserves_hyphens(self):
        assert sanitize_title("well-known fact") == "well-known fact"


# ---------------------------------------------------------------------------
# format_timestamp
# ---------------------------------------------------------------------------
class TestFormatTimestamp:
    @pytest.mark.parametrize(
        "seconds, expected",
        [
            (0, "00:00"),
            (5, "00:05"),
            (65, "01:05"),
            (600, "10:00"),
            (3599, "59:59"),
            (3600, "01:00:00"),
            (3661, "01:01:01"),
            (86399, "23:59:59"),
        ],
    )
    def test_formats(self, seconds, expected):
        assert format_timestamp(seconds) == expected


# ---------------------------------------------------------------------------
# build_folder_name
# ---------------------------------------------------------------------------
class TestBuildFolderName:
    def test_format(self, frozen_date):
        result = build_folder_name("abc123_DEFG", "My Great Video!")
        assert result == "2025-06-15 - abc123_DEFG - My Great Video"

    def test_title_sanitized(self, frozen_date):
        result = build_folder_name("vid1234_5678", "A@B#C$D")
        assert result == "2025-06-15 - vid1234_5678 - ABCD"


# ---------------------------------------------------------------------------
# build_transcript_md
# ---------------------------------------------------------------------------
class TestBuildTranscriptMd:
    def test_contains_header_fields(self, frozen_date, sample_entries):
        md = build_transcript_md(sample_entries, "Title", "Author", "vid12345678")
        assert "**URL**: https://youtube.com/watch?v=vid12345678" in md
        assert "**Author**: Author" in md
        assert "**Fetched**: 2025-06-15" in md
        assert "**Video ID**: vid12345678" in md

    def test_formats_entries_with_timestamps(self, frozen_date, sample_entries):
        md = build_transcript_md(sample_entries, "T", "A", "v1234567890")
        assert "[00:00] Hello and welcome." in md
        assert "[01:05] Today we talk about Python." in md
        assert "[01:01:01] Let's wrap up." in md

    def test_starts_with_heading(self, frozen_date, sample_entries):
        md = build_transcript_md(sample_entries, "My Title", "A", "v")
        assert md.startswith("# My Title\n")

    def test_ends_with_newline(self, frozen_date, sample_entries):
        md = build_transcript_md(sample_entries, "T", "A", "v")
        assert md.endswith("\n")


# ---------------------------------------------------------------------------
# fetch_metadata (mocked)
# ---------------------------------------------------------------------------
class TestFetchMetadata:
    @patch("yt.transcript.requests.get")
    def test_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "title": "My Video",
            "author_name": "Some Author",
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        result = fetch_metadata("abc12345678")
        assert result == {"title": "My Video", "author": "Some Author"}

    @patch("yt.transcript.requests.get")
    def test_http_error_returns_fallback(self, mock_get):
        mock_get.side_effect = requests.RequestException("timeout")
        result = fetch_metadata("abc12345678")
        assert result == {"title": "abc12345678", "author": "Unknown"}

    @patch("yt.transcript.requests.get")
    def test_json_decode_error_returns_fallback(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("bad json")
        mock_get.return_value = mock_resp

        result = fetch_metadata("abc12345678")
        assert result == {"title": "abc12345678", "author": "Unknown"}


# ---------------------------------------------------------------------------
# fetch_transcript (mocked)
# ---------------------------------------------------------------------------
class TestFetchTranscript:
    @patch("yt.transcript.YouTubeTranscriptApi")
    def test_success(self, MockApi):
        snippet1 = MagicMock(text="Hello", start=0.0)
        snippet2 = MagicMock(text="World", start=5.0)
        mock_transcript = MagicMock()
        mock_transcript.snippets = [snippet1, snippet2]
        MockApi.return_value.fetch.return_value = mock_transcript

        entries = fetch_transcript("vid12345678")
        assert entries == [
            {"text": "Hello", "start": 0.0},
            {"text": "World", "start": 5.0},
        ]

    @patch("yt.transcript.YouTubeTranscriptApi")
    def test_api_exception_propagates(self, MockApi):
        MockApi.return_value.fetch.side_effect = Exception("API down")
        with pytest.raises(Exception, match="API down"):
            fetch_transcript("vid12345678")


# ---------------------------------------------------------------------------
# save_transcript (filesystem via tmp_path)
# ---------------------------------------------------------------------------
class TestSaveTranscript:
    def test_creates_folder_and_file(
        self, transcripts_dir, frozen_date, sample_entries
    ):
        folder = save_transcript(
            "dQw4w9WgXcQ", "My Video", "Author", sample_entries
        )
        assert folder.exists()
        assert folder.is_dir()
        transcript_file = folder / "transcript.md"
        assert transcript_file.exists()

    def test_content_is_correct(
        self, transcripts_dir, frozen_date, sample_entries
    ):
        folder = save_transcript(
            "dQw4w9WgXcQ", "My Video", "Author", sample_entries
        )
        content = (folder / "transcript.md").read_text(encoding="utf-8")
        assert "# My Video" in content
        assert "**Author**: Author" in content
        assert "[00:00] Hello and welcome." in content

    def test_folder_name_format(
        self, transcripts_dir, frozen_date, sample_entries
    ):
        folder = save_transcript(
            "dQw4w9WgXcQ", "My Video", "Author", sample_entries
        )
        assert folder.name == "2025-06-15 - dQw4w9WgXcQ - My Video"
