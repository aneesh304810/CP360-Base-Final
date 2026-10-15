"""Infer the SCD2 business rules of an existing dimension from its rows.

The column scan (tools/scd2_scan.py) says WHICH columns carry history.
This says HOW they are used -- the rules the old load applied -- by
asking the table itself eleven counting questions:

   1. sentinel        what END value marks the open row
   2. flag vs end     is the current flag consistent with the end date
   3. one open row    does every key have exactly one open version
   4. interval        does the next version start ON the prior end date
                      (closed-open) or the day AFTER (inclusive); gaps;
                      overlaps
   5. same-day        can one key get several versions on one start date
   6. versions        how many versions a key has: max, mean, share > 1
   7. tracked attrs   which columns actually differ between consecutive
                      versions -- the attribute set that opens a version
   8. reactivation    keys closed and later reopened
   9. cadence         versions opened per load date (last 30)
  10. backdating      versions whose start date is older than their load
  11. deletions       keys whose latest version is closed (no successor)

Every query returns COUNTS, or a date, never a business value. Run it
with --print to get the SQL for a DBA, or --run to execute through the
hub's connection (CP_DSN) and print the answers.

    python -m tools.scd2_rules_probe --table DIM_ACCOUNT --sk ACCOUNT_KEY \\
        --nk ACCOUNT_NO --start START_DATE --end END_DATE --flag ACTIVE_IND \\
        --load LOAD_DATE --attrs ACCOUNT_TYPE,BASE_CCY,STATUS_CD --print

The tracked-attribute question needs the candidate columns (--attrs, or
--attrs-from-csv pointing at the scan's input file, in which case every
column except the mechanics is tested, in chunks).
"""
from __future__ import annotations

import argparse
import csv
import os
import sys

MECHANICS = {"sk", "nk", "start", "end", "flag", "load"}


def _ident(x: str) -> str:
    """Only plain identifiers reach the SQL; anything else is refused."""
    import re
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_$#]{0,127}(\.[A-Za-z][A-Za-z0-9_$#]{0,127})?", x or ""):
        raise SystemExit(f"not a plain identifier: {x!r}")
    return x.upper()


