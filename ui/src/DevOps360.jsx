// DevOps 360 — the delivery system, drawn the way the Hub is drawn.
//
// WHY THIS IS A SCREEN AND NOT A SLIDE. Everything here describes how a
// change reaches production: the C4 levels of the delivery system, the
// identifiers that travel through it, a swimlane per pipeline, and what
// each component becomes in a namespace. It is reference material people
// look things up in, so it lives next to the thing it describes rather
// than in a deck that goes stale in a drawer.
//
// WHAT IS DELIBERATELY NOT HERE. The release dashboard and the compare
// screen are REAL screens with REAL data — they live in Quality
// Guardrails, read guardrail_* rows, and change when a build runs.
// Drawing a second copy of them here would be a picture of a screen,
// which is the one thing a picture should never be. This page links to
// them instead.
//
// COLOUR. tDark only overrides the surface tokens, so t.success and
// t.danger are the same hex in both themes and white-on-fill is safe.
// t.accent is NOT safe — it stays #0f4775 in dark, which is a surface
// there — so the diagram accent is picked here rather than taken from
// the theme.
import React, { useState } from "react";

export const PAL = (t) => ({
  ink: t.text,
  mut: t.textMuted,
  line: t.border,
  fast: "#0091bf",   // legible on white and on #0f172a
  pin: "#7c3aed",
  ok: t.success,
  no: t.danger,
  wa: t.warning,
});

// The naming standard, as data. `perEnv` is not decoration: the rule is
// that an environment appears in a name IF AND ONLY IF the thing is
// re-made per environment, and the test checks that over this list.
export const NAMING = [
  { thing: "App release", fmt: "v + date", example: "v2026.10.01",
    perEnv: false, by: "Jenkins, merge build only" },
  { thing: "Database tag", fmt: "env + build", example: "qc-1201",
    perEnv: true, by: "Liquibase job, per environment" },
  { thing: "Image", fmt: "date + build, pinned by digest",
    example: "2026.10.01-1189 → @sha256:9f3c…", perEnv: false, by: "image job" },
  { thing: "Guardrail library", fmt: "semver", example: "3.2.0",
    perEnv: false, by: "library repo" },
  { thing: "Branch", fmt: "type/ticket-slug", example: "feature/CP-1234-scd2",
    perEnv: false, by: "developer" },
];

export const TABS = ["Context", "Containers", "Components", "Versions",
              "Promotion", "Pipelines", "Deployment"];

// Every figure is wrapped the same way: a scroll frame so a wide diagram
// scrolls inside its own box rather than pushing the page sideways, and
// role="img" with the aria text so the claim survives for a reader who
// cannot see it.
function Frame({ t, vw, vh, aria, children }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, background: t.panel, padding: "16px 16px 10px",
      marginBottom: 14 }}>
      <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={aria}
        style={{ display: "block", minWidth: Math.min(vw, 760),
          width: "100%", height: "auto" }}>
        {children}
      </svg>
    </div>);
}

function Caption({ t, children }) {
  return <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6,
    maxWidth: "74ch", marginBottom: 22 }}>{children}</div>;
}

function H({ t, children, sub }) {
  return (
    <div style={{ margin: "4px 0 10px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{children}</div>
      {sub && <div style={{ fontSize: 12.5, color: t.sub, marginTop: 3,
        maxWidth: "74ch", lineHeight: 1.6 }}>{sub}</div>}
    </div>);
}

function Note({ t, children, tone }) {
  const c = tone === "warn" ? t.warning : tone === "bad" ? t.danger : t.border;
  return (
    <div style={{ borderLeft: `3px solid ${c}`, padding: "2px 0 2px 14px",
      margin: "14px 0 20px", fontSize: 13, color: t.sub, lineHeight: 1.6,
      maxWidth: "74ch" }}>{children}</div>);
}

function Tbl({ t, head, rows, right }) {
  const r = new Set(right || []);
  return (
    <div style={{ overflowX: "auto", marginBottom: 20 }}>
      <table style={{ borderCollapse: "collapse", width: "100%",
        fontSize: 12.5, minWidth: 520 }}>
        <thead><tr>{head.map((h, i) => (
          <th key={i} style={{ textAlign: r.has(i) ? "center" : "left",
            fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
            textTransform: "uppercase", color: t.textMuted, lineHeight: 1.35,
            borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom",
            padding: "0 12px 6px 0" }}>{h}</th>))}
        </tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => (
            <td key={j} style={{ padding: "8px 12px 8px 0", verticalAlign: "top",
              borderBottom: `1px solid ${t.bg}`, color: t.text,
              textAlign: r.has(j) ? "center" : "left" }}>{cell}</td>))}
          </tr>))}
        </tbody>
      </table>
    </div>);
}

const M = ({ children }) => (
  <span style={{ fontFamily: "monospace", fontSize: ".9em" }}>{children}</span>);
function CtxFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={812} vh={356} aria={'C4 system context: the CP Integration delivery system in the centre, three people on the left who push, maintain and approve, four systems on the right it triggers from, pushes to, applies schema to and deploys into, and CP 360 and Integration360 below reading results without blocking.'}>
      <defs>
      <marker id="d360a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.ink} /></marker>
      <marker id="d360p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>L1 · SYSTEM CONTEXT</text>
      <text x={180} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>who uses delivery, and what it touches</text>
      <rect x={254} y={112} width={252} height={132} rx={3} fill="none" stroke={C.fast} strokeWidth={2.4} />
      <text x={380.0} y={129} fontSize={11.5} fontWeight={600} fill={C.fast} textAnchor="middle">CP Integration delivery</text>
      <text x={380.0} y={143} fontSize={9.5} fill={C.mut} textAnchor="middle">Jenkins · Liquibase · OpenShift</text>
      <text x={380.0} y={167} fontSize={9.5} fill={C.mut} textAnchor="middle">three pipelines, four Hub</text>
      <text x={380.0} y={179} fontSize={9.5} fill={C.mut} textAnchor="middle">instances, one guardrail library</text>
      <rect x={14} y={36} width={196} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={25} y={53} fontSize={11.5} fontWeight={600} fill={C.ink}>Data engineer</text>
      <text x={25} y={67} fontSize={9.5} fill={C.mut}>writes DAGs and dbt models</text>
      <text x={25} y={79} fontSize={9.5} fill={C.mut}>→ pushes · opens pull requests</text>
      <rect x={14} y={146} width={196} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={25} y={163} fontSize={11.5} fontWeight={600} fill={C.ink}>Platform engineer</text>
      <text x={25} y={177} fontSize={9.5} fill={C.mut}>owns images, namespaces, agent</text>
      <text x={25} y={189} fontSize={9.5} fill={C.mut}>→ maintains · bumps policy</text>
      <rect x={14} y={256} width={196} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={25} y={273} fontSize={11.5} fontWeight={600} fill={C.ink}>Approver · ARB</text>
      <text x={25} y={287} fontSize={9.5} fill={C.mut}>reads the Jenkins report</text>
      <text x={25} y={299} fontSize={9.5} fill={C.mut}>→ approves a promotion</text>
      <rect x={562} y={26} width={240} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={573} y={43} fontSize={11.5} fontWeight={600} fill={C.ink}>GitHub</text>
      <text x={573} y={57} fontSize={9.5} fill={C.mut}>repos · pull requests · branch protection</text>
      <text x={573} y={69} fontSize={9.5} fill={C.mut}>← triggers · enforces the check list</text>
      <rect x={562} y={104} width={240} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={573} y={121} fontSize={11.5} fontWeight={600} fill={C.ink}>Image registry</text>
      <text x={573} y={135} fontSize={9.5} fill={C.mut}>signed digests · SBOMs</text>
      <text x={573} y={147} fontSize={9.5} fill={C.mut}>← pushes · pulls by digest</text>
      <rect x={562} y={182} width={240} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={573} y={199} fontSize={11.5} fontWeight={600} fill={C.ink}>Oracle estate</text>
      <text x={573} y={213} fontSize={9.5} fill={C.mut}>IMDS · PBDW, a pair per environment</text>
      <text x={573} y={225} fontSize={9.5} fill={C.mut}>← Liquibase applies and tags</text>
      <rect x={562} y={260} width={240} height={62} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={573} y={277} fontSize={11.5} fontWeight={600} fill={C.ink}>OpenShift</text>
      <text x={573} y={291} fontSize={9.5} fill={C.mut}>4 Hub namespaces: DEV · SIT · QC · PROD</text>
      <text x={573} y={303} fontSize={9.5} fill={C.mut}>← deploys the thin artifact</text>
      <path d="M212,67 L232,67 L232,140 L250,140" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M212,177 L250,178" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M212,287 L232,287 L232,216 L250,216" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M508,178 L558,57" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M508,178 L558,135" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M508,178 L558,213" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <path d="M508,178 L558,291" fill="none" stroke={C.ink} strokeWidth={1.4} markerEnd="url(#d360a)" />
      <rect x={254} y={288} width={252} height={54} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} strokeDasharray="4 3" />
      <text x={380.0} y={305} fontSize={11.5} fontWeight={600} fill={C.pin} textAnchor="middle">CP 360 · Integration360</text>
      <text x={380.0} y={319} fontSize={9.5} fill={C.mut} textAnchor="middle">read the manifest and results —</text>
      <text x={380.0} y={331} fontSize={9.5} fill={C.mut} textAnchor="middle">never block a deploy</text>
      <path d="M380,248 L380,284" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360p)" />
    </Frame>);
}


function ContainerFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={392} aria={'C4 containers: source repos for the data pipeline, Liquibase changelog, three image repos and the guardrail library; a Jenkins controller and the cp-airflow-agent; three jobs for application, Liquibase and images; and targets of OpenShift namespaces, the Oracle estate, the image registry and the release store. The guardrail library is called by all three jobs.'}>
      <defs>
      <marker id="d360b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="d360q" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>L2 · CONTAINERS</text>
      <text x={148} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>the runnable pieces, and what crosses between them</text>
      <text x={14} y={44} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>SOURCE</text>
      <rect x={14} y={52} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={25} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>cp-data-pipeline</text>
      <text x={25} y={83} fontSize={9.5} fill={C.mut}>dbt models · Airflow DAGs</text>
      <text x={25} y={95} fontSize={9.5} fill={C.mut}>pins base digest + policy</text>
      <rect x={226} y={52} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={237} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>cp-liquibase</text>
      <text x={237} y={83} fontSize={9.5} fill={C.mut}>changelog · rollback blocks</text>
      <text x={237} y={95} fontSize={9.5} fill={C.mut}>its own release cadence</text>
      <rect x={438} y={52} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={449} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>3 image repos</text>
      <text x={449} y={83} fontSize={9.5} fill={C.mut}>base · workbench · agent</text>
      <text x={449} y={95} fontSize={9.5} fill={C.mut}>Dockerfiles + SBOM config</text>
      <rect x={650} y={52} width={158} height={58} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} strokeDasharray="4 3" />
      <text x={661} y={69} fontSize={11.5} fontWeight={600} fill={C.pin}>Guardrail library</text>
      <text x={661} y={83} fontSize={9.5} fill={C.mut}>shared lib + OPA bundle</text>
      <text x={661} y={95} fontSize={9.5} fill={C.mut}>semver, pinned per job</text>
      <text x={14} y={142} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>BUILD</text>
      <rect x={14} y={150} width={624} height={46} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={167} fontSize={11.5} fontWeight={600} fill={C.fast}>Jenkins controller</text>
      <text x={25} y={181} fontSize={9.5} fill={C.mut}>schedules jobs · posts status back to GitHub · holds the required-check contract</text>
      <rect x={650} y={150} width={158} height={46} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={661} y={167} fontSize={11.5} fontWeight={600} fill={C.ink}>cp-airflow-agent</text>
      <text x={661} y={181} fontSize={9.5} fill={C.mut}>pod on OpenShift</text>
      <text x={661} y={193} fontSize={9.5} fill={C.mut}>pinned per Jenkinsfile</text>
      <rect x={14} y={214} width={200} height={58} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={231} fontSize={11.5} fontWeight={600} fill={C.fast}>Application job</text>
      <text x={25} y={245} fontSize={9.5} fill={C.mut}>4 stages · 14 gates</text>
      <text x={25} y={257} fontSize={9.5} fill={C.mut}>thin artifact or DAG bundle</text>
      <rect x={226} y={214} width={200} height={58} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} />
      <text x={237} y={231} fontSize={11.5} fontWeight={600} fill={C.pin}>Liquibase job</text>
      <text x={237} y={245} fontSize={9.5} fill={C.mut}>validate · update · tag</text>
      <text x={237} y={257} fontSize={9.5} fill={C.mut}>one changelog, four databases</text>
      <rect x={438} y={214} width={200} height={58} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} />
      <text x={449} y={231} fontSize={11.5} fontWeight={600} fill={C.pin}>Image job</text>
      <text x={449} y={245} fontSize={9.5} fill={C.mut}>build · scan · sign · SBOM</text>
      <text x={449} y={257} fontSize={9.5} fill={C.mut}>push by digest</text>
      <text x={14} y={304} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>TARGETS</text>
      <rect x={14} y={312} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={25} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>OpenShift namespaces</text>
      <text x={25} y={343} fontSize={9.5} fill={C.mut}>DEV · SIT · QC · PROD</text>
      <text x={25} y={355} fontSize={9.5} fill={C.mut}>Deployments, CronJobs, Secrets</text>
      <rect x={226} y={312} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={237} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>Oracle · IMDS + PBDW</text>
      <text x={237} y={343} fontSize={9.5} fill={C.mut}>a pair per environment</text>
      <text x={237} y={355} fontSize={9.5} fill={C.mut}>changelog table per env</text>
      <rect x={438} y={312} width={200} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={449} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>Image registry</text>
      <text x={449} y={343} fontSize={9.5} fill={C.mut}>one signed digest</text>
      <text x={449} y={355} fontSize={9.5} fill={C.mut}>referenced by all four</text>
      <rect x={650} y={312} width={158} height={58} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} strokeDasharray="4 3" />
      <text x={661} y={329} fontSize={11.5} fontWeight={600} fill={C.pin}>Release store</text>
      <text x={661} y={343} fontSize={9.5} fill={C.mut}>guardrail_* tables</text>
      <text x={661} y={355} fontSize={9.5} fill={C.mut}>feeds the dashboard</text>
      <path d="M114,114 L114,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M114,200 L114,210" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M326,114 L326,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M326,200 L326,210" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M538,114 L538,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M538,200 L538,210" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M114,276 L114,308" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M326,276 L326,308" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <path d="M538,276 L538,308" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <path d="M729,114 L729,243 L642,243" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <text x={646} y={236} fontSize={9.5} fill={C.pin}>called by all three jobs</text>
      <path d="M642,341 L646,341" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
    </Frame>);
}
function ComponentFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={546} aria={'C4 components inside the application job: checkout and resolve pins, then four gate stages each emitting gate run rows, then the report publisher, artifact builder and deployer each emitting release, tag and deployment rows.'}>
      <defs>
      <marker id="d360c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="d360r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>L3 · COMPONENTS</text>
      <text x={170} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>inside the application job — every stage and what it emits</text>
      <rect x={14} y={38} width={470} height={56} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={55} fontSize={11.5} fontWeight={600} fill={C.fast}>Checkout + resolve pins</text>
      <text x={25} y={69} fontSize={9.5} fill={C.mut}>reads: base digest · policy version · required db tag</text>
      <text x={25} y={81} fontSize={9.5} fill={C.mut}>fails fast if the db tag is not applied in the target</text>
      <rect x={14} y={104} width={470} height={44} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={121} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 1 · Governance</text>
      <text x={25} y={135} fontSize={9.5} fill={C.mut}>schema · naming · lineage · orphan models</text>
      <rect x={512} y={111} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={128} fontSize={9.5} fill={C.mut}>gate_run × 4</text>
      <path d="M488,126.0 L508,126.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={158} width={470} height={44} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={175} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 2 · Performance</text>
      <text x={25} y={189} fontSize={9.5} fill={C.mut}>EXPLAIN PLAN · SLA 10K–5M · pruning · SCD2 cost</text>
      <rect x={512} y={165} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={182} fontSize={9.5} fill={C.mut}>gate_run × 4</text>
      <path d="M488,180.0 L508,180.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={212} width={470} height={44} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={229} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 3 · Testing</text>
      <text x={25} y={243} fontSize={9.5} fill={C.mut}>dbt tests · business rules · seed→gold · regression</text>
      <rect x={512} y={219} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={236} fontSize={9.5} fill={C.mut}>gate_run × 4 + manifest + run_results</text>
      <path d="M488,234.0 L508,234.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={266} width={470} height={44} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={283} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 4 · Security</text>
      <text x={25} y={297} fontSize={9.5} fill={C.mut}>secrets · CVE · SQLi · image scan — blocks on CRITICAL only</text>
      <rect x={512} y={273} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={290} fontSize={9.5} fill={C.mut}>gate_run × 4 (severity-gated)</text>
      <path d="M488,288.0 L508,288.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={330} width={470} height={44} rx={3} fill="none" stroke={C.pin} strokeWidth={1.4} />
      <text x={25} y={347} fontSize={11.5} fontWeight={600} fill={C.pin}>Report publisher</text>
      <text x={25} y={361} fontSize={9.5} fill={C.mut}>posts the status GitHub's required-check list is watching</text>
      <rect x={512} y={337} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={354} fontSize={9.5} fill={C.mut}>guardrail_release + gate_run rows</text>
      <path d="M488,352.0 L508,352.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={384} width={470} height={44} rx={3} fill="none" stroke={C.pin} strokeWidth={1.4} />
      <text x={25} y={401} fontSize={11.5} fontWeight={600} fill={C.pin}>Artifact builder</text>
      <text x={25} y={415} fontSize={9.5} fill={C.mut}>thin layer on the pinned digest, or a Git DAG bundle</text>
      <rect x={512} y={391} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={408} fontSize={9.5} fill={C.mut}>app_tag + commit_sha</text>
      <path d="M488,406.0 L508,406.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <rect x={14} y={438} width={470} height={44} rx={3} fill="none" stroke={C.pin} strokeWidth={1.4} />
      <text x={25} y={455} fontSize={11.5} fontWeight={600} fill={C.pin}>Deployer</text>
      <text x={25} y={469} fontSize={9.5} fill={C.mut}>oc apply into the target namespace · smoke check</text>
      <rect x={512} y={445} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={462} fontSize={9.5} fill={C.mut}>guardrail_deployment row</text>
      <path d="M488,460.0 L508,460.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <path d="M249,94 L249,100" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,148 L249,154" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,202 L249,208" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,256 L249,262" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,322 L249,326" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,374 L249,380" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <path d="M249,428 L249,434" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360c)" />
      <text x={512} y={26} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.pin}>EMITS — every row the dashboard later reads</text>
      <text x={14} y={512} fontSize={9.5} fill={C.mut}>A stage that fails stops the job. Stage 4 is the exception: it reports unless the finding is CRITICAL.</text>
      <text x={14} y={530} fontSize={9.5} fill={C.mut}>Nothing here runs Liquibase and nothing here builds a base image — both are resolved as pins in the first component.</text>
    </Frame>);
}


function VersionFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={388} aria={'What a version is: four pipelines each mint identifiers which together form one release record of seven fields, and each of the four Hub instances holds its own tuple while the image digest is identical in all four.'}>
      <defs>
      <marker id="d360d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>WHAT A VERSION IS</text>
      <text x={158} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>four pipelines mint identifiers; a release is the tuple</text>
      <rect x={14} y={40} width={212} height={54} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={57} fontSize={11.5} fontWeight={600} fill={C.fast}>Application job</text>
      <text x={25} y={71} fontSize={9.5} fill={C.mut}>mints: build_number · commit_sha · app_tag</text>
      <path d="M230,67 L262,67" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360d)" />
      <rect x={14} y={118} width={212} height={54} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} />
      <text x={25} y={135} fontSize={11.5} fontWeight={600} fill={C.pin}>Liquibase job</text>
      <text x={25} y={149} fontSize={9.5} fill={C.mut}>mints: db_tag</text>
      <path d="M230,145 L262,145" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360d)" />
      <rect x={14} y={196} width={212} height={54} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} />
      <text x={25} y={213} fontSize={11.5} fontWeight={600} fill={C.pin}>Image job</text>
      <text x={25} y={227} fontSize={9.5} fill={C.mut}>mints: image digest (sha256) · SBOM id</text>
      <path d="M230,223 L262,223" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360d)" />
      <rect x={14} y={274} width={212} height={54} rx={3} fill="none" stroke={C.pin} strokeWidth={1.25} />
      <text x={25} y={291} fontSize={11.5} fontWeight={600} fill={C.pin}>Guardrail library</text>
      <text x={25} y={305} fontSize={9.5} fill={C.mut}>mints: policy_version</text>
      <path d="M230,301 L262,301" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360d)" />
      <rect x={266} y={34} width={244} height={300} rx={3} fill="none" stroke={C.fast} strokeWidth={2.2} />
      <text x={388.0} y={51} fontSize={11.5} fontWeight={600} fill={C.fast} textAnchor="middle">RELEASE RECORD</text>
      <text x={282} y={62} fontSize={9.5} fill={C.mut}>release_id</text>
      <text x={494} y={62} fontSize={9.5} fill={C.fast} textAnchor="end">REL-2026.10.01</text>
      <line x1={282} y1={72} x2={494} y2={72} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={104} fontSize={9.5} fill={C.mut}>build_number</text>
      <text x={494} y={104} fontSize={9.5} fill={C.fast} textAnchor="end">1201</text>
      <line x1={282} y1={114} x2={494} y2={114} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={146} fontSize={9.5} fill={C.mut}>commit_sha</text>
      <text x={494} y={146} fontSize={9.5} fill={C.fast} textAnchor="end">4f2a9c1</text>
      <line x1={282} y1={156} x2={494} y2={156} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={188} fontSize={9.5} fill={C.mut}>app_tag</text>
      <text x={494} y={188} fontSize={9.5} fill={C.fast} textAnchor="end">v2026.10.01</text>
      <line x1={282} y1={198} x2={494} y2={198} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={230} fontSize={9.5} fill={C.mut}>db_tag</text>
      <text x={494} y={230} fontSize={9.5} fill={C.fast} textAnchor="end">qc-1201</text>
      <line x1={282} y1={240} x2={494} y2={240} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={272} fontSize={9.5} fill={C.mut}>image digest</text>
      <text x={494} y={272} fontSize={9.5} fill={C.fast} textAnchor="end">sha256:9f3c…</text>
      <line x1={282} y1={282} x2={494} y2={282} stroke={C.line} strokeOpacity={.5} />
      <text x={282} y={300} fontSize={9.5} fill={C.mut}>policy_version</text>
      <text x={494} y={300} fontSize={9.5} fill={C.fast} textAnchor="end">guardrails 3.2</text>
      <rect x={550} y={34} width={256} height={300} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={678.0} y={51} fontSize={11.5} fontWeight={600} fill={C.ink} textAnchor="middle">EVERY INSTANCE HOLDS ITS OWN TUPLE</text>
      <rect x={566} y={66} width={224} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={577} y={83} fontSize={11.5} fontWeight={600} fill={C.ink}>RD DEV</text>
      <text x={577} y={97} fontSize={9.5} fill={C.mut}>1212 · v2026.10.03 · dev-1212</text>
      <text x={577} y={109} fontSize={9.5} fill={C.mut}>digest sha256:9f3c… (same in all four)</text>
      <rect x={566} y={132} width={224} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={577} y={149} fontSize={11.5} fontWeight={600} fill={C.ink}>RD SIT</text>
      <text x={577} y={163} fontSize={9.5} fill={C.mut}>1212 · v2026.10.03 · sit-1212</text>
      <text x={577} y={175} fontSize={9.5} fill={C.mut}>digest sha256:9f3c… (same in all four)</text>
      <rect x={566} y={198} width={224} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={577} y={215} fontSize={11.5} fontWeight={600} fill={C.ink}>QC · UAT</text>
      <text x={577} y={229} fontSize={9.5} fill={C.mut}>1201 · v2026.10.01 · qc-1201</text>
      <text x={577} y={241} fontSize={9.5} fill={C.mut}>digest sha256:9f3c… (same in all four)</text>
      <rect x={566} y={264} width={224} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={577} y={281} fontSize={11.5} fontWeight={600} fill={C.ink}>PROD</text>
      <text x={577} y={295} fontSize={9.5} fill={C.mut}>1184 · v2026.09.28 · prod-1184</text>
      <text x={577} y={307} fontSize={9.5} fill={C.mut}>digest sha256:9f3c… (same in all four)</text>
      <path d="M514,184 L562,184" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360d)" />
      <text x={14} y={356} fontSize={9.5} fill={C.mut}>The digest is the only identifier that is identical everywhere. Every other one differs per instance — which is why</text>
      <text x={14} y={374} fontSize={9.5} fill={C.mut}>“what version is in QC” has no single answer, and why the board shows a tuple rather than a number.</text>
    </Frame>);
}


function PromotionFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={466} aria={'The promotion ladder across RD DEV, RD SIT, QC and production, each holding its own build, app tag, database tag and policy version, with four rows explaining what is promoted, what is re-pointed per instance, what never moves and what lags on purpose.'}>
      <defs>
      <marker id="d360e" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="d360f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>PROMOTION — REGION TO PROD</text>
      <text x={222} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>what moves, what is re-pointed, what never moves</text>
      <rect x={14} y={40} width={180} height={42} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={104.0} y={57} fontSize={11.5} fontWeight={600} fill={C.fast} textAnchor="middle">RD DEV</text>
      <text x={104.0} y={71} fontSize={9.5} fill={C.mut} textAnchor="middle">automatic on merge</text>
      <rect x={14} y={96} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={25} y={113} fontSize={9.5} fill={C.mut}>build 1212</text>
      <rect x={14} y={130} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={25} y={147} fontSize={9.5} fill={C.mut}>v2026.10.03</text>
      <rect x={14} y={164} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={25} y={181} fontSize={9.5} fill={C.mut}>dev-1212</text>
      <rect x={14} y={198} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={25} y={215} fontSize={9.5} fill={C.mut}>policy 3.2</text>
      <rect x={218} y={40} width={180} height={42} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={308.0} y={57} fontSize={11.5} fontWeight={600} fill={C.fast} textAnchor="middle">RD SIT</text>
      <text x={308.0} y={71} fontSize={9.5} fill={C.mut} textAnchor="middle">automatic</text>
      <rect x={218} y={96} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={229} y={113} fontSize={9.5} fill={C.mut}>build 1212</text>
      <rect x={218} y={130} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={229} y={147} fontSize={9.5} fill={C.mut}>v2026.10.03</text>
      <rect x={218} y={164} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={229} y={181} fontSize={9.5} fill={C.mut}>sit-1212</text>
      <rect x={218} y={198} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={229} y={215} fontSize={9.5} fill={C.mut}>policy 3.2</text>
      <rect x={422} y={40} width={180} height={42} rx={3} fill="none" stroke={C.fast} strokeWidth={1.8} />
      <text x={512.0} y={57} fontSize={11.5} fontWeight={600} fill={C.fast} textAnchor="middle">QC · UAT</text>
      <text x={512.0} y={71} fontSize={9.5} fill={C.mut} textAnchor="middle">on promotion + gates</text>
      <rect x={422} y={96} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={433} y={113} fontSize={9.5} fill={C.mut}>build 1201</text>
      <rect x={422} y={130} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={433} y={147} fontSize={9.5} fill={C.mut}>v2026.10.01</text>
      <rect x={422} y={164} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={433} y={181} fontSize={9.5} fill={C.mut}>qc-1201</text>
      <rect x={422} y={198} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={433} y={215} fontSize={9.5} fill={C.mut}>policy 3.2</text>
      <rect x={626} y={40} width={180} height={42} rx={3} fill="none" stroke={C.ok} strokeWidth={1.8} />
      <text x={716.0} y={57} fontSize={11.5} fontWeight={600} fill={C.ok} textAnchor="middle">PROD</text>
      <text x={716.0} y={71} fontSize={9.5} fill={C.mut} textAnchor="middle">on ARB approval</text>
      <rect x={626} y={96} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={637} y={113} fontSize={9.5} fill={C.mut}>build 1184</text>
      <rect x={626} y={130} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={637} y={147} fontSize={9.5} fill={C.mut}>v2026.09.28</text>
      <rect x={626} y={164} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={637} y={181} fontSize={9.5} fill={C.mut}>prod-1184</text>
      <rect x={626} y={198} width={180} height={28} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={637} y={215} fontSize={9.5} fill={C.mut}>policy 3.1</text>
      <path d="M194,61 L216,61" fill="none" stroke={C.fast} strokeWidth={1.8} markerEnd="url(#d360e)" />
      <text x={205} y={34} fontSize={9.5} fill={C.fast} textAnchor="middle">promote</text>
      <path d="M398,61 L420,61" fill="none" stroke={C.fast} strokeWidth={1.8} markerEnd="url(#d360e)" />
      <text x={409} y={34} fontSize={9.5} fill={C.fast} textAnchor="middle">promote</text>
      <path d="M602,61 L624,61" fill="none" stroke={C.fast} strokeWidth={1.8} markerEnd="url(#d360e)" />
      <text x={613} y={34} fontSize={9.5} fill={C.fast} textAnchor="middle">promote</text>
      <text x={14} y={254} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>WHAT ACTUALLY MOVES</text>
      <rect x={14} y={268} width={792} height={30} rx={3} fill="none" stroke={C.fast} strokeWidth={1.2} strokeOpacity={.65} />
      <text x={26} y={287} fontSize={11.5} fontWeight={600} fill={C.fast}>Promoted</text>
      <text x={150} y={287} fontSize={9.5} fill={C.mut}>the thin artifact and its app_tag · build_number · commit_sha move forward unchanged</text>
      <rect x={14} y={306} width={792} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1.2} strokeOpacity={.65} />
      <text x={26} y={325} fontSize={11.5} fontWeight={600} fill={C.pin}>Re-pointed</text>
      <text x={150} y={325} fontSize={9.5} fill={C.mut}>the db_tag is re-evaluated per instance — Liquibase applies its own changesets and tags locally</text>
      <rect x={14} y={344} width={792} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1.2} strokeOpacity={.65} />
      <text x={26} y={363} fontSize={11.5} fontWeight={600} fill={C.pin}>Never moves</text>
      <text x={150} y={363} fontSize={9.5} fill={C.mut}>the image digest. It is already identical everywhere; promoting it would be a no-op</text>
      <rect x={14} y={382} width={792} height={30} rx={3} fill="none" stroke={C.wa} strokeWidth={1.2} strokeOpacity={.65} />
      <text x={26} y={401} fontSize={11.5} fontWeight={600} fill={C.wa}>Lags on purpose</text>
      <text x={150} y={401} fontSize={9.5} fill={C.mut}>policy_version — production is on 3.1 while the lower regions trial 3.2</text>
      <text x={14} y={434} fontSize={9.5} fill={C.mut}>PROD is two releases behind QC here, and that is the normal state — not a backlog. A release sits in QC until</text>
      <text x={14} y={452} fontSize={9.5} fill={C.mut}>somebody signs it, and the newest build is usually the one that has travelled least far.</text>
    </Frame>);
}
function SwimApp({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={1020} vh={424} aria={'Swimlane for the application data pipeline across developer, GitHub, Jenkins, OpenShift and the release store: edit, pre-push checks, pull request, four stages writing fourteen gate rows, required checks, thin artifact, deploy writing a deployment row.'}>
      <defs>
      <marker id="swa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="swp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <rect x={8} y={34} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={58} fontSize={11.5} fontWeight={600} fill={C.ink}>Developer</text>
      <text x={16} y={72} fontSize={9.5} fill={C.mut}>ODH workspace</text>
      <rect x={8} y={106} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={130} fontSize={11.5} fontWeight={600} fill={C.ink}>GitHub</text>
      <text x={16} y={144} fontSize={9.5} fill={C.mut}>repo · PR · protection</text>
      <rect x={8} y={178} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={202} fontSize={11.5} fontWeight={600} fill={C.fast}>Jenkins</text>
      <text x={16} y={216} fontSize={9.5} fill={C.mut}>cp-airflow-agent</text>
      <rect x={8} y={250} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={274} fontSize={11.5} fontWeight={600} fill={C.ink}>OpenShift</text>
      <text x={16} y={288} fontSize={9.5} fill={C.mut}>4 Hub namespaces</text>
      <rect x={8} y={322} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={346} fontSize={11.5} fontWeight={600} fill={C.pin}>Release store</text>
      <text x={16} y={360} fontSize={9.5} fill={C.mut}>guardrail_* tables</text>
      <text x={177.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">1</text>
      <text x={305.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">2</text>
      <text x={433.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">3</text>
      <text x={561.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">4</text>
      <text x={689.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">5</text>
      <text x={817.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">6</text>
      <text x={945.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">7</text>
      <rect x={118} y={42} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={129} y={59} fontSize={11.5} fontWeight={600} fill={C.ink}>Edit</text>
      <text x={129} y={73} fontSize={9.5} fill={C.mut}>dbt model or DAG</text>
      <text x={129} y={85} fontSize={9.5} fill={C.mut}>VS Code on ODH</text>
      <rect x={246} y={42} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={257} y={59} fontSize={11.5} fontWeight={600} fill={C.ink}>git pre-push</text>
      <text x={257} y={73} fontSize={9.5} fill={C.mut}>sqlfluff · OPA</text>
      <text x={257} y={85} fontSize={9.5} fill={C.mut}>DAG import</text>
      <rect x={374} y={114} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={385} y={131} fontSize={11.5} fontWeight={600} fill={C.ink}>Pull request</text>
      <text x={385} y={145} fontSize={9.5} fill={C.mut}>peer review gate</text>
      <rect x={502} y={186} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={513} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>4 stages</text>
      <text x={513} y={217} fontSize={9.5} fill={C.mut}>14 gates on the</text>
      <text x={513} y={229} fontSize={9.5} fill={C.mut}>pinned policy</text>
      <rect x={502} y={330} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={513} y={347} fontSize={11.5} fontWeight={600} fill={C.ink}>gate_run × 14</text>
      <text x={513} y={361} fontSize={9.5} fill={C.mut}>+ manifest,</text>
      <text x={513} y={373} fontSize={9.5} fill={C.mut}>run_results</text>
      <rect x={630} y={114} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={641} y={131} fontSize={11.5} fontWeight={600} fill={C.ink}>Required checks</text>
      <text x={641} y={145} fontSize={9.5} fill={C.mut}>protection allows</text>
      <text x={641} y={157} fontSize={9.5} fill={C.mut}>the merge</text>
      <rect x={758} y={186} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={769} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Thin artifact</text>
      <text x={769} y={217} fontSize={9.5} fill={C.mut}>layer on pinned</text>
      <text x={769} y={229} fontSize={9.5} fill={C.mut}>digest · app_tag</text>
      <rect x={886} y={258} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={897} y={275} fontSize={11.5} fontWeight={600} fill={C.ink}>Deploy</text>
      <text x={897} y={289} fontSize={9.5} fill={C.mut}>DEV → SIT → QC</text>
      <text x={897} y={301} fontSize={9.5} fill={C.mut}>→ PROD on approval</text>
      <rect x={886} y={330} width={118} height={50} rx={3} fill="none" stroke={C.fast} strokeWidth={1.5} />
      <text x={897} y={347} fontSize={11.5} fontWeight={600} fill={C.ink}>deployment row</text>
      <text x={897} y={361} fontSize={9.5} fill={C.mut}>per env, per lane</text>
      <path d="M236,67.0 L244,67.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <path d="M364,67.0 L369.0,67.0 L369.0,139.0 L372,139.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <path d="M492,139.0 L497.0,139.0 L497.0,211.0 L500,211.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <path d="M620,211.0 L625.0,211.0 L625.0,139.0 L628,139.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <path d="M748,139.0 L753.0,139.0 L753.0,211.0 L756,211.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <path d="M876,211.0 L881.0,211.0 L881.0,283.0 L884,283.0" fill="none" stroke={C.fast} strokeWidth={1.5} markerEnd="url(#swa)" />
      <text x={16} y={414} fontSize={9.5} fill={C.mut}>The only wait in this lane is step 3 — a person reading the pull request. Steps 4 to 7 are unattended.</text>
      <path d="M561,236 L561,326" fill="none" stroke={C.pin} strokeWidth={1.1} strokeDasharray="3 2" markerEnd="url(#swp)" />
      <path d="M945,308 L945,326" fill="none" stroke={C.pin} strokeWidth={1.1} strokeDasharray="3 2" markerEnd="url(#swp)" />
    </Frame>);
}


function SwimDb({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={892} vh={424} aria={'Swimlane for the database pipeline: author a changeset with a rollback block, review for expand and contract, validate, apply to the target changelog, tag per environment, record applied rows, and finish ahead of the code which only checks the tag.'}>
      <defs>
      <marker id="swp2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <rect x={8} y={34} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={58} fontSize={11.5} fontWeight={600} fill={C.ink}>Engineer</text>
      <text x={16} y={72} fontSize={9.5} fill={C.mut}>authors the changeset</text>
      <rect x={8} y={106} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={130} fontSize={11.5} fontWeight={600} fill={C.ink}>GitHub</text>
      <text x={16} y={144} fontSize={9.5} fill={C.mut}>cp-liquibase repo</text>
      <rect x={8} y={178} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={202} fontSize={11.5} fontWeight={600} fill={C.pin}>Jenkins</text>
      <text x={16} y={216} fontSize={9.5} fill={C.mut}>Liquibase job</text>
      <rect x={8} y={250} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={274} fontSize={11.5} fontWeight={600} fill={C.ink}>Oracle</text>
      <text x={16} y={288} fontSize={9.5} fill={C.mut}>IMDS · PBDW per env</text>
      <rect x={8} y={322} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={346} fontSize={11.5} fontWeight={600} fill={C.pin}>Release store</text>
      <text x={16} y={360} fontSize={9.5} fill={C.mut}>changeset + applied</text>
      <text x={177.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">1</text>
      <text x={305.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">2</text>
      <text x={433.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">3</text>
      <text x={561.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">4</text>
      <text x={689.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">5</text>
      <text x={817.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">6</text>
      <rect x={118} y={42} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={129} y={59} fontSize={11.5} fontWeight={600} fill={C.ink}>Author</text>
      <text x={129} y={73} fontSize={9.5} fill={C.mut}>changeset +</text>
      <text x={129} y={85} fontSize={9.5} fill={C.mut}>rollback block</text>
      <rect x={246} y={114} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={257} y={131} fontSize={11.5} fontWeight={600} fill={C.ink}>Pull request</text>
      <text x={257} y={145} fontSize={9.5} fill={C.mut}>reviewed for</text>
      <text x={257} y={157} fontSize={9.5} fill={C.mut}>expand/contract</text>
      <rect x={374} y={186} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={385} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Validate</text>
      <text x={385} y={217} fontSize={9.5} fill={C.mut}>changelog-sync</text>
      <text x={385} y={229} fontSize={9.5} fill={C.mut}>status · dry run</text>
      <rect x={502} y={258} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={513} y={275} fontSize={11.5} fontWeight={600} fill={C.ink}>Update</text>
      <text x={513} y={289} fontSize={9.5} fill={C.mut}>apply to the</text>
      <text x={513} y={301} fontSize={9.5} fill={C.mut}>target changelog</text>
      <rect x={630} y={258} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={641} y={275} fontSize={11.5} fontWeight={600} fill={C.ink}>Tag</text>
      <text x={641} y={289} fontSize={9.5} fill={C.mut}>dev- / sit- /</text>
      <text x={641} y={301} fontSize={9.5} fill={C.mut}>qc- / prod-nnnn</text>
      <rect x={630} y={330} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={641} y={347} fontSize={11.5} fontWeight={600} fill={C.ink}>applied rows</text>
      <text x={641} y={361} fontSize={9.5} fill={C.mut}>one per changeset,</text>
      <text x={641} y={373} fontSize={9.5} fill={C.mut}>per environment</text>
      <rect x={758} y={186} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={769} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Ahead of code</text>
      <text x={769} y={217} fontSize={9.5} fill={C.mut}>the app pipeline only</text>
      <text x={769} y={229} fontSize={9.5} fill={C.mut}>CHECKS this tag</text>
      <path d="M236,67.0 L241.0,67.0 L241.0,139.0 L244,139.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M364,139.0 L369.0,139.0 L369.0,211.0 L372,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M492,211.0 L497.0,211.0 L497.0,283.0 L500,283.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M620,283.0 L628,283.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M748,283.0 L753.0,283.0 L753.0,211.0 L756,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <text x={16} y={414} fontSize={9.5} fill={C.mut}>Runs per release, never per commit. A drop is always a separate, later release.</text>
      <path d="M689,308 L689,326" fill="none" stroke={C.pin} strokeWidth={1.1} strokeDasharray="3 2" markerEnd="url(#swp2)" />
    </Frame>);
}


function SwimImg({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={1020} vh={424} aria={'Swimlane for the infrastructure image and security pipeline: bump, pull request, build, scan failing on critical, sign with an SBOM, push one immutable digest, and raise a bump pull request into every consumer.'}>
      <defs>
      <marker id="swp3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <rect x={8} y={34} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={58} fontSize={11.5} fontWeight={600} fill={C.ink}>Platform eng</text>
      <text x={16} y={72} fontSize={9.5} fill={C.mut}>owns the images</text>
      <rect x={8} y={106} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={130} fontSize={11.5} fontWeight={600} fill={C.ink}>GitHub</text>
      <text x={16} y={144} fontSize={9.5} fill={C.mut}>3 image repos</text>
      <rect x={8} y={178} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={202} fontSize={11.5} fontWeight={600} fill={C.pin}>Jenkins</text>
      <text x={16} y={216} fontSize={9.5} fill={C.mut}>image job</text>
      <rect x={8} y={250} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={274} fontSize={11.5} fontWeight={600} fill={C.ink}>Registry</text>
      <text x={16} y={288} fontSize={9.5} fill={C.mut}>signed digests</text>
      <rect x={8} y={322} width={1004} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={346} fontSize={11.5} fontWeight={600} fill={C.pin}>Consumers</text>
      <text x={16} y={360} fontSize={9.5} fill={C.mut}>repos that pin</text>
      <text x={177.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">1</text>
      <text x={305.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">2</text>
      <text x={433.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">3</text>
      <text x={561.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">4</text>
      <text x={689.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">5</text>
      <text x={817.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">6</text>
      <text x={945.0} y={24} fontSize={11} fontWeight={800} fill={C.mut} textAnchor="middle">7</text>
      <rect x={118} y={42} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={129} y={59} fontSize={11.5} fontWeight={600} fill={C.ink}>Bump</text>
      <text x={129} y={73} fontSize={9.5} fill={C.mut}>CVE patch or</text>
      <text x={129} y={85} fontSize={9.5} fill={C.mut}>version bump</text>
      <rect x={246} y={114} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={257} y={131} fontSize={11.5} fontWeight={600} fill={C.ink}>Pull request</text>
      <text x={257} y={145} fontSize={9.5} fill={C.mut}>Dockerfile +</text>
      <text x={257} y={157} fontSize={9.5} fill={C.mut}>SBOM config</text>
      <rect x={374} y={186} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={385} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Build</text>
      <text x={385} y={217} fontSize={9.5} fill={C.mut}>base · workbench</text>
      <text x={385} y={229} fontSize={9.5} fill={C.mut}>· agent</text>
      <rect x={502} y={186} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={513} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Scan</text>
      <text x={513} y={217} fontSize={9.5} fill={C.mut}>CVE · image scan</text>
      <text x={513} y={229} fontSize={9.5} fill={C.mut}>fail on CRITICAL</text>
      <rect x={630} y={186} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={641} y={203} fontSize={11.5} fontWeight={600} fill={C.ink}>Sign + SBOM</text>
      <text x={641} y={217} fontSize={9.5} fill={C.mut}>cosign · attach</text>
      <text x={641} y={229} fontSize={9.5} fill={C.mut}>provenance</text>
      <rect x={758} y={258} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={769} y={275} fontSize={11.5} fontWeight={600} fill={C.ink}>Push by digest</text>
      <text x={769} y={289} fontSize={9.5} fill={C.mut}>one immutable</text>
      <text x={769} y={301} fontSize={9.5} fill={C.mut}>sha256</text>
      <rect x={886} y={330} width={118} height={50} rx={3} fill="none" stroke={C.pin} strokeWidth={1.5} />
      <text x={897} y={347} fontSize={11.5} fontWeight={600} fill={C.ink}>Bump PR</text>
      <text x={897} y={361} fontSize={9.5} fill={C.mut}>into every repo</text>
      <text x={897} y={373} fontSize={9.5} fill={C.mut}>that pins it</text>
      <path d="M236,67.0 L241.0,67.0 L241.0,139.0 L244,139.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <path d="M364,139.0 L369.0,139.0 L369.0,211.0 L372,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <path d="M492,211.0 L500,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <path d="M620,211.0 L628,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <path d="M748,211.0 L753.0,211.0 L753.0,283.0 L756,283.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <path d="M876,283.0 L881.0,283.0 L881.0,355.0 L884,355.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp3)" />
      <text x={16} y={414} fontSize={9.5} fill={C.mut}>The last step is the one usually forgotten: a new image is not adopted until somebody merges the digest bump.</text>
    </Frame>);
}


function DeployFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={432} aria={'One Hub namespace containing Airflow webserver and scheduler Deployments, an event-listener Deployment, KubernetesPodOperator pods, a recon CronJob, and a ConfigMap, Secret and PVC; connected out to Oracle, the landing share, the image registry, SEI via Apigee and Splunk.'}>
      <defs>
      <marker id="d360g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>ONE HUB NAMESPACE</text>
      <text x={166} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>what each component becomes, and what it talks to</text>
      <rect x={14} y={32} width={486} height={346} rx={3} fill="none" stroke={C.fast} strokeWidth={2} strokeDasharray="6 4" />
      <text x={28} y={52} fontSize={11.5} fontWeight={600} fill={C.fast}>openshift namespace · cphub-&#123;env&#125;</text>
      <rect x={28} y={66} width={458} height={46} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={39} y={83} fontSize={11.5} fontWeight={600} fill={C.ink}>Deployment · airflow-webserver</text>
      <text x={39} y={97} fontSize={9.5} fill={C.mut}>1–2 replicas · pinned base digest</text>
      <rect x={28} y={118} width={458} height={46} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={39} y={135} fontSize={11.5} fontWeight={600} fill={C.ink}>Deployment · airflow-scheduler</text>
      <text x={39} y={149} fontSize={9.5} fill={C.mut}>1 replica · pinned base digest</text>
      <rect x={28} y={170} width={458} height={56} rx={3} fill="none" stroke={C.no} strokeWidth={1.5} />
      <text x={39} y={187} fontSize={11.5} fontWeight={600} fill={C.no}>Deployment · event-listener</text>
      <text x={39} y={201} fontSize={9.5} fill={C.mut}>long-running SDC consumer — needs a</text>
      <text x={39} y={213} fontSize={9.5} fill={C.mut}>restart strategy that drops no events</text>
      <rect x={28} y={234} width={458} height={56} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={39} y={251} fontSize={11.5} fontWeight={600} fill={C.ink}>KubernetesPodOperator pods</text>
      <text x={39} y={265} fontSize={9.5} fill={C.mut}>one per task · dbt run, Python loaders</text>
      <text x={39} y={277} fontSize={9.5} fill={C.mut}>image = the same pinned digest</text>
      <rect x={28} y={298} width={458} height={46} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={39} y={315} fontSize={11.5} fontWeight={600} fill={C.ink}>CronJob · G5 / G6 recon</text>
      <text x={39} y={329} fontSize={9.5} fill={C.mut}>post-publish and outbound gates</text>
      <rect x={28} y={352} width={458} height={20} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
      <text x={38} y={366} fontSize={9.5} fill={C.mut}>ConfigMap: dbt profiles · Secret: short-lived Oracle token · PVC: dbt target</text>
      <rect x={556} y={60} width={250} height={58} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={567} y={77} fontSize={11.5} fontWeight={600} fill={C.ink}>Oracle · IMDS + PBDW</text>
      <text x={567} y={91} fontSize={9.5} fill={C.mut}>JDBC · pooled</text>
      <text x={567} y={103} fontSize={9.5} fill={C.mut}>schema at the tagged version</text>
      <path d="M502,84 L552,84" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360g)" />
      <rect x={556} y={138} width={250} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={567} y={155} fontSize={11.5} fontWeight={600} fill={C.ink}>CPHUB landing share</text>
      <text x={567} y={169} fontSize={9.5} fill={C.mut}>file arrival sensors read here</text>
      <path d="M502,162 L552,162" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360g)" />
      <rect x={556} y={206} width={250} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={567} y={223} fontSize={11.5} fontWeight={600} fill={C.ink}>Image registry</text>
      <text x={567} y={237} fontSize={9.5} fill={C.mut}>pull by digest only — never :latest</text>
      <path d="M502,230 L552,230" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360g)" />
      <rect x={556} y={274} width={250} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={567} y={291} fontSize={11.5} fontWeight={600} fill={C.ink}>SEI via Apigee</text>
      <text x={567} y={305} fontSize={9.5} fill={C.mut}>outbound submissions after G6</text>
      <path d="M502,298 L552,298" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360g)" />
      <rect x={556} y={342} width={250} height={48} rx={3} fill="none" stroke={C.line} strokeWidth={1.25} />
      <text x={567} y={359} fontSize={11.5} fontWeight={600} fill={C.ink}>Splunk · monitoring</text>
      <text x={567} y={373} fontSize={9.5} fill={C.mut}>logs, lag, gate outcomes</text>
      <path d="M502,366 L552,366" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360g)" />
      <text x={14} y={400} fontSize={9.5} fill={C.no}>The event listener is the one workload that is not a scheduled task. A rolling restart that drops in-flight</text>
      <text x={14} y={418} fontSize={9.5} fill={C.no}>events is a data-loss bug, not a deployment inconvenience — and blue-green is scoped to the API lane only.</text>
    </Frame>);
}

// ===================================================================
// Panels
// ===================================================================
export function Context({ t }) {
  return (<>
    <H t={t} sub="The delivery system as one box, so the boundary is explicit before it is opened. Inside is ours; outside is a person, a contract, or a platform we do not own.">
      Who uses it</H>
    <CtxFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>One system, three kinds of
      user, four things it touches.</b> The ARB approver is a person rather
      than a step because the approval is the only part with no automation
      behind it — and the only part whose duration nobody measures today.
      Each outer box states its own relationship, so no label floats between
      boxes where it can be read against the wrong one.</Caption>
  </>);
}

export function Containers({ t }) {
  return (<>
    <H t={t} sub="Open the centre box. Four rows: where code lives, what builds it, the three jobs, and what they write to.">
      The runnable pieces</H>
    <ContainerFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>One controller, three jobs,
      one library they all call.</b> Only the application job is on the daily
      path; the other two run on their own cadence and hand over an
      identifier. The release store is the container most easily forgotten —
      without it there is no dashboard, because nothing else keeps a history
      of what ran where.</Caption>
  </>);
}

export function Components({ t }) {
  return (<>
    <H t={t} sub="The drill-down. Left is what runs, right is what it writes — and the right-hand column is exactly what the release dashboard reads back.">
      Inside the application job</H>
    <ComponentFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Each component names the rows
      it emits, because that is the contract with the dashboard.</b> A screen
      can only show what something wrote: the release board is downstream of
      this column, and any field missing here is a column that will be blank
      there.</Caption>
  </>);
}

export function Versions({ t }) {
  return (<>
    <H t={t} sub="Release management starts with agreeing what a version is. In this estate it is not one string.">
      What a version is</H>
    <VersionFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>There is no such thing as
      “the version”.</b> A release is a tuple of seven identifiers minted by
      four different pipelines, and only the image digest is the same in every
      instance. Any dashboard that prints one number per environment has
      silently chosen one of the seven and hidden the rest.</Caption>

    <H t={t} sub="Five things get a name. Everything else is a column on the release record.">
      The naming standard</H>
    <Tbl t={t} head={["Thing", "Format", "Example", "Re-made per env?", "Minted by"]}
      right={[3]}
      rows={NAMING.map((n) => [
        n.thing, n.fmt, <M>{n.example}</M>,
        <span style={{ color: n.perEnv ? t.warning : t.textMuted,
          fontWeight: n.perEnv ? 700 : 400 }}>{n.perEnv ? "yes" : "no"}</span>,
        n.by])} />
    <Note t={t}><b style={{ color: t.text }}>The one rule to remember: the
      environment appears in a name only if the thing is re-made per
      environment.</b> That is just the database tag — Liquibase genuinely
      runs four times and mints four tags. The app release and the image are
      built once and travel, so they keep the same name everywhere:{" "}
      <M>v2026.10.01</M> in QC is the identical artifact that later goes to
      production. Second release the same day: <M>v2026.10.01.2</M>.</Note>

    <Tbl t={t} head={["Always", "Never"]} rows={[
      ["Never move a tag — wrong release, next tag",
       <>No <M>:latest</M>, and never pin an image by tag</>],
      ["Lowercase and hyphens, no spaces or underscores",
       <>No <M>-rc1</M> that later becomes the real tag — it forces a rebuild</>],
      ["Pad numbers so sorting by name sorts by date",
       <>No environment in the app tag (<M>v2026.10.01-qc</M>)</>],
    ]} />

    <H t={t} sub="SemVer answers “will upgrading break me?” — a question that needs an importer. Nobody imports a dbt project; it is a deployable, not a package. A date answers the question data teams actually ask out loud.">
      Why the data pipeline uses dates</H>
    <Tbl t={t} head={["Question", "Answer", "Lives in"]} rows={[
      [<>Which <b>code</b> ran?</>, <><M>v2026.10.01</M> · build 1201</>, "the release tag"],
      [<>Which <b>data</b> did it produce?</>, <>business date <M>2026-10-03</M>, run 4</>,
        <span style={{ color: t.danger, fontWeight: 600 }}>the run record — not stored today</span>],
      [<>What <b>shape</b> is the output?</>, <><M>gld_positions</M> v2</>, "the dbt model contract"],
    ]} />
    <Note t={t} tone="warn">Two releases can produce the same business date —
      that is what a replay is — and one release produces hundreds of business
      dates over its life. The tag answers a question people ask weekly; the
      business date answers one they ask daily, and <M>GUARDRAIL_EVENTS</M> has
      no column for it. SemVer still belongs on the gold models that external
      consumers read, via dbt’s own <M>versions:</M> and{" "}
      <M>contract: enforced</M>.</Note>
  </>);
}

export function Promotion({ t }) {
  return (<>
    <H t={t} sub="What is promoted, what is re-derived locally, and what was never environment-specific to begin with.">
      Each region to prod</H>
    <PromotionFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Three different behaviours,
      drawn apart because they are routinely confused.</b> Only one row is a
      promotion. The database tag is re-derived locally, the digest was never
      environment-specific, and the policy version is deliberately behind in
      production — treating any of those as “promote it too” is how a release
      gets approved on the wrong evidence.</Caption>
  </>);
}

export function Pipelines({ t }) {
  return (<>
    <H t={t} sub="Same five-lane shape each time, so the three read as variations rather than three unrelated diagrams. The lanes are actors: who or what is holding the work at each step.">
      A swimlane per pipeline</H>
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>
      1 · Application data pipeline <span style={{ fontWeight: 400,
        color: t.textMuted, fontSize: 11.5 }}>daily</span></div>
    <SwimApp t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Five actors, seven steps, one
      human wait.</b> The release store lane is on the diagram because rows
      written there are the only reason the dashboard can answer anything
      later.</Caption>
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>
      2 · Database · Liquibase <span style={{ fontWeight: 400,
        color: t.textMuted, fontSize: 11.5 }}>per release</span></div>
    <SwimDb t={t} />
    <Caption t={t}><b style={{ color: t.text }}>This lane finishes before the
      application lane starts.</b> Every box is per release, not per commit,
      and the last one is the handover: a tag the other pipeline reads and
      never writes.</Caption>
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>
      3 · Infrastructure image &amp; security <span style={{ fontWeight: 400,
        color: t.textMuted, fontSize: 11.5 }}>CVE / bumps</span></div>
    <SwimImg t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Seven steps, and the seventh
      is the one that gets dropped.</b> Building and scanning a new image
      changes nothing on its own — the fix is live only when the digest bump
      is merged in each consumer. That step needs an owner and an SLA or the
      pins quietly rot.</Caption>
  </>);
}

export function Deployment({ t }) {
  return (<>
    <H t={t} sub="One namespace drawn in full. The other three are the same objects at different sizes, pointed at their own database.">
      What each component is deployed as</H>
    <DeployFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Four of these namespaces exist
      and they are identical except for size and the tag their schema sits
      at.</b> Everything pulls the same image digest; what differs per
      instance is the database tag, the secret, and in production the replica
      counts.</Caption>
    <Tbl t={t} head={["Component", "Deployed as", "Connected to"]} rows={[
      ["Airflow webserver / scheduler", <><M>Deployment</M> on the pinned base digest</>,
        "Oracle metadata DB · the DAG bundle or thin layer"],
      ["DAGs + dbt project", <>a <b>thin image layer</b>, or an Airflow 3 <M>Git DAG bundle</M> with no image at all</>,
        "git, when bundled — otherwise baked into the layer"],
      ["dbt runs · Python loaders", <><M>KubernetesPodOperator</M> pods, one per task</>,
        "Oracle over pooled JDBC · the landing share"],
      ["SDC event listener", <><M>Deployment</M> — long-running consumer</>,
        "SEI event hub · the event staging store"],
      ["G5 / G6 recon gates", <M>CronJob</M>, "Oracle · the guardrail event tables"],
      ["Schema", <><b>not deployed here at all</b> — applied by the Liquibase job and recorded as a tag</>,
        "IMDS · PBDW changelog tables"],
      ["Guardrail policies", <>a <b>pinned library version</b> resolved at job start, not an object in the namespace</>,
        "the Jenkins job, not the runtime"],
      ["Credentials", <><M>Secret</M> holding a short-lived token, refreshed by the platform</>,
        "no long-lived database password in the namespace"],
    ]} />
  </>);
}

// ===================================================================
export default function DevOps360({ t }) {
  const [tab, setTab] = useState("Context");
  const Panel = { Context, Containers, Components, Versions, Promotion,
                  Pipelines, Deployment }[tab];
  return (
    <div style={{ padding: "22px 26px 60px", maxWidth: 1180 }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: t.text,
        marginBottom: 4 }}>DevOps 360</div>
      <div style={{ fontSize: 13.5, color: t.sub, maxWidth: "76ch",
        lineHeight: 1.6, marginBottom: 16 }}>
        How a change reaches production — the delivery system in C4, the
        identifiers that travel through it, a swimlane per pipeline, and what
        each component becomes in a namespace. For what is running{" "}
        <i>right now</i>, and for comparing two regions, use{" "}
        <b style={{ color: t.text }}>Quality Guardrails → Releases</b>; those
        screens read live rows rather than describing them.
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`,
        marginBottom: 20, overflowX: "auto" }}>
        {TABS.map((k) => (
          <div key={k} onClick={() => setTab(k)}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px",
              cursor: "pointer", whiteSpace: "nowrap",
              color: tab === k ? t.accent : t.sub,
              borderBottom: `2px solid ${tab === k ? t.accent : "transparent"}` }}>
            {k}</div>))}
      </div>

      <Panel t={t} />
    </div>);
}
