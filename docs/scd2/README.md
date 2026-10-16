# ODI 360 · the repository and the SCD2 rule cards

ODI 360 sits under **Catalog**. Six tabs: Overview, Processes, Tables &
mapping, Variables, Objects — the ODI repository export as the hub holds
it — and SCD2 rule cards, the dimensions that keep history, checked
against the warehouse.

## The repository (step `odi_repo`, sql/83)

| Piece | Where | What it does |
|---|---|---|
| ingestion | `ingestion/odi_repo_conn.py` · `sql/83_odi_repo.sql` | lands the export's six CSVs as `odi_scenario`, `odi_task`, `odi_variable`, `odi_table`, `odi_object`, `odi_edge` |
| API | `api/app/routers_odi.py` | `/odi/summary`, `/odi/scenarios`, `/odi/scenario/{name}`, `/odi/tables`, `/odi/table/{name}`, `/odi/variables`, `/odi/objects`, `/odi/edges` |
| screen | `ui/src/OdiRepoTabs.jsx` | a scenario step by step with each task's code as the export cut it; a table with its sources, writers, readers, edges and objects, linked to its rule card |

```
sqlplus ... @sql/83_odi_repo.sql                  # once
$env:CP_ODI_DIR = "local-data/odi_export"         # the export CSVs (never committed)
python -m ingestion.run odi_repo
```

A task whose code the export cut is marked TRUNCATED and the Overview
counts them. The scenario XML files hold the full code; re-export the
writer scenarios of the SCD2 dimensions first.

## The SCD2 rule cards (step `scd2`, sql/81)

Three tools and one ingestion step turn the old warehouse's history
mechanics into cards a screen can show.

| Piece | Where | What it does |
|---|---|---|
| column scan | `tools/scd2_scan.py` | names which column plays which SCD2 role, per table, from a column inventory; writes `scd2_pbdw.csv` |
| rules probe | `tools/scd2_rules_probe.py` | eleven counting questions a DBA can run against one dimension |
| scd2lens | `tools/scd2lens/` | the rule card: ODI evidence (merge keys, end-date procedure, date variables, SCD1 overrides) plus the read-only profile |
| ingestion | `ingestion/scd2_conn.py` · `sql/81_scd2_rules.sql` | runs the scan and scd2lens and lands the cards in `scd2_*` |
| API | `api/app/routers_scd2.py` | `/scd2/summary`, `/scd2/cards`, `/scd2/card/{table}` |
| screen | `ui/src/Odi360.jsx` | ODI 360 → SCD2 rule cards |

## Run it

```
sqlplus ... @sql/81_scd2_rules.sql                 # once
$env:CP_ODI_DIR = "local-data/odi_export"          # the ODI export CSVs (never committed)
$env:CP_SCD2_COLUMNS_CSV = "local-data/pbdw_columns.csv"   # optional: table,column,type,nullable for the scan
$env:CP_SCD2_WITH_DB = "1"                         # optional: profile against the warehouse
$env:CP_SCD2_PARTITIONS = "DIM_ACCOUNT=MASTER_IND"  # default; the sub-population column per table when the code that proves it is cut
$env:PBDW_DSN = ...; $env:PBDW_USER = ...; $env:PBDW_PASSWORD = ...
$env:ORACLE_CLIENT_LIB = "C:\oracle\instantclient_23_8"    # when the listener requires native encryption
python -m ingestion.run scd2
```

`ORACLE_CLIENT_LIB` has to be set **before** `python -m ingestion.run`
starts: the runner opens the hub connection first, and python-oracledb
fixes thin or thick mode at that first connection (`DPY-2019` is what you
see when thick is asked for afterwards). With the variable set, the runner
starts thick mode itself and every connection in the run, hub included,
uses it. Without an Instant Client the step cannot profile a warehouse
whose listener demands native encryption; run it offline (unset
`CP_SCD2_WITH_DB`) or give it the columns CSV.

Offline (no `CP_SCD2_WITH_DB`) the cards carry the ODI rules and the
quality tiles read "not profiled". With the database, the duplicate rate,
window gaps, open-row counts, the ACTIVE_IND disagreement and freshness
are filled from read-only counts. No key value from the warehouse is
stored; the top-keys list scd2lens prints stays on the console.

## The review loop

The tool writes the rules; a named person confirms them. The two are kept
apart on the screen and in the database.

```
python tools/scd2_review_export.py --out local-data/scd2_review.xlsx     # one row per rule, three columns to fill
# reviewers fill BUSINESS_MEANING, CONFIRMED (Y/N), REVIEWER, REVIEWER_NOTE — Copilot may help them write
$env:CP_SCD2_REVIEW_XLSX = "local-data/scd2_review.xlsx"
python -m ingestion.run scd2_review                                       # -> scd2_rule_review (sql/82)
```

A row is loaded only with a reviewer; N needs a note. The rule text the
reviewer saw is stored, so a rule rewritten by a later run is flagged
"changed since this review" rather than shown as still confirmed.

## Reading a card

* **PROVEN** — the ODI code or the database says it.
* **INFERRED** — the evidence points this way, not read directly.
* **UNKNOWN_TRUNCATED** — the export cut the code before the rule; the
  open questions name the scenario and task to re-export.
