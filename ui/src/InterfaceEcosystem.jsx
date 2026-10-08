// Interface 360 · Ecosystem: the interface estate drawn the way an
// architecture slide draws it, from data.
//
// THE PROBLEM. The real estate is 819 interfaces across 107 system names.
// A ring of 107 is a hairball; so is any layout that draws every system
// and every pair. The slide people recognise has a dozen boxes in two
// zones, warehouses as cylinders at the bottom, and labelled flows between
// them. This view gets there by three reductions, each visible and each
// reversible:
//
//   zones     a system belongs to the zone (interface domain, else project)
//             its interfaces are filed under; zones are panels side by side
//   folding   a zone keeps its busiest systems as boxes and folds the rest
//             into one "+N other systems" node; click it to unfold the zone
//   links     one line per (source, target) pair, and a floor on how many
//             interfaces a line must carry to be drawn; the floor picks
//             itself so that about sixty lines show, and the reader can
//             lower it
//
// Names that differ only in case or spacing ("AUM", "AUm") are one system;
// nothing else is merged, and the merges are counted on screen.
//
// Within a zone, systems whose name says they are a store (warehouse,
// datamart, DW, DB, lake) sit on a bottom row as cylinders; everything
// else is a box in a grid. Width is the interface count, dashed means
// every interface on the line is marked Replace, red means PII rides it.

import React, { useMemo, useState } from "react";
import { projColor, projLabel } from "./bbhTheme.js";

const BOX_W = 150, BOX_H = 40, GAP_X = 26, GAP_Y = 30, ZONE_PAD = 18, ZONE_HEAD = 30, ZONE_GAP = 28;
const STORE_RE = /warehouse|data\s*mart|datamart|\bdwh?\b|\bdm\b|database|\bdb\b|\blake\b|\bmart\b|\bods\b/i;
const FOLD = (zone) => `__fold__${zone}`;

export const canonName = (s) => String(s || "Unknown").trim().replace(/\s+/g, " ").toLowerCase();
export const isStore = (name) => STORE_RE.test(name || "");

/* rows -> systems and pair links, names merged by case and spacing only. */
export function aggregate(rows) {
  const sys = new Map(), spell = new Map();
  const node = (raw, proj, domain) => {
    const k = canonName(raw);
    if (!sys.has(k)) sys.set(k, { key: k, id: raw.trim(), proj: proj || "other", projs: {}, domains: {}, in: 0, out: 0, n: 0, pii: 0, mig: 0 });
    const s = sys.get(k);
    const sp = spell.get(k) || {}; sp[raw.trim()] = (sp[raw.trim()] || 0) + 1; spell.set(k, sp);
    if (proj) s.projs[proj] = (s.projs[proj] || 0) + 1;
    if (domain) s.domains[domain] = (s.domains[domain] || 0) + 1;
    return s;
  };
  const links = new Map();
  (rows || []).forEach((r) => {
    const a = node(r.source_system || "Unknown", r.source_project_id, r.domain);
    const b = node(r.target_system || "Unknown", r.target_project_id, r.domain);
    a.out += 1; b.in += 1; a.n += 1; b.n += 1;
    if (r.carries_pii === "Y") { a.pii += 1; b.pii += 1; }
    if (r.migration_flag === "Y") { a.mig += 1; b.mig += 1; }
    const k = `${a.key}|${b.key}`;
    const e = links.get(k) || { key: k, from: a.key, to: b.key, n: 0, pii: 0, mig: 0, types: {}, rows: [] };
    e.n += 1; if (r.carries_pii === "Y") e.pii += 1; if (r.migration_flag === "Y") e.mig += 1;
    e.types[r.feed_type || "?"] = (e.types[r.feed_type || "?"] || 0) + 1;
    e.rows.push(r);
    links.set(k, e);
  });
  let merged = 0;
  sys.forEach((s) => {
    const sp = Object.entries(spell.get(s.key) || {}).sort((x, y) => y[1] - x[1]);
    s.id = sp[0] ? sp[0][0] : s.id;
    if (sp.length > 1) merged += sp.length - 1;
    const bp = Object.entries(s.projs).sort((x, y) => y[1] - x[1])[0];
    if (bp) s.proj = bp[0];
    const bd = Object.entries(s.domains).sort((x, y) => y[1] - x[1])[0];
    s.zone = bd ? bd[0] : projLabel(s.proj);
    s.role = s.in && s.out ? "broker" : s.out ? "producer" : "consumer";
    s.store = isStore(s.id);
  });
  return { systems: [...sys.values()], links: [...links.values()], merged };
}

