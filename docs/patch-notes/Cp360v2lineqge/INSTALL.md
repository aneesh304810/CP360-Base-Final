# CP 360 — Legacy Business Dictionary + Standalone Lineage + Auto Mapper

Impacted-files drop. Apply on top of **FINAL-ALL + fixes + legacy-e2e-lineage**.

## What this adds

1. **Legacy business dictionary** — `legacy_dictionary` table ingested from the
   AddVantage / CRD / STAR business-definition workbooks, keyed by normalized
   field code (`BI/54 → BI_54`, `CR-1042 → CR_1042`, `ST.SEC.01 → ST_SEC_01`).
2. **Lineage as a top-level nav item** (pulled out of Interface 360) with
   SEI | Non-SEI scope and AddVantage / CRD / STAR badges. Clicking a **field
   name** (or the SRC node) opens the business definition, resolved by
   `legacy_lineage.src_source_column ⋈ legacy_dictionary`.
3. **Datapoint 360 Non-SEI scope** — legacy data points from the dictionary,
   business definitions inline, and a **"View in Lineage →"** jump for fields
   that map to a DWH column (disabled with a reason when not mapped).
4. **Data 360 pipelines** — All | SEI | Non-SEI scope; under Non-SEI, pipelines
   filter to the selected legacy system and **group by business function**
   (collapsible, first two open).
5. **Global search** — dictionary entries are indexed in `search_index`
   (kind `legacy_def`); a hit deep-links into Lineage at that system + field
   and opens its business-definition popup.
6. **Auto Mapper** — Utilities nav group; standalone aggregator-onboarding
   utility (upload CSV schema → pick PBDW/IMD → auto-map with confidence
   breakdown → accept/reject → export CSV). Client-side; writes nothing.

## Files

| File | Action | Destination |
|---|---|---|
| `sql/27_legacy_dictionary.sql` | **new** | `sql/` |
| `ingestion/legacy_dictionary_conn.py` | **new** | `ingestion/` |
| `ingestion/run.py` | replace | `ingestion/` (adds `legacy_dictionary` step before `search_index`) |
| `ingestion/search_index_builder.py` | replace | `ingestion/` (adds block 10: legacy defs → Lineage routing) |
| `api-app/routers_legacy_lineage.py` | replace | `api/app/` (adds `/business-def`, `/systems`, `/dictionary`) |
| `ui-src/api.js` | replace | `ui/src/` (adds `legacySystems`, `legacyBusinessDef`, `legacyDictionary`) |
| `ui-src/App.jsx` | replace | `ui/src/` (routes `lineage` + `mapper`; Datapoint360 gets `onOpen`) |
| `ui-src/AppShell.jsx` | replace | `ui/src/` (nav groups: Lineage, Utilities) |
| `ui-src/Interface360.jsx` | replace | `ui/src/` (Legacy E2E Lineage tab removed) |
| `ui-src/Lineage.jsx` | **new** | `ui/src/` (standalone page) |
| `ui-src/Mapper.jsx` | **new** | `ui/src/` |
| `ui-src/Datapoint360.jsx` | replace | `ui/src/` (SEI/Non-SEI scope + legacy view + jump) |
| `ui-src/Data360.jsx` | replace | `ui/src/` (pipelines scope + grouping) |

`ui/src/LegacyLineage.jsx` is no longer referenced (Lineage.jsx replaces it);
you can delete it or leave it — nothing imports it.

## Install

```bash
# 1. SQL (after 26_legacy_lineage.sql)
sqlplus $CP_DB @sql/27_legacy_dictionary.sql

# 2. point the connector at the dictionary workbooks (any subset)
export CP_LEGACY_DICT_ADDVANTAGE=/path/to/addvantage_dictionary.xlsx
export CP_LEGACY_DICT_CRD=/path/to/crd_dictionary.xlsx        # when available
export CP_LEGACY_DICT_STAR=/path/to/star_dictionary.xlsx      # when available
# or one combined workbook with a "Source System" column:
# export CP_LEGACY_DICT_XLSX=/path/to/combined.xlsx
# optional: export CP_LEGACY_DICT_SHEET="Sheet1"

# 3. ingest (dictionary loads before search_index reindexes)
python -m ingestion.run legacy_dictionary search_index

# 4. restart the API (clear __pycache__ if hot-reload is off)
find api -name __pycache__ -type d -exec rm -rf {} +

# 5. rebuild the UI
cd ui && npm run build
```

## Workbook columns (tolerant header matching)

AddVantage sheet as you have it works unchanged:
`Asset Name · Business Term · Business Function · Short Description ·
Long Description · AddVantage Field Code · Data Privacy Classification ·
Regulatory Classification · Operational Classification · Status`

CRD/STAR sheets in the same shape work too — the field-code column may be
named `Field Code`, `CRD Field Code`, `STAR Field Code`, or just `Code`;
`Function`, `Short Desc`, `Privacy`, etc. also resolve. Rows with an empty
field code are skipped. `Data Privacy Classification` = `PII` sets `is_pii='Y'`.

## Verify

```bash
curl "localhost:8000/legacy-lineage/systems"
curl "localhost:8000/legacy-lineage/business-def?code=BI/2/L1&system=ADDVANTAGE"
curl "localhost:8000/legacy-lineage/dictionary?system=ADDVANTAGE&q=account"
```

UI: **Lineage** nav → Non-SEI → AddVantage → click a field name → popup.
**Datapoint 360** → Non-SEI → pick a field → "View in Lineage →".
**Search** for a business term (e.g. "account long name") → lineage result.

## Notes

- SEI scope on the Lineage page is an intentional empty state
  ("arriving with the SWP program") until SEI lineage data exists.
- The lineage join normalizes `src_source_column` at query time
  (`REGEXP_REPLACE` in `/dictionary`, Python mirror in `/business-def`),
  so `BI/2/L1`, `BI_2_L1`, and `BI.2.L1` all resolve to the same definition.
- Data 360's Non-SEI system filter matches `bf_pipelines.legacy_system`
  by pattern (AddVantage / CRD·Charles River / STAR); grouping uses
  `business_domain` as the business function.
