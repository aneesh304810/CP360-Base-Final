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
//
//              AND THEY DO NOT ACCUSE SEI OF AN OMISSION. These questions
//              have not been put to the SEI pack — they were bucketed as
//              BBH-side from the start. So the standing note below says
//              "raised by BBH", not "SEI left this out", and says plainly
//              that SEI's text supersedes this if it covers the point.
//              Claiming a gap nobody searched for is how a review loses
//              an argument it was winning.
export const CONF = {
  codebase:  { label: "from the codebase", c: "#0f4775", bg: "#e4f0fb" },
  absence:   { label: "nothing recorded",  c: "#8c6a1f", bg: "#fdf2e3" },
  document:  { label: "from a document",   c: "#15803d", bg: "#e8f6ed" },
  inference: { label: "reasoned, not read", c: "#7c3aed", bg: "#f1e9fd" },
  // Deliberately the plainest badge of the five. This class is a
  // SUGGESTION — what comparable platforms do — and it must never read
  // as something BBH has decided or a document has stated. It carries no
  // quote, because there is no source text to quote.
  practice:  { label: "BBH recommendation · gap vs SEI analysis",
               c: "#475569", bg: "#f1f5f9" },
};

// Rendered under every BBH recommendation, from one constant rather than
// repeated in twenty bodies, so it cannot drift into twenty slightly
// different claims about what SEI did or did not do.
export const SEI_GAP_NOTE =
  "Raised by BBH as a gap in the SEI analysis. This is BBH's recommended "
  + "position, not SEI's design and not a statement that SEI omitted it — "
  + "the SEI pack has not been searched for this point. If SEI has covered "
  + "it, their text supersedes this answer.";

export const SEED_PREFIX = "seed";
export const seedId = (n) => `${SEED_PREFIX}${n}`;
export const isSeedId = (id) => typeof id === "string" && id.startsWith(SEED_PREFIX);

export const SEED_AUTHOR = "CP360 · drafted from the codebase";
// A recommendation is not drafted from the codebase, so it does not say
// it was. The byline has to match the class or the badge is arguing with
// the line next to it.
export const PRACTICE_AUTHOR = "CP360 · drafted from industry practice";
export const authorFor = (conf) =>
  (conf === "practice" ? PRACTICE_AUTHOR : SEED_AUTHOR);

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

{ n: 28, conf: "document", fig: "layers",
  body:
"Layer for layer, and the TDD uses the same phrase this question does: "
+ "SWP_RAW \u2192 STG (view) \u2192 INT \u2192 approved DIM/FACT, with dbt "
+ "replacing ODI. What runs at each step:\n\n"
+ "\u2022 SWP_RAW \u2014 the file as delivered. Append-only, with file and "
+ "record lineage carried on SRC_RECORD_ID.\n"
+ "\u2022 STG \u2014 a VIEW, not a table. It standardises the source columns "
+ "and computes the source-DQ flag, DQ_STATUS_CD and DQ_FAIL_REASON_CDS. It "
+ "stores nothing.\n"
+ "\u2022 INT \u2014 reads PASS rows only, maps the code sets, keyed on the "
+ "natural business key plus BUSINESS_DATE, partitioned, kept seven days.\n"
+ "\u2022 DIM \u2014 built FIRST. Direct-compare MERGE into the Gold tables "
+ "that already exist; ACCOUNT_KEY comes from the Oracle sequence that is "
+ "already there; no DDL.\n"
+ "\u2022 FACT \u2014 built SECOND, and only from transactions whose "
+ "dimension has resolved. A missing dimension is held in "
+ "DQ_VALIDATION_FAILURE and replayed later, never written to Gold with a "
+ "placeholder key.\n\n"
+ "\u201cApproved\u201d is not an approval step, which is worth saying "
+ "because the word invites that reading. The glossary defines Gold as the "
+ "approved DIM/FACT \u2014 meaning the Gold tables that already exist and "
+ "that this design is not permitted to alter.\n\n"
+ "Holding it together is DATE_CONTROL. The Ingestion DAG loads the files "
+ "and moves the date PENDING \u2192 TRIGGER; the Transformation DAG builds "
+ "the four layers in order and moves the date to COMPLETE only on full "
+ "success.",
  gap:
"The SEI half of this question is in a document BBH does not have. The "
+ "TDD\u2019s own scope boundary puts SWP file generation, external file "
+ "transfer, physical file discovery, header and trailer validation, and the "
+ "RAW load itself OUTSIDE it \u2014 the RAW load is owned by a separate "
+ "Ingestion Framework TDD. So everything above starts at the point the data "
+ "is already sitting in SWP_RAW. How it got that far is that other "
+ "document\u2019s to answer, and getting hold of it would close most of "
+ "topic 10 as well.\n\n"
+ "Three interfaces are named \u2014 Account, Client, Transaction. Nothing "
+ "says what happens to the rest.",
  quote: "Like-for-like layer mapping: SWP_RAW \u2192 STG (view) \u2192 INT "
       + "\u2192 approved DIM/FACT, replacing ODI with version-controlled, "
       + "testable dbt SQL.",
  ev: ["dbt TDD \u00a71.1 \u2014 Key Outcomes (p.5)",
       "dbt TDD \u00a74.1 \u2014 Medallion Mapping (p.10)",
       "dbt TDD \u00a71.2 \u2014 Scope Boundary (p.6)"] },

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

