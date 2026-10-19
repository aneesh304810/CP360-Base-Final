// DevOps 360 — a live screen, not a documentation page.
//
// THE THINGS THAT GO WRONG HERE, and why each is pinned:
//
//   A BLANK IS NOT A ZERO. An environment with no deployment row must
//   render an em-dash. A zero or an empty string reads as a real version
//   and sends somebody looking for build 0.
//
//   THE HEADER MUST BE DERIVED FROM THE ROWS. The Hub dashboard this is
//   modelled on computes its summary from the list beneath it. Store the
//   numbers separately and the two disagree the first time a filter is
//   applied.
//
//   EMPTY MUST SAY WHY. With no publisher writing guardrail_deployment,
//   the list is empty. Showing a silent blank implies nothing was ever
//   deployed; it has to say the rows do not exist yet.
//
//   t.accent AND t.navy ARE SURFACES IN THE DARK THEME. tDark overrides
//   bg, panel, border, text, sub, textMuted and navy — nothing else — so
//   t.accent stays #0f4775 and is unreadable on #0f172a. The diagram
//   accent is chosen rather than taken from the theme.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import DevOps360, { PAL, NAMING, FlowFig, Dashboard, Detail, Context,
  Containers, Components, Versions, Promotion, Pipelines,
  Deployment, Built, BUILT, PENDING, PIPES, sp, Legend, PendingList, DB_PROCESS, IMG_PROCESS, Process } from "../src/DevOps360.jsx";
import { tLight, tDark } from "../src/bbhTheme.js";
import Overview, { ProcessFig, PR_STEPS, FOR_DEVELOPERS, FOR_REVIEWERS, GateFlow, GateFlowFig } from "../src/DevOpsOverview.jsx";
import { DOC_TABS, GATE_FLOW } from "../src/DevOps360.jsx";
import { OpsModel, Dashboards, ROLES, RACI, PROMOTION, EXCEPTION_RULES, CADENCE, EVIDENCE, REG_MAP, ATTEST, ENG_KPIS, SCORE_WEIGHTS, ALERTS, AUDIENCES } from "../src/DevOpsOps.jsx";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "DevOps360.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const ROOT = path.join(SRC, "..", "..");
const strip = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const JSX = strip("ui/src/DevOps360.jsx");

const ENVS = [
  { environment: "DEV", app: { app_tag: "v2026.10.03", build_number: "1212" },
    schema: { db_tag: "dev-1212" }, lanes_aligned: true },
  { environment: "SIT", app: { app_tag: "v2026.10.03", build_number: "1212" },
    schema: { db_tag: "sit-1212" }, lanes_aligned: true },
  { environment: "UAT", app: { app_tag: "v2026.10.01", build_number: "1201" },
    schema: { db_tag: "qc-1201" }, lanes_aligned: false, schema_ahead: true },
  { environment: "PROD", app: null, schema: null, lanes_aligned: false },
];
const HIST = [
  { deployment_id: "d1", environment: "DEV", lane: "app", release_id: "REL-A",
    build_number: "1212", app_tag: "v2026.10.03", status: "deployed" },
  { deployment_id: "d2", environment: "UAT", lane: "schema", release_id: "REL-B",
    build_number: "1201", db_tag: "qc-1201", status: "rolled_back" },
];

// ---- the dark-theme surface trap ------------------------------------
ok(PAL(tDark).ink === tDark.text && PAL(tDark).ink !== tDark.navy,
   "diagram ink is t.text — navy is a SURFACE in the dark theme", PAL(tDark).ink);
ok(PAL(tDark).fast !== tDark.accent && PAL(tLight).fast !== tLight.accent,
   "the diagram accent is chosen, not t.accent — tDark does not override "
   + "accent, so it stays #0f4775 and is a surface colour there", PAL(tDark).fast);
ok(PAL(tLight).fast === PAL(tDark).fast,
   "and one value clears both grounds rather than being flipped", PAL(tLight).fast);
ok(!/color:\s*t\.navy|fill=\{t\.navy\}/.test(JSX),
   "t.navy is never used as ink in this file", "");