/* The floor on interfaces per line that leaves about `want` lines. */
export function autoFloor(links, want = 60) {
  const counts = links.map((l) => l.n).sort((a, b) => b - a);
  if (counts.length <= want) return 1;
  return Math.max(1, counts[want - 1]);
}

/* systems + links -> zones with positions, folded where asked. */
export function layout(agg, { perZone = 8, floor = 1, unfolded = new Set(), width = 1400 } = {}) {
  const byZone = new Map();
  agg.systems.forEach((s) => { (byZone.get(s.zone) || byZone.set(s.zone, []).get(s.zone)).push(s); });
  const zones = [...byZone.entries()].map(([name, list]) => {
    list.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    const keepAll = unfolded.has(name) || list.length <= perZone + 1;
    const kept = keepAll ? list : list.slice(0, perZone);
    const folded = keepAll ? [] : list.slice(perZone);
    return { name, kept, folded, total: list.reduce((s, x) => s + x.n, 0) };
  }).sort((a, b) => b.total - a.total);

  // re-point links at fold nodes
  const foldOf = new Map();
  zones.forEach((z) => z.folded.forEach((s) => foldOf.set(s.key, FOLD(z.name))));
  const lines = new Map();
  agg.links.forEach((l) => {
    const f = foldOf.get(l.from) || l.from, t = foldOf.get(l.to) || l.to;
    if (f === t) return;                               // inside one fold: nothing to draw
    const k = `${f}|${t}`;
    const e = lines.get(k) || { key: k, from: f, to: t, n: 0, pii: 0, mig: 0, types: {}, rows: [], pairs: 0 };
    e.n += l.n; e.pii += l.pii; e.mig += l.mig; e.pairs += 1;
    Object.entries(l.types).forEach(([ty, c]) => { e.types[ty] = (e.types[ty] || 0) + c; });
    e.rows.push(...l.rows);
    lines.set(k, e);
  });
  const allLines = [...lines.values()].sort((a, b) => b.n - a.n);
  const shown = allLines.filter((l) => l.n >= floor);

  // geometry: zones flow left to right and wrap
  const nodes = new Map();
  let x = 0, y = 0, rowH = 0;
  zones.forEach((z) => {
    const apps = z.kept.filter((s) => !s.store), stores = z.kept.filter((s) => s.store);
    const items = apps.length + (z.folded.length ? 1 : 0);
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.max(items, stores.length)))));
    const appRows = Math.ceil(items / cols), storeRows = Math.ceil(stores.length / cols);
    const w = ZONE_PAD * 2 + cols * BOX_W + (cols - 1) * GAP_X;
    const h = ZONE_HEAD + ZONE_PAD + (appRows + storeRows) * (BOX_H + GAP_Y) + (storeRows ? 10 : 0) + ZONE_PAD;
    if (x + w > width && x > 0) { x = 0; y += rowH + ZONE_GAP; rowH = 0; }
    z.x = x; z.y = y; z.w = w; z.h = h;
    const place = (list, startRow) => list.forEach((s, i) => {
      const c = i % cols, r = startRow + Math.floor(i / cols);
      s.x = z.x + ZONE_PAD + c * (BOX_W + GAP_X);
      s.y = z.y + ZONE_HEAD + ZONE_PAD + r * (BOX_H + GAP_Y) + (r >= appRows && storeRows ? 10 : 0);
      s.zoneName = z.name;
      nodes.set(s.key, s);
    });
    const appList = [...apps];
    if (z.folded.length) {
      appList.push({ key: FOLD(z.name), id: `+${z.folded.length} other systems`, fold: true, zone: z.name,
        proj: z.folded[0].proj, n: z.folded.reduce((a, s) => a + s.n, 0), in: 0, out: 0,
        pii: z.folded.reduce((a, s) => a + s.pii, 0), mig: 0, folded: z.folded });
    }
    place(appList, 0);
    place(stores, appRows);
    x += w + ZONE_GAP; rowH = Math.max(rowH, h);
  });
  return { zones, nodes, lines: shown, allLines, width: Math.max(width, 320), height: y + rowH + 10,
           shownCount: shown.length, lineCount: allLines.length, hidden: allLines.length - shown.length };
}

