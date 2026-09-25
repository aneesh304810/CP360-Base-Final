---
cp360_type: design_document
component_id: 119
component_name: Loader Payload Store
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Oracle DDL + object store
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Loader Payload Store

## 1. Purpose & Scope

**What was generated and what was sent, with a content hash, written before submission**

Without it a rejected record cannot be tied to the bytes that caused it, and a disagreement with SEI has no evidence on the BBH side.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: Medium.** Configuration and glue over an existing capability. The risk is not writing it; it is that the configuration lives in code rather than in the metadata store, where it cannot be changed without a release.

**Where it sits.** Hub · ingress and egress. Two directions with almost nothing in common. Inbound is now a standby file path that must prove a file was generated and held. Outbound is a live submission loop with a validation gate, a payload record, a push receiver and a backstop poller, none of which exist.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Oracle DDL + object store
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Write the payload and its hash before the send, not after.

## 4. Detailed Design

**Deliverable.** What was generated and what was sent, with a content hash, written before submission

**Technology.** Oracle DDL + object store

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

Store the artefact once and reference it. Never regenerate it to answer a question about it.

## 7. Error Handling, Failure & Replay

Write before send, in that order. A payload recorded only after a successful send cannot explain a send that failed halfway, and a rejection arriving two days later has nothing to be read against.
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
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | Nothing records what was sent. A rejection names records in a payload nobody kept. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Without it a rejected record cannot be tied to the bytes that caused it, and a disagreement with SEI has no evidence on the BBH side.

**Priority P1, custom build Medium.**

### Risk

- **HIGH · error path (E14).** No record of what was actually sent.

### Not specified — and what to do until it is

**SEI's status API contract.** Endpoint, auth, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable. The poller's cadence and budget are unsizable without them.

  *Recommended default:* Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.

**Whether loader groups are a sequencing constraint.** Group 2, 3 and 4 appear consistently in the catalogue. If Group 2 must land before Group 3, a Group 2 failure blocks everything behind it — the outbound equivalent of the date gate.

  *Recommended default:* Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Gap against the SEI pack

- Nothing records what was sent. A rejection names records in a payload nobody kept. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

BBH-owned. Write the payload and its hash before the send, not after.

**Hub · ingress and egress.** Split this component set in two on the plan. Inbound standby is small and nearly done; outbound is eight components and has no design at all. Tracking them as one plane hides how unequal they are.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **SEI's status API contract** — unanswered. Until it is: Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.
- **Whether loader groups are a sequencing constraint** — unanswered. Until it is: Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
