"""Find the SCD2 attributes in an existing warehouse, table by table.

WHAT IT DOES. Reads a column inventory -- the old PBDW warehouse, or any
other schema -- and, for every table, names which columns play which
slowly-changing-dimension role: surrogate key, natural key, valid-from,
valid-to, current flag, version, row hash, and the audit columns around
them. It then gives the table a verdict:

    SCD2            both ends of a validity window, or one end plus a
                    current flag -- the table keeps history as rows
    SCD2 (probable) one SCD2 marker plus a supporting one; confirm by eye
    SNAPSHOT        an as-of / business date and no window -- history by
                    repetition, not by versioning
    SCD1            audit stamps only -- rows are overwritten in place
    NONE            nothing that tracks change

It reads METADATA ONLY: table, column, data type, nullable. No row is
ever selected, so nothing here can carry an account number or a client
name. The report is structure and counts.

WHERE THE COLUMNS COME FROM (--source):

    lineage    the hub's legacy_lineage table, warehouse side
               (dwh_target_table / dwh_target_column), filtered by
               --data-source, PBDW by default. Needs the hub database.
    catalog    the hub's columns catalog, filtered by --platform and an
               optional --schema. Needs the hub database.
    oracle     ALL_TAB_COLUMNS of the warehouse itself, filtered by
               --owner. Connects with PBDW_DSN / PBDW_USER / PBDW_PASSWORD
               (the read-only warehouse login scd2lens uses; thick mode
               and an ldap:// alias are handled). Without those three it
               falls back to the hub connection, which sees the warehouse
               only when the hub account has been granted it.
    csv        a file with columns table,column,type,nullable -- what a
               DBA can hand over without granting any access.

OUTPUT. A CSV (--out), one row per table, plus a one-line-per-table
summary on the console. The 'maps_to' column says which target-design
attribute each found column corresponds to, so the same report doubles
as the PBDW-to-Pre-Gold crosswalk for the SCD2 columns.

    python -m tools.scd2_scan --source csv --csv pbdw_columns.csv --out scd2.csv
    python -m tools.scd2_scan --source lineage --data-source PBDW --out scd2.csv
    python -m tools.scd2_scan --source oracle --owner PBDW --out scd2.csv
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from collections import defaultdict

# ---- the roles, as data -----------------------------------------------
# Each role: a list of (regex, weight). The regex runs on the UPPER-CASED
# column name. `types` restricts which base data types may play the role;
# a name match on the wrong type is ignored, which is what keeps
# TRADE_DATE from being read as a validity window. `maps_to` is the
# attribute in the target (Pre-Gold) design.
DATE = ("DATE", "TIMESTAMP")
TEXT = ("VARCHAR2", "CHAR", "NVARCHAR2", "NCHAR", "VARCHAR")
NUM = ("NUMBER", "INTEGER", "DECIMAL", "NUMERIC", "FLOAT", "INT")

ROLES = {
    "VALID_FROM": {
        "maps_to": "VALID_FROM_DATE / EFFECTIVE_FROM_TS",
        "types": DATE,
        "patterns": [
            (r"^(VALID|EFF|EFFECTIVE|EFFCTV|EFFECT)_?(FROM|START|BEG|BEGIN|STRT)_?(DT|DATE|TS|TM|TIME|TIMESTAMP|DTTM|DTM)?$", 5),
            (r"^(ROW|REC|RECORD|DW|SCD|HIST|HISTORY|VERSION|VER)_?(START|BEGIN|BEG|FROM|EFF|EFFECTIVE)_?(DT|DATE|TS|TM|TIMESTAMP|DTTM)?$", 5),
            (r"^(START|BEGIN|BEG|FROM|ACTIVE_FROM|ACTIVATION|ACTV)_?(DT|DATE|TS|TM|TIMESTAMP|DTTM)$", 3),
            (r"^(EFF|EFFECTIVE|EFFCTV)_?(DT|DATE|TS|TIMESTAMP|DTTM)$", 3),
        ],
    },
    "VALID_TO": {
        "maps_to": "VALID_TO_DATE / EFFECTIVE_TO_TS",
        "types": DATE,
        "patterns": [
            (r"^(VALID|EFF|EFFECTIVE|EFFCTV|EFFECT)_?(TO|THRU|THROUGH|END|STOP|UNTIL)_?(DT|DATE|TS|TM|TIME|TIMESTAMP|DTTM|DTM)?$", 5),
            (r"^(ROW|REC|RECORD|DW|SCD|HIST|HISTORY|VERSION|VER)_?(END|TO|THRU|STOP|EXPIR\w*)_?(DT|DATE|TS|TM|TIMESTAMP|DTTM)?$", 5),
            (r"^(END|STOP|THRU|THROUGH|UNTIL|EXPIRY|EXPIRE|EXPIRATION|EXPIR|TERM|TERMINATION|INACTIVE|INACTIVATION|DEACTIVATION|DISC|DISCONTINUE)_?(DT|DATE|TS|TM|TIMESTAMP|DTTM)$", 3),
        ],
    },
    "CURRENT_FLAG": {
        "maps_to": "IS_CURRENT",
        "types": TEXT + NUM,
        "patterns": [
            (r"^(IS_)?(CURRENT|CURR|CUR)_?(FLAG|FLG|IND|INDICATOR|ROW|REC|RECORD|ROW_IND|REC_IND)?$", 5),
            (r"^(IS_)?(LATEST|MOST_RECENT|RECENT)_?(FLAG|FLG|IND|INDICATOR|ROW|REC)?$", 5),
            (r"^(IS_)?(ACTIVE|ACTV)_?(FLAG|FLG|IND|INDICATOR|ROW|REC|RECORD)?$", 3),
            (r"^(ROW|REC|RECORD)_?(STATUS|STAT)_?(CD|CODE|FLAG|FLG|IND)?$", 2),
        ],
    },
    "VERSION": {
        "maps_to": "RECORD_VERSION",
        "types": NUM,
        "patterns": [
            (r"^(REC|RECORD|ROW|DIM|HIST|SCD)_?(VERSION|VER|VRSN)_?(NO|NUM|NBR|ID)?$", 5),
            (r"^(VERSION|VER|VRSN)_?(NO|NUM|NBR|ID)?$", 4),
            (r"^(REC|RECORD|ROW)_?(SEQ|SEQUENCE)_?(NO|NUM|NBR)?$", 2),
        ],
    },
    "ROW_HASH": {
        "maps_to": "ROW_HASH (change detection)",
        "types": TEXT + NUM + ("RAW",),
        "patterns": [
            (r"^(ROW|REC|RECORD|DIM|ATTR|ATTRIBUTE)?_?(HASH|HASHDIFF|HASH_DIFF|DIFF_HASH|MD5|CHECKSUM|CHKSUM|CRC)(_?(KEY|VAL|VALUE|CD))?$", 5),
        ],
    },
    "SURROGATE_KEY": {
        "maps_to": "<ENTITY>_SK",
        "types": NUM,
        "patterns": [
            (r"^\w+_(SK|SKEY|SURR_KEY|SURROGATE_KEY|DIM_KEY|DIM_ID|DW_KEY|DW_ID|WH_KEY|WID)$", 5),
            (r"^(SK|SKEY|SURROGATE_KEY|DIM_KEY|DW_KEY|DW_ID)$", 5),
            (r"^\w+_KEY$", 1),   # weak: a *_KEY may be natural; the verdict does not depend on it
        ],
    },
    "BUSINESS_DATE": {
        "maps_to": "SRC_BUSINESS_DATE (snapshot grain)",
        "types": DATE,
        "patterns": [
            (r"^(BUSINESS|BUS|BIZ)_?(DT|DATE)$", 5),
            (r"^(AS_?OF|ASOF|SNAPSHOT|SNAP|POSITION|POSN|BALANCE|VALUATION|VAL|REPORT|RPT|PERIOD|PRD|PROCESS|PROC|RUN)_?(DT|DATE)$", 4),
        ],
    },
    "AUDIT": {
        "maps_to": "SRC_LOAD_ID / DBT_UPDATED_AT (lineage, not history)",
        "types": DATE + NUM + TEXT,
        "patterns": [
            (r"^(LOAD|ETL|DW|BATCH|JOB|RUN)_?(ID|NO|NUM|NBR|DT|DATE|TS|TM|TIMESTAMP|DTTM|SEQ)$", 4),
            (r"^(INSERT|INSERTED|CREATE|CREATED|CREATN|UPDATE|UPDATED|UPDT|MODIFY|MODIFIED|MOD|LAST_UPD|LAST_UPDATE|LAST_MOD|CHANGE|CHANGED|CHG)_?(DT|DATE|TS|TM|TIMESTAMP|DTTM|BY|USER|USR|ID)$", 4),
            (r"^(DW|ETL)_(INSERT|UPDATE|INS|UPD|CREATE|MODIFY)\w*$", 4),
            (r"^(SRC|SOURCE|SRC_SYS|SOURCE_SYSTEM|SRC_SYSTEM)_?(SYS|SYSTEM|ID|CD|CODE|NAME|NM)?$", 2),
        ],
    },
}
_COMPILED = {r: [(re.compile(p), w) for p, w in d["patterns"]] for r, d in ROLES.items()}


def base_type(t: str | None) -> str:
    """'TIMESTAMP(6) WITH TIME ZONE' -> 'TIMESTAMP'; 'VARCHAR2(10)' -> 'VARCHAR2'."""
    t = (t or "").strip().upper()
    m = re.match(r"^([A-Z0-9_]+)", t)
    return m.group(1) if m else t


def role_of(column: str, data_type: str | None) -> tuple[str | None, int]:
    """The strongest role this column can play, and its weight. (None, 0) if none."""
    name = (column or "").strip().upper()
    bt = base_type(data_type)
    best, best_w = None, 0
    for role, pats in _COMPILED.items():
        allowed = ROLES[role]["types"]
        if bt and allowed and bt not in allowed:
            continue
        for rx, w in pats:
            if rx.match(name) and w > best_w:
                best, best_w = role, w
    return best, best_w


def classify(columns: list[dict], table: str | None = None) -> dict:
    """One table's columns -> roles, verdict and evidence.

    columns: [{"column": str, "type": str|None, "nullable": "Y"|"N"|None}]
    table:   optional name; only its prefix is read (VW_ / FACT_) for a note.

    TUNED ON THE FIRST REAL SCAN (261 tables). A start date plus an active
    flag and NO end date was rated SCD2 high, which swept in transaction
    facts carrying EFFECTIVE_DATE beside a VALUATION_DATE, and an
    inactivation date plus a flag with no start was rated the same. Neither
    is a versioned row: nothing opens a version in one, nothing closes it in
    the other. High now needs the window — both ends.
    """
    found: dict[str, list[tuple[str, int, str]]] = defaultdict(list)
    for c in columns:
        role, w = role_of(c.get("column"), c.get("type"))
        if role:
            found[role].append((c.get("column"), w, (c.get("nullable") or "").upper()[:1]))
    # strongest column per role
    pick = {r: max(v, key=lambda x: x[1]) for r, v in found.items()}
    has = lambda r, min_w=2: r in pick and pick[r][1] >= min_w   # noqa: E731

    strong_from, strong_to = has("VALID_FROM", 3), has("VALID_TO", 3)
    flag, ver, bdate = has("CURRENT_FLAG", 3), has("VERSION", 4), has("BUSINESS_DATE", 4)
    audit = has("AUDIT", 4)

    notes = []
    if strong_from and strong_to:
        verdict, conf = "SCD2", "high"
    elif strong_from and flag and bdate:
        # EFFECTIVE_DATE + ACTIVE_IND beside an as-of date, no end date: the
        # date is an attribute of the event, the flag a status. Snapshot grain.
        verdict, conf = "SNAPSHOT", "medium"
        notes.append(f"{pick['VALID_FROM'][0]} and {pick['CURRENT_FLAG'][0]} beside {pick['BUSINESS_DATE'][0]} with no end date: "
                     "the date reads as an attribute of the row, the flag as a status; nothing closes a version")
    elif strong_from and flag:
        verdict, conf = "SCD2 (probable)", "medium"
        notes.append(f"no end date: {pick['CURRENT_FLAG'][0]} may be a status rather than a version flag; "
                     "confirm a closing rule exists before treating rows as versioned")
    elif strong_to and flag:
        # an inactivation date and a flag close the ENTITY, not a version
        verdict, conf = "SCD1", "medium"
        notes.append(f"{pick['VALID_TO'][0]} and {pick['CURRENT_FLAG'][0]} with no start date close the entity, not a version; "
                     "overwrite-in-place with a status")
    elif (strong_from or strong_to) and (ver or has("ROW_HASH", 5) or has("CURRENT_FLAG", 2)):
        verdict, conf = "SCD2 (probable)", "medium"
    elif flag and ver:
        verdict, conf = "SCD2 (probable)", "medium"
    elif bdate and not (strong_from or strong_to):
        verdict, conf = "SNAPSHOT", "high" if not flag else "medium"
    elif audit or has("ROW_HASH", 5):
        verdict, conf = "SCD1", "medium"
    elif strong_from or strong_to or flag or ver:
        verdict, conf = "SCD2 (weak)", "low"
    else:
        verdict, conf = "NONE", "high"

    # the open-row convention, read from nullability of the TO column
    to_conv = ""
    if "VALID_TO" in pick:
        to_conv = "NULL = open" if pick["VALID_TO"][2] == "Y" else "high date = open (NOT NULL)"

    # A bare *_KEY is a weak match on its own -- it may be the natural key.
    # On a table that keeps history it is almost always the surrogate (the
    # SEI dbt design merges SCD2 on ACCOUNT_KEY, never the natural key), so
    # on an SCD2 verdict it is accepted by convention and flagged to confirm.
    name = (table or "").upper().split(".")[-1]
    if name.startswith("VW_"):
        notes.append("a view: it inherits its base table's history columns; profile and card the base table")
    elif name.startswith("FACT_") and verdict == "SCD2":
        notes.append("a fact table with a validity window: confirm rows are versioned in place and not effective-dated events")
    if verdict == "SCD2" and not flag and not has("SURROGATE_KEY", 2):
        notes.append("window only, no flag and no surrogate: effective-dated reference rows; confirm versions are closed, not merely dated")
    if verdict.startswith("SCD2") and "SURROGATE_KEY" in pick and pick["SURROGATE_KEY"][1] < 2:
        pick["SURROGATE_KEY"] = (pick["SURROGATE_KEY"][0], 2, pick["SURROGATE_KEY"][2])
        notes.append(f"{pick['SURROGATE_KEY'][0]} taken as the surrogate by convention; confirm it is not the natural key")
    if "VALID_TO" in pick and pick["VALID_TO"][2] == "N":
        notes.append("open rows carry a sentinel end date; confirm the value (9999-12-31 or 2099-12-31) before mapping to NULL")
    if verdict.startswith("SCD2") and not has("VERSION", 4):
        notes.append("no version column; RECORD_VERSION can be derived as ROW_NUMBER over the start date within the natural key")

    missing = []
    if verdict.startswith("SCD2"):
        for r in ("VALID_FROM", "VALID_TO", "CURRENT_FLAG", "VERSION", "SURROGATE_KEY"):
            if not has(r, 2 if r == "SURROGATE_KEY" else 3):
                missing.append(r)

    return {
        "verdict": verdict,
        "confidence": conf,
        "roles": {r: pick[r][0] for r in pick},
        "weights": {r: pick[r][1] for r in pick},
        "all_matches": {r: [c for c, _, _ in v] for r, v in found.items()},
        "to_convention": to_conv,
        "missing_for_full_scd2": missing,
        "maps_to": {pick[r][0]: ROLES[r]["maps_to"] for r in pick if r != "AUDIT"},
        "notes": notes,
        "column_count": len(columns),
    }


# ---- sources ------------------------------------------------------------
def _hub_query():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from api.app.db import query   # noqa: E402  (the API's own pool and DSN parser)
    return query


def read_lineage(data_source: str) -> dict[str, list[dict]]:
    q = _hub_query()
    rows = q("""SELECT DISTINCT dwh_target_table AS t, dwh_target_column AS c, dwh_type AS ty
                FROM   legacy_lineage
                WHERE  UPPER(NVL(data_source,'PBDW')) = :ds
                  AND  dwh_target_table IS NOT NULL AND dwh_target_column IS NOT NULL""",
             {"ds": data_source.upper()})
    out = defaultdict(list)
    for r in rows:
        out[r["t"]].append({"column": r["c"], "type": r["ty"], "nullable": None})
    return out


def read_catalog(platform: str, schema: str | None) -> dict[str, list[dict]]:
    q = _hub_query()
    sql = """SELECT schema_name AS s, object_name AS t, column_name AS c, data_type AS ty, nullable AS n
             FROM   columns WHERE UPPER(platform_id) = :p"""
    params = {"p": platform.upper()}
    if schema:
        sql += " AND UPPER(schema_name) = :s"
        params["s"] = schema.upper()
    out = defaultdict(list)
    for r in q(sql, params):
        out[f"{r['s']}.{r['t']}"].append({"column": r["c"], "type": r["ty"], "nullable": r["n"]})
    return out


def _warehouse_query():
    """The warehouse session scd2lens opens from PBDW_DSN / PBDW_USER / PBDW_PASSWORD, or None when unset.

    The hub account (CP_CATALOG_DB_DSN) is a different login on a different
    database and normally cannot see the warehouse's dictionary at all: run
    through it, ALL_TAB_COLUMNS simply returns no rows and the scan reports
    zero tables, which reads like an empty schema rather than a wrong door.
    """
    if not all(os.environ.get(k) for k in ("PBDW_DSN", "PBDW_USER", "PBDW_PASSWORD")):
        return None
    lens = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools", "scd2lens")
    if lens not in sys.path:
        sys.path.insert(0, lens)
    from scd2lens.db import conn as dbc   # noqa: E402
    return dbc.Runner(dbc.connect())


def read_oracle(owner: str) -> dict[str, list[dict]]:
    """ALL_TAB_COLUMNS of the warehouse itself. Metadata only; no table is read."""
    q = _warehouse_query()
    via = "warehouse (PBDW_*)"
    if q is None:
        q = _hub_query()
        via = "hub (CP_CATALOG_DB_DSN)"
    rows = q("""SELECT owner AS s, table_name AS t, column_name AS c, data_type AS ty, nullable AS n
                FROM   all_tab_columns WHERE UPPER(owner) = :o ORDER BY table_name, column_id""",
             {"o": owner.upper()})
    out = defaultdict(list)
    for r in rows:
        out[f"{r['s']}.{r['t']}"].append({"column": r["c"], "type": r["ty"], "nullable": r["n"]})
    if not out:
        print(f"no columns for owner {owner.upper()} via the {via} connection. "
              + ("Set PBDW_DSN, PBDW_USER and PBDW_PASSWORD to read the warehouse directly."
                 if via.startswith("hub") else "Check --owner: it is the schema that owns the tables."), file=sys.stderr)
    return out


def read_csv(path: str) -> dict[str, list[dict]]:
    """table,column[,type][,nullable] -- header row required, case-insensitive."""
    out = defaultdict(list)
    with open(path, newline="", encoding="utf-8-sig") as f:
        rd = csv.DictReader(f)
        cols = {c.lower().strip(): c for c in rd.fieldnames or []}
        t = cols.get("table") or cols.get("table_name") or cols.get("object_name")
        c = cols.get("column") or cols.get("column_name")
        ty = cols.get("type") or cols.get("data_type")
        n = cols.get("nullable")
        if not (t and c):
            raise SystemExit("csv needs at least 'table' and 'column' headers")
        for r in rd:
            out[(r[t] or "").strip()].append({"column": r[c], "type": r.get(ty) if ty else None,
                                              "nullable": r.get(n) if n else None})
    return out


# ---- report ---------------------------------------------------------------
ROLE_ORDER = ["SURROGATE_KEY", "VALID_FROM", "VALID_TO", "CURRENT_FLAG", "VERSION", "ROW_HASH", "BUSINESS_DATE", "AUDIT"]


def report(tables: dict[str, list[dict]], out_path: str | None) -> list[dict]:
    rows = []
    for t in sorted(tables):
        r = classify(tables[t], t)
        rows.append({"table": t, "columns": r["column_count"], "verdict": r["verdict"], "confidence": r["confidence"],
                     **{role.lower(): r["roles"].get(role, "") for role in ROLE_ORDER},
                     "to_convention": r["to_convention"],
                     "missing_for_full_scd2": " ".join(r["missing_for_full_scd2"]),
                     "maps_to": "; ".join(f"{c} -> {m}" for c, m in r["maps_to"].items()),
                     "notes": " | ".join(r["notes"])})
    if out_path:
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["table"])
            w.writeheader(); w.writerows(rows)
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--source", choices=["lineage", "catalog", "oracle", "csv"], required=True)
    ap.add_argument("--data-source", default="PBDW", help="lineage: PBDW | IMDS")
    ap.add_argument("--platform", help="catalog: platform_id")
    ap.add_argument("--schema", help="catalog: schema_name filter")
    ap.add_argument("--owner", help="oracle: schema owner in ALL_TAB_COLUMNS")
    ap.add_argument("--csv", help="csv: path with table,column,type,nullable")
    ap.add_argument("--out", help="CSV report path")
    ap.add_argument("--only", choices=["scd2", "all"], default="all", help="print only SCD2 verdicts")
    a = ap.parse_args(argv)

    if a.source == "lineage":
        tables = read_lineage(a.data_source)
    elif a.source == "catalog":
        if not a.platform:
            ap.error("--platform is required with --source catalog")
        tables = read_catalog(a.platform, a.schema)
    elif a.source == "oracle":
        if not a.owner:
            ap.error("--owner is required with --source oracle")
        tables = read_oracle(a.owner)
    else:
        if not a.csv:
            ap.error("--csv is required with --source csv")
        tables = read_csv(a.csv)

    rows = report(tables, a.out)
    counts = defaultdict(int)
    for r in rows:
        counts[r["verdict"]] += 1
        if a.only == "all" or r["verdict"].startswith("SCD2"):
            roles = "  ".join(f"{k}={r[k.lower()]}" for k in ROLE_ORDER if r[k.lower()])
            print(f"{r['verdict']:<16} {r['confidence']:<6} {r['table']:<44} {roles}")
    print("\n" + "  ".join(f"{k}: {v}" for k, v in sorted(counts.items())) + f"  tables: {len(rows)}")
    if a.out:
        print(f"report: {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
