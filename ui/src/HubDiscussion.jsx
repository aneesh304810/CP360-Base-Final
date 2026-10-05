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
import { seedRows, materialise, SEED_ANSWERS, CONF, SEI_GAP_NOTE }
  from "./hubAnswers.js";
import { FIGS } from "./HubAnswerFigs.jsx";

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

// ONE place that materialises a draft, not two. Accept and edit both
// read store.a[id], so a drafted row has to be written in before either
// runs — and when that was a separate call at each call site, removing
// it from one of them broke nothing that the suite could see.
export const onAnswer = (store, row, fn) => fn(materialise(store, row));

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

// Attaching a diagram.
//
// TWO PATHS, AND THE DIFFERENCE IS WORTH EXPLAINING ON SCREEN. An SVG
// exported from draw.io, Visio, Lucidchart or Figma stays crisp at any
// size, is a few kB, and is text the sanitiser can inspect. A screenshot
// is a raster and stays one -- auto-tracing it to SVG produces a file
// BIGGER than the PNG, with the text turned into unselectable outlines,
// and it looks worse. So the control offers both and says which is
// which, rather than pretending there is a convert button that helps.
export function Attach({ t, S, target, live, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [paste, setPaste] = useState(false);
  const [svg, setSvg] = useState("");

  if (!live) {
    return <div style={S.attachOff}>
      Attachments need the API — this browser&rsquo;s local copy has nowhere to
      put the bytes. Everything else on this screen still works.
    </div>;
  }

  const send = async (payload) => {
    setBusy(true); setErr("");
    const r = await discussionApi.uploadAttachment({ ...target, ...payload });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setSvg(""); setPaste(false);
    if (onDone) onDone(r.id);
  };

  const pick = (file) => {
    if (!file) return;
    const kind = discussionApi.attachKindFor(file);
    if (!kind) { setErr(`${file.name} is not an image`); return; }
    const fr = new FileReader();
    fr.onload = () => send(kind === "svg"
      ? { kind: "svg", filename: file.name, svgText: String(fr.result) }
      : { kind: "image", filename: file.name, dataBase64: String(fr.result) });
    fr.onerror = () => setErr("could not read that file");
    if (kind === "svg") fr.readAsText(file); else fr.readAsDataURL(file);
  };

  return (
    <div style={S.attach}>
      <label style={S.attachBtn}>
        {busy ? "uploading…" : "📎 attach image or SVG"}
        <input type="file" accept="image/*,.svg" style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => { pick(e.target.files && e.target.files[0]);
            e.target.value = ""; }} />
      </label>
      <span onClick={() => setPaste(!paste)} style={S.ghostSm}>
        {paste ? "✕ cancel" : "⌨ paste SVG markup"}</span>
      <div style={S.attachHint}>
        A diagram exported as <b>SVG</b> stays sharp and themeable. A
        screenshot stays a raster — tracing one to SVG makes it larger and
        blurrier, so it is kept as it is.
      </div>
      {paste && <div style={{ width: "100%" }}>
        <textarea style={{ ...S.ta, fontFamily: "monospace", fontSize: 11 }}
          value={svg} onChange={(e) => setSvg(e.target.value)}
          placeholder="Paste the contents of an .svg file here — export from draw.io, Visio, Lucidchart or Figma." />
        <span onClick={() => svg.trim() && send({ kind: "svg",
          filename: "pasted.svg", svgText: svg })}
          style={{ ...S.primarySm, opacity: svg.trim() ? 1 : .45 }}>
          Attach SVG</span>
      </div>}
      {err && <div style={S.attachErr}>✕ {err}</div>}
    </div>
  );
}

