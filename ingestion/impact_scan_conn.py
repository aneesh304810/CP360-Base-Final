"""
Impact scan connector — schema drift detection over the harvested catalog.

Design decision (agreed): the scanner diffs SNAPSHOTS OF THE `columns` TABLE
between ingestion runs. It never talks to source Oracle directly, so it needs
no extra grants — the `oracle` harvest step is the single point of contact
with source dictionaries. Run this step AFTER `oracle` in run.py.

Per run:
  1. Snapshot current `columns` rows for the configured schemas into
     schema_snapshot_cols (one snapshot_id per run).
  2. Diff vs the previous snapshot -> drift_findings
     (NEW / DROPPED / WIDENED / NARROWED / RETYPED).
  3. Feed file spec drift: read header rows of files under IMPACT_FEED_DIR
     (glob *.csv, *.txt; first line) and diff vs feed_file_specs
     -> FILE_SPEC findings; then upsert the latest spec.
  4. Severity = downstream consumers (column_lineage fan-out) x PII x kind.

Env:
  IMPACT_SCAN_SCHEMAS   CSV of schemas to watch (e.g. "IMD,PBDW").
                        Defaults to ORACLE_PROD_SCHEMAS.
  IMPACT_FEED_DIR       optional dir of representative feed files.

Findings are idempotent per (scan basis): finding_id is a hash of
(object_key, drift_kind, now_value) so re-running the same diff does not
duplicate rows, and a re-appearing change after RESOLVED shows up again
because `status` is protected from overwrite.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time

log = logging.getLogger("cp.ingestion.impact")

_WATCH_KINDS = ("WIDENED", "NARROWED", "RETYPED", "NEW", "DROPPED", "FILE_SPEC")


def _fid(*parts: str) -> str:
    return "df-" + hashlib.sha1("|".join(p or "" for p in parts).encode()).hexdigest()[:16]


class ImpactScanner:
    def __init__(self, conn, schemas: list[str], feed_dir: str | None):
        self.conn = conn
        self.schemas = schemas
        self.feed_dir = feed_dir

    @classmethod
    def from_env(cls, conn) -> "ImpactScanner":
        raw = os.getenv("IMPACT_SCAN_SCHEMAS") or os.getenv("ORACLE_PROD_SCHEMAS", "")
        schemas = [s.strip().upper() for s in raw.split(",") if s.strip()]
        return cls(conn, schemas, os.getenv("IMPACT_FEED_DIR") or None)

    # ------------------------------------------------------------------ util
    def _q(self, sql: str, params: dict | None = None) -> list[dict]:
        cur = self.conn.cursor()
        try:
            cur.execute(sql, params or {})
            cols = [c[0].lower() for c in cur.description]
            out = []
            for row in cur.fetchall():
                d = {}
                for k, v in zip(cols, row):
                    if hasattr(v, "read"):
                        v = v.read()
                    d[k] = v
                out.append(d)
            return out
        finally:
            cur.close()

    # ------------------------------------------------------------- main load
    def load(self, loader) -> int:
        scan_id = f"scan-{int(time.time())}"
        n_findings = 0
        for schema in self.schemas:
            n_findings += self._scan_schema(loader, scan_id, schema)
        if self.feed_dir:
            n_findings += self._scan_feed_files(loader, scan_id)
        loader.commit()
        log.info("impact_scan %s: %d finding(s)", scan_id, n_findings)
        return n_findings

    # --------------------------------------------------------- schema drift
    def _scan_schema(self, loader, scan_id: str, schema: str) -> int:
        prev_id = self._latest_snapshot(schema)
        cur_rows = self._q(
            """SELECT schema_name, object_name, column_name, position_order,
                      data_type, max_length, precision, scale, nullable, is_pii
                 FROM columns WHERE UPPER(schema_name) = :s""",
            {"s": schema})
        snap_id = f"{scan_id}-{schema}"
        loader._merge("schema_snapshots", ("snapshot_id",), {
            "snapshot_id": snap_id, "source_kind": schema, "schema_name": schema,
            "col_count": len(cur_rows), "trigger_by": "ingestion"})
        for r in cur_rows:
            loader._merge(
                "schema_snapshot_cols",
                ("snapshot_id", "schema_name", "object_name", "column_name"),
                {"snapshot_id": snap_id, "schema_name": r["schema_name"],
                 "object_name": r["object_name"], "column_name": r["column_name"],
                 "position_order": r["position_order"], "data_type": r["data_type"],
                 "max_length": r["max_length"], "precision": r["precision"],
                 "scale": r["scale"], "nullable": r["nullable"],
                 "is_pii": r["is_pii"] or "N"})
        if not prev_id:
            log.info("impact_scan: %s baseline snapshot only (no previous)", schema)
            return 0

        prev = {(r["object_name"], r["column_name"]): r for r in self._q(
            "SELECT * FROM schema_snapshot_cols WHERE snapshot_id = :p",
            {"p": prev_id})}
        cur = {(r["object_name"], r["column_name"]): r for r in cur_rows}

        n = 0
        for key, c in cur.items():
            obj = f"{schema}.{key[0]}.{key[1]}"
            p = prev.get(key)
            if p is None:
                n += self._finding(loader, scan_id, schema, "NEW", obj, None,
                                   self._typ(c), c,
                                   "New column at source — unmapped downstream; "
                                   "data will be dropped at the warehouse until mapped.")
                continue
            if (p["data_type"] or "") != (c["data_type"] or ""):
                n += self._finding(loader, scan_id, schema, "RETYPED", obj,
                                   self._typ(p), self._typ(c), c,
                                   "Data type changed — casts and loader specs downstream "
                                   "may fail or silently coerce.")
            elif (p["max_length"] or 0) < (c["max_length"] or 0):
                n += self._finding(loader, scan_id, schema, "WIDENED", obj,
                                   self._typ(p), self._typ(c), c,
                                   "Source column widened; downstream columns still at the "
                                   "old length — truncation risk and possible join mismatch.")
            elif (p["max_length"] or 0) > (c["max_length"] or 0):
                n += self._finding(loader, scan_id, schema, "NARROWED", obj,
                                   self._typ(p), self._typ(c), c,
                                   "Source column narrowed — upstream values may already "
                                   "exceed the new length.")
        for key, p in prev.items():
            if key not in cur:
                obj = f"{schema}.{key[0]}.{key[1]}"
                n += self._finding(loader, scan_id, schema, "DROPPED", obj,
                                   self._typ(p), None, p,
                                   "Column dropped at source — downstream selects and "
                                   "loader specs referencing it will fail.")
        return n

    @staticmethod
    def _typ(r: dict) -> str:
        dt = (r.get("data_type") or "").upper()
        if r.get("max_length") and dt.startswith(("VARCHAR", "CHAR")):
            return f"{dt}({int(r['max_length'])})"
        if r.get("precision"):
            sc = int(r.get("scale") or 0)
            return f"{dt}({int(r['precision'])},{sc})" if sc else f"{dt}({int(r['precision'])})"
        return dt

    def _latest_snapshot(self, schema: str) -> str | None:
        rows = self._q(
            """SELECT snapshot_id FROM schema_snapshots
                WHERE source_kind = :s
                ORDER BY taken_at DESC FETCH FIRST 1 ROWS ONLY""", {"s": schema})
        return rows[0]["snapshot_id"] if rows else None

    # ---------------------------------------------------------- feed drift
    def _scan_feed_files(self, loader, scan_id: str) -> int:
        import glob
        n = 0
        for path in sorted(glob.glob(os.path.join(self.feed_dir, "*.*"))):
            if not path.lower().endswith((".csv", ".txt")):
                continue
            feed_id = os.path.splitext(os.path.basename(path))[0]
            try:
                with open(path, encoding="utf-8", errors="replace") as f:
                    header = f.readline().strip()
            except OSError as e:
                log.warning("impact_scan: cannot read %s (%s)", path, e)
                continue
            sep = "|" if "|" in header else ","
            cols = [c.strip() for c in header.split(sep) if c.strip()]
            prev = self._q(
                "SELECT header_csv, col_count FROM feed_file_specs WHERE feed_id = :f",
                {"f": feed_id})
            if prev:
                old = [c for c in (prev[0]["header_csv"] or "").split(",") if c]
                added = [c for c in cols if c not in old]
                removed = [c for c in old if c not in cols]
                if added or removed:
                    delta = []
                    if added:
                        delta.append("+" + ",+".join(added))
                    if removed:
                        delta.append("\u2212" + ",\u2212".join(removed))
                    n += self._finding(
                        loader, scan_id, "FEED", "FILE_SPEC", feed_id,
                        f"{len(old)} columns", f"{len(cols)} ({' '.join(delta)})",
                        {"is_pii": "N"},
                        "File header differs from the last observed spec — "
                        "positional loaders will misalign on the next run.")
            loader._merge("feed_file_specs", ("feed_id",), {
                "feed_id": feed_id, "col_count": len(cols),
                "header_csv": ",".join(cols), "source_path": path})
        return n

    # ----------------------------------------------------------- findings
    def _finding(self, loader, scan_id, source_kind, kind, object_key,
                 was, now, colrow, detail) -> int:
        feeds, systems, owners = self._downstream(object_key, source_kind)
        sev = self._severity(kind, len(feeds), colrow.get("is_pii") == "Y")
        fid = _fid(object_key, kind, now or "")
        loader._merge(
            "drift_findings", ("finding_id",),
            {"finding_id": fid, "scan_id": scan_id, "severity": sev,
             "source_kind": source_kind, "drift_kind": kind,
             "object_key": object_key, "was_value": was, "now_value": now,
             "detail": detail, "downstream_feeds": len(feeds),
             "downstream_systems": ",".join(systems)[:1000],
             "owners": ",".join(owners)[:1000],
             "evidence_tag": f"NYDFS-EV-{fid[-6:]}", "status": "NEW"},
            protect=("status", "found_at"))  # ack/resolve survives re-scan
        return 1

    def _downstream(self, object_key: str, source_kind: str):
        """Best-effort blast walk: column_lineage fan-out -> target tables ->
        feeds (feed_catalog by system/schema match) -> systems + owners
        (interface360). Every hop degrades to empty on missing tables."""
        feeds: list[str] = []
        systems: list[str] = []
        owners: list[str] = []
        try:
            if source_kind == "FEED":
                rows = self._q(
                    """SELECT feed_name, source_system, target_system
                         FROM feed_catalog WHERE feed_id = :k OR feed_name = :k""",
                    {"k": object_key})
                for r in rows:
                    feeds.append(r["feed_name"] or object_key)
                    for s in (r["source_system"], r["target_system"]):
                        if s and s not in systems:
                            systems.append(s)
            else:
                targets = self._q(
                    """SELECT DISTINCT to_column FROM column_lineage
                        WHERE UPPER(from_column) LIKE UPPER(:k) || '%'
                        FETCH FIRST 200 ROWS ONLY""", {"k": object_key})
                tables = sorted({(t["to_column"] or "").rsplit(".", 1)[0]
                                 for t in targets if t.get("to_column")})
                for tab in tables:
                    for r in self._q(
                        """SELECT feed_name, target_system FROM feed_catalog
                            WHERE UPPER(schema_ref) LIKE '%' || UPPER(:t) || '%'
                            FETCH FIRST 20 ROWS ONLY""",
                            {"t": tab.rsplit(".", 1)[-1]}):
                        if r["feed_name"] and r["feed_name"] not in feeds:
                            feeds.append(r["feed_name"])
                        if r["target_system"] and r["target_system"] not in systems:
                            systems.append(r["target_system"])
            if systems:
                binds = {f"s{i}": s for i, s in enumerate(systems[:10])}
                in_list = ",".join(f":s{i}" for i in range(len(binds)))
                for r in self._q(
                        f"""SELECT DISTINCT update_owner FROM interface360_interfaces
                             WHERE source_system IN ({in_list})
                                OR target_system IN ({in_list})""", binds):
                    if r["update_owner"] and r["update_owner"] not in owners:
                        owners.append(r["update_owner"])
        except Exception as e:  # noqa: BLE001 — never fail a scan on the walk
            log.warning("impact_scan: downstream walk degraded for %s: %s",
                        object_key, str(e)[:160])
        return feeds, systems, owners

    @staticmethod
    def _severity(kind: str, n_feeds: int, is_pii: bool) -> str:
        score = {"DROPPED": 3, "RETYPED": 3, "FILE_SPEC": 3,
                 "WIDENED": 2, "NARROWED": 2, "NEW": 1}.get(kind, 1)
        score += min(n_feeds, 4)          # consumers
        score += 2 if is_pii else 0       # PII weighting
        return "HIGH" if score >= 5 else ("MED" if score >= 3 else "LOW")
