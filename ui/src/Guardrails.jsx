// Quality Guardrails — three regions, two planes.
//
// WHAT CHANGED AND WHY. This screen used to be one flat list of failed
// jobs with no notion of where they ran. BBH promotes through SIT, UAT
// and PROD, and the three do genuinely different work:
//
//   SIT   every push. Jenkins runs governance, tests, security and the
//         performance checks that need no data volume, against a COMMIT.
//   UAT   on promotion. SLA at realistic volumes, the business pack and
//         sign-off, against a RELEASE CANDIDATE.
//   PROD  no gates at all. Great Expectations, Soda, dbt tests and
//         Airflow, against a RUN on a business date.
//
// So this is not one list with a region filter bolted on. SIT and UAT
// answer "can this change ship"; PROD answers "is today's data right".
// Those take different screens, and the region switch picks between
// them rather than narrowing one of them. Drawing PROD with an empty
// gate list would read as a gap rather than as the design.
//
// The runtime plane below — the event list, the root-cause panel and the
// bad-data drill-down — is unchanged. It worked; it just needed to stop
// claiming to be the whole picture.

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

function engineOf(k) { return ENGINE[k] || { label: k || "Other", color: "#5f6f8f" }; }

export default function Guardrails({ t, selection }) {
  const [region, setRegion] = useState("SIT");
  const [regions, setRegions] = useState(null);

  useEffect(() => { promotionApi.regions().then(setRegions); }, []);

  const rs = (regions && regions.regions) || [];
  const meta = (k) => rs.find((x) => x.region === k) || {};

  return (
    <div>
      <SectionHeader t={t}>Quality Guardrails</SectionHeader>
      <p style={{ fontSize: 13, color: t.sub, margin: "-18px 0 14px", maxWidth: 960 }}>
        Three regions, and they do different work. <b>SIT</b> and <b>UAT</b> gate a
        change on its way to production; <b>PROD</b> watches the data once it is
        live. Pick a region to see the one it actually runs.
      </p>

      <SyntheticBanner t={t} payload={regions} />

      <RegionLanes t={t} cur={region} onPick={setRegion} meta={meta} />

      {region === "PROD"
        ? <RuntimePlane t={t} selection={selection} region="PROD" />
        : <PromotionPlane t={t} region={region} />}
    </div>
  );
}

