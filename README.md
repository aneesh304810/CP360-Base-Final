# CP360 — consolidated enterprise base

One codebase, reconstructed from 105 repositories written over ten months.

Base is **`Cp360final`** — the largest complete application in the account and
a strict superset of every rival snapshot. Forty-two feature increments are
layered on top in the order they were originally written, so later work
supersedes earlier work exactly as it did on the original machine.

| | |
|---|---|
| Migrations | `01`–`48` (no gaps; `05` and `47` deliberately absent) |
| API routers | 18, all mounted |
| UI screens | 42 |
| Ingestion modules | 51 (16 source connectors) |
| Source repositories | 43 of 105 |

## Layout

```
api/app/      FastAPI — routers mounted in a guarded loop
ui/src/       React + Vite
ingestion/    connectors and loaders
sql/          Oracle migrations, apply in numeric order
local/        setup and run scripts (PowerShell + bash)
deploy/       nginx + OpenShift manifests
tools/        design-doc build tooling
docs/         architecture, design docs, mockups, patch notes
```

## Modules

Data360 · Api360 · Api360 Console · Interface360 · Datapoint360 ·
Interdependency · Guardrails · PII Explorer · Projects · Global Search ·
Lineage · Legacy Lineage · Legacy Dictionary · Impact Analysis · AutoMapper ·
Variance360 · Recon360 · Admin Datasources · Environment360 · Env Infra /
Probe / SSL / Network / Workload · System Design · Hub Design

## How this was assembled

Applied in `pushed_at` order rather than migration order, because each patch
was written against the accumulated state of the one before it. Sorting by
migration number instead would let an older file overwrite a newer one —
`Lineage360` (14 Jul) would clobber `Dictvlv910` (17 Jul) despite carrying
the lower number.

Directory conventions were normalised on the way in: the patch bundles ship
`api-app/`, `ui-src/` and `app-shell/`, which map to `api/app/` and `ui/src/`.
Files duplicated at a bundle's root **and** under its real path were dropped
in favour of the path-qualified copy.

See `MIGRATIONS.md` for the per-migration source map and the two schema
defects that were resolved.

## Known open items

1. **No tests and no CI.** Every one of the 105 source repositories was a
   single upload commit; there is not one test file in any of them. This is
   the first thing to fix, and it matters more than any missing migration.
2. **Migration `30` is inferred.** No `30_*.sql` existed anywhere. The slot is
   filled by renumbering the duplicate `27` from `Lineage360`. Check this
   against your local machine before treating it as settled.
3. **Six unapplied patch fragments** are quarantined in
   `docs/unapplied-patches/` — see the README there.
4. **Presentation collateral was excluded.** `.pptx` decks in the source
   repositories were not carried over; `.docx`, `.xlsx` and diagrams landed
   under `docs/assets/`.

## Not included

`Final-Sei-Account` (Airflow + dbt SEI accounting demo), `Cpguardrails`
(Jenkins/OPA CI policy framework) and `Pocsize` (sizing proof-of-concept) are
separate products, not CP360 modules. They were deliberately left out.
