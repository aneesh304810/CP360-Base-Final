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

# Membership is by exception, exactly as hubGroups.js has it: a component
# names its lane, or it falls into its container by plane. Matching only
# the explicit lane lists left 23 components with no container at all, so
# they silently received none of their domain's gaps.
BY_PLANE = {
    "Source": "ingress", "Ingress/Egress": "ingress", "Processing": "processing",
    "Orchestration": "orchestration", "Data Quality": "processing",
    "Foundation": "foundation", "Consumers": "processing",
    "Platform": "openshift", "Runtime": "openshift", "Deployment": "openshift",
    "Operations": "openshift", "Event Ingestion": "events",
    "PS-Orchestration": "ingress",
}
OVERRIDE = {"23": "ingestion", "24": "ingestion", "9": "ingestion",
            "13": "ingestion"}
_TRK = {c["id"]: c for c in M["TRACKER_COMPONENTS"]}

def group_of(tid):
    if tid in OVERRIDE:
        return OVERRIDE[tid]
    c = _TRK.get(tid)
    return BY_PLANE.get((c or {}).get("plane"), "foundation") if c else None

def lane_of(tid):
    for gid, lanes in M["LANES"].items():
        for l in lanes:
            if tid in (l.get("reg") or []):
                return gid, l
    g = group_of(tid)
    if g:
        lanes = M["LANES"].get(g) or []
        return g, (lanes[-1] if lanes else None)
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

# ---------------------------------------------------------------------
# The supplement material, joined onto each component.
#
# WHICH SUPPLEMENT DOMAIN A COMPONENT BELONGS TO is derived from its
# container, because the container grouping is BBH's own and the
# supplement's eleven domains are nearly the same list in the same words.
# Where they differ the mapping is explicit rather than fuzzy-matched, so
# a reader can see the decision instead of guessing at a regex.
# Mirrors stageOfTracker in hubGroups.js, which the exported JSON does not
# carry because it is a function rather than data.
STAGE_OF = {"14": "stage1", "15": "stage2int", "16": "stage2int",
            "17": "stage2int", "37": "stage3", "38": "stage3", "39": "stage3",
            "40": "stage3", "41": "stage3", "43": "stage3"}
GROUP_TO_DOMAIN = {
    "ingress":       "Ingress and Egress",
    "ingestion":     "Ingestion",
    "orchestration": "Orchestration",
    "processing":    "Processing",
    "foundation":    "Foundation",
    "openshift":     "OpenShift Platform",
    "events":        "SEI Data Cloud Events",
}
# Stage to canonical tier, in the supplement's four-tier terminology. Note
# that this is the SUPPLEMENT's reading, which conflicts with the stage
# chain for Stage 3 - see finding R1. Both are printed.
STAGE_TO_TIER = {
    "stage1":    "Stage 1 - RAW",
    "stage2":    "Stage 2 - Enriched (STG)",
    "stage2int": "Stage 2 - Enriched (INT)",
    "stage3":    "Stage 3 - Pre-Gold, and Consumer Movement",
}
# Which reconciliation findings land on which container. Explicit, because
# matching a finding to a component by keyword produced false hits on
# every document that happened to contain the word "gateway".
FINDING_GROUPS = {
    "R1": ["processing"], "R2": ["processing"],
    "R3": ["ingestion"], "R4": ["processing", "foundation"],
    "R5": ["processing"], "R6": ["ingress", "foundation"],
    "R7": ["processing", "foundation"], "R8": ["ingress"],
    "R9": ["processing", "foundation"], "R10": ["processing"],
    "R11": ["foundation"], "R12": ["processing"],
    "R13": ["openshift", "foundation"], "R14": ["ingestion", "ingress"],
    "R15": ["openshift"], "R16": ["ingestion"], "R17": ["orchestration"],
    "R18": ["processing"], "R19": ["events"],
    "R20": ["ingress"], "R21": ["ingress"], "R22": ["ingress", "openshift"],
    "R23": ["ingress"], "R24": ["ingress", "foundation"],
    "R25": ["foundation"],
}
RC_LABEL = {"conflict": "Conflict", "closes": "Closes a gap",
            "extends": "New", "agrees": "Confirms the baseline"}

