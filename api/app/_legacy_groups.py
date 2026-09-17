"""Where does an extract file's business grouping actually come from?

THE MISTAKE THIS REPLACES

L0 grouped by one column and hoped. First _master_from_context, regexing
master names out of table names — which resolves to nothing when the tables
are called Company, Instrument, Portfolio. Then functional_group, on the
strength of a screenshot reading "Unassigned" — which is the literal
NVL(functional_group, 'Unassigned') emits, i.e. evidence the column is EMPTY,
not evidence it is the answer. Two guesses, two versions of one bucket.

The schema says the grouping was never in one column. Across the catalogue:

    LEGACY_LINEAGE.FUNCTIONAL_GROUP        the intended home
    LEGACY_LINEAGE.TABLE_TYPE              a coarser cut of the same idea
    LEGACY_DICTIONARY.MASTER_NAME          the AddVantage master, per field
                                           code — this is what the regex was
                                           trying to reconstruct, and it is
                                           sitting in a column
    LEGACY_DICTIONARY.BUSINESS_FUNCTION    the business area, per field code
    LEGACY_TABLE_DEPENDENCY.SOURCE_FUNCTION / TARGET_FUNCTION
                                           the function, per table

Any of these may be populated in a given load, and the screen only needs one.
So stop choosing and resolve: run them in order, and a file takes its group
from the first resolver that has an answer for it. A file the dictionary knows
and functional_group does not is grouped by the dictionary, in the same list,
beside a file grouped the other way — with group_source recording which, so a
wrong bucket is traceable to the column that produced it.

LAZINESS IS THE PERFORMANCE STORY. Each resolver is a scan. They run in order
and stop the moment every file has a group, so the healthy case costs one
query. Nothing is computed per row: the dictionary join canonicalises once in
a CTE and hash-joins, the shape /dictionary's correlated-subquery version blew
the UI's 15s timeout with.

WEIGHT AND DOMINANCE. A file can touch several groups — the group rides the
DWH side of the row, one file feeds many targets. Each resolver returns
(file, group, weight) and the heaviest group wins, with the rest kept as
`alternatives` so nothing is silently dropped.
"""
from __future__ import annotations
import logging

from ._legacy_compat import _safe, _ds_scoped

log = logging.getLogger("cp.api.legacy_groups")

# canon() in SQL — matches _norm_code exactly, so the dictionary join meets on
# both sides. The '_\1' backreference must survive as two characters; in a
# non-raw string Python turns \1 into chr(1) and BI_2_L1 silently stops
# collapsing to BI_2_1 (see /dictionary).
_CANON = r"""REGEXP_REPLACE(
        UPPER(TRIM('_' FROM REGEXP_REPLACE(l.src_source_column,
              '[[:space:]/.-]+', '_'))),
        '_L([0-9]+)', '_\1')"""

# Values that mean "no answer" however they got into the column.
_EMPTY = {"", "unassigned", "unresolved", "n/a", "na", "none", "null",
          "unknown", "tbd", "-"}


def _blank(v) -> bool:
    return str(v or "").strip().lower() in _EMPTY


# ---------------------------------------------------------------------------
# The resolvers, in the order they are trusted.
#
# Each yields rows of (src_source_table, grp, weight). Order is deliberate:
# a value recorded ON the lineage row beats one inferred through a join, and
# a master beats a coarser function, because the master is what the drill's
# field identity (master + code) is actually keyed on.
# ---------------------------------------------------------------------------

_SQL_FUNCTIONAL_GROUP = """
    SELECT src_source_table, functional_group AS grp,
           COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column) AS weight
    FROM legacy_lineage
    WHERE src_source_table IS NOT NULL AND functional_group IS NOT NULL {DS}
    GROUP BY src_source_table, functional_group"""

# The dictionary is keyed (master, code): one code is defined per master, so
# field_code_norm alone is NOT unique and MAX(master_name) would pick one at
# random. Keep the pairs and let weight — how many of the file's codes fall
# under each master — decide.
_SQL_DICT = """
    WITH lin AS (
        SELECT l.src_source_table, {CANON} AS code_norm
        FROM legacy_lineage l
        WHERE l.src_source_table IS NOT NULL
          AND l.src_source_column IS NOT NULL {DS}
    ),
    dic AS (
        SELECT DISTINCT field_code_norm, {COL} AS grp
        FROM legacy_dictionary
        WHERE {COL} IS NOT NULL
    )
    SELECT lin.src_source_table, dic.grp,
           COUNT(DISTINCT lin.code_norm) AS weight
    FROM lin JOIN dic ON dic.field_code_norm = lin.code_norm
    GROUP BY lin.src_source_table, dic.grp"""

