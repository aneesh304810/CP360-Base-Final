# SEI crosswalk — what every tag means

Generated from `ui/src/crosswalkGlossary.js`, which is what the
Mapping & divergence screen shows behind its *what do these mean?*
link. Edit that file, re-run the generator, and the two stay in step.

The verdicts are not a severity scale and not opinions. They are the
output of one algorithm applied in a fixed order, first match wins.

**A column is tagged with the rule that stopped it, and nothing below
that rule was tested.** A `NO_SOURCE` column is not a column whose
types happen to be fine — its types were never compared, because there
was nothing to compare them to.

---

## Match verdict

One per warehouse column, from a fixed algorithm applied in order — first match wins. A column is tagged with the rule that stopped it, and nothing below that rule was tested. Listed here in the order the rules run.

### `OUT_OF_SCOPE` — shown as **OUT OF SCOPE**

The column is real, its lineage is real, and SEI was never going to supply it. Every UAF → IMDS row lands here: UAF has no successor.

The distinction that matters: out of the SEI *denominator*, not out of the *lineage*. Drop these from lineage and IMDS looks half-mapped; count them in readiness and IMDS scores near-zero. Both are wrong, and they are different wrongs.

**Why a row gets it.** Rule 1 — the lane's REPLACEMENT_STATE is not REPLACED.

**Blocks cutover.** No. Do not score it, and do not raise it as a gap.

**What clears it.** Only a change of programme scope: the lane gains a successor and REPLACEMENT_STATE becomes REPLACED.

### `NO_BASELINE` — shown as **NO BASELINE**

The warehouse column exists but nothing fills it today. SEI cannot be blamed for failing to replace something that was never there.

**Why a row gets it.** Rule 2 — LINEAGE_STATUS is UNMAPPED, or the row has no contract field behind it.

**Blocks cutover.** No. It belongs to whoever owns the column, and predates this programme.

**What clears it.** Not yours to clear. But if such a row DOES have SEI datapoints attached, that is a direct SEI → IMDS proposal bypassing the contract: it carries BYPASSES_CONTRACT and an exception, and it is an architecture decision, not a mapping detail.

### `NO_SOURCE` — shown as **NO SOURCE**

**This is the headline gap.** The incumbent feeds this warehouse column today, the lane is in scope to be replaced, and SEI has no datapoint proposed for it at all — or has one marked UNAVAILABLE. Nothing to compare, because nothing is offered.

It is deliberately a row rather than a missing row. A gap you can count, assign and dispose of is manageable; a gap that shows up as an absence is found in production.

**Why a row gets it.** Rule 3 — no SEI_TO_CONTRACT row exists for the contract field, or the one that exists has MAP_KIND = UNAVAILABLE.

**Blocks cutover.** Yes, and it is the hardest kind. Every other blocker is a question about a value that exists; this one is a value that does not. Cutting over as-is nulls the column.

**What clears it.** One of four decisions, recorded in DISPOSITION and approved by the data owner: DEFAULT (a constant), DERIVE (compute it from what SEI does send), DROP (agree the column dies with the incumbent), or BLOCK (cutover waits for SEI to add it). UNDECIDED is not an answer, and every NO_SOURCE row must carry one of the four before cutover.

### `NOT_COMPARABLE` — shown as **COMPOSITE**

There is no one left-hand side to compare. The contract field is assembled — an amount and a rate and a date, say — so type-matching the parts proves nothing about the whole.

**Why a row gets it.** Rule 4 — MAP_KIND is COMPOSITE. Each contributing datapoint has its own row sharing a COMPOSITE_GROUP.

**Blocks cutover.** Yes, but differently. The risk is the assembly rule, not the types: a day-count basis, a rounding rule, an FX rate source.

**What clears it.** A complete SEI_TO_CONTRACT_RULE with every parameter supplied — any left as NOT SUPPLIED keeps it open — then a value-level comparison, not a schema one.

### `UNKNOWN`

The comparison could not be made. Something the test needs — a type, a length, a scale, a nullability, a unit — is absent, or the value present was inferred rather than read.

**Why a row gets it.** Rule 5 — either side has UNKNOWN in type, length, scale or nullability, or its EVIDENCE is ASSUMED or NONE. Or rule 9 — unit of measure, currency basis or sign convention differ or are unknown, with the attribute named in FAILED_CHECKS.

**Blocks cutover.** Yes. UNKNOWN is never a pass. A column that could not be checked is not a column that passed.

**What clears it.** Supply the missing side. Usually one extract: ALL_TAB_COLUMNS for the target, a copybook or feed workbook for the source. One extract typically clears hundreds of rows at once.

