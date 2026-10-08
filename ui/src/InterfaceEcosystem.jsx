// Interface 360 · Ecosystem: the interface estate as one picture.
//
// WHAT IT SHOWS. Every system is a node, every (source, target) pair is one
// edge carrying all the interfaces between them. Systems sit in three
// columns by the role the data gives them: producers (only ever a source),
// brokers (both source and target: warehouses, hubs, platforms) and
// consumers (only ever a target). Colour is the system's project (SEI,
// AddVantage, Pivotal...), the same colour the badges use. Edge width is
// the interface count, dashed means every interface on it is marked
// Replace, red means at least one carries PII.
//
// The picture is built from the rows the filter bar has already narrowed,
// so a filter on feed type or project redraws the map rather than a table.
// Hover or click a system to isolate its edges; click an edge to list its
// interfaces and open one in the drawer.

import React, { useMemo, useState } from "react";
import { projColor, projLabel } from "./bbhTheme.js";

const NODE_W = 170, NODE_H = 34;
const ROLE = ["producer", "broker", "consumer"];

/* rows -> {nodes, edges, roles, width, height, cx, cy, r}. Pure, tested.
   Systems sit on a ring, grouped by project and then busiest first, so a
   project reads as one arc. Edges are chords pulled toward the centre. A
   ring, unlike columns by role, survives an estate where every system is
   both a source and a target, which is what a hub-and-warehouse estate
   looks like. */
export function buildEcosystem(rows) {
  const sys = new Map();
  const node = (name, proj) => {
    if (!sys.has(name)) sys.set(name, { id: name, proj: proj || "other", out: 0, in: 0, n: 0, pii: 0, mig: 0, projs: {} });
    const s = sys.get(name);
    if (proj) s.projs[proj] = (s.projs[proj] || 0) + 1;
    return s;
  };
  const edges = new Map();
  (rows || []).forEach((r) => {
    const a = (r.source_system || "Unknown").trim(), b = (r.target_system || "Unknown").trim();
    const sa = node(a, r.source_project_id), sb = node(b, r.target_project_id);
    sa.out += 1; sb.in += 1; sa.n += 1; sb.n += 1;
    if (r.carries_pii === "Y") { sa.pii += 1; sb.pii += 1; }
    if (r.migration_flag === "Y") { sa.mig += 1; sb.mig += 1; }
    const k = `${a}|${b}`;
    const e = edges.get(k) || { key: k, from: a, to: b, n: 0, pii: 0, mig: 0, types: {}, rows: [] };
    e.n += 1; if (r.carries_pii === "Y") e.pii += 1; if (r.migration_flag === "Y") e.mig += 1;
    e.types[r.feed_type || "?"] = (e.types[r.feed_type || "?"] || 0) + 1;
    e.rows.push(r);
    edges.set(k, e);
  });
  sys.forEach((s) => {
    const best = Object.entries(s.projs).sort((x, y) => y[1] - x[1])[0];
    if (best) s.proj = best[0];
    s.role = s.in && s.out ? 1 : s.out ? 0 : 2;
  });
  const nodes = [...sys.values()].sort((x, y) => x.proj.localeCompare(y.proj) || (y.n - x.n) || x.id.localeCompare(y.id));
  const N = nodes.length;
  const r = Math.max(200, N * 19);
  const cx = r + NODE_W + 40, cy = r + NODE_H + 50;
  nodes.forEach((s, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(N, 1);
    s.a = a; s.x = cx + r * Math.cos(a); s.y = cy + r * Math.sin(a);
    s.right = Math.cos(a) >= -0.05;          // card extends away from the ring
    s.cardX = s.right ? s.x + 10 : s.x - NODE_W - 10;
    s.cardY = s.y - NODE_H / 2;
  });
  const roles = [0, 0, 0];
  nodes.forEach((s) => { roles[s.role] += 1; });
  return { nodes, edges: [...edges.values()].sort((x, y) => y.n - x.n), roles,
           width: 2 * (r + NODE_W + 40), height: 2 * (r + NODE_H + 50) + 24, cx, cy, r };
}