// ---- the map is filled from rows, and a blank is not a zero ---------
const flow = renderToStaticMarkup(
  <FlowFig t={tLight} envs={ENVS} open={null} onOpen={() => {}} />);
ok(/v2026\.10\.01/.test(flow) && /qc-1201/.test(flow),
   "the map renders the tuple each environment actually holds, from the "
   + "rows it was handed — it is not a drawing of the system", "");
ok(/—/.test(flow) && !/>0</.test(flow) && !/undefined/.test(flow),
   "PROD has no deployment row in this fixture and renders an em-dash — a "
   + "zero would read as a real build number", "");
ok(/schema ahead/.test(flow),
   "a schema lane ahead of its application lane is labelled as the design "
   + "it is, not left for a reader to spot by comparing two builds", "");
const empty = renderToStaticMarkup(
  <FlowFig t={tLight} envs={[]} open={null} onOpen={() => {}} />);
ok(!/NaN|undefined/.test(empty), "and the map survives having no rows at all",
   (empty.match(/.{0,50}(NaN|undefined).{0,30}/) || [])[0]);

// ---- the header is derived from the rows ----------------------------
const dash = renderToStaticMarkup(
  <Dashboard t={tLight} live envs={ENVS} hist={HIST} rels={[
    { release_id: "r1", status: "blocked" }, { release_id: "r2", status: "released" },
  ]} onPick={() => {}} />);
ok(/>3<\/b>/.test(dash),
   "three of the four fixture environments have a deployment, and the header "
   + "says 3 — derived from the rows, not stored beside them", "");
ok(/>2<\/b>/.test(dash),
   "two have their lanes aligned, and the header says 2", "");
ok(/>1<\/b>/.test(dash), "one release is blocked, and the header says 1", "");
ok(/rolled_back/.test(dash),
   "a rolled-back deployment is shown as rolled back, not hidden — a board "
   + "that only lists successes cannot explain why production is behind", "");

// ---- empty says why --------------------------------------------------
const none = renderToStaticMarkup(
  <Dashboard t={tLight} live={false} envs={[]} hist={[]} rels={[]} onPick={() => {}} />);
// Scoped to a phrase that exists ONLY in the empty-list branch. The
// first version of this matched "guardrail_deployment", which also
// appears in the subtitle above — so it passed with the empty state
// deleted entirely.
ok(/this list stays empty/.test(none),
   "with no rows the list itself says the publisher has not written yet, "
   + "rather than showing a silent blank that reads as “nothing was ever "
   + "deployed”", "");
ok(/Nothing matches this filter/.test(renderToStaticMarkup(
     <Dashboard t={tLight} live envs={ENVS} hist={[]} rels={[]} onPick={() => {}} />)),
   "and when it IS live, an empty list means the filter excluded everything "
   + "— a different sentence, because it is a different fact", "");
ok(/export CSV/.test(dash) && /devops360-deployments\.csv/.test(JSX),
   "the rows are exportable, like the Hub component dashboard", "");

// ---- clicking a node opens the thing it names -----------------------
const det = renderToStaticMarkup(
  <Detail t={tLight} open="env:UAT" envs={ENVS} hist={HIST} onClose={() => {}} />);
ok(/QC · UAT/.test(det) && /qc-1201/.test(det),
   "opening an environment shows what that instance holds", "");
ok(/expand-and-contract/.test(det),
   "and explains a schema-ahead lane rather than flagging it as drift", "");
ok(/no producer/.test(renderToStaticMarkup(
     <Detail t={tLight} open="store" envs={ENVS} hist={HIST} onClose={() => {}} />)),
   "the release store panel admits which table has no producer instead of "
   + "listing all six as if they were equal", "");
ok(renderToStaticMarkup(
     <Detail t={tLight} open={null} envs={ENVS} hist={HIST} onClose={() => {}} />) === "",
   "and nothing is open by default", "");

