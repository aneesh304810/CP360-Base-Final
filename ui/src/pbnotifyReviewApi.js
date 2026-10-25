// PB Notifications — the review layer's API client. Self-contained, like
// hub_discussion_api.js: nothing here touches api.js.
//
// One operation per write. Each call names what it did (edit, note.add,
// note.status) and the server returns the state that resulted; the
// returned state is authoritative and the local one is optimism.
//
// LOCALSTORAGE IS THE FALLBACK, AND THE PAGE SAYS SO. With no API the
// review still works on this browser's own copy and the header says
// "local only", because a review that is quietly private is worse than
// one that is openly local. applyLocal mirrors the server's rules so the
// two copies behave the same.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PATH = "/pbnotify/review";
const KEY = "cp360-pbnotify-review";
const NAME_KEY = "cp360-reviewer-name";
const T = 8000;

export const KINDS = ["question", "comment", "answer"];
export const STATUSES = ["open", "answered", "closed"];
export const MAX_BODY = 4000;

export const emptyReview = () => ({ edits: {}, editLog: [], notes: [] });

export function loadLocal() {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...emptyReview(), ...JSON.parse(raw) } : emptyReview(); }
  catch { return emptyReview(); }
}
export function saveLocal(review) {
  try { localStorage.setItem(KEY, JSON.stringify(review)); } catch { /* quota or private window */ }
}
export function reviewerName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
export function setReviewerName(name) {
  try { localStorage.setItem(NAME_KEY, String(name || "").trim().slice(0, 120)); } catch { /* ignore */ }
}

// {review, live}. live false means the rows are not reachable and this is one browser's copy.
export async function load() {
  try {
    const r = await fetch(`${API_BASE}${PATH}`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return { review: { ...emptyReview(), ...(j.review || {}) }, live: true };
  } catch { return { review: loadLocal(), live: false }; }
}

// The server's state on success, or null: the caller keeps its optimistic copy and stays local.
export async function applyOp(op) {
  try {
    const r = await fetch(`${API_BASE}${PATH}/op`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op), signal: AbortSignal.timeout(T),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: j.detail || `HTTP ${r.status}` }; }
    const j = await r.json();
    return { review: { ...emptyReview(), ...(j.review || {}) } };
  } catch (e) { return { error: String(e && e.message || e), offline: true }; }
}

export async function whoami() {
  try {
    const r = await fetch(`${API_BASE}${PATH}/whoami`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch { return { lanId: null, source: "none", host: null, ip: null, verified: false }; }
}

const nid = (p) => `${p}${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
const stamp = (now) => (now || new Date()).toISOString().slice(0, 16).replace("T", " ");
const clip = (s) => String(s || "").trim().slice(0, MAX_BODY);

// The same rules as the server, applied to a local copy. Returns a new
// state, or throws with the message the server would have sent.
export function applyLocal(review, op, now) {
  const r = { edits: { ...review.edits }, editLog: [...review.editLog], notes: review.notes.map((n) => ({ ...n })) };
  const actor = clip(op.actor);
  if (!actor) throw new Error("name required: sign-in is off, so say who you are");
  const at = stamp(now);
  if (op.op === "edit" || op.op === "edit.revert") {
    if (!op.itemKey) throw new Error("itemKey required");
    const body = op.op === "edit" ? clip(op.body) : null;
    if (op.op === "edit" && !body) throw new Error("body is empty");
    const rec = { id: nid("e"), itemKey: op.itemKey, section: op.section || null, body, seen: clip(op.seen) || null, author: actor, idSource: "none", at };
    r.editLog.push(rec);
    if (body) r.edits[op.itemKey] = rec; else delete r.edits[op.itemKey];
    return r;
  }
  if (op.op === "note.add") {
    const kind = (op.kind || "comment").toLowerCase();
    if (!KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(", ")}`);
    if (kind === "answer" && !op.parentId) throw new Error("an answer needs the question it answers");
    const body = clip(op.body); if (!body) throw new Error("body is empty");
    if (!op.itemKey) throw new Error("itemKey required");
    r.notes.push({ id: nid("n"), itemKey: op.itemKey, section: op.section || null, kind, body, author: actor, idSource: "none",
      parentId: op.parentId || null, status: "open", statusBy: null, statusAt: null, editedBy: null, editedAt: null, at });
    if (kind === "answer") { const q = r.notes.find((n) => n.id === op.parentId); if (q && q.status === "open") Object.assign(q, { status: "answered", statusBy: actor, statusAt: at }); }
    return r;
  }
  if (op.op === "note.edit") {
    const n = r.notes.find((x) => x.id === op.noteId); if (!n) throw new Error("no such note");
    const body = clip(op.body); if (!body) throw new Error("body is empty");
    Object.assign(n, { body, editedBy: actor, editedAt: at }); return r;
  }
  if (op.op === "note.status") {
    const n = r.notes.find((x) => x.id === op.noteId); if (!n) throw new Error("no such note");
    const status = (op.status || "").toLowerCase(); if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(", ")}`);
    Object.assign(n, { status, statusBy: actor, statusAt: at }); return r;
  }
  throw new Error(`unknown op ${op.op}`);
}

// What the page shows for an item: the latest edit, or the shipped text.
export function textFor(review, key, original) {
  const e = review && review.edits && review.edits[key];
  return e && e.body ? { text: e.body, edited: e } : { text: original, edited: null };
}
export const notesFor = (review, key) => ((review && review.notes) || []).filter((n) => n.itemKey === key);
export const openQuestions = (review) => ((review && review.notes) || []).filter((n) => n.kind === "question" && n.status === "open");

// "G7", "T05", "R3", "BR-02", "step 5" or "general" to an item key.
export function keyFor(label) {
  const s = String(label || "").trim();
  if (!s || /^general$/i.test(s)) return "general";
  if (/^R\d+$/i.test(s)) return `req:${s.toUpperCase()}`;
  if (/^G\d+$/i.test(s)) return `gap:${s.toUpperCase()}`;
  if (/^T\d{2}$/i.test(s)) return `test:${s.toUpperCase()}`;
  if (/^BR-\d{2}$/i.test(s)) return `br:${s.toUpperCase()}`;
  if (/^step\s*\d+$/i.test(s)) return `step:${s.replace(/\D/g, "")}`;
  if (/^[a-z]+:[^\s]+$/i.test(s)) return s;
  return `general:${s.slice(0, 60)}`;
}

export default { load, applyOp, whoami, loadLocal, saveLocal, emptyReview, applyLocal, textFor, notesFor, openQuestions, keyFor, reviewerName, setReviewerName };
