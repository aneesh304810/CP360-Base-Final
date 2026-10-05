// Everything that is NOT the SEI baseline, and what to do about it.
//
// The Hub now has two models and they must not be confused again:
//
//   seiBaseline.js         what SEI specified, cited to section and page.
//                          That is the architecture diagram.
//   this file              every other component the programme has on
//                          its books, with an honest verdict on whether
//                          SEI covers it.
//
// A component lands in one of three states, and the middle one is the
// one worth the exercise:
//
//   specified   SEI's documents design this. The baseline carries it;
//               this row exists so the tracker id can be found again.
//   differs     SEI covers the NEED and designs it differently. Not a
//               gap — a reconciliation, and somebody has to pick.
//   absent      neither SEI document mentions it. Not wrong, not
//               approved: it is BBH's to propose, and until somebody
//               does it stays off the diagram.
//
// WHY ABSENT COMPONENTS ARE NOT ON THE DIAGRAM. Drawing them next to
// SEI's boxes is what produced the confusion this replaces: a reader
// could not tell which boxes SEI will build. They are listed here, they
// keep their ids and their design documents, and they go back onto the
// diagram when SEI's documents cover them or BBH formally adopts them.

export const REG_STATE = {
 specified: ["#159943", "SEI specifies this",
   "In the baseline. This row is the cross-reference."],
 differs:   ["#a8560f", "SEI designs it differently",
   "The need is real and SEI's answer is not the one here. Pick one."],
 absent:    ["#6d3ac0", "not in SEI's documents",
   "BBH's to propose. Off the diagram until adopted."],
};

export const REG_ORIGIN = {
 workbook: ["#0b5e83", "SEI-BBH component tracker",
   "From the delivery workbook, generated into seiDesignTracker.js."],
 review:   ["#cc3344", "events-primary review",
   "Proposed by this programme's own review, ids from 101. Never in "
   + "the workbook and never in SEI's documents."],
};

