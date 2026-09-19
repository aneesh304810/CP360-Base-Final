# Event 360 — install and load

Ingests the SEI event specification workbook into six tables. Sheet 8
(`Extraction_Status`) is not loaded, as agreed.

## 1. SQL

```bash
sqlplus SILVER/****@host:1521/service @sql/51_event360.sql
```

Creates `REF_EVENT_TYPE`, `REF_EVENT_DOMAIN`, `REF_ENVELOPE_FIELD`,
`REF_CONSUMPTION_RULE`, `META_EVENT_DEFINITION`, `META_EVENT_FIELD` and four
indexes. Idempotent.

## 2. Load

```bash
export CP_CATALOG_DB_DSN='SILVER/****@host:1521/service'
# Drop the workbook in sample-artifacts/EVENT-360/ and that is all —
# the loader takes the single .xlsx it finds there and logs which one.
python -m ingestion.run event360

# Or name it explicitly:
export CP_EVENT360_XLSX='/path/to/event_workbook.xlsx'
```

Load order is handled inside the step: reference sheets → envelope → catalog →
fields → guidance.

## 3. What a good run looks like

```
event360: merged 700 rows across 6 tables
```

**A bad run writes nothing.** The gates raise before the first merge:

```
Event360LoadError: event360 load refused — nothing written.
  event count 104 <> 105; missing sections: ['4.49'] ...
```

That is deliberate. A specification load that is four rows short is worse than
one that fails — the screens built on it look right and quietly under-report.
`CP_EVENT360_STRICT=0` downgrades the gates to logging, for inspecting a
workbook known to be mid-revision. Do not use it for a real load.

### The gates

| Gate | Refuses when |
|---|---|
| Event count | ≠ 105 |
| Field count | ≠ 575 |
| Section coverage | 4.1 … 4.105 not contiguous, or duplicated |
| Event IDs | any of 99, 100, 101 present |
| Type / domain | a value not in `Event_Types` / `Event_Domains` |
| Envelope | a payload field not in `Payload_Structure` |
| Payload shape | a marker without exactly 3 fields, a data event without 4 |
| Parentage | a field row whose `Event ID` has no catalog row |
| Arithmetic | `4×data + 3×markers + trigger-rows` ≠ rows read |

Warnings (loaded, not refused): the sheet's `Trigger column count` disagreeing
with the parsed list — the **parsed** value is stored; `Payload key` and
`Composite key parts` disagreeing; events flagged `REVIEW_REQUIRED`.

## 4. Three things that are not bugs

**`NOT_SPECIFIED` in `DATA_TYPE`, `LENGTH_PRECISION`, `NULLABLE`.** The
specification never states payload field types. The literal is the fact. If
someone "tidies" these into inferred types, the catalogue starts asserting a
contract SEI never published — the single biggest schema risk in this
ingestion.

**Typos preserved verbatim.** `IDENTTIFIERS`, `insterest`, `Acount_ISA_Detail`,
`INSTRUMENT_GLOBA`. A typo in a contract may be the real object name.

**Missing IDs 99–101.** No placeholder rows are generated.

## 5. Known source anomalies, and what the loader does

| Anomaly | Handling |
|---|---|
| Markers carry `Not applicable` in view / key / operation | Stored as NULL, so nothing can join a view named "Not applicable". Not flagged — for a marker this is the contract |
| Event 92: SDC view `Not applicable` but sample payload says `"view": "NULL"` | `LOAD_FLAG = 'REVIEW_REQUIRED'` with the reason in `LOAD_FLAG_NOTE`. Detected by **shape**, not by hardcoding id 92, so a second one is caught too |
| Sections 4.97 / 4.98 share a title | Both load; they differ on payload key. `SECTION` is unique, so nothing collides |
| Sample payload that will not parse | Row loads, flagged `REVIEW_REQUIRED` with the parser error. One bad sample does not abandon 104 good rows |

## 6. Verifying independently

`sql/51_event360.sql` ends with a commented-out query that re-checks the gates
in the database. The loader asserts them itself, so it should always come back
empty — it is the second opinion, not the first.
