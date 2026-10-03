// Quality Guardrails — one board, three regions, two grains.
//
// WHY THIS IS A BOARD AND NOT A REGION SWITCH.
//
// The first pass at this put SIT, UAT and PROD behind a picker. That
// serves two readers and fails the third, who is the one the screen is
// mostly for:
//
//   a developer who just pushed  — "did my build pass, and on what"
//   an ops reader at 7am         — "did last night's data land"
//   a release manager            — "where is everything, what is stuck"
//
// The third question is answered by seeing all three regions at once.
// Behind a picker it becomes three clicks and a memory test, and the one
// view that justifies the screen is the one you cannot get.
//
// So: releases are rows, regions are columns, and a change moves left to
// right across the board the way it moves through the estate. A blocked
// cell names the gate that blocked it, because "3 failed" sends the
// reader looking and the gate's name is what they were going to find.
//
// THE TWO GRAINS STILL DO NOT MERGE. A gate run belongs to a commit; a
// guardrail event belongs to a run on a business date. They are two
// sections of one page rather than two tabs — the ops reader should not
// have to know what is in flight to check last night, and the release
// manager should see that PROD is on fire without changing screens.
// PROD is a column on the board (is this change live?) AND a section
// below (is the data right?), which are different questions about the
// same region.
//
// WHAT THE DETAIL IS FOR. Opening a release puts SIT and UAT side by
// side, stage by stage. The positions release passes the performance
// stage in SIT at 20K rows and fails it in UAT at 4.2M, and those two
// facts belong on one line. Behind a region picker that comparison
// cannot be drawn at all, which is the clearest sign the picker was
// wrong.

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

// What each column means, on the column itself. A separate legend strip
// competes with the board for the reader's first look and loses.
const COLS = [
  { k: "SIT", when: "every push",
    does: "governance · tests · security · plan checks" },
  { k: "UAT", when: "on promotion",
    does: "SLA at real volume · business pack · sign-off" },
  { k: "PROD", when: "no gates",
    does: "runtime guardrails only — see below" },
];

export default function Guardrails({ t, selection }) {
  const [rels, setRels] = useState(null);
  const [open, setOpen] = useState(null);     // release_id being read

  useEffect(() => { promotionApi.releases().then(setRels); }, []);

  return (
    <div>
      <SectionHeader t={t}>Quality Guardrails</SectionHeader>
      <p style={{ fontSize: 13, color: t.sub, margin: "-18px 0 14px", maxWidth: 940 }}>
        Changes move left to right: <b>SIT</b> gates every push, <b>UAT</b> gates
        the promotion, <b>PROD</b> gates nothing and watches the data instead.
        A red cell names the gate holding the release.
      </p>

      <SyntheticBanner t={t} payload={rels} />

      {open
        ? <ReleaseDetail t={t} id={open} onBack={() => setOpen(null)} />
        : <PromotionBoard t={t} rels={rels} onOpen={setOpen} />}

      <RuntimeSection t={t} selection={selection} />
    </div>
  );
}

