-- ============================================================
-- 40 · Environment 360 — SEI build-out inventory
-- Grain: one row per (platform, region, host-pair). Source: the
-- SWP environment provisioning tracker (RITMs). Re-runnable.
-- Plus: DNS liveness checks for every NEW SEI host, so the pulse
-- can PROVE what the tracker CLAIMS ("Completed" vs resolves).
-- ============================================================
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE env_inventory (
  inv_id      VARCHAR2(40) PRIMARY KEY,
  platform    VARCHAR2(120) NOT NULL,
  ritm        VARCHAR2(400),
  region      VARCHAR2(20)  NOT NULL,     -- DEV | SIT | UAT | PROD
  existing_host VARCHAR2(400),
  new_host    VARCHAR2(400),              -- NULL = not required / repurposed
  db_name     VARCHAR2(120),
  sizing      VARCHAR2(300),
  status      VARCHAR2(30),               -- In Progress | Completed
  os          VARCHAR2(20),
  priority    VARCHAR2(20),
  target_delivery DATE,
  target_build    VARCHAR2(120),
  note        VARCHAR2(2000),
  load_ts     TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/

-- ---------- Private Banking Data Warehouse ----------
MERGE INTO env_inventory t USING (SELECT 'PBDW-DEV' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PBDW-DEV','Private Banking Data Warehouse','RITM0682586-870','DEV',
 'dvlpbdb1.testbbh.com / rtlodiapp3t.testbbh.com',NULL,NULL,
 'repurpose existing infrastructure','In Progress','RHEL','Critical',
 DATE '2026-05-28','DB 6/9 · AppServer TBD',
 'Server provisioning + Illumio done; all servers in backup schedule')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'PBDW-SIT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PBDW-SIT','Private Banking Data Warehouse','RITM0682588','SIT',
 'qclpbdb1.testbbh.com / qclodiapp3q.testbbh.com',
 'qalpbdb3.testbbh.com / qalodiapp3sei.testbbh.com / qalodidb3sei.testbbh.com',
 'PBODIQA','RAM 62GB · 4TB · 8 CPU · minimal growth','In Progress','RHEL','Critical',
 DATE '2026-05-28','DB 6/9',
 'ODI repo created + copied from PROD; ODI agent installed; DB copied unmasked')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'PBDW-UAT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PBDW-UAT','Private Banking Data Warehouse','RITM0682589','UAT',
 'qclpbdb1.testbbh.com / qclodiapp3q.testbbh.com',
 'qclpbdb3.testbbh.com / qclodiapp3sei.testbbh.com / qclodidb3sei.testbbh.com',
 'PBODIQC','RAM 62GB · 4TB · 8 CPU · minimal growth','In Progress','RHEL','Critical',
 DATE '2026-05-28','DB 6/9',
 'ODI repo created + copied from PROD; ODI agent installed; DB copied unmasked')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'PBDW-PROD' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PBDW-PROD','Private Banking Data Warehouse',NULL,'PROD',
 'njlpbdb1.bbh.com (PB DW) / njlodiapp3p.bbh.com (ODI Studio)',NULL,NULL,
 'not required','n/a','RHEL','Critical',NULL,NULL,'new infrastructure not required')
WHEN MATCHED THEN UPDATE SET t.region='PROD';

-- ---------- Investment Management Data Store ----------
MERGE INTO env_inventory t USING (SELECT 'IMDS-DEV' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('IMDS-DEV','Investment Management Data Store','RITM0686013/30','DEV',
 'rdlimdsdb.testbbh.com (IMDSDBT) / rdlimdsapp.testbbh.com',
 'dvlimdsdb.testbbh.com / dvlimdsapp.testbbh.com','IMDSDBLA',
 'RAM 62GB · 6TB · 8 CPU · minimal growth','Completed','RHEL','Critical',
 DATE '2026-06-01','7/20/2026','storage allocated; data copied from PROD; app servers ready')
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'IMDS-SIT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('IMDS-SIT','Investment Management Data Store','RITM0686025/33','SIT',
 'qclimdsdb.testbbh.com (IMDSDBQ) / qclimdsapp.testbbh.com',
 'qblimdsdb.testbbh.com / qblimdsapp.testbbh.com','IMDSDBLB',
 'RAM 62GB · 6TB · 8 CPU · minimal growth','Completed','RHEL','Critical',
 DATE '2026-06-01','7/20/2026','storage allocated; AccessIT release requests in flight')
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'IMDS-UAT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('IMDS-UAT','Investment Management Data Store',NULL,'UAT',
 'rdlimdsdb.testbbh.com (IMDSDBU) / rdlimdsapp.testbbh.com',
 '(SIT new infrastructure becomes Trial/UAT)',NULL,NULL,'Completed','RHEL','Critical',
 NULL,NULL,'SIT new-infra environment will serve as Trial/UAT')
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'IMDS-PROD' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('IMDS-PROD','Investment Management Data Store',NULL,'PROD',
 'njlimdsdb.bbh.com (IMDSDBP) / njlimdsapp.bbh.com',NULL,NULL,'not required','n/a',
 'RHEL','Critical',NULL,NULL,'new infrastructure not required')
