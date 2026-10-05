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

// ---------------------------------------------------------------------
// LANES: the named parts inside a container.
//
// A container with a count on it says how much is in there and nothing
// about what. These are the names people actually use for the parts —
// "landing and transport", "the API gateway", "the loader framework",
// "file-based versus event-based" — so the top-level picture answers
// "what is in Ingress?" without a click.
//
// A lane carries its technology because that is usually the real
// question: ingestion is Python, orchestration is Airflow, processing
// is dbt, and the gateway lane is vendor kit nobody here writes.
//
// Membership is by exception. Tracker components name their lane
// below; anything in the container that names none falls into the
// container's last lane, so nothing is lost by forgetting a row.
export const LANES = {
 ingress: [
  { id: "landing", n: "Landing and transport", tech: "SFTP \u00b7 Momentum \u00b7 shared storage",
    sei: ["S1", "S2", "S3", "S4"], reg: ["8"],
    w: "Files arrive on SFTP, Momentum copies the complete ones into a "
     + "Landing Zone every worker pod can see, and Archive and Quarantine "
     + "sit beside it." },
  { id: "gateway", n: "API gateway and Apigee proxy", tech: "vendor",
    sei: [], reg: ["11", "12"],
    w: "The real-time lane. Neither SEI document mentions it \u2014 both are "
     + "batch from end to end \u2014 so nothing here is cited." },
  { id: "loader", n: "Loader framework", tech: "Python \u00b7 outbound",
    sei: [], reg: ["10", "4"],
    w: "Everything going back to SEI: producing a submission, sending it, "
     + "and tracking what came back. Outbound is in neither document." },
  { id: "seisrc", n: "SEI-side source", tech: "SEI",
    sei: [], reg: ["1", "2", "3", "5", "6", "7"],
    w: "SWP itself and what SEI runs around it. Only the platform and the "
     + "files it produces touch this design." },
 ],
 ingestion: [
  { id: "filebased", n: "File-based ingestion", tech: "Airflow \u00b7 Python \u00b7 Oracle",
    sei: ["S5", "S6", "S7", "S8"], reg: ["13", "9", "23"],
    w: "The path both SEI documents describe: a scheduled scan, one mapped "
     + "task per file, validate, load RAW in one transaction, reconcile "
     + "three counts, archive." },
  { id: "eventbased", n: "Event-based ingestion", tech: "proposal",
    sei: [], reg: [],
    w: "Continuous intake rather than a five-minute scan. Proposed by this "
     + "programme's review; not in either document and not in the "
     + "workbook. Its components are in the event container.",
    proposal: true },
  { id: "profiling", n: "RAW profiling", tech: "SQL",
    sei: [], reg: ["24"],
    w: "Looking at what landed before anything is done to it. Not in "
     + "SEI's design \u2014 the first thing that reads a row's content "
     + "there is the STG view." },
 ],
 orchestration: [
  { id: "ingdag", n: "Ingestion DAG", tech: "Airflow 3.0",
    sei: ["S9", "S10", "S11", "S12"], reg: ["18", "22"],
    w: "Owns the business date up to the handoff: evaluate completeness "
     + "and the SLA, take the guarded transition, invoke transformation, "
     + "and recover a trigger that never started." },
  { id: "xfdag", n: "Transformation DAG", tech: "Airflow 3.0 \u00b7 dbt",
    sei: ["S13", "S20"], reg: ["19", "21"],
    w: "Re-checks before it starts, builds the layers in order with a test "
     + "task between each, and advances the date only on full success." },
  { id: "datectl", n: "Business-date state machine", tech: "Oracle",
    sei: [], reg: ["20"],
    w: "DATE_CONTROL: one row per business date, PENDING to TRIGGER to "
     + "COMPLETE, at most one date open at a time." },
 ],
 processing: [
  { id: "dbt", n: "dbt models", tech: "dbt \u00b7 Oracle",
    sei: ["S14", "S15", "S16", "S17"], reg: ["15", "16", "14", "17"],
    w: "The stage chain itself \u2014 the view, the persisted middle and the "
     + "two Gold layers, all as version-controlled SQL." },
  { id: "dq", n: "Data quality and reconciliation", tech: "dbt \u00b7 Splunk",
    sei: ["S18", "S19"], reg: ["25", "26", "27", "28"],
    w: "The row-level pass or fail, the store that holds what failed, the "
     + "replay that clears it, and the counts across four boundaries." },
  { id: "warehouse", n: "Warehouse and consumers", tech: "BBH",
    sei: [], bbh: ["B1", "B2"], reg: ["37", "38", "39", "40", "41", "43"],
    w: "Stage 3 and what reads it. SEI's documents end at DIM and FACT, so "
     + "nothing in this lane is cited." },
 ],
 foundation: [
  { id: "control", n: "Control and metadata", tech: "Oracle",
    sei: [], reg: ["33"],
    w: "The small tables the run depends on: what is expected, what "
     + "arrived, and which date is open." },
  { id: "evidence", n: "Evidence and observability", tech: "Splunk \u00b7 360",
    sei: ["S21"], reg: ["34", "35", "30"],
    w: "Where the run proves what it did. SEI gives every dashboard and "
     + "alert to Splunk; 360 reads the same tables directly." },
  { id: "errors", n: "Errors, audit and lineage", tech: "Python \u00b7 dbt",
    sei: [], reg: ["29", "31"],
    w: "What happens to a bad record, and how a number is traced back to "
     + "the file it came from." },
  { id: "sec", n: "Security and access", tech: "OpenShift \u00b7 Oracle",
    sei: [], reg: ["32", "36"],
    w: "Credentials in secrets, and a loader account that can change rows "
     + "in Gold but cannot create, alter or drop anything." },
 ],
 openshift: [
  { id: "platform", n: "Platform", tech: "OpenShift", sei: [], reg: [],
    w: "Namespaces, images, registry, RBAC, secrets, network policy and "
     + "storage." },
  { id: "runtime", n: "Runtime", tech: "OpenShift", sei: [], reg: [],
    w: "The Airflow deployment, worker pods, quotas, and the Oracle "
     + "connection envelope the pool size is sized against." },
  { id: "deployment", n: "Deployment", tech: "CI/CD", sei: [], reg: [],
    w: "Git-versioned models and DAGs, compiled and tested before "
     + "promotion; rollback is redeploying the prior image." },
  { id: "operations", n: "Operations", tech: "OpenShift", sei: [], reg: [],
    w: "Availability, recovery, monitoring and cost \u2014 none of it in "
     + "either SEI document." },
 ],
};

// OpenShift's lanes are exactly the tracker's own planes, so they are
// derived rather than listed.
const OCP_PLANE = { Platform: "platform", Runtime: "runtime",
 Deployment: "deployment", Operations: "operations" };

export const laneOfTracker = (c, gid) => {
 if (!c) return null;
 if (gid === "openshift") return OCP_PLANE[c.plane] || "platform";
 const ls = LANES[gid] || [];
 const hit = ls.find((l) => (l.reg || []).includes(String(c.id)));
 return hit ? hit.id : (ls.length ? ls[ls.length - 1].id : null);
};
export const lanesOf = (gid) => LANES[gid] || [];
export const laneById = (gid, lid) =>
 (LANES[gid] || []).find((l) => l.id === lid) || null;
