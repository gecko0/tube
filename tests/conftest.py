from datetime import date
from unittest.mock import MagicMock

import pytest


FIXED_DATE = date(2025, 6, 15)


@pytest.fixture()
def frozen_date(monkeypatch):
    """Freeze date.today() in modules that call it."""
    fake_date = MagicMock(wraps=date)
    fake_date.today.return_value = FIXED_DATE

    import yt.transcript
    import yt.summarizer

    monkeypatch.setattr(yt.transcript, "date", fake_date)
    monkeypatch.setattr(yt.summarizer, "date", fake_date)
    return FIXED_DATE


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
