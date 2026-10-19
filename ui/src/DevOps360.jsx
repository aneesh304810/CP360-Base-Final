// DevOps 360 — the delivery system, and what it has actually delivered.
//
// NOT A DOCUMENTATION PAGE. The map at the top is filled from
// /guardrails/deployments: an environment box says v2026.10.01 because a
// row says so, and is blank where no row exists. Under it is the release
// delivery dashboard — the same shape as the Hub component dashboard, a
// dark header of derived numbers over a filterable, exportable list of
// real deployment rows. The design material is still here, but demoted
// to a Reference row at the bottom, because it is the part that does not
// change when a build runs.
//
// EVERY NUMBER IN THE HEADER IS DERIVED FROM THE ROWS BELOW IT, never
// stored alongside them, so the summary and the list cannot disagree.
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
import React, { useState, useEffect } from "react";
// The status palette and legend live in their own module so the reference
// cards (DevOpsOps.jsx) can read them without importing this file back.
import { PAL, sp, STATUS_TEXT, Legend, SBox } from "./devopsStatus.jsx";
export { PAL, sp, STATUS_TEXT, Legend };
import { NAMING, PIPES, DB_PROCESS, IMG_PROCESS, BUILT, PENDING, GATE_FLOW, FLOW_TRACKS, RELEASE_ORDER, E2E, ENVS } from "./devopsData.js";
export { NAMING, PIPES, DB_PROCESS, IMG_PROCESS, BUILT, PENDING, GATE_FLOW, FLOW_TRACKS, RELEASE_ORDER, E2E, ENVS };
import { promotionApi } from "./guardrails_api_additions.js";

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
      <text x={380.0} y={167} fontSize={9.5} fill={C.mut} textAnchor="middle">two jobs, four Hub</text>
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
    <Frame t={t} vw={820} vh={392} aria={'C4 containers, each coloured by build status: one repo per application holding its dbt models, DAGs and its own Liquibase changelog, three image repos, all built, and the guardrail library which is not connected yet; a Jenkins controller, the webhook bridge that starts the Guardrails job, and the agent pod, all built; two jobs, application and images, with the schema stage inside the application job, the image job and schema stage built and the application job partly built; and targets of OpenShift namespaces, the Oracle estate, the image registry, all built, and the release store, partly. Green runs today, amber is partly there, dashed grey is pending.'}>
      <defs>
      <marker id="d360b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="d360q" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>L2 · CONTAINERS</text>
      <text x={148} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>the runnable pieces, and what crosses between them</text>
      <text x={14} y={44} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>SOURCE</text>
      <SBox C={C} s="built" x={14} y={52} w={200} h={58} />
      <text x={25} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>cp-data-pipeline</text>
      <text x={25} y={83} fontSize={9.5} fill={C.mut}>dbt models · DAGs · db/changelog</text>
      <text x={25} y={95} fontSize={9.5} fill={C.mut}>in Bitbucket · pins base digest</text>
      <SBox C={C} s="built" x={226} y={52} w={200} h={58} />
      <text x={237} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>every application repo</text>
      <text x={237} y={83} fontSize={9.5} fill={C.mut}>its own db/changelog · rollback blocks</text>
      <text x={237} y={95} fontSize={9.5} fill={C.mut}>same layout · own changelog table</text>
      <SBox C={C} s="built" x={438} y={52} w={200} h={58} />
      <text x={449} y={69} fontSize={11.5} fontWeight={600} fill={C.ink}>3 image repos</text>
      <text x={449} y={83} fontSize={9.5} fill={C.mut}>base · workbench · agent</text>
      <text x={449} y={95} fontSize={9.5} fill={C.mut}>Dockerfiles + SBOM config</text>
      <SBox C={C} s="pending" x={650} y={52} w={158} h={58} />
      <text x={661} y={69} fontSize={11.5} fontWeight={600} fill={C.pin}>Guardrail library</text>
      <text x={661} y={83} fontSize={9.5} fill={C.mut}>DevSecOps shared lib + OPA</text>
      <text x={661} y={95} fontSize={9.5} fill={C.mut}>not connected yet</text>
      <text x={14} y={142} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>BUILD</text>
      <SBox C={C} s="built" x={14} y={150} w={412} h={46} />
      <text x={25} y={167} fontSize={11.5} fontWeight={600} fill={C.fast}>Jenkins controller</text>
      <text x={25} y={181} fontSize={9.5} fill={C.mut}>runs the Guardrails job on the agent · result goes out through the bridge</text>
      <SBox C={C} s="built" x={438} y={150} w={200} h={46} />
      <text x={449} y={167} fontSize={11.5} fontWeight={600} fill={C.fast}>sie-webhook-bridge</text>
      <text x={449} y={181} fontSize={9.5} fill={C.mut}>PR webhooks in · job start</text>
      <text x={449} y={193} fontSize={9.5} fill={C.mut}>summary out → CP 360 metadata + email</text>
      <SBox C={C} s="built" x={650} y={150} w={158} h={46} />
      <text x={661} y={167} fontSize={11.5} fontWeight={600} fill={C.ink}>cp-airflow-agent</text>
      <text x={661} y={181} fontSize={9.5} fill={C.mut}>pod on OpenShift</text>
      <text x={661} y={193} fontSize={9.5} fill={C.mut}>pinned per Jenkinsfile</text>
      <SBox C={C} s="partial" x={14} y={214} w={200} h={58} />
      <text x={25} y={231} fontSize={11.5} fontWeight={600} fill={C.fast}>Application job</text>
      <text x={25} y={245} fontSize={9.5} fill={C.mut}>schema stage + 5 gates run</text>
      <text x={25} y={257} fontSize={9.5} fill={C.mut}>ends at the report · no artifact, no deploy yet</text>
      <SBox C={C} s="built" x={226} y={214} w={200} h={58} />
      <text x={237} y={231} fontSize={11.5} fontWeight={600} fill={C.pin}>Schema stage · Liquibase</text>
      <text x={237} y={245} fontSize={9.5} fill={C.mut}>validate · update · tag</text>
      <text x={237} y={257} fontSize={9.5} fill={C.mut}>first stage of the application job</text>
      <SBox C={C} s="built" x={438} y={214} w={200} h={58} />
      <text x={449} y={231} fontSize={11.5} fontWeight={600} fill={C.pin}>Image job</text>
      <text x={449} y={245} fontSize={9.5} fill={C.mut}>build · scan · sign · SBOM</text>
      <text x={449} y={257} fontSize={9.5} fill={C.mut}>push by digest</text>
      <text x={14} y={304} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>TARGETS</text>
      <SBox C={C} s="built" x={14} y={312} w={200} h={58} />
      <text x={25} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>OpenShift namespaces</text>
      <text x={25} y={343} fontSize={9.5} fill={C.mut}>DEV · SIT · QC · PROD</text>
      <text x={25} y={355} fontSize={9.5} fill={C.mut}>Deployments, CronJobs, Secrets</text>
      <SBox C={C} s="built" x={226} y={312} w={200} h={58} />
      <text x={237} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>Oracle · IMDS + PBDW</text>
      <text x={237} y={343} fontSize={9.5} fill={C.mut}>a pair per environment</text>
      <text x={237} y={355} fontSize={9.5} fill={C.mut}>changelog table per env</text>
      <SBox C={C} s="built" x={438} y={312} w={200} h={58} />
      <text x={449} y={329} fontSize={11.5} fontWeight={600} fill={C.ink}>Image registry</text>
      <text x={449} y={343} fontSize={9.5} fill={C.mut}>one signed digest</text>
      <text x={449} y={355} fontSize={9.5} fill={C.mut}>referenced by all four</text>
      <SBox C={C} s="partial" x={650} y={312} w={158} h={58} />
      <text x={661} y={329} fontSize={11.5} fontWeight={600} fill={C.pin}>Release store</text>
      <text x={661} y={343} fontSize={9.5} fill={C.mut}>summary → CP 360 metadata today</text>
      <text x={661} y={355} fontSize={9.5} fill={C.mut}>guardrail_* rows: not yet</text>
      <path d="M114,114 L114,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M114,200 L114,210" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M326,114 L326,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M218,243 L222,243" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M538,114 L538,146" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M438,173 L430,173" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M400,196 L400,204 L538,204 L538,210" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <path d="M114,276 L114,308" fill="none" stroke={C.fast} strokeWidth={1.4} markerEnd="url(#d360b)" />
      <path d="M326,276 L326,308" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <path d="M538,276 L538,308" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <path d="M729,114 L729,243 L642,243" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
      <text x={646} y={236} fontSize={9.5} fill={C.pin}>called by both jobs</text>
      <path d="M642,341 L646,341" fill="none" stroke={C.pin} strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#d360q)" />
    </Frame>);
}
function ComponentFig({ t }) {
  const C = PAL(t);
  return (
    <Frame t={t} vw={820} vh={546} aria={'C4 components inside the application job, each coloured by build status: checkout with pins and the Liquibase changelog built, then four gate stages of which governance, performance and testing run today as Gates 1 to 4 and security runs partly as Gate 5 without the DevSecOps thresholds, then the report publisher partly there, and the artifact builder and deployer pending. The right column lists the rows each component is meant to emit.'}>
      <defs>
      <marker id="d360c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
      <marker id="d360r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6" fill={C.ink}>L3 · COMPONENTS</text>
      <text x={170} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>inside the application job — every stage and what it emits</text>
      <SBox C={C} s="built" x={14} y={38} w={470} h={56} />
      <text x={25} y={55} fontSize={11.5} fontWeight={600} fill={C.fast}>Checkout + resolve pins</text>
      <text x={25} y={69} fontSize={9.5} fill={C.mut}>checkout of the PR’s repo, branch and commit · base digest · applies db/changelog → the db tag</text>
      <text x={25} y={81} fontSize={9.5} fill={C.mut}>policy version: not yet, the library is not connected</text>
      <SBox C={C} s="built" x={14} y={104} w={470} h={44} />
      <text x={25} y={121} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 1 · Governance</text>
      <text x={25} y={135} fontSize={9.5} fill={C.mut}>Gate 1 code quality + Gate 2 schema vs Oracle · lineage, orphans: not yet</text>
      <rect x={512} y={111} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={128} fontSize={9.5} fill={C.mut}>gate_run × 4</text>
      <path d="M488,126.0 L508,126.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="built" x={14} y={158} w={470} h={44} />
      <text x={25} y={175} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 2 · Performance</text>
      <text x={25} y={189} fontSize={9.5} fill={C.mut}>Gate 4 · Oracle thresholds and benchmarks · skippable by parameter</text>
      <rect x={512} y={165} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={182} fontSize={9.5} fill={C.mut}>gate_run × 4</text>
      <path d="M488,180.0 L508,180.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="built" x={14} y={212} w={470} h={44} />
      <text x={25} y={229} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 3 · Testing</text>
      <text x={25} y={243} fontSize={9.5} fill={C.mut}>Gate 3 · dbt compile, dbt test, custom transformation assertions</text>
      <rect x={512} y={219} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={236} fontSize={9.5} fill={C.mut}>gate_run × 4 + manifest + run_results</text>
      <path d="M488,234.0 L508,234.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="partial" x={14} y={266} w={470} h={44} />
      <text x={25} y={283} fontSize={11.5} fontWeight={600} fill={C.fast}>Stage 4 · Security</text>
      <text x={25} y={297} fontSize={9.5} fill={C.mut}>Gate 5 · Bandit + SAST · DevSecOps thresholds not connected · no secrets scan</text>
      <rect x={512} y={273} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={290} fontSize={9.5} fill={C.mut}>gate_run × 4 (severity-gated)</text>
      <path d="M488,288.0 L508,288.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="partial" x={14} y={330} w={470} h={44} />
      <text x={25} y={347} fontSize={11.5} fontWeight={600} fill={C.pin}>Report publisher</text>
      <text x={25} y={361} fontSize={9.5} fill={C.mut}>summary.json + .html → bridge → CP 360 metadata + email · no required check yet</text>
      <rect x={512} y={337} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={354} fontSize={9.5} fill={C.mut}>guardrail_release + gate_run rows</text>
      <path d="M488,352.0 L508,352.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="pending" x={14} y={384} w={470} h={44} />
      <text x={25} y={401} fontSize={11.5} fontWeight={600} fill={C.pin}>Artifact builder</text>
      <text x={25} y={415} fontSize={9.5} fill={C.mut}>thin layer on the pinned digest, or a Git DAG bundle</text>
      <rect x={512} y={391} width={296} height={30} rx={3} fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" />
      <text x={523} y={408} fontSize={9.5} fill={C.mut}>app_tag + commit_sha</text>
      <path d="M488,406.0 L508,406.0" fill="none" stroke={C.pin} strokeWidth={1} strokeDasharray="3 2" markerEnd="url(#d360r)" />
      <SBox C={C} s="pending" x={14} y={438} w={470} h={44} />
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
      <text x={14} y={512} fontSize={9.5} fill={C.mut}>Today the job writes one summary per gate, not the rows on the right: the EMITS column is the contract still to meet.</text>
      <text x={14} y={530} fontSize={9.5} fill={C.mut}>Liquibase runs in the first component, from the same checkout — validate, update, tag. The base image is still resolved as a pin, never built here.</text>
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
      <text x={25} y={135} fontSize={11.5} fontWeight={600} fill={C.pin}>Schema stage · Liquibase</text>
      <text x={25} y={149} fontSize={9.5} fill={C.mut}>mints: db_tag — per application, per env</text>
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
      <text x={150} y={325} fontSize={9.5} fill={C.mut}>the db_tag is re-evaluated per instance — the schema stage applies the changesets and tags locally</text>
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
    <Frame t={t} vw={892} vh={424} aria={'Swimlane for the schema stage of the application job: author a changeset with a rollback block in the application repo, review for expand and contract, validate, apply to the target changelog, tag per environment, record applied rows, and finish ahead of the deploy stage of the same job, which only checks the tag.'}>
      <defs>
      <marker id="swp2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <rect x={8} y={34} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={58} fontSize={11.5} fontWeight={600} fill={C.ink}>Engineer</text>
      <text x={16} y={72} fontSize={9.5} fill={C.mut}>authors the changeset</text>
      <rect x={8} y={106} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.015} stroke="none" />
      <text x={16} y={130} fontSize={11.5} fontWeight={600} fill={C.ink}>GitHub</text>
      <text x={16} y={144} fontSize={9.5} fill={C.mut}>the application repo · db/changelog</text>
      <rect x={8} y={178} width={876} height={66} rx={3} fill={C.ink} fillOpacity={0.04} stroke="none" />
      <text x={16} y={202} fontSize={11.5} fontWeight={600} fill={C.pin}>Jenkins</text>
      <text x={16} y={216} fontSize={9.5} fill={C.mut}>application job · schema stage</text>
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
      <text x={769} y={217} fontSize={9.5} fill={C.mut}>the deploy stage of the</text>
      <text x={769} y={229} fontSize={9.5} fill={C.mut}>this job CHECKS it</text>
      <path d="M236,67.0 L241.0,67.0 L241.0,139.0 L244,139.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M364,139.0 L369.0,139.0 L369.0,211.0 L372,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M492,211.0 L497.0,211.0 L497.0,283.0 L500,283.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M620,283.0 L628,283.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <path d="M748,283.0 L753.0,283.0 L753.0,211.0 L756,211.0" fill="none" stroke={C.pin} strokeWidth={1.5} markerEnd="url(#swp2)" />
      <text x={16} y={414} fontSize={9.5} fill={C.mut}>Runs per release as the first stage of the application job, never per commit. A drop is always a separate, later release.</text>
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
    <H t={t} sub="Open the centre box. Four rows: where code lives, what builds it, the two jobs, and what they write to.">
      The runnable pieces</H>
    <Legend t={t} />
    <ContainerFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>One controller, two jobs,
      one library they both call.</b> The schema is a stage of the application
      job, not a job of its own: every application repo carries its own
      Liquibase changelog beside its dbt models and DAGs, and the stage applies
      it from the same checkout, before the deploy stage, under the same
      release tag. Only the application job is on the daily path; the image
      job runs on its own cadence and hands over a digest. The release store
      is the container most easily forgotten — without it there is no
      dashboard, because nothing else keeps a history of what ran where.</Caption>
    <Note t={t}><b style={{ color: t.text }}>Where the schema lives, and who
      owns what.</b> One repo per application holds its code, its dbt project,
      its DAGs and its <M>db/changelog</M>; they are versioned, reviewed and
      released together, and the schema stage runs first so code never meets a
      table it has not been given. Each application keeps its own changelog
      table and lock on the database (<M>DATABASECHANGELOG_&lt;APP&gt;</M>), so
      two applications on one Oracle instance never serialise or confuse each
      other's deploys, and a tag is always one application's. Every object has
      exactly one owning application; a table several applications read is
      changed only in its owner's changelog. dbt owns what it builds — models,
      tests, seeds, their contracts — and Liquibase owns everything dbt does
      not create: landing and stage tables, sequences, grants, control and
      reference tables, partitions.</Note>
  </>);
}

