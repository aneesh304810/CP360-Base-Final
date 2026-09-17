import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "./api.js";

// =====================================================================
// LineageGraph — column-level lineage for the Technical view.
//
// The pipeline is fixed-depth (SRC -> STG1 -> STG2 -> DWH), so the x of
// every node is decided by its stage and never has to be solved. That is
// the one thing a general-purpose DAG canvas cannot assume, and it buys:
// no crossing hairball, no layout jitter, stable positions between
// visits, no minimap. Only y is laid out.
//
// What it shows that the linear chain cannot:
//   FAN-IN     two sources merging into one DWH column (a merge rule)
//   FAN-OUT    one code landing in several DWH columns
//   PARALLEL   the same AddVantage code running as independent chains
//              through different masters (BI/2-1 is Account Long Name AND
//              Interested Party Full Name AND Security Name)
//
// Edges carry the transform. Style encodes risk, so a developer scanning
// for "what could corrupt this value" reads it without the legend:
//   dashed violet  PHYSICALISED  name only  - value is safe
//   solid  amber   RENAMED/TRIMMED          - value can change
//   solid  red     MERGE                    - two sources converge
//
// Geometry is computed, not measured, so it renders right on first paint
// (no useLayoutEffect / innerHTML pass, unlike the swimlane board).
//
// Props:
//   t           bbhTheme
//   table       DWH table of the focused column
//   column      DWH column
//   code        alternatively address by field code (BI/2-1)
//   dataSource  PBDW / IMDS — scopes every fetch
//   onOpenColumn(table, column)  jump the outer page to another column
// =====================================================================

const STAGE_C = { SRC: "#7c3aed", STG1: "#00a3a3", STG2: "#0091bf", DWH: "#0f4775" };
const STAGE_LABEL = { SRC: "Source", STG1: "Landing", STG2: "Conformed", DWH: "Warehouse" };
const STAGES = ["SRC", "STG1", "STG2", "DWH"];

const EDGE_KIND = {
  phys:   { c: "#6d3ac0", dash: "4 3", legend: "Physicalised — name only" },
  ren:    { c: "#a8560f", dash: "",    legend: "Renamed / trimmed — value can change" },
  trim:   { c: "#00a3a3", dash: "",    legend: "Trimmed — padding removed" },
  merge:  { c: "#c1113a", dash: "",    legend: "Fan-in — sources converge" },
  direct: { c: "#9aa7b2", dash: "",    legend: "Direct" },
};

// geometry — all fixed, nothing measured
const LANE_W = 214, LANE_GAP = 76, HDR_H = 22, ROW_H = 21, BOX_PAD = 5,
      BOX_GAP = 13, TOP = 34, BOT = 10;

