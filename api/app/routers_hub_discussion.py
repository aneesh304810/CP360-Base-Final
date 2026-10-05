"""CP Integration Hub — Discussion. Rows, not a JSON blob.

WHY OPERATIONS AND NOT A WHOLE-STORE PUT. The screen used to round-trip
the entire discussion as one document. Two people typing at once meant
the second save silently overwrote the first, and nobody could tell
afterwards. Every write here is one named operation against one row, so
a concurrent edit is a conflict on one answer rather than a lost
afternoon, and the audit trail records each one.

THE 108 REVIEW QUESTIONS ARE NOT IN THE DATABASE. They ship with the UI
as the starting corpus. This stores what people DO to them, plus
questions raised in the app, which number from 1001. A seeded question
nobody has touched has no row, and absence means untouched.

ATTACHMENTS. A diagram belongs to an answer. SVG is sanitised before it
is stored -- see svg_sanitize -- and the reader refuses to serve a row
that was not, so a row inserted around the API cannot be rendered.
"""
from __future__ import annotations
import base64
import hashlib
import logging
import re
import time
import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from .db import query, execute
from .hub_identity import whoami
from .svg_sanitize import sanitize_svg

log = logging.getLogger("cp.api.hub_discussion")
router = APIRouter(prefix="/hub/discussion", tags=["hub-discussion"])

FIRST_USER_QID = 1001
MAX_BODY = 20000
MAX_IMAGE_BYTES = 6_000_000

# Declared types are not evidence. These are the first bytes of the file.
MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("hub_discussion query failed: %s", str(e)[:160])
        return []


def _write(statements):
    try:
        execute(statements)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("hub_discussion write failed: %s", str(e)[:200])
        return False


def _clob(v):
    if v is None:
        return None
    try:
        return v.read() if hasattr(v, "read") else str(v)
    except Exception:  # noqa: BLE001
        return None


def _ts(v):
    return v.isoformat(sep=" ", timespec="minutes") if hasattr(v, "isoformat") else (v or None)


def _nid(prefix):
    return f"{prefix}{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"


def _actor(v):
    return (str(v or "local.user"))[:200]


def _body(v):
    s = str(v or "").strip()
    if not s:
        raise HTTPException(400, "body is empty")
    return s[:MAX_BODY]


def sniff(raw: bytes):
    """The real type of these bytes, or None.

    A file that says image/png and is not one would be served back with a
    type a browser might act on. Only what is recognised here is stored.
    """
    for sig, mime in MAGIC:
        if raw.startswith(sig):
            return mime
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


# --------------------------------------------------------------- read
def _corpus():
    """Topics, owners and the questions themselves — all from the table.

    "Read the questions from the database" is not satisfied by reading
    questions and then taking their grouping and their owners' names
    from a constant in the bundle, so those are rows too.
    """
    owners, totals = {}, {}
    for r in _safe("SELECT owner_code, name, focus, declared_total FROM hub_owner"):
        owners[r["owner_code"]] = {"name": r.get("name"), "focus": r.get("focus")}
        if r.get("declared_total") is not None:
            totals[r["owner_code"]] = int(r["declared_total"])

    topics = [{"no": int(r["topic_no"]), "title": r.get("title"),
               "comps": [c for c in (r.get("comps") or "").split(",") if c]}
              for r in _safe("SELECT topic_no, title, comps, sort_order "
                             "FROM hub_topic ORDER BY sort_order, topic_no")]

    questions = [{"n": int(r["qid"]), "topic": int(r["topic"] or 0),
                  "owner": r.get("owner_code") or "KB",
                  "body": _clob(r.get("body")) or "",
                  "comps": [c for c in (r.get("comps") or "").split(",") if c],
                  "note": r.get("note"),
                  "source": r.get("source") or "review"}
                 for r in _safe("SELECT qid, topic, owner_code, body, comps, "
                                "note, source FROM hub_question ORDER BY qid")]
    return {"owners": owners, "ownerTotals": totals,
            "topics": topics, "questions": questions}


