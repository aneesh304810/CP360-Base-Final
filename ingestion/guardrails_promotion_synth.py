"""Promotion-plane synthetic data — releases and the gates each region runs.

Companion to guardrails_synth.py, which covers the RUNTIME plane. The two
are deliberately separate because the grains are: a gate run belongs to a
commit, a guardrail event belongs to a run on a business date. See the
header of sql/67_guardrail_promotion.sql.

SYNTHETIC BY DESIGN, like its companion. There is no Jenkins hookup yet.
The shape matches what a Jenkins pipeline publishes -- stage, gate, status,
blocking, observed vs threshold, a log URL -- so an ingester reading real
build data can replace this module without the API or the screen changing.
The screen says so on its face; a promotion board that looks live when it
is not is the one failure nobody catches.

Usage from run.py:  GuardrailsPromotionSynth().load(loader)
"""
from __future__ import annotations
import json
import datetime as _dt

# The gate catalogue, per region. SIT runs on every push; UAT runs on
# promotion. Performance appears in BOTH, at different depths: the checks
# that need no data volume are cheap enough for every push, and the ones
# that need realistic volumes can only run where realistic volumes exist.
SIT_GATES = [
    ("governance",  1, "schema_validation",      "Schema validation", "Y"),
    ("governance",  1, "naming_conventions",     "Naming conventions", "Y"),
    ("governance",  1, "lineage_checks",         "Lineage checks", "Y"),
    ("governance",  1, "orphan_model_detection", "Orphan model detection", "N"),
    ("performance", 2, "explain_plan",           "EXPLAIN PLAN per model", "Y"),
    ("performance", 2, "partition_pruning",      "Partition pruning verified", "Y"),
    ("testing",     3, "dbt_tests",              "dbt tests (unique / not-null)", "Y"),
    ("testing",     3, "business_rule_tests",    "Business rule tests", "Y"),
    ("testing",     3, "integration_seed_gold",  "Integration: seed to gold", "Y"),
    ("testing",     3, "regression_baseline",    "Regression vs baseline", "Y"),
    ("security",    4, "secrets_detection",      "Secrets detection", "Y"),
    ("security",    4, "cve_scanning",           "CVE scanning (dependencies)", "Y"),
    ("security",    4, "sql_injection_checks",   "SQL injection checks", "Y"),
    ("security",    4, "container_image_scan",   "Container image scan", "Y"),
]

UAT_GATES = [
    ("performance", 2, "sla_volume",        "SLA at 10K-5M rows", "Y"),
    ("performance", 2, "scd2_merge_cost",   "SCD2 merge cost check", "Y"),
    ("performance", 2, "concurrency_soak",  "Concurrency soak (8 parallel DAGs)", "N"),
    ("testing",     3, "uat_business_pack", "UAT business test pack", "Y"),
    ("testing",     3, "recon_vs_legacy",   "Reconciliation vs legacy output", "Y"),
    ("promotion",   5, "arb_sign_off",      "Architecture Review Board sign-off", "Y"),
]


def _ts(base, mins):
    return (base - _dt.timedelta(minutes=mins)).strftime("%Y-%m-%d %H:%M:%S")


def build_releases(now=None):
    now = now or _dt.datetime.utcnow()

    rel = [
        {
            "release_id": "REL-2026.09.28", "title": "Fee accrual: add tax-lot basis",
            "branch": "feature/fee-taxlot-basis", "commit_sha": "9c41ab7",
            "pr_number": "412", "build_number": "1184", "author": "a.nair",
            "current_region": "PROD", "status": "released",
            "models_changed": 6,
            "datasets": "gld_fee_accrual, slv_fee_lines, dim_taxlot",
            "opened_at": _ts(now, 7 * 24 * 60), "project_id": "cp",
        },
        {
            "release_id": "REL-2026.10.01", "title": "Positions: SCD2 on account attributes",
            "branch": "feature/positions-scd2", "commit_sha": "4f2a9c1",
            "pr_number": "418", "build_number": "1201", "author": "j.tandel",
            "current_region": "UAT", "status": "blocked",
            "models_changed": 11,
            "datasets": "gld_positions, slv_positions, dim_account",
            "opened_at": _ts(now, 3 * 24 * 60), "project_id": "cp",
        },
        {
            "release_id": "REL-2026.10.02", "title": "Corporate actions: new event types",
            "branch": "feature/ca-event-types", "commit_sha": "e77d530",
            "pr_number": "421", "build_number": "1208", "author": "s.mehta",
            "current_region": "SIT", "status": "blocked",
            "models_changed": 4,
            "datasets": "slv_corporate_actions, gld_ca_instructions",
            "opened_at": _ts(now, 26 * 60), "project_id": "cp",
        },
        {
            "release_id": "REL-2026.10.03", "title": "Cash: FX fallback for exotic currencies",
            "branch": "feature/cash-fx-fallback", "commit_sha": "b1904ee",
            "pr_number": "423", "build_number": "1211", "author": "a.nair",
            "current_region": "SIT", "status": "in_flight",
            "models_changed": 3, "datasets": "slv_cash, gld_cash_summary",
            "opened_at": _ts(now, 95), "project_id": "cp",
        },
    ]
    return rel


