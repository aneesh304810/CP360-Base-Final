// The CP Integration Hub as SEI has specified it, and nothing else.
//
// WHY THIS FILE EXISTS. The Hub's architecture has been carried by a
// 65-component tracker generated from a BBH workbook, plus 125 design
// documents generated from designs-md. Useful, but BBH-authored and
// much larger than anything SEI has committed to — so a reader could
// not tell which boxes SEI will actually build. The instruction is to
// make SEI's design the base, set the generated BBH material aside,
// and expand later from the gaps.
//
// THE RULE FOR THIS FILE, and it is the whole value of it: nothing goes
// in that is not in one of SEI's two design documents, and everything
// that goes in names the section and page it came from. No inference,
// no "obviously there must also be", no BBH component names. Where SEI
// has not said, the entry is an OPEN DECISION with SEI's own id (O1-O7,
// D1-D6), not a guess.
//
// THE TWO DOCUMENTS DIVIDE THE WORK AT ONE LINE: the ingestion document
// owns everything up to and including the guarded PENDING -> TRIGGER
// update; the transformation document owns everything after it, and
// hands the date back by advancing TRIGGER -> COMPLETE. Both say so
// explicitly, and they agree. That line is the spine of this model.

export const SEI_DOCS = {
 ingest: {
  id: "ingest", short: "File Ingestion design doc",
  title: "BBH File Ingestion Framework Design Document",
  version: "2.0", date: "27 Aug 2026",
  author: "SEI Professional Services",
  stack: "Airflow 3.0 · OpenShift · Oracle RAW · Splunk",
  scope:
"Landing-zone discovery through Oracle RAW load, end-of-run completeness "
+ "and SLA evaluation, the DATE_CONTROL transition, the downstream "
+ "trigger, recovery and monitoring.",
  hands_over:
"Triggers the separate Transformation DAG once the expected file set is "
+ "complete. STG through Gold is not its concern." },
 dbt: {
  id: "dbt", short: "dbt design doc",
  title: "BBH dbt Transformation Design Document",
  version: "2", date: "",
  author: "SEI Professional Services",
  stack: "dbt · Airflow · Oracle · Splunk",
  scope:
"Transformation from SWP_RAW through approved Gold: the STG source-DQ "
+ "view, the INT PASS filter, DIM-before-FACT sequencing and MERGE "
+ "against the pre-existing Gold tables, plus DQ capture, reconciliation "
+ "and publishing to Splunk.",
  hands_over:
"Advances TRIGGER to COMPLETE and seeds the next PENDING business date "
+ "on success. File generation, transfer, discovery, header and trailer "
+ "validation and the RAW load are outside it." },
};

// The handoff, stated by both documents. This is the one thing to read
// first: it is what makes two documents into one design.
export const SEI_BOUNDARY = {
 line: "the guarded PENDING → TRIGGER update on DATE_CONTROL",
 before: "ingest", after: "dbt",
 note:
"The Ingestion DAG owns PENDING → TRIGGER. Only the run whose UPDATE "
+ "changes exactly one row may invoke transformation — that is how two "
+ "scheduled runs five minutes apart cannot both trigger it. The "
+ "Transformation DAG owns TRIGGER → COMPLETE and the creation of the "
+ "next PENDING row, in one database transaction, and it re-checks "
+ "completeness defensively before doing any work.",
 ev: ["File Ingestion design doc §5.1 (p.9)",
      "File Ingestion design doc Appendix E.3 (p.24)",
      "dbt design doc §5.3 (p.12)"],
};

export const SEI_STAGES = [
 { k: "deliver", n: "Delivery",        d: "SFTP → Landing Zone", doc: "ingest" },
 { k: "ingest",  n: "Ingestion",       d: "discover, validate, load RAW", doc: "ingest" },
 { k: "gate",    n: "Completeness and SLA", d: "the handoff", doc: "ingest" },
 { k: "xform",   n: "Transformation",  d: "STG → INT → DIM → FACT", doc: "dbt" },
 { k: "evid",    n: "Evidence",        d: "Oracle logs → Splunk", doc: "both" },
];

