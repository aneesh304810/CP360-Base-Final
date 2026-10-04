// Draft answers to the review questions, grounded in this codebase.
//
// WHAT THIS IS AND IS NOT. Every answer below is derived from something
// that is actually in this repository — a table definition, a screen, the
// environment sizing sheet — and names it. None of them is an agreed
// position. They are drafts written so the review starts from "here is
// what the platform does today, is that right?" rather than from a blank
// thread.
//
// SO THEY ARE MARKED, AND THEY DO NOT RESOLVE ANYTHING. A seeded answer
// renders as a DRAFT and leaves its question at "answered". Only a human
// accepting one makes a question resolved, and accepting is the moment
// the answer becomes that component's documentation. That is deliberate:
// a screen that boots up with 30 questions already ticked green is worse
// than one with 108 open, because nobody re-reads a tick.
//
// WHY MOST QUESTIONS HAVE NO DRAFT. 108 questions, and far fewer answers.
// The rest turn on SEI's design, on who at BBH owns a step, or on a
// number nobody has supplied — and inventing those would put fiction in
// front of the people whose job is to decide them. A question with no
// draft is not an oversight; it is the honest state.
//
// EVERY ANSWER CARRIES ITS GAP. Where the codebase answers half the
// question, the draft says which half. The gap is usually the useful
// part: it is the thing to put on a sprint board.
// What an answer RESTS ON, declared rather than implied.
//
//   codebase   what the platform does, verified in the files named in ev.
//   absence    the substance is that nothing in the estate records this,
//              established by searching for it. Different from "unknown":
//              it is a checkable claim, and a wrong one is falsifiable in
//              one grep.
//   document   read out of a source document. A verbatim quote is then
//              REQUIRED -- see the invariant in the test. No answer here
//              is of this class yet; the class exists so that the first
//              one extracted from the SEI PDF cannot quietly arrive
//              looking like a verified one.
//   inference  reasoned from the above rather than read. The premises
//              belong in the body, and it is never a settled position.
export const CONF = {
  codebase:  { label: "from the codebase", c: "#0f4775", bg: "#e4f0fb" },
  absence:   { label: "nothing recorded",  c: "#8c6a1f", bg: "#fdf2e3" },
  document:  { label: "from a document",   c: "#15803d", bg: "#e8f6ed" },
  inference: { label: "reasoned, not read", c: "#7c3aed", bg: "#f1e9fd" },
};

export const SEED_PREFIX = "seed";
export const seedId = (n) => `${SEED_PREFIX}${n}`;
export const isSeedId = (id) => typeof id === "string" && id.startsWith(SEED_PREFIX);

export const SEED_AUTHOR = "CP360 · drafted from the codebase";

const QUOTE_STAGE2 =
  "Stage 2 serves as the core transformation and metadata management layer, handling business transformations, source-to-target mappings, reference data, lineage tracking, audit information, and data quality controls.";
const QUOTE_NOT_CANONICAL =
  "Stage 2 is specifically designed to meet IMDS Staging and PBDW data delivery requirements. It is not intended to function as an enterprise-wide canonical data model; instead, it focuses on preparing, validating, and structuring SWP data for IMDS Stage and PBDW tables.";
const REF_ARCH = "SEI Architecture p.6 — Stage 2 Design Principles";

