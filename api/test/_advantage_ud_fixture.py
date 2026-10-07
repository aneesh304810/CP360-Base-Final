"""A synthetic profile drop, shaped exactly like the profiler's files, and
an in-memory stand-in for db.query. Shared by the tests and the render
harness. Every value is invented: no account, name or batch id."""
import csv
import os
import re
import tempfile

HEAD = {
    "attribute_profile.csv": ["attribute_name", "attribute_number", "parent_attribute", "sequence_number",
        "key_structure", "is_ud_attribute", "occurrence_count", "record_presence_pct", "distinct_value_count",
        "null_or_blank_count", "min_value_length", "max_value_length", "avg_value_length", "dominant_type",
        "dominant_type_pct", "type_variance_ind", "type_distribution", "leading_zero_count", "date_masks",
        "sample_values"],
    "type_variance.csv": ["attribute_name", "occurrence_count", "dominant_type", "dominant_type_pct",
        "variance_class", "type_distribution", "sample_values"],
    "parent_structures.csv": ["parent_attribute", "record_count", "observed_sequences",
        "missing_sequences_in_observed_range", "min_children_per_record", "max_children_per_record",
        "avg_children_per_record"],
    "schema_variants.csv": ["schema_signature", "attribute_count", "attribute_list", "record_count",
        "typed_schema_variant_count", "record_pct"],
    "code_conflicts.csv": ["attribute_name", "code_value", "description_count", "descriptions"],
    "run_summary.csv": ["metric", "value"],
    "code_dictionary.csv": ["attribute_name", "code_value", "description_value", "occurrence_count"],
}

TOTAL = 21672


def prof(a, occ, dist, mn, mx, dom, pct=100.0, var="N", td=None, lz=0, masks="", nulls=0):
    n = int(a.split("_")[1]); parts = a.split("_")
    parent = f"UD_{n}" if len(parts) > 2 else ""
    return [a, n, parent, (parts[2] if len(parts) > 2 else ""), ("MULTIPART" if parent else "SINGLE"), "Y",
            f"{occ}.0", round(100.0 * occ / TOTAL, 4), dist, nulls, mn, mx, (mn + mx) / 2, dom, pct, var,
            td or '{"%s": %d}' % (dom, occ), lz, masks, '["MASKED"]']