# Per release: which gates deviate from "passed". Everything unlisted in a
# region the release has reached is a pass; everything in a region it has
# not reached is not_run. Written this way round because the interesting
# rows are the handful that failed, and listing 20 passes per release would
# bury them in the source as surely as on a screen.
_OVERRIDES = {
    "REL-2026.10.02": {
        "region": "SIT",
        "gates": {
            "cve_scanning": {
                "status": "failed", "severity": "critical",
                "observed_value": "1 critical CVE in oracledb 2.1.2",
                "threshold": "0 critical",
                "message": "CVE-2026-21714 (critical) in a transitive dependency.",
                "root_cause": "oracledb 2.1.2 pulls cryptography 41.0.3, which carries a "
                              "critical advisory. Pinned by the base image, not by this "
                              "change -- the scan is new, the exposure is not.",
                "evidence": json.dumps({"cve": "CVE-2026-21714", "severity": "CRITICAL",
                                        "package": "cryptography", "installed": "41.0.3",
                                        "fixed_in": "42.0.4",
                                        "path": "oracledb 2.1.2 -> cryptography"}),
            },
            "explain_plan": {
                "status": "warning", "severity": "medium", "blocking": "N",
                "observed_value": "full table scan on slv_corporate_actions",
                "threshold": "index or partition access",
                "message": "One model plans a full scan; under the SIT row count it is "
                           "faster than the index, so this is a warning here and a real "
                           "question at UAT volumes.",
                "root_cause": "The new event-type predicate is not covered by any index. "
                              "At 4,000 SIT rows the optimiser is right to scan.",
            },
        },
    },
    "REL-2026.10.01": {
        "region": "UAT",
        "sit_all_pass": True,
        "gates": {
            "sla_volume": {
                "status": "failed", "severity": "high",
                "observed_value": "1,284s at 4.2M rows",
                "threshold": "<= 900s at 5M rows",
                "message": "The positions SCD2 merge misses its SLA by 43% at UAT volume.",
                "root_cause": "The SCD2 merge compares all 11 changed attributes per row "
                              "with no hash column, so every row is a full column-by-column "
                              "comparison. SIT's 20K rows hid it; 4.2M rows did not.",
                "evidence": json.dumps({"rows": 4200000, "elapsed_s": 1284,
                                        "sla_s": 900, "stage": "slv -> gld merge",
                                        "plan": "HASH JOIN OUTER, 11 predicate columns"}),
            },
            "scd2_merge_cost": {
                "status": "warning", "severity": "medium", "blocking": "N",
                "observed_value": "2.1x baseline buffer gets",
                "threshold": "<= 1.5x baseline",
                "message": "Merge cost is above baseline, consistent with the SLA breach.",
                "root_cause": "Same root cause as the SLA gate: no change-hash column.",
            },
            "arb_sign_off": {"status": "not_run", "severity": "low",
                             "message": "Held: a blocking gate ahead of it has not passed."},
            "recon_vs_legacy": {"status": "not_run", "severity": "low",
                                "message": "Held behind the performance gate."},
            "uat_business_pack": {
                "status": "passed", "severity": "low",
                "observed_value": "214 of 214 cases", "threshold": "100%",
                "message": "The business pack passes; it is performance that is blocking."},
        },
    },
    "REL-2026.10.03": {
        "region": "SIT",
        "gates": {
            "dbt_tests": {"status": "running", "severity": "low",
                          "message": "In progress."},
            "business_rule_tests": {"status": "not_run", "severity": "low",
                                    "message": "Queued behind dbt tests."},
            "integration_seed_gold": {"status": "not_run", "severity": "low",
                                      "message": "Queued."},
            "regression_baseline": {"status": "not_run", "severity": "low",
                                    "message": "Queued."},
            "secrets_detection": {"status": "not_run", "severity": "low", "message": "Queued."},
            "cve_scanning": {"status": "not_run", "severity": "low", "message": "Queued."},
            "sql_injection_checks": {"status": "not_run", "severity": "low", "message": "Queued."},
            "container_image_scan": {"status": "not_run", "severity": "low", "message": "Queued."},
        },
    },
    "REL-2026.09.28": {"region": "PROD", "sit_all_pass": True, "uat_all_pass": True,
                       "gates": {}},
}

