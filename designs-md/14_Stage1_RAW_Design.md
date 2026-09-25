---
cp360_type: design_document
component_id: 14
component_name: Stage 1 RAW
zone: 2. Hub
plane: Processing
priority: P1
technology: Oracle DDL
custom_build: None
depends_on: [13]
status: Not Started
owner: TBD
architecture_decisions: [AD-8, AD-7, AD-10]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, raw]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Stage 1 RAW

## 1. Purpose & Scope

**Physical model: 7 RAW_* tables, 8 audit cols, partitioning, retention**

Scope as recorded in the component tracker: DDL + partitioning. No application code..

## 2. Context & Dependencies

- Depends on components: 13
- Technology: Oracle DDL
- Custom build: None — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: amend.** Needs a micro-batch identifier column to make a load traceable to its box, and a commit boundary of one micro-batch. Without the column, lineage from a Gold row stops at the business date.

**Direction.** Add MICROBATCH_ID. Free now, a change request after deployment.

## 4. Detailed Design

**Deliverable.** Physical model: 7 RAW_* tables, 8 audit cols, partitioning, retention

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

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
| BBH File Ingestion Framework TDD v2.0 | §6.1 | specifies this component | FILE_SCHEMA_CONFIG holds file-level metadata only and no column mapping, which makes the RAW DDL the schema contract. |
| BBH dbt Transformation TDD v2 | §Appendix E | specifies this component | The medallion canvas: SWP files to SWP_RAW (Bronze), then STG, INT, DIM and FACT. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Needs a micro-batch identifier column to make a load traceable to its box, and a commit boundary of one micro-batch. Without the column, lineage from a Gold row stops at the business date.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Add MICROBATCH_ID. Free now, a change request after deployment.

**Action.** Add MICROBATCH_ID. Free now, a change request later.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Partition by BUSINESS_DATE? Purge policy?

### Acceptance criteria

- The deliverable above exists and is reviewed.
