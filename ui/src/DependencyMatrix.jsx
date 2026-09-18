import React, { useEffect, useState } from "react";
import { lineageApi } from "./lineage_api_additions.js";

// =====================================================================
// DependencyMatrix — which source file feeds which PBDW table.
//
// Swimlanes lists a group's sources in one column and its targets in
// another and draws nothing between them: you can see membership, never
// connection. "Which of these 13 sources feeds DIM_ACCOUNT?" — the
// question the screen is named for — cannot be answered from two lists.
//
// At this grain (~13 sources x ~11 targets) a wired bipartite graph is a
// hairball, but a grid fits one screen with no crossing lines:
//
//   row across    blast radius  — everything this feed touches
//   column down   root cause    — everything that feeds this table
//   cell          thickness     — warehouse columns that actually flow
//   empty column  ORPHAN        — a table nothing feeds
//
// The orphan is the point: it is the migration risk register, and no
// arrangement of two lists can show it.
//
// CLOSED FIRST. Fifteen grids stacked on one page is the same wall of
// everything the swimlanes were, only denser. The list arrives as counts,
// and a group's grid is fetched the first time it is opened — so the
// screen owes you a way in before it owes you detail.
// =====================================================================

// Sequential ramp, ONE hue (the app's accent navy), light to dark — the rule
// for magnitude. Every cell also prints its number, so thickness is never
// carried by colour alone, and the two dark steps take white text to clear
// contrast at this size.
const STEPS = [
  { max: 0,        bg: "#ffffff", fg: "#c9d4dc", w: 400 },
  { max: 4,        bg: "#e4edf5", fg: "#233240", w: 500 },
  { max: 12,       bg: "#c3d8e9", fg: "#233240", w: 500 },
  { max: 30,       bg: "#9dbdd8", fg: "#233240", w: 600 },
  { max: 60,       bg: "#3a6f9e", fg: "#ffffff", w: 600 },
  { max: Infinity, bg: "#0f4775", fg: "#ffffff", w: 700 },
];
const step = (n) => STEPS.find((s) => (n || 0) <= s.max) || STEPS[0];

const mono = "Roboto Mono, monospace";
const INK = "#233240", SUB = "#7b8894", RULE = "#c9d4dc";
const ACCENT = "#0f4775", DANGER = "#c1113a", WARN = "#a8560f";

export default function DependencyMatrix({ dataSource = "PBDW", onOpenTable }) {
  const ds = (dataSource || "PBDW").toUpperCase();
  const [list, setList] = useState(null);      // the summaries
  const [open, setOpen] = useState({});        // group -> bool
  const [detail, setDetail] = useState({});    // group -> full matrix | "loading"
  const [q, setQ] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    let dead = false;
    setList(null); setOpen({}); setDetail({});
    lineageApi.dependencyMatrix(ds).then((d) => { if (!dead) setList(d); });
    return () => { dead = true; };
  }, [ds]);

  // Fetched once per group and kept. Re-opening a group someone has already
  // looked at should be instant; it is the same data.
  const toggle = (name) => {
    const next = !open[name];
    setOpen((m) => ({ ...m, [name]: next }));
    if (next && !detail[name]) {
      setDetail((m) => ({ ...m, [name]: "loading" }));
      lineageApi.dependencyMatrix(ds, name).then((d) => {
        const g = (d.groups || []).find((x) => x.group === name) || null;
        setDetail((m) => ({ ...m, [name]: g }));
      });
    }
  };

  if (!list)
    return <div style={{ padding: 20, fontSize: 12, color: SUB }}>
      Loading dependencies…</div>;

  const T = list.totals || {};
  const groups = (list.groups || []).filter((g) => {
    if (onlyProblems && !g.stats.orphans && !g.stats.defects) return false;
    return !q || (g.group || "").toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center",
                    flexWrap: "wrap", marginBottom: 14 }}>
        <label htmlFor="dmq" style={{ position: "absolute", left: -9999 }}>
          Filter functional groups</label>
        <input id="dmq" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter groups…"
          style={{ height: 30, width: 220, border: `1px solid ${RULE}`,
                   borderRadius: 4, padding: "0 10px", fontSize: 12,
                   fontFamily: "inherit" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6,
                        fontSize: 11.5, color: INK, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)} />
          Only groups with a problem
        </label>
        {T.orphans > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: DANGER,
                         background: "#fdf0f2", border: "1px solid #f0c4cc",
                         borderRadius: 999, padding: "4px 12px" }}>
            {T.orphans} table{T.orphans === 1 ? "" : "s"} with no source</span>)}
        {T.defects > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: WARN,
                         background: "#fdf6ec", border: "1px solid #f2d9b4",
                         borderRadius: 999, padding: "4px 12px" }}>
            {T.defects} malformed source name{T.defects === 1 ? "" : "s"}</span>)}
        <span style={{ marginLeft: "auto", fontSize: 11, color: SUB }}>
          {groups.length} group{groups.length === 1 ? "" : "s"} · open one to see
          which source feeds which table</span>
      </div>

      {!groups.length && (
        <div style={{ padding: 20, fontSize: 12, color: SUB, textAlign: "center" }}>
          {onlyProblems ? "No group has an orphan or a malformed source name."
                        : `No group matches “${q}”.`}</div>)}

      {groups.map((g) => (
        <GroupRow key={g.group} g={g} open={!!open[g.group]}
          detail={detail[g.group]} onToggle={() => toggle(g.group)}
          onOpenTable={onOpenTable} />))}
    </div>);
}

