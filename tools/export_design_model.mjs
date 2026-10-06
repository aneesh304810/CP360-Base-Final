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
// The material that arrived after the baseline: the two gap supplements,
// the reconciliation between them and what we already modelled, and the
// Stage 1, Stage 2 and feed models the screens were built from. The
// documents compose from these rather than restating them, so a
// correction to a module corrects every document that used it.
import { GAP_DOC, GAP_SCOPE, GAP_TIERS, GAP_REGISTER, GAP_IDENTIFIERS,
  GAP_FOUNDATION, GAP_OUTBOUND_ERD, GAP_RECON, GAP_MOVEMENT, GAP_DECISIONS,
  GAP_ACCEPTANCE, GAP_CODE_FINDING, GAP_NAMING, GAP_HADR_OPEN,
  GAP_PRECEDENCE, GAP_BUILD_STATUS } from "../ui/src/hubGapSupplement.js";
import { GW_DOC, GW_STRENGTHS, GW_GAPS, GW_RISKS, GW_OPERATION, GW_HEADERS,
  GW_TOKEN_STATES, GW_TOKEN_TESTS, GW_SECRETS, GW_RUNTIME_OBJECTS,
  GW_METRICS, GW_RUNBOOKS, GW_APPROVAL, GW_PLAN }
  from "../ui/src/hubGatewayReview.js";
import { RECONCILE, RC_VERDICT } from "../ui/src/hubGapReconcile.js";
import { S1_SHAPE, S1_RULES, S1_COLS, S1_TABLES, S1_CONFLICT, S1_NOT_HERE }
  from "../ui/src/hubStage1Model.js";
import { S2_DOMAINS, S2_TABLES, S2_RELS, S2_GAPS, S2_CONTRACT, S2_STD_COLS,
  S2_ANCHORS } from "../ui/src/hubStage2Model.js";
import { FEEDS, RAW_TABLES, RAW_WITHOUT_FEED, FAN_OUT, FEED_SUMMARY }
  from "../ui/src/hubFeedMap.js";
import { DB_PATH, DB_CONTROL, DB_ABSENT, DB_LINKS, DB_NOTE }
  from "../ui/src/hubDbModel.js";
import { FILE_CHAIN, FILE_VALIDATIONS, COUNT_RULE, FAIL_MODES, FILE_POSTURE }
  from "../ui/src/hubFileIngestion.js";
import { CHANNELS, TRANSPORTS, GATEWAY_NOTE } from "../ui/src/hubChannels.js";
import { EV_KINDS, EV_RULES, EV_GATE, CLOCKS } from "../ui/src/hubEventModel.js";
import { LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP }
  from "../ui/src/hubLoaderLoop.js";

const out = { SEI_DOCS, SEI_BOUNDARY, SEI_COMPONENTS, SEI_TABLES, SEI_OPEN,
  SEI_ASSUMPTIONS, SEI_NOT_BUILT, SEI_TABLE_LINKS, REGISTRY, REG_STATE,
  BBH_LAYERS, BBH_EXTENSION, GROUPS, PROC_STAGES, LANES, SEI_ARCH_DOC,
  ARCH_FEEDS, ARCH_LAYERS, ARCH_CONFLICTS, OUTBOUND_FLOW, INBOUND_POSTURE,
  SCENARIOS, SCENARIO_GAPS, TRACKER_COMPONENTS,
  GAP_DOC, GAP_SCOPE, GAP_TIERS, GAP_REGISTER, GAP_IDENTIFIERS,
  GAP_FOUNDATION, GAP_OUTBOUND_ERD, GAP_RECON, GAP_MOVEMENT, GAP_DECISIONS,
  GAP_ACCEPTANCE, GAP_CODE_FINDING, GAP_NAMING, GAP_HADR_OPEN,
  GAP_PRECEDENCE, GAP_BUILD_STATUS,
  GW_DOC, GW_STRENGTHS, GW_GAPS, GW_RISKS, GW_OPERATION, GW_HEADERS,
  GW_TOKEN_STATES, GW_TOKEN_TESTS, GW_SECRETS, GW_RUNTIME_OBJECTS,
  GW_METRICS, GW_RUNBOOKS, GW_APPROVAL, GW_PLAN,
  RECONCILE, RC_VERDICT,
  S1_SHAPE, S1_RULES, S1_COLS, S1_TABLES, S1_CONFLICT, S1_NOT_HERE,
  S2_DOMAINS, S2_TABLES, S2_RELS, S2_GAPS, S2_CONTRACT, S2_STD_COLS,
  S2_ANCHORS, FEEDS, RAW_TABLES, RAW_WITHOUT_FEED, FAN_OUT, FEED_SUMMARY,
  DB_PATH, DB_CONTROL, DB_ABSENT, DB_LINKS, DB_NOTE,
  FILE_CHAIN, FILE_VALIDATIONS, COUNT_RULE, FAIL_MODES, FILE_POSTURE,
  CHANNELS, TRANSPORTS, GATEWAY_NOTE, EV_KINDS, EV_RULES, EV_GATE, CLOCKS,
  LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP };
writeFileSync("data/design_model.json", JSON.stringify(out, null, 1));
console.log("design_model.json:",
  SEI_COMPONENTS.length, "components,", SEI_TABLES.length, "tables,",
  SCENARIOS.length, "scenarios,", ARCH_CONFLICTS.length, "conflicts,",
  GAP_REGISTER.length + GW_GAPS.length, "supplement gaps,",
  RECONCILE.length, "reconciliation findings,",
  S2_TABLES.length, "canonical tables,", FEEDS.length, "feeds");
