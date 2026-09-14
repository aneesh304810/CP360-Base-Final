-- =====================================================================
-- sql/21_business_flow_workbook.sql
-- Tables for the CP_Catalog_Business_Flows.xlsx (9-sheet) ingestion.
-- Dedicated bf_* tables hold the workbook as-authored, so the business-flow
-- connector is self-contained and does NOT disturb the existing pipeline
-- builder (data_pipelines / pipeline_members) or api_business_flows.
-- Idempotent guarded DDL (ORA-00955 safe).
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  -- Sheet 1: API_Business_Flows
  ddl('CREATE TABLE bf_api_flows (
        flow_id         VARCHAR2(120) NOT NULL,
        flow_name       VARCHAR2(300),
        business_domain VARCHAR2(120),
        goal            VARCHAR2(1000),
        trigger_event   VARCHAR2(200),
        primary_entity  VARCHAR2(120),
        source_swagger  VARCHAR2(300),
        notes           VARCHAR2(2000),
        project_id      VARCHAR2(40) DEFAULT ''sei'',
        CONSTRAINT pk_bf_api_flows PRIMARY KEY (flow_id))');

  -- Sheet 2: API_Flow_Steps
  ddl('CREATE TABLE bf_api_flow_steps (
        flow_id         VARCHAR2(120) NOT NULL,
        step_order      NUMBER,
        method          VARCHAR2(10),
        path            VARCHAR2(600),
        operation_id    VARCHAR2(200),
        produces_entity VARCHAR2(200),
        consumes_entity VARCHAR2(400),
        note            VARCHAR2(1000),
        CONSTRAINT pk_bf_api_flow_steps PRIMARY KEY (flow_id, step_order))');

  -- Sheet 3: Data_Pipelines
  ddl('CREATE TABLE bf_pipelines (
        pipeline_id        VARCHAR2(200) NOT NULL,
        pipeline_name      VARCHAR2(400),
        business_domain    VARCHAR2(120),
        archetype          VARCHAR2(40),
        direction          VARCHAR2(20),
        schedule           VARCHAR2(40),
        legacy_system      VARCHAR2(400),
        sei_target_type    VARCHAR2(40),
        sei_target_id      VARCHAR2(200),
        source_system      VARCHAR2(200),
        target_system      VARCHAR2(200),
        feed_routing       VARCHAR2(600),
        in_scope           VARCHAR2(20),
        goal               VARCHAR2(1000),
        owner              VARCHAR2(200),
        project_id         VARCHAR2(40) DEFAULT ''sei'',
        notes              VARCHAR2(2000),
        linked_api_flow_id VARCHAR2(120),
        associated_feeds   VARCHAR2(1000),
        feed_type          VARCHAR2(40),
        routing_pattern    VARCHAR2(80),   -- v20: Direct_Keep / Reroute / Consolidate etc.
        compressed_routing VARCHAR2(600),  -- v20: the new (target-state) routing
        compression_action VARCHAR2(2000), -- v20: the migration decision text
        notes_compression  VARCHAR2(2000), -- v20: compression rationale
        legacy_feed_routing VARCHAR2(600), -- v20: original routing (AddV->Pivotal), for reference
        CONSTRAINT pk_bf_pipelines PRIMARY KEY (pipeline_id))');

  -- Sheet 4: Pipeline_Stages
  ddl('CREATE TABLE bf_pipeline_stages (
        pipeline_id  VARCHAR2(200) NOT NULL,
        stage        VARCHAR2(40),
        stage_order  NUMBER,
        member_type  VARCHAR2(40),
        member_id    VARCHAR2(200),
        member_name  VARCHAR2(300),
        system       VARCHAR2(200),
        note         VARCHAR2(1000),
        CONSTRAINT pk_bf_pipeline_stages PRIMARY KEY (pipeline_id, stage_order))');

  -- Sheet 5: Interface_360
  ddl('CREATE TABLE bf_interfaces (
        interface_id      VARCHAR2(200) NOT NULL,
        application       VARCHAR2(200),
        integration       VARCHAR2(200),
        description        VARCHAR2(1000),
        legacy_system     VARCHAR2(200),
        sei_target_type   VARCHAR2(40),
        sei_target_id     VARCHAR2(200),
        migration_status  VARCHAR2(40),
        source_system     VARCHAR2(200),
        target_system     VARCHAR2(200),
        direction         VARCHAR2(20),
        direct_feed       VARCHAR2(10),
        feed_routing      VARCHAR2(600),
        schedule          VARCHAR2(40),
        frequency         VARCHAR2(80),
        extract_type      VARCHAR2(40),
        scope             VARCHAR2(40),
        owner             VARCHAR2(200),
        linked_pipeline_id VARCHAR2(200),
        project_id        VARCHAR2(40) DEFAULT ''sei'',
        CONSTRAINT pk_bf_interfaces PRIMARY KEY (interface_id))');

  -- Sheet 6: Flow_Datapoint_Map (resolved against dp_registry; resolved flag set by connector)
  ddl('CREATE TABLE bf_flow_datapoint_map (
        map_id              VARCHAR2(400) NOT NULL,
        flow_or_pipeline_id VARCHAR2(200),
        module              VARCHAR2(20),
        datapoint_normalized VARCHAR2(200),
        source_field        VARCHAR2(200),
        source_artifact     VARCHAR2(400),
        direction           VARCHAR2(20),
        note                VARCHAR2(1000),
        resolved            CHAR(1) DEFAULT ''N'',  -- Y if datapoint_normalized matched dp_registry
        CONSTRAINT pk_bf_fdm PRIMARY KEY (map_id))');

  -- Sheet 7 & 9: Compression_Plan
  ddl('CREATE TABLE bf_compression_plan (
        dbt_gold_mart       VARCHAR2(200) NOT NULL,
        api_flow_id         VARCHAR2(120),
        number_of_pipelines NUMBER,
        sample_pipeline_ids VARCHAR2(4000),
        dag_pattern         VARCHAR2(400),
        compression_ratio   VARCHAR2(200),
        notes               VARCHAR2(1000),
        CONSTRAINT pk_bf_compression PRIMARY KEY (dbt_gold_mart))');

  -- Sheet 8: Compression_Summary (key/value)
  ddl('CREATE TABLE bf_compression_summary (
        metric VARCHAR2(120) NOT NULL,
        value  VARCHAR2(2000),
        CONSTRAINT pk_bf_comp_summary PRIMARY KEY (metric))');

  -- indexes for common lookups
  ddl('CREATE INDEX ix_bf_pipe_domain ON bf_pipelines(business_domain)');
  ddl('CREATE INDEX ix_bf_pipe_archetype ON bf_pipelines(archetype)');
  ddl('CREATE INDEX ix_bf_pipe_linkapi ON bf_pipelines(linked_api_flow_id)');
  ddl('CREATE INDEX ix_bf_iface_target ON bf_interfaces(target_system)');
  ddl('CREATE INDEX ix_bf_fdm_dp ON bf_flow_datapoint_map(datapoint_normalized)');
  ddl('CREATE INDEX ix_bf_fdm_flow ON bf_flow_datapoint_map(flow_or_pipeline_id)');
