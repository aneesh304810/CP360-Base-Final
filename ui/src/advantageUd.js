// AddVantage user-defined field codes: the client for /advantage-ud and the
// two pure helpers Datapoint 360 needs.
//
// Same house pattern as seiCrosswalkApi.js, for the same reason: nothing
// here touches api.js. Every call falls back to an empty shape, so a
// warehouse without sql/75 renders the pane exactly as before.

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

export const UD_RE = /^UD_\d+(?:_\d+)?$/;

/* A dictionary code is UD_1 or UD_23_1 once canonicalised (UD/1 -> UD_1).
   Anything else is not a user-defined field and has no code list. */
export const isUdAttribute = (code) => UD_RE.test(String(code || "").toUpperCase());

export const advantageUdApi = {
  codes: (attribute) =>
    _get(`/advantage-ud/codes?attribute=${encodeURIComponent(attribute)}`,
      () => ({ attribute, codes: [], sources: [] })),
  codedAttributes: () =>
    _get("/advantage-ud/coded-attributes", () => ({ attributes: [] })),
};

/* The one line that goes under the workbook's generic description. Says
   where the values came from, because OBSERVED and TABLES mean different
   things and the reader must not take an observed split for a defined
   lookup. */
export function codedSummary(codes) {
  const n = (codes || []).length;
  if (!n) return null;
  const src = new Set(codes.map((c) => c.source));
  const verified = codes.some((c) => c.link_status === "VERIFIED");
  const where = src.has("TABLES") && src.has("OBSERVED")
    ? "defined in the AddVantage lookup table and observed in the extract"
    : src.has("TABLES") ? "defined in the AddVantage lookup table"
    : "observed in the DIM_ACCOUNT_UD extract, not yet confirmed against an AddVantage table";
  return `Coded field · ${n} value${n === 1 ? "" : "s"} ${where}` +
    (verified ? " · verified" : "");
}

/* The 360 view (sql/76). Each call falls back to {loaded:false} so the
   pane can say "not loaded yet" instead of drawing empty charts. */
advantageUdApi.overview = () =>
  _get("/advantage-ud/overview", () => ({ loaded: false, attributes: 0, parents: [], families: [] }));
advantageUdApi.attribute = (name) =>
  _get(`/advantage-ud/attribute?name=${encodeURIComponent(name)}`,
    () => ({ attribute: name, loaded: false, registry: null, codes: [], siblings: [], conflicts: [] }));
advantageUdApi.clobShape = () =>
  _get("/advantage-ud/clob-shape", () => ({ loaded: false, example: {}, key_count_buckets: {} }));
advantageUdApi.registry = (q) => {
  const s = new URLSearchParams();
  Object.entries(q || {}).forEach(([k, v]) => { if (v) s.set(k, v); });
  const qs = s.toString();
  return _get(`/advantage-ud/registry${qs ? "?" + qs : ""}`, () => ({ attributes: [] }));
};

/* Plain-language readings of the registry numbers, so the pane says what
   a figure MEANS rather than printing it. Pure, tested. */
export const pct = (v) => (v == null ? null : `${Math.round(Number(v) * 10) / 10}%`);

export function presenceReading(r) {
  const p = Number(r?.record_presence_pct);
  if (!r || Number.isNaN(p)) return null;
  if (p >= 99) return "on every account";
  if (p >= 50) return "on most accounts";
  if (p >= 5) return "on some accounts";
  return "rare";
}

export function typeReading(r) {
  if (!r) return null;
  const parts = [];
  if (r.type_reclassified === "Y") parts.push(`profiled as ${r.dominant_type}, read as ${r.value_class} (10-digit account reference)`);
  else parts.push(`${r.value_class}${r.dominant_type && r.dominant_type !== r.value_class ? ` (profiled ${r.dominant_type})` : ""}`);
  if (r.dominant_type_pct != null && Number(r.dominant_type_pct) < 100) parts.push(`${pct(r.dominant_type_pct)} of values`);
  if (r.type_variance_ind === "Y") parts.push(r.variance_class ? r.variance_class.toLowerCase().replace(/_/g, " ") : "mixed representations");
  if (Number(r.leading_zero_count) > 0) parts.push("leading zeros, kept as text");
  return parts.join(" · ");
}

export function parseDistribution(s) {
  try { const o = typeof s === "string" ? JSON.parse(s) : (s || {});
    return Object.entries(o).map(([k, v]) => [k, Number(v)]).sort((a, b) => b[1] - a[1]); }
  catch { return []; }
}

export const SOURCE_LABEL = {
  DICTIONARY: "from the AddVantage UD workbook",
  SAMPLES: "from the TRP business samples",
  RULE: "hypothesis from the brief, not yet confirmed",
  INFERRED: "inferred from the values only",
};
