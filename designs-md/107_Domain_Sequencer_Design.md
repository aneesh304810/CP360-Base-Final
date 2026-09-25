---
cp360_type: design_document
component_id: 107
component_name: Domain Sequencer
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · Airflow
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Domain Sequencer

## 1. Purpose & Scope

**Static ordering End Client → Account → Transaction, derived from the view field**

SEI assigns cross-domain dependency to the consumer. No component owns it.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Static ordering from the view field plus existing hold-and-replay. No dependency graph needed.

## 4. Detailed Design

**Deliverable.** Static ordering End Client → Account → Transaction, derived from the view field

**Technology.** Python · Airflow

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Serialises what could run in parallel. Only serialise when a micro-batch actually contains both domains; otherwise the ordering cost is paid 288 times a day for nothing.
### B8 · DIM-before-FACT serialisation is now paid per micro-batch (medium)

Under a daily batch the ordering cost is paid once. Under intraday it is paid 288 times, including on the many micro-batches that contain only one domain and need no ordering at all.

**What to do.** Serialise only when the micro-batch actually contains both domains. Inspect the collapsed key set before choosing the execution shape.

## 7. Error Handling, Failure & Replay

A dimension event in a later micro-batch than its fact falls to hold-and-replay, and the 7-day cliff starts ticking from that moment.
### E12 · Dimension arriving after fact starts the 7-day clock (medium)

Hold-and-replay handles a fact whose dimension has not arrived, marking MISSING_DIMENSION_KEY with reprocess_eligible. But INT retains seven days, so a dimension that arrives on day eight means the held fact is silently gone from FACT for ever.

**Who owns it today.** The cliff is real and nothing surfaces days-to-expiry on held rows.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.4 | nothing in the pack covers it | B.4 handles a fact whose dimension is missing, via hold-and-replay. It does not order domains, and SEI assigns cross-domain dependency to the consumer in writing. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. SEI assigns cross-domain dependency to the consumer. No component owns it.

**Priority P1, custom build Medium.**

### Risk

- **MEDIUM · performance (B8).** DIM-before-FACT serialisation is now paid per micro-batch.
- **MEDIUM · error path (E12).** Dimension arriving after fact starts the 7-day clock.

### Gap against the SEI pack

- B.4 handles a fact whose dimension is missing, via hold-and-replay. It does not order domains, and SEI assigns cross-domain dependency to the consumer in writing. *(nearest counterpart: BBH dbt Transformation TDD, §B.4)*

## 11. Recommendation

Static ordering from the view field plus existing hold-and-replay. No dependency graph needed.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Confirm the domain dependency order, and whether a micro-batch can carry a fact whose dimension arrives in a later box.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
