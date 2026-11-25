"""Shared AST helpers: parse what we have (the whole file when known, else
the added lines, which may not parse), and walk calls by name."""
from __future__ import annotations

import ast


def parse(fd):
    """(tree, text, offset): the tree of the new file when its text is known,
    else of the added lines joined (line numbers then map through `offset`),
    else None when neither parses."""
    if fd.new_text is not None:
        try:
            return ast.parse(fd.new_text), fd.new_text, None
        except SyntaxError:
            return None, fd.new_text, None
    text = fd.added_text
    try:
        return ast.parse(text), text, [n for n, _ in fd.added]
    except SyntaxError:
        return None, text, [n for n, _ in fd.added]


def real_line(node_lineno, offset):
    """The new file line for a node line: identity for a whole file, else
    the mapping from joined-added-lines index to the real new line number."""
    if offset is None:
        return node_lineno
    return offset[node_lineno - 1] if 0 < node_lineno <= len(offset) else None


def call_name(node):
    f = node.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        parts = []
        while isinstance(f, ast.Attribute):
            parts.append(f.attr); f = f.value
        if isinstance(f, ast.Name):
            parts.append(f.id)
        return ".".join(reversed(parts))
    return ""


def kw(node, name):
    for k in node.keywords:
        if k.arg == name:
            return k.value
    return None


def const(node):
    return node.value if isinstance(node, ast.Constant) else None
