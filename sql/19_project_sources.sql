-- =====================================================================
-- sql/19_project_sources.sql
-- Project-extensible source registry. A new project = a new set of Excel
-- files + its own connector, registered here. Project is the PARENT of all
-- feeds/loaders/pipelines (project_id already first-class on every table).
-- Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  -- one row per (project, source) — what files a project has + which connector parses them
  ddl('CREATE TABLE project_sources (
        project_id    VARCHAR2(40),
        source_key    VARCHAR2(80),     -- inbound_feeds | loaders | dbt | airflow | api | ...
        source_label  VARCHAR2(200),
        connector     VARCHAR2(120),    -- python connector class that parses it
        path_env      VARCHAR2(120),    -- env var holding the file path
        direction     VARCHAR2(10),     -- inbound | outbound | null
        structure_note VARCHAR2(1000),  -- how this project''s structure differs
        is_active     CHAR(1) DEFAULT ''Y'',
        last_ingested TIMESTAMP,
        CONSTRAINT pk_project_sources PRIMARY KEY (project_id, source_key))');
END;
/

-- Seed SEI's sources (its known structures + connectors)
MERGE INTO project_sources t USING (
  SELECT 'sei' pid, 'inbound_feeds' sk, 'SWP EOD Inbound Feeds' lbl,
         'FeedDictionaryConnector' conn, 'DATA360_FEED_DICTIONARY_PATH' env,
         'inbound' dir, 'Contents sheet + per-feed sheets via HYPERLINK' note FROM dual UNION ALL
  SELECT 'sei', 'loaders', 'SEI Loaders Workbook', 'LoaderWorkbookConnector',
         'LOADER_WORKBOOK_XLSX', 'outbound', '10-sheet workbook (Loader_Catalog, Attributes, Validations, ...)' FROM dual UNION ALL
  SELECT 'sei', 'dbt', 'dbt models', 'DbtConnector', 'DBT_MANIFEST_PATH', NULL, 'manifest.json' FROM dual UNION ALL
  SELECT 'sei', 'airflow', 'Airflow DAGs', 'AirflowConnector', 'AIRFLOW_DSN', NULL, 'file or Postgres metastore' FROM dual UNION ALL
  SELECT 'sei', 'api', 'Swagger + Postman', 'Api360Connector', 'API_SPEC_ROOT', NULL, 'OpenAPI specs + Postman collections' FROM dual
) s ON (t.project_id = s.pid AND t.source_key = s.sk)
WHEN NOT MATCHED THEN INSERT (project_id, source_key, source_label, connector, path_env, direction, structure_note)
VALUES (s.pid, s.sk, s.lbl, s.conn, s.env, s.dir, s.note);
