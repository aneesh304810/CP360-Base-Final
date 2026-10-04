"""The corpus loader, run rather than read.

The whole risk of moving the corpus into a table is that re-running the
loader overwrites what people wrote. So the tests here are about the
MERGE's UPDATE ... WHERE, and they execute the statement builder rather
than asserting that a phrase appears in the file.
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ingestion.hub_corpus_conn import (                      # noqa: E402
    QUESTION_SQL, ANSWER_SQL, OWNER_SQL, TOPIC_SQL, PLAN,
    QUESTION_PRISTINE, ANSWER_PRISTINE, read_corpus, load, DEFAULT_FILE)

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:220]}"))
    if not cond:
        BAD += 1


def norm(s):
    return " ".join(s.split())


# ---- the pristine rule is IN the statement --------------------------
q, a = norm(QUESTION_SQL), norm(ANSWER_SQL)
ok("WHEN MATCHED THEN UPDATE SET" in q and "WHERE" in q.split("WHEN NOT MATCHED")[0],
   "a question refresh is conditional — the UPDATE carries a WHERE", q)
ok("t.edited_at IS NULL" in q and "t.status IS NULL" in q,
   "and the condition is that nobody has edited it or set a human status — "
   "a re-run must not undo somebody's edit", q)
ok("t.updated_at IS NULL" in a and "NVL(t.accepted, 'N') = 'N'" in a
   and "NVL(t.is_draft, 'N') = 'Y'" in a,
   "an answer refresh stops once it has been edited, accepted, or is no "
   "longer a draft — all three, because any one of them means a person "
   "has adopted it", a)
ok("WHEN NOT MATCHED THEN INSERT" in q and "WHEN NOT MATCHED THEN INSERT" in a,
   "inserts stay unconditional, which is what makes this safe to run after "
   "every deploy", "")
# Owners and topics are reference data nobody edits in the app, so they
# refresh unconditionally. If that ever changes this should fail.
for name, sql in (("owner", OWNER_SQL), ("topic", TOPIC_SQL)):
    ok("WHERE" not in norm(sql).split("WHEN NOT MATCHED")[0].split("UPDATE SET")[1],
       f"{name} rows refresh unconditionally — they are reference data and "
       f"the app does not edit them", norm(sql))

ok("hub_question" in q and "hub_answer" in a, "they target the right tables", "")
for frag in (":qid", ":body", ":owner_code", ":comps", ":topic"):
    ok(frag in q, f"the question MERGE binds {frag}", q)
for frag in (":conf", ":gap", ":quote", ":fig", ":ev", ":is_draft"):
    ok(frag in a, f"the answer MERGE binds {frag} — a drafted answer loses "
       f"its chrome if any of these is dropped", a)

# ---- the exported corpus matches what the MERGEs bind ---------------
corpus = read_corpus(DEFAULT_FILE)
ok(len(corpus["questions"]) == 108, "the export carries all 108 questions",
   len(corpus["questions"]))
ok(len(corpus["topics"]) == 17 and len(corpus["owners"]) == 5,
   "with their topics and owners — otherwise the screen reads questions "
   "from the database and their grouping from the bundle",
   f'{len(corpus["topics"])}/{len(corpus["owners"])}')
ok(all(q_["body"] and q_["comps"] for q_ in corpus["questions"]),
   "every exported question has a body and at least one component link",
   [q_["qid"] for q_ in corpus["questions"] if not (q_["body"] and q_["comps"])][:5])
ok(sum(o["declared_total"] or 0 for o in corpus["owners"]) == 108,
   "and the owners' declared totals still add to 108",
   sum(o["declared_total"] or 0 for o in corpus["owners"]))
ok(all(a_["conf"] and a_["body"] for a_ in corpus["answers"]),
   "every exported answer carries its evidence class",
   [a_["qid"] for a_ in corpus["answers"] if not a_["conf"]][:5])
docs = [a_ for a_ in corpus["answers"] if a_["conf"] == "document"]
ok(docs and all(a_["quote"] for a_ in docs),
   "and a document answer still carries its quote through the export — the "
   "rule has to survive the hop into Oracle, not just hold in the bundle",
   [a_["qid"] for a_ in docs if not a_["quote"]])

# Every key in an exported row must be a column the MERGE binds, or the
# loader fails at runtime with ORA-01036 on the first row.
for key, sql in PLAN:
    bound = set(norm(sql).split("INSERT (")[1].split(")")[0].replace(" ", "").split(","))
    for row in corpus.get(key) or []:
        extra = set(row.keys()) - bound
        ok(not extra, f"every field exported for {key} is one the MERGE binds",
           f"{key}: {sorted(extra)}")
        break

# ---- it runs, and running it twice is the same as running it once ---
class FakeCur:
    def __init__(self, sink): self.sink = sink
    def execute(self, sql, params=None): self.sink.append((sql, params))
    def close(self): pass


class FakeConn:
    def __init__(self): self.sent, self.commits, self.rollbacks = [], 0, 0
    def cursor(self): return FakeCur(self.sent)
    def commit(self): self.commits += 1
    def rollback(self): self.rollbacks += 1


c1 = FakeConn()
counts = load(c1, corpus)
ok(counts == {"owners": 5, "topics": 17, "questions": 108, "answers": 49},
   "the loader applies every section", counts)
ok(len(c1.sent) == 179 and c1.commits == 1,
   "in one committed transaction", f"{len(c1.sent)} statements, {c1.commits} commits")

c2 = FakeConn()
load(c2, corpus)
ok([s for s, _ in c1.sent] == [s for s, _ in c2.sent],
   "and a second run issues exactly the same statements — idempotency here "
   "is the MERGE's job, not a flag the loader keeps", "")
ok(all("MERGE INTO" in s for s, _ in c1.sent),
   "every statement is a MERGE: no DELETE, no TRUNCATE. A loader that "
   "clears the table first would take every answer with it",
   [s[:40] for s, _ in c1.sent if "MERGE INTO" not in s][:2])


class Boom(FakeConn):
    def cursor(self):
        class C(FakeCur):
            def execute(self, sql, params=None): raise RuntimeError("ORA-00942")
        return C(self.sent)


b = Boom()
try:
    load(b, corpus)
except RuntimeError:
    pass
ok(b.rollbacks == 1 and b.commits == 0,
   "a failure rolls back rather than leaving half a corpus", 
   f"{b.rollbacks} rollbacks, {b.commits} commits")

print()
print(f"{BAD} assertion(s) failed" if BAD else "hub corpus loader assertions pass")
sys.exit(1 if BAD else 0)