def findings_for(gid):
    if not gid:
        return []
    return [r for r in M["RECONCILE"] if gid in FINDING_GROUPS.get(r["id"], [])]

def gaps_for_domain(dom):
    return [g for g in M["GAP_REGISTER"] if g["dom"] == dom]

def _design_blocks(gid, name):
    """The DESIGN the supplement adds - contracts, rules and policies.

    This is not the gap analysis. It is content that belongs inside the
    component it describes: a reader of the landing-zone design should
    find the readiness convention under how it works, not in a list of
    what is missing. The analysis lives in one document, linked from the
    single line _open_line writes.
    """
    L = []
    A = L.append
    blocks = list(M["GAP_DESIGN"].get(gid) or [])
    # The gateway review describes exactly one component.
    if gid == "ingress" and re.search(r'gateway|apigee', name, re.I):
        blocks = blocks + [
            {"h": "Header policy", "cols": ["Header category", "Required behaviour"],
             "rows": [[h[0], h[1]] for h in M["GW_HEADERS"]]},
            {"h": "A governed operation declares",
             "items": ["`%s`" % f for f in M["GW_OPERATION"]]},
            {"h": "Vendor token cache",
             "cols": ["State", "Meaning", "Transitions"],
             "rows": [[x[0], x[1], x[2]] for x in M["GW_TOKEN_STATES"]]},
            {"h": "Configuration split",
             "items": ["**ConfigMap, non-secret.** `%s`"
                       % "`, `".join(M["GW_SECRETS"]["configmap"]),
                       "**Secret, sensitive.** `%s`"
                       % "`, `".join(M["GW_SECRETS"]["secret"]),
                       M["GW_SECRETS"]["startup"]]},
        ]
    if not blocks:
        return []
    for b in blocks:
        A("### %s" % b["h"])
        A("")
        if b.get("rows"):
            cols = b.get("cols") or []
            A("| %s |" % " | ".join(cols))
            A("|%s" % ("---|" * len(cols)))
            for r in b["rows"]:
                A("| %s |" % " | ".join(md_escape(x) for x in r))
        else:
            for x in b["items"]:
                A("- %s" % x)
        A("")
    return L

def _open_line(gid, dom, name):
    """One line, not a chapter.

    The gap analysis used to be pasted into all 91 documents, which put a
    commentary about which document disagrees with which between the
    reader and the design. The findings still matter, so the count and
    the ids stay - as a pointer, in one line.
    """
    fs = findings_for(gid)
    gs = gaps_for_domain(dom) if dom else []
    if not (fs or gs):
        return []
    ids = [g["id"] for g in gs] + [r["id"] for r in fs]
    conf = len([r for r in fs if r["v"] == "conflict"])
    bits = []
    if conf:
        bits.append("%d unresolved conflict%s" % (conf, "" if conf == 1 else "s"))
    rest = len(ids) - conf
    if rest:
        bits.append("%d other open item%s" % (rest, "" if rest == 1 else "s"))
    return ["## Open against this component", "",
            "**%s** \u2014 `%s`. Stated in full, with both readings and the "
            "decision each needs, in the gap supplement."
            % (" and ".join(bits), "`, `".join(ids)), ""]

