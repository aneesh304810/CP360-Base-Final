-- ============================================================================
-- 84_pbnotify_review.sql
-- PB Notifications: the review layer on the design page. The page's items
-- (requirements, gaps, tests, steps, exceptions, templates, tables) ship
-- with the UI; this stores what reviewers DO to them. An item nobody has
-- touched has no row, and absence means untouched.
--
--   pbn_review_edit   one row per proposed edit of one item's text. The
--                     latest row per item_key is the text the page shows;
--                     earlier rows are the history. A row with a NULL body
--                     restores the shipped text.
--   pbn_review_note   one row per question, comment or answer on an item,
--                     with the status a reviewer gave it. A reply carries
--                     the parent note's id.
--
-- Written only by api/app/routers_pbnotify_review.py, one named operation
-- at a time, so two reviewers typing at once conflict on one note rather
-- than overwrite each other's afternoon. No client data is ever in a row:
-- the items are design text, the bodies are reviewers' words.
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE pbn_review_edit (
      edit_id      VARCHAR2(40)   NOT NULL,
      item_key     VARCHAR2(80)   NOT NULL,     -- section:id, e.g. gap:G7, test:T05
      section      VARCHAR2(30),
      body         VARCHAR2(4000),              -- NULL restores the shipped text
      seen         VARCHAR2(4000),              -- the text as it read when edited
      author       VARCHAR2(120)  NOT NULL,
      id_source    VARCHAR2(10),                -- session | proxy | none
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_pbn_review_edit PRIMARY KEY (edit_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_pbn_review_edit_key ON pbn_review_edit (item_key, created_at)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE pbn_review_note (
      note_id      VARCHAR2(40)   NOT NULL,
      item_key     VARCHAR2(80)   NOT NULL,     -- general for a question about the whole design
      section      VARCHAR2(30),
      kind         VARCHAR2(12)   NOT NULL,     -- question | comment | answer
      body         VARCHAR2(4000) NOT NULL,
      author       VARCHAR2(120)  NOT NULL,
      id_source    VARCHAR2(10),
      parent_id    VARCHAR2(40),                -- the note this answers
      status       VARCHAR2(10)   DEFAULT ''open'' NOT NULL,   -- open | answered | closed
      status_by    VARCHAR2(120),
      status_at    TIMESTAMP,
      edited_by    VARCHAR2(120),
      edited_at    TIMESTAMP,
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_pbn_review_note PRIMARY KEY (note_id),
      CONSTRAINT ck_pbn_review_kind CHECK (kind IN (''question'',''comment'',''answer'')),
      CONSTRAINT ck_pbn_review_status CHECK (status IN (''open'',''answered'',''closed''))
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_pbn_review_note_key ON pbn_review_note (item_key, created_at)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
