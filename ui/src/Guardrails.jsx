// Quality Guardrails — Overview, then one tab per environment.
//
// THE SHAPE, AND WHY. Three regions that do different work, so three tabs
// rather than one board with a region column:
//
//   Overview   the DevOps architecture — where a change goes and what
//              stops it. The only tab that is a picture.
//   SIT        builds. Which stage failed, on which commit.
//   UAT        the same shape, different gates — the volume SLA, the
//              business pack, sign-off.
//   PROD       no gates. What is actually live, and the runtime
//              guardrails watching it.
//
// SIT and UAT are deliberately the SAME SCREEN with different data. They
// ask the same question — can this build go on — and giving them two
// layouts would make a reader re-learn the page when they promote.
//
// GRAPHICAL AND TABULAR, NOT PROSE. The unit is a build × stage matrix:
// rows are builds, columns are the four CI/CD stages, each cell is one
// glyph and one colour. A reader finds the failing stage of the failing
// build without reading a sentence, then clicks the row for the gate
// list. The old screen described failures in paragraphs; this one shows
// them in a grid and keeps the words for the root cause, where they are
// the only thing that helps.
//
// A cell takes its stage's WORST outcome, not its majority — nine passes
// and a failure is a failed stage, and a cell showing the majority would
// be green on the build that is blocked. The rollup is computed in the
// API for the same reason: two passes over the same rows in two
// languages is how a matrix ends up disagreeing with the tiles above it.

import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import { promotionApi, STAGE, GATE_STATUS, REGION }
  from "./guardrails_api_additions.js";

const ENGINE = {
  great_expectations: { label: "Validation", color: "#ff6b35" },
  soda: { label: "Monitoring", color: "#1a73e8" },
  dbt: { label: "Transformation Tests", color: "#ff694a" },
  airflow: { label: "Orchestration", color: "#017cee" },
};
const SEV = { critical: "#c1113a", high: "#e67e22", medium: "#ca8a04", low: "#5f6f8f" };
const engineOf = (k) => ENGINE[k] || { label: k || "Other", color: "#5f6f8f" };

// Status never travels as colour alone: every cell and chip carries a
// glyph as well, which is what keeps the grid readable for a colour-blind
// reader and in print.
export const GLYPH = { passed: "✓", failed: "✗", warning: "!",
                       running: "◴", not_run: "·", skipped: "·" };

const TABS = ["Overview", "SIT", "UAT", "PROD"];
// The stage columns of the matrix, in pipeline order.
const STAGE_COLS = ["governance", "performance", "testing", "security", "promotion"];

export default function Guardrails({ t, selection }) {
  const [tab, setTab] = useState("Overview");
  const [rels, setRels] = useState(null);
  const [regions, setRegions] = useState(null);

  useEffect(() => { promotionApi.releases().then(setRels); }, []);
  useEffect(() => { promotionApi.regions().then(setRegions); }, []);

  return (
    <div>
      <SectionHeader t={t}>Quality Guardrails</SectionHeader>

      <SyntheticBanner t={t} payload={rels} />

      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`,
        marginBottom: 18, overflowX: "auto" }}>
        {TABS.map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            aria-pressed={tab === k}
            style={{ font: "inherit", fontSize: 12.5, fontWeight: 600,
              padding: "9px 18px", cursor: "pointer", border: 0,
              background: "none", whiteSpace: "nowrap",
              color: tab === k ? t.accent : t.sub,
              borderBottom: `2px solid ${tab === k ? t.accent : "transparent"}` }}>
            {k}</button>))}
      </div>

      {tab === "Overview" && <Overview t={t} rels={rels} regions={regions} />}
      {(tab === "SIT" || tab === "UAT") &&
        <Environment t={t} region={tab} rels={rels} />}
      {tab === "PROD" && <Production t={t} rels={rels} selection={selection} />}
    </div>
  );
}

/* ------------------------------------------------------------ banner */
export function SyntheticBanner({ t, payload }) {
  if (!payload || payload.synthetic !== true) return null;
  return (
    <div style={{ background: t.warningBg, border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.warning}`, borderRadius: t.radius.md,
      padding: "9px 14px", marginBottom: 14, fontSize: 12 }}>
      <b style={{ color: t.warning }}>Illustrative, not live.</b> No build or
      gate here came from a real run — no Jenkins hookup yet. The shapes match
      what Jenkins, dbt, Great Expectations and Airflow publish.
    </div>);
}

