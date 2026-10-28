"""hist_progress: the bar, the per-insert latency, the estimate and the
timing summary, on a fake cursor that sleeps a little per round trip.
Run: python3.13 api/test/test_hist_progress.py"""
import io
import json
import logging
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ingestion.hist_progress import LoadProgress, fmt_bytes, fmt_dur, payload_bytes, ping, plan_steps   # noqa: E402
from ingestion.hist_migration_conn import LOAD_ORDER, TABLE, HistMigrationConnector                    # noqa: E402

FAILS = []


def ok(cond, msg, extra=None):
    print(("ok  " if cond else "FAIL") + " " + msg + ("" if cond or extra is None else f"  -> {extra}"))
    if not cond:
        FAILS.append(msg)


print("-- formatting and the plan")
ok(fmt_dur(7.26) == "7.3 s" and fmt_dur(61) == "1:01" and fmt_dur(3725) == "1:02:05" and fmt_dur(None) == "?", "durations read as seconds, m:ss, h:mm:ss")
ok(fmt_bytes(2048) == "2 KB" and fmt_bytes(3 * 1024 * 1024) == "3.0 MB", "bytes read as KB and MB")
rows = [{"a": "x" * 10, "b": 5, "c": None}] * 7000
ok(payload_bytes(rows) == 7000 * 26, "the payload is the length of the strings plus 8 per other value, sampled past 5,000 rows", payload_bytes(rows))
bundle = {"lanes": [{"lane_id": "A", "x": "abc"}] * 3, "evidence": [{"evidence_id": str(i), "evidence_value": "v" * 100} for i in range(4500)], "lineage": [], "manifest": [{"k": "a"}]}
bundle.update({k: [] for k in LOAD_ORDER if k not in bundle})
steps = plan_steps(bundle, LOAD_ORDER, TABLE)
kinds = [(s["kind"], s["table"]) for s in steps]
ok(kinds[:3] == [("delete", "cp_hist_mapping_evidence"), ("delete", "cp_hist_manifest"), ("delete", "cp_hist_migration_lane")], "deletes come first, in reverse load order, only for sheets with rows", kinds[:3])
ins = [s for s in steps if s["kind"] == "insert"]
ok([(s["table"], s["rows"], s["batch"], s["batches"]) for s in ins] == [("cp_hist_migration_lane", 3, 1, 1), ("cp_hist_manifest", 1, 1, 1), ("cp_hist_mapping_evidence", 2000, 1, 3), ("cp_hist_mapping_evidence", 2000, 2, 3), ("cp_hist_mapping_evidence", 500, 3, 3), ("cp_hist_ingest_batch", 1, 1, 1)],
   "4,500 evidence rows are three batches of 2,000, 2,000 and 500, then the batch row", [(s["table"], s["rows"]) for s in ins])
ok(plan_steps(bundle, LOAD_ORDER, TABLE, deletes=False)[0]["kind"] == "insert", "a loader without a cursor plans no deletes")

print("-- the bar on a stream that is not a terminal")
out = io.StringIO()
os.environ.pop("CP_HIST_PROGRESS", None)
p = LoadProgress(steps, rtt=0.25, parse_s=7.0, stream=out)
f = p.start()
ok(f["deletes"] == 3 and f["batches"] == 6 and f["rows"] == 4505 and f["rtt"] == 0.25 and f["seconds"] > 3 * 0.25 * 1.5 + 6 * 0.25, "the first estimate counts deletes and batches and charges a round trip to each", f)
line0 = p.tick(0, 0.40)
ok(line0.startswith("[###") and " 11%" in line0 and "delete cp_hist_mapping_evidence" in line0 and "left ~" in line0 and "total ~" in line0, "a delete tick draws the bar with elapsed, left and total", line0)
p.tick(1, 0.38); p.tick(2, 0.36)
line3 = p.tick(3, 0.30, rtt=0.27)
ok("insert cp_hist_migration_lane 1/1" in line3 and "3 rows" in line3 and "latency 270 ms" in line3 and "rows/s" in line3, "an insert tick shows the batch, its own measured latency and the rate", line3)
line4 = p.tick(4, 0.29)
ok("latency 270 ms (last probe)" in line4, "a batch without its own probe shows the last reading, and says so", line4)
e1 = p.estimate()
p.tick(5, 1.20, rtt=0.26)
e2 = p.estimate()
rate = p._rate()
ok(e2[1] > e1[1] and abs(rate - steps[5]["bytes"] / (1.20 - 0.26)) < 1e-6 and e2[2] >= 7.0,
   "the estimate learns from the observed batch: 1.2 s for 248 KB is slower than the assumed 30 Mbps, so what is left goes up; the total includes the parse", (e1, e2, rate))