// Script, event handlers and external references are stripped server
// side before an SVG is stored, and the server refuses to serve a row
// that did not go through that. Rendering in an <img> rather than inline
// is the second layer: an <img> does not execute an SVG's script even if
// one survived.
// A missing attachment says so. The browser's broken-image glyph says
// nothing about whether the row is gone, the API is down or the bytes
// were refused for not being sanitised — and this screen is a record, so
// "there was a diagram here" matters.
function AttImg({ t, S, a }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div style={S.attGone}>
      ⚠ could not load {a.filename || a.kind}
      <div style={{ fontSize: 9, marginTop: 2 }}>
        the API may be unreachable, or the file was refused as unsanitised
      </div>
    </div>;
  }
  return <img src={discussionApi.attachmentUrl(a.id)} style={S.attImg}
    alt={a.caption || a.filename || "attachment"}
    onError={() => setFailed(true)} />;
}

export function Attachments({ t, S, items, onRemove }) {
  if (!items || !items.length) return null;
  return (
    <div style={S.attRow}>
      {items.map((a) => (
        <figure key={a.id} style={S.attFig}>
          <AttImg t={t} S={S} a={a} />
          <figcaption style={S.attCap}>
            {a.filename || a.kind}
            {a.kind === "svg" && a.note && a.note !== "clean"
              && <span style={S.attNote} title={a.note}> · sanitised</span>}
            {onRemove && <span onClick={() => onRemove(a.id)}
              style={S.attDel}>remove</span>}
          </figcaption>
        </figure>))}
    </div>
  );
}