/* =================================================== OVERVIEW ======== */
function Overview({ t, rels, regions }) {
  const rs = (regions && regions.regions) || [];
  const meta = (k) => rs.find((x) => x.region === k) || {};
  const list = (rels && rels.releases) || [];
  const inRegion = (k) => k === "PROD"
    ? list.filter((r) => r.current_region === "PROD").length
    : list.filter((r) => r.current_region === k).length;

  return (
    <div>
      <Eyebrow t={t}>Architecture · where a change goes and what stops it</Eyebrow>
      <div style={{ background: t.panel, border: `1px solid ${t.border}`,
        borderRadius: t.radius.md, padding: "16px 14px 10px",
        marginBottom: 18, overflowX: "auto" }}>
        <FlowDiagram t={t} />
      </div>

      <Eyebrow t={t}>Regions</Eyebrow>
      <div style={{ display: "grid", gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {["SIT", "UAT", "PROD"].map((k) => {
          const d = meta(k), m = REGION[k];
          const bad = d.kind === "runtime" ? (d.critical || 0)
                                           : (d.blocking_failures || 0);
          return (
            <div key={k} style={{ background: t.panel,
              border: `1px solid ${t.border}`, borderTop: `3px solid ${m.c}`,
              borderRadius: t.radius.md, padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 14, color: m.c }}>{m.label}</b>
                <span style={{ fontSize: 10.5, color: t.textMuted }}>
                  {d.trigger || ""}</span>
                {bad > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 10,
                    fontWeight: 700, color: "#fff", background: t.danger,
                    borderRadius: 3, padding: "2px 7px" }}>
                    {GLYPH.failed} {bad}</span>)}
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                <Stat t={t} n={inRegion(k)} l="here now" />
                {d.kind === "runtime"
                  ? <Stat t={t} n={d.events ?? "—"} l="open events"
                      c={d.events ? t.danger : undefined} />
                  : <Stat t={t} n={d.gates ?? "—"} l="gate runs" />}
              </div>
              <div style={{ fontSize: 11, color: t.sub, marginTop: 10,
                lineHeight: 1.45 }}>{d.covers || ""}</div>
            </div>);
        })}
      </div>
    </div>);
}

function Stat({ t, n, l, c }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1,
        color: c || t.navy, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .4,
        textTransform: "uppercase", color: t.textMuted, marginTop: 4 }}>{l}</div>
    </div>);
}

