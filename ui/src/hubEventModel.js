// The three kinds of event, and the gate they feed.
//
// CONFLATING ANY TWO OF THEM IS THE MISTAKE THIS FILE EXISTS TO PREVENT.
// A data event says a row changed. A marker says a commit is whole. A
// system event says a business process has finished. None of the three
// says how many records to expect, and treating the second or third as a
// completeness signal is exactly how a short Stage 1 gets transformed.
//
// THE GATE HAS TWO ARMS AND THE EVENT ARM HAS TWO CONDITIONS. The system
// event says SEI finished producing; it says nothing about whether BBH
// finished consuming. Gating on it alone lets the transformation run on a
// Stage 1 that is missing a micro-batch - and STG to INT still reconciles,
// because it ties against a Stage 1 that is itself short. Every existing
// reconciliation boundary is downstream of the loss.

export const EV_KINDS = [
  { k:"Data", cls:"data", var:"--ev-data", cadence:"continuous",
    tells:"A row changed on a named SDC view.",
    carries:"eventid, key, op (I/U/D), view. No payload.",
    note:"The event is a notification. Nothing moves until the puller re-reads current state from the view the event names." },
  { k:"Marker", cls:"marker", var:"--ev-marker", cadence:"~288 / day",
    tells:"A commit boundary on a topic — you have the whole commit, not part of one.",
    carries:"eventId, batchDt, onlineDt. Three fields, no counts.",
    note:"1000 opens and 1001 closes, on every partition of every subscribed topic. The batch is consistent only when the LAST topic closes. A consumer that declares itself done at its own end marker has read part of a transaction. Ids 1000/1001 sit clear of the catalogue's 1–105 and are not catalogue events." },
  { k:"System", cls:"system", var:"--ev-system", cadence:"~once / day",
    tells:"A business process in SWP has finished.",
    carries:"eventId, batchDt, onlineDt.",
    note:"Event 2 — batch date flip, EDB: end-of-day position and accrual processing has completed, and this is the gate for retrieving EOD data. Event 5 — pricing complete, price date flip. A missing system event raises the System Event SLA alert." },
];

export const EV_RULES = [
  "Marker events carry no record counts, so they cannot be used for record-count completeness.",
  "There is no required processing order between event types. If ordering matters downstream, the listener imposes it.",
  "The stream is at-least-once. Consumers must handle duplicates; the key field is the deduplication identifier.",
  "Events stay on the topic 7 days by default, 90 days maximum by configuration. Recovery is by moving the consumer group offset back.",
  "Published events are immutable. An event at an offset cannot be updated, replaced, corrected or removed.",
  "An MB Start on one domain topic guarantees the same MB Start on every other domain topic.",
];

export const EV_GATE = {
  what:"One guarded UPDATE on DATE_CONTROL takes the business date from PENDING to TRIGGER. Only the run whose UPDATE changes exactly one row may invoke the transformation.",
  arms:[
    { id:"A", live:true, name:"Event arm", sub:"both conditions, not either",
      cond:["Every micro-batch up to the boundary is LOADED",
            "The EOD system event has been received"],
      why:"The system event says SEI finished producing. It says nothing about whether BBH finished consuming. Gating on the event alone lets the transformation run on short Stage 1 — and STG to INT still reconciles, because it ties against a Stage 1 that is itself short.",
      src:"REVIEW · M8 Event Gate Evaluator" },
    { id:"B", live:false, name:"File arm", sub:"recovery route",
      cond:["Expected active DAILY interfaces in FILE_SCHEMA_CONFIG",
            "MINUS distinct ARCHIVED interfaces in FILE_REGISTRY = empty"],
      why:"Runs after every ingestion run including zero-file runs, with trigger_rule all_done. Under the event-primary posture this arm is the recovery path rather than the daily one.",
      src:"PACK · File Ingestion Framework E.2" },
  ],
  sla:"If the cutoff passes and neither arm is satisfied: the date stays PENDING, nothing is triggered, a correlated breach alert is published. On later completion a recovery alert is published and the trigger fires. One SLA model, two triggers.",
  nonGating:"The loader error-detail file must not join the expected set. A clean outbound day produces no file; if that file is an expected daily interface, the set never empties and the inbound day never transforms. Outbound status and inbound completeness are two different clocks.",
};

// The two clocks. The daily DAG is NOT extended to run 288 times; a
// long-running consumer owns the intraday path, the existing DAG owns the
// end-of-day transformation, and they meet at the gate and nowhere else.
export const CLOCKS = [
 { id: "intraday", n: "Intraday", cadence: "continuous, about 288 micro-batches a day",
   owns: "The event path: listen, box, collapse, pull, land, register." },
 { id: "eod", n: "End of day", cadence: "once, when the gate opens",
   owns: "The transformation chain and the business date." },
];

export const evKind = (k) => EV_KINDS.find((x) => x.k === k) || null;
