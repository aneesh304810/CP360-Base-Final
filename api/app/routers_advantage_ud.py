"""AddVantage user-defined field codes, for Datapoint 360.

    GET /advantage-ud/codes?attribute=UD_1       the values UD_1 carries
    GET /advantage-ud/coded-attributes           which UD attributes have any

Reads cp_advantage_ud_dictionary (sql/75). The attribute is validated
before it reaches the database: a name that is not UD_<n> or UD_<n>_<seq>
is refused with 400 rather than searched for, because the only caller is
the Non-SEI datapoint pane and a non-UD field there has no codes by
definition. A missing table degrades to an empty list (db.query already
does that on ORA-00942), so a warehouse that has not run sql/75 shows the
pane exactly as before.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException

from .db import query

log = logging.getLogger("cp.api.advantage_ud")
router = APIRouter(prefix="/advantage-ud", tags=["advantage-ud"])

UD_RE = re.compile(r"^UD_\d+(?:_\d+)?$")


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:                                   # noqa: BLE001
        log.warning("advantage_ud query failed: %s", e)
        return []


@router.get("/codes")
def codes(attribute: str):
    a = (attribute or "").strip().upper()
    if not UD_RE.match(a):
        raise HTTPException(400, f"Not a UD attribute: {attribute!r}. Expected UD_<n> or UD_<n>_<seq>.")
    rows = _safe("""
        SELECT attribute_name, parent_attribute, code_value, description_value,
               occurrence_count, source, table_number, link_status, is_pii
        FROM cp_advantage_ud_dictionary
        WHERE attribute_name = :a
        ORDER BY source, LENGTH(code_value), code_value""", {"a": a})
    for r in rows:
        if (r.get("is_pii") or "N") == "Y":        # names never leave the server
            r["description_value"] = "•••"
    return {"attribute": a, "codes": rows,
            "sources": sorted({r.get("source") for r in rows if r.get("source")})}


@router.get("/coded-attributes")
def coded_attributes():
    return {"attributes": _safe("""
        SELECT attribute_name, COUNT(*) AS code_count,
               MAX(link_status) AS link_status
        FROM cp_advantage_ud_dictionary
        GROUP BY attribute_name ORDER BY attribute_name""")}


# ---------------------------------------------------------------------------
# The 360 view (sql/76): the registry and what surrounds one attribute.
# ---------------------------------------------------------------------------
try:
    from ingestion.advantage_ud_rules import shape_example, split_key   # noqa: E402
except Exception:                                            # pragma: no cover
    # The API can run from a tree without the ingestion package. The codes
    # endpoints above still work; the 360 degrades to shapes-by-class.
    def split_key(attr):
        m = UD_RE.match(attr or "")
        if not m:
            return None, None, None, "NON_STANDARD"
        parts = attr.split("_")
        return int(parts[1]), (f"UD_{parts[1]}" if len(parts) > 2 else None), \
            (int(parts[2]) if len(parts) > 2 else None), ("MULTIPART" if len(parts) > 2 else "SINGLE")

    def shape_example(value_class, *_a, **_k):
        return f"<{(value_class or 'text').lower()}>"

_REG_COLS = """attribute_name, attribute_number, parent_attribute, sequence_number,
    key_structure, is_ud_attribute, occurrence_count, record_presence_pct,
    distinct_value_count, null_or_blank_count, min_value_length, max_value_length,
    avg_value_length, dominant_type, dominant_type_pct, type_variance_ind,
    type_distribution, leading_zero_count, date_masks, variance_class, value_class,
    type_reclassified, domain, silver_entity, class_source, gold_candidate, is_free_text"""


def _shape(r, codes=None):
    return shape_example(r.get("value_class"), r.get("min_value_length"),
                         r.get("max_value_length"), (r.get("leading_zero_count") or 0) > 0,
                         r.get("date_masks"), codes)


@router.get("/overview")
def overview():
    """The header of the UD 360: how big the envelope is and how it splits."""
    run = {r["metric"]: r["value_num"] for r in _safe(
        "SELECT metric, value_num FROM cp_advantage_ud_run")}
    reg = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry")
    by_domain, by_class, by_struct = {}, {}, {}
    for r in reg:
        by_domain[r.get("domain") or "UNKNOWN"] = by_domain.get(r.get("domain") or "UNKNOWN", 0) + 1
        by_class[r.get("value_class") or "?"] = by_class.get(r.get("value_class") or "?", 0) + 1
        by_struct[r.get("key_structure") or "?"] = by_struct.get(r.get("key_structure") or "?", 0) + 1
    parents = _safe("SELECT parent_attribute, record_count, structure_role, max_children "
                    "FROM cp_advantage_ud_parent ORDER BY record_count DESC")
    fams = _safe("SELECT family_id, family_label, parents_present, parent_count, record_count, "
                 "variant_count, min_attribute_count, max_attribute_count "
                 "FROM cp_advantage_ud_family ORDER BY record_count DESC")
    coded = _safe("SELECT COUNT(DISTINCT attribute_name) AS n FROM cp_advantage_ud_dictionary")
    conflicts = _safe("SELECT conflict_class, COUNT(*) AS n FROM cp_advantage_ud_conflict "
                      "GROUP BY conflict_class")
    return {
        "run": run,
        "attributes": len(reg),
        "by_structure": by_struct, "by_domain": by_domain, "by_class": by_class,
        "variance_attributes": sum(1 for r in reg if (r.get("type_variance_ind") or "N") == "Y"),
        "reclassified": sum(1 for r in reg if (r.get("type_reclassified") or "N") == "Y"),
        "gold_candidates": sum(1 for r in reg if (r.get("gold_candidate") or "N") == "Y"),
        "coded_attributes": (coded[0]["n"] if coded else 0),
        "parents": parents, "families": fams[:40], "family_count": len(fams),
        "conflicts": {c["conflict_class"]: c["n"] for c in conflicts},
        "loaded": bool(reg),
    }


@router.get("/attribute")
def attribute(name: str):
    """Everything the catalogue knows about one key, and its neighbours."""
    a = (name or "").strip().upper()
    if not UD_RE.match(a):
        raise HTTPException(400, f"Not a UD attribute: {name!r}")
    rows = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry WHERE attribute_name = :a", {"a": a})
    reg = rows[0] if rows else None
    n, parent, seq, ks = split_key(a)
    codes = codes_for(a)
    out = {"attribute": a, "registry": reg, "codes": codes, "loaded": reg is not None}
    if reg:
        out["shape"] = _shape(reg, codes)
    if parent:
        p = _safe("SELECT parent_attribute, record_count, observed_sequences, missing_sequences, "
                  "min_children, max_children, avg_children, structure_role, line_names "
                  "FROM cp_advantage_ud_parent WHERE parent_attribute = :p", {"p": parent})
        out["parent"] = p[0] if p else None
        sib = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry "
                    "WHERE parent_attribute = :p ORDER BY sequence_number", {"p": parent})
        out["siblings"] = [{"attribute_name": s["attribute_name"], "sequence_number": s["sequence_number"],
                            "occurrence_count": s["occurrence_count"], "value_class": s["value_class"],
                            "max_value_length": s["max_value_length"], "shape": _shape(s)} for s in sib]
    else:
        kids = _safe("SELECT parent_attribute, record_count, structure_role, max_children FROM "
                     "cp_advantage_ud_parent WHERE parent_attribute = :p", {"p": a})
        if kids:                                 # a parent asked for by its own name
            out["parent"] = kids[0]
            sib = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry "
                        "WHERE parent_attribute = :p ORDER BY sequence_number", {"p": a})
            out["siblings"] = [{"attribute_name": s["attribute_name"], "sequence_number": s["sequence_number"],
                                "occurrence_count": s["occurrence_count"], "value_class": s["value_class"],
                                "max_value_length": s["max_value_length"], "shape": _shape(s)} for s in sib]
    out["conflicts"] = _safe("SELECT code_value, description_count, descriptions, conflict_class "
                             "FROM cp_advantage_ud_conflict WHERE attribute_name = :a ORDER BY code_value", {"a": a})
    return out


def codes_for(a):
    rows = _safe("""
        SELECT code_value, description_value, occurrence_count, source, table_number, link_status, is_pii
        FROM cp_advantage_ud_dictionary WHERE attribute_name = :a
        ORDER BY source, LENGTH(code_value), code_value""", {"a": a})
    for r in rows:
        if (r.get("is_pii") or "N") == "Y":
            r["description_value"] = "•••"
    return rows


@router.get("/clob-shape")
def clob_shape():
    """What a payload looks like, drawn from the registry: never a record.
    The example object is the keys of the most common family, each with
    its shape placeholder, so a reader sees the structure of the JSON
    without an account number ever leaving the database."""
    fams = _safe("SELECT family_id, family_label, parents_present, record_count, variant_count "
                 "FROM cp_advantage_ud_family ORDER BY record_count DESC")
    sizes = _safe("SELECT attribute_count, SUM(record_count) AS records FROM cp_advantage_ud_schema "
                  "GROUP BY attribute_count ORDER BY attribute_count")
    reg = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry ORDER BY record_presence_pct DESC NULLS LAST")
    core = [r for r in reg if (r.get("record_presence_pct") or 0) >= 50 and r.get("key_structure") == "SINGLE"]
    example = {}
    for r in core[:12]:
        example[r["attribute_name"]] = _shape(
            r, codes_for(r["attribute_name"]) if r.get("value_class") == "CODE_DESCRIPTION" else None)
    top = fams[0] if fams else None
    if top and top.get("parents_present"):
        for p in top["parents_present"].split(","):
            kids = [r for r in reg if r.get("parent_attribute") == p][:3]
            for k in kids:
                example[k["attribute_name"]] = _shape(k)
            if len([r for r in reg if r.get("parent_attribute") == p]) > 3:
                example[f"{p}_…"] = "… more lines"
    buckets = {"1-5": 0, "6-20": 0, "21-50": 0, "51-100": 0, "100+": 0}
    for s in sizes:
        n, rc = s.get("attribute_count") or 0, s.get("records") or 0
        b = "1-5" if n <= 5 else "6-20" if n <= 20 else "21-50" if n <= 50 else "51-100" if n <= 100 else "100+"
        buckets[b] += rc
    return {"example": example, "core_keys": [r["attribute_name"] for r in core],
            "key_count_buckets": buckets, "top_family": top, "family_count": len(fams),
            "loaded": bool(reg)}


@router.get("/registry")
def registry(domain: str | None = None, parent: str | None = None, gold: bool = False):
    where, p = [], {}
    if domain:
        where.append("domain = :d"); p["d"] = domain.upper()
    if parent:
        where.append("parent_attribute = :p"); p["p"] = parent.upper()
    if gold:
        where.append("gold_candidate = 'Y'")
    sql = f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry" + \
          (" WHERE " + " AND ".join(where) if where else "") + \
          " ORDER BY attribute_number, sequence_number NULLS FIRST"
    rows = _safe(sql, p)
    # The dictionary's name for each key (UD/1 "OWNED BY CODE"), joined in
    # Python: a LEFT JOIN would make the whole statement fail on a warehouse
    # without sql/27, and the registry must answer without it.
    terms = {}
    for d in _safe("""SELECT field_code_norm, MAX(business_term) AS business_term
                      FROM legacy_dictionary
                      WHERE source_system = 'ADDVANTAGE' AND field_code_norm LIKE 'UD\_%' ESCAPE '\\'
                      GROUP BY field_code_norm"""):
        terms[d["field_code_norm"]] = d["business_term"]
    for r in rows:
        r["shape"] = _shape(r)
        r["term"] = terms.get(r["attribute_name"])
    return {"attributes": rows}


# ---------------------------------------------------------------------------
# type_variance.csv and schema_variants.csv, each read as its own analysis.
# ---------------------------------------------------------------------------

# What each variance class means for the load, from the brief's rules:
# leading zeros stay VARCHAR, free text is preserved, dates are never
# auto-converted, a split happens only where the field is coded.
VARIANCE_READING = {
    "NUMERIC_REPRESENTATION_VARIANCE": ("same number, written two ways (12 vs 12.0)",
                                        "keep the string; parse a decimal beside it"),
    "DATE_FORMAT_OR_TEXT_VARIANCE":    ("dates in more than one mask, or text where a date is expected",
                                        "keep the string and its mask; never auto-convert; text rows are a quality finding"),
    "IDENTIFIER_NUMERIC_COLLISION":    ("an identifier that sometimes has leading zeros and sometimes not",
                                        "VARCHAR for ever; a zero-stripped id is a different id"),
    "CODE_VS_FREE_TEXT_VARIANCE":      ("free text that sometimes contains '='",
                                        "it is text; do not split; the code pairs are false positives"),
    "FLAG_REPRESENTATION_VARIANCE":    ("a flag written Y/N and also as something else",
                                        "map the other spellings to Y/N; anything unmapped is a finding"),
    "COMPLEX_STRUCTURE_VARIANCE":      ("a nested object or array beside plain values",
                                        "register the structure; do not flatten"),
    "MIXED_SEMANTIC_TYPES":            ("values of unrelated kinds under one key",
                                        "review by hand before any type is declared"),
}


def _dist(s):
    try:
        import json
        o = json.loads(s) if isinstance(s, str) else (s or {})
        return sorted(((k, int(v)) for k, v in o.items()), key=lambda kv: -kv[1])
    except Exception:                                        # noqa: BLE001
        return []


@router.get("/type-variance")
def type_variance():
    """Every key whose values are not all one type: what kind of variance,
    how much of the column it affects, and what the load should do."""
    reg = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry WHERE type_variance_ind = 'Y' "
                "ORDER BY dominant_type_pct NULLS LAST, attribute_number, sequence_number")
    terms = {}
    for d in _safe("""SELECT field_code_norm, MAX(business_term) AS business_term FROM legacy_dictionary
                      WHERE source_system = 'ADDVANTAGE' AND field_code_norm LIKE 'UD\\_%' ESCAPE '\\\\'
                      GROUP BY field_code_norm"""):
        terms[d["field_code_norm"]] = d["business_term"]
    rows, by_class = [], {}
    for r in reg:
        cls = r.get("variance_class") or "UNCLASSIFIED"
        dist = _dist(r.get("type_distribution"))
        minority = [(k, v) for k, v in dist if k != r.get("dominant_type")]
        occ = r.get("occurrence_count") or sum(v for _, v in dist) or 0
        minority_n = sum(v for _, v in minority)
        minority_pct = round(100.0 * minority_n / occ, 2) if occ else None
        what, do = VARIANCE_READING.get(cls, ("not classified", "review"))
        if r.get("type_reclassified") == "Y":
            what, do = ("10-digit account references the profiler read as timestamps",
                        "IDENTIFIER, VARCHAR; the variance is the profiler's, not the data's")
        elif r.get("is_free_text") == "Y":
            do = "it is narrative; preserve the lines"
        rows.append({
            "attribute_name": r["attribute_name"], "term": terms.get(r["attribute_name"]),
            "parent_attribute": r.get("parent_attribute"), "variance_class": cls,
            "dominant_type": r.get("dominant_type"), "dominant_type_pct": r.get("dominant_type_pct"),
            "value_class": r.get("value_class"), "type_reclassified": r.get("type_reclassified"),
            "is_free_text": r.get("is_free_text"), "occurrence_count": occ,
            "minority": minority, "minority_count": minority_n, "minority_pct": minority_pct,
            "severity": ("high" if (minority_pct or 0) >= 10 else "medium" if (minority_pct or 0) >= 1 else "low"),
            "what": what, "do": do, "domain": r.get("domain"), "gold_candidate": r.get("gold_candidate"),
        })
        c = by_class.setdefault(cls, {"variance_class": cls, "attributes": 0, "values_affected": 0,
                                     "what": what if r.get("type_reclassified") != "Y" else VARIANCE_READING.get(cls, ("", ""))[0],
                                     "do": VARIANCE_READING.get(cls, ("", "review"))[1]})
        c["attributes"] += 1
        c["values_affected"] += minority_n
    classes = sorted(by_class.values(), key=lambda c: -c["attributes"])
    return {"loaded": bool(reg), "attributes": len(rows),
            "high": sum(1 for r in rows if r["severity"] == "high"),
            "reclassified": sum(1 for r in rows if r["type_reclassified"] == "Y"),
            "free_text": sum(1 for r in rows if r["is_free_text"] == "Y"),
            "classes": classes, "rows": rows}


def _tier(p):
    p = p or 0
    return "core" if p >= 99 else "common" if p >= 50 else "occasional" if p >= 5 else "rare"


@router.get("/schema-variance")
def schema_variance():
    """Why there are 12,951 key sets for 21,672 rows, and what they fold to:
    the optional keys that multiply key sets, the sizes, the long tail of
    one-row sets, the sets whose keys agree but whose types do not, and
    the families."""
    sch = _safe("SELECT schema_signature, attribute_count, attribute_list, record_count, "
                "typed_variant_count, record_pct, family_id FROM cp_advantage_ud_schema "
                "ORDER BY record_count DESC")
    fams = {f["family_id"]: f for f in _safe(
        "SELECT family_id, family_label, parents_present, parent_count, record_count, variant_count, "
        "min_attribute_count, max_attribute_count FROM cp_advantage_ud_family ORDER BY record_count DESC")}
    reg = _safe(f"SELECT {_REG_COLS} FROM cp_advantage_ud_registry ORDER BY record_presence_pct DESC NULLS LAST")
    run = {r["metric"]: r["value_num"] for r in _safe("SELECT metric, value_num FROM cp_advantage_ud_run")}
    rows_total = sum(s.get("record_count") or 0 for s in sch)
    sizes = {}
    for s in sch:
        n = s.get("attribute_count") or 0
        b = "1-5" if n <= 5 else "6-20" if n <= 20 else "21-50" if n <= 50 else "51-100" if n <= 100 else "100+"
        d = sizes.setdefault(b, {"bucket": b, "key_sets": 0, "rows": 0})
        d["key_sets"] += 1
        d["rows"] += s.get("record_count") or 0
    order = ["1-5", "6-20", "21-50", "51-100", "100+"]
    sizes = [sizes[b] for b in order if b in sizes]
    singletons = [s for s in sch if (s.get("record_count") or 0) == 1]
    typed_drift = [s for s in sch if (s.get("typed_variant_count") or 1) > 1]
    tiers = {}
    for r in reg:
        t = _tier(r.get("record_presence_pct"))
        tiers.setdefault(t, []).append(r["attribute_name"])
    # the keys that multiply key sets: present on some rows and absent on
    # others. Every one of them can double the number of exact key sets.
    optional = [{"attribute_name": r["attribute_name"], "record_presence_pct": r.get("record_presence_pct"),
                 "parent_attribute": r.get("parent_attribute"), "domain": r.get("domain")}
                for r in reg if 1 <= (r.get("record_presence_pct") or 0) < 99]
    top = []
    for s in sch[:15]:
        keys = [k.strip() for k in (s.get("attribute_list") or "").split(",") if k.strip()]
        parents = sorted({k.rsplit("_", 1)[0] for k in keys if k.count("_") == 2}, key=lambda p: int(p.split("_")[1]))
        singles = [k for k in keys if k.count("_") == 1]
        f = fams.get(s.get("family_id")) or {}
        top.append({"schema_signature": s["schema_signature"], "attribute_count": s.get("attribute_count"),
                    "record_count": s.get("record_count"), "record_pct": s.get("record_pct"),
                    "typed_variant_count": s.get("typed_variant_count"),
                    "blocks": parents, "singles": len(singles), "singles_sample": singles[:8],
                    "family_label": f.get("family_label")})
    return {"loaded": bool(sch),
            "key_sets": len(sch), "rows": rows_total, "families": len(fams),
            "declared_key_sets": run.get("schema_variants"), "declared_typed": run.get("typed_schema_variants"),
            "singletons": len(singletons), "singleton_rows": len(singletons),
            "typed_drift_sets": len(typed_drift), "typed_drift_rows": sum(s.get("record_count") or 0 for s in typed_drift),
            "sizes": sizes,
            "tiers": {k: len(v) for k, v in tiers.items()}, "core_keys": tiers.get("core", []),
            "optional_keys": optional, "optional_count": len(optional),
            "top": top, "families_list": list(fams.values())[:40]}
