"""Guardrails synthetic event generator.

Produces representative guardrail_events tied to real pipelines so the Quality
Guardrails screen has a working failure -> root-cause -> bad-data drill-down.
Data is synthetic by design (no live GE/Soda/Airflow/dbt hookup yet); the shape
matches what those engines emit so a real connector can replace this later.

Usage from run.py:  GuardrailsSynth().load(loader)
"""
from __future__ import annotations
import json
import datetime as _dt


def build_events():
    now = _dt.datetime.utcnow()

    def ts(mins):
        return (now - _dt.timedelta(minutes=mins)).strftime("%Y-%m-%d %H:%M:%S")

    return [
        {
            "event_id": "ge-001", "engine": "great_expectations",
            "event_type": "validation", "status": "failed", "severity": "critical",
            "pipeline_id": "Cash", "dag_id": "swp_cash_processing",
            "task_id": "ge_validate_gld_cash", "dataset_key": "imdw.gld_cash_summary",
            "model_key": "oracle.imdw.gld_cash_summary", "column_name": "cash_balance_usd",
            "rule_name": "expect_column_values_to_not_be_null",
            "expectation": "cash_balance_usd NOT NULL",
            "observed_value": "3 nulls in 15,204 rows", "threshold": "0 nulls allowed",
            "bad_row_count": 3, "total_row_count": 15204,
            "message": "cash_balance_usd contains NULLs after the FX enrichment join.",
            "root_cause": "The upstream FX rate feed was missing rates for 3 accounts "
                          "with an exotic currency (XPF). The Silver FX join produced NULL "
                          "cash_balance_usd for those rows, which propagated to Gold.",
            "bad_data_sample": json.dumps([
                {"account_number": "ACC-88213", "currency": "XPF", "cash_balance_local": 412000.0, "fx_rate": None, "cash_balance_usd": None},
                {"account_number": "ACC-90017", "currency": "XPF", "cash_balance_local": 88000.0, "fx_rate": None, "cash_balance_usd": None},
                {"account_number": "ACC-90455", "currency": "XPF", "cash_balance_local": 1200.0, "fx_rate": None, "cash_balance_usd": None},
            ]),
            "upstream_source": "sei_int_fx_rates (SILVER)", "run_id": "cash-20260704-01",
            "run_ts": ts(22), "project_id": "cp",
        },
        {
            "event_id": "soda-001", "engine": "soda",
            "event_type": "freshness", "status": "failed", "severity": "high",
            "pipeline_id": "Positions", "dag_id": "swp_positions_processing",
            "task_id": "soda_scan_positions", "dataset_key": "imdw.gld_position_sum",
            "model_key": "oracle.imdw.gld_position_sum", "column_name": "as_of_date",
            "rule_name": "freshness(as_of_date) < 26h",
            "expectation": "max(as_of_date) within 26 hours",
            "observed_value": "38h stale", "threshold": "26h",
            "bad_row_count": 0, "total_row_count": 210544,
            "message": "Positions gold table is 38 hours stale — EOD feed did not arrive.",
            "root_cause": "The SEI positions EOD file for the prior business day never "
                          "landed in the SFTP inbound folder, so the sensor timed out and "
                          "the table was not refreshed.",
            "bad_data_sample": json.dumps([
                {"expected_file": "POSITIONS_EOD_20260703.csv", "status": "MISSING", "sftp_folder": "/inbound/sei/positions"},
            ]),
            "upstream_source": "SFTP /inbound/sei/positions", "run_id": "pos-20260704-01",
            "run_ts": ts(65), "project_id": "cp",
        },
        {
            "event_id": "dbt-001", "engine": "dbt",
            "event_type": "test", "status": "failed", "severity": "high",
            "pipeline_id": "Account", "dag_id": "swp_account_processing",
            "task_id": "dbt_test", "dataset_key": "pbdw.dim_account",
            "model_key": "oracle.pbdw.dim_account", "column_name": "account_number",
            "rule_name": "unique(account_number)",
            "expectation": "account_number is unique",
            "observed_value": "12 duplicate account_numbers", "threshold": "0 duplicates",
            "bad_row_count": 12, "total_row_count": 48210,
            "message": "Duplicate account_number values in dim_account.",
            "root_cause": "The account characteristics feed delivered the same account twice "
                          "with different service tiers after a mid-day amendment; the "
                          "dedupe key did not include the amendment sequence.",
            "bad_data_sample": json.dumps([
                {"account_number": "ACC-71120", "service_tier": "PRIORITY", "amend_seq": 1},
                {"account_number": "ACC-71120", "service_tier": "STANDARD", "amend_seq": 2},
            ]),
            "upstream_source": "sei_pl_account_and_client_characteristics",
            "run_id": "acct-20260704-01", "run_ts": ts(140), "project_id": "cp",
        },
        {
            "event_id": "af-001", "engine": "airflow",
            "event_type": "dag_run", "status": "failed", "severity": "critical",
            "pipeline_id": "Fee", "dag_id": "swp_fee_accrual",
            "task_id": "sftp_to_billing", "dataset_key": "loader.fee_accrual",
            "model_key": None, "column_name": None,
            "rule_name": "task sftp_to_billing",
            "expectation": "task succeeds", "observed_value": "failed (exit 1)",
            "threshold": "0 failures", "bad_row_count": 0, "total_row_count": 0,
            "message": "Fee accrual loader failed to deliver to the billing SFTP endpoint.",
            "root_cause": "The billing SFTP host rotated its key; the connection was "
                          "refused with a host-key mismatch. No fee file was delivered.",
            "bad_data_sample": json.dumps([
                {"host": "billing-sftp.bbh.internal", "error": "host key verification failed"},
            ]),
            "upstream_source": "Airflow connection billing_sftp", "run_id": "fee-20260704-01",
            "run_ts": ts(200), "project_id": "cp",
        },
        {
            "event_id": "ge-002", "engine": "great_expectations",
            "event_type": "validation", "status": "failed", "severity": "medium",
            "pipeline_id": "Corporate Actions", "dag_id": "swp_corporate_actions",
            "task_id": "ge_validate_ca", "dataset_key": "imdw.int_corporate_actions",
            "model_key": "oracle.imdw.int_corporate_actions", "column_name": "action_type",
            "rule_name": "expect_column_values_to_be_in_set",
            "expectation": "action_type in (DIVIDEND, SPLIT, MERGER, RIGHTS, SPINOFF)",
            "observed_value": "5 rows with action_type='REORG'", "threshold": "0 unexpected",
            "bad_row_count": 5, "total_row_count": 3120,
            "message": "Unmapped corporate action type 'REORG'.",
            "root_cause": "SEI introduced a new action_type 'REORG' not yet in the accepted "
                          "set / mapping table; rows were flagged for review.",
            "bad_data_sample": json.dumps([
                {"asset_id": "US4581401001", "action_type": "REORG", "ex_date": "2026-07-02"},
                {"asset_id": "US0378331005", "action_type": "REORG", "ex_date": "2026-07-03"},
            ]),
            "upstream_source": "sei_stg_corporate_actions", "run_id": "ca-20260704-01",
            "run_ts": ts(260), "project_id": "cp",
        },
        {
            "event_id": "soda-002", "engine": "soda",
            "event_type": "anomaly", "status": "failed", "severity": "high",
            "pipeline_id": "Fee", "dag_id": "swp_fee_accrual",
            "task_id": "soda_scan_fee", "dataset_key": "imdw.gld_fee_accrual",
            "model_key": "oracle.imdw.gld_fee_accrual", "column_name": "accrued_fee_usd",
            "rule_name": "anomaly_detection(sum accrued_fee_usd)",
            "expectation": "daily total within 3σ of trailing 30d",
            "observed_value": "+412% vs baseline", "threshold": "±3σ",
            "bad_row_count": 47, "total_row_count": 8900,
            "message": "Fee accrual total spiked 412% above the 30-day baseline.",
            "root_cause": "A fee schedule was loaded with basis points expressed as a "
                          "percentage (e.g. 0.75 entered as 75), inflating 47 accounts' fees.",
            "bad_data_sample": json.dumps([
                {"account_number": "ACC-33021", "fee_schedule_id": "FS-2211", "rate_entered": 75.0, "expected_rate": 0.75, "accrued_fee_usd": 56250.0},
                {"account_number": "ACC-33044", "fee_schedule_id": "FS-2211", "rate_entered": 75.0, "expected_rate": 0.75, "accrued_fee_usd": 41200.0},
            ]),
            "upstream_source": "sei_pl_fee_schedule", "run_id": "fee-20260704-02",
            "run_ts": ts(310), "project_id": "cp",
        },
        {
            "event_id": "dbt-002", "engine": "dbt",
            "event_type": "test", "status": "warning", "severity": "medium",
            "pipeline_id": "Positions", "dag_id": "swp_positions_processing",
            "task_id": "dbt_test", "dataset_key": "imdw.int_positions_enriched",
            "model_key": "oracle.imdw.int_positions_enriched", "column_name": "market_value_usd",
            "rule_name": "relationships(account_number -> dim_account)",
            "expectation": "every account_number exists in dim_account",
            "observed_value": "8 orphan account_numbers", "threshold": "0 orphans (warn)",
            "bad_row_count": 8, "total_row_count": 210544,
            "message": "8 positions reference accounts not yet in dim_account.",
            "root_cause": "Positions feed arrived before the account feed for 8 newly "
                          "onboarded accounts — a load-ordering race, not bad data.",
            "bad_data_sample": json.dumps([
                {"account_number": "ACC-99001", "position_id": "P-5521", "market_value_usd": 12000.0},
                {"account_number": "ACC-99002", "position_id": "P-5522", "market_value_usd": 8400.0},
            ]),
            "upstream_source": "sei_pl_positions_daily", "run_id": "pos-20260704-02",
            "run_ts": ts(360), "project_id": "cp",
        },
    ]


class GuardrailsSynth:
    """Ingestion step wrapper — merges synthetic guardrail_events."""

    def load(self, loader, _bundle=None):
        rows = build_events()
        for r in rows:
            loader._merge("guardrail_events", ("event_id",), r)
        loader.commit()
        return len(rows)


def run(loader):
    return GuardrailsSynth().load(loader)
