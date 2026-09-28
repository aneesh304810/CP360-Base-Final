// The three panels the mockup promised and the built dashboard never got:
// the ribbon diagram, the evidence breakdown, and the per-column waffle.
//
// They are here rather than in CrosswalkDashboard because each one is a
// self-contained drawing with its own layout maths, and folding three of
// those into a file that already holds a four-level drill makes both harder
// to read.
//
// All three take data they are given and render nothing when it is empty.
// That is what keeps a warehouse with no crosswalk — PBDW today — unchanged.

import React, { useMemo, useState } from "react";
import { VERDICT, VERDICT_ORDER } from "./seiCrosswalkApi.js";
import { verdictShort, VERDICT_INFO } from "./crosswalkGlossary.js";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const vc = (v) => (VERDICT[v] || VERDICT.UNKNOWN).c;

// ====================================================================== flow
// Three columns — SEI datapoint source, contract feed, warehouse table — with
// ribbon width in columns.
//
// TWO THINGS THE MOCKUP GOT RIGHT AND A GENERIC SANKEY WOULD NOT.
//
// First, "no SEI source" is a node. It is not an absence to be left out of
// the picture; it is usually the widest ribbon on the diagram, and drawing it
// is the whole point. A flow chart of only the mappings that exist answers a
// question nobody asked.
//
// Second, ribbons are coloured by verdict, so one link into a contract feed
// splits into bands. Colour by node and the diagram says mappings exist;
// colour by verdict and it says how many of them are worth anything.
export function FlowDiagram({ t, flow, onPickVerdict, onDrill, onOpenTable }) {
  const model = useMemo(() => buildFlowModel(flow), [flow]);
  const [sel, setSel] = useState(null);
  const focus = useMemo(() => resolveFocus(model, sel), [model, sel]);
  if (!model) return null;
  const { W, H, CW, nodes, ribbons, arcs, heads, verdicts } = model;
  const muted = t.muted || "#999";

  // A selected ribbon is the one you clicked. A selected NODE is not one
  // ribbon but a path: the links touching it, and then the links those
  // reach — which is the question the diagram is actually asked. "Where do
  // this feed's columns end up" is two hops, and stopping at one leaves the
  // warehouse end of the answer dimmed out with everything else.
  //
  // The two hops are drawn differently. Direct links are the selection;
  // onward links are context, and they carry other sources' columns too,
  // so claiming them as part of the selection would overstate it.
  const op = (r, i) => {
    const base = r.side === "left" ? 0.5 : 0.34;
    if (!focus) return base;
    if (focus.primary.has(i)) return 0.72;
    if (focus.onward.has(i)) return 0.26;
    return 0.05;
  };
  const arcOp = (a, i) => {
    if (!focus) return 0.85;
    return focus.arcs.has(i) ? 0.95 : 0.06;
  };
  const nodeOp = (n) => (!focus ? 1 : focus.nodes.has(n.id) ? 1 : 0.2);
  const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);
  const toggle = (next) => setSel((cur) => (same(cur, next) ? null : next));

  return (
    <div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: W, display: "block" }}>
          {heads.map((h) => (
            <text key={h.x} x={h.x} y={13} fontSize="9" fontWeight="800"
              letterSpacing="0.6" fill={muted}
              style={{ textTransform: "uppercase" }}>{h.label}</text>))}
          {/* ribbons first, so the boxes sit on top of their own edges */}
          {ribbons.map((r, i) => (
            <path key={`r${i}`} d={r.d} stroke={r.c} strokeWidth={r.w}
              fill="none" opacity={op(r, i)} style={{ cursor: "pointer" }}
              onClick={() => toggle({ kind: "link", i })}>
              <title>{r.title}</title></path>))}
          {arcs.map((a, i) => (
            <path key={`a${i}`} d={a.d} stroke={a.c} strokeWidth={a.w}
              strokeDasharray="6 4" fill="none" opacity={arcOp(a, i)}
              style={{ cursor: "pointer" }}
              onClick={() => toggle({ kind: "arc", i })}>
              <title>{a.title}</title></path>))}
          {nodes.map((n) => {
            const on = focus && focus.selected === n.id;
            return (
              <g key={`${n.col}:${n.id}`} opacity={nodeOp(n)}
                style={{ cursor: "pointer" }}
                onClick={() => toggle({ kind: "node", id: n.id, col: n.col })}>
                <rect x={n.x} y={n.y} width={CW} height={n.h} rx="2"
                  fill={t.panel || "#fff"}
                  stroke={on ? n.c : (t.panel2 || "#dfe6e9")}
                  strokeWidth={on ? 2 : 1} />
                <rect x={n.x} y={n.y} width="3" height={n.h} fill={n.c} />
                <text x={n.x + 9} y={n.y + n.h / 2 - 1} fontSize="11"
                  fontWeight={on ? 700 : 500} fill={t.navy || "#10193b"}>{n.short}
                  <title>{n.label}</title></text>
                <text x={n.x + 9} y={n.y + n.h / 2 + 12} fontSize="9.5"
                  fill={muted}>{n.n} column{n.n === 1 ? "" : "s"}</text>
              </g>);
          })}
        </svg>
      </div>

      {focus
        ? <SelectionBar t={t} focus={focus} onClear={() => setSel(null)}
            onDrill={onDrill} onOpenTable={onOpenTable} />
        : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 11,
            alignItems: "center" }}>
            {verdicts.map((v) => (
              <span key={v.k} title={verdictShort(v.k)}
                onClick={onPickVerdict ? () => onPickVerdict(v.k) : undefined}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  fontSize: 10.5, color: t.sub || "#666",
                  cursor: onPickVerdict ? "pointer" : "default" }}>
                <i style={{ width: 11, height: 11, borderRadius: 2, background: vc(v.k) }} />
                {(VERDICT[v.k] || {}).t || v.k} — {v.n} of {v.of}</span>))}
            {model.bypassN > 0 && (
              <span title={VERDICT_INFO.NO_BASELINE?.short}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  fontSize: 10.5, color: t.sub || "#666" }}>
                <i style={{ width: 11, height: 3, background: "#b45309" }} />
                bypasses the contract (dashed) — {model.bypassN}</span>)}
            <span style={{ marginLeft: "auto", fontSize: 10.5, color: muted }}>
              click any box or ribbon to trace its path</span>
          </div>)}
    </div>);
}

