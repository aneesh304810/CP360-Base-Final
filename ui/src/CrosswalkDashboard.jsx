import React, { useState, useEffect, useMemo, useCallback } from "react";
import { columnsXlsxUrl, crosswalkApi, VERDICT, VERDICT_ORDER, LANE_C, mappingDocs, CANDIDATE_VOCAB } from "./seiCrosswalkApi.js";
import { GLOSSARY_SECTIONS, VERDICT_INFO, SHAPE_INFO, verdictShort }
  from "./crosswalkGlossary.js";
import { FlowDiagram, EvidencePanel, Waffle, TransformationPanel, LogicCompare }
  from "./CrosswalkFlow.jsx";
import { useFeedNames, feedName } from "./feedNames.js";
import ChainRules from "./ChainRules.jsx";
import SeiBusinessSummary from "./SeiBusinessSummary.jsx";
import StarFieldUsage from "./StarFieldUsage.jsx";
import MappingDocsPanel from "./MappingDocs.jsx";

// =====================================================================
// CrosswalkDashboard — mapping, analysis and divergence for one warehouse.
//
// WHERE IT MOUNTS. LineageHome renders a placeholder when scope === "sei"
// ("SEI lineage — arriving with the SWP program"). That reserved, empty slot
// is this. Nothing else in LineageHome changes.
//
// WHY IT SELF-HIDES. summary() falls back to zeros when a warehouse has no
// crosswalk loaded, and this component renders its own empty state in that
// case. PBDW therefore looks exactly as it does today until a PBDW crosswalk
// is ingested — no flag, no per-warehouse branch, just the data deciding.
//
// FOUR LEVELS, one at a time:
//   overview   KPIs, the flow, the evidence bars, the six divergence shapes
//   list       every column behind whatever was clicked, filtered
//   column     one final column: chain, contract, SEI datapoints, findings
//   readiness  per-table gate
//
// The drill is a stack, so Back always returns to where the click came from
// rather than to a fixed home.
// =====================================================================

const F = "Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const g = (o, ...k) => k.reduce((a, x) => (a != null ? a : o?.[x] ?? o?.[x?.toUpperCase?.()] ?? o?.[x?.toLowerCase?.()]), null);

function Pill({ v, onWhat }) {
  const d = VERDICT[v] || VERDICT.UNKNOWN;
  // Every pill says what it means on hover. A tag nobody can decode is a tag
  // that gets ignored, and NO_SOURCE in particular reads as a minor note
  // rather than as the column arriving empty on cutover day.
  return (
    <span title={verdictShort(v)}
      onClick={onWhat ? (e) => { e.stopPropagation(); onWhat(v); } : undefined}
      style={{ display: "inline-block", fontSize: 9, fontWeight: 700,
      letterSpacing: 0.4, padding: "2px 8px", borderRadius: 999,
      background: d.bg, color: d.c, whiteSpace: "nowrap",
      cursor: onWhat ? "help" : "default" }}>{d.t}</span>);
}

// Renders the glossary's light markdown: **bold** and paragraph breaks. Kept
// to those two because that is all the copy uses.
function Prose({ text, style }) {
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.65, maxWidth: "72ch", ...style }}>
      {String(text || "").split("\n\n").map((para, i) => (
        <p key={i} style={{ margin: i ? "8px 0 0" : 0 }}>
          {para.split(/\*\*(.+?)\*\*/g).map((chunk, j) =>
            j % 2 ? <b key={j}>{chunk}</b> : <span key={j}>{chunk}</span>)}
        </p>))}
    </div>);
}

function LaneTag({ lane }) {
  if (!lane) return null;
  const c = LANE_C[String(lane).toUpperCase()] || "#5f87a7";
  return (
    <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700,
      letterSpacing: 0.4, padding: "2px 7px", borderRadius: 2,
      background: `${c}1a`, color: c, whiteSpace: "nowrap" }}>{lane}</span>);
}

function Stack({ verdicts, h = 8, onPick }) {
  const total = (verdicts || []).reduce((a, v) => a + (v.n || 0), 0) || 1;
  return (
    <span style={{ display: "flex", height: h, borderRadius: 3,
      overflow: "hidden", background: "#e8edf2" }}>
      {(verdicts || []).map((v) => (
        <i key={v.verdict} title={`${VERDICT[v.verdict]?.t || v.verdict} ${v.n}`}
          onClick={onPick ? () => onPick(v.verdict) : undefined}
          style={{ display: "block", width: `${(v.n / total) * 100}%`,
            background: (VERDICT[v.verdict] || VERDICT.UNKNOWN).c,
            cursor: onPick ? "pointer" : "default" }} />))}
    </span>);
}

function Kpi({ t, v, of, sub, c, meter, onClick, title }) {
  return (
    <div onClick={onClick} title={title} style={{ background: t.panel || "#fff",
      border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderTop: `3px solid ${c}`,
      borderRadius: 3, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, color: c,
        fontVariantNumeric: "tabular-nums" }}>
        {v}{of ? <span style={{ fontSize: 12, color: t.muted || "#999",
          fontWeight: 400, marginLeft: 4 }}>{of}</span> : null}
      </div>
      <div style={{ fontSize: 11.5, marginTop: 7, fontWeight: 500 }}>{sub[0]}</div>
      <div style={{ fontSize: 10, color: t.muted || "#999", marginTop: 3,
        lineHeight: 1.4 }}>{sub[1]}</div>
      {meter != null && (
        <div style={{ height: 4, background: "#e8edf2", borderRadius: 2, marginTop: 9 }}>
          <i style={{ display: "block", height: "100%", width: `${meter}%`,
            background: c, borderRadius: 2 }} /></div>)}
    </div>);
}

