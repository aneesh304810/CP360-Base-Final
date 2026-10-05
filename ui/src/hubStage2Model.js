// Stage 2 INT - the normalised SWP canonical model, as data.
//
// 52 tables, 10 domains, 38 SWP feeds, 1,452 attributes. Sources: the
// canonical data model workbook (keys and key roles) and the ERD draft
// (the domain diagrams). This file holds what they say; it does not
// improve on them.
//
// THE DISPLAYED KEY IS THE INT KEY, NOT THE DICTIONARY KEY. The INT
// contract makes the primary key the natural key PLUS BUSINESS_DATE, and
// BUSINESS_DATE is not in the dictionary at all. Render the dictionary key
// and every one of the 52 is wrong by a column - which is the same class of
// error that got the generated design documents withdrawn. intKey() exists
// so no caller has to remember.
//
// EVERY RELATIONSHIP IS IN ONE OF THREE STATES and the third is the
// interesting one: declared as a foreign key, not declared but covered by a
// proposed dbt relationships test, or enforced nowhere at all. 26 of 73 are
// in the third group. A dotted line in a PDF is a drawing convention; an
// unenforced join is an operational fact, and counting them per domain is
// what makes somebody act on it.

export const S2_DOMAINS = [
  { k:"PM", n:"Party Management",            c:11 },
  { k:"AP", n:"Account & Portfolio",         c:10 },
  { k:"AS", n:"Asset & Security Master",     c:3  },
  { k:"PH", n:"Positions & Holdings",        c:6  },
  { k:"TX", n:"Transactions & Cash Activity",c:7  },
  { k:"FB", n:"Fees & Billing",              c:4  },
  { k:"SC", n:"Statements & Communications", c:3  },
  { k:"IP", n:"Investment Product",          c:2  },
  { k:"OS", n:"Organization & Security",     c:3  },
  { k:"RC", n:"Reference & Configuration",   c:3  },
];
export const S2_ANCHORS = ["ACCOUNT","PORTFOLIO","ASSET","CLIENT"];

