-- =====================================================================
-- sql/68_guardrail_deployment.sql
-- What is actually deployed in each environment. Guarded, idempotent.
--
-- WHY guardrail_release.CURRENT_REGION DOES NOT ANSWER THIS.
--
-- CURRENT_REGION is how far a release has got. That is a property OF THE
-- RELEASE, and it answers "where has my change reached". A release
-- dashboard asks the inverse question — "what is running in UAT" — and a
-- furthest-point column cannot answer it:
--
--   * the newest release is not the one deployed. A build blocked in SIT
--     never merged, so SIT is still running the one before it.
--   * an environment holds exactly one version at a time, and that fact
--     belongs to the environment, not to whichever release happens to
--     have travelled furthest.
--   * a rollback moves the environment backwards without moving any
--     release forwards.
--
-- ONE ROW PER DEPLOYMENT EVENT, not per environment, so the history is
-- the table and "current" is a query (the latest deployed row per
-- environment and lane). A boolean is_current column would need updating
-- in two places on every deploy and would be wrong the first time
-- something half-failed.
--
-- TWO LANES, BECAUSE THERE ARE TWO REPOSITORIES. The application
-- (dbt + Airflow) and the schema (Liquibase) deploy from different repos
-- through different pipelines, so each environment has an application
-- version AND a schema version and they are routinely different — under
-- expand-and-contract they are SUPPOSED to be, with the schema one
-- release ahead. Collapsing them into a single "UAT is on 1201" is how
-- "what is in UAT" comes to mean two different things depending on who
-- is asked.
--
-- QC is this estate's other name for UAT. One row in the register, one
-- canonical code, the alias carried alongside — renaming the column
-- would break every row already written against it.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -942, -1408, -1430) THEN RAISE; END IF;
  END;
BEGIN

  -- The environments themselves, so adding one is a row and not a code
  -- change. The hard-coded tuple this replaces appeared in four places.
  ddl('CREATE TABLE guardrail_environment (
    env_code     VARCHAR2(10)  NOT NULL,   -- SIT | UAT | PROD
    env_alias    VARCHAR2(40),             -- QC, where the estate says QC
    display_name VARCHAR2(80),
    env_order    NUMBER,                   -- promotion order, 1 upward
    gated        CHAR(1) DEFAULT ''Y'',    -- N for production
    purpose      VARCHAR2(400),
    CONSTRAINT pk_guardrail_environment PRIMARY KEY (env_code))');

  -- One row per deployment EVENT.
  ddl('CREATE TABLE guardrail_deployment (
    deployment_id   VARCHAR2(80)  NOT NULL,
    environment     VARCHAR2(10)  NOT NULL,
    -- app | schema. The two repositories deploy independently.
    lane            VARCHAR2(10)  DEFAULT ''app'',
    -- Nullable: a hotfix or a baseline sync has no release candidate.
    release_id      VARCHAR2(60),
    -- The three things that identify a version, kept separately because
    -- each answers a different question: the build is the pipeline run,
    -- the tag and SHA are what you check out to reproduce it, and the
    -- Liquibase tag is where the schema stands.
    build_number    VARCHAR2(40),
    app_tag         VARCHAR2(120),
    commit_sha      VARCHAR2(60),
    db_tag          VARCHAR2(120),
    changesets      NUMBER,
    -- deployed | rolled_back | failed | superseded
    status          VARCHAR2(20)  DEFAULT ''deployed'',
    deployed_at     TIMESTAMP,
    deployed_by     VARCHAR2(120),
    duration_s      NUMBER,
    notes           VARCHAR2(1000),
    project_id      VARCHAR2(60),
    CONSTRAINT pk_guardrail_deployment PRIMARY KEY (deployment_id))');
  ddl('CREATE INDEX ix_gdep_env  ON guardrail_deployment (environment, lane, deployed_at)');
  ddl('CREATE INDEX ix_gdep_rel  ON guardrail_deployment (release_id)');
  ddl('CREATE INDEX ix_gdep_stat ON guardrail_deployment (status)');

END;
/

-- The three environments. MERGE rather than INSERT so re-running does not
-- duplicate them and does not overwrite a locally edited purpose.
MERGE INTO guardrail_environment e
USING (SELECT 'SIT' AS c, NULL AS a, 'System Integration Test' AS d, 1 AS o,
              'Y' AS g,
              'Every push. Governance, tests, security, and the performance '
              || 'checks that need no data volume.' AS p FROM dual
       UNION ALL
       SELECT 'UAT', 'QC', 'User Acceptance Test', 2, 'Y',
              'On promotion. SLA at realistic volumes, the business test '
              || 'pack, sign-off. Called QC in some places.' FROM dual
       UNION ALL
       SELECT 'PROD', NULL, 'Production', 3, 'N',
              'No gates. Runtime guardrails watch the data instead.' FROM dual) s
ON (e.env_code = s.c)
WHEN NOT MATCHED THEN
  INSERT (env_code, env_alias, display_name, env_order, gated, purpose)
  VALUES (s.c, s.a, s.d, s.o, s.g, s.p);
COMMIT;
