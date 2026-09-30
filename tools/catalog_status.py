"""Row counts per feature, straight after a load.

    python tools/catalog_status.py            # everything
    python tools/catalog_status.py --gaps     # only the lines that need action

WHY THIS IS A FILE AND NOT A HERE-STRING. load-all.ps1 used to carry the
probe inline as a PowerShell here-string, and it could not work: the
terminator has to sit at column 0, every line's leading space survives
into the Python, and one stray indent is an IndentationError before a
single row is counted. It also parsed the DSN by splitting on "/" first,
which finds the slash in "oracle://" and hands Oracle a username of
"oracle:". A load would finish correctly and the status block under it
would print "could not connect", which reads as a failed load.

WHAT IT IS FOR. A zero here is not an error — plenty of these are
features nobody has loaded yet. It is for the other case: you ran the
load, it said OK, and you want to know whether anything actually arrived.
So a missing table prints "not created" rather than an exception, and
the gap lines at the end are the only ones that mean somebody has work
to do.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The one parser the API itself uses, rather than a second one that
# disagrees with it about what a DSN looks like.
from api.app.db import _parse_dsn                              # noqa: E402

# (label, sql). Grouped the way the sidebar is, so a reader can tell which
# screen a zero explains.
COUNTS = [
    ("-- Catalog", None),
    ("Data 360: feeds (feed_catalog)", "feed_catalog"),
    ("Data 360: feed fields (columns)", "columns"),
    ("Data 360: loaders rich (ldr_catalog)", "ldr_catalog"),
    ("Data 360: loaders simple", "loader_catalog"),
    ("Data 360: datasets", "datasets"),
    ("API 360: endpoints (Swagger)", "api_endpoints"),
    ("API 360: endpoint fields", "api_fields"),
    ("API 360: business flows (bf)", "bf_api_flows"),
    ("Interface 360 (bf)", "bf_interfaces"),
    ("Datapoint 360: data points", "dp_registry"),
    ("Datapoint 360: reference rows", "reference_data"),
    ("Pipelines (bf)", "bf_pipelines"),
    ("Compression marts", "bf_compression_plan"),
    ("Search index documents", "search_index"),

    ("-- Lineage", None),
    ("Legacy lineage rows", "legacy_lineage"),
    ("Legacy lineage lanes", "legacy_lineage_lane"),
    ("Legacy dictionary (field definitions)", "legacy_dictionary"),
    ("Legacy source files (feed names)", "legacy_source_file"),
    ("Column lineage edges", "column_lineage"),
    # Added with the Business view: what each warehouse TABLE is, in
    # business words. Zero here is why that view shows physical names.
    ("Business catalog (table names)", "business_catalog"),

    ("-- SEI crosswalk", None),
    ("SEI source map", "sei_source_map"),
    ("SEI verify (column verdicts)", "sei_verify"),
    ("SEI transformations", "sei_transformation"),
    ("SEI dispositions", "sei_disposition"),
    ("SEI exceptions", "sei_exception"),

    ("-- Events", None),
    ("Event definitions", "meta_event_definition"),
    ("Event fields", "meta_event_field"),
    ("Micro-batch markers", "ref_micro_batch_marker"),
    ("Event consumers", "ref_event_consumer"),
    ("Event subscriptions", "ctl_event_subscription"),
    ("SDC compute (views)", "meta_sdc_compute_view"),

    ("-- Governance", None),
    ("PII classifications", "pii_classifications"),
    ("Guardrail events", "guardrail_events"),
    ("Variance runs", "recon_runs"),

    ("-- Security (sql/64)", None),
    ("Users known to CP 360", "sec_user"),
    ("Grantable modules", "sec_module"),
    ("Module grants", "sec_grant"),
]

GAPS = [
    ("unresolved flow datapoints",
     "SELECT COUNT(*) FROM bf_flow_datapoint_map WHERE resolved='N'"),
    ("unresolved reference fields",
     "SELECT COUNT(*) FROM reference_data WHERE resolved='N'"),
    ("pipelines with no linked API flow",
     "SELECT COUNT(*) FROM bf_pipelines WHERE linked_api_flow_id IS NULL"),
    ("warehouse tables with no business name",
     "SELECT COUNT(*) FROM business_catalog WHERE business_name IS NULL"),
    ("SEI columns still undecided",
     "SELECT COUNT(*) FROM sei_disposition WHERE decision IS NULL"),
    ("active CP 360 administrators (0 locks the entitlement screen)",
     "SELECT COUNT(*) FROM sec_user WHERE is_admin='Y' AND status='ACTIVE'"),
]

W = 46


def connect():
    dsn = os.environ.get("CP_CATALOG_DB_DSN")
    if not dsn:
        print("  CP_CATALOG_DB_DSN is not set — nothing to connect to.")
        return None
    import oracledb
    user, pwd, host = _parse_dsn(dsn)
    try:
        return oracledb.connect(user=user, password=pwd, dsn=host)
    except Exception as e:                                    # noqa: BLE001
        # Never print the DSN back: it carries the password.
        print(f"  could not connect to Oracle: {str(e)[:120]}")
        return None


def main():
    only_gaps = "--gaps" in sys.argv
    conn = connect()
    if conn is None:
        return 1
    cur = conn.cursor()

    def one(sql):
        try:
            cur.execute(sql)
            return cur.fetchone()[0], None
        except Exception as e:                                # noqa: BLE001
            msg = str(e)
            return None, ("not created" if "ORA-00942" in msg
                          else msg.split("\n")[0][:46])

    if not only_gaps:
        for label, table in COUNTS:
            if table is None:
                print(f"\n{label}")
                continue
            n, err = one(f"SELECT COUNT(*) FROM {table}")
            print(f"  {label:<{W}} {n if err is None else '(' + err + ')'}")

    print("\n-- Gaps (these are the ones that mean work)")
    for label, sql in GAPS:
        n, err = one(sql)
        print(f"  {label:<{W}} {n if err is None else '(' + err + ')'}")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
