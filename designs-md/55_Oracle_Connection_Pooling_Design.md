---
cp360_type: design_document
component_id: 55
component_name: Oracle Connection Pooling
zone: 4. OpenShift
plane: Runtime
priority: P1
technology: Python + Infra
custom_build: Medium
depends_on: [13, 52]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Oracle Connection Pooling

## 1. Purpose & Scope

**Pooling design; the real parallelism ceiling**

Scope as recorded in the component tracker: Custom pool management in the ingestion framework. Sets the fan-out ceiling..

## 2. Context & Dependencies

- Depends on components: 13, 52
- Technology: Python + Infra
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: bottleneck.** Sized for daily fan-out. Intraday multiplies concurrent sessions by the cadence, with a worker pod per mapped task opening its own connections.

**Direction.** BBH-owned. Bound the pool per pod and the pods per micro-batch; an unbounded fan-out against a shared Oracle takes down another team's service.

## 4. Detailed Design

**Deliverable.** Pooling design; the real parallelism ceiling

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B7 · Oracle session concurrency under intraday fan-out (medium)

Connection pooling was sized for a daily per-domain fan-out. Intraday micro-batches multiply concurrent sessions by the cadence, and Airflow dynamic task mapping spawns a worker pod per work item, each opening its own connections.

**What to do.** Bound the pool per pod and the pod count per micro-batch. An unbounded fan-out against a shared Oracle is how one pipeline takes down another team's service.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | touches it, does not specify it | Dynamic task mapping spawns a worker pod per work item, each opening its own connections. Pool sizing is not stated. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Sized for daily fan-out. Intraday multiplies concurrent sessions by the cadence, with a worker pod per mapped task opening its own connections.

### Risk

- **MEDIUM · performance (B7).** Oracle session concurrency under intraday fan-out.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

BBH-owned. Bound the pool per pod and the pods per micro-batch; an unbounded fan-out against a shared Oracle takes down another team's service.

**Action.** B7 — bound the pool per pod and the pods per micro-batch.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Max sessions DBA will grant?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