// [domain, table, dictionary pk, [[column, parent], ...], source sheet]
export const S2_TABLES = [
["PM","CLIENT","CLIENT_ID",[],"Client"],
["PM","CLIENT_ACCOUNT_LINKAGE","CLIENT_ID, ACCOUNT_ID, RELATIONSHIP",[["CLIENT_ID","CLIENT"],["ACCOUNT_ID","ACCOUNT"]],"Client Account Linkage"],
["PM","CLIENT_INVESTMENT_MANAGER",null,[["CLIENT_ID","CLIENT"]],"Client"],
["PM","CLIENT_RELATED_THIRD_PARTY",null,[["CLIENT_ID","CLIENT"]],"Client"],
["PM","CLIENT_SOLUTION",null,[["CLIENT_ID","CLIENT"]],"Client"],
["PM","CLIENT_TAX_PROFILE",null,[["CLIENT_ID","CLIENT"]],"Client"],
["PM","CLIENT_W8_PROFILE",null,[["CLIENT_ID","CLIENT"]],"Client"],
["PM","PARTY_CONTACT","CONTACT_IDENTIFIER, CONTACT_TYPE, ENTITY_IDENTIFIER",[["ENTITY_IDENTIFIER","CLIENT"]],"Contact Details"],
["PM","PARTY_OPTIONAL_FIELDS","PARTY_ID",[["PARTY_ID","CLIENT"]],"Party Optional Fields"],
["PM","PARTY_RELATIONSHIPS","RELATIONSHIP_IDENTIFIER, RELATIONSHIP_ROLE",[],"Relationships"],
["PM","PAY_TO_RECIPIENTS","ACCOUNT_NUMBER, ENTITY_ID, PAY_TO_METHOD, PROFILE_ID",[["ACCOUNT_NUMBER","ACCOUNT"]],"Pay To Recipients"],
["AP","ACCOUNT","ACCOUNT_ID",[],"Account"],
["AP","ACCOUNT_FEE_PACKAGE_ASSOCIATION","ACCOUNT_ID, FEE_PACKAGE_ID",[["ACCOUNT_ID","ACCOUNT"],["FEE_PACKAGE_ID","FEE_PACKAGE"]],"Account"],
["AP","ACCOUNT_INVESTMENT_GUIDELINES","ACCOUNT_ID, INVESTMENT_GUIDELINE_ID",[["ACCOUNT_ID","ACCOUNT"]],"Account"],
["AP","ACCOUNT_INVESTMENT_MANAGER","ACCOUNT_ID, INVESTMENT_MANAGER",[["ACCOUNT_ID","ACCOUNT"]],"Account"],
["AP","ACCOUNT_INVESTMENT_RESTRICTIONS","ACCOUNT_ID, INVESTMENT_RESTRICTIONS",[["ACCOUNT_ID","ACCOUNT"]],"Account"],
["AP","ACCOUNT_OPTIONAL_FIELDS","ACCOUNT_ID, ACCOUNT_NUMBER, ACCOUNT_OPTIONAL_FIELD_ID, ACCOUNT_OPTIONAL_FIELD_VALUE",[["ACCOUNT_ID","ACCOUNT"]],"Account Optional Fields"],
["AP","ACCOUNT_SOLUTION","ACCOUNT_ID, SOLUTION",[["ACCOUNT_ID","ACCOUNT"]],"Account"],
["AP","ACCOUNT_SPECIFIC_FEE","ACCOUNT_ID, ACCOUNT_SPECIFIC_FEE_TYPE",[["ACCOUNT_ID","ACCOUNT"]],"Account"],
["AP","PORTFOLIO","PORTFOLIO_ID",[["ACCOUNT_ID","ACCOUNT"]],"Portfolio"],
["AP","PORTFOLIO_GROUPS","GROUP_ID, GROUP_TYPE_ID",[["ACCOUNT_ID","ACCOUNT"]],"Portfolio Groups"],
["AS","ASSET","FIRM_ID, INSTRUMENT_ID",[],"Asset"],
["AS","ASSET_INVESTMENT_CLASS","SCHEMA_ID, TRD_INSTRUMENT_ID",[["TRD_INSTRUMENT_ID","ASSET"]],"Asset Investment Class"],
["AS","ASSET_OPTIONAL_FIELDS","ASSET_OPTIONAL_FIELD_DATA_ID",[["INSTRUMENT_ID","ASSET"]],"Asset Optional Fields"],
["PH","ACTIVE_COMMITS_AND_BLOCKS","ACCOUNT_NUMBER, FIRM_ID, PORTFOLIO_ID, TRD_INSTRUMENT_ID",[["ACCOUNT_NUMBER","ACCOUNT"],["PORTFOLIO_ID","PORTFOLIO"],["TRD_INSTRUMENT_ID","ASSET"]],"Active Commits and Blocks"],
["PH","CUSTODY_AND_NOSTRO_POS","ACCOUNT_NUMBER, INSTRUMENT_ID, ISO_3_CHARACTER_CCY, PORTFOLIO_ID, POSITION_TYPE, POSK_ID, TRADING_PARTNER_ACCOUNT_NAME, TRADING_PARTNER_ACCOUNT_NUMBER",[["ACCOUNT_NUMBER","ACCOUNT"],["INSTRUMENT_ID","ASSET"],["PORTFOLIO_ID","PORTFOLIO"]],"Custody And Nostro Pos"],
["PH","END_OF_DAY_POSITIONS","AS_OF_DATE, TAXLOT_PORTFOLIO_ID, TRD_INSTRUMENT_ID",[["TAXLOT_PORTFOLIO_ID","PORTFOLIO"],["TRD_INSTRUMENT_ID","ASSET"]],"End of Day Positions"],
["PH","END_OF_PERIOD_VALUE_AGG","ACCOUNT_NUMBER, FIRM_ID",[["ACCOUNT_NUMBER","ACCOUNT"]],"End of Period Value Agg"],
["PH","FX_FORWARD_POSITION","COUNTER_CURR, PORTFOLIO_ID, PROCESSING_DATE, REFERENCE_CURR",[["ACCOUNT_ID","ACCOUNT"],["PORTFOLIO_ID","PORTFOLIO"]],"FX Forward Position"],
["PH","TAXLOT","TAXLOT_ID",[["INSTRUMENT_ID","ASSET"],["PORTFOLIO_ID","PORTFOLIO"]],"Taxlot"],
["TX","RECURRING_CASH_ACTIVITY","ACCOUNT_NUMBER, NEXT_ACTIVITY_ID, PORTFOLIO_ID, PROCESSING_SCHEDULE_ID",[["ACCOUNT_NUMBER","ACCOUNT"],["PORTFOLIO_ID","PORTFOLIO"]],"Recurring Cash Activities"],
["TX","TRANSACTION_DETAIL","TRANSACTION_DETAIL_ID",[["TRANSACTION_ID","TRANSACTION_HEADER"]],"Transaction Detail"],
["TX","TRANSACTION_DETAIL_ADJUSTMENT_TYPE","ADJUSTMENT_TYPE, TRANSACTION_DETAIL_ID",[["TRANSACTION_DETAIL_ID","TRANSACTION_DETAIL"]],"Transaction Detail"],
["TX","TRANSACTION_HEADER","TRANSACTION_ID",[],"Transaction Header"],
["TX","TRANSACTION_HEADER_ADJUSTMENT_TYPE","ADJUSTMENT_TYPE, TRANSACTION_ID",[["TRANSACTION_ID","TRANSACTION_HEADER"]],"Transaction Header"],
["TX","TRANSACTION_HEADER_RELATED_TRANSACTION","TRANSACTION_ID, RELATED_TRANSACTION_ID",[["RELATED_TRANSACTION_ID","TRANSACTION_HEADER"]],"Transaction Header"],
["TX","UPCOMING_CASH_ACTIVITIES","ACCOUNT_NUMBER, ACTIVITY_REF, ACTIVITY_TYPE, PORTFOLIO_ID",[["ACCOUNT_NUMBER","ACCOUNT"],["PORTFOLIO_ID","PORTFOLIO"]],"Curr Upcoming Activities"],
["FB","FEE_COMPUTATION","COMPUTATION_ACTIVITY_ID, FEE_BASIS, RULE_DESCRIPTION",[],"Fee Computation"],
["FB","FEE_GROUP","FEE_GROUP_MEMBER_ACCOUNT, FEE_GROUP_MEMBER_ACCOUNT_PORTFOLIO",[["FEE_GROUP_MEMBER_ACCOUNT","ACCOUNT"],["FEE_GROUP_MEMBER_ACCOUNT_PORTFOLIO","PORTFOLIO"]],"Fee Group"],
["FB","FEE_PACKAGE","FEE_PACKAGE_PROFILE_ID, FEE_RULE_ID",[],"Fee Package"],
["FB","FEE_PACKAGE_USAGE","FEE_PACKAGE_USAGE_ID",[],"Fee Package Usage"],
["SC","STATEMENT_EVENT","STATEMENT_EVENT_ID",[],"Statement Event"],
["SC","STATEMENT_EVENT_INSTANCE","STATEMENT_EVENT_INSTANCE_ID",[["STATEMENT_EVENT_ID","STATEMENT_EVENT"]],"Statement Event Instance"],
["SC","STATEMENT_PACKAGE","STATEMENT_PACKAGE_ID",[],"Statement Package"],
["IP","MODEL","MODEL_ID",[],"Model"],
["IP","MODEL_ALLOCATION","ALLOCATION_ID",[["MODEL_ID","MODEL"]],"Model Allocation"],
["OS","ROLE_DETAILS","ACCESS_TYPE, FUNCTION, ROLE_ID, TARGET_TYPE",[],"Role Details"],
["OS","USER_DETAIL","ENTITY_ID",[],"User Detail"],
["OS","USER_TEAM_AND_ROLE","EMPLOYEE_ROLE_ID, EMPLOYEE_TEAM_ID, ENTITY_ID",[],"User Team and Role"],
["RC","FUND_CUTOFF_TIMES",null,[],"Fund Cutoff Times"],
["RC","INTEREST_RATES",null,[],"Interest Rates"],
["RC","REFERENCE",null,[],"Reference"],
];

