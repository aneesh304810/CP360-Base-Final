// The pipelines Integration 360 lists, as worked examples: accounting and
// non-accounting, across the four channels (Events, Inbound Files, API,
// Outbound File). Each one says what it does for the business, where the
// data comes from and goes to, how it moves (the flow and the DAG), how it
// is transformed (column lineage in the Lineage page's shape) and which of
// the Quality Guardrails cases it carries, which decides its status.
//
// Everything is illustrative and synthetic: the file names are the seeded
// SWP definitions, the models are the dbt layers, the cases are the
// Guardrails synthetic events. No hostnames, schema owners, database links,
// ports or credentials.
import { SCENARIOS, STEP_DETAIL as POSITIONS_STEPS, DAG_DETAIL as POSITIONS_DAG, POSITIONS_LINEAGE, PIPELINE as POSITIONS } from "./hubBusiness.js";

export const CHANNELS = {
  event: { name: "Events", dir: "SEI → BBH", tag: "real-time", labels: { SRC: "Event envelope", STG1: "Stage 1", STG2: "Conformed", DWH: "Target" } },
  file: { name: "Inbound Files", dir: "SEI → BBH", tag: "daily", labels: { SRC: "File", STG1: "RAW", STG2: "Conformed", DWH: "Target" } },
  api: { name: "API", dir: "SEI → BBH", tag: "on call", labels: { SRC: "Request", STG1: "Gateway", STG2: "Registry", DWH: "Response" } },
  outbound: { name: "Outbound File", dir: "BBH → SEI", tag: "push + poll", labels: { SRC: "Consumer request", STG1: "Loader file", STG2: "Submission", DWH: "SEI outcome" } },
};
export const CHANNEL_ORDER = ["event", "file", "api", "outbound"];