// ---- the naming rule, over the rows ---------------------------------
const ENV = /(^|[^a-z])(dev|sit|qc|prod|uat)([^a-z]|$)/i;
for (const n of NAMING) {
  ok(ENV.test(n.example) === n.perEnv,
     `${n.thing}: environment in the name iff it is re-made per environment`,
     `${n.example} · perEnv=${n.perEnv}`);
}
ok(NAMING.filter((n) => n.perEnv).length === 1,
   "exactly one of the five is re-made per environment — the database tag",
   NAMING.filter((n) => n.perEnv).map((n) => n.thing).join(", "));

// ---- every reference panel still renders ----------------------------
for (const [name, P] of Object.entries({ Context, Containers, Components,
    Versions, Promotion, Pipelines, Deployment })) {
  for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
    const h = renderToStaticMarkup(<P t={t} />);
    ok(h.length > 400 && !/NaN|undefined|\[object Object\]/.test(h),
       `${name} renders cleanly in ${tn}`,
       (h.match(/.{0,50}(NaN|undefined).{0,30}/) || [])[0] || h.length);
  }
}
let svgs = 0, unlabelled = 0;
for (const P of [Context, Containers, Components, Versions, Promotion,
                 Pipelines, Deployment, () => <FlowFig t={tLight} envs={ENVS}
                   open={null} onOpen={() => {}} />]) {
  for (const m of renderToStaticMarkup(<P t={tLight} />).matchAll(/<svg\b[^>]*>/g)) {
    if (/aria-hidden="true"/.test(m[0])) continue;   // legend swatches are decoration
    svgs++;
    const lab = (m[0].match(/aria-label="([^"]*)"/) || [])[1] || "";
    if (!/role="img"/.test(m[0]) || lab.length < 60) unlabelled++;
  }
}
ok(svgs >= 9 && unlabelled === 0,
   "every figure carries role=img and a sentence describing it",
   `${unlabelled} of ${svgs} unlabelled`);

// ---- this screen does not redraw the gate matrix --------------------
const shell = renderToStaticMarkup(<DevOps360 t={tLight} />);
ok(!/Governance.*Performance.*Testing.*Security/s.test(dash),
   "the build × stage matrix is NOT duplicated on the dashboard — it is a "
   + "live screen in Quality Guardrails", "");
ok(/Quality Guardrails/.test(shell), "and the header points at it", "");
ok(/○ NO ROWS YET|● LIVE/.test(shell),
   "the screen states whether it is showing real rows", "");

// ---- registered -----------------------------------------------------
const APP = strip("ui/src/App.jsx"), NAV = strip("ui/src/AppShell.jsx");
ok(/import DevOps360 from "\.\/DevOps360\.jsx"/.test(APP)
   && /devops360: <DevOps360 t=\{t\} \/>/.test(APP), "App.jsx routes it", "");
ok(/\['devops360', 'DevOps 360'/.test(NAV), "AppShell.jsx has the nav entry", "");
ok(/promotionApi\.deployments\(\)/.test(JSX) && /promotionApi\.releases\(\)/.test(JSX),
   "and it reads the real endpoints rather than a local fixture", "");


// ---- the schema lives in each application's repo -----------------------
// Liquibase is a stage of the application job, applied from a db/changelog
// in the application's own repo, not a separate pipeline on its own cadence.
const SRCDIR = fs.existsSync("src/DevOps360.jsx") ? "src" : path.join("ui", "src");
// the page and its data module together: the rows moved to devopsData.js so the Overview reads the same ones
const devSrc = ["DevOps360.jsx", "devopsData.js", "DevOpsOverview.jsx"].map((f) => fs.readFileSync(path.join(process.cwd(), SRCDIR, f), "utf8")).join("\n");
ok(!/cp-liquibase/.test(devSrc) && !/Liquibase job/.test(devSrc), "no separate Liquibase repo or job remains on the page");
ok(/db\/changelog/.test(devSrc) && /Schema stage · Liquibase/.test(devSrc) && /first stage of the application job/.test(devSrc),
   "each application repo carries its own db/changelog; the schema stage is the first stage of the application job");
ok(/DATABASECHANGELOG_/.test(devSrc) && /exactly one owning application/.test(devSrc) && /Liquibase owns everything dbt does/.test(devSrc),
   "ownership is stated: a changelog table per application, one owner per object, dbt owns what it builds");
ok(NAMING.find((n) => n.thing === "Database tag").by === "schema stage of the application job, per environment", "the database tag is minted by the schema stage");


// ---- built today, against the design ---------------------------------
// The page draws the target. The pipeline on every pull request today is
// the five-gate Guardrails job behind a webhook bridge; the Built section
// reconciles the two so the figures are never read as production.
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const h = renderToStaticMarkup(<Built t={t} />);
  ok(h.length > 2000 && !/NaN|undefined|\[object Object\]/.test(h), `Built renders cleanly in ${tn}`, h.length);
}
const built = renderToStaticMarkup(<Built t={tLight} />);
ok(/Gate 1/.test(built) && /Gate 5/.test(built) && /sie-webhook-bridge/.test(built) && /Silver schema/.test(built)
   && /summary\.json/.test(built) && /DevSecOps shared library/.test(built),
   "the figure shows the bridge, the five gates, the summary files, the Silver upload and the shared library");
