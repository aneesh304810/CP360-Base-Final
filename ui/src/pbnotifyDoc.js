// PB Notifications — the design as one Markdown document, both ways.
//
// toMarkdown writes the whole design (every table on every tab, the DAG
// code, the data model) as a Markdown file a person or a model can edit:
// headings, GFM tables with named columns, fenced code. fromMarkdown reads
// such a file back into the same design shape, finds each section by its
// marker comment or, when a marker was lost, by its heading, maps columns
// by header name so a reordered table still reads, validates the marks
// and ids, and reports per section what changed. The page then renders
// from the ingested design instead of the shipped constants.
//
// No client data is in a design document: table and column names, rules,
// counts and the reviewers' words.
export const DOC_VERSION = 1;
export const MARKS = ["REQUIRED", "PROPOSED", "OPEN"];
export const OUTCOMES = ["HOLD", "SKIP", "REJECT", "RETRY", "FLAG", "OPEN"];

// One entry per section: where it lives in the design, how it is written
// and read. `cols` are the table headers; `shape` arrays or objects.
export const SECTIONS = [
  { key: "background", path: "background", kind: "list", title: "Background" },
  { key: "enhancement", path: "enhancement", kind: "para", title: "The enhancement" },
  { key: "actors", path: "actors", kind: "table", title: "Actors and systems", cols: ["Actor · system", "Role", "Mark"], mark: 2 },
  { key: "requirements", path: "requirements", kind: "table", title: "Requirements", cols: ["#", "Requirement", "Mark"], id: 0, mark: 2 },
  { key: "brTrace", path: "brTrace", kind: "table", title: "Traceability to BR-01 to BR-15", cols: ["BR", "Requirement", "Where it lands"], id: 0 },
  { key: "types", path: "types", kind: "table", title: "Notification types", shape: "objects", fields: ["key", "title", "source", "posted", "preference", "outcome", "always"],
    cols: ["Key", "Title", "Reads", "Posted today when", "Preference", "Outcome", "Always sent"], id: 0, bool: ["always"] },
  { key: "grid", path: "grid", kind: "table", title: "Notification type grid", cols: ["Type", "Frequency · send time", "Business trigger", "Preference and consolidation", "E-mail outcome"], id: 0 },
  { key: "trackingFields", path: "trackingFields", kind: "table", title: "Tracking fields", cols: ["Field", "Meaning"], id: 0 },
  { key: "statuses", path: "statuses", kind: "table", title: "Statuses", cols: ["Status", "Meaning"], id: 0 },
  { key: "hldFlows", path: "hldFlows", kind: "table", title: "High-level design flows", cols: ["#", "Flow"], id: 0 },
  { key: "steps", path: "steps", kind: "table", title: "Processing steps", cols: ["Step", "Action", "Output", "DAG task"], id: 0 },
  { key: "lifecycle", path: "lifecycle", kind: "table", title: "Status lifecycle", cols: ["From", "To", "When", "Task"] },
  { key: "flow", path: "flow", kind: "table", title: "The run on the Hub", cols: ["#", "Task", "What it does", "Mark"], numbered: true, mark: 2 },
  { key: "modes", path: "modes", kind: "table", title: "Proof of concept now, Oracle when built", cols: ["Concern", "Proof of concept · Excel", "Built · Oracle"], id: 0 },
  { key: "hubFit", path: "hubFit", kind: "table", title: "Why it is built on the Integration Hub", cols: ["Concern", "On the Hub", "Component"], id: 0 },
  { key: "dagSettings", path: "orchestration.dag", kind: "table", title: "DAG settings", cols: ["Setting", "Value", "Why"], id: 0 },
  { key: "dagTasks", path: "orchestration.tasks", kind: "table", title: "DAG tasks", cols: ["Task", "Operator · where it runs", "What it does", "Writes", "On failure"], id: 0 },
  { key: "dagDeps", path: "orchestration.deps", kind: "line", title: "DAG dependencies" },
  { key: "bounceDagSettings", path: "orchestration.bounce.dag", kind: "table", title: "Bounce DAG settings", cols: ["Setting", "Value"], id: 0 },
  { key: "bounceDagTasks", path: "orchestration.bounce.tasks", kind: "table", title: "Bounce DAG tasks", cols: ["Task", "Operator · where it runs", "What it does", "Writes", "On failure"], id: 0 },
  { key: "bounceDagDeps", path: "orchestration.bounce.deps", kind: "line", title: "Bounce DAG dependencies" },
  { key: "dagRules", path: "orchestration.rules", kind: "list", title: "Orchestration rules" },
  { key: "repoLayout", path: "repoLayout", kind: "table", title: "Repository layout", cols: ["Path in the application repository", "Holds"], id: 0 },
  { key: "dagCode", path: "dagCode", kind: "code", title: "Code · the daily DAG" },
  { key: "bounceDagCode", path: "bounceDagCode", kind: "code", title: "Code · the bounce-check DAG" },
  { key: "podHelper", path: "podHelper", kind: "code", title: "Code · the shared pod helper" },
  { key: "bounceHow", path: "bounce.how", kind: "table", title: "Bounce detection", cols: ["Concern", "How", "Why this way"], id: 0 },
  { key: "bounceAlerts", path: "bounce.alerts", kind: "table", title: "Bounce alerts", cols: ["Who is told", "What", "What is left out", "Mark"], id: 0, mark: 3 },
  { key: "bounceColumns", path: "bounce.columns", kind: "table", title: "Bounce columns on the tracking table", cols: ["Column", "Type", "Meaning"], id: 0 },
  { key: "model.candidate", path: "model.candidate", kind: "model", title: "PB_NOTIFICATION_CANDIDATE" },
  { key: "model.detail", path: "model.detail", kind: "model", title: "PB_NOTIFICATION_K1_DETAIL" },
  { key: "model.tracking", path: "model.tracking", kind: "model", title: "PB_NOTIFICATION_TRACKING" },
  { key: "sourceTables", path: "sourceTables", kind: "table", title: "Source data model", cols: ["Table", "Schema", "Purpose", "Key fields"], id: 0 },
  { key: "sources", path: "sources", kind: "table", title: "The four extracts", shape: "objects", fields: ["file", "purpose", "grain", "rows", "unmatched", "cols", "profile", "fit"],
    cols: ["File", "Purpose", "Grain", "Rows", "Unmatched ids", "Columns", "Profile", "Fit"], id: 0, int: ["rows", "unmatched"], list: ["cols"] },
  { key: "joins", path: "joins", kind: "table", title: "Join rules", cols: ["Source", "Key", "Joins to the address on"], id: 0 },
  { key: "sender", path: "sender", kind: "line", title: "Sender" },
  { key: "content", path: "content", kind: "table", title: "The five e-mails", shape: "objects", fields: ["key", "when", "subject", "body", "fields"],
    cols: ["Template", "Sent when", "Subject", "Body", "Fields it needs"], id: 0 },
  { key: "tests", path: "tests", kind: "table", title: "Test scenarios", cols: ["#", "Scenario", "Expected", "Decided by"], id: 0 },
  { key: "gaps", path: "gaps", kind: "table", title: "Open gaps", cols: ["#", "Class", "Finding", "Proposed resolution", "Mark"], id: 0, mark: 4 },
  { key: "openItems", path: "openItems", kind: "table", title: "The document's open items", cols: ["#", "Item", "Where it lands"], id: 0 },
  { key: "exceptions", path: "exceptions", kind: "table", title: "Exceptions", cols: ["Scenario", "Detected by", "What the utility does", "Outcome"], id: 0, outcome: 3 },
];
const BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));

