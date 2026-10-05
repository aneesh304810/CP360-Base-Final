"""The discussion router, driven rather than read.

There is no Oracle here, so query and execute are replaced with fakes
that record what the router asked for. That is enough to test the part
that can be wrong: the ORDER and SHAPE of the statements each operation
emits. "Editing an accepted answer withdraws the acceptance" is a rule
about two UPDATEs and an INSERT, and this runs them.
"""
import sys, os, base64
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi import HTTPException                      # noqa: E402
import app.routers_hub_discussion as R                 # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:220]}"))
    if not cond:
        BAD += 1


SENT = []
ROWS = {}


def fake_execute(statements):
    SENT.extend(statements)


def fake_query(sql, params=None):
    """Hand back rows the way db.query does, or this proves nothing.

    THIS IS THE BUG THIS FAKE ONCE HID. db.query lowercases every column
    name off the cursor description. This fake used to return whatever
    the fixture wrote, the fixtures were written in Oracle's uppercase,
    and so the whole router was built reading r["OWNER_CODE"] against a
    dict that only ever has "owner_code". Every suite passed and
    GET /hub/discussion was a 500 on the first real call.

    So the fake lowercases, exactly as db.query does, and an uppercase
    fixture key is now an error rather than a convenience — a fixture
    that can lie about the shape of a row is not a fixture.
    """
    for frag, rows in ROWS.items():
        if frag in " ".join(sql.split()):
            for row in rows:
                bad = [k for k in row if k != k.lower()]
                if bad:
                    raise AssertionError(
                        f"fixture key(s) {bad} are not lowercase; db.query "
                        f"lowercases every column name, so a row never "
                        f"looks like this")
            return [dict(r) for r in rows]
    return []


R.execute = fake_execute
R.query = fake_query


class Req:
    """A request with only what hub_identity reads off it."""

    def __init__(self, headers=None, host="10.20.30.40"):
        self.headers = headers or {}

        class C:
            pass
        self.client = C()
        self.client.host = host


def run(**kw):
    SENT.clear()
    R.apply_op(R.Op(**kw), Req())
    return [" ".join(s.split()) for s, _ in SENT], [p for _, p in SENT]


