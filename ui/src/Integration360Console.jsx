import React, { useState, useMemo, useEffect } from "react";
import { PIPELINES, CHANNELS, CHANNEL_ORDER, statusOf, STATUS_COLOR, STATUS_WORD, pipelineView } from "./hubPipelines.js";
import { integration360Api } from "./integration360Api.js";
import { PipelineHeader, RunDetail, useLiveCases, Chip, Dot, H } from "./HubBusiness.jsx";
import HubWires from "./HubWires.jsx";
import { FlowStrip, DagStrip } from "./HubBusiness.jsx";
import { businessDates, mergeHistory, kpis, attention, dayBoard, searchAll, gridRows, periodDates, readQuery, writeQuery, levelOf, fmtDur, fmtDay, fmtMonth } from "./integration360History.js";

// Integration 360 console: three levels with an address each.
//   Dashboard  #guardrails                       period, KPIs, needs attention, the day's board, the month grid, search
//   Pipeline   #guardrails?p=<id>                header, the last business dates as dots, trends, tabs
//   Run        #guardrails?p=<id>&d=<date>       what went wrong, bad records, where in the flow, where in the data, notes
// Live records from /integration360 lay over the illustrative pipelines; until a dag reports, its history is synthetic and says so.

const NAVY = "#10193b", TEAL = "#0e8f7e", RED = "#cc3344", AMBER = "#e0a13d", MUTE = "#5c7c94", BLUE = "#1168bd", MONO = "ui-monospace, Menlo, monospace";
const theme = (t) => ({ border: t.border || "#d9dee3", sub: t.sub || "#4a5560", text: t.text || "#1a1a1a", panel: t.panel || "#fff", bg: t.bg || "#f4f6f8" });
const CELL = { green: TEAL, amber: AMBER, red: RED, planned: "#e3e8ef", none: "#e3e8ef" };

const hashNow = () => (typeof window !== "undefined" ? window.location.hash : "#guardrails");

