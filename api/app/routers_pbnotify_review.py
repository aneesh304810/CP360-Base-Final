"""PB Notifications — the review layer on the design page.

    GET  /pbnotify/review          every edit and note, as one state
    GET  /pbnotify/review/whoami   what the server can tell about the caller
    POST /pbnotify/review/op       one named operation against one row

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
