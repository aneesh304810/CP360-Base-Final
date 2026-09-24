import React, { useState } from "react";
import { SectionHeader } from "./AppShell.jsx";
import {
 I360_SUMMARY, I360_PLANES, I360_COMPONENTS, I360_STATES, I360_PCT, I360_COLOR,
 I360_CHANNELS,
} from "./integration360Components.js";

// =====================================================================
// Integration360Design — the Integration360 route, built to the same
// C4 shape as HubDesign: L1 context + readiness → L2 plane groups →
// L3 components → detail. Read-only observability over BBH ↔ SEI.
// =====================================================================

const PLANE_KEYS = Object.keys(I360_PLANES);
const compsIn = (k) => I360_COMPONENTS.filter((c) => c.plane === k);
const readiness = (k) => {
 const rows = k ? compsIn(k) : I360_COMPONENTS;
 const tot = rows.reduce((a, c) => a + (I360_PCT[c.state] ?? 0), 0);
 return { avg: rows.length ? Math.round(tot / rows.length) : 0, n: rows.length,
  blocked: rows.filter((c) => c.state === "Blocked").length };
};

export default function Integration360Design({ t }) {
 const [view, setView] = useState("L1");
 const [plane, setPlane] = useState(null);
 const [open, setOpen] = useState(null);

 const navy = t.navy || "#10193b";
 const panel = t.panel2 || "#dfe6e9";
 const sub = t.sub || "#666";

 const chip = (bg, fg, txt, key) => (
  <span key={key} style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px",
   borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{txt}</span>);
 const stateChip = (s) => chip(`${I360_COLOR[s]}1f`, I360_COLOR[s], s.toUpperCase());
 const backBtn = (label, onClick) => (
  <span onClick={onClick} style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 16px",
   borderRadius: 5, background: navy, color: "#fff", cursor: "pointer",
   display: "inline-block", marginBottom: 12 }}>{label}</span>);

 /* ---------- shared SVG bits ---------- */
 const Defs = () => (
  <defs>
   <marker id="i360arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
    markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#5c7c94" /></marker>
   <marker id="i360acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
    markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#0e8f7e" /></marker>
  </defs>);
 const Box = ({ x, y, w, h = 52, label, sub: s, kind, onClick }) => {
  const fill = kind === "ext" ? "#f2eefa" : kind === "acc" ? "#e6f4f2"
   : kind === "mute" ? "#f6f8fa" : "#fff";
  const stroke = kind === "ext" ? "#6d3ac0" : kind === "acc" ? "#0e8f7e"
   : kind === "mute" ? "#b8c4ce" : "#1168bd";
  return (
   <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke}
     strokeWidth={kind === "acc" ? 2 : 1.4}
     strokeDasharray={kind === "mute" ? "5 4" : undefined} />
    <text x={x + w / 2} y={y + (s ? 22 : h / 2 + 4)} fontSize="11" fontWeight="700"
     fill="#10193b" textAnchor="middle">{label}</text>
    {s && <text x={x + w / 2} y={y + 37} fontSize="8.5" fill="#5c7c94"
     textAnchor="middle">{s}</text>}
   </g>);
 };
 const Line = ({ d, acc, dash, label, lx, ly }) => (
  <g>
   <path d={d} fill="none" stroke={acc ? "#0e8f7e" : "#5c7c94"}
    strokeWidth={acc ? 1.7 : 1.2} strokeDasharray={dash ? "4 4" : undefined}
    markerEnd={`url(#${acc ? "i360acc" : "i360arr"})`} />
   {label && <text x={lx} y={ly} fontSize="8.5" fontStyle="italic"
    fill={acc ? "#0e8f7e" : "#5c7c94"}>{label}</text>}
  </g>);

 /* ---------- L3 ---------- */
 if (view === "L3" && plane) {
  const P = I360_PLANES[plane];
  const rows = compsIn(plane);
  const rd = readiness(plane);
  return (
   <div>
    <SectionHeader t={t}>Integration360</SectionHeader>
    {backBtn("← planes", () => { setView("L2"); setOpen(null); })}
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: navy,
     color: "#fff", borderRadius: 10, padding: "14px 20px", marginBottom: 12 }}>
     <span style={{ fontSize: 24 }}>{P[1]}</span>
     <div><b>{P[0]}</b>
      {rd.blocked > 0 && <span style={{ marginLeft: 8 }}>
       {chip("#fae0e2", "#cc3344", `⚠ ${rd.blocked} blocked`)}</span>}
      <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>{P[2]}</div></div>
     <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
      color: "#a9c1de" }}><b style={{ display: "block", fontSize: 20,
      color: "#fff" }}>{rd.avg}%</b>design readiness</div>
     <div style={{ textAlign: "center", fontSize: 10, color: "#a9c1de" }}>
      <b style={{ display: "block", fontSize: 20, color: "#fff" }}>{rows.length}</b>
      components</div>
    </div>
    <div style={{ border: `1px solid ${panel}`, borderRadius: 8, overflow: "hidden",
     background: "#fff" }}>
     {rows.map((c) => {
      const isOpen = open === c.id;
      return (
       <div key={c.id} style={{ borderTop: "1px solid #eef1f4" }}>
        <div onClick={() => setOpen(isOpen ? null : c.id)}
         style={{ display: "grid",
          gridTemplateColumns: "58px minmax(0,1.1fr) minmax(0,1.4fr) 116px 18px",
          gap: 10, padding: "9px 14px", fontSize: 11, alignItems: "center",
          cursor: "pointer", background: isOpen ? "#f4f8fb" : "#fff" }}>
         <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
          fontWeight: 700, color: I360_COLOR[c.state] }}>{c.id}</span>
         <b style={{ color: navy, fontFamily: "Roboto Mono, monospace", fontSize: 11,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={c.component}>{c.component}</b>
         <span style={{ fontSize: 10, color: sub, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.deliverable}>
          {c.deliverable}</span>
         <span>{stateChip(c.state)}</span>
         <span style={{ fontSize: 10, color: "#8a97a3" }}>{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen && (
         <div style={{ padding: "2px 16px 14px 74px", background: "#f4f8fb" }}>
          <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.6,
           maxWidth: 760 }}>{c.detail}</div>
          {c.note && (
           <div style={{ marginTop: 8, fontSize: 11, color: "#33414d", lineHeight: 1.55,
            borderLeft: `2px solid ${I360_COLOR[c.state]}`, paddingLeft: 10,
            maxWidth: 760 }}>{c.note}</div>)}
         </div>)}
       </div>);
     })}
    </div>
   </div>);
 }

 /* ---------- L2 ---------- */
 if (view === "L2") {
  const Grp = ({ x, y, w, h, k }) => {
   const rd = readiness(k);
   return (
    <g onClick={() => { setPlane(k); setView("L3"); }} style={{ cursor: "pointer" }}>
     <rect x={x} y={y} width={w} height={h} rx="9" fill="#f4f8fb" stroke="#7fa8c9"
      strokeDasharray="5 4" strokeWidth="1.3" />
     <text x={x + 12} y={y + 18} fontSize="10.5" fontWeight="800" fill="#0f4775">
      {I360_PLANES[k][1]} {I360_PLANES[k][0]}</text>
     <text x={x + w - 10} y={y + 18} fontSize="8.5" fontWeight="800" fill="#5c7c94"
      textAnchor="end">▼ {rd.n} components · {rd.avg}%</text>
     <rect x={x + w - 104} y={y + 24} width="94" height="4" rx="2" fill="#dde6ee" />
     <rect x={x + w - 104} y={y + 24} width={Math.round((94 * rd.avg) / 100)}
      height="4" rx="2" fill={rd.blocked ? "#e0a13d" : "#159943"} /></g>);
  };
  const Chip = ({ x, y, w, label, k }) => {
   const c = compsIn(k).find((z) => z.component === label);
   return (
    <g onClick={() => { setPlane(k); setView("L3"); setOpen(c ? c.id : null); }}
     style={{ cursor: "pointer" }}>
     <rect x={x} y={y} width={w} height={24} rx="4" fill="#1168bd" />
     <text x={x + w / 2} y={y + 15} fontSize="8.5" fontWeight="600" fill="#fff"
      textAnchor="middle">{label}</text>
     {c && <circle cx={x + w - 8} cy={y + 7} r="4" fill={I360_COLOR[c.state]}
      stroke="#fff" strokeWidth="1.2"><title>{`${c.component} — ${c.state}`}</title>
      </circle>}
    </g>);
  };
  return (
   <div>
    <SectionHeader t={t}>Integration360</SectionHeader>
    {backBtn("← context + readiness", () => setView("L1"))}
    <div style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 10,
     padding: 16, overflowX: "auto" }}>
     <svg viewBox="0 0 1280 700" style={{ minWidth: 900, display: "block" }}>
      <Defs />
      <rect x="20" y="24" width="1240" height="656" rx="10" fill="none" stroke="#1168bd"
       strokeDasharray="8 5" strokeWidth="1.5" />
      <text x="38" y="46" fontSize="11" fontWeight="800" fill="#1168bd">
       INTEGRATION360 — planes · click a plane for its components</text>

      <Grp x={44} y={60} w={560} h={96} k="UI" />
      <Chip x={58} y={110} w={122} label="EstateBoard" k="UI" />
      <Chip x={188} y={110} w={132} label="EventChannelView" k="UI" />
      <Chip x={328} y={110} w={128} label="StandbyFileView" k="UI" />
      <Chip x={464} y={110} w={126} label="OutboundView" k="UI" />

      <Grp x={628} y={60} w={330} h={96} k="STORE" />
      <Chip x={642} y={110} w={150} label="int360_verdict_snapshot" k="STORE" />
      <Chip x={800} y={110} w={144} label="int360_rollup_daily" k="STORE" />

      <Grp x={44} y={182} w={560} h={150} k="RTR" />
      <Chip x={58} y={230} w={122} label="estate_router" k="RTR" />
      <Chip x={188} y={230} w={122} label="event_router" k="RTR" />
      <Chip x={318} y={230} w={122} label="file_router" k="RTR" />
      <Chip x={448} y={230} w={142} label="loader_router" k="RTR" />
      <Chip x={58} y={280} w={142} label="exception_router" k="RTR" />
      <Chip x={208} y={280} w={122} label="recon_router" k="RTR" />

      <Grp x={628} y={182} w={330} h={150} k="SVC" />
      <Chip x={642} y={230} w={150} label="correlation_service" k="SVC" />
      <Chip x={800} y={230} w={144} label="status_normalizer" k="SVC" />
      <Chip x={642} y={280} w={150} label="redactor" k="SVC" />

      <Grp x={44} y={358} w={560} h={150} k="ADP" />
      <Chip x={58} y={406} w={156} label="oracle_control_reader" k="ADP" />
      <Chip x={222} y={406} w={122} label="airflow_reader" k="ADP" />
      <Chip x={352} y={406} w={112} label="hub_reader" k="ADP" />
      <Chip x={472} y={406} w={118} label="inbox_reader" k="ADP" />
      <Chip x={58} y={456} w={150} label="dbt_results_reader" k="ADP" />
      <Chip x={216} y={456} w={162} label="landing_trailer_reader" k="ADP" />

      <Grp x={628} y={358} w={330} h={150} k="ENG" />
      <Chip x={642} y={406} w={150} label="verdict_computer" k="ENG" />
      <Chip x={800} y={406} w={144} label="gap_detector" k="ENG" />
      <Chip x={642} y={456} w={150} label="expectation_evaluator" k="ENG" />
      <Chip x={800} y={456} w={144} label="rollup_builder" k="ENG" />

      <Box x={1000} y={90} w={236} h={48} label="Oracle control schema"
       sub="registries · DQ · recon" kind="mute" />
      <Box x={1000} y={152} w={236} h={48} label="Airflow Postgres"
       sub="read replica only" kind="mute" />
      <Box x={1000} y={214} w={236} h={48} label="Hub exception store"
       sub="quarantine · errors" kind="mute" />
      <Box x={1000} y={276} w={236} h={48} label="dbt run results"
       sub="persisted to Oracle" kind="mute" />
      <Box x={1000} y={338} w={236} h={48} label="Landing zone"
       sub="trailer only · no load" kind="mute" />
      <Box x={1000} y={400} w={236} h={48} label="Callback inbox"
       sub="shared · SEI writes" kind="ext" />
      <text x="1118" y="470" fontSize="9" fill="#5c7c94" textAnchor="middle">
       six sources · no cross-database join</text>

      <Line d="M998,424 L962,424" acc label="consumes" lx={958} ly={412} />

      <Box x={44} y={548} w={280} h={52} label="Alert Dispatcher"
       sub="the only egress · blocked, no owner" kind="mute" />
      <Box x={628} y={548} w={330} h={52} label="BBH Operations"
       sub="reads · cannot act from within the tool" kind="acc" />
      <Line d="M700,508 L700,528 L184,528 L184,546" label="findings" lx={420} ly={522} />
     </svg>
     <div style={{ fontSize: 10, color: "#5c7c94", marginTop: 10, maxWidth: 900 }}>
      Routers and adapters read the six sources on the right; the Observation Engine
      consumes the callback inbox, writes verdicts and rollups to the INT360 store, and
      raises findings to the Alert Dispatcher. Operations reads the Web UI and cannot act
      from within the tool.
     </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
     gap: 8, marginTop: 12 }}>
     {PLANE_KEYS.map((k) => {
      const rd = readiness(k);
      return (
       <div key={k} onClick={() => { setPlane(k); setView("L3"); }}
        style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 8,
         padding: "10px 12px", cursor: "pointer" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: navy }}>
         {I360_PLANES[k][1]} {I360_PLANES[k][0].split(" · ")[1] || I360_PLANES[k][0]}</div>
        <div style={{ fontSize: 9.5, color: sub, marginTop: 3 }}>
         {rd.n} components · {rd.blocked} blocked</div>
       </div>);
     })}
    </div>
   </div>);
 }

 /* ---------- L1 ---------- */
 const o = readiness(null);
 return (
  <div>
   <SectionHeader t={t}>Integration360</SectionHeader>
   <div style={{ fontSize: 11.5, color: sub, maxWidth: 860, marginBottom: 12 }}>
    {I360_SUMMARY.line}</div>

   <div style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 10,
    padding: 16, overflowX: "auto" }}>
    <svg viewBox="0 0 1280 520" style={{ minWidth: 900, display: "block" }}>
     <Defs />
     <rect x="16" y="150" width="212" height="180" rx="9" fill="none" stroke="#6d3ac0"
      strokeDasharray="6 4" strokeWidth="1.3" />
     <text x="30" y="172" fontSize="9.5" fontWeight="800" fill="#6d3ac0">
      SEI — OPAQUE</text>
     <Box x={34} y={186} w={176} label="PS-Orchestration" sub="Workflows · SWP" kind="ext" />
     <Box x={34} y={252} w={176} label="SEI Data Cloud" sub="Event Hub · Snowflake" kind="ext" />

     <rect x="276" y="24" width="984" height="470" rx="10" fill="none" stroke="#1168bd"
      strokeDasharray="8 5" strokeWidth="1.5" />
     <text x="294" y="46" fontSize="11" fontWeight="800" fill="#1168bd">
      BBH INFRASTRUCTURE</text>

     <Box x={300} y={66} w={228} label="Oracle control schema" sub="registries · DQ · recon" />
     <Box x={300} y={132} w={228} label="Airflow metadata" sub="Postgres read replica" />
     <Box x={300} y={198} w={228} label="CP Integration Hub" sub="quarantine · submissions" />
     <Box x={300} y={264} w={228} label="Callback inbox" sub="shared · two consumers" kind="acc" />
     <Box x={300} y={330} w={228} label="dbt run results" sub="persisted to Oracle" />
     <Box x={300} y={396} w={228} label="Landing zone" sub="trailer only" />

     <g onClick={() => setView("L2")} style={{ cursor: "pointer" }}>
      <rect x="672" y="172" width="286" height="150" rx="9" fill="#e6f4f2"
       stroke="#0e8f7e" strokeWidth="2.4" />
      <text x="815" y="204" fontSize="15" fontWeight="800" fill="#10193b"
       textAnchor="middle">INTEGRATION360</text>
      <text x="815" y="222" fontSize="9.5" fill="#33707a" textAnchor="middle">
       read-only observability</text>
      <line x1="696" y1="236" x2="934" y2="236" stroke="#9fc9c6" strokeWidth="1" />
      <text x="815" y="254" fontSize="9.5" fill="#33707a" textAnchor="middle">
       completeness · timeliness · correctness</text>
      <text x="815" y="276" fontSize="9" fill="#5c7c94" textAnchor="middle">
       {I360_COMPONENTS.length} components · {PLANE_KEYS.length} planes</text>
      <text x="815" y="302" fontSize="9.5" fontWeight="800" fill="#0e8f7e"
       textAnchor="middle">▼ CLICK TO OPEN THE PLANES</text>
     </g>

     <Box x={1032} y={196} w={200} label="BBH Operations" sub="the only audience" kind="acc" />
     <Box x={672} y={412} w={286} h={46} label="Splunk"
      sub="write-only from the pipeline · never read" kind="mute" />

     <Line d="M528,92 L600,92 L600,204 L668,204" />
     <Line d="M528,158 L600,158 L600,218 L668,218" />
     <Line d="M528,224 L668,232" />
     <Line d="M528,290 L600,290 L600,250 L668,250" acc />
     <Line d="M528,356 L600,356 L600,264 L668,264" />
     <Line d="M528,422 L612,422 L612,280 L668,280" />
     <text x="606" y="128" fontSize="8.5" fontStyle="italic" fill="#5c7c94">reads</text>

     <Line d="M228,212 L252,212 L252,290 L296,290" acc />
     <text x="20" y="360" fontSize="9" fontStyle="italic" fill="#0e8f7e">
      pushes status via Apigee (12)</text>
     <Line d="M228,278 L252,278 L252,224 L296,224" dash />
     <text x="20" y="378" fontSize="9" fontStyle="italic" fill="#5c7c94">
      events → Event Listener (not read here)</text>

     <Line d="M958,240 L1028,240" />
     <path d="M815,326 L815,406" fill="none" stroke="#b8c4ce" strokeWidth="1"
      strokeDasharray="3 3" />
     <text x="824" y="372" fontSize="8.5" fontStyle="italic" fill="#8a97a3">
      no read path</text>
    </svg>
   </div>

   {/* readiness dashboard */}
   <div style={{ fontSize: 15, fontWeight: 700, color: navy, margin: "22px 0 4px" }}>
    Design readiness</div>
   <div style={{ fontSize: 10.5, color: sub, marginBottom: 10 }}>
    readiness to build, not build progress · {o.blocked} of {o.n} components blocked,
    all but one on an answer from SEI</div>
   <div style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 10,
    overflow: "hidden" }}>
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
     background: navy, color: "#fff", padding: "13px 18px" }}>
     <div style={{ textAlign: "center" }}><b style={{ fontSize: 25 }}>{o.avg}%</b>
      <div style={{ fontSize: 9, color: "#a9c1de" }}>overall readiness</div></div>
     <div style={{ textAlign: "center" }}><b style={{ fontSize: 25 }}>{o.blocked}</b>
      <div style={{ fontSize: 9, color: "#a9c1de" }}>of {o.n} blocked</div></div>
     <div style={{ flex: 1, minWidth: 260, display: "grid",
      gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      {PLANE_KEYS.map((k) => {
       const rd = readiness(k);
       return (
        <div key={k} onClick={() => { setPlane(k); setView("L3"); }}
         style={{ cursor: "pointer", background: "#ffffff14", borderRadius: 6,
          padding: "6px 9px" }}>
         <div style={{ fontSize: 9, color: "#a9c1de" }}>
          {I360_PLANES[k][0].split(" · ")[1] || I360_PLANES[k][0]}</div>
         <div style={{ fontSize: 13, fontWeight: 700 }}>{rd.avg}%
          <span style={{ fontSize: 9, fontWeight: 400, color: "#a9c1de" }}>
           {" "}· {rd.n}</span></div>
        </div>);
      })}
     </div>
    </div>
    <div style={{ padding: "12px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
     {I360_STATES.map((s) => (
      <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6,
       fontSize: 10.5, color: sub }}>
       <span style={{ width: 8, height: 8, borderRadius: "50%",
        background: I360_COLOR[s] }} />
       {s} — {I360_COMPONENTS.filter((c) => c.state === s).length}</span>))}
    </div>
   </div>

   {/* channels */}
   <div style={{ fontSize: 15, fontWeight: 700, color: navy, margin: "22px 0 4px" }}>
    The four channels</div>
   <div style={{ fontSize: 10.5, color: sub, marginBottom: 10 }}>
    at different maturities — the design reflects that rather than pretending they are
    symmetrical</div>
   <div style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 10,
    overflow: "hidden" }}>
    {I360_CHANNELS.map((c) => (
     <div key={c.ch} style={{ display: "grid",
      gridTemplateColumns: "88px 84px 132px minmax(0,1fr)", gap: 12,
      padding: "10px 16px", fontSize: 11, borderTop: "1px solid #eef1f4",
      alignItems: "start" }}>
      <b style={{ color: navy }}>{c.ch}</b>
      <span style={{ fontSize: 10, color: sub }}>{c.dir}</span>
      <span>{chip(`${c.tone}1f`, c.tone, c.status.toUpperCase())}</span>
      <div><div style={{ color: "#33414d" }}>{c.can}</div>
       <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>
        <b style={{ color: "#a8560f" }}>cannot:</b> {c.cant}</div></div>
     </div>))}
   </div>
  </div>);
}
