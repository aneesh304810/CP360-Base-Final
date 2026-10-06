// The SDC event path, end to end, with the network it actually runs on.
//
// WHY THE LOGICAL PATH WAS NOT ENOUGH. Every screen before this one draws
// the event path as actors and messages: SWP commits, SDC publishes, the
// listener consumes, the collapser folds, the puller re-reads, the gate
// fires. All true, and all of it silently assumes the puller can open a
// session to SEI's Snowflake. SEI's own network design says it cannot,
// not without work nobody has scheduled: the network policy admits SEI
// subnets and VPN only, and BBH's pods are in neither.
//
// SOURCE. SEI's "Cloud Infrastructure and Security Walkthrough", the SEI
// Data Cloud Network Security page. Structure and metadata only - no
// account identifiers, subscription names, subnet ranges, endpoint
// hostnames or credentials are recorded here or anywhere in this repo,
// and the slide itself is SEI's property and is not committed.
//
// THE TRAP THIS FILE EXISTS TO NAME. A Snowflake connection is not one
// network path, it is two. The SQL service takes one Private Link; PUT,
// GET and any large result set are served from Snowflake-managed blob
// storage over a SECOND Private Link. Provision only the first and a
// system passes every connectivity test, runs every small query, and
// then fails or silently leaves the private path the first time a result
// set is large enough to spill - which for a set-based puller reading a
// whole key set is the ordinary case, not the edge case.

export const SDC_NET_DOC = {
 n: "SEI Data Cloud Network Security",
 src: "SEI, Cloud Infrastructure and Security Walkthrough",
 w: "Snowflake tenancy reached over Azure Private Link from a paired "
  + "customer subscription, with Snowflake network policies restricting "
  + "who may connect at all.",
 note: "Read from the SEI walkthrough. Everything below is structure and "
     + "posture; no identifiers from it are recorded.",
};

// Three accounts, three subscriptions, three network paths. A single
// "the SDC endpoint" entry in configuration is wrong by construction.
export const SDC_ENVS = [
 { k: "DEV", n: "DEV", w: "Paired with its own Azure subscription" },
 { k: "IMPS", n: "IMPS", w: "Paired with its own Azure subscription" },
 { k: "PROD", n: "Prod", w: "Paired with its own Azure subscription" },
];

export const SDC_NET_FACTS = [
 { f: "Each Snowflake account is paired with its own Azure subscription",
   m: "Environment is part of the connection identity, not a parameter on "
    + "one endpoint. Three accounts means three private paths, three sets "
    + "of credentials and three network policies to be admitted to." },
 { f: "No firewall overlap from on-prem or Azure between the paired subscriptions",
   m: "A path proven in DEV proves nothing about Prod. Each has to be "
    + "built and tested on its own." },
 { f: "Dedicated VMs in each space run Golden Gate and release migration scripts",
   m: "SEI's own compute sits inside the permitted space. BBH's does not, "
    + "which is the whole of the problem below." },
 { f: "Snowflake network policies admit SEI subnets and VPN only",
   m: "This is an allow-list on the Snowflake account. A BBH pod presenting "
    + "any other source is refused before authentication, so no credential "
    + "or driver setting can work around it." },
];

// The four paths on SEI's diagram. Numbers are the slide's.
export const SDC_PATHS = [
 { n: 1, t: "Azure Private Link to the Snowflake SQL service",
   via: "Private endpoint in the customer VNet, into the Private Link Service",
   carries: "Every SQL session: authentication, queries, small result sets",
   lose: "No connectivity at all." },
 { n: 2, t: "The second private endpoint on the same service",
   via: "Private endpoint in the customer VNet",
   carries: "The paired path drawn alongside the first on SEI's diagram",
   lose: "Reduced to a single path, so no redundancy." },
 { n: 3, t: "Azure Private Link to Snowflake-managed blob storage",
   via: "Second private endpoint plus a storage service endpoint",
   carries: "Internal stage traffic: PUT, GET, and large result sets",
   lose: "THE ONE THAT GETS MISSED. Small queries succeed, so every "
       + "connectivity test passes. The first large result set then fails, "
       + "or leaves the private path - and a set-based puller reading a "
       + "whole key set is exactly that case." },
 { n: 4, t: "Cross-tenant VNet rules to customer blob or ADLS gen2",
   via: "Cross-tenant VNet rules on the customer's own storage",
   carries: "External stage traffic: COPY, external tables",
   lose: "No file-based exchange through an external stage." },
];