_REACHED = {"SIT": ["SIT"], "UAT": ["SIT", "UAT"], "PROD": ["SIT", "UAT"]}


def build_gate_runs(releases, now=None):
    now = now or _dt.datetime.utcnow()
    out = []
    for r in releases:
        rid = r["release_id"]
        ov = _OVERRIDES.get(rid, {})
        gates = ov.get("gates", {})
        reached = _REACHED.get(r["current_region"], ["SIT"])
        for region, catalogue in (("SIT", SIT_GATES), ("UAT", UAT_GATES)):
            for stage, order, key, name, blocking in catalogue:
                g = dict(gates.get(key) or {})
                if region not in reached:
                    g.setdefault("status", "not_run")
                    g.setdefault("message", f"{region} has not been reached yet.")
                g.setdefault("status", "passed")
                out.append({
                    "gate_run_id": f"{rid}:{region}:{key}",
                    "release_id": rid, "region": region,
                    "stage": stage, "stage_order": order,
                    "gate_key": key, "gate_name": name,
                    "status": g["status"],
                    "severity": g.get("severity", "low"),
                    "blocking": g.get("blocking", blocking),
                    "expectation": g.get("expectation"),
                    "observed_value": g.get("observed_value"),
                    "threshold": g.get("threshold"),
                    "message": g.get("message"),
                    "root_cause": g.get("root_cause"),
                    "evidence": g.get("evidence"),
                    "log_url": (f"https://jenkins.internal/job/cp-airflow-agent/"
                                f"{r['build_number']}/{region.lower()}/{key}"),
                    "started_at": _ts(now, 180), "finished_at": _ts(now, 150),
                    "duration_ms": g.get("duration_ms", 42000),
                    "run_id": f"{r['build_number']}-{region.lower()}",
                    "project_id": "cp",
                })
    return out


class GuardrailsPromotionSynth:
    """Ingestion step wrapper — merges releases and their gate runs."""

    def load(self, loader, _bundle=None):
        rels = build_releases()
        for r in rels:
            loader._merge("guardrail_release", ("release_id",), r)
        runs = build_gate_runs(rels)
        for g in runs:
            loader._merge("guardrail_gate_run", ("gate_run_id",), g)
        deps = build_deployments()
        for d in deps:
            loader._merge("guardrail_deployment", ("deployment_id",), d)
        for c in build_changesets():
            loader._merge("guardrail_changeset", ("changeset_id",), c)
        applied = build_changeset_applied()
        for a in applied:
            loader._merge("guardrail_changeset_applied",
                          ("changeset_id", "environment"), a)
        loader.commit()
        return len(rels), len(runs), len(deps), len(applied)


def run(loader):
    return GuardrailsPromotionSynth().load(loader)


