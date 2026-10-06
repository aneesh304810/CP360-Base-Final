// The CP360 consolidated gap and missing-design supplement, as data.
//
// WHAT THIS IS. A merged supplement covering the design areas that were
// missing, fragmented, proposal-only or inconsistent across the corpus:
// eleven architecture domains, a twelve-row gap register, eighteen
// decisions that must close before build completion, twenty-two
// acceptance criteria, a canonical four-tier terminology, nine
// traceability identifiers, and a Stage 2 model inventory with build
// status.
//
// WHY IT IS HELD SEPARATELY FROM THE BASELINE. seiBaseline.js is what
// SEI's documents say. This is a supplement written over the top of them,
// and in several places it CONTRADICTS them - it moves DIM and FACT out
// of Stage 2, renames Stage 3, adds a tier, and uses different file
// lifecycle state names. Merging the two would silently pick a winner.
// They are kept apart and reconciled explicitly in hubGapReconcile.js,
// where each disagreement is named and nothing is quietly resolved.

export const GAP_DOC = {
 n: "CP360 Final Consolidated Gap and Missing Design Specification",
 w: "The authoritative cross-component design supplement, merged from the "
  + "Markdown corpus, the architecture PDFs, the two technical designs, the "
  + "canonical-model references and the sample implementation code.",
 sources: ["all_markdown.md", "CP360_Architecture_Gap_Design_Supplement.md",
  "CP360_Stage2_Silver_Intermediate_Canonical_Model.md",
  "SEI-BBH Integration Architecture v5", "BBH File Ingestion Framework TDD v2.0",
  "BBH dbt Transformation TDD v2", "SEI Data Cloud Event Specification",
  "SWP_BBH Canonical Model with ERD Draft",
  "SWP_BBH Normalized Canonical Data Model v1 Draft", "all_code.txt"],
};

// The eleven domains the supplement scopes itself to.
export const GAP_SCOPE = [
 "Ingress and Egress", "Ingestion", "Orchestration", "Processing",
 "Stage 2 Silver Intermediate Canonical Model", "Stage 3 Pre-Gold Boundary",
 "Foundation", "OpenShift Platform", "SEI Data Cloud Events",
 "Data Quality and Reconciliation",
 "Security, Audit, Lineage, HA and DR",
];

// Precedence when components conflict. Worth holding as data because the
// answer to "which document wins" is asked constantly and guessed at.
export const GAP_PRECEDENCE = [
 "Approved architecture decision records in the CP360 design corpus",
 "This gap supplement, for the subjects it explicitly covers",
 "The current File Ingestion and dbt Transformation technical designs",
 "Integration architecture material",
 "Older component summaries, drafts and proposal-only artifacts",
];

// THE FOUR-TIER MODEL. This is the single most consequential thing in the
// supplement and it is not what the app has been drawing.
export const GAP_TIERS = [
 { tier: "Stage 1", n: "RAW",
   w: "Source-faithful Oracle persistence with ingestion lineage." },
 { tier: "Stage 2", n: "Enriched",
   w: "dbt standardization, DQ, conforming, enrichment and intermediate "
    + "persistence." },
 { tier: "Stage 3", n: "Pre-Gold",
   w: "Oracle Exadata consumer-oriented transformations, dimensions, facts "
    + "and control-total preparation." },
 { tier: "Consumer Movement", n: "Publish and delivery",
   w: "Extract, transport, load and verify, with no transformation in "
    + "flight." },
];

