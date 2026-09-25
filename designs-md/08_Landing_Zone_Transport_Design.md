---
cp360_type: design_document
component_id: 8
component_name: Landing Zone + Transport
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Infra
custom_build: Low
depends_on: [5]
status: Not Started
owner: TBD
architecture_decisions: [AD-8]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: Joint
in_scope: true
---

# Landing Zone + Transport

## 1. Purpose & Scope

**Transport design: protocol, auth, dirs, retention, completeness signal**

Scope as recorded in the component tracker: Managed service + config. Custom only for manifest/completeness check..

**Custom build: Low.** Largely platform or vendor capability. The design work is the contract around it — what it guarantees, what it does not, and who is called when it stops.

**Where it sits.** Hub · ingress and egress. Two directions with almost nothing in common. Inbound is now a standby file path that must prove a file was generated and held. Outbound is a live submission loop with a validation gate, a payload record, a push receiver and a backstop poller, none of which exist.

**What breaks if this is wrong.** 6 components depend on it: #5 Extract Generation, #9 File Arrival Sensors, #13 Python Ingestion Framework, #23 G1 File / Structural Gate, #49 Network Policy & Egress, #50 Persistent Storage.

## 2. Context & Dependencies

- **Upstream** — depends on #5 Extract Generation
- **Downstream** — depended on by #5 Extract Generation, #9 File Arrival Sensors, #13 Python Ingestion Framework, #23 G1 File / Structural Gate, #49 Network Policy & Egress, #50 Persistent Storage
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: Both (conflict)

## 3. Design Decisions

**Review verdict: demoted.** Becomes the standby path. It also conflicts with the SEI pack: this design uses a manifest written last plus deferrable sensors verifying size and mtime, while the File Ingestion TDD discovers by filename pattern every five minutes with no manifest at all. Two different transport contracts with the same upstream party.

**Direction.** Settle on one before build. The manifest is the stronger guarantee; the TDD is what is being built. Whichever wins, the other document has to change.

## 4. Detailed Design

**Deliverable.** Transport design: protocol, auth, dirs, retention, completeness signal

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
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6 | specifies this component | Transport and the landing zone: Momentum SFTP into the landing zone, retention, directory layout. |
| BBH File Ingestion Framework TDD v2.0 | §C.3 | the pack and this design disagree | Discovery every five minutes by filename pattern, with rules for one match, none, many, zero files and an existing key. |

**Disagreement with §C.3.** This codebase designs a manifest written last plus deferrable sensors verifying size and mtime. The pack has no manifest at all. Two different transport contracts with the same upstream party.

## 10. Gaps, Risks & What Is Missing

### What is missing

Becomes the standby path. It also conflicts with the SEI pack: this design uses a manifest written last plus deferrable sensors verifying size and mtime, while the File Ingestion TDD discovers by filename pattern every five minutes with no manifest at all. Two different transport contracts with the same upstream party.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**SEI's status API contract.** Endpoint, auth, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable. The poller's cadence and budget are unsizable without them.

  *Recommended default:* Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.

**Whether loader groups are a sequencing constraint.** Group 2, 3 and 4 appear consistently in the catalogue. If Group 2 must land before Group 3, a Group 2 failure blocks everything behind it — the outbound equivalent of the date gate.

  *Recommended default:* Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Settle on one before build. The manifest is the stronger guarantee; the TDD is what is being built. Whichever wins, the other document has to change.

**Action.** Pick one contract. The manifest protocol is stronger; the TDD is what is being built.

**Hub · ingress and egress.** Split this component set in two on the plan. Inbound standby is small and nearly done; outbound is eight components and has no design at all. Tracking them as one plane hides how unequal they are.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The pack discovers by filename pattern every five minutes with no manifest. This design uses a manifest written last plus size and mtime verification. Which transport contract is the real one?
- **From the tracker.** sFTP or object store? Same for EOD and intraday?
- **SEI's status API contract** — unanswered. Until it is: Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.
- **Whether loader groups are a sequencing constraint** — unanswered. Until it is: Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
