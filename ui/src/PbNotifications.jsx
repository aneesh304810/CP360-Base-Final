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
import React, { useContext, useState } from "react";
import { tLight } from "./bbhTheme.js";
import { ReviewCtx, ReviewMark, ReviewPanel, CardReview, ReviewTab, useReviewState } from "./PbReview.jsx";
import { openQuestions } from "./pbnotifyReviewApi.js";

export const MARK = {
  REQUIRED: { label: "REQUIRED", c: "#0f4775", t: "the business requirement, as written in PBCP-5587" },
  PROPOSED: { label: "PROPOSED", c: "#159943", t: "our design on the Hub framework; open for review" },
  OPEN: { label: "OPEN", c: "#c96a12", t: "a question PB business or PB Systems has to answer before build" },
};
const mono = { fontFamily: "monospace" };

export const TABS = [["overview", "Overview"], ["flow", "End-to-end flow"], ["req", "Requirements"], ["design", "Design on the Hub"], ["model", "Data model"], ["sources", "Source review"], ["content", "E-mail content"], ["tests", "Test scenarios"], ["gaps", "Open gaps"], ["exc", "Exceptions"], ["review", "Review"]];

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
  ["R10", "Detect a bounce after the relay accepted the message: connect to the Microsoft 365 mail broker, read the non-delivery reports returned to the sending mailbox, match them to the notification, mark it Failed, and alert the system development team by e-mail.", "REQUIRED"],
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

// Bounce detection. The relay accepting a message is not delivery: a bounce
// comes back minutes or hours later as a non-delivery report to the sending
// mailbox. A second, short DAG reads that mailbox through the Microsoft 365
// broker, matches each report to its notification and alerts the people who
// have to act.
export const BOUNCE = {
  how: [
    ["Correlation", "every message carries a header X-PB-Notification-Id with the NOTIFICATION_ID, and the Message-Id the relay assigns is stored on the tracking row", "a non-delivery report quotes the original headers or Message-Id, so the match is exact, never by address alone"],
    ["Where bounces land", "the sending mailbox (the Client Portal sender) in Microsoft 365; non-delivery reports arrive there from the recipient's mail system", "one mailbox to read; nothing on the relay to poll"],
    ["How they are read", "a Microsoft Graph application registration with read access to that one mailbox only, client credentials from the namespace Secret; the task lists messages in the mailbox since the last check and keeps the non-delivery reports", "least privilege: one mailbox, read; the secret never in the repository"],
    ["Classification", "hard bounce (address unknown, domain not found, rejected) marks the notification Failed with BOUNCE_CLASS = HARD; soft bounce (mailbox full, deferred) is recorded and re-checked, Failed after the window", "the same words the broker uses, kept on the row"],
    ["Window", "a notification is watched for 48 hours after SENT_TS; a bounce after that is still recorded if it arrives", "most reports arrive within minutes; the window bounds the re-check"],
    ["Processed reports", "each report's id is stored so it is never matched twice; a report with no matching notification is logged as unmatched and left in the mailbox", "a rerun of the check is idempotent"],
  ],
  alerts: [
    ["System development team", "every hard bounce, batched per check into one e-mail: notification id, type, processing date, bounce class and the broker's reason; counts in the subject", "no client address or name in the body; the id is enough to look the row up in CP 360", "PROPOSED"],
    ["Relationship Manager and Associate", "hard bounces on 1099 and K1 only, as the requirement asks, through the Hub's relationship-team source", "the client-facing follow-up", "REQUIRED"],
    ["Quality Guardrails", "the check publishes a guardrail event with sent, bounced-hard, bounced-soft and unmatched counts", "the trend, not the individual", "PROPOSED"],
  ],
  columns: [
    ["MESSAGE_ID", "VARCHAR2(400)", "the Message-Id the relay assigned; the correlation key"],
    ["BOUNCE_TS", "TIMESTAMP", "when the non-delivery report was read"],
    ["BOUNCE_CLASS", "VARCHAR2(10)", "HARD or SOFT"],
    ["BOUNCE_REASON", "VARCHAR2(1000)", "the broker's status code and text"],
    ["ALERTED_TS", "TIMESTAMP", "when the system development team was told"],
  ],
};

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
  bounce: {
    dag: [["dag_id", "pb_notification_bounce_check"], ["schedule", "every 2 hours between 08:00 and 20:00 ET, and once at 06:00 ET for the overnight reports"], ["scope", "tracking rows Sent in the last 48 hours plus any SOFT bounce still open"], ["max_active_runs", "1"]],
    tasks: [
      ["read_ndr_mailbox", "KubernetesPodOperator · Microsoft Graph, client credentials from the Secret", "lists messages in the sending mailbox since the last watermark; keeps the non-delivery reports; stores each report id once", "the reports to match, and the new watermark", "a Graph error fails the task and the next run resumes from the old watermark"],
      ["match_to_tracking", "KubernetesPodOperator", "matches each report by X-PB-Notification-Id or Message-Id to a tracking row; classifies HARD or SOFT", "EMAIL_STATUS Failed with BOUNCE_TS, BOUNCE_CLASS and BOUNCE_REASON for hard bounces; SOFT recorded and re-checked", "an unmatched report is logged and left in the mailbox"],
      ["alert_system_dev", "the Hub's notification task · the relay", "one e-mail to the system development distribution list per run with the hard bounces since the last alert; ALERTED_TS stamped", "the alert, and the stamp so a bounce is reported once", "if the alert itself fails the stamp is not set and the next run retries"],
      ["notify_rm_ra", "the Hub's relationship-team task", "hard bounces on 1099 and K1 to the user's RM and RA", "the undeliverable view", "depends on the G13 source"],
      ["publish_check_event", "the Hub's guardrail event task · all_done", "sent, bounced-hard, bounced-soft and unmatched counts for the window", "the run's evidence", "always runs"],
    ],
    deps: "read_ndr_mailbox >> match_to_tracking >> [alert_system_dev, notify_rm_ra] >> publish_check_event",
  },
  rules: [
    "Idempotent by construction: every task writes by the date's key and the tracking key, so re-running any task or the whole date sends nothing twice and loses nothing.",
    "The three eligibility tasks run in parallel; nothing downstream starts until all three have finished, because a user can be in more than one type and the candidate write is one merge.",
    "The send task is the only one that leaves the Hub, and it is the only one in the pool; everything else is Oracle in and Oracle out.",
    "A rerun is a manual trigger with process_date in the conf; catchup is off so a paused DAG does not wake up and send days of e-mails.",
    "Gate 1 reads the DAG file statically on every pull request: naming, schedule, retries, callbacks, no credentials, no module-scope I/O; Gate 5 scans its Python.",
  ],
};

