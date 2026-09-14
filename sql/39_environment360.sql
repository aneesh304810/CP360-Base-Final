-- ============================================================================
-- 39_environment360.sql — Environment 360: certificates · health · topology
-- Idempotent (ORA-00955 guarded). Seeded with the CP estate; edit seeds freely
-- — the module is data-driven, adding a node/check/cert is an INSERT.
-- ============================================================================
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_certificates (
  cert_id      VARCHAR2(40) PRIMARY KEY,
  endpoint     VARCHAR2(300) NOT NULL,
  port         NUMBER DEFAULT 443,
  cn           VARCHAR2(300),
  issuer       VARCHAR2(300),
  expires_at   TIMESTAMP,
  used_by      VARCHAR2(300),
  group_key    VARCHAR2(120),
  ticket_url   VARCHAR2(500),
  owner        VARCHAR2(120),
  last_scanned TIMESTAMP,
  scan_error   VARCHAR2(400)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_health_checks (
  check_id   VARCHAR2(40) PRIMARY KEY,
  env_group  VARCHAR2(80) NOT NULL,
  name       VARCHAR2(200) NOT NULL,
  kind       VARCHAR2(10) NOT NULL,       -- DNS | TLS | HTTP | SQL | FS
  target     VARCHAR2(500) NOT NULL,
  verifies   VARCHAR2(300),
  params     VARCHAR2(2000),              -- JSON: sql, warn_gt, warn_ms, expect
  order_no   NUMBER DEFAULT 100,
  enabled    CHAR(1) DEFAULT ''Y''
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_check_results (
  result_id  VARCHAR2(40) PRIMARY KEY,
  check_id   VARCHAR2(40) NOT NULL,
  run_id     VARCHAR2(40),
  checked_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  status     VARCHAR2(10),                -- OK | WARN | FAIL | SKIP
  latency_ms NUMBER,
  detail     VARCHAR2(500)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_pulse_runs (
  run_id       VARCHAR2(40) PRIMARY KEY,
  started_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
  finished_at  TIMESTAMP,
  total_n      NUMBER, ok_n NUMBER, warn_n NUMBER, fail_n NUMBER,
  triggered_by VARCHAR2(80)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_nodes (
  node_id  VARCHAR2(40) PRIMARY KEY,
  label    VARCHAR2(120) NOT NULL,
  icon     VARCHAR2(10),
  zone     VARCHAR2(40),
  sub      VARCHAR2(200),
  x        NUMBER, y NUMBER,
  check_id VARCHAR2(40)                   -- health dot source (nullable)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_links (
  link_id   VARCHAR2(40) PRIMARY KEY,
  from_node VARCHAR2(40) NOT NULL,
  to_node   VARCHAR2(40) NOT NULL,
  cert_id   VARCHAR2(40),                 -- TLS badge on this hop (nullable)
  check_id  VARCHAR2(40)                  -- link color source (nullable)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
-- ---------------- seeds (MERGE = rerun-safe) ----------------
MERGE INTO env_certificates c USING (SELECT 'C1' i FROM dual) s ON (c.cert_id=s.i)
WHEN NOT MATCHED THEN INSERT (cert_id,endpoint,port,used_by,group_key,owner) VALUES
 ('C1','cp-catalog-opendatahub.apps.ocpq.testbbh.com',443,'CP 360 UI route','ocpq-wildcard','OpenShift platform');
MERGE INTO env_certificates c USING (SELECT 'C2' i FROM dual) s ON (c.cert_id=s.i)
WHEN NOT MATCHED THEN INSERT (cert_id,endpoint,port,used_by,group_key,owner) VALUES
 ('C2','cp-airflow.apps.ocpq.testbbh.com',443,'Airflow webserver','ocpq-wildcard','OpenShift platform');
MERGE INTO env_certificates c USING (SELECT 'C3' i FROM dual) s ON (c.cert_id=s.i)
WHEN NOT MATCHED THEN INSERT (cert_id,endpoint,port,used_by,owner) VALUES
 ('C3','api-qa.seic.com',443,'API Console · SEI QA env','SEI');
MERGE INTO env_certificates c USING (SELECT 'C4' i FROM dual) s ON (c.cert_id=s.i)
WHEN NOT MATCHED THEN INSERT (cert_id,endpoint,port,used_by,owner) VALUES
 ('C4','jenkins.testbbh.com',443,'CI pipelines','Infra');
MERGE INTO env_certificates c USING (SELECT 'C5' i FROM dual) s ON (c.cert_id=s.i)
WHEN NOT MATCHED THEN INSERT (cert_id,endpoint,port,used_by,owner) VALUES
 ('C5','nexus.testbbh.com',443,'air-gap pip/npm mirror','Infra');
MERGE INTO env_health_checks h USING (SELECT 'H01' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no) VALUES
 ('H01','OpenShift · OCPQ','DNS · apps wildcard','DNS','cp-catalog-opendatahub.apps.ocpq.testbbh.com','name resolves',10);
MERGE INTO env_health_checks h USING (SELECT 'H02' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no) VALUES
 ('H02','OpenShift · OCPQ','TLS · CP 360 route','TLS','cp-catalog-opendatahub.apps.ocpq.testbbh.com:443','handshake + chain + expiry',20);
MERGE INTO env_health_checks h USING (SELECT 'H03' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H03','OpenShift · OCPQ','HTTP · CP 360 /healthz','HTTP','https://cp-catalog-opendatahub.apps.ocpq.testbbh.com/healthz','route + pod + FastAPI up','{"expect":200,"warn_ms":1000}',30);
MERGE INTO env_health_checks h USING (SELECT 'H04' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H04','Oracle','SELECT 1 · dvlpbdb1/pbdwhdbt','SQL','CP_CATALOG_DB_DSN','connect as A041327 · thick mode','{"sql":"SELECT 1 FROM dual","warn_ms":500}',40);
MERGE INTO env_health_checks h USING (SELECT 'H05' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H05','Oracle','SILVER session headroom','SQL','CP_CATALOG_DB_DSN','sessions under 80% of cap','{"sql":"SELECT COUNT(*) FROM v$session WHERE username=''A041327''","warn_gt":96}',50);
MERGE INTO env_health_checks h USING (SELECT 'H06' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H06','OpenShift · OCPQ','WebFS · CIFS write probe','FS','CP_CATALOG_ROOT','write+read a probe file','{"warn_ms":1500}',60);
MERGE INTO env_health_checks h USING (SELECT 'H07' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H07','OpenShift · OCPQ','nightly api360 scan freshness','SQL','CP_CATALOG_DB_DSN','scan ran < 26h ago','{"sql":"SELECT NVL(ROUND((CAST(SYSTIMESTAMP AS DATE)-CAST(MAX(last_scanned) AS DATE))*24),999) FROM api_sources","warn_gt":26}',70);
MERGE INTO env_health_checks h USING (SELECT 'H08' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H08','Integration','TLS · SEI QA','TLS','api-qa.seic.com:443','vendor cert expiry',80);
MERGE INTO env_health_checks h USING (SELECT 'H09' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,params,order_no) VALUES
 ('H09','Integration','HTTP · Jenkins reachable','HTTP','https://jenkins.testbbh.com/login','CI up','{"expect":200,"warn_ms":1500}',90);
COMMIT;
