import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

// =====================================================================
// BizLineage — the pictorial Business view of legacy lineage.
// One visual grammar (circles on a line) at four zoom levels:
//   estate -> functional group -> table (four-dot census) -> column
// Column level carries the FULL dictionary entry (long_desc + attributes)
// and the WHOLE transformation (all three hops, actual expressions).
// Reads the exact same endpoints LegacyLineage already uses — no new API.
// Props: t (theme) · system · dataSource · onTechnical({table,column})
//        · onDataSource(ds, loc)
// =====================================================================

const STG_META = [
  ["🏦", "AddVantage", "nightly file", "#7c3aed"],
  ["📥", "Landed", "staging 1", "#00a3a3"],
  ["🧼", "Cleaned", "staging 2", "#0091bf"],
  ["🏪", "Warehouse", "", "#0f4775"],
];
const isNA = (v) => /not applicable|^n\/a$/i.test(String(v || "").trim());
const has = (xf) => xf && !isNA(xf);
const canon = (c) =>
  c ? String(c).trim().replace(/[\s/.\-]+/g, "_").replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "").toUpperCase().replace(/_L(\d+)/g, "_$1") : "";

const friendly = (xf) => {
  if (!has(xf)) return null;
  const u = String(xf).toUpperCase();
  if (u.includes("RTRIM") || u.includes("TRIM")) return "spaces trimmed";
  if (u.includes("TO_DATE")) return "text to date";
  if (u.includes("TO_NUMBER")) return "text to number";
  if (u.includes("DECODE") || u.includes("CASE")) return "code translated";
  if (u.includes("SUBSTR")) return "cut to size";
  if (u.includes("UPPER") || u.includes("LOWER")) return "case normalized";
  if (u.includes("CANON") || u.includes("LPAD")) return "standardized";
  return String(xf).split("(")[0].toLowerCase();
};
const fieldKind = (f) => {
  if (f.is_ud === "Y") return "ud";
  if (!f.src_source_column) return "gap";
  if (has(f.src_to_stg1_transform) || has(f.stg1_to_stg2_transform) ||
      has(f.stg2_to_dwh_transform)) return "xf";
  return "pass";
};
const KIND_META = {
  pass: { bg: "#e7f6ec", fg: "#0d6b31", label: "as-is" },
  xf:   { bg: "#fdf1e3", fg: "#a8560f", label: "changed" },
  ud:   { bg: "#f1eafd", fg: "#7c3aed", label: "UD" },
  gap:  { bg: "#fbe9ed", fg: "#c1113a", label: "no source" },
};

/* ---------------- shared atoms ---------------- */

function Circ({ i, big, dashed }) {
  const m = STG_META[i];
  return (
    <div style={{ width: big ? 54 : 32, height: big ? 54 : 32, borderRadius: "50%",
      background: "#fff", display: "grid", placeItems: "center",
      fontSize: big ? 22 : 13, flexShrink: 0,
      border: `2.5px ${dashed ? "dashed #c1113a" : "solid " + m[3]}`,
      boxShadow: "0 2px 6px rgba(20,40,60,.08)" }}>
      {dashed ? "?" : m[0]}
    </div>);
}

function Spine({ ds, vals, okFrom, hopLabels }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start",
      justifyContent: "center", margin: "6px 0 26px" }}>
      {STG_META.map((m, i) => (
        <React.Fragment key={m[1]}>
          {i > 0 && (
            <div style={{ flex: 1, maxWidth: 150, height: 2.5, background: "#c9d4dc",
              marginTop: 26, position: "relative" }}>
              {hopLabels && hopLabels[i - 1] && (
                <span style={{ position: "absolute", top: -24, left: "50%",
                  transform: "translateX(-50%)", fontSize: 10, background: "#fdf1e3",
                  color: "#e67e22", fontWeight: 700, borderRadius: 999,
                  padding: "2px 10px", whiteSpace: "nowrap" }}>
                  {hopLabels[i - 1]}</span>)}
              <span style={{ position: "absolute", right: -1, top: -4.5,
                borderLeft: "9px solid #c9d4dc", borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent" }} />
            </div>)}
          <div style={{ display: "flex", flexDirection: "column",
            alignItems: "center", gap: 7, minWidth: 150, maxWidth: 210 }}>
            <Circ i={i} big />
            <b style={{ fontSize: 13, fontWeight: 500 }}>{m[1]}</b>
            <small style={{ fontSize: 10.5, color: "#7b8894" }}>
              {i === 3 ? ds : m[2]}</small>
            {vals && (
              <div style={{ marginTop: 2, fontFamily: "Roboto Mono, monospace",
                fontSize: 10.5, borderRadius: 6, padding: "6px 9px", maxWidth: 200,
                textAlign: "center", wordBreak: "break-all",
                background: okFrom != null && i >= okFrom ? "#e7f6ec" : "#f4f7f9",
                border: `1px solid ${okFrom != null && i >= okFrom ? "#bfe3cb" : "#c9d4dc"}` }}>
                {vals[i] == null ? "∅" : String(vals[i])}
              </div>)}
          </div>
        </React.Fragment>))}
    </div>);
}

