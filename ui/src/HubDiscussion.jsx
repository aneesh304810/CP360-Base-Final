// CP Integration Hub — Discussion.
//
// ADDITIVE. This is a new tab. Nothing in the existing Hub views is
// changed: HubDesign.jsx gains one import, one pill and one branch.
//
// THE DESIGN POINT. A question is only useful attached to the thing it
// is about, so a component link is required when raising one, and the
// ACCEPTED ANSWER BECOMES THAT COMPONENT'S DOCUMENTATION. Without that
// last step this is a message board; with it, the review thread is how
// the component gets written down. Clicking a linked component opens it
// in L3.
//
// STATUS IS DERIVED, NOT STORED — except where a human decided it.
// "has replies" is not "answered" and "answered" is not "resolved", and
// collapsing those three into one green tick is how review threads die.
// open/answered fall out of the answers; resolved/blocked/superseded are
// decisions and carry who made them and when.
//
// EDIT KEEPS HISTORY. Editing an ACCEPTED answer clears the acceptance
// and sends the question back to answered — an answer that was agreed
// and then quietly rewritten is worse than no answer.
import React, { useState, useEffect, useMemo } from "react";
import { QUESTIONS, TOPICS, OWNERS, compsFor } from "./hubQuestions.js";
import { TRACKER_COMPONENTS } from "./seiDesignTracker.js";
import { HUB_EVENT_COMPONENTS } from "./hubEventComponents.js";
import discussionApi, { emptyStore } from "./hub_discussion_api.js";

const ST = {
  open:       { label: "open",        c: "#6b7884", bg: "#f1f4f7" },
  answered:   { label: "answered",    c: "#0f4775", bg: "#e4f0fb" },
  resolved:   { label: "✓ resolved",  c: "#15803d", bg: "#e8f6ed" },
  blocked:    { label: "blocked",     c: "#c1113a", bg: "#fdeaee" },
  superseded: { label: "superseded",  c: "#b4620f", bg: "#fdf2e3" },
};
// id -> name, so a link reads "22 Partial-Batch Policy" rather than "22".
// A chip showing only a number is a link nobody follows.
const CNAME = {};
[...TRACKER_COMPONENTS, ...HUB_EVENT_COMPONENTS]
  .forEach((c) => { CNAME[c.id] = c.component; });
export const compLabel = (id) => (CNAME[id] ? `${id} ${CNAME[id]}` : id);

const FIRST_USER_ID = 1001;
const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

// The whole status model, pure and exported so a test can run it rather
// than read it off the screen.
export function statusOf(q, answers, over) {
  const o = over || {};
  if (o.status === "blocked" || o.status === "superseded") return o.status;
  const mine = answers.filter((a) => a.qid === q.n);
  if (mine.some((a) => a.accepted)) return "resolved";
  return mine.length ? "answered" : "open";
}

// Acceptance is a decision, so it records a person and a time. An
// accepted answer with no acceptor is a comment.
export function acceptAnswer(store, qid, aid, actor) {
  const a = { ...store.a };
  Object.keys(a).forEach((k) => {
    if (a[k].qid === qid) a[k] = { ...a[k], accepted: false, acceptedBy: null, acceptedAt: null };
  });
  a[aid] = { ...a[aid], accepted: true, acceptedBy: actor, acceptedAt: now() };
  const q = { ...store.q, [qid]: { ...(store.q[qid] || {}), status: null } };
  return { ...store, a, q,
    ev: [...store.ev, { qid, to: "resolved", at: now(), actor, note: `accepted answer ${aid}` }] };
}

// Editing an accepted answer withdraws the acceptance — the acceptor has
// to look again at what they are agreeing to.
export function editAnswer(store, aid, body, actor) {
  const prev = store.a[aid] || {};
  const withdrawn = !!prev.accepted;
  const a = { ...store.a, [aid]: { ...prev, body, updatedAt: now(), updatedBy: actor,
    accepted: false, acceptedBy: null, acceptedAt: null } };
  const ev = withdrawn
    ? [...store.ev, { qid: prev.qid, to: "answered", at: now(), actor,
        note: "acceptance withdrawn — the accepted answer was edited" }]
    : store.ev;
  return { ...store, a, ev };
}

