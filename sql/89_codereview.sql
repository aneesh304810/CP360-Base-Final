-- ============================================================================
-- 89_codereview.sql
-- CP 360 code review: one row per review of a pull request or push, and one
-- row per finding, written by codereview/store.py through the API's db layer
-- (api/app/routers_codereview.py). The report body is kept as it was posted
-- so Code Review 360 shows what the author saw. No file content, no secret,
-- no data value is stored: file paths, line numbers, rule ids and the
-- reviewer's sentences only. Idempotent (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cr_review (
      review_id    VARCHAR2(40)   NOT NULL,
      repo         VARCHAR2(200),              -- owner/name
      ref          VARCHAR2(200),              -- branch or pull request title
      kind         VARCHAR2(10),               -- pr | push | diff | files
      pr_number    NUMBER(10),
      head_sha     VARCHAR2(64),
      verdict      VARCHAR2(20),               -- APPROVE | COMMENT | REQUEST_CHANGES
      summary      VARCHAR2(4000),             -- the reviewer''s paragraph
      status       VARCHAR2(20),               -- awaiting_copilot | final
      source       VARCHAR2(30),               -- rules | rules+copilot | rules+claude
      pack_path    VARCHAR2(1000),
      report_md    CLOB,
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      updated_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_cr_review PRIMARY KEY (review_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cr_finding (
      finding_id   VARCHAR2(50)   NOT NULL,
      review_id    VARCHAR2(40)   NOT NULL,
      seq          NUMBER(6),
      rule_id      VARCHAR2(30),               -- CP360-CR-...
      severity     VARCHAR2(10),               -- blocker | high | medium | low | info
      file_path    VARCHAR2(1000),
      line_no      NUMBER(10),
      title        VARCHAR2(200),
      message      VARCHAR2(2000),
      fix          VARCHAR2(2000),
      evidence     VARCHAR2(400),              -- the line, trimmed; never a secret (the rules mask them)
      source       VARCHAR2(10),               -- rule | copilot | claude
      confidence   VARCHAR2(10),
      CONSTRAINT pk_cr_finding PRIMARY KEY (finding_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cr_finding_review ON cr_finding (review_id, seq)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
