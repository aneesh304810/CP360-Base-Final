// The 18 components the events-primary assumption requires, expressed in the
// same shape as TRACKER_COMPONENTS so they flow through the C4 layers exactly
// like the original 65: L1 counts, L2 container groups, L3 lists, the flat
// tracker and the delivery dashboard.
//
// Content lives once, in hubArchitectReview.js. This module only reshapes it.

import { AR_MISSING } from "./hubArchitectReview.js";

// ids continue the tracker's numbering so sort order and CSV export hold
const FIRST_ID = 66;

export const HUB_EVENT_COMPONENTS = AR_MISSING.map((m, i) => ({
  id: String(FIRST_ID + i),
  zone: "2. Hub",
  plane: m.plane,
  component: m.name,
  deliverable: m.deliverable,
  questions: m.why,
  depends: "-",
  source: "Architect review — events-primary",
  priority: m.pri,
  technology: m.tech,
  custom: m.build,
  scope: "BBH-owned. Not in the SEI pack and not in the original 65.",
  owner: "",
  status: "Not Started",
  target: "",
  notes: m.why,
  // review fields, carried so L3 can render them in the same panel
  arId: m.id,
  isNew: true,
  perf: m.perf,
  err: m.err,
}));

export const EVENT_ID_RANGE = [FIRST_ID, FIRST_ID + AR_MISSING.length - 1];
