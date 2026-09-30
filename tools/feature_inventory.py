#!/usr/bin/env python3
"""What a CP 360 checkout HAS, as a list you can diff.

    python tools/feature_inventory.py                     > mine.json
    python tools/feature_inventory.py --root C:\\other\\repo > theirs.json
    python tools/feature_inventory.py --against C:\\SEI\\bbhrepo   <- the usual one
    python tools/feature_inventory.py --compare mine.json theirs.json

WHY THIS EXISTS. Two checkouts of CP 360 have drifted and neither is a
superset of the other. Comparing them file by file answers the wrong
question: most files differ in whitespace, comments and a dozen small
edits, and the ONE thing you need -- which features exist on each side --
is buried. This reads the same six registries the application itself
reads and prints them, so "what is missing" becomes a set difference
instead of an afternoon.

WHAT IT IS NOT. It does not compare the CONTENTS of a feature. Two
checkouts can both have routers_event360.py and disagree about half of
it. This tells you which side has a feature at all; a file compare
(Utilities -> Compare, in the app) tells you how the shared ones differ.
That is the right order: know the list, then read the diffs.

SELF-CONTAINED ON PURPOSE. It imports nothing from the repo, so you can
copy this one file into an older checkout that has no tools/ directory
and it still runs. Python 3.8+, no dependencies.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# ---- the registries ---------------------------------------------------
# Each is a place the application keeps a list of what exists. They are
# read with regexes rather than by importing, because the point is to run
# against a checkout that may not import cleanly here.


def _read(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def api_routers(root):
    """Routers that exist on disk, and which of them main.py mounts.

    A router present but unmounted is a real and easily-missed state: the
    file is there, the endpoints are not. It is reported separately.
    """
    d = os.path.join(root, "api", "app")
    on_disk = sorted(f[:-3] for f in os.listdir(d)
                     if f.startswith("routers_") and f.endswith(".py")) \
        if os.path.isdir(d) else []
    main = _read(os.path.join(d, "main.py"))
    # the mount tuple: every "routers_x" string literal in main.py
    mounted = sorted(set(re.findall(r'"(routers_[a-z0-9_]+)"', main)))
    return {"on_disk": on_disk, "mounted": mounted,
            "on_disk_not_mounted": sorted(set(on_disk) - set(mounted)),
            "mounted_not_on_disk": sorted(set(mounted) - set(on_disk))}


def api_routes(root):
    """Every HTTP path the API serves: router prefix + decorator path."""
    d = os.path.join(root, "api", "app")
    out = []
    if not os.path.isdir(d):
        return out
    for f in sorted(os.listdir(d)):
        if not f.endswith(".py"):
            continue
        src = _read(os.path.join(d, f))
        pref = re.search(r'APIRouter\([^)]*prefix\s*=\s*"([^"]*)"', src)
        prefix = pref.group(1) if pref else ""
        for verb, path in re.findall(
                r'@(?:router|app)\.(get|post|put|delete)\(\s*"([^"]+)"', src):
            out.append(f"{verb.upper()} {prefix}{path}")
    return sorted(set(out))


def ui_screens(root):
    """The route -> component map in App.jsx, and the sidebar in AppShell."""
    app = _read(os.path.join(root, "ui", "src", "App.jsx"))
    shell = _read(os.path.join(root, "ui", "src", "AppShell.jsx"))
    # screens: `key: <Component ... />,` inside the screens object
    screens = sorted(set(re.findall(r'^\s*([a-z][a-z0-9_]*)\s*:\s*<[A-Z]',
                                    app, re.M)))
    # nav: ['key', 'Label', 'icon']
    nav = sorted(set(re.findall(r"\[\s*['\"]([a-z][a-z0-9_]*)['\"]\s*,\s*['\"]",
                                shell)))
    return {"routes": screens, "nav_keys": nav,
            "routed_not_in_nav": sorted(set(screens) - set(nav)),
            "in_nav_not_routed": sorted(set(nav) - set(screens))}


def ui_components(root):
    d = os.path.join(root, "ui", "src")
    if not os.path.isdir(d):
        return []
    return sorted(f for f in os.listdir(d) if f.endswith((".jsx", ".js")))


def ingestion_steps(root):
    """The STEPS list in ingestion/run.py, plus the connector files."""
    src = _read(os.path.join(root, "ingestion", "run.py"))
    block = re.search(r"STEPS\s*=\s*\[(.*?)\]", src, re.S)
    steps = re.findall(r'"([a-z0-9_]+)"', block.group(1)) if block else []
    d = os.path.join(root, "ingestion")
    conns = sorted(f[:-3] for f in os.listdir(d)
                   if f.endswith("_conn.py")) if os.path.isdir(d) else []
    return {"steps": steps, "connectors": conns}


def sql_files(root):
    """Migration files, and the tables each one creates."""
    d = os.path.join(root, "sql")
    if not os.path.isdir(d):
        return {"files": [], "tables": []}
    files, tables = [], set()
    for f in sorted(os.listdir(d)):
        if not f.endswith(".sql"):
            continue
        files.append(f)
        tables |= {t.lower() for t in re.findall(
            r"CREATE\s+TABLE\s+([A-Za-z_0-9]+)", _read(os.path.join(d, f)),
            re.I)}
    return {"files": files, "tables": sorted(tables)}


def env_vars(root):
    """Every environment variable the code reads. A feature that needs
    configuration you have not set looks exactly like a feature that is
    missing, so the variables are part of the inventory."""
    found = set()
    pat = re.compile(
        r"""os\.(?:environ\.get|getenv)\(\s*["']([A-Z][A-Z0-9_]*)["']"""
        r"""|os\.environ\[\s*["']([A-Z][A-Z0-9_]*)["']""")
    for sub in ("api", "ingestion", "tools"):
        base = os.path.join(root, sub)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames if x != "__pycache__"]
            for fn in filenames:
                if fn.endswith(".py"):
                    for a, b in pat.findall(_read(os.path.join(dirpath, fn))):
                        found.add(a or b)
    return sorted(found)