/* ---------------- templates: flow, DAG and states per channel ---------------- */
const T = {
  file: {
    flow: (p) => [["Landing", "file arrives; business date from its name"], ["Validate", "header = RAW columns; trailer = rows; not empty"], ["RAW", `${p.raw}; rows loaded = rows promised`],
      ["Staging", `${p.stg}: typed; this date only; required fields flagged`], ["Intermediate", `${p.int}: PASS rows; joined; merged on keys`], [p.targetShort, `${p.target}, published shape`], ["Consumers", p.consumers.join(", ")]],
    branches: [[1, "Quarantine", "reason code; corrected file re-enters"], [2, "Failed", "rolled back; retry only when safe"]],
    dag: (p) => [["read_config", "active file definitions"], ["wait_for_files", "sensor: landing folder"], [`load_file × ${p.files || 1}`, "validate, load, reconcile, archive"], ["completeness", "every expected interface in"],
      ["dbt_stg", "staging, this business date"], ["dbt_int", "intermediate, merge"], ["dbt_mart", "publish"], ["date_close", "reconciled; downstream triggered"]],
    states: [["RECEIVED", 0], ["VALIDATED", 1], ["LOADING", 2], ["ARCHIVED", 3], ["QUARANTINED", 1, "down"], ["FAILED", 2, "down"], ["ARCHIVE_FAILED", 3, "down"]],
    loops: [[1, "corrected file"], [2, "retry when safe"], [3, "archive only"]],
    steps: (p) => [
      { step: "Landing", does: [`${p.file} is matched to its file definition by name; the business date is read from the name.`, "A registry row is claimed for this feed and date; a day already archived is skipped."], in: p.file, out: "FILE_REGISTRY row RECEIVED", row: p.rows[0], fails: [["unmatched or ambiguous name", "File left in landing, logged.", "No row for the day until the name or the definition is fixed."]] },
      { step: "Validate", does: ["Header columns must be exactly the RAW table's columns.", "The trailer's count must equal the data rows.", p.zeroOk ? "An empty file is allowed for this feed." : "An empty file is refused."], in: "header, trailer, rows", out: "VALIDATED with the counts", row: { "header seen": Object.keys(p.rows[0]).join(", ") }, fails: [["TRAILER_COUNT_MISMATCH", "QUARANTINED with the reason.", "The day's data is not in; the date stays open; SEI resends."], ["HEADER_COLUMN_MISMATCH", "QUARANTINED: SEI changed the layout.", "Caught at the door, before anything downstream reads it."]] },
      { step: "RAW", does: [`Rows are inserted into ${p.raw} as text, exactly as sent.`, "Each row is stamped with the business date, the registry id and its row number.", "Rows loaded must equal rows validated; committed together, then the file is archived."], in: "validated rows", out: `${p.raw} rows; ARCHIVED`, row: { ...p.rows[0], BUSINESS_DATE: "2026-11-27", FILE_REGISTRY_ID: "4471", FILE_ROW_NUMBER: "1" }, fails: [["RAW_LOAD_FAILED", "FAILED; rolled back; the file stays in landing.", "Nothing partial is visible; late, not wrong."], ["RAW_COUNT_MISMATCH", "FAILED; rolled back.", "Never published short."]] },
      { step: "Staging", does: [`${p.stg}: text becomes typed values; only this business date is kept.`, `Required fields: ${p.required.join(", ")}. A row missing one is marked FAIL with the fields named; kept, not dropped.`], in: `${p.raw} for the date`, out: `${p.stg} with dq_status_cd, dq_fail_reason_cds`, row: p.rows[1], fails: [[`MISSING_${p.required[0].toUpperCase()}`, "The row is FAIL with the reason; the model still builds.", "One row held back; the rest of the day goes on."], ["model build fails", "dbt reports the model; nothing downstream builds for the date.", "Late, not wrong; the DAG task is red."]] },
      { step: "Intermediate", does: [`${p.int}: only PASS rows go on.`, p.join, "Merged on the business keys: a re-run for the same date updates, never duplicates."], in: `PASS rows from ${p.stg}`, out: `${p.int}, merged`, row: p.rows[2], fails: [[p.intFail[0], p.intFail[1], p.intFail[2]], ["merge key duplicate", "dbt's test fails; the model does not publish.", "Caught before the target sees two rows for one key."]] },
      { step: p.targetShort, does: [`Reshaped into ${p.target}, in the shape its consumers already read.`, "Published only for a date whose inputs are complete."], in: p.int, out: `${p.target} for the date`, row: p.rows[3], fails: [["publish fails", "The mart model fails; the target keeps the previous date.", "Consumers see yesterday as the latest complete date."]] },
      { step: "Consumers", does: [`${p.consumers.join(", ")} read ${p.target} by business date.`, "They never see the file, the RAW table or the staging rows."], in: p.target, out: "reports, screens, downstream systems", row: p.rows[4] || p.rows[3], fails: [["reading an open date", "Allowed, but marked open.", "A consumer who needs certainty waits for the close."]] },
    ],
    dagDetail: (p) => [
      { task: "read_config", does: "Loads the active file definitions and the expected set for the date.", onFail: "Nothing starts; red at the first task.", retry: "Airflow retries; a bad definition is fixed in configuration.", downstream: "all upstream_failed" },
      { task: "wait_for_files", does: `A sensor polls the landing folder for ${p.file} until it arrives or the sensor times out.`, onFail: "Timeout: the date stays open; the alert names the interface.", retry: "Re-armed on the next schedule or by hand once the file lands.", downstream: "the load does not run" },
      { task: `load_file × ${p.files || 1}`, does: "Validate, load, reconcile, archive; one task per file, each with its own connection.", onFail: "That file's task is red; its registry row says QUARANTINED or FAILED with the code.", retry: "A quarantined file re-enters when corrected; a FAILED one is retried when no rows were recorded.", downstream: "completeness sees the gap" },
      { task: "completeness", does: "Compares the files loaded against the expected set for the date.", onFail: "An expected interface missing or quarantined: the date does not close; dbt does not run on a partial day.", retry: "Re-run once the missing file is in.", downstream: "dbt tasks skipped" },
      { task: "dbt_stg", does: `Builds ${p.stg} for the date with the required-column checks.`, onFail: "dbt names the model; the task is red; nothing downstream builds.", retry: "Fix and re-run from this task; staging is a view.", downstream: "dbt_int, dbt_mart upstream_failed" },
      { task: "dbt_int", does: `Builds ${p.int} with incremental merge; dbt tests run with the build.`, onFail: "A failed model or test stops the layer; merged rows stay consistent.", retry: "Re-run is safe: the merge updates, never duplicates.", downstream: "dbt_mart upstream_failed" },
      { task: "dbt_mart", does: `Builds ${p.target} and publishes it.`, onFail: "The target keeps the previous date; the task is red.", retry: "Re-run after the cause is fixed.", downstream: "date_close skipped" },
      { task: "date_close", does: "Marks the business date complete and triggers the downstream DAGs.", onFail: "The date stays open; downstream is not triggered.", retry: "Re-run after the cause is fixed.", downstream: "nothing is triggered on an open date" },
    ],
  },
  event: {
    flow: (p) => [["Listen", "the 4-field envelope: entity, key, sequence, time"], ["Micro-batch", "boxed per partition: start and end markers"], ["Collapse + pull", "keys deduped; current state pulled from SEI"], ["Stage 1", `${p.raw}: the pulled rows, as sent`],
      ["Staging", `${p.stg}: typed; required fields flagged`], ["Intermediate", `${p.int}: merged on keys`], [p.targetShort, `${p.target}, published shape`]],
    branches: [[1, "Gap", "a sequence gap: the box is not closed; it waits"], [3, "Failed", "rolled back; replayed from the box"]],
    dag: () => [["listener", "consumes the event hub"], ["box_microbatch", "closes a box per partition"], ["pull_current", "reads current state for the keys"], ["stage1_load", "load; roll back whole on error"],
      ["dbt_stg", "staging for the box"], ["dbt_int", "intermediate, merge"], ["dbt_mart", "publish"], ["box_close", "box complete; counts recorded"]],
    states: [["RECEIVED", 0], ["BOXED", 1], ["PULLED", 2], ["LOADED", 3], ["GAP", 1, "down"], ["NOT_FOUND", 2, "down"], ["FAILED", 3, "down"]],
    loops: [[1, "events arrive"], [2, "investigated"], [3, "replayed"]],
    steps: (p) => [
      { step: "Listen", does: ["SEI publishes an envelope per change: which entity, which key, which sequence number, when.", "The envelope carries no data: the hub records the offset and the time it arrived."], in: "SEI SDC Event Hub", out: "events with offsets", row: p.rows[0], fails: [["consumer lag climbs", "Events queue; nothing is lost.", "Changes reach BBH later than usual; the lag per partition is on the page."]] },
      { step: "Micro-batch", does: ["Events are boxed per partition between a start and an end marker.", "A box with a gap in its sequence is not closed."], in: "events", out: "closed boxes", row: { box: "MB-2026-11-27-14:05 partition 3", events: "412", "sequence gaps": "0" }, fails: [["sequence gap", "The box stays open; the hub waits for the missing events.", "A partition stalls while the others move; visible per partition."]] },
      { step: "Collapse + pull", does: ["Within a box the same key changed many times counts once.", "The current state of each key is pulled from SEI through the gateway: the pull re-reads current state, it does not replay the change."], in: "a closed box", out: "current rows for the keys", row: p.rows[1], fails: [["key not found above the delete rate", "The box is marked FAILED and investigated.", "More deletes than normal: either a real purge or a problem at the source."]] },
      { step: "Stage 1", does: [`The pulled rows land in ${p.raw}, stamped with the box id.`, "The load commits whole or rolls back whole."], in: "pulled rows", out: `${p.raw} rows`, row: { ...p.rows[1], MICRO_BATCH_ID: "MB-2026-11-27-14:05-3" }, fails: [["load fails", "Rolled back; the box is replayed.", "Late, not wrong."]] },
      { step: "Staging", does: [`${p.stg}: typed values; required fields: ${p.required.join(", ")}.`, "A row missing one is FAIL with the fields named."], in: p.raw, out: `${p.stg} with DQ flags`, row: p.rows[2], fails: [[`MISSING_${p.required[0].toUpperCase()}`, "The row is held with its reason.", "One change held; the rest of the box goes on."]] },
      { step: "Intermediate", does: [`${p.int}: PASS rows merged on the key; ${p.join}`], in: p.stg, out: p.int, row: p.rows[3], fails: [[p.intFail[0], p.intFail[1], p.intFail[2]]] },
      { step: p.targetShort, does: [`Published into ${p.target} as each box completes, so consumers see intraday state.`], in: p.int, out: p.target, row: p.rows[4] || p.rows[3], fails: [["publish fails", "The target keeps the previous box.", "Consumers see the last complete box."]] },
    ],
    dagDetail: () => [
      { task: "listener", does: "Consumes the event hub and records each envelope with its offset.", onFail: "Consumption stops; events queue at SEI.", retry: "Restarts from the last committed offset; nothing is lost.", downstream: "boxes stop closing" },
      { task: "box_microbatch", does: "Closes a box per partition when its end marker arrives and the sequence is complete.", onFail: "A gap keeps the box open; a timeout raises it.", retry: "Closes when the missing events arrive, or by hand after SEI confirms.", downstream: "pull waits" },
      { task: "pull_current", does: "Pulls current state for the box's keys through the gateway.", onFail: "Not-found above the delete rate, or the gateway refuses: FAILED.", retry: "Retried per box.", downstream: "stage1_load waits" },
      { task: "stage1_load", does: "Loads the pulled rows; commits whole.", onFail: "Rolled back; the box is replayed.", retry: "Replay from the box.", downstream: "dbt tasks skipped" },
      { task: "dbt_stg", does: "Staging for the box.", onFail: "Red; nothing downstream builds for the box.", retry: "Re-run from this task.", downstream: "dbt_int, dbt_mart upstream_failed" },
      { task: "dbt_int", does: "Intermediate merge for the box.", onFail: "A failed test stops the layer.", retry: "Re-run is safe.", downstream: "dbt_mart upstream_failed" },
      { task: "dbt_mart", does: "Publishes the box.", onFail: "The target keeps the previous box.", retry: "Re-run.", downstream: "box_close skipped" },
      { task: "box_close", does: "Records the box complete with its counts.", onFail: "The box stays open on the page.", retry: "Re-run.", downstream: "the next box is not blocked" },
    ],
  },
  api: {
    flow: (p) => [["Request", p.requestLine], ["Gateway", "authenticated, throttled, logged"], ["Validate", "schema and the submission it refers to"], ["Record", "durable write, idempotent on the message id"], ["Respond", "202 accepted; parsing and correlation downstream"]],
    branches: [[2, "Rejected", "400: schema or unknown submission; nothing recorded"], [3, "Retry", "write failed: 503; SEI resends"]],
    dag: () => [["receive", "endpoint called"], ["authenticate", "gateway"], ["validate_schema", "fields and types"], ["write_status", "submission registry"], ["ack_202", "answer SEI"], ["correlate", "thread by submission id"], ["poll_reconcile", "poll confirms; poll wins"]],
    states: [["RECEIVED", 0], ["VALIDATED", 1], ["RECORDED", 2], ["ACKED", 3], ["REJECTED", 1, "down"], ["RETRY", 2, "down"], ["DUPLICATE", 3, "down"]],
    loops: [[1, "SEI corrects"], [2, "SEI resends"], [3, "lands once"]],
    steps: (p) => [
      { step: "Request", does: [p.requestLine, "Thin and event-shaped: a status transition and an error summary, not the data."], in: "SEI", out: "an HTTP request", row: p.rows[0], fails: [["no request arrives", "Nothing to record; the poller covers the submission.", "A submission whose notification never comes is found by the poll, not left at SUBMITTED."]] },
      { step: "Gateway", does: ["The gateway authenticates SEI, applies the rate limit and logs the call."], in: "request", out: "authenticated request", row: { caller: "SEI", route: "loader status callback", decision: "allowed" }, fails: [["401 or 429", "Refused at the gateway; SEI retries.", "Visible as refused calls on the page."]] },
      { step: "Validate", does: ["Fields and types are checked; the submission id must be one the hub issued."], in: "authenticated request", out: "a valid status message", row: p.rows[1], fails: [["400 schema", "Rejected; nothing recorded; SEI is told why.", "A contract change caught at the door."], ["unknown submission", "Rejected.", "SEI's status for a batch BBH did not send: investigated."]] },
      { step: "Record", does: ["The status is written durably against the submission, keyed on SEI's message id, so the same message twice lands once.", "History keeps every row with its source; the current status is derived; terminal never regresses."], in: "valid status message", out: "a submission status row", row: p.rows[2], fails: [["write fails", "503; SEI resends.", "No acknowledgement without a durable write."]] },
      { step: "Respond", does: ["202 accepted as soon as the write is durable.", "Parsing of the error summary and correlation with the detail file happen after the response."], in: "status row", out: "202", row: p.rows[3], fails: [["poll disagrees later", "The poll wins; the status is corrected; the notification row is kept as history.", "The page shows the disagreement and which source won."]] },
    ],
    dagDetail: () => [
      { task: "receive", does: "The callback endpoint receives SEI's status.", onFail: "Endpoint down: SEI retries; the poller covers.", retry: "SEI resends.", downstream: "nothing recorded yet" },
      { task: "authenticate", does: "Gateway authentication and rate limit.", onFail: "401 or 429 returned.", retry: "SEI retries.", downstream: "not validated" },
      { task: "validate_schema", does: "Checks fields, types and the submission id.", onFail: "400 returned with the reason.", retry: "SEI corrects and resends.", downstream: "not recorded" },
      { task: "write_status", does: "Durable, idempotent write against the submission.", onFail: "503 returned.", retry: "SEI resends; the same message twice lands once.", downstream: "not acknowledged" },
      { task: "ack_202", does: "Acknowledges SEI.", onFail: "SEI sees a timeout and resends.", retry: "Idempotent.", downstream: "duplicate collapsed" },
      { task: "correlate", does: "Threads the status to the submission's other legs by the submission id.", onFail: "Status recorded but not threaded; raised.", retry: "Re-run.", downstream: "reconciliation waits" },
      { task: "poll_reconcile", does: "The poller confirms non-terminal submissions; when push and poll disagree the poll wins.", onFail: "Poll unavailable: submissions age toward STATUS_UNRESOLVED.", retry: "Tiered cadence.", downstream: "consumer callback waits" },
    ],
  },
  outbound: {
    flow: (p) => [["Consumer submits", `${p.consumer} hands the hub the rows`], ["Build file", `${p.template}: SEI's template, version in force`], ["Submit", "through the gateway; submission id back"], ["Status notify", "SEI calls the hub's endpoint"],
      ["Poll", "non-terminal submissions, tiered cadence"], ["Detail file", "which records were rejected, and why"], ["Respond", `${p.consumer} is answered once status and detail agree`]],
    branches: [[1, "Rejected", "template version or validation: the consumer is told at once"], [2, "Failed", "gateway refused; nothing submitted; retried"]],
    dag: () => [["receive_request", "consumer API"], ["build_file", "validate, map to template"], ["submit_gateway", "push; submission id"], ["wait_status", "sensor: notify or poll"],
      ["poll_status", "tiered cadence"], ["read_detail_file", "registry row, header, trailer"], ["reconcile_counts", "rejects reported = rows in file"], ["callback_consumer", "answer the consumer"]],
    states: [["SUBMITTED", 0], ["ACCEPTED", 1], ["PROCESSED", 2], ["RESPONDED", 3], ["REJECTED", 1, "down"], ["PARTIALLY_PROCESSED", 2, "down"], ["STATUS_UNRESOLVED", 3, "down"]],
    loops: [[1, "consumer resubmits"], [2, "detail file read"], [3, "poll finds it"]],
    stateNote: "SEI's own states (hubLoaderLoop.SUB_STATES); terminal never regresses",
    steps: (p) => [
      { step: "Consumer submits", does: [`${p.consumer} calls the hub's loader API with the rows and the loader name.`, "Acknowledged on submission, answered on completion: never request and response."], in: p.consumer, out: "a submission id", row: p.rows[0], fails: [["validation", "Rejected at once with the field and the reason.", "The consumer fixes and resubmits; nothing reached SEI."]] },
      { step: "Build file", does: [`Rows are mapped to ${p.template} in the template version in force.`, "Header and trailer written; the file is registered."], in: "rows", out: `${p.template} file`, row: p.rows[1], fails: [["template version changed", "Build fails; the version in force is named.", "SEI moved the template: caught before submission."]] },
      { step: "Submit", does: ["The file is pushed through the gateway to SEI's loader endpoint.", "SEI returns the submission identifier every later leg correlates on."], in: "the file", out: "SUBMITTED with SEI's id", row: p.rows[2], fails: [["gateway refused", "Nothing submitted; FAILED; retried.", "The consumer is not told it is done."]] },
      { step: "Status notify", does: ["SEI calls the hub's endpoint with a status transition and an error summary.", "Acknowledged on durable write; the same status twice lands once."], in: "SEI", out: "ACCEPTED, PROCESSED, PARTIALLY_PROCESSED or REJECTED", row: p.rows[3], fails: [["notification never arrives", "The poller finds the submission; past max age it becomes STATUS_UNRESOLVED.", "Not left at SUBMITTED unnoticed."]] },
      { step: "Poll", does: ["Non-terminal submissions are polled on a tiered cadence, tight after submission and backing off.", "When push and poll disagree, the poll wins; terminal never regresses."], in: "submission id", out: "current state", row: { poll: "3 of 6", state: "PARTIALLY_PROCESSED", "agrees with notify": "yes" }, fails: [["poll contradicts a notification", "The poll's state is taken; both rows kept.", "The page shows the disagreement."]] },
      { step: "Detail file", does: ["For a partial or rejected batch SEI's detail file says which records failed and why.", "Loaded through the file framework: registry row, header and trailer, quarantine on malformed; it never gates the inbound day."], in: "SEI", out: "per-record outcomes", row: p.rows[4], fails: [["reject count disagrees with the file", "The picture is incomplete; the consumer is not told it is done.", "Reconciliation, not assumption."]] },
      { step: "Respond", does: [`${p.consumer} is called back with the outcome and the per-record rejects.`, "Terminal: RESPONDED."], in: "status and detail, agreeing", out: "callback", row: p.rows[5] || p.rows[4], fails: [["callback fails", "Retried; the outcome is kept for the consumer to fetch.", "Nothing is lost."]] },
    ],
    dagDetail: () => [
      { task: "receive_request", does: "The consumer's rows arrive at the loader API.", onFail: "Rejected with the reason.", retry: "The consumer resubmits.", downstream: "nothing built" },
      { task: "build_file", does: "Validates the rows and maps them to the template in force.", onFail: "Red; the version mismatch or the field is named.", retry: "After the fix.", downstream: "nothing submitted" },
      { task: "submit_gateway", does: "Pushes the file through the gateway; records SEI's submission id.", onFail: "Gateway refused or SEI down: FAILED, nothing submitted.", retry: "Retried; the consumer is not told it is done.", downstream: "no status to wait for" },
      { task: "wait_status", does: "A sensor waits for SEI's notification or the first poll result.", onFail: "Timeout: the submission ages toward STATUS_UNRESOLVED.", retry: "The poller keeps going on its cadence.", downstream: "poll continues" },
      { task: "poll_status", does: "Polls non-terminal submissions; the poll wins on disagreement.", onFail: "Poll unavailable: ageing continues.", retry: "Tiered cadence.", downstream: "detail file waits" },
      { task: "read_detail_file", does: "Loads SEI's detail file through the file framework.", onFail: "Malformed: quarantined; the batch stays PARTIALLY_PROCESSED.", retry: "SEI resends the file.", downstream: "reconciliation waits" },
      { task: "reconcile_counts", does: "Rejects reported by status must equal rows in the detail file.", onFail: "Disagreement: the consumer is not answered.", retry: "After SEI's correction.", downstream: "callback waits" },
      { task: "callback_consumer", does: "Answers the consumer; RESPONDED.", onFail: "Retried; the outcome is kept to fetch.", retry: "Automatic.", downstream: "terminal" },
    ],
  },
};

