---
cp360_type: design_document
component_id: 28
component_name: DQ Framework
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python
custom_build: High
depends_on: [33, 31]
status: Not Started
owner: TBD
architecture_decisions: [AD-9, AD-2, AD-5, AD-6]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, data-quality, framework]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# DQ Framework

## 1. Purpose & Scope

**Rule registry, severity tiers, results store, audited override path**

Scope as recorded in the component tracker: CORE BUILD. Registry schema, severity model, results store, override API + audit trail..

## 2. Context & Dependencies

- Depends on components: 33, 31
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: gap.** No event DQ taxonomy. The failure modes of an envelope and a pull — unknown view, key not found, pull timeout, sequencer cycle — have no codes and therefore no reporting.

**Direction.** Extend the taxonomy with event and outbound codes now, before they are invented ad hoc in three places.

## 4. Detailed Design

**Deliverable.** Rule registry, severity tiers, results store, audited override path

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

### E5 · Not-found key on pull has no disposition (high)

The key changed and by the time the pull runs the row is gone — a delete race, and at low rates entirely normal. At high rates it is a symptom of something serious. Treating it as an error alarms constantly; treating it as normal hides real loss.

**Who owns it today.** Needs a rate threshold tied to the observed delete rate, not a binary rule.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.4 | specifies this component | dq_validation_failure with resolution_status and reprocess_eligible='Y', driving the OPEN replay worklist. |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | No rule registry anywhere. The gates exist as code, so which rules ran against which model on which date is unanswerable, and blocking-versus-advisory is a global argument rather than a per-rule attribute. |

## 10. Gaps, Risks & What Is Missing

### What is missing

No event DQ taxonomy. The failure modes of an envelope and a pull — unknown view, key not found, pull timeout, sequencer cycle — have no codes and therefore no reporting.

### Risk

- **HIGH · error path (E5).** Not-found key on pull has no disposition.

### Gap against the SEI pack

- No rule registry anywhere. The gates exist as code, so which rules ran against which model on which date is unanswerable, and blocking-versus-advisory is a global argument rather than a per-rule attribute. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

Extend the taxonomy with event and outbound codes now, before they are invented ad hoc in three places.

**Action.** Extend the taxonomy before the codes are invented ad hoc in three places.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Who can override at 2am, and how is it logged?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
