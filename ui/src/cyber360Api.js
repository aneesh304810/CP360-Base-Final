// Cyber Security 360 — the application inventory's API client and the
// starter inventory. Self-contained like pbnotifyReviewApi.js: nothing
// here touches api.js.
//
// THE STARTER INVENTORY is read from the Application Scans thread (2 Nov
// 2026): the applications that do not go through the application scan,
// each with the constraint its owner gave and the control that would
// cover it instead. constraint_valid is TBD on every one, because the
// thread asks the group to decide exactly that. SaaS products are a class
// with no starter rows: they are added as they are inventoried.
//
// LOCALSTORAGE IS THE FALLBACK, AND THE PAGE SAYS SO. With no API the
// inventory still works on this browser's own copy and the header says
// "local only". No row carries a hostname, an address or a person's name;
// runtime is a schedule or platform name and the owner is a team.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PATH = "/cyber360";
const KEY = "cp360-cyber360-apps";
const NAME_KEY = "cp360-reviewer-name";
const T = 8000;

export const CLASSES = {
  HOME_GROWN: "Home-grown", VENDOR_MANAGED_CODE: "Vendor, code managed by us", VENDOR_PACKAGE: "Vendor package", SAAS: "SaaS",
};
export const SURFACES = { WEB: "Web", API: "API", BATCH: "Batch", SERVICE: "Service", DESKTOP: "Desktop", PLATFORM: "Platform" };
export const SCAN = { UNKNOWN: "Not yet declared", SCANNED: "Scanned", SERVER_ONLY: "Server scan only", NOT_SCANNED: "Not scanned" };
export const CONSTRAINTS = {
  NONE: "No constraint", NO_WEB_SURFACE: "No web or API surface", VENDOR_BINARY: "Vendor binaries, no source", DESKTOP_EMULATOR: "Desktop terminal emulator",
  SERVER_SCAN_ONLY: "Covered by the server scan", LEGACY_STACK_RETIRING: "Legacy stack, retiring", SAAS_VENDOR_HOSTED: "Vendor hosted (SaaS)", OTHER: "Other",
};
export const VALID = { YES: "Accepted", NO: "Not accepted: scan it", TBD: "To review" };
export const LIFECYCLE = { ACTIVE: "Active", RETIRING: "Retiring", RETIRED: "Retired" };
// On the BBH DevSecOps security pipeline (the shared Jenkins library: checkout,
// unit tests, Nexus IQ, SonarQube, AppScan SAST, DAST where there is a web surface)?
export const DEVSECOPS = { NONE: "Not integrated", PARTIAL: "Partly integrated", INTEGRATED: "Integrated", NOT_APPLICABLE: "Not applicable" };
export const DEVSECOPS_COLOR = { NONE: "#c1113a", PARTIAL: "#b45309", INTEGRATED: "#159943", NOT_APPLICABLE: "#6b7884" };
export const SCAN_COLOR = { UNKNOWN: "#6b7884", SCANNED: "#159943", SERVER_ONLY: "#b45309", NOT_SCANNED: "#c1113a" };
export const VALID_COLOR = { YES: "#159943", NO: "#c1113a", TBD: "#b45309" };

// What the thread says the scan covers, as policy the inventory is read against.
export const POLICY = [
  { key: "web", text: "Every application that runs on the web goes through the application scan, APIs and web interfaces included.", covers: "SCANNED" },
  { key: "rmj", text: ".NET utilities, KSH programs and Java code that run exclusively under RMJ schedules do not go through the application scan.", covers: "NOT_SCANNED" },
  { key: "sharepoint", text: "SharePoint goes through the server scan only, because the SharePoint install is part of the server setup.", covers: "SERVER_ONLY" },
  { key: "review", text: "For each application not scanned the group needs to understand why. With no technical or other valid constraint, it gets scanned.", covers: null },
];

