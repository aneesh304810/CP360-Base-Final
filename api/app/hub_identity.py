"""Who is accepting, as far as the server can actually tell.

WHAT A BROWSER CANNOT GIVE YOU. JavaScript cannot read the machine name
or the Windows LAN ID. There is no API for it and there is not going to
be one -- a page you visit must not be able to enumerate your domain
account. So none of this comes from the client, and anything the client
sends about its own identity is ignored.

WHAT THE SERVER CAN SEE, in the order it is trusted:

  1. The signed-in user, when sign-in is enforced. This is the real
     answer and everything else is a substitute for it.
  2. A header set by the reverse proxy, when one is configured. In an
     estate with SSO at the edge the proxy knows the LAN ID and passes
     it on. This is OFF unless HUB_USER_HEADER names the header,
     because a header is only evidence if something trustworthy set it:
     if the API can be reached directly, anyone can send one.
  3. Nothing. The screen then asks the person to pick their name and
     says plainly that it is self-declared.

The client IP is always recorded. The machine name is reverse DNS on
that IP, which on a corporate LAN usually resolves and elsewhere
usually does not -- it is OFF unless HUB_REVERSE_DNS is set, because a
blocking DNS lookup on a request path is a bad trade for a nice-to-have.
"""
from __future__ import annotations
import ipaddress
import os
import socket

MAX = 120
_dns_cache: dict[str, str | None] = {}


def _clean(v, n=MAX):
    s = str(v or "").strip()
    return s[:n] if s else None


def client_ip(request) -> str | None:
    """The caller's address, preferring what the proxy says it was."""
    fwd = request.headers.get("x-forwarded-for")
    raw = fwd.split(",")[0].strip() if fwd else (
        request.client.host if request.client else None)
    if not raw:
        return None
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return None


def machine_name(ip: str | None) -> str | None:
    """Reverse DNS, opt-in and cached. None when it cannot be resolved."""
    if not ip or not os.getenv("HUB_REVERSE_DNS"):
        return None
    if ip in _dns_cache:
        return _dns_cache[ip]
    name = None
    try:
        socket.setdefaulttimeout(1.0)
        name = _clean(socket.gethostbyaddr(ip)[0])
    except Exception:                                         # noqa: BLE001
        name = None
    finally:
        socket.setdefaulttimeout(None)
    _dns_cache[ip] = name
    return name


def lan_id(request) -> tuple[str | None, str]:
    """(id, where it came from). Source is 'session', 'proxy' or 'none'."""
    try:
        from .security import current_user
        u = current_user(request)
        if u and not u.get("insecure") and u.get("user_id"):
            return _clean(u["user_id"], 60), "session"
    except Exception:                                         # noqa: BLE001
        pass

    header = os.getenv("HUB_USER_HEADER")
    if header:
        v = _clean(request.headers.get(header), 60)
        if v:
            # Strip DOMAIN\\user and user@domain down to the account.
            v = v.split("\\")[-1].split("@")[0]
            return _clean(v, 60), "proxy"
    return None, "none"


def whoami(request) -> dict:
    uid, source = lan_id(request)
    ip = client_ip(request)
    return {
        "lanId": uid,
        "source": source,
        "host": machine_name(ip),
        "ip": ip,
        # False means the screen must ask who this is and say the answer
        # is self-declared. True means the server already knows.
        "verified": source in ("session", "proxy"),
    }
