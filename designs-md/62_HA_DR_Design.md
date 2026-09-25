---
cp360_type: design_document
component_id: 62
component_name: HA / DR
zone: 4. OpenShift
plane: Operations
priority: P2
technology: Infra
custom_build: Low
depends_on: [44]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# HA / DR

## 1. Purpose & Scope

**DR topology, RTO/RPO for the batch window**

Scope as recorded in the component tracker: Topology design + runbook..

**Custom build: Low.** Largely platform or vendor capability. The design work is the contract around it — what it guarantees, what it does not, and who is called when it stops.

**Where it sits.** OpenShift · operations. The weakest-covered plane in the pack. D.1 to D.6 are data-correction procedures; there is no disaster recovery section in any document, no RPO, no RTO and no failover story.

## 2. Context & Dependencies

- **Upstream** — depends on #44 Projects / Namespaces
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: gap.** No RPO or RTO anywhere in the pack. Under events, Event Hub retention *is* the recovery window and therefore the RTO — and retention is unstated.

**Direction.** State retention first, then derive RPO and RTO from it. The pack has no DR section at all — D.1 to D.6 are data correction, not disaster recovery.

## 4. Detailed Design

**Deliverable.** DR topology, RTO/RPO for the batch window

### Implementation — OpenShift · operations

The weakest-covered plane in the pack. D.1 to D.6 are data-correction procedures; there is no disaster recovery section in any document, no RPO, no RTO and no failover story.

| Concern | How to build it |
| --- | --- |
| **Recovery objectives** | Derive them rather than declare them. Under events, **Event Hub retention is the replay window and therefore the RTO** — if retention is seven days, no recovery objective longer than seven days is achievable whatever the document says. |
| **Backup surface** | The Oracle control tables are the recovery surface: registries, DATE_CONTROL, the micro-batch registry, DQ and recon. RAW is the replay source and has no stated retention anywhere, which makes the recovery window unknown. |
| **Monitoring the monitors** | If the ingestion DAG stops being scheduled, 'no files discovered' is indistinguishable from 'no files arrived', the gate is never evaluated, and the outage is silent for as long as nobody looks. A heartbeat that alerts on absence is the single highest-value monitor on this plane. |
| **Maintenance windows** | The single-active-date invariant and the five-minute loop both have opinions about an outage spanning midnight, and neither is written down. |
| **Cost and capacity** | Follows from volumetrics, which do not exist. Oracle storage growth, OpenShift pod-hours and Splunk ingest all scale with cadence rather than with account count. |

**Build note for this component.** Event Hub retention is the RTO. Establish it before writing any recovery objective.

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

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.1 | nothing in the pack covers it | D.1 to D.6 are data-correction procedures. There is no disaster recovery section in any document — no RPO, no RTO, no failover for Oracle, OpenShift or the landing zone. |

## 10. Gaps, Risks & What Is Missing

### What is missing

No RPO or RTO anywhere in the pack. Under events, Event Hub retention *is* the recovery window and therefore the RTO — and retention is unstated.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Event Hub retention.** It is the RTO and it is unstated. Every recovery conversation is unanchored without it.

  *Recommended default:* Ask SEI, then write the RPO and RTO from it rather than the other way round. A recovery objective the platform cannot physically meet is worse than none.

**Whether Oracle is HA, and what the failover behaviour is for in-flight transactions.** A micro-batch is one commit. Failover mid-commit decides whether that box is retryable or lost.

  *Recommended default:* Confirm the Oracle topology and test a failover with a micro-batch in flight before go-live. This is a half-day test that prevents a class of incident nobody can debug afterwards.

### Gap against the SEI pack

- D.1 to D.6 are data-correction procedures. There is no disaster recovery section in any document — no RPO, no RTO, no failover for Oracle, OpenShift or the landing zone. *(nearest counterpart: BBH File Ingestion Framework TDD, §D.1)*

## 11. Recommendation

State retention first, then derive RPO and RTO from it. The pack has no DR section at all — D.1 to D.6 are data correction, not disaster recovery.

**Action.** State retention, then derive RPO and RTO from it rather than the reverse.

**OpenShift · operations.** State the retention figures first — Event Hub, RAW and INT — because every recovery objective on this plane is a consequence of them. Then write the DR section the pack does not have.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** What is Event Hub retention? Under events it is the replay window and therefore the RTO, and it is unstated.
- **From the tracker.** What is the agreed RTO/RPO?
- **Event Hub retention** — unanswered. Until it is: Ask SEI, then write the RPO and RTO from it rather than the other way round. A recovery objective the platform cannot physically meet is worse than none.
- **Whether Oracle is HA, and what the failover behaviour is for in-flight transactions** — unanswered. Until it is: Confirm the Oracle topology and test a failover with a micro-batch in flight before go-live. This is a half-day test that prevents a class of incident nobody can debug afterwards.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
