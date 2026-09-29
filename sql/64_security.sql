-- 64_security.sql ---------------------------------------------------------
-- Who may see which module of CP 360.
--
-- TWO SYSTEMS, ONE JOB EACH. Active Directory answers "who is this" and
-- CP 360 answers "what may they see". Nothing here stores a password, a
-- password hash, or anything an attacker could replay against AD: the login
-- binds to the directory with the credentials the person typed, keeps the
-- answer, and discards the credentials. SEC_USER is a list of people the
-- entitlements hang off, not a credential store.
--
-- PER-USER GRANTS. A grant names one person and one module. There are no
-- roles and no group mappings, so "what can Ana see" is answered by one
-- SELECT with no inheritance to reason about -- and revoking is deleting a
-- row rather than working out which of four groups also grants it. The cost
-- is a row per person per module, and a leaver has to be revoked here as
-- well as in AD; SEC_USER.STATUS is how that is done in one place.
--
-- FAIL CLOSED. No row means no access. There is no "deny" row because
-- absence already means deny, and a system with both grant and deny rows
-- has a precedence question that somebody eventually gets wrong.
--
-- EVERY CHANGE IS WRITTEN DOWN. SEC_AUDIT records who granted what to whom
-- and when, and it is insert-only. An entitlement system whose history can
-- be edited answers no questions worth asking.

