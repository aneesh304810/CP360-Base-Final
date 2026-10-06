---
cp360_type: design_document
component_id: 24
component_name: G2 RAW Profiling Gate
zone: 2. Hub
plane: Data Quality
priority: P2
technology: Airflow + SQL
custom_build: Medium
depends_on: [14, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-8, AD-9]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingestion
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL]
traceability_identifiers: [FILE_ID, LOAD_ID, BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# G2 RAW Profiling Gate

## What this component is

Nothing profiles RAW. The first thing that reads a row's content in SEI's design is the STG view, already past the load.

It sits in **Ingestion**, in the **RAW profiling** lane (SQL).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Nothing profiles RAW. The first thing that reads a row's content in SEI's design is the STG view, already past the load.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C1 — Three RAW tables, or seven

- **The architecture says.** RAW_ACCOUNT, RAW_CLIENT, RAW_TAXLOT, RAW_TRANSACTION, RAW_POSITION, RAW_CORRECTED_TRANSACTION, RAW_CORRECTED_POSITION.
- **The design documents say.** The dbt design document names three: account, client and transaction. Position, tax lot and the two correction tables do not appear in it at all.
- **Why it matters.** Four of the seven feeds have no transformation designed for them. If the architecture is right, the design document covers under half the inbound surface.

## How this works, from the architecture supplement

### What ingestion is responsible for

- Discover candidate files independently as they arrive
- Match each file to exactly one active interface configuration
- Derive BUSINESS_DATE using the configured naming contract
- Validate readability, structure, header, trailer, zero-row policy and counts
- Claim one logical file lifecycle record
- Load the configured Stage 1 RAW table atomically
- Reconcile counts, archive successful files and quarantine invalid files
- Evaluate daily completeness and the common file-set SLA after every run

### Lifecycle rules

- ARCHIVED is the successful state completeness evaluation counts
- FAILED and QUARANTINED reuse the existing lifecycle record during authorised retry
- ARCHIVE_FAILED retries the archive operation and does not reload committed RAW records
- Registry uniqueness prevents duplicate successful loading for the configured logical file and business date

## Open against this component

**1 unresolved conflict and 2 other open items** — `R3`, `R14`, `R16`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
