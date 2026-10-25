// PB Notifications — the design of the Client Portal e-mail notification
// utility (PBCP-5587) on the Integration Hub framework. Not SEI: a BBH
// pipeline, the first to be built on the Hub's own Airflow, metadata and
// guardrail event tables.
//
// WHAT THIS PAGE IS. The requirement as the business wrote it, the four
// source extracts reviewed against it, the design we propose for the Hub,
// the data model, the e-mail content, and every gap that has to close
// before a production run. Each item is marked REQUIRED (the business
// said it), PROPOSED (our design) or OPEN (a question the business or PB
// Systems has to answer). Nothing here is agreed until an OPEN item is
// closed in writing.
//
// NO CLIENT DATA. Table and column names, counts and rules only. The
// address on the test extract is not reproduced; no user id, account
// number or e-mail address appears here.
import React, { useState } from "react";
import { tLight } from "./bbhTheme.js";

export const MARK = {
  REQUIRED: { label: "REQUIRED", c: "#0f4775", t: "the business requirement, as written in PBCP-5587" },
  PROPOSED: { label: "PROPOSED", c: "#159943", t: "our design on the Hub framework; open for review" },
  OPEN: { label: "OPEN", c: "#c96a12", t: "a question PB business or PB Systems has to answer before build" },
};
const mono = { fontFamily: "monospace" };

export const TABS = [["overview", "Overview"], ["req", "Requirements"], ["design", "Design on the Hub"], ["model", "Data model"], ["sources", "Source review"], ["content", "E-mail content"], ["gaps", "Open gaps"], ["exc", "Exceptions"]];

// ---------------------------------------------------------------- data ----
export const BACKGROUND = [
  "Clients with Client Portal access and a disposition to receive e-mails get one when a Statement or Trade Confirm is posted for an account they are linked to. Notifications can be suppressed in the Portal.",
  "Since the 2017 Portal launch, PB clients no longer use the Statements Online product unless they also hold 7-digit UAF custody accounts. All AddVantage statements are posted to the Portal, but Statements Online must still be added as an Infuse product on the client's WorldView/BPC ID for them to view statements there.",
  "The only e-mails the Portal sends today confirm changes to (1) e-mail address, (2) mailing address and (3) delivery disposition. The posting notification itself has been riding on a legacy InServ process. After the STT transaction PB has to perform this function itself.",
];
export const ENHANCEMENT = "Build an e-mail notification utility that fires when documents are posted to the Client Portal: Statements, Trade Confirms, 1099 and K-1 tax documents. Clients may opt out of some document types. It lets PB Systems close the legacy InServ notification process.";

export const REQUIREMENTS = [
  ["R1", "Send to active external clients only (DELETED_IND = N) when a document is posted to the Portal.", "REQUIRED"],
  ["R2", "Eligibility is by document type and the user's e-mail notification preferences.", "REQUIRED"],
  ["R3", "For 1099 and K-1 tax reports an active client always receives the notification; preferences do not apply.", "REQUIRED"],
  ["R4", "For each document type, every active external client associated with the account is notified.", "REQUIRED"],
  ["R5", "Send to the active user's e-mail address on file in the data warehouse.", "REQUIRED"],
  ["R6", "Send after the day's posting process on the Portal is complete. The business suggests 8:00 a.m. ET.", "OPEN"],
  ["R7", "One notification per user per day per notification type (RPT_ID family). Statements and Trade Confirms posted the same day produce one combined e-mail.", "REQUIRED"],
  ["R8", "Keep one tracking table: a record per eligible user, notification type and processing date, with status Processing, Sent or Failed. No separate STATEMENT and CONFIRM records.", "REQUIRED"],
  ["R9", "Track undeliverable 1099 and K-1 e-mails and make them available to the user's Relationship Manager and Relationship Associate.", "REQUIRED"],
];

// The per-type rule, as the requirement states it and as we read it.
export const TYPES = [
  { key: "STATEMENT_CONFIRM", title: "Statements · Trade Confirms", source: "TPW101_STMT_RPT (RPT_ID SUNGARD1) · TPW102_CNF_RPT (RPT_ID SUNGARD2)", posted: "SUBSTR(RPT_VRSN_NAM, 1, 8) = the processing date",
    preference: "TWM049_SUPPRESS_EMAIL per user and account: send when the user is not on the table, or when at least one associated account with a posted document has IS_STMNT_SUPPRESSED = N (statements) or IS_CNFRM_SUPPRESSED = N (confirms). Evaluated separately per document type; an opt-out on one account does not suppress another account's document.",
    outcome: "one STATEMENT_CONFIRM record per user per day; the e-mail is statements-only, confirms-only or combined from the two received flags", always: false },
  { key: "1099", title: "1099 tax documents", source: "TPW103_TAX_DOC_RPT", posted: "SUBSTR(RPT_VRSN_NAM, 1, 8) = the processing date AND ESTIMATE_IND = N",
    preference: "none: an active external user always receives it", outcome: "one 1099 record per user per day, consolidating every qualifying account; a delivery failure goes to the RM and RA", always: true },
  { key: "K1", title: "K-1 tax documents", source: "TPW103_TAX_DOC_RPT with the report name from TPW005_MOBIUS_MAP", posted: "SUBSTR(RPT_VRSN_NAM, 1, 8) = the processing date AND ESTIMATE_IND = N AND TAX_YR_NUM = the prior calendar year",
    preference: "none: an active external user always receives it", outcome: "one K1 record per user per day listing each distinct K-1 report name once; a delivery failure goes to the RM and RA", always: true },
];

// The notification type grid, as the business wrote it.
export const GRID = [
  ["Statements only", "once per day · 8:00 a.m. ET after posting", "active external user with at least one qualifying Statement or Loan Statement on an associated account", "honour account-level statement preferences; send if at least one qualifying account permits", "one statements-focused e-mail; no mention of Trade Confirms"],
  ["Trade Confirms only", "once per day · 8:00 a.m. ET after posting", "active external user with at least one qualifying Trade Confirm on an associated account", "honour account-level confirm preferences; send if at least one qualifying account permits", "one confirms-focused e-mail; no mention of Statements"],
  ["Statements and Trade Confirms", "once per day · 8:00 a.m. ET after posting", "at least one eligible Statement and at least one eligible Trade Confirm on the same processing day", "evaluate per account and per document type; an opt-out on one account does not suppress another", "one combined e-mail listing only the types still eligible"],
  ["1099 tax documents", "once per day · 8:00 a.m. ET after posting", "at least one final qualifying 1099-family document on any account of an active external user", "preferences do not apply; consolidate all qualifying accounts", "one 1099 e-mail; a delivery failure made available to the RM and RA"],
  ["K-1 tax documents", "once per day · 8:00 a.m. ET after posting", "at least one final K-1 for the prior tax year on any account of an active external user", "preferences do not apply; each distinct K-1 fund or report name once", "one consolidated K-1 e-mail; a delivery failure made available to the RM and RA"],
];

export const TRACKING_FIELDS = [
  ["NOTIFICATION_ID", "unique identifier of the notification record"],
  ["USER_ID", "the Portal user receiving the notification"],
  ["NOTIFICATION_TYPE", "STATEMENT_CONFIRM · 1099 · K1"],
  ["PROCESS_DATE", "the business date for which documents were identified"],
  ["EMAIL_STATUS", "Processing · Sent · Failed"],
  ["CREATED_TS", "when the record was created"],
  ["SENT_TS", "when the e-mail was sent"],
  ["ERROR_MESSAGE", "the most recent delivery error, when there is one"],
];
export const STATUSES = [["Processing", "the record was just created; the e-mail has not been handed to the relay"], ["Sent", "the relay accepted the e-mail; SENT_TS stamped"], ["Failed", "the relay refused it or it bounced; ERROR_MESSAGE holds the last error"]];

