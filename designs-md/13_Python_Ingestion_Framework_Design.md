---
cp360_type: design_document
component_id: 13
component_name: Python Ingestion Framework
zone: 2. Hub
plane: Processing
priority: P1
technology: Python
custom_build: High
depends_on: [8, 14, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-7, AD-8, AD-9, AD-10]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, ingestion]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Python Ingestion Framework

## 1. Purpose & Scope

**Module design: validation, profiling, metadata capture, RAW load**

Scope as recorded in the component tracker: CORE BUILD. Reusable config-driven framework, not 7 scripts. Loader abstraction + audit column injection..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · processing. RAW to Gold, and the layer where the events substitution costs most. The models themselves are specified; what changes is how often they run and what that does to a design shaped for one nightly pass.

**What breaks if this is wrong.** 3 components depend on it: #14 Stage 1 RAW, #23 G1 File / Structural Gate, #55 Oracle Connection Pooling.

## 2. Context & Dependencies

- **Upstream** — depends on #8 Landing Zone + Transport, #14 Stage 1 RAW, #23 G1 File / Structural Gate
- **Downstream** — depended on by #14 Stage 1 RAW, #23 G1 File / Structural Gate, #55 Oracle Connection Pooling
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5
- **Before the gate.** Its output is counted by the completeness gate, so a silent failure here makes the business date close on incomplete data.

## 3. Design Decisions

**Review verdict: rebuild.** Written as a file ingestion framework: discover work items, process a file, evaluate completeness. The event path shares none of that shape — it consumes continuously, collapses, pulls and loads per micro-batch.

**Direction.** Leave it owning the standby path. Do not bolt an event mode onto a file ingestion framework; build the event chain beside it.

## 4. Detailed Design

**Deliverable.** Module design: validation, profiling, metadata capture, RAW load

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
| BBH File Ingestion Framework TDD v2.0 | §C.1 | specifies this component | The ingestion framework's shape: discover, process per file via dynamic task mapping, then evaluate completeness. |
| BBH File Ingestion Framework TDD v2.0 | §C.2 | specifies this component | The work-item dict: file_name, src_file_name, business_date, target_raw_table, file_path, delimiter, has_header, has_trailer, allow_zero_rows. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Written as a file ingestion framework: discover work items, process a file, evaluate completeness. The event path shares none of that shape — it consumes continuously, collapses, pulls and loads per micro-batch.

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

Leave it owning the standby path. Do not bolt an event mode onto a file ingestion framework; build the event chain beside it.

**Action.** Do not extend this component with an event mode. Build M1, M4, M5 and M6 alongside it and let this one own the standby path.

**Hub · processing.** The STG view is the one to look at first. A view recomputed once a night is elegant; the same view recomputed 288 times a day, each time scanning Stage 1, is the largest single cost the substitution introduces.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** cx_Oracle vs SQL*Loader vs External Tables?
- **Which layer model is real** — unanswered. Until it is: Reconcile before build. Two layer models in two documents means whichever one a developer opens first becomes the implementation.
- **Volume per micro-batch** — unanswered. Until it is: Measure the degradation curve in a lower environment before choosing a partition strategy. It may be acceptable at real volumes — but nobody knows the real volumes.

### Acceptance criteria

- The deliverable above exists and is reviewed.
