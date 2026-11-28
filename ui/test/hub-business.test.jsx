// CP Integration Hub, business view: two tabs. "What it is" says the purpose,
// what it does and the problem it solves in diagrams and nothing else; "Error
// handling" plays each error scenario as an animated walk. Integration 360 -
// Run carries the pipeline list and, for an open pipeline, what went wrong,
// where and why. Nothing on either is a host, a schema owner, a link or a
// credential.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import HubBusiness, { HubViewToggle, PipelineCatalog } from "../src/HubBusiness.jsx";
import HubDesign from "../src/HubDesign.jsx";
import HubErrorPlay from "../src/HubErrorPlay.jsx";
import HubSlides, { SLIDES, CHAPTERS, PLAIN, DOORS, BENEFITS, WITHOUT_HUB, WITH_HUB, STORY } from "../src/HubSlides.jsx";
import { PLAYS, MOOD } from "../src/hubErrorPlays.js";
import { ROLE, USES, GOVERNS, SOLVES, WITHOUT, I360, PIPELINE, STEP_DETAIL, DAG_DETAIL, POSITIONS_LINEAGE, SCENARIOS, businessMarkdown } from "../src/hubBusiness.js";
import * as P from "../src/hubPipelines.js";
import HubWires, { wireLayout, tracePath, hopsFor, wiresCsv } from "../src/HubWires.jsx";
import { mergeLive, caseFromFinding } from "../src/integration360Api.js";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const SRC = fs.existsSync("src/HubBusiness.jsx") ? "src" : path.join("ui", "src");
const tLight = { accent: "#0f4775", navy: "#0f4775", text: "#1a1a1a", sub: "#4a5560", textMuted: "#7a8690", border: "#d9dee3", panel: "#ffffff", bg: "#f4f6f8", radius: { md: 6 } };
const tDark = { ...tLight, text: "#eef2f5", sub: "#b7c0c8", textMuted: "#8793a0", border: "#2b3640", panel: "#1b232b", bg: "#121820" };

console.log("-- the content");
ok(ROLE.sources.length === 4 && ROLE.lanes.length === 4 && ROLE.consumers.length === 5 && ROLE.verbs.length === 5, "four sources, four lanes, five consumers, five verbs");
ok(ROLE.lanes.map((l) => l[0]).join() === "Events,Files,Loaders,APIs", "the lanes are the hub's four channels");
ok(USES.length === 6 && ["Data movement", "Real-time", "Event-based", "Sensors and scheduling", "Data transformation", "Many consumers"].every((u) => USES.some((x) => x[1] === u)), "six uses");
ok(GOVERNS.length === 4 && SOLVES.length === 4 && SOLVES.every((s) => s.length === 2) && WITHOUT.sources.length === 4 && WITHOUT.destinations.length === 4, "four governed things; four problems with how the hub solves them; the without-a-hub picture has four and four");
ok(/Integration 360 - Run/.test(I360.line) && I360.rows.length === 4, "Integration 360 - Run named as the replacement for Quality Guardrails");
ok(PIPELINE.flow.length === 7 && PIPELINE.dag.length === 8 && STEP_DETAIL.length === 7 && DAG_DETAIL.length === 8 && STEP_DETAIL.map((s) => s.step).join() === PIPELINE.flow.map((f) => f[0]).join(), "the positions pipeline's own flow, DAG and step detail still line up (they feed the catalogue)");
const lid = new Set(POSITIONS_LINEAGE.nodes.map((n) => n.id));
ok(POSITIONS_LINEAGE.edges.every((e) => lid.has(e.from) && lid.has(e.to)) && SCENARIOS.length === 7, "the positions column graph is closed; the seven Guardrails cases exist");

