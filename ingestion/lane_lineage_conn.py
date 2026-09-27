"""SEI crosswalk connector — the IMDS_STAR_UAF_SEI_Data_Lineage workbook.

WHAT THIS IS FOR

The PBDW workbook is one warehouse fed by one incumbent, and
legacy_lineage_conn.py reads it. This workbook is a different shape: one
warehouse (IMDS) fed by SEVERAL incumbents (STAR, UAF), plus a proposed SEI
mapping that reaches the warehouse through the incumbent's contract rather
than through a lineage of its own. Thirteen named sheets instead of four
fuzzy-matched ones.

WHY THIS IS ITS OWN MODULE AND NOT A CHANGE TO legacy_lineage_conn.py

The same reason legacy_source_file_conn.py gives, and it still holds: the copy
of legacy_lineage_conn.py in this repository is OLDER than the copy being run
(it has none of the [FIX 1..4] proof-parser patches), so editing it risks
reverting work that is live. A separate module can be added to a checkout
running any version of the lineage connector and changes nothing that already
loads. PBDW's rows, PBDW's loader and PBDW's schema are untouched by this file.

THE ONE FAILURE THIS FILE EXISTS TO AVOID

legacy_lineage_conn.LINEAGE_MAP looks headers up by exact key — "DWH_Target_Table".
The workbook emits "DWH_TARGET_TABLE". idx.get() returns None, the row is
skipped for want of a target, and the load reports zero rows with no error.
Every header here is matched through _hkey(), which folds case, spaces,
underscores and hyphens, so neither casing can miss.

THE JOIN

    legacy_lineage.src_source_table / src_source_column   the contract field
        <- sei_source_map.src_file_key / src_source_column

src_file_key is computed with legacy_source_file_conn.file_key — the function
that WRITES the column — so the key matches on the first try rather than
approximately.

THE LANE needs no new column on legacy_lineage. legacy_source_file already
carries source_system, so lane = (source_system, data_source).

RELOAD. loader._merge upserts and never deletes, which is why sql/49 had to
exist for PBDW. This connector does not repeat that: set CP_SEI_RELOAD=1 and
it deletes its own rows — scoped to (data_source, source_system) — before
inserting, so a row dropped from the workbook does not linger and inflate
every coverage percentage afterwards.

Run it:

    python -m ingestion.run sei_crosswalk

Env:
    CP_SEI_XLSX          the workbook (default sample-artifacts/SEI-CROSSWALK/…)
    CP_SEI_DATA_SOURCE   target warehouse (default IMDS)
    CP_SEI_RELOAD        "1" to delete this lane's rows before loading
"""
from __future__ import annotations
import os
import re
import hashlib
import logging

from openpyxl import load_workbook

log = logging.getLogger("cp.sei_crosswalk")

DEFAULT_XLSX = "sample-artifacts/SEI-CROSSWALK/IMDS_STAR_UAF_SEI_Data_Lineage.xlsx"
DEFAULT_DATA_SOURCE = os.environ.get("CP_SEI_DATA_SOURCE", "IMDS").upper()

# The feed-key function that writes legacy_source_file.src_file_key. Imported
# rather than reimplemented: a lookup computed any other way misses silently.
try:
    from .legacy_source_file_conn import file_key as _file_key
except Exception:                                              # pragma: no cover
    _EXT = re.compile(r"\.(dat|txt|csv|psv|tsv)$", re.I)
    _PH = re.compile(r"<[^>]*>|Y{4}M{2}D{2}(?:H{2}M{2}S{2})?", re.I)

    def _file_key(name):
        if not name:
            return ""
        s = _EXT.sub("", str(name).strip())
        s = _PH.sub(" ", s)
        s = re.sub(r"[\s/.\-]+", "_", s).strip("_").upper()
        return re.sub(r"_{2,}", "_", s)


# The canonical field code. BI/2-1 and BI_2_L1 must both become BI_2_1 or the
# join to an existing PBDW baseline matches nothing — the same rule
# _norm_code and _legacy_groups._CANON apply, reimplemented here because the
# ingestion package cannot import from the API package.
#
# The r"" on the replacement is load-bearing: in a plain string Python turns
# \1 into chr(1) and BI_2_L1 silently stops collapsing. _legacy_groups.py
# carries the same warning about the same backreference.
def _norm_code(code):
    if not code:
        return ""
    c = re.sub(r"[\s/.\-]+", "_", str(code).strip())
    c = re.sub(r"_{2,}", "_", c).strip("_").upper()
    return re.sub(r"_L(\d+)", r"_\1", c)


