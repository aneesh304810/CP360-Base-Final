"""Column-level lineage GRAPH for the Technical view.

Why a separate module: the existing /legacy-lineage endpoints answer "what is
the chain for THIS column" — one row, one path. The graph answers the three
questions a chain cannot:

  * FAN-IN      two source files feeding one DWH column (a merge rule)
  * FAN-OUT     one code landing in several DWH columns
  * PARALLEL    the SAME AddVantage code running as INDEPENDENT chains through
                different masters — BI/2-1 is Account Long Name AND Interested
                Party Full Name AND Security Name. Stated as prose in
                "same code, other masters"; as three lanes it is obvious.

Everything is derived from legacy_lineage as it stands — no schema change.
One row is already a whole chain (src_* -> stg1_* -> stg2_* -> dwh_*), so a
row yields 4 nodes and 3 edges; the graph is the union over the rows that
share a canonical code or a target column.

Helpers are imported from routers_legacy_lineage so the canonicalisation,
warehouse scoping and master resolution stay defined in exactly one place. If
that module is older than this one the import raises and main.py's guarded
mount loop logs and skips this router — the rest of the API is unaffected.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter

from .routers_legacy_lineage import (
    _safe, _ds_scoped, _norm_code, _master_from_context,
)

log = logging.getLogger("cp.api.legacy_graph")
router = APIRouter(prefix="/legacy-lineage", tags=["legacy-lineage"])

# A runaway code (a code used by hundreds of columns) would return a graph no
# one can read and a payload no one wants. Cap the chains and say so.
MAX_CHAINS = 40

# Both loader conventions mean "mapped": the rich sheet writes 'Exists',
# the 4-column loader writes 'mapped'.
_MAPPED = ("mapped", "exists")

_STAGES = ("SRC", "STG1", "STG2", "DWH")

_GRAPH_COLS = """
        lineage_id, NVL(data_source, 'PBDW') AS data_source,
        NVL(functional_group, 'Unassigned') AS functional_group,
        src_source_table,  src_source_column,  src_to_stg1_transform,
        stg1_source_table, stg1_source_column, stg1_type, stg1_length,
        stg1_to_stg2_transform,
        stg2_source_table, stg2_source_column, stg2_type, stg2_length,
        stg2_to_dwh_transform,
        dwh_target_table,  dwh_target_column,  dwh_type,  dwh_length,
        lineage_status, is_ud, ud_key
