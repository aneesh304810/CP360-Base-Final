// Hub Business View: a presentation page for the business. It renders in both
// themes with every section, the diagrams carry the sources, lanes and
// consumers, the pipeline, DAG, lineage, states and error table come from one
// module, the Markdown carries the same, and nothing on it is a host, a
// schema owner, a database link, a port or a credential.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import HubBusiness, { HubViewToggle } from "../src/HubBusiness.jsx";
import HubDesign from "../src/HubDesign.jsx";
import { ROLE, USES, GOVERNS, I360, PIPELINE, businessMarkdown } from "../src/hubBusiness.js";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const SRC = fs.existsSync("src/HubBusiness.jsx") ? "src" : path.join("ui", "src");
const tLight = { accent: "#0f4775", navy: "#0f4775", text: "#1a1a1a", sub: "#4a5560", textMuted: "#7a8690", border: "#d9dee3", panel: "#ffffff", bg: "#f4f6f8", radius: { md: 6 } };
const tDark = { ...tLight, text: "#eef2f5", sub: "#b7c0c8", textMuted: "#8793a0", border: "#2b3640", panel: "#1b232b", bg: "#121820" };

console.log("-- the content module");
ok(ROLE.sources.length === 4 && ROLE.lanes.length === 4 && ROLE.consumers.length === 5 && ROLE.verbs.length === 5, "four sources, four lanes, five consumers, five verbs");
ok(ROLE.lanes.map((l) => l[0]).join() === "Events,Files,Loaders,APIs", "the lanes are the hub's four channels", ROLE.lanes.map((l) => l[0]).join());
ok(USES.length === 6 && ["Data movement", "Real-time", "Event-based", "Sensors and scheduling", "Data transformation", "Many consumers"].every((u) => USES.some((x) => x[1] === u)), "six uses: movement, real-time, events, sensors and scheduling, transformation, consumers");
ok(GOVERNS.length === 4 && I360.rows.length === 4 && /Quality Guardrails/.test(I360.line), "four governed things; Integration 360 named as the replacement for Quality Guardrails");
ok(PIPELINE.flow.length === 7 && PIPELINE.flow[0][0] === "Landing" && PIPELINE.flow[6][0] === "Consumers" && PIPELINE.branches.length === 2, "the pipeline flows landing to consumers with quarantine and failed branches");
ok(PIPELINE.dag.length === 8 && /sensor/.test(PIPELINE.dag[1][1]) && /38/.test(PIPELINE.dag[2][0]) && PIPELINE.dag[7][0] === "date_close", "the DAG waits on a sensor, maps the load per file and ends with the date close");
ok(PIPELINE.lineage.length === 5 && /BUSINESS_DATE, FILE_REGISTRY_ID, FILE_ROW_NUMBER/.test(PIPELINE.lineage[1][1]) && /dq_status_cd/.test(PIPELINE.lineage[2][1]), "lineage adds the loader's three stamps in RAW and the DQ flags in staging");
const main = PIPELINE.states.filter((s) => !s[2]).map((s) => s[0]), side = PIPELINE.states.filter((s) => s[2]).map((s) => s[0]);
ok(main.join() === "RECEIVED,VALIDATED,LOADING,ARCHIVED" && side.join() === "QUARANTINED,FAILED,ARCHIVE_FAILED", "the lifecycle is the loader's: four states on the path, three off it", main.join() + " | " + side.join());
ok(PIPELINE.errors.length === 6 && PIPELINE.errors.every((e) => e.length === 4 && e[3]), "six error scenarios, each with what Integration 360 shows");
const codes = ["TRAILER_COUNT_MISMATCH", "MISSING_ACCOUNT_NUMBER", "RAW_LOAD_FAILED", "ARCHIVE_FAILED"];
ok(codes.every((c) => PIPELINE.errors.some((e) => e[1].includes(c))), "the scenarios use the loader's and the staging model's own codes");

