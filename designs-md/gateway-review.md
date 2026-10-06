---
id: gateway-review
title: Gateway Readiness
level: L1
icon: ⚠
color: #c1113a
bg: #fdf1f2
order: 3
sub: CP-Integration-Gateway, production approval conditional
generated: true
sei_status: overview
---

# CP-Integration-Gateway — readiness

Spring Boot WebFlux vendor gateway: forwards approved inbound calls to configured vendor endpoints, obtains and caches the vendor OAuth token, adds outbound Authorization and AppKey headers, maps the vendor response, and exposes health, metrics and tracing.

**Verdict.** Moderate maturity. Pre-production hardening is required. Production approval remains conditional on closing the security-boundary, secret-management, deployment-governance, testing, observability and operational-readiness gaps.

Stack: Java 21, Spring Boot WebFlux, Actuator, Validation, Security, Spring Cloud Circuit Breaker with Resilience4j, Micrometer, Prometheus, OpenTelemetry OTLP, OpenShift Route, probes, ServiceMonitor, Jenkins CI/CD.

## What is already right

- Clear separation among controller, forwarding service, token service, configuration and exception handling
- Reactive non-blocking HTTP model, aligned with gateway I/O workloads
- Circuit-breaker integration is present
- OpenShift deployment artifacts include probes and resource controls
- Actuator, metrics and tracing dependencies are represented

## Gap register

| Gap | What is missing | Required response | Blocks production |
|---|---|---|---|
| `GW-GAP-01` | Inbound trust boundary is not yet demonstrated as fully enforced | Require authenticated identity and authorization in production through an approved API-management boundary, Spring Security, or both | **yes** |
| `GW-GAP-02` | Forwarding-path governance needs an explicit contract | Maintain an allowlist of approved paths, methods, request schemas and vendor targets; reject arbitrary proxy paths | **yes** |
| `GW-GAP-03` | Header propagation requires strict governance | Define accepted, generated, propagated, suppressed and returned headers | **yes** |
| `GW-GAP-04` | Configuration patterns need convergence | ConfigMap for non-secret settings, Secret for sensitive settings, profiles for behaviour only | no |
| `GW-GAP-05` | Truststore behaviour needs standardization | Mount the binary truststore securely, inject the password separately, prevent production TLS bypass | **yes** |
| `GW-GAP-06` | Deployment safeguards require standardization | Add rollout verification, autoscaling policy, disruption budget, resource limits and policy controls | no |
| `GW-GAP-07` | Test depth is below behaviour complexity | Add focused unit, integration, contract, resilience and security tests | no |
| `GW-GAP-08` | CI/CD controls are not yet fully mandatory | Enforce compilation, tests, scans, image checks, manifest checks, rollout checks and retained evidence | no |
| `GW-GAP-09` | Operational contracts require formalization | Define SLOs, dashboards, alerts, support queries, rollback procedures and vendor-outage runbooks | no |

## Risks

| Risk | What it is | Closure evidence |
|---|---|---|
| `GW-RISK-01` | Inbound authentication or authorization is incomplete | Approved boundary design and passing tests |
| `GW-RISK-02` | Historical or accidental secret exposure | Rotation evidence and clean repository and pipeline scans |
| `GW-RISK-03` | Arbitrary path forwarding | Governed allowlist and negative tests |
| `GW-RISK-04` | Unsafe header propagation | Approved header contract and tests |
| `GW-RISK-05` | Incomplete CI/CD gates | Mandatory pipeline gates and retained results |
| `GW-RISK-06` | Missing rollout and availability controls | Validated rollout, resources, scaling and disruption configuration |
| `GW-RISK-07` | Insufficient operational readiness | Approved dashboards, alerts, support queries and runbooks |

## A governed operation

Declared before any outbound call is built:

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

**There is no quota or rate-limit field on this list.** The boundary
design names gateway rate limiting as the thing that enforces the
key-set collapser's restraint, and as the mitigation for a consumer
read-storm starving ingestion. That mitigation has no implementation
named anywhere. See R21.

## Header policy

| Header category | Required behaviour |
|---|---|
| Caller identity | Trust only values asserted by the approved upstream boundary; prevent spoofing |
| Vendor Authorization | Generate from the vendor token; do not blindly forward caller authorization |
| AppKey | Resolve using the approved precedence and fallback policy |
| Correlation identifier | Validate a trusted incoming value or generate one; propagate to outbound calls, logs, metrics and traces |
| Hop-by-hop headers | Suppress |
| Host and forwarding headers | Generate or normalize under gateway control |
| Vendor response headers | Return only an explicit allowlist |

## The vendor token cache