const THREAD = "Application Scans thread, 2 Nov 2026";
const RMJ = "Batch work under an RMJ schedule with no web or API interface; the application scan targets web applications and APIs.";
const SAST = "Static code scan (SAST) of the repository and a dependency scan in the build; the server scan covers the host.";
const hg = (id, name, category, runtime, stack, surface, text, control, extra = {}) => ({
  app_id: id, app_name: name, app_class: "HOME_GROWN", category, runtime, tech_stack: stack, surface, scan_status: "NOT_SCANNED", scan_types: "",
  constraint_kind: "NO_WEB_SURFACE", constraint_text: text, constraint_valid: "TBD", recommended_control: control,
  action: "Confirm with the scan group whether a code scan applies; schedule it if so.", owner_team: "", devsecops_integration: "NONE", devsecops_detail: "",
  lifecycle: "ACTIVE", notes: "", source_ref: THREAD, ...extra,
});
const vp = (id, name, category, runtime, surface, kind, text, control, extra = {}) => ({
  app_id: id, app_name: name, app_class: "VENDOR_PACKAGE", category, runtime, tech_stack: "", surface, scan_status: "NOT_SCANNED", scan_types: "",
  constraint_kind: kind, constraint_text: text, constraint_valid: "TBD", recommended_control: control,
  action: "Ask the vendor for its own application-security attestation; confirm the server scan covers the host.", owner_team: "", devsecops_integration: "NOT_APPLICABLE",
  devsecops_detail: "Vendor binaries: no pipeline of ours builds it.", lifecycle: "ACTIVE", notes: "", source_ref: THREAD, ...extra,
});

export const SEED = [
  hg("CS-001", "Quarterly Tax Program (QTP)", ".NET utility", "RMJ schedule", ".NET", "BATCH", RMJ, SAST),
  hg("CS-002", "STP Post", ".NET utility", "RMJ schedule", ".NET", "BATCH", RMJ, SAST),
  hg("CS-003", "BBH_PB_Interfaces", "Windows service", "RMJ schedule (P09)", ".NET", "SERVICE", "Windows service that runs exclusively under the RMJ schedule; no web or API interface.", SAST),
  hg("CS-004", "Legacy P08 jobs", "Windows services", "RMJ schedule (P08)", ".NET", "SERVICE", "Windows services that run exclusively under the RMJ schedule; no web or API interface.", SAST,
    { notes: "One row for the group; list the individual jobs as they are inventoried." }),
  hg("CS-005", "FXD auto user enrollment", "Windows service", "RMJ schedule", ".NET", "SERVICE", "Windows service that runs exclusively under the RMJ schedule; no web or API interface.", SAST),
  hg("CS-006", "KSH / shell scripts under RMJ", "Shell scripts", "RMJ schedule", "KSH", "BATCH", RMJ, "Script review and a secrets scan of the repository; the server scan covers the host."),
  hg("CS-007", "Java jobs under RMJ", "Java batch", "RMJ schedule", "Java", "BATCH", RMJ, SAST),
  hg("CS-008", "Python jobs under RMJ", "Python batch", "RMJ schedule", "Python", "BATCH", RMJ, SAST),
  hg("CS-009", "Email Tool", "Web application", "Tomcat", "Java (Tomcat)", "WEB",
    "Web application on an old technology stack; it is not scanned and retirement is in progress.",
    "A web application is in scope of the scan policy: scan it now, or set a retirement date the group accepts and track it here.",
    { constraint_kind: "LEGACY_STACK_RETIRING", lifecycle: "RETIRING", action: "Decide: scan before retirement, or an accepted retirement date with the exception recorded." }),
  vp("CS-010", "EFTPS", "Treasury batch payment software", "Vendor package", "BATCH", "VENDOR_BINARY",
    "Vendor-supplied batch payment software; no source to scan and no web interface of ours.", "Vendor attestation; server scan of the host; payment-file controls."),
  vp("CS-011", "Universal Client", "Mainframe terminal emulator for BankTrade", "Desktop", "DESKTOP", "DESKTOP_EMULATOR",
    "Desktop terminal emulator; no web or API surface of ours.", "Vendor attestation; endpoint controls on the desktop; server scan of BankTrade hosts."),
  vp("CS-012", "Trade Services / Peachtree backend processes", "Vendor backend services (communication, imaging, BIS)", "Vendor package", "SERVICE", "VENDOR_BINARY",
    "Vendor backend processes for communication, imaging and BIS; no source to scan.", "Vendor attestation; server scan of the hosts."),
  vp("CS-013", "SharePoint", "Collaboration platform", "Platform", "PLATFORM", "SERVER_SCAN_ONLY",
    "The SharePoint install is part of the server setup; it goes through the server scan.", "Server scan (in place).",
    { scan_status: "SERVER_ONLY", scan_types: "server", constraint_valid: "YES", action: "None: covered by the server scan as the thread states." }),
];

