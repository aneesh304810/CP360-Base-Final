# CP 360 fixes — dropdown close, full-table search, empty /search results

Built on top of the **legacy-e2e-lineage** drop (latest main.py/api.js/Interface360.jsx)
plus the base cp-catalog-bbh GraphFilterBar and router.

## What was wrong

### 1. Filter dropdown doesn't close on outside click
`GraphFilterBar.jsx` had no outside-click handler — the menu only toggled on
the chip button itself. Fixed with a container ref + a `pointerdown` listener
(attached only while a menu is open) + Escape to close.

### 2. Table search only filtered what was on screen
`/interface360/interfaces` fetches at most 100 rows (`limit: int = 100`), and
the search box filtered those 100 client-side — so anything past the first
page was invisible to search. Now:
- Router accepts `q` and searches the FULL table server-side
  (source, target, integration, application, owner, feed type, domain),
  and returns `total` so "Showing X of Y" is the real match count.
- UI debounces the search box (250ms) into the API call (limit raised to 500
  while searching) and the redundant client-side filter was removed.

### 3. Full-text search + "did you mean" return nothing despite API calls in logs
Two silent failure paths in `/search`:
- **The real bug:** when the Oracle Text `CONTAINS` query failed OR returned
  zero rows, the LIKE fallback reused the same `params` dict which still held
  the leftover `:ctx` bind. The fallback SQL has no `:ctx` placeholder, so
  oracledb raised **ORA-01036 (illegal variable name/number)** — swallowed by
  a bare `except`, returning an empty 200. So every query that didn't hit the
  text index came back empty, while the request showed up in your logs.
  Fixed: CONTAINS and LIKE each use their own params dict, and both except
  blocks now LOG the error instead of hiding it.
- If `search_index` is empty/missing, everything (search AND suggest) is
  legitimately empty — `db.query` returns `[]` on ORA-00942. New endpoint
  **`GET /search/diag`** tells you in one curl: table exists? row count?
  text index present? per-module breakdown.

Also added a small CLI to `ingestion/run.py` so you can rebuild just the
index: `python -m ingestion.run search_index`.

## Files → where they go (all OVERWRITE)

| In zip | Copy to |
|---|---|
| `api-app/main.py` | `api/app/main.py` |
| `api-app/routers_interface360.py` | `api/app/routers_interface360.py` |
| `ingestion/run.py` | `ingestion/run.py` |
| `ui-src/GraphFilterBar.jsx` | `ui/src/GraphFilterBar.jsx` |
| `ui-src/Interface360.jsx` | `ui/src/Interface360.jsx` |
| `ui-src/api.js` | `ui/src/api.js` |

## Steps

```powershell
$src = "C:\path\to\unzipped\fixes"
Copy-Item "$src\api-app\main.py"                    api\app\main.py                    -Force
Copy-Item "$src\api-app\routers_interface360.py"    api\app\routers_interface360.py    -Force
Copy-Item "$src\ingestion\run.py"                   ingestion\run.py                   -Force
Copy-Item "$src\ui-src\GraphFilterBar.jsx"          ui\src\GraphFilterBar.jsx          -Force
Copy-Item "$src\ui-src\Interface360.jsx"            ui\src\Interface360.jsx            -Force
Copy-Item "$src\ui-src\api.js"                      ui\src\api.js                      -Force

# FULL API restart (clear __pycache__, as before)
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-ChildItem -Path api -Filter __pycache__ -Recurse -Directory | Remove-Item -Recurse -Force
uvicorn app.main:app --app-dir api --port 8000

# UI
cd ui; npm run dev   # then Ctrl+Shift+R in the browser
```

## Verify

```powershell
# 1. Is the search index actually populated?
curl "http://localhost:8000/search/diag"
#    row_count = 0  ->  run:  sqlplus @sql/20_search_index.sql   (if never run)
#                            python -m ingestion.run search_index

# 2. Search now falls back correctly (watch API logs — errors are no longer silent)
curl "http://localhost:8000/search?q=customer"

# 3. Full-table interface search
curl "http://localhost:8000/interface360/interfaces?q=addvantage"
```

UI checks: open Interface 360 → open a filter dropdown → click anywhere else →
it closes (Escape works too). Type in the table search → matches come from ALL
interfaces, and "Showing X of Y" reflects the true match count.

## Note
Validated for syntax (py_compile / TS transpile) against your uploaded
codebase; not runtime-tested here (no Oracle/Vite).
