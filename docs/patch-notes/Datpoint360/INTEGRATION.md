# Integration — Non-SEI Datapoint 360 (legacy dictionary)

## Impacted files

| File | Action |
|---|---|
| `backend/app/routers/reference_legacy.py` | **NEW** — list / detail / summary endpoints |
| `backend/app/main.py` | **EDIT** — register the router (2 lines) |
| existing `legacy_lineage` router | **EDIT** — dedupe join fix (see `backend/PATCH_legacy_lineage_dedupe.md`) |
| `frontend/src/api/legacyReference.js` | **NEW** — API client |
| `frontend/src/components/datapoint/LegacyDatapointPanel.jsx` | **NEW** — Non-SEI view |
| existing `Datapoint360` page component | **EDIT** — branch on toggle (below) |

## 1. Register the router — app/main.py

```python
from app.routers import reference_legacy
app.include_router(reference_legacy.router, prefix="/api")
```

Adjust the `from app.db import get_conn` import at the top of
`reference_legacy.py` to match the connection dependency your other routers use
(check how `reference.py` / the legacy-lineage router acquire theirs — same
pattern, same import).

## 2. Wire the toggle — Datapoint360 page

In the component that renders the SEI / Non-SEI toggle and the legacy-system
chips (AddVantage / CRD / STAR), stop routing Non-SEI to the lineage dictionary
endpoint and render the new panel instead:

```jsx
import LegacyDatapointPanel from "../components/datapoint/LegacyDatapointPanel";

// inside the render, where the tab body switches:
{mode === "SEI" ? (
  <SeiDatapointView />            // existing component, unchanged
) : (
  <LegacyDatapointPanel system={legacySystem} />   // "ADDVANTAGE" | "CRD" | "STAR"
)}
```

Remove (or leave dormant) whatever code previously called
`/api/legacy-lineage/dictionary` from the Datapoint tab — that endpoint stays
in service for the Lineage screen only.

## 3. Mode resolution (DEMO→LIVE)

If your `api.js` has a shared request helper that resolves DEMO→LIVE, route the
three new client functions through it instead of the raw `fetch` in
`legacyReference.js`. The chip=2,759 / body=0 symptom came from two queries
resolving mode differently — keep every Datapoint 360 call on one path.

## 4. Quick verification

```bash
# summary numbers appear
curl "localhost:5173/api/reference/legacy-datapoint-summary?system=ADDVANTAGE"

# ACCOUNT_LONG_NAME_1 appears once, with module_count/occurrences
curl "localhost:5173/api/reference/legacy-datapoint?system=ADDVANTAGE&q=account_long"

# detail lists DIM_ACCOUNT once per physical occurrence + definitions per master
curl "localhost:5173/api/reference/legacy-datapoint/ACCOUNT_LONG_NAME_1?system=ADDVANTAGE"
```

Then in the UI: Non-SEI → AddVantage should show the field inventory with the
2,759-consistent counts, PII chips, and per-field detail; the Lineage tree
(after the dedupe patch) shows each DIM_ACCOUNT field once with its
VARCHAR2/length populated.

## Notes / assumptions to confirm

- `LEGACY_LINEAGE` has no `SOURCE_SYSTEM` column in the metadata you shared, so
  the join is on column name only. If lineage rows are AddVantage-only today,
  that's fine; when CRD/STAR lineage lands, either add a system column or scope
  via `FUNCTIONAL_GROUP`/naming convention, and add the predicate to
  `DETAIL_OCCURRENCES_SQL` and the LIST join.
- `FIELD_CODE_NORM` is assumed lower/normalized; the SQL wraps both sides in
  `UPPER()` so casing differences don't drop matches.
- Multi-master dictionary entries render as stacked definition cards in the
  detail pane rather than duplicating list rows.
