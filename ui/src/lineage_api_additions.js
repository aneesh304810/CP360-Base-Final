// Lineage additions — the source-first drill and the column-level graph.
//
// House pattern, same as env360_infra_api_additions.js: self-contained, tries
// LIVE first, falls back to a safe empty shape so the panel renders its own
// "nothing here" state instead of throwing.
//
// WHY THIS IS A SEPARATE FILE AND NOT api.js
//
// These four calls were originally added straight into ui/src/api.js. That
// broke the Lineage page on a machine that pulled the branch:
//
//   Uncaught TypeError: api.legacySystems is not a function
//     at LineageHome.jsx:50
//
// api.js is ahead in working copies and behind in the repo — the committed
// copy has none of legacySystems, legacyLineageTables, legacyBusinessDef,
// legacyWhereUsed, legacyDictionary, legacyDataSources,
// legacyDependencyNetwork, legacyLineageFields or legacyLineageProof. Editing
// it meant a pull replaced a good file with a stale one plus four additions,
// and the page died on mount.
//
// So nothing here touches api.js. LineageGraph and SourceLineage import
// `lineageApi` from this file directly. If you would rather reach these as
// api.lineageGraph(...) for consistency with the rest of the client, add one
// line to YOUR api.js — it is not required, and nothing breaks without it:
//
//     import { lineageApi } from './lineage_api_additions.js';
//     export const api = { ...lineageApi, /* existing entries */ };

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// Mirrors api.js: never latch to mock mode on one failure — a slow query must
// not empty the whole session. Each call tries the network again.
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
  return q.toString();
};

export const lineageApi = {
  // ---- column-level graph (Technical view) ----
  // Address by DWH column or by field code. include_parallel=false drops the
  // same-code chains running through other masters.
  lineageGraph: ({ table, column, code, data_source,
                   include_parallel = true } = {}) =>
    _get(`/legacy-lineage/graph?${_qs({
          table, column, code, data_source,
          include_parallel: include_parallel ? undefined : "false" })}`,
      () => ({ focus: null, code: code || null, nodes: [], edges: [],
               stats: {}, truncated: false })),

  // ---- source-first drill ----
  // spine is optional — "group" | "master" | "flat". Omitted, /sources picks
  // the best populated one and says which in the payload.
  lineageSources: (data_source, spine) =>
    _get(`/legacy-lineage/sources?${_qs({ data_source, spine })}`,
      () => ({ spine: "flat", spine_label: "Source", groups: [], masters: [],
               sources: [],
               totals: { files: 0, groups: 0, masters: 0, field_count: 0,
                         mapped: 0, unmapped: 0 } })),

  // Diagnostic. Answers "why does this screen say 0% mapped": prints the real
  // lineage_status vocabulary with row counts and how each value classifies.
  // A coverage figure that looks wrong is a vocabulary question first.
  // Source file x warehouse table, per functional group: the cell is how many
  // warehouse columns flow on that link. Empty column = a table nothing feeds.
  dependencyMatrix: (data_source, group) =>
    _get(`/legacy-lineage/dependency-matrix?${_qs({ data_source, group })}`,
      () => ({ groups: [], totals: { groups: 0, orphans: 0, defects: 0, links: 0 } })),

  // One table in focus: upstream with thickness, the column links themselves,
  // and downstream from the table-level dependency sheet.
  tableExplorer: (table, data_source, src) =>
    _get(`/legacy-lineage/table-explorer?${_qs({ table, data_source, src })}`,
      () => ({ table, upstream: [], column_links: [], column_links_total: 0,
               downstream: [], columns: 0, mapped: 0, unsourced: 0 })),

  // Structure + content profile of the legacy catalogue tables. Answers
  // "what is actually in this database" when a screen's grouping or numbers
  // are wrong — read it before changing the query that produced them.
  // What each grouping resolver can actually see, without building a screen.
  // files_covered = 0 across the board means the grouping is absent from the
  // data, not broken in the UI.
  lineageGroupSources: (data_source) =>
    _get(`/legacy-lineage/group-sources?${_qs({ data_source })}`,
      () => ({ resolvers: [], files_resolved: 0, spine: "none" })),

  lineageProfile: (table) =>
    _get(`/legacy-lineage/profile?${_qs({ table })}`,
      () => ({ tables: {}, other_tables: [], errors: ["profile unreachable"] })),

  lineageStatusValues: (data_source) =>
    _get(`/legacy-lineage/status-values?${_qs({ data_source })}`,
      () => ({ values: [], totals: { distinct_values: 0, rows: 0,
                                     mapped: 0, unmapped: 0 } })),

  lineageSourceFlow: (src_table, data_source) =>
    _get(`/legacy-lineage/source-flow?${_qs({ src_table, data_source })}`,
      () => ({ src_table, dataset: null, master: null, stages: {},
               targets: [], target_count: 0 })),

  lineageSourceFields: (src_table, data_source, target, system) =>
    _get(`/legacy-lineage/source-fields?${_qs({ src_table, data_source,
                                                target, system })}`,
      () => ({ src_table, families: [],
               totals: { codes: 0, families: 0, by_class: {} } })),
};

export default lineageApi;
