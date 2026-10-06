---
cp360_type: design_document
component_id: 109
component_name: SEI Status Poller
zone: 2. Hub
plane: Orchestration
priority: P2
technology: Python · Airflow · Apigee
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
generated: true
sei_status: proposal
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# SEI Status Poller

## What this is

A component proposed by this programme's own review. It is not in
either SEI design document and it is not in the delivery workbook.
Its id is above 100 so it can never be mistaken for a tracker
component.

## Why it was proposed

The review asked what would have to exist if events, rather than
files, were the primary way data arrives. BBH has since confirmed
that they are: **SDC events is the primary inbound route and file-based is the
secondary one.**

This does not make the event components a proposal any more. It makes them the primary path with no design document behind them, which is a sharper problem and a different one.

## What would have to be true

Both SEI design documents describe the file path and only the file
path. The completeness gate counts files that arrived, the
business-date state machine opens one date at a time, and the SLA
measures a cutoff for a set of files. None of those hold for a
continuous event stream without being redesigned.

## Status

Proposed, not approved and not specified. It goes on the
architecture drawing when SEI's documents cover it or BBH formally
adopts it. Until then it is in the event container, drawn apart.

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Gap register

| Gap | What is missing | Required disposition |
|---|---|---|
| `GAP-03` | Ingress and egress component responsibilities are fragmented | Add Landing, Momentum/SFTP, API Gateway, Apigee, Loader Framework, callbacks and source boundaries |

### Against what this design already says

#### Closes a gap — The outbound submission registry now has a design

- **The supplement says.** WORKFLOW_DEFINITION to WORKFLOW_INSTANCE to LOADER_DELIVERY and API_CALL, each reporting STATUS_EVENT.
- **This design holds.** The loader loop screen says there is no outbound equivalent of FILE_REGISTRY, so a reject count has nothing to reconcile against and a batch that never comes back never ages out.
- **What it costs to leave open.** Closed, if the ERD is approved. LOADER_DELIVERY plus STATUS_EVENT is the registry that was missing.

#### Closes a gap — Correlation across the loader round trip

- **The supplement says.** CORRELATION_ID propagated through Hub, orchestration, API and loader execution, callback and monitoring; IDEMPOTENCY_KEY stable across retries of the same business operation.
- **This design holds.** The loader screen asks for one submission id threading all four legs, and names it as missing.
- **What it costs to leave open.** Closed. The identifiers exist and have propagation rules.

#### New — Landing zone failure modes, including ambiguous match

- **The supplement says.** Partial file exposure, duplicate physical delivery for the same logical interface and date, no configuration match, MORE THAN ONE configuration match, storage unavailable. A file matching two configurations is a configuration error and is not loaded.
- **This design holds.** The file screen covers validation thoroughly and says nothing about what happens before a file is matched to an interface.
- **What it costs to leave open.** Ambiguous match is the one with no safe default: loading against the first match silently routes a file to the wrong RAW table.
- **Decision.** `DEC-GAP-02, DEC-GAP-03`

#### Conflict — The context screen credits the gateway with controls it does not yet enforce

- **The supplement says.** GW-GAP-01: the inbound trust boundary is NOT yet demonstrated as fully enforced. GW-RISK-03: arbitrary path forwarding is a live risk until a governed allowlist exists.
- **This design holds.** The boundary screen lists what the single managed door buys - mTLS and OAuth to SEI, rotation in one place, retry and circuit-breaker policy, one authoritative log - in the present tense, as though all of it were in force.
- **What it costs to leave open.** A diagram that credits a component with controls it does not have is worse than one that omits the component: it stops anybody asking. Those claims need a 'designed, not yet enforced' state.
- **Decision.** `GW-GAP-01, GW-GAP-02`

#### New — The rate limit our design depends on is not in the operation contract

- **The supplement says.** A governed operation declares method, path pattern, vendor target, schema version, header allowlists, timeout, retry and circuit-breaker policy. There is no quota or rate-limit field.
- **This design holds.** The boundary screen says rate limiting at the gateway is 'where the key-set collapser's restraint is actually enforced', and the mitigation for a consumer read-storm starving ingestion is 'separate API products with their own quota tiers'.
- **What it costs to leave open.** Our stated mitigation has no implementation named anywhere. The collapser proposes and nothing disposes.
- **Decision.** `none raised - worth one`

#### New — Starvation has a second cause: the gateway does not scale yet

- **The supplement says.** HorizontalPodAutoscaler comes 'after load behaviour is validated', and PodDisruptionBudget and NetworkPolicy are listed as required but not yet in place (GW-GAP-06, GW-RISK-06).
- **This design holds.** The shared-quota risk assumes the gateway itself keeps up and only the SEI quota is contended.
- **What it costs to leave open.** A bursty set-based pull, a loader window and interactive reads share a service with no autoscaling and no disruption budget. The queue forms before the quota is reached.
- **Decision.** `GW-GAP-06`

#### New — The vendor token cache is per-pod, and the storm is a named test

- **The supplement says.** The token is cached in memory until a safe expiry boundary, and 'concurrent requests do not create a token-refresh storm' is a required test.
- **This design holds.** Nothing. The gateway is drawn as one band with no internal state.
- **What it costs to leave open.** In-memory means per-pod: every replica refreshes on its own clock, and the refresh count scales with replicas rather than with work. The puller's burst is exactly the shape that triggers it.
- **Decision.** `GW-GAP-07`

#### Closes a gap — The correlation identifier now has an owner and a rule

- **The supplement says.** The gateway validates a trusted incoming correlation value or generates one, and propagates it to outbound calls, logs, metrics and traces.
- **This design holds.** Both the loader loop and the boundary screen ask for a correlation id minted at the gateway and carried through, and name it as not yet owned.
- **What it costs to leave open.** Closed. The gateway owns minting and propagation, which is the answer both screens were asking for.

## Sources

- This programme's events-primary review
- Inbound posture: BBH, stated directly

Generated from the cited model, not written by hand.
