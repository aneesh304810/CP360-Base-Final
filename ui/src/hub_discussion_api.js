// Hub Discussion — its own API module.
//
// Same house rule as seiCrosswalkApi.js and guardrails_api_additions.js:
// nothing here touches api.js. A pull must never be able to replace a
// good api.js with a stale one plus these.
//
// THE STORE IS ONE DOCUMENT, not a row per call. The whole discussion
// state round-trips as a single JSON blob, exactly as HubDesign already
// does for component status. That keeps this working with no backend —
// localStorage — and makes the eventual Oracle table a single CLOB or a
// handful of rows, whichever the ingester prefers. It is the wrong shape
// for a forum with ten thousand posts and the right shape for an
// architecture review with a few hundred.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const KEY = "cp360-hub-discussion";
const PATH = "/hub/discussion";

export const emptyStore = () => ({ q: {}, a: {}, n: {}, ev: [] });

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyStore(), ...JSON.parse(raw) } : emptyStore();
  } catch { return emptyStore(); }
}

export function saveLocal(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* quota */ }
}

// Returns {store, live}. `live` false means the API is not there and the
// screen is running on this browser's own copy — which the header says
// out loud, because a shared discussion that is quietly private is worse
// than one that is openly local.
export async function load() {
  try {
    const r = await fetch(`${API_BASE}${PATH}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return { store: { ...emptyStore(), ...(j.store || {}) }, live: true };
  } catch {
    return { store: loadLocal(), live: false };
  }
}

// Always writes the local copy first, so a failed POST never loses what
// somebody just typed.
export async function save(store) {
  saveLocal(store);
  try {
    const r = await fetch(`${API_BASE}${PATH}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store }), signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch { return false; }
}

export default { load, save, loadLocal, saveLocal, emptyStore };
