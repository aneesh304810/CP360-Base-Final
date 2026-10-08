"""The reading rules for SEI's merged source-file catalog.

WHAT THE SHEET IS. One row per field of an SEI conversion load file
(account-basic.dat, party-basic.dat, ...). SEI wrote the left-hand columns
(type, length, which account types require it, SEI's own processing logic,
where the field surfaces in BOXI reports, outbound files and ADE-CAS). BBH
wrote the right-hand columns: which BBH table feeds it, the mapping rule
that turns BBH's value into SEI's, the DSR tagging logic, and a status.

So SEI is the TARGET. The lineage this module recovers runs

    BBH source table(s) -> BBH mapping rule -> SEI load-file field
                                            -> outbound file / BOXI / ADE-CAS

Everything here is a pure function of the row's text: the connector calls
them, the API never re-derives them, and the tests pin them. Each rule says
what it looked for, because a classification nobody can check is a guess
with a label on it.
"""
from __future__ import annotations

import re

# --------------------------------------------------------------- mandatory
# "House Account: YES | INVESTMENT ACCOUNT: YES | ... | SEP IRA ACCOUNT: N/A"
_PAIR = re.compile(r"([^|:]+?)\s*:\s*(YES|NO|N/?A)\s*(?:\||$)", re.I)


def classify_mandatory(text):
    """-> {"class", "yes", "no", "na", "types"}.

    ALWAYS         required for every account type it applies to
    OPTIONAL       required for none
    CONDITIONAL    required for some account types and not others
    NOT_APPLICABLE every account type says N/A
    UNKNOWN        the cell is empty or says something else
    """
    t = str(text or "").strip()
    pairs = _PAIR.findall(t)
    if not pairs:
        if re.fullmatch(r"y(es)?", t, re.I):
            return {"class": "ALWAYS", "yes": 1, "no": 0, "na": 0, "types": {}}
        if re.fullmatch(r"n(o)?", t, re.I):
            return {"class": "OPTIONAL", "yes": 0, "no": 1, "na": 0, "types": {}}
        return {"class": "UNKNOWN", "yes": 0, "no": 0, "na": 0, "types": {}}
    types, yes, no, na = {}, 0, 0, 0
    for name, v in pairs:
        v = v.upper().replace("/", "")
        types[name.strip()] = v
        if v == "YES":
            yes += 1
        elif v == "NO":
            no += 1
        else:
            na += 1
    if yes and not no:
        cls = "ALWAYS"
    elif no and not yes:
        cls = "OPTIONAL"
    elif yes and no:
        cls = "CONDITIONAL"
    else:
        cls = "NOT_APPLICABLE"
    return {"class": cls, "yes": yes, "no": no, "na": na, "types": types}


# ------------------------------------------------------------------ status
def normalize_status(text):
    """'NA-UK | Complete' -> ('COMPLETE', 'NA-UK'). The classes, in the order
    the screen stacks them: COMPLETE, OPEN, BLOCKED, NA, UNSPECIFIED."""
    parts = [p.strip() for p in re.split(r"[|;]", str(text or "")) if p.strip()]
    if not parts:
        return "UNSPECIFIED", ""
    classes = []
    for p in parts:
        low = p.lower()
        if "complete" in low or low in ("done", "closed", "final"):
            classes.append("COMPLETE")
        elif re.match(r"^(n/?a|not applicable|not required)", low):
            classes.append("NA")
        elif re.search(r"block|issue|question|clarif", low):
            classes.append("BLOCKED")
        elif re.search(r"pending|open|tbd|progress|wip|review|draft|todo", low):
            classes.append("OPEN")
        else:
            classes.append("OPEN")
    for c in ("BLOCKED", "OPEN", "COMPLETE", "NA"):
        if c in classes:
            detail = " | ".join(p for p, k in zip(parts, classes) if k != c)
            return c, detail
    return "UNSPECIFIED", ""


# -------------------------------------------------------------------- rule
_IDENT = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$")


def effective_rule(processing_logic, other_mapping_logic):
    """The BBH-side rule. "Other Mapping Logic" often repeats SEI's logic,
    a line of dashes, then BBH's own answer; the answer is what maps the
    field, so it is the part after the last '---'. Without a separator the
    whole cell is the rule; without the cell, SEI's processing logic is all
    there is and is returned marked as such."""
    oml = str(other_mapping_logic or "").strip()
    if oml:
        if "---" in oml:
            return oml.rsplit("---", 1)[1].strip(), "BBH"
        return oml, "BBH"
    pl = str(processing_logic or "").strip()
    return pl, ("SEI" if pl else "NONE")


