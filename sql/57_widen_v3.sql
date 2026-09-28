-- 57_widen_v3.sql --------------------------------------------------------
--
-- The first load of the 24-sheet workbook rejected 15 rows on two columns.
-- Both are widened here rather than truncated, for the reason sql/54 gives:
-- a silently shortened value is worse than a rejected one, because the
-- rejection is at least visible in the log.
--
--   SEI_INPUT_LINEAGE.CODE_SET_NAME   actual 177, maximum 120  (13 of 950)
--   STAR_UPLOADER_JOB.PRE_PROCESS     actual 3180, maximum 2000 (2 of 24)
--
-- THE FIRST ONE IS A MAPPING BUG, NOT A SIZING ONE, and widening alone
-- would hide it. The connector aliased ACCEPTABLE_VALUES into CODE_SET_NAME
-- on the theory that they were the same idea. They are not: a code-set name
-- is an identifier that joins to SEI_CODE_SET, and ACCEPTABLE_VALUES is
-- free text listing the values themselves. Loading one into the other
-- produces a column that looks joinable and joins to nothing. The alias is
-- removed in the connector and ACCEPTABLE_VALUES gets its own column here.
--
-- The second is genuinely long prose — a loader's pre-processing described
-- in a paragraph — and 4000 is the right answer.
--
-- Everything else widened below is pre-emptive, from the shape this load
-- showed: free-text columns carrying paragraphs rather than phrases.

DECLARE
  PROCEDURE widen(p_table VARCHAR2, p_col VARCHAR2, p_type VARCHAR2) IS
    e_no_table  EXCEPTION; PRAGMA EXCEPTION_INIT(e_no_table, -942);
    e_no_column EXCEPTION; PRAGMA EXCEPTION_INIT(e_no_column, -904);
    e_shrink    EXCEPTION; PRAGMA EXCEPTION_INIT(e_shrink, -1441);
    e_nochange  EXCEPTION; PRAGMA EXCEPTION_INIT(e_nochange, -1442);
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table
                      || ' MODIFY (' || p_col || ' ' || p_type || ')';
  EXCEPTION
    -- absent table or column: that schema has not run the DDL that creates
    -- it, which is fine — nothing to widen. A shrink means the column is
    -- already wider than asked for, which is also fine.
    WHEN e_no_table  THEN NULL;
    WHEN e_no_column THEN NULL;
    WHEN e_shrink    THEN NULL;
    WHEN e_nochange  THEN NULL;
  END;
BEGIN
  -- the two the load actually rejected
  widen('sei_input_lineage',  'code_set_name',       'VARCHAR2(400)');
  widen('star_uploader_job',  'pre_process',         'VARCHAR2(4000)');

  -- ACCEPTABLE_VALUES gets a column of its own rather than borrowing one
  BEGIN
    EXECUTE IMMEDIATE
      'ALTER TABLE sei_input_lineage ADD (acceptable_values VARCHAR2(4000))';
  EXCEPTION WHEN OTHERS THEN NULL;   -- already there, or table absent
  END;

  -- the rest of STAR_UPLOADER_JOB is the same kind of prose
  widen('star_uploader_job',  'duplicate_check',     'VARCHAR2(4000)');
  widen('star_uploader_job',  'loaded_as_is',        'VARCHAR2(4000)');
  widen('star_uploader_job',  'imds_load_mapping',   'VARCHAR2(4000)');

  -- transformation text: expressions run long, and a truncated expression
  -- is a wrong expression that looks right
  widen('sei_transformation', 'null_handling',       'VARCHAR2(4000)');
  widen('sei_transformation', 'conditional_logic',   'VARCHAR2(4000)');
  widen('sei_transformation', 'input_objects',       'VARCHAR2(4000)');
  widen('sei_transformation', 'input_fields',        'VARCHAR2(4000)');
  widen('sei_transformation', 'remarks',             'VARCHAR2(4000)');
  widen('sei_transformation_compare', 'review_note',        'VARCHAR2(4000)');
  widen('sei_transformation_compare', 'sei_source_objects', 'VARCHAR2(4000)');
  widen('sei_transformation_compare', 'sei_source_fields',  'VARCHAR2(4000)');
  widen('legacy_lineage_xform', 'sei_source_objects', 'VARCHAR2(4000)');
  widen('legacy_lineage_xform', 'sei_source_fields',  'VARCHAR2(4000)');
  widen('lot_level_position_map', 'remarks',          'VARCHAR2(4000)');
  widen('lot_level_position_map', 'sei_source_object', 'VARCHAR2(4000)');
  widen('lot_level_position_map', 'sei_source_field',  'VARCHAR2(4000)');

  -- the summary sheets: _MANIFEST NOTES is a paragraph, and its ITEM can
  -- be a sentence-length control name
  widen('sei_control', 'control_name', 'VARCHAR2(1000)');
  widen('sei_control', 'result',       'VARCHAR2(4000)');
  widen('sei_enum',    'meaning',      'VARCHAR2(4000)');

  -- name-match evidence: a field matching many SEI fields produces a long
  -- pipe-separated list, and the count of matches is the finding
  widen('sei_name_recon', 'matches', 'VARCHAR2(4000)');

  -- published descriptions
  widen('star_layout_field', 'description', 'VARCHAR2(4000)');
END;
/

-- Verify nothing is still short. Run after a reload:
--
--   SELECT table_name, column_name, data_length
--   FROM   user_tab_columns
--   WHERE  table_name IN ('SEI_INPUT_LINEAGE','STAR_UPLOADER_JOB',
--                         'SEI_TRANSFORMATION','SEI_TRANSFORMATION_COMPARE',
--                         'SEI_CONTROL','SEI_NAME_RECON','STAR_LAYOUT_FIELD',
--                         'LOT_LEVEL_POSITION_MAP','LEGACY_LINEAGE_XFORM')
--     AND  data_type = 'VARCHAR2'
--   ORDER  BY table_name, column_name;
