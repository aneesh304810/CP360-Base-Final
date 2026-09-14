"""Auto Mapper scoring — 4-part explainable field matching.

Parts (each 0..1, weighted into a single confidence):
  name   token similarity with financial-domain abbreviation expansion
  type   type/length compatibility (uploaded type vs Oracle column)
  embed  optional semantic similarity via sentence-transformers e5;
         SILENTLY falls back to a difflib ratio when the model or package
         is unavailable (air-gapped Nexus may not carry it)
  value  sample-value shape vs target column metadata

No ML in any decision path: scores only RANK suggestions; a human accepts
or rejects every mapping before anything is committed.
"""
from __future__ import annotations

import difflib
import logging
import os
import re

log = logging.getLogger("cp.api.mapper.scoring")

WEIGHTS = {"name": 0.35, "type": 0.20, "embed": 0.25, "value": 0.20}

# financial-domain token expansion (both directions applied)
ABBREV = {
    "acct": "account", "no": "number", "num": "number", "nbr": "number",
    "nm": "name", "cd": "code", "dt": "date", "ts": "timestamp",
    "amt": "amount", "bal": "balance", "val": "value", "mkt": "market",
    "curr": "currency", "ccy": "currency", "txn": "transaction",
    "tran": "transaction", "desc": "description", "id": "identifier",
    "sec": "security", "pos": "position", "qty": "quantity",
    "prc": "price", "pct": "percent", "avail": "available",
    "ofcl": "official", "stmt": "statement", "rtg": "routing",
    "instn": "institution", "acc": "account", "iso": "iso",
}

_EMBED_MODEL = None
_EMBED_TRIED = False


def _tokens(name: str) -> list[str]:
    parts = re.split(r"[_\W]+", re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name or ""))
    out = []
    for p in parts:
        p = p.lower().strip()
        if not p:
            continue
        out.append(ABBREV.get(p, p))
    return out


def name_score(src: str, tgt: str) -> float:
    a, b = _tokens(src), _tokens(tgt)
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    jacc = len(sa & sb) / len(sa | sb)
    seq = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return round(max(jacc, 0.6 * jacc + 0.4 * seq), 3)


# uploaded generic type -> compatible Oracle base types
_TYPE_FAMILY = {
    "STRING": {"VARCHAR2", "VARCHAR", "CHAR", "NVARCHAR2", "CLOB"},
    "DECIMAL": {"NUMBER", "FLOAT", "BINARY_DOUBLE"},
    "INTEGER": {"NUMBER"},
    "NUMBER": {"NUMBER", "FLOAT"},
    "DATE": {"DATE", "TIMESTAMP"},
    "TIMESTAMP": {"TIMESTAMP", "DATE"},
    "BOOLEAN": {"CHAR", "NUMBER", "VARCHAR2"},
}


def _parse_src_type(t: str):
    m = re.match(r"\s*([A-Za-z_]+)\s*(?:\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?", t or "")
    if not m:
        return "STRING", None, None
    return m.group(1).upper(), \
        int(m.group(2)) if m.group(2) else None, \
        int(m.group(3)) if m.group(3) else None


def type_score(src_type: str, tgt: dict) -> float:
    base, length, _scale = _parse_src_type(src_type)
    fam = _TYPE_FAMILY.get(base, {"VARCHAR2"})
    tgt_type = (tgt.get("data_type") or "").upper().split("(")[0]
    if tgt_type not in fam:
        return 0.15 if tgt_type else 0.0
    score = 0.8
    tgt_len = tgt.get("max_length") or tgt.get("precision")
    if length and tgt_len:
        ratio = min(length, tgt_len) / max(length, tgt_len)
        score = 0.6 + 0.4 * ratio
        if length > tgt_len:            # would truncate
            score -= 0.25
    return round(max(0.0, min(score, 1.0)), 3)


