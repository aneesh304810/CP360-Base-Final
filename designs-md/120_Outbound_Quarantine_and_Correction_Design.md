---
cp360_type: design_document
component_id: 120
component_name: Outbound Quarantine & Correction
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python · Oracle
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Quarantine & Correction

## 1. Purpose & Scope

**Rejected records held, with the correction protocol and resubmission lineage**

Component 29 quarantines inbound files. Rejected outbound records have nowhere to go and no defined route back.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · foundation. Estate-wide services, and the plane where the substitution costs most because every component here is used by every other. The pack specifies tables; it does not specify a framework, and the difference shows as four error vocabularies in one pipeline.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Python · Oracle
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Model retry and correction as different operations. A retry reuses the submission id; a correction is a new submission carrying corrects_submission_id.

## 4. Detailed Design

**Deliverable.** Rejected records held, with the correction protocol and resubmission lineage

**Technology.** Python · Oracle

### Implementation — Hub · foundation

Estate-wide services, and the plane where the substitution costs most because every component here is used by every other. The pack specifies tables; it does not specify a framework, and the difference shows as four error vocabularies in one pipeline.

| Concern | How to build it |
| --- | --- |
| **Extend, do not duplicate** | One quarantine with event and outbound reason taxonomies, one reconciliation framework with twelve boundaries rather than three, one configuration store holding the new catalogues. A parallel event-side foundation is the failure mode to avoid. |
| **Vocabulary as reference data** | Error codes, status values and DQ reasons live in tables with a disposition and an owner. An unknown value raises rather than being mapped to its nearest neighbour. |
| **State machines as data** | Every domain's states in one registry, with a sort order, so 'terminal never regresses' is enforceable rather than re-implemented in each component. |
| **Thresholds in one place** | Every tolerance, SLA percentage, max age and lag threshold in one versioned table, with the applied value copied onto each verdict. |
| **Masking on read** | Business keys masked on the way out, not at rest, so a wrong mask is correctable without having destroyed the original. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

n/a

## 7. Error Handling, Failure & Replay

A retry and a correction are different operations. A retry reuses the submission identifier because the same payload goes again; a correction is a new submission carrying corrects_submission_id, because the payload changed. Collapsing the two makes sent-versus-accepted unprovable.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

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
| BBH File Ingestion Framework TDD v2.0 | §D.2 | nothing in the pack covers it | D.2 quarantines an inbound file. Rejected outbound records have nowhere to go and no defined route back. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 29 quarantines inbound files. Rejected outbound records have nowhere to go and no defined route back.

**Priority P1, custom build High.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Where a read-only consumer role comes from.** A12 grants the loader DML on RAW plus the registry and DML-only on Gold, and describes no consumer grant at all. Improvised at connection time, that means reusing the loader's account.

  *Recommended default:* Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.

**The masking policy for the 786 PII fields in SDC scope.** It is unapproved, so any consumer either masks on its own judgement or shows unmasked business keys.

  *Recommended default:* Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Gap against the SEI pack

- D.2 quarantines an inbound file. Rejected outbound records have nowhere to go and no defined route back. *(nearest counterpart: BBH File Ingestion Framework TDD, §D.2)*

## 11. Recommendation

Model retry and correction as different operations. A retry reuses the submission id; a correction is a new submission carrying corrects_submission_id.

**Hub · foundation.** Sequence it: the status registry first because it is small and unblocks the outbound model, then DQ run results because a gate that did not run is currently invisible, then the error model seeded from codes already in use so nothing is invented and nothing is lost.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** What is the correction protocol for a loader BBH sent wrongly? Does a corrected submission reference the original, and does SEI supersede or duplicate?
- **Where a read-only consumer role comes from** — unanswered. Until it is: Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.
- **The masking policy for the 786 PII fields in SDC scope** — unanswered. Until it is: Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
