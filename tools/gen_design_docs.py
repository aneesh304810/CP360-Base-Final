#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compose designs-md/*.md from the cited model.

The old design documents were written by hand before SEI's documents
were the base, and they were wrong in ways editing could not fix. These
are DERIVED instead: every claim comes from data that already carries
its section and page, so a document cannot drift from the model and a
correction to the model corrects every document that used it.

Run order:  node tools/export_design_model.mjs
            python3 tools/gen_design_docs.py
            python3 tools/build_design_docs.py
"""
import io, json, re, glob, os

M = json.load(open("data/design_model.json", encoding="utf-8"))
COMP = {c["id"]: c for c in M["SEI_COMPONENTS"]}
TBL  = {t["id"]: t for t in M["SEI_TABLES"]}
OPEN = {o["id"]: o for o in M["SEI_OPEN"]}
BBH  = {b["id"]: b for b in M["BBH_EXTENSION"]}
REG  = M["REGISTRY"]
DOCS = M["SEI_DOCS"]

def scen_for(cid):
    return [x for x in M["SCENARIOS"] if cid in x["c"]]

def lane_of(tid):
    for gid, lanes in M["LANES"].items():
        for l in lanes:
            if tid in (l.get("reg") or []):
                return gid, l
    return None, None

def conflicts_for(sei_ids, tname):
    """A conflict is relevant when it names an object this component owns."""
    hay = " ".join(COMP[i]["n"] for i in sei_ids if i in COMP) + " " + tname
    hay = hay.lower()
    out = []
    for c in M["ARCH_CONFLICTS"]:
        key = c["t"].lower()
        if (("raw" in key and "raw" in hay)
            or ("stage 2" in key and ("stg" in hay or "stage 2" in hay or "int" in hay))
            or ("gold" in key and ("dim" in hay or "fact" in hay or "gold" in hay))
            or ("correction" in key and "correction" in hay)
            or ("data quality" in key and ("dq" in hay or "quality" in hay))):
            out.append(c)
    return out

def md_escape(s):
    return (s or "").replace("|", "\\|")

def build(tid, name):
    r = REG.get(tid) or {}
    st = r.get("st", "absent")
    sei_ids = r.get("sei") or []
    gid, lane = lane_of(tid)
    L = []
    A = L.append
    A("# %s" % name)
    A("")

    # ---- 1. what it is
    A("## What this component is")
    A("")
    if r.get("why"):
        A(r["why"])
    elif sei_ids and sei_ids[0] in COMP:
        A(COMP[sei_ids[0]]["w"])
    elif sei_ids and sei_ids[0] in TBL:
        A(TBL[sei_ids[0]]["w"])
    A("")
    if lane:
        A("It sits in **%s**, in the **%s** lane (%s)."
          % (next(g["n"] for g in M["GROUPS"] if g["id"] == gid), lane["n"], lane["tech"]))
        A("")

    # ---- 2. what SEI specifies
    A("## What SEI specifies")
    A("")
    if st == "absent":
        A("**Nothing.** Neither SEI design document covers this component.")
        A("")
        if r.get("why"):
            A(r["why"])
            A("")
        A("That is not a judgement on whether it is needed. It means no")
        A("design exists to build from, and writing one is BBH's to do and")
        A("SEI's to confirm.")
        A("")
    else:
        if st == "differs":
            A("**SEI covers the need and answers it differently.** %s"
              % r.get("why", ""))
            A("")
        for i in sei_ids:
            if i in COMP:
                c = COMP[i]
                A("### %s — %s" % (c["id"], c["n"]))
                A("")
                A(c["w"])
                A("")
                A("- **Technology.** %s" % c["tech"])
                A("- **Source.** %s" % c["ev"])
                A("")
            elif i in TBL:
                t = TBL[i]
                A("### %s — %s" % (t["id"], t["n"]))
                A("")
                A(t["w"])
                A("")
                A("- **Columns.** %s" % t["cols"])
                A("- **Source.** %s" % t["ev"])
                A("")

    # ---- 3. the Oracle objects
    tbls = []
    for i in sei_ids:
        if i in COMP:
            tbls += COMP[i].get("tbl") or []
        elif i in TBL:
            tbls.append(i)
    tbls = [x for n, x in enumerate(tbls) if x not in tbls[:n]]
    if tbls:
        A("## The Oracle objects it touches")
        A("")
        A("No foreign key is declared in either document. Every join below")
        A("is one a model runs, not a constraint the database enforces.")
        A("")
        A("| Object | What it holds | Source |")
        A("|---|---|---|")
        for x in tbls:
            t = TBL[x]
            A("| `%s` | %s | %s |" % (t["n"], md_escape(t["w"]), t["ev"]))
        A("")

    # ---- 4. behaviour when things go wrong
    scen = []
    for i in sei_ids:
        scen += scen_for(i)
    scen = [x for n, x in enumerate(scen) if x["id"] not in [y["id"] for y in scen[:n]]]
    if scen:
        A("## What happens when it goes wrong")
        A("")
        A("| # | Scenario | What the design does | Source |")
        A("|---|---|---|---|")
        for x in scen:
            A("| %s | %s | %s | %s |"
              % (x["id"], md_escape(x["s"]), md_escape(x["r"]), x["ev"]))
        A("")

    # ---- 5. where SEI disagrees with SEI
    cf = conflicts_for(sei_ids, name)
    if cf:
        A("## Where SEI's documents disagree about this")
        A("")
        A("Each one is a decision to take before a model is written.")
        A("")
        for c in cf:
            A("### %s — %s" % (c["id"], c["t"]))
            A("")
            A("- **The architecture says.** %s" % c["arch"])
            A("- **The design documents say.** %s" % c["doc"])
            A("- **Why it matters.** %s" % c["why"])
            A("")

    # ---- 6. still open
    opens = []
    for i in sei_ids:
        if i in COMP:
            opens += COMP[i].get("open") or []
    opens = sorted(set(opens))
    if opens:
        A("## Still open with SEI")
        A("")
        A("SEI's own ids, so they can be quoted straight back.")
        A("")
        for o in opens:
            if o in OPEN:
                A("- **%s.** %s" % (o, OPEN[o]["t"]))
        A("")

    # ---- 7. sources
    A("## Sources")
    A("")
    A("- **%s v%s** — %s" % (DOCS["ingest"]["title"], DOCS["ingest"]["version"],
                             DOCS["ingest"]["author"]))
    A("- **%s v%s** — %s" % (DOCS["dbt"]["title"], DOCS["dbt"]["version"],
                             DOCS["dbt"]["author"]))
    A("- **%s v%s** — %s" % (M["SEI_ARCH_DOC"]["title"],
                             M["SEI_ARCH_DOC"]["version"],
                             M["SEI_ARCH_DOC"]["author"]))
    A("")
    A("Generated from the cited model, not written by hand. Correct the")
    A("model and every document that used it is corrected with it:")
    A("`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`")
    A("")
    return "\n".join(L)

def proposal(cid, name):
    """A component this programme's review proposed. Not SEI's, not the
    workbook's. It gets a page that says so rather than a withdrawal
    notice, because a proposal is a real thing with a real argument
    behind it \u2014 it is just not a commitment."""
    L = []
    A = L.append
    A("# %s" % name)
    A("")
    A("## What this is")
    A("")
    A("A component proposed by this programme's own review. It is not in")
    A("either SEI design document and it is not in the delivery workbook.")
    A("Its id is above 100 so it can never be mistaken for a tracker")
    A("component.")
    A("")
    A("## Why it was proposed")
    A("")
    A("The review asked what would have to exist if events, rather than")
    A("files, were the primary way data arrives. BBH has since confirmed")
    A("that they are: **%s is the primary inbound route and %s is the"
      % (M["INBOUND_POSTURE"]["primary"], M["INBOUND_POSTURE"]["secondary"]))
    A("secondary one.**")
    A("")
    A(M["INBOUND_POSTURE"]["consequence"])
    A("")
    A("## What would have to be true")
    A("")
    A("Both SEI design documents describe the file path and only the file")
    A("path. The completeness gate counts files that arrived, the")
    A("business-date state machine opens one date at a time, and the SLA")
    A("measures a cutoff for a set of files. None of those hold for a")
    A("continuous event stream without being redesigned.")
    A("")
    A("## Status")
    A("")
    A("Proposed, not approved and not specified. It goes on the")
    A("architecture drawing when SEI's documents cover it or BBH formally")
    A("adopts it. Until then it is in the event container, drawn apart.")
    A("")
    A("## Sources")
    A("")
    A("- This programme's events-primary review")
    A("- Inbound posture: %s" % M["INBOUND_POSTURE"]["src"])
    A("")
    A("Generated from the cited model, not written by hand.")
    A("")
    return "\n".join(L)


# ---------------------------------------------------------------------
# The pack-level documents: the overviews a reader hits before any
# component. Composed from the same model, so the overview and the
# component pages cannot disagree.

def _sources():
    L = ["## Sources", ""]
    for k in ("ingest", "dbt"):
        d = DOCS[k]
        L.append("- **%s v%s** \u2014 %s" % (d["title"], d["version"], d["author"]))
    a = M["SEI_ARCH_DOC"]
    L.append("- **%s v%s** \u2014 %s" % (a["title"], a["version"], a["author"]))
    L += ["", "Generated from the cited model, not written by hand.", ""]
    return L

def pack_architecture():
    L = ["# CP Integration Hub \u2014 architecture", "",
         "## The three documents, and that they disagree", ""]
    L.append("SEI has given three documents. Two are design documents and")
    L.append("one is the architecture, and they do not describe the same")
    L.append("build. Every conflict below is a decision to take before a")
    L.append("model is written.")
    L.append("")
    L.append("| # | The question | The architecture says | The design documents say |")
    L.append("|---|---|---|---|")
    for c in M["ARCH_CONFLICTS"]:
        L.append("| %s | %s | %s | %s |" % (c["id"], md_escape(c["t"]),
                 md_escape(c["arch"]), md_escape(c["doc"])))
    L += ["", "## The seam between the two design documents", "",
          "The line is **%s**." % M["SEI_BOUNDARY"]["line"], "",
          M["SEI_BOUNDARY"]["note"], "",
          "*%s*" % " \u00b7 ".join(M["SEI_BOUNDARY"]["ev"]), ""]
    L += ["## Inbound", "",
          "**Primary: %s. Secondary: %s.** (%s)"
          % (M["INBOUND_POSTURE"]["primary"], M["INBOUND_POSTURE"]["secondary"],
             M["INBOUND_POSTURE"]["src"]), "",
          M["INBOUND_POSTURE"]["note"], "",
          M["INBOUND_POSTURE"]["consequence"], ""]
    o = M["OUTBOUND_FLOW"]
    L += ["## Outbound \u2014 %s" % o["n"], "", "*%s*" % o["src"], "",
          "| # | Who | What happens |", "|---|---|---|"]
    for st in o["steps"]:
        L.append("| %s | %s | %s |" % (st["n"], st["a"], md_escape(st["t"])))
    L += ["", o["note"], ""]
    L += ["## The containers", "", "| Container | What is in it |", "|---|---|"]
    for g in M["GROUPS"]:
        lanes = " \u00b7 ".join(l["n"] for l in M["LANES"].get(g["id"], []))
        L.append("| **%s** | %s |" % (g["n"], lanes))
    L += [""]
    L += _sources()
    return "\n".join(L)

def pack_layers():
    L = ["# The layer model", "", "## As BBH states it", "",
         M["BBH_LAYERS"]["note"], "", M["BBH_LAYERS"]["beyond"], "",
         "**Why it matters.** " + M["BBH_LAYERS"]["why_it_matters"], "",
         "*%s*" % M["BBH_LAYERS"]["src"], "",
         "## The stage chain", "",
         "| Stage | What it is | What is in it |", "|---|---|---|"]
    for st in M["PROC_STAGES"]:
        ids = " ".join("`%s`" % x for x in (st["sei"] + st["tbl"] + st["bbh"]))
        L.append("| **%s** \u2014 %s | %s | %s |"
                 % (st["n"], st["sub"], md_escape(st["w"]), ids or "\u2014"))
    L += ["", "## As the architecture states it", "",
          "| Layer | Technology | Objects |", "|---|---|---|"]
    for l in M["ARCH_LAYERS"]:
        L.append("| **%s** | %s | %s |" % (l["n"], l["tech"],
                 ", ".join("`%s`" % o for o in l["objects"]) or "\u2014"))
    L += ["", "## The feeds, and what each does to Gold", "",
          "| Feed | Files | Pattern | Gold |", "|---|---|---|---|"]
    for fd in M["ARCH_FEEDS"]:
        L.append("| **%s** \u2014 %s | %s | %s | %s |"
                 % (fd["n"], fd["sub"], " \u00b7 ".join(fd["files"]),
                    fd["pattern"], md_escape(fd["gold"])))
    L += [""]
    L += _sources()
    return "\n".join(L)

def pack_errors():
    L = ["# Error handling, DQ and recovery", "",
         "Every scenario both SEI design documents describe, with what the",
         "design does and where it says so. Nothing here is inferred.", ""]
    areas = []
    for x in M["SCENARIOS"]:
        if x["a"] not in areas:
            areas.append(x["a"])
    for a in areas:
        L += ["## %s" % a, "", "| # | Scenario | What the design does | Source |",
              "|---|---|---|---|"]
        for x in [y for y in M["SCENARIOS"] if y["a"] == a]:
            L.append("| %s | %s | %s | %s |" % (x["id"], md_escape(x["s"]),
                     md_escape(x["r"]), x["ev"]))
        L.append("")
    L += ["## Not covered by either document", "",
          "Asked about often, and in neither document. Listed so they are",
          "raised rather than answered by whoever is writing the model that",
          "day.", ""]
    for g in M["SCENARIO_GAPS"]:
        L.append("- %s" % g)
    L += [""]
    L += _sources()
    return "\n".join(L)

def pack_stages():
    return pack_layers()

def pack_openshift():
    L = ["# OpenShift platform", "",
         "## What SEI's documents actually say about the platform", "",
         "Less than people assume. Both design documents assume OpenShift",
         "and specify only what the pipeline needs from it.", ""]
    rows = [(cid, r) for cid, r in REG.items()
            if (M["TRACKER_COMPONENTS"] and True)]
    byid = {c["id"]: c for c in M["TRACKER_COMPONENTS"]}
    L += ["| # | Component | Verdict | What SEI says, or why not |",
          "|---|---|---|---|"]
    for cid, r in sorted(REG.items(), key=lambda kv: int(kv[0])):
        c = byid.get(cid)
        if not c or c.get("zone") != "4. OpenShift":
            continue
        L.append("| %s | %s | %s | %s |" % (cid, c["component"],
                 M["REG_STATE"][r["st"]][1], md_escape(r.get("why", ""))))
    L += [""]
    L += _sources()
    return "\n".join(L)

PACK = {
 "architecture": pack_architecture,
 "l2-planes": pack_architecture,
 "l2-plane-drilldowns": pack_architecture,
 "l3-stages": pack_stages,
 "l3-stage1-stage2": pack_stages,
 "l3-errors": pack_errors,
 "l3-error-handling": pack_errors,
 "openshift": pack_openshift,
 "openshift-platform": pack_openshift,
}

SUB = {"specified": "specified by SEI, cited",
       "differs":   "SEI answers this differently - see below",
       "absent":    "not in either SEI design document"}

n_real, n_absent, n_prop, n_pack = 0, 0, 0, 0
for f in sorted(glob.glob("designs-md/*.md")):
    src = io.open(f, encoding="utf-8").read()
    m = re.match(r'(---\n.*?\n---\n)', src, re.S)
    if not m:
        continue
    fm = m.group(1)
    cid = re.search(r'^component_id:\s*(\S+)', fm, re.M)
    if not cid:                      # the pack-level overview documents
        did = re.search(r'^id:\s*(\S+)', fm, re.M)
        did = did.group(1).strip() if did else os.path.basename(f)[:-3]
        body = PACK.get(did)
        if not body:
            continue
        fm = re.sub(r'^withdrawn:.*\n', '', fm, flags=re.M)
        fm = fm[:-4] + "generated: true\nsei_status: overview\n---\n"
        io.open(f, "w", encoding="utf-8").write(fm + "\n" + body())
        n_pack += 1
        continue
    cid = cid.group(1).strip()
    name = re.search(r'^component_name:\s*(.+)$', fm, re.M)
    name = name.group(1).strip() if name else "Component %s" % cid
    if cid not in REG:               # ids 101+, the review's own
        fm = re.sub(r'^withdrawn:.*\n', '', fm, flags=re.M)
        fm = fm[:-4] + "generated: true\nsei_status: proposal\n---\n"
        io.open(f, "w", encoding="utf-8").write(fm + "\n" + proposal(cid, name))
        n_prop += 1
        continue
    st = (REG[cid] or {}).get("st", "absent")
    fm = re.sub(r'^withdrawn:.*\n', '', fm, flags=re.M)
    if st != "absent":
        n_real += 1
    else:
        n_absent += 1
    fm = fm[:-4] + "generated: true\nsei_status: %s\n---\n" % st
    io.open(f, "w", encoding="utf-8").write(fm + "\n" + build(cid, name))
print("design documents written: %d with SEI content, %d recording an absence, "
      "%d proposals, %d overviews" % (n_real, n_absent, n_prop, n_pack))
