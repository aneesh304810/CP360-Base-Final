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

  // The business dashboard's rollup, added up server-side. Four tiles, a
  // stacked bar and two bar panels all have to agree; a page that sums the
  // same rows four times eventually disagrees with itself.
  businessSummary: (data_source) =>
    _get(`/sei-crosswalk/business-summary${_qs({ data_source })}`,
      () => ({ data_source, scored: false,
               scope: { in_scope: 0, out_of_scope: 0, no_baseline: 0, total: 0 },
               buckets: { ready: 0, diff: 0, open: 0, none: 0 },
               has_datapoint: 0, divergence: [],
               open: { unchecked: 0, undecided: 0, exceptions: 0, draft_rules: 0 },
               owners: [], unowned: 0, unbucketed: [],
               ceiling: { blocked: false, reason: "" } })),

  laneSystems: (data_source) =>
    _get(`/sei-crosswalk/lane-systems${_qs({ data_source })}`,
      () => ({ data_source, systems: [] })),

  // What one lane actually contains, so the badge can filter rather than
  // relabel. The UI filters on safe_to_filter, never on resolved: resolved
  // only says the question was answerable, and a partial answer filters out
  // rows nothing has claimed. The fallback says "do not filter".
  laneScope: (system, data_source) =>
    _get(`/sei-crosswalk/lane-scope${_qs({ system, data_source })}`,
      () => ({ data_source, source_system: system, resolved: false,
               safe_to_filter: false, complete: false, lanes: 0,
               attributed: 0, lineage_rows: 0,
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

  // What a source column MEANS, from whichever of the five loaded
  // dictionaries has it — not just the AddVantage master.
  fieldDefinition: (code, data_source, src_table) =>
    _get(`/sei-crosswalk/field-definition${_qs({ code, data_source, src_table })}`,
      () => ({ code, definition: null, source: null, searched: [],
               empty_sources: [] })),

  // The whole chain for one column, both eras, rule on every hop.
  columnChain: (table, column, data_source) =>
    _get(`/sei-crosswalk/column-chain${_qs({ table, column, data_source })}`,
      () => ({ table, column, legacy: [], sei: [], xform: [], compare: [],
               review: null })),

  xformReviews: (data_source) =>
    _get(`/sei-crosswalk/xform-reviews${_qs({ data_source })}`,
      () => ({ by_verdict: [], rows: [], count: 0, disagreements: [],
               disagreement_count: 0 })),

  // Write. Returns {ok:false,error} rather than throwing, so the caller
  // renders the reason instead of a blank.
  saveXformReview: async (body) => {
    try {
      const r = await fetch(`${API_BASE}/sei-crosswalk/xform-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      return await r.json();
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  },

  // Identifiers inside a rule -> the STAR fields they name. The numeric
  // suffix is an ordinal, so a token can be confirmed by two facts.
  resolveTokens: (tokens, data_source) =>
    _get(`/sei-crosswalk/resolve-tokens${_qs({
          tokens: (tokens || []).join(","), data_source })}`,
      () => ({ tokens: [], resolved: 0, confirmed: 0, layout_rows: 0 })),

  // One feed, every warehouse column it writes, with the rules attached.
  // Raw transform text — the UI's parser is the single classifier.
  sourceCanvas: (src_table, data_source) =>
    _get(`/sei-crosswalk/source-canvas${_qs({ src_table, data_source })}`,
      () => ({ src_table, feed: {}, targets: [], source_columns: [],
               column_count: 0,
               // the fallback is itself a diagnosis: the call did not answer
               diagnostics: { ok: false, missing: [], near_names: [],
                 reason: "The lineage service did not answer, so this is not "
                       + "a statement about the feed." } })),

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

// The export. A URL rather than a fetch: the browser's own download
// machinery handles the file, the progress and the Save dialog, and
// nothing has to buffer a 20,000-row workbook in a JavaScript string.
export function columnsXlsxUrl(params) {
  return `${API_BASE}/sei-crosswalk/columns.xlsx${_qs(params || {})}`;
}

// ---- STAR field usage ----------------------------------------------
// Which published STAR fields anybody actually reads. Its own tab rather
// than a column on the verdict table, because usage decides nothing: a
// field nobody reads today is still a field the contract publishes, and
// putting it beside a verdict would invite the reader to subtract it.
export const starUsage = {
  health: (data_source) =>
    _get(`/sei-crosswalk/star-usage/health${_qs({ data_source })}`,
      () => ({ data_source, loaded: false, tables: {}, families: 0,
               disagreements: [] })),
  summary: (data_source) =>
    _get(`/sei-crosswalk/star-usage/summary${_qs({ data_source })}`,
      () => ({ data_source, families: [], totals: { families: 0, published: 0,
               used: 0, unused: 0, used_percent: null, unknown: 0 } })),
  fields: (data_source, feed_family, status, limit) =>
    _get(`/sei-crosswalk/star-usage/fields${_qs({ data_source, feed_family, status, limit })}`,
      () => ({ fields: [] })),
  coverage: (data_source) =>
    _get(`/sei-crosswalk/star-usage/coverage${_qs({ data_source })}`,
      () => ({ data_source, open_items: 0,
               open_items_on_unused_fields: null, matched_on: null,
               open_items_note: "The API did not answer." })),
  recon: (data_source, recon_type) =>
    _get(`/sei-crosswalk/star-usage/recon${_qs({ data_source, recon_type })}`,
      () => ({ by_type: [], rows: [] })),
};

// ---- the mapping documents (sql/79) ------------------------------------
// Three lanes of field maps (SEI -> STAR, STAR -> IMDS, end to end), the
// register they came from, the reference-code crosswalk, the Entity ID
// derivation and the usage disagreements. Every row is DRAFT until the
// workbook says otherwise; the client carries no opinion about that.
export const mappingDocs = {
  register: (data_source) =>
    _get(`/sei-crosswalk/mapping-docs${_qs({ data_source })}`,
      () => ({ docs: [], totals: { documents: 0, s2s_rows: 0, e2e_rows: 0 }, by_mapping_status: [], by_map_kind: [], headline: "" })),
  e2eCoverage: (data_source) =>
    _get(`/sei-crosswalk/e2e-coverage${_qs({ data_source })}`,
      () => ({ total: 0, covered: 0, coverage_pct: null, by_link: [], by_status: [], by_approval: [], tables: [], feeds: [], headline: "" })),
  e2eRows: (o = {}) =>
    _get(`/sei-crosswalk/e2e-rows${_qs(o)}`, () => ({ rows: [], total: 0 })),
  feedSeiFiles: (feed, data_source) =>
    _get(`/sei-crosswalk/feed-sei-files${_qs({ feed, data_source })}`, () => ({ fields: [], files: [], totals: {}, headline: "" })),
  lineageSummary: (data_source) =>
    _get(`/sei-crosswalk/lineage-summary${_qs({ data_source })}`, () => ({ rows: [], total: {}, sheet: [] })),
  transformationSummary: (data_source) =>
    _get(`/sei-crosswalk/transformation-summary${_qs({ data_source })}`,
      () => ({ tables: [], total: 0, covered: 0, coverage_pct: null, by_completeness: [], by_approval: [], headline: "" })),
  referenceCodes: (data_source, code_set) =>
    _get(`/sei-crosswalk/reference-codes${_qs({ data_source, code_set })}`,
      () => ({ rows: [], total: 0, by_set: [], mapped: 0 })),
  entityId: (data_source) =>
    _get(`/sei-crosswalk/entity-id${_qs({ data_source })}`, () => ({ feeds: [], total: 0 })),
  usageExceptions: (data_source, result, feed) =>
    _get(`/sei-crosswalk/usage-exceptions${_qs({ data_source, result, feed })}`,
      () => ({ rows: [], total: 0, by_result: [], by_feed: [], note: "" })),
  // The candidate paths in the ribbon's own shape: SEI object -> STAR feed
  // -> IMDS table, left links grouped by link class, SEI-direct as bypass.
  // The cutover, one row per IMDS column of a feed: the column keeps its
  // transformation, the STAR input is replaced by the SEI source.
  cutoverLineage: (data_source, feed, q) =>
    _get(`/sei-crosswalk/cutover-lineage${_qs({ data_source, feed, q })}`,
      () => ({ feeds: [], columns: [], feed: null, totals: {} })),
  flowCandidates: (data_source) =>
    _get(`/sei-crosswalk/flow-candidates${_qs({ data_source })}`,
      () => ({ left: [], right: [], bypass: [], total: 0 })),
};
export const LINK_INFO = {
  E2E:                  { t: "linked end to end",      c: "#159943", bg: "#d0ebd9" },
  SEI_DIRECT:           { t: "SEI straight to IMDS",   c: "#0091bf", bg: "#e0f5fd" },
  STAR_NOT_IN_FILE_MAP: { t: "STAR field not in map",  c: "#7c3aed", bg: "#efe6fb" },
  NO_SEI_SOURCE:        { t: "no SEI source",          c: "#c1113a", bg: "#f3d2d7" },
  STAR_ONLY:            { t: "no IMDS target",         c: "#6b7c8a", bg: "#eef2f5" },
  NOT_POPULATED:        { t: "not loaded by STAR",     c: "#9aa5b1", bg: "#f1f3f5" },
};
export const LINK_ORDER = ["E2E", "SEI_DIRECT", "STAR_NOT_IN_FILE_MAP", "NO_SEI_SOURCE", "STAR_ONLY", "NOT_POPULATED"];
// The two v4 shapes that are not paths to cover: an orphan STAR field loads
// nothing; a column the STAR load never writes has nothing to replace.
export const OUT_OF_SCOPE = ["STAR_ONLY", "NOT_POPULATED"];
// v4: how well the SEI source resolved to a published SEI feed file.
export const FILE_STATUS_INFO = {
  VERIFIED_IN_FEED_SPEC:      { t: "verified in the feed spec", c: "#159943" },
  PARTIALLY_VERIFIED:         { t: "partly verified",           c: "#5fa36b" },
  FILE_ONLY_NO_FIELD:         { t: "file known, field not",     c: "#0091bf" },
  SYSTEM_OR_CONSTANT:         { t: "system or constant",        c: "#5f87a7" },
  DERIVED_AT_RUNTIME:         { t: "derived at run time",       c: "#5f87a7" },
  FIELD_NOT_IN_FEED_SPEC:     { t: "field not in the feed spec", c: "#e67e22" },
  NOT_AVAILABLE_IN_SEI_FEEDS: { t: "not in any SEI feed",       c: "#c1113a" },
  UNRESOLVED:                 { t: "unresolved",                c: "#b45309" },
  NO_SEI_SOURCE:              { t: "no SEI source",             c: "#c1113a" },
};
export const FILE_STATUS_ORDER = Object.keys(FILE_STATUS_INFO);
export const fileStatusLabel = (k) => (FILE_STATUS_INFO[k] || {}).t || String(k || "").toLowerCase().replace(/_/g, " ");
// The ribbon's vocabulary when it draws the mapping documents' candidate
// paths instead of the proposals: link classes, in paths, every one a draft.
export const CANDIDATE_VOCAB = {
  info: LINK_INFO, order: LINK_ORDER, unit: "paths", noSource: "NO_SEI_SOURCE",
  short: (k) => ({
    E2E: "The document maps a SEI source onto a STAR field, and that STAR field feeds the IMDS column.",
    SEI_DIRECT: "The document maps the SEI source straight onto the IMDS column, with no STAR field between.",
    STAR_NOT_IN_FILE_MAP: "The IMDS column is fed by a STAR field the file map does not have.",
    NO_SEI_SOURCE: "No SEI source is named for this path. The gap.",
    STAR_ONLY: "A STAR field with no IMDS target on this row.",
    NOT_POPULATED: "An IMDS column the STAR load never writes. Nothing to replace.",
  }[k] || k),
  bypass: "SEI straight to IMDS, no STAR field (dashed)",
  bypassShort: "DIRECT_SEI_TO_IMDS: the document maps the SEI source onto the IMDS column without a STAR field between.",
};
// How a column's rule fares when STAR becomes SEI.
export const RULE_STATE = {
  SAME:         { t: "same rule",            c: "#159943", hint: "the SEI-equivalent logic is the legacy logic, verbatim" },
  SUBSTITUTED:  { t: "same rule, SEI input", c: "#159943", hint: "the legacy logic with the STAR input swapped for the SEI input" },
  PASS_THROUGH: { t: "copied as is",         c: "#5f87a7", hint: "no rule on either side: the value is copied" },
  ALTERNATIVES: { t: "two SEI versions",     c: "#e67e22", hint: "the document gives two SEI versions (-- ALT:)" },
  REWRITTEN:    { t: "rewritten",            c: "#e67e22", hint: "a different rule on the SEI side" },
  NEW_RULE:     { t: "new rule",             c: "#7c3aed", hint: "no legacy rule; a SEI one" },
  NO_SEI_RULE:  { t: "no SEI rule",          c: "#c1113a", hint: "a legacy rule and nothing on the SEI side" },
};
export const RULE_STATE_ORDER = ["SAME", "SUBSTITUTED", "PASS_THROUGH", "ALTERNATIVES", "REWRITTEN", "NEW_RULE", "NO_SEI_RULE"];
export const COMPLETENESS_INFO = {
  BOTH_LOGICS_DOCUMENTED:             { t: "both logics",          c: "#159943" },
  IM_LOGIC_AND_SEI_SOURCE_DOCUMENTED: { t: "IM logic + SEI source", c: "#0091bf" },
  SEI_ONLY_DOCUMENTED:                { t: "SEI only",             c: "#5f87a7" },
  IM_ONLY_DOCUMENTED:                 { t: "IM only",              c: "#e67e22" },
  NO_MAPPING:                         { t: "no mapping",           c: "#c1113a" },
};

export const LANE_C = { STAR: "#b5651d", UAF: "#0b7d7d", SEI: "#0091bf",
                        ADDVANTAGE: "#6d3ac0", CRD: "#0b7d7d" };

export default crosswalkApi;
