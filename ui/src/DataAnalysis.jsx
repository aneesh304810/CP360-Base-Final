// Utilities · Data Analysis — SEI's merged source-file catalog, read as a
// migration.
//
// THE QUESTION. For every field of every SEI conversion load file: where
// does its value come from in BBH, by what rule, where does it go next,
// and what is still open. SEI is the TARGET; the catalog calls the load
// file the "source object" because SEI wrote the sheet, and the page says
// so once rather than renaming SEI's columns.
//
// Six tabs. Overview counts; Fields is the catalog, filterable; Lineage
// draws one field left to right (BBH sources → rule → SEI field → outbound
// files and reports); Sources turns the lineage round (which BBH tables
// feed which files); Findings is what is still open; Lookups lists the
// crosswalk tables and config lists in use. Every reading on screen was
// made at ingest (ingestion/sei_migration_rules.py); the page draws, it
// does not re-derive.

import React, { useEffect, useMemo, useState } from "react";
import { seiMigrationApi as api, RULE_CLASSES, STATUS_CLASSES, MANDATORY_CLASSES, SYSTEMS, TARGET_KINDS,
         ruleColor, statusColor, systemColor, buildLineage, describeRule } from "./seiMigrationApi.js";

const TABS = ["Overview", "Fields", "Lineage", "Sources", "Findings", "Lookups"];

// ----------------------------------------------------------- small parts
const Tile = ({ t, n, label, sub, color }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "12px 16px", minWidth: 150 }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 6 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>{sub}</div>}
  </div>);

const Chip = ({ t, color, children, onClick, active, title }) => (
  <span onClick={onClick} title={title} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
    style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
      color: active ? "#fff" : color, background: active ? color : `${color}1a`, border: `1px solid ${active ? color : "transparent"}`,
      cursor: onClick ? "pointer" : "default" }}>{children}</span>);

const Bars = ({ t, rows, color, label, onPick, hint }) => {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>{label}</div>
      {rows.map((r) => (
        <div key={r.key} onClick={onPick ? () => onPick(r.key) : undefined} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined}
          title={hint ? hint(r.key) : undefined}
          style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", gap: 8, alignItems: "center", padding: "2px 0", cursor: onPick ? "pointer" : "default" }}>
          <div style={{ fontSize: 11.5, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label || r.key}</div>
          <div style={{ height: 8, background: t.panel2, borderRadius: 4 }}>
            <div style={{ width: `${100 * r.n / max}%`, height: 8, background: color(r.key), borderRadius: 4 }} /></div>
          <div style={{ fontSize: 11, color: t.sub, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.n}</div>
        </div>))}
      {!rows.length && <div style={{ fontSize: 11.5, color: t.textMuted }}>nothing loaded</div>}
    </div>);
};

const th = (t) => ({ textAlign: "left", fontSize: 9.5, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px",
  padding: "7px 10px", borderBottom: `1px solid ${t.border}`, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", top: 0, background: t.panel });
const td = (t) => ({ padding: "7px 10px", borderBottom: `1px solid ${t.panel2}`, fontSize: 12, color: t.text, verticalAlign: "top" });
const sel = (t) => ({ fontSize: 11.5, padding: "4px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: "#fff", fontFamily: t.font, color: t.text });

function Section({ t, title, children, right }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: t.navy, textTransform: "uppercase", letterSpacing: ".6px" }}>{title}</div>
        {right && <div style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>{right}</div>}
      </div>
      {children}
    </div>);
}

function Fold({ t, title, summary, children, open: o0 = false }) {
  const [open, setOpen] = useState(o0);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 3, marginBottom: 8, background: "#fff" }}>
      <div onClick={() => setOpen(!open)} role="button" tabIndex={0} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 12px", cursor: "pointer" }}>
        <span style={{ fontSize: 11, color: t.accent, width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: t.sub, whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ fontSize: 11.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{summary}</span>
      </div>
      {open && <div style={{ padding: "0 12px 10px" }}>{children}</div>}
    </div>);
}

