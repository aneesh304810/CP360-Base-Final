"""Data 360 Pipelines router — mirrors API 360's pattern but for data pipelines.

A "pipeline" = a business-domain data process (positions, cash, nav, ...). Each
pipeline shows:
  - its Airflow DAG(s) with latest run status      (orchestration)
  - the dbt models the DAG runs, bronze->silver->gold (transform)
  - per-model transformation SQL                    (drill-down)
  - end-to-end column/table lineage                 (feed -> bronze -> gold)
  - an inferred schedule tag: EOD | BOD | Intraday | Reference

Schedule inference (no explicit column needed):
  - DAG tag contains 'eod'            -> EOD
  - DAG tag contains 'bod'/'daily' AM -> BOD
  - DAG tag contains 'intraday'       -> Intraday
  - tag 'reference'/name starts ref_  -> Reference
  - else                              -> EOD (default for accounting close)
"""
from __future__ import annotations
import re
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/data360/pipelines", tags=["data360-pipelines"])

# business domains we surface as pipelines
DOMAINS = ["positions", "taxlots", "transactions", "cash", "fees", "nav", "gl",
           "accruals", "interest", "dividends", "corporate_actions",
           "settlements", "custody", "performance"]


def _safe(sql, params):
    try:
        return query(sql, params)
    except Exception:
        return []


def _domain_of(name: str) -> str | None:
    n = (name or "").lower()
    for d in DOMAINS:
        if d in n:
            return d
    return None


def _schedule_of(tags: str, dag_name: str) -> str:
    t = (tags or "").lower()
    nm = (dag_name or "").lower()
    if "intraday" in t:
        return "Intraday"
    if "reference" in t or nm.startswith("ref_"):
        return "Reference"
    if "bod" in t or "morning" in t:
        return "BOD"
    if "eod" in t:
        return "EOD"
    return "EOD"


@router.get("")
def list_pipelines(project_id: str | None = None):
    """One pipeline per business domain, with its DAG, schedule tag, model + run counts."""
    # pull all DAG datasets and their tags
    dags = _safe("""SELECT object_name AS dag_id, tags, project_id, domain
                    FROM datasets WHERE object_type = 'DAG'""", {})
    # latest run status per dag
    runs = _safe("""SELECT dag_id, status, COUNT(*) c
                    FROM runs GROUP BY dag_id, status""", {})
    run_by_dag = {}
    for r in runs:
        run_by_dag.setdefault(r["dag_id"], {})[r["status"]] = r["c"]

    # model counts per domain
    models = _safe("""SELECT object_name AS model, layer, domain
                      FROM datasets WHERE object_type = 'MODEL'""", {})

    pipelines = {}
    for d in dags:
        dom = _domain_of(d["dag_id"]) or d.get("domain")
        if not dom:
            continue
        p = pipelines.setdefault(dom, {
            "pipeline_id": dom, "domain": dom,
            "display_name": dom.replace("_", " ").title(),
            "project_id": d.get("project_id", "sei"),
            "dags": [], "schedule": None, "model_count": 0,
            "last_status": "unknown", "run_summary": {},
        })
        sched = _schedule_of(d.get("tags"), d["dag_id"])
        p["schedule"] = p["schedule"] or sched
        rs = run_by_dag.get(d["dag_id"], {})
        for k, v in rs.items():
            p["run_summary"][k] = p["run_summary"].get(k, 0) + v
        p["dags"].append({"dag_id": d["dag_id"], "schedule": sched, "runs": rs})

    # attach model counts
    for m in models:
        dom = _domain_of(m["model"]) or m.get("domain")
        if dom in pipelines:
            pipelines[dom]["model_count"] += 1

    # derive last_status
    for p in pipelines.values():
        rsum = p["run_summary"]
        if rsum.get("failed"):
            p["last_status"] = "failed"
        elif rsum.get("running"):
            p["last_status"] = "running"
        elif rsum.get("success"):
            p["last_status"] = "success"

    out = sorted(pipelines.values(), key=lambda x: x["display_name"])
    return {"pipelines": out}


