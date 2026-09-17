import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import BizLineage from "./BizLineage.jsx";
import LegacyLineage from "./LegacyLineage.jsx";
import SourceLineage from "./SourceLineage.jsx";

// =====================================================================
// LineageHome — the Lineage shell, superseding the old Lineage.jsx
// wrapper. Owns everything the wrapper owned, plus the landing doors:
//   - landing: warehouse cards (PBDW / IMDS·IN BUILD), each with two
//     doors — 📖 Business view · 🛠 Technical view — the user decides
//     where to go before entering
//   - SEI | Non-SEI scope (SEI arrives with the SWP program)
//   - AddVantage / CRD / STAR system badges (from /legacy-lineage/systems)
//   - data-source chip + Business/Technical switch for flipping mid-flight
//   - search / Datapoint 360 deep-links: selection {tab: system, id: code}
//     resolves via the dictionary's lineage_target to a DWH table.column
//     and lands directly in Technical view, pre-expanded (ported from the
//     old wrapper); a {table, column} shape deep-links directly
//   - cross-warehouse jumps from the engine's inline panels
// =====================================================================

const SYS_META = {
 ADDVANTAGE: { label: "AddVantage", c: "#6d3ac0", bg: "#efe6fb" },
 CRD: { label: "CRD", c: "#0b7d7d", bg: "#e6f6f6" },
 STAR: { label: "STAR", c: "#b5651d", bg: "#f6ecdf" },
};
const SOURCES = [
 { id: "PBDW", icon: "🏪", name: "PB Data Warehouse",
   sub: "private banking · statements, billing, client reporting" },
 { id: "IMDS", icon: "📈", name: "IM Data Warehouse",
   sub: "investment management · portfolios, performance, holdings",
   inBuild: true },
];

