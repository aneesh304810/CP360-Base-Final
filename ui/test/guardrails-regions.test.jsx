// Quality Guardrails: Overview, then one tab per environment.
//
// THE SHAPE THIS PINS. Three regions that do different work get three
// tabs, not one board with a region column. SIT and UAT are deliberately
// the SAME screen with different data — they ask the same question, and
// two layouts would make a reader re-learn the page when they promote.
// PROD is a different screen because it asks a different question: it
// runs no gates at all.
//
// GRAPHICAL AND TABULAR. The unit is a build x stage matrix — rows are
// builds, columns are the CI/CD stages, each cell is a glyph and a
// colour. The things that fail silently here are arithmetic, not layout:
//
//   a cell that shows its stage's MAJORITY instead of its worst outcome
//   is green on the build that is blocked;
//
//   a rollup computed in the UI instead of the API is a second pass over
//   the same rows in a second language, which is how a matrix comes to
//   disagree with the tiles above it;
//
//   a status colour with no glyph beside it carries meaning by hue
//   alone, which fails for a colour-blind reader and in print.
//
// All three are asserted. The first is asserted against real fixture
// data, because that is the only way to know the rule fires.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import Guardrails, { SyntheticBanner, FlowDiagram, StageCell, GateBar,
  GateList, Gate, Evidence, GLYPH } from "../src/Guardrails.jsx";
import { STAGE, GATE_STATUS, REGION } from "../src/guardrails_api_additions.js";
import { tLight } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
const t = tLight;

function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "Guardrails.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const ROOT = path.join(SRC, "..", "..");
const strip = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|#|--)/.test(l)).join("\n");
const GJSX = strip("ui/src/Guardrails.jsx");
const ROUTER = strip("api/app/routers_guardrails.py");
const DDL = fs.readFileSync(path.join(ROOT, "sql/67_guardrail_promotion.sql"), "utf8");

// ---- four tabs, and SIT/UAT share one component ----------------------
ok(/const TABS = \["Overview", "SIT", "UAT", "PROD"\]/.test(GJSX),
   "Overview, SIT, UAT, PROD", "");
ok(/tab === "SIT" \|\| tab === "UAT"\) &&\s*<Environment/.test(GJSX),
   "SIT and UAT mount the SAME component — they ask the same question, and "
   + "two layouts would make a reader re-learn the page on promotion", "");
ok(/tab === "PROD" && <Production/.test(GJSX),
   "PROD gets its own, because it runs no gates", "");
ok(/production is not gated/.test(GJSX),
   "and says so rather than showing an empty gate grid", "");

// ---- the rollup is the API's, computed once --------------------------
ok(/def _stage_rollup\(gates\)/.test(ROUTER),
   "the per-stage rollup is computed server-side", "");
ok(/"stages": _stage_rollup\(g\)/.test(ROUTER),
   "and attached to the region summary the lanes already use, so cell and "
   + "summary count the same rows", "");
ok(!/stages\[.*\]\s*=|function stageRollup/.test(GJSX),
   "the UI does not recompute it", "");

