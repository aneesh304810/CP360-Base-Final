"""
datasource_registry.py — Admin data-source registry.

Stores Oracle connection definitions in cp_datasources (SILVER) with secrets
kept as references in cp_datasource_secret:
    env:VARNAME       -> resolved from the API server's environment (preferred)
    enc:<ciphertext>  -> AES (Fernet) encrypted with key from CP_DS_MASTER_KEY

The plaintext password is accepted exactly once (on save), converted to a
reference, and never returned by any code path.

Public API:
    list_sources(), get_source(name), save_source(payload), delete_source(name)
    build_dsn(name)      -> 'user:pwd@host:port/service' for the engines
    connect_source(name) -> live oracledb connection
    test_source(name)    -> preflight dict (connect, schemas, grants)
"""
from __future__ import annotations

import base64
import datetime as dt
import logging
import os

from ingestion.variance_engine import _catalog, _connect, _init_driver

log = logging.getLogger("cp.admin.datasources")


# ---------------------------------------------------------------------------
# secret handling
# ---------------------------------------------------------------------------
def _fernet():
    key = os.environ.get("CP_DS_MASTER_KEY")
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
        pad = base64.urlsafe_b64encode(key.encode().ljust(32, b"0")[:32])
        return Fernet(pad)
    except ImportError:
        return None


def make_secret_ref(password: str | None, env_ref: str | None):
    """Turn a one-time plaintext password OR an env reference into the
    stored reference. Raises if neither storable form is possible."""
    if env_ref:
        ref = env_ref if env_ref.startswith("env:") else f"env:{env_ref}"
        return ref
    if password:
        f = _fernet()
        if not f:
            raise ValueError(
                "direct password storage needs CP_DS_MASTER_KEY (and the "
                "'cryptography' package) on the API server — otherwise use "
                "an environment reference like env:CP_DS_MYSOURCE_PWD")
        return "enc:" + f.encrypt(password.encode()).decode()
    raise ValueError("provide a password or an env reference")


def _resolve_secret(ref: str) -> str:
    if ref.startswith("env:"):
        val = os.environ.get(ref[4:])
        if not val:
            raise RuntimeError(f"environment variable {ref[4:]} is not set "
                               f"on the server")
        return val
    if ref.startswith("enc:"):
        f = _fernet()
        if not f:
            raise RuntimeError("CP_DS_MASTER_KEY not configured — cannot "
                               "decrypt stored secret")
        return f.decrypt(ref[4:].encode()).decode()
    raise RuntimeError("unrecognised secret reference form")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
_COLS = ("name", "role", "method", "host", "port", "service", "ldap_alias",
         "tns_entry", "schemas", "username", "thick_mode", "read_only")