console.log("-- the error plays");
const playProblems = [];
for (const p of PLAYS) {
  const branches = Object.keys(p.branch);
  p.frames.forEach((f, i) => {
    if (typeof f.at === "number" ? (f.at < 0 || f.at >= p.nodes.length) : !branches.includes(String(f.at).split(":")[1])) playProblems.push(`${p.id} frame ${i} at`);
    if (!MOOD[f.mood] || !p.states.includes(f.state) || !f.say) playProblems.push(`${p.id} frame ${i} mood/state/say`);
  });
  const bad = p.frames.findIndex((f) => f.mood === "fail" || f.mood === "wait" || f.mood === "fix"), fixed = p.frames.findIndex((f, i) => i > bad && (f.mood === "fix" || f.mood === "ok"));
  if (bad < 0 || fixed < 0) playProblems.push(`${p.id} never goes wrong or never recovers`);
  if (p.frames.length < 3 || !p.summary || !p.title) playProblems.push(`${p.id} thin`);
}
ok(PLAYS.length === 8 && playProblems.length === 0, "eight plays: every frame lands on a real box or branch with a known mood and state, and each goes wrong then recovers", playProblems.join());
ok(new Set(PLAYS.map((p) => p.channel)).size === 3 && PLAYS.some((p) => p.id === "silent-loader") && PLAYS.some((p) => p.id === "event-gap"), "files, events and the outbound loader each have a play");
ok(!/testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|\.internal|[\w.+-]+@[\w-]+\.[\w.-]+/.test(JSON.stringify(PLAYS)), "no host, schema owner, link or address in the plays");