def tests(root):
    out = []
    for sub, ext in (("api/test", ".py"), ("ingestion/test", ".py"),
                     ("ui/test", ".jsx")):
        d = os.path.join(root, *sub.split("/"))
        if os.path.isdir(d):
            out += [f"{sub}/{f}" for f in sorted(os.listdir(d))
                    if f.endswith(ext)]
    return out


# Files whose content is worth fingerprinting. Everything else -- docs,
# mockups, sample artifacts -- differs constantly and tells you nothing
# about whether the two applications behave the same.
_SRC_TREES = (("api/app", (".py",)), ("ingestion", (".py",)),
              ("ui/src", (".jsx", ".js")), ("sql", (".sql",)),
              ("tools", (".py", ".mjs")))

# The registries. Several features each write one line into these, so a
# whole-file copy in either direction silently deletes whatever the other
# side registered. They are called out separately wherever they differ.
REGISTRIES = {
    "api/app/main.py", "ingestion/run.py", "ui/src/App.jsx",
    "ui/src/AppShell.jsx", "ui/src/LineageHome.jsx",
    "ui/src/CrosswalkDashboard.jsx", "ui/src/Event360.jsx",
    "ui/src/SourceLineage.jsx", "ui/src/BizLineage.jsx",
    "ui/src/LineageGraph.jsx", "ui/src/LegacyLineage.jsx",
    "api/app/routers_legacy_source.py", "api/app/routers_legacy_graph.py",
    "api/app/routers_event360.py",
}


def source_hashes(root):
    """sha256 per source file, so "same" and "differs" are facts.

    Only the hash goes in the inventory -- never the content. The file
    this produces is meant to be pasted into a chat, and a CP 360
    checkout holds connect strings and hostnames.
    """
    import hashlib
    out = {}
    for sub, exts in _SRC_TREES:
        base = os.path.join(root, *sub.split("/"))
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames
                           if x not in ("__pycache__", "node_modules")]
            for fn in sorted(filenames):
                if not fn.endswith(exts):
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                try:
                    with open(full, "rb") as fh:
                        data = fh.read()
                except OSError:
                    continue
                # Line endings differ between a Windows checkout and a
                # zip extracted elsewhere. Normalising them stops every
                # single file reading as "differs".
                norm = data.replace(b"\r\n", b"\n")
                out[rel] = {"sha": hashlib.sha256(norm).hexdigest()[:16],
                            "lines": norm.count(b"\n") + 1}
    return out


def inventory(root):
    root = os.path.abspath(root)
    return {
        "root": root,
        "api_routers": api_routers(root),
        "api_routes": api_routes(root),
        "ui": ui_screens(root),
        "ui_components": ui_components(root),
        "ingestion": ingestion_steps(root),
        "sql": sql_files(root),
        "env_vars": env_vars(root),
        "tests": tests(root),
        "source_hashes": source_hashes(root),
    }


# ---- comparison -------------------------------------------------------
# Every line is a set difference, labelled with which side to act on.
# "only in A" is a thing to port INTO B, and vice versa -- said in those
# words, because the direction is the whole question and getting it the
# wrong way round deletes work.

SECTIONS = [
    ("API routers (on disk)", lambda i: i["api_routers"]["on_disk"]),
    ("API routers (mounted in main.py)", lambda i: i["api_routers"]["mounted"]),
    ("API routes", lambda i: i["api_routes"]),
    ("UI routes (App.jsx)", lambda i: i["ui"]["routes"]),
    ("UI sidebar entries", lambda i: i["ui"]["nav_keys"]),
    ("UI source files", lambda i: i["ui_components"]),
    ("Ingestion steps", lambda i: i["ingestion"]["steps"]),
    ("Ingestion connectors", lambda i: i["ingestion"]["connectors"]),
    ("SQL migrations", lambda i: i["sql"]["files"]),
    ("Database tables", lambda i: i["sql"]["tables"]),
    ("Environment variables", lambda i: i["env_vars"]),
    ("Tests", lambda i: i["tests"]),
]


