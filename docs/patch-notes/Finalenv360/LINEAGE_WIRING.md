# Lineage Business view — wiring (3 files, LegacyLineage UNTOUCHED)

New files into ui/src/:  BizLineage.jsx · LineageHome.jsx
Your LegacyLineage.jsx: NOT modified. Do not redeploy it.

## Mount (the only edit to your code)
Wherever the lineage route currently renders your wrapper/LegacyLineage:
    import LineageHome from './LineageHome.jsx';
    ...
    case 'lineage': return <LineageHome t={t} focus={lineageFocus} />;
LineageHome owns the PBDW/IMDS choice now — if your old wrapper had its own
warehouse chip, retire that chip (LineageHome renders it); keep passing the
same `focus` deep-link object ({table, column, dataSource?}) from search /
Datapoint 360 — deep-links land directly in Technical view, pre-expanded,
exactly as before.

## What you get
- Landing: PBDW / IMDS cards with live stats (one legacyLineageTables call each)
- Business view: estate → group → table (four-dot census with filter + kind
  pills) → column page: journey with proof values riding + variance seal +
  FULL dictionary entry (long_desc + attributes) + THE WHOLE TRANSFORMATION
  (all three hops, actual expressions, physicalized/renamed detection)
- Technical view: your LegacyLineage mounted as-is; "open Technical view"
  on any business column deep-links to that table+field via your focus prop
- Cross-warehouse jumps from InlineDef flow back through onDataSource and
  switch the shell's warehouse

## No new backend
Every call is one your screen already makes: legacyLineageTables/Fields,
legacyBusinessDef, legacyLineageProof. Zero API or SQL changes.

## Verify after deploy
1. /lineage → landing shows both cards with real counts
2. PBDW → Business → group → table → column: full dictionary text renders
   (long_desc), three-hop transformation panel shows real expressions
3. "open Technical view" lands your old screen on the same field, def open
4. Technical view behaves byte-for-byte like today
