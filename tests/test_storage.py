import pytest

from yt.storage import (
    delete_video,
    find_by_video_id,
    list_transcripts,
    parse_folder_name,
    read_summary,
    read_transcript,
)


# ---------------------------------------------------------------------------
# parse_folder_name
# ---------------------------------------------------------------------------
class TestParseFolderName:
    def test_valid_name_legacy(self):
        result = parse_folder_name("2025-06-15 - dQw4w9WgXcQ - My Video Title")
        assert result == {
            "date": "2025-06-15",
            "video_id": "dQw4w9WgXcQ",
            "title": "My Video Title",
        }

    def test_valid_name_with_time(self):
        result = parse_folder_name("2025-06-15T103045 - dQw4w9WgXcQ - My Video Title")
        assert result == {
            "date": "2025-06-15T103045",
            "video_id": "dQw4w9WgXcQ",
            "title": "My Video Title",
        }

    @pytest.mark.parametrize(
        "name",
        [
            "no-date-here - abc - title",
            "2025-06-15 - - title",
            "2025-06-15 abc title",
            "random_folder",
            "",
            "2025-06-15 -abc- title",
        ],
    )
    def test_invalid_returns_none(self, name):
        assert parse_folder_name(name) is None


# ---------------------------------------------------------------------------
# list_transcripts
# ---------------------------------------------------------------------------
class TestListTranscripts:
    def test_empty_dir(self, transcripts_dir):
        assert list_transcripts() == []

    def test_multiple_sorted_asc(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()
        (transcripts_dir / "2025-06-15 - vid2 - Second").mkdir()
        (transcripts_dir / "2025-03-10 - vid3 - Third").mkdir()

        results = list_transcripts()
        assert len(results) == 3
        assert results[0]["video_id"] == "vid1"
        assert results[1]["video_id"] == "vid3"
        assert results[2]["video_id"] == "vid2"

    def test_skips_non_matching_folders(self, transcripts_dir):
        (transcripts_dir / "2025-06-15 - vid1 - Good").mkdir()
        (transcripts_dir / "random_folder").mkdir()
        (transcripts_dir / "not-a-date - x - y").mkdir()

        results = list_transcripts()
        assert len(results) == 1
        assert results[0]["video_id"] == "vid1"

    def test_detects_has_summary(self, transcripts_dir):
        folder = transcripts_dir / "2025-06-15 - vid1 - Title"
        folder.mkdir()
        (folder / "summary.md").write_text("summary", encoding="utf-8")

        results = list_transcripts()
        assert results[0]["has_summary"] is True

    def test_no_summary_detected(self, transcripts_dir):
        (transcripts_dir / "2025-06-15 - vid1 - Title").mkdir()

        results = list_transcripts()
        assert results[0]["has_summary"] is False

    def test_mixed_legacy_and_new_format_sorted(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - Old Format").mkdir()
        (transcripts_dir / "2025-06-15T103045 - vid2 - New Format").mkdir()
        (transcripts_dir / "2025-03-10 - vid3 - Mid Legacy").mkdir()

        results = list_transcripts()
        assert len(results) == 3
        assert results[0]["video_id"] == "vid1"
        assert results[1]["video_id"] == "vid3"
        assert results[2]["video_id"] == "vid2"

    def test_dir_doesnt_exist(self, monkeypatch, tmp_path):
        import yt.storage

        monkeypatch.setattr(yt.storage, "TRANSCRIPTS_DIR", tmp_path / "nope")
        assert list_transcripts() == []


# ---------------------------------------------------------------------------
# find_by_video_id
# ---------------------------------------------------------------------------
class TestFindByVideoId:
    def test_found(self, transcripts_dir):
        folder = transcripts_dir / "2025-06-15 - dQw4w9WgXcQ - Title"
        folder.mkdir()

        result = find_by_video_id("dQw4w9WgXcQ")
        assert result == folder

    def test_not_found(self, transcripts_dir):
        (transcripts_dir / "2025-06-15 - other_id123 - Title").mkdir()
        assert find_by_video_id("nonexistent11") is None

    def test_dir_doesnt_exist(self, monkeypatch, tmp_path):
        import yt.storage

        monkeypatch.setattr(yt.storage, "TRANSCRIPTS_DIR", tmp_path / "nope")
        assert find_by_video_id("abc12345678") is None


# ---------------------------------------------------------------------------
# delete_video
# ---------------------------------------------------------------------------
class TestDeleteVideo:
    def test_deletes_existing_video(self, transcripts_dir):
        folder = transcripts_dir / "2025-06-15 - dQw4w9WgXcQ - Title"
        folder.mkdir()
        (folder / "transcript.md").write_text("# Hello", encoding="utf-8")
        (folder / "summary.md").write_text("# Summary", encoding="utf-8")

        assert delete_video("dQw4w9WgXcQ") is True
        assert not folder.exists()

    def test_returns_false_for_nonexistent(self, transcripts_dir):
        assert delete_video("nonexistent11") is False

    def test_returns_false_when_dir_missing(self, monkeypatch, tmp_path):
        import yt.storage

        monkeypatch.setattr(yt.storage, "TRANSCRIPTS_DIR", tmp_path / "nope")
        assert delete_video("abc12345678") is False

    def test_other_folders_unaffected(self, transcripts_dir):
        folder1 = transcripts_dir / "2025-01-01 - vid1 - First"
        folder1.mkdir()
        folder2 = transcripts_dir / "2025-06-15 - vid2 - Second"
        folder2.mkdir()

        delete_video("vid1")
        assert not folder1.exists()
        assert folder2.exists()


# ---------------------------------------------------------------------------
# read_transcript
# ---------------------------------------------------------------------------
class TestReadTranscript:
    def test_file_exists(self, tmp_path):
        folder = tmp_path / "some_folder"
        folder.mkdir()
        (folder / "transcript.md").write_text("# Hello", encoding="utf-8")

        assert read_transcript(folder) == "# Hello"

    def test_file_missing(self, tmp_path):
        folder = tmp_path / "empty_folder"
        folder.mkdir()
        assert read_transcript(folder) is None


# ---------------------------------------------------------------------------
# read_summary
# ---------------------------------------------------------------------------
class TestReadSummary:
    def test_file_exists(self, tmp_path):
        folder = tmp_path / "some_folder"
        folder.mkdir()
        (folder / "summary.md").write_text("# Summary", encoding="utf-8")

        assert read_summary(folder) == "# Summary"

    def test_file_missing(self, tmp_path):
        folder = tmp_path / "empty_folder"
        folder.mkdir()
        assert read_summary(folder) is None