ok(BUILT.length >= 20 && BUILT.every((r) => ["built", "partial", "pending"].includes(r.status) && r.design.length === 2 && r.today),
   "every design row has a status of built, partial or pending", BUILT.length);
const cnt = (s) => BUILT.filter((r) => r.status === s).length;
ok(cnt("built") >= 6 && cnt("partial") >= 8 && cnt("pending") >= 6 && cnt("built") < cnt("partial") + cnt("pending"),
   "the honest shape: fewer rows built than partial or pending", `${cnt("built")}/${cnt("partial")}/${cnt("pending")}`);
ok(BUILT.some((r) => /Schema stage/.test(r.design[0]) && r.status === "built")
   && BUILT.some((r) => /Image pipeline/.test(r.design[0]) && r.status === "built")
   && BUILT.some((r) => /Stages 17–18/.test(r.design[0]) && r.status === "pending")
   && BUILT.some((r) => /Control catalogue/.test(r.design[0]) && r.status === "pending"),
   "the schema stage and the image pipeline are built; deployment and the control catalogue are pending — the job ends at the report");
ok(PENDING.length >= 8 && /control ID/i.test(PENDING[0][0]),
   "the pending list exists and the control ID is first, because everything else reads from it", PENDING.map((p) => p[0]).join(" | "));
ok(!/testbbh|apps\.ocp|https?:\/\/|:7990/.test(devSrc),
   "no hostname, URL or port from the guardrails repo is on the page — the endpoint stays in the runbook");
const shell2 = renderToStaticMarkup(<DevOps360 t={tLight} tab="map" />);
ok(!/built today · vs the design · pending/.test(shell2) && /Pending, in the order that unlocks the rest/.test(shell2),
   "no separate click-through: the pending list is on the page under the map");
ok(/What runs today is\s+not this figure yet/.test(renderToStaticMarkup(<Components t={tLight} />)),
   "the components figure carries the warning that the running job is a different shape");

// ---- status as a colour pattern, the same on every figure -------------
// Built, partial and pending are three styles, each with its word, and
// the map, the containers and the components figure all carry them.
const C = PAL(tLight);
ok(sp(C, "built").stroke === tLight.success && sp(C, "partial").stroke === tLight.warning
   && sp(C, "pending").strokeDasharray && !sp(C, "built").strokeDasharray,
   "built is the success colour, partial the warning colour, pending is dashed");
const leg = renderToStaticMarkup(<Legend t={tLight} />);
ok(/BUILT/.test(leg) && /PARTIAL/.test(leg) && /PENDING/.test(leg) && /runs today/.test(leg) && /nothing yet/.test(leg),
   "the legend names the three statuses in words as well as colour");
ok(/BUILT/.test(flow) && /PARTIAL/.test(flow) && /PENDING/.test(flow) && /not connected yet/.test(flow),
   "the map carries all three statuses, and the library says it is not connected");