export default function HubDiscussion({ t, onOpenComponent, onBack, me }) {
  const actor = me || "local.user";
  const [store, setStore] = useState(emptyStore);
  const [live, setLive] = useState(false);
  // null until the API answers. Non-null means the questions on screen
  // came from the database; null means the copy in this bundle.
  const [corpus, setCorpus] = useState(null);
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
    discussionApi.load().then(({ store: s, live: l, corpus: c }) => {
      if (!on) return; setStore(s); setLive(l); setCorpus(c || null);
    });
    return () => { on = false; };
  }, []);
  // Optimistic locally, authoritative from the server. Every write names
  // the operation it performed so the server can apply it to ONE row --
  // a whole-store save loses whatever the other person typed meanwhile.
  // Without an API the optimistic copy is all there is, and the header
  // already says so.
  const commit = (next, op) => {
    setStore(next);
    if (!op) { discussionApi.save(next); return; }
    // A drafted answer has no row until somebody acts on it, so the
    // first accept or edit has to create it before the operation that
    // assumes it exists. answer.seed is idempotent: two people opening
    // the same question cannot make two rows.
    const { seed, ...rest } = op;
    const first = seed
      ? discussionApi.applyOp({ actor, op: "answer.seed", qid: rest.qid,
          answerId: rest.answerId, body: seed.body })
      : Promise.resolve(true);
    first
      .then(() => discussionApi.applyOp({ actor, ...rest }))
      .then((fromServer) => {
        if (fromServer) { setStore(fromServer); setLive(true); }
        else discussionApi.save(next);
      });
  };

  // Drafted answers are merged in as rows rather than written into the
  // store, so a better draft in a later deploy reaches everyone instead
  // of being shadowed by a copy saved on somebody's first visit. The
  // moment anyone accepts or edits one it is materialised and becomes
  // theirs.
  // When the corpus is in the database the drafted answers are rows
  // there too, so merging the bundled copy as well would show every
  // draft twice. The bundle's drafts are the cold start, nothing more.
  const answers = useMemo(() => [
    ...Object.entries(store.a || {}).map(([id, a]) => ({ ...a, id })),
    ...(corpus ? [] : seedRows(store)),
  ], [store, corpus]);

  // Seeded review questions plus anything raised in the app. The two are
  // kept apart so a redeploy cannot duplicate the first or drop the second.
  const QS = corpus ? corpus.questions.filter((x) => x.source !== "user")
                   : QUESTIONS;
  const TPS = corpus && corpus.topics.length ? corpus.topics : TOPICS;
  const OWN = corpus && Object.keys(corpus.owners || {}).length
    ? corpus.owners : OWNERS;

  const all = useMemo(() => {
    const extra = Object.values(store.n || {});
    return [...QS, ...extra].map((x) => {
      const over = (store.q || {})[x.n] || {};
      return { ...x, ...(over.body ? { body: over.body } : {}),
        comps: over.comps || x.comps || compsFor(x), docs: over.docs || x.docs || [],
        edited: over.editedAt ? { by: over.editedBy, at: over.editedAt } : null,
        over, status: statusOf(x, answers, over) };
    });
  }, [store, answers, QS]);

  const count = (s) => all.filter((x) => x.status === s).length;
  const unlinked = all.filter((x) => !x.comps.length).length;
  const rows = all.filter((x) =>
    (!ftopic || String(x.topic) === ftopic) &&
    (!fowner || x.owner === fowner) &&
    (!fstatus || x.status === fstatus) &&
    (!q || x.body.toLowerCase().includes(q.toLowerCase()) || String(x.n) === q));

  const grouped = TPS.map((tp) => [tp, rows.filter((r) => r.topic === tp.no)])
    .filter(([, r]) => r.length);

  const addAnswer = (qid, body) => {
    const id = `a${Date.now()}`;
    commit({ ...store, a: { ...store.a,
      [id]: { qid, body, author: actor, createdAt: now() } } },
      { op: "answer.add", qid, body });
  };
  const setStatus = (qid, status, note) => commit({ ...store,
    q: { ...store.q, [qid]: { ...(store.q[qid] || {}), status,
      statusBy: actor, statusAt: now() } },
    ev: [...store.ev, { qid, to: status, at: now(), actor, note: note || "" }] },
    { op: "question.status", qid, status, note });
  const saveQuestionEdit = (qid, body, comps) => commit({ ...store,
    q: { ...store.q, [qid]: { ...(store.q[qid] || {}), body,
      editedBy: actor, editedAt: now() } } },
    { op: "question.edit", qid, body, comps });
  const postQuestion = () => {
    const n = Math.max(FIRST_USER_ID - 1,
      ...Object.keys(store.n || {}).map(Number)) + 1;
    commit({ ...store, n: { ...store.n, [n]: { n, topic: Number(draft.topic) || 1,
      owner: draft.owner || "KB", body: draft.body, raisedBy: actor,
      raisedAt: now(), comps: draft.comps || [] } } },
      { op: "question.add", topic: Number(draft.topic) || 1,
        owner: draft.owner || "KB", body: draft.body, comps: draft.comps || [] });
    setAsking(false); setDraft({});
  };

  // An attachment is written by the server, not by the reducer, so the
  // store has to be re-read rather than guessed at.
  const refresh = () => discussionApi.load()
    .then(({ store: s2, live: l2, corpus: c2 }) => {
      setStore(s2); setLive(l2); setCorpus(c2 || null);
    });

  const S = sty(t);
  return (
    <div>
      <div style={S.head}>
        <span onClick={onBack} style={S.back}>← Hub</span>
        <b style={{ fontSize: 17, color: t.text }}>Discussion</b>
        <span style={{ ...S.pill,
          background: corpus ? "#e8f6ed" : "#fdf2e3",
          color: corpus ? "#15803d" : "#8c6a1f" }}
          title={corpus
            ? "questions, answers and attachments are rows in Oracle"
            : "the API or the corpus load has not run — showing the copy "
              + "that ships with this build, and nothing typed here is shared"}>
          {corpus ? "◆ from the database" : "▲ bundled copy"}</span>
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
        {Object.entries(OWN).map(([k, o]) => {
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
          {TPS.map((tp) => (
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
              {TPS.map((tp) => <option key={tp.no} value={tp.no}>
                {tp.no} · {tp.title}</option>)}
            </select>
            <select style={S.sel} value={draft.owner || "KB"}
              onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>
              {Object.entries(OWN).map(([k, o]) =>
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
                live={live} refresh={refresh} own={OWN}
                actor={actor} store={store} commit={commit}
                onClose={() => setOpen(null)} onOpenComponent={onOpenComponent}
                setStatus={setStatus} addAnswer={addAnswer}
                saveQuestionEdit={saveQuestionEdit}
                editing={editing} setEditing={setEditing}
                text={text} setText={setText} />
            : <Row key={x.n} t={t} x={x} S={S} answers={answers} own={OWN}
                onOpen={() => setOpen(x.n)} />)}
        </div>))}

      {!rows.length && (
        <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5,
          color: t.textMuted }}>No questions match this filter.</div>)}
    </div>);
}

