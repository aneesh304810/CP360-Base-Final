# Wiring the additions into YOUR Environment360.jsx (no codebase divergence)
1. api.js — append env360_infra_api_additions.js exports and spread into `api`.
2. Environment360.jsx — three imports, three mounts:
     import { InventoryTab, SslSummaryCards, NetworkBoard } from "./Environment360_additions";
     const tabs = [...existing, ["inventory", "Inventory"]];
     {tab === "inventory" && <InventoryTab t={t} onChanged={refresh} />}
   Overview():
     - in the KPI grid, add:            <SslSummaryCards t={t} onDrill={() => setTab("certs")} />
       (replace/keep your certs_7d / certs_30d cards as you prefer — same data)
     - after the env_group grid, add:   <NetworkBoard t={t} />
3. Your existing certs tab already scans live chains — v_env_ssl_status adds the
   declared-vs-observed DRIFT signal on top when you want it (join in api).
4. Nothing is hardcoded: inventory/topology/probes all come from env_infra /
   env_probe via /env-infra/*; the workbook exists only at /import and /export.
