"""scd2lens — odi | db | key | card | all."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import typer

from .config import Credentials, Settings
from .ingest.loader import load_export
from .report.json_ import render_json
from .report.markdown import render_markdown
from .report.xlsx import write_xlsx
from .rules.engine import build_card

app = typer.Typer(add_completion=False, help=__doc__)


def _settings(config: str | None, repo: str | None) -> Settings:
    s = Settings.load(config)
    if repo:
        s.odi_dir = Path(repo)
    return s


def _runtime(settings: Settings, table: str, card, checks: str, top_n: int = 10) -> dict:
    """Open the read-only session and run the profile for one table."""
    from .db import conn as dbc
    from .db.columns import tracked_columns
    from .db.profile import dup_checks, flag_check, freshness, volume_drop, window_checks
    creds = Credentials.from_env()
    if creds is None:
        typer.echo("no PBDW_DSN / PBDW_USER / PBDW_PASSWORD in the environment — offline mode", err=True)
        return {}
    run = dbc.Runner(dbc.connect(creds))
    nk = card.natural_key or ["ACCOUNT_NUMBER"]
    part = [card.partition.column] if card.partition else []
    want = {c.strip() for c in checks.split(",")} if checks != "all" else {"dup", "windows", "flag", "freshness"}
    out: dict = {}
    if "dup" in want:
        tracked = tracked_columns(run, settings.schema_name, table, settings, card.surrogate_key)
        out.update(dup_checks(run, settings, table, nk, part, tracked, top_n))
        out["volume_alerts"] = volume_drop(out.get("dup_by_month") or [])
    if "windows" in want:
        out.update(window_checks(run, settings, table, nk, part, offset_days=1))
    if "flag" in want:
        out["active_ind"] = flag_check(run, settings, table)
    if "freshness" in want:
        out["freshness"] = freshness(run, settings, table)
    return out


@app.command()
def odi(table: str = typer.Option(..., "--table"), repo: str = typer.Option(None, "--repo"), config: str = typer.Option(None, "--config")):
    """Static evidence only: the card from the ODI export."""
    s = _settings(config, repo)
    card = build_card(load_export(s.odi_dir), table, s)
    typer.echo(render_markdown(card))


@app.command()
def db(table: str = typer.Option(..., "--table"), checks: str = typer.Option("all", "--checks"),
       repo: str = typer.Option(None, "--repo"), config: str = typer.Option(None, "--config"), since: str = typer.Option(None, "--since")):
    """Runtime evidence: profile the table through the read-only session."""
    s = _settings(config, repo)
    if since:
        s.db_sample_since = since
    card = build_card(load_export(s.odi_dir), table, s)
    rt = _runtime(s, table, card, checks)
    typer.echo(json.dumps({k: v for k, v in rt.items() if k != "top_keys"}, indent=2, default=str))
    if rt.get("top_keys"):
        typer.echo("top keys by versions (console only):")
        for r in rt["top_keys"]:
            typer.echo(f"  {r.get('key_value')}: {r.get('versions')} versions, {r.get('dup_rows')} duplicates")


@app.command()
def key(table: str = typer.Option(..., "--table"), key: str = typer.Option(..., "--key"),
        repo: str = typer.Option(None, "--repo"), config: str = typer.Option(None, "--config")):
    """One key's change history, diffed in Python."""
    from .db import conn as dbc
    from .db.columns import tracked_columns
    from .db.keydiff import key_history
    s = _settings(config, repo)
    card = build_card(load_export(s.odi_dir), table, s)
    creds = Credentials.from_env()
    if creds is None:
        typer.echo("set PBDW_DSN, PBDW_USER and PBDW_PASSWORD", err=True); raise typer.Exit(2)
    run = dbc.Runner(dbc.connect(creds))
    tracked = [c["column_name"] for c in tracked_columns(run, s.schema_name, table, s, card.surrogate_key)]
    nk = (card.natural_key or ["ACCOUNT_NUMBER"])[0]
    h = key_history(run, s, table, nk, card.surrogate_key or "ROWID", key, tracked)
    typer.echo(f"{table} key {h.key}: {h.rows} rows, {h.real_versions} real versions, {h.duplicates} duplicates")
    for d, cols in h.changes:
        typer.echo(f"  {d}: {len(cols)} column(s) — {', '.join(cols[:12])}{' …' if len(cols) > 12 else ''}")


@app.command()
def card(table: str = typer.Option(..., "--table"), out: str = typer.Option("./out", "--out"),
         repo: str = typer.Option(None, "--repo"), config: str = typer.Option(None, "--config"), with_db: bool = typer.Option(False, "--with-db")):
    """Write the rule card (md + json) for one table."""
    s = _settings(config, repo)
    ex = load_export(s.odi_dir)
    c = build_card(ex, table, s)
    if with_db:
        c = build_card(ex, table, s, runtime=_runtime(s, table, c, "all"))
    o = Path(out); o.mkdir(parents=True, exist_ok=True)
    (o / f"{c.table}.md").write_text(render_markdown(c))
    (o / f"{c.table}.json").write_text(render_json(c))
    typer.echo(f"wrote {o / (c.table + '.md')} and .json")


@app.command(name="all")
def all_(out: str = typer.Option("./out", "--out"), repo: str = typer.Option(None, "--repo"), config: str = typer.Option(None, "--config"),
         with_db: bool = typer.Option(False, "--with-db")):
    """Every table whose column-scan verdict starts with SCD2."""
    s = _settings(config, repo)
    ex = load_export(s.odi_dir)
    df = ex.scd2_pbdw
    tables = sorted(df[df["verdict"].str.upper().str.startswith("SCD2")]["table"].str.upper().unique()) if isinstance(s.tables, str) else [t.upper() for t in s.tables]
    cards = []
    o = Path(out); o.mkdir(parents=True, exist_ok=True)
    for t in tables:
        c = build_card(ex, t, s)
        if with_db:
            try:
                c = build_card(ex, t, s, runtime=_runtime(s, t, c, "all"))
            except Exception as e:  # one table's failure must not stop the run
                c.notes.append(f"db profile failed: {str(e).splitlines()[0][:160]}")
        (o / f"{c.table}.md").write_text(render_markdown(c))
        (o / f"{c.table}.json").write_text(render_json(c))
        cards.append(c)
        typer.echo(f"{c.table:<32} {c.pattern:<22} rules={len(c.rules)} open={len(c.open_questions)}")
    write_xlsx(cards, o / "scd2_rules.xlsx")
    (o / "open_questions.md").write_text("# Open questions\n\n" + "\n".join(f"- **{c.table}** — {q}" for c in cards for q in c.open_questions) + "\n")
    typer.echo(f"wrote {len(cards)} cards, scd2_rules.xlsx and open_questions.md to {o}")


if __name__ == "__main__":
    sys.exit(app())
