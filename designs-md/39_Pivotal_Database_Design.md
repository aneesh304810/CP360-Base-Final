---
cp360_type: design_document
component_id: 39
component_name: Pivotal Database
zone: 3. Consumers
plane: Consumers
priority: P2
technology: dbt
custom_build: Medium
depends_on: [15]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# Pivotal Database

## 1. Purpose & Scope

**Feed design from Stage 2**

Scope as recorded in the component tracker: New feed. Not costed in SEI scope..

## 2. Context & Dependencies

- Depends on components: 15
- Technology: dbt
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: BBH V4.2 only

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change it.

## 4. Detailed Design

**Deliverable.** Feed design from Stage 2

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

Not assessed against the SEI pack.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

Nothing identified. The component is specified and the events-primary substitution does not change it.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No change recommended.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Absent from SEI 8-component list - scope gap

### Acceptance criteria

- The deliverable above exists and is reviewed.
