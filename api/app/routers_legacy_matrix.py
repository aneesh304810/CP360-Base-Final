"""Dependency MATRIX — which source file feeds which PBDW table, and how thickly.

WHY A MATRIX

The Swimlanes screen lists a functional group's sources in one column and its
targets in another, and draws nothing between them. Membership is visible;
connection is not. An analyst cannot answer the question the screen is named
for — "which of these 13 sources feeds DIM_ACCOUNT?" — from two lists.

At this grain (a group is ~13 sources x ~11 targets) a wired bipartite graph is
a hairball, but the same data as a grid fits one screen with no crossing lines:

    row across     blast radius   — everything this feed touches
    column down    root cause     — everything that feeds this table
    cell           thickness      — how many warehouse columns actually flow
    empty column   ORPHAN         — a warehouse table nothing feeds
    empty row      DEAD SOURCE    — a declared source that feeds nothing

The last two are the point. An orphan column is the migration risk register —
the tables that lose their source when AddVantage is switched off. An empty row
is almost always a defect in the sheet, and this endpoint names the two kinds
seen in the live data rather than rendering them as though they were tables.

SOURCE OF TRUTH

legacy_lineage, not legacy_table_dependency — the same place /dependency-network
builds its edges from, so the matrix cannot disagree with the swimlanes it
replaces. legacy_table_dependency is a separate, hand-maintained sheet; joining
the two here would invent disagreements to explain.

THICKNESS is COUNT(DISTINCT dwh_target_column): how many warehouse columns on
that target come from that source. Counting rows instead would double-count,
because legacy_lineage's grain is (target column x source).
"""
from __future__ import annotations
import logging
import re as _re
from fastapi import APIRouter

from ._legacy_compat import (
    _safe, _ds_scoped, _MAPPED_SQL, _file_key, _peel_feed_key,
)

log = logging.getLogger("cp.api.legacy_matrix")
router = APIRouter(prefix="/legacy-lineage", tags=["legacy-lineage"])

_NO_GROUP = "Unassigned"

# A group wider than this is past the point where a grid reads at a glance;
# the UI paginates the columns rather than shrinking them to nothing.
MAX_COLS = 40

# The sheet's literal spellings of "absent". Same list isNA() uses in the UI —
# a source called "NA" is not a source, it is an empty cell someone typed into.
_NA_RE = _re.compile(r"^(n/?a|not applicable|none|null|-+)$", _re.I)

# Two table names crammed into one cell, seen live as
#   Addv-ACCT-Recon-Feed_*.dat----SRC_FIS_ACCOUNT_REVIEW_RECON
# Deliberately narrow: this matches the separator actually observed. Widening
# it to "any run of punctuation" would start splitting legitimate names, and a
# wrong split is worse than a flagged one — the point is to report the cell to
# whoever maintains the sheet, not to guess what they meant.
_COMPOUND_RE = _re.compile(r"-{3,}|\s+-{2,}\s+")


def _defect(src: str):
    """What is wrong with this source name, if anything."""
    s = str(src or "").strip()
    if not s or _NA_RE.match(s):
        return {"kind": "literal_na",
                "note": "the sheet's text for 'absent', loaded as a table name"}
    if _COMPOUND_RE.search(s):
        parts = [p for p in _COMPOUND_RE.split(s) if p.strip()]
        return {"kind": "compound",
                "note": "two table names in one cell",
                "parts": [p.strip() for p in parts]}
    return None