{ n: 38, conf: "document", fig: "dqstore",
  body:
"Three controls block, and one does not \u2014 and the one that does not is "
+ "the one most people assume is the gate.\n\n"
+ "BLOCKING, in the order they run:\n"
+ "\u2022 The STG source-DQ flag. A failing record is written to "
+ "DQ_VALIDATION_FAILURE and held at the layer that caught it; it never "
+ "proceeds to the next one. INT reads PASS rows only.\n"
+ "\u2022 The per-layer test task. Each layer is a build task followed by "
+ "its own test task, and the next layer waits on it \u2014 build_fact "
+ "starts only after build_dim AND test_dim have passed.\n"
+ "\u2022 Dimension resolution at INT \u2192 FACT. A transaction whose "
+ "dimension has not arrived is not loaded. Nothing reaches Gold on a "
+ "placeholder key; it is held and replayed once the dimension exists.\n\n"
+ "NOT BLOCKING: reconciliation. The four boundary counts are computed and "
+ "shipped to Splunk in a task that runs AFTER the fact build, and the "
+ "PASS/WARNING verdict is derived on the Splunk side from the published "
+ "counts \u2014 it is not stored and nothing in the pipeline reads it. So a "
+ "reconciliation WARNING tells you something went wrong after the data is "
+ "already in Gold. It is a detective control, not a preventive one.\n\n"
+ "One more, about the date rather than the rows: the Ingestion DAG sets "
+ "TRIGGER only when every expected interface has arrived, and the "
+ "Transformation DAG re-checks that on its first task before doing any "
+ "work.",
  gap:
"The question asks WHICH controls, and what the document gives is the "
+ "machinery rather than the list. There is no inventory of the actual rules "
+ "per interface. DQ_STATUS_CD and DQ_FAIL_REASON_CDS are named as columns, "
+ "two example failures appear in a figure, and the set of reason codes is "
+ "nowhere. Until somebody writes that list down, \u201cpassed DQ\u201d "
+ "means something different for Account than it does for Transaction and "
+ "nobody can say what.\n\n"
+ "The reconciliation point above is a decision, not an oversight. If a count "
+ "mismatch ought to stop publication rather than raise an alert after it, "
+ "that has to be designed in, because the current task order makes it "
+ "impossible.",
  quote: "Every failing record is written to one store, DQ_VALIDATION_FAILURE, "
       + "and is held at its failing layer \u2014 it never proceeds to the "
       + "next layer.",
  ev: ["dbt TDD \u00a77.1 \u2014 Capture and Publishing (p.17)",
       "dbt TDD \u00a77.2 \u2014 Reconciliation Boundaries (p.18)",
       "dbt TDD Appendix A.1 \u2014 Two-DAG Task Sequence (p.25)"] },

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
  seiAsk:
"Can SEI agree which accounts we compare against, and the date we freeze the current system for that comparison? And will SEI produce the baseline figures from the existing system, or should we?",
  body:
"The risk is that we switch over, the numbers look fine, and six months "
+ "later somebody finds a client whose figures never matched the old "
+ "system. "
+ "\n\n"
+ "To avoid that we should compare in three steps, cheapest first. Count "
+ "the rows per table per day, which catches a whole file going missing. "
+ "Then total the money columns and the date ranges, which catches the "
+ "errors counts cannot see, a sign flipped or an amount out by a factor of "
+ "a hundred. Then compare the records themselves, field by field, once "
+ "over everything at cutover and on a sample after that. "
+ "\n\n"
+ "Variance 360 already produces the first two today, so this is mostly "
+ "agreeing the scope rather than building something new. ",
  gap:
"Three things need deciding, and none of them are technical. How close is "
+ "close enough, is a one penny difference a failure. Which accounts go in "
+ "the sample, and we should make sure the difficult ones are in there, "
+ "closed accounts, multi currency, anything already corrected. And the "
+ "date we freeze the old system for comparison. Comparing against "
+ "something still changing underneath us proves nothing. ",
  ev: ["standard migration-parity practice", "Variance 360 (metrics already exist)"] },