function Ring({ pct }) {
  const col = pct === 0 ? "#c2ccd4" : pct < 60 ? "#e67e22" : "#159943";
  return (
    <div style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
      background: `conic-gradient(${col} 0 ${pct}%, #edf1f4 ${pct}% 100%)`,
      display: "grid", placeItems: "center" }}>
      <span style={{ background: "#fff", width: 42, height: 42, borderRadius: "50%",
        display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700 }}>
        {pct}%</span>
    </div>);
}

function Dots({ f }) {
  const kind = fieldKind(f);
  const xfs = [f.src_to_stg1_transform, f.stg1_to_stg2_transform,
    f.stg2_to_dwh_transform];
  const dot = (color, empty) => (
    <span style={{ width: empty ? 9 : 12, height: empty ? 9 : 12,
      borderRadius: "50%", flexShrink: 0,
      background: empty ? "#fff" : color,
      border: empty ? "2px dashed #c1113a" : "none" }} />);
  const seg = (empty) => (
    <span style={{ width: 24, height: 2, flexShrink: 0,
      background: empty
        ? "repeating-linear-gradient(90deg,#c9d4dc 0 4px,transparent 4px 8px)"
        : "#c9d4dc" }} />);
  const cells = [];
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) cells.push(<React.Fragment key={"s" + i}>{seg(kind === "gap")}</React.Fragment>);
    let c = "#0f4775";
    if (kind === "ud") c = "#7c3aed";
    else if (i > 0 && has(xfs[i - 1])) c = "#e67e22";
    cells.push(<React.Fragment key={"d" + i}>{dot(c, kind === "gap" && i < 3)}</React.Fragment>);
  }
  return <div style={{ display: "flex", alignItems: "center" }}>{cells}</div>;
}

/* ---------------- the drill ---------------- */

