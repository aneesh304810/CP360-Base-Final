// SEI's "BBH to SEI : System Integration" diagram, recorded and reconciled.
//
// WHY THIS IS HERE. It is the picture both organisations actually point
// at in a room. Every other screen in this app is a model we built; this
// one is theirs, drawn as they drew it, so a reader can see our work
// against the thing they already know. The source is SEI Confidential
// and is NOT committed - only the architecture is recorded here, with no
// hostnames, addresses, credentials or data.
//
// AND THE FINDING THAT ONLY APPEARS WHEN YOU DRAW IT. The diagram covers
// four paths in detail - data extracts, JSON, loader files and real-time
// API calls - and it has no event path anywhere on it. No Kafka, no
// queue, no SDC read, no listener. The route this programme has made its
// PRIMARY inbound path does not exist on the integration diagram the two
// organisations share. That is not a drawing oversight to fix quietly:
// everything on the diagram is BBH pushing to SEI, and the event path is
// the one direction that runs the other way.
//
// THE OTHER THING IT SHOWS. "BBH API Apigee proxy" appears twice - node 3
// on the way in, node 12 on the status return - and it IS the
// CP-Integration-Gateway: BBH's wrapper around the BBH Apigee proxy,
// drawn at the two points of the flow it sits on. One component, two
// positions. The earlier reading of this as "two proxies" was wrong.

export const SI_DOC = {
 n: "BBH to SEI : System Integration",
 own: "SEI",
 w: "The integration picture the two organisations share. Fifteen "
  + "numbered steps across SWP, SEI PS-Orchestration and the BBH "
  + "PS-Integration Hub.",
 note: "SEI Confidential. The source is not committed; this records the "
     + "architecture only - no addresses, hostnames, credentials or data.",
};

// Four bands, left to right, as the diagram lays them out.
export const SI_BANDS = [
 { id: "swp",  n: "SWP",                     own: "SEI", x: 0 },
 { id: "orch", n: "SEI PS-Orchestration",    own: "SEI", x: 1 },
 { id: "hub",  n: "BBH PS-Integration Hub",  own: "BBH", x: 2 },
 { id: "bbh",  n: "BBH existing systems",    own: "BBH", x: 3 },
];

// The numbered steps, as numbered on the diagram. `ours` names the leg in
// our channel model, or null where we have nothing for it.
export const SI_STEPS = [
 { n: "1",  band: "bbh",  t: "BBH systems produce the loader file",
   w: "Front office, back office, trade platform and custody services.",
   ours: "C1" },
 { n: "2a", band: "hub",  t: "Data extracts", w: "Into the Integration Hub.",
   ours: null },
 { n: "2b", band: "hub",  t: "JSON", w: "Into the Integration Hub.",
   ours: null },
 { n: "2c", band: "hub",  t: "Loader file", w: "Into the Integration Hub.",
   ours: "C1" },
 { n: "3",  band: "hub",  t: "CP-Integration-Gateway",
   w: "SEI's label is \"BBH API Apigee proxy\"; it is the BBH Apigee proxy "
    + "with BBH's wrapper around it. Inbound leg, and the real-time calls.",
   ours: "C1" },
 { n: "4",  band: "orch", t: "Orchestration API",
   w: "SEI's entry point for everything BBH sends.", ours: "C1" },
 { n: "5a", band: "orch", t: "Data ingestion",
   w: "Reads config, then ingests.", ours: null },
 { n: "5b", band: "orch", t: "Metadata, config and mapping",
   w: "Read by both data ingestion and workflows.", ours: null },
 { n: "6",  band: "orch", t: "Orchestration Data Model (ODM)",
   w: "Where SEI holds what BBH sent.", ours: null },
 { n: "7",  band: "orch", t: "Workflows",
   w: "Drives the SWP APIs and the loader submission.", ours: null },
 { n: "8",  band: "swp",  t: "SWP APIs",
   w: "Also the target of the real-time API calls from BBH.", ours: "D2" },
 { n: "9",  band: "swp",  t: "Loaders",
   w: "Submit loader into the SWP platform.", ours: "C1" },
 { n: "11", band: "orch", t: "Status monitoring dashboard",
   w: "SEI-side view of workflow status.", ours: null },
 { n: "12", band: "hub",  t: "CP-Integration-Gateway",
   w: "The same component as node 3 - the BBH Apigee proxy with BBH's "
    + "wrapper - drawn where the status return passes through it.",
   ours: "C2" },
 { n: "13", band: "hub",  t: "Integration360",
   w: "Status monitoring, exception management, process tracking, "
    + "reconciliation management.", ours: "C2" },
 { n: "14", band: "hub",  t: "User", w: "Operates Integration360.",
   ours: null },
 { n: "15", band: "hub",  t: "SSO", w: "Into the SWP UI.", ours: null },
];