// The design on the Hub framework: one daily DAG, eight tasks.
export const FLOW = [
  ["Wait for posting complete", "a sensor on a posting-cycle completion record for the processing date; the 8:00 a.m. ET time is the latest start, not the trigger", "PROPOSED"],
  ["Load eligibility", "three read-only queries against the Portal's Oracle schema: statements and confirms with the suppression rule, 1099, K-1 with the Mobius report name; one row per user per type, K-1 detail rows kept apart. In the proof of concept the same queries' output is read from the four workbooks", "PROPOSED"],
  ["Resolve the address", "left join to the current interested-party record (END_DATE IS NULL, portal id and e-mail present); a user with no address becomes an exception row, never a silent drop", "PROPOSED"],
  ["Write candidates", "PB_NOTIFICATION_CANDIDATE, one row per USER_ID, NOTIFICATION_TYPE, PROCESS_DATE; K-1 report lines in PB_NOTIFICATION_K1_DETAIL", "PROPOSED"],
  ["Open tracking records", "PB_NOTIFICATION_TRACKING as Processing; the unique key (USER_ID, NOTIFICATION_TYPE, PROCESS_DATE) is the duplicate guard, so a rerun cannot send twice", "PROPOSED"],
  ["Render the template", "chosen from the two received flags for STATEMENT_CONFIRM, fixed for 1099 and K1; the K-1 body lists each distinct report description once", "PROPOSED"],
  ["Send", "through the internal mail relay, one message per tracking record; the environment safeguard rewrites every address outside production", "PROPOSED"],
  ["Record the outcome", "Sent with SENT_TS, or Failed with the error; a guardrail event per run with counts per type; failed 1099 and K1 rows exposed to the RM and RA through the Hub's relationship-team source", "PROPOSED"],
];
// Two modes, one pipeline. The proof of concept reads the four workbooks;
// the built utility runs the same queries against the Portal's Oracle
// schema. Everything after the eligibility step is identical.
export const MODES = [
  ["Eligibility input", "the four Excel extracts under local-data, read by the loader; the SQL sheet in each workbook is the query that produced it", "the same four queries run against the Portal's Oracle schema through a pooled read-only connection, PROCESS_DATE bound rather than SYSDATE"],
  ["Address", "External_users_emailAddress.xlsx, every row the QA address", "the current interested-party record in the warehouse, END_DATE IS NULL"],
  ["Candidate and tracking tables", "the same three tables, in the Hub schema", "the same"],
  ["Sending", "the internal relay with every recipient rewritten to the test address", "the internal relay to the real address, in production only"],
  ["Evidence", "guardrail event per run, counts per type", "the same, plus the RM and RA view of failed tax notifications"],
  ["What it proves", "the rules, the templates, the one-record-per-day guard and the counts, on data the business can check against the sheets", "the daily run end to end, with the Oracle reads replacing the files and nothing else changing"],
];
export const HUB_FIT = [
  ["Orchestration", "one Airflow DAG in the Hub namespace, daily, business-date aware, retries and alert callbacks as the DAG standards require", "the same scheduler that runs the data pipeline"],
  ["Reads", "the Portal schema's TPW and TWM tables through pooled read-only connections; no table is modified", "KubernetesPodOperator tasks, one per query"],
  ["Writes", "the three PB_NOTIFICATION tables in the Hub's own schema, created by a Liquibase changeset in this application's db/changelog", "the schema stage of the application job"],
  ["Evidence", "a guardrail event per run and per notification type with candidate, sent and failed counts; the tracking table itself is the audit", "guardrail_events · CP 360 metadata"],
  ["Operations", "failures surface on Quality Guardrails; the RM and RA view of failed tax notifications is a Hub screen reading PB_NOTIFICATION_TRACKING", "CP 360 screens"],
  ["Secrets", "the relay and the read-only Portal account from the namespace secret, Vault later, as for every Hub job", "no credential in the repository"],
];

// The Airflow implementation: one DAG, its settings, its tasks and how they
// depend on each other. Written to the Hub's DAG standards (naming,
// schedule, retries, callbacks, no credentials, small XComs), which Gate 1
// checks on every pull request.
export const ORCHESTRATION = {
  dag: [
    ["dag_id", "pb_notification_daily", "the standard: domain, subject, cadence"],
    ["schedule", "weekdays, one run per processing date, started at 07:30 ET so the posting sensor has until the 08:00 ET latest start", "catchup=False; a missed day is rerun by hand with the date in the trigger conf"],
    ["processing date", "the business date of the posting cycle, from the run's logical date through the Hub's business-date helper; never SYSDATE", "PROCESS_DATE is bound into every query and written on every row"],
    ["default_args", "owner the PB Systems team, retries 2, retry_delay 5 minutes, e-mail and chat callbacks on failure and on SLA miss", "the DAG standards' minimums"],
    ["max_active_runs", "1", "two runs on the same date would race on the tracking table; the unique key would refuse the second, but one run at a time is cleaner"],
    ["pool", "pb_notify_relay, a small pool so the send task never floods the relay", "the only concurrency knob the relay needs"],
    ["params", "process_date (optional override), source (oracle or excel), send_mode (test or live)", "a manual trigger can rerun a date or run the proof of concept on the workbooks; send_mode is live only in production"],
    ["XCom", "counts and the processing date only; never a user id, address or document", "the DAG standards forbid large or personal payloads"],
    ["secrets", "the read-only Portal account and the relay credentials from the namespace Secret, mounted into the task pods", "nothing in the DAG file or the repository"],
  ],
  tasks: [
    ["wait_posting_complete", "sensor, mode reschedule, poke every 5 minutes, timeout at the 08:00 ET latest start", "polls the posting process's completion record for the processing date", "the date is complete", "on timeout: fail the run and alert; nothing downstream starts"],
    ["eligibility_stmt_confirm", "KubernetesPodOperator on the workbench image", "runs the statements-and-confirms query with the suppression rule, PROCESS_DATE bound", "rows into PB_NOTIFICATION_CANDIDATE staging, one per user", "retry twice; an Oracle error fails the task, not the date"],
    ["eligibility_1099", "KubernetesPodOperator on the workbench image", "runs the 1099 query against the reference table of report ids, ESTIMATE_IND = N", "rows per user", "the same"],
    ["eligibility_k1", "KubernetesPodOperator on the workbench image", "runs the K-1 query for the prior tax year with the Mobius report name", "a header row per user and detail rows per report id", "the same; a null description follows the G12 decision"],
    ["resolve_address", "KubernetesPodOperator", "left-joins the candidates to the current interested-party record", "EMAIL_ADDRESS on each candidate; an exception row per unmatched user", "never drops a row"],
    ["write_candidates", "KubernetesPodOperator", "merges the staged rows into PB_NOTIFICATION_CANDIDATE and PB_NOTIFICATION_K1_DETAIL for the date", "the day's candidates, idempotent on the unique key", "a rerun rewrites the same rows"],
    ["open_tracking", "KubernetesPodOperator", "inserts a PB_NOTIFICATION_TRACKING row as Processing per candidate; existing rows for the date are left as they are", "one tracking row per user and type", "the unique key is the duplicate guard"],
    ["render_and_send", "KubernetesPodOperator in the pb_notify_relay pool", "for each tracking row in Processing or Failed under the attempt limit: pick the template from the flags, render, send through the relay; in send_mode test every recipient is rewritten", "Sent with SENT_TS, or Failed with the error and ATTEMPT_COUNT", "one message's failure never stops the batch; the task fails only if the relay is unreachable"],
    ["publish_run_event", "the Hub's guardrail event task", "writes one guardrail event per notification type with candidate, exception, sent and failed counts", "the run's evidence in the CP 360 metadata", "always runs, on success and on failure, so the dashboard sees every run"],
    ["notify_rm_ra", "the Hub's relationship-team task", "lists Failed 1099 and K1 rows for the date and makes them available to the user's RM and RA", "the undeliverable view", "depends on the G13 source; until then the task logs the count and the screen shows the rows"],
  ],
  deps: "wait_posting_complete >> [eligibility_stmt_confirm, eligibility_1099, eligibility_k1] >> resolve_address >> write_candidates >> open_tracking >> render_and_send >> [publish_run_event, notify_rm_ra]; publish_run_event has trigger_rule all_done.",
  rules: [
    "Idempotent by construction: every task writes by the date's key and the tracking key, so re-running any task or the whole date sends nothing twice and loses nothing.",
    "The three eligibility tasks run in parallel; nothing downstream starts until all three have finished, because a user can be in more than one type and the candidate write is one merge.",
    "The send task is the only one that leaves the Hub, and it is the only one in the pool; everything else is Oracle in and Oracle out.",
    "A rerun is a manual trigger with process_date in the conf; catchup is off so a paused DAG does not wake up and send days of e-mails.",
    "Gate 1 reads the DAG file statically on every pull request: naming, schedule, retries, callbacks, no credentials, no module-scope I/O; Gate 5 scans its Python.",
  ],
};

