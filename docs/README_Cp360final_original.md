# CP Catalog BBH

Self-hosted data catalog for Brown Brothers Harriman, Capital Partners.
Five modules (Interface 360, API 360, Data 360, Datapoint 360, PII Explorer) +
System Design, on OpenShift + Oracle + FastAPI + React.

## Documentation
- **ARCHITECTURE.md** — architecture, all 13 ingestion processes, features by module,
  lineage levels, honest status. (Also browsable in-app under System Design.)
- **LOCAL_SETUP.md** — complete from-scratch local setup (prereqs, env vars, SQL
  order, ingestion, start API + UI, troubleshooting).

## Quick start
```powershell
cd C:\SEI\CPcatalog
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ui; npm install; cd ..
# run sql/01..16 in order into your Oracle schema
. .\local\set-env.ps1
python -m ingestion.run
# window 1: uvicorn app.main:app --app-dir api --port 8000
# window 2: cd ui; npm run dev   ->  http://localhost:5173
```

## In-app System Design tab
Architecture diagram (clickable module cards), the 13-step ingestion flow, and the
7 lineage levels with coverage — all live in the app under **System Design**.

See ARCHITECTURE.md and LOCAL_SETUP.md for everything else.
