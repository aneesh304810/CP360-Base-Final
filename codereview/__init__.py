"""CP 360 Code Review: a senior data engineer's review of Airflow, dbt,
Integration Hub Python and SQL changes against the CP 360 designs.

Three parts, each usable alone:

  rules      deterministic checks (AST, SQL and YAML reading) that find the
             anti-patterns the designs name, with a rule id and a design
             reference on every finding;
  pack       the Copilot review pack: the instructions, the standards, the
             rule findings and the numbered diff as Markdown, for Microsoft
             365 Copilot or Copilot Chat in ask mode to write the judgement
             part of the review in a fixed format;
  report     the final report: rule findings merged with the findings parsed
             from Copilot's answer (or from Claude, when an API key is
             present), a verdict, and the GitHub review comments.

The webhook router (api/app/routers_codereview.py) runs the rules on every
push or pull request, builds the pack, posts the rule findings to the pull
request and stores the review; Copilot's report is pasted back on the Code
Review 360 page or ingested from the command line.
"""
__version__ = "0.1.0"
