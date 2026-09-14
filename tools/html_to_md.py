#!/usr/bin/env python3
"""One-time (and future-source) converter: design HTML -> structured Markdown.
Walks section/h2/h4/p/ul/table/pre; inline <b> -> **, <code> -> `."""
import sys, re
from html.parser import HTMLParser

class Walk(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []; self.stack = []; self.buf = []
        self.row = []; self.rows = []; self.in_cell = False
    def flush_text(self):
        t = re.sub(r'\s+', ' ', ''.join(self.buf)).strip(); self.buf = []
        return t
    def handle_starttag(self, tag, attrs):
        if tag in ('h1','h2','h3','h4','p','li','pre','table','tr','td','th','ul','ol','section'):
            if tag in ('td','th'): self.in_cell = True; self.buf = []
            elif tag == 'tr': self.row = []
            elif tag == 'table': self.rows = []
            elif tag in ('h1','h2','h3','h4','p','li','pre'): self.buf = []
            self.stack.append(tag)
        elif tag == 'b' and self.stack and self.stack[-1] not in ('table','tr'): self.buf.append('**')
        elif tag == 'code': self.buf.append('`')
        elif tag == 'br': self.buf.append(' · ')
    def handle_endtag(self, tag):
        if tag == 'b': self.buf.append('**')
        elif tag == 'code': self.buf.append('`')
        if not self.stack or self.stack[-1] != tag:
            return
        self.stack.pop()
        if tag in ('td','th'):
            self.row.append(self.flush_text()); self.in_cell = False
        elif tag == 'tr':
            if any(c for c in self.row): self.rows.append(self.row)
        elif tag == 'table':
            if self.rows:
                self.out.append(('tbl', self.rows)); self.rows = []
        elif tag in ('h1','h2','h3','h4'):
            t = self.flush_text()
            if t: self.out.append((tag, t))
        elif tag == 'p':
            t = self.flush_text()
            if t: self.out.append(('p', t))
        elif tag == 'li':
            t = self.flush_text()
            if t: self.out.append(('li', t))
        elif tag == 'pre':
            t = ''.join(self.buf).strip('\n'); self.buf = []
            if t: self.out.append(('pre', t))
    def handle_data(self, data):
        if self.stack and (self.stack[-1] in ('h1','h2','h3','h4','p','li','pre') or self.in_cell):
            self.buf.append(data)

def convert(path, front):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<style>.*?</style>', '', s, flags=re.S)
    s = re.sub(r'<script>.*?</script>', '', s, flags=re.S)
    w = Walk(); w.feed(s)
    md = ['---']
    for k, v in front.items(): md.append(f'{k}: {v}')
    md.append('---'); md.append('')
    for kind, val in w.out:
        if kind == 'h1': continue                      # title lives in front-matter
        if kind == 'h2': md += ['', f'## {val}', '']
        elif kind in ('h3','h4'): md += ['', f'### {val}', '']
        elif kind == 'p': md += [val, '']
        elif kind == 'li': md.append(f'- {val}')
        elif kind == 'pre': md += ['', '```', val, '```', '']
        elif kind == 'tbl':
            md.append('')
            for i, row in enumerate(val):
                md.append('| ' + ' | '.join(c.replace('|','/') for c in row) + ' |')
                if i == 0: md.append('|' + '---|' * len(row))
            md.append('')
    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(md)) + '\n'
    return text

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    import json
    front = json.loads(sys.argv[3])
    open(dst, 'w', encoding='utf-8').write(convert(src, front))
    print(f'{dst}: written')
