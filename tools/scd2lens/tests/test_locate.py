from scd2lens.odi.locate import tasks_writing, write_op, writers_of
from scd2lens.odi.normalise import normalise_code, variables_in


def test_writers_of_dim_account(export):
    assert writers_of(export, "DIM_ACCOUNT") == ["SCN_DIM_ACCOUNT", "SCN_DIM_MASTER_ACCOUNT"]
    assert writers_of(export, "DIM_IP_RELATIONSHIP") == ["SCN_DIM_IP_RELATIONSHIP"]
    assert writers_of(export, "DIM_NOPE") == []


def test_tasks_writing_and_ops(export):
    t = tasks_writing(export, "DIM_ACCOUNT")
    assert list(t["task_no"]) == [240, 420, 10, 10, 10]
    assert write_op("DIM_ACCOUNT(UPDATE)", "DIM_ACCOUNT") == "UPDATE"
    assert write_op("DIM_ACCOUNT_HIST(INSERT)", "DIM_ACCOUNT") is None


def test_normalise_strips_odi_tokens():
    s = normalise_code('merge   into <?= odiRef.getObjectName("L", "DIM_ACCOUNT", "PBDWAPP", "D") ?> T where x = #PBDW_STAGING_1.V_PBDW_BATCH_ID')
    assert s == "merge into DIM_ACCOUNT T where x = :V_PBDW_BATCH_ID"
    assert variables_in("a = #V_PBDW_END_DATE_NEW and b = #PBDW_STAGING_1.V_PBDW_BATCH_ID") == ["V_PBDW_BATCH_ID", "V_PBDW_END_DATE_NEW"]