def _store():
    out = {"q": {}, "a": {}, "n": {}, "ev": [], "atts": {}}

    for r in _safe("SELECT qid, source, topic, owner_code, body, comps, status, "
                   "status_by, status_at, created_by, created_at, edited_by, "
                   "edited_at FROM hub_question"):
        qid = int(r["qid"])
        body = _clob(r.get("body"))
        comps = [c for c in (r.get("comps") or "").split(",") if c]
        rec = {}
        if comps:
            rec["comps"] = comps
        if r.get("status"):
            rec.update(status=r["status"], statusBy=r.get("status_by"),
                       statusAt=_ts(r.get("status_at")))
        if r.get("edited_at"):
            rec.update(editedBy=r.get("edited_by"), editedAt=_ts(r.get("edited_at")),
                       body=body)
        out["q"][str(qid)] = rec
        if (r.get("source") or "review") == "user":
            out["n"][str(qid)] = {
                "n": qid, "topic": int(r["topic"] or 0),
                "owner": r.get("owner_code") or "KB", "body": body or "",
                "comps": comps, "raisedBy": r.get("created_by"),
                "raisedAt": _ts(r.get("created_at")),
            }

    for r in _safe("SELECT answer_id, qid, body, author, created_at, updated_by, "
                   "updated_at, accepted, accepted_by, accepted_at, seed_key, "
                   "conf, gap, quote, fig, ev, is_draft, sei_ask, signoff, lan_id, "
                   "host_name, id_source FROM hub_answer"):
        a = {"qid": int(r["qid"]), "body": _clob(r.get("body")) or "",
             "author": r.get("author"), "createdAt": _ts(r.get("created_at")),
             "accepted": (r.get("accepted") or "N") == "Y"}
        if r.get("updated_at"):
            a.update(updatedBy=r.get("updated_by"), updatedAt=_ts(r.get("updated_at")))
        if a["accepted"]:
            a.update(acceptedBy=r.get("accepted_by"),
                     acceptedAt=_ts(r.get("accepted_at")),
                     signoff=r.get("signoff"), lanId=r.get("lan_id"),
                     host=r.get("host_name"), idSource=r.get("id_source"))
        if r.get("seed_key"):
            a["seedKey"] = r["seed_key"]
        # A drafted answer keeps its draft chrome only while it IS one.
        # Editing clears the flag, because at that point it is the
        # editor's answer and labelling it a draft misattributes it.
        if (r.get("is_draft") or "N") == "Y" and not r.get("updated_at"):
            a["draft"] = True
            a.update(conf=r.get("conf"), gap=_clob(r.get("gap")),
                     quote=_clob(r.get("quote")), fig=r.get("fig"),
                     seiAsk=r.get("sei_ask"),
                     ev=[e.strip() for e in (r.get("ev") or "").split("|") if e.strip()])
        out["a"][r["answer_id"]] = a

    # Metadata only; the bytes are fetched one at a time by the browser.
    for r in _safe("SELECT att_id, answer_id, qid, kind, mime, filename, caption, "
                   "width_px, height_px, byte_size, sanitised, sanitise_note, "
                   "uploaded_by, uploaded_at FROM hub_attachment ORDER BY uploaded_at"):
        key = r.get("answer_id") or f"q{int(r['QID'] or 0)}"
        out["atts"].setdefault(key, []).append({
            "id": r["att_id"], "kind": r.get("kind"), "mime": r.get("mime"),
            "filename": r.get("filename"), "caption": r.get("caption"),
            "w": r.get("width_px"), "h": r.get("height_px"),
            "bytes": r.get("byte_size"),
            "sanitised": (r.get("sanitised") or "N") == "Y",
            "note": r.get("sanitise_note"),
            "by": r.get("uploaded_by"), "at": _ts(r.get("uploaded_at")),
        })

    for r in _safe("SELECT qid, answer_id, to_status, actor, at_ts, note "
                   "FROM hub_event ORDER BY at_ts"):
        out["ev"].append({"qid": int(r["qid"] or 0), "to": r.get("to_status"),
                          "actor": r.get("actor"), "at": _ts(r.get("at_ts")),
                          "note": r.get("note") or ""})
    return out


