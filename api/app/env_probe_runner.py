"""The pulse: executes ARMED probes, writes env_probe_result.
Run from Airflow every N minutes, or CLI: python env_probe_runner.py --env DEV
WAITING probes emit SKIP (visible in Env360 as ◌ — port still TBD).
Check depth: TCP connect for everything (fast, no creds); SQL/HTTP/SFTP/CIFS
deepen via the pluggable check table below when creds/libs are wired."""
import argparse, json, socket, ssl, time

def tcp_check(host, port, timeout=3.0):
    t0 = time.time()
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return "OK", int((time.time() - t0) * 1000), "connect ok"
    except socket.timeout:
        return "DOWN", int(timeout * 1000), "timeout"
    except OSError as e:
        return "DOWN", int((time.time() - t0) * 1000), str(e)[:120]

def cert_check(host, port, timeout=4.0):
    """TLS handshake -> (status, ms, notAfter iso, detail). Real expiry beats declared."""
    t0 = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE          # reachability+expiry, not chain trust
        with socket.create_connection((host, int(port)), timeout=timeout) as sk:
            with ctx.wrap_socket(sk, server_hostname=host) as tls:
                cert = tls.getpeercert(binary_form=False) or {}
                na = cert.get("notAfter")
                if not na:                        # CERT_NONE strips dict on some builds
                    der = tls.getpeercert(binary_form=True)
                    na = None if der is None else "present-binary"
                ms = int((time.time() - t0) * 1000)
                return "OK", ms, na, "tls handshake ok"
    except Exception as e:
        return "DOWN", int((time.time() - t0) * 1000), None, str(e)[:120]

def run_probe(p):
    if p["state"] != "ARMED" or not p.get("target_port"):
        return {"probe_id": p["probe_id"], "status": "SKIP",
                "latency_ms": None, "detail": "port TBD — probe waiting"}
    # depth ladder: all types start as TCP reachability; deepen per type later
    if p["check_type"] in ("HTTP", "CERT") and int(p.get("target_port") or 0) == 443:
        status, ms, not_after, detail = cert_check(p["target_host"], p["target_port"])
        out = {"probe_id": p["probe_id"], "status": status, "latency_ms": ms,
               "detail": f'{p["check_type"]}: {detail}'}
        if not_after:
            out["cert_not_after"] = not_after
        return out
    status, ms, detail = tcp_check(p["target_host"], p["target_port"])
    if status == "OK" and ms > 1500:
        status, detail = "WARN", f"slow · {detail}"
    return {"probe_id": p["probe_id"], "status": status,
            "latency_ms": ms, "detail": f'{p["check_type"]}: {detail}'}

def run(probes, env=None):
    return [run_probe(p) for p in probes
            if (env is None or p["env"] == env)]

def persist(results):
    try:
        from .db import execute_many                      # inside the API package
    except Exception:
        try:
            from db import execute_many
        except Exception:
            return False
    execute_many("INSERT INTO env_probe_result (probe_id, status, latency_ms, detail) "
                 "VALUES (:1,:2,:3,:4)",
                 [(r["probe_id"], r["status"], r["latency_ms"], r["detail"])
                  for r in results])
    return True

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--env")
    ap.add_argument("--probes-json", help="file of probe defs (test mode)")
    a = ap.parse_args()
    probes = json.load(open(a.probes_json)) if a.probes_json else []
    res = run(probes, a.env)
    print(json.dumps(res, indent=1))
