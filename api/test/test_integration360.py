"""Integration 360 ingest, on fakes: the signature check, Airflow events to
rows, dbt run_results with manifest and sources to rows, a check with bad rows,
the summary per dag, the bad-rows SQL on allowlisted identifiers, the poller's
pure parts, and the router on a fake db. No network, no Oracle.
Run: python3.13 api/test/test_integration360.py"""
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "api"))
sys.path.insert(0, os.path.join(ROOT, "integration", "poll"))

from app import i360_ingest as I  # noqa: E402
import i360_poller as POLL        # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:240]}"))
    if not cond:
        BAD += 1


print("-- the posting is ours")
os.environ.pop("I360_WEBHOOK_SECRET", None); os.environ.pop("I360_INGEST_TOKEN", None)
ok(I.verify(b"{}", {}) == "unsigned", "with nothing configured a posting is accepted and marked unsigned")
os.environ["I360_WEBHOOK_SECRET"] = "s3"
sig = "sha256=" + hmac.new(b"s3", b'{"a":1}', hashlib.sha256).hexdigest()
ok(I.verify(b'{"a":1}', {"X-I360-Signature": sig}) == "ok" and I.verify(b'{"a":2}', {"X-I360-Signature": sig}) == "bad signature" and I.verify(b"{}", {}) == "missing signature", "the HMAC header is checked over the body")
os.environ["I360_INGEST_TOKEN"] = "t0k"
ok(I.verify(b"{}", {"Authorization": "Bearer t0k"}) == "ok" and I.verify(b"{}", {"Authorization": "Bearer nope"}) == "missing signature", "a bearer token is the other way in")
os.environ.pop("I360_WEBHOOK_SECRET"); os.environ.pop("I360_INGEST_TOKEN")

print("-- Airflow events")
ev = {"kind": "task", "dag_id": "swp_positions_processing", "run_id": "scheduled__2026-11-27T22:00:00+00:00", "task_id": "load_file", "map_index": 3, "state": "failed", "try_number": 2,
      "start_date": "2026-11-27T22:05:00+00:00", "end_date": "2026-11-27T22:06:30+00:00", "log_url": "", "conf": {"business_date": "20261127"},
      "error": "ValueError: TRAILER_COUNT_MISMATCH trailer=12480 rows=12479"}
r = I.airflow_rows(ev)
ok(r["run"]["run_key"] == "swp_positions_processing:scheduled__2026-11-27T22:00:00+00:00" and r["run"]["business_date"] == "2026-11-27" and r["run"]["state"] == "running", "the run row: key, business date from conf, state running until the run event")
ok(r["task"]["task_key"].endswith(":load_file:2:3") and r["task"]["state"] == "failed" and r["task"]["duration_s"] == 90 and r["task"]["error_code"] == "TRAILER_COUNT_MISMATCH" and r["task"]["map_index"] == 3, "the task row: mapped index in the key, duration from the dates, the loader's code picked out of the error line", r["task"])
r2 = I.airflow_rows({"kind": "run", "dag_id": "swp_positions_processing", "run_id": "x", "state": "failed", "start_date": "2026-11-27T22:00:00Z", "end_date": "2026-11-27T22:10:00Z", "logical_date": "2026-11-27T22:00:00Z"})
ok(r2["run"]["state"] == "failed" and r2["task"] is None and r2["run"]["business_date"] == "2026-11-27" and isinstance(r2["run"]["ended_at"], datetime), "a run event sets the state and the dates")
try:
    I.airflow_rows({"kind": "task", "dag_id": "d"}); ok(False, "a task event without ids is refused")
except ValueError:
    ok(True, "a task event without ids is refused")

print("-- dbt run results")
manifest = {"nodes": {
    "test.sei_bbh.not_null_stg_eod_positions_account_number.abc": {"resource_type": "test", "name": "not_null_stg_eod_positions_account_number", "column_name": "account_number", "attached_node": "model.sei_bbh.stg_eod_positions", "test_metadata": {"name": "not_null", "kwargs": {"column_name": "account_number", "model": "{{ ref('stg_eod_positions') }}"}}, "config": {"severity": "error"}},
    "test.sei_bbh.unique_int_account_account_number.def": {"resource_type": "test", "name": "unique_int_account_account_number", "column_name": "account_number", "depends_on": {"nodes": ["model.sei_bbh.int_account"]}, "test_metadata": {"name": "unique", "kwargs": {"column_name": "account_number"}}, "config": {"severity": "error"}},
    "model.sei_bbh.int_position": {"resource_type": "model", "name": "int_position", "config": {}}}}
