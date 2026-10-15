"""Parse the MERGE an IKM issues: ON keys, WHEN MATCHED updates, inserts."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalise import is_truncated, normalise_code

_MERGE = re.compile(
    r"merge\s+into\s+(?P<target>\S+)(?:\s+(?:as\s+)?(?P<talias>[A-Z_][A-Z0-9_]*))?\s+using\s+(?P<source>.+?)\s+(?:as\s+)?(?P<salias>[A-Z_][A-Z0-9_]*)\s+on\s*\((?P<on>.+?)\)\s*when\s+(?P<first>not\s+)?matched",
    re.I | re.S)
_SET = re.compile(r"when\s+matched\s+then\s+update\s+set\s+(?P<set>.+?)(?:\s+when\s+not\s+matched|\s*;|\s*$)", re.I | re.S)
_NOTM = re.compile(r"when\s+not\s+matched\s+then\s+insert", re.I)
_EQ = re.compile(r"(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)\s*=\s*(?:[A-Z_][A-Z0-9_]*\.)?([A-Z_][A-Z0-9_$#]*)", re.I)
_DATE_LIKE = re.compile(r"(DATE|_DT$|_TS$|_TSP$|TIMESTAMP)", re.I)


@dataclass
class MergeParse:
    found: bool = False
    status: str = "PROVEN"            # PROVEN | UNKNOWN_TRUNCATED | ABSENT
    target: str = ""
    on_keys: list[str] = field(default_factory=list)
    version_key: list[str] = field(default_factory=list)
    natural_key: list[str] = field(default_factory=list)
    update_set: list[str] = field(default_factory=list)
    inserts: bool = False


def parse_merge(code: str, code_chars: int | None = None, valid_from: str | None = None) -> MergeParse:
    s = normalise_code(code)
    m = _MERGE.search(s)
    if not m:
        return MergeParse(found=False, status="UNKNOWN_TRUNCATED" if is_truncated(code, code_chars) else "ABSENT")
    p = MergeParse(found=True, target=m.group("target").strip().upper())
    on = m.group("on")
    keys: list[str] = []
    for part in re.split(r"\s+and\s+", on, flags=re.I):
        e = _EQ.search(part)
        if e and e.group(1).upper() == e.group(2).upper():
            keys.append(e.group(1).upper())
        elif e:
            keys.append(e.group(1).upper())
    p.on_keys = keys
    p.version_key = list(keys)
    vf = (valid_from or "").upper()
    p.natural_key = [k for k in keys if k != vf and not (not vf and _DATE_LIKE.search(k))]
    sm = _SET.search(s)
    if sm:
        cols = []
        for item in sm.group("set").split(","):
            left = item.split("=")[0].strip()
            left = left.split(".")[-1].strip().upper()
            if re.fullmatch(r"[A-Z_][A-Z0-9_$#]*", left):
                cols.append(left)
        p.update_set = cols
    p.inserts = bool(_NOTM.search(s))
    return p
