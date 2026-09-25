---
cp360_type: design_document
component_id: 121
component_name: Outbound Reconciliation
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python · SQL
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Reconciliation

## 1. Purpose & Scope

**Generated → validated → submitted → accepted → rejected: five counts that must tie**

The outbound counterpart of the four event-side boundaries. Same omission, opposite direction.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: Medium.** Configuration and glue over an existing capability. The risk is not writing it; it is that the configuration lives in code rather than in the metadata store, where it cannot be changed without a release.

**Where it sits.** Hub · data quality. Five gates designed for a daily file cycle, and they split cleanly by cost. Getting the split wrong is the difference between 288 cheap checks a day and 288 full-table aggregates.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Python · SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Without the counts, no outbound completeness claim is provable.

## 4. Detailed Design

**Deliverable.** Generated → validated → submitted → accepted → rejected: five counts that must tie

**Technology.** Python · SQL

### Implementation — Hub · data quality

Five gates designed for a daily file cycle, and they split cleanly by cost. Getting the split wrong is the difference between 288 cheap checks a day and 288 full-table aggregates.

| Concern | How to build it |
| --- | --- |
| **Cost class decides cadence** | Row-level gates (G0 envelope, G1 structural, G3 dbt tests) run per micro-batch. Set-level gates (G2 profiling, G4 tie-out, G5 post-publish recon) run at the EOD gate only. |
| **Rules as data** | A rule registry with is_blocking per rule, not per gate. That settles the blocking-versus-advisory argument one rule at a time instead of as a single estate-wide decision nobody can make. |
| **Evidence a rule ran** | Record PASS, WARN, FAIL and NOT_RUN. Recording only failures makes zero rows ambiguous — either everything passed or nothing ran, and a gate that silently did not execute looks exactly like a clean night. |
| **Threshold in force** | Copy the applied threshold onto the result row. Changing a threshold must never rewrite history, and a verdict has to stay defensible three months later. |
| **Outbound has a gate too** | G6 validates a loader before submission and blocks it. G1 to G5 all face inbound, so today the first validator of a BBH loader is SEI. |

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

Twelve reconciliation boundaries are required, against the three the pack specifies:

| Group | Boundaries |
| --- | --- |
| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |
| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |
| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |

## 6. Performance & Scale

Daily set-based aggregate per loader type.

## 7. Error Handling, Failure & Replay

RECON_RESULT’s three boundaries are all inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent of its records on the way out is invisible to every control in the estate.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.5 | nothing in the pack covers it | B.5's three boundaries are inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent on the way out is invisible. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The outbound counterpart of the four event-side boundaries. Same omission, opposite direction.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Which rules exist.** The gates are code with no registry, so which rules ran against which model on which date is unanswerable today.

  *Recommended default:* Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.

**Whether a failed reconciliation may publish to Gold.** RECON_RESULT stores counts and no status, and the verdict is derived in Splunk, so reconciliation is advisory by construction and the current answer is yes.

  *Recommended default:* Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Gap against the SEI pack

- B.5's three boundaries are inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent on the way out is invisible. *(nearest counterpart: BBH dbt Transformation TDD, §B.5)*

## 11. Recommendation

Without the counts, no outbound completeness claim is provable.

**Hub · data quality.** Write the cost class onto every rule before the first one is built. It is one column, and it is what stops the 288x problem being rediscovered by whoever writes the DAG.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** Will SEI return accepted and rejected counts per submission, so sent-versus-accepted can be made to tie?
- **Which rules exist** — unanswered. Until it is: Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.
- **Whether a failed reconciliation may publish to Gold** — unanswered. Until it is: Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
