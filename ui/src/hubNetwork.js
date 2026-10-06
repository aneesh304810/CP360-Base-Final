// The end-to-end network, for the security, infrastructure and network
// engineering teams.
//
// WHO THIS IS FOR AND WHY IT IS NOT THE EVENT SCREEN. The SDC screen
// walks the event path and annotates each leg with its network. This one
// inverts that: zones, links, mechanisms, directions, owners. A network
// engineer does not want the business flow, they want the list of things
// that have to exist in a firewall, a route table, a private DNS zone and
// an allow-list - and which of them already do.
//
// THREE STATES, AND THE THIRD IS THE POINT. A link is `live` where a
// document establishes it, `design` where this programme has designed it
// but nothing is provisioned, and `open` where nobody has yet said how it
// would work at all. Drawing all three alike is how a review concludes
// that the network is finished.
//
// WHAT IS GENUINELY NOT KNOWN. The HA and DR section of the architecture
// supplement lists "availability-zone and site topology for the
// Integration Hub and OpenShift runtime" as not established. So whether
// BBH's runtime sits in Azure, on-premises, or both is an open question
// rather than something this file may assume. Every link that depends on
// the answer is marked, and U1 states it as the question it is.
//
// SOURCES. SEI's Cloud Infrastructure and Security Walkthrough for the
// Snowflake side; the CP360 architecture supplement and the
// CP-Integration-Gateway readiness review for the BBH side. Structure and
// posture only: no IP ranges, subnet masks, hostnames, endpoint FQDNs,
// subscription or tenant identifiers, or credentials are recorded here.
// Ports are the protocol defaults a reviewer would expect, flagged as
// to-confirm rather than observed.

export const NET_DOC = {
 n: "End-to-end network",
 w: "Every connection between SEI, Snowflake, BBH and the consumers, "
  + "with the mechanism it uses and whether it exists.",
 aud: ["Security", "Infrastructure", "Network engineering"],
 note: "Structure and posture only. No addresses, hostnames or identifiers "
     + "from any source document are recorded. Ports are protocol defaults "
     + "to confirm, not observed values.",
};

export const NET_STATE = {
 live:   { n: "Established", c: "#159943",
           w: "A source document establishes it" },
 design: { n: "Designed, not provisioned", c: "#e67e22",
           w: "This programme has designed it; nothing is built" },
 open:   { n: "No mechanism agreed", c: "#c1113a",
           w: "Nobody has yet said how it would work" },
};

// Zones are drawn; the detail lives on the links.
export const NET_ZONES = [
 { id: "sei", n: "SEI estate", own: "SEI", col: 0, row: 0,
   w: "SWP, the extract and loader services, and the dedicated VMs that "
    + "run Golden Gate and the release migration scripts.",
   holds: ["SWP", "SEI PS loader", "SFTP extract", "Momentum",
     "Dedicated VMs"] },
 // Dedicated, not shared. SEI stands this up for BBH, which makes topic
 // naming, ACLs and consumer-group ownership a joint design rather than
 // something BBH inherits from an existing estate.
 { id: "kafka", n: "SEI Kafka, built for BBH", own: "SEI", col: 1, row: 0,
   w: "The event transport. SEI provisions a Kafka for BBH; the listener "
    + "consumes from it. This is what Q1 was asking about and it is now "
    + "answered in mechanism - what remains open is the network path to "
    + "it and how a consumer authenticates.",
   holds: ["Domain topics", "Markers 1000 and 1001", "Consumer group offsets"],
   isNew: true },
 { id: "snow", n: "Snowflake tenant - SDC", own: "Snowflake, under SEI",
   col: 1, row: 1,
   w: "One account per environment, each paired with its own Azure "
    + "subscription. Network policies on the account decide who may "
    + "connect before any credential is checked.",
   holds: ["Private Link Service", "Snowflake compute", "Network policies",
     "Snowflake-managed blob"] },
 { id: "fabric", n: "Azure Private Link fabric", own: "Joint", col: 2, row: 0,
   w: "Private endpoints in a customer VNet, the private DNS zones that "
    + "make them resolve, and the cross-tenant VNet rules for external "
    + "stages.",
   holds: ["Private endpoints", "Private DNS zones", "Storage service endpoint",
     "Cross-tenant VNet rules"] },
 { id: "bbh", n: "BBH runtime", own: "BBH", col: 3, row: 0,
   w: "OpenShift carrying Airflow, dbt, the event listener, the puller "
    + "and the CP-Integration-Gateway, with Oracle and Exadata behind "
    + "them. Where this sits is U1.",
   holds: ["OpenShift", "Airflow and dbt", "CP-Integration-Gateway",
     "Oracle Stage 1 and 2", "Exadata Stage 3"], unsited: true },
 { id: "edge", n: "BBH edge and consumers", own: "BBH", col: 4, row: 0,
   w: "BBH Apigee, and the consumers that address the gateway in front "
    + "of it.",
   holds: ["BBH Apigee", "CRM and other consumers"] },
];

