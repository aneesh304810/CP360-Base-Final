"""Airflow DAG rules: the fan-out design's decisions, read from the AST."""
from __future__ import annotations

import ast
import re

from . import Finding
from ._ast import parse, real_line, call_name, kw, const

GATE_WORDS = ("gate", "g1", "g2", "g3", "g4", "g5", "ingest", "load_raw", "tieout", "recon")
PARSE_TIME_CALLS = ("Variable.get", "requests.get", "requests.post", "open", "oracledb.connect", "cx_Oracle.connect", "create_engine", "BaseHook.get_connection", "boto3.client", "psycopg2.connect")
TRANSFORM_HINTS = ("pd.read_sql", "pandas.read_sql", "to_sql", "cursor.execute", "cur.execute", "conn.execute")


def _dag_calls(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and call_name(node) in ("DAG", "airflow.DAG", "models.DAG"):
            yield node


def _task_calls(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and call_name(node).endswith("Operator") or isinstance(node, ast.Call) and call_name(node).endswith("Sensor"):
            yield node


def check(fd):
    out = []
    tree, text, off = parse(fd)
    if tree is None:
        return out
    L = lambda n: real_line(getattr(n, "lineno", 1), off)  # noqa: E731

    dags = list(_dag_calls(tree))
    for d in dags:
        c = kw(d, "catchup")
        if c is None or const(c) is not False:
            out.append(Finding("CP360-CR-AF-002", fd.path, L(d), "DAG declared without catchup=False; a deploy or an unpause replays every missed interval.",
                               "Add catchup=False; backfill goes through the replay engine with a reason."))
        da = kw(d, "default_args")
        retries_default = None
        owner = None
        if isinstance(da, ast.Dict):
            for k, v in zip(da.keys, da.values):
                if const(k) == "retries":
                    retries_default = const(v)
                if const(k) == "owner":
                    owner = const(v)
        if retries_default is None:
            out.append(Finding("CP360-CR-AF-001", fd.path, L(d), "default_args does not set retries; Airflow's default retries every task, gates included.",
                               "default_args={'retries': 0}; only TRANSIENT (E6) tasks opt in to a bounded retry."))
        elif isinstance(retries_default, int) and retries_default > 0:
            out.append(Finding("CP360-CR-AF-001", fd.path, L(d), f"default_args sets retries={retries_default} for every task; a structural block would be attempted {retries_default + 1} times.",
                               "Set retries=0 in default_args and give only infrastructure-class tasks a bounded retry."))
        if not owner or owner.lower() in ("airflow", "admin", "me", "tbd"):
            out.append(Finding("CP360-CR-AF-006", fd.path, L(d), f"owner is {owner!r}; it should be the owning team.", "Set default_args['owner'] to the team name the on-call rota uses."))
        if kw(d, "tags") is None:
            out.append(Finding("CP360-CR-AF-006", fd.path, L(d), "DAG has no tags; the domain and tier are not visible in the UI or the registry.", "tags=['<domain>', '<tier>'] from the feed registry."))
        s = kw(d, "schedule") or kw(d, "schedule_interval")
        if s is None or const(s) is None and not isinstance(s, (ast.Name, ast.Call, ast.List, ast.Attribute)):
            out.append(Finding("CP360-CR-AF-006", fd.path, L(d), "schedule is missing or None; say the cron, the dataset trigger, or that it is replay-triggered only.",
                               "schedule='<cron>' or schedule=[Dataset(...)], with a comment when it is replay-only."))

    for t in _task_calls(tree):
        tid = const(kw(t, "task_id")) if kw(t, "task_id") is not None else None
        r = kw(t, "retries")
        name = call_name(t)
        is_gate = bool(tid and any(w in tid.lower() for w in GATE_WORDS)) or "Gate" in name
        if is_gate and r is not None and isinstance(const(r), int) and const(r) > 0:
            out.append(Finding("CP360-CR-AF-001", fd.path, L(t), f"gate or ingest task {tid!r} sets retries={const(r)}; a gate never retries (AD-9).", "retries=0 on every gate; the GateOperator enforces it."))
        if tid is not None and not re.match(r"^[a-z][a-z0-9_]*$", tid):
            out.append(Finding("CP360-CR-AF-004", fd.path, L(t), f"task_id {tid!r} is not a lowercase, underscore name derived from the feed and domain.", "Derive task ids from feed_id and domain: '<domain>__<feed>__<stage>'."))
        if name in ("PythonOperator", "PythonVirtualenvOperator", "BranchPythonOperator"):
            fn = kw(t, "python_callable")
            # a callable defined in this file that runs SQL or pandas is transformation in the DAG
            if isinstance(fn, ast.Name):
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef) and node.name == fn.id:
                        body = ast.get_source_segment(text, node) or ""
                        if any(h in body for h in TRANSFORM_HINTS) or re.search(r"\b(INSERT|UPDATE|MERGE|DELETE)\b", body):
                            out.append(Finding("CP360-CR-AF-009", fd.path, L(node), f"python_callable {fn.id!r} runs SQL or pandas inside the DAG: transformation logic outside the framework and dbt.",
                                               "Call the ingestion framework or a dbt selector from the task; keep the DAG to orchestration."))
                        break

    # parse-time work: calls at module level
    for node in tree.body:
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and call_name(sub) in PARSE_TIME_CALLS and not _inside_function(tree, sub):
                out.append(Finding("CP360-CR-AF-003", fd.path, L(sub), f"{call_name(sub)}() at module level runs on every scheduler parse.",
                                   "Move it inside the task, or read from the registry the fan-out expands over."))

    # secrets or hosts in the DAG file itself
    for n, t in (fd.new_lines().items() if fd.new_text is not None else fd.added):
        low = t.lower()
        if re.search(r"(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*['\"][^'\"]{4,}", low) or re.search(r"[a-z]+://[^:/\s]+:[^@\s]+@", low):
            out.append(Finding("CP360-CR-AF-005", fd.path, n, "a credential or a connection string with credentials is written in the DAG file.", "Use a connection from the secret-store backend; nothing in the file, nothing in Variables.", evidence=t.strip()[:120]))
        if re.search(r"Variable\.get\(\s*['\"][^'\"]*(pass|secret|token|key|conn)", t, re.I):
            out.append(Finding("CP360-CR-AF-005", fd.path, n, "a secret is read from an Airflow Variable; Variables are plain text in the metadata database.", "Use the secret-store connection backend.", evidence=t.strip()[:120]))
    return out


def _inside_function(tree, target):
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            for sub in ast.walk(node):
                if sub is target:
                    return True
    return False
