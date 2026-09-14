"""
api_catalog_ingest.py — thin front door over Api360Connector.

REPLACES api_contract_ingest.py. There is exactly one ingestion pipeline:
the connector over the artifacts tree. This module only:

  scan               re-ingest the whole tree (idempotent; the scheduled job)
  scan --file PATH   ingest one spec file already inside the tree
  place              write an uploaded spec INTO the tree, then scan --file it
                     (what the UI upload endpoint calls)

CLI:
  python -m ingestion.api_catalog_ingest scan
  python -m ingestion.api_catalog_ingest scan --file API-SPEC/Dom/x.yaml
  python -m ingestion.api_catalog_ingest place --system sei \
         --domain PortfolioandModelManagement --name swagger-spec-Foo.yaml \
         --content-file /tmp/upload.yaml
"""
from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

from .api360_conn import Api360Connector


def _tree_root() -> Path:
    root = os.environ.get("CP_CATALOG_ROOT", ".")
    return Path(os.environ.get("API_SPEC_ROOT", os.path.join(root, "API-SPEC")))


def target_path(system: str, domain: str, filename: str) -> Path:
    """Where an uploaded spec lands. sei -> API-SPEC/<domain>/ ; any other
    system -> NON-SEI/<system>/<domain>/ (ProjectResolver derives project_id
    from the path, so folder placement IS system assignment)."""
    domain = re.sub(r"[^A-Za-z0-9_\-]", "", domain) or "General"
    filename = Path(filename).name
    if not filename.startswith("swagger-spec-"):
        filename = "swagger-spec-" + filename
    if (system or "sei").lower() == "sei":
        return _tree_root() / domain / filename
    root = os.environ.get("CP_CATALOG_ROOT", ".")
    non_sei = Path(os.environ.get("NON_SEI_SPEC_ROOT",
                                  os.path.join(root, "NON-SEI")))
    sysdir = re.sub(r"[^A-Za-z0-9_\-]", "", system.lower())
    return non_sei / sysdir / domain / filename


def place(system: str, domain: str, filename: str, content: str) -> Path:
    p = target_path(system, domain, filename)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def _loader():
    """Same plumbing as ingestion/run.py: CP_CATALOG_DB_DSN
    (oracle://user:pass@host:port/service) -> Loader(conn)."""
    from .run import _connect
    from .loader import Loader
    return Loader(_connect())


def scan(single_file: str | None = None) -> dict:
    """Run the connector. single_file narrows the walk to one spec (fast path
    for UI uploads) by pointing the spec root at the file's parent and
    filtering the parse to that file."""
    conn = Api360Connector.from_env()
    if single_file:
        f = Path(single_file)
        # narrow: parse only this file through the connector's own methods
        bundle = {"sources": [], "endpoints": [], "fields": [], "errors": [],
                  "flows": [], "flow_steps": [], "dependencies": [],
                  "business_flows": [], "business_steps": []}
        conn._raw_specs = {}
        conn._parse_spec(f, bundle["sources"], bundle["endpoints"],
                         bundle["fields"], bundle["errors"])
        bundle["raw_specs"] = conn._raw_specs
        loader = _loader()
        conn.load(loader, bundle)
        return {"mode": "file", "file": str(f),
                "sources": len(bundle["sources"]),
                "endpoints": len(bundle["endpoints"])}
    bundle = conn.parse()
    loader = _loader()
    conn.load(loader, bundle)
    return {"mode": "tree", "sources": len(bundle["sources"]),
            "endpoints": len(bundle["endpoints"]),
            "flows": len(bundle.get("business_flows") or [])}




def fetch_into_tree(kind: str, location: str, system: str, domain: str,
                    filename: str | None) -> Path:
    """Manifest fetcher: URL download or FILE copy INTO the artifacts tree."""
    name = filename or Path(location.split("?")[0]).name or "spec.json"
    if kind.upper() == "URL":
        import requests
        resp = requests.get(location, timeout=60)
        resp.raise_for_status()
        content = resp.text
    else:
        content = Path(location).read_text(encoding="utf-8",
                                           errors="replace")
    return place(system, domain or "General", name, content)


def run_manifest(conn=None) -> list[dict]:
    """Run every enabled api_ingest_manifest row: fetch into the tree,
    single-file connector ingest, stamp last_run/result. Tree = truth."""
    own = conn is None
    if own:
        from .run import _connect
        conn = _connect()
    cur = conn.cursor()
    cur.execute("""SELECT src_id, system, kind, location, domain, filename
                   FROM api_ingest_manifest WHERE enabled = 'Y'
                   ORDER BY system, src_id""")
    results = []
    for src_id, system, kind, location, domain, filename in cur.fetchall():
        try:
            dest = fetch_into_tree(kind, location, system, domain, filename)
            r = scan(str(dest))
            res = f"OK · {r.get('endpoints', 0)} endpoints"
        except Exception as e:                              # noqa: BLE001
            res = f"FAILED · {str(e)[:300]}"
        cur.execute("""UPDATE api_ingest_manifest
                       SET last_run_at = SYSTIMESTAMP, last_result = :r
                       WHERE src_id = :s""", {"r": res[:400], "s": src_id})
        conn.commit()
        results.append({"src_id": src_id, "system": system,
                        "result": res})
    return results


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sc = sub.add_parser("scan")
    sc.add_argument("--file")
    sub.add_parser("manifest")
    pl = sub.add_parser("place")
    pl.add_argument("--system", required=True)
    pl.add_argument("--domain", required=True)
    pl.add_argument("--name", required=True)
    pl.add_argument("--content-file", required=True)
    a = p.parse_args()
    if a.cmd == "scan":
        print(scan(a.file))
    elif a.cmd == "manifest":
        print(run_manifest())
    else:
        dest = place(a.system, a.domain, a.name,
                     Path(a.content_file).read_text(encoding="utf-8"))
        print({"placed": str(dest), **scan(str(dest))})
