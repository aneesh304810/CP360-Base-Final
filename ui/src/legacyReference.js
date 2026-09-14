// legacyReference.js — API client for Non-SEI (legacy) Datapoint 360.
// Mirrors the SEI reference client. If your existing api.js exposes a shared
// `request`/`apiFetch` helper (with the DEMO→LIVE mode resolution), import and
// use that instead of the local fetch below so both tabs resolve mode the
// same way — that mismatch is what caused the chip=2759 / body=0 split.

const BASE = "/api/reference";

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} -> ${res.status} ${body}`);
  }
  return res.json();
}

export function fetchLegacyDatapoints({ system, q = "", piiOnly = false }) {
  const params = new URLSearchParams({ system });
  if (q) params.set("q", q);
  if (piiOnly) params.set("pii_only", "true");
  return get(`${BASE}/legacy-datapoint?${params}`);
}

export function fetchLegacyDatapointDetail({ system, name }) {
  const params = new URLSearchParams({ system });
  return get(
    `${BASE}/legacy-datapoint/${encodeURIComponent(name)}?${params}`
  );
}

export function fetchLegacySummary({ system }) {
  const params = new URLSearchParams({ system });
  return get(`${BASE}/legacy-datapoint-summary?${params}`);
}
