-- ============================================================================
-- 52_sei_crosswalk_attach.sql
-- Attaching a SEI crosswalk to a warehouse whose baseline ALREADY EXISTS.
--
-- WHY THIS IS DIFFERENT FROM THE IMDS CASE
--
-- IMDS had no STAR lineage in LEGACY_LINEAGE, so the crosswalk workbook
-- supplied the baseline AND the SEI mapping, and sql/51's connector loaded
-- both. PBDW is the opposite: 1,180 rows are already there, loaded from the
-- AddVantage mapping workbook by legacy_lineage_conn.py. For PBDW the
-- crosswalk workbook must supply ONLY the SEI side and attach to what exists.
--
-- THE JOIN IS NOT THE SAME EITHER. IMDS contract fields are STAR field names
-- and match literally. PBDW contract fields are AddVantage field codes, and
-- the SAME field appears as BI/2-1 in one sheet and BI_2_L1 in another — the
-- reason _norm_code and _legacy_groups._CANON exist. A literal join silently
-- matches nothing.
--
-- So both sides get a canonical column, written by the loader with the same
-- rule the dictionary join uses, and the API joins on that.
--
-- ADDITIVE, and only to tables sql/51 created. Nothing PBDW already depends
-- on is altered. Idempotent.
-- ============================================================================

DECLARE e_col EXCEPTION; PRAGMA EXCEPTION_INIT(e_col, -1430);
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE sei_source_map ADD (src_col_norm VARCHAR2(200))';
EXCEPTION WHEN e_col THEN NULL; END;
/
DECLARE e_col EXCEPTION; PRAGMA EXCEPTION_INIT(e_col, -1430);
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE legacy_src_column ADD (src_col_norm VARCHAR2(200))';
EXCEPTION WHEN e_col THEN NULL; END;
/

-- Which rows this connector owns. A crosswalk attached to an existing
-- baseline owns no LEGACY_LINEAGE row, and the loader must never purge one.
DECLARE e_col EXCEPTION; PRAGMA EXCEPTION_INIT(e_col, -1430);
BEGIN
  EXECUTE IMMEDIATE
    'ALTER TABLE legacy_lane ADD (lineage_owner VARCHAR2(20) DEFAULT ''EXTERNAL'')';
EXCEPTION WHEN e_col THEN NULL; END;
/

DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_map_norm ON sei_source_map (data_source, src_col_norm)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_legacy_src_norm ON legacy_src_column (data_source, src_col_norm)';
EXCEPTION WHEN e_idx THEN NULL; END;
/

-- The PBDW lane owns no lineage: legacy_lineage_conn.py does.
UPDATE legacy_lane SET lineage_owner = 'EXTERNAL'
WHERE  data_source = 'PBDW' AND lineage_owner IS NULL;
COMMIT;

-- ---------------------------------------------------------------------------
-- HEALTH CHECK — run after attaching. Every SEI mapping should find the
-- existing lineage row it claims to map. Rows returned here are mappings
-- pointing at a contract field no lineage row consumes: net-new scope, or a
-- field code spelled a way the canon rule does not reconcile. The two look
-- identical in a spreadsheet and are very different problems.
-- ---------------------------------------------------------------------------
-- SELECT m.src_file_key, m.src_source_column, m.src_col_norm, m.sei_datapoint
-- FROM   sei_source_map m
-- WHERE  m.data_source = 'PBDW'
-- AND NOT EXISTS (
--   SELECT 1 FROM legacy_lineage l
--   WHERE  l.data_source = m.data_source
--     AND  REGEXP_REPLACE(UPPER(TRIM('_' FROM
--            REGEXP_REPLACE(l.src_source_column,'[[:space:]/.-]+','_'))),
--            '_L([0-9]+)','_\1') = m.src_col_norm);