def classify_rule(rule_text, source_attribute=None):
    """What kind of mapping the rule is. The rule's first statement decides
    (the text before a blank line or a "Note:"); the notes that follow often
    carry an "if ... then" about truncation that is not the mapping. Only a
    head that reads as prose defers to the whole text. Looked for, in order:

    NOT_MAPPED      nothing written
    NOT_APPLICABLE  N/A, not migrated, not required
    SET_NULL        'Set to Null'
    CONSTANT        'Set to <value>', a default, a single literal
    CONCATENATE     'Concatenate ...'
    CONDITIONAL     CASE WHEN / IF ... THEN
    LOOKUP          select ... from, a *_MAP table, a Config_* list
    TRANSFORM       convert / format / truncate / trim / derive
    DIRECT          one identifier: the source column as it is
    DERIVED         prose that is none of the above
    """
    t = str(rule_text or "").strip()
    if not t:
        return "NOT_MAPPED"
    head = re.split(r"\n\s*\n|\bnotes?\s*:", t, maxsplit=1, flags=re.I)[0].strip()
    if head and head != t:
        c = _classify(head, source_attribute)
        if c != "DERIVED":
            return c
    return _classify(t, source_attribute)


def _classify(t, source_attribute=None):
    low = t.lower()
    if re.match(r"^(n/?a\b|not applicable|not migrat|do not migrat|not required|no mapping)", low):
        return "NOT_APPLICABLE"
    if re.search(r"\bset to null\b|^null$|\bnull\b\s*$", low) and len(t) < 60:
        return "SET_NULL"
    if re.search(r"\bcase\s+when\b|\bwhen\b.*\bthen\b|^\s*if\b|\bif\b.*\bthen\b|\belse\b", low, re.S):
        return "CONDITIONAL"
    if re.search(r"\bconcat", low):
        return "CONCATENATE"
    if re.search(r"\bselect\b.*\bfrom\b|\blook\s*-?up\b|_map\b|\bconfig_|\bmap(ped|ping)?\s+(through|via|using|to)\b|\bcrosswalk\b", low, re.S):
        return "LOOKUP"
    if re.search(r"^\s*set to\b|\bdefault(ed)?\s+to\b|\bhard-?code|^\s*constant\b|^\s*always\b", low):
        return "CONSTANT"
    if re.search(r"\btransform|\bconvert|\bformat|\btruncat|\btrim\b|\bsubstr|\bupper\b|\blower\b|\breplace\b|\bderiv|\bparse|\bsplit\b|\bstrip\b|\bremove\b|\bextract\b|\bnormali[sz]e|\bpad\b|\bround\b|\bcast\b", low):
        return "TRANSFORM"
    if source_attribute and t.upper() == str(source_attribute).upper():
        return "DIRECT"
    # a column name: SOME_COLUMN, Some_Column, TABLE.COLUMN; never a plain capitalised word
    if _IDENT.match(t) and ("_" in t or "." in t or (t.isupper() and len(t) > 2)):
        return "DIRECT"
    # a short literal with no verb reads as a constant ("Individual", "Investment Account")
    if len(t) <= 40 and not re.search(r"\b(if|from|where|and|or|then|use|when|map|set|apply|take|match|join)\b", low):
        return "CONSTANT"
    return "DERIVED"


# ----------------------------------------------------------------- sources
# A table token: upper-case words joined by underscores, or a known mixed-
# case config list. Field tokens are Title_Case_With_Underscores, which is
# how the sheet spells UAF columns (Legal_Title_Line_1, Account_Short_Name).
_TABLE = re.compile(r"\b((?:IM|XOS|AV|SGA|PB|UAF|STAR|CRD|CRM|XAB|TPS)_[A-Z0-9_]{2,}|Config_[A-Za-z0-9_]+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,})\b")
_TABLE_FIELD = re.compile(r"\b((?:IM|XOS|AV|SGA|PB|UAF)_[A-Z0-9_]+)\.([A-Za-z][A-Za-z0-9_]*)")
_FIELD_OF = re.compile(r"\b([A-Z][a-z0-9]+(?:_[A-Z0-9][a-z0-9]*)+)\s*\(\s*((?:IM|XOS|AV|SGA|PB|UAF)_[A-Z0-9_]+)\s*\)")
_TITLE_FIELD = re.compile(r"\b([A-Z][a-z0-9]+(?:_[A-Za-z0-9]+)+)\b")
_FROM_TABLE = re.compile(r"\bfrom\s+([A-Za-z][A-Za-z0-9_]+)", re.I)
_SQL_WORDS = {"SELECT", "FROM", "WHERE", "AND", "OR", "CASE", "WHEN", "THEN", "ELSE", "END", "NULL", "NOT", "IS", "AS", "IN"}


def system_of(table):
    """Which BBH (or conversion) system a table belongs to, from its prefix."""
    t = str(table or "").upper()
    if not t:
        return "OTHER"
    if "UAF" in t or "PACE" in t:
        return "UAF"
    if t.startswith("XOS_") or t.startswith("XAB"):
        return "CONVERSION"
    if t.startswith("AV_") or t.startswith("ADDV") or "ADVANTAGE" in t:
        return "ADDVANTAGE"
    if t.startswith("SGA_") or t.startswith("PB_"):
        return "PB"
    if t.startswith("CONFIG_"):
        return "SEI_CONFIG"
    if "STAR" in t:
        return "STAR"
    if t.startswith("IM_"):
        return "IM"
    if t.startswith("CRD") or t.startswith("CRM") or "PIVOTAL" in t:
        return "CRM"
    if t.startswith("TPS"):
        return "SEI_CONFIG"
    return "OTHER"