@router.get("/whoami")
def who(request: Request):
    """What the server can tell about the caller.

    verified false means the screen must ask who this is and say the
    answer is self-declared. None of it comes from the browser.
    """
    return whoami(request)


@router.get("")
def get_discussion():
    c = _corpus()
    # An empty corpus means the loader has not been run. Saying so lets
    # the screen fall back to the shipped copy and SAY it is doing that,
    # rather than rendering a review with no questions in it.
    return {"store": _store(), "corpus": c, "persisted": True,
            "seeded": len(c["questions"]) > 0}


# -------------------------------------------------------------- write
class Op(BaseModel):
    op: str
    qid: int | None = None
    answerId: str | None = None
    body: str | None = None
    actor: str | None = None
    status: str | None = None
    note: str | None = None
    signoff: str | None = None
    topic: int | None = None
    owner: str | None = None
    comps: list[str] | None = None


def _ev(qid, answer_id, to, actor, note):
    return ("INSERT INTO hub_event (event_id, qid, answer_id, to_status, actor, note) "
            "VALUES (:i, :q, :a, :t, :c, :n)",
            {"i": _nid("e"), "q": qid, "a": answer_id, "t": to,
             "c": actor, "n": (note or "")[:1000]})


def _touch_question(qid, source="review", topic=None, owner=None):
    """A question row may not exist yet: the 108 live in code."""
    return ("MERGE INTO hub_question d USING (SELECT :q AS qid FROM dual) s "
            "ON (d.qid = s.qid) "
            "WHEN NOT MATCHED THEN INSERT (qid, source, topic, owner_code) "
            "VALUES (:q, :s, :t, :o)",
            {"q": qid, "s": source, "t": topic, "o": owner})


