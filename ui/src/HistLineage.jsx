// Data Analysis · Historical data migration · the lineage package of the
// v12 workbook: FINAL_HIST_MIGRATION_LINEAGE end to end, the rules, the
// decon source dictionary and the target-field QC. The chain figure reads
// left to right the way the Source view does: lane → source objects →
// rule → SEI dat file → SEI target field → SEI input lineage → STAR
// contract field → IMDS column. Four statuses, four pills, never one.
//
// `initial` lets a test hand in the payloads and skip the network.
import React, { useEffect, useState } from "react";
import { histMigrationApi as api, emptyLineageSummary, STATUS_KINDS, STATUS_COLOR, LANE_LABEL, HL_RULES, LEVEL_COLOR } from "./histMigrationApi.js";

const mono = { fontFamily: "ui-monospace, monospace" };
const Pill = ({ c, children, title }) => <span title={title} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`, borderRadius: 3, padding: "0 6px", whiteSpace: "nowrap" }}>{children}</span>;
const H = ({ t, children, sub }) => <div style={{ margin: "16px 0 6px" }}><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12, color: t.sub, maxWidth: "84ch", lineHeight: 1.55 }}>{sub}</div>}</div>;
const Tile = ({ t, n, label, sub, color }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "10px 14px", minWidth: 128 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{typeof n === "number" ? n.toLocaleString() : n}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 5 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{sub}</div>}
  </div>);
const th = (t) => ({ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" });
const td = (t, first) => ({ padding: "6px 10px 6px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: first ? t.text : t.sub, fontWeight: first ? 600 : 400, lineHeight: 1.5 });
const Pre = ({ t, text }) => <pre style={{ ...mono, fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: "8px 10px", margin: "4px 0 8px", color: t.text, maxHeight: 320, overflow: "auto" }}>{text || "—"}</pre>;
const Statuses = ({ r }) => (
  <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
    <Pill c={STATUS_COLOR(r.rule_status)} title="rule status">{r.rule_status || "—"}</Pill>
    <Pill c={STATUS_COLOR(r.approval_status)} title="approval">{r.approval_status || "—"}</Pill>
    <Pill c={STATUS_COLOR(r.decon_dictionary_status)} title="dictionary">{r.decon_dictionary_status || "—"}</Pill>
    <Pill c={STATUS_COLOR(r.match_status)} title="lineage match">{r.match_status || "—"}</Pill>
  </span>);

// The end-to-end chain for one record, as one picture.
export function HistChainFig({ t, d }) {
  const r = d.record, ch = d.chain || {};
  const W = 1180, H = 236;
  const cols = [
    { title: "Historical lane", lines: [LANE_LABEL[ch.lane] || ch.lane || "—"], c: "#7c3aed", kind: "LANE" },
    { title: "Source objects", lines: (ch.sourceObjects || []).slice(0, 3).concat((ch.sourceObjects || []).length > 3 ? [`+${ch.sourceObjects.length - 3} more`] : []), c: t.navy || t.text, kind: "DECON DICTIONARY", sub: `${(d.decon || []).length} with a meaning` },
    { title: "Transformation rule", lines: [(d.rules || []).length ? `${d.rules.length} rule${d.rules.length === 1 ? "" : "s"} · ${d.rules[0].rule_type || "rule"}` : "no rule on this row", r.rule_status ? `rule ${r.rule_status}` : ""], c: "#0f4775", kind: "HIST_MIGRATION_RULE" },
    { title: "SEI dat file", lines: [r.target_dat_file || "—"], c: "#0091bf", kind: "TARGET" },
    { title: "SEI target field", lines: [r.target_field || "—", `${r.target_data_type || ""}${r.target_max_length ? `(${r.target_max_length}${r.target_decimal_pos ? `,${r.target_decimal_pos}` : ""})` : ""}`], c: "#0091bf", kind: "TARGET KEY", sub: (ch.targetKey || "").length > 30 ? "" : ch.targetKey },
    { title: "SEI input lineage", lines: [ch.seiInput ? `${ch.seiInput} operational row${ch.seiInput === 1 ? "" : "s"}` : "no exact match", r.match_status || ""], c: r.match_status === "MATCHED" ? "#159943" : "#c96a12", kind: "EXACT_NORMALIZED_FIELD_MATCH" },
    { title: "STAR contract field", lines: (d.star || []).slice(0, 2).map((s) => `${s.src_file_key || "?"} · ${s.src_source_column || "?"}`).concat(ch.star > 2 ? [`+${ch.star - 2} more`] : ch.star ? [] : ["none mapped"]), c: "#233240", kind: "SEI → STAR" },
    { title: "IMDS column", lines: (d.imds || []).slice(0, 2).map((s) => `${s.dwh_target_table || "?"}.${s.dwh_target_column || "?"}`).concat(ch.imds > 2 ? [`+${ch.imds - 2} more`] : ch.imds ? [] : ["none reached"]), c: "#233240", kind: "STAR → IMDS" },
  ];
  const cw = 132, gap = 14, x0 = 12;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "12px 12px 6px", marginBottom: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: "block", minWidth: 980, width: "100%", height: "auto" }}
        aria-label={`Historical migration lineage for ${r.lineage_id}: lane ${ch.lane}, ${(ch.sourceObjects || []).length} source objects, ${(d.rules || []).length} rules, SEI file ${r.target_dat_file} field ${r.target_field}, ${ch.seiInput} operational SEI input rows (${r.match_status}), ${ch.star} STAR contract fields, ${ch.imds} IMDS columns. Statuses: rule ${r.rule_status || "none"}, approval ${r.approval_status || "none"}, dictionary ${r.decon_dictionary_status || "none"}, match ${r.match_status || "none"}.`}>
        <defs><marker id="hl-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={t.textMuted} /></marker></defs>
        <text x={x0} y={16} fontSize={11} fontWeight={800} letterSpacing=".6" fill={t.text}>HISTORICAL MIGRATION LINEAGE · {r.lineage_id}</text>
        <text x={x0} y={32} fontSize={9.5} fill={t.textMuted}>historical source → transformation → SEI target, then the operational SEI → STAR → IMDS lineage the target field joins by exact normalised name</text>
        {cols.map((c, i) => { const x = x0 + i * (cw + gap); return (
          <g key={c.title}>
            <rect x={x} y={48} width={cw} height={118} rx={5} fill={t.panel} stroke={c.c} strokeWidth={1.6} />
            <text x={x + 8} y={62} fontSize={7.5} fontWeight={800} letterSpacing=".5" fill={t.textMuted}>{(c.kind || "").slice(0, 28)}</text>
            <text x={x + 8} y={78} fontSize={10.5} fontWeight={700} fill={t.text}>{c.title}</text>
            {c.lines.filter(Boolean).slice(0, 4).map((l, j) => <text key={j} x={x + 8} y={96 + j * 13} fontSize={9} fill={t.sub} style={j === 0 ? mono : undefined}>{String(l).length > 24 ? String(l).slice(0, 23) + "…" : l}</text>)}
            {c.sub && <text x={x + 8} y={158} fontSize={8.5} fill={t.textMuted}>{c.sub}</text>}
            {i < cols.length - 1 && <path d={`M${x + cw + 1} 107 L${x + cw + gap - 1} 107`} stroke={t.textMuted} strokeWidth={1.2} markerEnd="url(#hl-arr)" strokeDasharray={i >= 4 ? "4 3" : undefined} />}
          </g>); })}
        <text x={x0} y={190} fontSize={9.5} fill={t.textMuted}>Solid: the historical mapping as the workbook records it. Dashed: the operational lineage joined by name; it is evidence of where the field goes today, not part of the historical mapping.</text>
        <text x={x0} y={206} fontSize={9.5} fill={t.textMuted}>{(d.siblings || []).length ? `${d.siblings.length} other lane${d.siblings.length === 1 ? "" : "s"} reach the same SEI field (${ch.targetKey}); each is its own row, never merged into this one.` : `No other lane reaches ${ch.targetKey}.`}</text>
        <text x={x0} y={224} fontSize={9.5} fill={STATUS_COLOR(r.match_status)}>Four controls, kept apart: rule {r.rule_status || "—"} · approval {r.approval_status || "—"} · dictionary {r.decon_dictionary_status || "—"} · match {r.match_status || "—"}.</text>
      </svg>
    </div>);
}

function Record({ t, d }) {
  const r = d.record;
  return (<>
    <HistChainFig t={t} d={d} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div>
        <H t={t}>Historical source</H>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6 }}>
          <div><b style={{ color: t.text }}>Path</b> {r.source_path || "—"} · <b style={{ color: t.text }}>system</b> {r.source_system || "—"} · <Pill c="#7c3aed">{LANE_LABEL[r.lane_id] || r.lane_id}</Pill></div>
          <div><b style={{ color: t.text }}>Object · field</b> <span style={mono}>{r.source_object_field || "—"}</span></div>
          {r.source_dependencies && <div><b style={{ color: t.text }}>Dependencies</b> {r.source_dependencies}</div>}
          <div><b style={{ color: t.text }}>Decon meaning</b> {r.decon_dictionary_meaning || "—"} {r.decon_business_domain && <>· {r.decon_business_domain}</>} <Pill c={STATUS_COLOR(r.decon_dictionary_status)}>{r.decon_dictionary_status || "—"}</Pill>{r.decon_status_text && r.decon_status_text !== r.decon_dictionary_status && <span style={{ fontSize: 11, color: t.textMuted }}> as written: {r.decon_status_text}</span>}</div>
        </div>
        {(d.decon || []).length > 0 && (<>
          <H t={t} sub="The decon dictionary entries for the objects this row names. A name-derived meaning is marked; it is not approved metadata.">Source objects in the dictionary</H>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}><thead><tr>{["Object", "Meaning", "Basis", "Status", "Used by"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{d.decon.map((o) => <tr key={o.technical_object}><td style={td(t, true)}><span style={mono}>{o.technical_object}</span></td><td style={td(t)}>{o.business_meaning}{o.business_domain ? <span style={{ color: t.textMuted }}> · {o.business_domain}</span> : null}</td>
              <td style={td(t)}><Pill c={o.basis_class === "CURATED" ? "#159943" : "#c96a12"}>{o.basis_class}</Pill></td><td style={td(t)}><Pill c={STATUS_COLOR(o.dictionary_status)}>{o.dictionary_status}</Pill></td><td style={td(t)}>{o.lineage_usage_count ?? "—"}</td></tr>)}</tbody></table>
        </>)}
        <H t={t}>Transformation</H>
        <div style={{ fontSize: 11, color: t.textMuted }}>{r.transformation_rule_source ? `from ${r.transformation_rule_source}` : "rule as the lineage sheet carries it"} · rule {r.rule_status || "—"} · approval {r.approval_status || "—"}</div>
        <Pre t={t} text={r.transformation_rule} />
        {r.validation_rule && <><div style={{ fontSize: 11, color: t.textMuted }}>validation rule</div><Pre t={t} text={r.validation_rule} /></>}
        {(d.rules || []).map((x) => (
          <div key={x.rule_id} style={{ border: `1px solid ${t.border}`, borderLeft: "3px solid #0f4775", borderRadius: 6, padding: "8px 12px", margin: "6px 0", background: t.bg }}>
            <div style={{ fontSize: 12, color: t.text }}><b style={mono}>{x.rule_id}</b> · {x.rule_type || "rule"} · <Pill c={STATUS_COLOR(x.mapping_status)}>{x.mapping_status || "—"}</Pill> <Pill c={STATUS_COLOR(x.approval_status)}>{x.approval_status || "—"}</Pill></div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{x.rule_source_column ? `${x.rule_source_column} · ` : ""}{x.source_objects_fields || ""}{x.evidence_locator ? ` · ${x.evidence_locator}` : ""}</div>
            <Pre t={t} text={x.transformation_rule} />
            {x.validation_rule && <Pre t={t} text={x.validation_rule} />}
          </div>))}
      </div>
      <div>
        <H t={t}>SEI target</H>
        <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.6 }}>
          <div><b style={{ color: t.text }}>Key</b> <span style={mono}>{r.target_key}</span></div>
          <div><b style={{ color: t.text }}>Type</b> {r.target_data_type || "—"}{r.target_max_length ? ` (${r.target_max_length}${r.target_decimal_pos ? `,${r.target_decimal_pos}` : ""})` : ""} · <b style={{ color: t.text }}>mandatory</b> {r.mandatory || "—"}</div>
          {r.target_field_source_column && <div><b style={{ color: t.text }}>Target field source column</b> {r.target_field_source_column}</div>}
          <div><b style={{ color: t.text }}>Common target</b> {r.common_target_indicator || "—"}{r.common_target_key ? <span style={mono}> · {r.common_target_key}</span> : null}</div>
          <div><b style={{ color: t.text }}>Audit</b> {r.source_workbook || "—"}{r.source_sheet ? ` / ${r.source_sheet}` : ""}{r.source_row ? ` / row ${r.source_row}` : ""} · catalog {r.catalog_id || "—"} · {r.functional_group || ""}</div>
          <div><b style={{ color: t.text }}>Reconciliation key</b> <span style={{ ...mono, fontSize: 11 }}>{r.recon_key}</span></div>
        </div>
        {(d.siblings || []).length > 0 && (<>
          <H t={t} sub="Other lanes reaching the same SEI field. By design each is its own lineage row; a common SEI DAT field never merges a PB source with an IM or UAF source.">Same target, other lanes</H>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}><thead><tr>{["Lineage", "Lane", "Source", "Statuses"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{d.siblings.map((s) => <tr key={s.lineage_id}><td style={td(t, true)}><span style={mono}>{s.lineage_id}</span></td><td style={td(t)}>{LANE_LABEL[s.lane_id] || s.lane_id}</td><td style={td(t)}><span style={mono}>{s.source_object_field}</span></td><td style={td(t)}><Statuses r={s} /></td></tr>)}</tbody></table>
        </>)}
        <H t={t} sub="The operational SEI input lineage this target field matches by exact normalised name, then where that SEI datapoint goes today: the STAR contract field and the IMDS column.">Downstream · operational lineage</H>
        <div style={{ fontSize: 12, color: t.sub }}>
          <div><Pill c={STATUS_COLOR(r.match_status)}>{r.match_status || "NOT_CHECKED"}</Pill> <span style={{ fontSize: 11, color: t.textMuted }}>{r.match_method || "EXACT_NORMALIZED_FIELD_MATCH"}</span></div>
          {(d.seiInput || []).map((x) => <div key={x.input_id} style={{ marginTop: 4 }}><span style={mono}>{x.sei_target_file} · {x.sei_field}</span> <span style={{ color: t.textMuted }}>{x.published_type || ""} · {x.mapping_status || ""}{x.upstream_object ? ` · from ${x.upstream_object}${x.upstream_field ? `.${x.upstream_field}` : ""}` : ""}</span></div>)}
          {(d.seiInput || []).length === 0 && <div style={{ color: t.textMuted, marginTop: 4 }}>no sei_input_lineage row carries this field name</div>}
          {(d.star || []).map((x) => <div key={x.map_id} style={{ marginTop: 4 }}>→ STAR <span style={mono}>{x.src_file_key} · {x.src_source_column}</span> <span style={{ color: t.textMuted }}>{x.map_kind || ""} · {x.sei_feed || ""}{x.sei_entity ? ` / ${x.sei_entity}` : ""}</span></div>)}
          {(d.imds || []).map((x) => <div key={x.lineage_id} style={{ marginTop: 4 }}>→ IMDS <span style={mono}>{x.dwh_target_table}.{x.dwh_target_column}</span> <span style={{ color: t.textMuted }}>{x.lineage_status || ""}{x.source_system ? ` · ${x.source_system}` : ""}</span></div>)}
        </div>
        {(d.qc || []).length > 0 && (<>
          <H t={t}>QC controls on this target</H>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}><thead><tr>{["Control", "Expected", "Actual", "Result"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{d.qc.map((c) => <tr key={c.qc_id}><td style={td(t, true)}>{c.control_name}</td><td style={td(t)}>{c.expected}</td><td style={td(t)}>{c.actual}</td><td style={td(t)}><Pill c={STATUS_COLOR(c.result)}>{c.result || "—"}</Pill></td></tr>)}</tbody></table>
        </>)}
      </div>
    </div>
  </>);
}

export function LineageTab({ t, initial }) {
  const [sum, setSum] = useState(initial?.summary || null);
  const [filter, setFilter] = useState(initial?.filter || {});
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(initial?.list || null);
  const [picked, setPicked] = useState(initial?.record ? initial.record.record.lineage_id : null);
  const [detail, setDetail] = useState(initial?.record || null);
  useEffect(() => { if (initial) return undefined; let on = true; api.lineageSummary().then((d) => { if (on) setSum(d); }); return () => { on = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial) return undefined; let on = true; api.lineage({ ...filter, page, size: 100 }).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [JSON.stringify(filter), page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial || !picked) return undefined; let on = true; api.lineageRecord(picked).then((d) => { if (on) setDetail(d); }); return () => { on = false; }; }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = sum || emptyLineageSummary(), tot = s.totals || {};
  const sel = (label, key, options, fmt) => (
    <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>{label}
      <select value={filter[key] || ""} onChange={(e) => { setPage(1); setFilter({ ...filter, [key]: e.target.value }); }} style={{ font: "inherit", fontSize: 11.5, padding: "3px 6px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, maxWidth: 230 }}>
        <option value="">all</option>{(options || []).map((o) => <option key={o.key} value={o.key}>{fmt ? fmt(o.key) : o.key} ({o.n.toLocaleString()})</option>)}</select></label>);
  const rows = (data && data.lineage) || [], total = (data && data.total) || 0, pages = Math.max(1, Math.ceil(total / 100));
  return (<>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Tile t={t} n={tot.lineage || 0} label="lineage rows" sub="one mapping → one SEI field" />
      <Tile t={t} n={tot.targetFields || 0} label="SEI target fields" sub={`${tot.datFiles || 0} dat files`} />
      <Tile t={t} n={tot.rules || 0} label="rules" />
      <Tile t={t} n={tot.decon || 0} label="decon objects" />
      <Tile t={t} n={tot.sharedTargets || 0} label="fields on 2+ lanes" sub="kept as separate rows" />
      <Tile t={t} n={tot.matched || 0} label="matched to SEI input" color="#159943" />
      <Tile t={t} n={tot.unmatched || 0} label="unmatched · review" color={tot.unmatched ? "#c96a12" : undefined} />
      <Tile t={t} n={tot.blankTarget || 0} label="blank targets" color={tot.blankTarget ? "#b42318" : "#159943"} sub="the workbook records zero" />
    </div>
    {!tot.lineage && <div style={{ fontSize: 12.5, color: t.sub, margin: "12px 0", maxWidth: "80ch", lineHeight: 1.6, border: `1px solid ${t.border}`, borderLeft: "3px solid #c96a12", borderRadius: 6, padding: "10px 14px", background: t.panel }}>
      <b style={{ color: t.text }}>No lineage loaded.</b> The v12 workbook's FINAL_HIST_MIGRATION_LINEAGE, DECON_SOURCE_DICTIONARY, HIST_MIGRATION_RULE, TARGET_FIELD_QC and _MANIFEST sheets load with the other HIST sheets: apply <span style={mono}>sql/87_hist_lineage.sql</span>, then run <span style={mono}>.\local\load-hist.ps1</span>.</div>}
    <H t={t} sub="Filter, then click a row to read it end to end. The four statuses on a row are four different controls; a Complete rule is not an approved mapping.">Lineage records</H>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 10px" }}>
      {sel("lane", "lane", s.byLane, (k) => LANE_LABEL[k] || k)}{sel("group", "group", s.byGroup)}{sel("dat file", "file", (s.byFile || []).map((f) => ({ key: f.file, n: f.rows })))}
      {sel("rule status", "status", s.byRuleStatus)}{sel("approval", "approval", s.byApproval)}{sel("dictionary", "decon", s.byDecon)}{sel("match", "match", s.byMatch)}
      <input aria-label="search lineage" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setFilter({ ...filter, q }); } }}
        placeholder="target field, source object, catalog id, Enter" style={{ font: "inherit", fontSize: 11.5, padding: "3px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, minWidth: 250 }} />
      {Object.keys(filter).length > 0 && <span role="button" tabIndex={0} style={{ fontSize: 11.5, color: t.accent, cursor: "pointer" }} onClick={() => { setQ(""); setPage(1); setFilter({}); }}>clear</span>}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: t.textMuted }}>{total.toLocaleString()} rows · page {page} of {pages}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ font: "inherit", fontSize: 11, padding: "2px 8px" }}>prev</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={{ font: "inherit", fontSize: 11, padding: "2px 8px" }}>next</button>
    </div>
    {detail && detail.record && <div style={{ margin: "6px 0 14px" }}><Record t={t} d={detail} /></div>}
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
        <thead><tr>{["Lineage", "Lane", "Source object · field", "SEI dat file", "Target field", "Type", "Rule · approval · dictionary · match", "Audit"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.lineage_id} style={{ background: picked === r.lineage_id ? t.bg : undefined }}>
            <td style={td(t, true)}><span role="button" tabIndex={0} style={{ ...mono, color: t.accent, cursor: "pointer" }} onClick={() => setPicked(picked === r.lineage_id ? null : r.lineage_id)}>{r.lineage_id}</span></td>
            <td style={td(t)}><Pill c="#7c3aed">{LANE_LABEL[r.lane_id] || r.lane_id}</Pill></td>
            <td style={td(t)}><span style={{ ...mono, fontSize: 11 }}>{r.source_object_field}</span></td>
            <td style={td(t)}><span style={mono}>{r.target_dat_file}</span></td>
            <td style={td(t)}><span style={{ ...mono, fontWeight: 600, color: t.text }}>{r.target_field}</span>{r.common_target_indicator && /^(Y|TRUE|COMMON)/i.test(r.common_target_indicator) && <> <Pill c="#0f4775">common</Pill></>}</td>
            <td style={td(t)}>{r.target_data_type}{r.target_max_length ? `(${r.target_max_length})` : ""}</td>
            <td style={td(t)}><Statuses r={r} /></td>
            <td style={{ ...td(t), fontSize: 10.5, color: t.textMuted }}>{r.source_workbook}{r.source_sheet ? ` / ${r.source_sheet}` : ""}{r.source_row ? ` / ${r.source_row}` : ""}</td>
          </tr>))}</tbody>
      </table>
      {rows.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>{data ? "No lineage matches." : "Loading…"}</div>}
    </div>
    <H t={t} sub="The SEI dat files the historical mappings land in, with how many fields, lanes and operational matches each has.">By SEI dat file</H>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, maxWidth: 860 }}><thead><tr>{["Dat file", "Target fields", "Lineage rows", "Lanes", "Matched"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
      <tbody>{(s.byFile || []).map((f) => <tr key={f.file}><td style={td(t, true)}><span role="button" tabIndex={0} style={{ ...mono, color: t.accent, cursor: "pointer" }} onClick={() => { setPage(1); setFilter({ ...filter, file: f.file }); }}>{f.file}</span></td><td style={td(t)}>{f.fields}</td><td style={td(t)}>{f.rows}</td><td style={td(t)}>{f.lanes}</td><td style={td(t)}>{f.matched}</td></tr>)}</tbody></table>
    {(s.manifest || []).length > 0 && (<><H t={t}>Workbook manifest</H>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, maxWidth: 860 }}><tbody>{s.manifest.map((m) => <tr key={m.manifest_key}><td style={td(t, true)}><span style={mono}>{m.manifest_key}</span></td><td style={td(t)}>{m.manifest_value}</td></tr>)}</tbody></table></>)}
    <H t={t} sub="The rules the loader applies to the lineage package, beside the CP360-HM rules on the Dictionary sub-tab.">Lineage rules</H>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}><thead><tr>{["Rule", "Applies to", "Category", "Detail", "Severity"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
      <tbody>{HL_RULES.map(([id, a, c, d, sv]) => <tr key={id}><td style={td(t, true)}>{id}</td><td style={td(t)}>{a}</td><td style={td(t)}>{c}</td><td style={td(t)}>{d}</td><td style={td(t)}><Pill c={LEVEL_COLOR[sv] || t.sub}>{sv}</Pill></td></tr>)}</tbody></table>
  </>);
}

export function RulesTab({ t, initial }) {
  const [data, setData] = useState(initial || null);
  const [filter, setFilter] = useState({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  useEffect(() => { if (initial) return undefined; let on = true; api.rules({ ...filter, size: 100 }).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [JSON.stringify(filter)]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = data || { rules: [], total: 0, byType: [], byStatus: [], byApproval: [], byFile: [] };
  const sel = (label, key, options) => (
    <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>{label}
      <select value={filter[key] || ""} onChange={(e) => setFilter({ ...filter, [key]: e.target.value })} style={{ font: "inherit", fontSize: 11.5, padding: "3px 6px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, maxWidth: 220 }}>
        <option value="">all</option>{(options || []).map((o) => <option key={o.key} value={o.key}>{o.key} ({o.n.toLocaleString()})</option>)}</select></label>);
  return (<>
    <H t={t} sub="HIST_MIGRATION_RULE: the transformation rules extracted from the merged catalog, the analyst text whole. Mapping status and approval are separate columns and stay separate here.">Transformation rules</H>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 10px" }}>
      {sel("dat file", "file", d.byFile)}{sel("type", "rule_type", d.byType)}{sel("mapping status", "status", d.byStatus)}{sel("approval", "approval", d.byApproval)}
      <input aria-label="search rules" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setFilter({ ...filter, q }); }} placeholder="field, rule id or logic, Enter" style={{ font: "inherit", fontSize: 11.5, padding: "3px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, minWidth: 220 }} />
      <span style={{ flex: 1 }} /><span style={{ fontSize: 11.5, color: t.textMuted }}>{(d.total || 0).toLocaleString()} rules</span>
    </div>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}><thead><tr>{["Rule", "SEI file · field", "Type", "Source column", "Mapping · approval", "Rule"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
      <tbody>{(d.rules || []).map((r) => (
        <React.Fragment key={r.rule_id}>
          <tr><td style={td(t, true)}><span role="button" tabIndex={0} style={{ ...mono, color: t.accent, cursor: "pointer" }} onClick={() => setOpen(open === r.rule_id ? null : r.rule_id)}>{r.rule_id}</span></td>
            <td style={td(t)}><span style={mono}>{r.sei_target_file} · {r.sei_target_field}</span></td><td style={td(t)}>{r.rule_type}</td><td style={td(t)}>{r.rule_source_column}</td>
            <td style={td(t)}><Pill c={STATUS_COLOR(r.mapping_status)}>{r.mapping_status || "—"}</Pill> <Pill c={STATUS_COLOR(r.approval_status)}>{r.approval_status || "—"}</Pill></td>
            <td style={{ ...td(t), ...mono, fontSize: 11, maxWidth: 460, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{open === r.rule_id ? r.transformation_rule : (r.transformation_rule || "").slice(0, 160) + ((r.transformation_rule || "").length > 160 ? " …" : "")}</td></tr>
          {open === r.rule_id && <tr><td colSpan={6} style={{ padding: "4px 0 10px" }}>
            <div style={{ border: `1px solid ${t.border}`, borderLeft: "3px solid #0f4775", borderRadius: 6, background: t.bg, padding: "8px 12px", fontSize: 12, color: t.sub }}>
              <div>{r.catalog_id ? <>catalog <span style={mono}>{r.catalog_id}</span> · </> : null}{r.functional_group || ""}{r.source_objects_fields ? <> · sources <span style={mono}>{r.source_objects_fields}</span></> : null}</div>
              <div style={{ color: t.textMuted, fontSize: 11 }}>{r.source_workbook}{r.source_sheet ? ` / ${r.source_sheet}` : ""}{r.evidence_locator ? ` · ${r.evidence_locator}` : ""}</div>
              {r.validation_rule && <><div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>validation rule</div><Pre t={t} text={r.validation_rule} /></>}
            </div></td></tr>}
        </React.Fragment>))}</tbody></table>
    {(d.rules || []).length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>{data ? "No rules match." : "Loading…"}</div>}
  </>);
}

export function DeconTab({ t, initial }) {
  const [data, setData] = useState(initial || null);
  const [filter, setFilter] = useState({});
  const [q, setQ] = useState("");
  useEffect(() => { if (initial) return undefined; let on = true; api.decon(filter).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [JSON.stringify(filter)]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = data || { objects: [], byStatus: [], byBasis: [], byDomain: [], byPrefix: [] };
  const sel = (label, key, options) => (
    <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>{label}
      <select value={filter[key] || ""} onChange={(e) => setFilter({ ...filter, [key]: e.target.value })} style={{ font: "inherit", fontSize: 11.5, padding: "3px 6px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, maxWidth: 220 }}>
        <option value="">all</option>{(options || []).map((o) => <option key={o.key} value={o.key}>{o.key} ({o.n.toLocaleString()})</option>)}</select></label>);
  return (<>
    <H t={t} sub="DECON_SOURCE_DICTIONARY: one technical source object (SGA_DCON_*, IM_*, AV_*, XOS_* …) with its meaning. A curated meaning and a name-derived one are told apart, so inferred metadata is never read as approved.">Decon source dictionary</H>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 10px" }}>
      {sel("status", "status", d.byStatus)}{sel("basis", "basis", d.byBasis)}{sel("domain", "domain", d.byDomain)}
      <input aria-label="search decon" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setFilter({ ...filter, q }); }} placeholder="object or meaning, Enter" style={{ font: "inherit", fontSize: 11.5, padding: "3px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, minWidth: 220 }} />
      <span style={{ flex: 1 }} />{(d.byPrefix || []).slice(0, 8).map((p) => <Pill key={p.key} c={t.sub}>{p.key} · {p.n}</Pill>)}
    </div>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}><thead><tr>{["Technical object", "Prefix", "Meaning", "Type", "Domain", "Function", "Basis", "Status", "Used by", "Example targets"].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
      <tbody>{(d.objects || []).map((o) => <tr key={o.technical_object}><td style={td(t, true)}><span style={mono}>{o.technical_object}</span></td><td style={td(t)}>{o.source_prefix}</td><td style={td(t)}>{o.business_meaning}</td><td style={td(t)}>{o.source_type}</td><td style={td(t)}>{o.business_domain}</td><td style={td(t)}>{o.migration_function}</td>
        <td style={td(t)}><Pill c={o.basis_class === "CURATED" ? "#159943" : "#c96a12"} title={o.definition_basis}>{o.basis_class}</Pill></td><td style={td(t)}><Pill c={STATUS_COLOR(o.dictionary_status)}>{o.dictionary_status}</Pill></td><td style={td(t)}>{o.lineage_usage_count ?? "—"}</td><td style={{ ...td(t), fontSize: 10.5, ...mono }}>{o.example_target_fields}</td></tr>)}</tbody></table>
    {(d.objects || []).length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>{data ? "No objects match." : "Loading…"}</div>}
  </>);
}

export function QcTab({ t, initial }) {
  const [data, setData] = useState(initial || null);
  useEffect(() => { if (initial) return undefined; let on = true; api.qc().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const controls = (data && data.controls) || [];
  const keys = Array.from(new Set(controls.flatMap((c) => Object.keys(c.row || {})))).slice(0, 12);
  return (<>
    <H t={t} sub="TARGET_FIELD_QC: the reconciliation controls on the SEI target fields, as the workbook carries them. Every column of the sheet is kept.">Target-field QC</H>
    {controls.length === 0 && <div style={{ fontSize: 12, color: t.textMuted }}>{data ? "No controls loaded." : "Loading…"}</div>}
    {controls.length > 0 && <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}><thead><tr>{["Control", "Applies to", "Expected", "Actual", "Result", ...keys.filter((k) => !/control|applies|expected|actual|result|status/i.test(k))].map((h) => <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
      <tbody>{controls.map((c) => <tr key={c.qc_id}><td style={td(t, true)}>{c.control_name}</td><td style={td(t)}>{c.applies_to}</td><td style={td(t)}>{c.expected}</td><td style={td(t)}>{c.actual}</td><td style={td(t)}><Pill c={STATUS_COLOR(c.result)}>{c.result || "—"}</Pill></td>
        {keys.filter((k) => !/control|applies|expected|actual|result|status/i.test(k)).map((k) => <td key={k} style={{ ...td(t), fontSize: 11 }}>{(c.row || {})[k]}</td>)}</tr>)}</tbody></table>}
  </>);
}
