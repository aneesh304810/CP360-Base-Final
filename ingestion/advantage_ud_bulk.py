"""Bulk MERGE for the two big UD tables.

loader._merge is one statement per row; at 1.2 million attribute rows that
is the load. This builds the same MERGE the loader builds and runs it with
executemany in batches, on the loader's own connection, so the semantics
(idempotent upsert by key, commit by the caller) are unchanged. A loader
without a connection (the tests' fake) falls back to per-row _merge.
"""
from __future__ import annotations

BATCH = 5000


def merge_sql(table, pk, cols):
    sel = ", ".join(f":{c} AS {c}" for c in cols)
    on = " AND ".join(f"t.{k} = s.{k}" for k in pk)
    upd_cols = [c for c in cols if c not in pk]
    ins_cols = ", ".join(cols)
    ins_vals = ", ".join(f"s.{c}" for c in cols)
    sql = f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s ON ({on}) "
    if upd_cols:
        sql += "WHEN MATCHED THEN UPDATE SET " + ", ".join(f"t.{c} = s.{c}" for c in upd_cols) + " "
    sql += f"WHEN NOT MATCHED THEN INSERT ({ins_cols}) VALUES ({ins_vals})"
    return sql


def bulk_merge(loader, table, pk, rows, batch=BATCH):
    """rows: list of dicts with identical keys. Returns rows written."""
    rows = list(rows)
    if not rows:
        return 0
    conn = getattr(loader, "conn", None)
    if conn is None or not hasattr(conn, "cursor"):
        for r in rows:
            loader._merge(table, pk, r)
        return len(rows)
    cols = list(rows[0].keys())
    sql = merge_sql(table, pk, cols)
    cur = conn.cursor()
    try:
        for i in range(0, len(rows), batch):
            cur.executemany(sql, rows[i:i + batch])
    finally:
        cur.close()
    return len(rows)
