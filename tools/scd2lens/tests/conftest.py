import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def export():
    from scd2lens.ingest.loader import load_export
    return load_export(FIX)


@pytest.fixture(scope="session")
def settings():
    from scd2lens.config import Settings
    s = Settings()
    s.odi_dir = FIX
    return s


class FakeRun:
    """Records every SQL and its binds; answers with canned rows per query keyword."""

    def __init__(self, answers=None):
        self.calls = []
        self.answers = answers or {}

    def __call__(self, sql, binds=None):
        self.calls.append((sql, binds or {}))
        for k, v in self.answers.items():
            if k in sql:
                return v
        return []


@pytest.fixture
def fake_run():
    return FakeRun
