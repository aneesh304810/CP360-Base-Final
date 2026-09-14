import React, { useState } from "react";
import { SectionHeader } from "./AppShell.jsx";
// =====================================================================
// System Design — interactive architecture overview. Clickable module
// cards navigate to each module; ingestion flow + lineage levels shown.
// Fourth tab: the SEI-BBH Engineering Design Pack (docs + tracker).
// =====================================================================

// the 13 ingestion steps in run order, what each reads and populates
const STEPS = [
 { step: "projects", reads: "project config", pop: "projects, project rules", grp: "setup" },
 { step: "oracle", reads: "Oracle schemas (optional)", pop: "datasets(TABLE/VIEW), columns", grp: "data" },
 { step: "feed_dictionary", reads: "SWP_EOD_Data_Feeds.xlsx", pop: "datasets(FEED), columns", grp: "data" },
 { step: "feed_catalog", reads: "inbound/outbound feeds xlsx (multi-sheet)", pop: "feed_catalog, columns", grp: "data" },
 { step: "loader_catalog", reads: "loaders.xlsx", pop: "loader_catalog", grp: "data" },
 { step: "dbt", reads: "manifest.json", pop: "datasets(MODEL), transformations, transform_lineage, column_lineage", grp: "data" },
 { step: "glossary", reads: "dbt metrics/meta + authored md", pop: "business_glossary, term_column_map", grp: "data" },
 { step: "airflow", reads: "Airflow metadata (file/Postgres)", pop: "datasets(DAG), runs, transform_lineage", grp: "data" },
 { step: "interface360", reads: "interfaces.xlsx", pop: "interface360_systems, _routing_hops", grp: "interface" },
 { step: "api360", reads: "Swagger + Postman collections", pop: "api_sources, api_endpoints, api_fields, api_business_flows", grp: "api" },
 { step: "pii_classification", reads: "PII_Attributes_List.xlsx", pop: "pii_classifications", grp: "pii" },
 { step: "pii_match", reads: "(scans loaded columns)", pop: "pii_field_matches", grp: "pii" },
 { step: "datapoint_index", reads: "(scans all loaded data)", pop: "dp_registry, dp_occurrences", grp: "datapoint" },
];

// the five modules — clickable cards
const MODULES = [
 { route: "interface", name: "Interface 360", color: "#0f4775",
 desc: "System-to-system interfaces, routing hops, PII flags.", fed: "interface360" },
 { route: "api", name: "API 360", color: "#0091bf",
 desc: "Swagger sources, endpoints, fields, errors + auto/curated business flows + flow builder.", fed: "api360" },
 { route: "data", name: "Data 360", color: "#159943",
 desc: "Pipelines (Airflow→feeds→dbt→SQL), lineage graph, business glossary, pipeline builder.", fed: "dbt + airflow + feeds" },
 { route: "datapoint", name: "Datapoint 360", color: "#7c3aed",
 desc: "Every place a data point appears across all modules (the indexed registry).", fed: "datapoint_index" },
 { route: "pii", name: "PII Explorer", color: "#c1113a",
 desc: "PII classifications and matches across feeds and API fields.", fed: "pii" },
];

// the 7 lineage levels and coverage
const LINEAGE = [
 ["Table / Dataset", "yes", "transform_lineage edges"],
 ["Column / Field", "yes", "column_lineage (sqlglot)"],
 ["Pipeline / Job", "yes", "DAG + runs + DAG→model"],
 ["System / Application", "yes", "Interface 360"],
 ["Business / Semantic", "yes", "glossary + term→column"],
 ["Row / Record", "no", "needs pipeline instrumentation"],
 ["Cell / Value", "no", "not built (forensic only)"],
];

const GRP_COLOR = { setup: "#5a6472", data: "#159943", interface: "#0f4775",
 api: "#0091bf", pii: "#c1113a", datapoint: "#7c3aed" };

