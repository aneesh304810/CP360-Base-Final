// Data Analysis: the client for /sei-migration and the pure helpers the
// page draws from. Same house pattern as advantageUd.js: nothing here
// touches api.js, and every call falls back to an empty shape so a
// warehouse without sql/78 renders the page with its empty states.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return fallback();
  }
}

const qs = (o) => {
  const p = Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return p.length ? `?${p.join("&")}` : "";
};

export const seiMigrationApi = {
  overview: () => _get("/sei-migration/overview", () => ({ totals: { fields: 0 }, by_file: [], by_group: [], by_rule: [], by_status: [], by_mandatory: [], by_system: [], by_target: [] })),
  fields: (params) => _get(`/sei-migration/fields${qs(params)}`, () => ({ fields: [], total: 0, files: [] })),
  files: () => _get("/sei-migration/files", () => ({ files: [] })),
  field: (id) => _get(`/sei-migration/field?id=${encodeURIComponent(id)}`, () => null),
  sources: (params) => _get(`/sei-migration/sources${qs(params)}`, () => ({ systems: [], tables: [], cells: [] })),
  findings: (params) => _get(`/sei-migration/findings${qs(params)}`, () => ({ findings: [], by_kind: [], kinds: {} })),
  lookups: () => _get("/sei-migration/lookups", () => ({ config_lists: [], crosswalks: [] })),
  ingestStatus: () => _get("/sei-migration/ingest-status", () => ({ fields: 0, sources: 0, targets: 0, workbooks: 0, updated_at: "" })),
};

/* The vocabularies, in the order the screen stacks them, with one line
   each saying what the reading looked for. */
export const RULE_CLASSES = {
  DIRECT: { label: "Direct", hint: "the source column as it is" },
  CONSTANT: { label: "Constant", hint: "set to one value, or a default" },
  SET_NULL: { label: "Set to null", hint: "nothing is sent" },
  LOOKUP: { label: "Lookup", hint: "through a crosswalk table or a config list" },
  CONDITIONAL: { label: "Conditional", hint: "CASE WHEN / IF ... THEN" },
  CONCATENATE: { label: "Concatenate", hint: "several source columns joined" },
  TRANSFORM: { label: "Transform", hint: "converted, formatted, trimmed or truncated" },
  DERIVED: { label: "Derived", hint: "a rule in prose that is none of the above" },
  NOT_APPLICABLE: { label: "Not applicable", hint: "the row says not migrated or N/A" },
  NOT_MAPPED: { label: "Not mapped", hint: "nothing written" },
};
export const STATUS_CLASSES = {
  COMPLETE: "Complete", OPEN: "Open", BLOCKED: "Blocked", NA: "Not applicable", UNSPECIFIED: "Unspecified",
};
export const MANDATORY_CLASSES = {
  ALWAYS: { label: "Always", hint: "required for every account type it applies to" },
  CONDITIONAL: { label: "By account type", hint: "required for some account types" },
  OPTIONAL: { label: "Optional", hint: "required for none" },
  NOT_APPLICABLE: { label: "N/A", hint: "every account type says N/A" },
  UNKNOWN: { label: "Unknown", hint: "the cell is empty" },
};
export const SYSTEMS = {
  UAF: { label: "UAF / PACE", hint: "BBH account master" },
  IM: { label: "IM", hint: "Investment Management tables" },
  STAR: { label: "Star", hint: "legacy accounting" },
  PB: { label: "PB", hint: "Private Banking account master" },
  ADDVANTAGE: { label: "AddVantage", hint: "AV_ maps and defaults" },
  CONVERSION: { label: "Conversion", hint: "XOS_ staging and crosswalks" },
  SEI_CONFIG: { label: "SEI config", hint: "Config_ lists on the SEI side" },
  CRM: { label: "CRM", hint: "Pivotal / CRD" },
  OTHER: { label: "Other", hint: "no known prefix" },
};
export const TARGET_KINDS = {
  OUTBOUND: "Standard outbound file", BOXI: "BOXI report", ADE_CAS: "ADE-CAS", DESKTOP: "Desktop",
};

