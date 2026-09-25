---
cp360_type: design_document
component_id: 33
component_name: Metadata & Configuration Store
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: [6, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-6, AD-9, AD-2]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, foundation, config]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Metadata & Configuration Store

## 1. Purpose & Scope

**Config model: rules, thresholds, mappings, schedules**

Scope as recorded in the component tracker: CORE BUILD. Everything config-driven depends on this. Build first..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · foundation. Estate-wide services, and the plane where the substitution costs most because every component here is used by every other. The pack specifies tables; it does not specify a framework, and the difference shows as four error vocabularies in one pipeline.

**What breaks if this is wrong.** 2 components depend on it: #28 DQ Framework, #63 Backup & Restore.

## 2. Context & Dependencies

- **Upstream** — depends on #6 Orchestration API / Data Ingestion / ODM / Workflows / Config, #28 DQ Framework
- **Downstream** — depended on by #28 DQ Framework, #63 Backup & Restore
- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: amend.** Needs three new catalogues: the view catalogue, the eventid → domain/view map, and the expectation store.

**Direction.** Three new catalogues land here: M17, M18 and M19. Config, not code — an unknown value should raise, never be silently mapped.

## 4. Detailed Design

**Deliverable.** Config model: rules, thresholds, mappings, schedules

### Implementation — Hub · foundation

Estate-wide services, and the plane where the substitution costs most because every component here is used by every other. The pack specifies tables; it does not specify a framework, and the difference shows as four error vocabularies in one pipeline.

| Concern | How to build it |
| --- | --- |
| **Extend, do not duplicate** | One quarantine with event and outbound reason taxonomies, one reconciliation framework with twelve boundaries rather than three, one configuration store holding the new catalogues. A parallel event-side foundation is the failure mode to avoid. |
| **Vocabulary as reference data** | Error codes, status values and DQ reasons live in tables with a disposition and an owner. An unknown value raises rather than being mapped to its nearest neighbour. |
| **State machines as data** | Every domain's states in one registry, with a sort order, so 'terminal never regresses' is enforceable rather than re-implemented in each component. |
| **Thresholds in one place** | Every tolerance, SLA percentage, max age and lag threshold in one versioned table, with the applied value copied onto each verdict. |
| **Masking on read** | Business keys masked on the way out, not at rest, so a wrong mask is correctable without having destroyed the original. |

### Framework tables this component needs

| Table | State | Purpose |
| --- | --- | --- |
| `GUARDRAIL_POLICY` | new | Every threshold and limit in the platform, in one versioned place. |
| `CIRCUIT_BREAKER_STATE` | new | Stops a failing dependency being hammered by a fixed cadence. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component. Two estate conventions still bind it: durable write first, then acknowledge — committing an offset or returning a 202 before the write lands loses data with no trace; and absence is a state to record rather than a gap to infer, which is where most of the silent failures in this estate come from.

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

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.1 | touches it, does not specify it | FILE_SCHEMA_CONFIG — the only configuration store in the pack, and it covers file metadata only. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Needs three new catalogues: the view catalogue, the eventid → domain/view map, and the expectation store.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Where a read-only consumer role comes from.** A12 grants the loader DML on RAW plus the registry and DML-only on Gold, and describes no consumer grant at all. Improvised at connection time, that means reusing the loader's account.

  *Recommended default:* Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.

**The masking policy for the 786 PII fields in SDC scope.** It is unapproved, so any consumer either masks on its own judgement or shows unmasked business keys.

  *Recommended default:* Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Three new catalogues land here: M17, M18 and M19. Config, not code — an unknown value should raise, never be silently mapped.

**Action.** M17 and M18 land here.

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

**Hub · foundation.** Sequence it: the status registry first because it is small and unblocks the outbound model, then DQ run results because a gate that did not run is currently invisible, then the error model seeded from codes already in use so nothing is invented and nothing is lost.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** FILE_SCHEMA_CONFIG covers file metadata. Where do the view catalogue, the eventid map and the interface calendar live?
- **From the tracker.** One store, or does SEI keep its own? (risk R1)
- **Where a read-only consumer role comes from** — unanswered. Until it is: Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.
- **The masking policy for the 786 PII fields in SDC scope** — unanswered. Until it is: Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
