// Quality Guardrails: one board, three regions, two grains.
//
// THE DESIGN THIS PINS. The first pass put SIT, UAT and PROD behind a
// region picker. That answers "did my build pass" and "did last night's
// data land", and fails the question the screen mostly exists for —
// "where is everything, and what is stuck" — which is only answerable by
// seeing all three regions at once. Behind a picker it becomes three
// clicks and a memory test.
//
// So the board shows every region in one view, and the release detail
// puts SIT and UAT side by side stage for stage. That alignment is the
// point: the positions release passes the performance stage in SIT at
// 20K rows and fails it in UAT at 4.2M, and those two facts belong on one
// line. A picker cannot draw that comparison at all.
//
// The two grains still do not merge. A gate run belongs to a commit; a
// guardrail event belongs to a run on a business date. They are two
// sections of one page, so the ops reader never navigates past a release
// board to check last night.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SyntheticBanner, PromotionBoard, BoardCell, ReleaseDetail, Gate,
  Evidence, GateBar } from "../src/Guardrails.jsx";
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
const SYNTH = strip("ingestion/guardrails_promotion_synth.py");
const DDL = fs.readFileSync(path.join(ROOT, "sql/67_guardrail_promotion.sql"), "utf8");

const REL = (o) => ({
  release_id: "REL-1", title: "Positions SCD2", branch: "feature/x",
  commit_sha: "4f2a9c1", pr_number: "418", build_number: "1201",
  author: "j.t", current_region: "UAT", status: "blocked", models_changed: 11,
  datasets: "gld_positions",
  regions: {
    SIT: { total: 14, passed: 14, failed: 0, warning: 0, running: 0,
           not_run: 0, blocking_failures: 0, blocker: null, state: "passed" },
    UAT: { total: 6, passed: 1, failed: 1, warning: 1, running: 0, not_run: 3,
           blocking_failures: 1, blocker: "SLA at 10K-5M rows", state: "blocked" },
  }, ...o });

// ---- all three regions are visible at once, with no picker -----------
let board = "";
try {
  board = renderToStaticMarkup(
    <PromotionBoard t={t} onOpen={() => {}}
      rels={{ releases: [REL({})], synthetic: true }} />);
  ok(board.length > 0, "the board renders", "");
} catch (e) { ok(false, "the board renders", e && e.stack); }
for (const k of ["SIT", "UAT", "PROD"]) {
  ok(board.includes(`>${k}<`), `${k} is a column on the same view`, "");
}
ok(!/aria-pressed/.test(board),
   "there is no region toggle — all three are on screen together, which is "
   + "the question a picker could not answer", "");
ok(!/NaN|undefined/.test(board), "and nothing renders as NaN or undefined",
   (board.match(/.{0,60}(NaN|undefined).{0,60}/) || [])[0]);

// ---- a blocked cell names the gate, not a count ----------------------
ok(board.includes("SLA at 10K-5M rows"),
   "a blocked cell names the gate holding the release — “1 failed” "
   + "sends the reader looking for what the cell could have told them", "");

// ---- a region not yet reached is blank, not green --------------------
const sitOnly = REL({ current_region: "SIT", status: "in_flight",
  regions: { SIT: { total: 14, passed: 2, failed: 0, warning: 0, running: 1,
                    not_run: 11, blocking_failures: 0, state: "running" },
             UAT: { total: 6, passed: 0, failed: 0, warning: 0, running: 0,
                    not_run: 6, blocking_failures: 0, state: "pending" } } });
const uatCell = renderToStaticMarkup(
  <BoardCell t={t} r={sitOnly} region="UAT" />);
ok(uatCell.includes("—") && !/queued|passed|blocked/.test(uatCell),
   "a release still in SIT shows nothing in the UAT column — its UAT gates "
   + "exist as not_run, and drawing them would say somebody promoted it",
   uatCell);

// ---- PROD answers a different question -------------------------------
// It is not a gate column: a release is live there or it is not.
const prodNo = renderToStaticMarkup(<BoardCell t={t} r={sitOnly} region="PROD" />);
const prodYes = renderToStaticMarkup(
  <BoardCell t={t} r={REL({ current_region: "PROD", status: "released" })}
    region="PROD" />);
