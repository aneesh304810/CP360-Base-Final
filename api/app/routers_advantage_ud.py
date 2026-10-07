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
    for r in rows:
        r["shape"] = _shape(r)
    return {"attributes": rows}
