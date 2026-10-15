"""routers_scd2: the three reads, with _safe patched to a fake store.

    python api/test/test_scd2_api.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from api.app import routers_scd2 as R   # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


CARD = {"table_name": "DIM_ACCOUNT", "pattern": "MERGE_SCD2", "scan_verdict": "SCD2", "writers": "SCN_DIM_ACCOUNT", "surrogate_key": "ACCOUNT_KEY",
        "natural_key": "ACCOUNT_NUMBER", "version_key": "ACCOUNT_NUMBER, START_DATE", "partition_col": "MASTER_IND",
        "partition_values": '{"N": "SCN_DIM_ACCOUNT", "Y": "SCN_DIM_MASTER_ACCOUNT"}', "row_count": 272373, "dup_rows": 275, "dup_pct": 0.1,
        "dup_keys": 3, "gaps": 0, "overlaps": 0, "multiple_open": 0, "none_open": 12, "active_open_not_flagged": 4000,
        "active_closed_but_flagged": 0, "freshness_alert": "latest version is 20 days behind", "volume_alerts": None,
        "rule_count": 8, "proven_count": 7, "inferred_count": 1, "unknown_count": 0, "open_count": 1, "notes": None, "ran_at": "2026-10-15T10:00:00"}


def fake_safe(sql, params=None):
    s = " ".join(sql.split()).lower()
    if "from scd2_card where table_name" in s:
        return [dict(CARD)] if params.get("t") == "DIM_ACCOUNT" else []
    if "from scd2_card group by pattern" in s:
        return [{"pattern": "MERGE_SCD2", "n": 2}, {"pattern": "TRUNCATE_APPEND_HIST", "n": 1}]
    if "sum(proven_count)" in s:
        return [{"proven": 14, "inferred": 1, "unknown": 2, "open_questions": 3, "tables_": 3, "profiled": 1, "stale": 1, "last_run": "2026-10-15T10:00:00"}]
    if "from scd2_card order by" in s:
        return [dict(CARD)]
    if "from scd2_rule r" in s:
        assert params.get("ra") == CARD["ran_at"] and "left join scd2_rule_review" in s and "r.ran_at = :ra" in s, "rules joined to their sign-off at the card's ran_at"
        return [{"rule_id": "R2", "rule_text": "closes", "confidence": "PROVEN", "evidence": "e", "confirmed": "Y", "reviewer": "A", "rule_changed_since": "N"},
                {"rule_id": "R10", "rule_text": "x", "confidence": "INFERRED", "evidence": "db", "confirmed": None, "reviewer": None, "rule_changed_since": "N"}]
    if "from scd2_rule_review group by" in s:
        return [{"table_name": "DIM_ACCOUNT", "confirmed": 1, "rejected": 0}]
    if "from scd2_rule_review" in s:
        return [{"confirmed": 5, "rejected": 1, "reviewers": 2}]
    if "from scd2_mapping" in s:
        return [{"pbdw_column": "ACTIVE_IND", "data360_attr": "IS_CURRENT (unreliable)"}]
    if "from scd2_open_question" in s:
        return [{"seq": 1, "question": "re-export task 50"}]
    if "from scd2_dup_month" in s:
        return [{"month": "2026-02", "versions": 409, "dup_rows": 20}]
    if "from scd2_column_role" in s:
        return [{"table_name": "DIM_ACCOUNT", "valid_from": "START_DATE"}]
    return []


R._safe = fake_safe

s = R.summary()
ok(s["loaded"] and s["tables"] == 3 and s["confidence"] == {"proven": 14, "inferred": 1, "unknown": 2} and s["stale"] == 1,
   "summary: tables, confidence mix, stale count", s)
ok([p["pattern"] for p in s["by_pattern"]] == ["MERGE_SCD2", "TRUNCATE_APPEND_HIST"], "patterns in the fixed order", s["by_pattern"])
ok(s["review"] == {"confirmed": 5, "rejected": 1, "reviewers": 2}, "summary carries the sign-off counts", s["review"])

c = R.cards()
ok(c["loaded"] and c["count"] == 1 and c["cards"][0]["partition_values"] == {"N": "SCN_DIM_ACCOUNT", "Y": "SCN_DIM_MASTER_ACCOUNT"},
   "cards: the partition JSON is decoded", c["cards"][0].get("partition_values"))
ok(c["cards"][0]["confirmed_count"] == 1 and c["cards"][0]["rejected_count"] == 0, "cards carry their confirmed / rejected counts")

d = R.card("dim_account")
ok(d["rules"][0]["confirmed"] == "Y" and d["rules"][0]["reviewer"] == "A" and d["rules"][1]["reviewer"] is None, "the card's rules carry the sign-off beside the evidence")
ok(d["loaded"] and d["table"] == "DIM_ACCOUNT" and len(d["rules"]) == 2 and d["mapping"][0]["pbdw_column"] == "ACTIVE_IND"
   and d["open_questions"][0]["seq"] == 1 and d["dup_by_month"][0]["versions"] == 409 and d["column_roles"]["valid_from"] == "START_DATE",
   "card: head, rules, mapping, questions, months and the scan roles", {k: len(v) if isinstance(v, list) else v for k, v in d.items() if k != "card"})
ok(R.card("DIM_NOPE") == {"table": "DIM_NOPE", "loaded": False}, "an unknown table is not loaded, not a 500")

R._safe = lambda sql, params=None: []
ok(R.summary()["loaded"] is False and R.cards()["loaded"] is False, "an absent sql/81 is 'not loaded', never a 500")

print(f"\n{BAD} assertion(s) failed" if BAD else "\nscd2-api assertions pass")
sys.exit(1 if BAD else 0)
