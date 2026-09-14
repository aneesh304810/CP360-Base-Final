"""Idempotent Oracle loader. The single cornerstone: _merge + commit.

All connectors call ONLY loader._merge and loader.commit. The `protect` tuple
lists columns that harvest must never overwrite (overlay-managed fields).
"""
from __future__ import annotations
import logging
from typing import Any

log = logging.getLogger("cp.loader")


class Loader:
    def __init__(self, conn):
        self.conn = conn

    def commit(self) -> None:
        self.conn.commit()

    def _merge(
        self,
        table: str,
        pk: tuple[str, ...],
        values: dict[str, Any],
        protect: tuple[str, ...] = (),
    ) -> None:
        """Idempotent Oracle MERGE.

        `protect` lists columns harvest must never overwrite (overlay-managed):
        they are set on INSERT but excluded from the UPDATE clause.
        """
        cols = list(values.keys())
        # USING SELECT binds
        sel = ", ".join(f":{c} AS {c}" for c in cols)
        on = " AND ".join(f"t.{k} = s.{k}" for k in pk)
        upd_cols = [c for c in cols if c not in pk and c not in protect]
        ins_cols = ", ".join(cols)
        ins_vals = ", ".join(f"s.{c}" for c in cols)

        if upd_cols:
            upd = ", ".join(f"t.{c} = s.{c}" for c in upd_cols)
            sql = (
                f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
                f"ON ({on}) "
                f"WHEN MATCHED THEN UPDATE SET {upd} "
                f"WHEN NOT MATCHED THEN INSERT ({ins_cols}) VALUES ({ins_vals})"
            )
        else:
            sql = (
                f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
                f"ON ({on}) "
                f"WHEN NOT MATCHED THEN INSERT ({ins_cols}) VALUES ({ins_vals})"
            )
        cur = self.conn.cursor()
        cur.execute(sql, values)
        cur.close()
