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

import React, { useMemo, useState, useEffect, useRef } from "react";
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
export function FlowDiagram({ t, flow, onPickVerdict, onDrill, onOpenTable,
                              nameOf }) {
  const [sel, setSel] = useState(null);
  const [full, setFull] = useState(false);
  const box = useRef(null);
  const [wide, setWide] = useState(0);

  // Measure the container rather than assume 760. A ResizeObserver catches
  // the panel widening, the window resizing and the full-screen toggle with
  // one mechanism; the initial read happens on mount because the observer
  // fires after first paint and a one-frame 760px flash is visible.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setWide(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const model = useMemo(() => buildFlowModel(flow, {
    width: wide ? wide - 2 : undefined,
    // In full screen the drawing fills the viewport minus the header and the
    // selection bar. Inline it keeps sizing itself from the data, because a
    // panel that grows to 900px tall pushes everything below it off-screen.
    height: full ? Math.max(360, vh - 190) : undefined,
    nameOf,
  }), [flow, wide, full, vh, nameOf]);
  const focus = useMemo(() => resolveFocus(model, sel), [model, sel]);
  const muted = t.muted || "#999";
  if (!model) return <div ref={box} />;
  const { W, H, CW, nodes, ribbons, arcs, heads, verdicts } = model;

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
    // Same reason the column graph's floor went up: 0.05 against white is
    // gone, and a ribbon you cannot see is one you cannot click.
    return 0.13;
  };
  const arcOp = (a, i) => {
    if (!focus) return 0.85;
    return focus.arcs.has(i) ? 0.95 : 0.14;
  };
  const nodeOp = (n) => (!focus ? 1 : focus.nodes.has(n.id) ? 1 : 0.38);
  const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);
  const toggle = (next) => setSel((cur) => (same(cur, next) ? null : next));

  const inner = (
    <>
      {!full && (
        <div style={{ display: "flex", justifyContent: "flex-end",
          marginBottom: 6 }}>
          <button type="button" onClick={() => setFull(true)} style={{
            background: "none", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
            borderRadius: 3, padding: "3px 10px", font: "inherit",
            fontSize: 10.5, cursor: "pointer",
            color: t.accent || "#0f4775" }}>⤢ full screen</button>
        </div>)}
      <div ref={box} style={{ overflowX: "auto", paddingBottom: 4 }}>
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
                {/* The code keeps its place under the name rather than
                    replacing it — people search on PEDDIFI1 and talk
                    about the portfolio valuation, and the screen has to
                    carry both or it breaks one of those habits. */}
                <text x={n.x + 9} y={n.y + n.h / 2 + 12} fontSize="9.5"
                  fill={muted}>
                  {n.code ? <tspan fontFamily={MONO}>{n.code} · </tspan> : null}
                  {n.n} column{n.n === 1 ? "" : "s"}</text>
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
    </>);

  if (!full) return <div>{inner}</div>;

  // Full screen is a fixed overlay rather than a route, so the selection,
  // the measured width and everything else survive the toggle — you come
  // back to the same picture you left, not a reset one.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000,
      background: t.bg || "#f5f8f8", display: "flex", flexDirection: "column",
      padding: "14px 18px 16px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12,
        marginBottom: 10, flexShrink: 0 }}>
        <b style={{ fontSize: 14.5, color: t.navy || "#10193b" }}>
          Where every column comes from</b>
        <span style={{ fontSize: 10.5, color: muted }}>
          ribbon width is columns · click any box or ribbon to trace its path</span>
        <button type="button" onClick={() => setFull(false)} style={{
          marginLeft: "auto", background: "none",
          border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
          padding: "3px 10px", font: "inherit", fontSize: 10.5,
          cursor: "pointer", color: t.accent || "#0f4775" }}>
          ✕ close  ·  Esc</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto",
        background: t.panel || "#fff", borderRadius: 6,
        border: `1px solid ${t.panel2 || "#dfe6e9"}`, padding: "10px 14px 14px" }}>
        {inner}
      </div>
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
export function buildFlowModel(flow, opt = {}) {
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

  // THE CANVAS TAKES THE WIDTH IT IS GIVEN. It was fixed at 760 with a
  // 132px node box, which truncated "HOLDINGDBO.POSITION_HIST" to
  // "HOLDINGDBO.POSIT..." on a 2000px screen with most of the panel empty.
  // Width comes from a measurement of the container now, and the node box
  // and its label length are derived from it rather than guessed.
  const W = Math.max(720, Math.round(opt.width || 760));
  const CW = Math.max(132, Math.min(260, Math.round(W * 0.19)));
  const x0 = 0, x1 = (W - CW) / 2, x2 = W - CW;
  const top = 30, gap = 9, minH = 28;
  // 11px Roboto averages a shade over 6px a character; leave the 9px inset
  // at both ends. Being one character conservative costs an ellipsis on a
  // name that would just have fitted, which is cheaper than a name that
  // overruns its box.
  const chars = Math.max(12, Math.floor((CW - 20) / 6.2));
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
  const measureWith = (m, u) => {
    const k = m.size || 1;
    return [...m.values()].reduce((a, n) => a + Math.max(minH, n * u), 0)
      + (k - 1) * gap;
  };
  const tallestWith = (u) => Math.max(measureWith(L, u), measureWith(M, u),
                                      measureWith(R, u));
  let unit;
  if (opt.height) {
    // Fill the space available. The relation between unit and laid-out
    // height is monotonic but not linear — the minH floors flatten it — so
    // bisect rather than solve. Thirty steps is exact to well under a pixel.
    const target = opt.height - top - 16;
    let lo = 1, hi = 60;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (tallestWith(mid) <= target) lo = mid; else hi = mid;
    }
    unit = lo;
  } else {
    unit = Math.min(14, Math.max(4, 380 / span));
  }
  const measure = (m) => measureWith(m, unit);
  const tallest = Math.max(240, tallestWith(unit));
  const H = top + tallest + 16;

  // ORDER THE COLUMNS TO UNCROSS THE RIBBONS. Sorting every column by size
  // descending is the worst case for a Sankey: the biggest source and the
  // biggest target both sit at the top whether or not they are connected,
  // so every link between a big node and a small one crosses the width of
  // the picture. With eight sources and seven tables that is a hairball,
  // and the screenshot of the real data was exactly that.
  //
  // The standard fix, and a cheap one: sort each column by the average
  // position of the nodes it connects to, sweeping right then left a few
  // times. Size order is only the starting point.
  const order = uncross(L, M, R, left, right, G, num);
  const nameOf = typeof opt.nameOf === "function" ? opt.nameOf : null;

  const lay = (m, x, col, ids) => {
    let y = top + Math.max(0, (tallest - measure(m)) / 2);
    const out = new Map();
    ids.forEach((id) => {
      const n = m.get(id) || 0;
      const h = Math.max(minH, n * unit);
      const inN = Min.get(id), outN = Mout.get(id);
      const mismatch = col === "M" && inN != null && outN != null && inN !== outN;
      // The business name leads where there is one. A middle column of
      // PEDDIFI1 / TBMEIFI7 / ACDDIFI1 is unreadable to anyone who does
      // not already know the estate — which is most of the people this
      // diagram exists for.
      const bn = nameOf ? nameOf(id) : null;
      out.set(id, { id, x, y, h, n, col, code: bn ? id : null,
        short: trunc(bn || id, chars),
        label: (bn ? `${bn} · ${id}` : id)
               + (mismatch ? ` — ${inN} columns arrive, ${outN} leave` : ""),
        c: id === "no SEI source" ? vc("NO_SOURCE") : "#5f87a7" });
      y += h + gap;
    });
    return out;
  };
  const pl = lay(L, x0, "L", order.L), pm = lay(M, x1, "M", order.M),
        pr = lay(R, x2, "R", order.R);

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

