// The SDC event path, end to end, with the network it actually runs on.
//
// WHAT CHANGED, AND WHY THE SHAPE OF THE QUESTION MOVED. The event
// transport is a Kafka SEI builds for BBH and publishes the topics to;
// the listener reads the event, and the TAG on it selects which SDC
// Snowflake the puller then connects to. Access to both is over Private
// Link, as on SEI's network page. So almost nothing here is unknown any
// more - it is unbuilt, which is a different thing and a better one. The
// one genuinely unresolved item is whether the Snowflake account network
// policy admits what arrives over BBH's Private Link, because a route and
// an admission are two controls and the first does not imply the second.
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
 { n: 1, side: "SEI", reach: "sei", a: "SWP", t: "Commits to the intake",
   w: "The book of record writes. Golden Gate and the migration scripts "
    + "run on SEI's dedicated VMs inside the paired subscription.",
   short: "Inside SEI's space",
   net: "Entirely inside SEI's space. Nothing of BBH's is involved.",
   st: "settled" },
 { n: 2, side: "SEI", reach: "sei", a: "SDC", t: "Publishes on the domain topic",
   w: "A data event per changed row - eventid, key, op, view, no payload. "
    + "Markers 1000 and 1001 bracket the commit on every partition of "
    + "every subscribed topic.",
   short: "Published to a Kafka SEI builds for BBH",
   net: "SEI provisions a Kafka for BBH and publishes the topics to it. "
      + "The transport and the access mechanism are both settled - BBH "
      + "reaches it over Private Link, as on SEI's network page. What is "
      + "left is provisioning: three environments, and every broker "
      + "reachable rather than only a bootstrap address.",
   st: "design", ask: "Q1" },
 { n: 3, side: "BBH", reach: "sei", a: "SDC Event Listener", t: "Consumes the topic",
   w: "M1. Long-running consumer, at-least-once, offsets owned by the "
    + "consumer group. Markers bracket the micro-batch.",
   short: "Kafka consumer over Private Link - held, not a request",
   net: "A Kafka consumer holds a TCP connection to the broker set from a "
      + "BBH pod, over Private Link. It is not a request, so it crosses "
      + "Apigee nowhere and inherits none of the gateway's controls. "
      + "Reachability must cover every ADVERTISED broker, not just the "
      + "bootstrap address.",
   st: "design", ask: "Q1" },
 { n: 4, side: "BBH", reach: "bbh", a: "Key-Set Collapser", t: "Folds repeat keys",
   w: "M4. Many events on one key over a micro-batch window become one "
    + "key to read. This is what keeps the pull bounded.",
   short: "BBH-internal. No network question.",
   net: "BBH-internal. No network question.", st: "settled" },
 { n: 5, side: "BBH", reach: "sei", a: "Set-Based Puller", t: "Re-reads current state",
   w: "M5. One bound, set-based retrieval per view per micro-batch - not "
    + "one call per event. The tag on the event selects which SDC "
    + "Snowflake to connect to; the event named what changed, this "
    + "reads it.",
   short: "Snowflake over Private Link - three environments, and path 3 as well as path 1",
   net: "A Snowflake driver session from a BBH pod, over Private Link as "
      + "on SEI's network page. Two things follow and neither is "
      + "automatic: the account network policy has to admit whatever the "
      + "BBH end of that Private Link presents, and path 3 has to exist "
      + "as well as path 1, because a whole key set is a large result "
      + "set and those come from Snowflake-managed blob.",
   st: "design", ask: "Q2" },
 { n: 6, side: "BBH", reach: "bbh", a: "Intraday Stage-1 Loader", t: "Lands it in RAW",
   w: "M6. Writes what the puller read, under a micro-batch identity.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
 { n: 7, side: "BBH", reach: "bbh", a: "Micro-Batch Registry", t: "Records the micro-batch LOADED",
   w: "M13. The inbound twin of FILE_REGISTRY, and the thing the gate "
    + "counts. It does not exist yet.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
 { n: 8, side: "SEI", reach: "sei", a: "SDC", t: "Publishes the EOD system event",
   w: "Event 2, batch date flip: end-of-day position and accrual "
    + "processing has completed. About once a day.",
   short: "Same Kafka as leg 2",
   net: "Published to the same Kafka as leg 2, so the same provisioning.",
   st: "design", ask: "Q1" },
 { n: 9, side: "BBH", reach: "bbh", a: "Event Gate Evaluator", t: "Takes the date to TRIGGER",
   w: "M8. One guarded UPDATE, and the event arm needs BOTH every "
    + "micro-batch LOADED AND the EOD system event. Either alone "
    + "transforms a short Stage 1 that STG to INT still reconciles "
    + "against.",
   short: "BBH Oracle. Inside BBH.",
   net: "BBH Oracle. Inside BBH.", st: "settled" },
];

// What the network page leaves open for BBH, and what each one blocks.
export const SDC_OPEN = [
 { id: "Q1", q: "Is the Kafka provisioned, in all three environments?",
   w: "Settled: SEI builds a Kafka for BBH, publishes the topics to it, "
    + "and BBH reaches it over Private Link. What is left is build. A "
    + "Kafka client needs every ADVERTISED broker reachable, not just the "
    + "bootstrap address - a firewall rule written from a connection "
    + "string connects, then fails on the first metadata refresh. Three "
    + "SDC environments means three broker sets, three private "
    + "endpoints and three sets of topic ACLs.",
   blocks: "M1, M10, M11, M12, M16 - the entire event listener side",
   sev: "warn" },
 { id: "Q2", q: "Does the network policy admit the BBH Private Link?",
   w: "A private endpoint gives BBH a route. The account network policy "
    + "decides whether the connection is accepted once it arrives, and "
    + "today it admits SEI subnets and VPN only. These are two separate "
    + "controls and provisioning the first does not satisfy the second: "
    + "the session is refused before authentication, so no credential or "
    + "driver setting can work around it.",
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
 { id: "Q4", q: "How many Snowflake targets can a tag select?",
   w: "The listener routes on the tag, so the number of endpoints, DNS "
    + "records and policy admissions is the number of distinct targets "
    + "the tag set can reach, times three for DEV, IMPS and Prod. One "
    + "endpoint per environment is the answer only if every tag resolves "
    + "within a single account.",
   blocks: "Sizing the Private Link build",
   sev: "warn" },
 { id: "Q5", q: "Where do the Kafka and Snowflake credentials live?",
   w: "The gateway review requires secrets to resolve from the platform "
    + "secret service and never from workflow metadata (GW-GAP-02). "
    + "Neither of these crosses the gateway, and both still have to meet "
    + "that standard. Three environments means three sets, and the Kafka "
    + "credential is a second kind - mTLS, SASL or OAuth - that nothing "
    + "has yet named.",
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