/* ---------------- column lineage from a compact spec ---------------- */
// spec: { labels, src: [table, [[col, type, len]]], landing: [table, cols], conformed: [[table, cols]...], target: [table, cols],
//         edges: [[from, to, kind, label, transform]] } with short ids S:col, L:col, C:table.col, T:col.
export function buildGraph(spec, focus) {
  const nodes = [], full = {};
  const add = (stage, table, cols, prefix) => cols.forEach(([c, type, len]) => {
    const id = `${stage}:${table}:${c}`; full[prefix + c] = id;
    nodes.push({ id, stage, table, column: c, type, length: len || null, status: "mapped" });
  });
  add("SRC", spec.src[0], spec.src[1], "S:"); add("STG1", spec.landing[0], spec.landing[1], "L:");
  spec.conformed.forEach(([tb, cols]) => add("STG2", tb, cols, `C:${tb}.`)); add("DWH", spec.target[0], spec.target[1], "T:");
  const edges = spec.edges.map(([f, to, kind, label, transform]) => ({ from: full[f] || f, to: full[to] || to, kind: kind || "direct", label: label || "", transform: transform || "" }));
  const fanIn = {}; edges.forEach((e) => { fanIn[e.to] = (fanIn[e.to] || 0) + 1; });
  return { stage_labels: spec.labels, focus: full[focus] || focus || null, nodes, edges,
    stats: { chains: spec.target[1].length, masters: 1, fan_in: Object.values(fanIn).filter((n) => n > 1).length, targets: spec.target[1].length } };
}
const V = (c, len = 100) => [c, "VARCHAR2", len], Nn = (c) => [c, "NUMBER", null], D = (c) => [c, "DATE", null], Tx = (c) => [c, "text", null];
const stamps = [D("BUSINESS_DATE"), Nn("FILE_REGISTRY_ID"), Nn("FILE_ROW_NUMBER")];
const dq = [["dq_status_cd", "VARCHAR2", 4], ["dq_fail_reason_cds", "VARCHAR2", 400]];
const fileEdges = (cols, stg, stgMap, required) => [
  ...cols.map((c) => [`S:${c}`, `L:${c}`, "direct", "", "loaded as text, exactly as sent"]),
  ...cols.map((c) => [`L:${c}`, `C:${stg}.${stgMap[c][0]}`, stgMap[c][1] || "trim", stgMap[c][2] || "TRIM", stgMap[c][3] || ""]),
  ["L:BUSINESS_DATE", `C:${stg}.business_date`, "direct", "this date only", "WHERE business_date = the run date"],
  ...required.map((c) => [`C:${stg}.${c}`, `C:${stg}.dq_status_cd`, "merge", "required", "PASS unless any required field is null"]),
  [`C:${stg}.dq_status_cd`, `C:${stg}.dq_fail_reason_cds`, "direct", "", "the reasons behind a FAIL"],
];

