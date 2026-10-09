-- ============================================================================
-- 79_sei_mapping_docs.sql
-- The seven sheets the SEI mapping documents added to the crosswalk
-- workbook (STAR_IMDS_SEI_Lineage_Catalog_v2_Transformations-Usage-Matrix),
-- and the columns two existing sheets gained.
--
-- WHAT CHANGED IN THE WORKBOOK. Seven mapping documents were read into the
-- catalog. TRANSFORMATION_REGISTER and TRANSFORMATION_COMPARISON simply
-- grew (sql/56 holds them; EVIDENCE_COMPLETENESS gained the value
-- IM_ONLY_DOCUMENTED, stored as given). What needed new tables:
--
--   MAPPING_SOURCE_REGISTER   one row per mapping document / STAR feed
--   SEI_TO_STAR_FIELD_MAP     one STAR file field and its SEI source
--   STAR_TO_IMDS_STAGE_MAP    one IMDS column, its STAR field, the legacy
--                             logic and the SEI equivalent
--   SEI_STAR_IMDS_E2E_XWALK   one SEI -> STAR -> IMDS path, with LINK_STATUS
--   REFERENCE_CODE_XWALK      one code value and what it maps to
--   ENTITY_ID_DERIVATION      one step of the Entity ID logic
--   USAGE_RECON_EXCEPTIONS    one disagreement between the usage matrix
--                             and a mapping document
--
-- STAR_FIELD_USAGE_MATRIX gained four columns (J-M): what the mapping
-- document says the field's usage is, whether a SEI source is mapped, the
-- reconciliation result, and the document. STAR_FIELD_USAGE_SUMMARY was
-- rebuilt: the three layout-match columns are gone (they stay NULL here)
-- and the SEI-mapped share, used-but-unmapped and conflict counts arrived.
-- TRANSFORMATION_SUMMARY is one row per IMDS target table now; it still
-- lands in SEI_CONTROL, and the screen recomputes it from the comparison
-- rows because its cells are formulas.
--
-- EVERYTHING IS DRAFT. None of the documents is an approved SEI-to-STAR
-- crosswalk, so every row carries its status as written
-- (DRAFT_REVIEW_REQUIRED) and nothing here changes a verdict in SEI_VERIFY.
-- ADDITIVE. Idempotent. Scoped by DATA_SOURCE like the rest of sql/51-66.
-- ============================================================================

DECLARE
  PROCEDURE ddl(p_sql VARCHAR2) IS
    e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
    e_col    EXCEPTION; PRAGMA EXCEPTION_INIT(e_col,    -1430);
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION WHEN e_exists THEN NULL; WHEN e_col THEN NULL;
  END;
