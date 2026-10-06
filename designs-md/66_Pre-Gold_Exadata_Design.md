---
cp360_type: design_document
catalog_module: Datapoint 360
component_id: 66
component_name: Pre-Gold (Exadata) — dimensional assembly & tie-out
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt + Oracle Exadata
custom_build: High
depends_on: [15, 17, 26, 28, 31, 33, 67]
architecture_decisions: [AD-1, AD-2, AD-8, AD-9, AD-4]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
status: In Design
owner: TBD
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, exadata, pre-gold]
in_scope: true
generated: true
sei_status: proposal
architecture_domain: SEI Data Cloud Events
canonical_tier: not on the stage chain
control_entities: [MICRO_BATCH_REGISTRY]
traceability_identifiers: [EVENT_ID, CORRELATION_ID, BUSINESS_DATE]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Pre-Gold (Exadata) — dimensional assembly & tie-out

## What this is

A component proposed by this programme's own review. It is not in
either SEI design document and it is not in the delivery workbook.
Its id is above 100 so it can never be mistaken for a tracker
component.

## Why it was proposed

The review asked what would have to exist if events, rather than
files, were the primary way data arrives. BBH has since confirmed
that they are: **SDC events is the primary inbound route and file-based is the
secondary one.**

This does not make the event components a proposal any more. It makes them the primary path with no design document behind them, which is a sharper problem and a different one.

## What would have to be true

Both SEI design documents describe the file path and only the file
path. The completeness gate counts files that arrived, the
business-date state machine opens one date at a time, and the SLA
measures a cutoff for a set of files. None of those hold for a
continuous event stream without being redesigned.

## Status

Proposed, not approved and not specified. It goes on the
architecture drawing when SEI's documents cover it or BBH formally
adopts it. Until then it is in the event container, drawn apart.

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Gap register

| Gap | What is missing | Required disposition |
|---|---|---|
| `GAP-07` | SDC event architecture is not integrated into CP360 | Add event taxonomy, payload handling, idempotency, retrieval, replay and marker-event gating |

### Against what this design already says

#### Confirms the baseline — An event is a notification, not the record

- **The supplement says.** Treat the event as notification; retrieve the current record from the named SDC view by payload key; process duplicates idempotently.
- **This design holds.** The same, as the three event kinds and the event-then-fetch path.

## Sources

- This programme's events-primary review
- Inbound posture: BBH, stated directly

Generated from the cited model, not written by hand.
