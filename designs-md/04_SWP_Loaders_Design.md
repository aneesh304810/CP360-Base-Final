---
cp360_type: design_document
component_id: 4
component_name: SWP Loaders
zone: 1. SEI
plane: Source
priority: P2
technology: Contract
custom_build: None
depends_on: [10, 11]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# SWP Loaders

## What this component is

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

It sits in **Ingress and Egress**, in the **Loader framework** lane (Python · outbound).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### Loader framework responsibilities

- Select the approved workflow and loader definition
- Read prepared Hub-owned outbound data
- Render the SEI-approved loader format
- Validate required fields, file structure and control totals
- Assign delivery and correlation identifiers
- Submit through the approved egress route
- Record acknowledgement, rejection and retry status

### Boundary rule

- Consumer movement and loader delivery introduce no uncontrolled transformation in flight. Business transformation and packaging are complete before delivery.

## Open against this component

**1 unresolved conflict and 8 other open items** — `GAP-03`, `R6`, `R8`, `R14`, `R20`, `R21`, `R22`, `R23`, `R24`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
