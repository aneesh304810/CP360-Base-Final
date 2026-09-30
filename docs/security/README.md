# Security — AD sign-in, CP 360 entitlement

**Active Directory answers "who is this". CP 360 answers "what may they
see".** Neither does the other's job: CP 360 never stores a password and
never writes to the directory, and AD has no say in which modules
somebody can open.

**It ships off.** `local/.env` carries `CP_SECURITY=off`, and with it off
the app behaves exactly as it did before this module existed — no login
screen, the full sidebar, every endpoint open. That is deliberate: an
authentication control that switches itself on during a deployment is an
outage, not a security posture. It is also never quiet — see
[Is it on?](#is-it-on) below.

**The one line that changes it** is in `local/.env` (copy it from
`local/.env.example` if you have not), or in `local/load-all.ps1` if that
is how you set your environment -- both carry it:

```ini
CP_SECURITY=off     # -> on, once the three steps below are done
```

Read the rest of this page before flipping it: with `on` and no seeded
administrator, nobody can reach the entitlement screen through the app.

---

## Install it

### 1. Schema

```sql
@sql/64_security.sql
```

Creates five tables and seeds the module list from the sidebar. Re-run it whenever a new module is added to the sidebar — the module `MERGE` is idempotent and exists for that. Safe to
re-run: the DDL swallows ORA-00955 and the module seed is a `MERGE`.

| Table | Holds | Note |
|---|---|---|
| `sec_user` | the people | **no credential column, by design** |
| `sec_module` | the grantable units | seeded from the sidebar |
| `sec_grant` | one row per person per module | absence means deny |
| `sec_session` | live sessions | the token's **SHA-256 only** |
| `sec_audit` | every login, grant and revoke | insert-only |

### 2. The first administrator

Nothing is seeded automatically — an admin row that ships with the schema
is an admin row somebody forgets to remove. Edit and run the two
statements at the foot of `sql/64_security.sql`:

```sql
INSERT INTO sec_user (user_id, display_name, is_admin)
VALUES ('YOUR.AD.ACCOUNT', 'Your Name', 'Y');
COMMIT;
```

The account must already exist in AD. This grants entitlement; it does
not create a login.

### 3. Point at the directory

```bash
export CP_AD_HOST=dc01.bbh.com        # domain controller
export CP_AD_PORT=636                 # default 636
export CP_AD_USE_SSL=1                # default 1 — see below
export CP_AD_DOMAIN=bbh.com           # bind is <account>@<domain>
export CP_AD_BASE_DN="DC=bbh,DC=com"  # optional: display name + e-mail
```

`pip install ldap3` on the API host if it is not already there.

**A plaintext bind is refused.** `CP_AD_USE_SSL=0` puts the password on
the wire in clear text, so the login raises rather than attempting it.
`CP_AD_ALLOW_INSECURE=1` overrides that for a lab and nowhere else.

### 4. Turn it on

In `local/.env` (read by `local/start.ps1` and `local/start.sh`):

```ini
CP_SECURITY=on
```

Restart the API. The startup banner states the posture:

```
WARNING cp.api SECURITY: CP_SECURITY=on — AD sign-in required, directory dc01.bbh.com
```

**Exactly the string `on`.** Not truthiness: `0`, `false` and `no` are all
non-empty strings and a careless check would read every one of them as
true.

Anything the API does not recognise — `1`, `true`, `yes`, a typo — stays
**off** and says so, on the startup banner, in `/security/health` and in
the log:

```
WARNING cp.api SECURITY: CP_SECURITY='true' is not understood —
        enforcement is OFF. Use exactly 'on' to enforce.
```

Off is the safer answer to an unrecognised value in practice, even though
it is the less secure one: enforcing on a typo locks every user out of an
instance whose AD is not configured, with no way back in through the
browser. The shouting is what stops it being a silent failure.

### 5. If the UI is served from a different origin than the API

The session is a cookie, and a browser will not send a cookie
cross-origin unless the response says so — and the spec forbids saying so
alongside `*`. Name the UI's origin:

```bash
export CP_CORS_ORIGINS=http://localhost:5173
```

Skip this and sign-in appears to work, then every later request arrives
anonymous. Not needed when the UI and API are served from one origin
(the normal deployment).

---

## Is it on?

```
GET /security/health
```

Open on purpose — it reports posture, never content. No user name, module
or grant appears in the payload.

```json
{ "mode": "on", "enforcing": true, "ready": true,
  "admins": 1, "users": 14, "modules": 22, "ad_configured": true }
```

When enforcement is off it says so, and so does every other surface: the
API logs a warning every few minutes, `/auth/me` returns `mode: "off"`,
and the entitlement screen carries a red banner across the top. A setting
you can see on screen is not a setting somebody discovers during an
audit.

---

## Using it

**Admin · Security Entitlement** in the sidebar. One person at a time,
tick boxes, Save.

* Somebody appears in the list the **first time they sign in**, with no
  modules. That is the intended experience, not a bug report — an account
  showing up with zero grants is how you learn there is somebody waiting.
  Use **+ Add** to get ahead of it.
* **Save is explicit** and names what it will do (`grant 3, revoke 1`).
  Ticking changes nothing until you press it.
* **Disable** stops a sign-in and keeps the grants, so re-enabling a
  returning colleague is one click rather than rebuilding their access
  from memory. A leaver should be disabled here as well as in AD.
* **Administrator** is a flag, not a grant. An admin sees every module
  regardless of the ticks, and the ticks are kept — removing the flag
  leaves them with exactly what is checked. You cannot remove or disable
  your own administrator access; ask another administrator.
* `home` is `open_to_all` — everyone who can sign in sees the landing
  page. It keeps "grant everything to everyone" out of the grant table.

---

## How a request is decided

```
cookie ──► sec_session (by SHA-256)  ──► not found / expired / idle / revoked ──► 401
             │
             ▼
           sec_user.status                ──► DISABLED ──► 401
             │
             ▼
           is_admin = 'Y' ──► yes ──────────────────────────────► allow
             │ no
             ▼
           sec_module.open_to_all = 'Y'  ∪  sec_grant(user)
             │
             ▼
           module in that set? ── no ──► 403      ── yes ──► allow
```

`status` is read from the database on **every** request rather than baked
into the session, so disabling somebody takes effect on their next click
instead of whenever their session happens to expire.

Every branch that is not "allow" is reached by an early return, and every
early return denies. A database error inside the entitlement lookup
returns `[]`, not "everything" — including for an administrator.

---

## What this deliberately does not do

* **No password handling.** No reset, no unlock, no change. AD owns all of
  it and CP 360 cannot help.
* **No AD group mapping.** Grants are per person. "Why can Ana see
  Variance 360" is answered by one row, not by tracing four nested
  groups. The cost is a row per person per module, and it is the right
  trade at this size.
* **No deny rows.** Absence already means deny, and a system with both
  grant and deny rows has a precedence question somebody eventually gets
  wrong.
* **No writes to the directory.** A catalogue that can change AD has a
  much larger blast radius than a catalogue.

---

## The UI is not the control

`visible_modules` exists so the sidebar can hide what somebody cannot
open. That is courtesy. `require_module("<key>")` on the server is the
control:

```python
from .security import require_module

@router.get("/variance/summary")
def summary(user = Depends(require_module("variance"))):
    ...
```

Anything enforced only in React is enforced only until somebody opens the
network tab. The existing routers are **not** wired to `require_module`
yet — that is a per-router change and is listed below.

---

## Environment reference

| Variable | Default | Meaning |
|---|---|---|
| `CP_SECURITY` | `off` in `local/.env` | `on` enforces. Anything else does not, and an unrecognised value is reported at startup. |
| `CP_AD_HOST` | — | Domain controller. Required when enforcing. |
| `CP_AD_PORT` | `636` | |
| `CP_AD_USE_SSL` | `1` | `0` needs `CP_AD_ALLOW_INSECURE=1` |
| `CP_AD_ALLOW_INSECURE` | *(unset)* | `1` permits a plaintext bind. Labs only. |
| `CP_AD_DOMAIN` | — | Bind is `<account>@<domain>` |
| `CP_AD_BASE_DN` | *(unset)* | Optional display-name / e-mail lookup |
| `CP_AD_TIMEOUT` | `8` | Seconds to connect |
| `CP_SESSION_HOURS` | `10` | Session lifetime |
| `CP_SESSION_IDLE_MINUTES` | `120` | Idle timeout |
| `CP_COOKIE_INSECURE` | *(unset)* | `1` drops the `Secure` flag. HTTP dev only. |
| `CP_CORS_ORIGINS` | *(unset)* | Comma list. Required for a split-origin UI. |
| `CP_SECURITY_OPEN_USER` | `local.user` | Identity used while enforcement is off |

---

## Endpoints

| Route | Who | |
|---|---|---|
| `GET /auth/me` | anyone | **never 401s** — it is what the UI asks to find out whether to show a login screen |
| `POST /auth/login` | anyone | binds to AD, issues the session |
| `POST /auth/logout` | anyone | revokes it |
| `GET /security/health` | anyone | posture only, no content |
| `GET /security/modules` | admin | the grantable units |
| `GET /security/users` | admin | everyone, with grant counts |
| `GET /security/user/{id}` | admin | one person and their grants |
| `POST /security/user` | admin | add somebody, or change standing |
| `POST /security/grants` | admin | set one person's modules to exactly this list |
| `GET /security/audit` | admin | the trail |

Wrong password and unreachable directory are recorded separately in
`sec_audit` and returned **identically as 401**. Which of the two it was
is an operational fact, not something an unauthenticated caller is owed —
telling them apart lets somebody probe for valid accounts.

---

## Tests

```
python api/test/test_security.py     # mode switch, normalisation, fail-closed
node   ui/test/run.mjs               # security-nav.test.jsx
```

Every assertion in `test_security.py` guards a bug that would **fail
open** — the kind that makes the app work, so nobody reports it, and that
turns up in an audit instead.

---

## Not done yet

* **`require_module` is not wired to the existing routers.** The
  entitlement is enforced on the navigation and on `/security/*`; the
  data endpoints themselves are still open to any signed-in user. Each
  router needs its `Depends(require_module("<key>"))` added, one line
  each, and that is a change worth reviewing per module rather than
  applying in bulk.
* **Expired sessions are not reaped.** `sec_session` grows. A nightly
  `DELETE FROM sec_session WHERE expires_at < SYSDATE - 7` is enough.
* **No "sign in as" for support.** Impersonation is genuinely useful and
  genuinely dangerous; it should not be added without a decision about
  how it appears in `sec_audit`.
