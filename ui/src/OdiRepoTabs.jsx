// ODI 360 · the repository tabs: Overview, Processes, Tables & mapping,
// Variables, Objects. Read from /odi/* (sql/83, step odi_repo). The SCD2
// rule cards stay in Odi360.jsx; a table here links across to its card.
//
// WHAT A READER SHOULD SEE FIRST. A scenario is a sequence of steps, each a
// few tasks of a known kind: refresh a variable, load the source into a C$
// work table, insert the flow into I$, merge into the target, call an
// end-date procedure, drop the work tables. The Processes tab shows that
// sequence as the repository recorded it; the Tables tab turns it round
// and shows, for one table, who writes it, from what, and who reads it.
//
// NOTHING HERE IS INVENTED. A code preview is shown as the export cut it
// and marked when it was cut; an empty estate says which step to run.
import React, { useEffect, useState } from "react";
import { odi, TASK_TYPE } from "./odiApi.js";
import { PATTERN_INFO } from "./scd2Api.js";

const mono = { fontFamily: "monospace" };
const PATTERN_C = { merge: "#159943", update: "#0091bf", truncate: "#e67e22", insert: "#7c3aed", unknown: "#999999" };
const LAYER_C = { DIM: "#159943", FACT: "#0f4775", STG: "#e67e22", STG1: "#e67e22", STG2: "#b7791f", REF: "#7c3aed", CFG: "#6b7884", VW: "#0091bf" };
const layerC = (l) => LAYER_C[String(l || "").toUpperCase()] || "#6b7884";
const patC = (p) => PATTERN_C[String(p || "unknown").toLowerCase()] || PATTERN_C.unknown;

