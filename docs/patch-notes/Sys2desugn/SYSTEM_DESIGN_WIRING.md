# CP Integration Hub — deploy (one home)
ui/src/ receives 6 files:
  HubDesign.jsx        NEW route: C4 L1+dashboard -> L2 -> L3 -> DocDrill
  DocDrill.jsx         NEW shared doc viewer/editor (zoom, svg, Tier-1 export)
  SeiDesignPack.jsx    slimmed: flat tracker landing, drill via DocDrill
  SystemDesign.jsx     SEI-BBH tab REMOVED (3 tabs)
  designDocsData.js + seiDesignTracker.js  (unchanged from last deploy)
app-shell trio (diff before overwrite — recovered copies):
  App.jsx (route hub) · AppShell.jsx (nav: CP Integration Hub 🏛) · navStatus.jsx
Smoke: nav -> CP Integration Hub -> L1 animated lanes + dashboard (edit a %,
refresh, persists; CSV downloads) -> Hub click -> containers -> ENR -> #15 chip
-> doc + editor + zoom -> back chain. System Design shows 3 tabs.
Acceptance spec: hub_design_c4_mockup.html side-by-side.
