-- ============================================================================
-- 53_sei_catalog.sql
-- The sheets the first reader dropped: SEI's own inbound catalog, the
-- outbound-existence check against it, the SEI feed inventory, and UAF's
-- field-level layouts.
--
-- WHY THESE MATTER
--
-- SEI_TO_STAR proposes an OUTBOUND datapoint. SEI_INPUT_LINEAGE records what
-- is loaded INBOUND into SEI. They are different directions, and the
-- workbook is explicit that a matching field name between them is evidence
-- and not proof: an inbound field existing does not establish that it is
-- exposed through the outbound interface the contract needs.
--
-- So SEI_CATALOG_VERIFY is stored as its own signal, beside the format
-- verdict rather than folded into it. A datapoint absent from SEI's own
-- input catalog is a much earlier and cheaper finding than a type mismatch:
-- it suggests the field may not exist at all.
--
-- ADDITIVE. Idempotent. Nothing PBDW uses is altered.
-- ============================================================================

-- 1) SEI_FEED — the outbound feed inventory. Parsed by the first connector
--    and then thrown away for want of a table; this is that table.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_feed (
      feed_id          VARCHAR2(400) NOT NULL,   -- {ds}:{feed}:{entity}
      data_source      VARCHAR2(40),
      sei_feed         VARCHAR2(200),
      sei_entity       VARCHAR2(200),
      subject_area     VARCHAR2(200),
      delivery_mode    VARCHAR2(20),
      frequency        VARCHAR2(60),
      grain            VARCHAR2(400),
      key_fields       VARCHAR2(2000),
      load_behaviour   VARCHAR2(20),
      types_published  VARCHAR2(10),
      evidence         VARCHAR2(30),
      source_doc       VARCHAR2(400),
      notes            VARCHAR2(2000),
      updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_feed PRIMARY KEY (feed_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 2) SEI_INPUT_LINEAGE — what is loaded INTO SEI. The inbound direction.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_input_lineage (
      input_id           VARCHAR2(700) NOT NULL,
      data_source        VARCHAR2(40),
      direction          VARCHAR2(20)  DEFAULT ''INBOUND'',
      functional_group   VARCHAR2(200),
      sei_target_file    VARCHAR2(200),
      sei_field_ordinal  VARCHAR2(30),
      sei_field          VARCHAR2(200),
      sei_field_norm     VARCHAR2(200),   -- canonical, for the name match
      published_type     VARCHAR2(60),
      published_length   VARCHAR2(30),
      published_scale    VARCHAR2(30),
      record_scope       VARCHAR2(200),
      validation_rule    VARCHAR2(2000),
      field_definition   VARCHAR2(4000),
      code_set_name      VARCHAR2(120),
      mapping_status     VARCHAR2(60),
      source_mapping_rule VARCHAR2(2000),
      upstream_object    VARCHAR2(400),
      upstream_field     VARCHAR2(200),
      origin_workbook    VARCHAR2(400),
      origin_sheet       VARCHAR2(200),
      evidence           VARCHAR2(30),
      source_doc_locator VARCHAR2(400),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_input_lineage PRIMARY KEY (input_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 3) SEI_CATALOG_VERIFY — does the proposed OUTBOUND datapoint appear in
--    SEI's own INBOUND catalog? Evidence, never proof. Kept separate from
--    SEI_VERIFY so a name match can never be mistaken for a format match.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_catalog_verify (
      cat_id             VARCHAR2(700) NOT NULL,
      data_source        VARCHAR2(40),
      lane_id            VARCHAR2(80),
      target_feed        VARCHAR2(200),
      target_field       VARCHAR2(200),
      mapped_sei_datapoint VARCHAR2(200),
      matched_file       VARCHAR2(200),
      matched_row        VARCHAR2(60),
      match_count        NUMBER DEFAULT 0,
      published_type     VARCHAR2(60),
      published_length   VARCHAR2(30),
      published_scale    VARCHAR2(30),
      direction_note     VARCHAR2(2000),
      verify_result      VARCHAR2(40),
      notes              VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_catalog_verify PRIMARY KEY (cat_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 4) UAF_FIELD_SCHEMA — UAF layouts, field level. UAF is a live IMDS lane
--    and needs its own field metadata; it has no AddVantage-style dictionary.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE uaf_field_schema (
      uaf_id           VARCHAR2(700) NOT NULL,
      data_source      VARCHAR2(40),
      uaf_feed         VARCHAR2(200),
      record_type      VARCHAR2(60),
      ordinal          VARCHAR2(30),
      source_field     VARCHAR2(200),
      source_field_norm VARCHAR2(200),
      published_type   VARCHAR2(60),
      published_length VARCHAR2(30),
      repeating_group  VARCHAR2(120),
      uaf_procedure    VARCHAR2(200),
      imds_target      VARCHAR2(400),
      transformation   VARCHAR2(2000),
      evidence         VARCHAR2(30),
      notes            VARCHAR2(2000),
      updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_uaf_field_schema PRIMARY KEY (uaf_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_input_field ON sei_input_lineage (data_source, sei_field_norm)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sei_cat_dp ON sei_catalog_verify (data_source, mapped_sei_datapoint)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
DECLARE e_idx EXCEPTION; PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_uaf_field ON uaf_field_schema (data_source, uaf_feed)';
EXCEPTION WHEN e_idx THEN NULL; END;
/
