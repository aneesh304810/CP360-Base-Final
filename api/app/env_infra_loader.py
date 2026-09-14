"""Parse the SEI infrastructure workbook (tsv/csv/xlsx) into env-tagged rows.

Environment detection: the sheet has no env column — blocks are implicit.
A new block starts at each (Layer=Platform, System=CP Integration Hub) row,
in canonical order DEV, SIT, TRIAL_UAT, PROD. Trailing External API/SFTP rows
are shared: qcsecureftp -> lower envs, secureftp -> PROD, API egress -> all.
"""
import csv, re, hashlib, io, json

ENV_ORDER = ["DEV", "SIT", "TRIAL_UAT", "PROD"]
COLS = ["Layer", "System", "New_SEI_Hosts_or_Endpoint", "Sizing_RAM", "Sizing_CPU",
        "Sizing_Storage_or_Capacity", "Growth", "Hosting", "Direction",
        "Protocol_Port", "Status_or_Notes", "SSL_Expiry"]

def _rows_from_bytes(data: bytes, filename: str):
    name = (filename or "").lower()
    if name.endswith(".xlsx"):
        import openpyxl                                    # optional dep
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = [str(c or "").strip() for c in next(it)]
        for r in it:
            yield {header[i]: ("" if r[i] is None else str(r[i]).strip())
                   for i in range(min(len(header), len(r)))}
    else:
        text = data.decode("utf-8-sig")
        delim = "\t" if "\t" in text.splitlines()[0] else ","
        for rec in csv.DictReader(io.StringIO(text), delimiter=delim):
            yield {k.strip(): (v or "").strip() for k, v in rec.items() if k}

def _hash(d):
    return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()[:16]

LAST_RULES = []          # rule rows captured by the most recent parse_sheet call

def _is_rule(row):
    return (row.get("Layer") or "").strip().lower() == "rule"

def parse_rules(data, filename="sheet"):
    """Rule rows from the combined sheet: Layer=Rule, System=src, Hosts=dst,
    Protocol_Port=port, Direction, Status_or_Notes=notes, Project/State trailing."""
    out = []
    for row in _rows_from_bytes(data, filename):
        if not _is_rule(row):
            continue
        st = (row.get("State") or "").strip().upper() or "TBD"
        out.append({"project": (row.get("Project") or "SEI").strip() or "SEI",
                    "src_system": (row.get("System") or "").strip(),
                    "dst_system": (row.get("New_SEI_Hosts_or_Endpoint")
                                   or row.get("Hosts") or "").strip(),
                    "port_proto": (row.get("Protocol_Port") or "TBD").strip(),
                    "direction": (row.get("Direction") or "").strip().lower(),
                    "state": st if st in ("TBD", "APPROVED") else "TBD",
                    "notes": (row.get("Status_or_Notes") or row.get("Notes") or "").strip()})
    return out

def _aggregate_perhost(raw):
    """v4 normalized sheet: one row per host. Re-aggregate to system rows:
    hosts = Endpoint_Group (verbatim -> hash-stable) or seq-ordered join.
    Validates each host belongs to its group and seq counts are consistent."""
    groups, order = {}, []
    for rec in raw:
        key = (rec.get("Env", ""), rec.get("Layer", ""), rec.get("System", ""))
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(rec)
    out = []
    for key in order:
        recs = groups[key]
        first = dict(recs[0])
        grp = (first.get("Endpoint_Group") or "").strip()
        def seq_of(r):
            m = re.match(r"\s*(\d+)", r.get("Host_Seq", "") or "")
            return int(m.group(1)) if m else 0
        hosts = [r.get("Host_or_Endpoint", "").strip()
                 for r in sorted(recs, key=seq_of)]
        joined = "; ".join(h for h in hosts if h)
        if grp:
            for h in hosts:
                if h and h not in grp:
                    raise ValueError(f"host '{h}' not in Endpoint_Group for "
                                     f"{key[2]} ({key[0]})")
            joined = grp
        n = len(recs)
        for r in recs:
            m = re.search(r"of\s*(\d+)", r.get("Host_Seq", "") or "")
            if m and int(m.group(1)) != n:
                raise ValueError(f"Host_Seq says {m.group(1)} hosts but sheet has "
                                 f"{n} for {key[2]} ({key[0]})")
        first["New_SEI_Hosts_or_Endpoint"] = joined
        first["_host_rows"] = [                 # preserved per-host split
            {"host_seq": i + 1, "host": h,
             "host_type": (r2.get("Host_Type") or "").strip()}
            for i, (h, r2) in enumerate(zip(hosts, sorted(recs, key=seq_of))) if h]
        out.append(first)
    return out