BEGIN
  ddl('CREATE TABLE sei_mapping_source (
        source_id            VARCHAR2(400) NOT NULL,   -- {ds}:{feed_key}
        data_source          VARCHAR2(40)  NOT NULL,
        feed_family          VARCHAR2(120),
        feed_key             VARCHAR2(200),
        source_document      VARCHAR2(400),
        document_key         VARCHAR2(200),            -- file_key(document): joins SOURCE_DOCUMENT columns
        sei_star_rows        NUMBER,                    -- STAR fields found in the document
        sei_star_mapped      NUMBER,                    -- of which have a SEI source
        open_dependencies    NUMBER,                    -- flagged dependency / confirmation / TBD
        imds_targets         VARCHAR2(2000),            -- IMDS tables loaded, ; separated
        imds_stage_rows      NUMBER,
        new_comparison_rows  NUMBER,
        already_in_catalog   NUMBER,                    -- skipped as duplicates
        notes                VARCHAR2(2000),
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sei_mapping_source PRIMARY KEY (source_id))');

  ddl('CREATE TABLE sei_star_field_map (
        map_row_id           VARCHAR2(600) NOT NULL,   -- the sheet''s MAP_ID, prefixed with the lane
        data_source          VARCHAR2(40)  NOT NULL,
        lane_id              VARCHAR2(80),
        layer                VARCHAR2(40),
        feed_family          VARCHAR2(120),
        feed_key             VARCHAR2(200),
        star_field           VARCHAR2(400),
        star_field_norm      VARCHAR2(400),
        star_in_layout       CHAR(1),                   -- checked against STAR_LAYOUT_DETAIL at load
        business_description VARCHAR2(4000),
        doc_usage_status     VARCHAR2(40),              -- Used | Unused | NOT_STATED
        sei_object           VARCHAR2(200),
        sei_field            VARCHAR2(1000),            -- a field or an expression
        sei_field_norm       VARCHAR2(400),
        sei_type             VARCHAR2(120),
        sei_nullable         VARCHAR2(20),
        join_logic           VARCHAR2(4000),
        map_kind             VARCHAR2(40),              -- DIRECT | LOOKUP | DERIVED | CONSTANT | SYSTEM_DATE | NO_MAPPING
        open_dependency      CHAR(1),
        mapping_status       VARCHAR2(60),              -- CANDIDATE | BUSINESS_DECISION_REQUIRED | NO_SEI_SOURCE
        approval_status      VARCHAR2(80),
        notes                VARCHAR2(4000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sei_star_field_map PRIMARY KEY (map_row_id))');
  ddl('CREATE INDEX ix_ssfm_star ON sei_star_field_map (data_source, feed_key, star_field_norm)');

  ddl('CREATE TABLE star_imds_stage_map (
        map_row_id           VARCHAR2(600) NOT NULL,
        data_source          VARCHAR2(40)  NOT NULL,
        feed_family          VARCHAR2(120),
        feed_key             VARCHAR2(200),
        imds_table           VARCHAR2(200),             -- TARGET_OBJECT
        imds_column          VARCHAR2(200),             -- TARGET_ATTRIBUTE
        target_type          VARCHAR2(120),
        target_nullable      VARCHAR2(20),
        star_field           VARCHAR2(400),
        star_field_norm      VARCHAR2(400),
        uploader_column      VARCHAR2(200),
        im_logic             VARCHAR2(4000),            -- the existing IMDS / PL-SQL transformation
        sei_equiv_logic      VARCHAR2(4000),            -- two versions separated by -- ALT:
        sei_object           VARCHAR2(200),
        sei_field            VARCHAR2(1000),
        sei_join_logic       VARCHAR2(4000),
        comparison_id        VARCHAR2(200),             -- joins SEI_TRANSFORMATION_COMPARE
        evidence_completeness VARCHAR2(80),
        business_decision    CHAR(1),
        approval_status      VARCHAR2(80),
        notes                VARCHAR2(4000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_star_imds_stage_map PRIMARY KEY (map_row_id))');
  ddl('CREATE INDEX ix_sism_imds ON star_imds_stage_map (data_source, imds_table)');
  ddl('CREATE INDEX ix_sism_cmp ON star_imds_stage_map (data_source, comparison_id)');

  ddl('CREATE TABLE sei_e2e_xwalk (
        xwalk_row_id         VARCHAR2(700) NOT NULL,
        data_source          VARCHAR2(40)  NOT NULL,
        feed_family          VARCHAR2(120),
        feed_key             VARCHAR2(200),
        sei_source           VARCHAR2(1000),            -- Object.Field as written
        sei_object           VARCHAR2(200),
        sei_field            VARCHAR2(1000),
        sei_field_norm       VARCHAR2(400),
        map_kind             VARCHAR2(40),              -- SEI_TO_STAR_MAP_KIND
        sei_star_logic       VARCHAR2(4000),
        star_field           VARCHAR2(400),
        star_field_norm      VARCHAR2(400),
        star_in_layout       CHAR(1),
        imds_table           VARCHAR2(200),
        imds_column          VARCHAR2(200),
        star_imds_logic      VARCHAR2(4000),
        sei_imds_logic       VARCHAR2(4000),
        link_status          VARCHAR2(80),              -- as written: E2E_LINKED | DIRECT_SEI_TO_IMDS | STAR_FIELD_NOT_IN_FILE_MAP | NO_SEI_SOURCE
        link_class           VARCHAR2(30),              -- E2E | SEI_DIRECT | STAR_NOT_IN_FILE_MAP | NO_SEI_SOURCE | STAR_ONLY
        crosswalk_status     VARCHAR2(40),              -- CANDIDATE | GAP
        approval_status      VARCHAR2(80),
        notes                VARCHAR2(2000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sei_e2e_xwalk PRIMARY KEY (xwalk_row_id))');
  ddl('CREATE INDEX ix_see_imds ON sei_e2e_xwalk (data_source, imds_table, link_class)');

  ddl('CREATE TABLE sei_reference_code_xwalk (
        code_row_id          VARCHAR2(600) NOT NULL,
        data_source          VARCHAR2(40)  NOT NULL,
        code_set_name        VARCHAR2(200),             -- BBH_TRANSACTION_CODE, ASSET_TYPE, COMPONENT_TYPE, TAX_TYPE, INSTRUMENT_TYPE_GROUP
        side                 VARCHAR2(20),              -- STAR | SEI
        code_value           VARCHAR2(200),
        code_description     VARCHAR2(2000),
        maps_to_side         VARCHAR2(20),
        maps_to_code         VARCHAR2(200),             -- UNKNOWN: the document lists codes, not mappings
        maps_to_description  VARCHAR2(2000),
        is_mapped            CHAR(1),
        mapping_rule         VARCHAR2(60),              -- Direct | LOOKUP | MEMBERS_ONLY
        approval_status      VARCHAR2(80),
        notes                VARCHAR2(2000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sei_reference_code_xwalk PRIMARY KEY (code_row_id))');
  ddl('CREATE INDEX ix_srcx_set ON sei_reference_code_xwalk (data_source, code_set_name)');

  ddl('CREATE TABLE sei_entity_id_derivation (
        step_id              VARCHAR2(200) NOT NULL,
        data_source          VARCHAR2(40)  NOT NULL,
        feed_family          VARCHAR2(120),             -- ODDDIFI1 | ORDDIFI1
        seq                  NUMBER,
        legacy_logic         VARCHAR2(4000),            -- the current PL/SQL
        logic_comment        VARCHAR2(2000),
        sei_rule             VARCHAR2(4000),            -- how the step works under SEI
        approval_status      VARCHAR2(80),
        notes                VARCHAR2(2000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sei_entity_id_derivation PRIMARY KEY (step_id))');

  ddl('CREATE TABLE star_usage_mapping_exception (
        exc_row_id           VARCHAR2(600) NOT NULL,
        data_source          VARCHAR2(40)  NOT NULL,
        result               VARCHAR2(60),              -- USED_BUT_UNMAPPED | UNUSED_BUT_MAPPED | CONFLICT
        feed_family          VARCHAR2(120),
        feed_key             VARCHAR2(200),
        field_name           VARCHAR2(400),
        field_norm           VARCHAR2(400),
        matrix_usage         VARCHAR2(40),
        doc_usage            VARCHAR2(40),
        sei_source_mapped    CHAR(1),
        detail               VARCHAR2(2000),
        source_document      VARCHAR2(400),
        source_sheet         VARCHAR2(200),
        source_row           NUMBER,
        loaded_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_star_usage_mapping_exc PRIMARY KEY (exc_row_id))');
  ddl('CREATE INDEX ix_sume_result ON star_usage_mapping_exception (data_source, result)');

  -- STAR_FIELD_USAGE_MATRIX, columns J-M
  ddl('ALTER TABLE star_field_usage ADD (doc_usage_status VARCHAR2(40))');
  ddl('ALTER TABLE star_field_usage ADD (sei_mapped CHAR(1))');
  ddl('ALTER TABLE star_field_usage ADD (usage_check VARCHAR2(200))');     -- USAGE_RECON_RESULT
  ddl('ALTER TABLE star_field_usage ADD (mapping_document VARCHAR2(400))');
  -- STAR_FIELD_USAGE_SUMMARY, rebuilt
  ddl('ALTER TABLE star_field_usage_summary ADD (sei_mapped_fields NUMBER)');
  ddl('ALTER TABLE star_field_usage_summary ADD (sei_mapped_percent NUMBER)');
  ddl('ALTER TABLE star_field_usage_summary ADD (used_no_sei_source NUMBER)');   -- USED_BUT_UNMAPPED
  ddl('ALTER TABLE star_field_usage_summary ADD (usage_conflicts NUMBER)');
  ddl('ALTER TABLE star_field_usage_summary ADD (added_from_mapping_doc NUMBER)');
  ddl('ALTER TABLE star_field_usage_summary ADD (mapping_document VARCHAR2(400))');
END;
/
COMMIT;
