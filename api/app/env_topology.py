"""Generate the Environment 360 topology + probe manifest for one env
from env_infra rows — the JSON contract the NOC view renders."""
import re

NODE_MAP = [   # (layer, system-substring) -> node id, zone, icon
    (("Platform", "Integration Hub"), ("app.hub", "CP INTEGRATION HUB · OPENSHIFT", "⚙️")),
    (("File System", "Landing"), ("dmz.cifs", "DMZ · MFT / EGRESS", "🗄")),
    (("Database", "IMDS"), ("data.imds", "DATA ZONE", "🛢")),
    (("Database", "PBDW"), ("data.pbdw", "DATA ZONE", "🛢")),
    (("Consumer", "Pivotal"), ("cons.piv", "CONSUMERS", "🏢")),
    (("Consumer", "Client Portal"), ("cons.portal", "CONSUMERS", "🖥")),
    (("Consumer", "CRD"), ("cons.vendor", "CONSUMERS", "☁️")),
    (("Consumer", "PORT"), ("cons.vendor", "CONSUMERS", "☁️")),
    (("External SFTP", "SFTP"), ("dmz.mft", "DMZ · MFT / EGRESS", "📥")),
    (("Platform", "Momentum"), ("dmz.momentum", "DMZ · MFT / EGRESS", "⚙")),
    (("Platform", "PingFederate"), ("corp.ping", "CORP · USERS / IDENTITY", "🔐")),
    (("Platform", "OCP Ingress"), ("app.ingress", "CP INTEGRATION HUB · OPENSHIFT", "🌐")),
    (("Platform", "Observability"), ("mgmt.stack", "CORP · USERS / IDENTITY", "📊")),
    (("External API", "SEI SWP Platform"), ("ext.sei", "EXTERNAL", "☁")),
    (("External API", "SEI SaaS"), ("ext.saas", "EXTERNAL", "☁")),
    (("External API", "Proxy Egress"), ("egr.allowlist", "EXTERNAL", "🌐")),
    # The Azure band. A workbook row with layer "Azure" lands here and
    # REPLACES the planned placeholder of the same id below, so the board
    # moves from design state to inventory one row at a time.
    (("Azure", "Kafka"),              ("az.kafka",   "SEI AZURE · SDC",  "📨")),
    (("Azure", "reader account"),     ("az.rdr",     "SEI AZURE · SDC",  "❄")),
    (("Azure", "OCSP"),               ("az.ocsp",    "SEI AZURE · SDC",  "🔏")),
    (("Azure", "internal stage"),     ("az.stage",   "SEI AZURE · SDC",  "🪣")),
    (("Azure", "endpoint · Kafka"),   ("az.pekafka", "BBH AZURE · VNET", "🔗")),
    (("Azure", "endpoint · SQL"),     ("az.pesql",   "BBH AZURE · VNET", "🔗")),
    (("Azure", "endpoint · stage"),   ("az.peblob",  "BBH AZURE · VNET", "🔗")),
    (("Azure", "DNS"),                ("az.dns",     "BBH AZURE · VNET", "🧭")),
    (("Azure", "Gateway"),            ("az.gw",      "BBH AZURE · VNET", "🛣")),
]

