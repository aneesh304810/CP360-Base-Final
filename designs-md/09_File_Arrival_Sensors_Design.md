---
cp360_type: design_document
component_id: 9
component_name: File Arrival Sensors
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [8, 18]
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
generated: true
sei_status: differs
architecture_domain: Ingestion
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL]
traceability_identifiers: [FILE_ID, LOAD_ID, BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# File Arrival Sensors

## What this component is

SEI does not use arrival sensors. It runs a scheduled scan every five minutes and decides completeness at the END of the run, as a set difference. A sensor per interface is the pattern it was written to avoid.

It sits in **Ingestion**, in the **File-based ingestion** lane (SECONDARY · Airflow · Python).

## What SEI specifies

**SEI covers the need and answers it differently.** SEI does not use arrival sensors. It runs a scheduled scan every five minutes and decides completeness at the END of the run, as a set difference. A sensor per interface is the pattern it was written to avoid.

### S6 — Scheduled discovery

A scan on a schedule rather than a sensor waiting on each file. It reads the active configurations, scans the Landing Zone, matches each physical filename to exactly one logical interface and parses the business date out of the filename.

- **Technology.** Airflow · every 5 min
- **Source.** ingest §4.1 (p.7) · §9.1 (p.16) · Appendix C.1 (p.21)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract. | ingest Appendix A (p.18) · §6.1 (p.12) |
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X1 | Exactly one pattern matches | One work item is created, carrying the interface, the physical filename, the business date, the target RAW table and the parsing rules. | ingest Appendix C.3 (p.21) |
| X2 | No pattern matches | Not loaded and not moved. An unmatched-file event is emitted with the filename and path, and the approved exception-location policy applies — which is still open decision O1. | ingest Appendix C.3 (p.21) |
| X3 | More than one pattern matches | Treated as a configuration defect. No target table is chosen, nothing is processed, and it is logged and notified. | ingest Appendix C.3 (p.21) |
| X4 | The scan finds nothing | The run succeeds with zero mapped tasks. The completeness and SLA task still runs — which is the point, because yesterday's late file can complete the set without a new one arriving. | ingest §5.2 (p.10) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O6.** Confirm expected-interface criteria and any holiday or month-end rules.

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Against what this design already says

#### Conflict — The file lifecycle has two sets of state names

- **The supplement says.** DISCOVERED, PROCESSING, DUPLICATE_SKIPPED, QUARANTINED, FAILED, ARCHIVE_FAILED, ARCHIVED.
- **This design holds.** RECEIVED, VALIDATED, LOADING, QUARANTINED, FAILED, ARCHIVE_FAILED, ARCHIVED - from the File Ingestion design document.
- **What it costs to leave open.** Two names for one state machine is two state machines. Operators will see one set in the registry and the other in the runbook, and DUPLICATE_SKIPPED exists in only one of them.
- **Decision.** `none raised - worth one`

#### New — Landing zone failure modes, including ambiguous match

- **The supplement says.** Partial file exposure, duplicate physical delivery for the same logical interface and date, no configuration match, MORE THAN ONE configuration match, storage unavailable. A file matching two configurations is a configuration error and is not loaded.
- **This design holds.** The file screen covers validation thoroughly and says nothing about what happens before a file is matched to an interface.
- **What it costs to leave open.** Ambiguous match is the one with no safe default: loading against the first match silently routes a file to the wrong RAW table.
- **Decision.** `DEC-GAP-02, DEC-GAP-03`

#### Confirms the baseline — ARCHIVE_FAILED never reloads RAW

- **The supplement says.** Retries the archive operation and does not reload committed RAW records.
- **This design holds.** The same rule, in the same words, from the File Ingestion design.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
