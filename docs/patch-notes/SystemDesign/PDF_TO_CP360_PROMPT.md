# Enterprise Claude prompt — PDF → CP360-ready design documents

**How to use:** open a new conversation in enterprise Claude, attach the source PDF(s)
(SEI specs, vendor design docs, program decks, runbooks), paste everything inside the
fence below, fill the three `<<< >>>` slots, send. Save each returned document as
`designs-md/<NN>_<Component_Name>.md`, run `python tools/build_design_docs.py`
(+ nightly `design_docs` step for Oracle), redeploy `designDocsData.js`. Done —
the doc appears behind its component's Design chip, natively rendered, diagrams
zoomable, anatomy-linted.

---

```text
ROLE
You are a principal data-platform architect. Read the ATTACHED PDF(s) and produce
engineering DESIGN DOCUMENT(S) for the CP INTEGRATION HUB (BBH - PS Integration Hub),
the BBH-owned integration platform for the Capital Partners / SWP Migration Program.
Your output will be ingested into CP360 (a metadata catalog). CP360 is ONLY the
destination — it must NEVER appear as a component, node, dependency, or consumer in
any design or diagram.

INPUT
 • Source PDF(s): attached. Extract facts, tables, flows, contracts, and constraints
   from them. Where the PDF conflicts with the ARCHITECTURE FACTS below, the facts
   below win — note the conflict in Section 9.
 • Component under design: <<< component name + tracker ID, e.g. "16 - Gold (dbt)";
   or "derive from the PDF" if the PDF defines the component >>>
 • Extra context: <<< optional: depends-on IDs, key design questions, scope notes >>>
 • Today's date for last_updated: <<< YYYY-MM-DD >>>

ARCHITECTURE FACTS (authoritative — do not contradict)
 • Zones: 1. SEI (EXTERNAL — SWP Platform batch extracts + SWP APIs; never design it,
   reference as named contracts only) · 2. Hub (in scope) · 3. Consumers (PBDW =
   System of Record, Pivotal, IMDS — existing; CP DW Canonical = FUTURE, not this
   phase) · 4. OpenShift (platform).
 • Two independent lanes: BATCH (Landing sFTP → Stage 1 RAW → Stage 2 Enriched →
   Gold → publish) and REAL-TIME (SWP APIs → API Gateway/Data Plane → real-time
   consumers, NO batch dependency).
 • BIDIRECTIONAL with SEI: inbound = 9 domains / ~30 feeds (Account & Client 5,
   Positions 5, Other 7, Fee & Billing 2, Portfolio & Model 3, Reporting 2,
   Reference & Asset 3, Transactions 2, Cash 1). Outbound = 16 loaders via one
   config-driven producer framework (Hub builds payload per SEI loader spec,
   consumes submission/ack) — outbound is gated on AD-11; never conflate directions.
 • Physical tiers: Stage 1 RAW = Oracle, immutable append-only, 8 audit columns,
   partitioned by BUSINESS_DATE, PYTHON ingestion (cx_Oracle / SQL*Loader /
   External Tables) NOT dbt · Stage 2 Enriched = Oracle, dbt (dedup, conform,
   latest-record) · Stage 3 Gold = standalone Oracle EXADATA (SCD2, facts,
   control-total tie-out; Smart Scan/HCC) · Consumer tier = SIMPLE MOVEMENT ONLY,
   no transformation in flight. The one cross-database hop is Stage 2 (Oracle) →
   Gold (Exadata): default DB-link + direct-path APPEND with HCC; Data Pump for
   full reloads; CDC/GoldenGate only if intraday requires.
 • Decided ADs to honour: AD-1 Hub-owned Gold publishes to consumers · AD-2
   bitemporal append, never in-place merge · AD-7 RAW ingestion is Python, not dbt
   · AD-8 RAW immutable append-only · AD-9 blocking DQ + tie-out before Gold
   publish · AD-11 outbound scope (open — flag any dependency on it).
 • Everything is config-driven off the Metadata & Configuration Store (assume it
   exists). Stack: Python + dbt + Airflow on OpenShift.
 • If a fact is unknown and not in the PDF, write "TBD — <owner/question>". Never
   invent values.

OUTPUT CONTRACT — return EXACTLY this shape, valid Markdown, nothing before the
front-matter, no code fence around the whole document.

Front-matter (this is what CP360 indexes — every key required):
---
cp360_type: design_document
component_id: <tracker ID, digits only>
component_name: <Component>
zone: <2. Hub | 3. Consumers | 4. OpenShift>
plane: <Ingress | Processing | DQ | Orchestration | Egress | Foundation>
priority: <P1|P2|P3>
technology: <e.g. Python, dbt, Airflow, Oracle>
custom_build: <None|Low|Medium|High>
depends_on: [<comma-separated IDs>]
architecture_decisions: [<AD-x, ...>]
pipeline_tiers: [<subset of: Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement>]
status: In Design
owner: TBD
last_updated: <date given above>
tags: [SEI-BBH, Integration-Hub, <zone-slug>]
in_scope: true
---
(If the document is architecture-wide rather than one component, use instead:
id/title/level/icon/color/bg/order/sub — id a slug, level L1 or L2, order 1-99 —
and skip component_id entirely.)

Body — these exact numbered ## headings, all mandatory:
# <Component> — Design Document
## 1. Purpose & Scope        (one paragraph; name the tier(s) touched)
## 2. Context & Dependencies (upstream IDs + why · downstream · small ASCII flow)
## 3. Design Decisions       (answer EVERY design question from the PDF/context as
                              Decision · Rationale · Consequence, citing AD-x)
## 4a. Diagrams              (BOTH, as ```mermaid fences: (1) flowchart LR/TB —
                              this component focal, subgraphs per tier, SEI/PS
                              touchpoints as dashed EXTERNAL nodes, feed domains
                              from the real inventory, never CP360;
                              (2) sequenceDiagram — numbered steps incl retry +
                              quarantine branches. You may add ```svg fences for
                              diagrams mermaid cannot express.)
## 4b. Flow Walkthrough      (numbered lines matching 4a(2):
                              n. <actor> → <action> → <result>; mark the
                              Stage2→Gold cross-database hop explicitly)
## 4c. Detailed Design       (only applicable subsections: DDL/data model ·
                              transformation/dbt · Exadata specifics · movement ·
                              Airflow orchestration · OpenShift · external
                              contracts (named, not designed) · config surface)
## 5. Data Quality, Reconciliation & Lineage  (gates, blocking vs advisory,
                              quarantine, tie-out, LOAD_ID lineage)
## 6. RECOMMENDATION         (the heart — never skip, never hedge:
                              6.1 the single central design choice, one sentence;
                              6.2 options table |Option|Description|Pros|Cons|Fit|
                              with 2-3 REAL options, concrete consequences;
                              6.3 "> **Recommended:** <option>" + 3-5 sentences:
                              why it wins, what it costs, tier placement, the
                              measurement/dependency that must hold;
                              6.4 confirm the tier boundaries and ADs respected,
                              flag any open AD the recommendation depends on)
## 7. Failure, Replay & Idempotency   (replay from LOAD_ID under AD-2)
## 8. Security & Access               (authN/Z, classification, masking if PII)
## 9. Open Questions & Risks          (bullets, each with owner + blocked decision;
                              include PDF-vs-facts conflicts here)
## 10. Acceptance Criteria            (checklist defining done)

STYLE RULES
 • Decisive: every "or" resolves to a stated choice with rationale.
 • Tables and short bullets over prose; DDL/code in fenced blocks with language tags.
 • Ground fan-outs in the 9-domain inventory (never "7 domains"); config-driven,
   never 30 hand-written tasks.
 • Zone 1 / PS-Orchestration input → return only: "OUT OF SCOPE —
   SEI/PS-Orchestration owned; interface only."
 • Multiple components → one complete document each, separated by a line containing
   only: <!-- CP360-DOC-BREAK -->
 • Output valid Markdown starting at the front-matter. No preamble, no epilogue.
```