ok(PIPES.length === 4 && PIPES[0][0] === "intake" && PIPES[0][3] === "built"
   && PIPES.find((p) => p[0] === "db")[3] === "built" && PIPES.find((p) => p[0] === "img")[3] === "built"
   && PIPES.find((p) => p[0] === "app")[3] === "partial",
   "four pipeline nodes: the intake, schema and image pipelines are built, the application partial");
const contAll = renderToStaticMarkup(<Containers t={tLight} />);
const cont = contAll.slice(contAll.indexOf('role="img"'));   // the figure, not the legend
ok((cont.match(/>PENDING</g) || []).length === 1 && (cont.match(/>BUILT</g) || []).length >= 9
   && /sie-webhook-bridge/.test(cont) && /not connected yet/.test(cont),
   "the containers figure colours every box, shows the bridge as built and the library as not connected");
const compAll = renderToStaticMarkup(<Components t={tLight} />);
const comp = compAll.slice(compAll.indexOf('role="img"'));   // the figure, not the legend
ok((comp.match(/>BUILT</g) || []).length === 4 && (comp.match(/>PENDING</g) || []).length === 2
   && /DevSecOps thresholds not connected/.test(comp),
   "inside the job: checkout with the changelog, governance, performance and testing are built; security is partial without the library; builder and deployer pending");
ok(/intake/.test(renderToStaticMarkup(<Detail t={tLight} open="intake" envs={ENVS} hist={HIST} onClose={() => {}} />))
   && /Built today, against the design/.test(renderToStaticMarkup(<Detail t={tLight} open="intake" envs={ENVS} hist={HIST} onClose={() => {}} />)),
   "the intake node opens the stage-by-stage reconciliation");
ok(BUILT.some((r) => /DevSecOps shared library/.test(r.design[0]) && r.status === "pending")
   && /Connect the DevSecOps shared library/.test(PENDING[1][0]),
   "the DevSecOps library is a pending row and the second item of work");
ok(/>built</.test(renderToStaticMarkup(<Pipelines t={tLight} />)) && /1 · Application data pipeline[^]*?>partial</.test(renderToStaticMarkup(<Pipelines t={tLight} />)) && renderToStaticMarkup(<PendingList t={tLight} />).length > 800,
   "the swimlane headings carry their status, and the pending list renders on its own");


// ---- the two built pipelines, as process --------------------------------
// Every step names who does it, what has to be true to pass, and what it
// writes — so the swimlane is not the only record of the process.
for (const P of [DB_PROCESS, IMG_PROCESS]) {
  ok(P.steps.length >= 6 && P.steps.every((st) => st.length === 5 && st.every((c) => c && c.length > 0)) && P.rules.length >= 3,
     `${P.title}: every step has who, what, a pass condition and a writer`, P.steps.map((x) => x[0]).join(" | "));
}
ok(DB_PROCESS.steps.some((st) => /DATABASECHANGELOG_\{APP\}/.test(st[2])) && DB_PROCESS.steps.some((st) => /guardrail_changeset_applied/.test(st[4]))
   && DB_PROCESS.steps.some((st) => /deploy refuses/.test(st[3])),
   "the schema process names the per-application changelog table, the applied rows, and the deploy that checks the tag");
ok(IMG_PROCESS.steps.some((st) => /CRITICAL fails/.test(st[3])) && IMG_PROCESS.steps.some((st) => /unsigned image never/.test(st[3]))
   && IMG_PROCESS.steps[IMG_PROCESS.steps.length - 1][0].includes("Bump PR"),
   "the image process blocks on CRITICAL, refuses unsigned images, and ends with the bump into every consumer");
const dbDetail = renderToStaticMarkup(<Detail t={tLight} open="db" envs={ENVS} hist={HIST} onClose={() => {}} />);
ok(/The process · Database · Liquibase/.test(dbDetail) && /Passes when/.test(dbDetail)
   && /The process · Infrastructure image/.test(renderToStaticMarkup(<Pipelines t={tLight} />)),
   "the process table opens with the swimlane on the map and sits under it in the reference");
ok(renderToStaticMarkup(<Process t={tDark} p={IMG_PROCESS} />).length > 1500, "the process table renders in dark");

