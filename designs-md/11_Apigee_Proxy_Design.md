---
cp360_type: design_document
component_id: 11
component_name: Apigee Proxy
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Vendor/Infra
custom_build: Low
depends_on: [10, 35]
status: Not Started
owner: TBD
architecture_decisions: [AD-11]
pipeline_tiers: []
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, api]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Apigee Proxy

## What this component is

The API lane. Both SEI documents are batch from end to end — files in, Gold out — and neither mentions a proxy, a gateway or a synchronous call.

It sits in **Ingress and Egress**, in the **API gateway and Apigee proxy** lane (two layers · one door).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The API lane. Both SEI documents are batch from end to end — files in, Gold out — and neither mentions a proxy, a gateway or a synchronous call.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### Where this sits

- Two nodes, run by BBH as platform infrastructure rather than by this programme. Carries the call out to SEI, and is the identity SEI observes on the far side. Vendor kit: proxy configuration and policy, no application code.
- The other layer is **CP-Integration-Gateway** (the wrapper), tracked as component 12.
- Not a conflict. Both are true at their own vantage point. The API Gateway is a wrapper over BBH's Apigee network, there to isolate BBH's Apigee infrastructure and security from the consumer. SEI sees requests arriving from Apigee because on the egress path they do. What SEI names as one proxy is, on BBH's side, the gateway plus Apigee behind it. Nothing needs pinning and SEI's diagram is not wrong - it is drawn from outside the boundary the wrapper exists to create.

### Gateway design constraints

- No direct source-system-to-SEI service coupling across the trust boundary
- An idempotent request keeps the same idempotency key during safe retry
- Authentication secrets resolve from the platform secret service and are never stored in workflow metadata
- Gateway rejection is recorded separately from downstream SEI rejection

## Open against this component

**1 unresolved conflict and 8 other open items** — `GAP-03`, `R6`, `R8`, `R14`, `R20`, `R21`, `R22`, `R23`, `R24`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