END;
/

-- v20 columns: add to bf_pipelines if an earlier version created it without them.
-- Each ALTER is guarded (ORA-01430 = column already exists).
DECLARE
  PROCEDURE addcol(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
BEGIN
  addcol('ALTER TABLE bf_pipelines ADD routing_pattern VARCHAR2(80)');
  addcol('ALTER TABLE bf_pipelines ADD compressed_routing VARCHAR2(600)');
  addcol('ALTER TABLE bf_pipelines ADD compression_action VARCHAR2(2000)');
  addcol('ALTER TABLE bf_pipelines ADD notes_compression VARCHAR2(2000)');
  addcol('ALTER TABLE bf_pipelines ADD legacy_feed_routing VARCHAR2(600)');
END;
/

-- View joining pipelines to their compression mart (444 -> 37 picture)
CREATE OR REPLACE VIEW v_bf_pipeline_compression AS
SELECT p.pipeline_id, p.pipeline_name, p.business_domain, p.archetype,
       p.direction, p.schedule, p.legacy_system, p.sei_target_type,
       p.sei_target_id, p.linked_api_flow_id, p.feed_type,
       p.routing_pattern, p.compressed_routing, p.legacy_feed_routing,
       p.compression_action,
       c.dbt_gold_mart, c.number_of_pipelines AS mart_pipeline_count,
       c.compression_ratio
FROM bf_pipelines p
LEFT JOIN bf_compression_plan c ON c.api_flow_id = p.linked_api_flow_id;
