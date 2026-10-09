// The step after STAR -> IMDS on the source view: the SEI feed files that
// replace one STAR feed's fields after cutover.
//
// The lineage starts at the source files, STAR and UAF, and a STAR file
// opens to what it loads into IMDS. SEI is not a source file of that
// picture; it is what comes next. So this sits under the picture, in the
// Source view's own grammar, and reads left to right the way the cutover
// does: the STAR field, the SEI feed file and field the mapping document
// names for it, how well that resolved to the published feed spec, and the
// IMDS columns the field reaches. Drawn only when a mapping document covers
// the feed; a UAF message or a feed without one shows nothing here.
import React, { useEffect, useState } from "react";
import { mappingDocs, FILE_STATUS_INFO, fileStatusLabel } from "./seiCrosswalkApi.js";

const navy = "#233240", muted = "#7b8894", line = "#c9d4dc", accent = "#31bced";
const sei = "#0091bf", danger = "#c1113a", warning = "#e67e22", success = "#159943";
const mono = "Roboto Mono, monospace";

function Pill({ c, children, title }) {
  return (
    <span title={title} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${c}`, color: c, whiteSpace: "nowrap" }}>{children}</span>);
}

export default function SeiNextStep({ t, feed, ds, initial, onOpenColumn }) {
  const [d, setD] = useState(initial || null);
  const [showFields, setShowFields] = useState(Boolean(initial?.open));
  const [file, setFile] = useState(null);
  useEffect(() => {
    if (initial || !feed) return undefined;
    let on = true;
    setD(null); setFile(null);
    mappingDocs.feedSeiFiles(feed, ds).then((x) => { if (on) setD(x); });
    return () => { on = false; };
  }, [feed, ds]);                                      // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || !(d.fields || []).length) return null;
  const T = d.totals || {};
  const fields = (d.fields || []).filter((f) => !file || (f.sei_files || []).includes(file));
  const pct = T.star_fields ? Math.round(100 * (T.with_sei || 0) / T.star_fields) : 0;

  return (
    <div style={{ maxWidth: 1000, margin: "26px auto 0" }}>
      {/* the next node on the spine: SEI */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 2.5, background: line, position: "relative" }}>
          <span style={{ position: "absolute", right: -1, top: -4.5, borderLeft: `9px solid ${line}`,
            borderTop: "6px solid transparent", borderBottom: "6px solid transparent" }} />
        </div>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center",
          fontSize: 22, border: `2.5px solid ${sei}`, boxShadow: "0 2px 6px rgba(20,40,60,.08)" }}>☁️</div>
        <div style={{ minWidth: 150 }}>
          <b style={{ fontSize: 13, fontWeight: 500, display: "block" }}>SEI feed files</b>
          <small style={{ fontSize: 10.5, color: muted }}>after cutover · replaces {feed}</small>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <p style={{ fontSize: 12.5, color: muted, textAlign: "center", margin: "0 auto 14px", maxWidth: "74ch" }}>
        {d.headline}.{T.from_layout ? ` ${T.from_layout} of the fields are in the published layout but no mapping document mentions them.` : ""}
        {T.open_dependencies ? ` ${T.open_dependencies} carry an open dependency.` : ""}
        {" "}Every mapping here is a draft until an approved crosswalk says otherwise.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <Pill c={pct >= 70 ? success : pct >= 30 ? warning : danger}>{pct}% of fields have a SEI source</Pill>
        {(d.by_file_status || []).map((x) => (
          <Pill key={x.key} c={(FILE_STATUS_INFO[x.key] || {}).c || muted}>{fileStatusLabel(x.key)} · {x.n}</Pill>))}
      </div>

      {/* one card per SEI feed file, in the Source view's card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10, marginBottom: 14 }}>
        {(d.files || []).map((f) => {
          const on = file === f.file;
          return (
            <button key={f.file} type="button" onClick={() => { setFile(on ? null : f.file); setShowFields(true); }}
              style={{ textAlign: "left", border: `1px solid ${on ? sei : line}`, borderLeft: `3px solid ${sei}`, borderRadius: 7,
                background: on ? "#e0f5fd" : "#fff", padding: "10px 13px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 13.5, color: navy, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file}</div>
              <div style={{ fontSize: 10.5, color: muted }}>
                {f.in_register ? `${f.domain || "SEI feed"}${f.frequency && f.frequency !== "UNKNOWN" ? ` · ${f.frequency}` : ""}` : "not in the SEI feed register"}
              </div>
              <div style={{ fontSize: 12, color: navy, marginTop: 6 }}>
                <b style={{ fontSize: 17, color: sei }}>{f.fields}</b> field{f.fields === 1 ? "" : "s"} of {feed}
                <span style={{ color: f.verified === f.fields ? success : f.verified ? warning : muted }}> · {f.verified} verified in the feed spec</span>
              </div>
              {(f.imds_tables || []).length > 0 && (
                <div style={{ fontSize: 10.5, color: muted, fontFamily: mono, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  → {f.imds_tables.join(" · ")}</div>)}
            </button>);
        })}
      </div>

      <button type="button" onClick={() => setShowFields(!showFields)}
        style={{ border: `1px solid ${line}`, borderRadius: 4, background: "#fff", padding: "7px 14px", cursor: "pointer",
          fontSize: 12, fontFamily: "inherit", color: accent }}>
        {showFields ? "Hide the fields" : `See which SEI field replaces each of the ${T.star_fields} fields →`}
      </button>

      {showFields && (
        <div style={{ marginTop: 12, border: `1px solid ${line}`, borderRadius: 7, overflow: "auto", maxHeight: 520, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: muted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".5px" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${line}` }}>{feed} field today</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${line}` }}>→ SEI feed file · field after cutover</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${line}` }}>Resolved</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${line}` }}>Lands in IMDS</th>
            </tr></thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={`${f.norm}-${i}`} style={{ borderTop: `1px solid #eef2f5` }}>
                  <td style={{ padding: "7px 10px", color: navy, verticalAlign: "top" }}>
                    {f.star_field}
                    {f.in_layout === "N" && <span title="not in the published STAR layout" style={{ color: "#7c3aed" }}> ⚠</span>}
                    <div style={{ fontSize: 10.5, color: muted }}>
                      {f.is_used === "N" ? "read by nothing" : f.usage ? f.usage.toLowerCase() : ""}
                      {f.from_layout ? " · in the layout, unmentioned by any document" : ""}
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px", verticalAlign: "top" }}>
                    {f.has_sei
                      ? <span style={{ fontFamily: mono, color: sei, fontWeight: 600 }}>{f.sei_source || (f.sei_files || []).join("; ")}</span>
                      : <span style={{ color: danger }}>no SEI source yet</span>}
                    {f.map_kind && <span style={{ fontSize: 10.5, color: muted }}> · {f.map_kind}</span>}
                    {f.open_dependency === "Y" && <span style={{ fontSize: 10.5, color: warning }}> · open dependency</span>}
                    {f.join_logic && <div style={{ fontSize: 10.5, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{f.join_logic}</div>}
                  </td>
                  <td style={{ padding: "7px 10px", verticalAlign: "top" }}>
                    {f.file_status
                      ? <Pill c={(FILE_STATUS_INFO[f.file_status] || {}).c || muted}>{fileStatusLabel(f.file_status)}</Pill>
                      : <span style={{ color: muted }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 10px", verticalAlign: "top", fontFamily: mono, fontSize: 11 }}>
                    {(f.imds_columns || []).length
                      ? f.imds_columns.map((c) => {
                          const [tbl, col] = [c.slice(0, c.lastIndexOf(".")), c.slice(c.lastIndexOf(".") + 1)];
                          return (
                            <div key={c}>{c}
                              {onOpenColumn && <span onClick={() => onOpenColumn(tbl, col)} role="button" tabIndex={0}
                                style={{ fontSize: 10, color: accent, marginLeft: 6, cursor: "pointer", fontFamily: "inherit" }}>verdict ▸</span>}
                            </div>);
                        })
                      : <span style={{ color: muted, fontFamily: "inherit" }}>no IMDS column</span>}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>);
}