export function Components({ t }) {
  return (<>
    <H t={t} sub="The drill-down. Left is what runs, right is what it writes — and the right-hand column is exactly what the release dashboard reads back.">
      Inside the application job</H>
    <Legend t={t} />
    <ComponentFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Each component names the rows
      it emits, because that is the contract with the dashboard.</b> A screen
      can only show what something wrote: the release board is downstream of
      this column, and any field missing here is a column that will be blank
      there.</Caption>
    <Note t={t} tone="warn"><b style={{ color: t.text }}>What runs today is
      not this figure yet.</b> The job on every pull request is the five-gate
      Guardrails pipeline: code quality, schema validation against Oracle,
      transformation quality, performance benchmark, security scan. Governance
      here is Gates 1 and 2, Performance is Gate 4, Testing is Gate 3 and
      Security is Gate 5; the schema stage runs first; the artifact builder
      and the deployer are not in it. The gap, stage by stage, opens from
      the PR intake box on the map.</Note>
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
        color: t.textMuted, fontSize: 11.5 }}>daily</span> <Status t={t} s="partial" /></div>
    <SwimApp t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Five actors, seven steps, one
      human wait.</b> The release store lane is on the diagram because rows
      written there are the only reason the dashboard can answer anything
      later.</Caption>
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>
      2 · Database · Liquibase <span style={{ fontWeight: 400,
        color: t.textMuted, fontSize: 11.5 }}>per release · the first stage of the application job</span> <Status t={t} s="built" /></div>
    <SwimDb t={t} />
    <Caption t={t}><b style={{ color: t.text }}>This lane is the first stage
      of the application job, from the same repo.</b> Every box is per
      release, not per commit, and the last one is the handover: a tag the
      deploy stage of the same job reads and never writes.</Caption>
    <Process t={t} p={DB_PROCESS} />
    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>
      3 · Infrastructure image &amp; security <span style={{ fontWeight: 400,
        color: t.textMuted, fontSize: 11.5 }}>CVE / bumps</span> <Status t={t} s="built" /></div>
    <SwimImg t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Seven steps, and the seventh
      is the one that gets dropped.</b> Building and scanning a new image
      changes nothing on its own — the fix is live only when the digest bump
      is merged in each consumer. That step needs an owner and an SLA or the
      pins quietly rot.</Caption>
    <Process t={t} p={IMG_PROCESS} />
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
      ["Schema", <><b>not deployed here at all</b> — applied by the schema stage of the application job, from the same repo, and recorded as a tag</>,
        "IMDS · PBDW changelog tables"],
      ["Guardrail policies", <>a <b>pinned library version</b> resolved at job start, not an object in the namespace</>,
        "the Jenkins job, not the runtime"],
      ["Credentials", <><M>Secret</M> holding a short-lived token, refreshed by the platform</>,
        "no long-lived database password in the namespace"],
    ]} />
  </>);
}


