// Foundation framework — what the SEI pack provides, and the data models it
// does not. Four areas the pack leaves without a structure: error, status,
// data quality and guardrails.
//
// The distinction that matters: the pack provides TABLES, not a FRAMEWORK. It
// specifies FILE_REGISTRY, DATE_CONTROL, FILE_SCHEMA_CONFIG, RECON_RESULT and
// DQ_VALIDATION_FAILURE precisely, and each is sound in isolation. What it does
// not provide is anything that spans them — no shared error vocabulary, no
// canonical status, no rule registry, no place thresholds live. Every component
// therefore invents its own, which is how four error vocabularies already exist
// in one pipeline.

export const FM_SUMMARY = {
  title: "Foundation framework — the four models the pack does not have",
  line:
    "The SEI pack specifies five control tables and specifies them well. None of them is a framework: " +
    "nothing spans domains, so error codes, status values, DQ rules and thresholds are each invented at " +
    "the call site. Eleven tables close that, plus one extension to a table the pack already has.",
};

export const FM_AREAS = {
  ERROR: ["Error", "#cc3344", "one vocabulary instead of four"],
  STATUS: ["Status", "#0b5e83", "canonical state, and a rule that terminal never regresses"],
  DQ: ["Data quality", "#a8560f", "rules as data, and evidence that a rule ran"],
  GUARD: ["Guardrails", "#6d3ac0", "thresholds and limits as configuration, not code"],
};

export const FM_STATE = {
  exists: ["#159943", "in the SEI pack"],
  extend: ["#a8560f", "extend what the pack has"],
  new: ["#cc3344", "no equivalent anywhere"],
};

/* ------------------------------------------------------------------ *
 * What the pack already provides — stated first, so the gap is fair   *
 * ------------------------------------------------------------------ */
export const FM_PROVIDED = [
  { name: "FILE_REGISTRY", area: "STATUS",
    what: "Seven-state per-file lifecycle, unique on logical FILE_NAME + BUSINESS_DATE, with RETRY_COUNT.",
    limit: "STATUS has no check constraint, so a value outside the documented state machine is accepted silently. The lifecycle is file-only; micro-batches and submissions get nothing." },
  { name: "DATE_CONTROL", area: "STATUS",
    what: "PENDING to TRIGGER to COMPLETE, one active row enforced by UX_DATE_CONTROL_ACTIVE, a guarded update where SQL%ROWCOUNT = 1 decides the owner.",
    limit: "Genuinely good, and file-shaped: completeness is expected DAILY interfaces MINUS distinct ARCHIVED. Under events there is no interface to count." },
  { name: "FILE_SCHEMA_CONFIG", area: "DQ",
    what: "File-level metadata: delimiter, header, trailer, target RAW table, allow_zero_rows.",
    limit: "Holds no column mapping by design, which makes the RAW DDL the schema contract. Nothing versions that contract or watches it change." },
  { name: "DQ_VALIDATION_FAILURE", area: "DQ",
    what: "Row-level failures with dq_reason, resolution_status and reprocess_eligible, driving hold-and-replay on MISSING_DIMENSION_KEY.",
    limit: "Records failures only. Zero rows means either every rule passed or no rule ran, and the schema cannot tell those apart." },
  { name: "RECON_RESULT", area: "DQ",
    what: "Three boundaries with left_count, right_count, source_dq_filtered_count, held_count, held_pct and difference.",
    limit: "No status column by deliberate choice — PASS and WARNING are derived in Splunk. So the threshold that produced a verdict is never stored, and two consumers can disagree about the same date with no way to adjudicate." },
];

/* ------------------------------------------------------------------ *
 * The models the pack does not have                                   *
 * ------------------------------------------------------------------ */