console.log("-- the business view: a presentation");
ok(SLIDES.length === 8 && SLIDES.map((x) => x.key).join() === "without,plain,doors,with,does,governs,benefits,story" && STORY.beats.length === 6 && DOORS.length === 4 && DOORS.every((d) => d.length === 6), "eight slides: without a hub, what it is in plain words, the four doors, the hub, what it does, what it governs, what you get, and the tower story as an appendix");
ok(CHAPTERS.map((c) => c[0]).join() === "problem,what,how,benefits,appendix" && SLIDES.map((x) => x.chapter).join() === "problem,what,what,how,how,how,benefits,appendix", "chapters: the problem, what it is, the hub, what you get, then the appendix");
ok(PLAIN.jobs.length === 4 && PLAIN.doors.length === 4 && /post office/.test(PLAIN.analogy) && /single, supervised doorway/.test(PLAIN.close) && BENEFITS.length === 4 && BENEFITS.every((b) => b.length === 3), "the plain-words slide has four jobs and four doors; the benefits slide has four today/with-the-hub pairs");
ok(WITHOUT_HUB.jobs.length === 8 && ["RMJ schedule", "cron job", "shell script", "scheduler task", "interface app"].every((j) => WITHOUT_HUB.jobs.some((x) => x[0] === j)) && WITHOUT_HUB.callouts.length === 4, "the world without a hub names the RMJ schedules, cron jobs, scripts, schedulers and interface applications");
ok(WITH_HUB.channels.length === 4 && WITH_HUB.inside.some((x) => /Error handling/.test(x[0])) && WITH_HUB.inside.some((x) => /Translation and contracts/.test(x[0])) && WITH_HUB.callouts.some((x) => /Plug and play/.test(x[0])) && WITH_HUB.callouts.some((x) => /One place to change/.test(x[0])) && WITH_HUB.callouts.some((x) => /Many to many/.test(x[0])) && WITH_HUB.inside.some((x) => /Security, entitlements and control/.test(x[0]) && /audit trail/.test(x[1]) && /vault/.test(x[1])) && WITH_HUB.governedBy.length === 5 && WITH_HUB.callouts.some((x) => /Secured and controlled/.test(x[0]) && /Security Entitlement/.test(x[1]) && /Code Review 360/.test(x[1]) && /PII Explorer/.test(x[1])), "the hub slide carries the four channels, error handling, translation and contracts, the record, security and control, plug and play, one place to change, many to many, secured and controlled");
for (const [name, t] of [["light", tLight], ["dark", tDark]]) {
  const html = renderToStaticMarkup(<HubBusiness t={t} />);
  ok(/business view/.test(html) && /data-slide="without"/.test(html) && /Without a hub/.test(html) && /RMJ schedule/.test(html) && /cron job/.test(html) && /Every pair is its own job/.test(html), `${name}: opens on the problem: without a hub, the jobs drawn and the callouts`);
  ok((html.match(/<svg /g) || []).length === 1 && /1 \/ 8/.test(html) && /data-chapter="problem"/.test(html) && /data-chapter-tab="benefits"/.test(html) && /data-chapter-tab="appendix"/.test(html) && /8 jobs for 5 sources and 5 destinations/.test(html), `${name}: one diagram per slide, the slide counter, the chapter bar with the appendix`);
  ok(!/data-list="pipelines"/.test(html) && !/Where in the flow|Where in the data/.test(html) && !/data-play=/.test(html), `${name}: no pipeline list, flow, lineage or play on the first tab`);
  ok(/aria-selected="true"[^>]*>What it is/.test(html) && /Error handling</.test(html) && /Copy as Markdown/.test(html), `${name}: the two tabs and the copy button`);
  ok(!/\\u00b7/.test(html) && /\u00b7 business view/.test(html), `${name}: the middle dot is a character, not an escape`);
}
const sd = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 2 }} />);
ok(/data-slide="doors"/.test(sd) && /data-chapter="what"/.test(sd) && /Four doors, one building/.test(sd) && /FOUR DOORS INTO THE SAME BUILDING/.test(sd) && /File drop/.test(sd) && /Outgoing file/.test(sd) && /Outbound loaders/.test(sd) && (sd.match(/At the door:/g) || []).length === 4 && (sd.match(/If it fails:/g) || []).length === 4 && /Why four doors and not one/.test(sd), "slide 3: the four doors drawn, each with what is checked at the door and what happens when it fails");
const s1 = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 0 }} />);
ok(/data-slide="without"/.test(s1) && /RMJ schedule/.test(s1) && /cron job/.test(s1) && /interface app/.test(s1) && /8 jobs for 5 sources and 5 destinations/.test(s1) && /Every pair is its own job/.test(s1), "slide 1: without a hub, with the jobs drawn and the callouts");
const sp = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 1 }} />);
ok(/data-slide="plain"/.test(sp) && /data-chapter="what"/.test(sp) && /The post office for your data/.test(sp) && /THE POST OFFICE/.test(sp) && /File drop/.test(sp) && /Keep the record/.test(sp) && /It receives\./.test(sp) && /It keeps the record\./.test(sp) && /In one sentence\./.test(sp) && /The tower, again\./.test(sp) && !/https?:\/\/|testbbh|@bbh/.test(sp), "slide 2: what it is in plain words: the post office picture, the four jobs, the one sentence, the tower again");
const s2 = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 3 }} />);
ok(/data-slide="with"/.test(s2) && /INGESTION CHANNELS/.test(s2) && /Outbound loaders/.test(s2) && /Error handling/.test(s2) && /Translation and contracts/.test(s2) && /plug and play · one place to change · governed/.test(s2) && /Plug and play/.test(s2) && /Security, entitlements and control/.test(s2) && /governed by Security Entitlement/.test(s2) && /Secured and controlled/.test(s2), "slide 4: the hub with its channels, error handling, translation, the record and security and control inside, the governing pages named, and five callouts");
const s3 = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 4 }} />);
ok(/data-slide="does"/.test(s3) && /1\. receive/.test(s3) && /5\. publish/.test(s3) && /Sensors and scheduling/.test(s3), "slide 5: the five verbs and where it is used");
const s4 = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 5 }} />);
ok(/data-slide="governs"/.test(s4) && /Shapes and change control/.test(s4) && /Governed/.test(s4) && /Code Review 360/.test(s4), "slide 6: what it governs and how");
const sb = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 6 }} />);
ok(/data-slide="benefits"/.test(sb) && /data-chapter="benefits"/.test(sb) && /Four things change/.test(sb) && /One place to change things/.test(sb) && /Problems are visible/.test(sb) && /New connections plug in/.test(sb) && /It is governed/.test(sb) && (sb.match(/>TODAY</g) || []).length === 4 && (sb.match(/>WITH THE HUB</g) || []).length === 4 && /The message\./.test(sb) && /7 \/ 8/.test(sb), "slide 7: what the business gets, four today/with-the-hub pairs and the closing message");
const ss = renderToStaticMarkup(<HubSlides t={tLight} initial={{ slide: 7 }} />);
ok(/data-slide="story"/.test(ss) && /data-chapter="appendix"/.test(ss) && /The Tower and the Hub/.test(ss) && /WITHOUT A TOWER/.test(ss) && /WITH A TOWER/.test(ss) && /The flight strip/.test(ss) && /The radar screen/.test(ss) && /not unsafe every day/.test(ss) && /Integration 360: what, where, why/.test(ss) && /8 \/ 8/.test(ss), "slide 8, appendix: the tower story with its picture, six beats and closing line");
const errTab = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ tab: "Error handling" }} />);
ok(/data-tab="errors"/.test(errTab) && /data-play="quarantine"/.test(errTab) && /data-frame="0"/.test(errTab) && !/data-tab="what"/.test(errTab) && (errTab.match(/role="tab"/g) || []).length === 2 + PLAYS.length, "the Error handling tab opens on the first play with a tab per scenario");
const mid = renderToStaticMarkup(<HubErrorPlay t={tLight} initial={{ play: "quarantine", frame: 2, running: false }} />);
ok(/data-frame="2"/.test(mid) && /data-state="QUARANTINED" data-lit="true"/.test(mid) && /goes wrong/.test(mid) && /moves to quarantine/.test(mid) && /3 \/ 11/.test(mid), "frame 3 of the quarantine play: the token is on the Quarantine branch, the QUARANTINED state is lit, the narration says why");
const later = renderToStaticMarkup(<HubErrorPlay t={tLight} initial={{ play: "quarantine", frame: 4, running: false }} />);
ok(/handled/.test(later) && /RETRY_COUNT becomes 1/.test(later) && /data-state="RECEIVED" data-lit="true"/.test(later), "frame 5: handled, the corrected file re-enters and the registry is RECEIVED again");
const out = renderToStaticMarkup(<HubErrorPlay t={tLight} initial={{ play: "silent-loader", frame: 5, running: false }} />);
ok(/data-play="silent-loader"/.test(out) && /the poll wins/.test(out) && /Status notify/.test(out) && /data-state="STATUS_UNRESOLVED"/.test(out), "the outbound play: poll wins, STATUS_UNRESOLVED on the ribbon");
ok(/<animate /.test(mid) && /transition:\s*transform/.test(mid), "the token pulses and its moves are animated");

