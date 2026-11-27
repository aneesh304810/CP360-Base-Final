import React, { useMemo, useState } from "react";

// HubWires: "where in the data", drawn the way the Lineage page's source
// canvas draws a feed: one box per table with a row per column, laid out left
// to right by how the data flows, a wire per column link coloured by what
// happens on it, and the mapping of the picked column underneath, hop by
// hop. The failed column is red and its path is lit; everything else dims.
// Input is the pipeline's column graph (nodes with stage, table, column,
// type; edges with kind, label, transform), so every pipeline draws the same.

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const HEAD = 30, ROW = 20, GAPY = 16, PAD = 16, NW = 214, COLGAP = 120;
export const OPS = {
  direct: { label: "DIRECT", c: "#9aa7b2", transformed: false },
  trim: { label: "TRIM / CASE", c: "#00a3a3", transformed: true },
  ren: { label: "CAST / RENAME", c: "#e67e22", transformed: true },
  merge: { label: "JOIN / DERIVE", c: "#c1113a", transformed: true },
  phys: { label: "PUBLISH", c: "#6d3ac0", transformed: false },
  bridged: { label: "BRIDGED", c: "#5f87a7", transformed: false },
};
const STAGE_C = { SRC: "#6d3ac0", STG1: "#00a3a3", STG2: "#0091bf", DWH: "#0f4775" };

/** Tables by depth: a table sits one column right of the furthest table that feeds it. */
export function wireLayout(graph) {
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const tables = [...new Set(graph.nodes.map((n) => `${n.stage}:${n.table}`))];
  const feeds = {}; tables.forEach((t) => { feeds[t] = new Set(); });
  graph.edges.forEach((e) => { const a = byId[e.from], b = byId[e.to]; if (!a || !b) return; const ta = `${a.stage}:${a.table}`, tb = `${b.stage}:${b.table}`; if (ta !== tb) feeds[tb].add(ta); });
  const depth = {}; const seen = new Set();
  const dep = (t) => { if (depth[t] !== undefined) return depth[t]; if (seen.has(t)) return 0; seen.add(t); const d = [...feeds[t]].reduce((m, f) => Math.max(m, dep(f) + 1), 0); depth[t] = d; return d; };
  tables.forEach(dep);
  tables.forEach((t) => {
    if (feeds[t].size || t.startsWith("SRC:")) return;
    const consumers = tables.filter((o) => feeds[o].has(t)).map((o) => depth[o]);
    if (consumers.length) depth[t] = Math.max(0, Math.min(...consumers) - 1);
  });
  const levels = []; tables.forEach((t) => { (levels[depth[t]] = levels[depth[t]] || []).push(t); });
  const boxes = {}; let H = 0;
  const colHeights = levels.map((lv) => lv.reduce((a, t) => a + HEAD + graph.nodes.filter((n) => `${n.stage}:${n.table}` === t).length * ROW, 0) + Math.max(0, lv.length - 1) * GAPY);
  H = Math.max(...colHeights, 80) + PAD * 2;
  levels.forEach((lv, li) => {
    let y = PAD + (H - PAD * 2 - colHeights[li]) / 2;
    lv.forEach((t) => {
      const rows = graph.nodes.filter((n) => `${n.stage}:${n.table}` === t);
      boxes[t] = { x: PAD + li * (NW + COLGAP), y, w: NW, h: HEAD + rows.length * ROW, rows, stage: t.split(":")[0], table: t.split(":").slice(1).join(":") };
      y += HEAD + rows.length * ROW + GAPY;
    });
  });
  const pos = {}, level = {};
  Object.values(boxes).forEach((b) => b.rows.forEach((n, i) => { pos[n.id] = { x: b.x, y: b.y + HEAD + i * ROW + ROW / 2, w: b.w }; level[n.id] = depth[`${b.stage}:${b.table}`]; }));
  return { boxes: Object.values(boxes), pos, level, levels: levels.length, W: PAD * 2 + levels.length * NW + (levels.length - 1) * COLGAP, H };
}

/** Everything upstream and downstream of a column, and the edges along the way. */
export function tracePath(graph, id) {
  if (!id) return null;
  const up = new Set([id]), down = new Set([id]);
  let grew = true;
  while (grew) { grew = false; graph.edges.forEach((e) => { if (up.has(e.to) && !up.has(e.from)) { up.add(e.from); grew = true; } if (down.has(e.from) && !down.has(e.to)) { down.add(e.to); grew = true; } }); }
  const ns = new Set([...up, ...down]);
  const es = graph.edges.filter((e) => (up.has(e.from) && up.has(e.to)) || (down.has(e.from) && down.has(e.to)));
  return { ns, es, up, down };
}

