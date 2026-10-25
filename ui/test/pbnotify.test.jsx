// PB Notifications — the design page for PBCP-5587 on the Hub framework.
// Data shapes, every tab in both themes, the figures' sentences, and the
// rule that no client data, address or hostname is on the page.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import PbNotifications, { DEFAULT_DESIGN, DesignCtx, TABS, MARK, REQUIREMENTS, TYPES, GRID, TRACKING_FIELDS, STATUSES, FLOW, MODES, MODEL, ORCHESTRATION, BOUNCE, HLD_FLOWS, REPO_LAYOUT, DAG_CODE, BOUNCE_DAG_CODE, POD_HELPER, SOURCES, CONTENT, GAPS, EXCEPTIONS,
  ACTORS, BR_TRACE, SOURCE_TABLES, STEPS, LIFECYCLE, TESTS, OPEN_ITEMS,
  OverviewTab, WorkflowTab, RequirementsTab, DesignTab, ModelTab, SourcesTab, ContentTab, TestsTab, GapsTab, ExceptionsTab } from "../src/PbNotifications.jsx";
import { ReviewCtx, ReviewTab, ReviewMark, ReviewPanel, sectionOf, idOf } from "../src/PbReview.jsx";
import { applyLocal, emptyReview, textFor, notesFor, openQuestions, keyFor } from "../src/pbnotifyReviewApi.js";
import { toMarkdown, fromMarkdown, mergeDesign, applyEdits, SECTIONS, designFileName } from "../src/pbnotifyDoc.js";
import { DesignStateCtx, DocumentTab, buildMarkdown } from "../src/PbDesignDoc.jsx";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 220)}`}`); if (!c) bad++; };
const SRC = fs.existsSync("src/PbNotifications.jsx") ? "src" : path.join("ui", "src");
const src = fs.readFileSync(path.join(SRC, "PbNotifications.jsx"), "utf8");

console.log("-- the data");
ok(TABS.length === 12 && TABS[0][0] === "overview" && TABS[1][0] === "flow" && TABS[7][0] === "tests" && TABS[10][0] === "review" && TABS[11][0] === "doc" && Object.keys(MARK).join(",") === "REQUIRED,PROPOSED,OPEN", "twelve tabs: the end-to-end flow second, the test scenarios before the gaps, the review and the document last, three marks");
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

console.log("-- the review layer");
const NOW = new Date("2026-10-25T10:00:00Z");
let rv = emptyReview();
let threw = null; try { applyLocal(rv, { op: "note.add", itemKey: "gap:G7", kind: "question", body: "Which ids?" }, NOW); } catch (e) { threw = String(e.message); }
ok(/name required/.test(threw || ""), "a note with no name is refused locally, as the server refuses it", threw);
rv = applyLocal(rv, { op: "note.add", itemKey: "gap:G7", section: "gap", kind: "question", body: "Which Loan Statement ids?", actor: "Jigar T" }, NOW);
rv = applyLocal(rv, { op: "note.add", itemKey: "test:T05", section: "test", kind: "comment", body: "Add a case with two statements accounts", actor: "Olimpio D" }, NOW);
rv = applyLocal(rv, { op: "edit", itemKey: "req:R6", section: "req", body: "Send at 08:30 a.m. ET after posting.", seen: REQUIREMENTS[5][1], actor: "John G" }, NOW);
const q = rv.notes[0];
rv = applyLocal(rv, { op: "note.add", itemKey: "gap:G7", section: "gap", kind: "answer", body: "SUNGARD1 and the loan ids to come", parentId: q.id, actor: "Jay S" }, NOW);
ok(rv.notes.length === 3 && rv.notes[0].status === "answered" && rv.notes[0].statusBy === "Jay S" && rv.notes[2].parentId === q.id, "an answer moves the question to answered and hangs under it", rv.notes);
ok(openQuestions(rv).length === 0 && notesFor(rv, "gap:G7").length === 2 && textFor(rv, "req:R6", "orig").text.startsWith("Send at 08:30") && textFor(rv, "gap:G1", "orig").text === "orig",
   "open questions, the notes of one item and the edited text come from the state; an untouched item keeps the shipped text");
