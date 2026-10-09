// The SEI mapping documents, on the crosswalk dashboard.
//
// Seven sheets became seven tables (sql/79): three lanes of field maps
// (SEI → STAR, STAR → IMDS, and the two joined end to end), the register
// of documents they came from, the reference-code crosswalk, the Entity ID
// derivation, and where the usage matrix and the documents disagree.
//
// WHAT THIS PANEL IS FOR. Before these documents the crosswalk could say a
// SEI datapoint exists and whether its type and logic match for ONE IMDS
// table. Now it can say, for fourteen, which SEI source reaches which IMDS
// column and by which STAR field — or that none does. Every row is
// DRAFT_REVIEW_REQUIRED: none of the documents is an approved SEI-to-STAR
// crosswalk, so nothing here changes a verdict, and the panel says so.

import React, { useEffect, useMemo, useState } from "react";
import { mappingDocs, LINK_INFO, LINK_ORDER, COMPLETENESS_INFO, RULE_STATE, RULE_STATE_ORDER } from "./seiCrosswalkApi.js";

const VIEWS = ["Cutover", "Coverage", "Documents", "Transformations", "Reference codes", "Entity ID", "Usage exceptions"];

const Tile = ({ t, v, label, sub, c }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "10px 14px", minWidth: 140 }}>
    <div style={{ fontSize: 24, fontWeight: 800, color: c || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v ?? "—"}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 5 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>{sub}</div>}
  </div>);

const Pill = ({ info, children, onClick, active }) => (
  <span onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
    style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap",
      color: active ? "#fff" : info.c, background: active ? info.c : info.bg || `${info.c}1a`, cursor: onClick ? "pointer" : "default" }}>{children}</span>);

