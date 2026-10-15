"""SCD1 overrides: procedures that MERGE into the open row and update named columns in place."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalise import normalise_code

_SET = re.compile(r"when\s+matched\s+then\s+update\s+set\s+(?P<set>.+?)(?:\s+when\s+not\s+matched|\s+where\s|\s*;|\s*$)", re.I | re.S)
_OPEN = re.compile(r"end_date\s+is\s+null", re.I)
_USING = re.compile(r"using\s*\(?\s*select\s+.+?\s+from\s+([A-Z0-9_$#.]+)", re.I | re.S)


@dataclass
class Scd1Parse:
    found: bool = False
    columns: list[str] = field(default_factory=list)
    on_open_row: bool = False
    source_table: str | None = None


def parse_scd1(code: str) -> Scd1Parse:
    s = normalise_code(code)
    m = _SET.search(s)
    if not m or not re.search(r"merge\s+into", s, re.I):
        return Scd1Parse()
    p = Scd1Parse(found=True, on_open_row=bool(_OPEN.search(s)))
    for item in m.group("set").split(","):
        left = item.split("=")[0].strip().split(".")[-1].upper()
        if re.fullmatch(r"[A-Z_][A-Z0-9_$#]*", left):
            p.columns.append(left)
    u = _USING.search(s)
    if u:
        p.source_table = u.group(1).upper().split(".")[-1]
    return p