/* ---------------- the catalogue ---------------- */
const CASE = (id, flow, dagTask, column) => ({ id, flow, dagTask, column });
export const PIPELINES = [
  { id: "evt-txn", name: "Intraday transactions", channel: "event", domain: "Accounting", source: "SEI SDC Event Hub", destination: "PBDW, IMDS", cadence: "continuous micro-batches", volume: "about 40k events a day", owner: "CP Data Ops", consumers: ["PBDW", "IMDS"],
    business: "Every trade, settlement and cash movement SEI books reaches BBH within minutes, so the books, the client reporting and the intraday cash view agree with SEI during the day, not only after the overnight file.",
    raw: "STG1_TRANSACTION", stg: "stg_transaction_header", int: "int_transaction", target: "PBDW TRANSACTION", targetShort: "PBDW", required: ["transaction_id", "transaction_type", "trade_date", "settlement_date", "transaction_currency"],
    join: "Joined to the account and the instrument the other feeds described.", intFail: ["account not found", "The transaction carries forward without its account and is counted.", "Visible in the counts, never invented."],
    rows: [{ entity: "TRANSACTION", key: "TX-20261127-0091", sequence: "884,201", at: "14:05:11" }, { TRANSACTION_ID: "TX-20261127-0091", TRANSACTION_TYPE: "BUY", TRADE_DATE: "20261127", SETTLEMENT_DATE: "20261129", TRANSACTION_CURRENCY: "USD", AMOUNT: "125,000.00", PORTFOLIO_ID: "PF-0001" },
      { transaction_id: "TX-20261127-0091", transaction_type: "BUY", trade_date: "2026-11-27", settlement_date: "2026-11-29", transaction_currency: "USD", amount: "125000.00 (number)", dq_status_cd: "PASS" }, { transaction_id: "TX-20261127-0091", account_id: "A-0001", instrument_id: "INS-7781", amount: "125000.00", trade_date: "2026-11-27" }, { TRANSACTION_KEY: "T-55120", ACCOUNT_ID: "A-0001", AMOUNT: "125000.00", TRADE_DATE: "2026-11-27" }],
    spec: { labels: CHANNELS.event.labels, src: ["event envelope", [Tx("ENTITY"), Tx("KEY"), Tx("SEQUENCE"), Tx("EVENT_TS")]], landing: ["STG1_TRANSACTION", [V("TRANSACTION_ID"), V("TRANSACTION_TYPE", 20), V("TRADE_DATE", 8), V("SETTLEMENT_DATE", 8), V("TRANSACTION_CURRENCY", 3), V("AMOUNT", 40), V("PORTFOLIO_ID"), V("MICRO_BATCH_ID", 60)]],
      conformed: [["stg_transaction_header", [V("transaction_id"), V("transaction_type", 20), D("trade_date"), D("settlement_date"), ["transaction_currency", "CHAR", 3], Nn("amount"), V("portfolio_id"), ...dq]], ["int_transaction", [V("transaction_id"), Nn("account_id"), V("instrument_id"), Nn("amount"), D("trade_date")]]],
      target: ["PBDW TRANSACTION", [Nn("TRANSACTION_KEY"), Nn("ACCOUNT_ID"), Nn("AMOUNT"), D("TRADE_DATE")]],
      edges: [["S:KEY", "L:TRANSACTION_ID", "direct", "pull", "the key names the transaction; the row is pulled from SEI"], ["S:SEQUENCE", "L:MICRO_BATCH_ID", "ren", "boxed", "events boxed per partition"], ["S:ENTITY", "L:TRANSACTION_ID", "direct", "", "entity decides the table"],
        ["L:TRANSACTION_ID", "C:stg_transaction_header.transaction_id", "trim", "TRIM"], ["L:TRANSACTION_TYPE", "C:stg_transaction_header.transaction_type", "trim", "TRIM · UPPER"], ["L:TRADE_DATE", "C:stg_transaction_header.trade_date", "ren", "TO_DATE", "YYYYMMDD to DATE"], ["L:SETTLEMENT_DATE", "C:stg_transaction_header.settlement_date", "ren", "TO_DATE"],
        ["L:TRANSACTION_CURRENCY", "C:stg_transaction_header.transaction_currency", "trim", "TRIM"], ["L:AMOUNT", "C:stg_transaction_header.amount", "ren", "TO_NUMBER", "text to NUMBER"], ["L:PORTFOLIO_ID", "C:stg_transaction_header.portfolio_id", "trim", "TRIM"],
        ...["transaction_id", "transaction_type", "trade_date", "settlement_date", "transaction_currency"].map((c) => [`C:stg_transaction_header.${c}`, "C:stg_transaction_header.dq_status_cd", "merge", "required", "PASS unless any required field is null"]), ["C:stg_transaction_header.dq_status_cd", "C:stg_transaction_header.dq_fail_reason_cds", "direct", ""],
        ["C:stg_transaction_header.transaction_id", "C:int_transaction.transaction_id", "direct", "", "PASS rows only"], ["C:stg_transaction_header.portfolio_id", "C:int_transaction.account_id", "merge", "join", "portfolio to account through stg_portfolio"], ["C:stg_transaction_header.amount", "C:int_transaction.amount", "direct"], ["C:stg_transaction_header.trade_date", "C:int_transaction.trade_date", "direct"],
        ["C:int_transaction.transaction_id", "T:TRANSACTION_KEY", "ren", "surrogate", "PBDW key from the sequence"], ["C:int_transaction.account_id", "T:ACCOUNT_ID", "phys"], ["C:int_transaction.amount", "T:AMOUNT", "phys"], ["C:int_transaction.trade_date", "T:TRADE_DATE", "phys"]] },
    focus: "C:stg_transaction_header.amount", cases: [] },

  { id: "evt-acct", name: "Account changes", channel: "event", domain: "Non-accounting", source: "SEI SDC Event Hub", destination: "IMDS, PBDW", cadence: "continuous micro-batches", volume: "about 2k events a day", owner: "CP Data Ops", consumers: ["IMDS", "PBDW"],
    business: "When an account opens, closes, changes name, base currency or disposition method at SEI, BBH's reference data follows the same day, so onboarding, statements and entitlements work from the current picture.",
    raw: "STG1_ACCOUNT", stg: "stg_account", int: "int_account", target: "IMDS ACCOUNT", targetShort: "IMDS", required: ["account_number", "account_display_name", "account_id", "account_base_currency", "default_disposition_method"],
    join: "Linked to the client and the portfolio group.", intFail: ["client not found", "The account is kept with the client empty and counted.", "Visible, not invented."],
    rows: [{ entity: "ACCOUNT", key: "ACCT-0001", sequence: "884,377", at: "14:06:02" }, { ACCOUNT_NUMBER: "ACCT-0001", ACCOUNT_DISPLAY_NAME: "Example Trust", ACCOUNT_ID: "A-0001", ACCOUNT_BASE_CURRENCY: "USD", DEFAULT_DISPOSITION_METHOD: "FIFO" },
      { account_number: "ACCT-0001", account_display_name: "Example Trust", account_id: "A-0001", account_base_currency: "USD", default_disposition_method: "FIFO", dq_status_cd: "PASS" }, { account_id: "A-0001", account_number: "ACCT-0001", client_id: "C-0001", base_currency: "USD" }, { ACCOUNT_ID: "A-0001", ACCOUNT_NUMBER: "ACCT-0001", BASE_CCY: "USD" }],
    spec: { labels: CHANNELS.event.labels, src: ["event envelope", [Tx("ENTITY"), Tx("KEY"), Tx("SEQUENCE"), Tx("EVENT_TS")]], landing: ["STG1_ACCOUNT", [V("ACCOUNT_NUMBER"), V("ACCOUNT_DISPLAY_NAME", 200), V("ACCOUNT_ID"), V("ACCOUNT_BASE_CURRENCY", 3), V("DEFAULT_DISPOSITION_METHOD", 20), V("MICRO_BATCH_ID", 60)]],
      conformed: [["stg_account", [V("account_number"), V("account_display_name", 200), Nn("account_id"), ["account_base_currency", "CHAR", 3], V("default_disposition_method", 20), ...dq]], ["int_account", [Nn("account_id"), V("account_number"), Nn("client_id"), ["base_currency", "CHAR", 3]]]],
      target: ["IMDS ACCOUNT", [Nn("ACCOUNT_ID"), V("ACCOUNT_NUMBER"), ["BASE_CCY", "CHAR", 3]]],
      edges: [["S:KEY", "L:ACCOUNT_NUMBER", "direct", "pull", "the key names the account; the row is pulled"], ["S:SEQUENCE", "L:MICRO_BATCH_ID", "ren", "boxed"],
        ["L:ACCOUNT_NUMBER", "C:stg_account.account_number", "trim", "TRIM"], ["L:ACCOUNT_DISPLAY_NAME", "C:stg_account.account_display_name", "trim", "TRIM"], ["L:ACCOUNT_ID", "C:stg_account.account_id", "ren", "TO_NUMBER"], ["L:ACCOUNT_BASE_CURRENCY", "C:stg_account.account_base_currency", "trim", "TRIM"], ["L:DEFAULT_DISPOSITION_METHOD", "C:stg_account.default_disposition_method", "trim", "TRIM · UPPER"],
        ...["account_number", "account_display_name", "account_id", "account_base_currency", "default_disposition_method"].map((c) => [`C:stg_account.${c}`, "C:stg_account.dq_status_cd", "merge", "required"]), ["C:stg_account.dq_status_cd", "C:stg_account.dq_fail_reason_cds", "direct"],
        ["C:stg_account.account_id", "C:int_account.account_id", "direct", "", "PASS rows only; merge key"], ["C:stg_account.account_number", "C:int_account.account_number", "direct"], ["C:stg_account.account_number", "C:int_account.client_id", "merge", "join", "through stg_client_account_link"], ["C:stg_account.account_base_currency", "C:int_account.base_currency", "direct"],
        ["C:int_account.account_id", "T:ACCOUNT_ID", "phys"], ["C:int_account.account_number", "T:ACCOUNT_NUMBER", "phys"], ["C:int_account.base_currency", "T:BASE_CCY", "ren", "renamed"]] },
    focus: "C:int_account.account_id", cases: [] },

  { id: "file-pos", name: "End-of-day positions", channel: "file", domain: "Accounting", source: "SEI SWP file EOD_POSITIONS", destination: "IMDS holding", cadence: "daily, standby to the events", volume: "about 210k rows a day", owner: "CP Data Ops", consumers: ["IMDS", "PBDW"], files: 38,
    business: "The authoritative end-of-day position per account and instrument, the baseline the daily reconciliation and the client valuations are measured against.",
    file: "EOD_POSITIONS_<yyyymmdd>.out", raw: "RAW_EOD_POSITIONS", stg: "stg_eod_positions", int: "int_position", target: "IMDS holding", targetShort: "IMDS", required: ["account_number", "taxlot_portfolio_id", "instrument_id", "trd_instrument_id"],
    join: "Joined to accounts, assets and tax lots.", intFail: ["account not found", "The join leaves the account empty; the row is held or carried, as the model decides.", "Visible in the counts."], rows: [],
    cases: [CASE("soda-001", 0, 1, "DWH:IMDS holding:AS_OF_DATE"), CASE("dbt-002", 4, 5, "STG2:int_position:account_id")] },

  { id: "file-cash", name: "Cash balances", channel: "file", domain: "Accounting", source: "SEI SWP file RECCASHACTIVITIES", destination: "IMDS cash summary", cadence: "daily", volume: "about 15k rows a day", owner: "CP Data Ops", consumers: ["IMDS", "Treasury reporting"], files: 1,
    business: "Each account's cash by currency, converted to USD with the day's rates, so cash reporting, overdraft checks and the client statements show one agreed balance.",
    file: "RECCASHACTIVITIES_<yyyymmdd>.out", raw: "RAW_REC_CASH_ACTIVITIES", stg: "stg_cash_activity", int: "int_cash_balance", target: "IMDS gld_cash_summary", targetShort: "IMDS", required: ["account_number", "currency", "cash_balance_local"],
    join: "Joined to the day's FX rates to express every balance in USD.", intFail: ["no FX rate for the currency", "cash_balance_usd is NULL for those rows; the not-null check fails on the gold table.", "Three accounts in an exotic currency show no USD balance until the rate arrives."],
    rows: [{ ACCOUNT_NUMBER: "ACC-88213", CURRENCY: "XPF", CASH_BALANCE_LOCAL: "412,000.00" }, { account_number: "ACC-88213", currency: "XPF", cash_balance_local: "412000.00 (number)", dq_status_cd: "PASS" }, { account_number: "ACC-88213", currency: "XPF", cash_balance_local: "412000.00", fx_rate: "null", cash_balance_usd: "null" }, { ACCOUNT_NUMBER: "ACC-88213", CASH_BALANCE_USD: "null", AS_OF_DATE: "2026-11-27" }],
    spec: { labels: CHANNELS.file.labels, src: ["RECCASHACTIVITIES file", [Tx("ACCOUNT_NUMBER"), Tx("CURRENCY"), Tx("CASH_BALANCE_LOCAL")]], landing: ["RAW_REC_CASH_ACTIVITIES", [V("ACCOUNT_NUMBER"), V("CURRENCY", 3), V("CASH_BALANCE_LOCAL", 40), ...stamps]],
      conformed: [["stg_cash_activity", [V("account_number"), ["currency", "CHAR", 3], Nn("cash_balance_local"), D("business_date"), ...dq]], ["stg_fx_rate", [["currency", "CHAR", 3], Nn("fx_rate")]], ["int_cash_balance", [V("account_number"), ["currency", "CHAR", 3], Nn("cash_balance_local"), Nn("fx_rate"), Nn("cash_balance_usd")]]],
      target: ["IMDS gld_cash_summary", [V("ACCOUNT_NUMBER"), Nn("CASH_BALANCE_USD"), D("AS_OF_DATE")]],
      edges: [...fileEdges(["ACCOUNT_NUMBER", "CURRENCY", "CASH_BALANCE_LOCAL"], "stg_cash_activity", { ACCOUNT_NUMBER: ["account_number"], CURRENCY: ["currency", "trim", "TRIM · UPPER"], CASH_BALANCE_LOCAL: ["cash_balance_local", "ren", "TO_NUMBER", "text to NUMBER"] }, ["account_number", "currency", "cash_balance_local"]),
        ["C:stg_cash_activity.account_number", "C:int_cash_balance.account_number", "direct", "", "PASS rows only"], ["C:stg_cash_activity.currency", "C:int_cash_balance.currency", "direct"], ["C:stg_cash_activity.cash_balance_local", "C:int_cash_balance.cash_balance_local", "direct"],
        ["C:stg_cash_activity.currency", "C:int_cash_balance.fx_rate", "merge", "join", "LEFT JOIN stg_fx_rate ON currency: no rate gives NULL"], ["C:stg_fx_rate.fx_rate", "C:int_cash_balance.fx_rate", "merge", ""], ["C:stg_fx_rate.currency", "C:stg_fx_rate.fx_rate", "direct"],
        ["C:int_cash_balance.cash_balance_local", "C:int_cash_balance.cash_balance_usd", "merge", "× rate", "cash_balance_local * fx_rate"], ["C:int_cash_balance.fx_rate", "C:int_cash_balance.cash_balance_usd", "merge", ""],
        ["C:int_cash_balance.account_number", "T:ACCOUNT_NUMBER", "phys"], ["C:int_cash_balance.cash_balance_usd", "T:CASH_BALANCE_USD", "phys", "", "NOT NULL expected here"], ["C:stg_cash_activity.business_date", "T:AS_OF_DATE", "ren", "renamed"]] },
    focus: "C:int_cash_balance.cash_balance_usd", cases: [CASE("ge-001", 4, 5, "C:int_cash_balance.cash_balance_usd")] },

  { id: "file-fee", name: "Fee accrual", channel: "file", domain: "Accounting", source: "SEI SWP file FEECOMPUTATION", destination: "IMDS fee accrual", cadence: "daily", volume: "about 9k rows a day", owner: "CP Data Ops", consumers: ["IMDS", "Billing"], files: 1,
    business: "The fee each account accrues for the day under its fee schedule, the figure billing invoices from and finance accrues, so it must be right to the basis point.",
    file: "FEECOMPUTATION_<yyyymmdd>.out", raw: "RAW_FEE_COMPUTATION", stg: "stg_fee_computation", int: "int_fee_accrual", target: "IMDS gld_fee_accrual", targetShort: "IMDS", required: ["account_number", "fee_schedule_id", "fee_rate", "fee_base_usd"],
    join: "Rate applied to the fee base from the fee schedule.", intFail: ["rate out of range", "The day's total is outside its 30-day band; the anomaly check fails.", "A schedule loaded as a percentage instead of basis points inflates 47 accounts' fees."],
    rows: [{ ACCOUNT_NUMBER: "ACC-33021", FEE_SCHEDULE_ID: "FS-2211", FEE_RATE: "75.0", FEE_BASE_USD: "7,500,000.00" }, { account_number: "ACC-33021", fee_schedule_id: "FS-2211", fee_rate: "75.0 (number)", fee_base_usd: "7500000.00 (number)", dq_status_cd: "PASS" }, { account_number: "ACC-33021", fee_schedule_id: "FS-2211", rate_entered: "75.0", expected_rate: "0.75", accrued_fee_usd: "56250.00" }, { ACCOUNT_NUMBER: "ACC-33021", ACCRUED_FEE_USD: "56250.00", AS_OF_DATE: "2026-11-27" }],
    spec: { labels: CHANNELS.file.labels, src: ["FEECOMPUTATION file", [Tx("ACCOUNT_NUMBER"), Tx("FEE_SCHEDULE_ID"), Tx("FEE_RATE"), Tx("FEE_BASE_USD")]], landing: ["RAW_FEE_COMPUTATION", [V("ACCOUNT_NUMBER"), V("FEE_SCHEDULE_ID", 40), V("FEE_RATE", 40), V("FEE_BASE_USD", 40), ...stamps]],
      conformed: [["stg_fee_computation", [V("account_number"), V("fee_schedule_id", 40), Nn("fee_rate"), Nn("fee_base_usd"), D("business_date"), ...dq]], ["int_fee_accrual", [V("account_number"), V("fee_schedule_id", 40), Nn("accrued_fee_usd")]]],
      target: ["IMDS gld_fee_accrual", [V("ACCOUNT_NUMBER"), Nn("ACCRUED_FEE_USD"), D("AS_OF_DATE")]],
      edges: [...fileEdges(["ACCOUNT_NUMBER", "FEE_SCHEDULE_ID", "FEE_RATE", "FEE_BASE_USD"], "stg_fee_computation", { ACCOUNT_NUMBER: ["account_number"], FEE_SCHEDULE_ID: ["fee_schedule_id"], FEE_RATE: ["fee_rate", "ren", "TO_NUMBER"], FEE_BASE_USD: ["fee_base_usd", "ren", "TO_NUMBER"] }, ["account_number", "fee_schedule_id", "fee_rate", "fee_base_usd"]),
        ["C:stg_fee_computation.account_number", "C:int_fee_accrual.account_number", "direct"], ["C:stg_fee_computation.fee_schedule_id", "C:int_fee_accrual.fee_schedule_id", "direct"],
        ["C:stg_fee_computation.fee_rate", "C:int_fee_accrual.accrued_fee_usd", "merge", "rate × base / 10000", "basis points: fee_base_usd * fee_rate / 10000 / days in year"], ["C:stg_fee_computation.fee_base_usd", "C:int_fee_accrual.accrued_fee_usd", "merge", ""],
        ["C:int_fee_accrual.account_number", "T:ACCOUNT_NUMBER", "phys"], ["C:int_fee_accrual.accrued_fee_usd", "T:ACCRUED_FEE_USD", "phys", "", "the daily total is checked against its 30-day band"], ["C:stg_fee_computation.business_date", "T:AS_OF_DATE", "ren", "renamed"]] },
    focus: "C:int_fee_accrual.accrued_fee_usd", cases: [CASE("soda-002", 4, 5, "C:int_fee_accrual.accrued_fee_usd")] },

  { id: "file-acct", name: "Accounts and clients", channel: "file", domain: "Non-accounting", source: "SEI SWP files ACCOUNTS, CLIENTS, CLIENTACCOUNTLINK", destination: "PBDW dim_account", cadence: "daily", volume: "about 48k rows a day", owner: "CP Data Ops", consumers: ["PBDW", "IMDS", "Entitlements"], files: 3,
    business: "The master list of accounts and the clients they belong to, which every other pipeline joins to: a wrong or duplicated account here shows up everywhere.",
    file: "ACCOUNTS_<yyyymmdd>.out", raw: "RAW_ACCOUNTS", stg: "stg_account", int: "int_account", target: "PBDW dim_account", targetShort: "PBDW", required: ["account_number", "account_display_name", "account_id", "account_base_currency", "default_disposition_method"],
    join: "Linked to the client through the client-account link file; deduplicated on the account number.", intFail: ["duplicate account_number", "dbt's uniqueness test fails on the merge key; the model does not publish.", "The same account twice after a mid-day amendment: the dedupe key lacked the amendment sequence."],
    rows: [{ ACCOUNT_NUMBER: "ACC-71120", ACCOUNT_DISPLAY_NAME: "Example Family Trust", ACCOUNT_ID: "A-7112", ACCOUNT_BASE_CURRENCY: "USD", DEFAULT_DISPOSITION_METHOD: "FIFO", SERVICE_TIER: "PRIORITY", AMEND_SEQ: "1" }, { account_number: "ACC-71120", account_id: "A-7112", account_base_currency: "USD", service_tier: "PRIORITY", amend_seq: "1 (number)", dq_status_cd: "PASS" }, { account_number: "ACC-71120", service_tier: "PRIORITY · STANDARD", amend_seq: "1, 2", rows: "2 for one key" }, { ACCOUNT_KEY: "D-7112", ACCOUNT_NUMBER: "ACC-71120", SERVICE_TIER: "?" }],
    spec: { labels: CHANNELS.file.labels, src: ["ACCOUNTS file", [Tx("ACCOUNT_NUMBER"), Tx("ACCOUNT_ID"), Tx("ACCOUNT_BASE_CURRENCY"), Tx("SERVICE_TIER"), Tx("AMEND_SEQ")]], landing: ["RAW_ACCOUNTS", [V("ACCOUNT_NUMBER"), V("ACCOUNT_ID"), V("ACCOUNT_BASE_CURRENCY", 3), V("SERVICE_TIER", 20), V("AMEND_SEQ", 10), ...stamps]],
      conformed: [["stg_account", [V("account_number"), Nn("account_id"), ["account_base_currency", "CHAR", 3], V("service_tier", 20), Nn("amend_seq"), D("business_date"), ...dq]], ["int_account", [V("account_number"), Nn("account_id"), V("service_tier", 20)]]],
      target: ["PBDW dim_account", [Nn("ACCOUNT_KEY"), V("ACCOUNT_NUMBER"), V("SERVICE_TIER", 20)]],
      edges: [...fileEdges(["ACCOUNT_NUMBER", "ACCOUNT_ID", "ACCOUNT_BASE_CURRENCY", "SERVICE_TIER", "AMEND_SEQ"], "stg_account", { ACCOUNT_NUMBER: ["account_number"], ACCOUNT_ID: ["account_id", "ren", "TO_NUMBER"], ACCOUNT_BASE_CURRENCY: ["account_base_currency"], SERVICE_TIER: ["service_tier", "trim", "TRIM · UPPER"], AMEND_SEQ: ["amend_seq", "ren", "TO_NUMBER"] }, ["account_number", "account_id", "account_base_currency"]),
        ["C:stg_account.account_number", "C:int_account.account_number", "merge", "dedupe", "one row per account_number: should take the highest amend_seq"], ["C:stg_account.amend_seq", "C:int_account.account_number", "merge", "", "the dedupe key omitted amend_seq, so two rows survive"], ["C:stg_account.account_id", "C:int_account.account_id", "direct"], ["C:stg_account.service_tier", "C:int_account.service_tier", "direct"],
        ["C:int_account.account_number", "T:ACCOUNT_NUMBER", "phys", "", "unique(account_number) is tested here"], ["C:int_account.account_id", "T:ACCOUNT_KEY", "ren", "surrogate"], ["C:int_account.service_tier", "T:SERVICE_TIER", "phys"]] },
    focus: "C:int_account.account_number", cases: [CASE("dbt-001", 4, 5, "C:int_account.account_number")] },

  { id: "file-ca", name: "Corporate actions", channel: "file", domain: "Non-accounting", source: "SEI SWP file UPCOMING_ACTIVITIES", destination: "IMDS corporate actions", cadence: "daily", volume: "about 3k rows a day", owner: "CP Data Ops", consumers: ["IMDS", "Operations"], files: 1,
    business: "Dividends, splits, mergers and other events on the instruments clients hold, so operations can act on them and valuations reflect them on the right date.",
    file: "UPCOMING_ACTIVITIES_<yyyymmdd>.out", raw: "RAW_UPCOMING_ACTIVITIES", stg: "stg_corporate_action", int: "int_corporate_action", target: "IMDS corporate_action", targetShort: "IMDS", required: ["asset_id", "action_type", "ex_date"],
    join: "The action type is mapped through the accepted set; the asset is joined to the instrument.", intFail: ["action type outside the set", "The rows are flagged for review; the model builds without them.", "A new type from SEI waits for the mapping table."],
    rows: [{ ASSET_ID: "US4581401001", ACTION_TYPE: "REORG", EX_DATE: "20260702" }, { asset_id: "US4581401001", action_type: "REORG", ex_date: "2026-07-02", dq_status_cd: "PASS", "in accepted set": "no" }, { asset_id: "US4581401001", action_type_cd: "? (unmapped)", ex_date: "2026-07-02" }, { INSTRUMENT_ID: "INS-4581", ACTION_TYPE: "?", EX_DATE: "2026-07-02" }],
    spec: { labels: CHANNELS.file.labels, src: ["UPCOMING_ACTIVITIES file", [Tx("ASSET_ID"), Tx("ACTION_TYPE"), Tx("EX_DATE")]], landing: ["RAW_UPCOMING_ACTIVITIES", [V("ASSET_ID", 40), V("ACTION_TYPE", 20), V("EX_DATE", 8), ...stamps]],
      conformed: [["stg_corporate_action", [V("asset_id", 40), V("action_type", 20), D("ex_date"), D("business_date"), ...dq]], ["int_corporate_action", [V("instrument_id"), V("action_type_cd", 10), D("ex_date")]]],
      target: ["IMDS corporate_action", [V("INSTRUMENT_ID"), V("ACTION_TYPE", 10), D("EX_DATE")]],
      edges: [...fileEdges(["ASSET_ID", "ACTION_TYPE", "EX_DATE"], "stg_corporate_action", { ASSET_ID: ["asset_id"], ACTION_TYPE: ["action_type", "trim", "TRIM · UPPER", "expected in (DIVIDEND, SPLIT, MERGER, RIGHTS, SPINOFF)"], EX_DATE: ["ex_date", "ren", "TO_DATE"] }, ["asset_id", "action_type", "ex_date"]),
        ["C:stg_corporate_action.asset_id", "C:int_corporate_action.instrument_id", "merge", "join", "asset to instrument through stg_asset"], ["C:stg_corporate_action.action_type", "C:int_corporate_action.action_type_cd", "ren", "map", "through the accepted-set mapping table; REORG is not in it"], ["C:stg_corporate_action.ex_date", "C:int_corporate_action.ex_date", "direct"],
        ["C:int_corporate_action.instrument_id", "T:INSTRUMENT_ID", "phys"], ["C:int_corporate_action.action_type_cd", "T:ACTION_TYPE", "phys"], ["C:int_corporate_action.ex_date", "T:EX_DATE", "phys"]] },
    focus: "C:stg_corporate_action.action_type", cases: [CASE("ge-002", 3, 4, "C:stg_corporate_action.action_type")] },

  { id: "file-taxlot", name: "Tax lots", channel: "file", domain: "Accounting", source: "SEI SWP file TAXLOTS", destination: "IMDS tax lot", cadence: "daily", volume: "about 400k rows a day", owner: "CP Data Ops", consumers: ["IMDS", "Tax reporting"], files: 1,
    business: "Every open lot with its cost basis and acquisition date, which realised gains, tax reporting and the disposition method depend on.",
    file: "TAXLOTS_<yyyymmdd>.out", raw: "RAW_TAXLOT", stg: "stg_taxlot", int: "int_taxlot", target: "IMDS taxlot", targetShort: "IMDS", required: ["taxlot_id", "portfolio_id", "trade_date", "instrument_id"],
    join: "Joined to the portfolio and the instrument.", intFail: ["instrument not found", "The lot is kept with the instrument empty and counted.", "Visible, not invented."],
    rows: [{ TAXLOT_ID: "TL-55", PORTFOLIO_ID: "PF-0001", TRADE_DATE: "20250114", INSTRUMENT_ID: "INS-7781", COST_BASIS: "98,500.00" }, { taxlot_id: "TL-55", portfolio_id: "PF-0001", trade_date: "2025-01-14", instrument_id: "INS-7781", cost_basis: "98500.00 (number)", dq_status_cd: "PASS" }, { taxlot_id: "TL-55", account_id: "A-0001", instrument_id: "INS-7781", cost_basis: "98500.00", acquired: "2025-01-14" }, { TAXLOT_ID: "TL-55", ACCOUNT_ID: "A-0001", COST_BASIS: "98500.00", ACQUIRED_DATE: "2025-01-14" }],
    spec: { labels: CHANNELS.file.labels, src: ["TAXLOTS file", [Tx("TAXLOT_ID"), Tx("PORTFOLIO_ID"), Tx("TRADE_DATE"), Tx("INSTRUMENT_ID"), Tx("COST_BASIS")]], landing: ["RAW_TAXLOT", [V("TAXLOT_ID", 40), V("PORTFOLIO_ID"), V("TRADE_DATE", 8), V("INSTRUMENT_ID"), V("COST_BASIS", 40), ...stamps]],
      conformed: [["stg_taxlot", [V("taxlot_id", 40), V("portfolio_id"), D("trade_date"), V("instrument_id"), Nn("cost_basis"), D("business_date"), ...dq]], ["int_taxlot", [V("taxlot_id", 40), Nn("account_id"), V("instrument_id"), Nn("cost_basis"), D("acquired")]]],
      target: ["IMDS taxlot", [V("TAXLOT_ID", 40), Nn("ACCOUNT_ID"), Nn("COST_BASIS"), D("ACQUIRED_DATE")]],
      edges: [...fileEdges(["TAXLOT_ID", "PORTFOLIO_ID", "TRADE_DATE", "INSTRUMENT_ID", "COST_BASIS"], "stg_taxlot", { TAXLOT_ID: ["taxlot_id"], PORTFOLIO_ID: ["portfolio_id"], TRADE_DATE: ["trade_date", "ren", "TO_DATE"], INSTRUMENT_ID: ["instrument_id"], COST_BASIS: ["cost_basis", "ren", "TO_NUMBER"] }, ["taxlot_id", "portfolio_id", "trade_date", "instrument_id"]),
        ["C:stg_taxlot.taxlot_id", "C:int_taxlot.taxlot_id", "direct", "", "merge key"], ["C:stg_taxlot.portfolio_id", "C:int_taxlot.account_id", "merge", "join", "portfolio to account through stg_portfolio"], ["C:stg_taxlot.instrument_id", "C:int_taxlot.instrument_id", "direct"], ["C:stg_taxlot.cost_basis", "C:int_taxlot.cost_basis", "direct"], ["C:stg_taxlot.trade_date", "C:int_taxlot.acquired", "ren", "renamed"],
        ["C:int_taxlot.taxlot_id", "T:TAXLOT_ID", "phys"], ["C:int_taxlot.account_id", "T:ACCOUNT_ID", "phys"], ["C:int_taxlot.cost_basis", "T:COST_BASIS", "phys"], ["C:int_taxlot.acquired", "T:ACQUIRED_DATE", "ren", "renamed"]] },
    focus: "C:int_taxlot.cost_basis", cases: [] },

  { id: "api-status", name: "Loader status callback", channel: "api", domain: "Non-accounting", source: "SEI (calls the hub's endpoint)", destination: "submission registry; Integration 360", cadence: "per submission, as SEI processes it", volume: "a few hundred calls a day", owner: "Integration Hub", consumers: ["Integration 360", "the submitting consumer"],
    business: "The first API in production: SEI tells BBH what happened to each file BBH sent. It is how a consumer learns a batch was accepted, partly rejected or refused without anyone watching a mailbox.",
    requestLine: "SEI posts a status transition for a submission id, with counts and an error summary",
    rows: [{ submission_id: "SUB-20261127-0007", status: "PARTIALLY_PROCESSED", processed: "1,180", rejected: "60", message_id: "M-99812" }, { submission_id: "SUB-20261127-0007 (known)", status: "PARTIALLY_PROCESSED (valid transition)", schema: "ok" }, { submission_id: "SUB-20261127-0007", status: "PARTIALLY_PROCESSED", source: "notify", message_id: "M-99812", received_at: "14:21:07" }, { response: "202 Accepted", correlation: "SUB-20261127-0007", next: "poll confirms; detail file expected" }],
    spec: { labels: CHANNELS.api.labels, src: ["status request", [Tx("submission_id"), Tx("status"), Tx("processed"), Tx("rejected"), Tx("message_id")]], landing: ["gateway log", [V("caller", 40), V("route", 60), V("decision", 10), V("submission_id", 40)]],
      conformed: [["submission_status", [V("submission_id", 40), V("status", 30), Nn("processed_count"), Nn("rejected_count"), V("source", 10), V("message_id", 40), D("received_at")]], ["submission", [V("submission_id", 40), V("current_status", 30), V("terminal", 1)]]],
      target: ["response", [Nn("http_status"), V("correlation_id", 40)]],
      edges: [["S:submission_id", "L:submission_id", "direct", "", "must be an id the hub issued"], ["S:submission_id", "C:submission_status.submission_id", "direct"], ["S:status", "C:submission_status.status", "trim", "valid transition", "checked against the state machine"], ["S:processed", "C:submission_status.processed_count", "ren", "TO_NUMBER"], ["S:rejected", "C:submission_status.rejected_count", "ren", "TO_NUMBER"], ["S:message_id", "C:submission_status.message_id", "direct", "idempotent", "the same message id twice lands once"],
        ["L:caller", "L:decision", "direct", "", "authenticated and within the rate limit"],
        ["C:submission_status.status", "C:submission.current_status", "merge", "derived", "latest by source precedence: poll over notify; terminal never regresses"], ["C:submission_status.source", "C:submission.current_status", "merge", ""], ["C:submission.current_status", "C:submission.terminal", "direct", "", "PROCESSED, REJECTED, RESPONDED, STATUS_UNRESOLVED"],
        ["C:submission_status.message_id", "T:http_status", "direct", "202", "after the durable write"], ["C:submission_status.submission_id", "T:correlation_id", "phys"]] },
    focus: "C:submission.current_status", cases: [] },

  { id: "api-lookup", name: "Account lookup (SWP API)", channel: "api", domain: "Non-accounting", source: "BBH screens (call SEI through the gateway)", destination: "the calling screen", cadence: "on demand", volume: "not yet", owner: "Integration Hub", consumers: ["CP 360", "Operations screens"], planned: true,
    business: "Later: look up an account's current state at SEI on demand instead of waiting for the next file or event. Not Day 1.",
    requestLine: "a BBH screen asks for an account by number", rows: [{ account_number: "ACCT-0001" }, { account_number: "ACCT-0001", schema: "ok" }, { request_id: "R-1", cached_until: "+5 min" }, { response: "200", fields: "name, base currency, status" }],
    spec: { labels: { SRC: "Request", STG1: "Gateway", STG2: "Cache", DWH: "Response" }, src: ["lookup request", [Tx("account_number")]], landing: ["gateway log", [V("caller", 40), V("route", 60), V("decision", 10)]], conformed: [["lookup_cache", [V("account_number"), D("cached_until")]]], target: ["response", [Nn("http_status"), V("account_display_name", 200), ["base_currency", "CHAR", 3]]],
      edges: [["S:account_number", "C:lookup_cache.account_number", "direct", "", "cached for a few minutes"], ["C:lookup_cache.account_number", "T:account_display_name", "phys", "", "from SEI's answer"], ["C:lookup_cache.account_number", "T:base_currency", "phys"], ["L:decision", "T:http_status", "direct"]] },
    focus: "T:account_display_name", cases: [] },

  { id: "out-fee", name: "Fee file to billing", channel: "outbound", domain: "Accounting", source: "Billing (BBH consumer)", destination: "SEI, through the gateway", cadence: "daily after the fee accrual closes", volume: "about 9k rows a day", owner: "Integration Hub", consumers: ["Billing"], consumer: "Billing", template: "FEE_ACCRUAL loader template",
    business: "The day's accrued fees go back to SEI as a loader file so SEI's billing agrees with BBH's accrual. Billing learns per record what SEI accepted.",
    rows: [{ account_number: "ACC-33021", accrued_fee_usd: "421.88", business_date: "2026-11-27" }, { ACCOUNT: "ACC-33021", FEE_AMT: "421.88", CCY: "USD", template_version: "v1.24" }, { submission_id: "SUB-20261127-0007", state: "SUBMITTED" }, { submission_id: "SUB-20261127-0007", status: "ACCEPTED", source: "notify" }, { record: "ACC-33021", outcome: "ACCEPTED" }, { callback: "Billing", outcome: "PROCESSED 8,900 of 8,900" }],
    spec: { labels: CHANNELS.outbound.labels, src: ["billing request", [Tx("account_number"), Tx("accrued_fee_usd"), Tx("business_date")]], landing: ["FEE_ACCRUAL loader file", [V("ACCOUNT"), V("FEE_AMT", 40), ["CCY", "CHAR", 3], V("TEMPLATE_VERSION", 10)]],
      conformed: [["submission", [V("submission_id", 40), V("current_status", 30), Nn("rows_sent"), Nn("rows_rejected")]], ["reject_detail", [V("submission_id", 40), V("record_key"), V("reason", 200)]]],
      target: ["billing callback", [V("submission_id", 40), V("outcome", 30), Nn("accepted"), Nn("rejected")]],
      edges: [["S:account_number", "L:ACCOUNT", "ren", "template", "mapped to SEI's field name"], ["S:accrued_fee_usd", "L:FEE_AMT", "ren", "template", "two decimals, no thousands separator"], ["S:business_date", "L:TEMPLATE_VERSION", "direct", "", "the version in force on the date"],
        ["L:ACCOUNT", "C:submission.rows_sent", "merge", "count"], ["L:FEE_AMT", "C:submission.rows_sent", "merge", ""], ["L:TEMPLATE_VERSION", "C:submission.submission_id", "direct", "submit", "SEI's id comes back on submission"],
        ["C:reject_detail.submission_id", "C:submission.rows_rejected", "direct", "detail file", "SEI's detail file for a partial batch, loaded through the file framework"], ["C:reject_detail.record_key", "C:submission.rows_rejected", "merge", "count", "rejects reported must equal rows in the file"], ["C:submission.current_status", "C:submission.rows_rejected", "merge", ""],
        ["C:submission.submission_id", "T:submission_id", "phys"], ["C:submission.current_status", "T:outcome", "phys"], ["C:submission.rows_sent", "T:accepted", "ren", "sent minus rejected"], ["C:submission.rows_rejected", "T:rejected", "phys"]] },
    focus: "C:submission.submission_id", cases: [CASE("af-001", 2, 2, "C:submission.submission_id")] },

  { id: "out-model", name: "Model allocation instructions", channel: "outbound", domain: "Non-accounting", source: "Portfolio management (BBH consumer)", destination: "SEI, through the gateway", cadence: "on request", volume: "a few batches a week", owner: "Integration Hub", consumers: ["Portfolio management"], consumer: "Portfolio management", template: "MODELALLOC loader template",
    business: "Target allocations for model portfolios go to SEI as a loader file; portfolio managers learn per model which allocations SEI accepted before trading on them.",
    rows: [{ model_id: "MDL-12", instrument_id: "INS-7781", target_pct: "12.5" }, { MODEL: "MDL-12", SECURITY: "INS-7781", PCT: "12.50", template_version: "v9" }, { submission_id: "SUB-20261127-0012", state: "SUBMITTED" }, { submission_id: "SUB-20261127-0012", status: "PROCESSED", source: "notify" }, { record: "MDL-12 / INS-7781", outcome: "ACCEPTED" }, { callback: "Portfolio management", outcome: "PROCESSED 48 of 48" }],
    spec: { labels: CHANNELS.outbound.labels, src: ["allocation request", [Tx("model_id"), Tx("instrument_id"), Tx("target_pct")]], landing: ["MODELALLOC loader file", [V("MODEL", 40), V("SECURITY"), V("PCT", 10), V("TEMPLATE_VERSION", 10)]],
      conformed: [["submission", [V("submission_id", 40), V("current_status", 30), Nn("rows_sent"), Nn("rows_rejected")]]], target: ["callback", [V("submission_id", 40), V("outcome", 30), Nn("accepted")]],
      edges: [["S:model_id", "L:MODEL", "ren", "template"], ["S:instrument_id", "L:SECURITY", "ren", "template"], ["S:target_pct", "L:PCT", "ren", "two decimals", "percentages must sum to 100 per model: checked before submission"],
        ["L:MODEL", "C:submission.rows_sent", "merge", "count"], ["L:PCT", "C:submission.rows_sent", "merge", ""], ["L:TEMPLATE_VERSION", "C:submission.submission_id", "direct", "submit"],
        ["C:submission.submission_id", "T:submission_id", "phys"], ["C:submission.current_status", "T:outcome", "phys"], ["C:submission.rows_sent", "T:accepted", "ren", "sent minus rejected"]] },
    focus: "C:submission.rows_sent", cases: [] },
];

