"""Secrets, hosts, client data, size, TODOs, tests-with-code: across every file."""
from __future__ import annotations

import re

from . import Finding

SECRET = re.compile(r"(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|token|private[_-]?key)\w*\s*[:=]\s*['\"]([^'\"]{6,})['\"]")
SECRET_SAFE = re.compile(r"(?i)(os\.environ|getenv|\$\{|\{\{|<[^>]+>|xxx|changeme|example|placeholder|redacted|\*\*\*|secret_name|secretKeyRef|credentialsId|credentials_id|_id\b)")
PRIVATE_KEY = re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----")
CONN_URL = re.compile(r"[a-z][a-z0-9+.-]*://[^:/\s'\"]+:[^@\s'\"]+@")
HOST = re.compile(r"\b[a-z0-9-]+\.(testbbh|bbh)\.com\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-z0-9-]+\.apps\.ocp[a-z0-9-]*\.[a-z.]+\b", re.I)
ACCOUNT = re.compile(r"\b\d{10,16}\b")
TEST_DIRS = ("test", "tests", "spec")
PROD_SUFFIX = (".py", ".sql", ".yml", ".yaml")


def check(fd):
    out = []
    if fd.binary:
        return out
    lines = fd.new_lines() if fd.new_text is not None else dict(fd.added)
    is_test = any(f"/{d}/" in f"/{fd.path}" for d in TEST_DIRS) or fd.path.rsplit("/", 1)[-1].startswith("test_")
    is_doc = fd.path.lower().endswith((".md", ".txt", ".html"))
    for n, t in sorted(lines.items()):
        s = t.strip()
        if PRIVATE_KEY.search(s):
            out.append(Finding("CP360-CR-SEC-001", fd.path, n, "a private key is committed.", "Remove it, rotate it, and load keys from the secret store."))
        m = SECRET.search(s)
        if m and not SECRET_SAFE.search(s) and not s.lstrip().startswith(("#", "//", "--")):
            out.append(Finding("CP360-CR-SEC-001", fd.path, n, f"a literal {m.group(1).lower()} value in the file.", "Read it from the secret store or an injected environment variable; never a literal.", evidence=(s[:m.start(2)] + "***")[:120]))
        if CONN_URL.search(s):
            out.append(Finding("CP360-CR-SEC-001", fd.path, n, "a connection URL with credentials embedded.", "Credentials from the secret store; the URL without them in config.", evidence=re.sub(r":[^@/]+@", ":***@", s)[:120]))
        if HOST.search(s) and not is_doc and not s.lstrip().startswith(("#", "//", "--")):
            out.append(Finding("CP360-CR-SEC-002", fd.path, n, "a hostname, IP address or cluster route in code.", "Resolve hosts from configuration per environment.", evidence=HOST.search(s).group(0)))
        if not is_doc and ACCOUNT.search(s) and re.search(r"(?i)\b(acct|account|client|ssn|tax_id|tin)\b", s) and not re.search(r"(?i)\b(synthetic|fixture|example|dummy|0{6,}|1234567890)\b", s):
            out.append(Finding("CP360-CR-SEC-003", fd.path, n, "a long number beside an account or client word: client data in the repository.", "Replace with synthetic data and say it is synthetic.", confidence="medium"))
        if fd.path.endswith(PROD_SUFFIX) and not is_test and re.search(r"\b(TODO|FIXME|XXX|HACK)\b", s):
            out.append(Finding("CP360-CR-GEN-002", fd.path, n, f"{re.search(r'(TODO|FIXME|XXX|HACK)', s).group(1)} left in a production file.", "Open the ticket and reference it, or finish the work.", evidence=s[:100]))
    if fd.new_text is not None and len(fd.new_text.encode("utf-8", "ignore")) > 5 * 1024 * 1024:
        out.append(Finding("CP360-CR-GEN-001", fd.path, None, "file over 5 MB.", "Keep data out of the repository; local-data is ignored for a reason."))
    if re.search(r"\.(xlsx|xls|csv|parquet|dat|dmp|zip|7z|pkl|bak)$", fd.path, re.I) and not fd.path.startswith(("sample-artifacts/", "docs/")):
        out.append(Finding("CP360-CR-GEN-001", fd.path, None, "a data or archive file is being committed.", "Data lives in local-data (ignored) or an artefact store, not in Git."))
    return out


def check_set(fds):
    """Across the change: production code changed without any test."""
    out = []
    prod = [f for f in fds if f.kind in ("airflow", "python", "dbt_model") and not any(f"/{d}/" in f"/{f.path}" for d in TEST_DIRS) and not f.path.rsplit("/", 1)[-1].startswith("test_")]
    tests = [f for f in fds if any(f"/{d}/" in f"/{f.path}" for d in TEST_DIRS) or f.path.rsplit("/", 1)[-1].startswith("test_") or f.kind == "dbt_yaml"]
    if prod and not tests:
        out.append(Finding("CP360-CR-OPS-003", prod[0].path, None, f"{len(prod)} production file(s) changed with no test or schema.yml change in the same pull request.", "Add or update the test, or say in the pull request why none applies.", confidence="medium"))
    return out
