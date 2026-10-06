// The context level: what crosses the boundary between SEI and BBH.
//
// THREE TRANSPORTS, FOUR CHANNELS, AND THE THIRD TRANSPORT IS A WALL.
// Events cross on SDC topics and files on SFTP/Momentum, each on its own
// pipe. Everything API-shaped - the data fetch, the loader push, the status
// coming back, and every consumer call - crosses through Apigee and the API
// Gateway. Drawing the gateway as a step inside the ingestion chain, which
// is the obvious thing to do, says the wrong thing twice: it hides that the
// loader and the consumers go through the same door, and it hides that the
// quota they share is the thing that can starve ingestion.
//
// ONE PATTERN, APPLIED FOUR TIMES. A thin signal on one transport, the
// payload on another. Inbound: the event says a row changed, the API
// fetches it. Outbound: the status API gives the verdict, a file carries
// the per-record detail. Readers who see the pattern stop re-reading the
// diagram.

// ONE TAXONOMY, THREE LEVELS. There were three before and they did not
// line up: four channels, six numbered lanes with one channel owning
// three of them, and three transports - then the network view added five
// flows. Four names for one thing is why nobody could say what "channel
// 4" meant.
//
//   CHANNEL    a purpose. Four of them, lettered A to D. This is the
//              unit a business reader argues about.
//   LEG        one directed hop inside a channel, numbered within it:
//              A1, A2, C3. This is the unit a diagram draws and an
//              engineer builds.
//   TRANSPORT  how a leg travels. A property of the leg, never a
//              parallel list.
//
// The network view's flows ARE the channels, so a link there and a leg
// here are the same object seen from two sides.
//
// AND THERE ARE FOUR TRANSPORTS, NOT THREE. The old count predated the
// Kafka and counted a Snowflake session as part of "the API". Both are
// held connections that cross the gateway nowhere, which is the whole
// reason the count was wrong in a way that mattered.

export const CHANNELS = [
  { id:"A", no:1, name:"Events", role:"primary", dir:"in", flow:"event",
    one:"SEI tells BBH a row changed; BBH reads the row.",
    detail:"The primary inbound path. A notification on one transport and the payload on another - the event never carries the change itself. Both legs are held connections into SEI's network rather than requests, so neither crosses the gateway.",
    src:"E360 \u00b7 Payload_Structure, Consumption_Guidance" },
  { id:"B", no:2, name:"Files", role:"standby", dir:"in", flow:"file",
    one:"The daily file set, produced every day and loaded only on recovery.",
    detail:"Under the event-primary posture this is generated each day but not loaded in the ordinary course. It is also the channel the loader's error detail comes back on, which is why it is not purely inbound-source.",
    src:"PACK \u00b7 File Ingestion Framework" },
  { id:"C", no:3, name:"Loader", role:"primary", dir:"loop", flow:"loader",
    one:"BBH data out to SEI, and the outcome back on two transports.",
    detail:"A round trip, not an arrow. The status API carries the verdict and the counts; the error file carries the per-record detail. The originating consumer cannot be answered until both are in and agree.",
    src:"PACK v5 + BBH decision" },
  { id:"D", no:4, name:"Consumer reads", role:"primary", dir:"loop",
    flow:"consumer",
    one:"A consumer that cannot wait for the pipeline reads through on demand.",
    detail:"One API and two callers: the same gateway and the same contract serve the pipeline's set-based pull and a consumer's interactive read. That sharing is what makes the quota question real.",
    src:"REVIEW \u00b7 M5 Set-Based Puller" },
];

