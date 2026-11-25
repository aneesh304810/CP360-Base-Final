"""SQL file and Liquibase rules: rollback blocks, idempotent DDL, column lists."""
from __future__ import annotations

import re

from . import Finding


def check(fd):
    out = []
    lines = fd.new_lines() if fd.new_text is not None else dict(fd.added)
    text = "\n".join(t for _, t in sorted(lines.items()))
    low = text.lower()
    if fd.kind == "liquibase":
        if "changeset" in low and "rollback" not in low:
            out.append(Finding("CP360-CR-SQL-001", fd.path, _line_of(lines, "changeset"), "changeset without a rollback block.", "Add the rollback (the reverse DDL, or `empty` with the reason) so the release can roll back to the previous tag."))
        for n, t in sorted(lines.items()):
            if re.search(r"\b(drop\s+(table|column)|truncate\s+table|alter\s+table\s+\w+\s+drop)\b", t, re.I):
                out.append(Finding("CP360-CR-SQL-001", fd.path, n, "destructive change in a changeset: a drop goes in a later contract release after the expand release.", "Expand now; drop in a release after every consumer has moved.", evidence=t.strip()[:120]))
        return out
    # hand-applied SQL files
    if re.search(r"^\s*create\s+(table|index|unique\s+index)\b", low, re.M) and "-955" not in low and "e_exists" not in low:
        out.append(Finding("CP360-CR-SQL-002", fd.path, _line_of(lines, "CREATE"), "CREATE without the ORA-955 guard: re-applying the file fails.", "Wrap it in the DECLARE e_exists ... EXCEPTION WHEN e_exists THEN NULL block the other sql/ files use."))
    if re.search(r"^\s*alter\s+table\s+\w+\s+add\b", low, re.M) and "-1430" not in low and "e_dup" not in low:
        out.append(Finding("CP360-CR-SQL-002", fd.path, _line_of(lines, "ALTER"), "ALTER TABLE ADD without the ORA-1430 guard.", "Guard with PRAGMA EXCEPTION_INIT(e_dup, -1430)."))
    for n, t in sorted(lines.items()):
        s = t.strip()
        if re.search(r"\binsert\s+into\s+\w+\s+values\b", s, re.I):
            out.append(Finding("CP360-CR-SQL-004", fd.path, n, "INSERT without a column list.", "Name the columns.", evidence=s[:120]))
        if re.search(r"\bdrop\s+table\b", s, re.I) and "purge" not in s.lower() and "if exists" not in s.lower():
            out.append(Finding("CP360-CR-SQL-001", fd.path, n, "DROP TABLE in a release file.", "Contract in a later release, after the expand release and consumer migration.", evidence=s[:120]))
        if re.search(r"\bupdate\s+\w+\s+set\b", s, re.I) and re.search(r"\b(dim_|fct_|fact_|hist|_v\d|gold|pregold)", s, re.I) and "is_current" not in s.lower():
            out.append(Finding("CP360-CR-SQL-005", fd.path, n, "UPDATE of a data column on a versioned table.", "Insert the new version and flip is_current.", evidence=s[:120], confidence="medium"))
    return out


def _line_of(lines, needle):
    for n, t in sorted(lines.items()):
        if needle.lower() in t.lower():
            return n
    return min(lines) if lines else None
