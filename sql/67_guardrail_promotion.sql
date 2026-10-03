-- =====================================================================
-- sql/67_guardrail_promotion.sql
-- The promotion plane: SIT -> UAT -> PROD, and the gates each region runs.
-- Guarded and idempotent. Safe to run repeatedly.
--
-- WHY THIS IS NOT A COLUMN ON guardrail_events.
--
-- There are two grains here and they do not reduce to one.
--
--   A GATE RUN is keyed to a COMMIT. "Did the schema validation pass for
--   the build of 4f2a9c1 in SIT" is a question about a change someone is
--   trying to ship. It has a branch, a pull request, a build number and a
--   Jenkins log; it has no business date and no bad rows.
--
--   A GUARDRAIL EVENT is keyed to a RUN. "Did cash_balance_usd contain
--   nulls in last night's Gold load" is a question about data on a date.
--   It has a dataset, a column, a row count and a sample; it has no
--   commit, because nothing was deployed that night.
--
-- Tagging one table with a region and leaving half its columns null for
-- half its rows makes both questions harder to ask and neither easier.
-- So: two tables, joined by a release, which is the only thing that
-- genuinely spans them -- a change is promoted through the regions, and
-- once it is live its runtime failures can be attributed back to it.
--
-- THE REGIONS ARE NOT THE SAME SHAPE, deliberately:
--   SIT   every push. Jenkins runs governance, tests, security, and the
--         cheap half of performance (EXPLAIN PLAN, partition pruning) --
--         the checks that need no data volume.
--   UAT   on promotion. The expensive half of performance (SLA at real
--         volumes), the business test pack, and sign-off.
--   PROD  no gates. Runtime guardrails only: GE, Soda, dbt tests and
--         Airflow, which is what guardrail_events already holds.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    -- ORA-00955 (exists) / -00942 (missing) / -01408 (index exists)
    -- / -01430 (column exists) -> ignore, so this re-runs cleanly
    IF SQLCODE NOT IN (-955, -942, -1408, -1430) THEN RAISE; END IF;
  END;
BEGIN

  -- A change on its way to production. One row per release candidate.
  ddl('CREATE TABLE guardrail_release (
    release_id      VARCHAR2(60)  NOT NULL,
    title           VARCHAR2(400),
    branch          VARCHAR2(200),
    commit_sha      VARCHAR2(60),
    pr_number       VARCHAR2(40),
    build_number    VARCHAR2(40),
    author          VARCHAR2(200),
    -- Where it has got to: SIT | UAT | PROD. Not where it is allowed to
    -- be -- where it IS. A release blocked in SIT stays at SIT.
    current_region  VARCHAR2(10),
    -- in_flight | blocked | released | rolled_back
    status          VARCHAR2(20),
    -- What it touches, so a runtime failure can be read against it.
    models_changed  NUMBER,
    datasets        VARCHAR2(1000),
    opened_at       TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    project_id      VARCHAR2(60),
    CONSTRAINT pk_guardrail_release PRIMARY KEY (release_id))');
  ddl('CREATE INDEX ix_grl_region ON guardrail_release (current_region)');
  ddl('CREATE INDEX ix_grl_status ON guardrail_release (status)');

  -- One gate, run once, in one region, for one release.
  ddl('CREATE TABLE guardrail_gate_run (
    gate_run_id     VARCHAR2(80)  NOT NULL,
    release_id      VARCHAR2(60)  NOT NULL,
    region          VARCHAR2(10),                -- SIT | UAT
    -- The four stages from the CI/CD flow, plus promotion itself.
    stage           VARCHAR2(40),                -- governance | performance
                                                 -- | testing | security
                                                 -- | promotion
    stage_order     NUMBER,
    gate_key        VARCHAR2(120),               -- schema_validation, ...
    gate_name       VARCHAR2(300),
    -- passed | failed | warning | skipped | running | not_run
    status          VARCHAR2(20),
    severity        VARCHAR2(20),
    -- Y when a failure stops the promotion. A gate that reports and does
    -- not block is a different thing from one that does, and a screen
    -- that shows them the same way teaches people to ignore both.
    blocking        CHAR(1) DEFAULT ''Y'',
    expectation     VARCHAR2(400),
    observed_value  VARCHAR2(400),
    threshold       VARCHAR2(200),
    message         VARCHAR2(1000),
    root_cause      VARCHAR2(1000),
    evidence        CLOB,                        -- JSON: rows, plans, CVEs
    log_url         VARCHAR2(600),
    started_at      TIMESTAMP,
    finished_at     TIMESTAMP,
    duration_ms     NUMBER,
    run_id          VARCHAR2(80),
    project_id      VARCHAR2(60),
    CONSTRAINT pk_guardrail_gate_run PRIMARY KEY (gate_run_id))');
  ddl('CREATE INDEX ix_ggr_release ON guardrail_gate_run (release_id)');
  ddl('CREATE INDEX ix_ggr_region  ON guardrail_gate_run (region, status)');
  ddl('CREATE INDEX ix_ggr_stage   ON guardrail_gate_run (stage)');

  -- The runtime plane gains a region, and a nullable link back to the
  -- release that introduced the change. Nullable on purpose: most
  -- runtime failures are data, not deployment, and forcing a release on
  -- them would invent a culprit.
  ddl('ALTER TABLE guardrail_events ADD (region VARCHAR2(10) DEFAULT ''PROD'')');
  ddl('ALTER TABLE guardrail_events ADD (release_id VARCHAR2(60))');
  ddl('CREATE INDEX ix_guardrail_region ON guardrail_events (region)');

END;
/

-- Backfill: every event that predates the column is a PROD runtime event,
-- which is what the screen has always been showing.
BEGIN
  EXECUTE IMMEDIATE
    'UPDATE guardrail_events SET region = ''PROD'' WHERE region IS NULL';
  COMMIT;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