// Every directed hop, numbered inside its channel. The context diagram
// draws these; the network view's links are the same hops with the
// firewall detail attached.
export const LEGS = [
  { id:"A1", ch:"A", no:1, name:"Change events", dir:"in",     y:120, crosses:true,
    sub:"notification only",
    transport:"kafka", role:"primary",
    one:"SEI tells BBH that a row changed. The event carries no data.",
    detail:"Four envelope fields \u2014 eventid (a type code, not a message id), key, op (I/U/D) and view \u2014 plus the tag that selects which SDC Snowflake to read. Published on domain topics in BBH's dedicated queue, at-least-once, ordered within topic and partition only.",
    hops:[
      ["SEI","SWP writes to the Snowflake intake"],
      ["SEI","SDC publishes to BBH's dedicated queue on SEI's Kafka"],
      ["BBH","Event listener consumes; markers 1000/1001 bracket each commit"],
      ["BBH","Key-set collapser folds repeat keys over the micro-batch window"]] },
  { id:"A2", ch:"A", no:2, name:"Set-based read", dir:"out",     y:178, crosses:true,
    sub:"the payload, on the tag",
    transport:"snowflake", role:"primary",
    one:"BBH reads the current state of the keys the events named.",
    detail:"One bound, set-based retrieval per view per micro-batch \u2014 not per event. The tag on the event selects the target. Not an API call: a driver session into SEI's Snowflake, which is why it crosses the gateway nowhere.",
    hops:[
      ["BBH","Set-based puller builds the key set for the view"],
      ["BBH","Driver session out over Private Link"],
      ["SEI","Snowflake returns current state for the set"]] },
  { id:"B1", ch:"B", no:1, name:"File delivery", dir:"in",     y:372, crosses:true,
    sub:"STANDBY - recovery route",
    transport:"file", role:"standby",
    one:"The daily file set. Generated and held as a recovery route.",
    detail:"SWP writes to SFTP, Momentum copies complete files to the Landing Zone, discovery runs every five minutes and maps one task per file. Validate, load RAW in one transaction, three counts must agree, archive.",
    hops:[
      ["SEI","SWP extract to SFTP"],
      ["SEI","Momentum copies complete files to the Landing Zone"],
      ["BBH","Scheduled discovery, one mapped task per file, validate, load, archive"]] },
  { id:"C1", ch:"C", no:1, name:"Loader submit", dir:"out",     y:270, crosses:true,
    sub:"BBH data out, through the gateway",
    transport:"api", role:"primary",
    one:"BBH data to SEI, through the gateway.",
    detail:"A consumer calls the Hub with the loader details and the data; the Hub validates it, maps it to SWP loader format, and calls the loader API out through the gateway.",
    hops:[
      ["BBH","Consumer calls the Hub API with loader details and data"],
      ["BBH","Validate, map to SWP loader format"],
      ["BBH","Call out through CP-Integration-Gateway and Apigee"]] },
  { id:"C2", ch:"C", no:2, name:"Status back", dir:"in",     y:305, crosses:true,
    sub:"verdict and counts",
    transport:"api", role:"primary",
    one:"The verdict and the counts, into Integration 360.",
    detail:"The only SEI-initiated API call inbound to BBH, so it is the only inbound API rule the loader needs. Designed; the receiver is not built.",
    hops:[
      ["SEI","SEI PS processes the loader"],
      ["SEI","Calls Integration 360 with status and counts"]] },
  { id:"C3", ch:"C", no:3, name:"Error detail", dir:"in",     y:408, crosses:true,
    sub:"which records, and why",
    transport:"file", role:"primary",
    one:"Which records failed, and why \u2014 as a file.",
    detail:"Per-record outcomes on the file transport. It must NOT join the expected daily set: a clean outbound day produces no file, and if it is an expected daily interface the inbound completeness set never empties and the business date never transforms.",
    hops:[
      ["SEI","Per-record outcomes written as a file"],
      ["BBH","Arrives on the file transport and is reconciled against the status counts"]] },
  { id:"C4", ch:"C", no:4, name:"Answer the consumer", dir:"out",     crosses:false,
    sub:"once status and detail agree",
    transport:"api", role:"primary",
    one:"The Hub calls the consumer back, once status and detail agree.",
    detail:"The direction nobody draws: the Hub calls the consumer, not the other way round. Egress to every consumer that submits a loader, and it cannot be sent until the status API and the error file agree.",
    hops:[
      ["BBH","Reconcile the status counts against the error file"],
      ["BBH","Call the consumer's own API with the outcome"]] },
  { id:"D1", ch:"D", no:1, name:"Consumer call", dir:"in",     crosses:false,
    sub:"the only host a consumer sees",
    transport:"api", role:"primary",
    one:"A consumer addresses the Hub.",
    detail:"CP-Integration-Gateway is the only host a consumer addresses; BBH Apigee is behind it and never visible. GW-GAP-01: the inbound trust boundary is not yet demonstrated as enforced.",
    hops:[
      ["BBH","Consumer calls the gateway"],
      ["BBH","Gateway applies the trust boundary and routes"]] },
  { id:"D2", ch:"D", no:2, name:"On-demand read", dir:"out",     y:235, crosses:true,
    sub:"one API, two callers",
    transport:"api", role:"primary",
    one:"The Hub reads SEI on demand for a consumer that cannot wait.",
    detail:"The same gateway and the same contract as the pipeline's pull. One API, two callers - and the shared quota between them is what can starve ingestion.",
    hops:[
      ["BBH","Gateway forwards the read"],
      ["SEI","SEI answers from current state"]] },
];

