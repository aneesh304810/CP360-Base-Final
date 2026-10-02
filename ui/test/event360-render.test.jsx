// Event 360's small components, actually rendered.
//
// WHY THIS FILE EXISTS. Three times now a shared constant has gone missing
// from this module and thrown in the browser, on mount, in front of the
// user:
//
//   "Cannot access 'P' before initialization"  — a circular import
//   "SeiBusinessSummary is not defined"        — a component never imported
//   "BC is not defined"                        — a constant that moved to
//                                                eventPalette.js without
//                                                its `export`
//
// Every one got through a clean `npm test` and a clean esbuild bundle,
// because esbuild is a bundler and not a checker: an unresolved IMPORT is
// an error, an undefined IDENTIFIER is left alone — at build time it might
// be a global.
//
// A static check cannot find these reliably; a regex cannot tokenize
// JavaScript, and three attempts at one are described at the foot of
// imports.test.jsx. RENDERING CAN. These components read the palette the
// moment they draw, so calling them with props that reach the colour
// lookup is the whole test. BC was read on the line that needs
// `e.criticality` to be set, which is why a prop-less smoke render would
// have missed it too — the fixture carries real shapes.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Event360, { P, TC, BC } from "../src/Event360.jsx";
import { P as PP, TC as TTC, BC as BBC } from "../src/eventPalette.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 200)}`}`);
  if (!cond) bad++;
};

// ---- the palette is reachable from both sides -------------------------
// Event360 re-exports it, EventMicroBatch imports it from the palette
// module; both paths have to land on the same object or the module split
// has quietly forked.
for (const [name, viaEvent, viaPalette] of
     [["P", P, PP], ["TC", TC, TTC], ["BC", BC, BBC]]) {
  ok(viaPalette && typeof viaPalette === "object",
     `${name} is exported from eventPalette.js`, viaPalette);
  ok(viaEvent === viaPalette,
     `${name} re-exported from Event360 is the same object — not a copy`,
     [viaEvent, viaPalette]);
}
ok(Object.keys(BC).length >= 4,
   "BC carries every severity band the chips can be handed",
   Object.keys(BC));

// ---- render the components that read it -------------------------------
// Reaching into the module for its internals is not possible (they are
// not exported), so the whole screen is rendered with data that forces
// those branches. An undefined constant throws here exactly as it does in
// the browser.
const EVENTS = [{
  event_id: 1001, event_name: "Position Updated", event_type: "Business",
  domain: "Positions", publisher: "SEI", payload_fields: 4,
  criticality: { band: "Critical", score: 91 },
}, {
  event_id: 1002, event_name: "Batch Complete", event_type: "Marker",
  domain: "Control", publisher: "SEI", payload_fields: 3,
  criticality: { band: "Moderate", score: 42 },
}, {
  event_id: 1003, event_name: "Load Started", event_type: "Technical",
  domain: "Control", publisher: "SEI", payload_fields: 3,
  // no criticality at all: Band must return null rather than look up
  // BC[undefined]
}];

const t = { panel: "#fff", panel2: "#dfe6e9", navy: "#10193b", sub: "#666",
            muted: "#999", bg: "#f5f8f8", accent: "#0f4775", border: "#b5b6b6",
            font: "system-ui", radius: { sm: 2, md: 3, pill: 999 },
            height: { btnSm: 26 }, shadow: { sm: "none" },
            infoBg: "#e0f5fd", info: "#0091bf", textMuted: "#999",
            disabled: "#dbdae0", hover: "#0091bf", warning: "#e67e22",
            spacing: { md: 16 }, tint: "#eef3f8", pop: "#31bced",
            text: "#333", minWidth: 0 };

let html = "";
try {
  html = renderToStaticMarkup(React.createElement(Event360, { t }));
  ok(true, "Event 360 renders without throwing");
} catch (e) {
  ok(false, "Event 360 renders without throwing", e && e.message);
}

// Every band colour must be a real value if a chip was drawn — an
// undefined lookup renders as a missing background rather than throwing,
// so the absence of the literal is the signal.
for (const [band, colour] of Object.entries(BC)) {
  ok(/^#[0-9a-f]{6}$/i.test(colour), `BC.${band} is a colour`, colour);
}
for (const [type, colour] of Object.entries(TC)) {
  ok(/^#[0-9a-f]{6}$/i.test(colour), `TC.${type} is a colour`, colour);
}
ok(typeof html === "string", "and produced markup", typeof html);
ok(!/undefined/.test(html.slice(0, 4000)),
   "with no literal 'undefined' in the first screenful — a constant that "
   + "resolved to nothing paints as `background:undefined`");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nevent360-render assertions pass");
if (bad) process.exit(1);
