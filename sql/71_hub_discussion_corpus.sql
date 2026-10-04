-- =====================================================================
-- sql/71_hub_discussion_corpus.sql
-- The review corpus moves INTO the database.
--
-- WHAT CHANGED AND WHY. 70_ kept the 108 review questions in the UI and
-- stored only what people DID to them. That was defensible -- a redeploy
-- could not duplicate or lose them -- but it means the database is not
-- the system of record, and a question raised in the app and a question
-- from the review live in two different places. They are now one table.
--
-- THE RISK THIS CREATES, AND HOW IT IS HANDLED. A corpus that lives in a
-- table can be clobbered by a re-run of the loader. So the loader
-- updates a row ONLY WHILE IT IS PRISTINE: the moment a human edits a
-- question, accepts an answer or changes a status, the loader stops
-- touching those columns. That rule is in the loader's MERGE, not in a
-- convention, and the test re-breaks it.
--
-- TOPICS AND OWNERS ARE TABLES TOO, because "read the questions from the
-- database" is not satisfied by reading questions and then taking their
-- grouping and their owners' names from a constant in the bundle.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -942, -1408, -1430) THEN RAISE; END IF;
  END;
BEGIN

  ddl('CREATE TABLE hub_topic (
    topic_no      NUMBER        NOT NULL,
    title         VARCHAR2(300),
    comps         VARCHAR2(400),      -- csv of default component ids
    sort_order    NUMBER,
    CONSTRAINT pk_hub_topic PRIMARY KEY (topic_no))');

  ddl('CREATE TABLE hub_owner (
    owner_code    VARCHAR2(10)  NOT NULL,
    name          VARCHAR2(200),
    focus         VARCHAR2(600),
    -- What the review document itself published as this person''s count.
    -- Kept so the screen can disagree with the document out loud rather
    -- than quietly showing a different number.
    declared_total NUMBER,
    CONSTRAINT pk_hub_owner PRIMARY KEY (owner_code))');

  -- hub_question gains the corpus columns. It previously held only
  -- overrides, so BODY was null unless edited; it is now always set.
  ddl('ALTER TABLE hub_question ADD (
    seeded      CHAR(1) DEFAULT ''N'',
    note        VARCHAR2(400))');

  -- hub_answer gains everything a drafted answer carries. These were
  -- derived from the bundle and are now columns.
  ddl('ALTER TABLE hub_answer ADD (
    -- codebase | absence | document | inference
    conf        VARCHAR2(20),
    gap         CLOB,
    quote       CLOB,
    fig         VARCHAR2(40),
    ev          VARCHAR2(800),        -- csv of evidence labels
    -- Y while it is a drafted answer nobody has adopted. Cleared when a
    -- person edits it, because at that point it is theirs.
    is_draft    CHAR(1) DEFAULT ''N'')');

  ddl('CREATE INDEX ix_huba_draft ON hub_answer (is_draft)');
  ddl('CREATE INDEX ix_hubq_topic ON hub_question (topic)');

END;
/
