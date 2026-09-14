"""Feed / Loader Interdependency router.

Computes how feeds (or loaders) relate to each other through shared KEY fields
(account_number, portfolio_id, client_id, form_id, ...). Each shared key is an
edge; the key's business description is carried on the edge so a business user
understands *why* two feeds connect, and so a match/mismatch on the description
validates the join.

Endpoints:
  /data360/feed-graph      -> nodes (feeds) + edges (shared keys) + hubs
  /data360/loader-graph    -> same for loaders
Both accept ?domain= to focus a business domain (edges kept if either side is in it).

Data source: the `columns` table (existing). No new ingestion.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter
from .db import query

log = logging.getLogger("cp.api.interdep")


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("interdep query failed: %s", str(e)[:160])
        return []


router = APIRouter(prefix="/data360", tags=["interdependency"])

# Curated allowlist of KEY / identifier fields that form meaningful joins.
# Kept explicit (not pure pattern-match) so edges stay business-meaningful.
KEY_PATTERNS = [
    "account_number", "account_id", "portfolio_id", "client_id", "form_id",
    "position_id", "asset_id", "taxlot_id", "fee_schedule_id", "household_id",
    "instrument_id", "security_id", "transaction_id", "order_id", "trade_id",
    "cusip", "isin", "sedol",
]


def _clob(v):
    if v is None:
        return None
    try:
        return v.read() if hasattr(v, "read") else str(v)
    except Exception:  # noqa: BLE001
        return None


def _build_graph(object_type: str, domain: str | None):
    """object_type: 'FEED' or 'LOADER'. Returns nodes, edges, hubs.

    FEED nodes come from datasets(object_type='FEED') joined to columns.
    LOADER nodes come from columns(schema_name='LOADERS') joined to ldr_catalog
    for the business domain (loaders are not registered as datasets rows).
    """
    like_clauses = " OR ".join(
        [f"LOWER(c.column_name) LIKE :p{i}" for i in range(len(KEY_PATTERNS))]
    )
    params = {f"p{i}": f"%{k}%" for i, k in enumerate(KEY_PATTERNS)}

    if object_type == "LOADER":
        # loaders live in columns(schema='LOADERS'); domain from ldr_catalog/loader_catalog
        rows = _safe(f"""
            SELECT c.object_name AS node,
                   COALESCE(lc.loader_name, lc2.loader_name, c.object_name) AS display_name,
                   COALESCE(lc.business_domain, lc2.business_domain, 'Unassigned') AS domain,
                   LOWER(c.column_name) AS col,
                   COALESCE(c.business_desc, c.tech_desc) AS descr
            FROM columns c
            LEFT JOIN ldr_catalog lc ON UPPER(lc.loader_id) = c.object_name
            LEFT JOIN loader_catalog lc2 ON UPPER(lc2.loader_id) = c.object_name
            WHERE c.schema_name = 'LOADERS'
              AND ({like_clauses})
        """, params)
    else:
        rows = _safe(f"""
            SELECT d.object_name AS node, d.object_name AS display_name, d.domain AS domain,
                   LOWER(c.column_name) AS col,
                   COALESCE(c.business_desc, c.tech_desc) AS descr
            FROM datasets d
            JOIN columns c
              ON c.platform_id = d.platform_id
             AND c.schema_name = d.schema_name
             AND c.object_name = d.object_name
            WHERE d.object_type = :ot
              AND ({like_clauses})
        """, {"ot": object_type, **params})

    # normalize the column to its canonical key (first pattern it contains)
    def canon(col):
        for k in KEY_PATTERNS:
            if k in col:
                return k
        return col

    # node registry + key -> [(node, descr)]
    nodes = {}
    key_members = {}  # key -> { node -> descr }
    for r in rows:
        node = r.get("node")
        dom = r.get("domain") or "Unassigned"
        descr = _clob(r.get("descr"))
        if not node:
            continue
        nodes.setdefault(node, {"id": node, "name": r.get("display_name") or node, "domain": dom})
        k = canon(r.get("col") or "")
        key_members.setdefault(k, {})
        # keep the first non-null description seen for (key, node)
        if node not in key_members[k] or (descr and not key_members[k][node]):
            key_members[k][node] = descr

    # 2) edges: for each key, connect every pair of nodes that carry it
    edges = []
    hubs = []
    for k, members in key_members.items():
        member_nodes = list(members.keys())
        if len(member_nodes) < 2:
            continue
        # hub summary
        descrs = [d for d in members.values() if d]
        # match if all present descriptions agree (case-insensitive, trimmed)
        norm = {(" ".join((d or "").split())).lower() for d in descrs}
        match = "exact" if len(norm) <= 1 else "mismatch"
        hub_descr = descrs[0] if descrs else None
        hubs.append({
            "key": k, "business_desc": hub_descr,
            "feeds": member_nodes, "count": len(member_nodes),
            "match": match,
        })
        for i in range(len(member_nodes)):
            for j in range(i + 1, len(member_nodes)):
                a, b = member_nodes[i], member_nodes[j]
                da, db = members[a], members[b]
                na = (" ".join((da or "").split())).lower()
                nb = (" ".join((db or "").split())).lower()
                edges.append({
                    "a": a, "b": b, "key": k,
                    "business_desc": da or db,
                    "match": "mismatch" if (na and nb and na != nb) else "exact",
                    "cross_domain": nodes[a]["domain"] != nodes[b]["domain"],
                })

    # 3) optional domain focus (keep edge if either side is in the domain)
    node_list = list(nodes.values())
    if domain:
        keep = {n["id"] for n in node_list if n["domain"] == domain}
        # also keep nodes directly connected to the focused domain
        for e in edges:
            if nodes[e["a"]]["domain"] == domain or nodes[e["b"]]["domain"] == domain:
                keep.add(e["a"]); keep.add(e["b"])
        node_list = [n for n in node_list if n["id"] in keep]
        edges = [e for e in edges if e["a"] in keep and e["b"] in keep]

    # dedupe edges by (a,b,key)
    seen = set()
    deduped = []
    for e in edges:
        sig = tuple(sorted([e["a"], e["b"]])) + (e["key"],)
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(e)

    return {"nodes": node_list, "edges": deduped, "hubs": sorted(hubs, key=lambda h: -h["count"])}


@router.get("/feed-graph")
def feed_graph(domain: str | None = None):
    return _build_graph("FEED", domain)


@router.get("/loader-graph")
def loader_graph(domain: str | None = None):
    # loaders are catalogued in ldr_catalog / datasets(object_type='LOADER') depending
    # on the environment; try LOADER datasets first, and if empty the UI still renders.
    g = _build_graph("LOADER", domain)
    return g
