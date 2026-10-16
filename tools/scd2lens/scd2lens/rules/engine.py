"""Merge static (ODI) and runtime (database) evidence into one rule card."""
from __future__ import annotations

import re

import pandas as pd

from ..config import Settings
from ..ingest.loader import OdiExport
from ..odi import classify as cls
from ..odi.locate import code_of, evidence, scenario_tasks, tasks_writing, write_op, writers_of
from ..odi.normalise import is_truncated
from ..odi.parse_enddate import EndDateParse, parse_enddate
from ..odi.parse_merge import MergeParse, parse_merge
from ..odi.parse_scd1 import parse_scd1
from ..odi.parse_variables import DateVariable, parse_date_variable
from .model import INFERRED, PROVEN, UNKNOWN_TRUNCATED, Partition, Quality, Rule, RuleCard


def _scan_row(ex: OdiExport, table: str) -> dict:
    df = ex.scd2_pbdw
    hit = df[df["table"].str.upper() == table.upper()]
    return hit.iloc[0].to_dict() if len(hit) else {}


def _variable(ex: OdiExport, name: str, tasks: pd.DataFrame) -> DateVariable | None:
    """From odi_variables.refresh_sql, else from the V task that sets it."""
    vdf = ex.odi_variables
    hit = vdf[vdf["name"].str.upper().str.endswith(name.upper())]
    if len(hit) and str(hit.iloc[0]["refresh_sql"]).strip():
        v = parse_date_variable(name, str(hit.iloc[0]["refresh_sql"]))
        if v.found:
            return v
    vt = tasks[(tasks["task_type"].str.upper() == "V") & tasks.apply(
        lambda r: name.upper() in " ".join(str(r[k]) for k in ("task_name1", "task_name2", "task_name3")).upper(), axis=1)]
    for _, r in vt.iterrows():
        v = parse_date_variable(name, str(r["code_preview"]))
        if v.found:
            return v
    return None


def _describe_variable(v: DateVariable) -> str:
    parts = [f"{mode} → {col}" for mode, col in v.branches.items() if mode != "ELSE"]
    off = f" {v.offset_days:+d} day" if v.offset_days else ""
    src = f" from {v.source_table}" if v.source_table else ""
    return ", ".join(parts) + off + src


