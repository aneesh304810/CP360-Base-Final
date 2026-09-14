import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import ProjectSwitcher from "./ProjectSwitcher.jsx";
import ProjectBadge from "./ProjectBadge.jsx";
import { api } from "./api.js";

const LEGACY_SYS_D360 = {
  ADDVANTAGE: { c: "#6d3ac0", label: "AddVantage", re: /addvantage|advantage/i },
  CRD: { c: "#0b7d7d", label: "CRD", re: /\bcrd\b|charles\s*river/i },
  STAR: { c: "#b5651d", label: "STAR", re: /\bstar\b/i },
};

import { LAYER_STRIPE, HEADER_H, COL_ROW_H, COL_PAD } from "./mockData.js";
import LineageCanvas from "./LineageCanvas.jsx";
import Interdependency from "./Interdependency.jsx";

const PLANES = ["Data", "Transform", "Orchestration"];
const NODE_W = 190, COL_W = 230, COL_GAP = 110, ROW_GAP = 40, PAD = 30;

export default function Data360({ t, selection }) {
  const [project, setProject] = useState("all");
  const [d360tab, setD360tab] = useState("Pipelines");
  const [scope, setScope] = useState("all");            // all | sei | nonsei (page-level)
  const [legacySys, setLegacySys] = useState("ADDVANTAGE");
  const [lineageView, setLineageView] = useState("Detail");
  const [plane, setPlane] = useState("Data");
  const [g, setG] = useState({ nodes: [], edges: [] });
  const [expanded, setExpanded] = useState({});
  const [colEdges, setColEdges] = useState([]);
  const [selCol, setSelCol] = useState(null);
  const [drawer, setDrawer] = useState(null);

  // deep-link from global search: switch to the target tab (and the item id is
  // passed down so the sub-view can auto-select it)
  useEffect(() => {
    if (selection?.tab) setD360tab(selection.tab);
  }, [selection]);
  const [sql, setSql] = useState(null);

  useEffect(() => {
    const pid = project === "all" ? null : project;
    api.graph(pid, plane).then((r) => setG({ nodes: r.nodes || [], edges: r.edges || [] }));
    api.columnLineage(null).then((r) => setColEdges(r.column_edges || []));
  }, [project, plane]);

  // layout: place by col/row, compute height from expansion
  const laid = layoutNodes(g.nodes, expanded);
  const byId = Object.fromEntries(laid.map((n) => [n.id, n]));

  // anchor position for a column (for column-lineage edges)
  const colAnchor = (nodeId, colName, side) => {
    const n = byId[nodeId];
    if (!n || !expanded[nodeId]) return null;
    const idx = (n.columns || []).findIndex((c) => (c.name || "").toLowerCase() === colName.toLowerCase());
    if (idx < 0) return null;
    const y = n.y + HEADER_H + COL_PAD + idx * COL_ROW_H + COL_ROW_H / 2;
    return { x: side === "out" ? n.x + NODE_W : n.x, y };
  };

  const openNode = (n) => {
    setDrawer(n); setSql(null);
    if (n.type === "MODEL") api.transformation(n.id).then((r) => setSql(r.compiled_sql));
  };

  const visibleColEdges = colEdges.map((e) => {
    const fromNode = e.from_column.split(".").slice(0, -1).join(".");
    const fromCol = e.from_column.split(".").pop();
    const toNode = e.to_column.split(".").slice(0, -1).join(".");
    const toCol = e.to_column.split(".").pop();
    const a = colAnchor(fromNode, fromCol, "out");
    const b = colAnchor(toNode, toCol, "in");
    return a && b ? { ...e, a, b, fromCol, toCol } : null;
  }).filter(Boolean);

  const height = Math.max(440, ...laid.map((n) => n.y + n.h + 40));

  return (
    <div>
      <SectionHeader t={t}>Data 360</SectionHeader>
      <ProjectSwitcher t={t} value={project} onChange={setProject} />

      {/* page-level scope: All | SEI | Non-SEI, with legacy-system badges under Non-SEI */}
      <div style={{ display: "flex", marginTop: 14 }}>
        {[["all", "All"], ["sei", "SEI"], ["nonsei", "Non-SEI"]].map(([k, label], i) => (
          <button key={k} onClick={() => setScope(k)} style={{ fontSize: 12, fontWeight: 700,
            padding: "7px 20px", cursor: "pointer", fontFamily: t.font,
            border: `1px solid ${scope === k ? t.accent : (t.border || t.disabled)}`,
            borderLeft: i === 0 ? undefined : 0,
            borderRadius: i === 0 ? "3px 0 0 3px" : i === 2 ? "0 3px 3px 0" : 0,
            background: scope === k ? t.accent : t.panel,
            color: scope === k ? "#fff" : (t.sub || t.textMuted) }}>{label}</button>))}
      </div>
      {scope === "nonsei" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "10px 14px",
          background: "#fbfcfe", border: `1px solid ${t.border || t.disabled}`, borderRadius: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px",
            color: t.muted || t.textMuted, marginRight: 4 }}>Legacy system</span>
          {Object.entries(LEGACY_SYS_D360).map(([k, v]) => (
            <span key={k} onClick={() => setLegacySys(k)} style={{ display: "flex", alignItems: "center",
              gap: 7, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 999,
              cursor: "pointer", border: `1.5px solid ${legacySys === k ? v.c : (t.border || t.disabled)}`,
              background: legacySys === k ? v.c : t.panel,
              color: legacySys === k ? "#fff" : (t.sub || t.textMuted) }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%",
                background: legacySys === k ? "#fff" : v.c }} />{v.label}</span>))}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.muted || t.textMuted }}>
            {LEGACY_SYS_D360[legacySys].label} · legacy source scope</span>
        </div>)}

      {/* top-level tabs: Pipelines (business processes) vs Lineage Graph */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${t.border || t.disabled}`,
        margin: "18px 0 20px" }}>
        {["Pipelines", "Inbound Feeds", "Loaders", "Interdependency", "Compression", "Lineage Graph"].map((tb) => (
          <button key={tb} onClick={() => setD360tab(tb)} style={{
            background: "none", border: "none", fontSize: 13, fontWeight: 500,
            padding: "10px 18px", cursor: "pointer", fontFamily: t.font,
            color: d360tab === tb ? t.accent : (t.sub || t.textMuted),
            borderBottom: `2px solid ${d360tab === tb ? t.accent : "transparent"}`,
            marginBottom: -1 }}>{tb}</button>))}
      </div>

      {d360tab === "Pipelines" && <PipelinesTab t={t} project={project} scope={scope} legacySys={legacySys} />}

      {d360tab === "Inbound Feeds" && <InboundFeedsView t={t} target={selection?.tab === "Inbound Feeds" ? selection.id : null} />}

      {d360tab === "Loaders" && <LoadersView t={t} />}

      {d360tab === "Interdependency" && <InterdependencyTab t={t} />}

      {d360tab === "Compression" && <CompressionView t={t} />}

      {d360tab === "Lineage Graph" && (
      <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["Detail", "Canvas"].map((lv) => (
          <button key={lv} onClick={() => setLineageView(lv)} style={{
            height: t.height.btnSm, padding: "0 16px", border: `1px solid ${t.border}`,
            borderRadius: t.radius.sm, cursor: "pointer", fontFamily: t.font, fontSize: 13,
            fontWeight: 600,
            background: lineageView === lv ? t.accent : t.panel,
            color: lineageView === lv ? "#fff" : t.text }}>{lv}</button>
        ))}
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 8, alignSelf: "center" }}>
          {lineageView === "Detail" ? "dbt models + Airflow + column-transform graph"
            : "Interactive graph \u2014 drag nodes, pan, zoom, expand columns"}
        </span>
      </div>

      {lineageView === "Canvas" && <LineageCanvas t={t} projectId={project} />}

      {lineageView === "Detail" && (
      <div>
      <div style={{ display: "flex", gap: 6, margin: "0 0 20px", alignItems: "center" }}>
        {PLANES.map((p) => (
          <button key={p} onClick={() => setPlane(p)} style={{
            height: t.height.btnSm, padding: "0 14px", border: `1px solid ${t.border}`,
            borderRadius: t.radius.sm, cursor: "pointer", fontFamily: t.font, fontSize: 13,
            background: plane === p ? t.navy : t.panel, color: plane === p ? "#fff" : t.text }}>
            {p}</button>
        ))}
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 10 }}>
          {plane === "Data" && "Tables, views & feeds \u2014 what flows where"}
          {plane === "Transform" && "dbt models inserted \u2014 expand a node for column lineage"}
          {plane === "Orchestration" && "Airflow DAG overlay \u2014 which DAG runs which model"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ flex: 1, background: t.panel, border: `1px solid ${t.disabled}`,
          borderRadius: t.radius.md, height: 480, position: "relative", overflow: "auto" }}>
          <svg width={PAD + 4 * (NODE_W + COL_GAP)} height={height}
            style={{ position: "absolute", top: 0, left: 0 }}>
            <defs>
              <marker id="d360a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0 0 L6 3 L0 6 Z" fill={t.border} /></marker>
              <marker id="d360c" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                <path d="M0 0 L5 3 L0 6 Z" fill={t.hover} /></marker>
            </defs>
            {/* table-level edges */}
            {g.edges.map((e, i) => {
              const a = byId[e.from_key], b = byId[e.to_key];
              if (!a || !b) return null;
              const ax = a.x + NODE_W, ay = a.y + HEADER_H / 2, bx = b.x, by = b.y + HEADER_H / 2;
              const dx = (bx - ax) * 0.5;
              const cross = a.project_id !== b.project_id;
              const orch = e.from_type === "dag";
              return <path key={"e" + i}
                d={`M${ax} ${ay} C${ax + dx} ${ay} ${bx - dx} ${by} ${bx} ${by}`}
                fill="none" stroke={orch ? t.modDatapoint : cross ? t.hover : t.border}
                strokeWidth={cross || orch ? 2 : 1.5}
                strokeDasharray={cross ? "5 3" : orch ? "2 3" : "none"}
                markerEnd="url(#d360a)" opacity="0.8" />;
            })}
            {/* column-level edges (when expanded) */}
            {visibleColEdges.map((e, i) => {
              const hl = selCol && (e.from_column === selCol || e.to_column === selCol);
              const dx = (e.b.x - e.a.x) * 0.5;
              return <g key={"c" + i}>
                <path d={`M${e.a.x} ${e.a.y} C${e.a.x + dx} ${e.a.y} ${e.b.x - dx} ${e.b.y} ${e.b.x} ${e.b.y}`}
                  fill="none" stroke={hl ? t.accent : t.hover}
                  strokeWidth={hl ? 2.5 : 1.3} markerEnd="url(#d360c)" opacity={hl ? 1 : 0.55} />
                {hl && <text x={(e.a.x + e.b.x) / 2} y={(e.a.y + e.b.y) / 2 - 4}
                  fontSize="10" fill={t.accent} textAnchor="middle"
                  style={{ fontWeight: 700 }}>{e.transform_expr}</text>}
              </g>;
            })}
          </svg>

          {laid.map((n) => (
            <div key={n.id} style={{ position: "absolute", left: n.x, top: n.y, width: NODE_W,
              background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md,
              boxShadow: t.shadow.reg }}>
              <div onClick={() => openNode(n)} style={{ height: HEADER_H, display: "flex",
                alignItems: "center", gap: 8, padding: "0 8px 0 12px", position: "relative",
                borderBottom: expanded[n.id] ? `1px solid ${t.bg}` : "none", cursor: "pointer" }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                  background: LAYER_STRIPE[n.layer] || t.layerNone }} />
                {(n.columns || []).length > 0 && (
                  <span onClick={(ev) => { ev.stopPropagation();
                    setExpanded((x) => ({ ...x, [n.id]: !x[n.id] })); }}
                    style={{ cursor: "pointer", fontSize: 10, color: t.sub }}>
                    {expanded[n.id] ? "\u25BE" : "\u25B8"}</span>)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    color: t.textMuted }}>{n.type}</div>
                </div>
                <span style={{ position: "absolute", top: 4, right: 5 }}>
                  <ProjectBadge projectId={n.project_id} t={t} /></span>
              </div>
              {expanded[n.id] && (
                <div style={{ padding: `${COL_PAD}px 0` }}>
                  {(n.columns || []).map((c) => {
                    const cid = `${n.id}.${c.name}`;
                    const on = selCol === cid;
                    return (
                      <div key={c.name} onClick={() => setSelCol(on ? null : cid)}
                        style={{ height: COL_ROW_H, display: "flex", alignItems: "center",
                          gap: 6, padding: "0 12px", fontSize: 11, cursor: "pointer",
                          background: on ? t.infoBg : "transparent",
                          color: c.is_pii ? t.danger : t.text }}>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis" }}>{c.name}</span>
                        {c.is_pk === "Y" && <span style={{ fontSize: 9, color: t.accent,
                          fontWeight: 700 }}>PK</span>}
                        {c.is_pii && <span style={{ fontSize: 9, color: t.danger,
                          fontWeight: 700 }}>PII</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {drawer && (
          <div style={{ width: 360, background: t.panel, border: `1px solid ${t.disabled}`,
            borderLeft: "none", padding: 20, overflow: "auto", height: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <ProjectBadge projectId={drawer.project_id} t={t} />
                <div style={{ fontSize: 18, fontWeight: 500, marginTop: 8 }}>{drawer.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{drawer.type} \u00b7 {drawer.layer || "\u2014"}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ border: `1px solid ${t.border}`,
                background: t.panel2, borderRadius: t.radius.sm, width: 28, height: 28,
                cursor: "pointer" }}>\u2715</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 0.5, color: t.textMuted, margin: "16px 0 6px" }}>Columns</div>
            {(drawer.columns || []).map((c) => (
              <div key={c.name} style={{ display: "flex", justifyContent: "space-between",
                padding: "5px 0", borderBottom: `1px solid ${t.bg}`, fontSize: 12 }}>
                <span style={{ color: c.is_pii ? t.danger : t.text }}>{c.name}</span>
                <span style={{ color: t.textMuted }}>{c.type || ""}</span>
              </div>
            ))}
            {sql && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.5, color: t.textMuted, margin: "16px 0 6px" }}>
                  Transformation (compiled SQL)</div>
                <pre style={{ background: "#0b1f3a", color: "#e6edf6", padding: 12,
                  borderRadius: t.radius.md, fontSize: 11, overflow: "auto",
                  whiteSpace: "pre-wrap" }}>{sql}</pre>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 15, marginTop: 15, fontSize: 12,
        color: t.sub, alignItems: "center", flexWrap: "wrap" }}>
        {["bronze", "silver", "gold"].map((l) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: LAYER_STRIPE[l] }} />{l}
          </span>))}
        <span style={{ color: t.hover }}>\u2014 click a column to trace its lineage + see the transform expression</span>
        <span style={{ color: t.modDatapoint }}>\u00b7 \u00b7 \u00b7 dotted = DAG orchestration (Orchestration plane)</span>
      </div>
      </div>
      )}
      </div>
      )}
    </div>
  );
}

function layoutNodes(nodes, expanded) {
  // group by column, stack rows, account for expanded height
  return nodes.map((n) => {
    const cols = (n.columns || []).length;
    const h = expanded[n.id] ? HEADER_H + COL_PAD * 2 + cols * COL_ROW_H : HEADER_H;
    return { ...n, x: PAD + n.col * (NODE_W + COL_GAP),
      y: PAD + n.row * (HEADER_H + ROW_GAP + 90), h, w: NODE_W };
  });
}

// ===================================================================
// Pipelines view — business-process pipelines (EOD/BOD), Airflow + dbt
// ===================================================================
function PipelinesView({ t, project }) {
  const [pipes, setPipes] = useState([]);
  const [active, setActive] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    api.pipelines(project).then((r) => {
      setPipes(r.pipelines || []);
      const first = (r.pipelines || [])[0];
      if (first) api.pipelineDetail(first.pipeline_id).then(setActive);
    });
  }, [project]);

  const SCHED = { EOD: "#0091bf", BOD: "#7c3aed", Intraday: "#e67e22", Reference: "#5a6472" };
  const STATUS = { success: "#159943", failed: "#c1113a", running: "#e67e22", unknown: "#9aa3b0" };
  const LAYER = { bronze: "#a8743a", silver: "#8a9199", gold: "#c8a13a" };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* pipeline list */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: ".5px", color: t.muted || t.textMuted, marginBottom: 8 }}>
          Pipelines ({pipes.length})</div>
        {pipes.map((p) => (
          <button key={p.pipeline_id}
            onClick={() => { setModel(null); api.pipelineDetail(p.pipeline_id).then(setActive); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
              marginBottom: 6, cursor: "pointer", fontFamily: t.font,
              border: `1px solid ${active?.pipeline_id === p.pipeline_id ? t.accent : t.border}`,
              borderRadius: 6, background: active?.pipeline_id === p.pipeline_id ? (t.infobg || "#e0f5fd") : t.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: STATUS[p.last_status] }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: t.navy }}>{p.display_name}</span>
              <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#fff",
                background: SCHED[p.schedule] || t.muted, padding: "2px 6px", borderRadius: 3 }}>{p.schedule}</span>
            </div>
            <div style={{ fontSize: 11, color: t.sub || t.textMuted, marginTop: 3 }}>
              {p.model_count} models · {p.feed_count} feeds · {p.dags?.length || 0} DAG</div>
          </button>))}
      </div>

      {/* detail */}
      <div style={{ flex: 1 }}>
        {active && <PipelineDetail t={t} p={active} SCHED={SCHED} STATUS={STATUS} LAYER={LAYER}
          activeModel={model?.model}
          onModel={(m) => {
            if (model?.model === m) { setModel(null); return; }  // toggle off
            api.pipelineModel(active.pipeline_id, m).then(setModel);
          }} />}
        {/* lineage shows inline BELOW the pipeline when a model is clicked */}
        {model && (
          <div style={{ marginTop: 8, paddingTop: 18, borderTop: `2px solid ${t.accent}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              color: t.accent, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              Lineage — {model.model}
              <span onClick={() => setModel(null)} style={{ cursor: "pointer", color: t.muted,
                fontSize: 12, textTransform: "none", fontWeight: 400 }}>× close</span>
            </div>
            <ModelDetail t={t} m={model} LAYER={LAYER} onBack={() => setModel(null)} embedded />
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineDetail({ t, p, SCHED, STATUS, LAYER, onModel, activeModel }) {
  const cell = { padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${t.bg}` };
  const th = { background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "8px 10px",
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: t.navy }}>{p.display_name} Pipeline</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: SCHED[p.schedule] || t.muted,
          padding: "3px 8px", borderRadius: 3 }}>{p.schedule}</span>
      </div>
      <div style={{ fontSize: 12, color: t.sub || t.textMuted, marginBottom: 16 }}>
        {p.feed_count} source feeds · {p.model_count} dbt models · {p.dags?.length || 0} Airflow DAG(s)</div>

      {/* Airflow DAG + run status */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, marginBottom: 8 }}>
        ① Orchestration — Airflow</div>
      {(p.dags || []).map((d) => (
        <div key={d.dag_id} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6,
          padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: t.navy }}>{d.dag_id}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: SCHED[d.schedule] || t.muted,
              padding: "2px 6px", borderRadius: 3 }}>{d.schedule}</span>
          </div>
          {/* recent task runs */}
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {(p.runs || []).filter((r) => r.dag_id === d.dag_id).map((r, i) => (
              <span key={i} title={`${r.task_id} (${r.status}, ${r.duration_s}s)`} style={{
                fontSize: 10, padding: "3px 7px", borderRadius: 3, color: "#fff",
                background: STATUS[r.status] || t.muted }}>{r.task_id?.replace(/_run$/, "")}</span>))}
          </div>
        </div>))}

      {/* SWP feeds (bronze source) */}
      {p.feeds?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, marginBottom: 8 }}>
            ② Source — SWP EOD Feeds</div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
            <thead><tr>{["Feed", "Schema", "Class", "Geography"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{p.feeds.map((f) => (
              <tr key={f.feed}><td style={cell}><b>{f.feed}</b></td><td style={cell}>{f.schema_name}</td>
                <td style={cell}>{f.feed_class}</td><td style={cell}>{f.geography}</td></tr>))}</tbody>
          </table>
        </div>)}

      {/* dbt models in medallion order */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, margin: "16px 0 8px" }}>
        ③ Transform — dbt Models (bronze → silver → gold)</div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {(p.models || []).map((m, i) => (
          <React.Fragment key={m.model}>
            <button onClick={() => onModel(m.model)} style={{ cursor: "pointer",
              background: activeModel === m.model ? (t.infobg || "#e0f5fd") : t.panel,
              border: `1px solid ${activeModel === m.model ? t.accent : t.border}`,
              borderLeft: `3px solid ${LAYER[m.layer] || t.muted}`,
              boxShadow: activeModel === m.model ? `0 0 0 1px ${t.accent}` : "none",
              borderRadius: 4, padding: "8px 11px", minWidth: 120, fontFamily: t.font, textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: LAYER[m.layer] || t.muted, textTransform: "uppercase" }}>{m.layer}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.navy, marginTop: 2 }}>{m.model}</div>
              <div style={{ fontSize: 10, color: t.muted || t.textMuted }}>{m.schema_name}</div>
            </button>
            {i < p.models.length - 1 && <span style={{ color: t.muted, fontSize: 16, padding: "0 6px" }}>→</span>}
          </React.Fragment>))}
      </div>
      <div style={{ fontSize: 12, color: t.sub || t.textMuted }}>
        Click any model to see its transformation SQL and column lineage. The arrows show the end-to-end
        lineage from raw feed through bronze/silver to the gold mart.</div>
    </div>
  );
}

function ModelDetail({ t, m, LAYER, onBack, embedded }) {
  const tx = m.transformation || {};
  return (
    <div>
      {!embedded && <button onClick={onBack} style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${t.border}`,
        borderRadius: 4, background: t.panel, cursor: "pointer", color: t.sub || t.textMuted, marginBottom: 14 }}>
        ← Back to pipeline</button>}
      <div style={{ fontSize: 18, fontWeight: 600, color: t.navy, marginBottom: 2 }}>{m.model}</div>
      <div style={{ fontSize: 12, color: t.muted || t.textMuted, marginBottom: 14 }}>
        {tx.transform_type || "dbt model"} transformation</div>

      {/* dbt model rules: Materialization / Tests / Meta (mockup) */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel,
        border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
        <tbody>
          {[["Materialization", <span style={{ fontFamily: "monospace" }}>{m.materialization || "table"}</span>],
            ["Tests", <span style={{ fontFamily: "monospace", fontSize: 12 }}>{m.tests_summary || "\u2014"}</span>],
            ["Meta", `domain: ${m.meta?.domain || "\u2014"} · pii: ${m.meta?.pii || "no"}`]].map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                color: t.accent, width: 150, borderBottom: `1px solid ${t.bg}`, verticalAlign: "top" }}>{k}</td>
              <td style={{ padding: "8px 12px", fontSize: 12.5, color: t.navy, borderBottom: `1px solid ${t.bg}` }}>{v}</td>
            </tr>))}
        </tbody>
      </table>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, marginBottom: 8 }}>
        Transformation SQL</div>
      <pre style={{ background: "#0a0f24", color: "#cfe3ff", padding: 16, borderRadius: 6, fontSize: 12,
        overflowX: "auto", fontFamily: "monospace", lineHeight: 1.5 }}>{tx.compiled_sql || "—"}</pre>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, margin: "16px 0 8px" }}>
        Column lineage</div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
        <thead><tr>{["Source column", "→", "Target column", "Transform expression"].map((h) => (
          <th key={h} style={{ background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "8px 10px",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent }}>{h}</th>))}</tr></thead>
        <tbody>{(m.column_lineage || []).map((c, i) => (
          <tr key={i}>
            <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12, borderBottom: `1px solid ${t.bg}` }}>{c.from_column}</td>
            <td style={{ padding: "8px 10px", color: t.muted, borderBottom: `1px solid ${t.bg}` }}>→</td>
            <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: t.navy, borderBottom: `1px solid ${t.bg}` }}>{c.to_column}</td>
            <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: t.hover || t.modApi, borderBottom: `1px solid ${t.bg}` }}>{c.transform_expr}</td>
          </tr>))}</tbody>
      </table>

      {(m.quality_rules || []).length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted || t.textMuted, margin: "18px 0 8px" }}>
            Data quality rules <span style={{ fontWeight: 400, textTransform: "none" }}>(dbt tests + Soda/GE gates)</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
            <thead><tr>{["Column", "Test", "Gate", "Severity"].map((h) => (
              <th key={h} style={{ background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "8px 10px",
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent }}>{h}</th>))}</tr></thead>
            <tbody>{(m.quality_rules || []).map((q, i) => (
              <tr key={i}>
                <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 12, borderBottom: `1px solid ${t.bg}` }}>{q.column}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600, color: t.navy, borderBottom: `1px solid ${t.bg}` }}>{q.test}</td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: t.sub || t.textMuted, borderBottom: `1px solid ${t.bg}` }}>{q.gate}</td>
                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${t.bg}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", borderRadius: 3, padding: "2px 7px",
                    background: q.severity === "error" ? "#c1113a" : "#c77f0a" }}>{q.severity}</span></td>
              </tr>))}</tbody>
          </table>
          <div style={{ fontSize: 10.5, color: t.muted || t.textMuted, marginTop: 5 }}>
            Derived from column metadata: not_null on required columns, unique on keys, accepted_values where reference data exists, PII gates on sensitive columns.</div>
        </>
      )}
    </div>
  );
}

