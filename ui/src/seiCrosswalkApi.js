// SEI crosswalk API client.
//
// Same house pattern as lineage_api_additions.js, and for the same reason
// that file spells out: nothing here touches api.js. api.js is ahead in
// working copies and behind in the repo, and editing it means a pull can
// replace a good file with a stale one plus these additions, killing the page
// on mount. CrosswalkDashboard imports from here directly.
//
// Every call tries LIVE and falls back to a safe empty shape, so a warehouse
// with no crosswalk loaded renders its own "nothing here" state instead of
// throwing. That fallback is also what keeps PBDW unchanged: no rows, empty
// payload, the dashboard never mounts.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return fallback();
  }
}

const _qs = (o) => {
  const q = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const crosswalkApi = {
  summary: (data_source) =>
    _get(`/sei-crosswalk/summary${_qs({ data_source })}`,
      () => ({ data_source, total_columns: 0, in_denominator: 0, mapped: 0,
               proven: 0, no_source: 0, out_of_scope: 0, dual_source: 0,
               divergent: 0, undecided_dispositions: 0, open_exceptions: 0,
               verdicts: [], ceiling: { blocked: false, reason: "" } })),

  laneSystems: (data_source) =>
    _get(`/sei-crosswalk/lane-systems${_qs({ data_source })}`,
      () => ({ data_source, systems: [] })),

  // What one lane actually contains, so the badge can filter rather than
  // relabel. resolved:false means "could not answer" — show everything, not
  // nothing. The safe fallback below says exactly that.
  laneScope: (system, data_source) =>
    _get(`/sei-crosswalk/lane-scope${_qs({ system, data_source })}`,
      () => ({ data_source, source_system: system, resolved: false,
               route: "none", src_tables: [], target_tables: [], columns: 0 })),

  // The three-column ribbon diagram. `left` is grouped by verdict as well as
  // by node, so a ribbon can be drawn as bands rather than as one grey mass.
  flow: (data_source) =>
    _get(`/sei-crosswalk/flow${_qs({ data_source })}`,
      () => ({ left: [], right: [], bypass: [] })),

  // Why nothing is proven — each side of the match, separately.
  evidence: (data_source) =>
    _get(`/sei-crosswalk/evidence${_qs({ data_source })}`,
      () => ({ rows: [], blocked: 0, of: 0, headline: "" })),

  // One cell per final column, in the table's own column order.
  waffle: (data_source) =>
    _get(`/sei-crosswalk/waffle${_qs({ data_source })}`,
      () => ({ tables: [], table_count: 0, cells: 0 })),

  // Does the SEI rule COMPUTE the same value? A later question than "is
  // there a datapoint" and a different one from "does the type match".
  transformations: (data_source) =>
    _get(`/sei-crosswalk/transformations${_qs({ data_source })}`,
      () => ({ total: 0, approved: 0, exact_text: 0, no_sei_source: 0,
               equivalence: [], approval: [], layers: [], rows: [],
               headline: "" })),

  // The workbook's own account of what it does and does not establish.
  controls: (data_source) =>
    _get(`/sei-crosswalk/controls${_qs({ data_source })}`,
      () => ({ sheets: {}, count: 0, blocked: [], blocked_count: 0 })),

  // Feed code -> what the feed actually is. PEDDIFI1 is the portfolio
  // valuation; three cards reading "STAR outbound dataset" said nothing.
  feedNames: (data_source) =>
    _get(`/sei-crosswalk/feed-names${_qs({ data_source })}`,
      () => ({ feeds: [], count: 0, unnamed: [], unnamed_count: 0,
               orphans: [] })),

  lanes: (data_source) =>
    _get(`/sei-crosswalk/lanes${_qs({ data_source })}`, () => ({ lanes: [] })),

  columns: (o = {}) =>
    _get(`/sei-crosswalk/columns${_qs(o)}`, () => ({ columns: [], count: 0 })),

  column: (table, column, data_source) =>
    _get(`/sei-crosswalk/column${_qs({ table, column, data_source })}`,
      () => ({ table, column, verdicts: [], chain: [], contract: [], maps: [],
               collapse: [], dual_source: [], disposition: [] })),

  divergence: (data_source) =>
    _get(`/sei-crosswalk/divergence${_qs({ data_source })}`,
      () => ({ shapes: [], collapse: [], dual_source: [] })),

  catalog: (data_source) =>
    _get(`/sei-crosswalk/catalog${_qs({ data_source })}`,
      () => ({ checked: 0, inbound_fields: 0, absent_count: 0, ambiguous_count: 0,
               by_result: [], absent: [], caveat: "" })),

  readiness: (data_source) =>
    _get(`/sei-crosswalk/readiness${_qs({ data_source })}`, () => ({ tables: [] })),

  exceptions: (data_source) =>
    _get(`/sei-crosswalk/exceptions${_qs({ data_source })}`,
      () => ({ exceptions: [], by_owner: [] })),
};

// Verdict vocabulary — the single place the UI agrees with the loader about
// what a verdict is called and what colour it is.
export const VERDICT = {
  PROVEN_MATCH:   { t: "PROVEN",        c: "#159943", bg: "#d0ebd9" },
  UNKNOWN:        { t: "UNKNOWN",       c: "#6b7c8a", bg: "#eef2f5" },
  DECODE_NEEDED:  { t: "DECODE",        c: "#7c3aed", bg: "#efe6fb" },
  PRECISION_RISK: { t: "PRECISION",     c: "#c1113a", bg: "#f3d2d7" },
  TYPE_SHIFT:     { t: "TYPE SHIFT",    c: "#c1113a", bg: "#f3d2d7" },
  NOT_COMPARABLE: { t: "COMPOSITE",     c: "#e67e22", bg: "#fae5d3" },
  NO_SOURCE:      { t: "NO SOURCE",     c: "#c1113a", bg: "#f3d2d7" },
  NO_BASELINE:    { t: "NO BASELINE",   c: "#b45309", bg: "#f7e9d6" },
  OUT_OF_SCOPE:   { t: "OUT OF SCOPE",  c: "#5f87a7", bg: "#cae3ee" },
};
export const VERDICT_ORDER = ["PROVEN_MATCH", "UNKNOWN", "DECODE_NEEDED",
  "PRECISION_RISK", "TYPE_SHIFT", "NOT_COMPARABLE", "NO_SOURCE",
  "NO_BASELINE", "OUT_OF_SCOPE"];

export const LANE_C = { STAR: "#b5651d", UAF: "#0b7d7d", SEI: "#0091bf",
                        ADDVANTAGE: "#6d3ac0", CRD: "#0b7d7d" };

export default crosswalkApi;
