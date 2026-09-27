-- ============================================================================
-- 51_sei_crosswalk.sql
-- The SEI crosswalk: lanes, the SEI -> contract mapping, and the verdicts.
--
-- ADDITIVE. Nothing here alters a table PBDW already uses. LEGACY_LINEAGE is
-- not widened: the contract field's own type lives in LEGACY_SRC_COLUMN, a
-- side table keyed the same way LEGACY_SOURCE_FILE is, so a PBDW screen sees
-- the same table it saw yesterday.
--
-- THE MODEL
--
-- A lane is one incumbent source system -> target warehouse pairing. Legacy is
-- a GROUP of lanes, not a system:
--
--     ADDVANTAGE -> PBDW      REPLACED by SEI    AddVantage-compatible
--     ADDVANTAGE -> IMDS      unconfirmed
--     STAR       -> IMDS      REPLACED by SEI    STAR-compatible
--     UAF        -> IMDS      NOT_REPLACED       (no contract)
--
-- SEI never gets a lineage chain of its own. It lands in the shape the
-- incumbent already delivers, and the existing pipeline carries it from there.
-- So the join is:
--
--     LEGACY_LINEAGE.src_source_table / src_source_column   the contract
--         <- SEI_SOURCE_MAP.src_file_key / src_source_column
--
-- One contract field can feed several warehouse columns. Map it ONCE; the
-- fan-out happens in the join. That is why SEI_SOURCE_MAP is keyed on the
-- contract field and not on the target column.
--
-- THE LANE NEEDS NO NEW COLUMN ON LEGACY_LINEAGE. LEGACY_SOURCE_FILE already
-- carries SOURCE_SYSTEM, and joins to LEGACY_LINEAGE.SRC_SOURCE_TABLE through
-- SRC_FILE_KEY. lane = (legacy_source_file.source_system, data_source).
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------- helper ---
-- Every CREATE below is wrapped the way sql/50 wraps its own: ORA-955 (name
-- already used) is swallowed so a re-run is a no-op rather than a failure.

-- 1) LEGACY_LANE — the register. Which pairings exist, and which are replaced.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE legacy_lane (
      lane_id            VARCHAR2(80)  NOT NULL,
      source_system      VARCHAR2(40)  NOT NULL,
      data_source        VARCHAR2(40)  NOT NULL,
      replacement_state  VARCHAR2(20)  DEFAULT ''REPLACED'',
      successor_system   VARCHAR2(40),
      contract_name      VARCHAR2(120),
      notes              VARCHAR2(1000),
      updated_at         TIMESTAMP     DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_legacy_lane PRIMARY KEY (lane_id),
      CONSTRAINT ck_legacy_lane_state CHECK
        (replacement_state IN (''REPLACED'',''NOT_REPLACED'',''SEI_NATIVE''))
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 2) LEGACY_SRC_COLUMN — the contract field's own metadata.
--    LEGACY_LINEAGE records src_source_table and src_source_column but not
--    their type, and the format check needs it. A side table rather than an
--    ALTER, so PBDW's table is untouched.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE legacy_src_column (
      src_col_id         VARCHAR2(600) NOT NULL,  -- {ds}:{file_key}:{column}
      data_source        VARCHAR2(40),
      src_file_key       VARCHAR2(400),
      src_source_column  VARCHAR2(200),
      src_type           VARCHAR2(60),
      src_length         VARCHAR2(30),
      src_precision      VARCHAR2(30),
      src_nullable       VARCHAR2(10),
      src_description    VARCHAR2(4000),
      unit_of_measure    VARCHAR2(60),
      currency_basis     VARCHAR2(20),
      sign_convention    VARCHAR2(200),
      code_set_name      VARCHAR2(120),
      evidence           VARCHAR2(30),
      source_doc         VARCHAR2(400),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_legacy_src_column PRIMARY KEY (src_col_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 3) SEI_SOURCE_MAP — one row per (lane, contract field, SEI datapoint).
