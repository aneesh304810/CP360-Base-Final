-- =====================================================================
-- sql/14_business_flows.sql
-- Auto-generated business flows for API 360 with a BA override layer.
-- A "business flow" = an ordered sequence of endpoints that together
-- accomplish a function (e.g. Daily Position Reconciliation).
-- Generated from the Depends-on / produces dependency chains; the BA
-- can rename / curate without losing the generated structure.
-- Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  -- The generated/curated business flow header
  ddl('CREATE TABLE api_business_flows (
        flow_id          VARCHAR2(120),
        generated_name   VARCHAR2(400),   -- name the generator assigned
        business_name    VARCHAR2(400),   -- BA override; NULL until edited
        goal             VARCHAR2(2000),  -- BA-editable description
        persona          VARCHAR2(200),   -- BA-editable audience
        domain           VARCHAR2(120),   -- primary domain
        project_id       VARCHAR2(40),
        origin           VARCHAR2(20) DEFAULT ''generated'',  -- generated|curated
        step_count       NUMBER,
        is_published     CHAR(1) DEFAULT ''Y'',  -- BA can hide a generated flow
        created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_api_business_flows PRIMARY KEY (flow_id))');

  -- Ordered steps; endpoint_key joins to api_endpoints for live metadata
  ddl('CREATE TABLE api_business_flow_steps (
        flow_id          VARCHAR2(120),
        step_order       NUMBER,
        endpoint_key     VARCHAR2(520),   -- FK-ish to api_endpoints
        produces_entity  VARCHAR2(200),   -- what this step yields downstream
        consumes_entity  VARCHAR2(400),   -- what it needed (comma list)
        note             VARCHAR2(2000),  -- BA-editable per-step purpose
        CONSTRAINT pk_api_bflow_steps PRIMARY KEY (flow_id, step_order))');
END;
/

-- View that resolves the effective name (BA override wins) + endpoint metadata
CREATE OR REPLACE VIEW v_api_business_flow_360 AS
SELECT f.flow_id,
       NVL(f.business_name, f.generated_name) AS display_name,
       f.generated_name, f.business_name, f.goal, f.persona,
       f.domain, f.project_id, f.origin, f.step_count, f.is_published,
       s.step_order, s.endpoint_key, s.produces_entity, s.consumes_entity, s.note,
       e.method, e.path, e.operation_id, e.summary AS endpoint_summary,
       e.function_point_id, e.feature_group
FROM api_business_flows f
LEFT JOIN api_business_flow_steps s ON s.flow_id = f.flow_id
LEFT JOIN api_endpoints e ON e.endpoint_key = s.endpoint_key;
