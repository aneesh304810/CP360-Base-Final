-- =====================================================================
-- sql/20_search_index.sql
-- Unified full-text search index. One row per searchable artifact across
-- ALL modules; one Oracle Text (CTXSYS.CONTEXT) index over body_text.
-- /search becomes a single ranked CONTAINS query. Assumes CTXAPP granted.
-- Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442) THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE search_index (
        artifact_key   VARCHAR2(400)  NOT NULL,  -- unique id: kind:natural_key
        module         VARCHAR2(20),             -- api|data|datapoint|interface|loader|pii
        kind           VARCHAR2(30),             -- dataset|field|feed|loader|api|...
        name           VARCHAR2(512),            -- display name (also weighted in body)
        body_text      CLOB,                     -- name + description + synonyms (indexed)
        subtitle       VARCHAR2(1000),           -- context line for the result row
        project_id     VARCHAR2(40),
        is_pii         CHAR(1) DEFAULT ''N'',
        nav_module     VARCHAR2(20),
        nav_tab        VARCHAR2(60),
        nav_id         VARCHAR2(400),
        nav_extra      VARCHAR2(400),
        updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_search_index PRIMARY KEY (artifact_key))');
END;
/

-- Oracle Text index over body_text. SYNC (ON COMMIT) keeps it current as rows
-- are merged; the ingestion sync step also runs an explicit SYNC + OPTIMIZE.
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM user_indexes WHERE index_name = 'IX_SEARCH_BODY';
  IF n = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_search_body ON search_index(body_text) '
      || 'INDEXTYPE IS CTXSYS.CONTEXT PARAMETERS (''SYNC (ON COMMIT)'')';
  END IF;
EXCEPTION WHEN OTHERS THEN
  DBMS_OUTPUT.PUT_LINE('ix_search_body skipped (CTXAPP?): ' || SQLERRM);
END;
/

-- helper: regular b-tree indexes for filtering by module/project
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE INDEX ix_search_module ON search_index(module)');
  ddl('CREATE INDEX ix_search_project ON search_index(project_id)');
END;
/