def list_sources():
    conn = _catalog()
    cur = conn.cursor()
    cur.execute(f"""SELECT {', '.join(_COLS)}, last_test_at, last_test_ok,
                           last_test_msg
                    FROM cp_datasources ORDER BY name""")
    cols = [c[0].lower() for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_source(name):
    rows = [r for r in list_sources() if r["name"] == name.upper()]
    return rows[0] if rows else None


def save_source(p: dict):
    """Upsert. p may include 'password' (one-time) or 'env_ref'; if neither
    is present on update, the existing secret is kept."""
    name = p["name"].strip().upper()
    conn = _catalog()
    cur = conn.cursor()
    binds = {c: p.get(c) for c in _COLS}
    binds["name"] = name
    binds["thick_mode"] = (p.get("thick_mode") or "Y")[:1].upper()
    binds["read_only"] = (p.get("read_only") or "Y")[:1].upper()
    cur.execute("""MERGE INTO cp_datasources d
        USING (SELECT :name AS name FROM dual) s ON (d.name = s.name)
        WHEN MATCHED THEN UPDATE SET role = :role, method = :method,
             host = :host, port = :port, service = :service,
             ldap_alias = :ldap_alias, tns_entry = :tns_entry,
             schemas = :schemas, username = :username,
             thick_mode = :thick_mode, read_only = :read_only,
             updated_at = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT
             (name, role, method, host, port, service, ldap_alias, tns_entry,
              schemas, username, thick_mode, read_only)
             VALUES (:name, :role, :method, :host, :port, :service,
                     :ldap_alias, :tns_entry, :schemas, :username,
                     :thick_mode, :read_only)""", binds)
    if p.get("password") or p.get("env_ref"):
        ref = make_secret_ref(p.get("password"), p.get("env_ref"))
        cur.execute("""MERGE INTO cp_datasource_secret t
            USING (SELECT :n AS name FROM dual) s ON (t.name = s.name)
            WHEN MATCHED THEN UPDATE SET secret_ref = :r,
                 updated_at = SYSTIMESTAMP
            WHEN NOT MATCHED THEN INSERT (name, secret_ref)
                 VALUES (:n, :r)""", {"n": name, "r": ref})
    conn.commit()
    return get_source(name)


def delete_source(name):
    conn = _catalog()
    cur = conn.cursor()
    cur.execute("DELETE FROM cp_datasources WHERE name = :n",
                {"n": name.upper()})
    conn.commit()
    return cur.rowcount


# ---------------------------------------------------------------------------
# connection building
# ---------------------------------------------------------------------------
def build_dsn(name):
    src = get_source(name)
    if not src:
        raise RuntimeError(f"unknown data source {name}")
    conn = _catalog()
    cur = conn.cursor()
    cur.execute("SELECT secret_ref FROM cp_datasource_secret WHERE name = :n",
                {"n": src["name"]})
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no secret registered for {name}")
    pwd = _resolve_secret(row[0])
    method = (src["method"] or "HOST").upper()
    if method == "LDAP":
        from ingestion.resolve_ldap_dsn import resolve as _ldap_resolve
        hostpart = _ldap_resolve(src["ldap_alias"])
    elif method == "TNS":
        hostpart = src["tns_entry"]
    else:
        hostpart = f"{src['host']}:{src['port']}/{src['service']}"
    return f"{src['username']}:{pwd}@{hostpart}", src


def connect_source(name):
    dsn, src = build_dsn(name)
    if (src.get("thick_mode") or "Y") == "Y":
        _init_driver()
    return _connect(dsn), src


# ---------------------------------------------------------------------------
# preflight test
# ---------------------------------------------------------------------------
def test_source(name):
    """Connect + verify each declared schema: visible tables, a proving
    SELECT, and grant warnings. Persists result on the source row."""
    out = {"ok": False, "steps": []}
    t0 = dt.datetime.now()
    try:
        conn, src = connect_source(name)
        ms = int((dt.datetime.now() - t0).total_seconds() * 1000)
        import oracledb
        out["steps"].append(
            f"✓ connected in {ms} ms · "
            f"{'thin' if oracledb.is_thin_mode() else 'thick'}")
        cur = conn.cursor()
        for schema in [s.strip().upper() for s in
                       (src.get("schemas") or "").split(",") if s.strip()]:
            cur.execute("""SELECT COUNT(*) FROM all_tables
                           WHERE owner = :o""", {"o": schema})
            n = cur.fetchone()[0]
            out["steps"].append(f"✓ schema {schema} visible · {n} tables")
            if n:
                cur.execute("""SELECT table_name FROM all_tables
                               WHERE owner = :o
                               ORDER BY num_rows DESC NULLS LAST
                               FETCH FIRST 1 ROWS ONLY""", {"o": schema})
                tab = cur.fetchone()[0]
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{schema}"."{tab}"')
                    out["steps"].append(
                        f"✓ SELECT COUNT(*) FROM {schema}.{tab} → "
                        f"{cur.fetchone()[0]:,}")
                except Exception as e:                      # noqa: BLE001
                    out["steps"].append(
                        f"⚠ no SELECT on {schema}.{tab} — will be "
                        f"skipped in scans ({str(e)[:60]})")
        conn.close()
        out["ok"] = True
    except Exception as e:                                  # noqa: BLE001
        out["steps"].append(f"✗ {str(e)[:300]}")
    # persist result (never the credential)
    try:
        conn = _catalog()
        cur = conn.cursor()
        cur.execute("""UPDATE cp_datasources
            SET last_test_at = SYSTIMESTAMP, last_test_ok = :ok,
                last_test_msg = :msg
            WHERE name = :n""",
            {"ok": "Y" if out["ok"] else "N",
             "msg": " | ".join(out["steps"])[:1000], "n": name.upper()})
        conn.commit()
    except Exception:                                       # noqa: BLE001
        log.warning("could not persist test result for %s", name)
    return out
