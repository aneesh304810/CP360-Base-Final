"""CP Catalog ingestion orchestrator.

Runs the Excel-driven vertical slice steps. Each step is guarded (one failure
doesn't abort the rest), logged with duration, and idempotent. PII match runs LAST.
"""
from __future__ import annotations
import logging
import os
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("cp.run")

# vertical-slice step order (Excel modules + PII; harvest steps are no-ops here)
STEPS = [
    "projects",
    "oracle",          # harvest Oracle schemas (real transformation tables)
    "feed_dictionary",
    "feed_catalog",
    "loader_catalog",
    "loader_workbook",
    "dbt",             # dbt models + table lineage + compiled SQL + column lineage
    "glossary",        # business/semantic terms from dbt metrics/meta + authored
    "airflow",         # DAGs + runs + orchestration (DAG->model) edges
    "interface360",
    "api360",
    "pii_classification",
    "pii_match",
    "datapoint_index",   # reads all loaded data
    "business_flow",     # after datapoint_index (resolves Flow_Datapoint_Map vs dp_registry)
    "reference_data",    # after datapoint_index (enriches data points by category+field)
    "guardrails",        # synthetic quality guardrail events (failed jobs + bad data)
    "guardrails_promotion",  # synthetic SIT/UAT gate runs per release candidate
    "legacy_lineage",    # legacy DWH end-to-end lineage (SRC->STG1->STG2->DWH) + proof
    "legacy_dictionary", # legacy business definitions (AddVantage/CRD/STAR) keyed by field code
    "legacy_source_file",# CP_SOURCE_FILE: the business name of each AddVantage EOD feed
    "advantage_ud",            # AddVantage UD: every source in CP_ADDV_UD_DIR, in order (sql/75-77).
                               # The sub-steps advantage_ud_profile / _dictionary / _extract /
                               # _workbook / _trp run by name only, so a full run loads each once.
    "sei_crosswalk",     # IMDS/STAR/UAF/SEI crosswalk workbook — lanes, mapping, verdicts
    "sei_migration",     # Data Analysis: SEI's merged source-file catalog in CP_SEI_MIGRATION_DIR (sql/78)
    "hist_migration",    # Data Analysis: the HIST_* historical migration sheets of the same workbook (sql/86)
    "event360",          # Event 360: the SEI event specification workbook
    "sdc_compute",       # SDC client compute sizing: the read-back bill, per view
    "odi_repo",          # ODI 360: the ODI repository export in CP_ODI_DIR as tables — scenarios, tasks, variables, edges; sql/83
    "scd2_review",       # ODI 360: the reviewed SCD2 workbook (CP_SCD2_REVIEW_XLSX) -> sign-offs; sql/82
    "scd2",              # ODI 360: SCD2 rule cards from the ODI export in CP_ODI_DIR (+ warehouse profile with CP_SCD2_WITH_DB=1); sql/81
    "event_subscription",# who consumes which event, from CSV — BBH's own decision
    "hub_corpus",        # Hub Discussion: the 108 review questions + drafted answers
    "search_index",      # MUST be last - indexes everything for full-text search
]


def _thick_if_asked():
    """python-oracledb picks its mode at the FIRST connection and cannot
    change it afterwards (DPY-2019). The hub connection below is that first
    connection, so a step that later needs thick mode — scd2 profiling a
    warehouse whose listener demands Native Network Encryption — would be
    refused. If the operator asked for thick mode, start it here, once,
    for every connection in this run; the hub is fine in either mode."""
    want = (os.environ.get("PBDW_THICK", "").strip().lower() in ("1", "true", "yes")
            or os.environ.get("ORACLE_CLIENT_LIB") or os.environ.get("CP_ORACLE_CLIENT_DIR"))
    if not want:
        return
    import oracledb
    if not oracledb.is_thin_mode():
        return
    lib = os.environ.get("ORACLE_CLIENT_LIB") or os.environ.get("CP_ORACLE_CLIENT_DIR") or None
    try:
        oracledb.init_oracle_client(lib_dir=lib) if lib else oracledb.init_oracle_client()
        log.info("oracledb thick mode on (client: %s)", lib or "PATH")
    except Exception as e:  # noqa: BLE001 - the hub may still work thin; the step that needs thick says so
        log.warning("oracledb thick mode requested but not started: %s", str(e).splitlines()[0])


