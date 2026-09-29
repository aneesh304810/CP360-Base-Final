"""The routes, against a fake catalogue.

WHAT IS WORTH TESTING HERE is not that FastAPI routes -- it is the three
places where the endpoint logic could be wrong in a way that reads as
correct:

  * LOGIN MUST NOT DISTINGUISH. A wrong password and an unreachable
    directory are different problems for the operator and the same 401
    for the caller. If they ever diverge, the login form becomes a way to
    enumerate valid accounts.
  * SAVE IS A REPLACE. The screen is a set of tick boxes and Save means
    "this is the answer now". The diff it derives has to be exactly
    (ticked - held) and (held - ticked); anything else writes a state the
    administrator did not choose.
  * THE LAST ADMINISTRATOR MUST NOT BE ABLE TO LOCK THE DOOR. Demoting or
    disabling yourself puts the entitlement screen behind a database
    edit.

There is no httpx in this environment, so the route functions are called
directly with a stand-in request. That is the same code path FastAPI
would take once it has parsed the body, which is the part worth
asserting.

    python api/test/test_security_api.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import HTTPException                             # noqa: E402

from api.app import security as S                             # noqa: E402
from api.app import routers_security as R                     # noqa: E402

BAD = 0


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


# ---------------------------------------------------------------- fakes
class Req:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}
        self.headers = {"user-agent": "test"}
        self.client = None


class Resp:
    def __init__(self):
        self.cookies = {}
        self.deleted = []

    def set_cookie(self, k, v, **kw):
        self.cookies[k] = (v, kw)

    def delete_cookie(self, k, **kw):
        self.deleted.append(k)


MODULES = ["home", "data", "lineage", "variance", "security"]


class Store:
    """Just enough Oracle to run the routes."""

    def __init__(self):
        self.users = {}          # user_id -> dict
        self.grants = set()      # (user_id, module_key)
        self.sessions = []
        self.audit = []

    # -- reads
    def query(self, sql, p=None):
        p = p or {}
        low = " ".join(sql.lower().split())
        u = p.get("u")
        if "from sec_module" in low and "union" in low:
            out = [{"module_key": "home"}]
            out += [{"module_key": m} for (usr, m) in sorted(self.grants)
                    if usr == u and m != "home"]
            return out
        if "count(*)" in low and "from sec_user" in low and "is_admin" in low:
            return [{"n": sum(1 for x in self.users.values()
                              if x["is_admin"] == "Y" and x["status"] == "ACTIVE")}]
        if low.startswith("select count(*)"):
            return [{"n": 0}]
        if "from sec_module" in low and "order by sort_order" in low:
            return [{"module_key": m, "module_name": m, "nav_group": "G",
                     "description": "", "open_to_all": "Y" if m == "home" else "N",
                     "sort_order": MODULES.index(m)} for m in MODULES]
        if "from sec_module" in low:
            return [{"module_key": m} for m in MODULES]
        if "from sec_grant" in low:
            return [{"module_key": m, "granted_by": "X", "granted_on": None,
                     "note": None} for (usr, m) in sorted(self.grants) if usr == u]
        if "from sec_user" in low:
            if u is not None:
                r = self.users.get(u)
                return [dict(r)] if r else []
            return [dict(v) for v in self.users.values()]
        if "from sec_audit" in low:
            return list(reversed(self.audit))
        return []

    # -- writes
    def execute(self, statements):
        for sql, p in statements:
            p = p or {}
            low = " ".join(sql.lower().split())
            if "merge into sec_user" in low:
                uid = p["u"]
                row = self.users.setdefault(uid, {
                    "user_id": uid, "display_name": uid, "email": None,
                    "status": "ACTIVE", "is_admin": "N",
                    "first_seen": None, "last_login": None})
                if p.get("d"):
                    row["display_name"] = p["d"]
                if p.get("e"):
                    row["email"] = p["e"]
                if "st" in p:
                    row["status"] = p["st"]
                if "ia" in p:
                    row["is_admin"] = p["ia"]
            elif "insert into sec_grant" in low:
                self.grants.add((p["u"], p["m"]))
            elif "delete from sec_grant" in low:
                self.grants.discard((p["u"], p["m"]))
            elif "insert into sec_audit" in low:
                self.audit.append({"at_ts": None, "actor": p["a"],
                                   "action": p["ac"], "target_user": p["t"],
                                   "module_key": p["m"], "outcome": p["o"],
                                   "detail": p["d"], "client_ip": p["ip"]})
            elif "insert into sec_session" in low:
                self.sessions.append(dict(p))
            elif "update sec_session" in low:
                pass


def install(store):
    S.query = store.query
    S.execute = store.execute
    R.query = store.query


ORIG = (S.query, S.execute, R.query)


def env_on():
    os.environ["CP_SECURITY"] = "on"


def env_off():
    os.environ.pop("CP_SECURITY", None)


# ---------------------------------------------------------- /auth/me off
print("\n-- /auth/me with enforcement off")
env_off()
st = Store(); install(st)
me = R.auth_me(Req())
ok(me["mode"] == "off", "mode is reported", me["mode"])
ok(me["modules"] is None,
   "modules is null -- the sidebar must not be filtered", me["modules"])
ok(me["authenticated"] is True and me["insecure"] is True,
   "the open identity is authenticated but flagged insecure", me)
ok(me["is_admin"] is True,
   "and is an administrator, so the entitlement screen is reachable")

# --------------------------------------------------------- /auth/me on
print("\n-- /auth/me with enforcement on, nobody signed in")
env_on()
me = R.auth_me(Req())
ok(me["authenticated"] is False, "not authenticated")
ok(me["modules"] == [],
   "modules is [] -- a real answer, and [] is not null", me["modules"])

# ------------------------------------------------------------- login
print("\n-- login")
st = Store(); install(st)
orig_auth = S.authenticate

S.authenticate = lambda u, p: (_ for _ in ()).throw(PermissionError("nope"))
try:
    R.auth_login(Req(), Resp(), {"username": "ana", "password": "wrong"})
    ok(False, "a wrong password must not sign anybody in")
except HTTPException as e:
    ok(e.status_code == 401, "wrong password -> 401", e.status_code)
    bad_detail = e.detail

S.authenticate = lambda u, p: (_ for _ in ()).throw(S.AdUnavailable("dc down"))
try:
    R.auth_login(Req(), Resp(), {"username": "ana", "password": "right"})
    ok(False, "an unreachable directory must fail closed")
except HTTPException as e:
    ok(e.status_code == 401, "directory down -> 401 too", e.status_code)
    down_detail = e.detail

ok("dc down" not in str(down_detail) and "nope" not in str(bad_detail),
   "neither message leaks what the server actually saw",
   [bad_detail, down_detail])
actions = [(a["action"], a["outcome"], a["detail"]) for a in st.audit]
ok([a[1] for a in actions] == ["DENIED", "ERROR"],
   "but the audit trail keeps them apart", actions)

S.authenticate = lambda u, p: {"user_id": "ANA", "display_name": "Ana Nair",
                               "email": "ana@bbh.com"}
resp = Resp()
me = R.auth_login(Req(), resp, {"username": "bbh\\Ana", "password": "right"})
ok(me["authenticated"] is True, "a good password signs in")
ok(me["user"]["user_id"] == "ANA", "under one normalised account name",
   me["user"]["user_id"])
ok(me["modules"] == ["home"],
   "a brand new person gets the landing page and nothing else", me["modules"])
ok(me["is_admin"] is False, "and is not an administrator")
ok(S.COOKIE in resp.cookies, "the cookie is set", list(resp.cookies))
_, kw = resp.cookies[S.COOKIE]
ok(kw.get("httponly") is True, "HttpOnly", kw)
ok(kw.get("samesite") == "lax", "SameSite=lax", kw)
ok(kw.get("secure") is True, "Secure (no CP_COOKIE_INSECURE)", kw)
raw = resp.cookies[S.COOKIE][0]
ok(st.sessions and st.sessions[0]["h"] != raw,
   "and what was stored is not the token", st.sessions[0]["h"][:12])
ok(st.sessions[0]["h"] == S._hash(raw), "it is its SHA-256")

# a disabled account is refused even though AD said yes
st.users["ANA"]["status"] = "DISABLED"
try:
    R.auth_login(Req(), Resp(), {"username": "ana", "password": "right"})
    ok(False, "a disabled account must not sign in")
except HTTPException as e:
    ok(e.status_code == 403, "disabled in CP 360 -> 403", e.status_code)
st.users["ANA"]["status"] = "ACTIVE"
S.authenticate = orig_auth

# ------------------------------------------------------------- grants
print("\n-- saving grants")
st.users["ADM"] = {"user_id": "ADM", "display_name": "Adm", "email": None,
                   "status": "ACTIVE", "is_admin": "Y",
                   "first_seen": None, "last_login": None}
orig_su = S._session_user
S._session_user = lambda request: {"user_id": "ADM", "is_admin": True,
                                   "display_name": "Adm"}

st.grants = {("ANA", "data"), ("ANA", "lineage")}
st.audit.clear()
out = R.security_grants(Req(), {"user_id": "ana",
                                "modules": ["data", "variance"]})
ok(out["granted"] == ["variance"], "only the newly ticked are granted",
   out["granted"])
ok(out["revoked"] == ["lineage"], "only the newly unticked are revoked",
   out["revoked"])
ok(st.grants == {("ANA", "data"), ("ANA", "variance")},
   "and the stored set is exactly what was ticked", sorted(st.grants))
ok(sorted(a["action"] for a in st.audit) == ["GRANT", "REVOKE"],
   "one audit row per change, and none for the unchanged module",
   [a["action"] for a in st.audit])

st.audit.clear()
out = R.security_grants(Req(), {"user_id": "ANA",
                                "modules": ["data", "variance"]})
ok(out["granted"] == [] and out["revoked"] == [],
   "saving the same set again is a no-op", out)
ok(st.audit == [], "and writes no audit rows", st.audit)

out = R.security_grants(Req(), {"user_id": "ANA", "modules": []})
ok(st.grants == set(), "an empty list revokes everything", sorted(st.grants))

try:
    R.security_grants(Req(), {"user_id": "ANA", "modules": ["data", "nosuch"]})
    ok(False, "an unknown module key must be refused")
except HTTPException as e:
    ok(e.status_code == 400 and "nosuch" in e.detail,
       "an unknown module is refused by name -- storing it would be a grant "
       "that silently does nothing", e.detail)
ok(st.grants == set(), "and nothing was written by the refused call",
   sorted(st.grants))

try:
    R.security_grants(Req(), {"user_id": "GHOST", "modules": ["data"]})
    ok(False, "granting to somebody who does not exist must be refused")
except HTTPException as e:
    ok(e.status_code == 404, "unknown user -> 404", e.status_code)

# ------------------------------------------------- the last administrator
print("\n-- self-demotion")
for patch, what in [({"is_admin": False}, "remove your own admin rights"),
                    ({"status": "DISABLED"}, "disable your own account")]:
    try:
        R.security_user_upsert(Req(), {"user_id": "adm", **patch})
        ok(False, f"must not be able to {what}")
    except HTTPException as e:
        ok(e.status_code == 400, f"refused: {what}", e.status_code)
ok(st.users["ADM"]["is_admin"] == "Y" and st.users["ADM"]["status"] == "ACTIVE",
   "and the administrator is untouched", st.users["ADM"])

# somebody else can still be promoted and demoted
R.security_user_upsert(Req(), {"user_id": "ana", "is_admin": True})
ok(st.users["ANA"]["is_admin"] == "Y", "another user can be promoted")
R.security_user_upsert(Req(), {"user_id": "ana", "is_admin": False})
ok(st.users["ANA"]["is_admin"] == "N", "and demoted")

# adding somebody grants nothing
R.security_user_upsert(Req(), {"user_id": "new.joiner", "display_name": "New"})
ok("NEW.JOINER" in st.users, "a person can be added before their first login")
ok(st.users["NEW.JOINER"]["is_admin"] == "N"
   and st.users["NEW.JOINER"]["status"] == "ACTIVE",
   "as an active non-administrator", st.users["NEW.JOINER"])
ok(not [g for g in st.grants if g[0] == "NEW.JOINER"],
   "with no modules -- adding is not granting", sorted(st.grants))

# a partial update must not silently reset the fields it did not mention
st.users["NEW.JOINER"]["is_admin"] = "Y"
R.security_user_upsert(Req(), {"user_id": "new.joiner", "display_name": "Newer"})
ok(st.users["NEW.JOINER"]["is_admin"] == "Y",
   "an update that does not mention is_admin leaves it alone",
   st.users["NEW.JOINER"])

# ---- a non-administrator cannot reach any of it ------------------------
print("\n-- non-administrators")
S._session_user = lambda request: {"user_id": "ANA", "is_admin": False,
                                   "display_name": "Ana"}
orig_audit = S.audit
S.audit = lambda *a, **k: None
for name, call in [("users", lambda: R.security_users(Req())),
                   ("modules", lambda: R.security_modules(Req())),
                   ("user", lambda: R.security_user("ANA", Req())),
                   ("grants", lambda: R.security_grants(
                       Req(), {"user_id": "ANA", "modules": []})),
                   ("upsert", lambda: R.security_user_upsert(
                       Req(), {"user_id": "ANA"})),
                   ("audit", lambda: R.security_audit(Req()))]:
    try:
        call()
        ok(False, f"/security/{name} must refuse a non-administrator")
    except HTTPException as e:
        ok(e.status_code == 403, f"/security/{name} -> 403", e.status_code)
S.audit = orig_audit
S._session_user = orig_su

# ---- health reports posture and nothing else ---------------------------
print("\n-- /security/health")
h = R.security_health()
ok(h["enforcing"] is True and h["mode"] == "on", "posture is reported", h["mode"])
leaky = [k for k in h if k in ("users_list", "grants", "modules_list")]
ok(not leaky, "no content in the payload", leaky)
ok(isinstance(h.get("modules"), int), "modules is a count, not a list",
   h.get("modules"))
env_off()
ok(R.security_health().get("warning", "").startswith("CP_SECURITY is not"),
   "and with enforcement off it says so", R.security_health().get("warning"))

S.query, S.execute, R.query = ORIG
print(f"\n{BAD} assertion(s) failed" if BAD else "\nsecurity-api assertions pass")
sys.exit(1 if BAD else 0)
