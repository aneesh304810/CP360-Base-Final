"""The Azure band of the Environment 360 topology is DESIGN STATE until a
workbook row replaces each placeholder, and it must never carry a name.

WHY THESE ASSERTIONS. The band exists so the network and security teams see
the SDC / Private Link side on the same board as the on-prem estate before
anything is provisioned. Three ways that goes wrong silently:

  * a placeholder that survives after the real row arrives would draw two
    boxes for one thing, so a row with layer "Azure" must REPLACE it;
  * a planned lane whose end is missing would draw a line to nowhere, so a
    lane is emitted only when both ends exist;
  * the planned catalogue is committed source, so it may hold SEI's URL
    placeholders ({SEI_org}, {storage_acct}) but no hostname, IP address,
    CIDR, subscription or account name.

    python api/test/test_env_topology.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from api.app.env_topology import (build_topology, PLANNED_NODES,            # noqa: E402
                                  PLANNED_LANES, NODE_MAP)

bad = 0


def ok(cond, msg):
    global bad
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        bad += 1


def row(layer, name, hosts="x-placeholder", pp="443", env="DEV", notes=""):
    return {"env": env, "layer": layer, "system_name": name, "hosts": hosts,
            "sizing_ram": "", "sizing_cpu": "", "sizing_storage": "", "growth": "",
            "hosting": "On-prem", "direction": "", "protocol_port": pp, "notes": notes}


BASE = [row("Platform", "CP Integration Hub"), row("Database", "IMDS"),
        row("External SFTP", "SEI SFTP", pp="22")]

# 1. empty inventory still shows the whole band, all planned, all tbd, no probe
t = build_topology(BASE, "DEV")
planned = [n for n in t["nodes"] if n.get("planned")]
ok(len(planned) == len(PLANNED_NODES), "every planned node is emitted when no row covers it")
ok(all(n["tbd"] and n["probe"] is None for n in planned), "planned nodes are tbd and never probed")
ok({n["zone"] for n in planned} == {"SEI AZURE · SDC", "BBH AZURE · VNET"}, "planned nodes sit in the two Azure zones only")
plan_lanes = [l for l in t["lanes"] if l.get("planned")]
ok(len(plan_lanes) == len(PLANNED_LANES), "every planned lane is emitted when both ends exist")
ok(all(l["tbd"] and l.get("why") for l in plan_lanes), "every planned lane says why it is open")
ok(any(l["id"] == "az-hub" and l["to"] == "app.hub" for l in plan_lanes), "the band joins the on-prem board at the hub")

# 2. without the hub, the cross-board lane is withheld rather than dangling
t2 = build_topology([row("Database", "IMDS")], "DEV")
ok(not any(l["id"] == "az-hub" for l in t2["lanes"]), "no hub row -> no az-hub lane to nowhere")

# 3. a workbook row with layer Azure replaces the placeholder of the same id
t3 = build_topology(BASE + [row("Azure", "Snowflake reader account", hosts="rdr-placeholder", pp="443")], "DEV")
rdr = [n for n in t3["nodes"] if n["id"] == "az.rdr"]
ok(len(rdr) == 1, "one az.rdr node, not placeholder plus row")
ok(not rdr[0].get("planned") and rdr[0]["sub"] == "rdr-placeholder", "the row wins: inventory, not design state")
ok(any(l["id"] == "az-sql" for l in t3["lanes"]), "the planned lane still draws to the real node")

# 4. a row for another env does not leak into this one
t4 = build_topology(BASE + [row("Azure", "Kafka", env="UAT")], "DEV")
ok(any(n["id"] == "az.kafka" and n.get("planned") for n in t4["nodes"]), "another env's Azure row leaves DEV's placeholder in place")

# 5. the committed catalogue carries structure only
IP = re.compile(r"\b\d{1,3}(\.\d{1,3}){3}\b")
CIDR = re.compile(r"/\d{1,2}\b")
HOST = re.compile(r"\b[a-z0-9-]+\.(bbh|sei|seic|snowflakecomputing|azure|windows)\.(com|net)\b", re.I)
GUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
text = " ".join(" ".join(map(str, p)) for p in PLANNED_NODES + PLANNED_LANES) + \
       " ".join(" ".join(map(str, k)) for k, _ in NODE_MAP)
ok(not IP.search(text), "no IP address in the planned catalogue")
ok(not CIDR.search(text), "no CIDR mask in the planned catalogue")
ok(not HOST.search(text), "no hostname in the planned catalogue")
ok(not GUID.search(text), "no subscription or tenant GUID in the planned catalogue")
ok("{SEI_org}" in text and "{storage_acct}" in text, "URL shapes are SEI's placeholders")
ok(all(len(n[3]) <= 21 for n in PLANNED_NODES), "planned titles fit beside the PLANNED tag")

print()
print("env_topology assertions " + ("FAIL" if bad else "pass"))
if bad:
    sys.exit(1)