rv = applyLocal(rv, { op: "note.status", noteId: q.id, status: "open", actor: "Jigar T" }, NOW);
const reverted = applyLocal(rv, { op: "edit.revert", itemKey: "req:R6", seen: "Send at 08:30 a.m. ET after posting.", actor: "John G" }, NOW);
ok(openQuestions(rv).length === 1 && !reverted.edits["req:R6"] && reverted.editLog.length === 2 && rv.editLog.length === 1, "reopened; a revert restores the shipped text and keeps the history; the state is never mutated in place");
threw = null; try { applyLocal(rv, { op: "note.status", noteId: q.id, status: "done", actor: "x" }, NOW); } catch (e) { threw = String(e.message); }
ok(/status must be one of/.test(threw || "") && rv.notes[0].at === "2026-10-25 10:00", "an unknown status is refused; the stamp is the minute", threw);
ok(keyFor("G7") === "gap:G7" && keyFor("t05") === "test:T05" && keyFor("R3") === "req:R3" && keyFor("BR-02") === "br:BR-02" && keyFor("step 5") === "step:5" && keyFor("") === "general" && keyFor("the whole thing") === "general:the whole thing" && keyFor("task:render_and_send") === "task:render_and_send",
   "an item id typed on the Review tab becomes the item key");
ok(sectionOf("gap:G7") === "Gap" && idOf("gap:G7") === "G7" && sectionOf("tbl:X") === "Source table" && sectionOf("general") === "General", "keys read back as a section and an id");
const ctx = (over) => ({ review: rv, live: false, loaded: true, who: { verified: false, source: "none" }, name: "Mohammed Khan", actor: "Mohammed Khan", act: async () => true, openKey: null, setOpenKey: () => {}, error: null, setError: () => {}, t: tLight, ...over });
const reqWith = renderToStaticMarkup(<ReviewCtx.Provider value={ctx()}><RequirementsTab t={tLight} /></ReviewCtx.Provider>);
const reqWithout = renderToStaticMarkup(<RequirementsTab t={tLight} />);
ok(/Send at 08:30 a.m. ET after posting\./.test(reqWith) && />edited</.test(reqWith) && !/Send at 08:30/.test(reqWithout) && !/aria-label="review /.test(reqWithout),
   "with a review state the edited requirement replaces the shipped text and is marked; without one the tab is the plain design");
ok((reqWith.match(/aria-label="review req:R/g) || []).length === 10 && (reqWith.match(/aria-label="review br:BR-/g) || []).length === 15 && /<th[^>]*>Review<\/th>/.test(reqWith), "every requirement and every BR row carries its pencil under a Review column");
const gapsOpen = renderToStaticMarkup(<ReviewCtx.Provider value={ctx({ openKey: "gap:G7" })}><GapsTab t={tLight} /></ReviewCtx.Provider>);
ok(/aria-label="review gap:G7"[^>]*>✎ 1 open</.test(gapsOpen) && /aria-label="review of gap:G7"/.test(gapsOpen) && /Which Loan Statement ids\?/.test(gapsOpen) && /SUNGARD1 and the loan ids to come/.test(gapsOpen) && /Propose an edit/.test(gapsOpen) && /Ask a question/.test(gapsOpen) && /self-declared/.test(gapsOpen),
   "the open panel under G7: its open question, the answer under it, the edit and ask controls, and the self-declared notice");