@router.get("/{pipeline_id}")
def pipeline_detail(pipeline_id: str):
    """Full drill-down: DAGs + runs, dbt models in medallion order, lineage edges."""
    dom = pipeline_id.lower()
    # DAGs for this domain
    dags = _safe("""SELECT object_name AS dag_id, tags, owner
                    FROM datasets WHERE object_type = 'DAG'""", {})
    my_dags = [d for d in dags if _domain_of(d["dag_id"]) == dom]
    dag_ids = [d["dag_id"] for d in my_dags]

    # latest runs per dag (most recent N)
    run_rows = []
    for did in dag_ids:
        run_rows += _safe("""SELECT dag_id, task_id, status, start_ts, end_ts, duration_s
            FROM runs WHERE dag_id = :d
            ORDER BY start_ts DESC FETCH FIRST 20 ROWS ONLY""", {"d": did})

    # dbt models in this domain, ordered bronze->silver->gold
    models = _safe("""SELECT object_name AS model, layer, schema_name, domain,
                             business_desc, tech_desc
        FROM datasets WHERE object_type = 'MODEL'""", {})
    my_models = [m for m in models if _domain_of(m["model"]) == dom]
    layer_rank = {"bronze": 0, "silver": 1, "gold": 2}
    my_models.sort(key=lambda m: layer_rank.get((m.get("layer") or "").lower(), 9))

    # lineage edges touching these models (feed/table -> model -> model)
    model_keys = {m["model"] for m in my_models}
    edges = _safe("""SELECT from_key, to_key, edge_type FROM transform_lineage""", {})
    my_edges = [e for e in edges
                if any(mk in (e["from_key"] or "") or mk in (e["to_key"] or "")
                       for mk in model_keys)]

    # SWP EOD feeds that feed this domain (the bronze source layer)
    feeds = _safe("""SELECT object_name AS feed, schema_name, feed_class,
                            geography, regulatory_scope, domain
        FROM datasets WHERE object_type = 'FEED'""", {})
    my_feeds = [f for f in feeds if (f.get("domain") == dom
                or _domain_of(f["feed"]) == dom)]

    return {
        "pipeline_id": dom,
        "display_name": dom.replace("_", " ").title(),
        "schedule": _schedule_of(my_dags[0]["tags"] if my_dags else "", dom),
        "feeds": my_feeds,
        "dags": my_dags,
        "runs": run_rows,
        "models": my_models,
        "lineage_edges": my_edges,
        "model_count": len(my_models),
        "feed_count": len(my_feeds),
    }


@router.get("/{pipeline_id}/model/{model_name}")
def model_detail(pipeline_id: str, model_name: str):
    """A single dbt model: its transform SQL + column lineage + data quality rules."""
    tx = _safe("""SELECT target_key, transform_type, dbt_model, compiled_sql, raw_sql
        FROM transformations WHERE LOWER(dbt_model) = :m
        OR LOWER(target_key) LIKE :mk""",
        {"m": model_name.lower(), "mk": f"%{model_name.lower()}%"})
    cols = _safe("""SELECT from_column, to_column, transform_expr
        FROM column_lineage WHERE LOWER(to_dataset) LIKE :m
        ORDER BY to_column""", {"m": f"%{model_name.lower()}%"})
    # Data quality rules — derived from column metadata on the model's target
    # columns (dbt-test style): not_null on NOT NULL cols, unique on PK/id cols,
    # accepted_values where the column has reference data.
    qcols = _safe("""SELECT column_name, nullable, is_pk, is_pii
        FROM columns WHERE LOWER(object_name) LIKE :m
        FETCH FIRST 60 ROWS ONLY""", {"m": f"%{model_name.lower()}%"})
    dq = []
    for c in qcols:
        cn = c.get("column_name")
        if not cn:
            continue
        if c.get("is_pk") == "Y" or cn.lower().endswith("_id") or cn.lower() == "id":
            dq.append({"column": cn, "test": "unique", "gate": "dbt test", "severity": "error"})
            dq.append({"column": cn, "test": "not_null", "gate": "dbt test", "severity": "error"})
        elif c.get("nullable") == "N":
            dq.append({"column": cn, "test": "not_null", "gate": "dbt test", "severity": "error"})
        if c.get("is_pii") == "Y":
            dq.append({"column": cn, "test": "no_plaintext_pii", "gate": "Soda/GE", "severity": "warn"})
    # accepted_values for columns that have reference data
    ref = _safe("""SELECT DISTINCT field_name_normalized FROM reference_data""", {})
    refset = {(r.get("field_name_normalized") or "").lower() for r in ref}
    for c in qcols:
        cn = (c.get("column_name") or "")
        if cn and cn.lower() in refset:
            dq.append({"column": cn, "test": "accepted_values", "gate": "dbt test (ref)", "severity": "warn"})
    # --- materialization + meta (mockup's MATERIALIZATION / TESTS / META block) ---
    sql_txt = (tx[0].get("compiled_sql") or tx[0].get("raw_sql") or "") if tx else ""
    import re as _re
    mmat = _re.search(r"materialized\s*=\s*['\"](\w+)['\"]", sql_txt)
    materialization = mmat.group(1) if mmat else ("view" if "_slv_" in model_name or "brz" in model_name else "table")
    # meta from the dataset row matching this model
    meta = _safe("""SELECT domain, business_desc,
        (SELECT COUNT(*) FROM columns c WHERE c.object_name = d.object_name AND c.is_pii='Y') AS pii_cols
        FROM datasets d WHERE LOWER(d.object_name) LIKE :m FETCH FIRST 1 ROWS ONLY""",
        {"m": f"%{model_name.lower()}%"})
    meta_row = meta[0] if meta else {}
    # tests summary line (from dq)
    test_summary = ", ".join(sorted({d["test"] for d in dq})) or "\u2014"
    return {"model": model_name,
            "transformation": tx[0] if tx else None,
            "column_lineage": cols,
            "quality_rules": dq,
            "materialization": materialization,
            "tests_summary": test_summary,
            "meta": {"domain": meta_row.get("domain"),
                     "pii": "yes" if (meta_row.get("pii_cols") or 0) > 0 else "no",
                     "desc": meta_row.get("business_desc")}}
