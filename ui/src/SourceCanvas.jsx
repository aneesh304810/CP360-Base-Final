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
import SourceReading from "./SourceReading.jsx";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const SRC_C = "#6d3ac0", DWH_C = "#0f4775", SEI_C = "#0091bf";
// The SEI wire's colour is how well the mapping document's SEI source
// resolved to the published feed spec: verified is the only green.
const SEI_STATUS_C = {
  VERIFIED_IN_FEED_SPEC: "#159943", PARTIALLY_VERIFIED: "#5fa36b",
  FILE_ONLY_NO_FIELD: "#0091bf", SYSTEM_OR_CONSTANT: "#5f87a7", DERIVED_AT_RUNTIME: "#5f87a7",
  FIELD_NOT_IN_FEED_SPEC: "#e67e22", NOT_AVAILABLE_IN_SEI_FEEDS: "#c1113a", UNRESOLVED: "#b45309",
};
const seiWireColor = (st) => SEI_STATUS_C[st] || "#9aa7b2";
const seiStatusLabel = (st) => String(st || "").toLowerCase().replace(/_/g, " ");

// THE EXPORT IS THE PICTURE AS A TABLE. One row per column link — the
// feed field, the warehouse column, what happens between them, and the SEI
// side after cutover — so what the canvas draws can be read in a sheet.
export function canvasRows(targets, srcTable) {
  const out = [];
  (targets || []).forEach((tg) => (tg.cols || []).forEach((c) => {
    const op = c.__op || classifyLink(c);
    const sei = c.sei || {};
    out.push({
      feed: srcTable || "", source_field: c.src || "", source_type: c.src_type || "",
      imds_table: tg.table || "", imds_column: c.col || "", imds_type: c.type || "",
      nullable: c.nullable || "", operation: OP_META[op.op] ? OP_META[op.op].label : op.op,
      transformed: op.transformed ? "Y" : "N", rule: op.rule || c.t1 || "",
      lineage_status: c.status || "",
      sei_file: sei.has ? (sei.files || []).join("; ") : "",
      sei_field: sei.has ? (sei.source || "") : "",
      sei_resolution: sei.status || (sei.class ? sei.class : ""),
      sei_logic: sei.logic || "", equivalence: c.equivalence || "",
    });
  }));
  return out;
}
export function toCsv(rows) {
  const cols = ["feed", "source_field", "source_type", "imds_table", "imds_column", "imds_type", "nullable", "operation",
                "transformed", "rule", "lineage_status", "sei_file", "sei_field", "sei_resolution", "sei_logic", "equivalence"];
  const cell = (v) => { const t0 = String(v ?? "").replace(/\r?\n/g, " "); return /[",]/.test(t0) ? `"${t0.replace(/"/g, '""')}"` : t0; };
  return [cols.join(","), ...rows.map((r) => cols.map((k) => cell(r[k])).join(","))].join("\n");
}
// BASE sizes, not fixed ones. These are the smallest the drawing is ever
// laid out at; the real ones are computed per render from the space the
// canvas actually has. A 272px node ellipsised
// `Base_Total_Unrealized_Gain_15,Base_Total_Un…` on a 1400px-wide screen
// that had 600px going spare, which is a legibility problem caused
// entirely by not looking at the container.
const HEAD = 40, ROW = 22, GAPY = 14, PAD = 20;
const NW0 = 272, COLGAP0 = 226;
// A feed with 53 fields across four tables is a long scroll fully open.
// Cap the rows and say what was capped, rather than truncating in silence.
// The cap is how many rows FIT, so a tall window shows more of them.
const CAP0 = 15;
// Node width tops out at 460 and the gap at 440, so the drawing stops
// growing at 20*2 + 460*2 + 440. Wider than that and the detail pane moves
// alongside rather than the gutter growing.
const NW_MAX = 460, GAP_MAX = 440;
const ASIDE_AT = PAD * 2 + NW_MAX * 2 + GAP_MAX + 320;   // 1720
const ASIDE_W = 400;

export default function SourceCanvas({ t, srcTable, dataSource, feedName,
                                       onOpenTarget }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [showAll, setShowAll] = useState(() => new Set());
  const [sel, setSel] = useState(null);       // {table, col}
  const [q, setQ] = useState("");
  const [onlyX, setOnlyX] = useState(false);  // only transformed
  // The SEI source mapping: a third column of SEI feed files, wired from
  // the warehouse columns they replace the input of. On by default when
  // the crosswalk knows this feed, and a toggle either way.
  const [showSei, setShowSei] = useState(true);
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const [full, setFull] = useState(false);
  // picture | reading. THE SAME PAYLOAD, READ TWO WAYS. The reading view
  // lives behind this toggle rather than in its own tab because it is not
  // other data — it is this data in sentences, and a second tab would
  // fetch it a second time and be free to disagree with the drawing.
  const [mode, setMode] = useState("picture");
  // The canvas box measures itself. Everything below sizes from this rather
  // than from a constant, which is the difference between a drawing that
  // uses a laptop screen and one that sits in the middle of it.
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Measured on the OUTER shell, not the canvas. The side-by-side decision
  // below moves the detail pane into the same row as the canvas, which
  // narrows the canvas — decide from the canvas width and the layout
  // oscillates across the breakpoint forever. The shell's width does not
  // change when its contents rearrange, so it is the stable thing to ask.
  const [shellW, setShellW] = useState(0);
  const box = useRef(null);
  const shell = useRef(null);
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
    return `${c.col} ${c.src || ""} ${(c.sei && c.sei.source) || ""}`.toLowerCase().includes(s);
  };

  const seiFiles = useMemo(() => (data && data.sei_files) || [], [data]);
  const seiOn = showSei && seiFiles.length > 0;

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

  // THE DRAWING TAKES THE ROOM IT IS GIVEN.
  //
  // Two node columns and the gap between them fill the measured width
  // instead of being centred inside it with the remainder left blank.
  // Wider nodes are the whole point: these source names are composites
  // (`Base_Amortized_Cost_7,Trade_Date_Cash_136`) and a fixed 272px cut
  // every one of them in half while 600px sat unused on either side.
  //
  // Height does the same for the row cap. The cap exists so a 53-field
  // feed is not an endless scroll, and "how many rows fit" is a better
  // answer to that than a constant 15 — a tall window shows more, a short
  // one shows fewer, and either way the "+N more" row says what was held
  // back.
  const dims = useMemo(() => {
    const room = Math.max(620, (size.w || 900) - 24);
    // solved so the nodes plus the gaps plus the padding come to exactly
    // `room` while the gap is at its minimum — otherwise the layout comes
    // out a little wider than the box and fit() scales the whole thing down
    // to compensate, which is the wasted space again in another form.
    // With the SEI column drawn there are three nodes and two gaps.
    const ncol = seiOn ? 3 : 2, ngap = ncol - 1;
    const nw = Math.round(Math.min(NW_MAX,
      Math.max(seiOn ? 200 : NW0, (room - PAD * 2 - COLGAP0 * ngap) / ncol)));
    const gap = Math.round(Math.min(GAP_MAX, Math.max(seiOn ? 150 : COLGAP0,
      (room - nw * ncol - PAD * 2) / ngap)));
    const cap = Math.max(CAP0,
      Math.floor(((size.h || 380) - HEAD - PAD * 2 - ROW) / ROW));
    return { nw, gap, cap };
  }, [size.w, size.h, seiOn]);

  const view = useMemo(() => {
    const { nw: NW, gap: COLGAP, cap: CAP } = dims;
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
    // the SEI feed files: a node each, openable to the file's own fields as
    // Data 360 ingested them — the ones this feed is replaced from first
    const sn = seiOn ? seiFiles.map((f) => {
      const o = open.has(`s:${f.file}`);
      const flds = o ? (f.fields || []) : [];
      const n = showAll.has(`s:${f.file}`) ? flds.length : Math.min(flds.length, CAP);
      // an open node with no fields still shows one line saying so
      return { f, open: o, flds, n, h: HEAD + (o ? n * ROW + (n < flds.length ? ROW : 0) + (flds.length ? 0 : ROW) + 1 : 0) };
    }) : [];
    const totalS = sn.reduce((a, b) => a + b.h, 0) + Math.max(0, sn.length - 1) * GAPY;
    const H = Math.max(sh, totalT, totalS, 120) + PAD * 2;
    const src = { x: PAD, y: PAD + (H - PAD * 2 - sh) / 2, w: NW, h: sh,
                  open: sOpen, rows: sRows };
    let y = PAD + (H - PAD * 2 - totalT) / 2;
    tg.forEach((n) => { n.x = PAD + NW + COLGAP; n.y = y; n.w = NW; y += n.h + GAPY; });
    let ys = PAD + (H - PAD * 2 - totalS) / 2;
    sn.forEach((n) => { n.x = PAD + (NW + COLGAP) * 2; n.y = ys; n.w = NW; ys += n.h + GAPY; });
    return { src, tg, sn, W: PAD * 2 + NW * (seiOn ? 3 : 2) + COLGAP * (seiOn ? 2 : 1), H, nw: NW, cap: CAP };
  }, [targets, open, showAll, q, onlyX, srcCols, dims, seiOn, seiFiles]);   // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    const el = box.current;
    if (!el || !view.W) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0.35, Math.min((r.width - 20) / view.W,
                                      (r.height - 20) / view.H, 1.1));
    setZ({ k, x: (r.width - view.W * k) / 2, y: (r.height - view.H * k) / 2 });
  };
  // One observer answers both questions: what scale fits, and how much room
  // the layout has to spend. Measuring in the same place they are used keeps
  // the panel widening, the window resizing and the full-screen toggle on
  // one mechanism.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((p) => (Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1
        ? p : { w: r.width, h: r.height }));
      fit();
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view.W, view.H, full]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes, and the page behind does not scroll under the overlay.
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

  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      setShellW((p) => (Math.abs(p - w) < 1 ? p : w));
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  // PAST THE CEILING, WIDTH BUYS SOMETHING ELSE.
  //
  // Node width and the gap both stop growing at the point where a wider
  // node stops making a name more readable and a wider gap just makes a
  // longer wire. Past that the drawing is centred and the remaining width
  // would be gutter — so it goes to the detail pane instead, which today
  // sits below the canvas and pushes the expression off the fold every
  // time a wire is clicked. Beside the canvas, the picture and the
  // expression are visible at once, which is the whole reason to click.
  const aside = shellW >= ASIDE_AT;

  // Inline, the canvas takes what the window has below the header and the
  // detail drawer rather than a constant 380. A fixed height was 380px of
  // drawing inside 900px of screen.
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  // Full screen leaves the height to flex:1 — an explicit height fights it.
  const canvasH = full ? undefined : Math.max(380, Math.min(760, vh - 430));

  if (!data) {
    return <div style={{ padding: 24, fontSize: 12, color: t.muted || "#999" }}>
      Loading where this feed lands…</div>;
  }
  // WHY, NOT JUST "NOTHING". "No warehouse column records this feed as its
  // source" is a claim about the business, and it was printed on a screen
  // whose own spine said 31 fields across 4 tables directly above it. The
  // endpoint now separates a schema gap, a scope mismatch and a genuinely
  // unmapped feed, and each of those needs a different person to do a
  // different thing, so the screen names which.
  if (!targets.length) {
    const d = data.diagnostics || {};
    return (
      <div style={{ padding: 20, fontSize: 12, color: t.sub || "#666",
                    lineHeight: 1.6, maxWidth: "72ch" }}>
        <div style={{ color: d.ok === false ? "#c1113a" : (t.sub || "#666"),
                      fontWeight: d.ok === false ? 500 : 400 }}>
          {d.reason || "No warehouse column records this feed as its source."}
        </div>
        {(d.missing || []).length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: t.muted || "#999" }}>
            Not present in this database:{" "}
            <span style={{ fontFamily: MONO }}>{d.missing.join(", ")}</span>.
            {" "}Run the outstanding migrations and this fills in.
          </div>)}
        {(d.near_names || []).length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: t.muted || "#999" }}>
            Nearest source-table names under this data source:{" "}
            <span style={{ fontFamily: MONO }}>{d.near_names.join(", ")}</span>
          </div>)}
      </div>);
  }

  // The toggle. Rendered in both modes and in the same place, so switching
  // back is where switching away was.
  const modeBar = (
    <span role="group" aria-label="How to read this"
      style={{ display: "inline-flex", borderRadius: 3, overflow: "hidden",
        border: `1px solid ${t.panel2 || "#dfe6e9"}`, flexShrink: 0 }}>
      {[["picture", "Picture"], ["reading", "Reading"]].map(([k, label]) => (
        <button key={k} type="button" aria-pressed={mode === k}
          onClick={() => { setMode(k); if (k === "reading") setFull(false); }}
          title={k === "picture"
            ? "The wiring: which columns each table takes, and what is computed"
            : "The same mapping in sentences — what arrives, and what happens to it"}
          style={{ font: "inherit", fontSize: 10.5, padding: "3px 11px",
            border: 0, cursor: "pointer",
            background: mode === k ? (t.accent || "#0f4775")
                                   : (t.panel || "#fff"),
            color: mode === k ? "#fff" : (t.accent || "#0f4775") }}>
          {label}</button>))}
    </span>);

  // The reading view takes the payload this component already fetched. It
  // sits after the diagnostics branch above on purpose: when nothing maps,
  // the reason why is the answer in either mode.
  if (mode === "reading") {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          flexWrap: "wrap", marginBottom: 12 }}>
          {modeBar}
          <span style={{ fontSize: 10.5, color: t.muted || "#999" }}>
            In sentences. Switch to Picture for the wiring.</span>
        </div>
        <SourceReading t={t} data={data} feedName={feedName}
          dataSource={dataSource} onOpenTarget={onOpenTarget} />
      </div>);
  }

  // ---- anchors: the mechanic ---------------------------------------------
  const anchorSrc = (name) => {
    if (view.src.open) {
      const i = srcCols.findIndex((s) => s.name === name);
      if (i >= 0 && i < view.src.rows) {
        return { x: view.src.x + view.nw,
                 y: view.src.y + HEAD + 1 + i * ROW + ROW / 2 };
      }
    }
    return { x: view.src.x + view.nw, y: view.src.y + HEAD / 2 };
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

  const anchorTgtOut = (table, col) => {
    const a = anchorTgt(table, col);
    return a ? { x: a.x + view.nw, y: a.y } : null;
  };
  const keyOf = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const anchorSei = (file, field) => {
    const n = (view.sn || []).find((x) => keyOf(x.f.file) === keyOf(file));
    if (!n) return null;
    if (n.open && field) {
      const i = n.flds.findIndex((f) => keyOf(f.name) === keyOf(field));
      if (i >= 0 && i < n.n) return { x: n.x, y: n.y + HEAD + 1 + i * ROW + ROW / 2 };
    }
    return { x: n.x, y: n.y + HEAD / 2 };
  };
  // the SEI wires: warehouse column -> the SEI feed file that replaces its
  // input. Merged per anchor pair like the feed wires, coloured by how well
  // the source resolved to the feed spec.
  const seiWires = [];
  if (seiOn) {
    const sm = new Map();
    targets.forEach((tg) => tg.cols.forEach((c) => {
      if (!c.sei || !c.sei.has) return;
      const pairs = (c.sei.fields && c.sei.fields.length)
        ? c.sei.fields : (c.sei.files || []).map((f) => ({ file: f, field: null }));
      pairs.forEach((pr) => {
        const a = anchorTgtOut(tg.table, c.col), b = anchorSei(pr.file, pr.field);
        if (!a || !b) return;
        const k = `${a.y}>${b.y}`;
        if (!sm.has(k)) sm.set(k, { a, b, items: [] });
        sm.get(k).items.push({ ...c, table: tg.table, file: pr.file, field: pr.field });
      });
    }));
    sm.forEach((m) => seiWires.push(m));
  }

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
  const seiMapped = targets.reduce((a, tg) => a + tg.cols.filter((c) => c.sei && c.sei.has).length, 0);
  const exportCsv = () => {
    const rows = canvasRows(targets, srcTable);
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${String(srcTable || "feed").replace(/[^A-Za-z0-9_-]+/g, "_")}_lineage.csv`;
    a.click();
  };
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

  const inner = (
    <>
      {/* A widened match is not a detail to hide. Silently dropping the
          data-source filter is exactly how this canvas and the spine above
          it came to state different numbers on the same screen, so when the
          rows answered only on a wider rung the screen says so. */}
      {data.diagnostics && data.diagnostics.scope_note && (
        <div style={{ marginBottom: 9, padding: "7px 10px", fontSize: 11,
          lineHeight: 1.55, borderRadius: 3, color: "#7a4a12",
          background: "#fdf3e4", border: "1px solid #f0d5ae" }}>
          {data.diagnostics.scope_note}</div>)}
      {data.diagnostics && (data.diagnostics.missing || []).length > 0 && (
        <div style={{ marginBottom: 9, fontSize: 10.5, color: t.muted || "#999" }}>
          Shown without{" "}
          <span style={{ fontFamily: MONO }}>
            {data.diagnostics.missing.join(", ")}</span>
          {" "}— those tables are not in this database yet, so the lane badge
          and registered rules are blank rather than wrong.</div>)}
      <div style={{ display: "flex", gap: 8, alignItems: "center",
        flexWrap: "wrap", marginBottom: 9 }}>
        {modeBar}
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
        {seiFiles.length > 0 && (
          <button type="button" onClick={() => setShowSei((v) => !v)} aria-pressed={seiOn}
            title={`${seiMapped} of ${total.total} column links have a SEI source named for them`}
            style={{ ...ghost, ...(seiOn ? { background: SEI_C,
              borderColor: SEI_C, color: "#fff" } : {}) }}>
            SEI source mapping · {seiMapped} of {total.total}</button>)}
        <button type="button" onClick={exportCsv} style={ghost}
          title="every column link as a row: feed field, warehouse column, operation, rule, and the SEI side">
          ⤓ export CSV</button>
        <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          <button type="button" style={ghost} onClick={() => setOpen(
            new Set(["src", ...targets.map((x) => `t:${x.table}`),
                     ...(seiOn ? seiFiles.map((f) => `s:${f.file}`) : [])]))}>open all</button>
          <button type="button" style={ghost}
            onClick={() => setOpen(new Set())}>close all</button>
          <button type="button" style={ghost} onClick={fit}>fit</button>
          <button type="button" style={ghost}
            onClick={() => setFull((v) => !v)}>
            {full ? "✕ close · Esc" : "⤢ full screen"}</button>
        </span>
      </div>

      {/* canvas and detail: stacked normally, side by side once the shell is
          wide enough that the alternative is gutter. */}
      <div style={{ display: "flex", gap: 14, alignItems: "stretch",
        flex: full ? 1 : undefined, minHeight: full ? 0 : undefined }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex",
        flexDirection: "column" }}>
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
        style={{ position: "relative", overflow: "hidden", height: canvasH,
          flex: full ? 1 : undefined, minHeight: full ? 0 : undefined,
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
            {seiWires.map((m, i) => {
              const vis = m.items.some(hit);
              const lit = !sel || m.items.some((x) =>
                x.table === sel.table && x.col === sel.col);
              const op = !vis ? 0.07 : lit ? 0.75 : 0.14;
              const w = Math.min(7, 1.3 + Math.log2(m.items.length + 1) * 1.7);
              const sts = new Set(m.items.map((x) => x.sei && x.sei.status));
              const c = sts.size === 1 ? seiWireColor([...sts][0]) : SEI_C;
              const mx = (m.a.x + m.b.x) / 2, my = (m.a.y + m.b.y) / 2;
              const d = `M${m.a.x},${m.a.y} C${mx},${m.a.y} ${mx},${m.b.y} ${m.b.x},${m.b.y}`;
              const one = m.items.length === 1 ? m.items[0] : null;
              const pick = () => {
                if (m.items.length > 1) {
                  setOpen((st) => new Set(st).add(`t:${m.items[0].table}`));
                  setSel({ table: m.items[0].table, col: m.items[0].col });
                } else {
                  const same = sel && sel.table === one.table && sel.col === one.col;
                  setSel(same ? null : { table: one.table, col: one.col });
                }
              };
              return (
                <g key={`sei-${i}`}>
                  {vis && (
                    <path data-node d={d} fill="none" stroke="transparent"
                      strokeWidth={Math.max(16, w + 10)} strokeLinecap="round" onClick={pick}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                      <title>{one
                        ? `${one.table}.${one.col} ← after cutover: ${one.sei.source || one.file}`
                          + (one.sei.status ? `\n${seiStatusLabel(one.sei.status)}` : "")
                        : `${m.items.length} columns replaced from ${m.items[0].file} — click to open the table`}</title>
                    </path>)}
                  <path d={d} fill="none" stroke={c} strokeWidth={w} opacity={op}
                    strokeLinecap="round" strokeDasharray="6 4" />
                  {m.items.length > 1 && vis && (
                    <g data-node onClick={pick} style={{ pointerEvents: "all", cursor: "pointer" }}>
                      <circle cx={mx} cy={my} r="8.5" fill={t.panel || "#fff"} stroke={c} strokeWidth="1.2" opacity={op} />
                      <text x={mx} y={my + 3} textAnchor="middle" fill={c} opacity={op}
                        fontFamily={MONO} fontSize="9" fontWeight="700">{m.items.length}</text>
                    </g>)}
                </g>);
            })}
          </svg>

          {/* the feed */}
          <div style={{ position: "absolute", left: view.src.x, top: view.src.y,
            width: view.nw, background: t.panel || "#fff", borderRadius: 5,
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
              top: n.y, width: view.nw, background: t.panel || "#fff",
              borderRadius: 5,
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

          {/* the SEI feed files: what replaces the feed's input after cutover.
              Open, the file's own fields as Data 360's inbound-feed catalogue
              holds them, the ones this feed is replaced from first. */}
          {(view.sn || []).map((n) => (
            <div key={`sei:${n.f.file}`} style={{ position: "absolute", left: n.x, top: n.y, width: view.nw,
                background: t.panel || "#fff", borderRadius: 5,
                border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                borderTop: `3px solid ${SEI_C}`, overflow: "hidden",
                boxShadow: "0 1px 3px rgba(16,25,59,.07)" }}>
              <button type="button" data-node
                onClick={() => setOpen((st) => {
                  const k = `s:${n.f.file}`, x = new Set(st);
                  x.has(k) ? x.delete(k) : x.add(k); return x; })}
                title={`${n.f.file} — replaces the STAR input of ${n.f.n} column${n.f.n === 1 ? "" : "s"}`
                  + (n.f.verified ? `, ${n.f.verified} verified in the SEI feed spec` : "")
                  + (n.f.in_data360 ? `\n${n.f.field_count} fields in Data 360 · inbound feeds` : "\nnot in Data 360's inbound-feed catalogue")
                  + ((n.f.tables || []).length ? `\n${n.f.tables.join(", ")}` : "")}
                style={{ display: "flex", gap: 7, alignItems: "center", width: "100%",
                  textAlign: "left", font: "inherit", background: "none", border: 0,
                  padding: "6px 9px", cursor: "pointer", color: "inherit", height: HEAD }}>
                <span style={{ fontSize: 9, color: t.muted || "#999", width: 9,
                  transform: n.open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10.5, fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    ☁️ {n.f.file}</span>
                  <span style={{ display: "block", fontSize: 8.5, color: t.muted || "#999",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.f.in_data360
                      ? `SEI feed · ${n.f.field_count} fields in Data 360${n.f.workstream ? ` · ${n.f.workstream}` : ""}`
                      : "SEI feed file · after cutover"}</span>
                </span>
                <span style={{ fontSize: 9, color: n.f.verified === n.f.n ? "#159943" : (t.muted || "#999"),
                  whiteSpace: "nowrap" }}>
                  {n.f.n} col{n.f.n === 1 ? "" : "s"}{n.f.verified ? ` · ${n.f.verified} ✓` : ""}</span>
              </button>
              {n.open && (
                <div style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                  {n.flds.slice(0, n.n).map((f) => (
                    <button key={f.name} type="button" data-node
                      onClick={() => setQ(q === f.name ? "" : f.name)}
                      title={`${n.f.file}.${f.name}`
                        + (f.type ? ` · ${f.type}${f.length ? `(${f.length})` : ""}` : "")
                        + (f.desc ? `\n${f.desc}` : "")
                        + (f.used_by ? `\nreplaces the input of ${f.used_by} column${f.used_by === 1 ? "" : "s"} of this feed` : "")
                        + (f.not_in_catalog ? "\nnamed by the mapping document; not in Data 360's inbound-feed catalogue" : "")}
                      style={{ display: "flex", gap: 6, alignItems: "center", width: "100%",
                        textAlign: "left", font: "inherit", background: f.used_by ? "rgba(0,145,191,.07)" : "none",
                        border: 0, cursor: "pointer", color: "inherit", height: ROW,
                        padding: "3px 8px 3px 10px", borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                      <i style={{ width: 6, height: 6, borderRadius: 1.5, flexShrink: 0,
                        background: f.used_by ? SEI_C : "#d7dee4" }} />
                      <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontWeight: f.used_by ? 700 : 400, color: f.not_in_catalog ? "#b45309" : "inherit" }}>
                        {f.name}</span>
                      {f.pii === "Y" && <span title="PII" style={{ fontSize: 7.5, fontWeight: 800, color: "#c1113a" }}>PII</span>}
                      {f.pk === "Y" && <span title="key" style={{ fontSize: 7.5, fontWeight: 800, color: t.muted || "#999" }}>KEY</span>}
                      <span style={{ fontSize: 8, color: t.muted || "#999", flexShrink: 0 }}>
                        {f.type ? `${f.type}${f.length ? `(${f.length})` : ""}` : (f.not_in_catalog ? "not in catalogue" : "")}</span>
                      {f.used_by > 0 && <span style={{ fontSize: 8.5, color: SEI_C, fontWeight: 700 }}>{f.used_by}</span>}
                    </button>))}
                  {n.n < n.flds.length && (
                    <button type="button" data-node
                      onClick={() => setShowAll((st) => new Set(st).add(`s:${n.f.file}`))}
                      style={{ width: "100%", height: ROW, font: "inherit", fontSize: 9,
                        background: "none", cursor: "pointer", border: 0,
                        borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`, color: t.accent || "#0f4775" }}>
                      +{n.flds.length - n.n} more fields</button>)}
                  {!n.flds.length && (
                    <div style={{ padding: "6px 10px", fontSize: 9.5, color: t.muted || "#999" }}>
                      no fields known for this file</div>)}
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
        {seiOn && (
          <span title="dashed wires: the SEI feed file that replaces the column's STAR input after cutover; green when the SEI field is verified in the published feed spec, orange or red when it is not"
            style={{ display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
            <i style={{ width: 14, height: 0, borderTop: `2px dashed ${SEI_C}` }} />
            SEI source after cutover · {seiMapped} of {total.total} columns
            {total.total - seiMapped > 0 ? ` · ${total.total - seiMapped} with none yet` : ""}</span>)}
        <span style={{ marginLeft: "auto", color: t.muted || "#999" }}>
          Wire thickness is columns carried · dots on a row are operations
          between source and target</span>
      </div>

      {!aside && selected && (
        <LinkDetail t={t} c={selected} table={sel.table}
          srcTable={srcTable} dataSource={dataSource} />)}
      </div>
      {aside && (
        <div style={{ width: ASIDE_W, flexShrink: 0, overflow: "auto",
          maxHeight: full ? undefined : canvasH }}>
          {selected
            ? <LinkDetail t={t} c={selected} table={sel.table}
                srcTable={srcTable} dataSource={dataSource} />
            : <div style={{ fontSize: 10.5, color: t.muted || "#999",
                border: `1px dashed ${t.panel2 || "#dfe6e9"}`, borderRadius: 4,
                padding: "14px 12px", lineHeight: 1.6 }}>
                Click a wire, or a column row, to read the expression behind
                it here — the two ends, what the dictionary says the source
                field means, and the operations in order.</div>}
        </div>)}
      </div>
    </>);

  if (!full) return <div>{inner}</div>;

  // Full screen is a fixed overlay, not a route. The open tables, the
  // selected link, the search and the zoom all survive the toggle, so you
  // come back to the picture you left rather than a reset one. The column
  // layout is a flex box so the canvas takes every pixel the chrome and the
  // detail drawer do not, which is the point of going full screen at all.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000,
      background: t.bg || "#f5f8f8", display: "flex", flexDirection: "column",
      padding: "14px 18px 16px", boxSizing: "border-box", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12,
        marginBottom: 10, flexShrink: 0 }}>
        <b style={{ fontSize: 14.5, color: t.navy || "#10193b" }}>
          {feedName || srcTable}</b>
        <span style={{ fontFamily: MONO, fontSize: 11,
          color: t.muted || "#999" }}>{srcTable}</span>
        <span style={{ fontSize: 10.5, color: t.sub || "#666" }}>
          where it lands, column by column · click a wire for its expression
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex",
        flexDirection: "column" }}>
        {inner}
      </div>
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

      {/* after cutover: the SEI side of this column, from the mapping document */}
      {c.sei && (
        <div style={{ marginTop: 9, paddingTop: 8,
          borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}` }}>
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5,
            textTransform: "uppercase", color: SEI_C }}>
            After cutover · SEI source</span>
          {c.sei.has ? (
            <div style={{ fontSize: 10.5, color: t.sub || "#666", lineHeight: 1.6, marginTop: 3 }}>
              <span style={{ fontFamily: MONO, color: t.navy || "#10193b", fontWeight: 600 }}>{c.sei.source || (c.sei.files || []).join("; ")}</span>
              {c.sei.map_kind ? <span style={{ color: t.muted || "#999" }}> · {c.sei.map_kind}</span> : null}
              {c.sei.status && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                border: `1px solid ${seiWireColor(c.sei.status)}`, color: seiWireColor(c.sei.status) }}>{seiStatusLabel(c.sei.status)}</span>}
              <div style={{ color: t.muted || "#999", marginTop: 2 }}>
                replaces {srcTable}.{c.src || "the STAR input"}; the rule above is kept
                {c.sei.logic ? " — SEI-equivalent logic:" : ""}</div>
              {c.sei.logic && <pre style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-word",
                background: t.bg || "#f5f8f8", border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3, padding: "6px 8px",
                maxHeight: 110, overflow: "auto", color: t.navy || "#10193b" }}>{c.sei.logic}</pre>}
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: "#c1113a", marginTop: 3 }}>
              {c.sei.class === "NOT_POPULATED" ? "Not populated by the STAR load; nothing for SEI to replace."
                : c.sei.class === "STAR_NOT_IN_FILE_MAP" ? "The STAR field the load reads is not in the file map; no SEI source."
                : "No SEI source named for this column yet."}</div>)}
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
