import React, { useState, useEffect } from "react";
import { DESIGN_DOCS } from "./designDocsData.js";

// =====================================================================
// DocDrill — the shared design-document viewer/editor. Used by
// SeiDesignPack (System Design flat tracker) and HubDesign (C4 route).
// Exports: DocDrill (default), docFor, DOCS, DEFAULT_DOC + renderers.
// =====================================================================

// registry + mapping are CONFIG, compiled from designs-md front-matter
const DOCS = {};
DESIGN_DOCS.forEach((d) => { DOCS[d.id] = d; });
const DEFAULT_DOC = (DESIGN_DOCS.find((d) => d.default) || DESIGN_DOCS[0]).id;

// which design document governs a component — driven by front-matter:
// component_ids (explicit pin) > match regex > zone_default > default doc
const docFor = (c) => {
 const hay = `${c.component} ${c.plane} ${c.deliverable} ${c.scope}`.toLowerCase();
 for (const d of DESIGN_DOCS)
  if (d.component_ids && d.component_ids.includes(c.id)) return d.id;
 for (const d of DESIGN_DOCS)
  if (d.match && new RegExp(d.match).test(hay)) return d.id;
 for (const d of DESIGN_DOCS)
  if (d.zone_default && c.zone === d.zone_default) return d.id;
 return DEFAULT_DOC;
};


export { DOCS, DEFAULT_DOC, docFor };

const Z_C = { "1. SEI": "#6d3ac0", "2. Hub": "#0f4775",
 "3. Consumers": "#0b7d7d", "4. OpenShift": "#b5651d" };

export default function DocDrill({ t, docKey, from, onBack }) {
 const [editing, setEditing] = useState(false);
 const [drafts, setDrafts] = useState({});
 const [copied, setCopied] = useState(false);
 const doc = { key: docKey, from: from || null };
 const chip = (bg, fg, txt, extra) => (
  <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
   background: bg, color: fg, whiteSpace: "nowrap", ...extra }}>{txt}</span>);
 const setDoc = (v) => { if (v === null) { setEditing(false); onBack(); } };
 const d = DOCS[doc.key];
 const dk = d.id;
 {
  return (
   <div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
     flexWrap: "wrap", position: "sticky", top: 56, background: t.bg || "#eef2f5",
     padding: "8px 0", zIndex: 5 }}>
     <span onClick={() => { setEditing(false); setDoc(null); }}
      style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 16px", borderRadius: 5,
       cursor: "pointer", background: t.navy || "#10193b", color: "#fff" }}>
      ← back to tracker</span>
     <span style={{ fontSize: 18 }}>{d.icon}</span>
     <b style={{ fontSize: 14.5, color: t.navy || "#10193b" }}>{d.title}</b>
     {chip(d.bg, d.color, d.level)}
     {doc.from && (
      <span style={{ fontSize: 10.5, color: t.sub || "#666" }}>
       design context: <b style={{ color: Z_C[doc.from.zone] || "#333" }}>
       #{doc.from.id} {doc.from.component}</b> · {doc.from.plane}</span>)}
     <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
      <span onClick={() => setEditing(!editing)}
       style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 800, borderRadius: 5,
        padding: "6px 12px", background: editing ? (t.accent || "#0f4775") : "#eef3f8",
        color: editing ? "#fff" : (t.accent || "#0f4775") }}>
       {editing ? "✕ close editor" : "✏️ edit"}</span>
      {editing && (
       <>
        <span onClick={() => exportDoc(d, drafts)}
         style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 800, borderRadius: 5,
          padding: "6px 12px", background: "#eef3f8", color: t.accent || "#0f4775" }}>
         ⬇ download .md</span>
        <span onClick={() => copyDoc(d, drafts, setCopied)}
         style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 800, borderRadius: 5,
          padding: "6px 12px", background: "#eef3f8", color: t.accent || "#0f4775" }}>
         ⧉ copy</span>
        {copied && <span style={{ fontSize: 10, color: "#159943", fontWeight: 700 }}>
         copied ✓</span>}
       </>)}
      <span style={{ fontSize: 9.5, color: t.muted || "#999" }}>
       source: designs-md/{d.src}</span>
     </span>
    </div>
    {editing && (
     <div style={{ background: "#fff8e6", border: "1px solid #e8d49a", borderRadius: 8,
      padding: "9px 14px", fontSize: 10.5, color: "#6b5b1e", marginBottom: 12,
      lineHeight: 1.6 }}>
      ✏️ <b>Tier-1 local editing</b> — changes live only in this session. Download the
      .md, drop it into designs-md/, run build_design_docs.py to reflect everywhere.
      Diagrams via svg or mermaid fences render live in the preview.
     </div>)}
    <div style={{ fontSize: 11.5, color: t.sub || "#666", marginBottom: 8 }}>{d.sub}</div>
    {d.meta && d.meta.status && (
     <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14,
      fontSize: 9.5 }}>
      {chip("#e8ecf9", "#4a5fc0", `status · ${d.meta.status}`)}
      {chip("#eef1f4", "#5c6b7a", `owner · ${d.meta.owner || "TBD"}`)}
      {d.meta.depends_on.length > 0 &&
       chip("#e0f5fd", "#0b5e83", `depends on · ${d.meta.depends_on.join(", ")}`)}
      {d.meta.decisions.length > 0 &&
       chip("#fde8e8", "#c0392b", `decisions · ${d.meta.decisions.join(", ")}`)}
      {d.meta.updated && chip("#eef1f4", "#8a97a3", `updated ${d.meta.updated}`)}
     </div>)}
    {d.sections.map((sec, i) => {
     const dkey = `${dk}:${i}`;
     const raw = dkey in drafts ? drafts[dkey] : sec.md;
     return (
      <div key={i} style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
       borderLeft: `4px solid ${d.color}`, borderRadius: 9, padding: "14px 20px",
       marginBottom: 12 }}>
       {sec.h && <div style={{ fontSize: 14, fontWeight: 700, color: t.navy || "#10193b",
        marginBottom: 8 }}>{sec.h}
        {editing && dkey in drafts && <span style={{ fontSize: 8, fontWeight: 800,
         background: "#fae5d3", color: "#a8560f", borderRadius: 999, padding: "2px 8px",
         marginLeft: 10, verticalAlign: "middle" }}>edited</span>}</div>}
       {editing ? (
        <>
         <textarea value={raw}
          onChange={(e) => setDrafts({ ...drafts, [dkey]: e.target.value })}
          style={{ width: "100%", minHeight: 130, fontFamily: "Roboto Mono, monospace",
           fontSize: 10.5, lineHeight: 1.6, border: `1.5px solid ${t.accent || "#0f4775"}`,
           borderRadius: 6, padding: "9px 12px", marginBottom: 8, resize: "vertical",
           background: "#fbfdff" }} />
         <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: 0.6, color: t.muted || "#999", marginBottom: 6 }}>
          live preview</div>
         {parseMdClient(raw).map((b, j) => <Block key={j} t={t} b={b} c={d.color} />)}
        </>
       ) : (
        sec.blocks.map((b, j) => <Block key={j} t={t} b={b} c={d.color} />)
       )}
      </div>);
    })}
   </div>);
 }
}

