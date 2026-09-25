#!/usr/bin/env python3
"""Compile designs-md/*.md -> ui/src/designDocsData.js (pre-parsed blocks).
This IS the ingestion: edit/add a .md, run this, rebuild the UI.
Blocks: h (sub-heading) · p (text) · ul (items) · tbl (rows) · pre (code).
Inline **bold** and `code` markers survive for the UI's inline renderer."""
import re, json, glob, sys, os

def parse_front(text):
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    front = {'_raw': m.group(1)}
    for line in m.group(1).split('\n'):
        k, _, v = line.partition(':')
        v = v.strip()
        front[k.strip()] = (True if v == 'true' else v)
    return front, text[m.end():]

def split_sections(body):
    parts, cur, buf = [], "", []
    for line in body.split('\n'):
        if line.startswith('# ') and not line.startswith('## '):
            continue
        if line.startswith('## '):
            if cur or any(x.strip() for x in buf):
                parts.append((cur, '\n'.join(buf).rstrip()))
            cur, buf = line[3:].strip(), []
        else:
            buf.append(line)
    if cur or any(x.strip() for x in buf):
        parts.append((cur, '\n'.join(buf).rstrip()))
    return parts

def parse_body(body):
    sections, cur = [], None
    blocks, ul, tbl, pre, in_pre, pre_lang = [], [], [], [], False, ""
    def flush_ul():
        nonlocal ul
        if ul: blocks.append({"t": "ul", "items": ul}); ul = []
    def flush_tbl():
        nonlocal tbl
        if tbl: blocks.append({"t": "tbl", "rows": tbl}); tbl = []
    def close_section():
        nonlocal blocks, cur
        flush_ul(); flush_tbl()
        if cur is not None or blocks:
            sections.append({"h": cur or "", "blocks": blocks})
        blocks = []
    for line in body.split('\n'):
        if in_pre:
            if line.strip() == '```':
                if pre_lang == "svg":
                    blocks.append({"t": "svg", "x": '\n'.join(pre)})
                else:
                    blocks.append({"t": "pre", "x": '\n'.join(pre), "lang": pre_lang})
                pre = []; in_pre = False; pre_lang = ""
            else: pre.append(line)
            continue
        fence = re.match(r'^```(\w*)\s*$', line.strip())
        if fence and not in_pre:
            flush_ul(); flush_tbl(); in_pre = True; pre_lang = fence.group(1); continue
        if line.startswith('# ') and not line.startswith('## '):
            continue                                   # doc title lives in front-matter
        if line.strip() in ('---', '***'):
            flush_ul(); flush_tbl(); continue          # horizontal rules
        if line.startswith('## '):
            close_section(); cur = line[3:].strip(); continue
        if line.startswith('### '):
            flush_ul(); flush_tbl(); blocks.append({"t": "h", "x": line[4:].strip()}); continue
        if line.startswith('- '):
            flush_tbl(); ul.append(line[2:].strip()); continue
        if line.startswith('|'):
            flush_ul()
            if re.match(r'\|[-| ]+\|$', line.strip()): continue
            tbl.append([c.strip() for c in line.strip().strip('|').split('|')]); continue
        if line.strip() == '':
            flush_ul(); flush_tbl(); continue
        flush_ul(); flush_tbl()
        blocks.append({"t": "p", "x": line.strip()})
    close_section()
    return sections

PLANE_STYLE = {
    "Processing":   ("🧪", "#0e8f7e", "#dff2ef"),
    "Ingress":      ("📥", "#0b5e83", "#e0f5fd"),
    "Ingress/Egress": ("📥", "#0b5e83", "#e0f5fd"),
    "Egress":       ("📤", "#0b5e83", "#e0f5fd"),
    "DQ":           ("🛡", "#a8560f", "#fae5d3"),
    "Quality":      ("🛡", "#a8560f", "#fae5d3"),
    "Orchestration":("🛠", "#6d3ac0", "#efe6fb"),
    "Foundation":   ("🧱", "#5a6472", "#eef1f4"),
}
def listify(v):
    return [x.strip() for x in str(v).strip('[]').split(',') if x.strip()]

def adapt_component_doc(front, path):
    """His prompt contract -> pipeline doc config. component_id pins the Design column."""
    cid = str(front['component_id']).strip()
    icon, color, bg = PLANE_STYLE.get(front.get('plane', ''), ("📐", "#0f4775", "#e6eef5"))
    return {
        "id": f"c{cid}",
        "title": front.get('component_name', f'Component {cid}'),
        "level": "L3", "icon": icon, "color": color, "bg": bg,
        "order": 100 + int(cid),
        "sub": f"#{cid} · {front.get('zone','')} · {front.get('plane','')} · "
               f"{front.get('technology','')} · {front.get('priority','')} · "
               f"custom {front.get('custom_build','')} · status {front.get('status','')}",
        "match": "", "zone_default": "", "default": False,
        "component_ids": [cid],
        "chip": f"#{cid} design",
        "meta": {
            "status": front.get('status',''), "owner": front.get('owner',''),
            "priority": front.get('priority',''), "custom": front.get('custom_build',''),
            "depends_on": listify(front.get('depends_on','')),
            "decisions": listify(front.get('architecture_decisions','')),
            "tiers": listify(front.get('pipeline_tiers','')),
            "updated": front.get('last_updated',''),
        },
        "src": os.path.basename(path),
    }

docs = []
for path in sorted(glob.glob('designs-md/*.md')):
    front, body = parse_front(open(path, encoding='utf-8').read())
    if 'component_id' in front:                       # component-design contract
        doc = adapt_component_doc(front, path)
    else:                                             # pack contract
        doc = {
            "id": front["id"], "title": front["title"], "level": front["level"],
            "icon": front["icon"], "color": front["color"], "bg": front["bg"],
            "order": int(front["order"]), "sub": front.get("sub", ""),
            "match": front.get("match", ""), "zone_default": front.get("zone_default", ""),
            "default": front.get("default", False) is True,
            "component_ids": [x.strip() for x in str(front.get("component_ids", "")).split(",") if x.strip()],
            "chip": "", "meta": {},
            "src": os.path.basename(path),
        }
    secs = []
    for h, raw in split_sections(body):
        parsed = parse_body(('## ' + h + '\n' if h else '') + raw)
        blocks = parsed[0]["blocks"] if parsed else []
        secs.append({"h": h, "md": raw, "blocks": blocks})
    doc["sections"] = secs
    doc["fm_raw"] = front.get('_raw', '')
    docs.append(doc)
docs.sort(key=lambda d: d["order"])
js = "// GENERATED by tools/build_design_docs.py from designs-md/*.md — do not edit by hand.\n"
js += "// To add or change a design document: edit the .md, re-run the script, rebuild the UI.\n"
js += "export const DESIGN_DOCS = " + json.dumps(docs, indent=0, ensure_ascii=False) + ";\n"
open('ui/src/designDocsData.js', 'w', encoding='utf-8').write(js)
total = sum(len(d['sections']) for d in docs)
print(f"designDocsData.js: {len(docs)} docs · {total} sections · {len(js)//1024}KB")
for d in docs:
    print(f"  {d['order']}. {d['id']:<22} {len(d['sections'])} sections")
