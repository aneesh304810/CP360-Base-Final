-- 48: workload-grained inventory (v5). ENV_WORKLOAD = one row per monitorable
-- unit. env_infra remains as the system-level aggregate every UI contract
-- reads (unchanged); env_infra_host is superseded and dropped.
BEGIN
  EXECUTE IMMEDIATE '
  CREATE TABLE env_workload (
    env            VARCHAR2(12)  NOT NULL,
    system_name    VARCHAR2(60)  NOT NULL,
    workload_key   VARCHAR2(120) NOT NULL,   -- workload_name or host/endpoint
    namespace      VARCHAR2(80),
    workload_name  VARCHAR2(80),
    workload_type  VARCHAR2(30),
    host           VARCHAR2(240),
    zone           VARCHAR2(20),
    component      VARCHAR2(40),
    hosting        VARCHAR2(40),
    direction      VARCHAR2(20),
    protocol_port  VARCHAR2(60),
    endpoint_url   VARCHAR2(300),
    hc_type        VARCHAR2(30),             -- Health_Check_Type -> probe kind
    hc_target      VARCHAR2(240),
    ssl_target     VARCHAR2(240),
    sizing_ram     VARCHAR2(30),
    sizing_cpu     VARCHAR2(30),
    sizing_storage VARCHAR2(60),
    growth         VARCHAR2(30),
    notes          VARCHAR2(400),
    ssl_expiry     DATE,
    project        VARCHAR2(20),
    collection_instruction VARCHAR2(600),
    CONSTRAINT pk_env_workload PRIMARY KEY (env, system_name, workload_key)
  )';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
-- superseded by env_workload (per-host split now lives there)
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE env_infra_host PURGE';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;
/
