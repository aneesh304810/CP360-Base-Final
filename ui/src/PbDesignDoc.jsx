// PB Notifications — the design as a document: download it as Markdown,
// edit it elsewhere (enterprise Claude, a text editor), ingest it back and
// the whole page renders from it. The state here is the ingested design
// and its version; the parsing is in pbnotifyDoc.js.
import React, { createContext, useContext, useEffect, useState } from "react";
import reviewApi from "./pbnotifyReviewApi.js";
import { toMarkdown, fromMarkdown, mergeDesign, applyEdits, designFileName, SECTIONS } from "./pbnotifyDoc.js";
import { ReviewCtx } from "./PbReview.jsx";

export const DesignStateCtx = createContext(null);

// The page calls this with its shipped design; `seed` lets a test hand in
// an ingested document and skip the network.
export function useDesignState(base, seed) {
  const [doc, setDoc] = useState(seed ? seed.doc || null : null);
  const [live, setLive] = useState(seed ? !!seed.live : false);
  const [loaded, setLoaded] = useState(!!seed);
  const [history, setHistory] = useState(seed && seed.history ? seed.history : null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (seed) return undefined;
    let on = true;
    reviewApi.loadDesign().then((r) => { if (on) { setDoc(r.doc); setLive(r.live); setLoaded(true); } });
    return () => { on = false; };
  }, [seed]);
  const design = doc && !doc.shipped && doc.design ? mergeDesign(base, doc.design) : base;
  const refreshHistory = async () => { const h = await reviewApi.designHistory(); setHistory(h); return h; };
  // Parse only; nothing is saved until apply.
  const check = (markdown) => fromMarkdown(markdown, design);
  const apply = async ({ markdown, parsed, fileName, note, actor }) => {
    if (!actor) { setError("name required: sign-in is off, so say who you are"); return false; }
    const r = await reviewApi.saveDesign({ markdown, design: parsed, fileName, note, actor });
    if (r && r.doc) { setDoc(r.doc); setLive(true); setError(null); refreshHistory(); return true; }
    if (r && r.offline) {
      const local = { version: ((doc && doc.version) || 0) + 1, design: parsed, author: actor, idSource: "none", at: new Date().toISOString().slice(0, 16).replace("T", " "), note, fileName, shipped: false, local: true };
      reviewApi.saveDesignLocal(local); setDoc(local); setLive(false); setError(null); return true;
    }
    setError(r && r.error ? r.error : "not saved"); return false;
  };
  const reset = async (actor, note) => {
    if (!actor) { setError("name required"); return false; }
    const r = await reviewApi.saveDesign({ reset: true, note, actor });
    if (r && r.doc !== undefined && !r.error) { setDoc(r.doc); setLive(true); setError(null); refreshHistory(); return true; }
    if (r && r.offline) { reviewApi.saveDesignLocal(null); setDoc(null); setLive(false); return true; }
    setError(r && r.error ? r.error : "not reset"); return false;
  };
  return { base, design, doc, live, loaded, history, refreshHistory, check, apply, reset, error, setError };
}

