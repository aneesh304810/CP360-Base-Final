// Hub Discussion — its own API module.
//
// Same house rule as seiCrosswalkApi.js and guardrails_api_additions.js:
// nothing here touches api.js. A pull must never be able to replace a
// good api.js with a stale one plus these.
//
// ONE OPERATION PER WRITE, NOT ONE DOCUMENT. The first cut round-tripped
// the whole discussion as a single JSON blob. That works with no backend
// and is the wrong shape the moment two people type at once: the second
// save overwrites the first and nobody can tell. Each write here names
// what it did -- answer.add, answer.accept -- and the server applies it
// to one row and returns the state that resulted. The returned store is
// authoritative; the local one is optimism.
//
// LOCALSTORAGE IS THE FALLBACK, AND IT SAYS SO. With no API the screen
// still works on this browser's own copy, and the header says "local
// only" out loud, because a shared discussion that is quietly private is
// worse than one that is openly local. Attachments are the exception:
// they need the API, and the control says why rather than failing.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const KEY = "cp360-hub-discussion";
const PATH = "/hub/discussion";
const T = 8000;

export const emptyStore = () => ({ q: {}, a: {}, n: {}, ev: [], atts: {} });

// The corpus — topics, owners, questions — now comes from the database
// too. The copy that ships in the bundle is a COLD START only: it is
// used when the API cannot be reached or the loader has not been run,
// and the screen says which it is showing. A review that renders with no
// questions because Oracle is down is worse than one that renders the
// shipped copy and admits it is read-only.
export const SOURCE = { db: "db", bundled: "bundled" };

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyStore(), ...JSON.parse(raw) } : emptyStore();
  } catch { return emptyStore(); }
}

export function saveLocal(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* quota */ }
}

// Returns {store, live}. live false means the rows are not reachable and
// this is one browser's copy.
export async function load() {
  try {
    const r = await fetch(`${API_BASE}${PATH}`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const seeded = !!j.seeded && !!(j.corpus && (j.corpus.questions || []).length);
    return { store: { ...emptyStore(), ...(j.store || {}) }, live: true,
      corpus: seeded ? j.corpus : null,
      source: seeded ? SOURCE.db : SOURCE.bundled };
  } catch {
    return { store: loadLocal(), live: false, corpus: null,
      source: SOURCE.bundled };
  }
}

// Apply one named operation. Returns the server's store on success, or
// null — the caller keeps its optimistic copy and stays local.
export async function applyOp(op) {
  try {
    const r = await fetch(`${API_BASE}${PATH}/op`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op), signal: AbortSignal.timeout(T),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return { ...emptyStore(), ...(j.store || {}) };
  } catch { return null; }
}

// Kept so a local-only session still survives a reload.
export async function save(store) { saveLocal(store); return false; }

// Who the SERVER thinks is calling. Never asked of the browser: a page
// cannot read a machine name or a Windows account, and one that could
// would be a problem rather than a feature.
export async function whoami() {
  try {
    const r = await fetch(`${API_BASE}${PATH}/whoami`,
      { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return { lanId: null, source: "none", host: null, ip: null,
             verified: false };
  }
}

export const attachmentUrl = (id) => `${API_BASE}${PATH}/attachment/${id}`;

// Returns {id} or {error}. The error is shown rather than swallowed: an
// attachment that silently did not attach is the worst outcome.
export async function uploadAttachment(payload) {
  try {
    const r = await fetch(`${API_BASE}${PATH}/attachment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.detail || `upload failed (${r.status})` };
    return { id: j.id };
  } catch (e) { return { error: String(e.message || e) }; }
}

export async function deleteAttachment(id) {
  try {
    const r = await fetch(`${API_BASE}${PATH}/attachment/${id}`,
      { method: "DELETE", signal: AbortSignal.timeout(T) });
    return r.ok;
  } catch { return false; }
}

// Which path a dropped file takes. An SVG is text and goes through the
// sanitiser; everything else is bytes the server sniffs. This is also
// the honest answer to "convert my image to SVG": a diagram exported as
// SVG stays crisp and themeable, and auto-tracing a screenshot produces
// a file that is bigger than the PNG and looks worse.
export function attachKindFor(file) {
  const name = (file && file.name) || "";
  const type = (file && file.type) || "";
  if (type === "image/svg+xml" || /\.svg$/i.test(name)) return "svg";
  if (/^image\//.test(type)) return "image";
  return null;
}

export default { load, save, loadLocal, saveLocal, emptyStore, applyOp, whoami,
  uploadAttachment, deleteAttachment, attachmentUrl, attachKindFor };