p.tick(6, 1.15, rtt=0.28); p.tick(7, 0.55, rtt=0.25)
last = p.tick(8, 0.30, rtt=0.30)
ok(last.startswith("[" + "#" * 26 + "]") and "100%" in last, "the last tick fills the bar", last)
p.note(0.9)
s = p.finish()
ok(s["batches"] == 6 and s["deletes"] == 3 and s["rows"] == 4505 and s["pings"] == 6 and abs(s["rtt_median"] - 0.265) < 1e-9 and s["rtt_min"] == 0.25 and s["rtt_max"] == 0.30 and s["other_s"] == 0.9 and s["per_100k_s"] > 0,
   "the summary carries the counts, the latency median and spread, the other time and a per-100k projection", {k: s[k] for k in ("batches", "deletes", "rows", "pings", "rtt_median", "per_100k_s")})
lines = out.getvalue().splitlines()
ok(len(lines) == 9 and all(l.startswith("[") for l in lines), "off a terminal every tick is its own line, nine for nine steps", len(lines))
quiet = io.StringIO()
os.environ["CP_HIST_PROGRESS"] = "0"
q = LoadProgress(steps, rtt=0.2, stream=quiet); q.tick(0, 0.1); q.finish()
ok(quiet.getvalue() == "", "CP_HIST_PROGRESS=0 silences the bar")
os.environ.pop("CP_HIST_PROGRESS", None)
os.environ["CP_HIST_PING_EVERY"] = "4"
ok(LoadProgress(steps, rtt=0.2, stream=io.StringIO()).ping_every() == 4, "CP_HIST_PING_EVERY sets the probe cadence")
os.environ.pop("CP_HIST_PING_EVERY", None)
big = plan_steps({**bundle, "evidence": [{"e": "x"}] * 60000}, LOAD_ORDER, TABLE)
ok(LoadProgress(steps, stream=io.StringIO()).ping_every() == 1 and LoadProgress(big, stream=io.StringIO()).ping_every() == 10, "probe every batch up to 20 batches, else every tenth")

print("-- the loader on a fake Oracle cursor with a slow link")


class FakeCursor:
    """Every execute, executemany and fetch costs one simulated round trip."""
    def __init__(self, db, rtt):
        self.db, self.rtt, self._last = db, rtt, None
        db["trips"] = 0
    def _trip(self):
        self.db["trips"] += 1
        time.sleep(self.rtt)
    def execute(self, sql, binds=None):
        self._trip()
        self.db["sql"].append(sql.split(" ")[0])
        u = sql.upper()
        if "FROM DUAL" in u:
            self._last = (1,)
        elif "SOURCE_HASH FROM CP_HIST_INGEST_BATCH" in u:
            self._last = None
        elif "FROM SEI_INPUT_LINEAGE" in u:
            self._last = []
        elif u.startswith("DELETE"):
            self.db["deleted"].append(sql.split("FROM ")[1])
        elif u.startswith("INSERT"):
            self.db["inserted"].setdefault(sql.split("INTO ")[1].split(" ")[0], 0)
            self.db["inserted"][sql.split("INTO ")[1].split(" ")[0]] += 1
    def executemany(self, sql, rows):
        self._trip()
        t = sql.split("INTO ")[1].split(" ")[0]
        self.db["inserted"][t] = self.db["inserted"].get(t, 0) + len(rows)
    def fetchone(self):
        return self._last
    def fetchall(self):
        return self._last or []
    def setinputsizes(self, **kw):
        pass
    def close(self):
        pass


class FakeConn:
    def __init__(self, db, rtt):
        self.db, self.rtt = db, rtt
    def cursor(self):
        return FakeCursor(self.db, self.rtt)


class FakeLoader:
    def __init__(self, rtt):
        self.db = {"sql": [], "deleted": [], "inserted": {}}
        self.conn = FakeConn(self.db, rtt)
        self.committed = 0
    def _merge(self, *a):
        raise AssertionError("a loader with a cursor never merges row by row")
    def commit(self):
        self.committed += 1


