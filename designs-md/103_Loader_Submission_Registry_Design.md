---
cp360_type: design_document
component_id: 103
component_name: Loader Submission Registry
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Loader Submission Registry

## 1. Purpose & Scope

**LOADER_SUBMISSION · LOADER_STATUS_HISTORY (with SOURCE) · LOADER_ERROR**

The outbound path has no FILE_REGISTRY equivalent anywhere in the pack or the 65.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · ingress and egress. Two directions with almost nothing in common. Inbound is now a standby file path that must prove a file was generated and held. Outbound is a live submission loop with a validation gate, a payload record, a push receiver and a backstop poller, none of which exist.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Record the submission at send time — without that row, a submission that never reached SEI is indistinguishable from one that succeeded.

## 4. Detailed Design

**Deliverable.** LOADER_SUBMISSION · LOADER_STATUS_HISTORY (with SOURCE) · LOADER_ERROR

**Technology.** Oracle DDL + Python

### Implementation — Hub · ingress and egress

Two directions with almost nothing in common. Inbound is now a standby file path that must prove a file was generated and held. Outbound is a live submission loop with a validation gate, a payload record, a push receiver and a backstop poller, none of which exist.

| Concern | How to build it |
| --- | --- |
| **Inbound, as standby** | The sensor's job changes from 'did the data arrive' to 'is the parachute packed'. It needs a registry state meaning available-and-deliberately-unused, which the pack does not have, or a held file looks either missing or falsely satisfies a gate that should not be running. |
| **Outbound ordering** | Generate, validate, record, submit — in that order. Recording the payload and its hash after a successful send cannot explain a send that failed halfway. |
| **Receiver discipline** | Authenticate, validate envelope shape, durable write, 202. Nothing else inline. Correlation and status derivation happen downstream of the acknowledgement. |
| **Poller discipline** | Non-terminal submissions only, tiered cadence, detail fetched once on reaching terminal-with-errors. Terminal submissions must drop out of the poll set or call volume grows with history instead of with work in flight. |
| **Apigee** | One proxy, two paths — submit and status-return — with separate quotas. A burst of status polls should not be able to exhaust the submit quota. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

Error detail is fetched once on reaching terminal-with-errors, paginated and stored. Re-fetching per poll pulls the same rejected records repeatedly.

## 7. Error Handling, Failure & Replay

Without a row written at send time, a submission that never reached SEI is indistinguishable from one that succeeded. Silence looks exactly like success.
### E11 · Outbound has no error model at all (medium)

Loader submissions have no registry, no status history, no error store and no correction protocol. A retry reuses the submission id; a correction is a new submission that references the one it corrects. Neither is defined.

**Who owns it today.** The whole outbound half of the estate.
### E14 · No record of what was actually sent (high)

A rejection names records in a payload nobody kept. Without the generated artefact and its hash written before submission, a reject cannot be tied back to the bytes that caused it, a partial send cannot be told from a complete one, and a disagreement with SEI has no evidence on the BBH side.

**Who owns it today.** Unowned. The submission registry records that a send happened, not what it contained.

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
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.2 | nothing in the pack covers it | FILE_REGISTRY is the inbound record of a file. The outbound path has no submission registry, so a submission that never reached SEI is indistinguishable from one that succeeded. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The outbound path has no FILE_REGISTRY equivalent anywhere in the pack or the 65.

**Priority P1, custom build High.**

### Risk

- **MEDIUM · error path (E11).** Outbound has no error model at all.
- **HIGH · error path (E14).** No record of what was actually sent.

### Not specified — and what to do until it is

**SEI's status API contract.** Endpoint, auth, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable. The poller's cadence and budget are unsizable without them.

  *Recommended default:* Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.

**Whether loader groups are a sequencing constraint.** Group 2, 3 and 4 appear consistently in the catalogue. If Group 2 must land before Group 3, a Group 2 failure blocks everything behind it — the outbound equivalent of the date gate.

  *Recommended default:* Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Gap against the SEI pack

- FILE_REGISTRY is the inbound record of a file. The outbound path has no submission registry, so a submission that never reached SEI is indistinguishable from one that succeeded. *(nearest counterpart: BBH File Ingestion Framework TDD, §6.2)*

## 11. Recommendation

BBH-owned. Record the submission at send time — without that row, a submission that never reached SEI is indistinguishable from one that succeeded.

**Hub · ingress and egress.** Split this component set in two on the plan. Inbound standby is small and nearly done; outbound is eight components and has no design at all. Tracking them as one plane hides how unequal they are.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **SEI's status API contract** — unanswered. Until it is: Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.
- **Whether loader groups are a sequencing constraint** — unanswered. Until it is: Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
