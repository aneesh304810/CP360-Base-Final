# System Design — SEI-BBH Design Pack wiring (v3 · NO HTML documents)
Docs are Markdown in designs-md/, compiled to designDocsData.js, rendered
natively. The old /designs/ static-HTML step is GONE.

## Deploy (ui/src/)
SystemDesign.jsx · SeiDesignPack.jsx · seiDesignTracker.js · designDocsData.js
That's it — no public/ assets, no backend, no api.js changes.

## What renders
- Landing: Component Architecture hero + the 65-component tracker with the
  DESIGN column (mapping from MD front-matter: pins > regex > zone > default)
- Drill: click a Design chip -> the document renders natively (section cards,
  tables, code blocks) with back button + component context. No iframes.

## Authoring / ingestion
See DESIGN_DOCS_GUIDE.md — edit MD, run tools/build_design_docs.py, rebuild.
Optional Oracle governance: sql/41_design_docs.sql + design_docs_loader.py
(register as "design_docs" in run.py STEPS — mind the commas).
