// PB Notifications — the review layer's components. A reviewer can open
// any item on the page, propose an edit to its text, ask a question or
// leave a comment, answer, and set a status. The Review tab lists it all.
//
// The state lives in a React context the page provides, so the tables
// and cards on every tab show the same marks without threading props.
// Rendered without a provider (the tests, or a reader with no review
// state) everything here is inert and the page is the plain design.
import React, { createContext, useContext, useEffect, useState } from "react";
import reviewApi, { applyLocal, textFor, notesFor, openQuestions, keyFor, STATUSES } from "./pbnotifyReviewApi.js";

export const ReviewCtx = createContext(null);

export const SECTION_LABEL = {
  req: "Requirement", br: "BR", type: "Notification type", grid: "Type grid", field: "Tracking field", flow: "Run task", mode: "Mode",
  fit: "Hub fit", bounce: "Bounce design", alert: "Alert", task: "DAG task", btask: "Bounce DAG task", repo: "Repository", model: "Table",
  src: "Source extract", tpl: "E-mail template", gap: "Gap", exc: "Exception", hld: "HLD flow", actor: "Actor", step: "Step", life: "Lifecycle",
  test: "Test scenario", openitem: "Document open item", tbl: "Source table", dag: "DAG setting", bdag: "Bounce DAG setting", bcol: "Tracking column", general: "General",
};
export const sectionOf = (k) => SECTION_LABEL[String(k || "").split(":")[0]] || "Item";
export const idOf = (k) => { const i = String(k || "").indexOf(":"); return i < 0 ? k : k.slice(i + 1); };

// The page calls this once and provides the result. `seed` lets a test
// or a parent hand in a state and skip the network.
export function useReviewState(seed) {
  const [review, setReview] = useState(seed ? seed.review : reviewApi.emptyReview());
  const [live, setLive] = useState(seed ? !!seed.live : false);
  const [loaded, setLoaded] = useState(!!seed);
  const [who, setWho] = useState(seed && seed.who ? seed.who : null);
  const [name, setNameState] = useState(seed && seed.name ? seed.name : reviewApi.reviewerName());
  const [openKey, setOpenKey] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (seed) return undefined;
    let on = true;
    reviewApi.load().then((r) => { if (on) { setReview(r.review); setLive(r.live); setLoaded(true); } });
    reviewApi.whoami().then((w) => { if (on) setWho(w); });
    return () => { on = false; };
  }, [seed]);
  const actor = who && who.verified && who.lanId ? who.lanId : name;
  const setName = (n) => { setNameState(n); reviewApi.setReviewerName(n); };
  // Optimistic locally, then the server's state if it answers. An error
  // is shown, never swallowed: a question that silently did not save is
  // the worst outcome of a review.
  const act = async (op) => {
    const full = { ...op, actor };
    let next;
    try { next = applyLocal(review, full); } catch (e) { setError(String(e.message || e)); return false; }
    setReview(next); setError(null);
    if (!live) { reviewApi.saveLocal(next); return true; }
    const r = await reviewApi.applyOp(full);
    if (r && r.review) { setReview(r.review); return true; }
    if (r && r.offline) { setLive(false); reviewApi.saveLocal(next); return true; }
    setError(r && r.error ? r.error : "not saved"); return false;
  };
  return { review, live, loaded, who, name, setName, actor, act, openKey, setOpenKey, error, setError };
}

const S = (t) => ({
  mark: { font: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${t.border}`, borderRadius: 999, padding: "1px 8px", background: t.panel, color: t.sub, whiteSpace: "nowrap", lineHeight: 1.6 },
  panel: { border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, borderRadius: 6, background: t.bg, padding: "10px 14px", margin: "4px 0 10px", fontSize: 12.5, color: t.sub, lineHeight: 1.55 },
  lbl: { fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "8px 0 4px" },
  ta: { font: "inherit", fontSize: 12.5, width: "100%", boxSizing: "border-box", minHeight: 60, padding: "6px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, resize: "vertical" },
  in: { font: "inherit", fontSize: 12.5, padding: "4px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text },
  btn: { font: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 10px", border: `1px solid ${t.accent}`, borderRadius: 4, background: t.accent, color: "#fff" },
  ghost: { font: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 10px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text },
  note: { borderTop: `1px solid ${t.border}`, padding: "8px 0" },
  chip: (c) => ({ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`, borderRadius: 3, padding: "0 6px", marginRight: 6, whiteSpace: "nowrap" }),
  meta: { fontSize: 11, color: t.textMuted },
  err: { color: "#b42318", fontSize: 12, margin: "6px 0" },
});
const KIND_C = { question: "#c96a12", comment: "#0f4775", answer: "#159943" };
const STATUS_C = { open: "#c96a12", answered: "#159943", closed: "#6b7884" };

