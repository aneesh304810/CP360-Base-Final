"""The AddVantage UD metadata workbook ("AddV User Defined Fields ... .xlsx").

Two sheets the brief describes, one it hopes for:

  List    a multi-block layout, columns side by side: the UD entities
          ("1=ACCOUNTMASTER" with a count), the lookup-table catalogue
          ("6 - TABLE 714 - TAX AND TAX EXEMPT"), SME notes, and the
          field-type dictionary (Type / Name / Type Description).
  Tables  one row per lookup table code: Table Number, Table Name, Code,
          Description1..5, Rubal Notes. Codes are kept as strings.
          Table 5 (OFFICER TABLE) holds employee names: PII.
  ?       a sheet mapping UD number -> lookup table. The brief does not
          know whether it exists. If a sheet has a UD-number column and a
          table-number column, it is loaded as VERIFIED links. If none
          does, links are INFERRED from the overlap between the codes the
          extract carries for an attribute (cp_advantage_ud_dictionary,
          OBSERVED) and the codes a table defines, and marked
          STRONGLY_INFERRED, never VERIFIED.

Loads: cp_advantage_ud_table, cp_advantage_ud_field_type (upsert),
cp_advantage_ud_dictionary (source TABLES), cp_advantage_ud_link, and
updates the registry's class where a verified link makes the field type
known (DICTIONARY beats RULE).

Env:
  CP_ADDV_UD_WORKBOOK   the xlsx (default: the first *User Defined*.xlsx
                        under local-data/advantage-ud)
"""
from __future__ import annotations

import logging
import os
import re

from .base import BaseConnector
from .advantage_ud_rules import split_key

log = logging.getLogger("cp.advantage_ud")

DOCUMENTED_LIST = {"ud fields", "tables", "rubal notes", "type", "name", "type description", ""}
DOCUMENTED_TABLES = {"id", "table number", "table name", "code", "description1", "description2",
                     "description3", "description4", "description5", "rubal notes"}
TABLE_RE = re.compile(r"^\s*(\d+)\s*-\s*TABLE\s+(\d+)\s*-\s*(.+?)\s*$", re.I)
ENTITY_RE = re.compile(r"^\s*(\d+)\s*=\s*([A-Z][A-Z0-9_ ]*)\s*$", re.I)
TRP_RE = re.compile(r"^\s*ud\s+(\d+)(?:\s+(\d+))?\s*$", re.I)
PII_TABLES = {5}
FIELD_TYPE_CLASS = {1: "DATE", 2: "BOOLEAN_FLAG", 3: "TEXT", 4: "CURRENCY", 6: "CODE_DESCRIPTION"}


def is_trp_header(h):
    return bool(TRP_RE.match(str(h or "")))


def trp_header_to_key(h):
    m = TRP_RE.match(str(h or ""))
    if not m:
        return None
    return f"UD_{int(m.group(1))}" + (f"_{int(m.group(2))}" if m.group(2) else "")


def _s(v):
    if v is None:
        return ""
    return str(v).strip()


_NUMLIKE = re.compile(r"^[+-]?\d+(\.\d+)?$")


def find_header_row(ws, scan=8):
    """The row with the most non-empty TEXT cells among the first few. Title
    rows above a header have one or two; data rows below it carry numbers,
    which do not count, so a wide data row cannot outscore the header. Ties
    go to the earlier row. Returns (row_number, headers)."""
    best, best_n, best_hdr = 1, -1, []
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=scan, values_only=True), 1):
        vals = [_s(c) for c in row]
        n = sum(1 for v in vals if v and not _NUMLIKE.match(v))
        if n > best_n:
            best, best_n, best_hdr = i, n, vals
    while best_hdr and not best_hdr[-1]:
        best_hdr.pop()
    return best, best_hdr


def _col(hdr, *names):
    low = [h.strip().lower() for h in hdr]
    for n in names:
        if n in low:
            return low.index(n)
    return None


