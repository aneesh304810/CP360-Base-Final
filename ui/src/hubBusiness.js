// CP Integration Hub, read by the business: short labels for a visual page.
//
// Everything is taken from the hub's own loader and transformation code (the
// generic file loader's lifecycle and error codes; the dbt staging,
// intermediate and mart layers and their required-column rule). Nothing is a
// promise the code does not make. No hostnames, schema owners, database
// links, ports or credentials: the page is shared widely and none of those
// help a reader.

export const ROLE = {
  title: "CP Integration Hub",
  line: "One controlled doorway for data between SEI and BBH, in both directions.",
  verbs: ["receive", "validate", "translate", "reconcile", "publish"],
  sources: [["SEI Event Hub", "events, intraday"], ["SEI SWP files", "38 daily files"], ["SEI SWP APIs", "later"], ["BBH consumers", "loader requests"]],
  lanes: [["Events", "SEI \u2192 BBH", "real-time"], ["Files", "SEI \u2192 BBH", "daily"], ["Loaders", "BBH \u2192 SEI", "push + poll"], ["APIs", "both", "later"]],
  consumers: [["PBDW", "system of record"], ["Pivotal DB", "existing"], ["IMDS", "existing"], ["SEI", "loader submissions"], ["CP DW Canonical", "later"]],
};

export const USES = [
  ["\u21C4", "Data movement", "Many sources to many destinations through one place, with a record of every movement."],
  ["\u26A1", "Real-time", "Events arrive in micro-batches during the day; positions and transactions are current, not overnight."],
  ["\u25D0", "Event-based", "Each change is an event with a sequence; gaps and lag are measured, not guessed."],
  ["\u23F1", "Sensors and scheduling", "Sensors wait for a file or an event, schedules run the day, and a business date closes only when complete."],
  ["\u2699", "Data transformation", "SEI's shapes become BBH's shapes once, in versioned rules: typed, checked, merged, published."],
  ["\u2630", "Many consumers", "PBDW, Pivotal, IMDS and later the canonical warehouse read one published shape each."],
];

export const GOVERNS = [
  ["Shapes and change control", "The RAW table is the contract; a layout change is caught at the door and versioned."],
  ["Rules and business logic", "Required fields, code mappings, merge keys: one place, versioned with the code."],
  ["Interface impact", "Each interface knows its consumers; a late file shows who is affected."],
  ["Data variance", "Promised against loaded, today against yesterday, pushed status against poll."],
];

export const I360 = {
  line: "Integration 360 - Run takes the place of Quality Guardrails, and the readiness view becomes Integration 360 - Design under Architecture. Run shows the same four signals, from the hub's own records, by interface and business date.",
  rows: [
    ["Validation", "required-field FAIL rows and reasons"],
    ["Orchestration", "registry state and the task that moved it"],
    ["Monitoring", "expected against arrived; date close"],
    ["Transformation tests", "dbt run and test results per date"],
  ],
};