// The implementation: where the files live in the application repository
// and what the two DAG files look like. Skeletons, written to the Hub's
// DAG standards; the task bodies are small Python modules the pods run.
// No host, credential or mailbox name appears: everything comes from the
// namespace Secret and Airflow Variables at run time.
export const REPO_LAYOUT = [
  ["dags/pb_notification_daily.py", "the daily DAG: sensor, three eligibility pods, address, candidates, tracking, send, event, RM/RA"],
  ["dags/pb_notification_bounce_check.py", "the bounce DAG: read the sending mailbox, match, alert, RM/RA, event"],
  ["src/pb_notify/eligibility.py", "runs one of the three queries with PROCESS_DATE bound; writes the staged rows; --source oracle or excel"],
  ["src/pb_notify/addresses.py · candidates.py · tracking.py", "the left join, the merge by date key, the Processing rows"],
  ["src/pb_notify/send.py", "template selection from the flags, rendering, the relay, per-row status; send_mode test rewrites every recipient"],
  ["src/pb_notify/bounces.py", "Graph client, the watermark, non-delivery report parsing, HARD/SOFT, the match by header or Message-Id"],
  ["src/pb_notify/alerts.py", "the system development e-mail and the RM/RA hand-off"],
  ["sql/eligibility_stmt_confirm.sql · eligibility_1099.sql · eligibility_k1.sql", "the three queries from the workbooks' SQL sheets, with :process_date in place of SYSDATE"],
  ["templates/*.html", "the five e-mails, placeholders for the link and the K-1 list"],
  ["db/changelog/pb_notification.xml", "the three tables and the bounce columns, with rollback blocks; applied by the schema stage"],
  ["config/pb_notify.yaml", "the 1099 family and the K-1 classification as reference data, the attempt limit, the bounce window"],
  ["tests/", "unit tests on the flags-to-template rule, the K-1 grouping, the bounce parser and the idempotent merge; Gate 1 and Gate 5 on the DAG files"],
];
export const DAG_CODE = `# dags/pb_notification_daily.py
from airflow import DAG
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from airflow.sensors.sql import SqlSensor
from airflow.utils.trigger_rule import TriggerRule
from hub.business_date import process_date          # the Hub helper: logical date -> business date
from hub.callbacks import on_failure, on_sla_miss    # e-mail + chat, as the DAG standards require
from hub.pods import pb_pod                          # workbench image by digest, Secret mounted, resources set
import pendulum

default_args = {
    "owner": "pb-systems",
    "retries": 2,
    "retry_delay": pendulum.duration(minutes=5),
    "on_failure_callback": on_failure,
    "sla_miss_callback": on_sla_miss,
}

with DAG(
    dag_id="pb_notification_daily",
    schedule="30 7 * * 1-5",                      # weekdays 07:30 ET; the sensor has until 08:00
    start_date=pendulum.datetime(2026, 11, 1, tz="America/New_York"),
    catchup=False,
    max_active_runs=1,
    default_args=default_args,
    params={"process_date": None, "source": "oracle", "send_mode": "test"},
    tags=["pb", "notifications", "client-portal"],
) as dag:

    pd = "{{ params.process_date or ti.xcom_pull(task_ids='business_date') }}"

    business_date = pb_pod("business_date", cmd=["pb-notify", "business-date"])   # pushes the date only

    wait_posting_complete = SqlSensor(
        task_id="wait_posting_complete",
        conn_id="portal_ro",                          # the read-only Portal account, from the Secret
        sql="sql/posting_complete.sql",               # one row when the cycle's completion record exists
        parameters={"process_date": pd},
        mode="reschedule", poke_interval=300, timeout=30 * 60,
    )

    eligibility = [
        pb_pod(f"eligibility_{k}", cmd=["pb-notify", "eligibility", k, "--date", pd, "--source", "{{ params.source }}"])
        for k in ("stmt_confirm", "1099", "k1")
    ]
    resolve_address  = pb_pod("resolve_address",  cmd=["pb-notify", "addresses",  "--date", pd])
    write_candidates = pb_pod("write_candidates", cmd=["pb-notify", "candidates", "--date", pd])
    open_tracking    = pb_pod("open_tracking",    cmd=["pb-notify", "tracking",   "--date", pd])
    render_and_send  = pb_pod("render_and_send",  cmd=["pb-notify", "send", "--date", pd, "--mode", "{{ params.send_mode }}"],
                              pool="pb_notify_relay")
    publish_run_event = pb_pod("publish_run_event", cmd=["pb-notify", "event", "daily", "--date", pd],
                               trigger_rule=TriggerRule.ALL_DONE)
    notify_rm_ra = pb_pod("notify_rm_ra", cmd=["pb-notify", "rm-ra", "--date", pd])

    business_date >> wait_posting_complete >> eligibility >> resolve_address >> write_candidates
    write_candidates >> open_tracking >> render_and_send >> [publish_run_event, notify_rm_ra]
`;
export const BOUNCE_DAG_CODE = `# dags/pb_notification_bounce_check.py
from airflow import DAG
from airflow.utils.trigger_rule import TriggerRule
from hub.callbacks import on_failure
from hub.pods import pb_pod
import pendulum

with DAG(
    dag_id="pb_notification_bounce_check",
    schedule="0 6,8,10,12,14,16,18,20 * * 1-5",      # 06:00 for the overnight reports, then every 2 hours
    start_date=pendulum.datetime(2026, 11, 1, tz="America/New_York"),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "pb-systems", "retries": 2, "retry_delay": pendulum.duration(minutes=5), "on_failure_callback": on_failure},
    tags=["pb", "notifications", "bounces"],
) as dag:

    read_ndr_mailbox    = pb_pod("read_ndr_mailbox",    cmd=["pb-notify", "bounces", "read"])     # Graph, one mailbox, from the watermark
    match_to_tracking   = pb_pod("match_to_tracking",   cmd=["pb-notify", "bounces", "match"])    # header or Message-Id; HARD / SOFT
    alert_system_dev    = pb_pod("alert_system_dev",    cmd=["pb-notify", "alerts", "system-dev"], pool="pb_notify_relay")
    notify_rm_ra        = pb_pod("notify_rm_ra",        cmd=["pb-notify", "rm-ra", "--bounces"])
    publish_check_event = pb_pod("publish_check_event", cmd=["pb-notify", "event", "bounce"], trigger_rule=TriggerRule.ALL_DONE)

    read_ndr_mailbox >> match_to_tracking >> [alert_system_dev, notify_rm_ra] >> publish_check_event
`;
export const POD_HELPER = `# hub/pods.py (the Hub's shared helper, used by every Hub DAG)
def pb_pod(task_id, cmd, pool=None, trigger_rule=None):
    return KubernetesPodOperator(
        task_id=task_id,
        name=f"pb-notify-{task_id}",
        image=WORKBENCH_IMAGE,                     # the pinned digest the bump PR updates
        cmds=cmd,
        env_from=[secret_env("pb-notify")],         # portal_ro, relay, graph client credentials
        container_resources=STANDARD_RESOURCES,
        get_logs=True, is_delete_operator_pod=True,
        pool=pool or "default_pool",
        trigger_rule=trigger_rule or TriggerRule.ALL_SUCCESS,
    )
`;

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
    ["MESSAGE_ID · BOUNCE_TS · BOUNCE_CLASS · BOUNCE_REASON · ALERTED_TS", "see the bounce design", "the correlation key and what the broker said, when a bounce comes back"],
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
  ["G15", "data", "Bounce detection needs read access to the sending mailbox in Microsoft 365 through a Graph application registration, and the system development distribution list to alert.", "PB Systems to request the registration scoped to that one mailbox, read only, and to name the distribution list", "OPEN"],
  ["G16", "rule", "Whether a soft bounce (mailbox full, deferred) should ever count as Failed, and after how long.", "proposed: re-check within the 48-hour window, Failed after it; the business to confirm", "OPEN"],
  ["G17", "rule", "The type grid includes Loan Statements, but the statements SQL takes RPT_ID SUNGARD1 only.", "PB Systems to confirm the Loan Statement report ids; held in the same reference table as the 1099 family", "OPEN"],
  ["G18", "rule", "No retry policy for Failed rows: how many attempts, how far apart, and when a row is finally Failed.", "ATTEMPT_COUNT and LAST_ATTEMPT_TS on the tracking row with the limit in config, proposed three within the run day; the business to confirm the limit", "OPEN"],
  ["G19", "data", "The Portal deep links for the Statement, Confirms, All Types and Tax Reports views are not specified.", "PB Systems to provide the four links per environment; held in Environment 360 and the namespace config, never in the template", "OPEN"],
  ["G20", "data", "The document places the tracking and K-1 detail tables in the Portal's PBCPAPP schema with the detail keyed by NOTIFICATION_ID; the design keeps them in the Hub schema with the detail keyed by date, user and report.", "agree the owner: the Hub schema keeps the Portal schema read-only and the Liquibase stage applies the changeset; the detail key can follow the document if preferred", "OPEN"],
];

// What can go wrong on a run, and what the utility does.
export const EXCEPTIONS = [
  ["Posting not complete by the latest start", "the sensor times out", "no candidates written; alert the operator; the run retries when the completion record arrives", "HOLD"],
  ["Rerun on the same processing date", "the tracking key already exists", "existing Sent rows untouched; Processing and Failed rows retried; nothing sent twice", "SKIP"],
  ["User with no e-mail address", "the interested-party join finds nothing", "exception row EMAIL_ADDRESS_NOT_FOUND; counted on the run; not a tracking record", "REJECT"],
  ["User present in two statement sheets", "a consolidated set should make this impossible", "the unique key refuses the second; logged as a source defect", "REJECT"],
  ["Relay refuses the message", "SMTP error", "Failed with the error; retried up to the attempt limit; 1099 and K1 failures exposed to the RM and RA", "RETRY"],
  ["Hard bounce after acceptance", "the bounce check reads a non-delivery report from the sending mailbox and matches it by notification id", "the tracking row moves from Sent to Failed with the class and reason; the system development team is alerted; 1099 and K1 to the RM and RA", "FLAG"],
  ["Soft bounce after acceptance", "a deferred or mailbox-full report", "recorded as SOFT and re-checked within the window; Failed and alerted only if it does not clear", "RETRY"],
  ["Non-delivery report that matches nothing", "no notification id or message id matches a tracking row", "logged as unmatched with its report id; left in the mailbox; counted on the check's event", "FLAG"],
  ["K-1 row with no report description", "left join to TPW005_MOBIUS_MAP found nothing", "per the open decision: fail, fall back to RPT_ID, or exclude and report", "OPEN"],
  ["Estimated tax document on the posting date", "ESTIMATE_IND = Y", "excluded from 1099 and K1 eligibility; not a notification", "SKIP"],
  ["Suppression row with both flags Y on every account", "the user opted out everywhere", "no STATEMENT_CONFIRM candidate; nothing tracked, by design", "SKIP"],
  ["Test extract in production", "every address identical, or the environment safeguard tripped", "the run refuses to send; alert", "HOLD"],
  ["User deleted between the extract and the send", "DELETED_IND re-checked on the tracking row just before the send", "the row becomes Failed with reason USER_DELETED; nothing sent; counted on the run", "REJECT"],
  ["E-mail gateway unavailable", "the relay cannot be reached at all", "rows stay Processing; the send task fails and retries on the DAG's retry schedule; support is alerted through the failure callback", "RETRY"],
];
export const OUTCOME = { HOLD: "#c96a12", SKIP: "#6b7884", REJECT: "#b42318", RETRY: "#0f4775", FLAG: "#7c3aed", OPEN: "#c96a12" };

