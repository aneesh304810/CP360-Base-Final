-- =====================================================================
-- sql/70_hub_discussion.sql
-- CP Integration Hub — Discussion. Questions, answers, attachments and
-- the audit trail. Guarded, idempotent.
--
-- WHY ROWS AND NOT A DOCUMENT. The first cut round-tripped the whole
-- discussion as one JSON blob, which worked with no backend and is the
-- wrong shape the moment two people type at once: the second save
-- overwrites the first silently. Rows make a concurrent edit a conflict
-- on one answer instead of a lost afternoon.
--
-- THE 108 REVIEW QUESTIONS STAY IN CODE. They are the starting corpus,
-- not user content, and they ship with the build keyed by their review
-- number so a redeploy can neither duplicate nor lose them. This table
-- holds what people DO to them -- an edited body, a changed component
-- link, a status decision -- plus questions raised in the app, which
-- number from 1001. A seeded question with nothing done to it has no row
-- here at all, and that is correct: absence means untouched.
--
-- ATTACHMENTS ARE A TABLE, NOT A COLUMN. A diagram belongs to an answer,
-- several may, and the bytes must not be dragged into every list query.
--
-- SVG IS STORED SANITISED, NEVER AS RECEIVED. An SVG is a document that
-- can carry script, event handlers and external references; rendering an
-- uploaded one unfiltered is cross-site scripting with extra steps. The
-- API sanitises before insert and records the fact, so a row that
-- predates the sanitiser is identifiable rather than merely suspect.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -942, -1408, -1430) THEN RAISE; END IF;
  END;
BEGIN

  -- What has been DONE to a question. No row means untouched.
  ddl('CREATE TABLE hub_question (
    qid            NUMBER        NOT NULL,   -- 1..108 review, 1001+ raised here
    -- review | user. A review question cannot be deleted; a user one can.
    source         VARCHAR2(10)  DEFAULT ''review'',
    topic          NUMBER,
    owner_code     VARCHAR2(10),
    body           CLOB,                     -- null unless edited
    comps          VARCHAR2(400),            -- csv of component ids
    -- open/answered/resolved are DERIVED from the answers and are never
    -- stored. Only a human decision lands here: blocked | superseded.
    status         VARCHAR2(20),
    status_by      VARCHAR2(200),
    status_at      TIMESTAMP,
    created_by     VARCHAR2(200),
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
    edited_by      VARCHAR2(200),
    edited_at      TIMESTAMP,
    project_id     VARCHAR2(60),
    CONSTRAINT pk_hub_question PRIMARY KEY (qid))');
  ddl('CREATE INDEX ix_hubq_status ON hub_question (status)');
  ddl('CREATE INDEX ix_hubq_source ON hub_question (source)');

  -- One row per answer. A drafted answer only gets a row once somebody
  -- accepts or edits it -- until then it is derived from the code.
  ddl('CREATE TABLE hub_answer (
    answer_id      VARCHAR2(60)  NOT NULL,
    qid            NUMBER        NOT NULL,
    body           CLOB,
    author         VARCHAR2(200),
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_by     VARCHAR2(200),
    updated_at     TIMESTAMP,
    -- Acceptance is a decision and records who made it. At most one
    -- accepted answer per question -- enforced by the API, because
    -- Oracle cannot express "at most one Y per qid" as a constraint
    -- without a function-based unique index, which is below.
    accepted       CHAR(1) DEFAULT ''N'',
    accepted_by    VARCHAR2(200),
    accepted_at    TIMESTAMP,
    -- Set when this row started life as a drafted answer in the code,
    -- so an edited draft is distinguishable from one somebody wrote.
    seed_key       VARCHAR2(40),
    project_id     VARCHAR2(60),
    CONSTRAINT pk_hub_answer PRIMARY KEY (answer_id))');
  ddl('CREATE INDEX ix_huba_qid ON hub_answer (qid)');
  -- At most one accepted answer per question, in the database and not
  -- only in the code that writes it. NULL repeats freely in a unique
  -- index, so only the accepted rows are indexed.
  ddl('CREATE UNIQUE INDEX ux_huba_accept ON hub_answer
       (CASE WHEN accepted = ''Y'' THEN qid END)');

  -- Images and diagrams. Bytes live here so no list query drags them.
  ddl('CREATE TABLE hub_attachment (
    att_id         VARCHAR2(60)  NOT NULL,
    -- Exactly one of these is set; the API enforces it.
    answer_id      VARCHAR2(60),
    qid            NUMBER,
    -- image | svg. An svg is text and lives in SVG_TEXT; an image is
    -- bytes and lives in CONTENT.
    kind           VARCHAR2(10),
    mime           VARCHAR2(80),
    filename       VARCHAR2(300),
    caption        VARCHAR2(600),
    width_px       NUMBER,
    height_px      NUMBER,
    byte_size      NUMBER,
    sha256         VARCHAR2(64),
    content        BLOB,
    svg_text       CLOB,
    -- Y once the SVG has been through the sanitiser. A row with N is
    -- either pre-sanitiser or was inserted outside the API, and the
    -- reader refuses to render it.
    sanitised      CHAR(1) DEFAULT ''N'',
    -- What the sanitiser took out, so a diagram that renders oddly can
    -- be explained rather than guessed at.
    sanitise_note  VARCHAR2(600),
    uploaded_by    VARCHAR2(200),
    uploaded_at    TIMESTAMP DEFAULT SYSTIMESTAMP,
    project_id     VARCHAR2(60),
    CONSTRAINT pk_hub_attachment PRIMARY KEY (att_id))');
  ddl('CREATE INDEX ix_huba_att_ans ON hub_attachment (answer_id)');
  ddl('CREATE INDEX ix_huba_att_qid ON hub_attachment (qid)');

  -- The audit trail. Append only; nothing updates a row here.
  ddl('CREATE TABLE hub_event (
    event_id       VARCHAR2(60)  NOT NULL,
    qid            NUMBER,
    answer_id      VARCHAR2(60),
    to_status      VARCHAR2(20),
    actor          VARCHAR2(200),
    at_ts          TIMESTAMP DEFAULT SYSTIMESTAMP,
    note           VARCHAR2(1000),
    project_id     VARCHAR2(60),
    CONSTRAINT pk_hub_event PRIMARY KEY (event_id))');
  ddl('CREATE INDEX ix_hube_qid ON hub_event (qid, at_ts)');

END;
/