export default function LineageHome({ t, focus }) {
 const [ds, setDs] = useState(null);
 const [view, setView] = useState("business");
 const [scope, setScope] = useState("nonsei");
 const [curSys, setCurSys] = useState("ADDVANTAGE");
 const [systems, setSystems] = useState([]);
 const [techFocus, setTechFocus] = useState(null);
 const [stats, setStats] = useState({});
 const [dsCounts, setDsCounts] = useState({});
 const enter = (d, v) => { setDs(d); setView(v); };

 // landing stats + systems + data-source counts (one fetch each, cached)
 useEffect(() => {
  api.legacySystems().then((d) => {
   const sys = d.systems || [];
   setSystems(sys);
   if (sys.length && !sys.find((s) => s.source_system === "ADDVANTAGE"))
    setCurSys(sys[0].source_system);
  }).catch(() => {});
  api.legacyDataSources().then((d) => {
   const m = {};
   (d.data_sources || []).forEach((x) => {
    m[(x.data_source || "PBDW").toUpperCase()] = x.field_count;
   });
   setDsCounts(m);
  }).catch(() => {});
  SOURCES.forEach((s) => {
   api.legacyLineageTables(s.id).then((d) => {
    const tabs = d.tables || [];
    const fields = tabs.reduce((n, x) => n + (x.field_count || 0), 0);
    const mapped = tabs.reduce((n, x) => n + (x.mapped || 0), 0);
    const groups = new Set(tabs.map((x) => x.functional_group || "Unassigned"));
    setStats((m) => ({ ...m, [s.id]: { groups: groups.size,
     tables: tabs.length, fields,
     pct: fields ? Math.round((mapped / fields) * 100) : 0 } }));
   }).catch(() => {});
  });
 }, []);

 // deep-link — ported from the old wrapper:
 // {table, column}          -> straight into Technical on that field
 // {tab: system, id: code}  -> dictionary lineage_target -> table.column
 useEffect(() => {
  if (!focus) return;
  setScope("nonsei");
  if (focus.table) {
   setDs((cur) => cur || (focus.dataSource || "PBDW"));
   setView("technical");
   setTechFocus({ table: focus.table, column: focus.column });
   return;
  }
  if (!focus.id) return;
  if (focus.tab && SYS_META[focus.tab]) setCurSys(focus.tab);
  api.legacyDictionary(focus.tab || curSys, focus.id).then((d) => {
   const hit = (d.definitions || []).find(
    (x) => x.field_code === focus.id || x.field_code_norm === focus.id);
   if (hit && hit.lineage_target) {
    const [table, column] = String(hit.lineage_target).split(".");
    if (table) {
     setDs((cur) => cur || "PBDW");
     setView("technical");
     setTechFocus({ table, column });
    }
   }
  }).catch(() => {});
 }, [focus]);

 const openTechnical = (loc) => { setTechFocus(loc); setView("technical"); };
 const switchWarehouse = (d, loc) => {
  setDs((d || "PBDW").toUpperCase());
  if (loc && loc.table) { setTechFocus({ table: loc.table, column: loc.column });
   setView("technical"); }
 };

 const swBtn = (on) => ({ padding: "4px 14px", fontSize: 11, borderRadius: 999,
  cursor: "pointer", userSelect: "none",
  background: on ? (t.pop || "#31bced") : "transparent",
  color: on ? (t.navy || "#10193b") : "#8fb4dd",
  fontWeight: on ? 700 : 400 });
 const scopeBtn = (k, label, first) => (
  <button key={k} onClick={() => setScope(k)}
   style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 16px", cursor: "pointer",
    fontFamily: "inherit", borderStyle: "solid",
    borderColor: scope === k ? (t.accent || "#0f4775") : (t.panel2 || "#dfe6e9"),
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderLeftWidth: first ? 1 : 0,
    borderRadius: first ? "3px 0 0 3px" : "0 3px 3px 0",
    background: scope === k ? (t.accent || "#0f4775") : "#fff",
    color: scope === k ? "#fff" : (t.sub || "#666") }}>{label}</button>);

 const header = (
  <>
   <SectionHeader t={t}>Lineage</SectionHeader>
   <div style={{ fontSize: 12, color: t.sub || "#666", margin: "-22px 0 16px" }}>
    End-to-end lineage — SRC → STG1 → STG2 → DWH with business
    definitions, proof values, and dependency views</div>
  </>);

 /* ---------- landing: pick warehouse + door ---------- */
 if (!ds) {
  return (
   <div>
    {header}
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 8 }}>
     <div style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
      marginBottom: 22 }}>
      pick a warehouse and a door — Business for the pictorial drill,
      Technical for the full developer screen</div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22,
      maxWidth: 760, margin: "0 auto" }}>
      {SOURCES.map((s) => {
       const st = stats[s.id];
       return (
        <div key={s.id}
         style={{ background: "#fff", border: "1.5px solid #c9d4dc",
          borderRadius: 14, padding: "26px 24px", textAlign: "center" }}>
         <div style={{ fontSize: 40, marginBottom: 8 }}>{s.icon}</div>
         <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 3px" }}>{s.id}
          {s.inBuild && (
           <span style={{ marginLeft: 8, fontSize: 8.5, fontWeight: 700,
            letterSpacing: ".05em", borderRadius: 999, padding: "2px 8px",
            background: "#e67e22", color: "#fff",
            verticalAlign: 3 }}>IN BUILD</span>)}</h2>
         <small style={{ fontSize: 11.5, color: "#7b8894", display: "block",
          lineHeight: 1.6 }}>{s.name}<br />{s.sub}</small>
         <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <div onClick={() => enter(s.id, "business")}
           style={{ flex: 1, padding: "11px 8px", borderRadius: 9,
            cursor: "pointer", background: "#0f4775", color: "#fff",
            textAlign: "center" }}>
           <div style={{ fontSize: 16 }}>📖</div>
           <b style={{ fontSize: 12 }}>Business view</b>
           <div style={{ fontSize: 9.5, opacity: 0.85 }}>
            pictorial drill · anyone can read it</div>
          </div>
          <div onClick={() => enter(s.id, "technical")}
           style={{ flex: 1, padding: "11px 8px", borderRadius: 9,
            cursor: "pointer", background: "#fff", color: "#0f4775",
            border: "1.5px solid #0f4775", textAlign: "center" }}>
           <div style={{ fontSize: 16 }}>🛠</div>
           <b style={{ fontSize: 12 }}>Technical view</b>
           <div style={{ fontSize: 9.5, opacity: 0.8 }}>
            full developer screen · chains · proof</div>
          </div>
         </div>
         <div style={{ display: "flex", justifyContent: "center", gap: 18,
          marginTop: 14, fontSize: 11, color: "#7b8894" }}>
          {st ? (
           [["groups", st.groups], ["tables", st.tables],
            ["fields", st.fields.toLocaleString()],
            ["mapped", st.pct + "%"]].map((kv) => (
            <span key={kv[0]}>
             <b style={{ display: "block", fontSize: 16, color: "#233240",
              fontWeight: 500, textAlign: "center" }}>{kv[1]}</b>{kv[0]}</span>))
          ) : <span>{dsCounts[s.id] != null
            ? `${dsCounts[s.id]} mapped fields` : "loading…"}</span>}
         </div>
        </div>);
      })}
     </div>
    </div>
   </div>);
 }

 /* ---------- shell: scope + system badges + view switch ---------- */
 return (
  <div>
   {header}
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    margin: "10px 0 12px", flexWrap: "wrap" }}>
    <span onClick={() => setDs(null)}
     style={{ fontSize: 11, fontWeight: 700, borderRadius: 999,
      padding: "4px 13px", cursor: "pointer", color: "#fff",
      background: ds === "IMDS" ? "#0b7d9e" : (t.accent || "#0f4775") }}>
     {ds} ▾{ds === "IMDS" && (
      <span style={{ marginLeft: 7, fontSize: 8, fontWeight: 700,
       borderRadius: 999, padding: "1px 6px", background: "#e67e22",
       color: "#fff" }}>IN BUILD</span>)}</span>
    <div style={{ display: "inline-flex", background: t.navy || "#10193b",
     borderRadius: 999, padding: 2 }}>
     <span style={swBtn(view === "business")}
      onClick={() => setView("business")}>Business view</span>
     <span style={swBtn(view === "technical")}
      onClick={() => setView("technical")}>Technical view</span>
     <span style={swBtn(view === "source")}
      onClick={() => setView("source")}>Source view</span>
    </div>
    <span>{scopeBtn("sei", "SEI", true)}{scopeBtn("nonsei", "Non-SEI", false)}</span>
    {scope === "nonsei" && (
     <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Object.entries(SYS_META).map(([k, m]) => {
       const present = systems.find((s) => s.source_system === k);
       const on = curSys === k;
       return (
        <span key={k}
         onClick={present ? () => setCurSys(k) : undefined}
         title={present ? `${present.def_count || ""} definitions`
          : `${m.label} workbook pending`}
         style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
          fontWeight: 700, padding: "4px 11px", borderRadius: 999,
          border: `1.5px solid ${on ? m.c : (t.panel2 || "#dfe6e9")}`,
          background: on ? m.c : "#fff",
          color: on ? "#fff" : (t.sub || "#666"),
          opacity: present ? 1 : 0.5,
          cursor: present ? "pointer" : "not-allowed" }}>
         <span style={{ width: 7, height: 7, borderRadius: "50%",
          background: on ? "#fff" : m.c }} />
         {m.label}
         {present && <span style={{ fontSize: 8.5, opacity: 0.8 }}>
          {present.def_count}</span>}
        </span>);
      })}
     </span>)}
    {view === "technical" && scope === "nonsei" && (
     <span style={{ fontSize: 10.5, color: "#7b8894" }}>
      your full developer screen — unchanged</span>)}
   </div>

   {scope === "sei" ? (
    <div style={{ background: t.panel || "#fff",
     border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 3, padding: 44, textAlign: "center",
     color: t.muted || "#999", fontSize: 13 }}>
     🧬 SEI lineage — arriving with the SWP program.<br />
     <span style={{ fontSize: 11 }}>Non-SEI (AddVantage) is available now.</span>
    </div>
   ) : view === "source" ? (
    <SourceLineage t={t} system={curSys} dataSource={ds} tech={false}
     onOpenTechnical={openTechnical} />
   ) : view === "business" ? (
    <BizLineage t={t} system={curSys} dataSource={ds}
     onTechnical={openTechnical} onDataSource={switchWarehouse} />
   ) : (
    <LegacyLineage t={t} system={curSys} dataSource={ds}
     onDataSource={switchWarehouse} focus={techFocus} />
   )}
  </div>);
}
