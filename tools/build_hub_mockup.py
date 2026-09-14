#!/usr/bin/env python3
"""Regenerate hub_design_c4_mockup.html: C4 landing + status dashboard + drill + editor.
Run after build_design_docs.py. Shares JS with tools/mockup_template.html."""
import re, json

tr = open('ui-src/seiDesignTracker.js').read()
comps = json.loads(re.search(r'export const TRACKER_COMPONENTS = (.*?);\n\nexport', tr, re.S).group(1))
docs = json.loads(re.search(r'export const DESIGN_DOCS = (.*?);\n$', open('ui-src/designDocsData.js').read(), re.S).group(1))

RULES = [
 ("OUT",  r'outbound|producer'),
 ("LZ",   r'landing|sftp|file arrival|manifest|sensor|archive|checksum'),
 ("RAW",  r'\braw\b|stage ?1|python ingestion|ingestion framework|structural|g1|loader framework'),
 ("ENR",  r'stage ?2|enrich|dbt|dedup|conform|correction|latest|bitemporal'),
 ("GOLD", r'gold|exadata|scd2|fact|tie.?out|g4|publish|movement'),
 ("ORCH", r'airflow|orchestr|dag|schedul|batch control|calendar|dependenc'),
 ("GW",   r'gateway|real.?time|envoy|apigee|\bapi\b|jwt|oidc'),
 ("META", r'metadata|config|registry|dq |data quality|quality framework|rule|recon|lineage|audit'),
]
for c in comps:
    hay = f"{c['component']} {c['plane']} {c['deliverable']}".lower()
    c['container'] = 'PLATFORM' if c['zone'] == '4. OpenShift' else \
        next((k for k, rx in RULES if re.search(rx, hay)), 'CROSS')

REQ = ['1','2','3','4a','4b','4c','5','6','7','8','9','10']
for d in docs:
    if not d.get('meta') or not d['meta'].get('status'):
        d['anatomy'] = None; continue
    found = set()
    for s in d['sections']:
        m = re.match(r'(\d+[abc]?)[\.\s]', s['h'].strip())
        if m: found.add(m.group(1))
    missing = [r for r in REQ if r not in found]
    fm = d['meta']; fmi = []
    if fm.get('owner','TBD') in ('TBD',''): fmi.append('owner TBD')
    if not fm.get('depends_on'): fmi.append('no depends_on')
    if not fm.get('decisions'): fmi.append('no ADs')
    d['anatomy'] = {"score": len(REQ)-len(missing), "of": len(REQ), "missing": missing, "fm": fmi}

slim = [{k: c[k] for k in ('id','zone','plane','component','deliverable','technology',
        'priority','custom','status','container')} for c in comps]
DATA = json.dumps({"comps": slim, "docs": docs}, ensure_ascii=False).replace('</','<\\/')

tpl = open('tools/mockup_template.html', encoding='utf-8').read()
def sl(a,b): return tpl[tpl.index(a):tpl.index(b)]
ESC  = sl('function esc(', 'function docFor')
MINI = sl('function unbr(', 'function renderBlock')
RB   = sl('function renderBlock', 'function renderDoc')     # incl parseMd/DRAFTS/export shared fns
ZOOM = sl('var zs=', 'function render(){')
assert 'parseMd' in RB and 'dlDoc' in RB and 'miniSeq' in MINI

APP = open('tools/hub_app.js', encoding='utf-8').read()
page = open('tools/hub_shell.html', encoding='utf-8').read()
page = (page.replace('__ESC__', ESC).replace('__MINI__', MINI).replace('__RB__', RB)
            .replace('__ZOOM__', ZOOM).replace('__APP__', APP).replace('__DATA__', DATA))
open('hub_design_c4_mockup.html', 'w', encoding='utf-8').write(page)
print(f"hub mockup: {len(page)//1024}KB · {len(docs)} docs · {len(comps)} components")
