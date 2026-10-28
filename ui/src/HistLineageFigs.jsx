// Data Analysis · Historical data migration: the two pictures the Lineage
// tab already draws for the operational catalog, drawn for a historical
// record. The lineage diagram in the Data Analysis style: historical
// sources → transformation rule → SEI target field → where it goes next,
// as boxes in four columns with curved edges. The column-level chain in
// the crosswalk style: one box per stage with the rule on every hop, from
// the historical source column through the SEI field, the STAR contract
// field, landing and conformed, to the IMDS column.
import React from "react";
import { LANE_LABEL, STATUS_COLOR } from "./histMigrationApi.js";

const MONO = "ui-monospace, Menlo, monospace";
const LANE_C = { ADDVANTAGE_SEI_HIST: "#7c3aed", STAR_SEI_HIST: "#0f4775", UAF_SEI_HIST: "#c96a12", COMMON: "#159943", CONFIG: "#b45309", UNCLASSIFIED: "#6b7884" };
const STAGE_C = { HIST: "#7c3aed", RULE: "#0f4775", SEI: "#0091bf", STAR: "#233240", STG1: "#00a3a3", STG2: "#0091bf", DWH: "#0f4775" };
const COL = [{ x: 0, w: 300 }, { x: 380, w: 250 }, { x: 710, w: 230 }, { x: 1020, w: 280 }];
const W = 1300, NODE_H = 44, ROW = 14;
const trunc = (s, n) => (s && String(s).length > n ? String(s).slice(0, n - 1) + "…" : s || "");
const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim();

// The record's source objects and fields, one box per object.
export function histSources(d) {
  const r = d.record || {};
  const text = `${r.source_object_field || ""} ${r.source_dependencies || ""}`;
  const by = {};
  for (const m of text.matchAll(/([A-Za-z][A-Za-z0-9_]{2,})(?:\.([A-Za-z][A-Za-z0-9_]*))?/g)) {
    const obj = m[1].toUpperCase();
    if (!/_/.test(obj) && !/^(AV|IM|XOS|SGA|UAF)/.test(obj)) continue;
    const g = by[obj] || (by[obj] = { object: obj, fields: [], meaning: null });
    if (m[2] && !g.fields.includes(m[2].toUpperCase())) g.fields.push(m[2].toUpperCase());
  }
  for (const o of d.decon || []) if (by[(o.technical_object || "").toUpperCase()]) by[(o.technical_object || "").toUpperCase()].meaning = o;
  const list = Object.values(by);
  if (!list.length && r.source_object_field) list.push({ object: r.source_object_field, fields: [], meaning: null });
  return list;
}

