---
cp360_type: design_document
component_id: 10
component_name: Outbound Producers
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Python
custom_build: High
depends_on: [43]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-2, AD-11]
pipeline_tiers: [Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, outbound]
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Producers

## 1. Purpose & Scope

**Design for Data Extracts, JSON payloads, Loader File**

Scope as recorded in the component tracker: Full custom build: extract, JSON serialisation, loader-file format per SEI spec..

## 2. Context & Dependencies

- Depends on components: 43
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: gap.** One component carrying a whole framework. It covers generating and sending, and nothing else exists: no template registry, no validation before publish, no record of what was sent, no quarantine for rejects, no sent-versus-accepted reconciliation, no receiver, no poller, no submission registry. The inbound path has a gate, a quarantine and reconciliation boundaries; the outbound path has none of the three.

**Direction.** Treat outbound as a first-class half of the design rather than an appendix. Eight components hang off this one.

## 4. Detailed Design

**Deliverable.** Design for Data Extracts, JSON payloads, Loader File

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B11 · Outbound validation done per record instead of per extract (high)

G6 has to check obligation, type, domain and referential integrity across every row of a generated extract. Written as a per-record lookup against Gold it is the outbound twin of per-event retrieval, and it lands on the same Oracle the pipeline is already loading.

**What to do.** Set-based validation over the staged extract, one pass per rule, with control totals computed in the same pass. Validate the artefact, not the rows.

## 7. Error Handling, Failure & Replay

### E11 · Outbound has no error model at all (medium)

Loader submissions have no registry, no status history, no error store and no correction protocol. A retry reuses the submission id; a correction is a new submission that references the one it corrects. Neither is defined.

**Who owns it today.** The whole outbound half of the estate.
### E13 · Nothing validates a loader before it is published (critical)

There is no outbound gate. A loader violating an obligation the template declares — a missing Mandatory attribute, a Conditional one whose trigger fired, a code outside its domain — goes to SEI and returns as a rejection hours later, by which time the business date has moved on. G1 to G5 all face inbound.

**Who owns it today.** Unowned. Today the first validator of a BBH loader is SEI.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| SEI-BBH Integration Architecture v5 | whole document | touches it, does not specify it | Node 12 places the Apigee proxy on the outbound path. |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | The pack is entirely inbound. There is no outbound section, no submission contract, no acknowledgement model and no error return path anywhere in any of the documents. |

## 10. Gaps, Risks & What Is Missing

### What is missing

One component carrying a whole framework. It covers generating and sending, and nothing else exists: no template registry, no validation before publish, no record of what was sent, no quarantine for rejects, no sent-versus-accepted reconciliation, no receiver, no poller, no submission registry. The inbound path has a gate, a quarantine and reconciliation boundaries; the outbound path has none of the three.

### Risk

- **HIGH · performance (B11).** Outbound validation done per record instead of per extract.
- **MEDIUM · error path (E11).** Outbound has no error model at all.
- **CRITICAL · error path (E13).** Nothing validates a loader before it is published.

### Gap against the SEI pack

- The pack is entirely inbound. There is no outbound section, no submission contract, no acknowledgement model and no error return path anywhere in any of the documents. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

Treat outbound as a first-class half of the design rather than an appendix. Eight components hang off this one.

**Action.** Eight components hang off this one: M19 and M20 before the send, M21 at the moment of the send, M3, M2 and M9 around the return leg, M22 and M23 to close the loop.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** The pack is entirely inbound. There is no outbound section at all. What is the loader submission, acknowledgement and error contract?
- **From the tracker.** Which BBH systems are sources?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
