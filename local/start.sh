#!/usr/bin/env bash
# Start API (port 8000) and UI (port 5173). Ctrl-C stops both.
set -e
cd "$(dirname "$0")/.."
set -a; . local/.env; set +a
. .venv/bin/activate
echo ">>> Starting API on http://localhost:8000 ..."
uvicorn app.main:app --app-dir api --host 0.0.0.0 --port 8000 &
API_PID=$!
echo ">>> Starting UI on http://localhost:5173 ..."
cd ui && npm run dev &
UI_PID=$!
trap "kill $API_PID $UI_PID 2>/dev/null" EXIT INT TERM
echo ">>> Open http://localhost:5173 — badge should read LIVE."
wait
