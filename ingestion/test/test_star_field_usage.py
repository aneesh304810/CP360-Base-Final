"""The three STAR field usage sheets, parsed from a workbook of the shape
the screenshots show.

WHY IT IS WORTH TESTING. The headers for these were read off a photograph
of a spreadsheet, and several were cut off by the column width -- the
summary sheet's last two columns were visible only as "ELDS". So every
header is matched through a list of spellings, and the parser warns about
any column in the sheet that nothing read. Both of those behaviours are
asserted here, because a column quietly dropped is a number that is just
missing from a screen with nobody to notice.

THE NUMBERS IN THE FIXTURE ARE THE REAL ONES from the summary sheet, and
they matter: two families disagree with the layout side (0 fields against
42, and 73 against 74), which is exactly what the reconciliation sheet
exists to explain. A parser that "helpfully" recomputed the summary from
the matrix would erase that disagreement, so the test pins the declared
values.

    python ingestion/test/test_star_field_usage.py
"""
import logging
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from openpyxl import Workbook                                    # noqa: E402
from ingestion.lane_lineage_conn import (                        # noqa: E402
    SeiCrosswalkConnector, Sheet, _num, _pct)

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class Capture(logging.Handler):
    """What the connector warned about, so the warnings can be asserted
    rather than hoped for."""
    def __init__(self):
        super().__init__()
        self.msgs = []

    def emit(self, rec):
        self.msgs.append(rec.getMessage())


# The delivered headers and the delivered rows.
_NOTE = "Blank Used/Unused value interpreted as Unused."
_DOC = "STAR Used-Unused fields.xlsx"
MATRIX = (["FEED_FAMILY", "FIELD_NAME", "USAGE_STATUS", "MATRIX_VALUE",
           "SOURCE_SHEET", "SOURCE_ROW", "SOURCE_DOCUMENT",
           "NORMALIZED_KEY", "NOTES"], [
    ["ACDDIFI1", "Entity Number", "Used", "Used", "ACDDIFI1", 2, _DOC,
     "ACDDIFI1|ENTITYNUMBER", _NOTE],
    ["ACDDIFI1", "Accounting Basis", "Unused", " ", "ACDDIFI1", 3, _DOC,
     "ACDDIFI1|ACCOUNTINGBASIS", _NOTE],
    ["ACDDIFI1", "Allocation Seq", "Unused", " ", "ACDDIFI1", 4, _DOC,
     "ACDDIFI1|ALLOCATIONSEQ", _NOTE],
    ["ACDDIFI1", "Base Currency Code", "Used", "Used", "ACDDIFI1", 5, _DOC,
     "ACDDIFI1|BASECURRENCYCODE", _NOTE],
    ["PEDDIFI1", "Base Market Value", "Used", "Used", "PEDDIFI1", 11, _DOC,
     "PEDDIFI1|BASEMARKETVALUE", _NOTE],
    # a status nobody anticipated: it must not fold to "unused"
    ["PEDDIFI1", "CPI Index Ratio", "Partially", None, "PEDDIFI1", 12, _DOC,
     "PEDDIFI1|CPIINDEXRATIO", _NOTE],
])

# The real figures. 0/42 and 73/74 are the disagreements the recon explains.
_SNOTE = "Usage is based on the supplied matrix; blank matrix status is Unused."
SUMMARY = (["FEED_FAMILY", "TOTAL_FIELDS", "USED_FIELDS", "UNUSED_FIELDS",
            "USED_PERCENT", "CATALOG_LAYOUT_FIELDS",
            "MATRIX_MATCHED_LAYOUT_FIELDS", "MATRIX_UNMATCHED_LAYOUT_FIELDS",
            "NOTES"], [
    ["ACDDIFI1", 42, 3, 39, 0.071, 42, 42, 0, _SNOTE],   # Excel stores 7.1% as 0.071
    ["CGDEIFI1", 72, 71, 1, "98.6%", 72, 72, 0, _SNOTE],  # ... or as the string
    ["ODDDIFI1", 55, 40, 15, 72.7, 45, 29, 16, _SNOTE],   # ... or as the number
    ["OTDDIFI1", 43, 43, 0, 1.0, 0, 0, 0, _SNOTE],        # 100%
    ["PEDDIFI1", 139, 49, 90, 35.3, 46, 9, 37, _SNOTE],
    ["RGDEIFI1", 73, 35, 38, 47.9, 74, 73, 1, _SNOTE],    # layout > total
    ["SMDDIFI1", 0, 0, 0, None, 42, 0, 42, _SNOTE],       # nothing in the matrix
])

_RDETAIL = ("Field exists in usage matrix but did not match "
            "STAR_LAYOUT_DETAIL by normalized feed and field name.")
RECON = (["RECON_TYPE", "FEED_FAMILY", "FIELD_NAME", "USAGE_STATUS",
          "DETAIL", "SOURCE_DOCUMENT"], [
    ["MATRIX_FIELD_NOT_IN_STAR_LAYOUT", "PEDDIFI1", "Accounting Basis",
     "Unused", _RDETAIL, _DOC],
    ["MATRIX_FIELD_NOT_IN_STAR_LAYOUT", "PEDDIFI1", "Asset Currency",
     "Unused", _RDETAIL, _DOC],
])


