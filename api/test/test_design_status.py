"""Hub component status — the catalogue's only write endpoints.

WHAT THESE GUARD. A write path has failure modes a read path does not,
and three of them here would be silent:

  * the MERGE and the history INSERT must land together. A status change
    with no history row is a change nobody can trace, and that is the
    only reason the history table exists.
  * `updated_by` defaulted to the literal "cp360-ui". A history table
    whose every row says that cannot answer the one question it is for,
    so the signed-in account is stamped when there is one.
  * STATUSES here must stay identical to the CHECK constraint in
    sql/42_component_status.sql. If they drift, a value this code
    accepts becomes an ORA-02290 the caller cannot read.

    python api/test/test_design_status.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import HTTPException                             # noqa: E402

from api.app import routers_design_status as R                # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class Req:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}
        self.headers = {}
        self.client = None


# ---- the vocabulary matches the database --------------------------------
print("-- STATUSES vs the CHECK constraint")
ddl = open(os.path.join(os.path.dirname(__file__), "..", "..", "sql",
                        "42_component_status.sql"), encoding="utf-8").read()
m = re.search(r"CHECK \(status IN \((.*?)\)\)", ddl, re.S)
in_db = re.findall(r"'([^']+)'", m.group(1)) if m else []
ok(in_db == R.STATUSES,
   "the router's list is exactly the CHECK constraint's -- drift makes a "
   "value this code accepts an ORA-02290 the caller cannot read",
   (R.STATUSES, in_db))

# ---- both statements, one transaction -----------------------------------
print("\n-- the write")
sent = {}


def spy_exec(statements):
    sent["stmts"] = [" ".join(s.lower().split()) for s, _ in statements]
    sent["params"] = [dict(p) for _, p in statements]


R.execute = spy_exec
out = R.upsert("H-01", R.StatusIn(status="In Build", pct=40), Req())
ok(len(sent["stmts"]) == 2, "two statements", len(sent["stmts"]))
ok("merge into component_status" in sent["stmts"][0], "a MERGE on the current row")
ok("insert into component_status_hist" in sent["stmts"][1], "and a history INSERT")
ok(sent["params"][0] == sent["params"][1],
   "with the same values, so the two cannot disagree")
ok(out["ok"] is True and out["component_id"] == "H-01", "and it reports back", out)

# They go to execute() as ONE list, which commits once and rolls back as
# a whole — a status change with no history row is untraceable.
ok(isinstance(sent["stmts"], list) and len(sent["stmts"]) == 2,
   "handed to execute() together rather than written one at a time")

print("\n-- who gets recorded")
ok(sent["params"][0]["by"] == "cp360-ui",
   "with no session, the body's value is used -- unchanged from before",
   sent["params"][0]["by"])

import api.app.security as S
_orig = S.current_user
try:
    S.current_user = lambda request: {"user_id": "A.NAIR", "insecure": False}
    R.upsert("H-01", R.StatusIn(status="Approved", pct=100), Req())
    ok(sent["params"][0]["by"] == "A.NAIR",
       "signed in, the real account is stamped -- a history of 'cp360-ui' "
       "answers nothing", sent["params"][0]["by"])
    S.current_user = lambda request: {"user_id": "LOCAL.USER", "insecure": True}
    R.upsert("H-01", R.StatusIn(status="Approved", pct=100,
                                updated_by="ana"), Req())
    ok(sent["params"][0]["by"] == "ana",
       "the open identity used while sign-in is OFF is not stamped as a "
       "person -- it would be a name nobody chose", sent["params"][0]["by"])
finally:
    S.current_user = _orig

# ---- refusals before the database ---------------------------------------
print("\n-- refusals")
sent.clear()
try:
    R.upsert("H-01", R.StatusIn(status="Nearly done", pct=90), Req())
    ok(False, "an unknown status must be refused")
except HTTPException as e:
    ok(e.status_code == 422 and "must be one of" in e.detail,
       "an unknown status is 422 and names the options", e.detail)
try:
    R.upsert("THIS-IS-FAR-TOO-LONG", R.StatusIn(status="Approved", pct=1), Req())
    ok(False, "an over-long id must be refused")
except HTTPException as e:
    ok(e.status_code == 422,
       "component_id over 10 chars is 422, not an ORA-12899 from inside "
       "the MERGE (the column is VARCHAR2(10))", e.status_code)
for blank in ("", "   "):
    try:
        R.history(blank)
        ok(False, "a blank id must be refused")
    except HTTPException as e:
        ok(e.status_code == 422, f"blank id {blank!r} -> 422")
ok("stmts" not in sent, "and none of them reached the database", sent)

# ---- a failed write is never reported as success ------------------------
print("\n-- a failed write")
def boom(statements):
    raise RuntimeError("ORA-00001: unique constraint")


R.execute = boom
try:
    R.upsert("H-02", R.StatusIn(status="Approved", pct=100), Req())
    ok(False, "a database error must not return ok:true")
except HTTPException as e:
    ok(e.status_code == 500 and "ORA-00001" not in e.detail,
       "it is a 500, and the Oracle text stays in the log rather than "
       "going to the browser", e.detail)

# ---- reads ---------------------------------------------------------------
print("\n-- reads")
seen = {}
R.query = lambda sql, p=None: (seen.update(
    {"sql": " ".join(sql.lower().split()), "p": dict(p or {})}) or [])
R.history("H-01", limit=99999)
ok(seen["p"]["lim"] == 1000, "history limit is capped", seen["p"]["lim"])
R.history("H-01", limit=-1)
ok(seen["p"]["lim"] == 1, "and floored -- Oracle rejects a negative FETCH FIRST",
   seen["p"]["lim"])
ok(":cid" in seen["sql"] and ":lim" in seen["sql"],
   "named binds throughout, not the template's positional :1/:2 mixed "
   "with FETCH FIRST")
R.all_status()
ok("order by component_id" in seen["sql"],
   "the list is ordered -- an unordered status board shuffles between "
   "refreshes and looks broken")

print(f"\n{BAD} assertion(s) failed" if BAD else "\ndesign-status assertions pass")
sys.exit(1 if BAD else 0)