function Row({ t, x, S, answers, onOpen, own }) {
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
      <span style={S.own}>{((own || OWNERS)[x.owner] || {}).name || x.owner}</span>
      <Badge S={S} s={x.status} />
      <span style={S.ansN}>{n || ""}</span>
    </div>);
}

const Badge = ({ S, s }) => (
  <span style={{ ...S.badge, background: ST[s].bg, color: ST[s].c }}>
    {ST[s].label}</span>);

export function Expanded({ t, x, S, answers, actor, store, commit, onClose, live, refresh, own,
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
            owner <b>{((own || OWNERS)[x.owner] || {}).name || x.owner}</b> · topic {x.topic}
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
              {a.draft && <span style={S.draft}>draft · not agreed</span>}
              {a.conf && CONF[a.conf] && <span style={{ ...S.conf,
                background: CONF[a.conf].bg, color: CONF[a.conf].c }}>
                {CONF[a.conf].label}</span>}
              <b style={{ color: t.text }}>{a.author}</b>
              <span style={S.aMet}>{a.createdAt}
                {a.updatedAt ? ` · edited ${a.updatedAt}` : ""}
                {a.accepted ? ` · accepted by ${a.acceptedBy}, ${a.acceptedAt}` : ""}</span>
              {!ed && <span onClick={() => { setEditing(a.id); setText(a.body); }}
                style={S.ghostSm}>✎ edit</span>}
              {!a.accepted && <span
                onClick={() => commit(onAnswer(store, a,
                  (st) => acceptAnswer(st, x.n, a.id, actor)),
                  { op: "answer.accept", qid: x.n, answerId: a.id,
                    seed: a.draft ? { body: a.body } : null })}
                style={S.okSm}>✓ accept &amp; resolve</span>}
            </div>
            {ed ? (<>
              <textarea style={S.ta} value={text}
                onChange={(e) => setText(e.target.value)} />
              {a.accepted && <div style={S.warn}>Saving this withdraws the
                acceptance — the question goes back to answered and the
                acceptor has to look again.</div>}
              <div style={{ marginTop: 6 }}>
                <span onClick={() => { commit(onAnswer(store, a,
                  (st) => editAnswer(st, a.id, text, actor)),
                  { op: "answer.edit", qid: x.n, answerId: a.id, body: text,
                    seed: a.draft ? { body: a.body } : null });
                  setEditing(null); }} style={S.primarySm}>Save</span>{" "}
                <span onClick={() => setEditing(null)} style={S.ghostSm}>Cancel</span>
              </div></>)
              : <div style={S.aBody}>
                  {a.body}
                  {a.fig && FIGS[a.fig] && (
                    <div style={S.fig}>{React.createElement(FIGS[a.fig])}</div>)}
                  {a.quote && <blockquote style={S.quote}>“{a.quote}”</blockquote>}
                  {a.conf === "practice" && (
                    <div style={S.prov}>{SEI_GAP_NOTE}</div>)}
                  {a.seiAsk && <div style={S.ask}>
                    <b style={{ color: "#0f4775" }}>Ask SEI · </b>{a.seiAsk}</div>}
                  {a.gap && <div style={S.gap}>
                    <b style={{ color: "#8c6a1f" }}>What this does not settle · </b>
                    {a.gap}</div>}
                  {a.ev && a.ev.length > 0 && <div style={S.ev}>
                    {a.ev.map((e) => <i key={e} style={S.evChip}>{e}</i>)}</div>}
                </div>}
            {/* Outside the edit branch on purpose. The first version put
                the attach control inside it, so a diagram could only be
                added by someone who had first clicked "edit" — which is
                also the one action that withdraws an acceptance. */}
            <Attachments t={t} S={S} items={(store.atts || {})[a.id]}
              onRemove={(id) => discussionApi.deleteAttachment(id).then(refresh)} />
            <Attach t={t} S={S} live={live} onDone={refresh}
              target={{ answerId: a.id, qid: x.n }} />
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
export const sty = (t) => ({
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
  conf: { fontSize: 9, fontWeight: 800, borderRadius: 3, padding: "2px 7px" },
  // Grey and quiet: provenance, not a finding.
  prov: { fontSize: 11, lineHeight: 1.5, marginTop: 10, maxWidth: "76ch",
    color: t.textMuted, background: t.hoverBg || "#f1f5f9",
    border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 6,
    padding: "8px 11px" },
  // Blue and loud: this one is a question somebody has to put to SEI.
  ask: { fontSize: 12, lineHeight: 1.55, marginTop: 8, maxWidth: "76ch",
    color: "#1d3c57", background: "#e4f0fb", border: "1px solid #9cc2e4",
    borderRadius: 6, padding: "9px 12px" },
  quote: { margin: "10px 0 0", padding: "7px 12px", fontSize: 12,
    lineHeight: 1.55, maxWidth: "74ch", fontStyle: "italic",
    color: t.textMuted, borderLeft: `3px solid ${t.panel2 || "#dfe6e9"}` },
  attach: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
    marginTop: 9, paddingTop: 9,
    borderTop: `1px dashed ${t.panel2 || "#dfe6e9"}` },
  attachBtn: { fontSize: 10.5, fontWeight: 700, padding: "4px 11px",
    borderRadius: 4, cursor: "pointer", background: t.hoverBg || "#f1f4f7",
    color: t.text, border: `1px solid ${t.panel2 || "#dfe6e9"}` },
  attachHint: { fontSize: 10.5, color: t.textMuted, flexBasis: "100%",
    lineHeight: 1.5, maxWidth: "70ch" },
  attachOff: { fontSize: 10.5, color: "#8c6a1f", marginTop: 9, padding: "7px 10px",
    background: "#fdf2e3", border: "1px solid #e8c88f", borderRadius: 5,
    maxWidth: "70ch", lineHeight: 1.5 },
  attachErr: { fontSize: 10.5, color: "#c1113a", flexBasis: "100%" },
  attRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  attFig: { margin: 0, maxWidth: 320, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
    borderRadius: 7, padding: 6, background: "#ffffff" },
  attImg: { display: "block", maxWidth: "100%", maxHeight: 240, borderRadius: 4 },
  attCap: { fontSize: 9.5, color: t.textMuted, marginTop: 5, display: "flex",
    gap: 6, alignItems: "center", flexWrap: "wrap" },
  attNote: { color: "#8c6a1f" },
  attGone: { fontSize: 10.5, color: "#8c6a1f", background: "#fdf2e3",
    border: "1px dashed #e8c88f", borderRadius: 4, padding: "14px 12px",
    width: 240, lineHeight: 1.4 },
  attDel: { marginLeft: "auto", cursor: "pointer", color: "#c1113a" },
  // Amber, worded, and never only a colour: a draft that reads as an
  // agreed answer is the one failure this whole screen exists to avoid.
  draft: { fontSize: 9, fontWeight: 800, borderRadius: 3, padding: "2px 7px",
    background: "#fdf2e3", color: "#8c6a1f", border: "1px solid #e8c88f" },
  fig: { margin: "12px 0 4px", maxWidth: 640, background: "#ffffff",
    border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 8,
    padding: "10px 12px" },
  gap: { fontSize: 12, lineHeight: 1.55, marginTop: 10, maxWidth: "78ch",
    background: "#fdf2e3", border: "1px solid #e8c88f", borderRadius: 6,
    padding: "9px 12px", color: "#6d5518", whiteSpace: "pre-wrap" },
  ev: { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 },
  evChip: { fontStyle: "normal", fontSize: 9.5, padding: "2px 8px",
    borderRadius: 3, background: t.hoverBg || "#f1f4f7", color: t.textMuted,
    border: `1px solid ${t.panel2 || "#dfe6e9"}` },
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
