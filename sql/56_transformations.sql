-- 56_transformations.sql -------------------------------------------------
--
-- The "With-Transformations" workbook went from 16 sheets to 24, and the
-- eight new ones are not decoration. Until now the crosswalk could say a
-- SEI datapoint exists and that its TYPE matches; it could not say whether
-- the LOGIC matches. A field whose type, length and scale agree perfectly
-- and whose derivation differs is a wrong number, not a missing one, and
-- nothing in the schema could hold that finding.
--
-- Eight tables, all additive, nothing existing altered except two columns
-- added to SEI_DISPOSITION (see the note there).
--
-- THE EVIDENCE LADDER THE WORKBOOK INSISTS ON, and which these tables keep
-- apart rather than collapsing:
--
--     published source layout
--       != exact field-name candidate
--       != documented source-to-target rule
--       != functionally equivalent transformation
--       != approved production transformation
--
-- Each of those is a different table or a different column here. Merging
-- any two of them would turn a candidate into an approval by storage
-- design, which is the failure the whole workbook is built to avoid.

SET DEFINE OFF

-- 1) LEGACY_LINEAGE_XFORM — the eight transformation columns LANE_LINEAGE
--    gained. Side table for the same reason LEGACY_LINEAGE_LANE is one:
--    LEGACY_LINEAGE is shared with whatever loaded the baseline and must
--    not be altered.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE legacy_lineage_xform (
      lineage_id                   VARCHAR2(400) NOT NULL,
      data_source                  VARCHAR2(40),
      dwh_target_table             VARCHAR2(200),
      dwh_target_column            VARCHAR2(200),
      legacy_transformation_id     VARCHAR2(120),
      sei_transformation_id        VARCHAR2(120),
      sei_equivalent_transformation CLOB,
      sei_source_objects           VARCHAR2(2000),
      sei_source_fields            VARCHAR2(2000),
      transformation_equivalence   VARCHAR2(80),
      transformation_approval      VARCHAR2(80),
      transformation_evidence      VARCHAR2(400),
      dwh_nullable                 VARCHAR2(20),
      dwh_pk_flag                  VARCHAR2(20),
      updated_at                   TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_legacy_lineage_xform PRIMARY KEY (lineage_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 2) SEI_TRANSFORMATION — the register. One row per distinct documented
--    transformation, legacy or SEI. TRANSFORMATION_LAYER is what keeps the
--    two eras apart in one table; without it a STAR_TO_IMDS rule and its
--    proposed SEI_TO_IMDS replacement look like duplicates.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_transformation (
      transformation_id      VARCHAR2(120) NOT NULL,
      data_source            VARCHAR2(40),
      transformation_layer   VARCHAR2(40),    -- STAR_TO_IMDS | SEI_TO_IMDS
      target_system          VARCHAR2(60),
      target_object          VARCHAR2(200),
      target_attribute       VARCHAR2(200),
      transformation_type    VARCHAR2(60),    -- DIRECT_OR_CONSTANT | DERIVED | ...
      input_objects          VARCHAR2(2000),
      input_fields           VARCHAR2(2000),
      transformation_logic   CLOB,
      null_handling          VARCHAR2(1000),
      conditional_logic      VARCHAR2(1000),
      status                 VARCHAR2(60),
      evidence_source        VARCHAR2(400),
      remarks                VARCHAR2(2000),
      updated_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_transformation PRIMARY KEY (transformation_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 3) SEI_TRANSFORMATION_COMPARE — legacy against proposed, side by side,
--    one row per target attribute. TRANSFORMATION_EQUIVALENCE and
--    APPROVAL_STATUS are separate columns on purpose: EXACT_TEXT is a
--    finding about the logic, DRAFT_REVIEW_REQUIRED is a finding about who
--    has looked at it, and an exact text match that nobody approved is not
--    ready to ship.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_transformation_compare (
      comparison_id          VARCHAR2(200) NOT NULL,
      data_source            VARCHAR2(40),
      target_system          VARCHAR2(60),
      target_object          VARCHAR2(200),
      target_attribute       VARCHAR2(200),
      target_type            VARCHAR2(100),
      target_nullable        VARCHAR2(20),
      legacy_transformation_id VARCHAR2(120),
      sei_transformation_id  VARCHAR2(120),
      imds_logic             CLOB,
      sei_logic              CLOB,
      sei_source_objects     VARCHAR2(2000),
      sei_source_fields      VARCHAR2(2000),
      equivalence            VARCHAR2(80),
      evidence_completeness  VARCHAR2(80),
      review_note            VARCHAR2(2000),
      approval_status        VARCHAR2(80),
      evidence_source        VARCHAR2(400),
      updated_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_xform_compare PRIMARY KEY (comparison_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 4) STAR_LAYOUT_FIELD — the published STAR field dictionary.
--
--    THIS IS THE ARTEFACT THE EVIDENCE PANEL HAS BEEN ASKING FOR. The
--    contract-field row of /evidence reads "0 of N" because no STAR layout
--    was supplied and every contract-side type was inferred from the target
--    column it feeds. 434 published fields is that inference replaced with
--    a document — so the row can finally move, and rows resting on ASSUMED
--    evidence can be re-derived.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE star_layout_field (
      star_field_id      VARCHAR2(600) NOT NULL,   -- {ds}:{feed}:{field}
      data_source        VARCHAR2(40),
      feed_family        VARCHAR2(200),
      ordinal            VARCHAR2(30),
      field_name         VARCHAR2(200),
      field_norm         VARCHAR2(200),
      published_type     VARCHAR2(100),
      published_length   VARCHAR2(60),
      published_format   VARCHAR2(200),
      description        VARCHAR2(4000),
      source_document    VARCHAR2(400),
      evidence_status    VARCHAR2(60),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_star_layout_field PRIMARY KEY (star_field_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 5) STAR_UPLOADER_JOB — what the loader does between the file landing and
--    the row appearing. Duplicate checks, header and trailer stripping,
--    delete-and-reinsert behaviour: none of it is in the column lineage,
--    and all of it changes what arrives.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE star_uploader_job (
      job_id             VARCHAR2(300) NOT NULL,
      data_source        VARCHAR2(40),
      job_name           VARCHAR2(200),
      duplicate_check    VARCHAR2(2000),
      pre_process        VARCHAR2(2000),
      loaded_as_is       VARCHAR2(2000),
      imds_load_mapping  VARCHAR2(2000),
      source_document    VARCHAR2(400),
      evidence_status    VARCHAR2(60),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_star_uploader_job PRIMARY KEY (job_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 6) SEI_NAME_RECON — exact normalised-name matches between STAR fields
--    and the SEI catalogue.
--
--    CANDIDATE EVIDENCE ONLY, and the table exists partly to keep it that
--    way. A name match is the cheapest signal available and the easiest to
--    mistake for a mapping; kept in SEI_TO_STAR it would be indistinguishable
--    from a documented rule. Here nothing can read it by accident.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_name_recon (
      recon_id           VARCHAR2(600) NOT NULL,
      data_source        VARCHAR2(40),
      feed_family        VARCHAR2(200),
      star_field         VARCHAR2(200),
      star_field_norm    VARCHAR2(200),
      star_type          VARCHAR2(100),
      star_length        VARCHAR2(60),
      match_count        NUMBER DEFAULT 0,
      matches            VARCHAR2(4000),
      evidence_class     VARCHAR2(80),
      verification_result VARCHAR2(120),
      source_document    VARCHAR2(400),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_name_recon PRIMARY KEY (recon_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 7) SEI_ENUM — the workbook''s own controlled vocabularies.
--    The UI ships a glossary of nine verdicts, six map kinds and so on.
--    Loading the workbook''s list means a value the workbook invented and
--    the glossary has never heard of is a query away, instead of appearing
--    on screen as an unexplained grey pill.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_enum (
      enum_id            VARCHAR2(400) NOT NULL,
      data_source        VARCHAR2(40),
      list_name          VARCHAR2(120),
      value              VARCHAR2(200),
      meaning            VARCHAR2(2000),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_enum PRIMARY KEY (enum_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 8) SEI_CONTROL — the three summary sheets in one shape. _MANIFEST,
--    FINAL_VERIFICATION and TRANSFORMATION_SUMMARY are all (name, value,
--    explanation) with a status, and three tables of a dozen rows each
--    would be three joins for one panel.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_control (
      control_id         VARCHAR2(400) NOT NULL,
      data_source        VARCHAR2(40),
      source_sheet       VARCHAR2(60),
      control_name       VARCHAR2(400),
      result             VARCHAR2(2000),
      status             VARCHAR2(80),
      detail             VARCHAR2(4000),
      seq                NUMBER,
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_control PRIMARY KEY (control_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- 9) LOT_LEVEL_POSITION_MAP — the raw import behind the comparison sheet.
--    Kept as delivered rather than folded into SEI_TRANSFORMATION_COMPARE,
--    because its blank and literal "Null" cells are evidence of an absent
--    mapping and normalising them away destroys the finding.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE lot_level_position_map (
      map_row_id         VARCHAR2(400) NOT NULL,
      data_source        VARCHAR2(40),
      target_column      VARCHAR2(200),
      target_type        VARCHAR2(100),
      nullable           VARCHAR2(20),
      star_transformation    CLOB,
      sei_transformation     CLOB,
      sei_source_object  VARCHAR2(2000),
      sei_source_field   VARCHAR2(2000),
      remarks            VARCHAR2(2000),
      source_document    VARCHAR2(400),
      updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_lot_level_position_map PRIMARY KEY (map_row_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- SEI_DISPOSITION gains DATA_SOURCE.
--
-- The new workbook''s DISPOSITION sheet has no LANE_ID column — it is keyed
-- on (target table, target column) alone. Every query that scoped
-- dispositions to a warehouse did it through LANE_ID, so without this the
-- undecided count reads zero and the purge deletes nothing. The loader
-- still resolves LANE_ID where it can, from the VERIFY row for the same
-- column; DATA_SOURCE is what makes the row findable when it cannot.
DECLARE
  PROCEDURE addcol(p_sql VARCHAR2) IS
    e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -1430);
    e_tab EXCEPTION; PRAGMA EXCEPTION_INIT(e_tab, -942);
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION
    WHEN e_dup THEN NULL;
    WHEN e_tab THEN NULL;
  END;
BEGIN
  addcol('ALTER TABLE sei_disposition ADD (data_source VARCHAR2(40))');
  -- the workbook adds GENERATE, RETAIN and DEFER to the five the original
  -- check constraint allowed, so the constraint has to go; the vocabulary
  -- is the workbook''s to define and ENUMS now carries it
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE sei_disposition DROP CONSTRAINT ck_sei_disp';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
/

DECLARE
  PROCEDURE idx(p_sql VARCHAR2) IS
    e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -955);
    e_col EXCEPTION; PRAGMA EXCEPTION_INIT(e_col, -1408);
    e_tab EXCEPTION; PRAGMA EXCEPTION_INIT(e_tab, -942);
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION
    WHEN e_dup THEN NULL; WHEN e_col THEN NULL; WHEN e_tab THEN NULL;
  END;
BEGIN
  idx('CREATE INDEX ix_llx_tgt   ON legacy_lineage_xform (data_source, dwh_target_table)');
  idx('CREATE INDEX ix_sxf_layer ON sei_transformation (data_source, transformation_layer)');
  idx('CREATE INDEX ix_sxc_tgt   ON sei_transformation_compare (data_source, target_object)');
  idx('CREATE INDEX ix_slf_feed  ON star_layout_field (data_source, feed_family)');
  idx('CREATE INDEX ix_slf_norm  ON star_layout_field (data_source, field_norm)');
  idx('CREATE INDEX ix_snr_norm  ON sei_name_recon (data_source, star_field_norm)');
  idx('CREATE INDEX ix_sctl_shee ON sei_control (data_source, source_sheet)');
  idx('CREATE INDEX ix_sdisp_ds  ON sei_disposition (data_source)');
END;
/

-- Health checks.
--
--   -- how many lineage rows now carry a transformation on each side
--   SELECT COUNT(*) rows_,
--          COUNT(legacy_transformation_id) legacy_,
--          COUNT(sei_transformation_id)    sei_
--   FROM   legacy_lineage_xform WHERE data_source = 'IMDS';
--
--   -- the equivalence spread — this is the new readiness question
--   SELECT NVL(equivalence,'(null)') e, NVL(approval_status,'(null)') a, COUNT(*) n
--   FROM   sei_transformation_compare WHERE data_source = 'IMDS'
--   GROUP  BY equivalence, approval_status ORDER BY 3 DESC;
--
--   -- did the STAR layout actually reach the contract fields that need it
--   SELECT CASE WHEN s.star_field_id IS NULL THEN 'contract field with NO published layout'
--               ELSE 'has a published layout' END v, COUNT(*) n
--   FROM   legacy_src_column c
--   LEFT   JOIN star_layout_field s
--          ON s.data_source = c.data_source AND s.field_norm = c.src_col_norm
--   WHERE  c.data_source = 'IMDS' GROUP BY CASE WHEN s.star_field_id IS NULL
--          THEN 'contract field with NO published layout' ELSE 'has a published layout' END;
