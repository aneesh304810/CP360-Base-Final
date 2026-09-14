---
id: l3-errors
title: Error Handling, Quarantine & Override
level: L3
icon: 🚑
color: #c0392b
bg: #fde8e8
order: 4
sub: detailed design - reject lanes, quarantine, override workflow
match: error|quarantine|override|reject|dlq|dead.?letter|replay|exception|recon
---

What happens when something fails, and who is allowed to decide it should proceed anyway. Both source decks name this capability in a single line; nothing below it exists yet.

- Scope
- Taxonomy
- Data model
- Quarantine
- Lifecycle
- Override
- Worked failure
- Interface
- Open items

## What component 29 owns

Error handling sits between four neighbours and is easy to over-scope. These lines keep it coherent.

| Component | Owns | Does not own |
|---|---|---|
| **29 Error handling** | Taxonomy, error record, quarantine store, resubmission path, routing to alerts. | Deciding whether a rule failure is fatal — that is severity, owned by 28. |
| 28 DQ framework | Rule registry, severity tiers, thresholds, DQ results store, override authorisation. | Physical handling of the failed file or row. |
| 30 Reconciliation | Exception lifecycle for reconciliation breaks, control totals, the operator's queue. | Ingest-time failures. Those are 29's. |
| 21 Replay | Re-running a business date once the underlying problem is fixed. | Deciding that a replay is warranted. |

## Error taxonomy

Errors are classified on capture, and the class determines the route. Without this, everything becomes a generic pipeline failure and the operator has to read logs to find out what happened.

| Class | Name | Examples | Default route | Detected at |
|---|---|---|---|---|
| E1 | Transport | File missing, late beyond window, truncated, unreadable, auth failure | BLOCK FILE | Sensors (9), landing zone (8) |
| E2 | Structural | Encoding, delimiter, column count, header mismatch, manifest count mismatch, checksum | BLOCK FILE | G1 (23) |
| E3 | Type / parse | Unparseable date, non-numeric amount, oversized value | FLAG ROW | Stage 2 safe-cast (15) |
| E4 | Business rule | Unknown account, settle before trade, negative quantity where disallowed | FLAG ROW then G3 asserts | Stage 2 (15) / G3 (25) |
| E5 | Reconciliation | RAW→Gold count mismatch, control total break, orphan correction past window | BLOCK PUBLISH | G4 (26) / G5 (27) |
| E6 | Infrastructure | DB unavailable, session limit, pod evicted, timeout, disk full | RETRY | Any task |
| E7 | Orchestration | Upstream dependency failed, window breach, concurrent-run conflict | PAGE | Airflow (18, 20) |

Default route is what the class does absent a config override. Severity from the registry (28) can escalate FLAG to BLOCK, but never de-escalates E1, E2 or E5.

### Retry versus recover

| Class | Airflow retry | Why |
|---|---|---|
| E6 only | Yes, bounded exponential backoff | Transient infrastructure. The same input will succeed on the next attempt. |
| E1–E5, E7 | **Never** | The input is unchanged, so the outcome is unchanged. Retrying a DQ failure burns the window and produces a misleading run history where a real data problem looks like flakiness. |

## Error record data model

One error event table for the whole Hub, written by Python and by Airflow. Integration360 (35) reads it; nothing else writes it.

```
CREATE TABLE HUB_ERROR_EVENT (
  ERROR_ID          NUMBER(18)    GENERATED ALWAYS AS IDENTITY,
  ERROR_CLASS       VARCHAR2(4)   NOT NULL,   -- E1..E7
  ERROR_CODE        VARCHAR2(40)  NOT NULL,   -- E2_COLUMN_COUNT_MISMATCH
  SEVERITY          VARCHAR2(10)  NOT NULL,   -- ERROR | WARN  (resolved from registry 28)
  ROUTE             VARCHAR2(20)  NOT NULL,   -- BLOCK_FILE | BLOCK_PUBLISH | FLAG_ROW | RETRY | PAGE

  -- context: what was being processed
  BATCH_ID          VARCHAR2(40),
  LOAD_ID           NUMBER(18),               -- null for pre-load failures (E1)
  DOMAIN            VARCHAR2(30),             -- ACCOUNT | TRANSACTION | ...
  BUSINESS_DATE     DATE,
  FILE_NAME         VARCHAR2(260),
  ROW_NUM           NUMBER(12),               -- null for file-level errors
  GATE              VARCHAR2(4),              -- G1..G5, null if not gate-raised
  RULE_ID           VARCHAR2(40),             -- FK to the rule registry (28)
  DAG_RUN_ID        VARCHAR2(120),
  TASK_ID           VARCHAR2(120),

  -- payload
  MESSAGE           VARCHAR2(2000) NOT NULL,
  DETAIL            CLOB,                     -- JSON: expected vs actual, sample values

  -- lifecycle
  STATUS            VARCHAR2(20)  DEFAULT 'NEW' NOT NULL,
  ASSIGNED_TO       VARCHAR2(120),
  RESOLUTION        VARCHAR2(30),             -- RESUBMITTED | OVERRIDDEN | WAIVED | FIXED_UPSTREAM
  RESOLVED_BY       VARCHAR2(120),
  RESOLVED_TS       TIMESTAMP,
  RESOLUTION_NOTE   VARCHAR2(2000),

  CREATED_TS        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_HUB_ERROR_EVENT PRIMARY KEY (ERROR_ID)
)
PARTITION BY RANGE (CREATED_TS) INTERVAL (NUMTOYMINTERVAL(1,'MONTH'))
  (PARTITION P_INIT VALUES LESS THAN (TIMESTAMP '2026-01-01 00:00:00'));

CREATE INDEX IX_ERR_OPEN   ON HUB_ERROR_EVENT (STATUS, SEVERITY, CREATED_TS);
CREATE INDEX IX_ERR_LOAD   ON HUB_ERROR_EVENT (LOAD_ID);
CREATE INDEX IX_ERR_BATCH  ON HUB_ERROR_EVENT (BATCH_ID, DOMAIN);
```

