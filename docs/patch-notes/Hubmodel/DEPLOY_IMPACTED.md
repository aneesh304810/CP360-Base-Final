# Impacted files — Pre-Gold remodel + Tier-2 status
1. sql/42_component_status.sql      -> run on SILVER (component_status + _hist + review view)
2. design_status.py                 -> api/app/routers/ + include_router in main.py (fix get_conn import)
3. HubDesign.jsx                    -> ui/src/  (remodeled boards + DB-backed dashboard, local fallback)
4. designDocsData.js                -> ui/src/  (architecture.md rebuilt: Pre-Gold framing)
5. architecture.md                  -> designs-md/ in git (nightly design_docs re-ingests to Oracle)
6. PDF_TO_CP360_PROMPT.md           -> replaces prior copy (enterprise Claude facts corrected)
7. hub_design_c4_mockup.html        -> acceptance spec, updated to match
Smoke: dashboard shows "● shared — Oracle component_status"; edit a % -> row in
component_status_hist; L2 shows Pre-Gold (Exadata), FINAL GOLD consumers,
consumer-APIs + outbound-via-Gateway amber lanes.
