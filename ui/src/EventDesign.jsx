// The design we are going with, and how it will be run.
//
// WHAT THIS TAB IS FOR. The other tabs describe the estate: which events
// exist, what they watch, what a commit boundary is, how one run plays.
// None of them says which integration design was chosen or what it costs.
// This one does: notify-then-pull, as agreed with SEI in the October
// delivery-plan review. Snowflake publishes a thin event per changed key;
// BBH pulls the row's current state from the SDC custom views into Stage 1.
//
// IT IS A DECISION RECORD, NOT A TRACE. Nothing here came from a running
// system. Each handling rule carries one of three marks so a reader can tell
// what is settled from what BBH proposes from what only SEI can answer:
//   DECIDED  - in the agreed design
//   PROPOSED - BBH's handling, to be confirmed in the design review
//   ASK SEI  - a question the deck does not answer and BBH cannot
//
// THE ONE IDEA. An event names a key and a view, never an attribute. So
// every hard question — duplicates, replay, deletes, consistency — is a
// question about the PULL, not about the event. The rules below are
// written that way round.
import React from "react";
import { P } from "./eventPalette.js";

const MONO = P.mono;

// ---- the status marks ------------------------------------------------------
export const MARK = {
  DECIDED: { c: P.ok, t: "in the agreed design" },
  PROPOSED: { c: P.warnInk, t: "BBH's handling, to confirm at the design review" },
  "ASK SEI": { c: P.danger, t: "the deck does not answer it; only SEI can" },
};
function Mark({ m }) {
  const x = MARK[m] || MARK.PROPOSED;
  return <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: x.c,
    border: `1px solid ${x.c}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{m}</span>;
}

// ---- the design, as data ---------------------------------------------------
export const DESIGN = {
  decision: "Notify-then-pull. SDC publishes a small change event per key; BBH pulls the current row state from the SDC custom views into Stage 1.",
  agreed: "delivery-plan review, October 2026",
  flow: [
    ["SWP", "OCI accounting", "source"],
    ["GoldenGate", "transaction groups", "source"],
    ["Snowflake · SDC", "~43 custom views", "source"],
    ["SDC Event Hub", "5 topics · 105 events", "sei"],
    ["BBH Listener", "gate on the markers", "bbh"],
    ["Stage events", "staging · idempotency", "bbh"],
    ["SEI Consumer", "Python · JDBC · views", "bbh"],
    ["Stage 1 · Bronze", "Oracle", "bbh"],
    ["Stage 2 · Silver", "Oracle", "bbh"],
    ["IM Data · PBDW", "targets", "bbh"],
  ],
  components: [
    ["Custom views", "About 43 denormalised views aligned to BBH's warehouse; about 24 are needed intraday. The pull always reads the view, never a base table."],
    ["Events", "105 events across 5 domains: Account 48, Transaction 20, Assets 17, System 12, Client 8. Four fields each — eventid, key, op, view. The event says which key changed, never which attribute."],
    ["Micro-batching", "GoldenGate transaction groups are committed to Snowflake; each micro-batch is published between Start (1000) and End (1001) markers."],
    ["Listener and checkpoint", "Waits until Start and End have arrived on every subscribed topic for the same micro-batch id. Status LISTENED → READ → PROCESSING → SUCCESS; older ids are ignored (the replay floor)."],
    ["Consumer", "Checks the view against an allowlist, maps the key to its columns through a registry, runs queries with bound parameters, stores payload, result and batch id as lineage."],
    ["Idempotency", "Every record is labelled micro-batch id + normalised key + view name, enforced as a unique constraint."],
  ],
  pros: [
    ["Thin events, stable contract", "Only keys travel. Payloads stay small, BBH is insulated from SDC schema change, and the pull returns the latest state."],
    ["Transaction-consistent boundaries", "Start/End markers tied to GoldenGate transaction groups give BBH clean units — provided the pull reads as of the batch (see Consistency)."],
    ["Safe recovery", "At-least-once delivery, checkpoints committed only after downstream success, and the idempotency registry are the right building blocks."],
    ["Less transformation", "The views already match BBH's warehouse, so Stage 1 lands close to target shape."],
    ["Security in the design", "View allowlist, bound parameters, stored lineage."],
    ["One pattern", "End of day and intraday share one pipeline rather than two."],
    ["Clear ownership", "SDC owns the views and the events; the BBH Integration Hub owns the pull and everything after it."],
  ],
  // [risk, why it matters, how we handle it, mark]
  cons: [
    ["Reads are not tied to the batch moment", "Pulling current state can return a row committed in a later batch under an earlier batch id; intermediate states are lost. Fine for replication, weak for audit and reconciliation.",
      "Read Snowflake as of the batch's End timestamp (Time Travel). Retention must cover the longest replay BBH will ever run, so it becomes a contract term.", "PROPOSED"],
    ["Deletes and op collisions are not specified", "A D event leaves nothing to fetch. An I and a D for one key in one batch collapse under the idempotency label.",
      "Last op in batch order wins; a D lands a tombstone row in Stage 1 with the batch id, so Silver learns about removals.", "PROPOSED"],
    ["Fan-out into denormalised views", "A price or asset change can touch many position and transaction rows. If SDC emits no event per affected view key, BBH misses updates.",
      "Confirm SDC fans out to every affected view key. If not, those events trigger a view-level re-read of the affected keys.", "ASK SEI"],
    ["Fragile micro-batch id", "A timestamp string plus group sorts wrongly once groups pass 9, and clock skew plus the replay floor can drop late batches silently.",
      "Parse to (timestamp, integer group) and compare as a tuple; ask for a numeric, monotonic sequence in the next contract revision.", "PROPOSED"],
    ["Composite-key contract", "Pipe-splitting depends on column order, breaks on a value containing a pipe or a null, and needs type conversion.",
      "Key registry under version control, with column order, types and an escape rule; the consumer rejects a key that does not parse.", "PROPOSED"],
    ["SELECT * in the examples", "Any view that gains a column breaks the downstream load.",
      "Explicit column lists per view, versioned with the key registry; a column drift check runs before each batch.", "PROPOSED"],
    ["Not every feed fits the event model", "The Holdings API every 15 minutes, the CRM account feed and the ad-hoc full refeed of corrected month-end positions are not delta events.",
      "Keep them as scheduled pulls through the same consumer and Stage 1, keyed by their own run id rather than a batch id.", "PROPOSED"],
    ["Deck inconsistencies", "Three partitions versus five domains; the status flow drawn two ways; red marks on the Stage 1→2 and Stage 2→target arrows.",
      "Gate per topic and per partition, state it in the contract; one status flow; the downstream arrows cleared.", "ASK SEI"],
  ],
  // [n, bottleneck, why, mitigation]
  bottlenecks: [
    ["1", "All-partition gate", "One slow partition stalls every domain until its markers arrive.", "Track progress per topic and partition; a heartbeat and a timeout on the gate raise an alert rather than wait forever."],
    ["2", "One micro-batch at a time", "Batches run in order and SUCCESS commits only after downstream finishes; a load longer than the 5-minute window builds a backlog.", "Intraday loads are triggered by the listener, not Airflow; views that share no keys load in parallel inside a batch."],
    ["3", "Snowflake reads over JDBC", "One query per view per batch, up to ~43, plus warehouse resume, cross-network latency and IN-list limits across 3 AM to 9 PM.", "Batch the keys per view into one query; keep the warehouse warm in the window; chunk IN-lists."],
    ["4", "Airflow as the trigger", "Scheduler and DAG start-up delays do not suit near-real-time replication.", "A long-running listener drives intraday; Airflow keeps end of day and the scheduled feeds."],
    ["5", "Oracle Stage 1 merge", "Single-threaded Python into Oracle is likely the slowest step, above all for intraday positions and the end-of-day burst.", "Array-bound merges per view; measure the burst before redesigning."],
    ["6", "Delivery path", "Every work item is TBD or not started; SDC infrastructure is unestimated and BBH–SEI connectivity blocks everything after it.", "Connectivity first, then a one-view end-to-end slice before the remaining views."],
  ],
  // the operating rules: [topic, mark, bullets[]]
  rules: [
    ["Duplicates", "DECIDED", [
      "The stream is at-least-once; every event is a duplicate candidate.",
      "First stop: the idempotency store on micro-batch id + normalised key + view, a unique constraint. A duplicate key is logged and dropped before any pull.",
      "Second stop: Stage 1 merges on primary key, so a duplicate that survives the listener still lands once.",
      "A redelivered whole batch, with the same id, is skipped by the replay floor once its SUCCESS is committed.",
    ]],
    ["Errors", "PROPOSED", [
      "A batch fails as a unit. SUCCESS is never written for a batch with any failed view.",
      "Transient failures (JDBC, warehouse resume, network) retry with backoff, three times, then the batch is parked and the gate alerts.",
      "A key that fails validation (unknown view, unparseable key, column drift) goes to the dead-letter table with the batch id, event and reason; the rest of the batch proceeds.",
      "A dead-letter row blocks the batch's SUCCESS until it is replayed or dismissed by a named person; both are logged.",
    ]],
    ["Replay", "DECIDED", [
      "Replay is a re-pull, never a re-send: the keys are re-read from the staged ids and the views are read again.",
      "Replaying a batch reads Snowflake as of that batch's End timestamp, so a replay produces what the batch would have produced.",
      "The replay floor ignores any id older than the last committed SUCCESS; a deliberate replay lowers the floor explicitly, with the reason logged.",
      "An outage backlog replays in order, one batch at a time; the same key check that handles redelivery handles replay.",
    ]],
    ["Deletes and op collisions", "PROPOSED", [
      "A D event cannot be pulled; it is landed as a tombstone in Stage 1 with the batch id.",
      "When one key carries several ops in one batch, the last op in batch order wins and earlier ops are recorded in lineage, not applied.",
      "Silver applies tombstones as soft deletes with the batch id, so a reconciliation can still see the row left.",
    ]],
    ["Dependencies", "PROPOSED", [
      "Inside a batch there is no order across topics, so the batch is the unit: pull every key first, then load Stage 1 in the registry's view order — client and reference, account, assets, transaction, positions — never in arrival order.",
      "Most dependencies dissolve in the pull: a child row read as of the batch's End timestamp already carries its parent's attributes as they stood in that commit.",
      "A child whose parent has not landed is never loaded with a placeholder key. Stage 1 accepts it as raw as-of state; Stage 2 parks it as an OPEN missing-dimension row with the batch id, and every batch SUCCESS retries the OPEN set.",
      "A deleted parent is a tombstone; its children are flagged orphans in the same OPEN set, not cascaded by BBH.",
      "Two events on one column change resolve to the same row at the same as-of time; the label makes the second a skip.",
      "A System Event says a process finished, not that data is complete; end-of-day jobs trigger on it after the day's last batch SUCCESS, never on a count of events.",
    ]],
    ["Ordering", "PROPOSED", [
      "The micro-batch id is parsed to (timestamp, integer group) and compared as a tuple, never as text.",
      "Within a batch, event order is the order on the topic; across topics there is no order until the gate closes.",
      "Ask SEI for a numeric, monotonic sequence in the next contract revision.",
    ]],
    ["Consistency", "PROPOSED", [
      "Every pull reads the views as of the batch's End timestamp, so a batch is a snapshot and not a race with later commits.",
      "Time Travel retention has to cover the longest replay window; it is agreed with SDC and monitored.",
      "Without the as-of read, the boundaries are consistent on the event side only, and the reconciliation story does not hold.",
    ]],
    ["Fan-out", "ASK SEI", [
      "Does SDC emit an event for every view key an upstream change affects, for example a price touching many positions?",
      "If yes: nothing changes. If no: those events trigger a view-level re-read of affected keys, and the deck's volume estimates are revised.",
    ]],
    ["The gate", "DECIDED", [
      "A batch is complete when the LAST subscribed topic has its End marker for the same id, not the first.",
      "Progress is tracked per topic and per partition; a heartbeat and a timeout raise an alert when one lags.",
      "Older micro-batch ids below the floor are ignored; late events for a committed batch are logged, never applied.",
    ]],
    ["Monitoring and SLAs", "PROPOSED", [
      "Per feed group: lag from End marker to Stage 1 SUCCESS, batches in flight, dead-letter count and age.",
      "Latency SLA per group, with intraday positions the tightest; a breach pages, everything else is a digest.",
      "Every batch writes its lineage: payload, result, batch id, as-of timestamp.",
    ]],
  ],
  // the listener, from the checkpoint-logic slide: six steps, two of which
  // move the checkpoint, and only the last one commits it
  listener: [
    ["1", "Stage events · mark LISTENED", "Keep only the event types BBH subscribes to; everything else on the topic is skipped, not stored."],
    ["2", "Retrieve the data", "Query Snowflake through the allowlisted view, binding the key columns from the registry."],
    ["3", "Stage the data", "Persist the selected events and the rows they returned, under the batch id."],
    ["4", "Mark READ", "Checkpoint status READ: staged, not yet processed. A restart resumes here."],
    ["5", "Data consumer", "Invoke the downstream load — the listener for intraday, Airflow for end of day."],
    ["6", "Mark SUCCESS", "Only after the downstream load succeeds. Nothing before this moves the replay floor."],
  ],
  gate: "A micro-batch is assembled when its Start and End markers have been received on every domain partition for the same micro-batch id. An event arriving for an id below the checkpointed id is ignored.",
  checkpoint: [
    ["partition_id", "the domain partition the offset belongs to"],
    ["offset", "latest consumed offset on that partition"],
    ["microbatch_id", "timestamp and group — compared as a tuple, never as text"],
    ["processing_status", "LISTENED → READ → PROCESSING → SUCCESS"],
  ],
  staging: [
    ["microbatch_id", "the batch the event belongs to"],
    ["partition_id · offset", "source checkpoint position"],
    ["view_name · event_type · op", "payload metadata"],
    ["key_raw · key_values", "the key as received, and split by the registry"],
    ["retrieved_data", "the rows the pull returned, or a reference to them"],
    ["processing_status", "READ → PROCESSING → SUCCESS"],
    ["error · timestamps", "recovery and operational context"],
  ],
  builds: [
    ["BBH Event Listener", "Consume events by domain topic; handle partitions; recognise Start and End; maintain micro-batch state."],
    ["Checkpointing", "Persist offsets and checkpoints; resume safely after failure; update the checkpoint only after successful processing."],
    ["Event Staging", "Stage consumed events with batch id, Start/End status, keys and processing status."],
    ["Idempotency", "Detect duplicate batches, events and primary keys; maintain the processed batch and key registry."],
    ["BBH Data Consumer", "Invoke the downstream process through the workflow, the scheduler or the listener itself."],
    ["Load to Stage 1", "Read staged events, retrieve the Snowflake rows, apply business logic, load the targets."],
  ],
  registry: {
    rule: "A composite key arrives as values joined by a pipe. The registry for the payload's view gives the approved view, the ordered key columns, the expected segment count and any type conversion; the consumer splits in that order and binds each value as a parameter. The key is deterministic only while the configured column order matches the payload order.",
    rows: [
      ["ACCOUNT_BASIC_VIEW", "ACCOUNT_ID", "1"],
      ["UE_USER_ROLE_VIEW", "PROCESSING_ORG_ID | FIRM_ID | USER_ID | ROLE_ID", "4"],
    ],
  },
  // the consumer, from the retrieval slide: the payload is retrieval
  // metadata, never SQL
  consumer: [
    ["1", "Parse the payload", "Read view, key, op and event type. The op and event type are kept as metadata on the staged row."],
    ["2", "Validate the metadata", "The view must be on the allowlist; the registry resolves its key columns. An unknown view or an unparseable key goes to the dead letter."],
    ["3", "Build the predicates", "A single key binds one column; a composite key is split in registry order into one bound value per column. Keys for the same view are grouped into one IN-list query per batch."],
    ["4", "Execute the query", "Bound values only, never concatenated SQL, as of the batch's End timestamp."],
    ["5", "Attach lineage", "Store the payload, the query result and the batch id with the staged row."],
  ],
  consumerOut: "Output of a pull: the selected view rows, the original event metadata, and the current micro-batch id. Incoming object names and key values are never treated as SQL.",
  window: "For a 5-minute processing window: keep the distinct keys between Start and End, check the processed registry before retrieving, and commit the checkpoint only after the downstream load succeeds.",
  askSei: [
    "Does SDC emit an event for every affected view key when a change fans out across denormalised views?",
    "When a parent row is deleted or re-keyed, are the child view keys emitted, or must BBH re-read the child views itself?",
    "What happens on delete: is a D event the whole signal, and can I and D for one key share a batch?",
    "Are the Start/End markers published to every partition of every domain topic, and is the gate per topic or per partition?",
    "Can the micro-batch id become a numeric, monotonic sequence?",
    "What Time Travel retention will SDC guarantee on the custom views?",
    "Are the view column lists and the key registry versioned, and who signs a change?",
  ],
};

/* ------------------------------------------------------------- figure */
// The whole path on one line, coloured by who owns each box. SEI owns the
// hub; BBH owns everything after the listener; the sources belong to
// neither. The two triggers sit under the path because that is where the
// decision about Airflow actually lands.
function FlowFig() {
  const own = { source: P.sub, sei: P.accent, bbh: P.link };
  const W = 1000, BW = 92, GAP = 8, x0 = 14, y = 44, h = 50;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${P.rule}`, borderRadius: 6,
      background: P.panel, padding: "12px 12px 8px", marginBottom: 14 }}>
      <svg viewBox={`0 0 ${W} 190`} role="img" style={{ display: "block", minWidth: 760, width: "100%", height: "auto" }}
        aria-label="The agreed path, left to right: SWP accounting, GoldenGate transaction groups, Snowflake SDC custom views, the SDC Event Hub with five domain topics, the BBH event listener that gates on the Start and End markers, the staged ids in the idempotency store, the SEI data consumer that pulls the views over JDBC, Stage 1 Bronze and Stage 2 Silver in Oracle, and the IM Data and PB DW targets. The listener triggers intraday loads directly; Airflow schedules end of day and the feeds that are not events. Failed keys go to a dead-letter table.">
        <defs>
          <marker id="ed-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={P.ink} /></marker>
        </defs>
        <text x={x0} y={18} fontSize={11} fontWeight={800} letterSpacing=".6" fill={P.ink}>THE PATH</text>
        <text x={x0 + 86} y={18} fontSize={9.5} fill={P.sub}>notify on the top row, pull from the third box onwards</text>
        {DESIGN.flow.map(([name, sub, who], i) => {
          const x = x0 + i * (BW + GAP);
          return (
            <g key={name}>
              <rect x={x} y={y} width={BW} height={h} rx={3} fill={P.panel} stroke={own[who]} strokeWidth={who === "source" ? 1.2 : 1.8} />
              <text x={x + 6} y={y + 18} fontSize={9} fontWeight={700} fill={own[who]}>{name}</text>
              <text x={x + 6} y={y + 32} fontSize={8} fill={P.sub}>{sub.length > 22 ? sub.slice(0, 21) + "…" : sub}</text>
              {i < DESIGN.flow.length - 1 && (
                <path d={`M${x + BW},${y + h / 2} L${x + BW + GAP - 1},${y + h / 2}`} fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-a)" />)}
            </g>);
        })}
        {/* the pull: consumer back to the views */}
        <path d={`M${x0 + 6 * (BW + GAP) + BW / 2},${y + h} L${x0 + 6 * (BW + GAP) + BW / 2},${y + h + 22} L${x0 + 2 * (BW + GAP) + BW / 2},${y + h + 22} L${x0 + 2 * (BW + GAP) + BW / 2},${y + h + 4}`}
          fill="none" stroke={P.link} strokeWidth={1.4} strokeDasharray="5 3" markerEnd="url(#ed-a)" />
        <text x={x0 + 4 * (BW + GAP) + 10} y={y + h + 18} fontSize={8.5} fill={P.link}>the pull · JDBC · as of the batch's End timestamp</text>
        {/* triggers and the dead letter */}
        <rect x={x0 + 4 * (BW + GAP)} y={134} width={192} height={34} rx={3} fill={P.panel} stroke={P.link} strokeWidth={1.4} />
        <text x={x0 + 4 * (BW + GAP) + 8} y={148} fontSize={9.5} fontWeight={700} fill={P.link}>Listener triggers intraday</text>
        <text x={x0 + 4 * (BW + GAP) + 8} y={161} fontSize={8.5} fill={P.sub}>24 views · no scheduler in the loop</text>
        <rect x={x0 + 6 * (BW + GAP) + 12} y={134} width={192} height={34} rx={3} fill={P.panel} stroke={P.sub} strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={x0 + 6 * (BW + GAP) + 20} y={148} fontSize={9.5} fontWeight={700} fill={P.ink}>Airflow · end of day + feeds</text>
        <text x={x0 + 6 * (BW + GAP) + 20} y={161} fontSize={8.5} fill={P.sub}>Holdings API · CRM · full refeeds</text>
        <rect x={x0 + 8 * (BW + GAP) + 24} y={134} width={168} height={34} rx={3} fill={P.panel} stroke={P.danger} strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={x0 + 8 * (BW + GAP) + 32} y={148} fontSize={9.5} fontWeight={700} fill={P.danger}>Dead-letter table</text>
        <text x={x0 + 8 * (BW + GAP) + 32} y={161} fontSize={8.5} fill={P.sub}>failed keys · blocks SUCCESS</text>
        <text x={x0} y={150} fontSize={9} fill={own.source}>■ source</text>
        <text x={x0 + 70} y={150} fontSize={9} fill={own.sei}>■ SEI owns</text>
        <text x={x0 + 150} y={150} fontSize={9} fill={own.bbh}>■ BBH owns</text>
        <text x={x0} y={184} fontSize={9} fill={P.sub}>No number on this screen came from a running system. The path is the agreed design; the marks on each rule say what is settled.</text>
      </svg>
    </div>);
}

