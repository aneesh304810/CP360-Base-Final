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

// ---- the lineage package (sql/87) ----
export const emptyLineageSummary = () => ({ totals: { lineage: 0, targetFields: 0, datFiles: 0, rules: 0, decon: 0, qc: 0, sharedTargets: 0, matched: 0, unmatched: 0, blankTarget: 0 },
  byLane: [], byGroup: [], byRuleStatus: [], byApproval: [], byDecon: [], byMatch: [], byFile: [], manifest: [] });
histMigrationApi.lineage = (params) => _get(`/hist-migration/lineage${qs(params)}`, () => ({ lineage: [], total: 0, page: 1, size: 100 }));
histMigrationApi.lineageSummary = () => _get("/hist-migration/lineage/summary", emptyLineageSummary);
histMigrationApi.lineageRecord = (id) => _get(`/hist-migration/lineage/record${qs({ id })}`, () => ({ record: null }));
histMigrationApi.decon = (params) => _get(`/hist-migration/decon${qs(params)}`, () => ({ objects: [], byStatus: [], byBasis: [], byDomain: [], byPrefix: [] }));
histMigrationApi.rules = (params) => _get(`/hist-migration/rules${qs(params)}`, () => ({ rules: [], total: 0, page: 1, size: 100, byType: [], byStatus: [], byApproval: [], byFile: [] }));
histMigrationApi.qc = () => _get("/hist-migration/qc", () => ({ controls: [] }));
histMigrationApi.canvas = (params) => _get(`/hist-migration/canvas${qs(params)}`, () => ({ lanes: [], targets: [], sei_files: [], files: [], truncated: false }));
histMigrationApi.lineageMapping = (params) => _get(`/hist-migration/lineage/mapping${qs(params)}`, () => ({ mapping: [], files: [], limit: 500 }));

// The four statuses on a lineage record are different controls and are
// never folded into one. A rule can be Complete and still unapproved.
export const STATUS_KINDS = [
  ["rule", "Rule status", "RULE_STATUS from the mapping workbook: whether the analyst finished the rule"],
  ["approval", "Approval", "APPROVAL_STATUS: whether the mapping has been approved; DRAFT_REVIEW_REQUIRED until it is"],
  ["dictionary", "Dictionary", "DECON_DICTIONARY_STATUS: CURATED, REVIEW_REQUIRED, PARTIAL_REVIEW_REQUIRED or NO_TECHNICAL_OBJECT"],
  ["match", "Lineage match", "MATCH_STATUS: EXACT_NORMALIZED_FIELD_MATCH against the operational SEI input lineage; UNMATCHED is flagged for review"],
];
export const STATUS_COLOR = (v) => {
  const s = String(v || "").toUpperCase();
  if (!s) return "#6b7884";
  if (/^(COMPLETE|APPROVED|CURATED|MATCHED)$/.test(s)) return "#159943";
  if (/UNMATCHED|BLOCKED|NO_TECHNICAL|ERROR|FAIL/.test(s)) return "#b42318";
  if (/DRAFT|REVIEW|PARTIAL|PENDING|OPEN|NOT_CHECKED/.test(s)) return "#c96a12";
  return "#0f4775";
};
export const LANE_LABEL = { ADDVANTAGE_SEI_HIST: "AddVantage / PB → SEI", STAR_SEI_HIST: "STAR / IM → SEI", UAF_SEI_HIST: "UAF → SEI", COMMON: "Common PB-IM-UAF → SEI", UNCLASSIFIED: "unclassified" };
export const HL_RULES = [
  ["CP360-HL-001", "FINAL_HIST_MIGRATION_LINEAGE", "Target", "Every row names a TARGET_DAT_FILE and a TARGET_FIELD; the stable key is SEI::<dat file>::<field>.", "Error"],
  ["CP360-HL-002", "FINAL_HIST_MIGRATION_LINEAGE", "Lane", "The source system or path resolves to a registered lane; PB and IM/UAF rows stay on their own lanes.", "Warning"],
  ["CP360-HL-003", "HIST_MIGRATION_RULE", "Rule", "A lineage row has a rule on its catalog id or its target field.", "Warning"],
  ["CP360-HL-004", "FINAL_HIST_MIGRATION_LINEAGE", "Common target", "A SEI field reached from more than one lane stays as separate rows; the target key is shared, the source is not.", "Recommendation"],
  ["CP360-HL-005", "DECON_SOURCE_DICTIONARY", "Governed status", "DECON_DICTIONARY_STATUS is one of four values, never free text.", "Error"],
  ["CP360-HL-006", "DECON_SOURCE_DICTIONARY", "Basis", "A name-derived meaning is marked as such and never treated as curated.", "Error"],
  ["CP360-HL-007", "FINAL_HIST_MIGRATION_LINEAGE", "Independence", "Rule status, approval, dictionary status and lineage match are kept apart.", "Error"],
  ["CP360-HL-008", "FINAL_HIST_MIGRATION_LINEAGE", "Match", "EXACT_NORMALIZED_FIELD_MATCH against the operational SEI input lineage; unmatched rows are flagged for review.", "Warning"],
];

// THE ANALYSTS WRITE SQL CASE; THE PARSER READS IF/THEN/ELSE. The shared
// classifier (the one the operational canvas draws from) understands the
// mapping documents' IF a THEN b ELSE c, not CASE WHEN … END, and would
// read a CASE as "direct". The historical rules are analyst text and use
// CASE, so the text is turned into the parser's form before it is
// classified; the rule as written is what the table and the detail show.
export function classifyRule(text) {
  const s = String(text || "").replace(/\bEND\b/gi, " ").replace(/\bCASE\s+WHEN\b/gi, "IF ").replace(/\bWHEN\b/gi, "ELSE IF ");
  return s.replace(/\s+/g, " ").trim();
}