export default function HubDiscussion({ t, onOpenComponent, onBack, me }) {
  const actor = me || "local.user";
  const [store, setStore] = useState(emptyStore);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(null);
  const [ftopic, setFtopic] = useState("");
  const [fowner, setFowner] = useState("");
  const [fstatus, setFstatus] = useState("");
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => {
    let on = true;
    discussionApi.load().then(({ store: s, live: l }) => {
      if (!on) return; setStore(s); setLive(l);
    });
    return () => { on = false; };
  }, []);
  const commit = (next) => { setStore(next); discussionApi.save(next); };

  const answers = useMemo(() =>
    Object.entries(store.a || {}).map(([id, a]) => ({ ...a, id })), [store.a]);

  // Seeded review questions plus anything raised in the app. The two are
  // kept apart so a redeploy cannot duplicate the first or drop the second.
  const all = useMemo(() => {
    const extra = Object.values(store.n || {});
    return [...QUESTIONS, ...extra].map((x) => {
      const over = (store.q || {})[x.n] || {};
      return { ...x, ...(over.body ? { body: over.body } : {}),
        comps: over.comps || compsFor(x), docs: over.docs || x.docs || [],
        edited: over.editedAt ? { by: over.editedBy, at: over.editedAt } : null,
        over, status: statusOf(x, answers, over) };
    });
  }, [store, answers]);

  const count = (s) => all.filter((x) => x.status === s).length;
  const unlinked = all.filter((x) => !x.comps.length).length;
  const rows = all.filter((x) =>
    (!ftopic || String(x.topic) === ftopic) &&
    (!fowner || x.owner === fowner) &&
    (!fstatus || x.status === fstatus) &&
    (!q || x.body.toLowerCase().includes(q.toLowerCase()) || String(x.n) === q));

  const grouped = TOPICS.map((tp) => [tp, rows.filter((r) => r.topic === tp.no)])
    .filter(([, r]) => r.length);

  const addAnswer = (qid, body) => {
    const id = `a${Date.now()}`;
    commit({ ...store, a: { ...store.a,
      [id]: { qid, body, author: actor, createdAt: now() } } });
  };
  const setStatus = (qid, status, note) => commit({ ...store,
    q: { ...store.q, [qid]: { ...(store.q[qid] || {}), status,
      statusBy: actor, statusAt: now() } },
    ev: [...store.ev, { qid, to: status, at: now(), actor, note: note || "" }] });
  const saveQuestionEdit = (qid, body) => commit({ ...store,
    q: { ...store.q, [qid]: { ...(store.q[qid] || {}), body,
      editedBy: actor, editedAt: now() } } });
  const postQuestion = () => {
    const n = Math.max(FIRST_USER_ID - 1,
      ...Object.keys(store.n || {}).map(Number)) + 1;
    commit({ ...store, n: { ...store.n, [n]: { n, topic: Number(draft.topic) || 1,
      owner: draft.owner || "KB", body: draft.body, raisedBy: actor,
      raisedAt: now(), comps: draft.comps || [] } } });
    setAsking(false); setDraft({});
  };

  const S = sty(t);
  return (
    <div>
      <div style={S.head}>
        <span onClick={onBack} style={S.back}>← Hub</span>
        <b style={{ fontSize: 17, color: t.text }}>Discussion</b>
        <span style={{ ...S.pill, background: live ? "#e8f6ed" : "#f1f4f7",
          color: live ? "#15803d" : "#6b7884" }}>
          {live ? "● shared" : "○ local only — this browser"}</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setAsking(!asking)} style={S.primary}>
          + Ask a question</span>
      </div>

      <div style={S.kpis}>
        {["open", "answered", "resolved", "blocked"].map((s) => (
          <div key={s} style={{ ...S.kpi, borderColor: s === "blocked" && count(s)
            ? ST.blocked.c : t.panel2 || "#dfe6e9" }}>
            <div style={S.kpiK}>{ST[s].label.replace("✓ ", "")}</div>
            <div style={{ ...S.kpiV, color: ST[s].c }}>{count(s)}</div></div>))}
        <div style={S.kpi}><div style={S.kpiK}>unlinked</div>
          <div style={{ ...S.kpiV, color: unlinked ? "#b4620f" : t.sub }}>
            {unlinked}</div></div>
        <div style={S.kpi}><div style={S.kpiK}>total</div>
          <div style={S.kpiV}>{all.length}</div></div>
      </div>

      <div style={S.owners}>
        {Object.entries(OWNERS).map(([k, o]) => {
          const mine = all.filter((x) => x.owner === k);
          return (
            <span key={k} onClick={() => setFowner(fowner === k ? "" : k)}
              style={{ ...S.ow, borderColor: fowner === k ? t.accent || "#0f4775"
                : t.panel2 || "#dfe6e9" }}>
              <b>{o.name}</b> {mine.length}
              <i style={S.owOk}> {mine.filter((x) => x.status === "resolved").length} resolved</i>
            </span>);
        })}
        <span style={{ ...S.ow, borderStyle: "dashed", color: t.sub }}>
          anyone can raise one</span>
      </div>

      <div style={S.filters}>
        <select value={ftopic} onChange={(e) => setFtopic(e.target.value)} style={S.sel}>
          <option value="">all 17 topics</option>
          {TOPICS.map((tp) => (
            <option key={tp.no} value={tp.no}>{tp.no} · {tp.title}</option>))}
        </select>
        <select value={fstatus} onChange={(e) => setFstatus(e.target.value)} style={S.sel}>
          <option value="">all statuses</option>
          {Object.keys(ST).map((s) => <option key={s} value={s}>{ST[s].label}</option>)}
        </select>
        <span style={S.shown}>{rows.length} shown</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} style={S.srch}
          placeholder="Search question text or number…" />
      </div>

      {asking && (
        <div style={S.ask}>
          <textarea style={S.ta} placeholder="What do you need to know? One question per entry — a question with two halves gets half-answered."
            value={draft.body || ""}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div style={S.askRow}>
            <select style={S.sel} value={draft.topic || 1}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}>
              {TOPICS.map((tp) => <option key={tp.no} value={tp.no}>
                {tp.no} · {tp.title}</option>)}
            </select>
            <select style={S.sel} value={draft.owner || "KB"}
              onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>
              {Object.entries(OWNERS).map(([k, o]) =>
                <option key={k} value={k}>{o.name}</option>)}
            </select>
            <span style={S.hint}>links default from the topic — open the
              question after posting to change them</span>
            <span style={{ flex: 1 }} />
            <span onClick={draft.body ? postQuestion : undefined}
              style={{ ...S.primary, opacity: draft.body ? 1 : .45 }}>
              Post question</span>
          </div>
        </div>)}

      {grouped.map(([tp, qs]) => (
        <div key={tp.no}>
          <div style={S.grp}><b style={{ color: t.text }}>
            {tp.no} · {tp.title}</b>
            <span style={S.grpN}>{qs.length} ·{" "}
              {qs.filter((x) => x.status === "resolved").length} resolved</span></div>
          {qs.map((x) => open === x.n
            ? <Expanded key={x.n} t={t} x={x} S={S} answers={answers}
                actor={actor} store={store} commit={commit}
                onClose={() => setOpen(null)} onOpenComponent={onOpenComponent}
                setStatus={setStatus} addAnswer={addAnswer}
                saveQuestionEdit={saveQuestionEdit}
                editing={editing} setEditing={setEditing}
                text={text} setText={setText} />
            : <Row key={x.n} t={t} x={x} S={S} answers={answers}
                onOpen={() => setOpen(x.n)} />)}
        </div>))}

      {!rows.length && (
        <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5,
          color: t.textMuted }}>No questions match this filter.</div>)}
    </div>);
}

