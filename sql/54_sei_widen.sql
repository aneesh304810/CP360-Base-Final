-- ============================================================================
-- 54_sei_widen.sql
-- Widen the columns the real workbook overflowed.
--
-- WHAT HAPPENED. The first load raised ORA-12899 on two columns:
--
--   LEGACY_SRC_COLUMN.EVIDENCE      actual 34, maximum 30
--   SEI_CATALOG_VERIFY.VERIFY_RESULT actual 70 and 186, maximum 40
--
-- Both were sized for a controlled vocabulary — EVIDENCE as one of six
-- tokens, VERIFY_RESULT as a short code. The workbook writes sentences
-- instead: "DOCUMENT - IMDS_Star_Linage_Data (003).xlsx", and a verification
-- result that explains itself in 186 characters.
--
-- Rather than force the workbook to shorten, widen the columns. A controlled
-- value still fits; an explanatory one is more useful than a truncated code,
-- and a row rejected outright is worse than either.
--
-- Every other column of the same kind is widened at the same time, so this
-- is the last time a row is lost to a size the workbook never agreed to.
--
-- Idempotent: ORA-1430 (column already added) and ORA-1441/1451 are not
-- raised by a widening MODIFY that is already in effect, and re-running a
-- MODIFY to the same width is a no-op.
-- ============================================================================

DECLARE
  PROCEDURE widen(p_table VARCHAR2, p_col VARCHAR2, p_type VARCHAR2) IS
    e_no_table EXCEPTION; PRAGMA EXCEPTION_INIT(e_no_table, -942);
    e_no_col   EXCEPTION; PRAGMA EXCEPTION_INIT(e_no_col,  -904);
    e_shrink   EXCEPTION; PRAGMA EXCEPTION_INIT(e_shrink,  -1441);
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' MODIFY (' || p_col || ' ' || p_type || ')';
  EXCEPTION
    WHEN e_no_table THEN NULL;   -- table not created yet; 51/53 will size it
    WHEN e_no_col   THEN NULL;   -- column not present in this build
    WHEN e_shrink   THEN NULL;   -- already wider than asked
  END;
BEGIN
  -- EVIDENCE is a sentence in practice, not a token.
  widen('legacy_src_column',    'evidence',        'VARCHAR2(200)');
  widen('sei_source_map',       'evidence',        'VARCHAR2(200)');
  widen('sei_code_set',         'evidence',        'VARCHAR2(200)');
  widen('sei_identifier_xwalk', 'evidence',        'VARCHAR2(200)');
  widen('sei_dual_source',      'evidence',        'VARCHAR2(200)');
  widen('sei_feed',             'evidence',        'VARCHAR2(200)');
  widen('sei_input_lineage',    'evidence',        'VARCHAR2(200)');
  widen('uaf_field_schema',     'evidence',        'VARCHAR2(200)');
  widen('sei_verify',           'evidence_left',   'VARCHAR2(200)');
  widen('sei_verify',           'evidence_right',  'VARCHAR2(200)');

  -- The verification result explains itself rather than coding itself.
  widen('sei_catalog_verify',   'verify_result',   'VARCHAR2(400)');
  widen('sei_catalog_verify',   'matched_file',    'VARCHAR2(400)');
  widen('sei_catalog_verify',   'matched_row',     'VARCHAR2(200)');

  -- Verdict and kind vocabularies, in case a workbook qualifies them.
  widen('sei_verify',           'match_verdict',   'VARCHAR2(60)');
  widen('sei_verify',           'map_kind',        'VARCHAR2(60)');
  widen('sei_verify',           'failed_checks',   'VARCHAR2(1000)');
  widen('sei_source_map',       'map_kind',        'VARCHAR2(60)');
  widen('sei_input_lineage',    'mapping_status',  'VARCHAR2(200)');
  widen('sei_input_lineage',    'record_scope',    'VARCHAR2(400)');

  -- Types and lengths arrive as prose too ("NUMBER, scale not published").
  FOR r IN (SELECT * FROM (
        SELECT 'sei_source_map' t, 'sei_type' c FROM dual UNION ALL
        SELECT 'sei_input_lineage','published_type' FROM dual UNION ALL
        SELECT 'sei_catalog_verify','published_type' FROM dual UNION ALL
        SELECT 'uaf_field_schema','published_type' FROM dual UNION ALL
        SELECT 'legacy_src_column','src_type' FROM dual)) LOOP
    widen(r.t, r.c, 'VARCHAR2(200)');
  END LOOP;
END;
/
COMMIT;