ok(prodYes.includes("live"), "PROD says live when the change shipped", prodYes);
ok(prodNo.includes("—") && !/passed|gates/.test(prodNo),
   "and never reports gates, because PROD runs none", prodNo);
ok(/"region": "PROD", "kind": "runtime"/.test(ROUTER),
   "the API types PROD as runtime, so the UI is not guessing from a name", "");

// ---- the detail aligns SIT and UAT stage for stage --------------------
const g = (o) => ({ gate_run_id: Math.random().toString(36).slice(2),
  region: "SIT", stage: "testing", stage_order: 3, gate_key: "k",
  gate_name: "A gate", status: "passed", severity: "low", blocking: "Y", ...o });
const gates = [
  g({ region: "SIT", stage: "security", stage_order: 4, gate_name: "CVE scanning" }),
  g({ region: "SIT", stage: "governance", stage_order: 1, gate_name: "Schema validation" }),
  g({ region: "SIT", stage: "performance", stage_order: 2, gate_name: "EXPLAIN PLAN" }),
  g({ region: "UAT", stage: "performance", stage_order: 2, gate_name: "SLA at volume",
      status: "failed", observed_value: "1,284s at 4.2M rows",
      threshold: "<= 900s at 5M rows" }),
];
let det = "";
try {
  det = renderToStaticMarkup(
    <ReleaseDetail t={t} id="REL-1" onBack={() => {}} />);
  ok(true, "the detail renders before its fetch resolves", "");
} catch (e) { ok(false, "the detail renders before its fetch resolves", e && e.stack); }

