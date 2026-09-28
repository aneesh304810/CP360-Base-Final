-- 61_business_catalog_seed.sql -------------------------------------------
-- First-pass business names and descriptions for the 176 PBDW tables in
-- LEGACY_LINEAGE. Every row is DRAFT and GENERATED: read as a starting
-- point for the people who own these tables, not as an authority. The
-- reviewable copy lives in docs/business-catalog/pbdw-business-catalog.csv.
--
-- MERGE, so re-running never overwrites a review: a row whose
-- REVIEW_STATUS has moved off DRAFT is left exactly as the reviewer left it.

MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account',
  business_description = 'The accounts BBH holds and services, with how each one is set up and who owns it.',
  grain = 'one row per account',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT', 'Account',
   'The accounts BBH holds and services, with how each one is set up and who owns it.', 'one row per account',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT_FEE_BLOCKS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account Fee Blocks',
  business_description = 'Accounts whose fee billing is currently held, and from when.',
  grain = 'one row per account per fee block',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT_FEE_BLOCKS', 'Account Fee Blocks',
   'Accounts whose fee billing is currently held, and from when.', 'one row per account per fee block',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT_IR_BLOCKS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account IR Blocks',
  business_description = 'Accounts with a hold placed on IR processing. IR is not expanded anywhere in the lineage — confirm before publishing this description.',
  grain = 'one row per account per block',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT_IR_BLOCKS', 'Account IR Blocks',
   'Accounts with a hold placed on IR processing. IR is not expanded anywhere in the lineage — confirm before publishing this description.', 'one row per account per block',
   'Account Master & Reference Data', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT_MAP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account Cross-Reference',
  business_description = 'How an account is identified in each system that knows about it, so the same account can be recognised across platforms.',
  grain = 'one row per account per external identifier',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT_MAP', 'Account Cross-Reference',
   'How an account is identified in each system that knows about it, so the same account can be recognised across platforms.', 'one row per account per external identifier',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT_UD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account User-Defined Fields',
  business_description = 'Extra account attributes the business added itself, outside the standard account record.',
  grain = 'one row per account per user-defined field',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT_UD', 'Account User-Defined Fields',
   'Extra account attributes the business added itself, outside the standard account record.', 'one row per account per user-defined field',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_ACCOUNT_UD_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account User-Defined Fields — History',
  business_description = 'Previous values of those extra account attributes, so a change can be traced to a date.',
  grain = 'one row per account per field per change',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_ACCOUNT_UD_HIST', 'Account User-Defined Fields — History',
   'Previous values of those extra account attributes, so a change can be traced to a date.', 'one row per account per field per change',
   'Account Master & Reference Data', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_COMPANY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Company',
  business_description = 'The legal entities BBH deals with, whether as client, counterparty or issuer.',
  grain = 'one row per company',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_COMPANY', 'Company',
   'The legal entities BBH deals with, whether as client, counterparty or issuer.', 'one row per company',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_MASTER_ACCOUNT_BLOCKS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Blocks',
  business_description = 'Holds placed at master-account level, which apply to every account beneath.',
  grain = 'one row per master account per block',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_MASTER_ACCOUNT_BLOCKS', 'Master Account Blocks',
   'Holds placed at master-account level, which apply to every account beneath.', 'one row per master account per block',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_MASTER_ACCOUNT_UD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account User-Defined Fields',
  business_description = 'Extra attributes on a master account — the grouping several accounts are administered under.',
  grain = 'one row per master account per field',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_MASTER_ACCOUNT_UD', 'Master Account User-Defined Fields',
   'Extra attributes on a master account — the grouping several accounts are administered under.', 'one row per master account per field',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_MASTER_ACCOUNT_UD_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account User-Defined Fields — History',
  business_description = 'Previous values of those master-account attributes.',
  grain = 'one row per master account per field per change',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_MASTER_ACCOUNT_UD_HIST', 'Master Account User-Defined Fields — History',
   'Previous values of those master-account attributes.', 'one row per master account per field per change',
   'Account Master & Reference Data', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_MSTR_ACCT_RELATIONSHIP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Relationships',
  business_description = 'Which accounts belong to which master account, and in what capacity.',
  grain = 'one row per master account to account link',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_MSTR_ACCT_RELATIONSHIP', 'Master Account Relationships',
   'Which accounts belong to which master account, and in what capacity.', 'one row per master account to account link',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_MSTR_ACCT_REL_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Relationships — History',
  business_description = 'Previous master-account groupings, so a reorganisation can be traced.',
  grain = 'one row per link per change',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_MSTR_ACCT_REL_HIST', 'Master Account Relationships — History',
   'Previous master-account groupings, so a reorganisation can be traced.', 'one row per link per change',
   'Account Master & Reference Data', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACCOUNT_OMNI_MAP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Omnibus Account Map',
  business_description = 'Which underlying accounts sit behind an omnibus account held in a single name.',
  grain = 'one row per omnibus account to underlying account link',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACCOUNT_OMNI_MAP', 'Omnibus Account Map',
   'Which underlying accounts sit behind an omnibus account held in a single name.', 'one row per omnibus account to underlying account link',
   'Account Master & Reference Data', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ADDEPAR_ACCOUNT_DTLS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Addepar Account Details',
  business_description = 'Account details as Addepar holds them, for reporting that runs out of Addepar rather than PBDW.',
  grain = 'one row per account in Addepar',
  suggested_group = 'Account Master & Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ADDEPAR_ACCOUNT_DTLS', 'Addepar Account Details',
   'Account details as Addepar holds them, for reporting that runs out of Addepar rather than PBDW.', 'one row per account in Addepar',
   'Account Master & Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'AUDIT_TRAIL_ACCOUNT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account Changes',
  business_description = 'Who changed what on an account, and when.',
  grain = 'one row per account change',
  suggested_group = 'Audit Trail & Change History',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'AUDIT_TRAIL_ACCOUNT', 'Account Changes',
   'Who changed what on an account, and when.', 'one row per account change',
   'Audit Trail & Change History', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'AUDIT_TRAIL_INTERESTED_PARTY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Party Changes',
  business_description = 'Who changed what on an interested party, and when.',
  grain = 'one row per party change',
  suggested_group = 'Audit Trail & Change History',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'AUDIT_TRAIL_INTERESTED_PARTY', 'Party Changes',
   'Who changed what on an interested party, and when.', 'one row per party change',
   'Audit Trail & Change History', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'AUDIT_TRAIL_IP_RELATIONSHIP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Relationship Changes',
  business_description = 'Who changed a party''s relationship to an account, and when.',
  grain = 'one row per relationship change',
  suggested_group = 'Audit Trail & Change History',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'AUDIT_TRAIL_IP_RELATIONSHIP', 'Relationship Changes',
   'Who changed a party''s relationship to an account, and when.', 'one row per relationship change',
   'Audit Trail & Change History', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'AUDIT_TRAIL_MASTER_ACCOUNT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Changes',
  business_description = 'Who changed what on a master account, and when.',
  grain = 'one row per master account change',
  suggested_group = 'Audit Trail & Change History',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'AUDIT_TRAIL_MASTER_ACCOUNT', 'Master Account Changes',
   'Who changed what on a master account, and when.', 'one row per master account change',
   'Audit Trail & Change History', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'AUDIT_TRAIL_SECURITY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Changes',
  business_description = 'Who changed what on a security, and when.',
  grain = 'one row per security change',
  suggested_group = 'Audit Trail & Change History',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'AUDIT_TRAIL_SECURITY', 'Security Changes',
   'Who changed what on a security, and when.', 'one row per security change',
   'Audit Trail & Change History', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CRD_COMPL_RULES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Compliance Rules (Charles River)',
  business_description = 'The investment restrictions each portfolio is tested against.',
  grain = 'one row per rule',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CRD_COMPL_RULES', 'Compliance Rules (Charles River)',
   'The investment restrictions each portfolio is tested against.', 'one row per rule',
   'Compliance & Oversight', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'PBDW_CS_TEST_V2' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Compliance Tests',
  business_description = 'Each compliance test run, and against what.',
  grain = 'one row per test run',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'PBDW_CS_TEST_V2', 'Compliance Tests',
   'Each compliance test run, and against what.', 'one row per test run',
   'Compliance & Oversight', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'PBDW_CS_VIOLATIONS_V2' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Compliance Violations',
  business_description = 'Tests that failed — a portfolio outside its restrictions.',
  grain = 'one row per violation',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'PBDW_CS_VIOLATIONS_V2', 'Compliance Violations',
   'Tests that failed — a portfolio outside its restrictions.', 'one row per violation',
   'Compliance & Oversight', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACCOUNT_REVIEW_RECON' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account Review Reconciliation',
  business_description = 'Accounts due for periodic review and whether the review happened.',
  grain = 'one row per account per review cycle',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACCOUNT_REVIEW_RECON', 'Account Review Reconciliation',
   'Accounts due for periodic review and whether the review happened.', 'one row per account per review cycle',
   'Compliance & Oversight', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_MASTER_REVIEW_RECON' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Review Reconciliation',
  business_description = 'The same review check at master-account level.',
  grain = 'one row per master account per review cycle',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_MASTER_REVIEW_RECON', 'Master Account Review Reconciliation',
   'The same review check at master-account level.', 'one row per master account per review cycle',
   'Compliance & Oversight', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'TMP_ALERTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Alerts — Staging',
  business_description = 'Alerts raised by the current run. Not a reporting table.',
  grain = 'one row per alert, current run',
  suggested_group = 'Compliance & Oversight',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'TMP_ALERTS', 'Alerts — Staging',
   'Alerts raised by the current run. Not a reporting table.', 'one row per alert, current run',
   'Compliance & Oversight', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_ACCOUNT_WORKSHEET' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Worksheet',
  business_description = 'The calculation behind each account''s fee for a billing period.',
  grain = 'one row per account per billing period',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_ACCOUNT_WORKSHEET', 'Fee Worksheet',
   'The calculation behind each account''s fee for a billing period.', 'one row per account per billing period',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_ACCT_WKSHEET_ALLOC' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Allocation',
  business_description = 'How a fee is split across the accounts that bear it.',
  grain = 'one row per worksheet per account share',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_ACCT_WKSHEET_ALLOC', 'Fee Allocation',
   'How a fee is split across the accounts that bear it.', 'one row per worksheet per account share',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_ACCT_WKSHEET_AMOUNTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Worksheet Amounts',
  business_description = 'The amounts making up each fee calculation.',
  grain = 'one row per worksheet per amount',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_ACCT_WKSHEET_AMOUNTS', 'Fee Worksheet Amounts',
   'The amounts making up each fee calculation.', 'one row per worksheet per amount',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_ACCT_WKSHT_COMPONENT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Components',
  business_description = 'The separate charges a fee is built from.',
  grain = 'one row per worksheet per component',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_ACCT_WKSHT_COMPONENT', 'Fee Components',
   'The separate charges a fee is built from.', 'one row per worksheet per component',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_ACCT_WKSHT_COMP_STEPS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Tier Steps',
  business_description = 'The tiered rate steps applied within a fee component.',
  grain = 'one row per component per tier',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_ACCT_WKSHT_COMP_STEPS', 'Fee Tier Steps',
   'The tiered rate steps applied within a fee component.', 'one row per component per tier',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_MA_ACCT_WKSHT_CENT_AC' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Master Account Central Billing',
  business_description = 'Fees billed centrally at master-account level rather than to each account.',
  grain = 'one row per master account per billing period',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_MA_ACCT_WKSHT_CENT_AC', 'Master Account Central Billing',
   'Fees billed centrally at master-account level rather than to each account.', 'one row per master account per billing period',
   'Fees & Billing', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FEE_RECEIVE_OPEN' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fees Outstanding',
  business_description = 'Fees billed and not yet received.',
  grain = 'one row per open fee receivable',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FEE_RECEIVE_OPEN', 'Fees Outstanding',
   'Fees billed and not yet received.', 'one row per open fee receivable',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FEE_RECEIVE_BALANCE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Receivable Balance',
  business_description = 'The outstanding fee balance per account.',
  grain = 'one row per account',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FEE_RECEIVE_BALANCE', 'Fee Receivable Balance',
   'The outstanding fee balance per account.', 'one row per account',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FEE_RECEIVE_MSTR_BALANCE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Receivable Balance — Master Account',
  business_description = 'The outstanding fee balance rolled up to master account.',
  grain = 'one row per master account',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FEE_RECEIVE_MSTR_BALANCE', 'Fee Receivable Balance — Master Account',
   'The outstanding fee balance rolled up to master account.', 'one row per master account',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FEE_SCHEDULE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Schedules',
  business_description = 'The fee schedules an account can be billed on.',
  grain = 'one row per fee schedule',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FEE_SCHEDULE', 'Fee Schedules',
   'The fee schedules an account can be billed on.', 'one row per fee schedule',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FEE_SCHEDULE_COMPONENT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Schedule Components',
  business_description = 'The charges each schedule is made up of.',
  grain = 'one row per schedule per component',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FEE_SCHEDULE_COMPONENT', 'Fee Schedule Components',
   'The charges each schedule is made up of.', 'one row per schedule per component',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FEE_SCHEDULE_DETAILS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Schedule Details',
  business_description = 'The rates and tiers within each schedule.',
  grain = 'one row per schedule per rate line',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FEE_SCHEDULE_DETAILS', 'Fee Schedule Details',
   'The rates and tiers within each schedule.', 'one row per schedule per rate line',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FIS_FEE_SCHEDULE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fee Schedules (FIS)',
  business_description = 'Fee schedules as FIS holds them, for comparison with BBH''s own.',
  grain = 'one row per fee schedule in FIS',
  suggested_group = 'Fees & Billing',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FIS_FEE_SCHEDULE', 'Fee Schedules (FIS)',
   'Fee schedules as FIS holds them, for comparison with BBH''s own.', 'one row per fee schedule in FIS',
   'Fees & Billing', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_ASSET_ALLOCATIONS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Target Asset Allocation',
  business_description = 'The target weights a portfolio is managed to.',
  grain = 'one row per allocation model per asset class',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_ASSET_ALLOCATIONS', 'Target Asset Allocation',
   'The target weights a portfolio is managed to.', 'one row per allocation model per asset class',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_ASSET_THRESHOLD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Allocation Thresholds',
  business_description = 'How far a holding may drift from target before it is flagged.',
  grain = 'one row per asset class per threshold',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_ASSET_THRESHOLD', 'Allocation Thresholds',
   'How far a holding may drift from target before it is flagged.', 'one row per asset class per threshold',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Investment Policy Statement',
  business_description = 'The agreed investment policy for a relationship — what the portfolio is meant to do.',
  grain = 'one row per policy statement',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS', 'Investment Policy Statement',
   'The agreed investment policy for a relationship — what the portfolio is meant to do.', 'one row per policy statement',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_APPROVAL' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Approvals',
  business_description = 'Whether each policy has been approved, and when.',
  grain = 'one row per policy per approval',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_APPROVAL', 'Policy Approvals',
   'Whether each policy has been approved, and when.', 'one row per policy per approval',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_APPROVER' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Approvers',
  business_description = 'Who may approve a policy, so an approval can be checked against an entitlement.',
  grain = 'one row per approver',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_APPROVER', 'Policy Approvers',
   'Who may approve a policy, so an approval can be checked against an entitlement.', 'one row per approver',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_ASSET' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Asset Classes',
  business_description = 'The asset classes a policy covers and the weight agreed for each.',
  grain = 'one row per policy per asset class',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_ASSET', 'Policy Asset Classes',
   'The asset classes a policy covers and the weight agreed for each.', 'one row per policy per asset class',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_HISTORY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Investment Policy — History',
  business_description = 'Previous versions of each policy, so a change of mandate is traceable.',
  grain = 'one row per policy per version',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_HISTORY', 'Investment Policy — History',
   'Previous versions of each policy, so a change of mandate is traceable.', 'one row per policy per version',
   'IPS / Investment Policy', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_INVESTOR_PROFILE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Investor Profile',
  business_description = 'The client''s objectives, risk tolerance and constraints as recorded on the policy.',
  grain = 'one row per policy',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_INVESTOR_PROFILE', 'Investor Profile',
   'The client''s objectives, risk tolerance and constraints as recorded on the policy.', 'one row per policy',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_SUBASSET_CLASS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Sub-Asset Classes',
  business_description = 'The finer breakdown beneath each asset class.',
  grain = 'one row per policy per sub-asset class',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_SUBASSET_CLASS', 'Policy Sub-Asset Classes',
   'The finer breakdown beneath each asset class.', 'one row per policy per sub-asset class',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_TRANSLATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Translations',
  business_description = 'Policy wording in each language it is issued in.',
  grain = 'one row per policy per language',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_TRANSLATION', 'Policy Translations',
   'Policy wording in each language it is issued in.', 'one row per policy per language',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_UIMP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy UIMP',
  business_description = 'A policy structure abbreviated UIMP. UIMP is not expanded anywhere in the lineage — this one needs an owner to name it.',
  grain = 'one row per policy per UIMP entry',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_UIMP', 'Policy UIMP',
   'A policy structure abbreviated UIMP. UIMP is not expanded anywhere in the lineage — this one needs an owner to name it.', 'one row per policy per UIMP entry',
   'IPS / Investment Policy', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_UIMP_REALLOCATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy UIMP Reallocation',
  business_description = 'Reallocations against those UIMP entries. UIMP is not expanded anywhere in the lineage — confirm before publishing.',
  grain = 'one row per reallocation',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_UIMP_REALLOCATION', 'Policy UIMP Reallocation',
   'Reallocations against those UIMP entries. UIMP is not expanded anywhere in the lineage — confirm before publishing.', 'one row per reallocation',
   'IPS / Investment Policy', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_WS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Worksheet',
  business_description = 'The working version of a policy while it is being drafted.',
  grain = 'one row per worksheet',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_WS', 'Policy Worksheet',
   'The working version of a policy while it is being drafted.', 'one row per worksheet',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_BBH_IPS_WS_OPTOUT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Worksheet Opt-Outs',
  business_description = 'Parts of the policy the client has declined, recorded on the worksheet.',
  grain = 'one row per worksheet per opt-out',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_BBH_IPS_WS_OPTOUT', 'Policy Worksheet Opt-Outs',
   'Parts of the policy the client has declined, recorded on the worksheet.', 'one row per worksheet per opt-out',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IPS_ACCOUNTS_RELATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Accounts',
  business_description = 'Which accounts each policy governs.',
  grain = 'one row per policy per account',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IPS_ACCOUNTS_RELATION', 'Policy Accounts',
   'Which accounts each policy governs.', 'one row per policy per account',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IPS_CONSOLIDATED' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Consolidated Policy View',
  business_description = 'One policy view across the accounts a relationship holds.',
  grain = 'one row per relationship',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IPS_CONSOLIDATED', 'Consolidated Policy View',
   'One policy view across the accounts a relationship holds.', 'one row per relationship',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IPS_DETAILS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Details',
  business_description = 'The detailed lines of a policy.',
  grain = 'one row per policy per detail line',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IPS_DETAILS', 'Policy Details',
   'The detailed lines of a policy.', 'one row per policy per detail line',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IPS_OPT_OUTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Policy Opt-Outs',
  business_description = 'Parts of the agreed policy the client has declined.',
  grain = 'one row per policy per opt-out',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IPS_OPT_OUTS', 'Policy Opt-Outs',
   'Parts of the agreed policy the client has declined.', 'one row per policy per opt-out',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IPS_SPL_CONSIDERATIONS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Special Considerations',
  business_description = 'Client-specific instructions and restrictions that sit outside the standard policy.',
  grain = 'one row per policy per consideration',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IPS_SPL_CONSIDERATIONS', 'Special Considerations',
   'Client-specific instructions and restrictions that sit outside the standard policy.', 'one row per policy per consideration',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACTIVE_BLEND_ALLOCATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Active Blend Allocation',
  business_description = 'The blend of active and passive management applied to an allocation.',
  grain = 'one row per blend per asset class',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACTIVE_BLEND_ALLOCATION', 'Active Blend Allocation',
   'The blend of active and passive management applied to an allocation.', 'one row per blend per asset class',
   'IPS / Investment Policy', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ASSET_CLASS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Asset Classes',
  business_description = 'The asset-class scheme used across allocation and reporting.',
  grain = 'one row per asset class',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ASSET_CLASS', 'Asset Classes',
   'The asset-class scheme used across allocation and reporting.', 'one row per asset class',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IPS_OBJECTIVE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Investment Objectives',
  business_description = 'The objectives a policy can be set to.',
  grain = 'one row per objective',
  suggested_group = 'IPS / Investment Policy',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IPS_OBJECTIVE', 'Investment Objectives',
   'The objectives a policy can be set to.', 'one row per objective',
   'IPS / Investment Policy', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_DW_CONTACTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'CRM Contacts',
  business_description = 'Contacts as the CRM holds them, brought across so warehouse reporting agrees with the CRM.',
  grain = 'one row per CRM contact',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_DW_CONTACTS', 'CRM Contacts',
   'Contacts as the CRM holds them, brought across so warehouse reporting agrees with the CRM.', 'one row per CRM contact',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_OB_REQUEST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Onboarding Requests',
  business_description = 'Requests raised to onboard a client or account, and where each one has got to.',
  grain = 'one row per onboarding request',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_OB_REQUEST', 'Onboarding Requests',
   'Requests raised to onboard a client or account, and where each one has got to.', 'one row per onboarding request',
   'Interested Parties & Relationships', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_TAR_CONTACTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'CRM TAR Contacts',
  business_description = 'A second CRM contact set. TAR is not expanded anywhere in the lineage — confirm what it stands for.',
  grain = 'one row per contact',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_TAR_CONTACTS', 'CRM TAR Contacts',
   'A second CRM contact set. TAR is not expanded anywhere in the lineage — confirm what it stands for.', 'one row per contact',
   'Interested Parties & Relationships', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_INTERESTED_PARTY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Interested Party',
  business_description = 'Every person or organisation with an interest in an account — owners, beneficiaries, signatories, advisers.',
  grain = 'one row per interested party',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_INTERESTED_PARTY', 'Interested Party',
   'Every person or organisation with an interest in an account — owners, beneficiaries, signatories, advisers.', 'one row per interested party',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_INTERESTED_PARTY_UD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Interested Party User-Defined Fields',
  business_description = 'Extra attributes the business records against a party.',
  grain = 'one row per party per field',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_INTERESTED_PARTY_UD', 'Interested Party User-Defined Fields',
   'Extra attributes the business records against a party.', 'one row per party per field',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_INTERESTED_PARTY_UD_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Interested Party User-Defined Fields — History',
  business_description = 'Previous values of those party attributes.',
  grain = 'one row per party per field per change',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_INTERESTED_PARTY_UD_HIST', 'Interested Party User-Defined Fields — History',
   'Previous values of those party attributes.', 'one row per party per field per change',
   'Interested Parties & Relationships', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_RELATIONSHIP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Party Relationship',
  business_description = 'How each party relates to each account — the capacity in which they are interested.',
  grain = 'one row per party to account relationship',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_RELATIONSHIP', 'Party Relationship',
   'How each party relates to each account — the capacity in which they are interested.', 'one row per party to account relationship',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_RELATIONSHIP_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Party Relationship — History',
  business_description = 'Previous relationships, so a change of signatory or beneficiary can be traced.',
  grain = 'one row per relationship per change',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_RELATIONSHIP_HIST', 'Party Relationship — History',
   'Previous relationships, so a change of signatory or beneficiary can be traced.', 'one row per relationship per change',
   'Interested Parties & Relationships', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_RELATIONSHIP_UD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Party Relationship User-Defined Fields',
  business_description = 'Extra attributes on the relationship itself rather than on the party.',
  grain = 'one row per relationship per field',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_RELATIONSHIP_UD', 'Party Relationship User-Defined Fields',
   'Extra attributes on the relationship itself rather than on the party.', 'one row per relationship per field',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_RELATIONSHIP_UD_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Party Relationship User-Defined Fields — History',
  business_description = 'Previous values of those relationship attributes.',
  grain = 'one row per relationship per field per change',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_RELATIONSHIP_UD_HIST', 'Party Relationship User-Defined Fields — History',
   'Previous values of those relationship attributes.', 'one row per relationship per field per change',
   'Interested Parties & Relationships', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_REL_REMIT_BLOCKS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Remittance Blocks',
  business_description = 'Party relationships whose payments are currently blocked, and why.',
  grain = 'one row per relationship per remittance block',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_REL_REMIT_BLOCKS', 'Remittance Blocks',
   'Party relationships whose payments are currently blocked, and why.', 'one row per relationship per remittance block',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_IP_REL_STMT_BLOCKS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Statement Blocks',
  business_description = 'Party relationships whose statements are currently withheld.',
  grain = 'one row per relationship per statement block',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_IP_REL_STMT_BLOCKS', 'Statement Blocks',
   'Party relationships whose statements are currently withheld.', 'one row per relationship per statement block',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_OFFICER_CONTACTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Officer Contacts',
  business_description = 'Which officer covers which account or relationship.',
  grain = 'one row per officer to account assignment',
  suggested_group = 'Interested Parties & Relationships',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_OFFICER_CONTACTS', 'Officer Contacts',
   'Which officer covers which account or relationship.', 'one row per officer to account assignment',
   'Interested Parties & Relationships', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'API_INTRADAY_KEYS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Intraday API Keys',
  business_description = 'Keys the intraday API uses to identify what to refresh.',
  grain = 'one row per key',
  suggested_group = 'Intraday / API Keys & Control',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'API_INTRADAY_KEYS', 'Intraday API Keys',
   'Keys the intraday API uses to identify what to refresh.', 'one row per key',
   'Intraday / API Keys & Control', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CFG_BACK_DATED_LIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Back-Dated Processing List',
  business_description = 'Accounts approved for back-dated processing.',
  grain = 'one row per account',
  suggested_group = 'Intraday / API Keys & Control',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CFG_BACK_DATED_LIST', 'Back-Dated Processing List',
   'Accounts approved for back-dated processing.', 'one row per account',
   'Intraday / API Keys & Control', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CFG_BACK_DATED_LIST_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Back-Dated Processing List — History',
  business_description = 'Previous versions of that list.',
  grain = 'one row per account per change',
  suggested_group = 'Intraday / API Keys & Control',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CFG_BACK_DATED_LIST_HIST', 'Back-Dated Processing List — History',
   'Previous versions of that list.', 'one row per account per change',
   'Intraday / API Keys & Control', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CFG_BACK_DATED_LIST_TEMP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Back-Dated Processing List — Staging',
  business_description = 'The list being assembled by the current run.',
  grain = 'one row per account, current run',
  suggested_group = 'Intraday / API Keys & Control',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CFG_BACK_DATED_LIST_TEMP', 'Back-Dated Processing List — Staging',
   'The list being assembled by the current run.', 'one row per account, current run',
   'Intraday / API Keys & Control', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'PBDW_ETL_AUDIT_LOG' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Load Log',
  business_description = 'Every warehouse load: when it ran, how long it took, and whether it succeeded.',
  grain = 'one row per load step per run',
  suggested_group = 'Intraday / API Keys & Control',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'PBDW_ETL_AUDIT_LOG', 'Load Log',
   'Every warehouse load: when it ran, how long it took, and whether it succeeded.', 'one row per load step per run',
   'Intraday / API Keys & Control', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACBS_FACILITY_LIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Credit Facilities',
  business_description = 'Lending facilities extended to clients, from the ACBS commercial lending system.',
  grain = 'one row per facility',
  suggested_group = 'Lending & Credit',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACBS_FACILITY_LIST', 'Credit Facilities',
   'Lending facilities extended to clients, from the ACBS commercial lending system.', 'one row per facility',
   'Lending & Credit', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACBS_KEY_METRICS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Credit Facility Metrics',
  business_description = 'Balances, limits and utilisation on each facility.',
  grain = 'one row per facility per metric date',
  suggested_group = 'Lending & Credit',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACBS_KEY_METRICS', 'Credit Facility Metrics',
   'Balances, limits and utilisation on each facility.', 'one row per facility per metric date',
   'Lending & Credit', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ACBS_SYND_PARTICIPATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Syndicated Loan Participation',
  business_description = 'BBH''s share of loans syndicated across several lenders.',
  grain = 'one row per facility per participant',
  suggested_group = 'Lending & Credit',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ACBS_SYND_PARTICIPATION', 'Syndicated Loan Participation',
   'BBH''s share of loans syndicated across several lenders.', 'one row per facility per participant',
   'Lending & Credit', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_FUND_DETAILS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fund Details',
  business_description = 'Fund characteristics from the investment research group''s data set.',
  grain = 'one row per fund',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_FUND_DETAILS', 'Fund Details',
   'Fund characteristics from the investment research group''s data set.', 'one row per fund',
   'Market / Research Data', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_FUND_FACTOR' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fund Factors',
  business_description = 'Factor exposures attributed to each fund.',
  grain = 'one row per fund per factor',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_FUND_FACTOR', 'Fund Factors',
   'Factor exposures attributed to each fund.', 'one row per fund per factor',
   'Market / Research Data', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_FUND_RETURNS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fund Returns',
  business_description = 'Published returns for each fund.',
  grain = 'one row per fund per period',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_FUND_RETURNS', 'Fund Returns',
   'Published returns for each fund.', 'one row per fund per period',
   'Market / Research Data', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_MORNING_STAR' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Morningstar Data',
  business_description = 'Fund data as supplied by Morningstar.',
  grain = 'one row per fund',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_MORNING_STAR', 'Morningstar Data',
   'Fund data as supplied by Morningstar.', 'one row per fund',
   'Market / Research Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_SECTOR_NAMES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Research Sector Names',
  business_description = 'The sector names used in research data.',
  grain = 'one row per sector',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_SECTOR_NAMES', 'Research Sector Names',
   'The sector names used in research data.', 'one row per sector',
   'Market / Research Data', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IRG_SP500_INFO' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'S&P 500 Constituents',
  business_description = 'S&P 500 index membership and attributes.',
  grain = 'one row per constituent',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IRG_SP500_INFO', 'S&P 500 Constituents',
   'S&P 500 index membership and attributes.', 'one row per constituent',
   'Market / Research Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_PRIVATE_MARKET_FUND' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Private Market Funds',
  business_description = 'Private equity, credit and real asset funds clients are invested in.',
  grain = 'one row per fund',
  suggested_group = 'Market / Research Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_PRIVATE_MARKET_FUND', 'Private Market Funds',
   'Private equity, credit and real asset funds clients are invested in.', 'one row per fund',
   'Market / Research Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CP_HOLDINGS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Holdings',
  business_description = 'What each account holds, by security, with quantity and value. The figure most client reporting starts from.',
  grain = 'one row per account per security per day',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CP_HOLDINGS', 'Holdings',
   'What each account holds, by security, with quantity and value. The figure most client reporting starts from.', 'one row per account per security per day',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CP_HOLDINGS_TEMP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Holdings — Staging',
  business_description = 'The holdings load in progress. Not a reporting table.',
  grain = 'one row per account per security, current batch',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CP_HOLDINGS_TEMP', 'Holdings — Staging',
   'The holdings load in progress. Not a reporting table.', 'one row per account per security, current batch',
   'Positions & Holdings', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CP_URGL_GRAPH' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Unrealised Gain & Loss Trend',
  business_description = 'Unrealised gain and loss over time, shaped for the chart that shows it.',
  grain = 'one row per account per period',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CP_URGL_GRAPH', 'Unrealised Gain & Loss Trend',
   'Unrealised gain and loss over time, shaped for the chart that shows it.', 'one row per account per period',
   'Positions & Holdings', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CRD_TAX_LOT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Tax Lots (Charles River)',
  business_description = 'Tax lots as the Charles River order management system holds them, for comparison with BBH''s own.',
  grain = 'one row per tax lot in Charles River',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CRD_TAX_LOT', 'Tax Lots (Charles River)',
   'Tax lots as the Charles River order management system holds them, for comparison with BBH''s own.', 'one row per tax lot in Charles River',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_HOLDINGS_BATCH' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Holdings Batch',
  business_description = 'Which holdings load produced which figures, so a number can be traced to a run.',
  grain = 'one row per holdings batch',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_HOLDINGS_BATCH', 'Holdings Batch',
   'Which holdings load produced which figures, so a number can be traced to a run.', 'one row per holdings batch',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_HOLDINGS_UPDATED' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Holdings Changed Today',
  business_description = 'Holdings that moved in the latest run, so downstream processes need only look at what changed.',
  grain = 'one row per changed holding per run',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_HOLDINGS_UPDATED', 'Holdings Changed Today',
   'Holdings that moved in the latest run, so downstream processes need only look at what changed.', 'one row per changed holding per run',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PLEDGE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Pledged Assets',
  business_description = 'Holdings pledged as collateral and therefore not freely available.',
  grain = 'one row per pledge',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PLEDGE', 'Pledged Assets',
   'Holdings pledged as collateral and therefore not freely available.', 'one row per pledge',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_TAX_LOT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Tax Lots',
  business_description = 'Each separately acquired parcel of a holding, with its cost and acquisition date — what gain and loss is calculated from.',
  grain = 'one row per tax lot',
  suggested_group = 'Positions & Holdings',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_TAX_LOT', 'Tax Lots',
   'Each separately acquired parcel of a holding, with its cost and acquisition date — what gain and loss is calculated from.', 'one row per tax lot',
   'Positions & Holdings', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_TAX_LOT_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Tax Lots — History',
  business_description = 'Previous states of those parcels, so a restatement can be traced.',
  grain = 'one row per tax lot per change',
  suggested_group = 'Positions & Holdings',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_TAX_LOT_HIST', 'Tax Lots — History',
   'Previous states of those parcels, so a restatement can be traced.', 'one row per tax lot per change',
   'Positions & Holdings', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CFG_TR_CUSIP_LTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Thomson Reuters CUSIP List',
  business_description = 'A controlled list of CUSIPs for Thomson Reuters processing. LTS is not expanded anywhere in the lineage.',
  grain = 'one row per CUSIP',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CFG_TR_CUSIP_LTS', 'Thomson Reuters CUSIP List',
   'A controlled list of CUSIPs for Thomson Reuters processing. LTS is not expanded anywhere in the lineage.', 'one row per CUSIP',
   'Pricing & Valuation', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_MBS_FACTOR' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Mortgage-Backed Security Factors',
  business_description = 'The paydown factor for each mortgage-backed security, which determines the outstanding balance.',
  grain = 'one row per security per factor date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_MBS_FACTOR', 'Mortgage-Backed Security Factors',
   'The paydown factor for each mortgage-backed security, which determines the outstanding balance.', 'one row per security per factor date',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PRICE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price',
  business_description = 'The price used to value each security on each day.',
  grain = 'one row per security per date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PRICE', 'Price',
   'The price used to value each security on each day.', 'one row per security per date',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PRICE_FIS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price (FIS)',
  business_description = 'Prices as delivered by FIS, before any vendor is chosen.',
  grain = 'one row per security per date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PRICE_FIS', 'Price (FIS)',
   'Prices as delivered by FIS, before any vendor is chosen.', 'one row per security per date',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PRICE_REALTIME' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price — Intraday',
  business_description = 'Prices refreshed during the day rather than at close.',
  grain = 'one row per security per intraday snapshot',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PRICE_REALTIME', 'Price — Intraday',
   'Prices refreshed during the day rather than at close.', 'one row per security per intraday snapshot',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PRICE_TR' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price (Thomson Reuters)',
  business_description = 'Prices as delivered by Thomson Reuters, before any vendor is chosen.',
  grain = 'one row per security per date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PRICE_TR', 'Price (Thomson Reuters)',
   'Prices as delivered by Thomson Reuters, before any vendor is chosen.', 'one row per security per date',
   'Pricing & Valuation', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_SECURITY_MEASURES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Measures',
  business_description = 'Calculated measures on a security — yield, duration and the like.',
  grain = 'one row per security per measure per date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_SECURITY_MEASURES', 'Security Measures',
   'Calculated measures on a security — yield, duration and the like.', 'one row per security per measure per date',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_SECURITY_MEASURES_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Measures — History',
  business_description = 'Previous values of those measures.',
  grain = 'one row per security per measure per date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_SECURITY_MEASURES_HIST', 'Security Measures — History',
   'Previous values of those measures.', 'one row per security per measure per date',
   'Pricing & Valuation', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_STAR_PORTFOLIO_VALUATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Portfolio Valuation (STAR)',
  business_description = 'The nightly portfolio valuation delivered by STAR.',
  grain = 'one row per account per security per valuation date',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_STAR_PORTFOLIO_VALUATION', 'Portfolio Valuation (STAR)',
   'The nightly portfolio valuation delivered by STAR.', 'one row per account per security per valuation date',
   'Pricing & Valuation', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'TEMP_PRICE_CHANGE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price Change — Staging',
  business_description = 'Prices that moved in the current run. Not a reporting table.',
  grain = 'one row per security, current run',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'TEMP_PRICE_CHANGE', 'Price Change — Staging',
   'Prices that moved in the current run. Not a reporting table.', 'one row per security, current run',
   'Pricing & Valuation', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'TEMP_PRICE_CHANGE_YESTERDAY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Price Change — Previous Run',
  business_description = 'The prior run''s price movements, kept for comparison.',
  grain = 'one row per security, previous run',
  suggested_group = 'Pricing & Valuation',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'TEMP_PRICE_CHANGE_YESTERDAY', 'Price Change — Previous Run',
   'The prior run''s price movements, kept for comparison.', 'one row per security, previous run',
   'Pricing & Valuation', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CONTACT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Contact',
  business_description = 'Named contacts and how to reach them.',
  grain = 'one row per contact',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CONTACT', 'Contact',
   'Named contacts and how to reach them.', 'one row per contact',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CONTROL_DATES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Processing Dates',
  business_description = 'The business dates each process runs for, which decide what ''today'' means to a report.',
  grain = 'one row per process per date',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CONTROL_DATES', 'Processing Dates',
   'The business dates each process runs for, which decide what ''today'' means to a report.', 'one row per process per date',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_EMPLOYEE_OFFICES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'CRM Employee Offices',
  business_description = 'Which office each employee works from, as the CRM records it.',
  grain = 'one row per employee per office',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_EMPLOYEE_OFFICES', 'CRM Employee Offices',
   'Which office each employee works from, as the CRM records it.', 'one row per employee per office',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_DATE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Calendar',
  business_description = 'The date dimension every periodic report joins to.',
  grain = 'one row per date',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_DATE', 'Calendar',
   'The date dimension every periodic report joins to.', 'one row per date',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_EMPLOYEE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Employee',
  business_description = 'BBH staff, used to attribute accounts and activity to the people responsible.',
  grain = 'one row per employee',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_EMPLOYEE', 'Employee',
   'BBH staff, used to attribute accounts and activity to the people responsible.', 'one row per employee',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_OFFICE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Office',
  business_description = 'BBH offices, used to roll figures up by location.',
  grain = 'one row per office',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_OFFICE', 'Office',
   'BBH offices, used to roll figures up by location.', 'one row per office',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ADDV_TAB_35' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'AddVantage Table 35',
  business_description = 'An AddVantage lookup carried across under its source table number. TAB_35 is not expanded anywhere in the lineage — it needs a business name and an owner.',
  grain = 'one row per code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ADDV_TAB_35', 'AddVantage Table 35',
   'An AddVantage lookup carried across under its source table number. TAB_35 is not expanded anywhere in the lineage — it needs a business name and an owner.', 'one row per code',
   'Reference Data', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_BANK_NAME' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Bank Names',
  business_description = 'Banks referenced by accounts and instructions.',
  grain = 'one row per bank',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_BANK_NAME', 'Bank Names',
   'Banks referenced by accounts and instructions.', 'one row per bank',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_BRANCH' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Branch',
  business_description = 'The branch codes used across accounts and reporting, and the branch each one names.',
  grain = 'one row per branch',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_BRANCH', 'Branch',
   'The branch codes used across accounts and reporting, and the branch each one names.', 'one row per branch',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_CODE_DESC' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Code Descriptions',
  business_description = 'The general lookup: what every short code in the warehouse means.',
  grain = 'one row per code set per code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_CODE_DESC', 'Code Descriptions',
   'The general lookup: what every short code in the warehouse means.', 'one row per code set per code',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_CRD_BRANCHCODE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Branch Codes (Charles River)',
  business_description = 'Branch codes as Charles River uses them, mapped to BBH branches.',
  grain = 'one row per branch code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_CRD_BRANCHCODE', 'Branch Codes (Charles River)',
   'Branch codes as Charles River uses them, mapped to BBH branches.', 'one row per branch code',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_DISBURSEMENT_CODE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Disbursement Codes',
  business_description = 'What each disbursement code means.',
  grain = 'one row per disbursement code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_DISBURSEMENT_CODE', 'Disbursement Codes',
   'What each disbursement code means.', 'one row per disbursement code',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_INSTITUTION_CODE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Institution Codes',
  business_description = 'Financial institutions and their identifying codes.',
  grain = 'one row per institution',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_INSTITUTION_CODE', 'Institution Codes',
   'Financial institutions and their identifying codes.', 'one row per institution',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_IP_MAIL_LABEL_TITLE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Mailing Title',
  business_description = 'The salutation and title used when addressing a party on post.',
  grain = 'one row per title code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_IP_MAIL_LABEL_TITLE', 'Mailing Title',
   'The salutation and title used when addressing a party on post.', 'one row per title code',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_TRANSACTION_CODE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Transaction Codes',
  business_description = 'What each transaction code means, so a posting can be read without a lookup sheet.',
  grain = 'one row per transaction code',
  suggested_group = 'Reference Data',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_TRANSACTION_CODE', 'Transaction Codes',
   'What each transaction code means, so a posting can be read without a lookup sheet.', 'one row per transaction code',
   'Reference Data', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_ACCOUNT_SUMMARY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Account Summary',
  business_description = 'One summary line per account per period — the figures most reports open with.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_ACCOUNT_SUMMARY', 'Account Summary',
   'One summary line per account per period — the figures most reports open with.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_AUM' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Assets Under Management',
  business_description = 'The value of assets BBH manages or administers, by account and period.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_AUM', 'Assets Under Management',
   'The value of assets BBH manages or administers, by account and period.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_BENCHMARK' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark Returns',
  business_description = 'Returns for each benchmark, which portfolio performance is measured against.',
  grain = 'one row per benchmark per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_BENCHMARK', 'Benchmark Returns',
   'Returns for each benchmark, which portfolio performance is measured against.', 'one row per benchmark per period',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_BENCHMARK_TAB1' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark — Report Section 1',
  business_description = 'Benchmark figures arranged for the first section of the client report.',
  grain = 'one row per benchmark per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_BENCHMARK_TAB1', 'Benchmark — Report Section 1',
   'Benchmark figures arranged for the first section of the client report.', 'one row per benchmark per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_BENCHMARK_TAB2' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark — Report Section 2',
  business_description = 'Benchmark figures arranged for the second section of the client report.',
  grain = 'one row per benchmark per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_BENCHMARK_TAB2', 'Benchmark — Report Section 2',
   'Benchmark figures arranged for the second section of the client report.', 'one row per benchmark per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_BENCHMARK_TAB3' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark — Report Section 3',
  business_description = 'Benchmark figures arranged for the third section of the client report.',
  grain = 'one row per benchmark per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_BENCHMARK_TAB3', 'Benchmark — Report Section 3',
   'Benchmark figures arranged for the third section of the client report.', 'one row per benchmark per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_PERFORMANCE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance Returns',
  business_description = 'Returns for each account and period — what the portfolio actually did.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_PERFORMANCE', 'Performance Returns',
   'Returns for each account and period — what the portfolio actually did.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_PERFORMANCE_TAB1' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance — Report Section 1',
  business_description = 'Performance figures arranged for the first section of the client report.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_PERFORMANCE_TAB1', 'Performance — Report Section 1',
   'Performance figures arranged for the first section of the client report.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_PERFORMANCE_TAB2' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance — Report Section 2',
  business_description = 'Performance figures arranged for the second section of the client report.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_PERFORMANCE_TAB2', 'Performance — Report Section 2',
   'Performance figures arranged for the second section of the client report.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_FR_PERFORMANCE_TAB3' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance — Report Section 3',
  business_description = 'Performance figures arranged for the third section of the client report.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_FR_PERFORMANCE_TAB3', 'Performance — Report Section 3',
   'Performance figures arranged for the third section of the client report.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_MAP_DETAILS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'MAP Report Details',
  business_description = 'The detail lines of a MAP report. MAP is not expanded anywhere in the lineage — confirm before publishing.',
  grain = 'one row per report per line',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_MAP_DETAILS', 'MAP Report Details',
   'The detail lines of a MAP report. MAP is not expanded anywhere in the lineage — confirm before publishing.', 'one row per report per line',
   'Reporting & Analytics', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_MAP_HEADER' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'MAP Report Header',
  business_description = 'The header of a MAP report. MAP is not expanded anywhere in the lineage — confirm before publishing.',
  grain = 'one row per report',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_MAP_HEADER', 'MAP Report Header',
   'The header of a MAP report. MAP is not expanded anywhere in the lineage — confirm before publishing.', 'one row per report',
   'Reporting & Analytics', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_MONTHLY_FEES_AUM' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Fees Against AUM',
  business_description = 'Monthly fees set against the assets they were charged on.',
  grain = 'one row per account per month',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_MONTHLY_FEES_AUM', 'Fees Against AUM',
   'Monthly fees set against the assets they were charged on.', 'one row per account per month',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_NET_FLOW_AUM' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Net Flows',
  business_description = 'Money in and out, separated from market movement, so growth can be explained.',
  grain = 'one row per account per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_NET_FLOW_AUM', 'Net Flows',
   'Money in and out, separated from market movement, so growth can be explained.', 'one row per account per period',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_STATEMENT_CASH' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Statement Cash',
  business_description = 'Cash activity exactly as it was printed on a client statement.',
  grain = 'one row per statement per cash line',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_STATEMENT_CASH', 'Statement Cash',
   'Cash activity exactly as it was printed on a client statement.', 'one row per statement per cash line',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_STATEMENT_HOLDING' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Statement Holdings',
  business_description = 'Holdings exactly as they were printed on a client statement.',
  grain = 'one row per statement per holding',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_STATEMENT_HOLDING', 'Statement Holdings',
   'Holdings exactly as they were printed on a client statement.', 'one row per statement per holding',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_STATEMENT_STATUS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Statement Status',
  business_description = 'Whether each statement has been produced, held or sent.',
  grain = 'one row per statement',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_STATEMENT_STATUS', 'Statement Status',
   'Whether each statement has been produced, held or sent.', 'one row per statement',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_STMT_TRANSACTIONS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Statement Transactions',
  business_description = 'Transactions exactly as they were printed on a client statement.',
  grain = 'one row per statement per transaction',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_STMT_TRANSACTIONS', 'Statement Transactions',
   'Transactions exactly as they were printed on a client statement.', 'one row per statement per transaction',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FRCOUNT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance Load Count',
  business_description = 'Row counts from the performance load, used to check a file arrived whole.',
  grain = 'one row per load',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FRCOUNT', 'Performance Load Count',
   'Row counts from the performance load, used to check a file arrived whole.', 'one row per load',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FR_BENCHMARK_FILE_ENTRY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark File Load',
  business_description = 'Each benchmark file received, and whether it loaded.',
  grain = 'one row per file received',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FR_BENCHMARK_FILE_ENTRY', 'Benchmark File Load',
   'Each benchmark file received, and whether it loaded.', 'one row per file received',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FR_BEN_COUNT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark Load Count',
  business_description = 'Row counts from the benchmark load, used to check a file arrived whole.',
  grain = 'one row per load',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FR_BEN_COUNT', 'Benchmark Load Count',
   'Row counts from the benchmark load, used to check a file arrived whole.', 'one row per load',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FR_PERFORMANCE_FILE_ENTRY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance File Load',
  business_description = 'Each performance file received, and whether it loaded.',
  grain = 'one row per file received',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FR_PERFORMANCE_FILE_ENTRY', 'Performance File Load',
   'Each performance file received, and whether it loaded.', 'one row per file received',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'PBDW_REPORT_CONFIGURATION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Report Configuration',
  business_description = 'Which reports run, for whom, and with what options.',
  grain = 'one row per report configuration',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'PBDW_REPORT_CONFIGURATION', 'Report Configuration',
   'Which reports run, for whom, and with what options.', 'one row per report configuration',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_BENCHMARK_DESC' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark Descriptions',
  business_description = 'What each benchmark is and what it represents.',
  grain = 'one row per benchmark',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_BENCHMARK_DESC', 'Benchmark Descriptions',
   'What each benchmark is and what it represents.', 'one row per benchmark',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_BENCHMARK_MAPPING' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark Assignment',
  business_description = 'Which benchmark each account or asset class is measured against.',
  grain = 'one row per account or asset class per benchmark',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_BENCHMARK_MAPPING', 'Benchmark Assignment',
   'Which benchmark each account or asset class is measured against.', 'one row per account or asset class per benchmark',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_ASCT_SECTOR_MAPPING' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Asset Class to Sector Mapping',
  business_description = 'How asset classes map onto reporting sectors.',
  grain = 'one row per asset class per sector',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_ASCT_SECTOR_MAPPING', 'Asset Class to Sector Mapping',
   'How asset classes map onto reporting sectors.', 'one row per asset class per sector',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_ASSET_CLASS_MAPPING' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance Asset Class Mapping',
  business_description = 'How holdings map onto the asset classes performance is reported by.',
  grain = 'one row per holding classification',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_ASSET_CLASS_MAPPING', 'Performance Asset Class Mapping',
   'How holdings map onto the asset classes performance is reported by.', 'one row per holding classification',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_ASSET_SCHEMA' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Performance Asset Schema',
  business_description = 'The classification scheme performance reporting is built on.',
  grain = 'one row per schema entry',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_ASSET_SCHEMA', 'Performance Asset Schema',
   'The classification scheme performance reporting is built on.', 'one row per schema entry',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_BENCHMARK_APPROVAL' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Benchmark Approvals',
  business_description = 'Whether a benchmark assignment has been approved for use in client reporting.',
  grain = 'one row per benchmark assignment per approval',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_BENCHMARK_APPROVAL', 'Benchmark Approvals',
   'Whether a benchmark assignment has been approved for use in client reporting.', 'one row per benchmark assignment per approval',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_RISK_FREE_RATE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Risk-Free Rate',
  business_description = 'The rate used as the risk-free baseline in risk-adjusted return measures.',
  grain = 'one row per date',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_RISK_FREE_RATE', 'Risk-Free Rate',
   'The rate used as the risk-free baseline in risk-adjusted return measures.', 'one row per date',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_FR_SECTOR_ROLLUP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Sector Roll-Up',
  business_description = 'How detailed sectors combine into the sectors shown on a report.',
  grain = 'one row per detailed sector',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_FR_SECTOR_ROLLUP', 'Sector Roll-Up',
   'How detailed sectors combine into the sectors shown on a report.', 'one row per detailed sector',
   'Reporting & Analytics', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'RPT_SIGNIFICANT_FUNDS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Significant Funds',
  business_description = 'Funds large enough to need separate oversight.',
  grain = 'one row per fund per period',
  suggested_group = 'Reporting & Analytics',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'RPT_SIGNIFICANT_FUNDS', 'Significant Funds',
   'Funds large enough to need separate oversight.', 'one row per fund per period',
   'Reporting & Analytics', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'CFG_SECURITY_TYPE_CHANGE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Type Reclassifications',
  business_description = 'Securities whose type has been reclassified, and from what to what.',
  grain = 'one row per reclassification',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'CFG_SECURITY_TYPE_CHANGE', 'Security Type Reclassifications',
   'Securities whose type has been reclassified, and from what to what.', 'one row per reclassification',
   'Securities / Asset Master', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_SECURITY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security',
  business_description = 'Every instrument BBH can hold, with its identifiers and characteristics.',
  grain = 'one row per security',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_SECURITY', 'Security',
   'Every instrument BBH can hold, with its identifiers and characteristics.', 'one row per security',
   'Securities / Asset Master', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_SECURITY_UD' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security User-Defined Fields',
  business_description = 'Extra attributes the business records against a security.',
  grain = 'one row per security per field',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_SECURITY_UD', 'Security User-Defined Fields',
   'Extra attributes the business records against a security.', 'one row per security per field',
   'Securities / Asset Master', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_SECURITY_UD_HIST' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security User-Defined Fields — History',
  business_description = 'Previous values of those security attributes.',
  grain = 'one row per security per field per change',
  suggested_group = 'Securities / Asset Master',
  is_history = 'Y', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_SECURITY_UD_HIST', 'Security User-Defined Fields — History',
   'Previous values of those security attributes.', 'one row per security per field per change',
   'Securities / Asset Master', 'Y', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'PBDW_CSM_SECURITY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Compliance Security Master',
  business_description = 'Security attributes as the compliance system holds them. CSM is not expanded anywhere in the lineage.',
  grain = 'one row per security',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'PBDW_CSM_SECURITY', 'Compliance Security Master',
   'Security attributes as the compliance system holds them. CSM is not expanded anywhere in the lineage.', 'one row per security',
   'Securities / Asset Master', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_ISSUER' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Issuer',
  business_description = 'Who issued each security, used for issuer concentration and credit views.',
  grain = 'one row per issuer',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_ISSUER', 'Issuer',
   'Who issued each security, used for issuer concentration and credit views.', 'one row per issuer',
   'Securities / Asset Master', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_SECURITY_TYPE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Types',
  business_description = 'The instrument-type classification used throughout the warehouse.',
  grain = 'one row per security type',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_SECURITY_TYPE', 'Security Types',
   'The instrument-type classification used throughout the warehouse.', 'one row per security type',
   'Securities / Asset Master', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_SM_SECURITY' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Security Master Extract',
  business_description = 'Security attributes from the security master. SM is not expanded anywhere in the lineage.',
  grain = 'one row per security',
  suggested_group = 'Securities / Asset Master',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_SM_SECURITY', 'Security Master Extract',
   'Security attributes from the security master. SM is not expanded anywhere in the lineage.', 'one row per security',
   'Securities / Asset Master', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_ACCOUNT_ONLINE_ACCESS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Online Access',
  business_description = 'Who has online access to which account, and at what level.',
  grain = 'one row per account per user',
  suggested_group = 'Security / Access Reference',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_ACCOUNT_ONLINE_ACCESS', 'Online Access',
   'Who has online access to which account, and at what level.', 'one row per account per user',
   'Security / Access Reference', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'DIM_CRM_REQUEST_AUTHORIZER' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Request Authorisers',
  business_description = 'Who is entitled to approve each kind of request.',
  grain = 'one row per request per authoriser',
  suggested_group = 'Security / Access Reference',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'DIM_CRM_REQUEST_AUTHORIZER', 'Request Authorisers',
   'Who is entitled to approve each kind of request.', 'one row per request per authoriser',
   'Security / Access Reference', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'TWM001_USER_REF' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'User Reference (TWM001)',
  business_description = 'A user reference table carried across under its source system name. TWM001 is not expanded anywhere in the lineage — confirm what it stands for.',
  grain = 'one row per user',
  suggested_group = 'Security / Access Reference',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'TWM001_USER_REF', 'User Reference (TWM001)',
   'A user reference table carried across under its source system name. TWM001 is not expanded anywhere in the lineage — confirm what it stands for.', 'one row per user',
   'Security / Access Reference', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_K1_DETAIL' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Schedule K-1 Detail',
  business_description = 'Partnership income detail reported to investors on a Schedule K-1.',
  grain = 'one row per partner per tax year',
  suggested_group = 'Tax',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_K1_DETAIL', 'Schedule K-1 Detail',
   'Partnership income detail reported to investors on a Schedule K-1.', 'one row per partner per tax year',
   'Tax', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'REF_TRUST_TAX' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Trust Tax',
  business_description = 'Tax attributes of trust accounts, used for withholding and filing.',
  grain = 'one row per account',
  suggested_group = 'Tax',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'REF_TRUST_TAX', 'Trust Tax',
   'Tax attributes of trust accounts, used for withholding and filing.', 'one row per account',
   'Tax', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CASH_PROJECTION' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Projected Cash',
  business_description = 'Cash expected in and out on future dates, so an account''s forward position is visible.',
  grain = 'one row per account per future date',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CASH_PROJECTION', 'Projected Cash',
   'Cash expected in and out on future dates, so an account''s forward position is visible.', 'one row per account per future date',
   'Transactions & Journals', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CASH_SETTLEMENTS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Cash Settlements',
  business_description = 'Cash movements settling against trades and other activity.',
  grain = 'one row per settlement',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CASH_SETTLEMENTS', 'Cash Settlements',
   'Cash movements settling against trades and other activity.', 'one row per settlement',
   'Transactions & Journals', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_CHECK_REGISTER' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Check Register',
  business_description = 'Cheques issued against accounts and their status.',
  grain = 'one row per cheque',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_CHECK_REGISTER', 'Check Register',
   'Cheques issued against accounts and their status.', 'one row per cheque',
   'Transactions & Journals', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_DIV_INT_TEMP' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Dividends & Interest — Staging',
  business_description = 'Dividend and interest postings in progress. Not a reporting table.',
  grain = 'one row per posting, current batch',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'Y',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_DIV_INT_TEMP', 'Dividends & Interest — Staging',
   'Dividend and interest postings in progress. Not a reporting table.', 'one row per posting, current batch',
   'Transactions & Journals', 'N', 'Y',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_PENNY_IT' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Penny Test Items',
  business_description = 'Small-value verification items. IT is not expanded anywhere in the lineage — confirm before publishing.',
  grain = 'one row per item',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'low', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_PENNY_IT', 'Penny Test Items',
   'Small-value verification items. IT is not expanded anywhere in the lineage — confirm before publishing.', 'one row per item',
   'Transactions & Journals', 'N', 'N',
   'low', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_REGISTER_BALANCE' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Register Balance',
  business_description = 'The running balance the register reconciles to.',
  grain = 'one row per account per date',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'med', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_REGISTER_BALANCE', 'Register Balance',
   'The running balance the register reconciles to.', 'one row per account per date',
   'Transactions & Journals', 'N', 'N',
   'med', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_TRADES' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Trades',
  business_description = 'Buy and sell orders and how they were executed.',
  grain = 'one row per trade',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_TRADES', 'Trades',
   'Buy and sell orders and how they were executed.', 'one row per trade',
   'Transactions & Journals', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
MERGE INTO business_catalog t
USING (SELECT 'PBDW' AS data_source, 'FACT_TRANSACTIONS' AS table_name FROM dual) s
ON (t.data_source = s.data_source AND t.table_name = s.table_name)
WHEN MATCHED THEN UPDATE SET
  business_name = 'Transactions',
  business_description = 'Every posting against an account — purchases, sales, income, fees, transfers.',
  grain = 'one row per transaction',
  suggested_group = 'Transactions & Journals',
  is_history = 'N', is_staging = 'N',
  confidence = 'high', updated_at = SYSTIMESTAMP
  WHERE t.review_status = 'DRAFT'
WHEN NOT MATCHED THEN INSERT
  (data_source, table_name, business_name, business_description, grain,
   suggested_group, is_history, is_staging, confidence, review_status,
   source_of_text)
  VALUES ('PBDW', 'FACT_TRANSACTIONS', 'Transactions',
   'Every posting against an account — purchases, sales, income, fees, transfers.', 'one row per transaction',
   'Transactions & Journals', 'N', 'N',
   'high', 'DRAFT', 'GENERATED');
COMMIT;
