from unittest.mock import patch

import pytest
from click.testing import CliRunner

from yt.main import cli, delete_video_cmd, resolve_ref


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