// Runtime things SEI names. Not BBH's components — SEI's.
export const SEI_COMPONENTS = [
 { id: "S1", s: "deliver", n: "SWP source files on SFTP", tech: "SEI",
   tbl: [], open: [],
   w: "The files SEI produces for BBH, delivered to an SFTP location.",
   ev: "ingest §3.1 (p.6) · Glossary (p.25)" },
 { id: "S2", s: "deliver", n: "Momentum", tech: "upstream process",
   tbl: [], open: ["O1"],
   w: "Copies COMPLETE SWP files from SFTP into the Landing Zone. The "
    + "word complete is carrying weight: the design assumes a file only "
    + "appears once it is whole, and if that is not true a readiness "
    + "convention such as a final rename or a marker file has to be "
    + "added.",
   ev: "ingest §3.1 (p.6) · §2.1 assumptions (p.5)" },
 { id: "S3", s: "deliver", n: "Landing Zone", tech: "shared storage",
   tbl: [], open: ["O1"],
   w: "Shared storage that Airflow scans for eligible files. Shared is "
    + "load-bearing too — every worker pod has to see the same Landing, "
    + "Archive and Quarantine folders.",
   ev: "ingest Glossary (p.25) · §2.1 (p.5)" },
 { id: "S4", s: "deliver", n: "Archive and Quarantine", tech: "shared storage",
   tbl: [], open: ["O1"],
   w: "Where a file goes after processing. Archive on success, "
    + "Quarantine when validation fails before anything is written.",
   ev: "ingest Figure 1 (p.6) · §4.1 (p.7)" },

 { id: "S5", s: "ingest", n: "Ingestion DAG (one, metadata-driven)", tech: "Airflow 3.0",
   tbl: ["T1", "T2", "T3"], open: ["O2"],
   w: "ONE DAG for every inbound interface, not one per interface. It is "
    + "driven by configuration rows, so a new interface is onboarded by "
    + "adding a row rather than by writing a DAG.",
   ev: "ingest §5 (p.9)" },
 { id: "S6", s: "ingest", n: "Scheduled discovery", tech: "Airflow · every 5 min",
   tbl: ["T1", "T2"], open: ["O6"],
   w: "A scan on a schedule rather than a sensor waiting on each file. "
    + "It reads the active configurations, scans the Landing Zone, "
    + "matches each physical filename to exactly one logical interface "
    + "and parses the business date out of the filename.",
   ev: "ingest §4.1 (p.7) · §9.1 (p.16) · Appendix C.1 (p.21)" },
 { id: "S7", s: "ingest", n: "Mapped file task (one per file)", tech: "Dynamic Task Mapping",
   tbl: ["T2", "T4"], open: ["O2"],
   w: "Airflow creates one task per discovered file at run time, so files "
    + "process independently and in parallel within the pool and Oracle "
    + "connection limits. A file never waits for another interface.",
   ev: "ingest §5 (p.9) · Appendix C.1 (p.21)" },
 { id: "S8", s: "ingest", n: "Python loader", tech: "worker pod",
   tbl: ["T2", "T4"], open: ["O3"],
   w: "Per file: claim the (interface, business date) pair in the "
    + "registry, validate readability, header, trailer, zero-row policy "
    + "and row counts, load the detail rows into the configured RAW "
    + "table in ONE Oracle transaction, reconcile parsed against trailer "
    + "against inserted counts, and commit only when they agree. Then "
    + "move the file and record the outcome.",
   ev: "ingest §3.1 (p.6) · §4.1 (p.7) · §7.3 (p.14)" },

 { id: "S9", s: "gate", n: "Evaluate Completeness and SLA", tech: "Airflow · all_done",
   tbl: ["T1", "T2", "T3"], open: ["O5", "O6"],
   w: "The last task of EVERY ingestion run, including runs that found no "
    + "files at all — which is the point, because yesterday's late file "
    + "can complete the set without a new one arriving today. It compares "
    + "the expected active daily interfaces against the interfaces "
    + "already ARCHIVED for the open business date.",
   ev: "ingest §5.2 (p.10) · Appendix E.2 (p.24)" },
 { id: "S10", s: "gate", n: "Guarded PENDING → TRIGGER", tech: "Oracle UPDATE",
   tbl: ["T3"], open: [],
   w: "A single UPDATE with STATUS='PENDING' in the WHERE clause. If it "
    + "changes one row, this run owns the trigger and invokes "
    + "transformation with the deterministic run id "
    + "transform__<BUSINESS_DATE>. If it changes zero rows, another run "
    + "already did, and this one stops.",
   ev: "ingest Appendix E.3 (p.24) · Appendix C.1 (p.21)" },
 { id: "S11", s: "gate", n: "Trigger-recovery path", tech: "Airflow",
   tbl: ["T3"], open: [],
   w: "For the gap between acquiring TRIGGER and the transformation run "
    + "actually existing. A scheduled check retries when the row says "
    + "TRIGGER, the transformation run id is null and no matching "
    + "deterministic run can be found.",
   ev: "ingest Appendix C.1 (p.21) · Figure 3 (p.10)" },
 { id: "S12", s: "gate", n: "SLA breach and recovery events", tech: "Splunk",
   tbl: ["T3"], open: ["O4", "O5", "O7"],
   w: "Missing files at or after the cutoff: keep PENDING, do not "
    + "trigger, publish a correlated breach alert. Correlation is event "
    + "type plus business date, so a breach raises one alert rather than "
    + "one per five-minute cycle. When the date later completes, publish "
    + "recovery and then trigger.",
   ev: "ingest §5.2 (p.10) · §7.3 (p.14) · Appendix E.6 (p.25)" },

 { id: "S13", s: "xform", n: "Transformation DAG", tech: "Airflow + dbt",
   tbl: ["T3"], open: ["D5"],
   w: "Re-checks completeness and TRIGGER status before doing any work — "
    + "trust but verify — then builds the layers in order, each as a "
    + "build task followed by its own test task.",
   ev: "dbt §5.2 (p.11) · Appendix A.1 (p.25)" },
 { id: "S14", s: "xform", n: "STG — view", tech: "dbt view",
   tbl: ["T4", "T7"], open: [],
   w: "Standardises the source columns and computes a pass or fail "
    + "verdict per row. Stores nothing: it is recomputed on read.",
   ev: "dbt §4.1 (p.10) · §6.3 (p.15)" },
 { id: "S15", s: "xform", n: "INT — 7 days", tech: "dbt incremental",
   tbl: ["T5", "T7"], open: ["D4", "D5"],
   w: "Reads only the rows that passed, maps the code sets, keyed on the "
    + "natural business key plus business date, partitioned, purged by "
    + "partition drop after seven days.",
   ev: "dbt §4.1 (p.10) · §6.5 (p.15)" },
 { id: "S16", s: "xform", n: "DIM — built first", tech: "dbt MERGE",
   tbl: ["T5", "T6"], open: ["D1", "D3"],
   w: "History by direct-compare MERGE into tables that already exist. "
    + "The surrogate key comes from the Oracle sequence already in use. "
    + "No DDL is issued against Gold.",
   ev: "dbt §4.1 (p.10) · §6.4 (p.15)" },
 { id: "S17", s: "xform", n: "FACT — built second", tech: "dbt MERGE",
   tbl: ["T5", "T6", "T7"], open: ["D2"],
   w: "Loads only transactions whose dimension has resolved. A "
    + "transaction whose account has not arrived is never written with a "
    + "placeholder key — it is held and replayed once the dimension "
    + "exists.",
   ev: "dbt §4.1 (p.10) · §7.1 (p.17)" },
 { id: "S18", s: "xform", n: "DQ capture and replay", tech: "dbt",
   tbl: ["T5", "T7"], open: ["D2"],
   w: "Every failing record is written to one store and held at the layer "
    + "that caught it. A step after the fact build picks up the rows that "
    + "can now resolve, loads them and marks them resolved.",
   ev: "dbt §7.1 (p.17) · Appendix A.1 (p.25)" },
 { id: "S19", s: "xform", n: "Reconciliation", tech: "dbt",
   tbl: ["T8", "T7"], open: ["D6"],
   w: "Counts at four boundaries for the business date, written to an "
    + "immutable log and published. The pass or warning verdict is "
    + "derived on the Splunk side, after the data is already in Gold.",
   ev: "dbt §7.2 (p.18) · §7.2.1 (p.18)" },
 { id: "S20", s: "xform", n: "TRIGGER → COMPLETE and seed next", tech: "Oracle",
   tbl: ["T3"], open: [],
   w: "The final task. Advances the date and inserts the next PENDING row "
    + "with its resolved cutoff, in one transaction, only on full "
    + "success. On failure the date stays TRIGGER and no next date is "
    + "created, so the pipeline is locked rather than drifting.",
   ev: "dbt §5.1 (p.11) · ingest §6.3 (p.13) · Appendix E.5 (p.24)" },

 { id: "S21", s: "evid", n: "Splunk", tech: "SEI/BBH",
   tbl: ["T7", "T8"], open: ["O4", "O7", "D6"],
   w: "Owns all dashboards, counts, trending and alerting, for both "
    + "documents. Oracle keeps the durable logs; Splunk reports from the "
    + "events published to it and does the alert correlation.",
   ev: "ingest §8.1 (p.15) · dbt §4.2 (p.10)" },
];