{ n: 46, conf: "practice",
  body:
"The concern is that a change to client or account reference data "
+ "quietly changes transaction numbers that were already reported. "
+ "\n\n"
+ "Three things prevent it, and the design has the first already. Account "
+ "and client records are built and checked before any transactions are "
+ "loaded, so a transaction can never attach itself to out of date account "
+ "details. Each transaction table has one agreed level of detail written "
+ "down and tested, so if that is ever broken the run stops rather than the "
+ "figures silently doubling. And one process owns each reference table. "
+ "Two processes writing the same account record is how a change in one "
+ "place turns up somewhere nobody expected. ",
  gap:
"We should also agree that a transaction table never derives from another "
+ "transaction table, only from shared reference data. With one such table "
+ "today it may not matter, but it will the moment a second one is added. ",
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

{ n: 52, conf: "document", fig: "datectl",
  body:
"FILE_SCHEMA_CONFIG holds the expected set; FILE_REGISTRY holds what "
+ "actually turned up.\n\n"
+ "The Ingestion DAG compares the two for the open business date, and only "
+ "when expected minus completed is empty does it move DATE_CONTROL from "
+ "PENDING to TRIGGER. The Transformation DAG then re-checks the same thing "
+ "on its first task before it does any work \u2014 the document calls that "
+ "trust-but-verify. The check runs as a short-circuit step, so an incomplete "
+ "date stops the run quietly rather than failing it.\n\n"
+ "Both tables are listed among the Oracle objects the design depends on, "
+ "next to DATE_CONTROL and the existing sequence.",
  gap:
"We have the name and not the shape. FILE_SCHEMA_CONFIG has no DDL anywhere "
+ "in the TDD \u2014 unlike DATE_CONTROL, DQ_VALIDATION_FAILURE and "
+ "RECON_RESULT, which all have one. It belongs to the Ingestion Framework, "
+ "which the scope boundary puts outside this document, so the columns, who "
+ "maintains the rows, and whether a row is effective-dated are all "
+ "unanswered here. That last one is question 54 and it cannot be settled "
+ "from this document.\n\n"
+ "Also worth being clear about what the check is NOT. It is a set "
+ "difference on interfaces. It confirms that something arrived for each "
+ "interface expected; it does not confirm that it was the right file.",
  quote: "After all load tasks, it compares the expected interface set "
       + "(FILE_SCHEMA_CONFIG) against the completed set (FILE_REGISTRY).",
  ev: ["dbt TDD \u00a75.3 \u2014 Ingestion-to-Transformation Trigger (p.12)",
       "dbt TDD \u00a710.2 \u2014 Operational Controls Contract (p.23)",
       "dbt TDD Appendix A.1 (p.25)"] },

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
  seiAsk:
"Does SEI send us anything on Saturdays, Sundays and market holidays? We need this per feed rather than one answer for everything, and we need to know which market calendar applies to each.",
  body:
"We need a calendar held as data, not working days worked out in code. "
+ "\n\n"
+ "A single is it a weekday check is where month end problems usually come "
+ "from. Different markets and currencies close on different days, so one "
+ "rule for everything will be wrong for somebody. A table listing which "
+ "days are processing days, and which calendar applies to which feed, "
+ "keeps that visible and changeable without a release. "
+ "\n\n"
+ "For a non processing day we can either record it as closed with nothing "
+ "expected, or not record it at all. Recording it is better because it "
+ "keeps the run of dates unbroken, which makes a missing day obvious. ",
  gap:
"Two decisions nobody has taken. Does SEI send us anything on Saturdays "
+ "and Sundays at all. And if they do, do we process those days or hold "
+ "them until Monday. The answer is probably different for transactions "
+ "than for positions, so this is likely a decision per feed rather than one "
+ "for everything. ",
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
"The failure here is quiet, which is what makes it expensive. We tell "
+ "the next stage to start, the instruction does not land, and nothing "
+ "reports an error. The day simply never finishes, and we usually find out "
+ "when somebody downstream asks where their data is. "
+ "\n\n"
+ "The fix is to write down that we intended to start before we start, and "
+ "give that run a name worked out from the business date. Then if the "
+ "instruction is lost we can safely issue it again, because the name "
+ "already exists and we cannot accidentally run the same day twice. "
+ "\n\n"
+ "A scheduled check then looks for days that were told to start and never "
+ "did, and starts them. ",
  gap:
"We need to agree how often that check runs and what it does when the "
+ "same day keeps failing. Retrying forever is the wrong answer. A day that "
+ "has failed to start five times needs a person, not another attempt. ",
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
"A file marked as loading, with nothing actually loading it, is "
+ "indistinguishable from a file being worked on. Today nobody can tell the "
+ "difference, so either we wait on something that is never coming, or we "
+ "restart something that was running fine and risk loading it twice. "
+ "\n\n"
+ "The fix is to make loading a claim that expires. Whoever picks the file "
+ "up records who they are and keeps a timestamp ticking while they work. "
+ "If they die the timestamp stops, and that is an unambiguous signal "
+ "rather than a guess. "
+ "\n\n"
+ "The more important half is making the load safe to repeat. If running it "
+ "twice cannot duplicate anything, recovery is simply run it again and the "
+ "crash needs no special handling. ",
  gap:
"We need to set how long is too long before we treat a load as dead, and "
+ "it has to be longer than a genuinely slow file. Set it too short and we "
+ "will be interrupting work that was going to finish. ",
  ev: ["lease/heartbeat practice", "idempotent-load practice"] },

