// The C4 model against the BBH dbt Transformation Framework TDD.
//
// WHY THIS IS A SEPARATE FILE AND NOT A RENAME. The C4 components come
// from seiDesignTracker.js, which says at the top of itself that it is
// generated from SEI-BBH_Component_Design_Tracker.xlsx. Renaming a
// component here would make the screen disagree with the workbook, and
// the workbook is the thing people are tracking delivery against. So
// the TDD's names sit BESIDE the tracker's, and where the two documents
// genuinely disagree the disagreement is the content rather than
// something to resolve by picking one.
//
// Five verdicts, and only two of them are problems:
//
//   same       different words, same object. The TDD's name is worth
//              showing because it is the name that will be in the code.
//   split      one C4 component is two objects in the TDD, with
//              different properties. Not a disagreement — a loss of
//              resolution, and it hides things like "half of this
//              stores nothing".
//   conflict   the two documents say different things about the same
//              component. Somebody has to decide.
//   absent     the C4 has a component the TDD rules out.
//   elsewhere  the TDD explicitly puts this outside itself, in the
//              Ingestion Framework TDD. Not a gap in either document —
//              a document nobody has asked for.
//
// Everything below cites a section. A claim about what a document says,
// without the place it says it, is not checkable and will be argued
// with by whoever wrote the document.

export const TDD_DOC = "BBH dbt Transformation Framework TDD v2";
// AND IT IS SEI'S DOCUMENT. The title names BBH's framework, which reads
// like a BBH document and was taken for one here for a while. It is not:
// SEI Professional Services is named on its document-control page as
// author and owner. That changes what a disagreement on this page MEANS.
// A conflict below is not BBH's drawing against BBH's spec; it is the C4
// against SEI's specification of BBH's platform, and SEI specified it
// down to the DDL. Where the two differ, SEI has written something BBH
// has to either accept or push back on — it is not an internal tidy-up.
export const TDD_SOURCE = "SEI Professional Services";

export const TDD_VERDICTS = {
 same:      ["#159943", "names differ"],
 split:     ["#a8560f", "one box, two objects"],
 conflict:  ["#cc3344", "documents disagree"],
 absent:    ["#6d3ac0", "not in the TDD"],
 elsewhere: ["#5c7c94", "another document owns it"],
};

