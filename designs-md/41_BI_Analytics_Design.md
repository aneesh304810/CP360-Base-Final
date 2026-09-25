---
cp360_type: design_document
component_id: 41
component_name: BI / Analytics
zone: 3. Consumers
plane: Consumers
priority: P2
technology: BI tooling
custom_build: Low
depends_on: [16]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# BI / Analytics

## 1. Purpose & Scope

**Semantic layer + access design**

Scope as recorded in the component tracker: Power BI / Tableau models. Outside the Python/dbt stack..

## 2. Context & Dependencies

- Depends on components: 16
- Technology: BI tooling
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change it.

## 4. Detailed Design

**Deliverable.** Semantic layer + access design

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

- **From the tracker.** Which of ~1000 consumers land where?

### Acceptance criteria

- The deliverable above exists and is reviewed.