function Row({ t, x, S, answers, onOpen }) {
  const n = answers.filter((a) => a.qid === x.n).length;
  return (
    <div onClick={onOpen} style={S.row}>
      <span style={S.qn}>{x.n}</span>
      <span style={S.qt} title={x.body}>{x.body}</span>
      <span style={S.chips}>{x.comps.slice(0, 2).map((c) =>
        <i key={c} style={S.chip}>{compLabel(c)}</i>)}
        {x.comps.length > 2 && <i style={S.chip}>+{x.comps.length - 2}</i>}
        {!x.comps.length && <i style={{ ...S.chip, borderStyle: "dashed",
          color: "#b4620f" }}>unlinked</i>}</span>
      <span style={S.own}>{(OWNERS[x.owner] || {}).name || x.owner}</span>
      <Badge S={S} s={x.status} />
      <span style={S.ansN}>{n || ""}</span>
    </div>);
}

const Badge = ({ S, s }) => (
  <span style={{ ...S.badge, background: ST[s].bg, color: ST[s].c }}>
    {ST[s].label}</span>);

function Expanded({ t, x, S, answers, actor, store, commit, onClose,
                    onOpenComponent, setStatus, addAnswer, saveQuestionEdit,
                    editing, setEditing, text, setText }) {
  const [reply, setReply] = useState("");
  const mine = answers.filter((a) => a.qid === x.n);
  const editQ = editing === `q${x.n}`;
  return (
    <div style={S.open}>
      <div style={S.openHead}>
        <span style={S.qnBig}>{x.n}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editQ ? (<>
            <textarea style={S.ta} value={text}
              onChange={(e) => setText(e.target.value)} />
            <div style={{ marginTop: 6 }}>
              <span onClick={() => { saveQuestionEdit(x.n, text); setEditing(null); }}
                style={S.primarySm}>Save</span>{" "}
              <span onClick={() => setEditing(null)} style={S.ghostSm}>Cancel</span>
            </div></>)
            : <div style={S.qTitle}>{x.body}</div>}
          <div style={S.qMeta}>
            {x.raisedBy ? <>raised by <b>{x.raisedBy}</b> · {x.raisedAt} · </> : null}
            owner <b>{(OWNERS[x.owner] || {}).name || x.owner}</b> · topic {x.topic}
            {x.note ? ` · ${x.note}` : ""}
            {x.edited && <span style={{ color: "#b4620f" }}>
              {" "}· edited {x.edited.at} by {x.edited.by}</span>}
          </div>
        </div>
        <Badge S={S} s={x.status} />
        {!editQ && <span onClick={() => { setEditing(`q${x.n}`); setText(x.body); }}
          style={S.ghostSm}>✎ edit</span>}
        <span onClick={onClose} style={S.ghostSm}>✕ close</span>
      </div>

      <div style={S.links}>
        <span style={S.lk}>Linked components</span>
        {x.comps.map((c) => (
          <i key={c} onClick={() => onOpenComponent && onOpenComponent(c)}
            style={{ ...S.chip, cursor: onOpenComponent ? "pointer" : "default",
              borderColor: t.accent || "#0f4775", color: t.accent || "#0f4775" }}>
            {compLabel(c)} ↗</i>))}
        {!x.comps.length && <i style={{ ...S.chip, borderStyle: "dashed",
          color: "#b4620f" }}>none — nobody will find this from the architecture</i>}
      </div>

      <div style={S.ansHd}>{mine.length || "No"} answer{mine.length === 1 ? "" : "s"}</div>
      {mine.map((a) => {
        const ed = editing === a.id;
        return (
          <div key={a.id} style={{ ...S.answer,
            borderLeftColor: a.accepted ? "#15803d" : t.panel2 || "#dfe6e9" }}>
            <div style={S.aHead}>
              {a.accepted && <span style={S.acc}>✓ accepted answer</span>}
              <b style={{ color: t.text }}>{a.author}</b>
              <span style={S.aMet}>{a.createdAt}
                {a.updatedAt ? ` · edited ${a.updatedAt}` : ""}
                {a.accepted ? ` · accepted by ${a.acceptedBy}, ${a.acceptedAt}` : ""}</span>
              {!ed && <span onClick={() => { setEditing(a.id); setText(a.body); }}
                style={S.ghostSm}>✎ edit</span>}
              {!a.accepted && <span
                onClick={() => commit(acceptAnswer(store, x.n, a.id, actor))}
                style={S.okSm}>✓ accept &amp; resolve</span>}
            </div>
            {ed ? (<>
              <textarea style={S.ta} value={text}
                onChange={(e) => setText(e.target.value)} />
              {a.accepted && <div style={S.warn}>Saving this withdraws the
                acceptance — the question goes back to answered and the
                acceptor has to look again.</div>}
              <div style={{ marginTop: 6 }}>
                <span onClick={() => { commit(editAnswer(store, a.id, text, actor));
                  setEditing(null); }} style={S.primarySm}>Save</span>{" "}
                <span onClick={() => setEditing(null)} style={S.ghostSm}>Cancel</span>
              </div></>)
              : <div style={S.aBody}>{a.body}</div>}
            {a.accepted && x.comps.length > 0 && (
              <div style={S.aFoot}>→ this answer is the documentation for{" "}
                {x.comps.map((c) => <i key={c} style={{ ...S.chip,
                  borderColor: "#15803d", color: "#15803d" }}>{compLabel(c)}</i>)}</div>)}
          </div>);
      })}

      <div style={S.composer}>
        <textarea style={S.ta} value={reply} onChange={(e) => setReply(e.target.value)}
          placeholder="Write an answer… anyone can answer; the owner or a named decider accepts one." />
        <div style={S.cRow}>
          <span onClick={() => { if (reply.trim()) { addAnswer(x.n, reply.trim()); setReply(""); } }}
            style={{ ...S.primarySm, opacity: reply.trim() ? 1 : .45 }}>Post answer</span>
          <span style={{ flex: 1 }} />
          <span onClick={() => setStatus(x.n, "blocked")} style={S.ghostSm}>
            ⊘ mark blocked</span>
          <span onClick={() => setStatus(x.n, "superseded")} style={S.ghostSm}>
            ↗ supersede</span>
          {x.over && x.over.status && (
            <span onClick={() => setStatus(x.n, null)} style={S.ghostSm}>
              ↺ clear {x.over.status}</span>)}
        </div>
      </div>
    </div>);
}

