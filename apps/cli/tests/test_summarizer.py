import subprocess
from unittest.mock import MagicMock, patch

import pytest

from yt.summarizer import build_summary_md, save_summary, summarize


# ---------------------------------------------------------------------------
# build_summary_md
# ---------------------------------------------------------------------------
class TestBuildSummaryMd:
    def test_inserts_metadata_after_heading(self, frozen_date):
        summary = "# My Video\n\nSome content here."
        result = build_summary_md(summary, "My Video", "dQw4w9WgXcQ")

        assert result.startswith("# My Video\n")
        assert "**URL**: https://youtube.com/watch?v=dQw4w9WgXcQ" in result
        assert "**Generated**: 2025-06-15T10:30:45-04:00" in result
        assert "Some content here." in result

    def test_single_line_input(self, frozen_date):
        summary = "# Just a heading"
        result = build_summary_md(summary, "Title", "vid12345678")

        assert "# Just a heading" in result
        assert "**URL**: https://youtube.com/watch?v=vid12345678" in result
        assert "**Generated**: 2025-06-15T10:30:45-04:00" in result

    def test_contains_url_and_date(self, frozen_date):
        result = build_summary_md("# T\nBody", "T", "abc12345678")

        assert "https://youtube.com/watch?v=abc12345678" in result
        assert "2025-06-15T10:30:45-04:00" in result

    def test_ends_with_newline(self, frozen_date):
        result = build_summary_md("# T\nBody", "T", "abc12345678")
        assert result.endswith("\n")


# ---------------------------------------------------------------------------
# summarize (mocked)
# ---------------------------------------------------------------------------
class TestSummarize:
    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_success(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="  Summary text here  ")
        result = summarize("transcript text", "My Video")

        assert result == "Summary text here"
        mock_run.assert_called_once()
        args = mock_run.call_args
        assert args[0][0][0] == "claude"
        assert args[0][0][1:4] == ["--model", "sonnet", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_prompt_contains_title_and_transcript(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")
        summarize("my transcript content", "Video Title Here")

        prompt = mock_run.call_args[0][0][4]
        assert "Video Title Here" in prompt
        assert "my transcript content" in prompt

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_uses_configured_claude_model(self, mock_which, mock_run, monkeypatch):
        import yt.summarizer

        monkeypatch.setattr(yt.summarizer, "CLAUDE_MODEL", "opus")
        mock_run.return_value = MagicMock(stdout="output")

        summarize("text", "title")

        assert mock_run.call_args[0][0][1:4] == ["--model", "opus", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_model_argument_overrides_config(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        summarize("text", "title", model="fable")

        assert mock_run.call_args[0][0][1:4] == ["--model", "fable", "-p"]

    @patch("yt.summarizer.shutil.which", return_value=None)
    def test_claude_not_found_raises(self, mock_which):
        with pytest.raises(FileNotFoundError, match="claude CLI not found"):
            summarize("text", "title")

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_subprocess_error_propagates(self, mock_which, mock_run):
        mock_run.side_effect = subprocess.CalledProcessError(1, "claude")
        with pytest.raises(subprocess.CalledProcessError):
            summarize("text", "title")


# ---------------------------------------------------------------------------
# save_summary (filesystem via tmp_path)
# ---------------------------------------------------------------------------
class TestSaveSummary:
    def test_writes_file(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# Summary\nContent", "Title", "vid12345678")
        summary_file = folder / "summary.md"
        assert summary_file.exists()

    def test_content_contains_metadata(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# Summary\nContent", "Title", "vid12345678")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        assert "**URL**: https://youtube.com/watch?v=vid12345678" in content
        assert "**Generated**: 2025-06-15" in content

    def test_content_has_summary_text(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# My Summary\nThe body.", "T", "v1234567890")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        assert "# My Summary" in content
        assert "The body." in content

    def test_file_ends_with_newline(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# S\nBody", "T", "v1234567890")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        assert content.endswith("\n")
