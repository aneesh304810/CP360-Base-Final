# ============================================================
# FastAPI route: GET /api/interface360/interfaces
#
# Exact-match facet filtering for Interface 360.
# - Multi-select facets arrive as CSV (e.g. source_system=Bloomberg,Bloomberg AIM)
#   and are split into an IN (...) clause with individual bind variables.
# - Exact equality only ("AddVantage" will NOT match "AddVantage - API").
# - TRIM() guards against trailing-space dirt from Excel ingestion
#   (the "#REF!" facet entry suggests the source sheet has artifacts).
# - Free-text fuzzy search stays exclusively on the `q` param.
#
# Adapt the two marked spots to your codebase:
#   1) `get_connection` -> your existing oracledb/SQLAlchemy helper
#   2) table/column names if they differ from cp_interfaces
# ============================================================

from fastapi import APIRouter, Query

from ..db import get_connection  # (1) your existing Oracle connection helper

router = APIRouter(prefix="/api/interface360")

# Facet query-param name -> DB column. Add entries here and the filter
# works end-to-end with zero further code changes (frontend is generic too).
FACET_COLUMNS = {
    "source_system": "source_system",
    "target_system": "target_system",
    "feed_type": "feed_type",
    "direction": "direction",
    "source_project_id": "source_project_id",
    "target_project_id": "target_project_id",
    "migration": "migration_flag",
    "pii_status": "carries_pii",
}

SELECT_COLS = """
    interface_id, source_system, source_project_id, target_system,
    target_project_id, integration_name, feed_type, feed_routing,
    direction, frequency, migration_flag, carries_pii, pii_categories,
    update_owner
"""


@router.get("/interfaces")
def list_interfaces(
    source_system: str | None = Query(None),
    target_system: str | None = Query(None),
    feed_type: str | None = Query(None),
    direction: str | None = Query(None),
    source_project_id: str | None = Query(None),
    target_project_id: str | None = Query(None),
    migration: str | None = Query(None),
    pii_status: str | None = Query(None),
    q: str | None = Query(None, description="Free-text fuzzy search"),
    limit: int = Query(100, ge=1, le=1000),
):
    params = {
        "source_system": source_system,
        "target_system": target_system,
        "feed_type": feed_type,
        "direction": direction,
        "source_project_id": source_project_id,
        "target_project_id": target_project_id,
        "migration": migration,
        "pii_status": pii_status,
    }

    where: list[str] = []
    binds: dict[str, object] = {}

    # --- Exact-match IN (...) for every active facet ---
    for i, (param, col) in enumerate(FACET_COLUMNS.items()):
        raw = params.get(param)
        if not raw:
            continue
        vals = [v.strip() for v in raw.split(",") if v.strip()]
        if not vals:
            continue
        keys = {f"f{i}_{j}": v for j, v in enumerate(vals)}
        binds.update(keys)
        placeholders = ", ".join(f":{k}" for k in keys)
        # TRIM on the column defends against whitespace from ingestion;
        # drop TRIM once the connector cleans data at load time.
        where.append(f"TRIM({col}) IN ({placeholders})")

    # --- Fuzzy search: ONLY here, never on facets ---
    if q and q.strip():
        binds["q"] = f"%{q.strip().upper()}%"
        where.append(
            "(UPPER(source_system) LIKE :q OR UPPER(target_system) LIKE :q "
            "OR UPPER(integration_name) LIKE :q OR UPPER(update_owner) LIKE :q "
            "OR UPPER(feed_type) LIKE :q)"
        )

    sql = f"SELECT {SELECT_COLS} FROM cp_interfaces"  # (2) your table
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY source_system, target_system FETCH FIRST :lim ROWS ONLY"
    binds["lim"] = limit

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, binds)
        cols = [d[0].lower() for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    return {"interfaces": rows, "count": len(rows)}
