"""Progress, latency and time estimate for the historical migration load.

The load is latency bound: a few dozen round trips to a database that may
be on another continent, each carrying a batch of up to 2,000 rows. This
module times every one of them and keeps the operator informed:

  * before the first write it pings the database (SELECT 1 FROM dual, three
    times) and prints a plan: how many deletes and insert batches are
    coming, how many rows and megabytes, the measured round-trip latency
    and a first estimate of the total time;
  * every insert batch gets a bar line with its own measured latency (a
    ping just before the insert; on a long load every CP_HIST_PING_EVERY-th
    batch), the batch's wall time, rows per second, time elapsed, time
    remaining and the projected total, refined from what has been observed
    so far rather than from the first guess;
  * at the end a timing summary: parse, connect, deletes, inserts, commit,
    total; latency median and spread; the effective transfer rate; and
    what 100,000 rows of this shape would take on the same link.

Environment
    CP_HIST_PROGRESS          "0" to silence the bar (the summary still logs)
    CP_HIST_PING_EVERY        probe latency before every n-th batch (default:
                              every batch up to 20 batches, else every 10th)
    CP_HIST_BANDWIDTH_MBPS    link speed assumed for the FIRST estimate only
                              (default 30); replaced by the measured rate
                              after the first batch
    CP_HIST_ESTIMATE          "1": ping, plan, print the estimate and stop
                              without deleting or inserting anything

Nothing here reads a row's value for anything but its length; the bar
shows table names, counts and seconds.
"""
from __future__ import annotations

import logging
import os
import shutil
import statistics
import sys
import time

log = logging.getLogger("cp.ingest.hist_progress")

BATCH_ROWS = 2000


def _flag(name, default=""):
    return os.environ.get(name, default).strip().lower()


def fmt_dur(s):
    """7.3 s below a minute, else m:ss, else h:mm:ss."""
    if s is None:
        return "?"
    if s < 60:
        return f"{s:.1f} s"
    s = int(round(s))
    if s < 3600:
        return f"{s // 60}:{s % 60:02d}"
    return f"{s // 3600}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def fmt_bytes(n):
    if n is None:
        return "?"
    if n < 1024 * 1024:
        return f"{n / 1024:.0f} KB"
    return f"{n / 1024 / 1024:.1f} MB"


def ping(cur, n=3):
    """The round trip to the database, in seconds: the fastest of n
    SELECT 1 FROM dual. None when the cursor cannot answer (no database,
    a fake, a closed cursor)."""
    best = None
    for _ in range(max(1, n)):
        t = time.perf_counter()
        try:
            cur.execute("SELECT 1 FROM dual")
            cur.fetchone()
        except Exception:                                    # noqa: BLE001
            return None
        d = time.perf_counter() - t
        best = d if best is None else min(best, d)
    return best


