"""
Column-level lineage via sqlglot.

For each dbt model's compiled SQL, parse the SELECT and map each output column
back to its source column(s), capturing the transform expression. Writes
column_lineage edges (from_column -> to_column, transform_expr).

Reliable for standard SELECT/CTE/JOIN. SELECT * and dynamic SQL won't fully
resolve — those models simply yield fewer column edges (table lineage still holds).
"""
from __future__ import annotations
import logging
from typing import Optional

try:
    import sqlglot
    from sqlglot import exp
    _HAVE = True
except Exception:                       # pragma: no cover
    _HAVE = False

log = logging.getLogger(__name__)


def _col_refs(node) -> list[str]:
    """All source column names referenced inside an expression."""
    return [c.name for c in node.find_all(exp.Column)] if _HAVE else []


def extract_column_lineage(target_key: str, compiled_sql: str,
                           dialect: str = "oracle") -> list[dict]:
    """Return column_lineage edge dicts for one model's SQL."""
    if not _HAVE or not compiled_sql:
        return []
    try:
        tree = sqlglot.parse_one(compiled_sql, dialect=dialect)
    except Exception as e:
        log.debug("sqlglot parse failed for %s: %s", target_key, e)
        return []
    if tree is None:
        return []

    select = tree.find(exp.Select)
    if select is None:
        return []

    edges: list[dict] = []
    for proj in select.expressions:
        # output column name = alias, else the column's own name
        out_name = proj.alias_or_name
        if not out_name or out_name == "*":
            continue
        expr = proj.this if isinstance(proj, exp.Alias) else proj
        srcs = _col_refs(expr)
        # transform expression text (the SQL that produces this column)
        transform = expr.sql(dialect=dialect) if not isinstance(expr, exp.Column) else "1:1"
        to_col = f"{target_key}.{out_name}"
        if not srcs:
            edges.append({
                "edge_id": f"const->{to_col}",
                "from_column": "(literal)", "to_column": to_col,
                "transform_expr": transform, "source": "sqlglot",
                "model_key": target_key})
            continue
        for s in dict.fromkeys(srcs):     # dedupe, preserve order
            edges.append({
                "edge_id": f"{s}->{to_col}",
                "from_column": s, "to_column": to_col,
                "transform_expr": transform, "source": "sqlglot",
                "model_key": target_key})
    return edges


def load_column_lineage(loader, transforms: list[dict],
                        dialect: str = "oracle") -> int:
    """Given transformation rows (target_key + compiled_sql), write all edges."""
    n = 0
    for tr in transforms:
        for edge in extract_column_lineage(
                tr["target_key"], tr.get("compiled_sql"), dialect):
            loader._merge("column_lineage", ("edge_id",), edge)
            n += 1
    loader.commit()
    log.info("sqlglot: wrote %d column-lineage edges", n)
    return n