// What a click selects, and what it lights up.
//
// THE TRAVERSAL IS THE FEATURE. Selecting a contract feed and seeing only
// the ribbons that touch it answers half a question. The other half —
// which warehouse tables those columns land in, or which SEI feeds they
// came from — is one more hop away, and it is the half people are actually
// asking for when they click.
//
// Returns null when nothing is selected, so the caller keeps its default
// rendering rather than branching on an empty set.
export function resolveFocus(model, sel) {
  if (!model || !sel) return null;
  const { ribbons, arcs } = model;
  const primary = new Set(), onward = new Set(), nodes = new Set();
  const arcSet = new Set();
  let path = null, selected = null, verdictSplit = new Map(), total = 0;

  const addRibbon = (i, into) => {
    into.add(i);
    nodes.add(ribbons[i].from); nodes.add(ribbons[i].to);
  };

  if (sel.kind === "link") {
    const r = ribbons[sel.i];
    if (!r) return null;
    addRibbon(sel.i, primary);
    total = r.n;
    if (r.verdict) verdictSplit.set(r.verdict, r.n);
    path = r.side === "left"
      ? { steps: [r.src, r.mid], kind: "left",
          filter: { sei_feed: r.src, feed: r.mid, verdict: r.verdict } }
      : { steps: [r.mid, r.tgt], kind: "right",
          filter: { feed: r.mid, table: r.tgt } };
    // one more hop, as context
    ribbons.forEach((o, i) => {
      if (i === sel.i) return;
      if (r.side === "left" && o.side === "right" && o.mid === r.mid) addRibbon(i, onward);
      if (r.side === "right" && o.side === "left" && o.mid === r.mid) addRibbon(i, onward);
    });
  } else if (sel.kind === "arc") {
    const a = arcs[sel.i];
    if (!a) return null;
    arcSet.add(sel.i);
    nodes.add(a.from); nodes.add(a.to);
    total = a.n;
    path = { steps: [a.src, a.tgt], kind: "bypass",
             filter: { sei_feed: a.src, table: a.tgt } };
  } else {
    selected = sel.id;
    nodes.add(sel.id);
    ribbons.forEach((r, i) => {
      const touches = (sel.col === "L" && r.side === "left" && r.src === sel.id)
        || (sel.col === "M" && r.mid === sel.id)
        || (sel.col === "R" && r.side === "right" && r.tgt === sel.id);
      if (touches) addRibbon(i, primary);
    });
    // second hop from whatever the primaries reached
    const reached = new Set(nodes);
    ribbons.forEach((r, i) => {
      if (primary.has(i)) return;
      if (reached.has(r.from) || reached.has(r.to)) addRibbon(i, onward);
    });
    arcs.forEach((a, i) => {
      if (a.from === sel.id || a.to === sel.id) {
        arcSet.add(i); nodes.add(a.from); nodes.add(a.to);
      }
    });
    primary.forEach((i) => {
      const r = ribbons[i];
      if (r.side === "left" || sel.col === "R") {
        total += r.n;
        if (r.verdict) verdictSplit.set(r.verdict, (verdictSplit.get(r.verdict) || 0) + r.n);
      }
    });
    // an R node has no left ribbons of its own, so its total comes from the
    // right ones; an M node would double-count if both sides were summed
    if (sel.col === "M") {
      total = 0; verdictSplit = new Map();
      primary.forEach((i) => {
        const r = ribbons[i];
        if (r.side !== "left") return;
        total += r.n;
        if (r.verdict) verdictSplit.set(r.verdict, (verdictSplit.get(r.verdict) || 0) + r.n);
      });
    }
    path = { steps: [sel.id], kind: `node:${sel.col}`,
             filter: sel.col === "L" ? { sei_feed: sel.id }
                   : sel.col === "M" ? { feed: sel.id }
                   : { table: sel.id },
             table: sel.col === "R" ? sel.id : null };
  }

  return { primary, onward, nodes, arcs: arcSet, selected, path, total,
           verdicts: [...verdictSplit.entries()]
             .sort((a, b) => b[1] - a[1])
             .map(([k, n]) => ({ k, n })) };
}

