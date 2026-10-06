---
id: database-model
title: Database Model
level: L1
icon: ▤
color: #0f4775
bg: #eef3f8
order: 4
sub: the data path and the control plane, as one picture
generated: true
sei_status: overview
---

# The database model

Two bands. The data path is where rows live and is what a business
reader follows. The control plane decides whether they move and is
what an operator follows at 3am.

## The data path

| Layer | Kind | What it holds | Written by | Read by |
|---|---|---|---|---|
| **RAW** — Stage 1 | table | One table per inbound interface, append-only, as delivered. | Python loader | the STG view |
| **STG** — Stage 2 | view | A view. Stores nothing, recomputed on read, and its job is the source DQ check. | nobody - it is a view | the INT models |
| **INT** — Stage 2 INT | table | 52 canonical tables. The normalised SWP model, PASS rows only, partitioned by BUSINESS_DATE and kept seven days. | dbt | DIM and FACT, and replay |
| **DIM / FACT** — Gold | table | SCD2 dimensions built first, dimension-resolved facts built second. | dbt | Pre-Gold and consumers |
| **Pre-Gold** — Pre-Gold | table | A mirror of IMDS and PBDW, so the last step is movement rather than transformation. | dbt | the warehouse load |
| **Warehouse** — Stage 3 | table | The warehouse itself. No reshaping at this boundary. | movement | the estate |

## The control plane

| Table | Role | What it holds | Written by | Read by |
|---|---|---|---|---|
| `FILE_SCHEMA_CONFIG` | configuration | What is expected: the interfaces, their patterns, their target RAW table and whether a zero-row file is allowed. | nobody at run time | discovery, the loader, the gate |
| `FILE_REGISTRY` | what arrived | One row per interface per business date, with its counts and its lifecycle. ARCHIVED on it is what completeness counts. | the Python loader | the gate, recovery, evidence |
| `DATE_CONTROL` | the business date | One row per business date. PENDING to TRIGGER to COMPLETE, at most one date open at a time. | both DAGs, by guarded update | every run |
| `DQ_VALIDATION_FAILURE` | what failed | A row per failing record per rule, with resolution_status and whether it is reprocess-eligible. | dbt | replay, evidence, the DQ screens |
| `RECON_RESULT` | what agrees | Counts across each boundary per business date. Three boundaries are specified; the event path needs more. | dbt | evidence and sign-off |

Every control table has exactly one writer. That is the property worth keeping: two writers on DATE_CONTROL is how two runs both believe they own the business date, and the guarded update exists precisely because the design refuses to rely on there being only one.

## Not built

- **`MICRO_BATCH_REGISTRY`** — the event path. The event path's equivalent of FILE_REGISTRY: one row per micro-batch with a state and a count. Without it the gate cannot ask whether every micro-batch LOADED, which is half of its condition.
- **`LOADER_SUBMISSION`** — the outbound loader. One row per submission threading all four legs, with counts from the status API and the id of the error-detail file. Without it a reject count has nothing to reconcile against and a batch that never comes back never ages out.

The outbound one now has a design in the supplement's workflow ERD:
`WORKFLOW_DEFINITION contains WORKFLOW_STEP_DEFINITION`, `WORKFLOW_DEFINITION instantiates WORKFLOW_INSTANCE`, `WORKFLOW_INSTANCE executes WORKFLOW_STEP_INSTANCE`, `WORKFLOW_INSTANCE invokes API_CALL`, `WORKFLOW_INSTANCE submits LOADER_DELIVERY`, `API_CALL reports STATUS_EVENT`, `LOADER_DELIVERY reports STATUS_EVENT`.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
