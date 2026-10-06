// CP-Integration-Gateway: architecture and production-readiness review.
//
// WHY THIS MATTERS TO THE HUB AND NOT ONLY TO THE GATEWAY TEAM. The
// context screen draws Apigee and the API Gateway as a band that every
// API crosses, and lists what that single managed door BUYS: mTLS and
// OAuth to SEI, rotation in one place, retry and circuit-breaker policy,
// rate limiting, one authoritative log. This review says several of those
// are not yet enforced. A diagram that credits a component with controls
// it does not have is worse than one that omits the component.
//
// THE REVIEW'S OWN VERDICT: a solid application foundation, near
// enterprise-ready for lower environments, production approval
// conditional. Moderate maturity, pre-production hardening required.

export const GW_DOC = {
 n: "CP-Integration-Gateway",
 w: "Spring Boot WebFlux vendor gateway: forwards approved inbound calls "
  + "to configured vendor endpoints, obtains and caches the vendor OAuth "
  + "token, adds outbound Authorization and AppKey headers, maps the "
  + "vendor response, and exposes health, metrics and tracing.",
 stack: ["Java 21", "Spring Boot WebFlux, Actuator, Validation, Security",
  "Spring Cloud Circuit Breaker with Resilience4j",
  "Micrometer, Prometheus, OpenTelemetry OTLP",
  "OpenShift Route, probes, ServiceMonitor", "Jenkins CI/CD"],
 verdict: "Moderate maturity. Pre-production hardening is required. "
        + "Production approval remains conditional on closing the "
        + "security-boundary, secret-management, deployment-governance, "
        + "testing, observability and operational-readiness gaps.",
};

export const GW_STRENGTHS = [
 "Clear separation among controller, forwarding service, token service, configuration and exception handling",
 "Reactive non-blocking HTTP model, aligned with gateway I/O workloads",
 "Circuit-breaker integration is present",
 "OpenShift deployment artifacts include probes and resource controls",
 "Actuator, metrics and tracing dependencies are represented",
];

export const GW_GAPS = [
 { id: "GW-GAP-01", g: "Inbound trust boundary is not yet demonstrated as fully enforced", d: "Require authenticated identity and authorization in production through an approved API-management boundary, Spring Security, or both", sev: "block" },
 { id: "GW-GAP-02", g: "Forwarding-path governance needs an explicit contract", d: "Maintain an allowlist of approved paths, methods, request schemas and vendor targets; reject arbitrary proxy paths", sev: "block" },
 { id: "GW-GAP-03", g: "Header propagation requires strict governance", d: "Define accepted, generated, propagated, suppressed and returned headers", sev: "block" },
 { id: "GW-GAP-04", g: "Configuration patterns need convergence", d: "ConfigMap for non-secret settings, Secret for sensitive settings, profiles for behaviour only", sev: "open" },
 { id: "GW-GAP-05", g: "Truststore behaviour needs standardization", d: "Mount the binary truststore securely, inject the password separately, prevent production TLS bypass", sev: "block" },
 { id: "GW-GAP-06", g: "Deployment safeguards require standardization", d: "Add rollout verification, autoscaling policy, disruption budget, resource limits and policy controls", sev: "open" },
 { id: "GW-GAP-07", g: "Test depth is below behaviour complexity", d: "Add focused unit, integration, contract, resilience and security tests", sev: "open" },
 { id: "GW-GAP-08", g: "CI/CD controls are not yet fully mandatory", d: "Enforce compilation, tests, scans, image checks, manifest checks, rollout checks and retained evidence", sev: "open" },
 { id: "GW-GAP-09", g: "Operational contracts require formalization", d: "Define SLOs, dashboards, alerts, support queries, rollback procedures and vendor-outage runbooks", sev: "open" },
];

export const GW_RISKS = [
 ["GW-RISK-01", "Inbound authentication or authorization is incomplete", "Approved boundary design and passing tests"],
 ["GW-RISK-02", "Historical or accidental secret exposure", "Rotation evidence and clean repository and pipeline scans"],
 ["GW-RISK-03", "Arbitrary path forwarding", "Governed allowlist and negative tests"],
 ["GW-RISK-04", "Unsafe header propagation", "Approved header contract and tests"],
 ["GW-RISK-05", "Incomplete CI/CD gates", "Mandatory pipeline gates and retained results"],
 ["GW-RISK-06", "Missing rollout and availability controls", "Validated rollout, resources, scaling and disruption configuration"],
 ["GW-RISK-07", "Insufficient operational readiness", "Approved dashboards, alerts, support queries and runbooks"],
];

// What a governed operation has to declare before a call can be built.
// Rate limit is NOT on this list, which is the finding in R24.
export const GW_OPERATION = ["operation_id", "allowed_method",
 "allowed_path_pattern", "vendor_target_path", "request_schema_version",
 "required_request_headers", "allowed_request_headers",
 "allowed_response_headers", "timeout_policy", "retry_policy",
 "circuit_breaker_policy"];

export const GW_HEADERS = [
 ["Caller identity", "Trust only values asserted by the approved upstream boundary; prevent spoofing"],
 ["Vendor Authorization", "Generate from the vendor token; do not blindly forward caller authorization"],
 ["AppKey", "Resolve using the approved precedence and fallback policy"],
 ["Correlation identifier", "Validate a trusted incoming value or generate one; propagate to outbound calls, logs, metrics and traces"],
 ["Hop-by-hop headers", "Suppress"],
 ["Host and forwarding headers", "Generate or normalize under gateway control"],
 ["Vendor response headers", "Return only an explicit allowlist"],
];

