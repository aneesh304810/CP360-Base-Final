"""A read-only oracledb session. Nothing about the DSN is logged or stored.

An ldap:// DSN (directory naming) is resolved to its connect descriptor
through the directory first, using ldap3 when installed; python-oracledb
thin mode does not do that lookup itself.
"""
from __future__ import annotations

import os
import re
from typing import Any, Callable

from ..config import Credentials

_LDAP = re.compile(r"^ldaps?://(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<alias>[^,]+),(?P<base>.+)$", re.I)


def resolve_ldap_dsn(dsn: str, lookup: Callable[[str, int, str, str], str | None] | None = None) -> str:
    """ldap://host:port/alias,cn=OracleContext,dc=... -> the connect descriptor the directory holds."""
    m = _LDAP.match(dsn.strip())
    if not m:
        return dsn
    host, port, alias, base = m.group("host"), int(m.group("port") or 389), m.group("alias"), m.group("base")
    if lookup is None:
        lookup = _ldap3_lookup
    desc = lookup(host, port, alias, base)
    if not desc:
        raise RuntimeError("the directory returned no connect descriptor for the alias; check the alias and the base DN")
    return desc


def _ldap3_lookup(host: str, port: int, alias: str, base: str) -> str | None:
    try:
        import ldap3  # optional extra
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("PBDW_DSN is an ldap:// alias; install the 'ldap' extra (pip install -e .[ldap]) "
                           "or set PBDW_DSN to the connect descriptor / EZConnect string") from e
    server = ldap3.Server(host, port=port, get_info=ldap3.NONE)
    with ldap3.Connection(server, auto_bind=True) as c:
        c.search(search_base=f"cn={alias},{base}", search_filter="(objectclass=*)", search_scope=ldap3.BASE,
                 attributes=["orclNetDescString"])
        if c.entries:
            v = c.entries[0]["orclNetDescString"].value
            return v if isinstance(v, str) else (v[0] if v else None)
    return None


_THICK = {"on": False}


def init_thick(lib_dir: str | None = None) -> bool:
    """Switch python-oracledb to thick mode, once, using an Oracle Instant Client.

    Needed when the listener requires Native Network Encryption (DPY-3001):
    thin mode cannot negotiate it. lib_dir comes from ORACLE_CLIENT_LIB, or
    the client is found on PATH (Windows) / the loader path (Linux).
    """
    if _THICK["on"]:
        return True
    import oracledb
    lib = lib_dir or os.environ.get("ORACLE_CLIENT_LIB") or None
    try:
        oracledb.init_oracle_client(lib_dir=lib) if lib else oracledb.init_oracle_client()
    except Exception as e:
        raise RuntimeError(
            "thick mode needs an Oracle Instant Client: install it, then set ORACLE_CLIENT_LIB to its folder "
            "(for example the instantclient_23_x directory) or put it on PATH. " + str(e).splitlines()[0]) from e
    _THICK["on"] = True
    return True


def connect(creds: Credentials | None = None, call_timeout_ms: int = 600_000, connector: Callable | None = None) -> Any:
    """Open the session. Thick mode is used when PBDW_THICK=1 or ORACLE_CLIENT_LIB is set,
    and tried automatically when the server demands Native Network Encryption."""
    creds = creds or Credentials.from_env()
    if creds is None:
        raise RuntimeError("set PBDW_DSN, PBDW_USER and PBDW_PASSWORD in the environment")
    import oracledb
    connector = connector or oracledb.connect
    if os.environ.get("PBDW_THICK", "").strip() in ("1", "true", "yes") or os.environ.get("ORACLE_CLIENT_LIB"):
        init_thick()
    dsn = resolve_ldap_dsn(creds.dsn)
    try:
        conn = connector(user=creds.user, password=creds.password, dsn=dsn)
    except Exception as e:
        msg = str(e)
        if "DPY-3001" in msg and not _THICK["on"]:
            # the listener insists on Native Network Encryption: only thick mode can do it
            init_thick()
            conn = connector(user=creds.user, password=creds.password, dsn=dsn)
        else:
            raise
    conn.call_timeout = call_timeout_ms
    return conn


class Runner:
    """run(sql, binds) -> list[dict], lower-cased keys. One place to swap a fake in."""

    def __init__(self, conn: Any):
        self.conn = conn

    def __call__(self, sql: str, binds: dict | None = None) -> list[dict]:
        if re.match(r"^\s*(insert|update|delete|merge|create|alter|drop|truncate|grant)\b", sql, re.I):
            raise RuntimeError("scd2lens is read-only; refusing a statement that is not a SELECT")
        with self.conn.cursor() as cur:
            cur.execute(sql, binds or {})
            cols = [d[0].lower() for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
