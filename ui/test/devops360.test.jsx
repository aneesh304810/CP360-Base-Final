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
  Deployment, Built, BUILT, PENDING, PIPES, sp, Legend, PendingList } from "../src/DevOps360.jsx";
import { tLight, tDark } from "../src/bbhTheme.js";

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
const devSrc = fs.readFileSync(path.join(process.cwd(), fs.existsSync("src/DevOps360.jsx") ? "src/DevOps360.jsx" : "ui/src/DevOps360.jsx"), "utf8");
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
ok(cnt("built") >= 4 && cnt("partial") >= 8 && cnt("pending") >= 6 && cnt("built") < cnt("partial") + cnt("pending"),
   "the honest shape: fewer rows built than partial or pending", `${cnt("built")}/${cnt("partial")}/${cnt("pending")}`);
ok(BUILT.some((r) => /Schema stage/.test(r.design[0]) && r.status === "pending")
   && BUILT.some((r) => /Stages 17–18/.test(r.design[0]) && r.status === "pending")
   && BUILT.some((r) => /Control catalogue/.test(r.design[0]) && r.status === "pending"),
   "the schema stage, deployment and the control catalogue are stated as pending — the job ends at the report");
ok(PENDING.length >= 8 && /control ID/i.test(PENDING[0][0]),
   "the pending list exists and the control ID is first, because everything else reads from it", PENDING.map((p) => p[0]).join(" | "));
ok(!/testbbh|apps\.ocp|https?:\/\/|:7990/.test(devSrc),
   "no hostname, URL or port from the guardrails repo is on the page — the endpoint stays in the runbook");
const shell2 = renderToStaticMarkup(<DevOps360 t={tLight} />);
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
   && PIPES.find((p) => p[0] === "db")[3] === "pending" && PIPES.find((p) => p[0] === "img")[3] === "pending"
   && PIPES.find((p) => p[0] === "app")[3] === "partial",
   "four pipeline nodes: the intake is built, the application partial, schema and image pending");
const cont = renderToStaticMarkup(<Containers t={tLight} />);
ok((cont.match(/>PENDING</g) || []).length >= 3 && (cont.match(/>BUILT</g) || []).length >= 4
   && /sie-webhook-bridge/.test(cont) && /not connected yet/.test(cont),
   "the containers figure colours every box, shows the bridge as built and the library as not connected");
const compAll = renderToStaticMarkup(<Components t={tLight} />);
const comp = compAll.slice(compAll.indexOf('role="img"'));   // the figure, not the legend
ok((comp.match(/>BUILT</g) || []).length === 3 && (comp.match(/>PENDING</g) || []).length === 2
   && /DevSecOps thresholds not connected/.test(comp),
   "inside the job: governance, performance and testing run as gates; security is partial without the library; builder and deployer pending");
ok(/intake/.test(renderToStaticMarkup(<Detail t={tLight} open="intake" envs={ENVS} hist={HIST} onClose={() => {}} />))
   && /Built today, against the design/.test(renderToStaticMarkup(<Detail t={tLight} open="intake" envs={ENVS} hist={HIST} onClose={() => {}} />)),
   "the intake node opens the stage-by-stage reconciliation");
ok(BUILT.some((r) => /DevSecOps shared library/.test(r.design[0]) && r.status === "pending")
   && /Connect the DevSecOps shared library/.test(PENDING[1][0]),
   "the DevSecOps library is a pending row and the second item of work");
ok(/>pending</.test(renderToStaticMarkup(<Pipelines t={tLight} />)) && renderToStaticMarkup(<PendingList t={tLight} />).length > 800,
   "the swimlane headings carry their status, and the pending list renders on its own");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndevops360 assertions pass");
if (bad) process.exit(1);