// Inline styles, house pattern. No stylesheet, no class names.
const sty = (t) => ({
  head: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12,
    flexWrap: "wrap" },
  back: { fontSize: 11.5, fontWeight: 700, cursor: "pointer",
    color: t.accent || "#0f4775" },
  pill: { fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 9px" },
  primary: { fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "6px 12px",
    cursor: "pointer", background: t.accent || "#0f4775", color: "#fff" },
  primarySm: { fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "4px 10px",
    cursor: "pointer", background: t.accent || "#0f4775", color: "#fff" },
  ghostSm: { fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "4px 9px",
    cursor: "pointer", border: `1px solid ${t.panel2 || "#dfe6e9"}`, color: t.sub },
  okSm: { fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "4px 9px",
    cursor: "pointer", border: "1px solid #15803d", color: "#15803d",
    background: "#e8f6ed" },
  kpis: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  kpi: { border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 4,
    padding: "7px 12px", minWidth: 78, background: t.panel },
  kpiK: { fontSize: 9, fontWeight: 800, letterSpacing: .4,
    textTransform: "uppercase", color: t.textMuted },
  kpiV: { fontSize: 21, fontWeight: 600, lineHeight: 1.2, color: t.text },
  owners: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 },
  ow: { fontSize: 11, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 999, padding: "4px 11px", color: t.sub, cursor: "pointer" },
  owOk: { fontStyle: "normal", color: "#15803d", fontSize: 10, marginLeft: 4 },
  filters: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap",
    padding: "9px 0", borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderBottom: `1px solid ${t.panel2 || "#dfe6e9"}` },
  sel: { height: 28, fontSize: 11, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 4, background: t.panel, color: t.text, padding: "0 7px",
    maxWidth: 300 },
  shown: { fontSize: 10, color: t.textMuted },
  srch: { marginLeft: "auto", height: 28, width: 230, fontSize: 11,
    border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 4,
    padding: "0 9px", background: t.panel, color: t.text },
  grp: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap",
    padding: "14px 0 6px", fontSize: 12.5 },
  grpN: { fontSize: 10.5, color: t.textMuted },
  row: { display: "grid", gap: 10, alignItems: "center", padding: "9px 0",
    borderTop: `1px solid ${t.bg}`, fontSize: 12.5, cursor: "pointer",
    gridTemplateColumns: "32px minmax(0,1.4fr) minmax(0,0.9fr) 118px 78px 20px" },
  qn: { fontFamily: "monospace", fontSize: 11, color: t.textMuted, fontWeight: 700 },
  qnBig: { fontFamily: "monospace", fontSize: 17, fontWeight: 700,
    color: t.accent || "#0f4775" },
  qt: { color: t.text, overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap" },
  chips: { display: "flex", gap: 4, overflow: "hidden" },
  chip: { fontStyle: "normal", fontSize: 9.5, overflow: "hidden",
    textOverflow: "ellipsis", maxWidth: 190, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 3, padding: "2px 6px", color: t.sub, whiteSpace: "nowrap" },
  own: { fontSize: 11, color: t.sub, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: { fontSize: 9.5, fontWeight: 800, borderRadius: 3, padding: "2px 7px",
    textAlign: "center", whiteSpace: "nowrap" },
  ansN: { fontSize: 10.5, color: t.textMuted, textAlign: "center",
    fontFamily: "monospace" },
  open: { border: `1px solid ${t.accent || "#0f4775"}`, borderRadius: 6,
    margin: "10px 0", padding: "14px 16px", background: t.bg },
  openHead: { display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" },
  qTitle: { fontSize: 13.5, color: t.text, lineHeight: 1.55 },
  qMeta: { fontSize: 10.5, color: t.textMuted, marginTop: 4 },
  links: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
    margin: "12px 0 14px", padding: "9px 0",
    borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderBottom: `1px solid ${t.panel2 || "#dfe6e9"}` },
  lk: { fontSize: 9, fontWeight: 800, letterSpacing: .4,
    textTransform: "uppercase", color: t.textMuted, marginRight: 3 },
  ansHd: { fontSize: 9.5, fontWeight: 800, letterSpacing: .5,
    textTransform: "uppercase", color: t.textMuted, marginBottom: 8 },
  answer: { borderLeft: "2px solid", paddingLeft: 13, paddingBottom: 12,
    marginBottom: 12 },
  aHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap",
    fontSize: 12, marginBottom: 5 },
  acc: { fontSize: 9, fontWeight: 800, borderRadius: 3, padding: "2px 7px",
    background: "#e8f6ed", color: "#15803d" },
  aMet: { fontSize: 10.5, color: t.textMuted },
  aBody: { fontSize: 13, color: t.text, lineHeight: 1.6, maxWidth: "78ch",
    whiteSpace: "pre-wrap" },
  aFoot: { fontSize: 10.5, color: "#15803d", marginTop: 6, display: "flex",
    gap: 5, alignItems: "center", flexWrap: "wrap" },
  warn: { fontSize: 11, color: "#b4620f", marginTop: 6 },
  composer: { marginTop: 14, paddingTop: 12,
    borderTop: `1px solid ${t.panel2 || "#dfe6e9"}` },
  cRow: { display: "flex", gap: 7, alignItems: "center", marginTop: 7,
    flexWrap: "wrap" },
  ask: { border: `1px solid ${t.accent || "#0f4775"}`, borderRadius: 6,
    padding: "14px 16px", margin: "4px 0 12px", background: t.bg },
  askRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 10,
    flexWrap: "wrap" },
  ta: { width: "100%", boxSizing: "border-box", minHeight: 58, font: "inherit",
    fontSize: 12.5, border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 4,
    padding: "8px 10px", background: t.panel, color: t.text, resize: "vertical" },
  hint: { fontSize: 10, color: t.textMuted },
});
