"""SCD2 rule cards -> scd2_* tables, for the ODI 360 screen.

One step runs everything the three SCD2 tools do and lands the result
where a screen can read it:

    1. the column scan (tools/scd2_scan) over a column inventory, which
       writes scd2_pbdw.csv into the ODI export folder when it is absent;
    2. scd2lens over the ODI export, one rule card per SCD2 table, with the
       runtime profile added when CP_SCD2_WITH_DB=1 and PBDW_* are set;
    3. the cards merged into scd2_card / scd2_rule / scd2_mapping /
       scd2_open_question / scd2_dup_month / scd2_column_role (sql/81).

Every child row carries the card's RAN_AT, and the API reads children at
the card's RAN_AT only, so a rerun that produces fewer rules does not leave
a stale rule beside the fresh ones.

    $env:CP_ODI_DIR="local-data/odi_export"      # the export, never committed
    $env:CP_SCD2_COLUMNS_CSV="local-data/pbdw_columns.csv"   # optional; without it and with PBDW_*
                                                            # set, the inventory is read from ALL_TAB_COLUMNS
    $env:CP_SCD2_WITH_DB="1"; $env:PBDW_DSN=...; $env:PBDW_USER=...; $env:PBDW_PASSWORD=...
    python -m ingestion.run scd2

Nothing in the export or the warehouse is read as a value: the cards hold
column names, rule text, counts and dates. The top-keys list scd2lens
prints on a console is not stored.
"""
from __future__ import annotations

import datetime as _dt
import json
import logging
import os
import sys

log = logging.getLogger("cp.scd2")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LENS = os.path.join(ROOT, "tools", "scd2lens")
DEFAULT_ODI_DIR = "local-data/odi_export"


def _s(x, n=4000):
    if x is None:
        return None
    s = str(x)
    return s[:n]


