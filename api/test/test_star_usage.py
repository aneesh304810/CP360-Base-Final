"""The STAR field usage endpoints, against a stand-in database.

WHAT THESE GUARD. Three answers that would be wrong in a way nobody
notices, because each one returns a plausible number:

  * a rolled-up percentage that AVERAGES the per-family percentages
    instead of dividing the totals. 100% of a 10-field family and 10% of
    a 190-field one is 14.5% overall, not 55%;
  * a disagreement between the declared total and the matrix rows that
    HAS reconciliation rows behind it -- that is the workbook explaining
    itself -- being reported the same way as one that does not;
  * "how many open crosswalk items are fields nobody reads" answered as
    0 because the join silently matched nothing. SEI_VERIFY has no
    normalised field key, so there is nothing honest to join on, and the
    endpoint has to say so rather than answer.

    python api/test/test_star_usage.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from api.app import routers_sei_crosswalk as R                 # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class DB:
    """Answers the shapes these endpoints ask for, and nothing else."""

    def __init__(self, counts=None, fams=(), recon=()):
        self.counts = counts or {}
        self.fams = list(fams)
        self.recon = list(recon)

    def __call__(self, sql, p=None):
        low = " ".join(sql.lower().split())
        if "from star_field_usage_summary s" in low:
            return self.fams
        if "group by recon_type" in low:
            return [{"recon_type": "MATRIX_FIELD_NOT_IN_STAR_LAYOUT",
                     "n": len(self.recon)}]
        for t, n in self.counts.items():
            if f"from {t} where" in low or low.rstrip().endswith(f"from {t}"):
                return [{"n": n}]
        if "count(*)" in low:
            return [{"n": 0}]
        return []


_orig = R._safe

try:
    # ---- nothing loaded ------------------------------------------------
    print("-- nothing loaded")
    R._safe = DB()
    h = R.star_usage_health()
    ok(h["loaded"] is False, "health reports not loaded", h["loaded"])
    ok("warning" not in h, "and does not invent a disagreement to warn about")
    s = R.star_usage_summary()
    ok(s["families"] == [], "summary is empty rather than an error")
    ok(s["totals"]["used_percent"] is None,
       "no percentage out of nothing -- 0% would be a claim",
       s["totals"]["used_percent"])

    # ---- explained vs unexplained disagreement --------------------------
    print("\n-- declared vs counted")
    R._safe = DB({"star_field_usage": 689, "star_field_usage_summary": 9,
                  "star_field_usage_recon": 5}, [
        {"feed_family": "ACDDIFI1", "declared": 42, "declared_used": 3,
         "counted": 42, "counted_used": 3, "recon_rows": 0},
        {"feed_family": "SMDDIFI1", "declared": 0, "declared_used": 0,
         "counted": 0, "counted_used": 0, "recon_rows": 5},
        {"feed_family": "RGDEIFI1", "declared": 73, "declared_used": 35,
         "counted": 70, "counted_used": 35, "recon_rows": 0},
    ])
    h = R.star_usage_health()
    ok([d["feed_family"] for d in h["disagreements"]] == ["RGDEIFI1"],
       "only the family whose numbers actually differ is listed",
       [d["feed_family"] for d in h["disagreements"]])
    ok(h["disagreements"][0]["explained"] is False, "flagged unexplained")
    ok("RGDEIFI1" in h.get("warning", ""),
       "and named in the warning: a difference WITH recon rows is the "
       "workbook explaining itself, one without is a finding",
       h.get("warning"))

    # ---- the rollup divides, it does not average ------------------------
    print("\n-- rolled-up percentage")
    R._safe = DB({}, [
        {"feed_family": "SMALL", "total_fields": 10, "used_fields": 10,
         "unused_fields": 0, "catalog_layout_fields": 10,
         "matrix_matched_layout_fields": 10,
         "matrix_unmatched_layout_fields": 0},
        {"feed_family": "BIG", "total_fields": 190, "used_fields": 19,
         "unused_fields": 171, "catalog_layout_fields": 190,
         "matrix_matched_layout_fields": 174,
         "matrix_unmatched_layout_fields": 16},
    ])
    t = R.star_usage_summary()["totals"]
    ok(t["used_percent"] == 14.5,
       "29 of 200 is 14.5%. The mean of 100% and 10% is 55%, which weights "
       "a 10-field family the same as a 190-field one", t["used_percent"])
    ok(t["published"] == 200 and t["used"] == 29, "and the totals add up",
       (t["published"], t["used"]))

    # ---- coverage says what it cannot compute ---------------------------
    print("\n-- coverage")
    R._safe = DB({"star_field_usage": 689, "star_layout_field": 434,
                  "star_field_usage_recon": 5})
    c = R.star_usage_coverage()
    ok(c["open_items_on_unused_fields"] is None,
       "with no CONTRACT_KEY populated the figure is None, not a "
       "confident zero -- 'nothing matched' and 'the key was never "
       "written' produce the same count and must not read the same",
       c["open_items_on_unused_fields"])
    ok("sql/66" in c["open_items_note"],
       "and the note names what to run", c["open_items_note"])
    ok("usage_not_in_layout" in c and "layout_not_in_usage" in c,
       "both directions are reported: a field read but not published is a "
       "different finding from one published but never studied")
    ok("declared_layout_not_in_usage" in c,
       "and the workbook's own count of the same thing is returned beside "
       "ours -- it used a different normalisation (FAMILY|FIELDNOSPACES "
       "against _norm_code's ENTITY_NUMBER), so the two can legitimately "
       "disagree and the screen must not have to guess which is right")
    ok("_norm_code" in c["normalisation_note"],
       "with a note saying which rule made which number")
    ok("changes no verdict" in c["note"],
       "and the payload says usage decides nothing")

    # ---- the filters ----------------------------------------------------
    print("\n-- field filters")
    seen = {}

    def spy(sql, p=None):
        seen["sql"] = " ".join(sql.lower().split())
        seen["p"] = p or {}
        return []

    R._safe = spy
    R.star_usage_fields(status="unknown")
    ok("is_used is null" in seen["sql"],
       "unknown is its own bucket -- a usage word nothing recognised must "
       "not be folded into unused, which would make it look out of scope")
    R.star_usage_fields(status="unused")
    ok("is_used = 'n'" in seen["sql"], "unused filters on N")
    R.star_usage_fields(status="used")
    ok("is_used = 'y'" in seen["sql"], "used filters on Y")
    R.star_usage_fields(status="nonsense")
    # is_used is always in the SELECT list; what must be absent is a
    # predicate on it.
    where = seen["sql"].split(" where ", 1)[1]
    ok("is_used" not in where,
       "an unrecognised status filters nothing rather than guessing", where)
    R.star_usage_fields(limit=99999)
    ok(seen["p"]["lim"] == 5000, "limit is capped", seen["p"]["lim"])
    R.star_usage_fields(limit=-5)
    ok(seen["p"]["lim"] == 1,
       "and floored -- Oracle rejects FETCH FIRST with a negative count, "
       "which would 500 the endpoint", seen["p"]["lim"])
    R.star_usage_fields(feed_family="PEDDIFI1")
    ok(seen["p"].get("fam") == "PEDDIFI1", "family filter binds")
finally:
    R._safe = _orig

# ---- the open-items ladder ---------------------------------------------
# Three states that all produce a number and must not be confused:
# matched on the strong key, matched only on the weak one, and never keyed.
print("\n-- open items on unused fields")


class Ladder:
    def __init__(self, strong=0, weak=0, keyed=1, open_items=100):
        self.strong, self.weak = strong, weak
        self.keyed, self.open_items = keyed, open_items

    def __call__(self, sql, p=None):
        low = " ".join(sql.lower().split())
        if "contract_key is not null" in low:
            return [{"n": self.keyed}]
        if "u.normalized_key = v.contract_key" in low:
            return [{"n": self.strong}]
        if "= v.contract_field_key" in low:
            return [{"n": self.weak}]
        if "match_verdict not in" in low:
            return [{"n": self.open_items}]
        if "count(*)" in low:
            return [{"n": 0}]
        return []


_o2 = R._safe
try:
    R._safe = Ladder(strong=37, weak=61)
    c = R.star_usage_coverage()
    ok(c["open_items_on_unused_fields"] == 37,
       "the strong key answers when it can, even though the weak one "
       "would return more", c["open_items_on_unused_fields"])
    ok(c["matched_on"] == "feed_and_field", "and says so", c["matched_on"])
    ok("not subtracted" in c["open_items_note"],
       "the note says it is reported, not applied")

    R._safe = Ladder(strong=0, weak=61)
    c = R.star_usage_coverage()
    ok(c["open_items_on_unused_fields"] == 61, "falls back to the field name")
    ok(c["matched_on"] == "field_only", "and names the weaker rung",
       c["matched_on"])
    ok("field name alone" in c["open_items_note"],
       "with the caveat that it is right only if no two families share a "
       "field name -- a silent fallback would overstate confidence")

    R._safe = Ladder(strong=0, weak=0, keyed=900)
    c = R.star_usage_coverage()
    ok(c["open_items_on_unused_fields"] == 0,
       "keyed and nothing matched is a real zero", 
       c["open_items_on_unused_fields"])
    ok("No open item" in c["open_items_note"], "and reads as good news")

    R._safe = Ladder(strong=0, weak=0, keyed=0)
    c = R.star_usage_coverage()
    ok(c["open_items_on_unused_fields"] is None,
       "never keyed is None, NOT the same zero -- the two are "
       "indistinguishable by count and opposite in meaning",
       c["open_items_on_unused_fields"])
    ok(c["matched_on"] is None, "with no rung claimed")
finally:
    R._safe = _o2

# ---- usage resolved onto the crosswalk grid -----------------------------
# THE JOIN THAT ALMOST DID NOT WORK. SEI_VERIFY.CONTRACT_FIELD carries a
# positional suffix -- Base_Market_Value_10, Trade_Date_128 -- that the
# usage matrix does not. Measured against the delivered rows: 0 of 19
# contract-field parts match as written, 19 of 19 once the trailing
# _<digits> is removed. Without that step the column is blank on every
# row, which reads as "no usage data" rather than "the key did not line
# up" -- so the strip is asserted, and so is the fact that the exact
# match is tried first (the strip is a heuristic and would mangle a field
# genuinely ending in a number).
print("\n-- usage on the grid")

USAGE_ROWS = [
    {"feed_family": "PEDDIFI1", "field_name": "Base Market Value", "is_used": "Y"},
    {"feed_family": "PEDDIFI1", "field_name": "Trade Date Cash", "is_used": "N"},
    {"feed_family": "PEDDIFI1", "field_name": "Local Accrued Interest", "is_used": "N"},
    {"feed_family": "PEDDIFI1", "field_name": "Base Total Unrealized Gain", "is_used": "N"},
    {"feed_family": "PEDDIFI1", "field_name": "Base Total Unrealized Loss", "is_used": "N"},
    {"feed_family": "PEDDIFI1", "field_name": "CPI Index Ratio", "is_used": None},
]

_o3 = R._safe
try:
    R._safe = lambda sql, p=None: (USAGE_ROWS if "star_field_usage" in sql else [])
    fam, fld = R._usage_index("IMDS")

    r = R._resolve_usage("PEDDIFI1", "Base_Market_Value_10", fam, fld)
    ok(r["usage"] == "used", "Base_Market_Value_10 -> used", r["usage"])
    ok(r["usage_matched_on"] == "ordinal_stripped",
       "and the row records that the _10 had to come off", r["usage_matched_on"])

    r = R._resolve_usage("PEDDIFI1", "Base_Market_Value_10,Trade_Date_Cash_136",
                         fam, fld)
    ok(r["usage"] == "mixed",
       "one part read and one not is MIXED -- calling it unused and "
       "dropping the column would lose something somebody reads", r["usage"])

    ok(R._resolve_usage("PEDDIFI1",
                        "Base_Total_Unrealized_Gain_15,Base_Total_Unrealized_Loss_16",
                        fam, fld)["usage"] == "unused",
       "both parts unused is unused")
    ok(R._resolve_usage("PEDDIFI1", "Nothing_Like_This_99", fam, fld)["usage"] is None,
       "no usage row at all is blank, NOT unused")
    ok(R._resolve_usage("PEDDIFI1", "Base_Market_Value_10,Nothing_99",
                        fam, fld)["usage"] == "partial",
       "half an answer is reported as partial, not as the half that answered")
    ok(R._resolve_usage("PEDDIFI1", "CPI_Index_Ratio_12", fam, fld)["usage"]
       == "unknown",
       "a usage word nothing recognised stays unknown")

    # the exact match must win, so a field that really ends in a number is
    # not quietly truncated into a different field
    R._safe = lambda sql, p=None: ([
        {"feed_family": "X", "field_name": "Level 2", "is_used": "Y"},
        {"feed_family": "X", "field_name": "Level", "is_used": "N"}]
        if "star_field_usage" in sql else [])
    fam2, fld2 = R._usage_index("IMDS")
    r = R._resolve_usage("X", "Level_2", fam2, fld2)
    ok(r["usage"] == "used" and r["usage_matched_on"] == "exact",
       "a field genuinely ending in a number matches exactly and is NOT "
       "stripped down to a different field", (r["usage"], r["usage_matched_on"]))

    # and the whole-grid report
    R._safe = lambda sql, p=None: (USAGE_ROWS if "star_field_usage" in sql else [])
    grid = [{"contract_feed": "PEDDIFI1", "contract_field": "Base_Market_Value_10"},
            {"contract_feed": "PEDDIFI1", "contract_field": "Nothing_99"}]
    rep = R._attach_usage("IMDS", grid)
    ok(rep["matched"] == 1 and rep["unmatched"] == 1,
       "the grid reports how many rows got an answer", rep)
    ok("_<number>" in (rep.get("note") or ""),
       "and says so when every match needed the ordinal removed",
       rep.get("note"))

    R._safe = lambda sql, p=None: []
    grid = [{"contract_feed": "PEDDIFI1", "contract_field": "Base_Market_Value_10"}]
    rep = R._attach_usage("IMDS", grid)
    ok(rep["loaded"] is False and grid[0]["usage"] is None,
       "with nothing loaded the cells are blank and the grid says WHY -- "
       "'no usage column' and 'usage not loaded' look identical otherwise",
       rep)
    ok("sql/65" in (rep.get("note") or ""), "naming what to run", rep.get("note"))
finally:
    R._safe = _o3

print(f"\n{BAD} assertion(s) failed" if BAD else "\ngrid-usage assertions pass")
sys.exit(1 if BAD else 0)
