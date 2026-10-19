// DevOps 360 · two reference cards from the Guardrails documentation:
// the enterprise OPERATING MODEL (roles, review, promotion, exceptions,
// governance, evidence) and the COMPLIANCE DASHBOARD (two audiences, the
// data flow, the schema, KPIs, the score, alert routing).
//
// COLOURED LIKE THE REST OF THE PAGE. Every box and every row carries
// built / partial / pending against what runs on a pull request today:
// the five-gate job behind the webhook bridge, a per-gate summary in the
// Silver schema and an HTML report by e-mail. Almost all of this is
// pending, and the page says so rather than drawing a finished system.
//
// NO ENDPOINT, HOST OR CHANNEL NAME. The runbook holds those.
import React from "react";
import { PAL, sp, Legend } from "./DevOps360.jsx";

const STATUS = { built: ["built", "ok"], partial: ["partial", "wa"], pending: ["pending", "no"] };
function Status({ t, s }) {
  const C = PAL(t); const [w, k] = STATUS[s] || STATUS.pending;
  return <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: C[k], border: `1px solid ${C[k]}`,
    borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{w.toUpperCase()}</span>;
}
function Frame({ t, vw, vh, aria, children }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel,
      padding: "16px 16px 10px", marginBottom: 14 }}>
      <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={aria} style={{ display: "block", minWidth: Math.min(vw, 760), width: "100%", height: "auto" }}>
        {children}</svg>
    </div>);
}
function SBox({ C, s, x, y, w, h, title, sub, rx = 3 }) {
  const p = sp(C, s);
  return (<g>
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />
    <text x={x + w - 6} y={y + 10} textAnchor="end" fontSize={7.5} fontWeight={800} letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
    <text x={x + 8} y={y + 24} fontSize={10.5} fontWeight={700} fill={C.ink}>{title}</text>
    {sub && <text x={x + 8} y={y + 38} fontSize={9} fill={C.mut}>{sub}</text>}
  </g>);
}
function H({ t, children, sub }) {
  return (<div style={{ margin: "4px 0 10px" }}>
    <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{children}</div>
    {sub && <div style={{ fontSize: 12.5, color: t.sub, marginTop: 3, maxWidth: "74ch", lineHeight: 1.6 }}>{sub}</div>}
  </div>);
}
function Sub({ t, children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "18px 0 6px" }}>{children}</div>;
}
function Note({ t, children, tone }) {
  const c = tone === "warn" ? t.warning : tone === "bad" ? t.danger : t.border;
  return <div style={{ borderLeft: `3px solid ${c}`, padding: "2px 0 2px 14px", margin: "12px 0 18px", fontSize: 13, color: t.sub, lineHeight: 1.6, maxWidth: "74ch" }}>{children}</div>;
}
function Tbl({ t, head, rows, right }) {
  const r = new Set(right || []);
  return (
    <div style={{ overflowX: "auto", marginBottom: 18 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, minWidth: 520 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: r.has(i) ? "center" : "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
          textTransform: "uppercase", color: t.textMuted, lineHeight: 1.35, borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom", padding: "0 12px 6px 0" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: "8px 12px 8px 0", verticalAlign: "top",
          borderBottom: `1px solid ${t.bg}`, color: t.text, textAlign: r.has(j) ? "center" : "left", lineHeight: 1.5 }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}
const M = ({ children }) => <span style={{ fontFamily: "monospace" }}>{children}</span>;

// ---------------------------------------------------------------- data ----
export const ROLES = [
  ["Data Engineer", "CP engineering", "writes models and DAGs; owns remediation of findings on their PR"],
  ["Tech Lead", "per squad", "first-line PR review; approves within-standard changes"],
  ["Platform Owner", "CP Data Platform", "owns the pipeline, validators and policy; second approval for prod"],
  ["Data Governance Lead", "CP Governance", "owns metadata, PII classification, ownership attestation"],
  ["Security Engineer", "InfoSec", "owns scanner configuration and severity thresholds; secret incidents"],
  ["Release Manager", "CP Ops", "change window, promotion scheduling, rollback authority"],
  ["Internal Audit", "Audit", "independent verification of evidence and the exception population"],
];
// R responsible · A accountable · C consulted · I informed · – none. Columns follow ROLES.
export const RACI = [
  ["Author model / DAG", "R/A", "C", "I", "I", "–", "–", "–"],
  ["Remediate CI findings", "R/A", "C", "C", "–", "–", "–", "–"],
  ["First PR approval", "C", "R/A", "I", "–", "–", "–", "–"],
  ["Second approval (prod)", "–", "C", "R/A", "C", "C", "I", "–"],
  ["Define / change a control", "C", "C", "R/A", "C", "C", "I", "I"],
  ["Set severity thresholds", "I", "C", "C", "C", "R/A", "I", "I"],
  ["PII classification", "R", "C", "C", "A", "C", "–", "I"],
  ["Owner attestation (quarterly)", "R", "R", "C", "A", "–", "–", "C"],
  ["Grant a standing exception", "R (request)", "C", "R", "A", "R", "C", "I"],
  ["Emergency hotfix authorisation", "R", "C", "C", "I", "C", "A", "I"],
  ["Secret disclosure incident", "I", "I", "C", "I", "R/A", "I", "I"],
  ["Production promotion", "I", "I", "C", "I", "I", "R/A", "I"],
  ["Rollback decision", "C", "C", "R", "I", "I", "A", "I"],
  ["Evidence retention", "–", "–", "R", "C", "C", "–", "A"],
  ["Control effectiveness review", "C", "C", "R", "R", "R", "C", "A"],
];
// The promotion matrix, with what the job does today beside each row.
export const PROMOTION = [
  ["Source branch", "any feature/*", "feature/* merged", "release/* or main", "main, release/*, hotfix/*", "the job runs on the pull request's branch; no environment is distinguished", "pending"],
  ["PR approvals", "0", "1", "1", "2 (one Platform Owner)", "repository settings, outside the job", "partial"],
  ["Blocking controls", "all static", "all", "all", "all", "the five gates, FAST_FAIL-aware; the same in every run", "partial"],
  ["Change ticket", "no", "no", "no", "yes (CHG / CRQ)", "nothing reads a ticket", "pending"],
  ["Manual approval", "no", "no", "yes", "yes", "nothing; the job ends at the report", "pending"],
  ["Change window", "no", "no", "no", "yes", "nothing", "pending"],
  ["Signed artefacts", "no", "no", "yes", "yes", "images are signed by the image job; dbt and DAG bundles are not", "partial"],
  ["Rollback tested", "no", "no", "yes", "yes", "nothing", "pending"],
  ["dbt selection", "state:modified+", "state:modified+", "full", "full", "Gate 3 runs against a fixed target without state", "pending"],
];
export const EXCEPTION_RULES = [
  ["Maximum 90 days", "no permanent exception exists; renewal needs fresh justification", "CP-DEP-040 and a database constraint"],
  ["Two approvers minimum", "from different teams", "CP-DEP-041"],
  ["Expiry enforced in policy", "an expired exception blocks the next deployment by itself, not by a reminder", "CP-DEP-040"],
  ["One control, one asset", "no wildcards", "the exception record"],
  ["A remediation plan at request time", "“we will fix it later” with no owner or date is rejected", "the exception record"],
];
export const CADENCE = [
  ["Per build", "control results to the audit store and the dashboard", "per-gate summary to Silver and an HTML report by e-mail", "partial"],
  ["Weekly", "engineering scorecard to Tech Leads", "nothing", "pending"],
  ["Monthly", "governance pack: exception population, coverage, trends; the governance forum", "nothing", "pending"],
  ["Quarterly", "owner and PII attestation; control effectiveness review", "nothing", "pending"],
  ["Annually", "independent control testing by Internal Audit", "nothing", "pending"],
];
export const EVIDENCE = [
  ["What changed?", "commit SHA, diff, PR number", "the bridge passes repository, branch and commit to the job", "built"],
  ["Who wrote it?", "commit author, PR author", "in the pull request, not in the run record", "partial"],
  ["Who reviewed it?", "PR approvers with timestamps", "in the pull request only", "partial"],
  ["Which controls ran?", "a JSON report per stage", "a status per gate in summary.json", "partial"],
  ["Did they pass?", "a result per control, keyed by control ID", "pass, fail, skip or unknown per gate; no control ID", "pending"],
  ["Any waivers?", "active exception ID, approvers, expiry", "nothing", "pending"],
  ["Who approved promotion?", "the approval-stage submitter and justification", "nothing", "pending"],
  ["Under which change record?", "the change ticket on the build", "nothing", "pending"],
  ["When did it deploy?", "deployment event timestamp", "nothing; the job does not deploy", "pending"],
  ["Was it validated after?", "post-deploy validation result", "nothing", "pending"],
  ["Was it rolled back?", "rollback event and target commit", "nothing", "pending"],
];
export const REG_MAP = [
  ["Segregation of duties", "CP-DEP-004, CP-DEP-005, the approval stage's submitter restriction"],
  ["Change authorisation", "CP-DEP-002, CP-DEP-003, the approval stage"],
  ["Change testing", "unit, dbt build and integration stages; CP-OPA-040 / 041"],
  ["Access control", "Vault and the OpenShift service account; CP-DEP-001"],
  ["Audit trail", "the immutable store, seven-year retention"],
  ["Vulnerability management", "CP-DEP-031 / 032, Trivy, dependency checks"],
  ["Data classification", "CP-OPA-003 / 004 / 005"],
  ["Monitoring and alerting", "CP-AF-010 / 011 / 012, post-deploy validation"],
];
export const ATTEST = [
  ["Owner attestation", "each named owner confirms they still own their assets; two consecutive misses escalate to the Governance Lead"],
  ["PII attestation", "Governance samples models declaring no PII and checks them against the column dictionary — the compensating control for the framework's blindest spot, a false negative that passes every automated check"],
  ["Exception review", "every active exception is re-justified or closed"],
];
export const GATE_DOMAINS = [
  ["Gate 1", "code and repository quality", "lint, format, tests and DAG standards"],
  ["Gate 2", "schema governance", "dbt YAML contracts against Oracle metadata"],
  ["Gate 3", "data quality and transformation correctness", "dbt tests plus custom SQL assertions"],
  ["Gate 4", "operational performance", "runtime and plan thresholds; skippable"],
  ["Gate 5", "application security", "SAST findings normalised, blocked by severity"],
];
export const BRIDGE_CONTROLS = [
  ["Webhook intake", "one controlled entry point for PR events from many repositories", "request validation and routing"],
  ["Execution orchestration", "Guardrails is called with the right repository, branch and commit", "bridge to Jenkins invocation"],
  ["Artifact custody", "summary.json and summary.html collected for every completed run", "post-run retrieval"],
  ["Compliance persistence", "a standard run record in the analytical store", "Silver schema upload"],
  ["Stakeholder notification", "every PR developer and reviewer sees the evidence", "HTML report by e-mail"],
];

// ---- the dashboard ----
export const AUDIENCES = [
  ["Audience", "engineers, Tech Leads, Platform Owner", "CTO, Governance, Audit"],
  ["Refresh", "near real time, about a minute", "daily"],
  ["Grain", "per build, per control, per asset", "per team, per month"],
  ["Question", "what is broken and who fixes it", "is the environment improving"],
  ["Retention", "90 days hot", "7 years"],
];
export const ENG_KPIS = [
  ["Deployment success rate", "passed / total builds, 7 days", "≥ 95 %", "< 85 % for 24 h"],
  ["Pipeline duration p50 / p95", "stages 1 to 15", "p95 < 15 min", "p95 > 25 min"],
  ["Top failing controls", "count by control ID, 7 days", "—", "any control in > 20 % of builds"],
  ["Blocking findings by team", "count by owner team", "trending down", "—"],
  ["Mean time to remediate", "first FAIL to first PASS on the same asset", "< 1 day", "> 3 days"],
  ["dbt test pass rate", "passed / total tests", "100 %", "any failure in prod"],
  ["Source freshness", "hours since loaded_at per source", "within error_after", "breach"],
  ["DAG compliance score", "DAGs with no blocking finding / total", "100 %", "< 98 %"],
  ["dbt compliance score", "models with no blocking finding / total", "100 %", "< 98 %"],
  ["Documentation completeness", "models with a description / total", "100 %", "< 100 %"],
  ["Column doc completeness", "columns with a description / total", "≥ 90 %", "< 85 %"],
  ["Test coverage", "models with unique + not_null / total", "100 %", "< 100 %"],
  ["Security findings open", "CRITICAL + HIGH", "0 critical", "any critical"],
  ["Active exceptions", "count, and count expiring in < 14 days", "< 15", "> 25"],
  ["Review latency p50", "PR open to first review", "< 1 day", "> 3 days"],
];
export const TODAY_KPIS = [
  ["Overall pass rate", "by day and week, from the per-gate summaries in Silver"],
  ["Gate fail distribution", "which gate fails most often"],
  ["Mean time to green", "first fail to the successful rerun"],
  ["Security findings trend", "Gate 5 counts by severity"],
  ["Schema drift incidents", "Gate 2 failure counts"],
];
export const BRIDGE_KPIS = [
  ["Bridge trigger success rate", "webhook received to Jenkins started"],
  ["Artifact collection success rate", "summary.json and summary.html retrieved"],
  ["Silver persistence success rate", "run record written"],
  ["Notification delivery success rate", "report e-mailed, recipient count"],
  ["End-to-end latency", "webhook received to report e-mailed"],
];
export const EXEC_PAGES = [
  ["Control environment health", "overall compliance score, twelve-month trend, breakdown and RAG by control domain"],
  ["Exception population", "count and age by control and team, expiring soon, and exceptions renewed more than once — the real signal that a standard is misaligned with practice"],
  ["Delivery", "deployment frequency, change failure rate, lead time, MTTR: is governance costing delivery speed?"],
  ["Risk and audit readiness", "open critical and high vulnerabilities by age, PII assets and masking coverage, attestation completion, evidence completeness"],
  ["Control effectiveness", "incidents caught before prod, incidents that escaped every control, incidents in an area with no control — the third drives the roadmap"],
];
export const SCORE_WEIGHTS = [["security", 0.30], ["governance", 0.25], ["quality", 0.20], ["operational", 0.15], ["development", 0.10]];
export const ALERTS = [
  ["Secret detected", "security channel, and page Security", "immediate", true],
  ["Prod deploy failed post-validation", "platform CI channel, and page on-call", "immediate", true],
  ["Critical vulnerability introduced", "security channel", "4 hours", false],
  ["Prod dbt test failure", "platform CI channel", "1 hour", false],
  ["Source freshness breach", "owner team channel", "1 hour", false],
  ["Exception expiring in 14 days", "owner and Governance", "daily digest", false],
  ["Compliance score drop > 5 points", "Platform Owner and Governance", "daily digest", false],
  ["DAG compliance < 98 %", "Tech Leads", "weekly", false],
];
// Three conditions page a human in the design: the two above and a third the
// framework names only by effect. Everything else is a digest.
export const PAGES_A_HUMAN = 3;

// ------------------------------------------------------------- figures ----
function ReviewFlowFig({ t }) {
  const C = PAL(t);
  const row1 = [
    ["Developer opens PR", "webhook to the bridge", "built"],
    ["CI: the gates", "five gates today; stages 1–14 in the design", "partial"],
    ["Blocking findings?", "fail → developer remediates", "built"],
    ["Tech Lead review", "logic, grain, placement, ticket", "partial"],
    ["Within standard?", "no → architecture review", "pending"],
  ];
  const row2 = [
    ["Amend the standard", "validator or policy PR", "pending"],
    ["Time-boxed exception", "≤ 90 days, two approvers", "pending"],
    ["Approve", "dev / qa: auto-merge and deploy", "partial"],
    ["Second approval", "uat / prod: Platform Owner", "pending"],
    ["Deploy gate → approval → deploy", "cp.deploy, then validate", "pending"],
  ];
  const W = 900, bw = 164, gap = 16, x0 = 10;
  return (
    <Frame t={t} vw={W} vh={210} aria={"The pull request review flow in ten boxes: the developer opens a PR, CI runs the gates, blocking findings send it back, the Tech Lead reviews what automation cannot judge, out-of-standard changes go to architecture review which amends the standard or grants a time-boxed exception, approval auto-merges to dev and qa while uat and prod take a second approval, then the deployment gate, manual approval, deploy and post-deploy validation. Three boxes are built today, three partial, four pending."}>
      <text x={x0} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>PULL REQUEST REVIEW — WHAT CI DECIDES, WHAT A PERSON DECIDES</text>
      {row1.map(([a, b, s], i) => <SBox key={a} C={C} s={s} x={x0 + i * (bw + gap)} y={30} w={bw} h={48} title={a} sub={b} />)}
      {row1.slice(0, -1).map((_, i) => <path key={"p" + i} d={`M${x0 + (i + 1) * (bw + gap) - gap + 2} 54 L${x0 + (i + 1) * (bw + gap) - 2} 54`} stroke={C.mut} strokeWidth={1.2} />)}
      <path d={`M${x0 + 4 * (bw + gap) + bw / 2} 78 L${x0 + 4 * (bw + gap) + bw / 2} 100 L${x0 + bw / 2} 100 L${x0 + bw / 2} 112`} fill="none" stroke={C.mut} strokeWidth={1.2} />
      {row2.map(([a, b, s], i) => <SBox key={a} C={C} s={s} x={x0 + i * (bw + gap)} y={112} w={bw} h={48} title={a} sub={b} />)}
      {row2.slice(0, -1).map((_, i) => <path key={"q" + i} d={`M${x0 + (i + 1) * (bw + gap) - gap + 2} 136 L${x0 + (i + 1) * (bw + gap) - 2} 136`} stroke={C.mut} strokeWidth={1.2} />)}
      <text x={x0} y={184} fontSize={9.5} fill={C.mut}>Review scope is bounded on purpose: naming, style, tests, metadata and secret hygiene are CI's. A person checks logic, grain, placement and the ticket.</text>
      <text x={x0} y={200} fontSize={9.5} fill={C.mut}>SLA: first review within one business day; blocked for three days escalates. Review latency is a leading indicator of the framework being routed around.</text>
    </Frame>);
}

function ExceptionFig({ t }) {
  const C = PAL(t);
  const steps = [
    ["Engineer requests", "control ID · asset · reason · plan · expiry"],
    ["Governance + Security", "reject → remediate instead"],
    ["Record created", "max 90 days, two approvers"],
    ["cp.deploy honours it", "CP-DEP-022 / 032"],
    ["14 days out", "owner notified"],
    ["Expired", "CP-DEP-040 blocks the deploy"],
  ];
  const W = 900, bw = 136, gap = 14, x0 = 10;
  return (
    <Frame t={t} vw={W} vh={118} aria={"The exception lifecycle in six steps, all pending today: an engineer requests a waiver naming the control, asset, reason, remediation plan and expiry; Governance and Security review it; a record is created for at most 90 days with two approvers; the deployment policy honours it; the owner is notified 14 days before expiry; an expired exception blocks the next deployment."}>
      <text x={x0} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>AN EXCEPTION IS A TIME-BOXED, TWO-PERSON WAIVER OF ONE CONTROL ON ONE ASSET</text>
      {steps.map(([a, b], i) => <SBox key={a} C={C} s="pending" x={x0 + i * (bw + gap)} y={30} w={bw} h={48} title={a} sub={b} />)}
      {steps.slice(0, -1).map((_, i) => <path key={i} d={`M${x0 + (i + 1) * (bw + gap) - gap + 2} 54 L${x0 + (i + 1) * (bw + gap) - 2} 54`} stroke={C.mut} strokeWidth={1.2} />)}
      <text x={x0} y={104} fontSize={9.5} fill={C.mut}>Exception count and age are the single most useful health metric: a rising population means the standard is misaligned with reality, and the fix is to change the standard.</text>
    </Frame>);
}

function DataFlowFig({ t }) {
  const C = PAL(t);
  const boxes = [
    ["Jenkins", "reports per gate", "built", 10, 30],
    ["Webhook bridge", "collects summary.json/.html", "built", 190, 30],
    ["Oracle SILVER", "per gate today; per control in the design", "partial", 370, 30],
    ["Metrics ingest API", "a row per control per build", "pending", 370, 96],
    ["Prometheus", "derived, 90 days", "pending", 560, 96],
    ["Grafana", "engineering view, per build", "pending", 740, 96],
    ["Daily dbt marts", "per team, per month", "pending", 560, 30],
    ["Power BI", "executive view, five pages", "pending", 740, 30],
    ["Immutable audit store", "seven years, keyed by commit", "pending", 560, 162],
    ["HTML report by e-mail", "to the PR's developers and reviewers", "built", 190, 96],
    ["Airflow StatsD", "scheduler metrics", "pending", 370, 162],
  ];
  return (
    <Frame t={t} vw={920} vh={240} aria={"The compliance dashboard data flow: Jenkins reports per gate go through the webhook bridge into the Silver schema, which is built today at gate grain, and into an HTML report by e-mail. In the design a metrics ingest API writes a row per control per build to Oracle, Prometheus derives a 90-day view for Grafana, daily dbt marts feed Power BI, and an immutable seven-year audit store sits behind both. Everything past Silver is pending."}>
      <text x={10} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>EVERYTHING LANDS IN ORACLE FIRST — PROMETHEUS IS DERIVED, NOT THE RECORD</text>
      {boxes.map(([a, b, s, x, y]) => <SBox key={a} C={C} s={s} x={x} y={y} w={166} h={48} title={a} sub={b} />)}
      {[[176, 54, 190, 54], [356, 54, 370, 54], [273, 78, 273, 96], [536, 54, 560, 54], [726, 54, 740, 54], [453, 78, 453, 96], [536, 120, 560, 120], [726, 120, 740, 120], [453, 144, 453, 162], [536, 186, 560, 186], [536, 120, 643, 162]]
        .map(([a, b, c, d], i) => <path key={i} d={`M${a} ${b} L${c} ${d}`} stroke={C.mut} strokeWidth={1.2} fill="none" />)}
      <text x={10} y={230} fontSize={9.5} fill={C.mut}>A 90-day metrics store cannot carry a seven-year audit obligation, and metrics stores are lossy by design. The record of truth is the Oracle row.</text>
    </Frame>);
}

// --------------------------------------------------------------- cards ----
export function OpsModel({ t }) {
  const C = PAL(t);
  return (<>
    <H t={t} sub="A guardrail framework fails for organisational reasons more often than technical ones: too strict to ship through, so teams route around it; or exceptions granted freely and never expiring, so the control surface erodes. Everything here makes the compliant path the fastest path and every deviation time-boxed and visible. Coloured by what exists today.">
      Operating model</H>
    <Legend t={t} note="— the job today ends at the report; most of the operating model is still to be stood up" />

    <Sub t={t}>Pull request review</Sub>
    <ReviewFlowFig t={t} />

    <Sub t={t}>Roles</Sub>
    <Tbl t={t} head={["Role", "Who", "Scope"]} rows={ROLES.map(([r, w, s]) => [<b>{r}</b>, w, s])} />
    <Sub t={t}>RACI</Sub>
    <Tbl t={t} head={["Activity", ...ROLES.map(([r]) => r.split(" ").map((w) => w[0]).join(""))]} right={[1, 2, 3, 4, 5, 6, 7]}
      rows={RACI.map(([a, ...cells]) => [a, ...cells.map((c, i) => <span key={i} style={{ fontWeight: /A/.test(c) ? 800 : 400, color: /A/.test(c) ? t.text : t.sub }}>{c}</span>)])} />
    <Note t={t}>Two deliberate choices. <b style={{ color: t.text }}>Security is accountable for severity thresholds, not the Platform Owner</b>: otherwise the team that feels the friction of a gate also decides how strict it is.{" "}
      <b style={{ color: t.text }}>Governance is accountable for exceptions, the Platform Owner only responsible</b>: the team that operates the pipeline cannot waive its own controls.</Note>

    <Sub t={t}>Environment promotion</Sub>
    <Tbl t={t} head={["", "dev", "qa", "uat", "prod", "Today", ""]} right={[1, 2, 3, 4]}
      rows={PROMOTION.map(([k, a, b, c, d, today, s]) => [<b>{k}</b>, a, b, c, d, <span style={{ color: t.sub }}>{today}</span>, <Status t={t} s={s} />])} />
    <Note t={t}>Promotion is strictly ordered dev → qa → uat → prod, and <b style={{ color: t.text }}>the same artefact SHA is promoted at each step</b>; it is never rebuilt per environment, because a rebuild means the thing tested in UAT is not the thing running in prod.
      An emergency <M>hotfix/*</M> may go straight to prod, but every blocking control still runs; it buys only the removal of advisory noise and the UAT dwell time, with a retrospective ticket within 24 hours and a post-incident review within five business days.</Note>

    <Sub t={t}>Exceptions</Sub>
    <ExceptionFig t={t} />
    <Tbl t={t} head={["Rule", "Meaning", "Enforced by"]} rows={EXCEPTION_RULES.map(([a, b, c]) => [<b>{a}</b>, b, <M>{c}</M>])} />

    <Sub t={t}>Governance cadence</Sub>
    <Tbl t={t} head={["When", "Design", "Today", ""]} rows={CADENCE.map(([a, b, c, s]) => [<b>{a}</b>, b, <span style={{ color: t.sub }}>{c}</span>, <Status t={t} s={s} />])} />
    <Note t={t}>The monthly forum, chaired by the Data Governance Lead, reviews new and expiring exceptions, advisory-finding trends, proposed control changes and control effectiveness: how many incidents an existing control <i>would</i> have caught, and how many escaped everything. Controls are code and change by PR;
      a new <b style={{ color: t.text }}>blocking control lands as advisory first for one sprint</b>, so the backlog of violations is visible before it starts failing builds.</Note>

    <Sub t={t}>Control matrix</Sub>
    <Tbl t={t} head={["Gate", "Control domain", "Primary enforcement"]} rows={GATE_DOMAINS.map(([a, b, c]) => [<b>{a}</b>, b, c])} />
    <Tbl t={t} head={["Bridge control", "Objective", "Enforcement point"]} rows={BRIDGE_CONTROLS.map(([a, b, c]) => [<b>{a}</b>, b, c])} />
    <Note t={t}>Gate pass or fail is decided by the gate outputs; the bridge controls deliver, persist and show those outputs. The aggregate is <M>fail</M> if any gate fails, else <M>pass</M> if at least one passes, else <M>skip</M>. A delivery failure at the bridge is an operational incident, never a change to the gate result.</Note>

    <Sub t={t}>Evidence chain</Sub>
    <Tbl t={t} head={["Question", "Design source", "Today", ""]} rows={EVIDENCE.map(([a, b, c, s]) => [<b>{a}</b>, b, <span style={{ color: t.sub }}>{c}</span>, <Status t={t} s={s} />])} />
    <Note t={t}>Retention in the design: <b style={{ color: t.text }}>seven years, immutable, keyed by commit SHA</b> rather than build number, so the chain survives job renames and log rotation.</Note>

    <Sub t={t}>Regulatory alignment</Sub>
    <Tbl t={t} head={["Requirement", "Supporting controls"]} rows={REG_MAP.map(([a, b]) => [<b>{a}</b>, b])} />
    <Note t={t} tone="warn">These are <b style={{ color: t.text }}>supporting</b> controls. Whether they satisfy any particular SOX or NYDFS Part 500 obligation is a determination for Internal Audit and Legal with the external auditor; the mapping is a starting point for that conversation, not a compliance claim.</Note>

    <Sub t={t}>Attestation</Sub>
    <Tbl t={t} head={["Quarterly attestation", "What it closes"]} rows={ATTEST.map(([a, b]) => [<b>{a}</b>, b])} />
    <Note t={t}>Automation can verify that metadata is <i>present</i>, not that it is <i>true</i>. The three attestations close that gap, and none of them exists today.</Note>
  </>);
}

export function Dashboards({ t }) {
  return (<>
    <H t={t} sub="An engineer needs to know which model is failing which control right now; an executive needs to know whether the control environment is improving. Different questions at different refresh rates, so two dashboards. Today there is one artefact: the HTML report by e-mail, with a per-gate summary in Silver behind it.">
      Compliance dashboard</H>
    <Legend t={t} note="— built up to the Silver row per gate; everything that reads it is pending" />

    <Sub t={t}>Two audiences</Sub>
    <Tbl t={t} head={["", "Grafana · engineering", "Power BI · executive"]} rows={AUDIENCES.map(([a, b, c]) => [<b>{a}</b>, b, c])} />

    <Sub t={t}>Data flow</Sub>
    <DataFlowFig t={t} />

    <Sub t={t}>The schema in the design</Sub>
    <Tbl t={t} head={["Table", "Grain", "What makes it the record", ""]} rows={[
      [<M>cp_guardrail_result</M>, "one row per control evaluation per build", "control ID, severity, asset, owner team, PASS / FAIL / WAIVED, exception ID; partitioned by month", <Status t={t} s="pending" />],
      [<M>cp_guardrail_build</M>, "one row per build", "result, failed stage, duration, blocking and advisory counts, change ticket, approver", <Status t={t} s="partial" />],
      [<M>cp_guardrail_exception</M>, "one row per exception", "justification, remediation plan, two approvers, granted and expiry; the 90-day cap is a database constraint, so a permanent exception is unrepresentable", <Status t={t} s="pending" />],
    ]} />
    <Note t={t}>Today the bridge writes one record per run at gate grain. The per-control row is the first item on the pending list for a reason: the score, the dashboards and the exception register all read from it.</Note>

    <Sub t={t}>What can be measured today</Sub>
    <Tbl t={t} head={["KPI", "From the per-gate summaries"]} rows={TODAY_KPIS.map(([a, b]) => [<b>{a}</b>, b])} />
    <Tbl t={t} head={["Bridge telemetry", "Start and end markers"]} rows={BRIDGE_KPIS.map(([a, b]) => [<b>{a}</b>, b])} />
    <Note t={t}>Drill-down in the current iteration: PR → Jenkins build → gate outcomes → Silver upload status → notification status. The webhook-received timestamp is the start marker for end-to-end latency.</Note>

    <Sub t={t}>Engineering KPIs in the design</Sub>
    <Tbl t={t} head={["Panel", "Metric", "Target", "Alert"]} rows={ENG_KPIS.map(([a, b, c, d]) => [<b>{a}</b>, b, c, d])} />
    <Note t={t}>Review latency sits on the engineering dashboard because a framework that creates a merge queue gets routed around. Latency is the leading indicator of abandonment.</Note>

    <Sub t={t}>Executive pages in the design</Sub>
    <Tbl t={t} head={["Page", "Shows"]} rows={EXEC_PAGES.map(([a, b], i) => [<b>{i + 1} · {a}</b>, b])} />

    <Sub t={t}>Compliance score</Sub>
    <div style={{ fontFamily: "monospace", fontSize: 12, color: t.text, background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "10px 14px", marginBottom: 10, lineHeight: 1.7 }}>
      domain_score = passing blocking controls / applicable blocking controls × 100<br />
      overall = {SCORE_WEIGHTS.map(([k, w], i) => <span key={k}>{i ? " + " : ""}{w.toFixed(2)} × {k}</span>)}
    </div>
    <Note t={t}>Weighting is deliberate: a secrets failure is not a line-length violation, and an unweighted average lets a team offset a security gap with style compliance. Advisory controls are excluded from the score.{" "}
      <b style={{ color: t.text }}>Waived controls count as failures in the score and as passes in the gate.</b> An exception lets you ship; it does not let you look compliant. That is the scoring decision that keeps the incentive pointed at remediation.</Note>

    <Sub t={t}>Alert routing</Sub>
    <Tbl t={t} head={["Condition", "Channel", "Urgency", ""]} rows={ALERTS.map(([a, b, c, page]) => [<b>{a}</b>, b, c,
      page ? <span style={{ fontSize: 9.5, fontWeight: 800, color: t.danger }}>PAGES A HUMAN</span> : <span style={{ fontSize: 9.5, color: t.textMuted }}>digest</span>])} />
    <Note t={t}>Only a handful of conditions page a person; everything else is a digest. Alert fatigue destroys a control environment faster than a missing control does: once the on-call engineer learns that most pages are noise, the one that matters is dismissed too.</Note>
  </>);
}
