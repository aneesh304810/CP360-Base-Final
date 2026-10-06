// Export the review questions, their answers and their images as ONE
// self-contained HTML file.
//
// SELF-CONTAINED IS THE WHOLE POINT. An export that still needs the API to
// draw its pictures is not an export - it is a bookmark that breaks the
// first time somebody opens it on a laptop without the VPN. Every image is
// embedded: the built-in figures as inline SVG, the uploaded attachments as
// data URIs. The file opens from a mail attachment, prints to PDF, and
// still shows the diagrams in five years.
//
// IT STATES ITS FILTER, LOUDLY. The screen exports WHAT YOU ARE LOOKING AT,
// because exporting all 108 when the reader has filtered to one owner is
// the kind of surprise that gets found in a meeting. The flip side is worse
// - a 12-question file that looks like the whole review - so the header
// says how many of how many, and names the filter.
//
// ATTACHMENTS ARE RENDERED THROUGH <img>, NEVER INLINED AS MARKUP. They are
// sanitised on the way in, but an exported file travels further than the
// app does and gets opened with file:// privileges. An <img> with a data
// URI cannot run script whatever the SVG contains; pasting the same SVG
// into the document body can. The built-in figures are our own components
// and go in as markup.
//
// EVERY PIECE OF TEXT IS ESCAPED. Answers are free text typed by people.

export const esc = (s) => String(s == null ? "" : s)
 .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;");

// Paragraph breaks survive; nothing else from the text is interpreted.
export const para = (s) => esc(s).split(/\n{2,}/)
 .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");

export const exportFilename = (meta) => {
 const d = (meta && meta.at ? meta.at : new Date().toISOString())
  .slice(0, 10);
 const scope = meta && meta.filtered ? "filtered" : "all";
 return `cp360-hub-questions-${scope}-${d}.html`;
};

// Which built-in figures and which attachments this export actually needs,
// so the caller fetches only those.
export const figKeysIn = (rows, answersOf) => {
 const out = new Set();
 rows.forEach((r) => answersOf(r.n).forEach((a) => { if (a.fig) out.add(a.fig); }));
 return [...out];
};
export const attIdsIn = (rows, answersOf, atts) => {
 const out = [];
 rows.forEach((r) => answersOf(r.n).forEach((a) => {
  ((atts || {})[a.id] || []).forEach((x) => out.push(x));
 }));
 return out;
};

const ST_LABEL = { open: "Open", answered: "Answered", resolved: "Resolved",
 blocked: "Blocked", superseded: "Superseded" };
