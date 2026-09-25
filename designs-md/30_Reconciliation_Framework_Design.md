---
cp360_type: design_document
component_id: 30
component_name: Reconciliation Framework
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python
custom_build: High
depends_on: [26, 27, 35]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-6]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Reconciliation Framework

## 1. Purpose & Scope

**Recon model: control totals, exception lifecycle**

Scope as recorded in the component tracker: Custom recon data model + exception lifecycle + Integration360 publication..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · foundation. Estate-wide services, and the plane where the substitution costs most because every component here is used by every other. The pack specifies tables; it does not specify a framework, and the difference shows as four error vocabularies in one pipeline.

**What breaks if this is wrong.** 1 component depends on it: #35 Integration360.

## 2. Context & Dependencies

- **Upstream** — depends on #26 G4 Tie-out / Control Totals, #27 G5 Post-Publish Recon, #35 Integration360
- **Downstream** — depended on by #35 Integration360
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: gap.** Three boundaries, all downstream of Stage 1 and all inbound. The event path adds four upstream of them — events received → distinct keys → rows pulled → Stage 1 loaded — and the outbound path adds five that exist nowhere: generated → validated → submitted → accepted → rejected. Loss in either direction is currently undetectable by construction.

**Direction.** RECON_RESULT's three boundaries are sound and all inbound-downstream. Add four event-side and five outbound. Nine missing boundaries is why loss in either direction is currently undetectable.

## 4. Detailed Design

**Deliverable.** Recon model: control totals, exception lifecycle

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
| `DQ_RULE` | new | The rules themselves, as data: which gate, what scope, blocking or advisory, at what threshold. |
| `DQ_RUN_RESULT` | new | Evidence that a rule ran, and what it found — including when it found nothing. |
| `DQ_VALIDATION_FAILURE` | extend | Keep as specified; add three columns. |

## 5. Data Quality, Reconciliation & Lineage

Twelve reconciliation boundaries are required, against the three the pack specifies:

| Group | Boundaries |
| --- | --- |
| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |
| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |
| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

### E4 · The gate cannot detect event loss (critical)

A micro-batch that fails at 11am and goes unnoticed means the EOD transformation runs on short Stage 1 — and STG→INT reconciles cleanly, because it ties against a Stage 1 that is itself short. The existing three boundaries are all downstream of the loss and cannot see it.

**Who owns it today.** Requires the four event-side boundaries and a gate that demands every micro-batch LOADED.

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

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.5 | touches it, does not specify it | Three boundaries — STG_TO_INT, INT_TO_DIM, INT_TO_FACT — all downstream of Stage 1 and all inbound. |

**Disagreement with §B.5.** Nine more are needed: four upstream on the event path and five outbound. Without the upstream four, event loss is undetectable by construction, because STG_TO_INT ties perfectly against a Stage 1 that is itself short.

## 10. Gaps, Risks & What Is Missing

### What is missing

Three boundaries, all downstream of Stage 1 and all inbound. The event path adds four upstream of them — events received → distinct keys → rows pulled → Stage 1 loaded — and the outbound path adds five that exist nowhere: generated → validated → submitted → accepted → rejected. Loss in either direction is currently undetectable by construction.

### Risk

- **CRITICAL · error path (E4).** The gate cannot detect event loss.

### Not specified — and what to do until it is

**Where a read-only consumer role comes from.** A12 grants the loader DML on RAW plus the registry and DML-only on Gold, and describes no consumer grant at all. Improvised at connection time, that means reusing the loader's account.

  *Recommended default:* Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.

**The masking policy for the 786 PII fields in SDC scope.** It is unapproved, so any consumer either masks on its own judgement or shows unmasked business keys.

  *Recommended default:* Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

RECON_RESULT's three boundaries are sound and all inbound-downstream. Add four event-side and five outbound. Nine missing boundaries is why loss in either direction is currently undetectable.

**Action.** Add the four inbound (E4) and the five outbound (M23).

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

**Hub · foundation.** Sequence it: the status registry first because it is small and unblocks the outbound model, then DQ run results because a gate that did not run is currently invisible, then the error model seeded from codes already in use so nothing is invented and nothing is lost.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Who owns the recon record? (AD-6)
- **Where a read-only consumer role comes from** — unanswered. Until it is: Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately.
- **The masking policy for the 786 PII fields in SDC scope** — unanswered. Until it is: Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