// The document's order: headings and the sections under them.
const LAYOUT = [
  ["##", "1. Background", "background"], ["##", "2. The enhancement", "enhancement"], ["##", "3. Actors and systems", "actors"],
  ["##", "4. Requirements", "requirements"], ["###", "Traceability to BR-01 to BR-15", "brTrace"], ["###", "Notification types", "types"],
  ["###", "Notification type grid", "grid"], ["###", "Tracking fields", "trackingFields"], ["###", "Statuses", "statuses"],
  ["##", "5. End-to-end flow", null], ["###", "High-level design flows", "hldFlows"], ["###", "Processing steps", "steps"], ["###", "Status lifecycle", "lifecycle"],
  ["##", "6. Design on the Hub", null], ["###", "The run on the Hub", "flow"], ["###", "Proof of concept now, Oracle when built", "modes"], ["###", "Why it is built on the Integration Hub", "hubFit"],
  ["##", "7. Airflow orchestration", null], ["###", "DAG settings", "dagSettings"], ["###", "DAG tasks", "dagTasks"], ["###", "DAG dependencies", "dagDeps"],
  ["###", "Bounce DAG settings", "bounceDagSettings"], ["###", "Bounce DAG tasks", "bounceDagTasks"], ["###", "Bounce DAG dependencies", "bounceDagDeps"], ["###", "Orchestration rules", "dagRules"],
  ["###", "Repository layout", "repoLayout"], ["###", "Code · the daily DAG", "dagCode"], ["###", "Code · the bounce-check DAG", "bounceDagCode"], ["###", "Code · the shared pod helper", "podHelper"],
  ["##", "8. Bounce detection", "bounceHow"], ["###", "Bounce alerts", "bounceAlerts"], ["###", "Bounce columns on the tracking table", "bounceColumns"],
  ["##", "9. Data model", null], ["###", "PB_NOTIFICATION_CANDIDATE", "model.candidate"], ["###", "PB_NOTIFICATION_K1_DETAIL", "model.detail"], ["###", "PB_NOTIFICATION_TRACKING", "model.tracking"], ["###", "Source data model", "sourceTables"],
  ["##", "10. Source review", null], ["###", "The four extracts", "sources"], ["###", "Join rules", "joins"],
  ["##", "11. E-mail content", null], ["###", "Sender", "sender"], ["###", "The five e-mails", "content"],
  ["##", "12. Test scenarios", "tests"], ["##", "13. Open gaps", "gaps"], ["###", "The document's open items", "openItems"], ["##", "14. Exceptions", "exceptions"],
];