console.log("-- the page");
for (const [name, t] of [["light", tLight], ["dark", tDark]]) {
  const html = renderToStaticMarkup(<HubBusiness t={t} />);
  ok(/business view/.test(html) && /What it does/.test(html) && /Where it is used/.test(html) && /What it governs/.test(html) && /Integration 360 - Run in place of Quality Guardrails/.test(html), `${name}: the five sections above the example`);
  ok(/End-of-day positions: how the data moves/.test(html) && /The DAG/.test(html) && /Data lineage/.test(html) && /Error handling/.test(html) && /data-list="pipelines"/.test(html), `${name}: the pipeline list, the open pipeline, its DAG, lineage and error handling`);
  ok((html.match(/<svg /g) || []).length === 5, `${name}: five diagrams (context, flow, DAG, column lineage, states)`, (html.match(/<svg /g) || []).length);
  ok(/CP INTEGRATION HUB/.test(html) && /SEI Event Hub/.test(html) && /IMDS/.test(html) && /CP DW Canonical/.test(html), `${name}: the context diagram names the sources, the hub and the consumers`);
  ok(/EOD_POSITIONS_&lt;yyyymmdd&gt;\.out|EOD_POSITIONS_<yyyymmdd>\.out/.test(html) && /RAW_EOD_POSITIONS/.test(html) && /QUARANTINED/.test(html) && /wait_for_files/.test(html), `${name}: the file, the RAW table, the states and the DAG tasks are on the page`);
  ok(/Copy as Markdown/.test(html), `${name}: the copy button`);
  ok(!/\\u00b7/.test(html) && /· business view/.test(html), `${name}: the middle dot is a character, not an escape`);
}

