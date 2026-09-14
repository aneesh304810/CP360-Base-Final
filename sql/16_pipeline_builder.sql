-- =====================================================================
-- sql/16_pipeline_builder.sql
-- Pipeline builder: master feed catalogs (inbound/outbound) + loaders,
-- and BA-composed pipelines that pick from them. Mirrors API 360 flow
-- builder. Feeds can be shared across pipelines; multiple loaders per
-- pipeline allowed. Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  -- master catalog of feeds SWP provides / receives (the pickable inventory)
  ddl('CREATE TABLE feed_catalog (
        feed_id          VARCHAR2(200),
        feed_name        VARCHAR2(400),
        direction        VARCHAR2(10),     -- inbound | outbound
        business_domain  VARCHAR2(120),
        frequency        VARCHAR2(60),     -- EOD | BOD | Intraday | ...
        format           VARCHAR2(60),     -- pipe | csv | xml | fixed
        record_type      VARCHAR2(200),
        source_system    VARCHAR2(120),
        target_system    VARCHAR2(120),
        schema_ref       VARCHAR2(400),
        description      CLOB,
        project_id       VARCHAR2(40),
        source_xlsx      VARCHAR2(1000),
        CONSTRAINT pk_feed_catalog PRIMARY KEY (feed_id, direction))');

  -- master catalog of loaders (template + schema def + error handling)
  ddl('CREATE TABLE loader_catalog (
        loader_id        VARCHAR2(200),
        loader_name      VARCHAR2(400),
        template         VARCHAR2(200),    -- loader template name
        schema_def       CLOB,             -- schema definition / layout
        error_template   VARCHAR2(400),    -- error handling template
        validation_rules CLOB,
        business_domain  VARCHAR2(120),
        project_id       VARCHAR2(40),
        source_xlsx      VARCHAR2(1000),
        CONSTRAINT pk_loader_catalog PRIMARY KEY (loader_id))');

  -- BA-composed pipelines (domain default OR custom)
  ddl('CREATE TABLE data_pipelines (
        pipeline_id      VARCHAR2(120),
        pipeline_name    VARCHAR2(400),
        business_domain  VARCHAR2(120),
        schedule         VARCHAR2(40),     -- EOD | BOD | Intraday
        goal             VARCHAR2(2000),
        owner            VARCHAR2(200),
        origin           VARCHAR2(20) DEFAULT ''custom'',  -- domain | custom
        project_id       VARCHAR2(40),
        is_published     CHAR(1) DEFAULT ''Y'',
        updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_data_pipelines PRIMARY KEY (pipeline_id))');

  -- pipeline members: which feeds (in/out) + loaders belong to a pipeline
  -- stage: inbound_feed | loader | outbound_feed  (the end-to-end order)
  ddl('CREATE TABLE pipeline_members (
        pipeline_id      VARCHAR2(120),
        stage            VARCHAR2(20),     -- inbound_feed|loader|outbound_feed
        member_id        VARCHAR2(200),    -- feed_id or loader_id
        member_order     NUMBER,
        note             VARCHAR2(2000),
        CONSTRAINT pk_pipeline_members PRIMARY KEY (pipeline_id, stage, member_id))');
END;
/

-- View: pipeline with member counts by stage
CREATE OR REPLACE VIEW v_data_pipeline_360 AS
SELECT p.pipeline_id, p.pipeline_name, p.business_domain, p.schedule, p.goal,
       p.owner, p.origin, p.project_id, p.is_published,
       (SELECT COUNT(*) FROM pipeline_members m WHERE m.pipeline_id=p.pipeline_id AND m.stage='inbound_feed') AS inbound_count,
       (SELECT COUNT(*) FROM pipeline_members m WHERE m.pipeline_id=p.pipeline_id AND m.stage='loader') AS loader_count,
       (SELECT COUNT(*) FROM pipeline_members m WHERE m.pipeline_id=p.pipeline_id AND m.stage='outbound_feed') AS outbound_count
FROM data_pipelines p;