### Error code convention

{CLASS}_{SUBJECT}_{CONDITION} — for example E2_MANIFEST_COUNT_MISMATCH, E4_ACCOUNT_UNKNOWN, E5_TIEOUT_ROWCOUNT. Codes are registered in the config store (33), not invented at the call site. An unregistered code is itself an error — it fails CI, so the catalogue cannot silently drift.

## Quarantine store

Two levels — whole files that failed G1, and individual rows that could not be parsed into columns at all. Both retain the original bytes.

### File-level quarantine

The file is **copied**, not moved. The landing zone retains its own copy under its own retention — an operator answering "what did SEI actually send" should never depend on the quarantine process having worked correctly.

### Row-level quarantine

Applies only where a row cannot be split into columns — ragged delimiter, embedded newline, encoding break. A row that parses but holds a bad value is not quarantined; it loads into RAW as text and is flagged in Stage 2. That distinction keeps RAW faithful.

```
CREATE TABLE HUB_QUARANTINE_ROW (
  QUARANTINE_ID   NUMBER(18)    GENERATED ALWAYS AS IDENTITY,
  LOAD_ID         NUMBER(18)    NOT NULL,
  DOMAIN          VARCHAR2(30)  NOT NULL,
  BUSINESS_DATE   DATE          NOT NULL,
  FILE_NAME       VARCHAR2(260) NOT NULL,
  ROW_NUM         NUMBER(12)    NOT NULL,
  RAW_LINE        CLOB          NOT NULL,   -- the original line, unmodified
  ERROR_ID        NUMBER(18)    NOT NULL,   -- FK HUB_ERROR_EVENT
  STATUS          VARCHAR2(20)  DEFAULT 'QUARANTINED',
  RESUBMIT_LOAD_ID NUMBER(18),               -- the load that later accepted it
  CREATED_TS      TIMESTAMP     DEFAULT SYSTIMESTAMP
);
```

### Retention

| Store | Retention | Driver |
|---|---|---|
| Quarantined files | Match RAW retention | A replay of day N must be able to see what was rejected on day N. Shorter retention creates a gap in the audit story. |
| Quarantined rows | Match RAW retention | Same reasoning. |
| Error events | Longer — 24 months minimum | Small table, and the operational history is what evidences control effectiveness to an auditor. |

RAW retention is itself unset — it depends on the replay-depth decision, still open.

## Exception lifecycle

An error is not an alert. It has states, an owner and a resolution — otherwise the same failure recurs nightly and nobody can say whether it was ever addressed.

| Resolution | Means | Triggers |
|---|---|---|
| RESUBMITTED | SEI sent a replacement file; it loaded under a new LOAD_ID. | Normal ingest. Prior load marked SUPERSEDED. |
| OVERRIDDEN | A human authorised the blocked run to proceed with the data as-is. | Override record written; run resumes. See next section. |
| WAIVED | The condition is known and acceptable; the rule needs adjusting. | No pipeline action. Raises a change to the rule registry. |
| FIXED_UPSTREAM | SEI corrected the source; a correction file follows. | May trigger a replay of affected dates. |

## Override path

Blocking gates without an override mean a 2am failure waits until morning. An override that is not tightly constrained means the gates are decorative. Both failure modes are real; the design below is the narrow path between them.

### Constraints

