"""Oracle connection pool + query helper. Read-only API.

Built for a database that may be on another continent: the link, not
the SQL, is what makes a screen slow when every round trip costs a
quarter of a second. So:

  * CLOBs come back inline with the row (oracledb.defaults.fetch_lobs =
    False). Reading each LOB separately costs one round trip per value,
    which on a 2,000-row screen with two CLOB columns is 4,000 trips;
  * rows are fetched 5,000 at a time (arraysize / prefetchrows), one trip
    per screen instead of one per hundred rows;
  * the pool keeps CP_API_POOL_MIN warm connections (default 2) so a
    request does not pay the connect handshake, up to CP_API_POOL_MAX (8);
  * a result cache keyed by SQL and binds, CP_API_QUERY_CACHE_SECONDS long
    (default 60, 0 disables), answers a repeated query without a trip.
    Every write through execute / execute_many clears it, so a review
    comment or a loaded batch is visible on the next read;
  * a query slower than CP_API_SLOW_QUERY_SECONDS (default 1) is logged
    with its time and row count; CP_API_LOG_QUERIES=1 logs every query.
"""
from __future__ import annotations
import copy
import logging
import os
import threading
import time

log = logging.getLogger("cp.api.db")
_pool = None
_cache: dict = {}
_cache_lock = threading.Lock()

ARRAYSIZE = 5000


def _num(name, default):
    try:
        return float(os.environ.get(name, "").strip() or default)
    except ValueError:
        return float(default)


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
        try:
            oracledb.defaults.fetch_lobs = False          # CLOB/BLOB inline with the row: no round trip per value
        except Exception:                                  # noqa: BLE001
            pass
        try:
            oracledb.defaults.arraysize = ARRAYSIZE
            oracledb.defaults.prefetchrows = ARRAYSIZE + 1
        except Exception:                                  # noqa: BLE001
            pass
        dsn = os.environ["CP_CATALOG_DB_DSN"]
        user, pwd, hostpart = _parse_dsn(dsn)
        lo = max(1, int(_num("CP_API_POOL_MIN", 2)))
        hi = max(lo, int(_num("CP_API_POOL_MAX", 8)))
        _pool = oracledb.create_pool(user=user, password=pwd, dsn=hostpart,
                                     min=lo, max=hi, increment=1)
    return _pool


def _key(sql, params):
    try:
        return (sql, tuple(sorted((k, str(v)) for k, v in (params or {}).items())))
    except Exception:                                      # noqa: BLE001
        return None


def cache_clear():
    with _cache_lock:
        _cache.clear()


def _cache_get(key):
    ttl = _num("CP_API_QUERY_CACHE_SECONDS", 60)
    if ttl <= 0 or key is None:
        return None
    with _cache_lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] <= ttl:
            return copy.deepcopy(hit[1])
        if hit:
            _cache.pop(key, None)
    return None


def _cache_put(key, rows):
    ttl = _num("CP_API_QUERY_CACHE_SECONDS", 60)
    if ttl <= 0 or key is None:
        return
    with _cache_lock:
        if len(_cache) > 2000:                             # bounded: the oldest half goes
            for k in sorted(_cache, key=lambda k: _cache[k][0])[: len(_cache) // 2]:
                _cache.pop(k, None)
        _cache[key] = (time.monotonic(), copy.deepcopy(rows))


def query(sql: str, params: dict | None = None) -> list[dict]:
    """Run a SELECT and return list[dict] with lowercase snake_case keys.
    On a missing table (ORA-00942) returns [] so the API degrades gracefully."""
    key = _key(sql, params)
    hit = _cache_get(key)
    if hit is not None:
        return hit
    t0 = time.perf_counter()
    try:
        with get_pool().acquire() as conn:
            cur = conn.cursor()
            try:
                cur.arraysize = ARRAYSIZE
                cur.prefetchrows = ARRAYSIZE + 1
            except Exception:                              # noqa: BLE001
                pass
            cur.execute(sql, params or {})
            cols = [c[0].lower() for c in cur.description]
            out = []
            for row in cur.fetchall():
                d = {}
                for k, v in zip(cols, row):
                    if hasattr(v, "read"):                 # a LOB object, only if fetch_lobs could not be turned off
                        v = v.read()
                    d[k] = v
                out.append(d)
            cur.close()
    except Exception as e:
        if "ORA-00942" in str(e):  # table or view does not exist
            log.warning("query on missing object -> []: %s", e)
            return []
        raise
    took = time.perf_counter() - t0
    if took >= _num("CP_API_SLOW_QUERY_SECONDS", 1) or os.environ.get("CP_API_LOG_QUERIES", "").strip() in ("1", "true", "yes"):
        log.info("query %.2f s, %s rows: %s", took, len(out), " ".join(sql.split())[:160])
    _cache_put(key, out)
    return out


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
    cache_clear()


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
    cache_clear()