// ---------------------------------------------- the end-to-end document ----
// The "PB Notifications – End-to-End Workflow Requirements" document, folded
// in: who is involved, the business requirement ids it uses, the source
// tables it names, the twelve processing steps, the status lifecycle, the
// test scenarios and where each of its open items lands on this page.
export const ACTORS = [
  ["External Client Portal user", "the recipient: USER_TYPE = EXTERNAL and DELETED_IND = N", "REQUIRED"],
  ["PB Client Portal · PBCPAPP schema", "the document posting tables, the user and account map and the suppression preferences; read only", "REQUIRED"],
  ["Data warehouse · PBDWAPP schema", "the e-mail of record: DIM_IP_RELATIONSHIP joins the Portal id to the interested party, DIM_INTERESTED_PARTY holds E_MAIL_ADDRESS with END_DATE IS NULL", "REQUIRED"],
  ["Notification utility · the two Hub DAGs", "extract, evaluate, consolidate, send and track, on the Integration Hub's Airflow", "PROPOSED"],
  ["E-mail gateway · the internal relay and Microsoft 365", "delivery through the relay; non-delivery reports come back to the sending mailbox", "REQUIRED"],
  ["Relationship team · RM and RA", "told of failed 1099 and K-1 deliveries, resolved by USER_ID", "REQUIRED"],
  ["System development team", "alerted on every hard bounce", "PROPOSED"],
  ["PB Systems · PB business", "operate the run and own the reference data; own the rules and the open items", "REQUIRED"],
];
// BR-01 to BR-15 as the document numbers them, and where each one lands here.
export const BR_TRACE = [
  ["BR-01", "Send to active external clients (DELETED_IND = N) when a document is posted.", "R1 · the eligibility queries · re-validated on the row just before the send"],
  ["BR-02", "Eligibility by document type and the user's e-mail notification preferences.", "R2 · the statements-and-confirms decision"],
  ["BR-03", "1099 and K-1: active clients always receive the notification.", "R3 · the two types marked ALWAYS SENT"],
  ["BR-04", "Every active external user associated with the account is notified.", "R4 · TWM002_USER_ACCOUNT_MAP joined to TWM001_USER_REF"],
  ["BR-05", "Send to the user's e-mail on file in the data warehouse.", "R5 · resolve_address · DIM_INTERESTED_PARTY"],
  ["BR-06", "Send after the day's posting completes; 8:00 a.m. ET proposed.", "R6, open · the posting sensor with 08:00 ET as the latest start · G8"],
  ["BR-07", "At most one notification per user, per type, per day.", "R7 · the tracking table's unique key"],
  ["BR-08", "Statements and at least one confirm on the same day: one combined e-mail.", "R7 · the BOTH template from the two received flags"],
  ["BR-09", "Statements: RPT_ID SUNGARD1, posting date from RPT_VRSN_NAM on TPW101_STMT_RPT.", "the STATEMENT_CONFIRM type · Loan Statement ids open, G17"],
  ["BR-10", "Trade Confirms: RPT_ID SUNGARD2, posting date from RPT_VRSN_NAM on TPW102_CNF_RPT.", "the STATEMENT_CONFIRM type"],
  ["BR-11", "1099: RPT_ID in TX1099, TX1099R; posting date from RPT_VRSN_NAM; ESTIMATE_IND = N.", "the 1099 type · the family and the predicate open, G9 and G10"],
  ["BR-12", "K-1: RPT_ID per TPW005_MOBIUS_MAP; ESTIMATE_IND = N; the prior tax year only.", "the K1 type · positive classification open, G11"],
  ["BR-13", "The K-1 e-mail lists every distinct fund or report once.", "the K1 template · PB_NOTIFICATION_K1_DETAIL"],
  ["BR-14", "One notification tracking table.", "R8 · PB_NOTIFICATION_TRACKING"],
  ["BR-15", "Track bounced 1099 and K-1 e-mails and notify the RM and RA.", "R9 and R10 · the bounce-check DAG · notify_rm_ra"],
];
// The source data model the document names. Table and column names only.
export const SOURCE_TABLES = [
  ["TPW101_STMT_RPT", "PBCPAPP", "posted statements", "SUNGARD_ACCT_ID · RPT_ID · RPT_VRSN_NAM · LOAD_DTE_TXT"],
  ["TPW102_CNF_RPT", "PBCPAPP", "posted trade confirms", "SUNGARD_ACCT_ID · RPT_ID · RPT_VRSN_NAM · LOAD_DTE_TXT"],
  ["TPW103_TAX_DOC_RPT", "PBCPAPP", "posted tax documents", "SUNGARD_ACCT_ID · RPT_ID · RPT_VRSN_NAM · LOAD_DTE_TXT · TAX_YR_NUM · ESTIMATE_IND"],
  ["TPW005_MOBIUS_MAP", "PBCPAPP", "report id to description", "RPT_ID · RPT_DES"],
  ["TWM001_USER_REF", "PBCPAPP", "Portal users", "USER_ID · USER_TYPE · DELETED_IND"],
  ["TWM002_USER_ACCOUNT_MAP", "PBCPAPP", "user to account", "USER_ID · ACCOUNT_NUMBER (= SUNGARD_ACCT_ID)"],
  ["TWM049_SUPPRESS_EMAIL", "PBCPAPP", "opt-out preferences", "USER_ID · ACCOUNT_NUMBER · IS_STMNT_SUPPRESSED · IS_CNFRM_SUPPRESSED"],
  ["DIM_IP_RELATIONSHIP", "PBDWAPP", "interested party to Portal id", "INTERESTED_PARTY_NUMBER · BBH_WEB_PORTAL_ID (= USER_ID)"],
  ["DIM_INTERESTED_PARTY", "PBDWAPP", "the e-mail of record", "INTERESTED_PARTY_NUMBER · E_MAIL_ADDRESS · END_DATE (current row: NULL)"],
];
// The twelve processing steps the document lists, and the DAG task that does each.
export const STEPS = [
  ["1", "Wait for the posting cycle to complete (target 8:00 a.m. ET).", "PROCESS_DATE fixed", "wait_posting_complete"],
  ["2", "Run the three extracts for PROCESS_DATE.", "candidate sets per type", "eligibility_stmt_confirm · eligibility_1099 · eligibility_k1"],
  ["3", "Join each candidate to the e-mail of record.", "candidate with e-mail", "resolve_address"],
  ["4", "Route users with no e-mail to the exception log.", "exceptions, counted", "resolve_address"],
  ["5", "For each (USER_ID, NOTIFICATION_TYPE, PROCESS_DATE) insert a tracking row as Processing; skip on a unique-key violation.", "idempotent tracking", "write_candidates · open_tracking"],
  ["6", "For K-1, insert the detail rows (distinct RPT_ID and RPT_DESCRIPTION).", "the K-1 body content", "write_candidates"],
  ["7", "Select the template and render it with the Portal deep link.", "the e-mail payload", "render_and_send"],
  ["8", "Send.", "the gateway response", "render_and_send · pool pb_notify_relay"],
  ["9", "On success: EMAIL_STATUS = Sent, SENT_TS stamped.", "Sent", "render_and_send"],
  ["10", "On failure or bounce: EMAIL_STATUS = Failed, ERROR_MESSAGE.", "Failed", "render_and_send · match_to_tracking in the bounce DAG"],
  ["11", "If Failed and the type is 1099 or K1: notify the RM and RA.", "escalation", "notify_rm_ra, in both DAGs"],
  ["12", "Produce the daily run summary: counts by type and status, exceptions.", "the operations report", "publish_run_event · publish_check_event"],
];
// The status lifecycle, including the transition the bounce check adds.
export const LIFECYCLE = [
  ["new", "Processing", "the tracking row is created for the day's candidate", "open_tracking"],
  ["Processing", "Sent", "the relay accepted the message; SENT_TS stamped", "render_and_send"],
  ["Processing", "Failed", "the relay refused it and the attempt limit is reached; ERROR_MESSAGE holds the last error", "render_and_send"],
  ["Processing", "Processing", "the gateway was unavailable: the row is left as it is and the next attempt retries it", "render_and_send"],
  ["Sent", "Failed", "a non-delivery report matched the row; BOUNCE_CLASS and BOUNCE_REASON recorded", "match_to_tracking"],
  ["Failed", "Failed, RM and RA told", "the type is 1099 or K1", "notify_rm_ra"],
];
// The document's test scenarios, and the rule on this page that decides each.
export const TESTS = [
  ["T01", "Statements posted; the user is not in the suppress table", "statements-only e-mail", "no suppression row permits · Y / N"],
  ["T02", "Statements on two accounts; one permitted, one suppressed", "statements-only e-mail", "at least one account permits"],
  ["T03", "Statements posted; every account suppressed", "no record, no e-mail", "N / N: nothing tracked"],
  ["T04", "Confirms only, permitted", "confirms-only e-mail", "N / Y"],
  ["T05", "Statements and confirms both eligible", "one combined e-mail, one STATEMENT_CONFIRM record", "Y / Y · one record whichever e-mail"],
  ["T06", "Statements eligible; confirms suppressed on every account", "statements-only e-mail", "evaluated per document type"],
  ["T07", "Statement on account A (permitted), confirm on account B (permitted), each suppressed on the other", "combined e-mail", "an opt-out on one account does not suppress another"],
  ["T08", "1099 on two of five accounts; the user suppressed for statements", "1099 e-mail sent", "preferences do not apply to tax types"],
  ["T09", "1099 on the remaining three accounts the next day", "a new 1099 e-mail for the new date", "the key includes PROCESS_DATE"],
  ["T10", "K-1 for three funds across accounts", "one K-1 e-mail listing the three funds once each", "the K1 detail grouped per user"],
  ["T11", "K-1 with ESTIMATE_IND = Y", "excluded", "final documents only"],
  ["T12", "K-1 for a tax year other than the prior year", "excluded", "TAX_YR_NUM = the prior calendar year"],
  ["T13", "Deleted user (DELETED_IND = Y)", "excluded", "the eligibility queries, and the re-check before the send"],
  ["T14", "Internal user", "excluded", "USER_TYPE = EXTERNAL"],
  ["T15", "The job runs twice on the same day", "no duplicate e-mails", "the unique key; Sent rows left alone"],
  ["T16", "A 1099 e-mail bounces", "Failed; the RM and RA notified", "the bounce check · notify_rm_ra"],
  ["T17", "A statement e-mail bounces", "Failed; no RM or RA alert", "tax types only go to the RM and RA; system development is still alerted"],
  ["T18", "The user has no warehouse e-mail", "exception logged; nothing sent", "EMAIL_ADDRESS_NOT_FOUND, never a silent drop"],
];
// The document's thirteen open items and where each one lands on this page.
export const OPEN_ITEMS = [
  ["1", "Send time: can it be 8:00 a.m. ET?", "G8 and R6: the posting sensor with 08:00 ET as the latest start"],
  ["2", "The day-two example says every account = N gives no e-mail, contradicting N = permitted", "G6"],
  ["3", "1099 family: the narrative says TX1099 and TX1099R, the SQL adds three more", "G9"],
  ["4", "The 1099 SQL lacks ESTIMATE_IND = N", "G10"],
  ["5", "K-1 identified by an exclusion list", "G11"],
  ["6", "The K-1 left join can yield a null description", "G12"],
  ["7", "Loan Statements are in the grid but the SQL takes SUNGARD1 only", "G17"],
  ["8", "No RM and RA source", "G13"],
  ["9", "Bounce capture not defined", "designed: the bounce-check DAG reads the sending mailbox through Microsoft 365 (R10); the registration is G15"],
  ["10", "SYSDATE hard-coded in the extracts", "designed: PROCESS_DATE is bound into every query and written on every row"],
  ["11", "Retry policy for Failed", "G18"],
  ["12", "The test e-mail file uses one QA address for every user", "G3: the environment safeguard"],
  ["13", "Portal deep links not specified", "G19"],
];

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
function BounceFig({ t }) {
  const W = 1120;
  const node = (x, y, w, title, sub, c) => (<g key={title}>
    <rect x={x} y={y} width={w} height={46} rx={4} fill={t.panel} stroke={c || MARK.PROPOSED.c} strokeWidth={1.5} />
    <text x={x + 8} y={y + 18} fontSize={10} fontWeight={700} fill={ink(t)}>{title}</text>
    <text x={x + 8} y={y + 32} fontSize={8.5} fill={mut(t)}>{sub}</text>
  </g>);
  const a = (d, dashed) => <path d={d} stroke={mut(t)} strokeWidth={1.2} fill="none" strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#pbn-arr5)" />;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} 214`} role="img" style={{ display: "block", minWidth: 860, width: "100%", height: "auto" }}
        aria-label="How a bounce is detected. The send task hands the message to the internal relay with an X-PB-Notification-Id header and stores the Message-Id on the tracking row. The relay delivers to the client's mail system. If it bounces, a non-delivery report comes back to the sending mailbox in Microsoft 365. The bounce-check DAG reads that mailbox through Microsoft Graph, matches the report to the tracking row, marks it Failed with the class and reason, alerts the system development team, sends 1099 and K-1 failures to the Relationship Manager and Associate, and publishes a guardrail event.">
        <defs><marker id="pbn-arr5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>BOUNCE DETECTION · THE RELAY ACCEPTING A MESSAGE IS NOT DELIVERY</text>
        {node(12, 30, 170, "render_and_send", "header X-PB-Notification-Id · Message-Id stored")}
        {node(222, 30, 150, "Internal relay", "accepts · Sent + SENT_TS")}
        {node(412, 30, 170, "Client's mail system", "delivers, or refuses", t.border)}
        {node(622, 30, 200, "Sending mailbox · Microsoft 365", "non-delivery reports arrive here", t.border)}
        {node(862, 30, 240, "pb_notification_bounce_check", "every 2 hours · Graph · read that mailbox only")}
        {node(862, 110, 240, "match_to_tracking", "by notification id or Message-Id · HARD / SOFT")}
        {node(622, 110, 200, "Tracking row", "Sent → Failed · BOUNCE_CLASS · REASON")}
        {node(412, 110, 170, "System development team", "one e-mail per check · hard bounces", MARK.REQUIRED.c)}
        {node(222, 110, 150, "RM and RA", "1099 and K1 only", MARK.REQUIRED.c)}
        {node(12, 110, 170, "Guardrail event", "sent · hard · soft · unmatched")}
        {a("M182 53 L220 53")}{a("M372 53 L410 53")}{a("M582 53 L620 53", true)}{a("M822 53 L860 53")}
        {a("M982 76 L982 108")}{a("M862 133 L824 133")}{a("M622 133 L584 133")}{a("M412 133 L374 133")}{a("M222 133 L184 133")}
        <text x={12} y={184} fontSize={9.5} fill={mut(t)}>Dashed: the bounce path, which happens minutes to hours after the send. The check watches each notification for 48 hours after SENT_TS; a soft bounce is re-checked, a hard bounce is Failed at once.</text>
        <text x={12} y={200} fontSize={9.5} fill={MARK.OPEN.c}>OPEN G15: the Graph application registration, read-only on that one mailbox, and the system development distribution list are PB Systems' to provide.</text>
      </svg>
    </div>);
}
function Code({ t, title, code }) {
  return (
    <div style={{ margin: "8px 0 14px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>{title}</div>
      <pre style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre", overflowX: "auto", background: t.bg, border: `1px solid ${t.border}`,
        borderRadius: t.radius.md, padding: "10px 12px", margin: 0, color: t.text, maxHeight: 560 }}>{code}</pre>
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

// The high-level design: who and what is involved, and the numbered flows
// between them, on one picture. Context level: the Portal's Oracle schema
// on the left, the Hub in the middle, mail on the right, people around.
export const HLD_FLOWS = [
  ["1", "Posting process completes the day; the sensor sees the completion record"],
  ["2", "Three eligibility queries read the Portal schema (the Excel extracts in the proof of concept)"],
  ["3", "Candidates, K-1 lines and tracking rows written to the Hub schema"],
  ["4", "One message per tracking row through the internal relay to the client"],
  ["5", "A bounce returns as a non-delivery report to the sending mailbox in Microsoft 365"],
  ["6", "The bounce check reads that mailbox through Graph and marks the row Failed"],
  ["7", "Alerts: hard bounces to system development; 1099 and K-1 failures to the RM and RA"],
  ["8", "A guardrail event per run; Quality Guardrails and the RM/RA view read the rows"],
];
function HldFig({ t }) {
  const W = 1180, H = 470;
  const box = (x, y, w, h, title, lines, c, kind) => (<g key={title}>
    <rect x={x} y={y} width={w} height={h} rx={5} fill={t.panel} stroke={c || t.border} strokeWidth={1.6} />
    {kind && <text x={x + 8} y={y + 11} fontSize={7.5} fontWeight={800} letterSpacing=".6" fill={mut(t)}>{kind}</text>}
    <text x={x + 8} y={y + 26} fontSize={11} fontWeight={700} fill={ink(t)}>{title}</text>
    {lines.map((l, i) => <text key={i} x={x + 8} y={y + 40 + i * 12} fontSize={9} fill={mut(t)}>{l}</text>)}
  </g>);
  const person = (x, y, name, role) => (<g key={name}>
    <circle cx={x + 14} cy={y + 10} r={8} fill="none" stroke={ink(t)} strokeWidth={1.3} />
    <path d={`M${x + 2} ${y + 34} Q${x + 14} ${y + 18} ${x + 26} ${y + 34}`} fill="none" stroke={ink(t)} strokeWidth={1.3} />
    <text x={x + 36} y={y + 14} fontSize={10.5} fontWeight={700} fill={ink(t)}>{name}</text>
    <text x={x + 36} y={y + 27} fontSize={8.5} fill={mut(t)}>{role}</text>
  </g>);
  const flow = (d, n, lx, ly, dashed) => (<g key={n + d}>
    <path d={d} fill="none" stroke={dashed ? mut(t) : t.accent} strokeWidth={1.4} strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#pbn-hld)" />
    {n && <><circle cx={lx} cy={ly} r={8} fill={t.accent} /><text x={lx} y={ly + 3.5} fontSize={9} fontWeight={800} fill="#fff" textAnchor="middle">{n}</text></>}
  </g>);
  const P = MARK.PROPOSED.c, R = MARK.REQUIRED.c;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 960, width: "100%", height: "auto" }}
        aria-label={`High-level design of the PB notification utility. Left: the Client Portal's Oracle schema with the posting tables, the user and account map and the suppression table, and the Excel extracts used by the proof of concept. Middle: the Integration Hub with two Airflow DAGs, the daily run and the bounce check, task pods, the Hub schema holding the candidate, K-1 detail and tracking tables, the guardrail events in the CP 360 metadata and the screens. Right: the internal mail relay, the client's mailbox, and the sending mailbox in Microsoft 365 read through Graph. People: the client, PB Systems as operator, the system development team, the Relationship Manager and Associate. Eight numbered flows: ${HLD_FLOWS.map(([n, f]) => `${n} ${f}`).join("; ")}.`}>
        <defs><marker id="pbn-hld" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={t.accent} /></marker></defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>HIGH-LEVEL DESIGN · PB NOTIFICATIONS ON THE INTEGRATION HUB</text>
        {/* left: sources */}
        <text x={12} y={40} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={mut(t)}>CLIENT PORTAL · ORACLE</text>
        {box(12, 48, 230, 96, "Portal schema", ["TPW101_STMT_RPT · TPW102_CNF_RPT", "TPW103_TAX_DOC_RPT · TPW005_MOBIUS_MAP", "TWM001_USER_REF · TWM002_USER_ACCOUNT_MAP", "TWM049_SUPPRESS_EMAIL · read only"], R, "SOURCE")}
        {box(12, 156, 230, 46, "Posting process", ["writes the completion record per day"], MARK.OPEN.c, "SOURCE")}
        {box(12, 214, 230, 58, "Interested-party record", ["the client's e-mail on file in the warehouse", "END_DATE IS NULL"], R, "SOURCE")}
        {box(12, 284, 230, 46, "Excel extracts · proof of concept", ["the same four queries, as workbooks"], t.border, "POC ONLY")}
        {/* middle: the hub — the daily DAG alone on the first row so its send
            path leaves the frame without crossing anything */}
        <rect x={290} y={34} width={520} height={330} rx={8} fill="none" stroke={P} strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={300} y={50} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={P}>INTEGRATION HUB · ONE NAMESPACE PER ENVIRONMENT</text>
        {box(300, 60, 240, 66, "DAG · pb_notification_daily", ["weekdays 07:30 ET · sensor to 08:00", "eligibility ×3 → candidates → tracking → send", "task pods on the workbench image"], P, "AIRFLOW")}
        {box(300, 142, 500, 70, "Hub schema", ["PB_NOTIFICATION_CANDIDATE · one row per user, type, date", "PB_NOTIFICATION_K1_DETAIL · one row per date, user, report", "PB_NOTIFICATION_TRACKING · the daily unique key · Processing / Sent / Failed · bounce columns"], P, "ORACLE · LIQUIBASE")}
        {box(300, 228, 240, 56, "Guardrail events · CP 360 metadata", ["candidates · exceptions · sent · failed", "bounced hard / soft · unmatched, per run"], P, "EVIDENCE")}
        {box(560, 228, 240, 56, "DAG · pb_notification_bounce_check", ["every 2 hours · Graph · read one mailbox", "match → Failed → alert → event"], P, "AIRFLOW")}
        {box(300, 300, 240, 50, "Namespace Secret", ["read-only Portal account · relay · Graph", "credentials; nothing in the repository"], t.border, "SECRETS")}
        {box(560, 300, 200, 50, "CP 360 screens", ["Quality Guardrails · the RM/RA view", "this design page"], P, "SCREENS")}
        {/* right: mail */}
        <text x={850} y={40} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={mut(t)}>MAIL</text>
        {box(850, 48, 318, 56, "Internal relay", ["one message per tracking row", "X-PB-Notification-Id header · Message-Id stored"], R, "SMTP")}
        {box(850, 118, 318, 46, "Client's mailbox", ["delivers, or refuses"], t.border, "EXTERNAL")}
        {box(850, 178, 318, 58, "Sending mailbox · Microsoft 365", ["the Client Portal sender", "non-delivery reports arrive here · read through Graph"], R, "BROKER")}
        {/* people */}
        <text x={12} y={366} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={mut(t)}>PEOPLE</text>
        {person(12, 376, "Client", "receives the notification")}
        {person(222, 376, "PB Systems", "operates the run · owns the reference data")}
        {person(482, 376, "RM and RA", "told of failed 1099 and K-1 e-mails")}
        {person(752, 376, "System development team", "alerted on every hard bounce")}
        {person(992, 376, "PB business", "owns the rules and the open questions")}
        {/* flows: each in its own lane, none through a box */}
        {flow("M242 179 L270 179 L270 93 L298 93", "1", 270, 136)}
        {flow("M242 96 L298 96", "2", 266, 86)}
        {flow("M242 243 L286 243 L286 110 L298 110", "", 0, 0)}
        {flow("M242 307 L270 307 L270 120 L298 120", "", 0, 0, true)}
        {flow("M420 126 L420 140", "3", 434, 134)}
        {flow("M540 80 L848 80", "4", 700, 70)}
        {flow("M1009 104 L1009 116", "", 0, 0)}
        {flow("M1009 164 L1009 176", "5", 1030, 170, true)}
        {flow("M850 195 L838 195 L838 242 L800 242", "6", 838, 220, true)}
        {flow("M680 228 L680 214", "", 0, 0)}
        {flow("M420 212 L420 226", "8", 434, 220)}
        {flow("M560 270 L548 270 L548 376", "7", 548, 330)}
        {flow("M790 284 L790 376", "7", 804, 330)}
        <text x={12} y={428} fontSize={9.5} fill={mut(t)}>Solid: the daily path. Dashed: the proof-of-concept input and the bounce path, which happens minutes to hours after the send. Flow 7 is the alert: hard bounces to system development, tax failures to the RM and RA.</text>
        <text x={12} y={444} fontSize={9.5} fill={mut(t)}>The Portal schema is only read. Everything the utility writes is in the Hub schema, created by Liquibase. Hostnames, mailboxes and credentials live in Environment 360 and the namespace Secret.</text>
        <text x={12} y={460} fontSize={9.5} fill={MARK.OPEN.c}>Open before build: the completion record from the posting process (G8), the Graph registration and the system development list (G15), the relationship-team source (G13).</text>
      </svg>
    </div>);
}

