"""Integration 360: what Airflow, dbt and the check engines report, kept as rows.

    POST /integration360/ingest/airflow      one task or run event (integration/airflow/i360_callbacks.py)
    POST /integration360/ingest/dbt          {run_results, manifest?, sources?, dag_id?, business_date?} (integration/dbt/i360_post_run.py)
    POST /integration360/ingest/check        one Great Expectations, Soda or loader check record, with bad_rows
    GET  /integration360/pipelines           per dag: the latest run, its failed tasks, its failing checks, a status
    GET  /integration360/history?days=31     per dag, per business date: the latest run, failed task, failing checks, bad rows, note
    GET  /integration360/search?q=           identifiers across runs, tasks and findings
    GET  /integration360/runs/{dag_id}       recent runs with their tasks
    GET  /integration360/findings/{dag_id}   checks for the dag (?business_date=, ?status=)
    GET  /integration360/badrows             a staging model's FAIL rows joined back to RAW by the loader's stamps
    POST /integration360/note                root cause and action against a finding
    GET  /integration360/health              what is configured

EVERY POSTING IS CHECKED: X-I360-Signature (HMAC sha256 with I360_WEBHOOK_SECRET)
or Authorization: Bearer I360_INGEST_TOKEN. With neither configured the
endpoints accept and say so in /health, for a first wiring in a test namespace.
Airflow and CP 360 share the OpenShift cluster: the callbacks post to the CP 360
API service by its in-cluster name; see docs/INTEGRATION_360_INGEST.md.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from .db import query, execute
from . import i360_ingest as I

log = logging.getLogger("cp.api.integration360")
router = APIRouter(prefix="/integration360", tags=["integration360"])


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("integration360 query failed: %s", str(e)[:160])
        return []


def _merge_run(run: dict):
    return ("MERGE INTO i360_run d USING (SELECT :run_key AS run_key FROM dual) s ON (d.run_key = s.run_key) "
            "WHEN MATCHED THEN UPDATE SET state = :state, business_date = COALESCE(:business_date, d.business_date), "
            "started_at = COALESCE(d.started_at, :started_at), ended_at = COALESCE(:ended_at, d.ended_at), received_at = SYSTIMESTAMP "
            "WHEN NOT MATCHED THEN INSERT (run_key, dag_id, run_id, business_date, state, source, started_at, ended_at) "
            "VALUES (:run_key, :dag_id, :run_id, :business_date, :state, :source, :started_at, :ended_at)", run)


def _merge_task(t: dict):
    return ("MERGE INTO i360_task d USING (SELECT :task_key AS task_key FROM dual) s ON (d.task_key = s.task_key) "
            "WHEN MATCHED THEN UPDATE SET state = :state, ended_at = COALESCE(:ended_at, d.ended_at), duration_s = COALESCE(:duration_s, d.duration_s), "
            "log_url = COALESCE(:log_url, d.log_url), error_code = COALESCE(:error_code, d.error_code), error_detail = COALESCE(:error_detail, d.error_detail), received_at = SYSTIMESTAMP "
            "WHEN NOT MATCHED THEN INSERT (task_key, run_key, dag_id, task_id, map_index, state, try_number, started_at, ended_at, duration_s, log_url, error_code, error_detail) "
            "VALUES (:task_key, :run_key, :dag_id, :task_id, :map_index, :state, :try_number, :started_at, :ended_at, :duration_s, :log_url, :error_code, :error_detail)", t)


def _merge_test(t: dict):
    return ("MERGE INTO i360_test d USING (SELECT :test_key AS test_key FROM dual) s ON (d.test_key = s.test_key) "
            "WHEN MATCHED THEN UPDATE SET status = :status, failures = :failures, total_rows = :total_rows, observed = :observed, message = :message, "
            "bad_rows_json = COALESCE(:bad_rows_json, d.bad_rows_json), received_at = SYSTIMESTAMP "
            "WHEN NOT MATCHED THEN INSERT (test_key, run_key, dag_id, business_date, rule_kind, node_id, model_name, test_name, column_name, status, failures, total_rows, "
            "expected, observed, threshold, message, severity, execution_s, bad_rows_json) "
            "VALUES (:test_key, :run_key, :dag_id, :business_date, :rule_kind, :node_id, :model_name, :test_name, :column_name, :status, :failures, :total_rows, "
            ":expected, :observed, :threshold, :message, :severity, :execution_s, :bad_rows_json)", t)


async def _accept(request: Request) -> dict:
    body = await request.body()
    v = I.verify(body, dict(request.headers))
    if v not in ("ok", "unsigned"):
        raise HTTPException(401, f"ingest refused: {v}")
    try:
        data = json.loads(body or b"{}")
    except ValueError as e:
        raise HTTPException(400, f"not JSON: {e}") from e
    if not isinstance(data, dict):
        raise HTTPException(400, "a JSON object is expected")
    data["_auth"] = v
    return data


@router.post("/ingest/airflow", status_code=202)
async def ingest_airflow(request: Request):
    data = await _accept(request)
    events = data.get("events") if isinstance(data.get("events"), list) else [data]
    stmts, n = [], 0
    for ev in events:
        try:
            rows = I.airflow_rows(ev)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        stmts.append(_merge_run(rows["run"]))
        if rows["task"]:
            stmts.append(_merge_task(rows["task"]))
        n += 1
    try:
        execute(stmts)
    except Exception as e:  # noqa: BLE001
        log.warning("integration360 airflow write failed: %s", str(e)[:200])
        raise HTTPException(503, "could not record the event") from e
    return {"accepted": n, "auth": data["_auth"]}


@router.post("/ingest/dbt", status_code=202)
async def ingest_dbt(request: Request):
    data = await _accept(request)
    try:
        rows = I.dbt_rows(data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    stmts = [_merge_run(rows["run"])] + [_merge_test(t) for t in rows["tests"]]
    try:
        execute(stmts)
    except Exception as e:  # noqa: BLE001
        log.warning("integration360 dbt write failed: %s", str(e)[:200])
        raise HTTPException(503, "could not record the run") from e
    return {"accepted": len(rows["tests"]), "run_key": rows["run"]["run_key"], "state": rows["run"]["state"], "auth": data["_auth"]}


@router.post("/ingest/check", status_code=202)
async def ingest_check(request: Request):
    data = await _accept(request)
    checks = data.get("checks") if isinstance(data.get("checks"), list) else [data]
    stmts, keys = [], []
    for c in checks:
        try:
            rows = I.check_rows(c)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        stmts.append(_merge_run(rows["run"]))
        stmts += [_merge_test(t) for t in rows["tests"]]
        keys += [t["test_key"] for t in rows["tests"]]
    try:
        execute(stmts)
    except Exception as e:  # noqa: BLE001
        log.warning("integration360 check write failed: %s", str(e)[:200])
        raise HTTPException(503, "could not record the check") from e
    return {"accepted": len(keys), "keys": keys, "auth": data["_auth"]}


def _recent(days: int):
    runs = _safe("SELECT run_key, dag_id, run_id, business_date, state, source, started_at, ended_at, received_at FROM i360_run "
                 "WHERE received_at >= SYSTIMESTAMP - :d ORDER BY received_at", {"d": days})
    if not runs:
        return [], [], []
    keys = [r["run_key"] for r in runs][-400:]
    tasks, tests = [], []
    for i in range(0, len(keys), 100):
        chunk = keys[i:i + 100]
        binds = {f"k{j}": k for j, k in enumerate(chunk)}
        ins = ", ".join(f":k{j}" for j in range(len(chunk)))
        tasks += _safe(f"SELECT task_key, run_key, dag_id, task_id, map_index, state, try_number, started_at, ended_at, duration_s, log_url, error_code, error_detail "
                       f"FROM i360_task WHERE run_key IN ({ins})", binds)
        tests += _safe(f"SELECT test_key, run_key, dag_id, business_date, rule_kind, node_id, model_name, test_name, column_name, status, failures, total_rows, "
                       f"expected, observed, threshold, message, severity FROM i360_test WHERE run_key IN ({ins})", binds)
    return runs, tasks, tests


@router.get("/pipelines")
def pipelines(days: int = Query(14, ge=1, le=120)):
    runs, tasks, tests = _recent(days)
    return {"dags": I.summarise(runs, tasks, tests), "runs": len(runs), "days": days}


@router.get("/history")
def history(days: int = Query(31, ge=1, le=400)):
    """Per dag, per business date: the latest run and what it carried, for the dashboard and the history tab."""
    runs, tasks, tests = _recent(days)
    notes = _safe("SELECT note_id, dag_id, finding_key, root_cause, action, author, created_at FROM i360_note WHERE created_at >= SYSTIMESTAMP - :d", {"d": days})
    return {"days": days, "dags": I.history(runs, tasks, tests, notes)}


@router.get("/search")
def search(q: str = Query(..., min_length=2, max_length=80), limit: int = Query(50, ge=1, le=200)):
    """Identifiers only: dag, task, error code, test, column, model, business date, run id. Nothing from logs."""
    like = f"%{q.strip().upper()}%"
    p = {"q": like, "n": limit}
    runs = _safe("SELECT run_key, dag_id, run_id, business_date, state FROM i360_run WHERE UPPER(dag_id) LIKE :q OR UPPER(run_id) LIKE :q OR business_date LIKE :q "
                 "ORDER BY received_at DESC FETCH FIRST :n ROWS ONLY", p)
    tasks = _safe("SELECT task_key, run_key, dag_id, task_id, state, error_code FROM i360_task WHERE UPPER(task_id) LIKE :q OR UPPER(error_code) LIKE :q "
                  "ORDER BY received_at DESC FETCH FIRST :n ROWS ONLY", p)
    tests = _safe("SELECT test_key, run_key, dag_id, business_date, rule_kind, model_name, test_name, column_name, status, failures FROM i360_test "
                  "WHERE UPPER(test_name) LIKE :q OR UPPER(column_name) LIKE :q OR UPPER(model_name) LIKE :q OR UPPER(node_id) LIKE :q "
                  "ORDER BY received_at DESC FETCH FIRST :n ROWS ONLY", p)
    return {"q": q, "runs": runs, "tasks": tasks, "findings": tests}


@router.get("/runs/{dag_id}")
def runs(dag_id: str, limit: int = Query(20, ge=1, le=200)):
    rs = _safe("SELECT run_key, dag_id, run_id, business_date, state, source, started_at, ended_at, received_at FROM i360_run "
               "WHERE dag_id = :d ORDER BY received_at DESC FETCH FIRST :n ROWS ONLY", {"d": dag_id, "n": limit})
    for r in rs:
        r["tasks"] = _safe("SELECT task_key, task_id, map_index, state, try_number, started_at, ended_at, duration_s, log_url, error_code, error_detail "
                           "FROM i360_task WHERE run_key = :k ORDER BY started_at", {"k": r["run_key"]})
    return {"dag_id": dag_id, "runs": rs}


@router.get("/findings/{dag_id}")
def findings(dag_id: str, business_date: str | None = None, status: str | None = None, limit: int = Query(200, ge=1, le=1000)):
    sql = ("SELECT test_key, run_key, business_date, rule_kind, node_id, model_name, test_name, column_name, status, failures, total_rows, expected, observed, "
           "threshold, message, severity, execution_s, received_at, bad_rows_json FROM i360_test WHERE dag_id = :d")
    p = {"d": dag_id, "n": limit}
    if business_date:
        sql += " AND business_date = :bd"; p["bd"] = business_date[:10]
    if status:
        sql += " AND status = :st"; p["st"] = status.lower()[:20]
    sql += " ORDER BY received_at DESC FETCH FIRST :n ROWS ONLY"
    rows = _safe(sql, p)
    for r in rows:
        bj = r.pop("bad_rows_json", None)
        try:
            r["bad_rows"] = json.loads(bj) if bj else []
        except ValueError:
            r["bad_rows"] = []
    notes = _safe("SELECT note_id, finding_key, root_cause, action, author, created_at FROM i360_note WHERE dag_id = :d ORDER BY created_at DESC", {"d": dag_id})
    return {"dag_id": dag_id, "findings": rows, "notes": notes}


@router.get("/badrows")
def badrows(stg: str, raw: str, business_date: str, cols: str = "", limit: int = Query(50, ge=1, le=200)):
    """The FAIL rows of a staging model for a date, joined back to the RAW table on FILE_REGISTRY_ID and FILE_ROW_NUMBER.
    Needs the staging model to carry both stamps. Identifiers are allowlisted."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", business_date or ""):
        raise HTTPException(400, "business_date must be YYYY-MM-DD")
    try:
        rows_sql, count_sql = I.bad_rows_sql(stg, raw, [c for c in cols.split(",") if c.strip()], limit)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    rows = _safe(rows_sql, {"bd": business_date})
    counts = _safe(count_sql, {"bd": business_date})
    c = counts[0] if counts else {"total_rows": None, "bad_rows": None}
    return {"stg": stg.upper(), "raw": raw.upper(), "business_date": business_date, "total_rows": c.get("total_rows"), "bad_rows": c.get("bad_rows"), "rows": rows}


class Note(BaseModel):
    dag_id: str
    finding_key: str | None = None
    root_cause: str = ""
    action: str = ""
    author: str = ""


@router.post("/note")
def note(n: Note):
    nid = uuid.uuid4().hex[:32]
    try:
        execute([("INSERT INTO i360_note (note_id, dag_id, finding_key, root_cause, action, author) VALUES (:id, :d, :f, :rc, :a, :au)",
                  {"id": nid, "d": n.dag_id[:200], "f": (n.finding_key or "")[:400] or None, "rc": n.root_cause[:2000], "a": n.action[:2000], "au": n.author[:100]})])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, "could not save the note") from e
    return {"note_id": nid}


@router.get("/health")
def health():
    return {"ok": True, "signature": bool(os.environ.get("I360_WEBHOOK_SECRET", "").strip()), "token": bool(os.environ.get("I360_INGEST_TOKEN", "").strip()),
            "tables": bool(_safe("SELECT 1 AS ok FROM i360_run FETCH FIRST 1 ROWS ONLY") or _safe("SELECT COUNT(*) AS n FROM i360_run"))}