def payload_bytes(rows):
    """Roughly how many bytes the rows are on the wire: the length of every
    string value, 8 for anything else. Over 5,000 rows a stride sample is
    scaled instead of walking every row."""
    if not rows:
        return 0
    step = max(1, len(rows) // 5000)
    total = 0
    seen = 0
    for i in range(0, len(rows), step):
        r = rows[i]
        total += sum(len(v) if isinstance(v, str) else 8 for v in r.values())
        seen += 1
    return int(total * len(rows) / seen) if seen else 0


def plan_steps(bundle, load_order, table, batch_rows=BATCH_ROWS, deletes=True):
    """The writes the load will do, in order: one delete per table (reverse
    order), then the insert batches, then the batch row. Each step is a
    dict with kind, table, rows and bytes."""
    steps = []
    for kind in (reversed(load_order) if deletes else ()):
        if bundle.get(kind):
            steps.append({"kind": "delete", "table": table[kind], "rows": 0, "bytes": 0})
    for kind in load_order:
        rows = bundle.get(kind) or []
        if not rows:
            continue
        per = payload_bytes(rows) / len(rows)
        n = (len(rows) + batch_rows - 1) // batch_rows
        for i in range(n):
            lo = i * batch_rows
            cnt = min(batch_rows, len(rows) - lo)
            steps.append({"kind": "insert", "table": table[kind], "rows": cnt, "bytes": int(per * cnt), "batch": i + 1, "batches": n})
    steps.append({"kind": "insert", "table": "cp_hist_ingest_batch", "rows": 1, "bytes": 2000, "batch": 1, "batches": 1})
    return steps


class LoadProgress:
    """Bar, per-step latency and running estimate for a planned list of
    steps. tick(i, seconds, rtt) records step i; estimate() projects the
    remainder from what has been seen; finish() returns the summary."""

    def __init__(self, steps, rtt=None, parse_s=0.0, stream=None, enabled=None, width=26):
        self.steps = steps
        self.rtt0 = rtt                      # the opening ping
        self.rtts = [rtt] if rtt is not None else []
        self.parse_s = parse_s or 0.0
        self.other_s = 0.0                   # connect, hash, match, commit
        self.stream = stream or sys.stderr
        self.enabled = (_flag("CP_HIST_PROGRESS", "1") not in ("0", "false", "no")) if enabled is None else enabled
        try:
            self.tty = bool(self.stream.isatty())
        except Exception:                    # noqa: BLE001
            self.tty = False
        self.width = width
        self.t0 = time.perf_counter()
        self.obs = []                        # (step, seconds, rtt)
        self.mbps0 = float(_flag("CP_HIST_BANDWIDTH_MBPS", "30") or 30)
        self._dirty = False

    # ------------------------------------------------------------ model
    @property
    def rtt(self):
        """The latest latency reading, else the opening one."""
        return self.rtts[-1] if self.rtts else None

    def ping_every(self):
        v = _flag("CP_HIST_PING_EVERY")
        if v.isdigit() and int(v) > 0:
            return int(v)
        n = sum(1 for s in self.steps if s["kind"] == "insert")
        return 1 if n <= 20 else 10

    def _rate(self):
        """Bytes per second of transfer observed so far, after taking one
        round trip off every insert; the assumed link speed until there is
        an observation."""
        big = [(s, sec, r) for s, sec, r in self.obs if s["kind"] == "insert" and s["bytes"] >= 32 * 1024]   # a tiny batch is all latency
        b = sum(s["bytes"] for s, _, _ in big)
        t = sum(max(sec - (r or self.rtt or 0), 1e-3) for s, sec, r in big)
        if b > 0 and t > 0:
            return b / t
        return self.mbps0 * 1024 * 1024 / 8

    def _delete_cost(self):
        d = [sec for s, sec, _ in self.obs if s["kind"] == "delete"]
        return statistics.mean(d) if d else (self.rtt or 0.3) * 1.5

    def step_estimate(self, s):
        if s["kind"] == "delete":
            return self._delete_cost()
        rtt = self.rtt or 0.3
        return rtt + rtt / self.ping_every() + s["bytes"] / self._rate()        # the insert, its share of a probe, the bytes

    def estimate(self):
        """(elapsed, remaining, total) in seconds; total includes the parse
        and the connect/hash/match time already spent."""
        done = len(self.obs)
        remaining = sum(self.step_estimate(s) for s in self.steps[done:])
        elapsed = time.perf_counter() - self.t0
        return elapsed, remaining, self.parse_s + elapsed + remaining

    def first_estimate(self):
        """The plan before anything is written."""
        ins = [s for s in self.steps if s["kind"] == "insert"]
        return {"deletes": sum(1 for s in self.steps if s["kind"] == "delete"), "batches": len(ins),
                "rows": sum(s["rows"] for s in ins), "bytes": sum(s["bytes"] for s in ins),
                "rtt": self.rtt, "seconds": sum(self.step_estimate(s) for s in self.steps), "assumed_mbps": self.mbps0}

    # ------------------------------------------------------------ output
    def _write(self, line, final=False):
        if not self.enabled:
            return
        if self.tty:
            cols = shutil.get_terminal_size((120, 20)).columns
            line = line[: max(20, cols - 1)]
            self.stream.write("\r" + line.ljust(cols - 1))
            if final:
                self.stream.write("\n")
            self._dirty = not final
        else:
            self.stream.write(line + "\n")
        try:
            self.stream.flush()
        except Exception:                    # noqa: BLE001
            pass

    def bar(self, frac):
        n = int(round(max(0.0, min(1.0, frac)) * self.width))
        return "[" + "#" * n + "-" * (self.width - n) + "]"

    def start(self):
        f = self.first_estimate()
        lat = f"{f['rtt'] * 1000:.0f} ms" if f["rtt"] is not None else "not measured (no database)"
        log.info("hist_migration: plan: %s deletes, %s insert batches, %s rows, %s on the wire; round trip %s; first estimate %s for the load (link assumed %.0f Mbps until measured)%s",
                 f["deletes"], f["batches"], f"{f['rows']:,}", fmt_bytes(f["bytes"]), lat, fmt_dur(f["seconds"]), f["assumed_mbps"],
                 f" after a {fmt_dur(self.parse_s)} parse" if self.parse_s else "")
        return f

    def tick(self, i, seconds, rtt=None):
        s = self.steps[i]
        if rtt is not None:
            self.rtts.append(rtt)
        self.obs.append((s, seconds, rtt))
        elapsed, remaining, total = self.estimate()
        frac = (i + 1) / len(self.steps)
        if s["kind"] == "delete":
            what = f"delete {s['table']}"
            detail = f"{seconds:.2f} s"
        else:
            what = f"insert {s['table']} {s['batch']}/{s['batches']}"
            rps = s["rows"] / seconds if seconds > 0 else 0
            lat = f"latency {(rtt if rtt is not None else self.rtt or 0) * 1000:.0f} ms" + ("" if rtt is not None else " (last probe)")
            detail = f"{s['rows']:,} row{'s' if s['rows'] != 1 else ''} | {fmt_bytes(s['bytes'])} | {seconds:.2f} s | {lat} | {rps:,.0f} rows/s"
        line = f"{self.bar(frac)} {frac * 100:3.0f}%  {what} | {detail} | elapsed {fmt_dur(elapsed)} | left ~{fmt_dur(remaining)} | total ~{fmt_dur(total)}"
        self._write(line, final=(i + 1 == len(self.steps)))
        return line

    def note(self, seconds):
        """Time spent outside the steps: connect, hash, match, commit."""
        self.other_s += seconds

    def finish(self):
        if self._dirty:
            self._write("", final=True)
        elapsed = time.perf_counter() - self.t0
        ins = [(s, sec) for s, sec, _ in self.obs if s["kind"] == "insert"]
        dele = [sec for s, sec, _ in self.obs if s["kind"] == "delete"]
        rows = sum(s["rows"] for s, _ in ins)
        byt = sum(s["bytes"] for s, _ in ins)
        ins_s = sum(sec for _, sec in ins)
        rtts = [r for r in self.rtts if r is not None]
        out = {"parse_s": self.parse_s, "other_s": self.other_s, "delete_s": sum(dele), "deletes": len(dele),
               "insert_s": ins_s, "batches": len(ins), "rows": rows, "bytes": byt, "load_s": elapsed, "total_s": self.parse_s + elapsed,
               "rtt_median": statistics.median(rtts) if rtts else None, "rtt_min": min(rtts) if rtts else None, "rtt_max": max(rtts) if rtts else None,
               "pings": len(rtts), "rate_bps": self._rate() if ins else None}
        # what 100,000 rows of the same shape would cost on this link
        if ins and rows:
            per_row = byt / rows
            batches = (100000 + BATCH_ROWS - 1) // BATCH_ROWS
            out["per_100k_s"] = batches * (out["rtt_median"] or 0) + 100000 * per_row / (out["rate_bps"] or 1)
        log.info("hist_migration: timing: parse %s | connect/hash/match/commit %s | %s deletes %s | %s insert batches %s (%s rows, %s) | load %s | total %s",
                 fmt_dur(out["parse_s"]), fmt_dur(out["other_s"]), out["deletes"], fmt_dur(out["delete_s"]), out["batches"], fmt_dur(out["insert_s"]),
                 f"{rows:,}", fmt_bytes(byt), fmt_dur(out["load_s"]), fmt_dur(out["total_s"]))
        if rtts:
            log.info("hist_migration: network: latency %.0f ms median (%.0f-%.0f) over %s probes | effective transfer %s/s | 100,000 rows of this shape would take ~%s on this link",
                     out["rtt_median"] * 1000, out["rtt_min"] * 1000, out["rtt_max"] * 1000, out["pings"], fmt_bytes(out["rate_bps"] or 0), fmt_dur(out.get("per_100k_s")))
        return out