export const GW_TOKEN_STATES = [
 ["EMPTY", "No token held", "to REFRESHING when a token is requested"],
 ["REFRESHING", "Token request in flight", "to VALID on receipt, to FAILED on error"],
 ["VALID", "Cached and inside the safe expiry boundary", "cache hit, or to REFRESHING at safe expiry, or to EMPTY on invalidation"],
 ["FAILED", "Token request failed", "to REFRESHING on approved retry"],
];
export const GW_TOKEN_TESTS = [
 "First request obtains and caches a token",
 "A later request uses the valid cached token",
 "Refresh occurs at the configured safe-expiry boundary",
 "Concurrent requests do not create a token-refresh storm",
 "Failed refresh does not leave an invalid token usable",
 "Vendor authorization failure follows the approved eviction and replay policy",
 "Token and credential values never appear in logs or exceptions",
];

export const GW_SECRETS = {
 never: "AppKeys, Basic authorization values, truststore passwords, tokens "
      + "and private certificates are never committed, and never appear in "
      + "logs, traces, error responses, build output or image layers.",
 rotate: "Rotate any value that may previously have been exposed.",
 startup: "Production startup fails when a mandatory secret is absent.",
 configmap: ["VENDOR_CLIENT_HOST", "VENDOR_TOKEN_HOST", "CONNECT_TIMEOUT",
  "RESPONSE_TIMEOUT", "TOKEN_EXPIRY_SKEW", "ALLOWED_OPERATION_CONFIGURATION",
  "LOG_LEVEL_DEFAULTS", "OTEL_EXPORT_CONFIGURATION"],
 secret: ["VENDOR_APP_KEY", "VENDOR_BASIC_AUTHORIZATION",
  "TRUSTSTORE_PASSWORD", "TRUSTSTORE_FILE"],
};

export const GW_RUNTIME_OBJECTS = [
 ["Deployment or approved workload object", true],
 ["Service", true],
 ["Route with approved TLS policy", true],
 ["ConfigMap", true],
 ["Secret bindings and truststore volume", true],
 ["Least-privilege ServiceAccount", true],
 ["ServiceMonitor, where Prometheus Operator discovery is used", true],
 ["HorizontalPodAutoscaler, after load behaviour is validated", false],
 ["PodDisruptionBudget, aligned with the approved availability model", false],
 ["NetworkPolicy, where the platform standard requires it", false],
];

export const GW_METRICS = [
 "Inbound request count and latency by governed operation",
 "Vendor response status class and latency",
 "Token cache hit, miss, refresh and failure",
 "Circuit-breaker state and rejected calls",
 "Retry and timeout counts",
 "Rejection by validation, authentication, authorization, path, method and schema",
 "Pod availability and rollout health",
];

export const GW_RUNBOOKS = [
 "Vendor business endpoint unavailable", "Vendor token endpoint unavailable",
 "Certificate or truststore failure", "Secret missing or expired",
 "Circuit breaker open", "Elevated latency or error rate",
 "Failed deployment or rollback",
 "Route, Service, DNS or NetworkPolicy failure",
 "Unexpected authentication or authorization rejection",
 "Suspected secret exposure",
];

export const GW_APPROVAL = [
 "Approved and tested inbound authentication and authorization",
 "Explicit operation allowlisting that prevents arbitrary proxying",
 "Documented and tested request and response header contracts",
 "No production secrets in source, image layers, ConfigMaps, logs, traces or pipeline output",
 "External truststore and password configuration with no production TLS bypass",
 "Passing token cache, expiry, refresh, concurrency, eviction and failure tests",
 "Retry limited to approved replay-safe scenarios",
 "Tested circuit-breaker, timeout, token-error and vendor-error mapping",
 "Passing mandatory CI/CD quality, security, image and manifest gates",
 "Validated OpenShift probes, resources, rollout, disruption, scaling, Secret mount and monitoring",
 "Approved dashboards, alerts, support queries and runbooks",
 "Documented rollback and credential-rotation evidence",
];

export const GW_PLAN = {
 immediate: [
  "Rotate and clean any credential that may previously have been exposed",
  "Lock production TLS and logging behaviour",
  "Finalize and test AppKey precedence and fallback",
  "Define and enforce the inbound identity and authorization boundary",
  "Add explicit operation, path, method, schema and header allowlists"],
 short: [
  "Complete ConfigMap, Secret and truststore mounting",
  "Make test and security gates mandatory in Jenkins",
  "Add token, forwarding, security, resilience, error-mapping and contract tests",
  "Parameterize and validate OpenShift deployment assets",
  "Add rollout verification, rollback identification, autoscaling, disruption and policy controls"],
 later: [
  "Add policy-as-code validation for OpenShift assets",
  "Establish approved SLOs, dashboards, alert thresholds and ownership",
  "Complete the gateway threat model",
  "Approve and exercise incident, rollback, downstream-outage and credential-compromise runbooks"],
};

export const GW_BLOCKING = GW_GAPS.filter((g) => g.sev === "block").length;
