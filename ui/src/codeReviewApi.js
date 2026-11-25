// Code Review 360 — the review records' API client. Self-contained; nothing
// here touches api.js. Every call falls back to an empty shape so the page
// renders with its empty state when the API is not there.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PATH = "/codereview";
const T = 15000;

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${PATH}${path}`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch { return fallback(); }
}
async function _post(path, body) {
  try {
    const r = await fetch(`${API_BASE}${PATH}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: j.detail || `HTTP ${r.status}` }; }
    return await r.json();
  } catch (e) { return { error: String((e && e.message) || e) }; }
}

export const SEVERITIES = ["blocker", "high", "medium", "low", "info"];
export const SEV_COLOR = { blocker: "#c1113a", high: "#d9480f", medium: "#b45309", low: "#6b7884", info: "#8DA9C4" };
export const VERDICT_COLOR = { APPROVE: "#159943", COMMENT: "#b45309", REQUEST_CHANGES: "#c1113a" };
export const VERDICT_LABEL = { APPROVE: "Approve", COMMENT: "Comment", REQUEST_CHANGES: "Request changes" };
export const STATUS_LABEL = { awaiting_copilot: "Rules done · awaiting Copilot", final: "Final" };

export const codeReviewApi = {
  health: () => _get("/health", () => ({ githubToken: false, webhookSecret: false, llm: "none", post: false })),
  standards: () => _get("/standards", () => ({ areas: {}, rules: [] })),
  reviews: () => _get("/reviews", () => ({ reviews: [] })),
  review: (id) => _get(`/reviews/${encodeURIComponent(id)}`, () => null),
  packUrl: (id) => `${API_BASE}${PATH}/reviews/${encodeURIComponent(id)}/pack`,
  ingest: (id, answer, post) => _post(`/reviews/${encodeURIComponent(id)}/ingest`, { answer, post }),
  run: (repo, number, post) => _post("/run", { repo, number, post }),
};

export function counts(findings) {
  return Object.fromEntries(SEVERITIES.map((s) => [s, (findings || []).filter((f) => f.severity === s).length]));
}
export default codeReviewApi;
