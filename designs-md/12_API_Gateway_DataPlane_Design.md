---
cp360_type: design_document
component_id: 12
component_name: API Gateway / Data Plane
zone: 2. Hub
plane: Ingress/Egress
priority: P2
technology: Vendor/Infra
custom_build: Low
depends_on: [3, 42]
status: Not Started
owner: TBD
architecture_decisions: [AD-1]
pipeline_tiers: [Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, api]
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

# API Gateway / Data Plane

## What this component is

The API lane, as above. Nothing in either document describes real-time access to this data.

It sits in **Ingress and Egress**, in the **API gateway and Apigee proxy** lane (two layers · one door).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The API lane, as above. Nothing in either document describes real-time access to this data.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### Where this sits

- Spring Boot WebFlux. The only thing a consumer addresses. It terminates the caller's request, applies the inbound trust boundary, and forwards to the vendor endpoint it is configured for. BBH-built, and the component this programme's readiness review is about.
- The other layer is **BBH Apigee** (the network behind it), tracked as component 11.
- Not a conflict. Both are true at their own vantage point. The API Gateway is a wrapper over BBH's Apigee network, there to isolate BBH's Apigee infrastructure and security from the consumer. SEI sees requests arriving from Apigee because on the egress path they do. What SEI names as one proxy is, on BBH's side, the gateway plus Apigee behind it. Nothing needs pinning and SEI's diagram is not wrong - it is drawn from outside the boundary the wrapper exists to create.

### What this layer isolates from the consumer

- BBH Apigee network topology
- BBH Apigee security posture
- vendor endpoint addresses and credentials
- which BBH node answered

### Gateway design constraints

- No direct source-system-to-SEI service coupling across the trust boundary
- An idempotent request keeps the same idempotency key during safe retry
- Authentication secrets resolve from the platform secret service and are never stored in workflow metadata
- Gateway rejection is recorded separately from downstream SEI rejection

### Header policy

| Header category | Required behaviour |
|---|---|
| Caller identity | Trust only values asserted by the approved upstream boundary; prevent spoofing |
| Vendor Authorization | Generate from the vendor token; do not blindly forward caller authorization |
| AppKey | Resolve using the approved precedence and fallback policy |
| Correlation identifier | Validate a trusted incoming value or generate one; propagate to outbound calls, logs, metrics and traces |
| Hop-by-hop headers | Suppress |
| Host and forwarding headers | Generate or normalize under gateway control |
| Vendor response headers | Return only an explicit allowlist |

### A governed operation declares

- `operation_id`
- `allowed_method`
- `allowed_path_pattern`
- `vendor_target_path`
- `request_schema_version`
- `required_request_headers`
- `allowed_request_headers`
- `allowed_response_headers`
- `timeout_policy`
- `retry_policy`
- `circuit_breaker_policy`

### Vendor token cache

| State | Meaning | Transitions |
|---|---|---|
| EMPTY | No token held | to REFRESHING when a token is requested |
| REFRESHING | Token request in flight | to VALID on receipt, to FAILED on error |
| VALID | Cached and inside the safe expiry boundary | cache hit, or to REFRESHING at safe expiry, or to EMPTY on invalidation |
| FAILED | Token request failed | to REFRESHING on approved retry |

### Configuration split

- **ConfigMap, non-secret.** `VENDOR_CLIENT_HOST`, `VENDOR_TOKEN_HOST`, `CONNECT_TIMEOUT`, `RESPONSE_TIMEOUT`, `TOKEN_EXPIRY_SKEW`, `ALLOWED_OPERATION_CONFIGURATION`, `LOG_LEVEL_DEFAULTS`, `OTEL_EXPORT_CONFIGURATION`
- **Secret, sensitive.** `VENDOR_APP_KEY`, `VENDOR_BASIC_AUTHORIZATION`, `TRUSTSTORE_PASSWORD`, `TRUSTSTORE_FILE`
- Production startup fails when a mandatory secret is absent.

## Open against this component

**1 unresolved conflict and 8 other open items** — `GAP-03`, `R6`, `R8`, `R14`, `R20`, `R21`, `R22`, `R23`, `R24`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
