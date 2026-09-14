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

# ---- reuse the parsing/rule logic from the rule-only matcher ---------------
from match_interfaces_to_feeds import (
    clean_filename, tokens, direction_from_path, find_col, norm_dir, score as rule_score,
)


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
            base, sig = rule_score(rr, C, f)
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
