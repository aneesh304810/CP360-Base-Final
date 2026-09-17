"""Source-first lineage navigation.

Every existing /legacy-lineage endpoint aggregates by dwh_target_table — the
right shape for "where did THIS column come from", which is how a developer
reads lineage. It is the wrong shape for "what happens to our account file",
which is how everyone else reads it, and it gives no entry point at the thing
the migration actually starts from: the AddVantage extract.

These three endpoints invert that:

  /sources       every extract file, grouped by the master it carries
  /source-flow   one file end to end — STG1, STG2, every warehouse table it
                 lands in, with per-target coverage
  /source-fields the file's fields, collapsed into families

FAMILIES: the AddVantage code is group/section-line, so BI/2-1 .. BI/2-5 are
five lines of ONE field (Account Long Name). canon() gives BI_2_1 .. BI_2_5.
Collapsing them to a family of five is the difference between a readable list
and 186 rows. The split is deliberately conservative — only LETTERS_DIGITS_
DIGITS collapses, so BI_2_1 -> family BI_2 line 1, while BI_54 and ST_SEC_01
stay whole and single.

PERFORMANCE: the dictionary join canonicalises ONCE in a CTE and hash-joins,
never per row. /dictionary carried a correlated-subquery version that scanned
legacy_lineage twice per dictionary row and blew the UI's 15s fetch timeout;
that bug is documented in its docstring. Do not reintroduce the shape here.
"""
from __future__ import annotations
import logging
import re as _re
from fastapi import APIRouter

from ._legacy_compat import (
    _safe, _ds_scoped, _norm_code, _master_from_context,
)

log = logging.getLogger("cp.api.legacy_source")
router = APIRouter(prefix="/legacy-lineage", tags=["legacy-lineage"])

# Both loader conventions mean mapped: the rich sheet writes 'Exists',
# the 4-column loader writes 'mapped'.
_MAPPED_SQL = "LOWER(lineage_status) IN ('mapped', 'exists')"

# canon() in SQL — matches _norm_code exactly. The '_\1' backreference must
# survive as two characters; in a non-raw string Python turns \1 into chr(1)
# and BI_2_L1 silently stops collapsing to BI_2_1 (see /dictionary).
_CANON_SRC = r"""REGEXP_REPLACE(
        UPPER(TRIM('_' FROM REGEXP_REPLACE(src_source_column,
              '[[:space:]/.-]+', '_'))),
        '_L([0-9]+)', '_\1')"""

# LETTERS_DIGITS _ DIGITS -> (family, line). Anything else is its own family.
_FAMILY_RE = _re.compile(r"^([A-Z]+_\d+)_(\d+)$")


def _family(code_norm: str) -> tuple[str, int | None]:
    m = _FAMILY_RE.match(code_norm or "")
    if m:
        return m.group(1), int(m.group(2))
    return (code_norm or ""), None


def _hop_class(r: dict) -> str:
    """How this field changes on the way through — the organising principle
    for the field list. Mirrors the graph's edge kinds."""
    src, s1 = r.get("src_source_column"), r.get("stg1_source_column")
    s2, dwh = r.get("stg2_source_column"), r.get("dwh_target_column")
    if not str(r.get("lineage_status") or "").lower() in ("mapped", "exists") \
            or not dwh:
        return "unmapped"
    xf = " ".join(str(r.get(k) or "") for k in
                  ("src_to_stg1_transform", "stg1_to_stg2_transform",
                   "stg2_to_dwh_transform")).lower()
    if "not applicable" in xf:
        xf = ""
    if "trim" in xf:
        return "trim"
    names = [_norm_code(x) for x in (src, s1, s2, dwh) if x]
    if len({n for n in names if n}) > 1:
        return "ren"
    if src and s1 and src != s1 and _norm_code(src) == _norm_code(s1):
        return "phys"
    return "pass"


