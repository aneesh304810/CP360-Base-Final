import React, { useState, useMemo } from "react";
import { SectionHeader } from "./AppShell.jsx";
import LineageGraph from "./LineageGraph.jsx";
import HubErrorPlay from "./HubErrorPlay.jsx";
import { PLAYS } from "./hubErrorPlays.js";
import { ROLE, USES, GOVERNS, SOLVES, WITHOUT, SEVERITY_COLOR, businessMarkdown } from "./hubBusiness.js";
import { PIPELINES, CHANNELS, byChannel, counts, statusOf, STATUS_COLOR, STATUS_WORD, pipelineView } from "./hubPipelines.js";

// HubBusiness: CP Integration Hub for a business audience. Diagrams and tiles
// with one-line captions, then the pipeline catalogue (PipelineCatalog, also
// the first tab of Integration 360 - Run): every pipeline with its status, and
// for the open one its business details, flow, DAG, column lineage, states and
// the Quality Guardrails cases replayed through it.

const NAVY = "#10193b", BLUE = "#1168bd", TEAL = "#0e8f7e", RED = "#cc3344", AMBER = "#e0a13d", MUTE = "#5c7c94";
const MONO = "ui-monospace, monospace";

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
      {pill("business", "Business view", "what the hub does, where it is used, the pipelines")}
    </div>);
}

/* ------------------------------------------------------------------ shared bits */
const useTheme = (t) => ({ border: t.border || "#d9dee3", sub: t.sub || "#4a5560", text: t.text || "#1a1a1a", panel: t.panel || "#fff" });
const Defs = () => (
  <defs>
    {[["hbArr", MUTE], ["hbAcc", TEAL], ["hbRed", RED], ["hbAmb", AMBER]].map(([id, c]) => (
      <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>))}
  </defs>);
const Box = ({ x, y, w, h = 46, label, s, kind, on, selected }) => {
  const fill = kind === "ext" ? "#f2eefa" : kind === "acc" ? "#e6f4f2" : kind === "hub" ? NAVY : kind === "bad" ? "#fae0e2" : kind === "warn" ? "#fdf1d8" : kind === "mute" ? "#f6f8fa" : "#fff";
  const stroke = kind === "ext" ? "#6d3ac0" : kind === "acc" ? TEAL : kind === "hub" ? NAVY : kind === "bad" ? RED : kind === "warn" ? AMBER : kind === "mute" ? "#b8c4ce" : BLUE;
  const fg = kind === "hub" ? "#fff" : NAVY;
  return (
    <g onClick={on} style={on ? { cursor: "pointer" } : undefined} role={on ? "button" : undefined}>
      <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={selected ? NAVY : stroke} strokeWidth={selected ? 2.6 : 1.4} strokeDasharray={kind === "mute" ? "5 4" : undefined} />
      <text x={x + w / 2} y={y + (s ? 19 : h / 2 + 4)} fontSize="11" fontWeight="700" fill={fg} textAnchor="middle">{label.length > 18 ? label.slice(0, 17) + "\u2026" : label}</text>
      {s && <text x={x + w / 2} y={y + 34} fontSize="8.5" fill={kind === "hub" ? "#a9c1de" : MUTE} textAnchor="middle">{s}</text>}
    </g>);
};
const Line = ({ d, m = "hbArr", dash, label, lx, ly, c }) => (
  <g>
    <path d={d} fill="none" stroke={c || (m === "hbAcc" ? TEAL : m === "hbRed" ? RED : m === "hbAmb" ? AMBER : MUTE)} strokeWidth={1.3} strokeDasharray={dash ? "4 4" : undefined} markerEnd={`url(#${m})`} />
    {label && <text x={lx} y={ly} fontSize="8.5" fontStyle="italic" fill={c || MUTE}>{label}</text>}
  </g>);
const H = ({ t, children, hint }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "34px 0 12px", flexWrap: "wrap" }}>
    <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text || "#1a1a1a", margin: 0 }}>{children}</h2>
    {hint && <span style={{ fontSize: 11.5, color: t.sub || "#4a5560" }}>{hint}</span>}
  </div>);
const Dot = ({ status, size = 10 }) => <span style={{ display: "inline-block", width: size, height: size, borderRadius: size, background: STATUS_COLOR[status], flex: "0 0 auto" }} />;
const Chip = ({ bg, fg, children }) => <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;