/* ------------------------------------------------------------ banner */
// Every other screen in this catalogue refuses to render rather than show
// demo data. This one cannot refuse — the board is the thing being
// reviewed — so it declares itself instead. The claim comes from the API,
// not a constant, so it stops the day a real ingester reports otherwise.
export function SyntheticBanner({ t, payload }) {
  if (!payload || payload.synthetic !== true) return null;
  return (
    <div style={{ background: t.warningBg, border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.warning}`, borderRadius: t.radius.md,
      padding: "11px 15px", marginBottom: 18, fontSize: 12.5,
      lineHeight: 1.6, maxWidth: 940 }}>
      <b style={{ color: t.warning }}>Illustrative, not live.</b> No build,
      gate or event here came from a real run — there is no Jenkins hookup
      yet. The shapes match what Jenkins, dbt, Great Expectations and Airflow
      publish, so an ingester reading real builds replaces the generator
      without this screen changing.
    </div>);
}

/* ------------------------------------------------------------- board */
export function PromotionBoard({ t, rels, onOpen }) {
  if (!rels) return <Loading t={t} />;
  const list = rels.releases || [];
  if (!list.length) {
    return (
      <Empty t={t}>
        No release candidates.{" "}
        {rels.unreachable
          ? "The guardrails service did not answer."
          : <>Run <code>sql/67_guardrail_promotion.sql</code>, then{" "}
             <code>python -m ingestion.run guardrails_promotion</code>.</>}
      </Empty>);
  }

  const head = { textAlign: "left", padding: "9px 12px", verticalAlign: "bottom",
    borderBottom: `2px solid ${t.border}` };

  return (
    <div style={{ marginBottom: 30 }}>
      <Eyebrow t={t}>Release candidates · {list.length}</Eyebrow>
      {/* The board is the one thing that may exceed the page width; it
          scrolls inside its own container so the page never does. */}
      <div style={{ overflowX: "auto", border: `1px solid ${t.border}`,
        borderRadius: t.radius.md, background: t.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
          minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...head, minWidth: 230 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px",
                  textTransform: "uppercase", color: t.textMuted }}>Change</span>
              </th>
              {COLS.map((c) => (
                <th key={c.k} style={{ ...head, minWidth: 165 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: REGION[c.k].c }}>{c.k}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 400,
                    marginTop: 1 }}>{c.when}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 400,
                    marginTop: 3, lineHeight: 1.4, maxWidth: 190 }}>{c.does}</div>
                </th>))}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.release_id}
                onClick={() => onOpen(r.release_id)}
                style={{ cursor: "pointer", borderBottom: `1px solid ${t.bg}` }}>
                <td style={{ padding: "11px 12px", verticalAlign: "top" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.navy }}>
                    {r.title}</div>
                  <div style={{ fontSize: 10.5, color: t.sub, marginTop: 3,
                    fontFamily: "monospace" }}>
                    {r.commit_sha} · PR #{r.pr_number} · build {r.build_number}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
                    {r.author} · {r.models_changed} models
                  </div>
                </td>
                {COLS.map((c) => (
                  <td key={c.k} style={{ padding: "11px 12px", verticalAlign: "top" }}>
                    <BoardCell t={t} r={r} region={c.k} />
                  </td>))}
              </tr>))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>
        Click a row for every gate it ran, with SIT and UAT side by side.
      </div>
    </div>);
}

// One region's standing for one release. PROD is not a gate column — a
// release is either live there or it is not — so it answers a different
// question from the other two and is drawn differently on purpose.
export function BoardCell({ t, r, region }) {
  if (region === "PROD") {
    const live = r.current_region === "PROD";
    return live
      ? <State t={t} c="#159943" label="live"
          note={r.status === "rolled_back" ? "rolled back" : "released"} />
      : <NotYet t={t} />;
  }

  const d = (r.regions || {})[region] || {};
  const reached = region === "SIT"
    || ["UAT", "PROD"].includes(r.current_region);
  if (!reached) return <NotYet t={t} />;

  const st = d.state || "none";
  if (st === "blocked") {
    return <State t={t} c={t.danger} label="blocked"
      note={d.blocker || `${d.failed} failed`} bar={d} />;
  }
  if (st === "running") {
    return <State t={t} c="#0091bf" label="running"
      note={`${d.passed} of ${d.total} done`} bar={d} />;
  }
  if (st === "pending") {
    return <State t={t} c={t.textMuted} label="queued"
      note={`${d.total} gates`} bar={d} />;
  }
  return <State t={t} c="#159943" label="passed"
    note={`${d.passed} of ${d.total} gates`} bar={d} />;
}

function State({ t, c, label, note, bar }) {
  return (
    <div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".4px",
        textTransform: "uppercase", color: "#fff", background: c,
        borderRadius: 3, padding: "2px 8px" }}>{label}</span>
      {note && (
        <div style={{ fontSize: 11, color: t.sub, marginTop: 5,
          lineHeight: 1.4 }}>{note}</div>)}
      {bar && <GateBar t={t} d={bar} />}
    </div>);
}
function NotYet({ t }) {
  return <span style={{ fontSize: 11, color: t.textMuted }}>—</span>;
}

// Passed / failed / warning / still to run as one bar. The proportion
// still to run is the point: two passes and twelve not-yet-run is not
// "doing well", and two green chips would say it was.
export function GateBar({ t, d }) {
  const total = d.total || 0;
  if (!total) return null;
  const seg = [["passed", d.passed], ["failed", d.failed],
               ["warning", d.warning], ["running", d.running],
               ["not_run", d.not_run]];
  return (
    <span style={{ display: "flex", height: 4, borderRadius: 2, marginTop: 7,
      overflow: "hidden", background: "#eef2f5", maxWidth: 150 }}
      title={seg.filter(([, n]) => n)
        .map(([k, n]) => `${n} ${GATE_STATUS[k].label}`).join(" · ")}>
      {seg.map(([k, n]) => (n ? (
        <i key={k} style={{ display: "block", background: GATE_STATUS[k].c,
          width: `${(n / total) * 100}%` }} />) : null))}
    </span>);
}

/* ------------------------------------------------------------ detail */
export function ReleaseDetail({ t, id, onBack }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let live = true;
    setD(null);
    promotionApi.release(id).then((x) => { if (live) setD(x); });
    return () => { live = false; };
  }, [id]);

  if (!d) return <Loading t={t} />;
  const r = d.release || {};
  const gates = d.gates || [];
  // Every stage either region runs, in CI/CD order. Aligning them is the
  // whole point of this view: the performance row shows the same stage
  // passing in SIT and failing in UAT, which is a fact about data volume
  // and not about the change.
  const stages = [...new Set(gates.map((g) => g.stage))]
    .sort((a, b) => (STAGE[a]?.order ?? 99) - (STAGE[b]?.order ?? 99));

  return (
    <div style={{ marginBottom: 30 }}>
      <button type="button" onClick={onBack}
        style={{ font: "inherit", fontSize: 12, border: `1px solid ${t.border}`,
          background: t.panel, color: t.accent, borderRadius: t.radius.md,
          padding: "6px 13px", cursor: "pointer", marginBottom: 14 }}>
        ← All releases</button>

      <h2 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 5px",
        color: t.navy }}>{r.title}</h2>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 18 }}>
        <span style={{ fontFamily: "monospace" }}>{r.branch}</span> ·{" "}
        <span style={{ fontFamily: "monospace" }}>{r.commit_sha}</span> · PR
        #{r.pr_number} · build {r.build_number} · {r.author} ·{" "}
        {r.models_changed} models · <span style={{ fontFamily: "monospace" }}>
        {r.datasets}</span>
      </div>

      <div style={{ display: "grid", gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        marginBottom: 10 }}>
        {["SIT", "UAT"].map((rg) => (
          <div key={rg} style={{ fontSize: 13, fontWeight: 700,
            color: REGION[rg].c, borderBottom: `2px solid ${REGION[rg].c}`,
            paddingBottom: 5 }}>
            {rg} <span style={{ fontWeight: 400, fontSize: 11,
              color: t.textMuted }}>{REGION[rg].sub}</span>
          </div>))}
      </div>

      {stages.map((s) => {
        const meta = STAGE[s] || { label: s, c: "#5f6f8f", order: 99 };
        return (
          <div key={s} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".4px", color: meta.c, marginBottom: 7 }}>
              {meta.order} · {meta.label}
            </div>
            <div style={{ display: "grid", gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {["SIT", "UAT"].map((rg) => {
                const inCell = gates.filter((g) => g.stage === s && g.region === rg);
                return (
                  <div key={rg} style={{ border: `1px solid ${t.border}`,
                    borderRadius: t.radius.md, background: t.panel,
                    overflow: "hidden", minWidth: 0 }}>
                    {inCell.length
                      ? inCell.map((g, i) => (
                          <Gate key={g.gate_run_id} t={t} g={g} first={i === 0} />))
                      : <div style={{ padding: "11px 13px", fontSize: 11.5,
                          color: t.textMuted }}>
                          {rg} does not run this stage
                        </div>}
                  </div>);
              })}
            </div>
          </div>);
      })}
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
          padding: "9px 13px", cursor: more ? "pointer" : "default" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".3px",
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 3,
          background: s.bg, color: s.c, minWidth: 58, textAlign: "center",
          flexShrink: 0 }}>{s.label}</span>
        <span style={{ fontSize: 12.5, minWidth: 0,
          fontWeight: g.status === "failed" ? 600 : 400 }}>{g.gate_name}</span>
        {/* A gate that reports and does not stop the release is not a
            smaller version of one that does. Saying so costs one chip. */}
        {g.blocking === "N" && (
          <span style={{ fontSize: 9.5, color: t.textMuted, flexShrink: 0,
            border: `1px solid ${t.border}`, borderRadius: 3,
            padding: "1px 5px" }}>non-blocking</span>)}
        {more && (
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.accent,
            flexShrink: 0 }}>{open ? "hide" : "why"}</span>)}
      </div>
      {open && (
        <div style={{ padding: "2px 13px 13px", background: t.bg }}>
          {g.message && (
            <div style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 9 }}>
              {g.message}</div>)}
          {(g.observed_value || g.threshold) && (
            <div style={{ background: t.panel, border: `1px solid ${t.border}`,
              borderRadius: t.radius.md, padding: "4px 12px", marginBottom: 9 }}>
              <KV t={t} k="Observed" v={g.observed_value} />
              <KV t={t} k="Threshold" v={g.threshold} />
            </div>)}
          {g.root_cause && (
            <div style={{ background: t.warningBg, border: `1px solid ${t.warning}`,
              borderRadius: t.radius.md, padding: 12, fontSize: 12.5,
              lineHeight: 1.55, marginBottom: 9 }}>
              <b style={{ color: t.warning }}>Root cause. </b>{g.root_cause}
            </div>)}
          {g.evidence && <Evidence t={t} raw={g.evidence} />}
          {g.log_url && (
            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 8,
              wordBreak: "break-all" }}>
              Jenkins log:{" "}
              <span style={{ fontFamily: "monospace" }}>{g.log_url}</span></div>)}
        </div>)}
    </div>);
}

// The gate's own artefact — a plan, a CVE record, a timing run. Rendered
// as key/value where it parses and as text where it does not, rather than
// hidden for being the wrong shape.
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

/* ----------------------------------------------------- runtime plane */
// Always on the page, never behind the board. The 7am question — did last
// night's data land — does not depend on what happens to be in flight,
// and making the reader navigate past a release board to reach it is how
// a monitoring screen stops being opened.
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
    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 22 }}>
      <Eyebrow t={t}>PROD runtime · not gated</Eyebrow>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 14px", maxWidth: 940 }}>
        No gate runs in production. These are the guardrails on the scheduled
        runs — Great Expectations, Soda, dbt tests and Airflow. Click a job
        to see what happened, then drill into the bad data that caused it.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Kpi t={t} n={n(stats && stats.attention)} l="Need attention" c={t.danger} />
        <Kpi t={t} n={n(stats && stats.failed)} l="Failed" c={t.danger} />
        <Kpi t={t} n={n(stats && stats.warning)} l="Warnings" c={t.warning} />
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
              No guardrail events. Run the <code>guardrails</code> ingestion
              step, or check /diag.
            </div>)}
          {events.map((ev) => {
            const m = engineOf(ev.engine);
            const on = selId === ev.event_id;
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
                {/* When a runtime failure traces to the change that caused
                    it, say so. Nullable on purpose: most data failures are
                    not deployments, and forcing a release would invent a
                    culprit. */}
                {ev.release_id && (
                  <div style={{ fontSize: 10.5, color: t.accent, marginTop: 4 }}>
                    introduced by {ev.release_id}</div>)}
              </div>);
          })}
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          {!detail && (
            <Empty t={t}>Select a job to see what happened, then drill into
              the bad data.</Empty>)}
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
                      {detail.upstream_source}</span>
                  </div>)}
              </div>

              <StepH t={t}>3 &middot; The bad data that caused this</StepH>
              {!showBad && detail.bad_row_count > 0 && (
                <button onClick={loadBad}
                  style={{ background: t.danger, color: "#fff", border: "none",
                    borderRadius: t.radius.md, padding: "8px 15px", fontSize: 13,
                    fontWeight: 600, cursor: "pointer" }}>
                  Show the {detail.bad_row_count} bad
                  row{detail.bad_row_count === 1 ? "" : "s"} {"→"}
                </button>)}
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
function Eyebrow({ t, children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".6px",
    textTransform: "uppercase", color: t.textMuted, marginBottom: 9 }}>
    {children}</div>;
}
function Kpi({ t, n, l, c }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: "12px 18px", minWidth: 110 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: c || t.text }}>{n}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase",
        letterSpacing: ".4px", color: t.textMuted }}>{l}</div>
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
    color: t.accent, margin: "16px 0 8px", letterSpacing: ".4px" }}>{children}</div>;
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
        <b>{rule}</b>.
      </div>
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
