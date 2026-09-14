#!/usr/bin/env python3
"""
match_interfaces_to_feeds_semantic.py

Smart interface->feed matcher with a SEMANTIC layer. On top of the rule/token
signals (Application, Integration, Source/Target System, Feed Routing hops,
Description keywords, direction hard-filter), it adds sentence-transformer
embedding similarity so matches read the way a human maps them:
  "CRT Wires"                ~ "INF_IMA_CRTWIRES_ADDV_OUT_P"
  "Client Directed Trades"   ~ "PBCRM_COMPLIANCE.CLIENT_DIRECTED_TRADES"
  "Corporate Action CAS"     ~ "ACBS_CAS_DailyFiles"

Runs the model on your GPU (8 GB is plenty for these). If sentence-transformers
or a GPU isn't available, it automatically falls back to the rule-only score,
so the script always runs.

Usage:
  python match_interfaces_to_feeds_semantic.py \
      --interfaces interface_document.xlsx \
      --feeds legacy_feeds.csv \
      --out interface_feed_links.xlsx \
      --model BAAI/bge-small-en-v1.5 \
      --semantic-weight 4.0 \
      [--min-score 2.0] [--device cuda]

Recommended models for an 8 GB GPU (best first):
  BAAI/bge-small-en-v1.5     (query prefix auto-added)
  all-mpnet-base-v2
  intfloat/e5-small-v2       (query:/passage: prefixes auto-added)
  all-MiniLM-L6-v2           (smallest / fastest; you already have it)

Requires: pandas, openpyxl  (+ sentence-transformers torch for the semantic layer)
  pip install pandas openpyxl sentence-transformers torch
"""
from __future__ import annotations

import argparse
import re
import numpy as np
import pandas as pd

# ----------------------------------------------------------------- filename parsing
ARCHIVE_STAMP = re.compile(r'^(?P<name>.*?)(?P<stamp>\d{12,14})$')
KNOWN_EXT = re.compile(
    r'\.(zip|xlsx|xls|txt|csv|dat|status|xml|json|pgp|gpg|gz|psv|tsv|rpt|out|pdf)',
    re.IGNORECASE)
DATE_PATTERNS = [
    (re.compile(r'\d{4}-\d{2}-\d{2}[_ ]?\d{0,6}'), 'YYYY-MM-DD'),
    (re.compile(r'\d{1,2}[_/]\d{1,2}[_/]\d{4}'), 'M_D_YYYY'),
    (re.compile(r'\d{8}'), 'YYYYMMDD'),
    (re.compile(r'_\d{6,}'), ''),
]
STOP = {"the", "of", "and", "to", "for", "with", "data", "file", "feed", "report",
        "daily", "files", "extract", "new", "p", "out", "in", "inf"}


def clean_filename(latest_name: str) -> dict:
    """Strip archive stamp, recover extension, derive feed pattern & tokens."""
    name = (latest_name or "").strip()
    if not name or name.lower().startswith("no file"):
        return {"real_file": None, "ext": None, "pattern": None, "seq": None}

    # strip trailing 12-14 digit archive stamp
    stamp = None
    m = ARCHIVE_STAMP.match(name)
    real = name
    if m:
        # only strip if it leaves a plausible name (avoid eating a real numeric name)
        cand = m.group("name")
        if cand and (KNOWN_EXT.search(cand) or '.' in cand):
            real, stamp = cand, m.group("stamp")

    exts = list(KNOWN_EXT.finditer(real))
    seq = None
    if exts:
        e = exts[-1]
        ext = e.group(0).lstrip('.').lower()
        fname = real[:e.end()]
        trailing = real[e.end():]
        seqm = re.match(r'\.(\d+)', trailing)
        if seqm:
            seq = seqm.group(1)
    else:
        ext = None
        fname = real
        seqm = re.search(r'\.(\d{1,4})$', real)
        if seqm:
            seq = seqm.group(1)

    base = fname
    if ext:
        base = fname[:fname.lower().rfind('.' + ext)]
    pattern = base
    for rx, tok in DATE_PATTERNS:
        pattern = rx.sub(tok, pattern)
    pattern = re.sub(r'[_.]{2,}', '_', pattern).strip('_. ')
    pattern = (pattern + ('.' + ext if ext else '')).strip()
    return {"real_file": fname, "ext": ext, "pattern": pattern, "seq": seq}


def tokens(*vals) -> set:
    out = set()
    for v in vals:
        if v is None:
            continue
        for tok in re.split(r'[\s_\-.>/\\,()]+', str(v).lower()):
            tok = tok.strip()
            if len(tok) >= 2 and tok not in STOP and not tok.isdigit():
                out.add(tok)
    return out


