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
import { PLAYS, MOOD } from "../src/hubErrorPlays.js";
import { ROLE, USES, GOVERNS, SOLVES, WITHOUT, I360, PIPELINE, STEP_DETAIL, DAG_DETAIL, POSITIONS_LINEAGE, SCENARIOS, businessMarkdown } from "../src/hubBusiness.js";
import * as P from "../src/hubPipelines.js";
import HubWires, { wireLayout, tracePath, hopsFor, wiresCsv } from "../src/HubWires.jsx";

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

console.log("-- the business view");
for (const [name, t] of [["light", tLight], ["dark", tDark]]) {
  const html = renderToStaticMarkup(<HubBusiness t={t} />);
  ok(/business view/.test(html) && /The problem it solves/.test(html) && /WITHOUT A HUB/.test(html) && /WITH CP INTEGRATION HUB/.test(html) && /What it does/.test(html) && /Where it is used/.test(html) && /What it governs/.test(html), `${name}: purpose, problem and solution, what it does, where used, what it governs`);
  ok((html.match(/<svg /g) || []).length === 2 && /sixteen connections/.test(html) && /CP INTEGRATION HUB/.test(html) && /1\. receive/.test(html) && /5\. publish/.test(html), `${name}: two diagrams (without, with) and the five verbs`);
  ok(!/data-list="pipelines"/.test(html) && !/How the data moves|Where in the flow|Column lineage/.test(html) && !/data-play=/.test(html), `${name}: no pipeline list, flow, lineage or play on the first tab`);
  ok(/aria-selected="true"[^>]*>What it is/.test(html) && /Error handling</.test(html) && /Copy as Markdown/.test(html), `${name}: the two tabs and the copy button`);
  ok(!/\\u00b7/.test(html) && /\u00b7 business view/.test(html), `${name}: the middle dot is a character, not an escape`);
}
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
const green = renderToStaticMarkup(<PipelineCatalog t={tLight} initial={{ pipeline: "evt-txn" }} />);
ok(/data-healthy="evt-txn"/.test(green) && /Nothing wrong today/.test(green) && !/data-record=/.test(green) && !/failed here/.test(green), "a green pipeline says nothing is wrong and shows its path clean");
ok(!/testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|\.internal|billing-sftp/.test(JSON.stringify(P.PIPELINES)), "no host, schema owner, link or address in the catalogue");

console.log("-- nothing that should not be shared, and the nav");
const FORBID = /testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|:2483|\b2483\b|[\w.+-]+@[\w-]+\.[\w.-]+|ORACLE_PASSWORD/;
const srcs = ["hubBusiness.js", "HubBusiness.jsx", "hubPipelines.js", "hubErrorPlays.js", "HubErrorPlay.jsx", "HubWires.jsx"].map((f) => fs.readFileSync(path.join(SRC, f), "utf8"));
ok(srcs.every((s) => !FORBID.test(s)) && !FORBID.test(md), "no host, schema owner, database link, port, address or credential in the sources or the note", srcs.map((s) => (s.match(FORBID) || [""])[0]).join("|"));
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8"), app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), gr = fs.readFileSync(path.join(SRC, "Guardrails.jsx"), "utf8");
ok(!/Quality Guardrails/.test(shell) && /\['guardrails', 'Integration 360 - Run'/.test(shell) && /\['integration360', 'Integration 360 - Design'/.test(shell) && !/hubbusiness/.test(shell) && !/hubbusiness/.test(app), "Quality Guardrails is Integration 360 - Run; the readiness page is Integration 360 - Design; the business view is not a separate item");
ok(/<PipelineCatalog t=\{t\} \/>/.test(gr) && /"Pipelines", "Overview"/.test(gr), "Integration 360 - Run opens on the pipelines");
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage, addEventListener() {}, removeEventListener() {} };
const tog = renderToStaticMarkup(<HubViewToggle t={tLight} mode="business" onPick={() => {}} />);
ok(/Technical view/.test(tog) && /aria-selected="true"[^>]*>Business view/.test(tog), "the hub page's toggle offers both views");
store["cp360-hub-view"] = "business";
const asBusiness = renderToStaticMarkup(<HubDesign t={tLight} />);
ok(/The problem it solves/.test(asBusiness) && /Technical view/.test(asBusiness), "CP Integration Hub remembers the business view and shows it");
store["cp360-hub-view"] = "technical";
ok(!/The problem it solves/.test(renderToStaticMarkup(<HubDesign t={tLight} />)), "and opens on the technical view otherwise");

if (BAD) { console.log(`\n${BAD} assertion(s) failed`); process.exit(1); }
console.log("\nhub-business assertions pass");