def build_card(ex: OdiExport, table: str, settings: Settings, runtime: dict | None = None) -> RuleCard:
    t = table.upper()
    scan = _scan_row(ex, t)
    card = RuleCard(table=t, pattern=cls.UNKNOWN, scan_verdict=scan.get("verdict") or None)
    card.surrogate_key = (scan.get("surrogate_key") or "").upper() or None
    valid_from = (scan.get("valid_from") or "START_DATE").upper()
    valid_to = (scan.get("valid_to") or "END_DATE").upper()
    card.valid_from, card.valid_to = valid_from, valid_to
    card.current_flag = (scan.get("current_flag") or "").upper() or None
    card.writers = writers_of(ex, t)
    if ex.missing:
        card.notes.append("export files not found: " + ", ".join(ex.missing))

    sig = cls.Signals()
    merge: MergeParse | None = None
    update_merge: MergeParse | None = None
    enddates: list[tuple[EndDateParse, pd.Series]] = []
    scd1: list[tuple[list[str], pd.Series]] = []
    truncated: list[str] = []
    all_tasks = pd.concat([scenario_tasks(ex, s) for s in card.writers], ignore_index=True) if card.writers else ex.scenario_tasks.iloc[0:0]

    for _, r in tasks_writing(ex, t, card.writers or None).iterrows():
        names = " ".join(str(r[k]) for k in ("task_name1", "task_name2", "task_name3")).lower()
        code = str(r["code_preview"])
        op = write_op(str(r["writes"]), t) or ""
        if "merge" in names or op == "MERGE" or re.search(r"merge\s+into", code, re.I):
            mp = parse_merge(code, int(r["code_chars"]), valid_from)
            if mp.found:
                sig.merge_found = True
                if valid_from in mp.on_keys:
                    sig.merge_on_includes_valid_from = True
                if mp.update_set and ("update" in names or not mp.inserts):
                    if update_merge is None:
                        update_merge = mp; update_merge.evidence = evidence(r)  # type: ignore[attr-defined]
                elif merge is None:
                    merge = mp; merge.evidence = evidence(r)  # type: ignore[attr-defined]
                sp = parse_scd1(code)
                if sp.found and sp.on_open_row and str(r["task_type"]).upper() == "S":
                    scd1.append((sp.columns, r))
            elif mp.status == UNKNOWN_TRUNCATED:
                truncated.append(evidence(r))
        if re.search(r"PRC_.*END_DATE", names, re.I) or (op == "UPDATE" and re.search(r"set\s+.*end_date", code, re.I | re.S)):
            ep = parse_enddate(code, int(r["code_chars"]))
            if ep.found:
                sig.enddate_proc = True
                enddates.append((ep, r))
            elif ep.status == UNKNOWN_TRUNCATED:
                truncated.append(evidence(r))
        if "truncate" in names:
            sig.truncate = True
        if "control append" in names and "merge" not in names:
            sig.control_append = True
        if re.search(r"_INSERT_HIST", names, re.I):
            sig.insert_hist_proc = True

    truncated_flow: list[str] = []
    for _, r in all_tasks.iterrows():
        names = " ".join(str(r[k]) for k in ("task_name1", "task_name2", "task_name3")).lower()
        if str(r["task_type"]).upper() in ("C", "J") and is_truncated(str(r["code_preview"]), int(r["code_chars"])):
            ev = f"{evidence(r)} ({int(r['code_chars']):,} chars, preview {len(str(r['code_preview']))})"
            if ev not in truncated:
                truncated_flow.append(ev)
        if "truncate target table" in names:
            sig.truncate = True
        if "control append" in names and "merge" not in names:
            sig.control_append = True
        if re.search(r"_INSERT_HIST", names, re.I):
            sig.insert_hist_proc = True

    card.pattern, notes = cls.classify(sig, card.scan_verdict)
    card.notes += notes

    # keys
    if merge:
        card.version_key = merge.on_keys
        card.natural_key = merge.natural_key
    elif update_merge:
        card.version_key = update_merge.on_keys
        card.natural_key = update_merge.natural_key
    if not card.natural_key:
        for ep, _ in enddates:
            if ep.natural_key:
                card.natural_key = [ep.natural_key]
                break

    # partition by sub-population (several scenarios closing the same table on a filter)
    filt: dict[str, dict[str, str]] = {}
    for ep, r in enddates:
        for col, val in ep.filters.items():
            filt.setdefault(col, {})[val] = str(r["scenario"])
    for col, vals in filt.items():
        if len(vals) > 1 or col == "MASTER_IND":
            card.partition = Partition(column=col, values=vals)
            break

    rules: list[Rule] = []
    n = 0

    def add(text: str, conf: str, ev: str):
        nonlocal n
        n += 1
        rules.append(Rule(id=f"R{n}", text=text, confidence=conf, evidence=ev))

    vs = _variable(ex, "V_PBDW_START_DATE_NEW", all_tasks)
    ve = _variable(ex, "V_PBDW_END_DATE_NEW", all_tasks)
    if vs:
        add(f"{valid_from} = {_describe_variable(vs)}", PROVEN, f"odi_variables / V task: {vs.name}")
    else:
        add(f"How {valid_from} is set could not be read from the export", UNKNOWN_TRUNCATED, "V_PBDW_START_DATE_NEW not found or truncated")
        card.open_questions.append("re-export the START_DATE variable refresh SQL")

    if enddates:
        ep, r = enddates[0]
        trig = "when the key appears in the current batch" if ep.batch_trigger else "on the procedure's own predicate"
        excl = " and the row is not from the current batch" if ep.excludes_current_batch else ""
        where = ", ".join(f"{k} = '{v}'" for k, v in ep.filters.items())
        offset = f" = new {valid_from} {ve.offset_days:+d} day" if ve and ve.offset_days else ""
        add(f"Prior open version closed with {valid_to} = {ep.sets.get(valid_to, '?')}{offset} {trig}{excl}" + (f" [{where}]" if where else ""),
            PROVEN, evidence(r))
        cur = f"Current row = {valid_to} IS NULL" if ep.end_is_null else f"Current row predicate not read ({valid_to} IS NULL expected)"
        if not ep.sets_active_ind:
            cur += "; ACTIVE_IND is not maintained by end-dating"
        add(cur, PROVEN if ep.end_is_null else INFERRED, evidence(r) + " — SET " + ", ".join(ep.sets))
        for ep2, r2 in enddates[1:]:
            where2 = ", ".join(f"{k} = '{v}'" for k, v in ep2.filters.items())
            add(f"A second scenario closes versions on the same table [{where2}]", PROVEN, evidence(r2))
    elif card.pattern == cls.MERGE_SCD2:
        add(f"The closing rule for {valid_to} could not be read", UNKNOWN_TRUNCATED, "; ".join(truncated) or "no end-date procedure in the export")
        card.open_questions.append(f"re-export the end-date procedure for {t} untruncated")

    if update_merge:
        add(f"Same-day reload overwrites the version (MERGE WHEN MATCHED on {', '.join(update_merge.on_keys)})", PROVEN,
            getattr(update_merge, "evidence", "IKM update task"))
    if merge:
        add(f"New version inserted when ({', '.join(merge.on_keys)}) is not yet present (MERGE WHEN NOT MATCHED)", PROVEN,
            getattr(merge, "evidence", "IKM insert task"))
    if scd1:
        cols = sorted({c for cs, _ in scd1 for c in cs})
        add("SCD1 overrides on the open row: " + ", ".join(cols), PROVEN, "; ".join(evidence(r) for _, r in scd1))
    if card.pattern == cls.TRUNCATE_APPEND_HIST:
        add("Table is truncated and re-appended each load; history is kept by an *_INSERT_HIST procedure, not versioned in place", PROVEN,
            "task names: Truncate target table · Control Append · *_INSERT_HIST")

    # runtime
    q = Quality()
    if runtime:
        ds = runtime.get("dup_summary") or {}
        q.rows, q.dup_rows, q.dup_pct, q.dup_keys = ds.get("total_rows"), ds.get("dup_rows"), ds.get("dup_pct"), ds.get("dup_keys")
        w = runtime.get("windows") or {}
        q.bad_windows, q.gaps, q.overlaps = w.get("bad_windows"), w.get("gaps"), w.get("overlaps")
        o = runtime.get("open_rows") or {}
        q.multiple_open, q.none_open = o.get("keys_many_open"), o.get("keys_none_open")
        a = runtime.get("active_ind") or {}
        q.active_ind_open_not_flagged, q.active_ind_closed_but_flagged = a.get("open_not_flagged"), a.get("closed_but_flagged")
        f = runtime.get("freshness") or {}
        q.freshness_alert = f.get("alert")
        q.volume_alerts = runtime.get("volume_alerts") or []
        q.dup_by_month = runtime.get("dup_by_month") or []
        if q.dup_pct is not None:
            if q.dup_pct < 5:
                add("Versions open on real change (upstream delta filtering works); duplicates are isolated exceptions",
                    INFERRED, f"db dup_summary: {q.dup_pct}% duplicate versions over {q.dup_keys} keys"
                    + ("; I$ flow code truncated — " + truncated_flow[0] if truncated_flow else ""))
            else:
                add("Versions open on batch presence, not on change", INFERRED, f"db dup_summary: {q.dup_pct}% duplicate versions")
    card.quality = q
    card.rules = rules

    for ev in truncated + truncated_flow:
        card.open_questions.append(f"re-export untruncated: {ev}")

    cm = {}
    if card.surrogate_key:
        cm[card.surrogate_key] = "ENTITY_SK"
    for k in card.natural_key:
        cm[k] = "BUSINESS_KEY"
    cm[valid_from] = "VALID_FROM_TS"
    cm[valid_to] = "VALID_TO_TS"
    if (scan.get("current_flag") or "").upper():
        cm[scan["current_flag"].upper()] = "IS_CURRENT (unreliable)" if enddates and not enddates[0][0].sets_active_ind else "IS_CURRENT"
    if (scan.get("audit") or "").upper():
        cm[scan["audit"].upper()] = "LOAD_TS"
    card.catalog_mapping = cm
    return card