/* ---------------- views ---------------- */
export const caseRecord = (id) => SCENARIOS.find((s) => s.id === id);

export function statusOf(p) {
  if (p.planned) return "planned";
  const recs = p.cases.map((c) => caseRecord(c.id)).filter(Boolean);
  if (recs.some((r) => r.status === "failed")) return "red";
  if (recs.some((r) => r.status === "warning")) return "amber";
  return "green";
}
export const STATUS_COLOR = { green: "#159943", amber: "#e0a13d", red: "#cc3344", planned: "#9aa7b2" };
export const STATUS_WORD = { green: "healthy", amber: "warning", red: "failing", planned: "not yet live" };

/** Everything the detail needs for one pipeline: flow, branches, DAG, states, step and task detail, the column graph, its cases. */
export function pipelineView(p) {
  const tpl = T[p.channel];
  if (p.id === "file-pos") {
    return { flow: POSITIONS.flow, branches: POSITIONS.branches, dag: POSITIONS.dag, states: POSITIONS.states, loops: T.file.loops, steps: POSITIONS_STEPS, dagDetail: POSITIONS_DAG, graph: { ...POSITIONS_LINEAGE, stage_labels: CHANNELS.file.labels },
      errors: POSITIONS.errors, cases: p.cases.map((c) => ({ ...caseRecord(c.id), ...c })) };
  }
  const graph = buildGraph(p.spec, p.focus);
  const cases = p.cases.map((c) => { const r = caseRecord(c.id); return { ...r, ...c, column: graph.nodes.find((n) => n.id === c.column) ? c.column : (buildGraph(p.spec, c.column).focus || c.column) }; });
  const steps = tpl.steps(p);
  const errors = steps.map((st) => [st.fails[0][0] + " at " + st.step, st.fails[0][1], st.fails[0][2], ""]).filter((e) => e[0]);
  return { flow: tpl.flow(p), branches: tpl.branches, dag: tpl.dag(p), states: tpl.states, loops: tpl.loops, stateNote: tpl.stateNote || "", steps, dagDetail: tpl.dagDetail(p), graph, cases, errors };
}

export const byChannel = () => CHANNEL_ORDER.map((k) => ({ key: k, ...CHANNELS[k], pipelines: PIPELINES.filter((p) => p.channel === k) }));
export const counts = () => PIPELINES.reduce((a, p) => { const s = statusOf(p); a[s] = (a[s] || 0) + 1; return a; }, { green: 0, amber: 0, red: 0, planned: 0 });