// ---- the operating model and the compliance dashboard --------------------
// Two reference cards from the Guardrails documentation, coloured by what
// exists. Almost all of it is pending, and the cards must say so rather than
// draw a finished governance system; the webhook host stays off the page.
const opsSrc = fs.readFileSync(path.join(process.cwd(), fs.existsSync("src/DevOpsOps.jsx") ? "src/DevOpsOps.jsx" : "ui/src/DevOpsOps.jsx"), "utf8");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const a = renderToStaticMarkup(<OpsModel t={t} />), b = renderToStaticMarkup(<Dashboards t={t} />);
  ok(a.length > 8000 && b.length > 6000 && !/NaN|undefined|\[object Object\]/.test(a + b), `operating model and dashboard render cleanly in ${tn}`, `${a.length}/${b.length}`);
}
const ops = renderToStaticMarkup(<OpsModel t={tLight} />), dsh = renderToStaticMarkup(<Dashboards t={tLight} />);
ok((ops.match(/role="img"/g) || []).length === 2 && /review flow in ten boxes/.test(ops) && /exception lifecycle in six steps, all pending/.test(ops),
   "the operating model draws the review flow and the exception lifecycle, each with a sentence");
ok(ROLES.length === 7 && RACI.length === 15 && RACI.every((r) => r.length === 8) && RACI.every((r) => r.slice(1).some((c) => /A/.test(c))),
   "seven roles, fifteen RACI rows, every row with exactly one accountable column at least", RACI.filter((r) => !r.slice(1).some((c) => /A/.test(c))).map((r) => r[0]));
ok(/Security is accountable for severity thresholds, not the Platform Owner/.test(ops) && /Governance is accountable for exceptions/.test(ops), "the two deliberate RACI choices are stated");
ok(PROMOTION.length === 9 && PROMOTION.every((r) => r.length === 7 && ["built", "partial", "pending"].includes(r[6])) && !PROMOTION.some((r) => r[6] === "built"),
   "the promotion matrix has nine rows across four environments, each with today's status, and none is fully built", PROMOTION.map((r) => r[6]).join(","));
ok(/same artefact SHA is promoted at each step/.test(ops) && /hotfix\/\*/.test(ops) && /every blocking control still runs/.test(ops), "promotion is by SHA, and a hotfix skips nothing blocking");
ok(EXCEPTION_RULES.length === 5 && /Maximum 90 days/.test(EXCEPTION_RULES[0][0]) && /CP-DEP-040/.test(ops) && /CP-DEP-041/.test(ops), "five exception rules, 90 days first, with their control IDs");
ok(CADENCE.length === 5 && CADENCE.filter((r) => r[3] === "pending").length === 4 && /advisory first for one sprint/.test(ops), "five cadences, four pending; a new blocking control lands as advisory first");
ok(EVIDENCE.length === 11 && EVIDENCE.filter((r) => r[3] === "pending").length >= 7 && /seven years, immutable, keyed by commit SHA/.test(ops),
   "the eleven evidence questions, most pending today, and the retention rule", EVIDENCE.map((r) => r[3]).join(","));
ok(REG_MAP.length === 8 && /supporting<\/b> controls/.test(ops) && /not a compliance claim/.test(ops), "the regulatory mapping carries its own caveat");
ok(ATTEST.length === 3 && /none of them exists today/.test(ops), "three attestations, honestly absent");
ok(/Gate 1/.test(ops) && /Webhook intake/.test(ops) && /else <span[^>]*>pass<\/span> if at least one passes/.test(ops), "the control matrix: gates, bridge controls and the aggregation rule");
ok((dsh.match(/role="img"/g) || []).length === 1 && /Everything past Silver is pending/.test(dsh) && />BUILT</.test(dsh) && />PARTIAL</.test(dsh) && />PENDING</.test(dsh),
   "the dashboard data flow is coloured: built to Silver, pending beyond");
