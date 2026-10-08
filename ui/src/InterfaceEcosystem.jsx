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
//             itself so that about forty lines show, and the reader can
//             lower it
//
// Names that differ only in case or spacing ("AUM", "AUm") are one system;
// nothing else is merged, and the merges are counted on screen.
//
// Within a zone, systems whose name says they are a store (warehouse,
// datamart, DW, DB, lake) sit on a bottom row as cylinders; everything
// else is a box in a grid. Width is the interface count, dashed means
// every interface on the line is marked Replace, red means PII rides it.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { projColor, projLabel } from "./bbhTheme.js";

const BOX_W = 150, BOX_H = 40, GAP_X = 46, GAP_Y = 48, ZONE_PAD = 24, ZONE_HEAD = 48, ZONE_GAP = 76;
const BUS = 44;                     // a routing bus under the zones for links between non-adjacent zones
const LANE = 6;                     // spacing between parallel lines in one gutter
const MIN_ROW_H = 290;
const STORE_RE = /warehouse|data\s*mart|datamart|\bdwh?\b|\bdm\b|database|\bdb\b|\blake\b|\bmart\b|\bods\b/i;
const FOLD = (zone) => `__fold__${zone}`;
const ZONE = (zone) => `__zone__${zone}`;
const ZBOX_W = 232;              // a closed zone is a card as tall as the row

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
export function autoFloor(links, want = 40) {
  const counts = links.map((l) => l.n).sort((a, b) => b - a);
  if (counts.length <= want) return 1;
  return Math.max(1, counts[want - 1]);
}