{ n: 66, conf: "practice",
  seiAsk:
"Will each delivery come with a row count or a checksum we can check against? Without one we cannot tell a corrected file from the original.",
  body:
"At the moment, if a file is half loaded, nobody can prove whether it "
+ "needs loading again. That matters because guessing wrong in either "
+ "direction is bad. Reload something already loaded and we double the "
+ "figures. Fail to reload and we are short. "
+ "\n\n"
+ "Recording two things makes the question answerable rather than a "
+ "judgement call. A fingerprint of the file when it arrives, and the "
+ "number of rows we loaded from it. Then we can check that the file on "
+ "disk is the one we think it is, and that what is in the system matches "
+ "what we said we loaded. "
+ "\n\n"
+ "Without the fingerprint, a corrected file sent under the same name looks "
+ "exactly like the original. ",
  gap:
"The fingerprint does not exist today. It costs almost nothing to capture "
+ "when the file arrives and cannot be worked out afterwards, so it needs "
+ "to go in before go live rather than after the first problem. ",
  ev: ["content-addressable ingestion practice"] },

{ n: 67, conf: "practice",
  seiAsk:
"Does our agreement with SEI allow a file to arrive for a day we have already closed off, and how much notice would we get?",
  body:
"This is a business decision about whether a published number is allowed "
+ "to change, not a technical one. "
+ "\n\n"
+ "We can refuse the file, and treat it as an exception needing a formal "
+ "correction. That is the only option where a figure we have already given "
+ "out never changes underneath the person who received it. "
+ "\n\n"
+ "We can accept it and rerun the day. That is only safe if everybody "
+ "downstream can cope with yesterday's numbers being restated. "
+ "\n\n"
+ "Or we can load it against the next day and mark it late. Published "
+ "history stays fixed and the difference moves forward instead. "
+ "\n\n"
+ "Most firms in this space land on refusing it plus a proper correction "
+ "process, because quietly reopening a closed day is what breaks everyone "
+ "else's reconciliations. ",
  gap:
"Whichever we pick, the system has to enforce it. Today nothing stops a "
+ "file being loaded against a day we have already closed, so the real "
+ "answer at the moment is whatever the code happens to do. ",
  ev: ["late-arriving-data practice"] },

{ n: 68, conf: "practice",
  seiAsk:
"When SEI corrects something they have already sent us, how do we get told, and how far back is a correction allowed to go?",
  body:
"The risk is that we correct something and the corrected figures no "
+ "longer match the records we are supposed to be able to reproduce them "
+ "from. For an audit that is the worst position to be in. "
+ "\n\n"
+ "It stays in step if we never edit what we originally received. A "
+ "corrected file is a new delivery recorded alongside the old one, not an "
+ "overwrite. We reopen the day deliberately, with a reason and a name "
+ "against it, then rebuild everything downstream from the original "
+ "records. "
+ "\n\n"
+ "That rebuild is the control. If we cannot reproduce today's published "
+ "figures from what we received, then they have already drifted apart and "
+ "nobody can tell. ",
  gap:
"Telling people is the part that gets skipped and then causes the "
+ "support call. A correction nobody downstream was warned about looks "
+ "exactly like a fault in their own reconciliation, and they will raise it "
+ "as one. ",
  ev: ["append-only RAW / deterministic rebuild practice"] },

{ n: 69, conf: "practice",
  body:
"The file is moved to an archive folder once it has been processed. The "
+ "question is what happens if we stop halfway. "
+ "\n\n"
+ "It depends entirely on the order. If we record the data and mark the "
+ "file as done together, and only then move it, a failure in between "
+ "leaves the system saying loaded and the file still sitting in the "
+ "incoming folder. That is untidy but safe, and something can tidy it up "
+ "later. "
+ "\n\n"
+ "The other order is the dangerous one. Move the file first and record it "
+ "second, and a failure leaves the file filed away as processed when it "
+ "never was. Nothing is left in the incoming folder to tell us. ",
  gap:
"Which order the code actually uses is not written down anywhere, and it "
+ "is the entire answer to this question. Somebody should check it and "
+ "record it. ",
  ev: ["commit-then-move practice"] },

{ n: 70, conf: "practice",
  body:
"Same answer as the previous question, and it is worth saying why it "
+ "generalises. On the platform we are using, a process can be stopped at "
+ "any moment without warning, because it ran short of memory or the "
+ "platform needed the capacity. So recovery cannot depend on anything "
+ "happening after the failure. "
+ "\n\n"
+ "That means the point at which we record the work is the point it counts, "
+ "and everything after that has to be repeatable. We can ask for a few "
+ "seconds of warning before a process is stopped, and we should, but we "
+ "cannot rely on it, because the memory case gives no warning at all. "
+ "\n\n"
+ "Detecting it is the expiring claim described in question 65. ",
  gap:
"Given the memory allocated to the non production environments, see "
+ "question 84, this is not a rare event. It will happen regularly until "
+ "the sizing is settled. ",
  ev: ["Kubernetes pod-lifecycle practice", "crash-only design"] },

