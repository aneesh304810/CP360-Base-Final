---
id: openshift-platform
title: OpenShift Platform — Runtime, CI/CD & Operations Tier
level: L2
icon: ⚙️
color: #444444
bg: #ececec
order: 3
sub: withdrawn - to be rewritten from the drawing
zone_default: 4. OpenShift
tags: [SEI-BBH, Integration-Hub, platform, openshift]
generated: true
sei_status: overview
---

# OpenShift platform

## What SEI's documents actually say about the platform

Less than people assume. Both design documents assume OpenShift
and specify only what the pipeline needs from it.

| # | Component | Verdict | What SEI says, or why not |
|---|---|---|---|
| 44 | Projects / Namespaces | not in SEI's documents | Platform build. Neither document covers it. |
| 45 | Container Images | not in SEI's documents | Container images. Both documents assume OpenShift and neither specifies how images are built or versioned — only that rollback is redeploying the prior one. |
| 46 | Registry, Scanning, Signing | not in SEI's documents | Registry, scanning and signing. Not mentioned, and it is the supply-chain half of a design that is otherwise explicit about least privilege. |
| 47 | Service Accounts, RBAC, SCCs | SEI specifies this | Named, and narrowly: least privilege, and DML only on the Gold tables. |
| 48 | Secrets Management | SEI specifies this | Oracle, SFTP and storage credentials in OpenShift secrets, referenced through Airflow connections. |
| 49 | Network Policy & Egress | not in SEI's documents | Network policy and egress. Neither document says what the pipeline is allowed to reach, which matters given it pulls from SFTP and pushes to Splunk. |
| 50 | Persistent Storage | SEI designs it differently | SEI needs one specific thing from storage and states it as an assumption: Landing, Archive and Quarantine must be shared across worker pods, or mapped tasks cannot reliably read or move files. |
| 51 | Airflow Deployment | SEI specifies this | A starting configuration is given: schedule every five minutes, catchup off, one active run, pool 8 to 10, one or two retries. |
| 52 | Worker Pod Autoscaling | SEI specifies this | Worker pods are how file-level concurrency scales, bounded by pools and Oracle connections. |
| 53 | Resource Quotas & Priority | not in SEI's documents | Resource quotas and priority. The documents give a starting pool size and worker count and leave the cluster-level envelope open — see open decision O2. |
| 54 | Warm-start / Pre-pulled Images | not in SEI's documents | Warm start and pre-pulled images. A latency optimisation for a five-minute discovery cycle that neither document considers. |
| 55 | Oracle Connection Pooling | SEI specifies this | Pool size is sized against Oracle connection capacity, and the document says the number is a starting position to confirm. |
| 56 | Node Placement | not in SEI's documents | Node placement. Not mentioned, though the shared-storage assumption for Landing, Archive and Quarantine constrains it. |
| 57 | CI/CD Pipelines | SEI specifies this | Git-versioned models and DAGs; the pipeline compiles and runs unit and DQ tests before promotion. |
| 58 | GitOps / ArgoCD | not in SEI's documents | GitOps and ArgoCD. The dbt document says models and DAGs are Git-versioned and promoted as tagged images; it does not name a deployment tool. |
| 59 | dbt Release & Rollback | SEI specifies this | Rollback is redeploying the prior image, and it is safe only because Gold writes are idempotent merges with no DDL. |
| 60 | Database Change Management | not in SEI's documents | Nothing covers schema change management, which matters more here than usual: SEI's design forbids DDL against Gold, so whatever does change those tables sits outside it. |
| 61 | Blue-Green / Canary (API lane) | not in SEI's documents | Blue-green and canary for the API lane, which neither document has. |
| 62 | HA / DR | not in SEI's documents | Neither document covers availability or recovery of the platform itself. |
| 63 | Backup & Restore | not in SEI's documents | Backup and restore is not in either document. |
| 64 | Monitoring Stack | SEI designs it differently | SEI gives every dashboard, trend and alert to Splunk. A separate monitoring stack is a second place for the same job. |
| 65 | Cost & Capacity Monitoring | not in SEI's documents | Cost and capacity are not in either document. |

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
