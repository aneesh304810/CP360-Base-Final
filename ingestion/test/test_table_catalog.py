"""The table catalogue rides the dictionary workbook, not the dictionary table.

WHY A THIRD SHEET AND NOT MORE ROWS IN "ALL". legacy_dictionary's grain is
one row per SOURCE FIELD -- dict_key is system:field_code_norm:master,
field_code_norm is NOT NULL and in the primary key, and source_system holds
ADDVANTAGE / CRD / STAR. A warehouse table has neither a field code nor a
legacy source system, so a table row there means inventing both, and then
/systems reports PBDW as a legacy source with 176 assets, /dictionary lists
tables among field definitions, and /business-def looks them up by a code
they do not have. One table, two meanings, six consumers disagreeing about
which: the shape of the bug that emptied the Business view this week.

So the rows go to business_catalog and the workbook stays one workbook --
same file, same ingest step, same command, one more sheet.

    python ingestion/test/test_table_catalog.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import openpyxl                                                # noqa: E402
from ingestion.legacy_dictionary_conn import (                 # noqa: E402
    LegacyDictionaryConnector, CATALOG_HEADERS)

BAD = 0
TMP = os.environ.get("TMPDIR", "/tmp")


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


CAT_HDR = ["Table", "Business Name", "Business Description", "Grain",
           "Functional Group", "Is History", "Is Staging", "Confidence",
           "Review Status", "Reviewed By"]
CAT_ROWS = [
    ["DIM_IP_REL_REMIT_BLOCKS", "Remittance Blocks",
     "Party relationships whose payments are currently blocked, and why.",
     "one row per relationship per remittance block",
     "Interested Parties & Relationships", "N", "N", "high", "DRAFT", ""],
    ["DIM_ACCOUNT_UD_HIST", "Account User-Defined Fields — History",
     "Previous values of those extra account attributes.",
     "one row per account per field per change",
     "Account Master & Reference Data", "Y", "N", "high", "REVIEWED", "a.nair"],
    ["FACT_CP_HOLDINGS_TEMP", "Holdings — Staging",
     "The holdings load in progress. Not a reporting table.",
     "one row per account per security, current batch",
     "Positions & Holdings", "N", "Y", "high", "DRAFT", ""],
]


def book(path, *, catalog=True, cat_title="TABLE CATALOG", rich=False,
         cat_hdr=None, extra=()):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ALL"
    ws.append(["AddVantage Master Dictionary"])           # title row
    ws.append(["ADDV Field", "ADDV Name", "Group", "Master", "Description"])
    ws.append(["BI/2-1", "Interested Party Number", "Basic Information",
               "Interested Party Master", "The number BBH assigns."])
    lin = wb.create_sheet("DWH ALL")
    lin.append(["DWH Target Table", "DWH Target Column",
                "SRC Source Table", "SRC Source Column"])
    lin.append(["DIM_IP_REL_REMIT_BLOCKS", "INTERESTED_PARTY_NUMBER",
                "Addv-MSTR-IPN", "BI/2-1"])
    if rich:
        r = wb.create_sheet("RICH")
        r.append(["Functional_Group", "DWH Target Table", "DWH Target Column",
                  "SRC Source Table", "SRC Source Column"])
        r.append(["Positions & Holdings", "FACT_CP_HOLDINGS", "QTY",
                  "PEDDIFI1", "Quantity_98"])
    if catalog:
        c = wb.create_sheet(cat_title)
        c.append(cat_hdr or CAT_HDR)
        for row in CAT_ROWS:
            c.append(row)
        for row in extra:
            c.append(row)
    wb.save(path)
    return path


def parse(path, **kw):
    return LegacyDictionaryConnector(
        [("ADDVANTAGE", path, "PBDW")], load_lineage=True, **kw).parse()


# ---- 1. the three sheets coexist ---------------------------------------
b = parse(book(f"{TMP}/tc_basic.xlsx"))
ok(len(b["dict"]) == 1, "the dictionary sheet still parses", len(b["dict"]))
ok(len(b["lineage"]) == 1, "the lineage sheet still parses", len(b["lineage"]))
ok(len(b["catalog"]) == 3, "and the catalogue sheet is read", len(b["catalog"]))
by = {r["table_name"]: r for r in b["catalog"]}
ok(by["DIM_IP_REL_REMIT_BLOCKS"]["business_name"] == "Remittance Blocks",
   "the business name survives")
ok(by["DIM_IP_REL_REMIT_BLOCKS"]["suggested_group"]
   == "Interested Parties & Relationships", "the group survives")
ok(by["DIM_ACCOUNT_UD_HIST"]["is_history"] == "Y", "the history flag survives")
ok(by["FACT_CP_HOLDINGS_TEMP"]["is_staging"] == "Y", "the staging flag survives")
ok(all(r["data_source"] == "PBDW" for r in b["catalog"]),
   "every row is tagged with the warehouse")
ok(all(r["source_of_text"] == "WORKBOOK" for r in b["catalog"]),
   "provenance says the workbook, not a generated seed")

# ---- 2. a review survives a reload -------------------------------------
# The workbook is where people edit, so REVIEW_STATUS travels with the row
# instead of being inferred. A reviewed line stays reviewed.
ok(by["DIM_ACCOUNT_UD_HIST"]["review_status"] == "REVIEWED",
   "a reviewed row keeps its status", by["DIM_ACCOUNT_UD_HIST"]["review_status"])
ok(by["DIM_ACCOUNT_UD_HIST"]["reviewed_by"] == "a.nair", "and its reviewer")
ok(by["DIM_IP_REL_REMIT_BLOCKS"]["review_status"] == "DRAFT",
   "an unreviewed row stays draft")

# ---- 3. a sheet people edit by hand ------------------------------------
messy = [
    list(CAT_ROWS[0]),                                   # duplicate
    [],                                                  # blank line
    ["", "Orphan", "no table name", "", "", "", "", "", "", ""],
    ["dim_office", "Office", "BBH offices, used to roll figures up by location.",
     "one row per office", "Reference Data", "no", "NO", "WILD", "", ""],
]
b = parse(book(f"{TMP}/tc_messy.xlsx", extra=messy))
names = [r["table_name"] for r in b["catalog"]]
ok(len(names) == len(set(names)), "a duplicated line is collapsed, not doubled", names)
ok("DIM_OFFICE" in names, "a lower-case table name is upper-cased", names)
ok(not any(r["business_name"] == "Orphan" for r in b["catalog"]),
   "a row with no table name is skipped")
off = [r for r in b["catalog"] if r["table_name"] == "DIM_OFFICE"][0]
ok(off["is_history"] == "N" and off["is_staging"] == "N",
   "'no' and 'NO' both normalise to N", [off["is_history"], off["is_staging"]])
ok(off["confidence"] == "med", "an unrecognised confidence falls back to med",
   off["confidence"])

# ---- 4. two auto-detectors must not claim one sheet --------------------
# The catalogue carries Functional Group per table, and so does the rich
# lineage sheet. Matching on that column alone made the rich detector pick
# up the catalogue; it now also requires a target COLUMN, which is the grain
# that makes a sheet lineage rather than a list of tables.
b = parse(book(f"{TMP}/tc_rich.xlsx", rich=True))
ok(len(b["catalog"]) == 3, "the catalogue is still found beside a rich sheet",
   len(b["catalog"]))
ok(any(r.get("dwh_target_table") == "FACT_CP_HOLDINGS" for r in b["lineage"]),
   "and the rich sheet is still read as lineage")
ok(not any(r["table_name"] == "POSITIONS & HOLDINGS" for r in b["catalog"]),
   "no lineage row leaks in as a table description")

b = parse(book(f"{TMP}/tc_noc.xlsx", catalog=False, rich=True))
ok(b["catalog"] == [], "a rich sheet alone yields no table descriptions", b["catalog"])

# ---- 5. an older workbook, unchanged -----------------------------------
b = parse(book(f"{TMP}/tc_old.xlsx", catalog=False))
ok(b["catalog"] == [], "a workbook with no catalogue sheet loads clean")
ok(len(b["dict"]) == 1 and len(b["lineage"]) == 1,
   "and everything it did carry still loads")

# ---- 6. the sheet may be named anything --------------------------------
b = parse(book(f"{TMP}/tc_named.xlsx", cat_title="Business Names"))
ok(len(b["catalog"]) == 3, "auto-detected under another sheet name",
   len(b["catalog"]))
b = LegacyDictionaryConnector([("ADDVANTAGE", f"{TMP}/tc_named.xlsx", "PBDW")],
                              catalog_sheet="Business Names").parse()
ok(len(b["catalog"]) == 3, "or named explicitly", len(b["catalog"]))
b = LegacyDictionaryConnector([("ADDVANTAGE", f"{TMP}/tc_named.xlsx", "PBDW")],
                              catalog_sheet="Nope").parse()
ok(b["catalog"] == [], "a named sheet that is absent is not guessed at")

# ---- 7. header wording people actually use -----------------------------
alt = ["Warehouse Table", "Friendly Name", "Definition", "Granularity",
       "Business Group", "History", "Temp", "Certainty", "Status", "Owner"]
b = parse(book(f"{TMP}/tc_alt.xlsx", cat_hdr=alt))
ok(len(b["catalog"]) == 3, "alternative header wording resolves", len(b["catalog"]))
ok(b["catalog"][0]["business_name"] == "Remittance Blocks",
   "and lands in the right column", b["catalog"][0]["business_name"])
ok(all(k in CATALOG_HEADERS for k in
       ("table_name", "business_name", "description", "grain", "group_name")),
   "the alias table covers every column the parser reads")

print(f"\n{BAD} assertion(s) failed" if BAD else "\ntable-catalogue assertions pass")
sys.exit(1 if BAD else 0)
