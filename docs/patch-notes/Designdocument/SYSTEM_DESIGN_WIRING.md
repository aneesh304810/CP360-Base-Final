# System Design — SEI-BBH Design Pack wiring
Adds the four SEI↔BBH design documents + the 65-component tracker + the 12
open decisions into the System Design screen.

## Files
designs/ (4 html)             the L1/L2/L3 design documents, served statically
SeiDesignPack.jsx             the section component (docs + tracker + decisions)
seiDesignTracker.js           data module generated FROM the xlsx (73->65 rows,
                              legend rows stripped, 12 decisions)
SEI-BBH_Component_Design_Tracker.xlsx   the source workbook (for reference /
                              regeneration when it updates)

## Wiring (3 steps)
1. Copy SeiDesignPack.jsx + seiDesignTracker.js -> ui/src/
2. Copy designs/*.html -> ui/public/designs/   (Vite/CRA serve /designs/*.html;
   if your build uses a different static root, adjust DOCS hrefs in
   SeiDesignPack.jsx or serve the folder from FastAPI StaticFiles at /designs)
3. In SystemDesign.jsx:
       import SeiDesignPack from './SeiDesignPack.jsx';
   and render, wherever the section belongs (typically at the end):
       <SeiDesignPack t={t} />

## What it renders
- 4 doc cards (L1 architecture, L2 plane drill-downs, L3 Stage1/2, L3 error
  handling) - "view inline" opens an in-page iframe; the small ⧉ opens a tab
- Tracker summary strip: 65 components · 36 P1 · 13 high-custom · 28 NEW
- "12 open decisions" toggle: SEI v5 vs BBH v4.2 positions + recommendation +
  which components each blocks
- Filterable component table (zone pills · high-custom toggle · search);
  click a row for design questions, custom scope, dependencies, notes

## Refreshing when the workbook changes
Re-run the extraction (openpyxl over Components + Decisions sheets, numeric-ID
rows only) to regenerate seiDesignTracker.js; the UI needs no changes.