export function ruleColor(t, cls) {
  return {
    DIRECT: t.success, CONSTANT: t.muted, SET_NULL: t.textMuted, LOOKUP: t.accent, CONDITIONAL: t.projPivotal,
    CONCATENATE: t.hover, TRANSFORM: t.projAddvantage, DERIVED: t.navy, NOT_APPLICABLE: t.disabled, NOT_MAPPED: t.danger,
  }[cls] || t.textMuted;
}
export function statusColor(t, cls) {
  return { COMPLETE: t.success, OPEN: t.warning, BLOCKED: t.danger, NA: t.textMuted, UNSPECIFIED: t.textMuted }[cls] || t.textMuted;
}
export function systemColor(t, sys) {
  return {
    UAF: t.accent, IM: t.navy, STAR: t.hover, PB: t.projCharlesRiver, ADDVANTAGE: t.projAddvantage,
    CONVERSION: t.projPivotal, SEI_CONFIG: t.projSei, CRM: t.projPivotal, OTHER: t.textMuted,
  }[sys] || t.textMuted;
}

/* The lineage of one catalog row, as four columns the page draws left to
   right: the BBH sources, the rule, the SEI load-file field, and where it
   goes next. Pure, so the picture is checkable without a browser. */
export function buildLineage(detail) {
  if (!detail || !detail.field) return null;
  const f = detail.field;
  const srcs = (detail.sources || []).filter((s) => s.role === "SOURCE");
  const aids = (detail.sources || []).filter((s) => s.role !== "SOURCE");
  const bySys = {};
  srcs.forEach((s) => {
    const k = s.system_class || "OTHER";
    const g = bySys[k] || (bySys[k] = { system: k, tables: {} });
    const tb = g.tables[s.source_table] || (g.tables[s.source_table] = { table: s.source_table, fields: [], how: s.how });
    if (s.source_field && s.source_field !== "-") tb.fields.push({ name: s.source_field, how: s.how });
  });
  const sources = Object.values(bySys).map((g) => ({ ...g, tables: Object.values(g.tables) }));
  const rule = {
    cls: f.rule_class || "NOT_MAPPED", side: f.rule_side || "NONE", text: f.rule_text || "",
    sei_logic: f.processing_logic || "", bbh_logic: f.other_mapping_logic || "",
    aids: aids.map((a) => ({ table: a.source_table, role: a.role, system: a.system_class })),
    validations: f.validations || "", acceptable: f.acceptable_values || "",
  };
  const target = {
    file: f.source_object, field: f.source_attribute, seq: f.seq, type: f.data_type, length: f.max_length,
    decimals: f.max_decimal, mandatory: f.mandatory_class, status: f.status_class, status_detail: f.status_detail,
    group: f.functional_group, category: f.function_category, domicile: f.domicile, remarks: f.remarks || "",
  };
  const down = {};
  (detail.targets || []).forEach((x) => {
    const g = down[x.target_kind] || (down[x.target_kind] = { kind: x.target_kind, items: [] });
    g.items.push({ object: x.target_object === "-" ? "" : x.target_object, field: x.target_field === "-" ? "" : x.target_field, transformation: x.transformation || "" });
  });
  const downstream = ["OUTBOUND", "BOXI", "ADE_CAS", "DESKTOP"].filter((k) => down[k]).map((k) => down[k]);
  return { sources, rule, target, downstream,
           empty: { sources: sources.length === 0, downstream: downstream.length === 0 } };
}

/* One sentence for the rule, for the table and the drawer. */
export function describeRule(f) {
  const cls = RULE_CLASSES[f.rule_class] || RULE_CLASSES.NOT_MAPPED;
  const side = f.rule_side === "SEI" ? " (SEI's logic, no BBH rule written)" : "";
  return `${cls.label}${side}`;
}
