---
cp360_type: design_document
component_id: 116
component_name: Consumer Lag Monitor
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · Splunk
custom_build: Low
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Consumer Lag Monitor

## 1. Purpose & Scope

**Per-partition lag from broker enqueue metadata**

Component 34 Observability predates events and has no lag concept.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Splunk
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Lateness on a continuous stream comes from the stream's own rhythm. No expectation table needed if the cadence is stable.

## 4. Detailed Design

**Deliverable.** Per-partition lag from broker enqueue metadata

**Technology.** Python · Splunk

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

n/a
### B9 · Splunk ingest volume (medium)

Thirteen operational signals, multiplied by 288 cycles and by domain, is a different order of magnitude from a daily file pipeline. Splunk ingest is metered and rate limited.

**What to do.** Emit per micro-batch only what is actionable; aggregate the rest to a per-cycle or per-hour rollup. Decide this before the contract is written, not after the first bill.

## 7. Error Handling, Failure & Replay

Lag is the only intraday health signal there is. The envelope carries no timestamp of its own, so lag must come from broker metadata captured at receipt — which is why M12 needs enqueued_ts.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §8.1 | nothing in the pack covers it | The thirteen signals are all file-shaped. Consumer lag — the only intraday health signal there is — appears in none of them. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 34 Observability predates events and has no lag concept.

**Priority P1, custom build Low.**

### Risk

- **MEDIUM · performance (B9).** Splunk ingest volume.

### Gap against the SEI pack

- The thirteen signals are all file-shaped. Consumer lag — the only intraday health signal there is — appears in none of them. *(nearest counterpart: BBH File Ingestion Framework TDD, §8.1)*

## 11. Recommendation

Lateness on a continuous stream comes from the stream's own rhythm. No expectation table needed if the cadence is stable.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** What is the expected interval between micro-batches per topic, and is it stable enough to baseline?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