/* systems + links -> zones with positions, folded where asked. */
export function layout(agg, { perZone = 8, floor = 1, unfolded = new Set(), expanded = null, width = 1400, height = null } = {}) {
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

  // geometry: every zone in one row across the width; closed zones are
  // cards as tall as the row, open zones a grid of boxes. The grid shapes
  // itself to the space it is given: columns per zone and the gaps are
  // chosen so the picture's aspect ratio comes close to the panel's.
  const opens = zones.filter((z) => z.open);
  const colsFor = (z) => {
    const apps = z.kept.filter((s) => !s.store), stores = z.kept.filter((s) => s.store);
    z.items = apps.length + (z.folded.length ? 1 : 0); z.storeN = stores.length;
    return Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.max(z.items, z.storeN)))));
  };
  opens.forEach((z) => { z.cols = colsFor(z); });
  const build = (vx, vy) => {
    const gapX = GAP_X * vx, gapY = GAP_Y * vy, zoneGap = ZONE_GAP * vx, busH = BUS * vy;
    const nodes = new Map();
    opens.forEach((z) => {
      z.appRows = Math.ceil(z.items / z.cols); z.storeRows = Math.ceil(z.storeN / z.cols);
      z.w = ZONE_PAD * 2 + z.cols * BOX_W + (z.cols - 1) * gapX;
      z.h = ZONE_HEAD + ZONE_PAD + (z.appRows + z.storeRows) * (BOX_H + gapY) + (z.storeRows ? 12 : 0) + ZONE_PAD;
    });
    const rowH = Math.max(MIN_ROW_H, ...opens.map((z) => z.h));
    let x = 0;
    zones.forEach((z, zi) => {
      z.zi = zi; z.x = x; z.y = 0; z.h = rowH;
      if (!z.open) {
        z.w = ZBOX_W;
        nodes.set(ZONE(z.name), { key: ZONE(z.name), id: z.name, zoneBox: true, zone: z.name, zoneName: z.name, zi,
          proj: z.folded[0]?.proj || "other", n: z.total, in: 0, out: 0, pii: z.pii, mig: z.mig,
          systems: z.systems, stores: z.stores, internal: internal[ZONE(z.name)] || 0, top: z.folded.slice(0, 5),
          x: z.x, y: z.y, w: z.w, h: z.h });
        x += z.w + zoneGap;
        return;
      }
      const apps = z.kept.filter((s) => !s.store), stores = z.kept.filter((s) => s.store);
      z.colsX = Array.from({ length: z.cols }, (_, c) => z.x + ZONE_PAD + c * (BOX_W + gapX));
      z.rowsY = Array.from({ length: z.appRows + z.storeRows }, (_, r) => z.y + ZONE_HEAD + ZONE_PAD + r * (BOX_H + gapY) + (r >= z.appRows && z.storeRows ? 12 : 0));
      const place = (list, startRow) => list.forEach((s, i) => {   // placed copies: the systems themselves stay untouched
        const col = i % z.cols, row = startRow + Math.floor(i / z.cols);
        nodes.set(s.key, { ...s, col, row, zi, x: z.colsX[col], y: z.rowsY[row], w: BOX_W, h: BOX_H, zoneName: z.name });
      });
      const appList = [...apps];
      if (z.folded.length) {
        appList.push({ key: FOLD(z.name), id: `+${z.folded.length} other systems`, fold: true, zone: z.name,
          proj: z.folded[0].proj, n: z.folded.reduce((a, s) => a + s.n, 0), in: 0, out: 0,
          pii: z.folded.reduce((a, s) => a + s.pii, 0), mig: 0, folded: z.folded });
      }
      place(appList, 0);
      place(stores, z.appRows);
      x += z.w + zoneGap;
    });
    return { zones, nodes, lines: shown, allLines, internal, width: Math.max(x - zoneGap, 320), height: rowH + busH + 6,
             rowH, busY: rowH + busH / 2, gapX, gapY, zoneGap, busH, vx, vy,
             shownCount: shown.length, lineCount: allLines.length, hidden: allLines.length - shown.length,
             landing: expanded !== null && expanded.size === 0 };
  };
  let lay = build(1, 1);
  if (height && width && opens.length) {
    // Fill the panel: first spread the rows apart (more lane room, airier
    // picture); only if the picture is still much wider than the panel,
    // take a column off the widest zone, never below two. If instead the
    // picture is taller than the panel, widen the gaps and add columns.
    const aspect = width / height, ratio = (l) => l.width / l.height;
    const stretch = () => {
      let vx = 1, vy = 1;
      for (let i = 0; i < 40; i++) {
        const r = ratio(lay);
        if (r > aspect * 1.03 && vy < 2.4) vy += 0.08;
        else if (r < aspect / 1.03 && vx < 1.5) vx += 0.08;
        else break;
        lay = build(vx, vy);
      }
    };
    for (let attempt = 0; attempt < 6; attempt++) {
      stretch();
      const r = ratio(lay);
      if (r > aspect * 1.15) {
        const z = opens.filter((o) => o.cols > 2).sort((a, b) => b.w - a.w)[0];
        if (!z) break; z.cols -= 1;
      } else if (r < aspect / 1.15) {
        const z = opens.filter((o) => o.cols < Math.min(4, Math.max(o.items, o.storeN))).sort((a, b) => (b.appRows + b.storeRows) - (a.appRows + a.storeRows))[0];
        if (!z) break; z.cols += 1;
      } else break;
      lay = build(1, 1);
    }
  }
  // a tall closed card has room for more of its busiest systems
  const topN = Math.max(5, Math.min(12, Math.floor((lay.rowH - 210) / 20)));
  lay.nodes.forEach((n) => { if (n.zoneBox) n.top = lay.zones[n.zi].folded.slice(0, topN); });
  routeLines(lay);
  return lay;
}

/* ORTHOGONAL ROUTING. Every line runs in the gutters: the gaps between
   rows and columns of a zone, the gap between zones, and a bus under the
   zones for links between zones that are not neighbours. A line leaves
   its box from the side that faces its gutter and enters the target the
   same way, so no line crosses a box. Lines that share a gutter are
   spread into lanes.

   A route is a list of points whose coordinates are numbers or gutter
   ids; the ids are resolved to a base coordinate plus a lane offset once
   every line has claimed its gutters. */