// ===================================================================
// Inbound Feed Catalog — SWP EOD feeds (searchable + workstream groups)
// ===================================================================
function InboundFeedsView({ t, target }) {
  const [workstreams, setWorkstreams] = useState([]);
  const [ws, setWs] = useState(null);
  const [q, setQ] = useState("");
  const [feeds, setFeeds] = useState([]);
  const [sel, setSel] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => { api.inboundFeedWorkstreams().then((r) => setWorkstreams(r.workstreams || [])); }, []);
  // deep-link: if a target feed name/key arrives from search, open it
  useEffect(() => {
    if (target) {
      const feedName = target.includes(".") ? target.split(".").pop() : target;
      api.inboundFeedDetail(feedName).then((d) => { if (d && d.feed) setSel(d); });
    }
  }, [target]);
  useEffect(() => {
    api.inboundFeeds({ workstream: ws || undefined, q: q || undefined }).then((r) => {
      setFeeds(r.feeds || []);
      if ((r.feeds || []).length) api.inboundFeedDetail(r.feeds[0].feed).then(setSel);
      else setSel(null);
    });
  }, [ws, q]);

  const CLASS = { financial: "#0091bf", static: "#5a6472" };

  return (
    <div>
      <p style={{ fontSize: 13, color: t.sub || t.textMuted, margin: "0 0 16px", lineHeight: 1.6, maxWidth: 820 }}>
        Inbound feed catalog — SWP EOD feeds coming into BBH (from SWP_EOD_Data_Feeds.xlsx). Browse by
        workstream or search, then drill into a feed's fields. Reference metadata for understanding and verification.</p>

      {/* workstream group chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setWs(null)} style={chip(t, ws === null)}>All ({workstreams.reduce((s, w) => s + w.c, 0)})</button>
        {workstreams.map((w) => (
          <button key={w.workstream} onClick={() => setWs(ws === w.workstream ? null : w.workstream)}
            style={chip(t, ws === w.workstream)}>{w.workstream} ({w.c})</button>))}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search feeds…"
        style={{ width: 320, padding: "8px 12px", fontSize: 13, fontFamily: t.font,
          border: `1px solid ${t.border}`, borderRadius: 6, marginBottom: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
        {/* feed list — grouped by domain */}
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden", maxHeight: 540, overflowY: "auto" }}>
          {(() => {
            // group feeds by domain (fallback to workstream, then 'Other')
            const groups = {};
            feeds.forEach((f) => {
              const d = f.domain || f.workstream || "Other";
              (groups[d] = groups[d] || []).push(f);
            });
            const domains = Object.keys(groups).sort();
            if (domains.length === 0)
              return <div style={{ padding: 16, color: t.muted, fontSize: 12 }}>No feeds.</div>;
            return domains.map((d) => {
              const isCollapsed = collapsedGroups[d];
              return (
              <div key={d}>
                <div onClick={() => setCollapsedGroups((g) => ({ ...g, [d]: !g[d] }))}
                  style={{ padding: "7px 14px", background: t.bgsoft || "#eef3f3",
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px",
                  color: t.accent, position: "sticky", top: 0, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, width: 10, display: "inline-block", transition: "transform .15s",
                    transform: isCollapsed ? "rotate(-90deg)" : "none" }}>{"\u25BC"}</span>
                  {d} <span style={{ color: t.muted, fontWeight: 400 }}>({groups[d].length})</span></div>
                {!isCollapsed && groups[d].map((f) => (
                  <div key={f.feed} onClick={() => api.inboundFeedDetail(f.feed).then(setSel)}
                    style={{ padding: "10px 14px", borderBottom: `1px solid ${t.bg}`, cursor: "pointer",
                      background: sel?.feed === f.feed ? (t.infoBg || "#e0f5fd") : t.panel,
                      borderLeft: sel?.feed === f.feed ? `3px solid ${t.accent}` : "3px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ fontSize: 13, color: t.navy }}>{f.feed}</b>
                      <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#fff",
                        background: CLASS[f.feed_class] || t.muted, padding: "2px 6px", borderRadius: 3 }}>
                        {(f.feed_class || "").toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.sub || t.textMuted, marginTop: 3 }}>
                      {f.workstream} · {f.field_count} fields</div>
                  </div>))}
              </div>);
            });
          })()}
        </div>

        {/* feed detail */}
        <div>{sel && <FeedDetail t={t} f={sel} CLASS={CLASS} />}</div>
      </div>
    </div>
  );
}

