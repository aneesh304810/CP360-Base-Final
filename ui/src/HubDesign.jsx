import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { TRACKER_COMPONENTS } from "./seiDesignTracker.js";
import DocDrill, { DOCS, DEFAULT_DOC, docFor } from "./DocDrill.jsx";
import SeiDesignPack from "./SeiDesignPack.jsx";
import HubArchitectReview from "./HubArchitectReview.jsx";

// =====================================================================
// HubDesign — the CP Integration Hub route: C4 landing (L1 context +
// delivery dashboard) → L2 containers → L3 components → L4 DocDrill.
// The mockup hub_design_c4_mockup.html is the acceptance spec.
// =====================================================================

const contOf = (c) => {
 if (c.zone === "1. SEI") return "EXT";
 if (c.zone === "3. Consumers") return "CONS";
 if (c.zone === "4. OpenShift") return "PLAT";
 return { "Ingress/Egress": "IE", Processing: "PROC", Orchestration: "ORCH",
  "Data Quality": "DQ", Foundation: "FND" }[c.plane] || "FND";
};
const COMPS = TRACKER_COMPONENTS.map((c) => ({ ...c, container: contOf(c) }));
const CONTAINERS = {
 IE: ["Ingress / Egress", "📥", "Landing+Transport · Sensors · Outbound Producers · Apigee · Gateway"],
 PROC: ["Processing", "🧪", "Python Ingestion · RAW · Stage 2 dbt · Gold dbt · Corrections"],
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
 const [flat, setFlat] = useState(false);       // "all components" flat tracker

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
 const Defs = () => (
  <defs><marker id="hubarr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8"
   markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#555" /></marker>
   <style>{`@keyframes hubdash{to{stroke-dashoffset:-13}}
    .hub-flow{stroke-dasharray:7 6;animation:hubdash 1.2s linear infinite}
    .hub-fast{animation-duration:.8s}
    .hub-still{stroke-dasharray:5 6}`}</style></defs>);

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
    </div>
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
     overflow: "hidden", background: "#fff" }}>
     {rows.map((c) => {
      const dk = docFor(c), d = DOCS[dk], sx = stOf(c);
      const lab = d.chip || (d.default ? "Arch" : d.id === "l2-planes" ? "Planes"
       : d.id === "l3-stages" ? "Stage 1/2" : d.id === "l3-errors" ? "Errors" : d.title);
      return (
       <div key={c.id} style={{ display: "grid",
        gridTemplateColumns: "34px minmax(0,1.2fr) minmax(0,1.5fr) 90px 128px",
        gap: 10, padding: "8px 14px", fontSize: 11, borderTop: "1px solid #eef1f4",
        alignItems: "center" }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
         fontWeight: 700, color: Z_C[c.zone] || "#888" }}>{c.id}</span>
        <b style={{ color: t.navy || "#10193b", overflow: "hidden",
         textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.component}>
         {c.component}</b>
        <span style={{ fontSize: 10, color: t.sub || "#666", overflow: "hidden",
         textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.deliverable}>
         {c.deliverable}</span>
        <span>{chip((STCOL[sx.status] || "#eef1f4") + "22",
         STCOL[sx.status] || "#8a97a3", `${sx.status.toUpperCase()} · ${sx.pct}%`)}</span>
        <span onClick={() => setDoc({ key: dk, from: c })}
         style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
          background: d.bg, color: d.color, border: `1px solid ${d.color}`,
          cursor: "pointer", textAlign: "center", whiteSpace: "nowrap" }}>
         {d.icon} {lab} →</span>
       </div>);
     })}
    </div>
   </div>);
 }

 /* ---------- L2 ---------- */
 if (view === "L2") {
  const openC = (key) => {
   const c = COMPS.find((x) => x.component.toLowerCase().includes(key));
   if (!c) return;
   setCont(c.container);
   setDoc({ key: docFor(c), from: c });
  };
  const Mini = ({ x, y, w, label, cyl, k }) => {
   const c = k ? COMPS.find((z) => z.component.toLowerCase().includes(k)) : null;
   const sx = c ? stOf(c) : null;
   return (
    <g onClick={k ? () => openC(k) : undefined}
     style={k ? { cursor: "pointer" } : undefined}>
     <rect x={x} y={y} width={w} height={24} rx={cyl ? 11 : 4}
      fill={cyl ? "#0d5296" : "#1168bd"} />
     <text x={x + w / 2} y={y + 15} fontSize="8.5" fontWeight="600" fill="#fff"
      textAnchor="middle">{label}</text>
     {sx && <circle cx={x + w - 9} cy={y + 7} r="4"
      fill={STCOL[sx.status] || "#9aa7b2"} stroke="#fff" strokeWidth="1.2">
      <title>{`${c.component} — ${sx.status} · ${sx.pct}%`}</title></circle>}
    </g>);
  };
  const Grp = ({ x, y, w, h: gh, k }) => (
   <g onClick={() => { setCont(k); setView("L3"); }} style={{ cursor: "pointer" }}>
    <rect x={x} y={y} width={w} height={gh} rx="9" fill="#f4f8fb" stroke="#7fa8c9"
     strokeDasharray="5 4" strokeWidth="1.3" />
    <text x={x + 12} y={y + 18} fontSize="10.5" fontWeight="800" fill="#0f4775">
     {CONTAINERS[k][1]} {CONTAINERS[k][0]}</text>
    <text x={x + w - 10} y={y + 18} fontSize="8.5" fontWeight="800" fill="#5c7c94"
     textAnchor="end">▼ {cnt(k)} components · {overall(k).avg}%</text>
    <rect x={x + w - 104} y={y + 24} width="94" height="4" rx="2" fill="#dde6ee" />
    <rect x={x + w - 104} y={y + 24} width={Math.round((94 * overall(k).avg) / 100)}
     height="4" rx="2" fill={overall(k).avg === 100 ? "#159943" : "#31bced"} /></g>);
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <span onClick={() => setView("L1")} style={{ fontSize: 11.5, fontWeight: 700,
     padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
     color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
     ← context + dashboard</span>
    <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 10, padding: 16, overflowX: "auto" }}>
     <svg viewBox="0 0 1280 840" style={{ minWidth: 880, display: "block" }}>
      <Defs />
      <rect x="196" y="24" width="820" height="786" rx="10" fill="none"
       stroke="#1168bd" strokeDasharray="8 5" strokeWidth="1.5" />
      <text x="214" y="46" fontSize="11" fontWeight="800" fill="#1168bd">
       CP INTEGRATION HUB — plane groups · click a group for its components</text>
      <Grp x={250} y={58} w={742} h={92} k="ORCH" />
      <Mini x={262} y={108} w={138} label="DAG + Fan-out" k="fan-out" />
      <Mini x={408} y={108} w={138} label="Dim-before-Fact" k="dim-before" />
      <Mini x={554} y={108} w={130} label="Intraday Cadence" k="intraday" />
      <Mini x={692} y={108} w={130} label="Replay / Rerun" k="replay" />
      <Mini x={830} y={108} w={150} label="Partial-Batch Policy" k="partial" />
      <Sys x={24} y={330} w={150} label="SEI SWP" sub="batch + APIs|+ loader endpoint"
       kind="ext" onClick={() => { setCont("EXT"); setView("L3"); }} />
      <Grp x={216} y={180} w={190} h={440} k="IE" />
      <Mini x={230} y={214} w={162} label="Landing + Transport" k="landing" />
      <Mini x={230} y={252} w={162} label="File Arrival Sensors" k="arrival" />
      <Mini x={230} y={330} w={162} label="API Gateway / Data Plane" k="gateway" />
      <Mini x={230} y={368} w={162} label="Apigee Proxy" k="apigee" />
      <Mini x={230} y={520} w={162} label="Outbound Producers" k="outbound produc" />
      <Grp x={446} y={180} w={240} h={440} k="PROC" />
      <Mini x={468} y={214} w={196} label="Python Ingestion Fwk" k="python ingestion" />
      <Mini x={468} y={268} w={196} label="Stage 1 RAW" cyl k="stage 1" />
      <Mini x={468} y={322} w={196} label="Correction Handling · AD-2" k="correction" />
      <Mini x={468} y={376} w={196} label="Stage 2 Enriched · dbt" cyl k="stage 2" />
      <Mini x={468} y={440} w={196} label="Pre-Gold Exadata · dbt" cyl k="gold" />
      <Rel x1={566} y1={238} x2={566} y2={268} label="" />
      <Rel x1={566} y1={292} x2={566} y2={322} label="" />
      <Rel x1={566} y1={346} x2={566} y2={376} label="" />
      <Rel x1={566} y1={400} x2={566} y2={440} label="" />
      <Grp x={726} y={180} w={180} h={440} k="DQ" />
      <Mini x={740} y={214} w={152} label="G1 Structural" k="g1" />
      <Mini x={740} y={252} w={152} label="G2 RAW Profiling" k="g2" />
      <Mini x={740} y={290} w={152} label="G3 dbt + Business" k="g3" />
      <Mini x={740} y={328} w={152} label="G4 Tie-out" k="g4" />
      <Mini x={740} y={366} w={152} label="G5 Post-Publish Recon" k="g5" />
      <Mini x={740} y={404} w={152} label="DQ Framework" k="dq framework" />
      <Grp x={250} y={712} w={742} h={82} k="FND" />
      <Mini x={258} y={756} w={96} label="Errors/Quar." k="error" />
      <Mini x={360} y={756} w={80} label="Recon Fwk" k="reconcil" />
      <Mini x={446} y={756} w={96} label="Audit/Lineage" k="audit" />
      <Mini x={548} y={756} w={74} label="Security" k="security" />
      <Mini x={628} y={756} w={110} label="Metadata/Config" k="metadata" />
      <Mini x={744} y={756} w={96} label="Observability" k="observab" />
      <Mini x={846} y={756} w={90} label="Integration360" k="integration360" />
      <Mini x={942} y={756} w={44} label="SSO" k="sso" />
      <Sys x={1050} y={320} w={206} label="PBDW · IMDS · Pivotal"
       sub={`FINAL GOLD · consumers + producers|▼ ${cnt("CONS")} components`}
       onClick={() => { setCont("CONS"); setView("L3"); }} />
      <Sys x={1050} y={712} w={206} label={CONTAINERS.PLAT[0]}
       sub={`runtime · CI/CD · ops|▼ ${cnt("PLAT")} components`}
       onClick={() => { setCont("PLAT"); setView("L3"); }} />
      <Ortho pts={[[174,352],[200,352],[200,226],[230,226]]} label="feeds + manifest" lx={187} ly={300} />
      <Ortho pts={[[174,375],[212,375],[212,342],[230,342]]} label="APIs in" kind="rt" lx={205} ly={395} />
      <Ortho pts={[[392,264],[426,264],[426,226],[468,226]]} label="accepted" lx={428} ly={250} />
      <Ortho pts={[[740,264],[700,264],[700,280],[664,280]]} label="intake G1·G2" kind="gate" lx={703} ly={246} />
      <Ortho pts={[[740,302],[712,302],[712,388],[664,388]]} label="in dbt G3" kind="gate" lx={712} ly={415} />
      <Ortho pts={[[740,340],[724,340],[724,452],[676,452]]} label="blocks publish G4 [AD-9]" kind="gate" lx={790} ly={475} />
      <Ortho pts={[[892,378],[1050,378]]} label="post-publish G5" kind="gate" lx={975} ly={368} />
      <Ortho pts={[[566,464],[566,682],[1153,682],[1153,430]]} label="Pre-Gold → publish final Gold [movement]" kind="move" thick lx={880} ly={694} />
      <Ortho pts={[[392,348],[420,348],[420,640],[1130,640],[1130,430]]} label="consumer APIs" kind="rt" lx={900} ly={630} />
      <Ortho pts={[[1050,415],[1004,415],[1004,662],[350,662],[350,544]]} label="outbound · consumers as producers [AD-11]" kind="out" lx={690} ly={652} />
      <Ortho pts={[[230,532],[99,532],[99,415]]} label="submission/ack [AD-11]" kind="out" lx={164} ly={554} />
      <Ortho pts={[[621,150],[621,165],[566,165],[566,180]]} label="orchestrates" kind="ctl" lx={660} ly={166} />
      <Ortho pts={[[500,712],[500,620]]} label="drives · config" kind="ctl" lx={548} ly={676} />
     </svg>
     <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 9.5,
      color: "#5c6b7a", flexWrap: "wrap" }}>
      {STATUSES.map((k) => (
       <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%",
         background: STCOL[k], display: "inline-block" }} />{k}</span>))}
      <span>dot on each component = delivery status (edit on the L1 dashboard)</span>
     </div>
    </div>
   </div>);
 }

 /* ---------- Architect review ---------- */
 if (view === "REVIEW")
  return (
   <div>
    <SectionHeader t={t}>CP Integration Hub</SectionHeader>
    <HubArchitectReview t={t} onBack={
     <span onClick={() => setView("L1")} style={{ fontSize: 11.5, fontWeight: 700,
      padding: "7px 16px", borderRadius: 5, background: t.navy || "#10193b",
      color: "#fff", cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
      ← context + dashboard</span>} />
   </div>);

 /* ---------- L1: context + dashboard ---------- */
 const o = overall(null);
 const rows = COMPS.filter((c) =>
  (!dc || c.container === dc) &&
  (!dq || `${c.component} ${c.plane} ${c.id}`.toLowerCase().includes(dq.toLowerCase())));
 return (
  <div>
   <SectionHeader t={t}>CP Integration Hub</SectionHeader>
   <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
    <span onClick={() => setView("REVIEW")} style={{ marginLeft: "auto", fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#fdf1f2", color: "#cc3344", border: "1px solid #f0c9ce" }}>
     ⚠ architect review · events-primary</span>
    <span onClick={() => setFlat(true)} style={{ fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#eef3f8", color: t.accent || "#0f4775" }}>
     ☰ all components (flat tracker)</span>
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
     <Sys x={60} y={200} w={190} label="SEI SWP Platform"
      sub="batch extracts + LOADERS|~30 feeds in · 16 loaders back" kind="ext" />
     <Sys x={60} y={420} w={190} label="SEI SWP APIs" sub="real-time source" kind="ext" />
     <Sys x={480} y={250} w={320} label="CP INTEGRATION HUB"
      sub={`Landing → RAW → Enriched → Gold → publish|inbound + OUTBOUND lanes|▼ CLICK TO OPEN · ${COMPS.length} components`}
      onClick={() => setView("L2")} />
     <Sys x={1010} y={120} w={210} label="PBDW" sub="SYSTEM OF RECORD · existing" />
     <Sys x={1010} y={240} w={210} label="Pivotal DB" sub="existing" />
     <Sys x={1010} y={345} w={210} label="IMDS" sub="existing" />
     <Sys x={1010} y={460} w={210} label="CP DW Canonical" sub="not built this phase" kind="fut" />
     <Ortho pts={[[250,225],[300,225],[300,270],[480,270]]} label="sFTP feeds + manifest [EOD]" lx={368} ly={258} />
     <Ortho pts={[[480,300],[330,300],[330,240],[250,240]]} label="16 loaders · submission/ack [AD-11]" kind="out" lx={392} ly={314} />
     <Ortho pts={[[250,445],[360,445],[360,315],[480,315]]} label="APIs via Gateway [no batch dep]" kind="rt" lx={368} ly={398} />
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