def _supplement_section(gid, dom, sei_ids, tname):
    """Everything the two supplements say about this component."""
    L = []
    A = L.append
    fs = findings_for(gid)
    gs = gaps_for_domain(dom) if dom else []
    # The gateway review belongs to exactly one lane and nowhere else.
    gw = gid == "ingress" and ("gateway" in tname.lower()
                               or "apigee" in tname.lower()
                               or "api" in tname.lower())
    if not (fs or gs or gw):
        return []
    A("## Gaps and decisions that land here")
    A("")
    A("From the consolidated gap supplement and the CP-Integration-Gateway")
    A("readiness review. These arrived after the SEI baseline and in several")
    A("places disagree with it; where they do, both readings are given and")
    A("neither is silently adopted.")
    A("")
    if gs:
        A("### Gap register")
        A("")
        A("| Gap | What is missing | Required disposition |")
        A("|---|---|---|")
        for g in gs:
            A("| `%s` | %s | %s |" % (g["id"], md_escape(g["g"]),
                                      md_escape(g["d"])))
        A("")
    if fs:
        A("### Against what this design already says")
        A("")
        for r in fs:
            A("#### %s \u2014 %s" % (RC_LABEL[r["v"]], r["t"]))
            A("")
            A("- **The supplement says.** %s" % r["sup"])
            A("- **This design holds.** %s" % r["hub"])
            if r.get("cost"):
                A("- **What it costs to leave open.** %s" % r["cost"])
            if r.get("dec") and r["dec"] != "none":
                A("- **Decision.** `%s`" % r["dec"])
            A("")
    if gw:
        A("### CP-Integration-Gateway readiness")
        A("")
        A(M["GW_DOC"]["verdict"])
        A("")
        A("| Gap | What is missing | Blocks production |")
        A("|---|---|---|")
        for g in M["GW_GAPS"]:
            A("| `%s` | %s | %s |" % (g["id"], md_escape(g["g"]),
                                      "yes" if g["sev"] == "block" else "no"))
        A("")
        A("A governed operation declares `%s`. There is no quota or"
          % "`, `".join(M["GW_OPERATION"]))
        A("rate-limit field among them, which is the finding in R21.")
        A("")
    return L

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

    # ---- 6b. the design the supplement adds, in place; the analysis as
    #          one line pointing at the one document that carries it
    dom = GROUP_TO_DOMAIN.get(gid)
    blocks = _design_blocks(gid, name)
    if blocks:
        A("## How this works, from the architecture supplement")
        A("")
        L += blocks
    L += _open_line(gid, dom, name)

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

