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
//   practice   what a comparable platform normally does, offered because
//              the question was asked and no BBH document answers it.
//              NOT evidence of anything: it describes the industry, not
//              this estate. Every one names the decision BBH still owns,
//              because a recommendation that hides the choice is worse
//              than no recommendation. These never carry a quote.
export const CONF = {
  codebase:  { label: "from the codebase", c: "#0f4775", bg: "#e4f0fb" },
  absence:   { label: "nothing recorded",  c: "#8c6a1f", bg: "#fdf2e3" },
  document:  { label: "from a document",   c: "#15803d", bg: "#e8f6ed" },
  inference: { label: "reasoned, not read", c: "#7c3aed", bg: "#f1e9fd" },
  // Deliberately the plainest badge of the five. This class is a
  // SUGGESTION — what comparable platforms do — and it must never read
  // as something BBH has decided or a document has stated. It carries no
  // quote, because there is no source text to quote.
  practice:  { label: "industry practice · not BBH's", c: "#475569", bg: "#f1f5f9" },
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

{ n: 1, conf: "document", fig: "terms",
  body:
"The document does not use the word “enriched”. What it describes in that "
+ "position is STAGE 2, defined as the core transformation and metadata "
+ "management layer: business transformations, source-to-target mappings, "
+ "reference data, lineage tracking, audit information and data quality "
+ "controls.\n\n"
+ "So the answerable form of this question is “what is Stage 2”, and that "
+ "is the scope. Reading “enriched” and “Stage 2” as the same thing is "
+ "BBH's inference, not a statement in the pack.\n\n"
+ "AND THE OTHER DOCUMENT DISAGREES WITH THAT INFERENCE. The dbt TDD does "
+ "use the word, as a band label: “SILVER (Enriched)”. There it maps the "
+ "CURRENT STG2 onto TWO new objects — STG (a view) plus INT (persistence) "
+ "— not onto one. So “the enriched layer” names two things, one of which "
+ "stores nothing at all.",
  gap:
"Two things. The pack never uses the word the question is built on, so "
+ "somebody should get SEI to confirm in one line that the enriched layer "
+ "IS Stage 2 — and, given the TDD, whether it is STG, INT, or both. This "
+ "is cheap to settle and expensive to assume. And “business "
+ "transformations” is a category, not a list: no enrichment operation is "
+ "enumerated per interface or domain.",
  quote: QUOTE_STAGE2, ev: [REF_ARCH, "dbt TDD §2 — What Changes and What Stays the Same"] },

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

{ n: 6, conf: "document", fig: "terms",
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

{ n: 7, conf: "document", fig: "layers",
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

{ n: 9, conf: "document", fig: "layers",
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
{ n: 18, conf: "document",
  body:
"It means the Gold tables keep their structure exactly and change only "
+ "their writer. DIM_ACCOUNT, DIM_INTERESTED_PARTY and FACT_TRANSACTIONS "
+ "already exist and already carry live history from ODI; the ODI mappings "
+ "become dbt MERGE statements against the identical, unmodified "
+ "structure.\n\n"
+ "So: no DDL against those three tables, every write is DML-only MERGE "
+ "matched to the current column list, and ACCOUNT_KEY continues to come "
+ "from the existing Oracle sequence so one key series spans the ODI era "
+ "and the dbt era.",
  gap:
"It is a constraint on the Gold tables, not a statement about the logic "
+ "that fills them. Whether each rule behaves as ODI did is question 15, "
+ "and nothing here demonstrates it.",
  quote: "DIM_ACCOUNT, DIM_INTERESTED_PARTY, and FACT_TRANSACTIONS already "
       + "exist and carry live history from ODI. This project changes only how "
       + "they are populated — ODI mappings become dbt MERGE against the "
       + "identical, unmodified structure.",
  ev: ["dbt TDD §6.4 — Gold Constraint: Pre-Existing Tables", "dbt TDD §3.2 — Design Principles"] },

{ n: 19, conf: "document",
  body:
"Yes — that is exactly the stated intent, and the TDD makes it a design "
+ "principle rather than an aspiration: “Never alter a pre-existing Gold "
+ "table's schema — all Gold writes are DML-only MERGE against the current "
+ "column list.”\n\n"
+ "The reason given is cutover risk: those tables hold live production "
+ "history, and a schema change risks breaking downstream consumers "
+ "mid-migration.",
  gap:
"“Business logic recreated as-is” is asserted for the TABLE, not proven "
+ "for the RULES. The parity evidence that would show it — a record-level "
+ "and value-level comparison against the ODI output — is question 107's "
+ "gap and has not been produced.",
  quote: "Never alter a pre-existing Gold table's schema — all Gold writes "
       + "are DML-only MERGE against the current column list.",
  ev: ["dbt TDD §3.2 — Design Principles (p.8)", "dbt TDD §6.4"] },

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

{ n: 32, conf: "document", fig: "dqstore",
  body:
"They are held, not dropped. Every failing record is written to ONE Oracle "
+ "store, DQ_VALIDATION_FAILURE, and does not proceed to the next layer. "
+ "The store carries the exact failed rows plus two markers: a static "
+ "reprocess_eligible flag saying whether this kind of failure can "
+ "auto-replay, and a resolution_status moving OPEN → RESOLVED / CLOSED.\n\n"
+ "The principle is stated flatly: nothing that fails is silently dropped, "
+ "and nothing is loaded with a placeholder key to keep a count up.",
  gap:
"CORRECTED: §7.1 does give the store an end state, which I first recorded "
+ "as missing. Anything still OPEN at the seven-day retention edge is "
+ "CLOSED and alerted, and Splunk reports directly from resolution_status. "
+ "So nothing sits OPEN forever.\n\n"
+ "What remains open is what CLOSED means for the business: the record is "
+ "out of the DQ store and was never loaded to Gold, so the alert is the "
+ "only trace that a transaction was dropped. Who acts on that alert, and "
+ "within what window, is not stated — and after the partition is gone "
+ "there is nothing left to replay from.",
  quote: "No record that fails a DQ check proceeds to the next layer: "
       + "failures are held in the DQ store and replayed once resolvable — "
       + "never silently dropped and never loaded with placeholder keys.",
  ev: ["dbt TDD §3.2 — Design Principles (p.8)", "dbt TDD §7.1 — Capture and Publishing (p.17)"] },

{ n: 33, conf: "document", fig: "dqstore",
  body:
"It depends which category the failure is, and the TDD splits them by "
+ "OWNER:\n\n"
+ "• SOURCE DQ — the incoming record is malformed. Owner: the SWP source "
+ "system. reprocess_eligible = N: nothing BBH does fixes it, so it waits "
+ "for a corrected resend.\n"
+ "• TRANSFORMATION DQ — the record is source-clean but our own mapping or "
+ "Gold logic could not resolve it (an unmapped ACCOUNT_TYPE, a missing "
+ "dimension key). Owner: the BBH/SEI transformation team. "
+ "reprocess_eligible = Y, and it auto-replays once resolvable.\n\n"
+ "The worked case: a transaction arrives on Day N whose account is not yet "
+ "in DIM. It is recorded MISSING_DIMENSION_KEY, eligible, OPEN, and NOT "
+ "loaded. On Day N+1 the dimension arrives, the replay re-derives the OPEN "
+ "row from INT, FACT loads with a real ACCOUNT_KEY, and the status flips "
+ "to RESOLVED.",
  gap:
"CORRECTED: I first wrote that nothing produces CLOSED. §7.1 does — "
+ "anything still OPEN at the seven-day retention edge is CLOSED and "
+ "alerted. Replay is worklist-driven: OPEN eligible rows are re-derived "
+ "from INT, the current dimensions re-checked, and rows that now resolve "
+ "are loaded to FACT and marked RESOLVED.\n\n"
+ "The real gap is narrower and worse: the seven-day window is set by INT's "
+ "partition drop, not by how long a dimension actually takes to arrive. "
+ "Nobody has stated the latter, so nobody can say whether seven days is "
+ "generous or short — see question 74.",
  quote: "On Day N+1 the dimension arrives; the replay step re-derives the "
       + "OPEN row from INT, the fact model resolves it, loads FACT with a "
       + "real ACCOUNT_KEY, and flips resolution_status to RESOLVED.",
  ev: ["dbt TDD §7.1 — Capture and Publishing (p.17)", "dbt TDD §7 — Figure 5a"] },

{ n: 34, conf: "document", fig: "recon",
  body:
"It does not stay complete on the day — and that is deliberate, with an "
+ "equation to prove where the missing rows went.\n\n"
+ "The INT → FACT boundary control is: eligible INT rows = FACT rows loaded "
+ "+ OPEN missing-dimension rows in the DQ store. So a row that is not in "
+ "Gold is accounted for in the DQ store, and the two sides add back to the "
+ "input. Nothing is loaded with a placeholder key to make the count look "
+ "right.\n\n"
+ "Completeness is therefore a property of Gold PLUS the DQ store, not of "
+ "Gold alone — which is the thing a report reading only Gold will get "
+ "wrong.",
  gap:
"Any consumer reading FACT for a business date is reading an incomplete "
+ "picture while rows sit OPEN, and nothing in the design flags that to "
+ "them. Whether a date is safe to report on needs a published signal, not "
+ "a reconciliation somebody runs.",
  quote: "Eligible INT rows = FACT rows loaded + OPEN missing-dimension rows "
       + "in the DQ store; nothing is loaded with a placeholder key.",
  ev: ["dbt TDD §7.2 — Reconciliation Boundaries (p.18)"] },

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

{ n: 37, conf: "document", fig: "recon",
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
  quote: "STG → INT: STG PASS rows = INT rows; STG count = INT count + "
       + "Source-DQ-filtered count. … INT → FACT: Eligible INT rows = FACT rows "
       + "loaded + OPEN missing-dimension rows in the DQ store; nothing is "
       + "loaded with a placeholder key.",
  gap:
"CORRECTED against the dbt TDD. I previously wrote that the design has no "
+ "hop for INT. That is true of Variance 360's three hops, and NOT true of "
+ "the design: §7.2 defines FOUR boundaries, each with an equation that "
+ "must hold or it raises a WARNING —\n\n"
+ "  SWP_RAW → STG   RAW rows = STG rows (the view exposes all; FAIL rows "
+ "carry the flag rather than being dropped)\n"
+ "  STG → INT       STG PASS = INT rows; STG = INT + Source-DQ-filtered\n"
+ "  INT → DIM       NEW + CHANGED = Gold inserts; CHANGED = row closures\n"
+ "  INT → FACT      eligible INT = FACT loaded + OPEN missing-dimension "
+ "rows in the DQ store\n\n"
+ "The real gap is therefore the opposite of what I wrote: the DESIGN has "
+ "four boundaries and VARIANCE 360 HAS THREE. The tool is behind the "
+ "design, and INT→DIM and INT→FACT need their own counters before it can "
+ "evidence this. Note also that status is derived Splunk-side from the "
+ "published counts and is not stored, so there is no queryable history of "
+ "which boundary warned when.",
  ev: ["dbt TDD §7.2 — Reconciliation Boundaries (p.18)", "recon_summary (sql/31)",
       "Variance 360"] },

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

{ n: 44, conf: "document", fig: "layers",
  body:
"Three, in the model as drawn: two dimensions — DIM_ACCOUNT and "
+ "DIM_INTERESTED_PARTY — and one fact, FACT_TRANSACTIONS. They correspond "
+ "to the three INT models (INT_ACCOUNT, INT_INTERESTED_PARTY, "
+ "INT_TRANSACTIONS) and the three RAW objects above them.\n\n"
+ "Grain: each dimension is keyed on its natural key with one ACTIVE_IND=1 "
+ "row at a time; FACT_TRANSACTIONS carries ACCOUNT_KEY resolved against "
+ "DIM_ACCOUNT.",
  gap:
"The ingestion DAG in the same document loads FOUR interfaces — Account, "
+ "Client, Transaction AND POSITION — but no RAW, STG, INT or Gold object "
+ "for Position appears anywhere in the model. Either the model is "
+ "incomplete or Position is loaded and not transformed. That is worth "
+ "asking before the dimension list is treated as final.",
  quote: "DIM_ACCOUNT, DIM_INTERESTED_PARTY, and FACT_TRANSACTIONS already "
       + "exist and carry live history from ODI.",
  ev: ["dbt TDD §4.1 — Medallion Mapping", "dbt TDD §10 — Figure 6, logical data model"] },

{ n: 45, conf: "practice",
  body:
"The usual shape is a three-tier comparison, cheapest first, because a "
+ "row-by-row diff of a full history does not finish:\n\n"
+ "1. COUNTS per table per business date. Catches whole-file and "
+ "whole-partition losses and costs almost nothing.\n"
+ "2. AGGREGATES per table per date — SUM of every monetary column, "
+ "MIN/MAX of dates, COUNT DISTINCT of each key. Catches sign flips, "
+ "scale errors and duplicate explosions that counts miss.\n"
+ "3. ROW HASHES for a sampled or targeted population — a hash of the "
+ "concatenated business columns per key, compared both sides. Catches "
+ "field-level drift. Run full-population once at cutover, sampled "
+ "thereafter.\n\n"
+ "Variance 360 already computes exactly these metrics per column per "
+ "stage (CNT, SUM, HASHSUM, NDV, MIN_D, MAX_D), so tier 1 and 2 are "
+ "available now against an ODI-era snapshot.",
  gap:
"The decisions BBH owns: the tolerance (is a 1-cent rounding difference a "
+ "break?), the population (all accounts, or a stratified sample "
+ "including the awkward ones — closed accounts, multi-currency, "
+ "corrections), and WHEN the ODI side is frozen to compare against. "
+ "Parity against a moving target proves nothing.",
  ev: ["standard migration-parity practice", "Variance 360 (metrics already exist)"] },

{ n: 46, conf: "practice",
  body:
"Three controls, all cheap, and the TDD already has the first:\n\n"
+ "• BUILD ORDER AS A BARRIER. Dimensions complete and pass their tests "
+ "before facts start, so a fact never resolves against a stale "
+ "dimension. The TDD does this (build_dim → test_dim → build_fact).\n"
+ "• A DECLARED GRAIN PER FACT, written down and tested. One row per "
+ "what? The test is a uniqueness assertion on the declared key — if the "
+ "grain is ever violated the build fails rather than the numbers "
+ "doubling quietly.\n"
+ "• CONFORMED DIMENSION OWNERSHIP. One model owns each dimension; "
+ "everything else references it. Two models writing DIM_ACCOUNT is how "
+ "upstream changes reach downstream facts invisibly.\n\n"
+ "For fact-to-fact dependencies the convention is to forbid them: derive "
+ "from the shared dimension, not from another fact, so one fact's "
+ "rebuild cannot silently change another's numbers.",
  gap:
"Whether any fact here depends on another is not stated anywhere — with "
+ "one fact table today it may be moot, but it is the thing to rule on "
+ "before a second one is added.",
  ev: ["Kimball conformed-dimension practice", "dbt uniqueness/relationship tests"] },

{ n: 47, conf: "document", fig: "scd2",
  body:
"The document addresses this directly, and the answer is a rule about "
+ "which WRITE to use — not about lookups.\n\n"
+ "When a corrected record is reprocessed, the mechanism depends on the "
+ "state of the dimension row it belongs to. If the account's ACTIVE_IND=1 "
+ "row is still the one open on the failed business date, a normal MERGE is "
+ "correct. If a later change has already closed that interval "
+ "(ACTIVE_IND=0), the fix must be a direct UPDATE of that specific closed "
+ "historical row and must NOT be a MERGE — a MERGE would reopen a closed "
+ "interval.\n\n"
+ "That is exactly the Monday-replayed-after-Wednesday case you describe, "
+ "and the design names it rather than leaving it to the implementer.",
  gap:
"The rule is stated; the EVIDENCE is not. Nothing shows a test that "
+ "replays a Monday transaction after a Wednesday change and asserts the "
+ "Monday attributes were used. Given that the wrong branch silently "
+ "rewrites history, that test is worth insisting on as an acceptance "
+ "criterion.",
  quote: "A later change has already closed that interval (ACTIVE_IND=0). → "
       + "Direct UPDATE of the specific closed historical row; must NOT MERGE "
       + "(would reopen a closed interval).",
  ev: ["dbt TDD §6.4.1 — SCD2 MERGE and the MERGE-vs-UPDATE Reprocessing Rule (p.15)"] },

{ n: 48, conf: "document", fig: "scd2",
  body:
"The same rule in §6.4.1 is the mechanism: a mid-period correction to a "
+ "closed interval is applied as a direct UPDATE of that historical row, "
+ "because MERGE joins on ACCOUNT_KEY and would reopen the interval.\n\n"
+ "The MERGE path itself is the normal SCD2 shape: a changed account closes "
+ "its current row (ACTIVE_IND → 0, END_DATE set) and opens a new one with "
+ "a new ACCOUNT_KEY and START_DATE = business date.",
  gap:
"Interval SPLITTING is not covered. The document gives the two-branch rule "
+ "for correcting a row, not what happens when a correction lands in the "
+ "middle of a closed interval and should divide it in two, nor what "
+ "happens to FACTs already pointing at the ACCOUNT_KEY being corrected. "
+ "Both are real and neither is addressed.",
  quote: "a changed account closes its current row (ACTIVE_IND → 0, END_DATE "
       + "set) and opens a new one (ACTIVE_IND = 1, new ACCOUNT_KEY, "
       + "START_DATE = business date)",
  ev: ["dbt TDD §6.4.1 (p.15)"] },

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

{ n: 58, conf: "practice",
  body:
"The standard answer is a BUSINESS CALENDAR TABLE, not logic in a DAG. "
+ "One row per date per calendar, saying whether it is a processing day, "
+ "and which calendar applies to which interface — because a "
+ "multi-currency estate has more than one. Currency and market holidays "
+ "do not coincide, and a single “is it a weekday” test is the usual "
+ "source of month-end surprises.\n\n"
+ "The orchestration then asks the calendar rather than computing the "
+ "answer: a non-processing date is seeded COMPLETE with zero expected "
+ "interfaces, or not seeded at all, and both are defensible as long as "
+ "the choice is explicit. The first keeps the date series continuous, "
+ "which makes gap detection trivial, so it is usually preferred.",
  gap:
"BBH owns two decisions nobody has made: whether SWP delivers on "
+ "Saturday and Sunday at all, and if it does, whether BBH processes "
+ "those dates or holds them for the next business day. Those are "
+ "different answers for transactions than for positions, so it is "
+ "probably per-interface rather than global.",
  ev: ["standard business-calendar practice"] },

{ n: 59, conf: "document", fig: "datectl",
  body:
"Confirmed, and that is precisely the design. DATE_CONTROL holds one row "
+ "per business date with a STATUS moving PENDING → TRIGGER → COMPLETE.\n\n"
+ "The Ingestion DAG loads files, then compares the expected interface set "
+ "(FILE_SCHEMA_CONFIG) against the completed set (FILE_REGISTRY). If "
+ "complete it moves PENDING → TRIGGER under a guarded UPDATE "
+ "(SQL%ROWCOUNT = 1, so only one DAG run can trigger) and invokes the "
+ "Transformation DAG. If incomplete it ends normally, the date stays "
+ "PENDING, and the next cycle re-checks.\n\n"
+ "The next date is seeded only by the Transformation DAG, only on success, "
+ "together with its SLA cutoff.",
  gap:
"One thing your summary adds that the document does not: “until all data "
+ "arrives” is bounded by an SLA cutoff. If the cutoff passes while "
+ "interfaces are missing, the date STAYS PENDING, transformation is not "
+ "triggered, and an SLA breach alert goes to Splunk. So the date can sit "
+ "PENDING indefinitely — see question 97.",
  quote: "If complete — it updates DATE_CONTROL PENDING → TRIGGER and "
       + "invokes the Transformation DAG … If incomplete — it ends normally; "
       + "the date stays PENDING and the next cycle re-checks.",
  ev: ["dbt TDD §5.1 — Orchestration State Machine", "dbt TDD §5.3 — Ingestion-to-Transformation Trigger"] },

{ n: 60, conf: "document", fig: "datectl",
  body:
"Yes to both halves, and they are the same mechanism.\n\n"
+ "On failure the run stops with DATE_CONTROL = TRIGGER and restarts from "
+ "the failed task. The date cannot advance because only the FINAL task of "
+ "the Transformation DAG moves it to COMPLETE — so any failure before that "
+ "point leaves it at TRIGGER by construction, rather than by a guard "
+ "somebody remembered to add.\n\n"
+ "Each layer is a build task followed by its own test task, so a restart "
+ "resumes at the layer that failed rather than rebuilding from STG.",
  gap:
"“Restarts from the failed task” is an Airflow clear-and-rerun, which "
+ "assumes the partial write is safe to repeat. That holds for INT "
+ "(partition drop, date-specific) and for DIM/FACT (MERGE), but a run that "
+ "failed BETWEEN build_dim and build_fact leaves the dimension advanced "
+ "and the fact not — recoverable, but the intermediate state is visible to "
+ "anyone reading Gold meanwhile.",
  quote: "On failure the run stops with DATE_CONTROL = TRIGGER and restarts "
       + "from the failed task.",
  ev: ["dbt TDD §5.2 — Figure 3, layer-barrier execution (p.11)"] },

{ n: 61, conf: "practice",
  body:
"The pattern is to make the trigger an OBSERVED FACT rather than a "
+ "fire-and-forget call.\n\n"
+ "The caller writes its intent durably first (status = TRIGGER with a "
+ "run id it generated), then invokes. If the invoke fails, the row "
+ "already records that a run was intended and a reconciler can act on "
+ "it. The downstream run is given a DETERMINISTIC id derived from the "
+ "business date — the TDD does this (transform_{business_date}) — so "
+ "re-invoking is naturally idempotent: either it creates the run or it "
+ "collides with the existing one, and both outcomes are correct.\n\n"
+ "A sweeper then runs on a schedule, finds dates in TRIGGER with no live "
+ "downstream run, and re-invokes. That is the piece questions 62 and 63 "
+ "are both asking for.",
  gap:
"BBH owns the sweep interval and what it does on repeated failure — "
+ "re-invoke forever, or stop after N and page somebody. Forever is the "
+ "wrong default: a date that has failed to start five times is not a "
+ "transient fault.",
  ev: ["idempotent-trigger practice", "dbt TDD §5.3 (deterministic run_id already specified)"] },

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
+ "extra columns only record the stall more precisely.\n\n"
+ "The dbt TDD confirms this is live rather than theoretical: it states "
+ "that the Ingestion DAG acts only on PENDING rows and therefore never "
+ "re-triggers a stuck TRIGGER date, with recovery owned solely by the "
+ "Transformation DAG — the run that, in this failure, was never created. "
+ "See question 63.",
  ev: ["guardrail_gate_run (sql/67)"] },

{ n: 63, conf: "document", fig: "datectl",
  body:
"The document confirms the gap rather than closing it, and says so in one "
+ "sentence: the Ingestion DAG only acts on PENDING rows, so it never "
+ "re-triggers a stuck TRIGGER date — recovery is owned SOLELY by the "
+ "Transformation DAG.\n\n"
+ "So in the crash you describe — PENDING → TRIGGER committed, Airflow dies "
+ "before the Transformation DAG exists — nothing is watching. Ingestion "
+ "will not pick the date up again by design, and the owner of recovery is "
+ "a DAG run that was never created.",
  gap:
"This is the clearest confirmation in the pack that question 62's concern "
+ "is real and currently unaddressed. The guarded UPDATE (SQL%ROWCOUNT = 1) "
+ "correctly stops TWO runs triggering; it does nothing about ZERO. What is "
+ "missing is a reaper: a scheduled check for dates in TRIGGER with no live "
+ "Transformation run, which needs the run-state columns question 62 asks "
+ "for.",
  quote: "The Ingestion DAG only acts on PENDING rows, so it never "
       + "re-triggers a stuck TRIGGER date — recovery is owned solely by the "
       + "Transformation DAG.",
  ev: ["dbt TDD §5.1 — DATE_CONTROL status table (p.11)"] },

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

{ n: 65, conf: "practice",
  body:
"The standard fix is to make LOADING a CLAIM WITH AN EXPIRY rather than "
+ "a status somebody sets.\n\n"
+ "The worker writes LOADING together with a lease: who holds it "
+ "(worker/pod id), when it was taken, and a heartbeat it refreshes while "
+ "working. A crashed worker stops refreshing. A sweeper then finds rows "
+ "in LOADING whose heartbeat is stale, and that is an unambiguous "
+ "signal — not a guess about whether somebody is still going.\n\n"
+ "What the sweeper does next depends on the load being IDEMPOTENT, which "
+ "is the more important half: if the RAW insert is keyed so that "
+ "re-running it cannot duplicate (a natural key plus file identity, or "
+ "a delete-by-file-then-insert inside one transaction), recovery is "
+ "simply “run it again” and the crash needs no special case.",
  gap:
"BBH owns the heartbeat interval and the stale threshold, and they have "
+ "to exceed the longest legitimate pause — a large file, a slow volume. "
+ "Set too short, the sweeper fights a working pod.",
  ev: ["lease/heartbeat practice", "idempotent-load practice"] },

{ n: 66, conf: "practice",
  body:
"By making the file's identity and its loaded footprint both recorded, "
+ "so the question is answered by comparison rather than by judgement.\n\n"
+ "On arrival, record the file's CONTENT HASH and byte size. On load, "
+ "record the ROW COUNT inserted and the hash of the key set. Then "
+ "“should RAW be reloaded?” is three checks: does a registry row exist "
+ "for this file, does its content hash match the file on disk, and does "
+ "the RAW row count for that file identity match what the registry "
+ "says. All three agreeing means loaded; any disagreeing names what "
+ "went wrong.\n\n"
+ "Without the hash, a resend with the same name is indistinguishable "
+ "from the original, which is also question 51.",
  gap:
"The content hash is the piece that does not exist. It is cheap to add "
+ "at arrival and impossible to reconstruct later, so it is worth doing "
+ "before go-live rather than after the first incident.",
  ev: ["content-addressable ingestion practice"] },

{ n: 67, conf: "practice",
  body:
"Three policies are defensible and the choice is a business one, not a "
+ "technical one:\n\n"
+ "• REJECT. The date is closed; a late file is an exception requiring a "
+ "restatement. Simplest, and the only one where a published figure never "
+ "changes under a consumer.\n"
+ "• ACCEPT INTO A NEW CYCLE. The file is loaded against the same "
+ "business date as a new delivery, the date reopens to PENDING, and "
+ "everything downstream reruns. Safe only if every downstream consumer "
+ "can tolerate a restated date.\n"
+ "• ACCEPT AS NEXT-DAY. The rows are loaded with the next business date "
+ "and flagged as late. Keeps published history immutable, moves the "
+ "distortion forward.\n\n"
+ "Most custody and fund platforms land on REJECT plus an explicit "
+ "restatement path, because silent reopening of a closed date is what "
+ "breaks downstream reconciliations.",
  gap:
"Whichever is chosen, the design must ENFORCE it — today nothing in "
+ "DATE_CONTROL stops a load against a COMPLETE date, so the answer is "
+ "currently “whatever the ingestion code happens to do”.",
  ev: ["late-arriving-data practice"] },

{ n: 68, conf: "practice",
  body:
"By making restatement a FIRST-CLASS, VERSIONED operation rather than a "
+ "reload.\n\n"
+ "The pattern: RAW is append-only and never edited — a corrected file is "
+ "a new delivery with its own identity, not an overwrite. The business "
+ "date is reopened explicitly, with a recorded reason and actor. "
+ "Downstream is rebuilt from RAW deterministically, so Gold is always a "
+ "pure function of RAW plus the code version. And the restatement is "
+ "announced: consumers are told that date changed, rather than "
+ "discovering it.\n\n"
+ "The property that keeps RAW and Gold in step is determinism — if "
+ "rebuilding from RAW cannot reproduce Gold, they are already out of "
+ "sync and nobody can tell.",
  gap:
"The announcement is the part teams skip and then regret. A restatement "
+ "nobody downstream was told about is indistinguishable from a bug in "
+ "their own reconciliation.",
  ev: ["append-only RAW / deterministic rebuild practice"] },

{ n: 69, conf: "practice",
  body:
"Treat the archive move as a cleanup that may be repeated, never as the "
+ "thing that records success.\n\n"
+ "Order matters: commit the data AND the registry row in one "
+ "transaction, then move the file. If the worker dies between the two, "
+ "the database already says the file is loaded and the file is still in "
+ "landing — which is a recoverable, self-describing state. A sweeper "
+ "finds files in landing that the registry says are loaded, and moves "
+ "them.\n\n"
+ "The failure to avoid is the reverse order: move first, commit second. "
+ "Then a crash leaves a file that is archived and not loaded, and "
+ "nothing in landing to notice.",
  gap:
"Which order the implementation uses is not recorded anywhere, and it is "
+ "the single most consequential detail in this question. Worth "
+ "confirming in one line of the DAG code.",
  ev: ["commit-then-move practice"] },

{ n: 70, conf: "practice",
  body:
"Same answer as question 69 and it generalises, which is the point: on "
+ "OpenShift a pod can vanish at any instruction — OOM kill, eviction, "
+ "node drain, a rolling deploy — so recovery cannot depend on anything "
+ "running after the crash.\n\n"
+ "So: the database transaction is the commit point, the file move is "
+ "idempotent cleanup, and every step is safe to repeat. The pod gets a "
+ "termination grace period and handles SIGTERM to finish or abandon "
+ "cleanly, but that is an optimisation — correctness must not rely on "
+ "it, because an OOM kill gives no signal at all.\n\n"
+ "Detection is the lease from question 65: a claim with a stale "
+ "heartbeat is a crashed worker, whatever killed it.",
  gap:
"Eviction and OOM are the realistic causes here given the 4 GB "
+ "non-production namespaces (question 84), so this is not a "
+ "once-a-year scenario — it is a weekly one until the sizing is settled.",
  ev: ["Kubernetes pod-lifecycle practice", "crash-only design"] },

{ n: 71, conf: "practice",
  body:
"Two shapes are normal, and they behave very differently under load:\n\n"
+ "• TASK-PARALLEL within the DAG — Airflow fans out one task per "
+ "interface, bounded by a pool. Visible in the UI, retried per task, "
+ "and the concurrency ceiling is the pool size. This is what the "
+ "proposed pool of 8–10 implies (question 84).\n"
+ "• QUEUE-AND-WORKER — the DAG enqueues work and long-lived workers "
+ "consume it. Better for uneven arrival, worse for observability, and "
+ "it needs its own retry and dead-letter handling.\n\n"
+ "For a daily batch with a known interface list, task-parallel is almost "
+ "always right: the work is bounded, the fan-out is knowable in advance, "
+ "and Airflow already gives per-task retry and visibility for free.",
  gap:
"Whichever it is, the concurrency limit has to be set from the Oracle "
+ "connection ceiling and the namespace CPU, not chosen independently — "
+ "see questions 83 and 84.",
  ev: ["Airflow fan-out practice"] },

{ n: 72, conf: "practice",
  body:
"It should not, and this is the clearest smell in the questions.\n\n"
+ "A registry is an audit record of what arrived and what was done with "
+ "it. Deleting the row to allow a reload destroys the only evidence that "
+ "the first delivery happened, which is exactly the evidence an auditor "
+ "asks for after a restatement. It also makes the reload "
+ "indistinguishable from a first load.\n\n"
+ "The standard shape is append-only with a version or sequence per "
+ "(interface, business date): the original row stays, is marked "
+ "SUPERSEDED, and the corrected delivery is a new row pointing at it. "
+ "The question “what did we receive and when” then still answers "
+ "correctly a year later.",
  gap:
"If the delete exists to satisfy a unique constraint on (FILE_NAME, "
+ "BUSINESS_DATE), the fix is the constraint, not the delete — add the "
+ "delivery sequence from question 51 and the conflict disappears.",
  ev: ["append-only audit practice"] },

{ n: 73, conf: "practice",
  body:
"Yes — and this is the same change as question 72, which is worth "
+ "treating as one piece of work rather than two.\n\n"
+ "Keep the original lifecycle intact and add two things: a version or "
+ "delivery sequence that makes a resend a new row, and a status that "
+ "can express SUPERSEDED alongside the existing terminal states. "
+ "Current state is then “the highest-sequence row that is not "
+ "superseded”, which is one predicate rather than a story somebody "
+ "reconstructs.\n\n"
+ "The cost is one column and one index. The benefit is that “how many "
+ "times did this interface get restated last quarter” becomes a query "
+ "instead of a Splunk archaeology exercise.",
  gap:
"Decide whether restatement is per-file or per-business-date. Per-file "
+ "is finer and matches how corrections actually arrive; per-date is "
+ "simpler and matches how DATE_CONTROL already thinks. They disagree "
+ "when one of five interfaces is restated.",
  ev: ["append-only audit practice", "SCD-style versioning"] },

{ n: 74, conf: "document",
  body:
"The structural answer is the one the question already contains: the replay "
+ "payload must not live in a layer that has a retention clock. An immutable "
+ "RAW pointer or a copy of the payload in a replay store, with its own "
+ "retention set from the maximum dependency wait rather than from INT's "
+ "needs.\n\n"
+ "THE dbt TDD CONFIRMS THE RISK RATHER THAN RESOLVING IT, and it does so in "
+ "two separate sections that are never read together. §6.5: INT is "
+ "partitioned by BUSINESS_DATE and purged by DROP PARTITION after seven "
+ "days. §7 / Figure 5a: the replay step RE-DERIVES THE OPEN ROW FROM INT. "
+ "So the replay source and the thing on a seven-day clock are the same "
+ "object.\n\n"
+ "A held transaction whose dimension arrives on day eight has nothing left "
+ "to re-derive it from.\n\n"
+ "§7.1 does handle this, and it is worth being precise about HOW: anything "
+ "still OPEN at the seven-day edge is CLOSED and alerted. So the loss is "
+ "DETECTED and raised — it is not silent. But closed-and-alerted is not "
+ "replayed: the transaction is still not in FACT, and the data it was "
+ "derived from is gone. The control turns a silent loss into a visible "
+ "one, which is a real improvement and is not the same as durability.",
  gap:
"Retention cannot be set independently of replay, and the seven days comes "
+ "from INT's partition drop rather than from any measured dependency wait "
+ "— nobody has stated the latter, so nobody can say whether seven days is "
+ "generous or short.\n\n"
+ "Your original point stands: keeping the replay payload, or an immutable "
+ "RAW pointer, OUTSIDE INT is what makes the window a choice rather than a "
+ "side effect of a storage decision. The alert at the edge tells you how "
+ "often it would have mattered, which is the cheap way to find out before "
+ "building it.",
  quote: "INT is partitioned by BUSINESS_DATE and purged with ALTER TABLE … "
       + "DROP PARTITION (near-instant metadata work) rather than a row-level "
       + "DELETE.",
  ev: ["dbt TDD §6.5 — INT Retention via Partition Drop (p.15)",
       "dbt TDD §7.1 — Capture and Publishing (p.17)"] },

{ n: 75, conf: "practice",
  body:
"The usual governance is a short matrix saying, for each failure class, "
+ "who retries and how many times before a human is involved:\n\n"
+ "• TRANSIENT infrastructure (connection reset, pod evicted, lock "
+ "timeout) — automatic retry with bounded exponential backoff, no "
+ "notification unless the bound is hit.\n"
+ "• DATA THAT MAY RESOLVE ITSELF (a missing dimension) — no task retry; "
+ "the row goes to the DQ store as reprocess-eligible and is replayed on "
+ "a later cycle. The TDD specifies exactly this.\n"
+ "• DATA THAT CANNOT RESOLVE ITSELF (a malformed source record) — no "
+ "retry at all; it waits for a corrected delivery.\n"
+ "• CODE DEFECT — no retry; the run fails and somebody fixes it.\n\n"
+ "The discipline that matters: retrying something that cannot succeed "
+ "turns a clear failure into a slow one, and it is the most common "
+ "mistake in batch orchestration.",
  gap:
"Only the second class is specified. The other three are Airflow "
+ "defaults until somebody writes them down — which means they are "
+ "whatever the first developer typed.",
  ev: ["retry-taxonomy practice", "dbt TDD §7.1 (the replay class is specified)"] },

{ n: 76, conf: "practice",
  body:
"As a named, auditable operation with four parts — and the TDD already "
+ "has the hardest one.\n\n"
+ "1. TRIGGER AND AUTHORITY — who may declare a restatement, on what "
+ "evidence, recorded rather than verbal.\n"
+ "2. SCOPE — which dates and which interfaces. Narrow by default: "
+ "restating a week because one file was wrong is how a correction "
+ "becomes an incident.\n"
+ "3. MECHANISM — reopen the date, reload the corrected delivery, rebuild "
+ "deterministically. For dimensions the MERGE-vs-UPDATE rule in §6.4.1 "
+ "decides whether the correction may MERGE at all, which is the part "
+ "most designs get wrong and this one does not.\n"
+ "4. NOTIFICATION — consumers are told which dates changed and why, "
+ "before they reconcile and find it themselves.\n\n"
+ "Business corrections differ from technical restatements in one "
+ "respect: the original value was not wrong when published, so history "
+ "usually has to show both.",
  gap:
"Parts 1, 2 and 4 are not recorded anywhere. Part 4 is the one that "
+ "turns a controlled correction into a support call.",
  ev: ["restatement-runbook practice", "dbt TDD §6.4.1 (the MERGE-vs-UPDATE rule already exists)"] },

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

{ n: 79, conf: "practice",
  body:
"With a genuine RWX volume this is not a failure mode — that is what "
+ "ReadWriteMany means: every pod on every node mounts the same "
+ "filesystem. The landing share here is CIFS-backed, and network "
+ "filesystems are node-independent by construction, so a worker landing "
+ "on a different node is the normal case rather than an edge case.\n\n"
+ "The documented failure is the OPPOSITE arrangement: a ReadWriteOnce "
+ "volume binds to one node, so a pod scheduled elsewhere stays Pending "
+ "— and the symptom is a DAG that hangs rather than errors. The usual "
+ "guards are asserting the access mode in the manifest and alerting on "
+ "pods Pending beyond a threshold.\n\n"
+ "What a network filesystem does change is semantics, not reachability: "
+ "locking and atomic rename behave differently over CIFS than on local "
+ "disk, which is question 57's problem rather than this one.",
  gap:
"Nobody has named the storage class (question 78), so “RWX” is an "
+ "assertion on a diagram. One `kubectl get sc` and one `kubectl get pvc "
+ "-o wide` settle this and question 82 in a minute.",
  ev: ["Kubernetes access-mode semantics"] },

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

{ n: 82, conf: "practice",
  body:
"It is guaranteed by the access mode and by nothing else. ReadWriteMany "
+ "means every pod sees the same volume; ReadWriteOnce means one node "
+ "does, and a second pod elsewhere never starts.\n\n"
+ "The topology models the landing share as RWX over CIFS, which is "
+ "consistent with multiple Airflow workers. So the guarantee is exactly "
+ "as good as the provisioner actually delivering RWX — which is "
+ "unverified (question 78).\n\n"
+ "Worth adopting: assert it rather than assume it. A start-up check in "
+ "the worker image that writes and reads back a sentinel file turns a "
+ "silent mis-provision into a clear failure at deploy time rather than a "
+ "mysterious one at month-end.",
  gap:
"Quarantine and archive are the same share as landing (question 77), so "
+ "they inherit this answer and the same single point of failure.",
  ev: ["Kubernetes access-mode semantics"] },

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

{ n: 85, conf: "practice",
  body:
"By measuring, not by reasoning — and the measurement is small.\n\n"
+ "The ceiling is SESSIONS on the database, and it is shared: Airflow "
+ "workers, dbt runs, the API and anything else on that service all draw "
+ "from the same pool. So the validation is a load test at the intended "
+ "concurrency, watching sessions against the limit, plus a check of what "
+ "else already consumes it.\n\n"
+ "The arithmetic that catches most problems before any test: pods × "
+ "threads per pod × connections per thread. dbt opens one connection per "
+ "thread, so a `threads: 8` profile in four concurrent pods is 32 "
+ "sessions from dbt alone — before Airflow's own metadata connections, "
+ "which are separate.\n\n"
+ "The two settings to pin are dbt's thread count and the Airflow pool "
+ "size, and they multiply rather than add.",
  gap:
"The Oracle session limit is not recorded (question 83) and neither is "
+ "the dbt thread count. Those two numbers plus the pool size are the "
+ "whole calculation, and none of the three is written down.",
  ev: ["connection-pool sizing practice", "dbt threads semantics"] },

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

{ n: 88, conf: "practice",
  body:
"The convention that matters more than the tool: STRUCTURED, "
+ "machine-readable log lines — JSON, one event per line — with a fixed "
+ "set of fields on every line.\n\n"
+ "The fields that earn their place here: timestamp, level, service, "
+ "environment, business_date, correlation_id, interface, dag_id, "
+ "task_id, run_id, and a stable event name. Free text goes in a message "
+ "field and nothing is ever parsed back out of it, because a log a "
+ "human wrote is a log a dashboard cannot aggregate.\n\n"
+ "Whether Dynatrace or Splunk consumes it is a routing decision and can "
+ "change. The FIELD CONTRACT cannot, because every dashboard and alert "
+ "depends on it — so that is the thing to agree, and to agree before "
+ "the first DAG is written rather than retrofitted after.",
  gap:
"business_date and correlation_id are the two fields missing everywhere "
+ "else as well (questions 42 and 87). Agreeing the field list here "
+ "would settle all three at once.",
  ev: ["structured-logging practice"] },

{ n: 89, conf: "practice",
  body:
"Three mechanisms, and the first is the one most estates skip:\n\n"
+ "• A DEDUPLICATION KEY per alert condition — here naturally (rule, "
+ "dataset, business_date). A repeat occurrence updates the existing "
+ "alert rather than raising a new one, which is what stops one bad file "
+ "generating a thousand pages.\n"
+ "• SEVERITY TIED TO ACTION, not to how bad it sounds. Critical means "
+ "somebody is woken; warning means next working day; info means it is "
+ "only read during an investigation. An alert with no action at its "
+ "severity should not exist.\n"
+ "• EXPLICIT RECOVERY. The alert closes when the condition clears and "
+ "the closure is recorded — without it nobody can tell a resolved "
+ "incident from an ignored one.\n\n"
+ "Routing then follows severity and time of day, with one owning rota "
+ "per severity rather than per system.",
  gap:
"None of this is persisted on the Oracle side (question 90), so "
+ "suppression and closure would live entirely in the alerting tool. "
+ "Workable, but it means alert history cannot be reconciled against "
+ "what actually failed.",
  ev: ["alert-taxonomy practice", "deduplication-key practice"] },

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

{ n: 99, conf: "document",
  body:
"Partly stated, and only for the Silver layers. The dbt TDD gives: STG "
+ "none, because it is a view and holds no data; INT seven days, purged by "
+ "partition drop on BUSINESS_DATE. Against today's BBH that is a change — "
+ "STG1 is one day and STG2 is seven.\n\n"
+ "RAW and the orchestration tables are NOT covered. No retention is stated "
+ "for SWP_RAW, DATE_CONTROL, FILE_REGISTRY, DQ_VALIDATION_FAILURE or "
+ "RECON_RESULT, and nothing in the CP360 schema records one either.",
  quote: "Silver retention | STG 1 day; STG2 7 days | STG none (view); INT 7 "
       + "days (partition drop) | STG holds no data.",
  gap:
"The two that are missing are the two that bind other answers: "
+ "orchestration-table retention bounds how far back an incident can be "
+ "investigated (question 42), and the DQ store's retention has to outlast "
+ "the longest replay (question 74). Set those from their dependents, not "
+ "from storage cost. RAW retention is also the floor for any restatement "
+ "reaching further back than seven days.",
  ev: ["dbt TDD §2 — What Changes and What Stays the Same",
       "dbt TDD §6.5 (p.15)"] },

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
