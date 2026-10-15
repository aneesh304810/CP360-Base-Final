"""Per-key change history, diffed in Python so no SQL length limit applies."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..config import Settings
from ..sqlfiles import sql
from .ident import ident, idents


@dataclass
class KeyHistory:
    key: str
    rows: int = 0
    real_versions: int = 0
    changes: list[tuple[str, list[str]]] = field(default_factory=list)   # (start_date, changed columns)
    duplicates: int = 0
    tech_by_version: list[dict] = field(default_factory=list)


def diff_versions(rows: list[dict], tracked: list[str], start_col: str = "START_DATE",
                  tech_cols: tuple[str, ...] = ("LOAD_TYPE", "BATCH_ID", "MASTER_IND", "END_DATE")) -> KeyHistory:
    """rows oldest first. A version is 'real' when any tracked column differs from the previous row."""
    h = KeyHistory(key="", rows=len(rows))
    prev = None
    tr = [t.upper() for t in tracked]
    for r in rows:
        ru = {str(k).upper(): v for k, v in r.items()}
        sd = ru.get(start_col.upper())
        sd_s = sd.isoformat()[:10] if hasattr(sd, "isoformat") else str(sd)[:10]
        if prev is None:
            h.real_versions = 1
            h.changes.append((sd_s, ["<first>"]))
        else:
            changed = [c for c in tr if ru.get(c) != prev.get(c)]
            if changed:
                h.real_versions += 1
                h.changes.append((sd_s, changed))
            else:
                h.duplicates += 1
        h.tech_by_version.append({"start_date": sd_s, **{c: ru.get(c) for c in tech_cols if c in ru}})
        prev = ru
    return h


def key_history(run, settings: Settings, table: str, nk: str, sk: str, key_value, tracked: list[str]) -> KeyHistory:
    cols = idents([nk, sk, "START_DATE", "END_DATE"] + tracked)
    extra = [c for c in ("LOAD_TYPE", "BATCH_ID", "MASTER_IND", "LOAD_DATE") if c not in cols]
    text = "\n".join(l for l in sql("key_rows").splitlines() if not l.startswith("--")).format(
        cols=", ".join(cols + extra), schema=ident(settings.schema_name), tbl=ident(table), nk=ident(nk), sk=ident(sk))
    rows = run(text, {"k": key_value})
    h = diff_versions(rows, tracked)
    h.key = str(key_value)
    return h
