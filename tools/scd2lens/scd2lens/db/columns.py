"""The tracked-column list: everything that can open a version."""
from __future__ import annotations

from ..config import Settings
from ..sqlfiles import sql
from .ident import ident


def entity_key(table: str) -> str:
    """DIM_ACCOUNT -> ACCOUNT_KEY; DIM_INTERESTED_PARTY -> INTERESTED_PARTY_KEY."""
    t = ident(table)
    for prefix in ("DIM_", "FACT_", "REF_"):
        if t.startswith(prefix):
            return t[len(prefix):] + "_KEY"
    return t + "_KEY"


def filter_tracked(columns: list[dict], table: str, settings: Settings, surrogate: str | None = None) -> list[dict]:
    drop = set(settings.tech_upper) | {entity_key(table)}
    if surrogate:
        drop.add(surrogate.upper())
    out = []
    for c in columns:
        name = str(c["column_name"]).upper()
        dt = str(c.get("data_type") or "").upper()
        if name in drop or dt in settings.lob_upper or dt.startswith("LONG"):
            continue
        out.append({"column_name": name, "data_type": dt, "nullable": c.get("nullable")})
    return out


def tracked_columns(run, owner: str, table: str, settings: Settings, surrogate: str | None = None) -> list[dict]:
    rows = run(sql("tracked_columns"), {"owner": ident(owner), "tbl": ident(table)})
    return filter_tracked(rows, table, settings, surrogate)