// Relationships the ERD draws but the dictionary does not declare as
// foreign keys. [child, parent, label]
export const S2_INFERRED = [
 ["TRANSACTION_HEADER","ACCOUNT","transacts"],
 ["TRANSACTION_HEADER","ASSET","traded"],
 ["TRANSACTION_HEADER","PAY_TO_RECIPIENTS","paid to"],
 ["TRANSACTION_HEADER","TAXLOT","creates lot"],
 ["TRANSACTION_DETAIL","PORTFOLIO","impacts"],
 ["STATEMENT_EVENT","ACCOUNT","receives"],
 ["STATEMENT_EVENT","STATEMENT_PACKAGE","defines"],
 ["STATEMENT_EVENT","PORTFOLIO_GROUPS","group receives"],
 ["STATEMENT_EVENT_INSTANCE","CLIENT","tax reporting"],
 ["FEE_PACKAGE_USAGE","FEE_PACKAGE","used by"],
 ["FEE_PACKAGE_USAGE","ACCOUNT","uses package"],
 ["FEE_PACKAGE_USAGE","FEE_GROUP","uses package"],
 ["FEE_COMPUTATION","FEE_PACKAGE_USAGE","computed from"],
 ["USER_TEAM_AND_ROLE","USER_DETAIL","assigned"],
 ["USER_TEAM_AND_ROLE","ROLE_DETAILS","EMPLOYEE_ROLE_ID = ROLE_ID"],
 ["ACCOUNT","MODEL","assigned to"],
 ["PORTFOLIO","MODEL","assigned to"],
 ["PORTFOLIO_GROUPS","PORTFOLIO","grouped in"],
 ["MODEL_ALLOCATION","ASSET","allocated to"],
 ["MODEL_ALLOCATION","MODEL_ALLOCATION","parent of"],
 ["ASSET","ASSET","RELATED_INSTRUMENT_ID (underlying)"],
 ["CLIENT_RELATED_THIRD_PARTY","CLIENT","related to"],
 ["PARTY_RELATIONSHIPS","CLIENT","primary entity"],
 ["TAXLOT","END_OF_DAY_POSITIONS","detailed by"],
 ["INTEREST_RATES","ASSET","rated"],
 ["FUND_CUTOFF_TIMES","ASSET","cutoff for"],
];

