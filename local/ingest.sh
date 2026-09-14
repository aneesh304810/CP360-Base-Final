#!/usr/bin/env bash
# Load the catalog from the shared folder (or sample-artifacts).
set -e
cd "$(dirname "$0")/.."
set -a; . local/.env; set +a
# derive per-artifact paths from CP_CATALOG_ROOT if not explicitly set
export INTERFACE360_XLSX_PATH="${INTERFACE360_XLSX_PATH:-$CP_CATALOG_ROOT/INTERFACE-SYSTEM/interfaces.xlsx}"
export DATA360_FEED_DICTIONARY_PATH="${DATA360_FEED_DICTIONARY_PATH:-$CP_CATALOG_ROOT/DATA-FEEDS/SWP_EOD_Data_Feeds.xlsx}"
export PII_ATTRIBUTES_PATH="${PII_ATTRIBUTES_PATH:-$CP_CATALOG_ROOT/OVERLAY/PII_Attributes_List.xlsx}"
. .venv/bin/activate
echo ">>> Ingesting from: $CP_CATALOG_ROOT"
python -m ingestion.run
echo ">>> Done. Verify: SELECT COUNT(*) FROM datasets;"
