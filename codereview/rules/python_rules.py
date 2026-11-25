"""Integration Hub Python rules: the error library, idempotency, timeouts,
logging, config-driven code, from the AST and the text."""
from __future__ import annotations

import ast
import re

from . import Finding
from ._ast import parse, real_line, call_name, kw, const

ERROR_CLASSES = ("TransientError", "StructuralError", "DataError", "ContractError", "SystemError", "HubError", "TRANSIENT", "STRUCTURAL", "CONTRACT")
HTTP_CALLS = ("requests.get", "requests.post", "requests.put", "requests.delete", "requests.request", "httpx.get", "httpx.post", "httpx.Client", "urlopen", "urllib.request.urlopen")
DB_CONNECT = ("oracledb.connect", "cx_Oracle.connect", "create_engine", "psycopg2.connect")
PAYLOAD_LOG = re.compile(r"log(ger)?\.(info|debug|warning|error|exception)\(.*\b(row|record|payload|body|account|client_name|acct)\b", re.I)


def check(fd, airflow=False):
    out = []
    tree, text, off = parse(fd)
    lines = fd.new_lines() if fd.new_text is not None else dict(fd.added)
    if tree is not None:
        L = lambda n: real_line(getattr(n, "lineno", 1), off)  # noqa: E731
        for node in ast.walk(tree):
            # bare except / except Exception that swallows
            if isinstance(node, ast.ExceptHandler):
                if node.type is None:
                    out.append(Finding("CP360-CR-PY-001", fd.path, L(node), "bare except: every error class is caught and the taxonomy is lost.", "Catch the class you can handle; let the shared error library classify the rest."))
                elif isinstance(node.type, ast.Name) and node.type.id in ("Exception", "BaseException") and _swallows(node):
                    out.append(Finding("CP360-CR-PY-001", fd.path, L(node), "except Exception that passes or only logs: the error is swallowed, nothing is classified, nothing retries or quarantines.", "Re-raise as a taxonomy class (TRANSIENT, STRUCTURAL, DATA, CONTRACT, SYSTEM) or let it propagate."))
            # unbounded retry loops
            if isinstance(node, ast.While) and isinstance(node.test, ast.Constant) and node.test.value is True:
                body = ast.get_source_segment(text, node) or ""
                if re.search(r"\b(retry|retries|attempt|sleep)\b", body) and not re.search(r"\b(max_attempts|max_retries|attempts\s*[<>]=?|for\s+attempt)\b", body):
                    out.append(Finding("CP360-CR-PY-001", fd.path, L(node), "while True retry loop with no bound: a permanently failing dependency is retried for ever.", "Bounded, jittered retry for TRANSIENT only; exhaustion promotes to SYSTEM and pages."))
            if isinstance(node, ast.Call):
                name = call_name(node)
                if name == "print":
                    out.append(Finding("CP360-CR-PY-006", fd.path, L(node), "print() in production code: nothing reaches the structured log or carries a correlation id.", "Use the module logger with the correlation id, load_id or event_id in the record."))
                if name in HTTP_CALLS and kw(node, "timeout") is None:
                    out.append(Finding("CP360-CR-PY-005", fd.path, L(node), f"{name}() without a timeout: a hung dependency hangs the task.", "Pass timeout=(connect, read) and put calls to a degradable dependency behind the circuit breaker."))
                if name in ("time.sleep", "sleep") and _in_loop(tree, node) and not _bounded_near(text, node):
                    pass
                if name in ("cur.execute", "cursor.execute", "conn.execute") and node.args:
                    a = node.args[0]
                    if isinstance(a, ast.JoinedStr) or (isinstance(a, ast.BinOp) and isinstance(a.op, (ast.Mod, ast.Add))) or (isinstance(a, ast.Call) and call_name(a).endswith(".format")):
                        src = ast.get_source_segment(text, a) or ""
                        if re.search(r"\b(where|values|=|like)\b", src, re.I):
                            out.append(Finding("CP360-CR-SQL-003", fd.path, L(node), "SQL built by string formatting with a value in it: an injection surface and a plan-cache miss.", "Bind the values (:name); allow-list identifiers if a table name must vary."))
                    src = ast.get_source_segment(text, a) or ""
                    if re.search(r"^\s*['\"f]*\s*(DELETE\s+FROM|TRUNCATE)\b", src, re.I) and re.search(r"(raw|stg1|stage1|landing)", src, re.I):
                        out.append(Finding("CP360-CR-PY-004", fd.path, L(node), "DELETE or TRUNCATE against a RAW/Stage 1 table: RAW is append-only; a redelivery supersedes.", "Insert under a new LOAD_ID and flag the prior load SUPERSEDED."))
                    if re.search(r"^\s*['\"f]*\s*(CREATE|ALTER|DROP)\s+TABLE\b", src, re.I):
                        out.append(Finding("CP360-CR-PY-010", fd.path, L(node), "DDL executed at runtime: the framework never creates or alters tables; DDL is generated from the config store and released.", "Move the DDL to a Liquibase changeset."))
                    if re.search(r"^\s*['\"f]*\s*(INSERT|UPDATE|DELETE)\b.*\b(cfg_|config_|cp_config|metadata_config)", src, re.I):
                        out.append(Finding("CP360-CR-PY-010", fd.path, L(node), "a write to the config store at runtime; config is read-only to the pipeline and changes through Git and the CI job.", "Make the change in the config repository."))
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for d in node.args.defaults + node.args.kw_defaults:
                    if isinstance(d, (ast.List, ast.Dict, ast.Set)):
                        out.append(Finding("CP360-CR-PY-009", fd.path, L(node), f"mutable default argument on {node.name}(): shared state across calls.", "Default to None and build the container inside."))
                if not node.name.startswith("_") and ast.get_docstring(node) is None and len(node.body) > 3 and not airflow:
                    out.append(Finding("CP360-CR-PY-009", fd.path, L(node), f"public function {node.name}() has no docstring.", "One paragraph: what it does, what it raises, what it writes.", confidence="medium"))
                if re.search(r"\bif\s+feed(_id|_name)?\s*(==|in)\s*['\"(]", ast.get_source_segment(text, node) or ""):
                    out.append(Finding("CP360-CR-PY-008", fd.path, L(node), f"{node.name}() branches on a feed name: a per-feed exception inside framework code.", "Express the difference as feed configuration in the registry; the framework reads it."))
            if isinstance(node, ast.Return) and _in_route(tree, node):
                pass
    # text rules
    joined = "\n".join(f"{n}:{t}" for n, t in sorted(lines.items()))
    for n, t in sorted(lines.items()):
        if PAYLOAD_LOG.search(t):
            out.append(Finding("CP360-CR-PY-006", fd.path, n, "a log line that carries a row, payload or account value; events carry keys and metrics, never values.", "Log the identifiers (load_id, correlation id, count) and keep the value out.", evidence=t.strip()[:120], confidence="medium"))
    # inbound endpoint: process before acknowledging
    if re.search(r"@(router|app)\.(post|put)\(", joined):
        for m in re.finditer(r"(\d+):\s*@(router|app)\.(post|put)\(([^)]*)\)", joined):
            start = int(m.group(1))
            body = "\n".join(t for n, t in sorted(lines.items()) if start < n <= start + 60)
            writes = re.search(r"\b(execute|insert|merge|commit|durable|spool|enqueue)\b", body, re.I)
            heavy = re.search(r"\b(match|correlat|lookup|resolve|parse_.*\(|transform)\w*\(", body, re.I)
            if heavy and (not writes or body.find(heavy.group(0)) < body.find(writes.group(0))):
                out.append(Finding("CP360-CR-PY-002", fd.path, start, "the endpoint parses, matches or resolves before it writes: a failed lookup becomes the sender's 500 and the sender's retry storm.", "Write the envelope durably, return 202, and do the matching downstream.", confidence="medium"))
            if not re.search(r"\b(idempotency|correlation_id|event_id|load_id|x-request-id|unique)\b", body, re.I):
                out.append(Finding("CP360-CR-PY-003", fd.path, start, "no idempotency key on a write endpoint: a sender retry lands twice.", "Key the write on the idempotency key or event id with a unique constraint; a replay is rejected by the constraint.", confidence="medium"))
    if re.search(r"\b(def (load|ingest|publish|submit|replay|quarantine|override)\w*)", joined) and not re.search(r"\b(audit|emit|ops_event|audit_event|emit_event)\w*\(", joined):
        m = re.search(r"(\d+):\s*def (load|ingest|publish|submit|replay|quarantine|override)\w*", joined)
        out.append(Finding("CP360-CR-PY-007", fd.path, int(m.group(1)), f"{m.group(2)} path with no audit emit: a decision or a load that leaves no stored event.", "Emit the audit event (who or what, when, keys) through the fire-and-forget emitter.", confidence="medium"))
    return out


def _swallows(handler):
    body = handler.body
    if len(body) == 1 and isinstance(body[0], ast.Pass):
        return True
    has_raise = any(isinstance(n, ast.Raise) for n in ast.walk(handler))
    return not has_raise and all(isinstance(s, ast.Expr) and isinstance(s.value, ast.Call) and call_name(s.value).startswith(("log", "print")) for s in body)


def _in_loop(tree, target):
    for node in ast.walk(tree):
        if isinstance(node, (ast.While, ast.For)):
            if any(sub is target for sub in ast.walk(node)):
                return True
    return False


def _bounded_near(text, node):
    return True


def _in_route(tree, node):
    return False