console.log("-- the Markdown");
const md = businessMarkdown();
ok(/^# CP Integration Hub: the business view/.test(md) && /## Where it is used/.test(md) && /## Integration 360 - Run in place of Quality Guardrails/.test(md) && /## One real pipeline/.test(md), "the note has the page's sections");
ok(/Flow: Landing → Validate/.test(md) && /DAG: read_config → wait_for_files/.test(md) && md.split("\n").filter((l) => /^\| /.test(l)).length === 7, "flow, DAG and the six scenarios as a table");

console.log("-- nothing that should not be shared");
const FORBID = /testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|:2483|\b2483\b|[\w.+-]+@[\w-]+\.[\w.-]+|ORACLE_PASSWORD/;
const srcs = ["hubBusiness.js", "HubBusiness.jsx"].map((f) => fs.readFileSync(path.join(SRC, f), "utf8"));
ok(srcs.every((s) => !FORBID.test(s)) && !FORBID.test(md), "no host, schema owner, database link, port, address or credential in the page or the note", srcs.map((s) => (s.match(FORBID) || [""])[0]).join("|"));

console.log("-- the nav and the toggle");
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8"), app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
ok(!/Quality Guardrails/.test(shell) && /\['guardrails', 'Integration 360 - Run'/.test(shell) && /\['integration360', 'Integration 360 - Design'/.test(shell) && !/hubbusiness/.test(shell) && !/hubbusiness/.test(app),
   "Quality Guardrails is now Integration 360 - Run; the readiness page is Integration 360 - Design; the business view is not a separate item");
ok(shell.indexOf("['pii'") < shell.indexOf("['guardrails'") && shell.indexOf("['guardrails'") < shell.indexOf("['cyber360'") && shell.indexOf("group: 'Architecture'") < shell.indexOf("['integration360'"),
   "Run stays in Governance where Quality Guardrails was; Design sits under Architecture");
const gr = fs.readFileSync(path.join(SRC, "Guardrails.jsx"), "utf8"), i3 = fs.readFileSync(path.join(SRC, "Integration360Design.jsx"), "utf8"), landing = fs.readFileSync(path.join(SRC, "LandingPage.jsx"), "utf8");
ok(/Integration 360 \\u00b7 Run/.test(gr) && !/>Quality Guardrails</.test(gr) && (i3.match(/Integration 360 \\u00b7 Design/g) || []).length === 4 && /label: "Integration 360 - Run"/.test(landing), "the page titles and the landing tile carry the new names");
ok(/guardrails: <Guardrails/.test(app), "the Quality Guardrails route still answers a saved link");
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage, addEventListener() {}, removeEventListener() {} };
const tog = renderToStaticMarkup(<HubViewToggle t={tLight} mode="business" onPick={() => {}} />);
ok(/Technical view/.test(tog) && /Business view/.test(tog) && /aria-selected="true"[^>]*>Business view/.test(tog), "the toggle offers both views and marks the current one", tog.slice(0, 200));
store["cp360-hub-view"] = "business";
const asBusiness = renderToStaticMarkup(<HubDesign t={tLight} />);
ok(/Technical view/.test(asBusiness) && /Where it is used/.test(asBusiness) && /wait_for_files/.test(asBusiness), "CP Integration Hub remembers the business view and shows this content under it");
store["cp360-hub-view"] = "technical";
const asTechnical = renderToStaticMarkup(<HubDesign t={tLight} />);
ok(/Business view/.test(asTechnical) && !/Where it is used/.test(asTechnical), "and opens on the technical view otherwise, with the toggle to switch");

console.log("-- inside each box");
import("../src/hubBusiness.js").then(({ STEP_DETAIL, DAG_DETAIL, POSITIONS_LINEAGE, SCENARIOS }) => {
  console.log("-- the Quality Guardrails cases, replayed");
  const lid = new Set(POSITIONS_LINEAGE.nodes.map((n) => n.id));
  ok(SCENARIOS.length === 7 && ["ge-001", "soda-001", "dbt-001", "af-001", "soda-002", "dbt-002", "ge-002"].every((id) => SCENARIOS.some((x) => x.id === id)), "the seven synthetic Guardrails events, by their ids");
  ok(SCENARIOS.every((x) => x.flow >= 0 && x.flow < 7 && x.dagTask >= 0 && x.dagTask < 8 && lid.has(x.column) && x.rule && x.observed && x.cause && x.sample.length && x.i360 && x.registry), "each case lands on a flow step, a DAG task, a lineage column and carries its rule, observation, cause, rows and what Integration 360 shows", SCENARIOS.filter((x) => !lid.has(x.column)).map((x) => x.column).join());
  ok(!/\.internal|billing-sftp|\/inbound|\.bbh|sftp_folder/i.test(JSON.stringify(SCENARIOS)), "no host or path from the synthetic file is carried");
  const replay = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ pipeline: "file-cash", scenario: "ge-001" }} />);
  ok(/data-record="ge-001"/.test(replay) && /expect_column_values_to_not_be_null/.test(replay) && /3 nulls in 15,204 rows/.test(replay) && /ACC-88213/.test(replay) && /XPF/.test(replay), "replaying the cash not-null case shows the Integration 360 record with its rows");
  ok(/Step 5 of 7: Intermediate/.test(replay) && /failed here/.test(replay) && (replay.match(/>upstream_failed<\/text>/g) || []).length === 2 && /aria-pressed="true"/.test(replay), "it paints Intermediate as failed in the flow, dbt_int as failed in the DAG with the two tasks after it upstream_failed, and the case pressed");
  ok(/Follow[\s\S]{0,80}cash_balance_usd/.test(replay), "and traces cash_balance_usd in the column lineage");
  const fresh = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ scenario: "soda-001" }} />);
  ok(/data-record="soda-001"/.test(fresh) && /Step 1 of 7: Landing/.test(fresh) && /Follow[\s\S]{0,80}AS_OF_DATE/.test(fresh) && (fresh.match(/>waits</g) || []).length === 6, "the positions freshness case lands on Landing: the whole path waits, the sensor task is red, AS_OF_DATE traced");

  console.log("-- column lineage in the Lineage page's shape");
  const ids = new Set(POSITIONS_LINEAGE.nodes.map((n) => n.id));
  ok(POSITIONS_LINEAGE.nodes.every((n) => /^(SRC|STG1|STG2|DWH):/.test(n.id) && n.stage && n.table && n.column) && ids.size === POSITIONS_LINEAGE.nodes.length, "nodes carry stage, table and column with unique stage:table:column ids");
  ok(POSITIONS_LINEAGE.edges.every((e) => ids.has(e.from) && ids.has(e.to) && ["direct", "ren", "trim", "merge", "phys"].includes(e.kind)), "every edge joins two known columns with one of the graph's edge kinds", POSITIONS_LINEAGE.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to)).map((e) => e.from + ">" + e.to).join());
  const fanIn = {}; POSITIONS_LINEAGE.edges.forEach((e) => { fanIn[e.to] = (fanIn[e.to] || 0) + 1; });
  ok(fanIn["STG2:stg_eod_positions:dq_status_cd"] === 4 && fanIn["STG2:int_position:account_id"] === 2, "the DQ flag fans in from the four required fields and account_id from the position and the account");
  const graphHtml = renderToStaticMarkup(<HubBusiness t={tLight} />);
  ok(/Column lineage/.test(graphHtml) && /RAW_EOD_POSITIONS/.test(graphHtml) && /dq_status_cd/.test(graphHtml) && /IMDS holding/.test(graphHtml) && />4 in</.test(graphHtml) && />2 in</.test(graphHtml), "the page draws it with LineageGraph: the four stages, the DQ fan-in badge and the account join badge", [/Column lineage/, /RAW_EOD_POSITIONS/, /dq_status_cd/, /IMDS holding/, />4 in</, />2 in</].map((r) => r.test(graphHtml)).join());
  ok(/TO_NUMBER/.test(graphHtml) && /Follow[\s\S]{0,80}quantity/.test(graphHtml), "quantity is the focused column, so its path is traced and its transform labels show", [/TO_NUMBER/.test(graphHtml), /Follow[\s\S]{0,80}quantity/.test(graphHtml)].join());

  ok(STEP_DETAIL.map((s) => s.step).join() === PIPELINE.flow.map((f) => f[0]).join() && DAG_DETAIL.map((d) => d.task).join() === PIPELINE.dag.map((d) => d[0]).join(), "every flow box and every DAG task has its detail, in the same order");
  ok(STEP_DETAIL.every((s) => s.does.length >= 2 && s.in && s.out && Object.keys(s.row).length >= 1 && s.fails.length >= 1 && s.fails.every((f) => f.length === 3)), "each step says what it does, in and out, the row after it, and at least one failure with what happens and what the business sees");
  ok(STEP_DETAIL[2].row.FILE_ROW_NUMBER === "1" && STEP_DETAIL[2].row.BUSINESS_DATE === "2026-11-27" && STEP_DETAIL[3].row.dq_status_cd === "PASS" && /number/.test(STEP_DETAIL[3].row.quantity), "the sample row gains the loader's stamps in RAW and becomes typed with a DQ flag in staging");
  ok(DAG_DETAIL.every((d) => d.does && d.onFail && d.retry && d.downstream) && /upstream_failed/.test(DAG_DETAIL[0].downstream) && /37 finish/.test(DAG_DETAIL[2].onFail), "each task says what it does, what a failure looks like, how it is retried and what happens downstream");
  ok(!/\b\d{6,}\b/.test(JSON.stringify(STEP_DETAIL).replace(/2026-11-27|20261127/g, "")), "no long digit runs in the sample row: nothing that could be a real account or instrument");
  const open = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ sel: { kind: "flow", i: 2 }, fail: true }} />);
  ok(/data-panel="flow"/.test(open) && /Step 3 of 7: RAW/.test(open) && /before \(Validate\)/.test(open) && /after \(RAW\)/.test(open) && /FILE_REGISTRY_ID/.test(open), "clicking RAW opens its panel with the row before and after");
  ok(/RAW_LOAD_FAILED/.test(open) && /showing a failure here/.test(open) && /failed here/.test(open) && (open.match(/>waits</g) || []).length === 4, "with a failure shown, RAW is marked failed and the four boxes after it wait");
  const dag = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ sel: { kind: "dag", i: 3 }, fail: true }} />);
  ok(/data-panel="dag"/.test(dag) && /Task 4 of 8: completeness/.test(dag) && (dag.match(/>upstream_failed<\/text>/g) || []).length === 4 && /task failed\. /.test(dag) && !/data-panel="flow"/.test(dag), "clicking a DAG task opens its panel; a failure there greys the four tasks after it as upstream_failed");
  const plain = renderToStaticMarkup(<HubBusiness t={tLight} />);
  ok(/Step 2 of 7: Validate/.test(plain) && /show a failure here/.test(plain) && !/failed here/.test(plain), "the page opens on Validate with the failure switch off");
  import("../src/hubPipelines.js").then((P) => {
    console.log("-- the pipeline catalogue");
    const chans = new Set(P.PIPELINES.map((p) => p.channel)), domains = new Set(P.PIPELINES.map((p) => p.domain));
    ok(P.PIPELINES.length === 12 && chans.size === 4 && ["event", "file", "api", "outbound"].every((c) => chans.has(c)) && domains.has("Accounting") && domains.has("Non-accounting"), "twelve pipelines across Events, Inbound Files, API and Outbound File, accounting and non-accounting");
    const c = P.counts();
    ok(c.red === 6 && c.green === 5 && c.planned === 1 && P.statusOf(P.PIPELINES.find((p) => p.id === "file-cash")) === "red" && P.statusOf(P.PIPELINES.find((p) => p.id === "evt-txn")) === "green", "status comes from the cases: six red, five green, one not yet live", JSON.stringify(c));
    const probs = [];
    for (const p of P.PIPELINES) {
      const v = P.pipelineView(p), ids = new Set(v.graph.nodes.map((n) => n.id));
      v.graph.edges.forEach((e) => { if (!ids.has(e.from) || !ids.has(e.to)) probs.push(`${p.id} edge`); });
      v.cases.forEach((x) => { if (!ids.has(x.column) || x.flow >= v.flow.length || x.dagTask >= v.dag.length || !x.rule) probs.push(`${p.id} case ${x.id}`); });
      if (!ids.has(v.graph.focus) || v.steps.length !== v.flow.length || v.dagDetail.length !== v.dag.length || v.states.length !== 7 || !p.business || !p.source || !p.destination) probs.push(`${p.id} view`);
      if (!v.graph.stage_labels || !v.graph.stage_labels.SRC) probs.push(`${p.id} labels`);
    }
    ok(probs.length === 0, "every pipeline's column graph is closed, its cases land on real boxes and columns, and its steps, tasks and states are complete", probs.join());
    ok(P.pipelineView(P.PIPELINES.find((p) => p.id === "api-status")).flow.length === 5 && P.pipelineView(P.PIPELINES.find((p) => p.id === "out-fee")).states.map((s) => s[0]).includes("STATUS_UNRESOLVED") && P.pipelineView(P.PIPELINES.find((p) => p.id === "evt-txn")).flow[0][0] === "Listen", "each channel has its own shape: five API steps, the loader's own states outbound, events start by listening");
    const list = renderToStaticMarkup(<HubBusiness t={tLight} />);
    ok((list.match(/data-pipeline="/g) || []).length === 12 && /12 pipelines/.test(list) && /6 failing/.test(list) && /5 healthy/.test(list) && /Intraday transactions/.test(list) && /Fee file to billing/.test(list) && /Loader status callback/.test(list), "the list shows all twelve with the counts and the channel groups");
    const cash = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ pipeline: "file-cash", scenario: "ge-001" }} />);
    ok(/data-pipeline-open="file-cash"/.test(cash) && /Cash balances: how the data moves/.test(cash) && /data-record="ge-001"/.test(cash) && /Step 5 of 7: Intermediate/.test(cash) && /RAW_REC_CASH_ACTIVITIES/.test(cash) && /cash_balance_usd/.test(cash) && /Follow[\s\S]{0,80}cash_balance_usd/.test(cash) && /stg_fx_rate/.test(cash),
       "opening Cash balances on its case shows its business header, the Intermediate step failed, the record, and the FX join traced in its own column graph");
    const out = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ pipeline: "out-fee", scenario: "af-001" }} />);
    ok(/data-record="af-001"/.test(out) && /Step 3 of 7: Submit/.test(out) && /FEE_ACCRUAL loader file/.test(out) && /STATUS_UNRESOLVED/.test(out) && /submit_gateway/.test(out) && />upstream_failed<\/text>/.test(out), "the outbound fee file fails at Submit: its loader-file lineage, the submission states and the DAG after submit_gateway");
    const api = renderToStaticMarkup(<HubBusiness t={tLight} initial={{ pipeline: "api-status" }} />);
    ok(/data-pipeline-open="api-status"/.test(api) && /Step 2 of 5: Gateway/.test(api) && /poll_reconcile/.test(api) && /GATEWAY/.test(api) && /REGISTRY/.test(api), "the status callback API: five steps, service steps instead of a DAG, and its own lane labels");
    ok(!/testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|\.internal|billing-sftp/.test(JSON.stringify(P.PIPELINES)), "no host, schema owner, link or address in the catalogue");
    if (BAD) { console.log(`\n${BAD} assertion(s) failed`); process.exit(1); }
    console.log("\nhub-business assertions pass");
  });
});