export const MODEL = {
  candidate: { name: "PB_NOTIFICATION_CANDIDATE", grain: "one row per USER_ID, NOTIFICATION_TYPE, PROCESS_DATE", cols: [
    ["PROCESS_DATE", "DATE", "the posting cycle's business date, from the completion record"],
    ["USER_ID", "VARCHAR2(30)", "the Portal user"],
    ["EMAIL_ADDRESS", "VARCHAR2(320)", "resolved from the interested-party record; null becomes an exception"],
    ["NOTIFICATION_TYPE", "VARCHAR2(30)", "STATEMENT_CONFIRM · 1099 · K1"],
    ["RECEIVED_STATEMENT · STATEMENT_MONTH · STATEMENT_ACCOUNT_COUNT", "CHAR(1) · VARCHAR2(15) · NUMBER(10)", "the statement half of the combined type"],
    ["RECEIVED_CONFIRM · CONFIRM_MONTH · CONFIRM_ACCOUNT_COUNT", "CHAR(1) · VARCHAR2(15) · NUMBER(10)", "the confirm half"],
    ["RECEIVED_1099 · TAX_DOCUMENT_MONTH · TAX_ACCOUNT_COUNT", "CHAR(1) · VARCHAR2(20) · NUMBER(10)", "the 1099 type"],
    ["RECEIVED_K1 · TAX_YEAR", "CHAR(1) · NUMBER(4)", "the K-1 header; the report lines are in the detail table"],
    ["SOURCE_CREATED_TS", "TIMESTAMP", "when the eligibility run wrote the row"],
  ], keys: "UNIQUE (USER_ID, NOTIFICATION_TYPE, PROCESS_DATE); CHECK on the type and on every Y/N flag" },
  detail: { name: "PB_NOTIFICATION_K1_DETAIL", grain: "one row per PROCESS_DATE, USER_ID, RPT_ID", cols: [
    ["PROCESS_DATE · USER_ID", "DATE · VARCHAR2(30)", "the header it belongs to"],
    ["TAX_YEAR", "NUMBER(4)", "the prior calendar year"],
    ["RPT_ID", "VARCHAR2(30)", "the K-1 report identifier"],
    ["RPT_DESCRIPTION", "VARCHAR2(255)", "the fund or report name from TPW005_MOBIUS_MAP; NOT NULL, see the open gap"],
    ["ACCOUNT_COUNT", "NUMBER(10)", "distinct accounts of the user holding that report"],
  ], keys: "PRIMARY KEY (PROCESS_DATE, USER_ID, RPT_ID)" },
  tracking: { name: "PB_NOTIFICATION_TRACKING", grain: "one row per USER_ID, NOTIFICATION_TYPE, PROCESS_DATE", cols: [
    ["NOTIFICATION_ID", "NUMBER identity", "the record"],
    ["USER_ID · NOTIFICATION_TYPE · PROCESS_DATE", "VARCHAR2(30) · VARCHAR2(30) · DATE", "the daily key; the duplicate guard"],
    ["EMAIL_ADDRESS", "VARCHAR2(320)", "the address actually used"],
    ["EMAIL_STATUS", "VARCHAR2(20)", "Processing (default) · Sent · Failed"],
    ["ATTEMPT_COUNT · LAST_ATTEMPT_TS", "NUMBER(5) · TIMESTAMP", "retries, so a Failed row says how many times"],
    ["CREATED_TS · SENT_TS", "TIMESTAMP", "created, and sent when it was"],
    ["ERROR_MESSAGE", "VARCHAR2(4000)", "the most recent delivery error"],
  ], keys: "UNIQUE (USER_ID, NOTIFICATION_TYPE, PROCESS_DATE); CHECK on type and status" },
};

// The four Excel extracts reviewed against the requirement. Counts and
// structure only; the test extract's single QA address is not reproduced.
export const SOURCES = [
  { file: "1099_Notification.xlsx", purpose: "users eligible for a daily 1099 notification", grain: "one row per Portal user", rows: 1226, unmatched: 10,
    cols: ["WEB_PORTAL_ID", "RECEIVED_1099", "TAX_DOCUMENT_MONTH", "ACCOUNT_COUNT"],
    profile: "1,226 users; RECEIVED_1099 is Y throughout; one document month throughout; ACCOUNT_COUNT 1 to 9, 1,681 user-account pairs in total",
    fit: "already at the one-row-per-user grain for one consolidated e-mail" },
  { file: "K1_Notification.xlsx", purpose: "users and K-1 reports eligible for notification", grain: "one row per Portal user and K-1 report id", rows: 3372, unmatched: 22,
    cols: ["WEB_PORTAL_ID", "RECEIVED_K1", "TAX_YEAR", "RPT_ID", "RPT_DESCRIPTION", "ACCOUNT_COUNT"],
    profile: "3,372 rows over 2,588 users; three report ids; ACCOUNT_COUNT 1 to 22, 6,075 report-account pairs; a user with two reports appears twice",
    fit: "report-detail grain: the utility must group a user's rows into one e-mail and list each description once; a user-level header record is still needed" },
  { file: "Statements_TradeConfirms_Data.xlsx", purpose: "statement and confirm eligibility, pre-split into the three e-mail outcomes", grain: "one row per user per outcome sheet", rows: 6205, unmatched: 57,
    cols: ["USER_ID", "RECEIVED_STATEMENT", "STATEMENT_MONTH", "STATEMENT_ACCOUNT_COUNT", "RECEIVED_CONFIRM", "CONFIRM_MONTH", "CONFIRM_ACCOUNT_COUNT"],
    profile: "statements only 5,080 users (44 unmatched); confirms only 671 (7 unmatched); both 454 (6 unmatched); account counts up to 112 statements and 22 confirms for one user",
    fit: "all three sheets are one notification type; the two received flags already choose the template. Production should consume one consolidated set so a user cannot sit in two sheets on the same cycle" },
  { file: "External_users_emailAddress.xlsx", purpose: "maps the Portal user id to the notification address", grain: "one row per Portal user", rows: 8555, unmatched: 0,
    cols: ["BBH_WEB_PORTAL_ID", "E_MAIL_ADDRESS"],
    profile: "8,555 unique ids; every row carries the same QA address, so this is a controlled test extract, not a distribution list; the SQL takes current interested-party rows with END_DATE IS NULL",
    fit: "the join key for all three eligibility sources; a missing match is a rejected notification, never a dropped row" },
];
export const JOINS = [
  ["1099", "WEB_PORTAL_ID", "= EMAIL.BBH_WEB_PORTAL_ID"],
  ["K-1", "WEB_PORTAL_ID", "= EMAIL.BBH_WEB_PORTAL_ID"],
  ["Statements and confirms", "USER_ID", "= EMAIL.BBH_WEB_PORTAL_ID"],
];

