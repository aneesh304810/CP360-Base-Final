---
cp360_type: design_document
component_id: 2
component_name: SWP UI
zone: 1. SEI
plane: Source
priority: P3
technology: Contract
custom_build: None
depends_on: [36]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# SWP UI

## 1. Purpose & Scope

**Access model + SSO handshake spec**

Scope as recorded in the component tracker: SEI-owned..

**Custom build: None.** Nothing is built here. The deliverable is a contract, a configuration entry or a review, and treating it as build work is how it ends up unowned.

**Where it sits.** SEI-owned · contract only. BBH builds nothing here. The deliverable is a **signed interface contract** and the acceptance criteria BBH holds SEI to, not a component. Treating these as design work is how a dependency with no owner ends up on the critical path.

**What breaks if this is wrong.** 1 component depends on it: #36 SSO.

## 2. Context & Dependencies

- **Upstream** — depends on #36 SSO
- **Downstream** — depended on by #36 SSO
- Technology: Contract
- Custom build: None — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. BBH builds nothing here. The deliverable is a **signed interface contract** and the acceptance criteria BBH holds SEI to, not a component. Treating these as design work is how a dependency with no owner ends up on the critical path.

## 4. Detailed Design

**Deliverable.** Access model + SSO handshake spec

### Implementation — SEI-owned · contract only

BBH builds nothing here. The deliverable is a **signed interface contract** and the acceptance criteria BBH holds SEI to, not a component. Treating these as design work is how a dependency with no owner ends up on the critical path.

| Concern | How to build it |
| --- | --- |
| **Interface inventory** | Name, owner, direction, cadence, business calendar, volume band and SLA for every interface. One row per interface, versioned, and it is the input to the expectation store. |
| **Schema contract** | The RAW DDL is the contract, because FILE_SCHEMA_CONFIG holds no column mapping. So the contract must state how a change is notified, with what lead time, and what backward-compatibility rule applies. |
| **Error semantics** | What SEI returns, in what shape, for a rejection — and whether a partial acceptance is possible. Partial acceptance is the norm on loaders and changes every downstream count. |
| **Environment access** | A non-production SEI endpoint BBH can test against, with representative data. Without it, the first integration test is in production. |
| **Change protocol** | Notification channel, lead time, dual-running window, and who signs off. Template versions already move independently (v1.24, v1.21, v9 live together). |

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

No review finding: the events-primary substitution does not change what this component does. What is missing is build detail rather than design. BBH builds nothing here. The deliverable is a **signed interface contract** and the acceptance criteria BBH holds SEI to, not a component. Treating these as design work is how a dependency with no owner ends up on the critical path.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**The interface list itself.** The architecture says roughly 43 interfaces per business date. The TDDs model exactly three RAW tables — RAW_ACCOUNT, RAW_CLIENT, RAW_TRANSACTION — with RAW_POSITION appearing in figures and nowhere else. Either forty are undocumented, or 'interface' counts something other than a table.

  *Recommended default:* Ask for the list before sizing anything. Until it exists, design for the three that are modelled and mark every count that depends on interface cardinality as provisional.

**Volume per interface.** No file sizes, row counts or growth rates anywhere. Pod sizing, storage, retention and the SLA budget all depend on them.

  *Recommended default:* Ask. Until answered, instrument from day one and publish the observed distribution after two weeks rather than guessing now.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No component-specific change is recommended: the review found nothing wrong with what this component does. The recommendation below is about how it should be built.

**SEI-owned · contract only.** Give every interface a contract with acceptance criteria and a named SEI owner, and let nothing enter the Hub build plan until its contract is agreed. The contract is the deliverable; the component row is just where it is tracked.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Which BBH roles need UI access?
- **The interface list itself** — unanswered. Until it is: Ask for the list before sizing anything. Until it exists, design for the three that are modelled and mark every count that depends on interface cardinality as provisional.
- **Volume per interface** — unanswered. Until it is: Ask. Until answered, instrument from day one and publish the observed distribution after two weeks rather than guessing now.

### Acceptance criteria

- The deliverable above exists and is reviewed.