const testsTab = renderToStaticMarkup(<ReviewCtx.Provider value={ctx()}><TestsTab t={tLight} /></ReviewCtx.Provider>);
ok(/aria-label="review test:T05"[^>]*>✎ 1</.test(testsTab) && (testsTab.match(/aria-label="review test:T/g) || []).length === 18, "a comment shows as a count on T05; all eighteen scenarios carry a pencil");
const cards = [ModelTab, SourcesTab, ContentTab].map((C) => renderToStaticMarkup(<ReviewCtx.Provider value={ctx()}><C t={tLight} /></ReviewCtx.Provider>)).join("");
ok((cards.match(/aria-label="review model:PB_NOTIFICATION_/g) || []).length === 3 && (cards.match(/aria-label="review src:/g) || []).length === 4 && (cards.match(/aria-label="review tpl:/g) || []).length === 5 && (cards.match(/aria-label="review tbl:/g) || []).length === 9,
   "the three tables, the four extracts, the five templates and the nine source tables carry pencils on their cards and rows");
const reviewTab = renderToStaticMarkup(<ReviewCtx.Provider value={ctx()}><ReviewTab /></ReviewCtx.Provider>);
ok(/open questions/.test(reviewTab) && /Which Loan Statement ids\?/.test(reviewTab) && /Local only/.test(reviewTab) && /Edited items/.test(reviewTab) && /Send at 08:30/.test(reviewTab) && /line-through/.test(reviewTab) && /Mohammed Khan/.test(reviewTab),
   "the Review tab: the counts, the open question, local-only said out loud, the edited item with the shipped text struck through, the reviewer's name");
const shellRv = renderToStaticMarkup(<PbNotifications t={tLight} reviewSeed={{ review: rv, live: true, who: { verified: true, lanId: "lan.user", source: "proxy" }, name: "" }} />);
ok(/REVIEW · SHARED/.test(shellRv) && /1 open question</.test(shellRv) && /1 edited item</.test(shellRv) && /Review · 1</.test(shellRv) && /aria-label="review hld:1"/.test(shellRv), "the shell: shared, the open-question and edit counts in the header and on the tab, pencils on the overview's flows");
ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(reviewTab + gapsOpen) && !/<[a-z]/.test(rv.notes.map((n) => n.body).join("")), "nothing in the review markup is an address, and bodies render as text");

console.log("-- the design document");
ok(Object.keys(DEFAULT_DESIGN).length === 31 && DEFAULT_DESIGN.requirements === REQUIREMENTS && DEFAULT_DESIGN.gaps === GAPS && DEFAULT_DESIGN.hldFlows === HLD_FLOWS && DEFAULT_DESIGN.model === MODEL, "the shipped design is the constants, as one object");
const md = toMarkdown(DEFAULT_DESIGN, { exportedAt: "2026-10-25 10:00", version: 0 });
ok(md.startsWith("# PB Notifications · design document") && (md.match(/<!-- pbn: [A-Za-z.]+ -->/g) || []).length === SECTIONS.length && SECTIONS.length === 41 && /## 13\. Open gaps/.test(md) && /```python\n# dags\/pb_notification_daily\.py/.test(md) && /\| G17 \| rule \| The type grid includes Loan Statements/.test(md),
   "the export: a title, one marker per section (41), the headings, the DAG code fenced, the gaps as a table");
ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(md) && !/testbbh|\.bbh\.com|https?:\/\//.test(md) && !/\b\d{7,}\b/.test(md.replace(/1-800-285-5093/g, "")), "no e-mail address, hostname, URL or long identifier in the document");
const rt = fromMarkdown(md, { ...DEFAULT_DESIGN, requirements: [], gaps: [], dagCode: "", model: { ...MODEL, tracking: { ...MODEL.tracking, cols: [] } } });
ok(rt.errors.length === 0 && rt.found === 41 && JSON.stringify(rt.design) === JSON.stringify(DEFAULT_DESIGN), "the round trip is exact: every section, code block and model table reads back to the shipped design", rt.errors);
ok(rt.report.filter((r) => r.status === "updated").length === 4 && rt.report.filter((r) => r.status === "unchanged").length === 37, "the report says which sections differ from the base", rt.report.filter((r) => r.status === "updated").map((r) => r.key));
const edited = md.replace("| G17 | rule | The type grid includes Loan Statements, but the statements SQL takes RPT_ID SUNGARD1 only. |", "| G17 | rule | Loan Statements post with their own report ids, to be confirmed by PB Systems. |")
  .replace("| T18 | The user has no warehouse e-mail | exception logged; nothing sent |", "| T18 | The user has no warehouse e-mail | exception logged; nothing sent; counted on the run |\n| T19 | Two statements accounts, both permitted | one statements-only e-mail |");
const r2 = fromMarkdown(edited, DEFAULT_DESIGN);
ok(r2.errors.length === 0 && r2.design.gaps[16][2].startsWith("Loan Statements post with their own") && r2.design.tests.length === 19 && r2.design.tests[18][0] === "T19"
   && r2.report.filter((r) => r.status === "updated").map((r) => r.key).join(",") === "tests,gaps" && r2.report.find((r) => r.key === "tests").after === 19,
   "an edited cell and an added row come through, and only those sections are reported as updated");
const noMarkers = md.replace(/<!-- pbn: [A-Za-z.]+ -->\n/g, "");
const r3 = fromMarkdown(noMarkers, { ...DEFAULT_DESIGN, gaps: [] });
ok(r3.errors.length === 0 && JSON.stringify(r3.design) === JSON.stringify(DEFAULT_DESIGN) && r3.report.every((r) => /heading/.test(r.message)), "with every marker lost the sections are found by their headings", r3.errors);
const reordered = md.replace("| # | Class | Finding | Proposed resolution | Mark |", "| Mark | # | Finding | Class | Proposed resolution |").replace(/\| (G\d+) \| (critical|rule|data) \| ([^|]+) \| ([^|]+) \| (REQUIRED|PROPOSED|OPEN) \|/g, "| $5 | $1 | $3 | $2 | $4 |");
const r4 = fromMarkdown(reordered, { ...DEFAULT_DESIGN, gaps: [] });
ok(r4.errors.length === 0 && JSON.stringify(r4.design.gaps) === JSON.stringify(GAPS), "columns are matched by name, so a reordered table reads the same", r4.errors);
const r5 = fromMarkdown(md.replace("| # | Requirement | Mark |", "| # | Requirement |"), DEFAULT_DESIGN);
ok(r5.errors.length === 1 && /Requirements: missing column\(s\): Mark/.test(r5.errors[0]) && r5.design === DEFAULT_DESIGN, "a missing column is an error naming the section and the column, and nothing is applied", r5.errors);
const r6 = fromMarkdown(md.replace("| G6 | rule |", "| G6 | rule |").replace(/\| R3 \| ([^|]+) \| REQUIRED \|/, "| R3 | $1 | MAYBE |"), DEFAULT_DESIGN);
ok(r6.errors.length === 1 && /Requirements: row 3: mark "MAYBE"/.test(r6.errors[0]), "a mark outside REQUIRED, PROPOSED, OPEN is refused with the row named", r6.errors);
const r7 = fromMarkdown("# nothing here\n\nsome text", DEFAULT_DESIGN);
ok(r7.errors.length === 1 && /no PB Notifications sections found/.test(r7.errors[0]), "a file that is not the design is refused plainly");
const partial = md.split("\n## 12. Test scenarios")[0];
const r8 = fromMarkdown(partial, DEFAULT_DESIGN);
ok(r8.errors.length === 0 && r8.report.filter((r) => r.status === "missing").map((r) => r.key).join(",") === "tests,gaps,openItems,exceptions" && r8.design.tests.length === 18, "sections left out of the file keep the current text and are reported as missing");
const merged = mergeDesign(DEFAULT_DESIGN, { requirements: [["R1", "x", "OPEN"]], orchestration: { deps: "a >> b" } });
ok(merged.requirements.length === 1 && merged.orchestration.deps === "a >> b" && merged.orchestration.tasks.length === 10 && merged.orchestration.bounce.tasks.length === 5 && merged.gaps.length === 20, "a stored design is laid over the shipped one, nested sections included");
const folded = applyEdits(DEFAULT_DESIGN, rv);
ok(folded.requirements[5][1] === "Send at 08:30 a.m. ET after posting." && DEFAULT_DESIGN.requirements[5][1] !== folded.requirements[5][1] && folded.gaps === undefined === false, "a reviewer's edit is folded into the exported design without touching the shipped one");
const withReview = toMarkdown(folded, { review: rv, exportedAt: "2026-10-25 10:00" });
ok(/## 15\. Review notes/.test(withReview) && /Which Loan Statement ids\?/.test(withReview) && /\| R6 \| Send at 08:30 a.m. ET after posting\. \| OPEN \|/.test(withReview) && fromMarkdown(withReview, DEFAULT_DESIGN).errors.length === 0, "the download carries the edits in place and the review notes as a last section that reads back cleanly");
const ingested = { ...r2.design };
const shellDs = renderToStaticMarkup(<PbNotifications t={tLight} designSeed={{ doc: { version: 3, design: ingested, author: "Jigar T", idSource: "none", at: "2026-10-25 11:00", fileName: "pb-notifications-design-v2.md", shipped: false }, live: true, history: [] }} />);
ok(/design v3 · ingested by Jigar T on 2026-10-25 11:00/.test(shellDs) && /Download \.md/.test(shellDs), "the shell says which version it renders and offers the download");
const gapsDs = renderToStaticMarkup(<DesignCtx.Provider value={ingested}><GapsTab t={tLight} /></DesignCtx.Provider>);
const testsDs = renderToStaticMarkup(<DesignCtx.Provider value={ingested}><TestsTab t={tLight} /></DesignCtx.Provider>);
ok(/Loan Statements post with their own report ids/.test(gapsDs) && !/Loan Statements post/.test(renderToStaticMarkup(<GapsTab t={tLight} />)) && /T19/.test(testsDs) && (testsDs.match(/<tr>/g) || []).length === 20,
   "the tabs render from the ingested design: the edited gap and the added test scenario appear; without it the shipped text stands");
const dsCtx = { base: DEFAULT_DESIGN, design: ingested, doc: { version: 3, author: "Jigar T", idSource: "none", at: "2026-10-25 11:00", fileName: "x.md", shipped: false }, live: true, loaded: true, history: [{ id: "d1", version: 3, author: "Jigar T", idSource: "none", at: "2026-10-25 11:00", fileName: "x.md", note: "loan ids", bytes: 56000 }], refreshHistory: async () => [], check: (m) => fromMarkdown(m, ingested), apply: async () => true, reset: async () => true, error: null, setError: () => {} };
const docTab = renderToStaticMarkup(<ReviewCtx.Provider value={ctx()}><DesignStateCtx.Provider value={dsCtx}><DocumentTab /></DesignStateCtx.Provider></ReviewCtx.Provider>);
ok(/Design version 3/.test(docTab) && /ingested by Jigar T \(self-declared\)/.test(docTab) && /Ingest an edited document/.test(docTab) && /Apply as version 4/.test(docTab) && /loan ids/.test(docTab) && /55 KB/.test(docTab) && /Restore the shipped design/.test(docTab) && /41 sections/.test(docTab),
   "the Document tab: the current version, the ingest form, the next version number, the history and the restore");
ok(designFileName(3) === "pb-notifications-design-v3.md" && buildMarkdown(dsCtx, ctx()).includes("from design version 3"), "the file name and the header carry the version");

console.log("-- wiring");
const APP = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), NAV = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8");
const SEC = fs.readFileSync(path.join(SRC, "..", "..", "sql", "64_security.sql"), "utf8");
ok(/import PbNotifications from "\.\/PbNotifications\.jsx"/.test(APP) && /pbnotify: <PbNotifications t=\{t\} \/>/.test(APP), "App.jsx routes it");
const groupOf = (key) => { const i = NAV.indexOf(`['${key}'`); const m = [...NAV.slice(0, i).matchAll(/group: '([^']+)'/g)]; return m.length ? m[m.length - 1][1] : null; };
ok(groupOf("pbnotify") === "Architecture", "it sits under Architecture with System Design and DevOps 360", groupOf("pbnotify"));
ok(/'pbnotify','PB Notifications','Architecture'/.test(SEC), "the security module is seeded under Architecture");
const MAIN = fs.readFileSync(path.join(SRC, "..", "..", "api", "app", "main.py"), "utf8");
ok(/"routers_pbnotify_review"/.test(MAIN) && fs.existsSync(path.join(SRC, "..", "..", "sql", "84_pbnotify_review.sql")) && fs.existsSync(path.join(SRC, "..", "..", "sql", "85_pbnotify_design_doc.sql")), "the review router is mounted and its tables have SQL files");
const RAPI = fs.readFileSync(path.join(SRC, "pbnotifyReviewApi.js"), "utf8");
ok(/\/pbnotify\/review/.test(RAPI) && !/from ["']\.\/api\.js["']/.test(RAPI) && !/api\.js/.test(fs.readFileSync(path.join(SRC, "PbReview.jsx"), "utf8")), "the review client is self-contained: api.js untouched");

console.log(bad ? `\n${bad} assertion(s) failed` : "\npbnotify assertions pass");
if (bad) process.exit(1);