# ---- the bytes decide the type, not the caller ----------------------
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
ok(R.sniff(PNG) == "image/png", "a PNG is recognised by its magic", R.sniff(PNG))
ok(R.sniff(b"\xff\xd8\xff\xe0abc") == "image/jpeg", "a JPEG is", "")
ok(R.sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp", "a WebP is", "")
ok(R.sniff(b"<html><script>alert(1)</script>") is None,
   "HTML claiming to be a PNG is not — a stored file is served back, and a "
   "declared type is not evidence", "")
ok(R.sniff(b"<svg xmlns='http://www.w3.org/2000/svg'/>") is None,
   "and an SVG cannot be smuggled in through the image path, where it would "
   "skip the sanitiser", "")

# ---- accepting clears the siblings, in that order -------------------
sql, par = run(op="answer.accept", qid=62, answerId="a1", actor="Glenn Lasrado")
clear = next((i for i, s in enumerate(sql)
              if s.startswith("UPDATE hub_answer SET accepted = 'N'")), -1)
setq = next((i for i, s in enumerate(sql)
             if "accepted = 'Y'" in s), -1)
ok(clear >= 0 and setq >= 0 and clear < setq,
   "accept clears every accepted answer for the question BEFORE setting the "
   "new one — the other order leaves two, or none", sql)
ok("WHERE qid = :q" in sql[clear],
   "and the clear is scoped to the question, not the table", sql[clear])
ok(any("hub_event" in s and p.get("t") == "resolved" for s, p in zip(sql, par)),
   "the transition is written to the audit trail", sql)
ok(any("hub_question SET status = NULL" in s for s in sql),
   "and a prior blocked/superseded decision is cleared, so an accepted "
   "answer is not hidden behind a stale override", sql)

# ---- editing an accepted answer withdraws the acceptance ------------
ROWS.clear()
ROWS["SELECT qid, accepted FROM hub_answer WHERE answer_id = :i"] = [
    {"qid": 62, "accepted": "Y"}]
sql, par = run(op="answer.edit", answerId="a1", body="revised", actor="K Barnhardt")
upd = next(s for s in sql if s.startswith("UPDATE hub_answer SET body"))
ok("accepted = 'N'" in upd and "accepted_by = NULL" in upd,
   "editing clears the acceptance in the DATABASE too — the rule cannot "
   "live only in the browser, because any client can call this", upd)
ok(any("hub_event" in s and "withdrawn" in (p.get("n") or "")
       for s, p in zip(sql, par)),
   "and the withdrawal is recorded", par)

ROWS["SELECT qid, accepted FROM hub_answer WHERE answer_id = :i"] = [
    {"qid": 62, "accepted": "N"}]
sql, par = run(op="answer.edit", answerId="a2", body="revised", actor="K Barnhardt")
ok(not any("hub_event" in s for s in sql),
   "editing an answer that was never accepted writes no withdrawal event", sql)

# ---- a seeded draft becomes a row only once -------------------------
ROWS.clear()
sql, par = run(op="answer.seed", qid=107, answerId="seed107", body="draft text")
ok(any("INSERT INTO hub_answer" in s and ":k" in s for s in sql),
   "materialising a draft records seed_key, so an edited draft stays "
   "distinguishable from an answer somebody wrote", sql)
ROWS["SELECT answer_id FROM hub_answer WHERE answer_id = :i"] = [{"answer_id": "seed107"}]
SENT.clear()
R.apply_op(R.Op(op="answer.seed", qid=107, answerId="seed107",
                body="draft text"), Req())
ok(len(SENT) == 0,
   "and materialising the same draft twice writes nothing — two clients "
   "opening the same question must not create two rows", len(SENT))
ROWS.clear()

# ---- a question row may not exist: the 108 live in code -------------
sql, _ = run(op="answer.add", qid=62, body="an answer", actor="G Middha")
ok(any("MERGE INTO hub_question" in s for s in sql),
   "answering a seeded question creates its row first — the 108 are not in "
   "the database, so a foreign-key-shaped assumption would fail on question "
   "one", sql)

# ---- user questions number from 1001 --------------------------------
sql, par = run(op="question.add", body="a new question", topic=8, owner="GL")
ok(any(p.get("q") == R.FIRST_USER_QID for p in par if isinstance(p, dict)),
   f"the first user question is {R.FIRST_USER_QID}, clear of the review's "
   "1..108", [p.get("q") for p in par])

# ---- refusals -------------------------------------------------------
def refuses(fn, what=""):
    try:
        fn()
    except HTTPException as e:
        return e.status_code
    return None


ok(refuses(lambda: R.apply_op(R.Op(op="nonsense"), Req()), "") == 400,
   "an unknown op is refused rather than silently doing nothing", "")
ok(refuses(lambda: R.apply_op(R.Op(op="answer.add", qid=1, body="   "), Req())) == 400,
   "an empty answer is refused", "")
ok(refuses(lambda: R.apply_op(R.Op(op="question.status", qid=1,
                                status="resolved"), Req())) == 400,
   "status cannot be set to resolved by hand — resolved is DERIVED from an "
   "accepted answer, and a settable one would let a question read resolved "
   "with nothing answering it", "")

# ---- attachments ----------------------------------------------------
SENT.clear()
R.add_attachment(R.Att(answerId="a1", kind="image",
                       dataBase64=base64.b64encode(PNG).decode(), filename="x.png"))
s, p = SENT[0]
ok(p["m"] == "image/png" and p["z"] == len(PNG) and p["h"],
   "an image is stored with its sniffed type, size and digest", p.get("m"))

ok(refuses(lambda: R.add_attachment(R.Att(answerId="a1", kind="image",
    dataBase64=base64.b64encode(b"<html>hi</html>").decode()))) == 400,
   "HTML through the image path is refused", "")
ok(refuses(lambda: R.add_attachment(R.Att(answerId="a1", kind="image",
    dataBase64="not base64 !!"))) == 400, "and so is malformed base64", "")
ok(refuses(lambda: R.add_attachment(R.Att(kind="image",
    dataBase64=base64.b64encode(PNG).decode()))) == 400,
   "an attachment with nothing to attach to is refused", "")

SENT.clear()
R.add_attachment(R.Att(answerId="a1", kind="svg", svgText=(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4">'
    '<script>alert(1)</script><rect width="4" height="4" onclick="alert(1)"/></svg>')))
s, p = SENT[0]
ok("alert" not in p["s"] and "onclick" not in p["s"],
   "an uploaded SVG is stored SANITISED, not as received", p["s"])
ok("'Y'" in s and p["n"] and p["n"] != "clean",
   "and what was removed is recorded against the row", p.get("n"))
ok(refuses(lambda: R.add_attachment(R.Att(answerId="a1", kind="svg",
    svgText="<html><body>no</body></html>"))) == 400,
   "an SVG that is not an SVG is refused at upload, not at render", "")

# ---- the reader refuses what the writer did not sanitise ------------
ROWS["SELECT kind, mime, content, svg_text, sanitised, filename"] = [
    {"kind": "svg", "mime": "image/svg+xml", "svg_text": "<svg onload='alert(1)'/>",
     "sanitised": "N", "filename": "x.svg", "content": None}]
ok(refuses(lambda: R.get_attachment("t1")) == 409,
   "a row that did not go through the sanitiser is NOT served — a row "
   "inserted around the API is exactly the one not to trust", "")
ROWS["SELECT kind, mime, content, svg_text, sanitised, filename"] = [
    {"kind": "svg", "mime": "image/svg+xml", "svg_text": "<svg/>",
     "sanitised": "Y", "filename": "x.svg", "content": None}]
resp = R.get_attachment("t1")
ok(resp.headers.get("x-content-type-options") == "nosniff",
   "a served attachment carries nosniff", dict(resp.headers))
ok("default-src 'none'" in (resp.headers.get("content-security-policy") or ""),
   "and a CSP, so a defect in the sanitiser still cannot reach the network",
   resp.headers.get("content-security-policy"))
ok(refuses(lambda: R.get_attachment("../../etc/passwd")) == 400,
   "and an id that is not an id is refused before it reaches a query", "")

# ---- who signed, and how much that is worth -------------------------
#
# A browser cannot read a machine name or a Windows account. So none of
# this comes from the client, and the tests drive the server side.
import app.hub_identity as ID                                 # noqa: E402


ok(ID.client_ip(Req({"x-forwarded-for": "10.1.2.3, 10.0.0.1"})) == "10.1.2.3",
   "the caller's address comes from the FIRST hop in x-forwarded-for, not "
   "the proxy that relayed it", ID.client_ip(Req({"x-forwarded-for": "10.1.2.3, 10.0.0.1"})))
ok(ID.client_ip(Req({}, host="10.9.9.9")) == "10.9.9.9",
   "and falls back to the socket when there is no proxy header", "")
ok(ID.client_ip(Req({"x-forwarded-for": "not-an-ip"})) is None,
   "a header that is not an address is dropped rather than stored — it is "
   "attacker-controlled text", "")

os.environ.pop("HUB_USER_HEADER", None)
ok(ID.lan_id(Req({"X-Remote-User": "BBHCORP\\knair"}))[1] == "none",
   "a proxy header is IGNORED unless HUB_USER_HEADER names it — if the API "
   "can be reached directly, anyone can send one, so trusting it by default "
   "would be worse than having no identity at all", ID.lan_id(Req({}))[1])

os.environ["HUB_USER_HEADER"] = "X-Remote-User"
uid, src = ID.lan_id(Req({"X-Remote-User": "BBHCORP\\knair"}))
ok(uid == "knair" and src == "proxy",
   "once named, DOMAIN\\user is reduced to the account", f"{uid}/{src}")
uid2, _ = ID.lan_id(Req({"X-Remote-User": "knair@bbh.com"}))
ok(uid2 == "knair", "and so is user@domain", uid2)
w = ID.whoami(Req({"X-Remote-User": "BBHCORP\\knair",
                   "x-forwarded-for": "10.1.2.3"}))
ok(w["verified"] is True and w["lanId"] == "knair" and w["ip"] == "10.1.2.3",
   "whoami reports the account and the address", w)
os.environ.pop("HUB_USER_HEADER", None)

os.environ.pop("HUB_REVERSE_DNS", None)
ok(ID.machine_name("10.1.2.3") is None,
   "reverse DNS is off unless HUB_REVERSE_DNS is set — a blocking lookup on "
   "the request path is a bad trade for a nice-to-have", "")

# The accept statement records all four, and prefers the server's answer.
ROWS.clear()
SENT.clear()
R.apply_op(R.Op(op="answer.accept", qid=62, answerId="a1",
                actor="Somebody Else", signoff="I accept."),
           Req({"x-forwarded-for": "10.1.2.3"}))
setq = next(p for s_, p in SENT if "accepted = 'Y'" in " ".join(s_.split()))
ok(setq["src"] == "none" and setq["p"] == "10.1.2.3",
   "with no sign-in the row records id_source 'none' and the address — so a "
   "self-declared signature is identifiable as one forever after", setq)
ok(setq["u"] == "Somebody Else",
   "and the self-declared name is used, because nothing better exists",
   setq.get("u"))

os.environ["HUB_USER_HEADER"] = "X-Remote-User"
SENT.clear()
R.apply_op(R.Op(op="answer.accept", qid=62, answerId="a1",
                actor="Somebody Else", signoff="I accept."),
           Req({"X-Remote-User": "knair", "x-forwarded-for": "10.1.2.3"}))
setq = next(p for s_, p in SENT if "accepted = 'Y'" in " ".join(s_.split()))
ok(setq["u"] == "knair" and setq["src"] == "proxy",
   "but when the server knows the account, THAT is who signed — whatever "
   "name the browser sent. A client-supplied identity never wins", setq)
os.environ.pop("HUB_USER_HEADER", None)

SENT.clear()
ok(refuses(lambda: R.apply_op(R.Op(op="answer.accept", qid=1, answerId="a",
                                   actor="  "), Req())) == 400,
   "accepting with no name at all is refused", "")

clear = next(p for s_, p in SENT if "accepted = 'N'" in " ".join(s_.split())) \
    if SENT else None
SENT.clear()
R.apply_op(R.Op(op="answer.accept", qid=62, answerId="a1", actor="A Person"), Req())
clr = next(s_ for s_, _ in SENT if "accepted = 'N'" in " ".join(s_.split()))
for col in ("lan_id = NULL", "host_name = NULL", "client_ip = NULL",
            "id_source = NULL"):
    ok(col in " ".join(clr.split()),
       f"withdrawing an acceptance also clears {col.split()[0]} — a cleared "
       f"signature that keeps its machine name still reads as signed", clr)

# --------------------------------------------------------------------
# THE READ PATH, which nothing here used to touch.
#
# Every test above drives apply_op and asserts on the SQL it emits. Not
# one of them ever called _corpus() or _store(), so the whole GET side
# of the router was unexercised — and that is exactly where it broke:
# GET /hub/discussion raised KeyError 'OWNER_CODE' on the first real
# call, because db.query hands back lowercase keys and the router was
# written against uppercase ones.
#
# Two guards and one exercise, in that order: pin the contract, prove
# the router honours it, then run the thing end to end.
import re, pathlib                                     # noqa: E402

APPDIR = pathlib.Path(__file__).resolve().parents[1] / "app"
DBSRC = (APPDIR.parent / "app" / "db.py").read_text(encoding="utf-8")
ok("c[0].lower()" in DBSRC,
   "db.query still lowercases every column name off the cursor — the fake "
   "above copies this, and if db.py ever stops doing it the fake becomes "
   "a lie again", DBSRC[:0])

RSRC = (APPDIR / "routers_hub_discussion.py").read_text(encoding="utf-8")
upper = re.findall(r'\[\s*"([A-Z][A-Z_0-9]*)"\s*\]|\.get\(\s*"([A-Z][A-Z_0-9]*)"',
                   RSRC)
upper = [a or b for a, b in upper]
ok(not upper,
   "and the router reads no UPPERCASE row key anywhere — the ones that "
   "subscript raise a 500, and the ones that .get() come back None and "
   "render a blank field, which is the worse half",
   ", ".join(sorted(set(upper))[:12]))

# The exercise. Rows shaped the way Oracle returns them, through the
# fake that now enforces that shape.
ROWS.clear()
SENT.clear()
ROWS["FROM hub_owner"] = [
    {"owner_code": "KB", "name": "K B", "focus": "architecture",
     "declared_total": 42},
    {"owner_code": "GL", "name": "G L", "focus": "ingestion",
     "declared_total": 29},
]
ROWS["FROM hub_topic"] = [
    {"topic_no": 1, "title": "SEI Data Structure", "comps": "15,40,37",
     "sort_order": 1},
]
ROWS["note, source FROM hub_question"] = [
    {"qid": 1, "topic": 1, "owner_code": "KB", "body": "What is enriched?",
     "comps": "15,40", "note": None, "source": "review"},
]
c = R._corpus()
ok(c["owners"].get("KB", {}).get("name") == "K B",
   "the corpus reads owners out of the row — the name used to come back "
   "None while the code key raised, so half the failure was silent",
   c["owners"])
ok(c["ownerTotals"].get("KB") == 42, "and their declared totals",
   c["ownerTotals"])
ok(c["topics"] and c["topics"][0]["title"] == "SEI Data Structure"
   and c["topics"][0]["comps"] == ["15", "40", "37"],
   "topics, with their component lists split", c["topics"])
ok(c["questions"] and c["questions"][0]["body"] == "What is enriched?"
   and c["questions"][0]["owner"] == "KB"
   and c["questions"][0]["topic"] == 1,
   "and the questions themselves, owner and topic resolved", c["questions"])
ok(all(v is not None for v in
       [c["questions"][0]["body"], c["topics"][0]["title"],
        c["owners"]["KB"]["focus"]]),
   "with nothing silently None — a .get() against the wrong case returns "
   "None rather than raising, so a blank screen is the shape this bug "
   "takes when it does not 500", "")

# And the endpoint itself, which is what actually returned the 500.
d = R.get_discussion()
ok(set(d) >= {"store", "corpus", "persisted", "seeded"},
   "GET /hub/discussion returns its four parts", sorted(d))
for k in ("owners", "topics", "questions"):
    ok(d["corpus"].get(k), f"and the corpus carries {k} — this call was the "
       f"500", sorted(d["corpus"]))

ROWS.clear()
SENT.clear()

print()
print(f"{BAD} assertion(s) failed" if BAD else "hub discussion router assertions pass")
sys.exit(1 if BAD else 0)
