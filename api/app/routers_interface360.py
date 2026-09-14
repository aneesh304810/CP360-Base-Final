"""Interface 360 router — interfaces, systems, routing paths, facets, stats."""
from __future__ import annotations
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/interface360", tags=["interface360"])


def _in_clause(col: str, csv: str, prefix: str, params: dict) -> str:
    """Build 'col IN (:p0,:p1,...)' from a comma-separated multi-select value."""
    vals = [v for v in (csv or "").split(",") if v != ""]
    binds = []
    for i, v in enumerate(vals):
        params[f"{prefix}{i}"] = v
        binds.append(f":{prefix}{i}")
    return f"{col} IN ({','.join(binds)})"


@router.get("/interfaces")
def interfaces(source_system: str | None = None,
               target_system: str | None = None,
               source_project_id: str | None = None,
               target_project_id: str | None = None,
               feed_type: str | None = None,
               direction: str | None = None,
               migration_flag: str | None = None,
               carries_pii: str | None = None,
               q: str | None = None,
               limit: int = 100, offset: int = 0):
    where, params = ["1=1"], {}
    # multi-select filters arrive as comma-separated lists -> IN (...)
    if source_system:
        where.append(_in_clause("source_system", source_system, "ss", params))
    if target_system:
        where.append(_in_clause("target_system", target_system, "ts", params))
    if source_project_id:
        where.append(_in_clause("source_project_id", source_project_id, "sp", params))
    if target_project_id:
        where.append(_in_clause("target_project_id", target_project_id, "tp", params))
    if feed_type:
        where.append(_in_clause("feed_type", feed_type, "ft", params))
    # single-select filters
    if direction:
        where.append("direction = :dir"); params["dir"] = direction
    if migration_flag:
        where.append("migration_flag = :mig"); params["mig"] = migration_flag
    if carries_pii:
        where.append("carries_pii = :pii"); params["pii"] = carries_pii
    if q and q.strip():
        # server-side search across the FULL table (not just the fetched page)
        params["q"] = f"%{q.strip().upper()}%"
        where.append("""(UPPER(source_system)     LIKE :q
                      OR UPPER(target_system)     LIKE :q
                      OR UPPER(integration_name)  LIKE :q
                      OR UPPER(application)       LIKE :q
                      OR UPPER(update_owner)      LIKE :q
                      OR UPPER(feed_type)         LIKE :q
                      OR UPPER(domain)            LIKE :q)""")
    where_sql = ' AND '.join(where)
    total = query(f"SELECT COUNT(*) AS n FROM interface360_interfaces WHERE {where_sql}",
                  dict(params))
    params.update({"lim": limit, "off": offset})
    return {"total": total[0]["n"] if total else 0,
            "interfaces": query(f"""
        SELECT interface_id, domain, application, integration_name, feed_type,
               source_system, source_project_id, target_system, target_project_id,
               direction, frequency, migration_flag, carries_pii, pii_categories,
               update_owner
        FROM interface360_interfaces WHERE {where_sql}
        ORDER BY application
        OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY""", params)}


@router.get("/systems")
def systems():
    return {"systems": query("""
        SELECT system_name, project_id, party, outbound_count, inbound_count,
               total_count, carries_pii
        FROM interface360_systems ORDER BY total_count DESC""")}


@router.get("/routing-paths")
def routing_paths(limit: int = 100):
    return {"hops": query("""
        SELECT interface_id, hop_order, system_name, project_id
        FROM interface360_routing_hops ORDER BY interface_id, hop_order
        FETCH FIRST :lim ROWS ONLY""", {"lim": limit})}


@router.get("/facets")
def facets():
    return {
        "source_system": query("""SELECT source_system AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   WHERE source_system IS NOT NULL
                                   GROUP BY source_system ORDER BY value"""),
        "target_system": query("""SELECT target_system AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   WHERE target_system IS NOT NULL
                                   GROUP BY target_system ORDER BY value"""),
        "feed_type": query("""SELECT feed_type AS value, COUNT(*) AS count
                              FROM interface360_interfaces
                              WHERE feed_type IS NOT NULL GROUP BY feed_type
                              ORDER BY count DESC"""),
        "source_project": query("""SELECT source_project_id AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   GROUP BY source_project_id"""),
        "target_project": query("""SELECT target_project_id AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   GROUP BY target_project_id"""),
    }


@router.get("/stats")
def stats():
    tot = query("SELECT COUNT(*) AS n FROM interface360_interfaces")
    sysn = query("SELECT COUNT(*) AS n FROM interface360_systems")
    pii = query("SELECT COUNT(*) AS n FROM interface360_interfaces WHERE carries_pii='Y'")
    mig = query("SELECT COUNT(*) AS n FROM interface360_interfaces WHERE migration_flag='Y'")
    cross = query("""SELECT COUNT(*) AS n FROM interface360_interfaces
                     WHERE source_project_id <> target_project_id""")
    return {
        "interfaces": tot[0]["n"] if tot else 0,
        "systems": sysn[0]["n"] if sysn else 0,
        "carry_pii": pii[0]["n"] if pii else 0,
        "migration": mig[0]["n"] if mig else 0,
        "cross_project": cross[0]["n"] if cross else 0,
    }
