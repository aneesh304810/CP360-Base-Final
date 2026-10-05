---
id: l3-errors
title: Error Handling, Quarantine & Override
level: L3
icon: 🚑
color: #c0392b
bg: #fde8e8
order: 4
sub: withdrawn - to be rewritten from the drawing
match: error|quarantine|override|reject|dlq|dead.?letter|replay|exception|recon
generated: true
sei_status: overview
---

# Error handling, DQ and recovery

Every scenario both SEI design documents describe, with what the
design does and where it says so. Nothing here is inferred.

## Discovery

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X1 | Exactly one pattern matches | One work item is created, carrying the interface, the physical filename, the business date, the target RAW table and the parsing rules. | ingest Appendix C.3 (p.21) |
| X2 | No pattern matches | Not loaded and not moved. An unmatched-file event is emitted with the filename and path, and the approved exception-location policy applies — which is still open decision O1. | ingest Appendix C.3 (p.21) |
| X3 | More than one pattern matches | Treated as a configuration defect. No target table is chosen, nothing is processed, and it is logged and notified. | ingest Appendix C.3 (p.21) |
| X4 | The scan finds nothing | The run succeeds with zero mapped tasks. The completeness and SLA task still runs — which is the point, because yesterday's late file can complete the set without a new one arriving. | ingest §5.2 (p.10) |

## Validation

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X5 | The business date will not parse | Rejected before any RAW write, with the parsing error recorded. The format mask must reject impossible dates even when the regex shape matches. | ingest Appendix D.6 (p.23) |
| X6 | Header or trailer fails | RECEIVED becomes QUARANTINED, the error is recorded and the file moves to Quarantine. Nothing is written to RAW. | ingest §4 (p.7) · Appendix B.2 (p.20) |
| X7 | A zero-row file arrives and is not allowed | QUARANTINED, same path. Whether zero rows are allowed is per interface configuration. | ingest §6.1 (p.12) |

## Registry

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X8 | The same file is discovered again | If the existing record is ARCHIVED it is skipped and logged as a duplicate; no second registry row is created. A unique key on the interface and business date enforces it. | ingest §5 (p.9) · Appendix B (p.19) |
| X9 | A record is stuck in RECEIVED, VALIDATED or LOADING | Investigated, never reset automatically. The Airflow task state, the worker logs, the file location and the Oracle outcome are checked first, and the same record is reused for recovery. | ingest Appendix D.5 (p.23) |

## Load

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X10 | The RAW load or the count check fails | Rolled back. LOADING becomes FAILED with the error and the end timestamp. The insert and the count reconciliation are one Oracle transaction, and the commit happens only when the file count, the trailer count and the inserted count all agree. | ingest §4.1 (p.7) · §7.3 (p.14) |
| X11 | A FAILED file is rerun | The same registry id is reused and the retry count goes up. Any exceptional partial rows are removed through the approved process first, then the file reloads in one transaction. | ingest Appendix D.1 (p.22) |

## Archive

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X12 | The archive move fails after a good load | ARCHIVE_FAILED. RAW is kept and is never deleted or reloaded — the move happens after the commit and cannot be part of the transaction. Only the move is retried. | ingest §7.3 (p.14) · Appendix D.3 (p.22) |
| X13 | Why ARCHIVED is the ready state | A reconciled RAW commit is not released downstream until the physical archive succeeds, so completeness counts ARCHIVED and nothing earlier. | ingest §6.2 (p.12) |

## Gate

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X14 | Complete before the cutoff | The guarded transition is taken and transformation is invoked. | ingest §5.2 (p.10) |
| X15 | Complete at or after the cutoff | Still triggered, and a recovery or late-completion event is published if the date had already breached. | ingest §7.3 (p.14) |
| X16 | Incomplete before the cutoff | The date stays PENDING, nothing is triggered, and the next scheduled run re-evaluates. | ingest §5.2 (p.10) |
| X17 | Incomplete at or after the cutoff | The date stays PENDING and a correlated breach alert is published. Correlation is event type plus business date, so a persistent breach raises one alert rather than one every five minutes. | ingest §5.2 (p.10) · Appendix E.6 (p.25) |
| X18 | The completeness query itself fails | The task fails and Airflow retries. Readiness is unknown, so nothing is triggered. | ingest §5.2 (p.10) |