/* ---- tiny native renderers for the compiled markdown blocks ---- */
function Inline({ x }) {
 const parts = String(x).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
 return (
  <>
   {parts.map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b>
    : p.startsWith("`") ? <code key={i} style={{ background: "#f2f5f7",
       padding: "1px 5px", borderRadius: 3,
       fontFamily: "Roboto Mono, monospace", fontSize: "0.92em" }}>
       {p.slice(1, -1)}</code>
    : <React.Fragment key={i}>{p}</React.Fragment>)}
  </>);
}

function Block({ t, b, c }) {
 if (b.t === "h")
  return <div style={{ fontSize: 12, fontWeight: 800, color: c,
   textTransform: "uppercase", letterSpacing: 0.4, margin: "12px 0 5px" }}>
   <Inline x={b.x} /></div>;
 if (b.t === "p")
  return <p style={{ fontSize: 12, lineHeight: 1.75, color: "#31414f",
   margin: "0 0 8px" }}><Inline x={b.x} /></p>;
 if (b.t === "ul")
  return <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
   {b.items.map((it, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.7,
    color: "#31414f" }}><Inline x={it} /></li>)}</ul>;
 if (b.t === "svg") return <SvgZoomBlock svg={b.x} accent={c} />;
 if (b.t === "pre") {
  if (b.lang === "mermaid") return <MermaidBlock code={b.x} accent={c} />;
  return (
   <div style={{ position: "relative", margin: "0 0 10px" }}>
    {b.lang && <span style={{ position: "absolute", top: 6, right: 10, fontSize: 8,
     fontWeight: 800, textTransform: "uppercase", color: "#7d97ab" }}>{b.lang}</span>}
    <pre style={{ background: "#10193b", color: "#cfe3f5", borderRadius: 7,
     padding: "10px 14px", fontSize: 10.5, lineHeight: 1.6, overflowX: "auto",
     fontFamily: "Roboto Mono, monospace", margin: 0 }}>{b.x}</pre>
   </div>);
 }
 if (b.t === "tbl")
  return (
   <div style={{ overflowX: "auto", margin: "0 0 10px" }}>
    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
     <tbody>
      {b.rows.map((row, i) => (
       <tr key={i}>
        {row.map((cell, j) => i === 0
         ? <th key={j} style={{ textAlign: "left", padding: "6px 10px",
            background: "#f4f7f9", fontSize: 9, textTransform: "uppercase",
            letterSpacing: 0.3, color: "#5c6b7a",
            border: "1px solid #e4eaee" }}><Inline x={cell} /></th>
         : <td key={j} style={{ padding: "6px 10px", lineHeight: 1.6,
            color: "#31414f", border: "1px solid #edf1f4",
            verticalAlign: "top" }}><Inline x={cell} /></td>)}
       </tr>))}
     </tbody>
    </table>
   </div>);
 return null;
}

