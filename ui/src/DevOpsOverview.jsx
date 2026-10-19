// DevOps 360 · Overview. The first tab, written for a senior team member and
// a developer on the same page: the process in one picture, what is built,
// a pull request step by step, Liquibase as the schema stage of every
// application job, images, names, what it means for you, and what comes
// next. Every list here is READ FROM devopsData.js — the same rows the map,
// the swimlanes and the reconciliation draw — so the overview cannot say
// something the rest of the page does not.
import React from "react";
import { PAL, sp, Legend } from "./devopsStatus.jsx";
import { NAMING, PIPES, DB_PROCESS, IMG_PROCESS, BUILT, PENDING } from "./devopsData.js";

const mono = { fontFamily: "monospace" };
function H2({ t, children }) {
  return <div style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "30px 0 8px", letterSpacing: -.1 }}>{children}</div>;
}
function H3({ t, children }) {
  return <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, margin: "16px 0 6px" }}>{children}</div>;
}
function P({ t, children, wide }) {
  return <p style={{ fontSize: 13, color: t.sub, lineHeight: 1.65, maxWidth: wide ? "none" : "72ch", margin: "0 0 10px" }}>{children}</p>;
}
function Note({ t, children, tone }) {
  const c = tone === "warn" ? t.warning : t.accent;
  return <div style={{ borderLeft: `3px solid ${c}`, background: t.bg, padding: "10px 14px", borderRadius: "0 6px 6px 0", margin: "12px 0", fontSize: 13, color: t.sub, lineHeight: 1.6, maxWidth: "74ch" }}>{children}</div>;
}
function Status({ t, s }) {
  const C = PAL(t); const k = s === "built" ? "ok" : s === "partial" ? "wa" : "mut";
  return <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: C[k], border: `1px solid ${C[k]}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{s.toUpperCase()}</span>;
}
function Tbl({ t, head, rows }) {
  return (
    <div style={{ overflowX: "auto", margin: "10px 0 6px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, minWidth: 560 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted,
          padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "8px 12px 8px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`,
          color: j === 0 ? t.text : t.sub, fontWeight: j === 0 ? 600 : 400, lineHeight: 1.5 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}
function Steps({ t, items }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: "8px 0", maxWidth: "72ch" }}>
      {items.map(([title, body, small], i) => (
        <li key={i} style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr)", gap: 10, padding: "9px 0", borderBottom: `1px solid ${t.bg}` }}>
          <span style={{ ...mono, fontSize: 12.5, color: t.accent, paddingTop: 1 }}>{i + 1}</span>
          <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.55 }}><b style={{ color: t.text }}>{title}</b> {body}
            {small && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{small}</div>}</div>
        </li>))}
    </ol>);
}

// The step-by-step of a pull request today. The deploy row is the design;
// it says so with its status.
export const PR_STEPS = [
  ["Open the PR", "Developer", "Branch named type/TICKET-slug. The webhook reaches the bridge, which starts the job with the commit.", "The job starts within a minute.", "built"],
  ["Checkout and setup", "Job", "Clones the source into the workspace, loads the Oracle connection from an OpenShift secret, prepares the toolchain.", "The commit SHA is recorded.", "built"],
  ["Gate 1 · Code quality", "Job", "Linting, formatting, DAG and repository checks.", "Zero blocking findings.", "built"],
  ["Gate 2 · Schema", "Job", "Compares the dbt YAML contracts to Oracle metadata, after the schema stage has applied the changelog.", "Every contract matches a column that exists.", "built"],
  ["Gate 3 · Transformation", "Job", "dbt compile and test, plus the custom transformation assertions.", "Every model compiles and every test passes.", "built"],
  ["Gate 4 · Performance", "Job", "Oracle performance thresholds and benchmark checks. Skippable with a parameter, and recorded as skipped.", "Within threshold.", "built"],
  ["Gate 5 · Security", "Job", "Bandit and SAST findings normalised, then blocked by severity.", "Nothing above the blocking severity.", "built"],
  ["Report", "Aggregator, bridge", "summary.json and summary.html written and archived. The bridge stores the run in Silver and e-mails the HTML to everyone on the pull request.", "The report arrives; overall is fail if any gate failed, else pass.", "built"],
  ["Review", "Tech lead", "Reads the logic, the grain and the placement in the architecture. Naming, style, tests and secrets are CI's job, not the reviewer's.", "Approval.", "built"],
  ["Merge and deploy", "Job", "Designed: thin artefact on the pinned image digest, deployed to DEV and SIT on merge, QC on promotion, PROD on approval, with a smoke test and rollback.", "Not in the job yet. Deployment is manual today.", "pending"],
];
export const FOR_DEVELOPERS = [
  ["Branch from the ticket.", "feature/CP-1234-short-slug. The branch name is checked."],
  ["Put the schema change beside the code.", "A changeset in db/changelog with a rollback block, in the same pull request."],
  ["Open the pull request and wait for the report.", "The five gates run on their own; the HTML report arrives by e-mail with each gate's result and the files behind it."],
  ["Fix what the report names,", "push, and the gates run again. Nobody re-checks naming or style by hand; the reviewer reads the logic."],
  ["After approval, merge.", "DEV and SIT pick up the merge build. QC takes a promotion, PROD an approval. Until the deploy stage is in the job, the platform team deploys."],
];
export const FOR_REVIEWERS = [
  ["Trust the gates for the mechanical part.", "A green report means naming, style, tests and secrets are done. Spend the review on the logic, the grain, and whether the model sits in the right layer."],
  ["Read the changeset as a database change.", "Is it expand before contract? Is the rollback data-safe? Does the object belong to this application's changelog?"],
  ["Promotion is a decision, not a rebuild.", "The artefact that passed in QC is the one that goes to PROD. Approve the SHA you saw tested."],
  ["A skipped Gate 4 is recorded.", "It is visible in the report and in Silver; ask why before approving."],
];

