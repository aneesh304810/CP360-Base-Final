# AddVantage User-Defined field sources

Drop the three files here, with these exact names, then run the discovery
step (see `docs/advantage_ud/ANALYSIS.md`, section "What to run first"):

    dataVar.csv                                   DIM_ACCOUNT_UD extract (21,672 rows)
    AddV User Defined Fields 042926 v1.xlsx       the UD metadata dictionary (List, Tables)
    TRP AddV UD MultiLine 100726 1144.xlsx        business validation samples

Profiling outputs from `profile_ud_clob.py`, if you have them, go in a
`profile/` sub-folder (`attribute_profile.csv`, `schema_variants.csv`,
`parent_structures.csv`, `code_dictionary.csv`, `code_conflicts.csv`,
`type_variance.csv`, `record_schemas.csv`, `run_summary.csv`).

**Nothing here is committed.** `.gitignore` excludes everything but this
README. The extract carries account numbers and household names, the Tables
sheet carries employee names (OFFICER TABLE), and the TRP samples carry
names, phone notes and account references. They are BBH data, and the
repository is not where they live. Generated outputs under `docs/advantage_ud/`
must hold structure, counts and metadata only: never an account number, a
household, a person, a batch id or a sample value that could identify one.