def direction_from_path(path: str, segments: str) -> str:
    hay = f"{path} {segments}".lower()
    if re.search(r'[\\\s>](inbound|incoming|receive|recv)\b', hay):
        return "Inbound"
    if re.search(r'[\\\s>](outbound|outgoing|send|extract)\b', hay):
        return "Outbound"
    return "Unknown"


# ----------------------------------------------------------------- column resolution
def find_col(cols, *needles):
    low = {c: str(c).lower() for c in cols}
    for c, lc in low.items():
        if all(n in lc for n in needles):
            return c
    return None


def norm_dir(v: str) -> str:
    s = (str(v) or "").lower()
    if "in" in s and "out" not in s:
        return "Inbound"
    if "out" in s:
        return "Outbound"
    return "Unknown"


# ----------------------------------------------------------------- scoring
def score(reg_row, reg_cols, feed) -> tuple[float, list[str]]:
    """Score one register row against one parsed feed file. Returns (score, signals)."""
    sig = []
    s = 0.0

    # ---- direction: HARD filter ----
    reg_dir = norm_dir(reg_row.get(reg_cols["direction"], ""))
    feed_dir = feed["direction"]
    if reg_dir != "Unknown" and feed_dir != "Unknown":
        if reg_dir != feed_dir:
            return (-999.0, ["direction conflict"])   # never link across direction
        s += 1.0
        sig.append(f"direction {reg_dir} OK")

    fname = (feed["real_file"] or "").lower()
    fpat = (feed["pattern"] or "").lower()
    fsegs = (feed["segments"] or "").lower()
    fiface = (feed["interface"] or "").lower()
    hay = f"{fname} {fpat} {fsegs} {fiface}"
    hay_tokens = tokens(fname, fpat, fsegs, fiface)

    def has(val, weight, label):
        nonlocal s
        if not val:
            return
        v = str(val).strip().lower()
        if len(v) < 2:
            return
        vt = tokens(val)
        # exact-ish folder/name containment
        compact = re.sub(r'[\s_\-]', '', v)
        if compact and compact in re.sub(r'[\s_\-]', '', hay):
            s += weight; sig.append(f"{label} '{val}' in name/path"); return
        # token overlap
        common = vt & hay_tokens
        if common:
            s += weight * (len(common) / max(len(vt), 1))
            sig.append(f"{label} tokens {sorted(common)}")

    # ---- Application / Integration: primary name signals ----
    has(reg_row.get(reg_cols.get("application")), 2.0, "Application")
    has(reg_row.get(reg_cols.get("integration")), 2.5, "Integration")
    # interface folder often equals application / a system short name
    if fiface and reg_cols.get("application"):
        appc = re.sub(r'[\s_\-/]', '', str(reg_row.get(reg_cols["application"], "")).lower())
        if fiface and (fiface in appc or appc[:6] and appc[:6] in fiface):
            s += 2.0; sig.append(f"folder '{feed['interface']}' ~ Application")

    # ---- Source / Target systems ----
    has(reg_row.get(reg_cols.get("source_sys")), 1.5, "SourceSystem")
    has(reg_row.get(reg_cols.get("target_sys")), 1.5, "TargetSystem")

    # ---- Routing (e.g. AddV->Pivotal): each named hop is a strong signal ----
    routing = reg_row.get(reg_cols.get("routing"), "")
    if routing:
        for hop in re.split(r'[-=>]+', str(routing)):
            has(hop, 1.2, "Routing")

    # ---- Description keywords ----
    has(reg_row.get(reg_cols.get("description")), 1.0, "Description")

    # ---- Type / extension consistency ----
    rtype = str(reg_row.get(reg_cols.get("type"), "")).lower()
    if "file" in rtype and feed["ext"]:
        s += 0.4; sig.append("type=File Feed ↔ has file")
    if feed["ext"] in ("xlsx", "xls") and re.search(r'report|option|sheet|holdsheet', hay):
        s += 0.3; sig.append("report ↔ spreadsheet")

    # ---- Frequency plausibility (soft) ----
    freq = str(reg_row.get(reg_cols.get("frequency"), "")).lower()
    lwt = feed.get("last_write")
    if lwt and ("month" in freq or "daily" in freq):
        try:
            age_days = (datetime.now() - pd.to_datetime(lwt)).days
            if "daily" in freq and age_days <= 5:
                s += 0.3; sig.append("fresh ↔ daily")
            elif "month" in freq and age_days <= 40:
                s += 0.3; sig.append("fresh ↔ monthly")
            elif age_days > 90:
                s -= 0.3; sig.append(f"stale {age_days}d")
        except Exception:
            pass

    return (round(s, 2), sig)


def _rule_confidence(sc: float, signals: list[str]) -> str:
    strong = sum(1 for x in signals if any(k in x for k in
                 ("Integration", "Application", "folder", "Routing", "SourceSystem", "TargetSystem")))
    if sc >= 4.0 and strong >= 2:
        return "High"
    if sc >= 2.5 and strong >= 1:
        return "Medium"
    if sc >= 1.5:
        return "Low"
    return "None"


