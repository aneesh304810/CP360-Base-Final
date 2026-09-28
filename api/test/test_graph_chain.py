"""One LEGACY_LINEAGE row must always produce a connected chain.

WHY. A lineage row IS the assertion that this source column feeds this
target column. The builder used to break the chain at any missing stage —
`prev = None; continue`, commented "do not bridge the gap" — which is
right when a stage is missing because the data is incomplete and wrong
when the lane HAS no staging. A STAR extract lands in IMDS directly, so
STG1 and STG2 are null on every STAR row, and the graph drew a source
column and a warehouse column side by side with nothing between them.
The picture contradicted the row it was drawn from.

    python api/test/test_graph_chain.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# _chain_nodes_edges is pure; importing the module pulls in the router's
# db helpers, which is fine — nothing here touches a connection.
from api.app.routers_legacy_graph import _chain_nodes_edges   # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


def row(**kw):
    base = {"data_source": "IMDS", "lineage_id": "L1",
            "lineage_status": "MAPPED",
            "src_source_table": None, "src_source_column": None,
            "stg1_source_table": None, "stg1_source_column": None,
            "stg1_type": None, "stg1_length": None,
            "stg2_source_table": None, "stg2_source_column": None,
            "stg2_type": None, "stg2_length": None,
            "dwh_target_table": None, "dwh_target_column": None,
            "dwh_type": None, "dwh_length": None,
            "src_to_stg1_transform": None, "stg1_to_stg2_transform": None,
            "stg2_to_dwh_transform": None}
    base.update(kw)
    return base


def connected(nodes, edges):
    """Every node reachable from the first, treating edges as undirected."""
    if len(nodes) < 2:
        return True
    ids = {n["id"] for n in nodes}
    adj = {i: set() for i in ids}
    for e in edges:
        if e["from"] in adj and e["to"] in adj:
            adj[e["from"]].add(e["to"])
            adj[e["to"]].add(e["from"])
    seen, stack = set(), [nodes[0]["id"]]
    while stack:
        x = stack.pop()
        if x in seen:
            continue
        seen.add(x)
        stack.extend(adj[x] - seen)
    return seen == ids


# ---- the STAR case: no staging at all -----------------------------------
r = row(src_source_table="PEDDIFI1", src_source_column="Amortization_Yield_135",
        dwh_target_table="HOLDINGDBO.LOT_LEVEL_POSITION",
        dwh_target_column="amt_yld",
        src_to_stg1_transform="trim", stg1_to_stg2_transform="to_number",
        stg2_to_dwh_transform="round(x,6)")
n, e = _chain_nodes_edges(r)
ok(len(n) == 2, "two nodes when the lane has no staging", [x["stage"] for x in n])
ok(len(e) == 1, "and ONE edge joining them — not zero", len(e))
ok(connected(n, e), "the chain is connected")
ok(e[0]["kind"] == "bridged",
   "the edge is marked bridged, not passed off as a documented hop", e[0])
ok(e[0].get("skipped") == ["STG1", "STG2"],
   "and names the stages it skipped", e[0].get("skipped"))
for x in ("trim", "to_number", "round(x,6)"):
    ok(x in (e[0].get("transform") or ""),
       f"the skipped hop's transform is carried: {x}", e[0].get("transform"))

# ---- a full chain is untouched -------------------------------------------
r = row(src_source_table="F", src_source_column="a",
        stg1_source_table="G", stg1_source_column="b",
        stg2_source_table="H", stg2_source_column="c",
        dwh_target_table="W", dwh_target_column="d",
        src_to_stg1_transform="t1", stg1_to_stg2_transform="t2",
        stg2_to_dwh_transform="t3")
n, e = _chain_nodes_edges(r)
ok(len(n) == 4 and len(e) == 3, "a full chain is four nodes and three edges",
   (len(n), len(e)))
ok(all(x["kind"] != "bridged" for x in e),
   "none of them bridged", [x["kind"] for x in e])
ok(connected(n, e), "and connected")

# ---- one middle stage missing --------------------------------------------
r = row(src_source_table="F", src_source_column="a",
        stg2_source_table="H", stg2_source_column="c",
        dwh_target_table="W", dwh_target_column="d",
        src_to_stg1_transform="t1", stg1_to_stg2_transform="t2")
n, e = _chain_nodes_edges(r)
ok(len(n) == 3 and len(e) == 2, "three nodes, two edges", (len(n), len(e)))
ok(connected(n, e), "still connected")
bridged = [x for x in e if x["kind"] == "bridged"]
ok(len(bridged) == 1 and bridged[0]["skipped"] == ["STG1"],
   "exactly the one that skipped STG1 is bridged", bridged)
ok("t1" in bridged[0]["transform"] and "t2" in bridged[0]["transform"],
   "carrying both transforms across the gap", bridged[0]["transform"])

# ---- no target at all ----------------------------------------------------
r = row(src_source_table="F", src_source_column="a")
n, e = _chain_nodes_edges(r)
ok(len(n) == 1 and len(e) == 0,
   "a source with no target is one node and no invented edge", (len(n), len(e)))

# ---- no source at all: the NO_SOURCE shape -------------------------------
r = row(dwh_target_table="W", dwh_target_column="d")
n, e = _chain_nodes_edges(r)
ok(len(n) == 1 and len(e) == 0,
   "a target with no source is one node and no invented edge", (len(n), len(e)))

# ---- an empty row --------------------------------------------------------
n, e = _chain_nodes_edges(row())
ok(n == [] and e == [], "an empty row produces nothing", (n, e))

# ---- 'not applicable' transforms are not carried -------------------------
r = row(src_source_table="F", src_source_column="a",
        dwh_target_table="W", dwh_target_column="d",
        src_to_stg1_transform="Not applicable",
        stg1_to_stg2_transform="Not Applicable")
n, e = _chain_nodes_edges(r)
ok(len(e) == 1, "still one edge", len(e))
ok("applicable" not in (e[0].get("transform") or "").lower(),
   "a 'not applicable' transform is not carried onto the bridge",
   e[0].get("transform"))

print()
print(f"{BAD} failure(s)" if BAD else "every chain is connected; all assertions pass")
sys.exit(1 if BAD else 0)