export const SEED_ANSWERS = [

// ---- extracted from the SEI pack, 2026-10 ---------------------------
// Fifteen questions were put to the documents; one came back NO DATA and
// is deliberately absent below, because an answer reading "NO DATA" on
// screen looks like the question was dealt with.
//
// Two were corrected before loading, and both corrections are the same
// mistake: the quote sat NEAR the claim rather than carrying it. Q1 was
// returned as a definition of "enriched" behind a quote that never uses
// the word, and q6 behind a sentence that does not say what its body
// says. The quotes are the reason that was visible at all.

{ n: 1, conf: "document",
  body:
"The document does not use the word “enriched”. What it describes in that "
+ "position is STAGE 2, defined as the core transformation and metadata "
+ "management layer: business transformations, source-to-target mappings, "
+ "reference data, lineage tracking, audit information and data quality "
+ "controls.\n\n"
+ "So the answerable form of this question is “what is Stage 2”, and that "
+ "is the scope. Reading “enriched” and “Stage 2” as the same thing is "
+ "BBH's inference, not a statement in the pack.",
  gap:
"Two things. The pack never uses the word the question is built on, so "
+ "somebody should get SEI to confirm in one line that the enriched layer "
+ "IS Stage 2 — this is cheap to settle and expensive to assume. And "
+ "“business transformations” is a category, not a list: no enrichment "
+ "operation is enumerated per interface or domain.",
  quote: QUOTE_STAGE2, ev: [REF_ARCH] },

{ n: 2, conf: "document",
  body:
"No. The layer handles business transformations and source-to-target "
+ "mappings, which is more than normalisation.",
  gap:
"The AddVantage half of the question is unanswered. The quote supports "
+ "“more than normalisation” and nothing more — the pack neither includes "
+ "nor excludes AddVantage-specific transformation, and does not break "
+ "transformations down per feed.",
  quote: QUOTE_STAGE2, ev: [REF_ARCH] },

{ n: 3, conf: "absence",
  body:
"The pack describes Stage 2 as a delivery-oriented layer and does not "
+ "state that it is a reusable enterprise schema equivalent to today's PB "
+ "DWH. Searched for: reusable, published contract, stable schema, consumer "
+ "model, enterprise model, PB DWH replacement.",
  gap:
"So the question stands, and it is a decision rather than a lookup: "
+ "nothing says whether consumers may build against Stage 2 as a long-term "
+ "contract. Read together with question 4, the pack leans against it.",
  ev: ["SEI Architecture p.6–7"] },

{ n: 4, conf: "document",
  body:
"No — and this one the document settles outright. Stage 2 is explicitly "
+ "NOT intended as an enterprise-wide canonical model. It is scoped to "
+ "preparing, validating and structuring SWP data for IMDS Stage and PBDW "
+ "tables.\n\n"
+ "That is the clearest statement in the pack, and it answers more than "
+ "question 4: it is the reason questions 3 and 10 matter.",
  gap:
"It says what Stage 2 is not. It does not say what BBH should use "
+ "instead, or whether a further model is expected downstream.",
  quote: QUOTE_NOT_CANONICAL, ev: [REF_ARCH] },

{ n: 5, conf: "document",
  body:
"It includes normalisation-style work — source-to-target mappings and "
+ "reference data handling are both named. The pack does not state that "
+ "Stage 2 transforms into the existing PB DWH dimensional model.",
  gap:
"The second half of that is an absence, not a denial: the pack is silent "
+ "on PB DWH modelling rather than ruling it out. The boundary between "
+ "enrichment and PBDW-specific modelling is undefined, which is the same "
+ "gap question 16 asks about from the other side.",
  quote: QUOTE_STAGE2, ev: [REF_ARCH] },

{ n: 6, conf: "document",
  body:
"Stage 2 is the central transformation and metadata management layer of "
+ "the inbound architecture, scoped specifically to IMDS Staging and PBDW "
+ "delivery.",
  gap:
"No row-level processing flow inside Stage 2 is given. More importantly "
+ "for this review, the pack does not place Stage 2 against BBH's own "
+ "Stage/INT layers — two naming schemes, reconciled nowhere, and question "
+ "7 is the other half of the same problem.",
  quote: QUOTE_STAGE2 + " " + QUOTE_NOT_CANONICAL, ev: [REF_ARCH] },

{ n: 7, conf: "document",
  body:
"INT is a persisted layer. It consumes only PASS rows, applies code "
+ "mappings, is keyed on the natural business key plus BUSINESS_DATE, and "
+ "feeds the DIM and FACT models. Purge is by partition drop.",
  gap:
"The relationship between SEI's Stage 2 and BBH's INT is not mapped in "
+ "any one document, so whether they overlap, abut or duplicate is still "
+ "open — see questions 6 and 9.",
  quote: "INT reads only PASS rows... map codes (ACCOUNT_TYPE, SITUS_CODE); "
       + "keyed on natural key + BUSINESS_DATE; partition-drop purge.",
  ev: ["Transformation TDD p.10"] },

{ n: 8, conf: "document",
  body:
"Yes, that reading holds. STG is a non-persisted view that standardises "
+ "columns and computes the source DQ flag; INT reads only the PASS rows "
+ "and applies mappings before DIM and FACT are built.",
  gap:
"No single sentence in the pack states the end-to-end sequence — this is "
+ "two statements read together. It holds, but it is a synthesis, and if "
+ "one layer later changes the summary will not obviously be wrong.",
  quote: "Silver STG is a non-persisted view... computes the Source DQ flag "
       + "DQ_STATUS_CD / DQ_FAIL_REASON_CDS. … INT reads only PASS rows and "
       + "is keyed on the natural business key plus BUSINESS_DATE.",
  ev: ["Transformation TDD p.5", "Transformation TDD p.12"] },

{ n: 9, conf: "document",
  body:
"STG — a non-persisted view: standardise columns, compute DQ status and "
+ "fail reasons. INT — persisted: PASS rows only, code mapping. Gold DIM — "
+ "direct-compare atomic MERGE. Gold FACT — loads only "
+ "dimension-resolved transactions.\n\n"
+ "The last of those is the load-bearing one for this review: a "
+ "transaction whose dimension does not resolve does not reach FACT, which "
+ "is where questions 34 and 47 land.",
  gap:
"The pack does not give a complete matrix of which business rule lives in "
+ "which layer — only the shape of each layer.",
  quote: "STG (view)... Non-persisted view: standardize columns; compute "
       + "DQ_STATUS_CD / DQ_FAIL_REASON_CDS. … INT... Reads only PASS rows; "
       + "map codes. … Gold DIM... Direct-compare atomic MERGE. … Gold "
       + "FACT... loads only dimension-resolved transactions.",
  ev: ["Transformation TDD p.10", "Transformation TDD p.12–15"] },

{ n: 10, conf: "absence",
  body:
"The pack does not say whether downstream applications may read Stage 2 "
+ "or INT directly, or only the approved models. Searched for: downstream "
+ "applications, direct access, read Stage 2, read INT, consumer access, "
+ "approved models.",
  gap:
"This is the question question 4 makes urgent: Stage 2 is explicitly not "
+ "a canonical model, so if consumers may read it directly they are "
+ "building on something SEI has said is not a contract. It needs an "
+ "answer before any consumer is pointed at it.",
  ev: ["SEI Architecture", "Transformation TDD"] },

{ n: 11, conf: "absence",
  body:
"The pack describes dbt replacing ODI logic but assigns nobody to the "
+ "conversion. Searched for: ODI ownership, conversion ownership, "
+ "responsible, accountable, Professional Services responsibility.",
  gap:
"This confirms the SEI pack is silent; it does NOT answer who owns it. "
+ "Ownership here is a contract and SOW question, not an architecture one "
+ "— it will not be found in any document and has to be decided.",
  ev: ["Transformation TDD p.5–7"] },

{ n: 12, conf: "absence",
  body:
"Nothing states whether Professional Services reverse-engineers the ODI "
+ "jobs or whether BBH supplies detailed requirements. Searched for: "
+ "reverse engineer, requirements, ODI review, migration responsibility.",
  gap:
"Same standing as question 11: the search is done, the answer is a "
+ "commercial decision. The two readings differ by a large amount of BBH "
+ "analyst effort, which is why it is worth closing early.",
  ev: ["Transformation TDD", "SEI Architecture"] },

{ n: 14, conf: "absence",
  body:
"No document assigns ownership of the like-for-like Stage → INT → "
+ "Approved Dim/Fact mapping, or of the ODI-to-dbt conversion. Searched "
+ "for: ownership, accountable, responsible, conversion, mapping ownership.",
  gap:
"The search is recorded so nobody repeats it. The answer is a RACI line, "
+ "and it belongs with questions 11, 12 and 15 as one decision rather than "
+ "four.",
  ev: ["Transformation TDD", "SEI Architecture"] },

{ n: 15, conf: "absence",
  body:
"Nothing identifies who confirms that the new Dim/Fact tables behave as "
+ "the current implementation does — DATEROLL and AUTOPOST included. "
+ "Searched for: validation owner, parity testing, acceptance owner, "
+ "DATEROLL, AUTOPOST.",
  gap:
"Note this is not only an ownership gap. Question 107's answer says the "
+ "tooling to PROVE parity exists — Recon 360 and Variance 360, with the "
+ "hops and the eleven metrics — and that the ODI-side run has not been "
+ "done. So the method is available and both the owner and the run are "
+ "missing.",
  ev: ["Transformation TDD", "SEI Architecture"] },
{ n: 21, conf: "codebase", fig: "envs",
  body:
"BBH. Airflow runs inside the CP Integration Hub OpenShift namespace, "
+ "which the environment sizing sheet lists as BBH-hosted OpenShift in all "
+ "four environments. SEI delivers to the boundary — SFTP inbound to BBH "
+ "managed file transfer, and the SEI API proxy outbound from BBH — and "
+ "everything from the landing share onwards is BBH-run.\n\n"
+ "One naming trap worth settling in the same breath: RD is the cluster, "
+ "not an environment. DEV and SIT are two namespaces on the same shared "
+ "non-production cluster, UAT is the QC namespace on that same cluster, "
+ "and production is a separate cluster.",
  gap: "The production cluster and namespace are both recorded as TBD.",
  ev: ["Environment 360 → Topology (sizing sheet, 4 environments)", "DevOps 360"] },

{ n: 27, conf: "codebase",
  body:
"Not yet — and the diagrams are honest about being dual-state rather than "
+ "target-state. Both paths are modelled at once: the topology still carries "
+ "inbound SFTP endpoints into BBH managed file transfer, while the event "
+ "path carries the SDC micro-batch marker protocol (see question 50). "
+ "Reviewing the target state means picking one and deleting the other from "
+ "the diagram, which is a decision this codebase cannot make for you.",
  gap: "No cutover date or dual-run period is recorded for SFTP → SDC.",
  ev: ["Environment 360 → Topology", "Event 360 → Micro-batch"] },

{ n: 35, conf: "codebase",
  body:
"They are shown in Guardrails, read from Oracle rather than from Splunk. "
+ "Per event the table carries the engine, the rule name, the expectation, "
+ "the observed value, the threshold, bad and total row counts, a root cause "
+ "and a sample of the offending data — enough to triage without opening a "
+ "log tool.\n\n"
+ "The 'who' is the gap, and it is a schema gap rather than a process one.",
  gap:
"guardrail_events has severity but no owner, assignee, acknowledged-by or "
+ "closed-at column. There is therefore no record of who looked at an "
+ "exception, or whether anyone did. Until that exists, 'who monitors and "
+ "resolves' cannot be evidenced from the platform.",
  ev: ["guardrail_events (sql/24)", "Guardrails 360"] },

{ n: 36, conf: "codebase",
  body:
"In 360, and not only in Splunk. Three screens already read exception data "
+ "straight out of Oracle:\n\n"
+ "• Guardrails reads guardrail_events — rule, expectation, observed value, "
+ "threshold, bad/total row counts, root cause, bad-data sample.\n"
+ "• Recon 360 reads recon_pr_break — row-level breaks typed MISSING, EXTRA "
+ "or MISMATCH, with the primary key and the differing columns.\n"
+ "• Variance 360 reads recon_summary — per-table variance score, worst hop "
+ "and a RAG status.\n\n"
+ "So the business-tool surface exists today. Splunk is not the only place "
+ "these land; in this codebase it is not a surface at all.",
  gap:
"What this repo does not contain is the writer. The Jenkins pipeline "
+ "publishes to the guardrail tables, but the runtime DQ engine that would "
+ "populate guardrail_events per business date lives outside it.",
  ev: ["guardrail_events (sql/24)", "recon_pr_break (sql/35)", "recon_summary (sql/31)"] },

{ n: 37, conf: "codebase", fig: "hops",
  body:
"Variance 360 profiles every column at every stage and compares adjacent "
+ "stages. recon_profile records, per run / lineage id / stage / column, "
+ "eleven metrics: CNT, NULLS, NDV, SUM, MIN, MAX, AVG, MAXLEN, HASHSUM, "
+ "MIN_D and MAX_D. recon_summary rolls those into per-table break counts on "
+ "three named hops, plus the worst hop, a severity-weighted variance score "
+ "and a RAG status.\n\n"
+ "Completeness is CNT compared across a hop. Value integrity is SUM and "
+ "HASHSUM compared across the same hop — which is the part that catches "
+ "what record counts cannot.",
  gap:
"The model has THREE hops (SRC→STG1, STG1→STG2, STG2→DWH) and this question "
+ "names FOUR layers (Raw → Stage → INT → Dim/Fact). STG2→DWH currently "
+ "collapses the INT layer and the Dim/Fact load into a single hop. If INT "
+ "is a persisted layer it needs its own hop and its own break counter, "
+ "otherwise a break introduced in INT is indistinguishable from one "
+ "introduced by the Dim/Fact load.",
  ev: ["recon_profile (sql/31)", "recon_summary (sql/31)", "Variance 360"] },

{ n: 39, conf: "codebase",
  body:
"Mechanically this is a SUM metric on a market-value column compared "
+ "against the prior business date, and half of it already exists: "
+ "recon_profile captures SUM per column, per stage, per run. A $300M → $30M "
+ "fall is a 90% movement in that one number.\n\n"
+ "Three things are missing before it can fire, and only one of them is "
+ "engineering.",
  gap:
"(1) No business date — see question 42; the string 'business_date' does "
+ "not appear anywhere in this schema, so 'compared to yesterday' has no key "
+ "to compare on. (2) No baseline store: nothing persists an expected range "
+ "or a prior-day value to test against. (3) The tolerance itself is a Data "
+ "Management input, not an engineering one — which is what this question "
+ "is actually asking for.",
  ev: ["recon_profile (sql/31)", "Variance 360"] },

{ n: 40, conf: "codebase",
  body:
"Today, it would not — and this is worth stating plainly because the "
+ "failure is silent. CNT is captured per stage per run, so the drop is "
+ "computable in principle. But recon_summary derives its RAG status from "
+ "breaks BETWEEN STAGES WITHIN ONE RUN, not between runs. A snapshot that "
+ "arrives at 10% of its normal size reconciles perfectly from Stage to INT "
+ "to Dim/Fact — every row that arrived was carried faithfully — and comes "
+ "out GREEN.\n\n"
+ "A uniformly short file is the one shape this design is blind to.",
  gap:
"Needs a run-over-run baseline keyed by (table, metric, business_date), and "
+ "a volume control that is evaluated at ingestion rather than between "
+ "stages. Stage-to-stage reconciliation can never detect it by construction.",
  ev: ["recon_profile (sql/31)", "recon_summary (sql/31)"] },

{ n: 41, conf: "codebase",
  body:
"Prior-day and expected-range comparison are both supportable from "
+ "recon_profile, which already stores the metrics; what is missing is the "
+ "comparison and the baseline (see questions 39 and 40).\n\n"
+ "Grain is the harder half of this question. recon_profile is keyed to "
+ "table and column. Account-, feed- and portfolio-level thresholds are a "
+ "different grain and cannot be derived from it — they need their own "
+ "profile rows, which multiplies the metric volume by the cardinality of "
+ "whichever dimension you pick.",
  gap:
"Decide the grain before building the control: table-level is nearly free, "
+ "account-level is not, and the two have very different storage and runtime "
+ "costs.",
  ev: ["recon_profile (sql/31)"] },

{ n: 42, conf: "codebase",
  body:
"Partially — and the missing piece is exactly the one this question names.\n\n"
+ "guardrail_events ties a failure to the incident (event_id), to the run "
+ "(run_id, run_ts) and to what failed (dataset, model, column, rule, "
+ "expectation, observed value) with a sample of the offending rows. That "
+ "much is specific.\n\n"
+ "It does not carry a business date. The string 'business_date' does not "
+ "appear in any table in this schema. So an event can be tied to a run, but "
+ "not to the date the run was processing — and an original run and a replay "
+ "of the same date are indistinguishable from the event row alone.\n\n"
+ "That is also why the failure mode you describe is possible: matching on "
+ "transaction id alone has no date and no run dimension to disambiguate it, "
+ "so the first FACT with that id closes the incident.",
  gap:
"Add business_date to guardrail_events, and resolve against the tuple "
+ "(source record, business_date, run_id) rather than the business key alone.",
  ev: ["guardrail_events (sql/24)"] },

{ n: 43, conf: "codebase", fig: "hops",
  body:
"Counts matching while values are wrong is precisely what the profile "
+ "metrics are for — CNT alone IS the false green, and the other ten metrics "
+ "exist because of it:\n\n"
+ "• HASHSUM — values changed without the count changing.\n"
+ "• SUM — sign flips and scale errors (units, minor/major currency).\n"
+ "• NDV — a column collapsing to a single value or to nulls.\n"
+ "• NULLS — a mapping that silently dropped on one side.\n"
+ "• MIN_D / MAX_D — a date window that shifted.\n\n"
+ "At row level, recon_pr_break types every break as MISSING, EXTRA or "
+ "MISMATCH and carries the primary key, the differing column list and both "
+ "sides' values — masked where the column is classified PII. So a mismatch "
+ "names the key and the columns rather than reporting a delta.",
  gap:
"Three of the six things you list are NOT covered. Duplicates: NDV against "
+ "CNT hints at them but nothing asserts key uniqueness. Relationship "
+ "validity: there is no referential check between a FACT and its "
+ "dimensions. Replay: nothing reconciles a replayed run against the run it "
+ "replaced. Rejects are covered only insofar as they appear as MISSING.",
  ev: ["recon_profile (sql/31)", "recon_pr_break (sql/35)", "Recon 360", "Variance 360"] },

{ n: 49, conf: "codebase",
  body:
"Interface 360 is the nearest thing that exists and is the natural home for "
+ "it: the interface catalogue already carries a frequency and an intraday "
+ "flag per interface. That is a schedule, though, not a calendar — it says "
+ "how often an interface runs, not which interfaces are expected on a "
+ "specific date.",
  gap:
"No calendar exists. Turning the catalogue into one needs an effective-dated "
+ "expected-set per business date (see questions 52 and 54), holiday and "
+ "month-end handling (question 53), and a named owner for the content — "
+ "which is the 'who decides it' half of this question and is not an "
+ "engineering choice.",
  ev: ["Interface 360 (frequency, intraday)"] },

{ n: 50, conf: "codebase", fig: "markers",
  body:
"Two paths, and they are in very different states.\n\n"
+ "ON THE EVENT / SDC PATH there is an explicit protocol. Each subscribed "
+ "topic receives a START marker carrying the micro-batch key, then its data "
+ "events, then its own END marker. The batch is complete only once the last "
+ "topic has closed — and a topic that receives no data events at all is "
+ "still a valid, complete topic, which is the case most naive "
+ "implementations get wrong. Every marker is catalogued with what it means, "
+ "what a consumer should DO when it sees one, and a citation to the section "
+ "of the SEI document it came from.\n\n"
+ "ON THE FILE / SFTP PATH there is no equivalent in this codebase. "
+ "FILE_NAME + BUSINESS_DATE identifies a file; nothing signals that it has "
+ "finished arriving. A partially-written file is readable.",
  gap:
"For files, pick one: a trailer record with a row count, a .done sentinel "
+ "written after close, or a manifest per business date. Size-stable polling "
+ "is the usual fallback and is the weakest of the options.",
  ev: ["ref_micro_batch_marker (sql/63)", "Event 360 → Micro-batch"] },

{ n: 51, conf: "codebase",
  body:
"No. A corrected resend collides with the original on (FILE_NAME, "
+ "BUSINESS_DATE) — the key cannot hold both, so either the resend is "
+ "rejected as a duplicate or it silently overwrites the record of the "
+ "original.\n\n"
+ "Worth noting the event path solved exactly this by adding a micro-batch "
+ "key, which is what lets a second delivery for the same date be a distinct "
+ "batch rather than a collision (question 50).",
  gap:
"The file path needs the same third element — a delivery sequence or batch "
+ "key — making it (FILE_NAME, BUSINESS_DATE, DELIVERY_SEQ). This is the "
+ "same underlying issue as questions 55, 56 and 72.",
  ev: ["ref_micro_batch_marker (sql/63)"] },

{ n: 57, conf: "absence",
  body:
"Nothing in this codebase prevents it.\n\n"
+ "The landing share is a CIFS share mounted into the namespace as an RWX "
+ "volume, which is drawn explicitly on the Hub topology. RWX means every "
+ "worker pod sees every file — that is the point of it, and it is also the "
+ "exposure. There is no claim table, no lease column, no owner field and no "
+ "rename-on-claim step modelled anywhere.",
  gap:
"The two standard fixes: an atomic rename into a per-worker directory "
+ "before reading (POSIX rename is atomic; over CIFS this needs checking "
+ "against the storage backend), or an insert into FILE_REGISTRY under a "
+ "unique constraint on (file_name, business_date) before any read, so the "
+ "second worker loses the race at the database. FILE_REGISTRY is referenced "
+ "throughout these questions but its DDL is not in this repository.",
  ev: ["Environment 360 → Topology (CIFS 445 → RWX PVC)"] },

{ n: 62, conf: "codebase", fig: "runstate",
  body:
"The state vocabulary is already there; the liveness is not.\n\n"
+ "guardrail_gate_run.status is one of passed, failed, warning, skipped, "
+ "RUNNING or NOT_RUN — so 'triggered but nothing is running' is "
+ "representable. What the row cannot tell you is whether anything is still "
+ "alive: there is no queued_at, no heartbeat timestamp and no worker id. A "
+ "pod that dies mid-gate leaves status='running' forever, and nothing reaps "
+ "it.\n\n"
+ "One structural point that this question sits on top of, and that is worth "
+ "settling before adding columns: a GATE RUN belongs to a COMMIT (release, "
+ "branch, build — no business date) and a GUARDRAIL EVENT belongs to a RUN "
+ "ON A BUSINESS DATE (dataset, row counts — no commit). They are separate "
+ "tables deliberately. They must not be joined on a shared idea of 'run', "
+ "because they are different grains.",
  gap:
"Add queued_at, heartbeat_at and worker_id, and a reaper that moves stale "
+ "'running' rows to a terminal state with a reason. Without the reaper the "
+ "extra columns only record the stall more precisely.",
  ev: ["guardrail_gate_run (sql/67)"] },

{ n: 64, conf: "absence",
  body:
"Nobody, in the sense that matters: no table in this estate has an owner, "
+ "assignee or acknowledgement column — not guardrail_events, not "
+ "guardrail_gate_run, not recon_summary. Severity is recorded everywhere; "
+ "ownership is recorded nowhere.\n\n"
+ "So the reconciliation that would detect an orphaned trigger can be built "
+ "(question 62 says what it needs), but who is accountable for acting on "
+ "its output is not a fact the platform can currently hold.",
  gap: "Ownership needs to be a column before it can be a process.",
  ev: ["guardrail_events (sql/24)", "guardrail_gate_run (sql/67)"] },

{ n: 74, conf: "inference",
  body:
"The structural answer is the one the question already contains: the replay "
+ "payload must not live in a layer that has a retention clock. An immutable "
+ "RAW pointer or a copy of the payload in a replay store, with its own "
+ "retention set from the maximum dependency wait rather than from INT's "
+ "needs.\n\n"
+ "What this codebase adds is a sharper version of the risk. No retention "
+ "policy is recorded anywhere in this schema — for INT or for anything else "
+ "(see questions 99 and 100). So the 7-day figure is an operating "
+ "assumption rather than a declared property, and it could be changed by "
+ "someone tuning storage without any visibility that replay depends on it.",
  gap:
"Retention cannot be set independently of replay. Whoever sets the INT "
+ "retention needs to know the maximum dependency wait, and today neither "
+ "number is written down.",
  ev: ["Environment 360 → Topology (no retention recorded)"] },

{ n: 77, conf: "codebase",
  body:
"The topology models the landing share as a CIFS share reached on port 445 "
+ "and mounted into the namespace as an RWX persistent volume — that is "
+ "drawn explicitly on the Hub topology, not inferred.\n\n"
+ "Recorded capacity: 20 GB for the landing share in every environment, and "
+ "10 GB of namespace storage in DEV, SIT and UAT against 25 GB in "
+ "production.",
  gap:
"The OpenShift storage class and the provisioner behind the PVC are not "
+ "recorded anywhere in this estate. Quarantine and archive are not sized "
+ "separately either — the 20 GB is the share as a whole, so the three "
+ "directories compete for one allocation.",
  ev: ["Environment 360 → Topology (CIFS 445 → RWX PVC)"] },

{ n: 78, conf: "absence",
  body:
"There is no evidence of such a test in this estate, and there is a prior "
+ "problem: the storage class is not named anywhere (question 77), so there "
+ "is nothing on paper to have tested it against.\n\n"
+ "RWX is asserted in the topology because the design needs it — multiple "
+ "worker pods reading one landing share. Whether the backing storage class "
+ "actually grants ReadWriteMany, and at what concurrency it stays correct, "
+ "is unrecorded.",
  gap:
"Name the storage class, then test it for concurrent access specifically — "
+ "including whether rename is atomic across pods, which question 57 depends "
+ "on.",
  ev: ["Environment 360 → Topology"] },

{ n: 80, conf: "absence",
  body:
"None today. A probe framework exists — env_probe and env_probe_result — "
+ "and env_workload records what runs where, so there is somewhere for this "
+ "to live. But no probe in this repository measures volume utilisation and "
+ "no threshold is configured.\n\n"
+ "The thing that would fill is the 20 GB landing share, which holds "
+ "landing, quarantine and archive together (question 77). Archive grows "
+ "monotonically unless something purges it, and no purge rule is recorded "
+ "(question 100).",
  gap:
"A utilisation probe plus a threshold, and — more urgently — an archive "
+ "purge rule, because an alert on a volume nobody is allowed to empty only "
+ "tells you the outage is coming.",
  ev: ["env_probe / env_probe_result (sql/44)", "env_workload (sql/48)"] },

{ n: 81, conf: "codebase", fig: "sizing",
  body:
"No — and the sizing sheet says so itself rather than this being an "
+ "inference.\n\n"
+ "The environment sizing sheet carries a Growth column. Its value is TBD on "
+ "EVERY row, in all four environments: the Hub namespace, the landing "
+ "share, both databases and every consumer. The 20 GB share and the "
+ "10 GB / 25 GB namespace figures are allocations somebody chose, not the "
+ "output of a volumetric calculation.\n\n"
+ "There is also nothing to check them against: no file size, arrival volume "
+ "or row-count estimate is recorded anywhere in this estate (question 83).",
  gap:
"Volumetrics first — largest file, daily total, archive retention period — "
+ "then the PVC sizes fall out of them. Doing it the other way round is how "
+ "a landing share fills on a month-end.",
  ev: ["Environment 360 → Topology (Growth = TBD on all rows)"] },

{ n: 83, conf: "absence",
  body:
"None of the four is recorded.\n\n"
+ "The databases are sized — 62 GB RAM, 8 CPU, 4–6 TB storage — but that is "
+ "the server, not the connection limit, and the sheet lists the Oracle JDBC "
+ "port itself as TBD in every environment. There is no volumetrics table in "
+ "this estate: no maximum file size, no arrival profile, no processing "
+ "window.\n\n"
+ "These four numbers are load-bearing for several other answers — the pool "
+ "size in question 84, the PVC sizing in question 81, the SLA cutoff in "
+ "question 91 — so they are worth getting first rather than in parallel.",
  gap: "All four need to come from the source systems; none is derivable here.",
  ev: ["Environment 360 → Topology"] },

{ n: 84, conf: "absence",
  body:
"There is no evidence for it in this repository.\n\n"
+ "It is worth reading the proposed number against the namespace sizing, "
+ "though, because the two are in tension: non-production namespaces are "
+ "allocated 4 GB of memory and 2 CPU. Eight to ten concurrent worker slots "
+ "inside 2 CPU is heavy oversubscription whatever evidence is eventually "
+ "produced for the pool number — the slots will exist and will not have "
+ "cores to run on.\n\n"
+ "Pool size and namespace request have to be decided together; either one "
+ "alone is meaningless.",
  gap:
"Needs the concurrency the workload actually requires (from question 83's "
+ "arrival profile), and then a namespace request sized to it — or an "
+ "explicit decision that non-production runs at reduced concurrency.",
  ev: ["Environment 360 → Topology (4 GB / 2 CPU non-prod)"] },

{ n: 86, conf: "codebase", fig: "sizing",
  body:
"What is recorded is a step, not a strategy. Non-production namespaces are "
+ "4 GB / 2 CPU; production is 16 GB / 16 CPU — 4× the memory and 8× the "
+ "CPU — and the Growth column is TBD on every row (question 81).\n\n"
+ "The consequence is worth stating because it affects go-live evidence "
+ "(question 108): performance testing in UAT runs at one-eighth of "
+ "production CPU. A UAT pass is therefore not evidence of production "
+ "throughput, and a UAT failure may be an artefact of the namespace rather "
+ "than of the code.",
  gap:
"Either size a performance environment to production shape for the test "
+ "window, or state explicitly what UAT timings are and are not evidence "
+ "for. Scaling beyond that — horizontal pod autoscaling, pool growth — is "
+ "not addressed anywhere.",
  ev: ["Environment 360 → Topology"] },

{ n: 87, conf: "codebase",
  body:
"No. There are three different run identifiers in three unrelated tables, "
+ "and nothing joins them:\n\n"
+ "• guardrail_events.run_id — a runtime DQ run.\n"
+ "• recon_profile.run_id / recon_summary.run_id — a variance run.\n"
+ "• guardrail_gate_run.gate_run_id — a CI gate run, which belongs to a "
+ "COMMIT and not to a business date at all.\n\n"
+ "So a file cannot currently be followed from arrival through "
+ "transformation to load by any single key, in Splunk or anywhere else.",
  gap:
"Mint a correlation id at file arrival and carry it on every row written "
+ "downstream, including into the log lines. This depends on question 42's "
+ "business_date as well — a correlation id without a business date still "
+ "cannot distinguish a run from its replay.",
  ev: ["guardrail_events (sql/24)", "recon_profile (sql/31)", "guardrail_gate_run (sql/67)"] },

{ n: 90, conf: "absence",
  body:
"Correct, and the codebase confirms the premise: there is no alert-state "
+ "table anywhere in this schema.\n\n"
+ "guardrail_events records the FAILURE, not the NOTIFICATION. There is no "
+ "sent-at, no suppression key, no acknowledgement and no recovery-close "
+ "column. So duplicate suppression, correlation and recovery closure are "
+ "whatever the alerting tool does internally, with nothing on the Oracle "
+ "side to reconcile against — and no way to prove after the fact that an "
+ "alert was delivered.",
  gap:
"If alert delivery needs to be auditable, alert state has to be persisted "
+ "where the audit lives. A suppression key of (rule, dataset, "
+ "business_date) would be the natural grain — which again needs "
+ "business_date (question 42).",
  ev: ["guardrail_events (sql/24)"] },

{ n: 94, conf: "absence",
  body:
"Nothing is recorded. API 360 catalogues the APIs in detail, but the "
+ "catalogue has no availability, latency, throughput or uptime field — I "
+ "checked the schema for all four.\n\n"
+ "The catalogue is the right home for them if they are agreed: adding the "
+ "targets as columns there would make them visible next to the API they "
+ "apply to, rather than living only in a document.",
  gap: "The targets themselves are a business decision, not a platform fact.",
  ev: ["API 360 (no SLA columns in sql/07, sql/36)"] },

{ n: 99, conf: "absence",
  body:
"None is recorded. No retention period, purge rule or archive policy exists "
+ "in this schema for any table — RAW, Stage 2, the orchestration tables or "
+ "the guardrail tables. Several tables carry updated_at, which is enough to "
+ "implement a purge against, but no policy says what the value should be "
+ "and no purge job exists.",
  gap:
"Two of these are not independent of other answers: orchestration-table "
+ "retention bounds how far back an incident can be investigated (question "
+ "42), and INT retention bounds replay (question 74). Set those two from "
+ "their dependents, not from storage cost.",
  ev: ["sql/ (no retention policy in any table)"] },

{ n: 100, conf: "absence",
  body:
"Same position as question 99: no purge rule exists for RAW, for the "
+ "registry, for archive or for log evidence. Archive is the one that bites "
+ "first, because it grows monotonically inside the same 20 GB allocation as "
+ "landing and quarantine (question 77) with no utilisation alert on it "
+ "(question 80).",
  gap:
"Needs a retention period per artefact class with its justification "
+ "recorded — compliance, audit or operational — because the three will give "
+ "different answers and the longest one wins.",
  ev: ["Environment 360 → Topology (20 GB shared allocation)"] },

{ n: 101, conf: "inference",
  body:
"It cannot be guaranteed today, because the dependency is undocumented in "
+ "both directions: no purge rule exists (questions 99 and 100), and no "
+ "statement exists of how far back restatement or audit must be able to "
+ "reach.\n\n"
+ "The specific trap is the one in question 74: a replay that depends on "
+ "data in a layer with a shorter retention than the maximum wait will fail "
+ "silently, and it will fail long after the retention was set.",
  gap:
"Derive every retention period from its longest consumer and record which "
+ "consumer that was. A purge rule with no stated dependant will be shortened "
+ "by whoever next needs the space.",
  ev: ["Environment 360 → Topology"] },

{ n: 102, conf: "absence",
  body:
"Not in this estate. What exists is the inventory a recovery procedure "
+ "would be written against — env_infra, env_workload, env_probe and the "
+ "four-environment topology — but no documented procedure for a database, "
+ "OpenShift or storage outage.\n\n"
+ "One structural fact helps: production is a separate OpenShift cluster "
+ "from the shared non-production one, so a non-production cluster failure "
+ "does not take production with it. The converse is also true and less "
+ "comfortable — a production cluster failure has no warm alternative "
+ "recorded anywhere.",
  gap: "No procedure, no runbook, and no recorded test of either.",
  ev: ["env_infra (sql/43)", "env_workload (sql/48)", "Environment 360"] },

{ n: 103, conf: "absence",
  body:
"Neither is recorded. I searched the whole schema and the environment "
+ "screens: no RTO and no RPO value exists for any component, in any "
+ "environment.\n\n"
+ "Two things in these answers depend on the numbers, so they are worth "
+ "setting early rather than at the end: the compensation/restore process in "
+ "question 107 has to be sized against an RTO, and retention (questions 99 "
+ "to 101) has to be at least as long as the RPO window.",
  gap: "Both are business inputs. Nothing here can derive them.",
  ev: ["sql/ (no RTO/RPO recorded)", "Environment 360"] },

{ n: 106, conf: "codebase", fig: "deploy",
  body:
"Liquibase, running as its own pipeline on its own cadence rather than "
+ "inside the application build — which is the main structural decision and "
+ "is already made.\n\n"
+ "guardrail_changeset records, per change: the author, the filename, a "
+ "description, the change type, WHETHER A ROLLBACK IS DECLARED, WHETHER IT "
+ "IS DATA-SAFE, the release and build that carried it, its labels and "
+ "contexts, and its position in the changelog.\n\n"
+ "guardrail_changeset_applied records where it actually landed: "
+ "environment, tag, applied-at, exec type and CHECKSUM.\n\n"
+ "The checksum is the safety property that matters most here. A changeset "
+ "whose checksum differs between two environments has been edited after it "
+ "was applied somewhere — Liquibase will refuse it, and Compare shows it "
+ "before the pipeline gets there. Compare also shows, for any two "
+ "environments, exactly which changesets one is ahead by and what risk each "
+ "one carries.",
  gap:
"guardrail_deployment has no image_digest, so a database tag cannot "
+ "currently be tied to the exact application image it was deployed "
+ "alongside. The digest is the one identifier that is identical in every "
+ "environment, which makes it the right join key.",
  ev: ["guardrail_changeset (sql/69)", "guardrail_changeset_applied (sql/69)", "Guardrails → Compare"] },

{ n: 107, conf: "codebase", fig: "rollback",
  body:
"You are right, and this is the question the Compare screen was built "
+ "around. The answer starts by splitting it in two, because rolling back "
+ "the code and getting the data back are different questions with different "
+ "answers.\n\n"
+ "So guardrail_changeset carries TWO flags, not one:\n\n"
+ "• rollback_declared — is there a rollback block at all?\n"
+ "• data_safe — if you run it, do you get the data back?\n\n"
+ "A DROP COLUMN answers YES to the first and NO to the second. A single "
+ "'rollbackable' flag would have reported it as safe, which is exactly the "
+ "failure this question describes. Compare classifies every changeset an "
+ "environment is ahead by into no-rollback, rollback-not-data-safe and "
+ "destructive, and counts the lossy ones separately from the total so the "
+ "headline cannot hide them in a denominator.\n\n"
+ "That gives you DETECTION, on screen, before promotion.",
  gap:
"Two things you asked for do not exist. (1) No tested compensation or "
+ "restore process is recorded anywhere in this estate, and no RTO to size "
+ "one against (question 103). Detection without a rehearsed restore is half "
+ "a control. (2) No ODI-to-dbt parity evidence. Recon 360 and Variance 360 "
+ "are the right tools to produce it — the hops, the eleven metrics and the "
+ "row-level break typing are all there (questions 37 and 43) — but the "
+ "ODI-side run has not been done, and record-and-value parity is a claim "
+ "until it has.",
  ev: ["guardrail_changeset (sql/69)", "Guardrails → Compare", "Recon 360", "Variance 360"] },

{ n: 108, conf: "absence",
  body:
"Not recorded. But two candidates already exist in a form that could be "
+ "EVIDENCED rather than asserted, which is the useful property for an "
+ "acceptance criterion:\n\n"
+ "• The gate-run stages — governance, performance, testing, security and "
+ "promotion — where each gate records whether it blocks or merely reports. "
+ "'All blocking gates passed in UAT for the release being promoted' is "
+ "checkable from guardrail_gate_run.\n"
+ "• A Recon 360 / Variance 360 parity run against the current ODI output: "
+ "record counts and value sums per table, per hop, with a stated tolerance. "
+ "That is question 107's parity evidence and question 15's 'behaves the "
+ "same' confirmation in one artefact.",
  gap:
"Anything to do with throughput should be stated carefully: UAT runs at "
+ "one-eighth of production CPU (question 86), so a UAT timing is not "
+ "evidence for a production SLA.",
  ev: ["guardrail_gate_run (sql/67)", "Recon 360", "Variance 360"] },
];

export const seedFor = (n) => SEED_ANSWERS.find((s) => s.n === n) || null;

// A seed becomes a real row only when somebody acts on it — accepting or
// editing. Until then it is read-only derived data, so re-deploying with
// a better draft reaches everyone instead of being shadowed by a copy
// written into the store on first load.
export function seedRows(store) {
  const a = (store && store.a) || {};
  return SEED_ANSWERS
    .filter((s) => !a[seedId(s.n)])
    .map((s) => ({ id: seedId(s.n), qid: s.n, body: s.body, gap: s.gap,
      fig: s.fig, ev: s.ev, conf: s.conf, quote: s.quote,
      author: SEED_AUTHOR, draft: true, accepted: false }));
}

// Acting on a seed writes it into the store first, so accept and edit —
// which both read store.a[id] — have a row to work on and the seed's qid
// is not lost.
export function materialise(store, row) {
  if (!row || !isSeedId(row.id) || (store.a && store.a[row.id])) return store;
  const { id, ...rest } = row;
  return { ...store, a: { ...store.a, [id]: rest } };
}
