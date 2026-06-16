import json
from unittest.mock import MagicMock, patch

import pytest

from yt.cloud import (
    get_missing_video_ids,
    is_connected,
    load_config,
    save_config,
    upload_video,
)


@pytest.fixture()
def config_path(monkeypatch, tmp_path):
    """Redirect CONFIG_PATH to a tmp_path file."""
    import yt.cloud

    cfg = tmp_path / "config.json"
    monkeypatch.setattr(yt.cloud, "CONFIG_PATH", cfg)
    return cfg


# ---------------------------------------------------------------------------
# load_config / save_config
# ---------------------------------------------------------------------------
class TestConfig:
    def test_load_missing_file(self, config_path):
        assert load_config() == {}

    def test_save_and_load(self, config_path):
        save_config({"api_key": "test123", "convex_url": "https://example.convex.site"})
        assert config_path.exists()
        config = load_config()
        assert config["api_key"] == "test123"
        assert config["convex_url"] == "https://example.convex.site"

    def test_save_creates_parent_dirs(self, monkeypatch, tmp_path):
        import yt.cloud

        nested = tmp_path / "deep" / "nested" / "config.json"
        monkeypatch.setattr(yt.cloud, "CONFIG_PATH", nested)
        save_config({"api_key": "k"})
        assert nested.exists()


# ---------------------------------------------------------------------------
# is_connected
# ---------------------------------------------------------------------------
class TestIsConnected:
    def test_not_connected_when_no_config(self, config_path):
        assert is_connected() is False

    def test_not_connected_when_empty_key(self, config_path):
        save_config({"api_key": ""})
        assert is_connected() is False

    def test_connected_when_key_present(self, config_path):
        save_config({"api_key": "my-key"})
        assert is_connected() is True