/* ------------------------------------------------------ more figures */
// Shared frame for the mechanism figures below: a scroll box so a wide
// figure scrolls in place rather than pushing the tab sideways.
function Fig({ vw, vh, aria, children }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${P.rule}`, borderRadius: 6,
      background: P.panel, padding: "12px 12px 8px", margin: "0 0 12px" }}>
      <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={aria}
        style={{ display: "block", minWidth: 720, width: "100%", height: "auto" }}>
        <defs>
          <marker id="ed-k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={P.ink} /></marker>
          <marker id="ed-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={P.link} /></marker>
          <marker id="ed-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={P.danger} /></marker>
        </defs>
        {children}
      </svg>
    </div>);
}
const Box = ({ x, y, w, h, c = P.ink, fill = P.panel, dash, sw = 1.4, rx = 3 }) => (
  <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={c} strokeWidth={sw} strokeDasharray={dash} />);
const T = ({ x, y, s = 9.5, w = 400, c = P.ink, a, f, children }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} fill={c} textAnchor={a} fontFamily={f}>{children}</text>);

// A. The listener: three partitions assembling one batch, the gate, and
// the checkpoint's four states with the replay floor underneath.
function CheckpointFig() {
  const lanes = [0, 1, 2];
  const y0 = 46, dy = 40;
  const st = [["LISTENED", P.sub], ["READ", P.warnInk], ["PROCESSING", P.link], ["SUCCESS", P.ok]];
  return (
    <Fig vw={1000} vh={284}
      aria="The listener assembles one micro-batch across three domain partitions: each partition receives a Start marker, zero or more events, then an End marker, and the gate opens only when all three have both markers for the same micro-batch id. On the right, the checkpoint moves through four states, LISTENED, READ, PROCESSING and SUCCESS, and only SUCCESS is committed after the downstream load. Underneath, the replay floor: a micro-batch id below the checkpoint is ignored, the current id resumes from its last safe offset after a restart, and a higher id waits its turn.">
      <T x={14} y={20} s={11} w={800} c={P.ink}>1 · ASSEMBLE THE BATCH</T>
      <T x={190} y={20} c={P.sub}>one Start and one End per partition, same id</T>
      {lanes.map((i) => {
        const y = y0 + i * dy;
        const ev = [[0, 2], [1], [2]][i];
        return (
          <g key={i}>
            <T x={14} y={y + 15} c={P.sub}>partition {i}</T>
            <line x1={80} y1={y + 11} x2={470} y2={y + 11} stroke={P.rule} strokeWidth={1} />
            <Box x={84} y={y} w={62} h={22} c={P.accent} fill={P.accent} />
            <T x={115} y={y + 15} s={8.5} w={700} c="#fff" a="middle">START n</T>
            {ev.map((k) => (<g key={k}>
              <Box x={170 + k * 70} y={y} w={56} h={22} c={P.link} />
              <T x={198 + k * 70} y={y + 15} s={8.5} c={P.link} a="middle">event</T></g>))}
            <Box x={400} y={y} w={62} h={22} c={P.accent} fill={P.accent} />
            <T x={431} y={y + 15} s={8.5} w={700} c="#fff" a="middle">END n</T>
          </g>);
      })}
      <line x1={470} y1={38} x2={470} y2={y0 + 3 * dy - 10} stroke={P.danger} strokeWidth={1.4} strokeDasharray="4 3" />
      <T x={476} y={y0 + 8} s={8.5} w={700} c={P.danger}>gate</T>
      <T x={476} y={y0 + 20} s={8} c={P.sub}>opens when the</T>
      <T x={476} y={y0 + 31} s={8} c={P.sub}>LAST partition</T>
      <T x={476} y={y0 + 42} s={8} c={P.sub}>has END n</T>
      <Box x={14} y={y0 + 3 * dy} w={448} h={20} c={P.link} fill={P.tint} dash="3 2" sw={1} />
      <T x={238} y={y0 + 3 * dy + 13} s={8.5} c={P.link} a="middle">a partition with no events between its markers is still complete</T>

      <T x={560} y={20} s={11} w={800} c={P.ink}>2 · THE CHECKPOINT</T>
      <T x={690} y={20} c={P.sub}>per partition: offset · micro-batch id · status</T>
      {st.map(([name, c], i) => (
        <g key={name}>
          <Box x={560 + i * 108} y={40} w={96} h={28} c={c} fill={i === 3 ? "rgba(21,153,67,.10)" : P.panel} sw={i === 3 ? 1.8 : 1.3} />
          <T x={608 + i * 108} y={58} s={9} w={800} c={c} a="middle">{name}</T>
          {i < 3 && <path d={`M${656 + i * 108},54 L${666 + i * 108},54`} fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />}
        </g>))}
      <T x={560} y={88} s={8.5} c={P.sub}>events kept</T>
      <T x={668} y={88} s={8.5} c={P.sub}>staged, not processed</T>
      <T x={776} y={88} s={8.5} c={P.sub}>load running</T>
      <T x={884} y={88} s={8.5} c={P.sub}>after downstream OK</T>
      <path d="M940,68 L940,104 L608,104 L608,118" fill="none" stroke={P.ok} strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#ed-k)" />
      <T x={620} y={100} s={8.5} c={P.ok}>SUCCESS commits the checkpoint and moves the floor</T>
      <Box x={560} y={120} w={420} h={24} c={P.warnInk} fill={P.panel} dash="3 2" sw={1} />
      <T x={770} y={136} s={8.5} c={P.warnInk} a="middle">restart: resume from the last safe offset of the CURRENT id · never replay an older batch</T>

      <T x={14} y={212} s={11} w={800} c={P.ink}>3 · THE REPLAY FLOOR</T>
      <T x={170} y={212} c={P.sub}>what happens to an incoming id, compared with the checkpointed id</T>
      {[["id < checkpoint", "ignored · logged, never applied", P.danger],
        ["id = checkpoint", "resume from the last safe offset", P.warnInk],
        ["id > checkpoint", "next batch · waits for its gate", P.ok]].map(([h, b, c], i) => (
        <g key={h}>
          <Box x={14 + i * 330} y={224} w={316} h={44} c={c} />
          <T x={26 + i * 330} y={242} s={9.5} w={700} c={c} f={MONO}>{h}</T>
          <T x={26 + i * 330} y={258} s={8.5} c={P.sub}>{b}</T>
        </g>))}
    </Fig>);
}

// B. The consumer: the payload is retrieval metadata; five steps turn it
// into one bound query per view, and the output carries the batch id.
function ConsumerFig() {
  const steps = ["Parse", "Validate", "Predicates", "Execute", "Lineage"];
  return (
    <Fig vw={1000} vh={214}
      aria="The consumer reads the event payload, which holds a view name, a key, an op and an event type, as retrieval metadata. Five steps follow: parse it, validate the view against the allowlist and resolve its key columns from the registry, build predicates with the keys for the same view grouped into one IN-list, execute the query with bound values as of the batch's End timestamp, and attach lineage. The output is the selected rows plus the original event metadata plus the micro-batch id. Nothing in the payload is ever treated as SQL.">
      <T x={14} y={20} s={11} w={800} c={P.ink}>THE PULL</T>
      <T x={76} y={20} c={P.sub}>the payload is metadata about what to fetch — never SQL</T>
      <Box x={14} y={34} w={170} h={118} c={P.accent} />
      <T x={24} y={52} s={9.5} w={700} c={P.accent}>event payload</T>
      {[["view", "an approved view name"], ["key", "value(s) joined by |"], ["op", "I · U · D · kept"], ["eventType", "the catalog id — kept"]].map(([k, v], i) => (
        <g key={k}>
          <T x={24} y={72 + i * 19} s={9} w={700} c={P.ink} f={MONO}>{k}</T>
          <T x={90} y={72 + i * 19} s={8.5} c={P.sub}>{v}</T>
        </g>))}
      <path d="M184,92 L206,92" fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      {steps.map((n, i) => (
        <g key={n}>
          <Box x={210 + i * 112} y={70} w={100} h={44} c={P.link} />
          <T x={220 + i * 112} y={88} s={9.5} w={700} c={P.link}>{i + 1} · {n}</T>
          <T x={220 + i * 112} y={104} s={8} c={P.sub}>{["view · key · op · type", "allowlist · registry", "keys grouped per view", "bound values · as-of", "payload · result · id"][i]}</T>
          {i < 4 && <path d={`M${310 + i * 112},92 L${320 + i * 112},92`} fill="none" stroke={P.link} strokeWidth={1.2} markerEnd="url(#ed-b)" />}
        </g>))}
      <path d="M436,114 L436,128" fill="none" stroke={P.danger} strokeWidth={1.2} strokeDasharray="3 2" markerEnd="url(#ed-r)" />
      <Box x={360} y={130} w={152} h={22} c={P.danger} dash="4 3" sw={1} />
      <T x={436} y={145} s={8.5} c={P.danger} a="middle">unknown view or bad key → dead letter</T>
      <Box x={790} y={34} w={196} h={118} c={P.ok} fill="rgba(21,153,67,.06)" />
      <T x={800} y={52} s={9.5} w={700} c={P.ok}>output of one pull</T>
      {["the selected view rows", "+ the original event metadata", "+ the current micro-batch id", "+ the as-of timestamp it read at"].map((l, i) => (
        <T key={l} x={800} y={72 + i * 19} s={8.5} c={P.sub}>{l}</T>))}
      <Box x={14} y={166} w={972} h={36} c={P.rule} fill={P.tint} sw={1} />
      <T x={24} y={181} s={9} w={700} c={P.ink} f={MONO}>select &lt;explicit columns&gt; from &lt;approved view&gt; where &lt;key column&gt; in (:k1, :k2, …) — at the batch's End timestamp</T>
      <T x={24} y={195} s={8.5} c={P.sub}>one query per view per batch; the view name comes from the allowlist and the values from bind parameters</T>
    </Fig>);
}

// C. The idempotency label, and the decision it drives.
function LabelFig() {
  const parts = [["micro-batch id", "the batch the event belongs to"], ["normalised key", "trimmed · cased · in registry order"], ["view name", "the approved view"]];
  return (
    <Fig vw={1000} vh={150}
      aria="The idempotency label is three parts joined: the micro-batch id, the normalised key values, and the view name. It is a unique constraint on the staging store. If the label already exists the event is neither retrieved nor staged again; if it is new, the pull runs and the row is staged under the label. A redelivered event and a replayed batch both hit the same check.">
      <T x={14} y={20} s={11} w={800} c={P.ink}>THE LABEL</T>
      <T x={92} y={20} c={P.sub}>one unique constraint stops a duplicate before it costs a query</T>
      {parts.map(([h, b], i) => (
        <g key={h}>
          <Box x={14 + i * 190} y={34} w={176} h={46} c={P.accent} />
          <T x={24 + i * 190} y={52} s={9.5} w={700} c={P.accent}>{h}</T>
          <T x={24 + i * 190} y={68} s={8} c={P.sub}>{b}</T>
          {i < 2 && <T x={190 + i * 190 + 7} y={61} s={13} w={700} c={P.ink} a="middle">+</T>}
        </g>))}
      <path d="M584,57 L606,57" fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      <Box x={610} y={34} w={150} h={46} c={P.ink} />
      <T x={685} y={52} s={9.5} w={700} c={P.ink} a="middle">label</T>
      <T x={685} y={68} s={8} c={P.sub} a="middle">unique constraint</T>
      <path d="M760,46 L800,46" fill="none" stroke={P.ok} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      <path d="M760,68 L800,68" fill="none" stroke={P.danger} strokeWidth={1.2} markerEnd="url(#ed-r)" />
      <Box x={804} y={34} w={182} h={20} c={P.ok} fill="rgba(21,153,67,.08)" sw={1} />
      <T x={812} y={48} s={8.5} w={700} c={P.ok}>new → pull, stage under the label</T>
      <Box x={804} y={60} w={182} h={20} c={P.danger} dash="3 2" sw={1} />
      <T x={812} y={74} s={8.5} w={700} c={P.danger}>exists → skip: no retrieve, no stage</T>
      <T x={14} y={108} s={8.5} c={P.sub}>a redelivered event, a replayed batch and a key that appears twice inside one batch all meet the same check</T>
      <T x={14} y={124} s={8.5} c={P.sub}>second stop, if one slips through: Stage 1 merges on primary key, so the row still lands once</T>
      <T x={14} y={140} s={8.5} c={P.warnInk}>what the label cannot do: tell an insert from a delete on the same key in one batch — that is the op-collision rule</T>
    </Fig>);
}

// D. Composite key resolution: split in the registry's order, bind one
// value per column. Letters, not the deck's example values.
function KeyFig() {
  const vals = ["A", "B", "C", "D"], cols = ["ORG", "FIRM", "USER", "ROLE"];
  return (
    <Fig vw={1000} vh={178}
      aria="A composite key arrives as four values joined by pipes. The registry entry for the payload's view gives the ordered key columns and the expected segment count. The consumer splits the key, checks the count, converts types, and binds one value to one column in the registry's order. Keys stay deterministic only while the registry's column order matches the order the values were joined in.">
      <T x={14} y={20} s={11} w={800} c={P.ink}>COMPOSITE KEY</T>
      <T x={128} y={20} c={P.sub}>split by the registry, never by guesswork</T>
      <Box x={14} y={34} w={176} h={34} c={P.accent} />
      <T x={24} y={48} s={8} c={P.sub}>payload.key</T>
      <T x={24} y={62} s={10} w={700} c={P.ink} f={MONO}>"A|B|C|D"</T>
      <path d="M190,51 L212,51" fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      {vals.map((v, i) => (
        <g key={v}>
          <Box x={216 + i * 44} y={34} w={38} h={34} c={P.link} />
          <T x={235 + i * 44} y={56} s={10} w={700} c={P.link} a="middle" f={MONO}>{v}</T>
        </g>))}
      <T x={216} y={84} s={8.5} c={P.sub}>4 segments — must equal the registry's count</T>
      <Box x={420} y={34} w={300} h={64} c={P.ink} />
      <T x={430} y={50} s={9.5} w={700} c={P.ink}>registry · for this view</T>
      <T x={430} y={66} s={8.5} c={P.sub}>ordered key columns</T>
      {cols.map((c, i) => (<T key={c} x={540 + i * 44} y={66} s={8.5} w={700} c={P.ink} f={MONO}>{c}</T>))}
      <T x={430} y={82} s={8.5} c={P.sub}>segments 4 · types per column · approved view</T>
      <T x={430} y={94} s={8.5} c={P.sub}>under version control; a change is signed</T>
      <path d="M720,66 L742,66" fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      <Box x={746} y={34} w={240} h={64} c={P.ok} fill="rgba(21,153,67,.06)" />
      <T x={756} y={50} s={9.5} w={700} c={P.ok}>bound predicates</T>
      {cols.map((c, i) => (<T key={c} x={756 + (i % 2) * 118} y={68 + Math.floor(i / 2) * 16} s={8.5} c={P.ink} f={MONO}>{c} = :k{i + 1} ({vals[i]})</T>))}
      {vals.map((v, i) => (
        <path key={v} d={`M${235 + i * 44},68 L${235 + i * 44},108 L${560 + i * 44},108 L${560 + i * 44},100`} fill="none" stroke={P.rule} strokeWidth={1} strokeDasharray="2 2" />))}
      <Box x={14} y={120} w={972} h={24} c={P.warn} fill={P.panel} dash="4 3" sw={1} />
      <T x={500} y={136} s={9} w={700} c={P.warnInk} a="middle">deterministic only while the registry's column order matches the payload's value order — a pipe inside a value, a null segment or a count mismatch rejects the key to the dead letter</T>
      <T x={14} y={166} s={8.5} c={P.sub}>a single-key view is the same path with one segment; the registry row says so</T>
    </Fig>);
}

// E. Dependencies: the load order inside a batch, and what happens to a
// child whose parent has not landed.
function DepFig() {
  const order = [["Client · Reference", "8 + system"], ["Account", "48 events"], ["Assets", "17 events"], ["Transaction", "20 events"], ["Positions", "from the views"]];
  return (
    <Fig vw={1000} vh={236}
      aria="Dependencies are handled in two places. Inside a batch, every key is pulled first and Stage 1 is loaded in a fixed view order: client and reference, then account, then assets, then transaction, then positions, never in arrival order. Across batches, a child row whose parent has not landed is accepted into Stage 1 as raw state, then parked by Stage 2 as an OPEN missing-dimension row with its batch id; every later batch SUCCESS retries the OPEN set, and the row loads once the parent exists. Nothing is ever loaded with a placeholder key. A deleted parent leaves a tombstone and its children become flagged orphans in the same OPEN set.">
      <T x={14} y={20} s={11} w={800} c={P.ink}>1 · LOAD ORDER INSIDE A BATCH</T>
      <T x={222} y={20} c={P.sub}>all keys pulled first, then loaded in this order — never arrival order</T>
      {order.map(([n, sub], i) => (
        <g key={n}>
          <Box x={14 + i * 96} y={34} w={86} h={40} c={P.link} />
          <T x={57 + i * 96} y={50} s={8.8} w={700} c={P.link} a="middle">{n}</T>
          <T x={57 + i * 96} y={64} s={7.8} c={P.sub} a="middle">{sub}</T>
          {i < 4 && <path d={`M${100 + i * 96},54 L${108 + i * 96},54`} fill="none" stroke={P.link} strokeWidth={1.2} markerEnd="url(#ed-b)" />}
        </g>))}
      <T x={14} y={92} s={8.5} c={P.sub}>a child view is loaded only after every view it references; the order lives in the registry, with the key columns</T>
      <T x={14} y={106} s={8.5} c={P.sub}>the pull makes most of it moot: a row read as of the batch's End already carries its parent as it stood in that commit</T>

      <T x={560} y={20} s={11} w={800} c={P.ink}>2 · A PARENT THAT HAS NOT LANDED</T>
      <Box x={560} y={34} w={120} h={34} c={P.link} />
      <T x={620} y={48} s={8.8} w={700} c={P.link} a="middle">Stage 1 accepts</T>
      <T x={620} y={61} s={7.8} c={P.sub} a="middle">raw as-of state + batch id</T>
      <path d="M680,51 L700,51" fill="none" stroke={P.ink} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      <Box x={704} y={34} w={120} h={34} c={P.ink} />
      <T x={764} y={48} s={8.8} w={700} c={P.ink} a="middle">Stage 2: key resolves?</T>
      <T x={764} y={61} s={7.8} c={P.sub} a="middle">parent row present</T>
      <path d="M824,45 L856,45" fill="none" stroke={P.ok} strokeWidth={1.2} markerEnd="url(#ed-k)" />
      <T x={830} y={41} s={7.8} c={P.ok}>yes</T>
      <Box x={860} y={34} w={126} h={22} c={P.ok} fill="rgba(21,153,67,.08)" sw={1} />
      <T x={923} y={49} s={8.5} w={700} c={P.ok} a="middle">load into Silver</T>
      <path d="M764,68 L764,92" fill="none" stroke={P.danger} strokeWidth={1.2} markerEnd="url(#ed-r)" />
      <T x={770} y={84} s={7.8} c={P.danger}>no</T>
      <Box x={660} y={96} w={208} h={36} c={P.warnInk} dash="4 3" sw={1.2} />
      <T x={764} y={111} s={8.8} w={700} c={P.warnInk} a="middle">OPEN missing-dimension row</T>
      <T x={764} y={125} s={7.8} c={P.sub} a="middle">keeps its batch id · counted, never dropped</T>
      <path d="M868,114 L930,114 L930,60" fill="none" stroke={P.warnInk} strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#ed-k)" />
      <T x={876} y={108} s={7.8} c={P.warnInk}>retried on every</T>
      <T x={876} y={119} s={7.8} c={P.warnInk}>batch SUCCESS</T>
      <Box x={560} y={146} w={426} h={22} c={P.danger} dash="3 2" sw={1} />
      <T x={773} y={161} s={8.5} w={700} c={P.danger} a="middle">never a placeholder key: eligible rows = loaded rows + OPEN rows</T>
      <T x={560} y={188} s={8.5} c={P.sub}>a deleted parent is a tombstone; its children become flagged orphans in the same OPEN set</T>
      <T x={560} y={202} s={8.5} c={P.sub}>whether SDC emits the child keys on a parent change is the fan-out question — ASK SEI</T>
      <T x={14} y={228} s={8.5} c={P.sub}>Both halves use what already exists: the registry carries the order, and Stage 2's missing-dimension rule is the one the dbt design states.</T>
    </Fig>);
}

/* ------------------------------------------------------------- pieces */
function H({ children, sub }) {
  return (
    <div style={{ margin: "18px 0 8px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: P.sub, marginTop: 2, maxWidth: "86ch", lineHeight: 1.55 }}>{sub}</div>}
    </div>);
}
function Tbl({ head, rows }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 6 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, minWidth: 560 }}>
        <thead><tr>{head.map((h) => (
          <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
            textTransform: "uppercase", color: P.sub, borderBottom: `1px solid ${P.rule}`,
            padding: "0 12px 6px 0", verticalAlign: "bottom" }}>{h}</th>))}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (
            <td key={j} style={{ padding: "7px 12px 7px 0", verticalAlign: "top",
              borderBottom: `1px solid ${P.tint}`, color: j === 0 ? P.ink : P.sub,
              fontWeight: j === 0 ? 600 : 400, lineHeight: 1.5 }}>{c}</td>))}</tr>))}
        </tbody>
      </table>
    </div>);
}

/* ------------------------------------------------------------- the tab */
export default function EventDesign() {
  const n = (m) => DESIGN.rules.filter((r) => r[1] === m).length + DESIGN.cons.filter((c) => c[3] === m).length;
  return (
    <div>
      <div style={{ border: `1px solid ${P.accent}`, borderLeft: `4px solid ${P.accent}`, borderRadius: 6,
        padding: "12px 16px", marginBottom: 14, background: P.panel }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, color: P.accent }}>THE DESIGN WE ARE GOING WITH</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: P.ink, margin: "4px 0 2px" }}>{DESIGN.decision}</div>
        <div style={{ fontSize: 11.5, color: P.sub }}>Agreed at the {DESIGN.agreed}. Every rule below carries a mark:</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11.5, color: P.sub }}>
          {Object.keys(MARK).map((m) => (
            <span key={m} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Mark m={m} /> {MARK[m].t} · {n(m)}</span>))}
        </div>
      </div>

      <FlowFig />

      <H sub="What each piece is, in the deck's own terms.">The components</H>
      <Tbl head={["Component", "What it does"]} rows={DESIGN.components} />

      <H sub={DESIGN.gate}>The listener, step by step</H>
      <CheckpointFig />
      <Tbl head={["", "Step", "What happens"]} rows={DESIGN.listener} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 6 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: P.sub, margin: "6px 0 4px" }}>Checkpoint · one row per partition</div>
          <Tbl head={["Field", "Holds"]} rows={DESIGN.checkpoint.map(([f, h]) => [<span style={{ fontFamily: MONO, fontSize: 11 }}>{f}</span>, h])} />
          <div style={{ fontSize: 11.5, color: P.sub, lineHeight: 1.5, maxWidth: "60ch" }}>
            Process only when the incoming id is at or above the checkpointed id. On restart, resume from the last safe offset for the current id; never replay an older batch.</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: P.sub, margin: "6px 0 4px" }}>Staging · one row per event</div>
          <Tbl head={["Field", "Holds"]} rows={DESIGN.staging.map(([f, h]) => [<span style={{ fontFamily: MONO, fontSize: 11 }}>{f}</span>, h])} />
          <div style={{ fontSize: 11.5, color: P.sub, lineHeight: 1.5, maxWidth: "60ch" }}>
            The idempotency label is micro-batch id + normalised key values + view name, a unique constraint. If the label exists, the event is neither retrieved nor staged again.</div>
        </div>
      </div>
      <LabelFig />
      <div style={{ border: `1px solid ${P.rule}`, borderLeft: `3px solid ${P.warn}`, borderRadius: 4, padding: "8px 12px", margin: "8px 0 4px", fontSize: 12, color: P.sub, maxWidth: "88ch", lineHeight: 1.5 }}>
        <b style={{ color: P.ink }}>The window.</b> {DESIGN.window}</div>

      <H sub={DESIGN.consumerOut}>The consumer, step by step</H>
      <ConsumerFig />
      <Tbl head={["", "Step", "What happens"]} rows={DESIGN.consumer} />

      <H sub={DESIGN.registry.rule}>Composite keys and the registry</H>
      <KeyFig />
      <Tbl head={["View", "Key columns, in payload order", "Segments"]} rows={DESIGN.registry.rows.map(([v, k, n]) => [<span style={{ fontFamily: MONO, fontSize: 11 }}>{v}</span>, <span style={{ fontFamily: MONO, fontSize: 11 }}>{k}</span>, n])} />

      <H sub="The six pieces the BBH Integration Hub builds and maintains; SDC owns the views, the events and the markers.">What BBH builds</H>
      <Tbl head={["Component", "Key tasks"]} rows={DESIGN.builds} />

      <H sub="Why this design over a payload-carrying feed or a full extract.">Pros</H>
      <ul style={{ margin: "0 0 6px", paddingLeft: 20, fontSize: 12.5, color: P.sub, lineHeight: 1.55, maxWidth: "88ch" }}>
        {DESIGN.pros.map(([h, b]) => <li key={h} style={{ marginBottom: 4 }}><b style={{ color: P.ink }}>{h}.</b> {b}</li>)}
      </ul>

      <H sub="Each risk with the handling BBH is taking to the review, and whether it is ours to decide.">Cons and design risks</H>
      <Tbl head={["Risk", "Why it matters", "How we handle it", ""]}
        rows={DESIGN.cons.map(([r, w, h, m]) => [r, w, h, <Mark m={m} />])} />

      <H sub="Where the design is slow or fragile under load, and what takes the edge off each one.">Bottlenecks</H>
      <Tbl head={["#", "Bottleneck", "Why it matters", "Mitigation"]} rows={DESIGN.bottlenecks} />

      <H sub="Two places, one rule each: a fixed load order inside the batch, and an OPEN-and-retry set for a child whose parent has not landed.">Dependencies between the data</H>
      <DepFig />

      <H sub="How the pipeline behaves when things repeat, fail, or have to be run again. These are the rules an operator reads at three in the morning.">How we will run it</H>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginBottom: 6 }}>
        {DESIGN.rules.map(([topic, mark, bullets]) => (
          <div key={topic} style={{ border: `1px solid ${P.rule}`, borderTop: `3px solid ${(MARK[mark] || MARK.PROPOSED).c}`,
            borderRadius: 6, padding: "10px 13px", background: P.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b style={{ fontSize: 13, color: P.ink }}>{topic}</b><Mark m={mark} /></div>
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12, color: P.sub, lineHeight: 1.5 }}>
              {bullets.map((b) => <li key={b.slice(0, 30)} style={{ marginBottom: 3 }}>{b}</li>)}
            </ul>
          </div>))}
      </div>

      <H sub="The deck does not answer these and BBH cannot. They go to SEI before the design is signed.">Questions for SEI</H>
      <ol style={{ margin: "0 0 10px", paddingLeft: 22, fontSize: 12.5, color: P.sub, lineHeight: 1.55, maxWidth: "88ch" }}>
        {DESIGN.askSei.map((q) => <li key={q.slice(0, 30)} style={{ marginBottom: 3 }}>{q}</li>)}
      </ol>
      <p style={{ fontSize: 11.5, color: P.sub, margin: "6px 0 0", maxWidth: "88ch", fontFamily: MONO }}>
        source: the SDC delivery-plan deck and its review · the deck itself is SEI material and is not stored here
      </p>
    </div>);
}
