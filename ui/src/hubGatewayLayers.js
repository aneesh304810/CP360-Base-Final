// What SEI calls "the BBH Apigee proxy" is two things on BBH's side.
//
// THE MISREADING THIS EXISTS TO END. The tracker carried AD-3 as an open
// architecture conflict: SEI's v5 design says BBH runs an Apigee proxy on
// two nodes, the BBH V4.2 design says a vendor-neutral "API Gateway / Data
// Plane", and the recommendation was to pin one or correct SEI's diagram.
// Both descriptions are correct. They are the same door described from
// two vantage points, and nobody had written that down, so the design
// tracker blocked components 11 and 12 on a decision that did not need
// taking.
//
// WHAT IS ACTUALLY THERE. The CP-Integration-Gateway is a wrapper around
// BBH's Apigee network. A consumer talks to the wrapper and never sees
// BBH's Apigee infrastructure, its network or its security posture - that
// isolation is the reason the wrapper exists, not a side effect of it. On
// the way out to SEI the call still leaves through BBH Apigee, so the
// identity SEI observes on an inbound request is Apigee's. SEI's
// description is accurate and complete for everything SEI can see.
//
// WHY THIS IS NOT PEDANTRY. A reader who believes these are alternatives
// draws one box and then has nowhere to put the trust boundary - which is
// exactly where GW-GAP-01 lives, the blocking gap that says the inbound
// trust boundary is not yet demonstrated as enforced. Two layers with a
// boundary between them gives that gap an address.

export const GW_LAYERS = [
 { id: "edge", n: "CP-Integration-Gateway", sub: "the wrapper",
   face: "consumer-facing",
   w: "Spring Boot WebFlux. The only thing a consumer addresses. It "
    + "terminates the caller's request, applies the inbound trust "
    + "boundary, and forwards to the vendor endpoint it is configured "
    + "for. BBH-built, and the component this programme's readiness "
    + "review is about.",
   isolates: ["BBH Apigee network topology", "BBH Apigee security posture",
     "vendor endpoint addresses and credentials",
     "which BBH node answered"],
   reg: "12" },
 { id: "apigee", n: "BBH Apigee", sub: "the network behind it",
   face: "BBH infrastructure",
   w: "Two nodes, run by BBH as platform infrastructure rather than by "
    + "this programme. Carries the call out to SEI, and is the identity "
    + "SEI observes on the far side. Vendor kit: proxy configuration and "
    + "policy, no application code.",
   isolates: [],
   reg: "11" },
];

// Which layer each side of the boundary can see. This is the whole
// content of AD-3 once it stops being a disagreement.
export const GW_VANTAGE = [
 { who: "A consumer", sees: "CP-Integration-Gateway only",
   blind: "That BBH Apigee exists at all, where it is, or how it is secured" },
 { who: "SEI", sees: "BBH Apigee - the request arrives from it",
   blind: "That a wrapper in front of it terminated the caller first" },
 { who: "BBH", sees: "Both, as one path: gateway, then Apigee, then SEI",
   blind: "Nothing - this is the only vantage point from which the stack is whole" },
];

export const GW_AD3 = {
 id: "AD-3",
 was: "Apigee: firm decision or placeholder",
 seiSaid: "BBH runs an Apigee proxy (two nodes)",
 bbhSaid: "Vendor-neutral 'API Gateway / Data Plane'",
 verdict: "Not a conflict. Both are true at their own vantage point.",
 w: "The API Gateway is a wrapper over BBH's Apigee network, there to "
  + "isolate BBH's Apigee infrastructure and security from the consumer. "
  + "SEI sees requests arriving from Apigee because on the egress path "
  + "they do. What SEI names as one proxy is, on BBH's side, the gateway "
  + "plus Apigee behind it. Nothing needs pinning and SEI's diagram is "
  + "not wrong - it is drawn from outside the boundary the wrapper exists "
  + "to create.",
 unblocks: ["11", "12"],
 leaves: "The question AD-3 was standing in for is still open, but it is "
       + "a different question: where the inbound trust boundary is "
       + "enforced, and by which layer. That is GW-GAP-01, and it blocks "
       + "production approval.",
};