def compare(a, b, name_a, name_b, verbose=False):
    lines, total_a, total_b = [], 0, 0
    for title, get in SECTIONS:
        sa, sb = set(get(a)), set(get(b))
        only_a, only_b = sorted(sa - sb), sorted(sb - sa)
        total_a += len(only_a)
        total_b += len(only_b)
        if not only_a and not only_b:
            lines.append(f"\n## {title}\n  identical ({len(sa)} on both sides)")
            continue
        lines.append(f"\n## {title}")
        if only_a:
            lines.append(f"  only in {name_a}  ({len(only_a)}) "
                         f"-> port INTO {name_b}:")
            lines += [f"      + {x}" for x in only_a]
        if only_b:
            lines.append(f"  only in {name_b}  ({len(only_b)}) "
                         f"-> port INTO {name_a}:")
            lines += [f"      + {x}" for x in only_b]
        if verbose:
            lines.append(f"  shared: {len(sa & sb)}")

    # The states that are wrong on their own, whatever the other side has.
    warn = []
    for inv, nm in ((a, name_a), (b, name_b)):
        for key, msg in (("on_disk_not_mounted",
                          "router file exists but main.py does not mount it"),
                         ("mounted_not_on_disk",
                          "main.py mounts a router that is not there")):
            for r in inv["api_routers"][key]:
                warn.append(f"  [{nm}] {msg}: {r}")
        for key, msg in (("routed_not_in_nav",
                          "screen is routed but has no sidebar entry"),
                         ("in_nav_not_routed",
                          "sidebar entry has no screen behind it")):
            for r in inv["ui"][key]:
                warn.append(f"  [{nm}] {msg}: {r}")

    # ---- file level: same, differs, only one side ----------------------
    ha = a.get("source_hashes") or {}
    hb = b.get("source_hashes") or {}
    if ha and hb:
        shared = sorted(set(ha) & set(hb))
        differ = [f for f in shared if ha[f]["sha"] != hb[f]["sha"]]
        same = len(shared) - len(differ)
        lines.append("\n## Source files")
        lines.append(f"  {same} identical, {len(differ)} differ, "
                     f"{len(set(ha) - set(hb))} only in {name_a}, "
                     f"{len(set(hb) - set(ha))} only in {name_b}")

        reg = [f for f in differ if f in REGISTRIES]
        if reg:
            lines.append("")
            lines.append("  REGISTRIES that differ -- NEVER copy these whole "
                         "in either direction.")
            lines.append("  Several features each write one line into them; a "
                         "whole-file copy")
            lines.append("  deletes whatever the other side registered. Merge "
                         "them line by line:")
            for f in reg:
                lines.append(f"      ! {f:<44} "
                             f"{ha[f]['lines']:>5} vs {hb[f]['lines']:>5} lines")

        rest = [f for f in differ if f not in REGISTRIES]
        if rest:
            lines.append("")
            lines.append(f"  Other files that differ ({len(rest)}), biggest "
                         f"line-count gap first:")
            rest.sort(key=lambda f: -abs(ha[f]["lines"] - hb[f]["lines"]))
            for f in rest[:60]:
                la, lb = ha[f]["lines"], hb[f]["lines"]
                gap = lb - la
                flag = ("  <- " + name_b + " is "
                        + str(abs(gap)) + " lines longer" if gap > 0 else
                        "  <- " + name_a + " is "
                        + str(abs(gap)) + " lines longer" if gap < 0 else
                        "  <- same length, different content")
                lines.append(f"      ~ {f:<44} {la:>5} vs {lb:>5}{flag}")
            if len(rest) > 60:
                lines.append(f"      ... and {len(rest) - 60} more")

    head = [f"# {name_a}  vs  {name_b}",
            f"  {name_a}: {a['root']}",
            f"  {name_b}: {b['root']}",
            "",
            f"  {total_a} item(s) only in {name_a}, "
            f"{total_b} only in {name_b}."]
    if warn:
        head += ["", "## Wrong on its own (fix regardless of the other side)"]
        head += warn
    return "\n".join(head + lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=None,
                    help="checkout to inventory (default: this repo)")
    ap.add_argument("--against", metavar="OTHER_ROOT",
                    help="inventory this repo and OTHER_ROOT and print the "
                         "difference, in one go. Both must be on this "
                         "machine.")
    ap.add_argument("--compare", nargs=2, metavar=("A.json", "B.json"),
                    help="compare two saved inventories")
    ap.add_argument("--names", nargs=2, metavar=("A", "B"),
                    default=["A", "B"], help="labels for --compare")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if args.compare:
        a = json.load(open(args.compare[0], encoding="utf-8"))
        b = json.load(open(args.compare[1], encoding="utf-8"))
        print(compare(a, b, args.names[0], args.names[1], args.verbose))
        return 0

    root = args.root or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if args.against:
        if not os.path.isdir(args.against):
            sys.exit(f"{args.against} is not a directory")
        na, nb = args.names
        if [na, nb] == ["A", "B"]:
            na, nb = os.path.basename(os.path.abspath(root)) or "A", \
                     os.path.basename(os.path.abspath(args.against)) or "B"
        print(compare(inventory(root), inventory(args.against), na, nb,
                      args.verbose))
        return 0

    json.dump(inventory(root), sys.stdout, indent=1, sort_keys=True)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