console.log("-- the Markdown");
const md = businessMarkdown(PLAYS);
ok(/^# CP Integration Hub: the business view/.test(md) && /## The problem it solves/.test(md) && /## Where it is used/.test(md) && /## Error handling/.test(md) && PLAYS.every((p) => md.includes(p.title)), "the note has the page's sections and the eight scenarios");

console.log("-- Integration 360 - Run: the pipelines");
const chans = new Set(P.PIPELINES.map((p) => p.channel));
ok(P.PIPELINES.length === 12 && chans.size === 4 && new Set(P.PIPELINES.map((p) => p.domain)).size === 2, "twelve pipelines across the four channels, accounting and non-accounting");
const c = P.counts();
ok(c.red === 6 && c.green === 5 && c.planned === 1, "status from the cases: six red, five green, one not yet live", JSON.stringify(c));
const probs = [];
for (const p of P.PIPELINES) {
  const v = P.pipelineView(p), ids = new Set(v.graph.nodes.map((n) => n.id));
  v.graph.edges.forEach((e) => { if (!ids.has(e.from) || !ids.has(e.to)) probs.push(`${p.id} edge`); });
  v.cases.forEach((x) => { if (!ids.has(x.column) || x.flow >= v.flow.length || x.dagTask >= v.dag.length || !x.rule) probs.push(`${p.id} case ${x.id}`); });
  if (!ids.has(v.graph.focus) || !v.graph.stage_labels || !p.business) probs.push(`${p.id} view`);
}
ok(probs.length === 0, "every pipeline's column graph is closed and its cases land on real boxes and columns", probs.join());
const list = renderToStaticMarkup(<PipelineCatalog t={tLight} />);
ok((list.match(/data-pipeline="/g) || []).length === 12 && /12 pipelines/.test(list) && /6 failing/.test(list) && /data-pipeline-open="file-pos"/.test(list) && /data-record="soda-001"/.test(list), "the list shows all twelve with the counts; positions opens on its first case");
const cash = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "file-cash" }} />);
ok(/What went wrong/.test(cash) && /The error/.test(cash) && /Where it happened/.test(cash) && /The issue, and what to do/.test(cash) && /expect_column_values_to_not_be_null/.test(cash) && /Intermediate <[^>]*>failed here/.test(cash) && /dbt_int/.test(cash) && /ACC-88213/.test(cash), "an open red pipeline says what, where and why: the rule, the step, the task, the rows");
ok(/Where in the flow/.test(cash) && /Where in the data/.test(cash) && /data-failed="STG2:int_cash_balance:cash_balance_usd"/.test(cash) && /cash_balance_usd failed here/.test(cash) && (cash.match(/>upstream_failed<\/text>/g) || []).length === 2 && !/data-panel=/.test(cash) && !/Step \d of \d:/.test(cash) && !/Column lineage/.test(cash), "the flow and the task are painted, the failed column is marked in the wires, and there are no step panels or state diagrams here");
console.log("-- where in the data: the wires");
const wireProbs = [];
for (const p of P.PIPELINES) {
  const v = P.pipelineView(p), L = wireLayout(v.graph);
  if (L.levels < 3 || !v.graph.nodes.every((n) => L.pos[n.id])) wireProbs.push(`${p.id} layout ${L.levels}`);
  const byId = Object.fromEntries(v.graph.nodes.map((n) => [n.id, n]));
  const sameCol = v.graph.edges.filter((e) => { const a = byId[e.from], b = byId[e.to]; return L.pos[e.from].x === L.pos[e.to].x && a.table !== b.table; });
  if (sameCol.length) wireProbs.push(`${p.id} ${sameCol.length} wires inside one column`);
  v.cases.forEach((c) => { const h = hopsFor(v.graph, c.column); if (!h.length || !h.some((x) => x.to.id === c.column || x.from.id === c.column)) wireProbs.push(`${p.id} ${c.id} no hops`); });
  const html = renderToStaticMarkup(<HubWires t={tLight} graph={v.graph} failed={v.cases[0] ? v.cases[0].column : null} />);
  if (!/data-wires=/.test(html) || (v.cases[0] && !/failed here/.test(html)) || !/export CSV/.test(html)) wireProbs.push(`${p.id} render`);
}
ok(wireProbs.length === 0, "every pipeline draws the same way: tables laid out by flow so no wire stays inside a column, every column placed, the failed column's path has hops, and the picture renders", wireProbs.join("; "));
const cashView = P.pipelineView(P.PIPELINES.find((p) => p.id === "file-cash"));
const cashHops = hopsFor(cashView.graph, "STG2:int_cash_balance:cash_balance_usd");
ok(cashHops.some((h) => h.from.column === "CASH_BALANCE_LOCAL" && h.op.label === "CAST / RENAME") && cashHops.some((h) => h.from.table === "stg_fx_rate" && h.op.label === "JOIN / DERIVE") && cashHops.some((h) => h.to.column === "CASH_BALANCE_USD" && h.op.label === "PUBLISH"), "the cash column's hops read source to target: the cast, the FX join and the publish");
const tr = tracePath(cashView.graph, "STG2:int_cash_balance:cash_balance_usd");
ok(tr.up.has("SRC:RECCASHACTIVITIES file:CASH_BALANCE_LOCAL") && tr.up.has("STG2:stg_fx_rate:fx_rate") && tr.down.has("DWH:IMDS gld_cash_summary:CASH_BALANCE_USD") && !tr.ns.has("STG2:stg_cash_activity.dq_status_cd"), "the trace reaches back to the file column and the FX rate and forward to the published column, and leaves the rest dim");
const csv = wiresCsv(cashView.graph);
ok(csv.split("\n").length === cashView.graph.edges.length + 1 && /^from_table,from_column,to_table,to_column,operation,label,rule/.test(csv), "export CSV: one row per column link");
console.log("-- the bad records");
ok(SCENARIOS.every((x) => x.records && (x.records.none || (x.records.rows && x.records.rows.length && x.records.columns[0] === "FILE_ROW_NUMBER" && x.records.rows.every((r) => r.length === x.records.columns.length) && x.records.bad.every((b) => x.records.columns.includes(b)) && x.records.table && x.records.total))),
   "every case carries its bad records: the rows with the loader's row number, the failing field named, the table and the file total; or says why there are none");
ok(/data-bad-records="ge-001"/.test(cash) && /Bad records from the file/.test(cash) && /row 2,114/.test(cash) && /row 12,090/.test(cash) && /RAW_REC_CASH_ACTIVITIES/.test(cash) && /FILE_REGISTRY_ID 4471/.test(cash) && /no FX rate for XPF/.test(cash) && /of 15,204 rows/.test(cash) && /copy as CSV/.test(cash),
   "the cash case lists its three bad rows by file row number from the RAW table, with the reason and the total");
const noFile = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "file-pos", scenario: "soda-001" }} />);
ok(/data-bad-records="soda-001"/.test(noFile) && /No file arrived, so there are no records to show/.test(noFile) && !/copy as CSV/.test(noFile), "a missing file says there are no records, and why");
const dup = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "file-acct" }} />);
ok(/row 3,310/.test(dup) && /row 3,311/.test(dup) && /8 more pairs/.test(dup) && /later amendment/.test(dup), "the duplicate-account case shows the pairs with the amendment sequence and how many more there are");
const green = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "evt-txn" }} />);
ok(/data-healthy="evt-txn"/.test(green) && /Nothing wrong today/.test(green) && !/data-record=/.test(green) && !/data-bad-records=/.test(green) && !/failed here/.test(green), "a green pipeline says nothing is wrong, shows no bad records and its path clean");
ok(!/testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|\.internal|billing-sftp/.test(JSON.stringify(P.PIPELINES)), "no host, schema owner, link or address in the catalogue");

