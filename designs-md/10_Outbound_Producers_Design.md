---
cp360_type: design_document
component_id: 10
component_name: Outbound Producers
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Python
custom_build: High
depends_on: [43]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-2, AD-11]
pipeline_tiers: [Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, outbound]
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: SEI
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Outbound Producers

## What this component is

Outbound to SEI. Neither document has an outbound path.

It sits in **Ingress and Egress**, in the **Loader framework** lane (Python · outbound).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Outbound to SEI. Neither document has an outbound path.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### Landing Zone contract

| Contract | Requirement |
|---|---|
| File readiness | Only complete files are visible, or a final rename or marker convention is used |
| Shared access | Landing, Archive and Quarantine are visible consistently to worker pods |
| Immutability | File contents are not modified in Landing |
| Discovery | The ingestion scanner reads active file configuration before scanning |
| Unknown files | An unmatched file produces an operational event and follows the approved exception-location policy |
| Ambiguous files | More than one configuration match is a configuration error and the file is NOT loaded |

### Landing failure modes

- Partial file exposure
- Duplicate physical delivery for the same logical interface and business date
- Filename does not match an active configuration
- Filename matches more than one configuration
- Storage unavailable or permission denied

### Transfer evidence required from Momentum

- Source and destination filename
- Transfer start and completion timestamps
- Transfer outcome
- Checksum, where the approved transfer contract includes one
- Correlation with the receiving ingestion record, where available

### Gateway design constraints

- No direct source-system-to-SEI service coupling across the trust boundary
- An idempotent request keeps the same idempotency key during safe retry
- Authentication secrets resolve from the platform secret service and are never stored in workflow metadata
- Gateway rejection is recorded separately from downstream SEI rejection

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
