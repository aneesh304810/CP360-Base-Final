// Sign-in and entitlement client.
//
// TWO RULES THAT ARE NOT NEGOTIABLE HERE.
//
// 1. Every call sends credentials. The session is an HttpOnly cookie, so
//    JavaScript cannot read it and cannot attach it by hand; omit
//    `credentials` and fetch quietly drops it cross-origin, which looks
//    exactly like "signed in, then immediately signed out again".
//
// 2. Nothing falls back. Every other client in this app degrades to an
//    empty shape so a screen renders with nothing in it. That pattern is
//    correct for a catalogue and wrong for a control: an entitlement
//    screen that answers "no modules" when the API is down is a screen
//    that silently strips somebody's access, and a login that swallows
//    its own error leaves a person typing a correct password into a
//    form that never says no. So these throw, and the screens say what
//    went wrong.
//
// The one exception is `me()`, which has a defined answer for "the API is
// not there": not signed in, no filtering. It is the only call made
// before the app has drawn anything, and throwing there means a blank
// page instead of an app.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _call(path, { method = "GET", body } = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let payload = null;
  try { payload = await r.json(); } catch { /* an error page, not JSON */ }
  if (!r.ok) {
    // FastAPI puts the message in `detail`. Showing the status code alone
    // turns "your account is disabled" into "403", which sends the person
    // to the help desk instead of to their administrator.
    const e = new Error((payload && payload.detail) || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return payload || {};
}

// `modules: null` means do not filter the navigation; an array means show
// exactly these. The distinction matters — [] is a real answer (somebody
// signed in with nothing granted yet) and must hide the sidebar, while
// null is "enforcement is off" and must leave it alone.
export const OFF = { authenticated: false, mode: "off", user: null,
                     modules: null, is_admin: false };

export const securityApi = {
  me: () => _call("/auth/me").catch(() => ({ ...OFF, unreachable: true })),
  login: (username, password) =>
    _call("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => _call("/auth/logout", { method: "POST" }),

  health: () => _call("/security/health"),
  modules: () => _call("/security/modules"),
  users: (q) => _call(`/security/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  user: (id) => _call(`/security/user/${encodeURIComponent(id)}`),
  saveUser: (u) => _call("/security/user", { method: "POST", body: u }),
  saveGrants: (user_id, modules, note) =>
    _call("/security/grants", { method: "POST", body: { user_id, modules, note } }),
  audit: (target, limit = 100) =>
    _call(`/security/audit?limit=${limit}${target ? `&target=${encodeURIComponent(target)}` : ""}`),
};

// ---- navigation filtering ----------------------------------------------
// Kept here rather than in AppShell so it can be tested without a DOM, and
// so the one rule that matters -- null leaves the sidebar alone -- lives in
// one place instead of being re-decided at each call site.

export function allowed(modules, key) {
  if (modules === null || modules === undefined) return true;
  return modules.indexOf(key) !== -1;
}

/** Drop items nobody may open, then drop groups left empty. */
export function filterNav(groups, modules) {
  if (modules === null || modules === undefined) return groups;
  const keep = new Set(modules);
  return (groups || [])
    .map((g) => ({ ...g, items: (g.items || []).filter((it) => keep.has(it[0])) }))
    .filter((g) => g.items.length > 0);
}
