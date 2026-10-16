import pytest

from scd2lens.config import Settings
from scd2lens.db.columns import entity_key, filter_tracked
from scd2lens.db.conn import Runner, resolve_ldap_dsn
from scd2lens.db.hashexpr import chunk_exprs, hash_expr
from scd2lens.db.ident import ident
from scd2lens.db.keydiff import diff_versions
from scd2lens.db.profile import base_view, dup_checks, flag_check, freshness, volume_drop, window_checks
from scd2lens.sqlfiles import ids, sql


def test_identifiers_are_validated():
    assert ident("dim_account") == "DIM_ACCOUNT"
    for bad in ("1ABC", "A B", "X; DROP TABLE Y", "a.b", ""):
        with pytest.raises(ValueError):
            ident(bad)


def test_sql_files_carry_ids():
    assert {"tracked_columns", "base_hash", "dup_summary", "dup_by_month", "top_keys", "windows_gap_overlap",
            "multiple_open_rows", "active_ind_consistency", "freshness", "key_rows", "control_dates"} <= set(ids())
    assert sql("tracked_columns").lstrip().startswith("-- id: tracked_columns")


def test_tracked_columns_drop_tech_surrogate_and_lobs():
    s = Settings()
    cols = [{"column_name": n, "data_type": t} for n, t in [("ACCOUNT_KEY", "NUMBER"), ("ACCOUNT_NUMBER", "VARCHAR2"), ("START_DATE", "DATE"),
                                                            ("END_DATE", "DATE"), ("ACTIVE_IND", "NUMBER"), ("NOTES", "CLOB"), ("OLD", "LONG RAW"),
                                                            ("ACCOUNT_TYPE", "VARCHAR2"), ("BATCH_ID", "NUMBER")]]
    assert [c["column_name"] for c in filter_tracked(cols, "DIM_ACCOUNT", s)] == ["ACCOUNT_NUMBER", "ACCOUNT_TYPE"]
    assert entity_key("DIM_INTERESTED_PARTY") == "INTERESTED_PARTY_KEY"


def test_hash_is_chunked_under_the_4000_byte_limit():
    cols = [{"column_name": f"COL_{i:03d}_WITH_A_LONG_NAME", "data_type": ["VARCHAR2", "NUMBER", "DATE", "TIMESTAMP(6)"][i % 4]} for i in range(500)]
    parts = chunk_exprs(cols, 8)
    assert len(parts) == 63
    assert all(len(p) < 4000 for p in parts)
    # ORA-01489 is about the string a concatenation PRODUCES: each chunk joins at most 8 values,
    # and the outer expression joins 63 forty-character hashes — 2,600 bytes at run time.
    assert all(p.count("|| '|' ||") <= 7 for p in parts)
    assert len(parts) * 40 + (len(parts) - 1) < 4000
    outer = hash_expr(cols, 8)
    assert outer.startswith("RAWTOHEX(STANDARD_HASH(") and outer.count("STANDARD_HASH(") == 64
    assert "TO_CHAR(COL_002_WITH_A_LONG_NAME, 'YYYYMMDDHH24MISS')" in parts[0]
    assert "TO_CHAR(COL_003_WITH_A_LONG_NAME, 'YYYYMMDDHH24MISSFF6')" in parts[0]
    assert hash_expr(cols[:3], 8) == chunk_exprs(cols[:3], 8)[0]


