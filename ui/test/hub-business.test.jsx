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
  ok(/One real pipeline: end-of-day positions/.test(html) && /The DAG/.test(html) && /Data lineage/.test(html) && /Error handling/.test(html), `${name}: the example, its DAG, lineage and error handling`);
  ok((html.match(/<svg /g) || []).length === 4, `${name}: four diagrams (context, flow, DAG, states)`, (html.match(/<svg /g) || []).length);
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

if (BAD) { console.log(`\n${BAD} assertion(s) failed`); process.exit(1); }
console.log("\nhub-business assertions pass");
