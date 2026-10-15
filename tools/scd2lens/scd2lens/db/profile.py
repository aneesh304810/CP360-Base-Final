"""Runtime profile of one table: duplicates, windows, open rows, flag, freshness.

Every query is built from a file in sql/ by its id, with identifiers
validated and values bound. `run` is any callable (sql, binds) -> rows, so
the tests pass a fake and the CLI passes the real Runner.
"""
from __future__ import annotations

from datetime import date, datetime

from ..config import Settings
from ..sqlfiles import sql
from .hashexpr import hash_expr
from .ident import ident, idents


def _since(settings: Settings) -> tuple[str, dict]:
    if settings.db_sample_since:
        return " AND start_date >= :since", {"since": datetime.fromisoformat(settings.db_sample_since)}
    return "", {}


def _nk_parts(nk: list[str], part: list[str]) -> dict:
    nk, part = idents(nk), idents(part)
    return {
        "nk": ", ".join(nk),
        "nk_select": ", ".join(nk) + ", ",
        "nk_concat": " || '|' || ".join(f"TO_CHAR({c})" for c in nk) if len(nk) > 1 else nk[0],
        "part_select": (", ".join(part) + ", ") if part else "",
        "part_by": (", " + ", ".join(part)) if part else "",
    }


def _strip_header(text: str) -> str:
    return "\n".join(l for l in text.splitlines() if not l.startswith("--")).strip()


def base_view(settings: Settings, table: str, nk: list[str], part: list[str], tracked: list[dict]) -> tuple[str, dict]:
    since, binds = _since(settings)
    f = _nk_parts(nk, part)
    text = _strip_header(sql("base_hash")).format(schema=ident(settings.schema_name), tbl=ident(table), since_clause=since,
                                   hash_expr=hash_expr(tracked, settings.hash_chunk_size), **f)
    return text, binds


def dup_checks(run, settings: Settings, table: str, nk: list[str], part: list[str], tracked: list[dict], top_n: int = 10) -> dict:
    base, binds = base_view(settings, table, nk, part, tracked)
    base = _strip_header(base)
    f = _nk_parts(nk, part)
    out = {}
    out["dup_summary"] = (run(_strip_header(sql("dup_summary")).format(base=base, **f), binds) or [{}])[0]
    out["dup_by_month"] = run(_strip_header(sql("dup_by_month")).format(base=base, **f), binds)
    out["top_keys"] = run(_strip_header(sql("top_keys")).format(base=base, **f), {**binds, "n": top_n})
    return out


def window_checks(run, settings: Settings, table: str, nk: list[str], part: list[str], offset_days: int = 1) -> dict:
    since, binds = _since(settings)
    f = _nk_parts(nk, part)
    sch, tbl = ident(settings.schema_name), ident(table)
    out = {}
    out["windows"] = (run(_strip_header(sql("windows_gap_overlap")).format(schema=sch, tbl=tbl, since_clause=since, **f),
                          {**binds, "offset": offset_days}) or [{}])[0]
    out["open_rows"] = (run(_strip_header(sql("multiple_open_rows")).format(schema=sch, tbl=tbl, **f), {}) or [{}])[0]
    return out


def flag_check(run, settings: Settings, table: str) -> dict:
    return (run(_strip_header(sql("active_ind_consistency")).format(schema=ident(settings.schema_name), tbl=ident(table)), {}) or [{}])[0]


def freshness(run, settings: Settings, table: str) -> dict:
    sch, tbl = ident(settings.schema_name), ident(table)
    f = (run(_strip_header(sql("freshness")).format(schema=sch, tbl=tbl), {}) or [{}])[0]
    try:
        ctl = (run(_strip_header(sql("control_dates")).format(schema=sch), {}) or [{}])[0]
    except Exception:
        ctl = {}
    out = {**f, "control": ctl, "alert": None}
    cur = ctl.get("current_business_date")
    mx = f.get("max_start")
    if cur and mx:
        gap = (_d(cur) - _d(mx)).days
        out["gap_days"] = gap
        if gap > settings.freshness_alert_days:
            out["alert"] = f"latest version is {gap} days behind the control date"
    return out


def volume_drop(by_month: list[dict], window: int = 12, drop_pct: float = 80.0) -> list[str]:
    """Months whose new-version count is more than drop_pct below the trailing median."""
    alerts = []
    vals = [(r["month"], float(r.get("versions") or 0)) for r in by_month]
    for i in range(1, len(vals)):
        prior = sorted(v for _, v in vals[max(0, i - window):i])
        if len(prior) < 3:
            continue
        med = prior[len(prior) // 2]
        if med > 0 and vals[i][1] < med * (1 - drop_pct / 100):
            alerts.append(f"{vals[i][0]}: {int(vals[i][1])} versions vs trailing median {int(med)}")
    return alerts


def _d(x) -> date:
    if isinstance(x, datetime):
        return x.date()
    if isinstance(x, date):
        return x
    return datetime.fromisoformat(str(x)[:10]).date()
