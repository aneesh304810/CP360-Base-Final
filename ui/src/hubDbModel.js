// The database, as one picture, positioned in the flow.
//
// WHY THIS IS NOT A LIST OF TABLES. The pack describes eight objects in
// four different places, and a reader assembling them gets the data path
// but loses the thing that actually matters: which tables carry the data,
// which tables govern whether the data moves, and who writes each one.
// Drawn together, the shape is obvious - a straight data path with a
// small control plane sitting under it, and every control table written
// by exactly one component.
//
// TWO BANDS, NOT ONE DIAGRAM. The data path is what a business reader
// follows. The control plane is what an operator follows at 3am. Mixing
// them produces a diagram neither can read; stacking them lets each
// follow their own row and see where the other touches it.
//
// THE ABSENT ONES ARE ON THE PICTURE. The event path has no registry and
// the outbound path has no submission table. Leaving them off makes the
// database look complete; drawing them dashed is the only honest way to
// show that two of the three inbound and outbound routes have no
// bookkeeping at all.

// ---- the data path: where rows actually live -------------------------
export const DB_PATH = [
 { id: "raw", n: "RAW", tbl: "T4", layer: "Stage 1",
   kind: "table", open: "s1",
   w: "One table per inbound interface, append-only, as delivered.",
   writes: "Python loader", reads: "the STG view" },
 { id: "stg", n: "STG", tbl: null, layer: "Stage 2",
   kind: "view", open: null,
   w: "A view. Stores nothing, recomputed on read, and its job is the "
    + "source DQ check.",
   writes: "nobody - it is a view", reads: "the INT models" },
 { id: "int", n: "INT", tbl: "T5", layer: "Stage 2 INT",
   kind: "table", open: "s2",
   w: "52 canonical tables. The normalised SWP model, PASS rows only, "
    + "partitioned by BUSINESS_DATE and kept seven days.",
   writes: "dbt", reads: "DIM and FACT, and replay" },
 { id: "gold", n: "DIM / FACT", tbl: "T6", layer: "Gold",
   kind: "table", open: null,
   w: "SCD2 dimensions built first, dimension-resolved facts built second.",
   writes: "dbt", reads: "Pre-Gold and consumers" },
 { id: "pre", n: "Pre-Gold", tbl: null, layer: "Pre-Gold",
   kind: "table", open: null,
   w: "A mirror of IMDS and PBDW, so the last step is movement rather "
    + "than transformation.",
   writes: "dbt", reads: "the warehouse load" },
 { id: "wh", n: "Warehouse", tbl: null, layer: "Stage 3",
   kind: "table", open: null,
   w: "The warehouse itself. No reshaping at this boundary.",
   writes: "movement", reads: "the estate" },
];

// ---- the control plane: what decides whether rows move ---------------
export const DB_CONTROL = [
 { id: "cfg", n: "FILE_SCHEMA_CONFIG", tbl: "T1", role: "configuration",
   w: "What is expected: the interfaces, their patterns, their target RAW "
    + "table and whether a zero-row file is allowed.",
   writes: "nobody at run time", reads: "discovery, the loader, the gate" },
 { id: "reg", n: "FILE_REGISTRY", tbl: "T2", role: "what arrived",
   w: "One row per interface per business date, with its counts and its "
    + "lifecycle. ARCHIVED on it is what completeness counts.",
   writes: "the Python loader", reads: "the gate, recovery, evidence" },
 { id: "date", n: "DATE_CONTROL", tbl: "T3", role: "the business date",
   w: "One row per business date. PENDING to TRIGGER to COMPLETE, at most "
    + "one date open at a time.",
   writes: "both DAGs, by guarded update", reads: "every run" },
 { id: "dq", n: "DQ_VALIDATION_FAILURE", tbl: "T7", role: "what failed",
   w: "A row per failing record per rule, with resolution_status and "
    + "whether it is reprocess-eligible.",
   writes: "dbt", reads: "replay, evidence, the DQ screens" },
 { id: "recon", n: "RECON_RESULT", tbl: "T8", role: "what agrees",
   w: "Counts across each boundary per business date. Three boundaries "
    + "are specified; the event path needs more.",
   writes: "dbt", reads: "evidence and sign-off" },
];

// ---- bookkeeping the other two routes do not have --------------------
export const DB_ABSENT = [
 { id: "mb", n: "MICRO_BATCH_REGISTRY", route: "the event path",
   w: "The event path's equivalent of FILE_REGISTRY: one row per "
    + "micro-batch with a state and a count. Without it the gate cannot "
    + "ask whether every micro-batch LOADED, which is half of its "
    + "condition." },
 { id: "sub", n: "LOADER_SUBMISSION", route: "the outbound loader",
   w: "One row per submission threading all four legs, with counts from "
    + "the status API and the id of the error-detail file. Without it a "
    + "reject count has nothing to reconcile against and a batch that "
    + "never comes back never ages out." },
];

// ---- how they touch. kind: flow | writes | governs -------------------
export const DB_LINKS = [
 { from: "raw",  to: "stg",   kind: "flow",   w: "read by" },
 { from: "stg",  to: "int",   kind: "flow",   w: "PASS rows only" },
 { from: "int",  to: "gold",  kind: "flow",   w: "dimensions first" },
 { from: "gold", to: "pre",   kind: "flow",   w: "mirrored" },
 { from: "pre",  to: "wh",    kind: "flow",   w: "moved" },
 { from: "cfg",  to: "reg",   kind: "governs", w: "expected set" },
 { from: "reg",  to: "raw",   kind: "writes",  w: "FILE_REGISTRY_ID on every row" },
 { from: "date", to: "int",   kind: "governs", w: "TRIGGER starts the run" },
 { from: "stg",  to: "dq",    kind: "writes",  w: "fail reasons" },
 { from: "int",  to: "recon", kind: "writes",  w: "STG_TO_INT counts" },
];

export const DB_NOTE =
 "Every control table has exactly one writer. That is the property worth "
 + "keeping: two writers on DATE_CONTROL is how two runs both believe they "
 + "own the business date, and the guarded update exists precisely because "
 + "the design refuses to rely on there being only one.";

export const dbPathById = (id) => DB_PATH.find((x) => x.id === id) || null;
export const dbCtlById = (id) => DB_CONTROL.find((x) => x.id === id) || null;
export const dbNode = (id) => dbPathById(id) || dbCtlById(id);
