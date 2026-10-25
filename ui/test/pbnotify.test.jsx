// PB Notifications — the design page for PBCP-5587 on the Hub framework.
// Data shapes, every tab in both themes, the figures' sentences, and the
// rule that no client data, address or hostname is on the page.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import PbNotifications, { TABS, MARK, REQUIREMENTS, TYPES, GRID, TRACKING_FIELDS, STATUSES, FLOW, MODES, MODEL, ORCHESTRATION, BOUNCE, HLD_FLOWS, REPO_LAYOUT, DAG_CODE, BOUNCE_DAG_CODE, POD_HELPER, SOURCES, CONTENT, GAPS, EXCEPTIONS,
  ACTORS, BR_TRACE, SOURCE_TABLES, STEPS, LIFECYCLE, TESTS, OPEN_ITEMS,
  OverviewTab, WorkflowTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, TestsTab, GapsTab, ExceptionsTab } from "../src/PbNotifications.jsx";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 220)}`}`); if (!c) bad++; };
const SRC = fs.existsSync("src/PbNotifications.jsx") ? "src" : path.join("ui", "src");
const src = fs.readFileSync(path.join(SRC, "PbNotifications.jsx"), "utf8");

console.log("-- the data");
ok(TABS.length === 10 && TABS[0][0] === "overview" && TABS[1][0] === "flow" && TABS[7][0] === "tests" && Object.keys(MARK).join(",") === "REQUIRED,PROPOSED,OPEN", "ten tabs, the end-to-end flow second and the test scenarios before the gaps, three marks");
ok(REQUIREMENTS.length === 10 && REQUIREMENTS.every((r) => MARK[r[2]]) && REQUIREMENTS.find((r) => r[0] === "R6")[2] === "OPEN" && /Microsoft 365/.test(REQUIREMENTS[9][1]), "ten requirements, the send time open, bounce detection through the mail broker last");
ok(TYPES.map((x) => x.key).join(",") === "STATEMENT_CONFIRM,1099,K1" && TYPES.filter((x) => x.always).length === 2 && /ESTIMATE_IND = N/.test(TYPES[1].posted) && /prior calendar year/.test(TYPES[2].posted),
   "three notification types; the tax types always send, final documents only, K-1 prior year");
ok(GRID.length === 5 && GRID.every((r) => r.length === 5) && TRACKING_FIELDS.length === 8 && STATUSES.map(([s]) => s).join(",") === "Processing,Sent,Failed",
   "the five-row type grid, the eight tracking fields, the three statuses");
ok(FLOW.length === 8 && /posting complete/i.test(FLOW[0][0]) && /unique key/.test(FLOW[4][1]) && /RM and RA/.test(FLOW[7][1]), "eight tasks: wait for posting, the duplicate guard, the RM and RA exposure");
ok(MODES.length >= 5 && /Excel/.test(MODES[0][1]) && /Oracle/.test(MODES[0][2]) && MODES.some(([a]) => /Candidate and tracking/.test(a)), "the proof of concept reads Excel, the built utility reads Oracle, the tables are the same");
ok(Object.keys(MODEL).join(",") === "candidate,detail,tracking" && /UNIQUE \(USER_ID, NOTIFICATION_TYPE, PROCESS_DATE\)/.test(MODEL.tracking.keys) && /PRIMARY KEY \(PROCESS_DATE, USER_ID, RPT_ID\)/.test(MODEL.detail.keys),
   "three tables; the daily unique key on the tracking table; the K-1 detail key");
ok(SOURCES.length === 4 && SOURCES.map((s) => s.rows).join(",") === "1226,3372,6205,8555" && SOURCES.slice(0, 3).reduce((a, s) => a + s.unmatched, 0) === 89,
   "the four extracts with their row counts and 89 unmatched ids in total");
