from scd2lens.odi.parse_enddate import parse_enddate


def test_golden_end_date_proc(export):
    t = export.scenario_tasks
    r = t[t.task_name2 == "PRC_ACCOUNT_EDM_END_DATE"].iloc[0]
    p = parse_enddate(r.code_preview, int(r.code_chars))
    assert p.found and p.table == "DIM_ACCOUNT"
    assert set(p.sets) == {"END_DATE", "UPDATED_TSP"}
    assert "V_PBDW_END_DATE_NEW" in p.sets["END_DATE"]
    assert p.natural_key == "ACCOUNT_NUMBER" and p.source_table == "STG2_ACCOUNT"
    assert p.filters == {"MASTER_IND": "N"}
    assert p.end_is_null and p.batch_trigger and p.excludes_current_batch
    assert not p.sets_active_ind
    assert "V_PBDW_END_DATE_NEW" in p.variables and "V_PBDW_BATCH_ID" in p.variables


def test_security_proc_requires_start_not_null(export):
    t = export.scenario_tasks
    r = t[t.task_name2 == "PRC_SECURITY_EDM_END_DATE"].iloc[0]
    p = parse_enddate(r.code_preview, int(r.code_chars))
    assert p.natural_key == "CUSIP" and p.start_not_null and p.filters == {}


def test_not_an_end_date_proc():
    assert parse_enddate("update t set x = 1 where y = 2").status == "ABSENT"
    assert parse_enddate("update t set", 9000).status == "UNKNOWN_TRUNCATED"
