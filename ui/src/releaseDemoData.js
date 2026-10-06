// Demo rows for the release delivery dashboard.
//
// WHY DEMO ROWS AT ALL. The dashboard reads guardrail_deployment, and
// until a Jenkins post-build step writes to it the screen is empty. Empty
// is the honest state and the live screen keeps it - but a reviewer being
// shown the dashboard for the first time cannot tell an empty screen from
// a broken one, and cannot see what the columns are for. These rows exist
// to be looked at, never to be counted.
//
// EVERY VALUE OBEYS THE NAMING STANDARD on the DevOps 360 reference tab,
// because a demo that invents its own formats teaches the wrong ones:
//   app release   v + date                 v2026.10.01
//   database tag  env + build, per env     qc-1201
//   image         date + build, by digest  2026.10.01-1189 @sha256:...
//   branch        type/ticket-slug         feature/CP-1234-scd2
//
// THE SHAPE IS DELIBERATE, NOT RANDOM. PROD sits two releases behind QC,
// which the reference tab calls the normal state rather than a backlog.
// One environment has its lanes out of step - schema ahead of code, which
// is the direction the design says is safe. One release is blocked and one
// deployment was rolled back, because a dashboard that only ever shows
// green teaches nobody what red looks like.

export const DEMO_NOTE =
 "Demo rows. Nothing here came from guardrail_deployment - they are shaped "
 + "to the naming standard so the dashboard can be read before the "
 + "publisher writes its first row.";

export const DEMO_ENVS = [
 { environment: "DEV",  lanes_aligned: true,
   app:    { app_tag: "v2026.10.06", build_number: "1204",
             commit_sha: "9f3c1ab", deployed_at: "2026-10-06 07:12" },
   schema: { db_tag: "dev-1204", deployed_at: "2026-10-06 07:04" } },
 { environment: "SIT",  lanes_aligned: true,
   app:    { app_tag: "v2026.10.03", build_number: "1197",
             commit_sha: "4b70e52", deployed_at: "2026-10-03 18:40" },
   schema: { db_tag: "sit-1197", deployed_at: "2026-10-03 18:31" } },
 // Schema ahead of code. The design says expand-and-contract makes this
 // the safe direction, so it is drawn as not-aligned rather than as broken.
 { environment: "UAT",  lanes_aligned: false,
   app:    { app_tag: "v2026.10.01", build_number: "1189",
             commit_sha: "c81d4fa", deployed_at: "2026-10-01 20:05" },
   schema: { db_tag: "qc-1201", deployed_at: "2026-10-04 06:50" } },
 { environment: "PROD", lanes_aligned: true,
   app:    { app_tag: "v2026.09.24", build_number: "1172",
             commit_sha: "27ae9c0", deployed_at: "2026-09-24 22:15" },
   schema: { db_tag: "prod-1172", deployed_at: "2026-09-24 21:58" } },
];

const d = (deployment_id, environment, lane, release_id, build_number,
 tag, commit_sha, status, deployed_at, deployed_by, notes) => ({
  deployment_id, environment, lane, release_id, build_number,
  app_tag: lane === "app" ? tag : null,
  db_tag: lane === "schema" ? tag : null,
  commit_sha, status, deployed_at, deployed_by, notes });

export const DEMO_HIST = [
 d("D-1041", "DEV",  "schema", "v2026.10.06", "1204", "dev-1204",  "9f3c1ab", "deployed",    "2026-10-06 07:04", "jenkins", "expand: ACCOUNT_KEY widened"),
 d("D-1042", "DEV",  "app",    "v2026.10.06", "1204", "v2026.10.06", "9f3c1ab", "deployed",  "2026-10-06 07:12", "jenkins", "feature/CP-1402-recon-boundaries"),
 d("D-1039", "UAT",  "schema", "v2026.10.04", "1201", "qc-1201",   "a1f0c33", "deployed",    "2026-10-04 06:50", "jenkins", "schema ships ahead of the code that uses it"),
 d("D-1036", "SIT",  "schema", "v2026.10.03", "1197", "sit-1197",  "4b70e52", "deployed",    "2026-10-03 18:31", "jenkins", ""),
 d("D-1037", "SIT",  "app",    "v2026.10.03", "1197", "v2026.10.03", "4b70e52", "deployed",  "2026-10-03 18:40", "jenkins", "feature/CP-1388-dq-replay"),
 d("D-1033", "UAT",  "app",    "v2026.10.01", "1189", "v2026.10.01", "c81d4fa", "deployed",  "2026-10-01 20:05", "jenkins", "image 2026.10.01-1189 @sha256:9f3c"),
 d("D-1030", "SIT",  "app",    "v2026.09.29", "1183", "v2026.09.29", "6d2b17e", "rolled_back", "2026-09-29 11:22", "a.nair",  "STG view returned duplicate rows on replay; rolled back in 9 minutes"),
 d("D-1028", "DEV",  "app",    "v2026.09.29", "1183", "v2026.09.29", "6d2b17e", "deployed",    "2026-09-29 09:40", "jenkins", ""),
 d("D-1024", "PROD", "schema", "v2026.09.24", "1172", "prod-1172", "27ae9c0", "deployed",    "2026-09-24 21:58", "jenkins", "change window 21:30-23:00"),
 d("D-1025", "PROD", "app",    "v2026.09.24", "1172", "v2026.09.24", "27ae9c0", "deployed",  "2026-09-24 22:15", "jenkins", "approved by change board CHG-44218"),
 d("D-1021", "UAT",  "app",    "v2026.09.24", "1172", "v2026.09.24", "27ae9c0", "deployed",  "2026-09-22 15:30", "jenkins", ""),
 d("D-1018", "SIT",  "app",    "v2026.09.19", "1164", "v2026.09.19", "ba55901", "deployed",  "2026-09-19 16:02", "jenkins", ""),
];

export const DEMO_RELS = [
 { release_id: "v2026.10.06", build_number: "1204", status: "in_qc",
   cut_at: "2026-10-06 07:00", notes: "recon boundaries" },
 { release_id: "v2026.10.03", build_number: "1197", status: "in_qc",
   cut_at: "2026-10-03 18:00", notes: "DQ replay" },
 { release_id: "v2026.10.01", build_number: "1189", status: "blocked",
   cut_at: "2026-10-01 19:30",
   notes: "held: CVE-2026-3188 in the base image, awaiting a bumped digest" },
 { release_id: "v2026.09.24", build_number: "1172", status: "released",
   cut_at: "2026-09-24 21:00", notes: "live in production" },
 { release_id: "v2026.09.19", build_number: "1164", status: "released",
   cut_at: "2026-09-19 15:30", notes: "" },
];