/* a chord pulled toward the centre, so busy pairs do not overlap the ring */
const chord = (a, b, cx, cy) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const qx = cx + (mx - cx) * 0.25, qy = cy + (my - cy) * 0.25;
  return `M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}`;
};

export default function EcosystemView({ t, rows, onSelect }) {
  const eco = useMemo(() => buildEcosystem(rows), [rows]);
  const [focus, setFocus] = useState(null);      // system id
  const [edge, setEdge] = useState(null);        // edge key
  const byId = useMemo(() => Object.fromEntries(eco.nodes.map((n) => [n.id, n])), [eco]);
  const sel = edge ? eco.edges.find((e) => e.key === edge) : null;
  const touches = (e) => !focus || e.from === focus || e.to === focus;
  const projects = useMemo(() => {
    const m = {};
    eco.nodes.forEach((n) => { m[n.proj] = (m[n.proj] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [eco]);
  if (!eco.nodes.length) {
    return <div style={{ padding: 24, color: t.textMuted, fontSize: 13 }}>No interfaces match the current filters.</div>;
  }
  const neighbours = focus ? eco.edges.filter(touches).map((e) => ({
    other: e.from === focus ? e.to : e.from, dir: e.from === focus ? "→" : "←", e })) : [];
  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: t.sub, marginBottom: 10 }}>
        <span><b style={{ color: t.navy }}>{eco.nodes.length}</b> systems · <b style={{ color: t.navy }}>{eco.edges.length}</b> connections · <b style={{ color: t.navy }}>{(rows || []).length}</b> interfaces</span>
        {projects.map(([p, n]) => (
          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: projColor(t, p) }} />{projLabel(p)} {n}</span>))}
        <span style={{ marginLeft: "auto", color: t.textMuted }}>width = interfaces · dashed = all Replace · red = carries PII</span>
        {focus && <span onClick={() => { setFocus(null); setEdge(null); }} role="button" tabIndex={0}
          style={{ cursor: "pointer", color: t.accent, fontWeight: 700 }}>clear focus ✕</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: sel || focus ? "1fr 320px" : "1fr", gap: 14 }}>
        <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "auto" }}>
          <svg viewBox={`0 0 ${eco.width} ${eco.height}`} width="100%"
            style={{ maxWidth: eco.width, display: "block", margin: "0 auto" }} fontFamily={t.font}>
            <defs>
              <marker id="eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker>
            </defs>
            <circle cx={eco.cx} cy={eco.cy} r={eco.r} fill="none" stroke={t.disabled} strokeDasharray="2,5" />
            <text x={eco.cx} y={eco.height - 14} textAnchor="middle" fontSize="11" fontWeight="800" fill={t.textMuted} letterSpacing=".4">
              {eco.nodes.length} SYSTEMS · {eco.roles[0]} producers · {eco.roles[1]} brokers · {eco.roles[2]} consumers</text>
            {/* edges under nodes */}
            {eco.edges.map((e) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              const on = touches(e), picked = edge === e.key;
              const w = 1 + Math.log2(e.n + 1) * 1.2;
              const c = e.pii ? "#c1113a" : projColor(t, a.proj);
              return (
                <path key={e.key} d={chord(a, b, eco.cx, eco.cy)} fill="none" stroke={c}
                  strokeWidth={picked ? w + 2 : w} strokeOpacity={on ? (picked ? 1 : 0.55) : 0.06}
                  strokeDasharray={e.mig === e.n ? "6,4" : "none"} markerEnd="url(#eco-arrow)"
                  style={{ cursor: "pointer" }} onClick={() => setEdge(picked ? null : e.key)}>
                  <title>{`${e.from} → ${e.to}: ${e.n} interface${e.n === 1 ? "" : "s"}${e.pii ? ` · ${e.pii} PII` : ""}${e.mig ? ` · ${e.mig} Replace` : ""}`}</title>
                </path>);
            })}
            {eco.nodes.map((n) => {
              const c = projColor(t, n.proj);
              const dim = focus && focus !== n.id && !eco.edges.some((e) => touches(e) && (e.from === n.id || e.to === n.id));
              return (
                <g key={n.id} opacity={dim ? 0.25 : 1} style={{ cursor: "pointer" }}
                  onClick={() => { setFocus(focus === n.id ? null : n.id); setEdge(null); }}>
                  <circle cx={n.x} cy={n.y} r={focus === n.id ? 7 : 5} fill={c} stroke="#fff" strokeWidth={1.5} />
                  <g transform={`translate(${n.cardX},${n.cardY})`}>
                    <rect width={NODE_W} height={NODE_H} rx={7} fill={focus === n.id ? c + "22" : "#fff"}
                      stroke={focus === n.id ? c : t.disabled} strokeWidth={focus === n.id ? 2 : 1} />
                    <rect x={n.right ? 0 : NODE_W - 5} width={5} height={NODE_H} rx={2} fill={c} />
                    <text x={n.right ? 12 : NODE_W - 12} y={14} fontSize="11.5" fontWeight="700" fill={t.navy}
                      textAnchor={n.right ? "start" : "end"}>
                      {n.id.length > 20 ? n.id.slice(0, 19) + "…" : n.id}</text>
                    <text x={n.right ? 12 : NODE_W - 12} y={27} fontSize="9.5" fill={t.textMuted}
                      textAnchor={n.right ? "start" : "end"}>
                      {ROLE[n.role]} · {n.in ? `${n.in} in` : ""}{n.in && n.out ? " · " : ""}{n.out ? `${n.out} out` : ""}
                      {n.mig ? ` · ${n.mig} replace` : ""}</text>
                    {n.pii > 0 && <circle cx={n.right ? NODE_W - 10 : 10} cy={10} r={4.5} fill="#c1113a">
                      <title>{`${n.pii} interfaces carry PII`}</title></circle>}
                  </g>
                </g>);
            })}
          </svg>
        </div>
        {(sel || focus) && (
          <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, padding: 14, fontSize: 12, alignSelf: "start" }}>
            {sel ? (
              <>
                <div style={{ fontWeight: 700, color: t.navy, marginBottom: 2 }}>{sel.from} → {sel.to}</div>
                <div style={{ color: t.textMuted, marginBottom: 10 }}>{sel.n} interface{sel.n === 1 ? "" : "s"}
                  {sel.pii ? ` · ${sel.pii} PII` : ""}{sel.mig ? ` · ${sel.mig} Replace` : ""} ·{" "}
                  {Object.entries(sel.types).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
                {sel.rows.map((r) => (
                  <div key={r.interface_id} onClick={() => onSelect && onSelect(r)} role="button" tabIndex={0}
                    style={{ padding: "7px 0", borderTop: `1px solid ${t.panel2}`, cursor: onSelect ? "pointer" : "default" }}>
                    <div style={{ fontWeight: 600, color: t.navy }}>{r.integration_name || "(unnamed)"}</div>
                    <div style={{ color: t.textMuted, fontSize: 11 }}>{r.feed_type} · {r.frequency || "—"}
                      {r.carries_pii === "Y" ? " · PII" : ""}{r.migration_flag === "Y" ? " · Replace" : ""}</div>
                  </div>))}
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: t.navy, marginBottom: 2 }}>{focus}</div>
                <div style={{ color: t.textMuted, marginBottom: 10 }}>
                  {projLabel(byId[focus]?.proj)} · {byId[focus]?.in || 0} in · {byId[focus]?.out || 0} out · {neighbours.length} connected systems</div>
                {neighbours.map(({ other, dir, e }) => (
                  <div key={e.key} onClick={() => setEdge(e.key)} role="button" tabIndex={0}
                    style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${t.panel2}`, cursor: "pointer" }}>
                    <span><span style={{ color: t.accent, fontWeight: 700 }}>{dir}</span> {other}</span>
                    <span style={{ color: t.textMuted }}>{e.n}{e.pii ? " · PII" : ""}</span>
                  </div>))}
              </>)}
          </div>)}
      </div>
    </div>);
}