# ----------------------------------------------------------------- main


# (helpers inlined below — standalone, no external imports)


# ----------------------------------------------------------------- semantic model
class Embedder:
    """Wraps a sentence-transformer with model-specific prefixes; no-op if unavailable."""
    def __init__(self, model_name: str, device: str | None):
        self.ok = False
        self.name = model_name
        try:
            import torch  # noqa
            from sentence_transformers import SentenceTransformer
            dev = device or ("cuda" if _cuda() else "cpu")
            self.model = SentenceTransformer(model_name, device=dev)
            self.device = dev
            self.is_e5 = "e5" in model_name.lower()
            self.is_bge = "bge" in model_name.lower()
            self.ok = True
            print(f"Semantic model loaded: {model_name} on {dev}")
        except Exception as e:  # noqa: BLE001
            print(f"[semantic disabled] {type(e).__name__}: {e}\n"
                  f"  -> falling back to rule-only scoring. "
                  f"pip install sentence-transformers torch to enable.")

    def _prep(self, texts, kind):
        if self.is_e5:
            p = "query: " if kind == "q" else "passage: "
            return [p + t for t in texts]
        if self.is_bge and kind == "q":
            return ["Represent this sentence for searching relevant passages: " + t for t in texts]
        return texts

    def encode(self, texts, kind):
        if not self.ok:
            return None
        emb = self.model.encode(self._prep(list(texts), kind),
                                batch_size=64, normalize_embeddings=True,
                                show_progress_bar=False, convert_to_numpy=True)
        return emb


def _cuda():
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False


# ----------------------------------------------------------------- semantic text builders
def reg_text(row, C):
    """A natural-language description of the interface row for embedding."""
    parts = []
    for key in ("application", "integration", "description", "source_sys", "target_sys", "routing"):
        v = str(row.get(C.get(key) or "", "")).strip()
        if v and v.lower() != "nan":
            parts.append(v)
    return " · ".join(dict.fromkeys(parts))   # dedupe, keep order


def feed_text(f):
    """A readable form of the feed: split the filename into words + folder context."""
    name = f["pattern"] or f["real_file"] or ""
    # split CamelCase / SNAKE / dotted into words
    words = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    words = re.sub(r'[._\-]+', ' ', words)
    segs = (f["segments"] or "").replace(">", " ")
    return f"{words} · {f['interface']} · {segs}".strip()


# ----------------------------------------------------------------- confidence
def confidence(sc, signals, sem):
    strong = sum(1 for x in signals if any(k in x for k in
                 ("Integration", "Application", "folder", "Routing", "SourceSystem", "TargetSystem")))
    high_sem = sem is not None and sem >= 0.62
    if (sc >= 4.0 and strong >= 2) or (high_sem and strong >= 1):
        return "High"
    if sc >= 2.5 and (strong >= 1 or (sem is not None and sem >= 0.5)):
        return "Medium"
    if sc >= 1.5 or (sem is not None and sem >= 0.55):
        return "Low"
    return "None"


