# Keeping two CP 360 checkouts in sync

You have two trees that have both moved on, and **neither is a superset**:

| | |
|---|---|
| **bbhrepo** | on the BBH network. Has features this one does not. |
| **this repo** | on GitHub, branch `claude/column-lineage-graph`. Has the SEI crosswalk business view, the business catalogue, Event 360 micro-batch markers, the security module and Utilities → Compare. |

The goal is one tree with both sets, and a rule for which side wins next
time. Do it in this order — each step decides the next one.

---

## Step 0 — Which problem is this?

Everything depends on whether the two share git history. Run in each:

```powershell
git -C C:\SEI\bbhcatalog\CP360Foldercompare\CP360-Base-Final log --oneline | Select-Object -Last 1
git -C <path-to-bbhrepo>                                    log --oneline | Select-Object -Last 1
```

**Same root commit → you have a merge, not a migration.** Git can do the
work. Go to 1A.

**Different root commits** (one was zipped, extracted and `git init`ed —
common) → git sees two unrelated projects and will not help you merge.
Go to 1B.

---

## Step 1A — Shared history: merge locally

The two remotes cannot reach each other across the BBH network, but both
trees are on your laptop, and **a local path is a valid git remote**.

```powershell
cd C:\SEI\bbhcatalog\CP360Foldercompare\CP360-Base-Final
git remote add bbh C:\SEI\...\bbhrepo
git fetch bbh
git log --oneline --left-right --boundary HEAD...bbh/main   # who has what
git merge bbh/main
```

Resolve the conflicts, run the checks in step 4, commit. Then push the
merged result back the other way. Nothing below about porting applies —
skip to step 3 for the files that need care, and step 5.

---

## Step 1B — No shared history: get the list before you get the diffs

Do **not** start by comparing files. Most files differ in whitespace,
comments and a dozen small edits, and the one thing you need — which
features exist on each side — is buried in that noise.

```powershell
cd C:\SEI\bbhcatalog\CP360Foldercompare\CP360-Base-Final
python tools\feature_inventory.py --against C:\SEI\...\bbhrepo --names github bbhrepo
```

That reads the six registries the application itself reads — the router
mount list in `main.py`, the `screens` map in `App.jsx`, the sidebar in
`AppShell.jsx`, `STEPS` in `ingestion/run.py`, `sql/*.sql` and the tables
they create, and every environment variable the Python reads — and
prints them as set differences, each labelled with which way to port.

It is one self-contained file with no dependencies, so it runs in the
older checkout too. **Send me that output** and I can do the porting.

It also flags states that are wrong on their own, whatever the other
side has: a router file that `main.py` does not mount, a sidebar entry
with no screen behind it. Fix those regardless.

> `search` is reported as "routed but no sidebar entry" on both sides.
> That one is correct — the search screen is reached from the search bar,
> not the sidebar.

---

## Step 2 — Read the diffs of the files that exist on both sides

Now, and only now, compare contents. **Utilities → Compare** in CP 360
does exactly this: point it at both folders, filter to *Differences*, and
work through them. In Chrome or Edge it writes your merges straight back
to disk.

Work in this order, because it is the order in which a mistake is
cheapest to undo:

1. `sql/` — additive, and running a migration twice is safe by design.
2. `ingestion/*_conn.py` — one connector per feature, little coupling.
3. `api/app/routers_*.py` — one router per feature.
4. `ui/src/*.jsx` — leaf screens first, shells last.
5. The shells and registries — see step 3.

---

## Step 3 — The files that must not be copied whole

These are registries: several features each write one line into them. A
whole-file copy in either direction silently deletes every feature the
other side registered. **Open both, and hand-apply the missing lines.**

| File | What it registers |
|---|---|
| `api/app/main.py` | the router mount tuple |
| `ingestion/run.py` | `STEPS` |
| `ui/src/App.jsx` | the `screens` route map |
| `ui/src/AppShell.jsx` | the sidebar |
| `ui/src/LineageHome.jsx` | the lineage tabs |
| `ui/src/CrosswalkDashboard.jsx`, `Event360.jsx` | their own tab sets |
| `ui/src/SourceLineage.jsx`, `BizLineage.jsx`, `LineageGraph.jsx`, `LegacyLineage.jsx` | |
| `api/app/routers_legacy_source.py`, `routers_legacy_graph.py`, `routers_event360.py` | |

The inventory output in step 1B tells you exactly which lines are
missing from each — that is what the "mounted in main.py", "UI routes"
and "UI sidebar entries" sections are for.

**One file to leave alone entirely:** `ingestion/legacy_lineage_conn.py`.
The copy running in your environment is ahead of the one in this repo.
Copying this repo's version over it loses work. If it needs a change,
make it in the running copy.

---

## Step 4 — Prove it before you trust it

```powershell
python api\test\test_security.py
python api\test\test_security_api.py
python ingestion\test\test_table_catalog.py
python ingestion\test\test_event360_expectations.py
cd ui ; npm test ; npm run build ; cd ..
```

`npm test` includes `imports.test.jsx`, which catches the exact failure a
hand-merge produces: a component used in JSX that nobody imported.
esbuild will not catch it and neither will the bundler — it throws in the
browser, on mount, for the user. A merge of `App.jsx` or `AppShell.jsx`
that drops an import line is caught here.

Then start the app and check the sidebar has every entry from both sides.

---

## Step 5 — Stop it drifting again

Pick **one** of these and write it down. Drift came from having no
answer to "which one is real".

**One tree, two remotes** (best, if the network allows it). Keep a single
working copy with both repos as remotes; push to both. Every change lands
in both by construction and there is no second copy to reconcile.

**One authoritative repo, one mirror.** Name bbhrepo the source of truth,
develop only there, and treat this one as read-only — a place features
are prototyped and then ported IN ONE DIRECTION. The direction has to be
written down; a rule that lives in someone's head is how you get here.

Either way, run the inventory at the end of a working session:

```powershell
python tools\feature_inventory.py --against <the-other-tree>
```

A clean run is two lines. Anything else is drift, found the day it
happened rather than months later.

---

## What I can and cannot do from here

bbhrepo is on the BBH network and this session cannot see it. I cannot
tell you what is missing — but paste the step 1B output and I can write
the port for each item, in the order above.