/* ------------------------------------------------------------------ the catalogue */
export function PipelineList({ t, open, onOpen }) {
  const th = useTheme(t);
  const c = counts();
  return (
    <div data-list="pipelines">
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 11.5, color: th.sub }}>
        <b style={{ color: th.text }}>{PIPELINES.length} pipelines</b>
        {["green", "red", "amber", "planned"].filter((k) => c[k]).map((k) => <span key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Dot status={k} /> {c[k]} {STATUS_WORD[k]}</span>)}
        <span style={{ marginLeft: "auto" }}>click a pipeline to open it</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        {byChannel().map((ch) => (
          <div key={ch.key} style={{ border: `1px solid ${th.border}`, borderRadius: 10, background: th.panel, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: NAVY, color: "#fff" }}>
              <b style={{ fontSize: 12 }}>{ch.name}</b><span style={{ fontSize: 10, color: "#a9c1de" }}>{ch.dir}{" \u00b7 "}{ch.tag}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#a9c1de" }}>{ch.pipelines.length}</span>
            </div>
            {ch.pipelines.map((p) => {
              const st = statusOf(p), on = open === p.id;
              const cs = p.cases.map((x) => x.id);
              return (
                <div key={p.id} role="button" tabIndex={0} aria-pressed={on} data-pipeline={p.id} onClick={() => onOpen(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(p.id); }}
                  style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", gap: 10, alignItems: "start", padding: "9px 12px", borderTop: `1px solid ${th.border}`, cursor: "pointer", background: on ? "#eaf1fb" : "transparent" }}>
                  <div style={{ paddingTop: 3 }}><Dot status={st} /></div>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b style={{ fontSize: 12.5, color: th.text }}>{p.name}</b>
                      <Chip bg={p.domain === "Accounting" ? "#e6f4f2" : "#f2eefa"} fg={p.domain === "Accounting" ? TEAL : "#6d3ac0"}>{p.domain}</Chip>
                      {p.planned && <Chip bg="#f6f8fa" fg={MUTE}>later</Chip>}
                    </div>
                    <div style={{ fontSize: 10.5, color: th.sub, marginTop: 2 }}>{p.source} <span style={{ color: TEAL }}>{"\u2192"}</span> {p.destination}{" \u00b7 "}{p.cadence}</div>
                    {cs.length > 0 && <div style={{ fontSize: 10.5, color: st === "amber" ? AMBER : RED, marginTop: 2, fontFamily: MONO }}>{cs.join(", ")}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[st], paddingTop: 3 }}>{STATUS_WORD[st]}</span>
                </div>);
            })}
          </div>))}
      </div>
    </div>);
}

