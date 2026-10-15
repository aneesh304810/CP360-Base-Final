"""Only validated identifiers reach SQL text; every value is a bind."""
from __future__ import annotations

import re

_ID = re.compile(r"^[A-Z][A-Z0-9_$#]{0,127}$")


def ident(x: str) -> str:
    u = (x or "").strip().upper()
    if not _ID.match(u):
        raise ValueError(f"not a valid identifier: {x!r}")
    return u


def idents(xs: list[str]) -> list[str]:
    return [ident(x) for x in xs]
