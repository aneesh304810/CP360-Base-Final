# SCD2 rule cards · ODI 360

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
$env:PBDW_DSN = ...; $env:PBDW_USER = ...; $env:PBDW_PASSWORD = ...
$env:ORACLE_CLIENT_LIB = "C:\oracle\instantclient_23_8"    # when the listener requires native encryption
python -m ingestion.run scd2
```

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