// Relationships the INT contract proposes as dbt relationships tests,
// keyed CHILD|COLUMN. A failure writes to DQ_VALIDATION_FAILURE, so these
// edges are enforced at runtime even where no FK is declared.
export const S2_TESTED = new Set([
 "CLIENT_ACCOUNT_LINKAGE|CLIENT_ID","CLIENT_ACCOUNT_LINKAGE|ACCOUNT_ID",
 "PORTFOLIO|ACCOUNT_ID",
 "END_OF_DAY_POSITIONS|TAXLOT_PORTFOLIO_ID","END_OF_DAY_POSITIONS|TRD_INSTRUMENT_ID",
 "TAXLOT|PORTFOLIO_ID","TAXLOT|INSTRUMENT_ID",
 "TRANSACTION_DETAIL|TRANSACTION_ID",
 "STATEMENT_EVENT_INSTANCE|STATEMENT_EVENT_ID",
 "MODEL_ALLOCATION|MODEL_ID",
 "ACCOUNT_FEE_PACKAGE_ASSOCIATION|FEE_PACKAGE_ID",
]);

// What the two source artifacts disagree about or leave undefined.
// block: true means a downstream build cannot proceed until it is settled.
export const S2_GAPS = [
 {n:1, block:true,  on:["ACCOUNT"], g:"ACCOUNT primary key differs between the dictionary sheet (ACCOUNT_NUMBER) and the domain sheet (ACCOUNT_ID). Children join on either.", r:"Keep ACCOUNT_ID as PK, declare ACCOUNT_NUMBER a unique alternate key."},
 {n:2, block:true,  on:["ASSET"], g:"ASSET PK is FIRM_ID + INSTRUMENT_ID, but positions and classifications reference TRD_INSTRUMENT_ID, and FIRM_ID is nullable.", r:"Decide the asset grain — global or trading-level. Declare TRD_INSTRUMENT_ID a UK and make PK columns NOT NULL."},
 {n:3, block:false, on:["PARTY_CONTACT"], g:"Called PARTY_ADDRESS in the dictionary sheet and PARTY_CONTACT in the domain sheet and ERD.", r:"Standardise on PARTY_CONTACT."},
 {n:4, block:false, on:["ACCOUNT_INVESTMENT_GUIDELINES","ACCOUNT_INVESTMENT_MANAGER"], g:"In the Account domain sheet these rows are labelled ACCOUNT_FEE_PACKAGE_ASSOCIATION.", r:"Correct the table labels."},
 {n:5, block:true,  on:["CLIENT_INVESTMENT_MANAGER","CLIENT_RELATED_THIRD_PARTY","CLIENT_SOLUTION","CLIENT_TAX_PROFILE","CLIENT_W8_PROFILE","FUND_CUTOFF_TIMES","INTEREST_RATES","REFERENCE"], g:"No primary key defined for 8 tables — 5 Party children and all 3 Reference tables.", r:"Define composite keys. Without one there is no INT merge key and no partition identity."},
 {n:6, block:true,  on:["PARTY_CONTACT","CLIENT_ACCOUNT_LINKAGE","TAXLOT","MODEL_ALLOCATION","USER_DETAIL","FEE_PACKAGE_USAGE","ROLE_DETAILS"], g:"PK columns marked nullable.", r:"Make NOT NULL or replace with a stable key."},
 {n:7, block:false, on:["ACCOUNT_FEE_PACKAGE_ASSOCIATION","FEE_PACKAGE"], g:"The FK points at FEE_PACKAGE, whose PK is FEE_PACKAGE_PROFILE_ID + FEE_RULE_ID — so the FK is to half a key.", r:"Align to FEE_PACKAGE_PROFILE_ID, or split a package header from its rules."},
 {n:8, block:false, on:["FEE_GROUP","FEE_COMPUTATION","FEE_PACKAGE_USAGE"], g:"Fee Group is referenced by FEE_GROUP_NAME, which is not a key.", r:"Introduce FEE_GROUP_ID."},
 {n:9, block:false, on:[], g:"Many logical relationships are not declared foreign keys.", r:"Declare them, or confirm they are intentionally loose. Shown as inferred edges throughout."},
 {n:10,block:false, on:["FEE_COMPUTATION","FEE_GROUP"], g:"The ERD coverage page lists FEE_COMPUTATION twice and omits FEE_GROUP.", r:"Correct the coverage slide and recheck per-domain attribute counts."},
 {n:11,block:false, on:["ACCOUNT_OPTIONAL_FIELDS","FEE_COMPUTATION","CUSTODY_AND_NOSTRO_POS"], g:"Composite primary keys with free-text members.", r:"Replace text members with identifiers where available."},
 {n:12,block:true,  on:[], g:"BUSINESS_DATE and the lineage columns are not in the canonical dictionary but are required by the INT contract — so every dictionary key is short by one column.", r:"Add the standard INT columns to all 52 tables. This mockup already renders the effective INT key, not the dictionary key."},
];