// ------------------------------------------------------------- helpers
const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const set = (o, path, v) => { const ks = path.split("."); let c = o; ks.slice(0, -1).forEach((k) => { if (c[k] == null || typeof c[k] !== "object") c[k] = {}; c = c[k]; }); c[ks[ks.length - 1]] = v; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (v) => String(v == null ? "" : v).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
const cells = (line) => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
};
const isSep = (line) => /^\s*\|?\s*:?-{2,}/.test(line) && /^[\s|:\-]+$/.test(line);
const table = (cols, rows) => [`| ${cols.map(esc).join(" | ")} |`, `| ${cols.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");

function rowsOf(spec, value) {
  if (spec.shape === "objects") return (value || []).map((o) => spec.fields.map((f) => {
    if (spec.bool && spec.bool.includes(f)) return o[f] ? "yes" : "no";
    if (spec.list && spec.list.includes(f)) return (o[f] || []).join(" · ");
    return o[f];
  }));
  if (spec.numbered) return (value || []).map((r, i) => [i + 1, ...r]);
  return (value || []).map((r) => [...r]);
}

function writeSection(spec, design) {
  const v = get(design, spec.path);
  const marker = `<!-- pbn: ${spec.key} -->`;
  if (spec.kind === "list") return `${marker}\n${(v || []).map((p) => `- ${esc(p)}`).join("\n")}`;
  if (spec.kind === "para") return `${marker}\n${esc(v)}`;
  if (spec.kind === "line") return `${marker}\n${esc(v)}`;
  if (spec.kind === "code") return `${marker}\n\`\`\`python\n${String(v || "").replace(/```/g, "'''")}\n\`\`\``;
  if (spec.kind === "model") {
    const m = v || {};
    return `${marker}\n**Name:** ${esc(m.name)}\n**Grain:** ${esc(m.grain)}\n**Keys:** ${esc(m.keys)}\n\n${table(["Column", "Type", "Meaning"], m.cols || [])}`;
  }
  return `${marker}\n${table(spec.cols, rowsOf(spec, v))}`;
}