def pack_gap():
    g, L = M["GAP_DOC"], []
    A = L.append
    A("# Gap supplement \u2014 what it changes")
    A("")
    A(g["w"])
    A("")
    A("Built from: %s." % ", ".join(g["sources"]))
    A("")
    A("## Precedence when documents conflict")
    A("")
    for i, x in enumerate(M["GAP_PRECEDENCE"], 1):
        A("%d. %s" % (i, x))
    A("")
    A("## The four-tier model")
    A("")
    A("The single most consequential thing in the supplement, and not what")
    A("the stage chain in this corpus draws. See R1 and R2 below.")
    A("")
    A("| Tier | Canonical name | Responsibility |")
    A("|---|---|---|")
    for x in M["GAP_TIERS"]:
        A("| **%s** | %s | %s |" % (x["tier"], x["n"], md_escape(x["w"])))
    A("")
    A("## Gap register")
    A("")
    A("| Gap | What is missing | Required disposition | Domain |")
    A("|---|---|---|---|")
    for x in M["GAP_REGISTER"]:
        A("| `%s` | %s | %s | %s |" % (x["id"], md_escape(x["g"]),
                                       md_escape(x["d"]), x["dom"]))
    A("")
    A("## What the supplements change about this corpus")
    A("")
    A("%d findings. Holding a second design document beside the first is"
      % len(M["RECONCILE"]))
    A("worth nothing unless somebody compares them. Nothing below is")
    A("silently resolved: where the two disagree, both readings are stated")
    A("and the decision is named.")
    A("")
    for v in ("conflict", "closes", "extends", "agrees"):
        rs = [r for r in M["RECONCILE"] if r["v"] == v]
        A("### %s \u2014 %d" % (RC_LABEL[v], len(rs)))
        A("")
        for r in rs:
            A("#### `%s` %s" % (r["id"], r["t"]))
            A("")
            A("- **The supplement says.** %s" % r["sup"])
            A("- **This corpus holds.** %s" % r["hub"])
            if r.get("cost"):
                A("- **What it costs to leave open.** %s" % r["cost"])
            if r.get("dec") and r["dec"] != "none":
                A("- **Decision.** `%s`" % r["dec"])
            if r.get("where"):
                A("- **Lands on.** %s" % r["where"])
            A("")
    A("## Canonical traceability identifiers")
    A("")
    A("| Identifier | Scope | Propagation rule |")
    A("|---|---|---|")
    for x in M["GAP_IDENTIFIERS"]:
        A("| `%s` | %s | %s |" % (x[0], md_escape(x[1]), md_escape(x[2])))
    A("")
    A("## Foundation entities")
    A("")
    A("| Entity | Purpose | Exists |")
    A("|---|---|---|")
    for x in M["GAP_FOUNDATION"]:
        A("| `%s` | %s | %s |" % (x[0], md_escape(x[1]),
                                  "yes" if x[2] else "**no table anywhere**"))
    A("")
    A("## Stage 2 to Stage 3")
    A("")
    A(M["GAP_MOVEMENT"]["w"])
    A("")
    A("**The gate.** %s" % M["GAP_MOVEMENT"]["gate"])
    A("")
    A("**Replay boundary.** %s" % M["GAP_MOVEMENT"]["replay"])
    A("")
    A("## Reconciliation boundaries")
    A("")
    A("Seven. The pack specifies three; the architect review recommends")
    A("twelve under an event-primary posture. See R4.")
    A("")
    for x in M["GAP_RECON"]:
        A("- %s" % x)
    A("")
    A("## Decisions required before build completion")
    A("")
    A("| Decision | What must be settled |")
    A("|---|---|")
    for x in M["GAP_DECISIONS"]:
        A("| `%s` | %s |" % (x[0], md_escape(x[1])))
    A("")
    A("## Acceptance criteria")
    A("")
    for k, label in (("arch", "Architecture"), ("silver", "Stage 2 Silver")):
        A("### %s" % label)
        A("")
        for i, x in enumerate([a for a in M["GAP_ACCEPTANCE"] if a[0] == k], 1):
            A("%d. %s" % (i, x[1]))
        A("")
    A("## Naming standard")
    A("")
    A("| Object type | Pattern | Example |")
    A("|---|---|---|")
    for x in M["GAP_NAMING"]:
        A("| %s | `%s` | `%s` |" % (x[0], x[1], x[2]))
    A("")
    A("## Code finding \u2014 `%s`" % M["GAP_CODE_FINDING"]["model"])
    A("")
    A(M["GAP_CODE_FINDING"]["w"])
    A("")
    A(M["GAP_CODE_FINDING"]["why"])
    A("")
    A(M["GAP_CODE_FINDING"]["fix"])
    A("")
    A("## HA and DR")
    A("")
    A("No numerical RTO or RPO is established. Values require formal BBH")
    A("approval. Open:")
    A("")
    for x in M["GAP_HADR_OPEN"]:
        A("- %s" % x)
    A("")
    L += _sources()
    return "\n".join(L)

