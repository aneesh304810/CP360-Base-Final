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
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import Guardrails, { SyntheticBanner, FlowDiagram, StageCell, GateBar,
  GateList, Gate, Evidence, GLYPH, verdict, Ladder,
  RiskBar } from "../src/Guardrails.jsx";
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
const DDL = fs.readFileSync(path.join(ROOT, "sql/68_guardrail_deployment.sql"), "utf8");
const DDL2 = DDL;
const DDL67 = fs.readFileSync(path.join(ROOT, "sql/67_guardrail_promotion.sql"), "utf8");
const API_ADDITIONS = strip("ui/src/guardrails_api_additions.js");
const DDL3 = fs.readFileSync(path.join(ROOT, "sql/69_guardrail_changeset.sql"), "utf8");

// ---- four tabs, and SIT/UAT share one component ----------------------
ok(/const TABS = \["Overview", "Releases", "SIT", "UAT", "PROD"\]/.test(GJSX),
   "Overview, Releases, SIT, UAT, PROD", "");

// ---- the release dashboard answers the INVERSE question ------------
// /promotion says how far a release has got; a release dashboard asks
// what an environment contains. The newest release is usually blocked
// and therefore deployed nowhere, so one cannot stand in for the other.
ok(/tab === "Releases" && <Releases/.test(GJSX),
   "there is a Releases tab", "");
ok(/promotionApi\.deployments\(\)/.test(GJSX),
   "fed by deployments, not by the promotion board", "");
