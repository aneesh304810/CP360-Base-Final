"""The PB Notifications review router, driven rather than read.

No Oracle here: query and execute are fakes that record what the router
asked for, which is enough to test the part that can be wrong, the order
and shape of the statements each operation emits, and how the state is
rebuilt from rows.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi import HTTPException                      # noqa: E402
import app.routers_pbnotify_review as R                # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:220]}"))
    if not cond:
        BAD += 1


SENT, ROWS = [], {}


def fake_execute(statements):
    SENT.extend(statements)


def fake_query(sql, params=None):
    for frag, rows in ROWS.items():
        if frag in " ".join(sql.split()):
            for row in rows:
                bad = [k for k in row if k != k.lower()]
                if bad:
                    raise AssertionError(f"fixture key(s) {bad} not lowercase; db.query lowercases")
            return [dict(r) for r in rows]
    return []


R.execute = fake_execute
R.query = fake_query


class Req:
    def __init__(self, headers=None, host="10.20.30.40"):
        self.headers = headers or {}

        class C:
            pass
        self.client = C()
        self.client.host = host


def run(**kw):
    SENT.clear()
    out = R.apply_op(R.Op(**kw), Req())
    return [" ".join(s.split()) for s, _ in SENT], [p for _, p in SENT], out


def fails(code, **kw):
    try:
        R.apply_op(R.Op(**kw), Req())
    except HTTPException as e:
        return e.status_code == code
    return False


# ---- identity: the declared name is recorded as self-declared --------
sql, par, _ = run(op="note.add", itemKey="gap:G7", section="gap", kind="question", body="Which Loan Statement ids?", actor="Jigar T")
ok(len(sql) == 1 and sql[0].startswith("INSERT INTO pbn_review_note") and par[0]["u"] == "Jigar T" and par[0]["o"] == "none" and par[0]["d"] == "question" and par[0]["p"] is None,
   "a question is one INSERT with the declared name and id_source none", (sql, par))
ok(fails(400, op="note.add", itemKey="gap:G7", kind="question", body="x"), "no name with sign-in off is a 400, not a row by nobody")
ok(fails(400, op="note.add", itemKey="gap:G7", kind="question", body="   ", actor="x"), "an empty body is a 400")
ok(fails(422, op="note.add", itemKey="gap:G7", kind="rant", body="x", actor="x"), "an unknown kind is a 422")
ok(fails(400, op="note.add", itemKey="gap:G7", kind="answer", body="x", actor="x"), "an answer without the question it answers is a 400")
ok(fails(400, op="note.add", kind="comment", body="x", actor="x"), "a note needs an item key")
ok(fails(400, op="bogus", itemKey="gap:G7", actor="x"), "an unknown op is a 400")

# ---- an answer moves the open question to answered -------------------
sql, par, _ = run(op="note.add", itemKey="gap:G7", kind="answer", body="SUNGARD1 only", parentId="n1", actor="Olimpio D")
ok(len(sql) == 2 and "parent_id" in sql[0] and par[0]["p"] == "n1" and sql[1].startswith("UPDATE pbn_review_note SET status = 'answered'") and "AND status = 'open'" in sql[1] and par[1]["p"] == "n1",
   "an answer inserts the reply and moves the parent from open to answered, and only from open", sql)

# ---- status and edits -------------------------------------------------
sql, par, _ = run(op="note.status", noteId="n1", status="closed", actor="Jay S")
ok(len(sql) == 1 and "SET status = :s" in sql[0] and par[0]["s"] == "closed" and par[0]["i"] == "n1", "a status change is one UPDATE on that note", sql)
ok(fails(422, op="note.status", noteId="n1", status="done", actor="x"), "an unknown status is a 422")
ok(fails(400, op="note.status", status="closed", actor="x"), "a status change needs the note id")
sql, par, _ = run(op="note.edit", noteId="n1", body="reworded", actor="Jay S")
ok(len(sql) == 1 and "SET body = :b, edited_by = :u" in sql[0] and par[0]["b"] == "reworded", "editing a note stamps who and keeps the row", sql)

sql, par, _ = run(op="edit", itemKey="req:R6", section="req", body="Send at 08:30 ET", seen="Send after the day's posting", actor="John G")
ok(len(sql) == 1 and sql[0].startswith("INSERT INTO pbn_review_edit") and par[0]["b"] == "Send at 08:30 ET" and par[0]["n"].startswith("Send after") and par[0]["k"] == "req:R6",
   "an edit is a new row with the text as it read, never an UPDATE of a shipped item", sql)
ok(fails(400, op="edit", itemKey="req:R6", body="", actor="x"), "an empty edit is a 400")
sql, par, _ = run(op="edit.revert", itemKey="req:R6", seen="Send at 08:30 ET", actor="John G")
ok(len(sql) == 1 and "NULL, :n" in sql[0] and "b" not in par[0], "a revert is a row with a NULL body, so the history keeps the edit", sql)
ok(all(len(str(p.get("b") or "")) <= R.MAX_BODY for p in par), "bodies are capped")
long = "x" * 9000
sql, par, _ = run(op="note.add", itemKey="general", kind="comment", body=long, actor="Alex")
ok(len(par[0]["b"]) == R.MAX_BODY, "a long body is cut to the column, not an ORA-12899", len(par[0]["b"]))

# ---- the state: latest edit wins, a revert restores ------------------
ROWS.clear()
ROWS["FROM pbn_review_edit"] = [
    {"edit_id": "e1", "item_key": "req:R6", "section": "req", "body": "first", "seen": "shipped", "author": "A", "id_source": "none", "created_at": "2026-10-25 09:00"},
    {"edit_id": "e2", "item_key": "req:R6", "section": "req", "body": "second", "seen": "first", "author": "B", "id_source": "proxy", "created_at": "2026-10-25 09:10"},
    {"edit_id": "e3", "item_key": "gap:G7", "section": "gap", "body": "g", "seen": None, "author": "A", "id_source": "none", "created_at": "2026-10-25 09:20"},
    {"edit_id": "e4", "item_key": "gap:G7", "section": "gap", "body": None, "seen": "g", "author": "A", "id_source": "none", "created_at": "2026-10-25 09:30"},
]
ROWS["FROM pbn_review_note"] = [
    {"note_id": "n1", "item_key": "gap:G7", "section": "gap", "kind": "question", "body": "q", "author": "A", "id_source": "none", "parent_id": None, "status": "answered", "status_by": "B", "status_at": None, "edited_by": None, "edited_at": None, "created_at": "2026-10-25 09:00"},
    {"note_id": "n2", "item_key": "gap:G7", "section": "gap", "kind": "answer", "body": "a", "author": "B", "id_source": "proxy", "parent_id": "n1", "status": "open", "status_by": None, "status_at": None, "edited_by": None, "edited_at": None, "created_at": "2026-10-25 09:05"},
]
st = R.get_review()["review"]
ok(st["edits"]["req:R6"]["body"] == "second" and st["edits"]["req:R6"]["author"] == "B", "the latest edit per item is the one shown", st["edits"])
ok("gap:G7" not in st["edits"] and len(st["editLog"]) == 4, "a revert drops the item from the shown edits and stays in the log", st["edits"])
ok(len(st["notes"]) == 2 and st["notes"][1]["parentId"] == "n1" and st["notes"][0]["status"] == "answered", "notes come back with their parent and status", st["notes"])
ok(all(k == k.lower() or k in ("idSource", "itemKey", "parentId", "statusBy", "statusAt", "editedBy", "editedAt", "editLog") for k in list(st) + list(st["notes"][0])), "camelCase on the wire, as the client reads it")

# ---- mounted ----------------------------------------------------------
main = open(os.path.join(os.path.dirname(__file__), "..", "app", "main.py")).read()
ok('"routers_pbnotify_review"' in main, "the router is in main.py's mount list")
sqlf = open(os.path.join(os.path.dirname(__file__), "..", "..", "sql", "84_pbnotify_review.sql")).read()
ok("pbn_review_edit" in sqlf and "pbn_review_note" in sqlf and "ck_pbn_review_kind" in sqlf and "-955" in sqlf, "the two tables with their checks, idempotent")

print(("\n%d assertion(s) failed" % BAD) if BAD else "\npbnotify review assertions pass")
if BAD:
    sys.exit(1)