- **Single-run scope, always.** An override authorises one gate, on one LOAD_ID or batch, for one run. It never persists, never applies to a future date, and cannot be set as a standing exemption. A standing exemption is a rule change and goes through the registry.
- **Never available for E5 at G4.** A tie-out break means Gold does not reconcile to RAW. Overriding it publishes knowingly-wrong data to PBDW and IMDS. If the business genuinely needs to publish, that is a business decision recorded outside the pipeline — not a button in it.
- **Two-person rule above a threshold.** Overrides on ERROR-severity failures affecting more than a configured row count or value require a second authoriser. Threshold in the config store.
- **Expires.** An override token is valid for a bounded window — 60 minutes by default. A stale approval cannot be replayed into a later run.
- **Written to lineage, not just to a log.** The override is part of the audit trail for the affected business date. An auditor asking why day N published despite a failure must find the answer in the same place as the rest of the evidence.

### Override record

```
CREATE TABLE HUB_OVERRIDE (
  OVERRIDE_ID     NUMBER(18)    GENERATED ALWAYS AS IDENTITY,
  ERROR_ID        NUMBER(18)    NOT NULL,   -- what is being overridden
  GATE            VARCHAR2(4)   NOT NULL,
  SCOPE_TYPE      VARCHAR2(20)  NOT NULL,   -- LOAD | BATCH   (never DOMAIN, never STANDING)
  SCOPE_ID        VARCHAR2(40)  NOT NULL,
  BUSINESS_DATE   DATE          NOT NULL,
  JUSTIFICATION   VARCHAR2(2000) NOT NULL,  -- free text, mandatory, min length enforced
  APPROVER_1      VARCHAR2(120) NOT NULL,
  APPROVER_2      VARCHAR2(120),               -- required above threshold
  GRANTED_TS      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  EXPIRES_TS      TIMESTAMP     NOT NULL,
  CONSUMED_TS     TIMESTAMP,                   -- set when the gate actually uses it
  CONSTRAINT CK_OVR_SCOPE CHECK (SCOPE_TYPE IN ('LOAD','BATCH'))
);
```

### Gate behaviour with an override present

The row-level tag matters: downstream consumers and any later investigation can identify exactly which records were published under an override, without reading the override table.

## Worked failure — G1 column-count mismatch

One concrete path through every component above, at 01:14 on a business date.

## Framework surface

One import for Python components, one operator for Airflow. Both write to the same store — an error raised in dbt-land and an error raised in ingest must be indistinguishable to Integration360.

```
# hub_framework/errors.py — used by 13, 23, 26, 29, 30

from hub_framework.errors import HubError, ErrorClass, raise_blocking

raise_blocking(
    code       = "E2_COLUMN_COUNT_MISMATCH",     # must exist in registry (33)
    context    = ctx,                              # batch, load, domain, file, date
    message    = "header column count 25, expected 24",
    detail     = {"expected": 24, "actual": 25, "header": header_line},
    quarantine = QuarantineFile(path=src_path),    # optional
)
# → writes HUB_ERROR_EVENT, copies to quarantine, checks for a valid override,
#   raises NonRetryableHubError if none. severity resolved from the registry,
#   never passed by the caller.

# flagging, not blocking — used inside Stage 2 post-processing and G2
flag_row(code="E4_ACCOUNT_UNKNOWN", context=ctx, row_num=n)

# Airflow side
from hub_framework.operators import GateOperator

GateOperator(
    task_id   = "g4_tieout_fact_transactions",
    gate      = "G4",
    rule_set  = "tieout.fact_transactions",   # resolved from registry
    scope     = "{{ ti.xcom_pull('ingest_transaction')['load_id'] }}",
    retries   = 0,                            # enforced by the operator regardless
)
```

- **Severity is never a caller argument.** If a developer can pass severity="warn" at the call site, severity has left the registry and the config-driven design is decorative.
- **Codes are validated at import time** against the registry snapshot, and in CI against the live registry. An unregistered code fails the build.
- **The same context object** flows from the ingest framework through every gate, so LOAD_ID, batch and domain are never reconstructed or guessed.

## Open items

None of these are technical unknowns. They are decisions about who is accountable when the pipeline stops.

| # | Question | Owner | Why it matters |
|---|---|---|---|
| 1 | Who holds override authority, and what is the two-person threshold | BBH ops + risk | Without a named role, the override is either unusable at 2am or effectively unrestricted. Both defeat the gates. |
| 2 | Is G4 override-eligible at all | ARB | Recommendation above is no. If the business disagrees, that needs stating explicitly, not discovering during an incident. |
| 3 | Escalation SLA per severity | BBH ops | Drives the aged-NEW escalation path and the on-call rota. |
| 4 | Quarantine retention — inherits RAW retention, which is unset | Business + ops | Depends on the replay-depth decision. Blocked on the same answer. |
| 5 | Does SEI receive error notifications automatically | SEI + BBH | Most E1/E2 failures are SEI-side. A manual email loop adds hours to every recurrence. |
| 6 | Error queue ownership: Integration360 or SEI dashboard AD-6 | ARB | Two queues means two owners and neither closing the exception. |
| 7 | Partial-batch interaction AD-5 | ARB | Determines whether one domain's E2 failure stops the other six. The taxonomy is ready for either answer. |