export function PipelineCatalog({ t, initial }) {
  const th = useTheme(t);
  const [pid, setPid] = useState(initial?.pipeline || "file-pos");
  const p = PIPELINES.find((x) => x.id === pid) || PIPELINES[0];
  const view = useMemo(() => pipelineView(p), [p]);
  const status = statusOf(p);
  const [scen, setScen] = useState(initial?.scenario || (view.cases[0] && view.cases[0].id) || null);
  const S = view.cases.find((x) => x.id === scen) || view.cases[0] || null;
  const openPipeline = (id) => { const nv = pipelineView(PIPELINES.find((x) => x.id === id)); setPid(id); setScen(nv.cases[0] ? nv.cases[0].id : null); };
  const graph = useMemo(() => (S ? { ...view.graph, focus: S.column } : view.graph), [S, view]);
  const ch = CHANNELS[p.channel];
  const f = S ? S.flow : -1, fd = S ? S.dagTask : -1;

  const Header = () => (
    <div data-pipeline-open={p.id} style={{ border: `1px solid ${th.border}`, borderLeft: `6px solid ${STATUS_COLOR[status]}`, borderRadius: 10, background: th.panel, padding: "14px 18px", marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Dot status={status} size={12} /><b style={{ fontSize: 16, color: th.text }}>{p.name}</b>
        <Chip bg="#eaf1fb" fg={BLUE}>{ch.name}</Chip>
        <Chip bg={p.domain === "Accounting" ? "#e6f4f2" : "#f2eefa"} fg={p.domain === "Accounting" ? TEAL : "#6d3ac0"}>{p.domain}</Chip>
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[status] }}>{STATUS_WORD[status]}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: th.sub }}>{p.source} <span style={{ color: TEAL }}>{"\u2192"}</span> {p.destination}{" \u00b7 "}{p.cadence}</span>
      </div>
      <div style={{ fontSize: 12.5, color: th.text, marginTop: 8, lineHeight: 1.5 }}>{p.business}</div>
    </div>);

  const Flow = () => {
    const n = view.flow.length, w = 120, gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    const kindOf = (i) => f >= 0 && i === f ? "bad" : f >= 0 && i > f ? "mute" : "acc";
    return (
      <svg viewBox="0 0 1000 140" width="100%" style={{ display: "block" }} role="img" aria-label="where in the flow">
        <Defs />
        {view.flow.map(([l, s], i) => (
          <g key={l}>
            <Box x={X(i)} y={20} w={w} h={52} label={l} s={f >= 0 && i > f ? "waits" : f === i ? "failed here" : "ok"} kind={kindOf(i)} />
            <foreignObject x={X(i) - 6} y={78} width={w + 12} height={56}>
              <div style={{ fontSize: 8.5, color: MUTE, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
            {i < n - 1 && <Line d={`M${X(i) + w},46 L${X(i + 1)},46`} m={f >= 0 && i >= f ? "hbArr" : "hbAcc"} dash={f >= 0 && i >= f} />}
          </g>))}
      </svg>);
  };
  const Dag = () => {
    const n = view.dag.length, w = Math.min(104, Math.floor((960 - (n - 1) * 20) / n)), gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    return (
      <svg viewBox="0 0 1000 70" width="100%" style={{ display: "block" }} role="img" aria-label="which task">
        <Defs />
        {view.dag.map(([l], i) => (
          <g key={l}>
            <rect x={X(i)} y={14} width={w} height={40} rx="20" fill={fd === i ? "#fae0e2" : fd >= 0 && i > fd ? "#f6f8fa" : "#e6f4f2"} stroke={fd === i ? RED : fd >= 0 && i > fd ? "#b8c4ce" : TEAL} strokeWidth={fd === i ? 2.2 : 1.4} strokeDasharray={fd >= 0 && i > fd ? "5 4" : undefined} />
            <text x={X(i) + w / 2} y={fd === i || (fd >= 0 && i > fd) ? 32 : 38} fontSize="9.5" fontWeight="700" fill={NAVY} textAnchor="middle">{l}</text>
            {fd === i && <text x={X(i) + w / 2} y={46} fontSize="8" fontWeight="700" fill={RED} textAnchor="middle">failed</text>}
            {fd >= 0 && i > fd && <text x={X(i) + w / 2} y={46} fontSize="8" fill={MUTE} textAnchor="middle">upstream_failed</text>}
            {i < n - 1 && <Line d={`M${X(i) + w},34 L${X(i + 1)},34`} dash={fd >= 0 && i >= fd} />}
          </g>))}
      </svg>);
  };

  const KVs = ({ rows }) => (
    <table style={{ fontSize: 10.5, borderCollapse: "collapse" }}><tbody>
      {rows.map(([k, v]) => <tr key={k}><td style={{ color: th.sub, padding: "2px 10px 2px 0", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 0.3, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td><td style={{ color: th.text, fontFamily: MONO }}>{v}</td></tr>)}
    </tbody></table>);
  const col = (title, body, accent) => (
    <div style={{ padding: "12px 14px", background: th.panel, minWidth: 0, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>{body}</div>);
  const Record = () => S ? (
    <div data-record={S.id} style={{ border: `1px solid ${th.border}`, borderRadius: 10, marginTop: 12, background: th.panel, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: NAVY, color: "#fff", flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5 }}>What went wrong</b>
        <Chip bg={SEVERITY_COLOR[S.severity]} fg="#fff">{S.severity.toUpperCase()}</Chip>
        <Chip bg="#ffffff22" fg="#fff">{S.kind}</Chip>
        <span style={{ fontSize: 10.5, color: "#a9c1de" }}>{S.engine}{" \u00b7 "}{S.dag}</span>
        {view.cases.length > 1 && <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{view.cases.map((x) => (
          <span key={x.id} role="button" tabIndex={0} aria-pressed={x.id === S.id} onClick={() => setScen(x.id)} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999, cursor: "pointer", background: x.id === S.id ? "#fff" : "transparent", color: x.id === S.id ? NAVY : "#fff", border: "1px solid #a9c1de" }}>{x.id}</span>))}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 1, background: th.border }}>
        {col("The error", <div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: RED }}>{S.rule}</div>
          <div style={{ fontSize: 12, color: th.text, margin: "6px 0 8px", lineHeight: 1.45 }}>{S.message}</div>
          <KVs rows={[["expected", S.expectation], ["observed", S.observed], ["threshold", S.threshold], ["rows", S.total ? `${S.bad.toLocaleString()} of ${S.total.toLocaleString()}` : "n/a"]]} /></div>, RED)}
        {col("Where it happened", <div style={{ fontSize: 11.5, color: th.text, lineHeight: 1.6 }}>
          <div><b>Step:</b> {view.flow[S.flow][0]} <span style={{ color: RED, fontWeight: 700 }}>failed here</span>; everything after it waits</div>
          <div><b>Task:</b> <span style={{ fontFamily: MONO }}>{view.dag[S.dagTask][0]}</span></div>
          <div><b>Column:</b> <span style={{ fontFamily: MONO }}>{S.column.split(":").slice(1).join(".")}</span> <span style={{ color: th.sub }}>(traced in the lineage below)</span></div>
          <div><b>Record:</b> {S.registry}</div></div>, AMBER)}
        {col("The issue, and what to do", <div style={{ fontSize: 11.5, color: th.text, lineHeight: 1.5 }}>
          <div><b>Root cause.</b> {S.cause}</div>
          <div style={{ marginTop: 6, color: TEAL, fontWeight: 600 }}>{S.i360}</div>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: MONO, marginTop: 8 }}>
            <thead><tr>{Object.keys(S.sample[0]).map((k) => <th key={k} style={{ textAlign: "left", color: th.sub, padding: "2px 8px 3px 0", fontWeight: 600 }}>{k}</th>)}</tr></thead>
            <tbody>{S.sample.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} style={{ padding: "2px 8px 2px 0", color: /^null$|MISSING|REORG/.test(String(v)) ? RED : th.text }}>{String(v)}</td>)}</tr>)}</tbody>
          </table></div>, TEAL)}
      </div>
    </div>) : (
    <div data-healthy={p.id} style={{ border: `1px solid ${TEAL}`, borderLeft: `6px solid ${TEAL}`, borderRadius: 10, marginTop: 12, padding: "12px 16px", background: th.panel, fontSize: 12, color: th.text }}>
      <b style={{ color: TEAL }}>{p.planned ? "Not live yet." : "Nothing wrong today."}</b> {p.planned ? "Shown so the shape is agreed before it is built." : "Every step on the path completed and reconciled; the latest business date is closed."}
    </div>);

  return (
    <div>
      <H t={t} hint="green is healthy; red says what is wrong, where, and why">Pipelines</H>
      <PipelineList t={t} open={p.id} onOpen={openPipeline} />
      <Header />
      <Record />
      <H t={t} hint="the step that failed is red; everything after it waits">Where in the flow</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 12px 0", background: th.panel }}><Flow /><Dag /></div>
      <H t={t} hint="the column the error is about, traced through the transformations">Where in the data</H>
      <LineageGraph t={t} graph={graph} dataSource="IMDS" />
    </div>);
}