/* ---- MermaidBlock: renders the diagram natively via the mermaid package.
   Air-gap note: `npm install mermaid` from Nexus once; until the package is
   present the block falls back to the diagram source with a caption. ---- */
let _mermaidP = null;
function loadMermaid() {
 if (!_mermaidP)
  _mermaidP = import("mermaid").then((m) => {
   const mm = m.default || m;
   mm.initialize({ startOnLoad: false, securityLevel: "loose",
    theme: "neutral", flowchart: { curve: "basis" } });
   return mm;
  });
 return _mermaidP;
}
let _mmSeq = 0;
function MermaidBlock({ code, accent }) {
 const [svg, setSvg] = useState(null);
 const [failed, setFailed] = useState(false);
 const [zoomed, setZoomed] = useState(false);
 useEffect(() => {
  let dead = false;
  loadMermaid()
   .then((mm) => mm.render("mmd" + (++_mmSeq), code))
   .then((r) => { if (!dead) setSvg(r.svg || r); })
   .catch(() => { if (!dead) setFailed(true); });
  return () => { dead = true; };
 }, [code]);
 if (svg)
  return (
   <>
    <div onClick={() => setZoomed(true)} title="click to zoom"
     style={{ background: "#fff", border: "1px solid #e4eaee", borderRadius: 7,
      padding: "10px 12px", margin: "0 0 10px", overflowX: "auto",
      cursor: "zoom-in" }}
     dangerouslySetInnerHTML={{ __html: svg }} />
    {zoomed && <DiagramZoom svg={svg} accent={accent}
     onClose={() => setZoomed(false)} />}
   </>);
 return (
  <div style={{ margin: "0 0 10px" }}>
   <pre style={{ background: "#10193b", color: "#cfe3f5", borderRadius: "7px 7px 0 0",
    padding: "10px 14px", fontSize: 10.5, lineHeight: 1.6, overflowX: "auto",
    fontFamily: "Roboto Mono, monospace", margin: 0 }}>{code}</pre>
   <div style={{ fontSize: 9, color: failed ? "#a8560f" : "#7d97ab",
    background: "#f4f7f9", borderRadius: "0 0 7px 7px", padding: "4px 10px" }}>
    {failed
     ? "diagram source — install the mermaid package (npm install mermaid via Nexus) for native rendering"
     : "rendering diagram…"}</div>
  </div>);
}

/* ---- DiagramZoom: full-screen diagram lightbox — wheel zoom, drag pan,
   +/− buttons, fit, Esc or backdrop click to close ---- */
function DiagramZoom({ svg, accent, onClose }) {
 const [scale, setScale] = useState(1.4);
 const [pan, setPan] = useState({ x: 40, y: 40 });
 const [drag, setDrag] = useState(null);
 useEffect(() => {
  const onKey = (e) => { if (e.key === "Escape") onClose(); };
  window.addEventListener("keydown", onKey);
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { window.removeEventListener("keydown", onKey);
   document.body.style.overflow = prev; };
 }, [onClose]);
 const clamp = (v) => Math.min(6, Math.max(0.3, v));
 const btn = (label, fn, wide) => (
  <span onClick={fn} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800,
   background: "#fff", color: "#10193b", borderRadius: 6,
   padding: wide ? "6px 14px" : "6px 12px", userSelect: "none" }}>{label}</span>);
 return (
  <div onClick={onClose}
   style={{ position: "fixed", inset: 0, background: "rgba(16,25,59,0.82)",
    zIndex: 300, display: "flex", flexDirection: "column" }}>
   <div onClick={(e) => e.stopPropagation()}
    style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 18px" }}>
    {btn("−", () => setScale((v) => clamp(v / 1.25)))}
    <span style={{ color: "#a9c1de", fontSize: 12, fontWeight: 700, minWidth: 44,
     textAlign: "center" }}>{Math.round(scale * 100)}%</span>
    {btn("+", () => setScale((v) => clamp(v * 1.25)))}
    {btn("fit", () => { setScale(1); setPan({ x: 40, y: 40 }); }, true)}
    <span style={{ color: "#a9c1de", fontSize: 10.5, marginLeft: 8 }}>
     wheel = zoom · drag = pan · Esc = close</span>
    <span onClick={onClose} style={{ marginLeft: "auto", cursor: "pointer",
     color: "#fff", fontSize: 20, fontWeight: 700, padding: "0 6px" }}>✕</span>
   </div>
   <div onClick={(e) => e.stopPropagation()}
    onWheel={(e) => setScale((v) => clamp(v * (e.deltaY < 0 ? 1.12 : 0.89)))}
    onPointerDown={(e) => setDrag({ x: e.clientX - pan.x, y: e.clientY - pan.y })}
    onPointerMove={(e) => { if (drag) setPan({ x: e.clientX - drag.x,
     y: e.clientY - drag.y }); }}
    onPointerUp={() => setDrag(null)}
    onPointerLeave={() => setDrag(null)}
    style={{ flex: 1, overflow: "hidden", cursor: drag ? "grabbing" : "grab",
     margin: "0 18px 18px", background: "#fff", borderRadius: 10,
     borderTop: `4px solid ${accent || "#0f4775"}` }}>
    <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
     transformOrigin: "0 0", width: "fit-content" }}
     dangerouslySetInnerHTML={{ __html: svg }} />
   </div>
  </div>);
}