export const blankApp = () => ({
  app_id: "", app_name: "", app_class: "HOME_GROWN", category: "", runtime: "", tech_stack: "", surface: "WEB", scan_status: "NOT_SCANNED", scan_types: "",
  constraint_kind: "NONE", constraint_text: "", constraint_valid: "TBD", recommended_control: "", action: "", owner_team: "", devsecops_integration: "NONE", devsecops_detail: "",
  lifecycle: "ACTIVE", notes: "", source_ref: "",
});

export function summarise(apps) {
  const live = apps.filter((a) => a.lifecycle !== "RETIRED");
  const un = live.filter((a) => a.scan_status === "SERVER_ONLY" || a.scan_status === "NOT_SCANNED");
  const n = (f) => apps.filter(f).length;
  return {
    apps: apps.length, scanned: n((a) => a.scan_status === "SCANNED"), serverOnly: n((a) => a.scan_status === "SERVER_ONLY"), notScanned: n((a) => a.scan_status === "NOT_SCANNED"),
    unknown: n((a) => !a.scan_status || a.scan_status === "UNKNOWN"),
    retiring: n((a) => a.lifecycle === "RETIRING"), toScan: un.filter((a) => a.constraint_valid === "NO").length,
    toReview: un.filter((a) => (a.constraint_valid || "TBD") === "TBD").length, accepted: un.filter((a) => a.constraint_valid === "YES").length,
    byClass: Object.fromEntries(Object.keys(CLASSES).map((c) => [c, n((a) => a.app_class === c)])),
  };
}