### `DECODE_NEEDED` — shown as **DECODE**

Both sides hold a code, but nobody has written down which of SEI's values becomes which of the incumbent's. The types can match perfectly and the data still arrives wrong.

**Why a row gets it.** Rule 6 — a code set is involved and its crosswalk is missing or has gaps, or MAP_KIND is LOOKUP.

**Blocks cutover.** Yes. An unmapped code silently produces a valid-looking wrong value, which is worse than a null.

**What clears it.** A complete CODE_SET sheet: every SEI value, its incumbent equivalent, and an explicit decision for values with none.

### `TYPE_SHIFT` — shown as **TYPE SHIFT**

Not a width problem, a kind problem. A conversion has to happen and nobody has specified it: which format, which locale, what happens to a value that will not convert.

**Why a row gets it.** Rule 7 — type families differ: character ↔ numeric, character ↔ date/time, or numeric ↔ date/time.

**Blocks cutover.** Yes. An unspecified conversion is a defect waiting for the first value that does not fit the assumed format.

**What clears it.** A written conversion rule including the failure path, or a change on one side so the families agree.

### `PRECISION_RISK` — shown as **PRECISION**

The value fits the type but not the room. A longer string into a shorter column, more decimal places than the target holds, or a timestamp landing in a DATE.

**Why a row gets it.** Rule 8 — same type family, right-hand side narrower: shorter length, fewer decimals, or DATE against a timestamp.

**Blocks cutover.** Yes. Loss is silent at load time and only visible downstream, often as a reconciliation break weeks later.

**What clears it.** Widen the target, or record an accepted-loss decision naming the rounding or truncation rule, approved by the data owner.

### `PROVEN_MATCH` — shown as **PROVEN**

SEI's datapoint and the incumbent contract field are the same shape and the same meaning, and both statements rest on schema evidence rather than on a document describing the schema.

**Why a row gets it.** Rule 10 — nothing above it fired. Type family, length, scale and nullability all agree; unit, currency basis and sign convention all agree; no code set is in play; and both EVIDENCE_LEFT and EVIDENCE_RIGHT are LIVE_DDL, COPYBOOK or FEED_WORKBOOK.

**Blocks cutover.** No. This is the only verdict that does not block cutover.

**What clears it.** Nothing to clear. Watch for it silently disappearing after a re-ingest: that means one side's evidence got weaker.

---

## Divergence shape

How a mapping departs from a clean one-to-one chain. A column can take more than one shape.

### `no_source` — shown as **No source**

The stub is drawn dashed and ends in an open circle because the chain does not reach. This is NO_SOURCE drawn rather than counted.

**What to watch.** Every one needs a disposition before cutover. These are the rows that null a column on day one.

### `dual_source` — shown as **Dual source**

STAR and UAF, or an incumbent and SEI, both land in one column. Whichever wrote last wins, and nothing in the schema says which that should be.

**What to watch.** Replacing one lane in isolation is not possible. The precedence rule has to be stated first, and it is a business decision.

### `collapse` — shown as **Collapse**

A single value fans out to many landings. Each landing may want it differently — rounded here, decoded there — and one upstream change moves all of them at once.

**What to watch.** Test every landing, not the datapoint. A change that is right for one may be wrong for the rest.

### `decode` — shown as **Decode gap**

Both sides hold codes from different code sets and the translation between them is missing or partial.

**What to watch.** The types match, so schema checks pass. The failure is in the values, and it looks like valid data.

### `bypass` — shown as **Contract bypass**

The mapping skips the incumbent's compatibility contract and lands directly. The contract node is drawn hollow because nothing passes through it.

**What to watch.** Sometimes correct — operational columns like upd_user rarely need a contract. But it changes the integration shape, so it must be a decision rather than a side effect of a join.

### `feed_dependency` — shown as **Feed dependency**

A rate, a reference table or a prior-day position has to be present for this field to be computed correctly.

**What to watch.** The failure mode is a wrong value, not a missing one — the load succeeds with stale inputs. Ordering and staleness checks are the only defence.

---

## Failed checks

Named reasons a row did not pass, pipe-separated on the row. Empty for PROVEN_MATCH.

### `TYPE_FAMILY`

Character, numeric and date/time are different kinds of thing. A conversion is required and has not been specified.

### `LENGTH`

The target column is shorter than the source value can be. Longer values are truncated at load, silently.

### `SCALE`

The target holds fewer decimal places. Values are rounded, and the rounding rule is not written down.

### `NULLABILITY`

The source permits null where the target does not, or the reverse. Either a load failure or a hidden default.

### `CODE_SET`

A coded value crosses the boundary with no complete crosswalk. Unmapped codes produce valid-looking wrong values.