def _get_embedder():
    """Guarded load; MAPPER_EMBEDDINGS=on enables. Never raises."""
    global _EMBED_MODEL, _EMBED_TRIED
    if _EMBED_TRIED:
        return _EMBED_MODEL
    _EMBED_TRIED = True
    if os.getenv("MAPPER_EMBEDDINGS", "off").lower() not in ("on", "1", "true"):
        return None
    try:
        from sentence_transformers import SentenceTransformer
        _EMBED_MODEL = SentenceTransformer(
            os.getenv("MAPPER_EMBED_MODEL", "intfloat/multilingual-e5-large"))
        log.info("mapper: e5 embeddings enabled")
    except Exception as e:  # noqa: BLE001
        log.info("mapper: embeddings unavailable (%s); using lexical fallback",
                 str(e)[:100])
        _EMBED_MODEL = None
    return _EMBED_MODEL


def embed_score(src: str, src_desc: str, tgt: str, tgt_desc: str) -> float:
    model = _get_embedder()
    a = f"{' '.join(_tokens(src))} {src_desc or ''}".strip()
    b = f"{' '.join(_tokens(tgt))} {tgt_desc or ''}".strip()
    if model is not None:
        try:
            import numpy as np
            va, vb = model.encode([f"query: {a}", f"query: {b}"],
                                  normalize_embeddings=True)
            return round(float(np.dot(va, vb)), 3)
        except Exception:  # noqa: BLE001
            pass
    return round(difflib.SequenceMatcher(None, a, b).ratio(), 3)


def _shape(v: str) -> str:
    return re.sub(r"[A-Za-z]", "a", re.sub(r"\d", "9", v or ""))


def value_score(samples: list[str], tgt: dict) -> float:
    """Sample-value shape vs target metadata. Without target profiling data
    this is a heuristic: length fit + charset vs type."""
    samples = [s for s in (samples or []) if s]
    if not samples:
        return 0.5  # neutral — don't punish missing samples
    tgt_type = (tgt.get("data_type") or "").upper()
    tgt_len = tgt.get("max_length")
    score, n = 0.0, 0
    for s in samples[:5]:
        n += 1
        sh = _shape(s.strip())
        numeric = bool(re.fullmatch(r"[9.,\-]+", sh))
        datish = bool(re.fullmatch(r"9{4}-9{2}-9{2}.*", sh))
        if tgt_type.startswith(("VARCHAR", "CHAR", "NVARCHAR")):
            fit = 1.0 if (tgt_len and len(s) <= tgt_len) else 0.2
            score += fit if not datish else fit * 0.6
        elif tgt_type.startswith(("NUMBER", "FLOAT")):
            score += 1.0 if numeric else 0.1
        elif tgt_type.startswith(("DATE", "TIMESTAMP")):
            score += 1.0 if datish else 0.1
        else:
            score += 0.5
    return round(score / max(n, 1), 3)


def score_field(field: dict, candidates: list[dict], top_n: int = 3) -> dict:
    """field: {name, type, description?, samples?[]}
    candidates: rows from `columns` (schema_name, object_name, column_name,
    data_type, max_length, precision, business_desc).
    Returns best + alternatives, each with the 4 parts."""
    scored = []
    for c in candidates:
        key = f"{c['schema_name']}.{c['object_name']}.{c['column_name']}"
        parts = {
            "name": name_score(field["name"], c["column_name"]),
            "type": type_score(field.get("type") or "", c),
            "embed": embed_score(field["name"], field.get("description"),
                                 c["column_name"], c.get("business_desc")),
            "value": value_score(field.get("samples") or [], c),
        }
        conf = round(sum(WEIGHTS[k] * v for k, v in parts.items()), 3)
        scored.append({"target_key": key, "confidence": conf, "parts": parts,
                       "target_type": c.get("data_type"),
                       "is_pii": c.get("is_pii") == "Y"})
    scored.sort(key=lambda s: -s["confidence"])
    best = scored[0] if scored else None
    return {
        "field": field["name"], "type": field.get("type"),
        "best": best,
        "alternatives": scored[1:1 + top_n],
        "unmapped": (best is None or best["confidence"] < 0.60),
    }
