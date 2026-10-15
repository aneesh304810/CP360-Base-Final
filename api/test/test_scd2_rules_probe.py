"""tools/scd2_rules_probe.py — the questions it generates, on invented names."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from tools.scd2_rules_probe import questions, _ident  # noqa: E402

bad = 0


def ok(c, m, got=""):
    global bad
    print(f"{'ok  ' if c else 'FAIL'} {m}{'' if c else f'  -> {got}'}")
    if not c:
        bad += 1


qs = questions("DIM_X", "X_KEY", "X_NO", "START_DATE", "END_DATE", "ACTIVE_IND", "LOAD_DATE", ["TYPE_CD", "CCY", "STATUS"])
titles = [t for t, _ in qs]
ok(len(qs) == 11, "eleven questions when a flag, a load date and attributes are given", len(qs))
ok(all(t.split(" ")[0] in {str(i) for i in range(1, 12)} for t in titles), "numbered 1 to 11", titles)
sql = "\n".join(s for _, s in qs)
ok("SELECT *" not in sql.replace("SELECT * FROM (SELECT", ""), "no query selects business columns outright")
ok(all(w in sql for w in ("COUNT(", "SUM(CASE", "LEAD(")), "the questions are counts over consecutive versions")
ok("TYPE_CD_chg" in sql and "DECODE(TYPE_CD, n_0, 0, 1)" in sql, "the tracked-attribute question compares each column with its successor")
ok("ACTIVE_IND = '1'" in sql, "the open row is the flag's active value")

noflag = questions("DIM_X", "X_KEY", "X_NO", "START_DATE", "END_DATE", None, None, [])
ok(len(noflag) == 7 and "MAX(END_DATE)" in noflag[0][1], "without a flag the open row is the max end date, and the load questions drop out", len(noflag))

many = questions("DIM_X", "X_KEY", "X_NO", "S", "E", "F", None, [f"C{i}" for i in range(90)])
ok(sum(1 for t, _ in many if t.startswith("7 ")) == 3, "ninety attributes are tested in three chunks", [t for t, _ in many if t.startswith("7")])

try:
    _ident("X; DROP TABLE Y"); ok(False, "an identifier with punctuation is refused")
except SystemExit:
    ok(True, "an identifier with punctuation is refused")

print(f"\n{bad} assertion(s) failed" if bad else "\nscd2-rules-probe assertions pass")
sys.exit(1 if bad else 0)
