import json
from unittest.mock import MagicMock, patch

import pytest

from yt.cloud import is_connected, load_config, save_config, upload_video


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
