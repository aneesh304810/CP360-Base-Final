"""Classification rules for AddVantage UD attributes, read from
advantage_ud_rules.yaml, with the decisions the profile loader and the API
both need: what an attribute IS (value class), where it belongs (domain,
Silver entity), what a multipart parent is for, what a code conflict
really is, and how rows group into schema families.

Every decision returns its SOURCE, so the registry can say "RULE" for a
hypothesis from the brief and the workbook can overwrite it with
"DICTIONARY" without anybody having to remember which was which.
"""
from __future__ import annotations

import hashlib
import os
import re

try:
    import yaml
except Exception:                                            # pragma: no cover
    yaml = None

UD_RE = re.compile(r"^UD_(\d+)(?:_(\d+))?$")

_DEFAULT = {"free_text_parents": ["UD_32"], "structures": {}, "attributes": {},
            "gold_candidates": [], "identifier_parents": [], "domains": ["UNKNOWN"]}


def load_rules(path=None):
    p = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "advantage_ud_rules.yaml")
    if not yaml or not os.path.exists(p):
        return dict(_DEFAULT)
    with open(p, encoding="utf-8") as fh:
        d = yaml.safe_load(fh) or {}
    out = dict(_DEFAULT)
    out.update({k: v for k, v in d.items() if v is not None})
    return out


RULES = load_rules()


def split_key(attr):
    """UD_23_2 -> (23, 'UD_23', 2, 'MULTIPART'); UD_14 -> (14, None, None, 'SINGLE')."""
    m = UD_RE.match(attr or "")
    if not m:
        return None, None, None, "NON_STANDARD"
    n = int(m.group(1))
    if m.group(2) is None:
        return n, None, None, "SINGLE"
    return n, f"UD_{n}", int(m.group(2)), "MULTIPART"


def structure_role(parent, rules=None):
    r = rules or RULES
    s = (r.get("structures") or {}).get(parent)
    return (s or {}).get("role") or "TEXT_BLOCK"


def is_free_text(attr, rules=None):
    r = rules or RULES
    _, parent, _, _ = split_key(attr)
    return parent in set(r.get("free_text_parents") or [])


def reclassify_type(attr, dominant_type, max_len, rules=None):
    """The profiler's YYYYMMDDHH24MISS pattern swallows 10-digit account
    numbers. Ten digits, no separators, under a parent that holds account
    references, is an IDENTIFIER. Returns (type, changed)."""
    r = rules or RULES
    _, parent, _, _ = split_key(attr)
    # The brief says the profiler reads them as TIMESTAMP; a value such as
    # 1010000017 the parser here reads as INTEGER. Either way, ten digits
    # under an account-reference parent is an identifier, never a number.
    if dominant_type in ("TIMESTAMP", "INTEGER") and max_len and int(max_len) == 10 \
            and (parent in set(r.get("identifier_parents") or []) or attr in set(r.get("identifier_parents") or [])):
        return "IDENTIFIER", True
    return dominant_type, False


def classify(attr, dominant_type=None, max_len=None, dictionary_type=None, rules=None):
    """One decision per attribute: (value_class, domain, silver_entity, source).
    Order matters: the workbook's field type wins, then the parent's
    structure, then the brief's hypothesis, then profiling."""
    r = rules or RULES
    n, parent, seq, ks = split_key(attr)
    structs = r.get("structures") or {}
    attrs = r.get("attributes") or {}
    dtype, _ = reclassify_type(attr, dominant_type, max_len, r)

    # 1. dictionary field type (1 Date, 2 Yes/No, 3 Text, 4 Money, 6 Table)
    dict_class = {"1": "DATE", "2": "BOOLEAN_FLAG", "3": "TEXT", "4": "CURRENCY",
                  "6": "CODE_DESCRIPTION"}.get(str(dictionary_type) if dictionary_type else None)
    # 2. structure of the parent
    if parent and parent in structs:
        s = structs[parent]
        vc = dict_class or ("TEXT" if s.get("role") in ("BILLING_INSTRUCTION", "TEXT_BLOCK") else (dtype or "TEXT"))
        return vc, s.get("domain") or "UNKNOWN", s.get("silver"), ("DICTIONARY" if dict_class else "RULE")
    # 3. the brief's hypothesis for a single
    key = attr if attr in attrs else (parent if parent in attrs else None)
    if key:
        a = attrs[key]
        vc = dict_class or a.get("class") or dtype or "TEXT"
        return vc, a.get("domain") or "UNKNOWN", a.get("silver"), ("DICTIONARY" if dict_class else "RULE")
    # 4. profiling only
    if dict_class:
        return dict_class, "UNKNOWN", None, "DICTIONARY"
    return (dtype or "TEXT"), "UNKNOWN", None, "INFERRED"


