from scd2lens.odi.parse_merge import parse_merge


def _task(export, scenario, task_no):
    t = export.scenario_tasks
    return t[(t.scenario == scenario) & (t.task_no == task_no)].iloc[0]


def test_golden_merge_on_clause(export):
    r = _task(export, "SCN_DIM_ACCOUNT", 240)
    p = parse_merge(r.code_preview, int(r.code_chars), "START_DATE")
    assert p.found and p.status == "PROVEN"
    assert p.target == "DIM_ACCOUNT"
    assert p.on_keys == ["ACCOUNT_NUMBER", "START_DATE"]
    assert p.version_key == ["ACCOUNT_NUMBER", "START_DATE"]
    assert p.natural_key == ["ACCOUNT_NUMBER"]
    assert p.inserts and p.update_set == []


def test_update_merge_lists_set_columns(export):
    r = _task(export, "SCN_DIM_ACCOUNT", 420)
    p = parse_merge(r.code_preview, int(r.code_chars), "START_DATE")
    assert p.on_keys == ["ACCOUNT_NUMBER", "START_DATE"]
    assert p.update_set == ["ACCOUNT_NAME", "ACCOUNT_TYPE", "BATCH_ID", "UPDATED_TSP"]
    assert not p.inserts


def test_truncated_preview_is_unknown_not_absent(export):
    r = _task(export, "SCN_DIM_ACCOUNT", 50)
    p = parse_merge(r.code_preview, int(r.code_chars))
    assert not p.found and p.status == "UNKNOWN_TRUNCATED"
    assert parse_merge("select 1 from dual", 18).status == "ABSENT"


def test_natural_key_drops_date_like_when_valid_from_unknown():
    p = parse_merge("merge into T T using S S on (T.CUSIP=S.CUSIP and T.EFF_DT=S.EFF_DT) when not matched then insert (a) values (1)")
    assert p.natural_key == ["CUSIP"]