const anchor = (a, b) => {
  // leave from the side that faces the other box
  const ax = a.x + BOX_W / 2, ay = a.y + BOX_H / 2, bx = b.x + BOX_W / 2, by = b.y + BOX_H / 2;
  const dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) > Math.abs(dy)) {
    const p1 = { x: dx > 0 ? a.x + BOX_W : a.x, y: ay }, p2 = { x: dx > 0 ? b.x : b.x + BOX_W, y: by };
    const mx = (p1.x + p2.x) / 2;
    return `M ${p1.x} ${p1.y} C ${mx} ${p1.y}, ${mx} ${p2.y}, ${p2.x} ${p2.y}`;
  }
  const p1 = { x: ax, y: dy > 0 ? a.y + BOX_H : a.y }, p2 = { x: bx, y: dy > 0 ? b.y : b.y + BOX_H };
  const my = (p1.y + p2.y) / 2;
  return `M ${p1.x} ${p1.y} C ${p1.x} ${my}, ${p2.x} ${my}, ${p2.x} ${p2.y}`;
};

function Store({ x, y, w, h, fill, stroke, sw }) {
  const ry = 6;
  return (
    <g>
      <path d={`M ${x} ${y + ry} v ${h - 2 * ry} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${-(h - 2 * ry)}`} fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
    </g>);
}

