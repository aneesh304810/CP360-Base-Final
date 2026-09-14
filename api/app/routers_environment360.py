"""Environment 360 router — certificates, health, topology, pulse.

Mount: app.include_router(routers_environment360.router)
All reads degrade to {"error": ...} for the UI's DEMO fallback.
"""
from __future__ import annotations
from fastapi import APIRouter

router = APIRouter(prefix="/env", tags=["environment360"])


def _cur():
    from ingestion.run import _connect
    conn = _connect()
    return conn, conn.cursor()


def _rows(cur):
    cols = [c[0].lower() for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def _safe(fn):
    try:
        return fn()
    except Exception as e:                                   # noqa: BLE001
        return {"error": str(e)[:400]}


LATEST = """
  SELECT r.check_id, r.status, r.latency_ms, r.detail,
         TO_CHAR(r.checked_at,'MM-DD HH24:MI') AS checked_at
  FROM env_check_results r
  JOIN (SELECT check_id, MAX(checked_at) mx FROM env_check_results
        GROUP BY check_id) m
    ON m.check_id = r.check_id AND m.mx = r.checked_at
"""


@router.get("/overview")
def overview():
    def go():
        conn, cur = _cur()
        cur.execute(f"""SELECT h.check_id, h.env_group, h.name, h.kind,
                               l.status, l.latency_ms, l.detail, l.checked_at
                        FROM env_health_checks h
                        LEFT JOIN ({LATEST}) l ON l.check_id = h.check_id
                        WHERE h.enabled='Y' ORDER BY h.env_group, h.order_no""")
        checks = _rows(cur)
        cur.execute("""SELECT COUNT(*) total,
            SUM(CASE WHEN expires_at <= SYSTIMESTAMP + 7 THEN 1 ELSE 0 END) crit,
            SUM(CASE WHEN expires_at <= SYSTIMESTAMP + 30 THEN 1 ELSE 0 END) warn
            FROM env_certificates WHERE expires_at IS NOT NULL""")
        t, crit, warn = cur.fetchone()
        healthy = sum(1 for c in checks if c["status"] == "OK")
        degraded = sum(1 for c in checks if c["status"] == "WARN")
        failed = sum(1 for c in checks if c["status"] == "FAIL")
        cur.execute("""SELECT endpoint, used_by, ticket_url,
              ROUND(CAST(expires_at AS DATE) - CAST(SYSTIMESTAMP AS DATE)) days
              FROM env_certificates
              WHERE expires_at <= SYSTIMESTAMP + 7 ORDER BY expires_at""")
        critical = _rows(cur)
        return {"kpis": {"monitored": len(checks), "healthy": healthy,
                         "degraded": degraded, "failed": failed,
                         "certs_total": t or 0, "certs_7d": crit or 0,
                         "certs_30d": warn or 0},
                "critical_certs": critical, "checks": checks}
    return _safe(go)


@router.get("/certs")
def certs():
    def go():
        conn, cur = _cur()
        cur.execute("""SELECT cert_id, endpoint, port, cn, issuer,
              TO_CHAR(expires_at,'YYYY-MM-DD') AS expires_at,
              ROUND(CAST(expires_at AS DATE) - CAST(SYSTIMESTAMP AS DATE))
                AS days_left,
              used_by, group_key, ticket_url, owner,
              TO_CHAR(last_scanned,'MM-DD HH24:MI') AS last_scanned, scan_error
              FROM env_certificates
              ORDER BY NVL(expires_at, DATE '9999-01-01')""")
        return {"certs": _rows(cur)}
    return _safe(go)


@router.post("/certs/scan")
def certs_scan():
    def go():
        from ingestion.env_probe_runner import scan_certs
        conn, _ = _cur()
        return {"ok": True, "results": scan_certs(conn)}
    return _safe(go)


@router.get("/health")
def health():
    def go():
        conn, cur = _cur()
        cur.execute(f"""SELECT h.check_id, h.env_group, h.name, h.kind,
                               h.verifies, l.status, l.latency_ms, l.detail,
                               l.checked_at
                        FROM env_health_checks h
                        LEFT JOIN ({LATEST}) l ON l.check_id = h.check_id
                        WHERE h.enabled='Y'
                        ORDER BY h.env_group, h.order_no""")
        checks = _rows(cur)
        # 30-day strip: one worst-status cell per day per check
        cur.execute("""SELECT check_id,
              TO_CHAR(checked_at,'MM-DD') AS d,
              MAX(CASE status WHEN 'FAIL' THEN 3 WHEN 'WARN' THEN 2
                  WHEN 'OK' THEN 1 ELSE 0 END) AS worst
              FROM env_check_results
              WHERE checked_at > SYSTIMESTAMP - 30
              GROUP BY check_id, TO_CHAR(checked_at,'MM-DD')
              ORDER BY d""")
        strips = {}
        for cid, d, worst in cur.fetchall():
            strips.setdefault(cid, []).append(
                {3: "FAIL", 2: "WARN", 1: "OK", 0: "NONE"}[worst])
        for c in checks:
            c["strip"] = strips.get(c["check_id"], [])
        return {"checks": checks}
    return _safe(go)


@router.get("/topology")
def topology():
    def go():
        conn, cur = _cur()
        cur.execute(f"""SELECT n.node_id, n.label, n.icon, n.zone, n.sub,
                               n.x, n.y, l.status
                        FROM env_nodes n
                        LEFT JOIN ({LATEST}) l ON l.check_id = n.check_id
                        ORDER BY n.zone""")
        nodes = _rows(cur)
        cur.execute(f"""SELECT k.link_id, k.from_node, k.to_node,
                               l.status AS link_status,
                               ROUND(CAST(c.expires_at AS DATE)
                                 - CAST(SYSTIMESTAMP AS DATE)) AS cert_days
                        FROM env_links k
                        LEFT JOIN ({LATEST}) l ON l.check_id = k.check_id
                        LEFT JOIN env_certificates c ON c.cert_id = k.cert_id""")
        links = _rows(cur)
        return {"nodes": nodes, "links": links}
    return _safe(go)


@router.get("/pulse")
def pulse_latest():
    def go():
        conn, cur = _cur()
        cur.execute("""SELECT run_id, TO_CHAR(started_at,'MM-DD HH24:MI:SS')
              AS started_at, TO_CHAR(finished_at,'MM-DD HH24:MI:SS')
              AS finished_at, total_n, ok_n, warn_n, fail_n, triggered_by
              FROM env_pulse_runs ORDER BY started_at DESC
              FETCH FIRST 10 ROWS ONLY""")
        runs = _rows(cur)
        rows = []
        if runs:
            cur.execute("""SELECT r.check_id, h.env_group, h.name, h.kind,
                  r.status, r.latency_ms, r.detail,
                  TO_CHAR(r.checked_at,'HH24:MI:SS') AS checked_at
                  FROM env_check_results r
                  JOIN env_health_checks h ON h.check_id = r.check_id
                  WHERE r.run_id = :r ORDER BY r.checked_at""",
                {"r": runs[0]["run_id"]})
            rows = _rows(cur)
        return {"runs": runs, "latest_rows": rows}
    return _safe(go)


@router.post("/pulse/run")
def pulse_run():
    def go():
        from ingestion.env_probe_runner import run_pulse
        conn, _ = _cur()
        return {"ok": True, **run_pulse(conn, triggered_by="ui")}
    return _safe(go)

@router.get("/inventory")
def inventory():
    def q():
        cur = _cur()
        cur.execute("""
            SELECT inv_id, platform, ritm, region, existing_host, new_host,
                   db_name, sizing, status, os, priority,
                   TO_CHAR(target_delivery,'YYYY-MM-DD') target_delivery,
                   target_build, note
            FROM env_inventory
            ORDER BY platform, CASE region WHEN 'DEV' THEN 1 WHEN 'SIT' THEN 2
                     WHEN 'UAT' THEN 3 WHEN 'PROD' THEN 4 ELSE 5 END""")
        rows = _rows(cur)
        cur.execute("""
            SELECT c.target, r.status, r.detail,
                   TO_CHAR(r.checked_at,'YYYY-MM-DD HH24:MI') checked_at
            FROM env_health_checks c
            JOIN env_check_results r ON r.check_id = c.check_id
            WHERE c.env_group LIKE 'SEI Build-out%'
              AND r.result_id = (SELECT MAX(r2.result_id) FROM env_check_results r2
                                 WHERE r2.check_id = c.check_id)""")
        live = _rows(cur)
        return {"inventory": rows, "liveness": live}
    return _safe(q)
