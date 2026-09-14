# Search autocomplete + synonyms + "did you mean" — the missing build

WHY IT WASN'T WORKING: the codebase you uploaded did NOT contain any of the
search-enhancement code — no /search/suggest endpoint, no searchSuggest method,
no autocomplete dropdown. It was never in the build you were running. These 5
files are built directly ON TOP OF your uploaded codebase, so they match your
current version exactly.

## Files -> where they go (OVERWRITE existing, except search_synonyms.py which is new)

| In zip | Copy to |
|---|---|
| `api-app/main.py` | `api/app/main.py` (OVERWRITE) |
| `api-app/search_synonyms.py` | `api/app/search_synonyms.py` (NEW file) |
| `ui-src/AppShell.jsx` | `ui/src/AppShell.jsx` (OVERWRITE) |
| `ui-src/SearchResults.jsx` | `ui/src/SearchResults.jsx` (OVERWRITE) |
| `ui-src/api.js` | `ui/src/api.js` (OVERWRITE) |

## Step 1 — copy (from your project root)

```powershell
$src = "C:\path\to\unzipped\search-fix"
Copy-Item "$src\api-app\main.py"            api\app\main.py            -Force
Copy-Item "$src\api-app\search_synonyms.py" api\app\search_synonyms.py -Force
Copy-Item "$src\ui-src\AppShell.jsx"        ui\src\AppShell.jsx        -Force
Copy-Item "$src\ui-src\SearchResults.jsx"   ui\src\SearchResults.jsx   -Force
Copy-Item "$src\ui-src\api.js"              ui\src\api.js              -Force
```

## Step 2 — FULL restart (a plain --reload is not enough; Python caches)

```powershell
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-ChildItem -Path api -Filter __pycache__ -Recurse -Directory | Remove-Item -Recurse -Force
uvicorn app.main:app --app-dir api --port 8000
```

## Step 3 — restart UI + hard-refresh

```powershell
cd ui
npm run dev
# then in the browser: Ctrl+Shift+R
```

## Step 4 — verify

```powershell
curl "http://localhost:8000/search/suggest?q=account"
```
Should return suggestions now (NOT 404, NOT empty). If you still get 404, the new
main.py didn't load — repeat Step 2 and make sure no other python.exe holds port 8000.

Then in the UI: type "account" or "cusip" in the top search bar -> a dropdown of
matching entries appears as you type. Press Enter on "customer" -> results include
client fields (synonym expansion). An empty search shows "did you mean" chips.

## How the two behaviors differ (so results make sense)
- Autocomplete DROPDOWN (as you type): matches on name OR body_text. "customer"
  may show little if nothing is named/described with that word.
- Synonym SEARCH (press Enter): expands "customer"->client, "money owed"->
  balance/accrual/fee, etc., against descriptions. This is where the synonym
  power shows.

Edit the SYNONYMS dict in `search_synonyms.py` to add BBH's real terms/abbrevs.

## Note
Validated structurally (syntax, brackets, imports) against your uploaded codebase.
Not runtime-tested here (no Oracle/Vite). The full restart in Step 2 is the part
people miss — it's why "nothing happened" before.