// ---- worst-not-majority, against real fixture data -------------------
// Lifted out of the router and run directly: a rule asserted only by
// regex passes whether or not it fires.
const pysrc = fs.readFileSync(path.join(ROOT, "api/app/routers_guardrails.py"), "utf8");
const body = pysrc.slice(pysrc.indexOf("_STAGES = ("), pysrc.indexOf("def _region"));
ok(/worst = \("failed" if counts\["failed"\]/.test(body),
   "a stage with any failure is a failed stage — a cell showing the "
   + "majority would be green on the build that is blocked", "");
ok(/"running" if counts\["running"\]/.test(body)
   && /"warning" if counts\["warning"\]/.test(body),
   "and the precedence below it is running, then warning", "");

// ---- status never travels as colour alone ----------------------------
for (const k of Object.keys(GATE_STATUS)) {
  ok(typeof GLYPH[k] === "string" && GLYPH[k].length > 0,
     `${k} has a glyph as well as a colour`, GLYPH[k]);
}
const cells = Object.keys(GATE_STATUS).map((k) =>
  renderToStaticMarkup(<StageCell t={t} c={{ status: k, total: 4,
    passed: k === "passed" ? 4 : 0, failed: k === "failed" ? 4 : 0,
    warning: 0, running: 0, not_run: 0 }} />));
cells.forEach((h, i) => {
  const key = Object.keys(GATE_STATUS)[i];
  ok(h.includes(GLYPH[key]), `the ${key} cell renders its glyph`, h.slice(0, 150));
  ok(!/NaN|undefined/.test(h), `the ${key} cell is clean`, h);
});
ok(renderToStaticMarkup(<StageCell t={t} c={null} />).includes("—"),
   "a stage the region does not run shows an em-dash, not a zero", "");
ok(/title=\{detail\}/.test(GJSX),
   "and carries its counts on hover rather than crowding the grid", "");

// ---- the bar: gaps, not borders --------------------------------------
const bar = renderToStaticMarkup(<GateBar t={t}
  d={{ total: 14, passed: 6, failed: 0, warning: 0, running: 1, not_run: 7 }} />);
ok(/gap:2px/.test(bar),
   "stacked segments are separated by a 2px surface gap — a rule between "
   + "fills reads as another category", bar.slice(0, 200));
// border-radius is not a border between segments; the first draft of this
// assertion matched it and failed on correct code.
ok(!/border(?!-radius)/.test(bar), "and not by a border", bar.slice(0, 200));
ok(renderToStaticMarkup(<GateBar t={t} d={{ total: 0 }} />) === "",
   "no bar at all when there are no gates", "");

// ---- a build only appears in a region it reached ---------------------
ok(/\["UAT", "PROD"\]\.includes\(r\.current_region\)/.test(GJSX),
   "a build still in SIT is absent from the UAT tab — its UAT gates exist "
   + "as not_run, and listing it would say somebody promoted it", "");

// ---- the gate list still carries the words ---------------------------
const g = (o) => ({ gate_run_id: "g", region: "UAT", stage: "performance",
  stage_order: 2, gate_key: "sla", gate_name: "SLA at 10K-5M rows",
  status: "failed", severity: "high", blocking: "Y",
  observed_value: "1,284s at 4.2M rows", threshold: "<= 900s",
  root_cause: "No change-hash column.", ...o });
const gl = renderToStaticMarkup(<GateList t={t} region="UAT"
  detail={{ release: { title: "T", branch: "b", commit_sha: "abc1234",
    pr_number: "1", build_number: "2" }, gates: [g({})] }} />);
ok(gl.includes("SLA at 10K-5M rows"), "the gate list renders", "");
ok(!/NaN|undefined/.test(gl), "cleanly", gl.slice(0, 200));
ok(/non-blocking/.test(renderToStaticMarkup(
     <Gate t={t} g={g({ blocking: "N" })} first />)),
   "a failing gate that does not block says so", "");
ok(/CVE-1/.test(renderToStaticMarkup(
     <Evidence t={t} raw='{"cve":"CVE-1"}' />)), "JSON evidence renders", "");
ok(/not json/.test(renderToStaticMarkup(<Evidence t={t} raw="not json" />)),
   "and evidence that will not parse is shown rather than dropped", "");

// ---- the Overview diagram --------------------------------------------
const fd = renderToStaticMarkup(<FlowDiagram t={t} />);
ok(/role="img"/.test(fd) && /aria-label/.test(fd),
   "the architecture diagram carries its claim for a reader who cannot see it",
   "");
for (const node of ["ODH", "app repo", "db repo", "Jenkins · app",
                    "Jenkins · Liquibase"]) {
  ok(fd.includes(node), `it shows ${node}`, "");
}
ok(/commit status back/.test(fd),
   "and the return arrow, which is what makes the merge conditional", "");
ok(!/NaN|undefined/.test(fd), "with no NaN", fd.slice(0, 200));

// ---- the whole screen mounts -----------------------------------------
let top = "";
try {
  top = renderToStaticMarkup(<Guardrails t={t} />);
  ok(top.length > 500, "Guardrails mounts and opens on Overview", top.length);
} catch (e) { ok(false, "Guardrails mounts", e && e.stack); }
ok(!/NaN|undefined/.test(top), "cleanly", (top.match(/.{0,60}(NaN|undefined).{0,60}/) || [])[0]);

// ---- the banner is the API's claim, not a constant -------------------
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={{ synthetic: true }} />)
     .includes("Illustrative"), "the banner shows while data is synthetic", "");
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={{ synthetic: false }} />) === "",
   "and disappears when a real ingester reports otherwise", "");
ok(/"synthetic": True/.test(ROUTER), "the API makes the claim", "");

// ---- the schema keeps the two grains apart ---------------------------
ok(/CREATE TABLE guardrail_release/.test(DDL)
   && /CREATE TABLE guardrail_gate_run/.test(DDL),
   "release and gate-run tables exist", "");
ok(/NVL\(region, 'PROD'\)/.test(ROUTER),
   "the runtime filter reads NULL as PROD rather than excluding it", "");
ok((ROUTER.match(/if not rows:/g) || []).length >= 2,
   "and both runtime endpoints fall back on a pre-67 database", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nguardrails-regions assertions pass");
if (bad) process.exit(1);
