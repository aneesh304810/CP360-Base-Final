"""SDC Client compute sizing reference -> an Event 360 cost base model.

WHAT THIS FILE IS, AND WHY IT REPLACED THE LAST ONE
---------------------------------------------------
The earlier loader assumed the cost of subscribing to events was a message
bill from SEI. It is not. The reference workbook measures WAREHOUSE COMPUTE:
queries, rows, GB scanned and elapsed seconds against SDC views, on a sized
warehouse. That is the read-back -- consumption rule 1 says an event is a
notification and you must fetch the record from the SDC view it names, and
this workbook is the bill for doing so.

So the chain the projection actually runs on is:

    event  ->  the SDC_VIEW it tells you to read
           ->  that view's measured queries / seconds / GB
           ->  warehouse hours  ->  credits  ->  money

THE CONSEQUENCE NOBODY EXPECTS
------------------------------
Cost attaches to the VIEW, not to the event. Twenty events that all name
ACCOUNT_BASIC_VIEW cost about what one of them costs, because the view is
read either way. Adding an event that names a view you already read is close
to free; adding one that names END_OF_DAY_POSITION_DETAIL_VIEW is not. Any
model that divides a total by the number of events will get this backwards,
so this one never does.

WHAT IT REFUSES TO PRETEND
--------------------------
1. Summed query elapsed time is NOT warehouse uptime. A warehouse runs
   queries concurrently and stays up through idle gaps, so the bill can be
   either side of the sum. --concurrency states the ratio you believe and it
   is recorded in the output; the default of 1.0 is an assumption, not a
   measurement, and is labelled as one.
2. Compute does not scale with accounts alone. Reference views (instruments,
   prices, subdivisions) barely move with account count; position and
   transaction views move with holdings and activity. Each view is classified
   by its driver and anything guessed is listed under "assumptions".
3. The three sheets must agree. Per-view rows are summed and reconciled
   against Daily Totals and against Summary. A gap is reported as a
   percentage, never silently absorbed, because a per-view sheet that covers
   only part of the traffic would understate every projection built on it.

USAGE
    python -m tools.sdc_compute_base --explain
    python -m tools.sdc_compute_base "SDC Client compute sizing reference.xlsx" \
        --target-accounts 15000 --credit-price 3.00 --growth-per-quarter 1.0
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
import json
import os
import re
import sys

# The parser lives in the connector. This codebase has been bitten before by a
# second copy of a rule drifting from the first, so there is exactly one reader
# of this workbook and both the database path and this offline path use it.
from ingestion.sdc_compute_conn import (
    SdcComputeConnector, SdcComputeLoadError, CREDITS)

# Which real-world quantity a view's compute follows. Matched in order, first
# hit wins, so the specific patterns come before the general ones.
DRIVERS = [
    (r"POSITION|TAXLOT|TAX_LOT|HOLDING", "positions"),
    (r"TRANSACTION|TRADE|ACTIVITY|SETTLE", "transactions"),
    (r"INSTRUMENT|PRICE|SUBDIVISION|CURRENCY|CLASSIFICATION|CALENDAR",
     "reference"),          # reference data: barely moves with account count
    (r"ACCOUNT|CLIENT|PORTFOLIO|CONTACT|ADDRESS|FEE|PAY_TO|TAX|RMD|SCHD",
     "accounts"),
]


def _driver(view):
    up = view.upper()
    for pat, drv in DRIVERS:
        if re.search(pat, up):
            return drv
    return "accounts"


def build(path, a):
    conn = SdcComputeConnector(path, strict=False, client_code=a.client)
    b = conn.parse()
    period, daily, vrows = b["period"], b["daily"], b["views"]

    # roll the day x view grain up to the period, which is what prices a read
    views = {}
    for r in vrows:
        v = views.setdefault(r["object_name"],
                             {"view": r["object_name"], "queries": 0.0, "rows": 0.0,
                              "gb": 0.0, "sec": 0.0, "days": set()})
        v["queries"] += r["queries"] or 0
        v["rows"] += r["rows_selected"] or 0
        v["gb"] += r["gb_scanned"] or 0
        v["sec"] += r["elapsed_sec"] or 0
        v["days"].add(r["activity_date"])

    ref = {"client": "(withheld)" if a.anonymise else period["client_code"],
           "accounts": a.ref_accounts or period["accounts"],
           "queries": period["sum_queries"], "rows": period["sum_rows"],
           "gb": period["sum_gb"], "sec": period["sum_elapsed_sec"],
           "warehouse": period["warehouse"]}
    daily = [{"date": d["activity_date"].isoformat(), "queries": d["queries"],
              "rows": d["rows_selected"], "gb": d["gb_scanned"],
              "sec": d["elapsed_sec"]} for d in daily]
    period_days = period["period_days"]
    days = [period["first_day"].isoformat(), period["last_day"].isoformat()]

    warn, note = [], []
    vq, vs, vg = period["view_queries"], period["view_elapsed_sec"], period["view_gb"]
    recon = {"per_view": {"queries": vq, "gb": vg, "sec": vs}}
    if period["sum_queries"]:
        recon["summary"] = {"queries": period["sum_queries"], "gb": period["sum_gb"],
                            "sec": period["sum_elapsed_sec"]}
        recon["summary_view_coverage"] = round((period["view_coverage_pct"] or 0) / 100, 4)
    dq = sum(d["queries"] or 0 for d in daily)
    if dq:
        recon["daily_totals"] = {"queries": dq,
                                 "gb": round(sum(d["gb"] or 0 for d in daily), 2),
                                 "sec": round(sum(d["sec"] or 0 for d in daily), 2)}
        recon["daily_totals_view_coverage"] = round(vq / dq, 4)
    cov = period["view_coverage_pct"]
    if cov is not None and cov < 97:
        why = ("it covers only %d of the %d days the Daily Totals sheet reports"
               % (period["view_days"], period["daily_days"])
               if period["daily_days"] and period["view_days"] < period["daily_days"]
               else "it lists only some of the views read")
        warn.append(
            f"the per-view grain is {cov:.0f}% of the Summary query count "
            f"({vq:,.0f} of {period['sum_queries']:,.0f}) because {why}. Every per-view "
            f"figure below is that share of the real traffic, so this projection is a "
            f"FLOOR, not a total")

    # ---- money -------------------------------------------------------------
    wh = (a.warehouse or ref.get("warehouse") or "XS").upper()
    cph = CREDITS.get(wh)
    if cph is None:
        raise SystemExit(f"Unknown warehouse size {wh!r}. Known: {', '.join(CREDITS)}")
    hour_cost = cph * a.credit_price / max(a.concurrency, 1e-9)
    note.append(f"{wh} warehouse = {cph} credit/hour x ${a.credit_price:.2f} per credit"
                f"{'' if a.concurrency == 1 else f', / {a.concurrency} concurrency'}"
                f" = ${hour_cost:.2f} per elapsed hour")
    if a.concurrency == 1.0:
        note.append("concurrency 1.0 is an ASSUMPTION: summed query elapsed time is "
                    "being treated as warehouse uptime. Measure it and set --concurrency")

    # ---- scale to the target ----------------------------------------------
    ra, ta = ref.get("accounts"), a.target_accounts
    if not ra:
        raise SystemExit("The Summary sheet did not give the reference client's "
                         "account count; pass --ref-accounts.")
    ratios = {"accounts": ta / ra,
              "positions": (a.target_positions / a.ref_positions)
                           if a.target_positions and a.ref_positions else None,
              "transactions": (a.target_transactions / a.ref_transactions)
                              if a.target_transactions and a.ref_transactions else None,
              "reference": 1.0}
    assumed = []
    out_views = []
    for v in sorted(views.values(), key=lambda x: -x["sec"]):
        drv = a.driver_of.get(v["view"], _driver(v["view"]))
        f = ratios.get(drv)
        if f is None:
            f = ratios["accounts"]
            assumed.append(f"{v['view']}: {drv} ratio not supplied, scaled on accounts")
        if drv == "reference":
            note_drv = "reference data — does not scale with account count"
        else:
            note_drv = f"scaled on {drv}"
        per_day_sec = v["sec"] / period_days
        out_views.append({
            "view": v["view"], "driver": drv, "scale": round(f, 4),
            "note": note_drv,
            "queries": v["queries"], "rows": v["rows"],
            "gb": round(v["gb"], 4), "sec": round(v["sec"], 2),
            "sec_per_query": round(v["sec"] / v["queries"], 2) if v["queries"] else None,
            "gb_per_query": round(v["gb"] / v["queries"], 4) if v["queries"] else None,
            "share_of_seconds": round(v["sec"] / vs, 4) if vs else 0,
            "cost_per_query": round(v["sec"] / v["queries"] / 3600 * hour_cost, 6)
                              if v["queries"] else None,
            "reference_month_cost": round(v["sec"] / 3600 * hour_cost, 2),
            "projected_month_cost": round(v["sec"] * f / 3600 * hour_cost, 2),
            "projected_sec_per_day": round(per_day_sec * f, 2),
        })

    ref_cost = sum(v["reference_month_cost"] for v in out_views)
    prj_cost = sum(v["projected_month_cost"] for v in out_views)
    gq = a.growth_per_quarter / 100.0
    top = out_views[0] if out_views else None
    if top and top["share_of_seconds"] > 0.25:
        note.append(f"{top['view']} alone is {top['share_of_seconds']:.0%} of all elapsed "
                    f"time — the projection is mostly a statement about that one view")

    return {
        "generated": _dt.date.today().isoformat(),
        "source": {"file": "(withheld)" if a.anonymise else os.path.basename(path),
                   "period_days": period_days,
                   "first_day": days[0], "last_day": days[-1],
                   "view_coverage_pct": cov,
                   "contains_month_end": bool(a.month_end)},
        "reference_client": ref,
        "target": {"accounts": ta, "positions": a.target_positions,
                   "transactions": a.target_transactions},
        "warehouse": {"size": wh, "credits_per_hour": cph,
                      "credit_price": a.credit_price, "concurrency": a.concurrency,
                      "cost_per_elapsed_hour": round(hour_cost, 4)},
        "reconciliation": recon,
        "totals": {"reference_period_cost": round(ref_cost, 2),
                   "projected_period_cost": round(prj_cost, 2),
                   "projected_per_day": round(prj_cost / period_days, 2),
                   "projected_per_30_days": round(prj_cost / period_days * 30, 2),
                   "reference_hours": round(vs / 3600, 2),
                   "projected_hours": round(sum(
                       v["sec"] * v["scale"] for v in out_views) / 3600, 2)},
        "growth": {"per_quarter_pct": a.growth_per_quarter,
                   "per_month_pct": round(((1 + gq) ** (1 / 3) - 1) * 100, 4),
                   "applies_to": "account, position and transaction driven views; "
                                 "reference views are held flat"},
        "daily": daily,
        "views": out_views,
        "assumptions": sorted(set(assumed)),
        "notes": note,
        "warnings": sorted(set(warn)),
    }


def report(m):
    p = print
    s, t, w = m["source"], m["totals"], m["warehouse"]
    p(f"  period           {s['first_day']} .. {s['last_day']}  ({s['period_days']} days)")
    rc = m["reference_client"]
    p(f"  reference client {rc.get('accounts'):,.0f} accounts, "
      f"{rc.get('queries') or 0:,.0f} queries, {rc.get('gb') or 0:,.1f} GB")
    p(f"  warehouse        {w['size']} = {w['credits_per_hour']} credit/h "
      f"x ${w['credit_price']:.2f} -> ${w['cost_per_elapsed_hour']:.2f} per elapsed hour")
    r = m["reconciliation"]
    for k in ("daily_totals", "summary"):
        if k + "_view_coverage" in r:
            p(f"  reconcile        per-view rows cover {r[k+'_view_coverage']:.0%} of {k}")
    p(f"\n  {'view':<44}{'driver':<13}{'sec/query':>10}{'ref $':>10}{'proj $':>10}")
    for v in m["views"][:12]:
        p(f"  {v['view'][:43]:<44}{v['driver']:<13}{(v['sec_per_query'] or 0):>10.1f}"
          f"{v['reference_month_cost']:>10,.2f}{v['projected_month_cost']:>10,.2f}")
    if len(m["views"]) > 12:
        p(f"  ... {len(m['views']) - 12} more views")
    p(f"\n  reference period ${t['reference_period_cost']:,.2f}  "
      f"({t['reference_hours']:,.1f} elapsed hours)")
    p(f"  projected period ${t['projected_period_cost']:,.2f}  "
      f"({t['projected_hours']:,.1f} hours) = ${t['projected_per_30_days']:,.2f} / 30 days")
    p(f"  growth           {m['growth']['per_quarter_pct']}%/quarter "
      f"= {m['growth']['per_month_pct']}%/month")
    for n in m["notes"]:
        p(f"  NOTE             {n}")
    for x in m["assumptions"]:
        p(f"  ASSUMED          {x}")
    for x in m["warnings"]:
        p(f"  WARNING          {x}")
    p("")


EXPLAIN = """
Reads the SDC client compute sizing workbook and writes a cost base model.

  SHEETS IT LOOKS FOR (by name, loosely)
    Summary                 client, # of accounts, totals, WH size
    Daily Totals            ACTIVITY_DATE + per-day totals
    Day_wise_views_queried  ACTIVITY_DATE, OBJECT_NAME, queries, rows, GB, sec
                            ^ this one is the model. Without it there is no
                              per-view grain and no way to price an event.

  THE CHAIN
    event -> the SDC_VIEW it names -> that view's measured seconds per query
          -> warehouse hours -> credits -> money

  SO COST ATTACHES TO THE VIEW, NOT THE EVENT. Twenty events naming
  ACCOUNT_BASIC_VIEW cost roughly what one of them costs. Adding an event
  that names a view you already read is nearly free; adding one that names
  END_OF_DAY_POSITION_DETAIL_VIEW is not.

  WHAT YOU MUST SUPPLY
    --credit-price      $ per credit on your agreement. There is no default
                        worth trusting; the whole answer scales with it.
    --target-accounts   BBH's account count (default 15000)

  WHAT MAKES IT HONEST
    --concurrency       warehouse uptime / summed query elapsed. 1.0 means
                        "I am treating the sum as uptime", which is an
                        assumption and is labelled as one in the output.
    --ref-positions / --target-positions
    --ref-transactions / --target-transactions
                        position and transaction views scale on these, not on
                        accounts. Without them those views fall back to the
                        account ratio and say so.
    --warehouse         override the size if the Summary is wrong
    --month-end         record that the period contains a month end
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?")
    ap.add_argument("--explain", action="store_true")
    ap.add_argument("--credit-price", type=float, default=3.00)
    ap.add_argument("--warehouse")
    ap.add_argument("--client", help="store the reference under this code")
    ap.add_argument("--concurrency", type=float, default=1.0)
    ap.add_argument("--ref-accounts", type=float)
    ap.add_argument("--ref-positions", type=float)
    ap.add_argument("--ref-transactions", type=float)
    ap.add_argument("--target-accounts", type=float, default=15000)
    ap.add_argument("--target-positions", type=float)
    ap.add_argument("--target-transactions", type=float)
    ap.add_argument("--growth-per-quarter", type=float, default=1.0)
    ap.add_argument("--month-end", action="store_true")
    ap.add_argument("--driver", action="append", metavar="VIEW=driver", default=[])
    ap.add_argument("--anonymise", dest="anonymise", action="store_true", default=True)
    ap.add_argument("--keep-names", dest="anonymise", action="store_false")
    ap.add_argument("-o", "--out", default="sample-artifacts/EVENT-360/compute_base.json")
    a = ap.parse_args(argv)
    if a.explain or not a.file:
        print(EXPLAIN)
        return 0
    a.driver_of = dict(kv.split("=", 1) for kv in a.driver)
    if a.ref_accounts:
        FIELDS.setdefault("_", [])
    m = build(a.file, a)
    if a.ref_accounts:
        m["reference_client"]["accounts"] = a.ref_accounts
    report(m)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(m, fh, indent=1)
    print(f"  written          {a.out}"
          + ("   (anonymised — read it before you send it)" if a.anonymise else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
