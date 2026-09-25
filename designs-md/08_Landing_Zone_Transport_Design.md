---
cp360_type: design_document
component_id: 8
component_name: Landing Zone + Transport
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Infra
custom_build: Low
depends_on: [5]
status: Not Started
owner: TBD
architecture_decisions: [AD-8]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: Joint
in_scope: true
---

# Landing Zone + Transport

## 1. Purpose & Scope

**Transport design: protocol, auth, dirs, retention, completeness signal**

Scope as recorded in the component tracker: Managed service + config. Custom only for manifest/completeness check..

## 2. Context & Dependencies

- Depends on components: 5
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: Both (conflict)

## 3. Design Decisions

**Review verdict: demoted.** Becomes the standby path. It also conflicts with the SEI pack: this design uses a manifest written last plus deferrable sensors verifying size and mtime, while the File Ingestion TDD discovers by filename pattern every five minutes with no manifest at all. Two different transport contracts with the same upstream party.

**Direction.** Settle on one before build. The manifest is the stronger guarantee; the TDD is what is being built. Whichever wins, the other document has to change.

## 4. Detailed Design

**Deliverable.** Transport design: protocol, auth, dirs, retention, completeness signal

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
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6 | specifies this component | Transport and the landing zone: Momentum SFTP into the landing zone, retention, directory layout. |
| BBH File Ingestion Framework TDD v2.0 | §C.3 | the pack and this design disagree | Discovery every five minutes by filename pattern, with rules for one match, none, many, zero files and an existing key. |

**Disagreement with §C.3.** This codebase designs a manifest written last plus deferrable sensors verifying size and mtime. The pack has no manifest at all. Two different transport contracts with the same upstream party.

## 10. Gaps, Risks & What Is Missing

### What is missing

Becomes the standby path. It also conflicts with the SEI pack: this design uses a manifest written last plus deferrable sensors verifying size and mtime, while the File Ingestion TDD discovers by filename pattern every five minutes with no manifest at all. Two different transport contracts with the same upstream party.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Settle on one before build. The manifest is the stronger guarantee; the TDD is what is being built. Whichever wins, the other document has to change.

**Action.** Pick one contract. The manifest protocol is stronger; the TDD is what is being built.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The pack discovers by filename pattern every five minutes with no manifest. This design uses a manifest written last plus size and mtime verification. Which transport contract is the real one?
- **From the tracker.** sFTP or object store? Same for EOD and intraday?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