{ n: 71, conf: "practice",
  body:
"Two normal approaches, and the difference matters for how much we can "
+ "see. "
+ "\n\n"
+ "The scheduler can run the feeds side by side itself, up to a set limit. "
+ "Everything is visible in one place, each feed can be retried on its own, "
+ "and the limit is one number we control. "
+ "\n\n"
+ "Or the work goes on a queue and separate processes pick it up. Better if "
+ "files arrive unevenly through the day, but harder to see what is "
+ "happening and it needs its own handling for work that keeps failing. "
+ "\n\n"
+ "For a daily run with a known list of feeds, the first is almost always "
+ "right. We know in advance how much work there is, and we get the "
+ "visibility and the retries without building anything. ",
  gap:
"Whichever we use, the limit on how much runs at once has to come from "
+ "what the database can take and the capacity we have been given. It "
+ "cannot be chosen on its own. See questions 83 and 84. ",
  ev: ["Airflow fan-out practice"] },

{ n: 72, conf: "practice",
  body:
"This one we think is wrong, rather than just undocumented. "
+ "\n\n"
+ "The register is our record of what arrived and what we did with it. "
+ "Deleting the entry so a file can be reloaded destroys the only evidence "
+ "the first delivery ever happened. That is exactly the evidence an "
+ "auditor asks for after a correction, and it also means a reload looks "
+ "identical to a first load. "
+ "\n\n"
+ "The normal approach is to keep the original entry and mark it as "
+ "superseded, with the corrected delivery recorded as a new entry pointing "
+ "back at it. Then what did we receive and when still answers correctly a "
+ "year later. ",
  gap:
"If the deletion only exists to get around a technical restriction on "
+ "duplicate file names, then the restriction is the thing to change, not "
+ "the record. Adding a delivery number, as in question 51, removes the "
+ "conflict. ",
  ev: ["append-only audit practice"] },

{ n: 73, conf: "practice",
  seiAsk:
"When SEI resends a corrected file, does it come under the same file name and the same business date? If it does, we need a delivery number from SEI rather than inventing one ourselves.",
  body:
"Yes, and it is the same change as the previous question, so worth doing "
+ "once rather than twice. "
+ "\n\n"
+ "Keep the existing record as it is and add two things. A delivery number "
+ "so a resent file becomes a new entry rather than replacing the old one. "
+ "And a status that can say superseded alongside the ones we already have. "
+ "Current position is then simply the latest entry that has not been "
+ "superseded. "
+ "\n\n"
+ "The cost is small. What we get back is that a question like how many "
+ "times was this feed corrected last quarter becomes something we can "
+ "answer from the system rather than by searching through logs. ",
  gap:
"We need to decide whether a correction applies to one file or to the "
+ "whole day. Per file matches how corrections actually arrive. Per day "
+ "matches how the rest of the design already thinks. They only differ when "
+ "one feed out of five is corrected, which is precisely the case that will "
+ "come up. ",
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
"What is missing is a simple agreement on who retries what, and how many "
+ "times, before a person is involved. "
+ "\n\n"
+ "Infrastructure problems, a dropped connection or a process restarted by "
+ "the platform, should retry automatically a few times and only tell "
+ "somebody if they keep failing. "
+ "\n\n"
+ "Data that might sort itself out, such as a transaction arriving before "
+ "its account, should not be retried at the job level at all. It is held "
+ "and picked up on a later run, which the design already does. "
+ "\n\n"
+ "Data that cannot sort itself out, such as a malformed record, should not "
+ "be retried either. It waits for a corrected file. "
+ "\n\n"
+ "A fault in our own code should stop and be fixed. "
+ "\n\n"
+ "The thing to avoid is retrying something that cannot succeed. That turns "
+ "a clear failure into a slow one, and it is the most common mistake in "
+ "this kind of processing. ",
  gap:
"Only the second case is specified today. The other three will be "
+ "whatever defaults the tooling came with until we write them down. ",
  ev: ["retry-taxonomy practice", "dbt TDD §7.1 (the replay class is specified)"] },

