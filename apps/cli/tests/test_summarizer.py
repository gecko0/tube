import subprocess
from unittest.mock import MagicMock, patch

import pytest

from yt.summarizer import (
    SummaryMetadata,
    build_brief_summary_prompt,
    build_summary_md,
    build_tags_prompt,
    parse_tags_response,
    save_brief_summary,
    save_summary,
    save_tags,
    strip_summary_header,
    summarize,
    summarize_brief,
    summarize_tags,
)


# ---------------------------------------------------------------------------
# build_summary_md
# ---------------------------------------------------------------------------
class TestBuildSummaryMd:
    def test_removes_generated_heading(self, frozen_date):
        summary = "# My Video\n\nSome content here."
        result = build_summary_md(summary, "My Video", "dQw4w9WgXcQ")

        assert result == "Some content here.\n"

    def test_single_line_input(self, frozen_date):
        summary = "# Just a heading"
        result = build_summary_md(summary, "Title", "vid12345678")

        assert result == "# Just a heading\n"

    def test_omits_url_and_date(self, frozen_date):
        result = build_summary_md("# T\nBody", "T", "abc12345678")

        assert "https://youtube.com/watch?v=abc12345678" not in result
        assert "2025-06-15T10:30:45-04:00" not in result

    def test_omits_ai_engine_and_model_when_provided(self, frozen_date):
        result = build_summary_md(
            "# T\nBody",
            "T",
            "abc12345678",
            ai_engine="codex",
            model="gpt-5.5",
        )

        assert "**AI Engine**: codex" not in result
        assert "**Model**: gpt-5.5" not in result

    def test_omits_ai_engine_and_model_when_not_provided(self, frozen_date):
        result = build_summary_md("# T\nBody", "T", "abc12345678")

        assert "**AI Engine**:" not in result
        assert "**Model**:" not in result

    def test_ends_with_newline(self, frozen_date):
        result = build_summary_md("# T\nBody", "T", "abc12345678")
        assert result.endswith("\n")

    def test_strips_old_metadata_block(self):
        result = strip_summary_header(
            "# Title\n\n"
            "**URL**: https://youtube.com/watch?v=abc12345678\n"
            "**Generated**: 2025-06-15T10:30:45-04:00\n"
            "**AI Engine**: claude\n"
            "**Model**: sonnet\n\n"
            "---\n\n"
            "## TLDR\nBody"
        )

        assert result == "## TLDR\nBody\n"


# ---------------------------------------------------------------------------
# build_brief_summary_prompt
# ---------------------------------------------------------------------------
class TestBuildBriefSummaryPrompt:
    def test_default_prompt_contains_orientation_goal(self):
        result = build_brief_summary_prompt(
            "[00:00 | t=0s] hello",
            "Video Title",
            "vid12345678",
            config={},
        )

        assert "brief orientation summary" in result
        assert "Video Title" in result
        assert "https://youtube.com/watch?v=vid12345678" in result
        assert "[00:00 | t=0s] hello" in result

    def test_uses_configured_prompt_template(self):
        result = build_brief_summary_prompt(
            "transcript",
            "Title",
            "vid12345678",
            config={
                "brief_summary_prompt": (
                    "Title={title}\nURL={video_url}\nTranscript={transcript_text}"
                )
            },
        )

        assert result == (
            "Title=Title\n"
            "URL=https://youtube.com/watch?v=vid12345678\n"
            "Transcript=transcript"
        )


