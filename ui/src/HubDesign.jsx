import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { TRACKER_COMPONENTS } from "./seiDesignTracker.js";
import DocDrill, { DOCS, DEFAULT_DOC, docFor } from "./DocDrill.jsx";
import SeiDesignPack from "./SeiDesignPack.jsx";
import { HUB_EVENT_COMPONENTS } from "./hubEventComponents.js";
import HubDiscussion from "./HubDiscussion.jsx";
import { AR_FINDINGS, AR_VERDICTS, AR_ASSUMPTIONS, AR_BOTTLENECKS, AR_ERRORS,
 AR_COVERAGE, AR_SEI_COVER, AR_OWNER, AR_PLANE_REC } from "./hubArchitectReview.js";
import { FM_SUMMARY, FM_AREAS, FM_STATE, FM_PROVIDED, FM_TABLES, FM_REC }
 from "./hubFoundationModel.js";
import SourceReference, { citationsFor } from "./SourceReference.jsx";
import SeiDocModal from "./SeiDocModal.jsx";
import { DBTDOC_ALIGN, DBTDOC_VERDICTS, DBTDOC_MISSING, DBTDOC_SELF_CONFLICT, DBTDOC_NAME,
 DBTDOC_SOURCE, dbtDocFor, dbtDocCount } from "./hubDbtDocAlignment.js";
import { SEI_DOCS, SEI_BOUNDARY, SEI_STAGES, SEI_COMPONENTS, SEI_TABLES,
 SEI_STATES, SEI_OPEN, SEI_ASSUMPTIONS, SEI_NOT_BUILT, seiCompsIn }
 from "./seiBaseline.js";
import { REGISTRY, REG_STATE, REG_ORIGIN, REG_REVIEW_NOTE, BBH_LAYERS,
 BBH_EXTENSION } from "./hubComponentRegistry.js";
import { GROUPS, PROC_STAGES, groupOfTracker, stageOfTracker, groupById,
 stageById, LANES, lanesOf, laneOfTracker, laneById } from "./hubGroups.js";
import { SEI_ARCH_DOC, ARCH_FEEDS, ARCH_LAYERS, ARCH_ORCHESTRATION,
 ARCH_PRINCIPLES, ARCH_CONFLICTS, OUTBOUND_FLOW, INBOUND_POSTURE,
 conflictsAt } from "./seiArchitecture.js";
import { ContextView, GateView, LoaderLoopView, Stage2Model,
 FileIngestionView, Stage1Model, DbModelView } from "./HubContext.jsx";
import { s2DomainName, s2DomainOf, S2_TABLES, S2_RELS, S2_INFERRED_COUNT }
 from "./hubStage2Model.js";

// =====================================================================
// HubDesign — the CP Integration Hub route: C4 landing (L1 context +
// delivery dashboard) → L2 containers → L3 components → L4 DocDrill.
// The mockup hub_design_c4_mockup.html is the acceptance spec.
// =====================================================================

const contOf = (c) => {
 if (c.zone === "1. SEI") return "EXT";
 if (c.zone === "3. Consumers") return "CONS";
 if (c.zone === "4. OpenShift") return "PLAT";
 return { "Event Ingestion": "EVT", "Ingress/Egress": "IE", Processing: "PROC",
  Orchestration: "ORCH", "Data Quality": "DQ", Foundation: "FND" }[c.plane] || "FND";
};
const COMPS = [...TRACKER_COMPONENTS, ...HUB_EVENT_COMPONENTS]
 .map((c) => ({ ...c, container: contOf(c) }));
const FIND = {};
AR_FINDINGS.forEach((f) => { FIND[f.id] = f; });
const COV = {};
AR_COVERAGE.forEach((r) => { COV[r.id] = r; });
const covOf = (c) => COV[c.arId] || COV[c.id];
const newIn = (k) => COMPS.filter((c) => c.container === k && c.isNew).length;
const asksIn = (k) => COMPS.filter((c) => c.container === k)
 .filter((c) => (covOf(c) || {}).ask).length;
const findIn = (k) => COMPS.filter((c) => c.container === k && FIND[c.id]).length;
const CONTAINERS = {
 EVT: ["Event Ingestion", "⚡", "listener · staging · collapse · pull · micro-batch registry · quarantine"],
 IE: ["Ingress / Egress", "📥", "Landing+Transport · Sensors · Outbound Producers · Apigee · Gateway"],
 PROC: ["Processing", "🧪", "Python Ingestion · SWP_RAW · STG (view) · INT · DIM · FACT · Corrections"],
 ORCH: ["Orchestration", "🛠", "DAG fan-out · dim-before-fact · intraday · replay · partial-batch"],
 DQ: ["Data Quality", "🛡", "G1 structural · G2 profiling · G3 dbt tests · G4 tie-out · G5 recon · DQ framework"],
 FND: ["Foundation", "⚙", "errors/quarantine · recon · audit/lineage · security · metadata · observability · SSO"],
 PLAT: ["OpenShift Platform", "🖧", "zone 4 — runtime · deployment · operations"],
 EXT: ["SEI-owned (external)", "🏦", "zone 1 — source + PS-orchestration · contracts only"],
 CONS: ["Final Gold consumers", "🏆", "PBDW · IMDS · Pivotal — consumption layer"],
}
const STATUSES = ["Not Started", "In Design", "In Review", "Approved", "In Build", "Complete"];
const STPCT = { "Not Started": 0, "In Design": 20, "In Review": 45, Approved: 60,
 "In Build": 80, Complete: 100 };
const STCOL = { "Not Started": "#9aa7b2", "In Design": "#0b5e83", "In Review": "#6d3ac0",
 Approved: "#a8560f", "In Build": "#e0a13d", Complete: "#159943" };
const Z_C = { "1. SEI": "#6d3ac0", "2. Hub": "#0f4775",
 "3. Consumers": "#0b7d7d", "4. OpenShift": "#b5651d" };
const LANE = { batch: "#159943", rt: "#0e8f7e", out: "#a8560f", move: "#159943",
 ctl: "#8a97a3", fut: "#cc3344", gate: "#6d3ac0" };

const loadStore = () => {
 try { return JSON.parse(localStorage.getItem("cp360-hub-status") || "{}"); }
 catch (e) { return {}; }
};
const API = "/design/status";