export function Chip({ c, children, title }) {
  return <span title={title} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`,
    borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Tile({ t, label, value, c, sub }) {
  return (
    <div style={{ border: `1px solid ${t.border}`, borderTop: `3px solid ${c || t.accent}`, borderRadius: t.radius.md,
      padding: "8px 12px", background: t.panel, minWidth: 110 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", color: t.textMuted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: c || t.text, ...mono }}>{value == null ? "—" : value}</div>
      {sub && <div style={{ fontSize: 10.5, color: t.sub }}>{sub}</div>}
    </div>);
}
function Tbl({ t, head, rows, onRow, active }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 14 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead><tr>{head.map((h) => <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
          textTransform: "uppercase", color: t.textMuted, borderBottom: `1px solid ${t.border}`, padding: "0 12px 6px 0" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.key || i} onClick={onRow ? () => onRow(r) : undefined}
          style={{ cursor: onRow ? "pointer" : "default", background: active && r.key === active ? t.bg : "transparent" }}>
          {r.cells.map((c, j) => <td key={j} style={{ padding: "7px 12px 7px 0", verticalAlign: "top",
            borderBottom: `1px solid ${t.bg}`, color: j === 0 ? t.text : t.sub, lineHeight: 1.5 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}
function H({ t, children, right }) {
  return <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 10.5, fontWeight: 800, letterSpacing: .5,
    textTransform: "uppercase", color: t.textMuted, margin: "12px 0 6px" }}>{children}<span style={{ flex: 1 }} />{right}</div>;
}
function Search({ t, value, onChange, placeholder }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
    style={{ font: "inherit", fontSize: 12, padding: "6px 10px", border: `1px solid ${t.border}`, borderRadius: t.radius.md,
      background: t.panel, color: t.text, minWidth: 260 }} />;
}
function Empty({ t, step }) {
  return (
    <div style={{ border: `1px dashed ${t.border}`, borderRadius: t.radius.md, padding: "18px 20px", color: t.sub, fontSize: 12.5, lineHeight: 1.6, maxWidth: "80ch" }}>
      <b style={{ color: t.text }}>Nothing loaded yet.</b> Put the ODI repository export under <span style={mono}>local-data/odi_export</span>, run{" "}
      <span style={mono}>sql/83_odi_repo.sql</span> once, then <span style={mono}>python -m ingestion.run {step}</span>.
    </div>);
}
const names = (tk) => [tk.task_name1, tk.task_name2, tk.task_name3].filter(Boolean).join(" / ");
const bare = (s) => String(s || "").split("(")[0].trim();

// ---- the process figure: what one ODI scenario does, in order --------------
// Static by design: it is the shape every mapping shares, and the counts
// beside each stage come from the loaded repository.
export function ProcessFig({ t, s }) {
  const stages = [
    ["V", "refresh variables", "business date, batch id", s.variables],
    ["C", "load source → C$", "LKM: read the staging table", null],
    ["C", "insert flow → I$", "IKM: the rows to apply", null],
    ["C", "merge / insert target", "the write that keeps history", s.tables],
    ["S", "procedures", "end-date the prior version", s.objects],
    ["C", "drop work tables", "C$ and I$ cleaned up", null],
  ];
  const W = 900, H = 118, bw = 136, gap = 14, x0 = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}
      aria-label={`How an ODI scenario runs, in six stages: refresh variables, load the source into a C$ work table, insert the flow into I$, merge or insert into the target, run the end-date procedures, drop the work tables. ${s.scenarios || 0} scenarios loaded.`}>
      {stages.map(([ty, title, sub, n], i) => {
        const x = x0 + i * (bw + gap);
        const c = ty === "V" ? "#7c3aed" : ty === "S" ? "#e67e22" : t.accent;
        return (<g key={title}>
          <rect x={x} y={18} width={bw} height={64} rx={4} fill={t.panel} stroke={c} strokeWidth={1.5} />
          <rect x={x} y={18} width={bw} height={16} rx={4} fill={c} opacity={.15} />
          <text x={x + 8} y={30} fontSize={9} fontWeight={800} fill={c}>{i + 1} · {(TASK_TYPE[ty] || {}).label}</text>
          <text x={x + 8} y={50} fontSize={11} fontWeight={700} fill={t.text}>{title}</text>
          <text x={x + 8} y={66} fontSize={9.5} fill={t.sub}>{sub}</text>
          {n != null && <text x={x + bw - 8} y={30} fontSize={9} textAnchor="end" fill={t.textMuted}>{n}</text>}
          {i < stages.length - 1 && <path d={`M${x + bw + 2} 50 L${x + bw + gap - 2} 50`} stroke={t.textMuted} strokeWidth={1.2} markerEnd="url(#odi-arr)" />}
        </g>);
      })}
      <defs><marker id="odi-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={t.textMuted} /></marker></defs>
      <text x={x0} y={104} fontSize={9.5} fill={t.sub}>
        Stages 2–4 are the mapping; their code is where a change-detection filter would be, and it is the code the export cut first.</text>
    </svg>);
}

// ---- the mapping figure for one table: sources → writers → table → readers ---
export function MappingFig({ t, d }) {
  const src = (d.sources || []).slice(0, 8), wr = (d.head.writers || []).slice(0, 6), rd = (d.head.readers || []).slice(0, 8);
  const rows = Math.max(src.length, wr.length, rd.length, 1);
  const rh = 22, H = 40 + rows * rh, W = 900, cols = [10, 250, 490, 700], bw = 200;
  const col = (xs, items, c, label) => (<g>
    <text x={xs} y={14} fontSize={9} fontWeight={800} fill={t.textMuted}>{label} · {items.length}</text>
    {items.map((it, i) => (<g key={it}>
      <rect x={xs} y={24 + i * rh} width={bw} height={rh - 4} rx={3} fill={t.panel} stroke={c} />
      <text x={xs + 6} y={24 + i * rh + 13} fontSize={9.5} fill={t.text} style={mono}>{String(it).slice(0, 30)}</text>
    </g>))}
  </g>);
  const y0 = 24 + ((rows * rh) - 4) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", maxWidth: W, height: "auto", display: "block", marginBottom: 8 }}
      aria-label={`Mapping for ${d.table}: ${src.length} source tables feed ${wr.length} writer scenarios which write ${d.table}, read by ${rd.length} scenarios.`}>
      {col(cols[0], src, "#e67e22", "sources read")}
      {col(cols[1], wr, "#159943", "writer scenarios")}
      <g>
        <text x={cols[2]} y={14} fontSize={9} fontWeight={800} fill={t.textMuted}>table</text>
        <rect x={cols[2]} y={y0 - 14} width={bw} height={28} rx={4} fill={t.accent} />
        <text x={cols[2] + bw / 2} y={y0 + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff" style={mono}>{String(d.table).slice(0, 26)}</text>
      </g>
      {col(cols[3], rd, "#0091bf", "read by")}
      {src.map((_, i) => <path key={"a" + i} d={`M${cols[0] + bw} ${24 + i * rh + 9} L${cols[1]} ${24 + Math.min(i, Math.max(wr.length - 1, 0)) * rh + 9}`} stroke={t.textMuted} opacity={.5} fill="none" />)}
      {wr.map((_, i) => <path key={"b" + i} d={`M${cols[1] + bw} ${24 + i * rh + 9} L${cols[2]} ${y0}`} stroke={t.textMuted} opacity={.5} fill="none" />)}
      {rd.map((_, i) => <path key={"c" + i} d={`M${cols[2] + bw} ${y0} L${cols[3]} ${24 + i * rh + 9}`} stroke={t.textMuted} opacity={.5} fill="none" />)}
    </svg>);
}

function Code({ t, tk }) {
  if (!tk.code_preview) return null;
  return (
    <details style={{ marginTop: 4 }}>
      <summary style={{ cursor: "pointer", fontSize: 10.5, color: t.sub }}>
        code · {tk.code_chars || 0} chars{tk.truncated === "Y" && <b style={{ color: t.danger }}> · cut by the export — re-export this scenario to read the rest</b>}</summary>
      <pre style={{ fontSize: 10.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", background: t.bg, border: `1px solid ${t.border}`,
        borderRadius: t.radius.md, padding: "8px 10px", margin: "4px 0 0", color: t.text, maxHeight: 360, overflow: "auto" }}>{tk.code_preview}</pre>
    </details>);
}
function TaskRows({ t, tasks, withScenario }) {
  return (
    <Tbl t={t} head={[withScenario ? "Scenario · step · task" : "Step · task", "Kind", "Task", "Reads → writes", "Code"]}
      rows={tasks.map((tk) => { const K = TASK_TYPE[tk.task_type] || { label: tk.task_type || "?", t: "" }; return { key: `${tk.scenario || ""}-${tk.step_no}-${tk.task_no}`, cells: [
        <span style={mono}>{withScenario ? `${tk.scenario} · ` : ""}{tk.step_no} · {tk.task_no}</span>,
        <Chip c={tk.task_type === "V" ? "#7c3aed" : tk.task_type === "S" ? "#e67e22" : t.accent} title={K.t}>{K.label}</Chip>,
        names(tk),
        <span style={{ fontSize: 11 }}>{bare(tk.reads) || "—"} <span style={{ color: t.textMuted }}>→</span> <b style={{ color: t.text }}>{tk.writes || "—"}</b></span>,
        <Code t={t} tk={tk} />] }; })} />);
}

// ---- tabs ------------------------------------------------------------------
export function OverviewTab({ t, s }) {
  const x = s || {};
  if (!x.loaded) return <Empty t={t} step="odi_repo" />;
  return (<>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <Tile t={t} label="scenarios" value={x.scenarios} sub={x.load_plans ? `${x.load_plans} load plan group(s)` : null} />
      <Tile t={t} label="tasks" value={x.tasks} sub={x.truncated_tasks ? `${x.truncated_tasks} cut by the export` : "none cut"} c={x.truncated_tasks ? t.warning : t.success} />
      <Tile t={t} label="tables touched" value={x.tables} />
      <Tile t={t} label="variables" value={x.variables} />
      <Tile t={t} label="db objects" value={x.objects} />
      <Tile t={t} label="lineage edges" value={x.edges} />
      <Tile t={t} label="SCD2 rule cards" value={x.scd2_cards} c={x.scd2_cards ? t.success : t.textMuted} />
    </div>
    <H t={t}>How a scenario runs</H>
    <ProcessFig t={t} s={x} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      <div><H t={t}>Scenarios by load pattern</H>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: t.sub }}>
          {(x.by_pattern || []).map((p) => <span key={p.k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Chip c={patC(p.k)}>{p.k}</Chip> {p.n}</span>)}</div></div>
      <div><H t={t}>Tables by layer</H>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: t.sub }}>
          {(x.by_layer || []).map((p) => <span key={p.k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Chip c={layerC(p.k)}>{p.k}</Chip> {p.n}</span>)}</div></div>
      <div><H t={t}>Database objects</H>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: t.sub }}>
          {(x.by_object_type || []).map((p) => <span key={p.k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Chip c={t.sub}>{p.k}</Chip> {p.n}</span>)}</div></div>
    </div>
    {x.truncated_tasks > 0 && (
      <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6, marginTop: 14, borderLeft: `3px solid ${t.warning}`, paddingLeft: 10, maxWidth: "80ch" }}>
        <b style={{ color: t.text }}>{x.truncated_tasks} task(s) were cut by the export</b> at a fixed code length. The rules that matter most — the change-detection
        filter in “Insert flow into I$” and the merge in “Insert/Update customize” — sit past that cut. The scenario XML files hold the full code; re-export
        the writer scenarios of the SCD2 dimensions first, and every card that reads UNKNOWN_TRUNCATED re-evaluates on the next run.
      </div>)}
  </>);
}

export function ScenarioDetail({ t, d, onClose, onTable }) {
  if (!d) return null;
  const h = d.head || {};
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, ...mono }}>{d.scenario}</div>
        {h.load_pattern && <Chip c={patC(h.load_pattern)}>{h.load_pattern}</Chip>}
        <span style={{ fontSize: 11, color: t.sub }}>{h.step_count || 0} steps · {h.task_count || 0} tasks{h.truncated_tasks ? ` · ${h.truncated_tasks} cut` : ""}</span>
        <span style={{ flex: 1 }} />
        <span onClick={onClose} style={{ cursor: "pointer", fontSize: 10, fontWeight: 800, color: t.sub, border: `1px solid ${t.border}`, borderRadius: 4, padding: "3px 9px" }}>✕ close</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
        <div><b style={{ color: t.text }}>Writes</b><br />{(h.writes_list || []).map((w) => <div key={w}><span onClick={() => onTable && onTable(bare(w))} style={{ ...mono, cursor: "pointer", color: t.accent }}>{w}</span></div>)}</div>
        <div><b style={{ color: t.text }}>Reads</b><br />{(h.reads_list || []).map((w) => <div key={w}><span onClick={() => onTable && onTable(bare(w))} style={{ ...mono, cursor: "pointer", color: t.accent }}>{w}</span></div>)}</div>
        <div><b style={{ color: t.text }}>Procedures</b><br />{(h.procedures_list || []).length ? h.procedures_list.map((p) => <div key={p} style={mono}>{p}</div>) : "—"}</div>
        <div><b style={{ color: t.text }}>Knowledge modules</b><br />{(h.kms_list || []).length ? h.kms_list.map((p) => <div key={p}>{p}</div>) : "—"}</div>
        <div><b style={{ color: t.text }}>Load plans</b><br />{(h.load_plans_list || []).length ? h.load_plans_list.map((p) => <div key={p} style={mono}>{p}</div>) : "—"}
          <br /><b style={{ color: t.text }}>Scheduler jobs</b><br />{(h.jobs_list || []).length ? h.jobs_list.map((p) => <div key={p} style={mono}>{p}</div>) : "—"}</div>
      </div>
      <H t={t}>Steps and tasks</H>
      {(d.steps || []).length ? d.steps.map((st) => (
        <div key={st.step_no} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: t.textMuted, margin: "6px 0 2px" }}>STEP {st.step_no} · {st.tasks.length} task(s)</div>
          <TaskRows t={t} tasks={st.tasks} />
        </div>)) : <div style={{ fontSize: 12, color: t.textMuted }}>no tasks in the export for this scenario</div>}
      {(d.variables || []).length > 0 && <><H t={t}>Variables it refreshes</H>
        <Tbl t={t} head={["Variable", "Type", "Schema", "Refresh SQL"]} rows={d.variables.map((v) => ({ key: v.name, cells: [
          <span style={mono}>{v.name}</span>, v.datatype, v.refresh_lschema, <span style={{ ...mono, fontSize: 10.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v.refresh_sql}</span>] }))} /></>}
      {(d.objects || []).length > 0 && <><H t={t}>Database objects it uses</H>
        <Tbl t={t} head={["Type", "Object", "On table"]} rows={d.objects.map((o) => ({ key: o.name, cells: [o.object_type, <span style={mono}>{o.name}</span>, <span style={mono}>{o.on_table || "—"}</span>] }))} /></>}
    </div>);
}

export function ProcessesTab({ t, rows, q, setQ, pattern, setPattern, patterns, detail, onOpen, onClose, onTable, loaded }) {
  if (!loaded && !rows.length) return <Empty t={t} step="odi_repo" />;
  return (<>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <Search t={t} value={q} onChange={setQ} placeholder="search scenario, table written or read" />
      {["", ...patterns].map((p) => <span key={p || "all"} onClick={() => setPattern(p)} style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999, border: `1px solid ${pattern === p ? t.accent : t.border}`, color: pattern === p ? "#fff" : t.sub, background: pattern === p ? t.accent : t.panel }}>
        {p || "all patterns"}</span>)}
      <span style={{ fontSize: 11, color: t.textMuted }}>{rows.length} scenario(s)</span>
    </div>
    <ScenarioDetail t={t} d={detail} onClose={onClose} onTable={onTable} />
    <Tbl t={t} active={detail && detail.scenario} onRow={(r) => onOpen(r.key)} head={["Scenario", "Pattern", "Writes", "Reads", "Steps · tasks", "Load plan · job"]}
      rows={rows.map((s) => ({ key: s.scenario, cells: [
        <span style={mono}>{s.scenario}</span>,
        <Chip c={patC(s.load_pattern)}>{s.load_pattern || "unknown"}</Chip>,
        <span style={{ ...mono, fontSize: 11 }}>{(s.writes_list || []).slice(0, 3).join(", ")}{(s.writes_list || []).length > 3 ? ` +${s.writes_list.length - 3}` : ""}</span>,
        <span style={{ ...mono, fontSize: 11 }}>{(s.reads_list || []).slice(0, 3).join(", ")}{(s.reads_list || []).length > 3 ? ` +${s.reads_list.length - 3}` : ""}</span>,
        <span>{s.step_count || 0} · {s.task_count || 0}{s.truncated_tasks ? <b style={{ color: t.warning }}> · {s.truncated_tasks} cut</b> : null}</span>,
        <span style={{ fontSize: 11 }}>{(s.load_plans_list || []).join(", ") || "—"}{(s.jobs_list || []).length ? ` · ${s.jobs_list.join(", ")}` : ""}</span>] }))} />
  </>);
}

export function TableDetail({ t, d, onClose, onScenario, onScd2 }) {
  if (!d) return null;
  const h = d.head || {}, c = d.scd2, r = d.column_roles;
  const P = c ? (PATTERN_INFO[c.pattern] || PATTERN_INFO.UNKNOWN) : null;
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, ...mono }}>{d.table}</div>
        {h.layer && <Chip c={layerC(h.layer)}>{h.layer}</Chip>}
        {P && <Chip c={P.c} title={P.t}>{P.label}</Chip>}
        {r && <span style={{ fontSize: 11, color: t.sub }}>column scan: {r.verdict} ({r.confidence})</span>}
        <span style={{ flex: 1 }} />
        {c && <span onClick={() => onScd2 && onScd2(d.table)} style={{ cursor: "pointer", fontSize: 10, fontWeight: 800, color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 4, padding: "3px 9px" }}>open the SCD2 card →</span>}
        <span onClick={onClose} style={{ cursor: "pointer", fontSize: 10, fontWeight: 800, color: t.sub, border: `1px solid ${t.border}`, borderRadius: 4, padding: "3px 9px" }}>✕ close</span>
      </div>
      <MappingFig t={t} d={d} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
        <div><b style={{ color: t.text }}>Written by</b><br />{(h.writers || []).map((w) => <div key={w}><span onClick={() => onScenario && onScenario(w)} style={{ ...mono, cursor: "pointer", color: t.accent }}>{w}</span></div>)}
          <div style={{ marginTop: 4 }}>operations: {(h.operations || []).join(", ") || "—"}</div></div>
        <div><b style={{ color: t.text }}>Read by</b><br />{(h.readers || []).length ? h.readers.map((w) => <div key={w}><span onClick={() => onScenario && onScenario(w)} style={{ ...mono, cursor: "pointer", color: t.accent }}>{w}</span></div>) : "—"}</div>
        <div><b style={{ color: t.text }}>Indexes</b><br />{(h.index_list || []).length ? h.index_list.map((w) => <div key={w} style={mono}>{w}</div>) : "—"}</div>
        {r && <div><b style={{ color: t.text }}>History columns (scan)</b><br />
          {[["valid from", r.valid_from], ["valid to", r.valid_to], ["current flag", r.current_flag], ["surrogate", r.surrogate_key], ["version", r.version], ["business date", r.business_date], ["audit", r.audit_col], ["open row", r.to_convention]]
            .filter(([, v]) => v).map(([k, v]) => <div key={k}><span style={{ color: t.textMuted }}>{k}</span> <span style={{ ...mono, color: t.text }}>{v}</span></div>)}</div>}
        {c && <div><b style={{ color: t.text }}>SCD2 card</b><br />
          keys <span style={mono}>{c.natural_key || "?"}</span>{c.partition_col ? <> · split by <span style={mono}>{c.partition_col}</span></> : null}<br />
          {c.proven_count || 0} proven · {c.inferred_count || 0} inferred · {c.unknown_count || 0} truncated · {c.open_count || 0} open
          {c.row_count != null && <><br />{c.row_count} rows · {c.dup_pct}% duplicate versions{c.freshness_alert ? " · stale" : ""}</>}</div>}
      </div>
      <H t={t}>The tasks that write it · {(d.tasks || []).length}</H>
      {(d.tasks || []).length ? <TaskRows t={t} tasks={d.tasks} withScenario /> : <div style={{ fontSize: 12, color: t.textMuted }}>no writing task in the export names this table</div>}
      {((d.inbound || []).length > 0 || (d.outbound || []).length > 0) && <><H t={t}>Lineage edges</H>
        <Tbl t={t} head={["From", "Relation", "To", "Via"]} rows={[...(d.inbound || []), ...(d.outbound || [])].map((e, i) => ({ key: i, cells: [
          <span style={mono}>{e.src}</span>, e.relation, <span style={mono}>{e.dst}</span>, <span style={{ fontSize: 11 }}>{e.detail}</span>] }))} /></>}
      {(d.objects || []).length > 0 && <><H t={t}>Objects on this table</H>
        <Tbl t={t} head={["Type", "Object", "Columns", "Used by"]} rows={d.objects.map((o) => ({ key: o.name, cells: [o.object_type, <span style={mono}>{o.name}</span>,
          <span style={{ ...mono, fontSize: 11 }}>{o.columns || "—"}</span>, <span style={{ fontSize: 11 }}>{o.used_by || "—"}</span>] }))} /></>}
    </div>);
}

export function TablesTab({ t, rows, q, setQ, layer, setLayer, layers, detail, onOpen, onClose, onScenario, onScd2, loaded }) {
  if (!loaded && !rows.length) return <Empty t={t} step="odi_repo" />;
  return (<>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <Search t={t} value={q} onChange={setQ} placeholder="search table, writer or reader" />
      {["", ...layers].map((l) => <span key={l || "all"} onClick={() => setLayer(l)} style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999, border: `1px solid ${layer === l ? t.accent : t.border}`, color: layer === l ? "#fff" : t.sub, background: layer === l ? t.accent : t.panel }}>
        {l || "all layers"}</span>)}
      <span style={{ fontSize: 11, color: t.textMuted }}>{rows.length} table(s)</span>
    </div>
    <TableDetail t={t} d={detail} onClose={onClose} onScenario={onScenario} onScd2={onScd2} />
    <Tbl t={t} active={detail && detail.table} onRow={(r) => onOpen(r.key)} head={["Table", "Layer", "History", "Written by", "Read by", "Operations"]}
      rows={rows.map((x) => { const P = x.scd2_pattern ? (PATTERN_INFO[x.scd2_pattern] || PATTERN_INFO.UNKNOWN) : null; return { key: x.table_name, cells: [
        <span style={mono}>{x.table_name}</span>,
        x.layer ? <Chip c={layerC(x.layer)}>{x.layer}</Chip> : "—",
        P ? <Chip c={P.c} title={P.t}>{P.label}</Chip> : (x.scan_verdict ? <span style={{ fontSize: 11 }}>{x.scan_verdict}</span> : "—"),
        <span style={{ ...mono, fontSize: 11 }}>{(x.writers || []).slice(0, 2).join(", ")}{(x.writers || []).length > 2 ? ` +${x.writers.length - 2}` : ""}</span>,
        <span style={{ fontSize: 11 }}>{x.reader_count || 0}</span>,
        <span style={{ fontSize: 11 }}>{(x.operations || []).join(", ") || "—"}</span>] }; })} />
  </>);
}

export function VariablesTab({ t, rows, q, setQ, loaded }) {
  if (!loaded && !rows.length) return <Empty t={t} step="odi_repo" />;
  return (<>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <Search t={t} value={q} onChange={setQ} placeholder="search variable or refresh SQL" />
      <span style={{ fontSize: 11, color: t.textMuted }}>{rows.length} variable(s)</span>
    </div>
    <Tbl t={t} head={["Variable", "Type", "Schema", "Used by", "Refresh SQL"]} rows={rows.map((v) => ({ key: v.name, cells: [
      <span style={mono}>{v.name}</span>, v.datatype || "—", v.refresh_lschema || "—",
      <span>{v.used_by_scenarios || 0} scenario(s)</span>,
      <span style={{ ...mono, fontSize: 10.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v.refresh_sql || "—"}</span>] }))} />
  </>);
}

export function ObjectsTab({ t, rows, q, setQ, type, setType, types, loaded }) {
  if (!loaded && !rows.length) return <Empty t={t} step="odi_repo" />;
  return (<>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <Search t={t} value={q} onChange={setQ} placeholder="search object or table" />
      {["", ...types].map((l) => <span key={l || "all"} onClick={() => setType(l)} style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999, border: `1px solid ${type === l ? t.accent : t.border}`, color: type === l ? "#fff" : t.sub, background: type === l ? t.accent : t.panel }}>
        {l || "all types"}</span>)}
      <span style={{ fontSize: 11, color: t.textMuted }}>{rows.length} object(s)</span>
    </div>
    <Tbl t={t} head={["Type", "Object", "On table", "Columns", "Used by"]} rows={rows.map((o) => ({ key: `${o.object_type}-${o.name}`, cells: [
      o.object_type, <span style={mono}>{o.name}</span>, <span style={mono}>{o.on_table || "—"}</span>,
      <span style={{ ...mono, fontSize: 11 }}>{o.columns || "—"}</span>, <span style={{ fontSize: 11 }}>{(o.used_by_list || []).join(", ") || "—"}</span>] }))} />
  </>);
}

// The data-fetching shell for the five repository tabs; Odi360 renders it
// for any tab other than the SCD2 cards and passes the cross-links.
export function RepoTabs({ t, tab, onScd2 }) {
  const [s, setS] = useState(null);
  const [scn, setScn] = useState({ rows: [], loaded: false }); const [sq, setSq] = useState(""); const [pat, setPat] = useState(""); const [sd, setSd] = useState(null);
  const [tbl, setTbl] = useState({ rows: [], loaded: false }); const [tq, setTq] = useState(""); const [lay, setLay] = useState(""); const [td, setTd] = useState(null);
  const [vars, setVars] = useState({ rows: [], loaded: false }); const [vq, setVq] = useState("");
  const [objs, setObjs] = useState({ rows: [], loaded: false }); const [oq, setOq] = useState(""); const [oty, setOty] = useState("");
  useEffect(() => { let on = true; odi.summary().then((x) => on && setS(x)); return () => { on = false; }; }, []);
  useEffect(() => { let on = true; if (tab === "proc") odi.scenarios(sq, pat).then((x) => on && setScn({ rows: x.scenarios || [], loaded: !!x.loaded })); return () => { on = false; }; }, [tab, sq, pat]);
  useEffect(() => { let on = true; if (tab === "tables") odi.tables(tq, lay).then((x) => on && setTbl({ rows: x.tables || [], loaded: !!x.loaded })); return () => { on = false; }; }, [tab, tq, lay]);
  useEffect(() => { let on = true; if (tab === "vars") odi.variables(vq).then((x) => on && setVars({ rows: x.variables || [], loaded: !!x.loaded })); return () => { on = false; }; }, [tab, vq]);
  useEffect(() => { let on = true; if (tab === "objs") odi.objects(oq, oty).then((x) => on && setObjs({ rows: x.objects || [], loaded: !!x.loaded })); return () => { on = false; }; }, [tab, oq, oty]);
  const openScn = (name) => { if (sd && sd.scenario === name) return setSd(null); odi.scenario(name).then(setSd); };
  const openTbl = (name) => { if (td && td.table === name) return setTd(null); odi.table(name).then(setTd); };
  const patterns = [...new Set(((s && s.by_pattern) || []).map((p) => p.k))];
  const layers = [...new Set(((s && s.by_layer) || []).map((p) => p.k))];
  const types = [...new Set(((s && s.by_object_type) || []).map((p) => p.k))];
  if (tab === "overview") return <OverviewTab t={t} s={s} />;
  if (tab === "proc") return <ProcessesTab t={t} rows={scn.rows} loaded={scn.loaded} q={sq} setQ={setSq} pattern={pat} setPattern={setPat} patterns={patterns}
    detail={sd} onOpen={openScn} onClose={() => setSd(null)} onTable={(n) => { openTbl(n); }} />;
  if (tab === "tables") return <TablesTab t={t} rows={tbl.rows} loaded={tbl.loaded} q={tq} setQ={setTq} layer={lay} setLayer={setLay} layers={layers}
    detail={td} onOpen={openTbl} onClose={() => setTd(null)} onScenario={(n) => openScn(n)} onScd2={onScd2} />;
  if (tab === "vars") return <VariablesTab t={t} rows={vars.rows} loaded={vars.loaded} q={vq} setQ={setVq} />;
  if (tab === "objs") return <ObjectsTab t={t} rows={objs.rows} loaded={objs.loaded} q={oq} setQ={setOq} type={oty} setType={setOty} types={types} />;
  return null;
}