// The bar under the diagram when something is selected: the path in words,
// what it is made of, and the two things you would want to do next.
function SelectionBar({ t, focus, onClear, onDrill, onOpenTable }) {
  const { path, total, verdicts } = focus;
  const label = (path.steps || []).join("  →  ")
    + (path.kind === "bypass" ? "   (bypasses the contract)" : "");
  const title = `${label} · ${total} column${total === 1 ? "" : "s"}`;
  return (
    <div style={{ marginTop: 11, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderLeft: `3px solid ${t.accent || "#0f4775"}`, borderRadius: 4,
      background: "#f4f7f9", padding: "10px 13px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline",
        flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5,
          color: t.navy || "#10193b" }}>{label}</span>
        <b style={{ fontSize: 11.5 }}>{total} column{total === 1 ? "" : "s"}</b>
        <button type="button" onClick={onClear}
          style={{ marginLeft: "auto", background: "none", border: "none",
            padding: 0, font: "inherit", fontSize: 10.5, cursor: "pointer",
            color: t.muted || "#999", textDecoration: "underline" }}>clear</button>
      </div>
      {verdicts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 11, marginTop: 7 }}>
          {verdicts.map((v) => (
            <span key={v.k} title={verdictShort(v.k)}
              style={{ display: "flex", alignItems: "center", gap: 5,
                fontSize: 10.5, color: t.sub || "#666" }}>
              <i style={{ width: 10, height: 10, borderRadius: 2, background: vc(v.k) }} />
              {(VERDICT[v.k] || {}).t || v.k} <b>{v.n}</b></span>))}
        </div>)}
      <div style={{ display: "flex", gap: 14, marginTop: 9, flexWrap: "wrap" }}>
        {onDrill && (
          <button type="button" onClick={() => onDrill(path.filter, title)}
            style={linkBtn(t)}>open these columns →</button>)}
        {onOpenTable && path.table && (
          <button type="button" onClick={() => onOpenTable(path.table)}
            style={linkBtn(t)}>open {path.table} in lineage →</button>)}
      </div>
    </div>);
}

