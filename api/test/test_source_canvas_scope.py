"""The canvas must not disagree with the screen it sits on.

WHY. The Source view drew a spine reading "31 fields ... land in the IMDS
warehouse, across 4 tables" and, directly under it, "No warehouse column
records this feed as its source". Both came from LEGACY_LINEAGE and the
same feed. The spine's queries all go through _ds_scoped, which retries
with NO data-source filter when the scoped query finds nothing; this
endpoint hard-filtered on :ds and got zero. So a database whose lineage
rows carry a different data source (or none — the neighbouring queries
NVL it to PBDW, which is the tell) made the same screen state two
opposite things.

The second failure mode is the same shape. The read was one wide query
joining three side tables and naming twenty-six columns, wrapped in
_safe. Any unrun migration failed the statement, _safe returned [], and a
true sentence about the schema printed as a false sentence about the
business.

    python api/test/test_source_canvas_scope.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from api.app import routers_sei_crosswalk as M                # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


LL_COLS = ["LINEAGE_ID", "DATA_SOURCE", "SRC_SOURCE_TABLE", "DWH_TARGET_TABLE",
           "DWH_TARGET_COLUMN", "DWH_TYPE", "DWH_LENGTH", "SRC_SOURCE_COLUMN",
           "SRC_TYPE", "SRC_LENGTH", "SRC_TO_STG1_TRANSFORM",
           "STG1_TO_STG2_TRANSFORM", "STG2_TO_DWH_TRANSFORM", "LINEAGE_STATUS"]

ROWS = [
    {"lineage_id": f"L{i}", "dwh_target_table": f"T{i % 4}",
     "dwh_target_column": f"C{i}", "src_source_column": f"F{i}",
     "src_to_stg1_transform": None, "stg1_to_stg2_transform": None,
     "stg2_to_dwh_transform": "trim(F%d)" % i, "lineage_status": "MAPPED"}
    for i in range(31)
]


class Fake:
    """Stands in for the database. `tables` is what exists; `ds_value` is the
    DATA_SOURCE the lineage rows actually carry — None models the column
    being null, which is the case the live screen hit."""

    def __init__(self, tables=None, ds_value="IMDS", ll_cols=None,
                 core_raises=None):
        self.tables = tables if tables is not None else {
            "LEGACY_LINEAGE", "LEGACY_LINEAGE_LANE", "LEGACY_LINEAGE_XFORM",
            "SEI_TRANSFORMATION", "LEGACY_SOURCE_FILE", "FEED_ALIAS"}
        self.ds_value = ds_value
        self.ll_cols = ll_cols if ll_cols is not None else LL_COLS
        self.core_raises = core_raises
        self.seen = []

    def _cols(self, sql, p):
        t = (p.get("t") or "").upper()
        if t not in self.tables:
            return []
        if t == "LEGACY_LINEAGE":
            return [{"column_name": c} for c in self.ll_cols]
        return [{"column_name": "LINEAGE_ID"}]

    def query(self, sql, p=None):
        p = p or {}
        self.seen.append(sql)
        low = " ".join(sql.lower().split())
        if "tab_columns" in low:
            return self._cols(sql, p)
        # ORDER MATTERS. Every enrichment statement carries the core query
        # as its subselect, so a match on "from legacy_lineage l" would
        # answer the lane and xform reads with the core rows and hide the
        # very ORA-00942 this fixture exists to model. The specific
        # patterns go first.
        if "from legacy_lineage_lane" in low:
            if "LEGACY_LINEAGE_LANE" not in self.tables:
                raise RuntimeError("ORA-00942: table or view does not exist")
            return [{"lineage_id": r["lineage_id"], "source_system": "STAR",
                     "lane_id": "STAR_IMDS"} for r in ROWS]
        if "from legacy_lineage_xform" in low:
            if "LEGACY_LINEAGE_XFORM" not in self.tables:
                raise RuntimeError("ORA-00942: table or view does not exist")
            return [{"lineage_id": r["lineage_id"], "dwh_nullable": "Y",
                     "dwh_pk_flag": "N", "legacy_transformation_id": None,
                     "sei_transformation_id": None,
                     "transformation_equivalence": None} for r in ROWS]
        if "from sei_transformation" in low:
            if "SEI_TRANSFORMATION" not in self.tables:
                raise RuntimeError("ORA-00942: table or view does not exist")
            return []
        if "from legacy_lineage l" in low:
            if self.core_raises:
                raise RuntimeError(self.core_raises)
            # honour the data-source filter the way Oracle would
            if "l.data_source = :ds" in low and p.get("ds") != self.ds_value:
                return []
            return [dict(r) for r in ROWS]
        if "from legacy_source_file" in low:
            return [{"src_file": "PEDDIFI1", "dataset": "PEDDIFI1",
                     "source_system": "STAR", "business_name": "Portfolio Valuation"}]
        if "count(*)" in low:
            return [{"n": 0}]
        return []


def run(fake, **kw):
    M._query = fake.query
    import api.app._legacy_compat as C                         # noqa: N806

    def safe(sql, params=None):
        try:
            return fake.query(sql, params or {})
        except Exception:                                      # noqa: BLE001
            return []
    M._safe = safe
    C._safe = safe
    return M.source_canvas(src_table="PEDDIFI1", data_source="IMDS", **kw)


# ---- 1. the screen that disagreed with itself ---------------------------
# Rows are there but carry no data source. The spine found them by
# retrying unscoped; the canvas must find them too.
r = run(Fake(ds_value=None))
ok(len(r["targets"]) == 4, "rows with a NULL data source still reach the canvas",
   len(r["targets"]))
ok(r["column_count"] == 31, "and all 31 links arrive", r["column_count"])
ok(r["diagnostics"]["matched_on"] == "any data source",
   "the widened rung is recorded", r["diagnostics"]["matched_on"])
ok("scope_note" in r["diagnostics"] and "dropping the data-source filter"
   in r["diagnostics"]["scope_note"], "and the screen is told to say so",
   r["diagnostics"].get("scope_note"))

# A different data source, not a null one — same widening, same honesty.
r = run(Fake(ds_value="PBDW"))
ok(len(r["targets"]) == 4, "rows under another data source still reach the canvas",
   len(r["targets"]))

# ---- 2. the exact match must stay exact ---------------------------------
r = run(Fake(ds_value="IMDS"))
ok(r["diagnostics"]["matched_on"] == "exact",
   "a clean database matches on the first rung", r["diagnostics"]["matched_on"])
ok("scope_note" not in r["diagnostics"],
   "and says nothing, because there is nothing to say")
ok(r["diagnostics"]["ok"] is True, "and reports no problem")

# ---- 3. an unrun migration costs a badge, never the screen --------------
for missing in ("LEGACY_LINEAGE_LANE", "LEGACY_LINEAGE_XFORM", "SEI_TRANSFORMATION"):
    tabs = {"LEGACY_LINEAGE", "LEGACY_LINEAGE_LANE", "LEGACY_LINEAGE_XFORM",
            "SEI_TRANSFORMATION", "LEGACY_SOURCE_FILE", "FEED_ALIAS"} - {missing}
    r = run(Fake(tables=tabs))
    ok(len(r["targets"]) == 4, f"{missing} absent: the canvas still draws",
       len(r["targets"]))
    ok(missing in r["diagnostics"]["missing"],
       f"{missing} absent: and it is named", r["diagnostics"]["missing"])

# every one of them missing at once
r = run(Fake(tables={"LEGACY_LINEAGE", "LEGACY_SOURCE_FILE"}))
ok(len(r["targets"]) == 4, "all three side tables absent: the canvas still draws",
   len(r["targets"]))
ok(r["column_count"] == 31, "with every link", r["column_count"])

# ---- 4. a missing enrichment COLUMN is not a missing screen -------------
thin = [c for c in LL_COLS if c not in
        ("SRC_TYPE", "SRC_LENGTH", "STG1_TO_STG2_TRANSFORM")]
r = run(Fake(ll_cols=thin))
ok(len(r["targets"]) == 4, "a lineage table without the newer columns still draws",
   len(r["targets"]))
ok("SRC_TYPE" in r["diagnostics"]["degraded"],
   "and the columns it went without are named", r["diagnostics"]["degraded"])

# ---- 5. a real failure must read as a failure ---------------------------
r = run(Fake(core_raises="ORA-00904: invalid identifier"))
ok(r["diagnostics"]["ok"] is False, "a failed read is not reported as no data")
ok("ORA-00904" in (r["diagnostics"]["reason"] or ""),
   "and the error is carried to the screen", r["diagnostics"]["reason"])

# ---- 6. no lineage table at all -----------------------------------------
r = run(Fake(tables={"LEGACY_SOURCE_FILE"}))
ok(r["diagnostics"]["ok"] is False and "LEGACY_LINEAGE" in r["diagnostics"]["missing"],
   "a missing LEGACY_LINEAGE is named, not silently empty", r["diagnostics"])

# ---- 7. a genuinely unmapped feed still says the true thing -------------
class NoRows(Fake):
    def query(self, sql, p=None):
        low = " ".join(sql.lower().split())
        if "from legacy_lineage l" in low:
            return []
        return super().query(sql, p)


r = run(NoRows())
ok(not r["targets"], "a feed with no lineage has no targets")
ok(r["diagnostics"]["ok"] is True, "which is data, not an error")
ok((r["diagnostics"].get("reason") or "") != "",
   "and the screen is given a reason to print", r["diagnostics"].get("reason"))

# ---- 8. binds must match the statement ----------------------------------
# Oracle rejects a bind the SQL does not use. The unscoped rungs have no
# :ds in them, so they must not be handed one.
f = Fake(ds_value=None)
run(f)
for sql in f.seen:
    low = " ".join(sql.lower().split())
    if "from legacy_lineage" in low and ":ds" not in low:
        ok("data_source = :ds" not in low,
           "an unscoped statement carries no :ds bind", sql[:90])

print(f"\n{BAD} assertion(s) failed" if BAD else "\nsource-canvas scope assertions pass")
sys.exit(1 if BAD else 0)