def _connect():
    import oracledb
    _thick_if_asked()
    dsn = os.environ["CP_CATALOG_DB_DSN"]
    # accept oracle://user:pass@host:port/service
    if dsn.startswith("oracle://"):
        rest = dsn[len("oracle://"):]
        creds, hostpart = rest.split("@", 1)
        user, pwd = creds.split(":", 1)
        return oracledb.connect(user=user, password=pwd, dsn=hostpart)
    return oracledb.connect(dsn=dsn)


def run(steps=None) -> None:
    steps = steps or STEPS
    conn = _connect()
    from .loader import Loader
    from .project_resolver import ProjectResolver
    loader = Loader(conn)
    resolver = ProjectResolver.from_env()

    for step in steps:
        t0 = time.time()
        try:
            _run_step(step, conn, loader, resolver)
            log.info("[%s] OK in %.2fs", step, time.time() - t0)
        except Exception as e:  # guarded: continue with remaining steps
            log.exception("[%s] FAILED: %s", step, e)
    conn.close()
    log.info("ingestion complete")


def _require_env(*names) -> bool:
    """Return True if all named env vars are set; else log a skip and return False."""
    import os
    missing = [n for n in names if not os.getenv(n)]
    if missing:
        log.info("  skipping (not configured): missing %s", ", ".join(missing))
        return False
    return True