// The ORDER matters only for the summary strip; the map is keyed by the
// tracker's component id.
export const TDD_ALIGN = {

 // ---- ingress -------------------------------------------------------
 "8": { v: "elsewhere", name: "out of scope",
  what:
"Where SEI's files arrive and how they get across to BBH. The dbt TDD "
+ "does not describe this at all \u2014 it starts once a file is already "
+ "loaded.",
  note:
"The TDD's scope boundary puts SWP file generation and external file "
+ "transfer outside itself. Nothing in it describes the landing zone, the "
+ "transport, or what SEI commits to.",
  ev: "§1.2 — Scope Boundary (p.6)" },

 "9": { v: "elsewhere", name: "check_completeness (ShortCircuitOperator)",
  what:
"What notices that a file has turned up for the day being processed. In "
+ "the TDD this is a check rather than a wait: once the loads finish, the "
+ "list of files expected is compared against the list that actually "
+ "arrived.",
  note:
"The TDD does not have an arrival sensor. What it specifies at the handoff "
+ "is a completeness CHECK that runs after the load tasks: a set difference "
+ "of FILE_SCHEMA_CONFIG against FILE_REGISTRY, as a short-circuit step, so "
+ "an incomplete date ends the run quietly instead of failing it. Waiting "
+ "for a file to arrive is the Ingestion Framework's problem; knowing the "
+ "set is complete is this one's.",
  ev: "§5.3 (p.12) · Appendix A.1 (p.25)" },

 // ---- processing ----------------------------------------------------
 "13": { v: "elsewhere", name: "Ingestion Framework TDD",
  what:
"The code that reads a delivered file and writes it into the raw tables "
+ "unchanged. It also records what it loaded, works out whether the day's "
+ "set is complete, and starts the transformation when it is.",
  note:
"Physical file discovery, header and trailer validation and the RAW load "
+ "itself are assigned to a separate Ingestion Framework TDD. The dbt TDD "
+ "describes only what this component has to do at the handoff: load into "
+ "SWP_RAW, update FILE_REGISTRY, check completeness, set TRIGGER and "
+ "invoke the Transformation DAG with run_id transform_{business_date}.",
  ev: "§1.2 (p.6) · §5.3 (p.12)" },

 "14": { v: "same", name: "SWP_RAW · Bronze",
  what:
"The landing tables \u2014 the file exactly as it was delivered, with "
+ "nothing cleaned, corrected or removed, and a note of which file and "
+ "which line each row came from. The TDD calls this SWP_RAW.",
  note:
"RAW_ACCOUNT, RAW_CLIENT, RAW_TRANSACTION. Source-faithful, append-only, "
+ "with file and record lineage carried on SRC_RECORD_ID. Three interfaces "
+ "are named and no others.",
  ev: "§4.1 — Medallion Mapping (p.10)" },

 "15": { v: "split", name: "STG (view) + INT (7 days)",
  what:
"Turning raw data into something usable: standard column names, codes "
+ "translated, duplicates resolved. In the TDD this is TWO things. STG is a "
+ "view \u2014 it tidies the columns and marks every row pass or fail, and "
+ "stores nothing. INT is a real table holding only the rows that passed, "
+ "kept for seven days.",
  note:
"One component here, two objects there, and they could hardly be more "
+ "different. STG is a VIEW — it standardises the source columns, computes "
+ "DQ_STATUS_CD and DQ_FAIL_REASON_CDS, and stores nothing at all. INT is a "
+ "partitioned table that reads PASS rows only, maps the code sets, is keyed "
+ "on the natural key plus BUSINESS_DATE, and is purged by partition drop "
+ "after seven days.\n\n"
+ "THE L2 DRAWING NOW SPLITS IT. It shows STG and INT as separate boxes, "
+ "and STG is drawn square rather than as a cylinder because it stores "
+ "nothing. A single box invited two wrong assumptions — that the "
+ "enriched layer can be queried for history (it is a view over today), and "
+ "that it has one retention policy (one half has none, the other has seven "
+ "days).\n\n"
+ "The tracker still calls this component Stage 2 Enriched, because it is "
+ "generated from the workbook. The drawing follows the TDD; the delivery "
+ "name has not moved. Worth closing that gap in the workbook itself.",
  ev: "§2 (p.7) · §4.1 (p.10) · Appendix A.3 (p.26)" },

 "16": { v: "conflict", name: "DIM then FACT · pre-existing Gold",
  what:
"The finished tables the business reads: the account and party "
+ "dimensions and the transaction fact. In the TDD these already exist and "
+ "already carry history from the current system \u2014 the work is "
+ "changing how they get filled, not building them.",
  note:
"Two disagreements, and the second one is the expensive one.\n\n"
+ "RESOLUTION. The TDD has two explicitly ordered layers, not one Gold "
+ "component: build_dim and test_dim must both pass before build_fact "
+ "starts. That ordering is a separate component here (#19), so the C4 has "
+ "the ordering without the two things being ordered.\n\n"
+ "OWNERSHIP. The TDD is emphatic that Gold already exists: DIM_ACCOUNT, "
+ "DIM_INTERESTED_PARTY and FACT_TRANSACTIONS carry live history from ODI, "
+ "and the project changes only how they are populated. dbt holds DML-only "
+ "grants, every Gold model carries on_schema_change='fail', and Gold "
+ "objects are declared as dbt SOURCES rather than models so dbt cannot "
+ "create them. The C4 and its design document have dbt building Kimball "
+ "dimensions and facts, which is a different job.\n\n"
+ "AND THERE IS NO EXADATA. The L2 drawing used to label this box Pre-Gold "
+ "Exadata. Neither Exadata nor a pre-Gold tier appears anywhere in the TDD, "
+ "which MERGEs into the Oracle Gold tables directly, so the drawing now "
+ "shows DIM and FACT as two ordered boxes and the tier is gone.\n\n"
+ "What has NOT moved is the ownership question. The tracker still has this "
+ "as one component, Gold (dbt), built by dbt; the TDD has dbt populating "
+ "tables it may not create or alter. Redrawing the layers does not settle "
+ "that, and it is the more expensive half.",
  ev: "§4.1 (p.10) · §6.4 (p.15) · §8.4 (p.21) · Appendix A.3 (p.26)" },

 "17": { v: "same", name: "MERGE-vs-UPDATE reprocessing rule",
  what:
"What happens when a corrected record turns up after the original has "
+ "already been processed. The TDD's rule: if the period it belongs to has "
+ "been closed off, update that closed row directly, because merging it "
+ "would reopen a period that is settled.",
  note:
"Compatible, and the TDD gives it the rule it was missing: a later change "
+ "that closed an SCD2 interval must be applied as a direct UPDATE scoped to "
+ "ACTIVE_IND = 0 rows, never as a MERGE — a MERGE would reopen an interval "
+ "that has already been closed.",
  ev: "§6.4.1 (p.15)" },

 // ---- orchestration -------------------------------------------------
 "18": { v: "split", name: "Ingestion DAG + Transformation DAG",
  what:
"The schedule, and the order things run in. The TDD has two schedules "
+ "rather than one \u2014 a loading schedule and a transformation schedule "
+ "\u2014 which hand over to each other through the table that tracks which "
+ "business date is open.",
  note:
"The TDD has two DAGs with different owners, handing over through "
+ "DATE_CONTROL: the Ingestion DAG loads and triggers, the Transformation "
+ "DAG builds and advances the date. One C4 component spans both sides of "
+ "that handoff.\n\n"
+ "Per-domain fan-out is not in the TDD. The Transformation DAG is a single "
+ "chain of layer barriers — stg, int, dim, fact — each a build task "
+ "followed by its own test task.",
  ev: "§4.2 (p.10) · §5.2 (p.11) · Appendix A.1 (p.25)" },

 "19": { v: "same", name: "build_dim → test_dim → build_fact",
  what:
"The rule that dimensions are built before facts, so a transaction can "
+ "always find the account it belongs to. It has to be enforced by the "
+ "schedule, because the transformation tool cannot see that the link "
+ "exists.",
  note:
"Same intent, and the TDD explains why it has to be an Airflow edge rather "
+ "than left to dbt: FACT references DIM as a SOURCE, not as a ref, so dbt's "
+ "own dependency graph does not order them. The explicit task edges are the "
+ "only thing enforcing it.",
  ev: "§5.2 (p.11) · Appendix A.3 (p.26)" },

 "20": { v: "conflict", name: "one active business date",
  what:
"Running more than once a day. Worth knowing before planning around it: "
+ "the TDD processes one business date at a time and the database itself "
+ "only permits one open date, so this is the piece the two designs cannot "
+ "both have.",
  note:
"The TDD runs one business date at a time and enforces it in the database: "
+ "a unique index allows at most one non-COMPLETE row in DATE_CONTROL. An "
+ "intraday cadence that opens a second date, or re-runs a date already in "
+ "flight, does not fit that state machine as written.\n\n"
+ "Not necessarily wrong — the two documents are describing different "
+ "operating models. But they cannot both be built.",
  ev: "§5.1 (p.11) · Appendix A.2 (p.25)" },

 "21": { v: "conflict", name: "mark_replayed_dq_resolved",
  what:
"Re-running work that did not succeed. In the TDD this is not a separate "
+ "engine \u2014 it is a step at the end of the daily run that picks up "
+ "rows held back for a missing account and loads them once that account "
+ "exists.",
  note:
"Different thing in a different place. In the TDD replay is not an engine; "
+ "it is one task inside the Transformation DAG, running after the fact "
+ "build. It takes the OPEN, reprocess-eligible rows in "
+ "DQ_VALIDATION_FAILURE, re-derives them from INT, re-checks the "
+ "dimensions, loads what now resolves and flips those rows to RESOLVED.\n\n"
+ "It is also bounded in a way a general rerun engine is not: the DQ store "
+ "holds lineage only, no payload, so replay can only reach as far back as "
+ "INT still holds the data — seven days. Anything still OPEN at that edge "
+ "is CLOSED and alerted.",
  ev: "§7.1 (p.17) · §8.2 — assumption A4 (p.20) · Appendix A.1 (p.25)" },

 "22": { v: "absent", name: "no partial-set path",
  what:
"What to do when only some of the day's files arrive. The TDD has no "
+ "answer to this because it does not allow the situation: the day does not "
+ "start until the expected set is complete.",
  note:
"The TDD has no partial-batch policy and does not leave room for one. "
+ "TRIGGER is set only when expected minus completed is empty; if the set is "
+ "incomplete the run ends normally and the date stays PENDING for the next "
+ "cycle to re-check. Running on what arrived is not a runbook decision in "
+ "this design — it would be a change to the state machine.",
  ev: "§5.3 (p.12) · §10.2 (p.23)" },

 // ---- data quality --------------------------------------------------
 "23": { v: "elsewhere", name: "Ingestion Framework TDD",
  what:
"Checking the file itself before anything is loaded \u2014 right shape, "
+ "right columns, does the count in the trailer match what is in the file. "
+ "This belongs to the ingestion document, not the dbt one.",
  note:
"Header and trailer validation sits outside the dbt TDD by its own scope "
+ "boundary. No structural gate is described in it.",
  ev: "§1.2 (p.6)" },

 "24": { v: "elsewhere", name: "Ingestion Framework TDD",
  what:
"Looking at the loaded data before anything is done to it, to see whether "
+ "it is plausible. Not in the dbt TDD: there, the first thing that reads a "
+ "row's content is the STG view.",
  note:
"Nothing profiles RAW in the dbt TDD. The first thing that looks at a row's "
+ "content is the STG view, which is already past the RAW load.",
  ev: "§1.2 (p.6) · §6.3 (p.15)" },

 "25": { v: "same", name: "test_stg / test_int / test_dim / test_fact",
  what:
"Two different checks. Automated tests that run after each layer is "
+ "built, and a row-by-row pass or fail applied as the data is read. The "
+ "second is the one that actually stops a bad record going further.",
  note:
"Same component, and the TDD splits it in two. The per-layer dbt test tasks "
+ "are tag-selected and each one gates the next layer's build. Separately, "
+ "and more importantly, the STG view computes a PASS/FAIL verdict per row "
+ "and INT reads only PASS rows — that filter, not the test tasks, is what "
+ "actually stops a bad record.",
  ev: "§6.3 (p.15) · Appendix A.1 (p.25)" },

 "26": { v: "conflict", name: "RECON_RESULT · not a gate",
  what:
"Proving that nothing was lost or quietly duplicated between one layer "
+ "and the next. Worth knowing that in the TDD this runs AFTER the data is "
+ "published, so it raises an alarm rather than holding anything back.",
  note:
"This is the divergence most likely to be missed, because both documents "
+ "use the same words for it.\n\n"
+ "A tie-out GATE implies the data does not publish until the totals agree. "
+ "In the TDD the counts are computed and shipped to Splunk by a task that "
+ "runs AFTER build_fact, the PASS/WARNING verdict is derived on the Splunk "
+ "side from the published counts, and nothing in the pipeline reads it. A "
+ "mismatch raises an alert once the data is already in Gold.\n\n"
+ "Detective, not preventive. If it is meant to block, that has to be "
+ "designed in — the current task order makes it impossible.",
  ev: "§7.2 (p.18) · §7.2.1 (p.18) · Appendix A.1 (p.25)" },

 "27": { v: "same", name: "four reconciliation boundaries",
  what:
"The counts for the day, compared across each boundary, written down and "
+ "kept so the question can be answered again later. The TDD compares four "
+ "boundaries.",
  note:
"SWP_RAW→STG, STG→INT, INT→DIM, INT→FACT, one immutable RECON_RESULT row "
+ "per boundary per business date, replaced rather than updated. Note the "
+ "count: the TDD defines four boundaries and Variance 360 compares three.",
  ev: "§7.2 (p.18)" },

 "28": { v: "conflict", name: "DQ_VALIDATION_FAILURE · dbt, not Python",
  what:
"How a failed record is recorded, who owns fixing it, and how it gets "
+ "cleared. One table holds every failure, each one marked either as "
+ "something that will retry itself or something needing a correction at "
+ "source.",
  note:
"The design matches and the technology does not. The TDD has one Oracle "
+ "store for both failure categories — Source DQ owned by the SWP source "
+ "system, Transformation DQ owned by the transformation team — carrying a "
+ "static reprocess_eligible flag and a persisted resolution_status of OPEN, "
+ "RESOLVED or CLOSED.\n\n"
+ "It is written by dbt models in the project's dq/ folder and published to "
+ "Splunk. The tracker has this component as Python, which puts it in a "
+ "different repository, a different test suite and a different team's "
+ "backlog.",
  ev: "§7 (p.17) · §7.1 (p.17) · Appendix A.3 (p.26)" },

 // ---- foundation ----------------------------------------------------
 "29": { v: "conflict", name: "no quarantine store",
  what:
"Where a bad record goes. The TDD deliberately does not copy it anywhere "
+ "\u2014 the record stays where it is and only a pointer is kept, on the "
+ "assumption that anything held back is resolved within seven days.",
  note:
"The TDD deliberately does not copy a failing record anywhere. The row "
+ "stays where it is, is held out of the next layer, and what gets written "
+ "to DQ_VALIDATION_FAILURE is LINEAGE ONLY — model, business key, business "
+ "date — with the row re-derived from INT if it is ever replayed.\n\n"
+ "That is an explicit assumption, not an omission: A4 says every missing "
+ "dimension resolves inside the INT seven-day window, and states that if "
+ "one could arrive later the design would need a durable payload. A "
+ "quarantine store is that durable payload. So the C4 has the thing the TDD "
+ "says it does not need, and the question is which assumption holds.",
  ev: "§7.1 (p.17) · §8.2 — assumption A4 (p.20)" },

 "30": { v: "conflict", name: "dbt recon model + Splunk derivation",
  what:
"The machinery behind the counts. In the TDD they are written to a log "
+ "that is never updated afterwards, and the pass-or-warn judgement is made "
+ "by the reporting tool rather than stored with the numbers.",
  note:
"Same disagreement as #28 and the same consequence. Reconciliation in the "
+ "TDD is a dbt model writing an immutable Oracle log, plus a Splunk-side "
+ "derivation of PASS or WARNING. The status is derived and not stored. The "
+ "tracker has a Python reconciliation framework.",
  ev: "§7.2.1 (p.18) · §8.2 — assumption A6 (p.20)" },

 "31": { v: "same", name: "correlated audit trail",
  what:
"Being able to answer \u201cwhere did this number come from, and "
+ "when\u201d. Business date, the identifiers of the runs that touched it, "
+ "the original source row and the failure category are all tied together.",
  note:
"Business date, status transitions, dbt invocation, SRC_RECORD_ID and the "
+ "DQ or recon category are correlated. DATE_CONTROL doubles as the run "
+ "ledger — it carries the ingestion and transformation run ids alongside "
+ "the created, trigger and complete timestamps.",
  ev: "§8.4 (p.21) · Appendix A.2 (p.25)" },

 "32": { v: "same", name: "DML-only service accounts",
  what:
"Who and what is allowed to touch the data. The concrete part: the "
+ "accounts the pipeline runs as can change rows in the finished tables but "
+ "cannot create, alter or drop anything.",
  note:
"Narrower than this component but concrete, and checkable rather than "
+ "attested: credentials come from OpenShift Secrets, the service accounts "
+ "hold DML only on Gold with no ALTER, DROP or CREATE, and "
+ "on_schema_change='fail' guards drift on every Gold model.",
  ev: "§8.4 (p.21)" },

 "33": { v: "same", name: "DATE_CONTROL · FILE_REGISTRY · FILE_SCHEMA_CONFIG",
  what:
"The small control tables the run depends on \u2014 which business date "
+ "is open, which files are expected for it, and which have arrived.",
  note:
"The TDD names the tables this component is a placeholder for, and gives "
+ "DDL for one of them. FILE_SCHEMA_CONFIG holds the expected interface set "
+ "and FILE_REGISTRY what arrived; the difference between them is what gates "
+ "the business date.\n\n"
+ "FILE_SCHEMA_CONFIG has no DDL anywhere in the TDD, unlike DATE_CONTROL, "
+ "DQ_VALIDATION_FAILURE and RECON_RESULT. It belongs to the Ingestion "
+ "Framework.",
  ev: "§4.2 (p.10) · §10.2 (p.23) · Appendix A.2 (p.25)" },

 "34": { v: "conflict", name: "Splunk owns all reporting",
  what:
"Knowing the run is healthy, and being told when it is not. The TDD puts "
+ "all dashboards, trending and alerting in Splunk, reading events the "
+ "pipeline publishes as it goes.",
  note:
"The TDD gives Splunk everything: dashboards, counts, trending and "
+ "alerting, reading resolution_status directly from the published events. "
+ "Oracle keeps the durable logs and does not report from them.",
  ev: "§4.2 (p.10) · §7.2.1 (p.18)" },

 "35": { v: "conflict", name: "Splunk, per the TDD",
  what:
"This catalogue. It reads the same exceptions straight out of the "
+ "database rather than through Splunk, which is why both documents "
+ "describe reporting and only one of them is the TDD.",
  note:
"Two documents, two reporting owners. The TDD assigns all DQ and "
+ "reconciliation reporting to Splunk; 360 reads the same exceptions out of "
+ "Oracle directly and already has three screens doing it (review question "
+ "36).\n\n"
+ "Both can be true and probably should be — Splunk for alerting, 360 for "
+ "investigation — but nobody has written that down, and until somebody "
+ "does, two teams are building the same dashboard.",
  ev: "§4.2 (p.10) · §8.2 — assumption A6 (p.20)" },
};

