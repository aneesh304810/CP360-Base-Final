# Lineage — full deployment package

## New files → ui/src/  (your LegacyLineage.jsx is NOT in this zip on purpose)
  LineageHome.jsx   landing (PBDW / IMDS·IN BUILD) + Business/Technical shell
  BizLineage.jsx    pictorial drill: estate → group → table census (variance
                    pills + dots) → column (proof spine, full dictionary,
                    whole transformation)

## One mount edit (LINEAGE_WIRING.md)
  route 'lineage' → <LineageHome t={t} focus={...} />   (old wrapper's
  warehouse chip retires; focus deep-links land in Technical as before)

## Six patches to YOUR LegacyLineage.jsx — apply IN THIS ORDER
  1. LEGACY_LINEAGE_SPACING_PATCH.md   map cards stop stretching
  2. DEF_MODAL_PATCH.md                DefModal popup for map + rail
  3. INLINEDEF_ROOMY_PATCH.md          roomy typography in the popup
  4. TECHNICAL_SMART_WIDTH_PATCH.md    ch-based widths for 10–20 char names
  5. LINEAGE_FIRST_PATCH.md            popup order: lineage → description
  6. XFORM_STORY_PATCH.md              "what is happening" band above the
                                       description
  7. INLINE_OVERFLOW_PROOF_PATCH.md    inline panel overflow: minWidth:0 +
                                       wrap-safe proof blocks (fixes the
                                       screenshot collisions in table/biz)
  (3,5,6 build on 2; 4 and 5 reference strings from earlier patches — the
  order above is the tested one. Each doc lists unique fragments if a FIND
  misses on whitespace.)

## Acceptance
  lineage_final_mockup.html IS the spec — landing, Business drill to
  ACCOUNT_LONG_NAME_1, Technical popup (journey → story band → description),
  IMDS with IN BUILD badge. Any deployed screen differing from the mockup
  is a bug.

## No backend changes anywhere in this package.
