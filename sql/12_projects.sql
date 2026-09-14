-- Project registry + seed
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE projects (
      project_id   VARCHAR2(40) NOT NULL,
      display_name VARCHAR2(120),
      category     VARCHAR2(20),
      vendor       VARCHAR2(120),
      description  VARCHAR2(1000),
      owner        VARCHAR2(128),
      color_hex    VARCHAR2(10),
      is_active    CHAR(1) DEFAULT ''Y'',
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
      updated_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_projects PRIMARY KEY (project_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/

MERGE INTO projects t USING (
  SELECT 'sei' pid, 'SEI Wealth Platform' nm, 'SEI' cat, 'SEI Investments' ven, '#0091bf' col FROM dual UNION ALL
  SELECT 'bloomberg', 'Bloomberg', 'Non-SEI', 'Bloomberg L.P.', '#000000' FROM dual UNION ALL
  SELECT 'pivotal', 'Pivotal CRM/SalesX', 'Non-SEI', 'In-House', '#7c3aed' FROM dual UNION ALL
  SELECT 'addvantage', 'AddVantage', 'Non-SEI', '3rd Party', '#ea580c' FROM dual UNION ALL
  SELECT 'charles_river', 'Charles River', 'Non-SEI', 'State Street', '#2563eb' FROM dual UNION ALL
  SELECT 'internal', 'Internal / In-House', 'Non-SEI', 'BBH', '#0f4775' FROM dual UNION ALL
  SELECT 'other', 'Other', 'Non-SEI', '-', '#999999' FROM dual
) s ON (t.project_id = s.pid)
WHEN MATCHED THEN UPDATE SET t.display_name = s.nm, t.category = s.cat,
  t.vendor = s.ven, t.color_hex = s.col, t.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (project_id, display_name, category, vendor, color_hex)
  VALUES (s.pid, s.nm, s.cat, s.ven, s.col);
COMMIT;
