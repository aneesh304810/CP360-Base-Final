-- ============================================================================
-- 82_scd2_review.sql
-- The sign-off layer for the SCD2 rule cards. The tool writes the rules
-- and their evidence (sql/81); a named person confirms each one and gives
-- it a business reading. Kept in its own table so a reviewer's words are
-- never mistaken for evidence, and a rerun of the tool never erases a
-- sign-off.
--
--   python tools/scd2_review_export.py --out local-data/scd2_review.xlsx
--   ... reviewers fill business_meaning / confirmed / reviewer_note ...
--   $env:CP_SCD2_REVIEW_XLSX="local-data/scd2_review.xlsx"
--   python -m ingestion.run scd2_review
--
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_rule_review (
      table_name        VARCHAR2(128) NOT NULL,
      rule_id           VARCHAR2(10)  NOT NULL,
      rule_text_seen    VARCHAR2(4000),             -- the rule as it read when reviewed
      business_meaning  VARCHAR2(2000),
      confirmed         CHAR(1),                     -- Y | N | NULL (not yet)
      reviewer          VARCHAR2(120),
      reviewer_note     VARCHAR2(2000),
      reviewed_at       TIMESTAMP,
      source_file       VARCHAR2(400),
      loaded_at         TIMESTAMP,
      CONSTRAINT pk_scd2_rule_review PRIMARY KEY (table_name, rule_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
