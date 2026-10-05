// SEI-BBH Integration Architecture v5 — the third SEI document.
//
// The baseline so far has been built from SEI's two DESIGN documents:
// the File Ingestion Framework and the dbt Transformation Framework.
// This is the ARCHITECTURE, also SEI's, and it is a different kind of
// document: it names the objects end to end, the feed types and what
// each one does to Gold, and the systems either side of the Hub.
//
// IT DOES NOT AGREE WITH THEM, and that is the most useful thing on
// this page. The design documents describe three RAW tables and a
// Silver made of STG plus INT; the architecture describes seven RAW
// tables and a Stage 2 made of five STG2_* tables, and a Gold with
// two facts the design documents never mention. Those are not
// different words for one design. They are different designs, and
// something has to give before anyone writes a model.
//
// Kept in its own file rather than folded into the baseline, because
// merging them would be exactly the silent reconciliation this whole
// exercise exists to avoid.

export const SEI_ARCH_DOC = {
 id: "arch", short: "Integration Architecture",
 title: "SEI-BBH Integration Architecture",
 version: "5", author: "SEI",
 scope:
"End to end: the source files and their types, Python ingestion into "
+ "RAW, dbt into Stage 2 and Gold, the existing Oracle warehouse "
+ "tables, and the consumption layer. Plus the system-integration view "
+ "of what sits either side of the Hub.",
};

// The source side, by feed type. This is the part the design documents
// do not have at all, and it decides what every Gold object does.
export const ARCH_FEEDS = [
 { k: "full", n: "Full snapshot", sub: "the entire table, every day",
   files: ["Account Snapshot", "Client Snapshot", "Tax Lot Snapshot"],
   pattern: "SCD2 / periodic snapshot",
   gold: "DIM_ACCOUNT and DIM_INTERESTED_PARTY as SCD2; FACT_TAX_LOT "
       + "appended by date" },
 { k: "delta", n: "Delta", sub: "new or changed records today",
   files: ["Transaction Delta", "Position Delta"],
   pattern: "incremental / merge",
   gold: "FACT_TRANSACTIONS and FACT_CP_HOLDINGS, both merged" },
 { k: "corr", n: "Correction", sub: "past records corrected today",
   files: ["Corrected Transactions", "Corrected Positions"],
   pattern: "merge, updating what is already there",
   gold: "FACT_TRANSACTIONS and FACT_CP_HOLDINGS, same two facts" },
];

export const ARCH_LAYERS = [
 { k: "ingest", n: "Python ingestion", tech: "Python + Oracle",
   w: "File validation, data profiling, audit and lineage, metadata "
    + "capture — file name, date, row count — then load to RAW.",
   objects: [],
   note: "cx_Oracle, SQL*Loader or external tables" },
 { k: "raw", n: "RAW (SWP)", tech: "Python-managed, append only",
   w: "Immutable. Stored exactly as received, nothing cleaned.",
   objects: ["RAW_ACCOUNT", "RAW_CLIENT", "RAW_TAXLOT", "RAW_TRANSACTION",
             "RAW_POSITION", "RAW_CORRECTED_TRANSACTION",
             "RAW_CORRECTED_POSITION"],
   cols: "LOAD_ID · BUSINESS_DATE · FILE_DATE · FILE_NAME · ROW_NUM · "
       + "LOAD_TIMESTAMP · SOURCE_SYSTEM · INGESTION_STATUS",
   note: "materialisation N/A, managed by Python; load type append only" },
 { k: "stg2", n: "Stage 2", tech: "dbt · table",
   w: "Business integration: standardise, integrate the corrections, "
    + "apply business rules and lookups, produce business-ready data.",
   objects: ["STG2_ACCOUNT", "STG2_INTERESTED_PARTY", "STG2_TAX_LOT",
             "STG2_TRANSACTIONS", "STG2_CP_HOLDINGS"],
   steps: ["Data standardisation", "Data type conversion", "Deduplication",
           "Correction file integration", "Reference and lookup joins",
           "Business rule validations", "Derived attributes",
           "Latest record selection"],
   note: "materialised as a table; full refresh daily, or incremental" },
 { k: "gold", n: "Gold", tech: "dbt · existing Oracle DW tables",
   w: "The enterprise business model, ready for reporting and analytics. "
    + "These tables already exist.",
   objects: ["DIM_ACCOUNT (SCD2)", "DIM_INTERESTED_PARTY (SCD2)",
             "FACT_TRANSACTIONS (merge)", "FACT_CP_HOLDINGS (merge)",
             "FACT_TAX_LOT (periodic snapshot)"],
   note: "incremental; SCD2, merge or append depending on the object" },
 { k: "consume", n: "Consumption", tech: "BI",
   w: "Power BI, Tableau, reports, analytics, business users.",
   objects: [] },
];

export const ARCH_ORCHESTRATION =
 ["File arrival", "Python ingestion (RAW)", "dbt Stage 2", "dbt Gold",
  "Data quality checks", "Notifications and alerts"];