ok(/def deployments\(/.test(ROUTER), "the endpoint exists", "");
ok(/current\.setdefault\(key, r\)/.test(ROUTER),
   "current is DERIVED, not read from a flag — a boolean needs updating in "
   + "two places per deploy and is wrong the first time one half-fails", "");
// The status filter is the load-bearing half. Without it a rolled-back or
// failed deployment is reported as what is running, which is the one
// answer this screen must never give.
ok(/if r\.get\("status"\) != "deployed":\s*\n\s*continue/.test(ROUTER),
   "and only a row whose status is 'deployed' can be current — a rolled-back "
   + "deploy reported as live is worse than no dashboard",
   (ROUTER.match(/.{0,80}setdefault.{0,40}/) || [])[0]);
ok(/"lanes_aligned"/.test(ROUTER) && /"schema_ahead"/.test(ROUTER),
   "and the API states whether the two lanes agree, rather than leaving a "
   + "reader to compare two build numbers by eye", "");
ok(/expand step, deployed early/.test(GJSX),
   "a schema ahead of its application reads as the design it is, not as "
   + "drift", "");

// ---- three identifiers, kept apart ---------------------------------
for (const col of ["build_number", "app_tag", "commit_sha", "db_tag"]) {
  ok(new RegExp(col).test(DDL), `the deployment table carries ${col}`, "");
}
ok(/lane\s+VARCHAR2\(10\)/.test(DDL),
   "and a lane, because the two repositories deploy independently", "");

// ---- QC is an alias, not a rename ----------------------------------
// Every row already written uses UAT. Renaming the column to match a
// spoken habit would break all of them.
ok(/alias: "QC"/.test(API_ADDITIONS),
   "UAT carries QC as an alias", "");
ok(/env_alias/.test(DDL2), "and the register stores it", "");
ok(!/"QC"\s*:/.test(API_ADDITIONS),
   "QC is never a region code of its own", "");
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
// A PARTIALLY RUN STAGE MUST NOT READ AS FULLY PASSED. One gate passed
// and one still to run printed the stage total beside a tick — "2" reads
// as "2 passed", the inverse of the truth. The UAT testing stage of the
// blocked positions release is exactly that case.
const partial = renderToStaticMarkup(<StageCell t={t}
  c={{ status: "passed", total: 2, passed: 1, failed: 0, warning: 0,
       running: 0, not_run: 1 }} />);
ok(partial.includes("1/2"),
   "a stage with 1 of 2 gates passed renders the fraction, not the total",
   partial);
ok(!/>\s*2\s*<\/span><\/span>/.test(partial),
   "and never the bare gate count beside a tick", partial);
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
ok(/CREATE TABLE guardrail_release/.test(DDL67)
   && /CREATE TABLE guardrail_gate_run/.test(DDL67),
   "release and gate-run tables exist", "");
ok(/NVL\(region, 'PROD'\)/.test(ROUTER),
   "the runtime filter reads NULL as PROD rather than excluding it", "");
ok((ROUTER.match(/if not rows:/g) || []).length >= 2,
   "and both runtime endpoints fall back on a pre-67 database", "");

// ---- comparing two environments -------------------------------------
// "5 changesets ahead" is not a fact anyone can act on. One of them may
// be a DROP COLUMN and one a back-fill with no rollback block, and that
// is the difference between a promotion somebody signs and one they stop.
ok(/def compare\(/.test(ROUTER), "there is a compare endpoint", "");
ok(/<Compare t=\{t\} \/>/.test(GJSX), "and the Releases tab renders it", "");
ok(/useState\("PROD"\)[\s\S]{0,120}useState\("UAT"\)/.test(GJSX),
   "defaulting to PROD to UAT — the promotion somebody is about to approve",
   "");

// Both lanes, because they are different distances apart.
ok(/"app": \{"releases": app_rows/.test(ROUTER)
   && /"schema": \{"ahead": ahead/.test(ROUTER),
   "it compares the application and the schema separately", "");
ok(/from_b < n <= to_b/.test(ROUTER),
   "the application delta is bounded by the two deployed builds", "");

// BOTH LANES ARE NAMED BY THEIR TAG. A build number is the pipeline run;
// the tag is what somebody checks out to reproduce the version, and two
// environments can share a build number and sit on different tags after
// a re-tag. The build stays, underneath, because it is what the gate
// matrix is keyed by.
ok(/"from_tag": \(side\["from"\]\["app"\] or \{\}\)\.get\("app_tag"\)/.test(ROUTER),
   "the application lane carries its tag, not only its build", "");
ok(/a=\{d\.app\.from_tag\}/.test(GJSX) && /b=\{d\.app\.to_tag\}/.test(GJSX)
   && /a=\{d\.schema\.from_tag\}/.test(GJSX),
   "and both lanes lead with their tag in the version matrix, build "
   + "underneath", "");
ok(/in_b - in_a/.test(ROUTER),
   "and the schema delta is a set difference over what each environment has "
   + "APPLIED, which is what Liquibase itself compares", "");
ok(/behind_count/.test(ROUTER)
   && /\{d\.schema\.behind_count\} behind/.test(GJSX)
   && !/behind_count > 0 &&/.test(GJSX),
   "a target that is behind as well as ahead is reported, and printed even "
   + "when it is zero — a one-way diff hides a changeset the source has and "
   + "the target lost, and so does a line that only appears when it does",
   "");

// ---- the two pure helpers are RUN, not read -------------------------
// Both of the assertions this replaces checked that a line of source
// EXISTED. Both were re-broken on purpose -- `lossy = []` three lines
// above `len(lossy)`, and `_bnum` left in the file after its call sites
// switched to string comparison -- and neither fired. A guard that
// cannot fail is worse than no guard, because it is counted. So the
// functions are lifted out of the router and executed against rows.
const PYSRC = fs.readFileSync(path.join(ROOT, "api/app/routers_guardrails.py"), "utf8");
const HELPERS = PYSRC.slice(PYSRC.indexOf("def _risk(ahead):"),
                            PYSRC.indexOf('@router.get("/compare")'));
ok(/def _risk\(ahead\)/.test(HELPERS) && /def _bnum\(v\)/.test(HELPERS),
   "both helpers are pure and module-level, so a test can call them",
   HELPERS.slice(0, 80));

const py = (expr) => JSON.parse(execFileSync("python3",
  ["-c", `${HELPERS}\nimport json\nprint(json.dumps(${expr}))`],
  { encoding: "utf8" }));
const rows = (v) => `json.loads(${JSON.stringify(JSON.stringify(v))})`;

// Build numbers sort numerically. As text "984" > "1201".
const bn = py(`[_bnum("984") < _bnum("1201"), _bnum(" 1201 "), _bnum(None), _bnum("rc-7")]`);
ok(bn[0] === true,
   "build 984 sorts below 1201 -- compared as text it does not, and the "
   + "application delta would silently contain the wrong releases", bn[0]);
ok(bn[1] === 1201, "a padded build number still parses", bn[1]);
ok(bn[2] === -1 && bn[3] === -1,
   "and one that cannot parse sorts below every real build rather than "
   + "throwing mid-request", bn.slice(2));

// ---- rollback is two questions, so two counts -----------------------
// The row that matters is the DROP COLUMN: it DECLARES a rollback and
// running it does not bring the data back. If the two questions are
// collapsed into one "rollbackable" flag, that row joins the no-rollback
// count and reads as the same problem as a missing block -- which is how
// a promotion is approved on a rollback that restores an empty column.
const GAP = [
  { changeset_id: "c1", change_type: "ddl_add", rollback_declared: "Y", data_safe: "Y" },
  { changeset_id: "c2", change_type: "dml", rollback_declared: "N", data_safe: "N" },
  { changeset_id: "c3", change_type: "ddl_drop", rollback_declared: "Y", data_safe: "N" },
];
const risk = py(`_risk(${rows(GAP)})`);
ok(risk.no_rollback === 1,
   "only the changeset with no rollback block is counted as having none",
   JSON.stringify(risk));
ok(risk.rollback_not_data_safe === 1,
   "and the drop -- rollback declared, data not recoverable -- is counted "
   + "separately, not folded in with it", JSON.stringify(risk));
ok(risk.destructive === 1, "the drop is also flagged destructive by type",
   risk.destructive);
ok(/no rollback block/.test(risk.headline)
   && /without the data/.test(risk.headline),
   "and the headline names both problems rather than leaving a reader to "
   + "add two numbers up", risk.headline);

// Defaults are the cautious direction: an unanswered "is there a
// rollback" is no rollback, and an unanswered "is it safe" is safe only
// once a rollback exists to be safe about.
const dflt = py(`_risk(${rows([{ changeset_id: "c4", change_type: "dml" }])})`);
ok(dflt.no_rollback === 1 && dflt.rollback_not_data_safe === 0,
   "a changeset that declares nothing counts as having no rollback, and is "
   + "not double-counted as a lossy one", JSON.stringify(dflt));

const clean = py(`_risk(${rows([GAP[0]])})`);
ok(clean.no_rollback === 0 && clean.rollback_not_data_safe === 0
   && /Nothing in this gap is irreversible/.test(clean.headline),
   "a gap with nothing irreversible in it says so, rather than showing "
   + "three zeroes and leaving the reader to interpret them",
   JSON.stringify(clean));

// ---- rollback is two questions, so two flags ------------------------
ok(/rollback_declared/.test(DDL3) && /data_safe/.test(DDL3),
   "the changeset table asks both whether a rollback exists AND whether it "
   + "returns the data", "");
ok(/"risk": risk/.test(ROUTER),
   "and the comparison carries that classification rather than leaving each "
   + "caller to re-derive it from the flags", "");
// RUN, not read. The two kinds of irreversible must reach the screen as
// DIFFERENT WORDS; a file that merely contains both strings proves
// nothing about which row gets which.
const NO_RB = verdict({ rollback_declared: "N", data_safe: "N" });
const LOSSY = verdict({ rollback_declared: "Y", data_safe: "N" });
const FINE  = verdict({ rollback_declared: "Y", data_safe: "Y" });
ok(NO_RB.bad && LOSSY.bad && !FINE.bad,
   "both kinds of irreversible are flagged and the additive one is not",
   JSON.stringify([NO_RB.bad, LOSSY.bad, FINE.bad]));
ok(NO_RB.label !== LOSSY.label && NO_RB.why !== LOSSY.why,
   "and they reach the screen as DIFFERENT words — a drop that recreates "
   + "an empty column is not the same problem as a back-fill with nothing "
   + "to run", `${NO_RB.label} / ${LOSSY.label}`);
ok(LOSSY.rollback === true && LOSSY.recovers === false,
   "the drop answers Y to 'is there a rollback' and N to 'will it help' — "
   + "one flag cannot hold that", JSON.stringify(LOSSY));
ok(verdict({}).bad === true && verdict({}).rollback === false,
   "a changeset that declares nothing is treated as having no rollback, "
   + "not as safe", JSON.stringify(verdict({})));

// ---- the two pictures render, and are not colour alone ---------------
const LAD = renderToStaticMarkup(<Ladder t={t} from="PROD" rows={[
  { environment: "PROD", applied: 61, shared: 61, ahead: 0, total: 68 },
  { environment: "UAT", applied: 66, shared: 61, ahead: 5, total: 68 },
]} />);
ok(/61/.test(LAD) && /\+5/.test(LAD),
   "each ladder segment is direct-labelled with its own count", "");
ok(/66 \/ 68/.test(LAD) && /61 \/ 68/.test(LAD),
   "and carries its own position against the changelog in figures", "");
// THE DENOMINATOR, CHECKED AS GEOMETRY. Printing "61 / 68" beside a bar
// says nothing about how long the bar is. Both rows share 61 changesets
// with PROD, so their shared segments must come out the SAME length, and
// no segment may exceed the track — which is what a per-environment
// denominator breaks first.
const W = [...LAD.matchAll(/width:\s*([\d.]+)%/g)].map((m) => +m[1]);
ok(W.length === 3, "three segments are drawn: PROD shared, UAT shared, "
   + "UAT ahead", JSON.stringify(W));
ok(W.every((w) => w > 0 && w <= 100),
   "no segment runs past the end of its track", JSON.stringify(W));
ok(Math.abs(W[0] - W[1]) < 0.01,
   "the same 61 shared changesets are the same length on both bars — a "
   + "per-environment denominator would draw three full bars out of three "
   + "different positions", JSON.stringify(W));
ok(Math.abs(W[1] + W[2] - 100 * 66 / 68) < 0.01,
   "and UAT's two segments together are its 66 of 68", JSON.stringify(W));
ok(/margin-left:2px/.test(LAD),
   "stacked segments are separated by a 2px surface gap, not a rule", LAD.slice(0, 200));
ok(!/NaN|undefined/.test(LAD), "the ladder is clean", LAD);

const RB = renderToStaticMarkup(<RiskBar t={t} good={3} bad={2} />);
ok(/3 reversible/.test(RB) && /2 not/.test(RB),
   "the reversibility bar labels both segments — green and red do not "
   + "separate under deuteranopia", "");
ok(/repeating-linear-gradient/.test(RB),
   "and the irreversible segment is hatched, so it survives greyscale, "
   + "print and forced colours", "");
ok(!/reversible/.test(renderToStaticMarkup(<RiskBar t={t} good={0} bad={2} />)),
   "a segment with nothing in it is not drawn as an empty label", "");
ok(/CREATE TABLE guardrail_changeset_applied/.test(DDL3),
   "applied-per-environment mirrors DATABASECHANGELOG, so a real ingester "
   + "has somewhere to put the rows unreshaped", "");

// An IN list is bounded at 1000 and a promotion window can exceed it.
ok(/range\(0, len\(ids\), 500\)/.test(ROUTER),
   "the changeset lookup is chunked", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nguardrails-regions assertions pass");
if (bad) process.exit(1);
