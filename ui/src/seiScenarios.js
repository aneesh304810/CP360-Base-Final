// What happens when things go wrong, per scenario.
//
// Consolidated from both SEI design documents. Each row says what the
// design does, not what somebody thinks it should do, and names the
// baseline components it belongs to so a component's design document
// can carry its own failure behaviour instead of a general paragraph
// about error handling.
//
// THREE CORRECTIONS ARE BAKED IN, because an earlier reading of these
// got them backwards and the wrong version is the kind that survives:
//   · Source-DQ failures and missing-dimension holds ARE replayable.
//     Only mapping and logic defects are not.
//   · Pre-load file checks go to QUARANTINED, not FAILED. FAILED is
//     for a technical or RAW-load failure only.
//   · Several scenarios people expect are in neither document — data
//     types, measure values, fact duplication, constraint violations,
//     network and permission errors on the archive move, scheduler
//     restarts. Those are listed at the end as gaps, not invented.

export const SCENARIOS = [
 // discovery
 { id: "X1", a: "Discovery", s: "Exactly one pattern matches",
   r: "One work item is created, carrying the interface, the physical "
    + "filename, the business date, the target RAW table and the parsing "
    + "rules.", c: ["S6"], ev: "ingest Appendix C.3 (p.21)" },
 { id: "X2", a: "Discovery", s: "No pattern matches",
   r: "Not loaded and not moved. An unmatched-file event is emitted with "
    + "the filename and path, and the approved exception-location policy "
    + "applies — which is still open decision O1.",
   c: ["S6"], ev: "ingest Appendix C.3 (p.21)" },
 { id: "X3", a: "Discovery", s: "More than one pattern matches",
   r: "Treated as a configuration defect. No target table is chosen, "
    + "nothing is processed, and it is logged and notified.",
   c: ["S6"], ev: "ingest Appendix C.3 (p.21)" },
 { id: "X4", a: "Discovery", s: "The scan finds nothing",
   r: "The run succeeds with zero mapped tasks. The completeness and SLA "
    + "task still runs — which is the point, because yesterday's late "
    + "file can complete the set without a new one arriving.",
   c: ["S6", "S9"], ev: "ingest §5.2 (p.10)" },
 // validation
 { id: "X5", a: "Validation", s: "The business date will not parse",
   r: "Rejected before any RAW write, with the parsing error recorded. "
    + "The format mask must reject impossible dates even when the regex "
    + "shape matches.", c: ["S8"], ev: "ingest Appendix D.6 (p.23)" },
 { id: "X6", a: "Validation", s: "Header or trailer fails",
   r: "RECEIVED becomes QUARANTINED, the error is recorded and the file "
    + "moves to Quarantine. Nothing is written to RAW.",
   c: ["S8"], ev: "ingest §4 (p.7) · Appendix B.2 (p.20)" },
 { id: "X7", a: "Validation", s: "A zero-row file arrives and is not allowed",
   r: "QUARANTINED, same path. Whether zero rows are allowed is per "
    + "interface configuration.", c: ["S8"], ev: "ingest §6.1 (p.12)" },
 // registry
 { id: "X8", a: "Registry", s: "The same file is discovered again",
   r: "If the existing record is ARCHIVED it is skipped and logged as a "
    + "duplicate; no second registry row is created. A unique key on the "
    + "interface and business date enforces it.",
   c: ["S7"], ev: "ingest §5 (p.9) · Appendix B (p.19)" },
 { id: "X9", a: "Registry", s: "A record is stuck in RECEIVED, VALIDATED or LOADING",
   r: "Investigated, never reset automatically. The Airflow task state, "
    + "the worker logs, the file location and the Oracle outcome are "
    + "checked first, and the same record is reused for recovery.",
   c: ["S7"], ev: "ingest Appendix D.5 (p.23)" },
 // load
 { id: "X10", a: "Load", s: "The RAW load or the count check fails",
   r: "Rolled back. LOADING becomes FAILED with the error and the end "
    + "timestamp. The insert and the count reconciliation are one Oracle "
    + "transaction, and the commit happens only when the file count, the "
    + "trailer count and the inserted count all agree.",
   c: ["S8"], ev: "ingest §4.1 (p.7) · §7.3 (p.14)" },
 { id: "X11", a: "Load", s: "A FAILED file is rerun",
   r: "The same registry id is reused and the retry count goes up. Any "
    + "exceptional partial rows are removed through the approved process "
    + "first, then the file reloads in one transaction.",
   c: ["S8"], ev: "ingest Appendix D.1 (p.22)" },
 // archive
 { id: "X12", a: "Archive", s: "The archive move fails after a good load",
   r: "ARCHIVE_FAILED. RAW is kept and is never deleted or reloaded — "
    + "the move happens after the commit and cannot be part of the "
    + "transaction. Only the move is retried.",
   c: ["S8", "S4"], ev: "ingest §7.3 (p.14) · Appendix D.3 (p.22)" },
 { id: "X13", a: "Archive", s: "Why ARCHIVED is the ready state",
   r: "A reconciled RAW commit is not released downstream until the "
    + "physical archive succeeds, so completeness counts ARCHIVED and "
    + "nothing earlier.", c: ["S9"], ev: "ingest §6.2 (p.12)" },
 // the gate
 { id: "X14", a: "Gate", s: "Complete before the cutoff",
   r: "The guarded transition is taken and transformation is invoked.",
   c: ["S9", "S10"], ev: "ingest §5.2 (p.10)" },
 { id: "X15", a: "Gate", s: "Complete at or after the cutoff",
   r: "Still triggered, and a recovery or late-completion event is "
    + "published if the date had already breached.",
   c: ["S9", "S12"], ev: "ingest §7.3 (p.14)" },
 { id: "X16", a: "Gate", s: "Incomplete before the cutoff",
   r: "The date stays PENDING, nothing is triggered, and the next "
    + "scheduled run re-evaluates.", c: ["S9"], ev: "ingest §5.2 (p.10)" },
 { id: "X17", a: "Gate", s: "Incomplete at or after the cutoff",
   r: "The date stays PENDING and a correlated breach alert is published. "
    + "Correlation is event type plus business date, so a persistent "
    + "breach raises one alert rather than one every five minutes.",
   c: ["S12"], ev: "ingest §5.2 (p.10) · Appendix E.6 (p.25)" },
 { id: "X18", a: "Gate", s: "The completeness query itself fails",
   r: "The task fails and Airflow retries. Readiness is unknown, so "
    + "nothing is triggered.", c: ["S9"], ev: "ingest §5.2 (p.10)" },
 // orchestration
 { id: "X19", a: "Orchestration", s: "Two runs try to trigger at once",
   r: "The second guarded update changes zero rows, so it does not "
    + "trigger. The deterministic run id rejects a duplicate as well.",
   c: ["S10"], ev: "ingest Appendix E.3 (p.24)" },
 { id: "X20", a: "Orchestration", s: "TRIGGER is set but transformation never started",
   r: "A scheduled check retries when the status is TRIGGER, the "
    + "transformation run id is null and no matching deterministic run "
    + "exists.", c: ["S11"], ev: "ingest Appendix C.1 (p.21)" },
 { id: "X21", a: "Orchestration", s: "A transformation task fails",
   r: "The date stays TRIGGER, no next date is created and the pipeline "
    + "is locked. Airflow alerts and the run restarts from the failed "
    + "task; each layer's write is idempotent for the date.",
   c: ["S13", "S20"], ev: "dbt §8.1 (p.20)" },
 { id: "X22", a: "Orchestration", s: "FACT fails after DIM succeeded",
   r: "The restart resumes at the fact build. The dimension is not "
    + "rebuilt.", c: ["S17"], ev: "dbt §8.1 (p.20)" },
 { id: "X23", a: "Orchestration", s: "The restart reaches the final task",
   r: "The date advances to COMPLETE and the next PENDING row is "
    + "inserted in the same transaction, exactly once.",
   c: ["S20"], ev: "dbt §8.1 (p.20) · ingest Appendix E.5 (p.24)" },
 // source DQ
 { id: "X24", a: "Source DQ", s: "A key column is missing",
   r: "The STG view marks the row FAIL with a reason code and INT never "
    + "reads it. The row goes to the DQ store as OPEN.",
   c: ["S14", "S18"], ev: "dbt §6.3 (p.15)" },
 { id: "X25", a: "Source DQ", s: "A code is not in the mapping table",
   r: "Same path — FAIL at STG with its own reason code, excluded "
    + "before any mapping is attempted.", c: ["S14"], ev: "dbt §6.3 (p.15)" },
 { id: "X26", a: "Source DQ", s: "A full-snapshot entity fails",
   r: "The row stays OPEN until a corrected record arrives in a later "
    + "full file, which replays it and marks it RESOLVED. This rests on "
    + "account and client being full daily snapshots.",
   c: ["S18"], ev: "dbt §7.1 (p.17) · §8.2 assumption A1 (p.20)" },
 { id: "X27", a: "Source DQ", s: "A transaction fails",
   r: "That date's records do not come round again, so it replays only "
    + "on a corrected reload for the date, or when the missing dimension "
    + "arrives.", c: ["S18"], ev: "dbt §7.1 (p.17)" },
 // transformation DQ
 { id: "X28", a: "Transformation DQ", s: "A code has no active mapping row",
   r: "Caught at INT as a transformation failure, owned by the "
    + "transformation team rather than the source. Marked not "
    + "auto-replayable: it stays OPEN until a code fix is deployed.",
   c: ["S15", "S18"], ev: "dbt §7 (p.17)" },
 { id: "X29", a: "Transformation DQ", s: "The same failure returns after a rerun",
   r: "Expected, and the signal is that a code fix is needed rather than "
    + "another rerun.", c: ["S18"], ev: "dbt §7 (p.17)" },
 { id: "X30", a: "Transformation DQ", s: "A transaction's dimension has not arrived",
   r: "Never written to Gold with a placeholder key. Held in the DQ store "
    + "as replayable and OPEN, re-derived from INT on a later day once "
    + "the dimension exists, then marked RESOLVED.",
   c: ["S17", "S18"], ev: "dbt §7.1 (p.17) · Figure 5a (p.18)" },
 { id: "X31", a: "Transformation DQ", s: "A row is still OPEN at the retention edge",
   r: "CLOSED and alerted at seven days, because the DQ store keeps "
    + "lineage only and INT no longer holds the data to re-derive it.",
   c: ["S18", "S15"], ev: "dbt §7.1 (p.17) · §8.2 assumption A4 (p.20)" },
 // dimensions
 { id: "X32", a: "Dimensions", s: "A correction arrives and the row is still current",
   r: "A normal MERGE, joined on the surrogate key rather than the "
    + "natural key — a natural-key join matches both the closing and the "
    + "opening row and fails.", c: ["S16"], ev: "dbt §6.4.1 (p.15)" },
 { id: "X33", a: "Dimensions", s: "A correction arrives and the interval is already closed",
   r: "A direct UPDATE of that closed row only. Never a MERGE — it would "
    + "reopen an interval that is settled.", c: ["S16"], ev: "dbt §6.4.1 (p.15)" },
 { id: "X34", a: "Dimensions", s: "Someone changes the shape of a Gold table",
   r: "Refused. Every Gold model fails on a schema change, and the "
    + "service account holds DML only — no create, alter or drop.",
   c: ["S16", "S17"], ev: "dbt §8.4 (p.21)" },
 // reconciliation
 { id: "X35", a: "Reconciliation", s: "Counts do not agree at a boundary",
   r: "The difference is written to the immutable log and published. The "
    + "pass or warning verdict is derived on the Splunk side, after the "
    + "data is already in Gold — so it alerts rather than blocks.",
   c: ["S19"], ev: "dbt §7.2 (p.18) · §7.2.1 (p.18)" },
 { id: "X36", a: "Reconciliation", s: "The held backlog is growing",
   r: "Alerts on the ageing open rows, and the usual cause is a late "
    + "dimension file.", c: ["S19", "S18"], ev: "dbt §7.2.1 (p.18)" },
 { id: "X37", a: "Reconciliation", s: "DQ or reconciliation is rerun for a date",
   r: "The DQ rows are upserted so their resolution status survives, the "
    + "recon rows for that date are replaced, and both are republished.",
   c: ["S18", "S19"], ev: "dbt §8.1 (p.20)" },
 { id: "X38", a: "Evidence", s: "Publishing to Splunk fails",
   r: "The data is already durable in Oracle. The publish task is "
    + "separate and retryable, and it is idempotent per date.",
   c: ["S21"], ev: "dbt §8.3 (p.21)" },
 // restatement
 { id: "X39", a: "Restatement", s: "A successful file has to be replaced",
   r: "Approval first, then the reason, approver, operator and affected "
    + "downstream scope are recorded. The registry row and the RAW rows "
    + "are deleted through the controlled process, the corrected file is "
    + "dropped in Landing, and a fresh lifecycle starts. The downstream "
    + "rebuild for that date is coordinated separately.",
   c: ["S8", "S13"], ev: "ingest Appendix D.4 (p.23)" },
 { id: "X40", a: "Restatement", s: "A quarantined file is corrected",
   r: "The same registry id is reused, the retry count goes up, the "
    + "status resets to RECEIVED and every validation runs again before "
    + "any RAW write.", c: ["S8"], ev: "ingest Appendix D.2 (p.22)" },
];

// Asked about often, and in neither document. Listed so they are raised
// rather than answered by whoever is writing the model that day.
export const SCENARIO_GAPS = [
 "Invalid data types inside an otherwise well-formed file",
 "Invalid measure values — a negative quantity, an impossible price",
 "Duplicate rows arriving inside a single fact feed",
 "Database constraint violations on the Gold write",
 "Network or permission failures on the archive move specifically",
 "Scheduler or worker restart part-way through a mapped task",
];

export const scenariosFor = (cid) => SCENARIOS.filter((x) => x.c.includes(cid));
export const scenarioAreas = () => [...new Set(SCENARIOS.map((x) => x.a))];
