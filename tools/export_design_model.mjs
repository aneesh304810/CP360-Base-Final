// Export the cited model to JSON so the design-document generator can
// compose from it instead of restating it. One source, two outputs.
import { writeFileSync } from "node:fs";
import { SEI_DOCS, SEI_BOUNDARY, SEI_COMPONENTS, SEI_TABLES, SEI_OPEN,
  SEI_ASSUMPTIONS, SEI_NOT_BUILT, SEI_TABLE_LINKS } from "../ui/src/seiBaseline.js";
import { REGISTRY, REG_STATE, BBH_LAYERS, BBH_EXTENSION }
  from "../ui/src/hubComponentRegistry.js";
import { GROUPS, PROC_STAGES, LANES } from "../ui/src/hubGroups.js";
import { SEI_ARCH_DOC, ARCH_FEEDS, ARCH_LAYERS, ARCH_CONFLICTS,
  OUTBOUND_FLOW, INBOUND_POSTURE } from "../ui/src/seiArchitecture.js";
import { SCENARIOS, SCENARIO_GAPS } from "../ui/src/seiScenarios.js";
import { TRACKER_COMPONENTS } from "../ui/src/seiDesignTracker.js";

const out = { SEI_DOCS, SEI_BOUNDARY, SEI_COMPONENTS, SEI_TABLES, SEI_OPEN,
  SEI_ASSUMPTIONS, SEI_NOT_BUILT, SEI_TABLE_LINKS, REGISTRY, REG_STATE,
  BBH_LAYERS, BBH_EXTENSION, GROUPS, PROC_STAGES, LANES, SEI_ARCH_DOC,
  ARCH_FEEDS, ARCH_LAYERS, ARCH_CONFLICTS, OUTBOUND_FLOW, INBOUND_POSTURE,
  SCENARIOS, SCENARIO_GAPS, TRACKER_COMPONENTS };
writeFileSync("data/design_model.json", JSON.stringify(out, null, 1));
console.log("design_model.json:",
  SEI_COMPONENTS.length, "components,", SEI_TABLES.length, "tables,",
  SCENARIOS.length, "scenarios,", ARCH_CONFLICTS.length, "conflicts");