// ===================================================================
// The two built pipelines, as process
// ===================================================================
// The swimlanes draw the steps; these tables say who does each one,
// what has to be true to pass it, and what it writes. Data, so the test
// can check every step names a gate and a writer.
export function Process({ t, p }) {
  return (
    <div style={{ margin: "4px 0 18px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5,
        textTransform: "uppercase", color: t.textMuted, margin: "6px 0 2px" }}>
        The process · {p.title}</div>
      <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 8 }}>{p.cadence}</div>
      <Tbl t={t} head={["Step", "Who", "What happens", "Passes when", "Writes"]}
        rows={p.steps.map(([step, who, what, gate, writes]) => [
          <b style={{ color: t.text, whiteSpace: "nowrap" }}>{step}</b>,
          <span style={{ color: t.sub }}>{who}</span>,
          <span style={{ color: t.sub }}>{what}</span>,
          <span style={{ color: t.sub }}>{gate}</span>,
          <span style={{ color: t.sub, fontFamily: writes === "—" ? "inherit" : "monospace",
            fontSize: writes === "—" ? "inherit" : ".9em" }}>{writes}</span>])} />
      <ul style={{ margin: "0 0 4px", paddingLeft: 20, fontSize: 12.5, color: t.sub,
        lineHeight: 1.6, maxWidth: "80ch" }}>
        {p.rules.map((r) => <li key={r.slice(0, 24)} style={{ marginBottom: 3 }}>{r}</li>)}
      </ul>
    </div>);
}

// ===================================================================
// Built today, against the design
// ===================================================================
// The pipeline that runs on every pull request now is a different shape
// from the job the figures above draw: a webhook bridge, a checkout, five
// gates, and a report — no schema stage, no deployer. This section is the
// reconciliation, so nobody reads the C4 figures as a description of what
// is in production. The rows are data so the test can count them.
const GATES = [
  ["Load secrets", "OpenShift secret", 86],
  ["Init", "groovy", 60],
  ["Checkout", "branch · commit", 96],
  ["Setup env", "toolchain", 84],
  ["Gate 1", "code quality", 96],
  ["Gate 2", "schema vs Oracle", 96],
  ["Gate 3", "transformation", 104],
  ["Gate 4", "perf · skippable", 96],
  ["Gate 5", "security · SAST", 96],
  ["Aggregate", "json + html", 84],
];

