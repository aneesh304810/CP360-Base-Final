---
cp360_type: design_document
component_id: 4
component_name: SWP Loaders
zone: 1. SEI
plane: Source
priority: P2
technology: Contract
custom_build: None
depends_on: [10, 11]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# SWP Loaders

## What this component is

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

It sits in **Ingress and Egress**, in the **Loader framework** lane (Python · outbound).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

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

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
