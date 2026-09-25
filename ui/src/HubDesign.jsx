import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { TRACKER_COMPONENTS } from "./seiDesignTracker.js";
import DocDrill, { DOCS, DEFAULT_DOC, docFor } from "./DocDrill.jsx";
import SeiDesignPack from "./SeiDesignPack.jsx";
import { HUB_EVENT_COMPONENTS } from "./hubEventComponents.js";
import { AR_FINDINGS, AR_VERDICTS, AR_ASSUMPTIONS, AR_BOTTLENECKS, AR_ERRORS }
 from "./hubArchitectReview.js";

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
const newIn = (k) => COMPS.filter((c) => c.container === k && c.isNew).length;
const findIn = (k) => COMPS.filter((c) => c.container === k && FIND[c.id]).length;
const CONTAINERS = {
 EVT: ["Event Ingestion", "⚡", "listener · staging · collapse · pull · micro-batch registry · quarantine"],
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
 const [expand, setExpand] = useState(null);    // L3 component detail panel

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
     {newIn(cont) > 0 && (
      <div style={{ textAlign: "center", fontSize: 10, color: "#f0b7bd" }}>
       <b style={{ display: "block", fontSize: 20, color: "#ff9ba4" }}>{newIn(cont)}</b>
       missing</div>)}
     {findIn(cont) > 0 && (
      <div style={{ textAlign: "center", fontSize: 10, color: "#f3d3a8" }}>
       <b style={{ display: "block", fontSize: 20, color: "#ffc477" }}>{findIn(cont)}</b>
       affected</div>)}
    </div>
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
     overflow: "hidden", background: "#fff" }}>
     {rows.map((c) => {
      const dk = docFor(c), d = DOCS[dk], sx = stOf(c);
      const lab = d.chip || (d.default ? "Arch" : d.id === "l2-planes" ? "Planes"
       : d.id === "l3-stages" ? "Stage 1/2" : d.id === "l3-errors" ? "Errors" : d.title);
      const f = FIND[c.id];
      const hasPanel = c.isNew || !!f;
      const vc = c.isNew ? "#cc3344" : f ? (AR_VERDICTS[f.verdict] || ["#5c7c94"])[0] : null;
      const vt = c.isNew ? "NEW · MISSING" : f ? f.verdict.toUpperCase() : null;
      const isX = expand === c.id;
      return (
       <div key={c.id} style={{ borderTop: "1px solid #eef1f4",
        background: isX ? "#fafcfe" : undefined }}>
        <div style={{ display: "grid",
         gridTemplateColumns: "34px minmax(0,1.15fr) minmax(0,1.4fr) 104px 90px 128px",
         gap: 10, padding: "8px 14px", fontSize: 11, alignItems: "center",
         cursor: hasPanel ? "pointer" : "default" }}
         onClick={hasPanel ? () => setExpand(isX ? null : c.id) : undefined}>
         <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
          fontWeight: 700, color: c.isNew ? "#cc3344" : Z_C[c.zone] || "#888" }}>
          {hasPanel ? (isX ? "− " : "+ ") : ""}{c.id}</span>
         <b style={{ color: t.navy || "#10193b", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.component}>
          {c.component}</b>
         <span style={{ fontSize: 10, color: t.sub || "#666", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.deliverable}>
          {c.deliverable}</span>
         <span>{vt ? chip(vc + "1f", vc, vt) : null}</span>
         <span>{chip((STCOL[sx.status] || "#eef1f4") + "22",
          STCOL[sx.status] || "#8a97a3", `${sx.status.toUpperCase()} · ${sx.pct}%`)}</span>
         <span onClick={(e) => { e.stopPropagation(); setDoc({ key: dk, from: c }); }}
          style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
           background: d.bg, color: d.color, border: `1px solid ${d.color}`,
           cursor: "pointer", textAlign: "center", whiteSpace: "nowrap" }}>
          {d.icon} {lab} →</span>
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
         </div>)}
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
     <svg viewBox="0 0 1240 1070" style={{ minWidth: 940, display: "block" }}>
      <Defs />
      <rect x="196" y="24" width="740" height="1016" rx="10" fill="none"
       stroke="#1168bd" strokeDasharray="8 5" strokeWidth="1.5" />
      <text x="212" y="46" fontSize="10.5" fontWeight="800" fill="#1168bd">
       CP INTEGRATION HUB · zone 2</text>

      {/* orchestration band */}
      <text x="216" y="96" fontSize="9.5" fontWeight="800" fill="#0f4775">
       🛠 Orchestration · {cnt("ORCH")} components</text>
      <Mini x={216} y={108} w={94} label="DAG Fan-out" k="fan-out" />
      <Mini x={317} y={108} w={94} label="Dim→Fact" k="dim-before" />
      <Mini x={418} y={108} w={94} label="Intraday Cadence" k="intraday cadence" />
      <Mini x={519} y={108} w={94} label="Replay / Rerun" k="replay" />
      <Mini x={620} y={108} w={94} label="Partial-Batch" k="partial" />
      <Mini x={721} y={108} w={94} label="Gate Evaluator" k="gate evaluator" />
      <Mini x={822} y={108} w={94} label="Status Poller" k="status poller" />

      {/* external sources */}
      <Sys x={24} y={250} w={150} label="SDC Event Hub"
       sub="PRIMARY · 4-field envelope|micro-batch boxed" kind="ext" />
      <Sys x={24} y={430} w={150} label="SEI source views"
       sub="current state only|read by the pull" kind="ext" />
      <Sys x={24} y={740} w={150} label="SEI SWP"
       sub="STANDBY files|+ loader endpoint" kind="ext"
       onClick={() => { setCont("EXT"); setView("L3"); }} />

      {/* event ingestion */}
      <Grp x={212} y={180} w={214} h={470} k="EVT" />
      <Mini x={222} y={214} w={190} label="SDC Event Listener" k="event listener" />
      <Mini x={222} y={250} w={190} label="G0 Envelope Gate" k="envelope gate" />
      <Mini x={222} y={286} w={190} label="Event Staging Store" cyl k="event staging" />
      <Mini x={222} y={322} w={190} label="Micro-Batch Registry" cyl k="micro-batch registry" />
      <Mini x={222} y={358} w={190} label="Key-Set Collapser" k="key-set collapser" />
      <Mini x={222} y={394} w={190} label="Idempotency Service" k="idempotency" />
      <Mini x={222} y={430} w={190} label="Domain Sequencer" k="domain sequencer" />
      <Mini x={222} y={466} w={190} label="Set-Based Puller" k="set-based puller" />
      <Mini x={222} y={502} w={190} label="Intraday Stage-1 Loader" k="intraday stage-1" />
      <Mini x={222} y={538} w={190} label="Event Quarantine" k="event quarantine" />
      <Mini x={222} y={574} w={190} label="Sequence Gap Detector" k="sequence gap" />
      <Mini x={222} y={610} w={190} label="Consumer Lag Monitor" k="consumer lag" />

      {/* file ingress, now standby, plus the outbound loop */}
      <Grp x={212} y={672} w={214} h={248} k="IE" />
      <Mini x={222} y={702} w={190} label="Landing + Transport" k="landing" />
      <Mini x={222} y={729} w={190} label="File Arrival Sensors" k="arrival" />
      <Mini x={222} y={756} w={190} label="API Gateway" k="gateway" />
      <Mini x={222} y={783} w={190} label="Apigee Proxy" k="apigee" />
      <Mini x={222} y={810} w={190} label="Outbound Producers" k="outbound produc" />
      <Mini x={222} y={837} w={190} label="Loader Payload Store" cyl k="loader payload" />
      <Mini x={222} y={864} w={190} label="Callback Receiver" k="callback receiver" />
      <Mini x={222} y={891} w={190} label="Submission Registry" cyl k="submission registry" />

      {/* processing */}
      <Grp x={444} y={180} w={226} h={470} k="PROC" />
      <Mini x={454} y={214} w={200} label="Python Ingestion Fwk" k="python ingestion" />
      <Mini x={454} y={280} w={200} label="Stage 1 RAW" cyl k="stage 1" />
      <Mini x={454} y={346} w={200} label="Correction Handling" k="correction" />
      <Mini x={454} y={412} w={200} label="Stage 2 Enriched · dbt" cyl k="stage 2" />
      <Mini x={454} y={478} w={200} label="Pre-Gold Exadata · dbt" cyl k="gold" />
      <Rel x1={554} y1={238} x2={554} y2={280} label="" />
      <Rel x1={554} y1={304} x2={554} y2={346} label="" />
      <Rel x1={554} y1={370} x2={554} y2={412} label="" />
      <Rel x1={554} y1={436} x2={554} y2={478} label="" />

      {/* data quality */}
      <Grp x={688} y={180} w={232} h={470} k="DQ" />
      <Mini x={700} y={214} w={208} label="G1 Structural" k="g1" />
      <Mini x={700} y={250} w={208} label="G2 RAW Profiling" k="g2" />
      <Mini x={700} y={286} w={208} label="G3 dbt + Business" k="g3" />
      <Mini x={700} y={322} w={208} label="G4 Tie-out" k="g4" />
      <Mini x={700} y={358} w={208} label="G5 Post-Publish Recon" k="g5" />
      <Mini x={700} y={394} w={208} label="DQ Framework" k="dq framework" />
      <Mini x={700} y={430} w={208} label="G6 Outbound Validation" k="g6 outbound" />
      <Mini x={700} y={466} w={208} label="Outbound Reconciliation" k="outbound reconcil" />
      <text x="700" y="514" fontSize="8" fontStyle="italic" fill="#a8560f">
       G0/G1/G3 per micro-batch · G2/G4/G5 at the EOD gate only</text>
      <text x="700" y="528" fontSize="8" fontStyle="italic" fill="#a8560f">
       running the set-level gates per box is 288× a day [B5]</text>
      <text x="700" y="548" fontSize="8" fontStyle="italic" fill="#cc3344">
       G1–G5 all face inbound. G6 is the only gate before a loader</text>
      <text x="700" y="562" fontSize="8" fontStyle="italic" fill="#cc3344">
       reaches SEI — today SEI is the first validator [E13]</text>
      <text x="700" y="582" fontSize="8" fontStyle="italic" fill="#a8560f">
       G6 blocks Outbound Producers; the payload is recorded</text>
      <text x="700" y="596" fontSize="8" fontStyle="italic" fill="#a8560f">
       before the send, never after [E14]</text>

      {/* foundation */}
      <Grp x={212} y={930} w={708} h={110} k="FND" />
      <Mini x={222} y={968} w={96} label="Errors/Quar." k="error handling" />
      <Mini x={326} y={968} w={82} label="Recon Fwk" k="reconcil" />
      <Mini x={416} y={968} w={96} label="Audit/Lineage" k="audit" />
      <Mini x={520} y={968} w={74} label="Security" k="security" />
      <Mini x={602} y={968} w={112} label="Metadata/Config" k="metadata" />
      <Mini x={722} y={968} w={96} label="Observability" k="observab" />
      <Mini x={826} y={968} w={84} label="Integr.360" k="integration360" />
      <Mini x={222} y={1000} w={44} label="SSO" k="sso" />
      <Mini x={274} y={1000} w={150} label="Schema Contract Registry" k="schema contract" />
      <Mini x={432} y={1000} w={128} label="Expectation Store" cyl k="expectation store" />
      <Mini x={568} y={1000} w={150} label="Loader Template Registry" cyl k="loader template" />
      <Mini x={726} y={1000} w={150} label="Outbound Quarantine" k="outbound quarantine" />

      {/* consumers + platform */}
      <Sys x={970} y={300} w={210} label="PBDW · IMDS · Pivotal"
       sub={`FINAL GOLD · consumers|▼ ${cnt("CONS")} components`}
       onClick={() => { setCont("CONS"); setView("L3"); }} />
      <Sys x={970} y={930} w={210} label={CONTAINERS.PLAT[0]}
       sub={`runtime · CI/CD · ops|▼ ${cnt("PLAT")} components`}
       onClick={() => { setCont("PLAT"); setView("L3"); }} />

      {/* relationships */}
      <Ortho pts={[[176,285],[212,285]]} label="events [primary]" lx={194} ly={272} />
      <Ortho pts={[[212,470],[192,470],[192,466],[176,466]]} label="set-based pull" lx={196} ly={500} />
      <Ortho pts={[[176,775],[212,775]]} label="files [standby]" lx={194} ly={762} />
      <Ortho pts={[[212,905],[190,905],[190,800],[176,800]]} label="submit · push + poll" kind="out" lx={186} ly={932} />
      <Ortho pts={[[426,514],[436,514],[436,292],[452,292]]} label="" />
      <text x="222" y="644" fontSize="8" fontStyle="italic" fill="#159943">
       one commit per micro-batch → Stage 1</text>
      <Ortho pts={[[426,712],[557,712],[557,654]]} label="standby load" lx={600} ly={706} />
      <Ortho pts={[[670,232],[688,232]]} label="" kind="gate" />
      <Ortho pts={[[688,300],[670,300]]} label="blocks publish [G4]" kind="gate" lx={672} ly={324} />
      <Ortho pts={[[554,652],[554,692],[952,692],[952,412],[968,412]]} label="publish final Gold" kind="move" thick lx={780} ly={686} />
      <Ortho pts={[[554,140],[554,178]]} label="orchestrates" kind="ctl" lx={606} ly={166} />
      <Ortho pts={[[566,928],[566,896]]} label="drives · config" kind="ctl" lx={620} ly={916} />
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
   </div>);
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
    <span onClick={() => setView("XC")} style={{ marginLeft: "auto", fontSize: 10.5,
     fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer",
     background: "#fdf1f2", color: "#cc3344", border: "1px solid #f0c9ce" }}>
     ⚠ cross-cutting · {AR_BOTTLENECKS.length} bottlenecks · {AR_ERRORS.length} error paths</span>
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