# ---------------------------------------------------------------------------
# tags
# ---------------------------------------------------------------------------
class TestTags:
    def test_build_tags_prompt_contains_summary_context(self):
        result = build_tags_prompt("Video Title", "Brief text", "Detailed text")

        assert "Video Title" in result
        assert "Brief text" in result
        assert "Detailed text" in result
        assert '{"tags"' in result

    def test_parse_tags_response_normalizes_and_dedupes(self):
        result = parse_tags_response(
            '{"tags":[" Python ", "#AI", "python", "Machine   Learning"]}'
        )

        assert result == ["python", "ai", "machine learning"]

    def test_parse_tags_response_accepts_json_code_fence(self):
        result = parse_tags_response('```json\n{"tags":["Python"]}\n```')

        assert result == ["python"]

    def test_parse_tags_response_rejects_invalid_json(self):
        with pytest.raises(ValueError, match="valid JSON"):
            parse_tags_response("tags: python")

    def test_parse_tags_response_rejects_wrong_shape(self):
        with pytest.raises(ValueError, match="tags"):
            parse_tags_response('{"labels":["python"]}')

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_summarize_tags_returns_parsed_tags(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout='{"tags":["Python","AI"]}')

        with patch("yt.summarizer.load_config", return_value={}):
            result = summarize_tags("Title", "Brief", "Detailed")

        assert result == ["python", "ai"]