const linkBtn = (t) => ({ background: "none", border: "none", padding: 0,
  font: "inherit", fontSize: 11, cursor: "pointer",
  color: t.accent || "#0f4775", textDecoration: "underline" });

// Layout. Node height is proportional to its column count, with a floor so a
// one-column node stays clickable, and ribbons stack inside their node in
// verdict order so the bands read the same way everywhere.
// Exported for the render harness: both are pure, and the selection
// traversal is much easier to assert on directly than through a click.
export function buildFlowModel(flow) {
  const left = (flow && flow.left) || [];
  const right = (flow && flow.right) || [];
  const bypass = (flow && flow.bypass) || [];
  if (!left.length && !right.length) return null;

  const G = (o, ...k) => k.reduce((a, x) =>
    (a != null ? a : o?.[x] ?? o?.[x?.toUpperCase?.()] ?? o?.[x?.toLowerCase?.()]), null);
  const num = (x) => Number(x || 0);

  // THE MIDDLE NODE IS SIZED BY WHICHEVER SIDE IS BIGGER, NOT BY ITS INBOUND
  // LINKS. The two sides of a contract feed do not have to agree: the left
  // links come through a join to SEI_SOURCE_MAP that can drop or fan out,
  // the right links do not. Size the node from the inbound count alone and
  // a feed with more columns leaving than arriving has its outbound ribbons
  // stack straight out of the bottom of the box — which a render test caught
  // at 15 in against 21 out. Both stacks have to fit, so the node is as tall
  // as the larger of them.
  const L = new Map(), R = new Map(), Min = new Map(), Mout = new Map();
  const bump = (m, id, n) => m.set(id, (m.get(id) || 0) + n);
  left.forEach((r) => {
    bump(L, G(r, "src") || "no SEI source", num(G(r, "n")));
    bump(Min, G(r, "mid") || "unmapped", num(G(r, "n")));
  });
  right.forEach((r) => {
    bump(R, G(r, "tgt") || "(none)", num(G(r, "n")));
    bump(Mout, G(r, "mid") || "unmapped", num(G(r, "n")));
  });
  const M = new Map();
  new Set([...Min.keys(), ...Mout.keys()]).forEach((k) =>
    M.set(k, Math.max(Min.get(k) || 0, Mout.get(k) || 0)));

  const CW = 132, W = 760, x0 = 0, x1 = (W - CW) / 2, x2 = W - CW;
  const top = 30, gap = 9, minH = 26;
  const span = Math.max(...[L, M, R].map((m) =>
    [...m.values()].reduce((a, b) => a + b, 0)), 1);

  // THE CANVAS IS SIZED FROM THE LAYOUT, NOT THE OTHER WAY ROUND. A node's
  // height is its column count times a unit, but with a floor so a
  // one-column node stays readable and clickable — and those floors mean a
  // column of many small nodes lays out TALLER than count x unit predicts.
  // Deriving the height from `span` first and centring inside it spills the
  // tallest column off both ends of the canvas, which a render test caught
  // on a four-node left column. So: choose the unit, lay all three out, then
  // let the tallest one decide how tall the drawing is.
  const unit = Math.min(12, Math.max(3.5, 320 / span));
  const measure = (m) => {
    const k = m.size || 1;
    return [...m.values()].reduce((a, n) => a + Math.max(minH, n * unit), 0)
      + (k - 1) * gap;
  };
  const tallest = Math.max(240, measure(L), measure(M), measure(R));
  const H = top + tallest + 16;

  const lay = (m, x, col) => {
    const list = [...m.entries()].sort((a, b) => b[1] - a[1]);
    let y = top + Math.max(0, (tallest - measure(m)) / 2);
    const out = new Map();
    list.forEach(([id, n]) => {
      const h = Math.max(minH, n * unit);
      const inN = Min.get(id), outN = Mout.get(id);
      const mismatch = x === x1 && inN != null && outN != null && inN !== outN;
      out.set(id, { id, x, y, h, n, short: trunc(id, 17), col,
        label: mismatch ? `${id} — ${inN} columns arrive, ${outN} leave` : id,
        c: id === "no SEI source" ? vc("NO_SOURCE") : "#5f87a7" });
      y += h + gap;
    });
    return out;
  };
  const pl = lay(L, x0, "L"), pm = lay(M, x1, "M"), pr = lay(R, x2, "R");

  const offA = {}, offB = {}, offC = {}, offD = {};
  const curve = (ax, ay, bx, by) => {
    const d = (bx - ax) * 0.5;
    return `M ${ax} ${ay} C ${ax + d} ${ay}, ${bx - d} ${by}, ${bx} ${by}`;
  };
  const ribbons = [];

  // left links, verdict-ordered so the bands stack identically everywhere
  const ord = (v) => { const i = VERDICT_ORDER.indexOf(v); return i < 0 ? 99 : i; };
  [...left].sort((a, b) => ord(G(a, "verdict")) - ord(G(b, "verdict")))
    .forEach((r) => {
      const a = pl.get(G(r, "src") || "no SEI source");
      const b = pm.get(G(r, "mid") || "unmapped");
      if (!a || !b) return;
      const n = num(G(r, "n")), w = Math.max(1.5, n * unit);
      const ay = a.y + (offA[a.id] = offA[a.id] || 0) + w / 2; offA[a.id] += w;
      const by = b.y + (offB[b.id] = offB[b.id] || 0) + w / 2; offB[b.id] += w;
      const v = G(r, "verdict") || "UNKNOWN";
      ribbons.push({ side: "left", c: vc(v), w, n, verdict: v,
        from: a.id, to: b.id, src: a.id, mid: b.id,
        d: curve(a.x + CW, ay, b.x, by),
        title: `${a.label} → ${b.label} · ${(VERDICT[v] || {}).t || v} · ${n} columns` });
    });

  right.forEach((r) => {
    const a = pm.get(G(r, "mid") || "unmapped");
    const b = pr.get(G(r, "tgt") || "(none)");
    if (!a || !b) return;
    const n = num(G(r, "n")), w = Math.max(1.5, n * unit);
    const ay = a.y + (offC[a.id] = offC[a.id] || 0) + w / 2; offC[a.id] += w;
    const by = b.y + (offD[b.id] = offD[b.id] || 0) + w / 2; offD[b.id] += w;
    ribbons.push({ side: "right", c: "#5f87a7", w, n,
      from: a.id, to: b.id, mid: a.id, tgt: b.id,
      d: curve(a.x + CW, ay, b.x, by),
      title: `${a.label} → ${b.label} · ${n} columns` });
  });

  // The bypass arcs, over the middle column rather than through it.
  const arcs = [];
  let bypassN = 0;
  bypass.forEach((r) => {
    const a = pl.get(G(r, "src")) || [...pl.values()][0];
    const b = pr.get(G(r, "tgt"));
    if (!a || !b) return;
    const n = num(G(r, "n")); bypassN += n;
    const w = Math.max(2, n * unit);
    const ay = a.y + a.h / 2, by = b.y + b.h / 2;
    arcs.push({ c: "#b45309", w, n, from: a.id, to: b.id, src: a.id, tgt: b.id,
      d: `M ${a.x + CW} ${ay} C ${x1} ${ay - 40}, ${x2 - 40} ${by - 16}, ${x2} ${by}`,
      title: `${a.label} → ${b.label} · bypasses the contract · ${n} columns` });
  });

  const byV = new Map();
  left.forEach((r) => byV.set(G(r, "verdict") || "UNKNOWN",
    (byV.get(G(r, "verdict") || "UNKNOWN") || 0) + num(G(r, "n"))));
  const ofAll = [...byV.values()].reduce((a, b) => a + b, 0);
  const verdicts = [...byV.entries()]
    .sort((a, b) => ord(a[0]) - ord(b[0]))
    .map(([k, n]) => ({ k, n, of: ofAll }));

  return { W, H, CW,
    nodes: [...pl.values(), ...pm.values(), ...pr.values()],
    ribbons, arcs, bypassN, verdicts,
    heads: [{ x: x0, label: "SEI datapoint source" },
            { x: x1, label: "Contract feed" },
            { x: x2, label: "Warehouse table" }] };
}