ROWS = {
    "attribute_profile.csv": [
        prof("UD_1", 21500, 7, 14, 21, "CODE_DESCRIPTION"),
        prof("UD_14", 20100, 4, 13, 24, "CODE_DESCRIPTION"),
        prof("UD_503", 9800, 4, 8, 13, "CODE_DESCRIPTION"),
        prof("UD_613", 21672, 1, 1, 1, "BOOLEAN_FLAG"),
        prof("UD_51", 3100, 40, 8, 10, "DATE", 97.2, "Y", '{"DATE": 3013, "TEXT": 87}', 0, "MM/DD/YYYY|DD/MM/YYYY"),
        prof("UD_23_1", 15200, 4100, 9, 9, "IDENTIFIER_LEADING_ZERO", 100.0, "N", None, 15200),
        prof("UD_23_2", 15200, 3900, 3, 32, "TEXT"),
        prof("UD_23_3", 14900, 3900, 6, 6, "TEXT"),
        prof("UD_32_1", 7100, 2000, 5, 32, "TEXT", 99.9, "Y", '{"TEXT": 7093, "CODE_DESCRIPTION": 7}'),
        prof("UD_32_2", 6900, 2100, 5, 32, "TEXT"),
        prof("UD_32_19", 800, 300, 10, 32, "TEXT", 98.0, "Y", '{"TEXT": 784, "CODE_DESCRIPTION": 16}'),
        prof("UD_506_1", 5200, 1200, 4, 32, "TEXT"),
        prof("UD_506_2", 4000, 1100, 4, 32, "TEXT"),
        prof("UD_527_1", 1200, 1150, 10, 10, "TIMESTAMP", 100.0, "Y", '{"TIMESTAMP": 1190, "INTEGER": 10}'),
        prof("UD_540_1", 300, 290, 10, 10, "TIMESTAMP"),
        prof("UD_80", 4400, 2, 1, 1, "BOOLEAN_FLAG", 94.0, "Y", '{"BOOLEAN_FLAG": 4136, "TEXT": 264}'),
    ],
    "type_variance.csv": [
        ["UD_51", 3100, "DATE", 97.2, "DATE_FORMAT_OR_TEXT_VARIANCE", '{"DATE": 3013, "TEXT": 87}', "[]"],
        ["UD_32_1", 7100, "TEXT", 99.9, "CODE_VS_FREE_TEXT_VARIANCE", '{"TEXT": 7093, "CODE_DESCRIPTION": 7}', "[]"],
        ["UD_32_19", 800, "TEXT", 98.0, "CODE_VS_FREE_TEXT_VARIANCE", "{}", "[]"],
        ["UD_527_1", 1200, "TIMESTAMP", 100.0, "IDENTIFIER_NUMERIC_COLLISION", "{}", "[]"],
        ["UD_80", 4400, "BOOLEAN_FLAG", 94.0, "FLAG_REPRESENTATION_VARIANCE", "{}", "[]"],
    ],
    "parent_structures.csv": [
        ["UD_23", 15200, "1,2,3,4,5,6", "", 1, 6, 3.4],
        ["UD_32", 7100, "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20", "", 1, 20, 4.2],
        ["UD_506", 5200, "1,2,3,4", "", 1, 4, 1.8],
        ["UD_527", 1200, "1,2", "", 1, 2, 1.1],
        ["UD_540", 300, "1", "", 1, 1, 1.0],
        ["UD_623", 90, "1,2,3,4,5,6,7,10", "8,9", 1, 8, 2.0],
    ],
    "schema_variants.csv": [
        ["a1b2c3d4e5f60001", 1, "UD_613", 2400, 1, 11.07],
        ["a1b2c3d4e5f60002", 5, "UD_1, UD_14, UD_503, UD_613, UD_80", 3100, 2, 14.30],
        ["a1b2c3d4e5f60003", 8, "UD_1, UD_14, UD_23_1, UD_23_2, UD_23_3, UD_503, UD_613, UD_80", 6000, 3, 27.68],
        ["a1b2c3d4e5f60004", 9, "UD_1, UD_14, UD_23_1, UD_23_2, UD_23_3, UD_51, UD_503, UD_613, UD_80", 2500, 2, 11.53],
        ["a1b2c3d4e5f60005", 12, "UD_1, UD_14, UD_23_1, UD_23_2, UD_23_3, UD_32_1, UD_32_2, UD_503, UD_506_1, UD_506_2, UD_613, UD_80", 4100, 5, 18.91],
        ["a1b2c3d4e5f60006", 30, "UD_1, UD_14, UD_23_1, UD_23_2, UD_23_3, UD_32_1, UD_32_2, UD_32_19, UD_503, UD_506_1, UD_506_2, UD_527_1, UD_613, UD_80", 1200, 4, 5.53],
        ["a1b2c3d4e5f60007", 60, "UD_1, UD_14, UD_32_1, UD_32_2, UD_32_19, UD_540_1, UD_613", 300, 1, 1.38],
        ["a1b2c3d4e5f60008", 110, "UD_1, UD_23_1, UD_23_2, UD_23_3, UD_32_1, UD_32_2, UD_32_19, UD_506_1, UD_506_2, UD_613", 90, 1, 0.41],
    ],
    "code_conflicts.csv": [
        ["UD_32_19", "ANNUAL MIN", 3, "87500 | 87,500 | 87500.00"],
        ["UD_32_1", "FEE SCHEDULE", 2, "Standard | STANDARD"],
        ["UD_32_2", "NOTE", 2, "see rider | per agreement"],
    ],
    "run_summary.csv": [
        ["source_rows", "21672.0"], ["successfully_parsed_rows", "21672.0"], ["parse_error_rows", "0.0"],
        ["parse_success_pct", "100.0"], ["extracted_attribute_values", "1199055.0"],
        ["distinct_attributes", "284.0"], ["schema_variants", "12951.0"], ["typed_schema_variants", "13420.0"],
        ["attributes_with_type_variance", "90.0"], ["code_description_pairs", "3475.0"], ["code_conflicts", "12.0"],
    ],
    "code_dictionary.csv": [
        ["UD_1", "1", "INTERNAL/FIRM ACCOUNT", "41"], ["UD_1", "2", "CLIENT ACCOUNT", "18210.0"],
        ["UD_1", "3", "EMPLOYEE ACCOUNT", "310"], ["UD_1", "4", "PARTNER RELATIVE", "96"],
        ["UD_1", "5", "EMPLOYEE RELATIVE", "220"], ["UD_1", "6", "PARTNER ACCOUNT", "402"],
        ["UD_1", "7", "RETIRED PARTNER", "57"],
        ["UD_14", "TE", "TAX EXEMPT", "9000"], ["UD_14", "TX", "TAXABLE", "11000"],
        ["UD_503", "S", "SINGLY", "6000"], ["UD_503", "J", "JOINTLY", "3000"],
        ["UD_32_19", "ANNUAL MIN", "87500", "3"],
    ],
}


