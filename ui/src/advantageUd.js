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
