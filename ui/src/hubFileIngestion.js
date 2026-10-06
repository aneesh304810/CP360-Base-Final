// File-based ingestion: the path both SEI design documents actually
// describe, end to end.
//
// IT IS THE BEST-SPECIFIED THING IN THE PACK AND THE EASIEST TO LOSE.
// Under an events-primary posture the file set becomes the secondary
// route, and a secondary route drawn as one dashed box stops carrying the
// discipline that makes it work - the three counts, the registry claim,
// and above all the difference between the three ways it can fail. This
// file keeps that discipline on its own screen.
//
// THE THREE FAILURES ARE NOT INTERCHANGEABLE. A pre-load failure can be
// revalidated. A load failure can be rerun. A commit that succeeded with a
// failed file move must NEVER be reloaded - RAW already holds the rows,
// and reloading doubles them. Collapsing those three into "failed" is the
// defect that turns one bad night into a duplicated business date.

export const FILE_CHAIN = [
 { id: "F1", n: "Discovery", tech: "Airflow - scheduled",
   w: "A scheduled scan of the Landing Zone, every five minutes. Repeated "
    + "discovery of the same file is safe because the registry claim on "
    + "(interface, business date) is what makes it idempotent, not the scan.",
   sei: ["S6"], tbl: ["T1", "T2"] },
 { id: "F2", n: "One task per file", tech: "Dynamic Task Mapping",
   w: "Each discovered file is expanded into its own mapped task, so one "
    + "bad file fails one task rather than the run. The DAG itself is "
    + "metadata-driven: the interfaces it expects come from configuration, "
    + "not from code.",
   sei: ["S5", "S7"], tbl: ["T1"] },
 { id: "F3", n: "Validation", tech: "Python - worker pod",
   w: "Before a single row is loaded: readable, header, trailer, zero-row "
    + "policy and business date. Anything that fails here has touched no "
    + "RAW table, which is what makes QUARANTINED recoverable by simply "
    + "revalidating a corrected file.",
   sei: ["S8"], tbl: ["T2"] },
 { id: "F4", n: "RAW load", tech: "one Oracle transaction",
   w: "The detail rows go into the configured RAW table in ONE transaction. "
    + "Not one per batch of rows, not one per chunk - one per file. A "
    + "half-loaded file is the state the design refuses to allow.",
   sei: ["S8"], tbl: ["T4"] },
 { id: "F5", n: "Three counts agree", tech: "the commit condition",
   w: "Parsed rows, the trailer's declared count and the rows actually "
    + "inserted must all be equal. They are checked before the commit, not "
    + "after, so a disagreement rolls back rather than needing a repair.",
   sei: ["S8"], tbl: ["T2"] },
 { id: "F6", n: "Archive", tech: "file move",
   w: "The file moves to Archive and the outcome is recorded. ARCHIVED is "
    + "the only terminal success, and it is what the completeness gate "
    + "counts - not RECEIVED, not LOADING.",
   sei: ["S4", "S8"], tbl: ["T2"] },
];

// Checked in this order, all before any row reaches RAW.
export const FILE_VALIDATIONS = [
 ["Readable", "The file opens and parses as the configured format."],
 ["Header", "Present and matching the configured schema for the interface."],
 ["Trailer", "Present, and its declared row count is readable."],
 ["Zero-row policy", "A zero-row file is a valid delivery, not an error - "
  + "it is how an interface says it had nothing today. Treating it as a "
  + "failure stalls the completeness gate on a quiet day."],
 ["Business date", "The date in the file matches the date being ingested."],
];

export const COUNT_RULE = {
 eq: "FILE_ROW_COUNT = TRAILER_ROW_COUNT = RAW_ROW_COUNT",
 w: "Parsed, declared and inserted. All three are held on the registry row, "
  + "so a disagreement is readable afterwards rather than only in a log. "
  + "They are compared before the commit, not after it, so a disagreement "
  + "rolls the transaction back - which is why a short load can never "
  + "reach ARCHIVED and never counts towards completeness.",
};

// Three ways it fails, three different recoveries. The third is the one
// that bites.
export const FAIL_MODES = [
 { st: "QUARANTINED", when: "Pre-load validation failed.",
   raw: "No RAW rows were written.",
   fix: "Correct the file and revalidate. The registry record is reused "
      + "rather than duplicated.", sev: "warn" },
 { st: "FAILED", when: "A technical failure, or the RAW load itself failed.",
   raw: "The transaction rolled back, so RAW is unchanged.",
   fix: "Rerun after verifying RAW state. The registry record is reused.",
   sev: "warn" },
 { st: "ARCHIVE_FAILED", when: "RAW committed, then the file move failed.",
   raw: "RAW ALREADY HOLDS THE ROWS.",
   fix: "Retry the move ONLY. Never reload RAW - a reload here duplicates "
      + "a business date, and nothing downstream will tell you.",
   sev: "bad" },
];

// Where this path sits now, and what turns on the answer.
export const FILE_POSTURE = {
 q: "Live route, or recovery route?",
 b: "Under the events-primary posture the file set is described as "
  + "generated and held rather than loaded. That makes the file arm of the "
  + "completeness gate a recovery path rather than the daily one - and a "
  + "cold standby and a running second pipeline look very different on a "
  + "page and cost very different amounts to keep working.",
 turns: ["Whether the file arm of the gate is exercised every day or only "
         + "in recovery",
         "Whether a file-path defect is found by the next run or by the "
         + "first incident that needs it",
         "Whether the two routes must agree on a business date, and what "
         + "happens when they do not"],
};
