// SWP feed -> Stage 1 RAW -> Stage 2 canonical table.
//
// THE CHAIN NOBODY HAS DRAWN. The canonical model names 38 source sheets.
// The architecture names 7 RAW tables. Neither document publishes the map
// between them: the only real mapping is
// FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE, which is configuration rather than
// a published list, and the dbt design document names three RAW tables
// and stops. So the chain from a file to a canonical table exists only in
// somebody's head, and this file is an attempt to write it down.
//
// THE MAPPING IS INFERRED AND SAYS SO, EVERYWHERE. Every feed carries one
// of three confidences and the screen shows which:
//
//   named   the feed's noun IS a RAW table the architecture names
//   likely  the feed extends such a noun - optional fields on an entity
//           whose RAW table is named, or a position-shaped feed where
//           RAW_POSITION is the only candidate
//   none    no RAW table is named for it anywhere, by either document
//
// "none" is not a gap in this file. It is the finding: 23 of 38 feeds have
// no Stage 1 landing table named in either document, and two of them -
// Asset and Portfolio - are anchors of the Stage 2 model. If ASSET has no
// RAW table, the whole Asset and Security Master domain has no described
// inbound path, and nothing downstream notices because nothing downstream
// asks for a table that was never modelled.
//
// It is derived from hubStage2Model's own source-sheet column, so the feed
// list cannot drift away from the canonical model it feeds.

import { S2_TABLES, s2DomainOf, s2DomainName } from "./hubStage2Model.js";

export const RAW_CONF = {
 named:  { n: "named", w: "the architecture names this RAW table" },
 likely: { n: "likely", w: "inferred - extends an entity whose RAW table is named" },
 none:   { n: "none", w: "no RAW table named for it by either document" },
};

// sheet -> [RAW table, confidence]. Everything absent from here is "none".
const RAW_OF = {
 "Account":                   ["RAW_ACCOUNT", "named"],
 "Client":                    ["RAW_CLIENT", "named"],
 "Transaction Header":        ["RAW_TRANSACTION", "named"],
 "Transaction Detail":        ["RAW_TRANSACTION", "named"],
 "Taxlot":                    ["RAW_TAXLOT", "named"],
 "End of Day Positions":      ["RAW_POSITION", "named"],
 "Account Optional Fields":   ["RAW_ACCOUNT", "likely"],
 "Client Account Linkage":    ["RAW_CLIENT", "likely"],
 "Contact Details":           ["RAW_CLIENT", "likely"],
 "Party Optional Fields":     ["RAW_CLIENT", "likely"],
 "Relationships":             ["RAW_CLIENT", "likely"],
 "Custody And Nostro Pos":    ["RAW_POSITION", "likely"],
 "FX Forward Position":       ["RAW_POSITION", "likely"],
 "Active Commits and Blocks": ["RAW_POSITION", "likely"],
 "End of Period Value Agg":   ["RAW_POSITION", "likely"],
};

// The two correction tables the architecture names have no source sheet at
// all - corrections arrive as a re-delivery, not as a feed of their own,
// and which of those two readings is right is conflict C4.
export const RAW_WITHOUT_FEED = ["RAW_CORRECTED_TRANSACTION", "RAW_CORRECTED_POSITION"];

const build = () => {
 const by = {};
 S2_TABLES.forEach((r) => {
  const sheet = r[4];
  if (!by[sheet]) {
   const m = RAW_OF[sheet];
   by[sheet] = { feed: sheet, raw: m ? m[0] : null, conf: m ? m[1] : "none",
     tables: [], domains: new Set() };
  }
  by[sheet].tables.push(r[1]);
  by[sheet].domains.add(r[0]);
 });
 return Object.values(by)
  .map((f) => ({ ...f, domains: [...f.domains] }))
  .sort((a, b) => a.feed.localeCompare(b.feed));
};

export const FEEDS = build();

export const RAW_TABLES = [...new Set(FEEDS.map((f) => f.raw).filter(Boolean))]
 .sort();
export const feedsForRaw = (raw) => FEEDS.filter((f) => f.raw === raw);
export const feedsUnmapped = () => FEEDS.filter((f) => !f.raw);
export const feedByName = (n) => FEEDS.find((f) => f.feed === n) || null;
export const feedsForDomain = (k) => FEEDS.filter((f) => f.domains.indexOf(k) >= 0);
export const feedOfTable = (tbl) =>
 FEEDS.find((f) => f.tables.indexOf(tbl) >= 0) || null;

// The fan-out nobody expects: one feed can become seven canonical tables.
export const FAN_OUT = FEEDS.filter((f) => f.tables.length > 1)
 .sort((a, b) => b.tables.length - a.tables.length);

export const FEED_SUMMARY = {
 feeds: FEEDS.length,
 mapped: FEEDS.filter((f) => f.raw).length,
 named: FEEDS.filter((f) => f.conf === "named").length,
 likely: FEEDS.filter((f) => f.conf === "likely").length,
 none: FEEDS.filter((f) => f.conf === "none").length,
 anchorsUnmapped: ["ASSET", "PORTFOLIO"].filter((a) => {
  const f = feedOfTable(a);
  return f && !f.raw;
 }),
};