// The architecture, compact enough for a tab. Two lanes because the
// changelog has its own repository and pipeline, and the blue pair is the
// mechanism: GitHub calls Jenkins, Jenkins answers GitHub, and the merge
// waits on that answer.
export function FlowDiagram({ t }) {
  const ink = t.navy || "#10193b", mut = t.textMuted || "#999";
  const box = { fill: "none", stroke: ink, strokeOpacity: .45 };
  return (
    <svg viewBox="0 0 900 250" role="img" style={{ display: "block",
      width: "100%", minWidth: 680, height: "auto" }}
      aria-label={"A change is authored in an Open Data Hub workspace and "
        + "pushed to GitHub. GitHub fires a webhook to Jenkins; Jenkins runs "
        + "its gates and posts a commit status back, and branch protection "
        + "holds the merge until that status is green. The schema lane does "
        + "the same from its own repository and pipeline. After the merge "
        + "the change deploys to SIT, is promoted to UAT and released to "
        + "production, which runs no gates and is watched by runtime "
        + "guardrails."}>
      <defs>
        <marker id="qgA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7"
          markerHeight="7" orient="auto">
          <polygon points="0,1 8,4 0,7" fill={ink} /></marker>
        <marker id="qgB" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7"
          markerHeight="7" orient="auto">
          <polygon points="0,1 8,4 0,7" fill="#0091bf" /></marker>
      </defs>

      {[["SIT", 560, REGION.SIT.c], ["UAT", 676, REGION.UAT.c],
        ["PROD", 792, REGION.PROD.c]].map(([k, x, c]) => (
        <g key={k}>
          <rect x={x} y="26" width="104" height="166" rx="5" fill={c}
            fillOpacity=".06" />
          <text x={x + 52} y="20" textAnchor="middle" fontSize="10.5"
            fontWeight="700" fill={c}>{k}</text>
        </g>))}

      {/* application lane */}
      <text x="8" y="48" fontSize="9.5" fontWeight="700" fill={mut}>
        APPLICATION · dbt + Airflow</text>
      <rect x="8" y="56" width="96" height="52" rx="4" {...box} />
      <text x="56" y="78" textAnchor="middle" fontSize="10.5" fill={ink}>ODH</text>
      <text x="56" y="93" textAnchor="middle" fontSize="8.5" fill={mut}>workspace</text>
      <line x1="108" y1="82" x2="126" y2="82" stroke={ink} strokeOpacity=".5"
        markerEnd="url(#qgA)" />
      <rect x="130" y="56" width="104" height="52" rx="4" {...box} />
      <text x="182" y="78" textAnchor="middle" fontSize="10.5" fill={ink}>app repo</text>
      <text x="182" y="93" textAnchor="middle" fontSize="8.5" fill={mut}>pull request</text>
      <path d="M238,68 L292,68" stroke="#0091bf" strokeWidth="2"
        markerEnd="url(#qgB)" />
      <path d="M292,98 L238,98" stroke="#0091bf" strokeWidth="2"
        strokeDasharray="5 3" markerEnd="url(#qgB)" />
      <rect x="296" y="50" width="150" height="64" rx="4" {...box} />
      <text x="306" y="68" fontSize="10" fill={ink}>Jenkins · app</text>
      <text x="306" y="83" fontSize="8.5" fill={mut}>governance · plan · tests</text>
      <text x="306" y="96" fontSize="8.5" fill={mut}>secrets · CVE · image scan</text>
      <text x="306" y="109" fontSize="8" fill={mut}>cp-airflow-agent · OpenShift</text>
      <line x1="450" y1="82" x2="556" y2="82" stroke={ink} strokeOpacity=".5"
        markerEnd="url(#qgA)" />
      <text x="503" y="76" textAnchor="middle" fontSize="8" fill={mut}>merge</text>
      <line x1="668" y1="82" x2="672" y2="82" stroke={ink} strokeOpacity=".5" />
      <text x="612" y="86" textAnchor="middle" fontSize="9.5" fill={ink}>deploy</text>
      <text x="728" y="86" textAnchor="middle" fontSize="9.5" fill={ink}>promote</text>
      <text x="844" y="86" textAnchor="middle" fontSize="9.5" fill={ink}>release</text>

      {/* schema lane */}
      <text x="8" y="140" fontSize="9.5" fontWeight="700" fill={mut}>
        SCHEMA · Liquibase</text>
      <rect x="8" y="148" width="96" height="52" rx="4" {...box} />
      <text x="56" y="170" textAnchor="middle" fontSize="10.5" fill={ink}>changeset</text>
      <text x="56" y="185" textAnchor="middle" fontSize="8.5" fill={mut}>authored</text>
      <line x1="108" y1="174" x2="126" y2="174" stroke={ink} strokeOpacity=".5"
        markerEnd="url(#qgA)" />
      <rect x="130" y="148" width="104" height="52" rx="4" {...box} />
      <text x="182" y="170" textAnchor="middle" fontSize="10.5" fill={ink}>db repo</text>
      <text x="182" y="185" textAnchor="middle" fontSize="8.5" fill={mut}>pull request</text>
      <path d="M238,160 L292,160" stroke="#0091bf" strokeWidth="2"
        markerEnd="url(#qgB)" />
      <path d="M292,190 L238,190" stroke="#0091bf" strokeWidth="2"
        strokeDasharray="5 3" markerEnd="url(#qgB)" />
      <rect x="296" y="142" width="150" height="64" rx="4" {...box} />
      <text x="306" y="160" fontSize="10" fill={ink}>Jenkins · Liquibase</text>
      <text x="306" y="175" fontSize="8.5" fill={mut} fontFamily="monospace">validate · updateSQL</text>
      <text x="306" y="188" fontSize="8.5" fill={mut} fontFamily="monospace">status — drift check</text>
      <text x="306" y="201" fontSize="8" fill={mut}>against a SIT clone</text>
      <line x1="450" y1="174" x2="556" y2="174" stroke={ink} strokeOpacity=".5"
        markerEnd="url(#qgA)" />
      <text x="612" y="178" textAnchor="middle" fontSize="9.5" fill={ink}
        fontFamily="monospace">update</text>
      <text x="728" y="178" textAnchor="middle" fontSize="9.5" fill={ink}
        fontFamily="monospace">update</text>
      <text x="844" y="178" textAnchor="middle" fontSize="9.5" fill={ink}
        fontFamily="monospace">update</text>

      <text x="250" y="232" fontSize="9.5" fill="#0091bf">
        ━━ webhook out</text>
      <text x="360" y="232" fontSize="9.5" fill="#0091bf">
        ╌╌ commit status back — the merge waits on this</text>
      <text x="8" y="232" fontSize="9.5" fill={mut}>PROD runs no gates</text>
    </svg>);
}

