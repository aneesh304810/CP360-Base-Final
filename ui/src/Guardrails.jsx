import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";

const ENGINE = {
  great_expectations: { label: "Validation", color: "#ff6b35" },
  soda: { label: "Monitoring", color: "#1a73e8" },
  dbt: { label: "Transformation Tests", color: "#ff694a" },
  airflow: { label: "Orchestration", color: "#017cee" },
};
const SEV = { critical: "#c1113a", high: "#e67e22", medium: "#ca8a04", low: "#5f6f8f" };

function engineOf(k) { return ENGINE[k] || { label: k || "Other", color: "#5f6f8f" }; }

export default function Guardrails({ t, selection }) {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [engine, setEngine] = useState(null);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [bad, setBad] = useState(null);
  const [showBad, setShowBad] = useState(false);

  useEffect(() => { api.guardrailStats().then(setStats); }, []);
  useEffect(() => {
    api.guardrailAttention(engine).then((r) => setEvents(r.events || []));
  }, [engine]);
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
      <SectionHeader t={t}>Quality Guardrails</SectionHeader>
      <p style={{ fontSize: 13, color: t.sub, margin: "-18px 0 18px", maxWidth: 960 }}>
        Failed and at-risk jobs across <b>Validation</b>, <b>Monitoring</b>, <b>Transformation Tests</b> and
        <b> Orchestration</b>. Click a job to see what happened, then drill into the bad data that caused it.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {kpi(stats ? stats.attention : "\u2014", "Need attention", t.danger)}
        {kpi(stats ? stats.failed : "\u2014", "Failed", t.danger)}
        {kpi(stats ? stats.warning : "\u2014", "Warnings", t.warning)}
        {kpi(stats ? stats.critical : "\u2014", "Critical", t.danger)}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Chip t={t} active={!engine} onClick={() => setEngine(null)} label="All engines" />
        {Object.keys(ENGINE).map((k) => (
          <Chip key={k} t={t} active={engine === k} onClick={() => setEngine(k)}
            dot={ENGINE[k].color} label={`${ENGINE[k].label}${byEng[k] ? ` (${byEng[k]})` : ""}`} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* list */}
        <div style={{ width: 340, flexShrink: 0, maxHeight: 620, overflowY: "auto" }}>
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
              </div>
            );
          })}
        </div>

        {/* detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
                  Show the {detail.bad_row_count} bad row{detail.bad_row_count === 1 ? "" : "s"} {"\u2192"}
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
      <span style={{ fontFamily: "monospace" }}>{v || "\u2014"}</span>
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
      <div style={{ border: `1px solid ${t.danger}`, borderRadius: t.radius.md, overflow: "hidden" }}>
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
