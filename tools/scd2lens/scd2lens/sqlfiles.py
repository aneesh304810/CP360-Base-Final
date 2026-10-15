"""Load a query by its `-- id:` header from scd2lens/sql/*.sql."""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

SQL_DIR = Path(__file__).parent / "sql"
_ID = re.compile(r"^--\s*id:\s*(\S+)", re.M)


@lru_cache(maxsize=1)
def _index() -> dict[str, str]:
    out = {}
    for p in sorted(SQL_DIR.glob("*.sql")):
        text = p.read_text()
        m = _ID.search(text)
        if m:
            out[m.group(1)] = text
    return out


def sql(query_id: str) -> str:
    try:
        return _index()[query_id]
    except KeyError as e:
        raise KeyError(f"no SQL file carries -- id: {query_id}") from e


def ids() -> list[str]:
    return sorted(_index())
