"""Diagnostic: profile legacy_lineage so the grouping can be chosen from FACTS.

WHY THIS EXISTS

The source-first L0 screen rendered one bucket reading "Unassigned — 0% — 0 of
177 tables mapped · 6100 fields". Two fixes were made blind, from screenshots:
group by functional_group instead of master, and widen the mapped predicate.
Neither worked, because both rested on a guess about what is actually in the
table. "Unassigned" is the literal NVL(functional_group, 'Unassigned') emits,
which points at functional_group being NULL on every row — but pointing is not
knowing, and the next guess would be as cheap and as wrong.

So stop guessing. This endpoint reads the table's own shape out of the database
catalogue and profiles it: which columns exist, how many rows, how many NULLs
and distinct values per column, the top values of every low-cardinality column,
and three whole sample rows. From that, the grouping spine is a reading, not a
hypothesis — `candidate_spines` ranks the columns that could actually carry it.

IT REPORTS ERRORS INSTEAD OF SWALLOWING THEM

Every other router here goes through _safe, which turns a failed query into []
so a screen degrades instead of 500ing. That is right for a screen and useless
for a diagnostic: a silent [] is precisely how a missing column turned into
"0 of 177 mapped" rather than into an error anyone could read. So _try keeps
the driver's message — ORA-00904 naming the column is the single most useful
line this endpoint can return.

READ-ONLY AND SELF-CONSTRUCTED

Nothing here takes SQL, a column name or a table name from the caller. The only
identifiers interpolated are ones read back from the database catalogue, and
each is re-checked against _IDENT before it is used. Every statement is a
SELECT.

DIALECT AND SCHEMA

Oracle first (ALL_TAB_COLUMNS, ROWNUM), then information_schema + LIMIT.

ALL_*, not USER_*. The catalogue tables live in schema SILVER, and USER_TAB_
COLUMNS only lists what the CONNECTING user owns — so on any connection that
is not SILVER itself (a reader account reaching the tables through grants or
synonyms, which is the normal shape for a read-only API) the first version of
this endpoint reported every table as non-existent. That is a diagnostic
reporting the diagnosis wrongly. The owner is resolved from ALL_TABLES and
reported in the response, and each query is qualified with it.
"""
from __future__ import annotations
import logging
import re as _re
from fastapi import APIRouter

from .db import query

log = logging.getLogger("cp.api.legacy_profile")
router = APIRouter(prefix="/legacy-lineage", tags=["legacy-lineage"])

# Only ever matched against names read back from the catalogue, never a caller.
_IDENT = _re.compile(r"^[A-Za-z][A-Za-z0-9_$#]{0,127}$")

# Tables worth profiling, in the order the screens depend on them.
_TABLES = ("LEGACY_LINEAGE", "LEGACY_DICTIONARY", "LEGACY_TABLE_DEPENDENCY")

# A column can only be a grouping spine if it splits the files into a readable
# number of buckets. One bucket is the bug being chased; hundreds is a list.
_SPINE_MIN, _SPINE_MAX = 2, 80

# The comfortable range for a screen's top level: enough buckets to be worth
# grouping, few enough to read without scrolling.
_SPINE_IDEAL = (3, 40)

# Columns that pass the cardinality test and still cannot be the spine, because
# of the job they already do. Without this the profiler recommends DATA_SOURCE
# (the warehouse selector the screens already filter by, so grouping by it
# yields one bucket per page) or LINEAGE_STATUS (the measure the coverage bars
# are computed FROM — grouping by it would put every unmapped field in its own
# bucket and report each as 0% mapped, which is the original symptom wearing a
# different hat).
_NOT_SPINE = (
    (_re.compile(r"^(DATA_SOURCE|LINEAGE_STATUS)$"),
     "already used as a filter/measure by the screens"),
    (_re.compile(r"_(COLUMN|TYPE|LENGTH|TRANSFORM)$"),
     "field-level attribute, not a grouping"),
    (_re.compile(r"(^|_)(ID|KEY|LINEAGE_ID|UD_KEY)$"),
     "identity column"),
    (_re.compile(r"^(IS_|HAS_)"), "boolean flag"),
    (_re.compile(r"(CREATED|UPDATED|LOAD|_DT|_DATE|_TS)$"), "load metadata"),
)


def _spine_block(col: str) -> str | None:
    for rx, why in _NOT_SPINE:
        if rx.search(col):
            return why
    return None

# Long text (a transform expression, a description) is noise in a sample row.
_TRUNC = 160


def _try(sql: str, params: dict | None = None, limit: int | None = None):
    """Run a SELECT, keeping the error text when it fails. The message is the
    point: 'ORA-00904: "FUNCTIONAL_GROUP": invalid identifier' answers in one
    line what a silent [] hides for a week."""
    try:
        rows = query(sql, params or {})
        return (rows[:limit] if limit else rows), None
    except Exception as exc:                                  # noqa: BLE001
        return [], f"{type(exc).__name__}: {exc}"


