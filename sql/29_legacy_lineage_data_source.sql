-- ============================================================================
-- 29_legacy_lineage_data_source.sql
-- Adds the target-warehouse discriminator to LEGACY_LINEAGE.
--
-- Why: AddVantage lineage lands in more than one warehouse (PB Datawarehouse,
-- IMDS Datawarehouse, more later). Each warehouse arrives as its own source
-- workbook/folder, so the loader tags rows at ingestion time; the API scopes
-- every lineage endpoint by ?data_source=.
--
-- Notes
--   * Existing rows are backfilled to 'PBDW' (all pre-existing lineage came
--     from the PB Datawarehouse mapping workbook).
--   * New loader runs write LINEAGE_ID as  {data_source}:{tgt}:{col}:{srchash}
--     so the same target column arriving from two warehouses can never
--     collide. Old-format ids ({tgt}:{col}:{srchash}) remain valid; the next
--     full reload of a source replaces them.
--   * Idempotent: safe to run more than once.
-- ============================================================================

DECLARE
  e_col_exists EXCEPTION;  PRAGMA EXCEPTION_INIT(e_col_exists, -1430);
BEGIN
  EXECUTE IMMEDIATE
    'ALTER TABLE legacy_lineage ADD (data_source VARCHAR2(40) DEFAULT ''PBDW'')';
EXCEPTION WHEN e_col_exists THEN NULL;
END;
/

UPDATE legacy_lineage SET data_source = 'PBDW' WHERE data_source IS NULL;
COMMIT;

DECLARE
  e_idx_exists EXCEPTION;  PRAGMA EXCEPTION_INIT(e_idx_exists, -955);
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX ix_legacy_lineage_ds ON legacy_lineage (data_source, dwh_target_table)';
EXCEPTION WHEN e_idx_exists THEN NULL;
END;
/