// The e-mail content, as the business wrote it. Placeholders in brackets.
export const CONTENT = [
  { key: "STATEMENT", when: "RECEIVED_STATEMENT = Y and RECEIVED_CONFIRM = N", subject: "Online Statements Available",
    body: "This email is to notify you that Statement(s) are available on the BBH Client Portal. To access the Portal, please click on the attached link and enter your User ID and Password under Client Login. [link to the Statements view of the Statements & Documents tab] If you require further assistance, please contact your Relationship Management Team or the BBH Client Support Center at 1-800-285-5093.",
    fields: "USER_ID · EMAIL_ADDRESS · STATEMENT_MONTH · STATEMENT_ACCOUNT_COUNT" },
  { key: "CONFIRM", when: "RECEIVED_STATEMENT = N and RECEIVED_CONFIRM = Y", subject: "Online Trade Confirms Available",
    body: "This email is to notify you that Trade Confirms are available on the BBH Client Portal. To access the Portal, please click on the attached link and enter your User ID and Password under Client Login. [link to the Confirms view of the Statements & Documents tab] If you require further assistance, please contact your Relationship Management Team or the BBH Client Support Center at 1-800-285-5093.",
    fields: "USER_ID · EMAIL_ADDRESS · CONFIRM_MONTH · CONFIRM_ACCOUNT_COUNT" },
  { key: "BOTH", when: "both received flags = Y", subject: "Online Statements and Trade Confirms Available",
    body: "This email is to notify you that Statement(s) and Trade Confirms are available on the BBH Client Portal. To access the Portal, please click on the attached link and enter your User ID and Password under Client Login. [link to the All Types view of the Statements & Documents tab] If you require further assistance, please contact your Relationship Management Team or the BBH Client Support Center at 1-800-285-5093.",
    fields: "both field groups" },
  { key: "1099", when: "NOTIFICATION_TYPE = 1099", subject: "1099 Posted to Client Portal – IMPORTANT TAX RETURN DOCUMENT AVAILABLE",
    body: "This email is to notify you that 1099s are available on the BBH Client Portal. To access the Portal, please click on the attached link and enter your User ID and Password under Client Login. [link to the Tax Reports view of the Statements & Documents tab] If you require further assistance, please contact your Relationship Management Team or the BBH Client Support Center at 1-800-285-5093.",
    fields: "USER_ID · EMAIL_ADDRESS · TAX_DOCUMENT_MONTH · TAX_ACCOUNT_COUNT" },
  { key: "K1", when: "NOTIFICATION_TYPE = K1", subject: "K-1(s) Posted to Client Portal – IMPORTANT TAX RETURN DOCUMENT AVAILABLE",
    body: "This email is to notify you that K-1s for the following funds are available on the BBH Client Portal. To access the Portal, please click on the attached link and enter your User ID and Password under Client Login. [link to the Tax Reports view of the Statements & Documents tab] [each posted K-1 RPT_DES from TPW005_MOBIUS_MAP associated with the user's accounts, once] If you require further assistance, please contact your Relationship Management Team or the BBH Client Support Center at 1-800-285-5093.",
    fields: "USER_ID · EMAIL_ADDRESS · TAX_YEAR · the distinct K-1 report descriptions" },
];
export const SENDER = "BBH Client Portal";

// Every gap found reviewing the requirement and the four extracts.
export const GAPS = [
  ["G1", "critical", "No processing date in any extract. PROCESS_DATE must be a real DATE from the posting cycle, not the file name, the run date or the document month.", "add PROCESS_DATE to the eligibility queries from the completion record", "OPEN"],
  ["G2", "critical", "Unmatched Portal ids against the e-mail source: 10 on 1099, 22 on K-1, 44 statements only, 7 confirms only, 6 combined.", "an exception row per unmatched user with reason EMAIL_ADDRESS_NOT_FOUND; the run is Sent for the rest and reports the count", "PROPOSED"],
  ["G3", "critical", "Every address in the e-mail extract is one QA address. Fine for a controlled test; a production run needs a positive safeguard.", "the environment safeguard rewrites every recipient outside production and refuses to run in production against a test extract", "PROPOSED"],
  ["G4", "critical", "No active-user evidence in the outputs: USER_TYPE and DELETED_IND are applied in the SQL but not visible afterwards.", "carry USER_TYPE and DELETED_IND into an audit extract, or record the filter applied on the guardrail event", "PROPOSED"],
  ["G5", "critical", "The extracts hold eligibility, not delivery state. Tracking fields have to live in their own table.", "PB_NOTIFICATION_TRACKING as designed", "PROPOSED"],
  ["G6", "rule", "The worked examples say a client does not receive the e-mail when all accounts have the suppression flag N, which contradicts N meaning not suppressed.", "confirm the reading: N permits, Y suppresses; send when at least one qualifying account is N or no suppression row exists", "OPEN"],
  ["G7", "rule", "The combined type must evaluate statements and confirms independently; the same account need not permit both.", "eligible_statement and eligible_confirm computed separately, then combined", "PROPOSED"],
  ["G8", "rule", "8:00 a.m. ET is only safe if posting is guaranteed complete by then.", "trigger on a posting-cycle completion record, with 8:00 a.m. ET as the latest start and an alert if the record has not arrived", "OPEN"],
  ["G9", "rule", "The 1099 narrative names TX1099 and TX1099R; the supplied SQL also includes TXINFO, TX5498 and TX1042S.", "one approved definition of the 1099 family, held in a reference table rather than in the query", "OPEN"],
  ["G10", "rule", "The 1099 requirement says final documents only (ESTIMATE_IND = N) but the supplied 1099 SQL does not apply that predicate.", "add ESTIMATE_IND = N to the 1099 query if estimated documents can occur", "OPEN"],
  ["G11", "rule", "K-1 is defined by excluding seven non-K-1 report ids, so any new tax report id would be treated as a K-1.", "a positive K-1 classification from TPW005_MOBIUS_MAP", "OPEN"],
  ["G12", "rule", "The K-1 query left-joins the report name, so a row with no RPT_DESCRIPTION is possible even though the extract has none.", "decide: fail the run, fall back to RPT_ID, or exclude and report as a data-quality exception", "OPEN"],
  ["G13", "data", "No source carries the Relationship Manager or Relationship Associate, yet failed tax notifications must reach them.", "a relationship-team source keyed by user id; the Hub's interested-party data is the candidate", "OPEN"],
  ["G14", "data", "The statements and confirms extract is split into three sheets, which can place a user in two sheets on the same cycle.", "one consolidated daily set; the two flags choose the template", "PROPOSED"],
];