def is_gold_candidate(attr, rules=None):
    r = rules or RULES
    return attr in set(r.get("gold_candidates") or [])


_NUM = re.compile(r"^[\s$,.\d%-]+$")


def conflict_class(attr, descriptions, rules=None):
    """What a code with several descriptions really is. Inside a free-text
    parent it is never a dictionary conflict."""
    descs = [d.strip() for d in descriptions if d and d.strip()]
    if not is_free_text(attr, rules):
        return "TRUE_CONFLICT"
    if descs and all(_NUM.match(d) for d in descs):
        return "PARAMETERIZED_VALUE"
    folded = {re.sub(r"[^a-z0-9]", "", d.lower()) for d in descs}
    if len(folded) <= 1:
        return "FORMATTING_VARIATION"
    return "FREE_TEXT_FALSE_POSITIVE"


def family_of(attribute_list, rules=None):
    """A schema family is the set of multipart PARENTS a row carries, which
    is what a reader recognises ("household + billing"), not the exact key
    set, which is unique to most rows. Returns (family_id, label, parents)."""
    r = rules or RULES
    parents = set()
    for k in attribute_list:
        _, parent, _, _ = split_key(k.strip())
        if parent:
            parents.add(parent)
    ps = sorted(parents, key=lambda p: int(p.split("_")[1]))
    roles = []
    for p in ps:
        role = structure_role(p, r)
        roles.append(role.lower().replace("_", " ") if role != "TEXT_BLOCK" else p.lower())
    label = " + ".join(roles) if roles else "singles only"
    fid = hashlib.sha256(",".join(ps).encode()).hexdigest()[:12]
    return fid, label, ps


def shape_example(value_class, min_len=None, max_len=None, leading_zero=False,
                  date_masks=None, codes=None):
    """A placeholder that shows the SHAPE of a value and never a value.
    Used to draw what the CLOB looks like without printing an account."""
    L = int(max_len or min_len or 0) or None
    if value_class == "CODE_DESCRIPTION":
        if codes:
            c = codes[0]
            return f"{c.get('code_value')}={c.get('description_value')}"
        return "<code>=<DESCRIPTION>"
    if value_class == "BOOLEAN_FLAG":
        return "Y"
    if value_class in ("IDENTIFIER_LEADING_ZERO",) or (value_class == "IDENTIFIER" and leading_zero):
        return "0" * (L or 9) + "  (leading zeros kept)"
    if value_class == "IDENTIFIER":
        return "#" * (L or 10)
    if value_class == "DATE":
        return (date_masks or "MM/DD/YYYY").split("|")[0]
    if value_class == "TIMESTAMP":
        return "YYYYMMDDHHMISS"
    if value_class in ("INTEGER",):
        return "#" * min(L or 3, 12)
    if value_class in ("DECIMAL", "CURRENCY", "PERCENT"):
        return "####.##"
    if value_class in ("OBJECT", "ARRAY"):
        return "{…}" if value_class == "OBJECT" else "[…]"
    return f"<text ≤{L} chars>" if L else "<text>"
