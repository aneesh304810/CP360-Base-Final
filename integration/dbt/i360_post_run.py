"""Post a dbt run to Integration 360: run_results.json with manifest.json (and
sources.json after `dbt source freshness`) from the project's target folder.

    python integration/dbt/i360_post_run.py --target dbt_project/target --dag swp_positions_processing --business-date 20261127

Run it as the step after `dbt build` (an Airflow task, or the last line of the
dbt task's command). Configuration from the environment:
    I360_API_URL, and I360_WEBHOOK_SECRET or I360_INGEST_TOKEN (as the Airflow callbacks)
Only the artifacts' metadata travels: node ids, statuses, failure counts and
messages. No compiled SQL, no credentials, no data value beyond what dbt put
in a test's message.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import urllib.request


def _slim_manifest(m: dict) -> dict:
    """Only what the API reads: resource type, name, column, attached model, test metadata, severity."""
    out = {"nodes": {}, "sources": {}}
    for k, n in (m.get("nodes") or {}).items():
        out["nodes"][k] = {"resource_type": n.get("resource_type"), "name": n.get("name"), "column_name": n.get("column_name"),
                           "attached_node": n.get("attached_node"), "depends_on": {"nodes": (n.get("depends_on") or {}).get("nodes") or []},
                           "test_metadata": n.get("test_metadata"), "config": {"severity": (n.get("config") or {}).get("severity")}}
    for k, n in (m.get("sources") or {}).items():
        out["sources"][k] = {"resource_type": "source", "name": n.get("name"), "loaded_at_field": n.get("loaded_at_field")}
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default="target")
    ap.add_argument("--dag", default="dbt")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--business-date", default=None)
    ap.add_argument("--api", default=os.environ.get("I360_API_URL", ""))
    a = ap.parse_args(argv)
    def load(name):
        p = os.path.join(a.target, name)
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    rr = load("run_results.json")
    if rr is None:
        print("no run_results.json in", a.target, file=sys.stderr)
        return 2
    manifest = load("manifest.json")
    payload = {"dag_id": a.dag, "run_id": a.run_id, "business_date": a.business_date, "run_results": rr,
               "manifest": _slim_manifest(manifest) if manifest else None, "sources": load("sources.json")}
    if not a.api:
        print("I360_API_URL not set; would post", len(rr.get("results") or []), "results", file=sys.stderr)
        return 0
    body = json.dumps(payload, default=str).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "cp360-i360-dbt/1.0"}
    secret, token = os.environ.get("I360_WEBHOOK_SECRET", ""), os.environ.get("I360_INGEST_TOKEN", "")
    if secret:
        headers["X-I360-Signature"] = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    elif token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(a.api.rstrip("/") + "/integration360/ingest/dbt", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310
        print(r.status, r.read()[:200].decode("utf-8", "replace"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