V5_TYPES = {"Deployment", "Job", "Descriptive", "Hostname", "Service", "IP/CIDR"}
V5_LAYER = {"INTEGRATION_HUB": "Platform", "FILE_SHARE": "File System",
            "DATA_HUB": "Database", "CONSUMERS": "Consumer",
            "IDENTITY": "Platform", "DATA_MOVEMENT": "Platform",
            "EXTERNAL": "External API"}

def _v5_fix_shift(rec):
    """Tolerate column-shifted rows (missing Namespace/Workload cells): if a
    known Workload_Type value sits in an earlier column, shift right-to-left."""
    if (rec.get("Workload_Type") or "").strip() in V5_TYPES:
        return rec, False
    for probe_col in ("Namespace", "Workload_Name"):
        if (rec.get(probe_col) or "").strip() in V5_TYPES:
            keys = list(rec.keys())
            i = keys.index(probe_col)
            j = keys.index("Workload_Type")
            vals = [rec[k] for k in keys]
            shifted = vals[:i] + [""] * (j - i) + vals[i:len(vals) - (j - i)]
            return dict(zip(keys, shifted)), True
    return rec, False

def _aggregate_workloads(raw):
    """v5 sheet -> system rows (UI contract unchanged) carrying _workloads."""
    fixed = 0
    groups, order = {}, []
    for rec in raw:
        rec, was = _v5_fix_shift(rec)
        fixed += was
        env = (rec.get("Environment") or rec.get("Env") or "").strip() \
            .upper().replace("/", "_")
        sysname = (rec.get("System") or "").strip()
        if not env or not sysname:
            continue
        k = (env, sysname)
        if k not in groups:
            groups[k] = []
            order.append(k)
        groups[k].append(rec)
    global LAST_V5_FIXED
    LAST_V5_FIXED = fixed
    out = []
    for (env, sysname) in order:
        recs = groups[(env, sysname)]
        first = recs[0]
        comp = (first.get("Component") or "").strip().upper()
        layer = V5_LAYER.get(comp, "Consumer")
        if comp == "DATA_MOVEMENT" and "SFTP" in sysname.upper():
            layer = "External SFTP"
        ns = next(((r.get("Namespace") or "").strip() for r in recs
                   if (r.get("Namespace") or "").strip()), "")
        hosts = []
        for r in recs:
            h = (r.get("New_SEI_Hosts_or_Endpoint") or "").strip()
            if h and h not in hosts and (r.get("Workload_Type") or "") \
                    not in ("Deployment", "Job"):
                hosts.append(h)
        if not hosts:
            hosts = [(first.get("New_SEI_Hosts_or_Endpoint") or "").strip()]
        joined = "; ".join(h for h in hosts if h)
        if ns:
            joined = (joined + "; " if joined else "") + "ns:" + ns
        ssl = next(((r.get("SSL_Expiry") or "").strip() for r in recs
                    if (r.get("SSL_Expiry") or "").strip()), "")
        agg = {"Env": env, "Layer": layer, "System": sysname,
               "New_SEI_Hosts_or_Endpoint": joined,
               "Sizing_RAM": first.get("Sizing_RAM", ""),
               "Sizing_CPU": first.get("Sizing_CPU", ""),
               "Sizing_Storage_or_Capacity":
                   first.get("Sizing_Storage_or_Capacity", ""),
               "Growth": first.get("Growth", ""),
               "Hosting": first.get("Hosting", ""),
               "Direction": first.get("Direction", ""),
               "Protocol_Port": first.get("Protocol_Port", ""),
               "Status_or_Notes": first.get("Status_or_Notes", ""),
               "SSL_Expiry": ssl,
               "Project": first.get("Project", ""),
               "Zone": first.get("Zone", ""),
               "Component": comp,
               "_workloads": [
                {"workload_key": ((r.get("Workload_Name") or "").strip()
                    or (r.get("New_SEI_Hosts_or_Endpoint") or "").strip())[:120],
                 "namespace": (r.get("Namespace") or "").strip()[:80],
                 "workload_name": (r.get("Workload_Name") or "").strip()[:80],
                 "workload_type": (r.get("Workload_Type") or "").strip()[:30],
                 "host": (r.get("New_SEI_Hosts_or_Endpoint") or "").strip()[:240],
                 "hc_type": (r.get("Health_Check_Type") or "").strip()[:30],
                 "hc_target": (r.get("Health_Check_Target") or "").strip()[:240],
                 "ssl_target": (r.get("SSL_Check_Target") or "").strip()[:240],
                 "endpoint_url": (r.get("Endpoint_URL") or "").strip()[:300],
                 "ssl_expiry": (r.get("SSL_Expiry") or "").strip(),
                 "notes": (r.get("Status_or_Notes") or "").strip()[:400],
                 "collection_instruction":
                     (r.get("Collection_Instruction") or "").strip()[:600]}
                for r in recs]}
        out.append(agg)
    return out