/* ------------------------------------------------------------ banner */
// Every other screen in this catalogue refuses to render rather than show
// demo data. This one cannot refuse — the promotion board IS the design
// being reviewed — so it says what it is instead. The claim comes from the
// API, not from a constant here, so it cannot keep saying "illustrative"
// after a real connector has replaced the generator.
export function SyntheticBanner({ t, payload }) {
  if (!payload || payload.synthetic !== true) return null;
  return (
    <div style={{ background: t.warningBg, border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.warning}`, borderRadius: t.radius.md,
      padding: "11px 15px", marginBottom: 16, fontSize: 12.5,
      lineHeight: 1.6, maxWidth: 960 }}>
      <b style={{ color: t.warning }}>Illustrative, not live.</b> No build,
      gate or event on this screen came from a real run — there is no Jenkins
      hookup yet. The shapes match what Jenkins, dbt, Great Expectations and
      Airflow publish, so an ingester reading real builds replaces the
      generator without this screen changing.
    </div>);
}

/* ------------------------------------------------------- region lanes */
export function RegionLanes({ t, cur, onPick, meta }) {
  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 18,
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
      {["SIT", "UAT", "PROD"].map((k) => {
        const m = REGION[k], d = meta(k), on = cur === k;
        // A region is in trouble for a different reason depending on what
        // it runs. SIT and UAT are blocked by a gate; PROD is not gated at
        // all, so its signal is a critical runtime event.
        const bad = d.kind === "runtime" ? (d.critical || 0)
                                         : (d.blocking_failures || 0);
        return (
          <button key={k} type="button" onClick={() => onPick(k)}
            aria-pressed={on}
            style={{ font: "inherit", textAlign: "left", cursor: "pointer",
              background: on ? t.panel : t.bg,
              border: `1px solid ${on ? m.c : t.border}`,
              borderTop: `3px solid ${m.c}`,
              borderRadius: t.radius.md, padding: "13px 15px",
              boxShadow: on ? "0 1px 4px rgba(16,25,59,.1)" : "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: m.c }}>{m.label}</span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{m.sub}</span>
              {bad > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700,
                  color: "#fff", background: t.danger, borderRadius: 3,
                  padding: "2px 7px" }}>
                  {bad} {d.kind === "runtime" ? "critical" : "blocking"}</span>)}
            </div>
            <div style={{ fontSize: 11.5, color: t.sub, marginTop: 6,
              lineHeight: 1.5 }}>
              {d.covers || "—"}
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 7 }}>
              {d.kind === "runtime"
                ? `${d.events || 0} open event${d.events === 1 ? "" : "s"} · ${d.trigger || ""}`
                : `${d.gates || 0} gates · ${d.trigger || ""}`}
            </div>
          </button>);
      })}
    </div>);
}

/* --------------------------------------------------- promotion plane */
function PromotionPlane({ t, region }) {
  const [rels, setRels] = useState(null);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => { promotionApi.releases().then(setRels); }, []);
  useEffect(() => {
    if (!sel) { setDetail(null); return; }
    let live = true;
    promotionApi.release(sel).then((d) => { if (live) setDetail(d); });
    return () => { live = false; };
  }, [sel]);

  // Only releases that have REACHED this region. A release still in SIT has
  // UAT gates recorded as not_run, and listing it on the UAT board would
  // say a candidate is in UAT that nobody has promoted.
  const reached = (r) => region === "SIT"
    ? true
    : ["UAT", "PROD"].includes(r.current_region);
  const list = ((rels && rels.releases) || []).filter(reached);

  if (!rels) return <Loading t={t} />;
  if (!list.length) {
    return (
      <Empty t={t}>
        No release candidate has reached {region}.{" "}
        {rels.unreachable
          ? "The guardrails service did not answer."
          : <>Run <code>python -m ingestion.run guardrails_promotion</code> after{" "}
             <code>sql/67_guardrail_promotion.sql</code>.</>}
      </Empty>);
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start",
      flexWrap: "wrap" }}>
      <div style={{ width: 340, flexShrink: 0, maxHeight: 620, overflowY: "auto",
        minWidth: 0 }}>
        {list.map((r) => {
          const d = (r.regions || {})[region] || {};
          const on = sel === r.release_id;
          const st = d.state || "none";
          const c = st === "blocked" ? t.danger
                  : st === "running" ? "#0091bf"
                  : st === "passed" ? "#159943" : t.border;
          return (
            <div key={r.release_id} onClick={() => setSel(r.release_id)}
              style={{ padding: "11px 13px", marginBottom: 6, cursor: "pointer",
                border: `1px solid ${on ? t.accent : t.border}`,
                borderLeft: `3px solid ${c}`, borderRadius: t.radius.md,
                background: on ? t.infoBg : t.panel }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center",
                marginBottom: 4, flexWrap: "wrap" }}>
                <Pill bg={REGION[r.current_region] ? REGION[r.current_region].c : "#5f6f8f"}
                  text={r.current_region} />
                <span style={{ fontFamily: "monospace", fontSize: 10.5,
                  color: t.textMuted }}>{r.commit_sha}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700,
                  color: c }}>{st.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>
                PR #{r.pr_number} · build {r.build_number} · {r.author}
              </div>
              {/* Which gate, not how many. "3 failed" sends the reader
                  looking; the gate's name is the answer they were after. */}
              {d.blocker && (
                <div style={{ fontSize: 11, color: t.danger, marginTop: 5,
                  fontWeight: 600 }}>blocked by {d.blocker}</div>)}
              <GateBar t={t} d={d} />
            </div>);
        })}
      </div>

      <div style={{ flex: 1, minWidth: 300 }}>
        {!detail
          ? <Empty t={t}>Select a release to see every gate it ran in {region}.</Empty>
          : <ReleaseGates t={t} detail={detail} region={region} />}
      </div>
    </div>);
}

// Passed / failed / warning / still to run, as one bar. The point is the
// proportion still to run: a release with two passes and twelve not-yet-run
// is not "doing well", and three green chips would say it was.
export function GateBar({ t, d }) {
  const total = d.total || 0;
  if (!total) return null;
  const seg = [["passed", d.passed], ["failed", d.failed],
               ["warning", d.warning], ["running", d.running],
               ["not_run", d.not_run]];
  return (
    <span style={{ display: "flex", height: 5, borderRadius: 3, marginTop: 8,
      overflow: "hidden", background: "#eef2f5" }}
      title={seg.filter(([, n]) => n).map(([k, n]) => `${n} ${GATE_STATUS[k].label}`).join(" · ")}>
      {seg.map(([k, n]) => (n ? (
        <i key={k} style={{ display: "block", background: GATE_STATUS[k].c,
          width: `${(n / total) * 100}%` }} />) : null))}
    </span>);
}

export function ReleaseGates({ t, detail, region }) {
  const r = detail.release || {};
  const gates = (detail.gates || []).filter((g) => g.region === region);
  const stages = [...new Set(gates.map((g) => g.stage))]
    .sort((a, b) => (STAGE[a] ? STAGE[a].order : 99) - (STAGE[b] ? STAGE[b].order : 99));

  return (
    <div>
      <h2 style={{ fontSize: 19, margin: "0 0 4px", fontWeight: 500 }}>{r.title}</h2>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 14 }}>
        <span style={{ fontFamily: "monospace" }}>{r.branch}</span> ·{" "}
        <span style={{ fontFamily: "monospace" }}>{r.commit_sha}</span> ·
        PR #{r.pr_number} · build {r.build_number} · {r.models_changed} models ·{" "}
        {r.datasets}
      </div>

      {stages.map((s) => {
        const meta = STAGE[s] || { label: s, c: "#5f6f8f", order: 99 };
        const inStage = gates.filter((g) => g.stage === s);
        return (
          <div key={s} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".4px", color: meta.c, margin: "0 0 7px" }}>
              {meta.order} · {meta.label}
            </div>
            <div style={{ border: `1px solid ${t.border}`,
              borderRadius: t.radius.md, overflow: "hidden", background: t.panel }}>
              {inStage.map((g, i) => <Gate key={g.gate_run_id} t={t} g={g}
                first={i === 0} />)}
            </div>
          </div>);
      })}
    </div>);
}

export function Gate({ t, g, first }) {
  const [open, setOpen] = useState(false);
  const s = GATE_STATUS[g.status] || GATE_STATUS.not_run;
  const hasMore = Boolean(g.root_cause || g.evidence || g.observed_value);
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${t.bg}` }}>
      <div onClick={hasMore ? () => setOpen(!open) : undefined}
        style={{ display: "flex", gap: 9, alignItems: "center", padding: "9px 13px",
          cursor: hasMore ? "pointer" : "default" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".3px",
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 3,
          background: s.bg, color: s.c, minWidth: 58, textAlign: "center" }}>
          {s.label}</span>
        <span style={{ fontSize: 12.5, fontWeight: g.status === "failed" ? 600 : 400,
          minWidth: 0 }}>{g.gate_name}</span>
        {/* A gate that reports and does not block is a different thing from
            one that stops the release. Saying so costs one chip. */}
        {g.blocking === "N" && (
          <span style={{ fontSize: 9.5, color: t.textMuted,
            border: `1px solid ${t.border}`, borderRadius: 3,
            padding: "1px 5px" }}>non-blocking</span>)}
        {hasMore && (
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.accent }}>
            {open ? "hide" : "why"}</span>)}
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
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8,
              wordBreak: "break-all" }}>
              Jenkins log: <span style={{ fontFamily: "monospace" }}>{g.log_url}</span>
            </div>)}
        </div>)}
    </div>);
}

