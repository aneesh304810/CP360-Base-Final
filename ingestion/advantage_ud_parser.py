"""The CLOB parser: one payload in, one row per key out, the same rules the
profiler used (profile_ud_clob.py), so what the registry says about a key
and what the attribute table holds for it were decided the same way.

Ported from the profiler on purpose, not imported from it: the profiler is
a tool somebody runs on a laptop; this is the load. The two must agree,
and the test pins them to the brief's examples.

Rules that protect the data:
  * every value is a string; nothing is cast; leading zeros survive;
  * value_type is a LABEL, never a conversion;
  * code/description are split only when the text looks like a code
    (no spaces in the code, at most 4 words, 100 chars), and the
    classifier decides later whether the field IS coded.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re

UD_KEY_RE = re.compile(r"^UD_(?P<parent>\d+)(?:_(?P<seq>\d+))?$", re.I)
INT_RE = re.compile(r"^[+-]?\d+$")
DEC_RE = re.compile(r"^[+-]?(?:\d+\.\d+|\d+\.\d*|\.\d+)(?:[Ee][+-]?\d+)?$")
TS_FORMATS = [("%Y%m%d-%H%M%S", "YYYYMMDD-HH24MISS"), ("%Y%m%d%H%M%S", "YYYYMMDDHH24MISS"),
              ("%Y-%m-%d %H:%M:%S", "YYYY-MM-DD HH24:MI:SS"), ("%Y-%m-%dT%H:%M:%S", "YYYY-MM-DDTHH24:MI:SS")]
DATE_FORMATS = [("%Y%m%d", "YYYYMMDD"), ("%Y-%m-%d", "YYYY-MM-DD"), ("%m/%d/%Y", "MM/DD/YYYY"),
                ("%d/%m/%Y", "DD/MM/YYYY"), ("%d-%b-%Y", "DD-MON-YYYY")]
BOOLS = {"Y", "N", "T", "F", "TRUE", "FALSE", "YES", "NO"}
NULL_LITERALS = {"", "NULL", "NONE", "N/A", "NA"}


def clean_json_text(value):
    if value is None:
        return None
    if hasattr(value, "read"):
        value = value.read()
    text = str(value).strip().lstrip("﻿")
    if not text:
        return None
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"' and '""' in text:
        text = text[1:-1].replace('""', '"').strip()
    return text


def parse_json(value):
    """-> (dict, None) or (None, error)"""
    text = clean_json_text(value)
    if text is None:
        return None, "EMPTY_PAYLOAD"
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        return None, f"INVALID_JSON: {e.msg}; line={e.lineno}; column={e.colno}; position={e.pos}"
    if not isinstance(obj, dict):
        return None, f"TOP_LEVEL_{type(obj).__name__.upper()}_NOT_OBJECT"
    return obj, None


def parse_key(key):
    name = str(key).strip().upper()
    m = UD_KEY_RE.fullmatch(name)
    if not m:
        return {"attribute_name": name, "attribute_number": None, "parent_attribute": None,
                "sequence_number": None, "key_structure": "NON_STANDARD", "is_ud_attribute": "N"}
    parent = int(m.group("parent"))
    seq = int(m.group("seq")) if m.group("seq") else None
    return {"attribute_name": name, "attribute_number": parent,
            # the profiler fills parent for singles too; the catalogue's
            # registry wants NULL there, so this is where the two differ
            "parent_attribute": f"UD_{parent}" if seq is not None else None,
            "sequence_number": seq,
            "key_structure": "MULTIPART" if seq is not None else "SINGLE", "is_ud_attribute": "Y"}


def detect_datetime(text):
    for fmt, mask in TS_FORMATS:
        try:
            dt.datetime.strptime(text, fmt)
            return "TIMESTAMP", mask
        except ValueError:
            pass
    masks = []
    for fmt, mask in DATE_FORMATS:
        try:
            dt.datetime.strptime(text, fmt)
            masks.append(mask)
        except ValueError:
            pass
    return ("DATE", "|".join(masks)) if masks else (None, None)


def split_code_description(text):
    if "=" not in text:
        return None, None
    code, desc = (p.strip() for p in text.split("=", 1))
    if not code or not desc or len(code) > 100 or len(code.split()) > 4:
        return None, None
    return code, desc


def classify_value(value):
    out = {"raw_value": None, "value_type": "NULL", "date_mask": None, "code_value": None,
           "description_value": None, "leading_zero_ind": "N", "value_length": None}
    if value is None:
        return out
    if isinstance(value, bool):
        out.update(raw_value="Y" if value else "N", value_type="BOOLEAN_FLAG", value_length=1)
        return out
    if isinstance(value, int):
        t = str(value); out.update(raw_value=t, value_type="INTEGER", value_length=len(t)); return out
    if isinstance(value, float):
        t = str(value); out.update(raw_value=t, value_type="DECIMAL", value_length=len(t)); return out
    if isinstance(value, (dict, list)):
        t = json.dumps(value, ensure_ascii=False, sort_keys=True)
        out.update(raw_value=t, value_type="OBJECT" if isinstance(value, dict) else "ARRAY", value_length=len(t))
        return out
    text = str(value).strip()
    upper = text.upper()
    out.update(raw_value=text, value_length=len(text))
    if upper in NULL_LITERALS:
        out["value_type"] = "BLANK" if text == "" else "NULL_LITERAL"
        return out
    if upper in BOOLS:
        out["value_type"] = "BOOLEAN_FLAG"
        return out
    code, desc = split_code_description(text)
    if code is not None:
        out.update(value_type="CODE_DESCRIPTION", code_value=code, description_value=desc)
        return out
    kind, mask = detect_datetime(text)
    if kind:
        out.update(value_type=kind, date_mask=mask)
        return out
    if INT_RE.fullmatch(text):
        unsigned = text.lstrip("+-")
        if len(unsigned) > 1 and unsigned.startswith("0"):
            out.update(value_type="IDENTIFIER_LEADING_ZERO", leading_zero_ind="Y")
        else:
            out["value_type"] = "INTEGER"
        return out
    if DEC_RE.fullmatch(text):
        out["value_type"] = "DECIMAL"
        return out
    out["value_type"] = "TEXT"
    return out


def signatures(obj):
    """(schema_signature, typed_signature, sorted keys), the profiler's way:
    SHA-256 of the sorted key list, 16 upper hex chars."""
    keys = sorted(str(k).strip().upper() for k in obj)
    sig = hashlib.sha256("|".join(keys).encode()).hexdigest()[:16].upper()
    tmap = {str(k).strip().upper(): classify_value(v)["value_type"] for k, v in obj.items()}
    typed = hashlib.sha256("|".join(f"{k}:{tmap[k]}" for k in sorted(tmap)).encode()).hexdigest()[:16].upper()
    return sig, typed, keys


def parse_payload(value):
    """One CLOB -> {"error": str|None, "keys": [..], "schema_signature", "typed_signature",
    "attributes": [ {key fields + value fields} ]}"""
    obj, err = parse_json(value)
    if err:
        return {"error": err, "keys": [], "attributes": [], "schema_signature": None, "typed_signature": None}
    sig, typed, keys = signatures(obj)
    attrs = []
    for k, v in obj.items():
        row = parse_key(k)
        row.update(classify_value(v))
        attrs.append(row)
    return {"error": None, "keys": keys, "schema_signature": sig, "typed_signature": typed, "attributes": attrs}