# ---------------------------------------------------------------- deploys
# WHAT IS RUNNING WHERE, which guardrail_release cannot say: its
# current_region is a release's furthest point, and an environment's
# contents are a different fact. See sql/68's header.
#
# The fixture is shaped to show the three things a release dashboard
# exists to surface:
#
#   1. PROD is a release behind.  App 1184 live while SIT and UAT are on
#      1201 — normal, and invisible on any screen that only tracks where
#      the newest release has got to.
#   2. The newest build is NOT deployed.  1208 is blocked in SIT on a CVE
#      and 1211 is still running, so SIT is running 1201. A dashboard
#      reading "latest release" would name a build nobody can use.
#   3. The two lanes diverge ON PURPOSE.  SIT's schema is at sit-1212
#      while its application is at 1201: an additive column deployed a
#      release early, which is exactly what expand-and-contract asks for
#      and reads as drift on any screen that collapses the lanes.
DEPLOYMENTS = [
    # --- PROD ---------------------------------------------------------
    {"deployment_id": "DEP-PROD-app-1184", "environment": "PROD", "lane": "app",
     "release_id": "REL-2026.09.28", "build_number": "1184",
     "app_tag": "v2026.09.28", "commit_sha": "9c41ab7", "db_tag": None,
     "changesets": None, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 412, "notes": "Fee accrual: add tax-lot basis"},
    {"deployment_id": "DEP-PROD-db-1184", "environment": "PROD", "lane": "schema",
     "release_id": "REL-2026.09.28", "build_number": "1184",
     "app_tag": None, "commit_sha": "c1d44f0", "db_tag": "prod-1184",
     "changesets": 61, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 96, "notes": "3 changesets applied"},

    # --- UAT (QC) -----------------------------------------------------
    {"deployment_id": "DEP-UAT-app-1201", "environment": "UAT", "lane": "app",
     "release_id": "REL-2026.10.01", "build_number": "1201",
     "app_tag": "v2026.10.01", "commit_sha": "4f2a9c1", "db_tag": None,
     "changesets": None, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 455, "notes": "Positions: SCD2 — gates failing, not promoted"},
    {"deployment_id": "DEP-UAT-db-1201", "environment": "UAT", "lane": "schema",
     "release_id": "REL-2026.10.01", "build_number": "1201",
     "app_tag": None, "commit_sha": "77ba901", "db_tag": "uat-1201",
     "changesets": 66, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 134, "notes": "5 changesets applied"},
    {"deployment_id": "DEP-UAT-app-1184", "environment": "UAT", "lane": "app",
     "release_id": "REL-2026.09.28", "build_number": "1184",
     "app_tag": "v2026.09.28", "commit_sha": "9c41ab7", "db_tag": None,
     "changesets": None, "status": "superseded", "deployed_by": "jenkins",
     "duration_s": 430, "notes": "Superseded by 1201"},

    # --- SIT ----------------------------------------------------------
    {"deployment_id": "DEP-SIT-app-1201", "environment": "SIT", "lane": "app",
     "release_id": "REL-2026.10.01", "build_number": "1201",
     "app_tag": "v2026.10.01", "commit_sha": "4f2a9c1", "db_tag": None,
     "changesets": None, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 388, "notes": "Positions: SCD2 on account attributes"},
    {"deployment_id": "DEP-SIT-db-1212", "environment": "SIT", "lane": "schema",
     "release_id": None, "build_number": "1212",
     "app_tag": None, "commit_sha": "3ae0c88", "db_tag": "sit-1212",
     "changesets": 68, "status": "deployed", "deployed_by": "jenkins",
     "duration_s": 88,
     "notes": "Expand step: nullable column added a release early"},
    {"deployment_id": "DEP-SIT-app-1184", "environment": "SIT", "lane": "app",
     "release_id": "REL-2026.09.28", "build_number": "1184",
     "app_tag": "v2026.09.28", "commit_sha": "9c41ab7", "db_tag": None,
     "changesets": None, "status": "superseded", "deployed_by": "jenkins",
     "duration_s": 401, "notes": "Superseded by 1201"},
]

# Minutes before "now" each deployment happened, newest last per lane so
# the latest-wins query has something real to order by.
_DEP_AGE = {
    "DEP-SIT-app-1184": 7 * 24 * 60, "DEP-UAT-app-1184": 7 * 24 * 60 - 60,
    "DEP-PROD-app-1184": 7 * 24 * 60 - 180, "DEP-PROD-db-1184": 7 * 24 * 60 - 200,
    "DEP-SIT-app-1201": 3 * 24 * 60, "DEP-UAT-app-1201": 3 * 24 * 60 - 90,
    "DEP-UAT-db-1201": 3 * 24 * 60 - 110, "DEP-SIT-db-1212": 40,
}


def build_deployments(now=None):
    now = now or _dt.datetime.utcnow()
    out = []
    for d in DEPLOYMENTS:
        out.append({**d, "project_id": "cp",
                    "deployed_at": _ts(now, _DEP_AGE.get(d["deployment_id"], 60))})
    return out