// Every connection, in the shape a firewall request is written in.
export const NET_LINKS = [
 { id: "N1", from: "sei", to: "snow", st: "live",
   w: "SWP commits to the Snowflake intake",
   mech: "Inside SEI's paired subscription",
   proto: "Snowflake driver", dir: "SEI to Snowflake",
   owner: "SEI", note: "No BBH involvement." },
 { id: "N2", from: "sei", to: "fabric", st: "live",
   w: "SEI VMs reach the Snowflake SQL service",
   mech: "Azure Private Link, private endpoint in the customer VNet",
   proto: "TLS 443, to confirm", dir: "SEI to Snowflake",
   owner: "SEI network", note: "Path 1 on SEI's diagram." },
 { id: "N3", from: "fabric", to: "snow", st: "live",
   w: "Internal stage traffic: PUT, GET and large result sets",
   mech: "Second Azure Private Link plus a storage service endpoint, to "
       + "Snowflake-managed blob",
   proto: "TLS 443, to confirm", dir: "both",
   owner: "SEI network",
   note: "Path 3. Separate from the SQL path and separately provisioned." },
 { id: "N4", from: "snow", to: "fabric", st: "live",
   w: "External stage traffic: COPY and external tables",
   mech: "Cross-tenant VNet rules on the customer's own blob or ADLS gen2",
   proto: "TLS 443, to confirm", dir: "Snowflake to customer storage",
   owner: "SEI network", note: "Path 4. Not used by the event path." },

 { id: "N5", from: "bbh", to: "kafka", st: "design", u: "Q1",
   w: "The event listener consumes the published topics",
   mech: "Kafka consumer, long-lived TCP to the broker set, reached over "
       + "Azure Private Link as on SEI's network page",
   proto: "Kafka over TLS, 9093 or equivalent, to confirm",
   dir: "BBH to SEI, inbound data",
   owner: "SEI provisions, BBH consumes",
   note: "A held connection to a broker set, not a request: it crosses no "
       + "gateway and inherits none of its controls. Reachability is to "
       + "every ADVERTISED broker, not just the bootstrap address - a "
       + "rule written from a connection string connects and then fails "
       + "on the first metadata refresh. Three environments, three "
       + "broker sets." },
 { id: "N6", from: "bbh", to: "fabric", st: "design", u: "Q2",
   w: "The puller reads the SDC view the event's tag selects",
   mech: "A Snowflake driver session. Needs a private endpoint reachable "
       + "from the BBH runtime AND admission to the Snowflake network "
       + "policy, which today admits SEI subnets and VPN only.",
   proto: "TLS 443, to confirm", dir: "BBH to Snowflake",
   owner: "BBH network, SEI admits",
   note: "A route and an admission are two controls. Private Link gives "
       + "the route; the account network policy decides whether the "
       + "connection is accepted once it arrives, and today it admits "
       + "SEI subnets and VPN only. This is the leg the whole "
       + "events-primary posture rests on." },
 { id: "N7", from: "bbh", to: "fabric", st: "design", u: "Q3",
   w: "The puller's large result sets",
   mech: "A second private endpoint to Snowflake-managed blob, as path 3",
   proto: "TLS 443, to confirm", dir: "both",
   owner: "BBH network",
   note: "Provision only the SQL path and every connectivity test passes "
       + "until the first real micro-batch." },

 { id: "N8", from: "edge", to: "sei", st: "live",
   w: "Hub calls out to the SEI APIs - data fetch and loader submit",
   mech: "CP-Integration-Gateway, then BBH Apigee, then out",
   proto: "HTTPS 443, mTLS and OAuth", dir: "BBH to SEI",
   owner: "BBH platform",
   note: "The identity SEI observes is Apigee's." },
 { id: "N9", from: "sei", to: "edge", st: "design",
   w: "SEI PS calls back with loader status and counts",
   mech: "Inbound through Apigee to the callback receiver",
   proto: "HTTPS 443", dir: "SEI to BBH",
   owner: "BBH platform",
   note: "M2. Designed; the receiver is not built." },
 { id: "N10", from: "sei", to: "bbh", st: "live",
   w: "The daily file set",
   mech: "SFTP, then Momentum copies complete files to the Landing Zone",
   proto: "SFTP 22, to confirm", dir: "SEI to BBH",
   owner: "BBH platform",
   note: "Standby under the event-primary posture, produced daily either way." },
 { id: "N11", from: "edge", to: "bbh", st: "live",
   w: "Consumers call the Hub",
   mech: "CP-Integration-Gateway is the only host a consumer addresses",
   proto: "HTTPS 443", dir: "consumer to BBH",
   owner: "BBH platform",
   note: "GW-GAP-01: the inbound trust boundary is not yet demonstrated "
       + "as enforced." },
 { id: "N12", from: "bbh", to: "bbh", st: "live",
   w: "Runtime to the data estate",
   mech: "In-cluster or in-datacentre, depending on U1",
   proto: "Oracle SQL*Net 1521 or 2484, to confirm", dir: "both",
   owner: "BBH platform", note: "Stage 1 and Stage 2." },
 { id: "N13", from: "bbh", to: "bbh", st: "design",
   w: "Stage 2 Oracle to Stage 3 Exadata",
   mech: "Database link or approved direct path - DEC-GAP-04 picks which",
   proto: "Oracle SQL*Net, to confirm", dir: "Stage 2 to Stage 3",
   owner: "BBH platform",
   note: "The mechanism is an open decision, so the network rule cannot "
       + "be written yet." },
];