export const FM_TABLES = [
  /* ---------------- ERROR ---------------- */
  { name: "ERROR_CATALOG", area: "ERROR", state: "new", grain: "one row per error code",
    purpose: "The error vocabulary, as reference data rather than string literals at call sites.",
    why: "Four vocabularies already exist in one pipeline — FILE_REGISTRY.STATUS, dq_reason, Airflow task_fail and the Splunk event name — with no mapping between them. Nothing can report 'all errors today' because there is no definition of an error.",
    cols: [
      ["ERROR_CODE", "VARCHAR2(60) PK", "stable, never reused"],
      ["ERROR_DOMAIN", "VARCHAR2(20)", "EVENT | FILE | TRANSFORM | OUTBOUND | PLATFORM"],
      ["SEVERITY", "VARCHAR2(10)", "FATAL | ERROR | WARN"],
      ["DISPOSITION", "VARCHAR2(20)", "QUARANTINE | DEAD_LETTER | HOLD_REPLAY | RETRY | FAIL_BATCH | LOG_ONLY"],
      ["IS_BLOCKING", "CHAR(1)", "whether it stops the batch"],
      ["MAX_ATTEMPTS", "NUMBER(3)", "bounded retry — the Replay engine has no limit today"],
      ["OWNER_TEAM", "VARCHAR2(40)", "who is paged"],
      ["EFFECTIVE_FROM / TO", "DATE", "codes change meaning; verdicts must stay reproducible"],
    ],
    notes: ["Seed it from the thirteen Splunk signals, the FILE_REGISTRY states and the dq_reason values already in use, so nothing is invented and nothing is lost."] },

  { name: "ERROR_EVENT", area: "ERROR", state: "new", grain: "one row per error occurrence, all domains",
    purpose: "Every error instance in one place, whatever produced it.",
    why: "Today an error is a registry status, a DQ row, an Airflow task_fail or a log line. A single exception list over the estate cannot be built from four shapes with four lifecycles.",
    cols: [
      ["ERROR_EVENT_ID", "NUMBER PK", "sequence"],
      ["ERROR_CODE", "VARCHAR2(60) FK", "→ ERROR_CATALOG"],
      ["BUSINESS_DATE", "DATE", "partition key"],
      ["SUBJECT_TYPE", "VARCHAR2(20)", "ENVELOPE | MICROBATCH | FILE | MODEL | SUBMISSION | TASK"],
      ["SUBJECT_ID", "VARCHAR2(200)", "the natural key of what failed"],
      ["CORRELATION_ID", "VARCHAR2(200)", "micro-batch id, dag_run_id or submission id"],
      ["ATTEMPT_NO", "NUMBER(3)", "against ERROR_CATALOG.MAX_ATTEMPTS"],
      ["OCCURRED_TS", "TIMESTAMP", ""],
      ["DETAIL", "CLOB", "redacted on write, never business keys in clear"],
      ["RESOLUTION_STATUS", "VARCHAR2(12)", "OPEN | RESOLVED | WAIVED | EXPIRED"],
      ["RESOLVED_TS / RESOLVED_BY", "TIMESTAMP / VARCHAR2(60)", ""],
    ],
    notes: [
      "Range-partition by BUSINESS_DATE with local indexes; it is the highest-insert table in Foundation.",
      "Index (BUSINESS_DATE, RESOLUTION_STATUS) and (SUBJECT_TYPE, SUBJECT_ID).",
    ] },

  { name: "EVENT_DEAD_LETTER", area: "ERROR", state: "new", grain: "one row per unprocessable envelope",
    purpose: "The event path's quarantine. Holds the envelope, its position and why it could not be processed.",
    why: "At-least-once delivery with ordering guaranteed inside a partition means a single unprocessable envelope blocks everything behind it, for ever, and redelivery keeps bringing it back. Component 29 quarantines files; nothing quarantines an event.",
    cols: [
      ["DEAD_LETTER_ID", "NUMBER PK", ""],
      ["TOPIC / PARTITION / OFFSET", "VARCHAR2 / NUMBER / NUMBER", "unique together — also the replay dedupe key"],
      ["SEQUENCE_NUMBER", "NUMBER", "for gap detection after a discard"],
      ["ENQUEUED_TS / RECEIVED_TS", "TIMESTAMP", "the two clocks lag is measured between"],
      ["RAW_ENVELOPE", "BLOB", "encrypted at rest, masked on read"],
      ["ERROR_CODE", "VARCHAR2(60) FK", "unknown view, invalid op, key not found, pull timeout, unparseable"],
      ["ATTEMPT_COUNT", "NUMBER(3)", ""],
      ["STATUS", "VARCHAR2(12)", "HELD | REPLAYED | DISCARDED"],
    ],
    notes: ["A DISCARDED row must keep SEQUENCE_NUMBER, or the gap detector reports a loss that was a deliberate decision."] },

  { name: "OUTBOUND_ERROR", area: "ERROR", state: "new", grain: "one row per rejected record per submission",
    purpose: "Rejections, from both sides: what G6 refused to send, and what SEI refused to accept.",
    why: "ERROR_SOURCE is the column that earns its place. A record BBH blocked before sending and a record SEI rejected are different failures with different owners, and collapsing them makes the outbound reconciliation unreadable.",
    cols: [
      ["SUBMISSION_ID", "VARCHAR2(60) FK", "→ LOADER_SUBMISSION"],
      ["RECORD_KEY", "VARCHAR2(200)", "the business key in the rejected record"],
      ["ATTRIBUTE_NAME", "VARCHAR2(100)", "null for a whole-record reject"],
      ["ERROR_SOURCE", "VARCHAR2(20)", "BBH_VALIDATION (G6) | SEI_REJECT"],
      ["NATIVE_CODE", "VARCHAR2(60)", "SEI's code, verbatim"],
      ["ERROR_CODE", "VARCHAR2(60) FK", "normalised — never silently mapped"],
      ["TEMPLATE_VERSION", "VARCHAR2(20)", "the version in force at generation"],
      ["FETCHED_TS", "TIMESTAMP", "when detail was pulled, for the retention deadline"],
    ],
    notes: ["Fetched once on reaching terminal-with-errors and stored. If SEI purges detail after a window, this table is the system of record."] },

  /* ---------------- STATUS ---------------- */
  { name: "STATUS_DOMAIN", area: "STATUS", state: "new", grain: "one row per (domain, native status)",
    purpose: "Every state machine in the estate, declared as data, with its canonical mapping.",
    why: "FILE_REGISTRY.STATUS has no check constraint. DATE_CONTROL has its own vocabulary, micro-batches will have a third and submissions a fourth. SORT_ORDER makes 'terminal never regresses' something the database can enforce rather than a convention each component re-implements.",
    cols: [
      ["STATUS_DOMAIN_CODE", "VARCHAR2(20)", "FILE | DATE | MICROBATCH | SUBMISSION | DQ_FAILURE"],
      ["NATIVE_STATUS", "VARCHAR2(30)", "as the owning system writes it"],
      ["NORMALIZED_STATUS", "VARCHAR2(20)", "PENDING | IN_PROGRESS | COMPLETE | FAILED | HELD | TERMINAL_ERROR"],
      ["IS_TERMINAL", "CHAR(1)", ""],
      ["SORT_ORDER", "NUMBER(3)", "monotonic — a lower value can never overwrite a higher one"],
      ["PK", "(STATUS_DOMAIN_CODE, NATIVE_STATUS)", ""],
    ],
    notes: ["An unmapped native value raises rather than defaulting to the nearest neighbour. Silent mapping is how a status board stops being trusted."] },

  { name: "STATUS_TRANSITION", area: "STATUS", state: "new", grain: "one row per allowed transition",
    purpose: "Which moves are legal, and which need a human.",
    why: "D.4 requires an 'approved restatement' and never names an approver. This is where approval becomes a control rather than a convention.",
    cols: [
      ["STATUS_DOMAIN_CODE / FROM_STATUS / TO_STATUS", "PK", ""],
      ["REQUIRES_APPROVAL", "CHAR(1)", "restatement, waiver, force-complete"],
      ["APPROVER_ROLE", "VARCHAR2(40)", ""],
    ],
    notes: ["An illegal transition is an ERROR_EVENT, not an exception swallowed in application code."] },

  { name: "STATUS_HISTORY", area: "STATUS", state: "new", grain: "append-only, one row per transition",
    purpose: "Every state change in the estate, with where the change came from.",
    why: "SOURCE is what makes the outbound push-and-poll model work. Two writers land on one status field, and without recording which one wrote it, a retried PROCESSING notification arriving after a COMPLETED poll walks the status backwards and fires a false exception.",
    cols: [
      ["STATUS_HISTORY_ID", "NUMBER PK", ""],
      ["STATUS_DOMAIN_CODE / SUBJECT_ID", "VARCHAR2", "what changed"],
      ["BUSINESS_DATE", "DATE", "partition key"],
      ["FROM_STATUS / TO_STATUS", "VARCHAR2(30)", ""],
      ["SOURCE", "VARCHAR2(12)", "SYSTEM | CALLBACK | POLL | MANUAL"],
      ["CHANGED_TS / CHANGED_BY", "TIMESTAMP / VARCHAR2(60)", ""],
    ],
    notes: [
      "Current status is derived, not stored twice: the latest POLL at or after the newest CALLBACK, otherwise the highest SORT_ORDER reached.",
      "This subsumes LOADER_STATUS_HISTORY — build one table, not one per domain.",
    ] },

  /* ---------------- DATA QUALITY ---------------- */
  { name: "DQ_RULE", area: "DQ", state: "new", grain: "one row per rule per version",
    purpose: "The rules themselves, as data: which gate, what scope, blocking or advisory, at what threshold.",
    why: "The gates G1 to G5 exist as code with no registry, so 'which rules ran against this model' is unanswerable and 'blocking versus advisory' is a global argument instead of a per-rule attribute. IS_BLOCKING settles that open decision one rule at a time.",
    cols: [
      ["DQ_RULE_ID", "NUMBER PK", ""],
      ["RULE_CODE", "VARCHAR2(60)", "unique within EFFECTIVE window"],
      ["GATE", "VARCHAR2(4)", "G0 | G1 | G2 | G3 | G4 | G5 | G6"],
      ["SCOPE", "VARCHAR2(16)", "ENVELOPE | FILE | ROW | MODEL | BATCH | SUBMISSION"],
      ["TARGET_OBJECT", "VARCHAR2(120)", "table, model or loader type"],
      ["RULE_TYPE", "VARCHAR2(20)", "NOT_NULL | DOMAIN | REFERENTIAL | CONTROL_TOTAL | PROFILE | CUSTOM_SQL"],
      ["EXPRESSION", "CLOB", ""],
      ["IS_BLOCKING", "CHAR(1)", "per rule, not per gate"],
      ["THRESHOLD_PCT", "NUMBER(5,2)", "failure rate tolerated before the verdict turns"],
      ["COST_CLASS", "VARCHAR2(10)", "ROW | SET — decides per micro-batch or at the EOD gate"],
      ["EFFECTIVE_FROM / TO", "DATE", ""],
    ],
    notes: ["COST_CLASS is what stops the 288x problem being rediscovered: row-level rules run per micro-batch, set-level rules run at the gate."] },

  { name: "DQ_RUN_RESULT", area: "DQ", state: "new", grain: "one row per rule per run",
    purpose: "Evidence that a rule ran, and what it found — including when it found nothing.",
    why: "This is the largest single gap in the pack's DQ model. DQ_VALIDATION_FAILURE records failures only, so zero rows means either every rule passed or no rule ran. Those are opposite facts and nothing can tell them apart. A gate that silently did not execute is indistinguishable from a clean night.",
    cols: [
      ["DQ_RUN_ID", "NUMBER PK", ""],
      ["DQ_RULE_ID", "NUMBER FK", ""],
      ["BUSINESS_DATE / MICROBATCH_ID", "DATE / VARCHAR2(60)", "micro-batch null for gate-level runs"],
      ["RUN_TS / DURATION_MS", "TIMESTAMP / NUMBER", "also the cost evidence for B5"],
      ["ROWS_EVALUATED / ROWS_PASSED / ROWS_FAILED", "NUMBER", "must tie"],
      ["VERDICT", "VARCHAR2(8)", "PASS | WARN | FAIL | NOT_RUN"],
      ["THRESHOLD_IN_FORCE", "NUMBER(5,2)", "the value applied, copied at run time"],
      ["UNIQUE", "(DQ_RULE_ID, BUSINESS_DATE, MICROBATCH_ID)", ""],
    ],
    notes: [
      "NOT_RUN is a real verdict and must be written, not inferred from absence.",
      "THRESHOLD_IN_FORCE is why a verdict stays defensible three months later after the threshold moved.",
    ] },

  { name: "DQ_VALIDATION_FAILURE", area: "DQ", state: "extend", grain: "existing — one row per failing record",
    purpose: "Keep as specified; add three columns.",
    why: "The table is well designed. It cannot currently be joined to the rule that produced it, tied to a micro-batch, or sorted by how long a held row has left before the 7-day retention removes it from FACT for ever.",
    cols: [
      ["DQ_RULE_ID", "NUMBER FK", "ADD — ties a failure to its rule"],
      ["MICROBATCH_ID", "VARCHAR2(60)", "ADD — which box produced it"],
      ["DAYS_TO_EXPIRY", "NUMBER GENERATED", "ADD — virtual, from BUSINESS_DATE and the INT retention window"],
    ],
    notes: ["DAYS_TO_EXPIRY is probably the highest-value derived number in the estate: past it, a held transaction is silently gone from FACT."] },

  /* ---------------- GUARDRAILS ---------------- */
  { name: "GUARDRAIL_POLICY", area: "GUARD", state: "new", grain: "one row per policy per scope per version",
    purpose: "Every threshold and limit in the platform, in one versioned place.",
    why: "The recon DIFFERENCE threshold is described as 'the number that drives the alert' and lives as TBC in config/thresholds.yml in the pipeline team's repository. Any second consumer either reads that file or disagrees with the portal about the same business date.",
    cols: [
      ["POLICY_CODE", "VARCHAR2(60) PK", ""],
      ["SCOPE / SCOPE_KEY", "VARCHAR2(16) / VARCHAR2(120)", "GLOBAL | DOMAIN | INTERFACE | LOADER_TYPE"],
      ["POLICY_TYPE", "VARCHAR2(30)", "RECON_TOLERANCE | SLA_WARN_PCT | MAX_ATTEMPTS | MAX_AGE_MIN | LAG_WARN | LAG_CRIT | POLL_BUDGET | NOT_FOUND_RATE | DQ_FAIL_PCT | MB_INTERVAL_NORM"],
      ["NUMERIC_VALUE / UNIT", "NUMBER / VARCHAR2(12)", ""],
      ["EFFECTIVE_FROM / TO", "DATE", "never update in place — supersede"],
      ["APPROVED_BY", "VARCHAR2(60)", ""],
    ],
    notes: [
      "NOT_FOUND_RATE is the one that stops the delete race alarming constantly: below the observed delete rate it is normal, above it is a defect.",
      "Every verdict stores the value it applied, so changing a threshold never rewrites history.",
    ] },

  { name: "CIRCUIT_BREAKER_STATE", area: "GUARD", state: "new", grain: "one row per protected dependency",
    purpose: "Stops a failing dependency being hammered by a fixed cadence.",
    why: "If SEI's view API degrades, the puller retries on every micro-batch and amplifies load against something already failing. A five-minute cadence guarantees the retry storm repeats 288 times a day. There is no breaker anywhere in the pack.",
    cols: [
      ["BREAKER_CODE", "VARCHAR2(40) PK", "SEI_VIEW_PULL | SEI_STATUS_API | APIGEE_SUBMIT"],
      ["STATE", "VARCHAR2(10)", "CLOSED | OPEN | HALF_OPEN"],
      ["FAILURE_COUNT / FAILURE_THRESHOLD", "NUMBER", ""],
      ["OPENED_TS / NEXT_PROBE_TS", "TIMESTAMP", "backoff schedule"],
      ["LAST_ERROR_CODE", "VARCHAR2(60) FK", ""],
    ],
    notes: ["When the breaker is OPEN the listener keeps staging events and the puller stops. Ingestion degrades rather than failing, and nothing is lost."] },
];

