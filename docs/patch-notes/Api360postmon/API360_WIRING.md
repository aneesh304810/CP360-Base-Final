# API 360 — deploy & operations guide (final build)

## Modules
- ⌘ API Console (Governance nav): Guided + Console — consumers
- ⚙ API Catalog Admin (Admin nav): Overview / Contracts & Ingestion /
  Environments & Tests / Collection Builder / Flow Builder — catalog owners

## Deploy order
1. sql/36_api360_console.sql on SILVER @ dvlpbdb1 (idempotent; includes
   schedule_tag, drift ack, env enabled, api_code_decodes + seed)
2. ingestion/: api_console_engine.py, api_contract_ingest.py,
   api_console_runner.py
3. api-app/routers_api360_console.py + "routers_api360_console" in the
   main.py mount loop + pip install requests --break-system-packages
   + restart uvicorn
4. UI — ALL SIX together: Api360Console.jsx, api.js, mockData.js,
   App.jsx, AppShell.jsx ; npm run build
   Pre-build: grep -c aconAckDrift src/api.js src/Api360Console.jsx

## First run (SEI)
1. Catalog Admin -> Environments: create SEI QA. Connection vars: baseUrl,
   tokenUrl, clientId, clientSecret (SECRET). Test data: testAccountId
   (synthetic/approved only — fills {{accountId}} in unattended runs).
2. Ingest the SEI swagger (upload / paste / URL / CLI). Re-run same file:
   diff must be empty (idempotence proof).
3. Console: Send one request from the auto-collection.
4. Builder -> Manage collections: tag your smoke collection `daily`.
5. Flow Builder: build, test (sampled), publish (POST/PUT flows need the
   sign-off checkbox — enforced server-side).

## Scheduled runs (CronJob-safe)
CLI: python -m ingestion.api_console_runner --tag daily --env SEI_QA --fail-nonzero
OpenShift CronJob (schedule after batch window):

    apiVersion: batch/v1
    kind: CronJob
    metadata: { name: api360-daily-smoke }
    spec:
      schedule: "5 6 * * 1-5"
      concurrencyPolicy: Forbid
      jobTemplate:
        spec:
          template:
            spec:
              restartPolicy: Never
              containers:
              - name: runner
                image: <your-api-image>
                command: ["python","-m","ingestion.api_console_runner",
                          "--tag","daily","--env","SEI_QA","--fail-nonzero"]
                envFrom: [{ secretRef: { name: cp360-oracle } }]

Same pattern for ingestion: command manifest via
python -m ingestion.api_contract_ingest manifest (weekly).

## Ingesting other systems
Identical pipeline for every system; only --system changes.
A. OpenAPI file:  ... openapi --file plaid.json --system PLAID
B. OpenAPI URL:   ... openapi --url https://... --system CRD
C. Postman file:  ... postman --file crd.json --system CRD --name "CRD"
D. No spec (AddVantage/STAR class): Catalog Admin -> Contracts &
   Ingestion -> Define endpoints by hand.
Every ingest: versions (priors STALE) · diffs (BREAKING -> DRIFT) ·
refreshes AUTO collection in place · PLANNED -> ONBOARDED.
Register recurring sources (add-source / UI) and schedule `manifest`.

## Operations
- Drift: red badge on Catalog Admin = unacknowledged drift; Overview
  Health panel lists it with Acknowledge (records who/when).
- Lifecycle: retire contract versions; delete MANUAL/POSTMAN collections
  (AUTO are contract-owned); enable/disable environments and sources.
- Decodes: Contracts & Ingestion -> Answer decodes maintains code→meaning
  sets; Guided present-steps join via columns: {"key":..,"label":..,
  "lookup":"RESTRICTION_CODES"}.
- Secrets: write-only; env:VAR refs preferred; exports blank secrets.
- PII: responses masked server-side; unmasked never returned.

## OpenShift sizing
Stateless app: 2-3 web pods (500m/1Gi, uvicorn 2 workers) + HPA covers
hundreds of users. oracledb pool per pod (min 2 / max 10); cap replicas
within SILVER session budget. Scheduled work runs as CronJobs, not web
pods. Probes: GET /apicon/systems.

## Deferred (decisions, not oversights)
Role enforcement (SSO group mapping), flow draft-vs-published versioning,
POST body generation from request schemas, history purge/paging,
SOAP/WSDL ingestion, trend charts.