// The routing rule, and the network question hiding inside it.
export const NET_TAG_ROUTE = {
 t: "The tag on the event selects the Snowflake target",
 w: "The listener consumes from the SEI Kafka, reads the tag on the "
  + "event, and connects to the SDC Snowflake that tag names. The event "
  + "is still a notification - nothing moves until the view is read - but "
  + "the destination is now data-driven rather than fixed.",
 why: "For a network engineer this is the whole sizing question. A fixed "
    + "destination is one private endpoint, one DNS record and one "
    + "network-policy admission. A tag-selected destination is one of "
    + "each PER DISTINCT TARGET the tag set can reach, and nothing yet "
    + "says how many that is. If a tag can select across accounts rather "
    + "than only across databases or schemas within one, the count "
    + "multiplies by three again for DEV, IMPS and Prod.",
 need: ["The closed set of tag values, and the Snowflake target each resolves to",
  "Whether a target varies by account, by database, by schema, or only by view",
  "Whether the mapping is configuration BBH holds or is carried on the event",
  "What the listener does with a tag it does not recognise"],
};

// The failure every Private Link rollout has at least once.
export const NET_DNS = {
 t: "A private endpoint without its private DNS zone is a public route",
 w: "A private endpoint gives the service a private address. It does not "
  + "change what the service's name resolves to. Without the matching "
  + "private DNS zone linked to the VNet doing the lookup, the client "
  + "resolves the public name, opens a public route, and succeeds - so "
  + "nothing fails and nothing alerts. The traffic simply is not on the "
  + "private path anyone believes it is on.",
 checks: ["A private DNS zone exists for each private-endpoint service",
  "It is linked to every VNet whose workloads resolve that name",
  "Conditional forwarders on any on-premises resolver point at it",
  "Resolution is tested FROM the workload, not from a jump host",
  "The test asserts a private address, not merely that the call succeeded"],
};