const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// ================================================================== evidence
// Why nothing is proven. Four or five rows, each a different artefact held by
// a different team — which is the reason it is not one bar. Told as one
// number the work looks like one task; it is several, and they run in
// parallel.
export function EvidencePanel({ t, ev }) {
  const rows = (ev && ev.rows) || [];
  if (!rows.length) return null;
  const col = (s) => (s === "ok" ? "#159943" : s === "partial" ? "#e67e22" : "#c1113a");
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.key} style={{ borderTop: i ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none",
          padding: i ? "13px 0 0" : "0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10,
            flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label}</span>
            <b style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11,
              color: col(r.state) }}>
              {r.have} of {r.of} {r.unit}</b>
          </div>
          <div style={{ height: 5, background: "#e8edf2", borderRadius: 3 }}>
            <i style={{ display: "block", height: "100%", borderRadius: 3,
              width: `${Math.max(r.pct, r.have ? 2 : 0)}%`, background: col(r.state) }} />
          </div>
          <p style={{ margin: "7px 0 0", fontSize: 11, lineHeight: 1.6,
            color: t.sub || "#666", maxWidth: "74ch" }}>{r.detail}</p>
          <p style={{ margin: "4px 0 10px", fontSize: 10.5, lineHeight: 1.6,
            color: t.muted || "#999", maxWidth: "74ch" }}>
            <b style={{ color: t.sub || "#666" }}>Clears with</b> {r.clears}</p>
        </div>))}
    </div>);
}

