"""Strip ODI substitution tokens so SQL regexes see plain SQL.

  <?= odiRef.getObjectName("L", "DIM_ACCOUNT", "PBDWAPP", "D") ?>  -> DIM_ACCOUNT
  #PBDW_STAGING_1.V_PBDW_END_DATE_NEW / #V_X                      -> :V_PBDW_END_DATE_NEW
  <%= ... %> / <$= ... $>                                          -> removed
Whitespace collapses to single spaces. Case is preserved; parsers match
case-insensitively.
"""
from __future__ import annotations

import re

_OBJ = re.compile(r'<\?=\s*odiRef\.getObjectName\(\s*"[A-Z]"\s*,\s*"([A-Za-z0-9_$#]+)"[^?]*\?>', re.I)
_OBJ2 = re.compile(r'<%=\s*odiRef\.getObjectName\(\s*"[A-Z]"\s*,\s*"([A-Za-z0-9_$#]+)"[^%]*%>', re.I)
_VAR = re.compile(r"#(?:[A-Za-z0-9_$]+\.)?(V_[A-Za-z0-9_]+)")
_OTHER = re.compile(r"<[?%$]=?.*?[?%$]>", re.S)
_WS = re.compile(r"\s+")
VAR_REFS = re.compile(r":(V_[A-Z0-9_]+)", re.I)


def normalise_code(code: str | None) -> str:
    s = code or ""
    s = _OBJ.sub(r"\1", s)
    s = _OBJ2.sub(r"\1", s)
    s = _VAR.sub(r":\1", s)
    s = _OTHER.sub(" ", s)
    return _WS.sub(" ", s).strip()


def variables_in(code: str) -> list[str]:
    return sorted({m.group(1).upper() for m in VAR_REFS.finditer(normalise_code(code))})


def is_truncated(code_preview: str | None, code_chars: int | None) -> bool:
    return bool(code_chars) and int(code_chars) > len(code_preview or "")
