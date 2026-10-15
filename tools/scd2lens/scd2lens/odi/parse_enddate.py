"""Parse an end-date procedure: what it sets, and the predicates that decide which open rows close."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalise import is_truncated, normalise_code, variables_in

_UPDATE = re.compile(r"update\s+(?P<table>[A-Z0-9_$#.]+)(?:\s+(?P<alias>[A-Z_][A-Z0-9_]*))?\s+set\s+(?P<set>.+?)\s+where\s+(?P<where>.+?)(?:;|$)", re.I | re.S)
_ASSIGN = re.compile(r"(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s*=\s*(.+)", re.I | re.S)
_IN_SUB = re.compile(r"(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s+in\s*\(\s*select\s+(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s+from\s+([A-Z0-9_$#.]+)", re.I | re.S)
_EQ_LIT = re.compile(r"(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s*=\s*'([^']*)'", re.I)
_IS_NULL = re.compile(r"(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s+is\s+(not\s+)?null", re.I)
_BATCH_EQ = re.compile(r"batch_id\s*=\s*:V_[A-Z0-9_]*BATCH_ID", re.I)
_BATCH_NE = re.compile(r"batch_id\s*(?:<>|!=|not\s+in)", re.I)


@dataclass
class EndDateParse:
    found: bool = False
    status: str = "PROVEN"
    table: str = ""
    sets: dict[str, str] = field(default_factory=dict)
    natural_key: str | None = None
    source_table: str | None = None
    filters: dict[str, str] = field(default_factory=dict)       # MASTER_IND -> 'N'
    end_is_null: bool = False
    start_not_null: bool = False
    batch_trigger: bool = False
    excludes_current_batch: bool = False
    sets_active_ind: bool = False
    variables: list[str] = field(default_factory=list)
    predicates: list[str] = field(default_factory=list)


def _split_set(s: str) -> list[str]:
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def parse_enddate(code: str, code_chars: int | None = None) -> EndDateParse:
    s = normalise_code(code)
    m = _UPDATE.search(s)
    if not m or "END_DATE" not in m.group("set").upper():
        return EndDateParse(found=False, status="UNKNOWN_TRUNCATED" if is_truncated(code, code_chars) else "ABSENT")
    p = EndDateParse(found=True, table=m.group("table").upper().split(".")[-1])
    for item in _split_set(m.group("set")):
        a = _ASSIGN.match(item.strip())
        if a:
            p.sets[a.group(1).upper()] = a.group(2).strip()
    p.sets_active_ind = "ACTIVE_IND" in p.sets
    w = m.group("where")
    p.predicates = [x.strip() for x in re.split(r"\s+and\s+", w, flags=re.I)]
    sub = _IN_SUB.search(w)
    if sub:
        p.natural_key = sub.group(1).upper()
        p.source_table = sub.group(3).upper().split(".")[-1]
    for lit in _EQ_LIT.finditer(w):
        p.filters[lit.group(1).upper()] = lit.group(2)
    for n in _IS_NULL.finditer(w):
        col, neg = n.group(1).upper(), bool(n.group(2))
        if col == "END_DATE" and not neg:
            p.end_is_null = True
        if col == "START_DATE" and neg:
            p.start_not_null = True
    p.batch_trigger = bool(_BATCH_EQ.search(w))
    p.excludes_current_batch = bool(_BATCH_NE.search(w))
    p.variables = variables_in(code)
    return p
