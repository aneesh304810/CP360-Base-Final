"""A row hash over hundreds of columns without hitting ORA-01489.

Each chunk of `chunk` columns is concatenated, with a type-aware TO_CHAR
and a NULL marker, and hashed with STANDARD_HASH (SHA1, 40 hex chars).
The chunk hashes are concatenated and hashed again. 500 columns in
chunks of 8 is 63 inner hashes, about 2,600 characters in the outer
expression — well inside the 4000-byte limit the single-expression
approach breaks on.
"""
from __future__ import annotations

from .ident import ident

NULL_MARK = "'~'"


def col_text(name: str, data_type: str) -> str:
    n = ident(name)
    dt = (data_type or "").upper()
    if dt.startswith("TIMESTAMP"):
        return f"NVL(TO_CHAR({n}, 'YYYYMMDDHH24MISSFF6'), {NULL_MARK})"
    if dt == "DATE":
        return f"NVL(TO_CHAR({n}, 'YYYYMMDDHH24MISS'), {NULL_MARK})"
    if dt in ("NUMBER", "FLOAT", "BINARY_DOUBLE", "BINARY_FLOAT", "INTEGER"):
        return f"NVL(TO_CHAR({n}), {NULL_MARK})"
    if dt == "RAW":
        return f"NVL(RAWTOHEX({n}), {NULL_MARK})"
    return f"NVL({n}, {NULL_MARK})"


def chunk_exprs(columns: list[dict], chunk: int = 8) -> list[str]:
    out = []
    for i in range(0, len(columns), chunk):
        part = columns[i:i + chunk]
        inner = " || '|' || ".join(col_text(c["column_name"], c.get("data_type", "")) for c in part)
        out.append(f"RAWTOHEX(STANDARD_HASH({inner}, 'SHA1'))")
    return out


def hash_expr(columns: list[dict], chunk: int = 8) -> str:
    if not columns:
        return "'EMPTY'"
    parts = chunk_exprs(columns, chunk)
    if len(parts) == 1:
        return parts[0]
    return "RAWTOHEX(STANDARD_HASH(" + " || ".join(parts) + ", 'SHA1'))"
