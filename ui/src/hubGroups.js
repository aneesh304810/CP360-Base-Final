// The container layer: one picture of the whole flow, in BBH's grouping.
//
// The levels below this are already right — the component records are
// cited and the registry has a verdict on everything else. What was
// missing was the level ABOVE them: somewhere a reader sees the shape
// of the thing once, in the words the programme actually uses, and
// clicks into whichever part they came for.
//
// The grouping is BBH's, given directly: ingress and egress, ingestion,
// orchestration, processing — with the stage chain inside it — then
// OpenShift and foundation. It is NOT the five stages seiBaseline.js
// uses, and that is deliberate: the baseline is organised the way SEI's
// documents are, and this is organised the way the people building it
// talk. Both are true; a component simply appears in one group here and
// one stage there.
//
// Membership is declared for SEI components and derived for tracker
// components, because the tracker already carries a plane and deriving
// it keeps the two from drifting. The overrides below are the handful
// where the plane is misleading.

export const GROUPS = [
 { id: "ingress", n: "Ingress and Egress", icon: "⇆",
   sub: "how data arrives, and how anything goes back",
   sei: ["S1", "S2", "S3", "S4"], bbh: [] },
 { id: "ingestion", n: "Ingestion", icon: "⬇",
   sub: "discover, validate, load RAW",
   sei: ["S5", "S6", "S7", "S8"], bbh: [] },
 { id: "orchestration", n: "Orchestration", icon: "⚙",
   sub: "the business date, the gate, and what runs when",
   sei: ["S9", "S10", "S11", "S12", "S13", "S20"], bbh: [] },
 { id: "processing", n: "Processing", icon: "⚙",
   sub: "Stage 1 → Stage 2 → Stage 2 INT → Stage 3",
   sei: ["S14", "S15", "S16", "S17", "S18", "S19"], bbh: ["B1", "B2"],
   stages: true },
 { id: "foundation", n: "Foundation", icon: "▤",
   sub: "control tables, evidence, audit, security",
   sei: ["S21"], bbh: [] },
 { id: "openshift", n: "OpenShift Platform", icon: "☸",
   sub: "runtime, deployment, operations",
   sei: [], bbh: [] },
];

// The chain inside Processing, in BBH's numbering. This is the spine of
// the whole picture and the part everyone argues about, so it is drawn
// as a chain rather than as a list.
export const PROC_STAGES = [
 { id: "stage1", n: "Stage 1", sub: "RAW — as delivered",
   sei: [], tbl: ["T4"], bbh: [],
   w: "The file exactly as it arrived, append-only, tagged with the "
    + "business date and lineage. Nothing is cleaned here." },
 { id: "stage2", n: "Stage 2", sub: "STG — a view, in memory",
   sei: ["S14"], tbl: [], bbh: [],
   w: "Standardises the columns and marks every row pass or fail. It is "
    + "a view: it holds nothing and is recomputed on read. Its job is "
    + "the source DQ check." },
 { id: "stage2int", n: "Stage 2 INT", sub: "the normalised SWP model",
   sei: ["S15", "S16", "S17"], tbl: ["T5", "T6"], bbh: [],
   w: "INT, DIM and FACT together, with reference mapping and "
    + "translation applied. Passing rows only; INT keeps seven days; "
    + "dimensions are built before facts so a transaction can always "
    + "find its account." },
 { id: "stage3", n: "Stage 3", sub: "the actual data warehouse",
   sei: [], tbl: [], bbh: ["B1", "B2"],
   w: "A Pre-Gold layer shaped as a mirror of IMDS and PBDW, then a "
    + "simple movement of that data into the warehouse itself.",
   note: "BBH's. SEI's documents publish from DIM and FACT and stop, so "
       + "nothing on this stage is cited." },
];

// plane -> group, for the tracker's own components. Keeps this file
// from restating 65 rows that already have a plane.
const BY_PLANE = {
 "Source": "ingress",
 "Ingress/Egress": "ingress",
 "Processing": "processing",
 "Orchestration": "orchestration",
 "Data Quality": "processing",
 "Foundation": "foundation",
 "Consumers": "processing",
 "Platform": "openshift",
 "Runtime": "openshift",
 "Deployment": "openshift",
 "Operations": "openshift",
 "Event Ingestion": "events",
 "PS-Orchestration": "ingress",
};

// The handful where the plane misleads. G1 and G2 are filed under Data
// Quality but both run inside ingestion, before anything is loaded —
// putting them under Processing would draw the gate in the wrong place.
const OVERRIDE = {
 "23": "ingestion",   // G1 file / structural gate
 "24": "ingestion",   // G2 RAW profiling gate
 "9":  "ingestion",   // file arrival sensors — the completeness check
 "13": "ingestion",   // python ingestion framework
};

export const groupOfTracker = (c) => {
 if (!c) return null;
 if (OVERRIDE[c.id]) return OVERRIDE[c.id];
 if (Number(c.id) >= 101) return "events";
 return BY_PLANE[c.plane] || "foundation";
};

// Which stage a tracker component belongs to, where it belongs to one.
// Only Processing has stages, and only some of its components sit on
// the chain — reconciliation and DQ run across it rather than in it.
const STAGE_OF = {
 "14": "stage1",
 "15": "stage2int",   // one tracker box spanning STG and INT; INT is
                      // the persistent half, so it files there
 "16": "stage2int",
 "17": "stage2int",
 "37": "stage3", "38": "stage3", "39": "stage3", "40": "stage3",
 "41": "stage3", "43": "stage3",
};
export const stageOfTracker = (c) => (c ? STAGE_OF[c.id] || null : null);

export const groupById = (id) => GROUPS.find((g) => g.id === id) || null;
export const stageById = (id) => PROC_STAGES.find((x) => x.id === id) || null;
