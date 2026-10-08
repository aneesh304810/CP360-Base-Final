-- ============================================================================
-- 78_sei_migration.sql
-- Data Analysis: SEI's merged source-file catalog, read as a migration.
--
-- WHAT THIS IS. SEI's conversion load files (account-basic.dat, party-basic
-- .dat, ...) come with one catalog row per field: SEI's type, length and
-- "which account types require it", SEI's own processing logic and where
-- the field surfaces afterwards (BOXI reports, standard outbound files,
-- ADE-CAS); and BBH's answer beside it: which BBH table feeds the field,
-- the rule that maps it, the DSR tagging logic and a status.
--
-- sei_input_lineage (sql/53) already holds a slimmer reading of the same
-- files for the crosswalk's existence check. This is a different question,
-- so it is a different table: not "does this datapoint exist in SEI's
-- catalog" but "how is every SEI field going to be filled, from what, by
-- what rule, and what is still open". Nothing the crosswalk reads changes.
--
-- Three tables: the field with its readings, the BBH sources that feed it
-- (the left side of the lineage), and the places it goes next (the right).
-- ADDITIVE. Idempotent.
-- ============================================================================

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_sei_migration_field (
      catalog_id          VARCHAR2(120) NOT NULL,
      functional_group    VARCHAR2(200),
      source_system       VARCHAR2(60),       -- SEI: the catalog calls the load file the source
      source_object       VARCHAR2(200),      -- the load file: account-basic.dat
      seq                 NUMBER,
      source_attribute    VARCHAR2(200),      -- the field in that file
      data_type           VARCHAR2(60),
      max_length          VARCHAR2(30),
      max_decimal         VARCHAR2(30),
      domicile            VARCHAR2(60),
      mandatory_text      VARCHAR2(4000),     -- the per-account-type matrix, as written
      mandatory_class     VARCHAR2(20),       -- ALWAYS | OPTIONAL | CONDITIONAL | NOT_APPLICABLE | UNKNOWN
      mand_yes            NUMBER,
      mand_no             NUMBER,
      mand_na             NUMBER,
      validations         VARCHAR2(4000),
      remarks             VARCHAR2(4000),
      acceptable_values   VARCHAR2(400),
      desktop             VARCHAR2(400),
      boxi_text           VARCHAR2(2000),
      processing_logic    VARCHAR2(4000),     -- SEI''s logic
      outbound_field      VARCHAR2(400),
      outbound_file       VARCHAR2(400),
      outbound_transform  VARCHAR2(2000),
      ade_cas             VARCHAR2(400),
      function_category   VARCHAR2(200),
      emp_dsr_logic       VARCHAR2(4000),
      emp_dsr_status      VARCHAR2(200),
      team_dsr_logic      VARCHAR2(4000),
      team_dsr_status     VARCHAR2(200),
      other_mapping_logic VARCHAR2(4000),     -- BBH''s mapping, as written
      other_status        VARCHAR2(200),
      status_class        VARCHAR2(30),       -- COMPLETE | OPEN | BLOCKED | NA | UNSPECIFIED
      status_detail       VARCHAR2(200),
      source_tables_text  VARCHAR2(2000),     -- Tables/Fields/Off-System, as written
      note                VARCHAR2(4000),
      source_workbook     VARCHAR2(400),
      source_sheet        VARCHAR2(200),
      rule_text           VARCHAR2(4000),     -- the effective BBH-side rule
      rule_side           VARCHAR2(10),       -- BBH | SEI | NONE
      rule_class          VARCHAR2(30),       -- DIRECT | CONSTANT | SET_NULL | LOOKUP | CONDITIONAL | CONCATENATE | TRANSFORM | DERIVED | NOT_APPLICABLE | NOT_MAPPED
      lookup_name         VARCHAR2(400),
      truncation_risk     CHAR(1) DEFAULT ''N'',
      report_out          CHAR(1) DEFAULT ''N'',
      null_mitigation     CHAR(1) DEFAULT ''N'',
      country_specific    CHAR(1) DEFAULT ''N'',
      has_validation      CHAR(1) DEFAULT ''N'',
      upstream_n          NUMBER DEFAULT 0,
      crosswalk_n         NUMBER DEFAULT 0,
      systems             VARCHAR2(400),      -- the BBH systems feeding it, comma-joined
      updated_at          TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_cp_sei_mig_field PRIMARY KEY (catalog_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_sei_migration_source (
      catalog_id     VARCHAR2(120) NOT NULL,
      source_table   VARCHAR2(200) NOT NULL,
      source_field   VARCHAR2(200) NOT NULL,   -- ''-'' when only the table is known
      system_class   VARCHAR2(30),             -- UAF | IM | STAR | PB | ADDVANTAGE | CONVERSION | SEI_CONFIG | CRM | OTHER
      role           VARCHAR2(20),             -- SOURCE | CROSSWALK | CONFIG
      how            VARCHAR2(20),             -- TABLES | RULE | INFERRED | CONFIG
      updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_cp_sei_mig_source PRIMARY KEY (catalog_id, source_table, source_field)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_sei_migration_target (
      catalog_id     VARCHAR2(120) NOT NULL,
      target_kind    VARCHAR2(20)  NOT NULL,   -- OUTBOUND | BOXI | ADE_CAS | DESKTOP
      target_object  VARCHAR2(400) NOT NULL,
      target_field   VARCHAR2(400) NOT NULL,
      transformation VARCHAR2(2000),
      updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_cp_sei_mig_target PRIMARY KEY (catalog_id, target_kind, target_object, target_field)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_sei_mig_obj ON cp_sei_migration_field (source_object, seq)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_sei_mig_src_tbl ON cp_sei_migration_source (system_class, source_table)';
EXCEPTION WHEN e_idx THEN NULL; END;
/

-- The sidebar entry, grantable like every other module (sql/64). Guarded:
-- a warehouse without the security tables skips it.
DECLARE e_no_table EXCEPTION; PRAGMA EXCEPTION_INIT(e_no_table, -942);
BEGIN
  EXECUTE IMMEDIATE q'[
    MERGE INTO sec_module t USING (SELECT 'dataanalysis' k, 'Data Analysis' n, 'Utilities' g,
      'SEI data migration: how every SEI load-file field is filled, from what, by what rule' d, 'N' o, 42 s FROM dual) s
    ON (t.module_key = s.k)
    WHEN MATCHED THEN UPDATE SET t.module_name = s.n, t.nav_group = s.g, t.description = s.d, t.sort_order = s.s
    WHEN NOT MATCHED THEN INSERT (module_key, module_name, nav_group, description, open_to_all, sort_order)
      VALUES (s.k, s.n, s.g, s.d, s.o, s.s)]';
EXCEPTION WHEN e_no_table THEN NULL;
         WHEN OTHERS THEN NULL;   -- a column named differently in an older sql/64: the grant can be added by hand
END;
/
COMMIT;