In memory, and therefore per pod: the refresh count scales with
replicas rather than with work. See R23.

| State | What it means | Transitions |
|---|---|---|
| `EMPTY` | No token held | to REFRESHING when a token is requested |
| `REFRESHING` | Token request in flight | to VALID on receipt, to FAILED on error |
| `VALID` | Cached and inside the safe expiry boundary | cache hit, or to REFRESHING at safe expiry, or to EMPTY on invalidation |
| `FAILED` | Token request failed | to REFRESHING on approved retry |

### Required tests

- First request obtains and caches a token
- A later request uses the valid cached token
- Refresh occurs at the configured safe-expiry boundary
- Concurrent requests do not create a token-refresh storm
- Failed refresh does not leave an invalid token usable
- Vendor authorization failure follows the approved eviction and replay policy
- Token and credential values never appear in logs or exceptions

## Secret hygiene

AppKeys, Basic authorization values, truststore passwords, tokens and private certificates are never committed, and never appear in logs, traces, error responses, build output or image layers.

Rotate any value that may previously have been exposed. Production startup fails when a mandatory secret is absent.

- **ConfigMap, non-secret.** `VENDOR_CLIENT_HOST`, `VENDOR_TOKEN_HOST`, `CONNECT_TIMEOUT`, `RESPONSE_TIMEOUT`, `TOKEN_EXPIRY_SKEW`, `ALLOWED_OPERATION_CONFIGURATION`, `LOG_LEVEL_DEFAULTS`, `OTEL_EXPORT_CONFIGURATION`
- **Secret, sensitive.** `VENDOR_APP_KEY`, `VENDOR_BASIC_AUTHORIZATION`, `TRUSTSTORE_PASSWORD`, `TRUSTSTORE_FILE`

## OpenShift runtime objects

| Object | In place |
|---|---|
| Deployment or approved workload object | yes |
| Service | yes |
| Route with approved TLS policy | yes |
| ConfigMap | yes |
| Secret bindings and truststore volume | yes |
| Least-privilege ServiceAccount | yes |
| ServiceMonitor, where Prometheus Operator discovery is used | yes |
| HorizontalPodAutoscaler, after load behaviour is validated | **not yet** |
| PodDisruptionBudget, aligned with the approved availability model | **not yet** |
| NetworkPolicy, where the platform standard requires it | **not yet** |

## Observability

- Inbound request count and latency by governed operation
- Vendor response status class and latency
- Token cache hit, miss, refresh and failure
- Circuit-breaker state and rejected calls
- Retry and timeout counts
- Rejection by validation, authentication, authorization, path, method and schema
- Pod availability and rollout health

### Runbooks required

- Vendor business endpoint unavailable
- Vendor token endpoint unavailable
- Certificate or truststore failure
- Secret missing or expired
- Circuit breaker open
- Elevated latency or error rate
- Failed deployment or rollback
- Route, Service, DNS or NetworkPolicy failure
- Unexpected authentication or authorization rejection
- Suspected secret exposure

## Production approval criteria

All twelve are required. This is not a scorecard.

1. Approved and tested inbound authentication and authorization
2. Explicit operation allowlisting that prevents arbitrary proxying
3. Documented and tested request and response header contracts
4. No production secrets in source, image layers, ConfigMaps, logs, traces or pipeline output
5. External truststore and password configuration with no production TLS bypass
6. Passing token cache, expiry, refresh, concurrency, eviction and failure tests
7. Retry limited to approved replay-safe scenarios
8. Tested circuit-breaker, timeout, token-error and vendor-error mapping
9. Passing mandatory CI/CD quality, security, image and manifest gates
10. Validated OpenShift probes, resources, rollout, disruption, scaling, Secret mount and monitoring
11. Approved dashboards, alerts, support queries and runbooks
12. Documented rollback and credential-rotation evidence

## Prioritised action plan

### Immediate

- Rotate and clean any credential that may previously have been exposed
- Lock production TLS and logging behaviour
- Finalize and test AppKey precedence and fallback
- Define and enforce the inbound identity and authorization boundary
- Add explicit operation, path, method, schema and header allowlists

### Short-term delivery increment

- Complete ConfigMap, Secret and truststore mounting
- Make test and security gates mandatory in Jenkins
- Add token, forwarding, security, resilience, error-mapping and contract tests
- Parameterize and validate OpenShift deployment assets
- Add rollout verification, rollback identification, autoscaling, disruption and policy controls

### Subsequent hardening

- Add policy-as-code validation for OpenShift assets
- Establish approved SLOs, dashboards, alert thresholds and ownership
- Complete the gateway threat model
- Approve and exercise incident, rollback, downstream-outage and credential-compromise runbooks
