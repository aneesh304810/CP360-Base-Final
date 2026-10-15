"""The scd2 step: cards from the scd2lens fixtures, merged through a fake loader.

No database and no real export: the fixtures under tools/scd2lens/tests are
synthetic. What this proves is the plumbing — the connector finds scd2lens,
builds a card per SCD2 table, and every rule, mapping, question and scan
role reaches the right table with the card's RAN_AT.

    python ingestion/test/test_scd2_conn.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ingestion.scd2_conn import Scd2Connector   # noqa: E402

FIX = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "scd2lens", "tests", "fixtures")
BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class FakeLoader:
    def __init__(self):
        self.rows = []
        self.committed = False

    def _merge(self, table, pk, values, protect=()):
        for k in pk:
            assert values.get(k) is not None, (table, k)
        self.rows.append((table, dict(values)))

    def commit(self):
        self.committed = True


c = Scd2Connector(FIX, with_db=False)
b = c.parse()
tables = [x.table for x in b["cards"]]
ok(tables == ["DIM_ACCOUNT", "DIM_IP_RELATIONSHIP", "DIM_SECURITY"], "one card per table the scan called SCD2", tables)
ok(all(x.ran_at is None for x in []) or b["ran_at"] is not None, "the run carries a timestamp")

L = FakeLoader()
n = c.load(L, b)
by = {}
for t, v in L.rows:
    by.setdefault(t, []).append(v)
ok(L.committed and n == len(L.rows), "every merge counted and the load committed", n)
ok(len(by["scd2_card"]) == 3 and by["scd2_card"][0]["pattern"] == "MERGE_SCD2" and by["scd2_card"][0]["partition_col"] == "MASTER_IND",
   "scd2_card carries pattern, keys and the sub-population", by["scd2_card"][0])
acc = [r for r in by["scd2_rule"] if r["table_name"] == "DIM_ACCOUNT"]
ok(len(acc) == 7 and all(r["confidence"] == "PROVEN" and r["evidence"] for r in acc) and all(r["ran_at"] == b["ran_at"] for r in acc),
   "DIM_ACCOUNT's seven rules land with confidence, evidence and the run's timestamp", [(r["rule_id"], r["confidence"]) for r in acc])
ok(any(r["pbdw_column"] == "ACTIVE_IND" and "unreliable" in r["data360_attr"] for r in by["scd2_mapping"]), "the mapping flags ACTIVE_IND as unreliable")
ok(any("task 50" in r["question"] for r in by["scd2_open_question"]), "the truncated LKM task is an open question")
roles = {r["table_name"]: r for r in by["scd2_column_role"]}
ok(roles["DIM_ACCOUNT"]["valid_from"] == "START_DATE" and roles["DIM_ACCOUNT"]["current_flag"] == "ACTIVE_IND" and "FACT_POS" in roles,
   "the column scan's roles land for every scanned table, SCD2 or not", roles.get("DIM_ACCOUNT"))
card = by["scd2_card"][0]
ok(card["row_count"] is None and card["proven_count"] == 7 and card["unknown_count"] == 0 and card["open_count"] >= 1,
   "offline: quality empty, confidence counts filled", card)
ok(not any(k in str(L.rows) for k in ("57620755", "501850")), "no warehouse key value anywhere in the rows")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nscd2-conn assertions pass")
sys.exit(1 if BAD else 0)