// ==================================================================== waffle
// One cell per final column, grouped by table, in the table's own column
// order. A contiguous run is one coherent gap with one owner; the same count
// scattered is many small ones. Only the arrangement tells them apart, which
// is why the cells are not sorted by verdict.
export function Waffle({ t, waffle, onPickColumn }) {
  const tables = (waffle && waffle.tables) || [];
  if (!tables.length) return null;
  const seen = new Map();
  tables.forEach((tb) => (tb.cells || []).forEach((c) =>
    seen.set(c.v, (seen.get(c.v) || 0) + 1)));
  const order = VERDICT_ORDER.filter((v) => seen.has(v));
  return (
    <div>
      {tables.map((tb) => (
        <div key={`${tb.table}:${tb.lane}`} style={{ marginBottom: 11 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8,
            marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 11,
              color: t.navy || "#10193b" }}>{tb.table}</span>
            <span style={{ fontSize: 9.5, color: t.muted || "#999" }}>
              {tb.lane} · {(tb.cells || []).length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {(tb.cells || []).map((c, i) => (
              <i key={i} title={`${c.c} — ${verdictShort(c.v)}`}
                onClick={onPickColumn ? () => onPickColumn(tb.table, c.c) : undefined}
                style={{ width: 13, height: 13, borderRadius: 2,
                  background: vc(c.v),
                  cursor: onPickColumn ? "pointer" : "default" }} />))}
          </div>
        </div>))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 13 }}>
        {order.map((v) => (
          <span key={v} title={verdictShort(v)}
            style={{ display: "flex", alignItems: "center", gap: 6,
              fontSize: 10.5, color: t.sub || "#666" }}>
            <i style={{ width: 11, height: 11, borderRadius: 2, background: vc(v) }} />
            {(VERDICT[v] || {}).t || v} <b>{seen.get(v)}</b></span>))}
      </div>
    </div>);
}

export default FlowDiagram;