export const GAP_REGISTER = [
 { id: "GAP-01", g: "No single master view joins inbound, outbound, foundation and platform architecture", d: "Add consolidated architecture and responsibility boundaries", dom: "Processing" },
 { id: "GAP-02", g: "Business capability view is incomplete", d: "Add a capability model across ingress, ingestion, orchestration, processing, foundation and runtime", dom: "Processing" },
 { id: "GAP-03", g: "Ingress and egress component responsibilities are fragmented", d: "Add Landing, Momentum/SFTP, API Gateway, Apigee, Loader Framework, callbacks and source boundaries", dom: "Ingress and Egress" },
 { id: "GAP-04", g: "OpenShift is named but not designed as a platform domain", d: "Add runtime topology, deployment, secret, storage, scaling, CI/CD and operations contracts", dom: "OpenShift Platform" },
 { id: "GAP-05", g: "Foundation services are spread across many documents", d: "Add a canonical control, metadata, evidence, audit, security, observability and lineage model", dom: "Foundation" },
 { id: "GAP-06", g: "DATE_CONTROL and file lifecycles lack one canonical state view", d: "Add state machines, transition ownership, guards and recovery behaviour", dom: "Orchestration" },
 { id: "GAP-07", g: "SDC event architecture is not integrated into CP360", d: "Add event taxonomy, payload handling, idempotency, retrieval, replay and marker-event gating", dom: "SEI Data Cloud Events" },
 { id: "GAP-08", g: "Stage 2 to Stage 3 cross-database movement is under-specified", d: "Add movement pattern, controls, replay boundary and reconciliation", dom: "Stage 3 Pre-Gold Boundary" },
 { id: "GAP-09", g: "Identifiers are inconsistent across components", d: "Add canonical traceability identifiers and propagation rules", dom: "Foundation" },
 { id: "GAP-10", g: "HA/DR and graceful degradation are proposal-level", d: "Add requirements, recovery scope and validation expectations", dom: "Security, Audit, Lineage, HA and DR" },
 { id: "GAP-11", g: "Logical relationships among control and processing entities are not consolidated", d: "Add logical ERDs", dom: "Foundation" },
 { id: "GAP-12", g: "Architecture-level acceptance criteria are missing", d: "Add measurable design completion criteria", dom: "Processing" },
];

// Nine identifiers, and the propagation rule is the part that gets lost.
export const GAP_IDENTIFIERS = [
 ["PROJECT_ID", "CP360 project or catalog scope", "Applied to metadata and catalog entities where multiple projects coexist"],
 ["FILE_ID", "Physical or logical file lifecycle", "Created in FILE_REGISTRY and referenced by loaded RAW rows"],
 ["LOAD_ID", "One ingestion or load execution", "Preserved from RAW through Stage 2, Stage 3, replay and publish evidence"],
 ["SRC_RECORD_ID", "Source record within a delivery", "Preserved on record-level lineage where available"],
 ["BUSINESS_DATE", "Processing and partition date", "Present in RAW, INT, control, DQ, reconciliation and publish evidence"],
 ["DAG_RUN_ID", "Airflow execution", "Recorded in control and operational evidence"],
 ["CORRELATION_ID", "Cross-component request or workflow", "Propagated through Hub, orchestration, API and loader execution, callback and monitoring"],
 ["IDEMPOTENCY_KEY", "Duplicate prevention for requests", "Stable across retries of the same business operation"],
 ["EVENT_ID", "SEI Data Cloud event definition", "Retained with event-processing evidence and consumer outcome"],
];

// Foundation entities the supplement adds beyond the eight the baseline
// holds. The last three are the ones with no table anywhere today.
export const GAP_FOUNDATION = [
 ["FILE_SCHEMA_CONFIG", "Active interface definition, filename matching, parsing, validation, RAW target", true],
 ["FILE_REGISTRY", "File lifecycle, counts, status, timestamps, business date, lineage", true],
 ["DATE_CONTROL", "Durable business-date state machine, SLA cutoff, DAG run traceability", true],
 ["DQ_VALIDATION_FAILURE", "Source and Transformation DQ failures and resolution state", true],
 ["RECON_RESULT", "Immutable reconciliation result per date, model and control", true],
 ["Workflow metadata", "Workflow definitions, step ordering, routing, dependencies, retry policy", false],
 ["API configuration", "Endpoint, authentication reference, timeout, retry, response mapping", false],
 ["Schema registry", "Versioned file and API contracts and compatibility metadata", false],
];

// The outbound workflow ERD. This is the answer to the missing submission
// registry the loader screen flags.
export const GAP_OUTBOUND_ERD = [
 ["WORKFLOW_DEFINITION", "contains", "WORKFLOW_STEP_DEFINITION"],
 ["WORKFLOW_DEFINITION", "instantiates", "WORKFLOW_INSTANCE"],
 ["WORKFLOW_INSTANCE", "executes", "WORKFLOW_STEP_INSTANCE"],
 ["WORKFLOW_INSTANCE", "invokes", "API_CALL"],
 ["WORKFLOW_INSTANCE", "submits", "LOADER_DELIVERY"],
 ["API_CALL", "reports", "STATUS_EVENT"],
 ["LOADER_DELIVERY", "reports", "STATUS_EVENT"],
];

