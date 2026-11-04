"""Cyber Security 360 router, driven on fakes: validation, the MERGE and
log statements a save emits, the seed that never overwrites, the Interface
360 system list with its derived owner, the import, the workbook export
and its round trip through upload.
Run: python3.13 api/test/test_cyber360.py"""
import base64
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi import HTTPException                      # noqa: E402
import app.routers_cyber360 as R                       # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:240]}"))
    if not cond:
        BAD += 1


SENT, ROWS = [], {}


def fake_execute(statements):
    SENT.extend(statements)


def fake_query(sql, params=None):
    s = " ".join(sql.split())
    for frag, rows in ROWS.items():
        if frag in s:
            return [dict(r) for r in (rows(params) if callable(rows) else rows)]
    return []


R.execute = fake_execute
R.query = fake_query


class Req:
    headers = {}
    client = None
    cookies = {}


R.whoami = lambda request: {"verified": False, "lanId": None, "source": "none"}

print("-- validation")
try:
    R.clean({"app_name": "X", "app_class": "home grown", "scan_status": "not-scanned", "constraint_kind": "", "devsecops_integration": ""})
    ok(True, "")
except HTTPException as e:
    ok(False, "enumerations are folded to the stored form", e.detail)
row = R.clean({"app_name": "X", "app_class": "home grown", "scan_status": "not-scanned", "constraint_kind": "", "devsecops_integration": ""})
ok(row["app_class"] == "HOME_GROWN" and row["scan_status"] == "NOT_SCANNED" and row["constraint_kind"] == "NONE" and row["constraint_valid"] == "TBD" and row["lifecycle"] == "ACTIVE" and row["devsecops_integration"] == "NONE",
   "enumerations fold to the stored form and the defaults fill the blanks", row)
for bad, why in (({"app_name": "", "app_class": "HOME_GROWN", "scan_status": "SCANNED"}, "app_name"), ({"app_name": "X", "app_class": "GUESS", "scan_status": "SCANNED"}, "app_class"),
                 ({"app_name": "X", "app_class": "SAAS", "scan_status": "SCANNED", "notes": "ask someone@example.com"}, "address"), ({"app_name": "X", "app_class": "SAAS", "scan_status": "SCANNED", "runtime": "10.1.2.3"}, "host")):
    try:
        R.clean(bad)
        ok(False, f"refuses a bad row: {why}")
    except HTTPException as e:
        ok(e.status_code == 422, f"refuses a bad row: {why}", e.detail)
ok(R.clean({"app_name": "X", "app_class": "SAAS", "scan_status": "SCANNED", "constraint_kind": "OTHER"})["constraint_kind"] == "NONE", "a scanned application has no constraint to review")