@router.get("/sources")
def sources(data_source: str | None = None):
    """Every AddVantage extract file, with the master it carries and how far
    its fields get. This is the entry point of the source-first drill."""
    rows = _ds_scoped(f"""
        SELECT src_source_table,
               MIN(stg1_source_table) AS stg1_source_table,
               MIN(stg2_source_table) AS stg2_source_table,
               COUNT(DISTINCT src_source_column) AS field_count,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN src_source_column END) AS mapped,
               COUNT(DISTINCT dwh_target_table) AS target_tables,
               COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column)
                   AS target_columns,
               COUNT(DISTINCT NVL(functional_group, 'Unassigned')) AS groups
        FROM legacy_lineage
        WHERE src_source_table IS NOT NULL {{DS}}
        GROUP BY src_source_table
        ORDER BY COUNT(DISTINCT src_source_column) DESC""", {}, data_source)

    by_master: dict[str, dict] = {}
    for r in rows:
        r["master"] = _master_from_context(r.get("src_source_table"),
                                           r.get("stg1_source_table")) or "Unresolved"
        r["unmapped"] = (r.get("field_count") or 0) - (r.get("mapped") or 0)
        m = by_master.setdefault(r["master"], {
            "master": r["master"], "files": [], "field_count": 0,
            "mapped": 0, "unmapped": 0, "target_tables": 0})
        m["files"].append(r)
        m["field_count"] += r.get("field_count") or 0
        m["mapped"] += r.get("mapped") or 0
        m["unmapped"] += r["unmapped"]
        m["target_tables"] = max(m["target_tables"], r.get("target_tables") or 0)

    masters = sorted(by_master.values(), key=lambda m: -m["field_count"])
    tot_f = sum(m["field_count"] for m in masters)
    tot_m = sum(m["mapped"] for m in masters)
    return {"data_source": (data_source or "").upper() or None,
            "masters": masters, "sources": rows,
            "totals": {"files": len(rows), "masters": len(masters),
                       "field_count": tot_f, "mapped": tot_m,
                       "unmapped": tot_f - tot_m}}


@router.get("/source-flow")
def source_flow(src_table: str, data_source: str | None = None):
    """One extract file, end to end: the staging tables it lands in and every
    warehouse table it reaches, with per-target coverage. This is the screen
    that answers 'what happens to this file'."""
    stages = _ds_scoped(f"""
        SELECT MIN(stg1_source_table) AS stg1_source_table,
               COUNT(DISTINCT stg1_source_table) AS stg1_count,
               COUNT(DISTINCT stg2_source_table) AS stg2_count,
               MIN(stg2_source_table) AS stg2_source_table,
               COUNT(DISTINCT src_source_column) AS field_count,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN src_source_column END) AS mapped,
               COUNT(DISTINCT CASE WHEN stg2_source_column IS NOT NULL
                                   THEN src_source_column END) AS reach_stg2
        FROM legacy_lineage
        WHERE src_source_table = :s {{DS}}""", {"s": src_table}, data_source)

    targets = _ds_scoped(f"""
        SELECT dwh_target_table,
               NVL(functional_group, 'Unassigned') AS functional_group,
               NVL(data_source, 'PBDW') AS data_source,
               COUNT(DISTINCT dwh_target_column) AS column_count,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN dwh_target_column END) AS mapped
        FROM legacy_lineage
        WHERE src_source_table = :s AND dwh_target_table IS NOT NULL {{DS}}
        GROUP BY dwh_target_table, NVL(functional_group, 'Unassigned'),
                 NVL(data_source, 'PBDW')
        ORDER BY COUNT(DISTINCT dwh_target_column) DESC""",
        {"s": src_table}, data_source)

    st = stages[0] if stages else {}
    return {"src_table": src_table,
            "master": _master_from_context(src_table,
                                           st.get("stg1_source_table")),
            "data_source": (data_source or "").upper() or None,
            "stages": st, "targets": targets,
            "target_count": len(targets)}


