import React, { useState, useMemo } from "react";
import { SectionHeader } from "./AppShell.jsx";
import LineageGraph from "./LineageGraph.jsx";
import { ROLE, USES, GOVERNS, I360, SEVERITY_COLOR, businessMarkdown } from "./hubBusiness.js";
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
  const [sel, setSel] = useState(initial?.sel || { kind: "flow", i: (initial?.scenario && view.cases.find((x) => x.id === initial.scenario)?.flow) ?? 1 });
  const [fail, setFail] = useState(!!initial?.fail || !!initial?.scenario);
  const [scen, setScen] = useState(initial?.scenario || null);
  const S = scen ? view.cases.find((x) => x.id === scen) : null;
  const openPipeline = (id) => { const np = PIPELINES.find((x) => x.id === id); const nv = pipelineView(np); const first = nv.cases[0]; setPid(id); setScen(first ? first.id : null); setFail(!!first); setSel({ kind: "flow", i: first ? first.flow : 1 }); };
  const pickFlow = (i) => { setSel({ kind: "flow", i }); setScen(null); };
  const pickDag = (i) => { setSel({ kind: "dag", i }); setScen(null); };
  const pickScen = (id) => { const x = view.cases.find((y) => y.id === id); if (!x) return; setScen(id); setFail(true); setSel({ kind: "flow", i: x.flow }); };
  const isSel = (kind, i) => sel.kind === kind && sel.i === i;
  const failedAt = (kind) => S ? (kind === "flow" ? S.flow : S.dagTask) : (fail && sel.kind === kind ? sel.i : -1);
  const graph = useMemo(() => (S ? { ...view.graph, focus: S.column } : view.graph), [S, view]);
  const ch = CHANNELS[p.channel];

  /* ---- header: the business details ---- */
  const Header = () => (
    <div data-pipeline-open={p.id} style={{ border: `1px solid ${th.border}`, borderLeft: `6px solid ${STATUS_COLOR[status]}`, borderRadius: 10, background: th.panel, padding: "14px 18px", marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Dot status={status} size={12} /><b style={{ fontSize: 16, color: th.text }}>{p.name}</b>
        <Chip bg="#eaf1fb" fg={BLUE}>{ch.name}</Chip>
        <Chip bg={p.domain === "Accounting" ? "#e6f4f2" : "#f2eefa"} fg={p.domain === "Accounting" ? TEAL : "#6d3ac0"}>{p.domain}</Chip>
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[status] }}>{STATUS_WORD[status]}</span>
      </div>
      <div style={{ fontSize: 13, color: th.text, margin: "8px 0 10px", lineHeight: 1.5 }}>{p.business}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, fontSize: 11 }}>
        {[["From", p.source], ["To", p.destination], ["How", `${ch.dir} \u00b7 ${p.cadence}`], ["Volume", p.volume], ["Read by", p.consumers.join(", ")]].map(([k, v]) => (
          <div key={k}><div style={{ fontSize: 9.5, fontWeight: 800, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</div><div style={{ color: th.text }}>{v}</div></div>))}
      </div>
    </div>);

  /* ---- the flow ---- */
  const Flow = () => {
    const n = view.flow.length, w = 120, gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    const f = failedAt("flow");
    const kindOf = (i) => f >= 0 && i === f ? "bad" : f >= 0 && i > f ? "mute" : i === 0 || i === n - 1 ? "ext" : i === 2 ? "acc" : "box";
    return (
      <svg viewBox="0 0 1000 230" width="100%" style={{ display: "block" }} role="img" aria-label="pipeline flow">
        <Defs />
        {view.flow.map(([l, s], i) => (
          <g key={l}>
            <Box x={X(i)} y={30} w={w} h={52} label={l} s={f >= 0 && i > f ? "waits" : f === i ? "failed here" : ""} kind={kindOf(i)} on={() => pickFlow(i)} selected={isSel("flow", i)} />
            <foreignObject x={X(i) - 6} y={88} width={w + 12} height={44}>
              <div style={{ fontSize: 8.5, color: MUTE, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
            {i < n - 1 && <Line d={`M${X(i) + w},56 L${X(i + 1)},56`} m={f >= 0 && i >= f ? "hbArr" : "hbAcc"} dash={f >= 0 && i >= f} />}
          </g>))}
        {view.branches.map(([at, l, s], i) => (
          <g key={l}>
            <Line d={`M${X(at) + w / 2},126 L${X(at) + w / 2},152`} m={i === 0 ? "hbRed" : "hbAmb"} dash />
            <Box x={X(at)} y={152} w={w} h={36} label={l} kind={i === 0 ? "bad" : "warn"} selected={f === at} />
            <foreignObject x={X(at) - 6} y={192} width={w + 12} height={36}>
              <div style={{ fontSize: 8.5, color: i === 0 ? RED : AMBER, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
          </g>))}
        <text x={X(0)} y={18} fontSize="9" fill={MUTE}>{p.file || p.requestLine || p.template || ""}</text>
        <text x={980} y={18} fontSize="9" fill={MUTE} textAnchor="end">click a box</text>
      </svg>);
  };

  /* ---- the DAG ---- */
  const Dag = () => {
    const n = view.dag.length, w = Math.min(104, Math.floor((960 - (n - 1) * 20) / n)), gap = 20, x0 = 20;
    const X = (i) => x0 + i * (w + gap);
    const f = failedAt("dag");
    const fill = (i) => f === i ? "#fae0e2" : f >= 0 && i > f ? "#f6f8fa" : /wait|sensor|box_microbatch/.test(view.dag[i][0] + view.dag[i][1]) ? "#fdf1d8" : /load|pull/.test(view.dag[i][0]) ? "#e6f4f2" : /dbt/.test(view.dag[i][0]) ? "#eaf1fb" : "#fff";
    const stroke = (i) => f === i ? RED : f >= 0 && i > f ? "#b8c4ce" : /wait|sensor|box_microbatch/.test(view.dag[i][0] + view.dag[i][1]) ? AMBER : /load|pull/.test(view.dag[i][0]) ? TEAL : BLUE;
    return (
      <svg viewBox="0 0 1000 128" width="100%" style={{ display: "block" }} role="img" aria-label="airflow dag">
        <Defs />
        {view.dag.map(([l, s], i) => (
          <g key={l} onClick={() => pickDag(i)} style={{ cursor: "pointer" }} role="button">
            <rect x={X(i)} y={20} width={w} height={40} rx="20" fill={fill(i)} stroke={isSel("dag", i) ? NAVY : stroke(i)} strokeWidth={isSel("dag", i) ? 2.6 : 1.4} strokeDasharray={f >= 0 && i > f ? "5 4" : undefined} />
            <text x={X(i) + w / 2} y={f === i || (f >= 0 && i > f) ? 40 : 44} fontSize="9.5" fontWeight="700" fill={NAVY} textAnchor="middle">{l}</text>
            {f === i && <text x={X(i) + w / 2} y={52} fontSize="8" fontWeight="700" fill={RED} textAnchor="middle">failed</text>}
            {f >= 0 && i > f && <text x={X(i) + w / 2} y={52} fontSize="8" fill={MUTE} textAnchor="middle">upstream_failed</text>}
            <foreignObject x={X(i) - 8} y={66} width={w + 16} height={56}>
              <div style={{ fontSize: 8.5, color: MUTE, textAlign: "center", lineHeight: 1.3 }}>{s}</div></foreignObject>
            {i < n - 1 && <Line d={`M${X(i) + w},40 L${X(i + 1)},40`} dash={f >= 0 && i >= f} />}
          </g>))}
      </svg>);
  };

  /* ---- the panel under a selected box ---- */
  const KV = ({ row, dim }) => (
    <table style={{ borderCollapse: "collapse", fontSize: 10.5, fontFamily: MONO, width: "100%" }}><tbody>
      {Object.entries(row || {}).map(([k, v]) => (
        <tr key={k}><td style={{ padding: "2px 8px 2px 0", color: dim ? MUTE : th.sub, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
          <td style={{ padding: "2px 0", color: dim ? MUTE : th.text, fontWeight: dim ? 400 : 600 }}>{String(v)}</td></tr>))}
    </tbody></table>);
  const Panel = () => {
    const head = (title, right) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: NAVY, color: "#fff", borderRadius: "10px 10px 0 0" }}>
        <b style={{ fontSize: 12.5 }}>{title}</b><span style={{ flex: 1 }} />{right}</div>);
    const failSwitch = (
      <span role="switch" aria-checked={fail} tabIndex={0} onClick={() => { setFail(!fail); if (fail) setScen(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFail(!fail); }}
        style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, cursor: "pointer", background: fail ? RED : "#ffffff22", border: `1px solid ${fail ? RED : "#a9c1de"}`, color: "#fff" }}>
        {S ? `${S.id}: ${S.rule}` : fail ? "showing a failure here" : "show a failure here"}</span>);
    const col = (title, body, bg) => (
      <div style={{ padding: "12px 14px", background: bg || th.panel, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>{body}</div>);
    if (sel.kind === "dag") {
      const d = view.dagDetail[sel.i];
      return (
        <div data-panel="dag" style={{ border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
          {head(`Task ${sel.i + 1} of ${view.dagDetail.length}: ${d.task}`, failSwitch)}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 1, background: th.border }}>
            {col("What the task does", <div style={{ fontSize: 11.5, color: th.text, lineHeight: 1.5 }}>{d.does}</div>)}
            {col("If it fails", <div style={{ fontSize: 11.5, color: th.text, lineHeight: 1.5 }}><span style={{ color: RED, fontWeight: 700 }}>task failed. </span>{d.onFail}</div>, fail ? "#fae0e21a" : undefined)}
            {col("Then", <div style={{ fontSize: 11.5, color: th.text, lineHeight: 1.5 }}><div><b>Retry:</b> {d.retry}</div><div style={{ marginTop: 4 }}><b>Downstream:</b> <span style={{ color: MUTE }}>{d.downstream}</span></div></div>)}
          </div>
        </div>);
    }
    const d = view.steps[sel.i], prev = sel.i > 0 ? view.steps[sel.i - 1] : null;
    if (!d) return null;
    return (
      <div data-panel="flow" style={{ border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
        {head(`Step ${sel.i + 1} of ${view.steps.length}: ${d.step}`, failSwitch)}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.1fr 1.1fr", gap: 1, background: th.border }}>
          {col("What happens here", <div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: th.text, lineHeight: 1.5 }}>{d.does.map((x) => <li key={x}>{x}</li>)}</ul>
            <div style={{ fontSize: 10.5, color: th.sub, marginTop: 8 }}><b>In:</b> {d.in}</div>
            <div style={{ fontSize: 10.5, color: th.sub }}><b>Out:</b> {d.out}</div></div>)}
          {col("The sample row, before and after", <div>
            {prev && prev.row && <><div style={{ fontSize: 9.5, color: MUTE, marginBottom: 2 }}>before ({prev.step})</div><KV row={prev.row} dim /><div style={{ color: TEAL, fontSize: 14, margin: "4px 0" }}>{"\u2193"}</div></>}
            <div style={{ fontSize: 9.5, color: TEAL, marginBottom: 2 }}>after ({d.step})</div><KV row={d.row} /></div>)}
          {col("If it fails here", <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
            {d.fails.map(([code, then, biz], i) => (
              <div key={code} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: `3px solid ${fail && i === 0 ? RED : th.border}` }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: RED }}>{code}</div>
                <div style={{ color: th.text }}>{then}</div>
                <div style={{ color: th.sub, fontSize: 11 }}>{biz}</div></div>))}
          </div>, fail ? "#fae0e21a" : undefined)}
        </div>
      </div>);
  };

  /* ---- the cases and the record ---- */
  const Cases = () => view.cases.length > 0 && (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0 0" }}>
      <span style={{ fontSize: 11, color: th.sub, fontWeight: 700 }}>Replay a Quality Guardrails case on this pipeline:</span>
      {view.cases.map((x) => (
        <span key={x.id} role="button" tabIndex={0} aria-pressed={scen === x.id} onClick={() => pickScen(x.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pickScen(x.id); }}
          style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${scen === x.id ? NAVY : th.border}`, background: scen === x.id ? NAVY : th.panel, color: scen === x.id ? "#fff" : th.text, display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: x.status === "warning" ? AMBER : SEVERITY_COLOR[x.severity] }} />
          <b>{x.id}</b><span style={{ fontFamily: MONO }}>{x.rule}</span></span>))}
      {scen && <span role="button" tabIndex={0} onClick={() => { setScen(null); setFail(false); }} style={{ fontSize: 10.5, color: th.sub, cursor: "pointer", textDecoration: "underline" }}>clear</span>}
    </div>);
  const Record = () => S && (
    <div data-record={S.id} style={{ border: `1px solid ${SEVERITY_COLOR[S.severity]}`, borderLeft: `6px solid ${S.status === "warning" ? AMBER : SEVERITY_COLOR[S.severity]}`, borderRadius: 10, marginTop: 10, background: th.panel, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${th.border}`, flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5, color: th.text }}>Integration 360 record</b>
        <Chip bg={SEVERITY_COLOR[S.severity]} fg="#fff">{S.severity.toUpperCase()}</Chip>
        <Chip bg="#eaf1fb" fg={BLUE}>{S.kind}</Chip>
        <span style={{ fontSize: 10.5, color: th.sub }}>{S.engine}{" \u00b7 "}{S.dag}{" \u00b7 "}{S.status}</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: RED }}>{S.rule}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 1, background: th.border }}>
        <div style={{ padding: "12px 14px", background: th.panel }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: th.text }}>{S.message}</div>
          <table style={{ fontSize: 10.5, marginTop: 8, borderCollapse: "collapse" }}><tbody>
            {[["expected", S.expectation], ["observed", S.observed], ["threshold", S.threshold], ["rows", S.total ? `${S.bad.toLocaleString()} of ${S.total.toLocaleString()}` : "n/a"]].map(([k, v]) => (
              <tr key={k}><td style={{ color: th.sub, padding: "2px 10px 2px 0", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 0.3 }}>{k}</td><td style={{ color: th.text, fontFamily: MONO }}>{v}</td></tr>))}
          </tbody></table>
          <div style={{ fontSize: 11, color: th.sub, marginTop: 8 }}><b style={{ color: th.text }}>Root cause.</b> {S.cause}</div>
        </div>
        <div style={{ padding: "12px 14px", background: th.panel }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>The rows</div>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: MONO, width: "100%" }}>
            <thead><tr>{Object.keys(S.sample[0]).map((k) => <th key={k} style={{ textAlign: "left", color: th.sub, padding: "2px 6px 4px 0", fontWeight: 600 }}>{k}</th>)}</tr></thead>
            <tbody>{S.sample.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} style={{ padding: "2px 6px 2px 0", color: /^null$|MISSING|REORG/.test(String(v)) ? RED : th.text }}>{String(v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div style={{ padding: "12px 14px", background: th.panel }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Where it shows here</div>
          <div style={{ fontSize: 11, color: th.text, lineHeight: 1.55 }}>
            <div><b>Flow:</b> {view.flow[S.flow][0]} <span style={{ color: RED }}>failed here</span></div>
            <div><b>DAG:</b> <span style={{ fontFamily: MONO }}>{view.dag[S.dagTask][0]}</span> red, the tasks after it upstream_failed</div>
            <div><b>Lineage:</b> <span style={{ fontFamily: MONO }}>{S.column.split(":").slice(1).join(".")}</span> traced</div>
            <div><b>Registry:</b> {S.registry}</div>
            <div style={{ marginTop: 6, color: TEAL, fontWeight: 600 }}>{S.i360}</div>
          </div>
        </div>
      </div>
    </div>);

  /* ---- states ---- */
  const States = () => {
    const colX = (c) => 30 + c * 230;
    const main = view.states.filter((s) => !s[2]), side = view.states.filter((s) => s[2]);
    return (
      <svg viewBox="0 0 980 150" width="100%" style={{ display: "block" }} role="img" aria-label="lifecycle states">
        <Defs />
        {main.map(([l, c], i) => (
          <g key={l}>
            <Box x={colX(c)} y={20} w={170} h={40} label={l} kind={i === main.length - 1 ? "acc" : "box"} />
            {i < main.length - 1 && <Line d={`M${colX(c) + 170},40 L${colX(c + 1)},40`} m="hbAcc" />}
          </g>))}
        {side.map(([l, c], i) => (
          <g key={l}>
            <Line d={`M${colX(c - 1) + 190},60 L${colX(c) + 60},100`} m={i === side.length - 1 ? "hbAmb" : "hbRed"} dash />
            <Box x={colX(c)} y={100} w={170} h={40} label={l} kind={i === side.length - 1 ? "warn" : "bad"} />
          </g>))}
        {(view.loops || []).map(([c, label], i) => (
          i === 0
            ? <Line key={label} d={`M${colX(1) + 40},100 L${colX(0) + 120},60`} m="hbArr" dash label={label} lx={colX(0) + 150} ly={92} />
            : <Line key={label} d={`M${colX(c) + 40 + (i === 2 ? 45 : 0)},100 L${colX(c) + 40 + (i === 2 ? 45 : 0)},60`} m="hbArr" dash label={label} lx={colX(c) + 46 + (i === 2 ? 45 : 0)} ly={84} />))}
        {view.stateNote && <text x={30} y={142} fontSize="9" fill={MUTE}>{view.stateNote}</text>}
      </svg>);
  };
  const Errors = () => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
      <thead><tr style={{ textAlign: "left", color: th.sub, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {["Scenario", "State and reason", "The business sees", "Integration 360 shows"].map((h) => <th key={h} style={{ padding: "6px 10px", borderBottom: `1px solid ${th.border}` }}>{h}</th>)}</tr></thead>
      <tbody>{(view.errors || []).map((e, i) => (
        <tr key={i}>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${th.border}`, fontWeight: 700, color: th.text }}>{e[0]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${th.border}`, fontFamily: MONO, fontSize: 10.5, color: /QUARANTINED|FAIL/.test(e[1]) ? RED : /ARCHIVE_FAILED/.test(e[1]) ? AMBER : th.text }}>{e[1]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${th.border}`, color: th.sub }}>{e[2]}</td>
          <td style={{ padding: "8px 10px", borderBottom: `1px solid ${th.border}`, color: TEAL, fontWeight: 600 }}>{e[3] || "the step's state and reason, per interface and date"}</td>
        </tr>))}</tbody>
    </table>);

  return (
    <div>
      <H t={t} hint="green is healthy, red carries a failing Quality Guardrails case, amber a warning">Pipelines</H>
      <PipelineList t={t} open={p.id} onOpen={openPipeline} />
      <Header />

      <H t={t} hint="click a box to see what happens inside it, the sample row before and after, and what a failure there looks like">{p.name}: how the data moves</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 12, background: th.panel }}><Flow /></div>
      <Cases />
      <Record />
      {sel.kind === "flow" && <Panel />}

      <H t={t} hint={p.channel === "api" ? "service steps, not an Airflow run; click one to see what it does and what happens when it fails" : "one run per business date or box; click a task to see what it does and what happens when it fails"}>The DAG</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 12, background: th.panel }}><Dag /></div>
      {sel.kind === "dag" && <Panel />}

      <H t={t} hint="column level, drawn by the Lineage page's own graph: click a column to trace it, hover an edge for the transform">Data lineage</H>
      <LineageGraph t={t} graph={graph} dataSource="IMDS" />

      <H t={t} hint="every unit of work has one of these states; red leaves the path, amber is housekeeping or waiting">Error handling</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 12, background: th.panel }}><States /></div>
      <div style={{ marginTop: 12, border: `1px solid ${th.border}`, borderRadius: 12, overflow: "hidden", background: th.panel }}><Errors /></div>
    </div>);
}

/* ------------------------------------------------------------------ the business view */
export default function HubBusiness({ t, initial }) {
  const th = useTheme(t);
  const [copied, setCopied] = useState("");
  const copy = () => {
    const md = businessMarkdown();
    try { navigator.clipboard?.writeText(md); } catch { /* no clipboard: nothing to do */ }
    setCopied("copied"); setTimeout(() => setCopied(""), 1500);
  };

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

  return (
    <div>
      <SectionHeader t={t}>{ROLE.title}{" \u00b7 business view"}</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, color: th.text, flex: 1, minWidth: 280 }}>{ROLE.line}</div>
        <span role="button" tabIndex={0} onClick={copy} style={{ fontSize: 11.5, fontWeight: 700, padding: "7px 14px", borderRadius: 6, background: NAVY, color: "#fff", cursor: "pointer" }}>
          {copied || "Copy as Markdown"}</span>
      </div>

      <H t={t} hint="sources on the left, consumers on the right, four lanes through the middle">What it does</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 12, background: th.panel }}><Context /></div>

      <H t={t}>Where it is used</H>
      <Tiles rows={USES} icon />

      <H t={t} hint="the hub is the source of truth for these; Lineage, Impact Analysis and Variance 360 read from it">What it governs</H>
      <Tiles rows={GOVERNS} cols={4} />

      <div style={{ marginTop: 28, border: `1px solid ${TEAL}`, borderLeft: `6px solid ${TEAL}`, borderRadius: 10, padding: "14px 18px", background: "#e6f4f20f" }}>
        <div style={{ fontWeight: 700, color: th.text, fontSize: 13 }}>Integration 360 - Run in place of Quality Guardrails</div>
        <div style={{ fontSize: 11.5, color: th.sub, margin: "4px 0 10px" }}>{I360.line}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
          {I360.rows.map(([h, b]) => <div key={h} style={{ fontSize: 11 }}><b style={{ color: TEAL }}>{h}</b><div style={{ color: th.sub }}>{b}</div></div>)}
        </div>
      </div>

      <PipelineCatalog t={t} initial={initial} />
    </div>);
}
