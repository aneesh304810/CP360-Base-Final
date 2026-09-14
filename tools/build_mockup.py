#!/usr/bin/env python3
"""Regenerate system_design_pack_mockup.html (the fully working single-file app)
from seiDesignTracker.js + designDocsData.js. Run after build_design_docs.py."""
import re, json
tr = open('ui-src/seiDesignTracker.js').read()
comps = json.loads(re.search(r'export const TRACKER_COMPONENTS = (.*?);\n\nexport', tr, re.S).group(1))
decs  = json.loads(re.search(r'export const TRACKER_DECISIONS = (.*?);\n$', tr, re.S).group(1))
dd = open('ui-src/designDocsData.js').read()
docs = json.loads(re.search(r'export const DESIGN_DOCS = (.*?);\n$', dd, re.S).group(1))
data = json.dumps({"comps": comps, "decs": decs, "docs": docs}, ensure_ascii=False).replace('</', '<\\/')
tpl = open('tools/mockup_template.html', encoding='utf-8').read()
open('system_design_pack_mockup.html', 'w', encoding='utf-8').write(tpl.replace('__DATA__', data))
print(f"mockup regenerated: {len(docs)} docs · {len(comps)} components embedded")