// The gate's own artefact — an EXPLAIN PLAN, a CVE record, a timing run.
// Rendered as key/value where it parses, and left as text where it does
// not, rather than hidden because it was not the shape we expected.
export function Evidence({ t, raw }) {
  let obj = null;
  try { obj = JSON.parse(raw); } catch { obj = null; }
  if (!obj || typeof obj !== "object") {
    return <pre style={{ fontSize: 11, fontFamily: "monospace", margin: 0,
      background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: 11, overflowX: "auto" }}>{String(raw)}</pre>;
  }
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: "4px 12px" }}>
      {Object.entries(obj).map(([k, v]) => (
        <KV key={k} k={k} t={t}
          v={typeof v === "object" ? JSON.stringify(v) : String(v)} />))}
    </div>);
}

/* ----------------------------------------------------- runtime plane */
// Unchanged behaviour, now scoped to a region and mounted only for PROD.
function RuntimePlane({ t, selection, region }) {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [engine, setEngine] = useState(null);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [bad, setBad] = useState(null);
  const [showBad, setShowBad] = useState(false);

  useEffect(() => { promotionApi.stats(region).then(setStats); }, [region]);
  useEffect(() => {
    promotionApi.attention(engine, region).then((r) => setEvents(r.events || []));
  }, [engine, region]);
  useEffect(() => {
    if (!selId) { setDetail(null); setBad(null); setShowBad(false); return; }
    api.guardrailEvent(selId).then(setDetail);
    setBad(null); setShowBad(false);
  }, [selId]);

  const loadBad = () => {
    api.guardrailBadData(selId).then((r) => { setBad(r); setShowBad(true); });
  };

  const kpi = (n, l, c) => (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, padding: "12px 18px", minWidth: 110 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: c || t.text }}>{n}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: t.textMuted }}>{l}</div>
    </div>
  );

  const byEng = (stats && stats.by_engine) || {};

  return (
    <div>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 14px", maxWidth: 960 }}>
        No gate runs in {region} — it is not gated. These are the runtime
        guardrails on the scheduled runs: click a job to see what happened,
        then drill into the bad data that caused it.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {kpi(stats ? stats.attention : "—", "Need attention", t.danger)}
        {kpi(stats ? stats.failed : "—", "Failed", t.danger)}
        {kpi(stats ? stats.warning : "—", "Warnings", t.warning)}
        {kpi(stats ? stats.critical : "—", "Critical", t.danger)}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Chip t={t} active={!engine} onClick={() => setEngine(null)} label="All engines" />
        {Object.keys(ENGINE).map((k) => (
          <Chip key={k} t={t} active={engine === k} onClick={() => setEngine(k)}
            dot={ENGINE[k].color} label={`${ENGINE[k].label}${byEng[k] ? ` (${byEng[k]})` : ""}`} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* list */}
        <div style={{ width: 340, flexShrink: 0, maxHeight: 620, overflowY: "auto", minWidth: 0 }}>
          {events.length === 0 && (
            <div style={{ color: t.textMuted, fontSize: 12, padding: 20 }}>
              No guardrail events. Run the <code>guardrails</code> ingestion step, or check /diag.
            </div>
          )}
          {events.map((ev) => {
            const m = engineOf(ev.engine);
            const on = selId === ev.event_id;
            return (
              <div key={ev.event_id} onClick={() => setSelId(ev.event_id)}
                style={{ padding: "10px 12px", marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderLeft: `3px solid ${SEV[ev.severity] || t.border}`,
                  borderRadius: t.radius.md, background: on ? t.infoBg : t.panel }}>
                <div style={{ display: "flex", gap: 5, marginBottom: 3, alignItems: "center" }}>
                  <Pill bg={m.color} text={m.label} />
                  <Pill bg={SEV[ev.severity]} text={(ev.severity || "").toUpperCase()} />
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700,
                    color: ev.status === "failed" ? t.danger : t.warning }}>
                    {(ev.status || "").toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.rule_name}</div>
                <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{ev.pipeline_id} &middot; {ev.dag_id}</div>
                {/* When a runtime failure can be traced to the change that
                    introduced it, say so. Nullable on purpose: most data
                    failures are not deployments, and forcing a release on
                    them would invent a culprit. */}
                {ev.release_id && (
                  <div style={{ fontSize: 10.5, color: t.accent, marginTop: 4 }}>
                    introduced by {ev.release_id}</div>)}
              </div>
            );
          })}
        </div>

        {/* detail */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {!detail && (
            <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md,
              padding: 20, color: t.textMuted, fontSize: 13 }}>
              Select a job to see what happened, then drill into the bad data.
            </div>
          )}
          {detail && detail.event_id && (
            <div>
              <h2 style={{ fontSize: 19, margin: "0 0 4px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill bg={engineOf(detail.engine).color} text={engineOf(detail.engine).label} />
                <Pill bg={SEV[detail.severity]} text={(detail.severity || "").toUpperCase()} />
                {detail.rule_name}
              </h2>
              <div style={{ fontSize: 12, color: t.sub, marginBottom: 14 }}>{detail.message}</div>

              <StepH t={t}>1 &middot; What happened in the process</StepH>
              <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: 14 }}>
                <KV t={t} k="Pipeline" v={detail.pipeline_id} />
                <KV t={t} k="Airflow DAG" v={detail.dag_id} />
                <KV t={t} k="Failed task" v={detail.task_id} />
                <KV t={t} k="Dataset" v={detail.dataset_key} />
                <KV t={t} k="Expectation" v={detail.expectation} />
                <KV t={t} k="Observed" v={detail.observed_value} />
                <KV t={t} k="Threshold" v={detail.threshold} />
              </div>

              <StepH t={t}>2 &middot; Root cause</StepH>
              <div style={{ background: t.warningBg, border: `1px solid ${t.warning}`, borderRadius: t.radius.md, padding: 14 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{detail.root_cause}</div>
                {detail.upstream_source && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <b style={{ color: t.danger }}>Upstream source: </b>
                    <span style={{ fontFamily: "monospace" }}>{detail.upstream_source}</span>
                  </div>
                )}
              </div>

              <StepH t={t}>3 &middot; The bad data that caused this</StepH>
              {!showBad && (detail.bad_row_count > 0) && (
                <button onClick={loadBad}
                  style={{ background: t.danger, color: "#fff", border: "none",
                    borderRadius: t.radius.md, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Show the {detail.bad_row_count} bad row{detail.bad_row_count === 1 ? "" : "s"} {"→"}
                </button>
              )}
              {!showBad && !(detail.bad_row_count > 0) && (
                <div style={{ fontSize: 12, color: t.textMuted }}>No row-level sample for this event.</div>
              )}
              {showBad && bad && <BadTable t={t} bad={bad} rule={detail.rule_name} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- shared */
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
    <span onClick={onClick} style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px",
      borderRadius: t.radius.pill, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
      border: `1px solid ${active ? t.accent : t.border}`,
      background: active ? t.accent : t.panel, color: active ? "#fff" : t.sub }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, display: "inline-block" }} />}
      {label}
    </span>
  );
}
function Pill({ bg, text }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", padding: "2px 7px",
    borderRadius: 3, background: bg || "#5f6f8f", display: "inline-block" }}>{text}</span>;
}
function StepH({ t, children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    color: t.accent, margin: "16px 0 8px", letterSpacing: ".4px" }}>{children}</div>;
}
function KV({ t, k, v }) {
  return (
    <div style={{ display: "flex", padding: "7px 0", borderBottom: `1px solid ${t.bg}`, fontSize: 12.5 }}>
      <span style={{ width: 150, color: t.textMuted, flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: "monospace", minWidth: 0, wordBreak: "break-word" }}>{v || "—"}</span>
    </div>
  );
}
function BadTable({ t, bad, rule }) {
  const rows = bad.sample || [];
  if (!rows.length) return <div style={{ color: t.textMuted, fontSize: 12 }}>No sample rows.</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div>
      <div style={{ fontSize: 11, color: t.sub, marginBottom: 8 }}>
        {bad.bad_row_count} of {bad.total_row_count || "?"} rows failed <b>{rule}</b>.
      </div>
      <div style={{ border: `1px solid ${t.danger}`, borderRadius: t.radius.md, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c) => (
            <th key={c} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10, fontWeight: 700,
              color: t.danger, background: t.dangerBg, borderBottom: `1px solid ${t.danger}` }}>{c}</th>
          ))}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => {
              const val = r[c];
              const isNull = val === null || val === undefined;
              return <td key={c} style={{ padding: "7px 10px", fontSize: 12, fontFamily: "monospace",
                borderBottom: `1px solid ${t.bg}`, color: isNull ? t.danger : t.text,
                fontWeight: isNull ? 700 : 400 }}>{isNull ? "NULL" : String(val)}</td>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