/** The hops from the source to the target through the picked column, in order. */
export function hopsFor(graph, id) {
  const tr = tracePath(graph, id); if (!tr) return [];
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const L = wireLayout(graph);
  const order = (e) => (L.level[e.to] || 0) * 100 + (L.level[e.from] || 0) * 10 + (byId[e.from].table === byId[e.to].table ? 1 : 0);
  return tr.es.slice().sort((x, y) => order(x) - order(y)).map((e) => ({ from: byId[e.from], to: byId[e.to], op: OPS[e.kind] || OPS.direct, kind: e.kind, label: e.label || "", transform: e.transform || "", onPath: true, through: e.to === id || e.from === id }));
}

export function wiresCsv(graph) {
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["from_table", "from_column", "to_table", "to_column", "operation", "label", "rule"];
  return [head.join(",")].concat(graph.edges.map((e) => { const a = byId[e.from] || {}, b = byId[e.to] || {}; return [a.table, a.column, b.table, b.column, (OPS[e.kind] || OPS.direct).label, e.label, e.transform].map(esc).join(","); })).join("\n");
}

export default function HubWires({ t, graph, failed, title }) {
  const border = t.border || "#d9dee3", sub = t.sub || "#4a5560", text = t.text || "#1a1a1a", panel = t.panel || "#fff", bg = t.bg || "#f4f6f8", muted = t.textMuted || "#7a8690";
  const [pick, setPick] = useState(failed || graph.focus || null);
  const [onlyX, setOnlyX] = useState(false);
  const focus = pick || failed || graph.focus;
  const L = useMemo(() => wireLayout(graph), [graph]);
  const tr = useMemo(() => tracePath(graph, focus), [graph, focus]);
  const hops = useMemo(() => hopsFor(graph, focus), [graph, focus]);
  const byId = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph]);
  const failedNode = failed ? byId[failed] : null;
  const total = graph.edges.length, transformed = graph.edges.filter((e) => (OPS[e.kind] || OPS.direct).transformed).length;
  const exportCsv = () => { try { const blob = new Blob([wiresCsv(graph)], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "where_in_the_data.csv"; a.click(); } catch { /* no DOM download */ } };
  const ghost = { font: "inherit", fontSize: 10.5, padding: "3px 9px", cursor: "pointer", border: `1px solid ${border}`, borderRadius: 3, background: panel, color: t.accent || "#0f4775" };
  const eyebrow = { fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: muted };
  const wirePath = (a, b) => {
    if (a.x === b.x) { const x = a.x + a.w - 4; return `M${x},${a.y} C${x + 26},${a.y} ${x + 26},${b.y} ${x},${b.y}`; }   // same table: an arc on its right
    const x1 = a.x + a.w, x2 = b.x, mx = (x1 + x2) / 2; return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
  };
  const onPath = (id) => !tr || tr.ns.has(id);
  const label = (n) => `${n.table}.${n.column}`;

  return (
    <div data-wires={focus || ""} style={{ border: `1px solid ${border}`, borderRadius: 8, background: panel, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderBottom: `1px solid ${border}` }}>
        <span style={eyebrow}>{title || "Where it lands"}</span>
        <span style={{ fontSize: 10.5, color: sub }}>{L.boxes.length} tables · {total} column links · <b style={{ color: transformed ? "#e67e22" : "#159943" }}>{transformed} transformed</b></span>
        {failedNode && <span data-failed={failed} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#c1113a", borderRadius: 3, padding: "1px 8px", fontFamily: MONO }}>✖ {label(failedNode)} failed here</span>}
        {focus && !failedNode && <span style={{ fontSize: 10.5, color: sub }}>tracing <span style={{ fontFamily: MONO }}>{byId[focus] ? label(byId[focus]) : focus}</span></span>}
        <button type="button" onClick={() => setOnlyX((v) => !v)} aria-pressed={onlyX} style={{ ...ghost, ...(onlyX ? { background: "#e67e22", borderColor: "#e67e22", color: "#fff" } : {}) }}>only transformed</button>
        <button type="button" onClick={exportCsv} style={ghost}>⤓ export CSV</button>
        <span style={{ marginLeft: "auto", fontSize: 10, color: muted }}>click a column to trace it · wire colour is the operation</span>
      </div>

      <div style={{ background: bg, padding: 8, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${L.W} ${L.H}`} width="100%" style={{ display: "block", maxHeight: 520, minWidth: 700 }} role="img" aria-label="column wires from source to target">
          {graph.edges.map((e, i) => {
            const a = L.pos[e.from], b = L.pos[e.to]; if (!a || !b) return null;
            const op = OPS[e.kind] || OPS.direct;
            const lit = !tr || tr.es.includes(e);
            const dim = onlyX && !op.transformed;
            const red = failed && lit && tr && (tr.up.has(e.to) && tr.up.has(e.from));
            const c = red ? "#c1113a" : op.c;
            const same = a.x === b.x, mx = same ? a.x + a.w + 16 : (a.x + a.w + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={i} opacity={dim ? 0.06 : lit ? 0.9 : 0.14}>
                <path d={wirePath(a, b)} fill="none" stroke={c} strokeWidth={lit ? (red ? 2.4 : 1.8) : 1.2} strokeDasharray={e.kind === "phys" ? "5 4" : undefined} />
                {op.transformed && <circle cx={mx} cy={my} r={lit ? 4 : 3} fill={c} stroke="#fff" strokeWidth="1.2" />}
                {lit && tr && e.label && <text x={mx} y={my - 7} fontSize="8.5" textAnchor="middle" fill={c} style={{ fontFamily: MONO, fontWeight: 600 }}>{e.label}</text>}
                <title>{`${byId[e.from]?.column} → ${byId[e.to]?.column} · ${op.label}${e.transform ? `\n${e.transform}` : ""}`}</title>
              </g>);
          })}
          {L.boxes.map((b) => (
            <g key={`${b.stage}:${b.table}`} opacity={b.rows.some((n) => onPath(n.id)) ? 1 : 0.55}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="5" fill={panel} stroke={border} />
              <rect x={b.x} y={b.y} width={b.w} height="3" rx="1.5" fill={STAGE_C[b.stage]} />
              <text x={b.x + 9} y={b.y + 20} fontSize="10.5" fill={sub} style={{ fontFamily: MONO }}>{b.table.length > 26 ? b.table.slice(0, 25) + "…" : b.table}<title>{b.table}</title></text>
              {b.rows.map((n, i) => {
                const y = b.y + HEAD + i * ROW, isF = n.id === failed, isP = n.id === focus, on = onPath(n.id);
                return (
                  <g key={n.id} onClick={() => setPick(n.id === pick ? null : n.id)} style={{ cursor: "pointer" }} data-col={n.id}>
                    <rect x={b.x + 1} y={y} width={b.w - 2} height={ROW} fill={isF ? "#fae0e2" : isP ? "#cae3ee" : on && tr ? `${STAGE_C[b.stage]}12` : "transparent"} stroke={isF ? "#c1113a" : "transparent"} strokeWidth={isF ? 1.4 : 0} />
                    <line x1={b.x + 1} x2={b.x + b.w - 1} y1={y} y2={y} stroke={border} />
                    <text x={b.x + 10} y={y + 14} fontSize="10.5" fill={isF ? "#c1113a" : on ? text : muted} style={{ fontFamily: MONO, fontWeight: isF || isP ? 700 : 400 }}>{isF ? "✖ " : ""}{n.column.length > 19 ? n.column.slice(0, 18) + "…" : n.column}<title>{`${n.table}.${n.column}${n.type ? ` · ${n.type}${n.length ? `(${n.length})` : ""}` : ""}`}</title></text>
                    {n.type && <text x={b.x + b.w - 8} y={y + 14} fontSize="8.5" textAnchor="end" fill={muted} style={{ fontFamily: MONO }}>{n.type}{n.length ? `(${n.length})` : ""}</text>}
                  </g>);
              })}
            </g>))}
        </svg>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10, color: muted, padding: "6px 4px 0" }}>
          {Object.entries(OPS).filter(([k]) => k !== "bridged").map(([k, v]) => <span key={k}><span style={{ display: "inline-block", width: 18, height: 3, background: v.c, verticalAlign: "middle", marginRight: 5, borderRadius: 2 }} />{v.label}</span>)}
          <span style={{ marginLeft: "auto" }}>a dot on a wire is an operation between source and target</span>
        </div>
      </div>

      {/* the mapping of the picked column, hop by hop */}
      <div data-hops={hops.length} style={{ borderTop: `1px solid ${border}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
          <span style={eyebrow}>{failedNode && focus === failed ? "The failed column, source to target" : "The picked column, source to target"}</span>
          <span style={{ fontSize: 10.5, color: sub }}>{hops.length} hop{hops.length === 1 ? "" : "s"} · {hops.filter((h) => h.op.transformed).length} with an operation</span>
        </div>
        {hops.length === 0 && <div style={{ fontSize: 11.5, color: muted }}>Click a column to see its path.</div>}
        {hops.map((h, i) => {
          const bad = failed && (h.to.id === failed || h.from.id === failed);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: 10, alignItems: "center", padding: "5px 8px", borderRadius: 4, background: bad ? "#fae0e2" : "transparent", borderTop: i ? `1px solid ${bg}` : "none" }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: text }}>{h.from.table}.<b>{h.from.column}</b></span>
              <span style={{ textAlign: "center" }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: h.op.c, borderRadius: 3, padding: "1px 7px" }}>{h.op.label}</span>
                <div style={{ fontSize: 9.5, color: sub, fontFamily: MONO, marginTop: 2 }}>{h.label || (h.op.transformed ? "" : "0 operations")}</div>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: bad ? "#c1113a" : text }}>→ {h.to.table}.<b>{h.to.column}</b>{bad && h.to.id === failed ? "  ✖ failed here" : ""}
                {h.transform && <div style={{ fontFamily: "inherit", fontSize: 10.5, color: sub, fontWeight: 400 }}>{h.transform}</div>}</span>
            </div>);
        })}
      </div>
    </div>);
}
