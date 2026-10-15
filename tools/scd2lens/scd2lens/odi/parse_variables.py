"""Parse the START / END date variables: which control-date column, per load mode, and the day offset."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalise import normalise_code

_WHEN = re.compile(r"when\s*'[^']*'\s*=\s*'(?P<mode>[A-Z_]+)'\s*then\s*\(?\s*select\s+to_char\s*\(\s*(?P<col>[A-Z_][A-Z0-9_]*)\s*(?P<off>[+-]\s*\d+)?", re.I | re.S)
_ELSE = re.compile(r"else\s*\(?\s*select\s+to_char\s*\(\s*(?P<col>[A-Z_][A-Z0-9_]*)\s*(?P<off>[+-]\s*\d+)?", re.I | re.S)
_FROM = re.compile(r"from\s+([A-Z0-9_$#.]+)", re.I)


@dataclass
class DateVariable:
    name: str
    branches: dict[str, str] = field(default_factory=dict)     # EOD -> PRIOR_BUSINESS_DATE
    offset_days: int = 0
    source_table: str | None = None
    found: bool = False


def parse_date_variable(name: str, refresh_sql: str) -> DateVariable:
    s = normalise_code(refresh_sql)
    v = DateVariable(name=name.upper())
    offsets: list[int] = []
    for m in _WHEN.finditer(s):
        v.branches[m.group("mode").upper()] = m.group("col").upper()
        if m.group("off"):
            offsets.append(int(m.group("off").replace(" ", "")))
        v.found = True
    e = _ELSE.search(s)
    if e:
        v.branches["ELSE"] = e.group("col").upper()
        if e.group("off"):
            offsets.append(int(e.group("off").replace(" ", "")))
        v.found = True
    if "ELSE" in v.branches and "INTRADAY" not in v.branches:
        v.branches["INTRADAY"] = v.branches["ELSE"]
    if offsets:
        v.offset_days = offsets[0]
    f = _FROM.search(s)
    if f:
        v.source_table = f.group(1).upper().split(".")[-1]
    return v