# legacy_table_dependency has no data_source column, so it is never DS-scoped.
_SQL_DEP_SOURCE = """
    SELECT source_table AS src_source_table, source_function AS grp,
           COUNT(*) AS weight
    FROM legacy_table_dependency
    WHERE source_table IS NOT NULL AND source_function IS NOT NULL
    GROUP BY source_table, source_function"""

_SQL_TABLE_TYPE = """
    SELECT src_source_table, table_type AS grp, COUNT(*) AS weight
    FROM legacy_lineage
    WHERE src_source_table IS NOT NULL AND table_type IS NOT NULL {DS}
    GROUP BY src_source_table, table_type"""


def _q_scoped(sql):
    return lambda ds, sysname: _ds_scoped(sql, {}, ds)


def _q_dict(col):
    sql = _SQL_DICT.replace("{CANON}", _CANON).replace("{COL}", col)
    return lambda ds, sysname: _ds_scoped(sql, {}, ds)


def _q_plain(sql):
    # no {DS} to substitute and no data_source column to scope by
    return lambda ds, sysname: _safe(sql, {})


GROUP_SOURCES = [
    ("functional_group", "Functional group",
     "legacy_lineage.functional_group", _q_scoped(_SQL_FUNCTIONAL_GROUP)),
    ("dictionary_master", "Master",
     "legacy_dictionary.master_name, joined on canon(src_source_column)",
     _q_dict("master_name")),
    ("dependency_function", "Function",
     "legacy_table_dependency.source_function", _q_plain(_SQL_DEP_SOURCE)),
    ("dictionary_business_function", "Business function",
     "legacy_dictionary.business_function, joined on canon(src_source_column)",
     _q_dict("business_function")),
    ("table_type", "Table type",
     "legacy_lineage.table_type", _q_scoped(_SQL_TABLE_TYPE)),
]


def resolve_groups(files: list[str] | None, data_source: str | None = None,
                   system: str = "ADDVANTAGE", only: str | None = None,
                   probe_only: bool = False) -> dict:
    """Resolve each file's group, trying the resolvers in order.

    files       the extract files to resolve; None with probe_only just
                measures what each resolver can see
    only        force one resolver by name, for comparing them on real data
    probe_only  run every resolver and report, resolving nothing

    Returns {by_file, spine, spine_label, resolved, report}. `report` is the
    honest part: per resolver, whether it ran, how many files it could group
    and into how many buckets. When L0 still reads as one bucket, that table
    says which column is empty, without another trip to the database.
    """
    want = set(files or [])
    by_file: dict[str, dict] = {}
    report, first = [], None

    for name, label, origin, run in GROUP_SOURCES:
        if only and name != only:
            report.append({"source": name, "label": label, "origin": origin,
                           "ran": False, "note": f"skipped; spine={only}"})
            continue
        # every file already has a group — no reason to scan again
        if not probe_only and want and len(by_file) >= len(want):
            report.append({"source": name, "label": label, "origin": origin,
                           "ran": False,
                           "note": "not needed; every file already grouped"})
            continue

        rows = run(data_source, system)
        # group rows by file, heaviest value first
        per: dict[str, list[tuple[str, int]]] = {}
        for r in rows:
            f, g = r.get("src_source_table"), r.get("grp")
            if not f or _blank(g):
                continue
            per.setdefault(f, []).append((g, r.get("weight") or 0))

        covered, buckets = 0, set()
        for f, pairs in per.items():
            if want and f not in want:
                continue
            pairs.sort(key=lambda p: (-p[1], str(p[0])))
            buckets.add(pairs[0][0])
            covered += 1
            if probe_only or f in by_file:
                continue
            by_file[f] = {"group": pairs[0][0], "source": name,
                          "alternatives": [{"group": g, "weight": w}
                                           for g, w in pairs[1:6]]}
        if covered and first is None:
            first = (name, label)
        report.append({
            "source": name, "label": label, "origin": origin, "ran": True,
            "rows": len(rows), "files_covered": covered,
            "buckets": len(buckets),
            "sample_buckets": sorted(buckets)[:12],
            "note": "" if covered else
                    "populated nowhere this query can see — the column exists "
                    "but has no usable values for these files",
        })

    return {
        "by_file": by_file,
        "spine": first[0] if first else "none",
        "spine_label": first[1] if first else "Source",
        "resolved": len(by_file),
        "report": {"resolvers": report,
                   "files_requested": len(want) if want else None,
                   "files_resolved": len(by_file),
                   "spine": first[0] if first else "none"},
    }