// Oracle objects SEI specifies, with the columns SEI actually gives.
export const SEI_TABLES = [
 { id: "T1", n: "FILE_SCHEMA_CONFIG", doc: "ingest", owner: "ingestion",
   w: "How an active interface is discovered, dated, validated and "
    + "routed. File-level only — there is deliberately no column "
    + "mapping table, because the RAW table DDL is the schema contract.",
   cols: "FILE_NAME (PK) · FILE_NAME_PATTERN · TARGET_RAW_TABLE · "
       + "DELIMITER · HAS_HEADER · HAS_TRAILER · ALLOW_ZERO_ROWS · "
       + "DELIVERY_FREQUENCY · DATE_EXTRACTION_REGEX · "
       + "DATE_EXTRACTION_GROUP · DATE_FORMAT_MASK · IS_ACTIVE · audit",
   ev: "ingest Appendix A (p.18) · §6.1 (p.12)" },
 { id: "T2", n: "FILE_REGISTRY", doc: "ingest", owner: "ingestion",
   w: "The lifecycle record per logical interface and business date. It "
    + "is what makes repeated discovery safe, and ARCHIVED on it is what "
    + "completeness counts.",
   cols: "FILE_REGISTRY_ID (PK) · FILE_NAME + BUSINESS_DATE (unique) · "
       + "SRC_FILE_NAME · FILE_PATH · ARCHIVE_PATH · STATUS · "
       + "FILE_ROW_COUNT · TRAILER_ROW_COUNT · RAW_ROW_COUNT · "
       + "RECEIVED/VALIDATED/LOAD_START/LOAD_END/ARCHIVE_TS · "
       + "RETRY_COUNT · ERROR_CODE · ERROR_DETAIL",
   ev: "ingest Appendix B (p.19) · §6.2 (p.12)" },
 { id: "T3", n: "DATE_CONTROL", doc: "both", owner: "shared",
   w: "The orchestration ledger, and the one object both documents write "
    + "to. One row per business date, at most one row not COMPLETE at a "
    + "time, enforced by a unique index on a CASE expression.",
   cols: "BUSINESS_DATE (PK) · STATUS · SLA_CUTOFF_TS · CREATED_TS · "
       + "TRIGGER_TS · COMPLETE_TS · INGESTION_DAG_RUN_ID · "
       + "TRANSFORMATION_DAG_RUN_ID",
   ev: "ingest Appendix E.1 (p.24) · §6.3 (p.13) · "
     + "dbt Appendix A.2 (p.25)" },
 { id: "T4", n: "RAW tables", doc: "both", owner: "ingestion writes, dbt reads",
   w: "Bronze. Validated detail rows as delivered, tagged with the "
    + "business date and lineage. The dbt document names three: account, "
    + "client and transaction.",
   cols: "per-interface DDL · BUSINESS_DATE · SRC_RECORD_ID and lineage",
   ev: "ingest Glossary (p.25) · dbt §4.1 (p.10)" },
 { id: "T5", n: "INT tables", doc: "dbt", owner: "dbt",
   w: "Silver persistence. Passing rows only, seven days, partitioned by "
    + "business date.",
   cols: "natural key + BUSINESS_DATE (unique) · mapped code sets",
   ev: "dbt §4.1 (p.10) · Appendix A.3 (p.26)" },
 { id: "T6", n: "Gold DIM / FACT", doc: "dbt", owner: "pre-existing",
   w: "Already exist and already carry history from the current system. "
    + "This programme changes only how they are populated.",
   cols: "DIM_ACCOUNT: ACCOUNT_KEY (PK) · ACCOUNT_NUMBER · "
       + "ACCOUNT_TYPE · SITUS_CODE · START_DATE · END_DATE · "
       + "ACTIVE_IND  │  FACT_TRANSACTIONS: TRANSACTION_ID (PK) · "
       + "BUSINESS_DATE · TRANSACTION_AMOUNT · ACCOUNT_KEY",
   ev: "dbt §6.4 (p.15) · §10.1 (p.23)" },
 { id: "T7", n: "DQ_VALIDATION_FAILURE", doc: "dbt", owner: "dbt",
   w: "One store for both failure categories, carrying whether the row "
    + "can replay itself and whether it is still open.",
   cols: "DQ_FAILURE_ID (PK) · DQ_CATEGORY (SOURCE_DQ | "
       + "TRANSFORMATION_DQ) · BUSINESS_DATE · LAYER_NAME (STG | INT | "
       + "DIM | FACT) · MODEL_NAME · BUSINESS_KEY · SRC_RECORD_ID · "
       + "COLUMN_NAME · FAILURE_REASON · REPROCESS_ELIGIBLE · "
       + "RESOLUTION_STATUS · RETRY_COUNT · RESOLVED_TS · DETECTED_TS",
   ev: "dbt §7.1 (p.17)" },
 { id: "T8", n: "RECON_RESULT", doc: "dbt", owner: "dbt",
   w: "One immutable row per boundary per business date, replaced rather "
    + "than updated. No status column — the verdict is derived in "
    + "Splunk.",
   cols: "RECON_ID (PK) · BUSINESS_DATE · BOUNDARY · LEFT_COUNT · "
       + "RIGHT_COUNT · SOURCE_DQ_FILTERED_COUNT · HELD_COUNT · "
       + "HELD_PCT · DIFFERENCE · DETECTED_TS",
   ev: "dbt §7.2.1 (p.18)" },
];

