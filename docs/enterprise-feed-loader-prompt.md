# Enterprise Claude Prompt — Generate CP Catalog Feed/Loader Workbooks

Copy the boxed prompt into your BBH-controlled Enterprise Claude and attach your source
material (interface inventory, feed specs, loader specs, or whatever feed/loader source
you have). It produces THREE Excel files that ingest directly into the CP Catalog
`feed_catalog` and `loader_catalog` connectors:
- `inbound_feeds.xlsx`   (env: INBOUND_FEEDS_XLSX)
- `outbound_feeds.xlsx`  (env: OUTBOUND_FEEDS_XLSX)
- `loaders.xlsx`         (env: LOADER_CATALOG_XLSX)

These populate the **feed_catalog** table (read by Data 360 inbound-feeds view, Datapoint
360, search, and the pipeline builder) and the **loader_catalog** list. They are the
SIMPLE feed/loader layer (name + direction + fields), distinct from the rich
feed-dictionary / loader-workbook. Use this when you need feeds/loaders catalogued fast.

---

## THE PROMPT

You are a financial-data integration architect for Brown Brothers Harriman Capital
Partners, cataloguing feeds and loaders for the SEI Wealth Platform (SWP) migration.

I will attach source material describing data feeds and loaders (interface inventory,
feed specs, file layouts, or similar). Produce THREE Excel workbooks. Output ONLY the
files plus a 4-6 line summary. Do not invent feeds, loaders, or fields not present or
clearly implied by my input. Reproduce names EXACTLY (they are ingestion join keys).

### Workbook 1 — `inbound_feeds.xlsx` (feeds SWP → BBH)

**Sheet 1 (the index, must be the FIRST sheet — name it `Contents`).** One row per feed.
Columns (use these exact header names):
| Feed Name | Domain | Frequency | Business Function |
- Feed Name: the feed's name (becomes feed_id with spaces → underscores). EXACT.
- Domain: business domain — one of positions, taxlots, transactions, cash, fees, nav,
  gl, securities, accounts, clients, corporate_actions (closest fit).
- Frequency: EOD | BOD | Intraday | Daily | Weekly (as applicable).
- Business Function: a short description of what the feed carries.

**Sheets 2..N — one detail sheet PER feed, named EXACTLY the same as the Feed Name**
(so the connector matches it to the index row). One row per field. Columns:
| Field Name | Data Type | Required | Business Meaning | PII flag |
- Field Name: the field/column name. EXACT.
- Data Type: e.g. CHAR(17), NUMBER(9), DATE, DECIMAL(18,6).
- Required: Y / N (Y = NOT NULL).
- Business Meaning: short description of the field.
- PII flag: Y if the field is personally identifiable (name, SSN, DOB, address), else N.

### Workbook 2 — `outbound_feeds.xlsx` (feeds BBH → SWP)

IDENTICAL structure to Workbook 1 (Contents index sheet + one detail sheet per feed,
same columns). The only difference is these are outbound feeds (BBH → SWP / consumer).

### Workbook 3 — `loaders.xlsx` (loader catalog)

**Single sheet** (the first sheet is read). One row per loader. Columns (exact headers):
| Loader Name | Domain | Template | Validation | Error Template | Inbound Feeds | Outbound Feeds |
- Loader Name: the loader's name (becomes loader_id). EXACT.
- Domain: business domain (same vocabulary as feeds).
- Template: the loader template/format name, if known (else blank).
- Validation: short text of key validation rules (else blank).
- Error Template: error-handling template/name, if known (else blank).
- Inbound Feeds: semicolon-separated feed names this loader consumes (else blank).
- Outbound Feeds: semicolon-separated feed names this loader produces (else blank).

(Optional: if a loader has a detailed field layout, add a sheet named exactly as the
Loader Name with the layout — the connector will fold it into the loader's schema_def.)

### Rules
- Names (feed names, field names, loader names) must be reproduced EXACTLY from the
  source — they are the keys the catalog joins on. Detail sheet names MUST equal the
  feed/loader name in the index, character-for-character.
- If a value is unknown, leave the cell blank — never guess.
- Header names must match the lists above (the connector matches headers
  case/space-insensitively, but keep them close: "Feed Name", "Data Type", "Required",
  "Business Meaning", "PII flag", "Loader Name", "Domain", etc.).
- Mark PII conservatively: any client name, tax ID, DOB, address, email, phone = Y.
- Keep one feed = one detail sheet; do not merge multiple feeds into one sheet.
- Prefer completeness of the index over exhaustive field lists if the source is large;
  every feed in the index should still have a detail sheet, even if a few fields.

Output the three .xlsx files. End with a short summary: how many inbound feeds, outbound
feeds, and loaders, and any feeds you could not fully detail (missing field lists).

---

## After Claude returns the workbooks

1. Save them as `inbound_feeds.xlsx`, `outbound_feeds.xlsx`, `loaders.xlsx`.
2. Place under `...\FEED-CATALOG\` and confirm the env vars:
   ```
   $env:INBOUND_FEEDS_XLSX  = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\inbound_feeds.xlsx"
   $env:OUTBOUND_FEEDS_XLSX = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\outbound_feeds.xlsx"
   $env:LOADER_CATALOG_XLSX = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\loaders.xlsx"
   ```
3. Ingest:
   ```
   python -m ingestion.run feed_catalog loader_catalog datapoint_index search_index
   ```
   (datapoint_index after, so the feed fields become data points; search_index last.)
4. Verify:
   ```sql
   SELECT direction, COUNT(*) FROM feed_catalog GROUP BY direction;
   SELECT COUNT(*) FROM loader_catalog;
   SELECT feed_id, COUNT(*) FROM columns GROUP BY feed_id FETCH FIRST 10 ROWS ONLY;
   ```

## Note on the two feed layers
This SIMPLE layer (feed_catalog) is separate from the RICH layer
(feed_dictionary → datasets, loader_workbook → ldr_catalog). If you already load the rich
SWP_EOD_Data_Feeds.xlsx and 10-sheet loader workbook, you may only need these three for a
quick non-SEI project or to populate the inbound side of feed_catalog. Confirm which the
pipeline builder and Datapoint 360 read in your deployment before treating either as
redundant.
