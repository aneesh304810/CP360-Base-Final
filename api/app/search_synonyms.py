"""
Business-term synonym expansion for the global search.

Purpose: users often don't know the exact field name or the wording used in a
business description. This maps everyday / abbreviated terms to the vocabulary
actually present in the catalog, so a search for "customer" also finds "client",
"ccy" finds "currency", "money owed" finds "balance/accrual", etc.

Kept as a plain dict so it works air-gapped with no Oracle Text thesaurus
dependency, and applies to both the CONTAINS path and the LIKE fallback.

Each entry maps a term -> list of equivalent/related terms. Expansion is
one-directional at query time but the map is written bidirectionally where it
makes sense. Extend freely to match BBH's real vocabulary.
"""

# canonical financial-services vocabulary rings
SYNONYMS = {
    # parties
    "customer": ["client", "account holder", "investor"],
    "client": ["customer", "account holder", "investor"],
    "counterparty": ["cpty", "broker", "dealer"],

    # accounts / identifiers
    "account": ["acct", "acc", "account number", "acctnum"],
    "acct": ["account", "account number"],
    "portfolio": ["pf", "portfolio id", "book"],
    "id": ["identifier", "number", "key"],

    # money / valuation
    "money": ["cash", "balance", "amount", "value"],
    "balance": ["bal", "amount", "cash balance", "holding"],
    "owed": ["payable", "accrual", "outstanding", "receivable", "due"],
    "owes": ["payable", "accrual", "outstanding", "receivable", "due"],
    "fee": ["charge", "commission", "accrual", "billing"],
    "price": ["px", "rate", "quote", "valuation"],
    "value": ["amount", "valuation", "nav", "worth"],
    "nav": ["net asset value", "valuation"],

    # currency / fx
    "currency": ["ccy", "curr", "fx"],
    "ccy": ["currency", "curr"],
    "fx": ["foreign exchange", "currency", "forward"],

    # positions / holdings
    "position": ["holding", "pos", "lot"],
    "holding": ["position", "lot", "asset"],
    "taxlot": ["tax lot", "lot", "cost basis"],

    # transactions
    "transaction": ["txn", "trade", "activity", "movement"],
    "txn": ["transaction", "trade"],
    "trade": ["transaction", "txn", "deal"],
    "settlement": ["settle", "sttl", "clearing"],

    # instruments / assets
    "asset": ["instrument", "security", "holding"],
    "security": ["asset", "instrument", "sec"],
    "instrument": ["asset", "security"],
    "cusip": ["identifier", "security id"],
    "isin": ["identifier", "security id"],

    # corporate actions / income
    "dividend": ["div", "income", "distribution"],
    "income": ["dividend", "accrual", "interest", "distribution"],
    "corporate action": ["ca", "reorg", "corp action"],

    # dates
    "date": ["dt", "day", "as of"],
    "open": ["opened", "opening", "start"],
    "maturity": ["expiry", "expiration", "mat date"],

    # status / classification
    "status": ["state", "flag"],
    "type": ["category", "class", "classification"],
    "country": ["nation", "domicile", "jurisdiction"],
    "pii": ["sensitive", "personal", "confidential"],
}


def expand_terms(word: str):
    """Return the word plus any synonyms (lowercased, de-duped)."""
    w = word.lower().strip()
    out = [w]
    for syn in SYNONYMS.get(w, []):
        for tok in syn.split():
            if tok not in out:
                out.append(tok)
    return out


def build_contains_expr(words):
    """Build an Oracle Text CONTAINS expression with synonym OR-groups.

    For each query word we OR together stem(word), word, and each synonym,
    then AND the groups. So "money owed" -> (money|cash|balance|...) &
    (owed|payable|accrual|...). Broadens recall without losing precision.
    """
    groups = []
    for w in words:
        terms = expand_terms(w)
        # stem the primary term, plain-match the synonyms
        alts = [f"stem({w})", w] + [t for t in terms if t != w]
        # Oracle Text: escape nothing here since words are pre-filtered [A-Za-z0-9_]
        groups.append("(" + " | ".join(dict.fromkeys(alts)) + ")")
    return " & ".join(groups) if groups else None


def expand_for_like(q: str):
    """For the LIKE fallback: return a list of OR-able lowercased terms."""
    words = [w for w in q.lower().split() if w.isalnum()]
    terms = set()
    for w in words:
        for t in expand_terms(w):
            terms.add(t)
    return sorted(terms) or [q.lower()]