# DESIGN STATE, emitted for every env until a row replaces it. From SEI's
# "SDC Technical Architecture": the client sits in its own Azure VNet with a
# private endpoint, DNS servers and a peering/gateway back to its sites,
# reaching a Snowflake READER account over Private Link, the internal stage
# on a second private endpoint, and OCSP on the same private zone. Nothing
# here is provisioned, so every node and lane is planned+tbd and the board
# draws it amber and dashed. URL shapes are SEI's placeholders, never names.
PLANNED_NODES = [   # titles fit beside the PLANNED tag; PE = private endpoint
    ("az.kafka",   "SEI AZURE · SDC",  "📨", "Kafka · BBH queue",     "SEI Kafka infra · dedicated topics · ACL"),
    ("az.rdr",     "SEI AZURE · SDC",  "❄",  "Snowflake reader acct", "{SEI_org}-{client}_rdr_acc"),
    ("az.ocsp",    "SEI AZURE · SDC",  "🔏", "OCSP responder",        "ocsp.{account}.privatelink… · TLS"),
    ("az.stage",   "SEI AZURE · SDC",  "🪣", "Internal stage · blob", "{storage_acct}.privatelink.blob…"),
    ("az.pekafka", "BBH AZURE · VNET", "🔗", "PE · Kafka brokers",    "private endpoint · every advertised broker"),
    ("az.pesql",   "BBH AZURE · VNET", "🔗", "PE · SQL + OCSP",       "private endpoint · path 1 · account URLs"),
    ("az.peblob",  "BBH AZURE · VNET", "🔗", "PE · stage blob",       "private endpoint · path 3 · PUT GET"),
    ("az.dns",     "BBH AZURE · VNET", "🧭", "Private DNS zones ×2",  "snowflakecomputing · blob.core.windows"),
    ("az.gw",      "BBH AZURE · VNET", "🛣", "Gateway → BBH sites",   "ExpressRoute or VPN · U1 open"),
]
PLANNED_LANES = [   # id, from, to, rule, why it is open
    ("az-kafka", "az.pekafka", "az.kafka", "Kafka 9093",   "held connection · every advertised broker · Q1"),
    ("az-sql",   "az.pesql",   "az.rdr",   "443 · path 1", "account network policy must admit the PE · Q2"),
    ("az-ocsp",  "az.pesql",   "az.ocsp",  "OCSP 80/443",  "unresolvable OCSP = TLS fails, looks random"),
    ("az-blob",  "az.peblob",  "az.stage", "443 · path 3", "path 1 alone passes tests, fails on first batch · Q3"),
    ("az-dns",   "az.dns",     "az.pesql", "resolve",      "two private zones, linked to every resolving VNet"),
    ("az-hub",   "az.gw",      "app.hub",  "ExpressRoute / VPN", "site topology not established · U1"),
]
LANES = [   # from, to, rule-source: which row's protocol_port governs the crossing
    ("sei-mft",     "ext.sei",   "dmz.mft",    "dmz.mft"),
    ("mft-cifs",    "dmz.mft",   "dmz.cifs",   None),
    ("cifs-hub",    "dmz.cifs",  "app.hub",    "dmz.cifs"),
    ("hub-imds",    "app.hub",   "data.imds",  "data.imds"),
    ("hub-pbdw",    "app.hub",   "data.pbdw",  "data.pbdw"),
    ("hub-piv",     "app.hub",   "cons.piv",   "cons.piv"),
    ("hub-portal",  "app.hub",   "cons.portal","cons.portal"),
    ("out-apigee",  "app.hub",   "dmz.apigee", None),
    ("apigee-sei",  "dmz.apigee","ext.seiapi", "egr.allowlist"),
    ("apigee-vendor","dmz.apigee","cons.vendor","cons.vendor"),
]

def _port_of(pp):
    if not pp or "TBD" in pp.upper():
        return None, True
    m = re.search(r"(\d{2,5})", pp)
    return (m.group(1) if m else pp), False

AUTO_ZONE = {"Database": ("data", "DATA ZONE", "🛢", "app.hub"),
             "Consumer": ("cons", "CONSUMERS", "🔹", "data.pbdw"),
             "File System": ("dmz", "DMZ · MFT / EGRESS", "🗄", "app.hub"),
             "Platform": ("app", "CP INTEGRATION HUB · OPENSHIFT", "⚙️", "corp.f5"),
             "External API": ("ext", "EXTERNAL", "🌐", "dmz.apigee"),
             "External SFTP": ("ext", "EXTERNAL", "🌐", "dmz.mft")}

def _slug(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower())[:16]

