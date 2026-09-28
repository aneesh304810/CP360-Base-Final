-- 59_transformation_review.sql -------------------------------------------
--
-- "Is the proposed SEI transformation correct?" — recorded, with who said
-- so and when.
--
-- WHY THIS IS A SEPARATE TABLE FROM THE WORKBOOK'S APPROVAL_STATUS. The
-- workbook carries APPROVAL_STATUS, and every row of it currently reads
-- DRAFT_REVIEW_REQUIRED, because that is the state the generating pass
-- left them in. It is an input. If a reviewer's decision were written back
-- into the same column, the next ingest would silently erase it — the
-- loader upserts on COMPARISON_ID and the workbook's value would win.
--
-- So reviews live beside the workbook, keyed the same way, and the API
-- reports both: what the document says, and what a person has since
-- decided. Where they disagree, that disagreement is the finding.
--
-- A review is an opinion with a name on it, not a fact. VERDICT says what
-- was decided, REVIEWER says who, and RATIONALE is required by the API for
-- anything but AGREES — a rejection with no reason cannot be acted on.

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_xform_review (
      review_id        VARCHAR2(600) NOT NULL,  -- {ds}:{table}:{column}
      data_source      VARCHAR2(40),
      dwh_target_table VARCHAR2(200),
      dwh_target_column VARCHAR2(200),
      comparison_id    VARCHAR2(200),
      verdict          VARCHAR2(40),
        -- AGREES            the SEI rule computes the same value
        -- DIFFERS           it computes a different value, and why
        -- CANNOT_TELL       not enough is documented to decide
        -- NEEDS_BUSINESS    a real difference only the business can settle
      rationale        VARCHAR2(4000),
      reviewer         VARCHAR2(200),
      reviewed_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      workbook_status  VARCHAR2(80),  -- what APPROVAL_STATUS said at the time
      updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_xform_review PRIMARY KEY (review_id),
      CONSTRAINT ck_sei_xform_verdict CHECK
        (verdict IN (''AGREES'',''DIFFERS'',''CANNOT_TELL'',''NEEDS_BUSINESS''))
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- The history, because a decision that changed is worth more than the
-- decision that stands. One row per save; the table above holds the
-- current one.
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE sei_xform_review_log (
      log_id           VARCHAR2(700) NOT NULL,
      review_id        VARCHAR2(600),
      data_source      VARCHAR2(40),
      verdict          VARCHAR2(40),
      rationale        VARCHAR2(4000),
      reviewer         VARCHAR2(200),
      reviewed_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_sei_xform_review_log PRIMARY KEY (log_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE
  PROCEDURE idx(p_sql VARCHAR2) IS
    e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -955);
  BEGIN EXECUTE IMMEDIATE p_sql;
  EXCEPTION WHEN e_dup THEN NULL; END;
BEGIN
  idx('CREATE INDEX ix_sxr_ds  ON sei_xform_review (data_source, verdict)');
  idx('CREATE INDEX ix_sxr_tgt ON sei_xform_review (data_source, dwh_target_table)');
  idx('CREATE INDEX ix_sxrl_rv ON sei_xform_review_log (review_id)');
END;
/

-- NOT purged by the crosswalk loader. Deliberately: these are people's
-- decisions, not workbook content, and a reload of the workbook must not
-- delete them. The loader's purge list does not name either table.

-- Where the reviewer and the workbook disagree:
--
--   SELECT c.target_object, c.target_attribute, c.approval_status,
--          r.verdict, r.reviewer, r.rationale
--   FROM   sei_transformation_compare c
--   JOIN   sei_xform_review r
--          ON r.data_source = c.data_source
--         AND r.dwh_target_table = c.target_object
--         AND r.dwh_target_column = c.target_attribute
--   WHERE  c.data_source = 'IMDS'
--     AND (r.verdict = 'AGREES') <> (UPPER(c.approval_status) LIKE 'APPROVED%');