ok(AUDIENCES.length === 5 && /Grafana/.test(dsh) && /Power BI/.test(dsh) && /90 days hot/.test(dsh) && /7 years/.test(dsh), "two audiences with their refresh, grain and retention");
ok(ENG_KPIS.length === 15 && ENG_KPIS.every((r) => r.length === 4) && /Review latency p50/.test(dsh) && /Mean time to green/.test(dsh) && /Bridge trigger success rate/.test(dsh),
   "fifteen engineering KPIs in the design, the five measurable today, and the bridge telemetry");
ok(Math.abs(SCORE_WEIGHTS.reduce((a, [, w]) => a + w, 0) - 1) < 1e-9 && SCORE_WEIGHTS[0][0] === "security" && /0\.30 × security/.test(dsh),
   "the score weights sum to one, security heaviest, and the formula is printed");
ok(/Waived controls count as failures in the score and as passes in the gate/.test(dsh) && /Advisory controls are excluded/.test(dsh), "the two scoring rules that keep the incentive on remediation");
ok(ALERTS.length === 8 && ALERTS.filter((r) => r[3]).length === 2 && (dsh.match(/PAGES A HUMAN/g) || []).length === 2 && /cp_guardrail_exception/.test(dsh) && /database constraint/.test(dsh),
   "eight alert conditions, two page a human, the rest are digests; the 90-day cap is a constraint");
ok(!/testbbh|apps\.ocp|https?:\/\/|:7990|#cp-/.test(opsSrc), "no hostname, URL, port or channel name from the guardrails docs is on the page");
const shell3 = renderToStaticMarkup(<DevOps360 t={tLight} />);
ok(/roles · review · promotion · exceptions · evidence/.test(shell3) && /two audiences · KPIs · score · alerts/.test(shell3), "both cards are offered from the reference row");

// ---- the documentation shape: an Overview first, then the chapters -----
// The page is the team's DevOps documentation. The overview is read from
// the same data module as the map, so the two cannot disagree; the tab bar
// names every chapter with a line, and the default tab is the overview.
ok(DOC_TABS.length === 6 && DOC_TABS[0][0] === "overview" && DOC_TABS.every((d) => d.length === 3 && d[2].length > 20),
   "six chapters, overview first, each with a line that says what it holds", DOC_TABS.map((d) => d[0]).join(","));
const home = renderToStaticMarkup(<DevOps360 t={tLight} />);
ok(/aria-selected="true"[^>]*>[^]*?Overview/.test(home) && /The process in one picture/.test(home) && /Liquibase in every application repository/.test(home),
   "the page opens on the overview");
for (const [k] of DOC_TABS) {
  const h = renderToStaticMarkup(<DevOps360 t={tLight} tab={k} />);
  ok(h.length > 3000 && !/NaN|undefined|\[object Object\]/.test(h), `the ${k} tab renders cleanly`, h.length);
}
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const h = renderToStaticMarkup(<Overview t={t} onGo={() => {}} />);
  ok(h.length > 12000 && !/NaN|undefined|\[object Object\]/.test(h), `the overview renders cleanly in ${tn}`, h.length);
}
const ov = renderToStaticMarkup(<Overview t={tLight} onGo={() => {}} />);
ok((ov.match(/role="img"/g) || []).length === 2 && /three lanes/.test(ov) && /Liquibase schema stage first, built/.test(ov) && /the deploy to DEV, SIT, QC and PROD, pending/.test(ov),
   "the one-picture figure carries a sentence that names the three lanes and the status of each");
const nb = BUILT.filter((r) => r.status === "built").length, np_ = BUILT.filter((r) => r.status === "partial").length, nq = BUILT.filter((r) => r.status === "pending").length;
ok(new RegExp(`Of the design.{1,8}s ${BUILT.length} reconciled rows, ${nb} are built, ${np_} partial and ${nq} pending`).test(ov),
   "the honest-shape counts are derived from BUILT, not typed", `${BUILT.length}/${nb}/${np_}/${nq}`);
ok(PIPES.every(([, title]) => ov.includes(title.replace(/&/g, "&amp;"))) && /There is no separate database job/.test(ov) && /DATABASECHANGELOG_\{APP\}/.test(ov)
   && DB_PROCESS.rules.every((r) => ov.includes(r.slice(0, 40))) && /Passes when: /.test(ov),
   "the four pipeline cards, and the Liquibase section reads its six steps and three rules from DB_PROCESS");