/* ================================================ ENVIRONMENT ======== */
// SIT and UAT, same screen, different gates.
function Environment({ t, region, rels }) {
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => { setSel(null); setDetail(null); }, [region]);
  useEffect(() => {
    if (!sel) { setDetail(null); return; }
    let live = true;
    promotionApi.release(sel).then((d) => { if (live) setDetail(d); });
    return () => { live = false; };
  }, [sel]);

  if (!rels) return <Loading t={t} />;
  // Only builds that have reached this region. A release still in SIT has
  // UAT gates recorded as not_run; listing it under UAT would say somebody
  // promoted it.
  const reached = (r) => region === "SIT"
    || ["UAT", "PROD"].includes(r.current_region);
  const list = (rels.releases || []).filter(reached);
  if (!list.length) {
    return <Empty t={t}>No build has reached {region}.</Empty>;
  }

  const d = (r) => (r.regions || {})[region] || {};
  const n = (f) => list.filter(f).length;
  const cols = STAGE_COLS.filter((s) =>
    list.some((r) => (d(r).stages || {})[s]));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16,
        flexWrap: "wrap" }}>
        <Kpi t={t} n={list.length} l="Builds" />
        <Kpi t={t} n={n((r) => d(r).state === "passed")} l="Passed"
          c="#159943" g={GLYPH.passed} />
        <Kpi t={t} n={n((r) => d(r).state === "blocked")} l="Blocked"
          c={t.danger} g={GLYPH.failed} />
        <Kpi t={t} n={n((r) => d(r).state === "running")} l="Running"
          c="#0091bf" g={GLYPH.running} />
        <Kpi t={t} n={list.reduce((a, r) => a + (d(r).warning || 0), 0)}
          l="Warnings" c="#b4620f" g={GLYPH.warning} />
      </div>

      <Eyebrow t={t}>Build × stage · {region}</Eyebrow>
      <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md,
        background: t.panel, overflowX: "auto", marginBottom: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
          minWidth: 680 }}>
          <thead>
            <tr>
              <th style={th(t)}>Build</th>
              {cols.map((s) => (
                <th key={s} style={{ ...th(t), textAlign: "center", width: 96 }}>
                  <span style={{ color: (STAGE[s] || {}).c }}>
                    {(STAGE[s] || {}).label || s}</span></th>))}
              <th style={{ ...th(t), textAlign: "right" }}>Gates</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const rd = d(r), on = sel === r.release_id;
              return (
                <tr key={r.release_id} onClick={() => setSel(on ? null : r.release_id)}
                  style={{ cursor: "pointer", borderTop: `1px solid ${t.bg}`,
                    background: on ? t.infoBg : "transparent" }}>
                  <td style={td(t)}>
                    <div style={{ fontSize: 12.5, fontWeight: 600,
                      color: t.navy }}>{r.title}</div>
                    <div style={{ fontSize: 10.5, color: t.textMuted,
                      fontFamily: "monospace", marginTop: 2 }}>
                      {r.commit_sha} · build {r.build_number} · {r.author}</div>
                  </td>
                  {cols.map((s) => (
                    <td key={s} style={{ ...td(t), textAlign: "center" }}>
                      <StageCell t={t} c={(rd.stages || {})[s]} /></td>))}
                  <td style={{ ...td(t), textAlign: "right" }}>
                    <GateBar t={t} d={rd} />
                    <div style={{ fontSize: 10.5, color: t.sub, marginTop: 5,
                      fontVariantNumeric: "tabular-nums" }}>
                      {rd.passed || 0}/{rd.total || 0}</div>
                  </td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 20 }}>
        A cell takes its stage's worst outcome. Click a build for its gates.
      </div>

      {sel && (detail
        ? <GateList t={t} detail={detail} region={region} />
        : <Loading t={t} />)}
    </div>);
}