def _run_step(step, conn, loader, resolver) -> None:
    if step == "hub_corpus":
        # No env var: the corpus is committed at data/hub_corpus.json,
        # regenerated by ui/scripts/export_hub_corpus.mjs. HUB_CORPUS_PATH
        # overrides it only if you are loading a copy from elsewhere.
        #
        # Safe on every run: it refreshes a row ONLY WHILE IT IS PRISTINE,
        # so an edited question or an accepted answer is left alone.
        from .hub_corpus_conn import (read_corpus, load as load_corpus,
                                       preflight, DEFAULT_FILE)
        path = os.getenv("HUB_CORPUS_PATH") or DEFAULT_FILE
        if not os.path.exists(path):
            log.info("  skipping (not generated): %s", path)
            return
        # ORA-00942 out of a MERGE names no table and arrives a long way
        # from the cause. Say which object is absent and which script
        # creates it, then skip like any unconfigured step.
        problems = preflight(conn)
        if problems:
            for pr in problems:
                log.warning("  MISSING  %s", pr)
            log.info("  skipping (schema not ready) — "
                     "python -m ingestion.hub_corpus_conn --check")
            return
        counts = load_corpus(conn, read_corpus(path), check=False)
        log.info("  %s", ", ".join(f"{k} {v}" for k, v in counts.items()))
        return

    if step == "projects":
        # registry seeded by sql/12_projects.sql; nothing to do at runtime
        return
    if step == "feed_dictionary":
        if not _require_env("DATA360_FEED_DICTIONARY_PATH"):
            return
        from .feed_dictionary_conn import FeedDictionaryConnector
        from .feed_dictionary_loader import FeedDictionaryLoader
        c = FeedDictionaryConnector.from_env()
        FeedDictionaryLoader(loader).load(c.parse())
        return
    if step == "interface360":
        if not _require_env("INTERFACE360_XLSX_PATH"):
            return
        from .interface360_conn import Interface360Connector
        from .interface360_loader import Interface360Loader
        c = Interface360Connector.from_env()
        Interface360Loader(loader, resolver).load(c.parse())
        return
    if step == "api360":
        if not _require_env("CP_CATALOG_ROOT"):
            return
        from .api360_conn import Api360Connector
        c = Api360Connector.from_env()
        c.load(loader, c.parse())
        return
    if step == "pii_classification":
        if not _require_env("PII_ATTRIBUTES_PATH"):
            return
        from .pii_classification_conn import PiiClassificationConnector
        from .pii_classification_loader import PiiClassificationLoader
        c = PiiClassificationConnector.from_env()
        PiiClassificationLoader(loader).load(c.parse())
        return
    if step == "oracle":
        if not _require_env("ORACLE_PROD_DSN", "ORACLE_PROD_SCHEMAS"):
            return
        from .oracle_conn import OracleConnector
        c = OracleConnector.from_env()
        c.load(loader, c.parse())
        return
    if step == "dbt":
        if not _require_env("DBT_MANIFEST_PATH"):
            return
        from .dbt_conn import DbtConnector
        from .lineage_sqlglot import load_column_lineage
        c = DbtConnector.from_env()
        bundle = c.parse()
        c.load(loader, bundle)
        # column-level lineage + transform expressions from compiled SQL
        load_column_lineage(loader, bundle["transforms"],
                            dialect=os.getenv("DBT_DIALECT", "oracle"))
        return
    if step == "glossary":
        if not _require_env("DBT_MANIFEST_PATH"):
            return
        from .glossary_conn import GlossaryConnector
        c = GlossaryConnector.from_env()
        c.load(loader, c.parse())
        return
    if step == "feed_catalog":
        from .feed_catalog_conn import FeedCatalogConnector
        for direction in ("inbound", "outbound"):
            c = FeedCatalogConnector.from_env(direction, resolver)
            if c:
                c.load(loader, c.parse())
        return
    if step == "loader_workbook":
        from .loader_workbook_conn import LoaderWorkbookConnector
        c = LoaderWorkbookConnector.from_env(resolver)
        if c:
            c.load(loader, c.parse())
        return
    if step == "loader_catalog":
        from .loader_catalog_conn import LoaderCatalogConnector
        c = LoaderCatalogConnector.from_env(resolver)
        if c:
            c.load(loader, c.parse())
        return
    if step == "airflow":
        if not _require_env("AIRFLOW_DSN"):
            return
        from .airflow_conn import AirflowConnector
        c = AirflowConnector.from_env()
        c.load(loader, c.parse())
        return
    if step == "reference_data":
        from .reference_data_conn import ReferenceDataConnector
        ReferenceDataConnector().load(loader)
        return
    if step == "business_flow":
        from .business_flow_conn import BusinessFlowConnector
        BusinessFlowConnector().load(loader)
        return
    if step == "search_index":
        from .search_index_builder import SearchIndexBuilder
        SearchIndexBuilder().load(loader)
        return
    if step == "guardrails":
        from .guardrails_synth import GuardrailsSynth
        n = GuardrailsSynth().load(loader)
        log.info("guardrails: merged %s events", n)

    if step == "guardrails_promotion":
        from .guardrails_promotion_synth import GuardrailsPromotionSynth
        nr, ng, nd, nc = GuardrailsPromotionSynth().load(loader)
        log.info("guardrails_promotion: merged %s releases, %s gate runs, "
                 "%s deployments, %s changeset applications", nr, ng, nd, nc)
        return
    if step == "legacy_lineage":
        from .legacy_lineage_conn import LegacyLineageConnector
        c = LegacyLineageConnector.from_env()
        c.load(loader, c.parse())
        return
    if step == "event360":
        from .event360_conn import Event360Connector
        c = Event360Connector.from_env()
        n = c.load(loader, c.parse())
        log.info("event360: merged %s rows", n)
        return
    if step == "event_subscription":
        from .event_subscription_conn import EventSubscriptionConnector
        c = EventSubscriptionConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("event_subscription: merged %s rows", n)
        return
    if step == "odi_repo":
        from .odi_repo_conn import OdiRepoConnector
        c = OdiRepoConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("odi_repo: merged %s rows", n)
        return
    if step == "scd2":
        from .scd2_conn import Scd2Connector
        c = Scd2Connector.from_env()
        n = c.load(loader, c.parse())
        log.info("scd2: merged %s rows", n)
        return
    if step == "scd2_review":
        from .scd2_review_conn import Scd2ReviewConnector
        c = Scd2ReviewConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("scd2_review: merged %s sign-offs", n)
        return
    if step == "sdc_compute":
        from .sdc_compute_conn import SdcComputeConnector
        c = SdcComputeConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("sdc_compute: merged %s rows", n)
        return
    if step == "sei_crosswalk":
        from .lane_lineage_conn import SeiCrosswalkConnector
        c = SeiCrosswalkConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("sei_crosswalk: merged %s rows", n)
        # The same workbook carries the HIST_* historical migration sheets
        # (sql/86); load them in the same run so one step keeps both current.
        # CP_HIST_WITH_CROSSWALK=0 keeps them to their own step, hist_migration
        # (local/load-hist.ps1), when the 214k-row evidence load should not
        # ride every crosswalk run.
        if os.environ.get("CP_HIST_WITH_CROSSWALK", "1").strip() in ("0", "false", "no"):
            log.info("hist_migration: skipped here (CP_HIST_WITH_CROSSWALK=0); run the hist_migration step")
            return
        from .hist_migration_conn import HistMigrationConnector
        h = HistMigrationConnector.from_env()
        hb = h.parse()
        if hb["files"]:
            m = h.load(loader, hb)
            log.info("hist_migration: %s rows from the HIST_* sheets of %s", m, hb["source_file"])
        else:
            log.info("hist_migration: no HIST_* sheets in %s; nothing to load", h.where)
        return
    if step == "sei_migration":
        from .sei_migration_conn import SeiMigrationConnector
        c = SeiMigrationConnector.from_env()
        b = c.parse()
        if not b["fields"]:
            log.warning("sei_migration: nothing to load from %s (set CP_SEI_MIGRATION_DIR); skipped", c.folder)
            return
        for sh in b["sheets"]:
            log.info("sei_migration: %s / %s: %s rows", sh["workbook"], sh["sheet"], sh["rows"])
        n = c.load(loader, b)
        log.info("sei_migration: merged %s fields", n)
        return
    if step == "hist_migration":
        from .hist_migration_conn import HistMigrationConnector
        c = HistMigrationConnector.from_env()
        b = c.parse()
        if not b["files"]:
            log.warning("hist_migration: no HIST_* sheets in %s (set CP_SEI_XLSX or CP_HIST_MIGRATION_XLSX); skipped", c.where)
            return
        for ck in b["checks"]:
            if ck["level"] != "Pass":
                log.warning("hist_migration: %s %s: %s", ck["rule"], ck["level"], ck["detail"])
        n = c.load(loader, b)                         # the parse logged each sheet; load prints the bar and the timing
        log.info("hist_migration: %s rows loaded", n)
        return
    if step == "legacy_source_file":
        from .legacy_source_file_conn import LegacySourceFileConnector
        c = LegacySourceFileConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("legacy_source_file: merged %s feeds", n)
        return
    if step == "advantage_ud":
        # One folder, every source, in dependency order. Discovery first,
        # so the inventory says what was found before anything is written;
        # then each sub-step, stopping at the first failure, because a
        # half-run that reports success is how a screen under-reports.
        from .advantage_ud_paths import resolve, describe
        r = resolve()
        log.info("advantage_ud: sources\n%s", describe(r))
        if not any((r["extract"], r["workbook"], r["trp"], r["profile"])):
            # A machine without the drop is the normal case for a full run;
            # a warning says so, a failure would read as a broken step.
            log.warning("advantage_ud: nothing recognised in %s (set CP_ADDV_UD_DIR); skipped", r["dir"])
            return
        try:
            from tools.advantage_ud_discovery import inventory
            out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "docs", "advantage_ud", "source_inventory.md")
            with open(out, "w", encoding="utf-8") as fh:
                fh.write(inventory(r["dir"]))
            log.info("advantage_ud: inventory written to %s", out)
        except Exception as e:                       # noqa: BLE001 - discovery is help, not a gate
            log.warning("advantage_ud: inventory not written (%s)", e)
        order = [("advantage_ud_profile", bool(r["profile_dir"])), ("advantage_ud_lineage", bool(r["profile_dir"])),
                 ("advantage_ud_dictionary", bool(r["codes"])),
                 ("advantage_ud_extract", bool(r["extract"])), ("advantage_ud_workbook", bool(r["workbook"])),
                 ("advantage_ud_trp", bool(r["trp"]))]
        for sub, have in order:
            if not have:
                log.warning("advantage_ud: %s skipped, its source is not in the folder", sub)
                continue
            log.info("advantage_ud: >>> %s", sub)
            _run_step(sub, conn, loader, resolver)
        return
    if step == "advantage_ud_lineage":
        from .advantage_ud_lineage_conn import AdvantageUdLineageConnector, DWH_TABLE, CLOB
        cur = conn.cursor()
        try:
            cur.execute("SELECT attribute_name, key_structure, sequence_number FROM cp_advantage_ud_registry")
            reg = [{"attribute_name": a, "key_structure": k, "sequence_number": q} for a, k, q in cur.fetchall()]
            cur.execute("SELECT dwh_target_table, dwh_target_column, lineage_id FROM legacy_lineage "
                        "WHERE is_ud = 'Y' AND dwh_target_table = :t", {"t": DWH_TABLE})
            existing = {(t, c): i for t, c, i in cur.fetchall()}
            cur.execute("SELECT functional_group FROM legacy_lineage WHERE dwh_target_table = :t "
                        "AND dwh_target_column = :c AND ROWNUM = 1", {"t": DWH_TABLE, "c": CLOB})
            row = cur.fetchone()
            template = {"functional_group": row[0]} if row else {}
        finally:
            cur.close()
        c = AdvantageUdLineageConnector(reg, existing, template)
        n = c.load(loader, c.parse())
        log.info("advantage_ud_lineage: merged %s per-key lineage rows", n)
        return
    if step == "advantage_ud_extract":
        from .advantage_ud_extract_conn import AdvantageUdExtractConnector
        c = AdvantageUdExtractConnector.from_env()
        cur = conn.cursor()
        try:
            cur.execute("SELECT attribute_name FROM cp_advantage_ud_registry")
            c.known_attributes = {r[0] for r in cur.fetchall()}
            cur.execute("SELECT schema_signature FROM cp_advantage_ud_schema")
            c.known_schemas = {r[0] for r in cur.fetchall()}
        except Exception as e:                       # noqa: BLE001 - tables not there yet
            log.warning("advantage_ud_extract: registry not readable (%s); everything will count as new", e)
        finally:
            cur.close()
        log.info("advantage_ud_extract: %s", c.load(loader))
        return
    if step == "advantage_ud_workbook":
        from .advantage_ud_workbook_conn import AdvantageUdWorkbookConnector
        c = AdvantageUdWorkbookConnector.from_env()
        cur = conn.cursor()
        try:
            cur.execute("SELECT attribute_name, code_value FROM cp_advantage_ud_dictionary WHERE source = 'OBSERVED'")
            obs = {}
            for a, code in cur.fetchall():
                obs.setdefault(a, set()).add(code)
            c.observed = obs
        except Exception as e:                       # noqa: BLE001
            log.warning("advantage_ud_workbook: no observed codes (%s); links cannot be inferred", e)
        finally:
            cur.close()
        n = c.load(loader, c.parse())
        log.info("advantage_ud_workbook: merged %s rows", n)
        return
    if step == "advantage_ud_trp":
        from .advantage_ud_trp_conn import AdvantageUdTrpConnector
        cur = conn.cursor()
        def lookup(acct, _cur=cur):
            _cur.execute("SELECT attribute_name, raw_value FROM cp_advantage_ud_attribute "
                         "WHERE account_number = :a", {"a": acct})
            rows = _cur.fetchall()
            return {a: v for a, v in rows} if rows else None
        try:
            cur.execute("SELECT attribute_name FROM cp_advantage_ud_registry")
            keys = {r[0] for r in cur.fetchall()}
        except Exception:                            # noqa: BLE001
            keys = set()
        c = AdvantageUdTrpConnector.from_env(lookup, keys)
        n = c.load(loader, c.parse())
        cur.close()
        log.info("advantage_ud_trp: %s attributes reconciled", n)
        return
    if step == "advantage_ud_profile":
        from .advantage_ud_profile_conn import AdvantageUdProfileConnector
        c = AdvantageUdProfileConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("advantage_ud_profile: merged %s rows", n)
        return
    if step == "advantage_ud_dictionary":
        from .advantage_ud_dictionary_conn import AdvantageUdDictionaryConnector
        c = AdvantageUdDictionaryConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("advantage_ud_dictionary: merged %s code values", n)
        return
    if step == "legacy_dictionary":
        from .legacy_dictionary_conn import LegacyDictionaryConnector
        c = LegacyDictionaryConnector.from_env()
        c.load(loader, c.parse())
        return
    if step == "datapoint_index":
        from .datapoint_indexer import DatapointIndexer
        idx = DatapointIndexer(conn)
        idx.load(loader, idx.run())
        return
    if step == "pii_match":
        from .pii_matcher import PiiMatcher
        PiiMatcher(loader, conn).run()
        return
    log.warning("unknown step: %s", step)


if __name__ == "__main__":
    # `python -m ingestion.run legacy_source_file` — run named steps only.
    #
    # README_FINAL.md and LOCAL_SETUP.md have documented this since before I
    # touched anything ("python -m ingestion.run feed_catalog loader_catalog
    # datapoint_index"), but run() ignored sys.argv and always ran every step,
    # so the documented command silently did something much larger.
    #
    # It matters for more than tidiness: loading one new source should not
    # require re-running every connector, and re-running them is not free —
    # the legacy_lineage step rewrites lineage rows.
    import sys
    _args = [a for a in sys.argv[1:] if not a.startswith("-")]
    _bad = [a for a in _args if a not in STEPS]
    if _bad:
        log.error("unknown step(s): %s", ", ".join(_bad))
        log.error("known steps: %s", ", ".join(STEPS))
        raise SystemExit(2)
    run(_args or None)
