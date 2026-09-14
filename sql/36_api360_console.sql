-- ============================================================================
-- 36_api360_console.sql — API 360 Console store (SILVER). Idempotent.
-- Secrets are references (env:VAR / enc:...), same discipline as datasources.
-- ============================================================================
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_environments (
      env_id      VARCHAR2(40) PRIMARY KEY,
      name        VARCHAR2(80) NOT NULL,
      base_note   VARCHAR2(200),
      created_at  TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_env_vars (
      env_id      VARCHAR2(40),
      var_name    VARCHAR2(80),
      var_value   VARCHAR2(2000),      -- plain value OR env:/enc: ref
      var_kind    VARCHAR2(10) DEFAULT ''PLAIN'',  -- PLAIN|SECRET|MANAGED
      CONSTRAINT pk_api_env_vars PRIMARY KEY (env_id, var_name)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_contracts (
      contract_id  VARCHAR2(40) PRIMARY KEY,
      api_name     VARCHAR2(120),
      version      VARCHAR2(20),
      status       VARCHAR2(20) DEFAULT ''CURRENT'', -- CURRENT|DRIFT|STALE
      spec_json    CLOB,                -- OpenAPI/Swagger document
      ingested_at  TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_collections (
      coll_id     VARCHAR2(40) PRIMARY KEY,
      name        VARCHAR2(120),
      source      VARCHAR2(12) DEFAULT ''MANUAL'',  -- AUTO|POSTMAN|MANUAL
      contract_id VARCHAR2(40),
      shared      CHAR(1) DEFAULT ''Y'',
      created_at  TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_requests (
      req_id      VARCHAR2(40) PRIMARY KEY,
      coll_id     VARCHAR2(40),
      folder      VARCHAR2(120),
      name        VARCHAR2(200),
      method      VARCHAR2(10),
      url_tmpl    VARCHAR2(1000),      -- {{var}} placeholders allowed
      params_json VARCHAR2(4000),
      headers_json VARCHAR2(4000),
      body_tmpl   CLOB,
      tests_json  VARCHAR2(4000),
      sort_order  NUMBER DEFAULT 0
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_history (
      hist_id     VARCHAR2(40) PRIMARY KEY,
      env_id      VARCHAR2(40),
      req_id      VARCHAR2(40),
      method      VARCHAR2(10),
      url_final   VARCHAR2(1000),      -- variables resolved, secrets NOT
      status_code NUMBER,
      elapsed_ms  NUMBER,
      resp_bytes  NUMBER,
      schema_ok   CHAR(1),
      tests_json  VARCHAR2(4000),      -- results
      ran_by      VARCHAR2(60),
      ran_at      TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_flows (
      flow_id     VARCHAR2(40) PRIMARY KEY,
      name        VARCHAR2(160),
      description VARCHAR2(400),
      tile_icon   VARCHAR2(8),
      inputs_json VARCHAR2(4000),      -- [{name,label,example}]
      steps_json  CLOB,                -- [{name,req_id|method+url,params,extract}]
      published   CHAR(1) DEFAULT ''N'',
      created_by  VARCHAR2(60),
      created_at  TIMESTAMP DEFAULT SYSTIMESTAMP,
      updated_at  TIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_flow_runs (
      flowrun_id  VARCHAR2(40) PRIMARY KEY,
      flow_id     VARCHAR2(40),
      env_id      VARCHAR2(40),
      status      VARCHAR2(12),        -- COMPLETE|FAILED
      steps_json  CLOB,                -- per-step status + extracted values
      ran_by      VARCHAR2(60),
      ran_at      TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_coll_runs (
      collrun_id  VARCHAR2(40) PRIMARY KEY,
      coll_id     VARCHAR2(40),
      env_id      VARCHAR2(40),
      status      VARCHAR2(12),
      total_reqs  NUMBER,
      passed      NUMBER,
      results_json CLOB,
      ran_at      TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
-- provider system dimension (SEI / ADDVANTAGE / CRD / STAR / PLAID / ...)
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_contracts ADD (provider_system VARCHAR2(30) DEFAULT ''SEI'')';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_collections ADD (provider_system VARCHAR2(30))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_environments ADD (provider_system VARCHAR2(30))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
-- provider systems registry: chips + onboarding are data, not code
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_systems (
      system_code  VARCHAR2(30) PRIMARY KEY,
      display_name VARCHAR2(80),
      parent_class VARCHAR2(10) DEFAULT ''NON-SEI'',  -- SEI | NON-SEI
      status       VARCHAR2(12) DEFAULT ''PLANNED'',  -- PLANNED|ONBOARDED
      auth_hint    VARCHAR2(40),        -- OAUTH2 | APIKEY | BASIC | MTLS
      owner        VARCHAR2(80),
      notes        VARCHAR2(400),
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
DECLARE n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM api_systems;
  IF n = 0 THEN
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status, auth_hint) VALUES
      ('SEI', 'SEI Wealth Platform', 'SEI', 'ONBOARDED', 'OAUTH2');
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status, auth_hint) VALUES
      ('INTERNAL', 'CP Integration Hub', 'NON-SEI', 'ONBOARDED', 'OAUTH2');
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status) VALUES ('ADDVANTAGE', 'FIS AddVantage', 'NON-SEI', 'PLANNED');
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status) VALUES ('CRD', 'Charles River (CRD)', 'NON-SEI', 'PLANNED');
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status) VALUES ('STAR', 'STAR Valuations', 'NON-SEI', 'PLANNED');
    INSERT INTO api_systems (system_code, display_name, parent_class,
      status) VALUES ('PLAID', 'Plaid Open Banking', 'NON-SEI', 'PLANNED');
    COMMIT;
  END IF;
END;
/
-- ============== build round: scheduling, drift ack, lifecycle, decodes ======
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_collections ADD (schedule_tag VARCHAR2(30))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_contracts ADD (drift_ack_by VARCHAR2(60), drift_ack_at TIMESTAMP)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE
  'ALTER TABLE api_environments ADD (enabled CHAR(1) DEFAULT ''Y'')';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_code_decodes (
      decode_set  VARCHAR2(40),
      code        VARCHAR2(40),
      meaning     VARCHAR2(200),
      CONSTRAINT pk_api_code_decodes PRIMARY KEY (decode_set, code)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
DECLARE n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM api_code_decodes;
  IF n = 0 THEN
    INSERT INTO api_code_decodes VALUES ('RESTRICTION_CODES','700','Fund Substitution');
    INSERT INTO api_code_decodes VALUES ('RESTRICTION_CODES','450','No Tobacco');
    INSERT INTO api_code_decodes VALUES ('RESTRICTION_CODES','575','ESG Screen');
    COMMIT;
  END IF;
END;
/
