"""PB Notifications — the review layer on the design page.

    GET  /pbnotify/review                 every edit and note, as one state
    GET  /pbnotify/review/whoami          what the server can tell about the caller
    POST /pbnotify/review/op              one named operation against one row
    GET  /pbnotify/review/design          the current design document, if one was ingested
    GET  /pbnotify/review/design/history  every version, without the bodies
    POST /pbnotify/review/design          ingest a document as the next version, or restore the shipped design

THE DESIGN DOCUMENT. The page ships its design in code and can write it
out as Markdown; a reviewer edits that file and ingests it here. The
browser parses it (ui/src/pbnotifyDoc.js) and sends both the Markdown as
received and the design it parsed to; this stores them as the next
version and never edits a row. The highest version is current.

THE ITEMS ARE NOT IN THE DATABASE. Requirements, gaps, tests, steps and
the rest ship with the UI as the design. This stores what reviewers do
to them: a proposed edit of an item's text, a question or comment on
it, an answer, a status. An item nobody has touched has no row.

ONE OPERATION PER WRITE, as in routers_hub_discussion: a whole-state PUT
lets the second reviewer silently overwrite the first. Every operation
here is one row, the state that results is returned, and the edit
history is kept because a reviewer's words are evidence.

IDENTITY comes from hub_identity: the signed-in session or the proxy
header when there is one, otherwise the name the reviewer declared, and
the row records which it was. Nothing about identity is trusted from the
browser beyond that declared name.
"""
from __future__ import annotations

import json
import logging
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .db import query, execute
from .hub_identity import whoami

log = logging.getLogger("cp.api.pbnotify_review")
router = APIRouter(prefix="/pbnotify/review", tags=["pbnotify-review"])

KINDS = ("question", "comment", "answer")
STATUSES = ("open", "answered", "closed")
MAX_BODY = 4000
MAX_KEY = 80


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("pbnotify_review query failed: %s", str(e)[:160])
        return []


def _write(statements):
    try:
        execute(statements)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("pbnotify_review write failed: %s", str(e)[:200])
        return False


def _ts(v):
    return v.isoformat(sep=" ", timespec="minutes") if hasattr(v, "isoformat") else (v or None)


def _nid(prefix):
    return f"{prefix}{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"


def _key(v):
    s = str(v or "").strip()
    if not s:
        raise HTTPException(400, "itemKey required")
    return s[:MAX_KEY]


def _body(v, required=True):
    s = str(v or "").strip()
    if not s:
        if required:
            raise HTTPException(400, "body is empty")
        return None
    return s[:MAX_BODY]


def _actor(request, declared):
    """Who did it, and how we know. The server's answer wins over the form."""
    w = whoami(request)
    if w.get("verified") and w.get("lanId"):
        return w["lanId"][:120], w["source"]
    s = str(declared or "").strip()
    if not s:
        raise HTTPException(400, "name required: sign-in is off, so say who you are")
    return s[:120], "none"


# --------------------------------------------------------------- read
def _state():
    edits, log_ = {}, []
    for r in _safe("SELECT edit_id, item_key, section, body, seen, author, id_source, "
                   "created_at FROM pbn_review_edit ORDER BY created_at, edit_id"):
        rec = {"id": r["edit_id"], "itemKey": r["item_key"], "section": r.get("section"),
               "body": r.get("body"), "seen": r.get("seen"), "author": r.get("author"),
               "idSource": r.get("id_source"), "at": _ts(r.get("created_at"))}
        log_.append(rec)
        if rec["body"]:
            edits[rec["itemKey"]] = rec
        else:
            edits.pop(rec["itemKey"], None)        # a revert restores the shipped text
    notes = []
    for r in _safe("SELECT note_id, item_key, section, kind, body, author, id_source, "
                   "parent_id, status, status_by, status_at, edited_by, edited_at, "
                   "created_at FROM pbn_review_note ORDER BY created_at, note_id"):
        notes.append({"id": r["note_id"], "itemKey": r["item_key"], "section": r.get("section"),
                      "kind": r.get("kind"), "body": r.get("body") or "", "author": r.get("author"),
                      "idSource": r.get("id_source"), "parentId": r.get("parent_id"),
                      "status": r.get("status") or "open", "statusBy": r.get("status_by"),
                      "statusAt": _ts(r.get("status_at")), "editedBy": r.get("edited_by"),
                      "editedAt": _ts(r.get("edited_at")), "at": _ts(r.get("created_at"))})
    return {"edits": edits, "editLog": log_, "notes": notes}


@router.get("/whoami")
def who(request: Request):
    return whoami(request)


@router.get("")
def get_review():
    return {"review": _state(), "persisted": True}


# -------------------------------------------------------------- write
class Op(BaseModel):
    op: str
    itemKey: str | None = None
    section: str | None = None
    body: str | None = None
    seen: str | None = None
    actor: str | None = None
    kind: str | None = None
    parentId: str | None = None
    noteId: str | None = None
    status: str | None = None


