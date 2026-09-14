"""design_docs — ingest designs-md/*.md into design_docs/design_doc_sections.
DUAL CONTRACT, fully:
  pack contract       : id, title, level, icon, color, order, sub, match, ...
  component contract  : component_id, component_name, zone, plane, priority,
                        technology, custom_build, status, owner, ...
Sections stored with raw markdown body (diff-able, searchable). Idempotent.
CLI: python -m ingestion.design_docs_loader [designs-md-dir]
Step: registered as "design_docs" in run.py STEPS (mind the commas)."""
import re, glob, sys, os

PLANE_STYLE = {
    "Processing":     ("🧪", "#0e8f7e"),
    "Ingress":        ("📥", "#0b5e83"),
    "Ingress/Egress": ("📥", "#0b5e83"),
    "Egress":         ("📤", "#0b5e83"),
    "DQ":             ("🛡", "#a8560f"),
    "Quality":        ("🛡", "#a8560f"),
    "Orchestration":  ("🛠", "#6d3ac0"),
    "Foundation":     ("🧱", "#5a6472"),
}

def parse_front(text):
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    front = {}
    for line in m.group(1).split('\n'):
        k, _, v = line.partition(':')
        front[k.strip()] = v.strip()
    return front, text[m.end():]

def normalize(front, path):
    """Either contract -> the design_docs row shape."""
    if 'component_id' in front:                       # component contract
        cid = str(front['component_id']).strip()
        icon, color = PLANE_STYLE.get(front.get('plane', ''), ("📐", "#0f4775"))
        return {
            'doc_id': f'c{cid}',
            'title': front.get('component_name', f'Component {cid}'),
            'level': 'L3', 'icon': icon, 'color': color,
            'order': 100 + int(cid),
            'sub': (f"#{cid} · {front.get('zone','')} · {front.get('plane','')} · "
                    f"{front.get('technology','')} · {front.get('priority','')} · "
                    f"custom {front.get('custom_build','')} · "
                    f"status {front.get('status','')}")[:400],
            'match': '', 'zone_dflt': '', 'is_default': 'N',
            'src': os.path.basename(path),
        }
    return {                                          # pack contract
        'doc_id': front['id'],
        'title': front['title'],
        'level': front.get('level'), 'icon': front.get('icon'),
        'color': front.get('color'),
        'order': int(front.get('order', 99)),
        'sub': (front.get('sub') or '')[:400],
        'match': front.get('match') or '',
        'zone_dflt': front.get('zone_default') or '',
        'is_default': 'Y' if front.get('default') == 'true' else 'N',
        'src': os.path.basename(path),
    }

def sections_of(body):
    parts, cur, buf = [], "", []
    for line in body.split('\n'):
        if line.startswith('# ') and not line.startswith('## '):
            continue                                   # title lives in front-matter
        if line.startswith('## '):
            if cur or any(x.strip() for x in buf):
                parts.append((cur, '\n'.join(buf).strip()))
            cur, buf = line[3:].strip(), []
        else:
            buf.append(line)
    if cur or any(x.strip() for x in buf):
        parts.append((cur, '\n'.join(buf).strip()))
    return parts

def load(conn, md_dir='designs-md'):
    cur = conn.cursor()
    n_docs = n_secs = 0
    for path in sorted(glob.glob(os.path.join(md_dir, '*.md'))):
        front, body = parse_front(open(path, encoding='utf-8').read())
        d = normalize(front, path)
        cur.execute("DELETE FROM design_doc_sections WHERE doc_id = :1", [d['doc_id']])
        cur.execute("DELETE FROM design_docs WHERE doc_id = :1", [d['doc_id']])
        cur.execute("""INSERT INTO design_docs
            (doc_id, title, doc_level, icon, color, doc_order, sub_title,
             match_rx, zone_dflt, is_default, src_file)
            VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11)""",
            [d['doc_id'], d['title'], d['level'], d['icon'], d['color'],
             d['order'], d['sub'], d['match'], d['zone_dflt'],
             d['is_default'], d['src']])
        for i, (h, b) in enumerate(sections_of(body), 1):
            cur.execute("""INSERT INTO design_doc_sections
                (doc_id, section_no, heading, body_md) VALUES (:1,:2,:3,:4)""",
                [d['doc_id'], i, h[:400], b])
            n_secs += 1
        n_docs += 1
    conn.commit()
    print(f"design_docs: {n_docs} docs · {n_secs} sections loaded")

if __name__ == '__main__':
    from ingestion.db import get_conn
    load(get_conn(), sys.argv[1] if len(sys.argv) > 1 else 'designs-md')