// The small control beside an item: edited, open questions, comments. Click opens the panel.
export function ReviewMark({ k }) {
  const rv = useContext(ReviewCtx);
  if (!rv) return null;
  const t = rv.t, s = S(t);
  const notes = notesFor(rv.review, k);
  const q = notes.filter((n) => n.kind === "question" && n.status === "open").length;
  const edited = !!(rv.review.edits && rv.review.edits[k]);
  const on = rv.openKey === k;
  const parts = [edited ? "edited" : null, q ? `${q} open` : null, notes.length && !q ? `${notes.length}` : null].filter(Boolean);
  return (
    <button type="button" aria-pressed={on} aria-label={`review ${k}`} title={`Review ${sectionOf(k)} ${idOf(k)}: edit, question or comment`}
      onClick={() => rv.setOpenKey(on ? null : k)}
      style={{ ...s.mark, borderColor: on ? t.accent : (q ? KIND_C.question : edited ? KIND_C.answer : t.border), color: on ? t.accent : (q ? KIND_C.question : edited ? KIND_C.answer : t.textMuted) }}>
      ✎{parts.length ? ` ${parts.join(" · ")}` : ""}
    </button>);
}

function NameAsk({ rv }) {
  const s = S(rv.t);
  if (rv.who && rv.who.verified) return <div style={s.meta}>Reviewing as <b>{rv.actor}</b>, from your {rv.who.source === "session" ? "signed-in session" : "network sign-on"}.</div>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "4px 0 6px" }}>
      <span style={s.meta}>Sign-in is off, so say who you are; the record shows it was self-declared.</span>
      <input aria-label="your name" style={s.in} placeholder="Your name" value={rv.name} onChange={(e) => rv.setName(e.target.value)} />
    </div>);
}

