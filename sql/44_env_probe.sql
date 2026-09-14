-- Probe registry: GENERATED from env_infra on every import (never hand-edited)
CREATE TABLE env_probe (
  probe_id     VARCHAR2(60) NOT NULL,     -- e.g. DEV.data.pbdw / DEV.path.hub-pbdw
  env          VARCHAR2(12) NOT NULL,
  kind         VARCHAR2(10) NOT NULL,     -- NODE / PATH
  check_type   VARCHAR2(12) NOT NULL,     -- TCP / SFTP / CIFS / HTTP / SQL / NONE
  target_host  VARCHAR2(200),
  target_port  NUMBER,
  state        VARCHAR2(10) NOT NULL,     -- ARMED / WAITING (port TBD) / DISABLED
  source_hash  VARCHAR2(64) NOT NULL,     -- env_infra row_hash that produced it
  generated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT pk_env_probe PRIMARY KEY (probe_id)
);
CREATE TABLE env_probe_result (
  probe_id   VARCHAR2(60) NOT NULL,
  run_ts     TIMESTAMP DEFAULT SYSTIMESTAMP,
  status     VARCHAR2(8) NOT NULL,        -- OK / WARN / DOWN / SKIP
  latency_ms NUMBER,
  detail     VARCHAR2(300)
);
CREATE INDEX ix_epr ON env_probe_result(probe_id, run_ts);
-- Env360 reads this: latest result per probe joined to registry state
CREATE OR REPLACE VIEW v_env_probe_live AS
SELECT p.probe_id, p.env, p.kind, p.check_type, p.state,
       r.status, r.latency_ms, r.run_ts, r.detail
FROM env_probe p
LEFT JOIN (SELECT probe_id, status, latency_ms, run_ts, detail,
                  ROW_NUMBER() OVER (PARTITION BY probe_id ORDER BY run_ts DESC) rn
           FROM env_probe_result) r
  ON r.probe_id = p.probe_id AND r.rn = 1;
