"""The sanitiser, hit with payloads rather than read.

Every case below is a way an SVG has actually been used to run script or
fetch a resource. A test that asserts "the word script does not appear in
the source" would pass against a sanitiser that does nothing, so each of
these runs the function and inspects what comes back.
"""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.svg_sanitize import sanitize_svg, ELEMENTS, ATTRS  # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:200]}"))
    if not cond:
        BAD += 1


def wrap(inner, attrs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"{attrs}>'
            f"{inner}</svg>")


# ---- it must not break a real diagram -------------------------------
real = wrap('<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/>'
            '</linearGradient></defs>'
            '<g transform="translate(2,2)"><rect width="6" height="6" fill="url(#g)" '
            'stroke="#333" stroke-width="1.5" rx="2"/>'
            '<text x="3" y="4" font-size="3" text-anchor="middle">hi</text></g>')
out, note = sanitize_svg(real)
ok(out is not None and note == "clean", "a real diagram passes through untouched", note)
for frag in ("linearGradient", "stop-color", 'fill="url(#g)"', "text-anchor",
             "transform", "rx"):
    ok(frag in out, f"  and keeps {frag}", out)

# ---- script in every shape it comes in ------------------------------
cases = [
    ("<script> element", wrap('<script>alert(1)</script><rect width="1" height="1"/>'),
     "alert"),
    ("onload on the root", wrap("<rect/>", ' onload="alert(1)"'), "onload"),
    ("onclick on a shape", wrap('<rect onclick="alert(1)" width="1" height="1"/>'),
     "onclick"),
    ("onerror on an image", wrap('<image onerror="alert(1)" href="#a"/>'), "onerror"),
    ("mixed-case OnLoad", wrap("<rect/>", ' OnLoad="alert(1)"'), "alert"),
    # Well-formed on purpose: malformed XML is refused by the parser, which
    # proves nothing about whether foreignObject is allowed through.
    ("foreignObject with html", wrap('<foreignObject width="1" height="1">'
                                     '<div xmlns="http://www.w3.org/1999/xhtml">'
                                     '<img src="x" onerror="alert(1)" /></div>'
                                     "</foreignObject>"), "onerror"),
    ("an <a> with javascript:", wrap('<a href="javascript:alert(1)"><rect/></a>'),
     "javascript:"),
    ("<animate> retargeting href", wrap('<animate attributeName="href" to="javascript:alert(1)"/>'),
     "javascript:"),
    ("<set> retargeting href", wrap('<set attributeName="href" to="javascript:alert(1)"/>'),
     "javascript:"),
    ("<handler>", wrap('<handler type="text/javascript">alert(1)</handler>'), "alert"),
    ("<iframe>", wrap('<iframe src="https://evil.example/x"/>'), "iframe"),
]
for name, payload, needle in cases:
    out, note = sanitize_svg(payload)
    ok(out is not None, f"{name}: still returns a usable svg", note)
    ok(out is not None and needle.lower() not in out.lower(),
       f"{name}: {needle} is gone", out)
    ok(note != "clean", f"{name}: and the removal is reported", note)

# The dangerous elements are absent from the OUTPUT, not merely defused
# by their children being filtered. foreignObject passed the check above
# even when it was allowlisted, because its HTML children were dropped
# anyway -- true, but not what that case claims to prove.
for tag in ("script", "foreignObject", "iframe", "handler", "animate", "set"):
    payload = wrap(f'<{tag} width="1" height="1"><rect/></{tag}>')
    out, _ = sanitize_svg(payload)
    ok(out is not None and f"<{tag}".lower() not in out.lower(),
       f"<{tag}> itself is absent from the output", out)
out, _ = sanitize_svg(wrap('<a href="#x"><rect width="1" height="1"/></a>'))
ok("<a " not in out and "<a>" not in out,
   "<a> is dropped even with a harmless href — a link out of a diagram in "
   "a review tool is not worth the attack surface", out)

# The allowlists themselves. These are the invariant: the filtering above
# is only as good as what is named here, and an entry added in haste is
# how a sanitiser quietly stops sanitising.
ok(not any(a.lower().startswith("on") for a in ATTRS),
   "no attribute beginning with 'on' is allowlisted — this is what stops a "
   "handler being admitted by someone extending the list",
   [a for a in ATTRS if a.lower().startswith("on")])