rr = {"metadata": {"invocation_id": "inv-1", "generated_at": "2026-11-27T23:00:00Z"}, "args": {"vars": {"business_date": "20261127"}}, "results": [
    {"unique_id": "test.sei_bbh.not_null_stg_eod_positions_account_number.abc", "status": "fail", "failures": 3, "message": "Got 3 results, configured to fail if != 0", "execution_time": 0.8, "timing": [{"started_at": "2026-11-27T22:58:00Z"}]},
    {"unique_id": "test.sei_bbh.unique_int_account_account_number.def", "status": "pass", "failures": 0, "message": None, "execution_time": 0.4, "timing": [{"started_at": "2026-11-27T22:58:10Z"}]},
    {"unique_id": "model.sei_bbh.int_position", "status": "success", "message": "MERGE 12477", "execution_time": 12.2, "timing": [{"started_at": "2026-11-27T22:57:00Z"}]}]}
sources = {"results": [{"unique_id": "source.sei_bbh.raw.raw_eod_positions", "status": "error", "max_loaded_at": "2026-11-26T06:00:00Z", "age": 136800.0, "criteria": {"warn_after": {"count": 26, "period": "hour"}, "error_after": {"count": 36, "period": "hour"}}}]}
d = I.dbt_rows({"dag_id": "swp_positions_processing", "run_results": rr, "manifest": manifest, "sources": sources})
ok(d["run"]["run_key"] == "swp_positions_processing:inv-1" and d["run"]["state"] == "failed" and d["run"]["business_date"] == "2026-11-27", "the dbt run: keyed on the invocation, failed because a test failed, business date from the vars")
t = {x["node_id"]: x for x in d["tests"]}
nn = t["test.sei_bbh.not_null_stg_eod_positions_account_number.abc"]
ok(nn["rule_kind"] == "dbt_test" and nn["test_name"] == "not_null" and nn["column_name"] == "account_number" and nn["model_name"] == "stg_eod_positions" and nn["failures"] == 3 and nn["status"] == "fail" and nn["expected"].startswith("not_null(account_number"), "a failing test: name, column and model from the manifest, the failure count", nn)
ok(t["test.sei_bbh.unique_int_account_account_number.def"]["model_name"] == "int_account" and t["model.sei_bbh.int_position"]["rule_kind"] == "dbt_model" and t["model.sei_bbh.int_position"]["status"] == "success", "the model from depends_on when there is no attached node; a model result is kept too")
fr = t["source.sei_bbh.raw.raw_eod_positions"]
ok(fr["rule_kind"] == "dbt_freshness" and fr["status"] == "error" and "error after 36 hour" in fr["threshold"] and "38.0 h" in fr["observed"], "source freshness: the threshold and the age in hours", fr)

print("-- a check with its bad rows")
c = I.check_rows({"engine": "great_expectations", "dag_id": "swp_cash_processing", "run_id": "cash-1", "business_date": "2026-11-27", "dataset": "gld_cash_summary", "column": "cash_balance_usd",
                  "rule": "expect_column_values_to_not_be_null", "status": "failed", "expected": "NOT NULL", "observed": "3 nulls", "threshold": "0", "failures": 3, "total": 15204,
                  "message": "nulls after the FX join", "bad_rows": [{"FILE_ROW_NUMBER": 2114, "ACCOUNT_NUMBER": "ACC-88213", "CURRENCY": "XPF"}] * 60})
ok(c["run"]["state"] == "failed" and c["tests"][0]["rule_kind"] == "great_expectations" and c["tests"][0]["failures"] == 3 and c["tests"][0]["total_rows"] == 15204, "the check becomes a failed run and a finding")
ok(len(json.loads(c["tests"][0]["bad_rows_json"])) == 50, "bad rows are capped at fifty")

print("-- the summary per dag")
runs = [d["run"], r2["run"], {**r["run"], "received_at": datetime(2026, 11, 27, 23, 30)}]
tasks = [r["task"]]
summ = I.summarise(runs, tasks, d["tests"])
sp = summ["swp_positions_processing"]
ok(sp["run"]["run_key"] == r["run"]["run_key"] and sp["status"] == "red" and len(sp["failed_tasks"]) == 1 and any(x["test_name"] == "not_null" for x in sp["failing"]), "the latest run per dag, its failed task, and the failing test on the same business date make it red", sp)
ok(I.summarise([{"run_key": "a:1", "dag_id": "a", "state": "success", "received_at": datetime.now()}], [], [])["a"]["status"] == "green", "a clean run is green")