// ------------------------------------------------------------- export
export function toMarkdown(design, opts = {}) {
  const at = opts.exportedAt || new Date().toISOString().slice(0, 16).replace("T", " ");
  const out = [
    `# PB Notifications · design document`,
    ``,
    `<!-- pbn-design format ${DOC_VERSION} · exported ${at}${opts.version != null ? ` · from design version ${opts.version}` : ""}${opts.author ? ` · by ${esc(opts.author)}` : ""} -->`,
    `<!-- This file round-trips. Edit the tables, lists and code; keep the headings and the column names; keep one line per cell (a | inside a cell is written \\|). Marks are REQUIRED, PROPOSED or OPEN; outcomes are ${OUTCOMES.join(", ")}. Ingest it on the PB Notifications page, Document tab, and the whole design updates. -->`,
    ``,
    `**Ticket:** PBCP-5587 · Build Email Notification from Client Portal`,
    `**Status:** DESIGN · OPEN`,
    `**Rule:** no user id, account number, e-mail address or hostname in this document. Table and column names, rules and counts only.`,
    ``,
  ];
  for (const [h, title, key] of LAYOUT) {
    out.push(`${h} ${title}`, "");
    if (key) out.push(writeSection(BY_KEY[key], design), "");
  }
  if (opts.review && (opts.review.notes || []).length) {
    out.push(`## 15. Review notes`, "", `<!-- pbn: review (export only: the page keeps questions and comments in its own tables; this section is not read back) -->`,
      table(["Item", "Kind", "Status", "By", "At", "Note"], opts.review.notes.map((n) => [n.itemKey, n.kind, n.kind === "question" ? n.status : "", n.author, n.at, n.body])), "");
  }
  return out.join("\n");
}

// ------------------------------------------------------------- import
const TITLE_KEY = Object.fromEntries(SECTIONS.map((s) => [norm(s.title), s.key]));
for (const [, title, key] of LAYOUT) if (key) TITLE_KEY[norm(title.replace(/^\d+\.\s*/, ""))] = key;

function segments(md) {
  // Each section's lines, found by its marker or, failing that, its heading.
  const segs = [];
  let cur = null;
  const close = () => { if (cur) segs.push(cur); cur = null; };
  let fence = false;   // a "# comment" inside a code block is not a heading
  for (const raw of String(md || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(raw)) { fence = !fence; if (cur) cur.lines.push(raw); continue; }
    if (fence) { if (cur) cur.lines.push(raw); continue; }
    const m = raw.match(/^<!--\s*pbn:\s*([A-Za-z.]+)/);
    if (m) { close(); cur = { key: m[1], lines: [], via: "marker" }; continue; }
    const h = raw.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { close(); const k = TITLE_KEY[norm(h[2].replace(/^\d+\.\s*/, ""))]; if (k) cur = { key: k, lines: [], via: "heading" }; continue; }
    if (cur) cur.lines.push(raw);
  }
  close();
  const by = {};
  for (const s of segs) {
    const has = s.lines.some((l) => l.trim() && !/^<!--/.test(l.trim()));
    if (!has) continue;
    if (by[s.key] && by[s.key].via === "marker" && s.via === "heading") continue;
    by[s.key] = s;
  }
  return by;
}

function parseTable(lines, cols) {
  let i = 0;
  while (i < lines.length - 1 && !(lines[i].trim().startsWith("|") && isSep(lines[i + 1]))) i++;
  if (i >= lines.length - 1) return { error: "no table found" };
  const head = cells(lines[i]).map(norm);
  const idx = cols.map((c) => head.indexOf(norm(c)));
  const missing = cols.filter((c, j) => idx[j] < 0);
  if (missing.length) return { error: `missing column(s): ${missing.join(", ")}` };
  const rows = [];
  for (let j = i + 2; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim().startsWith("|")) { if (l.trim() === "") continue; break; }
    const cs = cells(l);
    if (cs.every((c) => c === "")) continue;
    rows.push(idx.map((k) => cs[k] == null ? "" : cs[k]));
  }
  return { rows };
}
const stripLabel = (s) => s.replace(/^\*\*[^*]+:\*\*\s*/, "").trim();

