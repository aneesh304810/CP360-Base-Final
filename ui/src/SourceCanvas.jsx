// Where a feed lands, column by column — and which of those columns have
// a transformation.
//
// This replaces the Source view's "where it lands" list, which gave a
// percentage mapped per target table. That says how many columns arrive
// and nothing about what happens to them, and a column carried across
// untouched and a column assembled from a branch over two feeds are very
// different risks wearing the same badge.
//
// EXPANSION IS THE MECHANIC. A node is a table when closed and a list of
// columns when open, and a link attaches to the column row when its side
// is open and to the node's own edge when it is not. So a closed table
// shows one thick wire carrying nine columns with a 9 on it, and opening
// both ends refines the same picture into nine wires. The reader chooses
// the altitude; nothing is hidden at either setting.
//
// THE TRANSFORMATION IS VISIBLE AT EVERY ALTITUDE, which is the whole
// point of the screen:
//
//   closed table   a stacked mix bar — how much of this table is computed
//   open column    a chip naming the operation, and step pips for depth
//   the wire       coloured by operation, so a feed that carries
//                  everything untouched looks different from one that
//                  computes half of it, before anything is opened
//   selected       the expression as written, and its operations in order
//
// All four read one classifier, which reads the same parser the operator
// graph draws from, so the chip cannot say `trim` while the graph draws a
// branch.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { crosswalkApi } from "./seiCrosswalkApi.js";
import { classifyLink, summarise, OP_META, OP_ORDER } from "./linkOps.js";
import { buildRuleGraph } from "./ruleGraph.js";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const SRC_C = "#6d3ac0", DWH_C = "#0f4775";
const NW = 272, HEAD = 40, ROW = 22, GAPY = 14, PAD = 20, COLGAP = 226;
// A feed with 53 fields across four tables is a long scroll fully open.
// Cap the rows and say what was capped, rather than truncating in silence.
const CAP = 15;

