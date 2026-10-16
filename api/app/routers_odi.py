"""ODI 360 · the repository export (sql/83): scenarios, tasks, tables, variables, objects, edges.

Reads only. Every endpoint degrades to an empty shape with loaded=false when
sql/83 has not been run, so the screen says "run the ingestion" rather than
failing. Code previews are returned as the export cut them; nothing here
touches the warehouse.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from .db import query

log = logging.getLogger("cp.odi")
router = APIRouter(prefix="/odi", tags=["odi"])


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("odi query failed: %s", str(e).splitlines()[0][:160])
        return []


def _split(s, sep=";"):
    return [p.strip() for p in str(s or "").split(sep) if p.strip()]


def _like(q):
    return f"%{(q or '').strip().upper()}%"


@router.get("/summary")
def summary():
    s = (_safe("""SELECT COUNT(*) AS scenarios, NVL(SUM(task_count), 0) AS tasks, NVL(SUM(truncated_tasks), 0) AS truncated,
                         MAX(loaded_at) AS loaded_at FROM odi_scenario""") or [{}])[0]
    counts = {}
    for k, sql in (("variables", "SELECT COUNT(*) AS n FROM odi_variable"), ("tables", "SELECT COUNT(*) AS n FROM odi_table"),
                   ("objects", "SELECT COUNT(*) AS n FROM odi_object"), ("edges", "SELECT COUNT(*) AS n FROM odi_edge"),
                   ("scd2_cards", "SELECT COUNT(*) AS n FROM scd2_card")):
        counts[k] = int(((_safe(sql) or [{}])[0]).get("n") or 0)
    patterns = _safe("SELECT NVL(load_pattern, 'unknown') AS k, COUNT(*) AS n FROM odi_scenario GROUP BY load_pattern ORDER BY 2 DESC")
    layers = _safe("SELECT NVL(layer, 'unknown') AS k, COUNT(*) AS n FROM odi_table GROUP BY layer ORDER BY 2 DESC")
    types = _safe("SELECT object_type AS k, COUNT(*) AS n FROM odi_object GROUP BY object_type ORDER BY 2 DESC")
    plans = _safe("SELECT COUNT(DISTINCT load_plans) AS n FROM odi_scenario WHERE load_plans IS NOT NULL")
    return {"loaded": bool(s.get("scenarios")), "scenarios": int(s.get("scenarios") or 0), "tasks": int(s.get("tasks") or 0),
            "truncated_tasks": int(s.get("truncated") or 0), "loaded_at": s.get("loaded_at"), **counts,
            "load_plans": int(((plans or [{}])[0]).get("n") or 0),
            "by_pattern": [{"k": r["k"], "n": int(r["n"])} for r in patterns],
            "by_layer": [{"k": r["k"], "n": int(r["n"])} for r in layers],
            "by_object_type": [{"k": r["k"], "n": int(r["n"])} for r in types]}


@router.get("/scenarios")
def scenarios(q: str = Query("", max_length=120), pattern: str = Query("", max_length=60)):
    rows = _safe("""SELECT scenario, writes, reads, db_procedures, kms, variables, load_pattern, load_plans, autosys_jobs,
                           step_count, task_count, truncated_tasks
                    FROM   odi_scenario
                    WHERE  (:q IS NULL OR UPPER(scenario) LIKE :ql OR UPPER(writes) LIKE :ql OR UPPER(reads) LIKE :ql)
                      AND  (:p IS NULL OR UPPER(NVL(load_pattern, 'unknown')) = UPPER(:p))
                    ORDER  BY scenario""", {"q": q.strip() or None, "ql": _like(q), "p": pattern.strip() or None})
    for r in rows:
        r["writes_list"], r["reads_list"] = _split(r.get("writes")), _split(r.get("reads"))
        r["procedures_list"], r["load_plans_list"] = _split(r.get("db_procedures")), _split(r.get("load_plans"))
        r["jobs_list"] = _split(r.get("autosys_jobs"))
    return {"scenarios": rows, "count": len(rows), "loaded": bool(rows)}


@router.get("/scenario/{name}")
def scenario(name: str):
    n = name.strip().upper()
    head = _safe("""SELECT scenario, writes, reads, db_procedures, kms, variables, load_pattern, load_plans, autosys_jobs,
                           step_count, task_count, truncated_tasks, loaded_at FROM odi_scenario WHERE UPPER(scenario) = :s""", {"s": n})
    tasks = _safe("""SELECT step_no, task_no, version, task_name1, task_name2, task_name3, task_type, reads, writes, code_chars,
                            code_preview, truncated FROM odi_task WHERE UPPER(scenario) = :s ORDER BY step_no, task_no""", {"s": n})
    h = head[0] if head else {"scenario": n}
    var_names = _split(h.get("variables"))
    variables = []
    for v in var_names[:40]:
        variables += _safe("SELECT name, datatype, refresh_lschema, refresh_sql FROM odi_variable WHERE UPPER(name) LIKE :v",
                           {"v": f"%{v.upper()}"})
    edges = _safe("""SELECT src_type, src, relation, dst_type, dst, detail FROM odi_edge
                     WHERE UPPER(detail) LIKE :s OR (src_type = 'SCENARIO' AND UPPER(src) = :n) OR (dst_type = 'SCENARIO' AND UPPER(dst) = :n)
                     ORDER BY src, dst""", {"s": f"%{n}%", "n": n})
    objects = _safe("SELECT object_type, schema_name, name, on_table FROM odi_object WHERE UPPER(used_by) LIKE :s ORDER BY object_type, name",
                    {"s": f"%{n}%"})
    steps = {}
    for tk in tasks:
        steps.setdefault(tk["step_no"], []).append(tk)
    return {"scenario": n, "loaded": bool(head or tasks), "head": {**h, "writes_list": _split(h.get("writes")), "reads_list": _split(h.get("reads")),
            "procedures_list": _split(h.get("db_procedures")), "kms_list": _split(h.get("kms")), "load_plans_list": _split(h.get("load_plans")),
            "jobs_list": _split(h.get("autosys_jobs"))},
            "steps": [{"step_no": k, "tasks": v} for k, v in sorted(steps.items())], "tasks": tasks,
            "variables": variables, "edges": edges, "objects": objects}


@router.get("/tables")
def tables(q: str = Query("", max_length=120), layer: str = Query("", max_length=60)):
    rows = _safe("""SELECT t.table_name, t.written_by, t.read_by, t.write_operations, t.indexes, t.layer, t.writer_count, t.reader_count,
                           c.pattern AS scd2_pattern, r.verdict AS scan_verdict
                    FROM   odi_table t
                      LEFT JOIN scd2_card c ON c.table_name = t.table_name
                      LEFT JOIN scd2_column_role r ON r.table_name = t.table_name
                    WHERE  (:q IS NULL OR UPPER(t.table_name) LIKE :ql OR UPPER(t.written_by) LIKE :ql OR UPPER(t.read_by) LIKE :ql)
                      AND  (:l IS NULL OR UPPER(NVL(t.layer, 'unknown')) = UPPER(:l))
                    ORDER  BY t.table_name""", {"q": q.strip() or None, "ql": _like(q), "l": layer.strip() or None})
    if not rows:  # sql/81 absent: the join itself fails; fall back to the table alone
        rows = _safe("""SELECT table_name, written_by, read_by, write_operations, indexes, layer, writer_count, reader_count
                        FROM odi_table WHERE (:q IS NULL OR UPPER(table_name) LIKE :ql) ORDER BY table_name""",
                     {"q": q.strip() or None, "ql": _like(q)})
    for r in rows:
        r["writers"], r["readers"] = _split(r.get("written_by")), _split(r.get("read_by"))
        r["operations"], r["index_list"] = _split(r.get("write_operations")), _split(r.get("indexes"))
    return {"tables": rows, "count": len(rows), "loaded": bool(rows)}


@router.get("/table/{name}")
def table(name: str):
    n = name.strip().upper()
    head = _safe("SELECT table_name, written_by, read_by, write_operations, indexes, layer FROM odi_table WHERE UPPER(table_name) = :t", {"t": n})
    h = head[0] if head else {"table_name": n}
    writers, readers = _split(h.get("written_by")), _split(h.get("read_by"))
    # the tasks that write this table, across its writer scenarios: the mapping, step by step
    tasks = _safe("""SELECT scenario, step_no, task_no, task_name1, task_name2, task_name3, task_type, reads, writes, code_chars, code_preview, truncated
                     FROM   odi_task WHERE UPPER(writes) LIKE :t ORDER BY scenario, step_no, task_no""", {"t": f"%{n}%"})
    tasks = [tk for tk in tasks if n in {w.split("(")[0].strip().upper() for w in _split(tk.get("writes"))}]
    inbound = _safe("SELECT src_type, src, relation, dst_type, dst, detail FROM odi_edge WHERE UPPER(dst) = :t ORDER BY src", {"t": n})
    outbound = _safe("SELECT src_type, src, relation, dst_type, dst, detail FROM odi_edge WHERE UPPER(src) = :t ORDER BY dst", {"t": n})
    objects = _safe("SELECT object_type, schema_name, name, columns, used_by FROM odi_object WHERE UPPER(on_table) = :t ORDER BY object_type, name", {"t": n})
    card = _safe("""SELECT pattern, scan_verdict, surrogate_key, natural_key, version_key, partition_col, rule_count, proven_count,
                           inferred_count, unknown_count, open_count, row_count, dup_pct, freshness_alert, ran_at
                    FROM scd2_card WHERE table_name = :t""", {"t": n})
    roles = _safe("SELECT verdict, confidence, surrogate_key, valid_from, valid_to, current_flag, version, row_hash, business_date, audit_col, to_convention "
                  "FROM scd2_column_role WHERE table_name = :t", {"t": n})
    sources = sorted({r.split("(")[0].strip() for tk in tasks for r in _split(tk.get("reads"))})
    return {"table": n, "loaded": bool(head or tasks), "head": {**h, "writers": writers, "readers": readers, "operations": _split(h.get("write_operations")),
            "index_list": _split(h.get("indexes"))}, "tasks": tasks, "sources": sources, "inbound": inbound, "outbound": outbound,
            "objects": objects, "scd2": card[0] if card else None, "column_roles": roles[0] if roles else None}


@router.get("/variables")
def variables(q: str = Query("", max_length=120)):
    rows = _safe("""SELECT name, project, datatype, default_value, refresh_lschema, refresh_sql, source_file FROM odi_variable
                    WHERE (:q IS NULL OR UPPER(name) LIKE :ql OR UPPER(refresh_sql) LIKE :ql) ORDER BY name""",
                 {"q": q.strip() or None, "ql": _like(q)})
    used = {r["v"]: int(r["n"]) for r in _safe("""SELECT v AS v, COUNT(*) AS n FROM (
                 SELECT TRIM(REGEXP_SUBSTR(variables, '[^;]+', 1, LEVEL)) AS v FROM odi_scenario
                 WHERE variables IS NOT NULL CONNECT BY LEVEL <= REGEXP_COUNT(variables, ';') + 1 AND PRIOR scenario = scenario AND PRIOR SYS_GUID() IS NOT NULL)
                 WHERE v IS NOT NULL GROUP BY v""")}
    for r in rows:
        short = str(r["name"]).split(".")[-1]
        r["used_by_scenarios"] = used.get(short) or used.get(r["name"]) or 0
    return {"variables": rows, "count": len(rows), "loaded": bool(rows)}


@router.get("/objects")
def objects(q: str = Query("", max_length=120), type_: str = Query("", alias="type", max_length=60)):
    rows = _safe("""SELECT object_type, schema_name, name, on_table, columns, used_by FROM odi_object
                    WHERE (:q IS NULL OR UPPER(name) LIKE :ql OR UPPER(on_table) LIKE :ql)
                      AND (:t IS NULL OR UPPER(object_type) = UPPER(:t)) ORDER BY object_type, name""",
                 {"q": q.strip() or None, "ql": _like(q), "t": type_.strip() or None})
    for r in rows:
        r["used_by_list"] = _split(r.get("used_by"))
    return {"objects": rows, "count": len(rows), "loaded": bool(rows)}


@router.get("/edges")
def edges(node: str = Query("", max_length=200)):
    n = node.strip().upper()
    if not n:
        rows = _safe("SELECT src_type, src, relation, dst_type, dst, detail FROM odi_edge ORDER BY src, dst FETCH FIRST 2000 ROWS ONLY")
    else:
        rows = _safe("SELECT src_type, src, relation, dst_type, dst, detail FROM odi_edge WHERE UPPER(src) = :n OR UPPER(dst) = :n ORDER BY src, dst", {"n": n})
    return {"edges": rows, "count": len(rows), "loaded": bool(rows)}
