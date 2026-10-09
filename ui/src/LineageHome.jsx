import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import BizLineage from "./BizLineage.jsx";
import LegacyLineage from "./LegacyLineage.jsx";
import SourceLineage from "./SourceLineage.jsx";
import CrosswalkDashboard from "./CrosswalkDashboard.jsx";
import { crosswalkApi } from "./seiCrosswalkApi.js";

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
 CRD: { label: "CRD", c: "#2563eb", bg: "#e4edfd" },
 STAR: { label: "STAR", c: "#b5651d", bg: "#f6ecdf" },
 // UAF feeds IMDS through PDPA009/PDBA016 and was missing from this list
 // entirely, so IMDS's second incumbent could not be selected at all.
 UAF: { label: "UAF", c: "#0b7d7d", bg: "#e6f6f6" },
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
 // Which systems feed THIS warehouse. /legacy-lineage/systems takes no
 // data_source, so it returned the same three everywhere — which is why IMDS
 // offered AddVantage and defaulted to it.
 const [dsSystems, setDsSystems] = useState(null);
 // The whole answer, not just the names. `route` says WHICH signal
 // attributed a system to this warehouse, and that is the only way a wrong
 // register row becomes findable: "IMDS offers AddVantage" is a symptom,
 // "IMDS offers AddVantage because legacy_lane declares it" is a bug report.
 const [laneInfo, setLaneInfo] = useState(null);
 const [techFocus, setTechFocus] = useState(null);
 const [scopeOpen, setScopeOpen] = useState(false);
 const [stats, setStats] = useState({});
 const [dsCounts, setDsCounts] = useState({});
 const enter = (d, v) => { setDs(d); setView(v); };

 useEffect(() => {
  if (!ds) { setDsSystems(null); setLaneInfo(null); return; }
  let live = true;
  crosswalkApi.laneSystems(ds).then((r) => {
   if (!live) return;
   const names = (r.systems || []).map((x) => (x.source_system || x.SOURCE_SYSTEM || "").toUpperCase())
                                  .filter(Boolean);
   // resolved=false means the question could not be answered, not that the
   // answer is none. Only then do we fall back to the global list.
   setLaneInfo(r);
   setDsSystems(r.resolved ? names : null);
   if (r.resolved && names.length && !names.includes(curSys)) setCurSys(names[0]);
  });
  return () => { live = false; };
 }, [ds]);

 // The lane's system and the DICTIONARY's system are not the same question.
 // legacy_dictionary holds ADDVANTAGE, CRD and STAR; it has no UAF rows at
 // all. Passing "UAF" into a dictionary lookup therefore matched nothing and
 // every business term and description on the screen blanked out — which is
 // what switching between STAR and UAF looked like. Where the selected
 // system has no dictionary, ask for no system rather than an empty one.
 const dictSys = systems.some(
  (x) => (x.source_system || "").toUpperCase() === (curSys || "").toUpperCase())
  ? curSys : null;

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

 // The strapline explains the page to someone arriving at it. Once you are
 // inside a warehouse it is two lines of text you have already read, and on
 // a 768px laptop the content area is only ~470px tall — every band above
 // the first group row is one fewer row of data. So it shows on the landing
 // and not after.
 const header = (
  <>
   <SectionHeader t={t}>Lineage</SectionHeader>
   {!ds && (
    <div style={{ fontSize: 12, color: t.sub || "#666", margin: "-22px 0 16px" }}>
     End-to-end lineage — SRC → STG1 → STG2 → DWH with business
     definitions, proof values, and dependency views</div>)}
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

 /* ---------- shell: view switch + one scope chip ----------
  This row carried five control groups on one line: warehouse, the
  Business/Technical/Source switch, SEI vs Non-SEI, three source-system
  badges, and a note to the developer. Nothing distinguished the controls
  that NARROW the data (scope) from the one that RESHAPES it (view), so the
  band read as an undifferentiated wall of pills.

  Now the view switch stays out in the open, because it is the choice people
  make constantly, and everything that is scope collapses into one chip
  reading "PBDW · Non-SEI · AddVantage" that opens a popover. Scope is set
  on arrival and rarely touched again; it does not deserve permanent space. */
 const sysLabel = (SYS_META[curSys] || {}).label || curSys;
 const scopeSummary = [ds, scope === "sei" ? "SEI" : "Non-SEI",
                       scope === "nonsei" ? sysLabel : null]
                      .filter(Boolean).join(" · ");
 const popRow = { display: "flex", alignItems: "center", gap: 7,
                  flexWrap: "wrap", padding: "9px 13px" };
 const popLbl = { fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
                  letterSpacing: 0.5, color: t.muted || "#999",
                  width: 76, flex: "0 0 auto" };
 return (
  <div>
   {header}
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    margin: "10px 0 14px", flexWrap: "wrap" }}>
    <div style={{ display: "inline-flex", background: t.navy || "#10193b",
     borderRadius: 999, padding: 2 }}>
     <span style={swBtn(view === "business")}
      onClick={() => setView("business")}>Business view</span>
     <span style={swBtn(view === "technical")}
      onClick={() => setView("technical")}>Technical view</span>
     <span style={swBtn(view === "source")}
      onClick={() => setView("source")}>Source view</span>
    </div>

    <div style={{ position: "relative" }}>
     <span onClick={() => setScopeOpen((v) => !v)}
      title="Warehouse, SEI scope and source system"
      style={{ display: "inline-flex", alignItems: "center", gap: 7,
       fontSize: 11, fontWeight: 700, borderRadius: 999,
       padding: "5px 13px", cursor: "pointer", background: "#fff",
       border: `1.5px solid ${scopeOpen ? (t.accent || "#0f4775")
                                        : (t.panel2 || "#dfe6e9")}`,
       color: t.navy || "#10193b" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%",
       background: ds === "IMDS" ? "#0b7d9e" : (t.accent || "#0f4775") }} />
      {scopeSummary}
      {ds === "IMDS" && (
       <span style={{ fontSize: 8, fontWeight: 700, borderRadius: 999,
        padding: "1px 6px", background: "#e67e22", color: "#fff" }}>IN BUILD</span>)}
      <span style={{ fontSize: 9, color: t.muted || "#999" }}>▾</span>
     </span>

     {scopeOpen && (
      <>
       {/* click-away catcher, deliberately not a dimming scrim — the page
           behind stays readable while you change scope */}
       <div onClick={() => setScopeOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 30 }} />
       <div style={{ position: "absolute", top: "calc(100% + 7px)", left: 0,
        zIndex: 31, minWidth: 340, background: t.panel || "#fff",
        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
        boxShadow: "0 12px 34px rgba(16,25,59,.16)", overflow: "hidden" }}>
        <div style={popRow}>
         <span style={popLbl}>Warehouse</span>
         {SOURCES.map((o) => (
          <span key={o.id} onClick={() => { setDs(o.id); setScopeOpen(false); }}
           style={{ fontSize: 11, fontWeight: 700, padding: "4px 11px",
            borderRadius: 999, cursor: "pointer",
            border: `1.5px solid ${ds === o.id ? (t.accent || "#0f4775")
                                               : (t.panel2 || "#dfe6e9")}`,
            background: ds === o.id ? (t.accent || "#0f4775") : "#fff",
            color: ds === o.id ? "#fff" : (t.sub || "#666") }}>
           {o.id}{o.inBuild && <span style={{ fontSize: 8, marginLeft: 5,
            opacity: 0.85 }}>IN BUILD</span>}</span>))}
        </div>
        <div style={{ ...popRow, borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
         <span style={popLbl}>Scope</span>
         {scopeBtn("sei", "SEI", true)}{scopeBtn("nonsei", "Non-SEI", false)}
        </div>
        {scope === "nonsei" && (
         <div style={{ ...popRow, borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
          <span style={popLbl}>System</span>
          {Object.entries(SYS_META)
           .filter(([k]) => dsSystems === null || dsSystems.includes(k))
           .map(([k, m]) => {
           const present = (dsSystems && dsSystems.includes(k))
            || systems.find((x) => x.source_system === k);
           // ATTRIBUTED means this warehouse's own lanes, feeds or verify
           // rows name the system. When the question could not be answered
           // at all, every known system is listed -- and a listed system is
           // NOT a claim that it feeds this warehouse. IMDS offering
           // AddVantage came from exactly that silence, so the chip now
           // looks different from one the data stands behind.
           const attributed = Boolean(dsSystems && dsSystems.includes(k));
           const cols = ((laneInfo && laneInfo.systems) || [])
            .find((x) => (x.source_system || "").toUpperCase() === k);
           const on = curSys === k;
           return (
            <span key={k}
             onClick={present ? () => setCurSys(k) : undefined}
             title={!present ? `${m.label} workbook pending`
              : attributed
                ? `${m.label} feeds ${ds}: ${(cols && cols.columns_) || 0} `
                  + `column(s) attributed via ${(laneInfo && laneInfo.route) || "?"}`
                : `Nothing attributes ${m.label} to ${ds}. Listed because the `
                  + `question could not be answered, not because it feeds it.`}
             style={{ display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, padding: "4px 11px",
              borderRadius: 999,
              borderWidth: 1.5, borderColor: on ? m.c : (t.panel2 || "#dfe6e9"),
              background: on ? m.c : "#fff",
              color: on ? "#fff" : (t.sub || "#666"),
              // a system nothing attributes to this warehouse is drawn as
              // a guess: dashed, not solid.
              borderStyle: present && !attributed && dsSystems === null
               ? "dashed" : "solid",
              opacity: present ? (attributed || dsSystems === null ? 1 : 0.5) : 0.5,
              cursor: present ? "pointer" : "not-allowed" }}>
             <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: on ? "#fff" : m.c }} />
             {m.label}
             {present && <span style={{ fontSize: 8.5, opacity: 0.8 }}>
              {present.def_count}</span>}
            </span>);
          })}
          {/* AN UNANSWERED QUESTION IS NOT A LIST OF ANSWERS. When no lane,
              feed or verify row attributes a system to this warehouse, the
              row above is every system CP 360 knows about rather than the
              ones that feed this one -- and saying so is the difference
              between a picker and a claim. */}
          <div style={{ flexBasis: "100%", fontSize: 10, lineHeight: 1.5,
           color: t.muted || "#999", marginTop: 2 }}>
           {dsSystems === null
            ? `Nothing in ${ds} attributes a source system yet, so every known `
              + `system is listed. This is not a statement that each one feeds `
              + `${ds}.`
            : `Attributed to ${ds} from ${(laneInfo && laneInfo.route) || "?"}.`}
          </div>
         </div>)}
        {/* setDs(null) used to live on the old warehouse chip, and it is the
            ONLY route back to the landing page — removing that chip without
            this would have stranded anyone who entered through a door. */}
        <div onClick={() => { setScopeOpen(false); setDs(null); }}
         style={{ padding: "9px 13px", cursor: "pointer", fontSize: 11,
          fontWeight: 600, color: t.accent || "#0f4775",
          background: "#f7f9fb",
          borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
         ← All warehouses</div>
       </div>
      </>)}
    </div>
   </div>

   {/* scope === "sei" was a placeholder panel reserving this slot for the
       SWP program. CrosswalkDashboard is what goes in it. It self-hides when
       the warehouse has no crosswalk loaded, so PBDW is unchanged until its
       own workbook is ingested — no flag, the data decides. */}
   {scope === "sei" ? (
    <CrosswalkDashboard t={t} dataSource={ds} onOpenTechnical={openTechnical} />
   ) : view === "source" ? (
    <SourceLineage t={t} system={curSys} dictSystem={dictSys} dataSource={ds}
     tech={false} onOpenTechnical={openTechnical} />
   ) : view === "business" ? (
    <BizLineage t={t} system={curSys} dictSystem={dictSys} dataSource={ds}
     onTechnical={openTechnical} onDataSource={switchWarehouse} />
   ) : (
    <LegacyLineage t={t} system={curSys} dataSource={ds}
     onDataSource={switchWarehouse} focus={techFocus} />
   )}
  </div>);
}