export default function Integration360Console({ t, initial }) {
  const th = theme(t);
  const today = initial?.today ? new Date(initial.today) : new Date();
  const allDates = useMemo(() => businessDates(44, today), [initial?.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState(initial?.query || readQuery(hashNow()));
  const go = (patch) => {
    const next = { ...q };
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === "") delete next[k]; else next[k] = String(v); });
    setQ(next);
    try { if (typeof window !== "undefined" && !initial?.query) window.location.hash = writeQuery(hashNow(), patch); } catch { /* no window */ }
  };
  useEffect(() => {
    if (initial?.query || typeof window === "undefined") return undefined;
    const on = () => setQ(readQuery(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [initial?.query]);

  // live records
  const [live, setLive] = useState(initial?.live || null);
  const [liveHist, setLiveHist] = useState(initial?.history || null);
  const [findings, setFindings] = useState(initial?.findings || {});
  useEffect(() => {
    if (initial?.live || initial?.history) return;
    integration360Api.pipelines().then(setLive).catch(() => setLive(null));
    integration360Api.history(44).then(setLiveHist).catch(() => setLiveHist(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hist = useMemo(() => mergeHistory(allDates, liveHist), [allDates, liveHist]);

  const level = levelOf(q);
  const p = q.p ? PIPELINES.find((x) => x.id === q.p) : null;
  const end = q.end && allDates.includes(q.end) ? q.end : allDates[allDates.length - 1];
  const period = q.period || "month";
  const dates = useMemo(() => periodDates(period, end, allDates), [period, end, allDates]);

  const crumbs = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
      <span role="link" tabIndex={0} onClick={() => go({ p: null, d: null, tab: null })} style={{ fontWeight: 700, color: level === "dash" ? th.text : BLUE, cursor: "pointer" }}>Integration 360</span>
      {p && <><span style={{ color: "#9aa7b2" }}>{"›"}</span><span role="link" tabIndex={0} onClick={() => go({ d: null, tab: null })} style={{ fontWeight: 700, color: level === "pipe" ? th.text : BLUE, cursor: "pointer" }}>{p.name}</span></>}
      {p && q.d && <><span style={{ color: "#9aa7b2" }}>{"›"}</span><span style={{ fontWeight: 700, fontFamily: MONO }}>{q.d}</span></>}
    </div>);

  if (level === "run" && p) return <RunLevel t={t} th={th} p={p} date={q.d} hist={hist} allDates={allDates} live={live} findings={findings} setFindings={setFindings} go={go} crumbs={crumbs} />;
  if (level === "pipe" && p) return <PipelineLevel t={t} th={th} p={p} tab={q.tab || "history"} hist={hist} allDates={allDates} live={live} findings={findings} setFindings={setFindings} go={go} crumbs={crumbs} />;
  return <Dashboard t={t} th={th} q={q} hist={hist} allDates={allDates} dates={dates} period={period} end={end} live={live} go={go} crumbs={crumbs} />;
}

/* ------------------------------------------------------------------ level 1: dashboard */
function Dashboard({ t, th, q, hist, allDates, dates, period, end, live, go, crumbs }) {
  const [text, setText] = useState(q.q || "");
  const k = kpis(hist, dates);
  const att = attention(hist, dates);
  const board = dayBoard(hist, end);
  const rows = gridRows(hist, dates).filter((r) => (!q.ch || r.p.channel === q.ch) && (!q.dom || r.p.domain === q.dom));
  const results = q.q ? searchAll(q.q, hist, allDates) : null;
  const shift = (dir) => {
    const i = allDates.indexOf(end);
    if (period === "day") return go({ end: allDates[Math.max(0, Math.min(allDates.length - 1, i + dir))] });
    if (period === "week") return go({ end: allDates[Math.max(0, Math.min(allDates.length - 1, i + dir * 5))] });
    const months = [...new Set(allDates.map((d) => d.slice(0, 7)))]; const mi = months.indexOf(end.slice(0, 7));
    const m = months[Math.max(0, Math.min(months.length - 1, mi + dir))]; const inM = allDates.filter((d) => d.slice(0, 7) === m);
    return go({ end: inM[inM.length - 1] });
  };
  const label = period === "day" ? fmtDay(end) + " " + end.slice(0, 4) : period === "week" ? `week to ${fmtDay(end)}` : fmtMonth(end);
  const tile = (label2, value, sub, accent) => (
    <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderTop: accent ? `3px solid ${accent}` : `1px solid ${th.border}`, borderRadius: 10, padding: "10px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 10, color: th.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label2}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || th.text, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: th.sub }}>{sub}</div>
    </div>);
  const pill = (on, label2, onClick) => <button type="button" aria-pressed={on} onClick={onClick} style={{ font: "inherit", fontSize: 11.5, fontWeight: on ? 700 : 500, padding: "4px 11px", borderRadius: 999, border: `1px solid ${on ? NAVY : th.border}`, background: on ? NAVY : th.panel, color: on ? "#fff" : th.text, cursor: "pointer" }}>{label2}</button>;
  return (
    <div data-level="dash">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {crumbs}
        {k.live > 0 ? <Chip bg="#e6f4f2" fg={TEAL}>LIVE · {k.live} of {k.pipelines} reporting</Chip> : <Chip bg="#f6f8fa" fg={MUTE}>illustrative until the first run reports</Chip>}
        <form onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() || null }); }} style={{ flex: "1 1 320px", minWidth: 240, display: "flex" }}>
          <label htmlFor="i360q" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search</label>
          <input id="i360q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a pipeline, DAG, rule, error code, column, file, business date" style={{ flex: 1, font: "inherit", fontSize: 12.5, padding: "8px 12px", border: `1px solid ${th.border}`, borderRadius: "8px 0 0 8px", background: th.panel, color: th.text }} />
          <button type="submit" style={{ font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", borderRadius: "0 8px 8px 0", cursor: "pointer" }}>Search</button>
        </form>
        <div style={{ display: "flex", border: `1px solid ${th.border}`, borderRadius: 8, overflow: "hidden" }}>
          {["day", "week", "month"].map((pp) => <button key={pp} type="button" aria-pressed={period === pp} onClick={() => go({ period: pp })} style={{ font: "inherit", fontSize: 12, fontWeight: period === pp ? 700 : 600, padding: "7px 13px", border: 0, background: period === pp ? NAVY : th.panel, color: period === pp ? "#fff" : th.sub, cursor: "pointer", textTransform: "capitalize" }}>{pp}</button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" aria-label="earlier" onClick={() => shift(-1)} style={{ font: "inherit", padding: "5px 10px", border: `1px solid ${th.border}`, borderRadius: 6, background: th.panel, cursor: "pointer", color: th.text }}>{"‹"}</button>
          <span data-period-label style={{ fontWeight: 600, fontSize: 12.5, minWidth: 130, textAlign: "center", color: th.text }}>{label}</span>
          <button type="button" aria-label="later" onClick={() => shift(1)} style={{ font: "inherit", padding: "5px 10px", border: `1px solid ${th.border}`, borderRadius: 6, background: th.panel, cursor: "pointer", color: th.text }}>{"›"}</button>
        </div>
      </div>

      {results && (
        <div data-search-results style={{ marginTop: 12, border: `1px solid ${th.border}`, borderRadius: 10, background: th.panel, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: `1px solid ${th.border}` }}><b style={{ fontSize: 12.5, color: th.text }}>Results for "{q.q}"</b><span style={{ fontSize: 11, color: th.sub }}>{results.pipelines.length} pipelines · {results.runs.length} runs · {results.cases.length} findings and columns</span><span role="button" tabIndex={0} onClick={() => { setText(""); go({ q: null }); }} style={{ marginLeft: "auto", fontSize: 11, color: BLUE, cursor: "pointer" }}>clear</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1, background: th.border }}>
            <div style={{ padding: "10px 14px", background: th.panel }}>{results.pipelines.length === 0 && <div style={{ fontSize: 11.5, color: th.sub }}>no pipeline</div>}{results.pipelines.map((pp) => <div key={pp.id} role="link" tabIndex={0} onClick={() => go({ p: pp.id, q: null })} style={{ fontSize: 12, padding: "4px 0", cursor: "pointer", color: BLUE, display: "flex", gap: 8, alignItems: "center" }}><Dot status={statusOf(pp)} /> {pp.name} <span style={{ color: th.sub, fontFamily: MONO, fontSize: 10.5 }}>{pp.dag_id}</span></div>)}</div>
            <div style={{ padding: "10px 14px", background: th.panel }}>{results.runs.length === 0 && <div style={{ fontSize: 11.5, color: th.sub }}>no run</div>}{results.runs.map(({ p: pp, r }) => <div key={pp.id + r.business_date} role="link" tabIndex={0} onClick={() => go({ p: pp.id, d: r.business_date, q: null })} style={{ fontSize: 12, padding: "4px 0", cursor: "pointer", color: BLUE, display: "flex", gap: 8, alignItems: "center" }}><Dot status={r.status} /> {pp.name} <span style={{ fontFamily: MONO, fontSize: 10.5, color: th.sub }}>{r.business_date}{r.error_code ? ` · ${r.error_code}` : ""}</span></div>)}</div>
            <div style={{ padding: "10px 14px", background: th.panel }}>{results.cases.length === 0 && <div style={{ fontSize: 11.5, color: th.sub }}>no finding</div>}{results.cases.map(({ p: pp, c }) => <div key={pp.id + c.id} role="link" tabIndex={0} onClick={() => go({ p: pp.id, d: (hist[pp.id] || []).slice().reverse().find((r) => (r.cases || []).includes(c.id))?.business_date || null, q: null })} style={{ fontSize: 12, padding: "4px 0", cursor: "pointer", color: BLUE }}><span style={{ fontFamily: MONO, fontSize: 10.5, color: c.status === "info" ? th.sub : RED }}>{c.rule}</span> <span style={{ color: th.sub }}>· {pp.name}</span></div>)}</div>
          </div>
        </div>)}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 10.5, color: th.sub, fontWeight: 700 }}>Channel</span>
        {pill(!q.ch, "All", () => go({ ch: null }))}{CHANNEL_ORDER.map((c) => pill(q.ch === c, CHANNELS[c].name, () => go({ ch: c })))}
        <span style={{ width: 1, height: 18, background: th.border, margin: "0 4px" }} />
        <span style={{ fontSize: 10.5, color: th.sub, fontWeight: 700 }}>Domain</span>
        {pill(!q.dom, "All", () => go({ dom: null }))}{pill(q.dom === "Accounting", "Accounting", () => go({ dom: "Accounting" }))}{pill(q.dom === "Non-accounting", "Non-accounting", () => go({ dom: "Non-accounting" }))}
      </div>

      <div data-kpis style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
        {tile("Pipelines", k.pipelines, `${k.live} live · ${k.planned} not yet`)}
        {tile(period === "day" ? "Runs today" : `Runs this ${period}`, k.runs, `${k.dates} business date${k.dates === 1 ? "" : "s"}`)}
        {tile("Failed runs", k.failed, `${k.failedPct}% of runs`, k.failed ? RED : null)}
        {tile("Dates still open", k.late, k.lateLatest ? `latest ${fmtDay(k.lateLatest)}` : "every date closed", k.late ? AMBER : null)}
        {tile("Bad records", k.bad.toLocaleString(), "held with a reason, nothing dropped")}
        {tile("Red to green", k.failed ? "2 h 10 min" : "n/a", k.failed ? "median, illustrative until live" : "no failures in the period")}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", marginTop: 12 }}>
        <div data-attention style={{ flex: "1 1 400px", minWidth: 0, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${th.border}` }}><b style={{ fontSize: 12.5, color: th.text }}>Needs attention</b><span style={{ fontSize: 11, color: th.sub }}>red and amber in the period, newest first</span></div>
          {att.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12, color: TEAL, fontWeight: 600 }}>Nothing. Every pipeline on its path for the period.</div>}
          {att.map(({ p: pp, r, reason }) => (
            <div key={pp.id + r.business_date} role="link" tabIndex={0} onClick={() => go({ p: pp.id, d: r.business_date })} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 10, alignItems: "start", padding: "9px 14px", borderBottom: `1px solid ${th.border}`, cursor: "pointer" }}>
              <span style={{ marginTop: 4 }}><Dot status={r.status} /></span>
              <span><b style={{ fontSize: 12.5, color: th.text }}>{pp.name}</b> <span style={{ fontSize: 10.5, color: th.sub }}>{CHANNELS[pp.channel].name} · {pp.domain}{r.illustrative ? " · illustrative" : ""}</span><div style={{ fontSize: 11.5, color: th.sub, marginTop: 2 }}>{reason}</div></span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: th.sub }}>{fmtDay(r.business_date)}</span>
            </div>))}
        </div>
        <div data-board style={{ flex: "1 1 300px", minWidth: 0, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${th.border}` }}><b style={{ fontSize: 12.5, color: th.text }}>Business date {fmtDay(board.date)}</b><span style={{ fontSize: 11, fontWeight: 700, color: board.open ? AMBER : TEAL }}>{board.open ? `open · ${board.in} of ${board.total} pipelines in` : `closed · ${board.in} of ${board.total}`}</span></div>
          <div style={{ padding: "10px 14px", display: "grid", gap: 6, fontSize: 12 }}>
            {board.channels.filter((c) => c.total).map((c) => (
              <React.Fragment key={c.ch}>
                <div style={{ display: "flex", justifyContent: "space-between", color: th.text }}><span>{CHANNELS[c.ch].name}</span><span style={{ fontFamily: MONO }}>{c.in} / {c.total}</span></div>
                <div style={{ height: 6, background: th.bg, borderRadius: 3 }}><div style={{ width: `${Math.round(c.in / c.total * 100)}%`, height: 6, background: c.in === c.total ? TEAL : RED, borderRadius: 3 }} /></div>
              </React.Fragment>))}
            {board.outstanding.length > 0 && <div style={{ fontSize: 11, color: th.sub, marginTop: 4 }}>Outstanding: {board.outstanding.join(" · ")}</div>}
          </div>
        </div>
      </div>

      <div data-grid style={{ marginTop: 12, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${th.border}`, flexWrap: "wrap" }}><b style={{ fontSize: 12.5, color: th.text }}>Every pipeline, every business date</b><span style={{ fontSize: 11, color: th.sub }}>click a cell to open that run, a name to open the pipeline</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 10.5, color: th.sub }}>{[["green", "healthy"], ["amber", "warning or late"], ["red", "failed"], ["none", "no run"]].map(([s, w]) => <span key={s}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, background: CELL[s], verticalAlign: -1, marginRight: 4 }} />{w}</span>)}</span></div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820, padding: "6px 14px 12px", display: "grid", gridTemplateColumns: "230px 1fr" }}>
            <div />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${dates.length}, minmax(0,1fr))`, gap: 3, fontFamily: MONO, fontSize: 9.5, color: th.sub, textAlign: "center", paddingBottom: 4 }}>{dates.map((d) => <span key={d}>{Number(d.slice(8))}</span>)}</div>
            {rows.map(({ p: pp, cells }) => (
              <React.Fragment key={pp.id}>
                <div role="link" tabIndex={0} onClick={() => go({ p: pp.id })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderTop: `1px solid ${th.bg}`, cursor: "pointer", fontSize: 12 }}><span style={{ fontSize: 9.5, fontWeight: 700, color: th.sub, width: 56 }}>{CHANNELS[pp.channel].name.replace("Inbound Files", "File").replace("Outbound File", "Out")}</span><span style={{ fontWeight: 600, color: th.text }}>{pp.name}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${dates.length}, minmax(0,1fr))`, gap: 3, alignItems: "center", borderTop: `1px solid ${th.bg}` }}>
                  {cells.map((c) => <span key={c.business_date} role="link" tabIndex={0} title={`${pp.name} · ${c.business_date} · ${STATUS_WORD[c.status] || "no run"}`} onClick={() => c.status !== "none" && c.status !== "planned" && go({ p: pp.id, d: c.business_date })} data-cell={c.status} style={{ display: "block", height: 16, borderRadius: 4, background: CELL[c.status] || CELL.none, cursor: c.status === "none" || c.status === "planned" ? "default" : "pointer" }} />)}
                </div>
              </React.Fragment>))}
          </div>
        </div>
      </div>
    </div>);
}

/* ------------------------------------------------------------------ level 2: pipeline */
function PipelineLevel({ t, th, p, tab, hist, allDates, live, findings, setFindings, go, crumbs }) {
  const view = useMemo(() => pipelineView(p), [p]);
  const rows = (hist[p.id] || []).slice(-20);
  const L = live && live.dags && p.dag_id ? live.dags[p.dag_id] : null;
  const status = L ? L.status : rows[rows.length - 1] ? (rows[rows.length - 1].status === "none" ? statusOf(p) : rows[rows.length - 1].status) : statusOf(p);
  const [filter, setFilter] = useState("all");
  const shown = rows.slice().reverse().filter((r) => filter === "all" ? true : filter === "failed" ? r.status === "red" : filter === "bad" ? (r.bad_rows || 0) > 0 : r.note);
  const maxDur = Math.max(1, ...rows.map((r) => r.duration_s || 0)), maxBad = Math.max(1, ...rows.map((r) => r.bad_rows || 0));
  const tabBtn = (k, label) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => go({ tab: k })} style={{ font: "inherit", fontSize: 12.5, fontWeight: tab === k ? 700 : 600, padding: "9px 16px", border: 0, background: "none", color: tab === k ? th.text : th.sub, borderBottom: `2px solid ${tab === k ? NAVY : "transparent"}`, cursor: "pointer" }}>{label}</button>;
  const latest = rows[rows.length - 1];
  return (
    <div data-level="pipe">
      {crumbs}
      <div style={{ marginTop: 10 }}><PipelineHeader t={t} p={p} status={status} L={L} /></div>
      <div data-history-strip style={{ marginTop: 12, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, padding: "12px 16px 14px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><b style={{ fontSize: 12.5, color: th.text }}>Last {rows.length} business dates</b><span style={{ fontSize: 11, color: th.sub }}>click a dot to open that run</span></div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))`, gap: 4, marginTop: 10 }}>
            {rows.map((r) => <span key={r.business_date} role="link" tabIndex={0} title={`${r.business_date} · ${STATUS_WORD[r.status] || "no run"}`} onClick={() => r.status !== "none" && go({ d: r.business_date })} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}><span style={{ width: 13, height: 13, borderRadius: 13, background: CELL[r.status] || CELL.none, border: r.status === "red" ? `2px solid #fae0e2` : "2px solid transparent" }} /><span style={{ fontFamily: MONO, fontSize: 9, color: th.sub }}>{Number(r.business_date.slice(8))}</span></span>)}
          </div>
          <div style={{ fontSize: 11, color: th.sub, marginTop: 8 }}>{rows.filter((r) => r.status === "green").length} healthy · {rows.filter((r) => r.status === "red").length} failed · {rows.filter((r) => r.status === "amber").length} warning{rows.some((r) => r.illustrative) ? " · illustrative until the first run reports" : ""}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 12.5, color: th.text }}>Run duration</b>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))`, gap: 3, alignItems: "end", height: 54, marginTop: 10 }}>{rows.map((r) => <span key={r.business_date} style={{ display: "block", height: `${Math.max(3, Math.round((r.duration_s || 0) / maxDur * 54))}px`, background: r.status === "red" ? RED : BLUE, borderRadius: "2px 2px 0 0" }} />)}</div>
          <div style={{ fontSize: 11, color: th.sub, marginTop: 6 }}>latest {fmtDur(latest && latest.duration_s)}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 12.5, color: th.text }}>Bad records</b>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))`, gap: 3, alignItems: "end", height: 54, marginTop: 10 }}>{rows.map((r) => <span key={r.business_date} style={{ display: "block", height: `${Math.max(3, Math.round((r.bad_rows || 0) / maxBad * 54))}px`, background: (r.bad_rows || 0) > 0 ? RED : th.border, borderRadius: "2px 2px 0 0" }} />)}</div>
          <div style={{ fontSize: 11, color: th.sub, marginTop: 6 }}>{rows.reduce((a, r) => a + (r.bad_rows || 0), 0).toLocaleString()} held over the period</div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${th.border}`, marginTop: 12 }}>
        <button type="button" onClick={() => latest && go({ d: latest.business_date })} style={{ font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "9px 16px", border: 0, background: "none", color: th.sub, borderBottom: "2px solid transparent", cursor: "pointer" }}>Latest run</button>
        {tabBtn("history", "History")}{tabBtn("lineage", "Lineage")}{tabBtn("about", "About")}
      </div>

      {tab === "history" && (
        <div data-history style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 14px", borderBottom: `1px solid ${th.border}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, color: th.sub, fontWeight: 700 }}>Show</span>
            {[["all", "All runs"], ["failed", "Failed only"], ["bad", "With bad records"], ["note", "With a note"]].map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={{ font: "inherit", fontSize: 11.5, fontWeight: filter === k ? 700 : 500, padding: "4px 11px", borderRadius: 999, border: `1px solid ${filter === k ? NAVY : th.border}`, background: filter === k ? NAVY : th.panel, color: filter === k ? "#fff" : th.text, cursor: "pointer" }}>{l}</button>)}
            <span style={{ marginLeft: "auto", fontSize: 11, color: th.sub }}>{shown.length} of {rows.length} runs</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ textAlign: "left", color: th.sub, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{["Business date", "State", "Duration", "Failed task", "Failing checks", "Bad records", "Date closed", "Note"].map((h) => <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${th.border}` }}>{h}</th>)}</tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.business_date} style={{ borderBottom: `1px solid ${th.bg}` }}>
                  <td style={{ padding: "8px 12px", fontFamily: MONO }}><span role="link" tabIndex={0} onClick={() => r.status !== "none" && go({ d: r.business_date })} style={{ color: BLUE, cursor: "pointer" }}>{r.business_date}</span></td>
                  <td style={{ padding: "8px 12px" }}><Chip bg={r.status === "red" ? "#fae0e2" : r.status === "amber" ? "#fdf1d8" : r.status === "none" ? "#f6f8fa" : "#e6f4f2"} fg={r.status === "red" ? RED : r.status === "amber" ? "#b8800f" : r.status === "none" ? MUTE : TEAL}>{r.status === "none" ? "no run" : STATUS_WORD[r.status]}</Chip></td>
                  <td style={{ padding: "8px 12px", fontFamily: MONO, color: th.text }}>{fmtDur(r.duration_s)}</td>
                  <td style={{ padding: "8px 12px", fontFamily: MONO, color: RED }}>{r.failed_task || ""}{r.error_code ? ` · ${r.error_code}` : ""}</td>
                  <td style={{ padding: "8px 12px", fontFamily: MONO, color: th.text }}>{(r.check_names || []).join(", ") || (r.failing_checks ? r.failing_checks : "")}</td>
                  <td style={{ padding: "8px 12px", fontFamily: MONO, color: (r.bad_rows || 0) ? RED : th.text }}>{r.bad_rows || 0}</td>
                  <td style={{ padding: "8px 12px", color: r.closed === "open" ? AMBER : th.sub }}>{r.closed || ""}</td>
                  <td style={{ padding: "8px 12px", color: th.sub }}>{r.note ? "yes" : ""}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div style={{ padding: "7px 14px", fontSize: 10.5, color: th.sub, borderTop: `1px solid ${th.bg}` }}>Retention 13 months. Rows marked illustrative are the synthetic history shown until the DAG reports.</div>
        </div>)}
      {tab === "lineage" && <div style={{ marginTop: 10 }}><HubWires t={t} graph={view.graph} failed={null} title={`${p.name}: where it lands`} /></div>}
      {tab === "about" && (
        <div data-about style={{ marginTop: 10, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12.5, color: th.text, lineHeight: 1.5, marginBottom: 8 }}>{p.business}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, fontSize: 11, marginBottom: 8 }}>{[["From", p.source], ["To", p.destination], ["How", `${CHANNELS[p.channel].dir} · ${p.cadence}`], ["Volume", p.volume], ["Read by", p.consumers.join(", ")]].map(([k2, v]) => <div key={k2}><div style={{ fontSize: 9.5, fontWeight: 800, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{k2}</div><div style={{ color: th.text }}>{v}</div></div>)}</div>
          <FlowStrip view={view} f={-1} /><DagStrip view={view} fd={-1} />
        </div>)}
    </div>);
}

/* ------------------------------------------------------------------ level 3: run */
function RunLevel({ t, th, p, date, hist, allDates, live, findings, setFindings, go, crumbs }) {
  const view = useMemo(() => pipelineView(p), [p]);
  const rows = hist[p.id] || [];
  const r = rows.find((x) => x.business_date === date) || null;
  const L = live && live.dags && p.dag_id ? live.dags[p.dag_id] : null;
  const liveForDate = L && L.run && L.run.business_date === date ? L : null;
  useEffect(() => {
    if (!liveForDate || !p.dag_id || findings[p.dag_id + ":" + date]) return;
    integration360Api.findings(p.dag_id, { business_date: date }).then((res) => setFindings((f) => ({ ...f, [p.dag_id + ":" + date]: res.findings || [] }))).catch(() => {});
  }, [liveForDate, p.dag_id, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveCases = useLiveCases(p, view, liveForDate, { [p.dag_id]: findings[p.dag_id + ":" + date] || [] });
  const cases = liveForDate ? liveCases : view.cases.filter((c) => (r && r.cases ? r.cases.includes(c.id) : false));
  const [scen, setScen] = useState(null);
  const S = cases.find((x) => x.id === scen) || cases[0] || null;
  const status = r ? r.status : "none";
  const i = allDates.indexOf(date);
  const prevD = i > 0 ? allDates[i - 1] : null, nextD = i >= 0 && i < allDates.length - 1 ? allDates[i + 1] : null;
  const [note, setNote] = useState({ root_cause: S && S.cause ? S.cause : "", action: S ? S.i360 : "", saved: "" });
  const save = () => { integration360Api.note({ dag_id: p.dag_id || p.id, finding_key: S ? S.id : null, root_cause: note.root_cause, action: note.action, author: "" }).then(() => setNote((n) => ({ ...n, saved: "saved" }))).catch(() => setNote((n) => ({ ...n, saved: "kept here; the API did not answer" }))); };
  const copyLink = () => { try { navigator.clipboard?.writeText(typeof window !== "undefined" ? window.location.href : ""); } catch { /* no clipboard */ } };
  return (
    <div data-level="run">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {crumbs}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" disabled={!prevD} onClick={() => prevD && go({ d: prevD })} style={{ font: "inherit", fontSize: 12, padding: "5px 11px", border: `1px solid ${th.border}`, borderRadius: 6, background: th.panel, color: prevD ? th.text : MUTE, cursor: prevD ? "pointer" : "default" }}>{"‹"} {prevD ? fmtDay(prevD) : ""}</button>
          <span style={{ fontSize: 10.5, color: th.sub }}>business date</span>
          <button type="button" disabled={!nextD} onClick={() => nextD && go({ d: nextD })} style={{ font: "inherit", fontSize: 12, padding: "5px 11px", border: `1px solid ${th.border}`, borderRadius: 6, background: th.panel, color: nextD ? th.text : MUTE, cursor: nextD ? "pointer" : "default" }}>{nextD ? fmtDay(nextD) : ""} {"›"}</button>
          <button type="button" onClick={copyLink} style={{ font: "inherit", fontSize: 12, padding: "5px 11px", border: `1px solid ${th.border}`, borderRadius: 6, background: th.panel, color: th.text, cursor: "pointer" }}>Copy link</button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}><PipelineHeader t={t} p={p} status={status === "none" ? statusOf(p) : status} L={liveForDate} compact /></div>
      <div data-run-line style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8, fontSize: 11.5, color: th.sub }}>
        <b style={{ color: th.text, fontFamily: MONO }}>{date}</b>
        {r && r.status !== "none" ? <>
          <Chip bg={r.status === "red" ? "#fae0e2" : r.status === "amber" ? "#fdf1d8" : "#e6f4f2"} fg={r.status === "red" ? RED : r.status === "amber" ? "#b8800f" : TEAL}>{(r.state || STATUS_WORD[r.status] || "").toUpperCase()}</Chip>
          <span>{fmtDur(r.duration_s)}{r.failed_task ? ` · stopped at ${r.failed_task}` : ""}{r.closed ? ` · date ${r.closed === "open" ? "still open" : `closed ${r.closed}`}` : ""}{r.illustrative ? " · illustrative" : " · live"}</span>
        </> : <span>no run recorded for this business date</span>}
        {S && !S.live && <span role="link" tabIndex={0} onClick={() => { try { window.location.hash = "hub"; } catch { /* no window */ } }} style={{ marginLeft: "auto", color: BLUE, cursor: "pointer" }}>Replay this scenario in the Business view</span>}
      </div>
      <RunDetail t={t} p={p} view={view} S={S} cases={cases} onPickCase={setScen} L={liveForDate} folded />
      <div data-notes style={{ marginTop: 10, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${th.border}` }}><b style={{ fontSize: 12.5, color: th.text }}>Notes on this run</b><span style={{ fontSize: 11, color: th.sub }}>kept with the run; shown in History</span></div>
        <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}><label htmlFor="i360rc" style={{ fontSize: 10.5, fontWeight: 700, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>Root cause</label><textarea id="i360rc" rows={3} value={note.root_cause} onChange={(e) => setNote({ ...note, root_cause: e.target.value, saved: "" })} style={{ font: "inherit", fontSize: 12, padding: "8px 10px", border: `1px solid ${th.border}`, borderRadius: 6, resize: "vertical", background: th.panel, color: th.text }} /></div>
          <div style={{ display: "grid", gap: 4 }}><label htmlFor="i360ac" style={{ fontSize: 10.5, fontWeight: 700, color: th.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>Action</label><textarea id="i360ac" rows={3} value={note.action} onChange={(e) => setNote({ ...note, action: e.target.value, saved: "" })} style={{ font: "inherit", fontSize: 12, padding: "8px 10px", border: `1px solid ${th.border}`, borderRadius: 6, resize: "vertical", background: th.panel, color: th.text }} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 12px" }}><button type="button" onClick={save} style={{ font: "inherit", fontSize: 12, fontWeight: 700, padding: "7px 14px", border: 0, borderRadius: 6, background: NAVY, color: "#fff", cursor: "pointer" }}>Save note</button><span style={{ fontSize: 11, color: th.sub }}>{note.saved}</span></div>
      </div>
    </div>);
}