console.log("-- live records from Airflow and dbt");
ok(P.PIPELINES.filter((p) => p.dag_id).length === 11 && P.PIPELINES.find((p) => p.id === "file-pos").dag_id === "swp_positions_processing", "every live pipeline has the dag id the ingest keys on; the planned API has none");
const LIVE = { dags: { swp_positions_processing: { status: "red", run: { run_key: "swp_positions_processing:r1", state: "failed", business_date: "2026-11-27", ended_at: "2026-11-27T22:10:00" },
  failed_tasks: [{ task_key: "k1", task_id: "load_file", state: "failed", try_number: 2, error_code: "TRAILER_COUNT_MISMATCH", error_detail: "ValueError: TRAILER_COUNT_MISMATCH trailer=12480 rows=12479" }], failing: [], warnings: [], tasks_total: 8, tests_total: 0 },
  swp_transactions_events: { status: "green", run: { run_key: "swp_transactions_events:r9", state: "success", business_date: "2026-11-27" }, failed_tasks: [], failing: [], warnings: [], tasks_total: 8, tests_total: 12 } } };
const merged = mergeLive(P.PIPELINES, LIVE);
ok(merged.find((p) => p.id === "file-pos").live.status === "red" && merged.find((p) => p.id === "evt-txn").live.status === "green" && merged.find((p) => p.id === "file-cash").live === null, "live status lays over the pipelines that have reported; the rest stay illustrative");
const posView = P.pipelineView(P.PIPELINES.find((p) => p.id === "file-pos"));
const finding = { test_key: "swp_positions_processing:inv1:test.x", run_key: "swp_positions_processing:inv1", rule_kind: "dbt_test", model_name: "stg_eod_positions", test_name: "not_null", column_name: "account_number", status: "fail", failures: 3, total_rows: 12480, expected: "not_null(account_number)", observed: "3 failing rows", threshold: "0", message: "Got 3 results", business_date: "2026-11-27", bad_rows: [{ FILE_ROW_NUMBER: 41, ACCOUNT_NUMBER: null, INSTRUMENT_ID: "INS-1" }] };
const lc = caseFromFinding(finding, P.PIPELINES.find((p) => p.id === "file-pos"), posView);
ok(lc.live && lc.rule === "not_null" && lc.column === "STG2:stg_eod_positions:account_number" && lc.kind === "Transformation tests" && lc.records.rows.length === 1 && lc.records.columns[0] === "FILE_ROW_NUMBER" && lc.bad === 3 && lc.total === 12480, "a dbt finding becomes a case: the column found in the pipeline's graph, the rows it carried as bad records", JSON.stringify(lc).slice(0, 200));
const tc = caseFromFinding({ ...LIVE.dags.swp_positions_processing.failed_tasks[0], rule_kind: "airflow", status: "failed", run_key: "swp_positions_processing:r1" }, P.PIPELINES.find((p) => p.id === "file-pos"), posView);
ok(tc.rule === "TRAILER_COUNT_MISMATCH" && tc.dagTask === 2 && tc.kind === "Orchestration" && /none/.test(Object.keys(tc.records).join()), "a failed task becomes a case on its DAG task with the loader's code");
const liveHtml = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "file-pos", live: LIVE, findings: { swp_positions_processing: [finding] } }} />);
ok(/2 LIVE/.test(liveHtml) && /data-last-run/.test(liveHtml) && /business date 2026-11-27/.test(liveHtml) && /1 task failed/.test(liveHtml) && /not_null/.test(liveHtml) && /TRAILER_COUNT_MISMATCH/.test(liveHtml) && /row 41/.test(liveHtml) && !/soda-001/.test(liveHtml),
   "with live records the page shows LIVE, the last run, the dbt finding and the failed task as cases, and the bad row by file row number; the illustrative case is gone");
