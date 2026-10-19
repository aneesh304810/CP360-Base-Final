// DevOps 360 · Overview. The first tab, written for a senior team member and
// a developer on the same page: the process in one picture, what is built,
// a pull request step by step, Liquibase as the schema stage of every
// application job, images, names, what it means for you, and what comes
// next. Every list here is READ FROM devopsData.js — the same rows the map,
// the swimlanes and the reconciliation draw — so the overview cannot say
// something the rest of the page does not.
import React from "react";
import { PAL, sp, Legend } from "./devopsStatus.jsx";
import { NAMING, PIPES, DB_PROCESS, IMG_PROCESS, BUILT, PENDING, GATE_FLOW, FLOW_TRACKS, RELEASE_ORDER, E2E, ENVS, ENV_FACTS, ENV_MATRIX } from "./devopsData.js";

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
  ["Report", "Aggregator, bridge", "summary.json and summary.html written and archived. The bridge stores the run in the CP 360 metadata and e-mails the HTML to everyone on the pull request.", "The report arrives; overall is fail if any gate failed, else pass.", "built"],
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
  ["A skipped Gate 4 is recorded.", "It is visible in the report and in the CP 360 metadata; ask why before approving."],
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
        aria-label="The delivery process in three lanes. On every pull request: the webhook bridge starts the Guardrails job, five gates run, a record goes to the CP 360 metadata, and an HTML report is e-mailed; all built. The application job per release: the Liquibase schema stage first, built; the gates, partial; the thin artefact and the deploy to DEV, SIT, QC and PROD, pending. The image job on a vulnerability or a bump: build, scan, sign, push one digest and raise a bump pull request into every consumer; all built.">
        <defs><marker id="dvo-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.mut} /></marker></defs>
        {lane(22, "ON EVERY PULL REQUEST · THE INTAKE")}
        {box("built", 14, 34, 150, 50, "Pull request", ["Bitbucket webhook"])}{arrow(164, 59, 188)}
        {box("built", 190, 34, 150, 50, "Webhook bridge", ["repo · branch · commit"])}{arrow(340, 59, 364)}
        {box("built", 366, 34, 296, 50, "Guardrails job · five gates", ["code quality · schema vs Oracle · transformation · performance · security"])}{arrow(662, 59, 686)}
        {box("built", 688, 34, 124, 50, "CP 360 metadata", ["one record per run"])}{arrow(812, 59, 836)}
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