export const PIPELINE = {
  title: "One real pipeline: end-of-day positions",
  file: "EOD_POSITIONS_<yyyymmdd>.out",
  flow: [
    ["Landing", "file arrives; business date from its name"],
    ["Validate", "header = RAW columns; trailer = rows; not empty"],
    ["RAW", "RAW_EOD_POSITIONS; rows loaded = rows promised"],
    ["Staging", "typed; this date only; required fields flagged"],
    ["Intermediate", "PASS rows; joined; merged on keys"],
    ["IMDS", "holding tables, published shape"],
    ["Consumers", "read IMDS; never see the file"],
  ],
  branches: [[1, "Quarantine", "reason code; corrected file re-enters"], [2, "Failed", "rolled back; retry only when safe"]],
  dag: [
    ["read_config", "active file definitions"],
    ["wait_for_files", "sensor: landing folder"],
    ["load_file \u00d7 38", "mapped per file: validate, load, reconcile, archive"],
    ["completeness", "every expected interface in"],
    ["dbt_stg", "staging, this business date"],
    ["dbt_int", "intermediate, merge"],
    ["dbt_imds", "marts, publish"],
    ["date_close", "reconciled; downstream triggered"],
  ],
  lineage: [
    ["file column", "ACCOUNT_NUMBER | INSTRUMENT_ID | QUANTITY"],
    ["RAW", "+ BUSINESS_DATE, FILE_REGISTRY_ID, FILE_ROW_NUMBER"],
    ["staging", "typed; dq_status_cd, dq_fail_reason_cds"],
    ["intermediate", "joined to account, asset, tax lot"],
    ["IMDS holding", "consumer shape"],
  ],
  states: [
    ["RECEIVED", 0], ["VALIDATED", 1], ["LOADING", 2], ["ARCHIVED", 3],
    ["QUARANTINED", 1, "down"], ["FAILED", 2, "down"], ["ARCHIVE_FAILED", 3, "down"],
  ],
  errors: [
    ["Trailer count off by one", "QUARANTINED \u00b7 TRAILER_COUNT_MISMATCH", "day's positions not in; date stays open", "file channel red, with reason"],
    ["Row without an account number", "staging FAIL \u00b7 MISSING_ACCOUNT_NUMBER", "one position held; rest of day fine", "held rows per interface and date"],
    ["Database fails mid-load", "FAILED \u00b7 RAW_LOAD_FAILED, rolled back", "late, not wrong", "registry FAILED and the task"],
    ["File not arrived on time", "nothing to load; interface outstanding", "yesterday is the latest complete date", "expected against arrived"],
    ["Same file delivered twice", "ARCHIVED \u2192 skipped", "no duplicates, nothing to do", "duplicate noted"],
    ["Loaded, archive move failed", "ARCHIVE_FAILED \u00b7 archive-only retry", "none; the day is complete", "amber, not red"],
  ],
};

/** The page as Markdown, for a note to the business. */
export function businessMarkdown() {
  const o = [`# ${ROLE.title}: the business view`, "", ROLE.line, "", `What it does: ${ROLE.verbs.join(" \u00b7 ")}.`, ""];
  o.push("## Where it is used", "");
  USES.forEach(([, h, b]) => o.push(`- **${h}.** ${b}`));
  o.push("", "## What it governs", "");
  GOVERNS.forEach(([h, b]) => o.push(`- **${h}.** ${b}`));
  o.push("", "## Integration 360 - Run in place of Quality Guardrails", "", I360.line, "");
  I360.rows.forEach(([h, b]) => o.push(`- **${h}:** ${b}`));
  o.push("", `## ${PIPELINE.title}`, "", `File: ${PIPELINE.file}`, "", "Flow: " + PIPELINE.flow.map((f) => f[0]).join(" \u2192 "), "",
    "DAG: " + PIPELINE.dag.map((d) => d[0]).join(" \u2192 "), "", "Lineage: " + PIPELINE.lineage.map((l) => l[0]).join(" \u2192 "), "",
    "| Scenario | State and reason | The business sees | Integration 360 shows |", "|---|---|---|---|");
  PIPELINE.errors.forEach((e) => o.push(`| ${e[0]} | ${e[1]} | ${e[2]} | ${e[3]} |`));
  return o.join("\n");
}

// What happens inside each box of the pipeline, on one synthetic position
// row, and what a failure at that step looks like. The sample values are
// made up (ACCT-0001, INS-7781); nothing here is a real account or
// instrument. `row` is the row as it leaves the step; the previous step's
// row is the one that came in.
export const SAMPLE_FILE_LINE = "ACCT-0001|INS-7781|1,250.00|USD";