const th = (t) => ({ textAlign: "left", fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px",
  padding: "6px 9px", borderBottom: `1px solid ${t.border}`, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", top: 0, background: t.panel });
const td = (t) => ({ padding: "6px 9px", borderBottom: `1px solid ${t.panel2}`, fontSize: 12, color: t.text, verticalAlign: "top" });
const num = (t) => ({ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums" });
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" };

/* A stacked bar of link classes, in LINK_ORDER. */
export function LinkStack({ links, total, h = 10 }) {
  const n = total || LINK_ORDER.reduce((a, k) => a + (links[k] || 0), 0);
  return (
    <div style={{ display: "flex", height: h, borderRadius: h / 2, overflow: "hidden", background: "#e9eef3", minWidth: 120 }}
      title={LINK_ORDER.filter((k) => links[k]).map((k) => `${LINK_INFO[k].t} ${links[k]}`).join(" · ")}>
      {LINK_ORDER.filter((k) => links[k]).map((k) => <div key={k} style={{ width: `${100 * links[k] / Math.max(1, n)}%`, background: LINK_INFO[k].c }} />)}
    </div>);
}

/* The headline numbers and the draft warning. Pure of the fetch. */
export function headlineOf(reg, cov) {
  const T = reg?.totals || {};
  return {
    documents: T.documents || 0, s2sRows: T.s2s_rows || 0, s2sMapped: T.s2s_mapped || 0, s2sPct: T.s2s_mapped_pct,
    e2eRows: cov?.total || 0, covered: cov?.covered || 0, coveragePct: cov?.coverage_pct, tables: T.imds_tables || 0,
    noSei: (cov?.by_link || []).find((l) => l.key === "NO_SEI_SOURCE")?.n || 0,
    notInMap: (cov?.by_link || []).find((l) => l.key === "STAR_NOT_IN_FILE_MAP")?.n || 0,
    drafts: (cov?.by_approval || []).reduce((a, x) => a + (/DRAFT/i.test(x.key) ? x.n : 0), 0),
    loaded: (T.s2s_rows || 0) + (cov?.total || 0) > 0,
  };
}

export default function MappingDocsPanel({ t, dataSource, initial, onOpenColumn }) {
  const ds = dataSource || "IMDS";
  const [reg, setReg] = useState(initial?.register || null);
  const [cov, setCov] = useState(initial?.coverage || null);
  const [xs, setXs] = useState(initial?.transformations || null);
  const [codes, setCodes] = useState(initial?.codes || null);
  const [ent, setEnt] = useState(initial?.entity || null);
  const [exc, setExc] = useState(initial?.exceptions || null);
  const [view, setView] = useState(initial?.view || "Cutover");
  const [table, setTable] = useState(initial?.table || null);
  const [link, setLink] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(initial?.rows || null);
  const [openRow, setOpenRow] = useState(null);
  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    Promise.all([mappingDocs.register(ds), mappingDocs.e2eCoverage(ds), mappingDocs.transformationSummary(ds),
                 mappingDocs.referenceCodes(ds), mappingDocs.entityId(ds), mappingDocs.usageExceptions(ds)])
      .then(([r, c, x, k, e, u]) => { if (on) { setReg(r); setCov(c); setXs(x); setCodes(k); setEnt(e); setExc(u); } });
    return () => { on = false; };
  }, [ds]);
  useEffect(() => {
    if (!table || initial?.rows) return undefined;
    let on = true;
    setRows("loading");
    mappingDocs.e2eRows({ data_source: ds, table, link, q, limit: 1000 }).then((d) => { if (on) setRows(d.rows || []); });
    return () => { on = false; };
  }, [ds, table, link, q]);
  const H = useMemo(() => headlineOf(reg, cov), [reg, cov]);
  if (reg && cov && !H.loaded) return null;        // nothing loaded: the dashboard stays as it was

  return (
    <div>
      <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5, marginBottom: 10 }}>
        {reg?.headline || "Loading the mapping documents…"}
      </div>
      <div style={{ border: `1px solid #e67e22`, borderLeft: "4px solid #e67e22", background: "#e67e2212", borderRadius: t.radius.md,
        padding: "8px 12px", marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
        <b style={{ color: "#b45309" }}>Every row here is a draft.</b> The documents are mapping candidates, not an approved
        SEI-to-STAR crosswalk ({H.drafts} rows carry DRAFT_REVIEW_REQUIRED). No verdict on this dashboard changes because of them.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <Tile t={t} v={H.documents} label="mapping documents" sub={`${H.s2sRows} STAR fields read`} />
        <Tile t={t} v={H.s2sPct == null ? "—" : `${H.s2sPct}%`} label="STAR fields with a SEI source" sub={`${H.s2sMapped} of ${H.s2sRows}`} c={t.success} />
        <Tile t={t} v={H.coveragePct == null ? "—" : `${H.coveragePct}%`} label="end-to-end coverage" sub={`${H.covered} of ${H.e2eRows} paths reach IMDS from SEI`} c={t.accent} />
        <Tile t={t} v={H.tables} label="IMDS target tables" sub="up from one" />
        <Tile t={t} v={H.noSei} label="paths with no SEI source" sub={H.notInMap ? `+${H.notInMap} point at a STAR field not in the map` : ""} c={t.danger} />
        <Tile t={t} v={exc?.total ?? "—"} label="usage disagreements" sub="matrix vs mapping document" c={t.warning} />
      </div>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
        {VIEWS.map((v) => (
          <div key={v} onClick={() => setView(v)} role="tab" tabIndex={0} aria-selected={view === v}
            style={{ padding: "6px 14px", fontSize: 12, cursor: "pointer", color: view === v ? t.accent : t.sub,
              borderBottom: view === v ? `2px solid ${t.accent}` : "2px solid transparent", marginBottom: -1 }}>{v}</div>))}
      </div>

      {view === "Cutover" && <Cutover t={t} ds={ds} initial={initial?.cutover} feeds={(reg?.docs || []).map((d) => d.feed_family)} onOpenColumn={onOpenColumn} />}

      {view === "Coverage" && cov && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {(cov.by_link || []).map((l) => <Pill key={l.key} info={LINK_INFO[l.key] || { c: "#6b7c8a" }}>{(LINK_INFO[l.key] || {}).t || l.key} · {l.n}</Pill>)}
            <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>coverage = linked end to end + SEI straight to IMDS · click a table for its paths</span>
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th(t)}>IMDS target table</th><th style={{ ...th(t), textAlign: "right" }}>Paths</th><th style={th(t)}>Links</th>
                <th style={{ ...th(t), textAlign: "right" }}>Coverage</th><th style={{ ...th(t), textAlign: "right" }}>No SEI source</th>
                <th style={{ ...th(t), textAlign: "right" }}>Not in map</th><th style={{ ...th(t), textAlign: "right" }}>Gaps</th></tr></thead>
              <tbody>
                {(cov.tables || []).map((x) => (
                  <tr key={x.name} onClick={() => { setTable(table === x.name ? null : x.name); setOpenRow(null); }}
                    style={{ cursor: "pointer", background: table === x.name ? t.infoBg : "transparent" }}>
                    <td style={{ ...td(t), fontWeight: 700, color: t.navy, whiteSpace: "nowrap" }}>{x.name}</td>
                    <td style={num(t)}>{x.rows}</td>
                    <td style={{ ...td(t), minWidth: 160 }}><LinkStack links={x.links} total={x.rows} /></td>
                    <td style={{ ...num(t), fontWeight: 700, color: x.coverage_pct >= 70 ? t.success : x.coverage_pct >= 30 ? t.warning : t.danger }}>{x.coverage_pct == null ? "—" : `${x.coverage_pct}%`}</td>
                    <td style={{ ...num(t), color: x.no_sei_source ? t.danger : t.textMuted }}>{x.no_sei_source || "—"}</td>
                    <td style={{ ...num(t), color: x.not_in_file_map ? "#7c3aed" : t.textMuted }}>{x.not_in_file_map || "—"}</td>
                    <td style={{ ...num(t), color: t.sub }}>{x.gap || "—"}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          {table && (
            <div style={{ marginTop: 12, background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                <b style={{ fontSize: 12.5 }}>{table}</b>
                {LINK_ORDER.map((k) => <Pill key={k} info={LINK_INFO[k]} active={link === k} onClick={() => setLink(link === k ? "" : k)}>{LINK_INFO[k].t}</Pill>)}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="STAR field, IMDS column, SEI source…"
                  style={{ fontSize: 11.5, padding: "3px 8px", border: `1px solid ${t.border}`, borderRadius: 4, width: 240, marginLeft: "auto" }} />
                <span onClick={() => { setTable(null); setOpenRow(null); }} role="button" tabIndex={0} style={{ fontSize: 11, color: t.accent, fontWeight: 700, cursor: "pointer" }}>close ✕</span>
              </div>
              {rows === "loading" && <div style={{ padding: 14, fontSize: 12, color: t.sub }}>Loading…</div>}
              {Array.isArray(rows) && (
                <div style={{ maxHeight: 460, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th(t)}>SEI source</th><th style={th(t)}>→ STAR field</th><th style={th(t)}>→ IMDS column</th><th style={th(t)}>Link</th><th style={th(t)}>Status</th></tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <React.Fragment key={`${r.xwalk_row_id}-${i}`}>
                          <tr onClick={() => setOpenRow(openRow === r.xwalk_row_id ? null : r.xwalk_row_id)} style={{ cursor: "pointer" }}>
                            <td style={{ ...td(t), color: r.sei_source ? t.navy : t.danger, fontWeight: r.sei_source ? 600 : 400 }}>{r.sei_source || "(no SEI source)"}{r.map_kind ? <span style={{ fontSize: 10, color: t.textMuted }}> · {r.map_kind}</span> : null}</td>
                            <td style={{ ...td(t), color: r.star_in_layout === "N" ? "#7c3aed" : t.text }}>{r.star_field || <span style={{ color: t.textMuted }}>(direct)</span>}{r.star_in_layout === "N" ? " ⚠" : ""}</td>
                            <td style={{ ...td(t), fontWeight: 700, color: t.navy }}>{r.imds_column}
                              {onOpenColumn && <span onClick={(e) => { e.stopPropagation(); onOpenColumn(r.imds_table, r.imds_column); }} role="button" tabIndex={0}
                                style={{ fontSize: 10, color: t.accent, marginLeft: 6, cursor: "pointer" }}>verdict ▸</span>}</td>
                            <td style={td(t)}><Pill info={LINK_INFO[r.link_class] || { c: "#6b7c8a" }}>{(LINK_INFO[r.link_class] || {}).t || r.link_class}</Pill></td>
                            <td style={{ ...td(t), fontSize: 10.5, color: t.sub }}>{r.crosswalk_status}{r.approval_status ? ` · ${r.approval_status.toLowerCase().replace(/_/g, " ")}` : ""}</td>
                          </tr>
                          {openRow === r.xwalk_row_id && (
                            <tr><td colSpan={5} style={{ ...td(t), background: t.bg }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                {[["SEI → STAR logic", r.sei_star_logic], ["STAR → IMDS (legacy)", r.star_imds_logic], ["SEI → IMDS (equivalent)", r.sei_imds_logic]].map(([k, v]) => (
                                  <div key={k}><div style={{ fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{k}</div>
                                    <div style={{ ...mono, background: "#fff", border: `1px solid ${t.border}`, borderRadius: 3, padding: "6px 8px", minHeight: 30 }}>{v || "—"}</div></div>))}
                              </div>
                              <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 6 }}>{r.source_document}{r.link_status ? ` · ${r.link_status}` : ""}</div>
                            </td></tr>)}
                        </React.Fragment>))}
                      {!rows.length && <tr><td style={td(t)} colSpan={5}><span style={{ color: t.textMuted }}>no paths match</span></td></tr>}
                    </tbody>
                  </table>
                </div>)}
            </div>)}
        </div>)}

      {view === "Documents" && reg && (
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th(t)}>STAR feed</th><th style={th(t)}>Mapping document</th><th style={{ ...th(t), textAlign: "right" }}>STAR fields</th>
              <th style={{ ...th(t), textAlign: "right" }}>With SEI source</th><th style={{ ...th(t), textAlign: "right" }}>Open dependencies</th>
              <th style={th(t)}>IMDS targets</th><th style={{ ...th(t), textAlign: "right" }}>Stage rows</th><th style={{ ...th(t), textAlign: "right" }}>New comparisons</th>
              <th style={{ ...th(t), textAlign: "right" }}>Already in catalog</th><th style={th(t)}>Loaded</th></tr></thead>
            <tbody>
              {(reg.docs || []).map((d) => (
                <tr key={d.feed_key}>
                  <td style={{ ...td(t), fontWeight: 700, color: t.navy }}>{d.feed_family}</td>
                  <td style={{ ...td(t), color: t.sub }}>{d.source_document || <i style={{ color: t.warning }}>not in the register</i>}</td>
                  <td style={num(t)}>{d.sei_star_rows ?? "—"}</td>
                  <td style={num(t)}>{d.sei_star_mapped ?? "—"}</td>
                  <td style={{ ...num(t), color: d.open_dependencies ? t.warning : t.textMuted }}>{d.open_dependencies ?? "—"}</td>
                  <td style={{ ...td(t), fontSize: 11, color: t.sub }}>{(d.imds_targets || "").split(";").filter(Boolean).join(" · ") || (d.loaded?.imds_tables || []).join(" · ")}</td>
                  <td style={num(t)}>{d.imds_stage_rows ?? d.loaded?.stage_rows ?? "—"}</td>
                  <td style={num(t)}>{d.new_comparison_rows ?? "—"}</td>
                  <td style={{ ...num(t), color: t.textMuted }}>{d.already_in_catalog ?? "—"}</td>
                  <td style={{ ...td(t), fontSize: 11, whiteSpace: "nowrap", color: d.agrees === false ? t.danger : t.success, fontWeight: 700 }}>
                    {d.loaded?.s2s_rows ?? 0} fields · {d.loaded?.e2e_rows ?? 0} paths{d.agrees === false ? " ≠ declared" : d.agrees ? " ✓" : ""}</td>
                </tr>))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: t.textMuted, padding: "6px 10px" }}>"Loaded" counts the lane tables; it should equal the register's declared count. A difference is rows the load dropped.</div>
        </div>)}

      {view === "Transformations" && xs && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {(xs.by_completeness || []).map((c) => <Pill key={c.key} info={COMPLETENESS_INFO[c.key] || { c: "#6b7c8a" }}>{(COMPLETENESS_INFO[c.key] || {}).t || c.key} · {c.n}</Pill>)}
            <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>{xs.headline}{xs.declared_total ? ` · the sheet's own total: ${xs.declared_total}` : ""}</span>
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th(t)}>IMDS target table</th><th style={{ ...th(t), textAlign: "right" }}>Comparison rows</th><th style={th(t)}>Evidence</th>
                <th style={{ ...th(t), textAlign: "right" }}>SEI coverage</th><th style={{ ...th(t), textAlign: "right" }}>Approved</th><th style={th(t)}>Sheet says</th></tr></thead>
              <tbody>
                {(xs.tables || []).map((x) => (
                  <tr key={x.target_object}>
                    <td style={{ ...td(t), fontWeight: 700, color: t.navy, whiteSpace: "nowrap" }}>{x.target_object}</td>
                    <td style={num(t)}>{x.rows}</td>
                    <td style={{ ...td(t), minWidth: 160 }}>
                      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#e9eef3" }}
                        title={Object.entries(x.by).map(([k, n]) => `${(COMPLETENESS_INFO[k] || {}).t || k} ${n}`).join(" · ")}>
                        {Object.keys(COMPLETENESS_INFO).filter((k) => x.by[k]).map((k) => <div key={k} style={{ width: `${100 * x.by[k] / x.rows}%`, background: COMPLETENESS_INFO[k].c }} />)}
                      </div></td>
                    <td style={{ ...num(t), fontWeight: 700, color: x.coverage_pct >= 70 ? t.success : x.coverage_pct >= 30 ? t.warning : t.danger }}>{x.coverage_pct == null ? "—" : `${x.coverage_pct}%`}</td>
                    <td style={{ ...num(t), color: x.approved ? t.success : t.textMuted }}>{x.approved || "none"}</td>
                    <td style={{ ...td(t), fontSize: 11, color: t.textMuted }}>{x.declared_rows != null ? `${x.declared_rows} rows · ${x.declared_status || ""}` : "no cached value"}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}

      {view === "Reference codes" && codes && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {(codes.by_set || []).map((s) => <Tile key={s.code_set_name} t={t} v={s.n} label={s.code_set_name} sub={`${s.mapped} mapped · ${s.unknown} unknown · ${s.rules.join(", ")}`} c={s.unknown ? t.warning : t.success} />)}
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th(t)}>Code set</th><th style={th(t)}>Side</th><th style={th(t)}>Code</th><th style={th(t)}>Description</th><th style={th(t)}>Maps to</th><th style={th(t)}>Rule</th></tr></thead>
              <tbody>
                {(codes.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td(t), color: t.sub, whiteSpace: "nowrap" }}>{r.code_set_name}</td>
                    <td style={{ ...td(t), fontSize: 10.5, fontWeight: 700, color: r.side === "SEI" ? "#0091bf" : "#b5651d" }}>{r.side}</td>
                    <td style={{ ...td(t), fontWeight: 700, color: t.navy }}>{r.code_value}</td>
                    <td style={{ ...td(t), color: t.sub }}>{r.code_description}</td>
                    <td style={{ ...td(t), color: r.is_mapped === "Y" ? t.text : t.warning }}>{r.is_mapped === "Y" ? `${r.maps_to_side || ""} ${r.maps_to_code}${r.maps_to_description ? ` · ${r.maps_to_description}` : ""}` : (r.maps_to_code || "not mapped")}</td>
                    <td style={{ ...td(t), fontSize: 10.5, color: t.textMuted }}>{r.mapping_rule}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}

      {view === "Entity ID" && ent && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12 }}>
          {(ent.feeds || []).map((f, fi) => (
            <div key={`${f.feed_family}-${fi}`} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "10px 12px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: t.navy, marginBottom: 8 }}>{f.feed_family} <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 400 }}>· how Entity ID is built, step by step</span></div>
              {f.steps.map((s, i) => (
                <div key={`${f.feed_family}-${s.seq}-${i}`} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr", gap: 8, padding: "6px 0", borderTop: `1px solid ${t.panel2}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.accent }}>{s.seq}</div>
                  <div><div style={{ fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".5px" }}>legacy IMDS</div>
                    <div style={{ ...mono, color: t.text }}>{s.legacy_logic || "—"}</div>
                    {s.logic_comment && <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{s.logic_comment}</div>}</div>
                  <div><div style={{ fontSize: 9.5, color: "#0091bf", textTransform: "uppercase", letterSpacing: ".5px" }}>under SEI</div>
                    <div style={{ fontSize: 12, color: t.text }}>{s.sei_rule || <span style={{ color: t.danger }}>not stated</span>}</div></div>
                </div>))}
            </div>))}
          {!(ent.feeds || []).length && <div style={{ fontSize: 12, color: t.textMuted }}>no derivation steps loaded</div>}
        </div>)}

      {view === "Usage exceptions" && exc && (
        <div>
          <div style={{ fontSize: 12, color: t.sub, marginBottom: 8, lineHeight: 1.5 }}>{exc.note}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {(exc.by_result || []).map((r) => <Pill key={r.key} info={{ c: r.key === "USED_BUT_UNMAPPED" ? "#c1113a" : r.key === "CONFLICT" ? "#7c3aed" : "#e67e22" }}>{r.key.toLowerCase().replace(/_/g, " ")} · {r.n}</Pill>)}
            {(exc.by_feed || []).map((f) => <span key={f.feed_family} style={{ fontSize: 11, color: t.sub }}>{f.feed_family} {f.n}</span>)}
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th(t)}>Result</th><th style={th(t)}>Feed</th><th style={th(t)}>STAR field</th><th style={th(t)}>Matrix says</th><th style={th(t)}>Document says</th><th style={th(t)}>SEI source</th><th style={th(t)}>Document</th></tr></thead>
              <tbody>
                {(exc.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td(t), fontSize: 10.5, fontWeight: 700, color: r.result === "USED_BUT_UNMAPPED" ? "#c1113a" : r.result === "CONFLICT" ? "#7c3aed" : "#e67e22", whiteSpace: "nowrap" }}>{(r.result || "").toLowerCase().replace(/_/g, " ")}</td>
                    <td style={{ ...td(t), color: t.sub }}>{r.feed_family}</td>
                    <td style={{ ...td(t), fontWeight: 700, color: t.navy }}>{r.field_name}</td>
                    <td style={td(t)}>{r.matrix_usage || "—"}</td>
                    <td style={td(t)}>{r.doc_usage || "—"}</td>
                    <td style={{ ...td(t), color: r.sei_source_mapped === "Y" ? t.success : t.danger }}>{r.sei_source_mapped === "Y" ? "mapped" : "none"}</td>
                    <td style={{ ...td(t), fontSize: 11, color: t.textMuted }}>{r.source_document}{r.source_row ? ` · row ${r.source_row}` : ""}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}


/* THE CUTOVER. One row per IMDS column of a feed, read the way the
   migration reads it: the column keeps its transformation; the STAR field
   that feeds it today is replaced by the SEI source the document proposes.
   The rule in the middle says whether it survives the swap. Pure of the
   fetch below the first render, so a test can hand it rows. */
export function ruleLabel(state) { return (RULE_STATE[state] || {}).t || (state || "").toLowerCase(); }

export function Cutover({ t, ds, feeds, initial, onOpenColumn }) {
  const [feed, setFeed] = useState(initial?.feed || "");
  const [data, setData] = useState(initial || null);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    mappingDocs.cutoverLineage(ds, feed || undefined).then((d) => { if (on) setData(d); });
    return () => { on = false; };
  }, [ds, feed]);
  const feedList = (data?.feeds || []).map((f) => f.feed_family).concat(feeds || []).filter((v, i, a) => v && a.indexOf(v) === i);
  const cols = (data?.columns || []).filter((c) => !state || c.rule.state === state)
    .filter((c) => !q || `${c.imds_table}.${c.imds_column} ${c.star.field || ""} ${c.sei.source || ""} ${c.rule.im_logic || ""}`.toUpperCase().includes(q.toUpperCase()));
  const T = data?.totals || {};
  const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 };
  const lab = (txt, c) => <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".6px", color: c || t.textMuted, textTransform: "uppercase" }}>{txt}</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={feed} onChange={(e) => { setFeed(e.target.value); setOpen(null); }}
          style={{ fontSize: 11.5, padding: "4px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: "#fff", fontFamily: t.font }}>
          <option value="">pick a STAR feed…</option>{feedList.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        {feed && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="IMDS column, STAR field, SEI source, rule…"
          style={{ fontSize: 11.5, padding: "4px 8px", border: `1px solid ${t.border}`, borderRadius: 4, width: 260 }} />}
        <span style={{ fontSize: 11.5, color: t.sub, marginLeft: "auto" }}>
          read left to right: the STAR input is <b>replaced</b> by the SEI source · the transformation into IMDS is <b>kept</b> where the rule allows</span>
      </div>
      {!feed && <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: 20, fontSize: 12.5, color: t.textMuted }}>
        Pick a STAR feed. Each IMDS column it feeds is drawn with the STAR field it reads today on top, the SEI source that replaces it beneath, and the transformation between them marked as kept, swapped or rewritten.</div>}
      {feed && data && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Tile t={t} v={T.columns} label="IMDS columns" sub={`${T.tables || 0} tables · ${T.star_fields || 0} STAR fields read today`} />
            <Tile t={t} v={T.with_sei} label="with a SEI source" sub={`${T.no_sei || 0} without one yet`} c={T.no_sei ? t.warning : t.success} />
            <Tile t={t} v={T.kept} label="rule kept" sub="same rule, or the input swapped" c={t.success} />
            <Tile t={t} v={T.rewritten} label="rule changes" sub="rewritten, two versions, or new" c={t.warning} />
            <Tile t={t} v={(T.by_state || []).find((x) => x.key === "NO_SEI_RULE")?.n || 0} label="no SEI rule" sub="a legacy rule with nothing on the SEI side" c={t.danger} />
            <Tile t={t} v={T.business_decisions} label="business decisions" sub="flagged in the document" c={T.business_decisions ? t.warning : t.textMuted} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {(T.by_state || []).map((x) => <Pill key={x.key} info={RULE_STATE[x.key] || { c: "#6b7c8a" }} active={state === x.key}
              onClick={() => setState(state === x.key ? "" : x.key)}>{ruleLabel(x.key)} · {x.n}</Pill>)}
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) 28px minmax(0,1.5fr) 28px minmax(0,1fr)", gap: 0,
              padding: "6px 12px", borderBottom: `1px solid ${t.border}`, fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 700 }}>
              <div>Source · STAR today, SEI after cutover</div><div /><div>Transformation · kept into IMDS</div><div /><div>IMDS column</div>
            </div>
            {cols.map((c, i) => {
              const rs = RULE_STATE[c.rule.state] || { c: "#6b7c8a", t: c.rule.state };
              const isOpen = open === c.row_id;
              return (
                <div key={`${c.row_id}-${i}`} onClick={() => setOpen(isOpen ? null : c.row_id)}
                  style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) 28px minmax(0,1.5fr) 28px minmax(0,1fr)", alignItems: "center",
                    padding: "9px 12px", borderBottom: `1px solid ${t.panel2}`, cursor: "pointer", background: isOpen ? t.infoBg : "transparent" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#b5651d", width: 30 }}>STAR</span>
                      <span style={{ fontSize: 12, color: t.sub, textDecoration: c.has_sei ? "line-through" : "none", textDecorationColor: "#b5651d99" }}>
                        {c.star.field || <i style={{ color: t.textMuted }}>no STAR field</i>}</span>
                      {c.star.in_layout === "N" && <span title="not in the STAR file layout" style={{ color: "#7c3aed", fontSize: 11 }}>⚠</span>}
                      {c.star.is_used === "N" && <span style={{ fontSize: 9.5, color: t.textMuted }}>read by nothing</span>}
                    </div>
                    <div style={{ fontSize: 9.5, color: t.textMuted, margin: "1px 0 1px 38px" }}>{c.has_sei ? "replaced by ↓" : "stays until a SEI source is named"}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#0091bf", width: 30 }}>SEI</span>
                      {c.has_sei
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: t.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sei.source}</span>
                        : <span style={{ fontSize: 12, fontWeight: 700, color: t.danger }}>no SEI source</span>}
                      {c.sei.map_kind && <span style={{ fontSize: 9.5, color: t.textMuted }}>{c.sei.map_kind}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", color: c.has_sei ? t.accent : t.disabled, fontSize: 16 }}>→</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                      <Pill info={rs}>{ruleLabel(c.rule.state)}</Pill>
                      {c.rule.business_decision === "Y" && <span style={{ fontSize: 9.5, color: t.warning, fontWeight: 700 }}>business decision</span>}
                      {c.rule.evidence_completeness && <span style={{ fontSize: 9.5, color: t.textMuted }}>{(COMPLETENESS_INFO[c.rule.evidence_completeness] || {}).t || c.rule.evidence_completeness}</span>}
                    </div>
                    <div style={{ ...mono, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "pre-wrap" : "nowrap" }}>
                      {c.rule.im_logic || (c.rule.sei_logic ? "" : "copied as is")}</div>
                    {c.rule.sei_logic && c.rule.state !== "SAME" && (
                      <div style={{ ...mono, color: "#0091bf", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "pre-wrap" : "nowrap" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".5px" }}>SEI </span>{c.rule.sei_logic}</div>)}
                  </div>
                  <div style={{ textAlign: "center", color: t.accent, fontSize: 16 }}>→</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.imds_table}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: t.navy }}>{c.imds_column}
                      {onOpenColumn && <span onClick={(e) => { e.stopPropagation(); onOpenColumn(c.imds_table, c.imds_column); }} role="button" tabIndex={0}
                        style={{ fontSize: 10, color: t.accent, marginLeft: 6, cursor: "pointer", fontWeight: 700 }}>verdict ▸</span>}</div>
                    <div style={{ fontSize: 10, color: t.sub }}>{c.target_type || ""}{c.target_nullable ? ` · null ${c.target_nullable}` : ""}
                      {c.link_class && <span style={{ marginLeft: 6 }}><Pill info={LINK_INFO[c.link_class] || { c: "#6b7c8a" }}>{(LINK_INFO[c.link_class] || {}).t || c.link_class}</Pill></span>}</div>
                  </div>
                  {isOpen && (
                    <div style={{ gridColumn: "1 / -1", marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 11 }}>
                      <div>{lab("STAR field today", "#b5651d")}
                        <div style={{ color: t.text }}>{c.star.field || "—"}{c.star.type ? ` · ${c.star.type}${c.star.length ? `(${c.star.length})` : ""}` : ""}{c.star.ordinal != null ? ` · #${c.star.ordinal}` : ""}</div>
                        <div style={{ color: t.sub }}>usage matrix: {c.star.usage_status || "not stated"}{c.star.doc_usage ? ` · document: ${c.star.doc_usage}` : ""}{c.star.uploader_column ? ` · uploader ${c.star.uploader_column}` : ""}</div>
                        {c.star.description && <div style={{ color: t.sub, marginTop: 3 }}>{c.star.description}</div>}</div>
                      <div>{lab("SEI source after cutover", "#0091bf")}
                        <div style={{ color: t.text, fontWeight: 700 }}>{c.sei.source || "none named"}{c.sei.type ? ` · ${c.sei.type}` : ""}</div>
                        {c.sei.join_logic && <div style={{ ...mono, color: t.text, marginTop: 3 }}>{c.sei.join_logic}</div>}
                        <div style={{ color: t.sub, marginTop: 3 }}>{[c.sei.map_kind, c.sei.mapping_status, c.sei.open_dependency === "Y" ? "open dependency" : null, c.sei.approval_status ? c.sei.approval_status.toLowerCase().replace(/_/g, " ") : null].filter(Boolean).join(" · ")}</div></div>
                      <div>{lab("the rule, both sides")}
                        <div style={{ color: t.sub }}>{(RULE_STATE[c.rule.state] || {}).hint}</div>
                        {c.rule.notes && <div style={{ color: t.sub, marginTop: 3 }}>{c.rule.notes}</div>}
                        <div style={{ color: t.textMuted, marginTop: 3 }}>{c.rule.comparison_id ? `comparison ${c.rule.comparison_id} · ` : ""}{c.source_document}{c.source_row ? ` · row ${c.source_row}` : ""}{c.link_status ? ` · ${c.link_status}` : ""}</div></div>
                    </div>)}
                </div>);
            })}
            {!cols.length && <div style={{ padding: 14, fontSize: 12, color: t.textMuted }}>no IMDS columns match</div>}
          </div>
        </>)}
    </div>);
}
