// Stage 1 - the RAW data model.
//
// THERE IS NO CANONICAL MODEL HERE, AND THAT IS THE DESIGN. Stage 1 holds
// what arrived, in the shape it arrived in: one table per inbound
// interface, its DDL defined per interface rather than centrally, no keys
// declared, nothing cleaned and nothing rejected. The only columns Stage 1
// adds are the ones that say where a row came from and which day it
// belongs to. A reader who comes here looking for entities and
// relationships should leave knowing there deliberately are none.
//
// THE RAW TABLE LIST IS A LIVE DISAGREEMENT. The architecture names seven
// tables; the dbt design document names three. That is not a naming
// difference - four inbound feeds have no transformation designed for
// them at all, so if the architecture is right the design document covers
// under half the inbound surface. It is shown here as two columns rather
// than reconciled, because reconciling it is SEI's to do.

export const S1_SHAPE = {
 n: "One table per inbound interface",
 w: "The DDL is per interface, declared alongside the interface rather "
  + "than in a central model. FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE is what "
  + "routes a file to its table, which is why there is deliberately no "
  + "column-mapping table: the RAW table's own DDL is the schema contract.",
 ev: "ingest Glossary (p.25) - dbt section 4.1 (p.10)",
};

export const S1_RULES = [
 ["Append-only", "Rows are added, never updated in place. A corrected "
  + "delivery is a new row set for the same business date, not an edit."],
 ["No keys declared", "No primary key, no foreign key, no uniqueness. "
  + "Identity is asserted first in STG, and enforced first in INT."],
 ["Nothing cleaned", "No trimming, no casting beyond what the load needs, "
  + "no code translation. The first thing that reads a row's content is "
  + "the STG view."],
 ["Nothing rejected", "A row that will fail DQ still lands. Rejection is a "
  + "Stage 2 decision, so the evidence of what arrived survives it."],
 ["One transaction per file", "A file loads whole or not at all, and the "
  + "three counts must agree before the commit."],
];

// The only columns Stage 1 adds to what the file carried.
export const S1_COLS = [
 ["BUSINESS_DATE", "date", "which day this row belongs to - set from the "
  + "file, not from the clock"],
 ["SRC_RECORD_ID", "number", "the row's identity within its delivery, so a "
  + "DQ failure in Stage 2 can name the line it came from"],
 ["FILE_REGISTRY_ID", "number", "which delivery it arrived in - the join "
  + "back to the file, its counts and its archive path"],
 ["LOAD_TS", "timestamp", "when it landed"],
];

// Named in the architecture, named in the design document, or both.
// "both" is the only safe set to build against today.
export const S1_TABLES = [
 { n: "RAW_ACCOUNT",                arch: true, doc: true },
 { n: "RAW_CLIENT",                 arch: true, doc: true },
 { n: "RAW_TRANSACTION",            arch: true, doc: true },
 { n: "RAW_TAXLOT",                 arch: true, doc: false },
 { n: "RAW_POSITION",               arch: true, doc: false },
 { n: "RAW_CORRECTED_TRANSACTION",  arch: true, doc: false },
 { n: "RAW_CORRECTED_POSITION",     arch: true, doc: false },
];

export const S1_CONFLICT = {
 id: "C1",
 t: "Three RAW tables, or seven",
 w: "The architecture names seven. The dbt design document names three - "
  + "account, client and transaction. Position, tax lot and the two "
  + "correction tables do not appear in it at all.",
 why: "Four of the seven feeds have no transformation designed for them. "
    + "If the architecture is right, the design document covers under half "
    + "the inbound surface, and the gap is invisible from Stage 2 because "
    + "nothing downstream asks for a table that was never modelled.",
};

// What Stage 1 does NOT answer, so nobody goes looking.
export const S1_NOT_HERE = [
 "No entities and no relationships - the first normalised model is Stage 2 INT.",
 "No reference-code translation - codes land as delivered.",
 "No deduplication - a duplicate delivery is two row sets, told apart by "
 + "FILE_REGISTRY_ID.",
 "No retention rule is stated in either document for RAW, unlike INT's "
 + "seven days.",
];

export const s1Both = () => S1_TABLES.filter((t) => t.arch && t.doc).length;
export const s1ArchOnly = () => S1_TABLES.filter((t) => t.arch && !t.doc).length;
