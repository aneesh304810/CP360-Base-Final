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
    QUESTION_PRISTINE, ANSWER_PRISTINE, read_corpus, load, DEFAULT_FILE,
    preflight, NotReady, _required_columns)

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
    def fetchall(self): return []
    def close(self): pass


class FakeConn:
    def __init__(self): self.sent, self.commits, self.rollbacks = [], 0, 0
    def cursor(self): return FakeCur(self.sent)
    def commit(self): self.commits += 1
    def rollback(self): self.rollbacks += 1


# ---- ORA-00942 is reported before it happens ------------------------
#
# A MERGE against a table that is not there raises ORA-00942, which names
# no object and arrives a long way from the cause. These cases are the
# four ways the schema is actually found half-applied.
ALL_TABLES = ["HUB_QUESTION", "HUB_ANSWER", "HUB_TOPIC", "HUB_OWNER",
              "HUB_ATTACHMENT", "HUB_EVENT"]


class SchemaConn(FakeConn):
    """A database with exactly the tables and columns it is told to have."""

    def __init__(self, tables=None, drop_cols=()):
        super().__init__()
        self.tables = ALL_TABLES if tables is None else list(tables)
        self.drop = {c.upper() for c in drop_cols}
        self.cols = dict(_required_columns())
        self.cols.setdefault("HUB_ATTACHMENT", set())
        self.cols.setdefault("HUB_EVENT", set())

    def cursor(self):
        outer = self

        class C(FakeCur):
            def __init__(self, sink):
                super().__init__(sink)
                self.rows = []

            def execute(self, sql, params=None):
                one = " ".join(sql.split())
                if "FROM user_tables" in one:
                    self.rows = [(t,) for t in outer.tables]
                elif "FROM user_tab_columns" in one:
                    self.rows = [(t, c) for t in outer.tables
                                 for c in outer.cols.get(t, set())
                                 if c not in outer.drop]
                else:
                    outer.sent.append((sql, params))

            def fetchall(self):
                return self.rows

        return C(self.sent)


# Derived from the CORPUS, not from PLAN. Two earlier versions were
# wrong in opposite directions: the first hardcoded 179 statements and
# broke whenever a draft was added, and the second derived the
# expectation from PLAN itself — so deleting a section from PLAN deleted
# it from the expectation too, and the guard passed while the loader
# silently stopped loading owners.
SECTIONS = {k for k, v in corpus.items() if isinstance(v, list)}
ok({k for k, _ in PLAN} == SECTIONS,
   "PLAN covers every section the export contains — a section in the file "
   "that no statement loads is data that never reaches Oracle",
   f"PLAN {sorted(k for k, _ in PLAN)} vs export {sorted(SECTIONS)}")
EXPECTED = {k: len(corpus[k]) for k in SECTIONS}
TOTAL = sum(EXPECTED.values())

c1 = SchemaConn()
counts = load(c1, corpus)
ok(counts == EXPECTED, "the loader applies every section", counts)
ok(len(c1.sent) == TOTAL and c1.commits == 1,
   f"one statement per row ({TOTAL}) in one committed transaction",
   f"{len(c1.sent)} statements, {c1.commits} commits")

c2 = SchemaConn()
load(c2, corpus)
ok([s for s, _ in c1.sent] == [s for s, _ in c2.sent],
   "and a second run issues exactly the same statements — idempotency here "
   "is the MERGE's job, not a flag the loader keeps", "")
ok(all("MERGE INTO" in s for s, _ in c1.sent),
   "every statement is a MERGE: no DELETE, no TRUNCATE. A loader that "
   "clears the table first would take every answer with it",
   [s[:40] for s, _ in c1.sent if "MERGE INTO" not in s][:2])


class Boom(SchemaConn):
    """Preflight passes; the MERGE then fails partway through."""

    def cursor(self):
        inner = SchemaConn.cursor(self)
        outer = self

        class C:
            def execute(self, sql, params=None):
                if "MERGE INTO" in sql:
                    raise RuntimeError("ORA-00942")
                inner.execute(sql, params)

            def fetchall(self): return inner.fetchall()
            def close(self): pass

        return C()


b = Boom()
try:
    load(b, corpus)
except RuntimeError:
    pass
ok(b.rollbacks == 1 and b.commits == 0,
   "a failure rolls back rather than leaving half a corpus", 
   f"{b.rollbacks} rollbacks, {b.commits} commits")

ok(preflight(SchemaConn()) == [],
   "a complete schema reports no problems", preflight(SchemaConn()))

# 70_ never run.
p70 = preflight(SchemaConn(tables=["HUB_TOPIC", "HUB_OWNER"]))
ok(any("HUB_QUESTION does not exist" in x for x in p70)
   and all("70_hub_discussion.sql" in x for x in p70 if "does not exist" in x),
   "a missing table names the table AND the script that creates it — "
   "ORA-00942 names neither", p70)