export function HistLineageDiagram({ t, d }) {
  const r = d.record;
  if (!r) return null;
  const laneC = LANE_C[r.lane_id] || "#6b7884";
  const src = [];
  let y = 18;
  for (const s of histSources(d)) {
    const h = NODE_H + Math.min(s.fields.length, 6) * ROW + (s.meaning ? ROW : 0);
    src.push({ ...s, y, h });
    y += h + 12;
  }
  const srcH = Math.max(y, 90);
  const rules = d.rules || [];
  const ruleH = NODE_H + 40 + Math.min(rules.length, 4) * ROW;
  const seiH = NODE_H + 64;
  const down = [];
  let dy = 0;
  const groups = [["SEI INPUT LINEAGE", (d.seiInput || []).map((x) => ({ a: `${x.sei_target_file} · ${x.sei_field}`, b: `${x.published_type || ""} · ${x.mapping_status || ""}` }))],
                  ["STAR CONTRACT FIELD", (d.star || []).map((x) => ({ a: `${x.src_file_key || "?"} · ${x.src_source_column || "?"}`, b: `${x.map_kind || ""} ${x.sei_feed ? `· ${x.sei_feed}` : ""}` }))],
                  ["IMDS COLUMN", (d.imds || []).map((x) => ({ a: `${x.dwh_target_table}.${x.dwh_target_column}`, b: `${x.dwh_type || ""} · ${x.lineage_status || ""}` }))]];
  for (const [kind, items] of groups) {
    if (!items.length) continue;
    dy += 18;
    items.slice(0, 5).forEach((it) => { down.push({ ...it, kind, y: dy, h: NODE_H }); dy += NODE_H + 10; });
  }
  const downH = Math.max(dy, 70);
  const H = Math.max(srcH, ruleH, seiH, downH) + 24;
  const mid = (h) => (H - h) / 2;
  const ruleY = mid(ruleH), seiY = mid(seiH);
  const curve = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${x1 + (x2 - x1) / 2} ${y1}, ${x1 + (x2 - x1) / 2} ${y2}, ${x2} ${y2}`;
  const ruleText = oneLine(r.transformation_rule) || (rules[0] && oneLine(rules[0].transformation_rule)) || "";
  const ruleKind = (rules[0] && rules[0].rule_type) || (ruleText ? "RULE" : "NOT WRITTEN");
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "12px 14px 8px", marginBottom: 12, overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block", minWidth: 980 }} fontFamily={t.font}
        aria-label={`Historical lineage of ${r.lineage_id}: ${src.length} historical source objects on the ${LANE_LABEL[r.lane_id] || r.lane_id} lane, through the ${ruleKind} rule, to SEI ${r.target_dat_file} ${r.target_field}, then ${down.length} downstream nodes: SEI input lineage, STAR contract field and IMDS column.`}>
        <defs><marker id="hl-da-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker></defs>
        {[["Historical sources", 0], ["Transformation rule", 1], ["SEI target field", 2], ["Where it goes today", 3]].map(([lab, i]) => (
          <text key={lab} x={COL[i].x} y={10} fontSize="9.5" fontWeight="800" fill={t.textMuted} letterSpacing=".6">{lab.toUpperCase()}</text>))}
        {src.map((s, i) => <path key={`e${i}`} d={curve(COL[0].x + COL[0].w, s.y + s.h / 2, COL[1].x, ruleY + ruleH / 2)} fill="none" stroke={laneC} strokeWidth={1.6} strokeOpacity={0.6} markerEnd="url(#hl-da-arrow)" />)}
        <path d={curve(COL[1].x + COL[1].w, ruleY + ruleH / 2, COL[2].x, seiY + seiH / 2)} fill="none" stroke={STAGE_C.RULE} strokeWidth={2.2} strokeOpacity={0.8} strokeDasharray={ruleText ? "none" : "5,4"} markerEnd="url(#hl-da-arrow)" />
        {down.map((x, i) => <path key={`d${i}`} d={curve(COL[2].x + COL[2].w, seiY + seiH / 2, COL[3].x, x.y + x.h / 2)} fill="none" stroke="#8a97a6" strokeWidth={1.4} strokeOpacity={0.7} strokeDasharray="5,4" markerEnd="url(#hl-da-arrow)" />)}
        {src.length === 0 && <g><rect x={COL[0].x} y={mid(50)} width={COL[0].w} height={50} rx={6} fill="#fff" stroke="#b42318" strokeDasharray="4,3" />
          <text x={COL[0].x + 12} y={mid(50) + 22} fontSize="11.5" fontWeight="700" fill="#b42318">no historical source named</text>
          <text x={COL[0].x + 12} y={mid(50) + 38} fontSize="10" fill={t.textMuted}>SOURCE_OBJECT_FIELD is empty on this row</text></g>}
        {src.map((s, i) => (
          <g key={`s${i}`}>
            <rect x={COL[0].x} y={s.y} width={COL[0].w} height={s.h} rx={6} fill="#fff" stroke="#9fb0c0" strokeWidth={1.2} />
            <rect x={COL[0].x} y={s.y} width={5} height={s.h} rx={2} fill={laneC} />
            <text x={COL[0].x + 14} y={s.y + 17} fontSize="11.5" fontWeight="700" fill={t.navy || t.text} fontFamily={MONO}>{trunc(s.object, 34)}</text>
            <text x={COL[0].x + 14} y={s.y + 31} fontSize="9.5" fill={laneC} fontWeight="700" letterSpacing=".4">{(LANE_LABEL[r.lane_id] || r.lane_id || "").toUpperCase()}{r.source_system ? `  · ${r.source_system.toUpperCase()}` : ""}</text>
            {s.fields.slice(0, 6).map((f, j) => <text key={f} x={COL[0].x + 14} y={s.y + 45 + j * ROW} fontSize="10.5" fill={t.text} fontFamily={MONO}>· {trunc(f, 36)}</text>)}
            {s.meaning && <text x={COL[0].x + 14} y={s.y + 45 + Math.min(s.fields.length, 6) * ROW} fontSize="9.5" fill={s.meaning.basis_class === "CURATED" ? "#159943" : "#c96a12"}>{trunc(`${s.meaning.business_meaning || ""} · ${s.meaning.basis_class === "CURATED" ? "curated" : "name-derived"}`, 44)}</text>}
          </g>))}
        <g>
          <rect x={COL[1].x} y={ruleY} width={COL[1].w} height={ruleH} rx={8} fill={`${STAGE_C.RULE}12`} stroke={STAGE_C.RULE} strokeWidth={1.4} />
          <text x={COL[1].x + 14} y={ruleY + 20} fontSize="12.5" fontWeight="800" fill={t.navy || t.text}>{ruleKind}</text>
          <text x={COL[1].x + 14} y={ruleY + 35} fontSize="9.5" fill={t.sub}>{r.transformation_rule_source ? `from ${r.transformation_rule_source}` : rules.length ? `${rules.length} rule${rules.length === 1 ? "" : "s"} in HIST_MIGRATION_RULE` : "nothing written"}</text>
          <text x={COL[1].x + 14} y={ruleY + 52} fontSize="10" fill={t.text} fontFamily={MONO}>{trunc(ruleText, 38)}</text>
          <text x={COL[1].x + 14} y={ruleY + 68} fontSize="10" fontWeight="700" fill={STATUS_COLOR(r.rule_status)}>rule {r.rule_status || "—"} <tspan fill={STATUS_COLOR(r.approval_status)}>· approval {r.approval_status || "—"}</tspan></text>
          {rules.slice(0, 4).map((x, j) => <text key={x.rule_id} x={COL[1].x + 14} y={ruleY + 84 + j * ROW} fontSize="10" fill={STAGE_C.RULE} fontWeight="700" fontFamily={MONO}>⟲ {trunc(x.rule_id, 18)} <tspan fill={t.textMuted} fontWeight="400">{(x.rule_type || "").toLowerCase()} · {(x.mapping_status || "").toLowerCase()}</tspan></text>)}
        </g>
        <g>
          <rect x={COL[2].x} y={seiY} width={COL[2].w} height={seiH} rx={8} fill="#fff" stroke={STAGE_C.SEI} strokeWidth={2} />
          <text x={COL[2].x + 14} y={seiY + 18} fontSize="9.5" fontWeight="700" fill={STAGE_C.SEI} letterSpacing=".4">{(r.target_dat_file || "").toUpperCase()}</text>
          <text x={COL[2].x + 14} y={seiY + 36} fontSize="13" fontWeight="800" fill={t.navy || t.text} fontFamily={MONO}>{trunc(r.target_field, 24)}</text>
          <text x={COL[2].x + 14} y={seiY + 52} fontSize="10" fill={t.sub}>{r.target_data_type || "?"}{r.target_max_length ? ` (${r.target_max_length}${r.target_decimal_pos ? `,${r.target_decimal_pos}` : ""})` : ""}{r.mandatory ? ` · mandatory ${r.mandatory}` : ""}</text>
          <text x={COL[2].x + 14} y={seiY + 68} fontSize="10" fontWeight="700" fill={STATUS_COLOR(r.decon_dictionary_status)}>dictionary {r.decon_dictionary_status || "—"} <tspan fill={STATUS_COLOR(r.match_status)}>· match {r.match_status || "—"}</tspan></text>
          <text x={COL[2].x + 14} y={seiY + 84} fontSize="9.5" fill={t.textMuted}>{trunc(r.target_key, 36)}</text>
          <text x={COL[2].x + 14} y={seiY + 100} fontSize="9.5" fill={t.textMuted}>{(d.siblings || []).length ? `${d.siblings.length} other lane${d.siblings.length === 1 ? "" : "s"} reach this field` : "only this lane reaches this field"}</text>
        </g>
        {down.length === 0 && <text x={COL[3].x} y={mid(0) + 4} fontSize="10.5" fill={t.textMuted}>no operational SEI input, STAR field or IMDS column by this name</text>}
        {down.map((x, i) => (
          <g key={`t${i}`}>
            <rect x={COL[3].x} y={x.y} width={COL[3].w} height={x.h} rx={6} fill="#fff" stroke="#9fb0c0" strokeWidth={1.2} />
            <text x={COL[3].x + 12} y={x.y + 14} fontSize="8.5" fontWeight="800" fill={t.textMuted} letterSpacing=".5">{x.kind}</text>
            <text x={COL[3].x + 12} y={x.y + 29} fontSize="11" fontWeight="700" fill={t.navy || t.text} fontFamily={MONO}>{trunc(x.a, 34)}</text>
            <text x={COL[3].x + 12} y={x.y + 40} fontSize="9" fill={t.sub}>{trunc(x.b, 40)}</text>
          </g>))}
      </svg>
      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 4 }}>left to right: historical source → transformation → SEI field → where that SEI field goes today. Dashed: joined by exact normalised field name, not part of the historical mapping.</div>
    </div>);
}

// The column-level chain: one box per stage, the rule on every hop.
function Box({ t, stage, label, column, table, note }) {
  const c = STAGE_C[stage] || "#6b7884";
  return (
    <div style={{ minWidth: 0, flex: "0 0 150px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: c, marginBottom: 3 }}>{label}</div>
      <div style={{ border: `1px solid ${c}33`, borderLeft: `3px solid ${c}`, borderRadius: 3, background: `${c}0f`, padding: "7px 9px", minWidth: 0 }}>
        <div title={column} style={{ fontFamily: MONO, fontSize: 11, color: t.navy || t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{column || "—"}</div>
        <div title={table} style={{ fontSize: 9.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table || ""}</div>
        {note && <div style={{ fontSize: 9.5, color: t.sub, marginTop: 2 }}>{note}</div>}
      </div>
    </div>);
}
function Hop({ t, rule, kind, dashed }) {
  const empty = !rule;
  return (
    <div style={{ flex: "0 0 150px", minWidth: 0, alignSelf: "flex-end", padding: "0 6px 2px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, color: empty ? "#c96a12" : t.textMuted, textTransform: "uppercase" }}>{kind}</div>
      <div style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${empty ? "#c96a12" : "#8a97a6"}`, margin: "4px 0 3px", position: "relative" }}>
        <span style={{ position: "absolute", right: -2, top: -6, color: empty ? "#c96a12" : "#8a97a6", fontSize: 11 }}>›</span></div>
      <div title={rule} style={{ fontFamily: MONO, fontSize: 10, color: empty ? "#c96a12" : t.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 54, overflow: "hidden" }}>{empty ? "no rule written" : trunc(oneLine(rule), 110)}</div>
    </div>);
}