export default function BizLineage({ t, system = "ADDVANTAGE", dataSource = "PBDW",
  onTechnical, onDataSource }) {
  const ds = (dataSource || "PBDW").toUpperCase();
  const [tables, setTables] = useState(null);
  const [fieldsBy, setFieldsBy] = useState({});
  const [nav, setNav] = useState({ level: 0, group: null, table: null, col: null });
  const [flt, setFlt] = useState("");
  const [pills, setPills] = useState({ pass: true, xf: true, ud: true, gap: true });

  useEffect(() => {
    let dead = false;
    setTables(null); setFieldsBy({});
    setNav({ level: 0, group: null, table: null, col: null });
    api.legacyLineageTables(ds).then((d) => !dead && setTables(d.tables || []));
    return () => { dead = true; };
  }, [ds]);

  const ensureFields = useCallback((tbl) => {
    setFieldsBy((m) => {
      if (m[tbl] !== undefined) return m;
      api.legacyLineageFields(tbl, ds).then((d) =>
        setFieldsBy((m2) => ({ ...m2, [tbl]: d.fields || [] })));
      return { ...m, [tbl]: null };
    });
  }, [ds]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && nav.level > 0)
        setNav((n) => ({ ...n, level: n.level - 1 }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav.level]);

  if (tables === null)
    return <div style={{ padding: 30, fontSize: 12, color: "#7b8894",
      textAlign: "center" }}>Loading {ds} lineage…</div>;

  const groups = {};
  tables.forEach((tb) => {
    const g = tb.functional_group || "Unassigned";
    (groups[g] = groups[g] || []).push(tb);
  });
  const gStats = (g) => {
    const tbs = groups[g] || [];
    const fields = tbs.reduce((n, x) => n + (x.field_count || 0), 0);
    const mapped = tbs.reduce((n, x) => n + (x.mapped || 0), 0);
    const tbsMapped = tbs.filter((x) => (x.mapped || 0) > 0).length;
    return { tbs: tbs.length, tbsMapped, fields,
      pct: fields ? Math.round((mapped / fields) * 100) : 0 };
  };

  const crumbA = { color: "#31bced", cursor: "pointer" };
  const goto = (level, patch) => setNav((n) => ({ ...n, level, ...(patch || {}) }));
  const crumb = (
    <div style={{ fontSize: 12.5, color: "#7b8894", marginBottom: 18 }}>
      <span style={nav.level === 0 ? {} : crumbA}
        onClick={() => goto(0)}><b style={{ color: nav.level === 0 ? "#233240" : "#31bced",
        fontWeight: 500 }}>{ds}</b></span>
      {nav.level >= 1 && (
        <span><span style={{ margin: "0 7px", color: "#c2ccd4" }}>›</span>
          <span style={nav.level === 1 ? { color: "#233240" } : crumbA}
            onClick={() => goto(1)}>{nav.group}</span></span>)}
      {nav.level >= 2 && (
        <span><span style={{ margin: "0 7px", color: "#c2ccd4" }}>›</span>
          <span style={nav.level === 2 ? { color: "#233240" } : crumbA}
            onClick={() => goto(2)}>{nav.table}</span></span>)}
      {nav.level === 3 && (
        <span><span style={{ margin: "0 7px", color: "#c2ccd4" }}>›</span>
          <span style={{ color: "#233240" }}>{nav.col}</span></span>)}
    </div>);

  const H1 = ({ children }) => (
    <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
      margin: "0 0 4px" }}>{children}</h1>);
  const Sub = ({ children }) => (
    <div style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
      marginBottom: 22 }}>{children}</div>);

  /* ---------- level 0 · estate ---------- */
  if (nav.level === 0) {
    const names = Object.keys(groups);
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>{crumb}
        <H1>Where {ds} data comes from</H1>
        <Sub>one journey, every field — click an area to zoom in</Sub>
        <Spine ds={ds} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)",
          gap: 16 }}>
          {names.map((g) => {
            const s = gStats(g);
            return (
              <div key={g} onClick={() => goto(1, { group: g })}
                style={{ background: "#fff", border: "1px solid #c9d4dc",
                  borderRadius: 10, padding: 17, cursor: "pointer", display: "flex",
                  gap: 15, alignItems: "center" }}>
                <Ring pct={s.pct} />
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 500,
                    margin: "0 0 2px" }}>{g}</h3>
                  <small style={{ fontSize: 11, color: "#7b8894" }}>
                    {s.tbsMapped} of {s.tbs} tables mapped · {s.fields} fields
                    {s.pct === 0 ? " · not started" : ""}</small>
                </div>
              </div>);
          })}
        </div>
      </div>);
  }

  /* ---------- level 1 · group ---------- */
  if (nav.level === 1) {
    const tbs = groups[nav.group] || [];
    const tm = tbs.filter((x) => (x.mapped || 0) > 0).length;
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>{crumb}
        <H1>{nav.group}</H1>
        <Sub>{tm} of {tbs.length} tables mapped · one row per table — click a table</Sub>
        {tbs.map((tb) => {
          const pct = tb.field_count
            ? Math.round(((tb.mapped || 0) / tb.field_count) * 100) : 0;
          const src = (tb.mapped || 0) > 0;
          return (
            <div key={tb.table_name}
              onClick={src ? () => { ensureFields(tb.table_name);
                goto(2, { table: tb.table_name }); } : undefined}
              style={{ display: "flex", alignItems: "center", background: "#fff",
                border: "1px solid #c9d4dc", borderRadius: 10, padding: "13px 18px",
                marginBottom: 11, cursor: src ? "pointer" : "default",
                opacity: src ? 1 : 0.7 }}>
              <Circ i={0} dashed={!src} />
              <span style={{ width: 46, height: 2, background: "#c9d4dc" }} />
              <Circ i={2} />
              <span style={{ width: 46, height: 2, background: "#c9d4dc" }} />
              <Circ i={3} />
              <div style={{ marginLeft: 16, flex: 1 }}>
                <b style={{ fontSize: 14, fontWeight: 500,
                  fontFamily: "Roboto Mono, monospace" }}>{tb.table_name}</b>
                <small style={{ display: "block", fontSize: 11, color: "#7b8894",
                  marginTop: 1 }}>
                  {(tb.table_type || "table").toLowerCase()} · {tb.field_count} fields
                  {tb.ud_count ? ` · ${tb.ud_count} UD` : ""}
                  {src ? "" : " · source not yet mapped"}</small>
              </div>
              <div style={{ width: 140, height: 7, borderRadius: 5,
                background: "#edf1f4", overflow: "hidden" }}>
                <i style={{ display: "block", height: 7, width: `${pct}%`,
                  background: "#159943" }} /></div>
              <div style={{ width: 64, textAlign: "right", fontSize: 13,
                fontWeight: 500, color: pct === 0 ? "#c1113a" : "#233240" }}>
                {pct}%</div>
            </div>);
        })}
      </div>);
  }

  /* ---------- level 2 · table (four-dot census) ---------- */
  if (nav.level === 2) {
    const rows = fieldsBy[nav.table];
    if (rows == null)
      return (
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>{crumb}
          <div style={{ padding: 30, fontSize: 12, color: "#7b8894",
            textAlign: "center" }}>Loading fields…</div></div>);
    const counts = { pass: 0, xf: 0, ud: 0, gap: 0 };
    const vcounts = { clean: 0, changed: 0, none: 0 };
    rows.forEach((f) => {
      counts[fieldKind(f)] += 1;
      const v = String(f.variance_status || f.variance || "").toLowerCase();
      if (v === "clean") vcounts.clean += 1;
      else if (v === "changed") vcounts.changed += 1;
      else vcounts.none += 1;
    });
    const shown = rows.filter((f) => pills[fieldKind(f)] &&
      (f.dwh_target_column || "").toLowerCase().includes(flt.toLowerCase()));
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>{crumb}
        <H1>{nav.table}</H1>
        <Sub>every field’s journey in four dots — the whole story at a glance</Sub>
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          marginBottom: 14, flexWrap: "wrap" }}>
          <input value={flt} onChange={(e) => setFlt(e.target.value)}
            placeholder={`type to filter ${rows.length} fields…`}
            style={{ flex: 1, maxWidth: 320, height: 32, border: "1px solid #c9d4dc",
              borderRadius: 7, padding: "0 12px", fontSize: 12.5 }} />
          {Object.keys(KIND_META).map((k) => (
            <span key={k}
              onClick={() => setPills((p) => ({ ...p, [k]: !p[k] }))}
              style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999,
                padding: "4px 12px", cursor: "pointer", userSelect: "none",
                background: KIND_META[k].bg, color: KIND_META[k].fg,
                border: `1.5px solid ${pills[k] ? "#233240" : "transparent"}` }}>
              {KIND_META[k].label} · {counts[k]}</span>))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          marginBottom: 14, fontSize: 11, color: "#7b8894" }}>
          <b style={{ fontSize: 10, textTransform: "uppercase",
            letterSpacing: ".05em" }}>Proof variance · Variance 360</b>
          <span style={{ fontWeight: 700, borderRadius: 999, padding: "3px 11px",
            background: "#e7f6ec", color: "#0d6b31" }}>
            ✓ {vcounts.clean} verified clean</span>
          <span style={{ fontWeight: 700, borderRadius: 999, padding: "3px 11px",
            background: "#fdf1e3", color: "#a8560f" }}>
            ⚠ {vcounts.changed} value changes flagged</span>
          <span style={{ fontWeight: 700, borderRadius: 999, padding: "3px 11px",
            background: "#edf1f4", color: "#666" }}>
            ◌ {vcounts.none} no sample yet</span>
        </div>
        {shown.map((f) => {
          const kind = fieldKind(f);
          const xfName = friendly(f.stg1_to_stg2_transform) ||
            friendly(f.src_to_stg1_transform) ||
            friendly(f.stg2_to_dwh_transform);
          const label = kind === "xf" ? (xfName || "changed")
            : kind === "ud" ? (f.ud_key ? `key ${f.ud_key}` : "UD envelope")
            : KIND_META[kind].label;
          return (
            <div key={f.lineage_id || f.dwh_target_column + (f.ud_key || "")}
              onClick={() => goto(3, { col: f.dwh_target_column, field: f })}
              style={{ display: "flex", alignItems: "center", gap: 14,
                background: "#fff", border: "1px solid #c9d4dc", borderRadius: 8,
                padding: "10px 16px", marginBottom: 8, cursor: "pointer" }}>
              <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 12.5,
                flex: 1 }}>{f.is_ud === "Y" ? "↳ " : ""}{f.dwh_target_column}</span>
              <Dots f={f} />
              {(() => {
                const v = String(f.variance_status || f.variance || "")
                  .toLowerCase();
                const c = v === "clean" ? "#159943"
                  : v === "changed" ? "#e67e22" : "#c2ccd4";
                const tt = v === "clean" ? "proof verified clean"
                  : v === "changed"
                    ? (f.variance_detail || "value changes flagged")
                    : "no sample captured";
                return <span title={tt} style={{ width: 9, height: 9,
                  borderRadius: "50%", background: c, flexShrink: 0 }} />;
              })()}
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999,
                padding: "2px 10px", minWidth: 96, textAlign: "center",
                background: KIND_META[kind].bg, color: KIND_META[kind].fg }}>
                {label}</span>
            </div>);
        })}
        <div style={{ textAlign: "center", fontSize: 11, color: "#7b8894",
          marginTop: 12 }}>{shown.length} of {rows.length} shown</div>
      </div>);
  }

  /* ---------- level 3 · column ---------- */
  const rows = fieldsBy[nav.table] || [];
  const f = nav.field ||
    rows.find((x) => x.dwh_target_column === nav.col) || null;
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>{crumb}
      {f ? <ColumnPage t={t} f={f} tbl={nav.table} ds={ds} system={system}
        rows={rows}
        onWalk={(nf) => goto(3, { col: nf.dwh_target_column, field: nf })}
        onTechnical={onTechnical} onDataSource={onDataSource} />
        : <Sub>field not found</Sub>}
    </div>);
}

