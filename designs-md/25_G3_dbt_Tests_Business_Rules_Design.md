---
cp360_type: design_document
component_id: 25
component_name: G3 dbt Tests + Business Rules
zone: 2. Hub
plane: Data Quality
priority: P1
technology: dbt
custom_build: Medium
depends_on: [15, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G3 dbt Tests + Business Rules

## 1. Purpose & Scope

**Test suite + rule design. BLOCKS Gold**

Scope as recorded in the component tracker: Generic tests cover basics; custom singular tests + generic test macros for business rules..

## 2. Context & Dependencies

- Depends on components: 15, 28
- Technology: dbt
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change it.

**Direction.** Row-level and cheap. Safe to run per micro-batch.

## 4. Detailed Design

**Deliverable.** Test suite + rule design. BLOCKS Gold

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.4 | specifies this component | dq_reason stamped on the same join the fact model filters, so tests and the fact table cannot diverge. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Nothing identified. The component is specified and the events-primary substitution does not change it.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Row-level and cheap. Safe to run per micro-batch.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Which rules are dbt tests vs model logic?

### Acceptance criteria

- The deliverable above exists and is reviewed.
