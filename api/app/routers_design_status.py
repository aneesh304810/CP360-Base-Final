"""Hub component status — the only WRITE endpoints in the catalogue.

    GET  /design/status                      every component's current state
    GET  /design/status/{component_id}/history
    PUT  /design/status/{component_id}       set it, and append to history

THIS ARRIVED AS A TEMPLATE and needed four fixes before it could load,
the same class as routers_reference_legacy:

  * `from ..db import get_conn` — wrong on both counts. The routers sit
    directly in app/, so it is `.db` not `..db`; and `get_conn` has
    never existed there. db.py exports get_pool, query, execute,
    execute_many.
  * The docstring said to mount it as `.routers.design_status`. The
    mount loop in main.py imports `app.routers_design_status`, which is
    why this file is named what it is.
  * Positional binds (`:1`, `:2`) mixed with `FETCH FIRST`. Named binds
    throughout instead, like every other router here.
  * `int(r[2])` on a nullable read. pct is NOT NULL in the table, but
    the row shape is no longer hand-unpacked anyway — query() returns
    dicts.

AND ONE THING THE TEMPLATE COULD NOT HAVE KNOWN. main.py allows only
GET and POST through CORS, because until now nothing wrote. A PUT from
a browser on another origin fails its preflight and surfaces as a
network error, not as a 405 — so "PUT" is added to allow_methods in
main.py alongside this file. Same-origin (the normal deployment, and
the vite proxy) was never affected, which is exactly why it would have
been found late.

THE AUDIT TRAIL IS REAL WHERE IT CAN BE. `updated_by` defaulted to the
literal "cp360-ui", which makes a history table that cannot answer who
changed anything. When somebody is signed in, their account name is
stamped instead; with sign-in off it falls back to the body, as before.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .db import query, execute

log = logging.getLogger("cp.api.design_status")
router = APIRouter(prefix="/design/status", tags=["design-status"])

# Must stay identical to the CHECK constraint in sql/42_component_status.sql.
# Checked here as well so a bad value is a 422 naming the options rather
# than an ORA-02290 the caller cannot read.
STATUSES = ["Not Started", "In Design", "In Review",
            "Approved", "In Build", "Complete"]

# component_id is VARCHAR2(10). Guarded so an over-long id is a 422 and
# not an ORA-12899 from inside the MERGE.
ID_MAX = 10


class StatusIn(BaseModel):
    status: str
    pct: int = Field(ge=0, le=100)
    note: Optional[str] = None
    updated_by: str = "cp360-ui"


def _cid(component_id: str) -> str:
    cid = (component_id or "").strip()
    if not cid:
        raise HTTPException(422, "component_id is required")
    if len(cid) > ID_MAX:
        raise HTTPException(422, f"component_id is longer than {ID_MAX} "
                                 f"characters: {cid!r}")
    return cid


def _actor(request: Request, fallback: str) -> str:
    """Who to record. The signed-in account when there is one.

    A history table whose every row says "cp360-ui" cannot answer the
    only question it exists for. When sign-in is off this is unchanged
    from before -- the body's value is used.
    """
    try:
        from .security import current_user
        u = current_user(request)
        if u and not u.get("insecure") and u.get("user_id"):
            return str(u["user_id"])[:60]
    except Exception:                                         # noqa: BLE001
        pass
    return (fallback or "cp360-ui")[:60]


@router.get("")
def all_status():
    return query("""SELECT component_id, status, pct, note, updated_by,
                           TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI') AS updated_at
                    FROM   component_status
                    ORDER  BY component_id""")


@router.get("/{component_id}/history")
def history(component_id: str, limit: int = 50):
    return query("""SELECT status, pct, note, updated_by,
                           TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI:SS') AS updated_at
                    FROM   component_status_hist
                    WHERE  component_id = :cid
                    ORDER  BY updated_at DESC
                    FETCH FIRST :lim ROWS ONLY""",
                 {"cid": _cid(component_id),
                  "lim": max(1, min(int(limit or 50), 1000))})


@router.put("/{component_id}")
def upsert(component_id: str, body: StatusIn, request: Request):
    cid = _cid(component_id)
    if body.status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    by = _actor(request, body.updated_by)
    p = {"cid": cid, "st": body.status, "pct": body.pct,
         "note": body.note, "by": by}
    # ONE TRANSACTION. execute() commits on success and rolls back on any
    # error, so the current row and its history entry cannot disagree --
    # a state change with no history row is a change nobody can trace.
    try:
        execute([
            ("""MERGE INTO component_status s
                USING (SELECT :cid AS cid FROM dual) x
                   ON (s.component_id = x.cid)
                WHEN MATCHED THEN UPDATE
                     SET status = :st, pct = :pct, note = :note,
                         updated_by = :by, updated_at = SYSTIMESTAMP
                WHEN NOT MATCHED THEN
                     INSERT (component_id, status, pct, note, updated_by)
                     VALUES (:cid, :st, :pct, :note, :by)""", p),
            ("""INSERT INTO component_status_hist
                   (component_id, status, pct, note, updated_by, updated_at)
                 VALUES (:cid, :st, :pct, :note, :by, SYSTIMESTAMP)""", p),
        ])
    except Exception as e:                                    # noqa: BLE001
        log.error("component_status write failed for %s: %s", cid, e)
        raise HTTPException(500, "the status could not be saved — see the "
                                 "API log") from e
    return {"ok": True, "component_id": cid, "status": body.status,
            "pct": body.pct, "updated_by": by}