export function HistHopChain({ t, d }) {
  const r = d.record;
  if (!r) return null;
  const srcCol = (r.source_object_field || "").split(/[,;\n]/)[0].trim();
  const [srcObj, srcField] = srcCol.includes(".") ? [srcCol.slice(0, srcCol.lastIndexOf(".")), srcCol.slice(srcCol.lastIndexOf(".") + 1)] : [srcCol, ""];
  const paths = (d.imds || []).length ? d.imds : [null];
  const star0 = (d.star || [])[0];
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 2 }}>Column-level transformation chain</div>
      <div style={{ fontSize: 11, color: t.sub, marginBottom: 10 }}>The historical column to the SEI field with the analyst's rule on the hop, then the operational hops that field takes today with the rule on each: STAR contract, landing, conformed, warehouse. A hop with nothing written is the one to question.</div>
      {paths.map((g, i) => {
        const star = g ? (d.star || []).find((m) => m.map_id === g.star_map) || star0 : star0;
        return (
          <div key={g ? g.lineage_id : "none"} style={{ display: "flex", alignItems: "stretch", flexWrap: "nowrap", gap: 2, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
            <Box t={t} stage="HIST" label="Historical source" column={srcField || srcObj} table={srcField ? srcObj : r.source_system} note={LANE_LABEL[r.lane_id] || r.lane_id} />
            <Hop t={t} rule={r.transformation_rule || (d.rules && d.rules[0] && d.rules[0].transformation_rule)} kind="transformation" />
            <Box t={t} stage="SEI" label="SEI target" column={r.target_field} table={r.target_dat_file} note={`${r.target_data_type || ""}${r.target_max_length ? `(${r.target_max_length})` : ""} · ${r.match_status || ""}`} />
            {star && <><Hop t={t} rule={`${r.match_method || "EXACT_NORMALIZED_FIELD_MATCH"} · ${star.map_kind || "mapped"}`} kind="name match" dashed />
              <Box t={t} stage="STAR" label="STAR contract" column={star.src_source_column} table={star.src_file_key} note={star.sei_feed ? `${star.sei_feed}${star.sei_entity ? ` / ${star.sei_entity}` : ""}` : ""} /></>}
            {g && <>
              <Hop t={t} rule={g.src_to_stg1_transform} kind="src → stg1" dashed />
              <Box t={t} stage="STG1" label="Landing" column={g.stg1_source_column || "N/A"} table={g.stg1_source_table} />
              <Hop t={t} rule={g.stg1_to_stg2_transform} kind="stg1 → stg2" dashed />
              <Box t={t} stage="STG2" label="Conformed" column={g.stg2_source_column || "N/A"} table={g.stg2_source_table} />
              <Hop t={t} rule={g.stg2_to_dwh_transform} kind="stg2 → dwh" dashed />
              <Box t={t} stage="DWH" label="IMDS warehouse" column={g.dwh_target_column} table={g.dwh_target_table} note={`${g.dwh_type || ""}${g.dwh_length ? `(${g.dwh_length})` : ""} · ${g.lineage_status || ""}`} />
            </>}
            {!star && !g && <div style={{ flex: "1 1 200px", alignSelf: "center", fontSize: 11, color: t.textMuted, padding: "0 10px" }}>no operational STAR field or IMDS column carries this SEI field name today</div>}
            {i === 0 && paths.length > 1 && null}
          </div>);
      })}
      {paths.length > 1 && <div style={{ fontSize: 10.5, color: t.textMuted }}>{paths.length} operational paths carry this field; one chain per IMDS column.</div>}
    </div>);
}