function GroupRow({ g, open, detail, onToggle, onOpenTable }) {
  const s = g.stats;
  const problem = s.orphans > 0 || s.defects > 0;
  return (
    <div style={{ background: "#fff", border: `1px solid ${RULE}`,
                  borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <button onClick={onToggle}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                 padding: "12px 15px", cursor: "pointer", textAlign: "left",
                 border: "none", background: open ? "#f7fafc" : "#fff",
                 fontFamily: "inherit", color: INK }}>
        <span style={{ fontSize: 10, color: SUB, width: 9 }}>
          {open ? "▾" : "▸"}</span>
        <b style={{ fontSize: 13.5, fontWeight: 500 }}>{g.group}</b>
        <span style={{ fontSize: 11, color: SUB }}>
          {s.sources} source{s.sources === 1 ? "" : "s"} → {s.targets} table
          {s.targets === 1 ? "" : "s"} · {s.links} column links</span>
        {s.orphans > 0 && (
          <span title="warehouse tables nothing feeds"
            style={{ fontSize: 10.5, fontWeight: 700, color: DANGER,
                     background: "#fdf0f2", borderRadius: 999,
                     padding: "2px 9px" }}>{s.orphans} no source</span>)}
        {s.defects > 0 && (
          <span title="source names that are not table names"
            style={{ fontSize: 10.5, fontWeight: 700, color: WARN,
                     background: "#fdf6ec", borderRadius: 999,
                     padding: "2px 9px" }}>{s.defects} malformed</span>)}
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: SUB }}>
          {open ? "" : problem ? "open to see which" : "open"}</span>
      </button>

      {open && detail === "loading" && (
        <div style={{ padding: "14px 15px", fontSize: 11.5, color: SUB,
                      borderTop: `1px solid ${RULE}` }}>Loading the grid…</div>)}
      {open && detail && detail !== "loading" && (
        <Matrix g={detail} onOpenTable={onOpenTable} />)}
      {open && detail === null && (
        <div style={{ padding: "14px 15px", fontSize: 11.5, color: SUB,
                      borderTop: `1px solid ${RULE}` }}>
          No grid came back for this group.</div>)}
    </div>);
}

