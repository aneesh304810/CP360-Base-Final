---
cp360_type: design_document
component_id: 23
component_name: G1 File / Structural Gate
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python
custom_build: High
depends_on: [8, 13, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-9, AD-8, AD-10, AD-5]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, data-quality, gate]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# G1 File / Structural Gate

## 1. Purpose & Scope

**Check set + quarantine design. BLOCKS RAW insert**

Scope as recorded in the component tracker: Custom validation engine driven by the rule registry. Blocking semantics + quarantine..

## 2. Context & Dependencies

- Depends on components: 8, 13, 28
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: amend.** Validates a file's structure. Nothing validates an envelope, so an unknown view or invalid op reaches the collapser.

**Direction.** Keep for the standby path. M11 is its envelope equivalent.

## 4. Detailed Design

**Deliverable.** Check set + quarantine design. BLOCKS RAW insert

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

## 6. Performance & Scale

### B5 · DQ gates were designed per file, not per micro-batch (high)

G2 profiling, G4 tie-out and G5 post-publish recon are set-level aggregates. Running them per micro-batch means 288 full aggregate passes a day. Running them only daily means an intraday defect is invisible until the gate.

**What to do.** Split by cost class: G0 and G1 and G3 per micro-batch because they are row-level and cheap; G2, G4 and G5 at the EOD gate because they are set-level and expensive. State the split rather than leaving it to whoever writes the DAG.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.1 | specifies this component | has_header, has_trailer and allow_zero_rows — the structural contract G1 checks against. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Validates a file's structure. Nothing validates an envelope, so an unknown view or invalid op reaches the collapser.

### Risk

- **HIGH · performance (B5).** DQ gates were designed per file, not per micro-batch.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Keep for the standby path. M11 is its envelope equivalent.

**Action.** M11, and keep G1 for the standby path.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Which failures are fatal vs warn?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
