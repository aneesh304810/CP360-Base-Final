---
cp360_type: design_document
component_id: 21
component_name: Replay / Rerun Engine
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Python + Airflow
custom_build: High
depends_on: [14, 17, 27]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8, AD-9]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
---

# Replay / Rerun Engine

## 1. Purpose & Scope

**Replay design from LOAD_ID; scope, idempotency, downstream impact**

Scope as recorded in the component tracker: CORE BUILD. Airflow clear/backfill does NOT undo a Gold merge. Bespoke replay orchestration + idempotency..

## 2. Context & Dependencies

- Depends on components: 14, 17, 27
- Technology: Python + Airflow
- Custom build: High — High means a design document is mandatory before code.
- Source of record: NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: broken.** Its core assumption does not survive events. Replaying a micro-batch re-reads current state and returns today's values, not the values as of the original event. It also has no maximum attempt count.

**Direction.** Answer that, then answer replay semantics under events. This is the component most damaged by the substitution.

## 4. Detailed Design

**Deliverable.** Replay design from LOAD_ID; scope, idempotency, downstream impact

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

### E3 · Replay does not reproduce the original load (critical)

The file path replays identical bytes and gets an identical result. The event pull re-reads current state, so replaying yesterday's micro-batch today returns today's values. The recovery procedures in D.1 to D.6 are written entirely in file terms and do not survive the substitution.

**Who owns it today.** Either store the pulled payload, or obtain as-of retrieval from SEI. Neither is specified.
### E10 · Replay has no attempt limit (medium)

The Replay / Rerun Engine has no maximum attempt count before a work item is quarantined. A permanently failing item retries for ever and consumes capacity every cycle.

**Who owns it today.** Bounded retry plus quarantine. Trivial to add now, painful to retrofit.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.1 | specifies this component | FAILED rerun — reuse the existing registry record. |
| BBH File Ingestion Framework TDD v2.0 | §D.4 | the pack and this design disagree | Restatement requires a dbt rebuild or rerun for a date already processed. |

**Disagreement with §D.4.** C.1 mandates transform__<BUSINESS_DATE> and that run already succeeded, so Airflow refuses. C.1's reconciliation path fires only when no matching run exists — the opposite case. The run-id rule and the recovery procedure cannot both be satisfied as written.

## 10. Gaps, Risks & What Is Missing

### What is missing

Its core assumption does not survive events. Replaying a micro-batch re-reads current state and returns today's values, not the values as of the original event. It also has no maximum attempt count.

### Risk

- **CRITICAL · error path (E3).** Replay does not reproduce the original load.
- **MEDIUM · error path (E10).** Replay has no attempt limit.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Answer that, then answer replay semantics under events. This is the component most damaged by the substitution.

**Action.** E3 and E10. This is the component most damaged by the substitution.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** C.1's deterministic transform__<date> and D.4's restatement cannot both be satisfied — Airflow refuses a run that already succeeded, and C.1's reconciliation path only fires when no such run exists. How do both hold?
- **From the tracker.** Replay rewrites Gold in place or appends? (ties to AD-2)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