def _clip(v):
    if isinstance(v, str) and len(v) > _TRUNC:
        return v[:_TRUNC] + f"…(+{len(v) - _TRUNC} chars)"
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def _owner_of(table: str) -> tuple[str | None, str | None]:
    """Which schema actually holds this table, as seen from this connection.

    Prefer the connecting user's own schema when it has one, so a local copy
    wins over a granted one; otherwise take the single visible owner. Returns
    (owner, note) — note explains an ambiguous or missing result.
    """
    rows, err = _try("""SELECT owner FROM all_tables WHERE table_name = :t
                        ORDER BY owner""", {"t": table})
    if err:
        return None, f"all_tables: {err}"
    owners = [r["owner"] for r in rows if r.get("owner")]
    if not owners:
        return None, "no visible owner in all_tables"
    if len(owners) == 1:
        return owners[0], None
    me, _ = _try("SELECT USER AS u FROM dual")
    mine = me[0]["u"] if me else None
    if mine in owners:
        return mine, f"visible in {owners}; using the connected schema"
    return owners[0], f"visible in {owners}; using the first"


def _columns(table: str) -> tuple[list[dict], str | None, list[str], str | None]:
    """The table's columns, from whichever catalogue this database has."""
    errs = []
    owner, note = _owner_of(table)
    if note:
        errs.append(note)
    # ALL_TAB_COLUMNS, not USER_ — the tables live in SILVER and the API may
    # well not connect as SILVER. See the module docstring.
    rows, err = _try("""
        SELECT owner, column_name, data_type, data_length, nullable
        FROM all_tab_columns WHERE table_name = :t
          AND (:o IS NULL OR owner = :o) ORDER BY owner, column_id""",
        {"t": table, "o": owner})
    if rows:
        return ([{"name": r["column_name"], "type": r["data_type"],
                  "length": r.get("data_length"),
                  "nullable": r.get("nullable") == "Y"} for r in rows],
                "all_tab_columns", errs, owner or rows[0].get("owner"))
    if err:
        errs.append(f"all_tab_columns: {err}")

    rows, err = _try("""
        SELECT column_name, data_type, character_maximum_length AS data_length,
               is_nullable AS nullable
        FROM information_schema.columns
        WHERE UPPER(table_name) = :t ORDER BY ordinal_position""",
        {"t": table})
    if rows:
        return ([{"name": str(r["column_name"]).upper(), "type": r["data_type"],
                  "length": r.get("data_length"),
                  "nullable": str(r.get("nullable")).upper() in ("YES", "Y")}
                 for r in rows], "information_schema.columns", errs, owner)
    if err:
        errs.append(f"information_schema.columns: {err}")
    return [], None, errs, owner


def _top_values(table: str, col: str, n: int = 15):
    """The most common values of one column. Oracle shape first, then LIMIT."""
    inner = (f'SELECT "{col}" AS v, COUNT(*) AS n FROM {table} '
             f'GROUP BY "{col}" ORDER BY COUNT(*) DESC')
    rows, err = _try(f"SELECT * FROM ({inner}) WHERE ROWNUM <= {n}")
    if err:
        rows, err2 = _try(f"{inner} LIMIT {n}")
        if err2:
            return [], err
    return ([{"value": _clip(r.get("v")), "rows": r.get("n")} for r in rows],
            None)


