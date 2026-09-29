"""The security module has to deny by default, in every direction.

WHY THESE PARTICULAR ASSERTIONS. Every bug this file guards against is a
bug that FAILS OPEN — it makes the app work, so nobody reports it, and it
is found in an audit instead. In order:

  * a mode switch read by truthiness would treat CP_SECURITY=off, =0 and
    =false as ON, because they are all non-empty strings;
  * a database error inside the entitlement lookup would return the whole
    estate if the except branch returned "everything" rather than nothing;
  * DOMAIN\\ana and ana@bbh.com are the same person, and a grant that does
    not normalise is a grant that does not apply on the next login;
  * a missing table in Oracle returns [] from db.query rather than raising,
    so "schema never installed" and "nobody granted anything" look
    identical to the caller and must both deny.

    python api/test/test_security.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import HTTPException                             # noqa: E402

from api.app import security as S                             # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


class Req:
    """The two things security.py reads off a request, and nothing else."""
    def __init__(self, cookies=None, headers=None):
        self.cookies = cookies or {}
        self.headers = headers or {}
        self.client = None


def with_env(**kw):
    prev = {k: os.environ.get(k) for k in kw}
    for k, v in kw.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    return prev


def restore(prev):
    for k, v in prev.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


# ---- the switch: exactly "on", nothing else ----------------------------
print("\n-- mode")
for val, want in [("on", "on"), ("ON", "on"), (" on ", "on"),
                  ("off", "off"), ("0", "off"), ("false", "off"),
                  ("1", "off"), ("true", "off"), ("yes", "off"),
                  ("", "off"), (None, "off")]:
    p = with_env(CP_SECURITY=val)
    ok(S.mode() == want, f"CP_SECURITY={val!r} -> {want}", S.mode())
    restore(p)

p = with_env(CP_SECURITY="on")
ok(S.enforcing() is True, "enforcing() follows mode()")
restore(p)

# ---- one spelling per person -------------------------------------------
print("\n-- user normalisation")
for raw, want in [("ana", "ANA"), ("Ana", "ANA"), ("  ana  ", "ANA"),
                  ("BBH\\ana", "ANA"), ("bbh\\Ana", "ANA"),
                  ("ana@bbh.com", "ANA"), ("ANA@BBH.COM", "ANA"),
                  ("bbh\\ana@bbh.com", "ANA"),
                  ("", ""), (None, ""), ("   ", "")]:
    ok(S._norm_user(raw) == want, f"{raw!r} -> {want!r}", S._norm_user(raw))
ok(len(S._norm_user("x" * 300)) == 120, "a long value is truncated to the column")

# ---- entitlement, and what happens when the database says nothing ------
print("\n-- visible_modules")
ALL = [{"module_key": k} for k in ("home", "data", "lineage", "security")]


def fake_query(rows_or_exc):
    def _q(sql, params=None):
        if isinstance(rows_or_exc, Exception):
            raise rows_or_exc
        return rows_or_exc
    return _q


orig_query = S.query
try:
    S.query = fake_query(ALL)
    ok(S.visible_modules({"user_id": "ANA", "is_admin": True})
       == ["home", "data", "lineage", "security"],
       "an administrator sees every module")

    S.query = fake_query([{"module_key": "home"}, {"module_key": "data"}])
    ok(S.visible_modules({"user_id": "ANA", "is_admin": False})
       == ["home", "data"], "a granted user sees open_to_all plus their grants")
    ok(S.may_open({"user_id": "ANA", "is_admin": False}, "data") is True,
       "may_open says yes to a granted module")
    ok(S.may_open({"user_id": "ANA", "is_admin": False}, "lineage") is False,
       "and no to one that was not granted")

    # The three ways this can go wrong, all of which must deny.
    S.query = fake_query([])
    ok(S.visible_modules({"user_id": "ANA", "is_admin": False}) == [],
       "a schema that was never installed grants nothing")
    ok(S.visible_modules({"user_id": "ANA", "is_admin": True}) == [],
       "including for an administrator -- no rows is no rows")

    S.query = fake_query(RuntimeError("ORA-12541: no listener"))
    ok(S.visible_modules({"user_id": "ANA", "is_admin": False}) == [],
       "a database failure grants nothing")
    ok(S.visible_modules({"user_id": "ANA", "is_admin": True}) == [],
       "a database failure grants an administrator nothing either")

    ok(S.visible_modules(None) == [], "no user, no modules")
    ok(S.may_open(None, "home") is False, "and may_open agrees")
finally:
    S.query = orig_query

# ---- the dependencies --------------------------------------------------
print("\n-- dependencies")
p = with_env(CP_SECURITY="on")
orig_su = S._session_user
try:
    S._session_user = lambda request: None
    try:
        S.require_user(Req())
        ok(False, "require_user must refuse an anonymous request")
    except HTTPException as e:
        ok(e.status_code == 401, "no session -> 401", e.status_code)

    S._session_user = lambda request: {"user_id": "ANA", "is_admin": False,
                                       "display_name": "Ana"}
    ok(S.require_user(Req())["user_id"] == "ANA", "a live session resolves")

    orig_audit = S.audit
    S.audit = lambda *a, **k: None
    try:
        try:
            S.require_admin(Req())
            ok(False, "require_admin must refuse a non-administrator")
        except HTTPException as e:
            ok(e.status_code == 403, "not an admin -> 403", e.status_code)

        S.query = fake_query([{"module_key": "home"}])
        dep = S.require_module("lineage")
        try:
            dep(Req())
            ok(False, "require_module must refuse an ungranted module")
        except HTTPException as e:
            ok(e.status_code == 403, "ungranted module -> 403", e.status_code)
        ok(S.require_module("home")(Req())["user_id"] == "ANA",
           "and allows a granted one")
    finally:
        S.audit = orig_audit
        S.query = orig_query
finally:
    S._session_user = orig_su
    restore(p)

# ---- with enforcement off, nothing blocks and everything says so -------
print("\n-- off")
p = with_env(CP_SECURITY=None)
ok(S.current_user(Req()).get("insecure") is True,
   "the open identity is flagged insecure")
ok(S.current_user(Req())["is_admin"] is True,
   "and is an administrator, so the entitlement screen can be reached")
ok(S.require_user(Req()) is not None, "require_user does not block")
ok(S.require_admin(Req()) is not None, "require_admin does not block")
restore(p)

# ---- the token is never the thing that is stored -----------------------
print("\n-- tokens")
h = S._hash("a-token")
ok(len(h) == 64 and h != "a-token", "a token is stored as its SHA-256", h)
ok(S._hash("a-token") == h, "and the hash is stable")
ok(S._hash("a-token ") != h, "a different token hashes differently")

# ---- a plaintext bind is refused unless somebody says otherwise --------
print("\n-- AD transport")
p = with_env(CP_AD_HOST="dc01.bbh.com", CP_AD_USE_SSL="0",
             CP_AD_ALLOW_INSECURE=None)
try:
    S.authenticate("ana", "pw")
    ok(False, "a plaintext bind must be refused by default")
except S.AdUnavailable as e:
    ok("plaintext" in str(e), "a plaintext bind is refused by default", str(e))
except PermissionError:
    ok(False, "refused for the wrong reason")
restore(p)

p = with_env(CP_AD_HOST=None)
try:
    S.authenticate("ana", "pw")
    ok(False, "no CP_AD_HOST must not be a successful login")
except S.AdUnavailable:
    ok(True, "no configured directory is an outage, not a pass")
restore(p)

print(f"\n{BAD} assertion(s) failed" if BAD else "\nsecurity assertions pass")
sys.exit(1 if BAD else 0)