export default function HubDesign({ t }) {
 const [view, setView] = useState("L1");
 const [cont, setCont] = useState(null);
 const [doc, setDoc] = useState(null);          // {key, from}
 const [store, setStoreState] = useState(loadStore);
 const [dc, setDc] = useState("");
 const [dq, setDq] = useState("");
 const [flat, setFlat] = useState(false);
 const [evtOpen, setEvtOpen] = useState(false);  // L2 event group
 const [seiStage, setSeiStage] = useState(null);   // C4 L3: which band
 const [seiComp, setSeiComp] = useState(null);     // C4 L4: which component
 const [grp, setGrp] = useState(null);             // C4 L3: which container       // "all components" flat tracker
 const [chan, setChan] = useState(null);           // C4 L1: which boundary channel
 const [s2dom, setS2dom] = useState(null);         // Stage 2 model: which domain
 const [s2tbl, setS2tbl] = useState(null);         // Stage 2 model: which table
 const [dbPick, setDbPick] = useState(null);       // database model: which table
 const [s2p, setS2p] = useState("domains");        // Stage 2: which perspective
 const [s2erd, setS2erd] = useState(true);         // Stage 2 domain: ERD or list
 const [expand, setExpand] = useState(null);    // L3 component detail panel
 const [srcOf, setSrcOf] = useState(null);      // component shown beside its SEI source
 const [seiDoc, setSeiDoc] = useState(null);    // {doc, section} open in the popup
 const openDoc = (doc, section) => setSeiDoc({ doc, section });
 const Popup = () => seiDoc ? (
  <SeiDocModal t={t} docId={seiDoc.doc} sectionId={seiDoc.section}
   onClose={() => setSeiDoc(null)} />) : null;

 const [live, setLive] = useState(false);   // true = Oracle-backed (shared)
 useEffect(() => {
  fetch(API).then((r) => (r.ok ? r.json() : Promise.reject()))
   .then((rows) => {
    const m = {};
    rows.forEach((r) => { m[r.component_id] = { status: r.status, pct: r.pct }; });
    setStoreState(m); setLive(true);
   })
   .catch(() => setLive(false));   // API down -> keep localStorage cache, DEMO mode
 }, []);
 const setStore = (next, changedId) => {
  setStoreState(next);
  try { localStorage.setItem("cp360-hub-status", JSON.stringify(next)); } catch (e) {}
  if (live && changedId && next[changedId])
   fetch(`${API}/${changedId}`, { method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next[changedId]) }).catch(() => setLive(false));
 };
 const stOf = (c) => {
  const o = store[c.id] || {};
  const status = o.status || (STATUSES.includes(c.status) ? c.status : "Not Started");
  return { status, pct: "pct" in o ? o.pct : STPCT[status] ?? 0, edited: !!store[c.id] };
 };
 const overall = (k) => {
  let tt = 0, n = 0, done = 0;
  COMPS.forEach((c) => { if (k && c.container !== k) return;
   const sx = stOf(c); tt += sx.pct; n++; if (sx.status === "Complete") done++; });
  return { avg: n ? Math.round(tt / n) : 0, n, done };
 };
 const cnt = (k) => COMPS.filter((c) => c.container === k).length;
 const chip = (bg, fg, txt) => (
  <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
   background: bg, color: fg, whiteSpace: "nowrap" }}>{txt}</span>);

 const exportCsv = () => {
  const lines = ["id,component,container,status,pct"];
  COMPS.forEach((c) => { const sx = stOf(c);
   lines.push([c.id, `"${c.component.replace(/"/g, '""')}"`, c.container,
    `"${sx.status}"`, sx.pct].join(",")); });
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
  a.download = "hub-component-status.csv";
  document.body.appendChild(a); a.click(); a.remove();
 };

 /* ---------- SVG builders (the mockup's, in JSX) ---------- */
 const Rel = ({ x1, y1, x2, y2, label, kind = "batch", thick }) => {
  const col = LANE[kind]; const anim = kind !== "ctl" && kind !== "fut" && kind !== "gate";
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lw = label.length * 4.6 + 10;
  return (
   <g>
    <path className={anim ? (kind === "rt" ? "hub-flow hub-fast" : "hub-flow") : "hub-still"}
     d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
     stroke={col} strokeWidth={thick ? 2.6 : anim ? 1.8 : 1.3} markerEnd="url(#hubarr)" />
    {label && <rect x={mx - lw / 2} y={my - 9} width={lw} height={14} fill="#fff"
     opacity=".92" rx="3" />}
    {label && <text x={mx} y={my + 2} fontSize="8.5" fill={col} fontStyle="italic"
     textAnchor="middle">{label}</text>}
   </g>);
 };
 const Ortho = ({ pts, label, kind = "batch", thick, lx, ly }) => {
  const col = LANE[kind] || "#555";
  const anim = kind !== "ctl" && kind !== "fut" && kind !== "gate";
  const cls = anim ? (kind === "rt" ? "hub-flow hub-fast" : "hub-flow") : "hub-still";
  const d = "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");
  const lw = (label || "").length * 4.6 + 10;
  return (
   <g>
    <path className={cls} d={d} fill="none" stroke={col}
     strokeWidth={thick ? 2.4 : anim ? 1.8 : 1.3} markerEnd="url(#hubarr)" />
    {label && <rect x={lx - lw / 2} y={ly - 9} width={lw} height={14} fill="#fff"
     opacity=".95" rx="3" />}
    {label && <text x={lx} y={ly + 2} fontSize="8.5" fill={col} fontStyle="italic"
     textAnchor="middle">{label}</text>}
   </g>);
 };
 const Sys = ({ x, y, w, label, sub, kind = "in", onClick }) => {
  const fill = kind === "in" ? "#1168bd" : kind === "ext" ? "#999" : "#fff";
  const lines = sub.split("|");
  return (
   <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    <rect x={x} y={y} width={w} height={40 + lines.length * 11} rx="6" fill={fill}
     stroke={kind === "fut" ? "#cc3344" : "none"}
     strokeDasharray={kind === "fut" ? "6 4" : undefined} strokeWidth="1.6" />
    <text x={x + w / 2} y={y + 28} fontSize="11" fontWeight="700"
     fill={kind === "fut" ? "#cc3344" : "#fff"} textAnchor="middle">{label}</text>
    {lines.map((l, i) => (
     <text key={i} x={x + w / 2} y={y + 40 + i * 11} fontSize="8"
      fill={kind === "fut" ? "#c66" : kind === "ext" ? "#e8e8e8" : "#bcd6ef"}
      textAnchor="middle">{l}</text>))}
   </g>);
 };
 const Fld = ({ k, v, tone }) => (
  <div style={{ marginTop: 9 }}>
   <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4,
    color: tone || t.sub || "#666" }}>{k.toUpperCase()}</div>
   <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6, marginTop: 2,
    maxWidth: 940 }}>{v}</div>
  </div>);
 // C4 breadcrumb. The drill-down is only useful if the way back up is
 // obvious at every level — a reader who has to use the browser's back
 // button has lost the hierarchy the diagram is for.
 const Crumb = ({ trail }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
   marginBottom: 12, fontSize: 11 }}>
   {trail.map(([label, go], i) => (
    <span key={label + i} style={{ display: "inline-flex", alignItems: "center",
     gap: 7 }}>
     {i > 0 && <span style={{ color: "#9aa7b2" }}>›</span>}
     <span onClick={go || undefined}
      style={{ fontWeight: go ? 700 : 800, cursor: go ? "pointer" : "default",
       padding: "5px 12px", borderRadius: 999,
       background: go ? "#eef3f8" : (t.navy || "#10193b"),
       color: go ? (t.accent || "#0f4775") : "#fff" }}>{label}</span>
    </span>))}
  </div>);
 const Defs = () => (
  <defs><marker id="hubarr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8"
   markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#555" /></marker>
   <style>{`@keyframes hubdash{to{stroke-dashoffset:-13}}
    .hub-flow{stroke-dasharray:7 6;animation:hubdash 1.2s linear infinite}
    .hub-fast{animation-duration:.8s}
    .hub-still{stroke-dasharray:5 6}`}</style></defs>);

 /* ---------- component beside its SEI source ---------- */
 if (srcOf) {
  const c = COMPS.find((x) => x.id === srcOf);
  if (c) return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <Popup />
    <SourceReference t={t} comp={c} finding={FIND[c.id]} coverage={covOf(c)}
     onOpenDoc={openDoc}
     onBack={
      <span onClick={() => setSrcOf(null)} style={{ fontSize: 11.5, fontWeight: 700,
       padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
       color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
       ← {CONTAINERS[cont] ? CONTAINERS[cont][0] : "components"}</span>} />
   </div>);
 }

 /* ---------- L4 ---------- */
 if (doc)
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <DocDrill t={t} docKey={doc.key} from={doc.from} onBack={() => setDoc(null)} />
   </div>);

 /* ---------- flat "all components" ---------- */
 if (flat)
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => setFlat(false)} style={{ fontSize: 11.5, fontWeight: 700,
     padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
     color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 10 }}>
     ← C4 view</span>
    <SeiDesignPack t={t} />
   </div>);

 /* ---------- L3 ---------- */
 if (view === "L3" && cont) {
  const C = CONTAINERS[cont];
  const rows = COMPS.filter((c) => c.container === cont);
  const ov = overall(cont);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => setView("L2")} style={{ fontSize: 11.5, fontWeight: 700,
     padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
     color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
     ← containers</span>
    <div style={{ display: "flex", alignItems: "center", gap: 12,
     background: t.navy || "#10193b", color: "#fff", borderRadius: 10,
     padding: "14px 20px", marginBottom: 12 }}>
     <span style={{ fontSize: 26 }}>{C[1]}</span>
     <div><b>{C[0]}</b>
      {cont === "IE" && chip("#fae5d3", "#a8560f", "⚠ gated on AD-11")}
      <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>{C[2]}</div></div>
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#a9c1de" }}><b style={{ display: "block", fontSize: 20,
      color: "#fff" }}>{ov.avg}%</b>complete</div>
     <div style={{ textAlign: "center", fontSize: 10, color: "#a9c1de" }}>
      <b style={{ display: "block", fontSize: 20, color: "#fff" }}>{rows.length}</b>
      components</div>
     {newIn(cont) > 0 && (
      <div style={{ textAlign: "center", fontSize: 10, color: "#f0b7bd" }}>
       <b style={{ display: "block", fontSize: 20, color: "#ff9ba4" }}>{newIn(cont)}</b>
       missing</div>)}
     {findIn(cont) > 0 && (
      <div style={{ textAlign: "center", fontSize: 10, color: "#f3d3a8" }}>
       <b style={{ display: "block", fontSize: 20, color: "#ffc477" }}>{findIn(cont)}</b>
       affected</div>)}
     {cont === "FND" && (
      <span onClick={() => { setView("FNDMODEL"); setExpand(null); }}
       style={{ fontSize: 10.5, fontWeight: 700, padding: "7px 14px", borderRadius: 999,
        background: "#fdf1f2", color: "#cc3344", cursor: "pointer",
        whiteSpace: "nowrap" }}>▤ framework data model · 11 missing</span>)}
    </div>
    {(() => {
      const cvs = rows.map(covOf).filter(Boolean);
      if (!cvs.length) return null;
      const n = (k) => cvs.filter((x) => x.sei === k).length;
      const pr = AR_PLANE_REC[cont];
      return (
       <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
         fontSize: 10.5, color: t.sub || "#666" }}>
         <b style={{ fontSize: 11, color: t.navy || "#10193b" }}>
          Against the SEI design pack</b>
         {Object.entries(AR_SEI_COVER).map(([k, [col, label]]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
           <span style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
           <b style={{ color: col }}>{n(k)}</b> {label}</span>))}
         {asksIn(cont) > 0 && (
          <span style={{ marginLeft: "auto" }}>{chip("#6d3ac01f", "#6d3ac0",
           `${asksIn(cont)} QUESTIONS TO PUT TO THEM`)}</span>)}
        </div>
        {pr && (
         <div style={{ marginTop: 11, borderTop: "1px solid #eef1f4", paddingTop: 10 }}>
          <div style={{ display: "grid",
           gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
           <div><div style={{ fontSize: 8.5, fontWeight: 800, color: "#159943",
            letterSpacing: .4 }}>WHAT THE PACK HAS</div>
            <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
             marginTop: 3 }}>{pr.has}</div></div>
           <div><div style={{ fontSize: 8.5, fontWeight: 800, color: "#cc3344",
            letterSpacing: .4 }}>WHAT IT DOES NOT</div>
            <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
             marginTop: 3 }}>{pr.lacks}</div></div>
          </div>
          <div style={{ marginTop: 10, background: "#f4f8fb", borderRadius: 6,
           borderLeft: "3px solid #0b5e83", padding: "10px 12px" }}>
           <div style={{ fontSize: 8.5, fontWeight: 800, color: "#0b5e83",
            letterSpacing: .4 }}>RECOMMENDATION · {pr.verdict.toUpperCase()}</div>
           <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
            marginTop: 3 }}>{pr.rec}</div></div>
         </div>)}
       </div>);
    })()}
    {(() => {
      const tds = rows.map(dbtDocFor).filter(Boolean);
      const miss = DBTDOC_MISSING[cont] || [];
      if (!tds.length && !miss.length) return null;
      const order = ["conflict", "split", "absent", "elsewhere", "same"];
      return (
       <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap",
         alignItems: "center", fontSize: 10.5, color: t.sub || "#666" }}>
         <b style={{ fontSize: 11, color: "#0f4775" }}>Against the dbt design document</b>
         {order.filter((v) => dbtDocCount(rows, v)).map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center",
           gap: 5 }}>
           <span style={{ width: 8, height: 8, borderRadius: 2,
            background: DBTDOC_VERDICTS[v][0] }} />
           <b style={{ color: DBTDOC_VERDICTS[v][0] }}>{dbtDocCount(rows, v)}</b>
           {DBTDOC_VERDICTS[v][1]}</span>))}
         <span style={{ marginLeft: "auto", fontSize: 9.5 }}>
          SEI wrote the design document — a conflict is a position to settle with
          them, not an internal tidy-up</span>
        </div>
        {miss.map((m) => (
         <div key={m.name} style={{ marginTop: 11, background: "#fdf1f2",
          borderRadius: 6, borderLeft: "3px solid #cc3344", padding: "10px 12px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: "#cc3344",
           letterSpacing: .4 }}>IN THE DESIGN DOCUMENT, NO COMPONENT HERE · {m.ev}</div>
          <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
           marginTop: 3 }}><b>{m.name}</b> — {m.why}</div>
         </div>))}
        {cont === "PROC" && (
         <div style={{ marginTop: 11, background: "#fdf7ea", borderRadius: 6,
          borderLeft: "3px solid #a8560f", padding: "10px 12px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a8560f",
           letterSpacing: .4 }}>AND THE DESIGN DOCUMENT DISAGREES WITH ITSELF · {DBTDOC_SELF_CONFLICT.ev}</div>
          <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
           marginTop: 3 }}><b>{DBTDOC_SELF_CONFLICT.title}</b></div>
          {DBTDOC_SELF_CONFLICT.body.split("\n\n").map((p, i) => (
           <div key={i} style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
            marginTop: 6 }}>{p}</div>))}
         </div>)}
       </div>);
    })()}
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
     overflow: "hidden", background: "#fff" }}>
     {rows.map((c) => {
      const dk = docFor(c), d = DOCS[dk], sx = stOf(c);
      const lab = d.chip || (d.default ? "Arch" : d.id === "l2-planes" ? "Planes"
       : d.id === "l3-stages" ? "Stage 1/2" : d.id === "l3-errors" ? "Errors" : d.title);
      const f = FIND[c.id];
      const cv = covOf(c);
      const nCite = citationsFor(c).length;
      const td = dbtDocFor(c);
      const hasPanel = c.isNew || !!f || !!cv;
      const vc = c.isNew ? "#cc3344" : f ? (AR_VERDICTS[f.verdict] || ["#5c7c94"])[0] : null;
      const vt = c.isNew ? "NEW · MISSING" : f ? f.verdict.toUpperCase() : null;
      const isX = expand === c.id;
      return (
       <div key={c.id} style={{ borderTop: "1px solid #eef1f4",
        background: isX ? "#fafcfe" : undefined }}>
        <div style={{ display: "grid",
         gridTemplateColumns: "34px minmax(0,1.05fr) minmax(0,1.25fr) 104px 90px 196px",
         gap: 10, padding: "8px 14px", fontSize: 11, alignItems: "center",
         cursor: hasPanel ? "pointer" : "default" }}
         onClick={hasPanel ? () => setExpand(isX ? null : c.id) : undefined}>
         <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
          fontWeight: 700, color: c.isNew ? "#cc3344" : Z_C[c.zone] || "#888",
          display: "flex", alignItems: "center", gap: 5 }}>
          {cv && <span title={`SEI pack: ${AR_SEI_COVER[cv.sei][1]}`}
           style={{ width: 7, height: 7, borderRadius: 2, flex: "0 0 auto",
            background: AR_SEI_COVER[cv.sei][0] }} />}
          {hasPanel ? (isX ? "−" : "+") : ""}{c.id}</span>
         <b style={{ color: t.navy || "#10193b", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.component}>
          {c.component}</b>
         <span style={{ fontSize: 10, color: t.sub || "#666", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.deliverable}>
          {c.deliverable}</span>
         <span>{vt ? chip(vc + "1f", vc, vt) : null}</span>
         <span>{chip((STCOL[sx.status] || "#eef1f4") + "22",
          STCOL[sx.status] || "#8a97a3", `${sx.status.toUpperCase()} · ${sx.pct}%`)}</span>
         <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {td && (
           <span title={`dbt design document: ${DBTDOC_VERDICTS[td.v][1]} — ${td.name}`}
            style={{ fontSize: 9, fontWeight: 800, padding: "3px 7px",
             borderRadius: 999, background: DBTDOC_VERDICTS[td.v][0] + "1f",
             color: DBTDOC_VERDICTS[td.v][0], border: `1px solid ${DBTDOC_VERDICTS[td.v][0]}55`,
             whiteSpace: "nowrap", flex: "0 0 auto" }}>dbt</span>)}
          {nCite > 0 && (
           <span onClick={(e) => { e.stopPropagation(); setSrcOf(c.id); }}
            title={`${nCite} SEI citation${nCite === 1 ? "" : "s"} — read side by side`}
            style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
             background: "#f3eefb", color: "#6d3ac0", border: "1px solid #d9c9f0",
             cursor: "pointer", whiteSpace: "nowrap" }}>
            ◧ SEI · {nCite}</span>)}
          <span onClick={(e) => { e.stopPropagation(); setDoc({ key: dk, from: c }); }}
           style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
            background: d.bg, color: d.color, border: `1px solid ${d.color}`,
            cursor: "pointer", textAlign: "center", whiteSpace: "nowrap" }}>
           {d.icon} {lab} →</span>
         </span>
        </div>
        {isX && (
         <div style={{ padding: "2px 14px 14px 48px", borderTop: "1px dashed #e3eaf0" }}>
          {c.isNew && <>
           <Fld k="deliverable" v={c.deliverable} />
           <Fld k="performance" v={c.perf} tone="#a8560f" />
           <Fld k="error handling" v={c.err} tone="#cc3344" />
           <Fld k="why it is missing" v={c.questions} />
           <Fld k="build" v={`${c.technology} · custom build ${c.custom} · ${c.priority}`} />
          </>}
          {f && <>
           <Fld k={`finding · ${f.verdict}`} v={f.finding} tone={vc} />
           <Fld k="action" v={f.action} tone="#159943" />
          </>}
          {cv && <>
           <div style={{ marginTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chip(AR_SEI_COVER[cv.sei][0] + "1f", AR_SEI_COVER[cv.sei][0],
             AR_SEI_COVER[cv.sei][1].toUpperCase())}
            {chip(AR_OWNER[cv.owner][0] + "1f", AR_OWNER[cv.owner][0],
             AR_OWNER[cv.owner][1].toUpperCase())}
           </div>
           {cv.ask && <Fld k={cv.owner === "SEI" ? "ask SEI" : "ask — both sides"}
            v={cv.ask} tone={AR_OWNER[cv.owner][0]} />}
           <Fld k="recommendation" v={cv.rec} tone="#0b5e83" />
          </>}
          {td && <>
           <div style={{ marginTop: 13, paddingTop: 11,
            borderTop: "1px solid #eef1f4" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
             flexWrap: "wrap" }}>
             {chip(DBTDOC_VERDICTS[td.v][0] + "1f", DBTDOC_VERDICTS[td.v][0],
              DBTDOC_VERDICTS[td.v][1].toUpperCase())}
             <b style={{ fontSize: 11, color: "#0f4775" }}>{td.name}</b>
             <span style={{ fontSize: 9.5, color: t.sub || "#666" }}>
              {DBTDOC_NAME} · {DBTDOC_SOURCE} · {td.ev}</span>
            </div>
           </div>
           <Fld k="what this is" v={td.what} />
           <Fld k="against the dbt design document"
            v={td.note.split("\n\n").map((p, i) => (
             <div key={i} style={{ marginTop: i ? 7 : 0 }}>{p}</div>))}
            tone={DBTDOC_VERDICTS[td.v][0]} />
          </>}
         </div>)}
       </div>);
     })}
    </div>
   </div>);
 }


 /* ---------- L2 — the architecture, rebuilt on SEI's documents -----
    Replaces a diagram that mixed three sources without saying so: the
    delivery workbook, this programme's events review, and SEI's two
    design documents. A reader could not tell which boxes SEI will
    build, which was the whole problem.
    Now: SOLID boxes are SEI's design, cited. DASHED boxes are BBH's
    and say so on the drawing. Everything with no box at all is in the
    component registry, one click away, with a verdict on each.
    The event components are kept, collapsed, and expand on click —
    they are a proposal, not a commitment, and they used to dominate
    the picture. */
 if (view === "SEIFLOW") {
  const evt = COMPS.filter((c) => c.container === "EVT");
  const H = evtOpen ? 1180 : 880;
  const T = (x, y, s, o) => (
   <text x={x} y={y} fontSize={(o && o.fs) || 8.5}
    fontWeight={(o && o.fw) || 400} fill={(o && o.fill) || "#5c7c94"}
    textAnchor={(o && o.anchor) || "start"}
    fontStyle={(o && o.italic) ? "italic" : "normal"}>{s}</text>);
  const Box = ({ x, y, w, h, id, label, sub, bbh, onClick }) => (
   <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    <rect x={x} y={y} width={w} height={h || 38} rx="5"
     fill={bbh ? "#fff" : "#1168bd"} stroke={bbh ? "#a8560f" : "none"}
     strokeDasharray={bbh ? "5 3" : undefined} strokeWidth={bbh ? 1.4 : 0} />
    {id && T(x + 8, y + 15, id, { fs: 7.5, fw: 800,
      fill: bbh ? "#a8560f" : "#9ec6ee" })}
    {T(x + (id ? 34 : 10), y + 15, label,
      { fs: 9, fw: 700, fill: bbh ? "#a8560f" : "#fff" })}
    {sub && T(x + (id ? 34 : 10), y + 28, sub,
      { fs: 7.5, fill: bbh ? "#b9875a" : "#bcd6f0" })}
   </g>);
  const Band = ({ x, y, w, h, label, note, bbh, stage }) => (
   <g onClick={stage ? () => { setSeiStage(stage); setView("SEIL3"); } : undefined}
    style={stage ? { cursor: "pointer" } : undefined}>
    <rect x={x} y={y} width={w} height={h} rx="8" fill={bbh ? "#fdf7ea" : "#f4f8fb"}
     stroke={bbh ? "#dfa96a" : "#7fa8c9"} strokeDasharray="5 4" strokeWidth="1.2" />
    {T(x + 12, y + 17, label, { fs: 9.5, fw: 800,
      fill: bbh ? "#a8560f" : "#0f4775" })}
    {note && T(x + w - 12, y + 17, note, { fs: 8, anchor: "end", italic: true,
      fill: bbh ? "#b9875a" : "#5c7c94" })}
    {stage && T(x + w - 12, y + h - 8, "▸ open container", { fs: 7.5,
      anchor: "end", fw: 800, fill: "#0f4775" })}
   </g>);
  const Down = (x, y1, y2) => (
   <line x1={x} y1={y1} x2={x} y2={y2} stroke="#5c7c94" strokeWidth="1.3"
    markerEnd="url(#hubarr)" />);
  const comp = (id) => SEI_COMPONENTS.find((c) => c.id === id) || {};
  const SB = ({ id, x, y, w, h, sub }) => {
   const c = comp(id);
   return <Box x={x} y={y} w={w} h={h} id={id} label={c.n}
    sub={sub === undefined ? c.tech : sub}
    onClick={(e) => { if (e) e.stopPropagation();
      setSeiComp(id); setView("SEIL4"); }} />;
  };
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap",
     alignItems: "center" }}>
     <span onClick={() => setView("L2")} style={{ fontSize: 11.5, fontWeight: 700,
      padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
      color: "#fff", cursor: "pointer" }}>← containers</span>
     <span onClick={() => { setView("SEIBASE"); setExpand(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#0f4775",
       color: "#fff" }}>◆ the SEI baseline · cited</span>
     <span onClick={() => { setView("REGISTRY"); setExpand(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#f3eefb",
       color: "#6d3ac0", border: "1px solid #d9c9f0" }}>
      ▦ component registry · {Object.values(REGISTRY).filter((r) => r.st !== "specified").length + evt.length} not in SEI's documents</span>
     <span onClick={() => setEvtOpen(!evtOpen)} style={{ fontSize: 10.5,
      fontWeight: 700, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
      background: "#eef3f8", color: t.accent || "#0f4775" }}>
      {evtOpen ? "▴ collapse" : "▾ expand"} event ingestion · {evt.length}</span>
    </div>

    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 10, padding: 16, overflowX: "auto" }}>
     <svg viewBox={`0 0 1240 ${H}`} style={{ minWidth: 960, display: "block" }}>
      <Defs />
      {T(24, 22, "CP INTEGRATION HUB — the design SEI has specified",
        { fs: 11, fw: 800, fill: "#0f4775" })}
      {T(24, 38, "Solid boxes are SEI's two design documents. Dashed boxes are BBH's and are not in them. Everything else is in the registry.",
        { fs: 8.5, italic: true })}

      {/* delivery, left column */}
      <Band x={24} y={58} w={200} h={246} label="DELIVERY" stage="deliver" />
      <SB id="S1" x={34} y={80} w={180} />
      <SB id="S2" x={34} y={132} w={180} />
      <SB id="S3" x={34} y={184} w={180} />
      <SB id="S4" x={34} y={236} w={180} />

      {/* ingestion */}
      <Band x={248} y={58} w={660} h={130} label="INGESTION" stage="ingest"
       note="Airflow 3.0 on OpenShift · scan every five minutes" />
      <SB id="S5" x={258} y={80} w={320} />
      <SB id="S6" x={588} y={80} w={310} />
      <SB id="S7" x={258} y={132} w={320} />
      <SB id="S8" x={588} y={132} w={310} />

      {/* the gate */}
      <Band x={248} y={200} w={660} h={130} label="COMPLETENESS AND SLA" stage="gate"
       note="the handoff between the two documents" />
      <SB id="S9" x={258} y={222} w={320} />
      <SB id="S10" x={588} y={222} w={310} />
      <SB id="S11" x={258} y={274} w={320} />
      <SB id="S12" x={588} y={274} w={310} />
      {Down(578, 188, 200)}
      {Down(578, 330, 352)}
      {T(590, 346, "the seam: only the run whose UPDATE changes one row may trigger transformation",
        { fs: 8, italic: true, fill: "#a8560f" })}

      {/* silver — one layer, three names */}
      <Band x={248} y={360} w={660} h={196}
       label="SILVER · STAGE 2 · ENRICHED — one layer, three names" stage="xform"
       note="dbt" />
      <SB id="S14" x={258} y={382} w={640}
       sub="a view, held in memory — its job is the source DQ check" />
      <SB id="S15" x={258} y={434} w={206} />
      <SB id="S16" x={474} y={434} w={206} />
      <SB id="S17" x={690} y={434} w={208} />
      {T(258, 500, "INT, DIM and FACT together are the normalised SWP data model,",
        { fs: 8.5, italic: true, fill: "#0f4775" })}
      {T(258, 512, "with reference mapping and translation applied. BBH's reading, not SEI's wording.",
        { fs: 8.5, italic: true })}
      {T(258, 530, "SEI's documents call DIM and FACT the approved Gold tables and stop there — see the registry.",
        { fs: 8, italic: true, fill: "#a8560f" })}

      {/* the run */}
      <Band x={248} y={568} w={660} h={130} label="THE TRANSFORMATION RUN" stage="xform" />
      <SB id="S13" x={258} y={590} w={320} />
      <SB id="S18" x={588} y={590} w={310} />
      <SB id="S19" x={258} y={642} w={320} />
      <SB id="S20" x={588} y={642} w={310} />

      {/* BBH's own layers, dashed */}
      <Band x={248} y={710} w={660} h={96} bbh
       label="BBH — ABOVE WHAT SEI SPECIFIES"
       note="not in either design document" />
      <Box x={258} y={732} w={320} h={38} id="B1" bbh
       label="Pre-Gold · mirror of IMDS and PBDW"
       sub="consumer-shaped, built from the model above" />
      <Box x={588} y={732} w={310} h={38} id="B2" bbh
       label="Movement into the warehouse"
       sub="extract, transport, load, verify — no transformation" />
      {T(258, 790, "SEI's design publishes from DIM and FACT and ends. These two layers are BBH's and nothing cites them.",
        { fs: 8, italic: true, fill: "#a8560f" })}

      {/* Oracle objects */}
      <Band x={932} y={58} w={284} h={420} label="ORACLE"
       note="no FKs declared" />
      {SEI_TABLES.map((tb, i) => (
       <Box key={tb.id} x={942} y={80 + i * 48} w={264} h={38}
        label={tb.n} sub={tb.owner} />))}
      {T(942, 496, "Every line between these is a join a model runs,",
        { fs: 8, italic: true })}
      {T(942, 508, "not a constraint the database enforces.", { fs: 8, italic: true })}

      {/* evidence + consumers */}
      <Band x={932} y={530} w={284} h={82} label="EVIDENCE" stage="evid" />
      <SB id="S21" x={942} y={552} w={264} />
      <Box x={942} y={640} w={264} h={44} bbh
       label="PBDW · IMDS · Pivotal"
       sub="downstream of Gold — outside both documents" />

      {/* events: kept, collapsed, expandable */}
      <g onClick={() => setEvtOpen(!evtOpen)} style={{ cursor: "pointer" }}>
       <rect x={24} y={826} width={1192} height={evtOpen ? 330 : 44} rx="8"
        fill="#fdf1f2" stroke="#e0a9b0" strokeDasharray="5 4" strokeWidth="1.2" />
       {T(38, 845, `${evtOpen ? "▾" : "▸"}  EVENT INGESTION — ${evt.length} components, proposed by this programme's review`,
         { fs: 9.5, fw: 800, fill: "#cc3344" })}
       {T(1202, 845, evtOpen ? "click to collapse" : "click to expand",
         { fs: 8, anchor: "end", italic: true, fill: "#cc3344" })}
      </g>
      {evtOpen && (
       <g>
        {T(38, 866, "Not in SEI's documents and not in the delivery workbook. Kept here because the events-primary question is still open, and drawn apart because it is a proposal.",
          { fs: 8, italic: true, fill: "#b4707a" })}
        {evt.map((c, i) => (
         <Box key={c.id} x={38 + (i % 4) * 295} y={880 + Math.floor(i / 4) * 48}
          w={285} h={38} id={String(c.id)} label={c.component} bbh
          onClick={(e) => { e.stopPropagation();
            setCont("EVT"); setExpand(c.id); setView("L3"); }} />))}
       </g>)}
     </svg>
    </div>

    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10,
     fontSize: 10, color: t.sub || "#666", alignItems: "center" }}>
     <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 16, height: 10, borderRadius: 2,
       background: "#1168bd" }} /> specified by SEI, cited on the baseline</span>
     <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 16, height: 10, borderRadius: 2, background: "#fff",
       border: "1.4px dashed #a8560f" }} /> BBH's, not in either document</span>
     <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 16, height: 10, borderRadius: 2, background: "#fdf1f2",
       border: "1.4px dashed #e0a9b0" }} /> proposed by this review</span>
    </div>
   </div>);
 }

 /* ---------- L2 — the containers, one picture of the whole flow ---
    The level that was missing. Everything under it was already right:
    the records are cited, the registry has a verdict on the rest. What
    there was nowhere to see was the SHAPE, once, in the words the
    programme uses rather than the words SEI's documents use.
    Click any container and it opens with its components. */
 /* ---------- CTX: the boundary, above the containers ---------- */
 if (view === "CTX") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["the boundary", null]]} />
   <ContextView t={t} chan={chan} setChan={setChan} />
  </div>);

 /* ---------- GATE: three kinds of event, and what opens the day ------ */
 if (view === "GATE") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["Orchestration", () => { setGrp("orchestration"); setView("GRP"); }],
                  ["events and the gate", null]]} />
   <GateView t={t} onFile={() => setView("FILE")} />
  </div>);

 /* ---------- LOOP: the outbound round trip ---------- */
 if (view === "LOOP") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["Ingress and Egress", () => { setGrp("ingress"); setView("GRP"); }],
                  ["the loader loop", null]]} />
   <LoaderLoopView t={t} />
  </div>);

 /* ---------- FILE: the file path, end to end ---------- */
 if (view === "FILE") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["Ingestion", () => { setGrp("ingestion"); setView("GRP"); }],
                  ["file-based ingestion", null]]} />
   <FileIngestionView t={t}
    onComp={(id) => { setSeiComp(id); setView("SEIL4"); }} />
  </div>);

 /* ---------- DBM: the database, as one picture, in the flow ---------- */
 if (view === "DBM") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["Processing", () => { setGrp("processing"); setView("GRP"); }],
                  ["the database model", null]]} />
   <DbModelView t={t} pick={dbPick} setPick={setDbPick}
    onOpen={(k) => { setDbPick(null);
      if (k === "s1") setView("S1M");
      else { setS2dom(null); setS2tbl(null); setView("S2M"); } }} />
  </div>);

 /* ---------- S1M: Stage 1, the RAW data model ---------- */
 if (view === "S1M") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
                  ["Processing", () => { setGrp("processing"); setView("GRP"); }],
                  ["the database model", () => setView("DBM")],
                  ["Stage 1 data model", null]]} />
   <Stage1Model t={t} />
  </div>);

 /* ---------- S2M: Stage 2 INT, the canonical model ---------- */
 if (view === "S2M") return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <Popup />
   <Crumb trail={[["containers", () => setView("L2")],
    ["Processing", () => { setGrp("processing"); setView("GRP"); }],
    ["the database model", () => setView("DBM")],
    ["Stage 2 / Silver / Enriched", s2dom || s2tbl
      ? () => { setS2dom(null); setS2tbl(null); } : null],
    ...(s2dom && !s2tbl ? [[s2DomainName(s2dom), null]] : []),
    ...(s2tbl ? [[s2DomainName(s2dom || ""), () => setS2tbl(null)],
                 [s2tbl, null]] : [])]} />
   <Stage2Model t={t} dom={s2dom} tbl={s2tbl}
    persp={s2p} setPersp={(p) => { setS2p(p); setS2dom(null); setS2tbl(null); }}
    erd={s2erd} setErd={setS2erd}
    setDom={(d) => { setS2dom(d); setS2tbl(null); setS2p("domains"); }}
    setTbl={(x) => { setS2tbl(x); if (x && !s2dom) setS2dom(s2DomainOf(x)); }} />
  </div>);

 if (view === "L2") {
  const cnt = (g) => {
   const trk = COMPS.filter((c) => groupOfTracker(c) === g.id);
   return { sei: g.sei.length, bbh: (g.bbh || []).length, trk: trk.length,
     open: g.sei.reduce((n, id) => n
       + (((SEI_COMPONENTS.find((c) => c.id === id) || {}).open || []).length),
       0) };
  };
  const evt = COMPS.filter((c) => groupOfTracker(c) === "events");
  const G = (id) => GROUPS.find((g) => g.id === id);
  const T = (x, y, str, o) => (
   <text x={x} y={y} fontSize={(o && o.fs) || 8.5}
    fontWeight={(o && o.fw) || 400} fill={(o && o.fill) || "#5c7c94"}
    textAnchor={(o && o.anchor) || "start"}
    fontStyle={(o && o.italic) ? "italic" : "normal"}>{str}</text>);
  const Tally = ({ x, y, g }) => {
   const c = cnt(g);
   const bits = [
    c.sei ? [`${c.sei} specified by SEI`, "#1168bd"] : null,
    c.bbh ? [`${c.bbh} BBH`, "#a8560f"] : null,
    [`${c.trk} tracked`, "#5c7c94"],
    c.open ? [`${c.open} open with SEI`, "#6d3ac0"] : null,
   ].filter(Boolean);
   let dx = 0;
   return (<g>{bits.map(([label, col], i) => {
    const w = label.length * 4.7 + 14;
    const el = (
     <g key={label}>
      <rect x={x + dx} y={y} width={w} height={15} rx="7.5" fill={col + "22"} />
      {T(x + dx + 7, y + 11, label, { fs: 7.5, fw: 800, fill: col })}
     </g>);
    dx += w + 6;
    return el;
   })}</g>);
  };
  // A lane is the named part inside a container — "landing and
  // transport", "the API gateway", "file-based". Drawn on the
  // container itself so the top level answers what is in there, not
  // just how much.
  const Lane = ({ l, x, y, w, h }) => (
   <g onClick={(e) => { e.stopPropagation(); setGrp(l.gid); setView("GRP"); }}
    style={{ cursor: "pointer" }}>
    <rect x={x} y={y} width={w} height={h} rx="6"
     fill={l.proposal ? "#fdf1f2" : "#eef3f8"}
     stroke={l.proposal ? "#e0a9b0" : "#c3d4e4"}
     strokeDasharray={l.proposal ? "4 3" : undefined} strokeWidth="1" />
    {T(x + 9, y + 15, l.n, { fs: 8.5, fw: 800,
      fill: l.proposal ? "#cc3344" : "#0f4775" })}
    {T(x + 9, y + 27, l.tech, { fs: 7.5,
      fill: l.proposal ? "#b4707a" : "#5c7c94" })}
    {conflictsAt(l.id).length > 0 && (
     <g onClick={(e) => { e.stopPropagation(); setView("ARCH"); }}>
      <rect x={x + w - 32} y={y + 5} width={26} height={13} rx="6.5"
       fill="#cc3344" />
      {T(x + w - 19, y + 14.5, `⚠${conflictsAt(l.id).length}`,
        { fs: 7.5, fw: 800, anchor: "middle", fill: "#fff" })}
     </g>)}
   </g>);
  const LaneRow = ({ id, x, y, w }) => {
   const ls = lanesOf(id);
   if (!ls.length) return null;
   const gap = 8;
   const lw = (w - gap * (ls.length - 1)) / ls.length;
   return (<g>{ls.map((l, i) => (
    <Lane key={l.id} l={{ ...l, gid: id }} x={x + i * (lw + gap)} y={y}
     w={lw} h={34} />))}</g>);
  };
  const Group = ({ id, x, y, w, h }) => {
   const g = G(id);
   const stack = w < 400;              // the right-hand column is narrow
   const ls = lanesOf(id);
   return (
    <g onClick={() => { setGrp(id); setView("GRP"); }} style={{ cursor: "pointer" }}>
     <rect x={x} y={y} width={w} height={h} rx="10" fill="#fff"
      stroke="#7fa8c9" strokeWidth="1.4" />
     <rect x={x} y={y} width={w} height={30} rx="10" fill="#0f4775" />
     <rect x={x} y={y + 20} width={w} height={10} fill="#0f4775" />
     {T(x + 14, y + 20, `${g.icon}  ${g.n.toUpperCase()}`,
       { fs: 10, fw: 800, fill: "#fff" })}
     {T(x + w - 14, y + 20, "▸ open", { fs: 8, fw: 800, anchor: "end",
       fill: "#9ec6ee" })}
     {T(x + 14, y + 46, g.sub, { fs: 8.5, italic: true })}
     <Tally x={x + 14} y={y + 54} g={g} />
     {stack
       ? ls.map((l, i) => (
          <Lane key={l.id} l={{ ...l, gid: id }} x={x + 14} y={y + 78 + i * 38}
           w={w - 28} h={34} />))
       : <LaneRow id={id} x={x + 14} y={y + 78} w={w - 28} />}
    </g>);
  };
  const Stage = ({ st, x, y, w }) => (
   <g onClick={(e) => { e.stopPropagation(); setGrp("processing"); setView("GRP"); }}
    style={{ cursor: "pointer" }}>
    <rect x={x} y={y} width={w} height={62} rx="7"
     fill={st.bbh.length ? "#fff" : "#1168bd"}
     stroke={st.bbh.length ? "#a8560f" : "none"}
     strokeDasharray={st.bbh.length ? "5 3" : undefined}
     strokeWidth={st.bbh.length ? 1.4 : 0} />
    {T(x + 10, y + 18, st.n, { fs: 10, fw: 800,
      fill: st.bbh.length ? "#a8560f" : "#fff" })}
    {T(x + 10, y + 32, st.sub, { fs: 8,
      fill: st.bbh.length ? "#b9875a" : "#bcd6f0" })}
    {T(x + 10, y + 50, [...st.sei, ...st.tbl, ...st.bbh].join(" · "),
      { fs: 7.5, fw: 800, fill: st.bbh.length ? "#c79a62" : "#9ec6ee" })}
    {conflictsAt(st.id).length > 0 && (
     <g onClick={(e) => { e.stopPropagation(); setView("ARCH"); }}>
      <rect x={x + w - 34} y={y + 6} width={28} height={14} rx="7"
       fill="#cc3344" />
      {T(x + w - 20, y + 16, `⚠${conflictsAt(st.id).length}`,
        { fs: 8, fw: 800, anchor: "middle", fill: "#fff" })}
     </g>)}
   </g>);
  const Arrow = (x1, y1, x2, y2) => (
   <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c7c94" strokeWidth="1.6"
    markerEnd="url(#hubarr)" />);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
     <span onClick={() => setView("L1")} style={{ fontSize: 11.5, fontWeight: 700,
      padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
      color: "#fff", cursor: "pointer" }}>← context + dashboard</span>
     <span onClick={() => { setView("CTX"); setChan(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#0f4775",
       color: "#fff" }}>
      ⇆ the boundary · 3 transports, 4 channels</span>
     <span onClick={() => setView("SEIFLOW")} style={{ fontSize: 10.5,
      fontWeight: 800, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
      background: "#eef3f8", color: "#0f4775" }}>
      ◆ the SEI pipeline, box by box</span>
     <span onClick={() => { setView("SEIBASE"); setExpand(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#eef3f8",
       color: "#0f4775" }}>▤ the baseline, cited</span>
     <span onClick={() => { setView("REGISTRY"); setExpand(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#f3eefb",
       color: "#6d3ac0", border: "1px solid #d9c9f0" }}>
      ▦ component registry</span>
     <span onClick={() => setView("ARCH")} style={{ fontSize: 10.5,
      fontWeight: 800, padding: "6px 14px", borderRadius: 999,
      cursor: "pointer", background: "#fdf1f2", color: "#cc3344",
      border: "1px solid #f0c9ce" }}>
      ⚠ architecture v5 · {ARCH_CONFLICTS.length} conflicts with the design documents</span>
    </div>
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 10, padding: 16, overflowX: "auto" }}>
     <svg viewBox="0 0 1240 940" style={{ minWidth: 960, display: "block" }}>
      <Defs />
      {T(24, 22, "CP INTEGRATION HUB — the whole flow",
        { fs: 11, fw: 800, fill: "#0f4775" })}
      {T(24, 38, "Six containers. Open any one for its components, then a component for its record and the document behind it.",
        { fs: 8.5, italic: true })}

      {/* context strip */}
      <rect x={24} y={56} width={240} height={40} rx="6" fill="#eef3f8"
       stroke="#c3d4e4" />
      {T(38, 74, "SEI · SWP", { fs: 9.5, fw: 800, fill: "#5c7c94" })}
      {T(38, 88, "files on SFTP, and the APIs", { fs: 7.5 })}
      {Arrow(264, 76, 296, 76)}
      <rect x={300} y={56} width={600} height={40} rx="6" fill="#0f4775" />
      {T(316, 80, "CP INTEGRATION HUB", { fs: 11, fw: 800, fill: "#fff" })}
      {T(884, 80, "zone 2", { fs: 8, anchor: "end", fill: "#9ec6ee" })}
      {Arrow(900, 76, 932, 76)}
      <rect x={936} y={56} width={280} height={40} rx="6" fill="#fff"
       stroke="#a8560f" strokeDasharray="5 3" strokeWidth="1.4" />
      {T(950, 74, "PBDW · IMDS · Pivotal",
        { fs: 9.5, fw: 800, fill: "#a8560f" })}
      {T(950, 88, "the warehouses, downstream of Stage 3",
        { fs: 7.5, fill: "#b9875a" })}

      {/* the chain down the left */}
      <Group id="ingress" x={24} y={120} w={876} h={124} />
      {Arrow(462, 244, 462, 266)}
      <Group id="ingestion" x={24} y={270} w={876} h={124} />
      {Arrow(462, 394, 462, 416)}
      <Group id="orchestration" x={24} y={420} w={876} h={124} />
      {Arrow(462, 544, 462, 566)}

      {/* processing, with the stage chain drawn inside it */}
      <g onClick={() => { setGrp("processing"); setView("GRP"); }}
       style={{ cursor: "pointer" }}>
       <rect x={24} y={570} width={876} height={232} rx="10" fill="#fff"
        stroke="#7fa8c9" strokeWidth="1.4" />
       <rect x={24} y={570} width={876} height={30} rx="10" fill="#0f4775" />
       <rect x={24} y={590} width={876} height={10} fill="#0f4775" />
       {T(38, 590, "⚙  PROCESSING", { fs: 10, fw: 800, fill: "#fff" })}
       {T(886, 590, "▸ open", { fs: 8, fw: 800, anchor: "end",
         fill: "#9ec6ee" })}
       <Tally x={38} y={608} g={G("processing")} />
       <LaneRow id="processing" x={38} y={630} w={848} />
      </g>
      {PROC_STAGES.map((st, i) => (
       <Stage key={st.id} st={st} x={38 + i * 215} y={674} w={201} />))}
      {[0, 1, 2].map((i) => (
       <g key={i}>{Arrow(38 + i * 215 + 201, 705, 38 + (i + 1) * 215 - 3, 705)}</g>))}
      {T(38, 762, "Stage 2 and Stage 2 INT are the one layer also called Silver or Enriched. Stage 3 is BBH's: SEI's documents end at DIM and FACT.",
        { fs: 8, italic: true, fill: "#a8560f" })}
      {T(38, 776, "Reconciliation and DQ capture run across the chain rather than inside one stage — both are in this container.",
        { fs: 8, italic: true })}

      {/* the two that sit beside everything */}
      <Group id="openshift" x={936} y={120} w={280} h={240} />
      <Group id="foundation" x={936} y={388} w={280} h={274} />
      {T(936, 686, "These two are not a step in the flow.", { fs: 8, italic: true })}
      {T(936, 698, "Everything above runs on one and", { fs: 8, italic: true })}
      {T(936, 710, "records itself in the other.", { fs: 8, italic: true })}

      {/* the proposal, kept apart */}
      <g onClick={() => { setGrp("events"); setView("GRP"); }}
       style={{ cursor: "pointer" }}>
       <rect x={24} y={826} width={1192} height={52} rx="10" fill="#fdf1f2"
        stroke="#e0a9b0" strokeDasharray="5 4" strokeWidth="1.3" />
       {T(40, 848, `▸  EVENT INGESTION — ${evt.length} components`,
         { fs: 10, fw: 800, fill: "#cc3344" })}
       {T(40, 864, "Proposed by this programme's review. Not in SEI's documents and not in the delivery workbook — open it to see what it would add.",
         { fs: 8, italic: true, fill: "#b4707a" })}
       {T(1202, 848, "▸ open", { fs: 8, fw: 800, anchor: "end",
         fill: "#cc3344" })}
      </g>
      {T(24, 906, "Solid blue is specified by SEI and cited. Dashed amber is BBH's and is not in either document. Dashed red is this review's proposal.",
        { fs: 8, italic: true })}
     </svg>
    </div>
   </div>);
 }

 /* ---------- The SEI baseline — only what SEI has specified -------
    Deliberately NOT built from TRACKER_COMPONENTS. The tracker is BBH's
    workbook and the design documents under it are BBH-generated; this
    screen is the other thing, the design SEI has actually committed to
    in its two documents. Keeping them apart is the point — a reader has
    to be able to tell which boxes SEI will build. The gap between the
    two is a later exercise, deliberately. */
 if (view === "SEIBASE") {
  const Bar = ({ icon, title, note, n, label, bg }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: bg || (t.navy || "#10193b"), color: "#fff", borderRadius: 10,
    padding: "13px 18px", margin: "16px 0 10px" }}>
    <span style={{ fontSize: 22 }}>{icon}</span>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>{note}</div></div>
    {n !== undefined && (
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#a9c1de" }}><b style={{ display: "block", fontSize: 19,
      color: "#fff" }}>{n}</b>{label}</div>)}
   </div>);
  const Card = ({ children }) => (
   <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>{children}</div>);
  const Cite = ({ v }) => (
   <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 5 }}>{v}</div>);
  const DOCC = { ingest: "#0b5e83", dbt: "#6d3ac0", both: "#a8560f",
   shared: "#a8560f" };
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => setView("L1")} style={{ fontSize: 11.5, fontWeight: 700,
     padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
     color: "#fff", cursor: "pointer", display: "inline-block",
     marginBottom: 12 }}>← context + dashboard</span>

    <div style={{ background: "#0f4775", color: "#fff", borderRadius: 10,
     padding: "16px 20px", marginBottom: 12 }}>
     <b style={{ fontSize: 15 }}>The design SEI has specified</b>
     <div style={{ fontSize: 11.5, color: "#cfe0f2", lineHeight: 1.65,
      marginTop: 6, maxWidth: 940 }}>
      Everything on this page comes from one of SEI's two design documents
      and names the section and page it came from. Nothing is inferred and
      no BBH component names appear. Where SEI has not decided, it shows
      as SEI's own open decision rather than as a guess.
      <br /><br />
      The 65-component tracker and the design documents generated from it
      are BBH's, and they are still there — but they are not this. The
      difference between the two is the gap exercise, and it comes later.
     </div>
    </div>

    <div style={{ display: "grid", gap: 8,
     gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))" }}>
     {Object.values(SEI_DOCS).map((d) => (
      <Card key={d.id}>
       <div style={{ display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap" }}>
        <span style={{ width: 9, height: 9, borderRadius: 2,
         background: DOCC[d.id] }} />
        <b style={{ fontSize: 12, color: t.navy || "#10193b" }}>{d.title}</b>
        {chip("#eef3f8", "#0f4775", `v${d.version}`)}
       </div>
       <div style={{ fontSize: 10, color: t.sub || "#666", marginTop: 4 }}>
        {d.author}{d.date ? ` · ${d.date}` : ""} · {d.stack}</div>
       <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
        marginTop: 7 }}><b>Owns.</b> {d.scope}</div>
       <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
        marginTop: 5 }}><b>Hands over.</b> {d.hands_over}</div>
      </Card>))}
    </div>

    <div style={{ background: "#fdf7ea", borderRadius: 8,
     borderLeft: "3px solid #a8560f", padding: "12px 16px", margin: "4px 0 2px" }}>
     <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a8560f",
      letterSpacing: .4 }}>WHERE ONE DOCUMENT ENDS AND THE OTHER BEGINS</div>
     <div style={{ fontSize: 12, color: "#33414d", lineHeight: 1.65,
      marginTop: 5 }}>The line is <b>{SEI_BOUNDARY.line}</b>. {SEI_BOUNDARY.note}</div>
     <Cite v={SEI_BOUNDARY.ev.join(" · ")} />
    </div>

    {SEI_STAGES.map((st) => {
     const cs = seiCompsIn(st.k);
     if (!cs.length) return null;
     return (
      <div key={st.k}>
       <Bar icon="◆" title={st.n} note={st.d} n={cs.length} label="components" />
       <div style={{ display: "grid", gap: 8 }}>
        {cs.map((c) => (
         <Card key={c.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
           flexWrap: "wrap" }}>
           <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
            fontWeight: 700, color: "#8a97a3" }}>{c.id}</span>
           <b style={{ fontSize: 12, color: t.navy || "#10193b" }}>{c.n}</b>
           {chip("#eef3f8", "#5c7c94", c.tech)}
          </div>
          <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
           marginTop: 5, maxWidth: 940 }}>{c.w}</div>
          <Cite v={c.ev} />
         </Card>))}
       </div>
      </div>);
    })}

    <Bar icon="▤" title="The Oracle objects" n={SEI_TABLES.length}
     label="tables" note="with the columns SEI actually gives" />
    <div style={{ display: "grid", gap: 8 }}>
     {SEI_TABLES.map((tb) => (
      <Card key={tb.id}>
       <div style={{ display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap" }}>
        <span style={{ width: 9, height: 9, borderRadius: 2,
         background: DOCC[tb.doc] || "#8a97a3" }} />
        <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11.5,
         color: t.navy || "#10193b" }}>{tb.n}</b>
        {chip("#eef3f8", "#5c7c94", tb.owner)}
       </div>
       <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
        marginTop: 5, maxWidth: 940 }}>{tb.w}</div>
       <div style={{ fontSize: 10, fontFamily: "Roboto Mono, monospace",
        color: "#5c7c94", lineHeight: 1.6, marginTop: 6, background: "#f6f9fb",
        borderRadius: 5, padding: "7px 10px" }}>{tb.cols}</div>
       <Cite v={tb.ev} />
      </Card>))}
    </div>

    {Object.values(SEI_STATES).map((sm) => (
     <div key={sm.n}>
      <Bar icon="⥁" title={`${sm.n} — the states`} note={sm.ev}
       n={sm.rows.length} label="states" />
      <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderRadius: 8, overflow: "hidden" }}>
       {sm.rows.map(([k, mean, own]) => (
        <div key={k} style={{ display: "grid",
         gridTemplateColumns: "150px minmax(0,1fr) minmax(0,1fr)", gap: 12,
         padding: "10px 14px", fontSize: 11, borderTop: "1px solid #eef1f4" }}>
         <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
          color: "#0f4775" }}>{k}</b>
         <span style={{ color: "#33414d", lineHeight: 1.55 }}>{mean}</span>
         <span style={{ color: t.sub || "#666", lineHeight: 1.55 }}>{own}</span>
        </div>))}
      </div>
     </div>))}

    <Bar icon="✕" title="Stated as deliberately not built" bg="#5c3030"
     note="each one is something a reader will otherwise assume is there"
     n={SEI_NOT_BUILT.length} label="exclusions" />
    <div style={{ display: "grid", gap: 6 }}>
     {SEI_NOT_BUILT.map((x) => (
      <div key={x.t} style={{ background: "#fff", borderRadius: 8,
       border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderLeft: "3px solid #cc3344",
       padding: "9px 14px", fontSize: 11.5, color: "#33414d", lineHeight: 1.6 }}>
       {x.t}<Cite v={x.ev} /></div>))}
    </div>

    <Bar icon="⚠" title="What the design rests on" bg="#6b5420"
     note="an assumption that fails here changes the design, not the configuration"
     n={SEI_ASSUMPTIONS.length} label="assumptions" />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 8, overflow: "hidden" }}>
     {SEI_ASSUMPTIONS.map((a) => (
      <div key={a.a} style={{ display: "grid",
       gridTemplateColumns: "74px minmax(0,1fr) minmax(0,1fr)", gap: 12,
       padding: "10px 14px", fontSize: 11, borderTop: "1px solid #eef1f4" }}>
       <span>{chip(DOCC[a.doc] + "1f", DOCC[a.doc],
        a.doc === "ingest" ? "INGEST" : "DBT")}</span>
       <span style={{ color: "#33414d", lineHeight: 1.55 }}>{a.a}</span>
       <span style={{ color: "#a8560f", lineHeight: 1.55 }}>
        <b style={{ fontSize: 9 }}>IF NOT: </b>{a.x}</span>
      </div>))}
    </div>

    <Bar icon="○" title="Open with SEI" bg="#4a2f6b"
     note="SEI's own open items, with SEI's own ids — not BBH's gap list"
     n={SEI_OPEN.length} label="decisions" />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
     {SEI_OPEN.map((o) => (
      <div key={o.id} style={{ display: "grid",
       gridTemplateColumns: "48px 74px minmax(0,1fr)", gap: 12,
       padding: "10px 14px", fontSize: 11, borderTop: "1px solid #eef1f4" }}>
       <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
        color: "#6d3ac0" }}>{o.id}</b>
       <span>{chip(DOCC[o.doc] + "1f", DOCC[o.doc],
        o.doc === "ingest" ? "INGEST" : "DBT")}</span>
       <span style={{ color: "#33414d", lineHeight: 1.55 }}>{o.t}</span>
      </div>))}
    </div>
   </div>);
 }

 /* ---------- SEI-BBH Integration Architecture v5 ------------------
    The third SEI document, and the one that disagrees with the other
    two. Kept apart rather than merged, because merging them is exactly
    the silent reconciliation this whole exercise exists to avoid. */
 if (view === "ARCH") {
  const Bar = ({ icon, title, note, n, label, bg }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: bg || (t.navy || "#10193b"), color: "#fff", borderRadius: 10,
    padding: "13px 18px", margin: "16px 0 10px" }}>
    <span style={{ fontSize: 22 }}>{icon}</span>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#dfe7f2", marginTop: 2 }}>{note}</div></div>
    {n !== undefined && (
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#dfe7f2" }}><b style={{ display: "block", fontSize: 19,
      color: "#fff" }}>{n}</b>{label}</div>)}
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <Crumb trail={[["containers", () => setView("L2")],
                   ["Integration Architecture v5", null]]} />

    <div style={{ background: "#5c3030", color: "#fff", borderRadius: 10,
     padding: "16px 20px", marginBottom: 4 }}>
     <b style={{ fontSize: 15 }}>{SEI_ARCH_DOC.title} v{SEI_ARCH_DOC.version}</b>
     <div style={{ fontSize: 11.5, color: "#efdada", lineHeight: 1.65,
      marginTop: 6, maxWidth: 940 }}>
      {SEI_ARCH_DOC.scope}
      <br /><br />
      <b>It does not agree with SEI's two design documents</b>, and that is
      the most useful thing on this page. Three RAW tables or seven. A
      Silver made of STG and INT, or a Stage 2 made of five tables. One
      Gold fact or three. These are not different words for one design.
     </div>
    </div>

    <Bar icon="⚠" title="Where SEI's own documents disagree" bg="#8c2f3a"
     note="each one is a decision somebody has to take before a model is written"
     n={ARCH_CONFLICTS.length} label="conflicts" />
    <div style={{ display: "grid", gap: 8 }}>
     {ARCH_CONFLICTS.map((c) => (
      <div key={c.id} style={{ background: "#fff",
       border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderLeft: "3px solid #cc3344", borderRadius: 8, padding: "13px 16px" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
         fontWeight: 800, color: "#cc3344" }}>{c.id}</span>
        <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>{c.t}</b>
       </div>
       <div style={{ display: "grid", gap: 10, marginTop: 9,
        gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <div><div style={{ fontSize: 8.5, fontWeight: 800, color: "#a8560f",
         letterSpacing: .4 }}>THE ARCHITECTURE SAYS</div>
         <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
          marginTop: 3 }}>{c.arch}</div></div>
        <div><div style={{ fontSize: 8.5, fontWeight: 800, color: "#0f4775",
         letterSpacing: .4 }}>THE DESIGN DOCUMENTS SAY</div>
         <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
          marginTop: 3 }}>{c.doc}</div></div>
       </div>
       <div style={{ background: "#fdf1f2", borderRadius: 6,
        padding: "9px 12px", marginTop: 9, fontSize: 11, color: "#33414d",
        lineHeight: 1.6 }}><b>Why it matters. </b>{c.why}</div>
      </div>))}
    </div>

    <Bar icon="⇄" title="Inbound" bg="#6b5420"
     note={INBOUND_POSTURE.src} />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderLeft: "3px solid #a8560f", borderRadius: 8, padding: "13px 16px" }}>
     <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chip("#fdf2e3", "#a8560f", `PRIMARY · ${INBOUND_POSTURE.primary}`)}
      {chip("#eef3f8", "#5c7c94", `SECONDARY · ${INBOUND_POSTURE.secondary}`)}
     </div>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
      marginTop: 8, maxWidth: 940 }}>{INBOUND_POSTURE.note}</div>
     <div style={{ fontSize: 11.5, color: "#a8560f", lineHeight: 1.65,
      marginTop: 7, maxWidth: 940 }}>{INBOUND_POSTURE.consequence}</div>
    </div>

    <Bar icon="⬆" title="Outbound — the loader contract" bg="#1f4f7a"
     note={OUTBOUND_FLOW.src} n={OUTBOUND_FLOW.steps.length} label="steps" />
    <div style={{ fontSize: 11, color: t.sub || "#666", marginBottom: 8 }}>
     {OUTBOUND_FLOW.example}</div>
    <div style={{ display: "grid", gap: 8,
     gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
     {OUTBOUND_FLOW.steps.map((st) => (
      <div key={st.n} style={{ background: "#fff", borderRadius: 8,
       border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderLeft: "3px solid #1168bd", padding: "12px 15px" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: 9,
         background: "#1168bd", color: "#fff", fontSize: 9, fontWeight: 800,
         display: "inline-flex", alignItems: "center",
         justifyContent: "center" }}>{st.n}</span>
        <b style={{ fontSize: 11, color: "#0f4775" }}>{st.a}</b>
       </div>
       <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
        marginTop: 7 }}>{st.t}</div>
      </div>))}
    </div>
    <div style={{ background: "#fdf7ea", borderRadius: 8,
     borderLeft: "3px solid #a8560f", padding: "12px 16px", marginTop: 8,
     fontSize: 11.5, color: "#33414d", lineHeight: 1.65 }}>
     {OUTBOUND_FLOW.note}</div>

    <Bar icon="▦" title="The feeds, and what each one does to Gold"
     bg="#1f6b45" n={ARCH_FEEDS.length} label="feed types" />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 8, overflow: "hidden" }}>
     {ARCH_FEEDS.map((f) => (
      <div key={f.k} style={{ display: "grid",
       gridTemplateColumns: "150px minmax(0,1.2fr) 170px minmax(0,1.3fr)",
       gap: 12, padding: "11px 14px", fontSize: 11,
       borderTop: "1px solid #eef1f4", alignItems: "start" }}>
       <div><b style={{ color: t.navy || "#10193b" }}>{f.n}</b>
        <div style={{ fontSize: 9.5, color: t.sub || "#666", marginTop: 2 }}>
         {f.sub}</div></div>
       <span style={{ color: "#33414d", lineHeight: 1.55 }}>
        {f.files.join(" · ")}</span>
       <span>{chip("#eef3f8", "#5c7c94", f.pattern)}</span>
       <span style={{ color: "#33414d", lineHeight: 1.55 }}>{f.gold}</span>
      </div>))}
    </div>

    <Bar icon="◆" title="The layers, and the objects in them" bg="#0f4775"
     n={ARCH_LAYERS.reduce((n, l) => n + l.objects.length, 0)} label="objects" />
    <div style={{ display: "grid", gap: 8 }}>
     {ARCH_LAYERS.map((l) => (
      <div key={l.k} style={{ background: "#fff", borderRadius: 8,
       border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderLeft: "3px solid #1168bd", padding: "12px 16px" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>{l.n}</b>
        {chip("#eef3f8", "#5c7c94", l.tech)}
       </div>
       <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
        marginTop: 6 }}>{l.w}</div>
       {l.objects.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap",
         marginTop: 8 }}>
         {l.objects.map((o) => (
          <span key={o} style={{ fontFamily: "Roboto Mono, monospace",
           fontSize: 9.5, fontWeight: 700, padding: "3px 9px",
           borderRadius: 5, background: "#e4f0fb", color: "#0f4775" }}>
           {o}</span>))}
        </div>)}
       {l.cols && (
        <div style={{ fontSize: 10, fontFamily: "Roboto Mono, monospace",
         color: "#5c7c94", lineHeight: 1.6, marginTop: 7, background: "#f6f9fb",
         borderRadius: 5, padding: "7px 10px" }}>{l.cols}</div>)}
       {l.steps && (
        <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 7,
         lineHeight: 1.6 }}>{l.steps.join(" · ")}</div>)}
       {l.note && (
        <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 5 }}>
         {l.note}</div>)}
      </div>))}
    </div>

    <Bar icon="⚙" title="Orchestration, and the principles" bg="#4a2f6b" />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 8, padding: "13px 16px", marginBottom: 24 }}>
     <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
      alignItems: "center" }}>
      {ARCH_ORCHESTRATION.map((o, i) => (
       <span key={o} style={{ display: "inline-flex", alignItems: "center",
        gap: 8 }}>
        {i > 0 && <span style={{ color: "#9aa7b2" }}>→</span>}
        {chip("#e4f0fb", "#0f4775", o)}</span>))}
     </div>
     <div style={{ display: "grid", gap: 5, marginTop: 11 }}>
      {ARCH_PRINCIPLES.map((p) => (
       <div key={p} style={{ fontSize: 11.5, color: "#33414d",
        lineHeight: 1.6 }}>· {p}</div>))}
     </div>
    </div>
   </div>);
 }

 /* ---------- The container, opened ------------------------------
    What a group actually contains, in two halves that are never mixed:
    what SEI specified, cited; then what BBH has in that container and
    the verdict on each. Processing also shows its stage chain, because
    that is the part people came for. */
 if (view === "GRP" && grp) {
  const g = groupById(grp);
  const evts = grp === "events";
  const trk = COMPS.filter((c) => groupOfTracker(c) === grp);
  const seis = (g ? g.sei : []).map((id) =>
    SEI_COMPONENTS.find((c) => c.id === id)).filter(Boolean);
  const bbhs = (g ? g.bbh : []).map((id) =>
    BBH_EXTENSION.find((b) => b.id === id)).filter(Boolean);
  const Head = ({ title, note, n, label, bg }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: bg, color: "#fff", borderRadius: 10, padding: "13px 18px",
    margin: "16px 0 10px" }}>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#dfe7f2", marginTop: 2 }}>{note}</div></div>
    {n !== undefined && (
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#dfe7f2" }}><b style={{ display: "block", fontSize: 19,
      color: "#fff" }}>{n}</b>{label}</div>)}
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <Crumb trail={[["containers", () => setView("L2")],
                   [evts ? "Event Ingestion" : g.n, null]]} />
    <div style={{ background: evts ? "#5c3030" : "#0f4775", color: "#fff",
     borderRadius: 10, padding: "16px 20px", marginBottom: 4 }}>
     <b style={{ fontSize: 16 }}>{evts ? "Event Ingestion" : g.n}</b>
     <div style={{ fontSize: 11.5, color: "#dfe7f2", lineHeight: 1.6,
      marginTop: 5 }}>
      {evts ? "Proposed by this programme's events-primary review. Not in "
            + "SEI's documents and not in the delivery workbook, so none of "
            + "it is cited and none of it is committed."
            : g.sub}</div>
    </div>

    {/* A container that owns a detailed screen offers it here rather than
        leaving the reader to find it from the top. */}
    {(grp === "orchestration" || grp === "ingress" || grp === "events"
      || grp === "ingestion" || grp === "foundation") && (
     <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 2px" }}>
      {grp === "foundation" && (
       <span onClick={() => { setDbPick(null); setView("DBM"); }}
        style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
         borderRadius: 999, cursor: "pointer", background: "#eef1f4",
         color: "#5c6b7a" }}>
        ▤ the database model &middot; control plane and data path</span>)}
      {grp === "ingestion" && (
       <span onClick={() => setView("FILE")} style={{ fontSize: 10.5,
        fontWeight: 800, padding: "6px 14px", borderRadius: 999,
        cursor: "pointer", background: "#e8f3ec", color: "#1f6b45" }}>
        ▤ file-based ingestion · discover, validate, load, reconcile, archive</span>)}
      {(grp === "orchestration" || grp === "events") && (
       <span onClick={() => setView("GATE")} style={{ fontSize: 10.5,
        fontWeight: 800, padding: "6px 14px", borderRadius: 999,
        cursor: "pointer", background: "#e4f0fb", color: "#0f4775" }}>
        ◆ three kinds of event, and what opens the day</span>)}
      {grp === "ingress" && (
       <span onClick={() => setView("LOOP")} style={{ fontSize: 10.5,
        fontWeight: 800, padding: "6px 14px", borderRadius: 999,
        cursor: "pointer", background: "#fdf2e3", color: "#a8560f" }}>
        ⇄ the loader loop · four legs, two transports</span>)}
      <span onClick={() => { setView("CTX"); setChan(null); }}
       style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
        borderRadius: 999, cursor: "pointer", background: "#eef3f8",
        color: "#0f4775" }}>⇆ the boundary</span>
     </div>)}

    {grp === "processing" && (
     <>
      <Head title="The stage chain" bg="#1f4f7a"
       note="Stage 2 and Stage 2 INT are the one layer also called Silver or Enriched"
       n={PROC_STAGES.length} label="stages" />
      <div style={{ display: "grid", gap: 8,
       gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
       {PROC_STAGES.map((st) => (
        <div key={st.id} style={{ background: "#fff", borderRadius: 8,
         border: st.bbh.length ? "1px dashed #dfa96a"
           : `1px solid ${t.panel2 || "#dfe6e9"}`,
         borderLeft: `3px solid ${st.bbh.length ? "#a8560f" : "#1168bd"}`,
         padding: "12px 15px" }}>
         <b style={{ fontSize: 12.5,
          color: st.bbh.length ? "#a8560f" : (t.navy || "#10193b") }}>{st.n}</b>
         <div style={{ fontSize: 10, color: t.sub || "#666", marginTop: 2 }}>
          {st.sub}</div>
         <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
          marginTop: 7 }}>{st.w}</div>
         {st.note && <div style={{ fontSize: 10.5, color: "#a8560f",
          lineHeight: 1.55, marginTop: 6 }}>{st.note}</div>}
         <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {[...st.sei, ...st.bbh].map((id) => (
           <span key={id} onClick={() => { if (id[0] === "S") {
             setSeiComp(id); setView("SEIL4"); } }}
            style={{ cursor: id[0] === "S" ? "pointer" : "default" }}>
            {chip(id[0] === "S" ? "#e4f0fb" : "#fdf2e3",
              id[0] === "S" ? "#0f4775" : "#a8560f", id)}</span>))}
          {st.tbl.map((id) => (
           <span key={id}>{chip("#eef1f4", "#5c6b7a",
            (SEI_TABLES.find((x) => x.id === id) || {}).n || id)}</span>))}
         </div>
        </div>))}
      </div>
     </>)}

    {grp === "processing" && (
     <>
      <Head title="Data models" bg="#1f4f7a"
       note="what the database actually looks like at each stage"
       n={3} label="models" />
      <div style={{ display: "grid", gap: 8,
       gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
       {[
        { k: "db", n: "The database, in the flow",
          sub: "the data path and the control plane, as one picture",
          w: "Where rows live, which tables decide whether they move, and "
           + "who writes each one. Two routes still have no bookkeeping.",
          go: () => { setDbPick(null); setView("DBM"); } },
        { k: "s1", n: "Stage 1 data model",
          sub: "RAW — one table per inbound interface",
          w: "Append-only, as delivered, no keys and nothing cleaned. The "
           + "two sources do not name the same set of RAW tables.",
          go: () => setView("S1M") },
        { k: "s2", n: "Stage 2 / Silver / Enriched data model",
          sub: `the normalised SWP model — ${S2_TABLES.length} canonical tables`,
          w: "Three names for one layer. 10 domains, 3NF, fed only by STG "
           + "PASS rows. Every relationship is declared, tested, or "
           + "enforced nowhere.",
          go: () => { setS2dom(null); setS2tbl(null); setView("S2M"); } },
       ].map((m) => (
        <div key={m.k} onClick={m.go} style={{ background: "#fff",
         borderRadius: 8, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
         borderLeft: "3px solid #1168bd", padding: "12px 15px",
         cursor: "pointer" }}>
         <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>{m.n}</b>
         <div style={{ fontSize: 10, color: t.sub || "#666", marginTop: 2 }}>
          {m.sub}</div>
         <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
          marginTop: 7 }}>{m.w}</div>
         <div style={{ fontSize: 11, fontWeight: 700, color: "#0f4775",
          marginTop: 8 }}>open &rarr;</div>
        </div>))}
      </div>
     </>)}

    {!evts && lanesOf(grp).length > 0 && (
     <>
      <Head title="What is in here" bg="#1f4f7a"
       note="the named parts, each with what it runs on"
       n={lanesOf(grp).length} label="lanes" />
      <div style={{ display: "grid", gap: 8,
       gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
       {lanesOf(grp).map((l) => {
        const lt = trk.filter((c) => laneOfTracker(c, grp) === l.id);
        const lsei = (l.sei || []).length;
        return (
         <div key={l.id} style={{ background: "#fff", borderRadius: 8,
          border: l.proposal ? "1px dashed #e0a9b0"
            : `1px solid ${t.panel2 || "#dfe6e9"}`,
          borderLeft: `3px solid ${l.proposal ? "#cc3344" : "#1168bd"}`,
          padding: "12px 15px" }}>
          <b style={{ fontSize: 12.5,
           color: l.proposal ? "#cc3344" : (t.navy || "#10193b") }}>{l.n}</b>
          <div style={{ fontSize: 10, color: t.sub || "#666", marginTop: 2 }}>
           {l.tech}</div>
          <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
           marginTop: 7 }}>{l.w}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap",
           marginTop: 8 }}>
           {lsei > 0 && chip("#e4f0fb", "#0f4775", `${lsei} specified by SEI`)}
           {(l.bbh || []).length > 0 && chip("#fdf2e3", "#a8560f",
             `${(l.bbh || []).length} BBH`)}
           {lt.length > 0 && chip("#eef1f4", "#5c6b7a", `${lt.length} tracked`)}
          </div>
         </div>);
       })}
      </div>
     </>)}

    {seis.length > 0 && (
     <>
      <Head title="Specified by SEI" bg="#1f6b45"
       note="each cited to a section and a page; click for the full record"
       n={seis.length} label="components" />
      <div style={{ display: "grid", gap: 8 }}>
       {seis.map((c) => (
        <div key={c.id} onClick={() => { setSeiComp(c.id); setView("SEIL4"); }}
         style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
          borderLeft: "3px solid #1168bd", borderRadius: 8, padding: "12px 16px",
          cursor: "pointer" }}>
         <div style={{ display: "flex", alignItems: "center", gap: 8,
          flexWrap: "wrap" }}>
          <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
           fontWeight: 700, color: "#8a97a3" }}>{c.id}</span>
          <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>{c.n}</b>
          {chip("#eef3f8", "#5c7c94", c.tech)}
          {(c.open || []).length > 0 && chip("#f3eefb", "#6d3ac0",
            `${(c.open || []).length} open with SEI`)}
          <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800,
           color: "#0f4775" }}>open record →</span>
         </div>
         <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
          marginTop: 6, maxWidth: 940 }}>{c.w}</div>
         <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 5 }}>
          {c.ev}</div>
        </div>))}
      </div>
     </>)}

    {bbhs.length > 0 && (
     <>
      <Head title="BBH's own, in this container" bg="#6b5420"
       note="not in either SEI document" n={bbhs.length} label="layers" />
      <div style={{ display: "grid", gap: 8 }}>
       {bbhs.map((b) => (
        <div key={b.id} style={{ background: "#fff", borderRadius: 8,
         border: "1px dashed #dfa96a", borderLeft: "3px solid #a8560f",
         padding: "12px 16px" }}>
         <b style={{ fontSize: 12.5, color: "#a8560f" }}>{b.id} · {b.n}</b>
         <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
          marginTop: 5 }}>{b.w}</div>
         <div style={{ fontSize: 10.5, color: "#8a6a3a", lineHeight: 1.55,
          marginTop: 5 }}>{b.why}</div>
        </div>))}
      </div>
     </>)}

    {trk.length > 0 && (
     <>
      <Head title={evts ? "What it would add" : "What BBH tracks here"}
       bg={evts ? "#5c3030" : "#4a2f6b"}
       note={evts ? "ids from 101, so they can never be mistaken for a tracker component"
         : "from the delivery workbook, with the verdict against SEI's documents"}
       n={trk.length} label="components" />
      <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderRadius: 8, overflow: "hidden" }}>
       {trk.map((c) => {
        const r = evts ? { st: "absent" } : (REGISTRY[c.id] || { st: "absent" });
        const [col, label] = REG_STATE[r.st];
        const dk = docFor(c), d = DOCS[dk];
        const st2 = stageOfTracker(c);
        return (
         <div key={c.id} style={{ display: "grid",
          gridTemplateColumns: "44px minmax(0,1.2fr) 104px minmax(0,2fr) 128px",
          gap: 12, padding: "10px 14px", fontSize: 11,
          borderTop: "1px solid #eef1f4", alignItems: "start" }}>
          <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
           color: col }}>{c.id}</b>
          <div><b style={{ color: t.navy || "#10193b" }}>{c.component}</b>
           <div style={{ fontSize: 9, fontWeight: 800, color: "#1168bd",
            marginTop: 2 }}>
            {[(laneById(grp, laneOfTracker(c, grp)) || {}).n,
              st2 ? (stageById(st2) || {}).n : null]
              .filter(Boolean).join("  ·  ")}</div></div>
          <span>{chip(col + "1f", col, label.toUpperCase())}</span>
          <span style={{ color: "#33414d", lineHeight: 1.55 }}>
           {r.why || (r.sei ? `baseline ${r.sei.join(", ")}` : "—")}</span>
          <span onClick={() => setDoc({ key: dk, from: c })}
           style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px",
            borderRadius: 999, cursor: "pointer", background: d.bg, color: d.color,
            border: `1px solid ${d.color}`, textAlign: "center",
            whiteSpace: "nowrap", justifySelf: "end" }}>
           {d.icon} design doc →</span>
         </div>);
       })}
      </div>
     </>)}
   </div>);
 }

 /* ---------- C4 L3 — the components inside one container -------
    Reached by clicking a band on L2. Lists what SEI puts in that part
    of the design, and nothing else; each one opens its record. */
 if (view === "SEIL3" && seiStage) {
  const st = SEI_STAGES.find((x) => x.k === seiStage) || {};
  const cs = seiCompsIn(seiStage);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <Crumb trail={[
      ["architecture", () => setView("SEIFLOW")],
      [st.n, null]]} />
    <div style={{ display: "flex", alignItems: "center", gap: 12,
     background: "#0f4775", color: "#fff", borderRadius: 10,
     padding: "14px 20px", marginBottom: 12 }}>
     <span style={{ fontSize: 24 }}>◆</span>
     <div><b>{st.n}</b>
      <div style={{ fontSize: 10, color: "#cfe0f2", marginTop: 2 }}>{st.d}</div></div>
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#cfe0f2" }}><b style={{ display: "block", fontSize: 20,
      color: "#fff" }}>{cs.length}</b>components</div>
    </div>
    <div style={{ display: "grid", gap: 8 }}>
     {cs.map((c) => (
      <div key={c.id} onClick={() => { setSeiComp(c.id); setView("SEIL4"); }}
       style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderLeft: "3px solid #1168bd", borderRadius: 8, padding: "12px 16px",
        cursor: "pointer" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap" }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
         fontWeight: 700, color: "#8a97a3" }}>{c.id}</span>
        <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>{c.n}</b>
        {chip("#eef3f8", "#5c7c94", c.tech)}
        {(c.tbl || []).map((x) => (
          <span key={x}>{chip("#e4f0fb", "#0f4775",
           (SEI_TABLES.find((z) => z.id === x) || {}).n || x)}</span>))}
        {(c.open || []).length > 0 && chip("#f3eefb", "#6d3ac0",
          `${(c.open || []).length} open with SEI`)}
        <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800,
         color: "#0f4775" }}>open record →</span>
       </div>
       <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
        marginTop: 6, maxWidth: 940 }}>{c.w}</div>
       <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 5 }}>
        {c.ev}</div>
      </div>))}
    </div>
   </div>);
 }

 /* ---------- C4 L4 — one component's record -------------------
    The bottom of the drill-down, and the nearest thing to a design
    document for a SEI component: what it is, what SEI says and where,
    the Oracle objects it touches, what is still open about it, and
    which BBH components map onto it. Where a tracker component maps,
    its generated design document is one more click. */
 if (view === "SEIL4" && seiComp) {
  const c = SEI_COMPONENTS.find((x) => x.id === seiComp);
  if (!c) return null;
  const st = SEI_STAGES.find((x) => x.k === c.s) || {};
  const tbls = (c.tbl || []).map((x) => SEI_TABLES.find((z) => z.id === x))
    .filter(Boolean);
  const opens = (c.open || []).map((x) => SEI_OPEN.find((z) => z.id === x))
    .filter(Boolean);
  const mapped = Object.entries(REGISTRY)
    .filter(([, r]) => (r.sei || []).includes(c.id))
    .map(([id, r]) => ({ id, r, c: COMPS.find((z) => z.id === id) }))
    .filter((x) => x.c);
  const Sec = ({ title, note, children }) => (
   <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4,
     color: "#5c7c94" }}>{title}</div>
    {note && <div style={{ fontSize: 10, color: t.muted || "#999",
      marginTop: 2 }}>{note}</div>}
    <div style={{ marginTop: 6 }}>{children}</div>
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <Crumb trail={[
      ["architecture", () => setView("SEIFLOW")],
      [st.n, () => { setSeiStage(c.s); setView("SEIL3"); }],
      [c.id, null]]} />
    <div style={{ background: "#0f4775", color: "#fff", borderRadius: 10,
     padding: "16px 20px", marginBottom: 12 }}>
     <div style={{ display: "flex", alignItems: "center", gap: 10,
      flexWrap: "wrap" }}>
      <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11,
       fontWeight: 800, color: "#9ec6ee" }}>{c.id}</span>
      <b style={{ fontSize: 16 }}>{c.n}</b>
      {chip("#ffffff22", "#cfe0f2", c.tech)}
     </div>
     <div style={{ fontSize: 12, color: "#e6eef7", lineHeight: 1.65,
      marginTop: 8, maxWidth: 940 }}>{c.w}</div>
     <div style={{ fontSize: 10, color: "#9ec6ee", marginTop: 9 }}>
      {c.ev}</div>
    </div>

    {tbls.length > 0 && (
     <Sec title="THE ORACLE OBJECTS IT TOUCHES"
      note="columns as the design documents give them; no foreign key is declared">
      <div style={{ display: "grid", gap: 8 }}>
       {tbls.map((tb) => (
        <div key={tb.id} style={{ background: "#fff", borderRadius: 8,
         border: `1px solid ${t.panel2 || "#dfe6e9"}`, padding: "11px 14px" }}>
         <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11.5,
          color: t.navy || "#10193b" }}>{tb.n}</b>
         <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
          marginTop: 4 }}>{tb.w}</div>
         <div style={{ fontSize: 10, fontFamily: "Roboto Mono, monospace",
          color: "#5c7c94", lineHeight: 1.6, marginTop: 6, background: "#f6f9fb",
          borderRadius: 5, padding: "7px 10px" }}>{tb.cols}</div>
         <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 5 }}>
          {tb.ev}</div>
        </div>))}
      </div>
     </Sec>)}

    {opens.length > 0 && (
     <Sec title="STILL OPEN WITH SEI"
      note="SEI's own ids, so they can be quoted straight back">
      <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderRadius: 8, overflow: "hidden" }}>
       {opens.map((o) => (
        <div key={o.id} style={{ display: "grid",
         gridTemplateColumns: "48px minmax(0,1fr)", gap: 12, padding: "10px 14px",
         fontSize: 11, borderTop: "1px solid #eef1f4" }}>
         <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
          color: "#6d3ac0" }}>{o.id}</b>
         <span style={{ color: "#33414d", lineHeight: 1.55 }}>{o.t}</span>
        </div>))}
      </div>
     </Sec>)}

    <Sec title="WHAT BBH HAS AGAINST IT"
     note={mapped.length ? "tracker components that map onto this, and their design documents"
       : "nothing in the tracker maps onto this"}>
     {mapped.length === 0 ? (
      <div style={{ background: "#fdf1f2", borderRadius: 8,
       borderLeft: "3px solid #cc3344", padding: "11px 14px", fontSize: 11.5,
       color: "#33414d", lineHeight: 1.6 }}>
       SEI specifies this and no component in the delivery workbook
       corresponds to it. That is worth a look: it is either genuinely
       covered by one of the components above, or it is work nobody is
       tracking.
      </div>) : (
      <div style={{ display: "grid", gap: 8 }}>
       {mapped.map(({ id, r, c: tc }) => {
        const dk = docFor(tc), d = DOCS[dk];
        const [sc, sl] = REG_STATE[r.st];
        return (
         <div key={id} style={{ background: "#fff", borderRadius: 8,
          border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderLeft: `3px solid ${sc}`,
          padding: "11px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
           flexWrap: "wrap" }}>
           <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
            fontWeight: 700, color: "#8a97a3" }}>#{id}</span>
           <b style={{ fontSize: 12, color: t.navy || "#10193b" }}>
            {tc.component}</b>
           {chip(sc + "1f", sc, sl.toUpperCase())}
           <span onClick={() => setDoc({ key: dk, from: tc })}
            style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800,
             padding: "4px 11px", borderRadius: 999, cursor: "pointer",
             background: d.bg, color: d.color, border: `1px solid ${d.color}` }}>
            {d.icon} design document →</span>
          </div>
          {r.why && <div style={{ fontSize: 11, color: "#33414d",
           lineHeight: 1.6, marginTop: 5 }}>{r.why}</div>}
         </div>);
       })}
      </div>)}
    </Sec>
   </div>);
 }

 /* ---------- Component registry — everything that is not SEI's ----
    The diagram carries SEI's design. This carries the rest, with a
    verdict on each rather than a silent omission: specified, differs,
    or absent. "Differs" is the one worth the exercise — SEI covers the
    need and answers it another way, and somebody has to pick. */
 if (view === "REGISTRY") {
  const rows = COMPS.map((c) => {
   const review = Number(c.id) >= 101;
   const r = review ? { st: "absent", why: c.questions || c.deliverable }
                    : (REGISTRY[c.id] || { st: "absent", why: "" });
   return { c, r, origin: review ? "review" : "workbook" };
  });
  const order = ["differs", "absent", "specified"];
  const Bar = ({ icon, title, note, n, label, bg }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: bg || (t.navy || "#10193b"), color: "#fff", borderRadius: 10,
    padding: "13px 18px", margin: "16px 0 10px" }}>
    <span style={{ fontSize: 22 }}>{icon}</span>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#dfe7f2", marginTop: 2 }}>{note}</div></div>
    {n !== undefined && (
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#dfe7f2" }}><b style={{ display: "block", fontSize: 19,
      color: "#fff" }}>{n}</b>{label}</div>)}
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
     <span onClick={() => setView("L2")} style={{ fontSize: 11.5, fontWeight: 700,
      padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
      color: "#fff", cursor: "pointer" }}>← architecture</span>
     <span onClick={() => { setView("SEIBASE"); setExpand(null); }}
      style={{ fontSize: 10.5, fontWeight: 800, padding: "6px 14px",
       borderRadius: 999, cursor: "pointer", background: "#0f4775",
       color: "#fff" }}>◆ the SEI baseline</span>
    </div>

    <div style={{ background: "#4a2f6b", color: "#fff", borderRadius: 10,
     padding: "16px 20px", marginBottom: 12 }}>
     <b style={{ fontSize: 15 }}>Everything that is not the SEI baseline</b>
     <div style={{ fontSize: 11.5, color: "#ddd2ec", lineHeight: 1.65,
      marginTop: 6, maxWidth: 940 }}>
      The architecture diagram carries what SEI specified. These are the
      rest of the components the programme has on its books, each with a
      verdict instead of a silent omission. They keep their ids and their
      design documents; they go back on the diagram when SEI's documents
      cover them or BBH formally adopts them.
     </div>
     <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 11 }}>
      {order.map((k) => (
       <span key={k} style={{ display: "inline-flex", alignItems: "center",
        gap: 6, fontSize: 11 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2,
         background: REG_STATE[k][0] }} />
        <b>{rows.filter((x) => x.r.st === k).length}</b>
        <span style={{ color: "#ddd2ec" }}>{REG_STATE[k][1]}</span></span>))}
     </div>
    </div>

    <div style={{ background: "#fdf7ea", borderRadius: 8,
     borderLeft: "3px solid #a8560f", padding: "12px 16px", marginBottom: 4 }}>
     <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a8560f",
      letterSpacing: .4 }}>THE LAYER MODEL · {BBH_LAYERS.src}</div>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
      marginTop: 5, maxWidth: 940 }}>{BBH_LAYERS.note}</div>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
      marginTop: 7, maxWidth: 940 }}>{BBH_LAYERS.beyond}</div>
     <div style={{ fontSize: 11.5, color: "#a8560f", lineHeight: 1.65,
      marginTop: 7, maxWidth: 940 }}><b>Why it matters. </b>
      {BBH_LAYERS.why_it_matters}</div>
     <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
      {BBH_EXTENSION.map((b) => (
       <div key={b.id} style={{ background: "#fff", borderRadius: 6,
        border: "1px dashed #dfa96a", padding: "9px 12px" }}>
        <b style={{ fontSize: 11, color: "#a8560f" }}>{b.id} · {b.n}</b>
        <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
         marginTop: 3 }}>{b.w}</div>
        <div style={{ fontSize: 10.5, color: "#8a6a3a", lineHeight: 1.55,
         marginTop: 3 }}>{b.why}</div>
       </div>))}
     </div>
    </div>

    {order.map((st) => {
     const rs = rows.filter((x) => x.r.st === st);
     if (!rs.length) return null;
     const [col, label, blurb] = REG_STATE[st];
     return (
      <div key={st}>
       <Bar icon={st === "specified" ? "✓" : st === "differs" ? "⇄" : "○"}
        title={label} note={blurb} n={rs.length} label="components"
        bg={st === "specified" ? "#1f6b45" : st === "differs" ? "#6b5420" : "#4a2f6b"} />
       <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderRadius: 8, overflow: "hidden" }}>
        {rs.map(({ c, r, origin }) => (
         <div key={c.id} style={{ display: "grid",
          gridTemplateColumns: "44px minmax(0,1.1fr) 92px minmax(0,2fr) 120px",
          gap: 12, padding: "10px 14px", fontSize: 11,
          borderTop: "1px solid #eef1f4", alignItems: "start" }}>
          <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
           color: col }}>{c.id}</b>
          <b style={{ color: t.navy || "#10193b" }}>{c.component}</b>
          <span>{chip(REG_ORIGIN[origin][0] + "1f", REG_ORIGIN[origin][0],
           origin === "review" ? "REVIEW" : "WORKBOOK")}</span>
          <span style={{ color: "#33414d", lineHeight: 1.55 }}>
           {r.why || (r.sei ? "" : "—")}</span>
          <span style={{ fontSize: 9.5, color: t.sub || "#666" }}>
           {(r.sei || []).length ? `baseline ${(r.sei || []).join(", ")}` : ""}</span>
         </div>))}
       </div>
      </div>);
    })}

    <div style={{ background: "#fdf1f2", borderRadius: 8,
     borderLeft: "3px solid #cc3344", padding: "12px 16px", margin: "16px 0 24px" }}>
     <div style={{ fontSize: 8.5, fontWeight: 800, color: "#cc3344",
      letterSpacing: .4 }}>ON THE REVIEW'S OWN PROPOSALS</div>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
      marginTop: 5, maxWidth: 940 }}>{REG_REVIEW_NOTE}</div>
    </div>
   </div>);
 }

 /* ---------- Foundation framework — the data models ---------- */
 if (view === "FNDMODEL") {
  const Bar = ({ icon, title, note, n, label }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: t.navy || "#10193b", color: "#fff", borderRadius: 10,
    padding: "14px 20px", margin: "18px 0 10px" }}>
    <span style={{ fontSize: 24 }}>{icon}</span>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>{note}</div></div>
    <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
     color: "#a9c1de" }}><b style={{ display: "block", fontSize: 20,
     color: "#fff" }}>{n}</b>{label}</div>
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => { setCont("FND"); setView("L3"); }}
     style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 16px", borderRadius: 5,
      background: t.navy || "#10193b", color: "#fff", cursor: "pointer",
      display: "inline-block", marginBottom: 12 }}>← Foundation</span>

    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 10, padding: "14px 18px", borderLeft: "3px solid #cc3344" }}>
     <b style={{ fontSize: 14, color: t.navy || "#10193b" }}>{FM_SUMMARY.title}</b>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65, marginTop: 5,
      maxWidth: 980 }}>{FM_SUMMARY.line}</div>
    </div>

    <Bar icon="✓" title="What the SEI pack does provide"
     note="stated first, so the gap is a fair one" n={FM_PROVIDED.length} label="control tables" />
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
     overflow: "hidden", background: "#fff" }}>
     {FM_PROVIDED.map((r) => (
      <div key={r.name} style={{ display: "grid",
       gridTemplateColumns: "184px minmax(0,1fr)", gap: 12, padding: "11px 14px",
       fontSize: 11, borderTop: "1px solid #eef1f4", alignItems: "start" }}>
       <div><b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
        color: t.navy || "#10193b" }}>{r.name}</b>
        <div style={{ marginTop: 4 }}>{chip(FM_AREAS[r.area][1] + "1f",
         FM_AREAS[r.area][1], FM_AREAS[r.area][0].toUpperCase())}</div></div>
       <div><div style={{ color: "#33414d", lineHeight: 1.6 }}>{r.what}</div>
        <div style={{ fontSize: 10.5, color: "#a8560f", lineHeight: 1.55, marginTop: 5 }}>
         <b>limit:</b> {r.limit}</div></div>
      </div>))}
    </div>

    {Object.entries(FM_AREAS).map(([k, [label, col, note]]) => {
     const rows2 = FM_TABLES.filter((x) => x.area === k);
     return (
      <div key={k}>
       <Bar icon="▤" title={`${label} model`} note={note}
        n={rows2.length} label="tables" />
       <div style={{ display: "grid", gap: 8 }}>
        {rows2.map((tb) => {
         const isX = expand === tb.name;
         const [sc, sl] = FM_STATE[tb.state];
         return (
          <div key={tb.name} style={{ background: "#fff",
           border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
           overflow: "hidden" }}>
           <div onClick={() => setExpand(isX ? null : tb.name)}
            style={{ display: "grid",
             gridTemplateColumns: "18px minmax(0,1fr) 150px 170px", gap: 10,
             padding: "11px 14px", fontSize: 11, alignItems: "center",
             cursor: "pointer" }}>
            <span style={{ color: col, fontWeight: 700 }}>{isX ? "−" : "+"}</span>
            <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11,
             color: t.navy || "#10193b" }}>{tb.name}</b>
            <span style={{ fontSize: 9.5, color: t.sub || "#666" }}>{tb.grain}</span>
            <span>{chip(sc + "1f", sc, sl.toUpperCase())}</span>
           </div>
           {isX && (
            <div style={{ padding: "0 14px 14px 42px",
             borderTop: "1px dashed #e3eaf0" }}>
             <Fld k="purpose" v={tb.purpose} />
             <Fld k="why it is needed" v={tb.why} tone={col} />
             <div style={{ marginTop: 11 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4,
               color: t.sub || "#666" }}>COLUMNS</div>
              <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`,
               borderRadius: 6, overflow: "hidden", marginTop: 4, maxWidth: 940 }}>
               {tb.cols.map(([cn, ct, note2], i) => (
                <div key={cn + i} style={{ display: "grid",
                 gridTemplateColumns: "minmax(0,200px) minmax(0,190px) minmax(0,1fr)",
                 gap: 10, padding: "6px 10px", fontSize: 10.5,
                 borderTop: i ? "1px solid #f2f5f8" : "none",
                 background: i % 2 ? "#fafcfe" : "#fff" }}>
                 <b style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
                  color: "#0f4775" }}>{cn}</b>
                 <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 9.5,
                  color: t.sub || "#666" }}>{ct}</span>
                 <span style={{ color: "#33414d" }}>{note2}</span>
                </div>))}
              </div>
             </div>
             {tb.notes.map((nt, i) => (
              <div key={i} style={{ fontSize: 10.5, color: "#33414d", lineHeight: 1.6,
               marginTop: 7, paddingLeft: 10, borderLeft: `2px solid ${col}` }}>{nt}</div>))}
            </div>)}
          </div>);
        })}
       </div>
      </div>);
    })}

    <Bar icon="⚑" title="Recommendation" note={FM_REC.verdict}
     n={FM_TABLES.filter((x) => x.state === "new").length}
     label={`new tables · ${FM_TABLES.filter((x) => x.state === "extend").length} extension`} />
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 8, padding: "14px 18px" }}>
     <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65,
      maxWidth: 980 }}>{FM_REC.body}</div>
     <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4, color: "#159943",
      margin: "14px 0 6px" }}>BUILD ORDER</div>
     <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: "#33414d",
      lineHeight: 1.65, maxWidth: 980 }}>
      {FM_REC.order.map((o, i) => (
       <li key={i} style={{ marginBottom: 5 }}>{o}</li>))}
     </ol>
     <div style={{ marginTop: 14, background: "#f7f3fd", borderRadius: 6,
      borderLeft: "3px solid #6d3ac0", padding: "11px 13px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4,
       color: "#6d3ac0" }}>ASK — BOTH SIDES</div>
      <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.65,
       marginTop: 3 }}>{FM_REC.ask}</div>
     </div>
    </div>
   </div>);
 }

 /* ---------- cross-cutting concerns (events-primary) ---------- */
 if (view === "XC") {
  const Bar = ({ icon, title, note, n, label }) => (
   <div style={{ display: "flex", alignItems: "center", gap: 12,
    background: t.navy || "#10193b", color: "#fff", borderRadius: 10,
    padding: "14px 20px", margin: "18px 0 10px" }}>
    <span style={{ fontSize: 24 }}>{icon}</span>
    <div><b>{title}</b>
     <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>{note}</div></div>
    <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
     color: "#a9c1de" }}><b style={{ display: "block", fontSize: 20,
     color: "#fff" }}>{n}</b>{label}</div>
   </div>);
  const List = ({ rows, tone }) => (
   <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
    overflow: "hidden", background: "#fff" }}>
    {rows.map((r) => {
     const isX = expand === r.id;
     return (
      <div key={r.id} style={{ borderTop: "1px solid #eef1f4",
       background: isX ? "#fafcfe" : undefined }}>
       <div onClick={() => setExpand(isX ? null : r.id)} style={{ display: "grid",
        gridTemplateColumns: "48px minmax(0,1fr) 78px", gap: 10, padding: "9px 14px",
        fontSize: 11, alignItems: "center", cursor: "pointer" }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
         fontWeight: 700, color: tone }}>{isX ? "− " : "+ "}{r.id}</span>
        <b style={{ color: t.navy || "#10193b" }}>{r.title}</b>
        <span>{chip(tone + "1f", tone, (r.sev || "").toUpperCase())}</span>
       </div>
       {isX && (
        <div style={{ padding: "2px 14px 14px 62px", borderTop: "1px dashed #e3eaf0" }}>
         <Fld k="what happens" v={r.body} />
         <Fld k={r.fix ? "what to do" : "who owns it today"} v={r.fix || r.owner}
          tone={r.fix ? "#159943" : "#cc3344"} />
         <Fld k="components" v={r.comp.map((x) => {
          const c = COMPS.find((z) => z.arId === x || z.id === x);
          return c ? `#${c.id} ${c.component}` : x; }).join("  ·  ")} />
        </div>)}
      </div>);
    })}
   </div>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => setView("L1")} style={{ fontSize: 11.5, fontWeight: 700,
     padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
     color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
     ← context + dashboard</span>

    <Bar icon="◈" title="The assumption set"
     note="one substitution: SDC events are the primary ingestion path · Stage 1 onward per the SEI pack"
     n="5" label="of 8 changed" />
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
     overflow: "hidden", background: "#fff" }}>
     {AR_ASSUMPTIONS.map((a) => (
      <div key={a.id} style={{ display: "grid",
       gridTemplateColumns: "48px 84px minmax(0,1fr)", gap: 10, padding: "10px 14px",
       fontSize: 11, borderTop: "1px solid #eef1f4", alignItems: "start" }}>
       <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
        fontWeight: 700, color: t.sub || "#666" }}>{a.id}</span>
       <span>{a.holds === "changed" ? chip("#cc33441f", "#cc3344", "CHANGED")
        : chip("#1599431f", "#159943", "HELD")}</span>
       <div><b style={{ color: t.navy || "#10193b" }}>{a.what}</b>
        <div style={{ fontSize: 10.5, color: "#33414d", lineHeight: 1.6,
         marginTop: 3 }}>{a.detail}</div>
        <div style={{ fontSize: 9.5, color: t.sub || "#666", marginTop: 3 }}>
         source: {a.src}</div></div>
      </div>))}
    </div>

    <Bar icon="◔" title="Performance bottlenecks"
     note="every one was a correct decision for a daily file cycle and stops being correct at 288 cycles a day"
     n={AR_BOTTLENECKS.length} label="ranked" />
    <List rows={AR_BOTTLENECKS} tone="#a8560f" />

    <Bar icon="⚠" title="Error paths with no owner"
     note="the first four lose data silently — no alert fires and no count disagrees"
     n={AR_ERRORS.length} label="unowned" />
    <List rows={AR_ERRORS} tone="#cc3344" />

    <Bar icon="?" title="Questions for the SEI design team"
     note="only the gaps that are theirs or joint — the BBH-owned ones are left off on purpose"
     n={AR_COVERAGE.filter((r) => r.ask).length} label="to put to them" />
    {["SEI", "Joint"].map((own) => {
     const rows2 = AR_COVERAGE.filter((r) => r.ask && r.owner === own);
     const [col, lab] = AR_OWNER[own];
     return (
      <div key={own} style={{ marginBottom: 12 }}>
       <div style={{ fontSize: 10.5, fontWeight: 800, color: col, margin: "10px 0 6px",
        letterSpacing: .3 }}>
        {lab.toUpperCase()} · {rows2.length}</div>
       <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
        overflow: "hidden", background: "#fff" }}>
        {rows2.map((r) => {
         const c = COMPS.find((z) => z.arId === r.id || z.id === r.id);
         return (
          <div key={r.id} style={{ display: "grid",
           gridTemplateColumns: "180px minmax(0,1fr)", gap: 12, padding: "10px 14px",
           fontSize: 11, borderTop: "1px solid #eef1f4", alignItems: "start" }}>
           <div>
            <b style={{ color: t.navy || "#10193b", fontSize: 10.5 }}>
             {c ? c.component : r.id}</b>
            <div style={{ fontSize: 9, color: t.sub || "#666", marginTop: 2 }}>
             {c ? `#${c.id} · ${c.plane}` : ""}</div>
            <div style={{ marginTop: 4 }}>{chip(AR_SEI_COVER[r.sei][0] + "1f",
             AR_SEI_COVER[r.sei][0], r.sei.toUpperCase())}</div>
           </div>
           <div>
            <div style={{ color: "#33414d", lineHeight: 1.6 }}>{r.ask}</div>
            <div style={{ fontSize: 10.5, color: "#0b5e83", lineHeight: 1.55,
             marginTop: 5 }}>
             <b>recommendation:</b> {r.rec}</div>
           </div>
          </div>);
        })}
       </div>
      </div>);
    })}
    <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 6, maxWidth: 940,
     lineHeight: 1.6 }}>
     {AR_COVERAGE.filter((r) => r.owner === "BBH").length} further gaps are BBH-owned and
     are deliberately not on this list — the event staging store, the collapser, the
     quarantine, the submission registry and the payload store among them. Taking those
     to SEI would spend the meeting on work that is ours.
    </div>
   </div>);
 }

 /* ---------- Discussion (additive tab) ---------- */
 if (view === "DISC") {
  return <HubDiscussion t={t}
   onBack={() => setView("L1")}
   onOpenComponent={(id) => {
    const c = COMPS.find((x) => x.id === id);
    if (!c) return;
    setCont(c.container); setExpand(id); setView("L3");
   }} />;
 }

 /* ---------- L1: context + dashboard ---------- */
 const o = overall(null);
 const rows = COMPS.filter((c) =>
  (!dc || c.container === dc) &&
  (!dq || `${c.component} ${c.plane} ${c.id}`.toLowerCase().includes(dq.toLowerCase())));
 return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
    <span onClick={() => { setView("SEIBASE"); setExpand(null); }}
     style={{ fontSize: 10.5, fontWeight: 800, padding: "5px 14px",
      borderRadius: 999, cursor: "pointer", background: "#0f4775",
      color: "#fff" }}>
     ◆ the SEI baseline · {SEI_COMPONENTS.length} components · {SEI_OPEN.length} open with SEI</span>
    <span onClick={() => setView("XC")} style={{ marginLeft: "auto", fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#fdf1f2", color: "#cc3344", border: "1px solid #f0c9ce" }}>
     ⚠ cross-cutting · {AR_BOTTLENECKS.length} bottlenecks · {AR_ERRORS.length} error paths</span>
    <span onClick={() => setFlat(true)} style={{ fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#eef3f8", color: t.accent || "#0f4775" }}>
     ☰ all components (flat tracker)</span>
    <span onClick={() => setView("DISC")} style={{ fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#eef3f8", color: t.accent || "#0f4775" }}>
     💬 discussion · 108 questions</span>
   </div>
   <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 10, padding: 16, overflowX: "auto" }}>
    <svg viewBox="0 0 1280 590" style={{ minWidth: 880, display: "block" }}>
     <Defs />
     <g><circle cx="640" cy="42" r="14" fill="#08427b" />
      <rect x="570" y="58" width="140" height="52" rx="8" fill="#08427b" />
      <text x="640" y="78" fontSize="11" fontWeight="700" fill="#fff"
       textAnchor="middle">CP Data Ops</text>
      <text x="640" y="92" fontSize="8" fill="#b8c9dd" textAnchor="middle">
       runs batch · quarantine · overrides</text></g>
     <Sys x={60} y={150} w={190} label="SEI SDC Event Hub"
      sub="PRIMARY · intraday + EOD|4-field envelope · micro-batch boxed" kind="ext" />
     <Sys x={60} y={300} w={190} label="SEI SWP Platform"
      sub="STANDBY files + LOADERS|generated and held · 16 loaders back" kind="ext" />
     <Sys x={60} y={440} w={190} label="SEI SWP APIs" sub="real-time source" kind="ext" />
     <Sys x={480} y={250} w={320} label="CP INTEGRATION HUB"
      sub={`events → Stage 1 → STG → INT → Gold → publish|inbound + OUTBOUND lanes|▼ CLICK TO OPEN · ${COMPS.length} components · ${COMPS.filter((c) => c.isNew).length} missing`}
      onClick={() => setView("L2")} />
     <Sys x={1010} y={120} w={210} label="PBDW" sub="SYSTEM OF RECORD · existing" />
     <Sys x={1010} y={240} w={210} label="Pivotal DB" sub="existing" />
     <Sys x={1010} y={345} w={210} label="IMDS" sub="existing" />
     <Sys x={1010} y={460} w={210} label="CP DW Canonical" sub="not built this phase" kind="fut" />
     <Ortho pts={[[250,186],[350,186],[350,262],[480,262]]} label="SDC events [primary · continuous]" kind="rt" thick lx={372} ly={200} />
     <Ortho pts={[[250,330],[320,330],[320,276],[480,276]]} label="files [standby only]" lx={392} ly={266} />
     <Ortho pts={[[480,308],[288,308],[288,352],[250,352]]} label="loaders · submit + push/poll" kind="out" lx={384} ly={322} />
     <Ortho pts={[[250,465],[380,465],[380,312],[480,312]]} label="APIs via Gateway" kind="rt" lx={386} ly={410} />
     <Ortho pts={[[640,110],[640,250]]} label="operates · approves" kind="ctl" lx={700} ly={180} />
     <Ortho pts={[[800,262],[860,262],[860,145],[1010,145]]} label="" kind="move" />
     <Ortho pts={[[800,275],[905,275],[905,265],[1010,265]]} label="publish [movement only]" kind="move" lx={905} ly={296} />
     <Ortho pts={[[800,288],[880,288],[880,370],[1010,370]]} label="" kind="move" />
     <Ortho pts={[[800,302],[920,302],[920,485],[1010,485]]} label="forward-compatible only" kind="fut" lx={920} ly={430} />
     <Ortho pts={[[680,480],[680,339]]} label="outbound producers [AD-11]" kind="out" lx={762} ly={410} />
     <Sys x={545} y={480} w={270} label="PBDW · IMDS · Pivotal · Bloomberg"
      sub="outbound producers · via Hub only" kind="fut" />
    </svg>
   </div>
   {/* dashboard */}
   <div style={{ fontSize: 15, fontWeight: 700, color: t.navy || "#10193b",
    margin: "22px 0 4px" }}>Component delivery dashboard</div>
   <div style={{ fontSize: 10.5, color: t.sub || "#666", marginBottom: 10 }}>
    status + % editable · {live ? "● shared — Oracle component_status" : "○ local only — API offline, browser cache"} · CSV export</div>
   <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 10, overflow: "hidden" }}>
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
     background: t.navy || "#10193b", color: "#fff", padding: "13px 18px" }}>
     <div style={{ textAlign: "center" }}><b style={{ fontSize: 25 }}>{o.avg}%</b>
      <div style={{ fontSize: 9, color: "#a9c1de" }}>overall completion</div></div>
     <div style={{ textAlign: "center" }}><b style={{ fontSize: 25 }}>{o.done}</b>
      <div style={{ fontSize: 9, color: "#a9c1de" }}>of {o.n} complete</div></div>
     <div style={{ flex: 1, minWidth: 240, display: "grid",
      gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
      {Object.keys(CONTAINERS).map((k) => {
       const ov = overall(k);
       return (
        <div key={k}><div style={{ fontSize: 8, color: "#a9c1de" }}>
          {CONTAINERS[k][1]} {ov.avg}%</div>
         <div style={{ height: 5, background: "#2a3a6a", borderRadius: 99,
          marginTop: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${ov.avg}%`,
           background: t.pop || "#31bced" }} /></div></div>);
      })}
     </div>
     <span onClick={exportCsv} style={{ cursor: "pointer", fontSize: 10,
      fontWeight: 800, background: "#fff", color: t.navy || "#10193b",
      borderRadius: 5, padding: "6px 11px" }}>⬇ export CSV</span>
     <span onClick={() => { setStoreState({}); try { localStorage.removeItem("cp360-hub-status"); } catch (e) {} }} style={{ cursor: "pointer", fontSize: 10,
      fontWeight: 800, background: "#2a3a6a", color: "#a9c1de", borderRadius: 5,
      padding: "6px 11px" }}>↺ reset</span>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 15px",
     borderBottom: "1px solid #eef1f4", flexWrap: "wrap" }}>
     <select value={dc} onChange={(e) => setDc(e.target.value)}
      style={{ height: 28, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderRadius: 4, fontSize: 11 }}>
      <option value="">all containers</option>
      {Object.keys(CONTAINERS).map((k) => (
       <option key={k} value={k}>{CONTAINERS[k][0]}</option>))}
     </select>
     <span style={{ fontSize: 9.5, color: t.sub || "#666" }}>{rows.length} shown</span>
     <input placeholder="Search component…" value={dq}
      onChange={(e) => setDq(e.target.value)}
      style={{ marginLeft: "auto", height: 28, width: 210,
       border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 4,
       fontSize: 11, padding: "0 8px" }} />
    </div>
    {rows.map((c) => {
     const sx = stOf(c), col = STCOL[sx.status] || "#9aa7b2";
     return (
      <div key={c.id} style={{ display: "grid",
       gridTemplateColumns: "34px minmax(0,1.25fr) 110px minmax(0,1fr) 128px 70px 20px",
       gap: 10, padding: "7px 15px", fontSize: 11, borderTop: "1px solid #f2f5f7",
       alignItems: "center" }}>
       <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
        fontWeight: 700, color: Z_C[c.zone] || "#888" }}>{c.id}</span>
       <b style={{ color: t.navy || "#10193b", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.component}>
        {c.component}</b>
       <span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 999,
        padding: "2px 8px", background: "#eef3f8", color: t.accent || "#0f4775",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textAlign: "center" }}>{CONTAINERS[c.container][1]} {CONTAINERS[c.container][0]}</span>
       <span style={{ height: 9, background: "#eef1f4", borderRadius: 99,
        overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${sx.pct}%`,
         background: col, borderRadius: 99, transition: "width .2s" }} /></span>
       <select value={sx.status}
        onChange={(e) => setStore({ ...store, [c.id]:
         { status: e.target.value, pct: STPCT[e.target.value] } }, c.id)}
        style={{ height: 24, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
         borderRadius: 4, fontSize: 10, width: "100%" }}>
        {STATUSES.map((x) => <option key={x}>{x}</option>)}
       </select>
       <input type="number" min="0" max="100" value={sx.pct}
        onChange={(e) => setStore({ ...store, [c.id]:
         { ...(store[c.id] || { status: sx.status }),
           pct: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) } }, c.id)}
        style={{ width: "100%", height: 24, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
         borderRadius: 4, fontSize: 10.5, padding: "0 5px", textAlign: "right",
         fontFamily: "Roboto Mono, monospace" }} />
       <span style={{ fontSize: 8, color: "#a8560f", fontWeight: 800 }}>
        {sx.edited ? "●" : ""}</span>
      </div>);
    })}
   </div>
  </div>);
}