// Seven reconciliation boundaries. The pack specified three.
export const GAP_RECON = [
 "physical file rows versus parsed rows",
 "header and trailer count versus parsed rows",
 "parsed rows versus committed RAW rows",
 "RAW PASS plus DQ failures versus applicable source scope",
 "Stage 2 source versus Stage 3 inserted and rejected scope",
 "dimension and fact load counts and business control totals",
 "Pre-Gold publish scope versus consumer delivery and acknowledgement",
];

export const GAP_MOVEMENT = {
 n: "Stage 2 to Stage 3, across databases",
 w: "Database-link or approved direct-path movement from Stage 2 Oracle to "
  + "Stage 3 Exadata, preserving LOAD_ID, BUSINESS_DATE, source keys and "
  + "reconciliation attributes. Full reload may use the approved bulk "
  + "mechanism. CDC or GoldenGate only for an approved intraday requirement.",
 gate: "Reconciliation PASS authorises the publish scope. FAIL holds the "
     + "publish and preserves the replay scope.",
 replay: "Scoped by approved business date and load lineage. Replay must not "
       + "create duplicate active dimension rows or duplicate fact rows.",
};

export const GAP_DECISIONS = [
 ["DEC-GAP-01", "Approve canonical Stage 1, Stage 2, Stage 3 and Consumer Movement terminology", "arch"],
 ["DEC-GAP-02", "Confirm the Landing file-readiness convention", "arch"],
 ["DEC-GAP-03", "Confirm unknown-file and ambiguous-match exception locations", "arch"],
 ["DEC-GAP-04", "Confirm the Stage 2 to Stage 3 default transfer mechanism and fallback bulk load", "arch"],
 ["DEC-GAP-05", "Confirm event consumer persistence and duplicate-detection key", "arch"],
 ["DEC-GAP-06", "Confirm OpenShift namespace, tenancy, scaling and shared-storage model", "arch"],
 ["DEC-GAP-07", "Confirm schema registry ownership and compatibility policy", "arch"],
 ["DEC-GAP-08", "Confirm Integration360 versus Splunk evidence ownership by event family", "arch"],
 ["DEC-GAP-09", "Approve HA topology and component-level RTO and RPO", "arch"],
 ["DEC-GAP-10", "Confirm correction and historical replay rules for each consumer", "arch"],
 ["SILVER-DEC-01", "Confirm the canonical entity inventory and ownership by domain", "silver"],
 ["SILVER-DEC-02", "Confirm the canonical business key for each entity", "silver"],
 ["SILVER-DEC-03", "Confirm whether Stage 2 stores daily snapshots, effective-dated history, or a combination by entity", "silver"],
 ["SILVER-DEC-04", "Confirm the standard lineage columns available in every RAW source", "silver"],
 ["SILVER-DEC-05", "Confirm Oracle schemas for STG, INT, DQ and reconciliation objects", "silver"],
 ["SILVER-DEC-06", "Confirm retention and partition-management rules by Stage 2 entity", "silver"],
 ["SILVER-DEC-07", "Confirm the location and naming of Stage 3 and publish models", "silver"],
 ["SILVER-DEC-08", "Confirm whether generic INT_REFERENCE stays generic or is decomposed into typed models", "silver"],
];

