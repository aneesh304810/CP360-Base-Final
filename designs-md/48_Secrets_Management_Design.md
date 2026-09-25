---
cp360_type: design_document
component_id: 48
component_name: Secrets Management
zone: 4. OpenShift
plane: Platform
priority: P1
technology: Infra
custom_build: Low
depends_on: [32]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# Secrets Management

## 1. Purpose & Scope

**Secrets design: Oracle creds, sFTP keys, API tokens**

Scope as recorded in the component tracker: Config + custom secret injection into Airflow connections..

**Custom build: Low.** Largely platform or vendor capability. The design work is the contract around it — what it guarantees, what it does not, and who is called when it stops.

**Where it sits.** OpenShift · platform. Standard OpenShift tenancy, with one shape that is new: the SDC event listener is a **long-running Deployment**, not a Job. Every other workload in this estate is a pod that starts, does one unit of work and exits. That difference propagates into service accounts, network policy, disruption budgets and how the platform is monitored.

**What breaks if this is wrong.** 1 component depends on it: #32 Security & Access Control.

## 2. Context & Dependencies

- **Upstream** — depends on #32 Security & Access Control
- **Downstream** — depended on by #32 Security & Access Control
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. Standard OpenShift tenancy, with one shape that is new: the SDC event listener is a **long-running Deployment**, not a Job. Every other workload in this estate is a pod that starts, does one unit of work and exits. That difference propagates into service accounts, network policy, disruption budgets and how the platform is monitored.

## 4. Detailed Design

**Deliverable.** Secrets design: Oracle creds, sFTP keys, API tokens

### Implementation — OpenShift · platform

Standard OpenShift tenancy, with one shape that is new: the SDC event listener is a **long-running Deployment**, not a Job. Every other workload in this estate is a pod that starts, does one unit of work and exits. That difference propagates into service accounts, network policy, disruption budgets and how the platform is monitored.

| Concern | How to build it |
| --- | --- |
| **Namespaces** | One per environment per tier. The listener gets its own so a restart or a quota breach cannot take the batch path with it. |
| **Images** | Built once in CI, scanned, signed, and promoted **by digest, not by tag**. A tag that moves between environments makes an incident unreproducible. |
| **Service accounts** | One per workload, least privilege, no shared account between the listener, the workers and the dbt runner. The listener needs Event Hub egress that nothing else should have. |
| **SCC** | `restricted-v2` unless a workload proves it needs more, in writing. Nothing in this design needs privileged. |
| **Secrets** | From the platform secret store through External Secrets or equivalent. Never in a ConfigMap, never in an image, never in an Airflow Variable. |
| **Network policy** | Default-deny, with explicit egress to Oracle, Apigee and Event Hub, and explicit ingress only to the callback receiver. The receiver is the one component SEI reaches, so it is the one that needs an ingress rule at all. |
| **Storage** | Persistent volumes only for Airflow logs and the landing-zone mount. Nothing in the event path needs durable local storage — durability is Oracle's job. |

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

**Not assessed against the SEI pack.** No citation has been mapped for this component, which is a gap in the review rather than a statement that the pack covers it. Assessing it means one pass: find the section that governs it, record whether that section specifies it, partly touches it or is silent, and name who answers for the difference. That is a four-line entry in `ui/src/seiCitations.js` and it is what turns an assertion into something that can be put in front of SEI beside the page.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

No review finding: the events-primary substitution does not change what this component does. What is missing is build detail rather than design. Standard OpenShift tenancy, with one shape that is new: the SDC event listener is a **long-running Deployment**, not a Job. Every other workload in this estate is a pod that starts, does one unit of work and exits. That difference propagates into service accounts, network policy, disruption budgets and how the platform is monitored.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Which Oracle, which Event Hub namespace, and whether egress goes through a proxy.** Network policy and connection strings cannot be written without them, and an egress proxy changes the client configuration in every workload.

  *Recommended default:* Capture all three in the metadata store as environment configuration, not in code, so the same image runs in every environment.

**Whether the landing zone is a mount or an object store.** It decides whether the trailer reader is a filesystem read or an API call, and whether a PV is needed at all.

  *Recommended default:* Prefer object storage with a read-only credential. A shared filesystem mount across namespaces is the harder thing to secure and the harder thing to scale.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No component-specific change is recommended: the review found nothing wrong with what this component does. The recommendation below is about how it should be built.

**OpenShift · platform.** Write the listener's platform requirements separately from the batch workloads'. They are different workload classes and folding them into one namespace, one service account and one set of quotas is the decision that will be hardest to unpick later.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Vault or sealed secrets? Rotation policy?
- **Which Oracle, which Event Hub namespace, and whether egress goes through a proxy** — unanswered. Until it is: Capture all three in the metadata store as environment configuration, not in code, so the same image runs in every environment.
- **Whether the landing zone is a mount or an object store** — unanswered. Until it is: Prefer object storage with a read-only credential. A shared filesystem mount across namespaces is the harder thing to secure and the harder thing to scale.

### Acceptance criteria

- The deliverable above exists and is reviewed.
