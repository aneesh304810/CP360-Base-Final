// Event 360 API client — self-contained.
//
// WHY THIS IS A SEPARATE FILE AND NOT api.js
//
// Same reason as lineage_api_additions.js and env360_infra_api_additions.js:
// ui/src/api.js is routinely ahead in working copies and behind in the repo,
// so adding calls there breaks the page on whichever machine pulls the branch
// with `api.evtSummary is not a function`. A module that owns its own client
// cannot be broken by that drift.
//
// Every call falls back to a SHAPE, never to invented data. An empty estate
// renders the screen's own "nothing loaded yet" state, which tells you to run
// the ingestion — far better than a demo dataset that looks like success.

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
async function post(path, body, empty) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    return { ...empty, _offline: true, _error: String(e && e.message || e) };
  }
}

export const evt360 = {
  summary: () => get('/event360/summary', { loaded: false, events: 0 }),
  events: (q = {}) => get('/event360/events' + qs(q), { events: [], weights: [] }),
  groups: (by) => get(`/event360/groups?by=${encodeURIComponent(by || 'type')}`,
    { groups: [] }),
  event: (id) => get(`/event360/event/${id}`, { found: false }),
  lanes: (by) => get(`/event360/lanes?by=${encodeURIComponent(by || 'domain')}`,
    { lanes: [] }),
  link: (domain) => get('/event360/link' + (domain ? `?domain=${encodeURIComponent(domain)}` : ''),
    { a: [], b: [], c: [], ab: [], bc: [] }),
  interdependence: (table) => get('/event360/interdependence'
    + (table ? `?table=${encodeURIComponent(table)}` : ''),
    { blast: [], heat: [], tables: [] }),
  column: (t, c) => get(`/event360/column/${encodeURIComponent(t)}/${encodeURIComponent(c)}`,
    { events: [] }),
  subscriptions: (consumer) => get('/event360/subscriptions'
    + (consumer ? `?consumer=${encodeURIComponent(consumer)}` : ''),
    { subscriptions: [], consumers: [], matrix: [], unsubscribed: [] }),
  cost: (body) => post('/event360/cost', body,
    { basket: { events: 0, distinct_views: 0, views_unmeasured: [] },
      usage: { per_month: 0, first_twelve_months: 0, monthly_series: [] },
      views: [], minimum: null, rate: {}, scale: {} }),
  contract: () => get('/event360/contract',
    { envelope: [], rules: [], types: [], domains: [], weights: [] }),
};

function qs(o) {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return p.length ? `?${p.join('&')}` : '';
}