@router.post("/op")
def apply_op(o: Op, request: Request):
    actor = _actor(o.actor)
    who_ = whoami(request)
    st = []

    if o.op == "answer.add":
        if o.qid is None:
            raise HTTPException(400, "qid required")
        aid = _nid("a")
        st.append(_touch_question(o.qid))
        st.append(("INSERT INTO hub_answer (answer_id, qid, body, author) "
                   "VALUES (:i, :q, :b, :u)",
                   {"i": aid, "q": o.qid, "b": _body(o.body), "u": actor}))
        st.append(_ev(o.qid, aid, "answered", actor, "answer posted"))

    elif o.op == "answer.edit":
        if not o.answerId:
            raise HTTPException(400, "answerId required")
        cur = _safe("SELECT qid, accepted FROM hub_answer WHERE answer_id = :i",
                    {"i": o.answerId})
        if not cur:
            raise HTTPException(404, "no such answer")
        qid = int(cur[0]["qid"])
        was = (cur[0].get("accepted") or "N") == "Y"
        # Editing an accepted answer withdraws the acceptance, here as well
        # as in the browser -- the rule has to hold for any client.
        st.append(("UPDATE hub_answer SET body = :b, updated_by = :u, "
                   "updated_at = SYSTIMESTAMP, accepted = 'N', "
                   "accepted_by = NULL, accepted_at = NULL WHERE answer_id = :i",
                   {"b": _body(o.body), "u": actor, "i": o.answerId}))
        if was:
            st.append(_ev(qid, o.answerId, "answered", actor,
                          "acceptance withdrawn — the accepted answer was edited"))

    elif o.op == "answer.accept":
        if not o.answerId or o.qid is None:
            raise HTTPException(400, "qid and answerId required")
        # A sign-off needs a person, and a session default is not one.
        if not o.actor or len(o.actor.strip()) < 3:
            raise HTTPException(400, "accepting requires the name of the "
                                     "person signing off")
        st.append(("UPDATE hub_answer SET accepted = 'N', accepted_by = NULL, "
                   "accepted_at = NULL, signoff = NULL, lan_id = NULL, "
                   "host_name = NULL, client_ip = NULL, id_source = NULL "
                   "WHERE qid = :q", {"q": o.qid}))
        # When the server knows the account, that is who signed —
        # whatever the browser sent. A self-declared name is only used
        # when nothing else is available, and ID_SOURCE records which.
        signer = who_["lanId"] if who_["verified"] else actor
        st.append(("UPDATE hub_answer SET accepted = 'Y', accepted_by = :u, "
                   "accepted_at = SYSTIMESTAMP, signoff = :s, lan_id = :l, "
                   "host_name = :h, client_ip = :p, id_source = :src "
                   "WHERE answer_id = :i",
                   {"u": signer, "s": (o.signoff or "")[:600],
                    "l": who_["lanId"], "h": who_["host"], "p": who_["ip"],
                    "src": who_["source"], "i": o.answerId}))
        st.append(("UPDATE hub_question SET status = NULL, status_by = NULL, "
                   "status_at = NULL WHERE qid = :q", {"q": o.qid}))
        st.append(_ev(o.qid, o.answerId, "resolved", actor,
                      f"accepted answer {o.answerId}"))

    elif o.op == "answer.seed":
        # A drafted answer becomes a row the first time somebody acts on
        # it. seed_key keeps it distinguishable from one a person wrote.
        if o.qid is None or not o.answerId:
            raise HTTPException(400, "qid and answerId required")
        if _safe("SELECT answer_id FROM hub_answer WHERE answer_id = :i",
                 {"i": o.answerId}):
            return {"store": _store(), "ok": True}
        st.append(_touch_question(o.qid))
        st.append(("INSERT INTO hub_answer (answer_id, qid, body, author, seed_key) "
                   "VALUES (:i, :q, :b, :u, :k)",
                   {"i": o.answerId, "q": o.qid, "b": _body(o.body),
                    "u": _actor(o.actor or "CP360 · drafted from the codebase"),
                    "k": o.answerId}))

    elif o.op == "question.add":
        nxt = _safe("SELECT NVL(MAX(qid), :f - 1) + 1 AS n FROM hub_question "
                    "WHERE qid >= :f", {"f": FIRST_USER_QID})
        qid = int(nxt[0]["n"]) if nxt else FIRST_USER_QID
        st.append(("INSERT INTO hub_question (qid, source, topic, owner_code, body, "
                   "comps, created_by) VALUES (:q, 'user', :t, :o, :b, :c, :u)",
                   {"q": qid, "t": o.topic or 0, "o": (o.owner or "KB")[:10],
                    "b": _body(o.body), "c": ",".join(o.comps or [])[:400],
                    "u": actor}))
        st.append(_ev(qid, None, "open", actor, "question raised"))

    elif o.op == "question.edit":
        if o.qid is None:
            raise HTTPException(400, "qid required")
        st.append(_touch_question(o.qid))
        st.append(("UPDATE hub_question SET body = :b, comps = :c, "
                   "edited_by = :u, edited_at = SYSTIMESTAMP WHERE qid = :q",
                   {"b": _body(o.body), "c": ",".join(o.comps or [])[:400],
                    "u": actor, "q": o.qid}))

    elif o.op == "question.status":
        if o.qid is None or o.status not in ("blocked", "superseded", None, ""):
            raise HTTPException(400, "status must be blocked or superseded")
        st.append(_touch_question(o.qid))
        st.append(("UPDATE hub_question SET status = :s, status_by = :u, "
                   "status_at = SYSTIMESTAMP WHERE qid = :q",
                   {"s": o.status or None, "u": actor, "q": o.qid}))
        st.append(_ev(o.qid, None, o.status or "open", actor, o.note or ""))

    else:
        raise HTTPException(400, f"unknown op {o.op!r}")

    if not _write(st):
        raise HTTPException(503, "database unavailable")
    return {"store": _store(), "ok": True}


# --------------------------------------------------------- attachments
class Att(BaseModel):
    answerId: str | None = None
    qid: int | None = None
    kind: str                       # image | svg
    filename: str | None = None
    caption: str | None = None
    actor: str | None = None
    dataBase64: str | None = None   # image
    svgText: str | None = None      # svg


