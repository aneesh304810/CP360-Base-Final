// The supplement, checked against what the Hub already models.
//
// THIS FILE IS THE POINT OF LOADING THE SUPPLEMENT AT ALL. Holding a
// second design document beside the first is worth nothing if nobody
// compares them; the value is entirely in the places where they do not
// agree, and those places are invisible unless somebody writes them down.
//
// FOUR VERDICTS, AND "AGREES" EARNS ITS PLACE. A conflict needs deciding.
// A closure means something the Hub flagged as missing now has an answer.
// An extension is new material with nothing on our side yet. And "agrees"
// matters because a reader who sees only disagreements assumes the two
// documents are at war; naming what they confirm is what makes the
// conflicts credible.
//
// NOTHING HERE IS SILENTLY RESOLVED. Where the supplement and the baseline
// disagree, both readings are stated and the decision is named. The one
// thing this file does assert is which of the two the app is currently
// DRAWING, because that is a fact about our own screens.

export const RC_VERDICT = {
 conflict: { n: "Conflict", w: "the two disagree and somebody has to choose",
   c: "#c1113a" },
 closes:   { n: "Closes a gap", w: "answers something the Hub flagged as missing",
   c: "#159943" },
 extends:  { n: "New", w: "material the Hub has nothing for yet", c: "#e67e22" },
 agrees:   { n: "Confirms", w: "independently states what the baseline already says",
   c: "#3a6f9e" },
};

/* id, verdict, title, what the supplement says, what the Hub holds,
   what it costs to leave open, and where in the app it lands. */
