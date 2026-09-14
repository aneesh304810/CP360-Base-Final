"""Quality Guardrails router — failed / at-risk jobs with drill-down to bad data."""
from __future__ import annotations
import logging
from fastapi import APIRouter
from .db import query

log = logging.getLogger("cp.api.guardrails")
router = APIRouter(prefix="/guardrails", tags=["guardrails"])

_SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("guardrails query failed: %s", str(e)[:160])
        return []


def _clob(v):
    if v is None:
        return None
    try:
        return v.read() if hasattr(v, "read") else str(v)
    except Exception:  # noqa: BLE001
        return None


@router.get("/stats")
def stats():
    rows = _safe("SELECT status, severity, engine FROM guardrail_events")
    attn = [r for r in rows if (r.get("status") or "") != "passed"]
    return {
        "total": len(rows),
        "attention": len(attn),
        "failed": sum(1 for r in attn if r.get("status") == "failed"),
        "warning": sum(1 for r in attn if r.get("status") == "warning"),
        "critical": sum(1 for r in attn if r.get("severity") == "critical"),
        "by_engine": _count(attn, "engine"),
    }


def _count(rows, field):
    out = {}
    for r in rows:
        k = r.get(field) or "unknown"
        out[k] = out.get(k, 0) + 1
    return out


@router.get("/attention")
def attention(engine: str | None = None):
    rows = _safe("""
        SELECT event_id, engine, event_type, status, severity, pipeline_id,
               dag_id, task_id, dataset_key, rule_name, message, run_ts
        FROM guardrail_events
        WHERE status <> 'passed'
    """)
    if engine:
        rows = [r for r in rows if r.get("engine") == engine]
    rows.sort(key=lambda r: (_SEV_ORDER.get(r.get("severity"), 9),
                             0 if r.get("status") == "failed" else 1))
    return {"events": rows}


@router.get("/event/{event_id}")
def event(event_id: str):
    rows = _safe("""
        SELECT event_id, engine, event_type, status, severity, pipeline_id,
               dag_id, task_id, dataset_key, model_key, column_name, rule_name,
               expectation, observed_value, threshold, bad_row_count, total_row_count,
               message, root_cause, upstream_source, run_id, run_ts
        FROM guardrail_events WHERE event_id = :id
    """, {"id": event_id})
    return rows[0] if rows else {}


@router.get("/event/{event_id}/bad-data")
def bad_data(event_id: str):
    rows = _safe("SELECT bad_data_sample, bad_row_count, total_row_count, rule_name "
                 "FROM guardrail_events WHERE event_id = :id", {"id": event_id})
    if not rows:
        return {"sample": [], "bad_row_count": 0}
    r = rows[0]
    import json
    sample_raw = _clob(r.get("bad_data_sample"))
    try:
        sample = json.loads(sample_raw) if sample_raw else []
    except Exception:  # noqa: BLE001
        sample = []
    return {
        "sample": sample,
        "bad_row_count": r.get("bad_row_count"),
        "total_row_count": r.get("total_row_count"),
        "rule_name": r.get("rule_name"),
    }