const Pre = ({ t, text }) => (
  <pre style={{ margin: 0, padding: "10px 12px", background: t.navy, color: "#dfe6ee", borderRadius: 4, fontSize: 11.5, lineHeight: 1.5,
    whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{text || "—"}</pre>);

// --------------------------------------------------------------- overview
function Overview({ t, ov, onFile, onRule, onStatus, onSystem, onFindings }) {
  const T = ov?.totals || {};
  const byFile = ov?.by_file || [];
  const ruleKeys = Object.keys(RULE_CLASSES);
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Tile t={t} n={T.fields || 0} label="SEI fields" sub={`${T.files || 0} load files · ${T.groups || 0} functional groups`} />
        <Tile t={t} n={T.mandatory_always || 0} label="required always" sub="for every account type" color={t.accent} />
        <Tile t={t} n={`${T.mapped_pct || 0}%`} label="mapped" sub={`${T.mapped || 0} fields have a rule`} color={t.success} />
        <Tile t={t} n={`${T.complete_pct || 0}%`} label="complete" sub={`${T.complete || 0} marked complete`} color={t.success} />
        <Tile t={t} n={T.lookups || 0} label="lookups" sub="through a crosswalk or config list" color={t.accent} />
        <div onClick={onFindings} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
          <Tile t={t} n={T.findings || 0} label="findings" sub="open items, by kind" color={T.findings ? t.warning : t.success} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)", gap: 14 }}>
        <Section t={t} title="By load file" right="click a file to list its fields">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th(t)}>Load file</th><th style={th(t)}>Group</th><th style={{ ...th(t), textAlign: "right" }}>Fields</th>
              <th style={th(t)}>Rules</th><th style={{ ...th(t), textAlign: "right" }}>Required</th><th style={{ ...th(t), textAlign: "right" }}>Mapped</th>
              <th style={{ ...th(t), textAlign: "right" }}>Complete</th><th style={{ ...th(t), textAlign: "right" }}>Open</th></tr></thead>
            <tbody>
              {byFile.map((f) => (
                <tr key={f.source_object} onClick={() => onFile(f.source_object)} style={{ cursor: "pointer" }}>
                  <td style={{ ...td(t), fontWeight: 700, color: t.navy, whiteSpace: "nowrap" }}>{f.source_object}</td>
                  <td style={{ ...td(t), color: t.sub }}>{f.functional_group || "—"}</td>
                  <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.fields}</td>
                  <td style={{ ...td(t), minWidth: 160 }}>
                    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: t.panel2 }} title={ruleKeys.filter((k) => f.rules[k]).map((k) => `${RULE_CLASSES[k].label} ${f.rules[k]}`).join(" · ")}>
                      {ruleKeys.filter((k) => f.rules[k]).map((k) => (
                        <div key={k} style={{ width: `${100 * f.rules[k] / f.fields}%`, background: ruleColor(t, k) }} />))}
                    </div></td>
                  <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.mandatory_always}{f.conditional ? <span style={{ color: t.textMuted }}> +{f.conditional}</span> : null}</td>
                  <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums", color: f.mapped_pct < 100 ? t.warning : t.success, fontWeight: 700 }}>{f.mapped_pct}%</td>
                  <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums", color: f.complete_pct < 100 ? t.warning : t.success, fontWeight: 700 }}>{f.complete_pct}%</td>
                  <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums", color: f.open ? t.danger : t.textMuted }}>{f.open || "—"}</td>
                </tr>))}
              {!byFile.length && <tr><td style={td(t)} colSpan={8}><Empty t={t} /></td></tr>}
            </tbody>
          </table>
        </Section>
        <div>
          <Section t={t} title="How fields are mapped">
            <Bars t={t} label="rule class" color={(k) => ruleColor(t, k)} onPick={onRule} hint={(k) => RULE_CLASSES[k]?.hint}
              rows={(ov?.by_rule || []).map((r) => ({ ...r, label: RULE_CLASSES[r.key]?.label || r.key }))} />
            <Bars t={t} label="status" color={(k) => statusColor(t, k)} onPick={onStatus}
              rows={(ov?.by_status || []).map((r) => ({ ...r, label: STATUS_CLASSES[r.key] || r.key }))} />
            <Bars t={t} label="required" color={() => t.accent} hint={(k) => MANDATORY_CLASSES[k]?.hint}
              rows={(ov?.by_mandatory || []).map((r) => ({ ...r, label: MANDATORY_CLASSES[r.key]?.label || r.key }))} />
          </Section>
          <Section t={t} title="Where the values come from" right="BBH systems feeding SEI">
            <Bars t={t} label="source system · fields fed" color={(k) => systemColor(t, k)} onPick={onSystem} hint={(k) => SYSTEMS[k]?.hint}
              rows={(ov?.by_system || []).filter((r) => r.role === "SOURCE").map((r) => ({ key: r.system_class, n: r.fields, label: `${SYSTEMS[r.system_class]?.label || r.system_class} · ${r.tables_n} tables` }))} />
            <Bars t={t} label="crosswalks and config lists" color={() => t.muted}
              rows={(ov?.by_system || []).filter((r) => r.role !== "SOURCE").map((r) => ({ key: `${r.system_class}:${r.role}`, n: r.fields, label: `${SYSTEMS[r.system_class]?.label || r.system_class} · ${r.role.toLowerCase()}` }))} />
          </Section>
          <Section t={t} title="Where the values go next">
            <Bars t={t} label="downstream" color={() => t.navy}
              rows={(ov?.by_target || []).map((r) => ({ key: r.target_kind, n: r.fields, label: `${TARGET_KINDS[r.target_kind] || r.target_kind} · ${r.objects}` }))} />
          </Section>
        </div>
      </div>
    </div>);
}

