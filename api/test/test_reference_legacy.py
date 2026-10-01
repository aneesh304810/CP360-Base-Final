"""The legacy datapoint endpoints, which had never loaded.

WHY THIS FILE EXISTS. routers_reference_legacy shipped as an unadapted
template: it imported `get_conn` from app.db, which has never existed
there. The guarded mount loop in main.py caught the ImportError, logged
one WARNING among twenty-seven INFO lines, and skipped it -- every
start, in every copy of this codebase. Three endpoints answered nothing
and nobody noticed, because a skipped router looks exactly like a
feature nobody has clicked.

So the first assertion is the one that matters: the module imports and
main.py mounts it. The rest guard the adaptation -- that the optional
filter is composed rather than bound as a NULL, that an unknown system
is refused before it reaches the database, and that the detail endpoint
still 404s rather than returning an empty shell.

    python api/test/test_reference_legacy.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import HTTPException                             # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


# ---- it loads at all ----------------------------------------------------
print("-- the import that was broken")
try:
    from api.app import routers_reference_legacy as R
    ok(True, "the module imports (it did not until now: `get_conn` is not "
             "in db.py and never was)")
except Exception as e:                                        # noqa: BLE001
    ok(False, "the module imports", e)
    sys.exit(1)

paths = sorted(r.path for r in R.router.routes)
ok(paths == ["/reference/legacy-datapoint", "/reference/legacy-datapoint-summary",
             "/reference/legacy-datapoint/{name}"],
   "all three endpoints are registered", paths)
ok(not any(p.startswith("/api") for p in paths),
   "and none carries an /api prefix -- the UI's API_BASE is already /api "
   "and the vite proxy strips it, so a server-side /api would double it",
   paths)

# ---- the SQL it builds --------------------------------------------------
seen = {}


def spy(sql, params=None):
    seen["sql"] = " ".join(sql.lower().split())
    seen["p"] = dict(params or {})
    return []


R.query = spy

print("\n-- the optional filter")
R.list_legacy_datapoints(system="ADDVANTAGE")
ok(":q" not in seen["sql"],
   "with no q, the bind is not in the statement at all -- Oracle cannot "
   "always type an untyped NULL bind, and an absent filter should not be "
   "a predicate", seen["sql"][:90])
ok("q" not in seen["p"], "and is not bound", seen["p"])
R.list_legacy_datapoints(system="ADDVANTAGE", q=" acc ")
ok(seen["p"].get("q") == "ACC", "a q is trimmed and upper-cased", seen["p"].get("q"))
ok(":q" in seen["sql"], "and appears in the statement")

print("\n-- pii_only becomes a HAVING, not a WHERE")
R.list_legacy_datapoints(system="ADDVANTAGE", pii_only=True)
ok("having" in seen["sql"],
   "pii_only filters the GROUPED rows: is_pii is aggregated with MAX, so "
   "it cannot be tested before the grouping")
R.list_legacy_datapoints(system="ADDVANTAGE", pii_only=False)
ok("having" not in seen["sql"], "and is absent when not asked for")

print("\n-- no hard-coded schema")
for call in (lambda: R.list_legacy_datapoints(system="ADDVANTAGE"),
             lambda: R.legacy_datapoint_summary(system="ADDVANTAGE")):
    call()
    ok("silver." not in seen["sql"],
       "the silver. prefix is gone -- it was the only router with one, and "
       "it breaks any deployment that does not own that schema")

print("\n-- an unknown system never reaches the database")
seen.clear()
for bad_sys in ("PBDW", "", "'; DROP TABLE", None):
    try:
        R.list_legacy_datapoints(system=bad_sys)
        ok(False, f"{bad_sys!r} should be refused")
    except HTTPException as e:
        ok(e.status_code == 400, f"{bad_sys!r} -> 400", e.status_code)
ok("sql" not in seen, "and no statement was built for any of them", seen)
for good in ("addvantage", " STAR ", "Crd"):
    R.list_legacy_datapoints(system=good)
    ok(seen["p"]["system"] == good.strip().upper(),
       f"{good!r} is accepted and normalised", seen["p"]["system"])

print("\n-- detail 404s rather than returning an empty shell")
R.query = lambda sql, p=None: []
try:
    R.legacy_datapoint_detail("NOT_A_FIELD", system="ADDVANTAGE")
    ok(False, "a field with neither lineage nor a definition must 404")
except HTTPException as e:
    ok(e.status_code == 404, "unknown field -> 404", e.status_code)

R.query = lambda sql, p=None: (
    [{"dwh_target_table": "T1", "dwh_target_column": "C"},
     {"dwh_target_table": "T1", "dwh_target_column": "C"},
     {"dwh_target_table": "T2", "dwh_target_column": "C"}]
    if "legacy_lineage" in sql else [])
d = R.legacy_datapoint_detail("acc_num", system="ADDVANTAGE")
ok(d["occurrence_count"] == 3, "every occurrence is counted",
   d["occurrence_count"])
ok(d["module_count"] == 2,
   "but modules are DISTINCT tables -- the same field twice in one table "
   "is one module, not two", d["module_count"])
ok(d["definitions"] == [],
   "a field with lineage and no dictionary entry still renders rather "
   "than 404ing -- that gap is the finding, not an error")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nreference-legacy assertions pass")
sys.exit(1 if BAD else 0)