export const STEP_DETAIL = [
  { step: "Landing", does: ["The file is found in the landing folder and matched to exactly one active file definition by its name pattern.", "The business date is read from the file name.", "A registry row is claimed for this feed and date; a day already archived is skipped."],
    in: "EOD_POSITIONS_20261127.out", out: "FILE_REGISTRY: EOD_POSITIONS, 2026-11-27, RECEIVED",
    row: { "file line": "ACCT-0001|INS-7781|1,250.00|USD" },
    fails: [["unmatched or ambiguous name", "File left where it is, logged; nothing claimed.", "No row for the day until the name is fixed or the definition added."],
            ["business date not readable", "File left where it is, logged.", "Same."]] },
  { step: "Validate", does: ["Header columns must be exactly the RAW table's business columns, in any order.", "The trailer's count must equal the data rows.", "An empty positions file is refused."],
    in: "the file, header and trailer", out: "VALIDATED, with FILE_ROW_COUNT and TRAILER_ROW_COUNT",
    row: { "header seen": "ACCOUNT_NUMBER, INSTRUMENT_ID, QUANTITY, CURRENCY", "rows counted": "12,480 = trailer 12,480" },
    fails: [["TRAILER_COUNT_MISMATCH", "QUARANTINED; the file moves to quarantine with the reason.", "The day's positions are not in; the date stays open; SEI resends; the retry is counted."],
            ["HEADER_COLUMN_MISMATCH", "QUARANTINED: SEI changed the layout.", "A layout change caught at the door, before anything downstream reads it."],
            ["ZERO_ROWS_NOT_ALLOWED", "QUARANTINED.", "An empty positions file is a missing day, not a quiet one."]] },
  { step: "RAW", does: ["Rows are inserted in batches into RAW_EOD_POSITIONS, as text, exactly as sent.", "Each row is stamped with the business date, the registry id and its row number in the file.", "Rows loaded must equal rows validated; both are committed in one transaction, then the file is archived."],
    in: "12,480 validated rows", out: "12,480 RAW rows; ARCHIVED",
    row: { ACCOUNT_NUMBER: "ACCT-0001", INSTRUMENT_ID: "INS-7781", QUANTITY: "1,250.00", CURRENCY: "USD", BUSINESS_DATE: "2026-11-27", FILE_REGISTRY_ID: "4471", FILE_ROW_NUMBER: "1" },
    fails: [["RAW_LOAD_FAILED", "FAILED; the transaction rolls back; the file stays in landing.", "Nothing partial is visible. Retried by the hub only when no rows were recorded, otherwise checked first."],
            ["RAW_COUNT_MISMATCH", "FAILED; rolled back.", "Rows loaded did not equal rows promised: investigated, never published short."],
            ["ARCHIVE_FAILED", "Data committed; only the file move failed.", "None for the business. The next run moves the file and nothing is reloaded."]] },
  { step: "Staging", does: ["Text becomes typed values: quantity to a number, dates to dates, codes trimmed.", "Only this business date is kept.", "Every row missing a required field (account number, tax-lot portfolio, instrument, trading instrument) is marked FAIL with the fields named; it is kept, not dropped."],
    in: "RAW rows for 2026-11-27", out: "stg_eod_positions: typed rows with dq_status_cd and dq_fail_reason_cds",
    row: { account_number: "ACCT-0001", instrument_id: "INS-7781", quantity: "1250.00 (number)", currency_cd: "USD", dq_status_cd: "PASS", dq_fail_reason_cds: "" },
    fails: [["MISSING_ACCOUNT_NUMBER", "The row is FAIL with the reason; the model still builds.", "One position is held back; the rest of the day goes on. A steward reviews the held rows."],
            ["model build fails", "dbt reports the model failed; nothing downstream builds for the date.", "The day is late, not wrong; the DAG task is red and the date stays open."]] },
  { step: "Intermediate", does: ["Only PASS rows go on.", "Positions are joined to the account, the asset and the tax lot that the other files described.", "Merged on the business keys, so a re-run for the same date updates rows rather than duplicating them."],
    in: "PASS staging rows, plus accounts, assets and tax lots", out: "intermediate position entity, merged",
    row: { account_id: "A-0001 (from stg_account)", instrument_id: "INS-7781", asset_type: "EQUITY (from stg_asset)", taxlot_id: "TL-55 (from stg_taxlot)", quantity: "1250.00" },
    fails: [["account not found", "The join leaves the account empty; the row carries forward with the gap or is held, as the model decides.", "A position without its account: visible in the counts, not silently invented."],
            ["merge key duplicate", "dbt's test fails; the model does not publish.", "Caught before IMDS sees two rows for one position."]] },
  { step: "IMDS", does: ["The position entity is reshaped into the IMDS holding tables, in the shape IMDS consumers already read.", "Written through the database link into the holding schema.", "Published only for a date whose inputs are complete."],
    in: "intermediate position entity", out: "IMDS holding rows for 2026-11-27",
    row: { holding_id: "H-9012", account_id: "A-0001", instrument_id: "INS-7781", quantity: "1250.00", as_of_date: "2026-11-27" },
    fails: [["link or write fails", "The mart model fails; IMDS keeps the previous date.", "Consumers see yesterday as the latest complete date; no half-published day."]] },
  { step: "Consumers", does: ["Read IMDS by as-of date.", "Never see the file, the RAW table or the staging rows.", "A date reads as complete only once every expected interface for it is in and reconciled."],
    in: "IMDS holding, as of 2026-11-27", out: "reports, screens, downstream systems",
    row: { "what they see": "ACCT-0001 holds 1,250.00 of INS-7781 as of 2026-11-27" },
    fails: [["reading an open date", "Allowed, but marked open.", "A consumer who needs certainty waits for the date to close."]] },
];