def role_of(table):
    t = str(table or "").upper()
    if t.startswith("CONFIG_"):
        return "CONFIG"
    if t.endswith("_MAP") or "_MAP_" in t or "XWALK" in t or "CROSSWALK" in t or "NON_MIGRATING" in t or t.startswith("AV_DEFAULTS"):
        return "CROSSWALK"
    return "SOURCE"


def parse_sources(tables_text, rule_text, acceptable_values=None):
    """-> [{"table", "field", "system", "role", "how"}]. how says where the
    pair was read from: TABLES (the Tables/Fields column), RULE (table.field
    or field (TABLE) in the mapping rule), INFERRED (a Title_Case field in
    a rule that names exactly one source table), CONFIG (Acceptable Values).
    """
    out, seen = [], set()

    def add(table, field, how):
        table = str(table or "").strip().strip(".,;:()")
        field = str(field or "").strip().strip(".,;:()")
        if not table or table.upper() in _SQL_WORDS or len(table) < 3:
            return
        k = (table.upper(), field.upper())
        if k in seen:
            return
        seen.add(k)
        out.append({"table": table, "field": field, "system": system_of(table), "role": role_of(table), "how": how})

    for chunk in re.split(r"[|\n,;]+", str(tables_text or "")):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = _TABLE_FIELD.search(chunk)
        if m:
            add(m.group(1), m.group(2), "TABLES")
            continue
        for tm in _TABLE.finditer(chunk):
            add(tm.group(1), "", "TABLES")
    rule = str(rule_text or "")
    for m in _TABLE_FIELD.finditer(rule):
        add(m.group(1), m.group(2), "RULE")
    for m in _FIELD_OF.finditer(rule):
        add(m.group(2), m.group(1), "RULE")
    for m in _FROM_TABLE.finditer(rule):
        add(m.group(1), "", "RULE")
    # one named source table and Title_Case fields in the rule: they are its columns
    src_tables = [s["table"] for s in out if s["role"] == "SOURCE" and s["system"] not in ("SEI_CONFIG", "OTHER")]
    if len({s.upper() for s in src_tables}) == 1:
        tbl = src_tables[0]
        for m in _TITLE_FIELD.finditer(rule):
            f = m.group(1)
            if f.upper() != tbl.upper() and not _TABLE.fullmatch(f):
                add(tbl, f, "INFERRED")
    av = str(acceptable_values or "").strip()
    if av and av.lower().startswith("config"):
        add(av, "", "CONFIG")
    return out


# ----------------------------------------------------------------- targets
_BOXI = re.compile(r"REPORT\s*:\s*(.+?)\s*FIELD\s*NAME\s*:\s*(.+)", re.I | re.S)


def parse_targets(outbound_file, outbound_field, outbound_transform, boxi, ade_cas, desktop):
    """-> [{"kind", "object", "field", "transformation"}] with kind in
    OUTBOUND, BOXI, ADE_CAS, DESKTOP."""
    out = []
    files = [f.strip() for f in re.split(r"[|,;\n]+", str(outbound_file or "")) if f.strip()]
    fields = [f.strip() for f in re.split(r"[|,;\n]+", str(outbound_field or "")) if f.strip()]
    if files or fields:
        if len(files) == len(fields):
            pairs = list(zip(files, fields))
        else:
            pairs = [(files[0] if files else "", f) for f in fields] or [(f, "") for f in files]
        for obj, fld in pairs:
            out.append({"kind": "OUTBOUND", "object": obj, "field": fld,
                        "transformation": str(outbound_transform or "").strip()})
    b = str(boxi or "").strip()
    if b:
        m = _BOXI.search(b)
        if m:
            out.append({"kind": "BOXI", "object": re.sub(r"\s+", " ", m.group(1)).strip(), "field": m.group(2).strip(), "transformation": ""})
        elif ">>" in b:
            head, _, tail = b.rpartition(">>")
            out.append({"kind": "BOXI", "object": re.sub(r"\s+", " ", head).strip(), "field": tail.strip(), "transformation": ""})
        else:
            out.append({"kind": "BOXI", "object": b, "field": "", "transformation": ""})
    a = str(ade_cas or "").strip()
    if a:
        obj, _, fld = a.partition(".")
        out.append({"kind": "ADE_CAS", "object": obj.strip(), "field": fld.strip(), "transformation": ""})
    d = str(desktop or "").strip()
    if d:
        out.append({"kind": "DESKTOP", "object": d, "field": "", "transformation": ""})
    return out


# ------------------------------------------------------------------- flags
def flags(*texts):
    """Things the notes warn about, worth a finding each."""
    blob = " ".join(str(x or "") for x in texts).lower()
    return {
        "truncation_risk": "Y" if "truncat" in blob else "N",
        "report_out": "Y" if re.search(r"report\s*(it\s+)?out|report out", blob) else "N",
        "null_mitigation": "Y" if "mitigat" in blob or "fallback" in blob or "fall back" in blob else "N",
    }


def country_specific(domicile):
    d = str(domicile or "").strip()
    return "N" if (not d or d.lower() in ("all", "any", "global")) else "Y"