// The list the thread asks for: every application not scanned, grouped by
// the constraint, as Markdown for the reply. Names, not people.
export function unscannedMarkdown(apps) {
  const rows = apps.filter((a) => (a.scan_status === "NOT_SCANNED" || a.scan_status === "SERVER_ONLY") && a.lifecycle !== "RETIRED");
  const out = ["# Applications not covered by the application scan", "", `${rows.length} applications. For each: why it is not scanned, whether the constraint is accepted, and what covers it instead.`, ""];
  for (const k of Object.keys(CONSTRAINTS)) {
    const g = rows.filter((a) => (a.constraint_kind || "NONE") === k);
    if (!g.length) continue;
    out.push(`## ${CONSTRAINTS[k]} (${g.length})`, "", "| Application | Class | Runtime | Scan today | Why | Decision | Covering control | DevSecOps | Action |", "|---|---|---|---|---|---|---|---|---|");
    for (const a of g) {
      const c = (v) => String(v || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
      out.push(`| ${c(a.app_name)} | ${CLASSES[a.app_class] || a.app_class} | ${c(a.runtime)} | ${SCAN[a.scan_status] || a.scan_status} | ${c(a.constraint_text)} | ${VALID[a.constraint_valid] || "To review"} | ${c(a.recommended_control)} | ${DEVSECOPS[a.devsecops_integration] || "Not integrated"} | ${c(a.action)} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function toCsv(apps) {
  const cols = Object.keys(blankApp());
  const esc = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...apps.map((a) => cols.map((c) => esc(a[c])).join(","))].join("\n");
}

// THE STARTER INVENTORY IS INTERFACE 360. Every system Interface 360 knows
// becomes a row with what it knows: the owner its interfaces name, the
// project, the interface counts, whether it carries PII; scan status not
// yet declared. The thread's rows are added where no system has the same
// name. A system named VENDOR or EXTERNAL by its party is a vendor package.
export const classForParty = (party) => (/VENDOR|EXTERNAL|THIRD/i.test(String(party || "")) ? "VENDOR_PACKAGE" : "HOME_GROWN");
export function appFromSystem(x) {
  return { ...blankApp(), app_id: "IF-" + String(x.system || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 36), app_name: x.system, app_class: classForParty(x.party),
    category: x.party ? `Interface 360 system (${x.party})` : "Interface 360 system", surface: "", scan_status: "UNKNOWN", owner_team: x.owner || "",
    notes: `Interface 360: ${x.interfaces || 0} interfaces (${x.inbound || 0} in, ${x.outbound || 0} out)` + (x.projectId ? `; project ${x.projectId}` : "") + (x.carriesPii ? "; carries PII" : ""),
    source_ref: "Interface 360 system" + (x.ownerSource ? `; owner from ${x.ownerSource}` : "") };
}
export function starterFromSystems(systems, seed = SEED) {
  const fromSystems = (systems || []).map(appFromSystem);
  const names = new Set(fromSystems.map((a) => a.app_name.toUpperCase()));
  return [...fromSystems, ...seed.filter((a) => !names.has(a.app_name.toUpperCase())).map((a) => ({ ...a }))];
}

export function loadLocal() {
  try { const raw = localStorage.getItem(KEY); const j = raw ? JSON.parse(raw) : null; return j && Array.isArray(j.apps) ? j : null; } catch { return null; }
}
export function saveLocal(apps, log) {
  try { localStorage.setItem(KEY, JSON.stringify({ apps, log: (log || []).slice(0, 500) })); } catch { /* quota or private window */ }
}
export function reviewerName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } }
export function setReviewerName(name) { try { localStorage.setItem(NAME_KEY, String(name || "").trim().slice(0, 120)); } catch { /* ignore */ } }

// {apps, log, live, seeded}. live false: this browser's copy. seeded true: the
// shipped starter, not yet saved anywhere.
export async function load() {
  try {
    const r = await fetch(`${API_BASE}${PATH}/apps`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if ((j.apps || []).length) return { apps: j.apps, log: j.log || [], live: true, seeded: false };
    const sy = await systems();
    const apps = starterFromSystems(sy.systems || []);
    return { apps, log: [], live: true, seeded: true, starter: { systems: (sy.systems || []).length, thread: apps.length - (sy.systems || []).length } };
  } catch {
    const local = loadLocal();
    if (local) return { apps: local.apps, log: local.log || [], live: false, seeded: false };
    return { apps: SEED.map((a) => ({ ...a })), log: [], live: false, seeded: true };
  }
}

async function post(path, body) {
  try {
    const r = await fetch(`${API_BASE}${PATH}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(T) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { error: j.detail || `HTTP ${r.status}` }; }
    return await r.json();
  } catch (e) { return { error: String((e && e.message) || e), offline: true }; }
}
export const save = (app, actor) => post("/apps/save", { app, actor });
export const seed = (apps, actor) => post("/apps/seed", { apps, actor });
export const importSystems = (systems, actor) => post("/apps/import", { systems, actor });
export const uploadXlsx = (filename, content_b64, actor) => post("/apps/upload", { filename, content_b64, actor });
export const xlsxUrl = () => `${API_BASE}${PATH}/apps.xlsx`;
// The workbook for the rows the page shows, saved or not; null when the API cannot answer.
export async function exportXlsx(apps) {
  try {
    const r = await fetch(`${API_BASE}${PATH}/apps/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apps }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    return await r.blob();
  } catch { return null; }
}
export async function systems() {
  try { const r = await fetch(`${API_BASE}${PATH}/systems`, { signal: AbortSignal.timeout(T) }); return r.ok ? await r.json() : { systems: [], error: `HTTP ${r.status}` }; }
  catch (e) { return { systems: [], error: String((e && e.message) || e) }; }
}
export async function whoami() {
  try { const r = await fetch(`${API_BASE}${PATH}/whoami`, { signal: AbortSignal.timeout(T) }); return r.ok ? await r.json() : { verified: false }; } catch { return { verified: false }; }
}

// The local mirror of a save: the same row replaced, one log line per changed field.
export function applyLocal(apps, log, app, actor) {
  const id = app.app_id || `cs${Date.now()}`;
  const next = { ...app, app_id: id, updated_by: actor, updated_at: new Date().toISOString().slice(0, 16).replace("T", " ") };
  const before = apps.find((a) => a.app_id === id);
  const lines = Object.keys(blankApp()).filter((f) => f !== "app_id" && ((before || {})[f] || "") !== (next[f] || ""))
    .map((f) => ({ id: `l${Date.now()}${f}`, appId: id, field: f, before: (before || {})[f] || null, after: next[f] || null, author: actor, idSource: "none", at: next.updated_at }));
  return { apps: before ? apps.map((a) => (a.app_id === id ? next : a)) : [...apps, next], log: [...lines, ...(log || [])].slice(0, 500) };
}

export default { load, save, seed, importSystems, uploadXlsx, exportXlsx, systems, xlsxUrl, whoami, starterFromSystems, appFromSystem, loadLocal, saveLocal, reviewerName, setReviewerName, applyLocal, summarise, unscannedMarkdown, toCsv, SEED, blankApp };