--    N rows sharing COMPOSITE_GROUP when several datapoints combine.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_source_map (
      map_id             VARCHAR2(700) NOT NULL,
      lane_id            VARCHAR2(80),
      data_source        VARCHAR2(40),
      src_file_key       VARCHAR2(400),      -- joins legacy_lineage via feed key
      src_source_column  VARCHAR2(200),
      sei_feed           VARCHAR2(200),
      sei_entity         VARCHAR2(200),
      sei_datapoint      VARCHAR2(200),
      sei_type           VARCHAR2(60),
      sei_length         VARCHAR2(30),
      sei_scale          VARCHAR2(30),
      sei_nullable       VARCHAR2(10),
      sei_unit           VARCHAR2(60),
      sei_currency_basis VARCHAR2(20),
      sei_sign           VARCHAR2(200),
      sei_code_set_name  VARCHAR2(120),
      map_kind           VARCHAR2(20),
      composite_group    VARCHAR2(80),
      composite_role     VARCHAR2(200),
      map_rule           CLOB,
      join_key           VARCHAR2(400),
      depends_on_feed    VARCHAR2(400),
      evidence           VARCHAR2(30),
      source_doc         VARCHAR2(400),
      source_doc_locator VARCHAR2(400),
      open_question      VARCHAR2(2000),
      notes              VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_source_map PRIMARY KEY (map_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 4) SEI_VERIFY — one row per final column. The verdict and why.
--    Stored rather than computed: VERDICT_REASON and WHAT_WOULD_CLEAR_IT are
--    judgements the workbook carries, not products of a join.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_verify (
      verify_id          VARCHAR2(700) NOT NULL,  -- {lane}:{tbl}:{col}
      lane_id            VARCHAR2(80),
      data_source        VARCHAR2(40),
      dwh_target_table   VARCHAR2(200),
      dwh_target_column  VARCHAR2(200),
      functional_group   VARCHAR2(200),
      contract_feed      VARCHAR2(400),
      contract_field     VARCHAR2(200),
      sei_datapoint_count NUMBER DEFAULT 0,
      sei_datapoints     VARCHAR2(2000),
      map_kind           VARCHAR2(20),
      match_verdict      VARCHAR2(30),
      verdict_reason     VARCHAR2(2000),
      failed_checks      VARCHAR2(400),
      evidence_left      VARCHAR2(30),
      evidence_right     VARCHAR2(30),
      blocks_cutover     CHAR(1) DEFAULT ''N'',
      what_would_clear_it VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_verify PRIMARY KEY (verify_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 5) SEI_CODE_SET — one row per code value, inside a named domain.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_code_set (
      code_id            VARCHAR2(700) NOT NULL,
      code_set_name      VARCHAR2(120),
      side               VARCHAR2(20),          -- SEI | STAR | UAF | IMDS
      code_value         VARCHAR2(200),
      code_description   VARCHAR2(2000),
      maps_to_side       VARCHAR2(20),
      maps_to_code       VARCHAR2(200),
      maps_to_description VARCHAR2(2000),
      evidence           VARCHAR2(30),
      source_doc         VARCHAR2(400),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_code_set PRIMARY KEY (code_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 6) SEI_IDENTIFIER_XWALK
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_identifier_xwalk (
      xwalk_id           VARCHAR2(400) NOT NULL,
      entity             VARCHAR2(120),
      sei_identifier     VARCHAR2(200),
      star_identifier    VARCHAR2(200),
      uaf_identifier     VARCHAR2(200),
      imds_identifier    VARCHAR2(400),
      cardinality        VARCHAR2(20),
      resolution_rule    VARCHAR2(2000),
      authoritative_side VARCHAR2(20),
      evidence           VARCHAR2(30),
      notes              VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_identifier_xwalk PRIMARY KEY (xwalk_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 7) SEI_DISPOSITION — what happens to a column with no SEI source.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_disposition (
      disp_id            VARCHAR2(700) NOT NULL,
      lane_id            VARCHAR2(80),
      dwh_target_table   VARCHAR2(200),
      dwh_target_column  VARCHAR2(200),
      disposition        VARCHAR2(20) DEFAULT ''UNDECIDED'',
      disposition_detail VARCHAR2(2000),
      proposed_by        VARCHAR2(120),
      owner              VARCHAR2(120),
      approved_on        DATE,
      notes              VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_disposition PRIMARY KEY (disp_id),
      CONSTRAINT ck_sei_disp CHECK
        (disposition IN (''DEFAULT'',''DERIVE'',''DROP'',''BLOCK'',''UNDECIDED''))
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 8) SEI_DUAL_SOURCE — columns written by more than one lane.
--    Two lanes writing one column is a finding needing a precedence rule, not
--    a duplicate to clean up. It gets a register of its own, like disposition.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_dual_source (
      dual_id            VARCHAR2(700) NOT NULL,
      data_source        VARCHAR2(40),
      dwh_target_table   VARCHAR2(200),
      dwh_target_column  VARCHAR2(200),
      lanes              VARCHAR2(400),
      precedence_rule    VARCHAR2(2000),
      proposed_by        VARCHAR2(120),
      owner              VARCHAR2(120),
      approved_on        DATE,
      evidence           VARCHAR2(30),
      notes              VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_dual_source PRIMARY KEY (dual_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 9) SEI_EXCEPTION — every unresolved cell, with who can answer it.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_exception (
      exc_id             VARCHAR2(700) NOT NULL,
      data_source        VARCHAR2(40),
      sheet_name         VARCHAR2(60),
      row_key            VARCHAR2(600),
      column_name        VARCHAR2(120),
      issue              VARCHAR2(2000),
      why_unresolved     VARCHAR2(2000),
      who_can_answer     VARCHAR2(120),
      suggested_question VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_exception PRIMARY KEY (exc_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- ---------------------------------------------------------------- indexes ---
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_map_join ON sei_source_map (data_source, src_file_key, src_source_column)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_map_dp ON sei_source_map (sei_feed, sei_datapoint)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_verify_tbl ON sei_verify (data_source, dwh_target_table, dwh_target_column)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_verify_verdict ON sei_verify (data_source, match_verdict)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_legacy_src_col ON legacy_src_column (data_source, src_file_key, src_source_column)';
EXCEPTION WHEN e_idx THEN NULL; END;
/

-- ------------------------------------------------------------ lane seed ----
-- The four known lanes. REPLACEMENT_STATE is what the screens read to decide
-- whether a lane belongs in the SEI denominator; UAF must be NOT_REPLACED or
-- it scores 100% NO_SOURCE on a lane nobody is touching.
-- The loader overwrites these from the workbook's LANE_REGISTER sheet.
MERGE INTO legacy_lane t USING (
  SELECT 'ADDVANTAGE_PBDW' lane_id, 'ADDVANTAGE' ss, 'PBDW' ds, 'REPLACED' st,
         'SEI' su, 'AddVantage-compatible' cn FROM dual UNION ALL
  SELECT 'STAR_IMDS','STAR','IMDS','REPLACED','SEI','STAR-compatible' FROM dual UNION ALL
  SELECT 'UAF_IMDS','UAF','IMDS','NOT_REPLACED',NULL,NULL FROM dual
) s ON (t.lane_id = s.lane_id)
WHEN NOT MATCHED THEN INSERT
  (lane_id, source_system, data_source, replacement_state, successor_system, contract_name)
  VALUES (s.lane_id, s.ss, s.ds, s.st, s.su, s.cn);
COMMIT;
