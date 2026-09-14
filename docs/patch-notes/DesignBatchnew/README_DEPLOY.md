# Design-doc batches 1–3 (13 new component docs) + rebuilt data module
Contents:
  designs-md/          13 new contract-compliant docs (all anatomy 12/12):
    Batch 1 Ingress/Egress: 08 Landing Zone · 09 Sensors · 10 Outbound Producers
                            11 Apigee Proxy · 12 API Gateway/Data Plane
    Batch 2 Proc/Orch:      16 Gold(dbt) · 19 Dim-before-Fact/Threads
                            20 Intraday Cadence · 21 Replay Engine · 22 Partial-Batch
    Batch 3 Data Quality:   24 G2 Profiling · 25 G3 Tests+Rules · 27 G5 Post-Publish
  HubDesign.jsx        current C4 route (ortho lanes · status dots · mini→doc clicks)
  designDocsData.js    rebuilt module — 27 docs · 307 sections (949KB)

Deploy:
  1. designs-md/*.md  -> repo designs-md/ (git commit — source of truth)
  2. designDocsData.js + HubDesign.jsx -> ui/src/  (frontend rebuild; docs live behind Design chips
     and every C4 board mini)
  3. Nightly design_docs step re-ingests to Oracle automatically
     (or run: python -m ingestion.run design_docs)

Decisions resolved in these docs (for the AD register):
  AD-1 Hub Pre-Gold schema (#16) · AD-3 enterprise Apigee passthrough (#11)
  AD-4 intraday on API lane (#12/#20) · replay=append-never-rewrite (#21, AD-2)
  AD-5 proposed ruling armed (#22) · sensors manifest-driven (#9)
  G2 trailing baselines (#24) · G3 discriminator (#25) · G5 bounded auto-repair (#27)
    Batch 4 Foundation:     29 Error/Quarantine · 30 Recon Fwk (SEI→AddVantage datapoint
                            conservation, AD-6→Hub) · 31 Audit/Lineage · 32 Security
                            34 Observability (Splunk dual-channel + CP360 monitoring schema)
    openshift-platform.md   platform-tier doc — all 22 PLAT components now route here
Scope per direction: Integration360 = CP 360 itself; SSO deferred — no docs.
COMPLETE: 25 of 25 in-scope components documented (+ platform tier + c66).