{ n: 76, conf: "practice",
  seiAsk:
"What is SEI's part in a correction? Who declares it, who resends the data, and within what timeframe?",
  body:
"A correction needs to be a named process we can evidence afterwards, "
+ "with four parts. The design already has the hardest one. "
+ "\n\n"
+ "Who is allowed to declare a correction and on what basis, recorded "
+ "rather than agreed verbally. "
+ "\n\n"
+ "What it covers. Which days and which feeds, kept as narrow as possible. "
+ "Correcting a whole week because one file was wrong is how a correction "
+ "becomes an incident. "
+ "\n\n"
+ "How it is done. Reopen the day, load the corrected file, rebuild. Where "
+ "account history is involved there is a rule in the design about when a "
+ "correction may be applied normally and when it must not, and that is the "
+ "part most designs get wrong. "
+ "\n\n"
+ "Who gets told, and before they find it themselves. "
+ "\n\n"
+ "Business corrections differ slightly from technical ones. The original "
+ "figure was not wrong when it was published, so the history usually has "
+ "to show both. ",
  gap:
"The first, second and fourth parts are not written down anywhere. The "
+ "fourth is the one that turns a controlled correction into a complaint. ",
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
"Short answer, with the storage arrangement described it is not a "
+ "problem. The incoming folder sits on shared network storage, so every "
+ "processing task can see it wherever it happens to be running. That is "
+ "the normal case here rather than an exception. "
+ "\n\n"
+ "The arrangement that does fail is the other one, where storage is tied "
+ "to a single machine. Then a task started anywhere else simply waits, and "
+ "the symptom is a run that hangs rather than one that reports an error, "
+ "which is worse because nobody is alerted. "
+ "\n\n"
+ "What shared network storage does change is the fine detail of two tasks "
+ "picking up the same file at the same moment, which is question 57 rather "
+ "than this one. ",
  gap:
"Nobody has confirmed which storage we have actually been given, see "
+ "question 78, so at the moment this is an assumption on a diagram. Two "
+ "commands would confirm it and would settle question 82 at the same "
+ "time. ",
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
"It is guaranteed by how the storage is provisioned and by nothing else. "
+ "Shared storage means every processing task sees the same folder. Storage "
+ "tied to one machine means only tasks on that machine do, and the rest "
+ "never start. "
+ "\n\n"
+ "The design assumes shared storage, which fits having several tasks "
+ "running at once. So the guarantee is only as good as what we were "
+ "actually given, and that has not been checked. "
+ "\n\n"
+ "Worth building in a simple check when the process starts, writing a test "
+ "file and reading it back. That turns a wrong configuration into a clear "
+ "failure on the day we deploy, rather than a strange one at month end. ",
  gap:
"The quarantine and archive folders are on the same storage, see question "
+ "77, so they get the same answer and the same single point of failure. ",
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
"This needs measuring rather than reasoning about, and the measurement "
+ "is small. "
+ "\n\n"
+ "The limit is the number of simultaneous connections the database will "
+ "accept, and it is shared with everything else using that database. So "
+ "validating it means running at the concurrency we actually intend, while "
+ "watching the connection count, and checking what else is already using "
+ "it. "
+ "\n\n"
+ "Most of the problem shows up before any test, from the arithmetic. "
+ "Number of processes, times the number of parallel operations each one "
+ "runs, times the connections each of those opens. Eight parallel "
+ "operations in four processes is thirty two connections before anything "
+ "else is counted. Those numbers multiply, they do not add. ",
  gap:
"We do not have the database limit, see question 83, and we have not "
+ "agreed the parallel setting either. Those two figures plus the "
+ "concurrency limit are the whole calculation and we are missing all "
+ "three. ",
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
"The point that matters more than which tool we use is that every log "
+ "entry should carry the same set of details, in a consistent format a "
+ "machine can read. "
+ "\n\n"
+ "The details worth insisting on here are when it happened, which process, "
+ "which environment, which business date, which feed, and an identifier "
+ "that follows one file all the way through. Anything written for a human "
+ "to read goes in a separate description field that nothing depends on. "
+ "\n\n"
+ "Whether the logs end up in one tool or another can change later. The list "
+ "of details cannot, because every dashboard and alert we build will "
+ "depend on it. So the list is the thing to agree, and we should agree it "
+ "before the first job is written rather than retrofit it afterwards. ",
  gap:
"Two of those details, the business date and the identifier that follows "
+ "a file through, are missing everywhere else as well, see questions 42 and "
+ "87. Agreeing the list here would settle all three together. ",
  ev: ["structured-logging practice"] },