// What can go wrong on a run, and what the utility does.
export const EXCEPTIONS = [
  ["Posting not complete by the latest start", "the sensor times out", "no candidates written; alert the operator; the run retries when the completion record arrives", "HOLD"],
  ["Rerun on the same processing date", "the tracking key already exists", "existing Sent rows untouched; Processing and Failed rows retried; nothing sent twice", "SKIP"],
  ["User with no e-mail address", "the interested-party join finds nothing", "exception row EMAIL_ADDRESS_NOT_FOUND; counted on the run; not a tracking record", "REJECT"],
  ["User present in two statement sheets", "a consolidated set should make this impossible", "the unique key refuses the second; logged as a source defect", "REJECT"],
  ["Relay refuses the message", "SMTP error", "Failed with the error; retried up to the attempt limit; 1099 and K1 failures exposed to the RM and RA", "RETRY"],
  ["Bounce after acceptance", "a delivery status notification arrives later", "the tracking row moves from Sent to Failed with the bounce reason; 1099 and K1 to the RM and RA", "FLAG"],
  ["K-1 row with no report description", "left join to TPW005_MOBIUS_MAP found nothing", "per the open decision: fail, fall back to RPT_ID, or exclude and report", "OPEN"],
  ["Estimated tax document on the posting date", "ESTIMATE_IND = Y", "excluded from 1099 and K1 eligibility; not a notification", "SKIP"],
  ["Suppression row with both flags Y on every account", "the user opted out everywhere", "no STATEMENT_CONFIRM candidate; nothing tracked, by design", "SKIP"],
  ["Test extract in production", "every address identical, or the environment safeguard tripped", "the run refuses to send; alert", "HOLD"],
];
export const OUTCOME = { HOLD: "#c96a12", SKIP: "#6b7884", REJECT: "#b42318", RETRY: "#0f4775", FLAG: "#7c3aed", OPEN: "#c96a12" };

// ------------------------------------------------------------- figures ----
const ink = (t) => t.text, mut = (t) => t.textMuted;
function FlowFig({ t }) {
  const W = 1120, bw = 128, gap = 10, x0 = 12;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} 150`} role="img" style={{ display: "block", minWidth: 860, width: "100%", height: "auto" }}
        aria-label={`The daily notification run as one Airflow DAG with eight tasks in order: ${FLOW.map(([n]) => n).join(", ")}. The tracking table's unique key per user, type and processing date is the duplicate guard; failed 1099 and K-1 deliveries are exposed to the Relationship Manager and Associate.`}>
        <defs><marker id="pbn-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        <text x={x0} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>ONE DAILY DAG · EIGHT TASKS · ON THE HUB SCHEDULER</text>
        {FLOW.map(([name, , mark], i) => { const x = x0 + i * (bw + gap); const c = MARK[mark].c; return (
          <g key={name}>
            <rect x={x} y={30} width={bw} height={60} rx={4} fill={t.panel} stroke={c} strokeWidth={1.6} />
            <text x={x + 7} y={43} fontSize={8} fontWeight={800} fill={c}>{i + 1}</text>
            {name.split(" ").reduce((acc, w) => { const l = acc[acc.length - 1]; if (l && (l + " " + w).length <= 16) acc[acc.length - 1] = l + " " + w; else acc.push(w); return acc; }, []).slice(0, 3)
              .map((l, j) => <text key={j} x={x + 7} y={58 + j * 12} fontSize={10} fontWeight={700} fill={ink(t)}>{l}</text>)}
            {i < FLOW.length - 1 && <path d={`M${x + bw + 1} 60 L${x + bw + gap - 1} 60`} stroke={mut(t)} strokeWidth={1.2} markerEnd="url(#pbn-arr)" />}
          </g>); })}
        <text x={x0} y={112} fontSize={9.5} fill={mut(t)}>Reads: TPW101_STMT_RPT · TPW102_CNF_RPT · TPW103_TAX_DOC_RPT · TPW005_MOBIUS_MAP · TWM001_USER_REF · TWM002_USER_ACCOUNT_MAP · TWM049_SUPPRESS_EMAIL · the interested-party address</text>
        <text x={x0} y={128} fontSize={9.5} fill={mut(t)}>Writes: PB_NOTIFICATION_CANDIDATE · PB_NOTIFICATION_K1_DETAIL · PB_NOTIFICATION_TRACKING · a guardrail event per run and type</text>
        <text x={x0} y={144} fontSize={9.5} fill={mut(t)}>Nothing in the Portal schema is modified. The relay and the read-only account come from the namespace secret.</text>
      </svg>
    </div>);
}
function DecisionFig({ t }) {
  const W = 760;
  const node = (x, y, w, h, title, sub, c) => (<g key={title + x + y}>
    <rect x={x} y={y} width={w} height={h} rx={4} fill={t.panel} stroke={c || t.border} strokeWidth={1.4} />
    <text x={x + 8} y={y + 18} fontSize={10.5} fontWeight={700} fill={ink(t)}>{title}</text>
    {sub && <text x={x + 8} y={y + 32} fontSize={9} fill={mut(t)}>{sub}</text>}
  </g>);
  const a = (d) => <path d={d} stroke={mut(t)} strokeWidth={1.2} fill="none" markerEnd="url(#pbn-arr2)" />;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} 250`} role="img" style={{ display: "block", minWidth: 620, width: "100%", height: "auto" }}
        aria-label="How one STATEMENT_CONFIRM record becomes an e-mail. For each account with a posted statement or confirm, the suppression row decides eligibility per document type: no row, or flag N, permits; flag Y suppresses. If at least one account permits statements the statement flag is Y; the same separately for confirms. Both flags N: no record. Y and N: the statements e-mail. N and Y: the confirms e-mail. Y and Y: the combined e-mail. One record per user per day whichever e-mail results.">
        <defs><marker id="pbn-arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>STATEMENT_CONFIRM · FROM ACCOUNTS AND PREFERENCES TO ONE E-MAIL</text>
        {node(12, 30, 200, 44, "Posted today, per account", "statements · confirms, RPT_VRSN_NAM = date")}
        {node(12, 90, 200, 58, "Preference, per account and type", "TWM049: no row or N permits; Y suppresses")}
        {node(250, 30, 200, 44, "eligible_statement", "at least one account permits", MARK.PROPOSED.c)}
        {node(250, 104, 200, 44, "eligible_confirm", "at least one account permits", MARK.PROPOSED.c)}
        {node(500, 30, 248, 36, "Y · N  →  Online Statements Available", null, MARK.REQUIRED.c)}
        {node(500, 76, 248, 36, "N · Y  →  Online Trade Confirms Available", null, MARK.REQUIRED.c)}
        {node(500, 122, 248, 36, "Y · Y  →  Statements and Trade Confirms", null, MARK.REQUIRED.c)}
        {node(500, 168, 248, 36, "N · N  →  no record, nothing sent", null, t.border)}
        {a("M212 52 L248 52")}{a("M212 119 L230 119 L230 126 L248 126")}{a("M212 60 L230 60 L230 52")}
        {a("M450 52 L498 48")}{a("M450 126 L498 94")}{a("M450 52 L470 52 L470 140 L498 140")}{a("M450 126 L470 126 L470 186 L498 186")}
        <text x={12} y={176} fontSize={9.5} fill={mut(t)}>One STATEMENT_CONFIRM tracking record per user per day, whichever e-mail results. Never two.</text>
        <text x={12} y={192} fontSize={9.5} fill={mut(t)}>Evaluated separately per document type: an opt-out on one account does not suppress a document on another.</text>
        <text x={12} y={208} fontSize={9.5} fill={mut(t)}>1099 and K1 skip this entirely: an active external user always receives them.</text>
        <text x={12} y={236} fontSize={9.5} fill={MARK.OPEN.c}>OPEN G6: the worked examples read N as suppressed; the rule reads N as permitted. The design follows the rule until the business confirms.</text>
      </svg>
    </div>);
}
function DagFig({ t }) {
  const W = 1120;
  const node = (x, y, w, title, sub, c) => (<g key={title}>
    <rect x={x} y={y} width={w} height={44} rx={4} fill={t.panel} stroke={c || MARK.PROPOSED.c} strokeWidth={1.5} />
    <text x={x + 8} y={y + 18} fontSize={9.5} fontWeight={700} fill={ink(t)} style={mono}>{title}</text>
    <text x={x + 8} y={y + 32} fontSize={8.5} fill={mut(t)}>{sub}</text>
  </g>);
  const a = (d) => <path d={d} stroke={mut(t)} strokeWidth={1.2} fill="none" markerEnd="url(#pbn-arr4)" />;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} 232`} role="img" style={{ display: "block", minWidth: 860, width: "100%", height: "auto" }}
        aria-label="The pb_notification_daily DAG graph: wait_posting_complete, then three eligibility tasks in parallel for statements and confirms, 1099 and K-1, then resolve_address, write_candidates, open_tracking, render_and_send in the relay pool, then publish_run_event and notify_rm_ra. The sensor times out at the 08:00 ET latest start; publish_run_event runs whatever happened.">
        <defs><marker id="pbn-arr4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>DAG · pb_notification_daily · weekdays 07:30 ET · catchup off · max_active_runs 1</text>
        {node(12, 90, 150, "wait_posting_complete", "sensor · reschedule · to 08:00", MARK.OPEN.c)}
        {node(200, 30, 170, "eligibility_stmt_confirm", "pod · query with suppression")}
        {node(200, 90, 170, "eligibility_1099", "pod · reference-table family")}
        {node(200, 150, 170, "eligibility_k1", "pod · prior year + Mobius name")}
        {node(410, 90, 140, "resolve_address", "pod · left join · exceptions")}
        {node(580, 90, 140, "write_candidates", "pod · merge by date key")}
        {node(750, 90, 130, "open_tracking", "pod · Processing rows")}
        {node(910, 90, 196, "render_and_send", "pod · pool pb_notify_relay")}
        {node(750, 160, 160, "publish_run_event", "guardrail event · all_done")}
        {node(930, 160, 176, "notify_rm_ra", "failed 1099 / K1 to RM and RA")}
        {a("M162 112 L180 112 L180 52 L198 52")}{a("M162 112 L198 112")}{a("M162 112 L180 112 L180 172 L198 172")}
        {a("M370 52 L390 52 L390 112 L408 112")}{a("M370 112 L408 112")}{a("M370 172 L390 172 L390 112 L408 112")}
        {a("M550 112 L578 112")}{a("M720 112 L748 112")}{a("M880 112 L908 112")}
        {a("M1008 134 L1008 146 L830 146 L830 160")}{a("M1008 134 L1008 158")}
        <text x={12} y={216} fontSize={9.5} fill={mut(t)}>Three eligibility reads in parallel; one merge; one tracking write; one send; the event is published whatever happened. Every task writes by the date's key, so a rerun of any task sends nothing twice.</text>
      </svg>
    </div>);
}
function ModelFig({ t }) {
  const box = (x, y, w, h, m) => (<g key={m.name}>
    <rect x={x} y={y} width={w} height={h} rx={4} fill={t.panel} stroke={MARK.PROPOSED.c} strokeWidth={1.6} />
    <text x={x + 8} y={y + 16} fontSize={10.5} fontWeight={800} fill={ink(t)} style={mono}>{m.name}</text>
    <text x={x + 8} y={y + 30} fontSize={9} fill={mut(t)}>{m.grain}</text>
    {m.cols.slice(0, 6).map(([c], i) => <text key={c} x={x + 8} y={y + 46 + i * 12} fontSize={8.5} fill={ink(t)} style={mono}>{c.length > 44 ? c.slice(0, 43) + "…" : c}</text>)}
  </g>);
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox="0 0 900 190" role="img" style={{ display: "block", minWidth: 700, width: "100%", height: "auto" }}
        aria-label="The three tables: PB_NOTIFICATION_CANDIDATE, one row per user, type and processing date, with the K-1 report lines in PB_NOTIFICATION_K1_DETAIL, one row per processing date, user and report id; and PB_NOTIFICATION_TRACKING, one row per user, type and processing date, whose unique key is the duplicate guard. A candidate opens exactly one tracking record.">
        <defs><marker id="pbn-arr3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        {box(12, 12, 290, 126, MODEL.candidate)}
        {box(330, 12, 240, 126, MODEL.detail)}
        {box(600, 12, 288, 126, MODEL.tracking)}
        <path d="M302 40 L328 40" stroke={mut(t)} strokeWidth={1.2} markerEnd="url(#pbn-arr3)" /><text x={304} y={34} fontSize={8} fill={mut(t)}>1 · n (K1)</text>
        <path d="M302 110 L316 110 L316 160 L585 160 L585 110 L598 110" stroke={mut(t)} strokeWidth={1.2} fill="none" markerEnd="url(#pbn-arr3)" /><text x={330} y={156} fontSize={8} fill={mut(t)}>1 · 1 — a candidate opens exactly one tracking record; the unique key refuses a second</text>
        <text x={12} y={182} fontSize={9.5} fill={mut(t)}>Created by a Liquibase changeset in this application's db/changelog, so the Hub's schema stage applies and tags it like every other table.</text>
      </svg>
    </div>);
}

