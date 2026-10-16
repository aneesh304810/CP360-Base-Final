"""tools/scd2_scan.py — the role rules and the verdict, on synthetic tables.

Every column name here is invented; none comes from a real warehouse. The
point is the rules: a date called TRADE_DATE is not a validity window, a
VALID_TO that is nullable means NULL-is-open, and a table with an as-of
date and no window is a snapshot, not SCD2.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from tools.scd2_scan import classify, role_of, report  # noqa: E402

bad = 0


def ok(c, m, got=""):
    global bad
    print(f"{'ok  ' if c else 'FAIL'} {m}{'' if c else f'  -> {got}'}")
    if not c:
        bad += 1


def cols(*spec):
    return [{"column": n, "type": t, "nullable": nl} for n, t, nl in spec]


# ---- roles ----------------------------------------------------------------
ok(role_of("EFF_START_DT", "DATE")[0] == "VALID_FROM", "EFF_START_DT is a valid-from")
ok(role_of("EFFECTIVE_FROM_TS", "TIMESTAMP(6)")[0] == "VALID_FROM", "EFFECTIVE_FROM_TS is a valid-from")
ok(role_of("ROW_END_DT", "DATE")[0] == "VALID_TO", "ROW_END_DT is a valid-to")
ok(role_of("EXPIRATION_DATE", "DATE")[0] == "VALID_TO", "EXPIRATION_DATE is a valid-to")
ok(role_of("TRADE_DATE", "DATE")[0] is None, "TRADE_DATE is not a window", role_of("TRADE_DATE", "DATE"))
ok(role_of("SETTLE_DT", "DATE")[0] is None, "SETTLE_DT is not a window", role_of("SETTLE_DT", "DATE"))
ok(role_of("EFF_START_DT", "VARCHAR2(8)")[0] is None, "a text column cannot be a validity date", role_of("EFF_START_DT", "VARCHAR2(8)"))
ok(role_of("CURR_FLG", "CHAR(1)")[0] == "CURRENT_FLAG", "CURR_FLG is a current flag")
ok(role_of("ACTIVE_IND", "NUMBER(1)")[0] == "CURRENT_FLAG", "ACTIVE_IND is a current flag (SEI's name)")
ok(role_of("IS_CURRENT", "CHAR(1)")[0] == "CURRENT_FLAG", "IS_CURRENT is a current flag (the target's name)")
ok(role_of("REC_VERSION_NO", "NUMBER(6)")[0] == "VERSION", "REC_VERSION_NO is a version")
ok(role_of("ROW_HASH", "VARCHAR2(64)")[0] == "ROW_HASH", "ROW_HASH is a hash")
ok(role_of("ACCOUNT_SK", "NUMBER(18)")[0] == "SURROGATE_KEY", "ACCOUNT_SK is a surrogate key")
ok(role_of("ACCOUNT_KEY", "NUMBER(18)")[1] == 1, "ACCOUNT_KEY is only a weak surrogate — it may be natural")
ok(role_of("BUSINESS_DATE", "DATE")[0] == "BUSINESS_DATE" and role_of("AS_OF_DT", "DATE")[0] == "BUSINESS_DATE", "as-of dates are snapshot grain")
ok(role_of("LOAD_ID", "NUMBER")[0] == "AUDIT" and role_of("DW_INSERT_TS", "TIMESTAMP")[0] == "AUDIT", "load and insert stamps are audit")

# ---- verdicts ---------------------------------------------------------------
dim = classify(cols(("ACCT_SK", "NUMBER(18)", "N"), ("ACCT_NO", "VARCHAR2(20)", "N"), ("ACCT_NAME", "VARCHAR2(100)", "Y"),
                    ("EFF_START_DT", "DATE", "N"), ("EFF_END_DT", "DATE", "N"), ("CURR_FLG", "CHAR(1)", "N"),
                    ("TRADE_DATE", "DATE", "Y"), ("LOAD_ID", "NUMBER", "N")))
ok(dim["verdict"] == "SCD2" and dim["confidence"] == "high", "a dimension with both ends and a flag is SCD2", dim)
ok(dim["roles"]["VALID_FROM"] == "EFF_START_DT" and dim["roles"]["VALID_TO"] == "EFF_END_DT" and dim["roles"]["CURRENT_FLAG"] == "CURR_FLG"
   and dim["roles"]["SURROGATE_KEY"] == "ACCT_SK", "and each role names its column", dim["roles"])
ok(dim["to_convention"] == "high date = open (NOT NULL)", "a NOT NULL end date means the high-date convention", dim["to_convention"])
ok(dim["missing_for_full_scd2"] == ["VERSION"], "what the target design adds: a version number", dim["missing_for_full_scd2"])
conv = classify(cols(("ACCOUNT_KEY", "NUMBER(18)", "N"), ("ACCOUNT_ID", "VARCHAR2(20)", "N"), ("START_DATE", "DATE", "N"),
                     ("END_DATE", "DATE", "N"), ("ACTIVE_IND", "NUMBER(1)", "N"), ("LOAD_DATE", "DATE", "N")))
ok(conv["verdict"] == "SCD2" and "SURROGATE_KEY" not in conv["missing_for_full_scd2"] and conv["roles"]["SURROGATE_KEY"] == "ACCOUNT_KEY",
   "on an SCD2 table a bare *_KEY is taken as the surrogate by convention", conv)
ok(any("confirm it is not the natural key" in n for n in conv["notes"]) and any("sentinel end date" in n for n in conv["notes"])
   and any("RECORD_VERSION can be derived" in n for n in conv["notes"]), "and the notes say what to confirm and what to derive", conv["notes"])
ok("EFF_START_DT -> VALID_FROM_DATE / EFFECTIVE_FROM_TS" in [f"{c} -> {m}" for c, m in dim["maps_to"].items()], "the crosswalk names the target attribute")

nullable_end = classify(cols(("VALID_FROM_DT", "DATE", "N"), ("VALID_TO_DT", "DATE", "Y"), ("CLIENT_ID", "VARCHAR2(12)", "N")))
ok(nullable_end["verdict"] == "SCD2" and nullable_end["to_convention"] == "NULL = open", "a nullable end date means NULL-is-open")

probable = classify(cols(("EFF_DT", "DATE", "N"), ("VERSION_NO", "NUMBER", "N"), ("ID", "NUMBER", "N")))
ok(probable["verdict"] == "SCD2 (probable)", "one end plus a version is probable, not certain", probable["verdict"])

snap = classify(cols(("AS_OF_DT", "DATE", "N"), ("POSITION_ID", "NUMBER", "N"), ("QTY", "NUMBER", "Y"), ("LOAD_DT", "DATE", "N")))
ok(snap["verdict"] == "SNAPSHOT", "an as-of date with no window is a periodic snapshot", snap["verdict"])

scd1 = classify(cols(("ID", "NUMBER", "N"), ("NAME", "VARCHAR2(50)", "Y"), ("UPDATE_TS", "TIMESTAMP", "Y"), ("UPDATED_BY", "VARCHAR2(30)", "Y")))
ok(scd1["verdict"] == "SCD1", "audit stamps alone are overwrite-in-place", scd1["verdict"])

none = classify(cols(("ID", "NUMBER", "N"), ("DESCRIPTION", "VARCHAR2(50)", "Y"), ("TRADE_DATE", "DATE", "Y")))
ok(none["verdict"] == "NONE", "nothing that tracks change is NONE", none["verdict"])

# ---- the report -------------------------------------------------------------
import tempfile  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, "r.csv")
    rows = report({"DIM_X": dim and cols(("X_SK", "NUMBER", "N"), ("EFF_FROM_DT", "DATE", "N"), ("EFF_TO_DT", "DATE", "Y")),
                   "FACT_Y": cols(("Y_ID", "NUMBER", "N"), ("AS_OF_DATE", "DATE", "N"))}, p)
    txt = open(p, encoding="utf-8").read()
    ok(len(rows) == 2 and rows[0]["verdict"] == "SCD2" and rows[1]["verdict"] == "SNAPSHOT", "the report classifies each table", rows)
    ok("to_convention" in txt and "maps_to" in txt and "EFF_FROM_DT" in txt, "the CSV carries the convention and the crosswalk")
    ok(not any(k in txt for k in ("SELECT", "VALUE")), "the report is structure only — no values")

# ---- the oracle source goes through the warehouse login -------------------
# The hub account cannot see the warehouse dictionary; run through it the scan
# reported "tables: 0" and nothing said why. With PBDW_* set, the warehouse
# session is used; without them, the hub, and an empty result says which door.
import io  # noqa: E402
import tools.scd2_scan as S  # noqa: E402
calls = []
def fake_runner(sql, binds=None):
    calls.append(("wh", binds))
    return [{"s": "PBDWAPP", "t": "DIM_X", "c": "EFF_FROM_DT", "ty": "DATE", "n": "N"}]
for k in ("PBDW_DSN", "PBDW_USER", "PBDW_PASSWORD"):
    os.environ[k] = "x"
S._warehouse_query = lambda: fake_runner
S._hub_query = lambda: (lambda sql, binds=None: calls.append(("hub", binds)) or [])
out = S.read_oracle("pbdwapp")
ok(calls and calls[-1][0] == "wh" and calls[-1][1] == {"o": "PBDWAPP"} and "PBDWAPP.DIM_X" in out,
   "with PBDW_* set the warehouse session answers, owner upper-cased", calls)
for k in ("PBDW_DSN", "PBDW_USER", "PBDW_PASSWORD"):
    os.environ.pop(k, None)
S._warehouse_query = lambda: None
err = io.StringIO(); _stderr = sys.stderr; sys.stderr = err
try:
    out = S.read_oracle("PBDWAPP")
finally:
    sys.stderr = _stderr
ok(out == {} and calls[-1][0] == "hub" and "PBDW_DSN" in err.getvalue(),
   "without them the hub answers, and an empty result names the three variables to set", err.getvalue())

print(f"\n{bad} assertion(s) failed" if bad else "\nscd2-scan assertions pass")
sys.exit(1 if bad else 0)