// id -> { st, sei, why }. `sei` names the baseline entries that carry
// it, and a guard checks every one of those ids exists.
export const REGISTRY = {
 // ---- zone 1, SEI-owned source -------------------------------------
 "1":  { st: "specified", sei: ["S1"] },
 "2":  { st: "absent", why: "SWP's own user interface. Neither document describes it." },
 "3":  { st: "absent", why: "The real-time API lane. Both documents are batch, end to end." },
 "4":  { st: "absent", why: "The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all." },
 "5":  { st: "absent", why: "How SEI produces the files. The ingestion document puts file generation outside itself in as many words." },
 "6":  { st: "absent", why: "SEI's own orchestration. Out of scope for both." },
 "7":  { st: "absent", why: "SEI's monitoring surface. Out of scope for both." },

 // ---- ingress and egress -------------------------------------------
 "8":  { st: "specified", sei: ["S2", "S3", "S4"] },
 "9":  { st: "differs", sei: ["S6"],
   why: "SEI does not use arrival sensors. It runs a scheduled scan every "
      + "five minutes and decides completeness at the END of the run, as a "
      + "set difference. A sensor per interface is the pattern it was "
      + "written to avoid." },
 "10": { st: "absent", why: "Outbound to SEI. Neither document has an outbound path." },
 "11": { st: "absent", why: "The API lane. Both SEI documents are batch from end to end — files in, Gold out — and neither mentions a proxy, a gateway or a synchronous call." },
 "12": { st: "absent", why: "The API lane, as above. Nothing in either document describes real-time access to this data." },

 // ---- processing ----------------------------------------------------
 "13": { st: "specified", sei: ["S5", "S6", "S7", "S8"] },
 "14": { st: "specified", sei: ["T4"] },
 "15": { st: "specified", sei: ["S14", "S15", "T5"],
   why: "One tracker component, two SEI objects: STG is a view that stores "
      + "nothing, INT is a table kept seven days." },
 "16": { st: "specified", sei: ["S16", "S17", "T6"],
   why: "One tracker component, two ordered SEI layers — and the tables "
      + "already exist, so dbt populates rather than builds them." },
 "17": { st: "specified", sei: ["S16"],
   why: "SEI gives it the rule it was missing: a closed interval is "
      + "corrected by direct UPDATE, never by MERGE." },

 // ---- orchestration --------------------------------------------------
 "18": { st: "differs", sei: ["S5", "S13"],
   why: "SEI has two DAGs, not one, and no per-domain fan-out: parallelism "
      + "comes from one mapped task per FILE, created at run time." },
 "19": { st: "specified", sei: ["S13", "S16", "S17"] },
 "20": { st: "absent",
   why: "Directly contradicted rather than merely absent: SEI permits one "
      + "non-COMPLETE business date at a time, enforced by a unique index. "
      + "An intraday cadence does not fit that state machine." },
 "21": { st: "differs", sei: ["S18"],
   why: "SEI's replay is not an engine. It is one task at the end of the "
      + "transformation run, driven by the open rows in the DQ store and "
      + "bounded by INT's seven days." },
 "22": { st: "absent",
   why: "SEI has no partial-set path: the transition fires only on an empty "
      + "missing set. Running on what arrived would be a design change." },

 // ---- data quality ----------------------------------------------------
 "23": { st: "specified", sei: ["S8"],
   why: "The ingestion document specifies exactly this: readable, header, "
      + "trailer, zero-row and the date, all before any RAW write, and a "
      + "failure goes to QUARANTINED." },
 "24": { st: "absent",
   why: "Nothing profiles RAW. The first thing that reads a row's content "
      + "in SEI's design is the STG view, already past the load." },
 "25": { st: "specified", sei: ["S13", "S14"] },
 "26": { st: "differs", sei: ["S19"],
   why: "SEI reconciles, but not as a gate. The counts are computed and "
      + "published AFTER the fact build and the verdict is derived in "
      + "Splunk, so a mismatch alerts rather than blocks." },
 "27": { st: "specified", sei: ["S19", "T8"] },
 "28": { st: "specified", sei: ["S18", "T7"] },

 // ---- foundation -------------------------------------------------------
 "29": { st: "differs", sei: ["S4", "T7"],
   why: "Two different quarantines. SEI quarantines FILES before load, and "
      + "for failed ROWS keeps lineage only — no payload copy — on the "
      + "assumption that anything held resolves inside seven days." },
 "30": { st: "specified", sei: ["S19", "T8"] },
 "31": { st: "specified", sei: ["T2", "T3"],
   why: "Business date, run ids, the source record id and the failure "
      + "category are correlated; the control tables are the ledger." },
 "32": { st: "specified", sei: ["S21"],
   why: "Credentials in OpenShift secrets, and the loader account holds "
      + "only the DML it needs — no ALTER, DROP or CREATE." },
 "33": { st: "specified", sei: ["T1", "T2", "T3"] },
 "34": { st: "specified", sei: ["S21"] },
 "35": { st: "absent",
   why: "This catalogue. SEI gives all reporting to Splunk, so 360 reading "
      + "the same tables directly is BBH's addition — defensible, and "
      + "nobody has written down who owns which." },
 "36": { st: "absent", why: "Sign-on for BBH's own tools. Out of scope for both." },

 // ---- zone 3, consumers -------------------------------------------------
 "37": { st: "absent", why: "Downstream of Gold. Both documents stop at Gold." },
 "38": { st: "absent", why: "Downstream of Gold. Both documents stop once DIM and FACT are written, so how IMDS is fed is BBH's to design." },
 "39": { st: "absent", why: "Downstream of Gold, as above — and SEI's design has no notion of a consumer-specific shape at all." },
 "40": { st: "absent", why: "Not built this phase, and not in either document." },
 "41": { st: "absent", why: "Reporting off the warehouse. Outside both documents, which end at the Gold tables." },
 "42": { st: "absent", why: "The real-time lane again. Neither document has a consumer that is not fed from a completed business date." },
 "43": { st: "absent", why: "The existing BBH estate. Both documents describe what arrives and what is built, never who consumes it." },

 // ---- zone 4, the platform ----------------------------------------------
 "44": { st: "absent", why: "Platform build. Neither document covers it." },
 "45": { st: "absent", why: "Container images. Both documents assume OpenShift and neither specifies how images are built or versioned — only that rollback is redeploying the prior one." },
 "46": { st: "absent", why: "Registry, scanning and signing. Not mentioned, and it is the supply-chain half of a design that is otherwise explicit about least privilege." },
 "47": { st: "specified", sei: ["S21"],
   why: "Named, and narrowly: least privilege, and DML only on the Gold "
      + "tables." },
 "48": { st: "specified", sei: ["S21"],
   why: "Oracle, SFTP and storage credentials in OpenShift secrets, "
      + "referenced through Airflow connections." },
 "49": { st: "absent", why: "Network policy and egress. Neither document says what the pipeline is allowed to reach, which matters given it pulls from SFTP and pushes to Splunk." },
 "50": { st: "differs", sei: ["S3"],
   why: "SEI needs one specific thing from storage and states it as an "
      + "assumption: Landing, Archive and Quarantine must be shared across "
      + "worker pods, or mapped tasks cannot reliably read or move files." },
 "51": { st: "specified", sei: ["S5"],
   why: "A starting configuration is given: schedule every five minutes, "
      + "catchup off, one active run, pool 8 to 10, one or two retries." },
 "52": { st: "specified", sei: ["S7"],
   why: "Worker pods are how file-level concurrency scales, bounded by "
      + "pools and Oracle connections." },
 "53": { st: "absent", why: "Resource quotas and priority. The documents give a starting pool size and worker count and leave the cluster-level envelope open — see open decision O2." },
 "54": { st: "absent", why: "Warm start and pre-pulled images. A latency optimisation for a five-minute discovery cycle that neither document considers." },
 "55": { st: "specified", sei: ["S7"],
   why: "Pool size is sized against Oracle connection capacity, and the "
      + "document says the number is a starting position to confirm." },
 "56": { st: "absent", why: "Node placement. Not mentioned, though the shared-storage assumption for Landing, Archive and Quarantine constrains it." },
 "57": { st: "specified", sei: ["S13"],
   why: "Git-versioned models and DAGs; the pipeline compiles and runs unit "
      + "and DQ tests before promotion." },
 "58": { st: "absent", why: "GitOps and ArgoCD. The dbt document says models and DAGs are Git-versioned and promoted as tagged images; it does not name a deployment tool." },
 "59": { st: "specified", sei: ["S13"],
   why: "Rollback is redeploying the prior image, and it is safe only "
      + "because Gold writes are idempotent merges with no DDL." },
 "60": { st: "absent",
   why: "Nothing covers schema change management, which matters more here "
      + "than usual: SEI's design forbids DDL against Gold, so whatever "
      + "does change those tables sits outside it." },
 "61": { st: "absent", why: "Blue-green and canary for the API lane, which neither document has." },
 "62": { st: "absent", why: "Neither document covers availability or recovery of the platform itself." },
 "63": { st: "absent", why: "Backup and restore is not in either document." },
 "64": { st: "differs", sei: ["S21"],
   why: "SEI gives every dashboard, trend and alert to Splunk. A separate "
      + "monitoring stack is a second place for the same job." },
 "65": { st: "absent", why: "Cost and capacity are not in either document." },
};