const liveGreen = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "evt-txn", live: LIVE }} />);
ok(/data-healthy="evt-txn"/.test(liveGreen) && /The latest run success/.test(liveGreen), "a live green pipeline says its latest run was clean");
const noLive = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "file-cash", live: LIVE }} />);
ok(/data-record="ge-001"/.test(noLive) && /illustrative/.test(noLive), "a pipeline that has not reported keeps its illustrative case and says so");
const ing = fs.readFileSync(path.join(SRC, "..", "..", "api", "app", "routers_integration360.py"), "utf8"), main = fs.readFileSync(path.join(SRC, "..", "..", "api", "app", "main.py"), "utf8"), sql = fs.readFileSync(path.join(SRC, "..", "..", "sql", "90_integration360.sql"), "utf8");
ok(/routers_integration360/.test(main) && /\/ingest\/airflow/.test(ing) && /\/ingest\/dbt/.test(ing) && /\/badrows/.test(ing) && /CREATE TABLE i360_run/.test(sql) && /CREATE TABLE i360_test/.test(sql) && /EXCEPTION_INIT\(e_exists, -955\)/.test(sql), "the API is mounted, the ingest endpoints exist, the tables are guarded");
const cb = fs.readFileSync(path.join(SRC, "..", "..", "integration", "airflow", "i360_callbacks.py"), "utf8"), poll = fs.readFileSync(path.join(SRC, "..", "..", "integration", "poll", "i360_poller.py"), "utf8"), np = fs.readFileSync(path.join(SRC, "..", "..", "deploy", "openshift", "i360-allow-airflow.yaml"), "utf8");
ok(!/testbbh|apps\.ocp|\.bbh\.com|@bbh/.test(cb + poll + np + ing) && /<cp360-namespace>/.test(np) && /<airflow-namespace>/.test(np), "no real host, namespace or address in the hooks, the poller or the network policy: placeholders only");