# ---------------------------------------------------------------------------
# upload_video
# ---------------------------------------------------------------------------
class TestUploadVideo:
    def test_returns_false_when_no_key(self, config_path):
        result = upload_video("vid1", "2025-06-15", "Title", "transcript", None)
        assert result is False

    def test_successful_upload(self, config_path):
        save_config({"api_key": "my-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200

        with patch("yt.cloud.requests.post", return_value=mock_resp) as mock_post:
            result = upload_video("vid1", "2025-06-15", "Title", "# Transcript", "# Summary")

        assert result is True
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer my-key"
        payload = call_kwargs.kwargs["json"]
        assert payload["videoId"] == "vid1"
        assert payload["summaryMd"] == "# Summary"

    def test_upload_without_summary(self, config_path):
        save_config({"api_key": "my-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200

        with patch("yt.cloud.requests.post", return_value=mock_resp) as mock_post:
            result = upload_video("vid1", "2025-06-15", "Title", "# Transcript", None)

        assert result is True
        payload = mock_post.call_args.kwargs["json"]
        assert "summaryMd" not in payload

    def test_returns_false_on_server_error(self, config_path):
        save_config({"api_key": "my-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 401

        with patch("yt.cloud.requests.post", return_value=mock_resp):
            result = upload_video("vid1", "2025-06-15", "Title", "transcript", None)

        assert result is False

    def test_returns_false_on_network_error(self, config_path):
        save_config({"api_key": "my-key"})

        import requests

        with patch("yt.cloud.requests.post", side_effect=requests.ConnectionError):
            result = upload_video("vid1", "2025-06-15", "Title", "transcript", None)

        assert result is False

    def test_uses_custom_convex_url(self, config_path):
        save_config({"api_key": "my-key", "convex_url": "https://custom.convex.site"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200

        with patch("yt.cloud.requests.post", return_value=mock_resp) as mock_post:
            upload_video("vid1", "2025-06-15", "Title", "transcript", None)

        url = mock_post.call_args.args[0]
        assert url == "https://custom.convex.site/api/upload"


# ---------------------------------------------------------------------------
# get_missing_video_ids
# ---------------------------------------------------------------------------
class TestGetMissingVideoIds:
    def test_returns_none_when_no_key(self, config_path):
        assert get_missing_video_ids(["vid1"]) is None

    def test_successful_missing_check(self, config_path):
        save_config({"api_key": "my-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"missingVideoIds": ["vid2"]}

        with patch("yt.cloud.requests.post", return_value=mock_resp) as mock_post:
            result = get_missing_video_ids(["vid1", "vid2"])

        assert result == ["vid2"]
        mock_post.assert_called_once()
        assert mock_post.call_args.args[0] == "https://sensible-alligator-750.convex.site/api/missing"
        assert mock_post.call_args.kwargs["json"] == {"videoIds": ["vid1", "vid2"]}
        assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer my-key"

    def test_returns_none_on_invalid_response(self, config_path):
        save_config({"api_key": "my-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"missingVideoIds": [123]}

        with patch("yt.cloud.requests.post", return_value=mock_resp):
            assert get_missing_video_ids(["vid1"]) is None


# ---------------------------------------------------------------------------
# CLI connect / disconnect commands
# ---------------------------------------------------------------------------
class TestConnectDisconnect:
    def test_connect_saves_key(self, config_path):
        from click.testing import CliRunner

        from yt.main import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["connect", "my-secret-key"])
        assert result.exit_code == 0
        assert "Connected" in result.output
        config = json.loads(config_path.read_text())
        assert config["api_key"] == "my-secret-key"

    def test_connect_without_key_fails(self, config_path):
        from click.testing import CliRunner

        from yt.main import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["connect"])
        assert result.exit_code != 0

    def test_disconnect_removes_key(self, config_path):
        save_config({"api_key": "old-key", "convex_url": "https://x.convex.site"})

        from click.testing import CliRunner

        from yt.main import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["disconnect"])
        assert result.exit_code == 0
        assert "Disconnected" in result.output
        config = json.loads(config_path.read_text())
        assert "api_key" not in config
        # Other config keys preserved
        assert config["convex_url"] == "https://x.convex.site"


# ---------------------------------------------------------------------------
# CLI sync command
# ---------------------------------------------------------------------------
class TestSync:
    def make_transcripts(self, transcripts_dir, count):
        for i in range(1, count + 1):
            folder = transcripts_dir / f"2025-06-15T{i:06d} - vid{i:08d} - Title {i}"
            folder.mkdir()
            (folder / "transcript.md").write_text(f"# Transcript {i}", encoding="utf-8")

    def test_sync_requires_connection(self, config_path):
        from click.testing import CliRunner

        from yt.main import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["sync"])

        assert result.exit_code != 0
        assert "Connect first" in result.output

    def test_sync_uploads_only_missing_videos(self, config_path, transcripts_dir):
        from click.testing import CliRunner

        from yt.main import cli

        save_config({"api_key": "my-key"})

        local_only = transcripts_dir / "2025-06-15 - localonly01 - Local Only"
        local_only.mkdir()
        (local_only / "transcript.md").write_text("# Local transcript", encoding="utf-8")
        (local_only / "summary.md").write_text("# Local summary", encoding="utf-8")

        already_synced = transcripts_dir / "2025-06-16 - synced00002 - Already Synced"
        already_synced.mkdir()
        (already_synced / "transcript.md").write_text("# Existing transcript", encoding="utf-8")

        runner = CliRunner()
        with (
            patch("yt.main.get_missing_video_ids", return_value=["localonly01"]) as mock_missing,
            patch("yt.main.upload_video", return_value=True) as mock_upload,
        ):
            result = runner.invoke(cli, ["sync"])

        assert result.exit_code == 0
        assert "Uploaded 1 missing video" in result.output
        mock_missing.assert_called_once_with(["synced00002", "localonly01"])
        mock_upload.assert_called_once_with(
            video_id="localonly01",
            date="2025-06-15",
            title="Local Only",
            transcript_md="# Local transcript",
            summary_md="# Local summary",
        )

    def test_sync_defaults_to_latest_100(self, config_path, transcripts_dir):
        from click.testing import CliRunner

        from yt.main import cli

        save_config({"api_key": "my-key"})
        self.make_transcripts(transcripts_dir, 105)

        runner = CliRunner()
        with patch("yt.main.get_missing_video_ids", return_value=[]) as mock_missing:
            result = runner.invoke(cli, ["sync"])

        assert result.exit_code == 0
        expected_ids = [f"vid{i:08d}" for i in range(105, 5, -1)]
        mock_missing.assert_called_once_with(expected_ids)

    def test_sync_limit(self, config_path, transcripts_dir):
        from click.testing import CliRunner

        from yt.main import cli

        save_config({"api_key": "my-key"})
        self.make_transcripts(transcripts_dir, 5)

        runner = CliRunner()
        with patch("yt.main.get_missing_video_ids", return_value=[]) as mock_missing:
            result = runner.invoke(cli, ["sync", "--limit", "3"])

        assert result.exit_code == 0
        mock_missing.assert_called_once_with(["vid00000005", "vid00000004", "vid00000003"])

    def test_sync_all(self, config_path, transcripts_dir):
        from click.testing import CliRunner

        from yt.main import cli

        save_config({"api_key": "my-key"})
        self.make_transcripts(transcripts_dir, 105)

        runner = CliRunner()
        with patch("yt.main.get_missing_video_ids", return_value=[]) as mock_missing:
            result = runner.invoke(cli, ["sync", "--all"])

        assert result.exit_code == 0
        expected_ids = [f"vid{i:08d}" for i in range(105, 0, -1)]
        mock_missing.assert_called_once_with(expected_ids)