@router.get("/source-fields")
def source_fields(src_table: str, data_source: str | None = None,
                  target: str | None = None, system: str = "ADDVANTAGE"):
    """The file's fields, collapsed into families, each with its hop class and
    (where the dictionary has one) its business term.

    Grain in: legacy_lineage is (target column x source), so one source column
    that feeds several warehouse columns appears several times. Grain out: one
    row per source code, with every landing it reaches listed under it — the
    fan-out a flat list cannot show.
    """
    params = {"s": src_table, "sys": system.upper()}
    tgt_clause = ""
    if target:
        tgt_clause = " AND dwh_target_table = :t "
        params["t"] = target

    rows = _ds_scoped(f"""
        WITH lin AS (
            SELECT {_CANON_SRC} AS code_norm,
                   src_source_column, stg1_source_column, stg2_source_column,
                   dwh_target_table, dwh_target_column, dwh_type, dwh_length,
                   src_to_stg1_transform, stg1_to_stg2_transform,
                   stg2_to_dwh_transform, lineage_status,
                   NVL(functional_group, 'Unassigned') AS functional_group,
                   is_ud, ud_key
            FROM legacy_lineage
            WHERE src_source_table = :s AND src_source_column IS NOT NULL
                  {tgt_clause} {{DS}}
        ),
        dic AS (   -- canonicalised once, hash-joined; never per row
            SELECT field_code_norm,
                   MAX(business_term)     AS business_term,
                   MAX(business_function) AS business_function,
                   MAX(short_desc)        AS short_desc,
                   MAX(is_pii)            AS is_pii,
                   MAX(is_required)       AS is_required
            FROM legacy_dictionary
            WHERE source_system = :sys
            GROUP BY field_code_norm
        )
        SELECT l.*, d.business_term, d.business_function, d.short_desc,
               d.is_pii, d.is_required
        FROM lin l
        LEFT JOIN dic d ON d.field_code_norm = l.code_norm
        ORDER BY l.code_norm, l.dwh_target_table, l.dwh_target_column""",
        params, data_source)

    # ---- fold (code x target) grain into one row per code ------------------
    by_code: dict[str, dict] = {}
    for r in rows:
        code = r.get("code_norm") or ""
        c = by_code.get(code)
        if c is None:
            fam, line = _family(code)
            c = {"code_norm": code, "family": fam, "line": line,
                 "src_source_column": r.get("src_source_column"),
                 "business_term": r.get("business_term"),
                 "business_function": r.get("business_function"),
                 "short_desc": r.get("short_desc"),
                 "is_pii": r.get("is_pii"), "is_required": r.get("is_required"),
                 "functional_group": r.get("functional_group"),
                 "is_ud": r.get("is_ud"), "ud_key": r.get("ud_key"),
                 "cls": _hop_class(r), "lands": []}
            by_code[code] = c
        if r.get("dwh_target_table") and r.get("dwh_target_column"):
            land = {"table": r["dwh_target_table"], "column": r["dwh_target_column"],
                    "type": r.get("dwh_type"), "length": r.get("dwh_length")}
            if land not in c["lands"]:
                c["lands"].append(land)
        if c["cls"] == "unmapped" and _hop_class(r) != "unmapped":
            c["cls"] = _hop_class(r)      # any mapped landing un-marks the code

    # ---- group codes into families ----------------------------------------
    fams: dict[str, dict] = {}
    for c in by_code.values():
        f = fams.setdefault(c["family"], {
            "family": c["family"], "term": None, "business_function": None,
            "members": [], "cls": c["cls"], "lands": 0, "unmapped": 0})
        f["members"].append(c)
        f["lands"] += len(c["lands"])
        if c["cls"] == "unmapped":
            f["unmapped"] += 1
        elif f["cls"] == "unmapped":
            f["cls"] = c["cls"]
        if not f["term"] and c.get("business_term"):
            # "Account Long Name Line 1" -> the family reads "Account Long Name"
            f["term"] = _re.sub(r"\s+(line|ln)\s*\d+\s*$", "",
                                str(c["business_term"]), flags=_re.I)
        if not f["business_function"] and c.get("business_function"):
            f["business_function"] = c["business_function"]

    out = sorted(fams.values(), key=lambda f: f["family"])
    for f in out:
        f["members"].sort(key=lambda c: (c["line"] is None, c["line"] or 0,
                                         c["code_norm"]))

    counts: dict[str, int] = {}
    for c in by_code.values():
        counts[c["cls"]] = counts.get(c["cls"], 0) + 1
    return {"src_table": src_table, "target": target,
            "data_source": (data_source or "").upper() or None,
            "families": out,
            "totals": {"codes": len(by_code), "families": len(out),
                       "by_class": counts}}
