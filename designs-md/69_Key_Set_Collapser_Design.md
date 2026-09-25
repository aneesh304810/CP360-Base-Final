---
cp360_type: design_document
component_id: 69
component_name: Key-Set Collapser
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Key-Set Collapser

## 1. Purpose & Scope

**Per micro-batch, per view: one distinct key set with op precedence**

Nothing in the pack collapses anything; the file path has no equivalent problem.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Delete must win over insert and update for the same key inside one micro-batch.

## 4. Detailed Design

**Deliverable.** Per micro-batch, per view: one distinct key set with op precedence

**Technology.** Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

This component decides the entire cost model. Collapsing 50,000 events to 8,000 distinct keys is the difference between one query and fifty thousand.
### B1 · The pull is the system's throughput ceiling (critical)

Query count is driven by cadence × views, not by account count. A five-minute cadence is 288 cycles a day; the reference client ran 17,955 queries a month, about 2.08 per cycle. Ten views at the same cadence is roughly 86,000 queries a month. Scaling the estimate by accounts understates it badly, because accounts do not appear in the formula.

**What to do.** One set-based query per view per micro-batch, bound to a collapsed key set. Never one query per event. Oracle's 1000-element IN limit means a global temporary table or an array bind with a join — a concatenated IN list fails in production and truncates silently in test.

## 7. Error Handling, Failure & Replay

D must win over I and U for the same key inside one micro-batch, or a deleted row is re-pulled and resurrected. Unknown view or unknown op needs a disposition, not a crash.
### E9 · op = D semantics are undefined downstream (high)

A delete event names a key whose row no longer exists to pull. Correction Handling is written for restatement and in-place merge, not for a delete arriving as an event. Whether a delete soft-closes the INT row, removes it, or writes a tombstone is unstated.

**Who owns it today.** Component 17 predates events entirely.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.2 | nothing in the pack covers it | C.2 defines the file work item. Nothing defines a collapsed key set, and the file path has no equivalent problem. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Nothing in the pack collapses anything; the file path has no equivalent problem.

**Priority P1, custom build High.**

### Risk

- **CRITICAL · performance (B1).** The pull is the system's throughput ceiling.
- **HIGH · error path (E9).** op = D semantics are undefined downstream.

### Gap against the SEI pack

- C.2 defines the file work item. Nothing defines a collapsed key set, and the file path has no equivalent problem. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.2)*

## 11. Recommendation

BBH-owned. Delete must win over insert and update for the same key inside one micro-batch.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