const ST_COLOUR = { open: "#7b8894", answered: "#0f4775", resolved: "#159943",
 blocked: "#c1113a", superseded: "#7b8894" };

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#10193b;font-size:13px;line-height:1.6;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.w{max-width:960px;margin:0 auto;padding:28px 22px 60px}
h1{font-size:21px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:15px;font-weight:600;margin:30px 0 10px;padding-bottom:6px;
 border-bottom:2px solid #0f4775;color:#0f4775;page-break-after:avoid}
.meta{font-size:11.5px;color:#4a5a68;margin:0 0 3px}
.scope{margin:14px 0 4px;padding:10px 14px;border-left:3px solid #e67e22;
 background:#fdf7f0;font-size:12px;color:#33414d;border-radius:0 5px 5px 0}
.counts{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0 6px;
 font-size:11.5px;color:#4a5a68}
.counts b{font-size:17px;font-weight:600;display:block;color:#10193b}
.q{border:1px solid #dfe6e9;border-radius:7px;padding:14px 17px;margin:0 0 12px;
 page-break-inside:avoid}
.qh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:5px}
.qn{font-weight:700;font-size:15px;color:#0f4775}
.badge{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
 border-radius:3px;padding:2px 8px;color:#fff}
.qb{font-size:14px;font-weight:500;line-height:1.5;margin:3px 0 6px}
.qm{font-size:11px;color:#7b8894}
.qm .comp{font-family:ui-monospace,Menlo,monospace}
.a{border-left:3px solid #dfe6e9;padding:9px 0 9px 14px;margin:12px 0 0}
.a.acc{border-left-color:#159943;background:#f6fbf7;border-radius:0 5px 5px 0;
 padding-right:12px}
.ah{font-size:10.5px;color:#7b8894;margin-bottom:4px}
.ah .who{color:#10193b;font-weight:600}
.ab p{margin:0 0 7px}
.ab p:last-child{margin-bottom:0}
.sign{font-size:11px;color:#1f6b45;margin-top:7px;padding-top:6px;
 border-top:1px solid #d6eade}
.fig{margin:11px 0 2px;max-width:640px;background:#fff;border:1px solid #e9eef2;
 border-radius:6px;padding:10px}
.fig svg{display:block;width:100%;height:auto}
.att{display:flex;gap:12px;flex-wrap:wrap;margin:11px 0 2px}
.att figure{margin:0;max-width:320px;border:1px solid #e9eef2;border-radius:6px;
 padding:8px;background:#fff}
.att img{display:block;max-width:100%;height:auto}
.att figcaption{font-size:10px;color:#7b8894;margin-top:5px;word-break:break-all}
.gone{font-size:11px;color:#a8560f;background:#fdf7f0;border:1px dashed #e8c9a6;
 border-radius:5px;padding:9px 12px;margin:10px 0 2px}
.none{font-size:11.5px;color:#7b8894;font-style:italic;margin-top:8px}
footer{margin-top:34px;padding-top:14px;border-top:1px solid #dfe6e9;
 font-size:11px;color:#7b8894}
@media print{
 body{font-size:11.5px}
 .w{max-width:none;padding:0}
 .q{border-color:#ccc}
 h2{page-break-after:avoid}
}`;

function answerBlock(a, figs, attsFor) {
 const acc = a.accepted;
 const who = a.author || a.by || a.createdBy || "unknown";
 const when = a.at || a.createdAt || a.updatedAt || "";
 const fig = a.fig && figs[a.fig]
  ? `<div class="fig">${figs[a.fig]}</div>` : "";
 const items = attsFor(a.id) || [];
 const att = items.length ? `<div class="att">${items.map((x) => {
  if (!x.dataUrl) {
   return `<div class="gone">Attachment ${esc(x.filename || x.id)} could not `
    + `be embedded${x.error ? ` - ${esc(x.error)}` : ""}. It is still on the `
    + `server; this file was exported without it.</div>`;
  }
  return `<figure><img src="${esc(x.dataUrl)}" alt="${
   esc(x.caption || x.filename || "attachment")}">`
   + `<figcaption>${esc(x.filename || x.kind || "attachment")}</figcaption>`
   + `</figure>`;
 }).join("")}</div>` : "";
 const sign = acc
  ? `<div class="sign"><b>Accepted</b> by ${esc(a.acceptedBy || "unknown")}`
    + `${a.acceptedAt ? ` on ${esc(a.acceptedAt)}` : ""}`
    + `${a.signoff ? `<br>${esc(a.signoff)}` : ""}</div>`
  : "";
 return `<div class="a${acc ? " acc" : ""}">
  <div class="ah"><span class="who">${esc(who)}</span>${
   when ? ` &middot; ${esc(when)}` : ""}${a.draft ? " &middot; draft" : ""}</div>
  <div class="ab">${para(a.body)}</div>
  ${fig}${att}${sign}
 </div>`;
}

/**
 * rows       [{n, topic, owner, body, comps, status}]  already filtered
 * answersOf  (n) => [answer]
 * topics     [{no, title}]
 * owners     {code: {name}}
 * figs       {figKey: "<svg .../>"}
 * atts       {answerId: [{id, filename, kind, dataUrl, error}]}
 * meta       {at, by, live, source, filterNote, filtered, total}
 */
export function buildExportHtml({ rows, answersOf, topics, owners, figs,
 atts, meta }) {
 const F = figs || {};
 const A = atts || {};
 const M = meta || {};
 const attsFor = (id) => A[id] || [];
 const own = (c) => ((owners || {})[c] || {}).name || c;

 const counts = {};
 rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

 const byTopic = new Map();
 rows.forEach((r) => {
  if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
  byTopic.get(r.topic).push(r);
 });
 const tTitle = (no) =>
  ((topics || []).find((x) => String(x.no) === String(no)) || {}).title || "";

 const body = [...byTopic.entries()]
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([no, qs]) => `<h2>${esc(no)} &middot; ${esc(tTitle(no))}</h2>`
   + qs.sort((a, b) => a.n - b.n).map((r) => {
    const mine = answersOf(r.n) || [];
    return `<div class="q">
     <div class="qh">
      <span class="qn">${esc(r.n)}</span>
      <span class="badge" style="background:${ST_COLOUR[r.status] || "#7b8894"}">${
       esc(ST_LABEL[r.status] || r.status)}</span>
     </div>
     <div class="qb">${esc(r.body)}</div>
     <div class="qm">${esc(own(r.owner))}${
      (r.comps || []).length
       ? ` &middot; <span class="comp">${(r.comps || []).map(esc).join(", ")}</span>`
       : ' &middot; <i>not linked to a component</i>'}</div>
     ${mine.length
       ? mine.map((a) => answerBlock(a, F, attsFor)).join("")
       : '<div class="none">No answer yet.</div>'}
    </div>`;
   }).join("")).join("\n");

 // The honesty line. It is first, and it is coloured, because a filtered
 // export that reads as the whole review is the failure mode here.
 const scope = M.filtered
  ? `<div class="scope"><b>This is a filtered export.</b> It covers
     ${rows.length} of ${M.total || rows.length} questions${
      M.filterNote ? ` &mdash; ${esc(M.filterNote)}` : ""}. Questions outside
     that filter are not in this file.</div>`
  : `<div class="scope" style="border-left-color:#159943;background:#f6fbf7">
     <b>Complete export.</b> All ${rows.length} questions, with every answer
     recorded against them.</div>`;

 const srcLine = M.live
  ? "Exported from the shared database copy."
  : "Exported from this browser's local copy - the API was not reachable, so "
    + "answers saved by other people may be missing.";

 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CP Integration Hub - review questions${
  M.filtered ? " (filtered)" : ""}</title>
<style>${CSS}</style></head>
<body><div class="w">
<h1>CP Integration Hub &mdash; review questions</h1>
<p class="meta">${esc(M.at || new Date().toISOString().slice(0, 16).replace("T", " "))}${
 M.by ? ` &middot; exported by ${esc(M.by)}` : ""}</p>
<p class="meta">${esc(srcLine)}</p>
${scope}
<div class="counts">
 ${["open", "answered", "resolved", "blocked"].map((s) =>
  `<span><b>${counts[s] || 0}</b>${ST_LABEL[s]}</span>`).join("")}
 <span><b>${rows.length}</b>in this file</span>
</div>
${body}
<footer>
 Generated from the CP Integration Hub review screen. Figures and attachments
 are embedded in this file, so it needs no network connection to read.
 Answers are reproduced as written.
</footer>
</div></body></html>`;
}
