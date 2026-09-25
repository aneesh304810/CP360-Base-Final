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

**Custom build: None.** Nothing is built here. The deliverable is a contract, a configuration entry or a review, and treating it as build work is how it ends up unowned.

**Where it sits.** Hub · processing. RAW to Gold, and the layer where the events substitution costs most. The models themselves are specified; what changes is how often they run and what that does to a design shaped for one nightly pass.

**What breaks if this is wrong.** 6 components depend on it: #13 Python Ingestion Framework, #15 Stage 2 Enriched (dbt), #21 Replay / Rerun Engine, #24 G2 RAW Profiling Gate, #26 G4 Tie-out / Control Totals, #31 Audit & Lineage.

## 2. Context & Dependencies

- **Upstream** — depends on #13 Python Ingestion Framework
- **Downstream** — depended on by #13 Python Ingestion Framework, #15 Stage 2 Enriched (dbt), #21 Replay / Rerun Engine, #24 G2 RAW Profiling Gate, #26 G4 Tie-out / Control Totals, #31 Audit & Lineage
- Technology: Oracle DDL
- Custom build: None — High means a design document is mandatory before code.
- Source of record: SEI v5
- **Before the gate.** Its output is counted by the completeness gate, so a silent failure here makes the business date close on incomplete data.

## 3. Design Decisions

**Review verdict: amend.** Needs a micro-batch identifier column to make a load traceable to its box, and a commit boundary of one micro-batch. Without the column, lineage from a Gold row stops at the business date.

**Direction.** Add MICROBATCH_ID. Free now, a change request after deployment.

## 4. Detailed Design

**Deliverable.** Physical model: 7 RAW_* tables, 8 audit cols, partitioning, retention

### Implementation — Hub · processing

RAW to Gold, and the layer where the events substitution costs most. The models themselves are specified; what changes is how often they run and what that does to a design shaped for one nightly pass.

| Concern | How to build it |
| --- | --- |
| **Commit granularity** | One commit per micro-batch into Stage 1. Per-row commits thrash the redo log; one commit per day is not available any more. |
| **Incremental predicates** | Push the INT predicate down to Stage 1's partition so the STG view scans one micro-batch rather than the accumulated day. Verify it on the actual execution plan — do not assume the push-down happens. |
| **Partition strategy** | INT's current-day partition is written to continuously under intraday, so an incremental MERGE degrades as the day goes on. Subpartition by micro-batch, or load append-only with a late dedupe at the gate. |
| **Traceability** | Add MICROBATCH_ID to Stage 1 and carry it forward. Without it, lineage from a Gold row stops at the business date — free now, a change request after deployment. |
| **Schema change** | Gold runs on_schema_change='fail' and the RAW DDL is the schema contract. Any column change is a coordinated release, so the contract with SEI has to state notification and lead time. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component. Two estate conventions still bind it: durable write first, then acknowledge — committing an offset or returning a 202 before the write lands loses data with no trace; and absence is a state to record rather than a gap to infer, which is where most of the silent failures in this estate come from.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

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

### Not specified — and what to do until it is

**Which layer model is real.** The SEI pack has RAW to STG (a view) to INT to DIM and FACT. This codebase names a Stage 2 Enriched layer and a Pre-Gold Exadata tier that the pack does not have.

  *Recommended default:* Reconcile before build. Two layer models in two documents means whichever one a developer opens first becomes the implementation.

**Volume per micro-batch.** Partition strategy, commit size and the degradation curve on the current-day partition all depend on it, and none of it is stated.

  *Recommended default:* Measure the degradation curve in a lower environment before choosing a partition strategy. It may be acceptable at real volumes — but nobody knows the real volumes.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Add MICROBATCH_ID. Free now, a change request after deployment.

**Action.** Add MICROBATCH_ID. Free now, a change request later.

**Hub · processing.** The STG view is the one to look at first. A view recomputed once a night is elegant; the same view recomputed 288 times a day, each time scanning Stage 1, is the largest single cost the substitution introduces.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Partition by BUSINESS_DATE? Purge policy?
- **Which layer model is real** — unanswered. Until it is: Reconcile before build. Two layer models in two documents means whichever one a developer opens first becomes the implementation.
- **Volume per micro-batch** — unanswered. Until it is: Measure the degradation curve in a lower environment before choosing a partition strategy. It may be acceptable at real volumes — but nobody knows the real volumes.

### Acceptance criteria

- The deliverable above exists and is reviewed.
