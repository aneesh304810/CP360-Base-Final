# Design documents — authoring, configuring, ingesting (no HTML anywhere)
The source of truth is designs-md/*.md. The UI renders them natively.

## Anatomy of a document
    ---
    id: l3-stages                     unique key
    title: Stage 1 RAW & Stage 2 Enriched
    level: L3                         L1 / L2 / L3 badge
    icon: 🧱
    color: #0e8f7e                    accent (chips, section rule)
    bg: #dff2ef                       chip background
    order: 3                          sort order
    sub: detailed design - landing to tested dbt models
    match: stage ?1|raw|enrich|dbt    regex — components this doc governs
    zone_default: 2. Hub              (optional) fallback for a whole zone
    component_ids: 9, 23, 24          (optional) explicit pins — beat everything
    default: true                     (exactly one doc) catch-all
    ---
    intro paragraph...
    ## Section heading            -> a card in the UI
    ### Sub-heading               -> accent sub-head
    - bullet                      -> list
    | col | col |                 -> table (first row = header)
    **bold** and `code`           -> inline styling
    ```                           -> code block
    text
    ```

## Mapping precedence (the Design column)
component_ids pin  >  match regex  >  zone_default  >  the default doc.
All of it lives in front-matter — no code changes to remap.

## Adding or changing a document (the whole workflow)
1. Write/edit designs-md/<name>.md (front-matter + sections)
2. python tools/build_design_docs.py     -> regenerates ui-src/designDocsData.js
3. Rebuild the UI. Done — new doc appears in the Design column per its rules.
Optional governance: run sql/41 once, register "design_docs" in run.py STEPS
(mind the commas), run python -m ingestion.design_docs_loader — the same MD
lands in design_docs/design_doc_sections for search and audit.

## Converting a future HTML/Word source
tools/html_to_md.py <src.html> <dst.md> '<front-matter json>' gets you 90%;
polish the MD by hand after. Word: save as HTML first, or paste text into the
MD skeleton.

## Component design documents (the prompt contract) — ingest as-is
Documents generated with the SEI-BBH component-design prompt drop straight into
designs-md/ with NO editing. The builder detects their front-matter
(component_id, component_name, zone, plane, priority, technology, custom_build,
depends_on, architecture_decisions, status, owner, last_updated ...) and:
- pins the doc to its tracker row (Design column chip becomes "#<id> design")
- styles it by plane (Processing 🧪 · Ingress 📥 · DQ 🛡 · Orchestration 🛠 ...)
- surfaces status/owner/depends_on/decisions/updated as a meta strip in the drill
- skips the "# Title" line and --- rules (title comes from front-matter)
Mermaid fences render as code blocks for now (native mermaid render = follow-up).

## The change-and-reflect loop (both contracts)
edit designs-md/<doc>.md
python tools/build_design_docs.py      # -> designDocsData.js
python tools/build_mockup.py           # -> working mockup (optional but kept in sync)
rebuild the UI                          # the drill + Design column update
Optional Oracle: python -m ingestion.design_docs_loader (dual-contract aware).
