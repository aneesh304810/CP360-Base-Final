"""The business rollup has to agree with itself, and with the drill-downs.

WHY IT IS COMPUTED SERVER-SIDE. Four tiles, a stacked bar and two bar
panels all show slices of the same register. A page that sums the same
rows four times will eventually disagree with itself, and a dashboard
that disagrees with its own drill-down is worse than no dashboard. So the
arithmetic lives in one place and is asserted here.

WHO IT WAITS ON IS NOT INVENTED. SEI_VERIFY has no owner column. Only
SEI_DISPOSITION.OWNER and SEI_EXCEPTION.WHO_CAN_ANSWER do, so the owner
breakdown covers exactly the open items that name one and `unowned`
counts the rest. Attributing an unchecked column to the nearest team
would be the same class of mistake as the lane filter that emptied the
Business view.

    python api/test/test_business_summary.py
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
    def __init__(self, verdicts, undecided=0, exceptions=0, draft=0,
                 disp_owners=(), exc_owners=()):
        self.v = verdicts
        self.undecided, self.exceptions, self.draft = undecided, exceptions, draft
        self.disp_owners, self.exc_owners = list(disp_owners), list(exc_owners)

    def query(self, sql, p=None):
        low = " ".join(sql.lower().split())
        if "group by match_verdict" in low:
            return [{"v": k, "n": n} for k, n in self.v.items()]
        if "group by evidence_right" in low:
            return [{"e": "DOCUMENT", "n": sum(self.v.values())}]
        if "from sei_disposition" in low and "group by" in low:
            return [{"who": w, "n": n} for w, n in self.disp_owners]
        if "from sei_exception" in low and "group by" in low:
            return [{"who": w, "n": n} for w, n in self.exc_owners]
        if "from sei_disposition" in low:
            return [{"n": self.undecided}]
        if "from sei_exception" in low:
            return [{"n": self.exceptions}]
        if "from sei_transformation" in low:
            return [{"n": self.draft}]
        return []


def run(fake):
    def safe(sql, params=None):
        try:
            return fake.query(sql, params or {})
        except Exception:                                      # noqa: BLE001
            return []
    M._safe = safe
    C._safe = safe
    return M.business_summary(data_source="IMDS")


V = {"PROVEN_MATCH": 0, "NOT_COMPARABLE": 34, "DECODE_NEEDED": 47,
     "PRECISION_RISK": 52, "TYPE_SHIFT": 35, "UNKNOWN": 263, "NO_SOURCE": 181,
     "OUT_OF_SCOPE": 88, "NO_BASELINE": 41}

r = run(Fake(V, undecided=96, exceptions=23, draft=74,
             disp_owners=[("Fund Accounting", 60), ("Custody Ops", 36)],
             exc_owners=[("Reference Data", 14), ("Fund Accounting", 9)]))

# ---- 1. the numbers the page prints must add up ------------------------
ok(r["scope"]["in_scope"] == 612, "in scope excludes out-of-scope and no-baseline",
   r["scope"]["in_scope"])
ok(r["scope"]["total"] == 741, "the total counts everything, including the excluded",
   r["scope"]["total"])
b = r["buckets"]
ok(sum(b.values()) == r["scope"]["in_scope"],
   "the four buckets partition the in-scope total", [b, r["scope"]["in_scope"]])
ok(r["has_datapoint"] == 612 - 181, "has a datapoint = in scope minus no-source",
   r["has_datapoint"])
ok(b["ready"] + b["diff"] + b["open"] == r["has_datapoint"],
   "and the other three buckets sum to exactly that", b)
ok(sum(d["n"] for d in r["divergence"]) == b["diff"],
   "the divergence bars sum to the divergent bucket",
   [sum(d["n"] for d in r["divergence"]), b["diff"]])

# ---- 2. owners are counted, never attributed ---------------------------
ok([o["owner"] for o in r["owners"]][0] == "Fund Accounting",
   "owners are sorted heaviest first", r["owners"])
ok(sum(o["n"] for o in r["owners"]) == 60 + 36 + 14 + 9,
   "dispositions and exceptions are both counted", r["owners"])
ok(all(o["owner"] != "(no owner named)" for o in r["owners"]),
   "the unowned bucket is not dressed up as a team", r["owners"])
ok(r["unowned"] == b["open"] + (96 + 23 - 119),
   "unowned counts the open items nobody is named against", r["unowned"])
ok(r["unowned"] >= b["open"],
   "which is at least every unchecked column, since SEI_VERIFY names no owner",
   [r["unowned"], b["open"]])

# ---- 3. a verdict nobody has bucketed is counted, not dropped ----------
r2 = run(Fake({**V, "BRAND_NEW_VERDICT": 7}))
ok(sum(r2["buckets"].values()) == r2["scope"]["in_scope"],
   "an unbucketed verdict still lands inside the total", r2["buckets"])
ok(r2["unbucketed"] == [{"verdict": "BRAND_NEW_VERDICT", "n": 7}],
   "and is named, so the bar is never quietly short", r2["unbucketed"])
ok(r2["buckets"]["open"] == V["UNKNOWN"] + 7,
   "it folds into 'not yet checked' rather than into a pass", r2["buckets"]["open"])

# ---- 4. nothing is ready while the ceiling stands ----------------------
ok(r["buckets"]["ready"] == 0, "nothing reads ready", r["buckets"]["ready"])
ok(r["ceiling"], "and the ceiling travels with the payload")

# ---- 5. empty and degenerate registers ---------------------------------
e = run(Fake({}))
ok(e["scope"]["in_scope"] == 0 and e["scope"]["total"] == 0,
   "an empty register is zero everywhere", e["scope"])
ok(e["scored"] is False, "and says it is not scored")
ok(sum(e["buckets"].values()) == 0, "with no phantom counts", e["buckets"])
ok(e["owners"] == [], "and no owners")

x = run(Fake({"OUT_OF_SCOPE": 147}))
ok(x["scope"]["in_scope"] == 0, "a lane that is entirely out of scope scores nothing",
   x["scope"])
ok(x["scored"] is False, "and is not marked scored", x["scored"])
ok(x["has_datapoint"] == 0, "and claims no datapoints", x["has_datapoint"])

# ---- 6. every bucket name the UI reads exists --------------------------
for k in ("ready", "diff", "open", "none"):
    ok(k in r["buckets"], f"bucket {k} is present")
for k in ("unchecked", "undecided", "exceptions", "draft_rules"):
    ok(k in r["open"], f"open.{k} is present")
ok(r["open"]["unchecked"] == b["open"],
   "open.unchecked and the bucket are the same number, not two counts",
   [r["open"]["unchecked"], b["open"]])

print(f"\n{BAD} assertion(s) failed" if BAD else "\nbusiness-summary assertions pass")
sys.exit(1 if BAD else 0)
