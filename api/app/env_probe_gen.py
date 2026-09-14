"""env_infra rows -> probe definitions. Called automatically after every import.
Port known -> ARMED; port TBD -> WAITING (visible, not runnable) — filling a
port in the workbook and uploading is what arms the probe."""
import re

CHECKS = [   # (layer, system-frag) -> node probe id-suffix, check type
    (("Platform", "Integration Hub"), ("app.hub", "HTTP")),      # /healthz via route
    (("File System", "Landing"), ("dmz.cifs", "CIFS")),          # write-probe
    (("Database", "IMDS"), ("data.imds", "SQL")),
    (("Database", "PBDW"), ("data.pbdw", "SQL")),
    (("Consumer", "Pivotal"), ("cons.piv", "TCP")),
    (("Consumer", "Client Portal"), ("cons.portal", "TCP")),
    (("External SFTP", "SFTP"), ("dmz.mft", "SFTP")),
    (("External API", "Proxy Egress"), ("ext.seiapi", "HTTP")),
]
PATHS = [   # path probes: reuse the governing row's port
    ("path.sei-mft", ("External SFTP", "SFTP")),
    ("path.cifs-hub", ("File System", "Landing")),
    ("path.hub-imds", ("Database", "IMDS")),
    ("path.hub-pbdw", ("Database", "PBDW")),
    ("path.pbdw-piv", ("Consumer", "Pivotal")),
    ("path.pbdw-portal", ("Consumer", "Client Portal")),
    ("path.apigee-sei", ("External API", "Proxy Egress")),
]

def _port(pp):
    if not pp or "TBD" in pp.upper():
        return None
    m = re.search(r"(\d{2,5})", pp)
    return int(m.group(1)) if m else None

def _host(hosts):
    return (hosts or "").split(";")[0].strip()

AUTO_PFX = {"Database": "data", "Consumer": "cons", "File System": "dmz",
            "Platform": "app", "External API": "ext", "External SFTP": "ext"}

def _slug(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower())[:16]

K8S_API = {"DEV": "https://api.ocpq.testbbh.com:6443", "SIT": "https://api.ocpq.testbbh.com:6443",
           "TRIAL_UAT": "https://api.ocpq.testbbh.com:6443", "PROD": "https://api.ocp.bbh.com:6443"}

def _k8s_probe(row):
    """Platform row -> pod-readiness probe against the env's cluster API.
    Namespace resolution (first match wins):
      1. explicit  ns:<name>  anywhere in hosts or notes  (recommended)
      2. is-… style namespace inside a route hostname (…-is-prbk-airflow-q.apps…)
      3. rd-… style namespace token
    No namespace -> WAITING (name it in the workbook to arm)."""
    import re as _re
    blob = ((row.get("hosts") or "") + " " + (row.get("notes") or "")).lower()
    ns = None
    m = _re.search(r"ns:\s*([a-z0-9][a-z0-9-]*)", blob)
    if m:
        ns = m.group(1)
    if not ns:
        m = _re.search(r"(is-[a-z0-9-]+?)(?:\.apps|\s|;|$)", blob)
        if m:
            ns = m.group(1)
    if not ns:
        m = _re.search(r"\b(rd-[a-z0-9-]+)\b", blob)
        if m and "namespace" not in m.group(1):
            ns = m.group(1)
    api = K8S_API.get(row["env"], K8S_API["DEV"])
    return {"source_hash": row["row_hash"], "probe_id": f"{row['env']}.app.hub", "env": row["env"], "kind": "node",
            "check_type": f"K8S:{ns}" if ns else "K8S:", "target_host": api,
            "target_port": 6443, "state": "ARMED" if ns else "WAITING",
            "source_hash": row.get("row_hash", "")}

