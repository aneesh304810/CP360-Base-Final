// Citation map — design component → the section of an SEI document that governs it.
//
// Hand-maintained. `tools/ingest_sei_docs.py` regenerates seiSourceDocs.js from
// the PDFs; it never touches this file. The two are joined at render time on
// (doc, section), so a citation survives a re-ingest and a missing document
// degrades to the summary here rather than to a blank pane.
//
// `kind` carries the point:
//   governs   — this section specifies the component
//   partial   — the section touches it but does not specify it
//   conflict  — the section and this codebase's design disagree
//   absent    — nothing in the pack covers it, and the nearest analogue is named
//
// An `absent` citation is not a placeholder. It is the evidence for the gap,
// and it names the section that would have been its counterpart had the pack
// covered the event or outbound path.

export const SEI_SOURCE_INDEX = {
  "file-ingestion-tdd": {
    title: "BBH File Ingestion Framework TDD",
    version: "2.0",
    expect: "file-ingestion-tdd-v2.0.pdf",
    covers: "Discovery, registry, state machine, completeness, SLA, recovery — the file path end to end.",
  },
  "dbt-transformation-tdd": {
    title: "BBH dbt Transformation TDD",
    version: "2",
    expect: "dbt-transformation-tdd-v2.pdf",
    covers: "RAW to STG to INT to DIM and FACT, SCD2, hold-and-replay, reconciliation boundaries.",
  },
  "integration-architecture": {
    title: "SEI-BBH Integration Architecture",
    version: "5",
    expect: "integration-architecture-v5.pdf",
    covers: "Node map, zones, source systems, transport lanes.",
  },
  "build-spec": {
    title: "Codex Build Specification & Data Model",
    version: "",
    expect: "build-spec.pdf",
    covers: "Parts A/B/C, the P-marked schema proposals, grants.",
  },
};

