from scd2lens.odi.parse_variables import parse_date_variable


def test_start_and_end_variables(export):
    v = export.odi_variables
    s = parse_date_variable("V_PBDW_START_DATE_NEW", v[v.name.str.endswith("START_DATE_NEW")].iloc[0].refresh_sql)
    e = parse_date_variable("V_PBDW_END_DATE_NEW", v[v.name.str.endswith("END_DATE_NEW")].iloc[0].refresh_sql)
    assert s.found and s.branches["EOD"] == "PRIOR_BUSINESS_DATE" and s.branches["INTRADAY"] == "CURRENT_BUSINESS_DATE"
    assert s.offset_days == 0 and s.source_table == "DIM_CONTROL_DATES"
    assert e.branches["EOD"] == "PRIOR_BUSINESS_DATE" and e.offset_days == -1


def test_unparseable_variable_is_not_found():
    assert not parse_date_variable("V_X", "select sysdate from dual").found