@router.get("/profile")
def profile(table: str | None = None, samples: int = 3):
    """Structure and content profile of the legacy catalogue tables.

    GET /legacy-lineage/profile           both tables
    GET /legacy-lineage/profile?table=LEGACY_LINEAGE

    Read-only. Paste the whole response back when a screen's numbers or
    grouping look wrong — it is the difference between fixing the cause and
    guessing at it twice.
    """
    wanted = [table.upper()] if table else list(_TABLES)
    bad = [t for t in wanted if not _IDENT.match(t)]
    if bad:
        return {"detail": f"not a table name: {bad}"}

    out = {"tables": {}, "other_tables": [], "errors": []}

    tabs, err = _try("""SELECT owner || '.' || table_name AS table_name
                        FROM all_tables
                        WHERE owner NOT IN ('SYS', 'SYSTEM', 'XDB', 'OUTLN',
                                            'DBSNMP', 'APPQOSSYS', 'CTXSYS')
                        ORDER BY owner, table_name""")
    if err:
        tabs, err2 = _try("""SELECT table_name FROM information_schema.tables
                             WHERE table_schema NOT IN
                                   ('pg_catalog', 'information_schema')
                             ORDER BY table_name""")
        if err2:
            out["errors"].append(f"table list: {err}")
    out["other_tables"] = [str(r.get("table_name")).upper() for r in tabs]

    for tname in wanted:
        t = {"table": tname}
        cols, via, errs, owner = _columns(tname)
        t["found_via"] = via
        t["owner"] = owner
        # every later query must be schema-qualified for the same reason
        qname = f'{owner}."{tname}"' if owner else tname
        t["columns"] = cols
        if errs:
            t.setdefault("errors", []).extend(errs)
        if not cols:
            t["exists"] = False
            t["note"] = ("No catalogue entry. Either the table is named "
                         "differently, or it lives in another schema and the "
                         "API reaches it through a synonym or grant — in which "
                         "case say which schema owns it.")
            out["tables"][tname] = t
            continue
        t["exists"] = True

        names = [c["name"] for c in cols if _IDENT.match(c["name"])]

        # ---- one scan: rows, non-nulls and distincts for every column -------
        aggs = ", ".join(
            f'COUNT("{c}") AS nn_{i}, COUNT(DISTINCT "{c}") AS nd_{i}'
            for i, c in enumerate(names))
        rows, err = _try(f"SELECT COUNT(*) AS n_rows, {aggs} FROM {qname}")
        stats = []
        if rows:
            r = rows[0]
            t["row_count"] = r.get("n_rows")
            for i, c in enumerate(names):
                nn = r.get(f"nn_{i}") or 0
                stats.append({"column": c, "non_null": nn,
                              "nulls": (t["row_count"] or 0) - nn,
                              "distinct": r.get(f"nd_{i}")})
        else:
            # too many columns for one statement, or a type that will not
            # COUNT DISTINCT (CLOB): fall back to one query per column
            if err:
                t.setdefault("errors", []).append(f"bulk profile: {err}")
            n_rows, e = _try(f"SELECT COUNT(*) AS n_rows FROM {qname}")
            t["row_count"] = n_rows[0]["n_rows"] if n_rows else None
            for c in names:
                r, e = _try(f'SELECT COUNT("{c}") AS nn, '
                            f'COUNT(DISTINCT "{c}") AS nd FROM {qname}')
                stats.append({"column": c,
                              "non_null": r[0]["nn"] if r else None,
                              "nulls": ((t["row_count"] or 0) - r[0]["nn"])
                                        if r else None,
                              "distinct": r[0]["nd"] if r else None,
                              "error": e})
        t["column_stats"] = stats

        # ---- the values themselves, where there are few enough to list ------
        samples_by_col, spines = {}, []
        for s in stats:
            d, nn = s.get("distinct"), s.get("non_null") or 0
            if d is None:
                continue
            interesting = (1 <= d <= _SPINE_MAX) or s["column"].endswith("_TABLE")
            if interesting:
                vals, e = _top_values(qname, s["column"])
                if vals:
                    samples_by_col[s["column"]] = vals
                elif e:
                    s["error"] = e
            if _SPINE_MIN <= d <= _SPINE_MAX and nn > 0:
                cov = round(100 * nn / (t["row_count"] or 1))
                blocked = _spine_block(s["column"])
                lo, hi = _SPINE_IDEAL
                # coverage decides, then how readable the split is; a column
                # doing another job is listed but never recommended
                score = cov - (0 if lo <= d <= hi else 25)
                spines.append({
                    "column": s["column"], "buckets": d,
                    "coverage_pct": cov, "populated_rows": nn,
                    "usable": blocked is None,
                    "note": blocked or ("" if lo <= d <= hi else
                                        f"{d} buckets is outside the readable "
                                        f"range {lo}-{hi}"),
                    "_score": score})
        t["value_samples"] = samples_by_col
        # populated, splits the data, and not already doing another job
        spines.sort(key=lambda x: (not x["usable"], -x["_score"], x["buckets"]))
        for x in spines:
            x.pop("_score", None)
        t["candidate_spines"] = spines
        t["all_null_columns"] = [s["column"] for s in stats
                                 if (s.get("non_null") or 0) == 0]

        if samples > 0:
            rows, err = _try(f"SELECT * FROM {qname} "
                             f"WHERE ROWNUM <= {int(samples)}")
            if err:
                rows, err2 = _try(f"SELECT * FROM {qname} "
                                  f"LIMIT {int(samples)}")
                if err2:
                    t.setdefault("errors", []).append(f"sample rows: {err}")
            t["sample_rows"] = [{k: _clip(v) for k, v in r.items()}
                                for r in rows]
        out["tables"][tname] = t

    # ---- the one-line answer, up front -------------------------------------
    ll = out["tables"].get("LEGACY_LINEAGE") or {}
    if ll.get("exists"):
        usable = [c for c in (ll.get("candidate_spines") or []) if c["usable"]]
        best = usable[0] if usable else None
        out["verdict"] = {
            "row_count": ll.get("row_count"),
            "recommended_spine": best,
            "functional_group_populated":
                "FUNCTIONAL_GROUP" in [s["column"] for s in
                                       ll.get("column_stats") or []
                                       if (s.get("non_null") or 0) > 0],
            "lineage_status_values":
                ll.get("value_samples", {}).get("LINEAGE_STATUS"),
        }
    return out
