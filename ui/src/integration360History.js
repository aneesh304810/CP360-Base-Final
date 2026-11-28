// Integration 360 console: the history, the dashboard numbers, search and the
// address in the URL. Pure functions; the console renders them. Live history
// comes from /integration360/history; until a pipeline has reported, a
// synthetic history is built from its illustrative cases so the dashboard
// and the month grid have a shape, and every such row says it is illustrative.
import { PIPELINES, statusOf, pipelineView } from "./hubPipelines.js";

/** The last n business dates (weekdays) up to and including `today`, oldest first, as YYYY-MM-DD. */
export function businessDates(n, today = new Date()) {
  const out = [];
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/** Deterministic small variation per pipeline and date, so the synthetic history is stable between renders. */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

/** A synthetic history for one pipeline over the dates: its cases on the latest date (a warning case one day earlier), green elsewhere. */
export function syntheticHistory(p, dates) {
  const view = pipelineView(p);
  const last = dates[dates.length - 1], prev = dates[dates.length - 2];
  return dates.map((bd) => {
    const r = hash(`${p.id}:${bd}`);
    const failing = view.cases.filter((c) => (c.status === "warning" ? bd === prev : bd === last));
    const status = p.planned ? "planned" : failing.some((c) => c.status === "failed") ? "red" : failing.length ? "amber" : "green";
    const base = p.channel === "event" ? 4 : p.channel === "api" ? 0.1 : p.channel === "outbound" ? 3 : 11;
    const dur = p.planned ? null : Math.round((base + (r - 0.5) * base * 0.4) * 60);
    return {
      business_date: bd, illustrative: true, status, state: status === "red" ? "failed" : p.planned ? null : "success",
      duration_s: status === "red" ? Math.round(dur * 0.55) : dur, rows: p.planned ? null : Math.round((p.volumeRows || 12000) * (0.97 + r * 0.06)),
      failed_task: status === "red" && failing[0] ? view.dag[failing[0].dagTask][0] : null, error_code: status === "red" && failing[0] && /^[A-Z_]+$/.test(failing[0].rule) ? failing[0].rule : null,
      failing_checks: failing.filter((c) => c.status === "failed").length, check_names: failing.map((c) => c.rule).slice(0, 3), warnings: failing.filter((c) => c.status === "warning").length,
      bad_rows: failing.reduce((a, c) => a + (c.bad || 0), 0), note: status !== "green" && status !== "planned", closed: status === "red" ? "open" : p.planned ? null : `18:${String(36 + Math.floor(r * 12)).padStart(2, "0")}`,
      cases: failing.map((c) => c.id),
    };
  });
}

/** Live rows laid over the synthetic ones: a dag that has reported replaces its synthetic history entirely. */
export function mergeHistory(dates, liveHist) {
  const out = {};
  for (const p of PIPELINES) {
    const live = liveHist && liveHist.dags && p.dag_id ? liveHist.dags[p.dag_id] : null;
    if (live && live.length) {
      const byDate = Object.fromEntries(live.map((r) => [r.business_date, { ...r, illustrative: false, closed: r.state === "failed" ? "open" : r.ended_at ? String(r.ended_at).slice(11, 16) : null }]));
      out[p.id] = dates.map((bd) => byDate[bd] || { business_date: bd, illustrative: false, status: "none", state: null, duration_s: null, failing_checks: 0, warnings: 0, bad_rows: 0, note: false, cases: [] });
    } else {
      out[p.id] = syntheticHistory(p, dates);
    }
  }
  return out;
}

export const STATUS_RANK = { red: 3, amber: 2, green: 1, planned: 0, none: 0 };

/** The dashboard numbers for a set of dates. */
export function kpis(hist, dates) {
  const set = new Set(dates);
  let runs = 0, failed = 0, late = 0, bad = 0, lateLatest = null;
  const reds = [];
  for (const rows of Object.values(hist)) {
    for (const r of rows) {
      if (!set.has(r.business_date) || r.status === "planned" || r.status === "none") continue;
      runs += 1;
      if (r.status === "red") { failed += 1; reds.push(r); }
      if (r.closed === "open") { late += 1; if (!lateLatest || r.business_date > lateLatest) lateLatest = r.business_date; }
      bad += r.bad_rows || 0;
    }
  }
  const livePipes = PIPELINES.filter((p) => (hist[p.id] || []).some((r) => r.illustrative === false)).length;
  return { pipelines: PIPELINES.length, live: livePipes, planned: PIPELINES.filter((p) => p.planned).length, runs, failed, failedPct: runs ? Math.round(failed / runs * 1000) / 10 : 0, late, lateLatest, bad, dates: dates.length };
}

/** Red and amber rows across pipelines for the dates, newest first, with the pipeline and its first reason. */
export function attention(hist, dates, limit = 8) {
  const set = new Set(dates), out = [];
  for (const p of PIPELINES) {
    for (const r of hist[p.id] || []) {
      if (!set.has(r.business_date) || (r.status !== "red" && r.status !== "amber")) continue;
      const view = pipelineView(p);
      const c = (r.cases || []).map((id) => view.cases.find((x) => x.id === id)).find(Boolean);
      out.push({ p, r, reason: c ? c.message : r.failed_task ? `task ${r.failed_task} failed${r.error_code ? `: ${r.error_code}` : ""}` : r.check_names && r.check_names.length ? `${r.failing_checks || r.warnings} check${(r.failing_checks || r.warnings) === 1 ? "" : "s"}: ${r.check_names.join(", ")}` : "needs a look" });
    }
  }
  return out.sort((a, b) => (b.r.business_date.localeCompare(a.r.business_date)) || (STATUS_RANK[b.r.status] - STATUS_RANK[a.r.status])).slice(0, limit);
}

/** The board for one business date: what is in, what is outstanding, across the channels. */
export function dayBoard(hist, bd) {
  const rows = PIPELINES.map((p) => ({ p, r: (hist[p.id] || []).find((x) => x.business_date === bd) })).filter((x) => x.r && x.r.status !== "planned" && x.r.status !== "none");
  const by = (ch) => rows.filter((x) => x.p.channel === ch);
  const done = (xs) => xs.filter((x) => x.r.status === "green" || x.r.status === "amber").length;
  const outstanding = rows.filter((x) => x.r.status === "red").map((x) => x.p.name);
  return { date: bd, open: outstanding.length > 0, total: rows.length, in: done(rows), channels: ["event", "file", "api", "outbound"].map((ch) => ({ ch, total: by(ch).length, in: done(by(ch)) })), outstanding };
}

/** Search across pipelines, their runs and their cases by identifier. Returns {pipelines, runs, cases}. */
export function searchAll(q, hist, dates) {
  const s = String(q || "").trim().toLowerCase();
  if (s.length < 2) return { pipelines: [], runs: [], cases: [] };
  const hit = (v) => String(v || "").toLowerCase().includes(s);
  const pipelines = PIPELINES.filter((p) => [p.name, p.dag_id, p.source, p.destination, p.file, p.raw, p.stg, p.int, p.target].some(hit));
  const runs = [], cases = [];
  for (const p of PIPELINES) {
    const view = pipelineView(p);
    for (const r of hist[p.id] || []) {
      if (!dates.includes(r.business_date) || r.status === "none" || r.status === "planned") continue;
      if (hit(r.business_date) || hit(r.failed_task) || hit(r.error_code) || (r.check_names || []).some(hit)) runs.push({ p, r });
    }
    for (const c of view.cases) if ([c.id, c.rule, c.message, c.cause, c.column, c.engine, c.dag, JSON.stringify(c.sample || [])].some(hit)) cases.push({ p, c });
    for (const n of view.graph.nodes) if (hit(n.column) && !cases.some((x) => x.p === p && x.c.column === n.id)) cases.push({ p, c: { id: n.id, rule: `column ${n.table}.${n.column}`, message: "in this pipeline's lineage", column: n.id, status: "info" } });
  }
  return { pipelines, runs: runs.slice(0, 50), cases: cases.slice(0, 50) };
}

/** Month grid cells: for each pipeline, one per date in `dates`. */
export const gridRows = (hist, dates) => PIPELINES.map((p) => ({ p, cells: dates.map((bd) => (hist[p.id] || []).find((r) => r.business_date === bd) || { business_date: bd, status: "none" }) }));

/** Dates for a period ending on `end` (YYYY-MM-DD): day = 1, week = 5, month = the calendar month's business days up to end. */
export function periodDates(period, end, allDates) {
  if (period === "day") return [end];
  if (period === "week") { const i = allDates.indexOf(end); return allDates.slice(Math.max(0, i - 4), i + 1); }
  return allDates.filter((d) => d.slice(0, 7) === end.slice(0, 7) && d <= end);
}

/* ---- the address: #guardrails?p=<pipeline>&d=<date>&tab=<tab>&q=<search>&period=<day|week|month>&end=<date> ---- */
export function readQuery(hash) {
  const q = String(hash || "").split("?")[1] || "";
  const out = {};
  q.split("&").filter(Boolean).forEach((kv) => { const [k, v] = kv.split("="); out[decodeURIComponent(k)] = decodeURIComponent(v || ""); });
  return out;
}
export function writeQuery(hash, patch) {
  const [route, q] = String(hash || "#guardrails").split("?");
  const cur = readQuery(`x?${q || ""}`);
  Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === "") delete cur[k]; else cur[k] = String(v); });
  const qs = Object.entries(cur).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return qs ? `${route}?${qs}` : route;
}
/** Which level the address names: dash, pipe or run. */
export const levelOf = (q) => (q.p && q.d ? "run" : q.p ? "pipe" : "dash");

export const fmtDur = (s) => (s == null ? "" : s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
export const fmtDay = (bd) => { const [y, m, d] = bd.split("-"); return `${Number(d)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]}${y ? "" : ""}`; };
export const fmtMonth = (bd) => { const [y, m] = bd.split("-"); return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(m) - 1]} ${y}`; };
export { statusOf };
