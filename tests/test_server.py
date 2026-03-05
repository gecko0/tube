import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, transcripts_dir):
    """Create a test client with TRANSCRIPTS_DIR patched."""
    import yt.server

    monkeypatch.setattr(yt.server, "TRANSCRIPTS_DIR", transcripts_dir)

    # Re-create app without static mount (no dist dir in tests)
    from fastapi import FastAPI

    test_app = FastAPI()
    test_app.add_api_route("/api/videos", yt.server.api_list_videos)
    test_app.add_api_route("/api/videos/{video_id}", yt.server.api_get_video)
    test_app.add_api_route(
        "/api/videos/{video_id}", yt.server.api_delete_video, methods=["DELETE"]
    )
    return TestClient(test_app)


def _make_video_folder(transcripts_dir, date, video_id, title, summary=None):
    """Helper to create a video folder with transcript and optional summary."""
    folder = transcripts_dir / f"{date} - {video_id} - {title}"
    folder.mkdir()
    (folder / "transcript.md").write_text(f"# {title}\n\nTranscript content here.\n")
    if summary:
        (folder / "summary.md").write_text(f"# {title}\n\n{summary}\n")
    return folder


class TestListVideos:
    def test_empty(self, client):
        resp = client.get("/api/videos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_videos(self, client, transcripts_dir):
        _make_video_folder(transcripts_dir, "2025-01-01", "abc123xyz", "My Video", summary="Summary text")
        _make_video_folder(transcripts_dir, "2025-01-02", "def456uvw", "Other Video")

        resp = client.get("/api/videos")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

        assert data[0]["video_id"] == "abc123xyz"
        assert data[0]["title"] == "My Video"
        assert data[0]["date"] == "2025-01-01"
        assert data[0]["has_summary"] is True
        assert data[0]["thumbnail_url"] == "https://img.youtube.com/vi/abc123xyz/hqdefault.jpg"

        assert data[1]["video_id"] == "def456uvw"
        assert data[1]["has_summary"] is False

    def test_skips_invalid_folders(self, client, transcripts_dir):
        (transcripts_dir / "not-a-valid-folder").mkdir()
        _make_video_folder(transcripts_dir, "2025-03-01", "vid123abcd", "Valid Video")

        resp = client.get("/api/videos")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["video_id"] == "vid123abcd"


class TestGetVideo:
    def test_found(self, client, transcripts_dir):
        _make_video_folder(transcripts_dir, "2025-02-10T143022", "xyz789abc", "Test Video", summary="A great summary")

        resp = client.get("/api/videos/xyz789abc")
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "xyz789abc"
        assert data["title"] == "Test Video"
        assert data["date"] == "2025-02-10T143022"
        assert "Transcript content" in data["transcript_md"]
        assert "A great summary" in data["summary_md"]
        assert data["thumbnail_url"] == "https://img.youtube.com/vi/xyz789abc/hqdefault.jpg"

    def test_no_summary(self, client, transcripts_dir):
        _make_video_folder(transcripts_dir, "2025-02-10T090000", "nosummary1", "No Summary Video")

        resp = client.get("/api/videos/nosummary1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary_md"] is None
        assert data["transcript_md"] is not None

    def test_not_found(self, client):
        resp = client.get("/api/videos/nonexistent")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Video not found"


class TestDeleteVideo:
    def test_deletes_video(self, client, transcripts_dir):
        folder = _make_video_folder(
            transcripts_dir, "2025-01-01", "abc123xyz", "My Video", summary="Summary"
        )
        assert folder.exists()

        resp = client.delete("/api/videos/abc123xyz")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        assert not folder.exists()

    def test_not_found(self, client):
        resp = client.delete("/api/videos/nonexistent")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Video not found"

    def test_video_gone_from_list_after_delete(self, client, transcripts_dir):
        _make_video_folder(transcripts_dir, "2025-01-01", "vid1aaaaaa", "Video 1")
        _make_video_folder(transcripts_dir, "2025-01-02", "vid2bbbbbb", "Video 2")

        client.delete("/api/videos/vid1aaaaaa")
        resp = client.get("/api/videos")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["video_id"] == "vid2bbbbbb"