ok(ping(FakeCursor({"sql": [], "deleted": [], "inserted": {}}, 0.002)) >= 0.002, "ping is the fastest of three SELECT 1 FROM dual round trips")
import tempfile
from openpyxl import Workbook
d = tempfile.mkdtemp()
path = os.path.join(d, "hist.xlsx")
wb = Workbook()
ws = wb.active; ws.title = "HIST_MIGRATION_LANES"
ws.append(["Historical Lane ID", "Historical Source System", "Target System", "Migration Purpose", "Primary Mapping Evidence", "Reference Artifacts", "Data Domain", "Relationship to Operational Lineage", "Status"])
for lane, sys_ in (("ADDVANTAGE_SEI_HIST", "AddVantage / PB"), ("STAR_SEI_HIST", "STAR / IM"), ("UAF_SEI_HIST", "UAF")):
    ws.append([lane, sys_, "SEI", "Historical deconversion source-to-target mapping", "Catalog.xlsx", "", "Static", "Upstream", "Added"])
ws = wb.create_sheet("HIST_MAPPING_EVIDENCE")
ws.append(["Historical Migration Domain", "Historical Source System", "Historical Migration Lane", "Mapping Evidence Type", "Migration Group", "Source Mapping Workbook", "Source Mapping Sheet", "Source Mapping Row", "Evidence Category", "Evidence Attribute", "Evidence Value", "Original Source Column", "Original Source Column Number", "Reference Artifacts"])
for i in range(2500):
    ws.append(["Static", "STAR / IM", "STAR / IM to SEI", "Analyst source-to-target mapping evidence", "Static Merge", "Catalog.xlsx", "IM_MAP", i + 2, "Target Field", "SEI Target Field", "FIELD_" + str(i), "Column_1", 1, ""])
wb.save(path)
c = HistMigrationConnector(xlsx=path, force=True)
b = c.parse()
ok(b["parse_seconds"] > 0 and all("seconds" in sh for sh in b["sheets"]), "the parse times itself and every sheet", (b["parse_seconds"], b["sheets"]))
buf = io.StringIO()
h = logging.StreamHandler(buf); h.setLevel(logging.INFO)
for name in ("cp.ingest.hist_progress", "cp.hist_migration"):
    logging.getLogger(name).addHandler(h)
    logging.getLogger(name).setLevel(logging.INFO)
L = FakeLoader(0.003)
t = time.perf_counter()
n = c.load(L, b)
took = time.perf_counter() - t
ok(n == 2503 and L.committed == 1 and L.db["inserted"]["cp_hist_mapping_evidence"] == 2500 and L.db["inserted"]["cp_hist_ingest_batch"] == 1, "the load still writes every row through the cursor and commits once", (n, L.db["inserted"]))
ok(L.db["deleted"][0].strip() == "cp_hist_mapping_evidence" and len(L.db["deleted"]) == 2, "only the tables with rows are deleted, evidence first", L.db["deleted"])
logs = buf.getvalue()
ok("plan: 2 deletes, 4 insert batches, 2,504 rows" in logs and "round trip" in logs and "first estimate" in logs, "the plan is logged before the first write", logs[:300])
ok("timing: parse" in logs and "4 insert batches" in logs and "network: latency" in logs and "100,000 rows of this shape would take" in logs, "the timing and network summary close the load", logs[-600:])
ok(b["timing"]["pings"] >= 4 and b["timing"]["rtt_median"] >= 0.003 and b["timing"]["rows"] == 2504, "every batch was probed on a short load and the summary rides the bundle", {k: b["timing"][k] for k in ("pings", "rtt_median", "rows")})
# round trips: opening ping 3, deletes 2, a probe before each of the 3 batches + the 3 inserts, batch row 1 = 12 (force skips the hash read; no lineage, no match)
ok(L.db["trips"] == 12 and took >= 12 * 0.003, "twelve round trips, each paid for once", (L.db["trips"], round(took, 3)))

print("-- estimate only")
os.environ["CP_HIST_ESTIMATE"] = "1"
L2 = FakeLoader(0.001)
buf.truncate(0); buf.seek(0)
n2 = c.load(L2, b)
os.environ.pop("CP_HIST_ESTIMATE", None)
ok(n2 == 0 and not L2.db["deleted"] and not L2.db["inserted"] and L2.committed == 0 and "CP_HIST_ESTIMATE is set; nothing deleted or inserted" in buf.getvalue(), "CP_HIST_ESTIMATE=1 pings, plans, prints the estimate and writes nothing", (n2, L2.db["deleted"], L2.db["inserted"]))
ok(not any("@" in l or "FIELD_" in l for l in logs.splitlines()), "no row value and no address in the log, table names and counts only")

print()
if FAILS:
    print(f"{len(FAILS)} FAILED"); sys.exit(1)
print("hist progress assertions pass")