export const SEI_STATES = {
 date_control: {
  n: "DATE_CONTROL", ev: "ingest §5.1 (p.9) · Figure 3 (p.10)",
  rows: [
   ["PENDING", "Open for ingestion, completeness and SLA evaluation.",
    "Seeded by the Transformation DAG when the prior date completes."],
   ["TRIGGER", "All expected files complete; transformation invoked.",
    "Ingestion DAG, by guarded atomic update."],
   ["COMPLETE", "Transformation succeeded; the date is closed.",
    "Transformation DAG, with the next PENDING row in the same transaction."],
  ] },
 file_registry: {
  n: "FILE_REGISTRY", ev: "ingest §7.1 (p.13) · Appendix B.2 (p.20)",
  rows: [
   ["RECEIVED", "Registry claim accepted.", "→ VALIDATED, QUARANTINED or FAILED"],
   ["VALIDATED", "File-level checks passed.", "→ LOADING or FAILED"],
   ["LOADING", "RAW transaction in progress.", "→ ARCHIVED, ARCHIVE_FAILED or FAILED"],
   ["QUARANTINED", "Pre-load validation failed.", "Reuse the record; revalidate a corrected file"],
   ["FAILED", "Technical or RAW-load failure.", "Reuse the record; rerun after verifying RAW state"],
   ["ARCHIVE_FAILED", "RAW committed, the file move failed.", "Retry the move ONLY — never reload RAW"],
   ["ARCHIVED", "RAW verified and the file archived.", "Terminal success. Restatement needs approval"],
  ] },
};

