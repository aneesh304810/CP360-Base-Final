"""The extract itself: dataVar.csv -> cp_advantage_ud_raw, _attribute, _quarantine.

Streamed with the csv module, never pandas: the CLOB carries embedded
newlines inside quotes, every column is a string, and 21,672 rows of 100
keys is 1.2 million attribute rows that must not sit in memory at once.
Each chunk is parsed with ingestion.advantage_ud_parser (the profiler's
rules) and merged in bulk.

Data quality rules, from the brief:
  invalid JSON      -> quarantine, with the first 1000 chars; the load goes on
  unknown UD key    -> registered (a minimal registry row, INFERRED), never a failure
  new schema        -> warned, and recorded in cp_advantage_ud_schema
  leading zeros     -> kept, the value is a string
  free text         -> preserved as is
  missing attribute -> not a deletion: a key absent from today's payload
                       leaves yesterday's attribute row where it is

Env:
  CP_ADDV_UD_EXTRACT   the csv (default local-data/advantage-ud/dataVar.csv)
  CP_ADDV_UD_CHUNK     rows per batch (default 2000)
"""
from __future__ import annotations

import csv
import hashlib
import logging
import os
import sys

from .base import BaseConnector
from .advantage_ud_parser import parse_payload, clean_json_text
from .advantage_ud_bulk import bulk_merge
from .advantage_ud_rules import classify, split_key

log = logging.getLogger("cp.advantage_ud")
csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

ID_COLS = ["ACCOUNT_NUMBER", "AS_OF_DATE", "LOAD_DATE", "BATCH_ID", "LOAD_TYPE", "FIS_LOAD_DATE",
           "ACTIVE_IND", "ACCOUNT_UD_KEY", "ACCOUNT_KEY", "CREATED_TSP", "UPDATED_TSP"]
CLOB = "USER_DEFINED_ATTRIBUTE_CLOB"


def _num(v):
    v = (v or "").strip()
    try:
        return int(float(v)) if v else None
    except ValueError:
        return None