WHEN MATCHED THEN UPDATE SET t.region='PROD';

-- ---------- Pivotal (CRM) ----------
MERGE INTO env_inventory t USING (SELECT 'PIV-DEV' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PIV-DEV','Pivotal','RITM0688299-317','DEV',
 'QCWPIVDEV4 / QCWPIVDEV5 / QCWPIVDEV2',
 'QCWPIVDEVSEI4 / QCWPIVDEVSEI5 / QCWPIVDEVSEI2','n/a',
 'RAM 24GB · C:100GB D:350GB · 4 CPU','Completed','Windows','High',
 DATE '2026-05-13','7/20 · 11 builds done 7/24','MS Office licensing approved')
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'PIV-SIT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PIV-SIT','Pivotal',NULL,'SIT',
 'QCWPIVAPPMTR / QCWPIVDB6 / qcwpivint1',
 'QCWPIVAPMTRSEI / QCWPIVSEIDB6 / QCWPIVINTSEI1','n/a',
 'RAM 16GB · C:100GB D:250GB · 4 CPU','Completed','Windows','High',
 DATE '2026-05-13','7/20/2026',NULL)
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'PIV-UAT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PIV-UAT','Pivotal',NULL,'UAT',
 'QCWPIVAPPUPG1 / QCWPIVAPPUPG2 / QCWPIVDB4 / QCWPIVDB5 / qcwpivint2',
 'QCWPIVAUPGSEI1 / QCWPIVAUPGSEI2 / QCWPIVSEIDB4 / QCWPIVSEIDB5 / QCWPIVINTSEI2','n/a',
 'RAM 16GB · C:100GB D:250GB · 4 CPU','Completed','Windows','High',
 DATE '2026-05-13','7/20/2026',NULL)
WHEN MATCHED THEN UPDATE SET t.status='Completed';

MERGE INTO env_inventory t USING (SELECT 'PIV-PROD' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PIV-PROD','Pivotal',NULL,'PROD',
 'NJWPIVCRMINT / CRMMKT / CRM1 / CRM2 / CRMUX1 / CRMDB2 (bbh.com)',NULL,'n/a',
 'not required','n/a','Windows','High',NULL,NULL,'new infrastructure not required')
WHEN MATCHED THEN UPDATE SET t.region='PROD';