def _mk_row(rec, env, layer, system):
    row = {"env": env, "layer": layer, "system_name": system,
           "hosts": rec.get("New_SEI_Hosts_or_Endpoint", ""),
           "sizing_ram": rec.get("Sizing_RAM", ""),
           "sizing_cpu": rec.get("Sizing_CPU", ""),
           "sizing_storage": rec.get("Sizing_Storage_or_Capacity", ""),
           "growth": rec.get("Growth", ""), "hosting": rec.get("Hosting", ""),
           "direction": rec.get("Direction", ""),
           "protocol_port": rec.get("Protocol_Port", ""),
           "notes": rec.get("Status_or_Notes", ""),
           "ssl_expiry": rec.get("SSL_Expiry", "")}
    row["row_hash"] = _hash(row)          # hash EXCLUDES env-independent extras
    row["project"] = (rec.get("Project") or "SEI").strip().upper() or "SEI"
    row["zone"] = (rec.get("Zone") or "").strip().upper()
    row["component"] = (rec.get("Component") or "").strip().upper()
    do = (rec.get("Display_Order") or "").strip()
    row["display_order"] = int(do) if do.isdigit() else None
    row["workloads"] = rec.get("_workloads") or []
    row["host_rows"] = rec.get("_host_rows") or [
        {"host_seq": i + 1, "host": h.strip(), "host_type": ""}
        for i, h in enumerate((row["hosts"] or "").split(";")) if h.strip()]
    return row

