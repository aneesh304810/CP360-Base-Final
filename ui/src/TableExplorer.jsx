import React, { useEffect, useState } from "react";
import { lineageApi } from "./lineage_api_additions.js";

// =====================================================================
// TableExplorer — one table in focus.
//
// What feeds it (with how thickly), on which columns, and what it feeds.
// It is the drill from a matrix cell, not a sibling tab: the matrix says
// THAT a link exists and how thick it is, this says what is actually on it.
//
// The old explorer read both sides from /dependency-network, whose edges
// come from legacy_lineage — whose spine ends at DWH. So within it a
// warehouse table never feeds anything, and "downstream" was an empty
// panel for every DIM_ and FACT_ table. Downstream now comes from
// legacy_table_dependency, which is table-level and can express
// warehouse-to-warehouse.
// =====================================================================

const mono = "Roboto Mono, monospace";
const INK = "#233240", SUB = "#7b8894", RULE = "#c9d4dc";
const ACCENT = "#0f4775", DANGER = "#c1113a", WARN = "#a8560f", OK = "#159943";

export default function TableExplorer({ dataSource = "PBDW", table,
                                        trail = [], onFocus, onBack }) {
  const ds = (dataSource || "PBDW").toUpperCase();
  const [d, setD] = useState(null);
  const [src, setSrc] = useState(null);   // narrow the column links to one feed

  useEffect(() => { setSrc(null); }, [table]);

  useEffect(() => {
    if (!table) return;
    let dead = false;
    setD(null);
    lineageApi.tableExplorer(table, ds, src).then((r) => { if (!dead) setD(r); });
    return () => { dead = true; };
  }, [table, ds, src]);

  if (!table)
    return <div style={{ padding: 20, fontSize: 12, color: SUB,
                         textAlign: "center" }}>
      Click a cell in the Matrix to open a table here.</div>;

  if (!d)
    return <div style={{ padding: 20, fontSize: 12, color: SUB }}>
      Loading {table}…</div>;

  const pct = d.columns ? Math.round((d.mapped / d.columns) * 100) : 0;

  return (
    <div>
      {/* ---- where you are, and how you got here ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 9,
                    flexWrap: "wrap", marginBottom: 13 }}>
        {onBack && (
          <button onClick={onBack} title="Back to the matrix"
            style={{ fontSize: 11.5, fontFamily: "inherit", cursor: "pointer",
                     border: `1px solid ${RULE}`, borderRadius: 4,
                     background: "#fff", color: ACCENT, padding: "5px 12px" }}>
            ← Matrix</button>)}
        {trail.slice(0, -1).map((x, i) => (
          <span key={x + i} style={{ fontSize: 12, color: SUB }}>
            <span style={{ color: "#31bced", cursor: "pointer" }}
              onClick={() => onFocus && onFocus(x, i)}>{x}</span>
            <span style={{ margin: "0 7px", color: "#c2ccd4" }}>›</span>
          </span>))}
        <h2 style={{ margin: 0, fontFamily: mono, fontSize: 16,
                     fontWeight: 600, color: INK }}>{d.table}</h2>
        {d.table_type && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                         background: "#e0f5fd", color: "#0091bf",
                         borderRadius: 3, padding: "2px 7px" }}>
            {String(d.table_type).toUpperCase()}</span>)}
        <span style={{ fontSize: 11, color: SUB }}>
          {d.functional_group} · {d.columns} columns · {d.mapped} mapped ({pct}%)
          {" "}· fed by {d.upstream.length} source{d.upstream.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ display: "grid", alignItems: "start", gap: 14,
                    gridTemplateColumns: "300px minmax(0,1fr) 280px" }}>

        {/* ---------------- upstream ---------------- */}
        <Panel title={`Feeds it — upstream (${d.upstream.length})`}>
          {!d.upstream.length && <Empty>Nothing feeds this table.</Empty>}
          {d.upstream.map((u) => {
            const on = src === u.src;
            return (
              <div key={u.src} onClick={() => setSrc(on ? null : u.src)}
                title={on ? "Show all column links again"
                          : "Show only this source's column links"}
                style={{ padding: "9px 13px", cursor: "pointer",
                         borderTop: `1px solid #edf1f4`,
                         background: on ? "#eef3f8" : undefined }}>
                <div style={{ fontSize: 11.5, fontWeight: u.defect ? 600 : 500,
                              color: u.defect ? DANGER : INK }}>
                  {u.defect ? "Not a source — defect in the sheet"
                            : (u.dataset || u.src)}</div>
                <div title={u.src}
                  style={{ fontFamily: mono, fontSize: 9, color: SUB,
                           marginTop: 2, overflow: "hidden",
                           textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.src}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7,
                              marginTop: 6 }}>
                  <span style={{ flexGrow: 1, height: 5, background: "#edf1f4",
                                 borderRadius: 999, overflow: "hidden" }}>
                    <i style={{ display: "block", height: "100%",
                                width: `${u.share}%`, background: ACCENT,
                                borderRadius: 999 }} /></span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: SUB }}>
                    {u.links} col{u.links === 1 ? "" : "s"}</span>
                </div>
              </div>);
          })}
          {d.unsourced > 0 && (
            <div style={{ padding: "10px 13px", borderTop: `1px solid #edf1f4`,
                          fontSize: 11, color: SUB, lineHeight: 1.5 }}>
              <b style={{ color: INK, fontWeight: 600 }}>{d.unsourced}</b> of its
              {" "}{d.columns} columns have no source at all — derived in the
              warehouse, or a gap. The catalogue cannot tell which.</div>)}
        </Panel>

        {/* ---------------- the links themselves ---------------- */}
        <Panel title={src ? `Column links — ${src}` : "Column links — all sources"}
          right={src && (
            <button onClick={() => setSrc(null)}
              style={{ fontSize: 10.5, fontFamily: "inherit", cursor: "pointer",
                       border: "none", background: "none", color: "#31bced" }}>
              show all</button>)}>
          <div style={{ display: "grid", gap: 8, padding: "6px 13px",
                        gridTemplateColumns: "minmax(0,1fr) 16px minmax(0,1fr) 62px",
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                        textTransform: "uppercase", color: SUB }}>
            <span>Source column</span><span /><span>Warehouse column</span>
            <span style={{ textAlign: "right" }}>Type</span>
          </div>
          {!d.column_links.length && <Empty>No columns on this table.</Empty>}
          {d.column_links.map((c, i) => (
            <div key={`${c.dwh_column}:${c.src_column}:${i}`}
              style={{ display: "grid", gap: 8, alignItems: "center",
                       padding: "6px 13px", borderTop: "1px solid #edf1f4",
                       gridTemplateColumns: "minmax(0,1fr) 16px minmax(0,1fr) 62px" }}>
              <span title={c.src_column || "no source column"}
                style={{ fontFamily: mono, fontSize: 10,
                         color: c.src_column ? SUB : "#c9d4dc",
                         fontStyle: c.src_column ? "normal" : "italic",
                         overflow: "hidden", textOverflow: "ellipsis",
                         whiteSpace: "nowrap" }}>
                {c.src_column || "none"}</span>
              <span style={{ color: c.is_mapped === "Y" ? OK : "#c9d4dc",
                             fontSize: 11, textAlign: "center" }}>→</span>
              <span title={c.dwh_column}
                style={{ fontFamily: mono, fontSize: 10, color: INK,
                         overflow: "hidden", textOverflow: "ellipsis",
                         whiteSpace: "nowrap" }}>{c.dwh_column}</span>
              <span style={{ fontFamily: mono, fontSize: 9.5, color: SUB,
                             textAlign: "right", overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fmtType(c)}</span>
            </div>))}
          {d.column_links_total > d.column_links.length && (
            <div style={{ padding: "9px 13px", borderTop: "1px solid #edf1f4",
                          fontSize: 11, color: SUB }}>
              showing {d.column_links.length} of {d.column_links_total} — narrow
              by clicking a source on the left</div>)}
        </Panel>

        {/* ---------------- downstream ---------------- */}
        <Panel title={`It feeds — downstream (${d.downstream.length})`}>
          {!d.downstream.length && (
            <Empty>
              Nothing in the dependency sheet reads this table. For a warehouse
              table that is usually correct — it is the end of the chain.
            </Empty>)}
          {d.downstream.map((x) => (
            <div key={x.tgt} onClick={() => onFocus && onFocus(x.tgt)}
              title={`Open ${x.tgt}`}
              style={{ display: "flex", alignItems: "center", gap: 8,
                       padding: "8px 13px", cursor: "pointer",
                       borderTop: "1px solid #edf1f4" }}>
              <span style={{ flexGrow: 1, fontFamily: mono, fontSize: 10.5,
                             color: INK, overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {x.tgt}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: SUB }}>
                {x.links}</span>
            </div>))}
          {d.downstream.length > 0 && (
            <div style={{ margin: 10, padding: "10px 13px", borderRadius: 8,
                          background: "#fdf6ec" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: WARN }}>
                Blast radius</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 3,
                            lineHeight: 1.5 }}>
                If {d.table} is late or wrong, {d.downstream.length} table
                {d.downstream.length === 1 ? "" : "s"} downstream
                {d.downstream.length === 1 ? " is" : " are"} stale.</div>
            </div>)}
        </Panel>
      </div>
    </div>);
}

function Panel({ title, right, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${RULE}`,
                  borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 13px", borderBottom: `1px solid ${RULE}` }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                       textTransform: "uppercase", color: SUB }}>{title}</span>
        <span style={{ marginLeft: "auto" }}>{right}</span>
      </div>
      {children}
    </div>);
}

const Empty = ({ children }) => (
  <div style={{ padding: "14px 13px", fontSize: 11, color: SUB,
                lineHeight: 1.5 }}>{children}</div>);

// One fact, written the way a developer writes it — same rule the field table
// uses, so the two screens do not disagree about how a type looks.
function fmtType(c) {
  const ty = String(c.dwh_type || "").trim();
  if (!ty) return "—";
  const len = String(c.dwh_length == null ? "" : c.dwh_length)
    .trim().replace(/\.0+$/, "");
  return len ? `${ty}(${len})` : ty;
}
