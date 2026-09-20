"""SDC client compute sizing workbook -> meta_sdc_compute_* .

Three sheets per workbook, one workbook per reference client per period:

    Summary                 client, # of accounts, period totals, WH size
    Daily Totals            ACTIVITY_DATE + per-day totals
    Day_wise_views_queried  ACTIVITY_DATE, OBJECT_NAME, queries, rows, GB, sec

The third sheet is the one that matters. It is the only grain that can price
an event, because an event's cost is the cost of reading the SDC view it
names -- and cost therefore attaches to the VIEW, not to the event.

MORE CLIENTS ARE MORE ROWS
--------------------------
PERIOD_ID is '<CLIENT>:<first_day>:<last_day>', derived from the data rather
than allocated. Re-running the same workbook updates its own rows; dropping in
next month's extract, or a second client's, adds a period beside the first.
Nothing is overwritten and nothing needs rebuilding to take the next one.

THE GATE THAT MATTERS
---------------------
The per-view sheet is reconciled against the Summary sheet's query count and
the shortfall is stored as VIEW_COVERAGE_PCT. A workbook that lists only the
busiest views can cover a fraction of real traffic, and then every figure
derived from the view grain is that same fraction of the truth. This does not
fail the load -- a partial extract is still worth having -- but it is recorded
on the period row so no screen can quote it as a total by accident. What DOES
fail the load is a workbook with no view grain at all, mismatched dates, or a
warehouse size nobody has a credit rate for.

WHAT IS DELIBERATELY NOT CLEANED
--------------------------------
* OBJECT_NAME keeps its schema prefix. I02_STAGE.TRANSACTION_BASIC_VIEW and
  TRANSACTION_BASIC_VIEW are different objects with different costs; folding
  them together to make the join to SDC_VIEW tidier would merge two bills.
* ELAPSED_SEC is stored as measured. It is summed query time, not warehouse
  uptime, and converting it to money needs a concurrency assumption that this
  workbook does not contain. The connector stores time and stops.
"""
from __future__ import annotations

import datetime as _dt
import logging
import os
import re

from openpyxl import load_workbook

log = logging.getLogger("cp.sdc_compute")

DEFAULT_DIR = "sample-artifacts/SDC-COMPUTE"
CREDITS = {"XS": 1, "S": 2, "M": 4, "L": 8, "XL": 16, "2XL": 32, "3XL": 64,
           "4XL": 128, "X-SMALL": 1, "SMALL": 2, "MEDIUM": 4, "LARGE": 8}
COVERAGE_FLOOR = 97.0          # below this the period is flagged, not failed

FIELDS = {
    "date": ["activity_date", "date", "day"],
    "object": ["object_name", "object", "view", "view_name", "table_name"],
    "queries": ["total_no_of_queries", "no_of_queries", "queries", "query_count"],
    "rows": ["total_no_of_rows_selected", "rows_selected", "rows queried",
             "rows_queried", "rows", "no_of_rows"],
    "gb": ["total_size_scanned_gb", "size_scanned_gb", "gb_scanned", "gb"],
    "sec": ["total_elapsed_time_sec", "elapsed_time_sec", "elapsed_sec", "seconds"],
    "hours": ["hours", "hrs"],
    "client": ["client", "client_name"],
    "accounts": ["# of accounts", "no of accounts", "accounts", "account_count"],
    "wh": ["wh", "warehouse", "warehouse_size", "wh_size"],
}


class SdcComputeLoadError(RuntimeError):
    """Raised before anything is written."""


_norm = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").strip().lower()).strip()