export const SI_EDGES = [
 ["1", "2c", "produces"], ["2a", "3", ""], ["2b", "3", ""], ["2c", "3", ""],
 ["3", "4", ""], ["4", "5a", ""], ["5a", "5b", "read config"],
 ["5a", "6", "ingest"], ["6", "7", ""], ["7", "5b", "read config"],
 ["7", "8", ""], ["7", "9", "submit loader"], ["7", "11", ""],
 ["7", "12", "status update to BBH"], ["12", "13", ""], ["14", "13", ""],
 ["8", "swp", ""], ["9", "swp", ""], ["15", "swp", "SSO to the SWP UI"],
];

// What the diagram covers, and what it does not. The second list is the
// reason this screen exists.
export const SI_COVERS = [
 { t: "Data extracts", ours: "not in our model", st: "gap" },
 { t: "JSON", ours: "not in our model", st: "gap" },
 { t: "Loader files", ours: "channel C", st: "ok" },
 { t: "Real-time API calls", ours: "channel D", st: "ok" },
];

export const SI_ABSENT = [
 { t: "The event path, entirely",
   w: "No Kafka, no dedicated queue, no SDC Snowflake read, no listener, "
    + "no markers, no tag-based routing. The route this programme has "
    + "made its PRIMARY inbound path appears nowhere on the integration "
    + "diagram the two organisations share.",
   ours: "channel A - legs A1 and A2", sev: "block" },
 { t: "The file-based inbound path",
   w: "SFTP, Momentum and the Landing Zone are not on it either. The "
    + "diagram's file is the LOADER file going out, not the daily "
    + "extract coming in.",
   ours: "channel B - leg B1", sev: "block" },
 { t: "The error-detail file coming back",
   w: "Status returns by API through node 12. The per-record detail "
    + "returning as a file has no step.",
   ours: "channel C - leg C3", sev: "warn" },
 { t: "The Hub answering the originating consumer",
   w: "The diagram ends at Integration360 and the user. Nothing shows "
    + "the Hub calling the consumer back once status and detail agree.",
   ours: "channel C - leg C4", sev: "warn" },
];

// What our model has that theirs numbers differently, and vice versa.
export const SI_NOTES = [
 { t: "Nodes 3 and 12 are one component",
   w: "SEI labels both \"BBH API Apigee proxy\". That is the "
    + "CP-Integration-Gateway - BBH's wrapper around the BBH Apigee proxy - "
    + "drawn at the two points of the flow it sits on, inbound and status "
    + "return. One deployment, one rule set, one certificate inventory; "
    + "our one gateway band and their two boxes agree." },
 { t: "Everything on the diagram runs BBH to SEI",
   w: "Every numbered step is BBH pushing or SEI processing what BBH "
    + "pushed. The two inbound paths - events and files - are the "
    + "direction the diagram does not cover at all, which is why their "
    + "absence is easy to miss in a review of it." },
 { t: "ODM is not in our model",
   w: "SEI holds what BBH sends in an Orchestration Data Model before "
    + "the workflows act on it. We have no equivalent and no "
    + "reconciliation boundary against it." },
 { t: "Data extracts and JSON have no home in our model",
   w: "Nodes 2a and 2b are inbound to SEI beside the loader file. Our "
    + "channel C covers the loader only, so two of the three things BBH "
    + "pushes are unmodelled." },
];

export const siStep = (n) => SI_STEPS.find((s) => s.n === n) || null;
export const siBand = (id) => SI_BANDS.find((b) => b.id === id) || null;
export const SI_UNMAPPED = SI_STEPS.filter((s) => !s.ours);
export const SI_BLOCKING = SI_ABSENT.filter((a) => a.sev === "block");
