-- =====================================================================
-- sql/25_impact_analysis.sql
-- Impact Analysis (schema drift + blast radius) and Auto Mapper.
-- Guarded, idempotent — safe to run repeatedly (ORA-955/942/1408 ignored).
--
-- Drift model:
--   schema_snapshots      one row per scan of a source (IMD / PBDW / FEED)
--   schema_snapshot_cols  column-level state captured by that scan
--   feed_file_specs       latest observed header spec per feed file
--   drift_findings        diffs vs previous snapshot, with severity,
--                         status workflow (NEW/ACK/RESOLVED) and NYDFS
--                         evidence tags.
-- Mapper model:
--   mapper_runs           one row per auto-map run (source file -> target)
--   mapper_results        per-field suggestion + confidence + verdict.
--   Committed mappings additionally land in column_lineage with
--   source='auto_mapper' so they appear in lineage views immediately.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -942, -1408) THEN RAISE; END IF;
  END;
BEGIN
  ddl('CREATE TABLE schema_snapshots (
    snapshot_id     VARCHAR2(60)  NOT NULL,
    source_kind     VARCHAR2(20)  NOT NULL,   -- IMD | PBDW | FEED
    schema_name     VARCHAR2(128),
    taken_at        TIMESTAMP DEFAULT SYSTIMESTAMP,
    col_count       NUMBER,
    trigger_by      VARCHAR2(40),             -- ingestion | api | manual
    CONSTRAINT pk_schema_snapshots PRIMARY KEY (snapshot_id))');

  ddl('CREATE TABLE schema_snapshot_cols (
    snapshot_id     VARCHAR2(60)  NOT NULL,
    schema_name     VARCHAR2(128) NOT NULL,
    object_name     VARCHAR2(256) NOT NULL,
    column_name     VARCHAR2(128) NOT NULL,
    position_order  NUMBER,
    data_type       VARCHAR2(128),
    max_length      NUMBER,
    precision       NUMBER,
    scale           NUMBER,
    nullable        CHAR(1),
    is_pii          CHAR(1) DEFAULT ''N'',
    CONSTRAINT pk_sscols PRIMARY KEY
      (snapshot_id, schema_name, object_name, column_name))');
  ddl('CREATE INDEX ix_sscols_obj ON schema_snapshot_cols(schema_name, object_name)');

  ddl('CREATE TABLE feed_file_specs (
    feed_id         VARCHAR2(200) NOT NULL,
    captured_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
    col_count       NUMBER,
    header_csv      CLOB,                     -- ordered header as CSV
    source_path     VARCHAR2(1000),
    CONSTRAINT pk_feed_file_specs PRIMARY KEY (feed_id))');

  ddl('CREATE TABLE drift_findings (
    finding_id      VARCHAR2(60)  NOT NULL,
    scan_id         VARCHAR2(60),
    severity        VARCHAR2(10),             -- HIGH | MED | LOW
    source_kind     VARCHAR2(20),             -- IMD | PBDW | FEED
    drift_kind      VARCHAR2(20),             -- WIDENED | NARROWED | RETYPED |
                                              -- NEW | DROPPED | FILE_SPEC
    object_key      VARCHAR2(650),            -- SCHEMA.TABLE.COLUMN or feed_id
    was_value       VARCHAR2(400),
    now_value       VARCHAR2(400),
    detail          CLOB,
    downstream_feeds   NUMBER DEFAULT 0,
    downstream_systems VARCHAR2(1000),        -- CSV of system names
    owners          VARCHAR2(1000),           -- CSV of routed owners
    status          VARCHAR2(12) DEFAULT ''NEW'',  -- NEW | ACK | RESOLVED | SUPPRESSED
    evidence_tag    VARCHAR2(60),             -- NYDFS-EV-nnnn
    found_at        TIMESTAMP DEFAULT SYSTIMESTAMP,
    resolved_at     TIMESTAMP,
    CONSTRAINT pk_drift_findings PRIMARY KEY (finding_id))');
  ddl('CREATE INDEX ix_drift_status ON drift_findings(status)');
  ddl('CREATE INDEX ix_drift_scan ON drift_findings(scan_id)');

  ddl('CREATE TABLE mapper_runs (
    run_id          VARCHAR2(60)  NOT NULL,
    source_name     VARCHAR2(400),            -- uploaded file name
    target_schema   VARCHAR2(128),            -- PBDW | IMD | ...
    field_count     NUMBER,
    mapped_count    NUMBER,
    accepted_count  NUMBER,
    threshold_note  VARCHAR2(200),
    created_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    created_by      VARCHAR2(128),
    CONSTRAINT pk_mapper_runs PRIMARY KEY (run_id))');

  ddl('CREATE TABLE mapper_results (
    run_id          VARCHAR2(60)  NOT NULL,
    field_name      VARCHAR2(256) NOT NULL,
    field_type      VARCHAR2(128),
    target_key      VARCHAR2(650),            -- SCHEMA.TABLE.COLUMN or NULL
    confidence      NUMBER,                   -- 0..1
    part_name       NUMBER, part_type NUMBER, -- score components 0..1
    part_embed      NUMBER, part_value NUMBER,
    rationale       CLOB,
    alternatives    CLOB,                     -- JSON array [{key, conf}]
    verdict         VARCHAR2(12),             -- ACC | REJ | NULL (pending)
    CONSTRAINT pk_mapper_results PRIMARY KEY (run_id, field_name))');
END;
/