print("-- a save")
SENT.clear()
r = R.save_app(R.SaveBody(app={"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "NO_WEB_SURFACE", "constraint_text": "batch under RMJ"}, actor="pb-team"), Req())
ok(SENT and "MERGE INTO cyber_app t" in SENT[0][0] and SENT[0][1]["app_id"] == "CS-001" and SENT[0][1]["updated_by"] == "pb-team" and SENT[0][1]["id_source"] == "none", "a save is one MERGE on the id with who and how we know", SENT[:1])
logs = [x for x in SENT if "INSERT INTO cyber_app_log" in x[0]]
ok(len(logs) == len([f for f in R.FIELDS if R.clean({"app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "NO_WEB_SURFACE", "constraint_text": "batch under RMJ"}).get(f)]) and all(x[1]["b"] is None for x in logs),
   "a new row logs every field it sets, with nothing before", len(logs))
ROWS["FROM cyber_app WHERE app_id = :i"] = [{"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "NO_WEB_SURFACE", "constraint_text": "batch under RMJ", "constraint_valid": "TBD", "lifecycle": "ACTIVE", "devsecops_integration": "NONE"}]
SENT.clear()
R.save_app(R.SaveBody(app={"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "NO_WEB_SURFACE", "constraint_text": "batch under RMJ", "constraint_valid": "YES", "devsecops_integration": "PARTIAL"}, actor="scan-group"), Req())
logs = [x for x in SENT if "INSERT INTO cyber_app_log" in x[0]]
ok(sorted(x[1]["f"] for x in logs) == ["constraint_valid", "devsecops_integration"] and {x[1]["f"]: (x[1]["b"], x[1]["v"]) for x in logs}["constraint_valid"] == ("TBD", "YES"),
   "an update logs only the fields that changed, with before and after", [(x[1]["f"], x[1]["b"], x[1]["v"]) for x in logs])
try:
    R.save_app(R.SaveBody(app={"app_name": "X", "app_class": "SAAS", "scan_status": "SCANNED"}, actor=""), Req())
    ok(False, "a save without a name is refused when sign-in is off")
except HTTPException as e:
    ok(e.status_code == 400 and "name required" in e.detail, "a save without a name is refused when sign-in is off")

print("-- the seed never overwrites")
ROWS["SELECT app_id FROM cyber_app"] = [{"app_id": "CS-001"}]
SENT.clear()
r = R.seed_apps(R.SeedBody(apps=[{"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED"}, {"app_id": "CS-002", "app_name": "STP Post", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "source_ref": "thread"}], actor="pb-team"), Req())
ok(r["added"] == 1 and sum(1 for x in SENT if "MERGE INTO" in x[0]) == 1 and SENT[0][1]["app_id"] == "CS-002" and any(x[1].get("f") is None and "'seed'" in x[0] for x in SENT), "only the row not yet there is written, with a seed log line", r["added"])

print("-- the state and the summary")
ROWS["SELECT * FROM cyber_app ORDER BY"] = [
    {"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "NO_WEB_SURFACE", "constraint_valid": "TBD", "lifecycle": "ACTIVE", "devsecops_integration": "NONE"},
    {"app_id": "CS-009", "app_name": "Email Tool", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED", "constraint_kind": "LEGACY_STACK_RETIRING", "constraint_valid": "NO", "lifecycle": "RETIRING", "devsecops_integration": "NONE"},
    {"app_id": "CS-013", "app_name": "SharePoint", "app_class": "VENDOR_PACKAGE", "scan_status": "SERVER_ONLY", "constraint_kind": "SERVER_SCAN_ONLY", "constraint_valid": "YES", "lifecycle": "ACTIVE", "devsecops_integration": "NOT_APPLICABLE"},
    {"app_id": "IF-STAR", "app_name": "STAR", "app_class": "HOME_GROWN", "scan_status": "UNKNOWN", "constraint_kind": "NONE", "constraint_valid": "TBD", "lifecycle": "ACTIVE", "owner_team": "Core Platform"},
    {"app_id": "CS-020", "app_name": "Client portal", "app_class": "SAAS", "scan_status": "SCANNED", "constraint_kind": "NONE", "constraint_valid": "TBD", "lifecycle": "ACTIVE", "devsecops_integration": "INTEGRATED"}]
ROWS["FROM cyber_app_log ORDER BY"] = [{"log_id": "l1", "app_id": "CS-001", "field": "constraint_valid", "before_v": "TBD", "after_v": "YES", "author": "scan-group", "id_source": "none", "created_at": None}]
st = R.get_apps()
ok(st["summary"] == {"apps": 5, "scanned": 1, "unknown": 1, "serverOnly": 1, "notScanned": 2, "retiring": 1, "toScan": 1, "toReview": 1, "accepted": 1, "byClass": {"HOME_GROWN": 3, "VENDOR_MANAGED_CODE": 0, "VENDOR_PACKAGE": 1, "SAAS": 1}},
   "the summary derives from the rows: unknown apart, to-scan is a constraint not accepted, to-review is pending", st["summary"])
ok(st["log"][0]["field"] == "constraint_valid" and st["log"][0]["before"] == "TBD" and st["persisted"], "the log reads back")

print("-- Interface 360 systems and the import")
ROWS["SELECT app_id, app_name FROM cyber_app"] = [{"app_id": "CS-013", "app_name": "SharePoint"}]
ROWS["FROM interface360_interfaces WHERE update_owner IS NOT NULL"] = [{"system_name": "STAR", "update_owner": "Core Platform", "n": 12}, {"system_name": "STAR", "update_owner": "Other", "n": 2}, {"system_name": "IMDS", "update_owner": "ops@example.com", "n": 3}]
ROWS["FROM api_systems WHERE owner IS NOT NULL"] = [{"display_name": "IMDS", "system_code": "IMDS", "owner": "Data Platform"}]
ROWS["FROM interface360_systems ORDER BY"] = [{"system_name": "STAR", "project_id": "P1", "party": "INTERNAL", "inbound_count": 10, "outbound_count": 30, "total_count": 40, "carries_pii": "Y"},
                                             {"system_name": "IMDS", "project_id": None, "party": "VENDOR", "inbound_count": 5, "outbound_count": 1, "total_count": 6, "carries_pii": "N"},
                                             {"system_name": "SharePoint", "project_id": None, "party": "VENDOR", "inbound_count": 1, "outbound_count": 1, "total_count": 2, "carries_pii": "N"}]
sy = R.systems()
by = {x["system"]: x for x in sy["systems"]}
ok(sy["total"] == 3 and sy["inInventory"] == 1 and by["STAR"]["owner"] == "Core Platform" and by["STAR"]["ownerSource"] == "interfaces" and by["STAR"]["carriesPii"] and by["SharePoint"]["appId"] == "CS-013",
   "systems carry the owner the interfaces name most often, PII, and the inventory id where there is one", by)
ok(by["IMDS"]["owner"] == "Data Platform" and by["IMDS"]["ownerSource"] == "api catalog", "an owner that is an address is dropped and the API catalog's owner stands in", by["IMDS"])
SENT.clear()
im = R.import_systems(R.ImportBody(systems=["STAR", "IMDS", "SharePoint", "Nope"], actor="pb-team"), Req())
ok(im["added"] == ["IF-IMDS", "IF-STAR"] and len(im["skipped"]) == 2 and SENT[2][1]["scan_status"] == "UNKNOWN" and SENT[2][1]["owner_team"] == "Core Platform" and "40 interfaces" in SENT[2][1]["notes"] and "carries PII" in SENT[2][1]["notes"]
   and SENT[2][1]["source_ref"].startswith("Interface 360 system") and SENT[0][1]["app_class"] == "VENDOR_PACKAGE" and SENT[0][1]["category"] == "Interface 360 system (VENDOR)",
   "an import adds systems as not yet declared with owner, counts and class from the party; one already in and one unknown are skipped", (im["added"], im["skipped"]))

print("-- the workbook, out and back in")
data = R.workbook_bytes(R._state())
from openpyxl import load_workbook
wb = load_workbook(io.BytesIO(data), read_only=True)
ok(wb.sheetnames == ["Inventory", "Not scanned", "Change log", "Values", "Lists"], "five sheets: the inventory, the not-scanned review, the log, the allowed values, the dropdown lists", wb.sheetnames)
wbf = load_workbook(io.BytesIO(data))                        # validations need the full reader
inv_ws = wbf["Inventory"]
dvs = inv_ws.data_validations.dataValidation
heads = [c.value for c in inv_ws[1]]
cols_with_dv = sorted({str(d.sqref).split(":")[0].rstrip("0123456789") for d in dvs})
want = sorted({__import__("openpyxl.utils", fromlist=["get_column_letter"]).get_column_letter(heads.index(lab) + 1) for f, lab in R.XLSX_COLS if f in R.ENUMS})
ok(len(dvs) == len(R.ENUMS) and cols_with_dv == want and all(d.type == "list" and str(d.formula1).startswith("Lists!$") and str(d.sqref).endswith(str(5 + 1 + R.BLANK_ROWS)) for d in dvs),
   "every enumerated column has a list dropdown fed from the Lists sheet, over the rows and three hundred blank ones under them", (cols_with_dv, want, [str(d.sqref) for d in dvs][:2]))
lists = {r[0]: [v for v in r[1:] if v] for r in zip(*[[c.value for c in col] for col in wbf["Lists"].iter_cols()])} if False else None
lst = wbf["Lists"]
ok(lst["A1"].value == "app_class" and [lst.cell(row=i, column=1).value for i in range(2, 6)] == list(R.CLASSES) and lst["C1"].value == "scan_status" and lst["C2"].value == "UNKNOWN", "the Lists sheet holds the form's values, one column per field", (lst["A1"].value, lst["C1"].value))
inv = list(wb["Inventory"].iter_rows(values_only=True))
ok(inv[0][:3] == ("ID", "Application", "Class") and "DevSecOps integration" in inv[0] and len(inv) == 6, "the Inventory sheet is a labelled header and every row", inv[0])
ns = list(wb["Not scanned"].iter_rows(values_only=True))
ok(len(ns) == 5 and {r[0] for r in ns[1:]} == {"QTP", "Email Tool", "SharePoint", "STAR"}, "the Not scanned sheet has the unscanned and the undeclared, not the scanned", [r[0] for r in ns])
vals = list(wb["Values"].iter_rows(values_only=True))
ok(any(r[0] == "scan_status" and "NOT_SCANNED" in r[1] for r in vals) and any(r[0] == "devsecops_integration" for r in vals), "the Values sheet lists what may be typed")
# a developer fills in the downloaded sheet: one row updated by id, one new row by name, one bad row
from openpyxl import Workbook
w2 = Workbook(); ws = w2.active; ws.title = "Inventory"
ws.append(list(inv[0]))
upd = list(inv[1]); upd[inv[0].index("Scan status")] = "scanned"; upd[inv[0].index("Scan types")] = "web, api"; upd[inv[0].index("DevSecOps integration")] = "integrated"
ws.append(upd)
new = [None] * len(inv[0]); new[1] = "Client reporting portal"; new[2] = "saas"; new[inv[0].index("Scan status")] = "not scanned"; new[inv[0].index("Constraint")] = "saas vendor hosted"; new[inv[0].index("Why not scanned")] = "vendor hosted"
ws.append(new)
bad = [None] * len(inv[0]); bad[1] = "Bad"; bad[2] = "SAAS"; bad[inv[0].index("Scan status")] = "SCANNED"; bad[inv[0].index("Notes")] = "contact someone@example.com"
ws.append(bad)
buf = io.BytesIO(); w2.save(buf)
ROWS["SELECT * FROM cyber_app"] = ROWS["SELECT * FROM cyber_app ORDER BY"]
SENT.clear()
up = R.upload_apps(R.UploadBody(filename="inv.xlsx", content_b64=base64.b64encode(buf.getvalue()).decode(), actor="pb-team"), Req())
ok(up["updated"] == ["CS-001"] and len(up["added"]) == 1 and len(up["errors"]) == 1 and up["errors"][0]["row"] == 4 and "address" in up["errors"][0]["error"] and up["rows"] == 3,
   "the upload updates by id, adds by name, and reports the refused row by number while the rest load", (up["updated"], up["added"], up["errors"]))
merges = [x for x in SENT if "MERGE INTO" in x[0]]
ok(merges[0][1]["scan_status"] == "SCANNED" and merges[0][1]["devsecops_integration"] == "INTEGRATED" and merges[0][1]["constraint_kind"] == "NONE" and merges[1][1]["app_class"] == "SAAS" and merges[1][1]["constraint_kind"] == "SAAS_VENDOR_HOSTED",
   "typed values fold to the stored form on the way in", [(m[1]["scan_status"], m[1]["app_class"]) for m in merges])
try:
    R.upload_apps(R.UploadBody(content_b64=base64.b64encode(b"not a workbook").decode(), actor="x"), Req())
    ok(False, "a file that is not a workbook is refused")
except HTTPException as e:
    ok(e.status_code == 422, "a file that is not a workbook is refused", e.detail)

print("-- the export of unsaved rows, and a seed with a bad row")
ex = R.apps_export(R.ExportBody(apps=[{"app_name": "Starter one", "app_class": "HOME_GROWN", "scan_status": "UNKNOWN", "owner_team": "Core"}, {"app_id": "CS-001", "app_name": "QTP", "app_class": "HOME_GROWN", "scan_status": "NOT_SCANNED"}]))
wbe = load_workbook(io.BytesIO(ex.body), read_only=True)
rows_e = list(wbe["Inventory"].iter_rows(values_only=True))
ok(ex.media_type == R.XLSX_TYPE and len(rows_e) == 3 and rows_e[1][1] == "Starter one" and rows_e[1][0] in ("", None) and rows_e[2][0] == "CS-001" and wbe.sheetnames[-1] == "Lists",
   "the export writes the rows it is given, saved or not, into the same workbook with the dropdowns", [r[:2] for r in rows_e])
empty = load_workbook(io.BytesIO(R.apps_export(R.ExportBody(apps=[])).body))
ok(len(empty["Inventory"].data_validations.dataValidation) == len(R.ENUMS) and empty["Inventory"]["B1"].value == "Application", "an empty inventory still exports the headers and the dropdowns, a template")
ROWS["SELECT app_id FROM cyber_app"] = []
SENT.clear()
sd = R.seed_apps(R.SeedBody(apps=[{"app_id": "A", "app_name": "Good", "app_class": "SAAS", "scan_status": "SCANNED"}, {"app_id": "B", "app_name": "Bad", "app_class": "SAAS", "scan_status": "SCANNED", "notes": "mail someone@example.com"}], actor="x"), Req())
ok(sd["added"] == 1 and len(sd["errors"]) == 1 and sd["errors"][0]["app"] == "Bad" and "address" in sd["errors"][0]["error"], "a seed writes the good rows and reports the refused one instead of failing", sd.get("errors"))

print("-- wiring")
main = open(os.path.join(os.path.dirname(__file__), "..", "app", "main.py")).read()
ok('"routers_cyber360"' in main, "the router is mounted")

print()
if BAD:
    print(f"{BAD} FAILED"); sys.exit(1)
print("cyber360 assertions pass")