DECLARE
  e_exists EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_exists, -955);
  PROCEDURE ddl(s VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE s;
  EXCEPTION WHEN e_exists THEN NULL;
  END;
BEGIN
  -- People. USER_ID is whatever AD returns as the account name, upper-cased
  -- once here so a login as "A.Nair" and a grant to "a.nair" are the same
  -- person. No credential column exists, by design.
  ddl('CREATE TABLE sec_user (
        user_id        VARCHAR2(120) NOT NULL,
        display_name   VARCHAR2(200),
        email          VARCHAR2(200),
        -- ACTIVE | DISABLED. A disabled user keeps their grants and cannot
        -- log in, so a leaver is stopped without losing the record of what
        -- they had.
        status         VARCHAR2(20) DEFAULT ''ACTIVE'' NOT NULL,
        -- An admin may open the entitlement screen and change grants. It is
        -- deliberately a flag and not a module grant: the thing that
        -- controls access must not be grantable through the same mechanism
        -- it controls.
        is_admin       CHAR(1) DEFAULT ''N'' NOT NULL,
        first_seen     TIMESTAMP DEFAULT SYSTIMESTAMP,
        last_login     TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_sec_user PRIMARY KEY (user_id),
        CONSTRAINT ck_sec_user_status CHECK (status IN (''ACTIVE'',''DISABLED'')),
        CONSTRAINT ck_sec_user_admin CHECK (is_admin IN (''Y'',''N'')))');

  -- The grant surface: one row per navigable module. Seeded below from the
  -- sidebar, because a module that is not in this table cannot be granted
  -- and would therefore be invisible to everyone -- the seed is part of the
  -- contract, not a convenience.
  ddl('CREATE TABLE sec_module (
        module_key     VARCHAR2(60)  NOT NULL,
        module_name    VARCHAR2(120) NOT NULL,
        nav_group      VARCHAR2(60),
        description    VARCHAR2(400),
        -- Y for a module everyone signed in may see (the landing page).
        -- Keeps "grant everything to everyone" out of the grant table.
        open_to_all    CHAR(1) DEFAULT ''N'' NOT NULL,
        sort_order     NUMBER DEFAULT 0,
        CONSTRAINT pk_sec_module PRIMARY KEY (module_key),
        CONSTRAINT ck_sec_module_open CHECK (open_to_all IN (''Y'',''N'')))');

  -- The grant itself. PK on (user, module) so granting twice is idempotent
  -- rather than two rows that must both be revoked.
  ddl('CREATE TABLE sec_grant (
        user_id        VARCHAR2(120) NOT NULL,
        module_key     VARCHAR2(60)  NOT NULL,
        granted_by     VARCHAR2(120),
        granted_on     TIMESTAMP DEFAULT SYSTIMESTAMP,
        note           VARCHAR2(400),
        CONSTRAINT pk_sec_grant PRIMARY KEY (user_id, module_key))');
  ddl('CREATE INDEX ix_sec_grant_module ON sec_grant (module_key)');

  -- Sessions. The token itself is NEVER stored: only its SHA-256. A stolen
  -- database therefore yields no usable session, which is the whole reason
  -- for the column being called TOKEN_HASH.
  ddl('CREATE TABLE sec_session (
        token_hash     VARCHAR2(64)  NOT NULL,
        user_id        VARCHAR2(120) NOT NULL,
        issued_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
        expires_at     TIMESTAMP NOT NULL,
        last_seen_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
        revoked_at     TIMESTAMP,
        client_ip      VARCHAR2(60),
        user_agent     VARCHAR2(400),
        CONSTRAINT pk_sec_session PRIMARY KEY (token_hash))');
  ddl('CREATE INDEX ix_sec_session_user ON sec_session (user_id, expires_at)');

  -- Insert-only. Every login, every failure, every grant and revoke.
  ddl('CREATE TABLE sec_audit (
        audit_id       NUMBER GENERATED ALWAYS AS IDENTITY,
        at_ts          TIMESTAMP DEFAULT SYSTIMESTAMP,
        actor          VARCHAR2(120),
        action         VARCHAR2(40)  NOT NULL,
        target_user    VARCHAR2(120),
        module_key     VARCHAR2(60),
        outcome        VARCHAR2(20),
        detail         VARCHAR2(1000),
        client_ip      VARCHAR2(60),
        CONSTRAINT pk_sec_audit PRIMARY KEY (audit_id))');
  ddl('CREATE INDEX ix_sec_audit_at ON sec_audit (at_ts)');
  ddl('CREATE INDEX ix_sec_audit_target ON sec_audit (target_user, at_ts)');
END;
/

-- ---------------------------------------------------------------- modules
-- The sidebar, as grantable units. MERGE so re-running is safe and a
-- renamed label does not orphan its grants -- the KEY is the identity.
MERGE INTO sec_module t USING (SELECT 'home' k, 'Home' n, NULL g,
  'The landing page. Open to everyone who can sign in.' d, 'Y' o, 0 s FROM dual
  UNION ALL SELECT 'interface','Interface 360','Catalog','Interfaces, feeds and their contracts','N',10 FROM dual
  UNION ALL SELECT 'api','API 360','Catalog','API inventory, specifications and consumers','N',11 FROM dual
  UNION ALL SELECT 'data','Data 360','Catalog','Tables, columns and the graph between them','N',12 FROM dual
  UNION ALL SELECT 'datapoint','Datapoint 360','Catalog','Business data points and their definitions','N',13 FROM dual
  UNION ALL SELECT 'lineage','Lineage','Lineage','End-to-end lineage, business and technical','N',20 FROM dual
  UNION ALL SELECT 'event360','Event 360','Events','The event contract, subscriptions and cost','N',30 FROM dual
  UNION ALL SELECT 'mapper','Auto Mapper','Utilities','Suggested mappings between sources and targets','N',40 FROM dual
  UNION ALL SELECT 'pii','PII Explorer','Governance','Where personal data sits and how it is classified','N',50 FROM dual
  UNION ALL SELECT 'guardrails','Quality Guardrails','Governance','Data quality rules and the events they raise','N',51 FROM dual
  UNION ALL SELECT 'impact','Impact Analysis','Governance','What breaks if this changes','N',52 FROM dual
  UNION ALL SELECT 'variance','Variance 360','Governance','Value differences between stages','N',53 FROM dual
  UNION ALL SELECT 'recon','Recon 360','Governance','Reconciliation across systems','N',54 FROM dual
  UNION ALL SELECT 'apiconsole','API Console','Governance','Run and inspect API calls','N',55 FROM dual
  UNION ALL SELECT 'datasources','Data Sources','Admin','Connections the catalog harvests from','N',60 FROM dual
  UNION ALL SELECT 'apicatalog','API Catalog Admin','Admin','Maintain the API catalogue','N',61 FROM dual
  UNION ALL SELECT 'hub','CP Integration Hub','Admin','Integration hub model and flows','N',62 FROM dual
  UNION ALL SELECT 'integration360','Integration 360','Admin','Integration inventory','N',63 FROM dual
  UNION ALL SELECT 'environment','Environment 360','Admin','Environments, hosts and infrastructure','N',64 FROM dual
  UNION ALL SELECT 'security','Security Entitlement','Admin','Who may see which module. Admin only.','N',65 FROM dual
  UNION ALL SELECT 'system','System Design','Architecture','Design documents and diagrams','N',70 FROM dual
) s ON (t.module_key = s.k)
WHEN MATCHED THEN UPDATE SET module_name = s.n, nav_group = s.g,
  description = s.d, open_to_all = s.o, sort_order = s.s
WHEN NOT MATCHED THEN INSERT (module_key, module_name, nav_group, description,
  open_to_all, sort_order) VALUES (s.k, s.n, s.g, s.d, s.o, s.s);
COMMIT;

-- ------------------------------------------------------------- bootstrap
-- THE FIRST ADMIN. Nothing here is seeded automatically: an admin row that
-- ships with the schema is an admin row somebody forgets to remove.
--
-- Edit the account name to the AD account of your first administrator and
-- run these two statements. The account must exist in AD -- this grants
-- entitlement, it does not create a login.
--
--   INSERT INTO sec_user (user_id, display_name, is_admin)
--   VALUES ('YOUR.AD.ACCOUNT', 'Your Name', 'Y');
--
--   INSERT INTO sec_audit (actor, action, target_user, outcome, detail)
--   VALUES ('bootstrap', 'ADMIN_SEEDED', 'YOUR.AD.ACCOUNT', 'OK',
--           'first administrator, seeded by sql/64');
--   COMMIT;
--
-- An admin sees every module regardless of SEC_GRANT, so no further rows
-- are needed to get started. Verify before relying on it:
--
--   SELECT user_id, is_admin, status FROM sec_user WHERE is_admin = 'Y';