// The event path end to end. `net` is the question this file exists to
// ask: what network does this leg actually run on. `st` is how well that
// is known - settled, assumed by us, or open.
export const SDC_LEGS = [
 { n: 1, side: "SEI", a: "SWP", t: "Commits to the intake",
   w: "The book of record writes. Golden Gate and the migration scripts "
    + "run on SEI's dedicated VMs inside the paired subscription.",
   short: "Inside SEI's space",
   net: "Entirely inside SEI's space. Nothing of BBH's is involved.",
   st: "settled" },
 { n: 2, side: "SEI", a: "SDC", t: "Publishes on the domain topic",
   w: "A data event per changed row - eventid, key, op, view, no payload. "
    + "Markers 1000 and 1001 bracket the commit on every partition of "
    + "every subscribed topic.",
   short: "The topic transport is not on the network page",
   net: "SEI's network page covers the Snowflake account - Private Link, "
      + "storage paths, network policies. Where the event topics live, and "
      + "how a subscriber outside SEI's subnets reaches them, is not on it.",
   st: "open", ask: "Q1" },
 { n: 3, side: "BBH", a: "SDC Event Listener", t: "Consumes the topic",
   w: "M1. Long-running consumer, at-least-once, offsets owned by the "
    + "consumer group. Markers bracket the micro-batch.",
   short: "A held connection into SEI's space - not an API call",
   net: "A subscription is a held connection into SEI's space from a BBH "
      + "pod, opened once and kept. It is not a request, so it cannot "
      + "cross Apigee and it inherits none of the gateway's controls.",
   st: "open", ask: "Q1" },
 { n: 4, side: "BBH", a: "Key-Set Collapser", t: "Folds repeat keys",
   w: "M4. Many events on one key over a micro-batch window become one "
    + "key to read. This is what keeps the pull bounded.",
   short: "BBH-internal. No network question.",
   net: "BBH-internal. No network question.", st: "settled" },
 { n: 5, side: "BBH", a: "Set-Based Puller", t: "Re-reads current state",
   w: "M5. One bound, set-based retrieval per view per micro-batch - not "
    + "one call per event. The event named what changed; this reads it.",
   short: "A Snowflake session the network policy refuses - SEI subnets and VPN only",
   net: "A Snowflake driver session from a BBH pod into SEI's account. "
      + "This is the leg the network page refuses: the policy admits SEI "
      + "subnets and VPN only, and a BBH pod is neither. It also needs "
      + "Private Link path 3, because a whole key set is a large result "
      + "set and those are served from Snowflake-managed blob.",
   st: "open", ask: "Q2" },
 { n: 6, side: "BBH", a: "Intraday Stage-1 Loader", t: "Lands it in RAW",
   w: "M6. Writes what the puller read, under a micro-batch identity.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
 { n: 7, side: "BBH", a: "Micro-Batch Registry", t: "Records the micro-batch LOADED",
   w: "M13. The inbound twin of FILE_REGISTRY, and the thing the gate "
    + "counts. It does not exist yet.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
 { n: 8, side: "SEI", a: "SDC", t: "Publishes the EOD system event",
   w: "Event 2, batch date flip: end-of-day position and accrual "
    + "processing has completed. About once a day.",
   short: "Same transport as leg 2",
   net: "Same transport as leg 2, so the same open question.",
   st: "open", ask: "Q1" },
 { n: 9, side: "BBH", a: "Event Gate Evaluator", t: "Takes the date to TRIGGER",
   w: "M8. One guarded UPDATE, and the event arm needs BOTH every "
    + "micro-batch LOADED AND the EOD system event. Either alone "
    + "transforms a short Stage 1 that STG to INT still reconciles "
    + "against.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
];

// What the network page leaves open for BBH, and what each one blocks.
export const SDC_OPEN = [
 { id: "Q1", q: "How does a BBH consumer reach the SDC topic transport?",
   w: "The network page covers the Snowflake account - Private Link, "
    + "storage paths, network policies. It does not say where the event "
    + "topics live or how a subscriber outside SEI's subnets reaches "
    + "them. A topic subscription is a held connection, not a request, so "
    + "it cannot cross Apigee and inherits none of the gateway's controls.",
   blocks: "M1, M10, M11, M12, M16 - the entire event listener side",
   sev: "block" },
 { id: "Q2", q: "On what network does the puller's Snowflake session run?",
   w: "The policy admits SEI subnets and VPN only. A BBH OpenShift pod is "
    + "neither. Three ways out, and they are not equivalent: admit BBH "
    + "egress to the network policy, put BBH on the permitted VPN, or "
    + "give BBH its own paired subscription with its own private "
    + "endpoints. The third is the only one that does not depend on "
    + "BBH egress addressing staying stable.",
   blocks: "M5, and through it every intraday path",
   sev: "block" },
 { id: "Q3", q: "Is Private Link path 3 provisioned, or only path 1?",
   w: "Internal stage traffic - PUT, GET and large result sets - is "
    + "served from Snowflake-managed blob over its own Private Link. A "
    + "set-based pull of a key set is a large result set in the ordinary "
    + "case. Provision only the SQL path and every test passes until the "
    + "first real micro-batch.",
   blocks: "M5 at volume - and it will pass UAT before it fails",
   sev: "block" },
 { id: "Q4", q: "Three environments, three paths - who builds each?",
   w: "DEV, IMPS and Prod are separate accounts on separate subscriptions "
    + "with no firewall overlap between them. A path proven in DEV proves "
    + "nothing about Prod, and the environment is part of the connection "
    + "identity rather than a parameter on one endpoint.",
   blocks: "Promotion. A DEV-only path makes the pipeline undeployable",
   sev: "warn" },
 { id: "Q5", q: "Where do the Snowflake credentials live?",
   w: "The gateway review requires secrets to resolve from the platform "
    + "secret service and never from workflow metadata (GW-GAP-02). A "
    + "driver session that does not cross the gateway still has to meet "
    + "that standard, and nothing currently says it does.",
   blocks: "Nothing yet, but it is the same finding as GW-RISK-02",
   sev: "warn" },
];

// The point the four transports make together.
export const SDC_TRANSPORT_NOTE =
 "The context screen draws three transports and calls the gateway band a "
 + "wall every API crosses. The event path needs a fourth that crosses it "
 + "nowhere: a topic subscription and a Snowflake driver session are held "
 + "connections into SEI's network, not requests. They inherit none of the "
 + "gateway's mTLS, rate limiting, retry policy or single authoritative "
 + "log, and they are the primary inbound path.";

export const sdcLeg = (n) => SDC_LEGS.find((l) => l.n === n) || null;
export const SDC_BLOCKING = SDC_OPEN.filter((o) => o.sev === "block");
