-- =====================================================================
-- sql/15_business_glossary.sql
-- Business / Semantic lineage layer. A glossary of business terms (AUC,
-- NAV, Cost Basis...) each mapped to the physical columns that compute
-- it. Derived from dbt metrics + descriptions + meta, with an authored
-- file filling gaps. Trace-down reuses existing column_lineage.
-- Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE business_glossary (
        term             VARCHAR2(200),
        label            VARCHAR2(400),
        definition       CLOB,
        business_domain  VARCHAR2(120),
        owner            VARCHAR2(200),
        regulatory_scope VARCHAR2(200),
        certified        CHAR(1) DEFAULT ''N'',
        metric_type      VARCHAR2(60),     -- simple|ratio|derived|cumulative (dbt)
        source           VARCHAR2(20),     -- dbt_metric|dbt_meta|dbt_desc|authored
        project_id       VARCHAR2(40),
        updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_business_glossary PRIMARY KEY (term))');

  ddl('CREATE TABLE term_column_map (
        term             VARCHAR2(200),
        dataset_key      VARCHAR2(520),
        column_name      VARCHAR2(200),
        mapping_source   VARCHAR2(20),     -- dbt_metric|dbt_meta|authored
        CONSTRAINT pk_term_column_map PRIMARY KEY (term, dataset_key, column_name))');
END;
/

-- View: term with its mapped columns + the gold model they live in
CREATE OR REPLACE VIEW v_business_glossary_360 AS
SELECT g.term, g.label, g.definition, g.business_domain, g.owner,
       g.regulatory_scope, g.certified, g.metric_type, g.source, g.project_id,
       m.dataset_key, m.column_name, m.mapping_source
FROM business_glossary g
LEFT JOIN term_column_map m ON m.term = g.term;