ok(IMG_PROCESS.steps.every(([step]) => ov.includes(step.replace(/^\d+ · /, ""))) && NAMING.every((r) => ov.includes(r.example)) && PENDING.every(([a]) => ov.includes(a)),
   "the image steps, the naming table and the pending list are the page's own rows");
ok(PR_STEPS.length === 10 && PR_STEPS.filter((r) => r[4] === "pending").length === 1 && /Merge and deploy/.test(ov) && /Deployment is manual today/.test(ov),
   "the pull request walk-through has ten steps and only the deploy is pending, said plainly");
ok(FOR_DEVELOPERS.length === 5 && FOR_REVIEWERS.length === 4 && /If you write models and DAGs/.test(ov) && /If you review or approve/.test(ov) && /advisory first for one sprint/.test(ov),
   "a list for developers, a list for reviewers, and the advisory-first rule");
// ---- the gate flow, expanded --------------------------------------------
// Five gates, each with its checks, report, rule, the design stages it
// stands in for and what it does not yet do; the stages before and after;
// the status words and the aggregate rule. Data first, then the figure.
ok(GATE_FLOW.gates.length === 5 && GATE_FLOW.gates.every((g, i) => g.n === i + 1 && g.checks.length >= 3 && /^reports\/gate\d\//.test(g.report) && g.rule && g.covers.length >= 1 && g.missing.length >= 1),
   "five gates in order, each with at least three checks, a report path, a rule, what it stands in for and what is missing");
ok(GATE_FLOW.before.length === 4 && GATE_FLOW.after.length === 3 && GATE_FLOW.semantics.map(([k]) => k).join(",") === "pass,fail,skip,unknown"
   && /fail if any gate failed; else pass if at least one gate passed; else skip/.test(GATE_FLOW.aggregate),
   "four stages before, three after, the four status words and the aggregate rule");
ok(GATE_FLOW.params.some(([k]) => k === "SKIP_GATE4") && GATE_FLOW.params.some(([k]) => k === "FAST_FAIL") && /skip/.test(GATE_FLOW.gates[3].rule),
   "the skip and fast-fail parameters are named and Gate 4 says it skips");
ok(GATE_FLOW.gates[4].status === "partial" && GATE_FLOW.gates[4].missing.some((m) => /DevSecOps/.test(m)) && GATE_FLOW.gates[0].missing.some((m) => /gitleaks/.test(m)),
   "security is partial without the shared library; the secrets scan is missing from code quality");
const gf = renderToStaticMarkup(<GateFlow t={tLight} />);
ok((gf.match(/role="img"/g) || []).length === 1 && /Gate 1 Code quality with 4 checks/.test(gf) && /Gate 5 Security scan with 3 checks/.test(gf) && /a failed gate skips the rest/.test(gf),
   "the expanded figure carries a sentence that counts every gate's checks");
ok(/BEFORE THE GATES/.test(gf) && /AFTER THE GATES/.test(gf) && /STANDS IN FOR/.test(gf) && />BUILT</.test(gf) && />PARTIAL</.test(gf) && />PENDING</.test(gf),
   "the figure shows the stages before and after and colours what each gate stands in for");
ok(GATE_FLOW.gates.every((g) => gf.includes(g.report) && g.checks.every((c) => gf.includes(c))) && /GUARDRAILS_CONFIG/.test(gf) && /Overall status:/.test(gf),
   "every gate's report path and every check appear in the detail, with the parameters, environment and the overall rule");
ok(renderToStaticMarkup(<GateFlowFig t={tDark} />).length > 3000 && /The gate flow, expanded/.test(ov) && gf.length > 6000,
   "the gate flow renders in dark and sits in the overview");
ok(!/testbbh|apps\.ocp|https?:\/\/|:7990|#cp-/.test(devSrc), "no hostname, URL, port or channel on the overview or in the data module");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndevops360 assertions pass");
if (bad) process.exit(1);