/* ------------------------------------------------------------------ the business view */
const TABS = ["What it is", "Error handling"];
export default function HubBusiness({ t, initial }) {
  const th = useTheme(t);
  const [tab, setTab] = useState(initial?.tab || TABS[0]);
  const [copied, setCopied] = useState("");
  const copy = () => {
    const md = businessMarkdown(PLAYS);
    try { navigator.clipboard?.writeText(md); } catch { /* no clipboard: nothing to do */ }
    setCopied("copied"); setTimeout(() => setCopied(""), 1500);
  };

  /* without the hub: every source to every destination */
  const Without = () => {
    const L = WITHOUT.sources, R = WITHOUT.destinations;
    return (
      <svg viewBox="0 0 480 300" width="100%" style={{ display: "block" }} role="img" aria-label="without a hub: every source wired to every destination">
        <Defs />
        {L.map((l, i) => <Box key={l} x={16} y={30 + i * 62} w={140} h={40} label={l} kind="ext" />)}
        {R.map((l, i) => <Box key={l} x={324} y={30 + i * 62} w={140} h={40} label={l} kind="acc" />)}
        {L.map((_, i) => R.map((__, j) => <path key={`${i}-${j}`} d={`M156,${50 + i * 62} C240,${50 + i * 62} 240,${50 + j * 62} 324,${50 + j * 62}`} fill="none" stroke={(i + j) % 3 === 0 ? RED : MUTE} strokeWidth={1} opacity={0.55} strokeDasharray={(i + j) % 4 === 0 ? "3 3" : undefined} />))}
        <text x={240} y={292} fontSize="9" fill={RED} textAnchor="middle">{WITHOUT.line}</text>
      </svg>);
  };
  /* with the hub */
  const Context = () => {
    const W = 980, hubX = 330, hubW = 320, hubY = 20, hubH = 250;
    return (
      <svg viewBox={`0 0 ${W} 300`} width="100%" style={{ display: "block" }} role="img" aria-label="with the hub: sources, the hub and its consumers">
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
  /* what it does: five verbs */
  const VERB_LINES = { receive: "events, files, loader requests and API calls, each with a record", validate: "structure, counts and required fields, at the door", translate: "SEI's shapes into BBH's, by one set of versioned rules", reconcile: "rows promised against rows loaded; the date closes only when complete", publish: "one stable shape per consumer: PBDW, Pivotal, IMDS, SEI" };
  const Verbs = () => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${ROLE.verbs.length}, minmax(0,1fr))`, gap: 0 }}>
      {ROLE.verbs.map((v, i) => (
        <div key={v} style={{ position: "relative", padding: "12px 18px 12px 26px", background: i % 2 ? "#15224f" : NAVY, color: "#fff", clipPath: i === ROLE.verbs.length - 1 ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)" : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: "capitalize" }}>{i + 1}. {v}</div>
          <div style={{ fontSize: 10.5, color: "#a9c1de", marginTop: 3, lineHeight: 1.4 }}>{VERB_LINES[v]}</div>
        </div>))}
    </div>);
  const Tiles = ({ rows, cols = 3, icon }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>
      {rows.map((r) => {
        const [ic, h, b] = icon ? r : ["", r[0], r[1]];
        return (
          <div key={h} style={{ border: `1px solid ${th.border}`, borderRadius: 10, padding: "14px 16px", background: th.panel, display: "flex", gap: 12 }}>
            {icon && <div style={{ width: 38, height: 38, borderRadius: 10, background: NAVY, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, flex: "0 0 auto" }}>{ic}</div>}
            <div><div style={{ fontWeight: 700, color: th.text, fontSize: 13 }}>{h}</div>
              <div style={{ fontSize: 11.5, color: th.sub, marginTop: 3, lineHeight: 1.45 }}>{b}</div></div>
          </div>);
      })}
    </div>);
  const Solves = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
      {SOLVES.map(([problem, how]) => (
        <div key={problem} style={{ border: `1px solid ${th.border}`, borderRadius: 10, background: th.panel, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#fae0e2", color: "#8e1b2b", fontSize: 11.5, fontWeight: 700, lineHeight: 1.4 }}>{"\u2716"} {problem}</div>
          <div style={{ padding: "10px 14px", fontSize: 11.5, color: th.text, lineHeight: 1.45 }}><span style={{ color: TEAL, fontWeight: 800 }}>{"\u2714"} </span>{how}</div>
        </div>))}
    </div>);

  return (
    <div>
      <SectionHeader t={t}>{ROLE.title}{" \u00b7 business view"}</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((k) => <span key={k} role="tab" tabIndex={0} aria-selected={tab === k} onClick={() => setTab(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setTab(k); }}
            style={{ fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 6, cursor: "pointer", background: tab === k ? NAVY : "transparent", color: tab === k ? "#fff" : th.sub, border: `1px solid ${tab === k ? NAVY : th.border}` }}>{k}</span>)}
        </div>
        <div style={{ fontSize: 14, color: th.text, flex: 1, minWidth: 280 }}>{ROLE.line}</div>
        <span role="button" tabIndex={0} onClick={copy} style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 14px", borderRadius: 6, background: NAVY, color: "#fff", cursor: "pointer" }}>
          {copied || "Copy as Markdown"}</span>
      </div>

      {tab === "What it is" && <div data-tab="what">
        <H t={t} hint="left: without a hub; right: with it">The problem it solves</H>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div style={{ border: `1px solid ${RED}55`, borderRadius: 12, padding: 12, background: th.panel }}><div style={{ fontSize: 11, fontWeight: 800, color: RED, marginBottom: 4 }}>WITHOUT A HUB</div><Without /></div>
          <div style={{ border: `1px solid ${TEAL}`, borderRadius: 12, padding: 12, background: th.panel }}><div style={{ fontSize: 11, fontWeight: 800, color: TEAL, marginBottom: 4 }}>WITH CP INTEGRATION HUB</div><Context /></div>
        </div>
        <div style={{ marginTop: 12 }}><Solves /></div>

        <H t={t} hint="five things, in order, to every movement">What it does</H>
        <Verbs />

        <H t={t}>Where it is used</H>
        <Tiles rows={USES} icon />

        <H t={t} hint="the hub is the source of truth for these; Lineage, Impact Analysis and Variance 360 read from it">What it governs</H>
        <Tiles rows={GOVERNS} cols={4} />
      </div>}

      {tab === "Error handling" && <div data-tab="errors">
        <H t={t} hint="pick a scenario and watch it play: where it goes wrong, how the hub handles it, how it is replayed">Error handling</H>
        <HubErrorPlay t={t} initial={initial?.play ? { play: initial.play, frame: initial.frame, running: initial.running } : undefined} />
      </div>}
    </div>);
}