class AdvantageUdExtractConnector(BaseConnector):
    name = "advantage_ud_extract"

    def __init__(self, path, chunk=2000, known_attributes=None, known_schemas=None):
        self.path = path
        self.chunk = chunk
        # what the registry / schema table already hold, so the run can say
        # what is NEW; the step fills these from the database when it can.
        self.known_attributes = set(known_attributes or [])
        self.known_schemas = set(known_schemas or [])

    @classmethod
    def from_env(cls):
        p = os.environ.get("CP_ADDV_UD_EXTRACT") or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "local-data", "advantage-ud", "dataVar.csv")
        return cls(p, chunk=int(os.environ.get("CP_ADDV_UD_CHUNK") or 2000))

    # ------------------------------------------------------------ stream
    def rows(self):
        """Yields (source_row_number, dict) with upper-cased headers."""
        with open(self.path, newline="", encoding="utf-8-sig") as fh:
            rd = csv.DictReader(fh)
            hdr = {h.strip().upper(): h for h in (rd.fieldnames or [])}
            if CLOB not in hdr:
                raise ValueError(f"{os.path.basename(self.path)} lacks {CLOB}; has {rd.fieldnames}")
            for i, r in enumerate(rd, 2):           # header is line 1
                yield i, {u: (r.get(o) or "") for u, o in hdr.items()}

    def parse_row(self, n, r):
        """One extract row -> (raw, attributes, quarantine|None)."""
        key = _num(r.get("ACCOUNT_UD_KEY"))
        acct = (r.get("ACCOUNT_NUMBER") or "").strip()
        text = clean_json_text(r.get(CLOB))
        p = parse_payload(r.get(CLOB))
        raw = {
            "account_ud_key": key, "account_number": acct[:20], "account_key": _num(r.get("ACCOUNT_KEY")),
            "as_of_date": (r.get("AS_OF_DATE") or "")[:30] or None, "load_date": (r.get("LOAD_DATE") or "")[:60] or None,
            "batch_id": (r.get("BATCH_ID") or "").strip()[:30] or None, "load_type": (r.get("LOAD_TYPE") or "")[:20] or None,
            "fis_load_date": (r.get("FIS_LOAD_DATE") or "")[:60] or None,
            "active_ind": (r.get("ACTIVE_IND") or "").strip()[:1] or None,
            "created_tsp": (r.get("CREATED_TSP") or "")[:60] or None, "updated_tsp": (r.get("UPDATED_TSP") or "")[:60] or None,
            "source_row_number": n,
            "payload_hash": hashlib.sha256((text or "").encode("utf-8")).hexdigest() if text else None,
            "payload_length": len(text) if text else 0,
            "key_count": len(p["keys"]), "schema_signature": p["schema_signature"],
            "typed_signature": p["typed_signature"], "parse_status": "QUARANTINED" if p["error"] else "OK",
        }
        raw["_keys"] = p["keys"]            # stripped before the merge
        if p["error"]:
            q = {"quarantine_key": (str(key) if key is not None else f"row:{n}")[:100],
                 "source_row_number": n, "account_number": acct[:20] or None, "account_ud_key": key,
                 "batch_id": raw["batch_id"], "parse_error": p["error"][:400],
                 "payload_sample": (text or "")[:1000]}
            return raw, [], q
        attrs = []
        for a in p["attributes"]:
            attrs.append({
                "attr_key": f"{key}:{a['attribute_name']}"[:100],
                "account_ud_key": key, "account_number": acct[:20],
                "attribute_name": a["attribute_name"][:60], "attribute_number": a["attribute_number"],
                "parent_attribute": a["parent_attribute"], "sequence_number": a["sequence_number"],
                "key_structure": a["key_structure"], "is_ud_attribute": a["is_ud_attribute"],
                "raw_value": (a["raw_value"] or "")[:4000] if a["raw_value"] is not None else None,
                "value_type": a["value_type"], "date_mask": a["date_mask"],
                "code_value": (a["code_value"] or "")[:100] or None,
                "description_value": (a["description_value"] or "")[:2000] or None,
                "leading_zero_ind": a["leading_zero_ind"], "value_length": a["value_length"],
            })
        return raw, attrs, None

    # -------------------------------------------------------------- load
    def load(self, loader, bundle=None):
        """Stream, parse, merge. Returns a summary dict, which is also the
        run's log line. A missing ACCOUNT_UD_KEY row is quarantined too: the
        attribute table keys on it."""
        if not os.path.exists(self.path):
            log.warning("advantage_ud_extract: %s not found, nothing loaded", self.path)
            return {"rows": 0}
        s = {"rows": 0, "ok": 0, "quarantined": 0, "attributes": 0, "new_attributes": set(),
             "new_schemas": set(), "schemas": {}}
        raws, attrs, quars = [], [], []

        def flush():
            bulk_merge(loader, "cp_advantage_ud_raw", ("account_ud_key",),
                       [{k: v for k, v in r.items() if not k.startswith("_")} for r in raws])
            bulk_merge(loader, "cp_advantage_ud_attribute", ("attr_key",), attrs)
            bulk_merge(loader, "cp_advantage_ud_quarantine", ("quarantine_key",), quars)
            loader.commit()
            raws.clear(); attrs.clear(); quars.clear()

        for n, r in self.rows():
            s["rows"] += 1
            raw, arows, q = self.parse_row(n, r)
            if raw["account_ud_key"] is None and q is None:
                q = {"quarantine_key": f"row:{n}", "source_row_number": n, "account_number": raw["account_number"] or None,
                     "account_ud_key": None, "batch_id": raw["batch_id"], "parse_error": "MISSING_ACCOUNT_UD_KEY",
                     "payload_sample": None}
                raw["parse_status"] = "QUARANTINED"; arows = []
            if q:
                s["quarantined"] += 1
                quars.append(q)
                if raw["account_ud_key"] is not None:
                    raws.append(raw)
                continue
            s["ok"] += 1
            raws.append(raw)
            attrs.extend(arows)
            s["attributes"] += len(arows)
            for a in arows:
                if a["attribute_name"] not in self.known_attributes:
                    s["new_attributes"].add(a["attribute_name"])
            sig = raw["schema_signature"]
            if sig and sig not in self.known_schemas:
                s["new_schemas"].add(sig)
            sc = s["schemas"].setdefault(sig, {"schema_signature": sig, "attribute_count": raw["key_count"],
                                               "attribute_list": ", ".join(raw["_keys"]),
                                               "record_count": 0, "typed": set()})
            sc["record_count"] += 1
            sc["typed"].add(raw["typed_signature"])
            if len(raws) >= self.chunk:
                flush()
        flush()
        # register unknown keys, minimally; the profile step fills the rest
        for a in sorted(s["new_attributes"]):
            n_, parent, seq, ks = split_key(a)
            vc, dom, silver, src = classify(a, None, None, None)
            loader._merge("cp_advantage_ud_registry", ("attribute_name",), {
                "attribute_name": a, "attribute_number": n_, "parent_attribute": parent, "sequence_number": seq,
                "key_structure": ks, "is_ud_attribute": "Y" if ks != "NON_STANDARD" else "N",
                "value_class": vc, "domain": dom, "silver_entity": silver, "class_source": "INFERRED"})
        # new exact key sets are recorded, never refused
        for sig in sorted(s["new_schemas"]):
            sc = s["schemas"][sig]
            loader._merge("cp_advantage_ud_schema", ("schema_signature",), {
                "schema_signature": sig, "attribute_count": sc["attribute_count"], "attribute_list": sc["attribute_list"],
                "record_count": sc["record_count"], "typed_variant_count": len(sc["typed"])})
        loader.commit()
        if s["new_attributes"]:
            log.warning("advantage_ud_extract: %d keys not in the registry were registered: %s",
                        len(s["new_attributes"]), ", ".join(sorted(s["new_attributes"])[:20]))
        if s["new_schemas"]:
            log.warning("advantage_ud_extract: %d exact key sets not seen before (schema drift)", len(s["new_schemas"]))
        out = {k: (len(v) if isinstance(v, set) else v) for k, v in s.items() if k != "schemas"}
        out["distinct_schemas"] = len(s["schemas"])
        log.info("advantage_ud_extract: %s", out)
        return out