// What each team has to do. Grouped the way the work is actually assigned.
export const NET_WORK = [
 { team: "Network engineering",
   items: [
    "Decide and document where the BBH runtime sits - U1 blocks everything below",
    "Reachability to the SEI Kafka broker set, every broker and not only the bootstrap - advertised listeners decide this, not the bootstrap address",
    "Private endpoint to the Snowflake SQL service, reachable from the BBH runtime - one per distinct target the tag set can select, per U4",
    "Second private endpoint to Snowflake-managed blob for internal stage traffic",
    "Private DNS zones for both, linked to every resolving VNet, with on-premises forwarders if the runtime is on-premises",
    "Three of each: DEV, IMPS and Prod have no firewall overlap between them",
    "Routing and any ExpressRoute or VPN leg implied by the answer to U1"] },
 { team: "Security",
   items: [
    "Agree how BBH is admitted to the Snowflake network policy, which today admits SEI subnets and VPN only",
    "Decide whether the event listener's held connection is acceptable outside the gateway, and what compensates for the controls it does not inherit",
    "Close GW-GAP-01: demonstrate the inbound trust boundary on the consumer side",
    "Snowflake credentials in the platform secret service, never in workflow metadata - GW-GAP-02",
    "NetworkPolicy on the gateway workload, listed as required and not yet in place - GW-GAP-06",
    "Rotation evidence for any credential that may have been exposed - GW-RISK-02"] },
 { team: "Infrastructure",
   items: [
    "OpenShift egress identity: what source a BBH pod presents, and whether it is stable enough to allow-list",
    "Availability-zone and site topology for the Hub and the OpenShift runtime - open in the HA and DR section",
    "Oracle and Exadata placement relative to the runtime",
    "Connectivity smoke tests in the CI/CD gate that assert the private path, not just a 200"] },
 { team: "SEI",
   items: [
    "Where the Kafka brokers built for BBH sit, and how BBH reaches every broker rather than only a bootstrap address",
    "The authentication the Kafka expects - mTLS, SASL or OAuth - and who issues the credential",
    "Topic naming, ACLs, and whether BBH owns its consumer group offsets",
    "The closed set of tag values and the Snowflake target each one resolves to - U4",
    "Confirm whether path 3 is provisioned for the BBH-facing account, or only path 1",
    "Confirm which of the three admission routes for BBH is acceptable"] },
];

// Settled since the first draft of this file, and worth stating as
// settled: a reviewer who sees three open questions where there are two
// escalates the wrong one.
export const NET_SETTLED = [
 { t: "The event transport", w: "A Kafka SEI builds for BBH, with the "
   + "topics published to it. Not a shared estate BBH joins." },
 { t: "How BBH reaches it", w: "Azure Private Link, the same mechanism as "
   + "SEI's own page shows for the Snowflake account." },
 { t: "How the Snowflake target is chosen", w: "The tag on the event. "
   + "The listener reads it and the puller connects to the SDC Snowflake "
   + "it names." },
 { t: "How many environments", w: "Three - DEV, IMPS and Prod - each a "
   + "separate account on a separate subscription with no firewall "
   + "overlap between them." },
];

// Private Link as on SEI's page means BBH plays the "Customer Tenant and
// VNet" role on it: a BBH Azure VNet with private endpoints in it. What
// that does NOT settle is where the workloads doing the connecting sit
// relative to that VNet, which is the question the HA and DR section
// also leaves open.
export const NET_UNKNOWN = [
 { id: "U1", q: "Where do the OpenShift workloads sit relative to the VNet holding the private endpoints?",
   w: "Private Link puts the endpoints in a BBH VNet. If OpenShift runs "
    + "in that VNet, or one peered to it, the pods resolve and route "
    + "with nothing further. If it runs on-premises, every private "
    + "endpoint also needs a route and a DNS forwarder across whatever "
    + "joins the two. The HA and DR section lists site topology for the "
    + "Hub and the OpenShift runtime as not established, so this is not "
    + "yet answerable from any document.",
   blocks: "Routing and DNS for N5, N6 and N7" },
 { id: "U2", q: "What source does a BBH pod present, and is it stable?",
   w: "The Snowflake account network policy is an allow-list. Whatever "
    + "arrives over the private endpoint has to match it, and a pod's "
    + "egress identity is not automatically stable or distinct. This is "
    + "the half of Q2 that Private Link does not solve: a route is not "
    + "an admission.",
   blocks: "N6 - acceptance of the session once it arrives" },
 { id: "U3", q: "How many distinct Snowflake targets can a tag select?",
   w: "The listener routes on the tag, so the endpoint, DNS and "
    + "policy-admission count is the number of distinct targets the tag "
    + "set can reach, times three environments. One per environment is "
    + "right only if every tag resolves within a single account.",
   blocks: "Sizing the Private Link build" },
 { id: "U4", q: "What authenticates the Kafka consumer, and who issues it?",
   w: "Private Link carries the connection; it does not authenticate it. "
    + "mTLS, SASL or OAuth is a separate choice with a separate "
    + "credential lifecycle, three times over, and nothing has named it.",
   blocks: "N5 - and it is a second credential class the secret service "
         + "has to hold" },
];

export const netZone = (id) => NET_ZONES.find((z) => z.id === id) || null;
export const netLinksFor = (id) =>
 NET_LINKS.filter((l) => l.from === id || l.to === id);
export const NET_COUNTS = Object.keys(NET_STATE).reduce((a, k) => {
 a[k] = NET_LINKS.filter((l) => l.st === k).length; return a;
}, {});
