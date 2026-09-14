import React, { useState, useEffect } from "react";
import { api } from "./api.js";

// CP 360° home / overview. Hero + module cards + KPI numbers.
// Counts are pulled live from the API; they fall back to an em dash while loading.

const MODULES = [
  { key: "interface", label: "Interface 360", glyph: "\u21C4", color: "#0091bf",
    desc: "Every system-to-system interface, SEI and non-SEI, with routing paths.",
    stats: (s) => [[s.if?.total_interfaces, "Interfaces"], [s.if?.total_systems, "Systems"]] },
  { key: "api", label: "API 360", glyph: "\u25C8", color: "#7c3aed",
    desc: "Business flows mapped to SEI SWP REST endpoints, with Swagger and Postman.",
    stats: (s) => [[s.api?.total_endpoints, "Endpoints"], [s.api?.total_domains, "Domains"]] },
  { key: "data", label: "Data 360", glyph: "\u25A4", color: "#159943",
    desc: "Feeds, loaders, dbt pipelines, interdependency and column lineage.",
    stats: (s) => [[s.feeds, "Feeds"], [s.loaders, "Loaders"]] },
  { key: "datapoint", label: "Datapoint 360", glyph: "\u25C9", color: "#0f4775",
    desc: "Every attribute across feeds and APIs — inbound, outbound, round-trip.",
    stats: (s) => [[s.datapoints, "Data Points"], [s.api?.total_domains, "Domains"]] },
  { key: "pii", label: "PII Explorer", glyph: "\u2691", color: "#c1113a",
    desc: "Where sensitive data lives, classified for NYDFS 500 governance.",
    stats: (s) => [[s.pii?.attributes, "PII Attrs"], [s.pii?.affected_fields, "Carry PII"]] },
  { key: "guardrails", label: "Quality Guardrails", glyph: "\u26A0", color: "#e67e22",
    desc: "Failed and at-risk jobs across validation, monitoring, tests and orchestration.",
    stats: (s) => [[s.gr?.attention, "Alerts"], [s.gr?.critical, "Critical"]] },
];

export default function LandingPage({ t, onNav }) {
  const [ifS, setIfS] = useState(null);
  const [apiS, setApiS] = useState(null);
  const [feeds, setFeeds] = useState(null);
  const [loaders, setLoaders] = useState(null);
  const [datapoints, setDatapoints] = useState(null);
  const [pii, setPii] = useState(null);
  const [gr, setGr] = useState(null);

  useEffect(() => {
    api.interfaceStats().then(setIfS).catch(() => {});
    api.apiStats().then(setApiS).catch(() => {});
    api.data360Stats().then((d) => setFeeds(d?.by_type?.FEED ?? null)).catch(() => {});
    api.loaders().then((r) => setLoaders((r.loaders || r || []).length || null)).catch(() => {});
    api.piiStats().then((p) => { setPii(p); setDatapoints(p?.total_datapoints ?? null); }).catch(() => {});
    api.guardrailStats().then(setGr).catch(() => {});
  }, []);

  const S = { if: ifS, api: apiS, feeds, loaders, datapoints, pii, gr };
  const dash = (v) => (v === undefined || v === null ? "\u2014" : v);

  const kpi = (n, l, tone) => (
    <div style={{ background: t.panel, border: `1px solid ${t.disabled}`,
      borderRadius: t.radius.md, padding: "15px 20px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05,
        color: tone === "danger" ? t.danger : tone === "warn" ? t.warning : t.navy }}>{n}</div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.5, color: t.textMuted, marginTop: 6 }}>{l}</div>
    </div>
  );

  return (
    <div>
      {/* HERO */}
      <div style={{ background: "linear-gradient(120deg,#10193b,#0f4775)", borderRadius: 14,
        padding: "26px 32px", color: "#fff", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 24, top: -28, fontSize: 130, fontWeight: 800,
          color: "rgba(255,255,255,0.05)", letterSpacing: -4, pointerEvents: "none" }}>360°</div>
        <h1 style={{ fontSize: 24, margin: "0 0 8px", fontWeight: 600 }}>
          The 360° view of Capital Partners' data estate</h1>
        <p style={{ fontSize: 13.5, color: "#cdd9ea", maxWidth: 720, lineHeight: 1.55, margin: 0 }}>
          One catalog for BBH Capital Partners' migration from legacy AddVantage to the SEI Wealth
          Platform — interfaces, APIs, feeds, loaders, data points and pipelines, with lineage, PII
          governance and quality guardrails.</p>
      </div>

      {/* MODULE CARDS */}
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
        color: t.textMuted, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
        Explore the catalog
        <span style={{ fontSize: 9, background: t.pop, color: "#fff", borderRadius: 999, padding: "2px 8px" }}>START HERE</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 16, marginBottom: 30 }}>
        {MODULES.map((m) => (
          <div key={m.key} onClick={() => onNav(m.key)}
            style={{ background: t.panel, border: `1px solid ${t.disabled}`,
              borderTop: `4px solid ${m.color}`, borderRadius: 12, padding: 18, cursor: "pointer",
              transition: "transform .12s, box-shadow .12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 8px 22px rgba(16,25,59,.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: m.color,
              display: "grid", placeItems: "center", fontSize: 18, color: "#fff", marginBottom: 10 }}>{m.glyph}</div>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, color: t.navy }}>{m.label}</h3>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: t.sub, lineHeight: 1.5 }}>{m.desc}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {m.stats(S).map(([val, lbl], i) => (
                <div key={i}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: t.navy }}>{dash(val)}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>{lbl}</div>
                </div>))}
            </div>
          </div>
        ))}
      </div>

      {/* KPIS */}
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
        color: t.textMuted, margin: "0 0 14px" }}>By the numbers</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 14, marginBottom: 20 }}>
        {kpi(dash(ifS?.total_interfaces), "Interfaces")}
        {kpi(dash(apiS?.total_endpoints), "API Endpoints")}
        {kpi(dash(feeds), "Inbound Feeds")}
        {kpi(dash(loaders), "Loaders")}
        {kpi(dash(datapoints), "Data Points")}
        {kpi(dash(pii?.affected_fields), "Carry PII", "danger")}
        {kpi(dash(gr?.attention), "Quality Alerts", "danger")}
      </div>
    </div>
  );
}