export const FM_REC = {
  verdict: "The pack has tables. It does not have a framework.",
  body:
    "Five control tables are specified and each is sound on its own. What is absent is anything that spans " +
    "them, and that absence is why four error vocabularies already exist in one pipeline before a line of " +
    "event code has been written. Build the four models once, estate-wide, rather than letting each " +
    "component grow its own.",
  order: [
    "STATUS_DOMAIN first. It is small, it costs nothing, and it makes 'terminal never regresses' enforceable instead of conventional — which the outbound push-and-poll model needs before its first callback lands.",
    "DQ_RUN_RESULT second. Until a rule records that it ran, a gate that silently did not execute looks exactly like a clean night, and no amount of monitoring will find it.",
    "ERROR_CATALOG and ERROR_EVENT third, seeded from the codes already in use so nothing is invented and nothing is lost.",
    "GUARDRAIL_POLICY before the first threshold is hard-coded. It is cheap now and a migration later.",
    "EVENT_DEAD_LETTER before the listener goes to production, not after the first poison envelope stalls a partition.",
  ],
  ask:
    "Two of these are joint rather than BBH's alone. The recon tolerance and SLA warning percentage have to " +
    "be shared configuration if the portal and any second consumer are to agree about the same business " +
    "date — so where they live is a decision for both sides. And the pack forbids SLA_STATUS, " +
    "SLA_BREACH_IND and ALERT_SENT_IND on DATE_CONTROL, which is a reasonable rule with an unreasonable " +
    "consequence: no verdict is stored anywhere in Oracle. DQ_RUN_RESULT and GUARDRAIL_POLICY keep to the " +
    "letter of that rule by storing the verdict against the rule rather than against the date, but SEI " +
    "should confirm that reading is acceptable before it is built.",
};
