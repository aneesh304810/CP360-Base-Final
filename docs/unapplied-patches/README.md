# Unapplied patch fragments

These files sat loose in the root of `Cp360final`. Each **differs** from the
copy already under `ui/src/` or `ingestion/`, so they are un-merged drops
rather than duplicates — but which side is newer was not recorded anywhere.

They are quarantined here so nothing is lost. Review each against its live
counterpart and either merge it or delete it. Nothing here is on the import
path, so the application runs correctly while they wait.

| Fragment | Live counterpart |
|---|---|
| `Interdependency.jsx` | `ui/src/Interdependency.jsx` |
| `Interface360.jsx` | `ui/src/Interface360.jsx` |
| `guardrails_synth.py` | `ingestion/guardrails_synth.py` |
| `run.py` | `ingestion/run.py` |
| `api.interfaces.patch.js` | patch for `ui/src/api.js` — never applied |
| `interfaces_route.py` | route for `api/app/routers_interface360.py` — never applied |