def questions(t: str, sk: str, nk: str, start: str, end: str, flag: str | None, load: str | None,
              attrs: list[str], active_value: str = "1") -> list[tuple[str, str]]:
    t, sk, nk, start, end = map(_ident, (t, sk, nk, start, end))
    flag = _ident(flag) if flag else None
    load = _ident(load) if load else None
    attrs = [_ident(a) for a in attrs]
    av = active_value.replace("'", "")
    is_active = f"{flag} = '{av}'" if flag else f"{end} = (SELECT MAX({end}) FROM {t})"

    # consecutive versions of one key, ordered by start date
    pairs = f"""(SELECT {nk} AS nk, {start} AS s, {end} AS e,
                       LEAD({start}) OVER (PARTITION BY {nk} ORDER BY {start}, {sk}) AS next_s,
                       LEAD({end})   OVER (PARTITION BY {nk} ORDER BY {start}, {sk}) AS next_e
                FROM {t})"""
    q = [
        ("1 sentinel: the END value on open rows (top 3)",
         f"SELECT * FROM (SELECT {end} AS end_value, COUNT(*) AS rows_ FROM {t} WHERE {is_active} "
         f"GROUP BY {end} ORDER BY COUNT(*) DESC) WHERE ROWNUM <= 3"),
    ]
    if flag:
        q.append(("2 flag vs end: active rows whose END is not the sentinel / inactive rows whose END is the sentinel",
                  f"SELECT SUM(CASE WHEN {flag} = '{av}' AND {end} <> (SELECT MAX({end}) FROM {t}) THEN 1 ELSE 0 END) AS active_but_closed, "
                  f"SUM(CASE WHEN {flag} <> '{av}' AND {end} = (SELECT MAX({end}) FROM {t}) THEN 1 ELSE 0 END) AS inactive_but_open, "
                  f"COUNT(*) AS rows_ FROM {t}"))
    q += [
        ("3 one open row per key: keys with 0 / 1 / more than 1 active versions",
         f"SELECT SUM(CASE WHEN n = 0 THEN 1 ELSE 0 END) AS keys_none_open, SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS keys_one_open, "
         f"SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS keys_many_open, COUNT(*) AS keys_ FROM "
         f"(SELECT {nk}, SUM(CASE WHEN {is_active} THEN 1 ELSE 0 END) AS n FROM {t} GROUP BY {nk})"),
        ("4 interval convention between consecutive versions: next start = prior end (closed-open) / = prior end + 1 (inclusive) / gap / overlap",
         f"SELECT SUM(CASE WHEN next_s = e THEN 1 ELSE 0 END) AS closed_open, SUM(CASE WHEN next_s = e + 1 THEN 1 ELSE 0 END) AS inclusive, "
         f"SUM(CASE WHEN next_s > e + 1 THEN 1 ELSE 0 END) AS gap, SUM(CASE WHEN next_s < e THEN 1 ELSE 0 END) AS overlap, "
         f"COUNT(next_s) AS pairs FROM {pairs} WHERE next_s IS NOT NULL"),
        ("5 same-day versions: keys with more than one version sharing a start date",
         f"SELECT COUNT(*) AS keys_with_same_day_versions FROM (SELECT {nk}, {start} FROM {t} GROUP BY {nk}, {start} HAVING COUNT(*) > 1)"),
        ("6 versions per key: max, mean, keys with more than one",
         f"SELECT MAX(n) AS max_versions, ROUND(AVG(n), 2) AS mean_versions, SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS keys_versioned, "
         f"COUNT(*) AS keys_ FROM (SELECT {nk}, COUNT(*) AS n FROM {t} GROUP BY {nk})"),
    ]
    # 7 tracked attributes, in chunks of 40 columns
    for i in range(0, len(attrs), 40):
        chunk = attrs[i:i + 40]
        leads = ", ".join(f"LEAD({a}) OVER (PARTITION BY {nk} ORDER BY {start}, {sk}) AS n_{j}" for j, a in enumerate(chunk))
        diffs = ", ".join(f"SUM(CASE WHEN DECODE({a}, n_{j}, 0, 1) = 1 THEN 1 ELSE 0 END) AS {a[:26]}_chg" for j, a in enumerate(chunk))
        q.append((f"7 tracked attributes ({i + 1}-{i + len(chunk)}): consecutive-version pairs where each column changed",
                  f"SELECT COUNT(*) AS pairs, {diffs} FROM (SELECT {', '.join(chunk)}, {leads}, "
                  f"LEAD({sk}) OVER (PARTITION BY {nk} ORDER BY {start}, {sk}) AS has_next FROM {t}) WHERE has_next IS NOT NULL"))
    q.append(("8 reactivation: keys with a closed version followed by a later open one after a gap",
              f"SELECT COUNT(DISTINCT nk) AS keys_reactivated FROM {pairs} WHERE next_s > e + 1"))
    if load:
        q += [
            ("9 cadence: versions opened per load date, last 30 load dates",
             f"SELECT * FROM (SELECT TRUNC({load}) AS load_day, COUNT(*) AS versions_opened FROM {t} GROUP BY TRUNC({load}) ORDER BY 1 DESC) WHERE ROWNUM <= 30"),
            ("10 backdating: versions whose start date is older than their load date by more than 1 day",
             f"SELECT SUM(CASE WHEN {start} < TRUNC({load}) - 1 THEN 1 ELSE 0 END) AS backdated, "
             f"MAX(TRUNC({load}) - {start}) AS max_days_back, COUNT(*) AS rows_ FROM {t}"),
        ]
    q.append(("11 deletions: keys whose latest version is closed (no open successor)",
              f"SELECT COUNT(*) AS keys_ended FROM (SELECT {nk}, MAX(CASE WHEN {is_active} THEN 1 ELSE 0 END) AS any_open FROM {t} GROUP BY {nk}) WHERE any_open = 0"))
    return q


def attrs_from_csv(path: str, table: str, exclude: set[str]) -> list[str]:
    out = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        rd = csv.DictReader(f)
        cols = {c.lower().strip(): c for c in rd.fieldnames or []}
        tc = cols.get("table") or cols.get("table_name") or cols.get("object_name")
        cc = cols.get("column") or cols.get("column_name")
        for r in rd:
            if (r[tc] or "").strip().upper() == table.upper() and (r[cc] or "").strip().upper() not in exclude:
                out.append(r[cc].strip())
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--table", required=True); ap.add_argument("--sk", required=True); ap.add_argument("--nk", required=True)
    ap.add_argument("--start", required=True); ap.add_argument("--end", required=True)
    ap.add_argument("--flag"); ap.add_argument("--active-value", default="1", help="the flag's open value, 1 or Y")
    ap.add_argument("--load"); ap.add_argument("--attrs", default="", help="comma list of candidate tracked columns")
    ap.add_argument("--attrs-from-csv", help="the scan's input CSV; every non-mechanics column of --table is tested")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--print", action="store_true", help="print the SQL for a DBA")
    g.add_argument("--run", action="store_true", help="execute through the hub connection; prints counts")
    a = ap.parse_args(argv)

    attrs = [x.strip() for x in a.attrs.split(",") if x.strip()]
    if a.attrs_from_csv:
        excl = {x.upper() for x in (a.sk, a.nk, a.start, a.end, a.flag or "", a.load or "") if x}
        attrs += attrs_from_csv(a.attrs_from_csv, a.table, excl)
    qs = questions(a.table, a.sk, a.nk, a.start, a.end, a.flag, a.load, attrs, a.active_value)

    if a.print:
        for title, sql in qs:
            print(f"-- {title}\n{sql};\n")
        return 0
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from api.app.db import query  # noqa: E402
    for title, sql in qs:
        print(f"== {title}")
        try:
            for row in query(sql):
                print("   " + "  ".join(f"{k}={v}" for k, v in row.items()))
        except Exception as e:  # one failing question must not hide the rest
            print(f"   failed: {str(e).splitlines()[0][:160]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
