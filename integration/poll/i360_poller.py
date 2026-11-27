"""Integration 360 poller: pull mode. Instead of callbacks in every DAG, CP 360
asks Airflow and reads dbt's artifacts on a schedule, and posts what it finds
through the same ingest endpoints. Run it as a CronJob in the CP 360 namespace
(deploy/openshift/i360-poller-cronjob.yaml) or by hand:

    python integration/poll/i360_poller.py --since-minutes 30

Airflow, over its REST API on the in-cluster webserver service:
    AIRFLOW_API_URL      http://<airflow-webserver-service>.<airflow-namespace>.svc:8080/api/v1
    AIRFLOW_API_USER / AIRFLOW_API_PASSWORD, or AIRFLOW_API_TOKEN (Bearer)
    I360_DAGS            comma-separated dag ids to watch (default: every dag the API lists)
  Pulls the DAG runs updated since the watermark, their task instances, and for
  a failed task the tail of its log, from which only the error line is kept.

dbt, from the artifacts a run leaves behind (a volume the dbt task writes to and
this job mounts read-only, or a copy synced there):
    I360_DBT_ARTIFACTS   a directory; every run_results.json under it newer than
                         the watermark is posted with its manifest.json and
                         sources.json. The dag id is the folder name that holds
                         the target folder (…/<dag_id>/target/run_results.json),
                         or I360_DBT_DAG when there is one project.

Posting, as the push side: I360_API_URL and I360_WEBHOOK_SECRET or I360_INGEST_TOKEN.
The watermark is a small JSON file at I360_POLL_STATE (default ./.i360_poll.json).
Nothing is parsed from logs beyond the last error line; everything else is the
structured record Airflow and dbt already keep.
"""
from __future__ import annotations

import argparse
import base64
import glob
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ERROR_LINE = re.compile(r"(?:ERROR|CRITICAL|Traceback|Exception|Error:)[^\n]*", re.I)
LOADER_CODES = ("FILE_NOT_FOUND", "FILE_EMPTY", "HEADER_REQUIRED", "HEADER_COUNT_MISMATCH", "HEADER_COLUMN_MISMATCH", "TRAILER_MISSING",
                "TRAILER_COUNT_INVALID", "TRAILER_COUNT_MISMATCH", "ZERO_ROWS_NOT_ALLOWED", "RAW_COUNT_MISMATCH", "RAW_LOAD_FAILED",
                "ARCHIVE_FAILED", "QUARANTINE_MOVE_FAILED")


def error_line(log_text: str) -> str:
    """The one line of a task log that says what went wrong: the loader's code if present,
    else the last error-looking line, else the last non-empty line."""
    s = str(log_text or "")
    for c in LOADER_CODES:
        i = s.find(c)
        if i >= 0:
            ln = s[max(0, s.rfind("\n", 0, i) + 1): (s.find("\n", i) if s.find("\n", i) >= 0 else len(s))]
            return ln.strip()[:2000]
    hits = ERROR_LINE.findall(s)
    if hits:
        return hits[-1].strip()[:2000]
    lines = [x.strip() for x in s.splitlines() if x.strip()]
    return (lines[-1] if lines else "")[:2000]


class Airflow:
    def __init__(self, base, user="", password="", token="", fetch=None):
        self.base = base.rstrip("/")
        self.h = {"Accept": "application/json", "User-Agent": "cp360-i360-poller/1.0"}
        if token:
            self.h["Authorization"] = f"Bearer {token}"
        elif user:
            self.h["Authorization"] = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()
        self.fetch = fetch or self._fetch

    def _fetch(self, url, accept=None):
        req = urllib.request.Request(url, headers={**self.h, **({"Accept": accept} if accept else {})})
        with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310
            raw = r.read()
        return json.loads(raw) if (accept or "application/json").startswith("application/json") else raw.decode("utf-8", "replace")

    def dags(self):
        out, off = [], 0
        while True:
            d = self.fetch(f"{self.base}/dags?limit=100&offset={off}&only_active=true")
            out += [x["dag_id"] for x in d.get("dags", [])]
            off += 100
            if off >= int(d.get("total_entries") or 0):
                return out

    def runs_since(self, dag_id, since: datetime):
        q = urllib.parse.urlencode({"updated_at_gte": since.strftime("%Y-%m-%dT%H:%M:%S+00:00"), "order_by": "-updated_at", "limit": 100})
        return self.fetch(f"{self.base}/dags/{urllib.parse.quote(dag_id)}/dagRuns?{q}").get("dag_runs", [])

    def tasks(self, dag_id, run_id):
        return self.fetch(f"{self.base}/dags/{urllib.parse.quote(dag_id)}/dagRuns/{urllib.parse.quote(run_id, safe='')}/taskInstances?limit=500").get("task_instances", [])

    def log_tail(self, dag_id, run_id, task_id, try_number, map_index=-1):
        q = "?full_content=false" + (f"&map_index={map_index}" if map_index is not None and map_index >= 0 else "")
        try:
            txt = self.fetch(f"{self.base}/dags/{urllib.parse.quote(dag_id)}/dagRuns/{urllib.parse.quote(run_id, safe='')}/taskInstances/{urllib.parse.quote(task_id)}/logs/{int(try_number or 1)}{q}", accept="text/plain")
            return str(txt)[-6000:]
        except Exception:  # noqa: BLE001
            return ""


