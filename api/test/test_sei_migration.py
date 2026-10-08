"""Data Analysis: the readings, the reader, the routes.

WHY THESE ASSERTIONS. The page draws what ingest wrote, so the readings
are the feature: a mandatory matrix read as ALWAYS when one account type
says NO would put a field in the wrong bucket on every screen; a rule
classed DIRECT because "select" was spelled with a capital would hide a
lookup; a header matched by exact text would drop the DSR columns the
moment someone retypes them. Each rule is pinned on text shaped like the
catalog's, with synthetic wording. Then the reader end to end from a
workbook, then the routes on a fake db, then the findings.

    python api/test/test_sei_migration.py
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ingestion.sei_migration_rules import (classify_mandatory, classify_rule, country_specific,   # noqa: E402
                                           effective_rule, flags, normalize_status, parse_sources,
                                           parse_targets, role_of, system_of)
from ingestion.sei_migration_conn import (SeiMigrationConnector, find_header_row, has_catalog_shape,   # noqa: E402
                                          map_headers, read_row)
from api.app import routers_sei_migration as R                 # noqa: E402

bad = 0


def ok(cond, msg, got=None):
    global bad
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {got!r}"))
    if not cond:
        bad += 1


MATRIX_ALL = "House Account: YES | INVESTMENT ACCOUNT: YES | ROTH IRA ACCOUNT: YES | SIMPLE IRA ACCOUNT: YES"
MATRIX_SOME = "House Account: N/A | INVESTMENT ACCOUNT: NO | ROTH IRA ACCOUNT: YES | TRADITIONAL IRA ACCOUNT: YES"
MATRIX_NONE = "House Account: NO | INVESTMENT ACCOUNT: NO | ROTH IRA ACCOUNT: NO"
MATRIX_NA = "House Account: YES | INVESTMENT ACCOUNT: N/A | ROTH IRA ACCOUNT: N/A"

print("-- mandatory: the per-account-type matrix")
m = classify_mandatory(MATRIX_ALL)
ok(m["class"] == "ALWAYS" and m["yes"] == 4 and m["no"] == 0, "every type YES is ALWAYS", m)
m = classify_mandatory(MATRIX_SOME)
ok(m["class"] == "CONDITIONAL" and m["yes"] == 2 and m["no"] == 1 and m["na"] == 1, "some YES, some NO is CONDITIONAL", m)
ok(classify_mandatory(MATRIX_NONE)["class"] == "OPTIONAL", "every type NO is OPTIONAL")
ok(classify_mandatory(MATRIX_NA)["class"] == "ALWAYS", "YES beside N/A is still ALWAYS: it applies where it applies")
ok(classify_mandatory("INVESTMENT ACCOUNT: N/A | ROTH IRA ACCOUNT: N/A")["class"] == "NOT_APPLICABLE", "all N/A")
ok(classify_mandatory("Y")["class"] == "ALWAYS" and classify_mandatory("No")["class"] == "OPTIONAL", "a bare Y/N still reads")
ok(classify_mandatory("")["class"] == "UNKNOWN" and classify_mandatory(None)["class"] == "UNKNOWN", "an empty cell is UNKNOWN, not optional")

print("-- status")
ok(normalize_status("Complete") == ("COMPLETE", ""), "Complete")
ok(normalize_status("NA-UK | Complete") == ("COMPLETE", "NA-UK"), "a qualified complete keeps its qualifier as detail", normalize_status("NA-UK | Complete"))
ok(normalize_status("Pending BBH review")[0] == "OPEN", "pending is OPEN")
ok(normalize_status("Open question to SEI")[0] == "BLOCKED", "a question is BLOCKED")
ok(normalize_status("N/A")[0] == "NA" and normalize_status("")[0] == "UNSPECIFIED", "N/A and empty")

print("-- the effective rule: BBH's answer after the dashes")
r, side = effective_rule("select firm_name from firm where firm_id=FIRM_ID", "select firm_name from firm where firm_id=FIRM_ID\n ---\n Set to SWP firm Id from Config")
ok(r == "Set to SWP firm Id from Config" and side == "BBH", "the part after --- is the rule", (r, side))
r, side = effective_rule("CASE WHEN x THEN 1 END", "")
ok(r.startswith("CASE") and side == "SEI", "no BBH cell: SEI's logic, marked SEI", (r, side))
ok(effective_rule("", "") == ("", "NONE"), "nothing written")
ok(effective_rule("", "Account_Short_Name") == ("Account_Short_Name", "BBH"), "no dashes: the whole cell")

print("-- rule classes")
cases = [
    ("", "NOT_MAPPED"), ("N/A", "NOT_APPLICABLE"), ("Not migrated - reporting structure only", "NOT_APPLICABLE"),
    ("Set to Null", "SET_NULL"), ("Set to SWP firm Id from Config", "CONSTANT"), ("Individual", "CONSTANT"),
    ("Investment Account", "CONSTANT"), ("Account_Short_Name", "DIRECT"), ("IM_UAF_PACE_ACCOUNT.BBH_ACCOUNT_NUMBER", "DIRECT"),
    ("Concatenate these LONG NAME fields (with a space) from IM_UAF_PACE_ACCOUNT, ignore the nulls", "CONCATENATE"),
    ("WHEN XAB.HOUSE_ACCOUNT_TYPE = 2 THEN 2 ELSE 1 END", "CONDITIONAL"),
    ("If Trustee_Location_Code (IM_UAF_PACE_ACCOUNT) is not equal to (0,40) then Trust Company else Capital Partners", "CONDITIONAL"),
    ("Select subfirm_name from subfirm where firm_id=FIRM_ID", "LOOKUP"), ("Map through AV_ACCOUNT_TYPE_MAP", "LOOKUP"),
    ("Convert YYYY/MM/DD to ISO date", "TRANSFORM"), ("Remove non-numeric characters", "TRANSFORM"),
    ("Migration will be driven by the relationship between the master account and its sector accounts", "DERIVED"),
    ("Truncate to 256 and report out", "TRANSFORM"),
]
for text, want in cases:
    ok(classify_rule(text) == want, f"{want:<14} <- {text[:50]!r}", classify_rule(text))
ok(classify_rule("ACCOUNT_NUMBER", "ACCOUNT_NUMBER") == "DIRECT", "the attribute's own name is DIRECT")

print("-- sources: tables, fields, systems, roles")
ok(system_of("IM_UAF_PACE_ACCOUNT") == "UAF" and system_of("IM_ACCOUNT_CLASSIFICATION") == "IM", "IM_UAF_ is UAF, IM_ is IM")
ok(system_of("XOS_HOUSE_ACCOUNT_MAP") == "CONVERSION" and system_of("AV_DEFAULTS") == "ADDVANTAGE", "XOS_ and AV_")
ok(system_of("SGA_DCON_ACCT_MST_BASIC") == "PB" and system_of("Config_Firms_List") == "SEI_CONFIG", "SGA_ and Config_")
ok(role_of("XOS_HOUSE_ACCOUNT_MAP") == "CROSSWALK" and role_of("XOS_NON_MIGRATING_ACCTS") == "CROSSWALK" and role_of("AV_DEFAULTS") == "CROSSWALK", "maps and exclusion lists are crosswalks")
ok(role_of("IM_UAF_PACE_ACCOUNT") == "SOURCE" and role_of("Config_Subfirm_List") == "CONFIG", "a source and a config list")
s = parse_sources("XOS_HOUSE_ACCOUNT_MAP\n XOS_NON_MIGRATING_ACCTS\n AV_DEFAULTS | IM_ACCOUNT_CLASSIFICATION",
                  "Use StarId from IM_ACCOUNT_CLASSIFICATION to match Entity_number from IM_ACCOUNT_DETAIL. Use IM_ACCOUNT_DETAIL.CUSTODY_HEAD_ACCOUNT_NUMBER to match IM_UAF_PACE_ACCOUNT.BBH_ACCOUNT_NUMBER")
tables = {x["table"] for x in s}
ok({"XOS_HOUSE_ACCOUNT_MAP", "XOS_NON_MIGRATING_ACCTS", "AV_DEFAULTS", "IM_ACCOUNT_CLASSIFICATION", "IM_ACCOUNT_DETAIL", "IM_UAF_PACE_ACCOUNT"} <= tables,
   "every table in the Tables column and in the rule is found", tables)
ok(any(x["table"] == "IM_ACCOUNT_DETAIL" and x["field"] == "CUSTODY_HEAD_ACCOUNT_NUMBER" and x["how"] == "RULE" for x in s), "TABLE.FIELD in the rule gives the field")
ok(any(x["table"] == "IM_UAF_PACE_ACCOUNT" and x["field"] == "BBH_ACCOUNT_NUMBER" for x in s), "and the second one")
s = parse_sources("IM_UAF_PACE_ACCOUNT", "Concatenate these LONG NAME fields (with a space) from IM_UAF_PACE_ACCOUNT, Ignore the Nulls\n Legal_Title_Line_1\n Legal_Title_Line_2\n Legal_Title_Line_3")
ok(sorted(x["field"] for x in s if x["how"] == "INFERRED") == ["Legal_Title_Line_1", "Legal_Title_Line_2", "Legal_Title_Line_3"],
   "Title_Case fields in a rule that names one table are its columns, marked INFERRED", s)
s = parse_sources("IM_UAF_PACE_ACCOUNT", "If Trustee_Location_Code (IM_UAF_PACE_ACCOUNT) is not equal to (0,40) then A else B")
ok(any(x["field"] == "Trustee_Location_Code" and x["how"] == "RULE" for x in s), "Field (TABLE) gives the field from the rule")
s = parse_sources("", "Set to Null", "Config_Tax_Wrap_Providers_List")
ok(len(s) == 1 and s[0]["role"] == "CONFIG" and s[0]["how"] == "CONFIG", "a config list from Acceptable Values, and nothing invented for Set to Null", s)
s = parse_sources("", "select firm_name from firm where firm_id=FIRM_ID")
ok(not any(x["table"].upper() in ("SELECT", "FROM", "WHERE") for x in s), "SQL words are not tables", s)

print("-- targets")
tg = parse_targets("Accounts", "FIRM_ID", "", "REPORT : Client and Account Characteristics>>Account Characteristics\n FIELD NAME: Firm Name", "Account Basic", "Account Summary/Properties")
kinds = {x["kind"]: x for x in tg}
ok(kinds["OUTBOUND"]["object"] == "Accounts" and kinds["OUTBOUND"]["field"] == "FIRM_ID", "outbound file and field", kinds.get("OUTBOUND"))
ok(kinds["BOXI"]["object"] == "Client and Account Characteristics>>Account Characteristics" and kinds["BOXI"]["field"] == "Firm Name", "BOXI report and field", kinds.get("BOXI"))
ok(kinds["ADE_CAS"]["object"] == "Account Basic" and kinds["DESKTOP"]["object"] == "Account Summary/Properties", "ADE-CAS and desktop")
tg = parse_targets("", "", "", "Client and Account Characteristics>>Account Characteristics >>Account Registration Name", "", "")
ok(tg[0]["field"] == "Account Registration Name" and tg[0]["object"].endswith("Account Characteristics"), "the >> form splits on the last >>", tg)
ok(parse_targets("", "", "", "", "", "") == [], "nothing named, nothing invented")

print("-- flags")
fl = flags("Note: If the ACCOUNT_NAME length exceeds 256 truncate till max length and then report out.", "In case resolved to Null, mitigate to ACCOUNT_NUMBER")
ok(fl == {"truncation_risk": "Y", "report_out": "Y", "null_mitigation": "Y"}, "truncation, report out and mitigation are each a flag", fl)
ok(flags("plain") == {"truncation_risk": "N", "report_out": "N", "null_mitigation": "N"}, "and absent when absent")
ok(country_specific("All") == "N" and country_specific("UK") == "Y" and country_specific("") == "N", "domicile")

print("-- the reader: headers however they are spelled")
HDR = ["Catalog_ID", "Functional_Group", "Source_System", "Source_Object", "Sequence", "Source_Attribute", "Data Type", "Max Length",
       "Max Decimal Pos", "Firm Domicile Country", "Mandatory", "Additional Validations", "Remarks", "Acceptable Values", "Desktop",
       "BOXI Report & FieldNames", "Processing Logic", "Standard Outbound Files FieldNames", "Standard Outbound Files Names",
       "Standard Outbound Transformations", "ADE-CAS Component & Field Names", "Function Category",
       "Common Logic - Employee DSR Tags - PB SGA_DCON_ACCT_MST_BASIC - IM UAF_PACE_ACCOUNT - XOS_FIRM_USER", "Employee DSR Status",
       "Common Logic - Team DSR Tags - PB SGA_DCON_ACCT_MST_BASIC - IM UAF_PACE_ACCOUNT - XOS_FIRM_USER", "Team DSR Status",
       "Other Mapping Logic", "Other Status", "Tables/Fields/Off-System", "NOTE", "Source_Workbook", "Source_Sheet"]
idx = map_headers(HDR)
ok(len(idx) == len(HDR), "every one of the 32 headers maps to a column", [h for i, h in enumerate(HDR) if i not in idx.values()])
ok(idx["emp_dsr_logic"] == 22 and idx["team_dsr_logic"] == 24 and idx["boxi_text"] == 15, "the long DSR headers and the & one land", idx)
ok(map_headers(["catalog id", "SOURCE ATTRIBUTE", "other-mapping-logic"]) == {"catalog_id": 0, "source_attribute": 1, "other_mapping_logic": 2}, "case, spaces and hyphens do not matter")
ok(has_catalog_shape(HDR) and not has_catalog_shape(["Table", "Column", "Type"]), "a sheet is taken only with Catalog_ID and Source_Attribute")
hi, hdr = find_header_row([["SEI catalog", None, None], [None, None, None], HDR[:6], ["X", "Y"]])
ok(hi == 2 and hdr[0] == "Catalog_ID", "the header row is found under a title", (hi, hdr[:2]))


def row_for(**kw):
    base = {h: "" for h in HDR}
    base.update({"Functional_Group": "Static Data", "Source_System": "SEI", "Source_Object": "account-basic.dat", "Firm Domicile Country": "All"})
    base.update(kw)
    return [base[h] for h in HDR]


ROWS = [
    row_for(Catalog_ID="SEI-ACCOUNT-BASIC-001", Sequence=1, Source_Attribute="FIRM_ID", **{"Data Type": "Numeric", "Max Length": 9, "Max Decimal Pos": 0,
            "Mandatory": MATRIX_ALL, "Acceptable Values": "Config_Firms_List", "Processing Logic": "select firm_name from firm where firm_id=FIRM_ID",
            "Standard Outbound Files FieldNames": "FIRM_ID", "Standard Outbound Files Names": "Accounts",
            "BOXI Report & FieldNames": "REPORT : Client and Account Characteristics>>Account Characteristics\n FIELD NAME: Firm Name",
            "Other Mapping Logic": "select firm_name from firm where firm_id=FIRM_ID\n ---\n Set to SWP firm Id from Config", "Other Status": "Complete",
            "Source_Workbook": "account-basic_X.xlsx", "Source_Sheet": "acct-basic"}),
    row_for(Catalog_ID="SEI-ACCOUNT-BASIC-002", Sequence=2, Source_Attribute="ACCOUNT_NUMBER", **{"Data Type": "Alpha Numeric", "Max Length": 14,
            "Mandatory": MATRIX_ALL, "Additional Validations": "1. May only contain a-z A-Z 0-9 - _",
            "Other Mapping Logic": "Use StarId from IM_ACCOUNT_CLASSIFICATION to match Entity_number from IM_ACCOUNT_DETAIL. Use IM_ACCOUNT_DETAIL.CUSTODY_HEAD_ACCOUNT_NUMBER to match IM_UAF_PACE_ACCOUNT.BBH_ACCOUNT_NUMBER",
            "Other Status": "Complete", "Tables/Fields/Off-System": "XOS_HOUSE_ACCOUNT_MAP\n XOS_NON_MIGRATING_ACCTS\n AV_DEFAULTS | IM_ACCOUNT_CLASSIFICATION",
            "ADE-CAS Component & Field Names": "Account Basic"}),
    row_for(Catalog_ID="SEI-ACCOUNT-BASIC-004", Sequence=4, Source_Attribute="ACCOUNT_REGISTRATION_NAME", **{"Data Type": "Alpha Numeric", "Max Length": 256,
            "Mandatory": MATRIX_SOME,
            "Other Mapping Logic": "Concatenate these LONG NAME fields (with a space) from IM_UAF_PACE_ACCOUNT, Ignore the Nulls\n Legal_Title_Line_1\n Legal_Title_Line_2\n\n Note:If the length exceeds 256 truncate till max length and then report out.\n Note:In case resolved to Null, mitigate to ACCOUNT_NUMBER, report out such scenarios",
            "Other Status": "Complete", "Tables/Fields/Off-System": "IM_UAF_PACE_ACCOUNT"}),
    row_for(Catalog_ID="SEI-ACCOUNT-BASIC-009", Sequence=9, Source_Attribute="TAX_WRAP_PROVIDER_ID", **{"Data Type": "Numeric", "Max Length": 9, "Firm Domicile Country": "UK",
            "Mandatory": MATRIX_NONE, "Acceptable Values": "Config_Tax_Wrap_Providers_List",
            "Processing Logic": "CASE WHEN(A.ACCOUNT_SUBTYPE_ID=6) THEN A.TAX_WRAP_PROVIDER_ID ELSE NULL END",
            "Other Mapping Logic": "CASE WHEN(A.ACCOUNT_SUBTYPE_ID=6) THEN A.TAX_WRAP_PROVIDER_ID ELSE NULL END\n ---\n Set to Null", "Other Status": "NA-UK | Complete"}),
    row_for(Catalog_ID="SEI-ACCOUNT-BASIC-011", Sequence=11, Source_Attribute="ACCOUNT_STATUS_X", **{"Data Type": "Numeric", "Max Length": 1,
            "Mandatory": MATRIX_ALL, "Other Mapping Logic": "", "Other Status": "Pending BBH review", "Employee DSR Status": "In progress",
            "Common Logic - Employee DSR Tags - PB SGA_DCON_ACCT_MST_BASIC - IM UAF_PACE_ACCOUNT - XOS_FIRM_USER": "tag when XOS_FIRM_USER matches"}),
    row_for(Catalog_ID="SEI-PARTY-BASIC-001", Source_Object="party-basic.dat", Sequence=1, Source_Attribute="PARTY_REF_ID", **{"Data Type": "Alpha Numeric",
            "Max Length": 25, "Mandatory": MATRIX_ALL, "Other Mapping Logic": "Map through AV_PARTY_MAP", "Other Status": "Complete",
            "Tables/Fields/Off-System": "AV_PARTY_MAP"}),
]


def write_xlsx(path):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Consolidated Catalog"
    ws.append(["SEI merged catalog (title row)"])
    ws.append(HDR)
    for r in ROWS:
        ws.append(r)
    ws2 = wb.create_sheet("Notes")
    ws2.append(["Table", "Column"]); ws2.append(["x", "y"])
    wb.save(path)


d = tempfile.mkdtemp()
write_xlsx(os.path.join(d, "SEI_Merged_Catalog_test.xlsx"))
c = SeiMigrationConnector(folder=d)
b = c.parse()
ok(len(b["fields"]) == 6 and b["skipped"] == ["SEI_Merged_Catalog_test.xlsx:Notes"], "six rows read from the catalog sheet, the Notes sheet skipped by name", (len(b["fields"]), b["skipped"]))
f1 = b["fields"]["SEI-ACCOUNT-BASIC-001"]["field"]
ok(f1["rule_class"] == "CONSTANT" and f1["rule_text"] == "Set to SWP firm Id from Config" and f1["rule_side"] == "BBH", "FIRM_ID: BBH's answer after the dashes, a constant", (f1["rule_class"], f1["rule_text"]))
ok(f1["mandatory_class"] == "ALWAYS" and f1["status_class"] == "COMPLETE" and f1["lookup_name"] == "Config_Firms_List", "FIRM_ID readings")
t1 = {x["target_kind"]: x for x in b["fields"]["SEI-ACCOUNT-BASIC-001"]["targets"]}
ok(t1["OUTBOUND"]["target_object"] == "Accounts" and t1["BOXI"]["target_field"] == "Firm Name", "FIRM_ID goes to the Accounts outbound and the BOXI report", t1)
f2 = b["fields"]["SEI-ACCOUNT-BASIC-002"]
ok(f2["field"]["rule_class"] == "DERIVED" and f2["field"]["upstream_n"] >= 3 and f2["field"]["crosswalk_n"] == 3, "ACCOUNT_NUMBER: a prose rule over three source tables and three crosswalks", (f2["field"]["rule_class"], f2["field"]["upstream_n"], f2["field"]["crosswalk_n"]))
ok(set(f2["field"]["systems"].split(",")) == {"IM", "UAF"}, "its systems are IM and UAF", f2["field"]["systems"])
f4 = b["fields"]["SEI-ACCOUNT-BASIC-004"]["field"]
ok(f4["rule_class"] == "CONCATENATE" and f4["truncation_risk"] == "Y" and f4["report_out"] == "Y" and f4["null_mitigation"] == "Y" and f4["mandatory_class"] == "CONDITIONAL",
   "ACCOUNT_REGISTRATION_NAME: concatenate, with the three warnings and a by-account-type requirement", f4)
f9 = b["fields"]["SEI-ACCOUNT-BASIC-009"]["field"]
ok(f9["rule_class"] == "SET_NULL" and f9["status_class"] == "COMPLETE" and f9["status_detail"] == "NA-UK" and f9["country_specific"] == "Y", "TAX_WRAP_PROVIDER_ID: set to null, UK only, complete with its qualifier", f9)
f11 = b["fields"]["SEI-ACCOUNT-BASIC-011"]["field"]
ok(f11["rule_class"] == "NOT_MAPPED" and f11["status_class"] == "OPEN", "an empty rule is NOT_MAPPED, pending is OPEN")
ok(f11["source_workbook"] == "SEI_Merged_Catalog_test.xlsx" and f11["source_sheet"] == "Consolidated Catalog", "an empty Source_Workbook falls back to the file and sheet read")
ok(all(len(v) <= 4000 for v in f4.values() if isinstance(v, str)), "text is cut to the column widths")


class FakeLoader:
    def __init__(self):
        self.rows = {}
    def _merge(self, table, pk, values):
        self.rows.setdefault(table, {})[tuple(values[k] for k in pk)] = dict(values)
    def commit(self):
        pass


L = FakeLoader()
n = c.load(L, b)
ok(n == 6 and len(L.rows["cp_sei_migration_source"]) == len(b["sources"]) and len(L.rows["cp_sei_migration_target"]) == len(b["targets"]), "load writes the three tables", (n, {k: len(v) for k, v in L.rows.items()}))
ok(c.load(L, b) == 6 and len(L.rows["cp_sei_migration_field"]) == 6, "loading twice is idempotent")

print("-- the routes, on a fake db")
FIELDS = [dict(v) for v in L.rows["cp_sei_migration_field"].values()]
SOURCES = [dict(v) for v in L.rows["cp_sei_migration_source"].values()]
TARGETS = [dict(v) for v in L.rows["cp_sei_migration_target"].values()]


def fake_query(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "GROUP BY" in s:
        return []
    if "FROM cp_sei_migration_field" in s:
        rows = FIELDS
        if "catalog_id = :c" in s:
            rows = [r for r in rows if r["catalog_id"] == params["c"]]
        if "source_object = :f" in s or "f.source_object = :f" in s:
            rows = [r for r in rows if r["source_object"] == params["f"]]
        if "rule_class = :r" in s:
            rows = [r for r in rows if r["rule_class"] == params["r"]]
        if "LIKE :q" in s:
            q = params["q"].strip("%")
            rows = [r for r in rows if q in (r["source_attribute"] or "").upper() or q in (r["rule_text"] or "").upper()]
        return [dict(r) for r in rows]
    if "FROM cp_sei_migration_source" in s:
        return [dict(r) for r in SOURCES if r["catalog_id"] == params.get("c")]
    if "FROM cp_sei_migration_target" in s:
        return [dict(r) for r in TARGETS if r["catalog_id"] == params.get("c")]
    return []


R.query = fake_query
ov = R.overview()
ok(ov["totals"]["fields"] == 6 and ov["totals"]["files"] == 2 and ov["totals"]["mandatory_always"] == 4, "overview totals", ov["totals"])
ok(ov["totals"]["mapped"] == 5 and ov["totals"]["complete"] == 5, "five mapped, five complete (NA-UK | Complete counts as complete)", ov["totals"])
ab = next(f for f in ov["by_file"] if f["source_object"] == "account-basic.dat")
ok(ab["fields"] == 5 and ab["not_mapped"] == 1 and ab["open"] == 1 and ab["rules"]["CONSTANT"] == 1 and ab["mapped_pct"] == 80.0, "by file, with the rule mix", ab)
ok([r["key"] for r in ov["by_rule"]][:1] == ["CONSTANT"] and all(r["key"] in R.RULE_ORDER for r in ov["by_rule"]), "rule classes in screen order", ov["by_rule"])
fl = R.fields(file="account-basic.dat", rule="CONCATENATE")
ok(fl["total"] == 1 and fl["fields"][0]["source_attribute"] == "ACCOUNT_REGISTRATION_NAME", "fields filter by file and rule", fl["total"])
ok(R.fields(q="legal_title")["total"] == 1, "search reaches the rule text")
det = R.field(id="SEI-ACCOUNT-BASIC-002")
ok(det["field"]["source_attribute"] == "ACCOUNT_NUMBER" and len(det["sources"]) >= 6 and det["targets"][0]["target_kind"] == "ADE_CAS", "one field with its sources and targets: the lineage", (len(det["sources"]), det["targets"]))
ok(det["prev"] == "SEI-ACCOUNT-BASIC-001" and det["next"] == "SEI-ACCOUNT-BASIC-004", "previous and next step through the load file in sequence", (det["prev"], det["next"]))
try:
    R.field(id="nope"); ok(False, "an unknown id is 404")
except Exception as e:                                       # noqa: BLE001
    ok(getattr(e, "status_code", None) == 404, "an unknown id is 404", e)

print("-- findings")
fd = R.findings()
kinds = {}
for x in fd["findings"]:
    kinds.setdefault(x["kind"], []).append(x["source_attribute"])
ok(kinds.get("MANDATORY_UNMAPPED") == ["ACCOUNT_STATUS_X"], "a required field with no rule is the first finding", kinds)
ok("TRUNCATION" in kinds and "REPORT_OUT" in kinds and "NULL_MITIGATION" in kinds and kinds["TRUNCATION"] == ["ACCOUNT_REGISTRATION_NAME"], "the three note warnings", kinds)
ok(kinds.get("COUNTRY_SPECIFIC") == ["TAX_WRAP_PROVIDER_ID"] and kinds.get("DSR_PENDING") == ["ACCOUNT_STATUS_X"], "country-specific and DSR pending", kinds)
ok("MANDATORY_OPEN" not in kinds and "UNMAPPED" not in kinds, "a complete, mapped field raises nothing of those")
ok([k["key"] for k in fd["by_kind"]] == [k for k in R.FINDING_ORDER if k in kinds] and all(k["label"] for k in fd["by_kind"]), "by kind, in order, labelled")
ok(R.findings(kind="truncation")["findings"][0]["source_attribute"] == "ACCOUNT_REGISTRATION_NAME", "filter by kind")
ok(R.ingest_status()["fields"] == 0, "ingest status on an empty count is zero, not an error")

print(("\n%d assertion(s) failed" % bad) if bad else "\nsei_migration assertions pass")
sys.exit(1 if bad else 0)
