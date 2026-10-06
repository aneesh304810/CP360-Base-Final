---
cp360_type: design_document
component_id: 111
component_name: G0 Envelope Gate
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
generated: true
sei_status: proposal
architecture_domain: SEI Data Cloud Events
canonical_tier: not on the stage chain
control_entities: [MICRO_BATCH_REGISTRY]
traceability_identifiers: [EVENT_ID, CORRELATION_ID, BUSINESS_DATE]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# G0 Envelope Gate

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

## How this works, from the architecture supplement

### Consumer rules

- Treat the event as a notification, not the record of truth
- Retrieve the current record from the named SDC view using the payload key
- Process duplicate delivery idempotently
- Handle insert, update and delete explicitly
- Do not assume ordering across different event identifiers
- Use marker events where sequencing or processing gates require them
- Store the processing outcome by event identifier, key, operation, consumer and correlation scope

### Marker event handling

- Marker events control processing milestones and dates rather than identifying a business record
- Marker consumers validate the applicable batch and online dates
- Correlate the marker to the active business date
- Record whether the marker advances, releases, or only reports a processing gate

## Open against this component

**2 other open items** — `GAP-07`, `R19`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- This programme's events-primary review
- Inbound posture: BBH, stated directly

Generated from the cited model, not written by hand.
