---
cp360_type: design_document
component_id: 10
component_name: Outbound Producers
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Python
custom_build: High
depends_on: [43]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-2, AD-11]
pipeline_tiers: [Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, outbound]
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Producers

## 1. Purpose & Scope

**Design for Data Extracts, JSON payloads, Loader File**

Scope as recorded in the component tracker: Full custom build: extract, JSON serialisation, loader-file format per SEI spec..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · ingress and egress. Two directions with almost nothing in common. Inbound is now a standby file path that must prove a file was generated and held. Outbound is a live submission loop with a validation gate, a payload record, a push receiver and a backstop poller, none of which exist.

**What breaks if this is wrong.** 4 components depend on it: #4 SWP Loaders, #6 Orchestration API / Data Ingestion / ODM / Workflows / Config, #11 Apigee Proxy, #43 BBH Existing Systems.

## 2. Context & Dependencies

- **Upstream** — depends on #43 BBH Existing Systems
- **Downstream** — depended on by #4 SWP Loaders, #6 Orchestration API / Data Ingestion / ODM / Workflows / Config, #11 Apigee Proxy, #43 BBH Existing Systems
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: gap.** One component carrying a whole framework. It covers generating and sending, and nothing else exists: no template registry, no validation before publish, no record of what was sent, no quarantine for rejects, no sent-versus-accepted reconciliation, no receiver, no poller, no submission registry. The inbound path has a gate, a quarantine and reconciliation boundaries; the outbound path has none of the three.

**Direction.** Treat outbound as a first-class half of the design rather than an appendix. Eight components hang off this one.

## 4. Detailed Design

**Deliverable.** Design for Data Extracts, JSON payloads, Loader File

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

### B11 · Outbound validation done per record instead of per extract (high)

G6 has to check obligation, type, domain and referential integrity across every row of a generated extract. Written as a per-record lookup against Gold it is the outbound twin of per-event retrieval, and it lands on the same Oracle the pipeline is already loading.

**What to do.** Set-based validation over the staged extract, one pass per rule, with control totals computed in the same pass. Validate the artefact, not the rows.

## 7. Error Handling, Failure & Replay

### E11 · Outbound has no error model at all (medium)

Loader submissions have no registry, no status history, no error store and no correction protocol. A retry reuses the submission id; a correction is a new submission that references the one it corrects. Neither is defined.

**Who owns it today.** The whole outbound half of the estate.
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
| SEI-BBH Integration Architecture v5 | whole document | touches it, does not specify it | Node 12 places the Apigee proxy on the outbound path. |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | The pack is entirely inbound. There is no outbound section, no submission contract, no acknowledgement model and no error return path anywhere in any of the documents. |

## 10. Gaps, Risks & What Is Missing

### What is missing

One component carrying a whole framework. It covers generating and sending, and nothing else exists: no template registry, no validation before publish, no record of what was sent, no quarantine for rejects, no sent-versus-accepted reconciliation, no receiver, no poller, no submission registry. The inbound path has a gate, a quarantine and reconciliation boundaries; the outbound path has none of the three.

### Risk

- **HIGH · performance (B11).** Outbound validation done per record instead of per extract.
- **MEDIUM · error path (E11).** Outbound has no error model at all.
- **CRITICAL · error path (E13).** Nothing validates a loader before it is published.

### Not specified — and what to do until it is

**SEI's status API contract.** Endpoint, auth, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable. The poller's cadence and budget are unsizable without them.

  *Recommended default:* Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.

**Whether loader groups are a sequencing constraint.** Group 2, 3 and 4 appear consistently in the catalogue. If Group 2 must land before Group 3, a Group 2 failure blocks everything behind it — the outbound equivalent of the date gate.

  *Recommended default:* Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Gap against the SEI pack

- The pack is entirely inbound. There is no outbound section, no submission contract, no acknowledgement model and no error return path anywhere in any of the documents. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

Treat outbound as a first-class half of the design rather than an appendix. Eight components hang off this one.

**Action.** Eight components hang off this one: M19 and M20 before the send, M21 at the moment of the send, M3, M2 and M9 around the return leg, M22 and M23 to close the loop.

**Hub · ingress and egress.** Split this component set in two on the plan. Inbound standby is small and nearly done; outbound is eight components and has no design at all. Tracking them as one plane hides how unequal they are.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** The pack is entirely inbound. There is no outbound section at all. What is the loader submission, acknowledgement and error contract?
- **From the tracker.** Which BBH systems are sources?
- **SEI's status API contract** — unanswered. Until it is: Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline.
- **Whether loader groups are a sequencing constraint** — unanswered. Until it is: Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
