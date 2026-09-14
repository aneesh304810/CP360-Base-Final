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
| `sql/27_legacy_dictionary.sql` | **new** (v2 schema) | `sql/` — fresh installs |
| `sql/28_legacy_dictionary_v2_upgrade.sql` | **new** | `sql/` — ONLY if the v1 27 script was already deployed |
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
| `ui-src/Data360.jsx` | replace | `ui/src/` (page-level All/SEI/Non-SEI scope + badges above the tabs; Non-SEI pipelines grouped by business function) |
| `ui-src/SearchResults.jsx` | replace | `ui/src/` (Lineage module facet + legacy_def results) |

`ui/src/LegacyLineage.jsx` is no longer referenced (Lineage.jsx replaces it);
you can delete it or leave it — nothing imports it.

## Install

```bash
# 1. SQL (after 26_legacy_lineage.sql)
sqlplus $CP_DB @sql/27_legacy_dictionary.sql
# if the v1 27 script was ALREADY deployed, run the upgrade instead:
# sqlplus $CP_DB @sql/28_legacy_dictionary_v2_upgrade.sql

# 2. point the connector at the AddVantage master workbook
export CP_LEGACY_DICT_XLSX=/path/to/AddVantage_Master_Workbook.xlsx
# defaults: dictionary sheet "ALL", lineage sheet "DWH ALL", system ADDVANTAGE
# to ALSO load legacy_lineage from the "DWH ALL" sheet:
export CP_LEGACY_LINEAGE_FROM_XLSX=1
# future CRD/STAR workbooks (same or classification-style column shapes):
# export CP_LEGACY_DICT_CRD=/path/to/crd_dictionary.xlsx
# export CP_LEGACY_DICT_STAR=/path/to/star_dictionary.xlsx

# 3. ingest (dictionary loads before search_index reindexes)
python -m ingestion.run legacy_dictionary search_index

# 4. restart the API (clear __pycache__ if hot-reload is off)
find api -name __pycache__ -type d -exec rm -rf {} +

# 5. rebuild the UI
cd ui && npm run build
```

## Workbook shape (AddVantage master workbook)

The connector reads the **"ALL"** sheet (dictionary) and optionally the
**"DWH ALL"** sheet (lineage). The LIST and per-master sheets are ignored —
ALL / DWH ALL are the aggregates.

Handled automatically (verified against the real file):
- Row 1 title row → header row auto-detected (row 2); trailing-space headers
  ("ADDV Field ", "Is Required ") stripped; "Precision(If Numeric)" parens
  collapse in matching.
- Columns: ADDV Field, ADDV Name, Master, Group, Field Data Type, Field Max
  Length, Precision(If Numeric), Format (If Date), Is Required, Is Unique,
  Description (multi-line, up to ~2.8k chars → long_desc CLOB; first line →
  short_desc), PB Field Mapping, Data Selection / Comments.
- Blank-field-code section rows skipped. Data types stored raw (A, N, "N or
  A", masks) — no normalization attempted.
- **Canonical join key**: separators `/ . -` → `_`, then `_L<digits>` →
  `_<digits>`, so the dictionary's `BI/2-1` and the DWH sheet's `BI_2_L1`
  both resolve to `BI_2_1`. Applied identically in the connector, the
  `/business-def` endpoint, and the SQL join in `/dictionary`.
- DWH ALL duplicate (target_table, target_column) pairs preserved:
  `lineage_id` is built on the full 4-column grain (target + md5 of source),
  so one target column keeps all of its source files. Blank-SRC rows load as
  `lineage_status='unmapped'`.

## Verify

```bash
curl "localhost:8000/legacy-lineage/systems"
curl "localhost:8000/legacy-lineage/business-def?code=BI/2-1&system=ADDVANTAGE"
# same result via the DWH convention:
curl "localhost:8000/legacy-lineage/business-def?code=BI_2_L1&system=ADDVANTAGE"
curl "localhost:8000/legacy-lineage/dictionary?system=ADDVANTAGE&q=account&master=Account%20Master"
curl "localhost:8000/legacy-lineage/masters?system=ADDVANTAGE"
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
  `business_domain` as the business function. The All | SEI | Non-SEI
  scope and system badges sit at page level (above the tabs), owned by
  the `Data360` component and passed into `PipelinesTab` → `BfPipelinesView`.
