import React, { useState } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { ROLE, USES, GOVERNS, I360, PIPELINE, businessMarkdown } from "./hubBusiness.js";

// HubBusiness: CP Integration Hub for a business audience. Diagrams and
// tiles with one-line captions; the detail lives on the architecture pages.

const NAVY = "#10193b", BLUE = "#1168bd", TEAL = "#0e8f7e", RED = "#cc3344", AMBER = "#e0a13d", MUTE = "#5c7c94";

/** Technical view / Business view, above the hub page. */
export function HubViewToggle({ t, mode, onPick }) {
  const border = t.border || "#d9dee3";
  const pill = (m, label, hint) => (
    <span key={m} role="tab" tabIndex={0} aria-selected={mode === m} onClick={() => onPick(m)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(m); }}
      style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
        background: mode === m ? NAVY : "transparent", color: mode === m ? "#fff" : (t.sub || "#4a5560"),
        border: `1px solid ${mode === m ? NAVY : border}` }} title={hint}>{label}</span>);
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
      {pill("technical", "Technical view", "C4 levels, components, tracker, discussion")}
      {pill("business", "Business view", "what the hub does, where it is used, one real pipeline")}
    </div>);
}

export default function HubBusiness({ t }) {
  const [copied, setCopied] = useState("");
  const border = t.border || "#d9dee3";
  const sub = t.sub || "#4a5560";
  const text = t.text || "#1a1a1a";
  const panel = t.panel || "#fff";

  const copy = () => {
    const md = businessMarkdown();
    try { navigator.clipboard?.writeText(md); } catch { /* no clipboard: nothing to do */ }
    setCopied("copied"); setTimeout(() => setCopied(""), 1500);
  };

  const H = ({ children, hint }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "34px 0 12px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: text, margin: 0 }}>{children}</h2>
      {hint && <span style={{ fontSize: 11.5, color: sub }}>{hint}</span>}
    </div>);

  /* ---- SVG helpers ---- */
  const Defs = () => (
    <defs>
      {[["hbArr", MUTE], ["hbAcc", TEAL], ["hbRed", RED], ["hbAmb", AMBER]].map(([id, c]) => (
        <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>))}
    </defs>);
  const Box = ({ x, y, w, h = 46, label, s, kind }) => {
    const fill = kind === "ext" ? "#f2eefa" : kind === "acc" ? "#e6f4f2" : kind === "hub" ? NAVY : kind === "bad" ? "#fae0e2" : kind === "warn" ? "#fdf1d8" : kind === "mute" ? "#f6f8fa" : "#fff";
    const stroke = kind === "ext" ? "#6d3ac0" : kind === "acc" ? TEAL : kind === "hub" ? NAVY : kind === "bad" ? RED : kind === "warn" ? AMBER : kind === "mute" ? "#b8c4ce" : BLUE;
    const fg = kind === "hub" ? "#fff" : NAVY;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke} strokeWidth={1.4} strokeDasharray={kind === "mute" ? "5 4" : undefined} />
        <text x={x + w / 2} y={y + (s ? 19 : h / 2 + 4)} fontSize="11" fontWeight="700" fill={fg} textAnchor="middle">{label}</text>
        {s && <text x={x + w / 2} y={y + 34} fontSize="8.5" fill={kind === "hub" ? "#a9c1de" : MUTE} textAnchor="middle">{s}</text>}
      </g>);
  };
  const Line = ({ d, m = "hbArr", dash, label, lx, ly, c }) => (
    <g>
      <path d={d} fill="none" stroke={c || (m === "hbAcc" ? TEAL : m === "hbRed" ? RED : m === "hbAmb" ? AMBER : MUTE)} strokeWidth={1.3} strokeDasharray={dash ? "4 4" : undefined} markerEnd={`url(#${m})`} />
      {label && <text x={lx} y={ly} fontSize="8.5" fontStyle="italic" fill={c || MUTE}>{label}</text>}
    </g>);

  /* ---- 1. what it does ---- */
  const Context = () => {
    const W = 980, hubX = 330, hubW = 320, hubY = 20, hubH = 250;
    return (
      <svg viewBox={`0 0 ${W} 300`} width="100%" style={{ display: "block", maxHeight: 340 }} role="img" aria-label="sources, the hub and its consumers">
        <Defs />
        {ROLE.sources.map(([l, s], i) => <Box key={l} x={20} y={28 + i * 60} w={200} label={l} s={s} kind="ext" />)}
        {ROLE.sources.map((_, i) => <Line key={i} d={`M220,${51 + i * 60} L${hubX},${51 + i * 60}`} m={i === 3 ? "hbArr" : "hbAcc"} dash={i === 2} />)}
        <rect x={hubX} y={hubY} width={hubW} height={hubH} rx="10" fill={NAVY} />
        <text x={hubX + hubW / 2} y={hubY + 24} fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">CP INTEGRATION HUB</text>
        <text x={hubX + hubW / 2} y={hubY + 40} fontSize="9" fill="#a9c1de" textAnchor="middle">{ROLE.verbs.join(" \u00b7 ")}</text>
        {ROLE.lanes.map(([l, d, c], i) => (
          <g key={l}>
            <rect x={hubX + 16} y={hubY + 54 + i * 46} width={hubW - 32} height={38} rx="6" fill="#ffffff14" stroke="#a9c1de55" />
            <text x={hubX + 28} y={hubY + 70 + i * 46} fontSize="11" fontWeight="700" fill="#fff">{l}</text>
            <text x={hubX + 28} y={hubY + 84 + i * 46} fontSize="8.5" fill="#a9c1de">{d}</text>
            <text x={hubX + hubW - 28} y={hubY + 78 + i * 46} fontSize="9" fontWeight="700" fill="#8fd3c6" textAnchor="end">{c}</text>
          </g>))}
        {ROLE.consumers.map(([l, s], i) => <Box key={l} x={760} y={18 + i * 52} w={200} label={l} s={s} kind={i === 4 ? "mute" : "acc"} />)}
        {ROLE.consumers.map((_, i) => <Line key={i} d={`M${hubX + hubW},${41 + i * 52} L760,${41 + i * 52}`} m={i === 4 ? "hbArr" : "hbAcc"} dash={i === 4} />)}
        <text x={hubX + hubW / 2} y={292} fontSize="9" fill={MUTE} textAnchor="middle">every movement has a record: received, validated, loaded, reconciled, published</text>
      </svg>);
  };

  /* ---- 2. tiles ---- */
  const Tiles = ({ rows, cols = 3, icon }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>
      {rows.map((r) => {
        const [ic, h, b] = icon ? r : ["", r[0], r[1]];
        return (
          <div key={h} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", background: panel, display: "flex", gap: 12 }}>
            {icon && <div style={{ width: 38, height: 38, borderRadius: 10, background: NAVY, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, flex: "0 0 auto" }}>{ic}</div>}
            <div><div style={{ fontWeight: 700, color: text, fontSize: 13 }}>{h}</div>
              <div style={{ fontSize: 11.5, color: sub, marginTop: 3, lineHeight: 1.45 }}>{b}</div></div>
          </div>);
      })}
    </div>);

  /* ---- 3. the pipeline flow ---- */
  const Flow = () => {
    const n = PIPELINE.flow.length, w = 120, gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    return (
      <svg viewBox="0 0 1000 230" width="100%" style={{ display: "block" }} role="img" aria-label="pipeline flow">
        <Defs />
        {PIPELINE.flow.map(([l, s], i) => (
          <g key={l}>
            <Box x={X(i)} y={30} w={w} h={52} label={l} s="" kind={i === 2 ? "acc" : i === n - 1 ? "ext" : i === 0 ? "ext" : "box"} />
            <foreignObject x={X(i) - 6} y={88} width={w + 12} height={44}>
              <div style={{ fontSize: 8.5, color: MUTE, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
            {i < n - 1 && <Line d={`M${X(i) + w},56 L${X(i + 1)},56`} m="hbAcc" />}
          </g>))}
        {PIPELINE.branches.map(([at, l, s], i) => (
          <g key={l}>
            <Line d={`M${X(at) + w / 2},126 L${X(at) + w / 2},152`} m={i === 0 ? "hbRed" : "hbAmb"} dash />
            <Box x={X(at)} y={152} w={w} h={36} label={l} kind={i === 0 ? "bad" : "warn"} />
            <foreignObject x={X(at) - 6} y={192} width={w + 12} height={36}>
              <div style={{ fontSize: 8.5, color: i === 0 ? RED : AMBER, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
          </g>))}
        <text x={X(0)} y={18} fontSize="9" fill={MUTE}>{PIPELINE.file}</text>
      </svg>);
  };

  /* ---- 4. the DAG ---- */
  const Dag = () => {
    const n = PIPELINE.dag.length, w = 104, gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    return (
      <svg viewBox="0 0 1000 120" width="100%" style={{ display: "block" }} role="img" aria-label="airflow dag">
        <Defs />
        {PIPELINE.dag.map(([l, s], i) => (
          <g key={l}>
            <rect x={X(i)} y={20} width={w} height={40} rx="20" fill={i === 1 ? "#fdf1d8" : i === 2 ? "#e6f4f2" : i >= 4 && i <= 6 ? "#eaf1fb" : "#fff"} stroke={i === 1 ? AMBER : i === 2 ? TEAL : BLUE} strokeWidth={1.4} />
            <text x={X(i) + w / 2} y={44} fontSize="9.5" fontWeight="700" fill={NAVY} textAnchor="middle">{l}</text>
            <foreignObject x={X(i) - 8} y={66} width={w + 16} height={48}>
              <div style={{ fontSize: 8.5, color: MUTE, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
            {i < n - 1 && <Line d={`M${X(i) + w},40 L${X(i + 1)},40`} />}
          </g>))}
      </svg>);
  };

  /* ---- 5. lineage strip ---- */
  const Lineage = () => (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto" }}>
      {PIPELINE.lineage.map(([h, b], i) => (
        <React.Fragment key={h}>
          <div style={{ flex: 1, minWidth: 150, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 12px", background: i === 4 ? "#e6f4f2" : panel }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: text }}>{h}</div>
            <div style={{ fontSize: 10, color: sub, marginTop: 4, fontFamily: "ui-monospace, monospace", lineHeight: 1.4 }}>{b}</div>
          </div>
          {i < PIPELINE.lineage.length - 1 && <div style={{ alignSelf: "center", padding: "0 6px", color: TEAL, fontSize: 16 }}>{"\u2192"}</div>}
        </React.Fragment>))}
    </div>);

  /* ---- 6. states ---- */
  const States = () => {
    const col = (c) => 30 + c * 230;
    return (
      <svg viewBox="0 0 980 150" width="100%" style={{ display: "block" }} role="img" aria-label="file lifecycle states">
        <Defs />
        {PIPELINE.states.filter((s) => !s[2]).map(([l, c], i, arr) => (
          <g key={l}>
            <Box x={col(c)} y={20} w={170} h={40} label={l} kind={l === "ARCHIVED" ? "acc" : "box"} />
            {i < arr.length - 1 && <Line d={`M${col(c) + 170},40 L${col(c + 1)},40`} m="hbAcc" />}
          </g>))}
        {PIPELINE.states.filter((s) => s[2]).map(([l, c]) => (
          <g key={l}>
            <Line d={`M${col(c - 1) + 190},60 L${col(c) + 60},100`} m={l === "ARCHIVE_FAILED" ? "hbAmb" : "hbRed"} dash />
            <Box x={col(c)} y={100} w={170} h={40} label={l} kind={l === "ARCHIVE_FAILED" ? "warn" : "bad"} />
          </g>))}
        <Line d={`M${col(1) + 40},100 L${col(0) + 120},60`} m="hbArr" dash label="corrected file" lx={col(0) + 150} ly={92} />
        <Line d={`M${col(2) + 40},100 L${col(2) + 40},60`} m="hbArr" dash label="retry when safe" lx={col(2) + 46} ly={84} />
        <Line d={`M${col(3) + 85},100 L${col(3) + 85},60`} m="hbArr" dash label="archive only" lx={col(3) + 91} ly={84} />
      </svg>);
  };

  const Errors = () => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
      <thead><tr style={{ textAlign: "left", color: sub, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {["Scenario", "State and reason", "The business sees", "Integration 360 shows"].map((h) => <th key={h} style={{ padding: "6px 10px", borderBottom: `1px solid ${border}` }}>{h}</th>)}</tr></thead>
      <tbody>{PIPELINE.errors.map((e) => (
        <tr key={e[0]}>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${border}`, fontWeight: 700, color: text }}>{e[0]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${border}`, fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: /QUARANTINED|FAIL/.test(e[1]) ? RED : /ARCHIVE_FAILED/.test(e[1]) ? AMBER : text }}>{e[1]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${border}`, color: sub }}>{e[2]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${border}`, color: TEAL, fontWeight: 600 }}>{e[3]}</td>
        </tr>))}</tbody>
    </table>);

  return (
    <div>
      <SectionHeader t={t}>{ROLE.title}{" \u00b7 business view"}</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, color: text, flex: 1, minWidth: 280 }}>{ROLE.line}</div>
        <span role="button" tabIndex={0} onClick={copy} style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 14px", borderRadius: 6, background: NAVY, color: "#fff", cursor: "pointer" }}>
          {copied || "Copy as Markdown"}</span>
      </div>

      <H hint="sources on the left, consumers on the right, four lanes through the middle">What it does</H>
      <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: panel }}><Context /></div>

      <H>Where it is used</H>
      <Tiles rows={USES} icon />

      <H hint="the hub is the source of truth for these; Lineage, Impact Analysis and Variance 360 read from it">What it governs</H>
      <Tiles rows={GOVERNS} cols={4} />

      <div style={{ marginTop: 28, border: `1px solid ${TEAL}`, borderLeft: `6px solid ${TEAL}`, borderRadius: 10, padding: "14px 18px", background: "#e6f4f20f" }}>
        <div style={{ fontWeight: 700, color: text, fontSize: 13 }}>Integration 360 - Run in place of Quality Guardrails</div>
        <div style={{ fontSize: 11.5, color: sub, margin: "4px 0 10px" }}>{I360.line}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
          {I360.rows.map(([h, b]) => <div key={h} style={{ fontSize: 11 }}><b style={{ color: TEAL }}>{h}</b><div style={{ color: sub }}>{b}</div></div>)}
        </div>
      </div>

      <H hint="file to published holding, with the two places it can leave the path">{PIPELINE.title}</H>
      <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: panel }}><Flow /></div>

      <H hint="one Airflow run per business date; the sensor waits, the load is mapped per file, dbt runs the three layers">The DAG</H>
      <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: panel }}><Dag /></div>

      <H hint="what a column goes through on the way">Data lineage</H>
      <Lineage />

      <H hint="every file has one of these states; red leaves the path, amber is housekeeping">Error handling</H>
      <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: panel }}><States /></div>
      <div style={{ marginTop: 12, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", background: panel }}><Errors /></div>
    </div>);
}