export const ARCH_PRINCIPLES = [
 "RAW is immutable and append only",
 "Stage 2 is business integrated and reusable",
 "Gold is business ready",
 "Audit and lineage end to end",
];

// ---------------------------------------------------------------------
// WHERE SEI'S OWN DOCUMENTS DISAGREE WITH EACH OTHER.
// Every row is a thing someone has to decide before a model is written.
export const ARCH_CONFLICTS = [
 { id: "C1", t: "Three RAW tables, or seven",
   arch: "RAW_ACCOUNT, RAW_CLIENT, RAW_TAXLOT, RAW_TRANSACTION, "
       + "RAW_POSITION, RAW_CORRECTED_TRANSACTION, RAW_CORRECTED_POSITION.",
   doc: "The dbt design document names three: account, client and "
      + "transaction. Position, tax lot and the two correction tables "
      + "do not appear in it at all.",
   why: "Four of the seven feeds have no transformation designed for "
      + "them. If the architecture is right, the design document covers "
      + "under half the inbound surface." },
 { id: "C2", t: "Stage 2 as five tables, or as STG plus INT",
   arch: "Five STG2_* tables, materialised as tables, full refresh daily "
       + "or incremental.",
   doc: "A STG view that stores nothing, plus an INT table kept seven "
      + "days and partitioned.",
   why: "Not a naming difference. One stores Stage 2 and one does not, "
      + "and the retention, the replay window and the reconciliation "
      + "boundaries all follow from which it is." },
 { id: "C3", t: "Two Gold facts, or three",
   arch: "FACT_TRANSACTIONS, FACT_CP_HOLDINGS and FACT_TAX_LOT, each "
       + "with its own strategy — merge, merge and periodic snapshot.",
   doc: "FACT_TRANSACTIONS only.",
   why: "Holdings and tax lot are the two the design document is silent "
      + "on, and a periodic snapshot is a different pattern from a "
      + "merge — it is not covered by the SCD2 and merge logic that is "
      + "specified." },
 { id: "C4", t: "Corrections as files, or as a rule",
   arch: "Two correction files arrive daily and Stage 2 has a named "
       + "step, correction file integration, that merges them.",
   doc: "Correction is a MERGE-versus-UPDATE rule applied inside the "
      + "dimension build. No correction file is described.",
   why: "The architecture has corrections entering as data; the design "
      + "document has them as a write strategy. Both may be needed, but "
      + "nobody has said how a correction file reaches the rule." },
 { id: "C5", t: "Where data quality runs",
   arch: "A Data Quality Checks step after dbt Gold in the Airflow "
       + "chain.",
   doc: "A per-row pass or fail computed in the STG view, before "
      + "anything is loaded, plus tests between every layer.",
   why: "Before or after publication is the whole question. The "
      + "architecture's position puts the check after Gold is written, "
      + "which is where reconciliation already sits and is already a "
      + "known gap." },
];

// ---------------------------------------------------------------------
// OUTBOUND. Stated by BBH, and the first concrete outbound contract in
// any of this — the design documents have no outbound path at all.
export const OUTBOUND_FLOW = {
 n: "Loader submission, via the Orchestration Hub",
 src: "BBH, stated directly — not in either SEI design document",
 example: "a consumer submitting through a loader file, with Pivotal CRM "
        + "as the worked example",
 steps: [
  { n: 1, a: "CRM → Hub",
    t: "The Orchestration Hub exposes an API. CRM calls it with the "
     + "loader details and the data the loader needs." },
  { n: 2, a: "Hub",
    t: "The Hub validates what it was given and transforms it into "
     + "loader format." },
  { n: 3, a: "Hub → SEI PS",
    t: "SEI Professional Services processes the loader." },
  { n: 4, a: "Hub → CRM",
    t: "CRM exposes an API of its own, and the Hub calls it with the "
     + "response." },
 ],
 note:
"Two APIs, one each way, and the Hub owns validation and the format. "
+ "That makes the Hub responsible for a contract neither SEI design "
+ "document mentions: what a valid submission looks like, what happens "
+ "to an invalid one, and what the response carries when SEI rejects a "
+ "loader rather than the Hub.",
};

// ---------------------------------------------------------------------
// INBOUND POSTURE. Stated by BBH, and it reverses what the design
// documents assume.
export const INBOUND_POSTURE = {
 primary: "SDC events",
 secondary: "file-based",
 src: "BBH, stated directly",
 note:
"Both SEI design documents describe the file path and only the file "
+ "path — a scheduled scan every five minutes, one mapped task per "
+ "file, completeness measured as a set of files that arrived. If "
+ "events are the primary inbound route, the completeness gate, the "
+ "business-date state machine and the SLA all rest on a path that is "
+ "the secondary one.",
 consequence:
"This does not make the event components a proposal any more. It makes "
+ "them the primary path with no design document behind them, which is "
+ "a sharper problem and a different one.",
};

export const archConflictCount = () => ARCH_CONFLICTS.length;
