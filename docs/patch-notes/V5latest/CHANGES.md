# Lineage v5 — multi-warehouse + three view modes + inline definitions

Impacted files (drop over the same paths, then follow Deploy below):

| File | Change |
|---|---|
| `sql/29_legacy_lineage_data_source.sql` | NEW — adds `DATA_SOURCE VARCHAR2(40) DEFAULT 'PBDW'` to LEGACY_LINEAGE, backfills existing rows to PBDW, adds index. Idempotent. |
| `ingestion/legacy_dictionary_conn.py` | v3 — multi-warehouse sources via `CP_LEGACY_SOURCES="PBDW=/data/pbdw.xlsx;IMDS=/data/imds.xlsx"`. Each workbook may carry the dictionary ("ALL"), a RICH 24-col lineage sheet (auto-detected by its Functional_Group header, or name it via `CP_LEGACY_LINEAGE_SHEET_RICH`), and the 4-col "DWH ALL" sheet. Rich rows win; 4-col rows for pairs the rich sheet lacks are appended as supplements (tagged in lineage_status_detail). Every lineage row gets `data_source`, and `lineage_id` is now `{ds}:{tgt}:{col}:{srchash}` so warehouses can't collide. Old single-workbook envs still work (tag via `CP_LEGACY_DATA_SOURCE`, default PBDW). |
| `api-app/routers_legacy_lineage.py` | `?data_source=` on /tables /fields /groups /dependency-network (graceful degrade: scoped query on a pre-29 DB falls back to unscoped). NEW `GET /legacy-lineage/data-sources` (chips + counts, pre-29 fallback returns a single PBDW row). NEW `GET /legacy-lineage/where-used?code=` (canonical-code match against SRC_Source_Column across warehouses — powers cross-warehouse chips and fan-out). Status fix: 'mapped' counts now accept the rich sheet's `Exists` too. |
| `ui-src/LegacyLineage.jsx` | v5 rewrite. "Lineage by Functional Group" gains the View switcher: **Table** (the drill, unchanged behavior + field-name click now opens the full inline dictionary+lineage panel), **Linkage Map** (per-group three-column wired board: DWH columns → lineage rows with master-token highlighting → dictionary cards; hover lights the path; click any card → inline panel), **Business** (passport rows per group; expand → inline passport with journey + PHYSICALIZED/RENAMED boundary flags + derived-origin node + cross-master note + cross-warehouse jump chips). Dependency View preserved (swimlanes, SVG wires, hover-dim, pin, metadata rail, explorer w/ breadcrumbs) — rail column chips now open the definition INLINE in the rail. The popup is fully retired. All fetches scoped by dataSource. |
| `ui-src/Lineage.jsx` | Wrapper: adds the **Data source · lineage target** chip row (PB Datawarehouse / IMDS Datawarehouse, live from /data-sources with counts). Cross-warehouse jumps from the inline panel switch the chip and deep-link to the twin field. Popup code removed. |
| `ui-src/api.js` | `data_source` on legacyLineageTables/Fields/Groups/DependencyNetwork + new `legacyDataSources()` and `legacyWhereUsed(code)`. |

## Deploy (in order)
1. Run `sql/29_legacy_lineage_data_source.sql` against SILVER.
2. Set `CP_LEGACY_SOURCES="PBDW=<pbdw workbook>;IMDS=<imds workbook>"` and
   `CP_LEGACY_LINEAGE_FROM_XLSX=1`, then re-run ingestion:
   `python -m ingestion.run legacy_lineage legacy_dictionary search_index`
   (new lineage_ids replace the old un-prefixed ones on merge; if you removed
   mappings from a sheet, clear that warehouse first:
   `DELETE FROM legacy_lineage WHERE data_source='PBDW';`)
3. Copy api-app/* and ui-src/* over the same paths; restart API; hard-refresh UI.

## Ingestion / search index — revisited (as asked)
- **Ingestion: required.** The two changes above (29 + connector v3) are it —
  no other connector or run.py change needed.
- **Search index: no change required.** Dictionary definitions are already
  indexed and deep-link into Lineage; the deep-link lands on the default
  warehouse (PBDW) and the inline panel's cross-warehouse chips take you to
  the IMDS twin. Optional later enhancement: emit one search entry per
  (definition × warehouse) with data_source in the payload — deferred until
  you find yourselves searching for IMDS columns by name.

## Verify
```bash
curl "localhost:8000/legacy-lineage/data-sources"
curl "localhost:8000/legacy-lineage/tables?data_source=IMDS"
curl "localhost:8000/legacy-lineage/where-used?code=BI/2-1"
curl "localhost:8000/legacy-lineage/business-def?code=BI/2-1&system=ADDVANTAGE&src_table=Addv-MSTR-IPN-SB_x.dat"
```
UI: Lineage → Non-SEI → the Data source row shows both warehouses with counts;
View switcher shows Table / Linkage Map / Business; clicking ACCOUNT_LONG_NAME_1
in any mode opens the inline dictionary+lineage panel; its "Same field, other
warehouse" chip flips to IMDS and opens ACCT_LONG_NM_1.
