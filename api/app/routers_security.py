"""Sign in against AD; decide in CP 360 who may see what.

THE SPLIT. /auth/* is the identity half and is open by necessity — you
cannot require a session on the endpoint that issues one. /security/* is
the entitlement half and every route on it requires an administrator. The
two prefixes are separate so that reading the mount list tells you which
routes are unauthenticated, rather than having to read each decorator.

WHAT IS DELIBERATELY NOT HERE. No route creates an AD account, resets a
password, or reads a group. CP 360 asks the directory one question — "are
these credentials yours" — and answers the rest itself. A catalogue that
can write to the corporate directory is a catalogue with a much larger
blast radius than a catalogue.

/auth/me NEVER 401s. It is the endpoint the UI calls to find out whether
it should show a login screen, so answering "unauthorised" to "am I
authorised" would leave it with nothing to render. It returns
{authenticated: false} instead.
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, Body, HTTPException, Request, Response, status

from .db import query
from . import security as sec

log = logging.getLogger("cp.api.security")
router = APIRouter(tags=["security"])


def _me(user, request):
    """The one shape the UI reads, whichever route produced it.

    `modules: null` means "do not filter the navigation" and is what OFF
    returns; a list means "show exactly these". Null and [] must stay
    distinguishable — an empty list is a real answer (a signed-in person
    with no grants yet) and hiding the whole sidebar is the correct
    rendering of it.
    """
    on = sec.enforcing()
    if not user:
        return {"authenticated": False, "mode": sec.mode(), "user": None,
                "modules": None if not on else [], "is_admin": False}
    return {
        "authenticated": True,
        "mode": sec.mode(),
        "insecure": bool(user.get("insecure")),
        "user": {"user_id": user["user_id"],
                 "display_name": user.get("display_name") or user["user_id"],
                 "email": user.get("email")},
        "is_admin": bool(user.get("is_admin")),
        "modules": sec.visible_modules(user) if on else None,
    }


# --------------------------------------------------------------- identity
@router.get("/auth/me")
def auth_me(request: Request):
    return _me(sec.current_user(request), request)


@router.post("/auth/login")
def auth_login(request: Request, response: Response, body: dict = Body(...)):
    """Bind to AD, then issue a session.

    The two failure modes — wrong password, and directory unreachable —
    are recorded separately in the audit trail and returned identically as
    401. Which of the two it was is an operational fact, not something an
    unauthenticated caller is owed; telling them apart lets somebody probe
    for valid accounts.
    """
    if not sec.enforcing():
        # Nothing to sign in to. Say so plainly rather than issuing a
        # session that means nothing.
        return _me(sec.open_user(), request)

    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "")
    ip = sec._client_ip(request)
    account = sec._norm_user(username)

    try:
        identity = sec.authenticate(username, password)
    except PermissionError:
        sec.audit("LOGIN", actor=account, target=account, outcome="DENIED",
                  detail="invalid credentials", ip=ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "that username and password were not accepted")
    except sec.AdUnavailable as e:
        # Fail closed: the directory is the only thing that can say yes.
        log.error("AD unavailable during login for %s: %s", account, e)
        sec.audit("LOGIN", actor=account, target=account, outcome="ERROR",
                  detail=f"directory unavailable: {str(e)[:400]}", ip=ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "sign-in is unavailable — the directory could "
                            "not be reached. Try again shortly.")
    finally:
        password = ""          # not a security control; a statement of intent

    user = sec.ensure_user(identity)
    if user.get("status") != "ACTIVE":
        sec.audit("LOGIN", actor=account, target=account, outcome="DENIED",
                  detail="account disabled in CP 360", ip=ip)
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "your CP 360 access has been disabled. Contact a "
                            "security administrator.")

    sec.start_session(user, response, request)
    sec.audit("LOGIN", actor=account, target=account, outcome="OK", ip=ip)
    return _me(user, request)


@router.post("/auth/logout")
def auth_logout(request: Request, response: Response):
    u = sec.current_user(request)
    sec.end_session(request, response)
    if u:
        sec.audit("LOGOUT", actor=u["user_id"], target=u["user_id"],
                  ip=sec._client_ip(request))
    return {"authenticated": False, "mode": sec.mode()}


# ------------------------------------------------------------- entitlement
@router.get("/security/health")
def security_health():
    """Open on purpose: it reports posture, never content.

    Whether the schema is loaded and whether enforcement is on are facts
    an operator needs before they can log in, and neither tells an
    attacker anything they could not learn by trying to log in. No user
    name, module or grant appears in this payload.
    """
    st = sec.schema_ready()
    st["mode"] = sec.mode()
    st["enforcing"] = sec.enforcing()
    st["ad_configured"] = bool((sec._ad_config()[0] or "").strip())
    st["summary"] = sec.describe()
    bad = sec.misconfigured()
    if bad:
        # The dangerous case: somebody set the switch believing they had
        # turned it on. Say so first, before anything else on this page.
        st["misconfigured"] = bad
        st["warning"] = sec.describe()
    elif not st["enforcing"]:
        st["warning"] = ("CP_SECURITY is not 'on'. Every request is served "
                         "with full rights and no authentication.")
    elif not st["admins"]:
        st["warning"] = ("Enforcement is on and no active administrator "
                         "exists. Seed one with the INSERT at the foot of "
                         "sql/64_security.sql.")
    return st


@router.get("/security/modules")
def security_modules(request: Request):
    sec.require_admin(request)
    return {"modules": query("""SELECT module_key, module_name, nav_group,
                                       description, open_to_all, sort_order
                                FROM sec_module ORDER BY sort_order, module_key""")}


@router.get("/security/users")
def security_users(request: Request, q: str | None = None):
    """Everyone CP 360 knows about, with how many modules each can open.

    The count is the column an administrator actually scans: a row at zero
    is somebody who signed in and is waiting, which is the queue this
    screen exists to work through.
    """
    sec.require_admin(request)
    params = {}
    where = "1=1"
    if q:
        where = "(UPPER(u.user_id) LIKE :q OR UPPER(u.display_name) LIKE :q)"
        params["q"] = f"%{q.strip().upper()}%"
    return {"users": query(f"""
        SELECT u.user_id, u.display_name, u.email, u.status, u.is_admin,
               u.first_seen, u.last_login,
               (SELECT COUNT(*) FROM sec_grant g WHERE g.user_id = u.user_id)
                 AS grant_count
        FROM   sec_user u
        WHERE  {where}
        ORDER  BY u.is_admin DESC, u.user_id""", params)}


@router.get("/security/user/{user_id}")
def security_user(user_id: str, request: Request):
    sec.require_admin(request)
    uid = sec._norm_user(user_id)
    rows = query("""SELECT user_id, display_name, email, status, is_admin,
                           first_seen, last_login
                    FROM sec_user WHERE user_id = :u""", {"u": uid})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"no such user: {uid}")
    grants = query("""SELECT module_key, granted_by, granted_on, note
                      FROM sec_grant WHERE user_id = :u ORDER BY module_key""",
                   {"u": uid})
    return {"user": rows[0], "grants": grants,
            "modules": [g["module_key"] for g in grants]}


@router.post("/security/user")
def security_user_upsert(request: Request, body: dict = Body(...)):
    """Add somebody before their first login, or change their standing.

    Adding a row here grants nothing — it creates the person so modules
    can be ticked for them ahead of their first sign-in. Authentication is
    still AD's: an account added here that does not exist in the directory
    simply never logs in.
    """
    admin = sec.require_admin(request)
    uid = sec._norm_user(body.get("user_id"))
    if not uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user_id is required")

    existing = query("""SELECT status, is_admin FROM sec_user
                        WHERE user_id = :u""", {"u": uid})
    cur = existing[0] if existing else {}

    # Absent fields mean "leave as it is", which for a new row means the
    # safe default: active, not an administrator, no grants.
    st = str(body.get("status", cur.get("status") or "ACTIVE")).upper()
    if st not in ("ACTIVE", "DISABLED"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "status must be ACTIVE or DISABLED")
    if "is_admin" in body:
        ia = "Y" if body["is_admin"] in (True, "Y", "y", 1, "true") else "N"
    else:
        ia = cur.get("is_admin") or "N"

    if uid == admin["user_id"] and (ia == "N" or st == "DISABLED"):
        # Removing your own last privilege locks the entitlement screen
        # behind a database edit. Refuse; ask another administrator.
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "you cannot remove or disable your own "
                            "administrator access — ask another administrator")

    params = {"u": uid, "d": (body.get("display_name") or
                              cur.get("display_name") or uid)[:200],
              "e": (body.get("email") or None), "st": st, "ia": ia}
    sec.exec_or_500([("""MERGE INTO sec_user t
                   USING (SELECT :u AS user_id FROM dual) s
                   ON (t.user_id = s.user_id)
                   WHEN MATCHED THEN UPDATE SET
                     display_name = :d, email = NVL(:e, t.email),
                     status = :st, is_admin = :ia, updated_at = SYSTIMESTAMP
                   WHEN NOT MATCHED THEN
                     INSERT (user_id, display_name, email, status, is_admin)
                     VALUES (:u, :d, :e, :st, :ia)""", params)])
    sec.audit("USER_UPSERT", actor=admin["user_id"], target=uid, outcome="OK",
              detail=f"status={st} admin={ia}", ip=sec._client_ip(request))
    return security_user(uid, request)


@router.post("/security/grants")
def security_grants(request: Request, body: dict = Body(...)):
    """Set one person's modules to exactly this list.

    A whole-list replace rather than add/remove calls, because the screen
    is a set of tick boxes and Save means "this is the answer now". Two
    administrators editing the same person will have the later save win
    outright, which is visible in the audit trail; partial merges would
    produce a state neither of them chose.
    """
    admin = sec.require_admin(request)
    uid = sec._norm_user(body.get("user_id"))
    if not uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user_id is required")
    if not query("SELECT user_id FROM sec_user WHERE user_id = :u", {"u": uid}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"no such user: {uid}")

    wanted = {str(m).strip() for m in (body.get("modules") or []) if str(m).strip()}
    known = {r["module_key"] for r in query("SELECT module_key FROM sec_module")}
    unknown = sorted(wanted - known)
    if unknown:
        # A key that is not in SEC_MODULE can never be checked by
        # require_module, so storing it would be a grant that silently
        # does nothing.
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"unknown module(s): {', '.join(unknown)}")

    held = {r["module_key"] for r in
            query("SELECT module_key FROM sec_grant WHERE user_id = :u", {"u": uid})}
    add, drop = sorted(wanted - held), sorted(held - wanted)

    stmts = [("""INSERT INTO sec_grant (user_id, module_key, granted_by, note)
                 VALUES (:u, :m, :b, :n)""",
              {"u": uid, "m": m, "b": admin["user_id"],
               "n": (body.get("note") or None)}) for m in add]
    stmts += [("DELETE FROM sec_grant WHERE user_id = :u AND module_key = :m",
               {"u": uid, "m": m}) for m in drop]
    if stmts:
        # One transaction: a half-applied entitlement change is a state
        # nobody asked for and nobody can see.
        sec.exec_or_500(stmts)

    ip = sec._client_ip(request)
    for m in add:
        sec.audit("GRANT", actor=admin["user_id"], target=uid, module=m, ip=ip)
    for m in drop:
        sec.audit("REVOKE", actor=admin["user_id"], target=uid, module=m, ip=ip)
    return {"user_id": uid, "granted": add, "revoked": drop,
            "modules": sorted(wanted)}


@router.get("/security/audit")
def security_audit(request: Request, limit: int = 100,
                   target: str | None = None):
    sec.require_admin(request)
    params = {"lim": max(1, min(int(limit or 100), 500))}
    where = "1=1"
    if target:
        where = "target_user = :t"; params["t"] = sec._norm_user(target)
    return {"audit": query(f"""
        SELECT at_ts, actor, action, target_user, module_key, outcome, detail,
               client_ip
        FROM   sec_audit WHERE {where}
        ORDER  BY at_ts DESC, audit_id DESC
        FETCH FIRST :lim ROWS ONLY""", params)}
