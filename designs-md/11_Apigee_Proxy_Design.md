---
cp360_type: design_document
component_id: 11
component_name: Apigee Proxy
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Vendor/Infra
custom_build: Low
depends_on: [10, 35]
status: Not Started
owner: TBD
architecture_decisions: [AD-11]
pipeline_tiers: []
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, api]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: absent
architecture_domain: Ingress and Egress
canonical_tier: not on the stage chain
control_entities: [FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]
traceability_identifiers: [CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Apigee Proxy

## What this component is

The API lane. Both SEI documents are batch from end to end — files in, Gold out — and neither mentions a proxy, a gateway or a synchronous call.

It sits in **Ingress and Egress**, in the **API gateway and Apigee proxy** lane (vendor).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The API lane. Both SEI documents are batch from end to end — files in, Gold out — and neither mentions a proxy, a gateway or a synchronous call.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### Landing Zone contract

| Contract | Requirement |
|---|---|
| File readiness | Only complete files are visible, or a final rename or marker convention is used |
| Shared access | Landing, Archive and Quarantine are visible consistently to worker pods |
| Immutability | File contents are not modified in Landing |
| Discovery | The ingestion scanner reads active file configuration before scanning |
| Unknown files | An unmatched file produces an operational event and follows the approved exception-location policy |
| Ambiguous files | More than one configuration match is a configuration error and the file is NOT loaded |

### Landing failure modes

- Partial file exposure
- Duplicate physical delivery for the same logical interface and business date
- Filename does not match an active configuration
- Filename matches more than one configuration
- Storage unavailable or permission denied

### Transfer evidence required from Momentum

- Source and destination filename
- Transfer start and completion timestamps
- Transfer outcome
- Checksum, where the approved transfer contract includes one
- Correlation with the receiving ingestion record, where available

### Gateway design constraints

- No direct source-system-to-SEI service coupling across the trust boundary
- An idempotent request keeps the same idempotency key during safe retry
- Authentication secrets resolve from the platform secret service and are never stored in workflow metadata
- Gateway rejection is recorded separately from downstream SEI rejection

### Loader framework responsibilities

- Select the approved workflow and loader definition
- Read prepared Hub-owned outbound data
- Render the SEI-approved loader format
- Validate required fields, file structure and control totals
- Assign delivery and correlation identifiers
- Submit through the approved egress route
- Record acknowledgement, rejection and retry status

### Boundary rule

- Consumer movement and loader delivery introduce no uncontrolled transformation in flight. Business transformation and packaging are complete before delivery.

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
