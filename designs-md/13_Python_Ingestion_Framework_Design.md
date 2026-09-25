---
cp360_type: design_document
component_id: 13
component_name: Python Ingestion Framework
zone: 2. Hub
plane: Processing
priority: P1
technology: Python
custom_build: High
depends_on: [8, 14, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-7, AD-8, AD-9, AD-10]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, ingestion]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Python Ingestion Framework

## 1. Purpose & Scope

**Module design: validation, profiling, metadata capture, RAW load**

Scope as recorded in the component tracker: CORE BUILD. Reusable config-driven framework, not 7 scripts. Loader abstraction + audit column injection..

## 2. Context & Dependencies

- Depends on components: 8, 14, 23
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: rebuild.** Written as a file ingestion framework: discover work items, process a file, evaluate completeness. The event path shares none of that shape — it consumes continuously, collapses, pulls and loads per micro-batch.

**Direction.** Leave it owning the standby path. Do not bolt an event mode onto a file ingestion framework; build the event chain beside it.

## 4. Detailed Design

**Deliverable.** Module design: validation, profiling, metadata capture, RAW load

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | specifies this component | The ingestion framework's shape: discover, process per file via dynamic task mapping, then evaluate completeness. |
| BBH File Ingestion Framework TDD v2.0 | §C.2 | specifies this component | The work-item dict: file_name, src_file_name, business_date, target_raw_table, file_path, delimiter, has_header, has_trailer, allow_zero_rows. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Written as a file ingestion framework: discover work items, process a file, evaluate completeness. The event path shares none of that shape — it consumes continuously, collapses, pulls and loads per micro-batch.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Leave it owning the standby path. Do not bolt an event mode onto a file ingestion framework; build the event chain beside it.

**Action.** Do not extend this component with an event mode. Build M1, M4, M5 and M6 alongside it and let this one own the standby path.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** cx_Oracle vs SQL*Loader vs External Tables?

### Acceptance criteria

- The deliverable above exists and is reviewed.
