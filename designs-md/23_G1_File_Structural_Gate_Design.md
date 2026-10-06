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
generated: true
sei_status: specified
architecture_domain: Ingestion
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL]
traceability_identifiers: [FILE_ID, LOAD_ID, BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# G1 File / Structural Gate

## What this component is

The ingestion document specifies exactly this: readable, header, trailer, zero-row and the date, all before any RAW write, and a failure goes to QUARANTINED.

It sits in **Ingestion**, in the **File-based ingestion** lane (SECONDARY · Airflow · Python).

## What SEI specifies

### S8 — Python loader

Per file: claim the (interface, business date) pair in the registry, validate readability, header, trailer, zero-row policy and row counts, load the detail rows into the configured RAW table in ONE Oracle transaction, reconcile parsed against trailer against inserted counts, and commit only when they agree. Then move the file and record the outcome.

- **Technology.** worker pod
- **Source.** ingest §3.1 (p.6) · §4.1 (p.7) · §7.3 (p.14)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X5 | The business date will not parse | Rejected before any RAW write, with the parsing error recorded. The format mask must reject impossible dates even when the regex shape matches. | ingest Appendix D.6 (p.23) |
| X6 | Header or trailer fails | RECEIVED becomes QUARANTINED, the error is recorded and the file moves to Quarantine. Nothing is written to RAW. | ingest §4 (p.7) · Appendix B.2 (p.20) |
| X7 | A zero-row file arrives and is not allowed | QUARANTINED, same path. Whether zero rows are allowed is per interface configuration. | ingest §6.1 (p.12) |
| X10 | The RAW load or the count check fails | Rolled back. LOADING becomes FAILED with the error and the end timestamp. The insert and the count reconciliation are one Oracle transaction, and the commit happens only when the file count, the trailer count and the inserted count all agree. | ingest §4.1 (p.7) · §7.3 (p.14) |
| X11 | A FAILED file is rerun | The same registry id is reused and the retry count goes up. Any exceptional partial rows are removed through the approved process first, then the file reloads in one transaction. | ingest Appendix D.1 (p.22) |
| X12 | The archive move fails after a good load | ARCHIVE_FAILED. RAW is kept and is never deleted or reloaded — the move happens after the commit and cannot be part of the transaction. Only the move is retried. | ingest §7.3 (p.14) · Appendix D.3 (p.22) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |
| X40 | A quarantined file is corrected | The same registry id is reused, the retry count goes up, the status resets to RECEIVED and every validation runs again before any RAW write. | ingest Appendix D.2 (p.22) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O3.** Confirm the retention period and purge approach for RAW and FILE_REGISTRY.

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
