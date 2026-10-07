"""AddVantage user-defined field codes, for Datapoint 360.

    GET /advantage-ud/codes?attribute=UD_1       the values UD_1 carries
    GET /advantage-ud/coded-attributes           which UD attributes have any

Reads cp_advantage_ud_dictionary (sql/75). The attribute is validated
before it reaches the database: a name that is not UD_<n> or UD_<n>_<seq>
is refused with 400 rather than searched for, because the only caller is
the Non-SEI datapoint pane and a non-UD field there has no codes by
definition. A missing table degrades to an empty list (db.query already
does that on ORA-00942), so a warehouse that has not run sql/75 shows the
pane exactly as before.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException

from .db import query

log = logging.getLogger("cp.api.advantage_ud")
router = APIRouter(prefix="/advantage-ud", tags=["advantage-ud"])

UD_RE = re.compile(r"^UD_\d+(?:_\d+)?$")


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:                                   # noqa: BLE001
        log.warning("advantage_ud query failed: %s", e)
        return []


@router.get("/codes")
def codes(attribute: str):
    a = (attribute or "").strip().upper()
    if not UD_RE.match(a):
        raise HTTPException(400, f"Not a UD attribute: {attribute!r}. Expected UD_<n> or UD_<n>_<seq>.")
    rows = _safe("""
        SELECT attribute_name, parent_attribute, code_value, description_value,
               occurrence_count, source, table_number, link_status, is_pii
        FROM cp_advantage_ud_dictionary
        WHERE attribute_name = :a
        ORDER BY source, LENGTH(code_value), code_value""", {"a": a})
    for r in rows:
        if (r.get("is_pii") or "N") == "Y":        # names never leave the server
            r["description_value"] = "•••"
    return {"attribute": a, "codes": rows,
            "sources": sorted({r.get("source") for r in rows if r.get("source")})}


@router.get("/coded-attributes")
def coded_attributes():
    return {"attributes": _safe("""
        SELECT attribute_name, COUNT(*) AS code_count,
               MAX(link_status) AS link_status
        FROM cp_advantage_ud_dictionary
        GROUP BY attribute_name ORDER BY attribute_name""")}