function FeedDetail({ t, f, CLASS }) {
  const cell = { padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${t.bg}` };
  const th = { background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "8px 10px",
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: t.navy }}>{f.feed}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: CLASS[f.feed_class] || t.muted, padding: "3px 8px", borderRadius: 3 }}>
          {(f.feed_class || "").toUpperCase()}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#0091bf", padding: "3px 8px", borderRadius: 3 }}>INBOUND · SWP → BBH</span>
      </div>
      <div style={{ fontSize: 12, color: t.sub || t.textMuted, marginBottom: 4 }}>
        Workstream: <b>{f.workstream}</b> · Domain: <b>{f.domain || "—"}</b> · {(f.fields || []).length} fields</div>
      {f.business_desc && <div style={{ fontSize: 13, color: t.sub || t.textMuted, marginBottom: 16 }}>{f.business_desc}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
        <thead><tr>{["#", "Field", "Business Meaning", "Type", "Len", "Null", "PK", "PII"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{(f.fields || []).map((c) => (
          <tr key={c.name}>
            <td style={{ ...cell, color: t.muted }}>{c.position_order}</td>
            <td style={{ ...cell, fontFamily: "monospace", fontSize: 12 }}>{c.name}</td>
            <td style={cell}>{c.business_desc}</td>
            <td style={{ ...cell, fontFamily: "monospace", fontSize: 12 }}>{c.data_type}</td>
            <td style={cell}>{c.max_length}</td>
            <td style={cell}>{c.nullable === "N" ? <span style={{ color: t.danger || "#c1113a", fontWeight: 600 }}>NOT NULL</span> : "null"}</td>
            <td style={cell}>{c.is_pk === "Y" ? <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#5a6472", padding: "1px 5px", borderRadius: 3 }}>PK</span> : ""}</td>
            <td style={cell}>{c.is_pii === "Y" ? <span title={c.pii_attribute} style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#c1113a", padding: "1px 5px", borderRadius: 3 }}>PII</span> : ""}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

const chip = (t, on) => ({ fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: t.font,
  border: `1px solid ${on ? t.accent : t.border}`, borderRadius: 16,
  background: on ? (t.infoBg || "#e0f5fd") : t.panel, color: on ? t.accent : (t.sub || t.text) });

// ===================================================================
// Pipelines tab — Business (bf_pipelines, 444 w/ v20 routing) is primary;
// Technical (dbt/Airflow) preserved behind a toggle.
// ===================================================================
function PipelinesTab({ t, project, scope, legacySys }) {
  const [mode, setMode] = useState("business");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["business", "Business Pipelines"], ["technical", "Technical (dbt · Airflow)"]].map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            fontFamily: t.font, fontSize: 12, fontWeight: 600, cursor: "pointer",
            padding: "6px 14px", borderRadius: 16,
            border: `1px solid ${mode === k ? t.accent : t.border}`,
            background: mode === k ? (t.infobg || "#e0f5fd") : t.panel,
            color: mode === k ? t.accent : (t.sub || t.textMuted) }}>{label}</button>))}
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#fff",
          background: "#0091bf", padding: "3px 10px", borderRadius: 3, alignSelf: "center" }}>BATCH</span>
      </div>
      {mode === "business" ? <BfPipelinesView t={t} scope={scope} curSys={legacySys} />
        : <PipelinesView t={t} project={project} />}
    </div>
  );
}

// Business pipelines: the 444 from the v20 workbook, with the migration
// routing story (Routing Pattern / Legacy / Compressed / Action / Rationale).
function BfPipelinesView({ t, scope = "all", curSys = "ADDVANTAGE" }) {
  const [pipes, setPipes] = useState([]);
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  const [dom, setDom] = useState("");
  const [openGrp, setOpenGrp] = useState({});

  useEffect(() => {
    api.bfPipelines({ limit: 500 }).then((r) => {
      const list = r.pipelines || [];
      setPipes(list);
      if (list[0]) api.bfPipeline(list[0].pipeline_id).then(setDetail);
    });
  }, []);

  const domains = [...new Set(pipes.map((p) => p.business_domain).filter(Boolean))].sort();
  const hasLegacy = (p) => !!String(p.legacy_system || "").trim()
    && !/^(n\/a|none|-+)$/i.test(String(p.legacy_system).trim());
  const sysRe = (LEGACY_SYS_D360[curSys] || {}).re;
  const inScope = (p) =>
    scope === "all" ? true :
    scope === "sei" ? !hasLegacy(p) :
    hasLegacy(p) && (!sysRe || sysRe.test(String(p.legacy_system)));
  const filtered = pipes.filter((p) => inScope(p) &&
    (!dom || p.business_domain === dom) &&
    (!q || (p.pipeline_id + " " + (p.pipeline_name || "")).toLowerCase().includes(q.toLowerCase())));
  // Non-SEI: group by business function (business_domain), collapsible, first two open
  const grouped = scope === "nonsei"
    ? filtered.reduce((m, p) => { const k = p.business_domain || "Other";
        (m[k] = m[k] || []).push(p); return m; }, {})
    : null;
  const grpKeys = grouped ? Object.keys(grouped).sort() : [];
  const grpOpen = (k, i) => (openGrp[k] === undefined ? i < 2 : openGrp[k]);
  const P = detail?.pipeline;
  const RP = { Direct_Keep: "#159943", Reroute: "#e67e22", Consolidate: "#7c3aed" };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 300, flexShrink: 0 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter pipelines…"
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13,
            fontFamily: t.font, border: `1px solid ${t.border}`, borderRadius: 6, marginBottom: 8 }} />
        <select value={dom} onChange={(e) => setDom(e.target.value)}
          style={{ width: "100%", padding: "7px 8px", fontSize: 12, fontFamily: t.font,
            border: `1px solid ${t.border}`, borderRadius: 6, marginBottom: 8, background: t.panel }}>
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: ".5px", color: t.muted || t.textMuted, margin: "4px 0 8px" }}>
          {filtered.length} of {pipes.length} pipelines</div>
        {(() => {
          const renderPipe = (p) => (
            <button key={p.pipeline_id}
              onClick={() => api.bfPipeline(p.pipeline_id).then(setDetail)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px",
                marginBottom: 5, cursor: "pointer", fontFamily: t.font,
                border: `1px solid ${P?.pipeline_id === p.pipeline_id ? t.accent : t.border}`,
                borderRadius: 6, background: P?.pipeline_id === p.pipeline_id ? (t.infobg || "#e0f5fd") : t.panel }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.navy }}>{p.pipeline_name || p.pipeline_id}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 3, alignItems: "center" }}>
                {p.routing_pattern && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff",
                  background: RP[p.routing_pattern] || "#5a6472", padding: "1px 6px", borderRadius: 3 }}>{p.routing_pattern}</span>}
                <span style={{ fontSize: 10, color: t.sub || t.textMuted }}>{p.schedule} · {p.direction}</span>
              </div>
            </button>);
          return (
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {grouped ? grpKeys.map((k, i) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <div onClick={() => setOpenGrp((o) => ({ ...o, [k]: !grpOpen(k, i) }))}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                      cursor: "pointer", borderRadius: 6, marginBottom: 5,
                      background: "linear-gradient(to right,#f3eefb,#fbfcfe)",
                      border: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: 9, color: t.muted || t.textMuted }}>
                      {grpOpen(k, i) ? "▾" : "▶"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700,
                      color: (LEGACY_SYS_D360[curSys] || {}).c || t.navy }}>{k}</span>
                    <span style={{ fontSize: 9.5, color: t.muted || t.textMuted }}>
                      · {grouped[k].length} pipeline{grouped[k].length > 1 ? "s" : ""}</span>
                  </div>
                  {grpOpen(k, i) && grouped[k].slice(0, 100).map(renderPipe)}
                </div>))
                : filtered.slice(0, 200).map(renderPipe)}
            </div>);
        })()}
      </div>

      <div style={{ flex: 1 }}>
        {P && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: t.navy, marginBottom: 2 }}>{P.pipeline_name || P.pipeline_id}</div>
            <div style={{ fontSize: 12, color: t.sub || t.textMuted, marginBottom: 14 }}>
              {P.business_domain} · {P.archetype} · {P.schedule} · owner {P.owner || "—"}</div>

            <KV t={t} rows={[
              ["Legacy", P.legacy_system],
              ["SEI Target", [P.sei_target_type, P.sei_target_id].filter(Boolean).join(" · ")],
              ["Routing", P.feed_routing],
              ["Linked API Flow", P.linked_api_flow_id, true],
              ["Associated Feeds", P.associated_feeds],
            ]} />

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              color: t.muted || t.textMuted, margin: "18px 0 8px" }}>Migration routing story (v20)</div>
            <KV t={t} rows={[
              ["Routing Pattern", P.routing_pattern],
              ["Legacy Routing", P.legacy_feed_routing],
              ["Compressed Routing", P.compressed_routing],
              ["Compression Action", P.compression_action],
              ["Rationale", P.notes_compression],
            ]} />

            {(detail.stages || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                  color: t.muted || t.textMuted, margin: "18px 0 8px" }}>Stages ({detail.stages.length})</div>
                <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel,
                  border: `1px solid ${t.border}`, borderRadius: 8 }}>
                  <thead><tr>
                    {["#", "Stage", "Member", "Type", "System"].map((h) => (
                      <th key={h} style={{ background: t.bgsoft || "#eef3f3", textAlign: "left",
                        padding: "7px 9px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        color: t.accent }}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {detail.stages.map((s, i) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 9px", fontSize: 12 }}>{s.stage_order}</td>
                        <td style={{ padding: "6px 9px", fontSize: 12, fontWeight: 600 }}>{s.stage}</td>
                        <td style={{ padding: "6px 9px", fontSize: 12, fontFamily: "monospace" }}>{s.member_name || s.member_id}</td>
                        <td style={{ padding: "6px 9px", fontSize: 12 }}>{s.member_type}</td>
                        <td style={{ padding: "6px 9px", fontSize: 12 }}>{s.system}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </div>)}
      </div>
    </div>
  );
}

function KV({ t, rows }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: "4px 14px" }}>
      {rows.filter(([, v]) => v).map(([k, v, isChip]) => (
        <div key={k} style={{ display: "flex", gap: 12, padding: "7px 0",
          borderBottom: `1px solid ${t.bg}` }}>
          <div style={{ width: 160, flexShrink: 0, fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", color: t.muted || t.textMuted, paddingTop: 2 }}>{k}</div>
          <div style={{ fontSize: 13, color: t.text || t.navy, lineHeight: 1.5 }}>
            {isChip ? <span style={{ fontSize: 11, fontWeight: 700, color: "#0091bf",
              background: "#e0f5fd", padding: "2px 8px", borderRadius: 10 }}>{v} <span style={{ fontWeight: 400 }}>· real-time equiv</span></span> : v}
          </div>
        </div>))}
    </div>
  );
}

// ===================================================================
// Loaders view — rich loader catalog (ldr_catalog)
// ===================================================================
function LoadersView({ t }) {
  const [loaders, setLoaders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [ltab, setLtab] = useState("attrs");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  useEffect(() => {
    api.loaders().then((r) => {
      setLoaders(r.loaders || []);
      if ((r.loaders || [])[0]) api.loaderDetail(r.loaders[0].loader_id).then(setDetail);
    });
  }, []);
  const pick = (id) => { setLtab("attrs"); api.loaderDetail(id).then(setDetail); };

  const th = { background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "7px 10px",
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent,
    borderBottom: `1px solid ${t.border}` };
  const td = { padding: "6px 10px", fontSize: 12, borderBottom: `1px solid ${t.bg}` };
  const mono = { ...td, fontFamily: "monospace" };
  const optPill = (o) => {
    const mand = /mand/i.test(o || "");
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
      color: "#fff", background: mand ? "#c1113a" : "#5a6472" }}>{o || "\u2014"}</span>;
  };

  const A = detail?.attributes || [];
  const V = detail?.validations || [];
  const MM = detail?.module_map || {};
  const C = detail?.canonical_map || [];
  const E = detail?.exceptions || [];

  const tabs = [["attrs", `Attributes${A.length ? ` (${A.length})` : ""}`],
    ["val", `Validations${V.length ? ` (${V.length})` : ""}`],
    ["map", "Module Mapping"], ["canon", `Canonical${C.length ? ` (${C.length})` : ""}`],
    ["err", `Errors${E.length ? ` (${E.length})` : ""}`]];

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 280, flexShrink: 0, maxHeight: 620, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          color: t.muted || t.textMuted, marginBottom: 8 }}>Loaders ({loaders.length})</div>
        {(() => {
          const groups = {};
          loaders.forEach((l) => {
            const d = l.business_domain || l.group_name || "Unassigned";
            (groups[d] = groups[d] || []).push(l);
          });
          return Object.keys(groups).sort().map((d) => {
            const isColl = collapsedGroups[d];
            return (
            <div key={d}>
              <div onClick={() => setCollapsedGroups((g) => ({ ...g, [d]: !g[d] }))}
                style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: ".5px", color: t.accent, padding: "8px 4px 4px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 8, width: 9, display: "inline-block",
                  transform: isColl ? "rotate(-90deg)" : "none" }}>{"\u25BC"}</span>
                {d} <span style={{ color: t.muted || t.textMuted, fontWeight: 400 }}>({groups[d].length})</span></div>
              {!isColl && groups[d].map((l) => (
                <button key={l.loader_id} onClick={() => pick(l.loader_id)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px",
                    marginBottom: 5, cursor: "pointer", fontFamily: t.font,
                    border: `1px solid ${detail?.loader_id === l.loader_id ? t.accent : t.border}`,
                    borderRadius: 6, background: detail?.loader_id === l.loader_id ? (t.infobg || "#e0f5fd") : t.panel }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.navy }}>{l.loader_name || l.loader_id}</div>
                  <div style={{ fontSize: 10.5, color: t.sub || t.textMuted, marginTop: 2 }}>
                    {[l.group_name, l.version && `v${l.version}`].filter(Boolean).join(" \u00b7 ")}</div>
                </button>))}
            </div>);
          });
        })()}
      </div>

      <div style={{ flex: 1 }}>
        {detail && detail.loader_id && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: t.navy }}>{detail.loader_name || detail.loader_id}</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#7c3aed",
                padding: "2px 9px", borderRadius: 10 }}>OUTBOUND \u00b7 BBH \u2192 SWP</span>
            </div>
            {detail.purpose && <div style={{ fontSize: 12.5, color: t.sub || t.textMuted, marginBottom: 10 }}>{detail.purpose}</div>}

            {/* tabs */}
            <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
              {tabs.map(([k, label]) => (
                <button key={k} onClick={() => setLtab(k)} style={{
                  background: "none", border: "none", fontFamily: t.font, fontSize: 13, fontWeight: 500,
                  padding: "8px 14px", cursor: "pointer", marginBottom: -1,
                  color: ltab === k ? t.accent : t.sub,
                  borderBottom: `2px solid ${ltab === k ? t.accent : "transparent"}` }}>{label}</button>
              ))}
            </div>

            {ltab === "attrs" && (
              <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
                <thead><tr>{["Attribute", "Type", "Optionality", "Business Meaning"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{A.map((a, i) => (
                  <tr key={i}>
                    <td style={mono}>{a.attribute_name}</td>
                    <td style={td}>{a.data_type}{a.max_length ? `(${a.max_length})` : ""}</td>
                    <td style={td}>{optPill(a.optionality)}</td>
                    <td style={{ ...td, color: t.sub || t.textMuted }}>{a.description || a.notes || ""}</td>
                  </tr>))}
                  {A.length === 0 && <tr><td colSpan={4} style={{ ...td, color: t.muted }}>No attributes.</td></tr>}</tbody>
              </table>)}

            {ltab === "val" && (
              <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
                <thead><tr>{["Attribute", "Rule", "Error"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{V.map((v, i) => (
                  <tr key={i}>
                    <td style={mono}>{v.attribute_name}</td>
                    <td style={td}>{v.validation_rule}</td>
                    <td style={{ ...td, color: "#c1113a" }}>{v.error_message}</td>
                  </tr>))}
                  {V.length === 0 && <tr><td colSpan={3} style={{ ...td, color: t.muted }}>No validation rules.</td></tr>}</tbody>
              </table>)}

            {ltab === "map" && (
              <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, padding: 14 }}>
                {[["API 360", MM?.api_360], ["Data 360", MM?.data_360], ["Datapoint 360", MM?.datapoint_360],
                  ["Interface 360", MM?.system_interface_360]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", padding: "8px 0", borderBottom: `1px solid ${t.bg}`, fontSize: 12 }}>
                    <span style={{ width: 130, color: t.textMuted }}>{k}</span>
                    {v ? <span style={{ fontFamily: "monospace", color: t.navy, background: t.bgsoft || "#eef3f3",
                      padding: "2px 8px", borderRadius: 4 }}>{v}</span> : <span style={{ color: t.muted }}>\u2014</span>}
                  </div>))}
                {!MM && <div style={{ fontSize: 12, color: t.muted }}>No module mapping.</div>}
              </div>)}

            {ltab === "canon" && (
              <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
                <thead><tr>{["Canonical", "Type", "Physical"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{C.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...mono, color: t.accent }}>{c.canonical_field}</td>
                    <td style={mono}>{c.canonical_data_type}</td>
                    <td style={mono}>{c.physical_field}</td>
                  </tr>))}
                  {C.length === 0 && <tr><td colSpan={3} style={{ ...td, color: t.muted }}>No canonical mapping.</td></tr>}</tbody>
              </table>)}

            {ltab === "err" && (
              <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
                <thead><tr>{["Error / Exception", "Description", "Resolution"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{E.map((e, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 700, color: "#c1113a" }}>{e.exception_type}</td>
                    <td style={td}>{e.description}</td>
                    <td style={{ ...td, color: t.sub || t.textMuted }}>{e.resolution_path}</td>
                  </tr>))}
                  {E.length === 0 && <tr><td colSpan={3} style={{ ...td, color: t.muted }}>No error/exception rules for this loader.</td></tr>}</tbody>
              </table>)}
          </div>)}
        {!detail?.loader_id && <div style={{ color: t.muted, fontSize: 13 }}>Select a loader.</div>}
      </div>
    </div>
  );
}

// ===================================================================
// Compression view — 444 pipelines -> shared dbt gold marts (the 12x story)
// ===================================================================
function CompressionView({ t }) {
  const [plan, setPlan] = useState([]);
  const [summary, setSummary] = useState([]);
  useEffect(() => {
    api.bfCompression().then((r) => {
      setPlan(r.plan || []);
      const s = r.summary || [];
      setSummary(Array.isArray(s) ? s : Object.entries(s).map(([metric, value]) => ({ metric, value })));
    });
  }, []);
  const maxN = Math.max(1, ...plan.map((p) => p.number_of_pipelines || 0));
  const sm = Object.fromEntries(summary.map((s) => [s.metric, s.value]));
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[["total_business_pipelines", "Business pipelines"], ["unique_linked_api_flows", "Linked API flows"],
          ["unique_dbt_gold_marts", "dbt gold marts"], ["dbt_compression_ratio", "Compression"]].map(([k, label]) => (
          <div key={k} style={{ flex: "1 1 160px", background: t.panel, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.accent }}>{sm[k] ?? "—"}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              color: t.muted || t.textMuted, marginTop: 2 }}>{label}</div>
          </div>))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        color: t.muted || t.textMuted, marginBottom: 8 }}>Marts ({plan.length}) — pipelines sharing each gold mart</div>
      {plan.map((p) => (
        <div key={p.dbt_gold_mart} style={{ background: t.panel, border: `1px solid ${t.border}`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#c8a13a" }}>{p.dbt_gold_mart}</span>
            <span style={{ fontSize: 11, color: t.sub || t.textMuted }}>← {p.api_flow_id}</span>
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: t.navy }}>{p.number_of_pipelines} pipelines</span>
          </div>
          <div style={{ height: 8, background: t.bg, borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(100 * (p.number_of_pipelines || 0) / maxN)}%`,
              background: "linear-gradient(90deg,#0091bf,#c8a13a)", borderRadius: 4 }} />
          </div>
          {p.compression_ratio && <div style={{ fontSize: 11, color: t.sub || t.textMuted, marginTop: 6 }}>{p.compression_ratio} · {p.dag_pattern || ""}</div>}
        </div>))}
    </div>
  );
}

// Interdependency tab wrapper — toggles the shared Interdependency graph
// between Inbound Feeds and Loaders.
function InterdependencyTab({ t }) {
  const [kind, setKind] = React.useState("feed");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["feed", "Inbound Feeds"], ["loader", "Loaders"]].map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} style={{
            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: t.radius.pill,
            cursor: "pointer", fontFamily: t.font,
            border: `1px solid ${kind === k ? t.accent : t.border}`,
            background: kind === k ? t.accent : t.panel,
            color: kind === k ? "#fff" : t.sub }}>{label}</button>
        ))}
      </div>
      <Interdependency t={t} kind={kind} />
    </div>
  );
}
