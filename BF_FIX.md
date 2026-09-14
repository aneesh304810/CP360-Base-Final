# FIX — bf endpoints 500 (ORA-00923) + search/business-flow/loaders not loading

## What the error actually tells us
Your running main.py threw:
    ORA-00923: FROM keyword not found where expected
    at main.py line 181: SELECT flow_id, flow_name, business_domain, goal, ...

That query selects a column named `trigger` — which is an Oracle RESERVED word, so
Oracle rejects the SQL. My fixed main.py uses `trigger_event` (and now auto-detects
which column your table actually has). 

**This proves your running main.py is an OLDER copy — the fixes were not deployed.**
When /bf/api-flows 500s, the UI falls back to mock/empty, which is why business flow,
loaders, and search all look broken at once.

## Two layers to fix

### Layer 1 — deploy the updated main.py (REQUIRED)
Replace  C:\SEI\bbhcatalog\Fullcp360\api\app\main.py  with the new main.py.
Then RESTART uvicorn (Ctrl+C and re-run). Python caches modules — a restart is required.

The new main.py is defensive:
- /bf/api-flows: auto-detects trigger_event vs "trigger" column; falls back to a
  minimal column set if anything is off. Never 500s on that column again.
- /bf/pipelines: falls back to non-v20 columns if the v20 routing columns aren't in
  your bf_pipelines table yet.

### Layer 2 — make sure the DB schema matches (if Layer 1 still shows gaps)
The trigger_event rename lives in sql/21. If you ran sql/21 BEFORE the rename fix, your
bf_api_flows table still has the reserved "TRIGGER" column. The new endpoint handles
BOTH, so it will work either way — but to fully align, re-run the fixed sql/21:
    sqlplus <dsn> @sql\21_business_flow_workbook.sql
It's idempotent (guarded), so re-running is safe. It renames trigger->trigger_event and
adds the v20 columns via the guarded ALTER block.

## Deploy ALL the current fixes at once (recommended)
Rather than chase files one at a time, replace these from cp-catalog-bbh-FINAL.zip:
    api/app/main.py                         <- THIS fix (bf endpoints)
    api/app/db.py                           <- DSN parser
    api/app/routers_data360.py              <- _safe helper (datapoint 500s)
    api/app/routers_data360_pipelines.py    <- quality rules
    ui/src/*.jsx                            <- the 5 mockup features
Then: restart uvicorn AND restart `npm run dev`.

## Verify (this is the definitive test)
1) curl http://localhost:8000/bf/api-flows
   -> should return {"flows":[...]} with ~57 flows, NOT a 500.
2) curl http://localhost:8000/bf/pipelines
   -> ~444 pipelines.
3) curl http://localhost:8000/diag
   -> row counts confirming the API sees real data.
4) curl "http://localhost:8000/search?q=account"
   -> search results (search_index has ~6570 rows).

If /bf/api-flows still 500s AFTER replacing main.py and restarting, paste the NEW
traceback — but it will now show a different (handled) path, or succeed.

## Why search specifically looked dead
Search itself was never broken — but while the app was throwing 500s on other calls,
the UI's silent mock-fallback made every screen (including search) render empty/mock.
Once the 500s stop, search works. Test the curl above to confirm the backend is fine.
