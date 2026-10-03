// Quality Guardrails across SIT, UAT and PROD.
//
// THE REFACTOR THIS PINS. The screen was one flat list of failed jobs with
// no notion of where they ran. BBH promotes through three regions that do
// genuinely different work, and the trap is to model that as one list with
// a region filter. It is not:
//
//   a GATE RUN belongs to a commit   — can this change ship?
//   a GUARDRAIL EVENT belongs to a run on a business date — is today right?
//
// PROD runs no gates at all. Drawing it with an empty gate list would read
// as a gap rather than as the design, so the region switch picks between
// two screens rather than narrowing one.
//
// Rendering every gate state matters because they are not interchangeable:
// a failing NON-BLOCKING gate is a report, and counting it as a stop is how
// a board teaches people that red means nothing.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SyntheticBanner, RegionLanes, ReleaseGates, Gate, Evidence, GateBar }
  from "../src/Guardrails.jsx";
import { STAGE, GATE_STATUS, REGION } from "../src/guardrails_api_additions.js";
import { tLight } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
const t = { ...tLight, radius: tLight.radius, height: tLight.height };

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
const SYNTH = strip("ingestion/guardrails_promotion_synth.py");
const DDL = fs.readFileSync(path.join(ROOT, "sql/67_guardrail_promotion.sql"), "utf8");

// ---- the two planes are two screens, not one with a filter ------------
ok(/region === "PROD"[\s\S]{0,80}RuntimePlane/.test(GJSX),
   "PROD mounts the runtime plane", "");
ok(/:\s*<PromotionPlane/.test(GJSX),
   "SIT and UAT mount the promotion plane instead", "");
ok(/no gate runs in \{region\}/i.test(GJSX),
   "and PROD says it is not gated, rather than showing an empty gate list",
   "");
ok(/"region": "PROD", "kind": "runtime"/.test(ROUTER),
   "the API types PROD as runtime, so the UI is not guessing from a name", "");
for (const rg of ["SIT", "UAT"]) {
  ok(new RegExp(`"region": "${rg}", "kind": "gates"`).test(ROUTER),
     `and ${rg} as gated`, "");
}

// ---- every region and every gate state renders ------------------------
const META = {
  SIT: { region: "SIT", kind: "gates", gates: 14, failed: 1, blocking_failures: 1,
         running: 0, events: 0, critical: 0, trigger: "every push",
         covers: "governance, tests, security" },
  UAT: { region: "UAT", kind: "gates", gates: 6, failed: 1, blocking_failures: 1,
         running: 0, events: 0, critical: 0, trigger: "on promotion",
         covers: "SLA at realistic volumes" },
  PROD: { region: "PROD", kind: "runtime", gates: 0, failed: 0,
          blocking_failures: 0, running: 0, events: 7, critical: 2,
          trigger: "every scheduled run", covers: "data quality on the date" },
};
let lanes = "";
try {
  lanes = renderToStaticMarkup(
    <RegionLanes t={t} cur="SIT" onPick={() => {}} meta={(k) => META[k]} />);
  ok(lanes.length > 0, "the three region lanes render", "");
} catch (e) { ok(false, "the three region lanes render", e && e.stack); }
for (const k of ["SIT", "UAT", "PROD"]) {
  ok(lanes.includes(REGION[k].label), `${k} appears`, "");
}
ok(!/NaN|undefined/.test(lanes), "with no NaN or undefined", lanes.slice(0, 200));
// PROD's trouble signal is a critical EVENT; SIT's is a blocking GATE.
// One badge word for both would be wrong about one of them.
ok(/2 critical/.test(lanes),
   "PROD's badge counts critical runtime events, not gates", "");
ok(/1 blocking/.test(lanes),
   "a gated region's badge counts blocking gate failures", "");

// ---- every gate status renders, and non-blocking is marked ------------
const mkGate = (o) => ({ gate_run_id: "g1", region: "SIT", stage: "testing",
  stage_order: 3, gate_key: "dbt_tests", gate_name: "dbt tests",
  status: "passed", severity: "low", blocking: "Y", ...o });
for (const st of Object.keys(GATE_STATUS)) {
  let h = "";
  try {
    h = renderToStaticMarkup(<Gate t={t} g={mkGate({ status: st })} first />);
    ok(h.includes(GATE_STATUS[st].label), `a ${st} gate renders its own word`, h.slice(0, 160));
  } catch (e) { ok(false, `a ${st} gate renders`, e && e.stack); }
  ok(!/NaN|undefined/.test(h), `a ${st} gate is clean`, h);
}
const nb = renderToStaticMarkup(
  <Gate t={t} g={mkGate({ status: "failed", blocking: "N" })} first />);
ok(/non-blocking/.test(nb),
   "a failing gate that does not block says so — counting it as a stop is how "
   + "a board teaches people that red means nothing", nb.slice(0, 200));
ok(!/non-blocking/.test(
     renderToStaticMarkup(<Gate t={t} g={mkGate({ status: "failed" })} first />)),
   "and a blocking one does not carry the chip", "");
// Only a BLOCKING failure counts as a blocker, server-side too.
ok(/x\.get\("status"\) in _BAD\s*$|status"\) in _BAD[\s\S]{0,60}blocking"\) == "Y"/m.test(ROUTER),
   "the API counts a blocker as failed AND blocking", "");

// ---- a release only appears on a board it has reached -----------------
ok(/\["UAT", "PROD"\]\.includes\(r\.current_region\)/.test(GJSX),
   "the UAT board excludes a release still sitting in SIT — its UAT gates "
   + "exist as not_run, and listing it would say somebody promoted it", "");

