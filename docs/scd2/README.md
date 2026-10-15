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

## Reading a card

* **PROVEN** — the ODI code or the database says it.
* **INFERRED** — the evidence points this way, not read directly.
* **UNKNOWN_TRUNCATED** — the export cut the code before the rule; the
  open questions name the scenario and task to re-export.
