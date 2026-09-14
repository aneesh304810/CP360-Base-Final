# Global Search — autosuggest + results screen v2

| File | Change |
|---|---|
| ui-src/GlobalSearch.jsx | NEW. Header search after the LIVE badge: debounced autosuggest (/search?limit=8), recents (localStorage), field-code detection row, kind-grouped hits w/ PII pills + highlight, ↑↓/↵/esc. Hit click deep-links via the nav payload; Enter / See-all -> #search?q=. |
| ui-src/AppShell.jsx | Plain header input replaced by <GlobalSearch/> right after LIVE. New optional prop onOpenHit. NOTE: if you kept a locally modified AppShell (extra nav entries), apply just these three diffs by hand: (1) import GlobalSearch; (2) add onOpenHit to props; (3) swap the <input …submitSearch…/> block for <GlobalSearch t={t} onSubmit={submitSearch} onOpen={onOpenHit} /> + a marginLeft:auto spacer. |
| ui-src/App.jsx | Passes onOpenHit={navTo} into AppShell (one line). |
| ui-src/api.js | api.search gains a limit param. |
| ui-src/SearchResults.jsx | v2: query-understanding chips, kind facets w/ counts, INSTANT ANSWER card for field codes (all masters + landing targets per warehouse, click -> Lineage deep-link), ranked cards w/ SCORE + destination lines, ranked-vs-LIKE banner. Old file kept as SearchResults.v1.bak in the consolidated tree. |
| ui-src/Lineage.jsx | Bug fix: SectionHeader was given title/subtitle props it ignores (empty header bar). Now renders "Lineage" + subtitle properly. |
| api-app/main.py | /search: filter tokens (is:pii -> is_pii='Y'; master:ip/acc/sec/mac aliases -> subtitle LIKE; ds:x -> soft body/subtitle LIKE), field-code detection with canonicalization (BI/2-1 -> BI_2_1; _L1 -> _1) searched in both forms, response adds "understood" {terms, filters, code, code_norm}. Response otherwise backward-compatible. |

Deploy: copy files over the same paths (UI dest is ui/src/), restart API, hard refresh
(npm run build first if serving a bundle). No SQL or ingestion changes.

Verify:
  curl "localhost:8000/search?q=BI/2-1" | jq .understood
  curl "localhost:8000/search?q=is:pii+full+name" | jq '.understood, .total'
UI: header bar after LIVE -> type "full" -> grouped dropdown; type "BI/2-1" -> code row,
Enter -> results screen w/ instant answer; click a master pill -> Lineage panel opens.