// --------------------------------------------------------------- pieces ----
function Chip({ m, children }) {
  const k = MARK[m] || MARK.OPEN;
  return <span title={k.t} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: k.c, border: `1px solid ${k.c}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{children || k.label}</span>;
}
function H2({ t, children, sub }) {
  return <div style={{ margin: "22px 0 8px" }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12.5, color: t.sub, maxWidth: "76ch", lineHeight: 1.6, marginTop: 3 }}>{sub}</div>}</div>;
}
function P({ t, children }) { return <p style={{ fontSize: 13, color: t.sub, lineHeight: 1.65, maxWidth: "76ch", margin: "0 0 10px" }}>{children}</p>; }
function Note({ t, children, c }) {
  return <div style={{ borderLeft: `3px solid ${c || t.accent}`, background: t.bg, padding: "10px 14px", borderRadius: "0 6px 6px 0", margin: "10px 0", fontSize: 13, color: t.sub, lineHeight: 1.6, maxWidth: "80ch" }}>{children}</div>;
}
function Tbl({ t, head, rows }) {
  return (
    <div style={{ overflowX: "auto", margin: "8px 0 14px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, minWidth: 560 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "8px 12px 8px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: j === 0 ? t.text : t.sub, fontWeight: j === 0 ? 600 : 400, lineHeight: 1.5 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}
function Legend({ t }) {
  return <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: t.sub, margin: "6px 0 10px" }}>
    {Object.keys(MARK).map((k) => <span key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Chip m={k} /> {MARK[k].t}</span>)}</div>;
}

// ----------------------------------------------------------------- tabs ----
export function OverviewTab({ t }) {
  return (<>
    <H2 t={t}>Background</H2>
    {BACKGROUND.map((p) => <P key={p.slice(0, 30)} t={t}>{p}</P>)}
    <H2 t={t}>The enhancement</H2>
    <P t={t}>{ENHANCEMENT}</P>
    <H2 t={t} sub="The proof of concept runs on the four Excel extracts. The built utility connects to the Portal's Oracle schema and runs the same queries; from the candidate table onward nothing changes.">Proof of concept now, Oracle when built</H2>
    <Tbl t={t} head={["", "Proof of concept · Excel", "Built · Oracle"]} rows={MODES.map(([a, b, c]) => [a, b, c])} />
    <H2 t={t}>Why it is built on the Integration Hub</H2>
    <P t={t}>It is the first BBH pipeline on the Hub framework that is not an SEI interface: a daily, business-date-aware job that reads a BBH schema, writes its own tables, sends through the internal relay and leaves evidence in the CP 360 metadata. Everything it needs the Hub already has: the scheduler, the schema stage, the guardrail events, the screens and the secrets. Building it here means PB Systems can close the InServ process without standing up anything new.</P>
    <Tbl t={t} head={["Concern", "On the Hub", "Component"]} rows={HUB_FIT.map(([a, b, c]) => [a, b, c])} />
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>Not agreed yet.</b> {GAPS.filter((g) => g[4] === "OPEN").length} items on the Open gaps tab need an answer from PB business or PB Systems before the build starts; the first four are critical and the rest change the rules the queries implement.</Note>
  </>);
}
export function RequirementsTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t}>The requirements</H2>
    <Tbl t={t} head={["#", "Requirement", ""]} rows={REQUIREMENTS.map(([id, text, m]) => [id, text, <Chip m={m} />])} />
    <H2 t={t} sub="How each notification type decides who is eligible, where it reads, and what one record produces.">Per notification type</H2>
    {TYPES.map((x) => (
      <div key={x.key} style={{ border: `1px solid ${t.border}`, borderLeft: `4px solid ${MARK.REQUIRED.c}`, borderRadius: t.radius.md, background: t.panel, padding: "12px 16px", margin: "8px 0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ color: t.text, fontSize: 14 }}>{x.title}</b><span style={{ ...mono, fontSize: 11.5, color: t.textMuted }}>NOTIFICATION_TYPE = {x.key}</span>{x.always && <Chip m="REQUIRED">ALWAYS SENT</Chip>}</div>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, marginTop: 6 }}>
          <div><b style={{ color: t.text }}>Reads</b> <span style={mono}>{x.source}</span></div>
          <div><b style={{ color: t.text }}>Posted today when</b> <span style={mono}>{x.posted}</span></div>
          <div><b style={{ color: t.text }}>Preference</b> {x.preference}</div>
          <div><b style={{ color: t.text }}>Outcome</b> {x.outcome}</div>
        </div>
      </div>))}
    <H2 t={t}>Notification type grid</H2>
    <Tbl t={t} head={["Type", "Frequency · send time", "Business trigger", "Preference and consolidation", "E-mail outcome"]} rows={GRID.map((r) => [...r])} />
    <H2 t={t}>Notification tracking</H2>
    <P t={t}>One tracking table. A record per eligible user, notification type and processing date, created only when the user has at least one qualifying document for that type. STATEMENT_CONFIRM is one record whether the e-mail ends up statements-only, confirms-only or combined.</P>
    <Tbl t={t} head={["Field", "Meaning"]} rows={TRACKING_FIELDS.map(([a, b]) => [<span style={mono}>{a}</span>, b])} />
    <Tbl t={t} head={["Status", "Meaning"]} rows={STATUSES.map(([a, b]) => [a, b])} />
    <H2 t={t}>Undeliverable notifications</H2>
    <P t={t}>Every bounced or refused 1099 and K-1 e-mail (NOTIFICATION_TYPE in 1099, K1 and EMAIL_STATUS = Failed) is tracked and made available to the user's Relationship Manager and Relationship Associate, and to no one else.</P>
  </>);
}
export function DesignTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t} sub="One Airflow DAG on the Hub scheduler, once a day, triggered by the posting cycle rather than by the clock.">The run</H2>
    <FlowFig t={t} />
    <Tbl t={t} head={["#", "Task", "What it does", ""]} rows={FLOW.map(([a, b, m], i) => [i + 1, a, b, <Chip m={m} />])} />
    <H2 t={t} sub="The one decision that is easy to get wrong: a user's accounts and their preferences, per document type, to one record and one e-mail.">Statements and confirms, decided</H2>
    <DecisionFig t={t} />
    <H2 t={t} sub="One DAG file in this application's repository, written to the Hub's DAG standards. The settings, the tasks and the dependencies.">Airflow DAG and orchestration</H2>
    <DagFig t={t} />
    <Tbl t={t} head={["Setting", "Value", "Why"]} rows={ORCHESTRATION.dag.map(([a, b, c]) => [<span style={mono}>{a}</span>, b, c])} />
    <Tbl t={t} head={["Task", "Operator · where it runs", "What it does", "Writes", "On failure"]} rows={ORCHESTRATION.tasks.map(([a, b, c, d, e]) => [<span style={mono}>{a}</span>, b, c, d, e])} />
    <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, margin: "6px 0 10px" }}><b style={{ color: t.text }}>Dependencies</b> <span style={{ ...mono, fontSize: 11.5 }}>{ORCHESTRATION.deps}</span></div>
    {ORCHESTRATION.rules.map((r) => <Note key={r.slice(0, 24)} t={t} c={MARK.PROPOSED.c}>{r}</Note>)}
    <H2 t={t}>Design rules</H2>
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>The tracking key is the only duplicate guard.</b> USER_ID, NOTIFICATION_TYPE and PROCESS_DATE are unique. A rerun on the same date leaves Sent rows alone and retries the rest; no counter, flag or memory outside the table decides whether an e-mail goes.</Note>
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>A missing address is a rejection, never a drop.</b> The eligibility row still exists as an exception with its reason, the count is on the run's guardrail event, and someone can act on it.</Note>
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>The environment decides whether a real address is ever used.</b> Outside production every recipient is rewritten to the test address. In production the run refuses an extract where every address is identical.</Note>
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>Reference data out of the queries.</b> The 1099 family and the K-1 classification live in a small reference table maintained by PB Systems, not in a hard-coded IN list, so a new report id is a data change with an owner.</Note>
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>Trigger.</b> The requirement asks whether 8:00 a.m. ET is right. The design proposes a completion record from the posting process, with 8:00 a.m. ET as the latest start and an alert when the record has not arrived. PB Systems has to confirm the posting process can write that record.</Note>
  </>);
}
export function ModelTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t} sub="A candidate table with the K-1 lines beside it, and the tracking table the requirement asks for. All three in the Hub's own schema, created by Liquibase.">Three tables</H2>
    <ModelFig t={t} />
    {Object.values(MODEL).map((m) => (
      <div key={m.name} style={{ margin: "14px 0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ ...mono, color: t.text, fontSize: 13.5 }}>{m.name}</b><span style={{ fontSize: 11.5, color: t.textMuted }}>{m.grain}</span><Chip m="PROPOSED" /></div>
        <Tbl t={t} head={["Column", "Type", "Meaning"]} rows={m.cols.map(([a, b, c]) => [<span style={mono}>{a}</span>, <span style={mono}>{b}</span>, c])} />
        <div style={{ fontSize: 12, color: t.sub }}><b style={{ color: t.text }}>Keys</b> <span style={mono}>{m.keys}</span></div>
      </div>))}
    <H2 t={t}>Mapping from the sources</H2>
    <Tbl t={t} head={["Notification type", "Target", "From", "Rule"]} rows={[
      ["STATEMENT_CONFIRM", "USER_ID", "TWM002_USER_ACCOUNT_MAP.USER_ID", "the Portal user associated with the account"],
      ["STATEMENT_CONFIRM", "RECEIVED_STATEMENT · STATEMENT_MONTH · STATEMENT_ACCOUNT_COUNT", "TPW101_STMT_RPT · LOAD_DTE_TXT · distinct ACCOUNT_NUMBER", "Y when at least one eligible statement is posted; the month from YYYYMMDD; distinct eligible accounts"],
      ["STATEMENT_CONFIRM", "RECEIVED_CONFIRM · CONFIRM_MONTH · CONFIRM_ACCOUNT_COUNT", "TPW102_CNF_RPT · LOAD_DTE_TXT · distinct ACCOUNT_NUMBER", "the same for confirms"],
      ["1099", "USER_ID · RECEIVED_1099 · TAX_DOCUMENT_MONTH · TAX_ACCOUNT_COUNT", "TPW103_TAX_DOC_RPT · LOAD_DTE_TXT as Month YYYY · distinct ACCOUNT_NUMBER", "one row per user; the 1099 family per the reference table; ESTIMATE_IND = N"],
      ["K1", "USER_ID · RECEIVED_K1 · TAX_YEAR", "TPW103_TAX_DOC_RPT.TAX_YR_NUM", "the header: one row per user; prior calendar year; ESTIMATE_IND = N"],
      ["K1 detail", "RPT_ID · RPT_DESCRIPTION · ACCOUNT_COUNT", "TPW103_TAX_DOC_RPT.RPT_ID · TPW005_MOBIUS_MAP.RPT_DES · distinct ACCOUNT_NUMBER", "one row per report id; the description listed once in the e-mail"],
      ["all", "EMAIL_ADDRESS", "the current interested-party record, END_DATE IS NULL", "left join; no match is an exception"],
    ]} />
    <P t={t}>RPT_VRSN_NAM is when the document was posted; LOAD_DTE_TXT is the month the statement or confirm belongs to. The two are not the same date and the queries use them for different things.</P>
  </>);
}
export function SourcesTab({ t }) {
  const total = SOURCES.slice(0, 3).reduce((a, s) => a + s.unmatched, 0);
  return (<>
    <H2 t={t} sub="Four extracts were reviewed against the requirement. They are the proof of concept's input; the built utility runs the SQL in each workbook's SQL sheet against the Portal's Oracle schema instead. Together they are a usable eligibility and content layer; they are not yet a notification interface, because the processing date, the notification type, the delivery state and the tracking id are not in them.">The four extracts</H2>
    <Tbl t={t} head={["File", "Purpose", "Grain", "Rows", "Unmatched ids"]} rows={SOURCES.map((s) => [<span style={mono}>{s.file}</span>, s.purpose, s.grain, s.rows.toLocaleString(), s.unmatched ? <span style={{ color: MARK.OPEN.c, fontWeight: 700 }}>{s.unmatched}</span> : "—"])} />
    {SOURCES.map((s) => (
      <div key={s.file} style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "12px 16px", margin: "8px 0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ ...mono, color: t.text }}>{s.file}</b><span style={{ fontSize: 11.5, color: t.textMuted }}>{s.grain} · {s.rows.toLocaleString()} rows · a SQL sheet with the extraction query</span></div>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, marginTop: 6 }}>
          <div><b style={{ color: t.text }}>Columns</b> <span style={mono}>{s.cols.join(" · ")}</span></div>
          <div><b style={{ color: t.text }}>Profile</b> {s.profile}</div>
          <div><b style={{ color: t.text }}>Fit</b> {s.fit}</div>
        </div>
      </div>))}
    <H2 t={t}>Join rules</H2>
    <Tbl t={t} head={["Source", "Key", "Joins to the address on"]} rows={JOINS.map(([a, b, c]) => [a, <span style={mono}>{b}</span>, <span style={mono}>{c}</span>])} />
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>{total} Portal ids</b> across the three eligibility extracts have no address in the e-mail extract. Each becomes an exception row with reason EMAIL_ADDRESS_NOT_FOUND; none is silently dropped. The extract's single QA address is a test control and is not reproduced here.</Note>
  </>);
}
export function ContentTab({ t }) {
  return (<>
    <H2 t={t} sub={`From: ${SENDER}. To: the client's e-mail address on file in the data warehouse. Placeholders are in brackets; the Portal links are inserted at render time.`}>The five e-mails</H2>
    <Tbl t={t} head={["Template", "Sent when", "Subject", "Fields it needs"]} rows={CONTENT.map((c) => [c.key, <span style={mono}>{c.when}</span>, c.subject, <span style={{ fontSize: 11.5 }}>{c.fields}</span>])} />
    {CONTENT.map((c) => (
      <div key={c.key} style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "12px 16px", margin: "8px 0" }}>
        <div style={{ fontSize: 11, color: t.textMuted }}>From {SENDER} · subject</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, margin: "2px 0 8px" }}>{c.subject}</div>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.65, maxWidth: "80ch" }}>{c.body}</div>
      </div>))}
    <Note t={t}><b style={{ color: t.text }}>Worked examples from the requirement.</b> A client with five accounts: day one, two accounts' statements are posted and at least one of them permits, so the client is notified; day two, three more accounts' statements are posted. For K-1s, if three funds' K-1s post on one day and the client's accounts hold all three, one e-mail lists all three fund names. For 1099s posted for two accounts on day one and three on day two, one e-mail each day.</Note>
  </>);
}
export function GapsTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t} sub="Everything found reviewing the requirement and the four extracts that must be closed before a production run. Critical items block the interface; rule items change what the queries do; data items need a new source.">Open gaps</H2>
    <Tbl t={t} head={["#", "Class", "Finding", "Proposed resolution", ""]} rows={GAPS.map(([id, cls, finding, fix, m]) => [id, <span style={{ color: cls === "critical" ? "#b42318" : t.sub, fontWeight: 700 }}>{cls}</span>, finding, fix, <Chip m={m} />])} />
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>To put to PB business and PB Systems, in this order.</b> The suppression flag reading (G6), the posting-complete trigger (G8), the 1099 family (G9, G10), the K-1 classification and the missing description (G11, G12), and the relationship-team source (G13). The critical items G1 to G5 are ours to build and are in the design.</Note>
  </>);
}
export function ExceptionsTab({ t }) {
  return (<>
    <H2 t={t} sub="What can go wrong on a run and what the utility does about it. Outcomes: HOLD waits, SKIP does nothing by design, REJECT records an exception, RETRY tries again, FLAG changes a status after the fact.">Exceptions</H2>
    <Tbl t={t} head={["Scenario", "Detected by", "What the utility does", "Outcome"]} rows={EXCEPTIONS.map(([a, b, c, o]) => [a, b, c,
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: OUTCOME[o] || t.sub, border: `1px solid ${OUTCOME[o] || t.sub}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{o}</span>])} />
  </>);
}

export default function PbNotifications({ t = tLight }) {
  const [tab, setTab] = useState("overview");
  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 1260 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: t.text }}>PB Notifications</div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, borderRadius: 999, padding: "2px 9px", background: "#fdf2e3", color: "#8c6a1f" }}>PBCP-5587 · DESIGN · OPEN</span>
      </div>
      <div style={{ fontSize: 13, color: t.sub, maxWidth: "80ch", lineHeight: 1.6, margin: "4px 0 14px" }}>
        The Client Portal e-mail notification utility for Statements, Trade Confirms, 1099s and K-1s, designed as the first BBH pipeline on the Integration Hub framework.
        Not an SEI interface. The requirement as the business wrote it, the four source extracts reviewed against it, the design, the data model, the e-mail content, and every gap still open.
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, l], i) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ font: "inherit", fontSize: 11.5, fontWeight: 600, padding: "6px 13px", cursor: "pointer",
            border: `1px solid ${tab === k ? t.accent : t.border}`, borderRadius: i === 0 ? "4px 0 0 4px" : i === TABS.length - 1 ? "0 4px 4px 0" : 0,
            background: tab === k ? t.accent : t.panel, color: tab === k ? "#fff" : t.text }}>{l}</button>))}
      </div>
      {tab === "overview" && <OverviewTab t={t} />}
      {tab === "req" && <RequirementsTab t={t} />}
      {tab === "design" && <DesignTab t={t} />}
      {tab === "model" && <ModelTab t={t} />}
      {tab === "sources" && <SourcesTab t={t} />}
      {tab === "content" && <ContentTab t={t} />}
      {tab === "gaps" && <GapsTab t={t} />}
      {tab === "exc" && <ExceptionsTab t={t} />}
    </div>);
}