// Barycentre ordering — the standard Sankey de-tangler, four sweeps of it.
//
// Each node moves to the weighted average position of the nodes it connects
// to in the column just settled, then that column is re-sorted. Sweep right,
// sweep left, repeat. It is not optimal — minimising crossings exactly is
// NP-hard — but two round trips take a hairball down to something readable,
// and it is deterministic, so the picture does not reshuffle between loads.
//
// Size order seeds it, and a node with no links keeps its seeded position
// rather than collapsing to zero and jumping to the top.
export function uncross(L, M, R, left, right, G, num) {
  const bySize = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  let oL = bySize(L), oM = bySize(M), oR = bySize(R);

  const edges = (rows, from, to) => rows.map((r) => ({
    a: G(r, from) || (from === "src" ? "no SEI source" : "unmapped"),
    b: G(r, to) || (to === "tgt" ? "(none)" : "unmapped"),
    w: num(G(r, "n")) || 1 }));
  const lm = edges(left, "src", "mid");
  const mr = edges(right, "mid", "tgt");

  // move `target` to follow `anchor`, using edges keyed a=anchor side
  const sweep = (targetOrder, anchorOrder, es, targetIsB) => {
    const pos = new Map(anchorOrder.map((id, i) => [id, i]));
    const acc = new Map();
    es.forEach((e) => {
      const tId = targetIsB ? e.b : e.a;
      const aId = targetIsB ? e.a : e.b;
      const p = pos.get(aId);
      if (p == null) return;
      const cur = acc.get(tId) || { s: 0, w: 0 };
      cur.s += p * e.w; cur.w += e.w;
      acc.set(tId, cur);
    });
    const seed = new Map(targetOrder.map((id, i) => [id, i]));
    return [...targetOrder].sort((x, y) => {
      const bx = acc.get(x), by = acc.get(y);
      const kx = bx && bx.w ? bx.s / bx.w : seed.get(x);
      const ky = by && by.w ? by.s / by.w : seed.get(y);
      return kx - ky || seed.get(x) - seed.get(y);
    });
  };

  for (let i = 0; i < 2; i++) {
    oM = sweep(oM, oL, lm, true);    // M follows L
    oR = sweep(oR, oM, mr, true);    // R follows M
    oM = sweep(oM, oR, mr, false);   // M follows R
    oL = sweep(oL, oM, lm, false);   // L follows M
  }
  return { L: oL, M: oM, R: oR };
}

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

