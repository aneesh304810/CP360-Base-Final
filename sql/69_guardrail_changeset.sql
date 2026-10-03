-- =====================================================================
-- sql/69_guardrail_changeset.sql
-- The changelog, and what each environment has applied of it.
-- Guarded, idempotent.
--
-- WHY A COUNT WAS NOT ENOUGH. guardrail_deployment.CHANGESETS records how
-- many changesets an environment has. That lets a comparison say "UAT is
-- five ahead of production" and nothing more — and five is not a fact
-- anyone can act on. One of those five might be a DROP COLUMN and one a
-- back-fill with no rollback block, which is the difference between a
-- promotion somebody signs and one they stop.
--
-- TWO TABLES, MIRRORING LIQUIBASE ITSELF. The changelog is the
-- definition of a change; DATABASECHANGELOG is the record of applying
-- it, and there is one of those per environment. Keeping the same split
-- means a comparison between two environments is a set difference over
-- CHANGESET_APPLIED rather than a join nobody can read, and it means a
-- real ingester reading DATABASECHANGELOG has somewhere to put the rows
-- without reshaping them.
--
-- ROLLBACK IS TWO QUESTIONS, NOT ONE, so it is two columns.
--   ROLLBACK_DECLARED  is there a rollback block at all?
--   DATA_SAFE          would running it get the data back?
-- A DROP COLUMN usually answers Y and N: Liquibase can recreate the
-- column and cannot recreate what was in it. Collapsing those into one
-- "rollbackable" flag is how a promotion gets approved on the strength
-- of a rollback that restores an empty column.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -942, -1408, -1430) THEN RAISE; END IF;
  END;
BEGIN

  -- The changelog: one row per changeset, as authored.
  ddl('CREATE TABLE guardrail_changeset (
    changeset_id     VARCHAR2(200) NOT NULL,   -- author:filename::id
    author           VARCHAR2(120),
    filename         VARCHAR2(400),
    description      VARCHAR2(600),
    -- ddl_add | ddl_drop | ddl_alter | index | constraint | dml | other
    change_type      VARCHAR2(30),
    -- Is there a rollback block?  Is running it enough to get the data back?
    rollback_declared CHAR(1) DEFAULT ''N'',
    data_safe        CHAR(1) DEFAULT ''Y'',
    -- Which release and build introduced it, so the two lanes can be
    -- lined up where they do correspond.
    release_id       VARCHAR2(60),
    build_number     VARCHAR2(40),
    labels           VARCHAR2(200),
    contexts         VARCHAR2(200),
    position_order   NUMBER,
    project_id       VARCHAR2(60),
    CONSTRAINT pk_guardrail_changeset PRIMARY KEY (changeset_id))');
  ddl('CREATE INDEX ix_gcs_rel  ON guardrail_changeset (release_id)');
  ddl('CREATE INDEX ix_gcs_type ON guardrail_changeset (change_type)');

  -- DATABASECHANGELOG, one row per (changeset, environment).
  ddl('CREATE TABLE guardrail_changeset_applied (
    changeset_id  VARCHAR2(200) NOT NULL,
    environment   VARCHAR2(10)  NOT NULL,
    tag           VARCHAR2(120),             -- the tag it landed under
    applied_at    TIMESTAMP,
    -- EXECUTED | MARK_RAN | RERAN | FAILED
    exec_type     VARCHAR2(20) DEFAULT ''EXECUTED'',
    checksum      VARCHAR2(120),
    CONSTRAINT pk_gcs_applied PRIMARY KEY (changeset_id, environment))');
  ddl('CREATE INDEX ix_gcsa_env ON guardrail_changeset_applied (environment, applied_at)');

END;
/