// SEI's own open items, with SEI's own ids. Not BBH's gap list.
export const SEI_OPEN = [
 { id: "O1", doc: "ingest", t: "Confirm Landing Zone, Archive and Quarantine details." },
 { id: "O2", doc: "ingest", t: "Confirm batch SLA, peak timing, representative file sizes and the Oracle connection envelope." },
 { id: "O3", doc: "ingest", t: "Confirm the retention period and purge approach for RAW and FILE_REGISTRY." },
 { id: "O4", doc: "ingest", t: "Confirm Splunk integration, indexing, event format, alert ownership and routing." },
 { id: "O5", doc: "ingest", t: "Confirm the common daily-file SLA time, timezone and holiday/exception override process." },
 { id: "O6", doc: "ingest", t: "Confirm expected-interface criteria and any holiday or month-end rules." },
 { id: "O7", doc: "ingest", t: "Confirm the Splunk correlation key, severity, alert routing and recovery handling." },
 { id: "D1", doc: "dbt", t: "Confirm the existing sequence name and ownership behind the Gold surrogate key." },
 { id: "D2", doc: "dbt", t: "Confirm all missing dimensions resolve inside the seven-day window, and approve the single-table DQ design, the replay policy and the retention-boundary alert." },
 { id: "D3", doc: "dbt", t: "Confirm the current history coverage of the existing dimensions." },
 { id: "D4", doc: "dbt", t: "Confirm no downstream consumer needs STG persisted." },
 { id: "D5", doc: "dbt", t: "Confirm retention units, Oracle partitioning support, volumetrics and run-window targets." },
 { id: "D6", doc: "dbt", t: "Approve the Splunk event schema, masking and PII rules, dashboards and alert thresholds." },
];