// The process in one picture: three lanes on three clocks, coloured by status.
export function ProcessFig({ t }) {
  const C = PAL(t);
  const box = (s, x, y, w, h, title, lines) => { const p = sp(C, s); return (
    <g key={title + x}>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />
      <text x={x + w - 6} y={y + 11} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
      <text x={x + 8} y={y + 22} fontSize={11} fontWeight={700} fill={C.ink}>{title}</text>
      {lines.map((l, i) => <text key={i} x={x + 8} y={y + 36 + i * 13} fontSize={9.5} fill={C.mut}>{l}</text>)}
    </g>); };
  const arrow = (x1, y, x2) => <path d={`M${x1} ${y} L${x2} ${y}`} stroke={C.mut} strokeWidth={1.3} fill="none" markerEnd="url(#dvo-arr)" />;
  const lane = (y, label) => <text x={14} y={y} fontSize={10.5} fontWeight={800} letterSpacing=".8" fill={C.mut}>{label}</text>;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 6 }}>
      <svg viewBox="0 0 960 372" role="img" style={{ display: "block", minWidth: 720, width: "100%", height: "auto" }}
        aria-label="The delivery process in three lanes. On every pull request: the webhook bridge starts the Guardrails job, five gates run, a record goes to the Silver schema and an HTML report is e-mailed; all built. The application job per release: the Liquibase schema stage first, built; the gates, partial; the thin artefact and the deploy to DEV, SIT, QC and PROD, pending. The image job on a vulnerability or a bump: build, scan, sign, push one digest and raise a bump pull request into every consumer; all built.">
        <defs><marker id="dvo-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.mut} /></marker></defs>
        {lane(22, "ON EVERY PULL REQUEST · THE INTAKE")}
        {box("built", 14, 34, 150, 50, "Pull request", ["Bitbucket webhook"])}{arrow(164, 59, 188)}
        {box("built", 190, 34, 150, 50, "Webhook bridge", ["repo · branch · commit"])}{arrow(340, 59, 364)}
        {box("built", 366, 34, 296, 50, "Guardrails job · five gates", ["code quality · schema vs Oracle · transformation · performance · security"])}{arrow(662, 59, 686)}
        {box("built", 688, 34, 124, 50, "Silver schema", ["one record per run"])}{arrow(812, 59, 836)}
        {box("built", 838, 34, 108, 50, "HTML report", ["e-mailed to the PR"])}
        <line x1={14} y1={104} x2={946} y2={104} stroke={C.line} />
        {lane(128, "THE APPLICATION JOB · PER RELEASE")}
        {box("built", 14, 140, 212, 62, "1 · Schema stage · Liquibase", ["db/changelog in the same repo", "validate · update · tag env-build"])}{arrow(226, 171, 250)}
        {box("partial", 252, 140, 178, 62, "2 · Gates", ["five today; eighteen stages", "in the design"])}{arrow(430, 171, 454)}
        {box("pending", 456, 140, 178, 62, "3 · Thin artefact", ["app layer on the pinned", "image digest · app tag"])}{arrow(634, 171, 658)}
        {box("pending", 660, 140, 286, 62, "4 · Deploy", ["DEV → SIT on merge · QC on promotion · PROD on approval", "reads the database tag first; refuses without it"])}
        <line x1={14} y1={222} x2={946} y2={222} stroke={C.line} />
        {lane(246, "THE IMAGE JOB · ON A VULNERABILITY OR A BUMP")}
        {box("built", 14, 258, 150, 50, "Build", ["base, then workbench and agent"])}{arrow(164, 283, 188)}
        {box("built", 190, 258, 150, 50, "Scan", ["CRITICAL fails the job"])}{arrow(340, 283, 364)}
        {box("built", 366, 258, 150, 50, "Sign + SBOM", ["unsigned never reaches the registry"])}{arrow(516, 283, 540)}
        {box("built", 542, 258, 150, 50, "Push by digest", ["one sha256, identical everywhere"])}{arrow(692, 283, 716)}
        {box("built", 718, 258, 228, 50, "Bump PR into every consumer", ["the fix is live when the last one merges"])}
        <path d="M632 308 L632 328 L545 328 L545 206" stroke={C.mut} strokeWidth={1.3} fill="none" markerEnd="url(#dvo-arr)" />
        <text x={560} y={342} fontSize={9.5} fill={C.mut}>the application pins the digest; a new image reaches it through the bump pull request</text>
        <text x={14} y={364} fontSize={9.5} fill={C.mut}>The schema is applied before the application and may run ahead of it by design. It is never behind: the deploy refuses a target without this release's database tag.</text>
      </svg>
    </div>);
}

