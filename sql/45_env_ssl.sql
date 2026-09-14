-- SSL expiry tracking: declared (inventory) vs observed (TLS probe)
ALTER TABLE env_infra ADD (ssl_expiry DATE);
ALTER TABLE env_probe_result ADD (cert_not_after DATE);
-- Certificates page + alerting source
CREATE OR REPLACE VIEW v_env_ssl_status AS
SELECT i.env, i.layer, i.system_name, i.hosts, i.ssl_expiry AS declared_expiry,
       r.cert_not_after AS observed_expiry,
       TRUNC(NVL(r.cert_not_after, i.ssl_expiry) - SYSDATE) AS days_left,
       CASE WHEN NVL(r.cert_not_after, i.ssl_expiry) IS NULL THEN 'UNKNOWN'
            WHEN NVL(r.cert_not_after, i.ssl_expiry) - SYSDATE < 7  THEN 'CRITICAL'
            WHEN NVL(r.cert_not_after, i.ssl_expiry) - SYSDATE < 30 THEN 'WARNING'
            ELSE 'OK' END AS alert_level,
       CASE WHEN i.ssl_expiry IS NOT NULL AND r.cert_not_after IS NOT NULL
             AND TRUNC(i.ssl_expiry) <> TRUNC(r.cert_not_after)
            THEN 'DRIFT' END AS drift   -- sheet vs live cert disagree
FROM env_infra i
LEFT JOIN (SELECT p.env, p.probe_id, r2.cert_not_after,
                  ROW_NUMBER() OVER (PARTITION BY p.probe_id ORDER BY r2.run_ts DESC) rn
           FROM env_probe p JOIN env_probe_result r2 ON r2.probe_id = p.probe_id
           WHERE r2.cert_not_after IS NOT NULL) r
  ON r.env = i.env AND r.rn = 1
WHERE i.ssl_expiry IS NOT NULL OR i.protocol_port LIKE '%443%';
