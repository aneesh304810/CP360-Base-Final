// ODI 360 · repository API client — self-contained like scd2Api.js, so a
// drift in api.js cannot break it. Every call falls back to an empty SHAPE
// with _offline set; the screen then says to run the ingestion.
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
const enc = encodeURIComponent;
export const odi = {
  summary: () => get('/odi/summary', { loaded: false, scenarios: 0, tasks: 0, truncated_tasks: 0, variables: 0, tables: 0, objects: 0, edges: 0, scd2_cards: 0, by_pattern: [], by_layer: [], by_object_type: [] }),
  scenarios: (q = '', pattern = '') => get(`/odi/scenarios?q=${enc(q)}&pattern=${enc(pattern)}`, { scenarios: [], count: 0, loaded: false }),
  scenario: (name) => get(`/odi/scenario/${enc(name)}`, { scenario: name, loaded: false, head: {}, steps: [], tasks: [], variables: [], edges: [], objects: [] }),
  tables: (q = '', layer = '') => get(`/odi/tables?q=${enc(q)}&layer=${enc(layer)}`, { tables: [], count: 0, loaded: false }),
  table: (name) => get(`/odi/table/${enc(name)}`, { table: name, loaded: false, head: {}, tasks: [], sources: [], inbound: [], outbound: [], objects: [], scd2: null }),
  variables: (q = '') => get(`/odi/variables?q=${enc(q)}`, { variables: [], count: 0, loaded: false }),
  objects: (q = '', type = '') => get(`/odi/objects?q=${enc(q)}&type=${enc(type)}`, { objects: [], count: 0, loaded: false }),
  edges: (node = '') => get(`/odi/edges?node=${enc(node)}`, { edges: [], count: 0, loaded: false }),
};
// The task types an ODI scenario is made of, in the words a reader needs.
export const TASK_TYPE = {
  C: { label: 'flow', t: 'a mapping step: load, insert into the I$ flow table, merge' },
  J: { label: 'journal / flow', t: 'a mapping step on the journalised or flow side' },
  S: { label: 'procedure', t: 'a database procedure or SQL command' },
  V: { label: 'variable', t: 'refreshes, sets or evaluates an ODI variable' },
  P: { label: 'package', t: 'calls another scenario or package step' },
  T: { label: 'tool', t: 'an ODI tool call: file, wait, mail' },
};