/* ---- Tier-1 editing helpers: client md parser mirrors build_design_docs.py ---- */
function parseMdClient(md) {
 const blocks = []; let ul = [], tbl = [], pre = [], inPre = false, preLang = "";
 const fUl = () => { if (ul.length) { blocks.push({ t: "ul", items: ul }); ul = []; } };
 const fTbl = () => { if (tbl.length) { blocks.push({ t: "tbl", rows: tbl }); tbl = []; } };
 String(md).split("\n").forEach((line) => {
  if (inPre) {
   if (line.trim() === "```") {
    blocks.push(preLang === "svg" ? { t: "svg", x: pre.join("\n") }
     : { t: "pre", x: pre.join("\n"), lang: preLang });
    pre = []; inPre = false; preLang = "";
   } else pre.push(line);
   return;
  }
  const f = line.trim().match(/^```(\w*)$/);
  if (f) { fUl(); fTbl(); inPre = true; preLang = f[1]; return; }
  if (/^# /.test(line) && !/^## /.test(line)) return;
  if (line.trim() === "---" || line.trim() === "***") { fUl(); fTbl(); return; }
  if (/^### /.test(line)) { fUl(); fTbl(); blocks.push({ t: "h", x: line.slice(4).trim() }); return; }
  if (/^- /.test(line)) { fTbl(); ul.push(line.slice(2).trim()); return; }
  if (/^\|/.test(line)) {
   fUl();
   if (/^\|[-| ]+\|$/.test(line.trim())) return;
   tbl.push(line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
   return;
  }
  if (line.trim() === "") { fUl(); fTbl(); return; }
  fUl(); fTbl(); blocks.push({ t: "p", x: line.trim() });
 });
 fUl(); fTbl();
 if (inPre) blocks.push({ t: "pre", x: pre.join("\n"), lang: preLang });
 return blocks;
}

function buildDocMdClient(d, drafts) {
 let out = "---\n" + d.fm_raw + "\n---\n\n";
 d.sections.forEach((sec, i) => {
  const k = `${d.id}:${i}`;
  if (sec.h) out += "## " + sec.h + "\n";
  out += (k in drafts ? drafts[k] : sec.md) + "\n\n";
 });
 return out;
}
function exportDoc(d, drafts) {
 const blob = new Blob([buildDocMdClient(d, drafts)], { type: "text/markdown" });
 const a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = d.src || d.id + ".md";
 document.body.appendChild(a); a.click(); a.remove();
 URL.revokeObjectURL(a.href);
}
function copyDoc(d, drafts, setCopied) {
 const txt = buildDocMdClient(d, drafts);
 const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
 if (navigator.clipboard && navigator.clipboard.writeText)
  navigator.clipboard.writeText(txt).then(done, done);
 else done();
}

/* ---- SvgZoomBlock: authored svg fences — inline + the same zoom lightbox ---- */
function SvgZoomBlock({ svg, accent }) {
 const [zoomed, setZoomed] = useState(false);
 return (
  <>
   <div onClick={() => setZoomed(true)} title="click to zoom"
    style={{ background: "#fff", border: "1px solid #e4eaee", borderRadius: 7,
     padding: "10px 12px", margin: "0 0 10px", overflowX: "auto", cursor: "zoom-in" }}
    dangerouslySetInnerHTML={{ __html: svg }} />
   {zoomed && <DiagramZoom svg={svg} accent={accent} onClose={() => setZoomed(false)} />}
  </>);
}
