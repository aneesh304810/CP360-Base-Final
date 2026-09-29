"""Adopting a new specification version must be a decision, not a hurry.

WHY. The gates encode v1.0: 105 events, 575 fields, 4 payload fields per
data event and 3 per marker. A v1.1 workbook refused the whole load --
correctly, because a load four rows short is worse than one that fails.
But the wrong response to that is editing the constants at 6pm and losing
the record of who decided the new numbers were right.

So every expectation is overridable by environment and every override is
logged at WARNING with the old value beside the new. The gate still
refuses anything that does not match; what changed is that the match is
declared where a run log records it.

    python ingestion/test/test_event360_expectations.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ingestion import event360_conn as M                      # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


def env(**kw):
    for k in ("CP_EVENT360_EXPECT_EVENTS", "CP_EVENT360_EXPECT_FIELDS",
              "CP_EVENT360_PAYLOAD_BY_TYPE"):
        os.environ.pop(k, None)
    for k, v in kw.items():
        os.environ[k] = v


# ---- defaults are untouched -------------------------------------------
env()
ok(M._expect("CP_EVENT360_EXPECT_EVENTS", 105) == 105,
   "unset leaves the built-in expectation alone")
ok(M._payload_by_type() == {}, "and no per-type widths", M._payload_by_type())

# ---- a declared value is used -----------------------------------------
env(CP_EVENT360_EXPECT_EVENTS="107")
ok(M._expect("CP_EVENT360_EXPECT_EVENTS", 105) == 107,
   "a declared count is used", M._expect("CP_EVENT360_EXPECT_EVENTS", 105))

env(CP_EVENT360_PAYLOAD_BY_TYPE="System=3, Marker=3")
ok(M._payload_by_type() == {"system": 3, "marker": 3},
   "per-type widths parse, whitespace and case included", M._payload_by_type())

# ---- nonsense is refused, not silently adopted ------------------------
env(CP_EVENT360_EXPECT_EVENTS="not-a-number")
ok(M._expect("CP_EVENT360_EXPECT_EVENTS", 105) == 105,
   "a non-numeric override falls back to the built-in rather than crashing "
   "or loading everything", M._expect("CP_EVENT360_EXPECT_EVENTS", 105))
env(CP_EVENT360_EXPECT_EVENTS="")
ok(M._expect("CP_EVENT360_EXPECT_EVENTS", 105) == 105, "an empty value is unset")
env(CP_EVENT360_PAYLOAD_BY_TYPE="System, Marker=x, =4, Business=2")
ok(M._payload_by_type() == {"business": 2},
   "malformed pairs are dropped and the good one kept", M._payload_by_type())

# ---- the two field gates must agree with each other -------------------
# The per-row check and the arithmetic totalled payload widths separately,
# so a per-type override applied to one and not the other would make the
# two messages blame different things for the same row.
def gates(events, fields, **e):
    """Only the count and payload gates are under test here, so the others
    are given what they need rather than being silenced -- a gate that has
    to be switched off to test its neighbour is a gate nobody trusts."""
    env(**e)
    c = M.Event360Connector("unused")
    doms = [{"domain": "Accounts", "coverage": "", "event_count": len(events)}]
    types = [{"event_type": k, "description": "", "event_count": 0}
             for k in ("Business", "System", "Marker", "Technical")]
    c._gates(events, fields, types, doms, [], [])
    return c.gate_failures


def ev(i, kind):
    """Every key _gates reads, so the fixture exercises the real gate rather
    than a stub of it. Listed explicitly: a missing key is a KeyError, which
    is a worse failure than a wrong value because it stops the other gates
    from running at all."""
    return {"event_id": i, "event_type": kind, "_is_marker": kind == "Marker",
            "section": f"4.{i}", "domain": "Accounts", "load_flag": "Y",
            "trigger_column_count": 0, "_sheet_trigger_count": None,
            "_key_parts": [], "_pipe_parts": [], "_payload_fields": []}


EV = [ev(i, "Business") for i in range(1, 4)] + [ev(90, "System")]
FL = ([{"event_id": i, "field_category": "PAYLOAD"}
       for i in range(1, 4) for _ in range(4)]
      + [{"event_id": 90, "field_category": "PAYLOAD"} for _ in range(3)])

f_no = gates(EV, FL, CP_EVENT360_EXPECT_EVENTS="4", CP_EVENT360_EXPECT_FIELDS="15")
ok(any("wrong payload field count" in x for x in f_no),
   "without the override the System event is refused", f_no)

f_yes = gates(EV, FL, CP_EVENT360_EXPECT_EVENTS="4",
              CP_EVENT360_EXPECT_FIELDS="15",
              CP_EVENT360_PAYLOAD_BY_TYPE="System=3")
ok(not any("wrong payload field count" in x for x in f_yes),
   "with it declared, the row check passes", f_yes)
ok(not any("field arithmetic" in x for x in f_yes),
   "and the arithmetic agrees — both read the same widths", f_yes)

# a declared width that is still wrong is still refused
f_bad = gates(EV, FL, CP_EVENT360_EXPECT_EVENTS="4",
              CP_EVENT360_EXPECT_FIELDS="15",
              CP_EVENT360_PAYLOAD_BY_TYPE="System=9")
ok(any("wrong payload field count" in x for x in f_bad),
   "declaring the wrong width does not make the gate pass", f_bad)

# and the count gates still bite
f_cnt = gates(EV, FL, CP_EVENT360_EXPECT_EVENTS="99",
              CP_EVENT360_PAYLOAD_BY_TYPE="System=3")
ok(any("event count" in x for x in f_cnt),
   "an override is an expectation, not an exemption", f_cnt)

env()
print(f"\n{BAD} assertion(s) failed" if BAD else "\nexpectation assertions pass")
sys.exit(1 if BAD else 0)
