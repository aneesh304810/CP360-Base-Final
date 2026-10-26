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
from ingestion.hist_migration_conn import HistMigrationConnector, artifact_class, map_headers, _s   # noqa: E402
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
d = tempfile.mkdtemp()
path = os.path.join(d, "STAR_IMDS_SEI_Lineage_Catalog_test.xlsx")
wb.save(path)

c = HistMigrationConnector(xlsx=path)
b = c.parse()
ok(b["files"] == [os.path.basename(path)] and b["source_hash"] and len(b["source_hash"]) == 64, "the one workbook named by CP_SEI_XLSX is read and hashed", b["files"])
ok(sorted(s["kind"] for s in b["sheets"]) == ["artifacts", "dictionary", "evidence", "lanes"], "the four HIST_* sheets are found by name; the crosswalk sheets are left to their own loader", b["sheets"])
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
ok(n == 14 and getattr(L, "committed", False), "load writes every row and commits", n)
ok(len(L.rows["cp_hist_mapping_evidence"]) == 5 and len(L.rows["cp_hist_migration_lane"]) == 3 and len(L.rows["cp_hist_source_artifact"]) == 4 and len(L.rows["cp_hist_header_dictionary"]) == 2, "the four tables", {k: len(v) for k, v in L.rows.items()})
batch = list(L.rows["cp_hist_ingest_batch"].values())[0]
ok(batch["evidence_n"] == 5 and batch["skipped_n"] == 1 and batch["source_hash"] == b["source_hash"] and json.loads(batch["checks"]), "HM-011: the batch row carries the counts, the hash and the checks")
anyrow = list(L.rows["cp_hist_mapping_evidence"].values())[0]
ok(anyrow["batch_id"] == batch["batch_id"] and anyrow["active_ind"] == "Y" and anyrow["source_file"] == os.path.basename(path), "HM-011: every row is stamped with the batch, the file and the active flag")

print("-- the routes, on a fake db")
EV = [dict(v) for v in L.rows["cp_hist_mapping_evidence"].values()]
BATCH = dict(batch)


def fake_query(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "FROM cp_hist_ingest_batch" in s:
        return [dict(BATCH)]
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

print(("\n%d assertion(s) failed" % bad) if bad else "\nhist migration assertions pass")
if bad:
    sys.exit(1)