def pack_gateway():
    d, L = M["GW_DOC"], []
    A = L.append
    A("# CP-Integration-Gateway \u2014 readiness")
    A("")
    A(d["w"])
    A("")
    A("**Verdict.** %s" % d["verdict"])
    A("")
    A("Stack: %s." % ", ".join(d["stack"]))
    A("")
    A("## What is already right")
    A("")
    for x in M["GW_STRENGTHS"]:
        A("- %s" % x)
    A("")
    A("## Gap register")
    A("")
    A("| Gap | What is missing | Required response | Blocks production |")
    A("|---|---|---|---|")
    for x in M["GW_GAPS"]:
        A("| `%s` | %s | %s | %s |" % (x["id"], md_escape(x["g"]),
                                       md_escape(x["d"]),
                                       "**yes**" if x["sev"] == "block" else "no"))
    A("")
    A("## Risks")
    A("")
    A("| Risk | What it is | Closure evidence |")
    A("|---|---|---|")
    for x in M["GW_RISKS"]:
        A("| `%s` | %s | %s |" % (x[0], md_escape(x[1]), md_escape(x[2])))
    A("")
    A("## A governed operation")
    A("")
    A("Declared before any outbound call is built:")
    A("")
    for x in M["GW_OPERATION"]:
        A("- `%s`" % x)
    A("")
    A("**There is no quota or rate-limit field on this list.** The boundary")
    A("design names gateway rate limiting as the thing that enforces the")
    A("key-set collapser's restraint, and as the mitigation for a consumer")
    A("read-storm starving ingestion. That mitigation has no implementation")
    A("named anywhere. See R21.")
    A("")
    A("## Header policy")
    A("")
    A("| Header category | Required behaviour |")
    A("|---|---|")
    for x in M["GW_HEADERS"]:
        A("| %s | %s |" % (x[0], md_escape(x[1])))
    A("")
    A("## The vendor token cache")
    A("")
    A("In memory, and therefore per pod: the refresh count scales with")
    A("replicas rather than with work. See R23.")
    A("")
    A("| State | What it means | Transitions |")
    A("|---|---|---|")
    for x in M["GW_TOKEN_STATES"]:
        A("| `%s` | %s | %s |" % (x[0], md_escape(x[1]), md_escape(x[2])))
    A("")
    A("### Required tests")
    A("")
    for x in M["GW_TOKEN_TESTS"]:
        A("- %s" % x)
    A("")
    A("## Secret hygiene")
    A("")
    A(M["GW_SECRETS"]["never"])
    A("")
    A("%s %s" % (M["GW_SECRETS"]["rotate"], M["GW_SECRETS"]["startup"]))
    A("")
    A("- **ConfigMap, non-secret.** `%s`" % "`, `".join(M["GW_SECRETS"]["configmap"]))
    A("- **Secret, sensitive.** `%s`" % "`, `".join(M["GW_SECRETS"]["secret"]))
    A("")
    A("## OpenShift runtime objects")
    A("")
    A("| Object | In place |")
    A("|---|---|")
    for x in M["GW_RUNTIME_OBJECTS"]:
        A("| %s | %s |" % (md_escape(x[0]), "yes" if x[1] else "**not yet**"))
    A("")
    A("## Observability")
    A("")
    for x in M["GW_METRICS"]:
        A("- %s" % x)
    A("")
    A("### Runbooks required")
    A("")
    for x in M["GW_RUNBOOKS"]:
        A("- %s" % x)
    A("")
    A("## Production approval criteria")
    A("")
    A("All twelve are required. This is not a scorecard.")
    A("")
    for i, x in enumerate(M["GW_APPROVAL"], 1):
        A("%d. %s" % (i, x))
    A("")
    A("## Prioritised action plan")
    A("")
    for k, label in (("immediate", "Immediate"),
                     ("short", "Short-term delivery increment"),
                     ("later", "Subsequent hardening")):
        A("### %s" % label)
        A("")
        for x in M["GW_PLAN"][k]:
            A("- %s" % x)
        A("")
    return "\n".join(L)

def pack_stage1():
    L = ["# Stage 1 \u2014 the RAW data model", ""]
    A = L.append
    A("**%s.** %s" % (M["S1_SHAPE"]["n"], M["S1_SHAPE"]["w"]))
    A("")
    A("*%s*" % M["S1_SHAPE"]["ev"])
    A("")
    A("There is no canonical model here, and that is the design. Stage 1")
    A("holds what arrived, in the shape it arrived in. The first normalised")
    A("model is Stage 2 INT.")
    A("")
    A("## The five rules")
    A("")
    A("| Rule | What it means |")
    A("|---|---|")
    for x in M["S1_RULES"]:
        A("| **%s** | %s |" % (x[0], md_escape(x[1])))
    A("")
    A("## The only columns Stage 1 adds")
    A("")
    A("| Column | Type | Purpose |")
    A("|---|---|---|")
    for x in M["S1_COLS"]:
        A("| `%s` | %s | %s |" % (x[0], x[1], md_escape(x[2])))
    A("")
    A("`LOAD_ID` is **not** among them, and the supplement makes it the")
    A("identifier preserved across all four tiers. See R9.")
    A("")
    A("## The RAW tables")
    A("")
    A("| Table | Named by |")
    A("|---|---|")
    for x in M["S1_TABLES"]:
        A("| `%s` | %s |" % (x["n"], "both sources" if x["doc"]
                             else "**the architecture only**"))
    A("")
    A("### Conflict %s \u2014 %s" % (M["S1_CONFLICT"]["id"], M["S1_CONFLICT"]["t"]))
    A("")
    A(M["S1_CONFLICT"]["w"])
    A("")
    A(M["S1_CONFLICT"]["why"])
    A("")
    A("## What Stage 1 does not answer")
    A("")
    for x in M["S1_NOT_HERE"]:
        A("- %s" % x)
    A("")
    L += _sources()
    return "\n".join(L)