export const S2_CONTRACT = [
 ["Input","STG view rows where DQ_STATUS_CD = PASS, plus approved mapping tables"],
 ["Materialization","dbt incremental table, partitioned by BUSINESS_DATE"],
 ["Primary key","Natural key from the dictionary PLUS BUSINESS_DATE"],
 ["Surrogate keys","Not generated here. Gold sequences such as ACCOUNT_KEY are never used in INT"],
 ["Retention","7 days, by partition drop"],
 ["Transformation DQ","Unmapped codes, ambiguous mappings and unresolved relationships raise DQ_VALIDATION_FAILURE"],
 ["Replay","OPEN, reprocess-eligible rows are re-selected by key plus BUSINESS_DATE"],
 ["Reconciliation","STG PASS count = INT count, per table per BUSINESS_DATE, boundary STG_TO_INT"],
];

// Not in the canonical dictionary; required by the INT contract. This is
// gap 12, and it is why intKey() exists.
export const S2_STD_COLS = [
 ["BUSINESS_DATE","date","partition and key part"],
 ["SRC_RECORD_ID","number","RAW lineage"],
 ["FILE_REGISTRY_ID","number","file lineage"],
 ["MICRO_BATCH_ID","number","event lineage — the event path's equivalent"],
 ["LOAD_TS","timestamp","load time"],
 ["DBT_INVOCATION_ID","varchar","run audit"],
];