def test_profile_queries_bind_values_and_partition_by_keys(fake_run):
    s = Settings(); s.db_sample_since = "2024-01-01"
    tracked = [{"column_name": "ACCOUNT_TYPE", "data_type": "VARCHAR2"}, {"column_name": "BASE_CCY", "data_type": "VARCHAR2"}]
    base, binds = base_view(s, "DIM_ACCOUNT", ["ACCOUNT_NUMBER"], ["MASTER_IND"], tracked)
    assert "PARTITION BY ACCOUNT_NUMBER, MASTER_IND ORDER BY start_date" in base
    assert "start_date >= :since" in base and "since" in binds and "2024" not in base
    run = fake_run({"dup_pct": [{"total_rows": 10, "dup_rows": 1, "dup_pct": 10.0, "dup_keys": 1}], "ROWNUM <= :n": [{"key_value": "k", "versions": 3, "dup_rows": 1}]})
    out = dup_checks(run, s, "DIM_ACCOUNT", ["ACCOUNT_NUMBER"], ["MASTER_IND"], tracked)
    assert out["dup_summary"]["dup_pct"] == 10.0 and out["top_keys"][0]["versions"] == 3
    assert all(not q.lstrip().lower().startswith(("insert", "update", "delete", "create", "merge")) for q, _ in run.calls)
    assert any(b.get("n") == 10 for _, b in run.calls)
    run2 = fake_run({"bad_windows": [{"bad_windows": 2, "gaps": 1, "overlaps": 1}], "keys_many_open": [{"keys_many_open": 0, "keys_none_open": 5}]})
    w = window_checks(run2, s, "DIM_ACCOUNT", ["ACCOUNT_NUMBER"], [], offset_days=1)
    assert w["windows"]["gaps"] == 1 and w["open_rows"]["keys_none_open"] == 5
    assert any(b.get("offset") == 1 for _, b in run2.calls)
    assert flag_check(fake_run({"open_not_flagged": [{"open_not_flagged": 7, "closed_but_flagged": 0}]}), s, "DIM_ACCOUNT")["open_not_flagged"] == 7


def test_freshness_alert_and_volume_drop(fake_run):
    s = Settings()
    run = fake_run({"max_start": [{"max_start": "2026-02-09", "max_load": "2026-02-09", "max_updated": None, "total_rows": 1}],
                    "DIM_CONTROL_DATES": [{"load_date": "2026-03-01", "current_business_date": "2026-03-01", "prior_business_date": "2026-02-27"}]})
    f = freshness(run, s, "DIM_ACCOUNT")
    assert f["gap_days"] == 20 and "20 days" in f["alert"]
    months = [{"month": f"2025-{m:02d}", "versions": 400} for m in range(1, 13)] + [{"month": "2026-01", "versions": 409}, {"month": "2026-02", "versions": 6}]
    a = volume_drop(months)
    assert a == ["2026-02: 6 versions vs trailing median 400"]


def test_keydiff_golden_shape():
    """279 rows for one key, real change on six dates: 7 real versions, 272 duplicates."""
    from datetime import date, timedelta
    changes = {"2024-10-08": ["ACCOUNT_TYPE"], "2024-11-08": [f"C{i}" for i in range(46)], "2025-01-08": ["BASE_CCY"],
               "2025-03-05": ["STATUS"], "2025-10-01": ["ACCOUNT_TYPE"], "2026-02-09": ["C1"]}
    tracked = ["ACCOUNT_TYPE", "BASE_CCY", "STATUS"] + [f"C{i}" for i in range(46)]
    state = {c: "a" for c in tracked}
    # 279 version dates: the six change dates, the first load, and 272 business days in between
    first = date(2024, 9, 2)
    days, d = [], date(2024, 11, 9)
    while len(days) < 272:
        if d.weekday() < 5 and d.isoformat() not in changes:
            days.append(d)
        d += timedelta(days=1)
    dates = sorted([first] + [date.fromisoformat(k) for k in changes] + days)
    rows = []
    for d in dates:
        for c in changes.get(d.isoformat(), []):
            state[c] = state[c] + "x"
        rows.append({"ACCOUNT_NUMBER": "ACCT-TEST-1", "START_DATE": d, "LOAD_TYPE": "EOD", "BATCH_ID": len(rows), **state})
    h = diff_versions(rows, tracked)
    assert h.rows == 279 and h.real_versions == 7 and h.duplicates == 272
    assert [c for c, _ in h.changes][1:] == list(changes)
    assert len(h.changes[2][1]) == 46
    assert h.tech_by_version[0]["LOAD_TYPE"] == "EOD"