def pack_stage2():
    L = ["# Stage 2 \u2014 Silver, Enriched, the normalised canonical model", ""]
    A = L.append
    bs = M["GAP_BUILD_STATUS"]
    A("%d canonical tables across %d business domains, %d relationships, "
      "fed only by STG PASS rows."
      % (len(M["S2_TABLES"]), len(M["S2_DOMAINS"]), len(M["S2_RELS"])))
    A("")
    A("**%d of the %d exist in code**, and four of those are mapped to fewer"
      % (len(bs), len(M["S2_TABLES"])))
    A("attributes than the canonical model defines. The rest are targets.")
    A("See R10.")
    A("")
    A("## The INT contract")
    A("")
    A("| Concern | Contract |")
    A("|---|---|")
    for x in M["S2_CONTRACT"]:
        A("| %s | %s |" % (x[0], md_escape(x[1])))
    A("")
    A("## Standard columns, on all %d" % len(M["S2_TABLES"]))
    A("")
    A("Not in the canonical dictionary. Required by the contract, so every")
    A("dictionary key is short by at least one column.")
    A("")
    A("| Column | Type | Purpose |")
    A("|---|---|---|")
    for x in M["S2_STD_COLS"]:
        A("| `%s` | %s | %s |" % (x[0], x[1], md_escape(x[2])))
    A("")
    A("## Domains")
    A("")
    A("| Domain | Tables | Built |")
    A("|---|---|---|")
    for d in M["S2_DOMAINS"]:
        built = len([r for r in M["S2_TABLES"]
                     if r[0] == d["k"] and r[1] in bs])
        A("| %s | %d | %d |" % (d["n"], d["c"], built))
    A("")
    A("## Every canonical table")
    A("")
    A("The INT key is the dictionary key **plus** `BUSINESS_DATE`.")
    A("")
    A("| Table | Domain | INT key | Source sheet | Build |")
    A("|---|---|---|---|---|")
    dn = {d["k"]: d["n"] for d in M["S2_DOMAINS"]}
    for r in M["S2_TABLES"]:
        key = (r[2] + ", BUSINESS_DATE") if r[2] else "no dictionary key defined"
        A("| `%s` | %s | `%s` | %s | %s |"
          % (r[1], dn.get(r[0], r[0]), md_escape(key), r[4],
             bs.get(r[1], "target")))
    A("")
    A("## Model gaps")
    A("")
    A("| # | Gap | Recommendation | Blocks |")
    A("|---|---|---|---|")
    for g in M["S2_GAPS"]:
        A("| %s | %s | %s | %s |" % (g["n"], md_escape(g["g"]),
                                     md_escape(g["r"]),
                                     "**yes**" if g["block"] else "no"))
    A("")
    L += _sources()
    return "\n".join(L)