const BY_NAME = {};
S2_TABLES.forEach((r) => { BY_NAME[r[1]] = r; });
export const s2Table = (n) => BY_NAME[n] || null;
export const s2DomainOf = (n) => (BY_NAME[n] ? BY_NAME[n][0] : null);
export const s2DomainName = (k) =>
 (S2_DOMAINS.find((d) => d.k === k) || {}).n || k;
export const s2IsAnchor = (n) => S2_ANCHORS.indexOf(n) >= 0;

// The effective INT key. Never render r[2] directly.
export const s2IntKey = (r) =>
 (r && r[2]) ? r[2] + ", BUSINESS_DATE"
             : "BUSINESS_DATE only - no dictionary key defined";

// An eight-column key makes one card four times the height of its
// neighbours and the row stops being scannable.
export const s2ShortKey = (r) => {
 const p = s2IntKey(r).split(", ");
 return p.length <= 4 ? p.join(", ")
  : p.slice(0, 3).join(", ") + " +" + (p.length - 3) + " more";
};

const DECLARED = [];
S2_TABLES.forEach((r) => (r[3] || []).forEach((f) => DECLARED.push({
 child: r[1], col: f[0], parent: f[1], label: "declared FK", kind: "fk",
 tested: S2_TESTED.has(r[1] + "|" + f[0]) })));
const INF = S2_INFERRED.map((i) => ({ child: i[0], parent: i[1], col: null,
 label: i[2], kind: "inf", tested: false }));
export const S2_RELS = DECLARED.concat(INF);

// A relationship belongs to the domain that owns the CHILD - the side that
// carries the column. Counting both sides makes every domain look busy and
// double-counts every cross-domain join.
export const s2RelsOwned = (k) =>
 S2_RELS.filter((r) => s2DomainOf(r.child) === k);
export const s2RelsInto = (k) => S2_RELS.filter((r) =>
 s2DomainOf(r.parent) === k && s2DomainOf(r.child) !== k);
export const s2GapsOn = (n) => S2_GAPS.filter((g) => g.on.indexOf(n) >= 0);
export const s2Blocked = (n) => s2GapsOn(n).some((g) => g.block);
export const s2TablesIn = (k) => S2_TABLES.filter((r) => r[0] === k);
export const S2_INFERRED_COUNT = S2_RELS.filter((r) => r.kind === "inf").length;