# ----------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interfaces", required=True)
    ap.add_argument("--feeds", required=True)
    ap.add_argument("--out", default="interface_feed_links.xlsx")
    ap.add_argument("--sheet", default=0)
    ap.add_argument("--model", default="BAAI/bge-small-en-v1.5")
    ap.add_argument("--device", default=None, help="cuda / cpu (auto if omitted)")
    ap.add_argument("--semantic-weight", type=float, default=4.0,
                    help="how much the 0..1 cosine similarity contributes to the score")
    ap.add_argument("--min-score", type=float, default=1.5)
    args = ap.parse_args()

    # --- load register ---
    if str(args.interfaces).lower().endswith((".xlsx", ".xls")):
        reg = pd.read_excel(args.interfaces, sheet_name=args.sheet, dtype=str)
    else:
        reg = pd.read_csv(args.interfaces, dtype=str)
    reg = reg.fillna("")
    reg.columns = [str(c).strip() for c in reg.columns]
    C = {
        "application": find_col(reg.columns, "application"),
        "integration": find_col(reg.columns, "integration"),
        "description": find_col(reg.columns, "description"),
        "type":        find_col(reg.columns, "type"),
        "source_sys":  find_col(reg.columns, "source", "system") or find_col(reg.columns, "source"),
        "target_sys":  find_col(reg.columns, "target", "system") or find_col(reg.columns, "target"),
        "direction":   find_col(reg.columns, "inbound") or find_col(reg.columns, "direction"),
        "routing":     find_col(reg.columns, "routing"),
        "frequency":   find_col(reg.columns, "frequency"),
        "owner":       find_col(reg.columns, "owner", "contact") or find_col(reg.columns, "owner"),
    }
    print("Resolved register columns:", {k: v for k, v in C.items() if v})

    # --- load + parse feeds ---
    feeds_raw = pd.read_csv(args.feeds, dtype=str).fillna("")
    feeds = []
    for _, r in feeds_raw.iterrows():
        parsed = clean_filename(r.get("LatestFileName", ""))
        if not parsed["real_file"]:
            continue
        feeds.append({
            "interface": r.get("Interface", ""), "full_path": r.get("FullFilePath", ""),
            "segments": r.get("FolderSegments", "") or r.get("FullFilePath", ""),
            "last_write": r.get("LastWriteTime", ""), "size": r.get("SizeBytes", ""),
            "direction": direction_from_path(r.get("FullFilePath", ""), r.get("FolderSegments", "")),
            **parsed,
        })
    print(f"Parsed {len(feeds)} feed files; matching {len(reg)} interface rows.\n")

    # --- embeddings ---
    emb = Embedder(args.model, args.device)
    sem_matrix = None
    if emb.ok:
        reg_vecs = emb.encode([reg_text(r, C) for _, r in reg.iterrows()], kind="q")
        feed_vecs = emb.encode([feed_text(f) for f in feeds], kind="p")
        sem_matrix = reg_vecs @ feed_vecs.T           # cosine (already normalised)

    # --- match ---
    rows, used, no_file = [], set(), 0
    for ri, (_, rr) in enumerate(reg.iterrows()):
        reg_dir = norm_dir(rr.get(C["direction"], ""))
        scored = []
        for fi, f in enumerate(feeds):
            base, sig = score(rr, C, f)
            if base <= -900:               # direction conflict -> hard skip
                continue
            sem = float(sem_matrix[ri, fi]) if sem_matrix is not None else None
            total = base + (args.semantic_weight * sem if sem is not None else 0.0)
            if sem is not None and sem >= 0.5:
                sig = sig + [f"semantic {sem:.2f}"]
            scored.append((round(total, 2), fi, sig, sem))
        scored.sort(key=lambda x: x[0], reverse=True)
        best = scored[0] if scored and scored[0][0] >= args.min_score else None
        runners = scored[1:3]

        rec = dict(rr)
        if best:
            f = feeds[best[1]]; used.add(best[1])
            rec.update({
                "Best_Match_File": f["real_file"], "File_Extension": f["ext"] or "(none)",
                "Feed_Pattern": f["pattern"], "Matched_Folder": f["interface"],
                "Matched_Path": f["full_path"], "Last_Write_Time": f["last_write"],
                "File_Direction": f["direction"],
                "Direction_Check": ("agree" if reg_dir in (f["direction"], "Unknown") or f["direction"] == "Unknown" else "conflict"),
                "Semantic_Sim": round(best[3], 3) if best[3] is not None else "",
                "Match_Score": best[0], "Match_Confidence": confidence(best[0], best[2], best[3]),
                "Signals_Fired": "; ".join(best[2][:7]),
                "Runner_Up_1": f'{feeds[runners[0][1]]["real_file"]} ({runners[0][0]})' if len(runners) > 0 else "",
                "Runner_Up_2": f'{feeds[runners[1][1]]["real_file"]} ({runners[1][0]})' if len(runners) > 1 else "",
            })
        else:
            no_file += 1
            for k in ("Best_Match_File", "File_Extension", "Feed_Pattern", "Matched_Folder",
                      "Matched_Path", "Last_Write_Time", "File_Direction", "Semantic_Sim",
                      "Runner_Up_1", "Runner_Up_2", "Signals_Fired"):
                rec[k] = ""
            rec.update({"Direction_Check": "n/a", "Match_Score": 0, "Match_Confidence": "No file found"})
        rows.append(rec)

    result = pd.DataFrame(rows)
    orphans = pd.DataFrame([{
        "Interface": feeds[i]["interface"], "Real_File": feeds[i]["real_file"],
        "Extension": feeds[i]["ext"] or "(none)", "Direction": feeds[i]["direction"],
        "Path": feeds[i]["full_path"]} for i in range(len(feeds)) if i not in used])

    with pd.ExcelWriter(args.out, engine="openpyxl") as xl:
        result.to_excel(xl, sheet_name="Interface_Feed_Links", index=False)
        orphans.to_excel(xl, sheet_name="Unmatched_Feeds", index=False)
        (result["Match_Confidence"].value_counts().rename_axis("Confidence")
            .reset_index(name="Count")).to_excel(xl, sheet_name="Summary", index=False)

    print("Match summary:\n" + result["Match_Confidence"].value_counts().to_string())
    print(f"\nSemantic layer: {'ON ('+emb.name+')' if emb.ok else 'OFF (rule-only)'}")
    print(f"Unmatched feeds: {len(orphans)}   ->  {args.out}")


if __name__ == "__main__":
    main()
