# Migration chain

Apply in numeric order. The chain is complete from `01` to `48` with two
deliberate absences.

| # | File | Reconstructed from |
|---|------|--------------------|
| 01–24 | core catalog schema | Cp360final (base) |
| 25 | `25_impact_analysis.sql` | Cp360Impact |
| 26 | `26_legacy_lineage.sql` | E2elimeage |
| 27 | `27_legacy_dictionary.sql` | Dictvlv910 |
| 28 | `28_legacy_dictionary_v2_upgrade.sql` | Dictvlv910 |
| 29 | `29_legacy_lineage_data_source.sql` | V5latest |
| 30 | `30_legacy_lineage_update.sql` | Lineage360 — **renumbered from 27** |
| 31–35 | variance, CLOB registry, datasources, recon | Recon |
| 36 | `36_api360_console.sql` | Api360postmon |
| 37–38 | api360 consolidation + admin UX | Finalapi360deploymen5- |
| 39–40 | environment360 + env inventory | Designdocument |
| 41 | `41_design_docs.sql` | Sys2desugn |
| 42 | `42_component_status.sql` | Hubmodel |
| 43–45 | env infra, probe, SSL | Env360v3 |
| 46 | `46_env_network.sql` | Env360finalupdatedv8 |
| 48 | `48_env_workload.sql` | Env360finalupdatedv8 |

## Deliberate absences

**`05` never existed.** The skip from 04 to 06 is consistent across all 105
source repositories — intentional numbering, not a loss.

**`47_env_infra_host.sql` is excluded.** Per the original IMPACTED.md:
*"47 superseded — skip; 48 drops its table."* Applying it then dropping it
only wastes a deploy step.

## Resolved defect

Two different schema changes both shipped as `27`:
`27_legacy_dictionary.sql` (Dictvlv910) and `27_legacy_lineage_update.sql`
(Lineage360). The latter is renumbered to `30`, which simultaneously closes
the collision and fills the one genuine gap in the chain. **Verify this
against any `30_*.sql` that may exist on your local machine before treating
it as settled.**
