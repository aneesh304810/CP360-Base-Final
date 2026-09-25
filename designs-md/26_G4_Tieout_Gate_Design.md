---
cp360_type: design_document
component_id: 26
component_name: G4 Tie-out / Control Totals
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Airflow + SQL
custom_build: High
depends_on: [14, 16, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-9, AD-1, AD-2, AD-8]
pipeline_tiers: [Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, data-quality, tie-out]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G4 Tie-out / Control Totals

## 1. Purpose & Scope

**RAW-to-Gold reconciliation. BLOCKS Gold publish. Per-target**

Scope as recorded in the component tracker: CORE BUILD. dbt tests cannot do this - it crosses the graph and must gate the publish..

## 2. Context & Dependencies

- Depends on components: 14, 16, 28
- Technology: Airflow + SQL
- Custom build: High — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: bottleneck.** Full-table control totals. Same cost class as G2 and the same 288× exposure.

**Direction.** EOD gate only, and it is the gate's strongest check.

## 4. Detailed Design

**Deliverable.** RAW-to-Gold reconciliation. BLOCKS Gold publish. Per-target

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
| BBH dbt Transformation TDD v2 | §B.5 | specifies this component | recon_result with left_count, right_count, source_dq_filtered_count, held_count, held_pct and difference. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Full-table control totals. Same cost class as G2 and the same 288× exposure.

### Risk

- **HIGH · performance (B5).** DQ gates were designed per file, not per micro-batch.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

EOD gate only, and it is the gate's strongest check.

**Action.** B5 — EOD gate only, and it is the gate's strongest check.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Recount or compare to captured ingest metadata?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
