"""Helpers the source-first and graph routers need, preferring the ones that
already exist in routers_legacy_lineage.

Why this file exists. The graph and source routers originally imported four
helpers straight from routers_legacy_lineage so that canonicalisation,
warehouse scoping and master resolution stayed defined in exactly one place.
That is still the goal — but routers_legacy_lineage is a file under active
edit on several machines, and the four helpers arrived at different times:

    _safe                 always present
    _norm_code            present since the dictionary join
    _ds_scoped            added with sql/29 (data_source / PBDW + IMDS)
    _master_from_context  added with per-master definition resolution

A checkout missing either of the last two raised ImportError, main.py's
guarded loop logged it, and BOTH new routers silently did not mount:

    WARNING cp.api could not mount routers_legacy_graph:
            cannot import name '_ds_scoped' from 'app.routers_legacy_lineage'

So: import what is there, define what is not. The fallbacks below are
byte-equivalent to the originals, and the moment the real ones land the
imports win and these are dead code. This is a compatibility shim, not a
second implementation — do not add behaviour here that the originals lack.
"""
from __future__ import annotations
import logging
import re as _re

log = logging.getLogger("cp.api.legacy_compat")

# _safe is in every version of the module.
from .routers_legacy_lineage import _safe  # noqa: F401

_MISSING: list[str] = []

# ---------------------------------------------------------------- canon ----
try:
    from .routers_legacy_lineage import _norm_code
except ImportError:                                            # pragma: no cover
    _MISSING.append("_norm_code")

    def _norm_code(code: str) -> str:
        """BI/2-1 -> BI_2_1 ; ST.SEC.01 -> ST_SEC_01 ; BI_2_L1 -> BI_2_1, so
        both sides of the dictionary join meet."""
        if not code:
            return ""
        c = _re.sub(r"[\s/.\-]+", "_", str(code).strip())
        c = _re.sub(r"_{2,}", "_", c).strip("_").upper()
        return _re.sub(r"_L(\d+)", r"_\1", c)

# ------------------------------------------------- target-warehouse scope ---
try:
    from .routers_legacy_lineage import _ds_scoped
except ImportError:                                            # pragma: no cover
    _MISSING.append("_ds_scoped")

    def _ds_scoped(sql_tpl: str, params: dict, data_source: str | None):
        """sql_tpl contains {DS}; replaced by an AND-filter when scoping.
        Graceful degrade: on a pre-29 database the scoped query fails, _safe
        returns [], and we retry unscoped so the endpoint still answers."""
        if data_source:
            rows = _safe(sql_tpl.replace("{DS}", " AND data_source = :ds "),
                         {**params, "ds": data_source.upper()})
            if rows:
                return rows
        return _safe(sql_tpl.replace("{DS}", " "), params)

# ------------------------------------------------------ master resolution ---
try:
    from .routers_legacy_lineage import _master_from_context
except ImportError:                                            # pragma: no cover
    _MISSING.append("_master_from_context")

    # Field identity in AddVantage is (master + code) — the same code (BI/2-1)
    # is defined per master. The SOURCE context encodes which: feed files
    # (Addv-MSTR-ACC/MAC/IPN/SEC/BEN/COF-SB...) and STG1 tables
    # (STG1_FIS_MASTER_ACCOUNT_EOD etc.). Order matters: MAC before ACC.
    _MASTER_HINTS = [
        (_re.compile(r"MSTR[-_]MAC|FIS_MASTER_ACCOUNT|MASTER[-_ ]?ACCOUNT", _re.I),
         "Master Account Master"),
        (_re.compile(r"MSTR[-_]IPN|FIS_INTERESTED_PARTY|INTERESTED[-_ ]?PARTY", _re.I),
         "Interested Party Master"),
        (_re.compile(r"MSTR[-_]SEC|FIS_SECURITY|SECURITY", _re.I),
         "Security Issue Master"),
        (_re.compile(r"MSTR[-_]BEN|BENEFICIARY", _re.I), "Beneficiary Submaster"),
        (_re.compile(r"MSTR[-_]COF|CO[-_ ]?FID", _re.I), "Co-fiduciary Submaster"),
        (_re.compile(r"MSTR[-_]ACC|FIS_ACCOUNT|\bACCOUNT\b", _re.I), "Account Master"),
    ]

    def _master_from_context(*ctx):
        for c in ctx:
            if not c:
                continue
            for rx, master in _MASTER_HINTS:
                if rx.search(str(c)):
                    return master
        return None

if _MISSING:
    log.info("legacy_compat: routers_legacy_lineage is missing %s — using the "
             "built-in fallbacks. Update that module and they stop being used.",
             ", ".join(_MISSING))

__all__ = ["_safe", "_ds_scoped", "_norm_code", "_master_from_context"]


# ------------------------------------------------------- mapped predicate ---
# The loaders disagree about how they spell "this field has an agreed target".
# The rich sheet writes 'Exists', the 4-column loader writes 'mapped', and a
# live extract was observed carrying neither — which made every coverage figure
# on the source-first screens read 0 of N mapped, 0%, "not started", on data
# that is in fact largely mapped.
#
# So do not test for a literal. Classify in three steps:
#
#   1. a status in _MAPPED_WORDS          -> mapped
#   2. a status in _UNMAPPED_WORDS        -> not mapped
#   3. anything else (incl. NULL)         -> mapped iff a dwh target exists
#
# Step 3 is the point: an unrecognised vocabulary degrades to the structural
# truth (the row names a warehouse column, so the field lands somewhere)
# instead of degrading to zero. Add new spellings to the word lists as they
# turn up; the fallback means a missed one is not a visible regression.
#
# Call GET /legacy-lineage/status-values to see the real vocabulary of a given
# database and how each value classifies here.

_MAPPED_WORDS = (
    "mapped", "exists", "exist", "match", "matched", "matches",
    "complete", "completed", "done", "verified", "confirmed", "approved",
    "migrated", "in scope", "active", "ok", "y", "yes", "true", "1",
)

_UNMAPPED_WORDS = (
    "unmapped", "not mapped", "notmapped", "no match", "nomatch",
    "missing", "gap", "none", "n/a", "na", "not applicable",
    "tbd", "to be decided", "pending", "open", "new", "not started",
    "not required", "out of scope", "excluded", "exclude",
    "dropped", "drop", "deprecated", "retired",
    "n", "no", "false", "0",
)


def _sql_list(words) -> str:
    return ", ".join("'" + w.replace("'", "''") + "'" for w in words)


# Drop-in for the old  LOWER(lineage_status) IN ('mapped','exists').
# Self-contained: binds nothing, so it can be interpolated into any query that
# selects from legacy_lineage.
_MAPPED_SQL = (
    "(LOWER(TRIM(lineage_status)) IN (" + _sql_list(_MAPPED_WORDS) + ")"
    " OR (dwh_target_column IS NOT NULL"
    " AND NVL(LOWER(TRIM(lineage_status)), '~') NOT IN ("
    + _sql_list(_UNMAPPED_WORDS) + ")))"
)


def _is_mapped(status, has_target: bool = False) -> bool:
    """Python mirror of _MAPPED_SQL — same three steps, same answer."""
    s = str(status or "").strip().lower()
    if s in _MAPPED_WORDS:
        return True
    if s in _UNMAPPED_WORDS:
        return False
    return bool(has_target)


__all__ += ["_MAPPED_SQL", "_is_mapped", "_MAPPED_WORDS", "_UNMAPPED_WORDS"]