"""

# The canonicalisation, in SQL, matching _norm_code() exactly.
# NOTE the '_\\1' escape: written '_\1' Python parses it as chr(1) and Oracle
# never receives the backreference, so BI_2_L1 silently fails to collapse to
# BI_2_1. That bug is documented on /dictionary; do not "simplify" it.
_CANON_SQL = r"""REGEXP_REPLACE(
        UPPER(TRIM('_' FROM REGEXP_REPLACE(src_source_column,
              '[[:space:]/.-]+', '_'))),
        '_L([0-9]+)', '_\1')"""


def _nid(stage: str, table, column) -> str | None:
    """Stable node id — the UI focuses and traces on this, nothing else."""
    if not table or not column:
        return None
    return f"{stage.lower()}:{table}:{column}"


def _is_na(v) -> bool:
    return "not applicable" in str(v or "").lower()


def _hop(stage_to: str, a_col, b_col, transform) -> dict:
    """Classify one hop. The kind drives edge colour and dash in the UI, so the
    rule lives here rather than being re-derived per client."""
    xf = "" if _is_na(transform) else str(transform or "").strip()
    a_n, b_n = _norm_code(a_col), _norm_code(b_col)

    if stage_to == "STG1":
        # canon() makes the field-code legal as a column name: BI_2_L1 -> BI_2_1.
        # Same field, new spelling — the value is untouched.
        if a_col and b_col and a_col != b_col and a_n == b_n:
            return {"kind": "phys", "label": "PHYSICALISED",
                    "transform": xf or f"canon({a_col})"}
    if stage_to == "STG2":
        if "trim" in xf.lower():
            return {"kind": "trim", "label": "TRIMMED", "transform": xf}
    if a_n and b_n and a_n != b_n:
        return {"kind": "ren", "label": "RENAMED", "transform": xf or "RENAME"}
    return {"kind": "direct", "label": "", "transform": xf}


def _chain_nodes_edges(r: dict) -> tuple[list[dict], list[dict]]:
    """One legacy_lineage row -> up to 4 nodes and 3 edges."""
    steps = [
        ("SRC",  r.get("src_source_table"),  r.get("src_source_column"),  None, None),
        ("STG1", r.get("stg1_source_table"), r.get("stg1_source_column"),
         r.get("stg1_type"), r.get("stg1_length")),
        ("STG2", r.get("stg2_source_table"), r.get("stg2_source_column"),
         r.get("stg2_type"), r.get("stg2_length")),
        ("DWH",  r.get("dwh_target_table"),  r.get("dwh_target_column"),
         r.get("dwh_type"), r.get("dwh_length")),
    ]
    xf_into = {"STG1": r.get("src_to_stg1_transform"),
               "STG2": r.get("stg1_to_stg2_transform"),
               "DWH":  r.get("stg2_to_dwh_transform")}

    mapped = str(r.get("lineage_status") or "").lower() in _MAPPED
    master = _master_from_context(r.get("src_source_table"),
                                  r.get("stg1_source_table"),
                                  r.get("dwh_target_table"))
    nodes, edges, prev = [], [], None
    for stage, tbl, col, ty, ln in steps:
        nid = _nid(stage, tbl, col)
        if not nid:
            prev = None          # chain stops here; do not bridge the gap
            continue
        nodes.append({
            "id": nid, "stage": stage, "table": tbl, "column": col,
            "type": ty, "length": ln, "master": master,
            "data_source": r.get("data_source") if stage == "DWH" else None,
            "status": "mapped" if mapped else (r.get("lineage_status") or "unmapped"),
        })
        if prev:
            hop = _hop(stage, prev["column"], col, xf_into.get(stage))
            edges.append({"from": prev["id"], "to": nid,
                          "lineage_id": r.get("lineage_id"), **hop})
        prev = {"id": nid, "column": col}
    return nodes, edges


@router.get("/graph")
def graph(table: str | None = None, column: str | None = None,
          code: str | None = None, data_source: str | None = None,
          include_parallel: bool = True):
    """Column-level lineage neighbourhood, as nodes + edges.

    Address it either way:
      /legacy-lineage/graph?table=DIM_ACCOUNT&column=ACCOUNT_LONG_NAME_1
      /legacy-lineage/graph?code=BI/2-1

    include_parallel=false restricts the graph to the chains that actually
    reach the focus column (its own chain plus anything merging into it), and
    drops the same-code chains through other masters.
    """
    focus_code = _norm_code(code) if code else ""
    focus_id = None

    # ---- resolve the focus column -> its canonical source code -------------
    if table and column:
        seed = _ds_scoped(f"""
            SELECT src_source_column, dwh_target_table, dwh_target_column,
                   lineage_status
            FROM legacy_lineage
            WHERE dwh_target_table = :t AND dwh_target_column = :c {{DS}}
            ORDER BY CASE WHEN LOWER(lineage_status) IN ('mapped', 'exists')
                          THEN 0 ELSE 1 END,
                     src_source_column NULLS LAST""",
            {"t": table, "c": column}, data_source)
        focus_id = _nid("DWH", table, column)
        if seed and not focus_code:
            focus_code = _norm_code(seed[0].get("src_source_column"))

    if not focus_code and not (table and column):
        return {"focus": None, "code": None, "nodes": [], "edges": [],
                "stats": {}, "truncated": False,
                "detail": "pass table+column or code"}

    # ---- gather the rows the graph is built from ---------------------------
    rows: dict[str, dict] = {}

    def _take(rs):
        for r in rs:
            lid = r.get("lineage_id") or repr(sorted(r.items()))
            rows.setdefault(lid, r)

    # every chain carrying this code — parallel masters and fan-out
    if focus_code and include_parallel:
        _take(_ds_scoped(f"""
            SELECT {_GRAPH_COLS}
            FROM legacy_lineage
            WHERE src_source_column IS NOT NULL {{DS}}
              AND {_CANON_SQL} = :c
            ORDER BY dwh_target_table, dwh_target_column""",
            {"c": focus_code}, data_source))

    # every chain landing on the focus column — fan-in (incl. its own chain)
    if table and column:
        _take(_ds_scoped(f"""
            SELECT {_GRAPH_COLS}
            FROM legacy_lineage
            WHERE dwh_target_table = :t AND dwh_target_column = :c {{DS}}
            ORDER BY CASE WHEN LOWER(lineage_status) IN ('mapped', 'exists')
                          THEN 0 ELSE 1 END""",
            {"t": table, "c": column}, data_source))
    elif focus_code and not include_parallel:
        # code-addressed but parallel chains suppressed: keep the code's own rows
        _take(_ds_scoped(f"""
            SELECT {_GRAPH_COLS}
            FROM legacy_lineage
            WHERE src_source_column IS NOT NULL {{DS}}
              AND {_CANON_SQL} = :c""", {"c": focus_code}, data_source))

    chains = list(rows.values())
    truncated = len(chains) > MAX_CHAINS
    if truncated:
        # keep the focus column's own chains first, then fill
        chains.sort(key=lambda r: (
            0 if (table and r.get("dwh_target_table") == table
                  and r.get("dwh_target_column") == column) else 1,
            str(r.get("dwh_target_table") or ""),
            str(r.get("dwh_target_column") or "")))
        chains = chains[:MAX_CHAINS]

    # ---- fold rows into a node/edge set ------------------------------------
    nodes: dict[str, dict] = {}
    edges: dict[tuple, dict] = {}
    for r in chains:
        ns, es = _chain_nodes_edges(r)
        for n in ns:
            cur = nodes.get(n["id"])
            if cur is None:
                nodes[n["id"]] = n
            else:
                # the same node reached by several chains: keep the richest
                for k in ("type", "length", "master", "data_source"):
                    if not cur.get(k) and n.get(k):
                        cur[k] = n[k]
                if n["status"] == "mapped":
                    cur["status"] = "mapped"
        for e in es:
            edges.setdefault((e["from"], e["to"]), e)

    # ---- fan-in: a node fed by more than one distinct upstream is a merge ---
    incoming: dict[str, int] = {}
    outgoing: dict[str, int] = {}
    for (a, b) in edges:
        incoming[b] = incoming.get(b, 0) + 1
        outgoing[a] = outgoing.get(a, 0) + 1
    for (a, b), e in edges.items():
        if incoming.get(b, 0) > 1:
            e["kind"] = "merge"
            e["label"] = e["label"] or "MERGE"
    for nid, n in nodes.items():
        n["fan_in"] = incoming.get(nid, 0)
        n["fan_out"] = outgoing.get(nid, 0)

    if focus_id and focus_id not in nodes:
        focus_id = None

    masters = sorted({n["master"] for n in nodes.values() if n.get("master")})
    dwh_cols = {n["id"] for n in nodes.values() if n["stage"] == "DWH"}
    return {
        "focus": focus_id,
        "code": focus_code or None,
        "data_source": (data_source or "").upper() or None,
        "stages": list(_STAGES),
        "nodes": sorted(nodes.values(),
                        key=lambda n: (_STAGES.index(n["stage"]),
                                       n["table"] or "", n["column"] or "")),
        "edges": list(edges.values()),
        "stats": {
            "chains": len(chains),
            "masters": len(masters),
            "master_names": masters,
            "targets": len(dwh_cols),
            "fan_in": sum(1 for v in incoming.values() if v > 1),
            "fan_out": sum(1 for v in outgoing.values() if v > 1),
        },
        "truncated": truncated,
        "max_chains": MAX_CHAINS,
    }