function readSection(spec, lines) {
  const body = lines.filter((l) => !/^\s*<!--.*-->\s*$/.test(l));
  if (spec.kind === "list") {
    const items = body.filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).map((l) => l.replace(/^\s*([-*]|\d+\.)\s+/, "").trim()).filter(Boolean);
    return items.length ? { value: items } : { error: "no list items" };
  }
  if (spec.kind === "para" || spec.kind === "line") {
    const txt = body.map((l) => l.trim()).filter(Boolean).map(stripLabel).join(" ").trim();
    return txt ? { value: txt } : { error: "empty" };
  }
  if (spec.kind === "code") {
    const a = body.findIndex((l) => /^```/.test(l.trim()));
    if (a < 0) return { error: "no code fence" };
    const b = body.findIndex((l, i) => i > a && /^```/.test(l.trim()));
    return { value: body.slice(a + 1, b < 0 ? undefined : b).join("\n") };
  }
  if (spec.kind === "model") {
    const kv = (label) => { const l = body.find((x) => new RegExp(`^\\*\\*${label}:\\*\\*`, "i").test(x.trim())); return l ? stripLabel(l.trim()) : ""; };
    const t = parseTable(body, ["Column", "Type", "Meaning"]);
    if (t.error) return t;
    const name = kv("Name");
    if (!name) return { error: "no **Name:** line" };
    return { value: { name, grain: kv("Grain"), cols: t.rows, keys: kv("Keys") } };
  }
  const t = parseTable(body, spec.cols);
  if (t.error) return t;
  let rows = t.rows;
  if (spec.numbered) rows = rows.map((r) => r.slice(1));
  const problems = [];
  rows.forEach((r, i) => {
    if (spec.id != null && !String(r[spec.id] || "").trim()) problems.push(`row ${i + 1}: empty ${spec.cols[spec.id]}`);
    const mc = spec.numbered ? spec.mark : spec.mark;
    if (mc != null) { const m = String(r[mc] || "").trim().toUpperCase(); if (!MARKS.includes(m)) problems.push(`row ${i + 1}: mark "${r[mc]}" is not one of ${MARKS.join(", ")}`); else r[mc] = m; }
    if (spec.outcome != null) { const o = String(r[spec.outcome] || "").trim().toUpperCase(); if (!OUTCOMES.includes(o)) problems.push(`row ${i + 1}: outcome "${r[spec.outcome]}" is not one of ${OUTCOMES.join(", ")}`); else r[spec.outcome] = o; }
  });
  if (problems.length) return { error: problems.slice(0, 4).join("; ") + (problems.length > 4 ? ` (+${problems.length - 4} more)` : "") };
  if (!rows.length) return { error: "no rows" };
  if (spec.shape === "objects") {
    rows = rows.map((r) => { const o = {}; spec.fields.forEach((f, j) => {
      let v = r[j];
      if (spec.bool && spec.bool.includes(f)) v = /^(y|yes|true|always)/i.test(v);
      else if (spec.int && spec.int.includes(f)) v = parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0;
      else if (spec.list && spec.list.includes(f)) v = String(v).split(/\s*·\s*|\s*,\s*/).filter(Boolean);
      o[f] = v; }); return o; });
  }
  return { value: rows };
}

