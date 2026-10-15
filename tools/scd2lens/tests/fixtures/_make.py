"""Writes the fixture CSVs. Shapes copy the ODI export; every name and value is invented."""
import csv
from pathlib import Path

H = Path(__file__).parent
V = "#PBDW_STAGING_1."
START_SQL = ("CASE WHEN '" + V + "V_PBDW_STG2_TABLE_NAME' = 'EOD' THEN (SELECT TO_CHAR(PRIOR_BUSINESS_DATE,'YYYY-MM-DD') FROM DIM_CONTROL_DATES "
             "WHERE LOAD_DATE = (SELECT MAX(LOAD_DATE) FROM DIM_CONTROL_DATES)) ELSE (SELECT TO_CHAR(CURRENT_BUSINESS_DATE,'YYYY-MM-DD') "
             "FROM DIM_CONTROL_DATES WHERE LOAD_DATE = (SELECT MAX(LOAD_DATE) FROM DIM_CONTROL_DATES)) END")
END_SQL = START_SQL.replace("PRIOR_BUSINESS_DATE,", "PRIOR_BUSINESS_DATE - 1,").replace("CURRENT_BUSINESS_DATE,", "CURRENT_BUSINESS_DATE - 1,")
OBJ = '<?= odiRef.getObjectName("L", "DIM_ACCOUNT", "PBDWAPP", "D") ?>'
MERGE_INS = (f"merge into {OBJ} T using (select * from PBDWAPP.I$_DIM_ACCOUNT) S on (T.ACCOUNT_NUMBER=S.ACCOUNT_NUMBER and T.START_DATE=S.START_DATE) "
             "when not matched then insert (ACCOUNT_KEY, ACCOUNT_NUMBER, ACCOUNT_NAME, ACCOUNT_TYPE, START_DATE, END_DATE, BATCH_ID) "
             "values (S.ACCOUNT_KEY, S.ACCOUNT_NUMBER, S.ACCOUNT_NAME, S.ACCOUNT_TYPE, S.START_DATE, S.END_DATE, S.BATCH_ID)")
MERGE_UPD = (f"merge into {OBJ} T using (select * from PBDWAPP.I$_DIM_ACCOUNT) S on (T.ACCOUNT_NUMBER=S.ACCOUNT_NUMBER and T.START_DATE=S.START_DATE) "
             "when matched then update set T.ACCOUNT_NAME=S.ACCOUNT_NAME, T.ACCOUNT_TYPE=S.ACCOUNT_TYPE, T.BATCH_ID=S.BATCH_ID, T.UPDATED_TSP=SYSTIMESTAMP")
END_PROC = ("UPDATE PBDWAPP.DIM_ACCOUNT D SET END_DATE = TRUNC(TO_DATE('" + V + "V_PBDW_END_DATE_NEW','YYYY-MM-DD')), UPDATED_TSP = SYSTIMESTAMP "
            "WHERE D.ACCOUNT_NUMBER IN (SELECT S.ACCOUNT_NUMBER FROM PBDWAPP.STG2_ACCOUNT S WHERE S.BATCH_ID = " + V + "V_PBDW_BATCH_ID) "
            "AND D.END_DATE IS NULL AND D.BATCH_ID <> " + V + "V_PBDW_BATCH_ID AND D.MASTER_IND = 'N'")
END_PROC_M = END_PROC.replace("MASTER_IND = 'N'", "MASTER_IND = 'Y'")
SCD1 = ("MERGE INTO PBDWAPP.DIM_ACCOUNT C USING (SELECT ACCOUNT_NUMBER, TRANS_TO_PRIN_DATE, DATE_PRIN_CASH_BECAME_OD, DATE_INC_CASH_BECAME_OD "
        "FROM PBDWAPP.STG2_ACCOUNT) S ON (C.ACCOUNT_NUMBER = S.ACCOUNT_NUMBER AND C.END_DATE IS NULL) WHEN MATCHED THEN UPDATE SET "
        "C.TRANS_TO_PRIN_DATE = S.TRANS_TO_PRIN_DATE, C.DATE_PRIN_CASH_BECAME_OD = S.DATE_PRIN_CASH_BECAME_OD, C.DATE_INC_CASH_BECAME_OD = S.DATE_INC_CASH_BECAME_OD")
SEC_OBJ = '<?= odiRef.getObjectName("L", "DIM_SECURITY", "PBDWAPP", "D") ?>'
SEC_MERGE = (f"merge into {SEC_OBJ} T using (select * from PBDWAPP.I$_DIM_SECURITY) S on (T.CUSIP=S.CUSIP and T.START_DATE=S.START_DATE) "
             "when not matched then insert (SECURITY_KEY, CUSIP, START_DATE) values (S.SECURITY_KEY, S.CUSIP, S.START_DATE)")