// The DAG, task by task: what it does and what Airflow does when it fails.
export const DAG_DETAIL = [
  { task: "read_config", does: "Loads the active file definitions (38 today) and the expected set for this business date.", onFail: "Nothing starts; the run is red at the first task.", retry: "Airflow retries; a bad definition is fixed in configuration.", downstream: "all upstream_failed" },
  { task: "wait_for_files", does: "A sensor polls the landing folder until the expected files for the date arrive, or until its timeout.", onFail: "Timeout: the sensor fails, the date stays open, an alert names the interfaces still missing.", retry: "Re-armed on the next schedule or by hand once the file lands.", downstream: "load tasks for missing files do not run" },
  { task: "load_file × 38", does: "One mapped task per file: validate, load, reconcile, archive. Each opens and closes its own database connection.", onFail: "Only that file's task is red; the other 37 finish. Its registry row says QUARANTINED or FAILED with the code.", retry: "A quarantined file re-enters when corrected; a FAILED one is retried when no rows were recorded.", downstream: "completeness sees the gap" },
  { task: "completeness", does: "Compares the files loaded against the expected set for the date.", onFail: "Fails when an expected interface is missing or quarantined: the date does not close; dbt does not run on a partial day.", retry: "Re-run once the missing file is in.", downstream: "dbt tasks skipped" },
  { task: "dbt_stg", does: "Builds the staging views for the business date with the required-column checks.", onFail: "dbt reports the model that failed; the task is red; nothing downstream builds.", retry: "Fix and re-run from this task; staging is a view, nothing to undo.", downstream: "dbt_int, dbt_imds upstream_failed" },
  { task: "dbt_int", does: "Builds the intermediate entities with incremental merge; dbt tests run with the build.", onFail: "A failed model or test stops the layer; already-merged rows stay consistent because each model commits whole.", retry: "Re-run is safe: the merge updates, never duplicates.", downstream: "dbt_imds upstream_failed" },
  { task: "dbt_imds", does: "Builds the IMDS marts and publishes over the database link.", onFail: "IMDS keeps the previous date; the task is red.", retry: "Re-run after the link or the model is fixed.", downstream: "date_close skipped" },
  { task: "date_close", does: "Marks the business date complete and triggers the downstream DAGs.", onFail: "The date stays open; downstream is not triggered.", retry: "Re-run after the cause is fixed.", downstream: "nothing is triggered on an open date" },
];

