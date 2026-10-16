"""ODI 360 · SCD2 — the rule cards the scd2 ingestion wrote.

Three reads, all from the scd2_* tables of sql/81. Every child row is read
at the card's RAN_AT, so a rerun that produced fewer rules does not show a
stale rule beside the fresh ones. Column names, rule text, counts and
dates only: no key value from the warehouse is stored, so none can be
returned.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter

from .db import query

log = logging.getLogger("cp.scd2")
router = APIRouter(prefix="/scd2", tags=["scd2"])

PATTERN_ORDER = ["MERGE_SCD2", "TRUNCATE_APPEND_HIST", "SNAPSHOT", "SCD1", "SCD2_UNVERIFIED", "UNKNOWN"]


def _safe(sql, params=None):
    """query(), but an absent table (sql/81 not run yet) is an empty list, not a 500."""
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("scd2 query failed: %s", str(e).splitlines()[0][:160])
        return []


@router.get("/cards")
def cards():
    rows = _safe("""SELECT table_name, pattern, scan_verdict, writers, surrogate_key, natural_key, version_key,
                           partition_col, partition_values, row_count, dup_rows, dup_pct, dup_keys, gaps, overlaps,
                           multiple_open, none_open, active_open_not_flagged, active_closed_but_flagged,
                           freshness_alert, volume_alerts, rule_count, proven_count, inferred_count, unknown_count,
                           open_count, notes, ran_at
                    FROM   scd2_card ORDER BY table_name""")
    rv = {x["table_name"]: x for x in _safe("""SELECT table_name, SUM(CASE WHEN confirmed = 'Y' THEN 1 ELSE 0 END) AS confirmed,
                                                       SUM(CASE WHEN confirmed = 'N' THEN 1 ELSE 0 END) AS rejected
                                                FROM scd2_rule_review GROUP BY table_name""")}
    for r in rows:
        try:
            r["partition_values"] = json.loads(r["partition_values"]) if r.get("partition_values") else None
        except Exception:  # noqa: BLE001
            pass
        v = rv.get(r["table_name"]) or {}
        r["confirmed_count"], r["rejected_count"] = v.get("confirmed") or 0, v.get("rejected") or 0
    return {"cards": rows, "loaded": bool(rows), "count": len(rows)}


@router.get("/summary")
def summary():
    rows = _safe("SELECT pattern, COUNT(*) AS n FROM scd2_card GROUP BY pattern")
    by_pattern = {r["pattern"]: int(r["n"]) for r in rows}
    conf = (_safe("""SELECT SUM(proven_count) AS proven, SUM(inferred_count) AS inferred, SUM(unknown_count) AS unknown,
                            SUM(open_count) AS open_questions, COUNT(*) AS tables_,
                            SUM(CASE WHEN row_count IS NOT NULL THEN 1 ELSE 0 END) AS profiled,
                            SUM(CASE WHEN freshness_alert IS NOT NULL THEN 1 ELSE 0 END) AS stale,
                            MAX(ran_at) AS last_run
                     FROM   scd2_card""") or [{}])[0]
    rv = (_safe("""SELECT SUM(CASE WHEN confirmed = 'Y' THEN 1 ELSE 0 END) AS confirmed,
                          SUM(CASE WHEN confirmed = 'N' THEN 1 ELSE 0 END) AS rejected,
                          COUNT(DISTINCT reviewer) AS reviewers FROM scd2_rule_review""") or [{}])[0]
    return {"review": {"confirmed": rv.get("confirmed") or 0, "rejected": rv.get("rejected") or 0, "reviewers": rv.get("reviewers") or 0},
            "by_pattern": [{"pattern": p, "n": by_pattern.get(p, 0)} for p in PATTERN_ORDER if by_pattern.get(p)],
            "confidence": {"proven": conf.get("proven") or 0, "inferred": conf.get("inferred") or 0, "unknown": conf.get("unknown") or 0},
            "tables": conf.get("tables_") or 0, "profiled": conf.get("profiled") or 0, "stale": conf.get("stale") or 0,
            "open_questions": conf.get("open_questions") or 0, "last_run": conf.get("last_run"),
            "loaded": bool(rows)}


@router.get("/card/{table}")
def card(table: str):
    t = table.upper()
    head = _safe("SELECT * FROM scd2_card WHERE table_name = :t", {"t": t})
    if not head:
        return {"table": t, "loaded": False}
    c = head[0]
    ra = c.get("ran_at")
    try:
        c["partition_values"] = json.loads(c["partition_values"]) if c.get("partition_values") else None
    except Exception:  # noqa: BLE001
        pass
    at = " AND ran_at = :ra" if ra else ""
    p = {"t": t, **({"ra": ra} if ra else {})}
    return {
        "table": t, "loaded": True, "card": c,
        "rules": _safe(f"""SELECT r.rule_id, r.rule_text, r.confidence, r.evidence,
                                  v.business_meaning, v.confirmed, v.reviewer, v.reviewer_note, v.reviewed_at,
                                  CASE WHEN v.rule_text_seen IS NOT NULL AND v.rule_text_seen <> r.rule_text THEN 'Y' ELSE 'N' END AS rule_changed_since
                           FROM   scd2_rule r
                           LEFT JOIN scd2_rule_review v ON v.table_name = r.table_name AND v.rule_id = r.rule_id
                           WHERE  r.table_name = :t{at.replace('ran_at', 'r.ran_at')}
                           ORDER BY TO_NUMBER(REGEXP_SUBSTR(r.rule_id, '[0-9]+'))""", p)
                 or _safe(f"SELECT rule_id, rule_text, confidence, evidence FROM scd2_rule WHERE table_name = :t{at} "
                          "ORDER BY TO_NUMBER(REGEXP_SUBSTR(rule_id, '[0-9]+'))", p),
        "mapping": _safe(f"SELECT pbdw_column, data360_attr FROM scd2_mapping WHERE table_name = :t{at} ORDER BY pbdw_column", p),
        "open_questions": _safe(f"SELECT seq, question FROM scd2_open_question WHERE table_name = :t{at} ORDER BY seq", p),
        "dup_by_month": _safe(f"SELECT month, versions, dup_rows FROM scd2_dup_month WHERE table_name = :t{at} ORDER BY month", p),
        "column_roles": (_safe("SELECT * FROM scd2_column_role WHERE table_name = :t", {"t": t}) or [None])[0],
    }
