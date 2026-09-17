import React, { useState, useEffect, useMemo } from "react";
import { lineageApi } from "./lineage_api_additions.js";
import LineageGraph from "./LineageGraph.jsx";

// =====================================================================
// SourceLineage — the source-first drill.
//
// Business view and Technical view both enter at the WAREHOUSE and trace
// backward: pick a functional group, a DIM table, a column, then read the
// chain right-to-left. That is how a developer reads lineage. It is not
// how anyone asks the question. The question is "what happens to our
// account file", and it starts at the AddVantage extract.
//
// So this view inverts the entry point and keeps one spine throughout —
// SRC -> STG1 -> STG2 -> WAREHOUSE. What changes as you drill is
// granularity, never the lens:
//
//   L0  masters -> the extract files that carry them
//   L1  one file end to end: staging, every warehouse table it reaches
//   L2  its fields, collapsed into families (BI/2-1..5 is ONE field)
//   L3  one field: where it lands, and the column graph
//
// Audience is handled by language, not by a separate screen: the
// Business/Technical switch in LineageHome sets `tech`, which swaps
// vocabulary and density in place. Nobody has to pick a mode to find
// their own view.
//
// Props:
//   t           bbhTheme
//   system      legacy system (ADDVANTAGE)
//   dataSource  PBDW / IMDS — scopes every fetch
//   tech        false = business language, true = codes and types
//   onOpenTechnical({table, column})  hand a column to the Technical view
//                                    (LineageHome's openTechnical takes ONE
//                                     object, not two positional args)
// =====================================================================

const STAGE_C = { SRC: "#7c3aed", STG1: "#00a3a3", STG2: "#0091bf", DWH: "#0f4775" };

// The old L0 bucketed by master and gave each bucket an identity colour. L0
// is ringed cards in the Business grammar now, so the eight-colour palette
// and its hash went with it; the one place that still wanted a colour is a
// pipeline marker, and takes the warehouse stage colour instead.
// The organising principle at L2: what HAPPENS to a field, not where it sits.
// A business reader learns the pipeline by reading which bucket is biggest.
const CLS = {
  pass:     { t: "Pass-through", c: "#7b8894", d: "Arrives and lands unchanged." },
  phys:     { t: "Physicalised", c: "#6d3ac0", d: "Same field, column-safe name." },
  ren:      { t: "Renamed",      c: "#a8560f", d: "Given a business name on the way." },
  trim:     { t: "Trimmed",      c: "#00a3a3", d: "Padding removed at STG1→STG2." },
  unmapped: { t: "Unmapped",     c: "#c1113a", d: "No warehouse target agreed yet." },
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// ---------------------------------------------------------------------
// The Business view's grammar, copied rather than approximated, so the two
// doors of the same page do not read as two products. Values are taken from
// BizLineage.jsx verbatim — the 54px emoji circles, the 56px conic-gradient
// ring, the 3-column card grid, the 19/13.5/12.5/11 type scale, and the
// palette it hardcodes (#7b8894 text, #c9d4dc rule). If BizLineage's
// grammar changes, these move with it.
// ---------------------------------------------------------------------
const STG_META = [
  ["🏦", "AddVantage", "nightly file", "#7c3aed"],
  ["📥", "Landed", "staging 1", "#00a3a3"],
  ["🧼", "Cleaned", "staging 2", "#0091bf"],
  ["🏪", "Warehouse", "", "#0f4775"],
];

function Circ({ i, big }) {
  const m = STG_META[i];
  return (
    <div style={{ width: big ? 54 : 32, height: big ? 54 : 32, borderRadius: "50%",
      background: "#fff", display: "grid", placeItems: "center",
      fontSize: big ? 22 : 13, flexShrink: 0,
      border: `2.5px solid ${m[3]}`,
      boxShadow: "0 2px 6px rgba(20,40,60,.08)" }}>{m[0]}</div>);
}

function Spine({ ds }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start",
      justifyContent: "center", margin: "6px 0 26px" }}>
      {STG_META.map((m, i) => (
        <React.Fragment key={m[1]}>
          {i > 0 && (
            <div style={{ flex: 1, maxWidth: 150, height: 2.5, background: "#c9d4dc",
              marginTop: 26, position: "relative" }}>
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
          </div>
        </React.Fragment>))}
    </div>);
}

