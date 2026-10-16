// ODI 360 · SCD2 API client — self-contained, for the same reason as
// event360_api_additions.js: api.js drifts between working copies, and a
// module that owns its own client cannot be broken by that drift. Every
// call falls back to a SHAPE with _offline set, never to invented cards.
const BASE = import.meta.env.VITE_API_BASE || '/api';
async function get(path, empty) {
  try {
    const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    return { ...empty, _offline: true, _error: String(e && e.message || e) };
  }
}
export const scd2 = {
  summary: () => get('/scd2/summary', { by_pattern: [], confidence: {}, tables: 0, loaded: false }),
  cards: () => get('/scd2/cards', { cards: [], loaded: false, count: 0 }),
  card: (table) => get(`/scd2/card/${encodeURIComponent(table)}`, { table, loaded: false, rules: [], mapping: [], open_questions: [], dup_by_month: [] }),
};
export const PATTERN_INFO = {
  MERGE_SCD2: { label: 'SCD2 · merge', c: '#159943', t: 'versions kept in place: a merge inserts the new version and a procedure closes the old one' },
  TRUNCATE_APPEND_HIST: { label: 'truncate + history', c: '#e67e22', t: 'reloaded whole each run; history kept by an *_INSERT_HIST procedure, not versioned in place' },
  SNAPSHOT: { label: 'snapshot', c: '#0091bf', t: 'one row per as-of date; history by repetition' },
  SCD1: { label: 'SCD1', c: '#7c3aed', t: 'overwritten in place; no history' },
  SCD2_UNVERIFIED: { label: 'SCD2 · unverified', c: '#b7791f', t: 'the column scan says SCD2 but the export cut the writer code before the merge — re-export the scenario to confirm' },
  UNKNOWN: { label: 'unknown', c: '#999999', t: 'no writer scenario found in the export' },
};
export const CONF_INFO = {
  PROVEN: { c: '#159943', t: 'read from the export or the database' },
  INFERRED: { c: '#e67e22', t: 'the evidence points this way; not read directly' },
  UNKNOWN_TRUNCATED: { c: '#c1113a', t: 'the code was truncated in the export; re-export to prove it' },
};
