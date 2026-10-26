// Data Analysis · Historical migration: the client for /hist-migration.
// Same house pattern as seiMigrationApi.js: nothing here touches api.js,
// and every call falls back to an empty shape so a warehouse without
// sql/86 renders the tab with its empty state.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch { return fallback(); }
}
const qs = (o) => {
  const p = Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return p.length ? `?${p.join("&")}` : "";
};

export const emptySummary = () => ({ loaded: false, totals: { lanes: 0, artifacts: 0, evidence: 0, dictionary: 0, sourceRows: 0, unresolvedLanes: 0 },
  byLane: [], byDomain: [], bySourceSystem: [], byCategory: [], byAttribute: [], bySheet: [], latest: null });

export const histMigrationApi = {
  summary: () => _get("/hist-migration/summary", emptySummary),
  lanes: () => _get("/hist-migration/lanes", () => ({ lanes: [] })),
  artifacts: () => _get("/hist-migration/artifacts", () => ({ artifacts: [] })),
  dictionary: () => _get("/hist-migration/dictionary", () => ({ columns: [] })),
  evidence: (params) => _get(`/hist-migration/evidence${qs(params)}`, () => ({ evidence: [], total: 0, page: 1, size: 50 })),
  row: (workbook, sheet, row) => _get(`/hist-migration/row${qs({ workbook, sheet, row })}`, () => ({ cells: [] })),
  batches: () => _get("/hist-migration/batches", () => ({ batches: [] })),
};

// The sheet specification's rules, as the loader checks them. Shown on the
// tab beside each batch's results so the reader sees the contract and the
// evidence of it in one place.
export const HM_RULES = [
  ["CP360-HM-001", "All four sheets", "Encoding", "Text is Unicode; punctuation, underscores, table names and line breaks are preserved; ends trimmed only.", "Error"],
  ["CP360-HM-002", "HIST_MAPPING_EVIDENCE", "Grain", "One record per populated mapping cell of the consolidated mapping workbook.", "Error"],
  ["CP360-HM-003", "HIST_MAPPING_EVIDENCE", "Uniqueness", "Workbook + sheet + row + original column number is the key.", "Error"],
  ["CP360-HM-004", "HIST_MAPPING_EVIDENCE", "Null handling", "A blank source cell is not a row; required metadata and the evidence value are never null.", "Error"],
  ["CP360-HM-005", "HIST_MAPPING_EVIDENCE", "Source fidelity", "The evidence value is never transformed, summarised or rewritten.", "Error"],
  ["CP360-HM-006", "HIST_MAPPING_EVIDENCE", "Auditability", "The original column name and number are kept for lineage back to the merged workbook.", "Error"],
  ["CP360-HM-007", "HIST_MIGRATION_LANES", "Referential integrity", "An evidence lane should resolve to a registered lane; common or unclassified lanes may stay broader.", "Warning"],
  ["CP360-HM-008", "HIST_SOURCE_REGISTER", "Classification", "The deconversion specification and the TRP data dictionary are reference artifacts, not operational feeds.", "Error"],
  ["CP360-HM-009", "All four sheets", "Load order", "Lanes and the source register before the evidence; the header dictionary as schema documentation.", "Warning"],
  ["CP360-HM-010", "HIST_MAPPING_EVIDENCE", "Long text", "The evidence value is a CLOB: Unicode beyond 4,000 characters.", "Error"],
  ["CP360-HM-011", "All four sheets", "Snapshot control", "Batch id, source file, hash, timestamp and active flag on every row.", "Recommendation"],
];
export const LEVEL_COLOR = { Error: "#b42318", Warning: "#c96a12", Pass: "#159943", Recommendation: "#0f4775" };