// Parse a document against a base design. Returns {design, report, errors, found}.
// A section missing from the file keeps the base value and is reported as
// such; a section that fails to read is an error and nothing is applied.
export function fromMarkdown(md, base) {
  const segs = segments(md);
  const design = clone(base);
  const report = [], errors = [];
  if (!Object.keys(segs).length) { errors.push("no PB Notifications sections found: the file needs the headings or the pbn markers"); return { design: base, report, errors, found: 0 }; }
  for (const spec of SECTIONS) {
    const seg = segs[spec.key];
    const before = get(base, spec.path);
    const size = (v) => Array.isArray(v) ? v.length : v && typeof v === "object" && Array.isArray(v.cols) ? v.cols.length : v ? 1 : 0;
    if (!seg) { report.push({ key: spec.key, title: spec.title, status: "missing", before: size(before), after: size(before), message: "not in the file; the current text is kept" }); continue; }
    const r = readSection(spec, seg.lines);
    if (r.error) { errors.push(`${spec.title}: ${r.error}`); report.push({ key: spec.key, title: spec.title, status: "error", before: size(before), after: size(before), message: r.error }); continue; }
    const changed = JSON.stringify(r.value) !== JSON.stringify(before);
    set(design, spec.path, r.value);
    report.push({ key: spec.key, title: spec.title, status: changed ? "updated" : "unchanged", before: size(before), after: size(r.value), message: seg.via === "heading" ? "found by its heading (marker missing)" : "" });
  }
  return { design: errors.length ? base : design, report, errors, found: Object.keys(segs).length };
}

// A stored design laid over the shipped one, so a document saved before a
// section existed still shows that section.
export function mergeDesign(base, stored) {
  if (!stored || typeof stored !== "object") return base;
  const out = clone(base);
  for (const k of Object.keys(stored)) {
    if (["orchestration", "bounce", "model"].includes(k) && stored[k] && typeof stored[k] === "object") {
      out[k] = { ...out[k], ...stored[k] };
      if (k === "orchestration" && stored[k].bounce) out[k].bounce = { ...base.orchestration.bounce, ...stored[k].bounce };
    } else out[k] = stored[k];
  }
  return out;
}

// Reviewers' edits folded into the design, so the exported document carries
// them. Key prefix to the row's id column and the column that was edited.
export const EDIT_MAP = {
  req: ["requirements", 0, 1], br: ["brTrace", 0, 1], grid: ["grid", 0, 1], field: ["trackingFields", 0, 1], flow: ["flow", null, 1], dag: ["orchestration.dag", 0, 1],
  task: ["orchestration.tasks", 0, 2], repo: ["repoLayout", 0, 1], bounce: ["bounce.how", 0, 1], alert: ["bounce.alerts", 0, 1], bdag: ["orchestration.bounce.dag", 0, 1],
  btask: ["orchestration.bounce.tasks", 0, 2], bcol: ["bounce.columns", 0, 2], tbl: ["sourceTables", 0, 2], gap: ["gaps", 0, 2], openitem: ["openItems", 0, 1], actor: ["actors", 0, 1],
  step: ["steps", 0, 1], life: ["lifecycle", null, 2], test: ["tests", 0, 2], exc: ["exceptions", 0, 2], hld: ["hldFlows", 0, 1], mode: ["modes", 0, 1], fit: ["hubFit", 0, 1],
  type: ["types", "key", "preference"], model: ["model", "name", "grain"], src: ["sources", "file", "fit"], tpl: ["content", "key", "body"],
};
export function applyEdits(design, review) {
  const edits = (review && review.edits) || {};
  if (!Object.keys(edits).length) return design;
  const out = clone(design);
  for (const [k, e] of Object.entries(edits)) {
    if (!e || !e.body) continue;
    const i = k.indexOf(":"); if (i < 0) continue;
    const m = EDIT_MAP[k.slice(0, i)]; if (!m) continue;
    const id = k.slice(i + 1);
    const [path, idCol, col] = m;
    if (path === "model") { const t = out.model && Object.values(out.model).find((x) => x.name === id); if (t) t[col] = e.body; continue; }
    const arr = get(out, path); if (!Array.isArray(arr)) continue;
    let row;
    if (idCol === null) row = arr[parseInt(id, 10) - 1];
    else if (typeof idCol === "string") row = arr.find((x) => String(x[idCol]) === id);
    else row = arr.find((x) => String(x[idCol]) === id);
    if (!row) continue;
    row[col] = e.body;
  }
  return out;
}

export const designFileName = (version) => `pb-notifications-design-v${version == null ? 0 : version}.md`;
export default { toMarkdown, fromMarkdown, mergeDesign, applyEdits, SECTIONS, EDIT_MAP, DOC_VERSION, designFileName };