# ---------------------------------------------------------------------------
# summarize (mocked)
# ---------------------------------------------------------------------------
class TestSummarize:
    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_success(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="  Summary text here  ")
        with patch("yt.summarizer.load_config", return_value={}):
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
        with patch("yt.summarizer.load_config", return_value={}):
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

        with patch("yt.summarizer.load_config", return_value={}):
            summarize("text", "title")

        assert mock_run.call_args[0][0][1:4] == ["--model", "opus", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_model_argument_overrides_config(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={}):
            summarize("text", "title", model="fable")

        assert mock_run.call_args[0][0][1:4] == ["--model", "fable", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_uses_model_from_config(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"model": "opus"}):
            summarize("text", "title")

        assert mock_run.call_args[0][0][1:4] == ["--model", "opus", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_model_argument_overrides_saved_config(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"model": "opus"}):
            summarize("text", "title", model="sonnet")

        assert mock_run.call_args[0][0][1:4] == ["--model", "sonnet", "-p"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_uses_resolved_metadata_when_provided(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"ai_engine": "claude"}):
            summarize(
                "text",
                "title",
                metadata=SummaryMetadata(ai_engine="codex", model="gpt-5.5"),
            )

        assert mock_run.call_args[0][0][0:4] == ["codex", "exec", "--model", "gpt-5.5"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_brief_summary_uses_brief_prompt(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="brief output")

        with patch("yt.summarizer.load_config", return_value={}):
            result = summarize_brief(
                "[00:00 | t=0s] transcript",
                "Video Title",
                "vid12345678",
            )

        assert result == "brief output"
        prompt = mock_run.call_args[0][0][4]
        assert "brief orientation summary" in prompt
        assert "[00:00 | t=0s] transcript" in prompt

    @patch("yt.summarizer.shutil.which", return_value=None)
    def test_claude_not_found_raises(self, mock_which):
        with patch("yt.summarizer.load_config", return_value={}), pytest.raises(
            FileNotFoundError, match="claude CLI not found"
        ):
            summarize("text", "title")

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/claude")
    def test_subprocess_error_propagates(self, mock_which, mock_run):
        mock_run.side_effect = subprocess.CalledProcessError(1, "claude")
        with patch("yt.summarizer.load_config", return_value={}), pytest.raises(
            subprocess.CalledProcessError
        ):
            summarize("text", "title")

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_config_ai_engine_codex_invokes_codex(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="  Codex summary  ")

        with patch("yt.summarizer.load_config", return_value={"ai_engine": "codex"}):
            result = summarize("text", "title")

        assert result == "Codex summary"
        mock_run.assert_called_once()
        command = mock_run.call_args[0][0]
        assert command == [
            "codex",
            "exec",
            "--model",
            "gpt-5.5",
            "-c",
            'model_reasoning_effort="medium"',
            "-",
        ]
        assert mock_run.call_args.kwargs["input"] is not None

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_cli_ai_engine_overrides_config(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"ai_engine": "claude"}):
            summarize("text", "title", ai_engine="codex")

        assert mock_run.call_args[0][0][0:4] == ["codex", "exec", "--model", "gpt-5.5"]

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_codex_latest_model_resolves_to_default(self, mock_which, mock_run):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"ai_engine": "codex"}):
            summarize("text", "title", model="latest")

        assert mock_run.call_args[0][0][3] == "gpt-5.5"

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_codex_ignores_incompatible_cli_model(self, mock_which, mock_run, capsys):
        mock_run.return_value = MagicMock(stdout="output")

        with patch("yt.summarizer.load_config", return_value={"ai_engine": "codex"}):
            summarize("text", "title", model="opus")

        assert mock_run.call_args[0][0][3] == "gpt-5.5"
        assert "not compatible with Codex" in capsys.readouterr().err

    @patch("yt.summarizer.subprocess.run")
    @patch("yt.summarizer.shutil.which", return_value="/usr/bin/codex")
    def test_codex_ignores_incompatible_config_model(self, mock_which, mock_run, capsys):
        mock_run.return_value = MagicMock(stdout="output")

        with patch(
            "yt.summarizer.load_config",
            return_value={"ai_engine": "codex", "model": "opus"},
        ):
            summarize("text", "title")

        assert mock_run.call_args[0][0][3] == "gpt-5.5"
        assert "not compatible with Codex" in capsys.readouterr().err

    @patch("yt.summarizer.shutil.which", return_value=None)
    def test_codex_not_found_raises(self, mock_which):
        with patch("yt.summarizer.load_config", return_value={"ai_engine": "codex"}):
            with pytest.raises(FileNotFoundError, match="codex CLI not found"):
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

    def test_metadata_is_stored_in_metadata_json(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# Summary\nContent", "Title", "vid12345678")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        metadata = (folder / "metadata.json").read_text(encoding="utf-8")
        assert "**URL**: https://youtube.com/watch?v=vid12345678" not in content
        assert '"summaryGeneratedAt": "2025-06-15T10:30:45-04:00"' in metadata

    def test_ai_metadata_is_stored_in_metadata_json(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(
            folder,
            "# Summary\nContent",
            "Title",
            "vid12345678",
            ai_engine="claude",
            model="sonnet",
        )
        content = (folder / "summary.md").read_text(encoding="utf-8")
        metadata = (folder / "metadata.json").read_text(encoding="utf-8")

        assert "**AI Engine**: claude" not in content
        assert "**Model**: sonnet" not in content
        assert '"aiEngine": "claude"' in metadata
        assert '"model": "sonnet"' in metadata

    def test_content_has_summary_text(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# My Summary\nThe body.", "T", "v1234567890")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        assert "# My Summary" not in content
        assert "The body." in content

    def test_file_ends_with_newline(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_summary(folder, "# S\nBody", "T", "v1234567890")
        content = (folder / "summary.md").read_text(encoding="utf-8")
        assert content.endswith("\n")


# ---------------------------------------------------------------------------
# save_brief_summary
# ---------------------------------------------------------------------------
class TestSaveBriefSummary:
    def test_writes_file(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_brief_summary(folder, "Brief content", ai_engine="claude", model="sonnet")

        assert (folder / "brief_summary.md").read_text(encoding="utf-8") == (
            "Brief content\n"
        )

    def test_updates_metadata(self, tmp_path, frozen_date):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_brief_summary(folder, "Brief content", ai_engine="claude", model="sonnet")

        metadata = (folder / "metadata.json").read_text(encoding="utf-8")
        assert '"aiEngine": "claude"' in metadata
        assert '"model": "sonnet"' in metadata
        assert '"briefSummaryGeneratedAt": "2025-06-15T10:30:45-04:00"' in metadata


class TestSaveTags:
    def test_writes_tags_json(self, tmp_path):
        folder = tmp_path / "transcript_folder"
        folder.mkdir()

        save_tags(folder, ["python", "ai"])

        assert (folder / "tags.json").read_text(encoding="utf-8") == (
            '{\n  "tags": [\n    "python",\n    "ai"\n  ]\n}\n'
        )