// Things the TDD puts at the centre of the design that have no component
// in the C4 at all. Keyed by the container they would belong to.
export const TDD_MISSING = {
 ORCH: [
  { name: "DATE_CONTROL state machine",
    why:
"The single control table the whole design turns on: one row per business "
+ "date, PENDING → TRIGGER → COMPLETE, at most one non-COMPLETE row at a "
+ "time enforced by a unique index, and the final task advances the date and "
+ "seeds the next one atomically. There is no C4 component for it — the "
+ "nearest is the Metadata and Configuration Store, which is a different "
+ "kind of thing.",
    ev: "§5.1 (p.11) · Appendix A.2 (p.25)" },
  { name: "SLA_CUTOFF_TS · the ingestion SLA",
    why:
"A time-zone-aware cutoff per business date, described as gating the "
+ "ingestion SLA. No component owns it, no task reads it, and the only "
+ "stuck-run alert in the design watches TRIGGER — which a late file never "
+ "reaches (review question 97).",
    ev: "§10.3 (p.24) · Appendix A.2 (p.25)" },
 ],
 PROC: [
  { name: "a component for STG and a component for INT",
    why:
"The DRAWING has been realigned: the processing band now reads SWP_RAW "
+ "→ STG → INT → DIM → FACT, with STG square rather than "
+ "a cylinder because it stores nothing. The TRACKER has not moved — "
+ "components 15 and 16 are still one box each, so two objects with "
+ "different storage, different retention and different failure modes share "
+ "one delivery status and one design document between them.\n\n"
+ "That is a workbook change now, not a drawing one.",
    ev: "§4.1 (p.10) · §2 (p.7)" },
 ],
};