def test_ldap_dsn_is_resolved_and_plain_dsn_passes_through():
    seen = {}
    def lookup(host, port, alias, base):
        seen.update(host=host, port=port, alias=alias, base=base)
        return "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=h)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=svc)))"
    out = resolve_ldap_dsn("ldap://dir.example:3060/svc_alias,cn=OracleContext,dc=example,dc=com", lookup)
    assert out.startswith("(DESCRIPTION=") and seen == {"host": "dir.example", "port": 3060, "alias": "svc_alias", "base": "cn=OracleContext,dc=example,dc=com"}
    assert resolve_ldap_dsn("h:1521/svc", lookup) == "h:1521/svc"


def test_runner_refuses_anything_but_select():
    class Cur:
        description = [("A",)]
        def execute(self, s, b): pass
        def fetchall(self): return [(1,)]
        def __enter__(self): return self
        def __exit__(self, *a): pass
    class Conn:
        def cursor(self): return Cur()
    r = Runner(Conn())
    assert r("select 1 from dual") == [{"a": 1}]
    with pytest.raises(RuntimeError):
        r("delete from t")


def test_connect_switches_to_thick_mode_on_dpy_3001(monkeypatch):
    """The listener demands Native Network Encryption: thin fails with DPY-3001, thick is initialised, the retry succeeds."""
    from scd2lens.db import conn as c
    from scd2lens.config import Credentials
    monkeypatch.setattr(c, "_THICK", {"on": False})
    calls = {"init": 0, "connect": 0}
    monkeypatch.setattr(c, "init_thick", lambda lib_dir=None: calls.__setitem__("init", calls["init"] + 1) or c._THICK.__setitem__("on", True) or True)

    class Conn:
        call_timeout = None

    def connector(user, password, dsn):
        calls["connect"] += 1
        if calls["connect"] == 1:
            raise RuntimeError("DPY-6005: cannot connect to database. DPY-3001: Native Network Encryption and Data Integrity is only supported in python-oracledb thick mode")
        assert dsn == "h:1521/svc" and user == "u"
        return Conn()

    monkeypatch.delenv("PBDW_THICK", raising=False); monkeypatch.delenv("ORACLE_CLIENT_LIB", raising=False)
    out = c.connect(Credentials(dsn="h:1521/svc", user="u", password="p"), connector=connector)
    assert isinstance(out, Conn) and calls == {"init": 1, "connect": 2}


def test_connect_uses_thick_when_asked_and_reraises_other_errors(monkeypatch):
    from scd2lens.db import conn as c
    from scd2lens.config import Credentials
    monkeypatch.setattr(c, "_THICK", {"on": False})
    seen = []
    monkeypatch.setattr(c, "init_thick", lambda lib_dir=None: seen.append("thick") or c._THICK.__setitem__("on", True) or True)
    monkeypatch.setenv("PBDW_THICK", "1")

    def bad(user, password, dsn):
        raise RuntimeError("ORA-01017: invalid username/password")

    with pytest.raises(RuntimeError, match="ORA-01017"):
        c.connect(Credentials(dsn="h:1521/svc", user="u", password="p"), connector=bad)
    assert seen == ["thick"]


def test_init_thick_explains_a_thin_connection_already_open(monkeypatch):
    """DPY-2019: the process already went thin. The message names the cause and the two ways out,
    rather than telling the operator to install a client they may already have."""
    import scd2lens.db.conn as c
    import oracledb
    c._THICK["on"] = False
    monkeypatch.setattr(oracledb, "is_thin_mode", lambda: True)

    def boom(lib_dir=None):
        raise RuntimeError("DPY-2019: python-oracledb thick mode cannot be used because thin mode has already been enabled")
    monkeypatch.setattr(oracledb, "init_oracle_client", boom)
    with pytest.raises(RuntimeError) as ei:
        c.init_thick()
    assert "DPY-2019" in str(ei.value) and "BEFORE the first connection" in str(ei.value)
    assert "ingestion.run" in str(ei.value)


def test_init_thick_adopts_a_process_already_thick(monkeypatch):
    """When the ingestion runner started thick mode first, scd2lens notices and does not call init again."""
    import scd2lens.db.conn as c
    import oracledb
    c._THICK["on"] = False
    monkeypatch.setattr(oracledb, "is_thin_mode", lambda: False)
    monkeypatch.setattr(oracledb, "init_oracle_client", lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not init")))
    assert c.init_thick() is True and c._THICK["on"] is True