class AdvantageUdWorkbookConnector(BaseConnector):
    name = "advantage_ud_workbook"

    def __init__(self, path, observed_codes=None):
        self.path = path
        # {attribute_name: set(code_value)} from the extract, for inference
        self.observed = observed_codes

    @classmethod
    def from_env(cls):
        p = os.environ.get("CP_ADDV_UD_WORKBOOK")
        if not p:
            base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "local-data", "advantage-ud")
            if os.path.isdir(base):
                for n in sorted(os.listdir(base)):
                    if n.lower().endswith(".xlsx") and "user defined" in n.lower():
                        p = os.path.join(base, n); break
        return cls(p)

    # ------------------------------------------------------------- parse
    def parse(self):
        b = {"tables": [], "field_types": [], "entities": [], "codes": [], "links": [],
             "mapping_sheet": None, "sheets": [], "notes": []}
        if not self.path or not os.path.exists(self.path):
            log.warning("advantage_ud_workbook: %s not found, nothing loaded", self.path)
            return b
        from openpyxl import load_workbook
        wb = load_workbook(self.path, read_only=True, data_only=True)
        b["sheets"] = [ws.title for ws in wb.worksheets]
        for ws in wb.worksheets:
            t = ws.title.strip().lower()
            if t == "list":
                self._parse_list(ws, b)
            elif t == "tables":
                self._parse_tables(ws, b)
        for ws in wb.worksheets:
            if ws.title.strip().lower() in ("list", "tables"):
                continue
            if self._try_mapping(ws, b):
                b["mapping_sheet"] = ws.title
                break
        if not b["links"] and self.observed:
            b["links"] = self._infer_links(b["codes"])
            b["notes"].append("no UD->table sheet; links inferred from code overlap")
        log.info("advantage_ud_workbook: %d tables, %d field types, %d entities, %d codes, %d links (%s)",
                 len(b["tables"]), len(b["field_types"]), len(b["entities"]), len(b["codes"]), len(b["links"]),
                 b["mapping_sheet"] or "inferred")
        return b

    def _parse_list(self, ws, b):
        hr, hdr = find_header_row(ws)
        ci_tables = _col(hdr, "tables")
        ci_notes = _col(hdr, "rubal notes")
        ci_type = _col(hdr, "type")
        ci_name = _col(hdr, "name")
        ci_desc = _col(hdr, "type description")
        ci_ud = _col(hdr, "ud fields")
        seen_t, seen_ft = set(), set()
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            cells = [_s(c) for c in row]
            g = lambda i: cells[i] if i is not None and i < len(cells) else ""
            m = TABLE_RE.match(g(ci_tables))
            if m and int(m.group(2)) not in seen_t:
                seen_t.add(int(m.group(2)))
                b["tables"].append({"table_number": int(m.group(2)), "table_name": m.group(3)[:200],
                                    "table_type": int(m.group(1)), "code_count": None,
                                    "is_pii": "Y" if int(m.group(2)) in PII_TABLES else "N",
                                    "sme_notes": g(ci_notes)[:2000] or None})
            tc = g(ci_type)
            if tc.isdigit() and int(tc) not in seen_ft and g(ci_name):
                seen_ft.add(int(tc))
                b["field_types"].append({"type_code": int(tc), "type_name": g(ci_name)[:60],
                                         "type_description": g(ci_desc)[:1000] or None,
                                         "value_class": FIELD_TYPE_CLASS.get(int(tc))})
            e = ENTITY_RE.match(g(ci_ud))
            if e:
                # the count sits in the unlabeled column to the right
                cnt = g(ci_ud + 1) if ci_ud is not None else ""
                b["entities"].append({"entity_code": int(e.group(1)), "entity_name": e.group(2).strip(),
                                      "ud_count": int(cnt) if cnt.isdigit() else None})

    def _parse_tables(self, ws, b):
        hr, hdr = find_header_row(ws)
        ci_tn, ci_name, ci_code = _col(hdr, "table number"), _col(hdr, "table name"), _col(hdr, "code")
        ci_d = [_col(hdr, f"description{i}") for i in range(1, 6)]
        ci_notes = _col(hdr, "rubal notes")
        if ci_tn is None or ci_code is None:
            log.warning("Tables sheet lacks Table Number / Code columns; skipped")
            return
        counts = {}
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            cells = [_s(c) for c in row]
            g = lambda i: cells[i] if i is not None and i < len(cells) else ""
            tn = g(ci_tn)
            if not tn or not re.match(r"^\d+(\.0)?$", tn):
                continue
            tn = int(float(tn))
            code = g(ci_code)
            if code == "":
                continue
            # openpyxl hands a numeric cell back as a float: 1000.0. A code is
            # text; "000100" only survives because the cell was text already.
            if re.match(r"^\d+\.0$", code):
                code = code[:-2]
            pii = tn in PII_TABLES
            descs = [g(i) for i in ci_d]
            counts[tn] = counts.get(tn, 0) + 1
            b["codes"].append({
                "dict_key": f"UD_T{tn}:{code}:TABLES"[:200],
                "attribute_name": f"UD_T{tn}",        # rewritten to the UD key once linked
                "parent_attribute": None, "code_value": code[:50],
                "description_value": ("•••" if pii else (descs[0] or ""))[:400],
                "occurrence_count": None, "source": "TABLES", "table_number": tn,
                "link_status": "TABLES", "is_pii": "Y" if pii else "N",
                "_table_name": g(ci_name), "_descs": descs, "_notes": g(ci_notes),
            })
        for t in b["tables"]:
            t["code_count"] = counts.get(t["table_number"])
        known = {t["table_number"] for t in b["tables"]}
        for tn, n in counts.items():
            if tn not in known:
                name = next((c["_table_name"] for c in b["codes"] if c["table_number"] == tn), "")
                b["tables"].append({"table_number": tn, "table_name": name[:200] or None, "table_type": None,
                                    "code_count": n, "is_pii": "Y" if tn in PII_TABLES else "N", "sme_notes": None})

    def _try_mapping(self, ws, b):
        hr, hdr = find_header_row(ws)
        low = [h.strip().lower() for h in hdr]
        ci_ud = next((i for i, h in enumerate(low) if h in ("ud", "ud number", "ud field", "ud_number", "field", "ud fields")), None)
        ci_tn = next((i for i, h in enumerate(low) if h in ("table number", "table", "table_number", "table no")), None)
        if ci_ud is None or ci_tn is None:
            return False
        n = 0
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            cells = [_s(c) for c in row]
            u, t = (cells[ci_ud] if ci_ud < len(cells) else ""), (cells[ci_tn] if ci_tn < len(cells) else "")
            um = re.search(r"(\d+)", u); tm = re.search(r"(\d+)", t)
            if not um or not tm:
                continue
            b["links"].append({"attribute_name": f"UD_{int(um.group(1))}", "table_number": int(tm.group(1)),
                               "link_status": "VERIFIED", "overlap_pct": None, "observed_codes": None,
                               "matched_codes": None, "source_sheet": ws.title[:200]})
            n += 1
        return n > 0

    def _infer_links(self, table_codes):
        by_table = {}
        for c in table_codes:
            by_table.setdefault(c["table_number"], set()).add(c["code_value"])
        out = []
        for attr, codes in (self.observed or {}).items():
            if not codes:
                continue
            best = None
            for tn, tcodes in by_table.items():
                m = len(codes & tcodes)
                if m and (best is None or m > best[1]):
                    best = (tn, m)
            if best:
                pct = round(100.0 * best[1] / len(codes), 2)
                out.append({"attribute_name": attr, "table_number": best[0],
                            "link_status": "STRONGLY_INFERRED" if pct >= 80 else "WEAK",
                            "overlap_pct": pct, "observed_codes": len(codes), "matched_codes": best[1],
                            "source_sheet": None})
        return out

    # -------------------------------------------------------------- load
    def load(self, loader, bundle):
        n = 0
        for t in bundle["tables"]:
            loader._merge("cp_advantage_ud_table", ("table_number",), t); n += 1
        for f in bundle["field_types"]:
            loader._merge("cp_advantage_ud_field_type", ("type_code",), f); n += 1
        # a linked table's codes are filed under the UD key(s) that use it
        by_table = {}
        for l in bundle["links"]:
            if l["link_status"] in ("VERIFIED", "STRONGLY_INFERRED"):
                by_table.setdefault(l["table_number"], []).append(l["attribute_name"])
        for c in bundle["codes"]:
            row = {k: v for k, v in c.items() if not k.startswith("_")}
            targets = by_table.get(c["table_number"]) or [c["attribute_name"]]
            for a in targets:
                r = dict(row); r["attribute_name"] = a
                r["dict_key"] = f"{a}:{c['code_value']}:TABLES"[:200]
                r["link_status"] = next((l["link_status"] for l in bundle["links"]
                                         if l["attribute_name"] == a and l["table_number"] == c["table_number"]), "TABLES")
                loader._merge("cp_advantage_ud_dictionary", ("dict_key",), r); n += 1
        for l in bundle["links"]:
            loader._merge("cp_advantage_ud_link", ("attribute_name", "table_number"), l); n += 1
        loader.commit()
        return n
