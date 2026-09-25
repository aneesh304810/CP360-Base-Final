---
cp360_type: design_document
component_id: 118
component_name: G6 Outbound Validation Gate
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python · SQL
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# G6 Outbound Validation Gate

## 1. Purpose & Scope

**Pre-submission validation against the template: obligation, type, domain, referential, control totals**

G1 to G5 all face inbound. Nothing validates anything on the way out, so today the first validator of a BBH loader is SEI.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · data quality. Five gates designed for a daily file cycle, and they split cleanly by cost. Getting the split wrong is the difference between 288 cheap checks a day and 288 full-table aggregates.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Python · SQL
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Build G6 against the template registry and make it blocking. An advisory outbound gate is the same as no gate.

## 4. Detailed Design

**Deliverable.** Pre-submission validation against the template: obligation, type, domain, referential, control totals

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

## 6. Performance & Scale

Set-based over the generated extract, never a lookup per record. Validating 40,000 rows one at a time against Gold is the outbound twin of per-event retrieval.
### B11 · Outbound validation done per record instead of per extract (high)

G6 has to check obligation, type, domain and referential integrity across every row of a generated extract. Written as a per-record lookup against Gold it is the outbound twin of per-event retrieval, and it lands on the same Oracle the pipeline is already loading.

**What to do.** Set-based validation over the staged extract, one pass per rule, with control totals computed in the same pass. Validate the artefact, not the rows.

## 7. Error Handling, Failure & Replay

This gate decides whether a defect is caught by BBH in seconds or by SEI in hours. Its verdict must block submission rather than warn — an advisory outbound gate is the same as no gate.
### E13 · Nothing validates a loader before it is published (critical)

There is no outbound gate. A loader violating an obligation the template declares — a missing Mandatory attribute, a Conditional one whose trigger fired, a code outside its domain — goes to SEI and returns as a rejection hours later, by which time the business date has moved on. G1 to G5 all face inbound.

**Who owns it today.** Unowned. Today the first validator of a BBH loader is SEI.

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
| BBH File Ingestion Framework TDD v2.0 | §C.4 | nothing in the pack covers it | C.4 is the inbound structural gate. G1 to G5 all face inbound; nothing validates a loader before it is published, so today the first validator of a BBH loader is SEI. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. G1 to G5 all face inbound. Nothing validates anything on the way out, so today the first validator of a BBH loader is SEI.

**Priority P1, custom build High.**

### Risk

- **HIGH · performance (B11).** Outbound validation done per record instead of per extract.
- **CRITICAL · error path (E13).** Nothing validates a loader before it is published.

### Not specified — and what to do until it is

**Which rules exist.** The gates are code with no registry, so which rules ran against which model on which date is unanswerable today.

  *Recommended default:* Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.

**Whether a failed reconciliation may publish to Gold.** RECON_RESULT stores counts and no status, and the verdict is derived in Splunk, so reconciliation is advisory by construction and the current answer is yes.

  *Recommended default:* Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Gap against the SEI pack

- C.4 is the inbound structural gate. G1 to G5 all face inbound; nothing validates a loader before it is published, so today the first validator of a BBH loader is SEI. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.4)*

## 11. Recommendation

Build G6 against the template registry and make it blocking. An advisory outbound gate is the same as no gate.

**Hub · data quality.** Write the cost class onto every rule before the first one is built. It is one column, and it is what stops the 288x problem being rediscovered by whoever writes the DAG.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** Where are the loader validation rules authoritative — Data 360, or a specification BBH should hold? And which of them does SEI treat as blocking rather than advisory?
- **Which rules exist** — unanswered. Until it is: Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data.
- **Whether a failed reconciliation may publish to Gold** — unanswered. Until it is: Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