// The panel under an item: the current text, a proposed edit, the thread.
export function ReviewPanel({ k, text }) {
  const rv = useContext(ReviewCtx);
  const [draft, setDraft] = useState(null);
  const [kind, setKind] = useState("question");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState({});
  if (!rv) return null;
  const t = rv.t, s = S(t);
  const cur = textFor(rv.review, k, text);
  const notes = notesFor(rv.review, k);
  const tops = notes.filter((n) => !n.parentId), answers = (id) => notes.filter((n) => n.parentId === id);
  const section = String(k).split(":")[0];
  const post = async () => { if (await rv.act({ op: "note.add", itemKey: k, section, kind, body })) setBody(""); };
  return (
    <div style={s.panel} role="region" aria-label={`review of ${k}`}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <b style={{ color: t.text }}>{sectionOf(k)} {idOf(k)}</b>
        <span style={s.meta}>{rv.live ? "shared · saved to the review tables" : "local only · this browser's copy until the API is reachable"}</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={s.ghost} onClick={() => rv.setOpenKey(null)}>Close</button>
      </div>
      <NameAsk rv={rv} />
      {rv.error && <div style={s.err}>{rv.error}</div>}
      {text ? (<>
        <div style={s.lbl}>{cur.edited ? "Text as edited" : "Text as shipped"}</div>
        <div style={{ color: t.text }}>{cur.text}</div>
        {cur.edited && <div style={s.meta}>Edited by <b>{cur.edited.author}</b> on {cur.edited.at}{cur.edited.idSource === "none" ? " · self-declared" : ""}
          {cur.edited.seen ? <> · <span title={cur.edited.seen}>original kept</span></> : null}
          {" · "}<span role="button" tabIndex={0} style={{ color: t.accent, cursor: "pointer" }} onClick={() => rv.act({ op: "edit.revert", itemKey: k, section, seen: cur.text })}>restore the shipped text</span></div>}
        {draft === null
          ? <div style={{ margin: "6px 0" }}><button type="button" style={s.ghost} onClick={() => setDraft(cur.text)}>Propose an edit</button></div>
          : (<div style={{ margin: "6px 0" }}>
              <textarea aria-label="proposed text" style={s.ta} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" style={s.btn} onClick={async () => { if (await rv.act({ op: "edit", itemKey: k, section, body: draft, seen: cur.text })) setDraft(null); }}>Save the edit</button>
                <button type="button" style={s.ghost} onClick={() => setDraft(null)}>Cancel</button>
              </div></div>)}
      </>) : null}
      <div style={s.lbl}>Questions and comments{tops.length ? ` · ${tops.length}` : ""}</div>
      {tops.length === 0 && <div style={s.meta}>None yet.</div>}
      {tops.map((n) => (
        <div key={n.id} style={s.note}>
          <div><span style={s.chip(KIND_C[n.kind] || t.sub)}>{n.kind}</span>{n.kind === "question" && <span style={s.chip(STATUS_C[n.status])}>{n.status}</span>}
            <span style={{ color: t.text }}>{n.body}</span></div>
          <div style={s.meta}>{n.author}{n.idSource === "none" ? " (self-declared)" : ""} · {n.at}{n.editedAt ? ` · edited ${n.editedAt}` : ""}{n.statusBy ? ` · ${n.status} by ${n.statusBy}` : ""}</div>
          {answers(n.id).map((a) => (
            <div key={a.id} style={{ margin: "6px 0 0 18px" }}>
              <span style={s.chip(KIND_C.answer)}>answer</span><span style={{ color: t.text }}>{a.body}</span>
              <div style={s.meta}>{a.author}{a.idSource === "none" ? " (self-declared)" : ""} · {a.at}</div>
            </div>))}
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            {n.kind === "question" && STATUSES.filter((x) => x !== n.status).map((x) => (
              <button key={x} type="button" style={s.ghost} onClick={() => rv.act({ op: "note.status", noteId: n.id, status: x })}>mark {x}</button>))}
            {reply[n.id] === undefined
              ? <button type="button" style={s.ghost} onClick={() => setReply({ ...reply, [n.id]: "" })}>{n.kind === "question" ? "Answer" : "Reply"}</button>
              : (<>
                  <input aria-label={`answer to ${n.id}`} style={{ ...s.in, flex: 1, minWidth: 200 }} value={reply[n.id]} onChange={(e) => setReply({ ...reply, [n.id]: e.target.value })} placeholder={n.kind === "question" ? "Your answer" : "Your reply"} />
                  <button type="button" style={s.btn} onClick={async () => { if (await rv.act({ op: "note.add", itemKey: k, section, kind: "answer", body: reply[n.id], parentId: n.id })) { const r = { ...reply }; delete r[n.id]; setReply(r); } }}>Post</button>
                  <button type="button" style={s.ghost} onClick={() => { const r = { ...reply }; delete r[n.id]; setReply(r); }}>Cancel</button>
                </>)}
          </div>
        </div>))}
      <div style={{ ...s.note, borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
          {["question", "comment"].map((x) => (
            <label key={x} style={{ fontSize: 12, color: t.text, display: "inline-flex", gap: 4, alignItems: "center" }}>
              <input type="radio" name={`kind-${k}`} checked={kind === x} onChange={() => setKind(x)} /> {x === "question" ? "Ask a question" : "Leave a comment"}</label>))}
        </div>
        <textarea aria-label={`new ${kind} on ${k}`} style={s.ta} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "question" ? "What needs an answer before build?" : "Your review comment"} />
        <div style={{ marginTop: 6 }}><button type="button" style={s.btn} onClick={post}>Post {kind}</button></div>
      </div>
    </div>);
}

// Mark plus panel, for a card that is not a table row.
export function CardReview({ k, text }) {
  const rv = useContext(ReviewCtx);
  if (!rv) return null;
  return (<>
    <ReviewMark k={k} />
    {rv.openKey === k && <div style={{ flexBasis: "100%" }}><ReviewPanel k={k} text={text} /></div>}
  </>);
}

// The Review tab: who you are, the counts, every open question, every edit, a general question.
export function ReviewTab() {
  const rv = useContext(ReviewCtx);
  const [filter, setFilter] = useState("open");
  const [about, setAbout] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("question");
  if (!rv) return null;
  const t = rv.t, s = S(t);
  const notes = rv.review.notes || [];
  const tops = notes.filter((n) => !n.parentId);
  const open = openQuestions(rv.review);
  const edits = Object.values(rv.review.edits || {});
  const shown = filter === "open" ? tops.filter((n) => n.kind === "question" && n.status === "open") : filter === "questions" ? tops.filter((n) => n.kind === "question") : tops;
  const H = ({ children, sub }) => <div style={{ margin: "18px 0 6px" }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12.5, color: t.sub, maxWidth: "76ch", lineHeight: 1.6 }}>{sub}</div>}</div>;
  const Cnt = ({ n, l, c }) => <div style={{ border: `1px solid ${t.border}`, borderTop: `3px solid ${c}`, borderRadius: 6, padding: "8px 14px", minWidth: 120, background: t.panel }}><div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{n}</div><div style={{ fontSize: 11, color: t.textMuted }}>{l}</div></div>;
  return (<>
    <H sub="Every item on the other tabs carries a pencil. Open it to propose an edit to the text, ask a question or leave a comment; answer and close questions here or there. Nothing shipped with the page is changed in the repository: an edit is a reviewer's proposal, recorded with their name, and the shipped text can always be restored.">Review</H>
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 6, background: t.panel, padding: "10px 14px", margin: "6px 0 12px" }}>
      <NameAsk rv={rv} />
      <div style={s.meta}>{rv.live ? "Shared: saved to the review tables and visible to every reviewer." : rv.loaded ? "Local only: the API is not reachable, so this is this browser's copy. It is kept and shown here until the tables answer." : "Loading…"}</div>
      {rv.error && <div style={s.err}>{rv.error}</div>}
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Cnt n={open.length} l="open questions" c={STATUS_C.open} />
      <Cnt n={tops.filter((n) => n.kind === "question" && n.status === "answered").length} l="answered" c={STATUS_C.answered} />
      <Cnt n={tops.filter((n) => n.kind === "comment").length} l="comments" c={KIND_C.comment} />
      <Cnt n={edits.length} l="edited items" c={KIND_C.answer} />
    </div>
    <H sub="About an item: give its id, such as G7, T05, R3, BR-02 or step 5, or leave it blank for a question about the whole design.">Ask a question or leave a comment</H>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input aria-label="about item" style={{ ...s.in, width: 160 }} placeholder="About (G7, T05, R3…)" value={about} onChange={(e) => setAbout(e.target.value)} />
      {["question", "comment"].map((x) => <label key={x} style={{ fontSize: 12, color: t.text, display: "inline-flex", gap: 4, alignItems: "center" }}><input type="radio" name="rv-kind" checked={kind === x} onChange={() => setKind(x)} /> {x}</label>)}
    </div>
    <textarea aria-label="new general note" style={{ ...s.ta, marginTop: 6, maxWidth: 760 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "question" ? "What needs an answer before build?" : "Your review comment"} />
    <div style={{ marginTop: 6 }}><button type="button" style={s.btn} onClick={async () => { const k = keyFor(about); if (await rv.act({ op: "note.add", itemKey: k, section: k.split(":")[0], kind, body })) { setBody(""); setAbout(""); } }}>Post {kind}</button></div>
    <H>Questions and comments</H>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      {[["open", "open questions"], ["questions", "all questions"], ["all", "everything"]].map(([k, l]) => (
        <button key={k} type="button" aria-pressed={filter === k} style={{ ...s.ghost, borderColor: filter === k ? t.accent : t.border, color: filter === k ? t.accent : t.text }} onClick={() => setFilter(k)}>{l}</button>))}
    </div>
    {shown.length === 0 && <div style={s.meta}>Nothing here yet.</div>}
    {shown.map((n) => (
      <div key={n.id} style={{ ...s.note, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span role="button" tabIndex={0} style={{ ...s.mark, color: t.accent, borderColor: t.accent }} onClick={() => rv.setOpenKey(rv.openKey === n.itemKey ? null : n.itemKey)}>{sectionOf(n.itemKey)} {idOf(n.itemKey)}</span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div><span style={s.chip(KIND_C[n.kind] || t.sub)}>{n.kind}</span>{n.kind === "question" && <span style={s.chip(STATUS_C[n.status])}>{n.status}</span>}<span style={{ color: t.text }}>{n.body}</span></div>
          <div style={s.meta}>{n.author}{n.idSource === "none" ? " (self-declared)" : ""} · {n.at}{notes.filter((a) => a.parentId === n.id).length ? ` · ${notes.filter((a) => a.parentId === n.id).length} answer(s)` : ""}</div>
          {rv.openKey === n.itemKey && <ReviewPanel k={n.itemKey} text="" />}
        </div>
      </div>))}
    <H sub="The latest edit per item. The shipped text is kept with every edit and can be restored from the item.">Edited items</H>
    {edits.length === 0 && <div style={s.meta}>No edits yet.</div>}
    {edits.map((e) => (
      <div key={e.id} style={s.note}>
        <div><b style={{ color: t.text }}>{sectionOf(e.itemKey)} {idOf(e.itemKey)}</b> <span style={s.meta}>· {e.author}{e.idSource === "none" ? " (self-declared)" : ""} · {e.at}</span></div>
        <div style={{ color: t.text }}>{e.body}</div>
        {e.seen && <div style={{ ...s.meta, textDecoration: "line-through" }}>{e.seen}</div>}
      </div>))}
    {rv.review.editLog && rv.review.editLog.length > edits.length && <div style={s.meta}>{rv.review.editLog.length} edits in total, including restores.</div>}
  </>);
}
