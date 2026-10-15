from typer.testing import CliRunner

from scd2lens.cli import app
from tests.conftest import FIX


def test_odi_command_prints_card():
    r = CliRunner().invoke(app, ["odi", "--table", "DIM_ACCOUNT", "--repo", str(FIX)])
    assert r.exit_code == 0, r.output
    assert "# DIM_ACCOUNT — SCD2 rule card" in r.output and "MERGE_SCD2" in r.output


def test_card_and_all_write_files(tmp_path, monkeypatch):
    for v in ("PBDW_DSN", "PBDW_USER", "PBDW_PASSWORD"):
        monkeypatch.delenv(v, raising=False)
    r = CliRunner().invoke(app, ["card", "--table", "DIM_SECURITY", "--repo", str(FIX), "--out", str(tmp_path)])
    assert r.exit_code == 0, r.output
    assert (tmp_path / "DIM_SECURITY.md").exists() and (tmp_path / "DIM_SECURITY.json").exists()
    r = CliRunner().invoke(app, ["all", "--repo", str(FIX), "--out", str(tmp_path / "all")])
    assert r.exit_code == 0, r.output
    assert (tmp_path / "all" / "scd2_rules.xlsx").exists() and (tmp_path / "all" / "open_questions.md").exists()
    assert "DIM_IP_RELATIONSHIP" in r.output and "TRUNCATE_APPEND_HIST" in r.output and "FACT_POS" not in r.output


def test_db_command_without_credentials_is_offline(monkeypatch):
    for v in ("PBDW_DSN", "PBDW_USER", "PBDW_PASSWORD"):
        monkeypatch.delenv(v, raising=False)
    r = CliRunner().invoke(app, ["db", "--table", "DIM_ACCOUNT", "--repo", str(FIX)])
    assert r.exit_code == 0 and "{}" in r.output
