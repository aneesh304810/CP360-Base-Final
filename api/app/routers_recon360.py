"""routers_recon360.py — Recon 360 parallel-run reconciliation API."""
from __future__ import annotations

import threading

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/recon", tags=["recon360"])


def _cat():
    from ingestion.variance_engine import _catalog
    return _catalog()


def _safe(sql, binds=None):
    try:
        conn = _cat()
        cur = conn.cursor()
        cur.execute(sql, binds or {})
        cols = [c[0].lower() for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception as e:                                  # noqa: BLE001
        return [{"_error": str(e)[:200]}] if "_error" else []


@router.get("/sources")
def sources():
    rows = _safe("""SELECT name, role, schemas, last_test_ok
                    FROM cp_datasources ORDER BY name""")
    return {"a": [r for r in rows if r.get("role") in
                  ("SYSTEM_OF_RECORD", "PROFILING")],
            "b": [r for r in rows if r.get("role") in
                  ("UNDER_TEST", "PROFILING")],
            "all": rows}


class ScanIn(BaseModel):
    side_a: str
    side_b: str
    tables: str | None = None      # comma separated; None = all common
    depth: str = "ROWHASH"


@router.post("/scan")
def scan(body: ScanIn):
    from ingestion.parallel_recon import run
    import datetime as dt
    run_id = f"PR{dt.datetime.now():%Y%m%d_%H%M%S}"
    t = threading.Thread(
        target=run,
        kwargs=dict(side_a=body.side_a, side_b=body.side_b,
                    tables=(body.tables.split(",") if body.tables else None),
                    depth=body.depth, run_id=run_id),
        daemon=True)
    t.start()
    return {"run_id": run_id, "status": "RUNNING"}


@router.get("/runs")
def runs():
    return {"runs": _safe("""SELECT * FROM (
        SELECT run_id, side_a, side_b, depth, status, step, tables_total,
               tables_done, match_rate,
               TO_CHAR(started_at,'YYYY-MM-DD HH24:MI') AS started_at,
               error_text
        FROM recon_pr_runs ORDER BY started_at DESC)
        WHERE ROWNUM <= 30""")}


@router.get("/run/{run_id}")
def run_status(run_id: str):
    rows = _safe("""SELECT run_id, status, step, tables_total, tables_done,
                           match_rate, error_text
                    FROM recon_pr_runs WHERE run_id = :r""", {"r": run_id})
    return rows[0] if rows else {"status": "UNKNOWN"}


def _latest(run_id):
    if run_id:
        return run_id
    rows = _safe("""SELECT run_id FROM recon_pr_runs
                    WHERE status IN ('COMPLETE','RUNNING')
                    ORDER BY started_at DESC FETCH FIRST 1 ROWS ONLY""")
    return rows[0]["run_id"] if rows else None


@router.get("/summary")
def summary(run_id: str | None = None):
    rid = _latest(run_id)
    if not rid:
        return {"run": None, "tables": [], "schema_drift": 0}
    run = _safe("""SELECT run_id, side_a, side_b, schema_a, schema_b, depth,
                          status, step, tables_total, tables_done, match_rate,
                          TO_CHAR(started_at,'YYYY-MM-DD HH24:MI') AS started_at
                   FROM recon_pr_runs WHERE run_id = :r""", {"r": rid})
    tables = _safe("""SELECT table_name, pk_cols, cnt_a, cnt_b,
                             cols_compared, metric_breaks, missing_b,
                             extra_b, mismatch, status, note
                      FROM recon_pr_table WHERE run_id = :r
                      ORDER BY CASE status WHEN 'RED' THEN 0
                               WHEN 'AMBER' THEN 1 ELSE 2 END,
                               (missing_b + extra_b + mismatch) DESC,
                               table_name""", {"r": rid})
    drift = _safe("""SELECT COUNT(*) AS n FROM recon_pr_schema
                     WHERE run_id = :r""", {"r": rid})
    return {"run": run[0] if run else None, "tables": tables,
            "schema_drift": drift[0]["n"] if drift else 0}


@router.get("/schema")
def schema(run_id: str | None = None):
    rid = _latest(run_id)
    return {"drifts": _safe("""SELECT table_name, drift_type, column_name,
                                      a_def, b_def, severity
                               FROM recon_pr_schema WHERE run_id = :r
                               ORDER BY CASE severity WHEN 'FIX_FIRST'
                                        THEN 0 ELSE 1 END, table_name""",
                            {"r": rid}) if rid else []}


@router.get("/breaks")
def breaks(table: str, run_id: str | None = None):
    rid = _latest(run_id)
    if not rid:
        return {"breaks": [], "signature": []}
    rows = _safe("""SELECT break_type, pk_value, cols_differ, a_values,
                           b_values
                    FROM recon_pr_break
                    WHERE run_id = :r AND UPPER(table_name) = UPPER(:t)
                      AND ROWNUM <= 200""", {"r": rid, "t": table})
    sig = _safe("""SELECT cols_differ, COUNT(*) AS n
                   FROM recon_pr_break
                   WHERE run_id = :r AND UPPER(table_name) = UPPER(:t)
                     AND break_type = 'MISMATCH' AND cols_differ IS NOT NULL
                   GROUP BY cols_differ ORDER BY n DESC
                   FETCH FIRST 6 ROWS ONLY""", {"r": rid, "t": table})
    return {"breaks": rows, "signature": sig}


@router.get("/config")
def get_config():
    return {"rules": _safe("""SELECT scope, rule_type, column_name,
                                     rule_value, note
                              FROM recon_pr_config ORDER BY scope""")}


class RuleIn(BaseModel):
    scope: str = "GLOBAL"
    rule_type: str
    column_name: str | None = None
    rule_value: str | None = None
    note: str | None = None


@router.post("/config")
def add_rule(body: RuleIn):
    try:
        conn = _cat()
        cur = conn.cursor()
        cur.execute("""INSERT INTO recon_pr_config
            (scope, rule_type, column_name, rule_value, note)
            VALUES (:1, :2, :3, :4, :5)""",
            [body.scope.upper(), body.rule_type, body.column_name,
             body.rule_value, body.note])
        conn.commit()
        return {"ok": True}
    except Exception as e:                                  # noqa: BLE001
        return {"ok": False, "error": str(e)[:200]}
