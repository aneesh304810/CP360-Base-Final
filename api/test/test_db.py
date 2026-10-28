"""db.py on a fake oracledb: LOBs inline, big fetches, the result cache
and its invalidation, the slow-query log, ORA-00942 -> [].
Run: python3.13 api/test/test_db.py"""
import logging
import io
import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
FAILS = []


def ok(cond, msg, extra=None):
    print(("ok  " if cond else "FAIL") + " " + msg + ("" if cond or extra is None else f"  -> {extra}"))
    if not cond:
        FAILS.append(msg)


class Lob:
    def __init__(self, s): self.s = s
    def read(self): return self.s


class Cur:
    def __init__(self, db): self.db = db; self.description = None; self.arraysize = 100; self.prefetchrows = 2
    def execute(self, sql, params=None):
        self.db["calls"].append((sql, dict(params or {})))
        self.db["sizes"].append((self.arraysize, self.prefetchrows))
        if "MISSING" in sql:
            raise RuntimeError("ORA-00942: table or view does not exist")
        self.description = [("ID",), ("TXT",)]
        self._rows = [(1, "a"), (2, Lob("lob text"))]
    def executemany(self, sql, rows): self.db["calls"].append((sql, len(rows)))
    def fetchall(self): return self._rows
    def close(self): pass


class Conn:
    def __init__(self, db): self.db = db
    def cursor(self): return Cur(self.db)
    def commit(self): self.db["commits"] += 1
    def rollback(self): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass


class Pool:
    def __init__(self, db, **kw): self.db = db; self.kw = kw
    def acquire(self): return Conn(self.db)


DB = {"calls": [], "sizes": [], "commits": 0}
fake = types.ModuleType("oracledb")
fake.defaults = types.SimpleNamespace(fetch_lobs=True, arraysize=100, prefetchrows=2)
fake.create_pool = lambda **kw: Pool(DB, **kw)
sys.modules["oracledb"] = fake
os.environ["CP_CATALOG_DB_DSN"] = "u/p@h:1/svc"
os.environ.pop("CP_API_QUERY_CACHE_SECONDS", None)
from app import db   # noqa: E402

buf = io.StringIO()
h = logging.StreamHandler(buf)
logging.getLogger("cp.api.db").addHandler(h)
logging.getLogger("cp.api.db").setLevel(logging.INFO)

print("-- the pool and the fetch")
rows = db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})
ok(fake.defaults.fetch_lobs is False and fake.defaults.arraysize == 5000 and fake.defaults.prefetchrows == 5001, "LOBs are fetched inline and rows 5,000 at a time, set before the pool is built")
ok(db._pool.kw["min"] == 2 and db._pool.kw["max"] == 8, "the pool keeps two warm connections, up to eight", db._pool.kw)
ok(DB["sizes"][-1] == (5000, 5001), "each cursor fetches 5,000 rows a trip", DB["sizes"])
ok(rows == [{"id": 1, "txt": "a"}, {"id": 2, "txt": "lob text"}], "lowercase keys; a LOB object that still arrives is read", rows)

print("-- the cache")
n = len(DB["calls"])
again = db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})
ok(len(DB["calls"]) == n and again == rows, "the same SQL and binds within the TTL is answered from the cache, no round trip")
again[0]["id"] = 99
ok(db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})[0]["id"] == 1, "a caller changing a row does not change the cache")
db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 2})
ok(len(DB["calls"]) == n + 1, "different binds are a different query")
db.execute([("UPDATE t SET x = 1", {})])
db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})
ok(DB["commits"] == 1 and len(DB["calls"]) == n + 3, "a write clears the cache, so the next read goes to the database")
db.execute_many("INSERT INTO t VALUES (:a)", [{"a": 1}])
db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})
ok(DB["commits"] == 2 and len(DB["calls"]) == n + 5, "execute_many clears it too")
os.environ["CP_API_QUERY_CACHE_SECONDS"] = "0"
db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1}); db.query("SELECT id, txt FROM t WHERE k = :k", {"k": 1})
ok(len(DB["calls"]) == n + 7, "CP_API_QUERY_CACHE_SECONDS=0 disables the cache")
os.environ.pop("CP_API_QUERY_CACHE_SECONDS", None)

print("-- degrading and logging")
ok(db.query("SELECT 1 FROM MISSING_T") == [] and "missing object" in buf.getvalue(), "a missing table is an empty list and a warning")
os.environ["CP_API_LOG_QUERIES"] = "1"
db.query("SELECT   id,\n txt FROM t WHERE k = :k", {"k": 3})
ok("rows: SELECT id, txt FROM t WHERE k = :k" in buf.getvalue(), "CP_API_LOG_QUERIES=1 logs the time, the row count and the SQL on one line", buf.getvalue()[-200:])
os.environ.pop("CP_API_LOG_QUERIES", None)

print()
if FAILS:
    print(f"{len(FAILS)} FAILED"); sys.exit(1)
print("db assertions pass")
