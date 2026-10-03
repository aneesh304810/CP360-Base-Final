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
def stats(region: str | None = None):
    rows = _safe("SELECT status, severity, engine, NVL(region, 'PROD') AS region "
                 "FROM guardrail_events")
    if not rows:                       # pre-67 database, as in /attention
        rows = _safe("SELECT status, severity, engine FROM guardrail_events")
        for r in rows:
            r["region"] = "PROD"
    rg = _region(region)
    if rg:
        rows = [r for r in rows if (r.get("region") or "PROD") == rg]
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
def attention(engine: str | None = None, region: str | None = None):
    # NVL, not a bare column: sql/67 added region with a default, but a row
    # written before it ran has NULL there and would vanish from a filtered
    # list -- which on this screen reads as "nothing is wrong".
    rows = _safe("""
        SELECT event_id, engine, event_type, status, severity, pipeline_id,
               dag_id, task_id, dataset_key, rule_name, message, run_ts,
               NVL(region, 'PROD') AS region, release_id
        FROM guardrail_events
        WHERE status <> 'passed'
    """)
    if not rows:
        # Pre-67 database: the columns above do not exist yet, so the whole
        # statement failed. Fall back rather than report an empty estate.
        rows = _safe("""
            SELECT event_id, engine, event_type, status, severity, pipeline_id,
                   dag_id, task_id, dataset_key, rule_name, message, run_ts
            FROM guardrail_events WHERE status <> 'passed'""")
        for r in rows:
            r["region"] = "PROD"
    if engine:
        rows = [r for r in rows if r.get("engine") == engine]
    rg = _region(region)
    if rg:
        rows = [r for r in rows if (r.get("region") or "PROD") == rg]
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


# ===================================================================
# The promotion plane — SIT -> UAT -> PROD
# ===================================================================
# A SEPARATE GRAIN, NOT A FILTER. A gate run belongs to a commit; a
# guardrail event belongs to a run on a business date. sql/67's header
# argues this out. These endpoints serve the first; everything above
# serves the second.

_REGIONS = ("SIT", "UAT", "PROD")
# A release is only as healthy as its worst BLOCKING gate. A failing gate
# that does not block is a report, and counting it as a stop teaches
# people that red means nothing.
_BAD = ("failed",)


def _region(v, default=None):
    v = (v or "").strip().upper()
    return v if v in _REGIONS else default


@router.get("/promotion")
def promotion():
    """Every release candidate, and how far each one has got.

    Shaped for the board: one row per release, gates folded into a
    per-region summary, so the screen can draw three lanes without
    counting 80 rows itself and arriving at a different answer.
    """
    rels = _safe("""SELECT release_id, title, branch, commit_sha, pr_number,
        build_number, author, current_region, status, models_changed,
        datasets, opened_at, project_id
        FROM guardrail_release ORDER BY opened_at DESC""")
    runs = _safe("""SELECT gate_run_id, release_id, region, stage, stage_order,
        gate_key, gate_name, status, severity, blocking, observed_value,
        threshold, message, duration_ms
        FROM guardrail_gate_run""")

    by_rel: dict[str, list] = {}
    for g in runs:
        by_rel.setdefault(g.get("release_id"), []).append(g)

    out = []
    for r in rels:
        mine = by_rel.get(r.get("release_id"), [])
        regions = {}
        for rg in ("SIT", "UAT"):
            g = [x for x in mine if (x.get("region") or "") == rg]
            blocking_fail = [x for x in g
                             if x.get("status") in _BAD and x.get("blocking") == "Y"]
            regions[rg] = {
                "total": len(g),
                "passed": sum(1 for x in g if x.get("status") == "passed"),
                "failed": sum(1 for x in g if x.get("status") == "failed"),
                "warning": sum(1 for x in g if x.get("status") == "warning"),
                "running": sum(1 for x in g if x.get("status") == "running"),
                "not_run": sum(1 for x in g if x.get("status") == "not_run"),
                "blocking_failures": len(blocking_fail),
                # The gate to name on the card. Not "3 failed" — which one.
                "blocker": (blocking_fail[0].get("gate_name")
                            if blocking_fail else None),
                "blocker_key": (blocking_fail[0].get("gate_key")
                                if blocking_fail else None),
                "state": ("blocked" if blocking_fail else
                          "running" if any(x.get("status") == "running" for x in g) else
                          "pending" if g and all(x.get("status") == "not_run" for x in g) else
                          "passed" if g else "none"),
            }
        out.append({**r, "regions": regions, "gate_count": len(mine)})

    return {"releases": out, "count": len(out),
            # Said once, by the API, so every surface tells the reader the
            # same thing about where this came from.
            "synthetic": True,
            "source": "ingestion/guardrails_promotion_synth.py"}


@router.get("/release/{release_id}")
def release_detail(release_id: str):
    """One release: every gate in every region, in pipeline order."""
    head = _safe("""SELECT release_id, title, branch, commit_sha, pr_number,
        build_number, author, current_region, status, models_changed,
        datasets, opened_at FROM guardrail_release WHERE release_id = :r""",
        {"r": release_id})
    gates = _safe("""SELECT gate_run_id, region, stage, stage_order, gate_key,
        gate_name, status, severity, blocking, expectation, observed_value,
        threshold, message, root_cause, evidence, log_url, duration_ms
        FROM guardrail_gate_run WHERE release_id = :r
        ORDER BY region DESC, stage_order, gate_name""", {"r": release_id})
    for g in gates:
        g["evidence"] = _clob(g.get("evidence"))
    return {"release": (head[0] if head else None), "gates": gates,
            "synthetic": True}


@router.get("/regions")
def regions():
    """What each region is for, and how it is doing right now.

    The three are not the same shape and the screen must not draw them as
    if they were: SIT and UAT run GATES against a commit, PROD runs
    RUNTIME guardrails against a business date. PROD has no gates at all,
    and showing it an empty gate list would read as a gap.
    """
    gate_rows = _safe("""SELECT region, status, blocking
        FROM guardrail_gate_run""")
    ev = _safe("""SELECT NVL(region, 'PROD') AS region, status, severity
        FROM guardrail_events""")

    def gates_for(rg):
        g = [x for x in gate_rows if (x.get("region") or "") == rg]
        return {"gates": len(g),
                "failed": sum(1 for x in g if x.get("status") == "failed"),
                "blocking_failures": sum(1 for x in g if x.get("status") in _BAD
                                         and x.get("blocking") == "Y"),
                "running": sum(1 for x in g if x.get("status") == "running")}

    def events_for(rg):
        e = [x for x in ev if (x.get("region") or "PROD") == rg
             and (x.get("status") or "") != "passed"]
        return {"events": len(e),
                "critical": sum(1 for x in e if x.get("severity") == "critical")}

    return {"regions": [
        {"region": "SIT", "kind": "gates", "trigger": "every push",
         "runs": "Jenkins on the pull request",
         "covers": "governance, tests, security, and the performance checks "
                   "that need no data volume",
         **gates_for("SIT"), **events_for("SIT")},
        {"region": "UAT", "kind": "gates", "trigger": "on promotion",
         "runs": "Jenkins on the release candidate",
         "covers": "SLA at realistic volumes, the business test pack, sign-off",
         **gates_for("UAT"), **events_for("UAT")},
        {"region": "PROD", "kind": "runtime", "trigger": "every scheduled run",
         "runs": "Great Expectations, Soda, dbt tests, Airflow",
         "covers": "data quality on the business date — no gates run here",
         "gates": 0, "failed": 0, "blocking_failures": 0, "running": 0,
         **events_for("PROD")},
    ], "synthetic": True}
