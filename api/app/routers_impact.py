"""Impact Analysis router — schema drift findings + blast radius.

Read paths follow the catalog convention (degrade to [] on missing tables).
Two write paths are deliberate exceptions to the read-only rule:
  POST /impact/findings/{id}/status   ack / resolve / suppress workflow
  POST /impact/scan                   on-demand scan (reuses the ingestion
                                      scanner's diff logic inline)
Both write only to impact tables (drift_findings / schema_snapshot*), never
to harvested catalog tables.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from .db import query, get_pool

log = logging.getLogger("cp.api.impact")
router = APIRouter(prefix="/impact", tags=["impact"])

_SEV_ORDER = {"HIGH": 0, "MED": 1, "LOW": 2}


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("impact query failed: %s", str(e)[:160])
        return []


def _clob(v):
    if v is None:
        return None
    try:
        return v.read() if hasattr(v, "read") else str(v)
    except Exception:  # noqa: BLE001
        return None


def _exec(sql, params=None):
    with get_pool().acquire() as conn:
        cur = conn.cursor()
        cur.execute(sql, params or {})
        conn.commit()
        cur.close()


# ---------------------------------------------------------------- findings
@router.get("/stats")
def stats():
    rows = _safe("SELECT severity, status FROM drift_findings")
    open_ = [r for r in rows if (r.get("status") or "NEW") in ("NEW", "ACK")]
    return {
        "total": len(rows),
        "open": len(open_),
        "high": sum(1 for r in open_ if r.get("severity") == "HIGH"),
        "med": sum(1 for r in open_ if r.get("severity") == "MED"),
        "low": sum(1 for r in open_ if r.get("severity") == "LOW"),
        "suppressed": sum(1 for r in rows if r.get("status") == "SUPPRESSED"),
        "resolved": sum(1 for r in rows if r.get("status") == "RESOLVED"),
    }


@router.get("/findings")
def findings(status: str | None = None, limit: int = 200):
    rows = _safe(
        """SELECT finding_id, scan_id, severity, source_kind, drift_kind,
                  object_key, was_value, now_value, detail, downstream_feeds,
                  downstream_systems, owners, status, evidence_tag,
                  TO_CHAR(found_at, 'YYYY-MM-DD HH24:MI') AS found_at
             FROM drift_findings
            ORDER BY found_at DESC FETCH FIRST :lim ROWS ONLY""",
        {"lim": max(1, min(limit, 1000))})
    if status:
        allowed = {s.strip().upper() for s in status.split(",")}
        rows = [r for r in rows if (r.get("status") or "NEW") in allowed]
    for r in rows:
        r["detail"] = _clob(r.get("detail"))
        r["downstream_systems"] = [s for s in (r.get("downstream_systems") or "").split(",") if s]
        r["owners"] = [s for s in (r.get("owners") or "").split(",") if s]
    rows.sort(key=lambda r: (_SEV_ORDER.get(r.get("severity"), 9), r.get("found_at") or ""))
    return {"findings": rows}


class StatusBody(BaseModel):
    status: str  # NEW | ACK | RESOLVED | SUPPRESSED


@router.post("/findings/{finding_id}/status")
def set_status(finding_id: str, body: StatusBody):
    st = body.status.upper()
    if st not in ("NEW", "ACK", "RESOLVED", "SUPPRESSED"):
        return {"ok": False, "error": f"bad status {st}"}
    try:
        _exec(
            """UPDATE drift_findings
                  SET status = :st,
                      resolved_at = CASE WHEN :st = 'RESOLVED'
                                         THEN SYSTIMESTAMP ELSE resolved_at END
                WHERE finding_id = :fid""",
            {"st": st, "fid": finding_id})
        return {"ok": True, "finding_id": finding_id, "status": st}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:200]}


# -------------------------------------------------------------------- scan
@router.post("/scan")
def scan():
    """On-demand scan. Imports the ingestion scanner so the diff logic lives
    in exactly one place; requires the ingestion package on PYTHONPATH
    (true in the combined local/dev image). Returns a clear hint when the
    API container is deployed without it."""
    try:
        from ingestion.impact_scan_conn import ImpactScanner  # type: ignore
    except Exception:
        return {"ok": False, "queued": False,
                "hint": "ingestion package not present in API container — "
                        "run `python -m ingestion.run --steps impact_scan` "
                        "or wait for the scheduled CronJob"}

    class _LoaderShim:
        """Minimal Loader over the API pool connection."""
        def __init__(self, conn):
            self.conn = conn

        def commit(self):
            self.conn.commit()

        def _merge(self, table, pk, values, protect=()):
            cols = list(values.keys())
            sel = ", ".join(f":{c} AS {c}" for c in cols)
            on = " AND ".join(f"t.{k} = s.{k}" for k in pk)
            upd_cols = [c for c in cols if c not in pk and c not in protect]
            ins = ", ".join(cols)
            insv = ", ".join(f"s.{c}" for c in cols)
            if upd_cols:
                upd = ", ".join(f"t.{c} = s.{c}" for c in upd_cols)
                sql = (f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
                       f"ON ({on}) WHEN MATCHED THEN UPDATE SET {upd} "
                       f"WHEN NOT MATCHED THEN INSERT ({ins}) VALUES ({insv})")
            else:
                sql = (f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
                       f"ON ({on}) WHEN NOT MATCHED THEN INSERT ({ins}) "
                       f"VALUES ({insv})")
            cur = self.conn.cursor()
            cur.execute(sql, values)
            cur.close()

    try:
        with get_pool().acquire() as conn:
            scanner = ImpactScanner.from_env(conn)
            n = scanner.load(_LoaderShim(conn))
        return {"ok": True, "findings": n}
    except Exception as e:  # noqa: BLE001
        log.exception("on-demand scan failed")
        return {"ok": False, "error": str(e)[:200]}


@router.get("/scan/sources")
def scan_sources():
    """Run-bar chips: last snapshot per source."""
    rows = _safe(
        """SELECT source_kind,
                  MAX(taken_at) AS taken_at,
                  MAX(col_count) KEEP (DENSE_RANK LAST ORDER BY taken_at) AS col_count
             FROM schema_snapshots GROUP BY source_kind""")
    return {"sources": [
        {"source": r["source_kind"],
         "taken_at": str(r["taken_at"])[:16] if r.get("taken_at") else None,
         "col_count": r.get("col_count")} for r in rows]}


# ------------------------------------------------------------ blast radius
@router.get("/blast")
def blast(column: str, max_depth: int = 4):
    """column -> mappings -> tables -> feeds -> systems -> owners.
    `column` is SCHEMA.TABLE.COLUMN. Walks column_lineage transitively
    (depth-limited), then joins feeds/systems the same way the scanner does."""
    col = (column or "").strip()
    if not col:
        return {"error": "column required"}

    seen: set[str] = set()
    frontier = [col.upper()]
    mappings: list[str] = []
    for _ in range(max(1, min(max_depth, 6))):
        if not frontier:
            break
        nxt: list[str] = []
        for f in frontier:
            for r in _safe(
                    """SELECT to_column FROM column_lineage
                        WHERE UPPER(from_column) = :f
                        FETCH FIRST 100 ROWS ONLY""", {"f": f}):
                t = (r.get("to_column") or "").upper()
                if t and t not in seen:
                    seen.add(t)
                    nxt.append(t)
                    mappings.append(r["to_column"])
        frontier = nxt

    tables = sorted({m.rsplit(".", 1)[0] for m in mappings if "." in m})
    feeds: list[str] = []
    systems: list[str] = []
    for tab in tables:
        for r in _safe(
                """SELECT feed_name, target_system FROM feed_catalog
                    WHERE UPPER(schema_ref) LIKE '%' || UPPER(:t) || '%'
                    FETCH FIRST 20 ROWS ONLY""",
                {"t": tab.rsplit(".", 1)[-1]}):
            if r.get("feed_name") and r["feed_name"] not in feeds:
                feeds.append(r["feed_name"])
            if r.get("target_system") and r["target_system"] not in systems:
                systems.append(r["target_system"])

    owners: list[str] = []
    if systems:
        binds = {f"s{i}": s for i, s in enumerate(systems[:10])}
        in_list = ",".join(f":s{i}" for i in range(len(binds)))
        for r in _safe(
                f"""SELECT DISTINCT update_owner FROM interface360_interfaces
                     WHERE source_system IN ({in_list})
                        OR target_system IN ({in_list})""", binds):
            if r.get("update_owner") and r["update_owner"] not in owners:
                owners.append(r["update_owner"])

    return {"column": col, "mappings": mappings[:50], "tables": tables[:50],
            "feeds": feeds[:50], "systems": systems[:20], "owners": owners[:20]}


@router.get("/blast/columns")
def blast_columns(q: str | None = None, limit: int = 25):
    """Autocomplete for the blast picker: columns that HAVE downstream lineage."""
    like = f"%{(q or '').upper()}%"
    rows = _safe(
        """SELECT DISTINCT from_column FROM column_lineage
            WHERE UPPER(from_column) LIKE :q
            ORDER BY from_column FETCH FIRST :lim ROWS ONLY""",
        {"q": like, "lim": max(1, min(limit, 100))})
    return {"columns": [r["from_column"] for r in rows]}