def build(sheets, extra_col=False):
    wb = Workbook()
    wb.remove(wb.active)
    for name, (hdr, rows) in sheets.items():
        ws = wb.create_sheet(name)
        if extra_col and name == "STAR_FIELD_USAGE_MATRIX":
            ws.append(hdr + ["REVIEWED_BY"])
            for r in rows:
                ws.append(list(r) + ["ana"])
        else:
            ws.append(hdr)
            for r in rows:
                ws.append(list(r))
    path = os.path.join(tempfile.mkdtemp(), "usage.xlsx")
    wb.save(path)
    return path


def sheets_of(path):
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True, read_only=True)
    return {n: Sheet(wb[n]) for n in wb.sheetnames}


ALL = {"STAR_FIELD_USAGE_MATRIX": MATRIX,
       "STAR_FIELD_USAGE_SUMMARY": SUMMARY,
       "STAR_FIELD_USAGE_RECON": RECON}

cap = Capture()
logging.getLogger("cp.lane_lineage").addHandler(cap)
logging.getLogger("cp.sei_crosswalk").addHandler(cap)
for h in logging.root.handlers[:]:
    pass
logging.getLogger().addHandler(cap)

conn = SeiCrosswalkConnector(xlsx_path="/nonexistent", data_source="IMDS")
sh = sheets_of(build(ALL))

# ---- the matrix ---------------------------------------------------------
print("-- usage matrix")
def by_pre(rows):
    return {r["field_name"]: r for r in rows}


u = conn._usage(sh["STAR_FIELD_USAGE_MATRIX"])
ok(len(u) == 6, "every row parses", len(u))
ok(by_pre(u)["Entity Number"]["normalized_key"] == "ACDDIFI1|ENTITYNUMBER",
   "the workbook's own key is stored as given")
by = {r["field_name"]: r for r in u}
ok(by["Entity Number"]["is_used"] == "Y", "Used -> Y")
ok(by["Accounting Basis"]["is_used"] == "N", "Unused -> N")
ok(by["CPI Index Ratio"]["is_used"] is None,
   "a status nobody anticipated is None, NOT 'not used' -- folding it would "
   "turn a workbook typo into a field that looks out of scope",
   by["CPI Index Ratio"]["is_used"])
ok(by["CPI Index Ratio"]["usage_status"] == "Partially",
   "and the original word is kept so it can be seen",
   by["CPI Index Ratio"]["usage_status"])
ok(by["Entity Number"]["source_row"] == 2, "source_row is a number",
   by["Entity Number"]["source_row"])
ok(by["Entity Number"]["field_norm"] == by["Entity Number"]["field_norm"].upper()
   and " " not in by["Entity Number"]["field_norm"],
   "field_norm is canonicalised the way the crosswalk join expects",
   by["Entity Number"]["field_norm"])
ok(by["Entity Number"]["data_source"] == "IMDS", "stamped with the lane")
# The two normalisations are NOT the same rule, and both are kept: ours
# joins STAR_LAYOUT_FIELD, theirs reproduces their reconciliation.
ok(by["Entity Number"]["field_norm"] == "ENTITY_NUMBER",
   "_norm_code folds the space to an underscore",
   by["Entity Number"]["field_norm"])
ok(by["Entity Number"]["normalized_key"] == "ACDDIFI1|ENTITYNUMBER",
   "the workbook strips it entirely -- a different rule, which is why "
   "both are stored rather than one being derived from the other",
   by["Entity Number"]["normalized_key"])
ok(by["Accounting Basis"]["notes"].startswith("Blank Used/Unused"),
   "the workbook's caveat travels with the row: an Unused that came from "
   "a blank cell is a reading, not a reading of evidence",
   by["Accounting Basis"]["notes"])
ok(by["Accounting Basis"]["is_used"] == "N" and
   by["Accounting Basis"]["matrix_value"] is None,
   "a blank MATRIX_VALUE with USAGE_STATUS=Unused resolves from the "
   "status, and the blank is stored as NULL not as a space",
   by["Accounting Basis"]["matrix_value"])
ids = [r["usage_id"] for r in u]
ok(len(set(ids)) == len(ids), "ids are unique", len(set(ids)))
ok(all(r["feed_family"] in ("ACDDIFI1", "PEDDIFI1") for r in u),
   "the family travels with the row")

# ---- the summary --------------------------------------------------------
print("\n-- summary")
s = conn._usagesum(sh["STAR_FIELD_USAGE_SUMMARY"])
ok(len(s) == 7, "every family parses", len(s))
fam = {r["feed_family"]: r for r in s}
# The percentage is DERIVED from used/total, not read: Sheet.get()
# stringifies every cell, so Excel's 0.071, the text "98.6%" and a bare
# 72.7 are indistinguishable by type, and "1" could be 1% or 100%.
# used/total has no such ambiguity.
ok(fam["ACDDIFI1"]["used_percent"] == 7.14,
   "3 of 42 is 7.14%, whatever the cell said (it said 0.071)",
   fam["ACDDIFI1"]["used_percent"])