// The one place the TDD disagrees with ITSELF, which matters here
// because it decides what the C4's two Stage boxes map onto.
export const TDD_SELF_CONFLICT = {
 title: "The TDD maps the current layers two different ways",
 body:
"Section 2 maps BBH's current STG1 onto SWP_RAW (the Bronze row) and BBH's "
+ "current STG2 onto STG plus INT (the Silver row). Section 6.1 maps them "
+ "differently, heading its two columns “STG (BBH STG1)” and "
+ "“INT (BBH STG2)” — which puts STG1 at STG, not at SWP_RAW.\n\n"
+ "Those cannot both hold. The alignment on this page follows section 2, "
+ "because the medallion mapping in section 4.1 and the glossary agree with "
+ "it — Bronze is SWP_RAW, Silver is STG plus INT. That is two places "
+ "against one, which is a reason and not a proof.\n\n"
+ "Worth one line of confirmation before anyone writes a model, because the "
+ "two readings put the Source DQ flag in different places.",
 ev: "§2 (p.7) · §3 — Glossary (p.8) · §4.1 (p.10) · §6.1 (p.13)",
};

export const tddFor = (c) => TDD_ALIGN[c && c.id] || null;

export const tddCount = (comps, v) =>
 comps.filter((c) => (TDD_ALIGN[c.id] || {}).v === v).length;
