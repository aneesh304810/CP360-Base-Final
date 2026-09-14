import React, { useState } from "react";
import { TRACKER_SUMMARY, TRACKER_COMPONENTS, TRACKER_DECISIONS }
 from "./seiDesignTracker.js";
import DocDrill, { DOCS, DEFAULT_DOC, docFor } from "./DocDrill.jsx";

// =====================================================================
// SeiDesignPack — SEI↔BBH engineering design pack, tracker-first.
// LANDING: Component Architecture hero + the 65-component Design
//   Tracker. Every component has a DESIGN column mapping it to its
//   governing design document.
// DRILL: clicking a Design chip opens that document full-page (back
//   button returns to the tracker). Rendered NATIVELY — no iframes, no
//   HTML documents anywhere. Source of truth: designs-md/*.md, compiled by
//   tools/build_design_docs.py into designDocsData.js (see the guide).
// =====================================================================

const ZONES = ["1. SEI", "2. Hub", "3. Consumers", "4. OpenShift"];
const Z_C = { "1. SEI": "#6d3ac0", "2. Hub": "#0f4775",
 "3. Consumers": "#0b7d7d", "4. OpenShift": "#b5651d" };

export default function SeiDesignPack({ t }) {
 const [doc, setDoc] = useState(null);        // {key, from?} — drill mode
 const [zone, setZone] = useState(null);
 const [onlyHigh, setOnlyHigh] = useState(false);
 const [q, setQ] = useState("");
 const [openRow, setOpenRow] = useState(null);
 const [showDec, setShowDec] = useState(false);

 const S = TRACKER_SUMMARY;
 const chip = (bg, fg, txt, extra) => (
  <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
   background: bg, color: fg, whiteSpace: "nowrap", ...extra }}>{txt}</span>);

 /* drill delegates to the shared DocDrill (also used by HubDesign) */
 if (doc) return <DocDrill t={t} docKey={doc.key} from={doc.from} onBack={() => setDoc(null)} />;

 /* ================= LANDING: architecture hero + tracker ================= */
 const rows = TRACKER_COMPONENTS.filter((c) =>
  (!zone || c.zone === zone) &&
  (!onlyHigh || c.custom === "High") &&
  (!q || (c.component + " " + c.plane + " " + c.technology + " " + c.deliverable)
    .toLowerCase().includes(q.toLowerCase())));

 const prio = (p) => p === "P1" ? chip("#fde8e8", "#c0392b", "P1")
  : p === "P2" ? chip("#fae5d3", "#a8560f", "P2") : chip("#eef1f4", "#8a97a3", p || "—");
 const cust = (c) => c === "High" ? chip("#efe6fb", "#6d3ac0", "HIGH")
  : c === "Medium" ? chip("#e0f5fd", "#0b5e83", "MED")
  : c === "Low" ? chip("#eef6fb", "#7d97ab", "LOW") : <span />;

 return (
  <div style={{ marginTop: 14 }}>
   {/* ---- Component Architecture hero ---- */}
   <div onClick={() => setDoc({ key: "A" })}
    style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
     background: t.navy || "#10193b", color: "#fff", borderRadius: 12,
     padding: "16px 22px", marginBottom: 16 }}>
    <span style={{ fontSize: 30 }}>🏛</span>
    <div style={{ flex: 1, minWidth: 0 }}>
     <b style={{ fontSize: 15 }}>Component Architecture — SEI ↔ BBH Integration</b>
     <div style={{ fontSize: 10.5, color: "#a9c1de", marginTop: 3 }}>{S.line}</div>
    </div>
    <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: "#a9c1de",
     alignItems: "center" }}>
     {[["components", S.totals.components], ["P1", S.totals.p1],
       ["high custom", S.totals.high]].map((kv) => (
      <span key={kv[0]} style={{ textAlign: "center" }}>
       <b style={{ display: "block", fontSize: 17, color: "#fff" }}>{kv[1]}</b>{kv[0]}</span>))}
     <span style={{ fontSize: 13, fontWeight: 700, color: t.pop || "#31bced",
      marginLeft: 8 }}>open the architecture →</span>
    </div>
   </div>

   {/* ---- tracker header + decisions ---- */}
   <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 10px",
    flexWrap: "wrap" }}>
    <b style={{ fontSize: 13.5, color: t.navy || "#10193b" }}>Component Design Tracker</b>
    <span style={{ fontSize: 10.5, color: t.sub || "#666" }}>
     the <b>Design</b> column maps each component to its governing document — click it
     to drill in</span>
    <span onClick={() => setShowDec(!showDec)}
     style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
      padding: "4px 12px", borderRadius: 999,
      background: showDec ? "#c0392b" : "#fde8e8",
      color: showDec ? "#fff" : "#c0392b" }}>
     ⚖ {S.totals.decisions} open decisions {showDec ? "▾" : "▸"}</span>
   </div>
   {showDec && (
    <div style={{ border: "1.5px solid #f0c9c9", borderRadius: 9, marginBottom: 12,
     overflow: "hidden" }}>
     {TRACKER_DECISIONS.map((d, i) => (
      <div key={d.id} style={{ padding: "9px 14px", fontSize: 11,
       borderTop: i ? "1px solid #f6e2e2" : "none", background: "#fffafa" }}>
       <b style={{ color: "#c0392b" }}>{d.id}</b>{" — "}
       <b style={{ color: t.navy || "#10193b" }}>{d.decision}</b>
       <div style={{ fontSize: 10, color: t.sub || "#666", marginTop: 3, lineHeight: 1.55 }}>
        SEI v5: {d.sei || "—"} · BBH v4.2: {d.bbh || "—"}
        {d.blocks ? <> · blocks components {d.blocks}</> : null}</div>
       {d.recommendation && (
        <div style={{ fontSize: 10, marginTop: 2 }}>→ <b>{d.recommendation}</b></div>)}
      </div>))}
    </div>)}

   {/* ---- filters ---- */}
   <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8,
    flexWrap: "wrap" }}>
    <span onClick={() => setZone(null)}
     style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
      cursor: "pointer", background: !zone ? (t.navy || "#10193b") : "#eef1f4",
      color: !zone ? "#fff" : (t.sub || "#666") }}>all zones</span>
    {ZONES.map((z) => (
     <span key={z} onClick={() => setZone(zone === z ? null : z)}
      style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
       cursor: "pointer", border: `1.5px solid ${Z_C[z]}`,
       background: zone === z ? Z_C[z] : "#fff",
       color: zone === z ? "#fff" : Z_C[z] }}>{z}</span>))}
    <label style={{ display: "flex", gap: 5, fontSize: 10.5, color: t.sub || "#666",
     cursor: "pointer", alignItems: "center" }}>
     <input type="checkbox" checked={onlyHigh}
      onChange={(e) => setOnlyHigh(e.target.checked)} />
     high custom only</label>
    <input placeholder="Search component / tech…" value={q}
     onChange={(e) => setQ(e.target.value)}
     style={{ marginLeft: "auto", height: 28, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderRadius: 3, padding: "0 10px", fontSize: 11.5, width: 220 }} />
   </div>

   {/* ---- tracker table with DESIGN column ---- */}
   <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
    overflow: "hidden", background: "#fff" }}>
    <div style={{ display: "grid",
     gridTemplateColumns: "34px 96px minmax(0,1.35fr) minmax(0,1.5fr) 84px 46px 64px 84px 128px",
     gap: 10, padding: "7px 14px", background: "#f7f9fa", fontSize: 8.5, fontWeight: 800,
     textTransform: "uppercase", letterSpacing: 0.4, color: t.muted || "#999" }}>
     <span>ID</span><span>Plane</span><span>Component</span><span>Deliverable</span>
     <span>Tech</span><span>Prio</span><span>Custom</span><span>Status</span>
     <span>Design</span></div>
    {rows.map((c) => {
     const open = openRow === c.id;
     const dk = docFor(c);
     const d = DOCS[dk];
     return (
      <div key={c.id}>
       <div onClick={() => setOpenRow(open ? null : c.id)}
        style={{ display: "grid",
         gridTemplateColumns: "34px 96px minmax(0,1.35fr) minmax(0,1.5fr) 84px 46px 64px 84px 128px",
         gap: 10, padding: "7px 14px", fontSize: 11, borderTop: "1px solid #eef1f4",
         cursor: "pointer", alignItems: "center",
         background: open ? "#f6fafc" : undefined }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 9.5,
         color: Z_C[c.zone] || "#888", fontWeight: 700 }}>{c.id}</span>
        <span style={{ fontSize: 9.5, color: t.sub || "#666", overflow: "hidden",
         textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.plane}>{c.plane}</span>
        <b style={{ color: t.navy || "#10193b", minWidth: 0, overflow: "hidden",
         textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.component}>
         {c.component}</b>
        <span style={{ fontSize: 10, color: t.sub || "#666", minWidth: 0,
         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
         title={c.deliverable}>{c.deliverable}</span>
        <span style={{ fontSize: 9.5, color: "#0b5e83", overflow: "hidden",
         textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.technology}</span>
        <span>{prio(c.priority)}</span>
        <span>{cust(c.custom)}</span>
        <span>{chip(c.status === "Not Started" ? "#eef1f4" : "#d0ebd9",
          c.status === "Not Started" ? "#8a97a3" : "#159943",
          (c.status || "—").toUpperCase())}</span>
        <span onClick={(e) => { e.stopPropagation(); setDoc({ key: dk, from: c }); }}
         title={`${d.title} — click to open`}
         style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
          background: d.bg, color: d.color, border: `1px solid ${d.color}`,
          cursor: "pointer", whiteSpace: "nowrap", textAlign: "center" }}>
         {d.icon} {d.level} · {d.chip || (d.default ? "Arch"
          : d.id === "l2-planes" ? "Planes"
          : d.id === "l3-stages" ? "Stage 1/2"
          : d.id === "l3-errors" ? "Errors" : d.title)} →</span>
       </div>
       {open && (
        <div style={{ padding: "9px 14px 12px 44px", fontSize: 10.5, background: "#fbfdfe",
         borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}`, lineHeight: 1.7,
         color: t.sub || "#666" }}>
         <b style={{ color: t.navy || "#10193b" }}>Key design questions:</b>{" "}
         {c.questions || "—"}
         {c.scope && <><br /><b style={{ color: t.navy || "#10193b" }}>Custom scope:</b>{" "}
          {c.scope}</>}
         {c.depends && c.depends !== "-" && <><br />
          <b style={{ color: t.navy || "#10193b" }}>Depends on:</b> {c.depends}</>}
         {c.notes && <><br /><b style={{ color: t.navy || "#10193b" }}>Notes:</b>{" "}
          {c.notes}</>}
         <span style={{ marginLeft: 8 }}>
          {chip("#eef6fb", "#7d97ab", c.source || "—")}</span>
        </div>)}
      </div>);
    })}
    {!rows.length && (
     <div style={{ padding: 18, fontSize: 11.5, color: t.muted || "#999",
      textAlign: "center" }}>No components match the current filter.</div>)}
   </div>
   <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 6 }}>
    Design mapping: error/quarantine/override components → L3 Errors · stage/dbt/landing
    components → L3 Stage 1/2 · other Hub components → their L2 plane drill-down ·
    everything else → L1 Architecture. Row click = design questions; Design chip = the document.</div>
  </div>);
}