def airflow_events(dag_id: str, run: dict, tasks: list[dict], log_for=None) -> list[dict]:
    """Ingest events for one DAG run and its task instances, as the callbacks would have posted them."""
    conf = run.get("conf") or {}
    bd = conf.get("business_date") or run.get("logical_date") or run.get("execution_date")
    ev = [{"kind": "run", "dag_id": dag_id, "run_id": run.get("dag_run_id") or run.get("run_id"), "state": run.get("state"),
           "start_date": run.get("start_date"), "end_date": run.get("end_date"), "logical_date": run.get("logical_date"), "business_date": bd}]
    for t in tasks:
        state = str(t.get("state") or "")
        err = None
        if state in ("failed", "up_for_retry", "upstream_failed") and log_for and state != "upstream_failed":
            err = error_line(log_for(dag_id, ev[0]["run_id"], t.get("task_id"), t.get("try_number"), t.get("map_index", -1))) or None
        ev.append({"kind": "task", "dag_id": dag_id, "run_id": ev[0]["run_id"], "task_id": t.get("task_id"), "map_index": t.get("map_index", -1),
                   "state": state, "try_number": t.get("try_number"), "start_date": t.get("start_date"), "end_date": t.get("end_date"),
                   "duration": t.get("duration"), "log_url": None, "run_state": run.get("state"), "logical_date": run.get("logical_date"), "business_date": bd,
                   "error": err})
    return ev


def dbt_artifacts(root: str, since_ts: float, one_dag: str = "") -> list[dict]:
    """Every run_results.json under root newer than since_ts, with its manifest and sources, as ingest payloads."""
    out = []
    for p in sorted(glob.glob(os.path.join(root, "**", "run_results.json"), recursive=True)):
        try:
            if os.path.getmtime(p) <= since_ts:
                continue
            d = os.path.dirname(p)
            def load(n):
                q = os.path.join(d, n)
                if not os.path.exists(q):
                    return None
                with open(q, encoding="utf-8") as fh:
                    return json.load(fh)
            rr = load("run_results.json")
            dag = one_dag or os.path.basename(os.path.dirname(d)) if os.path.basename(d) == "target" else (one_dag or os.path.basename(d))
            bd = ((rr.get("args") or {}).get("vars") or {}).get("business_date")
            out.append({"dag_id": dag, "business_date": bd, "run_results": rr, "manifest": load("manifest.json"), "sources": load("sources.json"), "_path": p})
        except Exception as e:  # noqa: BLE001
            print("skip", p, str(e)[:120], file=sys.stderr)
    return out


def post(api: str, path: str, payload: dict, secret="", token="", send=None) -> bool:
    body = json.dumps(payload, default=str).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "cp360-i360-poller/1.0"}
    if secret:
        headers["X-I360-Signature"] = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    elif token:
        headers["Authorization"] = f"Bearer {token}"
    if send:
        return send(path, body, headers)
    req = urllib.request.Request(api.rstrip("/") + path, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310
        return 200 <= r.status < 300


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since-minutes", type=int, default=None, help="look back this far instead of the watermark")
    ap.add_argument("--state", default=os.environ.get("I360_POLL_STATE", ".i360_poll.json"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    api, secret, token = os.environ.get("I360_API_URL", ""), os.environ.get("I360_WEBHOOK_SECRET", ""), os.environ.get("I360_INGEST_TOKEN", "")
    state = {}
    if os.path.exists(a.state):
        with open(a.state, encoding="utf-8") as fh:
            state = json.load(fh)
    now = datetime.now(timezone.utc)
    since = now - timedelta(minutes=a.since_minutes) if a.since_minutes else datetime.fromisoformat(state.get("airflow_since", (now - timedelta(hours=24)).isoformat()))
    posted = 0
    af_url = os.environ.get("AIRFLOW_API_URL", "")
    if af_url:
        af = Airflow(af_url, os.environ.get("AIRFLOW_API_USER", ""), os.environ.get("AIRFLOW_API_PASSWORD", ""), os.environ.get("AIRFLOW_API_TOKEN", ""))
        dags = [d for d in os.environ.get("I360_DAGS", "").split(",") if d.strip()] or af.dags()
        for dag in dags:
            for run in af.runs_since(dag, since):
                rid = run.get("dag_run_id") or run.get("run_id")
                events = airflow_events(dag, run, af.tasks(dag, rid), af.log_tail)
                if a.dry_run or not api:
                    print(dag, rid, run.get("state"), len(events) - 1, "tasks")
                else:
                    posted += int(post(api, "/integration360/ingest/airflow", {"events": events}, secret, token))
    root = os.environ.get("I360_DBT_ARTIFACTS", "")
    if root:
        for payload in dbt_artifacts(root, float(state.get("dbt_since_ts", 0)) if not a.since_minutes else (now - timedelta(minutes=a.since_minutes)).timestamp(), os.environ.get("I360_DBT_DAG", "")):
            path = payload.pop("_path")
            if a.dry_run or not api:
                print("dbt", payload["dag_id"], path, len((payload["run_results"].get("results") or [])), "results")
            else:
                posted += int(post(api, "/integration360/ingest/dbt", payload, secret, token))
    if not a.dry_run:
        with open(a.state, "w", encoding="utf-8") as fh:
            json.dump({"airflow_since": now.isoformat(), "dbt_since_ts": time.time()}, fh)
    print("posted", posted)
    return 0


if __name__ == "__main__":
    sys.exit(main())