export default function LineageGraph({ t, table, column, code, dataSource = "PBDW",
                                       onOpenColumn }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [focus, setFocus] = useState(null);
  const [parallel, setParallel] = useState(true);

  const ds = (dataSource || "PBDW").toUpperCase();

  useEffect(() => {
    let dead = false;
    setData(null); setErr(null);
    api.legacyLineageGraph({ table, column, code, data_source: ds,
                             include_parallel: parallel })
      .then((d) => { if (dead) return; setData(d); setFocus(d && d.focus); })
      .catch((e) => { if (!dead) setErr(String(e && e.message ? e.message : e)); });
    return () => { dead = true; };
  }, [table, column, code, ds, parallel]);

  const nodes = (data && data.nodes) || [];
  const edges = (data && data.edges) || [];

  // ---- layout: group nodes into table boxes per lane, stack vertically ----
  const layout = useMemo(() => {
    const lanes = STAGES.map(() => []);
    nodes.forEach((n) => {
      const li = STAGES.indexOf(n.stage);
      if (li < 0) return;
      let box = lanes[li].find((b) => b.table === n.table);
      if (!box) { box = { table: n.table, rows: [] }; lanes[li].push(box); }
      box.rows.push(n);
    });
    const pos = {}, boxes = [];
    let height = TOP;
    lanes.forEach((lane, li) => {
      let y = TOP;
      lane.forEach((box) => {
        const h = HDR_H + box.rows.length * ROW_H + BOX_PAD * 2;
        boxes.push({ x: li * (LANE_W + LANE_GAP), y, w: LANE_W, h,
                     table: box.table, lane: li });
        box.rows.forEach((n, i) => {
          pos[n.id] = { x: li * (LANE_W + LANE_GAP),
                        y: y + HDR_H + BOX_PAD + i * ROW_H + ROW_H / 2, n };
        });
        y += h + BOX_GAP;
      });
      height = Math.max(height, y);
    });
    return { pos, boxes,
             W: STAGES.length * LANE_W + (STAGES.length - 1) * LANE_GAP,
             H: Math.max(height + BOT, 120) };
  }, [nodes]);

  // ---- trace: everything upstream and downstream of the focused column ----
  const trace = useMemo(() => {
    if (!focus) return null;
    const up = new Set([focus]), down = new Set([focus]);
    let grew = true;
    while (grew) {
      grew = false;
      edges.forEach((e) => {
        if (up.has(e.to) && !up.has(e.from)) { up.add(e.from); grew = true; }
        if (down.has(e.from) && !down.has(e.to)) { down.add(e.to); grew = true; }
      });
    }
    const ns = new Set([...up, ...down]);
    // keep only edges that lie along the path, not every edge between members
    const es = new Set(edges
      .filter((e) => (up.has(e.from) && up.has(e.to)) ||
                     (down.has(e.from) && down.has(e.to)))
      .map((e) => `${e.from}>${e.to}`));
    return { ns, es };
  }, [focus, edges]);

  const nodeOn = useCallback((id) => !trace || trace.ns.has(id), [trace]);
  const edgeOn = useCallback((e) => !trace || trace.es.has(`${e.from}>${e.to}`), [trace]);

  const fan = useMemo(() => {
    const i = {}, o = {};
    edges.forEach((e) => { i[e.to] = (i[e.to] || 0) + 1; o[e.from] = (o[e.from] || 0) + 1; });
    return { i, o };
  }, [edges]);

  // ---------------------------------------------------------------- chrome
  const panel = t.panel || "#fff";
  const line = t.panel2 || "#dfe6e9";
  const sub = t.sub || "#666";
  const muted = t.textMuted || "#999";
  const navy = t.navy || "#10193b";
  const mono = "Roboto Mono, monospace";

  const shell = {
    background: panel, border: `1px solid ${line}`,
    borderRadius: 8, overflow: "hidden", marginBottom: 16,
  };
  const barCss = {
    padding: "10px 14px", borderBottom: `1px solid ${line}`, display: "flex",
    gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12,
  };

  if (err) {
    return (
      <div style={shell}>
        <div style={{ ...barCss, borderBottom: "none", color: t.danger || "#c1113a" }}>
          Column graph unavailable — {err}
        </div>
      </div>);
  }
  if (!data) {
    return (
      <div style={shell}>
        <div style={{ ...barCss, borderBottom: "none", color: muted }}>
          Building column graph…
        </div>
      </div>);
  }
  if (!nodes.length) {
    return (
      <div style={shell}>
        <div style={{ ...barCss, borderBottom: "none", color: muted }}>
          No lineage rows for this column in {ds}.
        </div>
      </div>);
  }

  const st = data.stats || {};
  const focusNode = nodes.find((n) => n.id === focus);

  return (
    <div style={shell}>
      {/* ---------------- toolbar ---------------- */}
      <div style={barCss}>
        <b style={{ color: navy }}>Column lineage</b>
        {data.code && (
          <span style={{ fontFamily: mono, fontSize: 11, padding: "2px 8px",
                         borderRadius: 3, background: t.infoBg || "#e0f5fd",
                         color: t.info || "#0091bf" }}>{data.code}</span>)}
        <span style={{ color: muted }}>
          {st.chains} chain{st.chains === 1 ? "" : "s"}
          {st.masters > 1 ? ` · ${st.masters} masters` : ""}
          {st.fan_in ? ` · ${st.fan_in} fan-in` : ""}
          {st.targets > 1 ? ` · ${st.targets} targets` : ""}
        </span>
        {focusNode ? (
          <span style={{ color: sub }}>
            tracing <span style={{ fontFamily: mono }}>{focusNode.column}</span>
            <button onClick={() => setFocus(null)}
              style={{ marginLeft: 8, border: "none", background: "none", cursor: "pointer",
                       color: t.accent || "#0f4775", fontFamily: "inherit", fontSize: 11.5 }}>
              clear
            </button>
          </span>
        ) : (
          <span style={{ color: muted }}>click a column to trace it</span>
        )}
        <label style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center",
                        cursor: "pointer", color: sub, fontSize: 11.5 }}>
          <input type="checkbox" checked={parallel}
                 onChange={(e) => setParallel(e.target.checked)} />
          same code in other masters
        </label>
      </div>

      {/* ---------------- graph ---------------- */}
      <div style={{ overflowX: "auto", padding: 14 }}>
        <svg viewBox={`-4 0 ${layout.W + 34} ${layout.H}`}
             preserveAspectRatio="xMidYMin meet"
             style={{ display: "block", minWidth: 940, width: "100%", height: "auto" }}
             role="img"
             aria-label="Column-level lineage from source through landing and conformed to warehouse">
          {/* lane headings */}
          {STAGES.map((s, i) => (
            <text key={s} x={i * (LANE_W + LANE_GAP)} y={16} fill={STAGE_C[s]}
                  style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em" }}>
              {STAGE_LABEL[s].toUpperCase()}{s === "DWH" ? ` · ${ds}` : ""}
            </text>
          ))}

          {/* edges first, so node boxes sit above them */}
          {edges.map((e) => {
            const a = layout.pos[e.from], b = layout.pos[e.to];
            if (!a || !b) return null;
            const k = EDGE_KIND[e.kind] || EDGE_KIND.direct;
            const on = edgeOn(e);
            const x1 = a.x + LANE_W, y1 = a.y, x2 = b.x, y2 = b.y, mx = (x1 + x2) / 2;
            return (
              <g key={`${e.from}>${e.to}`}>
                <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                      fill="none" stroke={k.c}
                      strokeWidth={on && trace ? 2.2 : 1.4}
                      strokeDasharray={k.dash || undefined}
                      opacity={on ? (trace ? 0.95 : 0.55) : 0.07} />
                {/* label only on the traced path — otherwise they collide */}
                {on && trace && e.label && (
                  <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle" fill={k.c}
                        style={{ fontFamily: mono, fontSize: 9, fontWeight: 500 }}>
                    {e.label}
                  </text>)}
              </g>);
          })}

          {/* table containers */}
          {layout.boxes.map((b) => {
            const any = nodes.some((n) => n.table === b.table &&
                                          STAGES.indexOf(n.stage) === b.lane && nodeOn(n.id));
            return (
              <g key={`${b.lane}:${b.table}`} opacity={any ? 1 : 0.25}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6}
                      fill={panel} stroke={line} />
                <rect x={b.x} y={b.y} width={b.w} height={3} rx={1.5}
                      fill={STAGE_C[STAGES[b.lane]]} opacity={0.9} />
                <text x={b.x + 9} y={b.y + 17} fill={sub}
                      style={{ fontFamily: mono, fontSize: 10.5 }}>
                  {b.table.length > 26 ? b.table.slice(0, 25) + "…" : b.table}
                  <title>{b.table}</title>
                </text>
              </g>);
          })}

          {/* column rows */}
          {nodes.map((n) => {
            const p = layout.pos[n.id];
            if (!p) return null;
            const on = nodeOn(n.id), isFocus = n.id === focus;
            const fi = fan.i[n.id] || 0, fo = fan.o[n.id] || 0;
            const badge = fi > 1 ? ["#c1113a", `${fi} in`]
                        : fo > 1 ? ["#0091bf", `${fo} out`] : null;
            const unmapped = n.status && n.status !== "mapped";
            return (
              <g key={n.id} opacity={on ? 1 : 0.18} style={{ cursor: "pointer" }}
                 onClick={() => setFocus(isFocus ? null : n.id)}
                 onDoubleClick={() => {
                   if (n.stage === "DWH" && onOpenColumn) onOpenColumn(n.table, n.column);
                 }}>
                <rect x={p.x + 4} y={p.y - 10} width={LANE_W - 8} height={20} rx={4}
                      fill={isFocus ? (t.tint || "#cae3ee") : "transparent"}
                      stroke={isFocus ? STAGE_C[n.stage] : "none"} strokeWidth={1.5} />
                <text x={p.x + 10} y={p.y + 3.5}
                      fill={unmapped ? (t.danger || "#c1113a") : (t.text || "#333")}
                      style={{ fontFamily: mono, fontSize: 11,
                               fontWeight: isFocus ? 700 : 400 }}>
                  {n.column.length > 22 ? n.column.slice(0, 21) + "…" : n.column}
                  <title>{`${n.table}.${n.column}`}
                    {n.master ? ` · ${n.master}` : ""}
                    {n.type ? ` · ${n.type}${n.length ? `(${n.length})` : ""}` : ""}
                  </title>
                </text>
                {n.type && (
                  <text x={p.x + LANE_W - 10} y={p.y + 3.5} textAnchor="end" fill={muted}
                        style={{ fontFamily: mono, fontSize: 9 }}>
                    {n.type}{n.length ? `(${n.length})` : ""}
                  </text>)}
                {badge && (
                  <>
                    <rect x={p.x + LANE_W - 8} y={p.y - 16} width={34} height={13} rx={6.5}
                          fill={badge[0]} />
                    <text x={p.x + LANE_W + 9} y={p.y - 6} textAnchor="middle" fill="#fff"
                          style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700 }}>
                      {badge[1]}
                    </text>
                  </>)}
              </g>);
          })}
        </svg>
      </div>

      {/* ---------------- legend + note ---------------- */}
      <div style={{ padding: "9px 14px", borderTop: `1px solid ${line}`, display: "flex",
                    gap: 16, flexWrap: "wrap", fontSize: 10.5, color: muted }}>
        {Object.entries(EDGE_KIND).filter(([k]) => k !== "direct").map(([k, v]) => (
          <span key={k} style={{ color: v.c }}>
            <svg width="20" height="8" style={{ verticalAlign: "middle", marginRight: 4 }}>
              <line x1="0" y1="4" x2="20" y2="4" stroke={v.c} strokeWidth="2"
                    strokeDasharray={v.dash || undefined} />
            </svg>
            {v.legend}
          </span>))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${line}`,
                    fontSize: 12, color: sub, lineHeight: 1.55 }}>
        {data.truncated && (
          <div style={{ color: t.warning || "#e67e22", marginBottom: 6 }}>
            Showing the first {data.max_chains} chains — this code is used more widely.
            Untick “same code in other masters” to narrow it.
          </div>)}
        {focusNode
          ? <>Everything off the path is dimmed. Follow{" "}
              <span style={{ fontFamily: mono }}>{focusNode.column}</span>{" "}
              left for provenance, right for impact.
              {focusNode.stage === "DWH" && onOpenColumn
                ? " Double-click a warehouse column to open it."
                : ""}</>
          : (st.masters > 1
              ? <>The same code runs as {st.masters} independent chains — one per master.
                  Field identity in AddVantage is (master + code), so these are different
                  fields that happen to share a code.</>
              : <>Click any column to trace it end to end.</>)}
      </div>
    </div>);
}