// SEI's assumptions, each with what breaks if it is wrong. These are the
// load-bearing ones: an assumption that fails here changes the design,
// not the configuration.
export const SEI_ASSUMPTIONS = [
 { doc: "ingest", a: "Momentum exposes only complete files in the Landing Zone.",
   x: "A readiness convention — final rename or a marker file — has to be enforced." },
 { doc: "ingest", a: "One active interface produces at most one file per business date.",
   x: "The registry uniqueness model needs an extra delivery identifier." },
 { doc: "ingest", a: "BUSINESS_DATE is reliably derivable from the filename.",
   x: "An alternate authoritative date source is required." },
 { doc: "ingest", a: "Landing, Archive and Quarantine are shared across worker pods.",
   x: "Mapped tasks may not consistently read or move files." },
 { doc: "ingest", a: "RAW carries business date and source lineage.",
   x: "Downstream readiness, rerun and traceability become unreliable." },
 { doc: "ingest", a: "Exactly one active non-COMPLETE DATE_CONTROL row exists at a time.",
   x: "Concurrency protection and one-date-at-a-time orchestration depend on it." },
 { doc: "ingest", a: "One common cutoff applies to the whole required daily set.",
   x: "The resolved cutoff is stored per business date on DATE_CONTROL." },
 { doc: "ingest", a: "ARCHIVED is the approved successful state for completeness.",
   x: "The completeness query and the documentation both change." },
 { doc: "ingest", a: "Splunk correlates repeated breach events by business date.",
   x: "Every five-minute run could raise a new alert for the same breach." },
 { doc: "dbt", a: "Account and Client arrive as full daily snapshots.",
   x: "Automatic replay would not apply; those entities need explicit reload." },
 { doc: "dbt", a: "The Gold dimension and fact tables already exist with live history.",
   x: "The no-DDL, direct-compare MERGE approach needs revisiting." },
 { doc: "dbt", a: "The existing Oracle sequence backs the surrogate key and is reusable.",
   x: "A new key strategy is needed to avoid colliding key spaces." },
 { doc: "dbt", a: "Every missing dimension resolves inside the seven-day window.",
   x: "Lineage-only replay fails; a durable payload or longer retention is needed." },
 { doc: "dbt", a: "The Ingestion DAG owns completeness, the transition and the trigger.",
   x: "The handoff moves, for example to a standalone sensor DAG." },
 { doc: "dbt", a: "Splunk owns DQ and reconciliation reporting.",
   x: "A stored status column and a job to maintain it come back." },
 { doc: "dbt", a: "Oracle supports interval partitioning, partition drop and a partial unique index.",
   x: "Retention falls back to DELETE and the single-active-row rule needs another mechanism." },
];