class Scd2Connector:
    def __init__(self, odi_dir: str, with_db: bool = False, columns_csv: str | None = None,
                 schema: str = "PBDWAPP", tables: list[str] | None = None, out_dir: str | None = None):
        self.odi_dir = odi_dir
        self.with_db = with_db
        self.columns_csv = columns_csv
        self.schema = schema
        self.tables = tables
        self.out_dir = out_dir

    @classmethod
    def from_env(cls):
        t = os.environ.get("CP_SCD2_TABLES", "").strip()
        return cls(os.environ.get("CP_ODI_DIR") or DEFAULT_ODI_DIR,
                   with_db=os.environ.get("CP_SCD2_WITH_DB", "0").strip().lower() in ("1", "true", "yes"),
                   columns_csv=os.environ.get("CP_SCD2_COLUMNS_CSV") or None,
                   schema=os.environ.get("CP_SCD2_SCHEMA") or "PBDWAPP",
                   tables=[x.strip().upper() for x in t.split(",") if x.strip()] or None,
                   out_dir=os.environ.get("CP_SCD2_OUT") or None)

    # ---- 1. the scan ----------------------------------------------------
    def ensure_scan(self) -> list[dict]:
        """scd2_pbdw.csv in the export folder: written from the columns CSV when absent."""
        target = os.path.join(self.odi_dir, "scd2_pbdw.csv")
        if os.path.exists(target):
            import csv
            with open(target, newline="", encoding="utf-8-sig") as f:
                return list(csv.DictReader(f))
        sys.path.insert(0, ROOT)
        from tools.scd2_scan import read_csv, report
        tables = None
        if self.columns_csv and os.path.exists(self.columns_csv):
            tables = read_csv(self.columns_csv)
            log.info("scd2: column inventory from %s (%s tables)", self.columns_csv, len(tables))
        elif self.columns_csv:
            log.warning("scd2: CP_SCD2_COLUMNS_CSV=%s does not exist", self.columns_csv)
        if tables is None:
            tables = self.columns_from_warehouse()
        if tables is None:
            log.warning("scd2: no scd2_pbdw.csv in %s, no column CSV and no PBDW_* credentials — the scan is skipped; "
                        "only tables named CP_SCD2_TABLES are carded", self.odi_dir)
            return []
        os.makedirs(self.odi_dir, exist_ok=True)
        rows = report(tables, target)
        log.info("scd2: scan wrote %s rows to %s", len(rows), target)
        return rows

    def columns_from_warehouse(self, runner=None):
        """The column inventory straight from ALL_TAB_COLUMNS of the warehouse schema, read-only.

        Used when no CSV is given and PBDW_DSN / PBDW_USER / PBDW_PASSWORD are set.
        Metadata only: table, column, type, nullable.
        """
        if LENS not in sys.path:
            sys.path.insert(0, LENS)
        from scd2lens.config import Credentials
        if runner is None:
            if Credentials.from_env() is None:
                return None
            from scd2lens.db import conn as dbc
            runner = dbc.Runner(dbc.connect())
        from scd2lens.db.ident import ident
        rows = runner("SELECT table_name AS t, column_name AS c, data_type AS ty, nullable AS n FROM all_tab_columns "
                      "WHERE owner = :o ORDER BY table_name, column_id", {"o": ident(self.schema)})
        out = {}
        for r in rows:
            out.setdefault(r["t"], []).append({"column": r["c"], "type": r["ty"], "nullable": r["n"]})
        log.info("scd2: column inventory from the warehouse: %s tables in %s", len(out), self.schema)
        return out

    # ---- 2. the cards ------------------------------------------------------
    def parse(self) -> dict:
        if LENS not in sys.path:
            sys.path.insert(0, LENS)
        from scd2lens.config import Settings
        from scd2lens.ingest.loader import load_export
        from scd2lens.rules.engine import build_card
        scan_rows = self.ensure_scan()
        settings = Settings(schema=self.schema)
        settings.odi_dir = self.odi_dir
        ex = load_export(self.odi_dir)
        if self.tables:
            tables = self.tables
        else:
            df = ex.scd2_pbdw
            # SCD2 and SCD2 (probable). A "(weak)" verdict is one lone date column; it stays in the
            # scan CSV but is not worth a card unless named in CP_SCD2_TABLES.
            v = df["verdict"].str.upper()
            tables = sorted(df[v.str.startswith("SCD2") & ~v.str.contains("WEAK")]["table"].str.upper().unique())
        ran_at = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0)
        cards = []
        for t in tables:
            card = build_card(ex, t, settings)
            if self.with_db:
                try:
                    from scd2lens.cli import _runtime
                    rt = _runtime(settings, t, card, "all")
                    skipped = rt.pop("skipped", []) if rt else []
                    if rt:
                        card = build_card(ex, t, settings, runtime=rt)
                    for s_ in skipped:
                        card.notes.append(s_)
                        log.info("scd2: %s %s", t, s_)
                except Exception as e:  # noqa: BLE001 — one table's profile must not stop the run
                    card.notes.append(f"db profile failed: {str(e).splitlines()[0][:160]}")
                    log.warning("scd2: %s profile failed: %s", t, str(e).splitlines()[0][:160])
            cards.append(card)
            log.info("scd2: %s %s rules=%s open=%s", t, card.pattern, len(card.rules), len(card.open_questions))
        if self.out_dir:
            from scd2lens.report.json_ import render_json
            from scd2lens.report.markdown import render_markdown
            os.makedirs(self.out_dir, exist_ok=True)
            for c in cards:
                with open(os.path.join(self.out_dir, f"{c.table}.md"), "w", encoding="utf-8") as f:
                    f.write(render_markdown(c))
                with open(os.path.join(self.out_dir, f"{c.table}.json"), "w", encoding="utf-8") as f:
                    f.write(render_json(c))
        return {"cards": cards, "scan_rows": scan_rows, "ran_at": ran_at, "export_missing": list(ex.missing)}

    # ---- 3. the load ---------------------------------------------------------
    def load(self, loader, bundle: dict) -> int:
        ran_at = bundle["ran_at"]
        n = 0
        for c in bundle["cards"]:
            q = c.quality
            loader._merge("scd2_card", ("table_name",), {
                "table_name": c.table, "pattern": c.pattern, "scan_verdict": c.scan_verdict,
                "writers": _s(", ".join(c.writers), 2000), "surrogate_key": c.surrogate_key,
                "natural_key": _s(", ".join(c.natural_key), 400), "version_key": _s(", ".join(c.version_key), 400),
                "partition_col": c.partition.column if c.partition else None,
                "partition_values": _s(json.dumps(c.partition.values), 2000) if c.partition else None,
                "row_count": q.rows, "dup_rows": q.dup_rows, "dup_pct": q.dup_pct, "dup_keys": q.dup_keys,
                "gaps": q.gaps, "overlaps": q.overlaps, "multiple_open": q.multiple_open, "none_open": q.none_open,
                "active_open_not_flagged": q.active_ind_open_not_flagged, "active_closed_but_flagged": q.active_ind_closed_but_flagged,
                "freshness_alert": _s(q.freshness_alert, 400), "volume_alerts": _s("; ".join(q.volume_alerts), 2000),
                "rule_count": len(c.rules), "proven_count": sum(1 for r in c.rules if r.confidence == "PROVEN"),
                "inferred_count": sum(1 for r in c.rules if r.confidence == "INFERRED"),
                "unknown_count": sum(1 for r in c.rules if r.confidence == "UNKNOWN_TRUNCATED"),
                "open_count": len(c.open_questions), "notes": _s(" | ".join(c.notes)), "ran_at": ran_at,
            })
            n += 1
            for r in c.rules:
                loader._merge("scd2_rule", ("table_name", "rule_id"), {
                    "table_name": c.table, "rule_id": r.id, "rule_text": _s(r.text), "confidence": r.confidence,
                    "evidence": _s(r.evidence), "ran_at": ran_at})
                n += 1
            for k, v in c.catalog_mapping.items():
                loader._merge("scd2_mapping", ("table_name", "pbdw_column"), {
                    "table_name": c.table, "pbdw_column": k, "data360_attr": _s(v, 200), "ran_at": ran_at})
                n += 1
            for i, qn in enumerate(c.open_questions, start=1):
                loader._merge("scd2_open_question", ("table_name", "seq"), {
                    "table_name": c.table, "seq": i, "question": _s(qn, 2000), "ran_at": ran_at})
                n += 1
            for m in q.dup_by_month:
                loader._merge("scd2_dup_month", ("table_name", "month"), {
                    "table_name": c.table, "month": _s(m.get("month"), 7), "versions": m.get("versions"),
                    "dup_rows": m.get("dup_rows"), "ran_at": ran_at})
                n += 1
        roles = ["surrogate_key", "valid_from", "valid_to", "current_flag", "version", "row_hash", "business_date", "audit"]
        for row in bundle.get("scan_rows") or []:
            t = (row.get("table") or "").upper()
            if not t:
                continue
            loader._merge("scd2_column_role", ("table_name",), {
                "table_name": t, "verdict": _s(row.get("verdict"), 40), "confidence": _s(row.get("confidence"), 20),
                **{("audit_col" if r == "audit" else r): _s(row.get(r), 128) for r in roles},
                "to_convention": _s(row.get("to_convention"), 200), "missing_roles": _s(row.get("missing_for_full_scd2"), 400),
                "maps_to": _s(row.get("maps_to"), 2000), "notes": _s(row.get("notes"), 2000), "ran_at": ran_at})
            n += 1
        loader.commit()
        return n