for forbidden in ("script", "foreignObject", "a", "iframe", "embed", "object",
                  "animate", "animateTransform", "set", "handler"):
    ok(forbidden not in ELEMENTS, f"<{forbidden}> is not allowlisted", "")
ok(not any(a.lower() in ("href", "xlink:href", "src", "formaction") for a in ATTRS),
   "and no attribute that names a target is allowlisted — href is handled "
   "separately and strictly", [a for a in ATTRS if "href" in a.lower()])

# ---- references that leave the document -----------------------------
ext = [
    ("external <use>", wrap('<use href="https://evil.example/x.svg#a"/>')),
    ("external xlink:href", wrap('<use xmlns:xlink="http://www.w3.org/1999/xlink" '
                                 'xlink:href="https://evil.example/x.svg#a"/>')),
    ("remote <image>", wrap('<image href="https://evil.example/pixel.png" width="1" height="1"/>')),
    ("protocol-relative", wrap('<image href="//evil.example/p.png" width="1" height="1"/>')),
    ("data:text/html", wrap('<image href="data:text/html;base64,PHNjcmlwdD4=" width="1" height="1"/>')),
]
for name, payload in ext:
    out, note = sanitize_svg(payload)
    ok(out is not None and "evil.example" not in out and "text/html" not in out,
       f"{name} is removed — rendering it is a fetch on someone else's page", out)

# A local reference and an inline image are legitimate and must survive.
out, _ = sanitize_svg(wrap('<defs><rect id="a" width="1" height="1"/></defs><use href="#a"/>'))
ok('href="#a"' in out, "but a local #fragment reference survives", out)
png = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
       "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
out, _ = sanitize_svg(wrap(f'<image href="{png}" width="1" height="1"/>'))
ok("data:image/png;base64" in out, "and an inline raster survives", out[:120])

# ---- CSS, which fetches and used to execute -------------------------
css = [
    ("@import", wrap('<style>@import url("https://evil.example/x.css");</style><rect/>')),
    ("url() to a host", wrap('<style>rect{fill:url(https://evil.example/x)}</style><rect/>')),
    ("expression()", wrap('<style>rect{width:expression(alert(1))}</style><rect/>')),
    ("style attribute url()", wrap('<rect style="fill:url(https://evil.example/x)" width="1" height="1"/>')),
    ("style attribute javascript:", wrap('<rect style="background:url(javascript:alert(1))" width="1" height="1"/>')),
]
for name, payload in css:
    out, note = sanitize_svg(payload)
    ok(out is not None and "evil.example" not in out
       and "expression(" not in out and "javascript:" not in out,
       f"css {name} is removed", out)
out, _ = sanitize_svg(wrap('<style>rect{fill:#f00}</style><rect width="1" height="1"/>'))
ok("#f00" in out, "but ordinary css survives — dropping all of it breaks "
   "every draw.io export", out)
out, _ = sanitize_svg(wrap('<rect style="fill:url(#g)" width="1" height="1"/>'))
ok("url(#g)" in out, "and url(#local) survives, which gradients depend on", out)

# ---- the parser itself as the target --------------------------------
xxe = ('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
       '<svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>')
out, note = sanitize_svg(xxe)
ok(out is None and "DOCTYPE" in note,
   "an external entity is refused outright, not parsed and filtered", note)
bomb = ('<!DOCTYPE x [<!ENTITY a "AAAAAAAAAA"><!ENTITY b "&a;&a;&a;&a;&a;">]>'
        '<svg xmlns="http://www.w3.org/2000/svg"><text>&b;</text></svg>')
out, note = sanitize_svg(bomb)
ok(out is None, "and so is an entity-expansion bomb", note)

ok(sanitize_svg("<html><body>hi</body></html>")[0] is None,
   "a non-svg root is refused", sanitize_svg("<html/>")[1])
ok(sanitize_svg("<svg><rect")[0] is None, "so is malformed xml", "")
ok(sanitize_svg("")[0] is None, "and empty input", "")
big = wrap("<rect/>" * 400000)
ok(sanitize_svg(big)[0] is None, "and anything over the size cap", len(big))

# ---- the result is stable -------------------------------------------
once, _ = sanitize_svg(real)
twice, _ = sanitize_svg(once)
ok(once == twice, "sanitising twice changes nothing — the output is valid input",
   once[:80] + " || " + twice[:80])

print()
print(f"{BAD} assertion(s) failed" if BAD else "svg sanitizer assertions pass")
sys.exit(1 if BAD else 0)
