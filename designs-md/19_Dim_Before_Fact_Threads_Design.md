---
cp360_type: design_document
component_id: 19
component_name: Dim-before-Fact / dbt Threads
zone: 2. Hub
plane: Orchestration
priority: P2
technology: Airflow + dbt
custom_build: Low
depends_on: [16, 55]
status: Not Started
owner: TBD
architecture_decisions: [AD-2]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Dim-before-Fact / dbt Threads

## 1. Purpose & Scope

**Build-order and concurrency design**

Scope as recorded in the component tracker: Selector config and thread tuning..

## 2. Context & Dependencies

- Depends on components: 16, 55
- Technology: Airflow + dbt
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: bottleneck.** The ordering cost moves from once a day to once per micro-batch, including on boxes containing a single domain.

**Direction.** Fully specified by the pack, and sound. Order conditionally on the collapsed key set so single-domain boxes pay nothing.

## 4. Detailed Design

**Deliverable.** Build-order and concurrency design

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B8 · DIM-before-FACT serialisation is now paid per micro-batch (medium)

Under a daily batch the ordering cost is paid once. Under intraday it is paid 288 times, including on the many micro-batches that contain only one domain and need no ordering at all.

**What to do.** Serialise only when the micro-batch actually contains both domains. Inspect the collapsed key set before choosing the execution shape.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.4 | specifies this component | Dimension before fact, with fact_transactions.sql taking only dq_reason IS NULL and dq_int_txn_missing_dim.sql reading the failures off the same join, so the two cannot disagree. |

## 10. Gaps, Risks & What Is Missing

### What is missing

The ordering cost moves from once a day to once per micro-batch, including on boxes containing a single domain.

### Risk

- **MEDIUM · performance (B8).** DIM-before-FACT serialisation is now paid per micro-batch.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Fully specified by the pack, and sound. Order conditionally on the collapsed key set so single-domain boxes pay nothing.

**Action.** B8 — order conditionally on the collapsed key set.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Thread count vs Oracle contention ceiling?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