// The whole picture, C4 style: people on the left, the systems they touch,
// and the numbered flows between them from a pull request to a production
// run. One container-level diagram so the three pipelines, the four
// environments and the CP 360 metadata are seen as one system. Coloured by
// status like every other figure.
export const C4_FLOWS = [
  ["1", "Developer opens a pull request", "built"],
  ["2", "The bridge starts the Guardrails job on the agent", "built"],
  ["3", "Schema stage on DEV, then Gates 1–5", "built"],
  ["4", "Report to the CP 360 metadata and by e-mail", "built"],
  ["5", "Tech lead approves; merge builds the thin artefact", "pending"],
  ["6", "Deploy DEV → SIT → QC → PROD, tag read first", "pending"],
  ["7", "Scheduler runs the DAG; task pods run dbt on Oracle", "partial"],
  ["8", "Recon gates record the run; the screens read it back", "built"],
  ["9", "Image job pushes one digest; every consumer pins it", "built"],
];
export function C4WholeFig({ t }) {
  const C = PAL(t);
  const W = 1180, H = 740;
  const box = (s, x, y, w, h, title, sub, kind) => { const p = sp(C, s); return (
    <g key={`${title}${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />
      {kind && <text x={x + 8} y={y + 11} fontSize={7.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>{kind}</text>}
      <text x={x + w - 6} y={y + 11} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
      <text x={x + 8} y={y + 26} fontSize={11} fontWeight={700} fill={C.ink}>{title}</text>
      {(sub || []).map((l, i) => <text key={i} x={x + 8} y={y + 39 + i * 12} fontSize={9} fill={C.mut}>{l}</text>)}
    </g>); };
  const person = (x, y, name, role) => (
    <g key={name}>
      <circle cx={x + 16} cy={y + 12} r={9} fill="none" stroke={C.ink} strokeWidth={1.4} />
      <path d={`M${x + 2} ${y + 38} Q${x + 16} ${y + 20} ${x + 30} ${y + 38}`} fill="none" stroke={C.ink} strokeWidth={1.4} />
      <text x={x + 40} y={y + 16} fontSize={11} fontWeight={700} fill={C.ink}>{name}</text>
      <text x={x + 40} y={y + 29} fontSize={9} fill={C.mut}>{role}</text>
    </g>);
  const flow = (d, n, lx, ly, dashed) => (
    <g key={n + d}>
      <path d={d} fill="none" stroke={dashed ? C.mut : C.fast} strokeWidth={1.4} strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#c4w-arr)" />
      <circle cx={lx} cy={ly} r={8} fill={C.fast} /><text x={lx} y={ly + 3.5} fontSize={9} fontWeight={800} fill="#fff" textAnchor="middle">{n}</text>
    </g>);
  const envs = [["RD DEV", "dev-build", "on merge"], ["RD SIT", "sit-build", "after DEV"], ["QC · UAT", "qc-build", "on promotion"], ["PROD", "prod-build", "on approval"]];
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 960, width: "100%", height: "auto" }}
        aria-label={`The whole delivery system in one C4 container diagram. People on the left: developer, tech lead, approvers, business verifier, platform engineering. Source: one Bitbucket repository per application holding dbt models, DAGs and db/changelog, three image repositories, and the shared guardrail library, not yet connected. Build: the webhook bridge, the Jenkins controller and its agent running the Guardrails job, and the image job pushing to the internal registry. Run: four OpenShift namespaces, RD DEV, RD SIT, QC UAT and PROD, each with the Airflow scheduler and webserver, task pods running dbt, and its own IMDS and PBDW instances tagged by the schema stage. Record: the CP 360 metadata, read by Release Delivery, Quality Guardrails and DevOps 360, and the e-mailed report. Nine numbered flows: ${C4_FLOWS.map(([n, f, s]) => `${n} ${f} (${s})`).join("; ")}.`}>
        <defs><marker id="c4w-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker></defs>
        <text x={14} y={18} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>C4 · CONTAINERS · THE WHOLE PICTURE, FROM A PULL REQUEST TO A PRODUCTION RUN</text>
        {/* people */}
        <text x={14} y={44} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>PEOPLE</text>
        {person(14, 54, "Developer", "models · DAGs · changesets")}
        {person(14, 104, "Tech lead", "reviews logic, grain, placement")}
        {person(14, 154, "Approvers", "Platform Owner · Release Manager")}
        {person(14, 204, "Business verifier", "UAT on the SHA that ships")}
        {person(14, 254, "Platform engineering", "images · bumps · the platform")}
        {/* source */}
        <text x={250} y={44} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>SOURCE · BITBUCKET</text>
        {box("built", 250, 52, 210, 58, "Application repositories", ["one per application: dbt models, DAGs,", "db/changelog, pinned image digest"], "REPO")}
        {box("built", 250, 120, 210, 46, "Image repositories", ["base · workbench · agent"], "REPO")}
        {box("pending", 250, 176, 210, 46, "DevSecOps shared library", ["stage order, thresholds — not connected"], "LIBRARY")}
        {/* build */}
        <text x={500} y={44} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>BUILD · JENKINS ON OPENSHIFT</text>
        {box("built", 500, 52, 200, 46, "Webhook bridge", ["BBH-internal · PR webhooks in · results out"], "SERVICE")}
        {box("built", 500, 108, 200, 72, "Guardrails job · on the agent", ["schema stage · Liquibase on DEV", "Gates 1–5 · summary.json + .html", "config/guardrails.yaml"], "JOB")}
        {box("pending", 500, 190, 200, 46, "Merge build · thin artefact", ["dbt project + DAG bundle on the digest"], "JOB")}
        {box("built", 500, 246, 200, 46, "Image job", ["build · scan · sign · push by digest"], "JOB")}
        {box("built", 500, 302, 200, 40, "Internal registry", ["signed digests only"], "STORE")}
        {/* run: four environments */}
        <text x={740} y={44} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>RUN · FOUR OPENSHIFT NAMESPACES, ONE SHAPE</text>
        {envs.map(([e, tag, when], i) => { const y = 52 + i * 92; return (
          <g key={e}>
            <rect x={740} y={y} width={426} height={82} rx={6} fill="none" stroke={C.line} strokeWidth={1} />
            <text x={750} y={y + 14} fontSize={10.5} fontWeight={800} fill={C.ink}>{e}</text>
            <text x={1156} y={y + 14} fontSize={9} textAnchor="end" fill={C.mut}>{when}</text>
            {box("built", 750, y + 20, 196, 54, "Airflow", ["scheduler · webserver on the base digest", "task pods: dbt on the workbench"], "DEPLOYMENT")}
            {box("built", 956, y + 20, 200, 54, "IMDS · PBDW", [`schema tag ${tag}`, "DATABASECHANGELOG_{APP} per app"], "ORACLE")}
          </g>); })}
        {/* record */}
        <text x={250} y={434} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>RECORD · CP 360</text>
        {box("built", 250, 442, 450, 62, "CP 360 metadata", ["the run record per pull request (per gate today, per control in the design)", "guardrail_changeset · changeset_applied · deployment · events"], "ORACLE SCHEMA")}
        {box("built", 250, 514, 220, 46, "Release Delivery · Quality Guardrails", ["what is deployed where · gate outcomes"], "CP 360 SCREENS")}
        {box("built", 480, 514, 220, 46, "DevOps 360", ["this documentation, coloured by status"], "CP 360 SCREEN")}
        {box("built", 740, 442, 200, 46, "E-mail", ["summary.html to the PR's people"], "NOTIFICATION")}
        {box("pending", 740, 498, 426, 62, "Engineering and executive dashboards", ["Grafana per build and control · Power BI per team and month", "the immutable seven-year audit store — none built"], "DESIGN")}
        {/* flows */}
        {flow("M200 70 L248 78", "1", 224, 62)}
        {flow("M460 78 L498 76", "2", 480, 66)}
        {flow("M600 98 L600 106", "3", 614, 102)}
        {flow("M600 180 L600 188", "", 0, -20)}
        {flow("M500 160 L488 160 L488 440", "4", 488, 300)}
        {flow("M700 468 L740 468", "4", 720, 458)}
        {flow("M200 118 L244 118 L244 240 L498 228", "5", 330, 232, true)}
        {flow("M700 212 L724 212 L724 98 L748 98", "6", 712, 150, true)}
        {flow("M724 212 L724 374 L748 374", "", 0, -20, true)}
        {flow("M946 99 L954 99", "7", 950, 88, true)}
        {flow("M1056 402 L1056 424 L690 424 L690 440", "8", 880, 416)}
        {flow("M700 322 L734 322", "9", 718, 312)}
        <line x1={734} y1={62} x2={734} y2={404} stroke={C.fast} strokeWidth={1.4} strokeOpacity={.5} />
        {[76, 168, 260, 352].map((y) => <path key={y} d={`M734 ${y} L748 ${y}`} stroke={C.fast} strokeWidth={1.2} strokeOpacity={.7} markerEnd="url(#c4w-arr)" />)}
        {flow("M460 143 L480 143 L480 269 L498 269", "", 0, -20)}
        {flow("M200 270 L236 270 L236 150 L248 150", "", 0, -20)}
        <text x={14} y={586} fontSize={9.5} fill={C.mut}>Solid arrows run today; dashed arrows are the design's deploy path, which the job does not do yet. Flow 9 is the one digest every namespace and the agent pull.</text>
        <text x={14} y={600} fontSize={9.5} fill={C.mut}>Every namespace pulls the same image digest; what differs per environment is the schema tag, the secret and the replica counts.</text>
        <text x={14} y={614} fontSize={9.5} fill={C.mut}>The schema is never deployed: it is applied by the job's first stage and recorded as a tag the deploy must find. Hostnames, addresses and credentials are in Environment 360 and the runbook.</text>
        <text x={14} y={640} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>THE FLOWS</text>
        {C4_FLOWS.map(([n, f, s], i) => { const col = i < 5 ? 0 : 1; const row = i < 5 ? i : i - 5; const x = 14 + col * 590; const y = 656 + row * 15; return (
          <g key={n}>
            <circle cx={x + 8} cy={y} r={6.5} fill={C.fast} /><text x={x + 8} y={y + 3} fontSize={8} fontWeight={800} fill="#fff" textAnchor="middle">{n}</text>
            <text x={x + 20} y={y + 3.5} fontSize={9.5} fill={C.ink}>{f}</text>
            <text x={x + 560} y={y + 3.5} fontSize={7.5} fontWeight={800} textAnchor="end" fill={sp(C, s).stroke}>{s.toUpperCase()}</text>
          </g>); })}
      </svg>
    </div>);
}

// One pipeline end to end: its stages left to right, from author to PROD,
// each box coloured by status, the gate to pass under it, and the "moves"
// and "rollback" lines beneath. Three of these, one per pipeline.
export function E2EFig({ t, p }) {
  const C = PAL(t);
  const n = p.stages.length, W = 1180, x0 = 14, gap = 10, bw = Math.floor((W - 2 * x0 - (n - 1) * gap) / n), y0 = 48, bh = 92;
  const wrap = (s, max) => { const out = []; let line = ""; for (const w of String(s).split(" ")) { if ((line + " " + w).trim().length > max) { out.push(line.trim()); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out; };
  const maxPer = Math.max(14, Math.floor(bw / 5.6));
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 6 }}>
      <svg viewBox={`0 0 ${W} ${y0 + bh + 92}`} role="img" style={{ display: "block", minWidth: 920, width: "100%", height: "auto" }}
        aria-label={`${p.name}, end to end: ${p.stages.map(([s, , , , st]) => `${s} (${st})`).join(" → ")}. What moves: ${p.moves}. Rollback: ${p.rollback}`}>
        <defs><marker id={`e2e-${p.key}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.mut} /></marker></defs>
        <text x={x0} y={18} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>{p.name.toUpperCase()} · END TO END</text>
        <text x={x0} y={34} fontSize={9.5} fill={C.mut}>{p.cadence}</text>
        {p.stages.map(([name, what, gate, , st], i) => { const x = x0 + i * (bw + gap); const pat = sp(C, st); const lines = wrap(what, maxPer).slice(0, 4); return (
          <g key={name}>
            <rect x={x} y={y0} width={bw} height={bh} rx={4} fill={pat.fill} stroke={pat.stroke} strokeWidth={pat.strokeWidth} strokeDasharray={pat.strokeDasharray} />
            <text x={x + bw - 6} y={y0 + 11} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={pat.stroke}>{st.toUpperCase()}</text>
            <text x={x + 8} y={y0 + 22} fontSize={11} fontWeight={700} fill={C.ink}>{name}</text>
            {lines.map((l, j) => <text key={j} x={x + 8} y={y0 + 36 + j * 12} fontSize={8.5} fill={C.mut}>{l}{j === 3 && wrap(what, maxPer).length > 4 ? "…" : ""}</text>)}
            {i < n - 1 && <path d={`M${x + bw + 1} ${y0 + bh / 2} L${x + bw + gap - 1} ${y0 + bh / 2}`} stroke={C.mut} strokeWidth={1.2} markerEnd={`url(#e2e-${p.key})`} />}
            <text x={x + 8} y={y0 + bh + 16} fontSize={8} fontWeight={800} letterSpacing=".5" fill={C.mut}>GATE</text>
            {wrap(gate, maxPer).slice(0, 2).map((l, j) => <text key={j} x={x + 8} y={y0 + bh + 28 + j * 11} fontSize={8.5} fill={C.sub || C.mut}>{l}</text>)}
          </g>); })}
        <text x={x0} y={y0 + bh + 62} fontSize={9.5} fill={C.ink}><tspan fontWeight={800}>MOVES </tspan>{p.moves.length > 150 ? p.moves.slice(0, 148) + "…" : p.moves}</text>
        <text x={x0} y={y0 + bh + 78} fontSize={9.5} fill={C.ink}><tspan fontWeight={800}>ROLLBACK </tspan>{p.rollback.length > 150 ? p.rollback.slice(0, 148) + "…" : p.rollback}</text>
      </svg>
    </div>);
}

// One pipeline's behaviour in each environment: a column per environment,
// a row per question; the last row is the status, drawn as a chip.
export function EnvMatrix({ t, rows }) {
  return (
    <Tbl t={t} head={["", ...ENVS]} rows={rows.map(([q, ...cells]) => [q, ...cells.map((c, i) =>
      q === "Status" ? <Status key={i} t={t} s={c} /> : <span key={i} style={{ fontSize: 12.5 }}>{c}</span>)])} />);
}

// The four environments themselves, before any pipeline: purpose, trigger,
// approval, shape, database, data, access, dwell.
export function EnvFacts({ t }) {
  const rows = [["Purpose", "purpose"], ["A change gets there", "trigger"], ["Approval", "approval"], ["Namespace", "shape"], ["Database", "database"],
    ["Data", "data"], ["Who uses it", "access"], ["A build stays", "dwell"]];
  return (
    <Tbl t={t} head={["", ...ENV_FACTS.map((e) => e.env)]} rows={rows.map(([label, k]) => [label, ...ENV_FACTS.map((e) => <span key={e.env} style={{ fontSize: 12.5 }}>{e[k]}</span>)])} />);
}

export function E2EPipelines({ t }) {
  return (<>
    {E2E.map((p) => (
      <div key={p.key} style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", margin: "16px 0 6px" }}>
          <b style={{ color: t.text, fontSize: 14.5 }}>{p.name}</b><Status t={t} s={p.status} /><span style={{ fontSize: 11.5, color: t.textMuted }}>{p.cadence}</span>
        </div>
        <E2EFig t={t} p={p} />
        <Tbl t={t} head={["Stage", "What happens", "Gate to pass", "Evidence written", ""]} rows={p.stages.map(([a, b, c, d, s]) => [a, b, c, <span style={{ fontSize: 11.5 }}>{d}</span>, <Status t={t} s={s} />])} />
        <H3 t={t}>In each environment</H3>
        <EnvMatrix t={t} rows={ENV_MATRIX[p.key]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 24px" }}>
          <Note t={t}><b style={{ color: t.text }}>What moves between environments.</b> {p.moves}</Note>
          <Note t={t}><b style={{ color: t.text }}>Rollback.</b> {p.rollback}</Note>
        </div>
      </div>))}
  </>);
}

// Four tracks through one release: schema, dbt, Airflow, images. Each track
// is four stages left to right (author, checked, moves, runs), coloured by
// status; the arrows between tracks are the dependencies that fix the order.
export function TracksFig({ t }) {
  const C = PAL(t);
  const W = 1000, x0 = 150, colW = 196, gap = 12, rowH = 78, y0 = 56;
  const cols = ["AUTHORED", "CHECKED ON THE PULL REQUEST", "MOVES AS", "RUNS AS"];
  const box = (s, x, y, w, h, title) => { const p = sp(C, s); const lines = title.length > 30 ? [title.slice(0, title.lastIndexOf(" ", 30)), title.slice(title.lastIndexOf(" ", 30) + 1)] : [title]; return (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />
      <text x={x + w - 6} y={y + 11} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
      {lines.map((l, i) => <text key={i} x={x + 8} y={y + 24 + i * 13} fontSize={10} fontWeight={700} fill={C.ink}>{l}</text>)}
    </g>); };
  const H = y0 + FLOW_TRACKS.length * rowH + 44;
  const cx = (i) => x0 + i * (colW + gap);
  const cy = (r) => y0 + r * rowH + 24;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 820, width: "100%", height: "auto" }}
        aria-label={`Four tracks through one release, each in four stages: authored, checked on the pull request, moves as, runs as. ${FLOW_TRACKS.map((tr) => `${tr.name}: ${tr.stages.map(([s, st]) => `${s} (${st})`).join(", ")}`).join(". ")}. Dependencies: the image digest underneath every job and pod; the schema applied and tagged before dbt compiles against it; the DAG orchestrating the dbt run.`}>
        <defs><marker id="dvt-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.mut} /></marker></defs>
        <text x={14} y={18} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>FOUR TRACKS THROUGH ONE RELEASE</text>
        {cols.map((c, i) => <text key={c} x={cx(i)} y={44} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>{c}</text>)}
        {FLOW_TRACKS.map((tr, r) => (<g key={tr.key}>
          <text x={14} y={cy(r) + 4} fontSize={11} fontWeight={700} fill={C.ink}>{tr.name.split(" · ")[0]}</text>
          {tr.name.includes(" · ") && <text x={14} y={cy(r) + 17} fontSize={9} fill={C.mut}>{tr.name.split(" · ")[1]}</text>}
          {tr.stages.map(([s, st], i) => box(st, cx(i), y0 + r * rowH, colW, 48, s))}
          {tr.stages.slice(0, -1).map((_, i) => <path key={i} d={`M${cx(i) + colW + 1} ${cy(r)} L${cx(i + 1) - 1} ${cy(r)}`} stroke={C.mut} strokeWidth={1.2} markerEnd="url(#dvt-arr)" />)}
        </g>))}
        {/* dependencies between tracks */}
        <path d={`M${cx(1) + colW / 2} ${y0 + 48} L${cx(1) + colW / 2} ${y0 + rowH}`} stroke={C.mut} strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#dvt-arr)" />
        <text x={cx(1) + colW / 2 + 6} y={y0 + rowH - 12} fontSize={8.5} fill={C.mut}>tables exist before dbt compiles</text>
        <path d={`M${cx(3) + colW / 2} ${y0 + 2 * rowH + 48} L${cx(3) + colW / 2} ${y0 + rowH + 48 + 4}`} stroke={C.mut} strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#dvt-arr)" />
        <text x={cx(3) + 8} y={y0 + 2 * rowH - 12} fontSize={8.5} fill={C.mut}>the DAG task runs dbt</text>
        <path d={`M${cx(2) + colW / 2} ${y0 + 3 * rowH} L${cx(2) + colW / 2} ${y0 + 2 * rowH + 48 + 4}`} stroke={C.mut} strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#dvt-arr)" />
        <path d={`M${cx(2) + colW / 2 - 30} ${y0 + 3 * rowH} L${cx(2) + colW / 2 - 30} ${y0 + rowH + 48 + 4}`} stroke={C.mut} strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#dvt-arr)" />
        <text x={cx(2) + 8} y={y0 + 3 * rowH - 12} fontSize={8.5} fill={C.mut}>the digest every pod and job runs on</text>
        <text x={14} y={H - 10} fontSize={9.5} fill={C.mut}>Left to right is one release. Top to bottom is the order of dependence: images under everything, the schema before dbt, the DAG calling dbt at run time.</text>
      </svg>
    </div>);
}