export const RECONCILE = [
 /* ---------------------------------------------------- conflicts ---- */
 { id: "R1", v: "conflict", t: "Stage 3 names two different things",
   sup: "Stage 3 IS Pre-Gold, on Oracle Exadata, and a fourth tier - "
      + "Consumer Movement - carries publish and delivery with no "
      + "transformation in flight.",
   hub: "The data path draws Stage 3 as the warehouse itself, with Pre-Gold "
      + "as a separate layer before it and no publish tier at all.",
   cost: "Every document that says 'Stage 3' means one of two different "
       + "databases. The acceptance criterion 'every component is assigned "
       + "to one canonical domain and tier' cannot be evaluated until this "
       + "is picked.",
   dec: "DEC-GAP-01", where: "the database model, and PROC_STAGES" },

 { id: "R2", v: "conflict", t: "DIM and FACT are in the wrong tier",
   sup: "Dimensions, facts, aggregates and control-total preparation are "
      + "Stage 3 Pre-Gold, on Exadata. Stage 2 is normalised canonical "
      + "entities and stops there.",
   hub: "Stage 2 INT is drawn as INT, DIM and FACT together, on the same "
      + "Oracle estate - which is how both SEI design documents describe it.",
   cost: "This is not a folder move. If the supplement holds, DIM and FACT "
       + "change database, the dbt chain splits across two estates, and the "
       + "STG-to-INT reconciliation boundary stops being the last one that "
       + "matters.",
   dec: "DEC-GAP-01", where: "PROC_STAGES, the stage chain, the database model" },

 { id: "R3", v: "conflict", t: "The file lifecycle has two sets of state names",
   sup: "DISCOVERED, PROCESSING, DUPLICATE_SKIPPED, QUARANTINED, FAILED, "
      + "ARCHIVE_FAILED, ARCHIVED.",
   hub: "RECEIVED, VALIDATED, LOADING, QUARANTINED, FAILED, ARCHIVE_FAILED, "
      + "ARCHIVED - from the File Ingestion design document.",
   cost: "Two names for one state machine is two state machines. Operators "
       + "will see one set in the registry and the other in the runbook, and "
       + "DUPLICATE_SKIPPED exists in only one of them.",
   dec: "none raised - worth one", where: "SEI_STATES, the file ingestion screen" },

 { id: "R4", v: "conflict", t: "Three different counts of reconciliation boundaries",
   sup: "Seven boundaries, including Stage 2 to Stage 3 and publish to "
      + "consumer acknowledgement.",
   hub: "The pack specifies three. The architect review recommends twelve "
      + "under an event-primary posture.",
   cost: "Nobody can say whether reconciliation is complete, because "
       + "complete is three, seven or twelve depending on which document is "
       + "open.",
   dec: "none raised - worth one", where: "RECON_RESULT, the DQ lane" },

 { id: "R5", v: "conflict", t: "Stage 2 retention is settled here and open there",
   sup: "Seven-day retention WHERE DEFINED, and SILVER-DEC-06 leaves "
      + "retention and partition management open per entity.",
   hub: "Seven days, partition drop, stated flatly on every one of the 52 "
      + "tables.",
   cost: "The replay window follows from retention. Stating it as settled "
       + "when it is a per-entity decision makes every replay answer "
       + "provisional without saying so.",
   dec: "SILVER-DEC-06", where: "the INT contract, every table record" },

 /* ------------------------------------------------------- closes ---- */
 { id: "R6", v: "closes", t: "The outbound submission registry now has a design",
   sup: "WORKFLOW_DEFINITION to WORKFLOW_INSTANCE to LOADER_DELIVERY and "
      + "API_CALL, each reporting STATUS_EVENT.",
   hub: "The loader loop screen says there is no outbound equivalent of "
      + "FILE_REGISTRY, so a reject count has nothing to reconcile against "
      + "and a batch that never comes back never ages out.",
   cost: "Closed, if the ERD is approved. LOADER_DELIVERY plus STATUS_EVENT "
       + "is the registry that was missing.",
   dec: "none", where: "the loader loop, the database model" },

 { id: "R7", v: "closes", t: "Stage 2 to Stage 3 movement has a pattern and a gate",
   sup: "Database-link or direct-path movement preserving LOAD_ID and "
      + "BUSINESS_DATE, with a reconciliation gate that authorises or holds "
      + "the publish scope, and a replay boundary scoped by date and load.",
   hub: "The database picture has no movement component at all - Pre-Gold "
      + "simply follows DIM and FACT with nothing in between.",
   cost: "Closed in design. Still needs DEC-GAP-04 to pick the mechanism.",
   dec: "DEC-GAP-04", where: "the database model, the data path" },

 { id: "R8", v: "closes", t: "Correlation across the loader round trip",
   sup: "CORRELATION_ID propagated through Hub, orchestration, API and "
      + "loader execution, callback and monitoring; IDEMPOTENCY_KEY stable "
      + "across retries of the same business operation.",
   hub: "The loader screen asks for one submission id threading all four "
      + "legs, and names it as missing.",
   cost: "Closed. The identifiers exist and have propagation rules.",
   dec: "none", where: "the loader loop" },

 /* ------------------------------------------------------ extends ---- */
 { id: "R9", v: "extends", t: "LOAD_ID is missing from every model we draw",
   sup: "LOAD_ID is the identifier preserved from RAW through Stage 2, "
      + "Stage 3, replay and publish evidence, and acceptance criterion 4 "
      + "depends on it.",
   hub: "Stage 1 adds BUSINESS_DATE, SRC_RECORD_ID, FILE_REGISTRY_ID and "
      + "LOAD_TS. Stage 2's standard columns add MICRO_BATCH_ID and "
      + "DBT_INVOCATION_ID. Neither carries LOAD_ID.",
   cost: "Without it there is no single identifier for one load execution "
       + "across four tiers, and the Stage 2 to Stage 3 reconciliation gate "
       + "has nothing to key on. This is a hole in our own model, not in "
       + "theirs.",
   dec: "SILVER-DEC-04", where: "S1_COLS and S2_STD_COLS" },

 { id: "R10", v: "extends", t: "Seven of 52 canonical models exist",
   sup: "The code sample implements Account, Account Optional Field, Asset, "
      + "Reference, Tax Lot, Transaction Header and Transaction Detail. "
      + "Four of those seven are mapped to fewer attributes than the "
      + "canonical model defines. The other 45 are targets.",
   hub: "All 52 canonical tables are drawn alike, with no build status at "
      + "all - a model and an intention look identical.",
   cost: "Anyone sizing the work from our screens sees 52 designed tables "
       + "and no indication that 45 of them do not exist.",
   dec: "SILVER-DEC-01", where: "the Stage 2 canonical model" },

 { id: "R11", v: "extends", t: "Three foundation entities with no table anywhere",
   sup: "Workflow metadata, API configuration and a schema registry are "
      + "named as control and metadata entities.",
   hub: "The database model holds five control tables. None of these three "
      + "is among them, and nothing else in the corpus defines them.",
   cost: "The outbound path is configuration-driven by design and has no "
       + "configuration store. Schema registry ownership is DEC-GAP-07 and "
       + "unassigned.",
   dec: "DEC-GAP-07", where: "the control plane" },

 { id: "R12", v: "extends", t: "A consumer-oriented model is sitting in Stage 2",
   sup: "int_bbh_open_trade_star joins six INT models into a denormalised "
      + "target layout and belongs in Pre-Gold or Publish.",
   hub: "Nothing. The app models the canonical layer and has no view of what "
      + "is actually in the dbt project.",
   cost: "Consumer denormalisation inside Stage 2 is what stops Stage 2 "
       + "being reusable: the next consumer needs a different shape and gets "
       + "a second star beside the first.",
   dec: "SILVER-DEC-07", where: "nothing yet" },

 { id: "R13", v: "extends", t: "Graceful degradation has four named behaviours",
   sup: "Oracle unavailable: do not claim or advance durable state. Splunk "
      + "or Integration360 unavailable: follow the buffering policy, never "
      + "silently discard required evidence. SEI APIs unavailable: workflow "
      + "state stays queryable, retry reuses the same correlation and "
      + "idempotency keys. CP360 UI unavailable: durable state remains in "
      + "Oracle and Airflow.",
   hub: "Nothing on partial failure of a dependency.",
   cost: "The third one is the sharp one: evidence silently discarded during "
       + "a Splunk outage is indistinguishable afterwards from evidence that "
       + "was never produced.",
   dec: "DEC-GAP-08", where: "nothing yet" },

 { id: "R14", v: "extends", t: "Landing zone failure modes, including ambiguous match",
   sup: "Partial file exposure, duplicate physical delivery for the same "
      + "logical interface and date, no configuration match, MORE THAN ONE "
      + "configuration match, storage unavailable. A file matching two "
      + "configurations is a configuration error and is not loaded.",
   hub: "The file screen covers validation thoroughly and says nothing about "
      + "what happens before a file is matched to an interface.",
   cost: "Ambiguous match is the one with no safe default: loading against "
       + "the first match silently routes a file to the wrong RAW table.",
   dec: "DEC-GAP-02, DEC-GAP-03", where: "the file ingestion screen" },

 { id: "R15", v: "extends", t: "HA and DR establish no numbers at all",
   sup: "Seven items to finalise, and the supplement states plainly that no "
      + "numerical RTO or RPO is established and that values require formal "
      + "BBH approval.",
   hub: "Nothing on availability, failover or recovery objectives.",
   cost: "Production readiness has a named precondition that is not started. "
       + "It is honest about being unstarted, which is better than a number "
       + "nobody agreed.",
   dec: "DEC-GAP-09", where: "nothing yet" },

 /* ------------------------------------- the gateway readiness review -- */
 { id: "R20", v: "conflict", t: "The context screen credits the gateway with controls it does not yet enforce",
   sup: "GW-GAP-01: the inbound trust boundary is NOT yet demonstrated as "
      + "fully enforced. GW-RISK-03: arbitrary path forwarding is a live "
      + "risk until a governed allowlist exists.",
   hub: "The boundary screen lists what the single managed door buys - "
      + "mTLS and OAuth to SEI, rotation in one place, retry and "
      + "circuit-breaker policy, one authoritative log - in the present "
      + "tense, as though all of it were in force.",
   cost: "A diagram that credits a component with controls it does not have "
       + "is worse than one that omits the component: it stops anybody "
       + "asking. Those claims need a 'designed, not yet enforced' state.",
   dec: "GW-GAP-01, GW-GAP-02", where: "the boundary screen, the gateway band" },

 { id: "R21", v: "extends", t: "The rate limit our design depends on is not in the operation contract",
   sup: "A governed operation declares method, path pattern, vendor target, "
      + "schema version, header allowlists, timeout, retry and "
      + "circuit-breaker policy. There is no quota or rate-limit field.",
   hub: "The boundary screen says rate limiting at the gateway is 'where the "
      + "key-set collapser's restraint is actually enforced', and the "
      + "mitigation for a consumer read-storm starving ingestion is "
      + "'separate API products with their own quota tiers'.",
   cost: "Our stated mitigation has no implementation named anywhere. The "
       + "collapser proposes and nothing disposes.",
   dec: "none raised - worth one", where: "the boundary screen, GATEWAY_NOTE" },

 { id: "R22", v: "extends", t: "Starvation has a second cause: the gateway does not scale yet",
   sup: "HorizontalPodAutoscaler comes 'after load behaviour is validated', "
      + "and PodDisruptionBudget and NetworkPolicy are listed as required "
      + "but not yet in place (GW-GAP-06, GW-RISK-06).",
   hub: "The shared-quota risk assumes the gateway itself keeps up and only "
      + "the SEI quota is contended.",
   cost: "A bursty set-based pull, a loader window and interactive reads "
       + "share a service with no autoscaling and no disruption budget. The "
       + "queue forms before the quota is reached.",
   dec: "GW-GAP-06", where: "the boundary screen" },

 { id: "R23", v: "extends", t: "The vendor token cache is per-pod, and the storm is a named test",
   sup: "The token is cached in memory until a safe expiry boundary, and "
      + "'concurrent requests do not create a token-refresh storm' is a "
      + "required test.",
   hub: "Nothing. The gateway is drawn as one band with no internal state.",
   cost: "In-memory means per-pod: every replica refreshes on its own clock, "
       + "and the refresh count scales with replicas rather than with work. "
       + "The puller's burst is exactly the shape that triggers it.",
   dec: "GW-GAP-07", where: "nothing yet" },

 { id: "R24", v: "closes", t: "The correlation identifier now has an owner and a rule",
   sup: "The gateway validates a trusted incoming correlation value or "
      + "generates one, and propagates it to outbound calls, logs, metrics "
      + "and traces.",
   hub: "Both the loader loop and the boundary screen ask for a correlation "
      + "id minted at the gateway and carried through, and name it as not "
      + "yet owned.",
   cost: "Closed. The gateway owns minting and propagation, which is the "
       + "answer both screens were asking for.",
   dec: "none", where: "the boundary screen, the loader loop" },

 { id: "R25", v: "extends", t: "Rotate anything that may have been exposed - including ours",
   sup: "GW-RISK-02 requires rotation evidence and clean repository and "
       + "pipeline scans for any credential that may previously have been "
       + "exposed.",
   hub: "This repository carried a plaintext Oracle password in "
      + "local/load-all.ps1 across more than one commit. The working tree no "
      + "longer has it; the history still does, and nothing has been "
      + "rotated.",
   cost: "The gateway review sets the standard and this repository does not "
       + "meet it. Rotation and a history rewrite are both still open, and "
       + "this has been flagged more than once.",
   dec: "GW-RISK-02", where: "the repository, not a screen" },

 /* ------------------------------------------------------- agrees ---- */
 { id: "R16", v: "agrees", t: "ARCHIVE_FAILED never reloads RAW",
   sup: "Retries the archive operation and does not reload committed RAW "
      + "records.",
   hub: "The same rule, in the same words, from the File Ingestion design.",
   cost: "", dec: "", where: "the file ingestion screen" },
 { id: "R17", v: "agrees", t: "One guarded owner of PENDING to TRIGGER",
   sup: "The missing-interface set is empty AND the atomic update affects "
      + "exactly one row.",
   hub: "The same guard, drawn as the gate.",
   cost: "", dec: "", where: "the gate" },
 { id: "R18", v: "agrees", t: "Dimensions before facts, and no placeholder keys",
   sup: "Build dimensions before facts; late-arriving dimensions are held "
      + "rather than replaced with placeholder keys.",
   hub: "The same, on the transformation chain and the Gold layer.",
   cost: "", dec: "", where: "the stage chain" },
 { id: "R19", v: "agrees", t: "An event is a notification, not the record",
   sup: "Treat the event as notification; retrieve the current record from "
      + "the named SDC view by payload key; process duplicates idempotently.",
   hub: "The same, as the three event kinds and the event-then-fetch path.",
   cost: "", dec: "", where: "events and the gate" },
];

export const rcBy = (v) => RECONCILE.filter((r) => r.v === v);
export const RC_COUNTS = Object.keys(RC_VERDICT)
 .reduce((a, k) => ({ ...a, [k]: rcBy(k).length }), {});
