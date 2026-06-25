import json
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from yt.main import (
    add_video,
    cli,
    delete_video_cmd,
    parse_ai_options,
    parse_config_options,
    parse_model_options,
    parse_video_options,
    resolve_ref,
)


# ---------------------------------------------------------------------------
# parse_config_options
# ---------------------------------------------------------------------------
class TestParseConfigOptions:
    def test_key_with_space(self):
        assert parse_config_options(("--model", "opus")) == {"model": "opus"}

    def test_key_with_equals(self):
        assert parse_config_options(("--api_key=secret",)) == {"api_key": "secret"}

    def test_multiple_keys(self):
        result = parse_config_options(
            (
                "--model",
                "opus",
                "--convex_url",
                "https://example.convex.site",
                "--ai_engine",
                "codex",
            )
        )

        assert result == {
            "model": "opus",
            "convex_url": "https://example.convex.site",
            "ai_engine": "codex",
        }


# ---------------------------------------------------------------------------
# parse_model_options
# ---------------------------------------------------------------------------
class TestParseModelOptions:
    def test_model_with_space(self):
        model, args = parse_model_options(
            ("--model", "opus", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model == "opus"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_model_with_equals(self):
        model, args = parse_model_options(
            ("--model=opus", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model == "opus"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_alias_flag(self):
        model, args = parse_model_options(
            ("--opus", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model == "opus"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_stops_before_command_options(self):
        model, args = parse_model_options(("list", "--limit", "3"))

        assert model is None
        assert args == ("list", "--limit", "3")


# ---------------------------------------------------------------------------
# parse_ai_options
# ---------------------------------------------------------------------------
class TestParseAiOptions:
    def test_ai_engine_with_space(self):
        model, ai_engine, args = parse_ai_options(
            ("--ai_engine", "codex", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model is None
        assert ai_engine == "codex"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_ai_engine_with_equals(self):
        model, ai_engine, args = parse_ai_options(
            ("--ai_engine=codex", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model is None
        assert ai_engine == "codex"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_ai_engine_and_model_options(self):
        model, ai_engine, args = parse_ai_options(
            (
                "--ai_engine",
                "codex",
                "--model",
                "latest",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            )
        )

        assert model == "latest"
        assert ai_engine == "codex"
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_stops_before_command_options(self):
        model, ai_engine, args = parse_ai_options(("list", "--limit", "3"))

        assert model is None
        assert ai_engine is None
        assert args == ("list", "--limit", "3")


# ---------------------------------------------------------------------------
# parse_video_options
# ---------------------------------------------------------------------------
class TestParseVideoOptions:
    def test_force_regenerate(self):
        model, ai_engine, regenerate, args = parse_video_options(
            ("--force-regenerate", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )

        assert model is None
        assert ai_engine is None
        assert regenerate is True
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_force_alias_with_ai_options(self):
        model, ai_engine, regenerate, args = parse_video_options(
            (
                "--force",
                "--ai_engine",
                "codex",
                "--model",
                "latest",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            )
        )

        assert model == "latest"
        assert ai_engine == "codex"
        assert regenerate is True
        assert args == ("https://www.youtube.com/watch?v=dQw4w9WgXcQ",)

    def test_stops_before_command_options(self):
        model, ai_engine, regenerate, args = parse_video_options(("list", "--limit", "3"))

        assert model is None
        assert ai_engine is None
        assert regenerate is False
        assert args == ("list", "--limit", "3")


# ---------------------------------------------------------------------------
# resolve_ref
# ---------------------------------------------------------------------------
class TestResolveRef:
    def test_none_returns_latest(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()
        (transcripts_dir / "2025-06-15 - vid2 - Second").mkdir()

        folder, video_id = resolve_ref(None)
        assert video_id == "vid2"
        assert folder == transcripts_dir / "2025-06-15 - vid2 - Second"

    def test_none_empty_list_exits(self, transcripts_dir):
        with pytest.raises(SystemExit):
            resolve_ref(None)

    def test_numeric_string_is_treated_as_video_id(self, transcripts_dir):
        folder_path = transcripts_dir / "2025-06-15 - 12345 - Numeric Video ID"
        folder_path.mkdir()

        folder, video_id = resolve_ref("12345")

        assert video_id == "12345"
        assert folder == folder_path

    def test_numeric_string_not_found_exits(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()

        with pytest.raises(SystemExit):
            resolve_ref("99")

    def test_video_id_string(self, transcripts_dir):
        folder_path = transcripts_dir / "2025-06-15 - dQw4w9WgXcQ - Title"
        folder_path.mkdir()

        folder, video_id = resolve_ref("dQw4w9WgXcQ")
        assert video_id == "dQw4w9WgXcQ"
        assert folder == folder_path

    def test_video_id_not_found_exits(self, transcripts_dir):
        (transcripts_dir / "2025-06-15 - vid1 - Title").mkdir()

        with pytest.raises(SystemExit):
            resolve_ref("nonexistent")


# ---------------------------------------------------------------------------
# delete_video_cmd
# ---------------------------------------------------------------------------
class TestDeleteVideoCmd:
    def test_delete_by_video_id(self, transcripts_dir):
        folder = transcripts_dir / "2025-06-15 - dQw4w9WgXcQ - Title"
        folder.mkdir()
        (folder / "transcript.md").write_text("content")

        with patch("yt.main.click.confirm", return_value=True):
            delete_video_cmd("dQw4w9WgXcQ")

        assert not folder.exists()

    def test_delete_cancelled(self, transcripts_dir):
        folder = transcripts_dir / "2025-06-15 - vid1 - Title"
        folder.mkdir()
        (folder / "transcript.md").write_text("content")

        with patch("yt.main.click.confirm", return_value=False):
            delete_video_cmd("vid1")

        assert folder.exists()

    def test_delete_latest_when_no_ref(self, transcripts_dir):
        folder1 = transcripts_dir / "2025-01-01 - vid1 - First"
        folder1.mkdir()
        folder2 = transcripts_dir / "2025-06-15 - vid2 - Second"
        folder2.mkdir()

        with patch("yt.main.click.confirm", return_value=True):
            delete_video_cmd(None)

        assert folder1.exists()
        assert not folder2.exists()


# ---------------------------------------------------------------------------
# list command
# ---------------------------------------------------------------------------
class TestListCommand:
    def make_transcripts(self, transcripts_dir, count):
        for i in range(1, count + 1):
            folder = transcripts_dir / f"2025-06-15T{i:06d} - vid{i:08d} - Title {i}"
            folder.mkdir()

    def test_list_defaults_to_latest_100(self, transcripts_dir):
        self.make_transcripts(transcripts_dir, 105)

        result = CliRunner().invoke(cli, ["list"])

        assert result.exit_code == 0
        assert "vid00000105" in result.output
        assert "vid00000006" in result.output
        assert "vid00000005" not in result.output
        assert "Showing latest 100" in result.output
        assert "#" not in result.output

    def test_list_limit(self, transcripts_dir):
        self.make_transcripts(transcripts_dir, 5)

        result = CliRunner().invoke(cli, ["list", "--limit", "3"])

        assert result.exit_code == 0
        assert "vid00000005" in result.output
        assert "vid00000003" in result.output
        assert "vid00000002" not in result.output
        assert "Showing latest 3" in result.output

    def test_list_all(self, transcripts_dir):
        self.make_transcripts(transcripts_dir, 105)

        result = CliRunner().invoke(cli, ["list", "--all"])

        assert result.exit_code == 0
        assert "vid00000105" in result.output
        assert "vid00000001" in result.output
        assert "Showing latest" not in result.output


# ---------------------------------------------------------------------------
# add video model options
# ---------------------------------------------------------------------------
class TestAddVideoModelOptions:
    @patch("yt.main.add_video")
    def test_model_option_passes_model_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--model", "opus", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model="opus", ai_engine=None)

    @patch("yt.main.add_video")
    def test_model_equals_option_passes_model_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--model=opus", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model="opus", ai_engine=None)

    @patch("yt.main.add_video")
    def test_alias_option_passes_model_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--opus", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model="opus", ai_engine=None)

    @patch("yt.main.add_video")
    def test_ai_engine_option_passes_ai_engine_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--ai_engine", "codex", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model=None, ai_engine="codex")

    @patch("yt.main.add_video")
    def test_ai_engine_equals_option_passes_ai_engine_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--ai_engine=codex", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model=None, ai_engine="codex")

    @patch("yt.main.add_video")
    def test_ai_engine_and_model_pass_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--ai_engine", "codex", "--model", "latest", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(url, model="latest", ai_engine="codex")

    @patch("yt.main.add_video")
    def test_force_regenerate_passes_regenerate_to_add_video(self, mock_add_video):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        result = CliRunner().invoke(cli, ["--force-regenerate", url])

        assert result.exit_code == 0
        mock_add_video.assert_called_once_with(
            url,
            regenerate=True,
            prompt_regenerate=True,
            model=None,
            ai_engine=None,
        )

    @patch("yt.main.add_video")
    def test_multiple_urls_are_processed_in_order(self, mock_add_video):
        urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/9bZkp7q19f0",
        ]

        result = CliRunner().invoke(cli, urls)

        assert result.exit_code == 0
        assert mock_add_video.call_args_list == [
            (
                (urls[0],),
                {
                    "regenerate": False,
                    "prompt_regenerate": False,
                    "model": None,
                    "ai_engine": None,
                },
            ),
            (
                (urls[1],),
                {
                    "regenerate": False,
                    "prompt_regenerate": False,
                    "model": None,
                    "ai_engine": None,
                },
            ),
        ]

    @patch("yt.main.add_video")
    def test_multiple_urls_receive_ai_options(self, mock_add_video):
        urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/9bZkp7q19f0",
        ]

        result = CliRunner().invoke(cli, ["--ai_engine", "codex", "--model", "latest", *urls])

        assert result.exit_code == 0
        assert mock_add_video.call_args_list == [
            (
                (urls[0],),
                {
                    "regenerate": False,
                    "prompt_regenerate": False,
                    "model": "latest",
                    "ai_engine": "codex",
                },
            ),
            (
                (urls[1],),
                {
                    "regenerate": False,
                    "prompt_regenerate": False,
                    "model": "latest",
                    "ai_engine": "codex",
                },
            ),
        ]

    @patch("yt.main.add_video")
    def test_force_applies_to_multiple_urls(self, mock_add_video):
        urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/9bZkp7q19f0",
        ]

        result = CliRunner().invoke(cli, ["--force", *urls])

        assert result.exit_code == 0
        assert mock_add_video.call_args_list == [
            (
                (urls[0],),
                {
                    "regenerate": True,
                    "prompt_regenerate": False,
                    "model": None,
                    "ai_engine": None,
                },
            ),
            (
                (urls[1],),
                {
                    "regenerate": True,
                    "prompt_regenerate": False,
                    "model": None,
                    "ai_engine": None,
                },
            ),
        ]


# ---------------------------------------------------------------------------
# add_video flow
# ---------------------------------------------------------------------------
class TestAddVideoFlow:
    def test_add_video_skips_existing_without_prompt_in_batch_mode(self, transcripts_dir):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        (transcripts_dir / "2025-06-15 - dQw4w9WgXcQ - Existing").mkdir()

        with (
            patch("yt.main.click.confirm") as mock_confirm,
            patch("yt.main.fetch_metadata") as mock_fetch_metadata,
        ):
            add_video(url, prompt_regenerate=False)

        mock_confirm.assert_not_called()
        mock_fetch_metadata.assert_not_called()

    def test_add_video_generates_brief_and_detailed_summaries(
        self,
        transcripts_dir,
        frozen_date,
        sample_entries,
    ):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        with (
            patch(
                "yt.main.fetch_metadata",
                return_value={"title": "My Video", "author": "Author"},
            ),
            patch("yt.main.fetch_transcript", return_value=sample_entries),
            patch("yt.main.is_connected", return_value=False),
            patch("yt.main.summarize_brief", return_value="# Brief"),
            patch("yt.main.summarize", return_value="# Detailed"),
        ):
            add_video(url)

        folder = transcripts_dir / "2025-06-15T103045 - dQw4w9WgXcQ - My Video"
        assert (folder / "brief_summary.md").read_text(encoding="utf-8") == "# Brief\n"
        assert "# Detailed" in (folder / "summary.md").read_text(encoding="utf-8")

        metadata = json.loads((folder / "metadata.json").read_text(encoding="utf-8"))
        assert metadata["aiEngine"] == "claude"
        assert metadata["model"] == "sonnet"
        assert metadata["briefSummaryGeneratedAt"] == "2025-06-15T10:30:45-04:00"
        assert metadata["summaryGeneratedAt"] == "2025-06-15T10:30:45-04:00"

    def test_add_video_brief_pass_receives_raw_timestamp_seconds(
        self,
        transcripts_dir,
        frozen_date,
        sample_entries,
    ):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        with (
            patch(
                "yt.main.fetch_metadata",
                return_value={"title": "My Video", "author": "Author"},
            ),
            patch("yt.main.fetch_transcript", return_value=sample_entries),
            patch("yt.main.is_connected", return_value=False),
            patch("yt.main.summarize_brief", return_value="# Brief") as mock_brief,
            patch("yt.main.summarize", return_value="# Detailed"),
        ):
            add_video(url)

        brief_transcript_text = mock_brief.call_args.args[0]
        assert "[00:00 | t=0s] Hello and welcome." in brief_transcript_text
        assert "[01:05 | t=65s] Today we talk about Python." in brief_transcript_text

    def test_add_video_uploads_brief_summary_when_connected(
        self,
        transcripts_dir,
        frozen_date,
        sample_entries,
    ):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        with (
            patch(
                "yt.main.fetch_metadata",
                return_value={"title": "My Video", "author": "Author"},
            ),
            patch("yt.main.fetch_transcript", return_value=sample_entries),
            patch("yt.main.is_connected", return_value=True),
            patch("yt.main.summarize_brief", return_value="# Brief"),
            patch("yt.main.summarize", return_value="# Detailed"),
            patch("yt.main.upload_video", return_value=True) as mock_upload,
        ):
            add_video(url)

        assert mock_upload.call_args.kwargs["brief_summary_md"] == "# Brief\n"
        assert "# Detailed" in mock_upload.call_args.kwargs["summary_md"]
        assert mock_upload.call_args.kwargs["metadata"]["briefSummaryGeneratedAt"] == (
            "2025-06-15T10:30:45-04:00"
        )