// The six divergence shapes, drawn. The diagram is the shape of the problem:
// collapse fans out, dual source converges, bypass arcs over a hollow node.
function Shape({ kind, c }) {
  const dot = (x, y, r = 3.5, fill = c) =>
    <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={fill} />;
  const ln = (x1, y1, x2, y2, dash) =>
    <path key={`${x1}${y1}${x2}${y2}`} fill="none" stroke={c} strokeWidth="1.6"
      strokeDasharray={dash ? "3 3" : undefined}
      d={`M ${x1} ${y1} C ${x1 + 11} ${y1}, ${x2 - 11} ${y2}, ${x2} ${y2}`} />;
  const body = {
    collapse: [ln(8, 15, 58, 6), ln(8, 15, 58, 15), ln(8, 15, 58, 24),
               dot(8, 15, 4), dot(58, 6), dot(58, 15), dot(58, 24)],
    dual_source: [ln(8, 7, 58, 15), ln(8, 23, 58, 15),
                  dot(8, 7, 3.5, LANE_C.STAR), dot(8, 23, 3.5, LANE_C.UAF), dot(58, 15, 4)],
    bypass: [<circle key="h" cx="33" cy="15" r="5" fill="none" stroke={c}
               strokeWidth="1.2" strokeDasharray="2 2" />,
             <path key="a" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="3 3"
               d="M 8 15 C 18 2, 48 2, 58 15" />, dot(8, 15), dot(58, 15)],
    decode: [ln(8, 15, 26, 15), ln(40, 15, 58, 15), dot(8, 15), dot(58, 15),
             <text key="t" x="33" y="20" textAnchor="middle" fontSize="14" fill={c}>≠</text>],
    feed_dependency: [ln(8, 7, 58, 15), ln(8, 23, 58, 15, true),
                      dot(8, 7), dot(8, 23), dot(58, 15, 4)],
    no_source: [<path key="s" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="4 3"
                  d="M 8 15 L 42 15" />, dot(8, 15),
                <circle key="o" cx="50" cy="15" r="4" fill="none" stroke={c} strokeWidth="1.4" />],
  }[kind] || [];
  return <svg width="66" height="30" viewBox="0 0 66 30" style={{ flexShrink: 0 }}>{body}</svg>;
}

