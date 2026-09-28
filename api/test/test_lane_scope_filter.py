"""A lane filter must never be the reason data disappears.

WHY. PBDW's Business view showed one functional group where it had shown
seventeen. The cause was two endpoints disagreeing about what "in this
warehouse" means: /legacy-lineage/tables scopes with
`(data_source = :ds OR data_source IS NULL)` -- its own docstring says
excluding NULLs empties the screen -- while /lane-scope scoped with
`data_source = :ds`. Most PBDW rows carry no tag, so the lane's answer
was a small subset of the estate, the UI intersected the two, and
sixteen groups vanished.

The UI's guard was `resolved`, which only says the question was
answerable. Both routes can answer PARTIALLY -- route 2 is a join, and
every row whose source table does not resolve to a feed key is dropped
without comment. So the contract is now three facts, and the UI filters
only when all three hold.

    python api/test/test_lane_scope_filter.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from api.app import routers_sei_crosswalk as M                # noqa: E402
import api.app._legacy_compat as C                            # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class Fake:
    """`tagged` is how many lineage rows carry an explicit data_source; the
    rest are NULL, which is the PBDW shape. `systems` is how many lanes the
    route can see. `attributable` is how many rows the route can place."""

    def __init__(self, total=2759, tagged=40, systems=1, attributable=None,
                 lane_table=False, lane_rows_for_sys=0):
        self.total, self.tagged, self.systems = total, tagged, systems
        self.attributable = total if attributable is None else attributable
        self.lane_table, self.lane_rows_for_sys = lane_table, lane_rows_for_sys

    def query(self, sql, p=None):
        low = " ".join(sql.lower().split())
        p = p or {}
        if "from legacy_lineage_lane" in low:
            if not self.lane_table:
                raise RuntimeError("ORA-00942: table or view does not exist")
            if "count(distinct upper(source_system))" in low:
                return [{"n": self.systems}]
            if "count(*)" in low:
                return [{"n": self.attributable}]
            return [{"src_source_table": f"F{i}", "dwh_target_table": f"T{i}",
                     "columns_": 3} for i in range(self.lane_rows_for_sys)]
        if "join legacy_source_file f" in low:
            if "count(distinct upper(f.source_system))" in low:
                return [{"n": self.systems}]
            if "count(*)" in low:
                return [{"n": self.attributable}]
            # the lane's own rows: only what the lossy join could place
            n = min(2, self.attributable)
            return [{"src_source_table": f"F{i}", "dwh_target_table": f"T{i}",
                     "columns_": 3} for i in range(n)]
        if "from legacy_lineage" in low and "count(*)" in low:
            # honour NULL-inclusive scoping: excluding NULLs must not be the
            # thing that shrinks the denominator
            return [{"n": self.total if "is null" in low else self.tagged}]
        return []


def run(fake, system="ADDVANTAGE", ds="PBDW"):
    def safe(sql, params=None):
        try:
            return fake.query(sql, params or {})
        except Exception:                                      # noqa: BLE001
            return []
    M._safe = safe
    C._safe = safe
    return M.lane_scope(system=system, data_source=ds)


# ---- 1. the PBDW regression itself -------------------------------------
# One lane, a lossy route that places only a handful of rows. Filtering on
# this is what deleted sixteen groups.
r = run(Fake(total=2759, tagged=40, systems=1, attributable=42))
ok(r["resolved"] is True, "the question was answerable", r["resolved"])
ok(r["safe_to_filter"] is False,
   "but it is NOT safe to filter on", r["safe_to_filter"])
ok(r["complete"] is False, "because the attribution is partial", r)
ok(r["lineage_rows"] == 2759,
   "and the denominator counts NULL-tagged rows as in the warehouse",
   r["lineage_rows"])
ok("2759" in (r["hint"] or "") and "hide" in (r["hint"] or ""),
   "the hint says what filtering would have hidden", r["hint"])

# ---- 2. one lane is never worth filtering ------------------------------
# Even with a complete attribution: with a single incumbent the warehouse
# IS the lane, so a filter can only subtract.
r = run(Fake(total=2759, tagged=2759, systems=1, attributable=2759))
ok(r["complete"] is True, "attribution can be complete", r["complete"])
ok(r["safe_to_filter"] is False,
   "and a single-lane warehouse still does not filter", r)
ok("one lane" in (r["hint"] or ""), "and says why", r["hint"])

# ---- 3. the case the filter exists for ---------------------------------
# Several lanes, every row placed: excluding one lane's share is then a
# real statement about the other lanes.
r = run(Fake(total=2759, tagged=2759, systems=3, attributable=2759,
             lane_table=True, lane_rows_for_sys=9))
ok(r["safe_to_filter"] is True,
   "multi-lane and complete: the filter is meaningful", r)
ok(r["route"] == "lineage_lane", "and it used the exact route", r["route"])
ok(len(r["target_tables"]) == 9, "with the lane's tables", len(r["target_tables"]))

# a multi-lane warehouse whose attribution is still partial must not filter
r = run(Fake(total=2759, tagged=2759, systems=3, attributable=1800,
             lane_table=True, lane_rows_for_sys=9))
ok(r["safe_to_filter"] is False,
   "multi-lane but partial: still no filter", r["safe_to_filter"])

# ---- 4. nothing attributable at all ------------------------------------
r = run(Fake(total=2759, tagged=0, systems=0, attributable=0))
ok(r["resolved"] is False, "an unanswerable lane is unresolved", r["resolved"])
ok(r["safe_to_filter"] is False, "and never filters", r["safe_to_filter"])
ok("sql/55" in (r["hint"] or ""), "and says how to fix it", r["hint"])

# ---- 5. an empty warehouse divides by nothing --------------------------
r = run(Fake(total=0, tagged=0, systems=0, attributable=0))
ok(r["safe_to_filter"] is False, "an empty warehouse does not filter")
ok(r["complete"] is False, "and is not called complete", r["complete"])

# ---- 6. the scoping fix itself -----------------------------------------
# The denominator must be the NULL-inclusive count. If lane-scope ever goes
# back to `data_source = :ds`, `complete` starts reading true against a
# denominator of 40 and the regression returns wearing a green badge.
seen = []
f = Fake(total=2759, tagged=40, systems=2, attributable=2759)
orig = f.query


def spy(sql, p=None):
    seen.append(" ".join(sql.lower().split()))
    return orig(sql, p)


f.query = spy
run(f)
lineage_counts = [s for s in seen
                  if "from legacy_lineage " in s + " " and "count(*)" in s
                  and "join" not in s and "_lane" not in s]
ok(lineage_counts and all("is null" in s for s in lineage_counts),
   "the warehouse denominator counts untagged rows in", lineage_counts[:1])
ok(all("data_source = :ds or" in s or "l.data_source = :ds or" in s
       for s in seen if "from legacy_lineage" in s and "where" in s
       and "count(distinct upper" not in s),
   "and every lineage read scopes the same way")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nlane-scope filter assertions pass")
sys.exit(1 if BAD else 0)