SEC_END = ("UPDATE PBDWAPP.DIM_SECURITY D SET END_DATE = TRUNC(TO_DATE('" + V + "V_PBDW_END_DATE_NEW','YYYY-MM-DD')), UPDATED_TSP = SYSTIMESTAMP "
           "WHERE D.CUSIP IN (SELECT S.CUSIP FROM PBDWAPP.STG2_SECURITY S WHERE S.BATCH_ID = " + V + "V_PBDW_BATCH_ID) "
           "AND D.END_DATE IS NULL AND D.START_DATE IS NOT NULL AND D.BATCH_ID <> " + V + "V_PBDW_BATCH_ID")
TRUNC_PREVIEW = "LKM load into I$_DIM_ACCOUNT ... (preview cut) select ACCOUNT_NUMBER, ACCOUNT_NAME from PBDWAPP.STG2_ACCOUNT where"

tasks = [
 # scenario, version, step, task, n1, n2, n3, type, reads, writes, code_chars, preview
 ("SCN_DIM_ACCOUNT", "001", 7, 10, "Refresh V_PBDW_START_DATE_NEW", "", "", "V", "DIM_CONTROL_DATES", "", len(START_SQL), START_SQL),
 ("SCN_DIM_ACCOUNT", "001", 8, 10, "Refresh V_PBDW_END_DATE_NEW", "", "", "V", "DIM_CONTROL_DATES", "", len(END_SQL), END_SQL),
 ("SCN_DIM_ACCOUNT", "001", 9, 50, "Load data", "LKM SQL to Oracle", "", "C", "STG2_ACCOUNT", "I$_DIM_ACCOUNT(INSERT)", 29237, TRUNC_PREVIEW),
 ("SCN_DIM_ACCOUNT", "001", 10, 240, "Insert customize", "Customize IKM SQL Control Append Insert With Merge", "", "J", "I$_DIM_ACCOUNT", "DIM_ACCOUNT(MERGE)", len(MERGE_INS), MERGE_INS),
 ("SCN_DIM_ACCOUNT", "001", 12, 420, "Update customize", "Latest Customize IKM SQL Control Append Update With Merge", "", "J", "I$_DIM_ACCOUNT", "DIM_ACCOUNT(MERGE)", len(MERGE_UPD), MERGE_UPD),
 ("SCN_DIM_ACCOUNT", "001", 14, 10, "Procedure", "PRC_ACCOUNT_EDM_END_DATE", "", "S", "STG2_ACCOUNT", "DIM_ACCOUNT(UPDATE)", len(END_PROC), END_PROC),
 ("SCN_DIM_ACCOUNT", "001", 15, 10, "Procedure", "PRC_ACCOUNT_UPDATE", "", "S", "STG2_ACCOUNT", "DIM_ACCOUNT(MERGE)", len(SCD1), SCD1),
 ("SCN_DIM_MASTER_ACCOUNT", "001", 5, 10, "Procedure", "PRC_MASTER_ACCOUNT_END_DATE", "", "S", "STG2_ACCOUNT", "DIM_ACCOUNT(UPDATE)", len(END_PROC_M), END_PROC_M),
 ("SCN_DIM_SECURITY", "001", 10, 240, "Insert customize", "Customize IKM SQL Control Append Insert With Merge", "", "J", "I$_DIM_SECURITY", "DIM_SECURITY(MERGE)", len(SEC_MERGE), SEC_MERGE),
 ("SCN_DIM_SECURITY", "001", 14, 10, "Procedure", "PRC_SECURITY_EDM_END_DATE", "", "S", "STG2_SECURITY", "DIM_SECURITY(UPDATE)", len(SEC_END), SEC_END),
 ("SCN_DIM_IP_RELATIONSHIP", "001", 3, 10, "Truncate target table", "IKM Oracle Control Append", "", "J", "", "DIM_IP_RELATIONSHIP(TRUNCATE)", 60, "truncate table PBDWAPP.DIM_IP_RELATIONSHIP"),
 ("SCN_DIM_IP_RELATIONSHIP", "001", 4, 20, "Insert new rows", "IKM Oracle Control Append", "", "J", "I$_DIM_IP_RELATIONSHIP", "DIM_IP_RELATIONSHIP(INSERT)", 120, "insert into PBDWAPP.DIM_IP_RELATIONSHIP select * from PBDWAPP.I$_DIM_IP_RELATIONSHIP"),
 ("SCN_DIM_IP_RELATIONSHIP", "001", 6, 10, "Procedure", "PRC_DIM_IP_RELATIONSHIP_INSERT_HIST", "", "S", "DIM_IP_RELATIONSHIP", "DIM_IP_RELATIONSHIP_HIST(INSERT)", 200, "insert into PBDWAPP.DIM_IP_RELATIONSHIP_HIST select d.*, sysdate from PBDWAPP.DIM_IP_RELATIONSHIP d"),
]
with open(H / "scenario_tasks.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["scenario", "version", "step_no", "task_no", "task_name1", "task_name2", "task_name3", "task_type", "reads", "writes", "code_chars", "code_preview"])
    w.writerows(tasks)
with open(H / "scenarios.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["scenario", "writes", "reads", "db_procedures", "kms", "variables", "load_pattern", "load_plans", "autosys_jobs"])
    w.writerows([
        ("SCN_DIM_ACCOUNT", "DIM_ACCOUNT(MERGE);DIM_ACCOUNT(UPDATE)", "STG2_ACCOUNT;DIM_CONTROL_DATES", "PRC_ACCOUNT_EDM_END_DATE;PRC_ACCOUNT_UPDATE", "IKM SQL Control Append", "V_PBDW_START_DATE_NEW;V_PBDW_END_DATE_NEW", "merge", "LP_EDM", "J_EDM_ACCOUNT"),
        ("SCN_DIM_MASTER_ACCOUNT", "DIM_ACCOUNT(UPDATE)", "STG2_ACCOUNT", "PRC_MASTER_ACCOUNT_END_DATE", "", "", "update", "LP_EDM", "J_EDM_MASTER"),
        ("SCN_DIM_SECURITY", "DIM_SECURITY(MERGE);DIM_SECURITY(UPDATE)", "STG2_SECURITY", "PRC_SECURITY_EDM_END_DATE", "IKM SQL Control Append", "", "merge", "LP_EDM", "J_EDM_SECURITY"),
        ("SCN_DIM_IP_RELATIONSHIP", "DIM_IP_RELATIONSHIP(INSERT);DIM_IP_RELATIONSHIP_HIST(INSERT)", "STG2_IP_REL", "PRC_DIM_IP_RELATIONSHIP_INSERT_HIST", "IKM Oracle Control Append", "", "truncate", "LP_EDM", "J_EDM_IPREL"),
    ])
with open(H / "odi_variables.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["name", "project", "datatype", "default", "refresh_lschema", "refresh_sql", "file"])
    w.writerows([("PBDW_STAGING_1.V_PBDW_START_DATE_NEW", "PBDW", "Alphanumeric", "", "PBDWAPP", START_SQL, "vars.xml"),
                 ("PBDW_STAGING_1.V_PBDW_END_DATE_NEW", "PBDW", "Alphanumeric", "", "PBDWAPP", END_SQL, "vars.xml"),
                 ("PBDW_STAGING_1.V_PBDW_BATCH_ID", "PBDW", "Numeric", "", "PBDWAPP", "SELECT MAX(BATCH_ID) FROM BATCH_CONTROL", "vars.xml")])
with open(H / "scd2_pbdw.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["table", "verdict", "confidence", "surrogate_key", "valid_from", "valid_to", "current_flag", "business_date", "audit", "maps_to", "notes"])
    w.writerows([("DIM_ACCOUNT", "SCD2", "high", "ACCOUNT_KEY", "START_DATE", "END_DATE", "ACTIVE_IND", "", "LOAD_DATE", "ACTIVE_IND -> IS_CURRENT", "ACCOUNT_KEY taken as the surrogate by convention"),
                 ("DIM_SECURITY", "SCD2", "high", "SECURITY_KEY", "START_DATE", "END_DATE", "ACTIVE_IND", "", "LOAD_DATE", "", ""),
                 ("DIM_IP_RELATIONSHIP", "SCD2", "high", "IP_RELATIONSHIP_KEY", "START_DATE", "END_DATE", "ACTIVE_IND", "", "LOAD_DATE", "", ""),
                 ("FACT_POS", "SNAPSHOT", "high", "", "", "", "", "AS_OF_DATE", "", "", "")])
with open(H / "table_360.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["table", "written_by_scenarios", "read_by_scenarios", "write_operations", "indexes", "layer"])
    w.writerows([("DIM_ACCOUNT", "SCN_DIM_ACCOUNT;SCN_DIM_MASTER_ACCOUNT", "SCN_FACT_POS", "MERGE;UPDATE", "PK_DIM_ACCOUNT", "DIM")])
with open(H / "db_objects.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["object_type", "schema", "name", "on_table", "columns", "used_by"])
    w.writerows([("PROCEDURE", "PBDWAPP", "PRC_ACCOUNT_EDM_END_DATE", "DIM_ACCOUNT", "", "SCN_DIM_ACCOUNT")])
with open(H / "lineage_edges.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["src_type", "src", "relation", "dst_type", "dst", "detail"])
    w.writerows([("TABLE", "STG2_ACCOUNT", "feeds", "TABLE", "DIM_ACCOUNT", "SCN_DIM_ACCOUNT")])
print("fixtures written")
