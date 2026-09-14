"""Oracle connection pool + query helper. Read-only API."""
from __future__ import annotations
import os
import logging

log = logging.getLogger("cp.api.db")
_pool = None


def _parse_dsn(dsn: str):
    # Accept several formats:
    #   oracle://user:pwd@host:port/service
    #   user/pwd@host:port/service        (sqlplus style)
    #   user:pwd@host:port/service
    #   host:port/service                 (no creds -> external auth)
    s = dsn
    if s.startswith("oracle://"):
        s = s[len("oracle://"):]
    if "@" in s:
        creds, hostpart = s.split("@", 1)
        if ":" in creds:
            user, pwd = creds.split(":", 1)
        elif "/" in creds:
            user, pwd = creds.split("/", 1)
        else:
            user, pwd = creds, ""
        return user, pwd, hostpart
    return None, None, s


def get_pool():
    global _pool
    if _pool is None:
        import oracledb
        dsn = os.environ["CP_CATALOG_DB_DSN"]
        user, pwd, hostpart = _parse_dsn(dsn)
        _pool = oracledb.create_pool(user=user, password=pwd, dsn=hostpart,
                                     min=1, max=4, increment=1)
    return _pool


def query(sql: str, params: dict | None = None) -> list[dict]:
    """Run a SELECT and return list[dict] with lowercase snake_case keys.
    On a missing table (ORA-00942) returns [] so the API degrades gracefully."""
    try:
        with get_pool().acquire() as conn:
            cur = conn.cursor()
            cur.execute(sql, params or {})
            cols = [c[0].lower() for c in cur.description]
            out = []
            for row in cur.fetchall():
                d = {}
                for k, v in zip(cols, row):
                    # read LOBs to str
                    if hasattr(v, "read"):
                        v = v.read()
                    d[k] = v
                out.append(d)
            cur.close()
            return out
    except Exception as e:
        if "ORA-00942" in str(e):  # table or view does not exist
            log.warning("query on missing object -> []: %s", e)
            return []
        raise


def execute(statements: list[tuple]) -> None:
    """Run one or more write statements (sql, params) in a single transaction.
    Commits on success, rolls back on any error. Used by the flow builder."""
    with get_pool().acquire() as conn:
        cur = conn.cursor()
        try:
            for sql, params in statements:
                cur.execute(sql, params or {})
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()


def execute_many(sql: str, rows: list[dict]) -> None:
    """Batch-insert rows with executemany, in one committed transaction."""
    if not rows:
        return
    with get_pool().acquire() as conn:
        cur = conn.cursor()
        try:
            cur.executemany(sql, rows)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
