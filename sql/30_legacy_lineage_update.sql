-- Legacy lineage schema update:
--  * CP_LEGACY_LINEAGE_SHEET gained Functional_Group + Table_Type
--  * new workbook sheet Table_Dependency_Network -> legacy_table_dependency
-- Idempotent: safe to re-run.

-- 1) new columns on legacy_lineage
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM user_tab_columns
  WHERE table_name = 'LEGACY_LINEAGE' AND column_name = 'FUNCTIONAL_GROUP';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE legacy_lineage ADD (functional_group VARCHAR2(200))';
  END IF;
  SELECT COUNT(*) INTO n FROM user_tab_columns
  WHERE table_name = 'LEGACY_LINEAGE' AND column_name = 'TABLE_TYPE';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE legacy_lineage ADD (table_type VARCHAR2(60))';
  END IF;
END;
/

-- 2) table-level dependency network (one row per Source_Table -> Target_Table
--    column link). Source_Function = 'EXCLUDE' marks Not Applicable sources.
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM user_tables WHERE table_name = 'LEGACY_TABLE_DEPENDENCY';
  IF n = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE legacy_table_dependency (
        dep_id          VARCHAR2(650) NOT NULL,  -- source:target:column
        source_table    VARCHAR2(200),
        target_table    VARCHAR2(200),
        column_link     VARCHAR2(200),
        source_function VARCHAR2(200),           -- 'EXCLUDE' = Not Applicable source
        target_function VARCHAR2(200),
        CONSTRAINT pk_legacy_table_dep PRIMARY KEY (dep_id)
      )]';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_legacy_dep_tgt ON legacy_table_dependency (target_table)';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_legacy_dep_src ON legacy_table_dependency (source_table)';
  END IF;
END;
/