@router.post("/attachment")
def add_attachment(a: Att):
    if not a.answerId and a.qid is None:
        raise HTTPException(400, "attach to an answer or a question")
    att_id = _nid("t")
    common = {"i": att_id, "a": a.answerId, "q": a.qid,
              "f": (a.filename or "")[:300], "c": (a.caption or "")[:600],
              "u": _actor(a.actor)}

    if a.kind == "svg":
        clean, note = sanitize_svg(a.svgText or "")
        if clean is None:
            raise HTTPException(400, f"SVG rejected: {note}")
        sql = ("INSERT INTO hub_attachment (att_id, answer_id, qid, kind, mime, "
               "filename, caption, byte_size, sha256, svg_text, sanitised, "
               "sanitise_note, uploaded_by) VALUES (:i, :a, :q, 'svg', "
               "'image/svg+xml', :f, :c, :z, :h, :s, 'Y', :n, :u)")
        params = {**common, "z": len(clean), "s": clean,
                  "h": hashlib.sha256(clean.encode()).hexdigest(), "n": note[:600]}

    elif a.kind == "image":
        try:
            raw = base64.b64decode((a.dataBase64 or "").split(",")[-1], validate=True)
        except Exception:  # noqa: BLE001
            raise HTTPException(400, "dataBase64 is not valid base64")
        if not raw:
            raise HTTPException(400, "empty image")
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(400, f"image over {MAX_IMAGE_BYTES // 1_000_000}MB")
        mime = sniff(raw)
        if not mime:
            raise HTTPException(400, "not a PNG, JPEG, GIF or WebP — the declared "
                                     "type is not trusted, the bytes are read")
        sql = ("INSERT INTO hub_attachment (att_id, answer_id, qid, kind, mime, "
               "filename, caption, byte_size, sha256, content, sanitised, "
               "uploaded_by) VALUES (:i, :a, :q, 'image', :m, :f, :c, :z, :h, "
               ":b, 'Y', :u)")
        params = {**common, "m": mime, "z": len(raw), "b": raw,
                  "h": hashlib.sha256(raw).hexdigest()}
    else:
        raise HTTPException(400, "kind must be image or svg")

    if not _write([(sql, params)]):
        raise HTTPException(503, "database unavailable")
    return {"id": att_id, "ok": True}


_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,60}$")


@router.get("/attachment/{att_id}")
def get_attachment(att_id: str):
    if not _ID.match(att_id):
        raise HTTPException(400, "bad id")
    rows = _safe("SELECT kind, mime, content, svg_text, sanitised, filename "
                 "FROM hub_attachment WHERE att_id = :i", {"i": att_id})
    if not rows:
        raise HTTPException(404, "no such attachment")
    r = rows[0]
    # A row that did not go through the sanitiser is not served. One
    # inserted around the API is exactly the row not to trust.
    if (r.get("sanitised") or "N") != "Y":
        raise HTTPException(409, "attachment was not sanitised and will not be served")

    # nosniff everywhere, and a CSP on the SVG so that even a defect in
    # the sanitiser cannot reach the network or run.
    headers = {"X-Content-Type-Options": "nosniff",
               "Cache-Control": "private, max-age=300",
               "Content-Security-Policy":
                   "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
               "Content-Disposition":
                   f'inline; filename="{(r.get("filename") or att_id)[:80]}"'}
    if r["kind"] == "svg":
        return Response(_clob(r.get("svg_text")) or "", media_type="image/svg+xml",
                        headers=headers)
    blob = r.get("content")
    data = blob.read() if hasattr(blob, "read") else (blob or b"")
    return Response(bytes(data), media_type=r.get("mime") or "application/octet-stream",
                    headers=headers)


@router.delete("/attachment/{att_id}")
def del_attachment(att_id: str):
    if not _ID.match(att_id):
        raise HTTPException(400, "bad id")
    if not _write([("DELETE FROM hub_attachment WHERE att_id = :i", {"i": att_id})]):
        raise HTTPException(503, "database unavailable")
    return {"ok": True}
