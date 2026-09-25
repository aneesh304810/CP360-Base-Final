---
id: openshift-platform
title: OpenShift Platform — Runtime, CI/CD & Operations Tier
level: L2
icon: ⚙️
color: #444444
bg: #ececec
order: 3
sub: runtime · CI/CD · operations — governs platform components #44–#65
zone_default: 4. OpenShift
tags: [SEI-BBH, Integration-Hub, platform, openshift]
---

# OpenShift Platform — Runtime, CI/CD & Operations Tier

## 1. Purpose & Scope
The platform tier is everything the Hub *runs on* but is not itself pipeline logic: the OpenShift estate hosting Airflow, dbt runners, the gateway data plane, CP360, and every framework library — plus the CI/CD, GitOps, and operations machinery that changes and protects them. This document is the tier-level design governing all 22 platform components (#44–#65); individual components graduate to their own contract documents as they enter build, and until then this is their governing reference. Zone rule: platform components serve the Hub; they never contain business logic, business data transformations, or SEI-specific behavior — those belong in Hub-plane components.

## 2. Runtime Topology
- **Namespaces (#44)**: `cp-hub` (pipeline + gateway), `cp-360` (catalog/governance apps), `cp-cicd` (build/deploy tooling) — blast-radius and quota boundaries, each with its own ServiceAccounts (#47), NetworkPolicies (#49), and ResourceQuotas (#53).
- **Airflow (#51)**: KubernetesExecutor (CeleryKubernetes for the intraday/batch split per the executor design), scheduler HA pair, PostgreSQL metadata via CloudNativePG, workers as ephemeral pods with pre-pulled images (#54) and node placement rules (#56) separating batch-heavy from latency-sensitive (gateway) workloads.
- **Images (#45/#46)**: single hardened Python base per framework generation; all images from the internal registry, scanned and signed (#46); Nexus is the only package source (air-gap rule) — external pulls are a CI failure, not a warning.
- **Storage (#50)**: RWX (NFS/CIFS) for the landing/archive/quarantine volumes (#8's contract) and emitter spools; block storage for databases the estate hosts; capacity alerting shared with #8/#34.
- **Connections (#55)**: Oracle session budgets enforced at the platform edge — pooled connections per component service account, ceilings aligned with the #19 budget math so the database sees one governed client, not thirty.

## 3. Change & Release Machinery
- **CI/CD (#57)**: Jenkins pipelines per repo class (frameworks, dbt, UI, infra) — build → unit → package to Nexus → image build/scan/sign → deploy request; cp-guardrails (176 controls) run as the blocking stage; JSX/py validation conventions from the CP360 delivery pattern apply estate-wide.
- **GitOps (#58)**: ArgoCD owns cluster state — every namespace object declared in git; drift is a finding; manual `oc apply` in production is an incident, not a habit.
- **dbt releases (#59)**: versioned release artifacts with `state:modified` deferral, blue project slots for rollback (previous release re-deployable in minutes), release notes generated from model diffs.
- **Database change (#60)**: migration-tool-managed DDL (schema changes are versioned artifacts through the same CI), never console DDL; grants generated from the #32 matrix.
- **API-lane deploys (#61)**: blue-green on the gateway/control-plane (the one latency-sensitive surface); batch components use rolling deploys inside maintenance-safe windows.

## 4. Operations & Resilience
- **HA/DR (#62)**: scheduler and gateway HA in-cluster; DR posture per estate tier — pipeline recovery = replay from archive (#21) after platform restore, which is why #63 backup scope is metadata + configs + ledgers, not data volumes (data recovers through the pipeline's own machinery).
- **Backup & restore (#63)**: Airflow metadata DB, #33 config schema, audit spine partitions (#31), CP360 schema — scheduled, restore-drilled quarterly.
- **Monitoring stack (#64)**: platform Prometheus/Alertmanager for infra signals (nodes, pods, PVCs, operators) feeding the estate's channels; the boundary with #34 is explicit — #64 watches *infrastructure health*, #34 watches *pipeline meaning*; both land in Splunk, different indexes.
- **Cost & capacity (#65)**: quota utilization, PVC growth, worker-pod concurrency trends, Oracle session-budget headroom — the monthly capacity review inputs, sourced from #64 metrics + #34 run history.

## 5. Component Index & Graduation
| Range | Components | Graduation trigger |
|---|---|---|
| #44–#50 | Namespaces, images, registry, RBAC/SCC, secrets, network, storage | First production workload touching the control (most are In Build with the estate) |
| #51–#56 | Airflow deploy, autoscaling, quotas, warm-start, connection pooling, placement | Airflow platform hardening epics (RBAC + executor designs already drafted) |
| #57–#61 | CI/CD, GitOps, dbt release, DB change, blue-green | First framework release through the full chain |
| #62–#65 | HA/DR, backup, monitoring, cost | DR/backup drills scheduled; monitoring live with #34 |
Each graduation produces a contract-format design document (the 12-section anatomy) pinned by `component_id`, which automatically supersedes this tier document for that component in CP360.

## 6. RECOMMENDATION
Operate the platform tier as **product, not plumbing**: one hardened path for images, one declared state for the cluster, one governed client per database, guardrails as the blocking CI stage — so that Hub components inherit security, resilience, and change discipline by *running here* rather than by re-implementing it. The tier's success measure is negative space: zero external package pulls, zero drift findings unresolved past a sprint, zero manual production changes, restore drills green — and Hub design documents (like #8, #12, #19, #34) citing platform contracts by number instead of re-designing them.