// One stage, one cell: a glyph, a colour, and the counts on hover. The
// glyph is not decoration — it is what carries the state when the colour
// cannot.
export function StageCell({ t, c }) {
  if (!c) return <span style={{ color: t.textMuted, fontSize: 11 }}>—</span>;
  const s = GATE_STATUS[c.status] || GATE_STATUS.not_run;
  const detail = ["passed", "failed", "warning", "running", "not_run"]
    .filter((k) => c[k]).map((k) => `${c[k]} ${GATE_STATUS[k].label}`).join(" · ");
  return (
    <span title={detail} style={{ display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: 4, minWidth: 54, padding: "3px 8px",
      borderRadius: 3, background: s.bg, color: s.c, fontSize: 11,
      fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
      <span>{GLYPH[c.status] || "·"}</span>
      <span>{c.total}</span>
    </span>);
}

export function GateBar({ t, d }) {
  const total = d.total || 0;
  if (!total) return null;
  const seg = [["passed", d.passed], ["failed", d.failed],
               ["warning", d.warning], ["running", d.running],
               ["not_run", d.not_run]];
  return (
    // 2px gaps between segments rather than borders — a rule between
    // fills reads as another category.
    <span title={seg.filter(([, n]) => n)
        .map(([k, n]) => `${n} ${GATE_STATUS[k].label}`).join(" · ")}
      style={{ display: "flex", gap: 2, height: 5, maxWidth: 130,
        marginLeft: "auto" }}>
      {seg.map(([k, n]) => (n ? (
        <i key={k} style={{ display: "block", borderRadius: 1,
          background: GATE_STATUS[k].c, flex: n }} />) : null))}
    </span>);
}

// The gate list for one build in one region, grouped by stage. The words
// live here, where a root cause is the only thing that helps.
export function GateList({ t, detail, region }) {
  const r = detail.release || {};
  const gates = (detail.gates || []).filter((g) => g.region === region);
  const stages = [...new Set(gates.map((g) => g.stage))]
    .sort((a, b) => ((STAGE[a] || {}).order ?? 99) - ((STAGE[b] || {}).order ?? 99));
  return (
    <div>
      <Eyebrow t={t}>{r.title} · {region}</Eyebrow>
      <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 12,
        fontFamily: "monospace" }}>
        {r.branch} · {r.commit_sha} · PR #{r.pr_number} · build {r.build_number}
        {r.datasets ? ` · ${r.datasets}` : ""}
      </div>
      {stages.map((s) => (
        <div key={s} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .4,
            textTransform: "uppercase", color: (STAGE[s] || {}).c,
            marginBottom: 6 }}>
            {(STAGE[s] || {}).order} · {(STAGE[s] || {}).label || s}</div>
          <div style={{ border: `1px solid ${t.border}`,
            borderRadius: t.radius.md, background: t.panel, overflow: "hidden" }}>
            {gates.filter((g) => g.stage === s).map((g, i) => (
              <Gate key={g.gate_run_id} t={t} g={g} first={i === 0} />))}
          </div>
        </div>))}
    </div>);
}