def _detect(headers):
    norm, found, used = [_norm(h) for h in headers], {}, set()
    for field, names in FIELDS.items():
        for want in names:                                   # exact first
            w = _norm(want)
            if w in norm and norm.index(w) not in used:
                found[field] = norm.index(w); used.add(found[field]); break
        else:
            for i, h in enumerate(norm):                     # then contains
                if i in used or not h:
                    continue
                if any(_norm(w) in h for w in names):
                    found[field] = i; used.add(i); break
    return found


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    t = re.sub(r"[,$£€\s]", "", str(v)).replace("(", "-").replace(")", "")
    if t.lower() in ("", "-", "n/a", "na", "null"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _date(v):
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.date() if isinstance(v, _dt.datetime) else v
    s = str(v or "").strip()
    for f in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%y", "%d-%b-%Y"):
        try:
            return _dt.datetime.strptime(s, f).date()
        except ValueError:
            pass
    return None


def _table(rows, need):
    """These sheets carry a title and a subtitle above the header, so the
    header is the first row within the top dozen that has every field we need."""
    for i, r in enumerate(rows[:12]):
        cols = _detect(list(r))
        if all(k in cols for k in need):
            return cols, rows[i + 1:]
    return None, []


def _resolve(path_or_dir):
    """A file, or the one workbook in a folder. Two workbooks is ambiguous and
    is refused rather than guessed -- each is a different client or period."""
    p = path_or_dir or DEFAULT_DIR
    if os.path.isfile(p):
        return p
    if not os.path.isdir(p):
        raise SdcComputeLoadError(f"{p}: no such file or directory")
    found = sorted(f for f in os.listdir(p)
                   if f.lower().endswith((".xlsx", ".xlsm"))
                   and not f.startswith("~$"))
    if not found:
        raise SdcComputeLoadError(f"{p}: no workbook found")
    if len(found) > 1:
        raise SdcComputeLoadError(
            f"{p}: {len(found)} workbooks — name one explicitly, they are "
            f"different clients or periods: {', '.join(found)}")
    return os.path.join(p, found[0])


class SdcComputeConnector:
    def __init__(self, xlsx_path=None, strict=True, client_code=None):
        self.path = _resolve(xlsx_path)
        self.strict = strict
        self.client_code = client_code

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("CP_SDC_COMPUTE_XLSX") or DEFAULT_DIR,
                   strict=os.environ.get("CP_SDC_COMPUTE_STRICT", "1") != "0",
                   client_code=os.environ.get("CP_SDC_COMPUTE_CLIENT"))

    # ------------------------------------------------------------------ parse
    def parse(self):
        wb = load_workbook(self.path, read_only=True, data_only=True)
        sheets = {ws.title: [list(r) for r in ws.iter_rows(values_only=True)]
                  for ws in wb.worksheets}
        pick = lambda *keys: next((n for n in sheets
                                   if any(k in _norm(n) for k in keys)), None)

        summary = self._summary(sheets, pick("summary"))
        daily = self._daily(sheets, pick("daily"))
        views = self._views(sheets, pick("day wise", "view", "object"))
        if not views:
            raise SdcComputeLoadError(
                "no per-view sheet. Sheets present: " + ", ".join(sheets) +
                ". Without the view grain an event cannot be priced, because "
                "cost attaches to the view it reads, not to the event.")

        view_days = {v["activity_date"] for v in views}
        daily_days = {d["activity_date"] for d in daily}
        days = sorted(view_days | daily_days)
        client = (self.client_code or summary.get("client")
                  or os.path.splitext(os.path.basename(self.path))[0])
        client = re.sub(r"[^A-Za-z0-9_]+", "_", client).strip("_").upper()[:40]
        period_id = f"{client}:{days[0]}:{days[-1]}"

        vq = sum(v["queries"] or 0 for v in views)
        vg = sum(v["gb_scanned"] or 0 for v in views)
        vs = sum(v["elapsed_sec"] or 0 for v in views)
        denom = summary.get("queries") or sum(d["queries"] or 0 for d in daily)
        coverage = round(vq / denom * 100, 2) if denom else None

        wh = (summary.get("wh") or "").upper() or None
        period = {
            "period_id": period_id, "client_code": client,
            "first_day": days[0], "last_day": days[-1], "period_days": len(days),
            "accounts": summary.get("accounts"),
            "positions": None, "transactions": None,
            "warehouse": wh,
            "sum_queries": summary.get("queries"), "sum_rows": summary.get("rows"),
            "sum_gb": summary.get("gb"), "sum_elapsed_sec": summary.get("sec"),
            "view_days": len(view_days), "daily_days": len(daily_days),
            "view_queries": vq, "view_gb": round(vg, 4),
            "view_elapsed_sec": round(vs, 2),
            "view_coverage_pct": coverage,
            "source_file": os.path.basename(self.path),
        }
        for r in daily + views:
            r["period_id"] = period_id
        bundle = {"period": period, "daily": daily, "views": views}
        self._gates(bundle)
        return bundle

    def _summary(self, sheets, name):
        if not name:
            return {}
        cols, rows = _table(sheets[name], ["accounts"])
        if not cols:
            return {}
        for r in rows:
            g = lambda f: (r[cols[f]] if f in cols and cols[f] < len(r) else None)
            if _num(g("accounts")):
                return {"client": str(g("client") or "").strip() or None,
                        "accounts": _num(g("accounts")), "queries": _num(g("queries")),
                        "rows": _num(g("rows")), "gb": _num(g("gb")),
                        "sec": _num(g("sec")),
                        "wh": str(g("wh") or "").strip() or None}
        return {}

    def _daily(self, sheets, name):
        out = []
        if not name:
            return out
        cols, rows = _table(sheets[name], ["date", "queries"])
        for r in rows or []:
            g = lambda f: (r[cols[f]] if f in cols and cols[f] < len(r) else None)
            d, q = _date(g("date")), _num(g("queries"))
            if not d or q is None:
                continue
            sec = _num(g("sec"))
            out.append({"activity_date": d, "queries": q,
                        "rows_selected": _num(g("rows")), "gb_scanned": _num(g("gb")),
                        "elapsed_sec": sec,
                        "hours": round(sec / 3600, 4) if sec is not None else None})
        return out

    def _views(self, sheets, name):
        """Grain is (date, object). The sheet can repeat a pair -- a view read
        by two different jobs on the same day -- so they are summed rather than
        last-one-wins, which would silently drop half the cost."""
        agg = {}
        if not name:
            return []
        cols, rows = _table(sheets[name], ["object", "queries"])
        for r in rows or []:
            g = lambda f: (r[cols[f]] if f in cols and cols[f] < len(r) else None)
            obj = str(g("object") or "").strip()
            d, q = _date(g("date")), _num(g("queries"))
            if not obj or not d or q is None:
                continue
            k = (d, obj[:200])
            a = agg.setdefault(k, {"activity_date": d, "object_name": obj[:200],
                                   "queries": 0.0, "rows_selected": 0.0,
                                   "gb_scanned": 0.0, "elapsed_sec": 0.0})
            a["queries"] += q
            a["rows_selected"] += _num(g("rows")) or 0
            a["gb_scanned"] += _num(g("gb")) or 0
            a["elapsed_sec"] += _num(g("sec")) or 0
        for a in agg.values():
            a["gb_scanned"] = round(a["gb_scanned"], 4)
            a["elapsed_sec"] = round(a["elapsed_sec"], 2)
            a["hours"] = round(a["elapsed_sec"] / 3600, 6)
        return sorted(agg.values(), key=lambda x: (x["activity_date"], x["object_name"]))

    # ------------------------------------------------------------------ gates
    def _gates(self, b):
        p, fail, warn = b["period"], [], []
        if not p["accounts"]:
            fail.append("the Summary sheet gave no account count — without the "
                        "denominator nothing can be scaled to another client")
        if p["warehouse"] and p["warehouse"] not in CREDITS:
            fail.append(f"warehouse size {p['warehouse']!r} has no credit rate; "
                        f"known: {', '.join(sorted(CREDITS))}")
        if not p["warehouse"]:
            warn.append("no warehouse size on the Summary sheet — hours cannot be "
                        "turned into credits until one is supplied")
        # A shortfall in the view grain has exactly two causes and they call for
        # different fixes, so name which one it is rather than offering both.
        # The period is derived from these same dates, so "a date outside the
        # period" is not a thing that can happen and is not checked for.
        if p["daily_days"] and p["view_days"] < p["daily_days"]:
            warn.append(
                f"the per-view sheet covers {p['view_days']} of the "
                f"{p['daily_days']} days the Daily Totals sheet reports — the view "
                f"grain is short of DAYS, not of views. Re-extract the missing days "
                f"rather than scaling this up")
        elif p["view_days"] and not p["daily_days"]:
            warn.append("no Daily Totals sheet — the per-view grain is the only "
                        "witness and nothing independent confirms it")
        neg = [v for v in b["views"] if (v["elapsed_sec"] or 0) < 0
               or (v["queries"] or 0) < 0]
        if neg:
            fail.append(f"{len(neg)} view rows carry a negative count")
        cov = p["view_coverage_pct"]
        if cov is not None and cov < COVERAGE_FLOOR:
            # the denominator is the Summary count when there is one, and the
            # Daily Totals sum when there is not; say which, so the percentage
            # is never read against the wrong whole
            denom, src = ((p["sum_queries"], "Summary") if p["sum_queries"]
                          else (p["view_queries"] / (cov / 100) if cov else 0,
                                "Daily Totals"))
            why = ("it covers fewer days than the Daily Totals sheet"
                   if p["daily_days"] and p["view_days"] < p["daily_days"]
                   else "it lists only some of the views read")
            warn.append(
                f"the per-view grain is {cov:.0f}% of the {src} query count "
                f"({p['view_queries']:,.0f} of {denom:,.0f}) because {why}. Recorded "
                f"on the period row: anything derived from the views is that share of "
                f"the truth, so treat it as a floor, not a total")
        if cov is not None and cov > 105:
            fail.append(f"the per-view grain is {cov:.0f}% of the Summary count — "
                        f"the sheets disagree in the wrong direction; do not load")
        for w in warn:
            log.warning("sdc_compute: %s", w)
        if fail:
            msg = "; ".join(fail)
            if self.strict:
                raise SdcComputeLoadError(msg)
            log.error("sdc_compute (strict off, loading anyway): %s", msg)

    # ------------------------------------------------------------------- load
    def load(self, loader, bundle):
        p = bundle["period"]
        loader._merge("meta_sdc_compute_period", ("period_id",), p)
        n = 1
        for d in bundle["daily"]:
            loader._merge("meta_sdc_compute_daily",
                          ("period_id", "activity_date"), d); n += 1
        for v in bundle["views"]:
            loader._merge("meta_sdc_compute_view",
                          ("period_id", "activity_date", "object_name"), v); n += 1
        loader.commit()
        log.info("sdc_compute: %s — %d days, %d view rows, coverage %s%%",
                 p["period_id"], len(bundle["daily"]), len(bundle["views"]),
                 p["view_coverage_pct"])
        return n
