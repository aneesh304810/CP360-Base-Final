"""The seven mapping-document sheets and the two rebuilt summaries, parsed
from a workbook with the published headers.

WHY. The headers below are the ones the v2 workbook publishes
(STAR_IMDS_SEI_Lineage_Catalog_v2_Transformations-Usage-Matrix). Every
one is matched by name; a sheet that parses to nothing is the quietest
failure there is, so each sheet is asserted to land, with its grain, its
key and the one or two readings the screens depend on: the E2E link
class, the layout check, the TOTAL row kept out of the family list, the
code marked UNKNOWN counted as unmapped.

Rows are synthetic. No production values.

    python ingestion/test/test_mapping_docs_parse.py
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from openpyxl import Workbook                                    # noqa: E402
from ingestion.lane_lineage_conn import SeiCrosswalkConnector    # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


WHERE = ["SOURCE_DOCUMENT", "SOURCE_SHEET", "SOURCE_ROW"]
SHEETS = {
    "LANE_REGISTER": (["LANE_ID", "SOURCE_SYSTEM", "DATA_SOURCE", "REPLACEMENT_STATE", "SUCCESSOR_SYSTEM", "CONTRACT_NAME", "NOTES"],
                      [["STAR_IMDS", "STAR", "IMDS", "REPLACED", "SEI", "STAR-compatible", ""]]),
    "STAR_LAYOUT_DETAIL": (["FEED_FAMILY", "ORDINAL", "FIELD_NAME", "PUBLISHED_TYPE", "PUBLISHED_LENGTH", "PUBLISHED_FORMAT", "DESCRIPTION", "SOURCE_DOCUMENT", "EVIDENCE_STATUS"],
                           [["PEDDIFI1", 1, "Entity Number", "CHAR", "20", "", "", "layouts.pdf", "DOCUMENT"],
                            ["PEDDIFI1", 2, "Lot Quantity", "NUM", "18", "", "", "layouts.pdf", "DOCUMENT"]]),
    "MAPPING_SOURCE_REGISTER": (["FEED_FAMILY", "SOURCE_DOCUMENT", "SEI_TO_STAR_ROWS", "SEI_TO_STAR_MAPPED", "OPEN_DEPENDENCIES",
                                 "IMDS_TARGET_OBJECTS", "IMDS_STAGE_ROWS", "NEW_COMPARISON_ROWS", "ALREADY_IN_CATALOG"],
                                [["PEDDIFI1", "Portfolio_Valuation_Mapping.xlsx", 3, 2, 1, "HOLDINGDBO.POSITION;HOLDINGDBO.LOT_LEVEL_POSITION", 2, 2, 161],
                                 ["ODDDIFI1", "Open_Dividends_Mapping.xlsx", 1, 0, 0, "HOLDINGDBO.BBH_OPEN_DIVIDENDS", 1, 1, 0]]),
    "SEI_TO_STAR_FIELD_MAP": (["MAP_ID", "LANE_ID", "LAYER", "FEED_FAMILY", "STAR_FIELD", "BUSINESS_DESCRIPTION", "DOC_USAGE_STATUS",
                               "SEI_SOURCE_OBJECT", "SEI_SOURCE_FIELD", "SEI_TYPE", "SEI_NULLABLE", "JOIN_TRANSFORMATION_LOGIC",
                               "MAP_KIND", "OPEN_DEPENDENCY", "NOTES", "MAPPING_STATUS", "APPROVAL_STATUS"] + WHERE,
                              [["S2S-PEDDIFI1-a1", "STAR_IMDS", "SEI_TO_STAR", "PEDDIFI1", "Entity Number", "The account", "Used",
                                "Account", "SWP_ACCOUNT_NUMBER", "VARCHAR(14)", "N", "", "DIRECT", "N", "", "CANDIDATE", "DRAFT_REVIEW_REQUIRED",
                                "Portfolio_Valuation_Mapping.xlsx", "POSITION_DETAIL", 12],
                               ["S2S-PEDDIFI1-b2", "STAR_IMDS", "SEI_TO_STAR", "PEDDIFI1", "Lot Quantity", "Units", "Used",
                                "Taxlot", "QUANTITY", "NUMBER(28,12)", "N", "TAXLOT_TYPE_CODE = 2", "DERIVED", "Y", "confirm with SEI",
                                "BUSINESS_DECISION_REQUIRED", "DRAFT_REVIEW_REQUIRED", "Portfolio_Valuation_Mapping.xlsx", "POSITION_DETAIL", 13],
                               ["S2S-PEDDIFI1-c3", "STAR_IMDS", "SEI_TO_STAR", "PEDDIFI1", "Ghost Field", "", "NOT_STATED",
                                "", "", "", "", "", "NO_MAPPING", "N", "", "NO_SEI_SOURCE", "DRAFT_REVIEW_REQUIRED",
                                "Portfolio_Valuation_Mapping.xlsx", "POSITION_DETAIL", 14]]),
    "STAR_TO_IMDS_STAGE_MAP": (["FEED_FAMILY", "TARGET_OBJECT", "TARGET_ATTRIBUTE", "TARGET_TYPE", "TARGET_NULLABLE", "STAR_FIELD",
                                "UPLOADER_COLUMN", "IM_LOGIC", "SEI_EQUIV_LOGIC", "SEI_SOURCE_OBJECT", "SEI_SOURCE_FIELD", "SEI_JOIN_LOGIC",
                                "REMARKS", "COMPARISON_ID", "EVIDENCE_COMPLETENESS", "BUSINESS_DECISION_FLAG"] + WHERE,
                               [["PEDDIFI1", "HOLDINGDBO.POSITION", "QUANTITY", "NUMBER(28,12)", "No", "Lot Quantity", "",
                                 "SUM(lot_qty)", "SUM(Taxlot.QUANTITY) -- ALT: Position.QUANTITY", "Taxlot", "QUANTITY", "TAXLOT_TYPE_CODE = 2",
                                 "", "CMP-POS-001", "BOTH_LOGICS_DOCUMENTED", "N", "Portfolio_Valuation_Mapping.xlsx", "POSITION_DETAIL", 13],
                                ["ODDDIFI1", "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "ENTITY_ID", "CHAR(8 BYTE)", "No", "Entity Number", "",
                                 "substr(entity, 1, 8)", "", "", "", "", "decision open", "CMP-DIV-001", "IM_ONLY_DOCUMENTED", "Y",
                                 "Open_Dividends_Mapping.xlsx", "DIVIDENDS", 4]]),
    "SEI_STAR_IMDS_E2E_XWALK": (["FEED_FAMILY", "SEI_SOURCE", "SEI_TO_STAR_MAP_KIND", "SEI_TO_STAR_LOGIC", "STAR_FIELD",
                                 "IMDS_TARGET_OBJECT", "IMDS_TARGET_ATTRIBUTE", "STAR_TO_IMDS_LOGIC", "SEI_TO_IMDS_EQUIV_LOGIC",
                                 "LINK_STATUS", "CROSSWALK_STATUS", "SOURCE_DOCUMENT"],
                                [["PEDDIFI1", "Taxlot.QUANTITY", "DERIVED", "TAXLOT_TYPE_CODE = 2", "Lot Quantity", "HOLDINGDBO.POSITION", "QUANTITY",
                                  "SUM(lot_qty)", "SUM(Taxlot.QUANTITY)", "E2E_LINKED", "CANDIDATE", "Portfolio_Valuation_Mapping.xlsx"],
                                 ["PEDDIFI1", "Account.SWP_ACCOUNT_NUMBER", "DIRECT", "", "", "HOLDINGDBO.POSITION", "ENTITY_ID",
                                  "", "Account.SWP_ACCOUNT_NUMBER", "DIRECT_SEI_TO_IMDS", "CANDIDATE", "Portfolio_Valuation_Mapping.xlsx"],
                                 ["PEDDIFI1", "", "", "", "Phantom Field", "HOLDINGDBO.POSITION", "COST_BASIS",
                                  "to_number(cost)", "", "STAR_FIELD_NOT_IN_FILE_MAP", "GAP", "Portfolio_Valuation_Mapping.xlsx"],
                                 ["ODDDIFI1", "", "", "", "Entity Number", "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "ENTITY_ID",
                                  "substr(entity, 1, 8)", "", "NO_SEI_SOURCE", "GAP", "Open_Dividends_Mapping.xlsx"],
                                 ["ODDDIFI1", "Transaction_Header.TRADE_DATE", "DIRECT", "", "Trade Date", "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "TRADE_DT",
                                  "to_date(x)", "TRADE_DATE", "", "CANDIDATE", "Open_Dividends_Mapping.xlsx"]]),
    "REFERENCE_CODE_XWALK": (["CODE_SET_NAME", "SIDE", "CODE_VALUE", "CODE_DESCRIPTION", "MAPS_TO_SIDE", "MAPS_TO_CODE",
                              "MAPS_TO_DESCRIPTION", "MAPPING_RULE"] + WHERE,
                             [["BBH_TRANSACTION_CODE", "STAR", "BUY", "Buy", "SEI", "PURCHASE", "Purchase", "LOOKUP", "Codes.xlsx", "TXN", 2],
                              ["BBH_TRANSACTION_CODE", "STAR", "XFR", "Transfer", "SEI", "UNKNOWN", "", "LOOKUP", "Codes.xlsx", "TXN", 3],
                              ["ASSET_TYPE", "SEI", "EQ", "Equity", "STAR", "", "", "MEMBERS_ONLY", "Codes.xlsx", "ASSET", 2]]),
    "ENTITY_ID_DERIVATION": (["FEED_FAMILY", "STEP", "LEGACY_IMDS_LOGIC", "LOGIC_COMMENT", "SEI_MIGRATION_RULE"] + WHERE,
                             [["ODDDIFI1", 1, "v_entity_number := substr(p_rec.entity, 1, 8);", "first eight", "Account Optional Field 3",
                               "Open_Dividends_Mapping.xlsx", "LOGIC", 5],
                              ["ODDDIFI1", 2, "if v_entity_number is null then v_entity_number := p_rec.acct; end if;", "fallback",
                               "SWP Account Number", "Open_Dividends_Mapping.xlsx", "LOGIC", 6]]),
    "USAGE_RECON_EXCEPTIONS": (["FEED_FAMILY", "FIELD_NAME", "MATRIX_USAGE", "MAPPING_DOC_USAGE", "SEI_SOURCE_MAPPED", "RESULT",
                                "SOURCE_DOCUMENT", "SOURCE_ROW"],
                               [["PEDDIFI1", "Entity Number", "Used", "Used", "N", "USED_BUT_UNMAPPED", "Portfolio_Valuation_Mapping.xlsx", 12],
                                ["PEDDIFI1", "Lot Quantity", "Unused", "Used", "Y", "UNUSED_BUT_MAPPED", "Portfolio_Valuation_Mapping.xlsx", 13],
                                ["ODDDIFI1", "Pay Date", "Used", "Unused", "Y", "CONFLICT", "Open_Dividends_Mapping.xlsx", 9]]),
    "STAR_FIELD_USAGE_MATRIX": (["FEED_FAMILY", "FIELD_NAME", "USAGE_STATUS", "MATRIX_VALUE", "SOURCE_SHEET", "SOURCE_ROW", "SOURCE_DOCUMENT",
                                 "NORMALIZED_KEY", "NOTES", "MAPPING_DOC_USAGE", "SEI_SOURCE_MAPPED", "USAGE_RECON_RESULT", "MAPPING_DOC"],
                                [["PEDDIFI1", "Entity Number", "Used", "x", "usage", 2, "usage.xlsx", "PEDDIFI1|ENTITYNUMBER", "",
                                  "Used", "N", "USED_BUT_UNMAPPED", "Portfolio_Valuation_Mapping.xlsx"],
                                 ["PEDDIFI1", "Lot Quantity", "Unused", "", "usage", 3, "usage.xlsx", "PEDDIFI1|LOTQUANTITY", "",
                                  "Used", "Y", "UNUSED_BUT_MAPPED", "Portfolio_Valuation_Mapping.xlsx"],
                                 ["PEDDIFI1", "New Field", "Used", "", "", None, "", "PEDDIFI1|NEWFIELD", "",
                                  "Used", "Y", "ADDED_FROM_MAPPING_DOC", "Portfolio_Valuation_Mapping.xlsx"]]),
    "STAR_FIELD_USAGE_SUMMARY": (["FEED_FAMILY", "TOTAL_FIELDS", "USED_FIELDS", "UNUSED_FIELDS", "USED_PERCENT", "SEI_MAPPED_FIELDS",
                                  "SEI_MAPPED_PERCENT", "USED_BUT_UNMAPPED", "USAGE_CONFLICTS", "ADDED_FROM_MAPPING_DOC", "MAPPING_DOC", "NOTES"],
                                 [["PEDDIFI1", 3, 2, 1, 66.67, 2, 66.67, 1, 0, 1, "Portfolio_Valuation_Mapping.xlsx", ""],
                                  ["ODDDIFI1", 10, 4, 6, 40, 3, 30, 1, 1, 0, "Open_Dividends_Mapping.xlsx", ""],
                                  ["TOTAL", 13, 6, 7, 46.15, 5, 38.46, 2, 1, 1, "", ""]]),
    "TRANSFORMATION_SUMMARY": (["TARGET_OBJECT", "TARGET_ROWS", "BOTH_LOGICS_DOCUMENTED", "IM_LOGIC_AND_SEI_SOURCE_DOCUMENTED",
                                "SEI_ONLY_DOCUMENTED", "IM_ONLY_DOCUMENTED", "NO_MAPPING", "SEI_COVERAGE_PERCENT", "APPROVAL_STATE"],
                               [["HOLDINGDBO.POSITION", 2, 1, 0, 0, 1, 0, 0.5, "DRAFT_REVIEW_REQUIRED"],
                                ["TOTAL", 2, 1, 0, 0, 1, 0, 0.5, "DRAFT_REVIEW_REQUIRED"]]),
    "STAR_FEED": (["FEED_NAME", "FEED_FAMILY", "DATASET", "SUBJECT_AREA", "GRAIN", "FREQUENCY", "LOAD_BEHAVIOUR", "KEY_FIELDS",
                   "LAYOUT_AVAILABLE", "EVIDENCE", "SOURCE_DOC", "NOTES"],
                  [["OTDDIFI1", "OTDDIFI1", "Open Trades", "Trades", "trade", "daily", "replace", "ACCT", "Y", "FEED_WORKBOOK", "layouts.pdf",
                    "target TRADESDBO.BBH_OPEN_TRADE_STAR"]]),
}


def build(path):
    wb = Workbook()
    wb.remove(wb.active)
    for name, (hdr, rows) in SHEETS.items():
        ws = wb.create_sheet(name[:31])
        ws.append(hdr)
        for r in rows:
            ws.append(r + [None] * (len(hdr) - len(r)))
    wb.save(path)


with tempfile.TemporaryDirectory() as d:
    path = os.path.join(d, "v2.xlsx")
    build(path)
    conn = SeiCrosswalkConnector(xlsx_path=path, data_source="IMDS")
    parsed = conn.parse()

print("-- every new sheet lands, at its grain")
for role, n in (("mapsrc", 2), ("seistar", 3), ("starstage", 2), ("e2e", 5), ("refcode", 3), ("entityid", 2), ("usageexc", 3)):
    ok(len(parsed.get(role) or []) == n, f"{role:<9} parsed {n} rows", len(parsed.get(role) or []))

print("-- the register")
reg = {r["feed_family"]: r for r in parsed["mapsrc"]}
ok(reg["PEDDIFI1"]["sei_star_rows"] == 3 and reg["PEDDIFI1"]["already_in_catalog"] == 161 and reg["PEDDIFI1"]["source_document"].endswith(".xlsx"),
   "a register row keeps its counts and its document", reg["PEDDIFI1"])
ok(reg["PEDDIFI1"]["source_id"] == "IMDS:PEDDIFI1" and reg["PEDDIFI1"]["imds_targets"].count(";") == 1, "keyed by the lane and the feed; targets kept ; separated")

print("-- SEI -> STAR")
s2s = {r["star_field"]: r for r in parsed["seistar"]}
ok(s2s["Entity Number"]["map_row_id"] == "IMDS:S2S-PEDDIFI1-a1", "the sheet's MAP_ID is the key, prefixed with the lane", s2s["Entity Number"]["map_row_id"])
ok(s2s["Lot Quantity"]["sei_object"] == "Taxlot" and s2s["Lot Quantity"]["join_logic"] == "TAXLOT_TYPE_CODE = 2"
   and s2s["Lot Quantity"]["open_dependency"] == "Y" and s2s["Lot Quantity"]["mapping_status"] == "BUSINESS_DECISION_REQUIRED",
   "the SEI source, the join logic, the open dependency and the mapping status land", s2s["Lot Quantity"])
ok(s2s["Entity Number"]["star_in_layout"] == "Y" and s2s["Ghost Field"]["star_in_layout"] == "N",
   "each STAR field is checked against STAR_LAYOUT_DETAIL from the same workbook", [s2s[k]["star_in_layout"] for k in ("Entity Number", "Ghost Field")])
ok(s2s["Ghost Field"]["sei_field"] is None and s2s["Ghost Field"]["map_kind"] == "NO_MAPPING" and s2s["Ghost Field"]["approval_status"] == "DRAFT_REVIEW_REQUIRED",
   "a row with no SEI source is kept, as NO_MAPPING, draft")
ok(s2s["Entity Number"]["source_row"] == 12 and s2s["Entity Number"]["source_sheet"] == "POSITION_DETAIL", "where the row came from")

print("-- STAR -> IMDS")
stg = {r["imds_column"]: r for r in parsed["starstage"]}
ok(stg["QUANTITY"]["imds_table"] == "HOLDINGDBO.POSITION" and stg["QUANTITY"]["im_logic"] == "SUM(lot_qty)"
   and "-- ALT:" in stg["QUANTITY"]["sei_equiv_logic"] and stg["QUANTITY"]["comparison_id"] == "CMP-POS-001",
   "the legacy logic, both SEI versions and the comparison id land", stg["QUANTITY"])
ok(stg["ENTITY_ID"]["evidence_completeness"] == "IM_ONLY_DOCUMENTED" and stg["ENTITY_ID"]["business_decision"] == "Y",
   "the new completeness value and the decision flag are stored as given")

print("-- end to end")
e2e = {(r["imds_column"], r["star_field"] or ""): r for r in parsed["e2e"]}
ok(e2e[("QUANTITY", "Lot Quantity")]["link_class"] == "E2E" and e2e[("QUANTITY", "Lot Quantity")]["link_status"] == "E2E_LINKED",
   "E2E_LINKED is the E2E class, the sheet's word kept beside it")
ok(e2e[("ENTITY_ID", "")]["link_class"] == "SEI_DIRECT", "DIRECT_SEI_TO_IMDS is SEI_DIRECT")
ok(e2e[("COST_BASIS", "Phantom Field")]["link_class"] == "STAR_NOT_IN_FILE_MAP" and e2e[("COST_BASIS", "Phantom Field")]["star_in_layout"] == "N",
   "a STAR field the layout does not publish is its own class, and the layout check says so")
ok(e2e[("ENTITY_ID", "Entity Number")]["link_class"] == "NO_SEI_SOURCE" and e2e[("ENTITY_ID", "Entity Number")]["crosswalk_status"] == "GAP", "NO_SEI_SOURCE, a GAP")
ok(e2e[("TRADE_DT", "Trade Date")]["link_class"] == "E2E" and e2e[("TRADE_DT", "Trade Date")]["link_status"] is None,
   "a row without LINK_STATUS is classed by its ends", e2e[("TRADE_DT", "Trade Date")]["link_class"])
ok(e2e[("QUANTITY", "Lot Quantity")]["sei_object"] == "Taxlot" and e2e[("QUANTITY", "Lot Quantity")]["sei_field"] == "QUANTITY",
   "SEI_SOURCE Object.Field is split")

print("-- reference codes")
rc = {(r["code_set_name"], r["code_value"]): r for r in parsed["refcode"]}
ok(rc[("BBH_TRANSACTION_CODE", "BUY")]["is_mapped"] == "Y" and rc[("BBH_TRANSACTION_CODE", "XFR")]["is_mapped"] == "N",
   "UNKNOWN is unmapped; a code is mapped")
ok(rc[("ASSET_TYPE", "EQ")]["mapping_rule"] == "MEMBERS_ONLY" and rc[("ASSET_TYPE", "EQ")]["side"] == "SEI", "rule and side as written")

print("-- entity id")
st = parsed["entityid"]
ok([s["seq"] for s in st] == [1, 2] and st[0]["legacy_logic"].startswith("v_entity_number") and st[0]["sei_rule"] == "Account Optional Field 3",
   "steps in order, legacy PL/SQL beside the SEI rule", st)

print("-- usage exceptions")
ex = {r["field_name"]: r for r in parsed["usageexc"]}
ok(ex["Entity Number"]["result"] == "USED_BUT_UNMAPPED" and ex["Entity Number"]["sei_source_mapped"] == "N", "USED_BUT_UNMAPPED as written")
ok(ex["Lot Quantity"]["result"] == "UNUSED_BUT_MAPPED" and ex["Pay Date"]["result"] == "CONFLICT", "the other two results")

print("-- the matrix's four new columns and the rebuilt summary")
u = {r["field_name"]: r for r in parsed["usage"]}
ok(u["Entity Number"]["doc_usage_status"] == "Used" and u["Entity Number"]["sei_mapped"] == "N"
   and u["Entity Number"]["usage_check"] == "USED_BUT_UNMAPPED" and u["Entity Number"]["mapping_document"].endswith(".xlsx"),
   "columns J-M land on the usage row", u["Entity Number"])
ok(u["New Field"]["usage_check"] == "ADDED_FROM_MAPPING_DOC" and u["New Field"]["source_row"] is None, "a row added from a document, with no matrix row of its own")
sm = {r["feed_family"]: r for r in parsed["usagesum"]}
ok("TOTAL" not in sm and len(sm) == 2, "the summary's TOTAL row is not a feed family", list(sm))
ok(sm["ODDDIFI1"]["sei_mapped_fields"] == 3 and sm["ODDDIFI1"]["sei_mapped_percent"] == 30.0 and sm["ODDDIFI1"]["used_no_sei_source"] == 1
   and sm["ODDDIFI1"]["usage_conflicts"] == 1 and sm["ODDDIFI1"]["catalog_layout_fields"] is None,
   "the new summary columns land; the dropped layout columns are None", sm["ODDDIFI1"])

print("-- TRANSFORMATION_SUMMARY in its per-table shape")
ctl = [c for c in parsed["control"] if c["source_sheet"] == "TRANSFORMATION_SUMMARY"]
ok(len(ctl) == 2 and ctl[0]["control_name"] == "HOLDINGDBO.POSITION" and str(ctl[0]["result"]) == "2"
   and ctl[0]["status"] == "DRAFT_REVIEW_REQUIRED" and "BOTHLOGICSDOCUMENTED=1" in ctl[0]["detail"],
   "one control per target table: rows as the result, the counts in the detail", ctl)

print("-- a cell that outruns its column lands, cut and marked, rather than dropping the row")
big = SeiCrosswalkConnector._fit("x" * 19991, 4000)
ok(len(big) == 4000 and big.endswith("… [cut: 19991 chars]"), "the cut says what it cut", (len(big), big[-24:]))
ok(SeiCrosswalkConnector._fit("short", 4000) == "short" and SeiCrosswalkConnector._fit(None, 10) is None, "a cell that fits is untouched")

print("-- the new STAR feed")
ok(any(f.get("src_file", "").upper().startswith("OTDDIFI1") or "OTDDIFI1" in str(f) for f in parsed["feed"]), "OTDDIFI1 lands with the other feeds")

print("-- the load registry covers every new bundle")
targets = {k for k, _, _ in SeiCrosswalkConnector._TARGETS}
ok(all(k in targets for k in ("mapsrc", "seistar", "starstage", "e2e", "refcode", "entityid", "usageexc")), "seven bundles, seven tables")


# ---------------------------------------------------------------- v4 -------
# STAR_IMDS_SEI_Lineage_Catalog_v4_SEI-Source-Files: the end-to-end sheet is
# SEI_STAR_IMDS_LINEAGE at a wider grain, LINEAGE_COMPLETENESS in place of
# LINK_STATUS, and every lane carries the SEI feed file the source resolves
# to. Same table, same screens.
print("-- v4: the lineage sheet at its wider grain")
V4 = {k: v for k, v in SHEETS.items() if k != "SEI_STAR_IMDS_E2E_XWALK"}
FILE = ["SEI_SOURCE_FILE", "SEI_SOURCE_FILE_FIELDS", "SEI_SOURCE_FILE_STATUS"]
V4["SEI_STAR_IMDS_LINEAGE"] = (
    ["LINEAGE_ID", "STAR_FEED", "SEI_SOURCE"] + FILE + ["SEI_TO_STAR_MAP_KIND", "SEI_TO_STAR_LOGIC", "STAR_FIELDS", "STAR_FIELD_RESOLUTION",
     "IMDS_TARGET_OBJECT", "IMDS_TARGET_ATTRIBUTE", "IMDS_TYPE", "IMDS_NULLABLE", "STAR_TO_IMDS_LOGIC", "SEI_TO_IMDS_LOGIC",
     "SEI_TO_IMDS_LOGIC_ORIGIN", "LINEAGE_COMPLETENESS", "BUSINESS_DECISION_FLAG", "LINEAGE_STATUS", "APPROVAL_STATUS", "COMPARISON_ID"] + WHERE,
    [["LIN-1", "PEDDIFI1", "Taxlot.QUANTITY_HELD; Taxlot.FX_RATE", "Taxlot", "Taxlot.QUANTITY_HELD; Taxlot.FX_RATE", "VERIFIED_IN_FEED_SPEC",
      "DERIVED", "TAXLOT_TYPE_CODE = 2", "Lot Quantity; Entity Number", "DOCUMENTED", "HOLDINGDBO.POSITION", "QUANTITY", "NUMBER(28,12)", "No",
      "SUM(lot_qty)", "SUM(Taxlot.QUANTITY_HELD)", "COMPOSED_FROM_STAR_LOGIC", "FULL_SEI_STAR_IMDS", "N", "CANDIDATE", "DRAFT_REVIEW_REQUIRED",
      "LLP-1", "Portfolio_Valuation_Mapping.xlsx", "PVAL File Mapping", 17],
     ["LIN-2", "PEDDIFI1", "Processing_Date", "SYSTEM (job run)", "SYSTEM (job run).PROCESSING_DATE", "SYSTEM_OR_CONSTANT",
      "SYSTEM_DATE", "", "", "NOT_RESOLVED", "HOLDINGDBO.POSITION", "EFFECTIVE_DATE", "DATE", "Yes",
      "sysdate", "Processing_Date", "DOCUMENTED", "SEI_TO_IMDS_NO_STAR_FIELD", "N", "CANDIDATE", "DRAFT_REVIEW_REQUIRED",
      "LLP-2", "Portfolio_Valuation_Mapping.xlsx", "PVAL File Mapping", 18],
     ["LIN-3", "PEDDIFI1", "", "", "", "NO_SEI_SOURCE",
      "", "", "Phantom Field", "PARSED_FROM_IM_LOGIC", "HOLDINGDBO.POSITION", "COST_BASIS", "NUMBER", "Yes",
      "to_number(cost)", "", "MISSING", "STAR_TO_IMDS_NO_SEI_SOURCE", "Y", "BUSINESS_DECISION_REQUIRED", "DRAFT_REVIEW_REQUIRED",
      "LLP-3", "Portfolio_Valuation_Mapping.xlsx", "PVAL File Mapping", 19],
     ["LIN-4", "PEDDIFI1", "Account.ACCOUNT_BASE_CURRENCY", "Account", "Account.ACCOUNT_BASE_CURRENCY", "VERIFIED_IN_FEED_SPEC",
      "LOOKUP", "", "Base Currency Code", "SEI_TO_STAR_FIELD_MAP", "NOT_IDENTIFIED", "NOT_IDENTIFIED", "", "",
      "", "", "MISSING", "SEI_TO_STAR_NO_IMDS_TARGET", "N", "GAP", "DRAFT_REVIEW_REQUIRED",
      "", "Portfolio_Valuation_Mapping.xlsx", "PVAL File Mapping", 20],
     ["LIN-5", "PEDDIFI1", "", "", "", "NO_SEI_SOURCE",
      "", "", "", "NOT_RESOLVED", "HOLDINGDBO.POSITION", "UPDATE_SOURCE", "VARCHAR2(50)", "Yes",
      "", "", "MISSING", "NOT_POPULATED_IN_LOAD", "N", "NOT_APPLICABLE", "DRAFT_REVIEW_REQUIRED",
      "EXISTING_LLP_ROW", "Portfolio_Valuation_Mapping.xlsx", "LOT_LEVEL_POSITION", 3]])
V4["LINEAGE_SUMMARY"] = (["STAR_FEED", "IMDS_TARGET_OBJECT", "ROWS", "FULL_SEI_STAR_IMDS", "SEI_TO_IMDS_NO_STAR_FIELD", "STAR_TO_IMDS_NO_SEI_SOURCE",
                          "SEI_TO_STAR_NO_IMDS_TARGET", "NOT_POPULATED_IN_LOAD", "SEI_LOGIC_COMPOSED", "FULL_LINEAGE_PERCENT"],
                         [["PEDDIFI1", "HOLDINGDBO.POSITION", 4, 1, 1, 1, 0, 1, 1, 0.25],
                          ["PEDDIFI1", "NOT_IDENTIFIED", 1, 0, 0, 0, 1, 0, 0, 0],
                          ["TOTAL", "", 5, 1, 1, 1, 1, 1, 1, 0.2]])
hdr, rows = V4["SEI_TO_STAR_FIELD_MAP"]
V4["SEI_TO_STAR_FIELD_MAP"] = (hdr + FILE, [r + [None] * (len(hdr) - len(r)) + ["Taxlot", "Taxlot.QUANTITY_HELD", "VERIFIED_IN_FEED_SPEC"] for r in rows[:1]]
                               + [r for r in rows[1:]]
                               + [["S2S-LAYOUT-1", "STAR_IMDS", "SEI_TO_STAR", "PEDDIFI1", "Entity Name", "", "NOT_STATED", "", "", "", "", "", "NO_MAPPING", "N",
                                   "Added from STAR_LAYOUT_DETAIL: field is in the published STAR layout but no mapping document mentions it",
                                   "NO_SEI_SOURCE", "DRAFT_REVIEW_REQUIRED", "layouts.pdf", "STAR_LAYOUT_DETAIL", 7]])

with tempfile.TemporaryDirectory() as d:
    path = os.path.join(d, "v4.xlsx")
    SHEETS_V2 = SHEETS
    SHEETS = V4
    build(path)
    SHEETS = SHEETS_V2
    v4 = SeiCrosswalkConnector(xlsx_path=path, data_source="IMDS").parse()

e4 = {r["lineage_id"]: r for r in v4["e2e"]}
ok(len(v4["e2e"]) == 5 and set(e4) == {"LIN-1", "LIN-2", "LIN-3", "LIN-4", "LIN-5"} and e4["LIN-1"]["xwalk_row_id"] == "IMDS:LIN-1",
   "SEI_STAR_IMDS_LINEAGE lands in the e2e table, keyed by LINEAGE_ID", sorted(e4))
ok([e4[k]["link_class"] for k in ("LIN-1", "LIN-2", "LIN-3", "LIN-4", "LIN-5")] == ["E2E", "SEI_DIRECT", "NO_SEI_SOURCE", "STAR_ONLY", "NOT_POPULATED"]
   and e4["LIN-5"]["link_status"] == "NOT_POPULATED_IN_LOAD",
   "LINEAGE_COMPLETENESS is the link class, the sheet's word kept beside it; two new shapes", [e4[k]["link_class"] for k in sorted(e4)])
r1 = e4["LIN-1"]
ok(r1["sei_file"] == "Taxlot" and r1["sei_file_fields"] == "Taxlot.QUANTITY_HELD; Taxlot.FX_RATE" and r1["sei_file_status"] == "VERIFIED_IN_FEED_SPEC",
   "the SEI feed file, its fields and the resolution status ride along", r1)
ok(r1["sei_object"] == "Taxlot" and r1["sei_field"] == "QUANTITY_HELD" and r1["star_field"] == "Lot Quantity; Entity Number"
   and r1["star_field_norm"] == "LOT_QUANTITY" and r1["star_in_layout"] == "Y",
   "several SEI sources: the first names the object and field; several STAR fields: kept whole, normed by the first, in layout only if all are", r1)
ok(r1["star_field_resolution"] == "DOCUMENTED" and r1["sei_imds_logic_origin"] == "COMPOSED_FROM_STAR_LOGIC" and r1["imds_type"] == "NUMBER(28,12)"
   and r1["imds_nullable"] == "No" and r1["comparison_id"] == "LLP-1" and r1["crosswalk_status"] == "CANDIDATE" and r1["business_decision"] == "N",
   "resolution, origin, type, nullability, comparison, status and the decision flag", r1)
ok(e4["LIN-2"]["sei_object"] is None and e4["LIN-2"]["sei_field"] == "Processing_Date" and e4["LIN-2"]["sei_file"] == "SYSTEM (job run)",
   "a bare source is a field with no object; its file is the system", e4["LIN-2"])
ok(e4["LIN-4"]["imds_table"] is None and e4["LIN-4"]["imds_column"] is None and e4["LIN-3"]["business_decision"] == "Y",
   "NOT_IDENTIFIED is no target; the decision flag is read", e4["LIN-4"])
s4 = {r["map_row_id"]: r for r in v4["seistar"]}
ok(s4["IMDS:S2S-PEDDIFI1-a1"]["sei_file"] == "Taxlot" and s4["IMDS:S2S-PEDDIFI1-a1"]["sei_file_status"] == "VERIFIED_IN_FEED_SPEC",
   "the SEI -> STAR hop carries the file too", s4.get("IMDS:S2S-PEDDIFI1-a1"))
ok(s4["IMDS:S2S-LAYOUT-1"]["source_sheet"] == "STAR_LAYOUT_DETAIL" and s4["IMDS:S2S-LAYOUT-1"]["mapping_status"] == "NO_SEI_SOURCE",
   "a layout field no document mentions is a row, tagged by its source sheet", s4.get("IMDS:S2S-LAYOUT-1"))
ctl = [c for c in v4["control"] if c["source_sheet"] == "LINEAGE_SUMMARY"]
ok(len(ctl) == 3 and ctl[0]["control_name"] == "PEDDIFI1 \u2192 HOLDINGDBO.POSITION" and ctl[0]["result"] == "4" and ctl[2]["control_name"] == "TOTAL"
   and "FULLSEISTARIMDS=1" in (ctl[0]["detail"] or ""),
   "LINEAGE_SUMMARY lands in SEI_CONTROL as feed -> table, the row count its result, the counts in the detail", ctl)
ok(not [r for r in v4["e2e"] if r["link_class"] not in ("E2E", "SEI_DIRECT", "NO_SEI_SOURCE", "STAR_ONLY", "NOT_POPULATED", "STAR_NOT_IN_FILE_MAP")],
   "every v4 row has a class the screens know")


print("-- the SEI -> STAR -> IMDS lane, from the lineage rows")
L = {r["dwh_target_column"]: r for r in v4["seilineage"]}
ok(len(v4["seilineage"]) == 4 and set(L) == {"QUANTITY", "EFFECTIVE_DATE", "COST_BASIS", "UPDATE_SOURCE"} and all(r["lineage_id"].startswith("IMDS:SEI_IMDS:") for r in v4["seilineage"]),
   "one lineage row per IMDS column; the orphan STAR field has no target and stays out; ids carry the lane", sorted(L))
q = L["QUANTITY"]
ok(q["src_source_table"] == "Taxlot" and q["src_source_column"] == "QUANTITY_HELD" and q["stg1_source_table"] == "PEDDIFI1" and q["stg1_source_column"] == "Lot Quantity"
   and q["stg2_source_table"] is None and q["dwh_target_table"] == "HOLDINGDBO.POSITION",
   "SRC is the SEI feed file and field, STG1 the STAR-compatible field, DWH the IMDS column", q)
ok(q["src_to_stg1_transform"] == "TAXLOT_TYPE_CODE = 2" and q["stg1_to_stg2_transform"] == "SUM(lot_qty)" and q["lineage_status"] == "MAPPED"
   and q["dwh_type"] == "NUMBER" and q["dwh_length"] == "28" and q["dwh_precision"] == "12" and "the STAR -> IMDS logic is kept" in q["lineage_status_detail"]
   and "draft" in q["lineage_status_detail"],
   "SEI -> STAR logic on the first hop, the kept STAR -> IMDS logic into the warehouse; the type split; a draft that says so", q)
e = L["EFFECTIVE_DATE"]
ok(e["src_source_table"] == "SYSTEM (job run)" and e["src_source_column"] == "PROCESSING_DATE" and e["stg1_source_column"] is None
   and e["src_to_stg1_transform"] == "Processing_Date" and e["lineage_status"] == "MAPPED", "SEI straight to IMDS: no STAR stage, the SEI -> IMDS logic on the one hop", e)
c = L["COST_BASIS"]
ok(c["src_source_table"] is None and c["stg1_source_column"] == "Phantom Field" and c["lineage_status"] == "GAP" and "business decision open" in c["lineage_status_detail"],
   "no SEI source: the STAR field with nothing before it, a GAP, the decision flagged", c)
u = L["UPDATE_SOURCE"]
ok(u["src_source_table"] is None and u["stg1_source_table"] is None and u["lineage_status"] == "NOT_APPLICABLE" and u["dwh_type"] == "VARCHAR2" and u["dwh_length"] == "50",
   "a column the STAR load never writes: the warehouse node alone, not applicable", u)
lanes = {r["dwh_target_column"]: r for r in v4["seilinelane"]}
ok(len(lanes) == 4 and all(r["lane_id"] == "SEI_IMDS" and r["source_system"] == "SEI" for r in lanes.values()) and lanes["QUANTITY"]["src_file_key"] == "TAXLOT",
   "every row is tagged SEI_IMDS / SEI with its SEI file key", lanes.get("QUANTITY"))
xf = {r["dwh_target_column"]: r for r in v4["seilinexform"]}
ok(xf["QUANTITY"]["legacy_transformation_id"] == "LLP-1-IM" and xf["QUANTITY"]["sei_transformation_id"] == "LLP-1-SEI" and xf["QUANTITY"]["sei_equivalent_transformation"] == "SUM(Taxlot.QUANTITY_HELD)"
   and xf["QUANTITY"]["sei_source_fields"] == "Taxlot.QUANTITY_HELD; Taxlot.FX_RATE" and xf["QUANTITY"]["dwh_nullable"] == "No" and xf["QUANTITY"]["transformation_approval"] == "DRAFT_REVIEW_REQUIRED"
   and "LLP" not in (xf["UPDATE_SOURCE"]["legacy_transformation_id"] or ""),
   "the side row: the two transformation ids off the comparison, the SEI-equivalent logic, the SEI fields; EXISTING_LLP_ROW is no id", xf.get("QUANTITY"))
files = {f["src_file"]: f for f in v4["seifile"]}
ok(set(files) == {"Taxlot", "SYSTEM (job run)"} and files["Taxlot"]["source_system"] == "SEI" and files["Taxlot"]["src_file_key"] == "TAXLOT" and files["SYSTEM (job run)"]["dataset"] == "System-generated value",
   "the SEI feed files as source files of the SEI system, so the lane badge scopes to them", files)
cols4 = {c["src_source_column"]: c for c in v4["seisrccol"]}
ok(set(cols4) == {"QUANTITY_HELD", "PROCESSING_DATE"} and cols4["QUANTITY_HELD"]["evidence"] == "SEI_FEED_SPEC" and cols4["PROCESSING_DATE"]["evidence"] == "SEI_MAPPING_DOC",
   "one source column per SEI field, its evidence the file resolution", cols4)
ok(len(parsed["seilineage"]) == 5 and {r["lineage_status"] for r in parsed["seilineage"]} == {"MAPPED", "GAP"} and parsed["seilineage"][0]["src_source_table"] == "Taxlot",
   "the v2 e2e sheet builds the lane too, from the document's object spelling", [(r["dwh_target_column"], r["lineage_status"]) for r in parsed["seilineage"]])
os.environ["CP_SEI_LANE"] = "0"
try:
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "v2b.xlsx")
        build(path)
        off = SeiCrosswalkConnector(xlsx_path=path, data_source="IMDS").parse()
finally:
    del os.environ["CP_SEI_LANE"]
ok(off["seilineage"] == [] and off["seifile"] == [] and len(off["e2e"]) == 5, "CP_SEI_LANE=0 leaves the lane out and nothing else")

print(("\n%d assertion(s) failed" % BAD) if BAD else "\nmapping-docs parse assertions pass")
sys.exit(1 if BAD else 0)