function BuiltFig({ t }) {
  const C = PAL(t);
  const xs = []; let x = 22;
  GATES.forEach(([, , w]) => { xs.push(x); x += w + 6; });
  return (
    <Frame t={t} vw={1000} vh={380}
      aria="The Guardrails pipeline as it runs today. A pull request in Bitbucket
        sends a webhook to the sie-webhook-bridge, which starts the Jenkins
        Guardrails job with the repository, branch and commit. The job loads
        secrets, initialises, checks out the source, sets up the toolchain, then
        runs five gates in order: code quality, schema validation against Oracle,
        transformation quality, performance benchmark which can be skipped, and
        security scan; an aggregator writes summary.json and summary.html. The
        bridge collects both, uploads them to the CP 360 metadata and emails the
        HTML report to the pull request's developers and reviewers. A DevSecOps
        shared library, pinned by the job, supplies stage order, thresholds and
        release rules.">
      <defs>
        <marker id="b360a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5"
          markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
        <marker id="b360p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5"
          markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>
      <text x={14} y={20} fontSize={11} fontWeight={800} letterSpacing=".6"
        fill={C.ink}>RUNS TODAY</text>
      <text x={110} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>
        every pull request · the Guardrails job, brokered by the webhook bridge</text>

      {/* row 1: trigger, bridge, library */}
      <SBox C={C} s="built" x={14} y={40} w={118} h={56} />
      <text x={25} y={59} fontSize={11.5} fontWeight={600} fill={C.ink}>Pull request</text>
      <text x={25} y={74} fontSize={9.5} fill={C.mut}>Bitbucket · source repo</text>
      <text x={25} y={87} fontSize={9.5} fill={C.mut}>one bridge, many repos</text>
      <path d="M132,68 L176,68" fill="none" stroke={C.fast} strokeWidth={1.4}
        markerEnd="url(#b360a)" />
      <text x={154} y={62} fontSize={8.5} fill={C.mut} textAnchor="middle">webhook</text>
      <SBox C={C} s="built" x={180} y={40} w={190} h={56} />
      <text x={191} y={59} fontSize={11.5} fontWeight={600} fill={C.fast}>sie-webhook-bridge</text>
      <text x={191} y={74} fontSize={9.5} fill={C.mut}>intake · route · start the job</text>
      <text x={191} y={87} fontSize={9.5} fill={C.mut}>collect · upload · email</text>
      <path d="M265,96 L265,116" fill="none" stroke={C.fast} strokeWidth={1.4}
        markerEnd="url(#b360a)" />
      <text x={272} y={110} fontSize={8.5} fill={C.mut}>repo · branch · commit</text>
      <SBox C={C} s="pending" x={640} y={40} w={326} h={56} />
      <text x={651} y={59} fontSize={11.5} fontWeight={600} fill={C.pin}>DevSecOps shared library — not connected yet</text>
      <text x={651} y={74} fontSize={9.5} fill={C.mut}>to wire: stage order · severity thresholds · release rules · HTML outcome</text>
      <text x={651} y={87} fontSize={9.5} fill={C.mut}>once pinned by the job, a team cannot relax its gates locally</text>
      <path d="M803,96 L803,116" fill="none" stroke={C.mut} strokeWidth={1.2}
        strokeDasharray="4 3" markerEnd="url(#b360p)" />
      <text x={810} y={110} fontSize={8.5} fill={C.mut}>to connect</text>

      {/* row 2: the job */}
      <rect x={14} y={120} width={972} height={120} rx={3} fill="none"
        stroke={C.fast} strokeWidth={1.8} />
      <text x={25} y={138} fontSize={11.5} fontWeight={600} fill={C.fast}>Jenkins · Guardrails job</text>
      <text x={185} y={138} fontSize={9.5} fill={C.mut}>declarative · parameters SOURCE_REPO_URL · SOURCE_BRANCH · SOURCE_COMMIT · SKIP_GATE4 · FAST_FAIL</text>
      {GATES.map(([name, sub, w], i) => {
        const gate = /^Gate/.test(name), skip = name === "Gate 4";
        return (
          <g key={name}>
            <rect x={xs[i]} y={150} width={w} height={48} rx={3} fill={sp(C, "built").fill}
              stroke={gate ? C.fast : C.ok} strokeWidth={gate ? 1.6 : 1}
              strokeDasharray={skip ? "4 3" : undefined} />
            <text x={xs[i] + 7} y={168} fontSize={9.5} fontWeight={700}
              fill={gate ? C.fast : C.ink}>{name}</text>
            <text x={xs[i] + 7} y={182} fontSize={8.3} fill={C.mut}>{sub}</text>
            {i < GATES.length - 1 && (
              <path d={`M${xs[i] + w},174 L${xs[i + 1] - 1},174`} fill="none"
                stroke={C.fast} strokeWidth={1.2} markerEnd="url(#b360a)" />)}
          </g>);
      })}
      <text x={25} y={226} fontSize={9.5} fill={C.mut}>
        each gate writes reports/gate{"{"}n{"}"}/ · with FAST_FAIL a failed gate skips the rest · a gate is pass, fail, skip or unknown</text>

      {/* row 3: what leaves the job */}
      <path d="M932,198 L932,256 L455,256 L455,270" fill="none" stroke={C.fast}
        strokeWidth={1.4} markerEnd="url(#b360a)" />
      <path d="M154,240 L154,270" fill="none" stroke={C.pin} strokeWidth={1.2}
        strokeDasharray="4 3" markerEnd="url(#b360p)" />
      <rect x={14} y={274} width={280} height={56} rx={3} fill="none"
        stroke={C.pin} strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={25} y={293} fontSize={11.5} fontWeight={600} fill={C.pin}>reports/** archived</text>
      <text x={25} y={308} fontSize={9.5} fill={C.mut}>on the Jenkins build · workspace cleaned after</text>
      <text x={25} y={321} fontSize={9.5} fill={C.mut}>overall: fail if any gate fails, else pass, else skip</text>
      <SBox C={C} s="built" x={330} y={274} w={250} h={56} />
      <text x={341} y={293} fontSize={11.5} fontWeight={600} fill={C.fast}>Bridge collects the run</text>
      <text x={341} y={308} fontSize={9.5} fill={C.mut}>summary.json + summary.html</text>
      <text x={341} y={321} fontSize={9.5} fill={C.mut}>also when the job failed</text>
      <path d="M580,296 L636,280" fill="none" stroke={C.fast} strokeWidth={1.4}
        markerEnd="url(#b360a)" />
      <path d="M580,308 L636,328" fill="none" stroke={C.fast} strokeWidth={1.4}
        markerEnd="url(#b360a)" />
      <SBox C={C} s="built" x={640} y={262} w={326} h={36} />
      <text x={651} y={278} fontSize={11} fontWeight={600} fill={C.pin}>CP 360 metadata</text>
      <text x={651} y={291} fontSize={9.5} fill={C.mut}>run outputs, one upload per build — per gate, not per control</text>
      <SBox C={C} s="built" x={640} y={310} w={326} h={36} />
      <text x={651} y={326} fontSize={11} fontWeight={600} fill={C.pin}>Email to the PR's developers and reviewers</text>
      <text x={651} y={339} fontSize={9.5} fill={C.mut}>summary.html · a delivery failure is logged, never a gate result</text>
      <text x={14} y={366} fontSize={9.5} fill={C.mut}>
        The job ends at pass or fail. Nothing in it deploys, writes a per-control row or reads the shared library — those are the pending items.</text>
    </Frame>);
}

// One row per thing the design asks for. `status` is built, partial or
// pending; the test counts them and the page shows the count.
const STATUS = { built: ["built", "ok"], partial: ["partial", "wa"], pending: ["pending", "no"] };
function Status({ t, s }) {
  const C = PAL(t);
  const [label, k] = STATUS[s];
  return <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
    textTransform: "uppercase", color: C[k], whiteSpace: "nowrap" }}>{label}</span>;
}

export function Built({ t }) {
  const C = PAL(t);
  const n = (s) => BUILT.filter((r) => r.status === s).length;
  return (<>
    <H t={t} sub="The design on this page and the pipeline running on every pull request are not the same thing yet. This is the reconciliation: what the design asks for, what runs, and the gap.">
      Built today, against the design</H>
    <BuiltFig t={t} />
    <Caption t={t}><b style={{ color: t.text }}>Five gates after a checkout,
      a report at the end, and a bridge on both sides.</b> The bridge is the
      part the design did not draw: one intake for every repository's pull
      request webhooks, and one custody path for the evidence afterwards —
      the summary lands in the CP 360 metadata and in the inbox of everyone on
      the pull request. The gates decide pass or fail; the bridge only
      delivers that decision. Read against the application job above,
      Governance is Gates 1 and 2, Performance is Gate 4, Testing is Gate 3
      and Security is Gate 5. The schema stage runs first; the artifact
      builder and the deployer do not exist in it.</Caption>
    <div style={{ display: "flex", gap: 14, alignItems: "baseline",
      flexWrap: "wrap", margin: "0 0 10px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
        The design's stages, one by one</div>
      {["built", "partial", "pending"].map((s) => (
        <span key={s} style={{ fontSize: 11, color: t.sub }}>
          <Status t={t} s={s} /> {n(s)}</span>))}
      <span style={{ fontSize: 10.5, color: t.textMuted }}>
        partial = the concern is covered, not the way the design specifies it</span>
    </div>
    <Tbl t={t} head={["In the design", "Runs today as", "Status"]}
      rows={BUILT.map((r) => [
        <><b style={{ color: t.text }}>{r.design[0]}</b>
          <span style={{ color: t.sub }}> · {r.design[1]}</span></>,
        <span style={{ color: t.sub }}>{r.today}</span>,
        <Status t={t} s={r.status} />])} />
    <Note t={t} tone="warn"><b style={{ color: t.text }}>Two things the
      built pipeline has that the design does not.</b> Gate 2 compares the
      dbt YAML contracts to what Oracle actually holds, which catches schema
      drift the policy stages would miss; and Gate 4 benchmarks against Oracle
      performance thresholds. Both belong in the design when it is next
      revised — they are not deviations to remove.</Note>
  </>);
}

export function PendingList({ t }) {
  return (<>
    <div style={{ fontSize: 15, fontWeight: 700, color: t.text,
      margin: "22px 0 2px" }}>Pending, in the order that unlocks the rest</div>
    <div style={{ fontSize: 10.5, color: t.sub, marginBottom: 8 }}>
      the dashed and amber boxes above, as work</div>
    <ol style={{ margin: "0 0 6px", paddingLeft: 22, fontSize: 12.5,
      color: t.sub, lineHeight: 1.6, maxWidth: "80ch" }}>
      {PENDING.map(([head, body]) => (
        <li key={head} style={{ marginBottom: 5 }}>
          <b style={{ color: t.text }}>{head}</b> — {body}</li>))}
    </ol>
    <Note t={t}>The first item is the one that changes what every later
      screen can show. A result keyed by gate says a build failed; a result
      keyed by control says which rule, on which asset, owned by whom — which
      is what the compliance score, the exception register and the audit chain
      are all built from.</Note>
  </>);
}

// ===================================================================
// The live plane
// ===================================================================
// Four environment nodes that carry their own tuple, three pipeline
// nodes, and everything clickable. The diagram is not a drawing of the
// system — the boxes are filled from /guardrails/deployments, so a node
// that says v2026.10.01 says it because a row says so.
const ENV_ORDER = ["DEV", "SIT", "UAT", "PROD"];
const ENV_LABEL = { DEV: "RD DEV", SIT: "RD SIT", UAT: "QC · UAT", PROD: "PROD" };
export function FlowFig({ t, envs, open, onOpen }) {
  const C = PAL(t);
  const EW = 228, EX = (i) => 20 + i * 242;
  const node = (k) => open === k;
  const ring = (k, base) => (node(k) ? C.fast : base);
  const byEnv = {};
  (envs || []).forEach((e) => { byEnv[e.environment] = e; });
  return (
    <Frame t={t} vw={980} vh={410}
      aria="Interactive delivery map, coloured by build status. Four pipelines
        across the top — the pull request intake through the webhook bridge, which
        is built; the application data pipeline, partly built; its Liquibase schema
        stage drawn as a lane, and the infrastructure image pipeline, both built —
        feed four Hub environments in order:
        RD DEV, RD SIT, QC which is UAT, and production. Each environment box
        shows the application tag, build number and database tag currently
        deployed there. Below, the release store that every pipeline writes to
        and the guardrail library every pipeline pins. Every box opens a detail
        panel.">
      <defs>
        <marker id="f360a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.fast} /></marker>
        <marker id="f360p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.pin} /></marker>
      </defs>

      <text x={20} y={20} fontSize={11} fontWeight={800} letterSpacing=".6"
        fill={C.mut}>PIPELINES</text>
      <text x={110} y={20} fontSize={9.5} fill={C.mut} opacity={.8}>
        click any box</text>
      {PIPES.map(([k, name, sub, st], i) => (
        <g key={k} onClick={() => onOpen(node(k) ? null : k)} style={{ cursor: "pointer" }}>
          <SBox C={C} s={st} x={20 + i * 240} y={30} w={230} h={56} rx={4}
            stroke={node(k) ? C.fast : undefined} strokeWidth={node(k) ? 2.6 : undefined} />
          <text x={32 + i * 240} y={50} fontSize={11.5} fontWeight={600}
            fill={i < 2 ? C.fast : C.pin}>{name}</text>
          <text x={32 + i * 240} y={65} fontSize={9.5} fill={C.mut}>{sub}</text>
          <text x={32 + i * 240} y={78} fontSize={9} fill={C.fast}>
            {k === "intake" ? "▾ what runs, stage by stage" : "▾ open swimlane"}</text>
        </g>))}

      <text x={20} y={112} fontSize={11} fontWeight={800} letterSpacing=".6"
        fill={C.mut}>HUB INSTANCES</text>
      <text x={158} y={112} fontSize={9.5} fill={C.mut} opacity={.8}>
        live — the tuple each one currently holds</text>
      {ENV_ORDER.map((e, i) => {
        const d = byEnv[e] || {};
        const app = d.app || {}, sch = d.schema || {};
        const prod = e === "PROD";
        const warn = d.schema_ahead;
        return (
          <g key={e} onClick={() => onOpen(node("env:" + e) ? null : "env:" + e)}
            style={{ cursor: "pointer" }}>
            <rect x={EX(i)} y={136} width={EW} height={104} rx={4} fill={t.panel}
              stroke={ring("env:" + e, prod ? C.ok : C.fast)}
              strokeWidth={node("env:" + e) ? 2.6 : 1.6} />
            <text x={EX(i) + 12} y={156} fontSize={12.5} fontWeight={700}
              fill={prod ? C.ok : C.ink}>{ENV_LABEL[e]}</text>
            <text x={EX(i) + 12} y={174} fontSize={11} fontFamily="monospace"
              fill={C.ink}>{app.app_tag || "—"}</text>
            <text x={EX(i) + 12} y={188} fontSize={9.5} fontFamily="monospace"
              fill={C.mut}>build {app.build_number || "—"}</text>
            <text x={EX(i) + 12} y={206} fontSize={11} fontFamily="monospace"
              fill={C.pin}>{sch.db_tag || "—"}</text>
            <text x={EX(i) + 12} y={220} fontSize={9.5} fill={warn ? C.wa : C.mut}>
              {warn ? "schema ahead — by design" : d.lanes_aligned ? "lanes aligned" : "—"}</text>
            <text x={EX(i) + 12} y={233} fontSize={9} fill={C.fast}>▾ open</text>
          </g>);
      })}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${EX(i) + EW},188 L${EX(i + 1) - 4},188`} fill="none"
          stroke={C.fast} strokeWidth={1.8} markerEnd="url(#f360a)" />))}
      {PIPES.map((_, i) => (
        <path key={i} d={`M${140 + i * 240},90 L${140 + i * 240},126 L${134 + i * 242},126 L${134 + i * 242},132`}
          fill="none" stroke={C.pin} strokeWidth={1.2} strokeDasharray="4 3"
          markerEnd="url(#f360p)" />))}

      <g onClick={() => onOpen(node("store") ? null : "store")} style={{ cursor: "pointer" }}>
        <SBox C={C} s="partial" x={20} y={282} w={460} h={56} rx={4}
          stroke={node("store") ? C.fast : undefined} strokeWidth={node("store") ? 2.6 : undefined} />
        <text x={32} y={302} fontSize={11.5} fontWeight={600} fill={C.pin}>
          Release store</text>
        <text x={32} y={317} fontSize={9.5} fill={C.mut}>
          summary.json lands in the CP 360 metadata today · guardrail_release · gate_run · deployment · changeset: not yet</text>
        <text x={32} y={330} fontSize={9} fill={C.fast}>▾ what writes what</text>
      </g>
      <g onClick={() => onOpen(node("lib") ? null : "lib")} style={{ cursor: "pointer" }}>
        <SBox C={C} s="pending" x={500} y={282} w={460} h={56} rx={4}
          stroke={node("lib") ? C.fast : undefined} strokeWidth={node("lib") ? 2.6 : undefined} />
        <text x={512} y={302} fontSize={11.5} fontWeight={600} fill={C.pin}>
          Guardrail library · DevSecOps — not connected yet</text>
        <text x={512} y={317} fontSize={9.5} fill={C.mut}>
          to wire: stage order · thresholds · release rules · semver pinned per job · the naming standard</text>
        <text x={512} y={330} fontSize={9} fill={C.fast}>▾ the standard</text>
      </g>
      <path d="M250,244 L250,278" fill="none" stroke={C.pin} strokeWidth={1.2}
        strokeDasharray="4 3" markerEnd="url(#f360p)" />
      <text x={20} y={378} fontSize={9.5} fill={C.mut}>
        Solid arrows are promotion — the same artifact moving forward. Dashed arrows are pinned
        versions and written rows: nothing waits on them.</text>
      <text x={20} y={396} fontSize={9.5} fill={C.mut}>
        Colour is build status: green runs today, amber is covered but not as designed, dashed grey
        is nothing yet. An environment box is blank where no deployment row exists.</text>
    </Frame>);
}

// ---- detail panels, opened by clicking a node ----------------------
export function Detail({ t, open, envs, hist, onClose }) {
  if (!open) return null;
  const C = PAL(t);
  const head = (title, sub) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10,
      marginBottom: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{title}</div>
      <div style={{ fontSize: 12, color: t.sub, flex: 1 }}>{sub}</div>
      <span onClick={onClose} style={{ cursor: "pointer", fontSize: 10,
        fontWeight: 800, color: t.sub, border: `1px solid ${t.border}`,
        borderRadius: 4, padding: "3px 9px" }}>✕ close</span>
    </div>);

  if (open.startsWith("env:")) {
    const code = open.slice(4);
    const d = (envs || []).find((e) => e.environment === code) || {};
    const rows = (hist || []).filter((h) => h.environment === code).slice(0, 12);
    const lane = (nm, o, col) => (
      <div style={{ flex: "1 1 260px", border: `1px solid ${t.border}`,
        borderRadius: t.radius.md, padding: "11px 13px", minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .4,
          textTransform: "uppercase", color: col }}>{nm}</div>
        {!o ? <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
            Nothing deployed — no row for this lane.</div> : (<>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: t.text,
            marginTop: 3 }}>{o.app_tag || o.db_tag || "—"}</div>
          <div style={{ fontSize: 10.5, fontFamily: "monospace",
            color: t.textMuted, marginTop: 2 }}>
            build {o.build_number || "—"}{o.commit_sha ? ` · ${o.commit_sha}` : ""}
            {o.changesets ? ` · ${o.changesets} changesets` : ""}</div>
          <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
            {o.deployed_at || "—"} · {o.deployed_by || "—"}</div>
        </>)}
      </div>);
    return (
      <Card t={t}>
        {head(ENV_LABEL[code] || code, "what this instance is holding, and how it got there")}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {lane("Application", d.app, C.fast)}
          {lane("Schema", d.schema, C.pin)}
        </div>
        {d.schema_ahead && <Note t={t} tone="warn">The schema lane is ahead of
          the application lane here. Under expand-and-contract that is the
          design, not drift — the new columns exist and the running code does
          not use them yet.</Note>}
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5,
          textTransform: "uppercase", color: t.textMuted, margin: "4px 0 6px" }}>
          Recent deployments here</div>
        {!rows.length
          ? <div style={{ fontSize: 12.5, color: t.textMuted }}>
              No deployment rows for this environment yet.</div>
          : <Tbl t={t} head={["When", "Lane", "Release", "Build", "Status"]}
              rows={rows.map((r) => [r.deployed_at || "—", r.lane || "—",
                r.release_id || "—", <M>{r.build_number || "—"}</M>,
                <span style={{ color: r.status === "deployed" ? t.success
                  : r.status === "rolled_back" ? t.danger : t.textMuted,
                  fontWeight: 600 }}>{r.status || "—"}</span>])} />}
      </Card>);
  }

  // Written out rather than looked up in a map: a component held in a
  // variable and rendered as <Fig /> defeats the repo's own import check,
  // which cannot tell a dynamic tag from a missing import.
  const PIPE_TITLE = {
    intake: ["PR intake · webhook bridge", "built — what runs on every pull request today, and the design stage by stage"],
    app: ["Application data pipeline", "partial — the five gates run; the artifact and the deploy do not exist yet"],
    db: ["Database · Liquibase", "built — per release, the first stage of the application job; the deploy stage waits for its tag"],
    img: ["Infrastructure image & security", "built — CVE / bumps, one signed digest for all four"],
  }[open];
  if (PIPE_TITLE) {
    const [title, sub] = PIPE_TITLE;
    return (
      <Card t={t}>
        {head(title, sub)}
        {open === "intake" && <Built t={t} />}
        {open === "app" && <SwimApp t={t} />}
        {open === "db" && <><SwimDb t={t} /><Process t={t} p={DB_PROCESS} /></>}
        {open === "img" && <><SwimImg t={t} /><Process t={t} p={IMG_PROCESS} /></>}
        {open === "app" && <>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5,
            textTransform: "uppercase", color: t.textMuted, margin: "6px 0" }}>
            Inside the job — and the rows each stage writes</div>
          <Legend t={t} />
          <ComponentFig t={t} /></>}
      </Card>);
  }
  if (open === "store") {
    return (
      <Card t={t}>
        {head("Release store", "every row the screens read, and what writes it")}
        <Tbl t={t} head={["Table", "Written by", "One row per", "Status"]} rows={[
          [<M>guardrail_release</M>, "application job, at merge", "release",
            <span style={{ color: t.success }}>in use</span>],
          [<M>guardrail_gate_run</M>, "application job, per stage", "gate per build per region",
            <span style={{ color: t.warning }}>needs the full roster incl. not_run</span>],
          [<M>guardrail_deployment</M>, "application job, deploy stage", "deployment event",
            <span style={{ color: t.warning }}>missing image_digest</span>],
          [<M>guardrail_changeset</M>, "application job, schema stage", "changeset in the changelog",
            <span style={{ color: t.success }}>in use</span>],
          [<M>guardrail_changeset_applied</M>, "schema stage, per environment", "(changeset, environment)",
            <span style={{ color: t.success }}>in use</span>],
          [<M>guardrail_events</M>, "Airflow / dbt — G0 to G6", "gate per run per dataset",
            <span style={{ color: t.danger, fontWeight: 600 }}>no producer, and no business_date column</span>],
        ]} />
        <Note t={t} tone="bad">A screen can only show what something wrote.
          Three of these six are complete, two are missing a column, and one
          has no producer at all — which is why the runtime plane is empty
          rather than wrong.</Note>
      </Card>);
  }
  if (open === "lib") {
    return (<Card t={t}>{head("Versions, tags and the naming standard",
      "what each pipeline mints, and the rule that decides the shape")}
      <Versions t={t} /></Card>);
  }
  return null;
}

function Card({ t, children }) {
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md,
      background: t.panel, padding: "16px 18px", marginBottom: 18 }}>{children}</div>);
}

// ---- the release delivery dashboard --------------------------------
// Same shape as the Hub component dashboard: a dark header carrying the
// numbers, a filter row, then dense rows. The numbers are DERIVED from
// the rows below rather than stored, so the header and the list cannot
// disagree.
const LANE_LABEL = { app: "Application", schema: "Schema" };

export function Dashboard({ t, live, envs, hist, rels, onPick }) {
  const [fenv, setFenv] = useState("");
  const [flane, setFlane] = useState("");
  const [q, setQ] = useState("");

  const rows = (hist || []).filter((r) =>
    (!fenv || r.environment === fenv) &&
    (!flane || r.lane === flane) &&
    (!q || [r.release_id, r.build_number, r.app_tag, r.db_tag, r.deployed_by,
            r.notes].join(" ").toLowerCase().includes(q.toLowerCase())));

  const deployed = (envs || []).filter((e) => e.app || e.schema).length;
  const aligned = (envs || []).filter((e) => e.lanes_aligned).length;
  const blocked = (rels || []).filter((r) => r.status === "blocked").length;
  const inFlight = (rels || []).filter((r) =>
    r.status && r.status !== "released").length;
  const prod = (envs || []).find((e) => e.environment === "PROD");
  const prodTag = (prod && prod.app && prod.app.app_tag) || "—";

  const exportCsv = () => {
    const head = ["environment", "lane", "release_id", "build_number", "app_tag",
                  "db_tag", "commit_sha", "status", "deployed_at", "deployed_by"];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [head.join(",")].concat(
      rows.map((r) => head.map((k) => esc(r[k])).join(",")));
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
    a.download = "devops360-deployments.csv";
    a.click();
  };

  const tile = (n, label, col) => (
    <div style={{ textAlign: "center", minWidth: 62 }}>
      <b style={{ fontSize: 25, color: col || "#fff" }}>{n}</b>
      <div style={{ fontSize: 9, color: "#a9c1de" }}>{label}</div></div>);

  return (<>
    <div style={{ fontSize: 15, fontWeight: 700, color: t.text,
      margin: "22px 0 4px" }}>Release delivery dashboard</div>
    <div style={{ fontSize: 10.5, color: t.sub, marginBottom: 10 }}>
      what is deployed where · {live
        ? "● live — guardrail_deployment"
        : "○ no rows yet — the publisher has not written to guardrail_deployment"}
      {" "}· CSV export</div>

    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center",
        flexWrap: "wrap", background: "#10193b", color: "#fff",
        padding: "13px 18px" }}>
        {tile(deployed, `of ${(envs || []).length} instances deployed`)}
        {tile(aligned, "lanes aligned", aligned === (envs || []).length
          ? "#4cc07c" : "#e5a44a")}
        {tile(blocked, "blocked", blocked ? "#f08099" : "#fff")}
        {tile(inFlight, "in flight")}
        <div style={{ textAlign: "center", minWidth: 110 }}>
          <b style={{ fontSize: 16, fontFamily: "monospace" }}>{prodTag}</b>
          <div style={{ fontSize: 9, color: "#a9c1de" }}>live in production</div></div>
        <div style={{ flex: 1, minWidth: 220, display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, (envs || []).length)},1fr)`,
          gap: 8 }}>
          {(envs || []).map((e) => {
            const pct = (e.app ? 50 : 0) + (e.schema ? 50 : 0);
            return (
              <div key={e.environment}>
                <div style={{ fontSize: 8, color: "#a9c1de" }}>
                  {ENV_LABEL[e.environment] || e.environment}</div>
                <div style={{ height: 5, background: "#2a3a6a", borderRadius: 99,
                  marginTop: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`,
                    background: pct === 100 ? "#31bced" : "#e5a44a" }} /></div>
              </div>);
          })}
        </div>
        <span onClick={exportCsv} style={{ cursor: "pointer", fontSize: 10,
          fontWeight: 800, background: "#fff", color: "#10193b",
          borderRadius: 5, padding: "6px 11px" }}>⬇ export CSV</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center",
        padding: "9px 15px", borderBottom: `1px solid ${t.bg}`,
        flexWrap: "wrap" }}>
        <select value={fenv} onChange={(e) => setFenv(e.target.value)}
          style={{ height: 28, border: `1px solid ${t.border}`, borderRadius: 4,
            fontSize: 11, background: t.panel, color: t.text }}>
          <option value="">all environments</option>
          {ENV_ORDER.map((k) => <option key={k} value={k}>{ENV_LABEL[k]}</option>)}
        </select>
        <select value={flane} onChange={(e) => setFlane(e.target.value)}
          style={{ height: 28, border: `1px solid ${t.border}`, borderRadius: 4,
            fontSize: 11, background: t.panel, color: t.text }}>
          <option value="">both lanes</option>
          <option value="app">Application</option>
          <option value="schema">Schema</option>
        </select>
        <span style={{ fontSize: 9.5, color: t.sub }}>{rows.length} shown</span>
        <input placeholder="Search release, build, tag…" value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginLeft: "auto", height: 28, width: 220,
            border: `1px solid ${t.border}`, borderRadius: 4, fontSize: 11,
            padding: "0 8px", background: t.panel, color: t.text }} />
      </div>

      {!rows.length ? (
        <div style={{ padding: "26px 16px", fontSize: 12.5, color: t.textMuted,
          textAlign: "center" }}>
          No deployment rows.{" "}
          {live ? "Nothing matches this filter."
                : "Until a Jenkins post-build step writes to guardrail_deployment, "
                  + "this list stays empty — deliberately, rather than showing "
                  + "numbers nothing produced."}
        </div>
      ) : rows.map((r, i) => (
        <div key={r.deployment_id || i}
          onClick={() => onPick("env:" + r.environment)}
          style={{ display: "grid", cursor: "pointer",
            gridTemplateColumns: "92px 86px minmax(0,1fr) 110px 92px 108px 96px",
            gap: 10, padding: "7px 15px", fontSize: 11,
            borderTop: `1px solid ${t.bg}`, alignItems: "center" }}>
          <b style={{ color: t.text }}>{ENV_LABEL[r.environment] || r.environment}</b>
          <span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 999,
            padding: "2px 8px", textAlign: "center",
            background: t.bg, color: r.lane === "schema" ? "#7c3aed" : "#0091bf" }}>
            {LANE_LABEL[r.lane] || r.lane}</span>
          <span style={{ color: t.text, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={r.notes || r.release_id}>{r.release_id || "—"}</span>
          <span style={{ fontFamily: "monospace", fontSize: 10.5, color: t.text }}>
            {r.app_tag || r.db_tag || "—"}</span>
          <span style={{ fontFamily: "monospace", fontSize: 10.5, color: t.textMuted }}>
            {r.build_number || "—"}</span>
          <span style={{ fontSize: 10, color: t.textMuted }}>{r.deployed_at || "—"}</span>
          <span style={{ fontSize: 9, fontWeight: 800, textAlign: "center",
            borderRadius: 4, padding: "2px 6px",
            background: r.status === "deployed" ? "#e8f6ed"
              : r.status === "rolled_back" ? "#fdeaee" : "#f1f4f7",
            color: r.status === "deployed" ? "#15803d"
              : r.status === "rolled_back" ? "#c1113a" : "#6b7884" }}>
            {r.status || "—"}</span>
        </div>))}
    </div>
  </>);
}

// ===================================================================
// The operating model and the compliance dashboard, from the Guardrails
// documentation, live in their own module and read this one's palette.
import { OpsModel, Dashboards } from "./DevOpsOps.jsx";
import Overview from "./DevOpsOverview.jsx";

// The page is the team's DevOps documentation, so it is organised as one:
// an Overview first, then the detail behind it. The tab bar carries a line
// on each tab so the organisation is readable without opening anything.
export const DOC_TABS = [
  ["overview", "Overview", "the process in one picture · what is built · Liquibase in every repo · what comes next"],
  ["map", "Delivery map", "the four pipelines, live state per environment, the pending list"],
  ["pipelines", "Pipelines & process", "a swimlane per pipeline and the two built processes step by step"],
  ["reference", "Design reference", "C4 context, containers, components · versions · promotion · deployment"],
  ["ops", "Operating model", "roles · review · promotion · exceptions · evidence"],
  ["dash", "Compliance dashboard", "two audiences · KPIs · score · alerts"],
];

export default function DevOps360({ t, tab: initialTab }) {
  const [tab, setTab] = useState(initialTab || "overview");
  const [open, setOpen] = useState(null);
  const [ref, setRef] = useState("Context");
  const [envs, setEnvs] = useState([]);
  const [hist, setHist] = useState([]);
  const [rels, setRels] = useState([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let on = true;
    promotionApi.deployments().then((d) => {
      if (!on) return;
      setEnvs(d.environments || []);
      setHist(d.history || []);
      setLive(!d.unreachable && (d.history || []).length > 0);
    });
    promotionApi.releases().then((d) => { if (on) setRels(d.releases || []); });
    return () => { on = false; };
  }, []);


  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 1260 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10,
        flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: t.text }}>DevOps 360</div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5,
          borderRadius: 999, padding: "2px 9px",
          background: live ? "#e8f6ed" : "#f1f4f7",
          color: live ? "#15803d" : "#6b7884" }}>
          {live ? "● LIVE" : "○ NO ROWS YET"}</span>
      </div>
      <div style={{ fontSize: 13, color: t.sub, maxWidth: "80ch",
        lineHeight: 1.6, margin: "4px 0 14px" }}>
        The team's DevOps documentation: the delivery system, what it has
        actually delivered, and the design behind it. Every figure is coloured
        by build status, so the design and what runs on every pull request
        today are read together, not on separate pages. For what is deployed
        where, use <b style={{ color: t.text }}>Governance → Release Delivery</b>;
        for the gate matrix, <b style={{ color: t.text }}>Quality Guardrails → Releases</b>.
      </div>

      {/* The documentation's table of contents: one tab per chapter, each
          with a line that says what it holds. Overview first. */}
      <div role="tablist" aria-label="DevOps 360 sections" style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6, marginBottom: 18 }}>
        {DOC_TABS.map(([k, label, line]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ font: "inherit", textAlign: "left", cursor: "pointer", padding: "8px 11px",
              border: `1px solid ${tab === k ? t.accent : t.border}`, borderRadius: t.radius.md,
              background: tab === k ? t.accent : t.panel, color: tab === k ? "#fff" : t.text }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 10.5, opacity: tab === k ? .9 : .75, lineHeight: 1.4,
              color: tab === k ? "#fff" : t.sub }}>{line}</div>
          </button>))}
      </div>

      {tab === "overview" && <Overview t={t} onGo={setTab} />}

      {tab === "map" && <>
        <Legend t={t} note="— the figures draw the design; the colour says how much of it exists" />
        <FlowFig t={t} envs={envs} open={open} onOpen={setOpen} />
        <Detail t={t} open={open} envs={envs} hist={hist}
          onClose={() => setOpen(null)} />
        <PendingList t={t} />
        {/* The dashboard moved to Governance -> Release Delivery. This page
            is the DESIGN of the delivery system; "what is live where" is an
            operational question asked by people who never open an
            architecture page. Two audiences, two screens. */}
        <div style={{ background: t.panel, border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${t.accent}`, borderRadius: 8,
          padding: "13px 17px", margin: "22px 0 0", fontSize: 12.5,
          color: t.sub, lineHeight: 1.6, maxWidth: "80ch" }}>
          <b style={{ color: t.text }}>The release delivery dashboard has
          moved.</b> What is deployed where, with the CSV export, now lives
          under <b style={{ color: t.text }}>Governance &rarr; Release
          Delivery</b>. This page keeps the delivery system itself: the maps,
          the pipelines, what a version is and how promotion works.
        </div>
      </>}

      {tab === "pipelines" && <>
        <Legend t={t} />
        <Pipelines t={t} />
      </>}

      {tab === "reference" && <>
        <div style={{ fontSize: 10.5, color: t.sub, marginBottom: 10 }}>
          the design behind the map, coloured by what exists — nothing here is live</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {[["Context", "C4 · who uses it"], ["Containers", "C4 · the runnable pieces"],
            ["Components", "inside the job"], ["Versions", "what a version is"],
            ["Promotion", "what moves between regions"],
            ["Deployment", "what each component becomes"]].map(([k, label]) => (
            <span key={k} onClick={() => setRef(k)}
              style={{ cursor: "pointer", fontSize: 11, fontWeight: 600,
                padding: "6px 12px", borderRadius: 999,
                border: `1px solid ${ref === k ? t.accent : t.border}`,
                color: ref === k ? t.accent : t.sub,
                background: ref === k ? t.bg : t.panel }}>{label}</span>))}
        </div>
        <Card t={t}>
          {ref === "Context" && <Context t={t} />}
          {ref === "Containers" && <Containers t={t} />}
          {ref === "Components" && <Components t={t} />}
          {ref === "Versions" && <Versions t={t} />}
          {ref === "Promotion" && <Promotion t={t} />}
          {ref === "Deployment" && <Deployment t={t} />}
        </Card>
      </>}

      {tab === "ops" && <Card t={t}><OpsModel t={t} /></Card>}
      {tab === "dash" && <Card t={t}><Dashboards t={t} /></Card>}
    </div>);
}
