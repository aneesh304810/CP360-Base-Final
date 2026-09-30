"""Who is this, and what may they see.

TWO SYSTEMS, ONE JOB EACH. Active Directory answers the first question and
CP 360 answers the second. Nothing in this module stores a password, a
password hash, or anything replayable against AD: `authenticate` binds to
the directory with the credentials the person typed, keeps the answer, and
lets the credentials go out of scope. There is no code path that writes
them anywhere, and no table with a column to write them to.

FAIL CLOSED, EVERYWHERE. No session is 401. No grant is 403. AD
unreachable is 401 for everyone, including administrators -- an
availability problem must not become an authorisation one, and a login
path that works when the directory is down is a login path that does not
consult the directory. Every early return in this file denies.

THE UI IS NOT THE CONTROL. `visible_modules` exists so the sidebar can
hide what a person cannot open, which is courtesy. `require_module` on the
server is the control. Anything enforced only in React is enforced only
until somebody opens the network tab.
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status

from .db import query, execute

log = logging.getLogger("cp.api.security")

# ---------------------------------------------------------------- config
COOKIE = "cp360_session"
SESSION_HOURS = int(os.environ.get("CP_SESSION_HOURS", "10") or 10)
# Re-checking AD on every request would put the directory in the path of
# every page load. The session is the cached answer, and this is how long
# an answer stays good for. A disabled user is stopped sooner than this,
# because status is read from the database on every request.
IDLE_MINUTES = int(os.environ.get("CP_SESSION_IDLE_MINUTES", "120") or 120)


# ONE SWITCH, TWO STATES, NO THIRD.
#
# CP 360 has run without a login since it was built, so enforcement cannot
# simply turn itself on the moment this file lands -- that is not a secure
# default, it is an outage. It is therefore explicit: CP_SECURITY=on
# enforces, and anything else does not.
#
# What makes OFF safe to ship is that it is never quiet. /auth/me reports
# `mode: "off"`, /security/health reports it, the UI carries a banner, and
# the server logs a warning on the first request and every few minutes
# after. A setting you can see on screen is not a setting somebody
# discovers during an audit.
MODE_ON = "on"
MODE_OFF = "off"
OPEN_USER = os.environ.get("CP_SECURITY_OPEN_USER", "local.user")
_warned_at = [0.0]
_WARN_EVERY = 300.0

# Values that plainly mean "leave it off". Anything outside this set, and
# outside "on", is a value somebody typed meaning something -- and the one
# thing it must not do is quietly mean the opposite of what they meant.
_OFF_WORDS = {"", "off", "0", "false", "no", "none", "disabled"}


def mode() -> str:
    """Exactly "on" enables enforcement. Every other value is off.

    Not truthiness: "0", "false" and "no" all read as true to a careless
    check, and a security control must not depend on which of those a
    deployment happened to type.

    WHY AN UNRECOGNISED VALUE IS OFF AND NOT ON. "true", "yes", "enabled"
    and "1" are all things somebody would write meaning to switch this on,
    and reading them as off is the dangerous direction -- it is how a
    system ends up unprotected while its config says otherwise. The other
    direction is worse in practice: enforcing on a typo locks every user
    out of an instance whose AD is not configured yet, with no way back in
    through the app. So an unrecognised value stays off and shouts about
    it -- at startup, on every /security/health, and in the log -- rather
    than failing a way nobody can undo from a browser.
    """
    return MODE_ON if _raw() == MODE_ON else MODE_OFF


def _raw() -> str:
    return (os.environ.get("CP_SECURITY") or "").strip().lower()


def misconfigured() -> str:
    """The CP_SECURITY value that is neither "on" nor a plain "off", or ""."""
    raw = _raw()
    return "" if raw == MODE_ON or raw in _OFF_WORDS else raw


def describe() -> str:
    """One line for a startup banner and for an operator asking."""
    bad = misconfigured()
    if bad:
        return (f"CP_SECURITY={bad!r} is not understood — enforcement is OFF. "
                f"Use exactly 'on' to enforce, or 'off' to be explicit.")
    if enforcing():
        host = (_ad_config()[0] or "").strip()
        return (f"CP_SECURITY=on — AD sign-in required"
                + (f", directory {host}" if host else
                   ", but CP_AD_HOST is not set: no one can sign in"))
    return ("CP_SECURITY is off — no sign-in, every request served with "
            "full rights. Set CP_SECURITY=on in local/.env to enforce.")


def enforcing() -> bool:
    return mode() == MODE_ON


def _warn_off():
    now = time.time()
    if now - _warned_at[0] < _WARN_EVERY:
        return
    _warned_at[0] = now
    log.warning("%s Requests are served as %s.", describe(), OPEN_USER)


def open_user() -> dict:
    """The identity used while enforcement is off. Flagged as insecure so
    nothing downstream can mistake it for somebody who signed in."""
    return {"user_id": _norm_user(OPEN_USER), "display_name": OPEN_USER,
            "email": None, "is_admin": True, "insecure": True}


# ------------------------------------------------------------------ util
def _now():
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _norm_user(u) -> str:
    """One spelling per person.

    AD hands back DOMAIN\\ana, ana@bbh.com and Ana depending on how the
    login was typed. A grant to one of those must be a grant to all of
    them, so everything is reduced to the bare account name, upper-cased,
    before it touches the database.
    """
    s = str(u or "").strip()
    if not s:
        return ""
    if "\\" in s:
        s = s.split("\\", 1)[1]
    if "@" in s:
        s = s.split("@", 1)[0]
    return s.upper()[:120]


def _client_ip(request: Request) -> str:
    # X-Forwarded-For is attacker-controlled unless a proxy you trust set
    # it. It is recorded for the audit trail and never used for a decision.
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return (fwd or (request.client.host if request.client else "") or "")[:60]


def audit(action, *, actor=None, target=None, module=None, outcome="OK",
          detail=None, ip=None):
    """Insert-only. A failure to write the trail must not fail the request
    it describes, but it must be visible in the log."""
    try:
        execute([("""INSERT INTO sec_audit
                     (actor, action, target_user, module_key, outcome, detail,
                      client_ip)
                     VALUES (:a, :ac, :t, :m, :o, :d, :ip)""",
                  {"a": (actor or "")[:120], "ac": action[:40],
                   "t": (target or None), "m": (module or None),
                   "o": outcome[:20], "d": (detail or None), "ip": ip})])
    except Exception as e:                                    # noqa: BLE001
        log.warning("audit write failed for %s/%s: %s", action, outcome, e)


def exec_or_500(statements):
    """Write, or fail visibly.

    `execute` rolls back and re-raises; the thing that must not happen is
    an entitlement change that reports success and did not land. The real
    error goes to the log and a short one to the caller, because an Oracle
    message can carry schema detail the browser has no business seeing.
    """
    try:
        execute(statements)
    except Exception as e:                                    # noqa: BLE001
        log.error("security write failed: %s", e)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "the change could not be saved — see the API log"
                            ) from e


# -------------------------------------------------------------------- AD
class AdUnavailable(RuntimeError):
    """The directory could not be reached or did not answer.

    Distinct from bad credentials on purpose: the caller turns both into
    the same 401 for the person logging in, and only the log and the audit
    row tell them apart. Telling an unauthenticated caller which of the two
    it was is free reconnaissance.
    """


def _ad_config():
    host = (os.environ.get("CP_AD_HOST") or "").strip()
    port = int(os.environ.get("CP_AD_PORT") or 636)
    use_ssl = (os.environ.get("CP_AD_USE_SSL") or "1").strip() != "0"
    domain = (os.environ.get("CP_AD_DOMAIN") or "").strip()
    base_dn = (os.environ.get("CP_AD_BASE_DN") or "").strip()
    return host, port, use_ssl, domain, base_dn


def authenticate(username: str, password: str) -> dict:
    """Bind to AD as the person. Return their identity, or raise.

    The password is a parameter and nothing else: it is passed to the bind
    and never assigned to an attribute, logged, returned, or written.
    """
    host, port, use_ssl, domain, base_dn = _ad_config()
    if not host:
        raise AdUnavailable("CP_AD_HOST is not configured")
    if not use_ssl and (os.environ.get("CP_AD_ALLOW_INSECURE") or "") != "1":
        # A plaintext bind puts the password on the wire. Refusing by
        # default is the point; the override exists for a lab and says so.
        raise AdUnavailable(
            "refusing a plaintext LDAP bind — set CP_AD_USE_SSL=1, or "
            "CP_AD_ALLOW_INSECURE=1 if this is a lab")
    if not username or not password:
        raise PermissionError("username and password are required")

    try:
        from ldap3 import Server, Connection, ALL, SUBTREE
        from ldap3.core.exceptions import LDAPException
    except ImportError as e:                                  # pragma: no cover
        raise AdUnavailable(f"ldap3 is not installed: {e}") from e

    account = _norm_user(username)
    upn = f"{account}@{domain}" if domain else username

    try:
        server = Server(host, port=port, use_ssl=use_ssl, get_info=ALL,
                        connect_timeout=int(os.environ.get("CP_AD_TIMEOUT") or 8))
        conn = Connection(server, user=upn, password=password,
                          auto_bind=False, raise_exceptions=False)
        bound = conn.bind()
    except LDAPException as e:
        raise AdUnavailable(f"AD bind could not be attempted: {e}") from e
    except Exception as e:                                    # noqa: BLE001
        raise AdUnavailable(f"AD unreachable: {e}") from e

    if not bound:
        # ldap3 puts the reason in conn.result. A network-level failure and
        # a wrong password both land here, so they are separated: an
        # outage must not be reported to the operator as 400 people
        # suddenly typing the wrong password.
        res = (conn.result or {}) if hasattr(conn, "result") else {}
        desc = str(res.get("description") or "")
        if desc in ("invalidCredentials",) or "52e" in str(res.get("message", "")):
            raise PermissionError("invalid credentials")
        raise AdUnavailable(f"AD refused the bind: {desc or res}")

    display, email = account, None
    try:
        if base_dn:
            conn.search(base_dn, f"(sAMAccountName={account})",
                        search_scope=SUBTREE,
                        attributes=["displayName", "mail"])
            if conn.entries:
                e0 = conn.entries[0]
                display = str(getattr(e0, "displayName", account) or account)
                email = str(getattr(e0, "mail", "") or "") or None
    except Exception as e:                                    # noqa: BLE001
        # A successful bind already proved identity. Failing the login
        # because the display name lookup failed would be an outage nobody
        # can explain.
        log.info("AD attribute lookup failed for %s (login still valid): %s",
                 account, e)
    finally:
        try:
            conn.unbind()
        except Exception:                                     # noqa: BLE001
            pass

    return {"user_id": account, "display_name": display[:200], "email": email}


# -------------------------------------------------------------- sessions
def _user_row(user_id):
    rows = query("""SELECT user_id, display_name, email, status, is_admin
                    FROM sec_user WHERE user_id = :u""", {"u": user_id})
    return rows[0] if rows else None


def ensure_user(identity: dict) -> dict:
    """Record the person, and return what CP 360 knows about them.

    A successful AD bind proves who somebody is; it does not entitle them
    to anything. So the first login writes the row with NO grants and
    is_admin='N', and the person sees the landing page and nothing else
    until an administrator says otherwise. That is the intended
    experience, not a bug report: an account appearing in the entitlement
    screen is how the administrator learns there is somebody to entitle.

    The display name and e-mail are refreshed from AD each time; STATUS
    and IS_ADMIN are never touched here, because those are CP 360's answer
    and AD does not get a vote on them.
    """
    uid = identity["user_id"]
    try:
        execute([("""MERGE INTO sec_user t
                     USING (SELECT :u AS user_id FROM dual) s
                     ON (t.user_id = s.user_id)
                     WHEN MATCHED THEN UPDATE SET
                       display_name = NVL(:d, t.display_name),
                       email        = NVL(:e, t.email),
                       last_login   = SYSTIMESTAMP,
                       updated_at   = SYSTIMESTAMP
                     WHEN NOT MATCHED THEN
                       INSERT (user_id, display_name, email, status, is_admin,
                               first_seen, last_login)
                       VALUES (:u, :d, :e, 'ACTIVE', 'N',
                               SYSTIMESTAMP, SYSTIMESTAMP)""",
                  {"u": uid, "d": identity.get("display_name"),
                   "e": identity.get("email")})])
    except Exception as e:                                    # noqa: BLE001
        log.warning("could not record login for %s: %s", uid, e)
    row = _user_row(uid) or {}
    return {"user_id": uid,
            "display_name": row.get("display_name") or identity.get("display_name"),
            "email": row.get("email") or identity.get("email"),
            "status": row.get("status") or "ACTIVE",
            "is_admin": (row.get("is_admin") or "N") == "Y"}


def schema_ready() -> dict:
    """Is sql/64 loaded, and is there anybody who can administer it?

    Asked by /security/health because the failure this module is most
    likely to hit is not an exception: it is a schema that was never run,
    which looks exactly like a directory nobody has been granted anything
    in. The admin count answers the other half -- enforcement with no
    administrator locks the entitlement screen against the one person who
    could open it.
    """
    out = {"tables": {}, "admins": 0, "users": 0, "modules": 0}
    for t in ("sec_user", "sec_module", "sec_grant", "sec_session", "sec_audit"):
        try:
            r = query(f"SELECT COUNT(*) AS n FROM {t}")
            out["tables"][t] = int(r[0]["n"]) if r else 0
        except Exception:                                     # noqa: BLE001
            out["tables"][t] = None
    out["users"] = out["tables"].get("sec_user") or 0
    out["modules"] = out["tables"].get("sec_module") or 0
    try:
        r = query("SELECT COUNT(*) AS n FROM sec_user "
                  "WHERE is_admin = 'Y' AND status = 'ACTIVE'")
        out["admins"] = int(r[0]["n"]) if r else 0
    except Exception:                                         # noqa: BLE001
        out["admins"] = 0
    out["ready"] = all(v is not None for v in out["tables"].values())
    return out


def start_session(user: dict, response: Response, request: Request) -> str:
    """Issue a session and set the cookie. Returns the raw token, once.

    The raw token is never stored. What goes in the table is its SHA-256,
    so a copy of the database yields nothing that can be presented as a
    session.
    """
    token = secrets.token_urlsafe(32)
    now = _now()
    execute([("""INSERT INTO sec_session
                 (token_hash, user_id, issued_at, expires_at, last_seen_at,
                  client_ip, user_agent)
                 VALUES (:h, :u, :i, :e, :i, :ip, :ua)""",
              {"h": _hash(token), "u": user["user_id"], "i": now,
               "e": now + timedelta(hours=SESSION_HOURS),
               "ip": _client_ip(request),
               "ua": (request.headers.get("user-agent") or "")[:400]})])
    response.set_cookie(
        COOKIE, token,
        httponly=True,                  # not readable from JavaScript
        samesite="lax",                 # not sent on cross-site POSTs
        secure=(os.environ.get("CP_COOKIE_INSECURE") or "") != "1",
        max_age=SESSION_HOURS * 3600,
        path="/")
    return token


def end_session(request: Request, response: Response):
    tok = request.cookies.get(COOKIE)
    if tok:
        try:
            execute([("UPDATE sec_session SET revoked_at = :n "
                      "WHERE token_hash = :h AND revoked_at IS NULL",
                      {"n": _now(), "h": _hash(tok)})])
        except Exception as e:                                # noqa: BLE001
            log.warning("could not revoke session: %s", e)
    response.delete_cookie(COOKIE, path="/")


def _session_user(request: Request):
    """Resolve the cookie to a live user, or None. Every failure is None.

    Status is read from SEC_USER on every request rather than baked into
    the session, so disabling somebody takes effect on their next click
    instead of whenever their session happens to expire.
    """
    tok = request.cookies.get(COOKIE)
    if not tok:
        return None
    try:
        rows = query("""SELECT s.user_id, s.expires_at, s.last_seen_at,
                               s.revoked_at, u.display_name, u.email,
                               u.status, u.is_admin
                        FROM   sec_session s
                        LEFT   JOIN sec_user u ON u.user_id = s.user_id
                        WHERE  s.token_hash = :h""", {"h": _hash(tok)})
    except Exception as e:                                    # noqa: BLE001
        log.warning("session lookup failed: %s", e)
        return None
    if not rows:
        return None
    r = rows[0]

    def _aware(v):
        return v if v is None or v.tzinfo else v.replace(tzinfo=timezone.utc)

    now = _now()
    if r.get("revoked_at"):
        return None
    if _aware(r.get("expires_at")) and _aware(r["expires_at"]) < now:
        return None
    seen = _aware(r.get("last_seen_at"))
    if seen and (now - seen) > timedelta(minutes=IDLE_MINUTES):
        return None
    if (r.get("status") or "ACTIVE") != "ACTIVE":
        return None
    if not r.get("display_name") and not r.get("status"):
        # A session whose user row has gone. Deny rather than treat an
        # orphan as a valid identity.
        return None
    try:
        execute([("UPDATE sec_session SET last_seen_at = :n WHERE token_hash = :h",
                  {"n": now, "h": _hash(tok)})])
    except Exception:                                         # noqa: BLE001
        pass
    return {"user_id": r["user_id"], "display_name": r.get("display_name"),
            "email": r.get("email"), "is_admin": (r.get("is_admin") or "N") == "Y"}


# ------------------------------------------------------------ entitlement
def visible_modules(user) -> list:
    """Every module this person may open.

    An admin sees all of them: the flag is not a grant and is not stored in
    SEC_GRANT, because the thing that controls access must not be grantable
    through the mechanism it controls.
    """
    if not user:
        return []
    try:
        if user.get("is_admin"):
            return [r["module_key"] for r in
                    query("SELECT module_key FROM sec_module ORDER BY sort_order")]
        return [r["module_key"] for r in query("""
            SELECT module_key FROM sec_module WHERE open_to_all = 'Y'
            UNION
            SELECT module_key FROM sec_grant WHERE user_id = :u""",
            {"u": user["user_id"]})]
    except Exception as e:                                    # noqa: BLE001
        # Fail closed. A database problem must not hand out the estate.
        log.warning("entitlement lookup failed for %s: %s",
                    user.get("user_id"), e)
        return []


def may_open(user, module_key) -> bool:
    return module_key in set(visible_modules(user))


# ------------------------------------------------------------ dependencies
def current_user(request: Request):
    if not enforcing():
        _warn_off()
        return open_user()
    return _session_user(request)


def require_user(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "sign in to continue")
    return u


def require_admin(request: Request):
    u = require_user(request)
    if not u.get("is_admin"):
        audit("ADMIN_DENIED", actor=u["user_id"], outcome="DENIED",
              ip=_client_ip(request))
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "this screen is for security administrators")
    return u


def require_module(module_key: str):
    """Dependency factory: the server-side control for one module."""
    def _dep(request: Request):
        u = require_user(request)
        if not may_open(u, module_key):
            audit("MODULE_DENIED", actor=u["user_id"], module=module_key,
                  outcome="DENIED", ip=_client_ip(request))
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"you do not have access to {module_key}")
        return u
    return _dep
