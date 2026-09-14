"""
Business flow generator for API 360.

Turns the endpoint dependency graph (produces/consumes entities, already parsed
from the enriched Postman collections) into ordered business-flow sequences:
"to achieve <function>, call these endpoints in this order."

Approach:
  - Build a producer map: entity -> endpoint that produces it.
  - For each "goal" endpoint (a meaningful terminal action — typically a GET/report
    or a POST that consumes several entities), walk its consumes backward through
    producers to assemble the ordered prerequisite chain, then append the goal.
  - Auth (access_token) is always step 1 if any step needs it.
  - Topologically order the collected steps so producers precede consumers.
  - Assign a generated_name from the goal endpoint; the BA can override later.

The generator writes api_business_flows + api_business_flow_steps. It only sets
generated_name / goal / persona defaults and NEVER overwrites a BA's business_name,
goal, persona, or is_published once set (protect= on the merge).
"""
from __future__ import annotations
import logging
import re
from collections import defaultdict

log = logging.getLogger("cp.api_flow_gen")

AUTH_ENTITY = "access_token"
# entities that are "infrastructure", present in many flows; not worth chaining on
COMMON = {"access_token", "AppKey", "AppSecret", "base_url", "baseUrl",
          "swp_token", "firmId", "processingOrgId"}


def _humanize(endpoint_key: str, op_id: str | None) -> str:
    """Make a readable flow name from the goal endpoint."""
    if op_id:
        # retrieveInvestmentPerformanceUsingGET -> "Retrieve Investment Performance"
        s = re.sub(r"Using(GET|POST|PUT|PATCH|DELETE).*$", "", op_id)
        s = re.sub(r"(?<!^)(?=[A-Z])", " ", s).strip()
        if s:
            return s[0].upper() + s[1:]
    # fall back to the path
    path = endpoint_key.split(" ", 1)[-1]
    tail = [p for p in path.split("/") if p and not p.startswith("{")]
    return (" ".join(tail[-2:]) or path).title()


def generate_flows(endpoints: list[dict], deps: list[dict],
                   produces: dict, consumes: dict) -> tuple[list[dict], list[dict]]:
    """
    endpoints: list of endpoint dicts (need endpoint_key, operation_id, method,
               project_id, feature_group)
    produces:  endpoint_key -> [entities it produces]
    consumes:  endpoint_key -> [entities it consumes]
    Returns (flows, steps).
    """
    ep_by_key = {e["endpoint_key"]: e for e in endpoints}
    # producer map: entity -> producing endpoint_key (first one wins, deterministic)
    producer_of = {}
    for ek, ents in produces.items():
        for ent in ents:
            producer_of.setdefault(ent, ek)

    # auth endpoint = whoever produces access_token
    auth_ep = producer_of.get(AUTH_ENTITY)

    flows, steps = [], []
    seen_flow_signatures = set()

    # candidate "goals": endpoints that consume at least one NON-common entity
    # (i.e. they genuinely depend on prior business steps) — these are the
    # natural end-points of a sequence.
    for ek, ep in ep_by_key.items():
        needed = [c for c in consumes.get(ek, []) if c not in COMMON]
        if not needed:
            continue

        # walk backward: collect prerequisite endpoints by resolving each consumed
        # entity to its producer, recursively.
        chain = []                 # ordered list of endpoint_keys (prereqs first)
        placed = set()

        def add_prereqs(target_key, depth=0):
            if target_key in placed or depth > 8:
                return
            for ent in consumes.get(target_key, []):
                if ent in COMMON:
                    continue
                prod = producer_of.get(ent)
                if prod and prod != target_key:
                    add_prereqs(prod, depth + 1)
            if target_key not in placed:
                placed.add(target_key)
                chain.append(target_key)

        add_prereqs(ek)
        # ensure the goal endpoint is last
        if ek in chain:
            chain.remove(ek)
        chain.append(ek)

        # prepend auth if any step needs it (or always, since all need a token)
        ordered = []
        if auth_ep and auth_ep not in chain:
            ordered.append(auth_ep)
        ordered.extend(chain)

        # skip trivial (just auth + goal with no real prereqs) unless goal needs >1
        real_prereqs = [c for c in ordered if c not in (auth_ep, ek)]
        if not real_prereqs and len(needed) < 2:
            continue

        sig = tuple(ordered)
        if sig in seen_flow_signatures:
            continue
        seen_flow_signatures.add(sig)

        flow_id = "gen_" + re.sub(r"[^a-zA-Z0-9]+", "_", ek)[:110]
        gen_name = _humanize(ek, ep.get("operation_id"))
        flows.append({
            "flow_id": flow_id,
            "generated_name": gen_name[:400],
            "goal": f"Auto-generated sequence to call {ep.get('method','')} "
                    f"{ek.split(' ',1)[-1]} with its prerequisites.",
            "persona": None,
            "domain": ep.get("feature_group"),
            "project_id": ep.get("project_id", "sei"),
            "origin": "generated",
            "step_count": len(ordered),
            "is_published": "Y",
        })
        for i, step_key in enumerate(ordered, start=1):
            step_ep = ep_by_key.get(step_key, {})
            steps.append({
                "flow_id": flow_id, "step_order": i,
                "endpoint_key": step_key[:520],
                "produces_entity": (produces.get(step_key) or [None])[0],
                "consumes_entity": ", ".join(consumes.get(step_key, []))[:400] or None,
                "note": None,
            })

    log.info("flow generator: %d business flows, %d steps", len(flows), len(steps))
    return flows, steps
