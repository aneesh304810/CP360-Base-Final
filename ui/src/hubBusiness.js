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