ok(CONTENT.length === 5 && CONTENT.map((c) => c.key).join(",") === "STATEMENT,CONFIRM,BOTH,1099,K1" && CONTENT.every((c) => /BBH Client Portal/.test(c.body) && /\[link to/.test(c.body)),
   "five e-mails, each with a bracketed link placeholder");
ok(GAPS.length === 20 && GAPS.filter((g) => g[1] === "critical").length === 5 && GAPS.filter((g) => g[4] === "OPEN").length === 14 && /suppression flag N/.test(GAPS[5][2])
   && /Loan Statements/.test(GAPS[16][2]) && /ATTEMPT_COUNT/.test(GAPS[17][3]) && /deep links/.test(GAPS[18][2]) && /PBCPAPP schema/.test(GAPS[19][2]),
   "twenty gaps: five critical, fourteen open; the Loan Statement ids, the retry limit, the deep links and the owner of the tables from the end-to-end document");
ok(EXCEPTIONS.length === 14 && EXCEPTIONS.some(([s, , , o]) => /deleted between/.test(s) && o === "REJECT") && EXCEPTIONS.some(([s, , c, o]) => /gateway unavailable/.test(s) && /stay Processing/.test(c) && o === "RETRY")
   && EXCEPTIONS.some(([s, , , o]) => /Hard bounce/.test(s) && o === "FLAG") && EXCEPTIONS.some(([s, , , o]) => /Soft bounce/.test(s) && o === "RETRY") && EXCEPTIONS.some(([s, , , o]) => /Rerun/.test(s) && o === "SKIP") && EXCEPTIONS.some(([s, , , o]) => /no e-mail address/.test(s) && o === "REJECT"),
   "fourteen exception scenarios: a user deleted before the send, the gateway unavailable, hard and soft bounces; a rerun sends nothing twice; a missing address is a rejection");
ok(ACTORS.length === 8 && ACTORS.every((a) => MARK[a[2]]) && ACTORS.some(([a, b]) => /PBDWAPP/.test(a) && /DIM_INTERESTED_PARTY/.test(b)) && ACTORS.some(([a]) => /RM and RA/.test(a)),
   "eight actors and systems, the warehouse address tables and the relationship team among them");
ok(BR_TRACE.length === 15 && BR_TRACE[0][0] === "BR-01" && BR_TRACE[14][0] === "BR-15" && BR_TRACE.every((r) => r[2].length > 8) && /G17/.test(BR_TRACE[8][2]) && /unique key/.test(BR_TRACE[6][2]),
   "BR-01 to BR-15 each traced to a place on the page; the Loan Statement gap on BR-09, the unique key on BR-07");
ok(SOURCE_TABLES.length === 9 && SOURCE_TABLES.filter((r) => r[1] === "PBCPAPP").length === 7 && SOURCE_TABLES.filter((r) => r[1] === "PBDWAPP").length === 2
   && SOURCE_TABLES.some(([n, , , k]) => n === "DIM_INTERESTED_PARTY" && /E_MAIL_ADDRESS/.test(k) && /END_DATE/.test(k)),
   "nine source tables: seven in the Portal schema, two in the warehouse for the e-mail of record");
ok(STEPS.length === 12 && STEPS[0][3] === "wait_posting_complete" && /eligibility_stmt_confirm/.test(STEPS[1][3]) && /unique-key violation/.test(STEPS[4][1]) && /publish_run_event/.test(STEPS[11][3])
   && STEPS.every(([, , , k]) => ORCHESTRATION.tasks.some(([n]) => k.includes(n)) || ORCHESTRATION.bounce.tasks.some(([n]) => k.includes(n))),
   "the twelve processing steps, each tied to a task that exists on one of the two DAGs");
ok(LIFECYCLE.length === 6 && LIFECYCLE.some(([a, b, , d]) => a === "Sent" && b === "Failed" && d === "match_to_tracking") && LIFECYCLE.some(([a, b]) => a === "Processing" && b === "Processing"),
   "the status lifecycle: Sent to Failed on a bounce, and a gateway outage leaves Processing");
ok(TESTS.length === 18 && TESTS[0][0] === "T01" && TESTS[17][0] === "T18" && TESTS.every((r) => r.length === 4) && /no RM or RA/.test(TESTS[16][2]) && /unique key/.test(TESTS[14][3]),
   "eighteen test scenarios T01 to T18 with the rule that decides each; a statement bounce is not escalated; two runs send once");
ok(OPEN_ITEMS.length === 13 && /G17/.test(OPEN_ITEMS[6][2]) && /G18/.test(OPEN_ITEMS[10][2]) && /G19/.test(OPEN_ITEMS[12][2]) && /designed/.test(OPEN_ITEMS[8][2]) && /designed/.test(OPEN_ITEMS[9][2]),
   "the document's thirteen open items each land on a gap or on a part of the design that answers it");

console.log("-- the screen");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = [OverviewTab, WorkflowTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, TestsTab, GapsTab, ExceptionsTab].map((C) => renderToStaticMarkup(<C t={t} />));
  ok(parts.every((p) => p.length > 1500 && !/NaN|undefined|\[object Object\]/.test(p)), `all ten tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
}
const all = [OverviewTab, WorkflowTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, TestsTab, GapsTab, ExceptionsTab].map((C) => renderToStaticMarkup(<C t={tLight} />)).join("\n");
ok(ORCHESTRATION.tasks.length === 10 && ORCHESTRATION.tasks[0][0] === "wait_posting_complete" && ORCHESTRATION.tasks.filter((x) => /^eligibility_/.test(x[0])).length === 3
   && ORCHESTRATION.dag.some(([k, v]) => k === "dag_id" && v === "pb_notification_daily") && ORCHESTRATION.dag.some(([k, v]) => k === "XCom" && /never a user id/.test(v))
   && /all_done/.test(ORCHESTRATION.deps) && ORCHESTRATION.rules.length === 5,
   "the DAG: ten tasks, three eligibility reads in parallel, a named dag_id, no personal data in XCom, the event published whatever happened");
ok(/DAG · pb_notification_daily/.test(all) && /pool pb_notify_relay/.test(all) && /catchup off/.test(all) && /max_active_runs/.test(all), "the DAG figure and settings are on the design tab");
ok(BOUNCE.how.length === 6 && BOUNCE.alerts.length === 3 && BOUNCE.columns.map(([c]) => c).join(",") === "MESSAGE_ID,BOUNCE_TS,BOUNCE_CLASS,BOUNCE_REASON,ALERTED_TS"
   && ORCHESTRATION.bounce.tasks.length === 5 && ORCHESTRATION.bounce.tasks[0][0] === "read_ndr_mailbox" && ORCHESTRATION.bounce.tasks.some(([n]) => n === "alert_system_dev")
   && BOUNCE.how.some(([a, b]) => /Correlation/.test(a) && /X-PB-Notification-Id/.test(b)) && BOUNCE.alerts[0][2].includes("no client address"),
   "bounce detection: correlation by header and Message-Id, five tasks reading the Microsoft 365 mailbox through Graph, the alert to system development without client data");
ok(REPO_LAYOUT.length === 12 && /dag_id="pb_notification_daily"/.test(DAG_CODE) && /catchup=False/.test(DAG_CODE) && /max_active_runs=1/.test(DAG_CODE) && /pool="pb_notify_relay"/.test(DAG_CODE)
   && /TriggerRule.ALL_DONE/.test(DAG_CODE) && /mode="reschedule"/.test(DAG_CODE) && /for k in \("stmt_confirm", "1099", "k1"\)/.test(DAG_CODE)
   && /dag_id="pb_notification_bounce_check"/.test(BOUNCE_DAG_CODE) && /read_ndr_mailbox >> match_to_tracking/.test(BOUNCE_DAG_CODE) && /secret_env/.test(POD_HELPER),
   "the implementation: the repository layout and two DAG skeletons with the sensor, the three eligibility pods, the relay pool, all_done on the event, and secrets from the namespace");
ok(!/@|https?:|password|passwd|\.com/i.test(DAG_CODE + BOUNCE_DAG_CODE + POD_HELPER), "no address, host or credential in the code skeletons");
ok(/Implementation/.test(all) && /dags\/pb_notification_daily\.py/.test(all) && /Why the DAG files are this short/.test(all), "the implementation section is on the design tab");
ok(/BOUNCE DETECTION · THE RELAY ACCEPTING A MESSAGE IS NOT DELIVERY/.test(all) && /pb_notification_bounce_check/.test(all) && /HARD or SOFT/.test(all), "the bounce figure and DAG are on the design tab");
ok(HLD_FLOWS.length === 8 && /HIGH-LEVEL DESIGN · PB NOTIFICATIONS ON THE INTEGRATION HUB/.test(all) && /High-level design of the PB notification utility/.test(all)
   && /INTEGRATION HUB · ONE NAMESPACE PER ENVIRONMENT/.test(all) && /Sending mailbox · Microsoft 365/.test(all) && /System development team/.test(all),
   "the high-level design opens the overview: Portal schema, the Hub, the mail path and the people, with eight numbered flows");
ok((all.match(/role="img"/g) || []).length === 8 && /ONE DAILY DAG · EIGHT TASKS/.test(all) && /How one STATEMENT_CONFIRM record becomes an e-mail/.test(all) && /A candidate opens exactly one tracking record/.test(all),
   "eight figures: the high-level design, the business flow, the technical flow, the run, the DAG graph, the bounce path, the statements-and-confirms decision, the data model, each with a sentence");
const flowTab = renderToStaticMarkup(<WorkflowTab t={tLight} />);
ok(/END-TO-END BUSINESS FLOW/.test(flowTab) && /The end-to-end business flow on four lanes/.test(flowTab) && /TRACK AND SEND/.test(flowTab) && /Tracking row exists/.test(flowTab) && /RM and RA told/.test(flowTab),
   "the business flow figure: four lanes, the duplicate decision, the delivered decision and the RM and RA outcome");
ok(/TECHNICAL FLOW · TWO AIRFLOW DAGS/.test(flowTab) && /DASHED = READ/.test(flowTab) && /DAG pb_notification_daily/.test(flowTab) && /DAG pb_notification_bounce_check/.test(flowTab)
   && /Hub schema · PB_NOTIFICATION_\*/.test(flowTab) && /Warehouse · PBDWAPP/.test(flowTab) && /Sending mailbox · M365/.test(flowTab) && (flowTab.match(/stroke-dasharray="4 3"/g) || []).length === 3,
   "the technical flow figure: both DAGs, the five stores between them, reads dashed and writes solid");
ok(/Traceability to BR-01 to BR-15/.test(all) && /Source data model/.test(all) && /Where the tables live \(G20\)/.test(all) && /The document(&#x27;|')s open items/.test(all) && /Processing steps/.test(all) && /Status lifecycle/.test(all) && /Test scenarios/.test(all),
   "the document's sections are on the page: the BR trace, the source model and the table owner, the open items, the steps, the lifecycle and the tests");
ok(/Proof of concept now, Oracle when built/.test(all) && /TPW049|TWM049/.test(all) && /PB_NOTIFICATION_TRACKING/.test(all) && /EMAIL_ADDRESS_NOT_FOUND/.test(all) && /1-800-285-5093/.test(all),
   "the two modes, the suppression table, the tracking table, the exception reason and the support line from the requirement");
ok(/OPEN G6/.test(all) && /N as permitted/.test(all), "the decision figure carries the open suppression-flag question");
const shell = renderToStaticMarkup(<PbNotifications t={tLight} />);
ok(/PB Notifications/.test(shell) && /PBCP-5587/.test(shell) && /Not an SEI interface/.test(shell) && /aria-pressed="true"/.test(shell), "the shell: title, ticket, the not-SEI line, a pressed tab");
ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(all) && !/testbbh|\.bbh\.com|https?:\/\//.test(src) && !/\b\d{7,}\b/.test(all.replace(/1-800-285-5093/g, "")),
   "no e-mail address, hostname, URL or long identifier on the page — the QA address and every user id stay out");

console.log("-- wiring");
const APP = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), NAV = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8");
const SEC = fs.readFileSync(path.join(SRC, "..", "..", "sql", "64_security.sql"), "utf8");
ok(/import PbNotifications from "\.\/PbNotifications\.jsx"/.test(APP) && /pbnotify: <PbNotifications t=\{t\} \/>/.test(APP), "App.jsx routes it");
const groupOf = (key) => { const i = NAV.indexOf(`['${key}'`); const m = [...NAV.slice(0, i).matchAll(/group: '([^']+)'/g)]; return m.length ? m[m.length - 1][1] : null; };
ok(groupOf("pbnotify") === "Architecture", "it sits under Architecture with System Design and DevOps 360", groupOf("pbnotify"));
ok(/'pbnotify','PB Notifications','Architecture'/.test(SEC), "the security module is seeded under Architecture");

console.log(bad ? `\n${bad} assertion(s) failed` : "\npbnotify assertions pass");
if (bad) process.exit(1);