export default function SourceCanvas({ t, srcTable, dataSource, feedName,
                                       onOpenTarget }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [showAll, setShowAll] = useState(() => new Set());
  const [sel, setSel] = useState(null);       // {table, col}
  const [q, setQ] = useState("");
  const [onlyX, setOnlyX] = useState(false);  // only transformed
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const box = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (!srcTable) { setData(null); return; }
    let live = true;
    setData(null); setSel(null); setOpen(new Set()); setShowAll(new Set());
    crosswalkApi.sourceCanvas(srcTable, dataSource).then((r) => {
      if (!live) return;
      setData(r);
      // Open at a state that shows what the screen does. A closed canvas
      // is the old list with extra steps.
      const first = (r.targets || [])[0];
      if (first) setOpen(new Set([`t:${first.table}`]));
    });
    return () => { live = false; };
  }, [srcTable, dataSource]);

  // classify once per load — every surface reads the result
  const targets = useMemo(() => {
    if (!data) return [];
    return (data.targets || []).map((tg) => {
      const cols = (tg.cols || []).map((c) => ({ ...c, __op: classifyLink(c) }));
      return { ...tg, cols, sum: summarise(cols) };
    });
  }, [data]);

  const hit = (c) => {
    if (onlyX && !c.__op.transformed) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return `${c.col} ${c.src || ""}`.toLowerCase().includes(s);
  };

  const srcCols = useMemo(() => {
    const m = new Map();
    targets.forEach((tg) => tg.cols.forEach((c) => {
      if (!c.src) return;
      const e = m.get(c.src) || { name: c.src, n: 0, x: 0 };
      e.n++; if (c.__op.transformed) e.x++;
      m.set(c.src, e);
    }));
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [targets]);

  const view = useMemo(() => {
    const sOpen = open.has("src");
    const sRows = sOpen ? Math.min(srcCols.length, showAll.has("src")
      ? srcCols.length : CAP) : 0;
    const sh = HEAD + (sOpen ? sRows * ROW + (sRows < srcCols.length ? ROW : 0) + 1 : 0);
    const tg = targets.map((tb) => {
      const o = open.has(`t:${tb.table}`);
      const shown = o ? tb.cols.filter(hit) : [];
      const n = showAll.has(`t:${tb.table}`) ? shown.length : Math.min(shown.length, CAP);
      return { tb, open: o, shown, n,
               h: HEAD + (o ? n * ROW + (n < shown.length ? ROW : 0) + 1 : 0) };
    });
    const totalT = tg.reduce((a, b) => a + b.h, 0) + Math.max(0, tg.length - 1) * GAPY;
    const H = Math.max(sh, totalT, 120) + PAD * 2;
    const src = { x: PAD, y: PAD + (H - PAD * 2 - sh) / 2, w: NW, h: sh,
                  open: sOpen, rows: sRows };
    let y = PAD + (H - PAD * 2 - totalT) / 2;
    tg.forEach((n) => { n.x = PAD + NW + COLGAP; n.y = y; n.w = NW; y += n.h + GAPY; });
    return { src, tg, W: PAD * 2 + NW * 2 + COLGAP, H };
  }, [targets, open, showAll, q, onlyX, srcCols]);   // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    const el = box.current;
    if (!el || !view.W) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0.35, Math.min((r.width - 20) / view.W,
                                      (r.height - 20) / view.H, 1.1));
    setZ({ k, x: (r.width - view.W * k) / 2, y: (r.height - view.H * k) / 2 });
  };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view.W, view.H]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return <div style={{ padding: 24, fontSize: 12, color: t.muted || "#999" }}>
      Loading where this feed lands…</div>;
  }
  if (!targets.length) {
    return <div style={{ padding: 20, fontSize: 12, color: t.sub || "#666" }}>
      No warehouse column records this feed as its source.</div>;
  }

  // ---- anchors: the mechanic ---------------------------------------------
  const anchorSrc = (name) => {
    if (view.src.open) {
      const i = srcCols.findIndex((s) => s.name === name);
      if (i >= 0 && i < view.src.rows) {
        return { x: view.src.x + NW, y: view.src.y + HEAD + 1 + i * ROW + ROW / 2 };
      }
    }
    return { x: view.src.x + NW, y: view.src.y + HEAD / 2 };
  };
  const anchorTgt = (table, col) => {
    const n = view.tg.find((x) => x.tb.table === table);
    if (!n) return null;
    if (n.open) {
      const i = n.shown.findIndex((c) => c.col === col);
      if (i >= 0 && i < n.n) return { x: n.x, y: n.y + HEAD + 1 + i * ROW + ROW / 2 };
    }
    return { x: n.x, y: n.y + HEAD / 2 };
  };

  const wires = [];
  const merged = new Map();
  targets.forEach((tg) => tg.cols.forEach((c) => {
    // No source field means nothing feeds this column -- a constant, or
    // nothing at all. A wire back to the feed would contradict the row's own
    // "no source" chip, and would inflate the count on a merged wire. The row
    // is clickable on its own, so the detail stays one click away.
    if (!c.src) return;
    const a = anchorSrc(c.src), b = anchorTgt(tg.table, c.col);
    if (!a || !b) return;
    const k = `${a.y}>${b.y}`;
    if (!merged.has(k)) merged.set(k, { a, b, items: [] });
    merged.get(k).items.push({ ...c, table: tg.table });
  }));
  merged.forEach((m) => wires.push(m));

  const total = summarise(targets.flatMap((tg) => tg.cols));
  const selected = sel && targets.find((x) => x.table === sel.table)
    ?.cols.find((c) => c.col === sel.col);

  // ---- chrome -------------------------------------------------------------
  const ghost = { font: "inherit", fontSize: 10.5, padding: "3px 10px",
    borderRadius: 3, cursor: "pointer", background: t.panel || "#fff",
    border: `1px solid ${t.panel2 || "#dfe6e9"}`, color: t.accent || "#0f4775" };
  const eyebrow = { fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
    textTransform: "uppercase", color: t.muted || "#999" };

  const MixBar = ({ sum, w = 100 }) => (
    <span title={sum.mix.map((m) => `${m.n} ${m.op}`).join(" · ")}
      style={{ display: "flex", width: w, height: 5, borderRadius: 3,
        overflow: "hidden", background: "#e8edf2", flexShrink: 0 }}>
      {sum.mix.map((m) => (
        <i key={m.op} style={{ display: "block", background: OP_META[m.op].c,
          width: `${(m.n / Math.max(1, sum.total)) * 100}%` }} />))}
    </span>);

  const Pips = ({ n }) => (
    <span title={`${n} operation${n === 1 ? "" : "s"} between source and target`}
      style={{ display: "flex", gap: 1.5, flexShrink: 0 }}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} style={{ width: 3, height: 3, borderRadius: "50%",
          background: i < Math.min(n, 4) ? (t.sub || "#666") : "#d7dee4" }} />))}
      {n > 4 && <b style={{ fontSize: 7.5, color: t.muted || "#999",
        marginLeft: 1 }}>+{n - 4}</b>}
    </span>);

  const colRow = (c, table) => {
    const on = sel && sel.table === table && sel.col === c.col;
    const meta = OP_META[c.__op.op];
    return (
      <button key={c.col} type="button" data-node
        onClick={() => setSel(on ? null : { table, col: c.col })}
        title={`${c.src || "no source"} → ${c.col}\n${meta.note}`}
        style={{ display: "flex", gap: 6, alignItems: "center", width: "100%",
          textAlign: "left", font: "inherit", cursor: "pointer", color: "inherit",
          background: on ? "rgba(15,71,117,.12)" : "none", border: 0,
          borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
          padding: "3px 8px 3px 10px", height: ROW }}>
        <i style={{ width: 6, height: 6, borderRadius: 1.5, flexShrink: 0,
          background: meta.c }} />
        <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: on ? 700 : 400 }}>{c.col}</span>
        {c.__op.steps > 0 && <Pips n={c.__op.steps} />}
        <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.3,
          textTransform: "uppercase", color: meta.c, flexShrink: 0 }}>
          {meta.label}</span>
      </button>);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center",
        flexWrap: "wrap", marginBottom: 9 }}>
        <span style={eyebrow}>Where it lands</span>
        <span style={{ fontSize: 10.5, color: t.sub || "#666" }}>
          {targets.length} table{targets.length === 1 ? "" : "s"} ·{" "}
          {total.total} column link{total.total === 1 ? "" : "s"} ·{" "}
          <b style={{ color: total.transformed ? "#e67e22" : (t.ok || "#159943") }}>
            {total.transformed} transformed</b>
          {total.branchy ? ` · ${total.branchy} branch or join` : ""}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
          placeholder="Find a column…" aria-label="Find a column"
          style={{ font: "inherit", fontSize: 11, padding: "4px 9px", width: 150,
            border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
            background: t.panel || "#fff", color: t.navy || "#10193b" }} />
        <button type="button" onClick={() => setOnlyX((v) => !v)}
          style={{ ...ghost, ...(onlyX ? { background: "#e67e22",
            borderColor: "#e67e22", color: "#fff" } : {}) }}>
          only transformed</button>
        <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          <button type="button" style={ghost} onClick={() => setOpen(
            new Set(["src", ...targets.map((x) => `t:${x.table}`)]))}>open all</button>
          <button type="button" style={ghost}
            onClick={() => setOpen(new Set())}>close all</button>
          <button type="button" style={ghost} onClick={fit}>fit</button>
        </span>
      </div>

      <div ref={box}
        onPointerDown={(e) => {
          if (e.target.closest("[data-node]")) return;
          drag.current = { x: e.clientX - z.x, y: e.clientY - z.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => { if (drag.current) setZ((s) => ({ ...s,
          x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => {
          e.preventDefault();
          const r = box.current.getBoundingClientRect();
          const mx = e.clientX - r.left, my = e.clientY - r.top;
          setZ((s) => {
            const k = Math.max(0.35, Math.min(2,
              s.k * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
            return { k, x: mx - (mx - s.x) * (k / s.k),
                        y: my - (my - s.y) * (k / s.k) };
          });
        }}
        style={{ position: "relative", overflow: "hidden", height: 380,
          background: t.bg || "#f5f8f8", borderRadius: 4,
          border: `1px solid ${t.panel2 || "#dfe6e9"}`,
          cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0",
          transform: `translate(${z.x}px,${z.y}px) scale(${z.k})` }}>

          <svg width={view.W} height={view.H} aria-hidden="true"
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible",
              pointerEvents: "none" }}>
            {wires.map((m, i) => {
              const one = m.items.length === 1 ? m.items[0] : null;
              const vis = m.items.some(hit);
              const lit = !sel || m.items.some((x) =>
                x.table === sel.table && x.col === sel.col);
              const op = !vis ? 0.07 : lit ? 0.8 : 0.16;
              const w = Math.min(7, 1.3 + Math.log2(m.items.length + 1) * 1.7);
              const c = one ? OP_META[one.__op.op].c
                : (m.items.some((x) => x.__op.transformed) ? "#e67e22" : "#9aa7b2");
              const mx = (m.a.x + m.b.x) / 2;
              const my = (m.a.y + m.b.y) / 2;
              const d = `M${m.a.x},${m.a.y} C${mx},${m.a.y} ${mx},${m.b.y} ${m.b.x},${m.b.y}`;
              const pick = () => {
                // A merged wire means the table it lands in is closed.
                // Opening it is what the reader wanted by clicking, and
                // then the wire they meant is one of the ones that appear.
                if (m.items.length > 1) {
                  setOpen((st) => new Set(st).add(`t:${m.items[0].table}`));
                  setSel({ table: m.items[0].table, col: m.items[0].col });
                } else {
                  const one0 = m.items[0];
                  const same = sel && sel.table === one0.table && sel.col === one0.col;
                  setSel(same ? null : { table: one0.table, col: one0.col });
                }
              };
              return (
                <g key={i}>
                  {/* A 1.4px curve is not a click target. An invisible
                      wide stroke over the same path is — the visible wire
                      keeps its weight and the hit area is a finger. */}
                  {vis && (
                    <path data-node d={d} fill="none" stroke="transparent"
                      strokeWidth={Math.max(16, w + 10)} strokeLinecap="round"
                      onClick={pick}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                      <title>{m.items.length === 1
                        ? `${m.items[0].src || "no source"} → ${m.items[0].table}.${m.items[0].col}`
                          + `\n${OP_META[m.items[0].__op.op].label}`
                        : `${m.items.length} columns into ${m.items[0].table}`
                          + ` — click to open the table`}</title>
                    </path>)}
                  <path d={d}
                    fill="none" stroke={c} strokeWidth={w} opacity={op}
                    strokeLinecap="round" />
                  {m.items.length > 1 && vis && (
                    <g data-node onClick={pick}
                      style={{ pointerEvents: "all", cursor: "pointer" }}>
                      <circle cx={mx} cy={my} r="8.5" fill={t.panel || "#fff"}
                        stroke={c} strokeWidth="1.2" opacity={op} />
                      <text x={mx} y={my + 3} textAnchor="middle" fill={c}
                        opacity={op} fontFamily={MONO} fontSize="9"
                        fontWeight="700">{m.items.length}</text>
                    </g>)}
                </g>);
            })}
          </svg>

          {/* the feed */}
          <div style={{ position: "absolute", left: view.src.x, top: view.src.y,
            width: NW, background: t.panel || "#fff", borderRadius: 5,
            border: `1px solid ${t.panel2 || "#dfe6e9"}`,
            borderTop: `3px solid ${SRC_C}`, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(16,25,59,.07)" }}>
            <button type="button" data-node
              onClick={() => setOpen((s) => {
                const n = new Set(s); n.has("src") ? n.delete("src") : n.add("src");
                return n; })}
              style={{ display: "flex", gap: 7, alignItems: "center", width: "100%",
                textAlign: "left", font: "inherit", background: "none", border: 0,
                padding: "7px 9px", cursor: "pointer", color: "inherit",
                height: HEAD }}>
              <span style={{ fontSize: 9, color: t.muted || "#999", width: 9,
                transform: view.src.open ? "rotate(90deg)" : "none",
                transition: "transform .15s" }}>▶</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>
                  {feedName || (data.feed && data.feed.business_name) || srcTable}</span>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 9,
                  color: t.muted || "#999", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {srcTable}{data.source_system ? ` · ${data.source_system}` : ""}</span>
              </span>
              <span style={{ fontSize: 9, color: t.muted || "#999" }}>
                {srcCols.length} fields</span>
            </button>
            {view.src.open && (
              <div style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                {srcCols.slice(0, view.src.rows).map((s) => (
                  <button key={s.name} type="button" data-node
                    onClick={() => setQ(s.name)}
                    title={`${s.name} feeds ${s.n} column${s.n === 1 ? "" : "s"}`
                      + (s.x ? `, ${s.x} with a transformation` : "")}
                    style={{ display: "flex", gap: 6, alignItems: "center",
                      width: "100%", textAlign: "left", font: "inherit",
                      background: "none", border: 0, cursor: "pointer",
                      color: "inherit", height: ROW, padding: "3px 8px 3px 10px",
                      borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1,
                      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}>{s.name}</span>
                    {s.x > 0 && <i title={`${s.x} transformed`}
                      style={{ width: 5, height: 5, borderRadius: "50%",
                        background: "#e67e22", flexShrink: 0 }} />}
                    <span style={{ fontSize: 8.5, color: t.muted || "#999" }}>
                      {s.n}</span>
                  </button>))}
                {view.src.rows < srcCols.length && (
                  <button type="button" data-node
                    onClick={() => setShowAll((s) => new Set(s).add("src"))}
                    style={{ width: "100%", height: ROW, font: "inherit",
                      fontSize: 9, background: "none", cursor: "pointer",
                      border: 0, borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
                      color: t.accent || "#0f4775" }}>
                    +{srcCols.length - view.src.rows} more fields</button>)}
              </div>)}
          </div>

          {/* the warehouse tables */}
          {view.tg.map((n) => (
            <div key={n.tb.table} style={{ position: "absolute", left: n.x,
              top: n.y, width: NW, background: t.panel || "#fff", borderRadius: 5,
              border: `1px solid ${t.panel2 || "#dfe6e9"}`,
              borderTop: `3px solid ${DWH_C}`, overflow: "hidden",
              boxShadow: "0 1px 3px rgba(16,25,59,.07)" }}>
              <button type="button" data-node
                onClick={() => setOpen((s) => {
                  const k = `t:${n.tb.table}`, x = new Set(s);
                  x.has(k) ? x.delete(k) : x.add(k); return x; })}
                onDoubleClick={() => onOpenTarget && onOpenTarget(n.tb.table)}
                style={{ display: "flex", gap: 7, alignItems: "center",
                  width: "100%", textAlign: "left", font: "inherit",
                  background: "none", border: 0, padding: "6px 9px",
                  cursor: "pointer", color: "inherit", height: HEAD }}>
                <span style={{ fontSize: 9, color: t.muted || "#999", width: 9,
                  transform: n.open ? "rotate(90deg)" : "none",
                  transition: "transform .15s" }}>▶</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: MONO,
                    fontSize: 10.5, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.tb.table}</span>
                  {/* THE MIX BAR. How computed this table is, before it is
                      opened — the question the old percentage could not
                      answer. */}
                  <span style={{ display: "flex", gap: 6, alignItems: "center",
                    marginTop: 2 }}>
                    <MixBar sum={n.tb.sum} w={86} />
                    <span style={{ fontSize: 8.5, color: t.muted || "#999" }}>
                      {n.tb.sum.transformed} of {n.tb.sum.total} computed</span>
                  </span>
                </span>
              </button>
              {n.open && (
                <div style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                  {n.shown.slice(0, n.n).map((c) => colRow(c, n.tb.table))}
                  {n.n < n.shown.length && (
                    <button type="button" data-node
                      onClick={() => setShowAll((s) =>
                        new Set(s).add(`t:${n.tb.table}`))}
                      style={{ width: "100%", height: ROW, font: "inherit",
                        fontSize: 9, background: "none", cursor: "pointer",
                        border: 0, borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
                        color: t.accent || "#0f4775" }}>
                      +{n.shown.length - n.n} more columns</button>)}
                  {!n.shown.length && (
                    <div style={{ padding: "6px 10px", fontSize: 9.5,
                      color: t.muted || "#999" }}>
                      no column matches the filter</div>)}
                </div>)}
            </div>))}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8,
        fontSize: 9.5, color: t.sub || "#666", alignItems: "center" }}>
        {OP_ORDER.filter((k) => total.mix.some((m) => m.op === k)).map((k) => (
          <span key={k} title={OP_META[k].note}
            style={{ display: "flex", alignItems: "center", gap: 4,
              cursor: "help" }}>
            <i style={{ width: 9, height: 9, borderRadius: 2,
              background: OP_META[k].c }} />{OP_META[k].label}</span>))}
        <span style={{ marginLeft: "auto", color: t.muted || "#999" }}>
          Wire thickness is columns carried · dots on a row are operations
          between source and target</span>
      </div>

      {/* the selected link */}
      {selected && <LinkDetail t={t} c={selected} table={sel.table}
        srcTable={srcTable} dataSource={dataSource} />}
    </div>);
}

// The expression as written, and the operations in order. A single link is
// a chain, not a DAG, so it reads as a chain — the branching picture is the
// operator graph's job and lives on the crosswalk column page.
function LinkDetail({ t, c, table, srcTable, dataSource }) {
  const meta = OP_META[c.__op.op];
  // WHAT THE COLUMN MEANS, not only what happens to it. Five dictionaries
  // are loaded — the AddVantage/CRD/STAR master, the published STAR
  // layouts, the SEI input catalogue, the UAF layouts and the contract
  // metadata — and the endpoint says which one answered, because a
  // definition from SEI's inbound catalogue is not the same warrant as one
  // from a published layout.
  const [def, setDef] = useState(undefined);
  useEffect(() => {
    if (!c.src) { setDef(null); return; }
    let live = true;
    setDef(undefined);
    crosswalkApi.fieldDefinition(c.src, dataSource, srcTable)
      .then((r) => { if (live) setDef(r.definition || null); });
    return () => { live = false; };
  }, [c.src, dataSource, srcTable]);
  const ops = useMemo(() => {
    if (!c.__op.rule) return [];
    const g = buildRuleGraph(c.__op.rule, { target: c.col });
    const order = { field: 0, const: 1, join: 2, fn: 3, branch: 4, agg: 5, target: 6 };
    return g.nodes.filter((n) => n.kind !== "prose")
      .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
  }, [c]);
  const KC = { field: SRC_C, const: "#7b8894", fn: "#00a3a3", branch: "#e67e22",
               join: "#7c3aed", agg: "#0091bf", target: DWH_C };
  const End = ({ eyebrow, c: col, name, type, len, prec, extra }) => (
    <span style={{ flex: "1 1 180px", minWidth: 0,
      border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderLeft: `3px solid ${col}`, borderRadius: 3, padding: "5px 9px",
      background: t.bg || "#f5f8f8" }}>
      <span style={{ display: "block", fontSize: 8, fontWeight: 800,
        letterSpacing: 0.5, textTransform: "uppercase", color: col }}>
        {eyebrow}</span>
      <span title={name} style={{ display: "block", fontFamily: MONO,
        fontSize: 10.5, color: t.navy || "#10193b", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ display: "block", fontSize: 9, color: t.muted || "#999" }}>
        {type || "type not published"}
        {len ? `(${len}${prec ? `,${prec}` : ""})` : ""}
        {extra ? ` · ${extra}` : ""}</span>
    </span>);
  return (
    <div style={{ marginTop: 11, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderLeft: `3px solid ${meta.c}`, borderRadius: 4, padding: "10px 13px",
      background: t.panel || "#fff" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline",
        flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 11 }}>
          {srcTable}.{c.src || "—"}</span>
        <span style={{ color: t.muted || "#999" }}>→</span>
        <span style={{ fontFamily: MONO, fontSize: 11 }}>{table}.{c.col}</span>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3,
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 2,
          background: `${meta.c}22`, color: meta.c }}>{meta.label}</span>
        <span style={{ fontSize: 10, color: t.muted || "#999" }}>
          {c.__op.steps} operation{c.__op.steps === 1 ? "" : "s"}</span>
      </div>
      <div style={{ fontSize: 10.5, color: t.sub || "#666", lineHeight: 1.6 }}>
        {meta.note}</div>

      {/* the two ends, side by side — a type comparison you can make by
          eye is the cheapest check on this screen */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 9 }}>
        <End t={t} eyebrow="Source field" c={SRC_C} name={c.src || "— none —"}
          type={c.src_type} len={c.src_length} prec={c.src_precision} />
        <span style={{ alignSelf: "center", color: t.muted || "#999" }}>→</span>
        <End t={t} eyebrow="Warehouse column" c={DWH_C} name={c.col}
          type={c.type} len={c.length} prec={c.precision}
          extra={[c.nullable && `nullable ${c.nullable}`,
                  c.pk && c.pk !== "N" && "key"].filter(Boolean).join(" · ")} />
      </div>

      {/* the semantics a type comparison cannot see. Two NUMBER(28,12)
          columns in different units are not the same column. */}
      {(c.unit || c.currency || c.sign || c.code_set) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8,
          fontSize: 10, color: t.sub || "#666" }}>
          {c.unit && <span><b style={{ color: t.muted || "#999" }}>unit</b> {c.unit}</span>}
          {c.currency && <span><b style={{ color: t.muted || "#999" }}>currency</b> {c.currency}</span>}
          {c.sign && <span><b style={{ color: t.muted || "#999" }}>sign</b> {c.sign}</span>}
          {c.code_set && <span><b style={{ color: t.muted || "#999" }}>code set</b>{" "}
            <span style={{ fontFamily: MONO }}>{c.code_set}</span></span>}
        </div>)}

      {/* the dictionary */}
      <div style={{ marginTop: 9, paddingTop: 8,
        borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}` }}>
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5,
          textTransform: "uppercase", color: t.muted || "#999" }}>
          What the field means</span>
        {def === undefined ? (
          <div style={{ fontSize: 10.5, color: t.muted || "#999", marginTop: 3 }}>
            looking in the loaded dictionaries…</div>
        ) : def ? (
          <div style={{ fontSize: 10.5, color: t.sub || "#666", lineHeight: 1.6,
            marginTop: 3, maxWidth: "76ch" }}>
            <b style={{ color: t.navy || "#10193b" }}>{def.term || c.src}</b>
            {def.description ? ` — ${def.description}` : ""}
            <div style={{ color: t.muted || "#999", marginTop: 2 }}>
              from {def.source_label}
              {def.type ? ` · ${def.type}${def.length ? `(${def.length})` : ""}` : ""}
              {def.evidence ? ` · ${def.evidence}` : ""}</div>
            {def.caveat && <div style={{ color: "#b45309", marginTop: 2 }}>
              {def.caveat}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 10.5, color: t.muted || "#999", marginTop: 3 }}>
            {c.src ? "No loaded dictionary defines this field."
                   : "No source field, so nothing to define."}</div>)}
      </div>
      {c.__op.rule ? (
        <>
          <pre style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: 10.5,
            lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
            background: t.bg || "#f5f8f8",
            border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
            padding: "8px 10px", maxHeight: 150, overflow: "auto",
            color: t.navy || "#10193b" }}>{c.__op.rule}</pre>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap",
            alignItems: "center", marginTop: 9 }}>
            {ops.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && <span style={{ color: t.muted || "#999",
                  fontSize: 10 }}>→</span>}
                <span style={{ display: "flex", flexDirection: "column",
                  border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                  borderLeft: `3px solid ${KC[n.kind] || "#5f87a7"}`,
                  borderRadius: 3, padding: "3px 8px",
                  background: t.bg || "#f5f8f8" }}>
                  <b style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: KC[n.kind] || "#5f87a7" }}>{n.kind}</b>
                  <span style={{ fontFamily: MONO, fontSize: 9.5 }}>{n.lab}</span>
                </span>
              </React.Fragment>))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10.5, color: t.muted || "#999", marginTop: 6 }}>
          No expression is recorded for this link — the value is carried
          across as it arrives.</div>)}
    </div>);
}
