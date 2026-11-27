import React, { useState, useMemo, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import HubWires from "./HubWires.jsx";
import HubErrorPlay from "./HubErrorPlay.jsx";
import HubSlides from "./HubSlides.jsx";
import { PLAYS } from "./hubErrorPlays.js";
import { ROLE, SEVERITY_COLOR, businessMarkdown } from "./hubBusiness.js";
import { PIPELINES, CHANNELS, byChannel, counts, statusOf, STATUS_COLOR, STATUS_WORD, pipelineView } from "./hubPipelines.js";
import { integration360Api, mergeLive, caseFromFinding } from "./integration360Api.js";

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
export function PipelineList({ t, open, onOpen, live }) {
  const th = useTheme(t);
  const merged = mergeLive(PIPELINES, live);
  const liveStatusOf = (p) => { const m = merged.find((x) => x.id === p.id); return m && m.live ? m.live.status : null; };
  const c = merged.reduce((a, p) => { const st = p.live ? p.live.status : statusOf(p); a[st] = (a[st] || 0) + 1; return a; }, { green: 0, amber: 0, red: 0, planned: 0 });
  const nLive = merged.filter((p) => p.live).length;
  return (
    <div data-list="pipelines">
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 11.5, color: th.sub }}>
        <b style={{ color: th.text }}>{PIPELINES.length} pipelines</b>
        {nLive > 0 ? <Chip bg="#e6f4f2" fg={TEAL}>{nLive} LIVE</Chip> : <Chip bg="#f6f8fa" fg={MUTE}>illustrative until the first run reports</Chip>}
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
              const ls = liveStatusOf(p), st = ls || statusOf(p), on = open === p.id;
              const cs = ls ? [] : p.cases.map((x) => x.id);
              return (
                <div key={p.id} role="button" tabIndex={0} aria-pressed={on} data-pipeline={p.id} onClick={() => onOpen(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(p.id); }}
                  style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", gap: 10, alignItems: "start", padding: "9px 12px", borderTop: `1px solid ${th.border}`, cursor: "pointer", background: on ? "#eaf1fb" : "transparent" }}>
                  <div style={{ paddingTop: 3 }}><Dot status={st} /></div>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b style={{ fontSize: 12.5, color: th.text }}>{p.name}</b>
                      <Chip bg={p.domain === "Accounting" ? "#e6f4f2" : "#f2eefa"} fg={p.domain === "Accounting" ? TEAL : "#6d3ac0"}>{p.domain}</Chip>
                      {p.planned && <Chip bg="#f6f8fa" fg={MUTE}>later</Chip>}
                      {ls && <Chip bg="#e6f4f2" fg={TEAL}>LIVE</Chip>}
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
  const [live, setLive] = useState(initial?.live || null);          // /integration360/pipelines
  const [findings, setFindings] = useState(initial?.findings || {}); // dag_id -> findings
  useEffect(() => { if (initial?.live) return; integration360Api.pipelines().then(setLive).catch(() => setLive(null)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const p = PIPELINES.find((x) => x.id === pid) || PIPELINES[0];
  const view = useMemo(() => pipelineView(p), [p]);
  const L = live && live.dags && p.dag_id ? live.dags[p.dag_id] : null;
  useEffect(() => {
    if (!L || !p.dag_id || findings[p.dag_id]) return;
    integration360Api.findings(p.dag_id, { business_date: L.run && L.run.business_date }).then((r) => setFindings((f) => ({ ...f, [p.dag_id]: r.findings || [] }))).catch(() => {});
  }, [L, p.dag_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveCases = useMemo(() => {
    if (!L) return [];
    const fs = (findings[p.dag_id] || []).filter((f) => ["fail", "failed", "error", "warn"].includes(String(f.status)));
    const ts = (L.failed_tasks || []).map((t) => ({ ...t, rule_kind: "airflow", status: t.state }));
    const base = fs.length ? fs : (L.failing || []).concat(L.warnings || []);
    return base.concat(ts).map((f) => caseFromFinding(f, p, view));
  }, [L, findings, p, view]);
  const status = L ? L.status : statusOf(p);
  const cases = L ? liveCases : view.cases;
  const [scen, setScen] = useState(initial?.scenario || (view.cases[0] && view.cases[0].id) || null);
  const S = cases.find((x) => x.id === scen) || cases[0] || null;
  const openPipeline = (id) => { const nv = pipelineView(PIPELINES.find((x) => x.id === id)); setPid(id); setScen(nv.cases[0] ? nv.cases[0].id : null); };
  const lastRun = L && L.run ? `${L.run.state || ""}${L.run.business_date ? ` \u00b7 business date ${L.run.business_date}` : ""}${L.run.ended_at ? ` \u00b7 ended ${String(L.run.ended_at).slice(0, 16).replace("T", " ")}` : ""}` : "";
  const ch = CHANNELS[p.channel];
  const f = S ? S.flow : -1, fd = S ? S.dagTask : -1;

  const Header = () => (
    <div data-pipeline-open={p.id} style={{ border: `1px solid ${th.border}`, borderLeft: `6px solid ${STATUS_COLOR[status]}`, borderRadius: 10, background: th.panel, padding: "14px 18px", marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Dot status={status} size={12} /><b style={{ fontSize: 16, color: th.text }}>{p.name}</b>
        <Chip bg="#eaf1fb" fg={BLUE}>{ch.name}</Chip>
        <Chip bg={p.domain === "Accounting" ? "#e6f4f2" : "#f2eefa"} fg={p.domain === "Accounting" ? TEAL : "#6d3ac0"}>{p.domain}</Chip>
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[status] }}>{STATUS_WORD[status]}</span>
        {L ? <Chip bg="#e6f4f2" fg={TEAL}>LIVE</Chip> : <Chip bg="#f6f8fa" fg={MUTE}>illustrative</Chip>}
        {L && <span data-last-run style={{ fontSize: 10.5, color: th.sub }}>last run {lastRun}{L.failed_tasks && L.failed_tasks.length ? ` \u00b7 ${L.failed_tasks.length} task${L.failed_tasks.length === 1 ? "" : "s"} failed` : ""}{L.failing && L.failing.length ? ` \u00b7 ${L.failing.length} check${L.failing.length === 1 ? "" : "s"} failing` : ""}</span>}
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
        {cases.length > 1 && <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{cases.map((x) => (
          <span key={x.id} role="button" tabIndex={0} aria-pressed={x.id === S.id} onClick={() => setScen(x.id)} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999, cursor: "pointer", background: x.id === S.id ? "#fff" : "transparent", color: x.id === S.id ? NAVY : "#fff", border: "1px solid #a9c1de", fontFamily: x.live ? MONO : "inherit" }}>{x.live ? (x.rule || x.id).slice(0, 40) : x.id}</span>))}</span>}
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
          <div><b>Root cause.</b> {S.cause || (S.live ? "Not written yet: type it against this finding and it is kept with the run." : "")}</div>
          <div style={{ marginTop: 6, color: TEAL, fontWeight: 600 }}>{S.i360}</div>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: MONO, marginTop: 8 }}>
            <thead><tr>{Object.keys(S.sample[0]).map((k) => <th key={k} style={{ textAlign: "left", color: th.sub, padding: "2px 8px 3px 0", fontWeight: 600 }}>{k}</th>)}</tr></thead>
            <tbody>{S.sample.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} style={{ padding: "2px 8px 2px 0", color: /^null$|MISSING|REORG/.test(String(v)) ? RED : th.text }}>{String(v)}</td>)}</tr>)}</tbody>
          </table></div>, TEAL)}
      </div>
    </div>) : (
    <div data-healthy={p.id} style={{ border: `1px solid ${TEAL}`, borderLeft: `6px solid ${TEAL}`, borderRadius: 10, marginTop: 12, padding: "12px 16px", background: th.panel, fontSize: 12, color: th.text }}>
      <b style={{ color: TEAL }}>{p.planned ? "Not live yet." : "Nothing wrong today."}</b> {p.planned ? "Shown so the shape is agreed before it is built." : L ? `The latest run ${lastRun}: every task completed and every check passed.` : "Every step on the path completed and reconciled; the latest business date is closed."}
    </div>);

  const BadRecords = () => {
    if (!S || !S.records) return null;
    const R = S.records;
    const copyCsv = () => { try { navigator.clipboard?.writeText([R.columns.join(",")].concat(R.rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n")); } catch { /* no clipboard */ } };
    return (
      <div data-bad-records={S.id} style={{ border: `1px solid ${th.border}`, borderLeft: `6px solid ${RED}`, borderRadius: 10, marginTop: 12, background: th.panel, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${th.border}`, flexWrap: "wrap" }}>
          <b style={{ fontSize: 12.5, color: th.text }}>Bad records from the file</b>
          {R.rows && <><span style={{ fontSize: 11, color: th.sub }}><b style={{ color: RED }}>{S.bad.toLocaleString()}</b> of {R.total.toLocaleString()} rows{R.more ? ` \u00b7 showing ${R.rows.length}, ${R.more}` : ""}</span>
            <span style={{ fontSize: 10.5, color: th.sub, fontFamily: MONO }}>{R.table}{" \u00b7 "}{R.registry}</span>
            <span role="button" tabIndex={0} onClick={copyCsv} style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 5, border: `1px solid ${th.border}`, cursor: "pointer", color: th.text }}>copy as CSV</span></>}
        </div>
        {R.none ? <div style={{ padding: "12px 14px", fontSize: 12, color: th.text }}>{R.none}</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: MONO }}>
              <thead><tr>{R.columns.map((c) => <th key={c} style={{ textAlign: "left", padding: "6px 10px", color: th.sub, fontWeight: 700, fontSize: 9.5, textTransform: c === "reason" ? "uppercase" : "none", letterSpacing: c === "reason" ? 0.4 : 0, borderBottom: `1px solid ${th.border}`, background: R.bad.includes(c) ? "#fae0e2" : "transparent" }}>{c}</th>)}</tr></thead>
              <tbody>{R.rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => { const c = R.columns[j]; const isBad = R.bad.includes(c) || /^null$/.test(String(v)); return (
                  <td key={j} style={{ padding: "6px 10px", borderBottom: `1px solid ${th.border}`, color: isBad ? RED : c === "reason" ? th.sub : th.text, fontWeight: isBad ? 700 : j === 0 ? 400 : 500, fontFamily: c === "reason" ? "inherit" : MONO, fontSize: c === "reason" ? 11 : 11, background: isBad ? "#fae0e21a" : "transparent" }}>{j === 0 ? `row ${Number(v).toLocaleString()}` : String(v)}</td>); })}</tr>))}</tbody>
            </table>
          </div>)}
        {R.rows && <div style={{ padding: "6px 14px 10px", fontSize: 10.5, color: th.sub }}>Row numbers are the loader's FILE_ROW_NUMBER, so each record is found in the file and in RAW. The rows are kept with their reason; nothing is dropped.</div>}
      </div>);
  };

  return (
    <div>
      <H t={t} hint="green is healthy; red says what is wrong, where, and why">Pipelines</H>
      <PipelineList t={t} open={p.id} onOpen={openPipeline} live={live} />
      <Header />
      <Record />
      <BadRecords />
      <H t={t} hint="the step that failed is red; everything after it waits">Where in the flow</H>
      <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 12px 0", background: th.panel }}><Flow /><Dag /></div>
      <H t={t} hint="one box per table, a wire per column; the failed column is red and its path is lit">Where in the data</H>
      <HubWires t={t} graph={view.graph} failed={S ? S.column : null} title={`${p.name}: where it lands`} />
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

      {tab === "What it is" && <div data-tab="what"><HubSlides t={t} initial={initial?.slide !== undefined ? { slide: initial.slide } : undefined} /></div>}

      {tab === "Error handling" && <div data-tab="errors">
        <H t={t} hint="pick a scenario and watch it play: where it goes wrong, how the hub handles it, how it is replayed">Error handling</H>
        <HubErrorPlay t={t} initial={initial?.play ? { play: initial.play, frame: initial.frame, running: initial.running } : undefined} />
      </div>}
    </div>);
}