def pack_feeds():
    S, L = M["FEED_SUMMARY"], []
    A = L.append
    A("# SWP feed \u2014 Stage 1 RAW \u2014 Stage 2 canonical")
    A("")
    A("Neither document publishes this map. The only real one is")
    A("`FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE`, which is configuration rather")
    A("than a list, so the chain from a file to a canonical table exists")
    A("nowhere on paper. What follows is matched by name and labelled with")
    A("how confident that match is.")
    A("")
    A("**%d of %d feeds have no Stage 1 landing table named by either"
      % (S["none"], S["feeds"]))
    A("document**, and two of them \u2014 %s \u2014 are anchors of the Stage 2"
      % " and ".join(S["anchorsUnmapped"]))
    A("model.")
    A("")
    A("| | Count |")
    A("|---|---|")
    A("| Feeds | %d |" % S["feeds"])
    A("| RAW table named | %d |" % S["named"])
    A("| Inferred | %d |" % S["likely"])
    A("| No RAW table | %d |" % S["none"])
    A("")
    A("## One feed is not one table")
    A("")
    A("| Feed | Canonical tables |")
    A("|---|---|")
    for f in M["FAN_OUT"]:
        A("| %s | %d |" % (f["feed"], len(f["tables"])))
    A("")
    A("## The map")
    A("")
    A("| Feed | Stage 1 RAW | Confidence | Stage 2 canonical tables |")
    A("|---|---|---|---|")
    for f in M["FEEDS"]:
        A("| %s | %s | %s | `%s` |"
          % (f["feed"], ("`%s`" % f["raw"]) if f["raw"] else "\u2014",
             f["conf"], "`, `".join(f["tables"])))
    A("")
    A("## RAW tables with no feed")
    A("")
    A("%s are named by the architecture but have no source sheet in the"
      % " and ".join("`%s`" % x for x in M["RAW_WITHOUT_FEED"]))
    A("canonical model. Corrections arrive as a re-delivery rather than as a")
    A("feed of their own \u2014 or they do not, and which reading is right is")
    A("conflict C4.")
    A("")
    L += _sources()
    return "\n".join(L)

def pack_db():
    L = ["# The database model", ""]
    A = L.append
    A("Two bands. The data path is where rows live and is what a business")
    A("reader follows. The control plane decides whether they move and is")
    A("what an operator follows at 3am.")
    A("")
    A("## The data path")
    A("")
    A("| Layer | Kind | What it holds | Written by | Read by |")
    A("|---|---|---|---|---|")
    for x in M["DB_PATH"]:
        A("| **%s** \u2014 %s | %s | %s | %s | %s |"
          % (x["n"], x["layer"], x["kind"], md_escape(x["w"]),
             x["writes"], x["reads"]))
    A("")
    A("## The control plane")
    A("")
    A("| Table | Role | What it holds | Written by | Read by |")
    A("|---|---|---|---|---|")
    for x in M["DB_CONTROL"]:
        A("| `%s` | %s | %s | %s | %s |"
          % (x["n"], x["role"], md_escape(x["w"]), x["writes"], x["reads"]))
    A("")
    A(M["DB_NOTE"])
    A("")
    A("## Not built")
    A("")
    for x in M["DB_ABSENT"]:
        A("- **`%s`** \u2014 %s. %s" % (x["n"], x["route"], x["w"]))
    A("")
    A("The outbound one now has a design in the supplement's workflow ERD:")
    A("`%s`." % "`, `".join("%s %s %s" % (a, b, c)
                            for a, b, c in M["GAP_OUTBOUND_ERD"]))
    A("")
    L += _sources()
    return "\n".join(L)

