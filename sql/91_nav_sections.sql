-- ============================================================================
-- 91_nav_sections.sql
-- The left navigation was reorganised into six sections by what the user is
-- doing: Catalog, Lineage & Analysis, Build, Operate, Govern, Admin. The
-- Security Entitlement screen groups modules by sec_module.nav_group, so the
-- same names go there; module keys, grants and everything else are untouched.
-- Idempotent: an UPDATE by key, re-runnable. No data beyond section names.
-- ============================================================================
UPDATE sec_module SET nav_group = 'Catalog'            WHERE module_key IN ('interface','api','data','datapoint','event360','odi360');
UPDATE sec_module SET nav_group = 'Lineage & Analysis' WHERE module_key IN ('lineage','impact','variance','compare','mapper','dataanalysis');
UPDATE sec_module SET nav_group = 'Build'              WHERE module_key IN ('hub','integration360','system','devops360','release','codereview','designstatus');
UPDATE sec_module SET nav_group = 'Operate'            WHERE module_key IN ('guardrails','recon','pbnotify','apiconsole');
UPDATE sec_module SET nav_group = 'Govern'             WHERE module_key IN ('pii','cyber360','security');
UPDATE sec_module SET nav_group = 'Admin'              WHERE module_key IN ('datasources','apicatalog','environment');
UPDATE sec_module SET module_name = 'Integration 360 - Run'      WHERE module_key = 'guardrails'     AND module_name = 'Quality Guardrails';
UPDATE sec_module SET module_name = 'Historical Data Analysis'   WHERE module_key = 'dataanalysis'   AND module_name = 'Data Analysis';
COMMIT;
