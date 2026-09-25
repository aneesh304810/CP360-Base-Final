---
cp360_type: design_document
component_id: 24
component_name: G2 RAW Profiling Gate
zone: 2. Hub
plane: Data Quality
priority: P2
technology: Airflow + SQL
custom_build: Medium
depends_on: [14, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-8, AD-9]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G2 RAW Profiling Gate

## 1. Purpose & Scope

**Profiling checks. BLOCKS Stage 2**

Scope as recorded in the component tracker: Aggregate SQL pushed to Oracle; custom threshold comparison and branch..

## 2. Context & Dependencies

- Depends on components: 14, 28
- Technology: Airflow + SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: bottleneck.** A set-level aggregate. Per micro-batch it runs 288 times a day.

**Direction.** Set-level. Move to the EOD gate; per micro-batch it runs 288 times a day.

## 4. Detailed Design

**Deliverable.** Profiling checks. BLOCKS Stage 2

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

## 6. Performance & Scale

### B5 · DQ gates were designed per file, not per micro-batch (high)

G2 profiling, G4 tie-out and G5 post-publish recon are set-level aggregates. Running them per micro-batch means 288 full aggregate passes a day. Running them only daily means an intraday defect is invisible until the gate.

**What to do.** Split by cost class: G0 and G1 and G3 per micro-batch because they are row-level and cheap; G2, G4 and G5 at the EOD gate because they are set-level and expensive. State the split rather than leaving it to whoever writes the DAG.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

A set-level aggregate. Per micro-batch it runs 288 times a day.

### Risk

- **HIGH · performance (B5).** DQ gates were designed per file, not per micro-batch.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Set-level. Move to the EOD gate; per micro-batch it runs 288 times a day.

**Action.** B5 — move to the EOD gate.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Thresholds absolute or vs trailing average?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
