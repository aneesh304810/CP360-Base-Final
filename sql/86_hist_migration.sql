-- ============================================================================
-- 86_hist_migration.sql
-- Data Analysis: the historical data migration sheets of the SEI workbook.
-- Four sheets, four tables, one batch record per load.
--
--   cp_hist_migration_lane     HIST_MIGRATION_LANES   one row per historical
--                              migration lane into SEI (AddVantage/PB, STAR/IM, UAF)
--   cp_hist_source_artifact    HIST_SOURCE_REGISTER   one row per mapping workbook,
--                              dictionary or specification the evidence rests on
--   cp_hist_mapping_evidence   HIST_MAPPING_EVIDENCE  one row per populated cell of
--                              the consolidated mapping workbook: the analyst's
--                              source-to-target logic, kept exactly as written
--   cp_hist_header_dictionary  HIST_HEADER_DICTIONARY the CP 360 column names the
--                              evidence table uses, with their definitions
--   cp_hist_ingest_batch       one row per load: batch id, source file, hash,
--                              counts and the rule checks (CP360-HM-011)
--
-- Loaded by ingestion/hist_migration_conn.py as a snapshot: every load replaces
-- the four tables and writes a batch row; a workbook whose hash matches the
-- last batch is skipped. Evidence values are the analysts' mapping logic and
-- table names, never data values. Idempotent (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_migration_lane (
      historical_lane_id                   VARCHAR2(100 CHAR) NOT NULL,
      historical_source_system             VARCHAR2(200 CHAR),
      target_system                        VARCHAR2(100 CHAR),
      migration_purpose                    VARCHAR2(400 CHAR),
      primary_mapping_evidence             VARCHAR2(400 CHAR),
      reference_artifacts                  VARCHAR2(1000 CHAR),
      data_domain                          VARCHAR2(200 CHAR),
      relationship_to_operational_lineage  VARCHAR2(1000 CHAR),
      status                               VARCHAR2(100 CHAR),
      batch_id                             VARCHAR2(40),
      source_file                          VARCHAR2(260),
      source_hash                          VARCHAR2(64),
      loaded_at                            TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind                           CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_lane PRIMARY KEY (historical_lane_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_source_artifact (
      source_artifact            VARCHAR2(400 CHAR) NOT NULL,
      artifact_type              VARCHAR2(200 CHAR),
      historical_migration_role  VARCHAR2(1000 CHAR),
      supported_lanes            VARCHAR2(400 CHAR),
      cp_360_treatment           VARCHAR2(200 CHAR),
      notes                      VARCHAR2(1000 CHAR),
      artifact_class             VARCHAR2(20),          -- REFERENCE | MAPPING | OTHER (CP360-HM-008)
      batch_id                   VARCHAR2(40),
      source_file                VARCHAR2(260),
      source_hash                VARCHAR2(64),
      loaded_at                  TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind                 CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_artifact PRIMARY KEY (source_artifact)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_mapping_evidence (
      source_mapping_workbook        VARCHAR2(200 CHAR) NOT NULL,
      source_mapping_sheet           VARCHAR2(200 CHAR) NOT NULL,
      source_mapping_row             NUMBER(19)         NOT NULL,
      original_source_column_number  NUMBER(19)         NOT NULL,
      historical_migration_domain    VARCHAR2(200 CHAR),
      historical_source_system       VARCHAR2(200 CHAR),
      historical_migration_lane      VARCHAR2(200 CHAR),
      mapping_evidence_type          VARCHAR2(200 CHAR),
      migration_group                VARCHAR2(200 CHAR),
      evidence_category              VARCHAR2(200 CHAR),
      evidence_attribute             VARCHAR2(400 CHAR),
      evidence_value                 CLOB,               -- the cell, exactly as written (CP360-HM-005, HM-010)
      evidence_length                NUMBER(10),
      original_source_column         VARCHAR2(400 CHAR),
      reference_artifacts            VARCHAR2(1000 CHAR),
      lane_resolved                  CHAR(1),            -- Y when the lane matches a registered lane (CP360-HM-007)
      batch_id                       VARCHAR2(40),
      source_file                    VARCHAR2(260),
      source_hash                    VARCHAR2(64),
      loaded_at                      TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind                     CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_evidence PRIMARY KEY (source_mapping_workbook, source_mapping_sheet, source_mapping_row, original_source_column_number)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_hist_ev_lane ON cp_hist_mapping_evidence (historical_migration_lane, historical_migration_domain)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cp_hist_ev_attr ON cp_hist_mapping_evidence (evidence_category, evidence_attribute)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_header_dictionary (
      meaningful_column_name  VARCHAR2(200 CHAR) NOT NULL,
      definition              VARCHAR2(1000 CHAR),
      source_or_derivation    VARCHAR2(1000 CHAR),
      batch_id                VARCHAR2(40),
      source_file             VARCHAR2(260),
      source_hash             VARCHAR2(64),
      loaded_at               TIMESTAMP DEFAULT SYSTIMESTAMP,
      active_ind              CHAR(1) DEFAULT ''Y'',
      CONSTRAINT pk_cp_hist_dictionary PRIMARY KEY (meaningful_column_name)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cp_hist_ingest_batch (
      batch_id       VARCHAR2(40)  NOT NULL,
      source_file    VARCHAR2(260),
      source_hash    VARCHAR2(64),
      lanes_n        NUMBER(10),
      artifacts_n    NUMBER(10),
      evidence_n     NUMBER(10),
      dictionary_n   NUMBER(10),
      skipped_n      NUMBER(10),
      checks         CLOB,                               -- the CP360-HM rule results, as JSON
      loaded_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_cp_hist_batch PRIMARY KEY (batch_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
