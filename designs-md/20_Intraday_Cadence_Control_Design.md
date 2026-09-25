---
cp360_type: design_document
component_id: 20
component_name: Intraday Cadence Control
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [12, 18]
status: Not Started
owner: TBD
architecture_decisions: [AD-2]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Intraday Cadence Control

## 1. Purpose & Scope

**Cadence design and lane assignment**

Scope as recorded in the component tracker: Custom scheduling logic; overlap prevention with the EOD run..

## 2. Context & Dependencies

- Depends on components: 12, 18
- Technology: Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: rebuild.** The one component that anticipated intraday, but defined as a batch lane running more often. Event cadence is not a schedule — it is the stream's own rhythm, and lateness comes from a rolling baseline of the inter-micro-batch interval.

**Direction.** Redefine this component around micro-batch cadence and consumer lag rather than a batch lane that runs more often.

## 4. Detailed Design

**Deliverable.** Cadence design and lane assignment

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.3 | nothing in the pack covers it | The pack has a five-minute discovery loop and no intraday cadence model, no intraday SLA and no definition of 'behind' during the day. Its only clock is the EOD cutoff. |

## 10. Gaps, Risks & What Is Missing

### What is missing

The one component that anticipated intraday, but defined as a batch lane running more often. Event cadence is not a schedule — it is the stream's own rhythm, and lateness comes from a rolling baseline of the inter-micro-batch interval.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- The pack has a five-minute discovery loop and no intraday cadence model, no intraday SLA and no definition of 'behind' during the day. Its only clock is the EOD cutoff. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.3)*

## 11. Recommendation

Redefine this component around micro-batch cadence and consumer lag rather than a batch lane that runs more often.

**Action.** Redefine around micro-batch cadence and consumer lag.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The pack has a five-minute discovery loop but no intraday cadence model and no intraday SLA. Is there an intraday SLA, and what is 'behind' during the day?
- **From the tracker.** Frequency? Batch pipeline or API route? (AD-4)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
