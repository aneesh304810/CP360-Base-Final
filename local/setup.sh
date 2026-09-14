#!/usr/bin/env bash
# One-time setup: create venvs and install deps for API + ingestion.
set -e
cd "$(dirname "$0")/.."
echo ">>> Creating Python venv (.venv) ..."
python3 -m venv .venv
. .venv/bin/activate
echo ">>> Installing API + ingestion requirements ..."
pip install --quiet --upgrade pip
pip install --quiet -r api/requirements.txt -r ingestion/requirements.txt
echo ">>> Installing UI deps ..."
cd ui && npm install && cd ..
echo ">>> Setup complete. Next:"
echo "    1) cp local/.env.example local/.env  and edit it"
echo "    2) ./local/ingest.sh     (load the catalog)"
echo "    3) ./local/start.sh      (run API + UI)"
