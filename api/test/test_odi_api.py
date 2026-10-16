"""routers_odi: the eight reads, with _safe patched to a fake store.

    python api/test/test_odi_api.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from api.app import routers_odi as R   # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


SCN = {"scenario": "SCN_DIM_ACCOUNT", "writes": "DIM_ACCOUNT(MERGE);DIM_ACCOUNT(UPDATE)", "reads": "STG2_ACCOUNT;DIM_CONTROL_DATES",
       "db_procedures": "PRC_ACCOUNT_EDM_END_DATE", "kms": "IKM SQL Control Append", "variables": "V_PBDW_START_DATE_NEW;V_PBDW_END_DATE_NEW",
       "load_pattern": "merge", "load_plans": "LP_EDM", "autosys_jobs": "J_EDM_ACCOUNT", "step_count": 14, "task_count": 42, "truncated_tasks": 6}
TASKS = [{"scenario": "SCN_DIM_ACCOUNT", "step_no": 9, "task_no": 50, "task_name1": "Load data", "task_type": "C", "reads": "STG2_ACCOUNT",
          "writes": "I$_DIM_ACCOUNT(INSERT)", "code_chars": 29237, "code_preview": "select ...", "truncated": "Y"},
         {"scenario": "SCN_DIM_ACCOUNT", "step_no": 14, "task_no": 10, "task_name1": "PRC_ACCOUNT_EDM_END_DATE", "task_type": "S", "reads": "",
          "writes": "DIM_ACCOUNT(UPDATE)", "code_chars": 400, "code_preview": "UPDATE ...", "truncated": "N"},
         {"scenario": "SCN_OTHER", "step_no": 1, "task_no": 1, "task_name1": "x", "task_type": "C", "reads": "DIM_ACCOUNT",
          "writes": "DIM_ACCOUNT_HIST(INSERT)", "code_chars": 10, "code_preview": "x", "truncated": "N"}]
SEEN = []


def fake_safe(sql, params=None):
    s = " ".join(sql.split()).lower()
    SEEN.append((s, params or {}))
    if "count(*) as scenarios" in s:
        return [{"scenarios": 41, "tasks": 1230, "truncated": 212, "loaded_at": "2026-10-16T10:00:00"}]
    if s.startswith("select count(*) as n from"):
        return [{"n": 7}]
    if "group by load_pattern" in s:
        return [{"k": "merge", "n": 12}, {"k": "unknown", "n": 9}]
    if "group by layer" in s:
        return [{"k": "DIM", "n": 20}]
    if "group by object_type" in s:
        return [{"k": "PROCEDURE", "n": 14}]
    if "count(distinct load_plans)" in s:
        return [{"n": 3}]
    if "connect by level" in s:
        return [{"v": "V_PBDW_BATCH_ID", "n": 12}]
    if "from odi_scenario where" in s and "upper(scenario) = :s" in s:
        return [dict(SCN)] if params.get("s") == "SCN_DIM_ACCOUNT" else []
    if "from odi_scenario where" in s:
        return [dict(SCN)]
    if "from odi_task where upper(scenario)" in s:
        return [dict(t) for t in TASKS if t["scenario"] == params.get("s")]
    if "from odi_task where upper(writes) like" in s:
        return [dict(t) for t in TASKS if params["t"].strip("%") in t["writes"]]
    if "from odi_variable where upper(name) like" in s:
        return [{"name": "PBDW_STAGING_1." + params["v"].strip("%"), "datatype": "Alphanumeric", "refresh_lschema": "PBDWAPP", "refresh_sql": "SELECT ..."}]
    if "from odi_variable" in s:
        return [{"name": "PBDW_STAGING_1.V_PBDW_BATCH_ID", "project": "PBDW", "datatype": "Numeric", "default_value": None,
                 "refresh_lschema": "PBDWAPP", "refresh_sql": "SELECT MAX(BATCH_ID) FROM BATCH_CONTROL", "source_file": "vars.xml"}]
    if "left join scd2_card" in s:
        return [{"table_name": "DIM_ACCOUNT", "written_by": "SCN_DIM_ACCOUNT;SCN_DIM_MASTER_ACCOUNT", "read_by": "SCN_FACT_POS", "write_operations": "MERGE;UPDATE",
                 "indexes": "PK_DIM_ACCOUNT", "layer": "DIM", "writer_count": 2, "reader_count": 1, "scd2_pattern": "MERGE_SCD2", "scan_verdict": "SCD2"}]
    if "from odi_table where upper(table_name) = :t" in s:
        return [{"table_name": "DIM_ACCOUNT", "written_by": "SCN_DIM_ACCOUNT;SCN_DIM_MASTER_ACCOUNT", "read_by": "SCN_FACT_POS", "write_operations": "MERGE;UPDATE",
                 "indexes": "PK_DIM_ACCOUNT", "layer": "DIM"}] if params.get("t") == "DIM_ACCOUNT" else []
    if "from odi_edge where upper(dst)" in s:
        return [{"src_type": "TABLE", "src": "STG2_ACCOUNT", "relation": "feeds", "dst_type": "TABLE", "dst": "DIM_ACCOUNT", "detail": "SCN_DIM_ACCOUNT"}]
    if "from odi_edge" in s:
        return []
    if "from odi_object where upper(on_table)" in s:
        return [{"object_type": "PROCEDURE", "schema_name": "PBDWAPP", "name": "PRC_ACCOUNT_EDM_END_DATE", "columns": "", "used_by": "SCN_DIM_ACCOUNT"}]
    if "from odi_object" in s:
        return [{"object_type": "PROCEDURE", "schema_name": "PBDWAPP", "name": "PRC_ACCOUNT_EDM_END_DATE", "on_table": "DIM_ACCOUNT", "columns": "", "used_by": "SCN_DIM_ACCOUNT;SCN_X"}]
    if "from scd2_card where table_name" in s:
        return [{"pattern": "MERGE_SCD2", "natural_key": "ACCOUNT_NUMBER", "partition_col": "MASTER_IND", "proven_count": 7}]
    if "from scd2_column_role" in s:
        return [{"verdict": "SCD2", "confidence": "high", "valid_from": "START_DATE", "valid_to": "END_DATE", "to_convention": "NULL = open"}]
    return []


R._safe = fake_safe

s = R.summary()
ok(s["loaded"] and s["scenarios"] == 41 and s["tasks"] == 1230 and s["truncated_tasks"] == 212 and s["load_plans"] == 3,
   "summary: the scenario counts and how many tasks the export cut", s)
ok(s["variables"] == 7 and s["scd2_cards"] == 7 and s["by_pattern"][0] == {"k": "merge", "n": 12} and s["by_layer"] == [{"k": "DIM", "n": 20}],
   "and the counts per table, pattern, layer and object type", s)

L = R.scenarios(q="account", pattern="")
ok(L["count"] == 1 and L["scenarios"][0]["writes_list"] == ["DIM_ACCOUNT(MERGE)", "DIM_ACCOUNT(UPDATE)"] and L["scenarios"][0]["jobs_list"] == ["J_EDM_ACCOUNT"],
   "scenarios: the list splits writes, reads, plans and jobs into lists", L)
ok(any(p.get("ql") == "%ACCOUNT%" for _, p in SEEN), "and the search is a bound LIKE, upper-cased", [p for _, p in SEEN if "ql" in p][:1])

d = R.scenario("scn_dim_account")
ok(d["loaded"] and d["head"]["procedures_list"] == ["PRC_ACCOUNT_EDM_END_DATE"] and d["head"]["kms_list"] == ["IKM SQL Control Append"],
   "scenario: the head with its procedures and knowledge modules", d["head"])
ok([st["step_no"] for st in d["steps"]] == [9, 14] and d["steps"][0]["tasks"][0]["truncated"] == "Y" and d["steps"][0]["tasks"][0]["code_chars"] == 29237,
   "tasks grouped by step in order, the cut flag and the full length carried", d["steps"])
ok(len(d["variables"]) == 2 and d["variables"][0]["name"].endswith("V_PBDW_START_DATE_NEW"), "its variables resolved by suffix", d["variables"])
ok(d["objects"][0]["name"] == "PRC_ACCOUNT_EDM_END_DATE", "and the objects it uses", d["objects"])
ok(not R.scenario("NOPE")["loaded"], "an unknown scenario is loaded=false, not a 500")

T = R.tables(q="", layer="")
ok(T["count"] == 1 and T["tables"][0]["scd2_pattern"] == "MERGE_SCD2" and T["tables"][0]["writers"] == ["SCN_DIM_ACCOUNT", "SCN_DIM_MASTER_ACCOUNT"],
   "tables: each row carries its SCD2 pattern and scan verdict when they exist, writers split", T)

td = R.table("dim_account")
ok(td["loaded"] and td["head"]["readers"] == ["SCN_FACT_POS"] and td["head"]["index_list"] == ["PK_DIM_ACCOUNT"], "table: head with readers and indexes", td["head"])
ok([t["task_no"] for t in td["tasks"]] == [10] and td["sources"] == [], "only the tasks whose WRITES names this table — DIM_ACCOUNT_HIST does not count", td["tasks"])
ok(td["inbound"][0]["src"] == "STG2_ACCOUNT" and td["objects"][0]["name"] == "PRC_ACCOUNT_EDM_END_DATE", "edges in and objects on it", td["inbound"])
ok(td["scd2"]["partition_col"] == "MASTER_IND" and td["column_roles"]["to_convention"] == "NULL = open", "the SCD2 card summary and the scan's roles ride along", td["scd2"])

V = R.variables(q="")
ok(V["count"] == 1 and V["variables"][0]["used_by_scenarios"] == 12, "variables: usage count matched on the short name", V)
O = R.objects(q="", type_="PROCEDURE")
ok(O["count"] == 1 and O["objects"][0]["used_by_list"] == ["SCN_DIM_ACCOUNT", "SCN_X"], "objects: used_by split", O)
ok(R.edges(node="DIM_ACCOUNT")["count"] == 0 and not R.edges(node="")["loaded"], "edges: a node filter and the capped full list")
ok(all(not s_.lstrip().startswith(("insert", "update", "delete", "merge", "create")) for s_, _ in SEEN), "every statement is a read")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nodi api assertions pass")
sys.exit(1 if BAD else 0)
