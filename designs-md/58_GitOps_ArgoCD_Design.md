---
cp360_type: design_document
component_id: 58
component_name: GitOps / ArgoCD
zone: 4. OpenShift
plane: Deployment
priority: P2
technology: CI/CD
custom_build: Low
depends_on: [44, 57]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: absent
generated: true
sei_status: absent
generated: true
sei_status: absent
---

# GitOps / ArgoCD

## What this component is

GitOps and ArgoCD. The dbt document says models and DAGs are Git-versioned and promoted as tagged images; it does not name a deployment tool.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

GitOps and ArgoCD. The dbt document says models and DAGs are Git-versioned and promoted as tagged images; it does not name a deployment tool.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