// =========================================================== transformation
// Does the SEI rule COMPUTE the same value?
//
// A LATER QUESTION THAN EVERY OTHER PANEL ASKS, and the one that survives
// all of them. A column can pass the format check completely — same type,
// same length, same scale, both sides from live DDL — and still be wrong,
// because the legacy rule sums at lot grain and the proposed rule sums at
// position grain. That is a wrong number rather than a missing one, and
// none of the nine verdicts can express it: they compare shapes.
//
// Equivalence and approval are two axes, never merged. Equivalence is a
// finding about the logic; approval is a finding about who has looked at
// it. An EXACT_TEXT match still marked DRAFT_REVIEW_REQUIRED is not ready
// to ship, and one combined status column would have said it was.
const EQ_C = {
  EXACT_TEXT: "#159943",
  UNVERIFIED_COMPARISON: "#6b7c8a",
  SEI_SOURCE_IDENTIFIED_LOGIC_INCOMPLETE: "#e67e22",
  LEGACY_LOGIC_NOT_DOCUMENTED: "#b45309",
  REQUIRES_BUSINESS_DECISION: "#7c3aed",
  NO_SEI_SOURCE: "#c1113a",
};
export const EQ_MEANING = {
  EXACT_TEXT: "The two expressions are character-for-character the same. The "
    + "strongest signal available, and still not an approval.",
  UNVERIFIED_COMPARISON: "Both sides are documented and nobody has compared "
    + "them. Not a disagreement — an unexamined pair.",
  SEI_SOURCE_IDENTIFIED_LOGIC_INCOMPLETE: "The SEI source objects and fields "
    + "are known; the rule that turns them into the value is not written down.",
  LEGACY_LOGIC_NOT_DOCUMENTED: "Nothing records what the incumbent does "
    + "today, so there is no baseline to compare against.",
  REQUIRES_BUSINESS_DECISION: "The two rules differ in a way only the "
    + "business can settle — a grain, a basis, a convention.",
  NO_SEI_SOURCE: "No SEI logic is proposed at all. The column computes "
    + "nothing on the new side.",
};
const eqc = (k) => EQ_C[k] || "#5f87a7";

