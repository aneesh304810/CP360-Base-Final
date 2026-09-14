-- Environment 360 · infrastructure inventory (spreadsheet-of-record)
CREATE TABLE env_infra (
  env           VARCHAR2(12)  NOT NULL,   -- DEV / SIT / TRIAL_UAT / PROD
  layer         VARCHAR2(20)  NOT NULL,   -- Platform / File System / Database / Consumer / External API / External SFTP
  system_name   VARCHAR2(40)  NOT NULL,
  hosts         VARCHAR2(800),
  sizing_ram    VARCHAR2(20),
  sizing_cpu    VARCHAR2(20),
  sizing_storage VARCHAR2(60),
  growth        VARCHAR2(30),
  hosting       VARCHAR2(30),
  direction     VARCHAR2(15),
  protocol_port VARCHAR2(40),
  notes         VARCHAR2(400),
  row_hash      VARCHAR2(64) NOT NULL,
  updated_at    TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_by    VARCHAR2(60) DEFAULT 'ingestion',
  CONSTRAINT pk_env_infra PRIMARY KEY (env, layer, system_name)
);
CREATE TABLE env_infra_hist (
  hist_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  env VARCHAR2(12), layer VARCHAR2(20), system_name VARCHAR2(40),
  row_hash VARCHAR2(64), change_kind VARCHAR2(10),  -- ADDED/CHANGED/REMOVED
  snapshot_json CLOB CHECK (snapshot_json IS JSON),
  changed_at TIMESTAMP DEFAULT SYSTIMESTAMP, changed_by VARCHAR2(60)
);
-- the network-team ask list, as a view
CREATE OR REPLACE VIEW v_env_infra_tbd AS
SELECT env, layer, system_name, protocol_port, notes
FROM env_infra
WHERE UPPER(NVL(protocol_port,'TBD')) LIKE '%TBD%'
   OR UPPER(NVL(notes,'')) LIKE '%TBD%';