// keyed by tracker id (the original 65) or AR id (the 23 additions)
export const SEI_CITATIONS = {
  /* ---------------- Ingress / Egress ---------------- */
  "8": [
    { doc: "file-ingestion-tdd", section: "6", kind: "governs",
      what: "Transport and the landing zone: Momentum SFTP into the landing zone, retention, directory layout." },
    { doc: "file-ingestion-tdd", section: "C.3", kind: "conflict",
      what: "Discovery every five minutes by filename pattern, with rules for one match, none, many, zero files and an existing key.",
      conflict: "This codebase designs a manifest written last plus deferrable sensors verifying size and mtime. The pack has no manifest at all. Two different transport contracts with the same upstream party." },
  ],
  "9": [
    { doc: "file-ingestion-tdd", section: "C.1", kind: "governs",
      what: "The three-task DAG: discover_work_items, process_file.expand(...), evaluate_completeness_and_sla under trigger_rule='all_done'." },
    { doc: "file-ingestion-tdd", section: "C.4", kind: "partial",
      what: "Three guardrails, of which 'no large file contents through XCom' is the one that constrains the loader's shape." },
  ],
  "10": [
    { doc: "integration-architecture", section: "front", kind: "partial",
      what: "Node 12 places the Apigee proxy on the outbound path." },
    { doc: "file-ingestion-tdd", section: "front", kind: "absent",
      what: "The pack is entirely inbound. There is no outbound section, no submission contract, no acknowledgement model and no error return path anywhere in any of the documents." },
  ],
  "11": [
    { doc: "integration-architecture", section: "front", kind: "partial",
      what: "Node 12, the Apigee proxy, on both the submit and status-return paths. Whether it is a decision or a placeholder is open as AD-3." },
  ],

  /* ---------------- Processing ---------------- */
  "13": [
    { doc: "file-ingestion-tdd", section: "C.1", kind: "governs",
      what: "The ingestion framework's shape: discover, process per file via dynamic task mapping, then evaluate completeness." },
    { doc: "file-ingestion-tdd", section: "C.2", kind: "governs",
      what: "The work-item dict: file_name, src_file_name, business_date, target_raw_table, file_path, delimiter, has_header, has_trailer, allow_zero_rows." },
  ],
  "14": [
    { doc: "file-ingestion-tdd", section: "6.1", kind: "governs",
      what: "FILE_SCHEMA_CONFIG holds file-level metadata only and no column mapping, which makes the RAW DDL the schema contract." },
    { doc: "dbt-transformation-tdd", section: "Appendix E", kind: "governs",
      what: "The medallion canvas: SWP files to SWP_RAW (Bronze), then STG, INT, DIM and FACT." },
  ],
  "15": [
    { doc: "dbt-transformation-tdd", section: "Appendix E", kind: "conflict",
      what: "STG is a view, recomputed on read. INT is Silver, primary key natural key plus BUSINESS_DATE, seven-day retention.",
      conflict: "This codebase names a Stage 2 Enriched layer and a Pre-Gold Exadata tier that the pack does not have. The layer models have to be reconciled before either document is a build spec." },
  ],
  "16": [
    { doc: "dbt-transformation-tdd", section: "B.3", kind: "governs",
      what: "dim_account.sql — SCD2 by direct compare rather than snapshot, incremental merge on account_key, on_schema_change='fail'. The change predicate lists only account_type and situs_code." },
    { doc: "dbt-transformation-tdd", section: "B.4", kind: "governs",
      what: "int_transaction_for_fact.sql — ephemeral, never persisted. Assembles today's INT rows plus the OPEN replay worklist, then resolves dimension keys and stamps MISSING_DIMENSION_KEY." },
  ],
  "17": [
    { doc: "dbt-transformation-tdd", section: "Appendix C", kind: "partial",
      what: "The twelve-scenario runbook, including reprocessing an already-closed row by direct UPDATE and never MERGE." },
    { doc: "file-ingestion-tdd", section: "D.3", kind: "partial",
      what: "Approved restatement — the procedure exists and names no approver." },
    { doc: "dbt-transformation-tdd", section: "front", kind: "absent",
      what: "Nothing defines the downstream semantics of an event op=D, and nothing defines an outbound correction. Both are written for a file world." },
  ],

  /* ---------------- Orchestration ---------------- */
  "18": [
    { doc: "file-ingestion-tdd", section: "C.1", kind: "governs",
      what: "Deterministic transformation run id transform__<BUSINESS_DATE>, plus a scheduled reconciliation path that retries when STATUS='TRIGGER', TRANSFORMATION_DAG_RUN_ID IS NULL and no matching deterministic run exists." },
  ],
  "19": [
    { doc: "dbt-transformation-tdd", section: "B.4", kind: "governs",
      what: "Dimension before fact, with fact_transactions.sql taking only dq_reason IS NULL and dq_int_txn_missing_dim.sql reading the failures off the same join, so the two cannot disagree." },
  ],
  "20": [
    { doc: "file-ingestion-tdd", section: "C.3", kind: "absent",
      what: "The pack has a five-minute discovery loop and no intraday cadence model, no intraday SLA and no definition of 'behind' during the day. Its only clock is the EOD cutoff." },
  ],
  "21": [
    { doc: "file-ingestion-tdd", section: "D.1", kind: "governs",
      what: "FAILED rerun — reuse the existing registry record." },
    { doc: "file-ingestion-tdd", section: "D.4", kind: "conflict",
      what: "Restatement requires a dbt rebuild or rerun for a date already processed.",
      conflict: "C.1 mandates transform__<BUSINESS_DATE> and that run already succeeded, so Airflow refuses. C.1's reconciliation path fires only when no matching run exists — the opposite case. The run-id rule and the recovery procedure cannot both be satisfied as written." },
  ],
  "22": [
    { doc: "file-ingestion-tdd", section: "C.4", kind: "partial",
      what: "Discovery guardrails and partial-batch behaviour for files. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one." },
  ],

  /* ---------------- Data quality ---------------- */
  "23": [
    { doc: "file-ingestion-tdd", section: "6.1", kind: "governs",
      what: "has_header, has_trailer and allow_zero_rows — the structural contract G1 checks against." },
  ],
  "25": [
    { doc: "dbt-transformation-tdd", section: "B.4", kind: "governs",
      what: "dq_reason stamped on the same join the fact model filters, so tests and the fact table cannot diverge." },
  ],
  "26": [
    { doc: "dbt-transformation-tdd", section: "B.5", kind: "governs",
      what: "recon_result with left_count, right_count, source_dq_filtered_count, held_count, held_pct and difference." },
  ],
  "27": [
    { doc: "dbt-transformation-tdd", section: "B.5", kind: "governs",
      what: "No status column: PASS and WARNING are derived in Splunk and deliberately not stored." },
  ],
  "28": [
    { doc: "dbt-transformation-tdd", section: "B.4", kind: "governs",
      what: "dq_validation_failure with resolution_status and reprocess_eligible='Y', driving the OPEN replay worklist." },
    { doc: "file-ingestion-tdd", section: "front", kind: "absent",
      what: "No rule registry anywhere. The gates exist as code, so which rules ran against which model on which date is unanswerable, and blocking-versus-advisory is a global argument rather than a per-rule attribute." },
  ],

  /* ---------------- Foundation ---------------- */
  "29": [
    { doc: "file-ingestion-tdd", section: "D.2", kind: "governs",
      what: "QUARANTINED recovery for a file." },
    { doc: "file-ingestion-tdd", section: "D.6", kind: "governs",
      what: "Stale in-progress recovery — a registry row left at LOADING past the timeout." },
    { doc: "file-ingestion-tdd", section: "front", kind: "absent",
      what: "No event dead-letter and no outbound quarantine. With at-least-once delivery and ordering inside a partition, one unprocessable envelope stalls that partition permanently and redelivery keeps returning it." },
  ],
  "30": [
    { doc: "dbt-transformation-tdd", section: "B.5", kind: "partial",
      what: "Three boundaries — STG_TO_INT, INT_TO_DIM, INT_TO_FACT — all downstream of Stage 1 and all inbound.",
      conflict: "Nine more are needed: four upstream on the event path and five outbound. Without the upstream four, event loss is undetectable by construction, because STG_TO_INT ties perfectly against a Stage 1 that is itself short." },
  ],
  "31": [
    { doc: "file-ingestion-tdd", section: "6.2", kind: "partial",
      what: "FILE_REGISTRY unique on FILE_NAME plus BUSINESS_DATE, with RETRY_COUNT." },
    { doc: "file-ingestion-tdd", section: "Appendix F", kind: "conflict",
      what: "The glossary says FILE_REGISTRY is versioned per interface and date with one current version.",
      conflict: "§6.2's unique key gives exactly one row; D.1 and D.5 reuse it and D.4 deletes it. History survives only as RETRY_COUNT. Either the schema gains version history or the glossary line goes." },
  ],
  "32": [
    { doc: "build-spec", section: "A12", kind: "partial",
      what: "Grants: the loader gets DML on RAW and the registry, and DML-only on Gold.",
      conflict: "No consumer grant is described anywhere, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account." },
  ],
  "33": [
    { doc: "file-ingestion-tdd", section: "6.1", kind: "partial",
      what: "FILE_SCHEMA_CONFIG — the only configuration store in the pack, and it covers file metadata only." },
  ],
  "34": [
    { doc: "file-ingestion-tdd", section: "8.1", kind: "partial",
      what: "Thirteen operational signals, files_discovered through transformation_triggered." },
    { doc: "file-ingestion-tdd", section: "E.6", kind: "conflict",
      what: "Splunk contract for four events, correlation key of event type plus business date, and an explicit prohibition on adding SLA_STATUS, SLA_BREACH_IND or ALERT_SENT_IND to DATE_CONTROL.",
      conflict: "Nine of the thirteen signals have no payload contract, and none of the thirteen covers the event channel — the primary ingestion path has no observability contract at all." },
  ],

  /* ---------------- the date and the gate ---------------- */
  "M8": [
    { doc: "file-ingestion-tdd", section: "E.2", kind: "absent",
      what: "The completeness gate is expected active DAILY interfaces MINUS distinct ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED, so this query returns nothing meaningful and the pack proposes no replacement." },
    { doc: "file-ingestion-tdd", section: "E.1", kind: "partial",
      what: "UX_DATE_CONTROL_ACTIVE, a function-based unique index on CASE WHEN STATUS <> 'COMPLETE' THEN 1 END. One line, and it is what physically enforces a single active date." },
  ],
  "M9": [
    { doc: "file-ingestion-tdd", section: "front", kind: "absent",
      what: "No SEI status API is described anywhere — no endpoint, no auth, no pagination, no rate limits, no retention window for reject detail." },
  ],

  /* ---------------- the event path: absent by definition ---------------- */
  "M1": [{ doc: "file-ingestion-tdd", section: "C.1", kind: "absent",
    what: "C.1 is the file path's equivalent: a scheduled DAG that discovers work. The event path's listener has no counterpart section in any document." }],
  "M4": [{ doc: "file-ingestion-tdd", section: "C.2", kind: "absent",
    what: "C.2 defines the file work item. Nothing defines a collapsed key set, and the file path has no equivalent problem." }],
  "M5": [{ doc: "dbt-transformation-tdd", section: "Appendix E", kind: "absent",
    what: "The canvas starts at SWP_RAW. How rows get there under events — a set-based pull per view per micro-batch — is not described anywhere." }],
  "M6": [{ doc: "file-ingestion-tdd", section: "C.1", kind: "absent",
    what: "The file loader runs once per file per day. A continuous micro-batch loader with one commit per box has no counterpart." }],
  "M7": [{ doc: "dbt-transformation-tdd", section: "B.4", kind: "absent",
    what: "B.4 handles a fact whose dimension is missing, via hold-and-replay. It does not order domains, and SEI assigns cross-domain dependency to the consumer in writing." }],
  "M10": [{ doc: "file-ingestion-tdd", section: "front", kind: "absent",
    what: "Event Hub sequence numbers are monotonic per partition, so a gap is a provably lost event — the strongest completeness proof available, and no document mentions it." }],
  "M11": [{ doc: "file-ingestion-tdd", section: "C.4", kind: "absent",
    what: "C.4 validates a file's structure before load. Nothing validates an envelope, so an unknown view or an invalid op reaches the collapser." }],
  "M12": [{ doc: "file-ingestion-tdd", section: "6.2", kind: "absent",
    what: "FILE_REGISTRY is the file path's record of receipt. The event path has no staging store specified — and it is entirely BBH-owned, so nobody outside BBH will write it." }],
  "M13": [{ doc: "file-ingestion-tdd", section: "6.2", kind: "absent",
    what: "The event channel's FILE_REGISTRY. Micro-batch boxing is per partition, and nothing records which partitions reported." }],
  "M14": [{ doc: "file-ingestion-tdd", section: "front", kind: "absent",
    what: "SEI states at-least-once delivery and assigns idempotency to the consumer. No component in the pack accepts it." }],
  "M15": [{ doc: "file-ingestion-tdd", section: "D.2", kind: "absent",
    what: "D.2 recovers a QUARANTINED file. There is no event equivalent, so a poison envelope has no escape route." }],
  "M16": [{ doc: "file-ingestion-tdd", section: "8.1", kind: "absent",
    what: "The thirteen signals are all file-shaped. Consumer lag — the only intraday health signal there is — appears in none of them." }],

  /* ---------------- the outbound path: absent by definition ---------------- */
  "M2": [{ doc: "file-ingestion-tdd", section: "front", kind: "absent",
    what: "No receiver is described. SEI pushes loader status into an endpoint BBH defines, and nothing in the pack defines it." }],
  "M3": [{ doc: "file-ingestion-tdd", section: "6.2", kind: "absent",
    what: "FILE_REGISTRY is the inbound record of a file. The outbound path has no submission registry, so a submission that never reached SEI is indistinguishable from one that succeeded." }],
  "M19": [{ doc: "integration-architecture", section: "front", kind: "absent",
    what: "The 24 loader templates live in Data 360, not in the design pack. No section covers template versioning or the change protocol, and v1.24, v1.21 and v9 are live together." }],
  "M20": [{ doc: "file-ingestion-tdd", section: "C.4", kind: "absent",
    what: "C.4 is the inbound structural gate. G1 to G5 all face inbound; nothing validates a loader before it is published, so today the first validator of a BBH loader is SEI." }],
  "M21": [{ doc: "file-ingestion-tdd", section: "front", kind: "absent",
    what: "Nothing records what was sent. A rejection names records in a payload nobody kept." }],
  "M22": [{ doc: "file-ingestion-tdd", section: "D.2", kind: "absent",
    what: "D.2 quarantines an inbound file. Rejected outbound records have nowhere to go and no defined route back." }],
  "M23": [{ doc: "dbt-transformation-tdd", section: "B.5", kind: "absent",
    what: "B.5's three boundaries are inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent on the way out is invisible." }],
  "M17": [{ doc: "file-ingestion-tdd", section: "6.1", kind: "absent",
    what: "§6.1 makes the RAW DDL the schema contract by holding no column mapping, and Gold runs on_schema_change='fail'. No section describes how a schema change is notified, with what lead time or what compatibility rule." }],
  "M18": [{ doc: "file-ingestion-tdd", section: "5.2", kind: "absent",
    what: "§5.2 leans on required-versus-optional interfaces twice, and §6.1's field list has no such column. EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND remain proposals." }],

  /* ---------------- platform ---------------- */
  "55": [
    { doc: "file-ingestion-tdd", section: "C.1", kind: "partial",
      what: "Dynamic task mapping spawns a worker pod per work item, each opening its own connections. Pool sizing is not stated." },
  ],
  "62": [
    { doc: "file-ingestion-tdd", section: "D.1", kind: "absent",
      what: "D.1 to D.6 are data-correction procedures. There is no disaster recovery section in any document — no RPO, no RTO, no failover for Oracle, OpenShift or the landing zone." },
  ],
};

export const CITE_KIND = {
  governs: ["#159943", "specifies this component"],
  partial: ["#a8560f", "touches it, does not specify it"],
  conflict: ["#cc3344", "the pack and this design disagree"],
  absent: ["#6d3ac0", "nothing in the pack covers it"],
};