export default function CrosswalkDashboard({ t, dataSource, onOpenTechnical }) {
  const ds = (dataSource || "IMDS").toUpperCase();
  const [sum, setSum] = useState(null);
  const [div, setDiv] = useState({ shapes: [], collapse: [], dual_source: [] });
  const [lanes, setLanes] = useState([]);
  const [ready, setReady] = useState([]);
  const [exc, setExc] = useState({ exceptions: [], by_owner: [] });
  const [cat, setCat] = useState(null);
  const [flow, setFlow] = useState(null);
  const [ev, setEv] = useState(null);
  const [waf, setWaf] = useState(null);
  const [xf, setXf] = useState(null);
  // The mapping documents' candidate paths, for the ribbon's second
  // vocabulary. Fetched apart from the proposal flow so a warehouse without
  // sql/79 draws the ribbon exactly as before: no candidates, no toggle.
  const [flowCand, setFlowCand] = useState(null);
  const [flowMode, setFlowMode] = useState("proposed");
  // A click on the candidate ribbon scopes the mapping-documents panel below
  // to that node or path: the rows the ribbon is made of, not a hint to
  // find them. The counter makes the same click twice answer twice.
  const [docFocus, setDocFocus] = useState(null);
  const focusDocs = (f) => setDocFocus({ table: f.table || null, feed: f.feed || "",
                                          link: f.verdict || (f.sei_feed === "no SEI source" ? "NO_SEI_SOURCE" : ""),
                                          q: f.sei_feed && f.sei_feed !== "no SEI source" ? f.sei_feed : "", n: Date.now() });
  useEffect(() => {
    let on = true;
    mappingDocs.flowCandidates(ds).then((f) => { if (on) setFlowCand(f); });
    return () => { on = false; };
  }, [ds]);
  const hasCand = !!(flowCand && ((flowCand.left || []).length || (flowCand.bypass || []).length));
  const feedMap = useFeedNames(ds);
  // Stable across renders so the diagram's useMemo does not rebuild its
  // whole layout on every parent render.
  const nameOf = useCallback((code) => feedName(feedMap, code), [feedMap]);
  const [busy, setBusy] = useState(true);
  // Which face of the same data is showing. Business is the landing: the
  // verdict-first overview is still one click away and unchanged.
  const [look, setLook] = useState("biz");

  // the drill stack — [{kind:"list", filter, title}, {kind:"column", ...}]
  const [stack, setStack] = useState([]);
  const [list, setList] = useState(null);
  const [detail, setDetail] = useState(null);
  // How the usage join went for the list currently shown. Reported next to
  // the grid rather than inferred from blanks: "no usage column" and "usage
  // not loaded" look identical in the cells and are different problems.
  const [listUsage, setListUsage] = useState(null);
  const [chain, setChain] = useState(null);
  // Bumped after a review saves, so the chain refetches and the panel
  // shows the decision that was just recorded rather than the one before.
  const [chainNonce, setChainNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setBusy(true);
    Promise.all([
      crosswalkApi.summary(ds), crosswalkApi.divergence(ds),
      crosswalkApi.lanes(ds), crosswalkApi.readiness(ds), crosswalkApi.exceptions(ds),
      crosswalkApi.catalog(ds), crosswalkApi.flow(ds), crosswalkApi.evidence(ds),
      crosswalkApi.waffle(ds), crosswalkApi.transformations(ds),
    ]).then(([s, d, l, r, e, c, f, v, w, x]) => {
      if (!live) return;
      setSum(s); setDiv(d); setLanes(l.lanes || []);
      setReady(r.tables || []); setExc(e); setCat(c);
      setFlow(f); setEv(v); setWaf(w); setXf(x); setBusy(false);
    });
    return () => { live = false; };
  }, [ds]);

  const top = stack[stack.length - 1] || null;

  useEffect(() => {
    if (!top || top.kind !== "list") return;
    let live = true;
    crosswalkApi.columns({ data_source: ds, ...top.filter })
      .then((r) => {
        if (!live) return;
        setList(r.columns || []);
        setListUsage(r.usage || null);
      });
    return () => { live = false; };
  }, [ds, top]);

  useEffect(() => {
    if (!top || top.kind !== "column") return;
    let live = true;
    crosswalkApi.column(top.table, top.column, ds)
      .then((r) => { if (live) setDetail(r); });
    return () => { live = false; };
  }, [ds, top]);

  useEffect(() => {
    if (!top || top.kind !== "column") { setChain(null); return; }
    let live = true;
    crosswalkApi.columnChain(top.table, top.column, ds)
      .then((r) => { if (live) setChain(r); });
    return () => { live = false; };
  }, [ds, top, chainNonce]);

  const push = (s) => setStack((x) => [...x, s]);
  const back = () => setStack((x) => x.slice(0, -1));
  const drill = (filter, title) => { setList(null); push({ kind: "list", filter, title }); };
  const openGlossary = (focus) => push({ kind: "glossary", focus,
    title: "What these tags mean" });
  const openCol = (table, column) => { setDetail(null); push({ kind: "column", table, column }); };

  const card = { background: t.panel || "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                 borderRadius: 8, overflow: "hidden", marginBottom: 16 };
  const head = { display: "flex", alignItems: "baseline", gap: 11, padding: "12px 17px",
                 background: "linear-gradient(to right,#eef3f8,#f7fafc)", flexWrap: "wrap" };
  const h2 = { fontSize: 14.5, fontWeight: 700, margin: 0, color: t.navy || "#10193b" };
  const note = { fontSize: 10.5, color: t.muted || "#999" };
  const body = { padding: "16px 17px" };

  if (busy) return <div style={{ padding: 40, textAlign: "center", color: t.muted || "#999",
    fontFamily: F, fontSize: 13 }}>Loading the crosswalk…</div>;

  // Nothing loaded for this warehouse: say so plainly and stop. This is the
  // branch PBDW takes, and why PBDW's screen is unchanged.
  if (!sum || !sum.total_columns) {
    return (
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={body}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
            No SEI crosswalk loaded for {ds}</div>
          <div style={{ fontSize: 12, color: t.sub || "#666", lineHeight: 1.6, maxWidth: "70ch" }}>
            The lineage screens are unaffected. To populate this view, ingest the
            crosswalk workbook for this warehouse:{" "}
            <code style={{ fontFamily: MONO, fontSize: 11.5 }}>
              CP_SEI_DATA_SOURCE={ds} python -m ingestion.run sei_crosswalk</code>
          </div>
        </div>
      </div>);
  }

  /* --------------------------------------------------- drill: glossary --- */
  // Reached from the "what do these mean?" link beside any tag row, and from
  // clicking a pill. `focus` scrolls the asked-about tag into view and rings
  // it, so arriving from a NO_SOURCE pill lands on NO_SOURCE rather than at
  // the top of a long page.
  if (top && top.kind === "glossary") {
    const focus = top.focus;
    return (
      <div style={{ fontFamily: F }}>
        <Crumbs t={t} stack={stack} onBack={back} onHome={() => setStack([])} />
        <div style={card}>
          <div style={head}>
            <h3 style={h2}>What these tags mean</h3>
            <span style={note}>every vocabulary on these screens, with the
              rule that produces it</span>
          </div>
          <div style={body}>
            <Prose style={{ color: t.sub || "#666", marginBottom: 4 }}
              text={"The verdicts are not a severity scale and not opinions. "
                  + "They are the output of one algorithm applied in a fixed "
                  + "order, first match wins.\n\n"
                  + "**A column is tagged with the rule that stopped it, and "
                  + "nothing below that rule was tested.** A NO_SOURCE column "
                  + "is not a column whose types happen to be fine — its types "
                  + "were never compared, because there was nothing to compare "
                  + "them to."} />
          </div>
        </div>

        {GLOSSARY_SECTIONS.map((sec) => (
          <div key={sec.key} style={card}>
            <div style={head}>
              <h3 style={h2}>{sec.title}</h3>
              <span style={note}>{sec.order.length} values</span>
            </div>
            <div style={body}>
              <Prose style={{ color: t.muted || "#999", marginBottom: 13 }}
                text={sec.intro} />
              {sec.order.map((k, i) => {
                const e = sec.info[k];
                const rich = typeof e === "object" && e !== null;
                const on = focus && String(focus).toUpperCase() === String(k).toUpperCase();
                const c = sec.key === "verdict"
                  ? (VERDICT[k] || VERDICT.UNKNOWN).c
                  : sec.key === "shape" ? "#7c3aed" : (t.accent || "#0f4775");
                return (
                  <div key={k} id={`gl-${k}`} style={{
                    borderTop: i ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none",
                    padding: i ? "13px 0 2px" : "0 0 2px",
                    background: on ? "#fff8e1" : undefined,
                    boxShadow: on ? "0 0 0 8px #fff8e1" : undefined,
                    borderRadius: on ? 2 : undefined }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10,
                      flexWrap: "wrap", marginBottom: 6 }}>
                      {sec.key === "verdict"
                        ? <Pill v={k} />
                        : <span style={{ fontFamily: MONO, fontSize: 10.5,
                            fontWeight: 700, letterSpacing: 0.3, color: c,
                            background: `${c}14`, padding: "2px 8px",
                            borderRadius: 2 }}>{rich ? e.label : k}</span>}
                      {sec.key === "verdict" && (
                        <span style={{ fontFamily: MONO, fontSize: 10,
                          color: t.muted || "#999" }}>{k}</span>)}
                      {sec.key === "shape" && <Shape kind={k} c={c} />}
                    </div>
                    {rich ? (
                      <>
                        <Prose text={e.what || e.short}
                          style={{ color: t.navy || "#10193b" }} />
                        {e.why && <Field t={t} k="Why a row gets it" v={e.why} />}
                        {e.blocks && <Field t={t} k="Blocks cutover" v={e.blocks} />}
                        {e.clears && <Field t={t} k="What clears it" v={e.clears} />}
                        {e.watch && <Field t={t} k="What to watch" v={e.watch} />}
                      </>
                    ) : <Prose text={e} style={{ color: t.navy || "#10193b" }} />}
                  </div>);
              })}
            </div>
          </div>))}
      </div>);
  }

  /* ------------------------------------------------ drill: one column --- */
  if (top && top.kind === "column") {
    const d = detail;
    return (
      <div style={{ fontFamily: F }}>
        <Crumbs t={t} stack={stack} onBack={back} onHome={() => setStack([])} />
        {!d ? <div style={{ padding: 30, color: t.muted || "#999" }}>Loading…</div> : (
          <>
            <div style={card}>
              <div style={head}>
                <h2 style={{ ...h2, fontFamily: MONO, fontSize: 14 }}>
                  {top.table}.{top.column}</h2>
                {(d.verdicts || []).map((v, i) => (
                  <span key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <LaneTag lane={g(v, "lane_id", "LANE_ID")} />
                    <Pill v={g(v, "match_verdict", "MATCH_VERDICT")}
                      onWhat={openGlossary} /></span>))}
              </div>
              <div style={body}>
                {(d.verdicts || []).map((v, i) => {
                  const reason = g(v, "verdict_reason", "VERDICT_REASON");
                  const clear = g(v, "what_would_clear_it", "WHAT_WOULD_CLEAR_IT");
                  const fc = g(v, "failed_checks", "FAILED_CHECKS");
                  const mv = g(v, "match_verdict", "MATCH_VERDICT");
                  const info = VERDICT_INFO[mv];
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      {/* What the verdict MEANS, before what this row's
                          author wrote about it. The reason line assumes you
                          already know; most readers do not, and NO_SOURCE in
                          particular reads as mild when it is the one that
                          nulls the column. */}
                      {info && (
                        <div style={{ borderLeft: `3px solid ${(VERDICT[mv] || VERDICT.UNKNOWN).c}`,
                          background: (VERDICT[mv] || VERDICT.UNKNOWN).bg + "66",
                          padding: "9px 12px", borderRadius: 2, marginBottom: 9 }}>
                          <Prose text={info.what} style={{ color: t.navy || "#10193b" }} />
                          <Field t={t} k="Blocks cutover" v={info.blocks} />
                          <Field t={t} k="What clears it" v={info.clears} />
                          <button type="button" onClick={() => openGlossary(mv)}
                            style={{ marginTop: 7, background: "none", border: "none",
                              padding: 0, font: "inherit", fontSize: 10.5,
                              cursor: "pointer", color: t.accent || "#0f4775",
                              textDecoration: "underline" }}>
                            all tag definitions →</button>
                        </div>)}
                      {reason && <p style={{ margin: "0 0 6px", fontSize: 12,
                        color: t.sub || "#666", lineHeight: 1.6 }}>{reason}</p>}
                      {fc && <div style={{ fontSize: 10.5, color: t.muted || "#999" }}>
                        Failed checks: <span style={{ fontFamily: MONO }}>{fc}</span></div>}
                      {clear && <div style={{ fontSize: 11.5, marginTop: 6 }}>
                        <b>Clears when:</b> {clear}</div>}
                    </div>);
                })}
              </div>
            </div>

            <Panel t={t} title="Lineage chain" note="one row per lane that writes this column">
              {(d.chain || []).map((c, i) => <ChainRow key={i} t={t} row={c} />)}
              {!(d.chain || []).length && <Empty t={t} s="No lineage row found." />}
            </Panel>

            <Panel t={t} title="SEI datapoints proposed"
              note={`${(d.maps || []).length} for this contract field`}>
              {(d.maps || []).length ? (
                <Table t={t} cols={["SEI feed", "Datapoint", "Kind", "Type", "Rule"]}
                  rows={(d.maps || []).map((m) => [
                    g(m, "sei_feed", "SEI_FEED") || "—",
                    <span style={{ fontFamily: MONO }}>{g(m, "sei_datapoint", "SEI_DATAPOINT") || "—"}</span>,
                    g(m, "map_kind", "MAP_KIND"),
                    g(m, "sei_type", "SEI_TYPE") || "UNKNOWN",
                    <span style={{ fontSize: 11, color: t.sub || "#666" }}>
                      {g(m, "map_rule", "MAP_RULE") || "—"}</span>])} />
              ) : <Empty t={t} s="No SEI datapoint proposed — this column has no source after cutover." />}
            </Panel>

            {(d.collapse || []).length > 1 && (
              <Callout t={t} c="#c1113a" title="One SEI datapoint, several contract fields">
                The incumbent kept these apart on the same record. If they ever hold
                different values, collapsing them loses that difference silently — the
                load succeeds and the number is wrong.
                <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontFamily: MONO, fontSize: 11 }}>
                  {(d.collapse || []).map((x, i) => (
                    <li key={i}>{g(x, "sei_datapoint", "SEI_DATAPOINT")} → {g(x, "other_field", "OTHER_FIELD")}</li>))}
                </ul>
              </Callout>)}

            {(d.dual_source || []).length > 0 && (
              <Callout t={t} c="#7c3aed" title="Two lanes write this column, and nothing says which wins">
                Lanes: {g(d.dual_source[0], "lanes", "LANES")}. Precedence rule:{" "}
                <b>{g(d.dual_source[0], "precedence_rule", "PRECEDENCE_RULE") || "UNKNOWN"}</b>.
                There is no error when they disagree — the value depends on load order.
              </Callout>)}

            {/* The chain, with the rule on every hop, and the proposed SEI
                equivalent as a second track under it. Everything above
                this compares what the value LOOKS like; this is whether
                it is the same number, and whether anyone has said so. */}
            {chain ? <ChainRules t={t} chain={chain} dataSource={ds}
                       onSaved={() => setChainNonce((n) => n + 1)} />
                   : <LogicCompare t={t} xf={d.transformation} cmp={d.compare} />}

            {(d.star_layout || []).length > 0 && (
              <div style={{ marginTop: 12, fontSize: 11, color: t.sub || "#666",
                lineHeight: 1.6 }}>
                <b>Published STAR layout</b>{" "}
                {d.star_layout.map((x, i) => (
                  <span key={i} style={{ fontFamily: MONO, fontSize: 10.5 }}>
                    {x.feed_family}.{x.field_name} {x.published_type}
                    {x.published_length ? `(${x.published_length})` : ""}
                    {x.evidence_status ? ` · ${x.evidence_status}` : ""}
                    {i < d.star_layout.length - 1 ? " · " : ""}</span>))}
                <div style={{ fontSize: 10, color: t.muted || "#999" }}>
                  A published layout replaces the inferred contract type this
                  row's verdict was resting on.</div>
              </div>)}

            {(d.disposition || []).length > 0 && (
              <Callout t={t} c="#b45309" title={`Disposition: ${g(d.disposition[0], "disposition", "DISPOSITION")}`}>
                {g(d.disposition[0], "disposition_detail", "DISPOSITION_DETAIL") ||
                 "No disposition recorded. Needs default, derive, drop or block, approved by the data owner."}
              </Callout>)}

            {onOpenTechnical && (
              <button onClick={() => onOpenTechnical({ table: top.table, column: top.column })}
                style={btn(t)}>Open in Technical view →</button>)}
          </>)}
      </div>);
  }

  /* Usage is a FIFTH state, not a yes/no. "mixed" is the one that earns
     its place: a warehouse column fed by several contract fields, some
     read and some not. Reading it as "unused" and dropping the column
     would lose something somebody reads. */
  const USAGE_STYLE = {
    used:    { label: "used",    c: "#1a8f4c", bg: "rgba(26,143,76,.1)" },
    unused:  { label: "unused",  c: "#6b7c8a", bg: "#eef2f5" },
    mixed:   { label: "mixed",   c: "#e8a33d", bg: "rgba(232,163,61,.16)" },
    partial: { label: "partial", c: "#e8a33d", bg: "rgba(232,163,61,.16)" },
    unknown: { label: "unknown", c: "#8a93a0", bg: "#f3f5f7" },
  };

  const UsageTag = ({ v, how }) => {
    if (!v) return <span style={{ color: "#bbb" }}>—</span>;
    const st = USAGE_STYLE[v] || USAGE_STYLE.unknown;
    return (
      <span title={how ? `matched on ${how.replace(/_/g, " ")}` : ""}
        style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px",
          borderRadius: 999, whiteSpace: "nowrap",
          color: st.c, background: st.bg }}>{st.label}</span>);
  };

  /* --------------------------------------------------- drill: the list --- */
  if (top && top.kind === "list") {
    return (
      <div style={{ fontFamily: F }}>
        <Crumbs t={t} stack={stack} onBack={back} onHome={() => setStack([])} />
        <div style={card}>
          <div style={head}><h2 style={h2}>{top.title}</h2>
            <span style={note}>{list ? `${list.length} columns` : "loading…"}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 9,
              alignItems: "center", flexWrap: "wrap" }}>
              {listUsage && (
                <span style={{ fontSize: 10.5, color: t.muted || "#999" }}>
                  {listUsage.loaded
                    ? `usage: ${listUsage.matched} of ${listUsage.rows} matched`
                    : "usage not loaded"}
                </span>)}
              {/* A link, not a fetch: the browser does the download, the
                  progress and the Save dialog, and a 20,000-row workbook
                  never has to sit in a JavaScript string. The export takes
                  the SAME filters as the grid and is NOT capped at the
                  grid's 500 -- an export that silently stopped short
                  would be worse than none, because the file looks whole. */}
              <a href={columnsXlsxUrl({ data_source: ds, ...top.filter })}
                style={{ fontSize: 11.5, textDecoration: "none",
                  border: `1px solid ${t.border || "#b5b6b6"}`,
                  borderRadius: 3, padding: "4px 11px", color: t.accent,
                  background: t.panel, whiteSpace: "nowrap" }}>
                Export to Excel
              </a>
            </span></div>
          {listUsage && !listUsage.loaded && (
            <div style={{ padding: "7px 14px", fontSize: 11.5,
              color: t.muted || "#999", borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
              {listUsage.note || "STAR field usage is not loaded for this lane."}
            </div>)}
          {listUsage && listUsage.loaded && listUsage.note && (
            <div style={{ padding: "7px 14px", fontSize: 11.5,
              color: t.muted || "#999", borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
              {listUsage.note}
            </div>)}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, minWidth: 720 }}>
              <thead><tr>{["Warehouse column", "Lane", "Contract field", "Usage",
                "SEI datapoints", "Verdict", "Analysis"].map((h) =>
                  <th key={h} style={th(t)}>{h}</th>)}</tr></thead>
              <tbody>
                {(list || []).map((r, i) => (
                  <tr key={i} onClick={() => openCol(g(r, "dwh_target_table", "DWH_TARGET_TABLE"),
                                                     g(r, "dwh_target_column", "DWH_TARGET_COLUMN"))}
                    style={{ cursor: "pointer", borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
                    <td style={td}>
                      <span style={{ fontFamily: MONO, fontWeight: 500 }}>
                        {g(r, "dwh_target_column", "DWH_TARGET_COLUMN")}</span>
                      <span style={sub(t)}>{g(r, "dwh_target_table", "DWH_TARGET_TABLE")}</span></td>
                    <td style={td}><LaneTag lane={g(r, "lane_id", "LANE_ID")} /></td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>
                      {g(r, "contract_field", "CONTRACT_FIELD") || "—"}</td>
                    <td style={td}><UsageTag v={g(r, "usage", "USAGE")}
                      how={g(r, "usage_matched_on", "USAGE_MATCHED_ON")} /></td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>
                      {g(r, "sei_datapoints", "SEI_DATAPOINTS") || "—"}</td>
                    <td style={td}><Pill v={g(r, "match_verdict", "MATCH_VERDICT")}
                      onWhat={openGlossary} /></td>
                    <td style={{ ...td, fontSize: 10.5, color: t.muted || "#999" }}>
                      {g(r, "failed_checks", "FAILED_CHECKS") || "—"}</td>
                  </tr>))}
                {list && !list.length && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: t.muted || "#999" }}>
                    Nothing matches this filter.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>);
  }

  /* ------------------------------------------------------- the overview --- */
  const v = sum.verdicts || [];
  return (
    <div style={{ fontFamily: F }}>
      {/* THE BUSINESS ANSWER FIRST. Three questions — does SEI have a
          datapoint, would the value arrive the same, who still has to
          decide — over the nine verdicts the rest of this page shows. The
          verdicts are not replaced: every tile, band and bar drills into
          the same list, and that list names the rule each field carries.
          "Detail" collapses this back to the verdict-first overview for
          anyone who works in it daily. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center",
        marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", borderRadius: 999, padding: 3, gap: 2,
          background: t.navy || "#10193b" }}>
          {/* "Usage" is a third face of the same estate, not a filter on
              the other two: it answers what anybody READS, which no
              verdict knows. Kept as its own view so an "unused" badge
              never sits next to a verdict and invites a subtraction
              nobody decided on. */}
          {[["biz", "Business"], ["detail", "Detail"],
            ["usage", "Field usage"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setLook(k)}
              aria-pressed={look === k}
              style={{ font: "inherit", fontSize: 11.5, padding: "4px 14px",
                borderRadius: 999, border: 0, cursor: "pointer",
                background: look === k ? "#2b9fe0" : "transparent",
                fontWeight: look === k ? 500 : 400,
                color: look === k ? "#fff" : "#c7d3de" }}>{label}</button>))}
        </span>
      </div>

      {look === "biz" && (
        <SeiBusinessSummary t={t} dataSource={ds} onDrill={drill}
          onGlossary={openGlossary} />)}

      {look === "usage" && <StarFieldUsage t={t} dataSource={ds} />}

      {look === "detail" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))",
        gap: 11, marginBottom: 16 }}>
        <Kpi t={t} v={sum.in_denominator} of={`of ${sum.total_columns}`} c={t.accent || "#0f4775"}
          meter={pct(sum.in_denominator, sum.total_columns)}
          sub={["Columns in the SEI denominator", `${sum.out_of_scope} out of scope — lineage, not readiness`]}
          onClick={() => drill({}, "Every final column")} />
        <Kpi t={t} v={sum.mapped} of={`of ${sum.in_denominator}`} c="#0091bf"
          meter={pct(sum.mapped, sum.in_denominator)}
          sub={["Have a SEI datapoint", "proposed, none of it verified yet"]} />
        <Kpi t={t} v={sum.proven} c="#159943" meter={pct(sum.proven, sum.mapped)}
          title={verdictShort("PROVEN_MATCH")}
          sub={["Proven matches", sum.ceiling?.blocked ? "ceiling is 0 until live DDL lands" : "both sides from live metadata"]}
          onClick={() => drill({ verdict: "PROVEN_MATCH" }, "Proven matches")} />
        <Kpi t={t} v={sum.no_source} c="#c1113a" meter={pct(sum.no_source, sum.in_denominator)}
          title={verdictShort("NO_SOURCE")}
          sub={["No SEI source", `${sum.undecided_dispositions} dispositions still undecided`]}
          onClick={() => drill({ verdict: "NO_SOURCE" }, "Columns with no SEI source")} />
        <Kpi t={t} v={sum.dual_source} c="#7c3aed"
          sub={["Dual-source columns", "two lanes, no precedence rule"]} />
        <Kpi t={t} v={sum.open_exceptions} c="#e67e22"
          sub={["Open exceptions", "each names who can answer it"]} />
      </div>

      {sum.ceiling?.blocked && (
        <Callout t={t} c="#e67e22" title="No verdict can reach PROVEN yet">
          {sum.ceiling.reason} {sum.ceiling.live_ddl != null &&
            `${sum.ceiling.live_ddl} of ${sum.ceiling.of} columns have live-DDL evidence on the target side.`}
        </Callout>)}

      <Panel t={t} title="Verdict spread" note="click a band to drill into it">
        <Stack verdicts={v} h={18} onPick={(x) => drill({ verdict: x },
          `${VERDICT[x]?.t || x} columns`)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 11,
          alignItems: "center" }}>
          {v.map((x) => (
            <span key={x.verdict} title={verdictShort(x.verdict)}
              onClick={() => drill({ verdict: x.verdict },
              `${VERDICT[x.verdict]?.t || x.verdict} columns`)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5,
                color: t.sub || "#666", cursor: "pointer" }}>
              <i style={{ width: 11, height: 11, borderRadius: 2,
                background: (VERDICT[x.verdict] || VERDICT.UNKNOWN).c }} />
              {VERDICT[x.verdict]?.t || x.verdict} <b>{x.n}</b></span>))}
          <button type="button" onClick={() => openGlossary(null)}
            style={{ marginLeft: "auto", background: "none", border: "none",
              padding: 0, font: "inherit", fontSize: 10.5, cursor: "pointer",
              color: t.accent || "#0f4775", textDecoration: "underline" }}>
            what do these mean? →</button>
        </div>
        {/* The one sentence that stops the spread being read as a severity
            ladder. Everything else lives behind the link. */}
        <div style={{ fontSize: 10.5, color: t.muted || "#999", marginTop: 9,
          lineHeight: 1.6, maxWidth: "80ch" }}>
          One verdict per column, from a fixed algorithm, first match wins —
          so a column carries the rule that stopped it and nothing below that
          rule was tested. <b>UNKNOWN is never a pass</b>, and{" "}
          <b>NO SOURCE means SEI offers nothing at all</b> for a column the
          incumbent fills today.
        </div>
      </Panel>

      {/* Where every column comes from. "no SEI source" is a node here, not
          an omission — it is usually the widest ribbon on the diagram, and
          leaving it out would answer a question nobody asked. */}
      {((flow && ((flow.left || []).length > 0 || (flow.right || []).length > 0)) || hasCand) && (
        <Panel t={t} title="Where every column comes from"
          note={flowMode === "candidates"
            ? "the mapping documents' candidate paths · SEI object → STAR feed → IMDS table · ribbon width is paths · every one a draft, no verdict changes"
            : "ribbon width is columns · a ribbon that starts at “no SEI source” has nothing behind it"}>
          {/* Two vocabularies, one drawing. "Proposed" is the crosswalk's own
              SEI_TO_STAR and VERIFY sheets with their verdicts; "candidates"
              is what the seven mapping documents say, which nobody has
              promoted yet. Side by side on the same ribbon, never merged. */}
          {hasCand && (
            <div style={{ display: "inline-flex", gap: 2, borderRadius: 999, padding: 3,
              background: "#e9eef3", marginBottom: 10 }}>
              {[["proposed", "Proposed · with verdicts"], ["candidates", "Mapping documents · candidates (draft)"]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setFlowMode(k)} aria-pressed={flowMode === k}
                  style={{ font: "inherit", fontSize: 11, padding: "3px 11px", borderRadius: 999, border: 0,
                    cursor: "pointer", background: flowMode === k ? "#fff" : "transparent",
                    fontWeight: flowMode === k ? 600 : 400, color: k === "candidates" && flowMode === k ? "#b45309" : t.text }}>
                  {label}</button>))}
            </div>)}
          {flowMode === "candidates" && hasCand ? (
            <FlowDiagram t={t} flow={flowCand} vocab={CANDIDATE_VOCAB}
              onDrill={(filter) => focusDocs(filter)}
              onOpenTable={onOpenTechnical
                ? (tbl) => onOpenTechnical({ table: tbl, column: null })
                : undefined}
              nameOf={nameOf} />
          ) : (
          <FlowDiagram t={t} flow={flow}
            onPickVerdict={(x) => drill({ verdict: x },
              `${VERDICT[x]?.t || x} columns`)}
            // A selection on the diagram drills to exactly the columns that
            // ribbon is made of, not to the verdict it happens to be. From
            // there the column page carries the full chain, so the picture
            // and the lineage are two clicks apart rather than two screens.
            onDrill={(filter, title) => drill(filter, title)}
            onOpenTable={onOpenTechnical
              ? (tbl) => onOpenTechnical({ table: tbl, column: null })
              : undefined}
            nameOf={nameOf} />)}
          {flowMode === "candidates" && hasCand && (
            <div style={{ fontSize: 11, color: t.sub, marginTop: 8 }}>
              Click a node or a ribbon, then <b>open these paths</b>: the rows behind it show in <b>The SEI mapping documents</b> below.
            </div>)}
        </Panel>)}

      {/* The ceiling, taken apart. One number made this look like one task;
          it is four artefacts held by four different teams, and they can be
          chased in parallel. */}
      {ev && (ev.rows || []).length > 0 && (
        <Panel t={t} title="Why nothing is proven"
          note={ev.headline || "a match needs both sides from live metadata"}>
          <EvidencePanel t={t} ev={ev} />
        </Panel>)}

      {/* Does the SEI rule COMPUTE the same value? The last question, and
          the one that survives all the others: a column can pass every
          format check and still be wrong because the grain differs. */}
      {xf && xf.total > 0 && (
        <Panel t={t} title="Does the new logic compute the same value?"
          note={xf.headline || "equivalence is about the logic; approval is about who has looked at it"}>
          <TransformationPanel t={t} xf={xf} onOpenColumn={openCol} />
        </Panel>)}

      {/* The SEI mapping documents (sql/79): three lanes of field maps and
          what they reach. Self-hides when nothing is loaded, so a warehouse
          without them looks exactly as it did. */}
      <Panel t={t} title="The SEI mapping documents"
        note="SEI → STAR → IMDS, per IMDS table · every row a draft until an approved crosswalk says otherwise">
        <MappingDocsPanel t={t} dataSource={ds} onOpenColumn={openCol} focus={docFocus} />
      </Panel>

      {/* Every final column as one cell. The spread says how many; this says
          where — and a contiguous run is one gap with one owner, not many. */}
      {waf && (waf.tables || []).length > 0 && (
        <Panel t={t} title="Every final column, one cell"
          note={`${waf.cells} columns across ${waf.table_count} tables · in the table's own column order`}>
          <Waffle t={t} waffle={waf} onPickColumn={openCol} />
        </Panel>)}

      <Panel t={t} title="Divergence — six shapes, and what each one costs"
        note="the diagram is the shape of the problem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(255px,1fr))", gap: 12 }}>
          {(div.shapes || []).map((s) => {
            const c = { collapse: "#c1113a", dual_source: "#7c3aed", bypass: "#b45309",
                        decode: "#7c3aed", feed_dependency: "#e67e22", no_source: "#c1113a" }[s.key] || "#5f87a7";
            const f = { collapse: { }, dual_source: { }, bypass: { },
                        decode: { verdict: "DECODE_NEEDED" }, feed_dependency: { },
                        no_source: { verdict: "NO_SOURCE" } }[s.key] || {};
            return (
              <div key={s.key} onClick={() => drill(f, `${s.label} — ${s.n} columns`)}
                style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderLeft: `3px solid ${c}`,
                  borderRadius: 6, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 23, fontWeight: 500, color: c, lineHeight: 1,
                    fontVariantNumeric: "tabular-nums" }}>{s.n}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.label}</span>
                  <span style={{ marginLeft: "auto" }}><Shape kind={s.key} c={c} /></span>
                </div>
                <div style={{ marginTop: 7, fontSize: 10.5, lineHeight: 1.55,
                  color: t.sub || "#666" }}>
                  {SHAPE_INFO[s.key]?.short || ""}</div>
                <div style={{ marginTop: 8, paddingTop: 7,
                  borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}`, fontSize: 10,
                  color: t.muted || "#999", display: "flex", gap: 8,
                  alignItems: "baseline" }}>
                  <span><b>Owner</b> {s.owner}</span>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); openGlossary(s.key); }}
                    style={{ marginLeft: "auto", background: "none",
                      border: "none", padding: 0, font: "inherit", fontSize: 10,
                      cursor: "pointer", color: t.accent || "#0f4775",
                      textDecoration: "underline" }}>what this means</button>
                </div>
              </div>);
          })}
        </div>
      </Panel>

      {cat && cat.checked > 0 && (
        <Panel t={t} title="Does the datapoint exist in SEI at all?"
          note={`${cat.inbound_fields} inbound fields catalogued · evidence, not proof`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 11 }}>
            <Kpi t={t} v={cat.absent_count} c="#c1113a"
              sub={["Not in SEI's input catalog", "may not exist on any interface"]}
              onClick={cat.absent_count ? () => drill({}, "Columns whose datapoint is not catalogued") : undefined} />
            <Kpi t={t} v={cat.ambiguous_count} c="#e67e22"
              sub={["Matched more than once", "which field is meant is undecided"]} />
            <Kpi t={t} v={cat.checked} c="#0091bf"
              sub={["Datapoints checked", "against SEI's own inbound catalog"]} />
          </div>
          <Callout t={t} c="#5f87a7" title="Read this as a different question from the format verdict">
            {cat.caveat}
          </Callout>
          {(cat.absent || []).length > 0 && (
            <Table t={t} cols={["Contract field", "Feed", "Proposed datapoint", "Result"]}
              rows={cat.absent.slice(0, 25).map((r) => [
                <span style={{ fontFamily: MONO }}>{g(r, "target_field", "TARGET_FIELD")}</span>,
                g(r, "target_feed", "TARGET_FEED"),
                <span style={{ fontFamily: MONO }}>{g(r, "mapped_sei_datapoint", "MAPPED_SEI_DATAPOINT") || "—"}</span>,
                <span style={{ color: "#c1113a", fontSize: 11 }}>
                  {g(r, "verify_result", "VERIFY_RESULT")}</span>])} />)}
        </Panel>)}

      {(div.collapse || []).length > 0 && (
        <Panel t={t} title="One datapoint standing in for several contract fields"
          note="the incumbent kept these apart">
          <Table t={t} cols={["SEI datapoint", "Feed", "Fields", "Which"]}
            rows={div.collapse.map((c) => [
              <span style={{ fontFamily: MONO }}>{g(c, "sei_datapoint", "SEI_DATAPOINT")}</span>,
              g(c, "sei_feed", "SEI_FEED"),
              <b>{g(c, "fields", "FIELDS")}</b>,
              <span style={{ fontFamily: MONO, fontSize: 11 }}>{g(c, "field_list", "FIELD_LIST")}</span>])} />
        </Panel>)}

      <Panel t={t} title="Readiness by warehouse table" note="click a table to drill in">
        <Table t={t} cols={["Table", "Lanes", "Columns", "Verdict spread", "Gate"]}
          rows={(ready || []).map((r) => [
            <span style={{ fontFamily: MONO, fontWeight: 500 }}>{r.table}</span>,
            <span style={{ display: "flex", gap: 4 }}>{(r.lanes || []).map((l) =>
              <LaneTag key={l} lane={l} />)}</span>,
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.columns}</span>,
            <Stack verdicts={r.verdicts} />,
            <Pill v={r.gate === "OUT_OF_SCOPE" ? "OUT_OF_SCOPE"
                   : r.gate === "READY" ? "PROVEN_MATCH" : "NO_SOURCE"} />])}
          onRow={(i) => drill({ table: ready[i].table }, ready[i].table)} />
      </Panel>

      {(exc.by_owner || []).length > 0 && (
        <Panel t={t} title="Open questions, by who can answer them"
          note={`${exc.exceptions.length} in total`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {exc.by_owner.map((o) => (
              <span key={o.owner} style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                borderRadius: 3, padding: "7px 12px", fontSize: 11.5 }}>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{o.n}</b>{" "}
                <span style={{ color: t.sub || "#666" }}>{o.owner}</span></span>))}
          </div>
        </Panel>)}

      {(lanes || []).length > 0 && (
        <Panel t={t} title="Lane register" note="which pairings exist, and which are replaced">
          <Table t={t} cols={["Lane", "State", "Contract", "Columns", "Spread"]}
            rows={lanes.map((l) => [
              <span><LaneTag lane={g(l, "source_system", "SOURCE_SYSTEM")} />{" "}
                <span style={{ fontFamily: MONO, fontSize: 11 }}>{g(l, "lane_id", "LANE_ID")}</span></span>,
              g(l, "replacement_state", "REPLACEMENT_STATE"),
              g(l, "contract_name", "CONTRACT_NAME") || "—",
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{l.columns || 0}</span>,
              <Stack verdicts={l.verdicts} />])} />
        </Panel>)}
      </>)}
    </div>);
}

/* ------------------------------------------------------------ bits ----- */
const th = (t) => ({ textAlign: "left", padding: "8px 12px", fontSize: 9.5, fontWeight: 700,
  letterSpacing: 0.5, color: t.muted || "#999", textTransform: "uppercase",
  borderBottom: `1px solid ${t.panel2 || "#dfe6e9"}`, whiteSpace: "nowrap",
  background: t.bg || "#f5f8f8" });
const td = { padding: "9px 12px", verticalAlign: "top" };
const sub = (t) => ({ display: "block", fontSize: 10, color: t.muted || "#999", marginTop: 2 });
const btn = (t) => ({ fontSize: 11.5, fontWeight: 700, padding: "7px 14px", cursor: "pointer",
  fontFamily: F, borderRadius: 3, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
  background: t.panel || "#fff", color: t.accent || "#0f4775" });

// A labelled line inside a glossary entry: "Blocks cutover — Yes, and it is
// the hardest kind." The label is what makes the entries scannable side by
// side, since every verdict answers the same four questions.
function Field({ t, k, v }) {
  return (
    <div style={{ display: "flex", gap: 9, marginTop: 6, alignItems: "baseline" }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
        textTransform: "uppercase", color: t.muted || "#999",
        minWidth: 112, flexShrink: 0 }}>{k}</span>
      <Prose text={v} style={{ color: t.sub || "#666", fontSize: 11 }} />
    </div>);
}

function Panel({ t, title, note, children }) {
  return (
    <div style={{ background: t.panel || "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 11, padding: "12px 17px",
        background: "linear-gradient(to right,#eef3f8,#f7fafc)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: t.navy || "#10193b" }}>{title}</h2>
        {note && <span style={{ fontSize: 10.5, color: t.muted || "#999" }}>{note}</span>}
      </div>
      <div style={{ padding: "16px 17px" }}>{children}</div>
    </div>);
}

function Table({ t, cols, rows, onRow }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, minWidth: 620 }}>
        <thead><tr>{cols.map((c) => <th key={c} style={th(t)}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(i) : undefined}
              style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
                cursor: onRow ? "pointer" : "default" }}>
              {r.map((c, j) => <td key={j} style={td}>{c}</td>)}
            </tr>))}
        </tbody>
      </table>
    </div>);
}

function Callout({ t, c, title, children }) {
  return (
    <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderLeft: `3px solid ${c}`,
      borderRadius: 3, padding: "11px 14px", marginBottom: 16, background: t.panel || "#fff" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: t.sub || "#666", lineHeight: 1.6 }}>{children}</div>
    </div>);
}

function Empty({ t, s }) {
  return <div style={{ fontSize: 11.5, color: t.muted || "#999", padding: "6px 0" }}>{s}</div>;
}

function ChainRow({ t, row }) {
  const node = (stage, val, note, c) => (
    <div style={{ flex: "1 1 110px", minWidth: 0, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
      borderLeft: `3px solid ${c}`, borderRadius: 3, padding: "7px 9px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, color: c }}>{stage}</div>
      <div style={{ fontSize: 11, marginTop: 3, fontFamily: MONO, wordBreak: "break-word" }}>{val || "—"}</div>
      {note && <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 2 }}>{note}</div>}
    </div>);
  const arrow = <div style={{ width: 18, display: "flex", alignItems: "center",
    justifyContent: "center", color: t.muted || "#999" }}>›</div>;
  const parts = [
    node("SRC · CONTRACT", g(row, "src_source_column", "SRC_SOURCE_COLUMN"),
         g(row, "src_source_table", "SRC_SOURCE_TABLE"), "#7c3aed"),
    node("STG1", g(row, "stg1_source_column", "STG1_SOURCE_COLUMN") || "N/A", null, "#00a3a3"),
    node("STG2", g(row, "stg2_source_column", "STG2_SOURCE_COLUMN") || "N/A", null, "#0091bf"),
    node("DWH", g(row, "dwh_target_column", "DWH_TARGET_COLUMN"),
         g(row, "dwh_type", "DWH_TYPE"), "#0f4775"),
  ];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>
        <LaneTag lane={g(row, "lane_id", "LANE_ID")} /></div>
      <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap" }}>
        {parts.map((p, i) => <React.Fragment key={i}>{p}{i < parts.length - 1 ? arrow : null}</React.Fragment>)}
      </div>
    </div>);
}

function Crumbs({ t, stack, onBack, onHome }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "0 0 11px", marginBottom: 13, borderBottom: `1px solid ${t.panel2 || "#dfe6e9"}` }}>
      <button onClick={onBack} style={btn(t)}>← Back</button>
      <span onClick={onHome} style={{ fontSize: 11.5, color: t.accent || "#0f4775",
        cursor: "pointer", fontWeight: 600 }}>Mapping &amp; divergence</span>
      {stack.map((s, i) => (
        <React.Fragment key={i}>
          <span style={{ color: t.muted || "#999" }}>›</span>
          <span style={{ fontSize: 11.5, color: t.sub || "#666",
            fontFamily: s.kind === "column" ? MONO : F }}>
            {s.kind === "column" ? `${s.table}.${s.column}` : s.title}</span>
        </React.Fragment>))}
    </div>);
}