// The fetch does not resolve under SSR, so the aligned grid is asserted
// against the source: the structure is what matters and it is static.
ok(/\["SIT", "UAT"\]\.map\(\(rg\) => \{[\s\S]{0,400}g\.stage === s && g\.region === rg/.test(GJSX),
   "each stage row renders SIT and UAT beside each other, filtered to that "
   + "stage — the alignment IS the comparison", "");
ok(/does not run this stage/.test(GJSX),
   "and a region that does not run a stage says so rather than showing a "
   + "blank box, which would read as a gate that failed to report", "");
ok(/\(STAGE\[a\]\?\.order \?\? 99\) - \(STAGE\[b\]\?\.order \?\? 99\)/.test(GJSX),
   "stages read in CI/CD order, not in the order rows came back", "");

// ---- every gate state renders, and non-blocking is marked ------------
for (const st of Object.keys(GATE_STATUS)) {
  let h = "";
  try {
    h = renderToStaticMarkup(<Gate t={t} g={g({ status: st })} first />);
    ok(h.includes(GATE_STATUS[st].label), `a ${st} gate renders its own word`,
       h.slice(0, 140));
  } catch (e) { ok(false, `a ${st} gate renders`, e && e.stack); }
  ok(!/NaN|undefined/.test(h), `a ${st} gate is clean`, h);
}
ok(/non-blocking/.test(renderToStaticMarkup(
     <Gate t={t} g={g({ status: "failed", blocking: "N" })} first />)),
   "a failing gate that does not block says so — drawing both the same "
   + "way is how a board teaches people that red means nothing", "");
ok(!/non-blocking/.test(renderToStaticMarkup(
     <Gate t={t} g={g({ status: "failed" })} first />)),
   "and a blocking one does not carry the chip", "");
ok(/blocking"\) == "Y"/.test(ROUTER),
   "the API counts a blocker as failed AND blocking", "");

// ---- the bar shows what is still to run -------------------------------
const bar = renderToStaticMarkup(<GateBar t={t}
  d={{ total: 14, passed: 2, failed: 0, warning: 0, running: 1, not_run: 11 }} />);
ok(bar.length > 0 && !/NaN/.test(bar),
   "the bar renders a mostly-unrun release — two passes out of fourteen "
   + "is not “doing well” and two green chips would say it was", bar.slice(0, 140));
ok(renderToStaticMarkup(<GateBar t={t} d={{ total: 0 }} />) === "",
   "and draws nothing rather than an empty bar when there are no gates", "");

// ---- evidence survives a payload that is not what we expected --------
ok(/CVE-2026-21714/.test(renderToStaticMarkup(
     <Evidence t={t} raw='{"cve":"CVE-2026-21714","severity":"CRITICAL"}' />)),
   "JSON evidence renders as key and value", "");
ok(/not json/.test(renderToStaticMarkup(<Evidence t={t} raw="not json at all" />)),
   "and evidence that will not parse is shown as text rather than dropped "
   + "for being the wrong shape", "");

// ---- the runtime section is never behind the board -------------------
ok(/<RuntimeSection t=\{t\} selection=\{selection\} \/>/.test(GJSX),
   "the runtime section is always on the page", "");
// A SIBLING of the conditional, not a child of either arm. Asserted as
// "follows the ternary's closing brace", because a looser search matches
// just as happily when the section has been moved inside one arm, which
// is exactly the regression it is meant to catch.
ok(/\/>\}\s*<RuntimeSection/.test(GJSX),
   "and sits outside the branch that swaps the board for a release \u2014 the "
   + "7am question does not depend on what is in flight",
   (GJSX.match(/.{0,80}<RuntimeSection.{0,40}/) || [])[0]);
ok(/promotionApi\.stats\("PROD"\)/.test(GJSX)
   && /promotionApi\.attention\(engine, "PROD"\)/.test(GJSX),
   "it asks for PROD explicitly rather than inheriting a selection", "");

// ---- performance runs in BOTH regions, at different depths -----------
const SIT_BLOCK = (SYNTH.match(/SIT_GATES = \[([\s\S]*?)\]/) || ["", ""])[1];
const UAT_BLOCK = (SYNTH.match(/UAT_GATES = \[([\s\S]*?)\]/) || ["", ""])[1];
ok(SIT_BLOCK.includes("explain_plan") && !SIT_BLOCK.includes("sla_volume"),
   "SIT has the cheap performance checks and not the volume SLA", SIT_BLOCK);
ok(UAT_BLOCK.includes("sla_volume") && !UAT_BLOCK.includes("explain_plan"),
   "UAT has the volume SLA and does not repeat EXPLAIN PLAN", UAT_BLOCK);

// ---- the banner is driven by the payload, never by a constant --------
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={{ synthetic: true }} />)
     .includes("Illustrative"),
   "the banner shows while the data is synthetic", "");
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={{ synthetic: false }} />) === "",
   "and disappears on its own once a real connector reports synthetic=false "
   + "— a hard-coded banner would still be apologising a year later", "");
ok(renderToStaticMarkup(<SyntheticBanner t={t} payload={null} />) === "",
   "and says nothing when the service did not answer", "");
ok(/"synthetic": True/.test(ROUTER), "the API is what makes the claim", "");

// ---- the schema keeps the two grains apart ----------------------------
ok(/CREATE TABLE guardrail_release/.test(DDL), "there is a release table", "");
ok(/CREATE TABLE guardrail_gate_run/.test(DDL), "and a gate-run table", "");
ok(/ALTER TABLE guardrail_events ADD \(region/.test(DDL),
   "and the runtime table gains a region rather than being replaced", "");
ok(/-1430/.test(DDL),
   "ORA-01430 is tolerated, so re-running after the column exists is not an "
   + "error", "");
ok(/UPDATE guardrail_events SET region = ''PROD'' WHERE region IS NULL/.test(DDL),
   "existing events backfill as PROD — they always were runtime events", "");
ok(/NVL\(region, 'PROD'\)/.test(ROUTER),
   "the region filter reads NULL as PROD rather than excluding it", "");
ok((ROUTER.match(/if not rows:/g) || []).length >= 2,
   "and both runtime endpoints fall back when the region column is absent "
   + "entirely — a pre-67 database must not report an empty estate", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nguardrails-regions assertions pass");
if (bad) process.exit(1);
