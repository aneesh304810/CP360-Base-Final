// Data Analysis · Historical data migration: the lineage drawn the way the
// Source view draws a feed. Three node columns: the historical lanes with
// their source columns on the left, the SEI dat files with their target
// fields in the middle, and on the right the IMDS tables those fields
// reach today. A node is a table when closed and a list of columns when
// open; a link attaches to the column row when its side is open and to
// the node's edge when it is not, so a closed node shows one thick wire
// with a count and opening both ends refines it into one wire per column.
// The wire is coloured by the transformation's operation, read by the
// same classifier the operational canvas uses, so a lane that carries
// everything untouched looks different from one that computes half of it
// before anything is opened. Picture and Table read one payload.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { histMigrationApi as api, LANE_LABEL, STATUS_COLOR, classifyRule } from "./histMigrationApi.js";
import { classifyLink, summarise, OP_META } from "./linkOps.js";
import HistReading from "./HistReading.jsx";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const LANE_C = { ADDVANTAGE_SEI_HIST: "#7c3aed", STAR_SEI_HIST: "#0f4775", UAF_SEI_HIST: "#c96a12", COMMON: "#159943", UNCLASSIFIED: "#6b7884" };
const SEI_C = "#0091bf", DWH_C = "#233240";
const HEAD = 40, ROW = 22, GAPY = 14, PAD = 20, CAP0 = 15, NW_MAX = 420, GAP_MAX = 380;

const withLogic = (c) => ({ ...c, logic: classifyRule(c.t1) });

export function canvasRows(targets) {
  const out = [];
  (targets || []).forEach((tg) => (tg.cols || []).forEach((c) => {
    const op = c.__op || classifyLink(withLogic(c));
    out.push({ lane: c.lane, source_system: c.src_system || "", source_column: c.src || "", transformation: c.t1 || "", operation: OP_META[op.op] ? OP_META[op.op].label : op.op,
      transformed: op.transformed ? "Y" : "N", dat_file: tg.table, target_field: c.col, type: c.type || "", length: c.length || "", mandatory: c.mandatory || "",
      rule_status: c.rule_status || "", approval: c.approval || "", dictionary: c.dictionary || "", match: c.match || "",
      star_field: (c.sei && c.sei.source) || "", imds_columns: c.sei && c.sei.has ? c.sei.fields.map((f) => `${f.file}.${f.field}`).join("; ") : "", lineage_id: c.lineage_id });
  }));
  return out;
}
export function toCsv(rows) {
  const cols = ["lane", "source_system", "source_column", "transformation", "operation", "transformed", "dat_file", "target_field", "type", "length", "mandatory", "rule_status", "approval", "dictionary", "match", "star_field", "imds_columns", "lineage_id"];
  const cell = (v) => { const s = String(v ?? "").replace(/\r?\n/g, " "); return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((k) => cell(r[k])).join(","))].join("\n");
}

