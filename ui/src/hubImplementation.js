// Implementation guidance for components the events-primary review does not
// reach — platform, runtime, deployment, consumers and the SEI-owned contracts.
//
// The review covers the 25 components it adds and the 25 it changes. The other
// 40 were left with placeholder sections, which is how a design document stops
// being read. This module fills them, from the build perspective.
//
// Two rules held throughout:
//   1. Where a figure or decision is genuinely unknown, it says so, says why it
//      blocks the build, and gives the default to adopt until it is answered.
//      A stated default that someone can argue with beats a blank.
//   2. Nothing here is invented detail about SEI's systems. Where the answer is
//      theirs, the entry is a question with a recommended shape, not a claim.

/* ------------------------------------------------------------------ *
 * Archetypes — matched on zone and plane                              *
 * ------------------------------------------------------------------ */
export const IMPL_ARCHETYPES = {
  "sei-contract": {
    label: "SEI-owned · contract only",
    match: (c) => c.zone === "1. SEI",
    build:
      "BBH builds nothing here. The deliverable is a **signed interface contract** and the " +
      "acceptance criteria BBH holds SEI to, not a component. Treating these as design work is " +
      "how a dependency with no owner ends up on the critical path.",
    implement: [
      ["Interface inventory", "Name, owner, direction, cadence, business calendar, volume band and SLA for every interface. One row per interface, versioned, and it is the input to the expectation store."],
      ["Schema contract", "The RAW DDL is the contract, because FILE_SCHEMA_CONFIG holds no column mapping. So the contract must state how a change is notified, with what lead time, and what backward-compatibility rule applies."],
      ["Error semantics", "What SEI returns, in what shape, for a rejection — and whether a partial acceptance is possible. Partial acceptance is the norm on loaders and changes every downstream count."],
      ["Environment access", "A non-production SEI endpoint BBH can test against, with representative data. Without it, the first integration test is in production."],
      ["Change protocol", "Notification channel, lead time, dual-running window, and who signs off. Template versions already move independently (v1.24, v1.21, v9 live together)."],
    ],
    unknown: [
      ["The interface list itself",
       "The architecture says roughly 43 interfaces per business date. The TDDs model exactly three RAW tables — RAW_ACCOUNT, RAW_CLIENT, RAW_TRANSACTION — with RAW_POSITION appearing in figures and nowhere else. Either forty are undocumented, or 'interface' counts something other than a table.",
       "Ask for the list before sizing anything. Until it exists, design for the three that are modelled and mark every count that depends on interface cardinality as provisional."],
      ["Volume per interface",
       "No file sizes, row counts or growth rates anywhere. Pod sizing, storage, retention and the SLA budget all depend on them.",
       "Ask. Until answered, instrument from day one and publish the observed distribution after two weeks rather than guessing now."],
    ],
    recommend:
      "Give every interface a contract with acceptance criteria and a named SEI owner, and let " +
      "nothing enter the Hub build plan until its contract is agreed. The contract is the " +
      "deliverable; the component row is just where it is tracked.",
  },

  platform: {
    label: "OpenShift · platform",
    match: (c) => c.plane === "Platform",
    build:
      "Standard OpenShift tenancy, with one shape that is new: the SDC event listener is a " +
      "**long-running Deployment**, not a Job. Every other workload in this estate is a pod that " +
      "starts, does one unit of work and exits. That difference propagates into service accounts, " +
      "network policy, disruption budgets and how the platform is monitored.",
    implement: [
      ["Namespaces", "One per environment per tier. The listener gets its own so a restart or a quota breach cannot take the batch path with it."],
      ["Images", "Built once in CI, scanned, signed, and promoted **by digest, not by tag**. A tag that moves between environments makes an incident unreproducible."],
      ["Service accounts", "One per workload, least privilege, no shared account between the listener, the workers and the dbt runner. The listener needs Event Hub egress that nothing else should have."],
      ["SCC", "`restricted-v2` unless a workload proves it needs more, in writing. Nothing in this design needs privileged."],
      ["Secrets", "From the platform secret store through External Secrets or equivalent. Never in a ConfigMap, never in an image, never in an Airflow Variable."],
      ["Network policy", "Default-deny, with explicit egress to Oracle, Apigee and Event Hub, and explicit ingress only to the callback receiver. The receiver is the one component SEI reaches, so it is the one that needs an ingress rule at all."],
      ["Storage", "Persistent volumes only for Airflow logs and the landing-zone mount. Nothing in the event path needs durable local storage — durability is Oracle's job."],
    ],
    unknown: [
      ["Which Oracle, which Event Hub namespace, and whether egress goes through a proxy",
       "Network policy and connection strings cannot be written without them, and an egress proxy changes the client configuration in every workload.",
       "Capture all three in the metadata store as environment configuration, not in code, so the same image runs in every environment."],
      ["Whether the landing zone is a mount or an object store",
       "It decides whether the trailer reader is a filesystem read or an API call, and whether a PV is needed at all.",
       "Prefer object storage with a read-only credential. A shared filesystem mount across namespaces is the harder thing to secure and the harder thing to scale."],
    ],
    recommend:
      "Write the listener's platform requirements separately from the batch workloads'. They are " +
      "different workload classes and folding them into one namespace, one service account and one " +
      "set of quotas is the decision that will be hardest to unpick later.",
  },

  runtime: {
    label: "OpenShift · runtime",
    match: (c) => c.plane === "Runtime",
    build:
      "This plane carries the whole cost of the events substitution. Moving from about one DAG run " +
      "a day to 288, each with per-domain dynamic task mapping, multiplies task instances by two to " +
      "three orders of magnitude. Nothing in the SEI pack has costed the scheduler itself.",
    implement: [
      ["Scheduler sizing", "Airflow's scheduler polls its metadata database continuously with SELECT FOR UPDATE. Size the scheduler and that database for the new task rate before build, not after the first slow morning."],
      ["Metadata retention", "At roughly 300x the task volume, `task_instance` and `dag_run` become the largest tables in the estate within weeks. Set an aggressive retention and run the cleanup as a scheduled DAG."],
      ["Worker autoscaling", "Scale on queued task count, not CPU. CPU is flat while pods wait on Oracle, so a CPU-based policy scales down exactly when the backlog is growing."],
      ["Warm start", "Pod start time is now a budget line. A 40-second image pull inside a 300-second cadence is 13% of the cycle spent before any work begins. Pre-pull images to every node and keep a warm pool sized to the median micro-batch."],
      ["Connection pooling", "Bound the pool per pod **and** the pod count per micro-batch. Dynamic task mapping spawns a pod per work item and each opens its own connections; an unbounded fan-out against a shared Oracle is how one pipeline takes down another team's service."],
      ["Node placement", "Keep the listener off the nodes that absorb the batch fan-out. It is the one workload whose restart loses ordering position, so it should not be the one evicted when the batch spikes."],
    ],
    unknown: [
      ["Micro-batch cadence and the volume inside one",
       "Everything on this plane is sized from those two numbers and neither is stated. Five minutes is the file-discovery interval, not a confirmed event cadence.",
       "Do not size on an assumed cadence. Instrument the ratio of micro-batch duration to cadence interval and treat 0.7 as the ceiling — above it the system has no recovery headroom and a small latency regression becomes an unbounded backlog."],
      ["Whether 288 scheduled DAG runs is the right shape at all",
       "A long-running consumer with an internal loop would avoid the scheduler multiplication entirely, at the cost of losing Airflow's retry and observability for the ingest leg.",
       "Prototype both before committing. The decision is cheap now and structural later. Our recommendation is a long-running consumer for intraday ingest and the existing DAG for the EOD transformation, meeting at the gate."],
    ],
    recommend:
      "Treat the intraday path and the EOD path as two runtimes that share a database, not one " +
      "runtime that runs more often. Every problem on this plane comes from stretching a daily " +
      "batch shape across a continuous workload.",
  },

  deployment: {
    label: "OpenShift · deployment",
    match: (c) => c.plane === "Deployment",
    build:
      "Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with " +
      "`on_schema_change='fail'`**, so reverting a model version does not revert the data it " +
      "already merged. Rollback here is forward-fix plus a data repair, and the design has to say " +
      "so rather than implying a revert is enough.",
    implement: [
      ["Pipeline stages", "Lint, unit test, dbt parse and compile, dbt build against a seeded test schema, then promote the image by digest. The dbt compile step is where a generated model from the rule registry is validated before anyone reviews it."],
      ["GitOps", "Declarative environment state, with the image digest as the only thing that differs between environments. Configuration comes from the metadata store, not from a per-environment manifest."],
      ["dbt release", "A model version and its ruleset version travel together. Rolling back one without the other leaves Gold rows stamped with a `RULE_SET_VERSION` whose logic is no longer deployed."],
      ["Data repair path", "Document it explicitly: which restatement DAG, who approves, and how the affected business dates are identified. A rollback runbook that stops at 'revert the model' is incomplete and will be discovered mid-incident."],
      ["Database change management", "Every schema change is a migration with a forward script and a rollback script, versioned alongside the code. The P-marked columns in the build spec are the first batch."],
    ],
    unknown: [
      ["Whether a seeded test schema with representative data exists",
       "Without it, `dbt build` in CI proves only that the SQL parses. The first real test of a transformation is then production.",
       "Build one from a masked subset, refreshed monthly. It is also what makes restatement rehearsable, which D.1 to D.6 currently assume without providing."],
      ["Who approves a restatement",
       "D.3 says 'approved restatement' and names no approver. Approval of a procedure that rewrites a closed business date is a control, not a formality.",
       "Name the role in `STATUS_TRANSITION.APPROVER_ROLE` and enforce it at the transition rather than in a runbook nobody reads at 3am."],
    ],
    recommend:
      "Write the rollback runbook before the first release, and test it on a real business date in " +
      "a lower environment. With DML-only Gold, the difference between a ten-minute incident and a " +
      "two-day one is whether that runbook existed beforehand.",
  },

  operations: {
    label: "OpenShift · operations",
    match: (c) => c.plane === "Operations",
    build:
      "The weakest-covered plane in the pack. D.1 to D.6 are data-correction procedures; there is " +
      "no disaster recovery section in any document, no RPO, no RTO and no failover story.",
    implement: [
      ["Recovery objectives", "Derive them rather than declare them. Under events, **Event Hub retention is the replay window and therefore the RTO** — if retention is seven days, no recovery objective longer than seven days is achievable whatever the document says."],
      ["Backup surface", "The Oracle control tables are the recovery surface: registries, DATE_CONTROL, the micro-batch registry, DQ and recon. RAW is the replay source and has no stated retention anywhere, which makes the recovery window unknown."],
      ["Monitoring the monitors", "If the ingestion DAG stops being scheduled, 'no files discovered' is indistinguishable from 'no files arrived', the gate is never evaluated, and the outage is silent for as long as nobody looks. A heartbeat that alerts on absence is the single highest-value monitor on this plane."],
      ["Maintenance windows", "The single-active-date invariant and the five-minute loop both have opinions about an outage spanning midnight, and neither is written down."],
      ["Cost and capacity", "Follows from volumetrics, which do not exist. Oracle storage growth, OpenShift pod-hours and Splunk ingest all scale with cadence rather than with account count."],
    ],
    unknown: [
      ["Event Hub retention",
       "It is the RTO and it is unstated. Every recovery conversation is unanchored without it.",
       "Ask SEI, then write the RPO and RTO from it rather than the other way round. A recovery objective the platform cannot physically meet is worse than none."],
      ["Whether Oracle is HA, and what the failover behaviour is for in-flight transactions",
       "A micro-batch is one commit. Failover mid-commit decides whether that box is retryable or lost.",
       "Confirm the Oracle topology and test a failover with a micro-batch in flight before go-live. This is a half-day test that prevents a class of incident nobody can debug afterwards."],
    ],
    recommend:
      "State the retention figures first — Event Hub, RAW and INT — because every recovery objective " +
      "on this plane is a consequence of them. Then write the DR section the pack does not have.",
  },

  "hub-event": {
    label: "Hub · event ingestion",
    match: (c) => c.plane === "Event Ingestion",
    build:
      "The chain between SEI publishing and Stage 1 holding rows. None of it exists in any document, " +
      "all of it is BBH-owned, and it is the path that carries the daily load. Build it as one " +
      "deployable unit with one owner, not as six components discovered separately.",
    implement: [
      ["Process shape", "A long-running consumer, not a scheduled job. Ordering position lives in the consumer's offset, and a process that exits and restarts 288 times a day re-establishes that position 288 times."],
      ["Commit discipline", "Durable write, then offset commit. One commit per micro-batch, array insert rather than row-by-row. This is the first wall every event pipeline hits and it arrives early."],
      ["Back-pressure", "When the puller falls behind, staging keeps accepting and the pull queue grows. Bound the queue and shed to the next cycle rather than letting one slow view stall the box behind it."],
      ["Idempotency", "Two layers, because they catch different things. Offset uniqueness stops a consumer replay; collapsing to a distinct key set per view per micro-batch stops a producer retry, which arrives at a different offset with identical content."],
      ["Observability from day one", "enqueued_ts and sequence_number captured at receipt, or lag and gap detection are not computable at all — not harder, not computable. This is the single decision that cannot be retrofitted."],
    ],
    unknown: [
      ["Partition count per domain topic",
       "It is the denominator for 'every partition reported MB End' and the ceiling on consumer parallelism. Without it, completeness on the event channel is unprovable and throughput is unknown.",
       "Ask SEI. Until answered, record partitions_expected as null and never render a completeness verdict from a null denominator — show UNKNOWN rather than GOOD."],
      ["Whether the pull can retrieve state as of the event",
       "If it can only read current state, replaying a micro-batch returns today's values and the file model's replay guarantees do not carry over. Every recovery procedure depends on this answer.",
       "Ask before designing recovery. If as-of retrieval does not exist, store the pulled payload — it is the only other way to make a restatement reproduce the original load."],
    ],
    recommend:
      "Build the staging store and the micro-batch registry first, before the listener. They are the " +
      "two artefacts that make everything after them observable, and a listener shipped without them " +
      "produces a pipeline nobody can debug.",
  },

  "hub-ingress": {
    label: "Hub · ingress and egress",
    match: (c) => c.plane === "Ingress/Egress",
    build:
      "Two directions with almost nothing in common. Inbound is now a standby file path that must " +
      "prove a file was generated and held. Outbound is a live submission loop with a validation " +
      "gate, a payload record, a push receiver and a backstop poller, none of which exist.",
    implement: [
      ["Inbound, as standby", "The sensor's job changes from 'did the data arrive' to 'is the parachute packed'. It needs a registry state meaning available-and-deliberately-unused, which the pack does not have, or a held file looks either missing or falsely satisfies a gate that should not be running."],
      ["Outbound ordering", "Generate, validate, record, submit — in that order. Recording the payload and its hash after a successful send cannot explain a send that failed halfway."],
      ["Receiver discipline", "Authenticate, validate envelope shape, durable write, 202. Nothing else inline. Correlation and status derivation happen downstream of the acknowledgement."],
      ["Poller discipline", "Non-terminal submissions only, tiered cadence, detail fetched once on reaching terminal-with-errors. Terminal submissions must drop out of the poll set or call volume grows with history instead of with work in flight."],
      ["Apigee", "One proxy, two paths — submit and status-return — with separate quotas. A burst of status polls should not be able to exhaust the submit quota."],
    ],
    unknown: [
      ["SEI's status API contract",
       "Endpoint, auth, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable. The poller's cadence and budget are unsizable without them.",
       "Ask, and treat retention as the urgent one: if SEI purges reject detail after a window, BBH's stored copy becomes the system of record for outbound exceptions and the fetch acquires a deadline."],
      ["Whether loader groups are a sequencing constraint",
       "Group 2, 3 and 4 appear consistently in the catalogue. If Group 2 must land before Group 3, a Group 2 failure blocks everything behind it — the outbound equivalent of the date gate.",
       "Assume they are ordered until told otherwise, and make the dependency explicit in the submission registry. Discovering it after a failure is the expensive way to learn it."],
    ],
    recommend:
      "Split this component set in two on the plan. Inbound standby is small and nearly done; " +
      "outbound is eight components and has no design at all. Tracking them as one plane hides how " +
      "unequal they are.",
  },

  "hub-processing": {
    label: "Hub · processing",
    match: (c) => c.plane === "Processing",
    build:
      "RAW to Gold, and the layer where the events substitution costs most. The models themselves " +
      "are specified; what changes is how often they run and what that does to a design shaped for " +
      "one nightly pass.",
    implement: [
      ["Commit granularity", "One commit per micro-batch into Stage 1. Per-row commits thrash the redo log; one commit per day is not available any more."],
      ["Incremental predicates", "Push the INT predicate down to Stage 1's partition so the STG view scans one micro-batch rather than the accumulated day. Verify it on the actual execution plan — do not assume the push-down happens."],
      ["Partition strategy", "INT's current-day partition is written to continuously under intraday, so an incremental MERGE degrades as the day goes on. Subpartition by micro-batch, or load append-only with a late dedupe at the gate."],
      ["Traceability", "Add MICROBATCH_ID to Stage 1 and carry it forward. Without it, lineage from a Gold row stops at the business date — free now, a change request after deployment."],
      ["Schema change", "Gold runs on_schema_change='fail' and the RAW DDL is the schema contract. Any column change is a coordinated release, so the contract with SEI has to state notification and lead time."],
    ],
    unknown: [
      ["Which layer model is real",
       "The SEI pack has RAW to STG (a view) to INT to DIM and FACT. This codebase names a Stage 2 Enriched layer and a Pre-Gold Exadata tier that the pack does not have.",
       "Reconcile before build. Two layer models in two documents means whichever one a developer opens first becomes the implementation."],
      ["Volume per micro-batch",
       "Partition strategy, commit size and the degradation curve on the current-day partition all depend on it, and none of it is stated.",
       "Measure the degradation curve in a lower environment before choosing a partition strategy. It may be acceptable at real volumes — but nobody knows the real volumes."],
    ],
    recommend:
      "The STG view is the one to look at first. A view recomputed once a night is elegant; the same " +
      "view recomputed 288 times a day, each time scanning Stage 1, is the largest single cost the " +
      "substitution introduces.",
  },

  "hub-orch": {
    label: "Hub · orchestration",
    match: (c) => c.plane === "Orchestration",
    build:
      "C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete " +
      "moment when everything has arrived, and events never produce one. Do not extend the daily " +
      "DAG to run 288 times; separate the clocks.",
    implement: [
      ["Two runtimes", "A long-running consumer owns the intraday path. The existing DAG owns the EOD transformation. They meet at a gate that requires every micro-batch LOADED plus the marker received."],
      ["The gate", "Marker-only gating lets the transformation run on short Stage 1, and STG_TO_INT still reconciles because it ties against a Stage 1 that is itself short. The gate must count micro-batches, not trust a signal."],
      ["Conditional ordering", "Only serialise dim-before-fact when the micro-batch actually contains both domains. Paying the ordering cost 288 times for boxes holding one domain is waste."],
      ["Bounded retry", "Maximum attempts per work item before quarantine. The replay engine has no limit today, so a permanently failing item retries for ever and consumes capacity every cycle."],
      ["Partial-batch policy for views", "The existing policy covers partial file batches. Three of five views pulling successfully inside one micro-batch is the equivalent case and the more frequent one, and it is unowned."],
    ],
    unknown: [
      ["How transform__<BUSINESS_DATE> and restatement both hold",
       "The run already exists and succeeded, so Airflow refuses a second one, and C.1's reconciliation path fires only when no matching run exists — the opposite case. As written the run-id rule and the recovery procedure contradict each other.",
       "Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down."],
      ["Whether there is an intraday SLA at all",
       "The pack's only clock is the EOD cutoff. Without an intraday definition of 'behind', a micro-batch that failed at 11am is not late, only absent, and nothing escalates.",
       "Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write."],
    ],
    recommend:
      "Answer the run-id contradiction before anything else on this plane is built. Every recovery " +
      "procedure in the pack depends on a mechanism that cannot currently execute.",
  },

  "hub-dq": {
    label: "Hub · data quality",
    match: (c) => c.plane === "Data Quality",
    build:
      "Five gates designed for a daily file cycle, and they split cleanly by cost. Getting the split " +
      "wrong is the difference between 288 cheap checks a day and 288 full-table aggregates.",
    implement: [
      ["Cost class decides cadence", "Row-level gates (G0 envelope, G1 structural, G3 dbt tests) run per micro-batch. Set-level gates (G2 profiling, G4 tie-out, G5 post-publish recon) run at the EOD gate only."],
      ["Rules as data", "A rule registry with is_blocking per rule, not per gate. That settles the blocking-versus-advisory argument one rule at a time instead of as a single estate-wide decision nobody can make."],
      ["Evidence a rule ran", "Record PASS, WARN, FAIL and NOT_RUN. Recording only failures makes zero rows ambiguous — either everything passed or nothing ran, and a gate that silently did not execute looks exactly like a clean night."],
      ["Threshold in force", "Copy the applied threshold onto the result row. Changing a threshold must never rewrite history, and a verdict has to stay defensible three months later."],
      ["Outbound has a gate too", "G6 validates a loader before submission and blocks it. G1 to G5 all face inbound, so today the first validator of a BBH loader is SEI."],
    ],
    unknown: [
      ["Which rules exist",
       "The gates are code with no registry, so which rules ran against which model on which date is unanswerable today.",
       "Extract the existing checks into the registry as the first migration rather than designing a new rule set. The rules already exist; what is missing is that they are not data."],
      ["Whether a failed reconciliation may publish to Gold",
       "RECON_RESULT stores counts and no status, and the verdict is derived in Splunk, so reconciliation is advisory by construction and the current answer is yes.",
       "Decide explicitly. If the answer is meant to be no, it needs a blocking gate, because nothing stops it today."],
    ],
    recommend:
      "Write the cost class onto every rule before the first one is built. It is one column, and it " +
      "is what stops the 288x problem being rediscovered by whoever writes the DAG.",
  },

  "hub-foundation": {
    label: "Hub · foundation",
    match: (c) => c.plane === "Foundation",
    build:
      "Estate-wide services, and the plane where the substitution costs most because every component " +
      "here is used by every other. The pack specifies tables; it does not specify a framework, and " +
      "the difference shows as four error vocabularies in one pipeline.",
    implement: [
      ["Extend, do not duplicate", "One quarantine with event and outbound reason taxonomies, one reconciliation framework with twelve boundaries rather than three, one configuration store holding the new catalogues. A parallel event-side foundation is the failure mode to avoid."],
      ["Vocabulary as reference data", "Error codes, status values and DQ reasons live in tables with a disposition and an owner. An unknown value raises rather than being mapped to its nearest neighbour."],
      ["State machines as data", "Every domain's states in one registry, with a sort order, so 'terminal never regresses' is enforceable rather than re-implemented in each component."],
      ["Thresholds in one place", "Every tolerance, SLA percentage, max age and lag threshold in one versioned table, with the applied value copied onto each verdict."],
      ["Masking on read", "Business keys masked on the way out, not at rest, so a wrong mask is correctable without having destroyed the original."],
    ],
    unknown: [
      ["Where a read-only consumer role comes from",
       "A12 grants the loader DML on RAW plus the registry and DML-only on Gold, and describes no consumer grant at all. Improvised at connection time, that means reusing the loader's account.",
       "Add the role to the security model as part of this plane rather than leaving each consumer to ask for access separately."],
      ["The masking policy for the 786 PII fields in SDC scope",
       "It is unapproved, so any consumer either masks on its own judgement or shows unmasked business keys.",
       "Default to hashing business keys until the policy lands. A stable hash is still joinable, which is what most consumers actually need."],
    ],
    recommend:
      "Sequence it: the status registry first because it is small and unblocks the outbound model, " +
      "then DQ run results because a gate that did not run is currently invisible, then the error " +
      "model seeded from codes already in use so nothing is invented and nothing is lost.",
  },

  consumers: {
    label: "Zone 3 · Gold consumers",
    match: (c) => c.zone === "3. Consumers",
    build:
      "These read Gold; they do not participate in the pipeline. The build work is a **published " +
      "consumer contract** per consumer. And there is a decision here that has already been made " +
      "implicitly and never communicated: adopting events means Gold changes during the day.",
    implement: [
      ["Freshness contract", "State per consumer whether it reads an EOD-stable Gold or a Gold that moves intraday. Under the file model this question did not exist, because Gold changed once a night."],
      ["Read grain and interface", "Direct table read, a view, or an extract. A view is the only one of the three that lets the physical model change without a consumer release."],
      ["Publication signal", "How a consumer knows a business date is complete and safe to read. `DATE_CONTROL` reaching COMPLETE is the natural signal, and nothing currently publishes it outward."],
      ["Access", "A read-only role per consumer with SELECT on the Gold objects only. A12 grants the loader DML and describes no consumer grant at all."],
      ["Backward compatibility", "Gold runs `on_schema_change='fail'`, so a column addition is already a controlled event. Say which consumers must be notified and with what lead time."],
    ],
    unknown: [
      ["Whether consumers expect Gold to be stable during the business day",
       "This is the important one. Intraday event ingestion means DIM and FACT can change between two reads on the same day. A consumer that reconciles a report at 11am and again at 4pm will get two answers and will report it as a defect.",
       "Decide explicitly and publish it. If consumers need stability, Gold needs a published snapshot per business date and the intraday writes land somewhere they do not read. That is an architectural change, not a configuration one, and it is far cheaper to decide now."],
      ["Which consumers are in scope for phase 1",
       "PBDW, IMDS and Pivotal are named as Final Gold consumers; BI, real-time consumers and existing BBH systems are listed without scope.",
       "Scope them explicitly. A consumer discovered late is a schema commitment made late."],
    ],
    recommend:
      "Publish a one-page contract per consumer covering freshness, grain, interface, access and " +
      "notification. The intraday-stability question should be answered before any of them are " +
      "written, because it changes what the contract can promise.",
  },
};