# 71_ run before 70_: the tables exist, the ALTERs silently added nothing.
p71 = preflight(SchemaConn(tables=["HUB_QUESTION", "HUB_ANSWER",
                                   "HUB_ATTACHMENT", "HUB_EVENT"],
                           drop_cols=("CONF", "GAP", "QUOTE", "FIG", "EV",
                                      "IS_DRAFT", "SEEDED", "NOTE")))
ok(any("HUB_TOPIC does not exist" in x for x in p71),
   "71_ not having run is reported", p71)
ok(any("HUB_ANSWER is missing" in x and "CONF" in x for x in p71),
   "and so is the subtler case — the table is there but without the "
   "columns 71_ was supposed to add", p71)
ok(any("BEFORE 70_" in x for x in p71),
   "with the actual cause named: 71_ was run first, swallowed ORA-00942 "
   "and added nothing. That is the failure this file was written after",
   p71)
ok(any("re-running it now is safe" in x for x in p71),
   "and the operator is told the fix is safe to apply", p71)

# The loader refuses rather than part-loading.
try:
    load(SchemaConn(tables=[]), corpus)
    ok(False, "load refuses when the schema is not ready", "it did not")
except NotReady as e:
    ok("does not exist" in str(e) and "sql/70" in str(e),
       "load refuses up front, naming the script — not after writing "
       "owners and topics into a half-built schema", str(e)[:90])
nothing = SchemaConn(tables=[])
try:
    load(nothing, corpus)
except NotReady:
    pass
ok(len(nothing.sent) == 0 and nothing.commits == 0,
   "and it writes nothing at all before refusing", len(nothing.sent))

ok(load(SchemaConn(), corpus) and True,
   "while a ready schema loads normally", "")

# ---- it is reachable from the real entry point ----------------------
#
# A loader nobody runs is a loader that does not exist. This drives
# ingestion.run's own dispatcher rather than asserting the step name
# appears in a list.
import ingestion.run as RUN                                   # noqa: E402

ok("hub_corpus" in RUN.STEPS, "the step is registered with ingestion.run",
   RUN.STEPS)
ok(RUN.STEPS[-1] == "search_index",
   "and search_index is still last — it indexes everything, so a step added "
   "after it is a step nothing can find", RUN.STEPS[-1])
ok(RUN.STEPS.index("hub_corpus") < RUN.STEPS.index("search_index"),
   "so hub_corpus runs before it", "")

c3 = SchemaConn()
RUN._run_step("hub_corpus", c3, None, None)
ok(len(c3.sent) == TOTAL and c3.commits == 1,
   f"python -m ingestion.run actually loads the corpus — {TOTAL} MERGEs in "
   "one transaction, reached through the real dispatcher",
   f"{len(c3.sent)} statements, {c3.commits} commits")
ok(all("MERGE INTO" in sql for sql, _ in c3.sent),
   "and every one of them is a MERGE", "")

os.environ["HUB_CORPUS_PATH"] = "/nonexistent/hub_corpus.json"
c4 = SchemaConn()
raised = None
try:
    RUN._run_step("hub_corpus", c4, None, None)
except Exception as e:                                        # noqa: BLE001
    raised = e
# Reported as a failure rather than allowed to abort this file: a test
# that dies on the thing it is testing says "crashed", not what broke.
ok(raised is None and len(c4.sent) == 0 and c4.commits == 0,
   "a missing corpus file SKIPS rather than raising — run.py guards each "
   "step, so this would only be a logged traceback, but a clean skip is "
   "what tells an operator the step is simply not configured",
   f"raised {raised!r}" if raised else len(c4.sent))
os.environ.pop("HUB_CORPUS_PATH")

# The step needs no new environment variable. If someone adds a
# _require_env to it, that is a deployment change and should be a
# deliberate one.
body = open(os.path.join(os.path.dirname(__file__), "..", "..",
                         "ingestion", "run.py"), encoding="utf-8").read()
blk = body.split('if step == "hub_corpus":', 1)[1].split(chr(10) + "    if step ==", 1)[0]
# A half-applied schema skips like any unconfigured step rather than
# raising: one broken step must not abort the other 26.
c5 = SchemaConn(tables=[])
r5 = None
try:
    RUN._run_step("hub_corpus", c5, None, None)
except Exception as e:                                        # noqa: BLE001
    r5 = e
ok(r5 is None and len(c5.sent) == 0,
   "ingestion.run SKIPS a half-applied schema and logs what is missing, "
   "rather than raising ORA-00942 into the orchestrator",
   f"raised {r5!r}" if r5 else len(c5.sent))

ok("_require_env" not in blk,
   "and it requires no environment variable beyond the DSN every step "
   "needs — the corpus is committed, not configured", blk[:120])

print()
print(f"{BAD} assertion(s) failed" if BAD else "hub corpus loader assertions pass")
sys.exit(1 if BAD else 0)