const Empty = ({ t }) => (
  <div style={{ padding: "18px 6px", color: t.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>
    Nothing loaded yet. Run <code>sql/78_sei_migration.sql</code>, drop the merged catalog workbook into
    <code> local-data/sei-migration/</code> and run <code>.\local\load.ps1 sei_migration</code>
    (<code>python -m ingestion.run sei_migration</code>). See <code>docs/sei_migration/INGEST.md</code>.
  </div>);

// ----------------------------------------------------------------- fields
function Fields({ t, filter, setFilter, files, onOpen }) {
  const [data, setData] = useState({ fields: [], total: 0 });
  const [q, setQ] = useState(filter.q || "");
  useEffect(() => { let on = true; api.fields(filter).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [JSON.stringify(filter)]);
  const set = (k, v) => setFilter({ ...filter, [k]: v || undefined });
  const chips = Object.entries(filter).filter(([, v]) => v);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select style={sel(t)} value={filter.file || ""} onChange={(e) => set("file", e.target.value)}>
          <option value="">every load file</option>{files.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select style={sel(t)} value={filter.rule || ""} onChange={(e) => set("rule", e.target.value)}>
          <option value="">any rule class</option>{Object.entries(RULE_CLASSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select style={sel(t)} value={filter.status || ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">any status</option>{Object.entries(STATUS_CLASSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select style={sel(t)} value={filter.mandatory || ""} onChange={(e) => set("mandatory", e.target.value)}>
          <option value="">any requirement</option>{Object.entries(MANDATORY_CLASSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select style={sel(t)} value={filter.system || ""} onChange={(e) => set("system", e.target.value)}>
          <option value="">any source system</option>{Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <form onSubmit={(e) => { e.preventDefault(); set("q", q.trim()); }} style={{ display: "inline" }}>
          <input style={{ ...sel(t), width: 220 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="attribute, rule text, table…  ⏎" /></form>
        {chips.length > 0 && <span onClick={() => { setFilter({}); setQ(""); }} role="button" tabIndex={0} style={{ fontSize: 11, color: t.accent, fontWeight: 700, cursor: "pointer" }}>clear ✕</span>}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: t.sub }}><b style={{ color: t.navy }}>{data.total}</b> fields{data.total > data.fields.length ? ` · first ${data.fields.length} shown` : ""}</span>
      </div>
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: "72vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th(t)}>Load file</th><th style={{ ...th(t), textAlign: "right" }}>#</th><th style={th(t)}>SEI attribute</th><th style={th(t)}>Type</th>
            <th style={th(t)}>Required</th><th style={th(t)}>Rule</th><th style={th(t)}>From</th><th style={th(t)}>Status</th><th style={th(t)}>Flags</th></tr></thead>
          <tbody>
            {data.fields.map((f) => (
              <tr key={f.catalog_id} onClick={() => onOpen(f.catalog_id)} style={{ cursor: "pointer" }} title="open the lineage">
                <td style={{ ...td(t), color: t.sub, whiteSpace: "nowrap" }}>{f.source_object}</td>
                <td style={{ ...td(t), textAlign: "right", color: t.textMuted, fontVariantNumeric: "tabular-nums" }}>{f.seq ?? ""}</td>
                <td style={{ ...td(t), fontWeight: 700, color: t.navy, whiteSpace: "nowrap" }}>{f.source_attribute}</td>
                <td style={{ ...td(t), color: t.sub, whiteSpace: "nowrap" }}>{f.data_type || "—"}{f.max_length ? ` (${f.max_length}${f.max_decimal ? `,${f.max_decimal}` : ""})` : ""}</td>
                <td style={td(t)}><Chip t={t} color={f.mandatory_class === "ALWAYS" ? t.accent : f.mandatory_class === "CONDITIONAL" ? t.warning : t.textMuted} title={MANDATORY_CLASSES[f.mandatory_class]?.hint}>
                  {MANDATORY_CLASSES[f.mandatory_class]?.label || f.mandatory_class}{f.mandatory_class === "CONDITIONAL" ? ` ${f.mand_yes}/${f.mand_yes + f.mand_no}` : ""}</Chip></td>
                <td style={td(t)}><Chip t={t} color={ruleColor(t, f.rule_class)} title={RULE_CLASSES[f.rule_class]?.hint}>{RULE_CLASSES[f.rule_class]?.label || f.rule_class}</Chip>
                  {f.rule_side === "SEI" && <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 6 }}>SEI logic only</span>}</td>
                <td style={td(t)}>{(f.systems || "").split(",").filter(Boolean).map((s) => <Chip key={s} t={t} color={systemColor(t, s)}>{SYSTEMS[s]?.label || s}</Chip>)}
                  {f.crosswalk_n > 0 && <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>+{f.crosswalk_n} lookup</span>}</td>
                <td style={td(t)}><Chip t={t} color={statusColor(t, f.status_class)}>{STATUS_CLASSES[f.status_class] || f.status_class}</Chip>
                  {f.status_detail && <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 6 }}>{f.status_detail}</span>}</td>
                <td style={{ ...td(t), fontSize: 10.5, color: t.warning, whiteSpace: "nowrap" }}>
                  {[f.truncation_risk === "Y" && "truncation", f.report_out === "Y" && "report out", f.null_mitigation === "Y" && "null fallback",
                    f.country_specific === "Y" && f.domicile, f.has_validation === "Y" && "validation"].filter(Boolean).join(" · ")}</td>
              </tr>))}
            {!data.fields.length && <tr><td style={td(t)} colSpan={9}><Empty t={t} /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>);
}

// ---------------------------------------------------------------- lineage
const COL = [{ x: 0, w: 300 }, { x: 380, w: 250 }, { x: 710, w: 230 }, { x: 1020, w: 280 }];
const W = 1300, NODE_H = 44, ROW = 14, PAD = 14;

/* The picture: BBH sources → rule → SEI field → downstream, as boxes in
   four columns with curves between. Pure of the API shape via buildLineage. */
export function LineageDiagram({ t, lin }) {
  if (!lin) return null;
  // sources: one box per table, grouped by system
  const src = [];
  let y = 0;
  lin.sources.forEach((g) => {
    y += 18;
    g.tables.forEach((tb) => {
      const h = NODE_H + Math.min(tb.fields.length, 6) * ROW;
      src.push({ ...tb, system: g.system, y, h, label: `${SYSTEMS[g.system]?.label || g.system}` });
      y += h + 12;
    });
  });
  const srcH = Math.max(y, 90);
  const ruleH = NODE_H + 26 + Math.min(lin.rule.aids.length, 5) * ROW + 10;
  const seiH = NODE_H + 48;
  const down = [];
  let dy = 0;
  lin.downstream.forEach((g) => {
    dy += 18;
    g.items.slice(0, 8).forEach((it) => { down.push({ ...it, kind: g.kind, y: dy, h: NODE_H }); dy += NODE_H + 10; });
  });
  const downH = Math.max(dy, 70);
  const H = Math.max(srcH, ruleH, seiH, downH) + 20;
  const mid = (h) => (H - h) / 2;
  const ruleY = mid(ruleH), seiY = mid(seiH);
  const curve = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${x1 + (x2 - x1) / 2} ${y1}, ${x1 + (x2 - x1) / 2} ${y2}, ${x2} ${y2}`;
  const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
  const ruleCls = RULE_CLASSES[lin.rule.cls] || RULE_CLASSES.NOT_MAPPED;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} fontFamily={t.font}>
      <defs><marker id="da-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a6" /></marker></defs>
      {[["BBH sources", 0], ["BBH mapping rule", 1], ["SEI load-file field", 2], ["Where it goes next", 3]].map(([lab, i]) => (
        <text key={lab} x={COL[i].x} y={10} fontSize="9.5" fontWeight="800" fill={t.textMuted} letterSpacing=".6">{lab.toUpperCase()}</text>))}
      {/* edges */}
      {src.map((s, i) => <path key={`e${i}`} d={curve(COL[0].x + COL[0].w, s.y + s.h / 2, COL[1].x, ruleY + ruleH / 2)} fill="none" stroke={systemColor(t, s.system)} strokeWidth={1.6} strokeOpacity={0.6} markerEnd="url(#da-arrow)" />)}
      <path d={curve(COL[1].x + COL[1].w, ruleY + ruleH / 2, COL[2].x, seiY + seiH / 2)} fill="none" stroke={ruleColor(t, lin.rule.cls)} strokeWidth={2.2} strokeOpacity={0.8}
        strokeDasharray={lin.rule.cls === "NOT_MAPPED" ? "5,4" : "none"} markerEnd="url(#da-arrow)" />
      {down.map((d, i) => <path key={`d${i}`} d={curve(COL[2].x + COL[2].w, seiY + seiH / 2, COL[3].x, d.y + d.h / 2)} fill="none" stroke="#8a97a6" strokeWidth={1.4} strokeOpacity={0.7} markerEnd="url(#da-arrow)" />)}
      {/* sources */}
      {lin.empty.sources && <g><rect x={COL[0].x} y={mid(50)} width={COL[0].w} height={50} rx={6} fill="#fff" stroke={t.danger} strokeDasharray="4,3" />
        <text x={COL[0].x + 12} y={mid(50) + 22} fontSize="11.5" fontWeight="700" fill={t.danger}>no BBH source named</text>
        <text x={COL[0].x + 12} y={mid(50) + 38} fontSize="10" fill={t.textMuted}>{lin.rule.cls === "CONSTANT" || lin.rule.cls === "SET_NULL" ? "the rule needs none" : "the catalog row does not say where the value comes from"}</text></g>}
      {src.map((s, i) => {
        const c = systemColor(t, s.system);
        return (
          <g key={`s${i}`}>
            <rect x={COL[0].x} y={s.y} width={COL[0].w} height={s.h} rx={6} fill="#fff" stroke="#9fb0c0" strokeWidth={1.2} />
            <rect x={COL[0].x} y={s.y} width={5} height={s.h} rx={2} fill={c} />
            <text x={COL[0].x + 14} y={s.y + 17} fontSize="11.5" fontWeight="700" fill={t.navy}>{trunc(s.table, 36)}</text>
            <text x={COL[0].x + 14} y={s.y + 31} fontSize="9.5" fill={c} fontWeight="700" letterSpacing=".4">{s.label.toUpperCase()}{s.how === "INFERRED" ? "  · fields inferred from the rule" : ""}</text>
            {s.fields.slice(0, 6).map((f, j) => (
              <text key={f.name} x={COL[0].x + 14} y={s.y + 45 + j * ROW} fontSize="10.5" fill={t.text}>· {trunc(f.name, 38)}</text>))}
            {s.fields.length > 6 && <text x={COL[0].x + 14} y={s.y + 45 + 6 * ROW} fontSize="10" fill={t.textMuted}>+{s.fields.length - 6} more</text>}
          </g>);
      })}
      {/* rule */}
      <g>
        <rect x={COL[1].x} y={ruleY} width={COL[1].w} height={ruleH} rx={8} fill={`${ruleColor(t, lin.rule.cls)}12`} stroke={ruleColor(t, lin.rule.cls)} strokeWidth={1.4} />
        <text x={COL[1].x + 14} y={ruleY + 20} fontSize="12.5" fontWeight="800" fill={t.navy}>{ruleCls.label}</text>
        <text x={COL[1].x + 14} y={ruleY + 35} fontSize="9.5" fill={t.sub}>{lin.rule.side === "SEI" ? "SEI's logic · no BBH rule written" : lin.rule.side === "NONE" ? "nothing written" : ruleCls.hint}</text>
        <text x={COL[1].x + 14} y={ruleY + 52} fontSize="10" fill={t.text}>{trunc(lin.rule.text.replace(/\s+/g, " "), 40)}</text>
        {lin.rule.aids.slice(0, 5).map((a, j) => (
          <text key={a.table} x={COL[1].x + 14} y={ruleY + 68 + j * ROW} fontSize="10" fill={systemColor(t, a.system)} fontWeight="700">⟲ {trunc(a.table, 32)} <tspan fill={t.textMuted} fontWeight="400">{a.role.toLowerCase()}</tspan></text>))}
      </g>
      {/* sei field */}
      <g>
        <rect x={COL[2].x} y={seiY} width={COL[2].w} height={seiH} rx={8} fill="#fff" stroke={t.projSei} strokeWidth={2} />
        <text x={COL[2].x + 14} y={seiY + 18} fontSize="9.5" fontWeight="700" fill={t.projSei} letterSpacing=".4">{(lin.target.file || "").toUpperCase()}</text>
        <text x={COL[2].x + 14} y={seiY + 36} fontSize="13" fontWeight="800" fill={t.navy}>{trunc(lin.target.field, 26)}</text>
        <text x={COL[2].x + 14} y={seiY + 52} fontSize="10" fill={t.sub}>{lin.target.type || "?"}{lin.target.length ? ` (${lin.target.length}${lin.target.decimals ? `,${lin.target.decimals}` : ""})` : ""} · #{lin.target.seq ?? "?"}</text>
        <text x={COL[2].x + 14} y={seiY + 68} fontSize="10" fontWeight="700" fill={lin.target.mandatory === "ALWAYS" ? t.accent : lin.target.mandatory === "CONDITIONAL" ? t.warning : t.textMuted}>
          {MANDATORY_CLASSES[lin.target.mandatory]?.label || lin.target.mandatory}
          <tspan fill={statusColor(t, lin.target.status)}>  · {STATUS_CLASSES[lin.target.status] || lin.target.status}</tspan></text>
        <text x={COL[2].x + 14} y={seiY + 84} fontSize="9.5" fill={t.textMuted}>{trunc(lin.target.category || lin.target.group || "", 34)}</text>
      </g>
      {/* downstream */}
      {lin.empty.downstream && <text x={COL[3].x} y={mid(0) + 4} fontSize="10.5" fill={t.textMuted}>no outbound file, report or component named</text>}
      {down.map((d, i) => (
        <g key={`t${i}`}>
          <rect x={COL[3].x} y={d.y} width={COL[3].w} height={d.h} rx={6} fill="#fff" stroke="#9fb0c0" strokeWidth={1.2} />
          <text x={COL[3].x + 12} y={d.y + 15} fontSize="9.5" fontWeight="700" fill={t.textMuted} letterSpacing=".4">{(TARGET_KINDS[d.kind] || d.kind).toUpperCase()}</text>
          <text x={COL[3].x + 12} y={d.y + 30} fontSize="11" fontWeight="700" fill={t.navy}>{trunc(d.field || d.object, 40)}</text>
          {d.field && d.object && <text x={COL[3].x + 12} y={d.y + 41} fontSize="9.5" fill={t.sub}>{trunc(d.object, 44)}</text>}
        </g>))}
    </svg>);
}

function Lineage({ t, id, onPick, files, initialDetail }) {
  const [file, setFile] = useState(initialDetail?.field?.source_object || "");
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(initialDetail || null);
  useEffect(() => { if (!file) return; let on = true; api.fields({ file, limit: 5000 }).then((d) => { if (on) setList(d.fields || []); }); return () => { on = false; }; }, [file]);
  useEffect(() => {
    if (!id) return;
    let on = true;
    api.field(id).then((d) => { if (on && d) { setDetail(d); if (d.field?.source_object && d.field.source_object !== file) setFile(d.field.source_object); } });
    return () => { on = false; };
  }, [id]);
  const lin = useMemo(() => buildLineage(detail), [detail]);
  const f = detail?.field;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <select style={sel(t)} value={file} onChange={(e) => { setFile(e.target.value); }}>
          <option value="">pick a load file…</option>{files.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <select style={{ ...sel(t), minWidth: 260 }} value={id || ""} onChange={(e) => onPick(e.target.value)} disabled={!file}>
          <option value="">{file ? "pick a field…" : "—"}</option>
          {list.map((x) => <option key={x.catalog_id} value={x.catalog_id}>{x.seq != null ? `${x.seq} · ` : ""}{x.source_attribute}</option>)}</select>
        {detail && <>
          <span onClick={() => detail.prev && onPick(detail.prev)} role="button" tabIndex={0} style={{ fontSize: 11, color: detail.prev ? t.accent : t.disabled, fontWeight: 700, cursor: detail.prev ? "pointer" : "default" }}>◂ previous</span>
          <span onClick={() => detail.next && onPick(detail.next)} role="button" tabIndex={0} style={{ fontSize: 11, color: detail.next ? t.accent : t.disabled, fontWeight: 700, cursor: detail.next ? "pointer" : "default" }}>next ▸</span>
          <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 6 }}>{f.catalog_id}</span></>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>left to right: BBH source → rule → SEI field → outbound and reports</span>
      </div>
      {!lin && <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: 24, color: t.textMuted, fontSize: 12.5 }}>
        Pick a load file and a field, or click a row on the Fields or Findings tab.</div>}
      {lin && (
        <>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "14px 16px", marginBottom: 14 }}>
            <LineageDiagram t={t} lin={lin} />
          </div>
          {(detail.findings || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {detail.findings.map((x, i) => <Chip key={i} t={t} color={t.warning}>{x.kind.replace(/_/g, " ").toLowerCase()}{x.detail ? ` · ${x.detail}` : ""}</Chip>)}
            </div>)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Fold t={t} title="BBH mapping rule" summary={describeRule(f)} open>
                <Pre t={t} text={f.other_mapping_logic || "(nothing written in Other Mapping Logic)"} />
                {f.source_tables_text && <div style={{ fontSize: 11.5, color: t.sub, marginTop: 8 }}><b>Tables / fields / off-system:</b> {f.source_tables_text}</div>}
              </Fold>
              <Fold t={t} title="SEI processing logic" summary={(f.processing_logic || "none").replace(/\s+/g, " ").slice(0, 90)}>
                <Pre t={t} text={f.processing_logic} /></Fold>
              <Fold t={t} title="Validations and acceptable values" summary={[f.validations && "validations", f.acceptable_values].filter(Boolean).join(" · ") || "none"}>
                {f.validations && <Pre t={t} text={f.validations} />}
                {f.acceptable_values && <div style={{ fontSize: 11.5, color: t.sub, marginTop: 8 }}><b>Acceptable values:</b> {f.acceptable_values}</div>}
              </Fold>
            </div>
            <div>
              <Fold t={t} title="Definition" summary={(f.remarks || "").replace(/\s+/g, " ").slice(0, 90) || "none"} open>
                <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.55 }}>{f.remarks || "—"}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>{f.functional_group}{f.function_category ? ` · ${f.function_category}` : ""}{f.domicile ? ` · domicile ${f.domicile}` : ""} · {f.source_workbook}{f.source_sheet ? ` / ${f.source_sheet}` : ""}</div>
                {f.mandatory_text && <div style={{ fontSize: 11, color: t.sub, marginTop: 8 }}><b>Required by account type:</b> {f.mandatory_text}</div>}
              </Fold>
              <Fold t={t} title="DSR tagging" summary={[f.emp_dsr_status && `employee: ${f.emp_dsr_status}`, f.team_dsr_status && `team: ${f.team_dsr_status}`].filter(Boolean).join(" · ") || "none"}>
                {f.emp_dsr_logic && <><div style={{ fontSize: 10, color: t.textMuted, margin: "4px 0" }}>EMPLOYEE DSR · {f.emp_dsr_status || "—"}</div><Pre t={t} text={f.emp_dsr_logic} /></>}
                {f.team_dsr_logic && <><div style={{ fontSize: 10, color: t.textMuted, margin: "8px 0 4px" }}>TEAM DSR · {f.team_dsr_status || "—"}</div><Pre t={t} text={f.team_dsr_logic} /></>}
                {!f.emp_dsr_logic && !f.team_dsr_logic && <div style={{ fontSize: 11.5, color: t.textMuted }}>no DSR logic on this field</div>}
              </Fold>
              <Fold t={t} title="Note and status" summary={`${STATUS_CLASSES[f.status_class] || f.status_class}${f.status_detail ? ` · ${f.status_detail}` : ""}`}>
                <div style={{ fontSize: 12, color: t.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{f.note || "—"}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Other status as written: {f.other_status || "—"}</div>
              </Fold>
            </div>
          </div>
        </>)}
    </div>);
}

// ---------------------------------------------------------------- sources
function Sources({ t, files, onSystem }) {
  const [file, setFile] = useState("");
  const [data, setData] = useState({ systems: [], tables: [] });
  useEffect(() => { let on = true; api.sources({ file }).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [file]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <select style={sel(t)} value={file} onChange={(e) => setFile(e.target.value)}>
          <option value="">every load file</option>{files.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <span style={{ fontSize: 11.5, color: t.sub }}>which BBH tables feed {file || "SEI"}, and how many fields each one fills</span>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {data.systems.map((s) => (
          <div key={s.system_class} onClick={() => onSystem(s.system_class)} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
            <Tile t={t} n={s.fields} label={SYSTEMS[s.system_class]?.label || s.system_class} sub={`${s.tables} tables · ${s.files} files`} color={systemColor(t, s.system_class)} /></div>))}
        {!data.systems.length && <Empty t={t} />}
      </div>
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: "60vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th(t)}>BBH table</th><th style={th(t)}>System</th><th style={th(t)}>Role</th><th style={{ ...th(t), textAlign: "right" }}>SEI fields fed</th>
            <th style={{ ...th(t), textAlign: "right" }}>Columns named</th><th style={th(t)}>Load files</th></tr></thead>
          <tbody>
            {data.tables.map((x) => (
              <tr key={x.source_table}>
                <td style={{ ...td(t), fontWeight: 700, color: t.navy, whiteSpace: "nowrap" }}>{x.source_table}</td>
                <td style={td(t)}><Chip t={t} color={systemColor(t, x.system_class)}>{SYSTEMS[x.system_class]?.label || x.system_class}</Chip></td>
                <td style={{ ...td(t), color: t.sub, textTransform: "lowercase" }}>{x.role}</td>
                <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{x.fields}</td>
                <td style={{ ...td(t), textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.sub }}>{x.columns_n || "—"}</td>
                <td style={{ ...td(t), fontSize: 11, color: t.sub }}>{x.files.map((f) => `${f.source_object} (${f.fields})`).join(" · ")}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>);
}

// --------------------------------------------------------------- findings
function Findings({ t, files, onOpen }) {
  const [file, setFile] = useState("");
  const [kind, setKind] = useState("");
  const [data, setData] = useState({ findings: [], by_kind: [], kinds: {} });
  useEffect(() => { let on = true; api.findings({ file }).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [file]);
  const rows = kind ? data.findings.filter((x) => x.kind === kind) : data.findings;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <select style={sel(t)} value={file} onChange={(e) => setFile(e.target.value)}>
          <option value="">every load file</option>{files.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        {data.by_kind.map((k) => <Chip key={k.key} t={t} color={t.warning} active={kind === k.key} onClick={() => setKind(kind === k.key ? "" : k.key)} title={k.label}>{k.key.replace(/_/g, " ").toLowerCase()} · {k.n}</Chip>)}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: t.sub }}><b style={{ color: t.navy }}>{rows.length}</b> findings</span>
      </div>
      {kind && <div style={{ fontSize: 12, color: t.sub, marginBottom: 10 }}>{data.kinds[kind]}</div>}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, overflow: "auto", maxHeight: "68vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th(t)}>Finding</th><th style={th(t)}>Load file</th><th style={th(t)}>SEI attribute</th><th style={th(t)}>Detail</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i} onClick={() => onOpen(x.catalog_id)} style={{ cursor: "pointer" }} title="open the lineage">
                <td style={td(t)}><Chip t={t} color={t.warning}>{x.kind.replace(/_/g, " ").toLowerCase()}</Chip></td>
                <td style={{ ...td(t), color: t.sub, whiteSpace: "nowrap" }}>{x.source_object}</td>
                <td style={{ ...td(t), fontWeight: 700, color: t.navy }}>{x.source_attribute}</td>
                <td style={{ ...td(t), color: t.sub }}>{x.detail || data.kinds[x.kind] || ""}</td>
              </tr>))}
            {!rows.length && <tr><td style={td(t)} colSpan={4}><div style={{ padding: 16, color: t.success, fontSize: 12.5 }}>{data.findings.length || file ? "Nothing open here." : ""}{!data.findings.length && !file && <Empty t={t} />}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>);
}

// ---------------------------------------------------------------- lookups
function Lookups({ t }) {
  const [data, setData] = useState({ config_lists: [], crosswalks: [] });
  useEffect(() => { let on = true; api.lookups().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []);
  const table = (rows, cols) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{cols.map((c) => <th key={c[0]} style={{ ...th(t), textAlign: c[2] || "left" }}>{c[0]}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[0]} style={{ ...td(t), textAlign: c[2] || "left" }}>{c[1](r)}</td>)}</tr>)}
        {!rows.length && <tr><td style={td(t)} colSpan={cols.length}><span style={{ color: t.textMuted, fontSize: 12 }}>none loaded</span></td></tr>}</tbody>
    </table>);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Section t={t} title="SEI config lists" right="Acceptable Values on the SEI side">
        {table(data.config_lists, [["List", (r) => <b style={{ color: t.navy }}>{r.name}</b>], ["Fields", (r) => r.fields, "right"], ["Files", (r) => r.files, "right"]])}
      </Section>
      <Section t={t} title="BBH crosswalks and maps" right="named in the mapping rules">
        {table(data.crosswalks, [["Table", (r) => <b style={{ color: t.navy }}>{r.name}</b>],
          ["System", (r) => <Chip t={t} color={systemColor(t, r.system_class)}>{SYSTEMS[r.system_class]?.label || r.system_class}</Chip>],
          ["Role", (r) => String(r.role || "").toLowerCase()], ["Fields", (r) => r.fields, "right"], ["Files", (r) => r.files, "right"]])}
      </Section>
    </div>);
}

// ------------------------------------------------------------------- page
export default function DataAnalysis({ t, initial }) {
  const [tab, setTab] = useState(initial?.tab || "Overview");
  const [ov, setOv] = useState(initial?.overview || null);
  const [status, setStatus] = useState(initial?.status || null);
  const [filter, setFilter] = useState({});
  const [picked, setPicked] = useState(initial?.detail?.field?.catalog_id || null);
  useEffect(() => {
    if (initial?.overview) return;
    let on = true;
    api.overview().then((d) => { if (on) setOv(d); });
    api.ingestStatus().then((d) => { if (on) setStatus(d); });
    return () => { on = false; };
  }, []);
  const files = useMemo(() => (ov?.by_file || []).map((f) => f.source_object), [ov]);
  const openLineage = (id) => { setPicked(id); setTab("Lineage"); };
  const toFields = (patch) => { setFilter(patch); setTab("Fields"); };
  const loaded = (status?.fields || ov?.totals?.fields || 0) > 0;
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent, borderBottom: `2px solid ${t.accent}`, paddingBottom: 14, margin: "0 0 8px" }}>Data Analysis</h1>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 10px", maxWidth: 900, lineHeight: 1.55 }}>
        SEI's merged source-file catalog, read as a migration: for every field of every SEI conversion load file, where its
        value comes from in BBH, by what rule, where it goes next, and what is still open. SEI is the target; the catalog
        calls the load file the "source object" because SEI wrote the sheet.
      </p>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>
        {loaded ? <>loaded: <b style={{ color: t.navy }}>{status?.fields ?? ov?.totals?.fields}</b> fields · {status?.sources ?? "—"} source links · {status?.targets ?? "—"} downstream links{status?.updated_at ? ` · ${String(status.updated_at).slice(0, 16)}` : ""}</>
          : "nothing loaded yet — see the Overview tab for the three steps"}
      </div>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 14 }}>
        {TABS.map((v) => (
          <div key={v} onClick={() => setTab(v)} role="tab" tabIndex={0} aria-selected={tab === v}
            style={{ padding: "8px 18px", fontSize: 13, cursor: "pointer", color: tab === v ? t.accent : t.sub,
              borderBottom: tab === v ? `2px solid ${t.accent}` : "2px solid transparent", marginBottom: -1 }}>{v}</div>))}
      </div>
      {tab === "Overview" && <Overview t={t} ov={ov} onFile={(f) => toFields({ file: f })} onRule={(r) => toFields({ rule: r })}
        onStatus={(s) => toFields({ status: s })} onSystem={(s) => toFields({ system: s })} onFindings={() => setTab("Findings")} />}
      {tab === "Fields" && <Fields t={t} filter={filter} setFilter={setFilter} files={files} onOpen={openLineage} />}
      {tab === "Lineage" && <Lineage t={t} id={picked} onPick={setPicked} files={files} initialDetail={initial?.detail} />}
      {tab === "Sources" && <Sources t={t} files={files} onSystem={(s) => toFields({ system: s })} />}
      {tab === "Findings" && <Findings t={t} files={files} onOpen={openLineage} />}
      {tab === "Lookups" && <Lookups t={t} />}
    </div>);
}