export default function SystemDesign({ t, onNav }) {
 const [tab, setTab] = useState("Architecture");
 const TABS = ["Architecture", "Ingestion Flow", "Lineage Levels"];
 return (
 <div>
 <SectionHeader t={t}>System Design</SectionHeader>

 <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${t.border || t.disabled}`, marginBottom: 24 }}>
 {TABS.map((tb) => (
 <button key={tb} onClick={() => setTab(tb)} style={{
 background: "none", border: "none", fontSize: 13, fontWeight: 500, padding: "10px 18px",
 cursor: "pointer", fontFamily: t.font, color: tab === tb ? t.accent : (t.sub || t.textMuted),
 borderBottom: `2px solid ${tab === tb ? t.accent : "transparent"}`, marginBottom: -1 }}>{tb}</button>))}
 </div>

 {tab === "Architecture" && <Architecture t={t} onNav={onNav} />}
 {tab === "Ingestion Flow" && <IngestionFlow t={t} />}
 {tab === "Lineage Levels" && <LineageLevels t={t} />}
 </div>
 );
}

function Architecture({ t, onNav }) {
 const layer = (label, sub, bg) => (
 <div style={{ background: bg, color: "#fff", borderRadius: 8, padding: "14px 18px", textAlign: "center" }}>
 <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
 {sub && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>{sub}</div>}
 </div>
 );
 const arrow = <div style={{ textAlign: "center", color: t.muted || t.textMuted, fontSize: 22, margin: "2px 0" }}>{"↓"}</div>;
 return (
 <div style={{ maxWidth: 920 }}>
 <p style={{ fontSize: 13, color: t.sub || t.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
 CP Catalog is a self-hosted OpenMetadata-lite catalog on OpenShift + Oracle. Source artifacts are
 harvested by the ingestion pipeline into an Oracle store, served by a FastAPI read/write API, and
 browsed through a React UI. Click any module below to open it.</p>

 {layer("Source Artifacts", "Swagger · Postman · dbt manifest · Airflow · Excel feeds/loaders · Oracle schemas", "#5a6472")}
 {arrow}
 {layer("Ingestion Pipeline", "13 idempotent connectors · python -m ingestion.run", "#a8743a")}
 {arrow}
 {layer("Oracle Store", "datasets · columns · lineage · api_* · feed/loader · glossary · dp_registry", "#0f4775")}
 {arrow}
 {layer("FastAPI", "read endpoints + write (flow builder, pipeline builder) · /search", "#159943")}
 {arrow}

 {/* clickable module cards */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 4 }}>
 {MODULES.map((m) => (
 <button key={m.route} onClick={() => onNav && onNav(m.route)} style={{
 background: t.panel, border: `1px solid ${t.border}`, borderTop: `3px solid ${m.color}`,
 borderRadius: 8, padding: "14px", cursor: "pointer", fontFamily: t.font, textAlign: "left" }}>
 <div style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{m.name}</div>
 <div style={{ fontSize: 11, color: t.sub || t.textMuted, marginTop: 5, lineHeight: 1.45 }}>{m.desc}</div>
 <div style={{ fontSize: 10, color: t.muted || t.textMuted, marginTop: 8 }}>fed by: {m.fed}</div>
 </button>))}
 </div>
 <div style={{ fontSize: 11, color: t.muted || t.textMuted, marginTop: 14 }}>
 Plus a global <b>/search</b> across datasets, fields, feeds, and the datapoint registry, and the
 UI’s LIVE/DEMO fallback (mock data when the API is unreachable).</div>
 </div>
 );
}

function IngestionFlow({ t }) {
 return (
 <div>
 <p style={{ fontSize: 13, color: t.sub || t.textMuted, marginBottom: 18, lineHeight: 1.6, maxWidth: 900 }}>
 The orchestrator (<code>python -m ingestion.run</code>) runs 13 idempotent steps in order. Each reads a
 source and populates Oracle tables. <code>datapoint_index</code> runs last because it scans everything
 the other steps loaded. Run a subset by passing step names as arguments.</p>
 <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden" }}>
 {STEPS.map((s, i) => (
 <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
 background: i % 2 ? (t.bgsoft || "#f5f8f8") : t.panel, borderBottom: i < STEPS.length - 1 ? `1px solid ${t.bg}` : "none" }}>
 <span style={{ fontSize: 11, color: t.muted || t.textMuted, width: 20 }}>{i + 1}</span>
 <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: GRP_COLOR[s.grp] || t.muted,
 padding: "2px 7px", borderRadius: 3, minWidth: 70, textAlign: "center" }}>{s.grp}</span>
 <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: t.navy, minWidth: 150 }}>{s.step}</span>
 <span style={{ fontSize: 12, color: t.sub || t.textMuted, minWidth: 230 }}>{s.reads}</span>
 <span style={{ fontSize: 11, color: t.muted || t.textMuted, fontFamily: "monospace" }}>{"→"} {s.pop}</span>
 </div>))}
 </div>
 </div>
 );
}

function LineageLevels({ t }) {
 return (
 <div style={{ maxWidth: 760 }}>
 <p style={{ fontSize: 13, color: t.sub || t.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
 Lineage granularity from coarsest to finest. CP Catalog anchors on table + column, with pipeline,
 system, and business/semantic layered on. Row and cell level are not built (row-level needs runtime
 pipeline instrumentation).</p>
 <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
 <thead><tr>{["Level", "Status", "Backed by"].map((h) => (
 <th key={h} style={{ background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "9px 12px",
 fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent }}>{h}</th>))}</tr></thead>
 <tbody>{LINEAGE.map(([lvl, st, by]) => (
 <tr key={lvl}>
 <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: t.navy, borderBottom: `1px solid ${t.bg}` }}>{lvl}</td>
 <td style={{ padding: "9px 12px", borderBottom: `1px solid ${t.bg}` }}>
 <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", padding: "2px 8px", borderRadius: 3,
 background: st === "yes" ? "#159943" : "#9aa3b0" }}>{st === "yes" ? "BUILT" : "NOT BUILT"}</span></td>
 <td style={{ padding: "9px 12px", fontSize: 12, color: t.sub || t.textMuted, borderBottom: `1px solid ${t.bg}` }}>{by}</td>
 </tr>))}</tbody>
 </table>
 </div>
 );
}
