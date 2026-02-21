import pytest

from yt.main import resolve_ref


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

    def test_numeric_index(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()
        (transcripts_dir / "2025-03-10 - vid2 - Second").mkdir()
        (transcripts_dir / "2025-06-15 - vid3 - Third").mkdir()

        # Ascending order: vid1=1, vid2=2, vid3=3
        folder, video_id = resolve_ref("1")
        assert video_id == "vid1"

        folder, video_id = resolve_ref("3")
        assert video_id == "vid3"

    def test_numeric_index_out_of_range(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()

        with pytest.raises(SystemExit):
            resolve_ref("99")

    def test_numeric_index_zero(self, transcripts_dir):
        (transcripts_dir / "2025-01-01 - vid1 - First").mkdir()

        with pytest.raises(SystemExit):
            resolve_ref("0")

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