function Matrix({ g, onOpenTable }) {
  // The crosshair lights the hovered row AND column, headers included — they
  // are not descendants of the cell, so CSS :hover alone cannot do it.
  const [hot, setHot] = useState(null);
  const cell = {};
  (g.cells || []).forEach((c) => { cell[`${c.s}:${c.t}`] = c; });

  return (
    <div style={{ borderTop: `1px solid ${RULE}` }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0,
                        fontSize: 11, minWidth: "100%" }}>
          <caption style={{ captionSide: "top", textAlign: "left",
                            padding: "9px 15px 7px", fontSize: 9.5,
                            fontWeight: 700, letterSpacing: 0.5,
                            textTransform: "uppercase", color: SUB }}>
            Source file (row) → warehouse table (column) · each cell is the
            number of warehouse columns that flow on that link
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...th, textAlign: "left", width: 280,
                                       verticalAlign: "bottom" }}>Source</th>
              {g.targets.map((t, ti) => (
                <th key={t.tgt} scope="col"
                  onMouseEnter={() => setHot({ s: -1, t: ti })}
                  onMouseLeave={() => setHot(null)}
                  style={{ ...th, width: 34, height: 150, padding: "0 0 6px",
                           background: t.orphan ? "#fdf0f2"
                             : (hot && hot.t === ti ? "#eef3f8" : undefined) }}>
                  <div title={`${t.tgt} · ${t.columns} columns · ${t.sources} source(s)`}
                    style={{ writingMode: "vertical-rl",
                             transform: "rotate(180deg)", fontFamily: mono,
                             fontSize: 10, whiteSpace: "nowrap",
                             fontWeight: t.orphan ? 700 : 500,
                             color: t.orphan ? DANGER : INK }}>
                    {t.tgt}</div>
                </th>))}
              <th scope="col" style={{ ...th, textAlign: "right", width: 70,
                                       verticalAlign: "bottom" }}>Reach</th>
            </tr>
          </thead>
          <tbody>
            {g.sources.map((s, si) => {
              const bad = !!s.defect;
              return (
                <tr key={s.src}
                  style={{ background: hot && hot.s === si ? "#f7fafc" : undefined }}>
                  <th scope="row" style={{ ...td, textAlign: "left",
                                           fontWeight: 400, maxWidth: 280 }}>
                    <span style={{ display: "block", fontSize: 11.5,
                                   color: bad ? DANGER : INK,
                                   fontWeight: bad ? 600 : 400,
                                   overflow: "hidden", textOverflow: "ellipsis",
                                   whiteSpace: "nowrap" }}>
                      {bad ? defectLabel(s.defect) : (s.dataset || s.src)}</span>
                    <span title={s.src}
                      style={{ display: "block", fontFamily: mono, fontSize: 9,
                               color: SUB, overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.src}</span>
                  </th>
                  {g.targets.map((t, ti) => {
                    const c = cell[`${si}:${ti}`];
                    const n = c ? c.n : 0;
                    const st = step(n);
                    const lit = hot && (hot.s === si || hot.t === ti);
                    return (
                      <td key={t.tgt}
                        onMouseEnter={() => setHot({ s: si, t: ti })}
                        onMouseLeave={() => setHot(null)}
                        onClick={n && onOpenTable ? () => onOpenTable(t.tgt) : undefined}
                        title={n
                          ? `${s.dataset || s.src} → ${t.tgt} · ${n} column links`
                            + (c && c.m < n ? ` · ${n - c.m} not yet mapped` : "")
                          : `${s.dataset || s.src} → ${t.tgt} · no link`}
                        style={{ ...td, textAlign: "center", padding: 0,
                                 background: st.bg,
                                 cursor: n && onOpenTable ? "pointer" : "default",
                                 boxShadow: lit && !n
                                   ? "inset 0 0 0 9999px rgba(15,71,117,.05)" : undefined }}>
                        <span style={{ display: "block", padding: "7px 0",
                                       fontFamily: mono, fontSize: 10.5,
                                       fontWeight: st.w, color: st.fg }}>
                          {n || "·"}</span>
                      </td>);
                  })}
                  <td style={{ ...td, textAlign: "right", fontFamily: mono,
                               fontSize: 10.5, color: SUB }}>
                    {s.reach ? `${s.reach} table${s.reach === 1 ? "" : "s"}`
                             : "nothing"}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 15px", fontSize: 10.5, color: SUB,
                    borderTop: "1px solid #edf1f4" }}>
        columns on link
        {STEPS.slice(1).map((s) => (
          <span key={s.max} title={`up to ${s.max === Infinity ? "any" : s.max}`}
            style={{ display: "inline-block", width: 20, height: 11,
                     background: s.bg, border: `1px solid ${RULE}` }} />))}
        <span style={{ marginLeft: "auto" }}>
          click a cell to open that table in the Explorer</span>
      </div>

      {(g.stats.orphans > 0 || g.stats.defects > 0) && (
        <div style={{ display: "flex", gap: 10, padding: "0 15px 13px",
                      flexWrap: "wrap" }}>
          {g.stats.orphans > 0 && (
            <div style={{ flex: "1 1 300px", background: "#fdf0f2",
                          border: "1px solid #f0c4cc", borderRadius: 9,
                          padding: "10px 13px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: DANGER }}>
                No source at all</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 3,
                            lineHeight: 1.5 }}>
                An empty column is a warehouse table nothing feeds — it loses
                nothing when the legacy source retires because it was never fed
                by it. This is the migration risk register.</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: INK,
                            marginTop: 6 }}>
                {g.targets.filter((t) => t.orphan).map((t) => t.tgt).join(" · ")}
              </div>
            </div>)}
          {g.stats.defects > 0 && (
            <div style={{ flex: "1 1 300px", background: "#fdf6ec",
                          border: "1px solid #f2d9b4", borderRadius: 9,
                          padding: "10px 13px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: WARN }}>
                Not a source — a defect in the sheet</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 3,
                            lineHeight: 1.5 }}>
                Reported rather than guessed at: a wrong split is worse than a
                flagged cell. Fix these in the lineage workbook and reload.</div>
              {g.sources.filter((s) => s.defect).map((s) => (
                <div key={s.src} style={{ marginTop: 6 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: INK,
                                wordBreak: "break-word" }}>{s.src}</div>
                  <div style={{ fontSize: 10.5, color: SUB }}>
                    {s.defect.note}
                    {s.defect.parts && ` — looks like: ${s.defect.parts.join("  +  ")}`}
                  </div>
                </div>))}
            </div>)}
        </div>)}
    </div>);
}

function defectLabel(d) {
  if (!d) return "";
  return d.kind === "literal_na" ? "Not a source — literal “NA”"
                                 : "Not a source — two names in one cell";
}

const th = { padding: "8px 12px", fontSize: 9.5, fontWeight: 700,
             textTransform: "uppercase", letterSpacing: 0.4, color: SUB,
             borderBottom: `1px solid ${RULE}` };
const td = { padding: "7px 12px", borderBottom: "1px solid #edf1f4" };
