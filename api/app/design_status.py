"""CP 360 · Hub component status endpoints (Tier-2).
Wire in api/app/main.py:  from .routers.design_status import router as status_router
                          app.include_router(status_router)
Uses the app's existing get_conn() Oracle helper (SILVER)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ..db import get_conn   # adjust to the app's connection helper

router = APIRouter(prefix="/design/status", tags=["design-status"])

STATUSES = ["Not Started", "In Design", "In Review", "Approved", "In Build", "Complete"]

class StatusIn(BaseModel):
    status: str
    pct: int = Field(ge=0, le=100)
    note: Optional[str] = None
    updated_by: str = "cp360-ui"

@router.get("")
def all_status():
    with get_conn() as con:
        rows = con.cursor().execute(
            "SELECT component_id, status, pct, note, updated_by, "
            "TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI') FROM component_status").fetchall()
    return [{"component_id": r[0], "status": r[1], "pct": int(r[2]),
             "note": r[3], "updated_by": r[4], "updated_at": r[5]} for r in rows]

@router.get("/{component_id}/history")
def history(component_id: str, limit: int = 50):
    with get_conn() as con:
        rows = con.cursor().execute(
            "SELECT status, pct, updated_by, TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI:SS') "
            "FROM component_status_hist WHERE component_id=:1 "
            "ORDER BY updated_at DESC FETCH FIRST :2 ROWS ONLY",
            [component_id, limit]).fetchall()
    return [{"status": r[0], "pct": int(r[1]), "updated_by": r[2], "updated_at": r[3]}
            for r in rows]

@router.put("/{component_id}")
def upsert(component_id: str, body: StatusIn):
    if body.status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    with get_conn() as con:
        cur = con.cursor()
        cur.execute("""
            MERGE INTO component_status s
            USING (SELECT :cid cid FROM dual) x ON (s.component_id = x.cid)
            WHEN MATCHED THEN UPDATE SET status=:st, pct=:pct, note=:note,
                 updated_by=:by, updated_at=SYSTIMESTAMP
            WHEN NOT MATCHED THEN INSERT (component_id, status, pct, note, updated_by)
                 VALUES (:cid, :st, :pct, :note, :by)""",
            cid=component_id, st=body.status, pct=body.pct,
            note=body.note, by=body.updated_by)
        cur.execute("""
            INSERT INTO component_status_hist
              (component_id, status, pct, note, updated_by, updated_at)
            VALUES (:1,:2,:3,:4,:5,SYSTIMESTAMP)""",
            [component_id, body.status, body.pct, body.note, body.updated_by])
        con.commit()
    return {"ok": True, "component_id": component_id,
            "status": body.status, "pct": body.pct}