print("-- history per dag and date")
h = I.history(runs, tasks, d["tests"], [{"dag_id": "swp_positions_processing", "finding_key": "k", "business_date": "2026-11-27"}])
hp = h["swp_positions_processing"]
ok(len(hp) == 1 and hp[0]["business_date"] == "2026-11-27" and hp[0]["status"] == "red" and hp[0]["failed_task"] == "load_file" and hp[0]["error_code"] == "TRAILER_COUNT_MISMATCH" and hp[0]["note"] is True, "one row per business date: the latest run, its failed task with the loader's code, and whether a note exists", hp)
h2 = I.history([{"run_key": "swp_cash_processing:a", "dag_id": "swp_cash_processing", "business_date": "2026-11-26", "state": "success", "received_at": datetime(2026, 11, 26, 22), "started_at": datetime(2026, 11, 26, 22), "ended_at": datetime(2026, 11, 26, 22, 11)},
                 {"run_key": "swp_cash_processing:b", "dag_id": "swp_cash_processing", "business_date": "2026-11-27", "state": "failed", "received_at": datetime(2026, 11, 27, 22)}], [], [{"run_key": "swp_cash_processing:b", "status": "fail", "failures": 3, "test_name": "not_null"}])
ok([x["business_date"] for x in h2["swp_cash_processing"]] == ["2026-11-27", "2026-11-26"] and h2["swp_cash_processing"][1]["duration_s"] == 660 and h2["swp_cash_processing"][0]["bad_rows"] == 3 and h2["swp_cash_processing"][0]["check_names"] == ["not_null"], "newest first, duration from the dates, bad rows from the failing checks")

print("-- bad rows by file row number")
rows_sql, count_sql = I.bad_rows_sql("stg_eod_positions", "raw_eod_positions", ["ACCOUNT_NUMBER", "INSTRUMENT_ID", "QUANTITY"])
ok("FROM STG_EOD_POSITIONS s JOIN RAW_EOD_POSITIONS r ON r.FILE_REGISTRY_ID = s.FILE_REGISTRY_ID AND r.FILE_ROW_NUMBER = s.FILE_ROW_NUMBER" in rows_sql and "s.DQ_STATUS_CD = 'FAIL'" in rows_sql and "r.ACCOUNT_NUMBER, r.INSTRUMENT_ID, r.QUANTITY" in rows_sql and ":bd" in count_sql, "the FAIL rows joined to RAW on the loader's stamps, for a date")
try:
    I.bad_rows_sql("stg; drop table x", "raw", []); ok(False, "an identifier that is not one is refused")
except ValueError:
    ok(True, "an identifier that is not one is refused")

print("-- the poller")
log = "[2026-11-27 22:06:29] INFO - batch 6 of 9\n[2026-11-27 22:06:30] ERROR - oracledb.DatabaseError: ORA-01555\nTraceback (most recent call last):\n  ...\nValueError: RAW_LOAD_FAILED after rollback\n"
ok(POLL.error_line(log) == "ValueError: RAW_LOAD_FAILED after rollback", "the loader's code wins over the last error line", POLL.error_line(log))
ok(POLL.error_line("INFO ok\nERROR - connection refused\nINFO retry") == "ERROR - connection refused", "else the last error-looking line")
run = {"dag_run_id": "manual__1", "state": "failed", "start_date": "2026-11-27T22:00:00+00:00", "end_date": "2026-11-27T22:10:00+00:00", "logical_date": "2026-11-27T22:00:00+00:00", "conf": {"business_date": "20261127"}}
tis = [{"task_id": "read_config", "state": "success", "try_number": 1, "start_date": "2026-11-27T22:00:01+00:00", "end_date": "2026-11-27T22:00:02+00:00", "duration": 1.0, "map_index": -1},
       {"task_id": "load_file", "state": "failed", "try_number": 1, "start_date": "2026-11-27T22:00:05+00:00", "end_date": "2026-11-27T22:01:05+00:00", "duration": 60.0, "map_index": 2},
       {"task_id": "dbt_stg", "state": "upstream_failed", "try_number": 0, "map_index": -1}]
evs = POLL.airflow_events("swp_positions_processing", run, tis, lambda *a: log)
ok(evs[0]["kind"] == "run" and evs[0]["business_date"] == "20261127" and len(evs) == 4 and evs[2]["error"].startswith("ValueError: RAW_LOAD_FAILED") and evs[3]["error"] is None, "a pulled run becomes the same events the callbacks post, with the error line only for the failed task")
rows = [I.airflow_rows(e) for e in evs]
ok(rows[2]["task"]["error_code"] == "RAW_LOAD_FAILED" and rows[0]["run"]["state"] == "failed", "and they ingest the same way")
tmp = tempfile.mkdtemp()
tgt = os.path.join(tmp, "swp_cash_processing", "target"); os.makedirs(tgt)
with open(os.path.join(tgt, "run_results.json"), "w", encoding="utf-8") as fh:
    json.dump(rr, fh)
