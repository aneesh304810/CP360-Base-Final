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
const ZONE = (zone) => `__zone__${zone}`;
const ZBOX_W = 230, ZBOX_H = 72;

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
export function layout(agg, { perZone = 8, floor = 1, unfolded = new Set(), expanded = null, width = 1400 } = {}) {
  const byZone = new Map();
  agg.systems.forEach((s) => { (byZone.get(s.zone) || byZone.set(s.zone, []).get(s.zone)).push(s); });
  // expanded = null means every zone is open (the system map); a Set means
  // only those zones are open and every other zone is one box (the landing).
  const zones = [...byZone.entries()].map(([name, list]) => {
    list.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    const open = expanded === null || expanded.has(name);
    const keepAll = unfolded.has(name) || list.length <= perZone + 1;
    const kept = !open ? [] : keepAll ? list : list.slice(0, perZone);
    const folded = !open ? list : keepAll ? [] : list.slice(perZone);
    return { name, open, kept, folded, systems: list.length,
             total: list.reduce((s, x) => s + x.n, 0),
             pii: list.reduce((s, x) => s + x.pii, 0), mig: list.reduce((s, x) => s + x.mig, 0),
             stores: list.filter((x) => x.store).length };
  }).sort((a, b) => b.total - a.total);

  // re-point links at fold nodes (a closed zone folds everything into its own box)
  const foldOf = new Map();
  zones.forEach((z) => z.folded.forEach((s) => foldOf.set(s.key, z.open ? FOLD(z.name) : ZONE(z.name))));
  const lines = new Map();
  const internal = {};                                 // interfaces that stay inside a closed zone
  agg.links.forEach((l) => {
    const f = foldOf.get(l.from) || l.from, t = foldOf.get(l.to) || l.to;
    if (f === t) {                                     // inside one fold: counted, not drawn
      internal[f] = (internal[f] || 0) + l.n;
      return;
    }
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
    if (!z.open) {                                      // the zone is one box
      const w = ZBOX_W + ZONE_PAD * 2, h = ZBOX_H + ZONE_PAD * 2;
      if (x + w > width && x > 0) { x = 0; y += rowH + ZONE_GAP; rowH = 0; }
      z.x = x; z.y = y; z.w = w; z.h = h;
      nodes.set(ZONE(z.name), { key: ZONE(z.name), id: z.name, zoneBox: true, zone: z.name, zoneName: z.name,
        proj: z.folded[0]?.proj || "other", n: z.total, in: 0, out: 0, pii: z.pii, mig: z.mig,
        systems: z.systems, stores: z.stores, internal: internal[ZONE(z.name)] || 0,
        x: z.x + ZONE_PAD, y: z.y + ZONE_PAD, w: ZBOX_W, h: ZBOX_H });
      x += w + ZONE_GAP; rowH = Math.max(rowH, h);
      return;
    }
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
  return { zones, nodes, lines: shown, allLines, internal, width: Math.max(width, 320), height: y + rowH + 10,
           shownCount: shown.length, lineCount: allLines.length, hidden: allLines.length - shown.length,
           landing: expanded !== null && expanded.size === 0 };
}

const dims = (n) => ({ w: n.w || BOX_W, h: n.h || BOX_H });
const bez = (p0, p1, p2, p3, t) => ({
  x: (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t ** 2 * p2.x + t ** 3 * p3.x,
  y: (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t ** 2 * p2.y + t ** 3 * p3.y,
});
/* a curve from the side of a that faces b to the side of b that faces a,
   and its midpoint for a label */
const anchor = (a, b) => {
  const da = dims(a), db = dims(b);
  const ax = a.x + da.w / 2, ay = a.y + da.h / 2, bx = b.x + db.w / 2, by = b.y + db.h / 2;
  const dx = bx - ax, dy = by - ay;
  let p0, p1, p2, p3;
  if (Math.abs(dx) > Math.abs(dy)) {
    p0 = { x: dx > 0 ? a.x + da.w : a.x, y: ay }; p3 = { x: dx > 0 ? b.x : b.x + db.w, y: by };
    const mx = (p0.x + p3.x) / 2;
    p1 = { x: mx, y: p0.y }; p2 = { x: mx, y: p3.y };
  } else {
    p0 = { x: ax, y: dy > 0 ? a.y + da.h : a.y }; p3 = { x: bx, y: dy > 0 ? b.y : b.y + db.h };
    const my = (p0.y + p3.y) / 2;
    p1 = { x: p0.x, y: my }; p2 = { x: p3.x, y: my };
  }
  // two boxes linked both ways share a track; offset each direction a little
  const side = (a.key < b.key ? 1 : -1) * 7;
  const off = Math.abs(dx) > Math.abs(dy) ? { x: 0, y: side } : { x: side, y: 0 };
  const sh = (p) => ({ x: p.x + off.x, y: p.y + off.y });
  [p0, p1, p2, p3] = [sh(p0), sh(p1), sh(p2), sh(p3)];
  const m = bez(p0, p1, p2, p3, 0.5);
  return { d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`, mx: m.x, my: m.y };
};

function Store({ x, y, w, h, fill, stroke, sw }) {
  const ry = 6;
  return (
    <g>
      <path d={`M ${x} ${y + ry} v ${h - 2 * ry} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${-(h - 2 * ry)}`} fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
    </g>);
}

// defaultOpen: start with every zone open (the system map) instead of the landing.
/* A small cylinder glyph for a data store. */
const Cyl = ({ c }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" style={{ verticalAlign: "-1px", marginRight: 4 }}>
    <ellipse cx="5.5" cy="2.6" rx="4.6" ry="2" fill="none" stroke={c} strokeWidth="1.2" />
    <path d="M.9 2.6v5.4a4.6 2 0 0 0 9.2 0V2.6" fill="none" stroke={c} strokeWidth="1.2" />
  </svg>);

const Stat = ({ t, n, label, big, color }) => (
  <div>
    <div style={{ fontSize: big ? 28 : 17, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
    <div style={{ fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 4, whiteSpace: "nowrap" }}>{label}</div>
  </div>);

/* THE LANDING. One card per zone across the full width, the flows between
   zones as arcs beneath the cards, and a ledger of those flows. The card
   previews the zone's busiest systems so the reader knows what opening it
   will show. */
const LAND_W = 1200;
function Landing({ t, lay, edge, setEdge, openZone, setExpanded }) {
  const zones = lay.zones;                                      // busiest first
  const N = zones.length, colW = LAND_W / N;
  const cx = (i) => colW * (i + 0.5);
  const idx = Object.fromEntries(zones.map((z, i) => [ZONE(z.name), i]));
  const flows = lay.allLines;                                   // no floor on the landing
  const maxN = Math.max(1, ...flows.map((l) => l.n));
  const cross = {};
  flows.forEach((l) => {
    cross[l.from] = cross[l.from] || { out: 0, in: 0 }; cross[l.to] = cross[l.to] || { out: 0, in: 0 };
    cross[l.from].out += l.n; cross[l.to].in += l.n;
  });
  const nameOf = (k) => lay.nodes.get(k)?.id || k;
  const ARC_MIN = 54, ARC_MAX = 160;
  const arcs = flows.map((l) => {
    const a = idx[l.from], b = idx[l.to], fwd = a < b, span = Math.abs(a - b);
    const h = ARC_MIN + (ARC_MAX - ARC_MIN) * ((span - 1) / Math.max(1, N - 2)) + (fwd ? 0 : 26);
    const x0 = cx(a) + (fwd ? 12 : -12), x1 = cx(b) + (fwd ? -12 : 12);
    const label = `${l.n}${l.pii ? ` · ${l.pii} PII` : ""}`;
    return { l, h, d: `M ${x0} 0 C ${x0} ${h}, ${x1} ${h}, ${x1} 0`, mx: (x0 + x1) / 2, my: h * 0.75, label,
             lw: label.length * 6.4 + 16, w: 2 + 9 * (l.n / maxN),
             c: l.pii ? t.piiClientLevel : t.accent, dashed: l.mig === l.n };
  });
  const H = flows.length ? Math.max(...arcs.map((a) => a.my)) + 22 : 40;
  const topTypes = (types) => Object.entries(types).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" · ");
  const th = { textAlign: "left", fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", padding: "6px 10px", borderBottom: `1px solid ${t.disabled}`, fontWeight: 700 };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${t.panel2}`, fontSize: 12, color: t.text, whiteSpace: "nowrap" };
  const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  return (
    <div data-landing="1">
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, gap: 18 }}>
        {zones.map((z) => {
          const node = lay.nodes.get(ZONE(z.name)); const c = projColor(t, node.proj);
          const top = z.folded.slice(0, 5), topMax = top[0]?.n || 1;
          const xz = cross[ZONE(z.name)] || { in: 0, out: 0 };
          return (
            <div key={z.name} onClick={() => openZone(z.name)} role="button" tabIndex={0} title={`open ${z.name}`}
              style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderTop: `4px solid ${c}`, borderRadius: 6,
                padding: "14px 16px 12px", cursor: "pointer", minWidth: 0, boxShadow: "0 1px 2px rgba(16,25,59,.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name}</div>
                <div style={{ fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", whiteSpace: "nowrap" }}>{projLabel(node.proj)}</div>
              </div>
              <div style={{ display: "flex", gap: 22, margin: "12px 0 12px", alignItems: "flex-end" }}>
                <Stat t={t} n={node.internal} label={`internal interface${node.internal === 1 ? "" : "s"}`} big />
                <Stat t={t} n={z.systems} label="systems" />
                <Stat t={t} n={z.stores} label="stores" />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[[`${xz.out} out`, t.sub, t.panel2], [`${xz.in} in`, t.sub, t.panel2],
                  z.mig ? [`${z.mig} replace`, t.warning, t.warningBg] : null,
                  z.pii ? [`${z.pii} PII ends`, t.danger, t.dangerBg] : null].filter(Boolean).map(([txt, fg, bg]) => (
                  <span key={txt} style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: "2px 8px", borderRadius: 999 }}>{txt}</span>))}
              </div>
              <div style={{ fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>Busiest systems</div>
              {top.map((s) => (
                <div key={s.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "3px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.store && <Cyl c={t.muted} />}{s.id}</div>
                    <div style={{ height: 4, background: t.panel2, borderRadius: 2, marginTop: 3 }}>
                      <div style={{ width: `${Math.max(3, 100 * s.n / topMax)}%`, height: 4, background: s.store ? t.muted : c, borderRadius: 2 }} /></div>
                  </div>
                  <div style={{ fontSize: 11, color: t.sub, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                </div>))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontSize: 10.5, color: t.textMuted }}>{z.systems > top.length ? `+${z.systems - top.length} more systems` : ""}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: t.accent }}>Open zone ▸</span>
              </div>
            </div>);
        })}
      </div>
      <svg viewBox={`0 0 ${LAND_W} ${H}`} width="100%" style={{ display: "block", marginTop: 2 }} fontFamily={t.font}>
        <defs>
          <marker id="eco-arrow-land" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker>
        </defs>
        {zones.map((z, i) => <line key={z.name} x1={cx(i) - 40} y1={0} x2={cx(i) + 40} y2={0} stroke={t.disabled} />)}
        {!flows.length && <text x={LAND_W / 2} y={26} fontSize="12" fill={t.textMuted} textAnchor="middle">no interfaces cross zones in the current filter</text>}
        {arcs.map((a) => {
          const picked = edge === a.l.key, dim = edge && !picked;
          return (
            <g key={a.l.key} style={{ cursor: "pointer" }} opacity={dim ? 0.35 : 1} onClick={() => setEdge(picked ? null : a.l.key)}>
              <path d={a.d} fill="none" stroke={a.c} strokeWidth={picked ? a.w + 2 : a.w} strokeOpacity={picked ? 0.95 : 0.55}
                strokeDasharray={a.dashed ? "7,5" : "none"} strokeLinecap="round" markerEnd="url(#eco-arrow-land)">
                <title>{`${nameOf(a.l.from)} → ${nameOf(a.l.to)}: ${a.l.n} interface${a.l.n === 1 ? "" : "s"}${a.l.pii ? ` · ${a.l.pii} PII` : ""}${a.l.mig ? ` · ${a.l.mig} Replace` : ""}`}</title>
              </path>
              <rect x={a.mx - a.lw / 2} y={a.my - 9} width={a.lw} height={18} rx={9} fill="#fff" stroke={a.c} strokeWidth={1} />
              <text x={a.mx} y={a.my + 4} fontSize="10.5" fontWeight="700" fill={t.navy} textAnchor="middle">{a.label}</text>
            </g>);
        })}
      </svg>
      {flows.length > 0 && (
        <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: 6, marginTop: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Zone-to-zone flow</th><th style={{ ...th, textAlign: "right" }}>Interfaces</th><th style={{ ...th, textAlign: "right" }}>System pairs</th>
              <th style={{ ...th, textAlign: "right" }}>PII</th><th style={{ ...th, textAlign: "right" }}>Replace</th><th style={th}>Feed types</th><th style={th}></th></tr></thead>
            <tbody>
              {flows.map((l) => (
                <tr key={l.key} onClick={() => setEdge(edge === l.key ? null : l.key)} style={{ cursor: "pointer", background: edge === l.key ? t.infoBg : "transparent" }}>
                  <td style={{ ...td, fontWeight: 700, color: t.navy }}>{nameOf(l.from)} <span style={{ color: t.textMuted }}>→</span> {nameOf(l.to)}</td>
                  <td style={num}>{l.n}</td><td style={num}>{l.pairs}</td>
                  <td style={{ ...num, color: l.pii ? t.danger : t.textMuted, fontWeight: l.pii ? 700 : 400 }}>{l.pii || "—"}</td>
                  <td style={{ ...num, color: l.mig ? t.warning : t.textMuted, fontWeight: l.mig ? 700 : 400 }}>{l.mig || "—"}</td>
                  <td style={{ ...td, color: t.sub }}>{topTypes(l.types)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setExpanded(new Set([nameOf(l.from), nameOf(l.to)])); }}
                      style={{ color: t.accent, fontWeight: 700, fontSize: 11 }}>open both ▸</span></td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>);
}

// defaultOpen: start with every zone open (the system map) instead of the landing.
export default function EcosystemView({ t, rows, onSelect, defaultOpen = false }) {
  const agg = useMemo(() => aggregate(rows), [rows]);
  const [perZone, setPerZone] = useState(8);
  const [floorPick, setFloorPick] = useState(null);     // null = automatic
  const [unfolded, setUnfolded] = useState(() => new Set());
  // The landing: every zone closed. Click a zone to open it in place; the
  // other zones stay as single boxes so cross-zone links still land.
  const [expanded, setExpanded] = useState(() => (defaultOpen ? null : new Set()));
  const [focus, setFocus] = useState(null);
  const [edge, setEdge] = useState(null);
  const auto = useMemo(() => autoFloor(agg.links), [agg]);
  const floor = floorPick ?? auto;
  const zoneCount = useMemo(() => new Set(agg.systems.map((x) => x.zone)).size, [agg]);
  // one zone only: there is nothing to land on, go straight to the systems
  const exp = zoneCount <= 1 ? null : expanded;
  const landing = exp !== null && exp.size === 0;
  const lay = useMemo(() => layout(agg, { perZone, floor: landing ? 1 : floor, unfolded, expanded: exp }),
    [agg, perZone, floor, unfolded, exp, landing]);
  const openZone = (name) => { const e = new Set(expanded); e.add(name); setExpanded(e); setFocus(null); setEdge(null); };
  const closeZone = (name) => { const e = new Set(expanded); e.delete(name); setExpanded(e); setFocus(null); setEdge(null); };
  const showLabels = lay.lines.length <= 40;
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
          {landing ? <><b style={{ color: t.navy }}>{lay.lineCount}</b> zone-to-zone flows</>
            : <><b style={{ color: t.navy }}>{lay.shownCount}</b> of {lay.lineCount} links drawn</>} · <b style={{ color: t.navy }}>{(rows || []).length}</b> interfaces
          {agg.merged > 0 && <span style={{ color: "#b26b00" }}> · {agg.merged} name variants merged (case and spacing only)</span>}</span>
        {exp !== null && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span onClick={() => { setExpanded(new Set()); setFocus(null); setEdge(null); }} role="button" tabIndex={0}
              style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                border: `1px solid ${landing ? t.accent : t.disabled}`, background: landing ? t.accent : "#fff", color: landing ? "#fff" : t.accent }}>all zones</span>
            {[...(expanded || [])].map((z) => (
              <span key={z} onClick={() => closeZone(z)} role="button" tabIndex={0} title="close this zone"
                style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${t.accent}`, background: t.accent, color: "#fff" }}>{z} ✕</span>))}
            {landing && <span style={{ color: t.textMuted }}>click a zone to open it</span>}
          </span>)}
        {!landing && <label>systems per zone{" "}
          <select value={perZone} onChange={(e) => { setPerZone(Number(e.target.value)); setUnfolded(new Set()); }} style={sw}>
            {[4, 6, 8, 12, 999].map((n) => <option key={n} value={n}>{n === 999 ? "all" : `top ${n}`}</option>)}</select></label>}
        {!landing && <label>draw links with ≥{" "}
          <select value={floor} onChange={(e) => setFloorPick(Number(e.target.value))} style={sw}>
            {[1, 2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>{" "}
          interface{floor === 1 ? "" : "s"}{floorPick == null ? " (auto)" : ""}
          {floorPick != null && <span onClick={() => setFloorPick(null)} role="button" tabIndex={0} style={{ marginLeft: 6, color: t.accent, cursor: "pointer" }}>auto</span>}</label>}
        <span style={{ marginLeft: "auto", color: t.textMuted }}>{landing
          ? "arc width = interfaces · red = carries PII · dashed = all Replace · click a flow for its interfaces"
          : "cylinder = data store · width = interfaces · dashed = all Replace · red = carries PII"}</span>
        {(focus || edge) && <span onClick={() => { setFocus(null); setEdge(null); }} role="button" tabIndex={0}
          style={{ cursor: "pointer", color: t.accent, fontWeight: 700 }}>clear ✕</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: sel || focus ? "1fr 320px" : "1fr", gap: 14 }}>
        {landing ? <Landing t={t} lay={lay} edge={edge} setEdge={setEdge} openZone={openZone}
                     setExpanded={(e) => { setExpanded(e); setFocus(null); setEdge(null); }} />
        : <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "auto" }}>
          <svg viewBox={`0 0 ${lay.width} ${lay.height}`} width="100%" style={{ minWidth: 900, display: "block" }} fontFamily={t.font}>
            <defs>
              <marker id="eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker>
            </defs>
            {lay.zones.filter((z) => z.open).map((z) => (
              <g key={z.name}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={10} fill="#f3f6f9" stroke="#d6dee6" />
                <text x={z.x + ZONE_PAD} y={z.y + 20} fontSize="12" fontWeight="800" fill={t.navy} letterSpacing=".3">
                  {z.name}</text>
                <text x={z.x + z.w - ZONE_PAD} y={z.y + 20} fontSize="10" fill={t.textMuted} textAnchor="end">
                  {z.kept.length + z.folded.length} systems · {z.total} interface ends
                  {exp !== null && <tspan fill={t.accent} fontWeight="700" onClick={() => closeZone(z.name)} style={{ cursor: "pointer" }}>  · close ✕</tspan>}</text>
              </g>))}
            {lay.lines.map((l) => {
              const a = lay.nodes.get(l.from), b = lay.nodes.get(l.to);
              if (!a || !b) return null;
              const on = touches(l), picked = edge === l.key;
              const w = 1 + Math.log2(l.n + 1) * 1.1;
              const c = l.pii ? "#c1113a" : projColor(t, a.proj);
              const g = anchor(a, b);
              return (
                <g key={l.key} style={{ cursor: "pointer" }} onClick={() => setEdge(picked ? null : l.key)}>
                  <path d={g.d} fill="none" stroke={c}
                    strokeWidth={picked ? w + 2 : w} strokeOpacity={on ? (picked ? 1 : 0.42) : 0.05}
                    strokeDasharray={l.mig === l.n ? "6,4" : "none"} markerEnd="url(#eco-arrow)">
                    <title>{`${nameOf(l.from)} → ${nameOf(l.to)}: ${l.n} interface${l.n === 1 ? "" : "s"}${l.pairs > 1 ? ` across ${l.pairs} pairs` : ""}${l.pii ? ` · ${l.pii} PII` : ""}${l.mig ? ` · ${l.mig} Replace` : ""}`}</title>
                  </path>
                  {showLabels && on && (
                    <g>
                      <rect x={g.mx - 14} y={g.my - 8} width={28 + (l.pii ? 18 : 0)} height={15} rx={7} fill="#fff" stroke={c} strokeWidth={0.8} strokeOpacity={0.7} />
                      <text x={g.mx + (l.pii ? 9 : 0)} y={g.my + 3.5} fontSize="9.5" fontWeight="700" fill={t.navy} textAnchor="middle">
                        {l.n}{l.pii ? ` · ${l.pii}P` : ""}</text>
                    </g>)}
                </g>);
            })}
            {[...lay.nodes.values()].filter((n) => n.zoneBox).map((n) => {
              const dim = focus && focus !== n.key && !lay.lines.some((l) => touches(l) && (l.from === n.key || l.to === n.key));
              const isF = focus === n.key;
              return (
                <g key={n.key} opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }}
                  onClick={() => openZone(n.zone)}>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill={isF ? "#eaf1f8" : "#f3f6f9"} stroke={isF ? t.accent : "#9fb0c0"} strokeWidth={isF ? 2 : 1.4} />
                  <text x={n.x + 14} y={n.y + 22} fontSize="13" fontWeight="800" fill={t.navy}>{n.id}</text>
                  <text x={n.x + 14} y={n.y + 40} fontSize="10" fill={t.sub}>
                    {n.systems} systems{n.stores ? ` · ${n.stores} stores` : ""} · {n.internal} internal interface{n.internal === 1 ? "" : "s"}</text>
                  <text x={n.x + 14} y={n.y + 56} fontSize="10" fill={t.textMuted}>
                    {n.mig ? `${n.mig} replace` : "no replace"}{n.pii ? ` · ${n.pii} PII ends` : ""} · <tspan fill={t.accent} fontWeight="700">open ▸</tspan></text>
                  {n.pii > 0 && <circle cx={n.x + n.w - 12} cy={n.y + 12} r={4.5} fill="#c1113a" />}
                </g>);
            })}
            {[...lay.nodes.values()].filter((n) => !n.zoneBox).map((n) => {
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
        </div>}
        {(sel || focusNode) && (
          <div style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, padding: 14, fontSize: 12, alignSelf: "start", maxHeight: "78vh", overflow: "auto" }}>
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
