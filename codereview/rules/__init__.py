"""Deterministic checks. Each module exposes check(fd) -> list[Finding] for
one kind of file; run_all picks the modules by the file's kind. A Finding
names the rule, the file, the line (new line number, or None for a
file-level finding), the evidence and a fix."""
from __future__ import annotations

from dataclasses import dataclass, asdict, field

from ..standards import BY_ID


@dataclass
class Finding:
    rule: str
    file: str
    line: int | None
    message: str
    fix: str = ""
    evidence: str = ""
    source: str = "rule"                        # rule | copilot | claude
    severity: str = ""
    title: str = ""
    confidence: str = "high"
    extra: dict = field(default_factory=dict)

    def __post_init__(self):
        r = BY_ID.get(self.rule)
        if r:
            self.severity = self.severity or r["sev"]
            self.title = self.title or r["title"]
        self.severity = self.severity or "medium"

    def to_dict(self):
        return asdict(self)


def run_all(fds):
    from . import airflow_rules, dbt_rules, python_rules, sql_rules, general_rules
    out = []
    for fd in fds:
        if fd.binary:
            out.extend(general_rules.check(fd))
            continue
        k = fd.kind
        out.extend(general_rules.check(fd))
        if k == "airflow":
            out.extend(airflow_rules.check(fd)); out.extend(python_rules.check(fd, airflow=True))
        elif k == "python":
            out.extend(python_rules.check(fd))
        elif k in ("dbt_model", "dbt_yaml"):
            out.extend(dbt_rules.check(fd))
        elif k in ("sql", "liquibase"):
            out.extend(sql_rules.check(fd))
    out.extend(general_rules.check_set(fds))
    # one finding per (rule, file, line, message)
    seen, uniq = set(), []
    for f in out:
        key = (f.rule, f.file, f.line, f.message)
        if key in seen:
            continue
        seen.add(key); uniq.append(f)
    return uniq