export const TRANSPORTS = [
 { id: "kafka", n: "SEI Kafka", sub: "BBH's dedicated queue on SEI's cluster",
   dir: "in", role: "primary", held: true },
 { id: "snowflake", n: "Snowflake session", sub: "driver, over Private Link",
   dir: "out", role: "primary", held: true },
 { id: "api",  n: "Gateway and Apigee", sub: "every API, both directions",
   dir: "both", role: "primary", held: false },
 { id: "file", n: "SFTP and Momentum", sub: "the daily set, and error detail back",
   dir: "in", role: "standby", held: false },
];

// The two that cross the gateway nowhere. Naming them together is the
// point: they are the primary inbound path AND the pair that inherits
// none of the gateway's controls.
export const HELD_TRANSPORTS = TRANSPORTS.filter((x) => x.held);

export const chanById = (id) => CHANNELS.find((c) => c.id === id) || null;
export const legById  = (id) => LEGS.find((l) => l.id === id) || null;
export const legsOf   = (ch) => LEGS.filter((l) => l.ch === ch);
export const transportOf = (l) =>
  TRANSPORTS.find((x) => x.id === (l && l.transport)) || null;

// TWO LAYERS, ONE DOOR. "Apigee + API Gateway" is one transport and two
// components: the CP-Integration-Gateway wraps BBH's Apigee network and is
// the only thing a consumer addresses, and the call still leaves through
// Apigee, which is the identity SEI observes. The design tracker carried
// that as an open conflict (AD-3) for months because nobody had written
// down that both descriptions are true from their own side.
//
// What the gateway buys, and what it costs. Both belong on the same screen:
// a single managed door is the right answer AND a shared quota that can
// starve the puller, and only naming the second gets the quota tiers built.
export const GATEWAY_NOTE = {
 buys: ["mTLS and OAuth to SEI in one place",
        "certificate and secret rotation in one place",
        "retry, circuit-breaker and payload masking policy",
        "rate limiting - where the key-set collapser's restraint is actually enforced",
        "one authoritative log for every integration call, in or out"],
 costs: "Shared door, shared quota. The puller is bursty and must not starve; "
      + "the loader has a window; interactive consumers are latency-sensitive "
      + "and unbounded in number. A consumer read-storm can eat the SEI quota, "
      + "ingestion stalls, and the completeness gate never fires.",
 fix: "Separate API products with their own quota tiers per caller class, "
    + "sharing the gateway but not the budget, with a reserved floor for the "
    + "ingestion puller that it cannot be squeezed below.",
};

