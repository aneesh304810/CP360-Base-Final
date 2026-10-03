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
        loader.commit()
        return len(rels), len(runs)


def run(loader):
    return GuardrailsPromotionSynth().load(loader)
