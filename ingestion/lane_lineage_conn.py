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
def _usage_key(family, field):
    """The workbook's own normalisation: FAMILY|FIELDNOSPACES.

    This is NOT _norm_code. The usage matrix ships NORMALIZED_KEY shaped
    ACDDIFI1|ENTITYNUMBER, where _norm_code would give ENTITY_NUMBER --
    it folds separators to underscores rather than removing them. Both
    rules are legitimate and both are in use, so the one that joins the
    usage tables has to be the one that built them.

    Written once, here, and used for both sides of that join: the usage
    rows on the way in and SEI_VERIFY.CONTRACT_KEY. A second copy in SQL
    would be free to drift, and a join that silently stops matching does
    not raise -- it returns a smaller number, which here reads as good
    news.
    """
    f = re.sub(r"[^A-Z0-9]", "", str(field or "").upper())
    if not f:
        return None
    fam = re.sub(r"[^A-Z0-9]", "", str(family or "").upper())
    return f"{fam}|{f}" if fam else f


def _usage_field_key(field):
    """The field half alone -- the fallback when the feed name does not
    line up. CONTRACT_FEED is sometimes the bare family and sometimes a
    longer label; the field name is the dependable half."""
    f = re.sub(r"[^A-Z0-9]", "", str(field or "").upper())
    return f or None


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


def _num(v):
    """A count, or None. Never 0 for "could not read it".

    openpyxl hands back a real int for a numeric cell and a string for one
    somebody typed with a comma or a space. Both have to land as the same
    number, and anything that is neither has to come back as None -- a
    zero would read on screen as "this family publishes no fields", which
    is a statement, and a wrong one.
    """
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    t = str(v).strip().replace(",", "").replace(" ", "")
    if not t or _isna(t):
        return None
    try:
        return int(float(t))
    except ValueError:
        return None


