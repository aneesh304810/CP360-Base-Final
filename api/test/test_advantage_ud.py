"""The UD code dictionary: what loads, what is refused, what is masked.

WHY THESE ASSERTIONS. The profiler splits every "a=b" it meets, so the
csv it writes carries prose beside codes. A loader that trusted it would
put "ANNUAL MIN" into a lookup table and Datapoint 360 would show it as a
value of a billing field. The filter is the feature; the rest guards the
route that serves the pane: a non-UD name is refused before the database,
a missing table is an empty list and not a 500, and a row flagged PII
never leaves the server with its text.

    python api/test/test_advantage_ud.py
"""
import csv
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import HTTPException                             # noqa: E402
from ingestion.advantage_ud_dictionary_conn import (          # noqa: E402
    AdvantageUdDictionaryConnector, false_positive, parent_of)
from api.app import routers_advantage_ud as R                 # noqa: E402

bad = 0


def ok(cond, msg, got=None):
    global bad
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {got!r}"))
    if not cond:
        bad += 1


print("-- the filter")
ok(false_positive("UD_1", "2", "CLIENT ACCOUNT") is None, "a real code=description pair is kept")
ok(false_positive("UD_14", "TE", "TAX EXEMPT") is None, "an alpha code is kept")
ok(false_positive("UD_1", "000100", "SOMETHING") is None, "a leading-zero code is kept as text")
ok(false_positive("UD_32_19", "ANNUAL MIN", "87500") == "FREE_TEXT_PARENT",
   "a billing narrative line is dropped by its parent, whatever it says")
ok(false_positive("UD_7", "PASSWORD PROTECT; PW", "X") == "CODE_SHAPE",
   "prose with spaces is not a code even outside UD_32")
ok(false_positive("UD_7", "", "X") == "CODE_SHAPE", "an empty code is dropped")
ok(false_positive("UD_7", "A", "") == "EMPTY", "an empty description is dropped")
ok(false_positive("ACCOUNT_NUMBER", "1", "X") == "NOT_UD", "a non-UD key is dropped")
ok(parent_of("UD_23_1") == "UD_23" and parent_of("UD_1") is None, "parent derived from the key")

print("-- parse end to end from a csv shaped like the profiler's")
d = tempfile.mkdtemp()
p = os.path.join(d, "code_dictionary.csv")
with open(p, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["attribute_name", "code_value", "description_value", "occurrence_count"])
    w.writerow(["UD_1", "2", "CLIENT ACCOUNT", "18000.0"])
    w.writerow(["UD_1", "6", "PARTNER ACCOUNT", "120"])
    w.writerow(["UD_1", "2", "CLIENT ACCOUNT", "5"])          # duplicate pair
    w.writerow(["UD_32_19", "ANNUAL MIN", "87500", "3"])
    w.writerow(["UD_503", "S", "SINGLY", "900"])
b = AdvantageUdDictionaryConnector(p).parse()
rows = b["codes"]
ok(len(rows) == 3, "two UD_1 codes and UD_503, nothing from UD_32, no duplicate", [r["dict_key"] for r in rows])
r1 = next(r for r in rows if r["code_value"] == "2")
ok(r1["occurrence_count"] == 18000 and isinstance(r1["occurrence_count"], int),
   "a float count from pandas is stored as an integer", r1["occurrence_count"])
ok(r1["dict_key"] == "UD_1:2:OBSERVED" and r1["source"] == "OBSERVED" and r1["link_status"] == "OBSERVED",
   "observed rows say so in key, source and status")
ok(b["dropped"] == {"FREE_TEXT_PARENT": 1}, "the drop reasons are counted", b["dropped"])
ok(AdvantageUdDictionaryConnector(os.path.join(d, "missing.csv")).parse()["codes"] == [],
   "a missing file loads nothing and does not raise")

class _L:
    def __init__(self): self.m = []; self.c = 0
    def _merge(self, t, pk, v): self.m.append((t, pk, v["dict_key"]))
    def commit(self): self.c += 1
L = _L()
n = AdvantageUdDictionaryConnector(p).load(L, b)
ok(n == 3 and L.c == 1 and all(t == "cp_advantage_ud_dictionary" and pk == ("dict_key",) for t, pk, _ in L.m),
   "load merges by dict_key into cp_advantage_ud_dictionary and commits once")

print("-- the route")
for name in ("ACCOUNT_NUMBER", "UD", "UD_1_", "BI_2_1", ""):
    try:
        R.codes(name); ok(False, f"{name!r} must be refused")
    except HTTPException as e:
        ok(e.status_code == 400, f"{name!r} -> 400", e.status_code)
seen = {}
R.query = lambda sql, p=None: seen.setdefault("p", p) and [
    {"attribute_name": "UD_1", "code_value": "2", "description_value": "CLIENT ACCOUNT",
     "occurrence_count": 18000, "source": "OBSERVED", "link_status": "OBSERVED", "is_pii": "N"},
    {"attribute_name": "UD_1", "code_value": "9", "description_value": "A PERSON",
     "occurrence_count": 1, "source": "TABLES", "link_status": "VERIFIED", "is_pii": "Y"}]
out = R.codes("ud_1")
ok(seen["p"] == {"a": "UD_1"}, "the name is upper-cased before it is bound", seen["p"])
ok(out["sources"] == ["OBSERVED", "TABLES"], "sources are listed", out["sources"])
ok(out["codes"][1]["description_value"] == "•••", "a PII row's text is masked on the server")
ok(out["codes"][0]["description_value"] == "CLIENT ACCOUNT", "and a plain row is not")
R.query = lambda sql, p=None: (_ for _ in ()).throw(RuntimeError("ORA-00942: table or view does not exist"))
out = R.codes("UD_1")
ok(out["codes"] == [] and out["sources"] == [], "a warehouse without sql/75 answers an empty list, not a 500")

print("-- it is mounted")
src = open(os.path.join(os.path.dirname(__file__), "..", "app", "main.py")).read()
ok('"routers_advantage_ud"' in src, "main.py names the router in the guarded tuple")
src = open(os.path.join(os.path.dirname(__file__), "..", "..", "ingestion", "run.py")).read()
ok('"advantage_ud_dictionary"' in src and "AdvantageUdDictionaryConnector" in src,
   "ingestion/run.py lists and dispatches the step")

print()
print("advantage_ud assertions " + ("FAIL" if bad else "pass"))
if bad:
    sys.exit(1)