@router.get("/dependency-matrix")
def dependency_matrix(data_source: str | None = None, group: str | None = None,
                      min_links: int = 0):
    """Source file x warehouse table, per functional group.

    group= restricts to one functional group; omitted, every group is returned
    (the UI renders one matrix per group, which is how the screen is already
    organised).
    """
    params: dict = {}
    where = ""
    if group:
        where = " AND NVL(functional_group, :g) = :g "
        params["g"] = group

    rows = _ds_scoped(f"""
        SELECT NVL(functional_group, '{_NO_GROUP}') AS grp,
               src_source_table AS src,
               dwh_target_table AS tgt,
               COUNT(DISTINCT dwh_target_column) AS links,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN dwh_target_column END) AS mapped
        FROM legacy_lineage
        WHERE src_source_table IS NOT NULL
          AND dwh_target_table IS NOT NULL {where} {{DS}}
        GROUP BY NVL(functional_group, '{_NO_GROUP}'),
                 src_source_table, dwh_target_table""", params, data_source)

    # Every target in the group, INCLUDING the ones no source reaches. A target
    # that never appears above is exactly the orphan the matrix exists to show,
    # so it cannot be discovered from the query that only sees fed tables.
    all_tgt = _ds_scoped(f"""
        SELECT NVL(functional_group, '{_NO_GROUP}') AS grp,
               dwh_target_table AS tgt,
               COUNT(DISTINCT dwh_target_column) AS cols
        FROM legacy_lineage
        WHERE dwh_target_table IS NOT NULL {where} {{DS}}
        GROUP BY NVL(functional_group, '{_NO_GROUP}'), dwh_target_table""",
        params, data_source)

    # CP_SOURCE_FILE: the feed's business name. _safe, not _ds_scoped — the
    # table is new, so a checkout without sql/50 gets [] and every source keeps
    # its filename. Nothing here depends on the join succeeding.
    feeds = _safe("""SELECT src_file, src_file_key, dataset
                     FROM legacy_source_file WHERE dataset IS NOT NULL""", {})
    by_key, by_name = {}, {}
    for f in feeds:
        if f.get("src_file_key"):
            by_key.setdefault(f["src_file_key"], f["dataset"])
        if f.get("src_file"):
            by_name.setdefault(str(f["src_file"]).strip().upper(), f["dataset"])

    def _dataset(src: str):
        """Three chances at a business name, cheapest first — the same rule
        /sources uses, through the same shared helpers rather than a local
        copy of the regex."""
        k = _file_key(src)
        return (by_name.get(str(src or "").strip().upper())
                or by_key.get(k) or by_key.get(_peel_feed_key(k)))

    # ---- fold into one matrix per group ------------------------------------
    groups: dict[str, dict] = {}
    for r in rows:
        if (r.get("links") or 0) < min_links:
            continue
        g = groups.setdefault(r["grp"], {"group": r["grp"], "_src": {},
                                         "_tgt": {}, "_cell": {}})
        g["_src"].setdefault(r["src"], 0)
        g["_src"][r["src"]] += r.get("links") or 0
        g["_cell"][(r["src"], r["tgt"])] = {"n": r.get("links") or 0,
                                            "m": r.get("mapped") or 0}

    for r in all_tgt:
        g = groups.setdefault(r["grp"], {"group": r["grp"], "_src": {},
                                         "_tgt": {}, "_cell": {}})
        g["_tgt"][r["tgt"]] = r.get("cols") or 0

    out = []
    for g in groups.values():
        # Sources: thickest first, but every defect sinks to the bottom — they
        # are not sources and should not head the list.
        srcs = sorted(g["_src"].keys(),
                      key=lambda s: (_defect(s) is not None, -g["_src"][s], s))
        # Targets that nothing feeds sort last, where an empty column is
        # obvious rather than lost among the fed ones.
        fed = {t for (_s, t) in g["_cell"]}
        tgts = sorted(g["_tgt"].keys(),
                      key=lambda t: (t not in fed, -g["_tgt"][t], t))

        s_ix = {s: i for i, s in enumerate(srcs)}
        t_ix = {t: i for i, t in enumerate(tgts)}
        cells = [{"s": s_ix[s], "t": t_ix[t], "n": v["n"], "m": v["m"]}
                 for (s, t), v in g["_cell"].items()
                 if s in s_ix and t in t_ix]

        src_rows = []
        for s in srcs:
            d = _defect(s)
            reach = sum(1 for (a, _b) in g["_cell"] if a == s)
            src_rows.append({"src": s, "dataset": _dataset(s), "defect": d,
                             "reach": reach, "links": g["_src"].get(s, 0)})
        tgt_rows = []
        for t in tgts:
            feeders = sum(1 for (_a, b) in g["_cell"] if b == t)
            tgt_rows.append({"tgt": t, "columns": g["_tgt"].get(t, 0),
                             "sources": feeders, "orphan": feeders == 0})

        out.append({
            "group": g["group"], "sources": src_rows, "targets": tgt_rows,
            "cells": cells, "truncated": len(tgts) > MAX_COLS,
            "stats": {
                "sources": len(src_rows), "targets": len(tgt_rows),
                "links": sum(c["n"] for c in cells),
                "orphans": sum(1 for t in tgt_rows if t["orphan"]),
                "dead_sources": sum(1 for s in src_rows if s["reach"] == 0),
                "defects": sum(1 for s in src_rows if s["defect"]),
            },
        })

    out.sort(key=lambda x: -x["stats"]["links"])
    return {"data_source": (data_source or "").upper() or None,
            "groups": out,
            "totals": {
                "groups": len(out),
                "orphans": sum(x["stats"]["orphans"] for x in out),
                "defects": sum(x["stats"]["defects"] for x in out),
                "links": sum(x["stats"]["links"] for x in out),
            }}


