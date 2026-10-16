"""ingestion/odi_repo_conn.py against the scd2lens fixture export (synthetic names only).

    python api/test/test_odi_repo_conn.py
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, ROOT)
from ingestion.odi_repo_conn import OdiRepoConnector   # noqa: E402

FIX = os.path.join(ROOT, "tools", "scd2lens", "tests", "fixtures")
BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class FakeLoader:
    def __init__(self):
        self.rows = {}

    def _merge(self, table, pk, values):
        for k in pk:
            assert k in values and values[k] is not None, (table, k, values)
        self.rows.setdefault(table, []).append(values)

    def commit(self):
        self.committed = sum(len(v) for v in self.rows.values())


c = OdiRepoConnector(FIX)
b = c.parse()
ok(b["missing"] == [], "the fixture export is complete", b["missing"])
scn = {s["scenario"]: s for s in b["scenarios"]}
ok("SCN_DIM_ACCOUNT" in scn and scn["SCN_DIM_ACCOUNT"]["load_pattern"] == "merge" and scn["SCN_DIM_ACCOUNT"]["task_count"] >= 5,
   "a scenario row carries its pattern and the task count derived from the tasks", scn.get("SCN_DIM_ACCOUNT"))
ok(scn["SCN_DIM_ACCOUNT"]["truncated_tasks"] >= 1 and scn["SCN_DIM_ACCOUNT"]["step_count"] >= 2,
   "and how many of its tasks the export cut, and how many steps", scn["SCN_DIM_ACCOUNT"])
cut = [t for t in b["tasks"] if t["truncated"] == "Y"]
ok(cut and all(t["code_chars"] > len(t["code_preview"] or "") for t in cut), "a task is TRUNCATED when the export says the code was longer than the preview", cut[:1])
ok(all(len(t["code_preview"] or "") <= 4000 for t in b["tasks"]), "no preview longer than the column")
tabs = {t["table_name"] for t in b["tables"]}
ok("DIM_ACCOUNT" in tabs and next(t for t in b["tables"] if t["table_name"] == "DIM_ACCOUNT")["writer_count"] == 2, "table_360 rows with writer counts", b["tables"][:1])
ok(any(v["name"].endswith("V_PBDW_BATCH_ID") for v in b["variables"]), "variables with their refresh SQL", [v["name"] for v in b["variables"]])
ok(b["objects"][0]["object_type"] == "PROCEDURE" and b["objects"][0]["on_table"] == "DIM_ACCOUNT", "db objects", b["objects"][:1])
ok(b["edges"][0]["src"] == "STG2_ACCOUNT" and b["edges"][0]["detail"] == "SCN_DIM_ACCOUNT", "lineage edges with the scenario as detail", b["edges"][:1])

ld = FakeLoader()
n = c.load(ld, b)
ok(n == sum(len(v) for v in ld.rows.values()) and set(ld.rows) == {"odi_scenario", "odi_task", "odi_variable", "odi_table", "odi_object", "odi_edge"},
   "load merges every row into the six sql/83 tables and returns the count", (n, sorted(ld.rows)))
ok(all(len(k) <= 128 for k in tabs) and all(r["detail"] for r in ld.rows["odi_edge"]), "keys fit their columns; an edge's detail is never null (it is in the key)")
ok(getattr(ld, "committed", 0) == n, "and load() COMMITS after the last merge — the first real run merged 82,651 rows and kept none", getattr(ld, "committed", None))

# the real export leaves type columns blank on some rows; a key column is never NULL (ORA-01400 on the first run)
import csv, tempfile  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    with open(os.path.join(d, "lineage_edges.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["src_type", "src", "relation", "dst_type", "dst", "detail"])
        w.writerow(["", "STG2_X", "", "", "DIM_X", ""]); w.writerow(["TABLE", "", "feeds", "TABLE", "DIM_X", "x"])
    with open(os.path.join(d, "db_objects.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["object_type", "schema", "name", "on_table", "columns", "used_by"])
        w.writerow(["", "", "IDX_X", "DIM_X", "COL", ""])
    bb = OdiRepoConnector(d).parse()
    e = bb["edges"]
    ok(len(e) == 1 and e[0]["src_type"] == "-" and e[0]["relation"] == "-" and e[0]["dst_type"] == "-" and e[0]["detail"] == "-",
       "blank edge types, relation and detail become '-' rather than NULL; an edge with no src is dropped", e)
    ok(bb["objects"][0]["object_type"] == "-" and bb["objects"][0]["schema_name"] == "-", "a blank object type or schema becomes '-'", bb["objects"])
    ld2 = FakeLoader(); c.load(ld2, bb)   # the FakeLoader asserts every key column is non-null

missing = OdiRepoConnector(os.path.join(FIX, "nope")).parse()
ok(len(missing["missing"]) >= 6 and missing["scenarios"] == [] and missing["tasks"] == [], "an absent export is all-missing and loads nothing, without raising", missing["missing"])

print(f"\n{BAD} assertion(s) failed" if BAD else "\nodi repo connector assertions pass")
sys.exit(1 if BAD else 0)
