from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest


class _FrozenDatetime(datetime):
    """Datetime subclass where astimezone() returns self to preserve the frozen tz in tests."""

    def astimezone(self, tz=None):
        if tz is None:
            return self
        return super().astimezone(tz)


FIXED_DATETIME = _FrozenDatetime(2025, 6, 15, 10, 30, 45, tzinfo=timezone(timedelta(hours=-4)))


@pytest.fixture()
def frozen_date(monkeypatch):
    """Freeze datetime.now() in modules that call it."""
    fake_datetime = MagicMock(wraps=datetime)
    fake_datetime.now.return_value = FIXED_DATETIME

    import yt.transcript
    import yt.summarizer

    monkeypatch.setattr(yt.transcript, "datetime", fake_datetime)
    monkeypatch.setattr(yt.summarizer, "datetime", fake_datetime)
    return FIXED_DATETIME


@pytest.fixture()
def transcripts_dir(monkeypatch, tmp_path):
    """Redirect TRANSCRIPTS_DIR to a tmp_path subdirectory."""
    d = tmp_path / "transcripts"
    d.mkdir()

    import yt.config
    import yt.storage
    import yt.transcript

    monkeypatch.setattr(yt.config, "TRANSCRIPTS_DIR", d)
    monkeypatch.setattr(yt.storage, "TRANSCRIPTS_DIR", d)
    monkeypatch.setattr(yt.transcript, "TRANSCRIPTS_DIR", d)
    return d


@pytest.fixture()
def sample_entries():
    """Reusable list of transcript entry dicts."""
    return [
        {"text": "Hello and welcome.", "start": 0.0},
        {"text": "Today we talk about Python.", "start": 65.5},
        {"text": "Let's wrap up.", "start": 3661.0},
    ]