/* an orthogonal polyline with its corners rounded */
const roundedPath = (pts, r) => {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const rr = Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
    const ux = Math.sign(c.x - p.x), uy = Math.sign(c.y - p.y), vx = Math.sign(n.x - c.x), vy = Math.sign(n.y - c.y);
    d += ` L ${(c.x - ux * rr).toFixed(1)} ${(c.y - uy * rr).toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${(c.x + vx * rr).toFixed(1)} ${(c.y + vy * rr).toFixed(1)}`;
  }
  const e = pts[pts.length - 1];
  return d + ` L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
};

export function routeLines(lay) {
  const { zones, nodes } = lay;
  const gutters = new Map();                           // id -> { base, cap, users: [] }
  const G = (id, base, cap) => { if (!gutters.has(id)) gutters.set(id, { base, cap, users: [] }); return id; };
  const hg = (z, r) => {                               // the gap below row r (-1: above row 0)
    const ys = z.rowsY, last = ys.length - 1;
    const y = r < 0 ? ys[0] - lay.gapY / 2 : r >= last ? ys[last] + BOX_H + lay.gapY / 2 : (ys[r] + BOX_H + ys[r + 1]) / 2;
    return G(`h:${z.zi}:${r}`, y, lay.gapY);
  };
  const vg = (z, c) => {                               // the gap right of column c (-1: left of column 0)
    const xs = z.colsX;
    const xx = c < 0 ? xs[0] - lay.gapX / 2 : xs[c] + BOX_W + lay.gapX / 2;
    return G(`v:${z.zi}:${c}`, xx, lay.gapX);
  };
  const zg = (i) => G(`z:${i}`, zones[i].x + zones[i].w + lay.zoneGap / 2, lay.zoneGap);   // between zone i and i+1
  const bus = () => G("bus", lay.busY, lay.busH);
  const edge = (n, side) => {
    const along = side === "top" || side === "bottom";
    return G(`e:${n.key}:${side}`, along ? n.x + n.w / 2 : n.y + n.h / 2, along ? n.w : n.h);
  };
  const direct = (a, b, axis) => G(`d:${axis}:${[a.key, b.key].sort().join("|")}`, axis === "y" ? a.y + a.h / 2 : a.x + a.w / 2, axis === "y" ? a.h : a.w);

  // leave a box in zone z towards the zone gap on its right (toRight) or left
  const leave = (a, z, toRight) => {
    if (a.zoneBox) { const side = toRight ? "right" : "left"; return [{ x: toRight ? a.x + a.w : a.x, y: edge(a, side) }]; }
    if ((toRight && a.col === z.cols - 1) || (!toRight && a.col === 0)) {
      const side = toRight ? "right" : "left";
      return [{ x: toRight ? a.x + a.w : a.x, y: edge(a, side) }];
    }
    const e = edge(a, "bottom"), g = hg(z, a.row);
    return [{ x: e, y: a.y + a.h }, { x: e, y: g }, { x: toRight ? z.x + z.w : z.x, y: g }];
  };
  const route = (l) => {
    const a = nodes.get(l.from), b = nodes.get(l.to);
    if (!a || !b) return null;
    const za = zones[a.zi], zb = zones[b.zi];
    if (a.zi === b.zi) {                               // inside one open zone
      if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
        const right = b.col > a.col, y = direct(a, b, "y");
        return [{ x: right ? a.x + a.w : a.x, y }, { x: right ? b.x : b.x + b.w, y }];
      }
      if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
        const down = b.row > a.row, xx = direct(a, b, "x");
        return [{ x: xx, y: down ? a.y + a.h : a.y }, { x: xx, y: down ? b.y : b.y + b.h }];
      }
      const down = b.row >= a.row, gr = down ? a.row : a.row - 1, g = hg(za, gr);
      const ea = edge(a, down ? "bottom" : "top");
      const pts = [{ x: ea, y: down ? a.y + a.h : a.y }, { x: ea, y: g }];
      if (b.row === (down ? gr + 1 : gr)) {            // the gutter touches b: enter from above or below
        const eb = edge(b, down ? "top" : "bottom");
        pts.push({ x: eb, y: g }, { x: eb, y: down ? b.y : b.y + b.h });
        return pts;
      }
      const side = b.col > a.col ? "left" : "right";   // the column gap on the side of b that faces a
      const v = side === "left" ? vg(za, b.col - 1) : vg(za, b.col), eb = edge(b, side);
      pts.push({ x: v, y: g }, { x: v, y: eb }, { x: side === "left" ? b.x : b.x + b.w, y: eb });
      return pts;
    }
    // across zones: out to the zone gap, along it (or down to the bus), in again
    const toRight = b.zi > a.zi;
    const ga = toRight ? zg(a.zi) : zg(a.zi - 1), gb = toRight ? zg(b.zi - 1) : zg(b.zi);
    const out = leave(a, za, toRight);
    const pts = [...out, { x: ga, y: out[out.length - 1].y }];
    if (ga !== gb) { const y = bus(); pts.push({ x: ga, y }, { x: gb, y }); }
    const side = toRight ? "left" : "right";
    if (b.zoneBox || (toRight ? b.col === 0 : b.col === zb.cols - 1)) {
      const eb = edge(b, side);
      pts.push({ x: gb, y: eb }, { x: toRight ? b.x : b.x + b.w, y: eb });
      return pts;
    }
    const g = hg(zb, b.row), v = side === "left" ? vg(zb, b.col - 1) : vg(zb, b.col), eb = edge(b, side);
    pts.push({ x: gb, y: g }, { x: v, y: g }, { x: v, y: eb }, { x: side === "left" ? b.x : b.x + b.w, y: eb });
    return pts;
  };
  const routed = lay.lines.map((l) => ({ l, pts: route(l) })).filter((r) => r.pts);
  // claim lanes: every gutter a line touches, once per line
  routed.forEach((r) => {
    const seen = new Set();
    r.pts.forEach((p) => [p.x, p.y].forEach((c) => {
      if (typeof c === "string" && !seen.has(c)) { seen.add(c); gutters.get(c).users.push(r); }
    }));
  });
  // lanes are LANE apart, squeezed so the spread never leaves the gutter
  const offset = (id, r) => {
    const g = gutters.get(id), n = g.users.length, k = g.users.indexOf(r);
    const lane = Math.min(LANE, (g.cap - 10) / Math.max(1, n - 1));
    return (k - (n - 1) / 2) * lane;
  };
  routed.forEach((r) => {
    const res = r.pts.map((p) => ({
      x: typeof p.x === "string" ? gutters.get(p.x).base + offset(p.x, r) : p.x,
      y: typeof p.y === "string" ? gutters.get(p.y).base + offset(p.y, r) : p.y }));
    // drop zero-length steps
    const pts = res.filter((p, i) => i === 0 || Math.abs(p.x - res[i - 1].x) > 0.01 || Math.abs(p.y - res[i - 1].y) > 0.01);
    r.l.pts = pts;
    r.l.d = roundedPath(pts, 7);
    // the label sits on the longest run
    let best = 0, bi = 0;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      if (len > best) { best = len; bi = i; }
    }
    r.l.lx = (pts[bi].x + pts[bi - 1].x) / 2; r.l.ly = (pts[bi].y + pts[bi - 1].y) / 2; r.l.run = best;
    r.l.vertical = Math.abs(pts[bi].x - pts[bi - 1].x) < 0.01;
  });
  return lay;
}

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

const zoneCount = (agg) => new Set(agg.systems.map((x) => x.zone)).size;
const landingKey = (agg, expanded, n) => (n <= 1 ? "all" : expanded === null ? "all" : [...expanded].sort().join("|"));

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
  const [full, setFull] = useState(false);
  // the map shapes itself to the space it is given: measure the panel
  const panelRef = useRef(null);
  const [space, setSpace] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || typeof window === "undefined") return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const h = full ? window.innerHeight - r.top - 16 : Math.max(480, window.innerHeight - r.top - 28);
      const w = Math.max(320, r.width);
      setSpace((s) => (Math.abs(s.w - w) < 2 && Math.abs(s.h - h) < 2 ? s : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [full, landingKey(agg, expanded, zoneCount(agg))]);
  useEffect(() => {
    if (!full || typeof window === "undefined") return undefined;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [full]);
  const zoneCountN = useMemo(() => zoneCount(agg), [agg]);
  // one zone only: there is nothing to land on, go straight to the systems
  const exp = zoneCountN <= 1 ? null : expanded;
  const landing = exp !== null && exp.size === 0;
  // the floor picks itself from the lines this zone state can draw, not from raw system pairs
  const sizing = { width: space.w || 1400, height: landing ? null : (space.h || null) };
  const base = useMemo(() => layout(agg, { perZone, floor: 1, unfolded, expanded: exp, ...sizing }), [agg, perZone, unfolded, exp, sizing.width, sizing.height]);
  const auto = landing ? 1 : autoFloor(base.allLines);
  const floor = floorPick ?? auto;
  const lay = useMemo(() => (floor === 1 ? base : layout(agg, { perZone, floor, unfolded, expanded: exp, ...sizing })),
    [agg, base, perZone, floor, unfolded, exp, sizing.width, sizing.height]);
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
    <div style={full ? { position: "fixed", inset: 0, zIndex: 1000, background: t.bg, padding: "14px 18px", overflow: "auto", fontFamily: t.font } : undefined}>
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
            {[...new Set([1, 2, 3, 5, 10, 20, floor])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}</select>{" "}
          interface{floor === 1 ? "" : "s"}{floorPick == null ? " (auto)" : ""}
          {floorPick != null && <span onClick={() => setFloorPick(null)} role="button" tabIndex={0} style={{ marginLeft: 6, color: t.accent, cursor: "pointer" }}>auto</span>}</label>}
        <span style={{ marginLeft: "auto", color: t.textMuted }}>{landing
          ? "arc width = interfaces · red = carries PII · dashed = all Replace · click a flow for its interfaces"
          : "cylinder = data store · line width = interfaces · dashed = all Replace · red = carries PII"}</span>
        {(focus || edge) && <span onClick={() => { setFocus(null); setEdge(null); }} role="button" tabIndex={0}
          style={{ cursor: "pointer", color: t.accent, fontWeight: 700 }}>clear ✕</span>}
        {!landing && <span onClick={() => setFull(!full)} role="button" tabIndex={0} title={full ? "exit full screen (Esc)" : "full screen"}
          style={{ cursor: "pointer", color: t.accent, fontWeight: 700, border: `1px solid ${t.disabled}`, borderRadius: 4, padding: "3px 10px", background: "#fff" }}>
          {full ? "exit full screen ✕" : "full screen ⛶"}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: sel || focus ? "1fr 320px" : "1fr", gap: 14 }}>
        {landing ? <Landing t={t} lay={lay} edge={edge} setEdge={setEdge} openZone={openZone}
                     setExpanded={(e) => { setExpanded(e); setFocus(null); setEdge(null); }} />
        : <div ref={panelRef} style={{ background: t.panel, border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "hidden" }}>
          <svg viewBox={`0 0 ${lay.width} ${lay.height}`} width="100%" height={space.h || undefined} preserveAspectRatio="xMidYMin meet"
            style={{ display: "block" }} fontFamily={t.font}>
            <defs>
              <marker id="eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9"
                markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker>
            </defs>
            {lay.zones.filter((z) => z.open).map((z) => (
              <g key={z.name}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={8} fill="#f6f8fa" stroke="#d6dee6" />
                <text x={z.x + ZONE_PAD} y={z.y + 22} fontSize="13" fontWeight="800" fill={t.navy} letterSpacing=".3">
                  {z.name}</text>
                <text x={z.w < 520 ? z.x + ZONE_PAD : z.x + z.w - ZONE_PAD} y={z.w < 520 ? z.y + 38 : z.y + 22} fontSize="10" fill={t.textMuted} textAnchor={z.w < 520 ? "start" : "end"}>
                  {z.kept.length + z.folded.length} systems · {z.total} interface ends
                  {exp !== null && <tspan fill={t.accent} fontWeight="700" onClick={() => closeZone(z.name)} style={{ cursor: "pointer" }}>  · close ✕</tspan>}</text>
              </g>))}
            {lay.lines.map((l) => {
              const a = lay.nodes.get(l.from), b = lay.nodes.get(l.to);
              if (!a || !b || !l.d) return null;
              const on = touches(l), picked = edge === l.key;
              const w = 1 + Math.log2(l.n + 1) * 0.8;
              const c = l.pii ? "#c1113a" : "#6f7f90";
              const label = `${l.n}${l.pii ? ` · ${l.pii}P` : ""}`, lw = label.length * 6 + 10;
              return (
                <g key={l.key} style={{ cursor: "pointer" }} onClick={() => setEdge(picked ? null : l.key)}>
                  <path d={l.d} fill="none" stroke={c} strokeLinejoin="round"
                    strokeWidth={picked ? w + 2 : w} strokeOpacity={on ? (picked ? 1 : 0.4) : 0.06}
                    strokeDasharray={l.mig === l.n ? "6,4" : "none"} markerEnd="url(#eco-arrow)">
                    <title>{`${nameOf(l.from)} → ${nameOf(l.to)}: ${l.n} interface${l.n === 1 ? "" : "s"}${l.pairs > 1 ? ` across ${l.pairs} pairs` : ""}${l.pii ? ` · ${l.pii} PII` : ""}${l.mig ? ` · ${l.mig} Replace` : ""}`}</title>
                  </path>
                  {showLabels && on && (l.run >= lw + 12 ? (
                    <g>
                      <rect x={l.lx - lw / 2} y={l.ly - 7.5} width={lw} height={15} rx={7} fill="#fff" stroke={c} strokeWidth={0.8} strokeOpacity={0.7} />
                      <text x={l.lx} y={l.ly + 3.5} fontSize="9.5" fontWeight="700" fill={t.navy} textAnchor="middle">{label}</text>
                    </g>) : (
                    <text x={l.lx} y={l.ly + 3.5} fontSize="9" fontWeight="700" fill={t.navy} textAnchor="middle"
                      stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{label}</text>))}
                </g>);
            })}
            {[...lay.nodes.values()].filter((n) => n.zoneBox).map((n) => {
              const dim = focus && focus !== n.key && !lay.lines.some((l) => touches(l) && (l.from === n.key || l.to === n.key));
              const c = projColor(t, n.proj), topMax = n.top[0]?.n || 1, px = n.x + 16, bw = n.w - 32 - 30;
              return (
                <g key={n.key} opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }} onClick={() => openZone(n.zone)}>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill="#fff" stroke="#9fb0c0" strokeWidth={1.2} />
                  <path d={`M ${n.x + 8} ${n.y} h ${n.w - 16} a 8 8 0 0 1 8 8 v 1 h ${-n.w} v -1 a 8 8 0 0 1 8 -8 z`} fill={c} />
                  <text x={px} y={n.y + 30} fontSize="14" fontWeight="800" fill={t.navy}>{n.id.length > 26 ? n.id.slice(0, 25) + "…" : n.id}</text>
                  <text x={px} y={n.y + 44} fontSize="8.5" fill={t.textMuted} letterSpacing=".6">{projLabel(n.proj).toUpperCase()} · CLOSED</text>
                  <text x={px} y={n.y + 78} fontSize="26" fontWeight="800" fill={t.navy}>{n.internal}</text>
                  <text x={px} y={n.y + 92} fontSize="8.5" fill={t.textMuted} letterSpacing=".5">INTERNAL INTERFACES</text>
                  <text x={px + 118} y={n.y + 78} fontSize="15" fontWeight="800" fill={t.navy}>{n.systems}</text>
                  <text x={px + 118} y={n.y + 92} fontSize="8.5" fill={t.textMuted} letterSpacing=".5">SYSTEMS</text>
                  <text x={px} y={n.y + 112} fontSize="10" fill={t.sub}>
                    {n.stores ? `${n.stores} store${n.stores === 1 ? "" : "s"} · ` : ""}{n.mig ? `${n.mig} replace` : "no replace"}
                    {n.pii ? <tspan fill="#c1113a"> · {n.pii} PII ends</tspan> : null}</text>
                  <text x={px} y={n.y + 136} fontSize="8.5" fill={t.textMuted} letterSpacing=".5">BUSIEST SYSTEMS</text>
                  {n.top.map((s, i) => (
                    <g key={s.key}>
                      <text x={px} y={n.y + 152 + i * 20} fontSize="10.5" fill={t.text}>{s.id.length > 24 ? s.id.slice(0, 23) + "…" : s.id}</text>
                      <text x={n.x + n.w - 16} y={n.y + 152 + i * 20} fontSize="10" fill={t.sub} textAnchor="end">{s.n}</text>
                      <rect x={px} y={n.y + 156 + i * 20} width={bw} height={3} rx={1.5} fill={t.panel2} />
                      <rect x={px} y={n.y + 156 + i * 20} width={Math.max(3, bw * s.n / topMax)} height={3} rx={1.5} fill={s.store ? t.muted : c} />
                    </g>))}
                  <text x={n.x + n.w - 16} y={n.y + n.h - 14} fontSize="11" fontWeight="700" fill={t.accent} textAnchor="end">Open zone ▸</text>
                  {n.systems > n.top.length && <text x={px} y={n.y + n.h - 14} fontSize="10" fill={t.textMuted}>+{n.systems - n.top.length} more</text>}
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
