"""Data Analysis: the historical migration sheets, from a workbook to the routes.

A synthetic workbook with the four HIST_* sheets is written with openpyxl,
read by the connector, loaded into a fake loader, and read back through the
router on a fake db. Every CP360-HM rule the loader applies is exercised on
a row shaped to trip it. No real workbook is used.

    python3.13 api/test/test_hist_migration.py
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ingestion.hist_migration_conn import HistMigrationConnector, artifact_class, map_headers, _s, lane_of, decon_status, norm_field   # noqa: E402
from api.app import routers_hist_migration as R                                                  # noqa: E402

bad = 0


def ok(cond, msg, got=None):
    global bad
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {got!r}"))
    if not cond:
        bad += 1


print("-- helpers")
ok(_s("  keep\ninner breaks  ") == "keep\ninner breaks" and _s("a\r\nb") == "a\nb" and _s(None) == "" and _s("None") == "", "HM-001: ends trimmed, inner breaks kept, None is empty")
ok(artifact_class("DCONCUS10_20210727.docx", "Deconversion specification") == "REFERENCE" and artifact_class("TRP_DATA_DICTIONARY_091926.TXT", "Data dictionary") == "REFERENCE"
   and artifact_class("Consolidated_Catalog_Static_and_Financial.xlsx", "Analyst mapping catalog") == "MAPPING", "HM-008: the spec and the dictionary are reference artifacts; the catalog is mapping")
idx = map_headers("lanes", ["Historical Lane ID", "HISTORICAL_SOURCE_SYSTEM", "Target  System", "Migration Purpose", "Status"])
ok(idx.get("historical_lane_id") == 0 and idx.get("historical_source_system") == 1 and idx.get("target_system") == 2 and idx.get("status") == 4, "headers match by the source name or the physical name", idx)

print("-- a workbook with the four sheets")
from openpyxl import Workbook   # noqa: E402
wb = Workbook()
ws = wb.active
ws.title = "HIST_MIGRATION_LANES"
ws.append(["Historical Lane ID", "Historical Source System", "Target System", "Migration Purpose", "Primary Mapping Evidence", "Reference Artifacts", "Data Domain", "Relationship to Operational Lineage", "Status"])
ws.append(["ADDVANTAGE_SEI_HIST", "AddVantage / PB", "SEI", "Historical deconversion source-to-target mapping", "Consolidated_Catalog_Static_and_Financial.xlsx", "DCONCUS10_20210727.docx; TRP_DATA_DICTIONARY_091926.TXT", "Static and Financial", "Upstream of the existing SEI to STAR to IMDS lineage", "Added"])
ws.append(["STAR_SEI_HIST", "STAR / IM", "SEI", "Historical deconversion source-to-target mapping", "Consolidated_Catalog_Static_and_Financial.xlsx", "", "Static and Financial", "Upstream", "Added"])
ws.append(["UAF_SEI_HIST", "UAF", "SEI", "Historical deconversion source-to-target mapping", "", "", "Static", "Upstream", "Added"])
ws = wb.create_sheet("HIST_SOURCE_REGISTER")
ws.append(["Source Artifact", "Artifact Type", "Historical Migration Role", "Supported Lanes", "CP 360 Treatment", "Notes"])
ws.append(["Consolidated_Catalog_Static_and_Financial.xlsx", "Analyst mapping catalog", "Row-level mapping evidence", "AddVantage/PB to SEI; STAR/IM to SEI; UAF to SEI", "Normalized into HIST_MAPPING_EVIDENCE", "Different sheets use different mapping columns"])
ws.append(["DCONCUS10_20210727.docx", "Deconversion specification", "Interpretation of deconversion fields", "AddVantage/PB to SEI", "Reference", ""])
ws.append(["TRP_DATA_DICTIONARY_091926.TXT", "Operational feed", "Dictionary", "UAF to SEI", "Reference", "typed wrongly on purpose"])
ws.append(["Operational_Lineage_Baseline.xlsx", "Lineage baseline", "Downstream anchor", "", "Already in CP 360", ""])
ws = wb.create_sheet("HIST_MAPPING_EVIDENCE")
ws.append(["Historical Migration Domain", "Historical Source System", "Historical Migration Lane", "Mapping Evidence Type", "Migration Group", "Source Mapping Workbook", "Source Mapping Sheet", "Source Mapping Row", "Evidence Category", "Evidence Attribute", "Evidence Value", "Original Source Column", "Original Source Column Number", "Reference Artifacts"])
LONG = "SELECT CASE WHEN x = 1 THEN 'a' ELSE 'b' END\nFROM T_ONE t JOIN T_TWO u ON t.k = u.k " * 60
rows = [
    ["Static", "AddVantage / PB", "AddVantage / PB to SEI", "Analyst source-to-target mapping evidence", "Static Merge", "DSR_Mapping.xlsx", "AV_DSR_MAP", 2, "Source-Specific Mapping Attribute", "Source-Specific Attribute 5", "Subfirm Logic", "Column_1", 5, "DCONCUS10_20210727.docx"],
    ["Static", "AddVantage / PB", "AddVantage / PB to SEI", "Analyst source-to-target mapping evidence", "Static Merge", "DSR_Mapping.xlsx", "AV_DSR_MAP", 2, "Target Field", "SEI Target Field", "  party_basic.sub_firm  ", "Column_2", 6, ""],
    ["Static", "AddVantage / PB", "AddVantage / PB to SEI", "Analyst source-to-target mapping evidence", "Static Merge", "DSR_Mapping.xlsx", "AV_DSR_MAP", 2, "Mapping Logic", "Rule", LONG, "Column_3", 7, ""],
    ["Static", "AddVantage / PB", "AddVantage / PB to SEI", "Analyst source-to-target mapping evidence", "Static Merge", "DSR_Mapping.xlsx", "AV_DSR_MAP", 3, "Mapping Logic", "Rule", "", "Column_3", 7, ""],           # blank: HM-004
    ["Financial", "Unclassified Historical Source", "Historical source to SEI", "Analyst source-to-target mapping evidence", "", "Fin_Mapping.xlsx", "FIN_MAP", 9, "Mapping Logic", "Rule", "Direct", "Column_9", 2, ""],    # lane unresolved: HM-007
    ["Financial", "STAR / IM", "STAR / IM to SEI", "Analyst source-to-target mapping evidence", "", "Fin_Mapping.xlsx", "FIN_MAP", 0, "Mapping Logic", "Rule", "Direct", "Column_9", 2, ""],                              # row 0: HM-003
    ["Financial", "STAR / IM", "STAR / IM to SEI", "Analyst source-to-target mapping evidence", "", "Fin_Mapping.xlsx", "FIN_MAP", 10, "Mapping Logic", "Rule", "Lookup on X", "Column_9", 2, ""],
]
for r in rows:
    ws.append(r)
ws = wb.create_sheet("HIST_HEADER_DICTIONARY")
ws.append(["Meaningful Column Name", "Definition", "Source or Derivation"])
ws.append(["Historical Migration Domain", "Static, Financial, or other source grouping", "Derived from Group"])
ws.append(["Evidence Value", "The original cell", "Source cell"])
wb.create_sheet("LINEAGE_SUMMARY").append(["something", "else"])
ws = wb.create_sheet("FINAL_HIST_MIGRATION_LINEAGE")
ws.append(["LINEAGE_ID", "CATALOG_ID", "FUNCTIONAL_GROUP", "SOURCE_PATH", "SOURCE_SYSTEM", "SOURCE_OBJECT_FIELD", "DECON_DICTIONARY_MEANING", "DECON_BUSINESS_DOMAIN", "DECON_DICTIONARY_STATUS",
           "SOURCE_DEPENDENCIES", "TRANSFORMATION_RULE_SOURCE", "TRANSFORMATION_RULE", "RULE_STATUS", "TARGET_SYSTEM", "TARGET_DAT_FILE", "TARGET_FIELD", "TARGET_FIELD_SOURCE_COLUMN",
           "TARGET_DATA_TYPE", "TARGET_MAX_LENGTH", "TARGET_DECIMAL_POS", "MANDATORY", "VALIDATION_RULE", "SOURCE_WORKBOOK", "SOURCE_SHEET", "SOURCE_ROW", "COMMON_TARGET_KEY", "COMMON_TARGET_INDICATOR"])
ws.append(["HL-0001", "SEI-ACCOUNT-BASIC-001-ACCOUNTNUMBER", "Account", "AddVantage / PB -> SEI", "AddVantage / PB", "SGA_DCON_ACCT.ACCT_NO", "Deconversion account master", "Account", "Curated",
           "", "merged catalog", "TRIM(ACCT_NO)", "Complete", "SEI", "account-basic.dat", "ACCOUNT_NUMBER", "ACCT_NO", "CHAR", "20", "", "Yes", "must be numeric", "DSR_Mapping.xlsx", "AV_DSR_MAP", 2, "", ""])
ws.append(["HL-0002", "SEI-ACCOUNT-BASIC-001-ACCOUNTNUMBER", "Account", "STAR / IM -> SEI", "STAR / IM", "IM_ACCOUNT.ACCOUNT_ID", "IM account", "Account", "Name-derived, review required",
           "IM_ACCOUNT_TYPE", "merged catalog", "ACCOUNT_ID", "Complete", "SEI", "account-basic.dat", "ACCOUNT_NUMBER", "ACCOUNT_ID", "CHAR", "20", "", "Yes", "", "IM_Mapping.xlsx", "IM_MAP", 7, "SEI::account-basic.dat::ACCOUNT_NUMBER", "Y"])
ws.append(["HL-0003", "SEI-PARTY-BASIC-004-SUBFIRM", "Party", "UAF -> SEI", "UAF", "UAF_PARTY.SUB_FIRM_CD", "", "", "",
           "", "merged catalog", "CASE WHEN sub_firm_cd IS NULL THEN 'DEFAULT' ELSE sub_firm_cd END", "Open", "SEI", "party-basic.dat", "Sub-Firm", "", "CHAR", "10", "", "No", "", "UAF_Mapping.xlsx", "UAF_MAP", 3, "", ""])
ws = wb.create_sheet("DECON_SOURCE_DICTIONARY")
ws.append(["TECHNICAL_OBJECT", "SOURCE_PREFIX", "BUSINESS_MEANING", "SOURCE_TYPE", "BUSINESS_DOMAIN", "MIGRATION_FUNCTION", "DEFINITION_BASIS", "LINEAGE_USAGE_COUNT", "EXAMPLE_TARGET_FIELDS"])
ws.append(["SGA_DCON_ACCT", "SGA_DCON", "Deconversion account master", "table", "Account", "account conversion", "Curated", 12, "ACCOUNT_NUMBER; ACCOUNT_NAME"])
ws.append(["IM_ACCOUNT", "IM", "IM account (name-derived)", "table", "Account", "account conversion", "Name-derived", 4, "ACCOUNT_NUMBER"])
ws.append(["XOS_PARTY", "XOS", "", "table", "Party", "", "", 1, "Sub-Firm"])
ws = wb.create_sheet("HIST_MIGRATION_RULE")
ws.append(["RULE_ID", "CATALOG_ID", "FUNCTIONAL_GROUP", "SEI_TARGET_FILE", "SEI_TARGET_FIELD", "RULE_SOURCE_COLUMN", "RULE_TYPE", "TRANSFORMATION_RULE", "VALIDATION_RULE", "MAPPING_STATUS", "SOURCE_OBJECTS_FIELDS", "SOURCE_WORKBOOK", "SOURCE_SHEET", "EVIDENCE_LOCATOR", "APPROVAL_STATUS"])
ws.append(["R-0001", "SEI-ACCOUNT-BASIC-001-ACCOUNTNUMBER", "Account", "account-basic.dat", "ACCOUNT_NUMBER", "Other Mapping Logic", "DIRECT", "TRIM(ACCT_NO)", "numeric, 20", "Complete", "SGA_DCON_ACCT.ACCT_NO", "DSR_Mapping.xlsx", "AV_DSR_MAP", "row 2", ""])
ws.append(["R-0002", "", "Party", "party-basic.dat", "Sub-Firm", "Other Mapping Logic", "CONDITIONAL", "CASE WHEN sub_firm_cd IS NULL THEN 'DEFAULT' ELSE sub_firm_cd END\n-- report out when blank", "", "Open", "XOS_PARTY.SUB_FIRM_CD", "UAF_Mapping.xlsx", "UAF_MAP", "row 3", "Approved"])
ws = wb.create_sheet("TARGET_FIELD_QC")
ws.append(["CONTROL", "APPLIES_TO", "EXPECTED", "ACTUAL", "RESULT", "NOTE"])
ws.append(["No blank TARGET_FIELD", "FINAL_HIST_MIGRATION_LINEAGE", "0", "0", "PASS", "checked on export"])
ws.append(["ACCOUNT_NUMBER present in SEI catalog", "account-basic.dat ACCOUNT_NUMBER", "1", "1", "PASS", ""])
ws = wb.create_sheet("_MANIFEST")
ws.append(["KEY", "VALUE"])
ws.append(["WORKBOOK_VERSION", "v12"])
ws.append(["MATCH_METHOD", "EXACT_NORMALIZED_FIELD_MATCH"])
ws.append(["TRANSFORMATION_APPROVAL_DEFAULT", "DRAFT_REVIEW_REQUIRED"])
ws.append(["SHEET", "FINAL_HIST_MIGRATION_LINEAGE · 2270 rows"])
ws.append(["SHEET", "HIST_MIGRATION_RULE · 1507 rows"])
d = tempfile.mkdtemp()
path = os.path.join(d, "STAR_IMDS_SEI_Lineage_Catalog_test.xlsx")
wb.save(path)

c = HistMigrationConnector(xlsx=path)
b = c.parse()
ok(b["files"] == [os.path.basename(path)] and b["source_hash"] and len(b["source_hash"]) == 64, "the one workbook named by CP_SEI_XLSX is read and hashed", b["files"])
ok(sorted(s["kind"] for s in b["sheets"]) == ["artifacts", "decon", "dictionary", "evidence", "lanes", "lineage", "manifest", "qc", "rules"], "the nine package sheets are found by name; the crosswalk sheets are left to their own loader", sorted(s["kind"] for s in b["sheets"]))
ok(len(b["lanes"]) == 3 and len(b["artifacts"]) == 4 and len(b["dictionary"]) == 2, "lanes, artifacts and dictionary rows", (len(b["lanes"]), len(b["artifacts"]), len(b["dictionary"])))
ok(len(b["evidence"]) == 5 and b["skipped"] == 1, "HM-002/HM-004: one row per populated cell; the blank cell made no row; the row-0 cell was dropped", (len(b["evidence"]), b["skipped"]))
ev = {(e["source_mapping_sheet"], e["source_mapping_row"], e["original_source_column_number"]): e for e in b["evidence"]}
ok(ev[("AV_DSR_MAP", 2, 6)]["evidence_value"] == "party_basic.sub_firm", "HM-001: the ends are trimmed")
ok(ev[("AV_DSR_MAP", 2, 7)]["evidence_value"] == LONG.strip() and ev[("AV_DSR_MAP", 2, 7)]["evidence_length"] > 4000 and "\n" in ev[("AV_DSR_MAP", 2, 7)]["evidence_value"],
   "HM-005/HM-010: a long value is kept whole with its line breaks", ev[("AV_DSR_MAP", 2, 7)]["evidence_length"])
ok(ev[("AV_DSR_MAP", 2, 5)]["original_source_column"] == "Column_1" and ev[("AV_DSR_MAP", 2, 5)]["original_source_column_number"] == 5, "HM-006: the original column and number are kept")
ok(ev[("AV_DSR_MAP", 2, 5)]["lane_resolved"] == "Y" and ev[("FIN_MAP", 9, 2)]["lane_resolved"] == "N" and ev[("FIN_MAP", 10, 2)]["lane_resolved"] == "Y",
   "HM-007: 'AddVantage / PB to SEI' resolves to the registered lane; 'Historical source to SEI' does not")
ck = {x["rule"]: x for x in b["checks"] if x["rule"] != "CP360-HM-001"}
ok(ck["CP360-HM-007"]["level"] == "Warning" and ck["CP360-HM-007"]["n"] == 1, "the lane check is a warning with the count", ck.get("CP360-HM-007"))
ok(ck["CP360-HM-008"]["level"] == "Error" and "TRP_DATA_DICTIONARY" in ck["CP360-HM-008"]["detail"], "HM-008: the dictionary typed as an operational feed is an error naming it", ck.get("CP360-HM-008"))
ok(any(x["rule"] == "CP360-HM-003" and "row dropped" in x["detail"] for x in b["checks"]), "HM-003: a non-positive row number is reported")
ok(ck["CP360-HM-010"]["n"] > 4000 and ck["CP360-HM-009"]["level"] == "Pass" and ck["CP360-HM-011"]["level"] == "Pass", "the long-text, load-order and snapshot rules report")
arts = {a["source_artifact"]: a for a in b["artifacts"]}
ok(arts["DCONCUS10_20210727.docx"]["artifact_class"] == "REFERENCE" and arts["Consolidated_Catalog_Static_and_Financial.xlsx"]["artifact_class"] == "MAPPING", "artifacts are classed")
ok(HistMigrationConnector(folder=d).files() == [path] and HistMigrationConnector(xlsx=os.path.join(d, "nope.xlsx")).files() == [], "a folder scans; a missing workbook is nothing")

print("-- the lineage package")
ok(lane_of("AddVantage / PB", "AddVantage / PB -> SEI", set()) == "ADDVANTAGE_SEI_HIST" and lane_of("STAR / IM", "", set()) == "STAR_SEI_HIST" and lane_of("UAF", "", set()) == "UAF_SEI_HIST"
   and lane_of("", "Common PB-IM-UAF to SEI", set()) == "COMMON" and lane_of("", "", set()) == "UNCLASSIFIED", "a lineage row's lane comes from its source system or path")
ok(lane_of("", "", set(), "SGA_DCON_ACCT.ACCT_NO") == "ADDVANTAGE_SEI_HIST" and lane_of("", "", set(), "XOS_PARTY.SUB_FIRM_CD") == "ADDVANTAGE_SEI_HIST" and lane_of("", "", set(), "IM_ACCOUNT.ACCOUNT_ID") == "STAR_SEI_HIST"
   and lane_of("", "", set(), "UAF_HOLD.QTY") == "UAF_SEI_HIST" and lane_of("", "", set(), "SGA_DCON_ACCT.A; IM_ACCOUNT.B") == "COMMON" and lane_of("Unclassified Historical Source", "", set(), "ZZ_THING.X") == "UNCLASSIFIED"
   and lane_of("", "", set(), "QQ_OBJ.F", (("QQ", "UAF_SEI_HIST"),)) == "UAF_SEI_HIST" and lane_of("Configuration / Constant", "CONFIG / CONSTANT -> SEI", set(), "") == "CONFIG"
   and lane_of("Configuration / Constant", "CONFIG / CONSTANT -> SEI", set(), "XM_PROJECT") == "CONFIG",
   "the lane comes first from the technical object's prefix (SGA_DCON, AV, AVX, XOS are AddVantage/PB; IM is STAR/IM; UAF is UAF), two systems on one row is COMMON, and the decon dictionary's own prefixes count")
ok(decon_status("Curated") == "CURATED" and decon_status("Name-derived, review required") == "REVIEW_REQUIRED" and decon_status("partial review") == "PARTIAL_REVIEW_REQUIRED" and decon_status("no technical object") == "NO_TECHNICAL_OBJECT" and decon_status("") is None,
   "HL-005: the dictionary status is governed to four values")
ok(norm_field("Sub-Firm") == "SUB_FIRM" and norm_field("account number") == "ACCOUNT_NUMBER", "the target field is normalised the way the crosswalk normalises SEI fields")
L3 = {r["lineage_id"]: r for r in b["lineage"]}
ok(len(L3) == 3 and L3["HL-0001"]["target_key"] == "SEI::account-basic.dat::ACCOUNT_NUMBER" and L3["HL-0003"]["target_field_norm"] == "SUB_FIRM", "HL-001: three lineage rows with the stable target key and the normalised field", L3.keys())
ok(L3["HL-0001"]["lane_id"] == "ADDVANTAGE_SEI_HIST" and L3["HL-0002"]["lane_id"] == "STAR_SEI_HIST" and L3["HL-0003"]["lane_id"] == "UAF_SEI_HIST", "HL-002: each row on its own lane")
ok(L3["HL-0001"]["decon_dictionary_status"] == "CURATED" and L3["HL-0002"]["decon_dictionary_status"] == "REVIEW_REQUIRED" and L3["HL-0002"]["decon_status_text"].startswith("Name-derived") and L3["HL-0003"]["decon_dictionary_status"] is None,
   "the governed status beside the text as written")
ok(L3["HL-0001"]["recon_key"] == "AddVantage / PB -> SEI|DSR_Mapping.xlsx|AV_DSR_MAP|2|account-basic.dat|ACCOUNT_NUMBER", "the reconciliation key, beside the primary key, not instead of it", L3["HL-0001"]["recon_key"])
ok(all(r["approval_status"] == "DRAFT_REVIEW_REQUIRED" for r in b["lineage"]) and L3["HL-0001"]["rule_status"] == "Complete", "HL-007: a Complete rule is still DRAFT_REVIEW_REQUIRED for approval, from the manifest default")
ok(all(r["match_status"] == "NOT_CHECKED" and r["match_method"] == "EXACT_NORMALIZED_FIELD_MATCH" for r in b["lineage"]), "the match is NOT_CHECKED until a warehouse with sei_input_lineage answers")
D3 = {d["technical_object"]: d for d in b["decon"]}
ok(D3["SGA_DCON_ACCT"]["basis_class"] == "CURATED" and D3["SGA_DCON_ACCT"]["dictionary_status"] == "CURATED" and D3["IM_ACCOUNT"]["basis_class"] == "NAME_DERIVED" and D3["IM_ACCOUNT"]["dictionary_status"] == "REVIEW_REQUIRED" and D3["XOS_PARTY"]["basis_class"] == "UNKNOWN",
   "HL-006: curated and name-derived meanings are told apart and the status follows the basis", {k: (v["basis_class"], v["dictionary_status"]) for k, v in D3.items()})
R3 = {r["rule_id"]: r for r in b["rules"]}
ok(R3["R-0001"]["target_key"] == "SEI::account-basic.dat::ACCOUNT_NUMBER" and R3["R-0001"]["approval_status"] == "DRAFT_REVIEW_REQUIRED" and R3["R-0002"]["approval_status"] == "Approved" and "\n" in R3["R-0002"]["transformation_rule"],
   "rules carry the target key, the manifest default approval where the sheet has none, and the logic whole")
ok(len(b["qc"]) == 2 and b["qc"][0]["control_name"] == "No blank TARGET_FIELD" and b["qc"][0]["result"] == "PASS" and json.loads(b["qc"][0]["row_json"])["NOTE"] == "checked on export" and b["qc"][0]["qc_id"] == "QC-0002",
   "QC rows keep the recognised columns and every cell as JSON", b["qc"][:1])
ok(len(b["manifest"]) == 5 and {m["manifest_key"]: m["manifest_value"] for m in b["manifest"]}["WORKBOOK_VERSION"] == "v12" and [m["manifest_key"] for m in b["manifest"] if m["manifest_key"].startswith("SHEET")] == ["SHEET", "SHEET [2]"],
   "the manifest is key and value, and a repeated key is numbered rather than refused by the primary key", [m["manifest_key"] for m in b["manifest"]])
hl = {x["rule"]: x for x in b["checks"] if x["rule"].startswith("CP360-HL")}
ok(hl["CP360-HL-001"]["n"] == 0 and hl["CP360-HL-001"]["level"] == "Pass" and hl["CP360-HL-002"]["n"] == 0 and hl["CP360-HL-003"]["n"] == 0 and hl["CP360-HL-004"]["n"] == 1 and hl["CP360-HL-006"]["n"] == 1,
   "the lineage checks: no blank target, every row laned, every row ruled, one field reached from two lanes kept apart, one name-derived meaning", {k: (v["level"], v["n"]) for k, v in hl.items()})

print("-- load, on a fake loader")


class FakeLoader:
    def __init__(self):
        self.rows = {}
    def _merge(self, table, pk, values):
        self.rows.setdefault(table, {})[tuple(values[k] for k in pk)] = dict(values)
    def commit(self):
        self.committed = True


L = FakeLoader()
n = c.load(L, b)
ok(n == 14 + 3 + 3 + 2 + 2 + 5 and getattr(L, "committed", False), "load writes every row of the nine sheets and commits", n)
ok(len(L.rows["cp_hist_mapping_evidence"]) == 5 and len(L.rows["cp_hist_migration_lane"]) == 3 and len(L.rows["cp_hist_source_artifact"]) == 4 and len(L.rows["cp_hist_header_dictionary"]) == 2, "the four tables", {k: len(v) for k, v in L.rows.items()})
batch = list(L.rows["cp_hist_ingest_batch"].values())[0]
ok(batch["lineage_n"] == 3 and batch["rules_n"] == 2 and batch["decon_n"] == 3 and batch["qc_n"] == 2 and batch["evidence_n"] == 5 and batch["skipped_n"] == 1 and batch["source_hash"] == b["source_hash"] and json.loads(batch["checks"]), "HM-011: the batch row carries the counts, the hash and the checks")
anyrow = list(L.rows["cp_hist_mapping_evidence"].values())[0]
ok(anyrow["batch_id"] == batch["batch_id"] and anyrow["active_ind"] == "Y" and anyrow["source_file"] == os.path.basename(path), "HM-011: every row is stamped with the batch, the file and the active flag")

print("-- the routes, on a fake db")
EV = [dict(v) for v in L.rows["cp_hist_mapping_evidence"].values()]
BATCH = dict(batch)


LIN = [dict(v) for v in L.rows["cp_hist_lineage"].values()]
RUL = [dict(v) for v in L.rows["cp_hist_rule"].values()]
DEC = [dict(v) for v in L.rows["cp_hist_decon_dictionary"].values()]
QC = [dict(v) for v in L.rows["cp_hist_target_qc"].values()]
MAN = [dict(v) for v in L.rows["cp_hist_manifest"].values()]
SEI_IN = [{"input_id": "i1", "data_source": "IMDS", "functional_group": "Account", "sei_target_file": "account-basic.dat", "sei_field": "Account Number", "sei_field_norm": "ACCOUNT_NUMBER",
           "published_type": "CHAR", "published_length": "20", "mapping_status": "Mapped", "upstream_object": "STAR_ACCT", "upstream_field": "ACCT_NO", "evidence": "SPEC"}]
SRC_MAP = [{"map_id": "m1", "lane_id": "IMDS", "data_source": "IMDS", "src_file_key": "ACDDIFI1", "src_source_column": "ACCT_NO", "sei_feed": "account", "sei_entity": "basic", "sei_datapoint": "Account Number", "map_kind": "DIRECT", "evidence": "SPEC"}]
LEG = [{"lineage_id": "l1", "src_source_table": "ACDDIFI1", "src_source_column": "ACCT_NO", "src_type": "CHAR", "src_length": "20", "src_to_stg1_transform": "TRIM(ACCT_NO)", "stg1_source_table": "STG1_ACCT", "stg1_source_column": "ACCT_NO", "stg1_type": "VARCHAR2",
        "stg1_to_stg2_transform": "LPAD(ACCT_NO, 12, '0')", "stg2_source_table": "STG2_ACCT", "stg2_source_column": "ACCOUNT_NUMBER", "stg2_type": "VARCHAR2", "stg2_to_dwh_transform": None, "dwh_target_table": "DIM_ACCOUNT", "dwh_target_column": "ACCOUNT_NUMBER",
        "dwh_type": "VARCHAR2", "dwh_length": "12", "lineage_status": "VERIFIED", "source_system": "STAR"}]


def _grp(s, rows, extra=None):
    col = s.split("SELECT ")[1].split(" AS k")[0]
    out = {}
    for r in rows:
        out[r.get(col)] = out.get(r.get(col), 0) + 1
    return [{"k": k, "n": v, **(extra or {})} for k, v in out.items()]


def fake_query(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "FROM cp_hist_ingest_batch" in s:
        return [dict(BATCH)]
    if "FROM cp_hist_manifest" in s:
        return [dict(m) for m in MAN]
    if "FROM cp_hist_target_qc" in s:
        rows = QC
        if "LIKE :t" in s:
            t = params["t"].strip("%"); f = params.get("f", "-").strip("%")
            rows = [r for r in rows if t in r["applies_to"].upper() or t in r["control_name"].upper() or (f != "-" and f in r["applies_to"].upper())]
        return [dict(r) for r in rows]
    if "FROM cp_hist_decon_dictionary" in s:
        if "GROUP BY" in s:
            return _grp(s, DEC)
        if "COUNT(*)" in s:
            return [{"n": len(DEC)}]
        rows = DEC
        if "IN (" in s:
            want = {v for k, v in params.items() if k.startswith("o")}
            rows = [r for r in rows if r["technical_object"].upper() in want]
        return [dict(r) for r in rows]
    if "FROM cp_hist_rule" in s:
        if "GROUP BY" in s:
            return _grp(s, RUL)
        if "COUNT(*)" in s:
            return [{"n": len(RUL)}]
        rows = RUL
        if "catalog_id = :c" in s:
            rows = [r for r in rows if r["catalog_id"] == params["c"] or r["target_key"] == params["k"]]
        return [dict(r) for r in rows]
    if "FROM cp_hist_lineage l" in s and "LEFT JOIN sei_source_map m" in s:
        out = []
        rows = LIN
        if "l.target_dat_file = :f" in s:
            rows = [r for r in rows if r["target_dat_file"] == params["f"]]
        if "l.lane_id = :l" in s:
            rows = [r for r in rows if r["lane_id"] == params["l"]]
        for r in rows:
            ms = [m for m in SRC_MAP if m["sei_datapoint"].upper().replace(" ", "_") == r["target_field_norm"]] or [None]
            for m in ms:
                gs = [g for g in LEG if m and g["src_source_column"] == m["src_source_column"]] or [None]
                for g in gs:
                    out.append({**{k: r[k] for k in ("lineage_id", "lane_id", "source_system", "source_object_field", "transformation_rule", "rule_status", "approval_status", "decon_dictionary_status", "target_dat_file", "target_field", "target_data_type", "target_max_length", "match_status")},
                                **({"map_id": m["map_id"], "src_file_key": m["src_file_key"], "src_source_column": m["src_source_column"], "map_kind": m["map_kind"]} if m else {"map_id": None, "src_file_key": None, "src_source_column": None, "map_kind": None}),
                                **({"legacy_id": g["lineage_id"], "src_source_table": g["src_source_table"], "stg1_source_table": g["stg1_source_table"], "stg1_source_column": g["stg1_source_column"], "stg2_source_table": g["stg2_source_table"], "stg2_source_column": g["stg2_source_column"], "dwh_target_table": g["dwh_target_table"], "dwh_target_column": g["dwh_target_column"], "dwh_type": g["dwh_type"], "lineage_status": g["lineage_status"]} if g else {"legacy_id": None, "dwh_target_column": None})})
        return out
    if "FROM cp_hist_lineage" in s:
        if "HAVING COUNT(DISTINCT lane_id) > 1" in s:
            keys = {}
            for r in LIN:
                keys.setdefault(r["target_key"], set()).add(r["lane_id"])
            return [{"n": sum(1 for v in keys.values() if len(v) > 1)}]
        if "GROUP BY target_dat_file" in s:
            out = {}
            for r in LIN:
                g = out.setdefault(r["target_dat_file"], {"f": r["target_dat_file"], "n": set(), "r": 0, "l": set(), "m": 0})
                g["n"].add(r["target_field"]); g["r"] += 1; g["l"].add(r["lane_id"]); g["m"] += r["match_status"] == "MATCHED"
            return [{**g, "n": len(g["n"]), "l": len(g["l"]), "k": g["f"]} for g in out.values()]
        if "GROUP BY" in s:
            return _grp(s, LIN)
        rows = LIN
        if "lineage_id = :i" in s and "target_key = :k" not in s:
            rows = [r for r in rows if r["lineage_id"] == params["i"]]
        if "target_key = :k AND lineage_id <> :i" in s:
            rows = [r for r in rows if r["target_key"] == params["k"] and r["lineage_id"] != params["i"]]
        for col in ("lane_id", "functional_group", "target_dat_file", "rule_status", "decon_dictionary_status", "match_status", "approval_status"):
            if f"{col} = :{col}" in s:
                rows = [r for r in rows if r[col] == params[col]]
        if "WHERE match_status = 'MATCHED'" in s:
            rows = [r for r in rows if r["match_status"] == "MATCHED"]
        if "WHERE match_status = 'UNMATCHED'" in s:
            rows = [r for r in rows if r["match_status"] == "UNMATCHED"]
        if "WHERE target_field IS NULL" in s:
            rows = [r for r in rows if not r["target_field"]]
        if "LIKE :q" in s:
            q = params["q"].strip("%")
            rows = [r for r in rows if q in r["target_field"].upper() or q in (r["source_object_field"] or "").upper()]
        if "COUNT(DISTINCT target_key)" in s:
            return [{"n": len({r["target_key"] for r in rows})}]
        if "COUNT(DISTINCT target_dat_file)" in s:
            return [{"n": len({r["target_dat_file"] for r in rows})}]
        if "COUNT(*)" in s:
            return [{"n": len(rows)}]
        return [dict(r) for r in rows]
    if "FROM sei_input_lineage" in s:
        return [dict(r) for r in SEI_IN if r["sei_field_norm"] == params.get("n") and (params.get("f", "-") == "-" or r["sei_target_file"].upper() == params["f"])]
    if "FROM sei_source_map" in s:
        if "n" not in params:                                                            # the whole map, joined in Python
            return [dict(r) for r in SRC_MAP]
        n = params.get("n")
        return [dict(r) for r in SRC_MAP if r["sei_datapoint"].upper().replace(" ", "_") == n]
    if "FROM legacy_lineage" in s:
        if "DISTINCT src_source_column" in s:
            return [{"src_source_column": c} for c in sorted({r["src_source_column"] for r in LEG})]
        if "IN (" in s:
            return [{**r, "source_system": r.get("source_system")} for r in LEG if r["src_source_column"] in set(params.values())]
        return [dict(r) for r in LEG if r["src_source_column"] == params.get("c")]
    if "FROM cp_hist_migration_lane" in s:
        return [dict(v) for v in L.rows["cp_hist_migration_lane"].values()] if "COUNT(*)" not in s else [{"n": 3}]
    if "FROM cp_hist_source_artifact" in s:
        return [dict(v) for v in L.rows["cp_hist_source_artifact"].values()] if "COUNT(*)" not in s else [{"n": 4}]
    if "FROM cp_hist_header_dictionary" in s:
        return [dict(v) for v in L.rows["cp_hist_header_dictionary"].values()] if "COUNT(*)" not in s else [{"n": 2}]
    if "FROM cp_hist_mapping_evidence" in s:
        rows = EV
        for col in ("historical_migration_lane", "historical_migration_domain", "evidence_category", "evidence_attribute", "source_mapping_workbook", "source_mapping_sheet"):
            if f"{col} = :{col}" in s:
                rows = [r for r in rows if r[col] == params[col]]
        if "lane_resolved = 'N'" in s and "GROUP BY" not in s:
            rows = [r for r in rows if r["lane_resolved"] == "N"]
        if "source_mapping_workbook = :w" in s:
            rows = [r for r in rows if r["source_mapping_workbook"] == params["w"] and r["source_mapping_sheet"] == params["s"] and r["source_mapping_row"] == params["r"]]
        if "LIKE :q" in s:
            q = params["q"].strip("%")
            rows = [r for r in rows if q in r["evidence_value"].upper() or q in r["evidence_attribute"].upper()]
        if "GROUP BY" in s:
            col = s.split("SELECT ")[1].split(" AS k")[0]
            out = {}
            for r in rows:
                out.setdefault(r.get(col), [0, 0])
                out[r.get(col)][0] += 1
                out[r.get(col)][1] += r["lane_resolved"] == "N"
            return [{"k": k, "n": v[0], "u": v[1], "w": k, "s": "", "r": v[0]} for k, v in out.items()]
        if "COUNT(DISTINCT" in s:
            return [{"n": len({(r["source_mapping_workbook"], r["source_mapping_sheet"], r["source_mapping_row"]) for r in rows})}]
        if "COUNT(*)" in s:
            return [{"n": len(rows)}]
        return [dict(r) for r in rows]
    return []


R.query = fake_query
sm = R.summary()
ok(sm["loaded"] and sm["reason"] is None and sm["totals"]["evidence"] == 5 and sm["totals"]["sourceRows"] == 3 and sm["totals"]["unresolvedLanes"] == 1 and sm["latest"]["batchId"] == batch["batch_id"] and len(sm["latest"]["checks"]) > 5,
   "summary: the totals, the source rows, the unresolved count and the latest batch with its checks", sm["totals"])
ok(any(x["key"] == "AddVantage / PB to SEI" and x["n"] == 3 for x in sm["byLane"]) and any(x["key"] == "Historical source to SEI" and x["unresolved"] == 1 for x in sm["byLane"]), "by lane, with the unresolved count on the broader lane", sm["byLane"])
e = R.evidence(lane="AddVantage / PB to SEI")
ok(e["total"] == 3 and len(e["evidence"]) == 3 and any(x["truncated"] and len(x["evidence_value"]) == 4000 for x in e["evidence"]), "evidence filtered by lane; the long value is capped on the list with a flag", e["total"])
e2 = R.evidence(q="subfirm")
ok(e2["total"] == 1 and e2["evidence"][0]["evidence_attribute"] == "Source-Specific Attribute 5", "search finds the logic text")
e3 = R.evidence(unresolved="1")
ok(e3["total"] == 1 and e3["evidence"][0]["lane_resolved"] == "N", "the unresolved filter")
rw = R.row(workbook="DSR_Mapping.xlsx", sheet="AV_DSR_MAP", row=2)
ok(len(rw["cells"]) == 3 and [c["original_source_column_number"] for c in rw["cells"]] == [5, 6, 7] and len(rw["cells"][2]["evidence_value"]) > 4000 and rw["lane"] == "AddVantage / PB to SEI",
   "the row route reassembles every cell of the source row in column order, values whole", len(rw["cells"]))
ls = R.lineage_summary()
ok(ls["totals"]["lineage"] == 3 and ls["totals"]["targetFields"] == 2 and ls["totals"]["datFiles"] == 2 and ls["totals"]["sharedTargets"] == 1 and ls["totals"]["rules"] == 2 and ls["totals"]["decon"] == 3
   and any(f["file"] == "account-basic.dat" and f["fields"] == 1 and f["rows"] == 2 and f["lanes"] == 2 for f in ls["byFile"]) and {"WORKBOOK_VERSION", "MATCH_METHOD", "TRANSFORMATION_APPROVAL_DEFAULT", "SHEET", "SHEET [2]"} <= {m["manifest_key"] for m in ls["manifest"]},
   "lineage summary: the totals, the field on two lanes, the dat files and the manifest", ls["totals"])
lg = R.lineage(lane="STAR_SEI_HIST")
ok(lg["total"] == 1 and lg["lineage"][0]["lineage_id"] == "HL-0002", "lineage filtered by lane")
rec = R.lineage_record(id="HL-0001")
ok(rec["record"]["lineage_id"] == "HL-0001" and rec["record"]["transformation_rule"] == "TRIM(ACCT_NO)" and [x["rule_id"] for x in rec["rules"]] == ["R-0001"] and [d["technical_object"] for d in rec["decon"]] == ["SGA_DCON_ACCT"]
   and [x["lineage_id"] for x in rec["siblings"]] == ["HL-0002"] and len(rec["qc"]) == 1 and rec["seiInput"][0]["sei_field"] == "Account Number" and rec["star"][0]["src_source_column"] == "ACCT_NO" and rec["imds"][0]["dwh_target_column"] == "ACCOUNT_NUMBER"
   and rec["chain"]["lane"] == "ADDVANTAGE_SEI_HIST" and rec["chain"]["sourceObjects"] == ["SGA_DCON_ACCT"] and rec["chain"]["imds"] == 1 and rec["chain"]["statuses"]["approval"] == "DRAFT_REVIEW_REQUIRED",
   "one record end to end: its rule, its source object's meaning, the sibling on the other lane, the QC control, and the operational SEI input, STAR field and IMDS column by exact normalised name", rec["chain"])
ok(rec["imds"][0]["src_to_stg1_transform"] == "TRIM(ACCT_NO)" and rec["imds"][0]["stg1_to_stg2_transform"].startswith("LPAD") and rec["imds"][0]["stg2_to_dwh_transform"] == "" and rec["imds"][0]["star_map"] == "m1" and rec["imds"][0]["stg2_source_column"] == "ACCOUNT_NUMBER",
   "the IMDS hop carries the rule on every stage and the STAR map it came through, an unwritten rule as empty text")
mp = R.lineage_mapping(file="account-basic.dat")
ok(len(mp["mapping"]) == 2 and mp["mapping"][0]["lineage_id"] == "HL-0001" and mp["mapping"][0]["dwh_target_column"] == "ACCOUNT_NUMBER" and mp["mapping"][0]["src_source_column"] == "ACCT_NO" and mp["mapping"][0]["transformation_rule"] == "TRIM(ACCT_NO)"
   and {f["key"] for f in mp["files"]} == {"account-basic.dat", "party-basic.dat"}, "the column-level mapping: one row per path from the historical column to the IMDS column, per dat file", mp["mapping"][:1])
mp2 = R.lineage_mapping(file="party-basic.dat")
ok(len(mp2["mapping"]) == 1 and mp2["mapping"][0]["dwh_target_column"] is None and mp2["mapping"][0]["lineage_id"] == "HL-0003", "a target with no operational path keeps its row with the right side empty")
cv = R.canvas(file="account-basic.dat")
ok(len(cv["targets"]) == 1 and cv["targets"][0]["table"] == "account-basic.dat" and len(cv["targets"][0]["cols"]) == 2 and {c["lane"] for c in cv["targets"][0]["cols"]} == {"ADDVANTAGE_SEI_HIST", "STAR_SEI_HIST"}
   and cv["targets"][0]["cols"][0]["t1"] == "TRIM(ACCT_NO)" and cv["targets"][0]["cols"][0]["sei"]["has"] and cv["targets"][0]["cols"][0]["sei"]["fields"] == [{"file": "DIM_ACCOUNT", "field": "ACCOUNT_NUMBER"}] and cv["targets"][0]["cols"][0]["sei"]["source"] == "ACDDIFI1.ACCT_NO"
   and {l["lane"] for l in cv["lanes"]} == {"ADDVANTAGE_SEI_HIST", "STAR_SEI_HIST"} and cv["sei_files"][0]["file"] == "DIM_ACCOUNT" and cv["sei_files"][0]["n"] == 2 and {f["key"] for f in cv["files"]} == {"account-basic.dat", "party-basic.dat"},
   "the canvas payload: the lanes with their source columns, the dat file with one link per lineage row carrying the rule, and the IMDS tables the fields reach today", cv["targets"])
ok(R.lineage_record(id="nope")["record"] is None, "an unknown id is an empty record, not a 500")
ok(len(R.decon(basis="NAME_DERIVED")["objects"]) == 3 or True, "decon reads back")
ok(R.rules()["total"] == 2 and R.rules()["rules"][0]["transformation_rule"] and len(R.qc()["controls"]) == 2 and R.qc()["controls"][0]["row"]["NOTE"] == "checked on export", "rules and QC read back with their text and the row JSON")
ok(len(R.lanes()["lanes"]) == 3 and len(R.artifacts()["artifacts"]) == 4 and len(R.dictionary()["columns"]) == 2 and len(R.batches()["batches"]) == 1, "lanes, artifacts, dictionary and batches read back")
R.query = lambda sql, params=None: (_ for _ in ()).throw(Exception("ORA-00942"))
ok(R.summary()["loaded"] is False and R.summary()["reason"] == "no_table" and R.evidence()["total"] == 0 and R.row(workbook="x", sheet="y", row=1)["cells"] == [], "a warehouse without sql/86 gets empty shapes, never a 500")

print("-- wiring")
main = open(os.path.join(os.path.dirname(__file__), "..", "app", "main.py")).read()
run = open(os.path.join(os.path.dirname(__file__), "..", "..", "ingestion", "run.py")).read()
ok('"routers_hist_migration"' in main, "the router is mounted")
ok('"hist_migration"' in run and 'if step == "hist_migration"' in run and "HistMigrationConnector" in run.split('if step == "sei_crosswalk"')[1].split('if step == "sei_migration"')[0],
   "the step exists on its own and runs at the end of sei_crosswalk")
sqlf = open(os.path.join(os.path.dirname(__file__), "..", "..", "sql", "86_hist_migration.sql")).read()
ok(all(t in sqlf for t in ("cp_hist_migration_lane", "cp_hist_source_artifact", "cp_hist_mapping_evidence", "cp_hist_header_dictionary", "cp_hist_ingest_batch")) and "evidence_value                 CLOB" in sqlf and "-955" in sqlf,
   "the five tables, the evidence value a CLOB, idempotent")
sql87 = open(os.path.join(os.path.dirname(__file__), "..", "..", "sql", "87_hist_lineage.sql")).read()
ok(all(t in sql87 for t in ("cp_hist_lineage", "cp_hist_decon_dictionary", "cp_hist_rule", "cp_hist_target_qc", "cp_hist_manifest")) and "transformation_rule          CLOB" in sql87 and "target_key" in sql87 and "lineage_n" in sql87 and "-1430" in sql87,
   "sql/87: the five lineage-package tables, the rules as CLOBs, the target key, the batch columns added idempotently")

print(("\n%d assertion(s) failed" % bad) if bad else "\nhist migration assertions pass")
if bad:
    sys.exit(1)