def generate_probes(rows):
    """-> list of probe dicts for ALL envs; deterministic from rows."""
    out = []
    for r in rows:
        if r.get("workloads"):             # v5 rows: workload probes only
            continue
        for (layer, frag), (nid, ctype) in CHECKS:
            if r["layer"] == layer and frag in r["system_name"]:
                port = _port(r.get("protocol_port"))
                if ctype == "SFTP" and port is None:
                    port = 22
                if ctype == "HTTP" and port is None and "443" in (r.get("protocol_port") or ""):
                    port = 443
                out.append({"probe_id": f'{r["env"]}.{nid}', "env": r["env"],
                            "kind": "NODE", "check_type": ctype,
                            "target_host": _host(r["hosts"]), "target_port": port,
                            "state": "ARMED" if port else "WAITING",
                            "source_hash": r["row_hash"]})
    matched = set()
    for r in rows:
        for (layer, frag), _ in CHECKS:
            if r["layer"] == layer and frag in r["system_name"]:
                matched.add((r["env"], r["layer"], r["system_name"]))
    for r in rows:
        k = (r["env"], r["layer"], r["system_name"])
        if k in matched or r["layer"] not in AUTO_PFX:
            continue
        port = _port(r.get("protocol_port"))
        nid = f'{AUTO_PFX[r["layer"]]}.{_slug(r["system_name"])}'
        out.append({"probe_id": f'{r["env"]}.{nid}', "env": r["env"], "kind": "NODE",
                    "check_type": "TCP", "target_host": _host(r["hosts"]),
                    "target_port": port, "state": "ARMED" if port else "WAITING",
                    "source_hash": r["row_hash"], "auto": True})
    by_key = {(r["env"], r["layer"], r["system_name"]): r for r in rows}
    for pid, (layer, frag) in PATHS:
        for env in {r["env"] for r in rows}:
            src = next((r for k, r in by_key.items()
                        if k[0] == env and k[1] == layer and frag in k[2]), None)
            if not src:
                continue
            port = _port(src.get("protocol_port")) or (22 if layer == "External SFTP" else None)
            if "/" in str(_host(src["hosts"]) or ""):
                continue                    # CIDR ranges documented, not probed
            out.append({"probe_id": f"{env}.{pid}", "env": env, "kind": "PATH",
                        "check_type": "TCP" if port else "NONE",
                        "target_host": _host(src["hosts"]), "target_port": port,
                        "state": "ARMED" if port else "WAITING",
                        "source_hash": src["row_hash"]})
    # Platform rows -> pod-readiness probes (replace the plain HTTP hub probe):
    # hub liveness = deployments ready in the env's namespace (OCPQ for DEV/QC,
    # the separate prod OCP cluster for PROD)
    done = set()
    for r in rows:
        if (r.get("layer") or "").lower() == "platform" and r["env"] not in done:
            kp = _k8s_probe(r)
            out = [p for p in out if p["probe_id"] != kp["probe_id"]]
            out.append(kp)
            done.add(r["env"])
    for r in rows:                         # v5: workload-grained probes
        for w in (r.get("workloads") or []):
            hct = (w.get("hc_type") or "").strip()
            wid = _slug(w.get("workload_name") or w.get("host") or "")[:24]
            if not wid:
                continue
            pid = f'{r["env"]}.{_slug(r["system_name"])[:16]}.{wid}'
            base = {"probe_id": pid, "env": r["env"], "state": "ARMED",
                    "source_hash": r["row_hash"]}
            if hct in ("OpenShiftDeployment", "OpenShiftJob"):
                ns = w.get("namespace") or ""
                out.append({**base, "kind": "K8S",
                    "check_type": "K8S:" + ("job" if hct.endswith("Job")
                        else "deployment"),
                    "target_host": f'{ns}/{w.get("workload_name")}',
                    "target_port": 6443,
                    "state": "ARMED" if ns else "WAITING"})
            elif hct == "AirflowAPI" or "/monitor/health" in (
                    (w.get("hc_target") or "") + (w.get("endpoint_url") or "")):
                cands = [w.get("hc_target") or "", w.get("endpoint_url") or ""]
                tgt = next((c for c in cands if "/monitor/health" in c),
                           cands[0] or cands[1])
                out.append({**base, "kind": "AIRFLOW",
                    "check_type": "HTTP:airflow", "target_host": tgt,
                    "target_port": 443, "state": "ARMED" if tgt else "WAITING"})
                sslt = (w.get("ssl_target") or "").strip()
                if sslt:                    # companion cert probe for the route
                    out.append({**base, "probe_id": base["probe_id"] + ".ssl",
                        "kind": "TLS", "check_type": "TLS:https",
                        "target_host": sslt, "target_port": 443})
            elif hct == "HTTPS":
                tgt = w.get("hc_target") or w.get("ssl_target")
                out.append({**base, "kind": "TLS", "check_type": "TLS:https",
                    "target_host": tgt, "target_port": 443,
                    "state": "ARMED" if tgt else "WAITING"})
            elif hct in ("TCP", "Database"):
                port = _port(r.get("protocol_port") or "")
                out.append({**base, "kind": "NODE",
                    "check_type": "TCP:" + hct.lower(),
                    "target_host": w.get("hc_target") or w.get("host"),
                    "target_port": port,
                    "state": "ARMED" if port else "WAITING"})
            elif hct == "FileShare":
                out.append({**base, "kind": "CIFS", "check_type": "CIFS:write",
                    "target_host": w.get("hc_target") or w.get("host"),
                    "target_port": 445})
            # NetworkRange / Descriptive / Service / OpenShiftPlatform:
            # documented, not probed
    seen, unique = set(), []
    for p in out:                          # PK guard: first occurrence wins —
        if p["probe_id"] in seen:          # duplicate source rows can never
            continue                       # violate env_probe's primary key
        seen.add(p["probe_id"])
        p.setdefault("source_hash", "")
        unique.append(p)
    return unique