def write_drop(folder=None):
    d = folder or tempfile.mkdtemp()
    os.makedirs(d, exist_ok=True)
    for name, cols in HEAD.items():
        with open(os.path.join(d, name), "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(cols)
            for r in ROWS[name]:
                w.writerow(r)
    return d


class FakeDb:
    """Answers db.query from loaded bundles, by the table named in the SQL
    and the bind values, enough for the routes' statements."""
    TABLES = {"cp_advantage_ud_registry": "registry", "cp_advantage_ud_parent": "parents",
              "cp_advantage_ud_family": "families", "cp_advantage_ud_schema": "schemas",
              "cp_advantage_ud_conflict": "conflicts", "cp_advantage_ud_run": "run",
              "cp_advantage_ud_dictionary": "codes"}

    def __init__(self, profile_bundle, codes_bundle):
        self.data = dict(profile_bundle)
        self.data["codes"] = list(codes_bundle.get("codes", []))
        self.calls = []

    def __call__(self, sql, params=None):
        self.calls.append((sql, params))
        s = " ".join(sql.split()).lower()
        m = re.search(r"from (cp_advantage_ud_\w+)", s)
        if not m:
            return []
        if m.group(1) not in self.TABLES:          # sql/77 tables: not in the drop
            return []
        rows = [dict(r) for r in self.data.get(self.TABLES[m.group(1)], [])]
        p = params or {}
        if "attribute_name = :a" in s:
            rows = [r for r in rows if r.get("attribute_name") == p.get("a")]
        if "parent_attribute = :p" in s:
            rows = [r for r in rows if r.get("parent_attribute") == p.get("p")]
        if "domain = :d" in s:
            rows = [r for r in rows if r.get("domain") == p.get("d")]
        if "type_variance_ind = 'y'" in s:
            rows = [r for r in rows if r.get("type_variance_ind") == "Y"]
        if "gold_candidate = 'y'" in s:
            rows = [r for r in rows if r.get("gold_candidate") == "Y"]
        if "count(*) as n" in s and "group by" not in s:
            return [{"n": len(rows)}]
        if "count(distinct attribute_name) as n" in s:
            return [{"n": len({r["attribute_name"] for r in rows})}]
        if "group by conflict_class" in s:
            c = {}
            for r in rows:
                c[r["conflict_class"]] = c.get(r["conflict_class"], 0) + 1
            return [{"conflict_class": k, "n": v} for k, v in c.items()]
        if "group by attribute_count" in s:
            c = {}
            for r in rows:
                c[r["attribute_count"]] = c.get(r["attribute_count"], 0) + (r.get("record_count") or 0)
            return [{"attribute_count": k, "records": v} for k, v in sorted(c.items())]
        if "group by source" in s:
            c = {}
            for r in rows:
                c[r["source"]] = c.get(r["source"], 0) + 1
            return [{"source": k, "n": v} for k, v in c.items()]
        if "group by attribute_name" in s:
            c = {}
            for r in rows:
                c[r["attribute_name"]] = c.get(r["attribute_name"], 0) + 1
            return [{"attribute_name": k, "code_count": v, "link_status": "OBSERVED"} for k, v in sorted(c.items())]
        if "order by record_count desc" in s:
            rows.sort(key=lambda r: -(r.get("record_count") or 0))
        if "order by sequence_number" in s:
            rows.sort(key=lambda r: (r.get("sequence_number") or 0))
        if "order by record_presence_pct desc" in s:
            rows.sort(key=lambda r: -(r.get("record_presence_pct") or 0))
        return rows


def load_all(folder):
    """Parse both connectors against the drop; return (profile, codes, db)."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from ingestion.advantage_ud_profile_conn import AdvantageUdProfileConnector
    from ingestion.advantage_ud_dictionary_conn import AdvantageUdDictionaryConnector
    pb = AdvantageUdProfileConnector(folder).parse()
    cb = AdvantageUdDictionaryConnector(os.path.join(folder, "code_dictionary.csv")).parse()
    return pb, cb, FakeDb(pb, cb)