export function TransformationPanel({ t, xf, onOpenColumn }) {
  if (!xf || !xf.total) return null;
  const muted = t.muted || "#999";
  const sum = (a) => a.reduce((n, x) => n + (x.n || 0), 0) || 1;
  const eqTotal = sum(xf.equivalence || []);
  return (
    <div>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap",
        marginBottom: 13, alignItems: "baseline" }}>
        <span><b style={{ fontSize: 22, color: xf.approved ? "#159943" : "#c1113a",
          fontVariantNumeric: "tabular-nums" }}>{xf.approved}</b>
          <span style={{ fontSize: 11.5, color: muted }}> of {xf.total} approved</span></span>
        <span><b style={{ fontSize: 16, color: "#159943" }}>{xf.exact_text}</b>
          <span style={{ fontSize: 11, color: muted }}> exact text</span></span>
        <span><b style={{ fontSize: 16, color: "#c1113a" }}>{xf.no_sei_source}</b>
          <span style={{ fontSize: 11, color: muted }}> with no SEI logic</span></span>
      </div>

      <span style={{ display: "flex", height: 16, borderRadius: 3,
        overflow: "hidden", background: "#e8edf2" }}>
        {(xf.equivalence || []).map((e) => (
          <i key={e.equivalence} title={`${e.equivalence} — ${e.n}`}
            style={{ display: "block", width: `${(e.n / eqTotal) * 100}%`,
              background: eqc(e.equivalence) }} />))}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 10 }}>
        {(xf.equivalence || []).map((e) => (
          <span key={e.equivalence} title={EQ_MEANING[e.equivalence] || ""}
            style={{ display: "flex", alignItems: "center", gap: 6,
              fontSize: 10.5, color: t.sub || "#666" }}>
            <i style={{ width: 11, height: 11, borderRadius: 2,
              background: eqc(e.equivalence) }} />
            {String(e.equivalence).replace(/_/g, " ").toLowerCase()} <b>{e.n}</b></span>))}
      </div>

      {/* Approval is its own row, never folded into the bar above. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 11,
        paddingTop: 10, borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}` }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4,
          textTransform: "uppercase", color: muted }}>Approval</span>
        {(xf.approval || []).map((a) => (
          <span key={a.approval_status} style={{ fontSize: 10.5,
            color: t.sub || "#666" }}>
            {String(a.approval_status).replace(/_/g, " ").toLowerCase()} <b>{a.n}</b></span>))}
      </div>

      {(xf.rows || []).length > 0 && (
        <div style={{ marginTop: 13, maxHeight: 320, overflowY: "auto",
          border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse",
            fontSize: 11 }}>
            <tbody>
              {xf.rows.map((r) => (
                <tr key={r.comparison_id}
                  onClick={onOpenColumn
                    ? () => onOpenColumn(r.target_object, r.target_attribute)
                    : undefined}
                  style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
                    cursor: onOpenColumn ? "pointer" : "default" }}>
                  <td style={{ padding: "6px 10px", fontFamily: MONO,
                    whiteSpace: "nowrap" }}>{r.target_attribute}</td>
                  <td style={{ padding: "6px 10px", color: muted,
                    fontSize: 10, whiteSpace: "nowrap" }}>{r.target_object}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <span title={EQ_MEANING[r.equivalence] || ""}
                      style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                        padding: "2px 7px", borderRadius: 999,
                        whiteSpace: "nowrap",
                        background: `${eqc(r.equivalence)}22`,
                        color: eqc(r.equivalence) }}>
                      {String(r.equivalence || "?").replace(/_/g, " ")}</span></td>
                  <td style={{ padding: "6px 10px", color: t.sub || "#666",
                    fontSize: 10.5 }}>{r.review_note || ""}</td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>);
}

// The two expressions side by side on a column page. Not a text diff — the
// point is not which characters changed but whether the same value comes
// out, and a character diff of two differently-written equivalent rules is
// noise dressed as a finding.
export function LogicCompare({ t, xf, cmp }) {
  const a = (xf && xf[0]) || {};
  const c = (cmp && cmp[0]) || {};
  const legacy = a.legacy_logic || c.imds_logic;
  const sei = a.sei_logic || c.sei_logic;
  if (!legacy && !sei) return null;
  const eq = a.transformation_equivalence || c.equivalence;
  const appr = a.transformation_approval || c.approval_status;
  const cell = (label, body, kind, side) => (
    <div style={{ flex: 1, minWidth: 230 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
        textTransform: "uppercase", color: t.muted || "#999", marginBottom: 5 }}>
        {label}{kind ? ` · ${String(kind).replace(/_/g, " ").toLowerCase()}` : ""}</div>
      <pre style={{ margin: 0, fontFamily: MONO, fontSize: 10.5,
        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
        background: side === "sei" ? "#eef6fb" : "#f5f7f8",
        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
        padding: "8px 10px", color: t.navy || "#10193b" }}>
        {body || "— not documented —"}</pre>
    </div>);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline",
        flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>Transformation</span>
        {eq && <span title={EQ_MEANING[eq] || ""}
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
            padding: "2px 8px", borderRadius: 999,
            background: `${eqc(eq)}22`, color: eqc(eq) }}>
          {String(eq).replace(/_/g, " ")}</span>}
        {appr && <span style={{ fontSize: 10, color: t.muted || "#999" }}>
          {String(appr).replace(/_/g, " ").toLowerCase()}</span>}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {cell("Legacy · STAR → IMDS", legacy, a.legacy_kind, "legacy")}
        {cell("Proposed · SEI → IMDS", sei, a.sei_kind, "sei")}
      </div>
      {(c.review_note || a.sei_source_objects) && (
        <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 7,
          lineHeight: 1.6 }}>
          {c.review_note && <div><b>Difference</b> {c.review_note}</div>}
          {a.sei_source_objects && <div style={{ color: t.muted || "#999" }}>
            SEI source {a.sei_source_objects}
            {a.sei_source_fields ? ` · ${a.sei_source_fields}` : ""}</div>}
        </div>)}
    </div>);
}