// The gate flow, expanded: the four stages before the gates, the five gates
// with their checks stacked, the three stages after. Every box carries its
// status; a gate's column also says which design stages it stands in for.
export function GateFlowFig({ t }) {
  const C = PAL(t);
  const G = GATE_FLOW;
  const W = 1180, colW = 196, gap = 12, x0 = 14, yTop = 92;
  const box = (s, x, y, w, h, title, lines, small) => { const p = sp(C, s); return (
    <g key={`${title}${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />
      <text x={x + w - 6} y={y + 11} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
      <text x={x + 8} y={y + 22} fontSize={small ? 10 : 11} fontWeight={700} fill={C.ink}>{title}</text>
      {lines.map((l, i) => <text key={i} x={x + 8} y={y + 35 + i * 12} fontSize={9} fill={C.mut}>{l}</text>)}
    </g>); };
  const maxChecks = Math.max(...G.gates.map((g) => g.checks.length));
  const checkH = 30, checkGap = 6;
  const yChecks = yTop + 64;
  const yCovers = yChecks + maxChecks * (checkH + checkGap) + 10;
  const yAfter = yCovers + 86;
  const H = yAfter + 96;
  const beforeW = (W - 2 * x0 - 3 * gap) / 4;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 14px 8px", marginBottom: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 900, width: "100%", height: "auto" }}
        aria-label={`The Guardrails gate flow on every pull request, expanded. Four stages first: load secrets, init, checkout source and setup environment. Then five gates in order, each with its checks stacked: ${G.gates.map((g) => `Gate ${g.n} ${g.name} with ${g.checks.length} checks`).join("; ")}. Under each gate, the design stages it covers and their status. Then three stages after: aggregate, archive, distribute. With fast-fail on, a failed gate skips the rest.`}>
        <defs><marker id="dvg-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.mut} /></marker></defs>
        <text x={x0} y={18} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>THE GUARDRAILS JOB · EVERY PULL REQUEST · GATES RUN IN ORDER, FAST-FAIL AWARE</text>
        <text x={x0} y={38} fontSize={10} fontWeight={800} letterSpacing=".8" fill={C.mut}>BEFORE THE GATES</text>
        {G.before.map(([name, what], i) => box("built", x0 + i * (beforeW + gap), 44, beforeW, 40, name, [what.length > 70 ? what.slice(0, 68) + "…" : what], true))}
        {G.gates.map((g, i) => {
          const x = x0 + i * (colW + gap);
          return (<g key={g.n}>
            {box(g.status, x, yTop, colW, 52, `Gate ${g.n} · ${g.name}`, [g.domain, g.report.replace("reports/", "")])}
            {i < G.gates.length - 1 && <path d={`M${x + colW + 1} ${yTop + 26} L${x + colW + gap - 1} ${yTop + 26}`} stroke={C.mut} strokeWidth={1.3} markerEnd="url(#dvg-arr)" />}
            <path d={`M${x + colW / 2} ${yTop + 52} L${x + colW / 2} ${yChecks - 2}`} stroke={C.mut} strokeWidth={1} />
            {g.checks.map((c, j) => box(g.status, x + 10, yChecks + j * (checkH + checkGap), colW - 20, checkH, c.length > 34 ? c.slice(0, 33) + "…" : c, [], true))}
            <text x={x + 10} y={yCovers + 8} fontSize={8.5} fontWeight={800} letterSpacing=".6" fill={C.mut}>STANDS IN FOR</text>
            {g.covers.slice(0, 3).map(([stage, s], j) => { const p = sp(C, s); return (
              <g key={stage}>
                <rect x={x + 10} y={yCovers + 14 + j * 20} width={colW - 20} height={16} rx={2} fill={p.fill} stroke={p.stroke} strokeWidth={1} strokeDasharray={p.strokeDasharray} />
                <text x={x + 15} y={yCovers + 25 + j * 20} fontSize={8.5} fill={C.ink}>{stage.length > 36 ? stage.slice(0, 35) + "…" : stage}</text>
              </g>); })}
          </g>);
        })}
        <text x={x0} y={yAfter - 10} fontSize={10} fontWeight={800} letterSpacing=".8" fill={C.mut}>AFTER THE GATES</text>
        {G.after.map(([name, what, s], i) => box(s, x0 + i * (340 + gap), yAfter, 340, 52, name, [what.length > 72 ? what.slice(0, 70) + "…" : what, what.length > 72 ? what.slice(70, 142) : ""], true))}
        <text x={x0} y={H - 10} fontSize={9.5} fill={C.mut}>Overall: {G.aggregate}. A gate's own status is pass, fail, skip or unknown. Gate 4 skips with SKIP_GATE4, and the report says so.</text>
      </svg>
    </div>);
}

export function GateFlow({ t }) {
  const G = GATE_FLOW;
  return (<>
    <GateFlowFig t={t} />
    <P t={t}>Each gate below: what it reads, what it checks, what it writes, and the rule that decides pass or fail. Beside it, the design stages the gate stands in for and what the design puts there that the gate does not yet do.</P>
    {G.gates.map((g) => (
      <div key={g.n} style={{ background: t.panel, border: `1px solid ${t.border}`, borderLeft: `4px solid ${sp(PAL(t), g.status).stroke}`, borderRadius: t.radius.md, padding: "12px 16px", margin: "10px 0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <b style={{ color: t.text, fontSize: 14 }}>Gate {g.n} · {g.name}</b><Status t={t} s={g.status} />
          <span style={{ fontSize: 11.5, color: t.textMuted }}>{g.domain} · writes <span style={mono}>{g.report}</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "4px 24px", marginTop: 8, fontSize: 12.5, color: t.sub, lineHeight: 1.55 }}>
          <div style={{ minWidth: 0 }}>
            <div><b style={{ color: t.text }}>Reads</b> {g.inputs}</div>
            <div style={{ marginTop: 4 }}><b style={{ color: t.text }}>Checks</b><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{g.checks.map((c) => <li key={c}>{c}</li>)}</ul></div>
            <div style={{ marginTop: 4 }}><b style={{ color: t.text }}>Tools</b> {g.tools}</div>
            <div style={{ marginTop: 4 }}><b style={{ color: t.text }}>Rule</b> {g.rule}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div><b style={{ color: t.text }}>Stands in for</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "4px 0 6px" }}>
              {g.covers.map(([stage, s]) => <div key={stage} style={{ display: "flex", gap: 8, alignItems: "center" }}><Status t={t} s={s} /><span>{stage}</span></div>)}
            </div>
            <div><b style={{ color: t.text }}>The design also puts here</b><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{g.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
          </div>
        </div>
      </div>))}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "6px 28px", marginTop: 14 }}>
      <div style={{ minWidth: 0 }}>
        <H3 t={t}>Parameters</H3>
        <Tbl t={t} head={["Parameter", "Meaning", ""]} rows={G.params.map(([a, b, c]) => [<span style={mono}>{a}</span>, b, <span style={{ fontSize: 11, color: t.textMuted }}>{c}</span>])} />
        <H3 t={t}>Environment</H3>
        <Tbl t={t} head={["Setting", "Meaning"]} rows={G.env.map(([a, b]) => [<span style={mono}>{a}</span>, b])} />
      </div>
      <div style={{ minWidth: 0 }}>
        <H3 t={t}>Before and after the gates</H3>
        <Tbl t={t} head={["Stage", "What happens", "Passes when"]} rows={G.before.map(([a, b, c]) => [a, b, c])} />
        <Tbl t={t} head={["Stage", "What happens"]} rows={G.after.map(([a, b]) => [a, b])} />
        <H3 t={t}>Status words</H3>
        <Tbl t={t} head={["Status", "Means"]} rows={G.semantics.map(([a, b]) => [<span style={mono}>{a}</span>, b])} />
        <Note t={t}><b style={{ color: t.text }}>Overall status:</b> {G.aggregate}. <b style={{ color: t.text }}>Fast-fail:</b> {G.fastFail}</Note>
      </div>
    </div>
  </>);
}

export default function Overview({ t, onGo }) {
  const n = (s) => BUILT.filter((r) => r.status === s).length;
  const PIPE_TEXT = {
    intake: "A Bitbucket pull request webhook reaches the bridge, which starts the Guardrails job with repository, branch and commit. Five gates run in order, fail-fast aware. The aggregator writes a JSON and an HTML summary; the bridge stores the run in the CP 360 metadata, and e-mails the report to the developers and reviewers on the pull request. Release Delivery and Quality Guardrails read those rows here. The bridge is a BBH-internal endpoint behind the internal network: Bitbucket reaches it without any external exposure, so no firewall or security exception is needed.",
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

      <H2 t={t}>The whole picture, C4 style</H2>
      <P t={t}>One container diagram of the whole delivery system: the people, the repositories, the build on Jenkins, the four environments with their Airflow and Oracle, and the CP 360 metadata that records every run. Nine numbered flows take a change from a pull request to a production run. Solid arrows run today; dashed ones are the deploy path still to be built.</P>
      <C4WholeFig t={t} />

      <H2 t={t}>The process in one picture</H2>
      <P t={t}>Three pipelines, on three different clocks. The application job runs on every pull request and carries the schema with it. The image job runs when a vulnerability or a version bump needs it.
        Nothing is built twice: the same artefact SHA and the same image digest move from development to production unchanged.</P>
      <ProcessFig t={t} />

      <H2 t={t}>Three pipelines, end to end: RD DEV to PROD</H2>
      <P t={t}>Each pipeline on its own, from the author's change to production: what happens at each stage, the gate that lets it through, the evidence it writes to the CP 360 metadata, and its status today. Under each, what actually moves between environments and how it is rolled back.
        The database and image pipelines are built end to end. The data pipeline is built up to the report and pending from the merge build onward.</P>
      <H3 t={t}>The four environments</H3>
      <P t={t}>Four namespaces of the same shape, each pointed at its own IMDS and PBDW instances and tagged by the schema stage. They differ in who gets a change there and how, in size, and in the data. Hostnames and addresses live in Environment 360, not here.</P>
      <EnvFacts t={t} />
      <E2EPipelines t={t} />

      <H2 t={t}>How Airflow, dbt, the schema and the images flow together</H2>
      <P t={t}>Four things change, in one repository per application and three image repositories, and they travel through one release on different tracks. The figure reads left to right as the release and top to bottom as dependence: the images underneath everything, the schema applied and tagged before a model compiles against it, the DAG calling dbt at run time.</P>
      <TracksFig t={t} />
      <Tbl t={t} head={["Track", "Lives in", "Checked on the pull request by", "Moves as", "Runs as", "Owns", ""]} rows={FLOW_TRACKS.map((tr) => [tr.name, tr.lives, tr.checked, tr.moves, tr.runs, tr.owns, <Status t={t} s={tr.status} />])} />
      <H3 t={t}>The order inside one release</H3>
      <Steps t={t} items={RELEASE_ORDER.map(([a, b]) => [a, b])} />
      <Note t={t}><b style={{ color: t.text }}>Three ownership rules keep the tracks apart.</b> dbt owns what it builds; Liquibase owns everything dbt does not create. Airflow owns the order and timing of work and never builds anything itself. The image job owns the runtime and hands over one digest; a consumer adopts it only by merging the bump.</Note>

      <H2 t={t}>What is built today</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, margin: "10px 0" }}>
        {PIPES.map(([k, title, cadence, s]) => (
          <div key={k} style={{ background: t.panel, border: `1px solid ${t.border}`, borderTop: `3px solid ${sp(PAL(t), s).stroke}`, borderRadius: t.radius.md, padding: "12px 14px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", fontWeight: 700, color: t.text, fontSize: 13.5 }}>{title} <Status t={t} s={s} /></div>
            <div style={{ fontSize: 11.5, color: t.textMuted, margin: "2px 0 8px" }}>{cadence}</div>
            <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.55 }}>{PIPE_TEXT[k]}</div>
          </div>))}
      </div>
      <Note t={t}><b style={{ color: t.text }}>The run record is CP 360 metadata.</b> The bridge writes every run into the CP 360 metadata, the schema this catalogue runs on and Integration 360 reads. That is why Release Delivery and Quality Guardrails can show gate outcomes without a second store, and why the per-control row, when it comes, lands where every screen already looks.</Note>
      <Note t={t}><b style={{ color: t.text }}>The honest shape.</b> Of the design's {BUILT.length} reconciled rows, {n("built")} are built, {n("partial")} partial and {n("pending")} pending.
        The two pending items that unlock the rest are {PENDING[0][0].toLowerCase()} and connecting the shared DevSecOps library, so every team is held to the same thresholds. The row-by-row reconciliation opens from the intake node on the {go("map", "delivery map")}.</Note>

      <H2 t={t}>A pull request, step by step</H2>
      <P t={t}>What happens between opening a pull request and seeing the report. The gates are the same on every repository; the thresholds live in <span style={mono}>config/guardrails.yaml</span> until the shared library takes them over.</P>
      <Tbl t={t} head={["Step", "Who", "What happens", "Passes when", ""]} rows={PR_STEPS.map(([a, b, c, d, s]) => [a, b, c, d, <Status t={t} s={s} />])} />

      <H2 t={t}>The gate flow, expanded</H2>
      <P t={t}>The same job, opened up: the four stages before the gates, each gate's checks in the order they run, the report file each one writes, and the three stages after. Under every gate, the design stages it stands in for, coloured by status, and what the design puts at that point that the gate does not do yet.</P>
      <GateFlow t={t} />

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
