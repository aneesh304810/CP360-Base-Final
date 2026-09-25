---
cp360_type: design_document
component_id: 18
component_name: Airflow DAG + Per-Domain Fan-out
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: High
depends_on: [9, 51, 52]
status: Not Started
owner: TBD
architecture_decisions: [AD-4, AD-5, AD-9, AD-1]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, orchestration, airflow]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Airflow DAG + Per-Domain Fan-out

## 1. Purpose & Scope

**DAG design: 7 parallel branches, join points, retries**

Scope as recorded in the component tracker: Dynamic task mapping over domain config. Not a hand-written static DAG..

## 2. Context & Dependencies

- Depends on components: 9, 51, 52
- Technology: Airflow
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5 + NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: bottleneck.** Task volume multiplies by roughly 300× under intraday micro-batches with dynamic task mapping.

**Direction.** C.1's three-task DAG is sound for one daily run. Size the scheduler and its metadata database for 288, or replace scheduled runs with a long-running consumer.

## 4. Detailed Design

**Deliverable.** DAG design: 7 parallel branches, join points, retries

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B3 · Airflow task volume multiplies by roughly 300× (high)

The scheduler polls its metadata database continuously and uses SELECT FOR UPDATE in its loop. Moving from about one DAG run a day to 288 intraday runs, each with per-domain dynamic task mapping, multiplies task_instance rows by two to three orders of magnitude. Nothing in the pack has costed the scheduler itself.

**What to do.** Size the scheduler and its database for the new task rate before build, set an aggressive metadata retention policy, and consider one long-running consumer rather than 288 scheduled DAG runs.
### B7 · Oracle session concurrency under intraday fan-out (medium)

Connection pooling was sized for a daily per-domain fan-out. Intraday micro-batches multiply concurrent sessions by the cadence, and Airflow dynamic task mapping spawns a worker pod per work item, each opening its own connections.

**What to do.** Bound the pool per pod and the pod count per micro-batch. An unbounded fan-out against a shared Oracle is how one pipeline takes down another team's service.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | specifies this component | Deterministic transformation run id transform__<BUSINESS_DATE>, plus a scheduled reconciliation path that retries when STATUS='TRIGGER', TRANSFORMATION_DAG_RUN_ID IS NULL and no matching deterministic run exists. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Task volume multiplies by roughly 300× under intraday micro-batches with dynamic task mapping.

### Risk

- **HIGH · performance (B3).** Airflow task volume multiplies by roughly 300×.
- **MEDIUM · performance (B7).** Oracle session concurrency under intraday fan-out.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

C.1's three-task DAG is sound for one daily run. Size the scheduler and its metadata database for 288, or replace scheduled runs with a long-running consumer.

**Action.** B3. Consider a long-running consumer instead of 288 scheduled runs.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Where do branches legitimately join?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
