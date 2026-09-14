"""
api_contract_ingest.py — the contract ingestion framework.

One pipeline for EVERY provider system (SEI today; AddVantage/CRD/STAR/
Plaid/... the day their specs exist). Sources can be OpenAPI files, OpenAPI
URLs, or Postman collection files; a manifest table (api_ingest_sources)
makes re-ingestion a scheduled, repeatable operation.

Pipeline per ingest:
  1. load + validate the spec (JSON, has paths)
  2. derive api_name/version from info{} unless overridden
  3. store as a new contract version (prior versions -> STALE)
  4. diff vs the previous version (BREAKING / ADDITIVE field changes)
  5. refresh the AUTO collection (replace requests in place)
  6. flip the system PLANNED -> ONBOARDED
  7. print/return an ingest report

CLI:
  python -m ingestion.api_contract_ingest openapi --file swp_accounts.json --system SEI
  python -m ingestion.api_contract_ingest openapi --url https://.../openapi.json --system PLAID
  python -m ingestion.api_contract_ingest postman --file crd.postman.json --system CRD --name "CRD Compliance"
  python -m ingestion.api_contract_ingest manifest          # run all enabled sources
  python -m ingestion.api_contract_ingest add-source --system PLAID --type URL --location https://... 
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import uuid

from ingestion.variance_engine import _catalog

log = logging.getLogger("cp.api360.ingest")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")


def _cur():
    conn = _catalog()
    return conn, conn.cursor()


def _clob(v):
    return v.read() if hasattr(v, "read") else v


# ---------------------------------------------------------------------------
# loaders
# ---------------------------------------------------------------------------
def load_openapi(file=None, url=None):
    if url:
        import requests
        spec = requests.get(url, timeout=60).json()
    else:
        with open(file, encoding="utf-8") as f:
            spec = json.load(f)
    if not isinstance(spec, dict) or not spec.get("paths"):
        raise ValueError("not an OpenAPI document (no paths)")
    return spec


def postman_to_spec(file, api_name, version):
    with open(file, encoding="utf-8") as f:
        pm = json.load(f)
    paths = {}

    def walk(items, tag):
        for it in items or []:
            if "item" in it:
                walk(it["item"], it.get("name", tag))
                continue
            rq = it.get("request") or {}
            url = rq.get("url")
            raw = (url.get("raw") if isinstance(url, dict) else url) or ""
            path = "/" + "/".join(
                raw.split("://")[-1].split("?")[0].split("/")[1:])
            path = re.sub(r"\{\{(\w+)\}\}", r"{\1}", path)
            m = (rq.get("method") or "get").lower()
            paths.setdefault(path, {})[m] = {
                "summary": it.get("name"), "tags": [tag],
                "responses": {"200": {"description": "ok"}}}
    walk(pm.get("item"), "General")
    return {"openapi": "3.0.0",
            "info": {"title": api_name, "version": version,
                     "x-source": "postman-derived"},
            "paths": paths}


# ---------------------------------------------------------------------------
# diff (field-level, vs previous stored version)
# ---------------------------------------------------------------------------
def _fields(spec):
    out = {}
    for p, ops in (spec.get("paths") or {}).items():
        for m, op in ops.items():
            if not isinstance(op, dict):
                continue
            resp = ((op.get("responses") or {}).get("200") or {})
            sch = (((resp.get("content") or {})
                    .get("application/json") or {}).get("schema")
                   or resp.get("schema") or {})
            if "$ref" in sch:
                node = spec
                for part in sch["$ref"].lstrip("#/").split("/"):
                    node = (node or {}).get(part)
                sch = node or {}
            req = set(sch.get("required") or [])
            for k in (sch.get("properties") or {}):
                out[f"{m.upper()} {p} :: {k}"] = k in req
            if not sch:
                out[f"{m.upper()} {p}"] = False   # endpoint-presence level
    return out


def diff_specs(old_spec, new_spec):
    of, nf = _fields(old_spec), _fields(new_spec)
    changes = []
    for k in sorted(set(of) | set(nf)):
        if k in of and k not in nf:
            changes.append(("BREAKING", k, "removed"))
        elif k not in of and k in nf:
            changes.append(("ADDITIVE", k,
                            "new" + (" (required!)" if nf[k] else "")))
        elif of[k] != nf[k]:
            changes.append(("BREAKING", k,
                            "optional -> required" if nf[k]
                            else "required -> optional"))
    return changes


# ---------------------------------------------------------------------------
# store + auto-collection refresh
# ---------------------------------------------------------------------------
def _refresh_auto_collection(cur, contract_id, api_name, version, spec,
                             system):
    # one AUTO collection per api_name — replace its requests in place
    cur.execute("""SELECT coll_id FROM api_collections
                   WHERE source = 'AUTO' AND name LIKE :n || ' %'""",
                {"n": api_name})
    row = cur.fetchone()
    if row:
        coll_id = row[0]
        cur.execute("DELETE FROM api_requests WHERE coll_id = :c",
                    {"c": coll_id})
        cur.execute("""UPDATE api_collections SET name = :nm,
                       contract_id = :k, provider_system = :ps
                       WHERE coll_id = :c""",
                    {"nm": f"{api_name} {version}", "k": contract_id,
                     "ps": system, "c": coll_id})
    else:
        coll_id = f"C{uuid.uuid4().hex[:12]}"
        cur.execute("""INSERT INTO api_collections
            (coll_id, name, source, contract_id, provider_system)
            VALUES (:1, :2, 'AUTO', :3, :4)""",
            [coll_id, f"{api_name} {version}", contract_id, system])
    n = 0
    for ptmpl, ops in (spec.get("paths") or {}).items():
        for method, op in ops.items():
            if method.upper() not in ("GET", "POST", "PUT", "PATCH",
                                      "DELETE"):
                continue
            url = "{{baseUrl}}" + re.sub(r"\{(\w+)\}", r"{{\1}}", ptmpl)
            qparams = {p["name"]: f"{{{{{p['name']}}}}}"
                       for p in (op.get("parameters") or [])
                       if p.get("in") == "query"}
            folder = (op.get("tags") or ["General"])[0]
            cur.execute("""INSERT INTO api_requests
                (req_id, coll_id, folder, name, method, url_tmpl,
                 params_json, headers_json, tests_json, sort_order)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10)""",
                [f"R{uuid.uuid4().hex[:12]}", coll_id, folder,
                 op.get("summary") or f"{method.upper()} {ptmpl}",
                 method.upper(), url, json.dumps(qparams),
                 json.dumps({"Accept": "application/json"}),
                 json.dumps(["status == 200", "time < 2000"]), n])
            n += 1
    return coll_id, n


def ingest_spec(spec, system, api_name=None, version=None):
    """The framework core — identical for every system and source type."""
    info = spec.get("info") or {}
    api_name = api_name or info.get("title") or "Unnamed API"
    version = version or info.get("version") or "v1"
    system = system.upper()
    conn, cur = _cur()
    # previous version for diff
    cur.execute("""SELECT spec_json FROM api_contracts
                   WHERE api_name = :n ORDER BY ingested_at DESC
                   FETCH FIRST 1 ROWS ONLY""", {"n": api_name})
    prev = cur.fetchone()
    changes = (diff_specs(json.loads(_clob(prev[0]) or "{}"), spec)
               if prev else [])
    # store (prior -> STALE), register system if unknown, onboard
    cid = f"K{uuid.uuid4().hex[:12]}"
    cur.execute("UPDATE api_contracts SET status = 'STALE' "
                "WHERE api_name = :n", {"n": api_name})
    cur.execute("""INSERT INTO api_contracts
        (contract_id, api_name, version, spec_json, provider_system)
        VALUES (:1, :2, :3, :4, :5)""",
        [cid, api_name, version, json.dumps(spec), system])
    cur.execute("""MERGE INTO api_systems d
        USING (SELECT :c AS system_code FROM dual) s
        ON (d.system_code = s.system_code)
        WHEN MATCHED THEN UPDATE SET status = 'ONBOARDED'
        WHEN NOT MATCHED THEN INSERT (system_code, display_name,
             parent_class, status)
             VALUES (:c, :c, 'NON-SEI', 'ONBOARDED')""",
        {"c": system})
    if changes and any(k == "BREAKING" for k, _f, _n in changes):
        cur.execute("""UPDATE api_contracts SET status = 'DRIFT'
                       WHERE contract_id = :c""", {"c": cid})
    coll_id, n_req = _refresh_auto_collection(cur, cid, api_name, version,
                                              spec, system)
    conn.commit()
    report = {"contract_id": cid, "api_name": api_name, "version": version,
              "system": system, "paths": len(spec.get("paths") or {}),
              "auto_collection": coll_id, "requests": n_req,
              "changes": [{"kind": k, "field": f, "note": n}
                          for k, f, n in changes[:60]],
              "breaking": sum(1 for k, _f, _n in changes
                              if k == "BREAKING")}
    log.info("ingested %s %s [%s] · %d paths · %d requests · "
             "%d breaking change(s)", api_name, version, system,
             report["paths"], n_req, report["breaking"])
    return report


# ---------------------------------------------------------------------------
# manifest: scheduled, repeatable re-ingestion
# ---------------------------------------------------------------------------
def ensure_sources_table():
    conn, cur = _cur()
    try:
        cur.execute("""CREATE TABLE api_ingest_sources (
            source_id   VARCHAR2(40) PRIMARY KEY,
            system_code VARCHAR2(30) NOT NULL,
            source_type VARCHAR2(12) NOT NULL,  -- FILE | URL | POSTMAN
            location    VARCHAR2(1000) NOT NULL,
            api_name    VARCHAR2(120),
            version     VARCHAR2(20),
            enabled     CHAR(1) DEFAULT 'Y',
            last_run_at TIMESTAMP,
            last_result VARCHAR2(400))""")
        conn.commit()
    except Exception:                                       # noqa: BLE001
        pass  # exists


def add_source(system, source_type, location, api_name=None, version=None):
    ensure_sources_table()
    conn, cur = _cur()
    cur.execute("""INSERT INTO api_ingest_sources
        (source_id, system_code, source_type, location, api_name, version)
        VALUES (:1, :2, :3, :4, :5, :6)""",
        [f"S{uuid.uuid4().hex[:12]}", system.upper(), source_type.upper(),
         location, api_name, version])
    conn.commit()
    log.info("source registered: %s %s %s", system, source_type, location)


def run_manifest(system=None):
    ensure_sources_table()
    conn, cur = _cur()
    sql = """SELECT source_id, system_code, source_type, location,
                    api_name, version
             FROM api_ingest_sources WHERE enabled = 'Y'"""
    if system:
        cur.execute(sql + " AND system_code = :s", {"s": system.upper()})
    else:
        cur.execute(sql)
    rows = cur.fetchall()
    reports = []
    for sid, system, stype, loc, name, ver in rows:
        try:
            if stype == "URL":
                spec = load_openapi(url=loc)
            elif stype == "FILE":
                spec = load_openapi(file=loc)
            elif stype == "POSTMAN":
                spec = postman_to_spec(loc, name or "Imported API",
                                       ver or "v1")
            else:
                raise ValueError(f"unknown source_type {stype}")
            rep = ingest_spec(spec, system, name, ver)
            result = (f"OK · {rep['paths']} paths · "
                      f"{rep['breaking']} breaking")
            reports.append(rep)
        except Exception as e:                              # noqa: BLE001
            result = f"FAILED · {str(e)[:200]}"
            log.error("source %s failed: %s", sid, result)
        cur.execute("""UPDATE api_ingest_sources
            SET last_run_at = SYSTIMESTAMP, last_result = :r
            WHERE source_id = :s""", {"r": result[:400], "s": sid})
        conn.commit()
    log.info("manifest run complete: %d source(s)", len(rows))
    return reports


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("openapi")
    o.add_argument("--file")
    o.add_argument("--url")
    o.add_argument("--system", required=True)
    o.add_argument("--name")
    o.add_argument("--version")
    pm = sub.add_parser("postman")
    pm.add_argument("--file", required=True)
    pm.add_argument("--system", required=True)
    pm.add_argument("--name", required=True)
    pm.add_argument("--version", default="v1")
    sub.add_parser("manifest")
    a = sub.add_parser("add-source")
    a.add_argument("--system", required=True)
    a.add_argument("--type", required=True,
                   choices=["FILE", "URL", "POSTMAN"])
    a.add_argument("--location", required=True)
    a.add_argument("--name")
    a.add_argument("--version")
    args = p.parse_args()
    if args.cmd == "openapi":
        spec = load_openapi(file=args.file, url=args.url)
        rep = ingest_spec(spec, args.system, args.name, args.version)
        print(json.dumps(rep, indent=2))
    elif args.cmd == "postman":
        spec = postman_to_spec(args.file, args.name, args.version)
        rep = ingest_spec(spec, args.system, args.name, args.version)
        print(json.dumps(rep, indent=2))
    elif args.cmd == "manifest":
        for r in run_manifest():
            print(f"{r['api_name']} {r['version']} [{r['system']}] "
                  f"· {r['paths']} paths · {r['breaking']} breaking")
    elif args.cmd == "add-source":
        add_source(args.system, args.type, args.location, args.name,
                   args.version)