# ------------------------------------------------------------ changesets
# The changelog, and which environment has applied what. Shaped so a
# PROD -> UAT comparison surfaces the two changesets that would actually
# stop a promotion, rather than reporting "5 changesets" and leaving the
# reader to open Liquibase.
#
#   61 baseline      applied everywhere, the history before this window
#   + 5 in UAT       the positions release — including one back-fill with
#                    no rollback block and one DROP COLUMN whose rollback
#                    recreates the column and not the data
#   + 2 more in SIT  the expand step, additive and safe
_BASELINE = 61

# author, file, description, type, rollback_declared, data_safe, release, build
_UAT_AHEAD = [
    ("j.tandel", "2026.10.01-positions.sql", "Add CHANGE_HASH to SLV_POSITIONS",
     "ddl_add", "Y", "Y", "REL-2026.10.01", "1201"),
    ("j.tandel", "2026.10.01-positions.sql", "Index SLV_POSITIONS(CHANGE_HASH) ONLINE",
     "index", "Y", "Y", "REL-2026.10.01", "1201"),
    ("j.tandel", "2026.10.01-positions.sql", "Add VALID_FROM / VALID_TO to GLD_POSITIONS",
     "ddl_add", "Y", "Y", "REL-2026.10.01", "1201"),
    # No rollback block: an UPDATE cannot be auto-reversed, and nobody
    # wrote one. Reversible only by restoring from backup.
    ("j.tandel", "2026.10.01-positions.sql", "Back-fill CHANGE_HASH for 4.2M rows",
     "dml", "N", "N", "REL-2026.10.01", "1201"),
    # Rollback declared AND not data-safe: Liquibase will recreate the
    # column; what was in it is gone. The pair of flags exists for this.
    ("j.tandel", "2026.10.01-positions.sql", "Drop GLD_POSITIONS.LEGACY_SCD_FLAG",
     "ddl_drop", "Y", "N", "REL-2026.10.01", "1201"),
]
_SIT_AHEAD = [
    ("s.mehta", "2026.10.02-ca-events.sql", "Add EVENT_TYPE_CODE to SLV_CORPORATE_ACTIONS",
     "ddl_add", "Y", "Y", None, "1212"),
    ("a.nair", "2026.10.03-cash-fx.sql", "Add FX_FALLBACK_CCY to SLV_CASH",
     "ddl_add", "Y", "Y", None, "1212"),
]


def build_changesets():
    rows, pos = [], 0
    for i in range(1, _BASELINE + 1):
        pos += 1
        rows.append({
            "changeset_id": f"bbh:baseline.sql::{i:03d}", "author": "bbh",
            "filename": "baseline.sql",
            "description": f"Baseline changeset {i:03d}",
            "change_type": "other", "rollback_declared": "Y", "data_safe": "Y",
            "release_id": None, "build_number": None, "labels": None,
            "contexts": None, "position_order": pos, "project_id": "cp"})
    for group in (_UAT_AHEAD, _SIT_AHEAD):
        for n, (au, fn, desc, ct, rb, ds, rel, bld) in enumerate(group, 1):
            pos += 1
            rows.append({
                "changeset_id": f"{au}:{fn}::{n}", "author": au, "filename": fn,
                "description": desc, "change_type": ct,
                "rollback_declared": rb, "data_safe": ds, "release_id": rel,
                "build_number": bld, "labels": None, "contexts": None,
                "position_order": pos, "project_id": "cp"})
    return rows


def build_changeset_applied(now=None):
    now = now or _dt.datetime.utcnow()
    cs = build_changesets()
    base = [c for c in cs if c["filename"] == "baseline.sql"]
    uat = [c for c in cs if c["build_number"] == "1201"]
    sit = [c for c in cs if c["build_number"] == "1212"]
    out = []

    def add(group, env, tag, age):
        for c in group:
            out.append({"changeset_id": c["changeset_id"], "environment": env,
                        "tag": tag, "applied_at": _ts(now, age),
                        "exec_type": "EXECUTED",
                        "checksum": f"9:{abs(hash(c['changeset_id'])) % 10**12:012d}"})

    # The baseline is everywhere; the release window is not.
    add(base, "PROD", "prod-1184", 7 * 24 * 60 - 200)
    add(base, "UAT", "uat-1201", 7 * 24 * 60 - 150)
    add(base, "SIT", "sit-1212", 7 * 24 * 60 - 100)
    add(uat, "UAT", "uat-1201", 3 * 24 * 60 - 110)
    add(uat, "SIT", "sit-1212", 3 * 24 * 60 - 200)
    add(sit, "SIT", "sit-1212", 40)
    return out
