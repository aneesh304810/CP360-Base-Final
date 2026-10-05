---
cp360_type: design_document
component_id: 25
component_name: G3 dbt Tests + Business Rules
zone: 2. Hub
plane: Data Quality
priority: P1
technology: dbt
custom_build: Medium
depends_on: [15, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
withdrawn: true
---

# G3 dbt Tests + Business Rules

## Withdrawn

**This design document has been withdrawn. Do not build from it.**

It was written before SEI's two design documents were the base for this
architecture. Reading back through it, the content is wrong often
enough that correcting it line by line is not worth doing, so it is
being rewritten from the drawing rather than patched.

What was wrong was not one fact. The layer model was the old one, it
described a Pre-Gold Exadata tier that is in neither SEI document, it
treated components as settled that SEI has not specified at all, and it
read as though every statement in it had a source. None of that is
repairable by editing.

## Where the current answer is

- **The architecture is the drawing.** The Hub's C4 goes containers,
  then the lane a component sits in, then the component itself.
- **For a component SEI specifies**, its record carries what SEI says,
  the section and the page it says it on, the Oracle objects it
  touches, and what is still open with SEI against it.
- **For everything else**, the component registry carries a verdict —
  specified, differs, or absent — and the reason for it.

## What replaces this page

Nothing yet, and that is deliberate. The drawing comes first; these
documents are rewritten from it afterwards, against SEI's text, with a
citation on every claim. Until then the record in the Hub is the
design, and this page exists only so that a link does not lead
nowhere.

## Recovering the old text

It is in git. `git log --follow` on this file reaches the last version
before withdrawal if any of it is wanted as a starting point.
