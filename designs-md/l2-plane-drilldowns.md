---
id: l2-planes
title: L2 Plane Drill-downs
level: L2
icon: 🔍
color: #0b5e83
bg: #e0f5fd
order: 2
sub: withdrawn - to be rewritten from the drawing
zone_default: 2. Hub
generated: true
sei_status: overview
---

# CP Integration Hub — architecture

## The three documents, and that they disagree

SEI has given three documents. Two are design documents and
one is the architecture, and they do not describe the same
build. Every conflict below is a decision to take before a
model is written.

| # | The question | The architecture says | The design documents say |
|---|---|---|---|
| C1 | Three RAW tables, or seven | RAW_ACCOUNT, RAW_CLIENT, RAW_TAXLOT, RAW_TRANSACTION, RAW_POSITION, RAW_CORRECTED_TRANSACTION, RAW_CORRECTED_POSITION. | The dbt design document names three: account, client and transaction. Position, tax lot and the two correction tables do not appear in it at all. |
| C2 | Stage 2 as five tables, or as STG plus INT | Five STG2_* tables, materialised as tables, full refresh daily or incremental. | A STG view that stores nothing, plus an INT table kept seven days and partitioned. |
| C3 | Two Gold facts, or three | FACT_TRANSACTIONS, FACT_CP_HOLDINGS and FACT_TAX_LOT, each with its own strategy — merge, merge and periodic snapshot. | FACT_TRANSACTIONS only. |
| C4 | Corrections as files, or as a rule | Two correction files arrive daily and Stage 2 has a named step, correction file integration, that merges them. | Correction is a MERGE-versus-UPDATE rule applied inside the dimension build. No correction file is described. |
| C5 | Where data quality runs | A Data Quality Checks step after dbt Gold in the Airflow chain. | A per-row pass or fail computed in the STG view, before anything is loaded, plus tests between every layer. |

## The seam between the two design documents

The line is **the guarded PENDING → TRIGGER update on DATE_CONTROL**.

The Ingestion DAG owns PENDING → TRIGGER. Only the run whose UPDATE changes exactly one row may invoke transformation — that is how two scheduled runs five minutes apart cannot both trigger it. The Transformation DAG owns TRIGGER → COMPLETE and the creation of the next PENDING row, in one database transaction, and it re-checks completeness defensively before doing any work.

*File Ingestion design doc §5.1 (p.9) · File Ingestion design doc Appendix E.3 (p.24) · dbt design doc §5.3 (p.12)*

## Inbound

**Primary: SDC events. Secondary: file-based.** (BBH, stated directly)

Both SEI design documents describe the file path and only the file path — a scheduled scan every five minutes, one mapped task per file, completeness measured as a set of files that arrived. If events are the primary inbound route, the completeness gate, the business-date state machine and the SLA all rest on a path that is the secondary one.

This does not make the event components a proposal any more. It makes them the primary path with no design document behind them, which is a sharper problem and a different one.

## Outbound — Loader submission, via the Orchestration Hub

*BBH, stated directly — not in either SEI design document*

| # | Who | What happens |
|---|---|---|
| 1 | CRM → Hub | The Orchestration Hub exposes an API. CRM calls it with the loader details and the data the loader needs. |
| 2 | Hub | The Hub validates what it was given and transforms it into loader format. |
| 3 | Hub → SEI PS | SEI Professional Services processes the loader. |
| 4 | Hub → CRM | CRM exposes an API of its own, and the Hub calls it with the response. |

Two APIs, one each way, and the Hub owns validation and the format. That makes the Hub responsible for a contract neither SEI design document mentions: what a valid submission looks like, what happens to an invalid one, and what the response carries when SEI rejects a loader rather than the Hub.

## The containers

| Container | What is in it |
|---|---|
| **Ingress and Egress** | Landing and transport · API gateway and Apigee proxy · Loader framework · SEI-side source |
| **Ingestion** | Event-based ingestion · File-based ingestion · RAW profiling |
| **Orchestration** | Ingestion DAG · Transformation DAG · Business-date state machine |
| **Processing** | dbt models · Data quality and reconciliation · Warehouse and consumers |
| **Foundation** | Control and metadata · Evidence and observability · Errors, audit and lineage · Security and access |
| **OpenShift Platform** | Platform · Runtime · Deployment · Operations |

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