/* ---------------- level 3 renderer ---------------- */

function ColumnPage({ t, f, tbl, ds, system, rows, onWalk, onTechnical,
  onDataSource }) {
  const [def, setDef] = useState(undefined);   // undefined=loading, null=none
  const [proof, setProof] = useState(null);
  const kind = fieldKind(f);

  useEffect(() => {
    let dead = false;
    setDef(undefined); setProof(null);
    if (f.src_source_column)
      api.legacyBusinessDef(f.src_source_column, system,
        { srcTable: f.src_source_table || f.stg1_source_table, dwhTable: tbl })
        .then((d) => !dead && setDef(d.definition || null))
        .catch(() => !dead && setDef(null));
    else setDef(null);
    api.legacyLineageProof(tbl, f.dwh_target_column)
      .then((p) => !dead && setProof((p && p.stages) || []))
      .catch(() => !dead && setProof([]));
    return () => { dead = true; };
  }, [f, tbl, system]);

  const idx = rows.indexOf(f);
  const nav2 = (
    <div style={{ display: "flex", justifyContent: "center", gap: 16,
      marginTop: 16, fontSize: 11.5 }}>
      {idx > 0 && (
        <span onClick={() => onWalk(rows[idx - 1])}
          style={{ color: "#31bced", cursor: "pointer" }}>
          ← {rows[idx - 1].dwh_target_column}</span>)}
      {idx >= 0 && idx < rows.length - 1 && (
        <span onClick={() => onWalk(rows[idx + 1])}
          style={{ color: "#31bced", cursor: "pointer" }}>
          {rows[idx + 1].dwh_target_column} →</span>)}
    </div>);
  const title = (def && (def.business_term || def.asset_name)) ||
    f.dwh_target_column;

  /* gap page */
  if (kind === "gap") {
    return (
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
          margin: "0 0 4px" }}>{f.dwh_target_column}</h1>
        <div style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
          marginBottom: 22 }}>the honest picture — a gap is still a picture</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 0,
          alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column",
            alignItems: "center", gap: 7, minWidth: 170 }}>
            <Circ i={0} big dashed />
            <b style={{ fontSize: 13, fontWeight: 500 }}>No source</b>
            <small style={{ fontSize: 10.5, color: "#7b8894" }}>
              nothing feeds this</small></div>
          <div style={{ width: 150, height: 2.5, marginTop: 26,
            background: "repeating-linear-gradient(90deg,#c9d4dc 0 5px,transparent 5px 10px)" }} />
          <div style={{ display: "flex", flexDirection: "column",
            alignItems: "center", gap: 7, minWidth: 170 }}>
            <Circ i={3} big />
            <b style={{ fontSize: 13, fontWeight: 500 }}>Warehouse</b>
            <small style={{ fontSize: 10.5, color: "#7b8894" }}>{tbl}</small>
            <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
              background: "#f4f7f9", border: "1px solid #c9d4dc", borderRadius: 6,
              padding: "6px 9px" }}>exists · no legacy feed</div></div>
        </div>
        <div style={{ maxWidth: 660, margin: "0 auto", background: "#fff",
          border: "1px solid #c9d4dc", borderRadius: 10, padding: "16px 22px",
          textAlign: "center" }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3c4a57" }}>
            This warehouse column has no mapped legacy source — it exists in
            {" "}{tbl} but nothing feeds it from {system}. {f.lineage_status_detail
              || "It may be generated, surrogate, or an unmapped feed; the census keeps it visible instead of hiding it."}</p>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center",
            marginTop: 14, background: "#fdf1e3", color: "#8a5a1e", fontSize: 12,
            fontWeight: 500, borderRadius: 999, padding: "6px 16px" }}>
            ◌ nothing to verify — no source mapped</div>
        </div>{nav2}
      </div>);
  }

  /* proof values in stage order */
  const stageOrder = ["SRC", "STG1", "STG2", "DWH"];
  const pmap = {};
  (proof || (f.proof || [])).forEach((p) => { pmap[p.stage] = p.field_value; });
  const vals = proof === null && !(f.proof || []).length ? null
    : stageOrder.map((s) => pmap[s]);
  const dwhVal = pmap.DWH;
  let okFrom = null;
  if (vals && dwhVal != null) {
    okFrom = 3;
    for (let i = 2; i >= 0; i -= 1) {
      if (String(vals[i]) === String(dwhVal)) okFrom = i; else break;
    }
  }
  const hopXf = [f.src_to_stg1_transform, f.stg1_to_stg2_transform,
    f.stg2_to_dwh_transform];
  const hopLabels = hopXf.map((x) => friendly(x));

  /* the whole transformation — three hops, actual expressions */
  const physicalized = f.src_source_column && f.stg1_source_column &&
    f.src_source_column !== f.stg1_source_column &&
    canon(f.src_source_column) === canon(f.stg1_source_column);
  const renamed = f.stg1_source_column && f.stg2_source_column &&
    canon(f.stg1_source_column) !== canon(f.stg2_source_column);
  const hops = [
    { st: "AddVantage → Landed",
      ex: has(hopXf[0]) ? String(hopXf[0])
        : `direct move · ${f.src_source_column || "—"} → ${f.stg1_source_column || "—"}`,
      why: physicalized
        ? "Physicalized: the file field becomes a staging column — same field, database-legal name."
        : "Landed in staging 1 exactly as delivered in the nightly file." },
    { st: "Landed → Cleaned",
      ex: has(hopXf[1]) ? String(hopXf[1])
        : `direct move${renamed ? ` · renamed → ${f.stg2_source_column}` : ""}`,
      why: [has(hopXf[1]) ? `Transformation applied: ${friendly(hopXf[1])}.` : null,
        renamed ? "The column takes its business name here." : null]
        .filter(Boolean).join(" ") || "Carried through staging 2 unchanged." },
    { st: "Cleaned → Warehouse",
      ex: has(hopXf[2]) ? String(hopXf[2]) : "direct move",
      why: has(hopXf[2])
        ? `Final shaping on load: ${friendly(hopXf[2])}.`
        : `Loaded into ${tbl} — the warehouse value is the cleaned value.` },
  ];

  const variance = String(f.variance_status || f.variance || "").toLowerCase();
  const seal = variance === "clean"
    ? { bg: "#e7f6ec", fg: "#0d6b31",
        txt: "✓ value verified stage-to-stage · Variance 360" }
    : variance === "changed"
      ? { bg: "#fdf1e3", fg: "#8a5a1e",
          txt: `⚠ value changes flagged — ${f.variance_detail || "under review"}` }
      : { bg: "#edf1f4", fg: "#666",
          txt: "◌ no sample captured for this field yet" };

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
        margin: "0 0 4px" }}>{title}</h1>
      <div style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
        marginBottom: 22 }}>
        {kind === "ud" ? "a user-defined attribute — traced like any native field"
          : "the full journey of one field, with a real value riding along"}</div>
      <Spine ds={ds} vals={vals} okFrom={okFrom} hopLabels={hopLabels} />

      <div style={{ maxWidth: 660, margin: "0 auto", background: "#fff",
        border: "1px solid #c9d4dc", borderRadius: 10, padding: "16px 22px",
        textAlign: "center" }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3c4a57" }}>
          <b>What it is: </b>
          {def === undefined ? "loading definition…"
            : def ? (def.short_desc || def.long_desc || "—")
            : "No dictionary entry — this source column is not an AddVantage field code."}
        </p>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center",
          marginTop: 12, background: seal.bg, color: seal.fg, fontSize: 12,
          fontWeight: 500, borderRadius: 999, padding: "6px 16px" }}>{seal.txt}</div>
      </div>

      {def && (
        <div style={{ maxWidth: 760, margin: "14px auto 0", background: "#fff",
          border: "1px solid #c9d4dc", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ background: "#f4f7f9", borderBottom: "1px solid #c9d4dc",
            padding: "8px 18px", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: ".05em", color: "#7b8894" }}>
            📖 Full dictionary entry · {def.master_name || system} · {def.field_code}</div>
          <div style={{ padding: "14px 20px", fontSize: 13, lineHeight: 1.7,
            color: "#3c4a57", whiteSpace: "pre-line" }}>
            {def.long_desc || def.short_desc || "—"}
            <div style={{ display: "grid", gridTemplateColumns: "170px 1fr",
              gap: "3px 14px", fontSize: 12.5, marginTop: 12 }}>
              {[["Field code", `${def.field_code_norm || ""} (from ${def.field_code})`],
                ["Master", def.master_name],
                ["Group", def.business_function],
                ["Source type", [def.data_type, def.max_length, def.num_precision,
                  def.date_format].filter(Boolean).join(" · ")
                  + (def.is_required === "Y" ? " · Required" : "")
                  + (def.is_unique === "Y" ? " · Unique" : "")],
                ["Warehouse type", `${f.dwh_type || ""}${f.dwh_length
                  ? `(${f.dwh_length})` : ""}`],
                ["PB mapping", def.pb_field_mapping],
              ].filter((a) => a[1]).map((a) => (
                <React.Fragment key={a[0]}>
                  <b style={{ color: "#7b8894", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: ".04em",
                    paddingTop: 2 }}>{a[0]}</b>
                  <span>{a[1]}</span>
                </React.Fragment>))}
            </div>
          </div>
        </div>)}

      <div style={{ maxWidth: 760, margin: "14px auto 0", background: "#fff",
        border: "1px solid #c9d4dc", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "#f4f7f9", borderBottom: "1px solid #c9d4dc",
          padding: "8px 18px", fontSize: 11, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: ".05em", color: "#7b8894" }}>
          ⚙ The whole transformation — every hop, nothing hidden</div>
        {hops.map((h) => (
          <div key={h.st} style={{ display: "flex", gap: 14, padding: "11px 20px",
            borderBottom: "1px solid #eef1f4", alignItems: "flex-start" }}>
            <div style={{ minWidth: 165, fontSize: 11, fontWeight: 700 }}>{h.st}</div>
            <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11,
              background: "#f4f7f9", border: "1px solid #c9d4dc", borderRadius: 5,
              padding: "5px 9px", wordBreak: "break-all" }}>{h.ex}</div>
            <div style={{ fontSize: 11.5, color: "#7b8894", flex: 1,
              lineHeight: 1.5 }}>{h.why}</div>
          </div>))}
      </div>

      {onTechnical && (
        <div onClick={() => onTechnical({ table: tbl,
          column: f.dwh_target_column })}
          style={{ textAlign: "center", marginTop: 14, fontSize: 11.5,
            color: "#31bced", cursor: "pointer" }}>
          open Technical view — full chain, alt sources, all proof stages →</div>)}
      {nav2}
    </div>);
}