console.log("-- nothing that should not be shared, and the nav");
const FORBID = /testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|:2483|\b2483\b|[\w.+-]+@[\w-]+\.[\w.-]+|ORACLE_PASSWORD/;
const srcs = ["hubBusiness.js", "HubBusiness.jsx", "hubPipelines.js", "hubErrorPlays.js", "HubErrorPlay.jsx", "HubWires.jsx", "HubSlides.jsx", "integration360Api.js"].map((f) => fs.readFileSync(path.join(SRC, f), "utf8"));
ok(srcs.every((s) => !FORBID.test(s)) && !FORBID.test(md), "no host, schema owner, database link, port, address or credential in the sources or the note", srcs.map((s) => (s.match(FORBID) || [""])[0]).join("|"));
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8"), app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), gr = fs.readFileSync(path.join(SRC, "Guardrails.jsx"), "utf8");
ok(!/Quality Guardrails/.test(shell) && /\['guardrails', 'Integration 360 - Run'/.test(shell) && /\['integration360', 'Integration 360 - Design'/.test(shell) && !/hubbusiness/.test(shell) && !/hubbusiness/.test(app), "Quality Guardrails is Integration 360 - Run; the readiness page is Integration 360 - Design; the business view is not a separate item");
ok(/<Integration360Console t=\{t\} \/>/.test(gr) && /"Pipelines", "Overview"/.test(gr), "Integration 360 - Run opens on the console");
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage, addEventListener() {}, removeEventListener() {} };
const tog = renderToStaticMarkup(<HubViewToggle t={tLight} mode="business" onPick={() => {}} />);
ok(/Technical view/.test(tog) && /aria-selected="true"[^>]*>Business view/.test(tog), "the hub page's toggle offers both views");
store["cp360-hub-view"] = "business";
const asBusiness = renderToStaticMarkup(<HubDesign t={tLight} />);
ok(/Without a hub/.test(asBusiness) && /data-chapter-tab="appendix"/.test(asBusiness) && /Technical view/.test(asBusiness), "CP Integration Hub remembers the business view and shows it");
store["cp360-hub-view"] = "technical";
ok(!/data-chapter-tab=/.test(renderToStaticMarkup(<HubDesign t={tLight} />)), "and opens on the technical view otherwise");

if (BAD) { console.log(`\n${BAD} assertion(s) failed`); process.exit(1); }
console.log("\nhub-business assertions pass");
