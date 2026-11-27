"""Integration 360 ingest: the pure part. Turns what Airflow, dbt and the check
engines post into rows for i360_run, i360_task and i360_test, and verifies the
posting is ours. No database, no network: routers_integration360.py does the
writing, the tests drive this directly.

Airflow posts one event per task state change and per run (the callbacks in
integration/airflow/i360_callbacks.py). dbt posts run_results.json with
manifest.json and sources.json after each run (integration/dbt/i360_post_run.py).
Great Expectations, Soda or any other check posts one record per check.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
from datetime import datetime

MAX_BAD_ROWS = 50
MAX_BAD_JSON = 20000
IDENT = re.compile(r"^[A-Za-z][A-Za-z0-9_$#]{0,127}$")


def verify(body: bytes, headers: dict) -> str:
    """'ok' when the posting carries our secret, 'unsigned' when no secret is configured,
    or the reason it is refused. Two ways in: the HMAC header X-I360-Signature
    (sha256=<hex> over the body, keyed with I360_WEBHOOK_SECRET) or Authorization:
    Bearer <I360_INGEST_TOKEN>."""
    secret = os.environ.get("I360_WEBHOOK_SECRET", "").strip()
    token = os.environ.get("I360_INGEST_TOKEN", "").strip()
    h = {str(k).lower(): v for k, v in (headers or {}).items()}
    if token and h.get("authorization", "") == f"Bearer {token}":
        return "ok"
    if secret:
        sig = h.get("x-i360-signature", "")
        want = "sha256=" + hmac.new(secret.encode(), body or b"", hashlib.sha256).hexdigest()
        if sig and hmac.compare_digest(sig, want):
            return "ok"
        return "bad signature" if sig else "missing signature"
    if token:
        return "missing token"
    return "unsigned"


def _ts(v):
    """An ISO timestamp from Airflow or dbt as a naive datetime, or None."""
    if not v:
        return None
    s = str(v).strip().replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(s)
        return d.replace(tzinfo=None) if d.tzinfo else d
    except ValueError:
        return None


def _bd(v):
    """A business date as YYYY-MM-DD from YYYY-MM-DD, YYYYMMDD or a timestamp; else None."""
    s = str(v or "").strip()
    m = re.match(r"^(\d{4})-?(\d{2})-?(\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def _clip(s, n):
    s = "" if s is None else str(s)
    return s if len(s) <= n else s[: n - 1] + "…"


LOADER_CODES = ("FILE_NOT_FOUND", "FILE_EMPTY", "HEADER_REQUIRED", "HEADER_COUNT_MISMATCH", "HEADER_COLUMN_MISMATCH", "TRAILER_MISSING",
                "TRAILER_COUNT_INVALID", "TRAILER_COUNT_MISMATCH", "ZERO_ROWS_NOT_ALLOWED", "RAW_COUNT_MISMATCH", "RAW_LOAD_FAILED",
                "ARCHIVE_FAILED", "QUARANTINE_MOVE_FAILED")


def error_code(text: str) -> str:
    """The loader's error code when the task's error line carries one."""
    s = str(text or "")
    for c in LOADER_CODES:
        if c in s:
            return c
    return ""


def airflow_rows(ev: dict) -> dict:
    """{'run': row | None, 'task': row | None} from one Airflow event."""
    dag = str(ev.get("dag_id") or "").strip()
    run_id = str(ev.get("run_id") or ev.get("dag_run_id") or "").strip()
    if not dag or not run_id:
        raise ValueError("dag_id and run_id are required")
    run_key = f"{dag}:{run_id}"[:200]
    bd = _bd(ev.get("business_date") or (ev.get("conf") or {}).get("business_date") or ev.get("logical_date") or ev.get("execution_date"))
    kind = str(ev.get("kind") or ("task" if ev.get("task_id") else "run")).lower()
    run = {"run_key": run_key, "dag_id": dag[:200], "run_id": run_id[:200], "business_date": bd,
           "state": _clip((ev.get("run_state") or ev.get("state") if kind == "run" else ev.get("run_state")) or "running", 20).lower(),
           "source": "airflow", "started_at": _ts(ev.get("run_start_date") or (ev.get("start_date") if kind == "run" else None)),
           "ended_at": _ts(ev.get("run_end_date") or (ev.get("end_date") if kind == "run" else None))}
    task = None
    if kind == "task":
        tid = str(ev.get("task_id") or "").strip()
        if not tid:
            raise ValueError("task_id is required for a task event")
        try_no = int(ev.get("try_number") or 1)
        mi = ev.get("map_index")
        err = _clip(ev.get("error") or ev.get("exception") or "", 2000)
        st, en = _ts(ev.get("start_date")), _ts(ev.get("end_date"))
        dur = ev.get("duration")
        if dur is None and st and en:
            dur = (en - st).total_seconds()
        task = {"task_key": f"{run_key}:{tid}:{try_no}" + (f":{mi}" if mi not in (None, -1, "") else ""), "run_key": run_key, "dag_id": dag[:200],
                "task_id": tid[:200], "map_index": int(mi) if mi not in (None, "") else None, "state": _clip(ev.get("state") or "", 20).lower(),
                "try_number": try_no, "started_at": st, "ended_at": en, "duration_s": float(dur) if dur is not None else None,
                "log_url": _clip(ev.get("log_url") or "", 1000), "error_code": error_code(err) or _clip(ev.get("error_code") or "", 100),
                "error_detail": err}
        task["task_key"] = task["task_key"][:300]
    return {"run": run, "task": task}


def _dbt_node(manifest: dict | None, uid: str) -> dict:
    nodes = (manifest or {}).get("nodes") or {}
    n = nodes.get(uid) or ((manifest or {}).get("sources") or {}).get(uid) or {}
    return n if isinstance(n, dict) else {}


def _attached_model(manifest: dict | None, node: dict) -> str:
    att = node.get("attached_node")
    if att:
        return str(att).split(".")[-1]
    deps = ((node.get("depends_on") or {}).get("nodes") or [])
    for d in deps:
        if str(d).startswith("model.") or str(d).startswith("source."):
            return str(d).split(".")[-1]
    return str(node.get("name") or "")


def dbt_rows(payload: dict) -> dict:
    """{'run': row, 'tests': [rows]} from run_results.json (+ manifest.json, + sources.json)."""
    rr = payload.get("run_results") or {}
    manifest = payload.get("manifest")
    sources = payload.get("sources") or {}
    meta = rr.get("metadata") or {}
    inv = str(payload.get("run_id") or meta.get("invocation_id") or "").strip()
    dag = str(payload.get("dag_id") or "dbt").strip()
    if not inv:
        raise ValueError("run_results.metadata.invocation_id (or run_id) is required")
    run_key = f"{dag}:{inv}"[:200]
    bd = _bd(payload.get("business_date") or ((rr.get("args") or {}).get("vars") or {}).get("business_date"))
    results = rr.get("results") or []
    states = [str(r.get("status") or "") for r in results]
    state = "failed" if any(s in ("fail", "error") for s in states) else ("success" if results else "running")
    run = {"run_key": run_key, "dag_id": dag[:200], "run_id": inv[:200], "business_date": bd, "state": state, "source": "dbt",
           "started_at": _ts(meta.get("generated_at")) if not results else min([_ts(((r.get("timing") or [{}])[0] or {}).get("started_at")) or _ts(meta.get("generated_at")) for r in results] or [None]),
           "ended_at": _ts(meta.get("generated_at"))}
    tests = []
    for r in results:
        uid = str(r.get("unique_id") or "")
        node = _dbt_node(manifest, uid)
        rtype = str(node.get("resource_type") or uid.split(".")[0] or "")
        kind = "dbt_test" if rtype == "test" else "dbt_model"
        tm = node.get("test_metadata") or {}
        name = str(tm.get("name") or node.get("name") or uid.split(".")[-1])
        col = str(node.get("column_name") or (tm.get("kwargs") or {}).get("column_name") or "") or None
        model = _attached_model(manifest, node) if rtype == "test" else str(node.get("name") or uid.split(".")[-1])
        status = str(r.get("status") or "").lower()
        failures = r.get("failures")
        exp = ""
        if rtype == "test" and tm:
            kw = {k: v for k, v in (tm.get("kwargs") or {}).items() if k not in ("model", "column_name")}
            exp = f"{name}({col or model}{', ' + json.dumps(kw, default=str)[:200] if kw else ''})"
        tests.append({"test_key": f"{run_key}:{uid}"[:400], "run_key": run_key, "dag_id": dag[:200], "business_date": bd, "rule_kind": kind,
                      "node_id": uid[:400], "model_name": _clip(model, 200), "test_name": _clip(name, 400), "column_name": _clip(col, 200) if col else None,
                      "status": _clip(status, 20), "failures": int(failures) if isinstance(failures, (int, float)) else None, "total_rows": None,
                      "expected": _clip(exp, 400), "observed": _clip(f"{failures} failing rows" if failures else "", 400), "threshold": "0" if rtype == "test" else "",
                      "message": _clip(r.get("message") or "", 2000), "severity": _clip(((node.get("config") or {}).get("severity") or ""), 10).lower(),
                      "execution_s": float(r.get("execution_time")) if r.get("execution_time") is not None else None, "bad_rows_json": None})
    for r in (sources.get("results") or []):
        uid = str(r.get("unique_id") or "")
        crit = r.get("criteria") or {}
        err = crit.get("error_after") or {}
        warn = crit.get("warn_after") or {}
        thr = f"error after {err.get('count')} {err.get('period')}" if err.get("count") else (f"warn after {warn.get('count')} {warn.get('period')}" if warn.get("count") else "")
        tests.append({"test_key": f"{run_key}:{uid}:freshness"[:400], "run_key": run_key, "dag_id": dag[:200], "business_date": bd, "rule_kind": "dbt_freshness",
                      "node_id": uid[:400], "model_name": _clip(uid.split(".")[-1], 200), "test_name": "freshness", "column_name": _clip(r.get("loaded_at_field") or "", 200) or None,
                      "status": _clip(str(r.get("status") or "").lower(), 20), "failures": None, "total_rows": None,
                      "expected": _clip(f"max loaded within {thr}" if thr else "fresh", 400),
                      "observed": _clip(f"max_loaded_at {r.get('max_loaded_at')}, age {round(float(r.get('age') or 0) / 3600, 1)} h" if r.get("max_loaded_at") else "no rows", 400),
                      "threshold": _clip(thr, 200), "message": "", "severity": "", "execution_s": None, "bad_rows_json": None})
    return {"run": run, "tests": tests}


def check_rows(payload: dict) -> dict:
    """{'run': row, 'tests': [row]} from one Great Expectations, Soda or loader check record."""
    engine = str(payload.get("engine") or "check").strip().lower().replace(" ", "_")
    dag = str(payload.get("dag_id") or "").strip()
    run_id = str(payload.get("run_id") or "").strip()
    if not dag or not run_id:
        raise ValueError("dag_id and run_id are required")
    run_key = f"{dag}:{run_id}"[:200]
    bd = _bd(payload.get("business_date"))
    status = str(payload.get("status") or "").lower()
    rows = payload.get("bad_rows") or []
    if not isinstance(rows, list):
        rows = []
    rows = rows[:MAX_BAD_ROWS]
    bad_json = json.dumps(rows, default=str)
    if len(bad_json) > MAX_BAD_JSON:
        bad_json = json.dumps(rows[: max(1, len(rows) // 2)], default=str)[:MAX_BAD_JSON]
    cid = str(payload.get("check_id") or f"{payload.get('dataset') or ''}:{payload.get('rule') or ''}:{payload.get('column') or ''}")
    run = {"run_key": run_key, "dag_id": dag[:200], "run_id": run_id[:200], "business_date": bd,
           "state": "failed" if status in ("fail", "failed", "error") else "success", "source": "check", "started_at": _ts(payload.get("run_ts")), "ended_at": _ts(payload.get("run_ts"))}
    test = {"test_key": f"{run_key}:{cid}"[:400], "run_key": run_key, "dag_id": dag[:200], "business_date": bd, "rule_kind": _clip(engine, 30),
            "node_id": _clip(cid, 400), "model_name": _clip(payload.get("dataset") or "", 200), "test_name": _clip(payload.get("rule") or "", 400),
            "column_name": _clip(payload.get("column") or "", 200) or None, "status": _clip(status, 20),
            "failures": int(payload["failures"]) if isinstance(payload.get("failures"), (int, float)) else None,
            "total_rows": int(payload["total"]) if isinstance(payload.get("total"), (int, float)) else None,
            "expected": _clip(payload.get("expected") or "", 400), "observed": _clip(payload.get("observed") or "", 400), "threshold": _clip(payload.get("threshold") or "", 200),
            "message": _clip(payload.get("message") or "", 2000), "severity": _clip(payload.get("severity") or "", 10).lower(), "execution_s": None,
            "bad_rows_json": bad_json if rows else None}
    return {"run": run, "tests": [test]}


def ident(name: str) -> str:
    """An Oracle identifier we are willing to put in SQL, or ValueError."""
    s = str(name or "").strip()
    if not IDENT.match(s):
        raise ValueError(f"not an identifier: {s[:40]}")
    return s.upper()


def bad_rows_sql(stg: str, raw: str, cols: list[str], limit: int = 50) -> tuple[str, str]:
    """The query for a staging model's FAIL rows joined back to the RAW table on the loader's stamps,
    and the count query. Identifiers are allowlisted, never interpolated from free text."""
    s, r = ident(stg), ident(raw)
    cl = [ident(c) for c in cols][:12]
    sel = ", ".join(f"r.{c}" for c in cl)
    rows = (f"SELECT r.FILE_ROW_NUMBER AS file_row_number, r.FILE_REGISTRY_ID AS file_registry_id, s.DQ_FAIL_REASON_CDS AS reason{', ' + sel if sel else ''} "
            f"FROM {s} s JOIN {r} r ON r.FILE_REGISTRY_ID = s.FILE_REGISTRY_ID AND r.FILE_ROW_NUMBER = s.FILE_ROW_NUMBER "
            f"WHERE s.DQ_STATUS_CD = 'FAIL' AND s.BUSINESS_DATE = TO_DATE(:bd, 'YYYY-MM-DD') ORDER BY r.FILE_ROW_NUMBER FETCH FIRST {int(limit)} ROWS ONLY")
    count = (f"SELECT (SELECT COUNT(*) FROM {r} WHERE BUSINESS_DATE = TO_DATE(:bd, 'YYYY-MM-DD')) AS total_rows, "
             f"(SELECT COUNT(*) FROM {s} WHERE DQ_STATUS_CD = 'FAIL' AND BUSINESS_DATE = TO_DATE(:bd, 'YYYY-MM-DD')) AS bad_rows FROM dual")
    return rows, count


def summarise(runs: list[dict], tasks: list[dict], tests: list[dict]) -> dict:
    """Per dag: the latest run, its failed tasks, its failing checks, and a status word."""
    out = {}
    latest = {}
    for r in sorted(runs, key=lambda x: (x.get("received_at") or datetime.min, x.get("started_at") or datetime.min)):
        latest[r["dag_id"]] = r
    for dag, r in latest.items():
        rk = r["run_key"]
        ft = [t for t in tasks if t.get("run_key") == rk and str(t.get("state")) in ("failed", "upstream_failed", "up_for_retry")]
        bad = [t for t in tests if (t.get("run_key") == rk or (r.get("business_date") and t.get("business_date") == r.get("business_date") and t.get("dag_id") == dag))
               and str(t.get("status")) in ("fail", "failed", "error")]
        warn = [t for t in tests if t.get("run_key") == rk and str(t.get("status")) == "warn"]
        status = "red" if r.get("state") == "failed" or ft or bad else ("amber" if warn or r.get("state") in ("running", "queued") else "green")
        out[dag] = {"run": r, "failed_tasks": sorted(ft, key=lambda t: t.get("started_at") or datetime.min),
                    "failing": bad, "warnings": warn, "status": status,
                    "tasks_total": len([t for t in tasks if t.get("run_key") == rk]), "tests_total": len([t for t in tests if t.get("run_key") == rk])}
    return out
