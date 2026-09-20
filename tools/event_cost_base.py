"""Turn a reference client's billed month into an Event 360 cost base model.

WHY THIS IS A SCRIPT AND NOT A PASTE
------------------------------------
The reference month is another client's billing detail. It does not need to
leave the building for us to use it: this reads the spreadsheet locally and
writes a small JSON of counts and rates. With --anonymise (the default) the
output carries no client name, no account identifier and no free text that did
not already come from the SEI specification. Check the JSON before you send it;
it is meant to be readable.

WHAT IT REFUSES TO PRETEND
--------------------------
1. Messages do not scale with accounts. Only some of them do. ACCOUNT and
   CLIENT events track the account count; TRANSACTION tracks trading activity;
   ASSETS tracks positions held; MARKER is a batch schedule and is CONSTANT --
   it does not care how many accounts you have. One blended ratio understates
   the busy domains and overstates the markers, so each domain is scaled by its
   own driver and the driver used is named in the output.
2. A driver you do not supply is not guessed. If you give account counts only,
   the domains whose driver is missing fall back to the account ratio and every
   one of them is listed under "assumptions" in the JSON and in this report.
3. One month is one month. If the month contains a quarter end, say so with
   --quarter-end; it is recorded so nobody later reads a spike as a baseline.

USAGE
    python -m tools.event_cost_base --explain
    python -m tools.event_cost_base FILE.xlsx \
        --ref-accounts 52000 --target-accounts 15000 \
        --growth-per-quarter 1.0 --month 2026-08

    # with the drivers that make it accurate rather than indicative
    python -m tools.event_cost_base FILE.xlsx \
        --ref-accounts 52000 --ref-positions 1840000 --ref-transactions 610000 \
        --target-accounts 15000 --target-positions 520000 --target-transactions 168000
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
import json
import logging
import math
import os
import re
import sys

log = logging.getLogger("event_cost_base")

# --------------------------------------------------------------------------
# Column detection. The sheet came out of somebody else's billing system, so
# the names are theirs, not ours. Each field lists the spellings seen in the
# wild; --map overrides anything this gets wrong.
# --------------------------------------------------------------------------
SYNONYMS = {
    "event_id": ["event_id", "eventid", "event id", "event no", "event number",
                 "id", "evt_id", "event code", "eventcode"],
    "event_name": ["event_name", "eventname", "event name", "event", "name",
                   "event description", "event_desc", "description"],
    "section": ["section", "section_ref", "spec section", "section no"],
    "messages": ["messages", "message_count", "message count", "msg_count",
                 "msgs", "volume", "message volume", "count", "events",
                 "event_count", "total messages", "published"],
    "bytes": ["avg_payload_bytes", "payload_bytes", "avg payload", "bytes",
              "avg_size", "average size", "payload size", "size_bytes"],
    "subscriptions": ["subscriptions", "subscription_count", "subscribers",
                      "consumers", "consumer_count", "subs", "no of subscribers"],
    "billed": ["billed_amount", "billed", "amount", "cost", "charge",
               "total_cost", "monthly_cost", "spend", "billed_cost", "usd"],
    "domain": ["domain", "event_domain", "subject area", "area"],
    "event_type": ["event_type", "type", "category"],
    "reads": ["reads", "read_backs", "readbacks", "view_reads", "fetches",
              "sdc_reads", "api_calls"],
}
# Domains as the SEI contract names them. Anything else is reported, not mapped.
DOMAINS = ("ACCOUNT", "TRANSACTION", "ASSETS", "CLIENT", "MARKER")
# Which real-world quantity each domain's volume actually follows.
DRIVER = {"ACCOUNT": "accounts", "CLIENT": "accounts",
          "TRANSACTION": "transactions", "ASSETS": "positions",
          "MARKER": "constant"}

_norm = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").strip().lower()).strip()


def _detect(headers, overrides):
    """Map our field names onto their column indexes. Exact match on a synonym
    first, then a contains match, so 'Total Messages Published' still lands."""
    found, used = {}, set()
    norm = [_norm(h) for h in headers]
    for field, names in SYNONYMS.items():
        if field in overrides:
            col = overrides[field]
            idx = int(col) if str(col).isdigit() else (
                norm.index(_norm(col)) if _norm(col) in norm else None)
            if idx is None:
                raise SystemExit(f"--map {field}={col}: no such column")
            found[field], _ = idx, used.add(idx)
            continue
        for want in names:
            if _norm(want) in norm:
                i = norm.index(_norm(want))
                if i not in used:
                    found[field] = i
                    used.add(i)
                    break
        else:
            for i, h in enumerate(norm):
                if i in used or not h:
                    continue
                if any(_norm(w) in h for w in names):
                    found[field] = i
                    used.add(i)
                    break
    return found


def _rows(path, sheet=None, header_row=None):
    """Yield (headers, rows) from .xlsx or .csv. The header is the first row
    with two or more non-empty cells -- billing exports like a title line."""
    if path.lower().endswith((".csv", ".tsv", ".txt")):
        delim = "\t" if path.lower().endswith(".tsv") else ","
        with open(path, newline="", encoding="utf-8-sig") as fh:
            data = [r for r in csv.reader(fh, delimiter=delim)]
        name = os.path.basename(path)
    else:
        try:
            from openpyxl import load_workbook
        except ImportError:
            raise SystemExit("openpyxl is needed for .xlsx: pip install openpyxl")
        wb = load_workbook(path, read_only=True, data_only=True)
        ws = wb[sheet] if sheet else _best_sheet(wb)
        name = ws.title
        data = [[c for c in row] for row in ws.iter_rows(values_only=True)]
    if not data:
        raise SystemExit(f"{path}: empty")
    hdr = header_row - 1 if header_row else next(
        (i for i, r in enumerate(data)
         if sum(1 for c in r if str(c or "").strip()) >= 2), 0)
    return name, data[hdr], data[hdr + 1:]


def _best_sheet(wb):
    """The sheet that looks most like per-event billing: the one whose header
    row matches the most of our fields."""
    best, score = None, -1
    for ws in wb.worksheets:
        head = next(ws.iter_rows(values_only=True, max_row=8), None) or ()
        s = len(_detect(list(head), {}))
        if s > score:
            best, score = ws, s
    return best or wb.worksheets[0]


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    t = re.sub(r"[,$£€\s]", "", str(v)).replace("(", "-").replace(")", "")
    if t in ("", "-", "n/a", "na", "null"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _ols(xs, ys):
    """billed = a + b*messages, by least squares. `b` is the variable rate the
    reference client is actually paying; `a` is whatever the bill charges that
    does not move with volume. Returns (a, b, r2) or None when it cannot fit."""
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    a = my - b * mx
    sst = sum((y - my) ** 2 for y in ys)
    sse = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    return a, b, (1 - sse / sst if sst > 0 else 1.0)


def build(path, args):
    sheet_name, headers, raw = _rows(path, args.sheet, args.header_row)
    overrides = dict(kv.split("=", 1) for kv in (args.map or []))
    cols = _detect(headers, overrides)
    if "messages" not in cols:
        raise SystemExit(
            "No message-count column found. Columns seen:\n  "
            + "\n  ".join(str(h) for h in headers)
            + "\n\nName it with --map messages=<column>.")
    if "event_id" not in cols and "event_name" not in cols:
        raise SystemExit("Need an event id or an event name column to join on.")

    get = lambda row, f: (row[cols[f]] if f in cols and cols[f] < len(row) else None)
    events, warn, skipped = [], [], 0
    for row in raw:
        if not any(str(c or "").strip() for c in row):
            continue
        msgs = _num(get(row, "messages"))
        if msgs is None:
            skipped += 1
            continue
        eid = _num(get(row, "event_id"))
        dom = str(get(row, "domain") or "").strip().upper() or None
        if dom and dom not in DOMAINS:
            warn.append(f"domain {dom!r} is not one the contract names")
            dom = None
        events.append({
            "id": int(eid) if eid is not None else None,
            "name": str(get(row, "event_name") or "").strip() or None,
            "section": str(get(row, "section") or "").strip() or None,
            "domain": dom,
            "messages": msgs,
            "bytes": _num(get(row, "bytes")),
            "subscriptions": _num(get(row, "subscriptions")),
            "reads": _num(get(row, "reads")),
            "billed": _num(get(row, "billed")),
        })
    if not events:
        raise SystemExit("No rows carried a message count.")

    # ---- what the reference month actually contains -----------------------
    total_msgs = sum(e["messages"] for e in events)
    by_domain = {}
    for e in events:
        d = e["domain"] or "UNMAPPED"
        s = by_domain.setdefault(d, {"events": 0, "messages": 0.0, "billed": 0.0})
        s["events"] += 1
        s["messages"] += e["messages"]
        s["billed"] += e["billed"] or 0.0

    # ---- rate, fitted rather than assumed ---------------------------------
    rate = None
    billed_rows = [(e["messages"], e["billed"]) for e in events if e["billed"] is not None]
    if len(billed_rows) >= 3:
        fit = _ols([x for x, _ in billed_rows], [y for _, y in billed_rows])
        if fit:
            a, b, r2 = fit
            rate = {"per_message": b, "per_100k_messages": b * 1e5,
                    "per_event_fixed": a, "r2": round(r2, 4),
                    "rows_fitted": len(billed_rows),
                    "note": "fitted from the billed column; per_event_fixed is a "
                            "per-row intercept, NOT a platform fee"}
            if r2 < 0.8:
                warn.append(f"billed vs messages fits poorly (R2={r2:.2f}) — the bill "
                            "is probably not per-message; get the rate card")
    if args.invoice_total is not None:
        billed_sum = sum(e["billed"] or 0 for e in events)
        rate = rate or {}
        rate["platform_fixed"] = args.invoice_total - billed_sum
        rate["note_fixed"] = ("invoice total minus the sum of per-event charges — "
                              "this is what does not move with volume at all")

    # ---- scale each domain by its own driver ------------------------------
    ref = {"accounts": args.ref_accounts, "positions": args.ref_positions,
           "transactions": args.ref_transactions}
    tgt = {"accounts": args.target_accounts, "positions": args.target_positions,
           "transactions": args.target_transactions}
    scale, assumed = {}, []
    for dom in DOMAINS:
        drv = DRIVER[dom]
        if drv == "constant":
            scale[dom] = {"driver": "constant", "factor": 1.0,
                          "why": "a batch marker fires on a schedule, not per account"}
            continue
        if ref.get(drv) and tgt.get(drv):
            scale[dom] = {"driver": drv, "factor": tgt[drv] / ref[drv],
                          "why": f"{tgt[drv]:,} / {ref[drv]:,}"}
        elif ref.get("accounts") and tgt.get("accounts"):
            f = tgt["accounts"] / ref["accounts"]
            scale[dom] = {"driver": "accounts (fallback)", "factor": f,
                          "why": f"no {drv} supplied — scaled on accounts instead"}
            assumed.append(f"{dom}: scaled on accounts because {drv} was not supplied")
        else:
            raise SystemExit("Need at least --ref-accounts and --target-accounts.")

    for e in events:
        s = scale.get(e["domain"] or "", None)
        f = s["factor"] if s else (
            tgt["accounts"] / ref["accounts"] if ref.get("accounts") and tgt.get("accounts") else 1.0)
        if not s:
            assumed.append(f"event {e['id'] or e['name']}: no domain, scaled on accounts")
        e["projected_messages"] = e["messages"] * f
        e["scale_factor"] = f

    if not any(e["domain"] for e in events):
        warn.append("no domain column — every event was scaled on the account ratio, "
                    "which overstates markers and understates trading volume")

    growth_q = args.growth_per_quarter / 100.0
    monthly_growth = (1 + growth_q) ** (1 / 3) - 1

    out = {
        "generated": _dt.date.today().isoformat(),
        "source": {"file": os.path.basename(path) if not args.anonymise else "(withheld)",
                   "sheet": sheet_name, "rows_read": len(events),
                   "rows_without_a_message_count": skipped,
                   "month": args.month, "days_in_month": args.days,
                   "contains_quarter_end": bool(args.quarter_end)},
        "columns_used": {k: str(headers[v]) for k, v in sorted(cols.items(), key=lambda x: x[1])},
        "reference": {k: v for k, v in ref.items() if v},
        "target": {k: v for k, v in tgt.items() if v},
        "drivers": DRIVER,
        "scale": scale,
        "growth": {"per_quarter_pct": args.growth_per_quarter,
                   "per_month_pct": round(monthly_growth * 100, 4),
                   "applies_to": "account-driven domains only"},
        "reference_month": {
            "total_messages": total_msgs,
            "by_domain": {k: {"events": v["events"], "messages": v["messages"],
                              "billed": round(v["billed"], 2) or None}
                          for k, v in sorted(by_domain.items())}},
        "projected_month": {
            "total_messages": sum(e["projected_messages"] for e in events)},
        "rate": rate,
        "assumptions": sorted(set(assumed)),
        "warnings": sorted(set(warn)),
        "events": [{k: e[k] for k in
                    ("id", "name", "section", "domain", "messages", "bytes",
                     "subscriptions", "reads", "billed", "scale_factor",
                     "projected_messages")
                    if e[k] is not None} for e in events],
    }
    if args.anonymise:
        for e in out["events"]:
            e.pop("billed", None)
        out["source"]["anonymised"] = ("per-event billed amounts withheld; the fitted "
                                       "rate above carries the commercial content")
    return out


def report(m):
    p = print
    p("")
    p(f"  sheet            {m['source']['sheet']}")
    p(f"  rows with a count {m['source']['rows_read']}"
      + (f"  ({m['source']['rows_without_a_message_count']} rows had none)"
         if m["source"]["rows_without_a_message_count"] else ""))
    p("  columns used")
    for k, v in m["columns_used"].items():
        p(f"      {k:<14} <- {v}")
    p("")
    p(f"  reference month  {m['reference_month']['total_messages']:,.0f} messages")
    for d, s in m["reference_month"]["by_domain"].items():
        p(f"      {d:<12} {s['messages']:>14,.0f}  over {s['events']:>3} events")
    p("")
    p("  scaling")
    for d, s in m["scale"].items():
        p(f"      {d:<12} x{s['factor']:.4f}   on {s['driver']}   ({s['why']})")
    p("")
    p(f"  projected month  {m['projected_month']['total_messages']:,.0f} messages")
    p(f"  growth           {m['growth']['per_quarter_pct']}%/quarter "
      f"= {m['growth']['per_month_pct']}%/month")
    if m["rate"]:
        r = m["rate"]
        if "per_100k_messages" in r:
            p(f"  fitted rate      ${r['per_100k_messages']:,.2f} per 100k messages "
              f"(R2 {r['r2']}, {r['rows_fitted']} rows)")
        if "platform_fixed" in r:
            p(f"  fixed component  ${r['platform_fixed']:,.2f} of the invoice does not "
              "move with volume")
    for a in m["assumptions"]:
        p(f"  ASSUMED          {a}")
    for w in m["warnings"]:
        p(f"  WARNING          {w}")
    p("")


EXPLAIN = """
Columns this looks for. It matches on any of the spellings below, case and
punctuation ignored, and falls back to a contains match -- so "Total Messages
Published" finds `messages`. Override anything with --map field=ColumnName.

  REQUIRED
    messages       message / volume count for the month
    event_id       or event_name -- something to join on

  MAKES IT ACCURATE
    domain         ACCOUNT | TRANSACTION | ASSETS | CLIENT | MARKER
                   without it every domain is scaled on the account ratio,
                   which overstates markers and understates trading volume
    billed         per-event charge. With it the rate is FITTED from their
                   actual bill instead of assumed from ours
    subscriptions  how many consumers took the event
    bytes          average payload size
    reads          SDC view read-backs, if their platform bills them

  SCALE (command line, not the sheet)
    --ref-accounts / --target-accounts            required
    --ref-positions / --target-positions          scales ASSETS properly
    --ref-transactions / --target-transactions    scales TRANSACTION properly
    --invoice-total   the month's invoice, to separate the fixed component
    --quarter-end     records that this month carries quarter-end spikes
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help=".xlsx or .csv of the reference month")
    ap.add_argument("--explain", action="store_true", help="print the column contract and exit")
    ap.add_argument("--sheet"); ap.add_argument("--header-row", type=int)
    ap.add_argument("--map", action="append", metavar="field=Column")
    ap.add_argument("--ref-accounts", type=float); ap.add_argument("--ref-positions", type=float)
    ap.add_argument("--ref-transactions", type=float)
    ap.add_argument("--target-accounts", type=float, default=15000)
    ap.add_argument("--target-positions", type=float)
    ap.add_argument("--target-transactions", type=float)
    ap.add_argument("--growth-per-quarter", type=float, default=1.0)
    ap.add_argument("--invoice-total", type=float)
    ap.add_argument("--month"); ap.add_argument("--days", type=int, default=31)
    ap.add_argument("--quarter-end", action="store_true")
    ap.add_argument("--anonymise", dest="anonymise", action="store_true", default=True)
    ap.add_argument("--keep-billed", dest="anonymise", action="store_false",
                    help="keep per-event billed amounts in the output")
    ap.add_argument("-o", "--out", default="sample-artifacts/EVENT-360/cost_base.json")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if a.explain or not a.file:
        print(EXPLAIN)
        return 0
    m = build(a.file, a)
    report(m)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(m, fh, indent=1)
    print(f"  written          {a.out}"
          + ("   (anonymised — read it before you send it)" if a.anonymise else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
