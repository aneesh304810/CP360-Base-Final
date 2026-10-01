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
       "the figure that needs a key SEI_VERIFY does not have comes back "
       "None, not a confident zero", c["open_items_on_unused_fields"])
    ok("CONTRACT_FIELD_NORM" in c["open_items_note"],
       "and the note names the change that would enable it")
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

print(f"\n{BAD} assertion(s) failed" if BAD else "\nstar-usage API assertions pass")
sys.exit(1 if BAD else 0)