// Things SEI states as deliberately NOT built. Worth their own list,
// because every one of them is a thing somebody will otherwise assume
// is there, and then design around.
export const SEI_NOT_BUILT = [
 { t: "No file sensor, and no cross-interface wait inside a file task.",
   ev: "ingest §5.3 (p.11)" },
 { t: "No checksum-based duplicate comparison.", ev: "ingest §5.3 (p.11)" },
 { t: "No SLA status or alert-sent flag in Oracle — derived at run time, correlated in Splunk.",
   ev: "ingest §5.3 (p.11) · Appendix E.6 (p.25)" },
 { t: "No staging-table layer inside ingestion.", ev: "ingest §5.3 (p.11)" },
 { t: "No dynamic column-mapping configuration — the RAW DDL is the contract.",
   ev: "ingest §5.3 (p.11) · §6.1 (p.12)" },
 { t: "No partial-set path — the guarded transition fires only on an empty missing-set.",
   ev: "ingest §5.2 (p.10)" },
 { t: "No DDL against Gold, and no Gold table created by dbt.",
   ev: "dbt §6.4 (p.15) · §8.4 (p.21)" },
 { t: "No placeholder key in FACT for an unresolved dimension.",
   ev: "dbt §4.1 (p.10)" },
 { t: "No payload copy of a failed record — lineage only, re-derived from INT.",
   ev: "dbt §7.1 (p.17) · §8.2 assumption A4 (p.20)" },
];


// How the objects join. NO FOREIGN KEY IS DECLARED in either document's
// DDL — these are the logical joins the completeness check, the replay
// worklist and the reconciliation models actually run. Worth drawing
// precisely because nothing in the database enforces any of it.
export const SEI_TABLE_LINKS = [
 { a: "T1", b: "T2", on: "FILE_NAME — the logical interface",
   ev: "ingest \u00a76.2 (p.12)" },
 { a: "T3", b: "T2", on: "BUSINESS_DATE — the completeness comparison",
   ev: "ingest Appendix E.2 (p.24)" },
 { a: "T2", b: "T4", on: "FILE_NAME + BUSINESS_DATE — load lineage",
   ev: "ingest \u00a74.1 (p.7)" },
 { a: "T4", b: "T5", on: "SRC_RECORD_ID, through the STG view",
   ev: "dbt \u00a74.1 (p.10) · \u00a76.3 (p.15)" },
 { a: "T4", b: "T7", on: "Source DQ — rows the STG view marks FAIL",
   ev: "dbt \u00a76.3 (p.15)" },
 { a: "T5", b: "T7", on: "Transformation DQ, and the missing-dimension hold",
   ev: "dbt \u00a77.1 (p.17)" },
 { a: "T5", b: "T6", on: "SCD2 MERGE on ACCOUNT_KEY, never the natural key",
   ev: "dbt \u00a76.4.1 (p.15)" },
 { a: "T3", b: "T8", on: "BUSINESS_DATE — one row per boundary per date",
   ev: "dbt \u00a77.2.1 (p.18)" },
 { a: "T3", b: "T7", on: "BUSINESS_DATE",
   ev: "dbt \u00a77.1 (p.17)" },
];

export const SEI_TABLE_LINKS_NOTE =
 "Foreign keys are not declared in either document's DDL. Every line "
 + "above is a join some model or query performs, not a constraint the "
 + "database enforces — so nothing stops a DQ row referencing a "
 + "business date that DATE_CONTROL has never seen.";

export const seiDocOf = (k) => SEI_DOCS[k] || null;
export const seiCompsIn = (stage) => SEI_COMPONENTS.filter((c) => c.s === stage);
export const seiOpenIn = (doc) => SEI_OPEN.filter((o) => o.doc === doc);