def _hkey(h):
    """Fold a header to a comparison key. DWH_Target_Table, DWH_TARGET_TABLE
    and 'dwh target table' all become DWHTARGETTABLE."""
    return re.sub(r"[^A-Z0-9]", "", str(h or "").upper())


def _s(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _isna(v):
    return str(v or "").strip().upper() in ("", "N/A", "NA", "NOT APPLICABLE", "NONE", "NULL")


def _nz(v):
    """N/A spelled out is an absent stage, not a value. Same rule the PBDW
    connector's nz() applies, so the two workbooks agree about emptiness."""
    return None if _isna(v) else _s(v)


_CHAIN_COLS = ("src_source_table", "src_source_column",
               "stg1_source_table", "stg1_source_column",
               "stg2_source_table", "stg2_source_column")


def _chain_hash(rec):
    """Same digest legacy_lineage_conn computes, over the same six columns, so
    ids from the two connectors are formed the same way and a column fed by
    two lanes lands as two rows instead of one overwriting the other."""
    raw = "|".join(str(rec.get(c) or "") for c in _CHAIN_COLS)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]


class Sheet:
    """One worksheet, addressed by folded header name."""

    def __init__(self, ws):
        self.ws = ws
        self.idx = {}
        for row in ws.iter_rows(min_row=1, max_row=1, values_only=True):
            for i, c in enumerate(row):
                k = _hkey(c)
                if k and k not in self.idx:
                    self.idx[k] = i
            break

    def rows(self):
        for row in self.ws.iter_rows(min_row=2, values_only=True):
            if not any(c is not None and str(c).strip() for c in row):
                continue
            yield row

    def get(self, row, *names):
        """First of `names` that the sheet actually has. Accepting several
        spellings is how SUBJECT_AREA and FUNCTIONAL_GROUP can both work while
        the prompt catches up."""
        for n in names:
            i = self.idx.get(_hkey(n))
            if i is not None and i < len(row):
                return _s(row[i])
        return None