// The end-to-end business flow, as the document draws it, on four swimlanes:
// posting, eligibility, track-and-send, and the outcome for the people. The
// flow leaves each lane at its right end and re-enters the next at its left
// along the gap between the lanes, so no line crosses a box.
function BusinessFlowFig({ t }) {
  const W = 1180, H = 486, P = MARK.PROPOSED.c, R = MARK.REQUIRED.c;
  const lane = (y, h, l1, l2) => (<g key={l1 + y}>
    <rect x={12} y={y} width={W - 24} height={h} rx={4} fill={t.bg} />
    <text x={22} y={y + h / 2 - 3} fontSize={8} fontWeight={800} letterSpacing=".5" fill={mut(t)}>{l1}</text>
    <text x={22} y={y + h / 2 + 9} fontSize={8} fontWeight={800} letterSpacing=".5" fill={mut(t)}>{l2}</text>
  </g>);
  const box = (x, y, w, h, title, sub, c) => { const lines = Array.isArray(title) ? title : [title]; return (<g key={`${x}-${y}`}>
    <rect x={x} y={y} width={w} height={h} rx={4} fill={t.panel} stroke={c || t.border} strokeWidth={1.5} />
    {lines.map((l, i) => <text key={i} x={x + 8} y={y + 16 + i * 12} fontSize={10} fontWeight={700} fill={ink(t)}>{l}</text>)}
    {sub && <text x={x + 8} y={y + h - 8} fontSize={8.5} fill={mut(t)}>{sub}</text>}
  </g>); };
  const dia = (cx, cy, w, h, l1, l2) => (<g key={`d${cx}-${cy}`}>
    <path d={`M${cx - w / 2} ${cy} L${cx} ${cy - h / 2} L${cx + w / 2} ${cy} L${cx} ${cy + h / 2} Z`} fill={t.panel} stroke={MARK.OPEN.c} strokeWidth={1.5} />
    <text x={cx} y={cy + (l2 ? -1 : 3.5)} fontSize={8.5} fontWeight={700} fill={ink(t)} textAnchor="middle">{l1}</text>
    {l2 && <text x={cx} y={cy + 10} fontSize={8.5} fontWeight={700} fill={ink(t)} textAnchor="middle">{l2}</text>}
  </g>);
  const a = (d, dashed) => <path key={d} d={d} fill="none" stroke={mut(t)} strokeWidth={1.3} strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#pbn-biz)" />;
  const lbl = (x, y, s, c) => <text key={`${x}-${y}-${s}`} x={x} y={y} fontSize={8} fontWeight={700} fill={c || mut(t)}>{s}</text>;
  const stack = ["Statements · TPW101_STMT_RPT", "Trade Confirms · TPW102_CNF_RPT", "1099 · TPW103_TAX_DOC_RPT", "K-1 · TPW103 + TPW005_MOBIUS_MAP"];
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 960, width: "100%", height: "auto" }}
        aria-label="The end-to-end business flow on four lanes. Posting: daily documents are posted to the Client Portal; when the posting cycle is complete, by 08:00 ET at the latest, the processing date is fixed. Eligibility: the posted statements, trade confirms, 1099s and K-1s are extracted for the processing date, accounts are mapped to active external users, suppression is applied to statements and confirms only, one candidate per user and notification type is consolidated, and the e-mail of record is looked up in the warehouse. Track and send: if a tracking row already exists for the user, type and date the candidate is skipped; otherwise a row is inserted as Processing, the template is selected and rendered with the Portal deep link, and the e-mail is sent. Delivered: Sent with the timestamp and the client receives it. Not delivered or bounced: Failed with the error; for 1099 and K-1 the Relationship Manager and Associate are notified, otherwise it is logged. A daily run summary closes the run.">
        <defs><marker id="pbn-biz" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker></defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>END-TO-END BUSINESS FLOW · FROM THE DAY'S POSTING TO THE CLIENT'S INBOX</text>
        {lane(30, 72, "CLIENT PORTAL", "POSTING")}
        {lane(120, 126, "NOTIFICATION UTILITY", "ELIGIBILITY")}
        {lane(264, 98, "NOTIFICATION UTILITY", "TRACK AND SEND")}
        {lane(380, 74, "OUTCOME", "PEOPLE")}
        {/* lane 1 */}
        {box(166, 44, 190, 44, "Daily document posting", "statements · confirms · 1099 · K-1", R)}
        {a("M356 66 L380 66")}
        {dia(456, 66, 150, 48, "Posting cycle", "complete?")}
        {lbl(394, 99, "No · the sensor keeps polling", MARK.OPEN.c)}
        {a("M531 66 L556 66")}{lbl(534, 58, "Yes")}
        {box(558, 44, 170, 44, "PROCESS_DATE fixed", "by 08:00 ET at the latest", P)}
        {a("M643 88 L643 110 L236 110 L236 156")}
        {/* lane 2 */}
        {box(166, 158, 140, 52, "Extract posted", "for PROCESS_DATE · 3 queries", P)}
        {stack.map((s, i) => box(326, 130 + i * 28, 174, 22, [], null, R))}
        {stack.map((s, i) => <text key={s} x={334} y={130 + i * 28 + 15} fontSize={8} fontWeight={700} fill={ink(t)}>{s}</text>)}
        {[141, 169, 197, 225].map((y) => a(`M306 184 L316 184 L316 ${y} L324 ${y}`))}
        {[141, 169, 197, 225].map((y) => a(`M500 ${y} L510 ${y} L510 184 L518 184`))}
        {box(520, 158, 150, 52, ["Map accounts to", "active external users"], "TWM002 · TWM001 · active only", R)}
        {a("M670 184 L688 184")}
        {box(690, 158, 150, 52, "Apply suppression", "TWM049 · not for the tax types", R)}
        {a("M840 184 L858 184")}
        {box(860, 158, 150, 52, "Consolidate", "per user and notification type", P)}
        {a("M1010 184 L1028 184")}
        {box(1030, 158, 138, 52, "Look up the e-mail", "warehouse · none → exception", R)}
        {a("M1099 210 L1099 254 L236 254 L236 294")}
        {/* lane 3 */}
        {dia(236, 322, 140, 56, "Tracking row exists", "for user · type · date?")}
        {a("M306 322 L328 322")}{lbl(309, 314, "No")}
        {box(330, 298, 150, 48, "Insert tracking row", "EMAIL_STATUS = Processing", P)}
        {a("M480 322 L498 322")}
        {box(500, 298, 160, 48, "Select template · render", "with the Portal deep link", P)}
        {a("M660 322 L678 322")}
        {box(680, 298, 110, 48, "Send", "the internal relay", R)}
        {a("M790 322 L808 322")}
        {dia(870, 322, 120, 52, "Delivered?")}
        {a("M930 322 L948 322")}{lbl(931, 314, "Yes")}
        {box(950, 298, 108, 48, "Sent · SENT_TS", "the row is done", P)}
        {a("M1058 322 L1066 322")}
        {box(1068, 298, 100, 48, ["Client reads", "the e-mail"], null, t.border)}
        {/* lane 4 */}
        {a("M236 350 L236 388")}{lbl(242, 372, "Yes · duplicate")}
        {box(176, 390, 130, 36, "Skipped", "nothing is sent twice", t.border)}
        {box(330, 390, 180, 36, "Daily run summary", "counts by type and status · exceptions", P)}
        {box(530, 390, 150, 36, "Exception log", "EMAIL_ADDRESS_NOT_FOUND", P)}
        {a("M870 348 L870 388")}{lbl(876, 372, "No · bounce", "#b42318")}
        {box(815, 390, 110, 36, "Failed", "ERROR_MESSAGE", "#b42318")}
        {a("M925 408 L938 408")}
        {dia(995, 408, 110, 42, "1099 or K1?")}
        {a("M1050 408 L1066 408")}{lbl(1051, 400, "Yes")}
        {box(1068, 390, 100, 36, "RM and RA told", "the follow-up", R)}
        {lbl(960, 446, "No · logged only")}
        <text x={12} y={470} fontSize={9.5} fill={mut(t)}>Diamonds are decisions. A bounce after acceptance also moves a Sent row to Failed, found by the bounce check; the technical flow below shows how. Statement and confirm failures are logged and not escalated.</text>
        <text x={12} y={484} fontSize={9.5} fill={MARK.OPEN.c}>Open: the 08:00 ET send time (G8), the Portal deep links (G19) and the retry policy for Failed rows (G18).</text>
      </svg>
    </div>);
}