## Orchestration

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X19 | Two runs try to trigger at once | The second guarded update changes zero rows, so it does not trigger. The deterministic run id rejects a duplicate as well. | ingest Appendix E.3 (p.24) |
| X20 | TRIGGER is set but transformation never started | A scheduled check retries when the status is TRIGGER, the transformation run id is null and no matching deterministic run exists. | ingest Appendix C.1 (p.21) |
| X21 | A transformation task fails | The date stays TRIGGER, no next date is created and the pipeline is locked. Airflow alerts and the run restarts from the failed task; each layer's write is idempotent for the date. | dbt §8.1 (p.20) |
| X22 | FACT fails after DIM succeeded | The restart resumes at the fact build. The dimension is not rebuilt. | dbt §8.1 (p.20) |
| X23 | The restart reaches the final task | The date advances to COMPLETE and the next PENDING row is inserted in the same transaction, exactly once. | dbt §8.1 (p.20) · ingest Appendix E.5 (p.24) |

## Source DQ

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X24 | A key column is missing | The STG view marks the row FAIL with a reason code and INT never reads it. The row goes to the DQ store as OPEN. | dbt §6.3 (p.15) |
| X25 | A code is not in the mapping table | Same path — FAIL at STG with its own reason code, excluded before any mapping is attempted. | dbt §6.3 (p.15) |
| X26 | A full-snapshot entity fails | The row stays OPEN until a corrected record arrives in a later full file, which replays it and marks it RESOLVED. This rests on account and client being full daily snapshots. | dbt §7.1 (p.17) · §8.2 assumption A1 (p.20) |
| X27 | A transaction fails | That date's records do not come round again, so it replays only on a corrected reload for the date, or when the missing dimension arrives. | dbt §7.1 (p.17) |

## Transformation DQ

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X28 | A code has no active mapping row | Caught at INT as a transformation failure, owned by the transformation team rather than the source. Marked not auto-replayable: it stays OPEN until a code fix is deployed. | dbt §7 (p.17) |
| X29 | The same failure returns after a rerun | Expected, and the signal is that a code fix is needed rather than another rerun. | dbt §7 (p.17) |
| X30 | A transaction's dimension has not arrived | Never written to Gold with a placeholder key. Held in the DQ store as replayable and OPEN, re-derived from INT on a later day once the dimension exists, then marked RESOLVED. | dbt §7.1 (p.17) · Figure 5a (p.18) |
| X31 | A row is still OPEN at the retention edge | CLOSED and alerted at seven days, because the DQ store keeps lineage only and INT no longer holds the data to re-derive it. | dbt §7.1 (p.17) · §8.2 assumption A4 (p.20) |

## Dimensions

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X32 | A correction arrives and the row is still current | A normal MERGE, joined on the surrogate key rather than the natural key — a natural-key join matches both the closing and the opening row and fails. | dbt §6.4.1 (p.15) |
| X33 | A correction arrives and the interval is already closed | A direct UPDATE of that closed row only. Never a MERGE — it would reopen an interval that is settled. | dbt §6.4.1 (p.15) |
| X34 | Someone changes the shape of a Gold table | Refused. Every Gold model fails on a schema change, and the service account holds DML only — no create, alter or drop. | dbt §8.4 (p.21) |

## Reconciliation

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X35 | Counts do not agree at a boundary | The difference is written to the immutable log and published. The pass or warning verdict is derived on the Splunk side, after the data is already in Gold — so it alerts rather than blocks. | dbt §7.2 (p.18) · §7.2.1 (p.18) |
| X36 | The held backlog is growing | Alerts on the ageing open rows, and the usual cause is a late dimension file. | dbt §7.2.1 (p.18) |
| X37 | DQ or reconciliation is rerun for a date | The DQ rows are upserted so their resolution status survives, the recon rows for that date are replaced, and both are republished. | dbt §8.1 (p.20) |

## Evidence

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X38 | Publishing to Splunk fails | The data is already durable in Oracle. The publish task is separate and retryable, and it is idempotent per date. | dbt §8.3 (p.21) |

## Restatement

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |
| X40 | A quarantined file is corrected | The same registry id is reused, the retry count goes up, the status resets to RECEIVED and every validation runs again before any RAW write. | ingest Appendix D.2 (p.22) |

## Not covered by either document

Asked about often, and in neither document. Listed so they are
raised rather than answered by whoever is writing the model that
day.

- Invalid data types inside an otherwise well-formed file
- Invalid measure values — a negative quantity, an impossible price
- Duplicate rows arriving inside a single fact feed
- Database constraint violations on the Gold write
- Network or permission failures on the archive move specifically
- Scheduler or worker restart part-way through a mapped task

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