class SeiCrosswalkConnector:
    name = "sei_crosswalk"

    SHEETS = {
        "lane":    ("LANE_REGISTER", "LANEREGISTER"),
        "feed":    ("SOURCE_FEED", "STAR_FEED"),
        "lineage": ("LANE_LINEAGE", "STAR_TO_IMDS"),
        "seifeed": ("SEI_FEED",),
        "map":     ("SEI_TO_CONTRACT", "SEI_TO_STAR"),
        "code":    ("CODE_SET",),
        "xwalk":   ("IDENTIFIER_XWALK",),
        "verify":  ("VERIFY",),
        "disp":    ("DISPOSITION",),
        "dual":    ("DUAL_SOURCE",),
        "exc":     ("EXCEPTIONS",),
    }

    def __init__(self, xlsx_path=None, data_source=None, reload_scope=False,
                 lineage_mode=None):
        self.xlsx_path = xlsx_path or os.environ.get("CP_SEI_XLSX", DEFAULT_XLSX)
        self.data_source = (data_source or DEFAULT_DATA_SOURCE).upper()
        self.reload_scope = reload_scope
        # load   — this workbook supplies the baseline (the IMDS case)
        # attach — a baseline already exists; load the SEI side only (PBDW)
        # auto   — decide by looking, and refuse rather than guess wrong
        self.lineage_mode = (lineage_mode or "auto").lower()
        self.counts = {}

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("CP_SEI_XLSX"),
                   os.environ.get("CP_SEI_DATA_SOURCE"),
                   os.environ.get("CP_SEI_RELOAD") == "1",
                   os.environ.get("CP_SEI_LINEAGE_MODE"))

    # ------------------------------------------------------------ parse ----
    def parse(self):
        if not os.path.exists(self.xlsx_path):
            log.warning("SEI crosswalk workbook not found: %s (skipping)", self.xlsx_path)
            return {}
        wb = load_workbook(self.xlsx_path, data_only=True, read_only=True)
        by_key = {_hkey(n): n for n in wb.sheetnames}
        sheets = {}
        self.matched = {}
        for role, names in self.SHEETS.items():
            for want in names:
                real = by_key.get(_hkey(want))
                if real:
                    sheets[role] = Sheet(wb[real])
                    self.matched[role] = want.upper()
                    break
        missing = [r for r in self.SHEETS if r not in sheets]
        if missing:
            log.warning("sei_crosswalk: sheets not found: %s", ", ".join(sorted(missing)))

        lanes = self._lanes(sheets.get("lane"))
        out = {
            "lane":    lanes,
            "feed":    self._feeds(sheets.get("feed"), lanes),
            "lineage": [], "srccol": [],
            "map":     self._map(sheets.get("map")),
            "code":    self._code(sheets.get("code")),
            "xwalk":   self._xwalk(sheets.get("xwalk")),
            "verify":  self._verify(sheets.get("verify")),
            "disp":    self._disp(sheets.get("disp")),
            "dual":    self._dual(sheets.get("dual")),
            "exc":     self._exc(sheets.get("exc")),
        }
        out["lineage"], out["srccol"] = self._lineage(sheets.get("lineage"))
        self.counts = {k: len(v) for k, v in out.items()}
        log.info("sei_crosswalk[%s]: %s", self.data_source,
                 ", ".join(f"{k}={v}" for k, v in sorted(self.counts.items())))
        return out

    def _lanes(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            lane = sh.get(row, "LANE_ID")
            if not lane:
                continue
            out.append({
                "lane_id": lane.upper(),
                "source_system": (sh.get(row, "SOURCE_SYSTEM") or "").upper() or None,
                "data_source": (sh.get(row, "DATA_SOURCE") or self.data_source).upper(),
                "replacement_state": (sh.get(row, "REPLACEMENT_STATE") or "REPLACED").upper(),
                "successor_system": _nz(sh.get(row, "SUCCESSOR_SYSTEM")),
                "contract_name": _nz(sh.get(row, "CONTRACT_NAME")),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _feeds(self, sh, lanes=None):
        """Incumbent feeds -> legacy_source_file, tagged with their lane's
        source_system. This is what makes the lane resolvable without a new
        column on legacy_lineage.

        THE FALLBACK MATTERS. Workbooks generated before LANE_ID existed have
        a SOURCE_FEED sheet with no lane column at all, and source_system then
        landed NULL — which left the warehouse's system list empty, which the
        UI read as "show every system", which is how IMDS came to offer
        AddVantage. Two fallbacks, in order of how much they assume:

          1. the sheet's own name. A sheet matched as STAR_FEED is STAR's by
             declaration; nothing else can be in it.
          2. the lane register, when the warehouse has exactly ONE incumbent
             lane. With one candidate there is nothing to guess between.

        If neither resolves, source_system stays NULL and the row is loaded
        anyway — but the endpoint reports it as unresolved rather than letting
        the UI fall back to showing everything."""
        if not sh:
            return []
        hint = None
        alias = (getattr(self, "matched", {}) or {}).get("feed", "")
        if alias.endswith("_FEED") and alias != "SOURCE_FEED":
            hint = alias[:-len("_FEED")]          # STAR_FEED -> STAR
        if not hint:
            incumbents = sorted({(l.get("source_system") or "").upper()
                                 for l in (lanes or [])
                                 if (l.get("source_system") or "").upper()
                                 not in ("", "SEI")})
            if len(incumbents) == 1:
                hint = incumbents[0]
        if hint:
            log.info("feed sheet has no LANE_ID; source_system resolved to %s", hint)
        out, seen = [], set()
        for row in sh.rows():
            feed = sh.get(row, "FEED_NAME")
            if not feed or feed in seen:
                continue
            seen.add(feed)
            lane = (sh.get(row, "LANE_ID") or "").upper()
            out.append({
                "src_file": feed,
                "src_file_key": _file_key(feed),
                "dataset": sh.get(row, "DATASET") or sh.get(row, "SUBJECT_AREA"),
                "source_system": (lane.split("_")[0] if lane else hint),
                "data_source": self.data_source,
            })
        return out

    def _lineage(self, sh):
        """One row per (lane, target table, target column) -> legacy_lineage,
        plus the contract field's own metadata -> legacy_src_column."""
        if not sh:
            return [], []
        lin, cols, seen_col = [], [], set()
        for row in sh.rows():
            tgt = sh.get(row, "DWH_TARGET_TABLE")
            col = sh.get(row, "DWH_TARGET_COLUMN")
            if not tgt or not col:
                continue
            src_t = _nz(sh.get(row, "SRC_SOURCE_TABLE"))
            src_c = _nz(sh.get(row, "SRC_SOURCE_COLUMN"))
            ds = (sh.get(row, "DATA_SOURCE") or self.data_source).upper()
            rec = {
                "dwh_target_table": tgt,
                "dwh_target_column": col,
                "dwh_type": _nz(sh.get(row, "DWH_TYPE")),
                "dwh_length": _nz(sh.get(row, "DWH_LENGTH")),
                "dwh_precision": _nz(sh.get(row, "DWH_PRECISION")),
                "stg2_source_table": _nz(sh.get(row, "STG2_SOURCE_TABLE")),
                "stg2_source_column": _nz(sh.get(row, "STG2_SOURCE_COLUMN")),
                "stg2_to_dwh_transform": _nz(sh.get(row, "STG2_TO_DWH_TRANSFORM")),
                "stg2_type": _nz(sh.get(row, "STG2_TYPE")),
                "stg2_length": _nz(sh.get(row, "STG2_LENGTH")),
                "stg2_precision": _nz(sh.get(row, "STG2_PRECISION")),
                "stg1_source_table": _nz(sh.get(row, "STG1_SOURCE_TABLE")),
                "stg1_source_column": _nz(sh.get(row, "STG1_SOURCE_COLUMN")),
                "stg1_type": _nz(sh.get(row, "STG1_TYPE")),
                "stg1_length": _nz(sh.get(row, "STG1_LENGTH")),
                "stg1_precision": _nz(sh.get(row, "STG1_PRECISION")),
                "stg1_to_stg2_transform": _nz(sh.get(row, "STG1_TO_STG2_TRANSFORM")),
                "src_source_table": src_t,
                "src_source_column": src_c,
                "src_to_stg1_transform": _nz(sh.get(row, "SRC_TO_STG1_TRANSFORM")),
                "lineage_status": sh.get(row, "LINEAGE_STATUS") or "MAPPED",
                "lineage_status_detail": sh.get(row, "LINEAGE_STATUS_DETAIL"),
                # FUNCTIONAL_GROUP is resolver 1 of _legacy_groups.py's chain.
                # SUBJECT_AREA is what the first workbook called it and feeds
                # none of them, so both spellings land in the same column.
                "functional_group": sh.get(row, "FUNCTIONAL_GROUP", "SUBJECT_AREA"),
                "table_type": sh.get(row, "TABLE_TYPE"),
                "data_source": ds,
                "is_ud": "N",
                "ud_key": None,
            }
            rec["lineage_id"] = f"{ds}:{tgt}:{col}:{_chain_hash(rec)}"
            lin.append(rec)

            if src_t and src_c:
                fk = _file_key(src_t)
                cid = f"{ds}:{fk}:{src_c}"
                if cid not in seen_col:
                    seen_col.add(cid)
                    cols.append({
                        "src_col_id": cid, "data_source": ds,
                        "src_file_key": fk, "src_source_column": src_c,
                        "src_col_norm": _norm_code(src_c),
                        "src_type": _nz(sh.get(row, "SRC_TYPE")),
                        "src_length": _nz(sh.get(row, "SRC_LENGTH")),
                        "src_precision": _nz(sh.get(row, "SRC_PRECISION")),
                        "src_nullable": _nz(sh.get(row, "SRC_NULLABLE")),
                        "src_description": sh.get(row, "SRC_DESCRIPTION", "CONTRACT_FIELD_DESCRIPTION"),
                        "unit_of_measure": _nz(sh.get(row, "UNIT_OF_MEASURE")),
                        "currency_basis": _nz(sh.get(row, "CURRENCY_BASIS")),
                        "sign_convention": _nz(sh.get(row, "SIGN_CONVENTION")),
                        "code_set_name": _nz(sh.get(row, "CODE_SET_NAME")),
                        "evidence": sh.get(row, "EVIDENCE"),
                        "source_doc": sh.get(row, "SOURCE_DOC"),
                    })
        # The same warning legacy_lineage_conn emits, for the same reason: a
        # column fed by two lanes is the finding, and it must survive the load.
        fan = len(lin) - len({f"{r['dwh_target_table']}:{r['dwh_target_column']}" for r in lin})
        if fan:
            log.info("sei_crosswalk: %d of %d rows share a target column with "
                     "another row (fan-in across lanes) — kept as separate rows",
                     fan, len(lin))
        return lin, cols

    def _map(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            feed = sh.get(row, "TARGET_CONTRACT_FEED", "TARGET_STAR_FEED")
            fld = sh.get(row, "TARGET_CONTRACT_FIELD", "TARGET_STAR_FIELD")
            if not feed or not fld:
                continue
            mid = sh.get(row, "MAP_ID")
            fk = _file_key(feed)
            if not mid:
                mid = f"{self.data_source}:{fk}:{fld}:{len(out) + 1}"
            out.append({
                "map_id": mid, "lane_id": (sh.get(row, "LANE_ID") or "").upper() or None,
                "data_source": self.data_source,
                "src_file_key": fk, "src_source_column": fld,
                "src_col_norm": _norm_code(fld),
                "sei_feed": _nz(sh.get(row, "SEI_FEED")),
                "sei_entity": _nz(sh.get(row, "SEI_ENTITY")),
                "sei_datapoint": _nz(sh.get(row, "SEI_DATAPOINT")),
                "sei_type": _nz(sh.get(row, "SEI_TYPE")),
                "sei_length": _nz(sh.get(row, "SEI_LENGTH")),
                "sei_scale": _nz(sh.get(row, "SEI_SCALE")),
                "sei_nullable": _nz(sh.get(row, "SEI_NULLABLE")),
                "sei_unit": _nz(sh.get(row, "SEI_UNIT_OF_MEASURE")),
                "sei_currency_basis": _nz(sh.get(row, "SEI_CURRENCY_BASIS")),
                "sei_sign": _nz(sh.get(row, "SEI_SIGN_CONVENTION")),
                "sei_code_set_name": _nz(sh.get(row, "SEI_CODE_SET_NAME")),
                "map_kind": (sh.get(row, "MAP_KIND") or "DIRECT").upper(),
                "composite_group": _nz(sh.get(row, "COMPOSITE_GROUP")),
                "composite_role": _nz(sh.get(row, "COMPOSITE_ROLE")),
                "map_rule": sh.get(row, "SEI_TO_CONTRACT_RULE", "SEI_TO_STAR_RULE"),
                "join_key": _nz(sh.get(row, "JOIN_KEY")),
                "depends_on_feed": _nz(sh.get(row, "DEPENDS_ON_FEED")),
                "evidence": sh.get(row, "EVIDENCE"),
                "source_doc": sh.get(row, "SOURCE_DOC"),
                "source_doc_locator": sh.get(row, "SOURCE_DOC_LOCATOR"),
                "open_question": sh.get(row, "OPEN_QUESTION"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _verify(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            tgt = sh.get(row, "DWH_TARGET_TABLE")
            col = sh.get(row, "DWH_TARGET_COLUMN")
            if not tgt or not col:
                continue
            lane = (sh.get(row, "LANE_ID") or "").upper()
            n = sh.get(row, "SEI_DATAPOINT_COUNT")
            try:
                n = int(float(n))
            except (TypeError, ValueError):
                n = 0
            out.append({
                "verify_id": f"{lane or 'NA'}:{tgt}:{col}",
                "lane_id": lane or None,
                "data_source": (sh.get(row, "DATA_SOURCE") or self.data_source).upper(),
                "dwh_target_table": tgt, "dwh_target_column": col,
                "functional_group": sh.get(row, "FUNCTIONAL_GROUP", "SUBJECT_AREA"),
                "contract_feed": _nz(sh.get(row, "CONTRACT_FEED", "STAR_FEED")),
                "contract_field": _nz(sh.get(row, "CONTRACT_FIELD", "STAR_FIELD")),
                "sei_datapoint_count": n,
                "sei_datapoints": _nz(sh.get(row, "SEI_DATAPOINTS")),
                "map_kind": _nz(sh.get(row, "MAP_KIND")),
                "match_verdict": (sh.get(row, "MATCH_VERDICT") or "UNKNOWN").upper(),
                "verdict_reason": sh.get(row, "VERDICT_REASON"),
                "failed_checks": sh.get(row, "FAILED_CHECKS"),
                "evidence_left": sh.get(row, "EVIDENCE_LEFT"),
                "evidence_right": sh.get(row, "EVIDENCE_RIGHT"),
                "blocks_cutover": "Y" if str(sh.get(row, "BLOCKS_CUTOVER") or "").upper().startswith("Y") else "N",
                "what_would_clear_it": sh.get(row, "WHAT_WOULD_CLEAR_IT"),
            })
        return out

    def _code(self, sh):
        if not sh:
            return []
        out, i = [], 0
        for row in sh.rows():
            name = sh.get(row, "CODE_SET_NAME")
            # A numeric CODE_SET_NAME means the sheet came back in the wrong
            # shape — a row number where a domain name belongs. Recorded rather
            # than loaded, so the screens do not fill with domains called "1".
            if not name or str(name).strip().isdigit():
                continue
            i += 1
            side = (sh.get(row, "SIDE") or "SEI").upper()
            val = sh.get(row, "CODE_VALUE") or "NOT_SUPPLIED"
            out.append({
                "code_id": f"{name}:{side}:{val}:{i}",
                "code_set_name": name, "side": side, "code_value": val,
                "code_description": sh.get(row, "CODE_DESCRIPTION"),
                "maps_to_side": _nz(sh.get(row, "MAPS_TO_SIDE")),
                "maps_to_code": _nz(sh.get(row, "MAPS_TO_CODE")),
                "maps_to_description": _nz(sh.get(row, "MAPS_TO_DESCRIPTION")),
                "evidence": sh.get(row, "EVIDENCE"),
                "source_doc": sh.get(row, "SOURCE_DOC"),
            })
        return out

    def _xwalk(self, sh):
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            ent = sh.get(row, "ENTITY")
            if not ent:
                continue
            out.append({
                "xwalk_id": f"{ent}:{sh.get(row, 'SEI_IDENTIFIER') or i}",
                "entity": ent,
                "sei_identifier": _nz(sh.get(row, "SEI_IDENTIFIER")),
                "star_identifier": _nz(sh.get(row, "STAR_IDENTIFIER")),
                "uaf_identifier": _nz(sh.get(row, "UAF_IDENTIFIER")),
                "imds_identifier": _nz(sh.get(row, "IMDS_IDENTIFIER")),
                "cardinality": _nz(sh.get(row, "CARDINALITY")),
                "resolution_rule": sh.get(row, "RESOLUTION_RULE"),
                "authoritative_side": _nz(sh.get(row, "AUTHORITATIVE_SIDE")),
                "evidence": sh.get(row, "EVIDENCE"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _disp(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            tgt, col = sh.get(row, "DWH_TARGET_TABLE"), sh.get(row, "DWH_TARGET_COLUMN")
            if not tgt or not col:
                continue
            lane = (sh.get(row, "LANE_ID") or "").upper()
            out.append({
                "disp_id": f"{lane or 'NA'}:{tgt}:{col}", "lane_id": lane or None,
                "dwh_target_table": tgt, "dwh_target_column": col,
                "disposition": (sh.get(row, "DISPOSITION") or "UNDECIDED").upper(),
                "disposition_detail": sh.get(row, "DISPOSITION_DETAIL"),
                "proposed_by": sh.get(row, "PROPOSED_BY"),
                "owner": sh.get(row, "OWNER"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _dual(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            tgt, col = sh.get(row, "DWH_TARGET_TABLE"), sh.get(row, "DWH_TARGET_COLUMN")
            if not tgt or not col:
                continue
            out.append({
                "dual_id": f"{self.data_source}:{tgt}:{col}",
                "data_source": self.data_source,
                "dwh_target_table": tgt, "dwh_target_column": col,
                "lanes": sh.get(row, "LANES"),
                "precedence_rule": sh.get(row, "PRECEDENCE_RULE") or "UNKNOWN",
                "proposed_by": sh.get(row, "PROPOSED_BY"),
                "owner": sh.get(row, "OWNER") or "IMDS data owner",
                "evidence": sh.get(row, "EVIDENCE"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _exc(self, sh):
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            issue = sh.get(row, "ISSUE")
            if not issue:
                continue
            out.append({
                "exc_id": f"{self.data_source}:{i}",
                "data_source": self.data_source,
                "sheet_name": sh.get(row, "SHEET"),
                "row_key": sh.get(row, "ROW_KEY"),
                "column_name": sh.get(row, "COLUMN"),
                "issue": issue,
                "why_unresolved": sh.get(row, "WHY_UNRESOLVED"),
                "who_can_answer": sh.get(row, "WHO_CAN_ANSWER"),
                "suggested_question": sh.get(row, "SUGGESTED_QUESTION"),
            })
        return out

    # ------------------------------------------------------------- load ----
    _TARGETS = [
        ("lane",    "legacy_lane",         ("lane_id",)),
        ("feed",    "legacy_source_file",  ("src_file",)),
        ("lineage", "legacy_lineage",      ("lineage_id",)),
        ("srccol",  "legacy_src_column",   ("src_col_id",)),
        ("map",     "sei_source_map",      ("map_id",)),
        ("verify",  "sei_verify",          ("verify_id",)),
        ("code",    "sei_code_set",        ("code_id",)),
        ("xwalk",   "sei_identifier_xwalk", ("xwalk_id",)),
        ("disp",    "sei_disposition",     ("disp_id",)),
        ("dual",    "sei_dual_source",     ("dual_id",)),
        ("exc",     "sei_exception",       ("exc_id",)),
    ]

    # legacy_lineage and legacy_source_file are SHARED with whatever loaded the
    # warehouse's baseline. They are written only in "load" mode, and purged
    # only in "load" mode. In "attach" mode this connector owns nothing in
    # them and must not touch either.
    _OWNED_IN_LOAD_MODE = ("lineage", "feed")

    def resolve_mode(self, loader):
        """Decide whether this workbook supplies the baseline or attaches to one.

        Getting this wrong is destructive in one direction: purging in load
        mode against a warehouse that already has a baseline deletes it. So
        "auto" looks, and where looking is inconclusive it refuses.
        """
        if self.lineage_mode in ("load", "attach"):
            return self.lineage_mode
        existing = 0
        try:
            cur = loader.conn.cursor()
            cur.execute("SELECT COUNT(*) FROM legacy_lineage WHERE data_source = :ds",
                        {"ds": self.data_source})
            existing = int((cur.fetchone() or [0])[0] or 0)
            cur.close()
        except Exception as e:                                  # noqa: BLE001
            log.warning("could not count existing lineage rows (%s); "
                        "assuming attach, which writes nothing to legacy_lineage", e)
            return "attach"
        if existing == 0:
            log.info("lineage mode: LOAD — %s has no baseline, this workbook supplies it",
                     self.data_source)
            return "load"
        log.info("lineage mode: ATTACH — %s already has %d lineage rows, so the "
                 "SEI side is loaded and the baseline is left to its own loader",
                 self.data_source, existing)
        return "attach"

    def load(self, loader, parsed):
        if not parsed:
            return 0
        mode = self.resolve_mode(loader)
        skip = set(self._OWNED_IN_LOAD_MODE) if mode == "attach" else set()
        if skip:
            n_skipped = sum(len(parsed.get(k, [])) for k in skip)
            if n_skipped:
                log.warning("attach mode: %d lineage/feed rows in the workbook are "
                            "NOT loaded — %s's baseline belongs to its own loader",
                            n_skipped, self.data_source)
        if self.reload_scope:
            self._purge(loader, parsed, mode)
        n = 0
        for key, table, pk in self._TARGETS:
            if key in skip:
                continue
            for rec in parsed.get(key, []):
                try:
                    loader._merge(table, pk, rec)
                    n += 1
                except Exception as e:                          # noqa: BLE001
                    log.warning("%s: row skipped (%s)", table, e)
        loader.commit()
        log.info("sei_crosswalk[%s/%s]: merged %d rows", self.data_source, mode, n)
        if mode == "attach":
            self._report_join(loader)
        return n

    def _report_join(self, loader):
        """In attach mode the whole load hinges on one thing: do the workbook's
        contract fields match the field codes already in legacy_lineage?

        For PBDW those are AddVantage codes, spelled BI/2-1 in one sheet and
        BI_2_L1 in another, so both sides are compared canonically. A non-zero
        count here is the finding, and it is worth more than the row count.
        """
        sql = """
            SELECT COUNT(*) FROM sei_source_map m
            WHERE  m.data_source = :ds
              AND  m.src_col_norm IS NOT NULL
              AND NOT EXISTS (
                    SELECT 1 FROM legacy_lineage l
                    WHERE  l.data_source = m.data_source
                      AND  REGEXP_REPLACE(UPPER(TRIM('_' FROM
                             REGEXP_REPLACE(l.src_source_column,
                               '[[:space:]/.-]+', '_'))),
                             '_L([0-9]+)', '_\\1') = m.src_col_norm)"""
        try:
            cur = loader.conn.cursor()
            cur.execute(sql, {"ds": self.data_source})
            orphans = int((cur.fetchone() or [0])[0] or 0)
            cur.execute("SELECT COUNT(*) FROM sei_source_map WHERE data_source = :ds",
                        {"ds": self.data_source})
            total = int((cur.fetchone() or [0])[0] or 0)
            cur.close()
        except Exception as e:                                  # noqa: BLE001
            log.warning("join health check skipped (%s)", e)
            return
        if orphans:
            log.warning("attach: %d of %d SEI mappings point at a contract field no "
                        "existing lineage row consumes. Either net-new scope or a "
                        "field code the canon rule does not reconcile — run the "
                        "health-check query in sql/52 to see which.", orphans, total)
        else:
            log.info("attach: all %d SEI mappings resolved to an existing lineage row",
                     total)

    def _purge(self, loader, parsed, mode="load"):
        """Delete this lane's own rows before loading.

        loader exposes only _merge and commit, and _merge never deletes — which
        is precisely the gap sql/49 was written to clean up after the fact for
        PBDW. Rather than repeat that, this deletes through the connection,
        scoped to (data_source, source_system) so no other lane and no other
        warehouse is touched. PBDW rows carry a different data_source and are
        never in range.
        """
        systems = sorted({(l.get("source_system") or "").upper()
                          for l in parsed.get("lane", [])} - {""})
        cur = loader.conn.cursor()
        # In attach mode legacy_lineage and legacy_source_file are somebody
        # else's rows. Deleting them here would wipe the warehouse's baseline —
        # for PBDW, every row the AddVantage workbook loaded.
        shared = {"legacy_lineage", "legacy_source_file"}
        scoped = [
            ("sei_source_map", "data_source = :ds"),
            ("sei_verify", "data_source = :ds"),
            ("sei_disposition", "lane_id IN (SELECT lane_id FROM legacy_lane WHERE data_source = :ds)"),
            ("sei_dual_source", "data_source = :ds"),
            ("sei_exception", "data_source = :ds"),
            ("legacy_src_column", "data_source = :ds"),
            ("legacy_lineage", "data_source = :ds"),
        ]
        for table, where in scoped:
            if mode == "attach" and table in shared:
                log.info("purge %s: skipped — attach mode does not own these rows", table)
                continue
            try:
                cur.execute(f"DELETE FROM {table} WHERE {where}", {"ds": self.data_source})
                log.info("purge %s: %d rows", table, cur.rowcount)
            except Exception as e:                              # noqa: BLE001
                log.warning("purge %s skipped (%s)", table, e)
        # legacy_source_file is shared, so it is scoped by system as well as
        # warehouse — and skipped entirely when attaching.
        for sysname in ([] if mode == "attach" else systems):
            try:
                cur.execute(
                    "DELETE FROM legacy_source_file "
                    "WHERE data_source = :ds AND source_system = :ss",
                    {"ds": self.data_source, "ss": sysname})
                log.info("purge legacy_source_file[%s]: %d rows", sysname, cur.rowcount)
            except Exception as e:                              # noqa: BLE001
                log.warning("purge legacy_source_file skipped (%s)", e)
        cur.close()
