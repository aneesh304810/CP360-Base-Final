"""Source-first lineage navigation.

Every existing /legacy-lineage endpoint aggregates by dwh_target_table — the
right shape for "where did THIS column come from", which is how a developer
reads lineage. It is the wrong shape for "what happens to our account file",
which is how everyone else reads it, and it gives no entry point at the thing
the migration actually starts from: the AddVantage extract.

These endpoints invert that:

  /sources        every extract file, grouped along a spine (see below)
  /source-flow    one file end to end — STG1, STG2, every warehouse table it
                  lands in, with per-target coverage
  /source-fields  the file's fields, collapsed into families
  /status-values  diagnostic: the real lineage_status vocabulary, and how the
                  shared mapped-predicate classifies each value

THE SPINE. L0 was originally grouped by master, resolved from the table names
by _master_from_context. On the live extract that resolves to None for every
file — the tables are named Company / Instrument / Portfolio / Transaction,
which none of the AddVantage master hints match — so the whole screen
collapsed into one "Unresolved" bucket of 177 tables. functional_group is a
real column on legacy_lineage, it is what the existing accordion groups by,
and it is populated. So: group by functional_group, fall back to master, fall
back to a single bucket, and say in the payload which spine was used so the
UI can label the column honestly rather than claiming "Masters" either way.

A file can span several functional groups (it is the DWH side of the row that
carries the group). Each file is filed under its DOMINANT group — most target
columns — and carries its full group mix, so nothing is hidden by the choice.

COUNTING. field_count and mapped come from a per-file query, never from
summing the per-(file, group) rows: a source column feeding two functional
groups appears in both and would be counted twice.

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
    _MAPPED_SQL, _is_mapped,
)

log = logging.getLogger("cp.api.legacy_source")
router = APIRouter(prefix="/legacy-lineage", tags=["legacy-lineage"])

# canon() in SQL — matches _norm_code exactly. The '_\1' backreference must
# survive as two characters; in a non-raw string Python turns \1 into chr(1)
# and BI_2_L1 silently stops collapsing to BI_2_1 (see /dictionary).
_CANON_SRC = r"""REGEXP_REPLACE(
        UPPER(TRIM('_' FROM REGEXP_REPLACE(src_source_column,
              '[[:space:]/.-]+', '_'))),
        '_L([0-9]+)', '_\1')"""

# LETTERS_DIGITS _ DIGITS -> (family, line). Anything else is its own family.
_FAMILY_RE = _re.compile(r"^([A-Z]+_\d+)_(\d+)$")

# The placeholder NVL(functional_group, ...) writes, and the label the master
# spine uses when the hints do not match. Neither is a real bucket.
_NO_GROUP = "Unassigned"
_NO_MASTER = "Unresolved"


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
    if not _is_mapped(r.get("lineage_status"), bool(dwh)) or not dwh:
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
def sources(data_source: str | None = None, spine: str | None = None):
    """Every AddVantage extract file, bucketed along the best available spine,
    with how far its fields get. This is the entry point of the drill.

    spine=group|master|flat forces one; omitted, the best populated one wins.
    """
    # --- per file: the authoritative field counts (no double counting) ------
    files = _ds_scoped(f"""
        SELECT src_source_table,
               MIN(stg1_source_table) AS stg1_source_table,
               MIN(stg2_source_table) AS stg2_source_table,
               COUNT(DISTINCT src_source_column) AS field_count,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN src_source_column END) AS mapped,
               COUNT(DISTINCT dwh_target_table) AS target_tables,
               COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column)
                   AS target_columns,
               COUNT(DISTINCT NVL(functional_group, '{_NO_GROUP}')) AS groups
        FROM legacy_lineage
        WHERE src_source_table IS NOT NULL {{DS}}
        GROUP BY src_source_table
        ORDER BY COUNT(DISTINCT src_source_column) DESC""", {}, data_source)

    # --- per (file, functional group): the mix, for choosing the bucket -----
    mix = _ds_scoped(f"""
        SELECT src_source_table,
               NVL(functional_group, '{_NO_GROUP}') AS functional_group,
               COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column)
                   AS target_columns,
               COUNT(DISTINCT dwh_target_table) AS target_tables
        FROM legacy_lineage
        WHERE src_source_table IS NOT NULL {{DS}}
        GROUP BY src_source_table, NVL(functional_group, '{_NO_GROUP}')""",
        {}, data_source)

    by_file: dict[str, list[dict]] = {}
    for m in mix:
        by_file.setdefault(m.get("src_source_table"), []).append(m)

    for f in files:
        f["unmapped"] = (f.get("field_count") or 0) - (f.get("mapped") or 0)
        f["master"] = _master_from_context(f.get("src_source_table"),
                                           f.get("stg1_source_table"))
        # dominant group: most target columns, a real group beating the
        # placeholder even when the placeholder is larger — filing a file
        # under "Unassigned" when it has any real group is a lost file.
        gs = sorted(by_file.get(f.get("src_source_table")) or [],
                    key=lambda g: (g.get("functional_group") == _NO_GROUP,
                                   -(g.get("target_columns") or 0),
                                   str(g.get("functional_group") or "")))
        f["groups_mix"] = [{"functional_group": g.get("functional_group"),
                            "target_columns": g.get("target_columns"),
                            "target_tables": g.get("target_tables")}
                           for g in gs]
        f["functional_group"] = gs[0]["functional_group"] if gs else _NO_GROUP

    # --- pick the spine -----------------------------------------------------
    real_groups = {f["functional_group"] for f in files
                   if f["functional_group"] != _NO_GROUP}
    real_masters = {f["master"] for f in files if f.get("master")}
    if spine in ("group", "master", "flat"):
        chosen = spine
    elif real_groups:
        chosen = "group"
    elif real_masters:
        chosen = "master"
    else:
        chosen = "flat"

    if chosen == "group":
        key_of, label = (lambda f: f["functional_group"] or _NO_GROUP,
                         "Functional group")
    elif chosen == "master":
        key_of, label = (lambda f: f.get("master") or _NO_MASTER, "Master")
    else:
        key_of, label = (lambda f: "All extracts", "Source")

    buckets: dict[str, dict] = {}
    for f in files:
        k = key_of(f)
        b = buckets.setdefault(k, {
            # "master" is kept as an alias of the bucket name so a client
            # written against the master-only shape keeps rendering.
            "key": k, "label": k, "master": k, "spine": chosen,
            "files": [], "field_count": 0, "mapped": 0, "unmapped": 0,
            "target_tables": 0})
        b["files"].append(f)
        b["field_count"] += f.get("field_count") or 0
        b["mapped"] += f.get("mapped") or 0
        b["unmapped"] += f["unmapped"]
        b["target_tables"] = max(b["target_tables"], f.get("target_tables") or 0)

    # a placeholder bucket sorts last however big it is
    groups = sorted(buckets.values(),
                    key=lambda b: (b["key"] in (_NO_GROUP, _NO_MASTER),
                                   -b["field_count"]))
    tot_f = sum(b["field_count"] for b in groups)
    tot_m = sum(b["mapped"] for b in groups)
    return {"data_source": (data_source or "").upper() or None,
            "spine": chosen, "spine_label": label,
            "groups": groups,
            "masters": groups,          # legacy alias, same objects
            "sources": files,
            "totals": {"files": len(files), "groups": len(groups),
                       "masters": len(groups), "spine": chosen,
                       "field_count": tot_f, "mapped": tot_m,
                       "unmapped": tot_f - tot_m}}


@router.get("/status-values")
def status_values(data_source: str | None = None):
    """Diagnostic. The real lineage_status vocabulary in this database, with
    row counts and how the shared predicate classifies each value.

    This exists because a live extract read "0 of 177 tables mapped · 0%" on
    data that was mapped: its lineage_status used neither 'mapped' nor
    'Exists', the only two values the coverage SQL used to accept. Before
    arguing with a coverage figure, read this — it says whether the number is
    a data problem or a vocabulary problem, and names the values to add to
    _MAPPED_WORDS / _UNMAPPED_WORDS in _legacy_compat.
    """
    rows = _ds_scoped("""
        SELECT NVL(lineage_status, '(null)') AS lineage_status,
               COUNT(*) AS rows_,
               COUNT(DISTINCT src_source_table) AS src_tables,
               COUNT(CASE WHEN dwh_target_column IS NOT NULL THEN 1 END)
                   AS with_target
        FROM legacy_lineage
        WHERE 1 = 1 {DS}
        GROUP BY NVL(lineage_status, '(null)')
        ORDER BY COUNT(*) DESC""", {}, data_source)

    out, n_map, n_un = [], 0, 0
    for r in rows:
        raw = r.get("lineage_status")
        status = None if raw == "(null)" else raw
        total = r.get("rows_") or 0
        with_t = r.get("with_target") or 0
        # a value not in either word list splits by whether a target exists
        mapped = (total if _is_mapped(status, True) and _is_mapped(status, False)
                  else with_t if _is_mapped(status, True) else 0)
        n_map += mapped
        n_un += total - mapped
        out.append({"lineage_status": raw, "rows": total,
                    "src_tables": r.get("src_tables"), "with_target": with_t,
                    "counts_as_mapped": mapped,
                    "verdict": ("mapped" if _is_mapped(status, False) else
                                "unmapped" if not _is_mapped(status, True) else
                                "mapped when the row names a warehouse column")})
    return {"data_source": (data_source or "").upper() or None,
            "values": out,
            "totals": {"distinct_values": len(out),
                       "rows": n_map + n_un, "mapped": n_map, "unmapped": n_un},
            "predicate": _MAPPED_SQL}


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
               NVL(functional_group, '{_NO_GROUP}') AS functional_group,
               NVL(data_source, 'PBDW') AS data_source,
               COUNT(DISTINCT dwh_target_column) AS column_count,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN dwh_target_column END) AS mapped
        FROM legacy_lineage
        WHERE src_source_table = :s AND dwh_target_table IS NOT NULL {{DS}}
        GROUP BY dwh_target_table, NVL(functional_group, '{_NO_GROUP}'),
                 NVL(data_source, 'PBDW')
        ORDER BY COUNT(DISTINCT dwh_target_column) DESC""",
        {"s": src_table}, data_source)

    st = stages[0] if stages else {}
    # the group the file mostly serves — the honest headline when the master
    # hints do not resolve, which on the live extract is every file
    groups = {}
    for tg in targets:
        g = tg.get("functional_group") or _NO_GROUP
        groups[g] = groups.get(g, 0) + (tg.get("column_count") or 0)
    top = sorted(groups.items(), key=lambda kv: (kv[0] == _NO_GROUP, -kv[1]))
    return {"src_table": src_table,
            "master": _master_from_context(src_table,
                                           st.get("stg1_source_table")),
            "functional_group": top[0][0] if top else None,
            "functional_groups": [{"functional_group": k, "column_count": v}
                                  for k, v in top],
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
                   NVL(functional_group, '{_NO_GROUP}') AS functional_group,
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