/* ------------------------------------------------------------------ *
 * Component-specific build notes, where the archetype is not enough   *
 * ------------------------------------------------------------------ */
export const IMPL_COMPONENT = {
  "51": { note: "Airflow 3.0 brings asset and dataset triggering, which is the right mechanism if SEI signals EOD file arrival by event rather than BBH polling for it. That would replace the five-minute discovery loop in C.3 and close open item O1 at the same time." },
  "52": { note: "Scale on queued tasks. Also cap concurrency per micro-batch: the failure mode is not too few workers, it is every worker starting at once against one Oracle." },
  "54": { note: "Warm-start matters here in a way it did not under a daily batch. Measure pod start time as a percentage of the cadence interval and treat it as a budget line, not an optimisation." },
  "55": { note: "Bound the pool per pod and the pods per micro-batch, and set both from the observed ratio of micro-batch duration to cadence. The number cannot be derived from anything currently documented." },
  "57": { note: "The CI pipeline gains a rule-compilation stage once Stage 2 to Gold rules are externalised: regenerate the dbt models from the approved ruleset, fail the build if the generated SQL is not byte-identical to what is committed, and run the rule expectations as unit tests." },
  "59": { note: "With DML-only Gold, 'rollback' means forward-fix plus data repair. The runbook must name the restatement DAG, the approver and how affected business dates are identified." },
  "60": { note: "The P-marked columns from the build spec — RAW_*.FILE_REGISTRY_ID, RECON_RESULT.MODEL_NAME, CK_FILE_REGISTRY_STATUS, IX_FILE_REGISTRY_DATE_STATUS, EXPECTED_INTERFACE_CALENDAR, REQUIRED_IND — are the first migration batch and are all still proposals. Every one is free now and a change request after deployment." },
  "62": { note: "Event Hub retention is the RTO. Establish it before writing any recovery objective." },
  "64": { note: "The highest-value monitor is a heartbeat on the scheduler itself. Everything else on this plane detects a failure that happened; this one detects a failure that is not happening." },
  "37": { note: "PBDW is the system of record downstream. If any consumer needs an EOD-stable Gold, it is this one, and it should be the first contract written." },
  "40": { note: "Design-only in this phase. The risk is that a canonical model designed after three consumers are live inherits three sets of compromises." },
  "42": { note: "Real-time consumers and intraday Gold are the same question from two directions. Answer the freshness contract once." },
  "12": { note: "The API gateway is independent of the batch path by design, which also means it is the one lane with no completeness gate. Anything served here is 'whatever Gold holds right now' — state that in the contract rather than leaving it inferred." },
};

/* ------------------------------------------------------------------ *
 * Estate-wide implementation conventions                              *
 * ------------------------------------------------------------------ */
export const IMPL_CONVENTIONS = [
  ["Configuration, not code", "Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently."],
  ["Reproducible verdicts", "Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended."],
  ["Bound everything that fans out", "Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle."],
  ["Write then acknowledge", "Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path."],
  ["Absence is a state", "NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one."],
];

export const archetypeFor = (c) => {
  for (const [key, a] of Object.entries(IMPL_ARCHETYPES)) if (a.match(c)) return { key, ...a };
  return null;
};
