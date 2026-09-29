# Event 360 — load configuration

Three steps, in this order. They are separate because they answer different
questions and have different owners.

| step | what it loads | whose answer it is |
|---|---|---|
| `event360` | the SEI event specification workbook | SEI's — the contract |
| `sdc_compute` | client compute sizing per SDC view | measured — the bill |
| `event_subscription` | who consumes which event | BBH's own decision |

`event360` must run before `event_subscription`: a subscription points at an
event id, and the ids come from the contract.

## What to call the workbook

**Anything.** `CP_EVENT360_XLSX` takes a file path, or a folder — and a
folder is searched for exactly one `.xlsx`, under whatever name the
workbook arrived with. Two is refused rather than guessed.

So the only rule that matters: **one workbook per folder**, or point the
variable at the file. If you keep revisions beside each other, name the
variable explicitly rather than relying on the folder search:

```powershell
$env:CP_EVENT360_XLSX = "$Artifacts\EVENT-360\SEI_Event_Specification.xlsx"
```

`SEI_Event_Specification.xlsx` is only a suggestion — it reads as what it
is, and it sorts away from `SDC_Client_Compute.xlsx` in the same folder.
The loader does not care.

## Sheets

Six are required. A workbook missing one is refused rather than
part-loaded.

| sheet | rows | table |
|---|---|---|
| `Event_Catalog` | 105 | `meta_event_definition` |
| `Field_Level_Details` | 575 | `meta_event_field` |
| `Event_Types` | 3 | `ref_event_type` |
| `Event_Domains` | 5 | `ref_event_domain` |
| `Payload_Structure` | 6 | `ref_envelope_field` |
| `Consumption_Guidance` | 6 | `ref_consumption_rule` |
| `Micro_Batch_Markers` | 2 markers + 2 rules | `ref_micro_batch_marker` |

`Micro_Batch_Markers` is **optional** — a workbook revised before the sheet
existed loads exactly as before. `README` and `Extraction_Status` are
ignored by design.

### Micro_Batch_Markers

Name it `Micro_Batch_Markers` (what you already used). `Micro_Batch_Marker`
and `Batch_Markers` also resolve; anything else is ignored in silence,
which is the failure mode to avoid.

Columns, matched by header rather than position:

| header | also accepts |
|---|---|
| `Marker ID` | `Marker` |
| `Marker name` | `Name` |
| `Published where` | `Published` |
| `Catalog event` | — |
| `Payload fields` | `Payload` |
| `Purpose` | — |

**The markers do not go into the event catalog**, and the sheet's own
column says so: *Catalog event = No*. They carry ids 1000 and 1001, clear
of the catalog's 1–105, and publish on every subscribed domain topic
rather than on one. Two extra rows in a table gated at 105 would make
every "how many events are there" answer wrong by two.

**The sheet holds two kinds of row.** Rows with a numeric id are markers.
Rows with the literal word `Rule` in the id column state a consumption
rule about the markers. Both are kept, in one table, with `ENTRY_KIND`
saying which — a parser that reads that column as a number turns the rules
into two rows with a null key.

Gated like everything else: exactly 2 markers, ids exactly 1000 and 1001,
no id shared with a catalog event, and no row claiming to be a catalog
event. A third marker is a change to the commit-boundary contract and the
load stops rather than absorbing it.

## The PowerShell block

Paste into `local\load-all.ps1` above the ingestion run. Paths are the only
thing to change.

```powershell
# ---- EVENT 360 -------------------------------------------------------------
# Three sources, three owners:
#   event360            the CONTRACT      - what SEI says an event is
#   sdc_compute         the MEASURED bill - warehouse time per SDC view
#   event_subscription  OUR decisions     - who consumes it (CSVs you maintain)

# The workbook, or the folder holding it. A folder is searched and exactly
# one .xlsx is taken; two is refused rather than guessed, because picking
# the alphabetically-first of an old and a new revision silently is the
# kind of thing nobody notices until the counts are wrong.
$env:CP_EVENT360_XLSX    = "$Artifacts\EVENT-360\SEI_Event_Specification.xlsx"

# A folder, not a file: it expects consumers.csv and subscriptions.csv.
$env:CP_EVENT_SUB_DIR    = "$Artifacts\EVENT-360"

$env:CP_SDC_COMPUTE_XLSX = "$Artifacts\EVENT-360\SDC_Client_Compute.xlsx"

# Only if the Summary sheet's client code is not in the file name.
# $env:CP_SDC_COMPUTE_CLIENT = "BBH"

# THE GATES REFUSE, THEY DO NOT WARN. A specification load that is four rows
# short is worse than one that fails: the screens built on it look right and
# quietly under-report. So the row counts, the key resolution, the envelope
# shape and the trigger arithmetic are checked BEFORE anything is written,
# and a failure raises.
#
# Set these to "0" ONLY to inspect a workbook you know is mid-revision, and
# do not leave them set - a load that warns instead of refusing is a load
# nobody checks.
# $env:CP_EVENT360_STRICT    = "0"
# $env:CP_SDC_COMPUTE_STRICT = "0"
# $env:CP_EVENT_SUB_STRICT   = "0"
```

## Schema first

```powershell
# 51 creates the Event 360 tables, 53 the subscription ones.
# The ingestion steps merge into tables these create; without them every
# merge fails with ORA-00942 and the step reports zero rows.
sqlplus $User/$Password@$Dsn "@sql\51_event360.sql"
sqlplus $User/$Password@$Dsn "@sql\53_event_subscription.sql"
# 63 adds the micro-batch marker table. Skip it and the markers are simply
# not loaded; the rest of event360 is unaffected.
sqlplus $User/$Password@$Dsn "@sql\63_micro_batch_markers.sql"
```

## Run

```powershell
python -m ingestion.run event360
python -m ingestion.run sdc_compute
python -m ingestion.run event_subscription

# or all three, in dependency order:
python -m ingestion.run event360 sdc_compute event_subscription
```

## Verify

The workbook's shape is fixed by the contract, so these numbers are the
check, not a guide. A count that differs means the workbook changed and
something downstream needs to know.

```sql
SELECT COUNT(*) FROM meta_event_definition;   -- expect 105
SELECT COUNT(*) FROM meta_event_field;        -- expect 575
SELECT COUNT(*) FROM ref_event_type;          -- expect 3
SELECT COUNT(*) FROM ref_event_domain;        -- expect 5
SELECT COUNT(*) FROM ref_envelope_field;      -- expect 6
SELECT COUNT(*) FROM ref_consumption_rule;    -- expect 6
SELECT COUNT(*) FROM ref_event_consumer;      -- as many as consumers.csv has
SELECT COUNT(*) FROM ctl_event_subscription;  -- as many as subscriptions.csv has
SELECT entry_kind, COUNT(*) FROM ref_micro_batch_marker
 GROUP BY entry_kind;                         -- expect MARKER 2, RULE 2
```

Event ids 99, 100 and 101 do not exist in the index. That is the
specification, not a gap, and no placeholder rows are generated for them.

`NOT_SPECIFIED` in a data type, length or nullable column is the fact. The
specification never states payload field types, and anything that fills them
in later is inventing a contract.

## If a step reports zero

| symptom | cause |
|---|---|
| `ORA-00942` in the log | `sql\51` or `sql\53` has not run |
| "no .xlsx found" | `CP_EVENT360_XLSX` points at a folder with none |
| "two workbooks" | two revisions in the folder — name the file explicitly |
| `event_subscription` finds no events | it ran before `event360` |
| counts off by a few | the workbook was revised; the gate will have raised |
| markers load nothing, no error | the sheet is named something the loader does not recognise — see above |