### `UNIT`

The two sides measure in different units. Matching types do not make two numbers mean the same thing.

### `CURRENCY`

Different currency basis — local against base, or an unstated FX rate source.

### `SIGN`

Opposite sign conventions. A debit on one side is a credit on the other, and nothing in the type says so.

### `DATE_GRANULARITY`

A timestamp landing in a DATE, or a date where a timestamp is expected. Time of day is lost or invented.

### `CARDINALITY`

The two sides disagree about how many values exist per key — one-to-one against one-to-many.

### `FEED_DEPENDENCY`

This field is assembled from a second feed that can arrive separately or late. The failure mode is a WRONG value rather than a missing one, which is far harder to detect.

### `NO_TYPES_SUPPLIED`

Neither side supplied types. Nothing was compared; the row is a placeholder for a check that has not run.

### `BYPASSES_CONTRACT`

SEI is proposed straight into the warehouse column without passing through the incumbent's compatibility contract. Sometimes right — often for operational columns — but it is an architecture decision and must not arrive as a side effect of a join.

### `DUAL_SOURCE`

More than one lane writes this column. Which one wins, and when, has to be stated before either can be replaced.

---

## Map kind

How a SEI datapoint reaches the contract field.

### `DIRECT`

One SEI datapoint, carried across unchanged. The simplest case and the only one where a type comparison settles the question.

### `LOOKUP`

The value is a code translated through a reference table. Always produces DECODE_NEEDED until the crosswalk is complete.

### `DERIVED`

Computed from one or more SEI datapoints by a rule. The rule is the risk, not the types.

### `COMPOSITE`

Several SEI datapoints assemble into one contract field. Each gets its own row sharing a COMPOSITE_GROUP, so the fan-out is visible and countable.

### `CONSTANT`

A fixed value, not sourced from SEI at all. Legitimate, but it should be a decision on the record rather than a default nobody chose.

### `UNAVAILABLE`

The contract field has no SEI datapoint behind it. The row exists precisely so the absence can be counted — this is what produces NO_SOURCE.

---

## Evidence

How strongly a stated fact is backed. This is the ceiling on the verdict: the weaker side decides.

### `LIVE_DDL`

Read from the running database. The strongest evidence there is.

### `COPYBOOK`

Read from the record layout the feed is built against. As authoritative as DDL for a file-based source.

### `FEED_WORKBOOK`

Read from the feed's own interface specification, maintained by the team that produces it.

### `DOCUMENT`

Read from a data dictionary or design document — a description of the schema, not the schema. **No row whose evidence is DOCUMENT can reach PROVEN_MATCH**, however good the other side is. This is the ceiling reported once on the summary rather than per row.

### `ASSUMED`

Inferred from something adjacent — a contract field's type taken from the target column it feeds, for instance. Permitted, and permanently caps the row at UNKNOWN.

### `NONE`

Nothing behind the statement. Treated exactly as ASSUMED: the row cannot pass.

---

## Disposition

What is to be done about a gap. Every NO_SOURCE row needs one, approved by the data owner.

### `DEFAULT`

Land a stated constant. Cheap and honest, provided downstream consumers are told the column is no longer live.

### `DERIVE`

Compute the value from what SEI does send. Needs a written rule with every parameter supplied.

### `DROP`

Agree the column dies with the incumbent. Requires every downstream consumer to have been asked, not assumed.

### `BLOCK`

Cutover waits until SEI supplies the datapoint. The honest answer when the column is genuinely needed and genuinely absent.

### `UNDECIDED`

No decision yet. **Not an answer** — a row still carrying this at cutover is an unowned gap, and the count of them is on the summary for exactly that reason.

---

## Lane replacement state

Where a lane stands relative to SEI. This is what decides whether a column is scored at all.

### `REPLACED`

SEI is taking this lane over. Its columns are in the readiness denominator and every gap counts.

### `NOT_REPLACED`

SEI is not replacing this lane — UAF → IMDS today. Counted as lineage, excluded from readiness. Every row scores OUT_OF_SCOPE.

### `SEI_NATIVE`

The lane starts at SEI; there is no incumbent behind it. Nothing to compare against, so it has no baseline.

---

## Lineage status

Whether the incumbent fills the column today.

### `MAPPED`

The incumbent populates this warehouse column today. There is a baseline to replace.

### `UNMAPPED`

The column exists and nothing fills it. A pre-existing hole with its own owner — produces NO_BASELINE, and is not a SEI finding.

### `NOT_APPLICABLE`

The column is out of scope for lineage entirely — a technical or audit column, typically.

---

<!-- generated from ui/src/crosswalkGlossary.js — do not edit by hand -->
