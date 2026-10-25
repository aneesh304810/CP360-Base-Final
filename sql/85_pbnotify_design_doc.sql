-- ============================================================================
-- 85_pbnotify_design_doc.sql
-- PB Notifications: the design document itself, one row per ingested
-- version. The page ships a baseline design in its code; a reviewer can
-- download it as Markdown, edit it (in enterprise Claude or by hand) and
-- ingest the file on the Document tab. Each ingest is a new row: the
-- Markdown as received and the design it parsed to, so a version can be
-- read back or restored. The highest version is the one the page shows;
-- a row with is_shipped = Y restores the baseline.
-- Written only by api/app/routers_pbnotify_review.py. No client data is in
-- a design document: table and column names, rules and counts.
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE pbn_design_doc (
      doc_id       VARCHAR2(40)   NOT NULL,
      version      NUMBER(6)      NOT NULL,
      markdown     CLOB,                         -- the file as received
      design_json  CLOB,                         -- what it parsed to; NULL = the shipped design
      file_name    VARCHAR2(260),
      note         VARCHAR2(1000),
      is_shipped   CHAR(1) DEFAULT ''N'' NOT NULL,
      author       VARCHAR2(120)  NOT NULL,
      id_source    VARCHAR2(10),
      byte_size    NUMBER(10),
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_pbn_design_doc PRIMARY KEY (doc_id),
      CONSTRAINT uk_pbn_design_doc_ver UNIQUE (version)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
