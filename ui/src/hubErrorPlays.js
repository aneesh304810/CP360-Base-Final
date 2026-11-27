// Error scenarios as short plays: a token walks the flow, something goes
// wrong at one box, the hub handles it, and the walk resumes. Each frame
// says where the token is, how the box looks, what the registry state is
// and one line of narration. Taken from the loader's lifecycle and error
// codes, the event micro-batch rules and the outbound loader loop.

const FILE_NODES = ["Landing", "Validate", "RAW", "Staging", "Intermediate", "Target", "Consumers"];
const FILE_BRANCH = { Quarantine: 1, Failed: 2 };
const EVENT_NODES = ["Listen", "Micro-batch", "Collapse + pull", "Stage 1", "Staging", "Intermediate", "Target"];
const EVENT_BRANCH = { Gap: 1, Failed: 3 };
const OUT_NODES = ["Consumer submits", "Build file", "Submit", "Status notify", "Poll", "Detail file", "Respond"];
const OUT_BRANCH = { Rejected: 1, Unresolved: 4 };

// frame: { at: node index | "branch:Name", mood: ok|fail|fix|wait|skip, state: registry state, say: narration, mark?: [nodes done] }
export const PLAYS = [
  { id: "quarantine", title: "A file that fails validation", channel: "file", kind: "data problem, SEI's", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["RECEIVED", "VALIDATED", "LOADING", "ARCHIVED", "QUARANTINED"],
    summary: "The trailer promises 12,480 rows; the file holds 12,479. The file is quarantined with the reason, nothing is loaded, SEI corrects, the corrected file re-enters and the day completes.",
    frames: [
      { at: 0, mood: "ok", state: "RECEIVED", say: "EOD_POSITIONS for the date lands. The registry claims one lifecycle for this feed and date." },
      { at: 1, mood: "fail", state: "RECEIVED", say: "Trailer says 12,480 rows, the file holds 12,479: TRAILER_COUNT_MISMATCH." },
      { at: "branch:Quarantine", mood: "fail", state: "QUARANTINED", say: "The file moves to quarantine with the reason code. Nothing reached RAW. The date stays open and Integration 360 shows the interface red with the reason." },
      { at: "branch:Quarantine", mood: "fix", state: "QUARANTINED", say: "SEI is told which file and why. SEI resends a corrected file with the same name." },
      { at: 0, mood: "fix", state: "RECEIVED", say: "The corrected file re-enters. The same registry row is reset to RECEIVED and RETRY_COUNT becomes 1: one lifecycle, one retry counted." },
      { at: 1, mood: "ok", state: "VALIDATED", say: "Header and trailer agree this time: VALIDATED." },
      { at: 2, mood: "ok", state: "LOADING", say: "Rows loaded equal rows promised; committed together; the file is archived." },
      { at: 3, mood: "ok", state: "ARCHIVED", say: "Staging types the rows and flags required fields." },
      { at: 4, mood: "ok", state: "ARCHIVED", say: "PASS rows merged on their keys." },
      { at: 5, mood: "ok", state: "ARCHIVED", say: "Published for the date." },
      { at: 6, mood: "ok", state: "ARCHIVED", say: "Consumers read a complete date. Late, never wrong." },
    ] },
  { id: "failed-load", title: "The database fails half-way through a load", channel: "file", kind: "technical problem, ours", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["RECEIVED", "VALIDATED", "LOADING", "ARCHIVED", "FAILED"],
    summary: "Mid-way through the insert the database errors. The transaction rolls back, the registry row is FAILED, the file stays where it is. The hub retries on its own only when no rows were recorded.",
    frames: [
      { at: 0, mood: "ok", state: "RECEIVED", say: "The file lands and is claimed." },
      { at: 1, mood: "ok", state: "VALIDATED", say: "Header, trailer and counts agree." },
      { at: 2, mood: "fail", state: "LOADING", say: "Batch 6 of 9 raises a database error: RAW_LOAD_FAILED." },
      { at: "branch:Failed", mood: "fail", state: "FAILED", say: "The whole transaction rolls back: no partial day is visible. The file is not moved, because it is structurally fine. The DAG task is red." },
      { at: "branch:Failed", mood: "wait", state: "FAILED", say: "RAW_ROW_COUNT is NULL, so the hub knows nothing was committed: this one is safe to retry automatically. Had rows been recorded it would ask for a check first." },
      { at: 2, mood: "fix", state: "LOADING", say: "Retry: the same file, the same registry row, RETRY_COUNT 1." },
      { at: 2, mood: "ok", state: "LOADING", say: "Rows loaded equal rows promised; committed; archived." },
      { at: 3, mood: "ok", state: "ARCHIVED", say: "Staging." }, { at: 4, mood: "ok", state: "ARCHIVED", say: "Intermediate." }, { at: 5, mood: "ok", state: "ARCHIVED", say: "Published." },
      { at: 6, mood: "ok", state: "ARCHIVED", say: "The day closes, later than usual. Integration 360 kept the FAILED row and the retry in the history." },
    ] },
  { id: "missing-file", title: "The file does not arrive", channel: "file", kind: "data problem, SEI's", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["EXPECTED", "RECEIVED", "VALIDATED", "LOADING", "ARCHIVED"],
    summary: "The sensor waits for the file until its timeout. The date stays open with this interface outstanding; consumers read the prior date as the latest complete one. When the file lands the day runs normally.",
    frames: [
      { at: 0, mood: "wait", state: "EXPECTED", say: "The sensor polls the landing folder for EOD_POSITIONS. Nothing yet." },
      { at: 0, mood: "wait", state: "EXPECTED", say: "Still nothing at the expected time. Integration 360: expected 38 files, arrived 37; this interface outstanding." },
      { at: 0, mood: "fail", state: "EXPECTED", say: "The sensor times out. The date does not close; completeness blocks dbt from running on a partial day. Operations chases SEI." },
      { at: 6, mood: "skip", state: "EXPECTED", say: "Consumers see the prior date as the latest complete one. Nothing stale is presented as current." },
      { at: 0, mood: "fix", state: "RECEIVED", say: "The file lands. The sensor is re-armed and the run continues as any other day." },
      { at: 1, mood: "ok", state: "VALIDATED", say: "Validated." }, { at: 2, mood: "ok", state: "LOADING", say: "Loaded and reconciled." }, { at: 3, mood: "ok", state: "ARCHIVED", say: "Staging." }, { at: 4, mood: "ok", state: "ARCHIVED", say: "Intermediate." }, { at: 5, mood: "ok", state: "ARCHIVED", say: "Published." },
      { at: 6, mood: "ok", state: "ARCHIVED", say: "The date closes. The lateness is recorded against the interface." },
    ] },
  { id: "held-rows", title: "Rows missing a required field", channel: "file", kind: "data problem, SEI's", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["RECEIVED", "VALIDATED", "LOADING", "ARCHIVED"],
    summary: "Three positions have no account number. They load into RAW, staging marks them FAIL with the reason, the business entity is built without them, and the rest of the day is unaffected.",
    frames: [
      { at: 0, mood: "ok", state: "RECEIVED", say: "The file lands." }, { at: 1, mood: "ok", state: "VALIDATED", say: "Structure is fine: the header and the trailer agree." }, { at: 2, mood: "ok", state: "LOADING", say: "All 12,480 rows loaded, as sent." },
      { at: 3, mood: "fail", state: "ARCHIVED", say: "Staging: three rows have no account_number. dq_status_cd FAIL, dq_fail_reason_cds MISSING_ACCOUNT_NUMBER. Kept, not dropped." },
      { at: 4, mood: "fix", state: "ARCHIVED", say: "Intermediate takes PASS rows only: 12,477 go on. The three are held, with their reasons, where a steward can see them." },
      { at: 5, mood: "ok", state: "ARCHIVED", say: "Published: 12,477 positions. Integration 360 shows 3 held for this interface and date, one click from the rows." },
      { at: 6, mood: "ok", state: "ARCHIVED", say: "Consumers see the day complete with three positions held, not a day that is missing." },
      { at: 3, mood: "fix", state: "ARCHIVED", say: "SEI corrects at source; the next file carries the account numbers and the three rows pass." },
    ] },
  { id: "duplicate", title: "The same file delivered twice", channel: "file", kind: "no problem", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["RECEIVED", "VALIDATED", "LOADING", "ARCHIVED", "SKIPPED"],
    summary: "A second copy of a day already loaded arrives. The registry recognises the feed and date as ARCHIVED and skips it. No duplicate rows, nothing to clean up.",
    frames: [
      { at: 0, mood: "ok", state: "ARCHIVED", say: "A second EOD_POSITIONS file for a date already archived lands." },
      { at: 0, mood: "fix", state: "SKIPPED", say: "The registry claim finds (EOD_POSITIONS, date) ARCHIVED: duplicate. Result SKIPPED; the file is left for housekeeping." },
      { at: 6, mood: "ok", state: "SKIPPED", say: "Nothing changed downstream. Integration 360 notes a duplicate delivery against the interface." },
    ] },
  { id: "archive-failed", title: "Loaded, but the file could not be archived", channel: "file", kind: "housekeeping", nodes: FILE_NODES, branch: FILE_BRANCH, states: ["RECEIVED", "VALIDATED", "LOADING", "ARCHIVE_FAILED", "ARCHIVED"],
    summary: "The data is committed; only the move to the archive folder fails. The registry says ARCHIVE_FAILED, the next run moves the file and nothing is reloaded.",
    frames: [
      { at: 0, mood: "ok", state: "RECEIVED", say: "The file lands." }, { at: 1, mood: "ok", state: "VALIDATED", say: "Validated." }, { at: 2, mood: "ok", state: "LOADING", say: "Loaded, reconciled, committed." },
      { at: 2, mood: "wait", state: "ARCHIVE_FAILED", say: "The move to the archive folder fails: ARCHIVE_FAILED. The data is in; amber, not red." },
      { at: 3, mood: "ok", state: "ARCHIVE_FAILED", say: "Staging runs: the day is complete for the business." }, { at: 4, mood: "ok", state: "ARCHIVE_FAILED", say: "Intermediate." }, { at: 5, mood: "ok", state: "ARCHIVE_FAILED", say: "Published." },
      { at: 2, mood: "fix", state: "ARCHIVED", say: "Next run: archive-only recovery moves the file. RAW is never reloaded; a reload here would duplicate a business date." },
    ] },
  { id: "event-gap", title: "A gap in the event sequence", channel: "event", kind: "data problem, SEI's", nodes: EVENT_NODES, branch: EVENT_BRANCH, states: ["RECEIVED", "BOXED", "PULLED", "LOADED", "GAP"],
    summary: "Partition 3's micro-batch is missing sequence 884,205. The box is not closed; the other partitions move on; when the missing events arrive the box closes and the batch runs.",
    frames: [
      { at: 0, mood: "ok", state: "RECEIVED", say: "Envelopes arrive on four partitions: entity, key, sequence, time. No data inside." },
      { at: 1, mood: "fail", state: "GAP", say: "Partition 3: sequence 884,204 then 884,206. The box cannot close." },
      { at: "branch:Gap", mood: "wait", state: "GAP", say: "The box waits. Partitions 1, 2 and 4 close and continue. Integration 360: one partition stalled, lag climbing on it only." },
      { at: "branch:Gap", mood: "fix", state: "BOXED", say: "884,205 arrives late. The box closes with every sequence present." },
      { at: 2, mood: "ok", state: "PULLED", say: "Keys deduped; current state pulled from SEI through the gateway." },
      { at: 3, mood: "ok", state: "LOADED", say: "Stage 1 commits the box whole." }, { at: 4, mood: "ok", state: "LOADED", say: "Staging." }, { at: 5, mood: "ok", state: "LOADED", say: "Intermediate." },
      { at: 6, mood: "ok", state: "LOADED", say: "Published. The intraday view caught up; nothing was skipped or guessed." },
    ] },
  { id: "silent-loader", title: "An outbound batch SEI never reports on", channel: "outbound", kind: "integration problem", nodes: OUT_NODES, branch: OUT_BRANCH, states: ["SUBMITTED", "ACCEPTED", "PROCESSED", "RESPONDED", "STATUS_UNRESOLVED"],
    summary: "BBH sends a fee file; SEI's status notification never arrives. The poller finds the submission, the poll's answer wins, and a batch that stays silent past its max age becomes STATUS_UNRESOLVED instead of sitting at SUBMITTED.",
    frames: [
      { at: 0, mood: "ok", state: "SUBMITTED", say: "Billing hands the hub the day's accrued fees." }, { at: 1, mood: "ok", state: "SUBMITTED", say: "Mapped to the template version in force; registered." }, { at: 2, mood: "ok", state: "SUBMITTED", say: "Submitted through the gateway; SEI returns the submission id." },
      { at: 3, mood: "wait", state: "SUBMITTED", say: "Waiting for SEI to call back with a status." },
      { at: 3, mood: "fail", state: "SUBMITTED", say: "No notification within the tight window. A pure push design would leave this at SUBMITTED for ever." },
      { at: 4, mood: "fix", state: "ACCEPTED", say: "The poller asks SEI for current state: ACCEPTED, then PROCESSED. When push and poll disagree, the poll wins; terminal never regresses." },
      { at: "branch:Unresolved", mood: "wait", state: "STATUS_UNRESOLVED", say: "Had the poll also found nothing past the max age, the submission would become STATUS_UNRESOLVED and be raised, rather than silently waiting." },
      { at: 5, mood: "ok", state: "PROCESSED", say: "No rejects, so no detail file is expected: a clean outbound day produces no file, and the inbound day is never gated on one." },
      { at: 6, mood: "ok", state: "RESPONDED", say: "Billing is called back: PROCESSED 8,900 of 8,900. Terminal." },
    ] },
];

export const MOOD = { ok: "#0e8f7e", fail: "#cc3344", fix: "#1168bd", wait: "#e0a13d", skip: "#9aa7b2" };
export const MOOD_WORD = { ok: "on the path", fail: "goes wrong", fix: "handled", wait: "waiting", skip: "unaffected" };