// ---- the gate bar shows what is still to run --------------------------
const barHtml = renderToStaticMarkup(
  <GateBar t={t} d={{ total: 14, passed: 2, failed: 0, warning: 0,
                      running: 1, not_run: 11 }} />);
ok(barHtml.length > 0 && !/NaN/.test(barHtml),
   "the gate bar renders a mostly-unrun release without NaN", barHtml.slice(0, 200));
ok(renderToStaticMarkup(<GateBar t={t} d={{ total: 0 }} />) === "",
   "and draws nothing rather than an empty bar when there are no gates", "");

// ---- evidence survives a payload that is not what we expected ---------
ok(/CVE-2026-21714/.test(renderToStaticMarkup(
     <Evidence t={t} raw='{"cve":"CVE-2026-21714","severity":"CRITICAL"}' />)),
   "JSON evidence renders as key and value", "");
ok(/not json/.test(renderToStaticMarkup(<Evidence t={t} raw="not json at all" />)),
   "and evidence that will not parse is shown as text rather than dropped "
   + "for being the wrong shape", "");

// ---- stages render in pipeline order ----------------------------------
const gates = [
  mkGate({ gate_run_id: "a", stage: "security", stage_order: 4, gate_name: "CVE scanning" }),
  mkGate({ gate_run_id: "b", stage: "governance", stage_order: 1, gate_name: "Schema validation" }),
  mkGate({ gate_run_id: "c", stage: "performance", stage_order: 2, gate_name: "EXPLAIN PLAN" }),
];
const rg = renderToStaticMarkup(
  <ReleaseGates t={t} region="SIT"
    detail={{ release: { title: "T", branch: "b", commit_sha: "abc1234",
                         pr_number: "1", build_number: "2", models_changed: 3,
                         datasets: "x" }, gates }} />);
const iGov = rg.indexOf("Governance"), iPerf = rg.indexOf("Performance"),
      iSec = rg.indexOf("Security");
ok(iGov > -1 && iPerf > iGov && iSec > iPerf,
   "stages read in CI/CD order, not in the order the rows came back",
   [iGov, iPerf, iSec]);
ok(!/NaN|undefined/.test(rg), "the gate list is clean", rg.slice(0, 200));

// ---- performance runs in BOTH regions, at different depths ------------
// The slide puts benchmarking in the Jenkins run; the real split is cheap
// checks on every push and volume SLA where volume exists.
ok(/"performance", 2, "explain_plan"/.test(SYNTH),
   "SIT runs EXPLAIN PLAN — no data volume needed", "");
ok(/"performance", 2, "sla_volume"/.test(SYNTH),
   "UAT runs the volume SLA — the half that needs realistic data", "");
// Checked against the SIT block itself. The first draft searched forward
// from sla_volume for the string "SIT_GATES", which appears again further
// down in build_gate_runs — so it matched whatever the truth was.
const SIT_BLOCK = (SYNTH.match(/SIT_GATES = \[([\s\S]*?)\]/) || ["", ""])[1];
const UAT_BLOCK = (SYNTH.match(/UAT_GATES = \[([\s\S]*?)\]/) || ["", ""])[1];
ok(SIT_BLOCK.includes("explain_plan") && !SIT_BLOCK.includes("sla_volume"),
   "SIT has the cheap performance checks and not the volume SLA", SIT_BLOCK);
ok(UAT_BLOCK.includes("sla_volume") && !UAT_BLOCK.includes("explain_plan"),
   "UAT has the volume SLA and does not repeat EXPLAIN PLAN", UAT_BLOCK);

// ---- the banner is driven by the payload, never by a constant ---------
ok(renderToStaticMarkup(
     <SyntheticBanner t={t} payload={{ synthetic: true }} />).includes("Illustrative"),
   "the banner shows while the data is synthetic", "");
ok(renderToStaticMarkup(
     <SyntheticBanner t={t} payload={{ synthetic: false }} />) === "",
   "and disappears on its own once a real connector reports synthetic=false — "
   + "a hard-coded banner would still be apologising a year later", "");
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={null} />) === "",
   "and says nothing at all when the service did not answer", "");
ok(/"synthetic": True/.test(ROUTER),
   "the API is what makes the claim", "");

// ---- the schema keeps the two grains apart ----------------------------
ok(/CREATE TABLE guardrail_release/.test(DDL), "there is a release table", "");
ok(/CREATE TABLE guardrail_gate_run/.test(DDL), "and a gate-run table", "");
ok(/ALTER TABLE guardrail_events ADD \(region/.test(DDL),
   "and the runtime table gains a region rather than being replaced", "");
ok(/-1430/.test(DDL),
   "ORA-01430 is tolerated, so re-running the script after the column exists "
   + "is not an error", "");
ok(/UPDATE guardrail_events SET region = ''PROD'' WHERE region IS NULL/.test(DDL),
   "existing events are backfilled as PROD — they always were runtime events",
   "");
// A filter that drops NULL regions would empty the screen on a database
// where sql/67 has run but the backfill has not.
ok(/NVL\(region, 'PROD'\)/.test(ROUTER),
   "the region filter reads NULL as PROD rather than excluding it", "");
ok((ROUTER.match(/if not rows:/g) || []).length >= 2,
   "and both runtime endpoints fall back when the region column is absent "
   + "entirely — a pre-67 database must not report an empty estate", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nguardrails-regions assertions pass");
if (bad) process.exit(1);
