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

export const CHANNELS = [
  { id:"C1", no:1, name:"Change events", dir:"in", transport:"SDC topics",
    role:"primary", y:130, port:"A",
    one:"SEI tells BBH that a row changed. The event carries no data.",
    detail:"Four envelope fields — eventid (a type code, not a message id), key, op (I/U/D) and view. The event names what changed and where to read it; it never carries the change itself. Published on domain topics, at-least-once, ordered within topic and partition only.",
    legs:[
      ["SEI","SWP writes to the Snowflake intake; SDC publishes on the domain topic"],
      ["BBH","Event listener consumes; markers 1000/1001 bracket each commit"],
      ["BBH","Key-set collapser folds repeat keys over the micro-batch window"]],
    src:"E360 · Payload_Structure, Consumption_Guidance" },
  { id:"C2", no:2, name:"Data fetch API", dir:"out", transport:"Apigee + API Gateway",
    role:"primary", y:215, port:"B",
    one:"BBH reads the current state of the keys the events named.",
    detail:"One bound, set-based retrieval per view per micro-batch — not per event. The same gateway and the same contract also serve an on-demand real-time read for consumers that cannot wait for the pipeline: one API, two callers.",
    legs:[
      ["BBH","Set-based puller builds the key set for the view"],
      ["BBH","Call leaves through Apigee and the API Gateway"],
      ["SEI","SEI view API returns current state for the set"]],
    src:"REVIEW · M5 Set-Based Puller" },
  { id:"C3", no:3, name:"File delivery", dir:"in", transport:"SFTP / Momentum",
    role:"standby", y:360, port:"C",
    one:"The daily file set. Generated and held as a recovery route.",
    detail:"SWP writes to SFTP, Momentum copies complete files to the Landing Zone, discovery runs every five minutes and maps one task per file. Validate, load RAW in one transaction, three counts must agree, archive. Under the event-primary posture this is produced each day but not loaded in the ordinary course.",
    legs:[
      ["SEI","SWP extract to SFTP"],
      ["SEI","Momentum copies complete files to the Landing Zone"],
      ["BBH","Scheduled discovery, one mapped task per file, validate, load, archive"]],
    src:"PACK · File Ingestion Framework" },
  { id:"C4", no:4, name:"Loader round trip", dir:"loop", transport:"Gateway + file",
    role:"primary", y:285, port:"B",
    one:"BBH data to SEI, and the outcome back — status by API, detail by file.",
    detail:"Four legs and two transports. The status API carries the verdict and the counts; the error file carries the per-record detail. The response to the originating consumer cannot be sent until both are in and agree.",
    legs:[
      ["BBH","Consumer calls the Hub API with loader details and data"],
      ["BBH","Validate, map to SWP loader format, call the loader API out through the gateway"],
      ["SEI","SEI PS processes; calls Integration 360 with status and counts"],
      ["SEI","Status and error detail arrive as a file on the file transport"]],
    src:"PACK v5 + BBH decision" },
];

export const TRANSPORTS = [
 { id: "ev",   n: "SDC topics", sub: "domain topics, at-least-once",
   dir: "in",  role: "primary" },
 { id: "api",  n: "Apigee + API Gateway", sub: "every API, both directions",
   dir: "both", role: "primary" },
 { id: "file", n: "SFTP / Momentum", sub: "the daily file set",
   dir: "in",  role: "standby" },
];

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

export const chanById = (id) => CHANNELS.find((c) => c.id === id) || null;