ok(fam["CGDEIFI1"]["used_percent"] == 98.61,
   "71 of 72, not the 98.6 in the cell", fam["CGDEIFI1"]["used_percent"])
ok(fam["OTDDIFI1"]["used_percent"] == 100.0,
   "43 of 43 is 100% -- the cell held 1.0, which read alone is 1% or 100% "
   "and nothing in the value says which", fam["OTDDIFI1"]["used_percent"])
ok(fam["SMDDIFI1"]["used_percent"] is None,
   "0 of 0 is unanswerable, not 0% -- 0% is a claim",
   fam["SMDDIFI1"]["used_percent"])

# the disagreements, pinned
ok(fam["SMDDIFI1"]["total_fields"] == 0
   and fam["SMDDIFI1"]["catalog_layout_fields"] == 42,
   "SMDDIFI1: 0 in the matrix, 42 published -- the declared values are "
   "kept, not reconciled away",
   (fam["SMDDIFI1"]["total_fields"], fam["SMDDIFI1"]["catalog_layout_fields"]))
ok(fam["RGDEIFI1"]["catalog_layout_fields"] == 74,
   "RGDEIFI1: 74 published against a declared total of 73",
   fam["RGDEIFI1"]["catalog_layout_fields"])
# matched + unmatched = published, in every family. If that ever fails the
# workbook is not describing the join it says it is.
for f in s:
    a = f["matrix_matched_layout_fields"]
    b = f["matrix_unmatched_layout_fields"]
    c = f["catalog_layout_fields"]
    ok(a + b == c, f"{f['feed_family']}: matched + unmatched = published "
                   f"({a} + {b} = {c})", (a, b, c))
ok(fam["ODDDIFI1"]["matrix_unmatched_layout_fields"] == 16,
   "16 published ODDDIFI1 fields the usage study never reached -- the one "
   "count with no equivalent anywhere else",
   fam["ODDDIFI1"]["matrix_unmatched_layout_fields"])
ok(fam["ACDDIFI1"]["notes"].startswith("Usage is based on"),
   "and the summary's caveat is kept too")
ok(fam["OTDDIFI1"]["unused_fields"] == 0,
   "a real zero survives as 0, not None", fam["OTDDIFI1"]["unused_fields"])
ok(fam["OTDDIFI1"]["catalog_layout_fields"] == 0,
   "including on the layout side", fam["OTDDIFI1"]["catalog_layout_fields"])

# the summary is NOT recomputed from the matrix
ok(fam["PEDDIFI1"]["total_fields"] == 139,
   "PEDDIFI1 declares 139 although the matrix fixture holds 2 rows for it -- "
   "the summary is the workbook speaking, not a recount",
   fam["PEDDIFI1"]["total_fields"])

# ---- the recon ----------------------------------------------------------
print("\n-- recon")
r = conn._usagerecon(sh["STAR_FIELD_USAGE_RECON"])
ok(len(r) == 2, "both rows parse", len(r))
ok(r[0]["recon_type"] == "MATRIX_FIELD_NOT_IN_STAR_LAYOUT",
   "the workbook's own classification is stored as given, not renamed",
   r[0]["recon_type"])
ok("did not match" in (r[0]["detail"] or ""), "the explanation travels with it")
ok(r[0]["source_document"] == _DOC,
   "and so does the document it came from", r[0]["source_document"])
ok(len({x["recon_id"] for x in r}) == 2, "ids are unique")

# ---- a column nobody reads must be reported ----------------------------
print("\n-- unconsumed columns")
cap.msgs.clear()
sh2 = sheets_of(build(ALL, extra_col=True))
conn._usage(sh2["STAR_FIELD_USAGE_MATRIX"])
hit = [m for m in cap.msgs if "nothing reads" in m and "REVIEWEDBY" in m]
ok(bool(hit), "a column the parser does not ask for is named in a warning -- "
   "these headers were read off a photograph, so the one failure that must "
   "not be silent is a column quietly dropped", cap.msgs[-3:])

# ---- absent sheets are not an error ------------------------------------
print("\n-- absent sheets")
for fn in (conn._usage, conn._usagesum, conn._usagerecon):
    ok(fn(None) == [], f"{fn.__name__}(None) is [] -- a workbook without "
                       f"these sheets still loads")

# ---- an empty sheet parses to nothing, loudly --------------------------
empty = build({"STAR_FIELD_USAGE_MATRIX": (["WRONG", "HEADERS"], [["a", "b"]])})
ok(conn._usage(sheets_of(empty)["STAR_FIELD_USAGE_MATRIX"]) == [],
   "headers that match nothing parse to zero rows (the connector logs the "
   "real header row for this case)")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nstar-field-usage assertions pass")
sys.exit(1 if BAD else 0)