function Ring({ pct: p }) {
  const col = p === 0 ? "#c2ccd4" : p < 60 ? "#e67e22" : "#159943";
  return (
    <div style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
      background: `conic-gradient(${col} 0 ${p}%, #edf1f4 ${p}% 100%)`,
      display: "grid", placeItems: "center" }}>
      <span style={{ background: "#fff", width: 42, height: 42, borderRadius: "50%",
        display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700 }}>
        {p}%</span>
    </div>);
}

const H1 = ({ children }) => (
  <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
    margin: "0 0 4px" }}>{children}</h1>);
const Sub = ({ children }) => (
  <div style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
    marginBottom: 22 }}>{children}</div>);

export default function SourceLineage({ t, system = "ADDVANTAGE",
                                        dataSource = "PBDW", tech = false,
                                        onOpenTechnical }) {
  const ds = (dataSource || "PBDW").toUpperCase();

  const [level, setLevel] = useState(0);
  const [file, setFile] = useState(null);       // src_source_table
  const [target, setTarget] = useState(null);   // filter L2 to one DWH table
  const [famKey, setFamKey] = useState(null);   // family + member at L3
  const [member, setMember] = useState(null);

  const [srcs, setSrcs] = useState(null);
  const [flow, setFlow] = useState(null);
  const [fields, setFields] = useState(null);
  const [bucket, setBucket] = useState(null);
  // L0 is now two steps: the functional groups, then the files inside one.
  // 137 files in a flat list is a scroll; 15 cards is a screen.
  const [group, setGroup] = useState(null);
  const [q, setQ] = useState("");

  // ---- fetches, one per level -------------------------------------------
  useEffect(() => {
    let dead = false;
    setSrcs(null); setLevel(0); setFile(null); setTarget(null);
    setGroup(null); setQ("");
    lineageApi.lineageSources(ds).then((d) => { if (!dead) setSrcs(d); });
    return () => { dead = true; };
  }, [ds]);

  useEffect(() => {
    if (!file) { setFlow(null); return; }
    let dead = false;
    setFlow(null);
    lineageApi.lineageSourceFlow(file, ds).then((d) => { if (!dead) setFlow(d); });
    return () => { dead = true; };
  }, [file, ds]);

  useEffect(() => {
    if (!file || level < 2) { return; }
    let dead = false;
    setFields(null);
    lineageApi.lineageSourceFields(file, ds, target, system)
      .then((d) => { if (!dead) setFields(d); });
    return () => { dead = true; };
  }, [file, ds, target, level, system]);

  // ---------------------------------------------------------------- chrome
  // Source sits beside Business as the other pictorial door, so it takes
  // Business's palette rather than the theme tokens Technical uses. These
  // were t.panel/t.panel2/t.sub/t.textMuted/t.navy/t.accent, which resolve
  // to a different grey (#dfe6e9 vs #c9d4dc), a different ink (#10193b vs
  // #233240) and a different link (#0f4775 vs #31bced) — close enough to
  // look like a mistake rather than a choice. Changed here so every card,
  // rule and label downstream follows without being touched individually.
  const panel = "#fff", line = "#c9d4dc";
  const sub = "#7b8894", muted = "#7b8894";
  const navy = "#233240", accent = "#31bced";
  // The status colours Business uses, named rather than repeated inline. The
  // "t.danger || #c1113a" form that stood here read as themed while always
  // falling through to the literal, which is how the two pages drifted.
  const danger = "#c1113a", warning = "#e67e22", success = "#159943";
  const tint = "#cae3ee";
  const mono = "Roboto Mono, monospace";

  const card = { background: panel, border: `1px solid ${line}`, borderRadius: 10,
                 overflow: "hidden", marginBottom: 14 };
  const h2 = { fontSize: 10.5, fontWeight: 800, textTransform: "uppercase",
               letterSpacing: 0.5, color: muted, margin: "18px 0 9px" };
  const rowCss = { display: "grid", alignItems: "center", gap: 14, width: "100%",
                   padding: "11px 15px", borderTop: `1px solid ${line}`,
                   background: "none", cursor: "pointer", textAlign: "left",
                   fontFamily: "inherit", font: "inherit", color: "inherit" };

  const meter = (m, f) => {
    const p = pct(m, f);
    const c = p < 75 ? danger
            : p < 85 ? warning : success;
    return (
      <span>
        <span style={{ display: "block", height: 6, background: "#edf1f4",
                       borderRadius: 999, overflow: "hidden" }}>
          <i style={{ display: "block", height: "100%", width: `${p}%`,
                      background: c, borderRadius: 999 }} />
        </span>
        <span style={{ fontSize: 10.5, color: muted, fontFamily: mono }}>
          {p}% mapped
        </span>
      </span>);
  };

  const gapCell = (n) => (
    <span style={{ textAlign: "right", fontFamily: mono, fontSize: 13,
                   fontWeight: 700, color: n ? danger : muted }}>
      {n}
      <span style={{ display: "block", fontFamily: "inherit", fontSize: 10.5,
                     fontWeight: 400, color: muted }}>to map</span>
    </span>);

  // ---- breadcrumb: the lineage path, not a UI path -----------------------
  // Business's trail — plain text, "›" separators, current step in ink and
  // the rest as links. It used to be monospace pills on tinted chips, which
  // is a different component doing the same job two clicks away.
  const crumbA = { color: "#31bced", cursor: "pointer" };
  const crumb = () => {
    const step = (label, onClick, current) => (
      <span key={label}>
        <span style={{ margin: "0 7px", color: "#c2ccd4" }}>›</span>
        {current ? <span style={{ color: "#233240" }}>{label}</span>
                 : <span style={crumbA} onClick={onClick}>{label}</span>}
      </span>);
    const atRoot = level === 0 && !group;
    return (
      <div style={{ fontSize: 12.5, color: "#7b8894", marginBottom: 18 }}>
        {atRoot
          ? <b style={{ color: "#233240", fontWeight: 500 }}>{ds}</b>
          : <span style={crumbA}
              onClick={() => { setLevel(0); setFile(null); setTarget(null);
                               setGroup(null); setQ(""); }}>
              <b style={{ color: "#31bced", fontWeight: 500 }}>{ds}</b></span>}
        {group && step(group,
          () => { setLevel(0); setFile(null); setTarget(null); setQ(""); },
          level === 0 && !file)}
        {file && step(file,
          () => { setLevel(1); setTarget(null); }, level === 1)}
        {level >= 2 && step(target || "All fields",
          () => { setLevel(2); }, level === 2)}
        {level >= 3 && member && step(
          tech ? member.code_norm : (member.business_term || member.code_norm),
          () => {}, true)}
      </div>);
  };

  // ---- the spine, always visible ----------------------------------------
  const spine = () => {
    const st = (flow && flow.stages) || {};
    const steps = [
      ["SRC",  "Source file", file || `${(srcs && srcs.totals.files) || "—"} files`,
       file ? (flow ? `${st.field_count || 0} fields` : "…") : "AddVantage"],
      ["STG1", "Landing", st.stg1_source_table || "STG1_*",
       file ? `${st.stg1_count || 0} table${st.stg1_count === 1 ? "" : "s"}` : "raw"],
      ["STG2", "Conformed", st.stg2_source_table || "STG2_*",
       file ? `${st.reach_stg2 || 0} fields reach` : "business names"],
      ["DWH",  `Warehouse · ${ds}`, target || (flow ? `${flow.target_count} tables` : ds),
       file && flow ? `${st.mapped || 0} mapped` : "157 tables"],
    ];
    return (
      <div style={{ display: "flex", overflowX: "auto", marginBottom: 14,
                    border: `1px solid ${line}`, borderRadius: 8, background: panel }}>
        {steps.map(([k, label, val, note], i) => (
          <div key={k} style={{ flex: 1, minWidth: 150, padding: "10px 12px",
                                position: "relative",
                                borderLeft: i ? `1px solid ${line}` : "none",
                                opacity: file || k === "SRC" ? 1 : 0.5 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                          textTransform: "uppercase", color: STAGE_C[k] }}>{label}</div>
            <div title={val} style={{ fontFamily: mono, fontSize: 12, color: navy,
                                      marginTop: 2, overflow: "hidden",
                                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {val}</div>
            <div style={{ fontSize: 10, color: muted }}>{note}</div>
          </div>))}
      </div>);
  };

  // ================================================================== L0
  // Two steps, in the Business view's grammar: the functional groups as a
  // grid of ringed cards — 15 of them, one screen, no scrolling — then the
  // files inside the one you pick. The old screen listed all 137 files under
  // their group headings, which is the scroll this replaces.
  const renderSources = () => {
    if (!srcs) return <div style={{ padding: 20, color: muted }}>Loading sources…</div>;
    const buckets = srcs.groups || srcs.masters || [];
    if (!buckets.length)
      return <div style={{ padding: 20, color: muted }}>
        No source files in {ds} — check ingestion for this warehouse.</div>;
    const T = srcs.totals || {};

    // ---- L0a · the groups ------------------------------------------------
    if (!group) {
      const R = srcs.resolution || {};
      const ran = (R.resolvers || []).filter((x) => x.ran);
      const nothingResolved = ran.length > 0 && !R.files_resolved;
      return (
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <H1>Where {ds} data comes from</H1>
          <Sub>{T.files} extract files · {T.field_count} fields ·
            {" "}{T.mapped} mapped — click an area to zoom in</Sub>
          <Spine ds={ds} />

          {nothingResolved && (
            <div style={{ border: "1px solid #e67e22", borderRadius: 10,
                          padding: "13px 16px", marginBottom: 16 }}>
              <b style={{ fontSize: 13 }}>No grouping in the data yet</b>
              <p style={{ fontSize: 12, color: "#7b8894", margin: "6px 0 9px",
                          maxWidth: "76ch" }}>
                Every column that could say which business area an extract file
                belongs to came back empty, so the files below are one flat
                list. This is a load question, not a screen bug.</p>
              {ran.map((x) => (
                <div key={x.source} style={{ display: "flex", gap: 10,
                          alignItems: "baseline", padding: "3px 0",
                          borderTop: "1px solid #edf1f4" }}>
                  <span style={{ fontFamily: mono, fontSize: 11.5, minWidth: 210 }}>
                    {x.origin}</span>
                  <span style={{ fontSize: 11, color: "#7b8894" }}>
                    {x.files_covered} of {R.files_requested} files</span>
                </div>))}
            </div>)}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)",
                        gap: 16 }}>
            {buckets.map((b) => {
              const p = pct(b.mapped, b.field_count);
              return (
                <div key={b.key || b.master}
                  onClick={() => { setGroup(b.key || b.master); setQ(""); }}
                  style={{ background: "#fff", border: "1px solid #c9d4dc",
                    borderRadius: 10, padding: 17, cursor: "pointer",
                    display: "flex", gap: 15, alignItems: "center" }}>
                  <Ring pct={p} />
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 500,
                      margin: "0 0 2px" }}>{b.label || b.master}</h3>
                    <small style={{ fontSize: 11, color: "#7b8894" }}>
                      {b.files.length} file{b.files.length === 1 ? "" : "s"} ·
                      {" "}{b.field_count} fields
                      {p === 0 ? " · not started" : ""}</small>
                  </div>
                </div>);
            })}
          </div>
        </div>);
    }

    // ---- L0b · the files in one group ------------------------------------
    const b = buckets.find((x) => (x.key || x.master) === group) || { files: [] };
    const files = q
      ? b.files.filter((f) => (f.src_source_table || "")
          .toLowerCase().includes(q.toLowerCase()))
      : b.files;
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <H1>{b.label || b.master}</H1>
        <Sub>{b.files.length} extract file{b.files.length === 1 ? "" : "s"} ·
          {" "}{b.field_count} fields · {pct(b.mapped, b.field_count)}% mapped —
          click a file to follow it through</Sub>
        {b.files.length > 12 && (
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter files…"
            style={{ display: "block", margin: "0 auto 14px", width: 280, height: 30,
              border: "1px solid #c9d4dc", borderRadius: 4, padding: "0 10px",
              fontSize: 12, fontFamily: "inherit" }} />)}
        <div style={{ border: "1px solid #c9d4dc", borderRadius: 10,
                      overflow: "hidden", background: "#fff" }}>
          {files.map((f, i) => (
            <div key={f.src_source_table}
              onClick={() => { setFile(f.src_source_table); setLevel(1);
                               setTarget(null); setBucket(null); }}
              style={{ display: "grid", alignItems: "center", gap: 14,
                gridTemplateColumns: "minmax(0,1fr) 88px 120px",
                padding: "11px 16px", cursor: "pointer",
                borderTop: i ? "1px solid #edf1f4" : "none" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontFamily: mono, fontSize: 12.5, display: "block",
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>{f.src_source_table}</span>
                <small style={{ fontSize: 11, color: "#7b8894" }}>
                  lands in {f.target_tables} table{f.target_tables === 1 ? "" : "s"} ·
                  {" "}{f.target_columns} columns</small>
              </span>
              <small style={{ fontSize: 11, color: "#7b8894", textAlign: "right" }}>
                {f.field_count} fields</small>
              {meter(f.mapped, f.field_count)}
            </div>))}
          {!files.length && (
            <div style={{ padding: 18, fontSize: 12, color: "#7b8894",
              textAlign: "center" }}>No file matches “{q}”.</div>)}
        </div>
      </div>);
  };

  // ================================================================== L1
  const renderFlow = () => {
    if (!flow) return <div style={{ padding: 20, color: muted }}>Loading flow…</div>;
    const st = flow.stages || {};
    const unmapped = (st.field_count || 0) - (st.mapped || 0);
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
                     margin: "0 0 4px" }}>
          {tech ? flow.src_table
                : (flow.master || flow.functional_group || flow.src_table)}</h1>
        <p style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
                    margin: "0 auto 22px", maxWidth: "74ch" }}>
          {tech
            ? <>Lands in <span style={{ fontFamily: mono }}>{st.stg1_source_table}</span>,
                conforms to <span style={{ fontFamily: mono }}>{st.stg2_source_table}</span>,
                then {flow.target_count} warehouse table{flow.target_count === 1 ? "" : "s"}.</>
            : <>This extract carries {st.field_count} fields. {st.reach_stg2 || 0}{" "}
                reach the conformed stage and {st.mapped} land in the {ds}
                warehouse, across {flow.target_count} table
                {flow.target_count === 1 ? "" : "s"}; {unmapped} still have no
                agreed target.</>}
        </p>

        {/* The five big-number tiles that stood here said, in a component
            Business has nowhere, exactly what the line above already says in
            words. The one number they added — how many fields reach the
            conformed stage — joins that sentence instead. */}
        <div style={h2}>Where it lands</div>
        <div style={card}>
          {flow.targets.map((tg) => (
            <button key={tg.dwh_target_table + tg.data_source}
              style={{ ...rowCss, gridTemplateColumns: "minmax(0,1fr) 96px 130px 70px" }}
              onClick={() => { setTarget(tg.dwh_target_table); setLevel(2);
                               setBucket(null); }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontFamily: mono, fontSize: 12.5, color: navy,
                               display: "block", overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tg.dwh_target_table}</span>
                <span style={{ fontSize: 10.5, color: muted }}>
                  {tg.functional_group}</span>
              </span>
              <span style={{ fontFamily: mono, fontSize: 11.5, color: sub,
                             textAlign: "right" }}>{tg.column_count} cols</span>
              {meter(tg.mapped, tg.column_count)}
              {gapCell(tg.column_count - tg.mapped)}
            </button>))}
        </div>
        <button onClick={() => { setTarget(null); setLevel(2); setBucket(null); }}
          style={{ border: `1px solid ${line}`, borderRadius: 4, background: panel,
                   padding: "7px 14px", cursor: "pointer", fontSize: 12,
                   fontFamily: "inherit", color: accent }}>
          See all {st.field_count} fields in this file →
        </button>
      </div>);
  };

  // ================================================================== L2
  const renderFields = () => {
    if (!fields) return <div style={{ padding: 20, color: muted }}>Loading fields…</div>;
    const counts = fields.totals.by_class || {};
    const fams = fields.families.filter((f) => {
      if (bucket && f.cls !== bucket) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (f.term || "").toLowerCase().includes(s) ||
             f.family.toLowerCase().includes(s) ||
             f.members.some((m) => (m.code_norm || "").toLowerCase().includes(s) ||
               m.lands.some((l) => l.column.toLowerCase().includes(s)));
    });
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
                     margin: "0 0 4px" }}>
          {target || "All fields"}</h1>
        <p style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
                    margin: "0 auto 22px", maxWidth: "74ch" }}>
          {fields.totals.codes} source fields in {fields.totals.families} famil
          {fields.totals.families === 1 ? "y" : "ies"}
          {target ? <> landing in <span style={{ fontFamily: mono }}>{target}</span></> : null}.
          {" "}{tech ? "Grouped by what happens to them on the way through."
                     : "Related lines are grouped — open one to see its individual columns."}
        </p>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
          {Object.keys(CLS).filter((k) => counts[k]).map((k) => (
            <button key={k} onClick={() => setBucket(bucket === k ? null : k)}
              style={{ border: `1px solid ${bucket === k ? CLS[k].c : line}`,
                       borderLeft: `3px solid ${CLS[k].c}`, borderRadius: 7,
                       background: bucket === k ? tint : panel,
                       padding: "10px 13px", cursor: "pointer", textAlign: "left",
                       minWidth: 150, fontFamily: "inherit" }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: CLS[k].c }}>
                {counts[k]}</div>
              <div style={{ fontSize: 12.5, color: navy }}>{CLS[k].t}</div>
              <div style={{ fontSize: 11, color: sub }}>{CLS[k].d}</div>
            </button>))}
        </div>

        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by term, code (BI/2-1) or column…"
          style={{ width: "100%", maxWidth: 380, height: 30, marginBottom: 12,
                   border: `1px solid ${line}`, borderRadius: 4, padding: "0 10px",
                   fontSize: 12.5, fontFamily: "inherit" }} />

        <div style={card}>
          {fams.map((f) => {
            const multi = f.members.length > 1;
            const c = CLS[f.cls] || CLS.pass;
            return (
              <div key={f.family} style={{ borderTop: `1px solid ${line}` }}>
                <button onClick={() => {
                          if (!multi) { setMember(f.members[0]); setFamKey(f.family);
                                        setLevel(3); return; }
                          setFamKey(famKey === f.family ? null : f.family);
                        }}
                  style={{ ...rowCss, borderTop: "none",
                           gridTemplateColumns: "14px minmax(0,1fr) auto auto" }}>
                  <span style={{ color: muted, fontSize: 10 }}>
                    {multi ? (famKey === f.family ? "▾" : "▶") : ""}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, color: navy, display: "block",
                                   overflow: "hidden", textOverflow: "ellipsis",
                                   whiteSpace: "nowrap" }}>
                      {tech ? f.family : (f.term || f.family)}
                      {multi && <span style={{ color: muted }}> · {f.members.length} lines</span>}
                    </span>
                    <span style={{ fontSize: 10.5, color: muted, fontFamily: mono }}>
                      {f.family}{f.lands ? ` · ${f.lands} landing${f.lands === 1 ? "" : "s"}`
                                         : " · no target"}</span>
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px",
                                 borderRadius: 999, whiteSpace: "nowrap",
                                 border: `1px solid ${line}`, color: c.c }}>{c.t}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700,
                                 padding: "2px 7px", borderRadius: 3, color: "#fff",
                                 background: f.unmapped ? danger
                                   : STAGE_C.DWH }}>
                    {f.family}</span>
                </button>
                {multi && famKey === f.family && f.members.map((m) => (
                  <button key={m.code_norm}
                    onClick={() => { setMember(m); setLevel(3); }}
                    style={{ ...rowCss, background: "#f4f7f9",
                             gridTemplateColumns: "14px minmax(0,1fr) auto auto" }}>
                    <span />
                    <span style={{ paddingLeft: 12, minWidth: 0 }}>
                      <span style={{ fontFamily: tech ? mono : "inherit",
                                     fontSize: tech ? 12 : 13, color: navy,
                                     display: "block", overflow: "hidden",
                                     textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tech ? (m.lands[0] ? m.lands[0].column : m.code_norm)
                              : (m.business_term || m.code_norm)}</span>
                      <span style={{ fontSize: 10, color: muted, fontFamily: mono }}>
                        {m.code_norm}{m.lands.length > 1
                          ? ` · lands in ${m.lands.length}` : ""}</span>
                    </span>
                    <span />
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px",
                                   borderRadius: 999,
                                   background: m.cls === "unmapped" ? "#f3d2d7" : "#d0ebd9",
                                   color: m.cls === "unmapped" ? danger
                                                               : success }}>
                      {m.cls === "unmapped" ? "UNMAPPED" : "● VERIFIED"}</span>
                  </button>))}
              </div>);
          })}
          {!fams.length && (
            <div style={{ padding: 18, color: muted, fontSize: 12.5 }}>
              Nothing matches that filter.</div>)}
        </div>
      </div>);
  };

  // ================================================================== L3
  const renderField = () => {
    if (!member) return null;
    const land = member.lands[0];
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 19, fontWeight: 400, textAlign: "center",
                     margin: "0 0 4px" }}>
          {tech ? (land ? land.column : member.code_norm)
                : (member.business_term || member.code_norm)}</h1>
        <p style={{ fontSize: 12.5, color: "#7b8894", textAlign: "center",
                    margin: "0 auto 22px", maxWidth: "74ch" }}>
          {member.short_desc || (tech ? "No dictionary entry for this code."
                                      : "No business definition recorded yet.")}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {[["Code", member.code_norm], ["Group", member.business_function],
            ["Source column", member.src_source_column],
            member.is_pii === "Y" ? ["Governance", "Personal data · NYDFS 500"] : null,
            member.is_required === "Y" ? ["", "Required"] : null,
           ].filter(Boolean).map(([k, v], i) => (
            <span key={i} style={{ fontSize: 11.5, border: `1px solid ${line}`,
                                   borderRadius: 4, padding: "4px 9px",
                                   color: k === "Governance" ? danger : sub }}>
              {k && <b style={{ color: muted, fontWeight: 700, fontSize: 10.5,
                                textTransform: "uppercase", marginRight: 6 }}>{k}</b>}
              <span style={{ fontFamily: k === "Group" ? "inherit" : mono }}>{v}</span>
            </span>))}
        </div>

        <div style={h2}>Where it lands · {ds}</div>
        <div style={card}>
          {member.lands.length ? member.lands.map((l) => (
            <div key={l.table + l.column}
              style={{ ...rowCss, cursor: "default",
                       gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
              <span style={{ fontFamily: mono, fontSize: 12.5, color: navy,
                             overflow: "hidden", textOverflow: "ellipsis",
                             whiteSpace: "nowrap" }}>
                {l.table}.{l.column}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: muted }}>
                {l.type}{l.length ? `(${l.length})` : ""}</span>
              {onOpenTechnical && (
                <button onClick={() => onOpenTechnical({ table: l.table, column: l.column })}
                  style={{ border: "none", background: "none", cursor: "pointer",
                           color: accent, fontSize: 11.5, fontFamily: "inherit" }}>
                  open in Technical →</button>)}
            </div>)) : (
            <div style={{ padding: 16, color: muted, fontSize: 12.5 }}>
              Nothing downstream yet — this field stops in staging.</div>)}
        </div>

        {member.lands.length > 1 && (
          <div style={{ fontSize: 12.5, color: sub, marginBottom: 12 }}>
            This one source field lands in {member.lands.length} places. Change it and
            all {member.lands.length} move together.
          </div>)}

        {land && (
          <LineageGraph t={t} dataSource={ds} table={land.table} column={land.column}
            onOpenColumn={onOpenTechnical
              ? (tb, col) => onOpenTechnical({ table: tb, column: col })
              : undefined} />)}
      </div>);
  };

  return (
    <div>
      {crumb()}
      {/* L0 draws the Business view's Spine inside renderSources — the data
          strip below only has values once a file is chosen, and showing it
          empty above the group cards was 90px of dimmed placeholder. */}
      {level > 0 && spine()}
      {level === 0 && renderSources()}
      {level === 1 && renderFlow()}
      {level === 2 && renderFields()}
      {level === 3 && renderField()}
    </div>);
}
