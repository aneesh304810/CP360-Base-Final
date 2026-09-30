# Prompt for enterprise Claude — CP 360 gap report

Upload both zips, paste the prompt below, and bring the answer back here.
Replace the two bracketed names with the actual zip filenames.

There are two rounds. **Round 1** is the map: what each side has, which
shared files differ. It is small enough to paste into a chat. **Round 2**
asks for the contents of the specific files we decide to port, once we
know which those are. Do not skip to round 2 — asking for everything
produces more than a chat can carry, and most of it would be files that
are already identical.

---

## Round 1 — paste this

````text
I have two zip files, each a checkout of the same internal application
("CP 360", a data catalogue: FastAPI backend in api/, Python ingestion in
ingestion/, React+Vite frontend in ui/, Oracle DDL in sql/).

  A = [GITHUB-ZIP-NAME.zip]      -- the GitHub branch
  B = [BBHREPO-ZIP-NAME.zip]     -- the enterprise repo

They have both moved on independently and NEITHER IS A SUPERSET. I need a
map of the difference so the two can be merged. I am going to paste your
answer into another chat, so it has to be complete but compact.

IMPORTANT -- STRUCTURE AND METADATA ONLY. This is a bank's internal
codebase. Do not reproduce, quote or summarise any account number, client
name, transaction identifier, position, balance, password, connect
string, API key or internal hostname you come across, in this answer or
any later one. File paths, function names, route paths, table names,
column names, environment variable NAMES and line counts are all fine.
Environment variable VALUES are not. If a file you are asked to show
contains a credential, show the file with that value replaced by
`REDACTED` and tell me which line you changed.

STEP 1. Extract both zips.

STEP 2. A is a tree containing `tools/feature_inventory.py` -- a
self-contained script with no dependencies. If you can run Python, run:

    python <A>/tools/feature_inventory.py --against <B> --names github bbhrepo

and give me its output verbatim, in a code block, complete and untruncated.
Then go to STEP 4.

STEP 3. Only if you cannot run code. Produce the same report by reading
these registries in BOTH trees and giving me the set differences, saying
for each item which side it is on:

  - `api/app/` -- every `routers_*.py` file present, and which of those
    names appear as string literals in the mount loop in `api/app/main.py`
  - every route: for each router file, the `prefix=` in its `APIRouter(...)`
    plus each `@router.get/post("...")` path, joined
  - `ui/src/App.jsx` -- the keys of the `screens` object
  - `ui/src/AppShell.jsx` -- the first element of each `[key, label, icon]`
    entry in NAV_GROUPS
  - `ui/src/` -- the list of .jsx/.js filenames
  - `ingestion/run.py` -- the `STEPS` list
  - `ingestion/` -- the list of `*_conn.py` filenames
  - `sql/` -- the list of .sql filenames, and every `CREATE TABLE <name>`
  - every environment variable read anywhere in api/ or ingestion/
    (`os.environ[...]`, `os.environ.get(...)`, `os.getenv(...)`)
  - `api/test/`, `ingestion/test/`, `ui/test/` -- the filenames

  Then, for the files that exist in BOTH trees under api/app, ingestion,
  ui/src, sql and tools: list the ones whose contents differ, with the
  line count on each side. Normalise line endings first, or every file
  will read as different.

STEP 4. For each feature that exists ONLY IN B, add a short block:

    ### <feature name>
    what it does:   one or two sentences, in business terms
    files:          every path that belongs to it, with line counts
    registry lines: the exact lines it needs added to api/app/main.py,
                    ingestion/run.py, ui/src/App.jsx and
                    ui/src/AppShell.jsx -- quote them
    database:       tables it needs, and which sql/*.sql file creates them
    config:         environment variable names it reads
    depends on:     anything it imports from outside its own files
    self-contained? yes / no -- and if no, what else has to move with it

STEP 5. Finally, answer these four:

  1. Do the two trees share git history? Check whether either extracted
     folder has a `.git` directory, and if both do, whether their FIRST
     commit (`git log --oneline | tail -1`) is the same hash.
  2. Which files differ ONLY in whitespace, line endings or comments?
     List them separately -- they are not real differences and I do not
     want them in the merge plan.
  3. Of the shared files that really differ, which look like B is simply
     AHEAD (same structure, more of it) versus genuinely DIVERGED (the
     same thing done two different ways)? This is the distinction that
     decides whether a merge is mechanical.
  4. Is there anything in B that looks like it was deleted from A on
     purpose, rather than never added? Say so rather than assuming it
     should be ported back.

Do not paste the contents of any source file in this answer. I will ask
for specific files in a follow-up.
````

---

## Round 2 — after we have chosen what to port

````text
From zip B, give me the complete, unmodified contents of these files:

  <paths I will list>

One code block per file, with the path as a heading above it. Do not
abbreviate, summarise or elide any part -- I need to apply them exactly.
If a file exceeds what you can output in one message, split it across
messages at a clear line boundary and tell me where you split.

The same rule as before: if any of them contains a password, connect
string, API key or internal hostname, replace that VALUE with `REDACTED`
and tell me the line number. Everything else verbatim.
````

---

## What happens next

Paste round 1 back here. From it I can:

* say which features to port in which direction, and in what order;
* write the exact registry lines for `main.py`, `run.py`, `App.jsx` and
  `AppShell.jsx`, which are the files that must never be copied whole;
* tell you which of the differing shared files need a real merge and
  which are noise;
* name the files to ask for in round 2.

See `docs/SYNC-WITH-BBHREPO.md` for the order to apply it all in, and for
what to do if the two turn out to share git history — in that case most
of this is unnecessary and git can do the merge.