export const GAP_ACCEPTANCE = [
 ["arch", "Every architecture component is assigned to one canonical domain and tier"],
 ["arch", "Every business-date transition has one owner, guard and persisted evidence record"],
 ["arch", "Every file lifecycle state has an entry rule, exit rule, retry rule and operational event"],
 ["arch", "Stage 2 to Stage 3 movement preserves LOAD_ID and BUSINESS_DATE and has a reconciliation gate"],
 ["arch", "No Source or Transformation DQ failure progresses without approved resolution"],
 ["arch", "Dimension processing completes and passes its tests before dependent facts are built"],
 ["arch", "Every API, loader, workflow and SDC event is traceable by correlation or event identifier"],
 ["arch", "Gateway, orchestration, ingestion, transformation and publishing failures are distinguishable in evidence"],
 ["arch", "OpenShift deployments use versioned images, external config, secrets, health checks and controlled promotion"],
 ["arch", "Security-sensitive changes, replay actions and manual state interventions are audited"],
 ["arch", "HA/DR requirements and runbooks are approved and tested before production readiness"],
 ["arch", "Component Markdown links to this supplement rather than defining conflicting alternatives"],
 ["silver", "Every source interface maps to one or more STG views"],
 ["silver", "Every STG PASS record maps to a canonical model or a documented non-persisted disposition"],
 ["silver", "Every canonical entity has an approved grain and business key"],
 ["silver", "Every incremental model has a deterministic unique key including BUSINESS_DATE"],
 ["silver", "Every canonical relationship has a defined DQ rule"],
 ["silver", "Every model preserves available load and file lineage"],
 ["silver", "Every model has not-null, uniqueness and applicable relationship tests"],
 ["silver", "Stage 2 reconciliation is recorded for every business date"],
 ["silver", "Consumer-specific models are outside the Stage 2 folder"],
 ["silver", "A failed Stage 2 test or reconciliation prevents Stage 3 publication"],
];

// Build status from the supplement's model inventory. "sample" means it
// exists in the supplied code; everything else is a target. Keyed by the
// canonical table name used in hubStage2Model so the two can be joined.
export const GAP_BUILD_STATUS = {
 ACCOUNT:                 "sample-expand",
 ACCOUNT_OPTIONAL_FIELDS: "sample",
 ASSET:                   "sample-expand",
 TAXLOT:                  "sample",
 TRANSACTION_HEADER:      "sample-expand",
 TRANSACTION_DETAIL:      "sample-expand",
 REFERENCE:               "sample",
};
export const BUILD_LABEL = {
 "sample":        ["Implemented", "present in the supplied code sample"],
 "sample-expand": ["Implemented, expansion required",
                   "present in the code sample but mapped to fewer attributes than the canonical model defines"],
 "target":        ["Target", "proposed from the canonical model, not yet implemented"],
};
export const buildStatus = (tbl) => GAP_BUILD_STATUS[tbl] || "target";
export const BUILD_SUMMARY = () => {
 const vals = Object.values(GAP_BUILD_STATUS);
 return { sample: vals.filter((v) => v === "sample").length,
   expand: vals.filter((v) => v === "sample-expand").length,
   implemented: vals.length };
};

// One concrete code finding, named in the supplement.
export const GAP_CODE_FINDING = {
 model: "int_bbh_open_trade_star",
 w: "Joins Account, Asset, Reference, Tax Lot, Transaction Header and "
  + "Transaction Detail into a denormalised, target-oriented layout, and "
  + "sits in the Stage 2 intermediate folder.",
 why: "Consumer-oriented denormalisation in Stage 2 is what stops Stage 2 "
    + "being reusable: the next consumer needs a different shape and gets "
    + "a second star beside the first.",
 fix: "Relocate to models/pre_gold/trades/pg_bbh_open_trade.sql, or to "
    + "models/publish/imds/pub_bbh_open_trade_star.sql.",
};

export const GAP_NAMING = [
 ["RAW table", "RAW_<SOURCE_ENTITY>", "RAW_TRANSACTION_HEADER"],
 ["STG view", "STG_<SOURCE_ENTITY>", "STG_TRANSACTION_HEADER"],
 ["Canonical INT model", "INT_<CANONICAL_ENTITY>", "INT_TRANSACTION_HEADER"],
 ["Pre-Gold model", "PG_<BUSINESS_OUTPUT>", "PG_BBH_OPEN_TRADE"],
 ["Publish model", "PUB_<CONSUMER>_<OUTPUT>", "PUB_IMDS_BBH_OPEN_TRADE"],
 ["DQ model", "DQ_<ENTITY>_<RULE_GROUP>", "DQ_TRANSACTION_RELATIONSHIP"],
 ["Reconciliation model", "RECON_<LAYER>_<ENTITY>", "RECON_INT_TRANSACTION_HEADER"],
];

export const GAP_HADR_OPEN = [
 "availability-zone and site topology for the Integration Hub and OpenShift runtime",
 "Oracle and Exadata replication and failover approach",
 "Airflow metadata database protection",
 "persistent storage backup and restore",
 "RTO and RPO per platform component",
 "failover ownership and operational communication",
 "periodic restore tests and DR game-day evidence",
];