-- ---------- CRD (vendor · Azure) ----------
MERGE INTO env_inventory t USING (SELECT 'CRD-ALL' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('CRD-ALL','CRD (Charles River)',NULL,'SIT',
 'existing vendor application on Azure cloud','new CRD test environments (vendor-hosted)','n/a',
 'connectivity setup + SOW (200K)','In Progress','Azure','High',
 DATE '2026-07-10','8/7/2026',
 '8/7: environments set up per vendor; PROD restore week of 8/10 (1-2 days) then test config')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

-- ---------- Client Portal ----------
MERGE INTO env_inventory t USING (SELECT 'CPORT-DEV' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('CPORT-DEV','Client Portal','RITM0706498','DEV','dvtasap12.testbbh.com',
 'dvltasap235.testbbh.com','n/a','RAM 12GB · 2 CPU · 350GB','In Progress','RHEL','High',
 DATE '2026-06-29','8/21/2026','test servers provisioned; app test regions in progress')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'CPORT-SIT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('CPORT-SIT','Client Portal','RITM0706496','SIT','rdtasap12.testbbh.com',
 'rdltasap235.testbbh.com','n/a','RAM 12GB · 2 CPU · 350GB','In Progress','RHEL','High',
 DATE '2026-06-29','8/21/2026',NULL)
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'CPORT-UAT' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('CPORT-UAT','Client Portal','RITM0706497','UAT',
 'qctasap12.testbbh.com / qctas2ap12.testbbh.com','qcltasap235.testbbh.com','n/a',
 'RAM 12GB · 2 CPU · 350GB','In Progress','RHEL','High',
 DATE '2026-06-29','8/21/2026',NULL)
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

MERGE INTO env_inventory t USING (SELECT 'CPORT-PROD' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('CPORT-PROD','Client Portal',NULL,'PROD',
 'njtasap12 / njtas2ap12 / njtas3ap12 / njtas4ap12 (bbh.com)',NULL,'n/a',
 'not required','n/a','RHEL','High',NULL,NULL,'new infrastructure not required')
WHEN MATCHED THEN UPDATE SET t.region='PROD';

-- ---------- PORT (Bloomberg) ----------
MERGE INTO env_inventory t USING (SELECT 'PORT-TEST' i FROM dual) s ON (t.inv_id=s.i)
WHEN NOT MATCHED THEN INSERT (inv_id,platform,ritm,region,existing_host,new_host,db_name,sizing,status,os,priority,target_delivery,target_build,note)
VALUES ('PORT-TEST','PORT (Bloomberg)',NULL,'SIT','n/a (vendor-hosted)',
 'new PORT test instance (reconfigured per phase)','n/a',
 '25 accounts · 3000 securities (below prod limits - careful test-account selection)',
 'In Progress','Vendor','High',DATE '2026-06-30',NULL,
 '8/6: BBG root cause = same admin user in prod+test; fix = separate limited test user (no charge while test contract active); availability TBD')
WHEN MATCHED THEN UPDATE SET t.status='In Progress';

-- ============================================================
-- DNS liveness checks for the NEW SEI hosts (pulse proves the tracker)
-- ============================================================
MERGE INTO env_health_checks h USING (SELECT 'H20' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H20','SEI Build-out · PBDW','DNS · qalpbdb3 (SIT DB)','DNS','qalpbdb3.testbbh.com','PBDW SIT new DB resolves',60);
MERGE INTO env_health_checks h USING (SELECT 'H21' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H21','SEI Build-out · PBDW','DNS · qalodidb3sei (SIT ODI repo)','DNS','qalodidb3sei.testbbh.com','ODI SIT repo host resolves',61);
MERGE INTO env_health_checks h USING (SELECT 'H22' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H22','SEI Build-out · PBDW','DNS · qalodiapp3sei (SIT ODI agent)','DNS','qalodiapp3sei.testbbh.com','ODI SIT agent host resolves',62);
MERGE INTO env_health_checks h USING (SELECT 'H23' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H23','SEI Build-out · PBDW','DNS · qclpbdb3 (UAT DB)','DNS','qclpbdb3.testbbh.com','PBDW UAT new DB resolves',63);
MERGE INTO env_health_checks h USING (SELECT 'H24' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H24','SEI Build-out · PBDW','DNS · qclodidb3sei (UAT ODI repo)','DNS','qclodidb3sei.testbbh.com','ODI UAT repo host resolves',64);
MERGE INTO env_health_checks h USING (SELECT 'H25' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H25','SEI Build-out · PBDW','DNS · qclodiapp3sei (UAT ODI agent)','DNS','qclodiapp3sei.testbbh.com','ODI UAT agent host resolves',65);
MERGE INTO env_health_checks h USING (SELECT 'H26' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H26','SEI Build-out · IMDS','DNS · dvlimdsdb (DEV DB · IMDSDBLA)','DNS','dvlimdsdb.testbbh.com','IMDS DEV new DB resolves',66);
MERGE INTO env_health_checks h USING (SELECT 'H27' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H27','SEI Build-out · IMDS','DNS · dvlimdsapp (DEV app)','DNS','dvlimdsapp.testbbh.com','IMDS DEV new app resolves',67);
MERGE INTO env_health_checks h USING (SELECT 'H28' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H28','SEI Build-out · IMDS','DNS · qblimdsdb (SIT DB · IMDSDBLB)','DNS','qblimdsdb.testbbh.com','IMDS SIT new DB resolves',68);
MERGE INTO env_health_checks h USING (SELECT 'H29' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H29','SEI Build-out · IMDS','DNS · qblimdsapp (SIT app)','DNS','qblimdsapp.testbbh.com','IMDS SIT new app resolves',69);
MERGE INTO env_health_checks h USING (SELECT 'H30' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H30','SEI Build-out · Client Portal','DNS · dvltasap235 (DEV)','DNS','dvltasap235.testbbh.com','Client Portal DEV resolves',70);
MERGE INTO env_health_checks h USING (SELECT 'H31' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H31','SEI Build-out · Client Portal','DNS · rdltasap235 (SIT)','DNS','rdltasap235.testbbh.com','Client Portal SIT resolves',71);
MERGE INTO env_health_checks h USING (SELECT 'H32' i FROM dual) s ON (h.check_id=s.i)
WHEN NOT MATCHED THEN INSERT (check_id,env_group,name,kind,target,verifies,order_no)
VALUES ('H32','SEI Build-out · Client Portal','DNS · qcltasap235 (UAT)','DNS','qcltasap235.testbbh.com','Client Portal UAT resolves',72);
COMMIT;