// The review's own proposals. None of them is in SEI's documents by
// construction — they were written against the gap. Kept whole, kept
// off the diagram, and listed so they are not quietly lost.
export const REG_REVIEW_NOTE =
 "These came from this programme's events-primary review, not from the "
 + "delivery workbook and not from SEI. Ids start at 101 so they can "
 + "never be mistaken for a tracker component. Every one is a proposal: "
 + "it goes on the diagram when SEI's documents cover it or BBH formally "
 + "adopts it, and not before.";

export const regFor = (id) => REGISTRY[id] || null;
export const regStateOf = (id, isReview) =>
 isReview ? "absent" : ((REGISTRY[id] || {}).st || "absent");
export const regCount = (ids, st) =>
 ids.filter((id) => (REGISTRY[id] || {}).st === st).length;

// ---------------------------------------------------------------------
// THE LAYER MODEL, AS BBH STATES IT.
//
// Recorded here and not in the baseline, because the baseline is SEI's
// text and this is not in it. It came from BBH directly, and it differs
// from SEI's reading in a way that matters more than the STG/INT split:
// it changes what the word Gold means.
//
// SEI:  Bronze = SWP_RAW.  Silver = STG + INT.  Gold = approved
//       DIM/FACT, and the design stops there.
// BBH:  Stage 2, Silver and Enriched are three names for ONE layer, and
//       it runs from STG through FACT. STG is a view held in memory
//       whose job is the source DQ check; INT, DIM and FACT together
//       are the NORMALISED SWP DATA MODEL, with reference mapping and
//       translation. Gold proper is a further PRE-GOLD layer shaped as
//       a mirror of IMDS and PBDW, and then a simple movement of that
//       data into the actual warehouse.
//
// So the two models agree on every object up to FACT and disagree on
// what sits above it. SEI publishes from DIM/FACT; BBH publishes from a
// mirror layer SEI's documents do not contain, and the movement step
// after it is not in them either.
export const BBH_LAYERS = {
 note:
"Stage 2, Silver and Enriched are one layer under three names. Inside "
+ "it: STG is a view, held in memory, and its job is the source DQ "
+ "check. INT, DIM and FACT together are the normalised SWP data model, "
+ "with reference mapping and translation applied.",
 beyond:
"Above that sit two layers SEI's documents do not describe: a PRE-GOLD "
+ "layer shaped as a mirror of IMDS and PBDW, and then a simple movement "
+ "of that data into the actual warehouse. SEI's design publishes "
+ "straight from DIM and FACT and stops.",
 why_it_matters:
"It changes what Gold means. In SEI's documents DIM and FACT are the "
+ "approved Gold tables and the end of the line. In BBH's model they are "
+ "the normalised middle, and Gold is the consumer-shaped mirror above "
+ "them. Both cannot be the published contract, and which one is decides "
+ "where reconciliation has to end.",
 src: "BBH, stated directly \u2014 not from either SEI document",
};

// The two layers BBH has that SEI does not. Separate ids so they can
// never be mistaken for a tracker component or a baseline entry.
export const BBH_EXTENSION = [
 { id: "B1", n: "Pre-Gold \u00b7 mirror of IMDS and PBDW", st: "absent",
   w: "Consumer-shaped tables that mirror the warehouses they feed, built "
    + "from the normalised model below them.",
   why: "Neither SEI document has a layer above DIM and FACT. The dbt "
      + "document treats DIM and FACT as the approved Gold tables and "
      + "publishes from there." },
 { id: "B2", n: "Movement into the warehouse", st: "absent",
   w: "A simple data movement from the mirror into the actual warehouse \u2014 "
    + "extract, transport, load, verify. No transformation in flight.",
   why: "SEI's design ends at DIM and FACT. Nothing in either document "
      + "describes moving data onward, or what proves the movement "
      + "arrived intact." },
];
