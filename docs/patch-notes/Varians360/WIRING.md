# Variance 360 — integration guide (cp-catalog-bbh)

## Files in this package
```
sql/31_variance360.sql          recon_runs / recon_dtype_profile /
                                recon_profile / recon_summary  (idempotent)
ingestion/variance_engine.py    profiling engine (composition + stage metrics)
api-app/routers_variance360.py  FastAPI router  (prefix /variance)
ui-src/Variance360.jsx          React screen    (theme-token styled, DEMO fallback)
```

## 1. Database
Run `sql/31_variance360.sql` against SILVER (same account that owns
legacy_lineage). Requires the profiled sources to be Oracle >= 12.2
(VALIDATE_CONVERSION / APPROX_COUNT_DISTINCT).

## 2. API  (api/app/)
Copy `routers_variance360.py` into `api/app/`. In `api/app/main.py`, add the
module to the mount loop:

```python
for _mod in ("routers_projects", "routers_data360", "routers_data360_pipelines",
             "routers_api360", "routers_interface360", "routers_pii",
             "routers_interdependency", "routers_guardrails",
             "routers_variance360"):          # <- add
```

Copy `ingestion/variance_engine.py` into `ingestion/` (or next to the API as
`api/app/variance_engine.py` — the router tries both import paths).

### Environment (source connections)
```
CP_VAR_PBDW_DSN=readonly_user:****@pbdw-host:1521/pbdwsvc      # -- EDIT
CP_VAR_IMDS_DSN=readonly_user:****@imds-host:1521/imdssvc      # -- EDIT
# optional schema prefixes when legacy_lineage table names are unqualified:
CP_VAR_PBDW_SCHEMA_SRC=PBDW_SRC                                 # -- EDIT
CP_VAR_PBDW_SCHEMA_STG1=PBDW_STG                                # -- EDIT
CP_VAR_PBDW_SCHEMA_STG2=PBDW_STG                                # -- EDIT
CP_VAR_PBDW_SCHEMA_DWH=PBDW                                     # -- EDIT
```
If `CP_VAR_<DS>_DSN` is not set, the engine profiles through the SILVER
connection (assumes synonyms or same instance). Grants needed: SELECT on the
stage tables for the profiling account; full DML on RECON_* for SILVER.

## 3. UI  (ui/src/)
Copy `Variance360.jsx` into `ui/src/`. Then:

`AppShell.jsx` — add to the Governance group in NAV_GROUPS:
```js
{ group: 'Governance', items: [
  ['pii', 'PII Explorer', '\u2691'],
  ['guardrails', 'Quality Guardrails', '\u26A0'],
  ['variance', 'Variance 360', '\u224D'],        // <- add
] },
```

`App.jsx` — import and register the screen:
```js
import Variance360 from "./Variance360.jsx";
...
const screens = {
  ...
  variance: <Variance360 t={t} />,               // <- add
};
```

No api.js / mockData.js edits required — the component carries its own
fetch helpers (same BASE + timeout + DEMO-fallback convention) and demo data,
so the screen works offline immediately.

## 4. Design decisions already encoded
- Mapping source is legacy_lineage (mapped/exists chains only), scoped by
  data_source; FUNCTIONAL_GROUP drives the grouping.
- Date masks: the 5 defaults + distinct DATE_FORMAT values found in
  legacy_dictionary (capped at 8 probes/column).
- PII: columns whose legacy_dictionary row (join on PB_FIELD_MAPPING /
  FIELD_CODE_NORM — adjust in load_dictionary if your join key differs) has
  IS_PII='Y' get samples suppressed (pii_suppressed='Y', no raw values stored).
- Variance score: % variant fields weighted CNT/SUM x3, HASHSUM x2, rest x1;
  status RED >= 10 or any CNT break, AMBER >= 3, else GREEN.
- Numeric SUM/MIN/MAX on string-typed stage columns use
  TO_NUMBER(... DEFAULT NULL ON CONVERSION ERROR) so dirty values can't fail
  the metric query.
- Generate runs as a FastAPI BackgroundTask; recon_runs.step carries progress
  text; the UI polls /variance/run/{id} every 3s.

## 5. Later (explicitly out of v1 scope)
- Row-level hash-compare drill (needs curated business keys; is_pk exists in
  columns table when you're ready).
- Ingestion hook: one line at the end of the load script — `python -m ingestion.variance_ingest full --data-source PBDW` — or the interleaved open_run/table_loaded/finish calls from inside the loader.
  `ingestion.variance_engine.run_profile('PBDW', None, 'BOTH')` as a task at
  the end of the load DAG.