def _pct(v):
    """A percentage out of 100 -- the LAST resort, and ambiguous by nature.

    Sheet.get() stringifies every cell, so the type that would have told
    a fraction from a number is gone by the time this is called. Excel
    stores a cell formatted "7.1%" as 0.071 and one typed as text as
    "7.1%", and both arrive here as a string. Worse, "1" is 100% from a
    percent-formatted cell and 1% from a hand-typed one, and nothing in
    the value says which.

    So this applies the only rule available -- a bare value below 1 is
    read as a fraction -- and _usagesum prefers to DERIVE the percentage
    from used/total, which has no ambiguity at all. This is used only
    when those two are missing.
    """
    if v is None or isinstance(v, bool):
        return None
    t = str(v).strip().rstrip("%").strip()
    if not t or _isna(t):
        return None
    try:
        f = float(t)
    except ValueError:
        return None
    # An explicit "%" says the number is already out of 100: "0.5%" is
    # half a percent and must not become 50%.
    if "%" in str(v):
        return round(f, 2)
    return round(f * 100, 2) if 0 < f < 1 else round(f, 2)


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

    # Feeds arrive on ONE SHEET PER SYSTEM — STAR_FEED, UAF_FEED — not on a
    # single SOURCE_FEED. Matching only the first meant UAF_FEED was dropped
    # whole, so UAF never reached legacy_source_file, so the warehouse's
    # system list never knew UAF fed IMDS. Every one of these that exists is
    # read, and the sheet's own name supplies the system.
    FEED_SHEETS = (("SOURCE_FEED", None), ("STAR_FEED", "STAR"),
                   ("UAF_FEED", "UAF"), ("ADDVANTAGE_FEED", "ADDVANTAGE"),
                   ("CRD_FEED", "CRD"))

    SHEETS = {
        "lane":    ("LANE_REGISTER", "LANEREGISTER"),
        "lineage": ("LANE_LINEAGE", "STAR_TO_IMDS"),
        "seifeed": ("SEI_FEED",),
        "map":     ("SEI_TO_CONTRACT", "SEI_TO_STAR"),
        "code":    ("CODE_SET",),
        "xwalk":   ("IDENTIFIER_XWALK",),
        "verify":  ("VERIFY",),
        "disp":    ("DISPOSITION",),
        "dual":    ("DUAL_SOURCE",),
        "exc":     ("EXCEPTIONS",),
        "seiinput": ("SEI_INPUT_LINEAGE",),
        "seicat":   ("SEI_CATALOG_VERIFY",),
        "uafschema": ("UAF_FIELD_SCHEMA",),
        # The eight sheets the "With-Transformations" workbook added.
        "xform":    ("TRANSFORMATION_REGISTER",),
        "xcompare": ("TRANSFORMATION_COMPARISON",),
        "starfld":  ("STAR_LAYOUT_DETAIL",),
        "uploader": ("STAR_UPLOADER_LINEAGE",),
        "recon":    ("NEW_EVIDENCE_RECON",),
        "enums":    ("ENUMS",),
        "lotmap":   ("LOT_LEVEL_POSITION_MAP",),
        # STAR field usage: which published fields anybody actually reads.
        # Three sheets rather than one because the summary carries counts
        # from the layout side that the matrix has no rows for -- which is
        # why the workbook also ships the reconciliation.
        "usage":      ("STAR_FIELD_USAGE_MATRIX",),
        "usagesum":   ("STAR_FIELD_USAGE_SUMMARY",),
        "usagerecon": ("STAR_FIELD_USAGE_RECON",),
    }

    # Three sheets share one shape — (name, value, explanation) with a
    # status — and land in SEI_CONTROL together, tagged with the sheet they
    # came from. Three tables of a dozen rows would be three joins for one
    # panel.
    CONTROL_SHEETS = (("_MANIFEST", "MANIFEST"),
                      ("FINAL_VERIFICATION", "FINAL_VERIFICATION"),
                      ("TRANSFORMATION_SUMMARY", "TRANSFORMATION_SUMMARY"))

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
        feeds = []
        for want, sysname in self.FEED_SHEETS:
            real = by_key.get(_hkey(want))
            if real:
                feeds += self._feeds(Sheet(wb[real]), lanes, sysname, want)
        out = {
            "lane":    lanes,
            "feed":    feeds,
            "lineage": [], "srccol": [], "linelane": [],
            "map":     self._map(sheets.get("map")),
            "code":    self._code(sheets.get("code")),
            "xwalk":   self._xwalk(sheets.get("xwalk")),
            "verify":  self._verify(sheets.get("verify")),
            "disp":    self._disp(sheets.get("disp")),
            "dual":    self._dual(sheets.get("dual")),
            "exc":     self._exc(sheets.get("exc")),
            "seifeed":  self._seifeed(sheets.get("seifeed")),
            "seiinput": self._seiinput(sheets.get("seiinput")),
            "seicat":   self._seicat(sheets.get("seicat")),
            "uafschema": self._uafschema(sheets.get("uafschema")),
            "xform":    self._xform(sheets.get("xform")),
            "xcompare": self._xcompare(sheets.get("xcompare")),
            "starfld":  self._starfld(sheets.get("starfld")),
            "uploader": self._uploader(sheets.get("uploader")),
            "recon":    self._recon(sheets.get("recon")),
            "enums":    self._enums(sheets.get("enums")),
            "lotmap":   self._lotmap(sheets.get("lotmap")),
            "usage":      self._usage(sheets.get("usage")),
            "usagesum":   self._usagesum(sheets.get("usagesum")),
            "usagerecon": self._usagerecon(sheets.get("usagerecon")),
            "control":  [],
        }
        # the three summary sheets, into one table, tagged by origin
        for want, label in self.CONTROL_SHEETS:
            real = by_key.get(_hkey(want))
            if real:
                out["control"] += self._control(Sheet(wb[real]), label)
        out["lineage"], out["srccol"], out["linelane"], out["linexform"] = \
            self._lineage(sheets.get("lineage"), lanes)
        # DISPOSITION lost its LANE_ID column in the new workbook — it is
        # keyed on (table, column) alone now. Every query that scoped a
        # disposition to a warehouse went through LANE_ID, so left as-is the
        # undecided count reads zero and the purge deletes nothing. Resolve
        # it from the VERIFY row for the same column, which always carries
        # one, and stamp DATA_SOURCE either way.
        self._fill_disposition_lane(out)
        # A sheet that parsed to zero rows is the quietest failure there is:
        # the headers did not match and nothing says so. Print what was
        # actually in the header row, so the next run diagnoses itself.
        role_of_key = {"xform": "xform", "xcompare": "xcompare",
                       "starfld": "starfld", "uploader": "uploader",
                       "recon": "recon", "enums": "enums", "lotmap": "lotmap",
                       "seiinput": "seiinput", "uafschema": "uafschema",
                       "seicat": "seicat", "seifeed": "seifeed",
                       "map": "map", "lineage": "lineage", "verify": "verify",
                       "code": "code", "disp": "disp", "xwalk": "xwalk",
                       "exc": "exc", "lane": "lane",
                       "usage": "usage", "usagesum": "usagesum",
                       "usagerecon": "usagerecon"}
        for key, role in role_of_key.items():
            sheet = sheets.get(role)
            if sheet is not None and not out.get(key):
                log.warning("%s parsed 0 rows. Its header row is: %s",
                            role, ", ".join(sorted(sheet.idx.keys())) or "(empty)")

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

    def _feeds(self, sh, lanes=None, sysname=None, sheet_name=None):
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
        hint = sysname                            # the sheet's own system
        if not hint:
            incumbents = sorted({(l.get("source_system") or "").upper()
                                 for l in (lanes or [])
                                 if (l.get("source_system") or "").upper()
                                 not in ("", "SEI")})
            if len(incumbents) == 1:
                hint = incumbents[0]

        out, seen = [], set()
        for row in sh.rows():
            feed = sh.get(row, "FEED_NAME", "FEED", "STAR_FEED", "UAF_FEED",
                          "SOURCE_FEED", "FEED_FAMILY")
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
        if hint:
            log.info("%s: %d feeds tagged source_system=%s",
                     sheet_name or "feed sheet", len(out), hint)
        return out

    def _lineage(self, sh, lanes=None):
        """One row per (lane, target table, target column) -> legacy_lineage,
        plus the contract field's own metadata -> legacy_src_column, plus the
        row's lane -> legacy_lineage_lane.

        THE LANE IS THE THIRD RETURN AND IT IS THE POINT. LEGACY_LINEAGE is
        shared, so it cannot gain a lane column; without one, STAR and UAF
        rows sit in the same table under the same DATA_SOURCE and nothing can
        tell them apart. That is why selecting UAF in the badge row filtered
        nothing — there was nothing to filter on. LANE_LINEAGE has carried
        LANE_ID on every row all along; this reads it.

        Where a row has no LANE_ID, the same two fallbacks _feeds uses apply,
        in the same order: the warehouse's single incumbent lane if it has
        exactly one, else nothing. An unattributed row stays in the baseline
        and is reported, never dropped and never guessed at."""
        if not sh:
            return [], [], [], []
        # lane_id -> source_system, from the register the workbook declared
        lane_sys = {(l.get("lane_id") or "").upper(): (l.get("source_system") or "").upper()
                    for l in (lanes or []) if l.get("lane_id")}
        incumbents = sorted({v for v in lane_sys.values() if v and v != "SEI"})
        solo = incumbents[0] if len(incumbents) == 1 else None
        solo_lane = next((k for k, v in lane_sys.items() if v == solo), None) if solo else None
        lin, cols, lanerows, xforms, seen_col = [], [], [], [], set()
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

            lane = (sh.get(row, "LANE_ID") or "").upper()
            sysname = lane_sys.get(lane) or (lane.split("_")[0] if lane else None)
            if not lane and solo:
                lane, sysname = solo_lane, solo
            # The ten columns LANE_LINEAGE gained, into their own side
            # table: eight transformation columns plus DWH_NULLABLE and
            # DWH_PK_FLAG, which are target facts legacy_lineage has nowhere
            # to put either.
            #
            # A row is written when ANY of the ten is present, not only when
            # a transformation is — a UAF row with a nullability and a key
            # flag and no transformation is still worth keeping, and
            # dropping it would lose a fact the workbook supplied. What must
            # stay distinguishable is "no transformation recorded" from "row
            # absent", and a null transformation_id inside a present row
            # says the first cleanly.
            xf = {
                "legacy_transformation_id": _nz(sh.get(row, "LEGACY_TRANSFORMATION_ID")),
                "sei_transformation_id": _nz(sh.get(row, "SEI_TRANSFORMATION_ID")),
                "sei_equivalent_transformation": sh.get(row, "SEI_EQUIVALENT_TRANSFORMATION"),
                "sei_source_objects": sh.get(row, "SEI_SOURCE_OBJECTS"),
                "sei_source_fields": sh.get(row, "SEI_SOURCE_FIELDS"),
                "transformation_equivalence": _nz(sh.get(row, "TRANSFORMATION_EQUIVALENCE")),
                "transformation_approval": _nz(sh.get(row, "TRANSFORMATION_APPROVAL_STATUS")),
                "transformation_evidence": sh.get(row, "TRANSFORMATION_EVIDENCE_SOURCE"),
                "dwh_nullable": _nz(sh.get(row, "DWH_NULLABLE")),
                "dwh_pk_flag": _nz(sh.get(row, "DWH_PK_FLAG")),
            }
            if any(v for v in xf.values()):
                xforms.append({**xf, "lineage_id": rec["lineage_id"],
                               "data_source": ds, "dwh_target_table": tgt,
                               "dwh_target_column": col})

            lanerows.append({
                "lineage_id": rec["lineage_id"],
                "lane_id": lane or None,
                "source_system": sysname or None,
                "data_source": ds,
                "dwh_target_table": tgt,
                "dwh_target_column": col,
                "src_source_table": src_t,
                "src_file_key": _file_key(src_t) if src_t else None,
            })

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
        by_sys: dict[str, int] = {}
        for r in lanerows:
            by_sys[r["source_system"] or "(unattributed)"] = \
                by_sys.get(r["source_system"] or "(unattributed)", 0) + 1
        log.info("sei_crosswalk: lineage rows by lane: %s",
                 ", ".join(f"{k}={v}" for k, v in sorted(by_sys.items())))
        if by_sys.get("(unattributed)"):
            log.warning("%d lineage rows carry no LANE_ID and the warehouse has "
                        "more than one incumbent lane — the source-system filter "
                        "will not see them. Add LANE_ID to LANE_LINEAGE.",
                        by_sys["(unattributed)"])
        if xforms:
            eq = {}
            for r in xforms:
                k = r["transformation_equivalence"] or "(none recorded)"
                eq[k] = eq.get(k, 0) + 1
            # Count the two things separately. A row can be here for its
            # DWH_NULLABLE alone, and reporting all of them as "carry a
            # transformation" reads as full coverage when 96 of 124 have
            # no transformation recorded at all.
            withx = sum(1 for r in xforms
                        if r["legacy_transformation_id"] or r["sei_transformation_id"])
            log.info("sei_crosswalk: %d of %d lineage rows carry target metadata; "
                     "%d of those name a transformation. Equivalence: %s",
                     len(xforms), len(lin), withx,
                     ", ".join(f"{k}={v}" for k, v in sorted(eq.items())))
        return lin, cols, lanerows, xforms

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
                # The join to STAR_FIELD_USAGE. Computed here by the same
                # function that wrote NORMALIZED_KEY on the usage rows, so
                # the two sides can never be normalised by two rules.
                "contract_key": _usage_key(
                    _nz(sh.get(row, "CONTRACT_FEED", "STAR_FEED")),
                    _nz(sh.get(row, "CONTRACT_FIELD", "STAR_FIELD"))),
                "contract_field_key": _usage_field_key(
                    _nz(sh.get(row, "CONTRACT_FIELD", "STAR_FIELD"))),
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


    # ---- SEI_FEED: the outbound inventory (was parsed and thrown away) ----
    def _seifeed(self, sh):
        if not sh:
            return []
        out = []
        for row in sh.rows():
            feed = sh.get(row, "SEI_FEED")
            if not feed:
                continue
            ent = sh.get(row, "SEI_ENTITY") or feed
            out.append({
                "feed_id": f"{self.data_source}:{feed}:{ent}",
                "data_source": self.data_source,
                "sei_feed": feed, "sei_entity": ent,
                "subject_area": sh.get(row, "SUBJECT_AREA"),
                "delivery_mode": _nz(sh.get(row, "DELIVERY_MODE")),
                "frequency": _nz(sh.get(row, "FREQUENCY")),
                "grain": sh.get(row, "GRAIN"),
                "key_fields": sh.get(row, "KEY_FIELDS"),
                "load_behaviour": _nz(sh.get(row, "LOAD_BEHAVIOUR")),
                "types_published": _nz(sh.get(row, "TYPES_PUBLISHED")),
                "evidence": sh.get(row, "EVIDENCE"),
                "source_doc": sh.get(row, "SOURCE_DOC"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    # ---- SEI_INPUT_LINEAGE: what is loaded INTO SEI (inbound) ----
    def _seiinput(self, sh):
        """The inbound direction. Deliberately NOT joined into the format
        verdict: an inbound field existing does not establish that it is
        exposed through the outbound interface the contract needs. The
        workbook says so itself, and the distinction is the point."""
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            # SEI_TARGET_FIELD is what the sheet calls it. None of the five
            # names guessed here before matched, so 950 rows parsed to zero
            # and said nothing. Guessed aliases are kept behind the real one
            # for older workbooks, but the real one leads.
            fld = sh.get(row, "SEI_TARGET_FIELD", "SEI_FIELD", "SEI_INPUT_FIELD",
                         "INPUT_FIELD", "FIELD_NAME", "FIELD")
            if not fld:
                continue
            tgt = sh.get(row, "SEI_TARGET_FILE", "TARGET_FILE", "SEI_DAT_FILE",
                         "DAT_FILE", "TARGET_DAT_FILE", "SEI_FILE")
            out.append({
                "input_id": f"{self.data_source}:{tgt or 'NA'}:{fld}:{i}",
                "data_source": self.data_source,
                "direction": (sh.get(row, "DIRECTION") or "INBOUND").upper(),
                "functional_group": sh.get(row, "FUNCTIONAL_GROUP", "SUBJECT_AREA"),
                "sei_target_file": tgt,
                "sei_field_ordinal": _nz(sh.get(row, "TARGET_ORDINAL", "SEI_FIELD_ORDINAL", "ORDINAL")),
                "sei_field": fld,
                "sei_field_norm": _norm_code(fld),
                "published_type": _nz(sh.get(row, "PUBLISHED_TYPE", "SEI_TYPE")),
                "published_length": _nz(sh.get(row, "PUBLISHED_LENGTH", "SEI_LENGTH")),
                "published_scale": _nz(sh.get(row, "PUBLISHED_SCALE", "SEI_SCALE")),
                "record_scope": sh.get(row, "RECORD_SCOPE"),
                "validation_rule": sh.get(row, "VALIDATION_RULE"),
                "field_definition": sh.get(row, "FIELD_DEFINITION"),
                # NOT aliased to ACCEPTABLE_VALUES. A code-set name is an
                # identifier that joins to SEI_CODE_SET; ACCEPTABLE_VALUES
                # is free text listing the values themselves. Loading one
                # into the other gave a column that looks joinable and
                # joins to nothing — and overflowed at 177 characters,
                # which is the only reason it was noticed.
                "code_set_name": _nz(sh.get(row, "CODE_SET_NAME")),
                "acceptable_values": sh.get(row, "ACCEPTABLE_VALUES"),
                "mapping_status": _nz(sh.get(row, "MAPPING_STATUS")),
                "source_mapping_rule": sh.get(row, "MAPPING_LOGIC", "SOURCE_MAPPING_RULE"),
                "upstream_object": sh.get(row, "SOURCE_OBJECT", "UPSTREAM_SOURCE_OBJECT", "UPSTREAM_OBJECT"),
                "upstream_field": sh.get(row, "SOURCE_FIELD", "UPSTREAM_SOURCE_FIELD", "UPSTREAM_FIELD"),
                "origin_workbook": sh.get(row, "SOURCE_WORKBOOK", "ORIGINAL_WORKBOOK", "ORIGIN_WORKBOOK"),
                "origin_sheet": sh.get(row, "SOURCE_SHEET", "ORIGINAL_SHEET", "ORIGIN_SHEET"),
                "evidence": sh.get(row, "EVIDENCE"),
                "source_doc_locator": sh.get(row, "SOURCE_DOC_LOCATOR", "LOCATOR"),
            })
        return out

    # ---- SEI_CATALOG_VERIFY: does the proposed datapoint exist at all? ----
    def _seicat(self, sh):
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            dp = sh.get(row, "MAPPED_SEI_DATAPOINT", "SEI_DATAPOINT")
            fld = sh.get(row, "TARGET_STAR_FIELD", "TARGET_CONTRACT_FIELD", "TARGET_FIELD")
            if not dp and not fld:
                continue
            n = sh.get(row, "MATCH_COUNT")
            try:
                n = int(float(n))
            except (TypeError, ValueError):
                n = 0
            out.append({
                "cat_id": f"{self.data_source}:{fld or 'NA'}:{dp or 'NA'}:{i}",
                "data_source": self.data_source,
                "lane_id": (sh.get(row, "LANE_ID") or "").upper() or None,
                "target_feed": sh.get(row, "TARGET_STAR_FEED", "TARGET_CONTRACT_FEED", "TARGET_FEED"),
                "target_field": fld,
                "mapped_sei_datapoint": dp,
                "matched_file": sh.get(row, "MATCHED_FILE"),
                "matched_row": _nz(sh.get(row, "MATCHED_CATALOG_ROW", "CATALOG_ROW", "MATCHED_ROW")),
                "match_count": n,
                "published_type": _nz(sh.get(row, "PUBLISHED_TYPE")),
                "published_length": _nz(sh.get(row, "PUBLISHED_LENGTH")),
                "published_scale": _nz(sh.get(row, "PUBLISHED_SCALE")),
                "direction_note": sh.get(row, "DIRECTION_COMPATIBILITY", "DIRECTION_NOTE"),
                "verify_result": (sh.get(row, "VERIFICATION_RESULT", "VERIFY_RESULT", "RESULT")
                                  or "UNKNOWN").upper(),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    # ---- UAF_FIELD_SCHEMA: UAF has no AddVantage-style dictionary ----
    def _uafschema(self, sh):
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            fld = sh.get(row, "SOURCE_FIELD", "UAF_FIELD", "UAF_SOURCE_FIELD",
                         "FIELD_NAME", "FIELD")
            if not fld:
                continue
            feed = sh.get(row, "UAF_FEED", "FEED", "FEED_NAME", "UAF_INTERFACE")
            out.append({
                "uaf_id": f"{self.data_source}:{feed or 'NA'}:{fld}:{i}",
                "data_source": self.data_source,
                "uaf_feed": feed,
                "record_type": _nz(sh.get(row, "RECORD_TYPE")),
                "ordinal": _nz(sh.get(row, "ORDINAL")),
                "source_field": fld,
                "source_field_norm": _norm_code(fld),
                "published_type": _nz(sh.get(row, "NORMALIZED_TYPE", "PUBLISHED_DATATYPE",
                                              "PUBLISHED_TYPE", "DATATYPE")),
                "published_length": _nz(sh.get(row, "LENGTH_OR_PRECISION", "PUBLISHED_LENGTH", "LENGTH")),
                "repeating_group": _nz(sh.get(row, "REPEAT_GROUP", "REPEATING_GROUP")),
                "uaf_procedure": sh.get(row, "SOURCE_TO_STAGE", "UAF_PROCEDURE", "PROCEDURE"),
                "imds_target": sh.get(row, "DOCUMENTED_TARGET_OR_USE", "DOCUMENTED_IMDS_TARGET",
                                        "IMDS_TARGET", "TARGET_OR_USE"),
                "transformation": sh.get(row, "TRANSFORMATION_OR_RULE", "TRANSFORMATION"),
                "evidence": sh.get(row, "EVIDENCE"),
                "notes": sh.get(row, "NOTES"),
            })
        return out

    def _fill_disposition_lane(self, out):
        """Give every DISPOSITION row a DATA_SOURCE, and a LANE_ID where one
        can be established rather than guessed.

        The new workbook keys DISPOSITION on (target table, target column)
        alone. Both the purge and the undecided count scope by LANE_ID, so
        rows without one are invisible to the first and uncountable by the
        second — a silent zero, which is the failure mode this codebase has
        already hit three times.

        VERIFY carries a LANE_ID on every row for the same (table, column),
        so the lane is looked up rather than inferred. Where the column has
        no verify row the lane stays null and DATA_SOURCE alone makes the
        row findable; the count of those is logged, because a disposition
        for a column nothing verifies is itself worth knowing about."""
        lane_of = {}
        for v in out.get("verify", []):
            k = (v.get("dwh_target_table"), v.get("dwh_target_column"))
            if v.get("lane_id") and k not in lane_of:
                lane_of[k] = v["lane_id"]
        unresolved = 0
        for d in out.get("disp", []):
            d["data_source"] = self.data_source
            if not d.get("lane_id"):
                lane = lane_of.get((d.get("dwh_target_table"),
                                    d.get("dwh_target_column")))
                if lane:
                    d["lane_id"] = lane
                    d["disp_id"] = f"{lane}:{d['dwh_target_table']}:{d['dwh_target_column']}"
                else:
                    unresolved += 1
        if unresolved:
            log.warning("%d disposition rows name a column with no VERIFY row, "
                        "so no lane could be established. They are loaded and "
                        "scoped by data_source.", unresolved)

    # ------------------------------------------- the transformation layer ----
    # Everything below reads a sheet the "With-Transformations" workbook
    # added. The layer answers a question the crosswalk could not ask before:
    # not "does a SEI datapoint exist for this column" but "does it compute
    # the same value". A field whose type, length and scale all agree and
    # whose derivation differs produces a WRONG number, not a missing one,
    # and no verdict in the nine could express that.

    def _xform(self, sh):
        """TRANSFORMATION_REGISTER — one row per distinct documented
        transformation, legacy or SEI. TRANSFORMATION_LAYER is what keeps
        the two eras apart in one table; a STAR_TO_IMDS rule and the
        SEI_TO_IMDS rule proposed to replace it are otherwise duplicates."""
        if not sh:
            return []
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            tid = sh.get(row, "TRANSFORMATION_ID")
            if not tid:
                continue
            tid = str(tid).strip()
            if tid in seen:
                continue
            seen.add(tid)
            out.append({
                "transformation_id": tid,
                "data_source": self.data_source,
                "transformation_layer": _nz(sh.get(row, "TRANSFORMATION_LAYER", "LAYER")),
                "target_system": _nz(sh.get(row, "TARGET_SYSTEM")),
                "target_object": _nz(sh.get(row, "TARGET_OBJECT")),
                "target_attribute": _nz(sh.get(row, "TARGET_ATTRIBUTE")),
                "transformation_type": _nz(sh.get(row, "TRANSFORMATION_TYPE")),
                "input_objects": sh.get(row, "INPUT_OBJECTS"),
                "input_fields": sh.get(row, "INPUT_FIELDS"),
                "transformation_logic": sh.get(row, "TRANSFORMATION_LOGIC", "LOGIC"),
                "null_handling": sh.get(row, "NULL_HANDLING_OBSERVED", "NULL_HANDLING"),
                "conditional_logic": sh.get(row, "CONDITIONAL_LOGIC_OBSERVED",
                                            "CONDITIONAL_LOGIC"),
                "status": _nz(sh.get(row, "STATUS")),
                "evidence_source": sh.get(row, "EVIDENCE_SOURCE"),
                "remarks": sh.get(row, "REMARKS"),
            })
        return out

    def _xcompare(self, sh):
        """TRANSFORMATION_COMPARISON — legacy against proposed, per target
        attribute.

        EQUIVALENCE AND APPROVAL ARE KEPT APART. EXACT_TEXT is a finding
        about the logic; DRAFT_REVIEW_REQUIRED is a finding about who has
        looked at it. An exact text match nobody approved is not ready to
        ship, and collapsing the two columns would say it was."""
        if not sh:
            return []
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            obj = sh.get(row, "TARGET_OBJECT")
            att = sh.get(row, "TARGET_ATTRIBUTE")
            if not att:
                continue
            cid = sh.get(row, "COMPARISON_ID") or f"{self.data_source}:{obj or 'NA'}:{att}:{i}"
            cid = str(cid).strip()
            if cid in seen:
                cid = f"{cid}:{i}"
            seen.add(cid)
            out.append({
                "comparison_id": cid,
                "data_source": self.data_source,
                "target_system": _nz(sh.get(row, "TARGET_SYSTEM")),
                "target_object": obj,
                "target_attribute": att,
                "target_type": _nz(sh.get(row, "TARGET_TYPE")),
                "target_nullable": _nz(sh.get(row, "TARGET_NULLABLE", "NULLABLE")),
                "legacy_transformation_id": _nz(sh.get(row, "LEGACY_TRANSFORMATION_ID")),
                "sei_transformation_id": _nz(sh.get(row, "SEI_TRANSFORMATION_ID")),
                "imds_logic": sh.get(row, "IMDS_TRANSFORMATION_LOGIC", "IMDS_LOGIC"),
                "sei_logic": sh.get(row, "EQUIVALENT_SEI_TRANSFORMATION_LOGIC",
                                    "SEI_TRANSFORMATION_LOGIC", "SEI_LOGIC"),
                "sei_source_objects": sh.get(row, "SEI_SOURCE_OBJECTS"),
                "sei_source_fields": sh.get(row, "SEI_SOURCE_FIELDS"),
                "equivalence": _nz(sh.get(row, "TRANSFORMATION_EQUIVALENCE", "EQUIVALENCE")),
                "evidence_completeness": _nz(sh.get(row, "EVIDENCE_COMPLETENESS")),
                "review_note": sh.get(row, "DIFFERENCE_OR_REVIEW_NOTE", "REVIEW_NOTE"),
                "approval_status": _nz(sh.get(row, "APPROVAL_STATUS")),
                "evidence_source": sh.get(row, "EVIDENCE_SOURCE"),
            })
        return out

    def _starfld(self, sh):
        """STAR_LAYOUT_DETAIL — the published STAR field dictionary.

        THIS IS THE ARTEFACT THE EVIDENCE PANEL KEEPS ASKING FOR. Its
        contract-field row reads "0 of N from copybooks" because no STAR
        layout had been supplied and every contract-side type was inferred
        from the target column it feeds — the single assumption the whole
        format check rested on. 434 published fields replace that inference
        with a document.

        field_norm carries the same canonicalisation the crosswalk join
        uses, so a layout field can be matched to the contract field it
        describes without another normalisation rule to keep in step."""
        if not sh:
            return []
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            fld = sh.get(row, "FIELD_NAME", "STAR_FIELD", "FIELD")
            if not fld:
                continue
            fam = sh.get(row, "FEED_FAMILY", "FEED_NAME", "FEED") or "NA"
            sid = f"{self.data_source}:{_file_key(fam)}:{_norm_code(fld)}"
            if sid in seen:
                sid = f"{sid}:{i}"
            seen.add(sid)
            out.append({
                "star_field_id": sid,
                "data_source": self.data_source,
                "feed_family": fam,
                "ordinal": _nz(sh.get(row, "ORDINAL")),
                "field_name": fld,
                "field_norm": _norm_code(fld),
                "published_type": _nz(sh.get(row, "PUBLISHED_TYPE", "STAR_TYPE", "TYPE")),
                "published_length": _nz(sh.get(row, "PUBLISHED_LENGTH", "STAR_LENGTH", "LENGTH")),
                "published_format": _nz(sh.get(row, "PUBLISHED_FORMAT", "FORMAT")),
                "description": sh.get(row, "DESCRIPTION"),
                "source_document": sh.get(row, "SOURCE_DOCUMENT", "SOURCE_DOC"),
                "evidence_status": _nz(sh.get(row, "EVIDENCE_STATUS", "EVIDENCE")),
            })
        return out

    def _uploader(self, sh):
        """STAR_UPLOADER_LINEAGE — what the loader does between the file
        landing and the row appearing. Duplicate checks, header and trailer
        stripping, delete-and-reinsert: none of it is in the column
        lineage, and all of it changes what arrives."""
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            job = sh.get(row, "JOB_NAME", "JOB")
            if not job:
                continue
            out.append({
                "job_id": f"{self.data_source}:{job}:{i}",
                "data_source": self.data_source,
                "job_name": job,
                "duplicate_check": sh.get(row, "DUPLICATE_CHECK"),
                "pre_process": sh.get(row, "PRE_PROCESS"),
                "loaded_as_is": sh.get(row, "LOADED_AS_IS"),
                "imds_load_mapping": sh.get(row, "IMDS_LOAD_MAPPING"),
                "source_document": sh.get(row, "SOURCE_DOCUMENT", "SOURCE_DOC"),
                "evidence_status": _nz(sh.get(row, "EVIDENCE_STATUS", "EVIDENCE")),
            })
        return out

    def _recon(self, sh):
        """NEW_EVIDENCE_RECON — exact normalised-name matches.

        CANDIDATE EVIDENCE ONLY. A name match is the cheapest signal there
        is and the easiest to mistake for a mapping; it lands in its own
        table precisely so nothing reads it by accident as one."""
        if not sh:
            return []
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            fld = sh.get(row, "STAR_FIELD", "FIELD_NAME", "FIELD")
            if not fld:
                continue
            fam = sh.get(row, "FEED_FAMILY", "FEED_NAME") or "NA"
            rid = f"{self.data_source}:{_file_key(fam)}:{_norm_code(fld)}"
            if rid in seen:
                rid = f"{rid}:{i}"
            seen.add(rid)
            n = sh.get(row, "SEI_EXACT_NAME_MATCH_COUNT", "MATCH_COUNT")
            try:
                n = int(float(n))
            except (TypeError, ValueError):
                n = 0
            out.append({
                "recon_id": rid,
                "data_source": self.data_source,
                "feed_family": fam,
                "star_field": fld,
                "star_field_norm": _norm_code(fld),
                "star_type": _nz(sh.get(row, "STAR_TYPE", "PUBLISHED_TYPE")),
                "star_length": _nz(sh.get(row, "STAR_LENGTH", "PUBLISHED_LENGTH")),
                "match_count": n,
                "matches": sh.get(row, "SEI_EXACT_NAME_MATCHES", "MATCHES"),
                "evidence_class": _nz(sh.get(row, "EVIDENCE_CLASS")),
                "verification_result": _nz(sh.get(row, "VERIFICATION_RESULT")),
                "source_document": sh.get(row, "SOURCE_DOCUMENT", "SOURCE_DOC"),
            })
        return out

    def _enums(self, sh):
        """ENUMS — the workbook's own controlled vocabularies.

        The UI ships a glossary of nine verdicts, six map kinds and so on.
        Loading the workbook's list makes a value the workbook invented and
        the glossary has never heard of a query away, instead of an
        unexplained grey pill on screen."""
        if not sh:
            return []
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            lst = sh.get(row, "LIST_NAME", "LIST")
            val = sh.get(row, "VALUE")
            if not lst or val is None or str(val).strip() == "":
                continue
            eid = f"{self.data_source}:{lst}:{val}"
            if eid in seen:
                continue
            seen.add(eid)
            out.append({
                "enum_id": eid, "data_source": self.data_source,
                "list_name": str(lst).strip(), "value": str(val).strip(),
                "meaning": sh.get(row, "MEANING", "DESCRIPTION"),
            })
        return out

    def _lotmap(self, sh):
        """LOT_LEVEL_POSITION_MAP — the raw import behind the comparison.

        Kept as delivered rather than folded into the comparison table: its
        blank and literal "Null" cells are evidence of an absent mapping,
        and normalising them away destroys the finding."""
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            col = sh.get(row, "TARGET_COLUMN")
            if not col:
                continue
            out.append({
                "map_row_id": f"{self.data_source}:{col}:{i}",
                "data_source": self.data_source,
                "target_column": col,
                "target_type": _nz(sh.get(row, "TARGET_TYPE")),
                "nullable": _nz(sh.get(row, "NULLABLE")),
                "star_transformation": sh.get(row, "STAR_TRANSFORMATION"),
                "sei_transformation": sh.get(row, "SEI_SWP_TRANSFORMATION",
                                             "SEI_TRANSFORMATION"),
                "sei_source_object": sh.get(row, "SEI_SOURCE_OBJECT"),
                "sei_source_field": sh.get(row, "SEI_SOURCE_FIELD"),
                "remarks": sh.get(row, "REMARKS"),
                "source_document": sh.get(row, "SOURCE_DOCUMENT", "SOURCE_DOC"),
            })
        return out

    # ---- STAR field usage -------------------------------------------
    # The headers below were taken from a screenshot of the workbook, and
    # several were cut off by the column width. Every one is therefore
    # matched through a list of spellings, and _unconsumed() logs any
    # header in the sheet that no parser asked for. A column read under
    # the wrong name is bad; a column silently dropped is worse, because
    # the load succeeds and the number is just quietly missing.

    @staticmethod
    def _unconsumed(sh, role, *consumed):
        """Warn about headers this parser never asked for."""
        if not sh:
            return
        want = {_hkey(n) for n in consumed}
        extra = sorted(k for k in sh.idx if k and k not in want)
        if extra:
            log.warning("%s: sheet has column(s) nothing reads: %s. If one of "
                        "these matters, add it to the parser.", role,
                        ", ".join(extra))

    @staticmethod
    def _used_flag(status, matrix_value=None):
        """Y / N / None. None is a real answer and is kept.

        Folding an unrecognised status to "not used" would turn a workbook
        typo into ninety fields that look out of scope.
        """
        for v in (status, matrix_value):
            t = (v or "").strip().lower()
            if t in ("used", "y", "yes", "true", "1", "in use", "active"):
                return "Y"
            if t in ("unused", "n", "no", "false", "0", "not used"):
                return "N"
        return None

    def _usage(self, sh):
        """STAR_FIELD_USAGE_MATRIX -- one row per published field, used or not.

        WHAT IT IS FOR. STAR_LAYOUT_DETAIL says what a feed family
        publishes; it does not say what anybody reads. The crosswalk has
        been treating every published field as something that must be
        accounted for, so a family publishing 139 fields of which 49 are
        read shows 90 apparent gaps that nothing consumes. This is the
        column that tells those apart.

        IT DOES NOT DECIDE ANYTHING. "Unused" is a statement about today's
        consumers, not about the contract, so no verdict is changed here.
        It is recorded and shown beside the verdict; a human decides what
        it means for scope.
        """
        if not sh:
            return []
        cols = ("FEED_FAMILY", "FEED_NAME", "FEED", "FIELD_NAME", "FIELD",
                "STAR_FIELD", "USAGE_STATUS", "STATUS", "USED",
                "MATRIX_VALUE", "VALUE", "SOURCE_SHEET", "SHEET",
                "SOURCE_ROW", "ROW", "ROW_NUMBER",
                "SOURCE_DOCUMENT", "SOURCE_DOC", "DOCUMENT",
                "NORMALIZED_KEY", "NORMALISED_KEY", "NOTES", "NOTE")
        self._unconsumed(sh, "star_field_usage", *cols)
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            fld = sh.get(row, "FIELD_NAME", "FIELD", "STAR_FIELD")
            if not fld:
                continue
            fam = sh.get(row, "FEED_FAMILY", "FEED_NAME", "FEED") or "NA"
            status = sh.get(row, "USAGE_STATUS", "STATUS", "USED")
            mval = sh.get(row, "MATRIX_VALUE", "VALUE")
            uid = f"{self.data_source}:{_file_key(fam)}:{_norm_code(fld)}"
            if uid in seen:
                # The same field twice in one family is the workbook
                # disagreeing with itself. Both rows are kept -- dropping
                # the second hides it -- and the duplicate is reported.
                log.warning("star_field_usage: %s/%s appears more than once; "
                            "keeping both rows", fam, fld)
                uid = f"{uid}:{i}"
            seen.add(uid)
            out.append({
                "usage_id": uid,
                "data_source": self.data_source,
                "feed_family": fam,
                "field_name": fld,
                "field_norm": _norm_code(fld),
                "usage_status": _nz(status),
                "is_used": self._used_flag(status, mval),
                "matrix_value": _nz(mval),
                "source_sheet": sh.get(row, "SOURCE_SHEET", "SHEET"),
                "source_row": _num(sh.get(row, "SOURCE_ROW", "ROW",
                                          "ROW_NUMBER")),
                "source_document": sh.get(row, "SOURCE_DOCUMENT",
                                          "SOURCE_DOC", "DOCUMENT"),
                # The workbook's own key, stored as given. It is a
                # DIFFERENT rule from _norm_code -- FAMILY|FIELDNOSPACES
                # against ENTITY_NUMBER -- and it is the one the
                # reconciliation sheet was computed with, so it is the
                # only way to reproduce that finding here.
                # The sheet's own key where it has one, computed the same
                # way where it does not. Taking it as given keeps us
                # faithful to the reconciliation; computing the fallback
                # means a workbook without the column still joins.
                "normalized_key": (sh.get(row, "NORMALIZED_KEY",
                                          "NORMALISED_KEY")
                                   or _usage_key(fam, fld)),
                "notes": sh.get(row, "NOTES", "NOTE"),
            })
        return out

    @staticmethod
    def _used_pct(declared, used, total, fam=""):
        """used/total, and the declared cell only when that is impossible.

        DERIVED, NOT READ, because the stored percentage is ambiguous --
        see _pct. used/total is not: 3 of 42 is 7.14%, whatever Excel put
        in the cell. The declared value is still compared against it, and
        a real disagreement is logged: the two differing by more than
        rounding means the workbook contradicts itself, which is worth
        knowing and is not something to silently pick a side on.
        """
        want = _pct(declared)
        if total:
            got = round((used or 0) * 100.0 / total, 2)
            if want is not None and abs(got - want) > 0.15:
                log.warning("star_field_usage_summary[%s]: declared %s%% but "
                            "%s/%s is %s%%. Using the computed value.",
                            fam, want, used, total, got)
            return got
        # No total to divide by. 0 of 0 is not 0% -- it is unanswerable.
        if total == 0:
            return None
        return want

    def _usagesum(self, sh):
        """STAR_FIELD_USAGE_SUMMARY -- the workbook's own totals per family.

        STORED AS DECLARED, NOT RECOMPUTED. The summary carries two counts
        the matrix has no rows for -- the layout side -- and they do not
        always agree with it: one family shows 0 fields in the matrix and
        42 on the layout side, another 73 against 74. That disagreement is
        the finding, not a rounding error, which is why the workbook ships
        a reconciliation sheet as well. Recomputing these from the matrix
        would erase it.
        """
        if not sh:
            return []
        cols = ("FEED_FAMILY", "FEED_NAME", "FEED", "TOTAL_FIELDS", "TOTAL",
                "USED_FIELDS", "UNUSED_FIELDS", "USED_PERCENT", "USED_PCT",
                "PERCENT_USED", "CATALOG_LAYOUT_FIELDS", "LAYOUT_FIELDS",
                "STAR_LAYOUT_FIELDS", "PUBLISHED_FIELDS",
                "MATRIX_MATCHED_LAYOUT_FIELDS", "MATCHED_FIELDS",
                "MATRIX_UNMATCHED_LAYOUT_FIELDS", "UNMATCHED_FIELDS",
                "NOTES", "NOTE")
        self._unconsumed(sh, "star_field_usage_summary", *cols)
        out = []
        for row in sh.rows():
            fam = sh.get(row, "FEED_FAMILY", "FEED_NAME", "FEED")
            if not fam:
                continue
            out.append({
                "summary_id": f"{self.data_source}:{_file_key(fam)}",
                "data_source": self.data_source,
                "feed_family": fam,
                "total_fields": _num(sh.get(row, "TOTAL_FIELDS", "TOTAL")),
                "used_fields": _num(sh.get(row, "USED_FIELDS")),
                "unused_fields": _num(sh.get(row, "UNUSED_FIELDS")),
                "used_percent": self._used_pct(
                    sh.get(row, "USED_PERCENT", "USED_PCT", "PERCENT_USED"),
                    _num(sh.get(row, "USED_FIELDS")),
                    _num(sh.get(row, "TOTAL_FIELDS", "TOTAL")), fam),
                "catalog_layout_fields": _num(sh.get(
                    row, "CATALOG_LAYOUT_FIELDS", "LAYOUT_FIELDS",
                    "STAR_LAYOUT_FIELDS", "PUBLISHED_FIELDS")),
                "matrix_matched_layout_fields": _num(sh.get(
                    row, "MATRIX_MATCHED_LAYOUT_FIELDS", "MATCHED_FIELDS")),
                # How many published fields the usage study never reached.
                # The one number here with no equivalent anywhere else.
                "matrix_unmatched_layout_fields": _num(sh.get(
                    row, "MATRIX_UNMATCHED_LAYOUT_FIELDS", "UNMATCHED_FIELDS")),
                "notes": sh.get(row, "NOTES", "NOTE"),
            })
        return out

    def _usagerecon(self, sh):
        """STAR_FIELD_USAGE_RECON -- why the two sides disagree.

        RECON_TYPE is the workbook's own classification and is stored as
        given. Inventing our own vocabulary for somebody else's finding is
        how two systems end up describing the same row differently and
        nobody can join them again.
        """
        if not sh:
            return []
        cols = ("RECON_TYPE", "TYPE", "FEED_FAMILY", "FEED_NAME", "FEED",
                "FIELD_NAME", "FIELD", "USAGE_STATUS", "STATUS", "DETAIL",
                "DETAILS", "NOTE", "SOURCE_DOCUMENT", "SOURCE_DOC")
        self._unconsumed(sh, "star_field_usage_recon", *cols)
        out, seen = [], set()
        for i, row in enumerate(sh.rows(), 1):
            rtype = sh.get(row, "RECON_TYPE", "TYPE")
            fld = sh.get(row, "FIELD_NAME", "FIELD")
            if not rtype and not fld:
                continue
            fam = sh.get(row, "FEED_FAMILY", "FEED_NAME", "FEED") or "NA"
            rid = (f"{self.data_source}:{_file_key(rtype or 'NA')}:"
                   f"{_file_key(fam)}:{_norm_code(fld or '')}")
            if rid in seen:
                rid = f"{rid}:{i}"
            seen.add(rid)
            out.append({
                "recon_id": rid,
                "data_source": self.data_source,
                "recon_type": _nz(rtype),
                "feed_family": fam,
                "field_name": fld,
                "field_norm": _norm_code(fld or "") or None,
                "usage_status": _nz(sh.get(row, "USAGE_STATUS", "STATUS")),
                "detail": sh.get(row, "DETAIL", "DETAILS", "NOTE"),
                "source_document": sh.get(row, "SOURCE_DOCUMENT",
                                          "SOURCE_DOC"),
            })
        return out

    def _control(self, sh, sheet_label):
        """_MANIFEST, FINAL_VERIFICATION and TRANSFORMATION_SUMMARY.

        All three are (name, value, explanation) with or without a status,
        so they share one table tagged with the sheet they came from. Three
        tables of a dozen rows each would be three joins for one panel.

        `seq` preserves sheet order, which carries meaning in _MANIFEST:
        the source-document register comes before the counts, and the
        counts before the limitations."""
        if not sh:
            return []
        out = []
        for i, row in enumerate(sh.rows(), 1):
            name = sh.get(row, "CONTROL", "ITEM", "METRIC")
            if not name:
                continue
            out.append({
                "control_id": f"{self.data_source}:{sheet_label}:{i}",
                "data_source": self.data_source,
                "source_sheet": sheet_label,
                "control_name": str(name)[:400],
                "result": sh.get(row, "RESULT", "VALUE"),
                "status": _nz(sh.get(row, "STATUS")),
                "detail": sh.get(row, "DETAIL", "NOTES", "INTERPRETATION"),
                "seq": i,
            })
        return out

    # ------------------------------------------------------------- load ----
    _TARGETS = [
        ("lane",    "legacy_lane",         ("lane_id",)),
        ("feed",    "legacy_source_file",  ("src_file",)),
        ("lineage", "legacy_lineage",      ("lineage_id",)),
        ("linelane", "legacy_lineage_lane", ("lineage_id",)),
        ("srccol",  "legacy_src_column",   ("src_col_id",)),
        ("map",     "sei_source_map",      ("map_id",)),
        ("verify",  "sei_verify",          ("verify_id",)),
        ("code",    "sei_code_set",        ("code_id",)),
        ("xwalk",   "sei_identifier_xwalk", ("xwalk_id",)),
        ("disp",    "sei_disposition",     ("disp_id",)),
        ("dual",    "sei_dual_source",     ("dual_id",)),
        ("exc",     "sei_exception",       ("exc_id",)),
        ("seifeed",  "sei_feed",           ("feed_id",)),
        ("seiinput", "sei_input_lineage",  ("input_id",)),
        ("seicat",   "sei_catalog_verify", ("cat_id",)),
        ("uafschema", "uaf_field_schema",  ("uaf_id",)),
        ("linexform", "legacy_lineage_xform", ("lineage_id",)),
        ("xform",     "sei_transformation", ("transformation_id",)),
        ("xcompare",  "sei_transformation_compare", ("comparison_id",)),
        ("starfld",   "star_layout_field",  ("star_field_id",)),
        ("uploader",  "star_uploader_job",  ("job_id",)),
        ("recon",     "sei_name_recon",     ("recon_id",)),
        ("enums",     "sei_enum",           ("enum_id",)),
        ("lotmap",    "lot_level_position_map", ("map_row_id",)),
        ("control",   "sei_control",        ("control_id",)),
        ("usage",      "star_field_usage",         ("usage_id",)),
        ("usagesum",   "star_field_usage_summary", ("summary_id",)),
        ("usagerecon", "star_field_usage_recon",   ("recon_id",)),
    ]

    # legacy_lineage and legacy_source_file are SHARED with whatever loaded the
    # warehouse's baseline. They are written only in "load" mode, and purged
    # only in "load" mode. In "attach" mode this connector owns nothing in
    # them and must not touch either.
    _OWNED_IN_LOAD_MODE = ("lineage", "feed", "linelane", "linexform")

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
            rows = parsed.get(key, [])
            bad = 0
            first_err = None
            for rec in rows:
                try:
                    loader._merge(table, pk, rec)
                    n += 1
                except Exception as e:                          # noqa: BLE001
                    msg = str(e)
                    # ORA-00942 is the same answer for every row: the table is
                    # not there. Say it once and move on rather than emitting
                    # a thousand identical lines and burying the real errors.
                    if "ORA-00942" in msg:
                        log.error("%s: table does not exist — skipping all %d "
                                  "rows. Run the DDL (sql/51, 53) first.",
                                  table, len(rows))
                        bad = len(rows)
                        break
                    bad += 1
                    if first_err is None:
                        first_err = msg.splitlines()[0]
            if bad and first_err:
                log.warning("%s: %d of %d rows rejected. First: %s",
                            table, bad, len(rows), first_err)
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
        # legacy_lineage_lane is ours, but it describes legacy_lineage rows we
        # did not write when attaching, so it is skipped for the same reason.
        shared = {"legacy_lineage", "legacy_source_file", "legacy_lineage_lane",
                  "legacy_lineage_xform"}
        scoped = [
            ("sei_source_map", "data_source = :ds"),
            ("sei_verify", "data_source = :ds"),
            ("sei_disposition", "lane_id IN (SELECT lane_id FROM legacy_lane WHERE data_source = :ds)"),
            ("sei_dual_source", "data_source = :ds"),
            ("sei_exception", "data_source = :ds"),
            ("sei_feed", "data_source = :ds"),
            ("sei_input_lineage", "data_source = :ds"),
            ("sei_catalog_verify", "data_source = :ds"),
            ("uaf_field_schema", "data_source = :ds"),
            ("legacy_src_column", "data_source = :ds"),
            ("legacy_lineage", "data_source = :ds"),
            ("legacy_lineage_lane", "data_source = :ds"),
            ("legacy_lineage_xform", "data_source = :ds"),
            ("sei_transformation", "data_source = :ds"),
            ("sei_transformation_compare", "data_source = :ds"),
            ("star_layout_field", "data_source = :ds"),
            ("star_uploader_job", "data_source = :ds"),
            ("sei_name_recon", "data_source = :ds"),
            ("sei_enum", "data_source = :ds"),
            ("lot_level_position_map", "data_source = :ds"),
            ("sei_control", "data_source = :ds"),
            ("star_field_usage", "data_source = :ds"),
            ("star_field_usage_summary", "data_source = :ds"),
            ("star_field_usage_recon", "data_source = :ds"),
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