def parse_sheet(data: bytes, filename: str = "infra.tsv"):
    """-> list of dicts with env + normalized columns + row_hash. Raises ValueError."""
    out, env_idx, seen_platform = [], -1, False
    raw = list(_rows_from_bytes(data, filename))
    if not raw:
        raise ValueError("empty sheet")
    if "Workload_Name" in raw[0] or "Health_Check_Type" in raw[0]:
        missing = [c for c in ("Environment", "System") if c not in raw[0]
                   and "Env" not in raw[0]]
    else:
        missing = [c for c in ("Layer", "System") if c not in raw[0]]
    if missing:
        raise ValueError(f"missing required columns: {missing}")
    global LAST_RULES
    LAST_RULES = [r for r in raw if _is_rule(r)]
    raw = [r for r in raw if not _is_rule(r)]
    if "Workload_Name" in raw[0] or "Health_Check_Type" in raw[0]:
        raw = _aggregate_workloads(raw)     # v5: one row per monitorable unit
    elif "Host_or_Endpoint" in raw[0]:      # per-host (normalized) sheet:
        raw = _aggregate_perhost(raw)       # one row per host -> one per system
    explicit_env = "Env" in raw[0] if raw else False
    for rec in raw:
        layer, system = rec.get("Layer", ""), rec.get("System", "")
        if not layer:
            continue
        if explicit_env:
            ev = (rec.get("Env") or "").strip().upper().replace("/", "_")
            if ev not in ENV_ORDER:
                raise ValueError(f"bad Env '{rec.get('Env')}' for {system} "
                                 f"(expected one of {ENV_ORDER})")
            envs = [ev]
            for env in envs:
                row = _mk_row(rec, env, layer, system)
                out.append(row)
            continue
        if layer == "Platform" and "Integration Hub" in system:
            env_idx += 1
            if env_idx >= len(ENV_ORDER):
                raise ValueError("more Platform blocks than known environments")
        if layer.startswith("External"):
            hosts = rec.get("New_SEI_Hosts_or_Endpoint", "")
            if "secureftp" in hosts and "qc" not in hosts:
                envs = ["PROD"]
            elif "qcsecureftp" in hosts:
                envs = ["DEV", "SIT", "TRIAL_UAT"]
            else:
                envs = ENV_ORDER[:]                        # API egress: all
        else:
            if env_idx < 0:
                raise ValueError("data row before first Platform block")
            envs = [ENV_ORDER[env_idx]]
        for env in envs:
            out.append(_mk_row(rec, env, layer, system))
    envs_seen = {r["env"] for r in out}
    v5_or_explicit = explicit_env or "Workload_Name" in (raw[0] if raw else {}) \
        or "Health_Check_Type" in (raw[0] if raw else {})
    if envs_seen != set(ENV_ORDER) and not v5_or_explicit:
        raise ValueError(f"expected 4 environments, detected: {sorted(envs_seen)}")
    if not envs_seen <= set(ENV_ORDER):
        raise ValueError(f"unknown environment(s): {sorted(envs_seen - set(ENV_ORDER))}")
    return out

def export_rows(rows, host_map=None):
    """rows -> CSV bytes. With host_map {(env,layer,system): [host dicts]} the
    export is PER-HOST (v4 format, round-trips through _aggregate_perhost);
    without it, one system per row with Env explicit."""
    if host_map:
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(["Env", "Layer", "System", "Host_or_Endpoint", "Host_Type",
                    "Host_Seq", "Zone", "Component", "Direction", "Protocol_Port",
                    "Hosting", "Sizing_RAM", "Sizing_CPU",
                    "Sizing_Storage_or_Capacity", "Growth", "Project",
                    "Status_or_Notes", "Endpoint_Group"])
        order = {e: i for i, e in enumerate(ENV_ORDER)}
        for r in sorted(rows, key=lambda r: (order.get(r["env"], 9),
                not (r["layer"] == "Platform"
                     and "Integration Hub" in r["system_name"]))):
            hs = host_map.get((r["env"], r["layer"], r["system_name"])) or [
                {"host_seq": 1, "host": r.get("hosts", ""), "host_type": ""}]
            for h in hs:
                w.writerow([r["env"], r["layer"], r["system_name"], h["host"],
                    h.get("host_type", ""), f"{h['host_seq']} of {len(hs)}",
                    r.get("zone", ""), r.get("component", ""), r["direction"],
                    r["protocol_port"], r["hosting"], r["sizing_ram"],
                    r["sizing_cpu"], r["sizing_storage"], r["growth"],
                    r.get("project", "SEI"), r["notes"], r.get("hosts", "")])
        return buf.getvalue().encode()
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["Env"] + COLS + ["Project", "Zone", "Component", "Display_Order"])
    keymap = ["layer", "system_name", "hosts", "sizing_ram", "sizing_cpu",
              "sizing_storage", "growth", "hosting", "direction", "protocol_port",
              "notes", "ssl_expiry"]
    order = {e: i for i, e in enumerate(ENV_ORDER)}
    for r in sorted(rows, key=lambda r: (order.get(r["env"], 9),
            not (r["layer"] == "Platform" and "Integration Hub" in r["system_name"]))):
        w.writerow([r["env"]] + [r.get(k, "") or "" for k in keymap]
                   + [r.get("project", "") or "", r.get("zone", "") or "",
                      r.get("component", "") or "",
                      "" if r.get("display_order") is None else r["display_order"]])
    return buf.getvalue().encode()