@router.post("/op")
def apply_op(o: Op, request: Request):
    actor, source = _actor(request, o.actor)
    section = (str(o.section or "").strip() or None)
    section = section[:30] if section else None
    st = []

    if o.op == "edit":
        st.append(("INSERT INTO pbn_review_edit (edit_id, item_key, section, body, seen, "
                   "author, id_source) VALUES (:i, :k, :s, :b, :n, :u, :o)",
                   {"i": _nid("e"), "k": _key(o.itemKey), "s": section, "b": _body(o.body),
                    "n": _body(o.seen, required=False), "u": actor, "o": source}))

    elif o.op == "edit.revert":
        st.append(("INSERT INTO pbn_review_edit (edit_id, item_key, section, body, seen, "
                   "author, id_source) VALUES (:i, :k, :s, NULL, :n, :u, :o)",
                   {"i": _nid("e"), "k": _key(o.itemKey), "s": section,
                    "n": _body(o.seen, required=False), "u": actor, "o": source}))

    elif o.op == "note.add":
        kind = (o.kind or "comment").strip().lower()
        if kind not in KINDS:
            raise HTTPException(422, f"kind must be one of {', '.join(KINDS)}")
        if kind == "answer" and not o.parentId:
            raise HTTPException(400, "an answer needs the question it answers (parentId)")
        nid = _nid("n")
        st.append(("INSERT INTO pbn_review_note (note_id, item_key, section, kind, body, "
                   "author, id_source, parent_id) VALUES (:i, :k, :s, :d, :b, :u, :o, :p)",
                   {"i": nid, "k": _key(o.itemKey), "s": section, "d": kind, "b": _body(o.body),
                    "u": actor, "o": source, "p": (o.parentId or None)}))
        if kind == "answer":
            # An answer moves an open question to answered; the asker may still close it.
            st.append(("UPDATE pbn_review_note SET status = 'answered', status_by = :u, "
                       "status_at = SYSTIMESTAMP WHERE note_id = :p AND status = 'open'",
                       {"u": actor, "p": o.parentId}))

    elif o.op == "note.edit":
        if not o.noteId:
            raise HTTPException(400, "noteId required")
        st.append(("UPDATE pbn_review_note SET body = :b, edited_by = :u, "
                   "edited_at = SYSTIMESTAMP WHERE note_id = :i",
                   {"b": _body(o.body), "u": actor, "i": o.noteId}))

    elif o.op == "note.status":
        if not o.noteId:
            raise HTTPException(400, "noteId required")
        status = (o.status or "").strip().lower()
        if status not in STATUSES:
            raise HTTPException(422, f"status must be one of {', '.join(STATUSES)}")
        st.append(("UPDATE pbn_review_note SET status = :s, status_by = :u, "
                   "status_at = SYSTIMESTAMP WHERE note_id = :i",
                   {"s": status, "u": actor, "i": o.noteId}))

    else:
        raise HTTPException(400, f"unknown op {o.op}")

    if not _write(st):
        raise HTTPException(503, "the review tables are not reachable; nothing was saved")
    return {"review": _state(), "persisted": True}


# ------------------------------------------------------ the design doc
MAX_DOC = 4_000_000


def _doc_row(r, with_bodies):
    js = None
    if with_bodies and r.get("design_json"):
        try:
            js = json.loads(r["design_json"])
        except Exception:  # noqa: BLE001
            js = None
    return {"id": r["doc_id"], "version": int(r["version"] or 0), "author": r.get("author"),
            "idSource": r.get("id_source"), "at": _ts(r.get("created_at")), "note": r.get("note"),
            "fileName": r.get("file_name"), "bytes": r.get("byte_size"),
            "shipped": (r.get("is_shipped") or "N") == "Y" or (with_bodies and js is None and (r.get("is_shipped") or "N") == "Y"),
            "design": js if with_bodies else None,
            "markdown": (r.get("markdown") if with_bodies else None)}


def _current_doc():
    rows = _safe("SELECT doc_id, version, markdown, design_json, file_name, note, is_shipped, "
                 "author, id_source, byte_size, created_at FROM pbn_design_doc "
                 "ORDER BY version DESC FETCH FIRST 1 ROWS ONLY")
    if not rows:
        return None
    d = _doc_row(rows[0], True)
    if d["shipped"]:
        d["design"] = None
    return d


@router.get("/design")
def get_design():
    return {"doc": _current_doc(), "persisted": True}


@router.get("/design/history")
def design_history():
    rows = _safe("SELECT doc_id, version, file_name, note, is_shipped, author, id_source, "
                 "byte_size, created_at FROM pbn_design_doc ORDER BY version DESC")
    return {"docs": [_doc_row(r, False) for r in rows]}


class DocIn(BaseModel):
    markdown: str | None = None
    design: dict | None = None
    fileName: str | None = None
    note: str | None = None
    actor: str | None = None
    reset: bool = False


@router.post("/design")
def post_design(d: DocIn, request: Request):
    actor, source = _actor(request, d.actor)
    if not d.reset:
        if not d.markdown or not d.markdown.strip():
            raise HTTPException(400, "markdown is empty")
        if len(d.markdown) > MAX_DOC:
            raise HTTPException(413, "the document is larger than the limit")
        if not d.design or not isinstance(d.design, dict) or not d.design:
            raise HTTPException(400, "the parsed design is missing: the page parses the file before sending it")
    cur = _safe("SELECT NVL(MAX(version), 0) AS v FROM pbn_design_doc")
    version = int((cur[0].get("v") if cur else 0) or 0) + 1
    js = None if d.reset else json.dumps(d.design, ensure_ascii=False)
    st = [("INSERT INTO pbn_design_doc (doc_id, version, markdown, design_json, file_name, note, "
           "is_shipped, author, id_source, byte_size) VALUES (:i, :v, :m, :j, :f, :n, :s, :u, :o, :b)",
           {"i": _nid("d"), "v": version, "m": None if d.reset else d.markdown, "j": js,
            "f": (d.fileName or "")[:260] or None, "n": (d.note or "")[:1000] or None,
            "s": "Y" if d.reset else "N", "u": actor, "o": source,
            "b": 0 if d.reset else len(d.markdown.encode("utf-8"))})]
    if not _write(st):
        raise HTTPException(503, "the design table is not reachable; nothing was saved")
    return {"doc": _current_doc(), "persisted": True, "version": version}
