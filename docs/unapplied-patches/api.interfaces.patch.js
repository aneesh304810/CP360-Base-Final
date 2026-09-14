// ============================================================
// PATCH for api.js — replace your existing `interfaces` function
// with this one. Do not replace the whole file; just this entry
// inside your exported `api` object.
//
// Root cause: the old version whitelisted only source_project_id,
// target_project_id, feed_type — so source_system / target_system /
// direction / migration / pii_status selections never reached the
// URL (confirmed: bare request URL with no query string).
//
// This version forwards EVERY non-empty opt as a query param.
// Arrays are already CSV-joined by Interface360.jsx before calling.
// ============================================================

interfaces: (opts = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v == null || v === '') continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = p.toString();
  return fetch(`/api/interface360/interfaces${qs ? `?${qs}` : ''}`)
    .then((r) => r.json());
},