// The column-level lineage mapping, one row per path.
export function MappingTable({ t, rows }) {
  const th = { textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" };
  const td = (first) => ({ padding: "6px 10px 6px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: first ? t.text : t.sub, fontWeight: first ? 600 : 400, lineHeight: 1.45, fontSize: 11.5 });
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{["Lane", "Historical source column", "Transformation", "SEI dat file · field", "Match", "STAR contract field", "STG1 · STG2", "IMDS column", "Statuses"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={`${r.lineage_id}-${r.legacy_id || i}`}>
            <td style={td(true)}><span style={{ fontSize: 9.5, fontWeight: 800, color: LANE_C[r.lane_id] || "#6b7884", border: `1px solid ${LANE_C[r.lane_id] || "#6b7884"}`, borderRadius: 3, padding: "0 5px", whiteSpace: "nowrap" }}>{LANE_LABEL[r.lane_id] || r.lane_id}</span><div style={{ fontSize: 10, color: t.textMuted, fontFamily: MONO }}>{r.lineage_id}</div></td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 11 }}>{r.source_object_field}</td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 10.5, maxWidth: 320, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{trunc(oneLine(r.transformation_rule), 180) || <span style={{ color: "#c96a12" }}>no rule written</span>}</td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 11 }}>{r.target_dat_file}<div style={{ fontWeight: 700, color: t.text }}>{r.target_field}</div><div style={{ fontSize: 10, color: t.textMuted }}>{r.target_data_type}{r.target_max_length ? `(${r.target_max_length})` : ""}</div></td>
            <td style={td()}><span style={{ fontSize: 9.5, fontWeight: 800, color: STATUS_COLOR(r.match_status), border: `1px solid ${STATUS_COLOR(r.match_status)}`, borderRadius: 3, padding: "0 5px" }}>{r.match_status || "—"}</span></td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 11 }}>{r.src_source_column ? <>{r.src_source_column}<div style={{ fontSize: 10, color: t.textMuted }}>{r.src_file_key}{r.map_kind ? ` · ${r.map_kind}` : ""}</div></> : <span style={{ color: t.textMuted }}>—</span>}</td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 10.5 }}>{r.stg1_source_column || r.stg2_source_column ? <>{r.stg1_source_column || "N/A"}<div style={{ color: t.textMuted }}>{r.stg2_source_column || "N/A"}</div></> : <span style={{ color: t.textMuted }}>—</span>}</td>
            <td style={{ ...td(), fontFamily: MONO, fontSize: 11 }}>{r.dwh_target_column ? <>{r.dwh_target_table}<div style={{ fontWeight: 700, color: t.text }}>{r.dwh_target_column}</div><div style={{ fontSize: 10, color: t.textMuted }}>{r.dwh_type || ""}{r.lineage_status ? ` · ${r.lineage_status}` : ""}</div></> : <span style={{ color: t.textMuted }}>—</span>}</td>
            <td style={td()}><div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{[r.rule_status, r.approval_status, r.decon_dictionary_status].map((s, j) => <span key={j} style={{ fontSize: 9.5, fontWeight: 800, color: STATUS_COLOR(s), border: `1px solid ${STATUS_COLOR(s)}`, borderRadius: 3, padding: "0 5px" }}>{s || "—"}</span>)}</div></td>
          </tr>))}</tbody>
      </table>
      {rows.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>No mapping rows.</div>}
    </div>);
}