{ n: 89, conf: "practice",
  seiAsk:
"Which problems should be escalated to SEI rather than handled by our own support team, and how should we raise them?",
  body:
"Three things, and the first is the one most places skip. "
+ "\n\n"
+ "The same problem should raise one alert, not one per occurrence. Without "
+ "that, a single bad file can generate hundreds of notifications overnight "
+ "and the real one gets lost in them. "
+ "\n\n"
+ "Severity should describe what somebody does about it. Critical means we "
+ "wake a person. Warning means it is looked at the next working day. "
+ "Anything else is only read during an investigation. If there is no "
+ "action attached to a severity then the alert should not exist at that "
+ "level. "
+ "\n\n"
+ "And an alert should close itself when the problem clears, with that "
+ "recorded. Otherwise we cannot tell afterwards which incidents were "
+ "resolved and which were simply ignored. "
+ "\n\n"
+ "Routing then follows severity and time of day, with one rota per "
+ "severity rather than one per system. ",
  gap:
"None of this is recorded on our side, see question 90, so suppression "
+ "and closure would live entirely inside the alerting tool. That works, but "
+ "it means we cannot reconcile what was alerted against what actually went "
+ "wrong. ",
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

{ n: 91, conf: "document", fig: "datectl",
  body:
"There is a place for it and there is no number in it.\n\n"
+ "DATE_CONTROL carries SLA_CUTOFF_TS \u2014 a time-zone-aware timestamp, "
+ "one per business date \u2014 and the design says it gates the ingestion "
+ "SLA. Modelling the cutoff per date rather than as one standing time is the "
+ "right shape: it leaves room for a month-end or a short day without a code "
+ "change.\n\n"
+ "The value is not set, and the document does not pretend otherwise. The "
+ "section is headed \u201cPerformance, Volumetrics, and SLAs (to "
+ "confirm)\u201d and every target in it is a placeholder: the daily run "
+ "window is \u201cTBC \u2014 within N hours\u201d, the stuck alert "
+ "\u201cTBC \u2014 > N minutes\u201d, the DQ failure rate \u201cTBC "
+ "\u2014 > X% of a feed\u201d. Confirming the volumetrics and the "
+ "run-window target is also on the list of decisions required before build.",
  gap:
"So there is no approved cutoff yet, and the question is really two "
+ "questions. The number is a business decision nobody has taken. The "
+ "exception process does not exist in any form \u2014 there is an action "
+ "for a run that gets stuck, which is a technical failure, and nothing at "
+ "all for a file that is simply late. That second half is question 97.\n\n"
+ "One thing to check when the number is agreed: no task in the published DAG "
+ "sequence consults SLA_CUTOFF_TS. The column is declared and the "
+ "completeness check does not read it, so setting a value would not by "
+ "itself make anything happen.",
  quote: "SLA_CUTOFF_TS (tz-aware) gates the Ingestion SLA; the *_DAG_RUN_ID "
       + "columns trace which runs acted.",
  ev: ["dbt TDD Appendix A.2 \u2014 date_control.sql (p.25)",
       "dbt TDD \u00a710.3 \u2014 Performance, Volumetrics, and SLAs (p.24)",
       "dbt TDD \u00a79 \u2014 Decision D5 (p.22)"] },

{ n: 92, conf: "document",
  body:
"One thing in the design is time-zone aware, and it is the right one. "
+ "SLA_CUTOFF_TS on DATE_CONTROL is declared TIMESTAMP WITH TIME ZONE, as "
+ "are the created, trigger and complete timestamps beside it. A cutoff can "
+ "therefore be expressed in a named zone per business date rather than in "
+ "whatever zone the database happens to be running in.\n\n"
+ "That is the whole of it. BUSINESS_DATE itself is a plain DATE with no "
+ "zone, and it is the partition key, the retention key and half of every "
+ "natural key in INT. So the time-zone question only ever bites on WHEN a "
+ "file is late \u2014 never on which business date a record belongs "
+ "to.\n\n"
+ "The multi-currency half has no answer here at all. Currency does not "
+ "appear in the document. Neither does a market, a region, or a per-"
+ "interface cutoff.",
  gap:
"Two decisions. Which zone the cutoff is written in \u2014 one zone for "
+ "everything, or one per interface \u2014 because the column supports "
+ "either and nothing says which. And whether a single cutoff is the right "
+ "model at all: a multi-currency day with Asian and US sources has two "
+ "natural arrival windows, and one cutoff across both either waits for the "
+ "latest market or breaches on the earliest one.\n\n"
+ "Searched the document for: time zone, timezone, UTC, holiday, calendar, "
+ "currency, market, region. The four timestamp columns are the only hits.",
  quote: "sla_cutoff_ts TIMESTAMP WITH TIME ZONE NOT NULL, created_ts "
       + "TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, trigger_ts "
       + "TIMESTAMP WITH TIME ZONE, complete_ts TIMESTAMP WITH TIME ZONE",
  ev: ["dbt TDD Appendix A.2 \u2014 date_control.sql (p.25)",
       "dbt TDD \u00a710.3 (p.24)"] },

{ n: 93, conf: "document",
  body:
"The measures exist. The targets do not.\n\n"
+ "Four are listed, each with what to do when it breaches:\n"
+ "\u2022 Daily run window, measured from the last file in to everything "
+ "COMPLETE. Target TBC \u2014 within N hours. On breach: find the longest "
+ "layer, scale threads or pods.\n"
+ "\u2022 Stuck in TRIGGER. Target TBC \u2014 more than N minutes. On "
+ "breach: page on-call, restart from the failed task.\n"
+ "\u2022 DQ failure rate. Target TBC \u2014 more than X per cent of a "
+ "feed. On breach: alert, then triage source against transformation.\n"
+ "\u2022 A reconciliation WARNING, or an OPEN DQ backlog ageing past N "
+ "days. On breach: investigate the boundary and the date, look for a late "
+ "dimension or aged OPEN rows.\n\n"
+ "Four measures with four named responses is further along than most "
+ "designs get at this stage. What is missing is every number in it.",
  gap:
"Production support cannot be held to any of this until the N, the X and "
+ "the hours are filled in, and the document says so itself \u2014 the "
+ "section is marked \u201cto confirm\u201d, and confirming volumetrics and "
+ "the run-window target is on the list of decisions required before "
+ "build.\n\n"
+ "The bigger gap is what is not measured at all. There is no measure for a "
+ "late file, which is the single most common operational event on any feed. "
+ "The stuck alert watches TRIGGER, and a late file leaves the date sitting "
+ "in PENDING, which nothing watches. See question 97.",
  quote: "Daily run window (last file \u2192 all COMPLETE) | TBC \u2014 "
       + "within N hours | Investigate longest layer; scale threads/pods.",
  ev: ["dbt TDD \u00a710.3 \u2014 Performance, Volumetrics, and SLAs (p.24)",
       "dbt TDD \u00a79 \u2014 Decision D5 (p.22)"] },

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

{ n: 96, conf: "absence",
  body:
"Nobody. The design has an owner column and what it names is software: the "
+ "business date and its state are owned by \u201cboth DAGs\u201d, the "
+ "expected-versus-completed check by the Ingestion DAG, the DIM-before-FACT "
+ "ordering by the Transformation DAG. Those are the components that enforce "
+ "a rule, not the people who set it.\n\n"
+ "Searched for: owner, responsible, RACI, approver, holiday, calendar, "
+ "override, exception process. \u201cAccountable\u201d appears only on the "
+ "document-control page, and it refers to the author of the TDD. The only "
+ "human-side ownership stated anywhere is that BBH owns the Splunk "
+ "dashboards and alerting, and that source DQ belongs to the SWP source "
+ "system while transformation DQ belongs to the transformation team.",
  gap:
"Three of the four things this question asks about do not exist in the "
+ "design yet, which makes the ownership question premature for them and "
+ "urgent for exactly that reason. The cutoff is a column with no value "
+ "(question 91). Holiday overrides are absent entirely \u2014 the next "
+ "business date is handed to the insert as a parameter, so whatever decides "
+ "that Monday follows Friday sits outside the design. There is no exception "
+ "process at all. Time zone is the only one that is modelled.\n\n"
+ "Name the owner first and all four answers come from one person. Leave it "
+ "unowned and the cutoff gets set by whoever happens to be on the call the "
+ "first time a file is late.",
  ev: ["dbt TDD \u00a710.2 \u2014 Operational Controls Contract (p.23)",
       "dbt TDD \u00a77 \u2014 the two DQ categories and their owners (p.17)",
       "dbt TDD Appendix A.2 \u2014 date_control.sql (p.25)"] },

{ n: 97, conf: "document", fig: "datectl",
  body:
"Nothing happens. That is worth stating flatly, because the design looks "
+ "like it covers this and it does not.\n\n"
+ "The ingestion flow has five steps and the fourth one is the answer: if the "
+ "expected files are incomplete the run ends normally, the date stays "
+ "PENDING, and the next cycle re-checks. No timer, no escalation, no alert. "
+ "The date will sit there across as many cycles as it takes.\n\n"
+ "The alert that does exist is watching the other state. The risk register "
+ "lists \u201crun stuck in TRIGGER, stalling the pipeline\u201d and "
+ "mitigates it with an alert on any row in TRIGGER beyond the SLA, and the "
+ "SLA table carries a stuck-in-TRIGGER alert that pages on-call. But TRIGGER "
+ "means every file arrived and the transformation is running or has failed. "
+ "A late file never gets that far, so none of it fires.\n\n"
+ "And the queue is blocked while this is true. At most one non-COMPLETE row "
+ "may exist in DATE_CONTROL at any moment, enforced by a unique index, so a "
+ "date stuck in PENDING also stops the next business date from opening.",
  gap:
"This is the cheapest thing on the list to fix. SLA_CUTOFF_TS is already on "
+ "the row, already time-zone aware, already described as gating the "
+ "ingestion SLA, and nothing reads it. A stuck-in-PENDING alert is the same "
+ "shape as the stuck-in-TRIGGER one that is already specified \u2014 "
+ "compare now against SLA_CUTOFF_TS for the open PENDING date \u2014 and it "
+ "is the difference between knowing at 07:00 and finding out when somebody "
+ "asks why yesterday\u2019s report is missing.\n\n"
+ "What should happen AFTER the alert is a business decision, not a technical "
+ "one: wait, run on what arrived, or roll the date forward. Note that "
+ "running on a partial set is not currently possible \u2014 TRIGGER is set "
+ "only when the expected set is complete \u2014 so if that is the answer it "
+ "is a design change and not a runbook entry.",
  quote: "If incomplete \u2014 it ends normally; the date stays PENDING and "
       + "the next cycle re-checks.",
  ev: ["dbt TDD \u00a75.3 \u2014 Ingestion-to-Transformation Trigger (p.12)",
       "dbt TDD \u00a78.3 \u2014 Risks and Mitigations (p.21)",
       "dbt TDD \u00a710.3 (p.24)",
       "dbt TDD Appendix A.2 \u2014 date_control.sql (p.25)"] },

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
      seiAsk: s.seiAsk,
      author: authorFor(s.conf), draft: true, accepted: false }));
}

// Acting on a seed writes it into the store first, so accept and edit —
// which both read store.a[id] — have a row to work on and the seed's qid
// is not lost.
export function materialise(store, row) {
  if (!row || !isSeedId(row.id) || (store.a && store.a[row.id])) return store;
  const { id, ...rest } = row;
  return { ...store, a: { ...store.a, [id]: rest } };
}