// The technical flow: the two Airflow DAGs with every task, and the data
// each task reads (dashed) or writes (solid). The daily DAG on top, the
// stores in the middle, the bounce check underneath, each task directly
// above or below the store it touches so the lines stay vertical.
function TechDagFig({ t }) {
  const W = 1180, H = 500, P = MARK.PROPOSED.c, R = MARK.REQUIRED.c;
  const X = (i) => 14 + i * 168, CW = 148;
  const task = (i, y, name, sub, c) => (<g key={name + y}>
    <rect x={X(i)} y={y} width={CW} height={40} rx={4} fill={t.panel} stroke={c || P} strokeWidth={1.5} />
    <text x={X(i) + 8} y={y + 16} fontSize={9} fontWeight={700} fill={ink(t)} style={mono}>{name}</text>
    <text x={X(i) + 8} y={y + 30} fontSize={7.8} fill={mut(t)}>{sub}</text>
  </g>);
  const store = (x, w, title, l1, l2, c) => (<g key={title}>
    <rect x={x} y={244} width={w} height={64} rx={4} fill={t.bg} stroke={c} strokeWidth={1.6} />
    <text x={x + 8} y={244 + 17} fontSize={10} fontWeight={700} fill={ink(t)}>{title}</text>
    <text x={x + 8} y={244 + 33} fontSize={8.5} fill={mut(t)} style={mono}>{l1}</text>
    <text x={x + 8} y={244 + 47} fontSize={8.5} fill={mut(t)}>{l2}</text>
  </g>);
  const a = (d, dashed) => <path key={d} d={d} fill="none" stroke={dashed ? mut(t) : t.accent} strokeWidth={1.3} strokeDasharray={dashed ? "4 3" : undefined} markerEnd={dashed ? "url(#pbn-tr)" : "url(#pbn-tw)"} />;
  const chain = (d) => <path key={d} d={d} fill="none" stroke={mut(t)} strokeWidth={1.2} markerEnd="url(#pbn-tr)" />;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 960, width: "100%", height: "auto" }}
        aria-label="The technical Airflow flow. The daily DAG pb_notification_daily: wait_posting_complete reads the posting completion record; three eligibility pods read the Portal schema in parallel; resolve_address reads the warehouse; write_candidates and open_tracking write the Hub schema tables; render_and_send sends through the internal relay and updates the tracking status; publish_run_event writes the guardrail event and notify_rm_ra hands failed tax notifications to the RM and RA view. The bounce DAG pb_notification_bounce_check: read_ndr_mailbox reads the sending mailbox in Microsoft 365 through Graph; match_to_tracking moves matched rows to Failed in the Hub schema; alert_system_dev e-mails the system development team through the relay; notify_rm_ra hands 1099 and K-1 hard bounces to the RM and RA; publish_check_event writes the guardrail event. Dashed lines are reads, solid lines are writes.">
        <defs>
          <marker id="pbn-tr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={mut(t)} /></marker>
          <marker id="pbn-tw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={t.accent} /></marker>
        </defs>
        <text x={12} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={ink(t)}>TECHNICAL FLOW · TWO AIRFLOW DAGS AND WHAT EACH TASK READS AND WRITES</text>
        <text x={14} y={38} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={P}>DAG pb_notification_daily · weekdays 07:30 ET · catchup off · max_active_runs 1 · retries 2</text>
        {task(0, 98, "wait_posting_complete", "sensor · reschedule · to 08:00 ET", MARK.OPEN.c)}
        {task(1, 50, "eligibility_stmt_confirm", "pod · the suppression rule")}
        {task(1, 98, "eligibility_1099", "pod · family from reference data")}
        {task(1, 146, "eligibility_k1", "pod · prior year · Mobius name")}
        {task(2, 98, "resolve_address", "pod · left join · exception rows")}
        {task(3, 98, "write_candidates", "pod · merge by the date key")}
        {task(4, 98, "open_tracking", "pod · insert Processing rows")}
        {task(5, 98, "render_and_send", "pod · pool pb_notify_relay")}
        {task(6, 74, "notify_rm_ra", "failed 1099 / K1 → RM/RA view")}
        {task(6, 122, "publish_run_event", "guardrail event · all_done")}
        {chain("M162 118 L172 118 L172 70 L180 70")}{chain("M162 118 L180 118")}{chain("M162 118 L172 118 L172 166 L180 166")}
        {chain("M330 70 L340 70 L340 118 L348 118")}{chain("M330 118 L348 118")}{chain("M330 166 L340 166 L340 118 L348 118")}
        {chain("M498 118 L516 118")}{chain("M666 118 L684 118")}{chain("M834 118 L852 118")}
        {chain("M1002 118 L1012 118 L1012 94 L1020 94")}{chain("M1002 118 L1012 118 L1012 142 L1020 142")}
        <text x={100} y={236} fontSize={8} fontWeight={800} letterSpacing=".4" fill={mut(t)}>DASHED = READ · SOLID = WRITE</text>
        {store(14, 148, "Completion record", "per PROCESS_DATE", "written by the posting process", MARK.OPEN.c)}
        {store(182, 148, "Portal schema · PBCPAPP", "TPW101 · 102 · 103 · 005", "TWM001 · 002 · 049 · read only", R)}
        {store(350, 160, "Warehouse · PBDWAPP", "DIM_IP_RELATIONSHIP", "DIM_INTERESTED_PARTY · current", R)}
        {store(518, 316, "Hub schema · PB_NOTIFICATION_*", "CANDIDATE · K1_DETAIL · TRACKING", "unique key per user, type, date · Liquibase changeset", P)}
        {store(854, 148, "Internal relay · SMTP", "X-PB-Notification-Id", "Message-Id stored on the row", R)}
        {store(1022, 148, "CP 360 metadata", "guardrail_events", "per run and type · the RM/RA view", P)}
        {a("M88 138 L88 242", true)}{a("M256 186 L256 242", true)}{a("M424 138 L424 242", true)}
        {a("M592 138 L592 242")}{a("M760 138 L760 242")}{a("M928 138 L928 242")}{a("M870 138 L870 222 L820 222 L820 242")}{a("M1096 162 L1096 242")}
        <text x={14} y={346} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={P}>DAG pb_notification_bounce_check · every 2 hours 08:00–20:00 ET and once at 06:00 ET · max_active_runs 1</text>
        <g><rect x={X(0)} y={378} width={CW} height={40} rx={4} fill={t.bg} stroke={R} strokeWidth={1.6} />
          <text x={X(0) + 8} y={394} fontSize={9.5} fontWeight={700} fill={ink(t)}>Sending mailbox · M365</text>
          <text x={X(0) + 8} y={408} fontSize={8} fill={mut(t)}>non-delivery reports · Graph</text></g>
        {task(1, 378, "read_ndr_mailbox", "pod · Graph · watermark")}
        {task(3, 378, "match_to_tracking", "pod · match by id · HARD / SOFT")}
        {task(5, 354, "alert_system_dev", "Hub task · one e-mail per run")}
        {task(5, 402, "notify_rm_ra", "1099 / K1 hard bounces → RM/RA")}
        {task(6, 378, "publish_check_event", "guardrail event · all_done")}
        {chain("M162 398 L180 398")}{chain("M330 398 L516 398")}
        {chain("M666 398 L844 398 L844 374 L852 374")}{chain("M666 398 L844 398 L844 422 L852 422")}
        {chain("M1002 374 L1012 374 L1012 398 L1020 398")}{chain("M1002 422 L1012 422 L1012 398 L1020 398")}
        {a("M592 378 L592 310")}{a("M928 354 L928 310")}{a("M1096 378 L1096 310")}
        <text x={12} y={466} fontSize={9.5} fill={mut(t)}>Every task is a pod on the workbench image except the sensor and the Hub's shared event and notification tasks. XCom carries counts and the processing date only. Only the send task is in the relay pool.</text>
        <text x={12} y={482} fontSize={9.5} fill={mut(t)}>Reads bind :process_date, never SYSDATE. Writes go by the date key and the tracking key, so a rerun sends nothing twice. Secrets come from the namespace Secret; nothing is in the DAG file.</text>
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
function Tbl({ t, head, rows, keys, editCol = 1 }) {
  // With a review context and a key per row, each row carries a pencil and
  // an edited text replaces the shipped one; without them this is a table.
  const rv = useContext(ReviewCtx);
  const withRv = !!(rv && keys);
  const th = { textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" };
  return (
    <div style={{ overflowX: "auto", margin: "8px 0 14px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, minWidth: 560 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={th}>{h}</th>)}{withRv && <th style={{ ...th, width: 1 }}>Review</th>}</tr></thead>
        <tbody>{rows.map((r, i) => {
          const k = withRv ? keys[i] : null;
          const original = typeof r[editCol] === "string" ? r[editCol] : "";
          let cells = r;
          const e = k && rv.review.edits ? rv.review.edits[k] : null;
          if (e && e.body && original) {
            cells = [...r];
            cells[editCol] = <span><span>{e.body}</span> <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: "#159943", border: "1px solid #159943", borderRadius: 3, padding: "0 5px", marginLeft: 6, whiteSpace: "nowrap" }} title={`edited by ${e.author} on ${e.at}. Shipped text: ${original}`}>edited</span></span>;
          }
          return (<React.Fragment key={i}>
            <tr>{cells.map((c, j) => <td key={j} style={{ padding: "8px 12px 8px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: j === 0 ? t.text : t.sub, fontWeight: j === 0 ? 600 : 400, lineHeight: 1.5 }}>{c}</td>)}
              {k && <td style={{ padding: "6px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}` }}><ReviewMark k={k} /></td>}</tr>
            {k && rv.openKey === k && <tr><td colSpan={head.length + 1} style={{ padding: "0 0 4px" }}><ReviewPanel k={k} text={original} /></td></tr>}
          </React.Fragment>);
        })}</tbody>
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
    <H2 t={t} sub="The whole utility on one picture: the Portal schema it reads, the Hub it runs on, the mail it sends and the bounce it watches for, and the people around it.">High-level design</H2>
    <HldFig t={t} />
    <Tbl t={t} head={["#", "Flow"]} rows={HLD_FLOWS.map(([n, f]) => [n, f])} keys={HLD_FLOWS.map(([n]) => `hld:${n}`)} />
    <H2 t={t}>Background</H2>
    {BACKGROUND.map((p) => <P key={p.slice(0, 30)} t={t}>{p}</P>)}
    <H2 t={t}>The enhancement</H2>
    <P t={t}>{ENHANCEMENT}</P>
    <H2 t={t} sub="The proof of concept runs on the four Excel extracts. The built utility connects to the Portal's Oracle schema and runs the same queries; from the candidate table onward nothing changes.">Proof of concept now, Oracle when built</H2>
    <Tbl t={t} head={["", "Proof of concept · Excel", "Built · Oracle"]} rows={MODES.map(([a, b, c]) => [a, b, c])} keys={MODES.map(([a]) => `mode:${a}`)} />
    <H2 t={t}>Why it is built on the Integration Hub</H2>
    <P t={t}>It is the first BBH pipeline on the Hub framework that is not an SEI interface: a daily, business-date-aware job that reads a BBH schema, writes its own tables, sends through the internal relay and leaves evidence in the CP 360 metadata. Everything it needs the Hub already has: the scheduler, the schema stage, the guardrail events, the screens and the secrets. Building it here means PB Systems can close the InServ process without standing up anything new.</P>
    <Tbl t={t} head={["Concern", "On the Hub", "Component"]} rows={HUB_FIT.map(([a, b, c]) => [a, b, c])} keys={HUB_FIT.map(([a]) => `fit:${a}`)} />
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>Not agreed yet.</b> {GAPS.filter((g) => g[4] === "OPEN").length} items on the Open gaps tab need an answer from PB business or PB Systems before the build starts; the first four are critical and the rest change the rules the queries implement.</Note>
  </>);
}
export function RequirementsTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t}>The requirements</H2>
    <Tbl t={t} head={["#", "Requirement", ""]} rows={REQUIREMENTS.map(([id, text, m]) => [id, text, <Chip m={m} />])} keys={REQUIREMENTS.map(([id]) => `req:${id}`)} />
    <H2 t={t} sub="The end-to-end requirements document numbers the business requirements BR-01 to BR-15. Each one, and where it lands on this page.">Traceability to BR-01 to BR-15</H2>
    <Tbl t={t} head={["BR", "Requirement", "Where it lands"]} rows={BR_TRACE.map(([id, text, where]) => [id, text, where])} keys={BR_TRACE.map(([id]) => `br:${id}`)} />
    <H2 t={t} sub="How each notification type decides who is eligible, where it reads, and what one record produces.">Per notification type</H2>
    {TYPES.map((x) => (
      <div key={x.key} style={{ border: `1px solid ${t.border}`, borderLeft: `4px solid ${MARK.REQUIRED.c}`, borderRadius: t.radius.md, background: t.panel, padding: "12px 16px", margin: "8px 0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ color: t.text, fontSize: 14 }}>{x.title}</b><span style={{ ...mono, fontSize: 11.5, color: t.textMuted }}>NOTIFICATION_TYPE = {x.key}</span>{x.always && <Chip m="REQUIRED">ALWAYS SENT</Chip>}<CardReview k={`type:${x.key}`} text={x.preference} /></div>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, marginTop: 6 }}>
          <div><b style={{ color: t.text }}>Reads</b> <span style={mono}>{x.source}</span></div>
          <div><b style={{ color: t.text }}>Posted today when</b> <span style={mono}>{x.posted}</span></div>
          <div><b style={{ color: t.text }}>Preference</b> {x.preference}</div>
          <div><b style={{ color: t.text }}>Outcome</b> {x.outcome}</div>
        </div>
      </div>))}
    <H2 t={t}>Notification type grid</H2>
    <Tbl t={t} head={["Type", "Frequency · send time", "Business trigger", "Preference and consolidation", "E-mail outcome"]} rows={GRID.map((r) => [...r])} keys={GRID.map((r) => `grid:${r[0]}`)} />
    <H2 t={t}>Notification tracking</H2>
    <P t={t}>One tracking table. A record per eligible user, notification type and processing date, created only when the user has at least one qualifying document for that type. STATEMENT_CONFIRM is one record whether the e-mail ends up statements-only, confirms-only or combined.</P>
    <Tbl t={t} head={["Field", "Meaning"]} rows={TRACKING_FIELDS.map(([a, b]) => [<span style={mono}>{a}</span>, b])} keys={TRACKING_FIELDS.map(([a]) => `field:${a}`)} />
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
    <Tbl t={t} head={["#", "Task", "What it does", ""]} rows={FLOW.map(([a, b, m], i) => [i + 1, a, b, <Chip m={m} />])} keys={FLOW.map((_, i) => `flow:${i + 1}`)} editCol={2} />
    <H2 t={t} sub="The one decision that is easy to get wrong: a user's accounts and their preferences, per document type, to one record and one e-mail.">Statements and confirms, decided</H2>
    <DecisionFig t={t} />
    <H2 t={t} sub="One DAG file in this application's repository, written to the Hub's DAG standards. The settings, the tasks and the dependencies.">Airflow DAG and orchestration</H2>
    <DagFig t={t} />
    <Tbl t={t} head={["Setting", "Value", "Why"]} rows={ORCHESTRATION.dag.map(([a, b, c]) => [<span style={mono}>{a}</span>, b, c])} keys={ORCHESTRATION.dag.map(([a]) => `dag:${a}`)} />
    <Tbl t={t} head={["Task", "Operator · where it runs", "What it does", "Writes", "On failure"]} rows={ORCHESTRATION.tasks.map(([a, b, c, d, e]) => [<span style={mono}>{a}</span>, b, c, d, e])} keys={ORCHESTRATION.tasks.map(([a]) => `task:${a}`)} editCol={2} />
    <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, margin: "6px 0 10px" }}><b style={{ color: t.text }}>Dependencies</b> <span style={{ ...mono, fontSize: 11.5 }}>{ORCHESTRATION.deps}</span></div>
    {ORCHESTRATION.rules.map((r) => <Note key={r.slice(0, 24)} t={t} c={MARK.PROPOSED.c}>{r}</Note>)}
    <H2 t={t} sub="What the repository holds and what the two DAG files look like. Skeletons to the Hub's DAG standards: every task is a pod on the workbench image, every secret comes from the namespace, every run is keyed by the processing date.">Implementation</H2>
    <Tbl t={t} head={["Path in the application repository", "Holds"]} rows={REPO_LAYOUT.map(([a, b]) => [<span style={mono}>{a}</span>, b])} keys={REPO_LAYOUT.map(([a]) => `repo:${a}`)} />
    <Code t={t} title="the daily DAG" code={DAG_CODE} />
    <Code t={t} title="the bounce-check DAG" code={BOUNCE_DAG_CODE} />
    <Code t={t} title="the shared pod helper every Hub DAG uses" code={POD_HELPER} />
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>Why the DAG files are this short.</b> The DAG declares order, timing, retries and callbacks and nothing else. Every task body is a command in a small Python package the pod runs, which is what the unit tests cover and what Gate 5 scans; the DAG file is what Gate 1 reads statically. A rule change is a change in the package or the reference data, never in the DAG.</Note>
    <H2 t={t} sub="The relay accepting a message is not delivery. A bounce comes back later, to the sending mailbox, and only the mail broker can tell us. A second short DAG reads it and alerts the people who have to act.">Bounce detection and the alert to system development</H2>
    <BounceFig t={t} />
    <Tbl t={t} head={["Concern", "How", "Why this way"]} rows={BOUNCE.how.map(([a, b, c]) => [a, b, c])} keys={BOUNCE.how.map(([a]) => `bounce:${a}`)} />
    <Tbl t={t} head={["Who is told", "What", "What is left out", ""]} rows={BOUNCE.alerts.map(([a, b, c, m]) => [a, b, c, <Chip m={m} />])} keys={BOUNCE.alerts.map(([a]) => `alert:${a}`)} />
    <Tbl t={t} head={["Setting", "Value"]} rows={ORCHESTRATION.bounce.dag.map(([a, b]) => [<span style={mono}>{a}</span>, b])} keys={ORCHESTRATION.bounce.dag.map(([a]) => `bdag:${a}`)} />
    <Tbl t={t} head={["Task", "Operator · where it runs", "What it does", "Writes", "On failure"]} rows={ORCHESTRATION.bounce.tasks.map(([a, b, c, d, e]) => [<span style={mono}>{a}</span>, b, c, d, e])} keys={ORCHESTRATION.bounce.tasks.map(([a]) => `btask:${a}`)} editCol={2} />
    <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6, margin: "6px 0 10px" }}><b style={{ color: t.text }}>Dependencies</b> <span style={{ ...mono, fontSize: 11.5 }}>{ORCHESTRATION.bounce.deps}</span></div>
    <Tbl t={t} head={["Column added to PB_NOTIFICATION_TRACKING", "Type", "Meaning"]} rows={BOUNCE.columns.map(([a, b, c]) => [<span style={mono}>{a}</span>, <span style={mono}>{b}</span>, c])} keys={BOUNCE.columns.map(([a]) => `bcol:${a}`)} editCol={2} />
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>The alert to system development carries the id, not the client.</b> Notification id, type, processing date, bounce class and the broker's reason, batched into one e-mail per check with the counts in the subject. The row in CP 360 has the rest. Nobody's address or name travels in an alert.</Note>
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
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ ...mono, color: t.text, fontSize: 13.5 }}>{m.name}</b><span style={{ fontSize: 11.5, color: t.textMuted }}>{m.grain}</span><Chip m="PROPOSED" /><CardReview k={`model:${m.name}`} text={m.grain} /></div>
        <Tbl t={t} head={["Column", "Type", "Meaning"]} rows={m.cols.map(([a, b, c]) => [<span style={mono}>{a}</span>, <span style={mono}>{b}</span>, c])} />
        <div style={{ fontSize: 12, color: t.sub }}><b style={{ color: t.text }}>Keys</b> <span style={mono}>{m.keys}</span></div>
      </div>))}
    <H2 t={t} sub="The nine tables the utility reads, as the requirements document names them. Seven in the Portal schema, two in the warehouse for the e-mail of record. None is modified.">Source data model</H2>
    <Tbl t={t} head={["Table", "Schema", "Purpose", "Key fields"]} rows={SOURCE_TABLES.map(([a, b, c, d]) => [<span style={mono}>{a}</span>, <span style={mono}>{b}</span>, c, <span style={{ ...mono, fontSize: 11.5 }}>{d}</span>])} keys={SOURCE_TABLES.map(([a]) => `tbl:${a}`)} editCol={2} />
    <P t={t}>The address path is USER_ID = DIM_IP_RELATIONSHIP.BBH_WEB_PORTAL_ID, then INTERESTED_PARTY_NUMBER to DIM_INTERESTED_PARTY where END_DATE IS NULL and E_MAIL_ADDRESS is present. A Portal user with no current interested-party row has no address, which is the exception the run counts.</P>
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>Where the tables live (G20).</b> The requirements document proposes the tracking and K-1 detail tables in the Portal's PBCPAPP schema, with the detail keyed by NOTIFICATION_ID and RPT_ID. This design keeps all three tables in the Hub schema, so the Portal schema stays read-only and the Liquibase stage applies the changeset like every other Hub table, and keys the detail by date, user and report so it can be written before the tracking row exists. Either placement works; the owner has to be agreed.</Note>
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
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ ...mono, color: t.text }}>{s.file}</b><span style={{ fontSize: 11.5, color: t.textMuted }}>{s.grain} · {s.rows.toLocaleString()} rows · a SQL sheet with the extraction query</span><CardReview k={`src:${s.file}`} text={s.fit} /></div>
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
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><span style={{ fontSize: 11, color: t.textMuted }}>From {SENDER} · subject</span><CardReview k={`tpl:${c.key}`} text={c.body} /></div>
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
    <Tbl t={t} head={["#", "Class", "Finding", "Proposed resolution", ""]} rows={GAPS.map(([id, cls, finding, fix, m]) => [id, <span style={{ color: cls === "critical" ? "#b42318" : t.sub, fontWeight: 700 }}>{cls}</span>, finding, fix, <Chip m={m} />])} keys={GAPS.map(([id]) => `gap:${id}`)} editCol={2} />
    <H2 t={t} sub="The end-to-end requirements document closes with thirteen open items. Where each one lands: a gap above, or a part of the design that already answers it.">The document's open items</H2>
    <Tbl t={t} head={["#", "Item", "Where it lands"]} rows={OPEN_ITEMS.map(([n, item, where]) => [n, item, where])} keys={OPEN_ITEMS.map(([n]) => `openitem:${n}`)} />
    <Note t={t} c={MARK.OPEN.c}><b style={{ color: t.text }}>To put to PB business and PB Systems, in this order.</b> The suppression flag reading (G6), the posting-complete trigger (G8), the 1099 family (G9, G10), the K-1 classification and the missing description (G11, G12), the relationship-team source (G13), the Loan Statement ids (G17), the retry limit (G18), the deep links (G19) and the owner of the tables (G20). The critical items G1 to G5 are ours to build and are in the design.</Note>
  </>);
}
export function ExceptionsTab({ t }) {
  return (<>
    <H2 t={t} sub="What can go wrong on a run and what the utility does about it. Outcomes: HOLD waits, SKIP does nothing by design, REJECT records an exception, RETRY tries again, FLAG changes a status after the fact.">Exceptions</H2>
    <Tbl t={t} head={["Scenario", "Detected by", "What the utility does", "Outcome"]} rows={EXCEPTIONS.map(([a, b, c, o]) => [a, b, c,
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: OUTCOME[o] || t.sub, border: `1px solid ${OUTCOME[o] || t.sub}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{o}</span>])} keys={EXCEPTIONS.map(([a]) => `exc:${a}`)} editCol={2} />
  </>);
}

export function WorkflowTab({ t }) {
  return (<>
    <Legend t={t} />
    <H2 t={t} sub="The whole process as the business reads it: what happens from the day's posting to the client's inbox, who does what, and what happens when a delivery fails.">End-to-end business flow</H2>
    <BusinessFlowFig t={t} />
    <H2 t={t}>Actors and systems</H2>
    <Tbl t={t} head={["Actor · system", "Role", ""]} rows={ACTORS.map(([a, b, m]) => [a, b, <Chip m={m} />])} keys={ACTORS.map(([a]) => `actor:${a}`)} />
    <H2 t={t} sub="The twelve steps the requirements document lists, and the Airflow task that performs each one.">Processing steps</H2>
    <Tbl t={t} head={["Step", "Action", "Output", "DAG task"]} rows={STEPS.map(([n, a, o, k]) => [n, a, o, <span style={{ ...mono, fontSize: 11.5 }}>{k}</span>])} keys={STEPS.map(([n]) => `step:${n}`)} />
    <H2 t={t} sub="Processing, Sent, Failed. The bounce check adds the one transition the document draws from Sent to Failed.">Status lifecycle</H2>
    <Tbl t={t} head={["From", "To", "When", "Task"]} rows={LIFECYCLE.map(([a, b, c, d]) => [a, b, c, <span style={{ ...mono, fontSize: 11.5 }}>{d}</span>])} keys={LIFECYCLE.map((_, i) => `life:${i + 1}`)} editCol={2} />
    <H2 t={t} sub="The same flow as Airflow sees it: two DAGs, every task, and the table, relay or mailbox each task reads or writes. The Design tab has the settings, the dependencies and the code.">Technical flow · the Airflow DAGs</H2>
    <TechDagFig t={t} />
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>How the two pictures line up.</b> Lane one of the business flow is the sensor. Lane two is the three eligibility pods, resolve_address and write_candidates. Lane three is open_tracking and render_and_send. Lane four is publish_run_event, notify_rm_ra and, for a bounce found later, the bounce-check DAG. Nothing in the business flow happens outside a task on one of the two DAGs.</Note>
  </>);
}
export function TestsTab({ t }) {
  return (<>
    <H2 t={t} sub="The eighteen scenarios from the requirements document, with the rule on this page that decides each. They run as unit tests on the package for the rules, on the four workbooks in the proof of concept, and against the Oracle reads in SIT before any production date.">Test scenarios</H2>
    <Tbl t={t} head={["#", "Scenario", "Expected", "Decided by"]} rows={TESTS.map(([id, sc, ex, by]) => [id, sc, ex, by])} keys={TESTS.map(([id]) => `test:${id}`)} editCol={2} />
    <Note t={t} c={MARK.PROPOSED.c}><b style={{ color: t.text }}>Three more the design adds.</b> A soft bounce that clears within the window stays Sent; a soft bounce that does not clear becomes Failed after it (G16). A non-delivery report matching no row is logged as unmatched and left in the mailbox. A run in a lower environment never reaches a real address because every recipient is rewritten.</Note>
  </>);
}

export default function PbNotifications({ t = tLight, reviewSeed = null }) {
  const [tab, setTab] = useState("overview");
  // The review layer: every tab's tables and cards read it through the
  // context; the Review tab lists it. reviewSeed lets a test or a parent
  // hand in a state instead of loading one.
  const rv = useReviewState(reviewSeed);
  const nOpen = openQuestions(rv.review).length, nEdits = Object.keys(rv.review.edits || {}).length;
  return (
    <ReviewCtx.Provider value={{ ...rv, t }}>
    <div style={{ padding: "20px 24px 60px", maxWidth: 1260 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: t.text }}>PB Notifications</div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, borderRadius: 999, padding: "2px 9px", background: "#fdf2e3", color: "#8c6a1f" }}>PBCP-5587 · DESIGN · OPEN</span>
      </div>
      <div style={{ fontSize: 13, color: t.sub, maxWidth: "80ch", lineHeight: 1.6, margin: "4px 0 14px" }}>
        The Client Portal e-mail notification utility for Statements, Trade Confirms, 1099s and K-1s, designed as the first BBH pipeline on the Integration Hub framework.
        Not an SEI interface. The requirement as the business wrote it, the four source extracts reviewed against it, the end-to-end flow, the design, the data model, the e-mail content, the test scenarios and every gap still open.
      </div>
      <div style={{ fontSize: 12, color: t.sub, margin: "-6px 0 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, borderRadius: 999, padding: "2px 9px", background: rv.live ? "#e6f4ea" : "#fdf2e3", color: rv.live ? "#159943" : "#8c6a1f" }}>{rv.live ? "REVIEW · SHARED" : rv.loaded ? "REVIEW · LOCAL ONLY" : "REVIEW · LOADING"}</span>
        <span>Open any item's pencil to propose an edit, ask a question or leave a comment.</span>
        <span style={{ color: nOpen ? "#c96a12" : t.textMuted, fontWeight: nOpen ? 700 : 400 }}>{nOpen} open question{nOpen === 1 ? "" : "s"}</span>
        <span style={{ color: t.textMuted }}>· {nEdits} edited item{nEdits === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, l], i) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ font: "inherit", fontSize: 11.5, fontWeight: 600, padding: "6px 13px", cursor: "pointer",
            border: `1px solid ${tab === k ? t.accent : t.border}`, borderRadius: i === 0 ? "4px 0 0 4px" : i === TABS.length - 1 ? "0 4px 4px 0" : 0,
            background: tab === k ? t.accent : t.panel, color: tab === k ? "#fff" : t.text }}>{l}{k === "review" && nOpen ? ` · ${nOpen}` : ""}</button>))}
      </div>
      {tab === "overview" && <OverviewTab t={t} />}
      {tab === "flow" && <WorkflowTab t={t} />}
      {tab === "req" && <RequirementsTab t={t} />}
      {tab === "design" && <DesignTab t={t} />}
      {tab === "model" && <ModelTab t={t} />}
      {tab === "sources" && <SourcesTab t={t} />}
      {tab === "content" && <ContentTab t={t} />}
      {tab === "tests" && <TestsTab t={t} />}
      {tab === "gaps" && <GapsTab t={t} />}
      {tab === "exc" && <ExceptionsTab t={t} />}
      {tab === "review" && <ReviewTab />}
    </div>
    </ReviewCtx.Provider>);
}