export default function EcosystemView({ t, rows, onSelect }) {
  const agg = useMemo(() => aggregate(rows), [rows]);
  const [perZone, setPerZone] = useState(8);
  const [floorPick, setFloorPick] = useState(null);     // null = automatic
  const [unfolded, setUnfolded] = useState(() => new Set());
  const [focus, setFocus] = useState(null);
  const [edge, setEdge] = useState(null);
  const auto = useMemo(() => autoFloor(agg.links), [agg]);
  const floor = floorPick ?? auto;
  const lay = useMemo(() => layout(agg, { perZone, floor, unfolded }), [agg, perZone, floor, unfolded]);
  const sel = edge ? lay.allLines.find((l) => l.key === edge) : null;
  const touches = (l) => !focus || l.from === focus || l.to === focus;
  const focusNode = focus ? lay.nodes.get(focus) : null;
  const neighbours = focus ? lay.lines.filter(touches).map((l) => ({ other: l.from === focus ? l.to : l.from, dir: l.from === focus ? "→" : "←", l })) : [];
  const nameOf = (k) => lay.nodes.get(k)?.id || k;
  const sw = { fontSize: 11, padding: "3px 8px", border: `1px solid ${t.disabled}`, borderRadius: 4, background: "#fff", fontFamily: t.font };

  if (!agg.systems.length) {
    return <div style={{ padding: 24, color: t.textMuted, fontSize: 13 }}>No interfaces match the current filters.</div>;
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: t.sub, marginBottom: 10 }}>
        <span><b style={{ color: t.navy }}>{agg.systems.length}</b> systems in <b style={{ color: t.navy }}>{lay.zones.length}</b> zones ·{" "}
          <b style={{ color: t.navy }}>{lay.shownCount}</b> of {lay.lineCount} links drawn · <b style={{ color: t.navy }}>{(rows || []).length}</b> interfaces
          {agg.merged > 0 && <span style={{ color: "#b26b00" }}> · {agg.merged} name variants merged (case and spacing only)</span>}</span>
        <label>systems per zone{" "}
          <select value={perZone} onChange={(e) => { setPerZone(Number(e.target.value)); setUnfolded(new Set()); }} style={sw}>
            {[4, 6, 8, 12, 999].map((n) => <option key={n} value={n}>{n === 999 ? "all" : `top ${n}`}</option>)}</select></label>
        <label>draw links with ≥{" "}
          <select value={floor} onChange={(e) => setFloorPick(Number(e.target.value))} style={sw}>
            {[1, 2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>{" "}
          interface{floor === 1 ? "" : "s"}{floorPick == null ? " (auto)" : ""}
          {floorPick != null && <span onClick={() => setFloorPick(null)} role="button" tabIndex={0} style={{ marginLeft: 6, color: t.accent, cursor: "pointer" }}>auto</span>}</label>
        <span style={{ marginLeft: "auto", color: t.textMuted }}>cylinder = data store · width = interfaces · dashed = all Replace · red = carries PII</span>
        {(focus || edge) && <span onClick={() => { setFocus(null); setEdge(null); }} role="button" tabIndex={0}
          style={{ cursor: "pointer", color: t.accent, fontWeight: 700 }}>clear ✕</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: sel || focus ? "1fr 320px" : "1fr", gap: 14 }}>
        <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "auto" }}>
          <svg viewBox={`0 0 ${lay.width} ${lay.height}`} width="100%" style={{ minWidth: 900, display: "block" }} fontFamily={t.font}>
            <defs>
              <marker id="eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker>
            </defs>
            {lay.zones.map((z) => (
              <g key={z.name}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={10} fill="#f3f6f9" stroke="#d6dee6" />
                <text x={z.x + ZONE_PAD} y={z.y + 20} fontSize="12" fontWeight="800" fill={t.navy} letterSpacing=".3">
                  {z.name}</text>
                <text x={z.x + z.w - ZONE_PAD} y={z.y + 20} fontSize="10" fill={t.textMuted} textAnchor="end">
                  {z.kept.length + z.folded.length} systems · {z.total} interface ends</text>
              </g>))}
            {lay.lines.map((l) => {
              const a = lay.nodes.get(l.from), b = lay.nodes.get(l.to);
              if (!a || !b) return null;
              const on = touches(l), picked = edge === l.key;
              const w = 1 + Math.log2(l.n + 1) * 1.1;
              const c = l.pii ? "#c1113a" : projColor(t, a.proj);
              return (
                <path key={l.key} d={anchor(a, b)} fill="none" stroke={c}
                  strokeWidth={picked ? w + 2 : w} strokeOpacity={on ? (picked ? 1 : 0.42) : 0.05}
                  strokeDasharray={l.mig === l.n ? "6,4" : "none"} markerEnd="url(#eco-arrow)"
                  style={{ cursor: "pointer" }} onClick={() => setEdge(picked ? null : l.key)}>
                  <title>{`${nameOf(l.from)} → ${nameOf(l.to)}: ${l.n} interface${l.n === 1 ? "" : "s"}${l.pairs > 1 ? ` across ${l.pairs} pairs` : ""}${l.pii ? ` · ${l.pii} PII` : ""}${l.mig ? ` · ${l.mig} Replace` : ""}`}</title>
                </path>);
            })}
            {[...lay.nodes.values()].map((n) => {
              const c = n.fold ? "#8a97a6" : projColor(t, n.proj);
              const dim = focus && focus !== n.key && !lay.lines.some((l) => touches(l) && (l.from === n.key || l.to === n.key));
              const isF = focus === n.key;
              return (
                <g key={n.key} opacity={dim ? 0.25 : 1} style={{ cursor: "pointer" }}
                  onClick={() => {
                    if (n.fold) { const u = new Set(unfolded); u.add(n.zone); setUnfolded(u); return; }
                    setFocus(isF ? null : n.key); setEdge(null);
                  }}>
                  {n.store
                    ? <Store x={n.x} y={n.y} w={BOX_W} h={BOX_H} fill={isF ? c + "22" : "#fff"} stroke={isF ? c : "#9fb0c0"} sw={isF ? 2 : 1.2} />
                    : <rect x={n.x} y={n.y} width={BOX_W} height={BOX_H} rx={n.fold ? 20 : 6} fill={isF ? c + "22" : n.fold ? "#eef2f5" : "#fff"}
                        stroke={isF ? c : n.fold ? "#c9d4dc" : "#9fb0c0"} strokeWidth={isF ? 2 : 1.2} strokeDasharray={n.fold ? "4,3" : "none"} />}
                  {!n.store && !n.fold && <rect x={n.x} y={n.y} width={5} height={BOX_H} rx={2} fill={c} />}
                  <text x={n.x + BOX_W / 2} y={n.y + (n.store ? 20 : 17)} fontSize="11" fontWeight="700" fill={n.fold ? t.sub : t.navy} textAnchor="middle">
                    {n.id.length > 22 ? n.id.slice(0, 21) + "…" : n.id}</text>
                  <text x={n.x + BOX_W / 2} y={n.y + (n.store ? 32 : 30)} fontSize="9" fill={t.textMuted} textAnchor="middle">
                    {n.fold ? `${n.n} interface ends · click to unfold` : `${n.in ? `${n.in} in` : ""}${n.in && n.out ? " · " : ""}${n.out ? `${n.out} out` : ""}${n.mig ? ` · ${n.mig} replace` : ""}`}</text>
                  {n.pii > 0 && <circle cx={n.x + BOX_W - 9} cy={n.y + 9} r={4} fill="#c1113a"><title>{`${n.pii} interface ends carry PII`}</title></circle>}
                </g>);
            })}
          </svg>
        </div>
        {(sel || focusNode) && (
          <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, padding: 14, fontSize: 12, alignSelf: "start" }}>
            {sel ? (
              <>
                <div style={{ fontWeight: 700, color: t.navy, marginBottom: 2 }}>{nameOf(sel.from)} → {nameOf(sel.to)}</div>
                <div style={{ color: t.textMuted, marginBottom: 10 }}>{sel.n} interface{sel.n === 1 ? "" : "s"}
                  {sel.pairs > 1 ? ` across ${sel.pairs} system pairs` : ""}{sel.pii ? ` · ${sel.pii} PII` : ""}{sel.mig ? ` · ${sel.mig} Replace` : ""} ·{" "}
                  {Object.entries(sel.types).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
                {sel.rows.slice(0, 60).map((r) => (
                  <div key={r.interface_id} onClick={() => onSelect && onSelect(r)} role="button" tabIndex={0}
                    style={{ padding: "7px 0", borderTop: `1px solid ${t.panel2}`, cursor: onSelect ? "pointer" : "default" }}>
                    <div style={{ fontWeight: 600, color: t.navy }}>{r.integration_name || "(unnamed)"}</div>
                    <div style={{ color: t.textMuted, fontSize: 11 }}>{r.source_system} → {r.target_system} · {r.feed_type} · {r.frequency || "—"}
                      {r.carries_pii === "Y" ? " · PII" : ""}{r.migration_flag === "Y" ? " · Replace" : ""}</div>
                  </div>))}
                {sel.rows.length > 60 && <div style={{ color: t.textMuted, paddingTop: 6 }}>… {sel.rows.length - 60} more; narrow with the filter bar</div>}
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: t.navy, marginBottom: 2 }}>{focusNode.id}</div>
                <div style={{ color: t.textMuted, marginBottom: 10 }}>
                  {focusNode.zoneName} · {projLabel(focusNode.proj)} · {focusNode.role}{focusNode.store ? " · data store" : ""} · {focusNode.in} in · {focusNode.out} out · {neighbours.length} links drawn</div>
                {neighbours.map(({ other, dir, l }) => (
                  <div key={l.key} onClick={() => setEdge(l.key)} role="button" tabIndex={0}
                    style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${t.panel2}`, cursor: "pointer" }}>
                    <span><span style={{ color: t.accent, fontWeight: 700 }}>{dir}</span> {nameOf(other)}</span>
                    <span style={{ color: t.textMuted }}>{l.n}{l.pii ? " · PII" : ""}</span>
                  </div>))}
                {lay.hidden > 0 && <div style={{ color: t.textMuted, paddingTop: 8, fontSize: 11 }}>links under the floor are not listed; lower "draw links with ≥" to see them</div>}
              </>)}
          </div>)}
      </div>
    </div>);
}
