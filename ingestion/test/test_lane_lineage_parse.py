"""Parse a workbook shaped exactly like the delivered one and assert every
sheet lands.

WHY THIS EXISTS. Three times now a sheet has parsed to zero rows because a
column was called something other than what the connector guessed, and every
time the failure was silent: no exception, no error, just an empty panel on
screen days later. UAF_FEED was dropped whole. SEI_INPUT_LINEAGE's 950 rows
came back as nothing because the field is SEI_TARGET_FIELD and the connector
asked for SEI_FIELD. Neither was visible until someone looked at a screen and
asked why something was missing.

The fixture is built from the published sheet-and-column inventory of
`STAR_IMDS_SEI_Lineage_Catalog_Verified-Final-With-Transformations.xlsx` —
24 sheets, the real column headers, one or two synthetic rows each. No
production values: the cells are invented and the point is the headers.

    python ingestion/test/test_lane_lineage_parse.py

Exits non-zero on the first sheet that parses to nothing.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from openpyxl import Workbook                                    # noqa: E402
from ingestion.lane_lineage_conn import SeiCrosswalkConnector    # noqa: E402

# The real headers, sheet by sheet. Rows are synthetic.
SHEETS = {
    "_MANIFEST": (["ITEM", "VALUE", "NOTES"], [
        ["Source document", "STAR_layouts.pdf", "supplied"],
        ["LANE_LINEAGE rows", "124", "target-driven"],
    ]),
    "LANE_REGISTER": (["LANE_ID", "SOURCE_SYSTEM", "DATA_SOURCE",
                       "REPLACEMENT_STATE", "SUCCESSOR_SYSTEM", "CONTRACT_NAME",
                       "NOTES"], [
        ["STAR_IMDS", "STAR", "IMDS", "REPLACED", "SEI", "STAR-compatible", ""],
        ["UAF_IMDS", "UAF", "IMDS", "NOT_REPLACED", "", "", "no successor"],
    ]),
    "STAR_FEED": (["FEED_NAME", "FEED_FAMILY", "DATASET", "SUBJECT_AREA",
                   "GRAIN", "FREQUENCY", "LOAD_BEHAVIOUR", "KEY_FIELDS",
                   "LAYOUT_AVAILABLE", "EVIDENCE", "SOURCE_DOC", "NOTES"], [
        ["PEDDIFI1", "PEDDIFI1", "Positions", "Holdings", "position", "daily",
         "replace", "ACCT", "Y", "FEED_WORKBOOK", "layouts.pdf", ""],
    ]),
    "LANE_LINEAGE": ([
        "LANE_ID", "DATA_SOURCE", "DWH_TARGET_TABLE", "DWH_TARGET_COLUMN",
        "DWH_TYPE", "DWH_LENGTH", "DWH_PRECISION", "DWH_NULLABLE", "DWH_PK_FLAG",
        "STG2_SOURCE_TABLE", "STG2_SOURCE_COLUMN", "STG2_TYPE", "STG2_LENGTH",
        "STG2_PRECISION", "STG2_TO_DWH_TRANSFORM",
        "STG1_SOURCE_TABLE", "STG1_SOURCE_COLUMN", "STG1_TYPE", "STG1_LENGTH",
        "STG1_PRECISION", "STG1_TO_STG2_TRANSFORM",
        "SRC_SOURCE_TABLE", "SRC_SOURCE_COLUMN", "SRC_TYPE", "SRC_LENGTH",
        "SRC_PRECISION", "SRC_TO_STG1_TRANSFORM",
        "UNIT_OF_MEASURE", "CURRENCY_BASIS", "SIGN_CONVENTION", "CODE_SET_NAME",
        "LINEAGE_STATUS", "LINEAGE_STATUS_DETAIL", "SUBJECT_AREA", "EVIDENCE",
        "SOURCE_DOC", "SOURCE_DOC_LOCATOR", "NOTES",
        "LEGACY_TRANSFORMATION_ID", "SEI_TRANSFORMATION_ID",
        "SEI_EQUIVALENT_TRANSFORMATION", "SEI_SOURCE_OBJECTS",
        "SEI_SOURCE_FIELDS", "TRANSFORMATION_EQUIVALENCE",
        "TRANSFORMATION_APPROVAL_STATUS", "TRANSFORMATION_EVIDENCE_SOURCE",
    ], [
        ["STAR_IMDS", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION", "QUANTITY",
         "NUMBER", "18", "6", "Y", "N",
         "STG2_POS", "QTY", "NUMBER", "18", "6", "direct",
         "STG1_POS", "QTY", "CHAR", "18", "", "to_number",
         "PEDDIFI1", "LOT_QTY", "CHAR", "18", "", "trim",
         "shares", "local", "long/short", "", "MAPPED", "", "Holdings",
         "FEED_WORKBOOK", "layouts.pdf", "p12", "",
         "LEG_001", "SEI_001", "SUM(sei.qty)", "SEI_POSITION", "QTY",
         "UNVERIFIED_COMPARISON", "DRAFT_REVIEW_REQUIRED", "lot_map.xlsx"],
        ["UAF_IMDS", "IMDS", "RULESDBO.ENTITY", "ENTITY_ID",
         "VARCHAR2", "20", "", "N", "Y",
         "", "", "", "", "", "",
         "", "", "", "", "", "",
         "UAFMSG", "ENT_ID", "CHAR", "20", "", "",
         "", "", "", "", "MAPPED", "", "Reference", "DOCUMENT", "uaf.pdf", "",
         "", "", "", "", "", "", "", "", ""],
    ]),
    "SEI_FEED": (["SEI_FEED", "SEI_ENTITY", "SUBJECT_AREA", "DELIVERY_MODE",
                  "FREQUENCY", "GRAIN", "KEY_FIELDS", "LOAD_BEHAVIOUR",
                  "TYPES_PUBLISHED", "EVIDENCE", "SOURCE_DOC", "NOTES"], [
        ["End of Day Positions", "Position", "Holdings", "file", "daily",
         "position", "ACCT", "replace", "N", "DOCUMENT", "sei.pdf", ""],
    ]),
    "SEI_TO_STAR": (["MAP_ID", "LANE_ID", "TARGET_STAR_FEED", "TARGET_STAR_FIELD",
                     "SEI_FEED", "SEI_ENTITY", "SEI_DATAPOINT", "SEI_TYPE",
                     "SEI_LENGTH", "SEI_SCALE", "SEI_NULLABLE",
                     "SEI_UNIT_OF_MEASURE", "SEI_CURRENCY_BASIS",
                     "SEI_SIGN_CONVENTION", "SEI_CODE_SET_NAME", "MAP_KIND",
                     "COMPOSITE_GROUP", "COMPOSITE_ROLE", "SEI_TO_STAR_RULE",
                     "JOIN_KEY", "DEPENDS_ON_FEED", "EVIDENCE", "SOURCE_DOC",
                     "SOURCE_DOC_LOCATOR", "OPEN_QUESTION", "NOTES"], [
        ["STAR_IMDS:PEDDIFI1:LOT_QTY:1", "STAR_IMDS", "PEDDIFI1", "LOT_QTY",
         "End of Day Positions", "Position", "Quantity", "UNKNOWN", "", "", "",
         "shares", "", "", "", "DIRECT", "N/A", "", "carry across", "", "",
         "DOCUMENT", "sei.pdf", "", "", ""],
    ]),
    "CODE_SET": (["CODE_SET_NAME", "SIDE", "CODE_VALUE", "CODE_DESCRIPTION",
                  "MAPS_TO_SIDE", "MAPS_TO_CODE", "MAPS_TO_DESCRIPTION",
                  "EVIDENCE", "SOURCE_DOC", "NOTES"], [
        ["TXN_TYPE", "SEI", "BUY", "Purchase", "STAR", "B", "Buy",
         "DOCUMENT", "sei.pdf", ""],
    ]),
    "IDENTIFIER_XWALK": (["ENTITY", "SEI_IDENTIFIER", "STAR_IDENTIFIER",
                          "IMDS_IDENTIFIER", "CARDINALITY", "RESOLUTION_RULE",
                          "AUTHORITATIVE_SIDE", "EVIDENCE", "NOTES"], [
        ["Instrument", "INSTRUMENT_ID", "SEC_ID", "SECURITY_ID", "1:1",
         "", "", "DOCUMENT", "precedence undocumented"],
    ]),
    "SEI_INPUT_LINEAGE": (["LINEAGE_ID", "LANE_ID", "DIRECTION",
                           "FUNCTIONAL_GROUP", "SEI_TARGET_FILE",
                           "TARGET_ORDINAL", "SEI_TARGET_FIELD", "SEI_TYPE",
                           "SEI_LENGTH", "SEI_SCALE", "RECORD_SCOPE",
                           "VALIDATION_RULE", "FIELD_DEFINITION",
                           "ACCEPTABLE_VALUES", "SOURCE_SYSTEM",
                           "SOURCE_OBJECT", "SOURCE_FIELD", "MAPPING_LOGIC",
                           "MAPPING_STATUS", "SOURCE_WORKBOOK", "SOURCE_SHEET",
                           "NOTES"], [
        ["IN_1", "SEI_IMDS", "INBOUND", "Holdings", "POSITION.DAT", "3",
         "LOT_QUANTITY", "DECIMAL", "18", "6", "detail", "not null",
         "Lot quantity held", "", "BBH", "HOLDING", "QTY", "direct",
         "MAPPED", "sei_input.xlsx", "Positions", ""],
    ]),
    "SEI_CATALOG_VERIFY": (["MAP_ID", "SEI_DATAPOINT", "MATCH_COUNT",
                            "MATCHED_FILES", "MATCHED_FIELDS", "VERIFY_RESULT",
                            "EVIDENCE", "NOTES", "TARGET_FEED", "TARGET_FIELD",
                            "MAPPED_SEI_DATAPOINT", "LANE_ID", "SOURCE_DOC"], [
        ["STAR_IMDS:PEDDIFI1:LOT_QTY:1", "Quantity", "1", "POSITION.DAT",
         "LOT_QUANTITY", "EXACT_FIELD_MATCH", "DOCUMENT", "", "PEDDIFI1",
         "LOT_QTY", "Quantity", "STAR_IMDS", "sei_input.xlsx"],
    ]),
    "VERIFY": (["LANE_ID", "DATA_SOURCE", "DWH_TARGET_TABLE",
                "DWH_TARGET_COLUMN", "FUNCTIONAL_GROUP", "CONTRACT_FEED",
                "CONTRACT_FIELD", "SEI_DATAPOINT_COUNT", "SEI_DATAPOINTS",
                "MAP_KIND", "MATCH_VERDICT", "VERDICT_REASON", "FAILED_CHECKS",
                "EVIDENCE_LEFT", "EVIDENCE_RIGHT", "BLOCKS_CUTOVER",
                "WHAT_WOULD_CLEAR_IT", "SUBJECT_AREA", "STAR_FEED",
                "STAR_FIELD"], [
        ["STAR_IMDS", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION", "QUANTITY",
         "Holdings", "PEDDIFI1", "LOT_QTY", "1", "Quantity", "DIRECT",
         "UNKNOWN", "no types on either side", "NO_TYPES_SUPPLIED",
         "NONE", "DOCUMENT", "Y", "an ALL_TAB_COLUMNS extract", "Holdings",
         "PEDDIFI1", "LOT_QTY"],
        ["UAF_IMDS", "IMDS", "RULESDBO.ENTITY", "ENTITY_ID", "Reference",
         "", "", "0", "", "", "OUT_OF_SCOPE", "lane not replaced", "",
         "", "DOCUMENT", "N", "", "Reference", "", ""],
    ]),
    # NOTE: no LANE_ID column — this is the change that breaks lane scoping
    "DISPOSITION": (["DWH_TARGET_TABLE", "DWH_TARGET_COLUMN", "DISPOSITION",
                     "DISPOSITION_DETAIL", "PROPOSED_BY", "OWNER",
                     "APPROVED_ON", "NOTES"], [
        ["HOLDINGDBO.LOT_LEVEL_POSITION", "QUANTITY", "UNDECIDED",
         "awaiting SEI types", "analyst", "data owner", "", ""],
        ["HOLDINGDBO.LOT_LEVEL_POSITION", "NOT_IN_VERIFY", "DEFER",
         "no verify row exists for this column", "analyst", "", "", ""],
    ]),
    "EXCEPTIONS": (["SHEET", "ROW_KEY", "COLUMN", "ISSUE", "WHY_UNRESOLVED",
                    "WHO_CAN_ANSWER", "SUGGESTED_QUESTION"], [
        ["SEI_TO_STAR", "MAP_1", "SEI_TYPE", "no type published",
         "feed workbook omits types", "SEI", "can you publish types?"],
    ]),
    "ENUMS": (["LIST_NAME", "VALUE", "MEANING"], [
        ["MATCH_VERDICT", "NO_SOURCE", "SEI offers nothing for this column"],
        ["DISPOSITION", "GENERATE", "produce the value in IMDS"],
    ]),
    "UAF_FEED": (["FEED_NAME", "MQ_QUEUE", "LANDING_FILE", "RECORD_TYPE",
                  "RECORD_CLASS", "LAYOUT", "FIELD_COUNT", "FREQUENCY",
                  "STAGING_PROCEDURE", "PRIMARY_TARGETS", "SAMPLE_VERIFICATION",
                  "SOURCE_DOC", "NOTES"], [
        ["UAFMSG", "UAF.IN", "uaf.dat", "ENT", "entity", "fixed", "40",
         "intraday", "SP_LOAD_UAF", "RULESDBO.ENTITY", "sampled", "uaf.pdf", ""],
    ]),
    "UAF_FIELD_SCHEMA": (["FEED_NAME", "RECORD_TYPE", "ORDINAL", "FIELD_NAME",
                          "PUBLISHED_ATTRIBUTE", "NORMALIZED_TYPE",
                          "LENGTH_OR_PRECISION", "REPEAT_GROUP",
                          "SOURCE_TO_STAGE", "DOCUMENTED_TARGET_OR_USE",
                          "TRANSFORMATION_OR_RULE", "EVIDENCE",
                          "SOURCE_DOC_LOCATOR", "NOTES"], [
        ["UAFMSG", "ENT", "1", "ENT_ID", "Entity identifier", "CHAR", "20",
         "N", "SP_LOAD_UAF", "RULESDBO.ENTITY.ENTITY_ID", "trim", "DOCUMENT",
         "p4", ""],
    ]),
    "STAR_LAYOUT_DETAIL": (["FEED_FAMILY", "ORDINAL", "FIELD_NAME",
                            "PUBLISHED_TYPE", "PUBLISHED_LENGTH",
                            "PUBLISHED_FORMAT", "DESCRIPTION",
                            "SOURCE_DOCUMENT", "EVIDENCE_STATUS"], [
        ["PEDDIFI1", "7", "LOT_QTY", "NUMERIC", "18", "9(12)V9(6)",
         "Lot quantity", "layouts.pdf", "COPYBOOK"],
    ]),
    "STAR_UPLOADER_LINEAGE": (["JOB_NAME", "DUPLICATE_CHECK", "PRE_PROCESS",
                               "LOADED_AS_IS", "IMDS_LOAD_MAPPING",
                               "SOURCE_DOCUMENT", "EVIDENCE_STATUS"], [
        ["LOAD_PEDDIFI1", "by file hash", "strip header/trailer", "N",
         "HOLDINGDBO.LOT_LEVEL_POSITION", "uploader.pdf", "DOCUMENT"],
    ]),
    "LOT_LEVEL_POSITION_MAP": (["TARGET_COLUMN", "TARGET_TYPE", "NULLABLE",
                                "STAR_TRANSFORMATION", "SEI_SWP_TRANSFORMATION",
                                "SEI_SOURCE_OBJECT", "SEI_SOURCE_FIELD",
                                "REMARKS", "SOURCE_DOCUMENT"], [
        ["QUANTITY", "NUMBER(18,6)", "Y", "trim then to_number",
         "SUM(sei.qty)", "SEI_POSITION", "QTY", "", "lot_map.xlsx"],
        ["COST_BASIS", "NUMBER(18,6)", "Y", "direct", "Null", "", "",
         "no SEI source", "lot_map.xlsx"],
    ]),
    "NEW_EVIDENCE_RECON": (["FEED_FAMILY", "STAR_FIELD", "STAR_TYPE",
                            "STAR_LENGTH", "SEI_EXACT_NAME_MATCH_COUNT",
                            "SEI_EXACT_NAME_MATCHES", "EVIDENCE_CLASS",
                            "VERIFICATION_RESULT", "SOURCE_DOCUMENT"], [
        ["PEDDIFI1", "LOT_QTY", "NUMERIC", "18", "2",
         "POSITION.DAT:LOT_QUANTITY|TAXLOT.DAT:LOT_QUANTITY", "CANDIDATE",
         "MULTIPLE_EXACT_FIELD_MATCHES", "recon.xlsx"],
    ]),
    "FINAL_VERIFICATION": (["CONTROL", "RESULT", "STATUS", "DETAIL"], [
        ["All targets have a verdict", "124 of 124", "RESOLVED", ""],
        ["Transformations approved", "0 of 161", "BLOCKED", "draft review"],
    ]),
    "TRANSFORMATION_REGISTER": (["TRANSFORMATION_ID", "TRANSFORMATION_LAYER",
                                 "TARGET_SYSTEM", "TARGET_OBJECT",
                                 "TARGET_ATTRIBUTE", "TRANSFORMATION_TYPE",
                                 "INPUT_OBJECTS", "INPUT_FIELDS",
                                 "TRANSFORMATION_LOGIC",
                                 "NULL_HANDLING_OBSERVED",
                                 "CONDITIONAL_LOGIC_OBSERVED", "STATUS",
                                 "EVIDENCE_SOURCE", "REMARKS"], [
        ["LEG_001", "STAR_TO_IMDS", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION",
         "QUANTITY", "DERIVED", "STG2_POS", "QTY", "to_number(trim(QTY))",
         "null -> 0", "none", "DOCUMENTED", "lot_map.xlsx", ""],
        ["SEI_001", "SEI_TO_IMDS", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION",
         "QUANTITY", "DERIVED", "SEI_POSITION", "QTY", "SUM(sei.qty)",
         "not stated", "none", "DRAFT", "lot_map.xlsx", "grain unconfirmed"],
    ]),
    "TRANSFORMATION_COMPARISON": (["COMPARISON_ID", "TARGET_SYSTEM",
                                   "TARGET_OBJECT", "TARGET_ATTRIBUTE",
                                   "TARGET_TYPE", "TARGET_NULLABLE",
                                   "LEGACY_TRANSFORMATION_ID",
                                   "SEI_TRANSFORMATION_ID",
                                   "IMDS_TRANSFORMATION_LOGIC",
                                   "EQUIVALENT_SEI_TRANSFORMATION_LOGIC",
                                   "SEI_SOURCE_OBJECTS", "SEI_SOURCE_FIELDS",
                                   "TRANSFORMATION_EQUIVALENCE",
                                   "EVIDENCE_COMPLETENESS",
                                   "DIFFERENCE_OR_REVIEW_NOTE",
                                   "APPROVAL_STATUS", "EVIDENCE_SOURCE"], [
        ["CMP_1", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION", "QUANTITY",
         "NUMBER(18,6)", "Y", "LEG_001", "SEI_001", "to_number(trim(QTY))",
         "SUM(sei.qty)", "SEI_POSITION", "QTY", "UNVERIFIED_COMPARISON",
         "PARTIAL", "grain differs: lot vs position",
         "DRAFT_REVIEW_REQUIRED", "lot_map.xlsx"],
        ["CMP_2", "IMDS", "HOLDINGDBO.LOT_LEVEL_POSITION", "COST_BASIS",
         "NUMBER(18,6)", "Y", "LEG_002", "", "direct", "", "", "",
         "NO_SEI_SOURCE", "NONE", "", "DRAFT_REVIEW_REQUIRED", "lot_map.xlsx"],
    ]),
    "TRANSFORMATION_SUMMARY": (["METRIC", "VALUE", "INTERPRETATION"], [
        ["Mapping rows processed", "161", "from the lot-level file"],
        ["Approved", "0", "all draft"],
    ]),
}

# role -> the least that must land for the sheet to count as read
EXPECT = {
    "lane": 2, "feed": 2, "lineage": 2, "srccol": 2, "linelane": 2,
    "linexform": 1, "map": 1, "code": 1, "xwalk": 1, "verify": 2, "disp": 2,
    "exc": 1, "seifeed": 1, "seiinput": 1, "seicat": 1, "uafschema": 1,
    "xform": 2, "xcompare": 2, "starfld": 1, "uploader": 1, "recon": 1,
    "enums": 2, "lotmap": 2, "control": 6,
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


def main():
    bad = 0

    def ok(cond, msg, got=None):
        nonlocal bad
        print(f"{'ok  ' if cond else 'FAIL'} {msg}"
              + ("" if cond else f"  -> {got!r}"))
        if not cond:
            bad += 1

    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "fixture.xlsx")
        build(path)
        conn = SeiCrosswalkConnector(xlsx_path=path, data_source="IMDS")
        parsed = conn.parse()

    print()
    for role, least in sorted(EXPECT.items()):
        n = len(parsed.get(role) or [])
        ok(n >= least, f"{role:<10} parsed {n} rows (need >= {least})", n)

    print()
    # --- the specific regressions this file exists to prevent -------------
    si = parsed["seiinput"][0]
    ok(si["sei_field"] == "LOT_QUANTITY",
       "seiinput reads SEI_TARGET_FIELD, not the old guess", si["sei_field"])
    ok(si["upstream_field"] == "QTY", "seiinput reads SOURCE_FIELD", si)
    ok(si["source_mapping_rule"] == "direct", "seiinput reads MAPPING_LOGIC", si)
    ok(si["origin_sheet"] == "Positions", "seiinput reads SOURCE_SHEET", si)

    uf = parsed["uafschema"][0]
    ok(uf["published_type"] == "CHAR", "uafschema reads NORMALIZED_TYPE", uf)
    ok(uf["published_length"] == "20", "uafschema reads LENGTH_OR_PRECISION", uf)
    ok(uf["transformation"] == "trim", "uafschema reads TRANSFORMATION_OR_RULE", uf)
    ok(uf["imds_target"].startswith("RULESDBO"),
       "uafschema reads DOCUMENTED_TARGET_OR_USE", uf)

    xf = {r["dwh_target_column"]: r for r in parsed["linexform"]}
    ok(len(xf) == 2,
       "a side row per lineage row that carries ANY of the ten new columns",
       len(xf))
    ok(xf["QUANTITY"]["transformation_equivalence"] == "UNVERIFIED_COMPARISON",
       "the equivalence column lands", xf["QUANTITY"])
    ok(xf["QUANTITY"]["dwh_pk_flag"] == "N", "DWH_PK_FLAG lands", xf["QUANTITY"])
    ok(xf["ENTITY_ID"]["legacy_transformation_id"] is None
       and xf["ENTITY_ID"]["sei_transformation_id"] is None,
       "a row with only target flags records no transformation, rather than "
       "an empty one", xf["ENTITY_ID"])
    ok(xf["ENTITY_ID"]["dwh_pk_flag"] == "Y",
       "and its target flags are kept", xf["ENTITY_ID"])

    disp = {d["dwh_target_column"]: d for d in parsed["disp"]}
    ok(disp["QUANTITY"]["lane_id"] == "STAR_IMDS",
       "a disposition with no LANE_ID takes it from its VERIFY row",
       disp["QUANTITY"])
    ok(disp["QUANTITY"]["disp_id"].startswith("STAR_IMDS:"),
       "and its key is rebuilt to match", disp["QUANTITY"]["disp_id"])
    ok(disp["NOT_IN_VERIFY"]["lane_id"] is None,
       "one with no verify row keeps a null lane rather than a guessed one",
       disp["NOT_IN_VERIFY"])
    ok(all(d.get("data_source") == "IMDS" for d in parsed["disp"]),
       "every disposition is stamped with the warehouse")

    lanes = {r["source_system"] for r in parsed["linelane"]}
    ok(lanes == {"STAR", "UAF"}, "both lanes attributed from LANE_ID", lanes)

    feeds = {f["src_file"]: f["source_system"] for f in parsed["feed"]}
    ok(feeds.get("UAFMSG") == "UAF", "UAF_FEED is read and tagged UAF", feeds)
    ok(feeds.get("PEDDIFI1") == "STAR", "STAR_FEED is read and tagged STAR", feeds)

    sheets = {c["source_sheet"] for c in parsed["control"]}
    ok(sheets == {"MANIFEST", "FINAL_VERIFICATION", "TRANSFORMATION_SUMMARY"},
       "all three summary sheets land in sei_control", sheets)

    sf = parsed["starfld"][0]
    ok(sf["published_type"] == "NUMERIC" and sf["field_norm"] == "LOT_QTY",
       "STAR layout carries a real type and a canonical name", sf)

    print()
    print(f"{bad} failure(s)" if bad else "every sheet parsed; all assertions pass")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
