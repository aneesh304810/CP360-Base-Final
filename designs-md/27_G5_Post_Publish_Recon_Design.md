---
cp360_type: design_document
component_id: 27
component_name: G5 Post-Publish Recon
zone: 2. Hub
plane: Data Quality
priority: P2
technology: Airflow + SQL
custom_build: Medium
depends_on: [16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G5 Post-Publish Recon

## 1. Purpose & Scope

**Advisory recon; triggers replay**

Scope as recorded in the component tracker: Custom recon queries + replay trigger integration..

## 2. Context & Dependencies

- Depends on components: 16, 21
- Technology: Airflow + SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: ok.** Already daily and post-publish. Unaffected by the substitution, provided it is not naively moved to per micro-batch for symmetry.

**Direction.** Already daily and post-publish. Leave alone; do not move it per micro-batch for symmetry.

## 4. Detailed Design

**Deliverable.** Advisory recon; triggers replay

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

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.5 | specifies this component | No status column: PASS and WARNING are derived in Splunk and deliberately not stored. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Already daily and post-publish. Unaffected by the substitution, provided it is not naively moved to per micro-batch for symmetry.

### Risk

- **HIGH · performance (B5).** DQ gates were designed per file, not per micro-batch.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Already daily and post-publish. Leave alone; do not move it per micro-batch for symmetry.

**Action.** Leave alone.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** What auto-triggers a replay vs pages a human?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