// The positions pipeline as the Lineage page draws it: four stages, one box
// per table, one row per column, edges carrying the transform. Node ids are
// stage:table:column. Same shape as the lineage API's graph, so LineageGraph
// draws it unchanged.
const N = (stage, table, column, type, length, extra) => ({ id: `${stage}:${table}:${column}`, stage, table, column, type, length, status: "mapped", ...(extra || {}) });
const E = (from, to, kind, label, transform) => ({ from, to, kind, label, transform });
const SRC_T = "EOD_POSITIONS file", RAW_T = "RAW_EOD_POSITIONS", STG_T = "stg_eod_positions", ACC_T = "stg_account", INT_T = "int_position", DWH_T = "IMDS holding";
const SRC_COLS = ["ACCOUNT_NUMBER", "INSTRUMENT_ID", "TRD_INSTRUMENT_ID", "TAXLOT_PORTFOLIO_ID", "QUANTITY", "CURRENCY"];
const STG_OF = { ACCOUNT_NUMBER: "account_number", INSTRUMENT_ID: "instrument_id", TRD_INSTRUMENT_ID: "trd_instrument_id", TAXLOT_PORTFOLIO_ID: "taxlot_portfolio_id", QUANTITY: "quantity", CURRENCY: "currency_cd" };
export const POSITIONS_LINEAGE = {
  focus: `STG2:${STG_T}:quantity`,
  stats: { chains: 5, masters: 1, fan_in: 2, targets: 5 },
  nodes: [
    ...SRC_COLS.map((c) => N("SRC", SRC_T, c, "text", null)),
    ...SRC_COLS.map((c) => N("STG1", RAW_T, c, "VARCHAR2", c === "QUANTITY" ? 40 : 100)),
    N("STG1", RAW_T, "BUSINESS_DATE", "DATE", null), N("STG1", RAW_T, "FILE_REGISTRY_ID", "NUMBER", null), N("STG1", RAW_T, "FILE_ROW_NUMBER", "NUMBER", null),
    N("STG2", STG_T, "account_number", "VARCHAR2", 100), N("STG2", STG_T, "instrument_id", "VARCHAR2", 100), N("STG2", STG_T, "trd_instrument_id", "VARCHAR2", 100),
    N("STG2", STG_T, "taxlot_portfolio_id", "VARCHAR2", 100), N("STG2", STG_T, "quantity", "NUMBER", null), N("STG2", STG_T, "currency_cd", "CHAR", 3),
    N("STG2", STG_T, "business_date", "DATE", null), N("STG2", STG_T, "dq_status_cd", "VARCHAR2", 4), N("STG2", STG_T, "dq_fail_reason_cds", "VARCHAR2", 400),
    N("STG2", ACC_T, "account_number", "VARCHAR2", 100), N("STG2", ACC_T, "account_id", "NUMBER", null),
    N("STG2", INT_T, "account_id", "NUMBER", null), N("STG2", INT_T, "instrument_id", "VARCHAR2", 100), N("STG2", INT_T, "taxlot_id", "VARCHAR2", 100),
    N("STG2", INT_T, "quantity", "NUMBER", null), N("STG2", INT_T, "as_of_date", "DATE", null),
    N("DWH", DWH_T, "HOLDING_ID", "NUMBER", null), N("DWH", DWH_T, "ACCOUNT_ID", "NUMBER", null), N("DWH", DWH_T, "INSTRUMENT_ID", "VARCHAR2", 100),
    N("DWH", DWH_T, "QUANTITY", "NUMBER", null), N("DWH", DWH_T, "AS_OF_DATE", "DATE", null),
  ],
  edges: [
    ...SRC_COLS.map((c) => E(`SRC:${SRC_T}:${c}`, `STG1:${RAW_T}:${c}`, "direct", "", "loaded as text, exactly as sent; row stamped with business date, registry id, row number")),
    ...SRC_COLS.map((c) => E(`STG1:${RAW_T}:${c}`, `STG2:${STG_T}:${STG_OF[c]}`,
      c === "QUANTITY" ? "ren" : c === "CURRENCY" ? "trim" : "trim",
      c === "QUANTITY" ? "TO_NUMBER" : c === "CURRENCY" ? "TRIM \u00b7 UPPER" : "TRIM",
      c === "QUANTITY" ? "text 1,250.00 becomes NUMBER 1250" : "trimmed; lower-cased name")),
    E(`STG1:${RAW_T}:BUSINESS_DATE`, `STG2:${STG_T}:business_date`, "direct", "this date only", "WHERE business_date = the run date"),
    ...["account_number", "instrument_id", "trd_instrument_id", "taxlot_portfolio_id"].map((c) =>
      E(`STG2:${STG_T}:${c}`, `STG2:${STG_T}:dq_status_cd`, "merge", "required", "PASS unless any required field is null; reasons as MISSING_<column>")),
    E(`STG2:${STG_T}:dq_status_cd`, `STG2:${STG_T}:dq_fail_reason_cds`, "direct", "", "the reasons behind a FAIL"),
    E(`STG2:${STG_T}:account_number`, `STG2:${INT_T}:account_id`, "merge", "join", "stg_eod_positions.account_number = stg_account.account_number, PASS rows only"),
    E(`STG2:${ACC_T}:account_id`, `STG2:${INT_T}:account_id`, "merge", "", "the account's id, from the accounts file"),
    E(`STG2:${ACC_T}:account_number`, `STG2:${ACC_T}:account_id`, "direct", "", "same row of stg_account"),
    E(`STG2:${STG_T}:instrument_id`, `STG2:${INT_T}:instrument_id`, "direct", "", "PASS rows only"),
    E(`STG2:${STG_T}:taxlot_portfolio_id`, `STG2:${INT_T}:taxlot_id`, "ren", "renamed", "joined to stg_taxlot; merge key"),
    E(`STG2:${STG_T}:quantity`, `STG2:${INT_T}:quantity`, "direct", "", "PASS rows only; incremental merge on the keys"),
    E(`STG2:${STG_T}:business_date`, `STG2:${INT_T}:as_of_date`, "ren", "renamed", ""),
    E(`STG2:${INT_T}:account_id`, `DWH:${DWH_T}:ACCOUNT_ID`, "phys", "", "published over the database link"),
    E(`STG2:${INT_T}:instrument_id`, `DWH:${DWH_T}:INSTRUMENT_ID`, "phys", "", ""),
    E(`STG2:${INT_T}:quantity`, `DWH:${DWH_T}:QUANTITY`, "phys", "", ""),
    E(`STG2:${INT_T}:as_of_date`, `DWH:${DWH_T}:AS_OF_DATE`, "phys", "", ""),
    E(`STG2:${INT_T}:taxlot_id`, `DWH:${DWH_T}:HOLDING_ID`, "ren", "sequence", "holding id from the IMDS sequence, keyed on the tax lot"),
  ],
};

