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
generated: true
sei_status: proposal
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

## Sources

- This programme's events-primary review
- Inbound posture: BBH, stated directly

Generated from the cited model, not written by hand.