with open(os.path.join(tgt, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh)
arts = POLL.dbt_artifacts(tmp, 0)
ok(len(arts) == 1 and arts[0]["dag_id"] == "swp_cash_processing" and arts[0]["business_date"] == "20261127" and arts[0]["manifest"] and arts[0]["sources"] is None, "dbt artifacts found under the shared volume, dag id from the folder, business date from the vars")
ok(POLL.dbt_artifacts(tmp, time.time() + 10) == [], "and only those newer than the watermark")
sent = []
POLL.post("http://api", "/integration360/ingest/dbt", {"a": 1}, secret="s3", send=lambda path, body, headers: sent.append((path, headers)) or True)
ok(sent and sent[0][1]["X-I360-Signature"].startswith("sha256=") and sent[0][0] == "/integration360/ingest/dbt", "the poller signs what it posts like the callbacks do")

print("-- the router on a fake db")
import app.routers_integration360 as R  # noqa: E402
writes, reads = [], []
R.execute = lambda stmts: writes.append(stmts)
R.query = lambda sql, params=None: reads.append((sql, params)) or []
import asyncio  # noqa: E402


class Req:
    def __init__(self, body, headers=None):
        self._b = json.dumps(body).encode(); self.headers = headers or {}
    async def body(self):
        return self._b


out = asyncio.run(R.ingest_airflow(Req(ev)))
ok(out["accepted"] == 1 and out["auth"] == "unsigned" and len(writes[-1]) == 2 and "MERGE INTO i360_run" in writes[-1][0][0] and "MERGE INTO i360_task" in writes[-1][1][0], "an Airflow event merges a run and a task")
out = asyncio.run(R.ingest_dbt(Req({"dag_id": "swp_positions_processing", "run_results": rr, "manifest": manifest, "sources": sources})))
ok(out["accepted"] == 4 and out["state"] == "failed" and len(writes[-1]) == 5, "a dbt run merges the run and four findings")
out = asyncio.run(R.ingest_check(Req({"checks": [{"engine": "soda", "dag_id": "swp_fee_accrual", "run_id": "f1", "dataset": "gld_fee_accrual", "rule": "anomaly", "status": "fail"}]})))
ok(out["accepted"] == 1 and out["keys"][0].startswith("swp_fee_accrual:f1:"), "a check merges a run and a finding")
os.environ["I360_WEBHOOK_SECRET"] = "s3"
try:
    asyncio.run(R.ingest_airflow(Req(ev, {"x-i360-signature": "sha256=00"}))); ok(False, "a bad signature is refused with 401")
except Exception as e:  # noqa: BLE001
    ok(getattr(e, "status_code", None) == 401, "a bad signature is refused with 401", e)
os.environ.pop("I360_WEBHOOK_SECRET")
R.badrows("stg_x", "raw_x", "2026-11-27", "A,B", limit=50)
ok(any("FROM STG_X s JOIN RAW_X r" in q for q, _ in reads), "bad rows: the allowlisted query runs for the date")
try:
    R.badrows("stg_x", "raw_x", "27/11/2026", "", limit=50); ok(False, "a bad date is refused")
except Exception as e:  # noqa: BLE001
    ok(getattr(e, "status_code", None) == 400, "a bad date is refused with 400", e)
try:
    R.badrows("stg_x; drop", "raw_x", "2026-11-27", "", limit=50); ok(False, "a bad identifier is refused")
except Exception as e:  # noqa: BLE001
    ok(getattr(e, "status_code", None) == 400, "a bad identifier is refused with 400", e)
hist = R.history(days=31)
ok("dags" in hist and any("FROM i360_note" in q for q, _ in reads), "history reads runs, tasks, tests and notes")
sr = R.search(q="trailer", limit=50)
ok(set(sr.keys()) >= {"runs", "tasks", "findings"} and any("%TRAILER%" == (pp or {}).get("q") for _, pp in reads), "search is an upper-cased LIKE over identifier columns")
h = R.health()
ok(h["ok"] is True and h["signature"] is False and h["token"] is False, "health says what is configured")

print()
if BAD:
    print(f"{BAD} assertion(s) failed"); sys.exit(1)
print("integration360 assertions pass")
