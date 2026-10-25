// PB Notifications — the design page for PBCP-5587 on the Hub framework.
// Data shapes, every tab in both themes, the figures' sentences, and the
// rule that no client data, address or hostname is on the page.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import PbNotifications, { TABS, MARK, REQUIREMENTS, TYPES, GRID, TRACKING_FIELDS, STATUSES, FLOW, MODES, MODEL, ORCHESTRATION, SOURCES, CONTENT, GAPS, EXCEPTIONS,
  OverviewTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, GapsTab, ExceptionsTab } from "../src/PbNotifications.jsx";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 220)}`}`); if (!c) bad++; };
const SRC = fs.existsSync("src/PbNotifications.jsx") ? "src" : path.join("ui", "src");
const src = fs.readFileSync(path.join(SRC, "PbNotifications.jsx"), "utf8");

console.log("-- the data");
ok(TABS.length === 8 && TABS[0][0] === "overview" && Object.keys(MARK).join(",") === "REQUIRED,PROPOSED,OPEN", "eight tabs and three marks");
ok(REQUIREMENTS.length === 9 && REQUIREMENTS.every((r) => MARK[r[2]]) && REQUIREMENTS.find((r) => r[0] === "R6")[2] === "OPEN", "nine requirements, the send time open");
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
ok(GAPS.length === 14 && GAPS.filter((g) => g[1] === "critical").length === 5 && GAPS.filter((g) => g[4] === "OPEN").length === 8 && /suppression flag N/.test(GAPS[5][2]),
   "fourteen gaps: five critical, eight open to the business, the suppression-flag contradiction among them");
ok(EXCEPTIONS.length === 10 && EXCEPTIONS.some(([s, , , o]) => /Rerun/.test(s) && o === "SKIP") && EXCEPTIONS.some(([s, , , o]) => /no e-mail address/.test(s) && o === "REJECT"),
   "ten exception scenarios; a rerun sends nothing twice; a missing address is a rejection");

console.log("-- the screen");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = [OverviewTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, GapsTab, ExceptionsTab].map((C) => renderToStaticMarkup(<C t={t} />));
  ok(parts.every((p) => p.length > 1500 && !/NaN|undefined|\[object Object\]/.test(p)), `all eight tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
}
const all = [OverviewTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, GapsTab, ExceptionsTab].map((C) => renderToStaticMarkup(<C t={tLight} />)).join("\n");
ok(ORCHESTRATION.tasks.length === 10 && ORCHESTRATION.tasks[0][0] === "wait_posting_complete" && ORCHESTRATION.tasks.filter((x) => /^eligibility_/.test(x[0])).length === 3
   && ORCHESTRATION.dag.some(([k, v]) => k === "dag_id" && v === "pb_notification_daily") && ORCHESTRATION.dag.some(([k, v]) => k === "XCom" && /never a user id/.test(v))
   && /all_done/.test(ORCHESTRATION.deps) && ORCHESTRATION.rules.length === 5,
   "the DAG: ten tasks, three eligibility reads in parallel, a named dag_id, no personal data in XCom, the event published whatever happened");
ok(/DAG · pb_notification_daily/.test(all) && /pool pb_notify_relay/.test(all) && /catchup off/.test(all) && /max_active_runs/.test(all), "the DAG figure and settings are on the design tab");
ok((all.match(/role="img"/g) || []).length === 4 && /ONE DAILY DAG · EIGHT TASKS/.test(all) && /How one STATEMENT_CONFIRM record becomes an e-mail/.test(all) && /A candidate opens exactly one tracking record/.test(all),
   "four figures: the run, the DAG graph, the statements-and-confirms decision, the data model, each with a sentence");
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