export default function Overview({ t, onGo }) {
  const n = (s) => BUILT.filter((r) => r.status === s).length;
  const PIPE_TEXT = {
    intake: "A Bitbucket pull request webhook reaches the bridge, which starts the Guardrails job with repository, branch and commit. Five gates run in order, fail-fast aware. The aggregator writes a JSON and an HTML summary; the bridge stores the run in the Silver schema and e-mails the report to the developers and reviewers on the pull request.",
    db: "Each application repository carries its own db/changelog. The schema stage validates it, applies it under the application's own changelog table and tags the instance env-build. Gate 2 then checks the dbt contracts against what Oracle now holds.",
    img: "Base, workbench and agent images are built together, scanned, signed with an SBOM and pushed as one digest. A bump pull request is raised into every repository that pins it.",
    app: "The gates and the schema stage run. The thin artefact, the deploy stage, the approval gate and post-deploy validation are designed and not yet in the job, which today ends at the report.",
  };
  const go = (k, label) => <span onClick={() => onGo && onGo(k)} style={{ cursor: "pointer", color: t.accent, fontWeight: 600 }}>{label}</span>;
  return (
    <div>
      <P t={t}>How a change travels from a pull request to production, what runs on every pull request today, and where the schema, the images and the application each get their own pipeline.
        Colour says how much of the design exists. The other tabs hold the detail: the {go("map", "delivery map")} with live state per environment, a {go("pipelines", "swimlane per pipeline")},
        the {go("reference", "design reference")}, the {go("ops", "operating model")} and the {go("dash", "compliance dashboard")}.</P>
      <Legend t={t} />

      <H2 t={t}>The process in one picture</H2>
      <P t={t}>Three pipelines, on three different clocks. The application job runs on every pull request and carries the schema with it. The image job runs when a vulnerability or a version bump needs it.
        Nothing is built twice: the same artefact SHA and the same image digest move from development to production unchanged.</P>
      <ProcessFig t={t} />

      <H2 t={t}>What is built today</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, margin: "10px 0" }}>
        {PIPES.map(([k, title, cadence, s]) => (
          <div key={k} style={{ background: t.panel, border: `1px solid ${t.border}`, borderTop: `3px solid ${sp(PAL(t), s).stroke}`, borderRadius: t.radius.md, padding: "12px 14px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", fontWeight: 700, color: t.text, fontSize: 13.5 }}>{title} <Status t={t} s={s} /></div>
            <div style={{ fontSize: 11.5, color: t.textMuted, margin: "2px 0 8px" }}>{cadence}</div>
            <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.55 }}>{PIPE_TEXT[k]}</div>
          </div>))}
      </div>
      <Note t={t}><b style={{ color: t.text }}>The honest shape.</b> Of the design's {BUILT.length} reconciled rows, {n("built")} are built, {n("partial")} partial and {n("pending")} pending.
        The two pending items that unlock the rest are {PENDING[0][0].toLowerCase()} and connecting the shared DevSecOps library, so every team is held to the same thresholds. The row-by-row reconciliation opens from the intake node on the {go("map", "delivery map")}.</Note>

      <H2 t={t}>A pull request, step by step</H2>
      <P t={t}>What happens between opening a pull request and seeing the report. The gates are the same on every repository; the thresholds live in <span style={mono}>config/guardrails.yaml</span> until the shared library takes them over.</P>
      <Tbl t={t} head={["Step", "Who", "What happens", "Passes when", ""]} rows={PR_STEPS.map(([a, b, c, d, s]) => [a, b, c, d, <Status t={t} s={s} />])} />

      <H2 t={t}>Database deployment: Liquibase in every application repository</H2>
      <P t={t}>There is no separate database job. Schema change is a stage of the application job, applied from a <span style={mono}>db/changelog</span> that lives in the same repository as the code that needs it. It runs {DB_PROCESS.cadence}.</P>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "6px 28px" }}>
        <div style={{ minWidth: 0 }}>
          <H3 t={t}>The six steps</H3>
          <Steps t={t} items={DB_PROCESS.steps.map(([step, who, what, passes]) => [step.replace(/^\d+ · /, "") + ".", `${who}: ${what}`, `Passes when: ${passes}`])} />
        </div>
        <div style={{ minWidth: 0 }}>
          <H3 t={t}>The three rules</H3>
          {DB_PROCESS.rules.map((r) => <Note key={r} t={t}>{r}</Note>)}
          <H3 t={t}>Why it is in the repository</H3>
          <P t={t}>A schema change and the code that needs it ship in one pull request, reviewed by one person, under one build number. The changelog table per application keeps two applications from racing on the same database,
            and the tag gives the deploy stage one fact to check before it touches anything.</P>
        </div>
      </div>

      <H2 t={t}>Images and security</H2>
      <P t={t}>The application job never builds an image. Three images, base, workbench and agent, are rebuilt together {IMG_PROCESS.cadence}, so the workbench and the agent never sit on an older base than the one just patched.</P>
      <Tbl t={t} head={["Step", "Who", "What happens", "Passes when"]} rows={IMG_PROCESS.steps.map(([step, who, what, passes]) => [step.replace(/^\d+ · /, ""), who, what, passes])} />

      <H2 t={t}>Versions and names</H2>
      <P t={t}>An environment appears in a name only when the thing is re-made per environment. That rule tells you at a glance what moves between environments and what is re-derived locally.</P>
      <Tbl t={t} head={["Thing", "Format", "Example", "Per environment", "Minted by"]} rows={NAMING.map((r) => [r.thing, r.fmt, <span style={mono}>{r.example}</span>, r.perEnv ? "yes" : "no", r.by])} />
      <P t={t}>Promotion moves the thin artefact and its app tag, build number and commit forward unchanged. The database tag is re-evaluated per instance, because the schema stage applies the changesets and tags locally.
        The image digest never moves, because it is already identical everywhere. Production is normally a release or two behind QC, and that is the intended state, not a backlog.</P>

      <H2 t={t}>What it means for you</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "6px 28px" }}>
        <div style={{ minWidth: 0 }}><H3 t={t}>If you write models and DAGs</H3><Steps t={t} items={FOR_DEVELOPERS} /></div>
        <div style={{ minWidth: 0 }}><H3 t={t}>If you review or approve</H3><Steps t={t} items={FOR_REVIEWERS} /></div>
      </div>

      <H2 t={t}>What comes next, in the order that unlocks the rest</H2>
      <Tbl t={t} head={["#", "Work", "Why this order"]} rows={PENDING.map(([a, b], i) => [<span style={mono}>{i + 1}</span>, <b style={{ color: t.text }}>{a}</b>, b])} />
      <Note t={t} tone="warn"><b style={{ color: t.text }}>One rule to keep while this list is worked.</b> A new blocking control lands as advisory first for one sprint, so the backlog of violations is visible before it starts failing builds.
        Promotion to blocking needs the current count published and a remediation window agreed.</Note>
      <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 20, maxWidth: "72ch", lineHeight: 1.6 }}>
        Endpoints, hosts and credentials are in the runbook, not on this page. Everything above is read from the same rows as the delivery map, so the two cannot disagree.</div>
    </div>);
}
