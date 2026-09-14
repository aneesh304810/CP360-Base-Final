"""PII matcher — runs LAST. Scans every field across all four modules, matches
against the PII dictionary (normalize + exact, partial substring >=4 chars),
writes pii_field_matches with denormalized project_id, and updates source tables.
"""
from __future__ import annotations
import hashlib
import logging

from .loader import Loader
from .pii_classification_conn import normalize

log = logging.getLogger("cp.pii_matcher")


class PiiMatcher:
    def __init__(self, loader: Loader, conn):
        self.loader = loader
        self.conn = conn
        self._dict: dict[str, dict] = {}

    def _load_dictionary(self) -> None:
        cur = self.conn.cursor()
        cur.execute("""SELECT pii_component_normalized, pii_attribute,
                              sensitivity_category FROM pii_classifications""")
        for norm, attr, cat in cur.fetchall():
            self._dict[norm] = {"attribute": attr, "category": cat}
        cur.close()
        log.info("pii_matcher: loaded %d dictionary entries", len(self._dict))

    def _match(self, field_name: str):
        """Return (component_norm, attribute, category, confidence) or None."""
        norm = normalize(field_name)
        if not norm:
            return None
        if norm in self._dict:
            d = self._dict[norm]
            return norm, d["attribute"], d["category"], "exact"
        # partial: dictionary component contained in field (>=4 chars)
        for comp_norm, d in self._dict.items():
            if len(comp_norm) >= 4 and comp_norm in norm:
                return comp_norm, d["attribute"], d["category"], "partial"
        return None

    def run(self) -> int:
        self._load_dictionary()
        if not self._dict:
            log.warning("pii_matcher: empty dictionary, skipping")
            return 0
        total = 0
        total += self._match_columns()
        total += self._match_api_fields()
        total += self._match_interfaces()
        self.loader.commit()
        log.info("pii_matcher: wrote %d matches", total)
        return total

    def _write_match(self, module, ref_type, ref_key, parent, field_name,
                     result, project_id) -> None:
        comp_norm, attr, cat, conf = result
        match_id = hashlib.sha1(
            f"{module}|{ref_key}|{field_name}".encode()).hexdigest()[:16]
        self.loader._merge("pii_field_matches", ("match_id",), {
            "match_id": match_id, "module": module, "ref_type": ref_type,
            "ref_key": ref_key, "parent_name": parent,
            "matched_field_name": field_name,
            "pii_component_normalized": comp_norm, "pii_attribute": attr,
            "sensitivity_category": cat, "match_confidence": conf,
            "project_id": project_id,
        })

    def _match_columns(self) -> int:
        cur = self.conn.cursor()
        cur.execute("""SELECT c.platform_id, c.schema_name, c.object_name,
                              c.column_name, NVL(d.project_id,'internal')
                       FROM columns c
                       LEFT JOIN datasets d
                         ON d.platform_id=c.platform_id AND d.schema_name=c.schema_name
                        AND d.object_name=c.object_name""")
        rows = cur.fetchall()
        cur.close()
        n = 0
        for plat, sch, obj, col, proj in rows:
            res = self._match(col)
            if not res:
                continue
            ds_key = f"{plat}.{sch}.{obj}".lower()
            self._write_match("data360", "column", f"{ds_key}.{col}".lower(),
                              obj, col, res, proj)
            upd = self.conn.cursor()
            upd.execute("""UPDATE columns SET is_pii='Y', pii_category=:c,
                           pii_attribute=:a
                           WHERE platform_id=:p AND schema_name=:s
                             AND object_name=:o AND column_name=:cn""",
                        {"c": res[2], "a": res[1], "p": plat, "s": sch,
                         "o": obj, "cn": col})
            upd.close()
            n += 1
        return n

    def _match_api_fields(self) -> int:
        cur = self.conn.cursor()
        try:
            cur.execute("""SELECT f.endpoint_key, f.field_name,
                                  NVL(e.project_id,'sei')
                           FROM api_fields f
                           LEFT JOIN api_endpoints e ON e.endpoint_key=f.endpoint_key""")
            rows = cur.fetchall()
        except Exception:
            cur.close()
            return 0
        cur.close()
        n = 0
        for ekey, fname, proj in rows:
            res = self._match(fname)
            if not res:
                continue
            self._write_match("api360", "api_field", f"{ekey}.{fname}", ekey,
                              fname, res, proj)
            upd = self.conn.cursor()
            upd.execute("""UPDATE api_fields SET is_pii='Y', pii_category=:c,
                           pii_attribute=:a
                           WHERE endpoint_key=:k AND field_name=:f""",
                        {"c": res[2], "a": res[1], "k": ekey, "f": fname})
            upd.close()
            n += 1
        return n

    def _match_interfaces(self) -> int:
        cur = self.conn.cursor()
        try:
            cur.execute("""SELECT interface_id, integration_name, source_project_id
                           FROM interface360_interfaces""")
            rows = cur.fetchall()
        except Exception:
            cur.close()
            return 0
        cur.close()
        n = 0
        for iid, integ, proj in rows:
            res = self._match(integ or "")
            if not res:
                continue
            self._write_match("interface360", "interface", iid, integ,
                              integ, res, proj or "internal")
            upd = self.conn.cursor()
            upd.execute("""UPDATE interface360_interfaces
                           SET carries_pii='Y', pii_categories=:c
                           WHERE interface_id=:i""",
                        {"c": res[2], "i": iid})
            upd.close()
            n += 1
        return n
