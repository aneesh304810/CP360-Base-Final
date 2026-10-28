-- ============================================================================
-- 87_hist_lineage.sql
-- Data Analysis: the historical migration lineage, end to end. The v12
-- workbook (STAR_IMDS_SEI_Lineage_Catalog ... DECON_DICTIONARY) adds five
-- sheets to the four of sql/86; this file holds their tables.
--
--   cp_hist_lineage           FINAL_HIST_MIGRATION_LINEAGE  the fact: one
--                             historical mapping -> one SEI target field, with
--                             the governed statuses kept apart (rule, approval,
--                             dictionary, lineage match) and the stable target
--                             key SEI::<dat file>::<field>
--   cp_hist_decon_dictionary  DECON_SOURCE_DICTIONARY       one technical
--                             source object (SGA_DCON_*, IM_*, AV_*, XOS_* ...)
--                             with its meaning and whether that meaning is
--                             curated or derived from the name
--   cp_hist_rule              HIST_MIGRATION_RULE           one extracted
--                             transformation rule, the analyst text whole
--   cp_hist_target_qc         TARGET_FIELD_QC               one control on the
--                             SEI target fields
--   cp_hist_manifest          _MANIFEST                     the workbook's
--                             version and configuration entries
--
-- The graph the page draws:
--   lane -> source object (decon dictionary) -> rule -> SEI dat file -> SEI
--   target field -> sei_input_lineage (exact normalised field match) ->
--   sei_source_map (STAR contract field) -> legacy_lineage (IMDS column).
-- A common SEI field reached from PB and from IM/UAF stays two lineage
-- rows; the target key is what they share, never the source.
-- Loaded by ingestion/hist_migration_conn.py in the same batch as sql/86.
-- Idempotent (ORA-955). No data values: names, rules, statuses, counts.
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_lineage (
      lineage_id                   VARCHAR2(200 CHAR) NOT NULL,
      catalog_id                   VARCHAR2(200 CHAR),
      functional_group             VARCHAR2(200 CHAR),
      source_path                  VARCHAR2(400 CHAR),
      source_system                VARCHAR2(200 CHAR),
      lane_id                      VARCHAR2(100 CHAR),     -- derived: ADDVANTAGE_SEI_HIST | STAR_SEI_HIST | UAF_SEI_HIST | COMMON | UNCLASSIFIED
      source_object_field          VARCHAR2(2000 CHAR),
      decon_dictionary_meaning     VARCHAR2(4000 CHAR),
      decon_business_domain        VARCHAR2(2000 CHAR),
      decon_dictionary_status      VARCHAR2(40),            -- governed: CURATED | REVIEW_REQUIRED | PARTIAL_REVIEW_REQUIRED | NO_TECHNICAL_OBJECT
      decon_status_text            VARCHAR2(400 CHAR),      -- as written
      source_dependencies          VARCHAR2(4000 CHAR),
      transformation_rule_source   VARCHAR2(400 CHAR),
      transformation_rule          CLOB,
      rule_status                  VARCHAR2(100 CHAR),
      target_system                VARCHAR2(100 CHAR),
      target_dat_file              VARCHAR2(200 CHAR),
      target_field                 VARCHAR2(200 CHAR),
      target_field_norm            VARCHAR2(200),
      target_key                   VARCHAR2(500 CHAR),      -- SEI::<dat file>::<field>
      target_field_source_column   VARCHAR2(400 CHAR),
      target_data_type             VARCHAR2(60 CHAR),
      target_max_length            VARCHAR2(30),
      target_decimal_pos           VARCHAR2(30),
      mandatory                    VARCHAR2(4000 CHAR),
      validation_rule              CLOB,
      source_workbook              VARCHAR2(400 CHAR),
      source_sheet                 VARCHAR2(200 CHAR),
      source_row                   NUMBER(19),
      common_target_key            VARCHAR2(500 CHAR),
      common_target_indicator      VARCHAR2(40),
      recon_key                    VARCHAR2(1500 CHAR),     -- path | workbook | sheet | row | dat file | field
      match_method                 VARCHAR2(60),            -- EXACT_NORMALIZED_FIELD_MATCH
      match_status                 VARCHAR2(30),            -- MATCHED | UNMATCHED | NOT_CHECKED, against sei_input_lineage
      approval_status              VARCHAR2(400 CHAR),      -- independent of rule_status; the manifest default is a sentence
      batch_id                     VARCHAR2(40),
      source_file                  VARCHAR2(260),
      source_hash                  VARCHAR2(64),
      loaded_at                    TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind                   CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_lineage PRIMARY KEY (lineage_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_hist_lineage_tgt ON cp_hist_lineage (target_key, lane_id)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_hist_lineage_file ON cp_hist_lineage (target_dat_file, target_field_norm)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_decon_dictionary (
      technical_object       VARCHAR2(400 CHAR) NOT NULL,
      source_prefix          VARCHAR2(100 CHAR),
      business_meaning       VARCHAR2(4000 CHAR),
      source_type            VARCHAR2(200 CHAR),
      business_domain        VARCHAR2(2000 CHAR),
      migration_function     VARCHAR2(1000 CHAR),
      definition_basis       VARCHAR2(100 CHAR),         -- curated | name-derived, as written
      basis_class            VARCHAR2(20),               -- CURATED | NAME_DERIVED | UNKNOWN
      dictionary_status      VARCHAR2(40),               -- governed, as cp_hist_lineage.decon_dictionary_status
      lineage_usage_count    NUMBER(10),
      example_target_fields  VARCHAR2(2000 CHAR),
      batch_id               VARCHAR2(40),
      source_file            VARCHAR2(260),
      source_hash            VARCHAR2(64),
      loaded_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind             CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_decon PRIMARY KEY (technical_object)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_rule (
      rule_id                VARCHAR2(200 CHAR) NOT NULL,
      catalog_id             VARCHAR2(200 CHAR),
      functional_group       VARCHAR2(200 CHAR),
      sei_target_file        VARCHAR2(200 CHAR),
      sei_target_field       VARCHAR2(200 CHAR),
      target_key             VARCHAR2(500 CHAR),
      rule_source_column     VARCHAR2(400 CHAR),
      rule_type              VARCHAR2(100 CHAR),
      transformation_rule    CLOB,
      validation_rule        CLOB,
      mapping_status         VARCHAR2(100 CHAR),
      source_objects_fields  VARCHAR2(4000 CHAR),
      source_workbook        VARCHAR2(400 CHAR),
      source_sheet           VARCHAR2(200 CHAR),
      evidence_locator       VARCHAR2(1000 CHAR),
      approval_status        VARCHAR2(400 CHAR),
      batch_id               VARCHAR2(40),
      source_file            VARCHAR2(260),
      source_hash            VARCHAR2(64),
      loaded_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind             CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_rule PRIMARY KEY (rule_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_target_qc (
      qc_id          VARCHAR2(200 CHAR) NOT NULL,
      control_name   VARCHAR2(400 CHAR),
      applies_to     VARCHAR2(400 CHAR),
      expected       VARCHAR2(1000 CHAR),
      actual         VARCHAR2(1000 CHAR),
      result         VARCHAR2(60 CHAR),
      detail         VARCHAR2(4000 CHAR),
      row_json       CLOB,                              -- every cell of the row, as the sheet has it
      batch_id       VARCHAR2(40),
      source_file    VARCHAR2(260),
      source_hash    VARCHAR2(64),
      loaded_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind     CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_target_qc PRIMARY KEY (qc_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_manifest (
      manifest_key    VARCHAR2(200 CHAR) NOT NULL,
      manifest_value  VARCHAR2(4000 CHAR),
      batch_id        VARCHAR2(40),
      source_file     VARCHAR2(260),
      source_hash     VARCHAR2(64),
      loaded_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind      CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_manifest PRIMARY KEY (manifest_key)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
-- The batch row counts the new sheets too (ORA-01430: column already exists).
DECLARE e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -1430);
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE cp_hist_ingest_batch ADD (lineage_n NUMBER(10), decon_n NUMBER(10), rules_n NUMBER(10), qc_n NUMBER(10))';
EXCEPTION WHEN e_dup THEN NULL; END;
/
-- The decon business domain is a list on some rows; wider than first cut.
-- Widening a VARCHAR2 never fails on existing data; a narrower target does,
-- so the guard only swallows "already at least this wide".
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE cp_hist_lineage MODIFY (decon_business_domain VARCHAR2(2000 CHAR))';
  EXECUTE IMMEDIATE 'ALTER TABLE cp_hist_decon_dictionary MODIFY (business_domain VARCHAR2(2000 CHAR), migration_function VARCHAR2(1000 CHAR))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-1441, -1440) THEN RAISE; END IF; END;
/
-- The approval status is a sentence when it comes from the manifest default
-- ("Draft - review required ..."), not a code; 60 bytes cut it (ORA-12899).
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE cp_hist_lineage MODIFY (approval_status VARCHAR2(400 CHAR))';
  EXECUTE IMMEDIATE 'ALTER TABLE cp_hist_rule MODIFY (approval_status VARCHAR2(400 CHAR))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-1441, -1440) THEN RAISE; END IF; END;
/