const S = (t) => ({
  btn: { font: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "5px 12px", border: `1px solid ${t.accent}`, borderRadius: 4, background: t.accent, color: "#fff" },
  ghost: { font: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "5px 12px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text },
  box: { border: `1px solid ${t.border}`, borderRadius: 6, background: t.panel, padding: "12px 16px", margin: "8px 0 14px" },
  meta: { fontSize: 11.5, color: t.textMuted },
  ta: { font: "ui-monospace, monospace", fontSize: 11.5, width: "100%", boxSizing: "border-box", minHeight: 140, padding: "8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.bg, color: t.text, resize: "vertical" },
  in: { font: "inherit", fontSize: 12.5, padding: "4px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text },
  err: { color: "#b42318", fontSize: 12.5, margin: "6px 0" },
  okc: { color: "#159943", fontSize: 12.5, margin: "6px 0" },
});
const STATUS_C = { updated: "#159943", unchanged: "#6b7884", missing: "#c96a12", error: "#b42318" };

// What the download writes: the design as shown, with the reviewers' edits folded in, and the review notes appended.
export function buildMarkdown(ds, rv) {
  const review = rv ? rv.review : null;
  return toMarkdown(applyEdits(ds.design, review), { review, version: ds.doc && !ds.doc.shipped ? ds.doc.version : 0, author: rv && rv.actor ? rv.actor : undefined });
}
function download(name, text) {
  try {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}

export function DownloadButton({ t }) {
  const ds = useContext(DesignStateCtx), rv = useContext(ReviewCtx);
  if (!ds) return null;
  const s = S(t);
  return <button type="button" style={s.ghost} title="The whole design as one Markdown file: every table, the DAG code, the data model, with reviewers' edits folded in and the review notes appended"
    onClick={() => download(designFileName(ds.doc && !ds.doc.shipped ? ds.doc.version : 0), buildMarkdown(ds, rv))}>Download .md</button>;
}

export function DocumentTab() {
  const ds = useContext(DesignStateCtx), rv = useContext(ReviewCtx);
  const [md, setMd] = useState("");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState(null);
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (ds && ds.history === null && ds.live) ds.refreshHistory(); }, [ds && ds.live]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ds || !rv) return null;
  const t = rv.t, s = S(t);
  const H = ({ children, sub }) => <div style={{ margin: "18px 0 6px" }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12.5, color: t.sub, maxWidth: "80ch", lineHeight: 1.6 }}>{sub}</div>}</div>;
  const cur = ds.doc && !ds.doc.shipped ? ds.doc : null;
  const onFile = (f) => { if (!f) return; setFileName(f.name); const r = new FileReader(); r.onload = () => { setMd(String(r.result || "")); setResult(null); setDone(null); }; r.readAsText(f); };
  const check = () => { setDone(null); setResult(ds.check(md)); };
  const apply = async () => {
    if (!result || result.errors.length) return;
    const ok = await ds.apply({ markdown: md, parsed: result.design, fileName: fileName || "pasted", note, actor: rv.actor });
    if (ok) { setDone(`Ingested as version ${(ds.doc && ds.doc.version) != null ? "" : ""}${ds.live ? "" : ""}`.trim() || "Ingested"); setResult(null); setMd(""); setNote(""); }
  };
  const updated = result ? result.report.filter((r) => r.status === "updated") : [];
  return (<>
    <H sub="The whole design, every tab, as one Markdown file. Download it, edit it in enterprise Claude or any editor, and ingest it here: the page then renders from the ingested document, as a new version with your name on it. The shipped design in the code is never changed and can be restored.">The design as a document</H>
    <div style={s.box}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ color: t.text }}>{cur ? `Design version ${cur.version}` : "Shipped design"}</b>
        {cur && <span style={s.meta}>ingested by {cur.author}{cur.idSource === "none" ? " (self-declared)" : ""} on {cur.at}{cur.fileName ? ` from ${cur.fileName}` : ""}{cur.note ? ` · ${cur.note}` : ""}{cur.local ? " · kept in this browser only" : ""}</span>}
        {!cur && <span style={s.meta}>the baseline in the code; nothing ingested yet</span>}
        <span style={{ flex: 1 }} />
        <button type="button" style={s.btn} onClick={() => download(designFileName(cur ? cur.version : 0), buildMarkdown(ds, rv))}>Download .md</button>
        <button type="button" style={s.ghost} onClick={async () => { try { await navigator.clipboard.writeText(buildMarkdown(ds, rv)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy Markdown"}</button>
      </div>
      <div style={{ ...s.meta, marginTop: 6 }}>{ds.live ? "Versions are saved to the design table and shared with every reviewer." : ds.loaded ? "Local only: the API is not reachable, so an ingested document is kept in this browser until the table answers." : "Loading…"}</div>
      {ds.error && <div style={s.err}>{ds.error}</div>}
    </div>
    <H sub="What the file contains and how to edit it so it reads back.">How the document works</H>
    <ul style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.7, maxWidth: "80ch", paddingLeft: 18 }}>
      <li>One section per table on the page: {SECTIONS.length} sections, each under a heading with a marker comment. Edit cells, add or remove rows, change a mark; keep the headings and the column names, and one line per cell.</li>
      <li>Marks are REQUIRED, PROPOSED or OPEN. Exception outcomes are HOLD, SKIP, REJECT, RETRY, FLAG or OPEN. A row with an empty id, or a mark outside those, is refused with the row named.</li>
      <li>Columns may be reordered; they are matched by name. A section left out of the file keeps its current text. A lost marker is recovered from the heading.</li>
      <li>Reviewers' edits are folded into the download, and the review questions are appended as a last section that is not read back; questions live in their own tables.</li>
      <li>No user id, account number, e-mail address or hostname belongs in the document. The page's tests enforce the same rule on what ships.</li>
    </ul>
    <H sub="Choose the edited file or paste its text, check it, read the report, then apply it as the next version.">Ingest an edited document</H>
    <div style={s.box}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept=".md,.markdown,.txt,text/markdown" aria-label="design document file" onChange={(e) => onFile(e.target.files && e.target.files[0])} style={{ fontSize: 12 }} />
        <span style={s.meta}>or paste below</span>
        <span style={{ flex: 1 }} />
        {!(rv.who && rv.who.verified) && <input aria-label="your name" style={s.in} placeholder="Your name" value={rv.name} onChange={(e) => rv.setName(e.target.value)} />}
      </div>
      <textarea aria-label="design document text" style={{ ...s.ta, marginTop: 8 }} value={md} onChange={(e) => { setMd(e.target.value); setResult(null); setDone(null); }} placeholder="# PB Notifications · design document …" />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" style={s.ghost} disabled={!md.trim()} onClick={check}>Check the document</button>
        <input aria-label="version note" style={{ ...s.in, minWidth: 260 }} placeholder="Note for this version (what changed, why)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" style={{ ...s.btn, opacity: result && !result.errors.length ? 1 : .4 }} disabled={!result || !!result.errors.length} onClick={apply}>Apply as version {(cur ? cur.version : 0) + 1}</button>
      </div>
      {done && <div style={s.okc}>{done}. The page now renders from it.</div>}
      {result && (<div style={{ marginTop: 10 }}>
        {result.errors.length ? <div style={s.err}>Not applied: {result.errors.length} section(s) could not be read. Fix them in the file and check again.</div>
          : <div style={s.okc}>{result.found} section(s) read; {updated.length} updated, {result.report.filter((r) => r.status === "unchanged").length} unchanged, {result.report.filter((r) => r.status === "missing").length} not in the file.</div>}
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead><tr>{["Section", "Status", "Rows before", "Rows after", ""].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}` }}>{h}</th>)}</tr></thead>
          <tbody>{result.report.map((r) => (
            <tr key={r.key}><td style={{ padding: "5px 12px 5px 0", color: t.text, fontWeight: 600 }}>{r.title}</td>
              <td style={{ padding: "5px 12px 5px 0" }}><span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: STATUS_C[r.status], border: `1px solid ${STATUS_C[r.status]}`, borderRadius: 3, padding: "0 6px" }}>{r.status}</span></td>
              <td style={{ padding: "5px 12px 5px 0", color: t.sub }}>{r.before}</td><td style={{ padding: "5px 12px 5px 0", color: t.sub }}>{r.after}</td>
              <td style={{ padding: "5px 0", color: r.status === "error" ? "#b42318" : t.textMuted }}>{r.message}</td></tr>))}</tbody>
        </table>
      </div>)}
    </div>
    <H sub="Every ingested version, newest first. The shipped design can be restored as a new version; nothing is deleted.">Versions</H>
    {ds.history === null && <div style={s.meta}>{ds.live ? "Loading…" : "History needs the API."}</div>}
    {ds.history && ds.history.length === 0 && <div style={s.meta}>No versions yet.</div>}
    {ds.history && ds.history.length > 0 && (
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, maxWidth: 900 }}>
        <thead><tr>{["Version", "By", "When", "File", "Note", "Size"].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}` }}>{h}</th>)}</tr></thead>
        <tbody>{ds.history.map((h) => (
          <tr key={h.id || h.version}><td style={{ padding: "6px 12px 6px 0", color: t.text, fontWeight: 600 }}>{h.shipped ? `v${h.version} · shipped design restored` : `v${h.version}`}</td>
            <td style={{ padding: "6px 12px 6px 0", color: t.sub }}>{h.author}{h.idSource === "none" ? " (self-declared)" : ""}</td><td style={{ padding: "6px 12px 6px 0", color: t.sub }}>{h.at}</td>
            <td style={{ padding: "6px 12px 6px 0", color: t.sub }}>{h.fileName || ""}</td><td style={{ padding: "6px 12px 6px 0", color: t.sub }}>{h.note || ""}</td><td style={{ padding: "6px 0", color: t.sub }}>{h.bytes ? `${Math.round(h.bytes / 1024)} KB` : ""}</td></tr>))}</tbody>
      </table>)}
    {cur && <div style={{ marginTop: 10 }}><button type="button" style={s.ghost} onClick={() => ds.reset(rv.actor, "restored the shipped design")}>Restore the shipped design</button></div>}
  </>);
}
