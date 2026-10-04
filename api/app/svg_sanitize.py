"""Make an uploaded SVG safe to render inline.

AN SVG IS A DOCUMENT, NOT A PICTURE. It can carry <script>, event
handlers, <foreignObject> full of HTML, external <use> and <image>
references, and CSS that fetches. Dropping one into a page unfiltered is
cross-site scripting with extra steps, and "it came from a colleague" is
not a control -- the colleague exported it from a tool, and the tool put
in whatever it liked.

ALLOWLIST, NEVER BLOCKLIST. A blocklist is a list of the attacks someone
thought of. Everything not named here is removed, and what was removed is
reported so a diagram that renders oddly can be explained rather than
guessed at.

PURE. No database, no framework, no I/O -- it takes text and returns
text, so the tests can hit it with real payloads instead of asserting
that a string appears in the source.
"""
from __future__ import annotations
import re
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
MAX_BYTES = 2_000_000

# Drawing only. No <script>, no <foreignObject>, no <a>, no <iframe>,
# no <animate>/<set> (they can retarget href at runtime).
ELEMENTS = {
    "svg", "g", "defs", "title", "desc", "metadata", "symbol", "use",
    "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath",
    "marker", "clipPath", "mask", "pattern", "filter",
    "linearGradient", "radialGradient", "stop",
    "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feMerge",
    "feMergeNode", "feFlood", "feComposite", "feDropShadow",
    "image", "style",
}

# Geometry, presentation and layout. Nothing that names a target, loads a
# resource or runs on an event -- href is handled separately and strictly.
ATTRS = {
    "id", "class", "transform", "viewBox", "preserveAspectRatio",
    "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
    "dx", "dy", "width", "height", "d", "points", "offset",
    "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
    "stroke-opacity", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
    "opacity", "color", "visibility", "display", "overflow",
    "font-family", "font-size", "font-weight", "font-style", "font-stretch",
    "text-anchor", "dominant-baseline", "alignment-baseline",
    "letter-spacing", "word-spacing", "white-space", "writing-mode",
    "gradientUnits", "gradientTransform", "spreadMethod",
    "stop-color", "stop-opacity", "offset",
    "patternUnits", "patternContentUnits", "patternTransform",
    "markerWidth", "markerHeight", "refX", "refY", "orient", "markerUnits",
    "clip-path", "clip-rule", "mask", "filter",
    "maskUnits", "maskContentUnits", "clipPathUnits", "filterUnits",
    "stdDeviation", "in", "in2", "result", "mode", "type", "values",
    "flood-color", "flood-opacity", "operator", "k1", "k2", "k3", "k4",
    "style", "xml:space", "version", "baseProfile",
}

# A reference may point inside this document, or be an inline image. It
# may never point out: an external href is a fetch on render, which is a
# tracking pixel at best.
_DATA_IMG = re.compile(r"^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$", re.I)
_FRAGMENT = re.compile(r"^#[A-Za-z_][\w.:-]*$")

# In a style attribute or a <style> block: url(#id) is a local reference
# and fine; anything else fetches or executes.
_BAD_CSS = re.compile(r"@import|expression\s*\(|javascript\s*:|behavior\s*:|"
                      r"url\s*\(\s*(?![\"']?#)", re.I)


def _local(tag) -> str:
    if not isinstance(tag, str):
        return ""                      # comments and PIs have callable tags
    return tag.split("}", 1)[1] if tag.startswith("{") else tag


def _attr_name(k: str) -> str:
    if k.startswith(f"{{{XLINK_NS}}}"):
        return "xlink:" + k.split("}", 1)[1]
    if k.startswith("{"):
        return k.split("}", 1)[1]
    return k


def _href_ok(v: str) -> bool:
    v = (v or "").strip()
    return bool(_FRAGMENT.match(v) or _DATA_IMG.match(v.replace("\n", "")))


def sanitize_svg(text: str):
    """Return (clean_svg_or_None, note).

    note says what was removed, or why nothing could be. A None result
    means the input was not usable as an SVG at all.
    """
    if not text or not text.strip():
        return None, "empty"
    if len(text) > MAX_BYTES:
        return None, f"larger than {MAX_BYTES // 1000}kB"
    # No legitimate exported SVG needs a doctype or an entity, and both
    # are how an XML parser is turned into a file reader or a bomb.
    if re.search(r"<!DOCTYPE|<!ENTITY", text, re.I):
        return None, "contains a DOCTYPE or ENTITY declaration"

    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        return None, f"not well-formed XML ({str(e)[:60]})"
    if _local(root.tag) != "svg":
        return None, f"root element is <{_local(root.tag)}>, not <svg>"

    removed: set[str] = set()

    def walk(el):
        for child in list(el):
            name = _local(child.tag)
            if not name:                       # comment / processing instruction
                el.remove(child)
                removed.add("comment")
                continue
            if name not in ELEMENTS:
                el.remove(child)
                removed.add(f"<{name}>")
                continue
            if name == "style":
                if child.text and _BAD_CSS.search(child.text):
                    el.remove(child)
                    removed.add("<style> with a fetch or expression")
                    continue
            scrub(child)
            walk(child)

    def scrub(el):
        for k in list(el.attrib):
            n = _attr_name(k)
            low = n.lower()
            if low.startswith("on"):
                del el.attrib[k]
                removed.add("event handler")
                continue
            if low in ("href", "xlink:href"):
                if not _href_ok(el.attrib[k]):
                    del el.attrib[k]
                    removed.add("external reference")
                continue
            if low == "style":
                if _BAD_CSS.search(el.attrib[k] or ""):
                    del el.attrib[k]
                    removed.add("style with a fetch or expression")
                continue
            if n not in ATTRS and not n.startswith("xmlns"):
                del el.attrib[k]
                removed.add(f"@{n}")

    scrub(root)
    walk(root)

    # An <image> or <use> whose href did not survive draws nothing and
    # may still be a broken external reference in a second attribute.
    for el in root.iter():
        if _local(el.tag) in ("image", "use"):
            if not any(_attr_name(k).lower() in ("href", "xlink:href")
                       for k in el.attrib):
                el.attrib["data-dropped"] = "1"

    ET.register_namespace("", SVG_NS)
    out = ET.tostring(root, encoding="unicode")
    # tostring re-emits ns0: prefixes when the source had no default ns.
    out = out.replace("ns0:", "").replace(":ns0", "")
    note = "clean" if not removed else "removed " + ", ".join(sorted(removed)[:8])
    return out, note