function MixBar({ sum, w }) {
  if (!sum || !sum.total) return null;
  return (
    <span style={{ display: "inline-flex", width: w, height: 5, borderRadius: 3, overflow: "hidden", background: "#e6ebef" }}>
      {sum.mix.map((m) => <span key={m.op} style={{ width: `${(100 * m.n) / sum.total}%`, background: OP_META[m.op].c }} title={`${m.n} ${OP_META[m.op].label}`} />)}
    </span>);
}
const Pips = ({ n }) => <span style={{ display: "inline-flex", gap: 2 }}>{Array.from({ length: Math.min(n, 5) }).map((_, i) => <i key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#e67e22" }} />)}</span>;

export default function HistCanvas({ t, file, lane, initial, onPickFile }) {
  const [data, setData] = useState(initial || null);
  const [open, setOpen] = useState(() => new Set(initial && initial.open ? initial.open : []));
  const [showAll, setShowAll] = useState(() => new Set());
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [onlyX, setOnlyX] = useState(false);
  const [showDwh, setShowDwh] = useState(true);
  const [mode, setMode] = useState(initial && initial.mode ? initial.mode : "picture");
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const box = useRef(null), drag = useRef(null);

  useEffect(() => {
    if (initial) return undefined;
    let live = true;
    setData(null); setSel(null);
    api.canvas({ file, lane }).then((r) => {
      if (!live) return;
      setData(r);
      const first = (r.targets || [])[0];
      setOpen(new Set(first ? [`t:${first.table}`] : []));
      setShowAll(new Set());
    });
    return () => { live = false; };
  }, [file, lane]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = useMemo(() => (data ? (data.targets || []).map((tg) => { const cols = (tg.cols || []).map((c) => ({ ...c, __op: classifyLink(withLogic(c)) })); return { ...tg, cols, sum: summarise(cols) }; }) : []), [data]);
  const lanes = useMemo(() => (data && data.lanes) || [], [data]);
  const dwhFiles = useMemo(() => (data && data.sei_files) || [], [data]);
  const dwhOn = showDwh && dwhFiles.length > 0;
  const hit = (c) => { if (onlyX && !c.__op.transformed) return false; if (!q) return true; const s = q.toLowerCase(); return `${c.col} ${c.src || ""} ${(c.sei && c.sei.source) || ""}`.toLowerCase().includes(s); };

  const dims = useMemo(() => {
    const room = Math.max(620, (size.w || 900) - 24);
    const ncol = dwhOn ? 3 : 2, ngap = ncol - 1;
    const nw = Math.round(Math.min(NW_MAX, Math.max(200, (room - PAD * 2 - 150 * ngap) / ncol)));
    const gap = Math.round(Math.min(GAP_MAX, Math.max(150, (room - nw * ncol - PAD * 2) / ngap)));
    const cap = Math.max(CAP0, Math.floor(((size.h || 380) - HEAD - PAD * 2 - ROW) / ROW));
    return { nw, gap, cap };
  }, [size.w, size.h, dwhOn]);

  const view = useMemo(() => {
    const { nw: NW, gap: COLGAP, cap: CAP } = dims;
    const ln = lanes.map((l) => {
      const o = open.has(`l:${l.lane}`);
      const rows = o ? (showAll.has(`l:${l.lane}`) ? l.cols.length : Math.min(l.cols.length, CAP)) : 0;
      return { l, open: o, rows, h: HEAD + (o ? rows * ROW + (rows < l.cols.length ? ROW : 0) + 1 : 0) };
    });
    const totalL = ln.reduce((a, b) => a + b.h, 0) + Math.max(0, ln.length - 1) * GAPY;
    const tg = targets.map((tb) => {
      const o = open.has(`t:${tb.table}`);
      const shown = o ? tb.cols.filter(hit) : [];
      const n = showAll.has(`t:${tb.table}`) ? shown.length : Math.min(shown.length, CAP);
      return { tb, open: o, shown, n, h: HEAD + (o ? n * ROW + (n < shown.length ? ROW : 0) + 1 : 0) };
    });
    const totalT = tg.reduce((a, b) => a + b.h, 0) + Math.max(0, tg.length - 1) * GAPY;
    const sn = dwhOn ? dwhFiles.map((f) => {
      const o = open.has(`s:${f.file}`);
      const flds = o ? (f.fields || []) : [];
      const n = showAll.has(`s:${f.file}`) ? flds.length : Math.min(flds.length, CAP);
      return { f, open: o, flds, n, h: HEAD + (o ? n * ROW + (n < flds.length ? ROW : 0) + 1 : 0) };
    }) : [];
    const totalS = sn.reduce((a, b) => a + b.h, 0) + Math.max(0, sn.length - 1) * GAPY;
    const H = Math.max(totalL, totalT, totalS, 120) + PAD * 2;
    let yl = PAD + (H - PAD * 2 - totalL) / 2;
    ln.forEach((n) => { n.x = PAD; n.y = yl; n.w = NW; yl += n.h + GAPY; });
    let y = PAD + (H - PAD * 2 - totalT) / 2;
    tg.forEach((n) => { n.x = PAD + NW + COLGAP; n.y = y; n.w = NW; y += n.h + GAPY; });
    let ys = PAD + (H - PAD * 2 - totalS) / 2;
    sn.forEach((n) => { n.x = PAD + (NW + COLGAP) * 2; n.y = ys; n.w = NW; ys += n.h + GAPY; });
    return { ln, tg, sn, W: PAD * 2 + NW * (dwhOn ? 3 : 2) + COLGAP * (dwhOn ? 2 : 1), H, nw: NW };
  }, [targets, lanes, dwhFiles, open, showAll, q, onlyX, dims, dwhOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    const el = box.current; if (!el || !view.W) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0.35, Math.min((r.width - 20) / view.W, (r.height - 20) / view.H, 1.1));
    setZ({ k, x: (r.width - view.W * k) / 2, y: (r.height - view.H * k) / 2 });
  };
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); setSize((p) => (Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1 ? p : { w: r.width, h: r.height })); fit(); };
    read();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", read); return () => window.removeEventListener("resize", read); }
    const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, [view.W, view.H, full, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [full]);

  const anchorLane = (laneId, src) => {
    const n = view.ln.find((x) => x.l.lane === laneId);
    if (!n) return null;
    if (n.open) { const i = n.l.cols.findIndex((s) => s.name === src); if (i >= 0 && i < n.rows) return { x: n.x + view.nw, y: n.y + HEAD + 1 + i * ROW + ROW / 2 }; }
    return { x: n.x + view.nw, y: n.y + HEAD / 2 };
  };
  const anchorTgt = (table, lineageId) => {
    const n = view.tg.find((x) => x.tb.table === table); if (!n) return null;
    if (n.open) { const i = n.shown.findIndex((c) => c.lineage_id === lineageId); if (i >= 0 && i < n.n) return { x: n.x, y: n.y + HEAD + 1 + i * ROW + ROW / 2 }; }
    return { x: n.x, y: n.y + HEAD / 2 };
  };
  const anchorDwh = (fileName, field) => {
    const n = view.sn.find((x) => x.f.file === fileName); if (!n) return null;
    if (n.open && field) { const i = n.flds.findIndex((f) => f.name === field); if (i >= 0 && i < n.n) return { x: n.x, y: n.y + HEAD + 1 + i * ROW + ROW / 2 }; }
    return { x: n.x, y: n.y + HEAD / 2 };
  };
  const wires = [], merged = new Map();
  targets.forEach((tg) => tg.cols.forEach((c) => {
    if (!c.src) return;
    const a = anchorLane(c.lane, c.src), b = anchorTgt(tg.table, c.lineage_id);
    if (!a || !b) return;
    const k = `${a.y}>${b.y}`;
    if (!merged.has(k)) merged.set(k, { a, b, items: [] });
    merged.get(k).items.push({ ...c, table: tg.table });
  }));
  merged.forEach((m) => wires.push(m));
  const dwhWires = [];
  if (dwhOn) {
    const sm = new Map();
    targets.forEach((tg) => tg.cols.forEach((c) => {
      if (!c.sei || !c.sei.has) return;
      c.sei.fields.forEach((pr) => {
        const a0 = anchorTgt(tg.table, c.lineage_id), b = anchorDwh(pr.file, pr.field);
        if (!a0 || !b) return;
        const a = { x: a0.x + view.nw, y: a0.y };
        const k = `${a.y}>${b.y}`;
        if (!sm.has(k)) sm.set(k, { a, b, items: [] });
        sm.get(k).items.push({ ...c, table: tg.table, file: pr.file, field: pr.field });
      });
    }));
    sm.forEach((m) => dwhWires.push(m));
  }
  const total = summarise(targets.flatMap((tg) => tg.cols));
  const reached = targets.reduce((a, tg) => a + tg.cols.filter((c) => c.sei && c.sei.has).length, 0);
  const exportCsv = () => {
    const blob = new Blob([toCsv(canvasRows(targets))], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `historical_lineage_${String(file || "all").replace(/[^A-Za-z0-9_-]+/g, "_")}.csv`; a.click();
  };
  const selected = sel && targets.find((x) => x.table === sel.table)?.cols.find((c) => c.lineage_id === sel.id);
  const ghost = { font: "inherit", fontSize: 10.5, padding: "3px 9px", cursor: "pointer", border: `1px solid ${t.border}`, borderRadius: 3, background: t.panel, color: t.accent };
  const eyebrow = { fontSize: 9.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: t.textMuted };
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const canvasH = full ? undefined : Math.max(380, Math.min(760, vh - 430));

  const modeBar = (
    <span role="group" aria-label="How to read this" style={{ display: "inline-flex", borderRadius: 3, overflow: "hidden", border: `1px solid ${t.border}`, flexShrink: 0 }}>
      {[["picture", "Picture"], ["reading", "Reading"], ["table", "Table"]].map(([k, label]) => (
        <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); if (k !== "picture") setFull(false); }}
          title={k === "picture" ? "The wiring: which SEI fields each lane feeds, and what is computed on the way" : k === "reading" ? "The same mapping in sentences — what arrives, what changes on the way, what still wants approval" : "The same lineage as rows: source column, transformation, SEI field, where it goes today"}
          style={{ font: "inherit", fontSize: 10.5, padding: "3px 11px", border: 0, cursor: "pointer", background: mode === k ? t.accent : t.panel, color: mode === k ? "#fff" : t.accent }}>{label}</button>))}
    </span>);

  if (!data) return <div style={{ padding: 24, fontSize: 12, color: t.textMuted }}>Loading the historical lineage…</div>;
  if (!targets.length) return (
    <div style={{ padding: 18, fontSize: 12.5, color: t.sub, border: `1px solid ${t.border}`, borderRadius: 6, background: t.panel }}>
      {modeBar} <span style={{ marginLeft: 8 }}>No lineage rows for {file ? <span style={{ fontFamily: MONO }}>{file}</span> : "this selection"}. Apply sql/87 and load the v12 workbook, or pick another dat file.</span>
    </div>);

  const head = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 9 }}>
      {modeBar}
      <span style={eyebrow}>Where it lands</span>
      <span style={{ fontSize: 10.5, color: t.sub }}>{lanes.length} lane{lanes.length === 1 ? "" : "s"} · {targets.length} dat file{targets.length === 1 ? "" : "s"} · {total.total} field link{total.total === 1 ? "" : "s"} · <b style={{ color: total.transformed ? "#e67e22" : "#159943" }}>{total.transformed} transformed</b>{total.branchy ? ` · ${total.branchy} branch or join` : ""}</span>
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Find a column…" aria-label="Find a column" style={{ font: "inherit", fontSize: 11, padding: "4px 9px", width: 150, border: `1px solid ${t.border}`, borderRadius: 3, background: t.panel, color: t.text }} />
      <button type="button" onClick={() => setOnlyX((v) => !v)} style={{ ...ghost, ...(onlyX ? { background: "#e67e22", borderColor: "#e67e22", color: "#fff" } : {}) }}>only transformed</button>
      {dwhFiles.length > 0 && <button type="button" onClick={() => setShowDwh((v) => !v)} aria-pressed={dwhOn} title={`${reached} of ${total.total} target fields reach an IMDS column today, by exact normalised name`} style={{ ...ghost, ...(dwhOn ? { background: DWH_C, borderColor: DWH_C, color: "#fff" } : {}) }}>IMDS today · {reached} of {total.total}</button>}
      <button type="button" onClick={exportCsv} style={ghost} title="every field link as a row: lane, source column, transformation, SEI field, STAR field, IMDS columns">⤓ export CSV</button>
      {mode === "picture" && <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
        <button type="button" style={ghost} onClick={() => setOpen(new Set([...lanes.map((l) => `l:${l.lane}`), ...targets.map((x) => `t:${x.table}`), ...(dwhOn ? dwhFiles.map((f) => `s:${f.file}`) : [])]))}>open all</button>
        <button type="button" style={ghost} onClick={() => setOpen(new Set())}>close all</button>
        <button type="button" style={ghost} onClick={fit}>fit</button>
        <button type="button" style={ghost} onClick={() => setFull((v) => !v)}>{full ? "✕ close · Esc" : "⤢ full screen"}</button>
      </span>}
    </div>);

  if (mode === "reading") {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>{modeBar}<span style={{ fontSize: 10.5, color: t.textMuted }}>In sentences. Switch to Picture for the wiring, Table for the rows.</span></div>
        <HistReading t={t} data={{ ...data, targets }} file={file} />
      </div>);
  }
  if (mode === "table") {
    const rows = canvasRows(targets).filter((r) => (!onlyX || r.transformed === "Y") && (!q || `${r.target_field} ${r.source_column} ${r.star_field}`.toLowerCase().includes(q.toLowerCase())));
    const th = { textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" };
    const td = { padding: "6px 10px 6px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub, fontSize: 11.5, lineHeight: 1.45 };
    return (
      <div>
        {head}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["Lane", "Source column", "Transformation rule", "Operation", "SEI dat file · field", "Type", "Rule · approval · dictionary", "Match", "STAR field today", "IMDS column today"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={`${r.lineage_id}-${r.imds_columns}`}>
                <td style={td}><span style={{ fontSize: 9.5, fontWeight: 800, color: LANE_C[r.lane] || "#6b7884", border: `1px solid ${LANE_C[r.lane] || "#6b7884"}`, borderRadius: 3, padding: "0 5px", whiteSpace: "nowrap" }}>{LANE_LABEL[r.lane] || r.lane}</span><div style={{ fontSize: 10, color: t.textMuted, fontFamily: MONO }}>{r.lineage_id}</div></td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: t.text }}>{r.source_column || <span style={{ color: "#c1113a" }}>no source</span>}</td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 10.5, maxWidth: 360, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.transformation || <span style={{ color: "#c96a12" }}>no rule written</span>}</td>
                <td style={td}><span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: (OP_META[Object.keys(OP_META).find((k) => OP_META[k].label === r.operation)] || {}).c || t.sub }}>{r.operation}</span></td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{r.dat_file}<div style={{ fontWeight: 700, color: t.text }}>{r.target_field}</div></td>
                <td style={td}>{r.type}{r.length ? `(${r.length})` : ""}{r.mandatory ? <div style={{ fontSize: 10, color: t.textMuted }}>mandatory {r.mandatory}</div> : null}</td>
                <td style={td}><div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{[r.rule_status, r.approval, r.dictionary].map((s, j) => <span key={j} style={{ fontSize: 9.5, fontWeight: 800, color: STATUS_COLOR(s), border: `1px solid ${STATUS_COLOR(s)}`, borderRadius: 3, padding: "0 5px" }}>{s || "—"}</span>)}</div></td>
                <td style={td}><span style={{ fontSize: 9.5, fontWeight: 800, color: STATUS_COLOR(r.match), border: `1px solid ${STATUS_COLOR(r.match)}`, borderRadius: 3, padding: "0 5px" }}>{r.match || "—"}</span></td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{r.star_field || <span style={{ color: t.textMuted }}>—</span>}</td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{r.imds_columns || <span style={{ color: t.textMuted }}>—</span>}</td>
              </tr>))}</tbody>
          </table>
          {rows.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>No field link matches the filter.</div>}
        </div>
      </div>);
  }

  const nodeBox = (c, extra) => ({ position: "absolute", width: view.nw, background: t.panel, borderRadius: 5, border: `1px solid ${t.border}`, borderTop: `3px solid ${c}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(16,25,59,.07)", ...extra });
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const headBtn = { display: "flex", gap: 7, alignItems: "center", width: "100%", textAlign: "left", font: "inherit", background: "none", border: 0, padding: "6px 9px", cursor: "pointer", color: "inherit", height: HEAD };
  const rowBtn = (on) => ({ display: "flex", gap: 6, alignItems: "center", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", color: "inherit", background: on ? "rgba(15,71,117,.12)" : "none", border: 0, borderTop: `1px solid ${t.border}`, padding: "3px 8px 3px 10px", height: ROW });
  const moreBtn = { width: "100%", height: ROW, font: "inherit", fontSize: 9, background: "none", cursor: "pointer", border: 0, borderTop: `1px solid ${t.border}`, color: t.accent };
  const wirePath = (m) => { const mx = (m.a.x + m.b.x) / 2; return `M${m.a.x},${m.a.y} C${mx},${m.a.y} ${mx},${m.b.y} ${m.b.x},${m.b.y}`; };
  const pickWire = (m) => { const one0 = m.items[0]; if (m.items.length > 1) { setOpen((st) => new Set(st).add(`t:${one0.table}`)); setSel({ table: one0.table, id: one0.lineage_id }); } else { const same = sel && sel.id === one0.lineage_id; setSel(same ? null : { table: one0.table, id: one0.lineage_id }); } };

  const inner = (
    <>
      {head}
      <div style={{ display: "flex", gap: 14, alignItems: "stretch", flex: full ? 1 : undefined, minHeight: full ? 0 : undefined }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div ref={box}
            onPointerDown={(e) => { if (e.target.closest("[data-node]")) return; drag.current = { x: e.clientX - z.x, y: e.clientY - z.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (drag.current) setZ((s) => ({ ...s, x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            onWheel={(e) => { e.preventDefault(); const r = box.current.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; setZ((s) => { const k = Math.max(0.35, Math.min(2, s.k * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); return { k, x: mx - (mx - s.x) * (k / s.k), y: my - (my - s.y) * (k / s.k) }; }); }}
            style={{ position: "relative", overflow: "hidden", height: canvasH, flex: full ? 1 : undefined, minHeight: full ? 0 : undefined, background: t.bg, borderRadius: 4, border: `1px solid ${t.border}`, cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}>
            <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(${z.x}px,${z.y}px) scale(${z.k})` }}>
              <svg width={view.W} height={view.H} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
                {wires.map((m, i) => {
                  const one = m.items.length === 1 ? m.items[0] : null;
                  const vis = m.items.some(hit);
                  const lit = !sel || m.items.some((x) => x.lineage_id === sel.id);
                  const op = !vis ? 0.07 : lit ? 0.8 : 0.16;
                  const w = Math.min(7, 1.3 + Math.log2(m.items.length + 1) * 1.7);
                  const c = one ? OP_META[one.__op.op].c : (m.items.some((x) => x.__op.transformed) ? "#e67e22" : "#9aa7b2");
                  const d = wirePath(m), mx = (m.a.x + m.b.x) / 2, my = (m.a.y + m.b.y) / 2;
                  return (
                    <g key={i}>
                      {vis && <path data-node d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, w + 10)} strokeLinecap="round" onClick={() => pickWire(m)} style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                        <title>{one ? `${one.src} → ${one.table}.${one.col}\n${OP_META[one.__op.op].label}` : `${m.items.length} fields into ${m.items[0].table} — click to open the file`}</title></path>}
                      <path d={d} fill="none" stroke={c} strokeWidth={w} opacity={op} strokeLinecap="round" />
                      {m.items.length > 1 && vis && <g data-node onClick={() => pickWire(m)} style={{ pointerEvents: "all", cursor: "pointer" }}>
                        <circle cx={mx} cy={my} r="8.5" fill={t.panel} stroke={c} strokeWidth="1.2" opacity={op} />
                        <text x={mx} y={my + 3} textAnchor="middle" fill={c} opacity={op} fontFamily={MONO} fontSize="9" fontWeight="700">{m.items.length}</text></g>}
                    </g>);
                })}
                {dwhWires.map((m, i) => {
                  const vis = m.items.some(hit);
                  const lit = !sel || m.items.some((x) => x.lineage_id === sel.id);
                  const op = !vis ? 0.07 : lit ? 0.75 : 0.14;
                  const w = Math.min(7, 1.3 + Math.log2(m.items.length + 1) * 1.7);
                  const d = wirePath(m), mx = (m.a.x + m.b.x) / 2, my = (m.a.y + m.b.y) / 2;
                  const one = m.items.length === 1 ? m.items[0] : null;
                  return (
                    <g key={`d-${i}`}>
                      {vis && <path data-node d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, w + 10)} strokeLinecap="round" onClick={() => pickWire(m)} style={{ pointerEvents: "stroke", cursor: "pointer" }}>
                        <title>{one ? `${one.table}.${one.col} → today: ${one.file}.${one.field}${one.sei.source ? ` via STAR ${one.sei.source}` : ""}` : `${m.items.length} fields reach ${m.items[0].file} — click to open the file`}</title></path>}
                      <path d={d} fill="none" stroke="#159943" strokeWidth={w} opacity={op} strokeLinecap="round" strokeDasharray="6 4" />
                      {m.items.length > 1 && vis && <g data-node onClick={() => pickWire(m)} style={{ pointerEvents: "all", cursor: "pointer" }}>
                        <circle cx={mx} cy={my} r="8.5" fill={t.panel} stroke="#159943" strokeWidth="1.2" opacity={op} />
                        <text x={mx} y={my + 3} textAnchor="middle" fill="#159943" opacity={op} fontFamily={MONO} fontSize="9" fontWeight="700">{m.items.length}</text></g>}
                    </g>);
                })}
              </svg>
              {view.ln.map((n) => (
                <div key={n.l.lane} style={nodeBox(LANE_C[n.l.lane] || "#6b7884", { left: n.x, top: n.y })}>
                  <button type="button" data-node onClick={() => toggle(`l:${n.l.lane}`)} style={headBtn}>
                    <span style={{ fontSize: 9, color: t.textMuted, width: 9, transform: n.open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{LANE_LABEL[n.l.lane] || n.l.lane}</span>
                      <span style={{ display: "block", fontFamily: MONO, fontSize: 9, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.l.lane} · {n.l.n} mappings{n.l.x ? ` · ${n.l.x} with a rule` : ""}</span>
                    </span>
                    <span style={{ fontSize: 9, color: t.textMuted }}>{n.l.cols.length} columns</span>
                  </button>
                  {n.open && <div style={{ borderTop: `1px solid ${t.border}` }}>
                    {n.l.cols.slice(0, n.rows).map((s) => (
                      <button key={s.name} type="button" data-node onClick={() => setQ(s.name)} title={`${s.name} feeds ${s.n} SEI field${s.n === 1 ? "" : "s"}`} style={rowBtn(false)}>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                        <span style={{ fontSize: 8.5, color: t.textMuted }}>{s.n}</span>
                      </button>))}
                    {n.rows < n.l.cols.length && <button type="button" data-node onClick={() => setShowAll((s) => new Set(s).add(`l:${n.l.lane}`))} style={moreBtn}>+{n.l.cols.length - n.rows} more columns</button>}
                  </div>}
                </div>))}
              {view.tg.map((n) => (
                <div key={n.tb.table} style={nodeBox(SEI_C, { left: n.x, top: n.y })}>
                  <button type="button" data-node onClick={() => toggle(`t:${n.tb.table}`)} onDoubleClick={() => onPickFile && onPickFile(n.tb.table)} style={headBtn}>
                    <span style={{ fontSize: 9, color: t.textMuted, width: 9, transform: n.open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: MONO, fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.tb.table}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}><MixBar sum={n.tb.sum} w={86} /><span style={{ fontSize: 8.5, color: t.textMuted }}>{n.tb.sum.transformed} of {n.tb.sum.total} computed</span></span>
                    </span>
                  </button>
                  {n.open && <div style={{ borderTop: `1px solid ${t.border}` }}>
                    {n.shown.slice(0, n.n).map((c) => { const on = sel && sel.id === c.lineage_id; const meta = OP_META[c.__op.op]; return (
                      <button key={c.lineage_id} type="button" data-node onClick={() => setSel(on ? null : { table: n.tb.table, id: c.lineage_id })} title={`${c.src || "no source"} → ${c.col}\n${meta.note}`} style={rowBtn(on)}>
                        <i style={{ width: 6, height: 6, borderRadius: 1.5, flexShrink: 0, background: meta.c }} />
                        <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: on ? 700 : 400 }}>{c.col}</span>
                        <i title={LANE_LABEL[c.lane] || c.lane} style={{ width: 5, height: 5, borderRadius: "50%", background: LANE_C[c.lane] || "#6b7884", flexShrink: 0 }} />
                        {c.__op.steps > 0 && <Pips n={c.__op.steps} />}
                        <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: meta.c, flexShrink: 0 }}>{meta.label}</span>
                      </button>); })}
                    {n.n < n.shown.length && <button type="button" data-node onClick={() => setShowAll((s) => new Set(s).add(`t:${n.tb.table}`))} style={moreBtn}>+{n.shown.length - n.n} more fields</button>}
                    {!n.shown.length && <div style={{ padding: "6px 10px", fontSize: 9.5, color: t.textMuted }}>no field matches the filter</div>}
                  </div>}
                </div>))}
              {view.sn.map((n) => (
                <div key={`s:${n.f.file}`} style={nodeBox(DWH_C, { left: n.x, top: n.y, borderStyle: "dashed solid solid solid" })}>
                  <button type="button" data-node onClick={() => toggle(`s:${n.f.file}`)} style={headBtn} title={`${n.f.file} — ${n.f.n} of this selection's SEI fields reach it today`}>
                    <span style={{ fontSize: 9, color: t.textMuted, width: 9, transform: n.open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: MONO, fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.f.file}</span>
                      <span style={{ display: "block", fontSize: 9, color: t.textMuted }}>IMDS today · {n.f.n} field{n.f.n === 1 ? "" : "s"} · by exact name</span>
                    </span>
                  </button>
                  {n.open && <div style={{ borderTop: `1px solid ${t.border}` }}>
                    {n.flds.slice(0, n.n).map((f) => (
                      <button key={f.name} type="button" data-node onClick={() => setQ(f.name)} style={rowBtn(false)}>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ fontSize: 8.5, color: t.textMuted }}>{f.type || ""}</span>
                      </button>))}
                    {n.n < n.flds.length && <button type="button" data-node onClick={() => setShowAll((s) => new Set(s).add(`s:${n.f.file}`))} style={moreBtn}>+{n.flds.length - n.n} more columns</button>}
                  </div>}
                </div>))}
            </div>
            <div style={{ position: "absolute", left: 10, bottom: 8, fontSize: 9.5, color: t.textMuted, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(OP_META).map(([k, m]) => <span key={k} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><i style={{ width: 8, height: 8, borderRadius: 2, background: m.c }} />{m.label}</span>)}
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><i style={{ width: 14, height: 0, borderTop: "2px dashed #159943" }} />IMDS today, by exact name</span>
            </div>
          </div>
          {selected && (
            <div style={{ marginTop: 10, border: `1px solid ${t.border}`, borderLeft: `3px solid ${OP_META[selected.__op.op].c}`, borderRadius: 6, background: t.panel, padding: "10px 14px", fontSize: 12, color: t.sub }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontFamily: MONO, color: t.text }}>{selected.src || "no source"} → {sel.table}.{selected.col}</b>
                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: OP_META[selected.__op.op].c }}>{OP_META[selected.__op.op].label}</span>
                <span style={{ fontSize: 10, color: LANE_C[selected.lane] || "#6b7884", fontWeight: 700 }}>{LANE_LABEL[selected.lane] || selected.lane}</span>
                <span style={{ fontSize: 10.5, color: t.textMuted, fontFamily: MONO }}>{selected.lineage_id}</span>
                <span style={{ flex: 1 }} />
                <button type="button" style={ghost} onClick={() => setSel(null)}>close</button>
              </div>
              <div style={{ fontSize: 10.5, color: t.textMuted, margin: "4px 0" }}>{OP_META[selected.__op.op].note}</div>
              <pre style={{ fontFamily: MONO, fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: "8px 10px", margin: "6px 0", color: t.text, maxHeight: 220, overflow: "auto" }}>{selected.t1 || "no rule written on this mapping"}</pre>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
                {[["rule", selected.rule_status], ["approval", selected.approval], ["dictionary", selected.dictionary], ["match", selected.match]].map(([k, v]) => <span key={k}>{k} <b style={{ color: STATUS_COLOR(v) }}>{v || "—"}</b></span>)}
                <span>type <b style={{ color: t.text }}>{selected.type || "?"}{selected.length ? `(${selected.length})` : ""}</b></span>
                {selected.sei && selected.sei.has && <span>today → <b style={{ fontFamily: MONO, color: t.text }}>{selected.sei.fields.map((f) => `${f.file}.${f.field}`).join("; ")}</b>{selected.sei.source ? <span style={{ color: t.textMuted }}> via STAR {selected.sei.source}</span> : null}</span>}
              </div>
            </div>)}
        </div>
      </div>
    </>);

  if (full) return (
    <div role="dialog" aria-label="Historical lineage, full screen" style={{ position: "fixed", inset: 0, zIndex: 1000, background: t.panel, display: "flex", flexDirection: "column", padding: "12px 16px 14px" }}>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}><b style={{ color: t.text }}>Historical lineage · {file || "all dat files"}</b> · where it lands, field by field · click a wire for its rule</div>
      {inner}
    </div>);
  return <div>{inner}</div>;
}
