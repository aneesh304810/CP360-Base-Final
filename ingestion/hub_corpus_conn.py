"""Load the review corpus into Oracle, idempotently and non-destructively.

THE ONE RULE THAT MATTERS. Once the corpus lives in a table, a re-run of
this loader can overwrite what people have written. So every UPDATE here
is conditional: a row is refreshed ONLY WHILE IT IS PRISTINE.

  a question  stops being refreshed once EDITED_AT is set, or a human
              status (blocked / superseded) has been applied.
  an answer   stops being refreshed once it has been edited (UPDATED_AT),
              accepted (ACCEPTED = 'Y'), or is no longer marked a draft.

That is in the MERGE's UPDATE ... WHERE, not in a convention, so it holds
for a careless re-run as well as a careful one. Inserts are unconditional
-- a question that is not there yet is simply added, which is what makes
this safe to run after every deploy.

WHY NOT loader._merge. That helper can protect whole columns, which is a
different thing: protecting BODY would mean a corrected question never
reaches the database at all, and not protecting it would mean a re-run
clobbers somebody's edit. The condition has to be on the ROW's state.

Run: python -m ingestion.hub_corpus_conn [--dry-run] [--file data/hub_corpus.json]
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import sys

log = logging.getLogger("cp.hub_corpus")

DEFAULT_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "hub_corpus.json")

# A row is pristine while nobody has touched it. Spelled out once, used
# in the MERGE and asserted by the test.
QUESTION_PRISTINE = "t.edited_at IS NULL AND t.status IS NULL"
ANSWER_PRISTINE = ("t.updated_at IS NULL AND NVL(t.accepted, 'N') = 'N' "
                   "AND NVL(t.is_draft, 'N') = 'Y'")


def _merge(table, pk, cols, where=None):
    """MERGE that refreshes a row only while `where` holds of it."""
    sel = ", ".join(f":{c} AS {c}" for c in cols)
    on = " AND ".join(f"t.{k} = s.{k}" for k in pk)
    upd = ", ".join(f"t.{c} = s.{c}" for c in cols if c not in pk)
    ins_c = ", ".join(cols)
    ins_v = ", ".join(f"s.{c}" for c in cols)
    clause = f"UPDATE SET {upd}" + (f" WHERE {where}" if where else "")
    return (f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
            f"ON ({on}) "
            f"WHEN MATCHED THEN {clause} "
            f"WHEN NOT MATCHED THEN INSERT ({ins_c}) VALUES ({ins_v})")


OWNER_SQL = _merge("hub_owner", ("owner_code",),
                   ("owner_code", "name", "focus", "declared_total"))
TOPIC_SQL = _merge("hub_topic", ("topic_no",),
                   ("topic_no", "title", "comps", "sort_order"))
QUESTION_SQL = _merge("hub_question", ("qid",),
                      ("qid", "source", "seeded", "topic", "owner_code",
                       "body", "comps", "note"),
                      where=QUESTION_PRISTINE)
ANSWER_SQL = _merge("hub_answer", ("answer_id",),
                    ("answer_id", "qid", "body", "author", "is_draft",
                     "conf", "gap", "quote", "fig", "ev"),
                    where=ANSWER_PRISTINE)

PLAN = [("owners", OWNER_SQL), ("topics", TOPIC_SQL),
        ("questions", QUESTION_SQL), ("answers", ANSWER_SQL)]


# What each MERGE inserts IS what the table must have, so the preflight
# below is derived from the statements rather than typed out beside them
# and left to drift.
def _required_columns():
    req = {}
    for _key, sql in PLAN:
        one = " ".join(sql.split())
        table = one.split("MERGE INTO ", 1)[1].split(" ", 1)[0].upper()
        cols = one.split("INSERT (", 1)[1].split(")", 1)[0]
        req[table] = {c.strip().upper() for c in cols.split(",")}
    return req


# Needed by the API rather than by this loader, but a schema that is half
# applied is worth reporting in one go.
EXTRA_TABLES = ("HUB_ATTACHMENT", "HUB_EVENT")

FIX = {
    "HUB_QUESTION": "sql/70_hub_discussion.sql",
    "HUB_ANSWER": "sql/70_hub_discussion.sql",
    "HUB_ATTACHMENT": "sql/70_hub_discussion.sql",
    "HUB_EVENT": "sql/70_hub_discussion.sql",
    "HUB_TOPIC": "sql/71_hub_discussion_corpus.sql",
    "HUB_OWNER": "sql/71_hub_discussion_corpus.sql",
}
# Columns 71_ adds to tables 70_ created. A table that exists without
# them means 71_ was run first, swallowed ORA-00942 and added nothing.
FROM_71 = {"SEEDED", "NOTE", "CONF", "GAP", "QUOTE", "FIG", "EV", "IS_DRAFT"}


def preflight(conn):
    """What is missing, in plain words. Empty list means ready.

    ORA-00942 from a MERGE names no table and arrives three steps from
    the cause. This runs first and says which object is absent and which
    script creates it.
    """
    want = _required_columns()
    for t in EXTRA_TABLES:
        want.setdefault(t, set())

    cur = conn.cursor()
    try:
        cur.execute("SELECT table_name FROM user_tables WHERE table_name IN "
                    "('HUB_QUESTION','HUB_ANSWER','HUB_TOPIC','HUB_OWNER',"
                    "'HUB_ATTACHMENT','HUB_EVENT')")
        present = {r[0].upper() for r in cur.fetchall()}
        cols = {}
        if present:
            binds = {f"t{i}": t for i, t in enumerate(sorted(present))}
            inlist = ", ".join(f":{k}" for k in binds)
            cur.execute("SELECT table_name, column_name FROM user_tab_columns "
                        f"WHERE table_name IN ({inlist})", binds)
            for tbl, col in cur.fetchall():
                cols.setdefault(tbl.upper(), set()).add(col.upper())
    finally:
        cur.close()

    problems = []
    for table in sorted(want):
        if table not in present:
            problems.append(f"{table} does not exist — run {FIX.get(table, '?')}")
            continue
        missing = want[table] - cols.get(table, set())
        if missing:
            which = ("sql/71_hub_discussion_corpus.sql"
                     if missing & FROM_71 else FIX.get(table, "?"))
            problems.append(
                f"{table} is missing {', '.join(sorted(missing))} — run {which}"
                + (" (it was probably run BEFORE 70_, which silently added "
                   "nothing; re-running it now is safe)" if missing & FROM_71 else ""))
    return problems


class NotReady(RuntimeError):
    """The schema is not in place. The message names the script to run."""


def read_corpus(path=DEFAULT_FILE):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load(conn, corpus, check=True):
    """Apply the corpus. Returns {section: rows attempted}."""
    if check:
        problems = preflight(conn)
        if problems:
            raise NotReady("the Hub Discussion schema is not ready:\n  - "
                           + "\n  - ".join(problems))
    counts = {}
    cur = conn.cursor()
    try:
        for key, sql in PLAN:
            rows = corpus.get(key) or []
            for r in rows:
                cur.execute(sql, r)
            counts[key] = len(rows)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    return counts


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--dry-run", action="store_true",
                    help="parse and report, touch no database")
    ap.add_argument("--check", action="store_true",
                    help="report what the schema is missing and change nothing")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    corpus = read_corpus(a.file)
    summary = ", ".join(f"{k} {len(corpus.get(k) or [])}" for k, _ in PLAN)
    if a.dry_run:
        log.info("dry run — %s", summary)
        return 0

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from api.app.db import get_pool  # noqa: PLC0415  (optional dependency)
    with get_pool().acquire() as conn:
        if a.check:
            problems = preflight(conn)
            for pr in problems:
                log.info("  MISSING  %s", pr)
            log.info("schema is ready" if not problems
                     else f"{len(problems)} thing(s) to fix")
            return 1 if problems else 0
        try:
            counts = load(conn, corpus)
        except NotReady as e:
            log.error("%s", e)
            return 2
    log.info("loaded — %s", ", ".join(f"{k} {v}" for k, v in counts.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