export function Gate({ t, g, first }) {
  const [open, setOpen] = useState(false);
  const s = GATE_STATUS[g.status] || GATE_STATUS.not_run;
  const more = Boolean(g.root_cause || g.evidence || g.observed_value);
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${t.bg}` }}>
      <div onClick={more ? () => setOpen(!open) : undefined}
        style={{ display: "flex", gap: 9, alignItems: "center",
          padding: "8px 13px", cursor: more ? "pointer" : "default" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .3,
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 3,
          background: s.bg, color: s.c, minWidth: 66, textAlign: "center",
          flexShrink: 0 }}>{GLYPH[g.status]} {s.label}</span>
        <span style={{ fontSize: 12.5, minWidth: 0,
          fontWeight: g.status === "failed" ? 600 : 400 }}>{g.gate_name}</span>
        {g.blocking === "N" && (
          <span style={{ fontSize: 9.5, color: t.textMuted, flexShrink: 0,
            border: `1px solid ${t.border}`, borderRadius: 3,
            padding: "1px 5px" }}>non-blocking</span>)}
        {more && <span style={{ marginLeft: "auto", fontSize: 10.5,
          color: t.accent, flexShrink: 0 }}>{open ? "hide" : "why"}</span>}
      </div>
      {open && (
        <div style={{ padding: "2px 13px 13px", background: t.bg }}>
          {g.message && <div style={{ fontSize: 12.5, lineHeight: 1.55,
            marginBottom: 9 }}>{g.message}</div>}
          {(g.observed_value || g.threshold) && (
            <div style={{ background: t.panel, border: `1px solid ${t.border}`,
              borderRadius: t.radius.md, padding: "4px 12px", marginBottom: 9 }}>
              <KV t={t} k="Observed" v={g.observed_value} />
              <KV t={t} k="Threshold" v={g.threshold} />
            </div>)}
          {g.root_cause && (
            <div style={{ background: t.warningBg,
              border: `1px solid ${t.warning}`, borderRadius: t.radius.md,
              padding: 12, fontSize: 12.5, lineHeight: 1.55, marginBottom: 9 }}>
              <b style={{ color: t.warning }}>Root cause. </b>{g.root_cause}
            </div>)}
          {g.evidence && <Evidence t={t} raw={g.evidence} />}
          {g.log_url && <div style={{ fontSize: 10.5, color: t.textMuted,
            marginTop: 8, wordBreak: "break-all", fontFamily: "monospace" }}>
            {g.log_url}</div>}
        </div>)}
    </div>);
}

export function Evidence({ t, raw }) {
  let obj = null;
  try { obj = JSON.parse(raw); } catch { obj = null; }
  if (!obj || typeof obj !== "object") {
    return <pre style={{ fontSize: 11, fontFamily: "monospace", margin: 0,
      background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: 11, overflowX: "auto" }}>
      {String(raw)}</pre>;
  }
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: "4px 12px" }}>
      {Object.entries(obj).map(([k, v]) => (
        <KV key={k} t={t} k={k}
          v={typeof v === "object" ? JSON.stringify(v) : String(v)} />))}
    </div>);
}

/* ================================================= PRODUCTION ======== */
// No gates here. What is live, and what the runtime guardrails are saying
// about it.
function Production({ t, rels, selection }) {
  const live = ((rels && rels.releases) || [])
    .filter((r) => r.current_region === "PROD");
  return (
    <div>
      <Eyebrow t={t}>Live in production · {live.length}</Eyebrow>
      <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md,
        background: t.panel, overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
          minWidth: 600 }}>
          <thead><tr>
            <th style={th(t)}>Release</th>
            <th style={th(t)}>Commit</th>
            <th style={th(t)}>Datasets</th>
            <th style={{ ...th(t), textAlign: "right" }}>Status</th>
          </tr></thead>
          <tbody>
            {live.map((r) => (
              <tr key={r.release_id} style={{ borderTop: `1px solid ${t.bg}` }}>
                <td style={td(t)}>
                  <div style={{ fontSize: 12.5, fontWeight: 600,
                    color: t.navy }}>{r.title}</div>
                  <div style={{ fontSize: 10.5, color: t.textMuted,
                    marginTop: 2 }}>{r.author} · {r.models_changed} models</div>
                </td>
                <td style={{ ...td(t), fontFamily: "monospace",
                  fontSize: 11.5 }}>
                  {r.commit_sha}<br />
                  <span style={{ color: t.textMuted }}>
                    PR #{r.pr_number} · build {r.build_number}</span></td>
                <td style={{ ...td(t), fontFamily: "monospace", fontSize: 11,
                  color: t.sub }}>{r.datasets}</td>
                <td style={{ ...td(t), textAlign: "right" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700,
                    letterSpacing: .3, textTransform: "uppercase",
                    padding: "2px 8px", borderRadius: 3,
                    background: GATE_STATUS.passed.bg,
                    color: GATE_STATUS.passed.c }}>
                    {GLYPH.passed} {r.status === "rolled_back"
                      ? "rolled back" : "released"}</span></td>
              </tr>))}
            {!live.length && (
              <tr><td style={{ ...td(t), color: t.textMuted }} colSpan={4}>
                Nothing has reached production yet.</td></tr>)}
          </tbody>
        </table>
      </div>

      <RuntimeSection t={t} selection={selection} />
    </div>);
}

/* ----------------------------------------------------- runtime plane */
function RuntimeSection({ t, selection }) {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [engine, setEngine] = useState(null);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [bad, setBad] = useState(null);
  const [showBad, setShowBad] = useState(false);

  useEffect(() => { promotionApi.stats("PROD").then(setStats); }, []);
  useEffect(() => {
    promotionApi.attention(engine, "PROD").then((r) => setEvents(r.events || []));
  }, [engine]);
  useEffect(() => {
    if (!selId) { setDetail(null); setBad(null); setShowBad(false); return; }
    api.guardrailEvent(selId).then(setDetail);
    setBad(null); setShowBad(false);
  }, [selId]);
  const loadBad = () =>
    api.guardrailBadData(selId).then((r) => { setBad(r); setShowBad(true); });

  const byEng = (stats && stats.by_engine) || {};
  const n = (v) => (stats ? v : "—");

  return (
    <div>
      <Eyebrow t={t}>Runtime guardrails · production is not gated</Eyebrow>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Kpi t={t} n={n(stats && stats.attention)} l="Need attention" c={t.danger} />
        <Kpi t={t} n={n(stats && stats.failed)} l="Failed" c={t.danger}
          g={GLYPH.failed} />
        <Kpi t={t} n={n(stats && stats.warning)} l="Warnings" c="#b4620f"
          g={GLYPH.warning} />
        <Kpi t={t} n={n(stats && stats.critical)} l="Critical" c={t.danger} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Chip t={t} active={!engine} onClick={() => setEngine(null)} label="All engines" />
        {Object.keys(ENGINE).map((k) => (
          <Chip key={k} t={t} active={engine === k} onClick={() => setEngine(k)}
            dot={ENGINE[k].color}
            label={`${ENGINE[k].label}${byEng[k] ? ` (${byEng[k]})` : ""}`} />))}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start",
        flexWrap: "wrap" }}>
        <div style={{ width: 340, flexShrink: 0, maxHeight: 620,
          overflowY: "auto", minWidth: 0 }}>
          {!events.length && (
            <div style={{ color: t.textMuted, fontSize: 12, padding: 20 }}>
              No guardrail events. Run the <code>guardrails</code> ingestion step.
            </div>)}
          {events.map((ev) => {
            const m = engineOf(ev.engine), on = selId === ev.event_id;
            return (
              <div key={ev.event_id} onClick={() => setSelId(ev.event_id)}
                style={{ padding: "10px 12px", marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderLeft: `3px solid ${SEV[ev.severity] || t.border}`,
                  borderRadius: t.radius.md, background: on ? t.infoBg : t.panel }}>
                <div style={{ display: "flex", gap: 5, marginBottom: 3,
                  alignItems: "center" }}>
                  <Pill bg={m.color} text={m.label} />
                  <Pill bg={SEV[ev.severity]} text={(ev.severity || "").toUpperCase()} />
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700,
                    color: ev.status === "failed" ? t.danger : t.warning }}>
                    {(ev.status || "").toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.rule_name}</div>
                <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>
                  {ev.pipeline_id} &middot; {ev.dag_id}</div>
                {ev.release_id && (
                  <div style={{ fontSize: 10.5, color: t.accent, marginTop: 4 }}>
                    introduced by {ev.release_id}</div>)}
              </div>);
          })}
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          {!detail && <Empty t={t}>Select a job to see what happened, then
            drill into the bad data.</Empty>}
          {detail && detail.event_id && (
            <div>
              <h2 style={{ fontSize: 19, margin: "0 0 4px", display: "flex",
                gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill bg={engineOf(detail.engine).color}
                  text={engineOf(detail.engine).label} />
                <Pill bg={SEV[detail.severity]}
                  text={(detail.severity || "").toUpperCase()} />
                {detail.rule_name}
              </h2>
              <div style={{ fontSize: 12, color: t.sub, marginBottom: 14 }}>
                {detail.message}</div>

              <StepH t={t}>1 &middot; What happened in the process</StepH>
              <div style={{ background: t.panel, border: `1px solid ${t.border}`,
                borderRadius: t.radius.md, padding: 14 }}>
                <KV t={t} k="Pipeline" v={detail.pipeline_id} />
                <KV t={t} k="Airflow DAG" v={detail.dag_id} />
                <KV t={t} k="Failed task" v={detail.task_id} />
                <KV t={t} k="Dataset" v={detail.dataset_key} />
                <KV t={t} k="Expectation" v={detail.expectation} />
                <KV t={t} k="Observed" v={detail.observed_value} />
                <KV t={t} k="Threshold" v={detail.threshold} />
              </div>

              <StepH t={t}>2 &middot; Root cause</StepH>
              <div style={{ background: t.warningBg,
                border: `1px solid ${t.warning}`, borderRadius: t.radius.md,
                padding: 14 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{detail.root_cause}</div>
                {detail.upstream_source && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <b style={{ color: t.danger }}>Upstream source: </b>
                    <span style={{ fontFamily: "monospace" }}>
                      {detail.upstream_source}</span></div>)}
              </div>

              <StepH t={t}>3 &middot; The bad data that caused this</StepH>
              {!showBad && detail.bad_row_count > 0 && (
                <button onClick={loadBad}
                  style={{ background: t.danger, color: "#fff", border: "none",
                    borderRadius: t.radius.md, padding: "8px 15px",
                    fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Show the {detail.bad_row_count} bad
                  row{detail.bad_row_count === 1 ? "" : "s"} {"→"}</button>)}
              {!showBad && !(detail.bad_row_count > 0) && (
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  No row-level sample for this event.</div>)}
              {showBad && bad && <BadTable t={t} bad={bad} rule={detail.rule_name} />}
            </div>)}
        </div>
      </div>
    </div>);
}

/* ------------------------------------------------------------ shared */
const th = (t) => ({ textAlign: "left", padding: "8px 12px", fontSize: 9.5,
  fontWeight: 800, letterSpacing: .5, textTransform: "uppercase",
  color: t.textMuted, borderBottom: `1px solid ${t.border}` });
const td = (t) => ({ padding: "9px 12px", fontSize: 12.5, verticalAlign: "top" });

function Eyebrow({ t, children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .6,
    textTransform: "uppercase", color: t.textMuted, marginBottom: 9 }}>
    {children}</div>;
}
function Kpi({ t, n, l, c, g }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: "11px 16px", minWidth: 104 }}>
      <div style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.05,
        color: c || t.navy, fontVariantNumeric: "tabular-nums",
        display: "flex", alignItems: "baseline", gap: 6 }}>
        {g && <span style={{ fontSize: 13 }}>{g}</span>}{n}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .4,
        textTransform: "uppercase", color: t.textMuted, marginTop: 5 }}>{l}</div>
    </div>);
}
function Loading({ t }) {
  return <div style={{ padding: 20, color: t.textMuted, fontSize: 12.5 }}>
    Loading…</div>;
}
function Empty({ t, children }) {
  return <div style={{ background: t.panel, border: `1px solid ${t.border}`,
    borderRadius: t.radius.md, padding: 20, color: t.textMuted, fontSize: 13,
    lineHeight: 1.6 }}>{children}</div>;
}
function Chip({ t, active, onClick, dot, label }) {
  return (
    <span onClick={onClick} style={{ fontSize: 11, fontWeight: 600,
      padding: "5px 11px", borderRadius: t.radius.pill, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 5,
      border: `1px solid ${active ? t.accent : t.border}`,
      background: active ? t.accent : t.panel, color: active ? "#fff" : t.sub }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 4,
        background: dot, display: "inline-block" }} />}
      {label}
    </span>);
}
function Pill({ bg, text }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: "#fff",
    padding: "2px 7px", borderRadius: 3, background: bg || "#5f6f8f",
    display: "inline-block" }}>{text}</span>;
}
function StepH({ t, children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    color: t.accent, margin: "16px 0 8px", letterSpacing: .4 }}>{children}</div>;
}
function KV({ t, k, v }) {
  return (
    <div style={{ display: "flex", padding: "7px 0",
      borderBottom: `1px solid ${t.bg}`, fontSize: 12.5 }}>
      <span style={{ width: 150, color: t.textMuted, flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: "monospace", minWidth: 0,
        wordBreak: "break-word" }}>{v || "—"}</span>
    </div>);
}
function BadTable({ t, bad, rule }) {
  const rows = bad.sample || [];
  if (!rows.length) return <div style={{ color: t.textMuted, fontSize: 12 }}>
    No sample rows.</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div>
      <div style={{ fontSize: 11, color: t.sub, marginBottom: 8 }}>
        {bad.bad_row_count} of {bad.total_row_count || "?"} rows failed{" "}
        <b>{rule}</b>.</div>
      <div style={{ border: `1px solid ${t.danger}`,
        borderRadius: t.radius.md, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c) => (
            <th key={c} style={{ textAlign: "left", padding: "7px 10px",
              fontSize: 10, fontWeight: 700, color: t.danger,
              background: t.dangerBg,
              borderBottom: `1px solid ${t.danger}` }}>{c}</th>))}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => {
              const val = r[c];
              const isNull = val === null || val === undefined;
              return <td key={c} style={{ padding: "7px 10px", fontSize: 12,
                fontFamily: "monospace", borderBottom: `1px solid ${t.bg}`,
                color: isNull ? t.danger : t.text,
                fontWeight: isNull ? 700 : 400 }}>
                {isNull ? "NULL" : String(val)}</td>;
            })}</tr>))}</tbody>
        </table>
      </div>
    </div>);
}
