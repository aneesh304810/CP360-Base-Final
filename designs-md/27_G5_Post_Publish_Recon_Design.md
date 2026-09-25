---
cp360_type: design_document
component_id: 27
component_name: G5 Post-Publish Recon
zone: 2. Hub
plane: Data Quality
priority: P2
technology: Airflow + SQL
custom_build: Medium
depends_on: [16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G5 Post-Publish Recon

## 1. Purpose & Scope

**Advisory recon; triggers replay**

Scope as recorded in the component tracker: Custom recon queries + replay trigger integration..

**Custom build: Medium.** Configuration and glue over an existing capability. The risk is not writing it; it is that the configuration lives in code rather than in the metadata store, where it cannot be changed without a release.

**Where it sits.** Hub · data quality. Five gates designed for a daily file cycle, and they split cleanly by cost. Getting the split wrong is the difference between 288 cheap checks a day and 288 full-table aggregates.

**What breaks if this is wrong.** 2 components depend on it: #21 Replay / Rerun Engine, #30 Reconciliation Framework.

## 2. Context & Dependencies

- **Upstream** — depends on #16 Gold (dbt), #21 Replay / Rerun Engine
- **Downstream** — depended on by #21 Replay / Rerun Engine, #30 Reconciliation Framework
- Technology: Airflow + SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: ok.** Already daily and post-publish. Unaffected by the substitution, provided it is not naively moved to per micro-batch for symmetry.

**Direction.** Already daily and post-publish. Leave alone; do not move it per micro-batch for symmetry.

## 4. Detailed Design

**Deliverable.** Advisory recon; triggers replay

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

## 6. Performance & Scale

### B5 · DQ gates were designed per file, not per micro-batch (high)

G2 profiling, G4 tie-out and G5 post-publish recon are set-level aggregates. Running them per micro-batch means 288 full aggregate passes a day. Running them only daily means an intraday defect is invisible until the gate.

**What to do.** Split by cost class: G0 and G1 and G3 per micro-batch because they are row-level and cheap; G2, G4 and G5 at the EOD gate because they are set-level and expensive. State the split rather than leaving it to whoever writes the DAG.

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
| BBH dbt Transformation TDD v2 | §B.5 | specifies this component | No status column: PASS and WARNING are derived in Splunk and deliberately not stored. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Already daily and post-publish. Unaffected by the substitution, provided it is not naively moved to per micro-batch for symmetry.

### Risk

- **HIGH · performance (B5).** DQ gates were designed per file, not per micro-batch.

### Not specified — and what to do until it is

**Which rules exist.** The gates are code with no registry, so which rules ran against which model on which date is unanswerable today.

  *Recommended default:* Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.

**Whether a failed reconciliation may publish to Gold.** RECON_RESULT stores counts and no status, and the verdict is derived in Splunk, so reconciliation is advisory by construction and the current answer is yes.

  *Recommended default:* Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Already daily and post-publish. Leave alone; do not move it per micro-batch for symmetry.

**Action.** Leave alone.

**Hub · data quality.** Write the cost class onto every rule before the first one is built. It is one column, and it is what stops the 288x problem being rediscovered by whoever writes the DAG.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** What auto-triggers a replay vs pages a human?
- **Which rules exist** — unanswered. Until it is: Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.
- **Whether a failed reconciliation may publish to Gold** — unanswered. Until it is: Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