def build_topology(rows, env):
    ers = [r for r in rows if r["env"] == env]
    nodes, by_id = [], {}
    for r in ers:
        for (layer, frag), (nid, zone, icon) in NODE_MAP:
            if r["layer"] == layer and frag in r["system_name"]:
                n = by_id.get(nid)
                sub = r["hosts"][:90]
                sizing = " · ".join(x for x in (r["sizing_ram"], r["sizing_cpu"]
                          and r["sizing_cpu"] + "c", r["sizing_storage"]) if x)[:60]
                if n:                       # CRD+PORT share cons.vendor
                    n["sub"] += " | " + r["system_name"]
                else:
                    by_id[nid] = {"id": nid, "zone": zone, "icon": icon,
                                  "title": r["system_name"], "sub": sub,
                                  "sizing": sizing, "hosting": r["hosting"],
                                  "probe": nid, "tbd": "TBD" in (r["notes"] or "").upper()
                                             or "TBD" in (r["protocol_port"] or "TBD").upper()}
                    nodes.append(by_id[nid])
    port_by_node = {}
    for r in ers:
        for (layer, frag), (nid, _, _) in NODE_MAP:
            if r["layer"] == layer and frag in r["system_name"]:
                port_by_node.setdefault(nid, r.get("protocol_port", ""))
    lanes = []
    for lid, a, b, src in LANES:
        port, tbd = _port_of(port_by_node.get(src, "") if src else "internal")
        lanes.append({"id": lid, "from": a, "to": b,
                      "rule": port or "TBD", "tbd": tbd, "probe": "path." + lid})
    allowlists = [
        {"id": "al_in", "edge": "sei-mft", "direction": "inbound",
         "label": "SEI source IPs @ BBH MFT",
         "detail": next((r["hosts"] for r in ers if r["layer"] == "External SFTP"), ""),
         "state": "REQUESTED"},
        {"id": "al_out", "edge": "apigee-sei", "direction": "egress",
         "label": "BBH egress ranges @ SEI",
         "detail": next((r["hosts"] for r in ers if "Proxy Egress" in r["system_name"]), ""),
         "state": "REQUESTED"},
    ]
    # ---- dynamic fallback: rows the catalog doesn't know become auto components ----
    known = set()
    for r in ers:
        for (layer, frag), _ in NODE_MAP:
            if r["layer"] == layer and frag in r["system_name"]:
                known.add((r["layer"], r["system_name"]))
    for r in ers:
        if (r["layer"], r["system_name"]) in known or r["layer"] not in AUTO_ZONE:
            continue
        pfx, zone, icon, src = AUTO_ZONE[r["layer"]]
        nid = f"{pfx}.{_slug(r['system_name'])}"
        port, tbd = _port_of(r.get("protocol_port"))
        nodes.append({"id": nid, "zone": zone, "icon": icon, "auto": True,
                      "title": r["system_name"], "sub": r["hosts"][:90],
                      "sizing": "", "hosting": r["hosting"], "probe": nid, "tbd": tbd})
        lanes.append({"id": f"{_slug(r['system_name'])}-auto", "from": src, "to": nid,
                      "rule": port or "TBD", "tbd": tbd, "auto": True,
                      "probe": f"path.{_slug(r['system_name'])}-auto"})
    # ---- the Azure band: planned placeholders for anything no row has replaced ----
    have = {n["id"] for n in nodes}
    for nid, zone, icon, title, sub in PLANNED_NODES:
        if nid in have:
            continue
        nodes.append({"id": nid, "zone": zone, "icon": icon, "title": title, "sub": sub,
                      "sizing": "", "hosting": "Azure", "probe": None,
                      "tbd": True, "planned": True})
    have = {n["id"] for n in nodes}
    for lid, a, b, rule, why in PLANNED_LANES:
        if a in have and b in have:
            lanes.append({"id": lid, "from": a, "to": b, "rule": rule, "tbd": True,
                          "planned": True, "why": why, "probe": None})
    asks = [{"where": r["layer"] + " · " + r["system_name"], "what": r["protocol_port"] or "port TBD",
             "note": r["notes"]} for r in ers
            if "TBD" in (r.get("protocol_port") or "TBD").upper()]
    return {"env": env, "nodes": nodes, "lanes": lanes,
            "allowlists": allowlists, "asks": asks}