@router.get("/table-explorer")
def table_explorer(table: str, data_source: str | None = None,
                   src: str | None = None, limit: int = 60):
    """One table in focus: what feeds it, on which columns, and what it feeds.

    UPSTREAM and COLUMN LINKS come from legacy_lineage, which is column-level
    and knows the SRC -> STG1 -> STG2 -> DWH chain.

    DOWNSTREAM comes from legacy_table_dependency, and that split is not
    arbitrary. legacy_lineage's spine ends at DWH, so within it a warehouse
    table never feeds anything — asking it for downstream returns nothing for
    every DIM_ and FACT_ table, which is exactly the empty panel the old
    explorer showed. Table-level warehouse-to-warehouse links live in the
    dependency sheet, so that is where downstream is read from.

    src= narrows the column links to one upstream source, which is what
    clicking an upstream row does.
    """
    params: dict = {"t": table}
    head = _ds_scoped(f"""
        SELECT NVL(functional_group, '{_NO_GROUP}') AS grp,
               NVL(table_type, 'TABLE') AS table_type,
               COUNT(DISTINCT dwh_target_column) AS columns_,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN dwh_target_column END) AS mapped,
               COUNT(DISTINCT CASE WHEN src_source_table IS NOT NULL
                                   THEN dwh_target_column END) AS sourced
        FROM legacy_lineage
        WHERE dwh_target_table = :t {{DS}}
        GROUP BY NVL(functional_group, '{_NO_GROUP}'),
                 NVL(table_type, 'TABLE')""", params, data_source)
    h = head[0] if head else {}

    ups = _ds_scoped(f"""
        SELECT src_source_table AS src,
               COUNT(DISTINCT dwh_target_column) AS links,
               COUNT(DISTINCT CASE WHEN {_MAPPED_SQL}
                                   THEN dwh_target_column END) AS mapped
        FROM legacy_lineage
        WHERE dwh_target_table = :t AND src_source_table IS NOT NULL {{DS}}
        GROUP BY src_source_table
        ORDER BY COUNT(DISTINCT dwh_target_column) DESC""", params, data_source)

    feeds = _safe("""SELECT src_file, src_file_key, dataset
                     FROM legacy_source_file WHERE dataset IS NOT NULL""", {})
    by_key, by_name = {}, {}
    for f in feeds:
        if f.get("src_file_key"):
            by_key.setdefault(f["src_file_key"], f["dataset"])
        if f.get("src_file"):
            by_name.setdefault(str(f["src_file"]).strip().upper(), f["dataset"])

    def _name(s):
        k = _file_key(s)
        return (by_name.get(str(s or "").strip().upper())
                or by_key.get(k) or by_key.get(_peel_feed_key(k)))

    top = max((u.get("links") or 0) for u in ups) if ups else 0
    upstream = [{"src": u["src"], "dataset": _name(u["src"]),
                 "links": u.get("links") or 0, "mapped": u.get("mapped") or 0,
                 "defect": _defect(u["src"]),
                 # width relative to the thickest feed, so the bars compare
                 # within this table rather than against an absolute scale
                 "share": round(100 * (u.get("links") or 0) / top) if top else 0}
                for u in ups]

    col_params = dict(params)
    src_clause = ""
    if src:
        src_clause = " AND src_source_table = :s "
        col_params["s"] = src
    cols = _ds_scoped(f"""
        SELECT src_source_table AS src, src_source_column AS src_column,
               dwh_target_column AS dwh_column, dwh_type, dwh_length,
               lineage_status,
               CASE WHEN {_MAPPED_SQL} THEN 'Y' ELSE 'N' END AS is_mapped
        FROM legacy_lineage
        WHERE dwh_target_table = :t
          AND dwh_target_column IS NOT NULL {src_clause} {{DS}}
        ORDER BY dwh_target_column""", col_params, data_source)

    # Downstream: the table-level sheet, for the reason in the docstring.
    # Not DS-scoped — legacy_table_dependency has no data_source column.
    downs = _safe("""
        SELECT target_table AS tgt, target_function,
               COUNT(DISTINCT column_link) AS links
        FROM legacy_table_dependency
        WHERE source_table = :t AND target_table IS NOT NULL
          AND NVL(UPPER(source_function), 'X') <> 'EXCLUDE'
        GROUP BY target_table, target_function
        ORDER BY COUNT(DISTINCT column_link) DESC""", {"t": table})

    n_cols = h.get("columns_") or 0
    return {
        "table": table,
        "data_source": (data_source or "").upper() or None,
        "functional_group": h.get("grp"),
        "table_type": h.get("table_type"),
        "columns": n_cols,
        "mapped": h.get("mapped") or 0,
        # columns of this table that no source reaches — derived in the
        # warehouse, or a gap. The screen should not imply which.
        "unsourced": n_cols - (h.get("sourced") or 0),
        "upstream": upstream,
        "column_links": [dict(c) for c in cols[:limit]],
        "column_links_total": len(cols),
        "column_links_src": src,
        "downstream": [{"tgt": d["tgt"], "links": d.get("links") or 0,
                        "function": d.get("target_function")} for d in downs],
    }
