// The outbound loader: a round trip, not an arrow.
//
// FOUR LEGS AND TWO TRANSPORTS. The status API carries the verdict and the
// counts; the error file carries the per-record detail. The consumer cannot
// be answered until both are in and agree, which makes the contract
// asynchronous by necessity rather than by preference - the API can say
// sixty rejected, only the file says which sixty.
//
// THE ERROR FILE MUST NOT GATE THE INBOUND DAY. A clean outbound day
// produces no file. Register that file as an expected daily interface and
// the completeness set never empties, so an outbound hiccup silently stops
// the inbound transformation. Outbound status and inbound completeness are
// two different clocks and coupling them is an accident waiting to happen.

export const LOOP_LEGS = [
  ["1","Consumer submits","loader details and the data, to the Hub API"],
  ["2","Loader push","validated, mapped to SWP format, out through the gateway"],
  ["3","Status back","verdict and counts, into Integration 360"],
  ["4","Error detail","per-record outcomes, as a file on the file transport"],
  ["5","Callback","the consumer is answered, once 3 and 4 agree"],
];

export const SUB_STATES = [
  ["SUBMITTED","Loader API accepted the push. Nothing known about the outcome."],
  ["ACCEPTED","SEI acknowledged the batch for processing."],
  ["PROCESSED","All records landed. No error file expected."],
  ["PARTIALLY_PROCESSED","Some rejected. The response to the consumer waits on the detail file."],
  ["REJECTED","Batch refused whole."],
  ["STATUS_UNRESOLVED","Past max age with no terminal status. Not left sitting at SUBMITTED for ever."],
  ["RESPONDED","The originating consumer has been called back. Terminal."],
];

export const LOOP_RULES = [
  ["Correlation","One submission id threads all four legs, so a batch has one timeline rather than four logs."],
  ["Reconciliation","The reject count SEI reported by API must equal the row count in the detail file. Disagreement means the picture is incomplete and the consumer is not told it is done."],
  ["Idempotency","SEI will resend status. The same status twice lands once."],
  ["Push and poll","A poller covers non-terminal submissions on a tiered cadence. When push and poll disagree, the poll wins and terminal never regresses."],
  ["Asynchronous by necessity","The API status can say 60 rejected; only the file says which 60. So the consumer contract is acknowledge on submission, respond on completion — never request/response."],
  ["Error file handling","Registry row, header and trailer counts, quarantine on malformed, archive on success — the existing file framework, with the gating flag off."],
];

// There is no outbound equivalent of FILE_REGISTRY. Inbound, every file has
// a row and a state. Outbound, a submission has nowhere to live - so the
// reject count SEI reports has nothing to reconcile against, and a batch
// that never comes back has nothing to age out.
export const LOOP_GAP = {
 t: "No submission registry",
 b: "Inbound, FILE_REGISTRY gives every file a row and a state. Outbound, "
  + "a submission has nowhere to live. Without one there is no correlation "
  + "id threading the "
  + "four legs, no reconciliation of the API reject count against the detail "
  + "file, and no age-out for a batch that never comes back.",
 needs: ["submission id, originating consumer, business date",
         "state: SUBMITTED to ACCEPTED to PROCESSED / PARTIALLY_PROCESSED / "
         + "REJECTED to RESPONDED",
         "counts sent, processed and rejected, from the status leg",
         "the error-detail file's registry id, from the file leg",
         "the consumer callback outcome"],
};
