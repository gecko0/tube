import json

from yt.metadata import (
    build_video_metadata,
    read_video_metadata,
    update_video_metadata,
    write_video_metadata,
)


class TestVideoMetadata:
    def test_build_video_metadata(self):
        metadata = build_video_metadata(
            video_id="vid12345678",
            title="Title",
            author="Author",
            fetched_at="2025-06-15T10:30:45-04:00",
        )

        assert metadata == {
            "version": 1,
            "videoId": "vid12345678",
            "url": "https://youtube.com/watch?v=vid12345678",
            "title": "Title",
            "author": "Author",
            "fetchedAt": "2025-06-15T10:30:45-04:00",
        }

    def test_write_and_read_video_metadata(self, tmp_path):
        folder = tmp_path / "video"
        folder.mkdir()
        write_video_metadata(folder, {"version": 1, "title": "Title"})

        assert read_video_metadata(folder) == {"version": 1, "title": "Title"}
        assert json.loads((folder / "metadata.json").read_text(encoding="utf-8")) == {
            "version": 1,
            "title": "Title",
        }

    def test_read_missing_video_metadata_returns_none(self, tmp_path):
        folder = tmp_path / "video"
        folder.mkdir()

        assert read_video_metadata(folder) is None

    def test_update_video_metadata_preserves_existing_values(self, tmp_path):
        folder = tmp_path / "video"
        folder.mkdir()
        write_video_metadata(folder, {"version": 1, "title": "Title"})

        result = update_video_metadata(
            folder,
            {
                "aiEngine": "codex",
                "model": "gpt-5.5",
                "briefSummaryGeneratedAt": "2025-06-15T10:30:50-04:00",
                "summaryGeneratedAt": "2025-06-15T10:31:00-04:00",
            },
        )

        assert result == {
            "version": 1,
            "title": "Title",
            "aiEngine": "codex",
            "model": "gpt-5.5",
            "briefSummaryGeneratedAt": "2025-06-15T10:30:50-04:00",
            "summaryGeneratedAt": "2025-06-15T10:31:00-04:00",
        }
        assert read_video_metadata(folder) == result