PACK = {
 "gap-supplement": pack_gap,
 "gateway-review": pack_gateway,
 "stage1-raw-model": pack_stage1,
 "stage2-canonical-model": pack_stage2,
 "feed-to-stage1-map": pack_feeds,
 "database-model": pack_db,
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

def _fm(fm, **kv):
    """Rewrite the front matter.

    EVERY GENERATED KEY IS STRIPPED BEFORE IT IS RE-ADDED. The previous
    version appended generated: and sei_status: on each run without
    removing the last pair, so a document regenerated three times carried
    three copies of both - which is exactly the duplicate-front-matter
    defect the supplement asks to be fixed during regeneration.
    """
    body = fm[4:-4] if fm.startswith("---\n") else fm
    for k in list(kv) + ["withdrawn", "generated", "sei_status",
                         "architecture_domain", "canonical_tier",
                         "upstream_components", "downstream_components",
                         "control_entities", "traceability_identifiers",
                         "supplement"]:
        body = re.sub(r'^%s:.*\n(?:[ \t]+.*\n)*' % re.escape(k), '', body,
                      flags=re.M)
    add = "".join("%s: %s\n" % (k, v) for k, v in kv.items() if v is not None)
    return "---\n" + body + add + "---\n"

# The control entities every component in a container touches, and the
# identifiers it has to carry. Both come from the supplement.
CONTROL_OF = {
    "ingestion":     "[FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL]",
    "ingress":       "[FILE_REGISTRY, WORKFLOW_INSTANCE, LOADER_DELIVERY, STATUS_EVENT]",
    "orchestration": "[DATE_CONTROL, FILE_REGISTRY]",
    "processing":    "[DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]",
    "foundation":    "[FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]",
    "events":        "[MICRO_BATCH_REGISTRY]",
    "openshift":     "[]",
}
IDS_OF = {
    "ingestion":     "[FILE_ID, LOAD_ID, BUSINESS_DATE, DAG_RUN_ID]",
    "ingress":       "[CORRELATION_ID, IDEMPOTENCY_KEY, EVENT_ID]",
    "orchestration": "[BUSINESS_DATE, DAG_RUN_ID]",
    "processing":    "[LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]",
    "foundation":    "[PROJECT_ID, FILE_ID, LOAD_ID, BUSINESS_DATE, CORRELATION_ID]",
    "events":        "[EVENT_ID, CORRELATION_ID, BUSINESS_DATE]",
    "openshift":     "[]",
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
        fm = _fm(fm, generated="true", sei_status="overview")
        io.open(f, "w", encoding="utf-8").write(fm + "\n" + body())
        n_pack += 1
        continue
    cid = cid.group(1).strip()
    name = re.search(r'^component_name:\s*(.+)$', fm, re.M)
    name = name.group(1).strip() if name else "Component %s" % cid
    if cid not in REG:               # ids 101+, the review's own
        # groupOfTracker sends every id past 100 to the event container,
        # which is right for the listener and wrong for the outbound ones.
        # The names are unambiguous, so the exception is by name.
        pg = "ingress" if re.search(
            r'loader|callback|outbound|submission|gateway|status',
            name, re.I) else "events"
        body = proposal(cid, name)
        blocks = _design_blocks(pg, name)
        extra = ((["## How this works, from the architecture supplement", ""]
                  + blocks) if blocks else []) \
                + _open_line(pg, GROUP_TO_DOMAIN[pg], name)
        fm = _fm(fm, generated="true", sei_status="proposal",
                 architecture_domain=GROUP_TO_DOMAIN[pg],
                 canonical_tier="not on the stage chain",
                 control_entities=CONTROL_OF[pg],
                 traceability_identifiers=IDS_OF[pg],
                 supplement="CP360-GAP-DESIGN-SUPPLEMENT")
        if extra:
            body = body.replace("\n## Sources", "\n" + "\n".join(extra)
                                + "\n## Sources", 1)
            if "## Sources" not in body:
                body = body + "\n" + "\n".join(extra)
        io.open(f, "w", encoding="utf-8").write(fm + "\n" + body)
        n_prop += 1
        continue
    st = (REG[cid] or {}).get("st", "absent")
    if st != "absent":
        n_real += 1
    else:
        n_absent += 1
    gid, _lane = lane_of(cid)
    stg = STAGE_OF.get(cid)
    fm = _fm(fm, generated="true", sei_status=st,
             architecture_domain=GROUP_TO_DOMAIN.get(gid, "Foundation"),
             canonical_tier=STAGE_TO_TIER.get(stg, "not on the stage chain"),
             control_entities=CONTROL_OF.get(gid, "[]"),
             traceability_identifiers=IDS_OF.get(gid, "[]"),
             supplement="CP360-GAP-DESIGN-SUPPLEMENT")
    io.open(f, "w", encoding="utf-8").write(fm + "\n" + build(cid, name))
print("design documents written: %d with SEI content, %d recording an absence, "
      "%d proposals, %d overviews" % (n_real, n_absent, n_prop, n_pack))
