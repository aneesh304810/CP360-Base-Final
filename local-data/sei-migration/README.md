# SEI migration catalog sources

Drop the merged source-file catalog here and run one step:

    SEI_All_Source_Files_Merged_Catalog_Expanded.xlsx    every sheet with Catalog_ID and Source_Attribute is read
    (any other workbook or csv with the same columns is read too)

    .\load.ps1 sei_migration                 # this folder
    python -m ingestion.run sei_migration     # the same, from the repo root

The reader finds the header row on each sheet, matches columns by name
whatever their case, spacing or punctuation, skips sheets without the two
required columns and says so in the log. Set `CP_SEI_MIGRATION_RELOAD=1`
to replace the tables instead of merging into them.

**Nothing here is committed.** `.gitignore` excludes everything but this
README. The catalog carries SEI's and BBH's mapping rules and SQL
fragments; it is contract material and the repository is not where it
lives.
