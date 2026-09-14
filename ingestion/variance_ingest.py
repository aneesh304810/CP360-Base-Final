"""
variance_ingest.py — plain ingestion-framework hook for Variance 360.
No Airflow. Callable from any Python loader, shell step, Jenkins stage,
or cron entry. Same convention as the other ingestion/ scripts.

Three ways to use it
--------------------
1) One-shot after the nightly load (simplest — one line in the load script):

     python -m ingestion.variance_ingest full --data-source PBDW

   Opens a run, profiles every mapped stage table, summarizes, closes.

2) Interleaved with the load (cache-warm, fastest): the loader calls
   table_loaded() right after it finishes writing each stage table, then
   finish() once at the end:

     from ingestion.variance_ingest import open_run, table_loaded, finish
     run_id = open_run("PBDW")
     ...load STG1_POSITIONS...
     table_loaded(run_id, "PBDW", "STG1", "STG1_POSITIONS")   # seconds, warm
     ...load remaining tables, calling table_loaded after each...
     finish(run_id, "PBDW")                                    # summarize

3) Composition (type inference) on its own cadence — weekly cron:

     python -m ingestion.variance_ingest composition --data-source PBDW

The UI stays read-only against recon_* in every mode — it can never block.
"""
from __future__ import annotations

import argparse
import datetime as dt
import logging
import sys
from collections import defaultdict

from ingestion.variance_engine import (          # noqa: E402
    _catalog, _source_conn, _qual, _metric_exprs, _dclass_from_inferred,
    _summarize, load_chains, run_profile, _BATCH,
)

log = logging.getLogger("cp.variance.ingest")


# ---------------------------------------------------------------------------
# mode 2: interleaved with the loader
# ---------------------------------------------------------------------------
def open_run(data_source: str, run_id: str | None = None) -> str:
    run_id = run_id or f"ING{dt.datetime.now():%Y%m%d_%H%M%S}"
    conn = _catalog()
    cur = conn.cursor()
    cur.execute("""INSERT INTO recon_runs
        (run_id, data_source, run_type, scope, status, step)
        VALUES (:1, :2, 'STAGE', 'INGESTION', 'RUNNING', 'load in progress')""",
        [run_id, data_source])
    conn.commit()
    return run_id


def table_loaded(run_id: str, data_source: str, stage: str, table: str):
    """Profile ONE just-written stage table (blocks warm in cache).
    Call immediately after the loader commits that table."""
    cconn = _catalog()
    ccur = cconn.cursor()
    chains = load_chains(ccur, data_source, None)
    pairs = [(ch, ch[stage][1]) for ch in chains
             if (ch[stage][0] or "").upper() == table.upper() and ch[stage][1]]
    if not pairs:
        log.info("no mapped columns for %s %s — skipped", stage, table)
        return
    sconn, own = _source_conn(data_source)
    scur = sconn.cursor()
    qtab = _qual(data_source, stage, table)
    ccur.execute("""UPDATE recon_runs SET step = :s WHERE run_id = :r""",
                 {"s": f"metrics: {stage} {table}", "r": run_id})
    cconn.commit()
    for b in range(0, len(pairs), _BATCH):
        batch = pairs[b:b + _BATCH]
        items, manifest = [], []
        for ch, col in batch:
            for m, expr in _metric_exprs(col, _dclass_from_inferred("STRING")):
                alias = f"M{len(manifest)}"
                items.append(f"{expr} AS {alias}")
                manifest.append((ch, col, m))
        try:
            scur.execute("SELECT " + ", ".join(items) + f" FROM {qtab}")
            row = scur.fetchone()
        except Exception as e:                                 # noqa: BLE001
            log.warning("metrics failed %s: %s", qtab, str(e)[:160])
            continue
        for (ch, col, m), val in zip(manifest, row):
            vnum = val if isinstance(val, (int, float)) else None
            vstr = None if vnum is not None else (
                str(val)[:200] if val is not None else None)
            ccur.execute("""INSERT INTO recon_profile
                (run_id, data_source, lineage_id, stage, table_name,
                 column_name, metric, value_num, value_str)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9)""",
                [run_id, data_source, ch["lineage_id"], stage, table,
                 col, m, vnum, vstr])
        cconn.commit()
    if own:
        sconn.close()


def finish(run_id: str, data_source: str):
    """First-break analysis -> recon_summary; close the run. Seconds."""
    cconn = _catalog()
    ccur = cconn.cursor()
    chains = load_chains(ccur, data_source, None)
    _summarize(ccur, cconn, run_id, data_source, chains)
    ccur.execute("""UPDATE recon_runs SET status = 'COMPLETE',
                    finished_at = SYSTIMESTAMP, step = 'done'
                    WHERE run_id = :r""", {"r": run_id})
    cconn.commit()
    log.info("variance run %s complete", run_id)


def fail(run_id: str, error: str):
    conn = _catalog()
    cur = conn.cursor()
    cur.execute("""UPDATE recon_runs SET status = 'FAILED',
                   error_text = :e, finished_at = SYSTIMESTAMP
                   WHERE run_id = :r""", {"e": error[:1900], "r": run_id})
    conn.commit()


# ---------------------------------------------------------------------------
# CLI (modes 1 and 3, plus manual summarize)
# ---------------------------------------------------------------------------
def main(argv=None):
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(prog="variance_ingest")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("full", "stage", "composition"):
        p = sub.add_parser(name)
        p.add_argument("--data-source", default="PBDW")
        p.add_argument("--table", default=None)
        p.add_argument("--sample-rows", type=int, default=0)
    p = sub.add_parser("summarize")
    p.add_argument("--data-source", default="PBDW")
    p.add_argument("--run-id", required=True)
    args = ap.parse_args(argv)

    if args.cmd == "summarize":
        finish(args.run_id, args.data_source)
        return 0

    analysis = {"full": "BOTH", "stage": "STAGE",
                "composition": "COMPOSITION"}[args.cmd]
    run_id = run_profile(args.data_source, args.table, analysis,
                         args.sample_rows)
    conn = _catalog()
    cur = conn.cursor()
    cur.execute("SELECT status, error_text FROM recon_runs WHERE run_id = :r",
                {"r": run_id})
    status, err = cur.fetchone()
    print(f"run {run_id}: {status}")
    if status == "FAILED":
        print(err, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