// The Quality Guardrails cases, replayed through this pipeline. These are the
// same illustrative events the Guardrails page showed (ingestion/
// guardrails_synth.py: ids, engines, rules, observed values, root causes and
// sample rows), placed where each one would surface here: the flow step, the
// DAG task, the lineage column, and the Integration 360 record. Sample values
// are the synthetic ones from that file; no host or path from it is carried.
export const SCENARIOS = [
  { id: "soda-001", engine: "Soda", kind: "Monitoring", severity: "high", status: "failed", pipeline: "Positions", dag: "swp_positions_processing",
    rule: "freshness(as_of_date) < 26h", expectation: "max(as_of_date) within 26 hours", observed: "38h stale", threshold: "26h", bad: 0, total: 210544,
    message: "Positions gold table is 38 hours stale: the EOD feed did not arrive.", cause: "The SEI positions EOD file for the prior business day never landed, so the sensor timed out and the table was not refreshed.",
    sample: [{ expected_file: "EOD_POSITIONS_<prior day>.out", status: "MISSING" }],
    flow: 0, dagTask: 1, column: "DWH:IMDS holding:AS_OF_DATE", registry: "no FILE_REGISTRY row for the date; the sensor timed out; the date stays open", i360: "Completeness: expected against arrived, this interface outstanding; consumers read the prior date as the latest complete one." },
  { id: "ge-001", engine: "Great Expectations", kind: "Validation", severity: "critical", status: "failed", pipeline: "Cash", dag: "swp_cash_processing",
    rule: "expect_column_values_to_not_be_null", expectation: "cash_balance_usd NOT NULL", observed: "3 nulls in 15,204 rows", threshold: "0 nulls allowed", bad: 3, total: 15204,
    message: "cash_balance_usd contains NULLs after the FX enrichment join.", cause: "The FX rate feed had no rate for three accounts in an exotic currency (XPF); the join produced NULL for those rows.",
    sample: [{ account_number: "ACC-88213", currency: "XPF", cash_balance_local: "412,000.00", fx_rate: "null", cash_balance_usd: "null" }, { account_number: "ACC-90017", currency: "XPF", cash_balance_local: "88,000.00", fx_rate: "null", cash_balance_usd: "null" }],
    flow: 3, dagTask: 4, column: "STG2:stg_eod_positions:dq_status_cd", registry: "the file loaded whole; the rows are marked FAIL in staging with the reason", i360: "Held rows per interface and date with the reason code; the three rows, with their currency, one click away." },
  { id: "dbt-001", engine: "dbt", kind: "Transformation tests", severity: "high", status: "failed", pipeline: "Account", dag: "swp_account_processing",
    rule: "unique(account_number)", expectation: "account_number is unique", observed: "12 duplicate account_numbers", threshold: "0 duplicates", bad: 12, total: 48210,
    message: "Duplicate account_number values in dim_account.", cause: "The account feed delivered the same account twice with different service tiers after a mid-day amendment; the dedupe key did not include the amendment sequence.",
    sample: [{ account_number: "ACC-71120", service_tier: "PRIORITY", amend_seq: 1 }, { account_number: "ACC-71120", service_tier: "STANDARD", amend_seq: 2 }],
    flow: 4, dagTask: 5, column: "STG2:int_position:account_id", registry: "the file loaded whole; dbt's test on the merge key fails; the model does not publish", i360: "The failed test per model and date with the duplicate keys; nothing downstream builds until the merge key is fixed." },
  { id: "af-001", engine: "Airflow", kind: "Orchestration", severity: "critical", status: "failed", pipeline: "Fee", dag: "swp_fee_accrual",
    rule: "task sftp_to_billing", expectation: "task succeeds", observed: "failed (exit 1)", threshold: "0 failures", bad: 0, total: 0,
    message: "Fee accrual loader failed to deliver to the billing endpoint.", cause: "The billing endpoint rotated its key; the connection was refused with a host-key mismatch. No fee file was delivered.",
    sample: [{ leg: "outbound loader: submit", outcome: "connection refused", file_delivered: "no" }],
    flow: 6, dagTask: 7, column: "DWH:IMDS holding:HOLDING_ID", registry: "the inbound day is complete; the outbound submission has no accepted status and ages towards STATUS_UNRESOLVED", i360: "Loader channel: the submission with no status, its age, and the task that failed; the inbound date is unaffected, which the page says." },
  { id: "soda-002", engine: "Soda", kind: "Monitoring", severity: "high", status: "failed", pipeline: "Fee", dag: "swp_fee_accrual",
    rule: "anomaly_detection(sum accrued_fee_usd)", expectation: "daily total within 3 standard deviations of the trailing 30 days", observed: "+412% against baseline", threshold: "3 standard deviations", bad: 47, total: 8900,
    message: "Fee accrual total spiked 412% above the 30-day baseline.", cause: "A fee schedule was loaded with basis points expressed as a percentage (0.75 entered as 75), inflating 47 accounts' fees.",
    sample: [{ account_number: "ACC-33021", fee_schedule_id: "FS-2211", rate_entered: "75.0", expected_rate: "0.75", accrued_fee_usd: "56,250.00" }, { account_number: "ACC-33044", fee_schedule_id: "FS-2211", rate_entered: "75.0", expected_rate: "0.75", accrued_fee_usd: "41,200.00" }],
    flow: 4, dagTask: 5, column: "STG2:int_position:quantity", registry: "the file loaded whole and every row passed its checks; the day's total is out of range", i360: "Variance: today against the trailing baseline per interface; the 47 rows and the schedule they share." },
  { id: "dbt-002", engine: "dbt", kind: "Transformation tests", severity: "medium", status: "warning", pipeline: "Positions", dag: "swp_positions_processing",
    rule: "relationships(account_number -> dim_account)", expectation: "every account_number exists in dim_account", observed: "8 orphan account_numbers", threshold: "0 orphans (warn)", bad: 8, total: 210544,
    message: "8 positions reference accounts not yet in dim_account.", cause: "The positions feed arrived before the account feed for 8 newly onboarded accounts: a load-ordering race, not bad data.",
    sample: [{ account_number: "ACC-99001", position_id: "P-5521", market_value_usd: "12,000.00" }, { account_number: "ACC-99002", position_id: "P-5522", market_value_usd: "8,400.00" }],
    flow: 4, dagTask: 5, column: "STG2:int_position:account_id", registry: "both files loaded; the join finds no account for 8 rows; a warning, the model publishes", i360: "Interface impact: positions depend on accounts for the same date; the 8 rows resolve when the account file is in." },
  { id: "ge-002", engine: "Great Expectations", kind: "Validation", severity: "medium", status: "failed", pipeline: "Corporate Actions", dag: "swp_corporate_actions",
    rule: "expect_column_values_to_be_in_set", expectation: "action_type in (DIVIDEND, SPLIT, MERGER, RIGHTS, SPINOFF)", observed: "5 rows with action_type = REORG", threshold: "0 unexpected", bad: 5, total: 3120,
    message: "Unmapped corporate action type REORG.", cause: "SEI introduced a new action type not yet in the accepted set or the mapping table; the rows were flagged for review.",
    sample: [{ asset_id: "US4581401001", action_type: "REORG", ex_date: "2026-07-02" }, { asset_id: "US0378331005", action_type: "REORG", ex_date: "2026-07-03" }],
    flow: 3, dagTask: 4, column: "STG2:stg_eod_positions:currency_cd", registry: "the file loaded whole; the code is outside the accepted set in staging", i360: "Change control: a new code from SEI, caught at the door; the mapping table is the fix, and the rows wait for it." },
];
export const SEVERITY_COLOR = { critical: "#8e1b2b", high: "#cc3344", medium: "#e0a13d", low: "#5c7c94" };
