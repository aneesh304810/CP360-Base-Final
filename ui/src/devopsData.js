// DevOps 360 · the page's data: the naming standard, the two built
// processes, the design-vs-built reconciliation, the work still pending and
// the four pipeline nodes. One module so the Overview and the page itself
// read the same rows and cannot drift apart. Re-exported by DevOps360.jsx.

// The naming standard, as data. `perEnv` is not decoration: the rule is
// that an environment appears in a name IF AND ONLY IF the thing is
// re-made per environment, and the test checks that over this list.
export const NAMING = [
  { thing: "App release", fmt: "v + date", example: "v2026.10.01",
    perEnv: false, by: "Jenkins, merge build only" },
  { thing: "Database tag", fmt: "env + build", example: "qc-1201",
    perEnv: true, by: "schema stage of the application job, per environment" },
  { thing: "Image", fmt: "date + build, pinned by digest",
    example: "2026.10.01-1189 → @sha256:9f3c…", perEnv: false, by: "image job" },
  { thing: "Guardrail library", fmt: "semver", example: "3.2.0",
    perEnv: false, by: "library repo" },
  { thing: "Branch", fmt: "type/ticket-slug", example: "feature/CP-1234-scd2",
    perEnv: false, by: "developer" },
];

export const PIPES = [
  ["intake", "PR intake · webhook bridge", "every PR · 5 gates · CP 360 metadata · email", "built"],
  ["app", "Application data pipeline", "dbt + Airflow · daily", "partial"],
  ["db", "Database · Liquibase", "per release · first stage of the app job", "built"],
  ["img", "Infrastructure image & security", "CVE / bumps · one digest", "built"],
];

export const DB_PROCESS = {
  title: "Database · Liquibase",
  cadence: "per release, as the first stage of the application job — never per commit",
  steps: [
    ["1 · Author", "Engineer",
      "Writes a changeset in the application repo's db/changelog: one logical change, a rollback block, labels and contexts. Additive now; a drop is a later release.",
      "The standards check rejects a changeset without a rollback block or a destructive change with no prior expand release.",
      "—"],
    ["2 · Pull request", "Tech lead",
      "Reviews for expand-and-contract, naming and whether the rollback is data-safe. The PR run validates the changelog and shows what would apply, as a dry run against DEV.",
      "Approval, plus a clean validate and status.",
      "—"],
    ["3 · Validate", "Schema stage",
      "liquibase validate, then status and a checksum compare against the rows already applied in the target.",
      "A changed checksum, or a changeset the target cannot parse, stops the job before anything else runs.",
      "—"],
    ["4 · Update", "Schema stage",
      "liquibase update against the application's own changelog table, DATABASECHANGELOG_{APP}, under the application's lock, with the environment as context.",
      "Any failing changeset fails the job; no gate and no deploy runs after it.",
      "guardrail_changeset — one row per changeset: author, type, rollback_declared, data_safe, release, build"],
    ["5 · Tag", "Schema stage",
      "liquibase tag <env>-<build>, so the instance carries the release's database tag.",
      "The tag is minted only after every changeset applied.",
      "guardrail_changeset_applied — (changeset, environment), checksum, applied_at; the db_tag the map shows"],
    ["6 · Ahead of code", "Deploy stage of the same job",
      "Reads the tag before applying the application. The schema may be ahead of the code, by design; it is never behind.",
      "No tag for this release on the target: the deploy refuses.",
      "guardrail_deployment — the schema lane"],
  ],
  rules: [
    "Rollback is liquibase rollback to the previous tag, and only for data-safe changesets. A destructive change rolls forward with a new changeset.",
    "The same changelog runs in every environment; only the tag differs. DEV and SIT on merge, QC on promotion, PROD on approval.",
    "Every object has exactly one owning application; a shared table changes only in its owner's changelog. dbt owns what it builds, Liquibase the rest.",
  ],
};

export const IMG_PROCESS = {
  title: "Infrastructure image & security",
  cadence: "on a CVE or a version bump, on its own clock — the application job never builds an image",
  steps: [
    ["1 · Bump", "Platform engineering",
      "A CVE patch or base version bump in one of the three image repos: base, workbench, agent.",
      "Triggered by a scanner finding or a scheduled rebuild; a bump with no reason is questioned in review.",
      "—"],
    ["2 · Pull request", "Platform engineering + reviewer",
      "Dockerfile and SBOM configuration. The base is pinned by digest; no floating tags.",
      "Review, plus the Dockerfile checks: no root, no privileged, resource limits present.",
      "—"],
    ["3 · Build", "Image job",
      "Builds base first, then workbench and agent on the new base digest.",
      "A failed build pushes nothing.",
      "—"],
    ["4 · Scan", "Image job",
      "Scans the image and its dependencies for CVEs.",
      "CRITICAL fails the job; HIGH fails an image bound for production.",
      "scan report, archived on the build"],
    ["5 · Sign + SBOM", "Image job",
      "Signs the image and attaches the SBOM and provenance as attestations.",
      "An unsigned image never reaches the registry.",
      "signature + SBOM in the registry, beside the digest"],
    ["6 · Push by digest", "Image job",
      "Pushes one immutable sha256. The date-build tag is a label; the digest is the identity.",
      "The push is the release; there is no promotion step for an image.",
      "the image record: date + build → digest"],
    ["7 · Bump PR", "Image job",
      "Raises a pull request into every repository that pins the digest: application repos for the base, the Jenkinsfile for the agent.",
      "A consumer adopts the fix only when it merges the bump — this step needs an owner and an SLA.",
      "—"],
  ],
  rules: [
    "The digest never moves between environments; it is already identical in all four. Admission only runs signed digests from the internal registry.",
    "A new image changes nothing on its own: the fix is live when the last consumer merges its bump and redeploys.",
    "The three images are rebuilt together so workbench and agent never sit on an older base than the one just patched.",
  ],
};

export const BUILT = [
  { design: ["Trigger", "a GitHub Enterprise pull request webhook straight into Jenkins"],
    today: "a Bitbucket pull request webhook into sie-webhook-bridge, which starts the Guardrails job with repository, branch and commit", status: "built" },
  { design: ["Stage 1", "checkout, commit SHA recorded"],
    today: "Checkout Source Repo into the job workspace; SOURCE_COMMIT can pin the SHA", status: "built" },
  { design: ["Stage 2", "PR validation: branch name, no tracked build dirs, no file over 5 MB"],
    today: "the repository checks inside Gate 1; the three rules are not evidenced one by one", status: "partial" },
  { design: ["Stage 3", "bootstrap from a pinned requirements file through the mirror"],
    today: "the Setup Environment stage; pinning is not evidenced", status: "partial" },
  { design: ["Stage 4a–c", "SQLFluff · dbt standards · DAG standards by AST parse"],
    today: "Gate 1 code quality: lint, format, DAG and repository checks", status: "built" },
  { design: ["Stage 4d", "gitleaks on the PR, full history on main"],
    today: "nothing in a gate; Gate 5 is Bandit plus SAST normalisation", status: "pending" },
  { design: ["Stage 5", "dbt parse and compile, manifest written"],
    today: "inside Gate 3", status: "built" },
  { design: ["Stage 6", "OPA cp.dbt: owners, PII, lineage-based layer rules"],
    today: "no policy engine. Gate 2 compares the dbt YAML contracts to Oracle metadata instead — a check the design did not have", status: "partial" },
  { design: ["Stage 7", "documentation coverage thresholds"],
    today: "nothing", status: "pending" },
  { design: ["Stage 8", "DagBag import in the scheduler's own image, then cp.airflow"],
    today: "Gate 1 reads the DAGs statically; nothing imports them in the runtime image", status: "partial" },
  { design: ["Stages 9–10", "Semgrep · Bandit · Trivy · Checkov · Sonar quality gate"],
    today: "Gate 5: Bandit, plus SAST findings normalised by severity; the shared library's thresholds are not connected", status: "partial" },
  { design: ["Stage 11", "unit tests with an 80 % coverage floor"],
    today: "nothing; the coverage rule would come from the shared library, which is not connected", status: "pending" },
  { design: ["Stage 12", "dbt build into an ephemeral CI schema, state:modified+, source freshness"],
    today: "Gate 3: dbt test plus custom transformation assertions, against a fixed target", status: "partial" },
  { design: ["Stage 13", "integration tests in qa, uat and prod"],
    today: "nothing", status: "pending" },
  { design: ["Stage 14", "architecture: lineage depth ≤ 8, fan-out ≤ 40"],
    today: "Gate 4 benchmarks Oracle performance thresholds instead; depth and fan-out are not measured", status: "partial" },
  { design: ["Stages 15–16", "cp.deploy deployment gate, manual approval with separation of duties"],
    today: "nothing; the promotion block would come from the shared library, which is not connected", status: "pending" },
  { design: ["Stages 17–18", "signed promotion, post-deploy validation, automatic rollback"],
    today: "nothing: the job ends at pass or fail", status: "pending" },
  { design: ["post block", "reports and metrics on every outcome, cleanup"],
    today: "the report aggregator writes summary.json and summary.html; reports archived; workspace cleaned", status: "built" },
  { design: ["Secrets", "Vault, a short-lived token scoped to the stage"],
    today: "an OpenShift secret holding the Oracle connection values, loaded as job environment", status: "partial" },
  { design: ["Results store", "a row per control per build in the CP 360 metadata, Prometheus beside it"],
    today: "the bridge uploads each run's summary to the CP 360 metadata, the schema Integration 360 reads, per gate, not per control", status: "partial" },
  { design: ["Dashboards", "Grafana for engineers, Power BI for governance, a seven-year audit store"],
    today: "CP 360 reads its own metadata rows on Release Delivery and Quality Guardrails, beside the HTML report by e-mail; Grafana, Power BI and the audit store are not built", status: "partial" },
  { design: ["Control catalogue", "176 control IDs — DBT, AF, CP-OPA, CP-DEP — on every result"],
    today: "results are pass, fail, skip or unknown per gate; no control ID anywhere", status: "pending" },
  { design: ["Exceptions", "90-day, two approvers, expiry enforced in the deploy policy"],
    today: "nothing", status: "pending" },
  { design: ["Schema stage", "Liquibase from db/changelog as the first stage — this page's own design"],
    today: "built: the changelog in each application repo is applied first and tagged per environment; Gate 2 then checks the contracts against what Oracle holds", status: "built" },
  { design: ["Image pipeline", "build, scan, sign, SBOM, one digest pinned by every consumer"],
    today: "built: the image job runs on its own cadence and hands over a digest", status: "built" },
  { design: ["DevSecOps shared library", "stage order, severity thresholds, coverage rule and release rules from one pinned library"],
    today: "not connected: the job runs its own five gates with its own thresholds in config/guardrails.yaml", status: "pending" },
];

export const PENDING = [
  ["A control ID on every result", "a row per control per build, in summary.json and in the CP 360 metadata. Everything below reads from it: the score, the dashboards, the exceptions."],
  ["Connect the DevSecOps shared library", "pin it in the Jenkinsfile, take stage order, severity thresholds, the coverage rule and the promotion block from it, and retire the local thresholds. Until then no team is held to the same gate."],
  ["Secrets scan as a gate", "gitleaks on the pull request, full history on main. The cheapest blocking control still missing."],
  ["Policy stages", "cp.dbt after compile, cp.airflow after a DagBag import in the runtime image, cp.deploy before any promotion."],
  ["Gate 3 at scale", "dbt build into an ephemeral CI schema with state-based selection and source freshness, so the gate survives the first hundred models."],
  ["Deployment inside the job", "deploy gate, approval gate with the approver recorded, signed artefact promotion, post-deploy smoke tests with rollback. Today the job stops at the report, and the deploy stage has no database tag to check against."],
  ["Secrets from Vault", "a short-lived token per stage replacing the OpenShift secret."],
  ["Dashboards on the CP 360 metadata rows", "Grafana for engineers, Power BI for governance, and the immutable seven-year store behind both."],
  ["Exceptions as records", "scoped to one control and one asset, two approvers, expiry enforced by the deploy policy rather than a calendar."],
];

// The gate flow, expanded: what the Guardrails job does on every pull
// request, stage by stage and check by check. Read by the Overview's gate
// figure and table. `covers` names the design stages each gate stands in
// for, with the same built / partial / pending status as BUILT; `missing`
// is what the design puts at that point and the gate does not do.
export const GATE_FLOW = {
  params: [
    ["SOURCE_REPO_URL", "the repository to check out", "required"],
    ["SOURCE_BRANCH", "the branch; master by default", "default"],
    ["SOURCE_COMMIT", "a commit to pin instead of the branch head", "optional"],
    ["SKIP_GATE4", "skip the performance gate; recorded as skip", "boolean"],
    ["FAST_FAIL", "stop running gates once the build is marked failed; on by default", "boolean"],
  ],
  env: [
    ["GUARDRAILS_CONFIG", "config/guardrails.yaml in the workspace: gate enablement, thresholds, scanner behaviour, exclusions and test selection"],
    ["REPORTS_DIR", "reports/ in the workspace; each gate writes under reports/gate{n}/"],
    ["SOURCE_WORKSPACE", "source/ in the workspace, where the application repository is cloned"],
    ["Oracle connection", "host, service, port, user and password from an OpenShift secret, loaded as job environment; never in the repository"],
  ],
  before: [
    ["Load secrets", "Pulls the Oracle connection values from the OpenShift secret into the job environment.", "The five values are present.", "built"],
    ["Init", "Loads pipelines/guardrails.groovy and runs initialize: reads config/guardrails.yaml, prepares reports/.", "The config parses.", "built"],
    ["Checkout source", "Clones SOURCE_REPO_URL at SOURCE_BRANCH, or SOURCE_COMMIT when given, into source/. Records the commit.", "Workspace populated, commit recorded.", "built"],
    ["Setup environment", "Installs the toolchain the gates need: dbt, the linters, the scanners.", "dbt resolves.", "built"],
  ],
  gates: [
    { n: 1, name: "Code quality", domain: "code and repository quality", status: "built",
      inputs: "the checked-out source", report: "reports/gate1/*",
      checks: ["lint the SQL and Python", "formatting", "DAG standards, read statically", "repository checks: tracked build directories, file sizes, branch name"],
      tools: "linters and formatters, the DAG checker", rule: "fail on any blocking finding; disabled checks return skip",
      covers: [["Stage 2 · PR validation", "partial"], ["Stage 4a · SQLFluff", "built"], ["Stage 4b · dbt standards", "built"], ["Stage 4c · DAG standards by AST", "built"]],
      missing: ["Stage 4d · secrets scan (gitleaks)"] },
    { n: 2, name: "Schema validation", domain: "schema governance", status: "built",
      inputs: "the dbt YAML contracts, and Oracle metadata after the schema stage applied the changelog", report: "reports/gate2/schema_validation.json",
      checks: ["every contracted model exists in Oracle", "every contracted column exists with the declared type", "nothing in Oracle contradicts a contract"],
      tools: "the schema comparer against the Oracle dictionary", rule: "fail on any contract that Oracle does not hold",
      covers: [["Stage 6 · OPA cp.dbt", "partial"]],
      missing: ["owner routability, PII classification, lineage-based layer rules", "Stage 7 · documentation coverage"] },
    { n: 3, name: "Transformation quality", domain: "data quality and transformation correctness", status: "built",
      inputs: "the dbt project and a fixed target schema", report: "reports/gate3/transformation_quality.json",
      checks: ["dbt deps, parse, compile: every ref and source resolves", "dbt test: schema and data tests", "the custom transformation assertions"],
      tools: "dbt-core with the Oracle adapter", rule: "fail on a compile error, a failed test or a failed assertion",
      covers: [["Stage 5 · parse and compile", "built"], ["Stage 12 · build and test", "partial"]],
      missing: ["an ephemeral CI schema per run", "state-based selection, so only changed models rebuild", "source freshness"] },
    { n: 4, name: "Performance benchmark", domain: "operational performance", status: "built",
      inputs: "the compiled models and the Oracle target", report: "reports/gate4/benchmark.json",
      checks: ["runtime thresholds per model", "plan checks against the configured limits", "benchmark comparisons"],
      tools: "the benchmark runner against Oracle", rule: "fail above threshold; skip, and say so, when SKIP_GATE4 is set",
      covers: [["Stage 14 · architecture compliance", "partial"]],
      missing: ["lineage depth and fan-out limits, which are not measured"] },
    { n: 5, name: "Security scan", domain: "application security", status: "partial",
      inputs: "the Python in DAGs and plugins, and the SAST output", report: "reports/gate5/sast_validation.json",
      checks: ["Bandit over the Python", "SAST findings normalised to one shape", "severity thresholding: block above the configured level"],
      tools: "Bandit and the SAST normaliser", rule: "fail on any finding above the blocking severity; the threshold is local until the shared library owns it",
      covers: [["Stage 9 · Bandit", "built"], ["Stage 9 · Semgrep, Trivy, Checkov", "pending"], ["Stage 10 · Sonar quality gate", "pending"]],
      missing: ["the shared DevSecOps library's thresholds and coverage rule", "Stage 11 · unit tests with a coverage floor"] },
  ],
  after: [
    ["Aggregate", "scripts/report_aggregator.py reads every gate's output and writes summary.json and summary.html: build metadata, overall status, per-gate status, per-gate files.", "built"],
    ["Archive", "reports/** archived on the build; the workspace is cleaned.", "built"],
    ["Distribute", "The bridge collects summary.json and summary.html, uploads the run to the CP 360 metadata, where Integration 360 and the guardrail screens read it, and e-mails the HTML to the pull request's developers and reviewers.", "built"],
  ],
  semantics: [
    ["pass", "every blocking check in the gate passed"],
    ["fail", "a blocking check failed"],
    ["skip", "the gate, or every check in it, is disabled in config, or SKIP_GATE4 was set"],
    ["unknown", "the gate produced no readable result"],
  ],
  aggregate: "fail if any gate failed; else pass if at least one gate passed; else skip",
  fastFail: "With FAST_FAIL on, the default, a failed gate marks the build failed and the remaining gates are skipped. Off, every gate runs and the report shows all failures in one pass, at the cost of the run time.",
};

// How the four moving parts travel through one release: the schema
// (Liquibase), the dbt project, the Airflow DAGs and the images. One row per
// part: where it lives, what checks it on a pull request, how it moves, what
// it runs as, who owns it, and the status of the moving part today. Read by
// the Overview's four-track figure and table.
export const FLOW_TRACKS = [
  { key: "schema", name: "Schema · Liquibase", status: "built",
    lives: "db/changelog in the application repo, beside the models and DAGs",
    checked: "the schema stage of the job: validate, status and a checksum compare, then update on the target and tag env-build; Gate 2 then checks the dbt contracts against what Oracle now holds",
    moves: "the same changelog applied per environment; only the tag differs (dev-, sit-, qc-, prod-build)",
    runs: "not deployed at all: it is applied, and the deploy stage reads the tag before it touches the application",
    owns: "everything dbt does not create: landing and stage tables, sequences, grants, control and reference tables, partitions",
    stages: [["Author changeset", "built"], ["Schema stage · validate + update + tag", "built"], ["Gate 2 · contracts vs Oracle", "built"], ["Tag read before deploy", "pending"]] },
  { key: "dbt", name: "dbt project", status: "partial",
    lives: "models, tests, seeds and contracts in the application repo",
    checked: "Gate 1 lints the SQL; Gate 2 checks the YAML contracts against Oracle after the schema stage; Gate 3 runs dbt compile and dbt test with the custom assertions; Gate 4 benchmarks the compiled models",
    moves: "as part of the thin artefact: the dbt project on the pinned workbench digest, the same SHA from DEV to PROD",
    runs: "dbt run and dbt test inside KubernetesPodOperator pods, one per task, on the workbench image, against the tagged schema",
    owns: "what it builds: models, tests, seeds and their contracts",
    stages: [["Author model + contract", "built"], ["Gates 1 · 2 · 3 · 4", "built"], ["Thin artefact on the digest", "pending"], ["dbt run in a task pod", "pending"]] },
  { key: "airflow", name: "Airflow DAGs", status: "partial",
    lives: "DAG files and plugins in the application repo",
    checked: "Gate 1 reads the DAGs statically (naming, schedule, retries, callbacks, no credentials); Gate 5 runs Bandit over the Python. The design adds a DagBag import in the scheduler's own image, which is not in the job yet",
    moves: "as a DAG bundle or a thin image layer, with the dbt project, under the same release tag",
    runs: "the scheduler and webserver as Deployments on the pinned base digest; each task spawns a pod; the daily DAG orchestrates the dbt runs and the Python loaders",
    owns: "the order and timing of work; it never builds anything itself",
    stages: [["Author DAG", "built"], ["Gate 1 static · Gate 5 Bandit", "built"], ["DagBag import in the runtime image", "pending"], ["Scheduler picks up the bundle", "pending"]] },
  { key: "image", name: "Images · base, workbench, agent", status: "built",
    lives: "three image repositories: Dockerfiles and SBOM configuration, the base pinned by digest",
    checked: "the image job: build base then workbench and agent, scan (CRITICAL fails), sign with SBOM and provenance, push one digest",
    moves: "it does not: the digest is identical in every environment. A bump pull request carries it into every repository that pins it",
    runs: "the agent runs the Guardrails job on OpenShift; the base runs the Airflow scheduler and webserver; the workbench runs every dbt task pod",
    owns: "the runtime everything else runs on; platform engineering owns the bump",
    stages: [["Bump + build", "built"], ["Scan · sign · SBOM", "built"], ["Push by digest", "built"], ["Bump PR into every consumer", "built"]] },
];
export const RELEASE_ORDER = [
  ["The digest is already there.", "Every repository pins the image digest the image job last pushed; the Guardrails agent, the scheduler and the dbt task pods all run on it. Nothing in the release builds an image."],
  ["The schema stage runs first.", "The job validates db/changelog, applies it to the target under the application's own changelog table and tags the instance env-build. Tables exist before any model is compiled against them."],
  ["The gates run on the code.", "Gate 1 lints SQL and reads the DAGs; Gate 2 checks the dbt contracts against the schema just applied; Gate 3 compiles and tests the models; Gate 4 benchmarks; Gate 5 scans the Python. The report goes to the CP 360 metadata and the pull request."],
  ["Merge builds the thin artefact.", "The dbt project and the DAG bundle on the pinned digest, under one app tag, build number and commit. Pending: the job ends at the report today."],
  ["Deploy reads the tag, then applies the artefact.", "DEV and SIT on merge, QC on promotion, PROD on approval. The deploy refuses a target without this release's database tag. Pending."],
  ["The scheduler picks up the DAGs.", "The Airflow scheduler on the base digest parses the bundle; the daily DAG runs on its schedule."],
  ["Each task runs dbt in a pod.", "A KubernetesPodOperator pod on the workbench digest runs dbt against the tagged schema and writes Oracle; Python loaders run the same way."],
  ["The recon gates record the run.", "CronJobs write the guardrail events per run and dataset, which is what the dashboards read back."],
];

// Three pipelines, end to end, from RD DEV to PROD. One entry per pipeline:
// the stages a change passes through, left to right, each with what
// happens, the gate to pass, the evidence written and its status today;
// then what moves between environments and how a rollback works. Read by
// the Overview's end-to-end figures and tables.
export const ENVS = ["RD DEV", "RD SIT", "QC · UAT", "PROD"];
export const E2E = [
  { key: "data", name: "Data pipeline · dbt + Airflow", cadence: "every pull request; a release per merge", status: "partial",
    moves: "the thin artefact: the dbt project and the DAG bundle on the pinned image digest, one app tag, build number and commit SHA, promoted unchanged",
    rollback: "redeploy the previous app tag; the schema is not rolled back by this pipeline, and a model that needs a table change rolls forward with its changeset",
    stages: [
      ["Author", "a model, test, contract or DAG on a branch named type/TICKET-slug", "the branch name", "—", "built"],
      ["Pull request", "the webhook bridge starts the Guardrails job: schema stage on DEV, then Gates 1 to 5; summary.json and summary.html; report to CP 360 metadata and e-mail", "every gate pass or skip; tech lead approval", "the run record in the CP 360 metadata; the e-mailed report", "built"],
      ["Merge", "the merge build makes the thin artefact: dbt project + DAG bundle on the pinned digest, app tag vYYYY.MM.DD", "a green merge build", "guardrail_release", "pending"],
      ["RD DEV", "automatic on merge: the deploy stage reads the dev- tag, applies the artefact, the scheduler parses the DAGs, a smoke dbt test runs", "the database tag present; smoke tests pass", "guardrail_deployment · app lane", "pending"],
      ["RD SIT", "automatic after DEV, the same SHA: the daily DAG runs end to end against SIT data", "the DAG run completes; the recon gates pass", "guardrail_deployment · guardrail_events", "pending"],
      ["QC · UAT", "on promotion, the same SHA: full dbt selection, UAT verification recorded, manual approval", "approval; UAT verification on record", "guardrail_deployment · the approval record", "pending"],
      ["PROD", "on approval: change ticket and window, two approvals with one Platform Owner, the same SHA; post-deploy smoke tests; automatic rollback to the last good commit on failure", "the deployment policy: ticket, window, signatures, no self-approval", "guardrail_deployment · the audit record", "pending"],
    ] },
  { key: "db", name: "Database · Liquibase", cadence: "per release, as the first stage of the application job", status: "built",
    moves: "nothing is promoted: the same changelog is applied in each environment from the same commit, and each instance is tagged env-build",
    rollback: "liquibase rollback to the previous tag for data-safe changesets; a destructive change rolls forward with a new changeset, never back",
    stages: [
      ["Author", "a changeset in db/changelog: one logical change, a rollback block, labels and contexts; additive now, a drop in a later release", "the standards check: a rollback block, no destructive change without a prior expand release", "—", "built"],
      ["Pull request", "validate, status and a checksum compare, and a dry run against DEV showing what would apply; the tech lead reviews expand-and-contract and whether the rollback is data-safe", "clean validate and status; approval", "the PR run's output", "built"],
      ["Merge", "nothing is built: the changelog travels with the application commit", "a green merge build", "—", "built"],
      ["RD DEV", "on merge: validate, update under DATABASECHANGELOG_<APP> and the application's lock, tag dev-build", "every changeset applied; a changed checksum stops the job", "guardrail_changeset · guardrail_changeset_applied · the dev- tag", "built"],
      ["RD SIT", "on merge, after DEV: the same changelog, tag sit-build", "every changeset applied", "guardrail_changeset_applied · the sit- tag", "built"],
      ["QC · UAT", "on promotion: the same changelog, tag qc-build; Gate 2 of the next pull request checks the contracts against what QC now holds", "every changeset applied", "guardrail_changeset_applied · the qc- tag", "built"],
      ["PROD", "on approval, inside the change window: the same changelog, tag prod-build; the deploy stage of the application job reads this tag and refuses without it", "every changeset applied; the approval", "guardrail_changeset_applied · the prod- tag", "built"],
    ] },
  { key: "img", name: "Infrastructure image & security", cadence: "on a vulnerability or a version bump, on its own clock", status: "built",
    moves: "the digest does not move: it is identical in every environment. A bump pull request carries it into every repository that pins it, and each consumer's own release takes it from RD DEV to PROD",
    rollback: "re-pin the previous digest by pull request; the old image is still in the registry, signed",
    stages: [
      ["Bump", "a CVE patch or a base version bump in one of the three image repositories; the base pinned by digest, never a floating tag", "a reason for the bump; the Dockerfile checks: no root, no privileged, resource limits", "—", "built"],
      ["Pull request", "Dockerfile and SBOM configuration reviewed", "review", "—", "built"],
      ["Build · scan · sign", "base first, then workbench and agent on the new base digest; scan the image and its dependencies; sign and attach SBOM and provenance", "CRITICAL fails the job; HIGH fails an image bound for production; an unsigned image never reaches the registry", "the scan report on the build; signature and SBOM in the registry", "built"],
      ["Push by digest", "one immutable sha256; the date-build tag is a label, the digest the identity", "the push succeeds; admission runs only signed digests from the internal registry", "the image record: date + build → digest", "built"],
      ["Bump PR", "a pull request into every repository that pins the digest: application repositories for the base and workbench, the Jenkinsfile for the agent", "each consumer merges; this step needs an owner and a service level", "the consumer's pull request", "built"],
      ["RD DEV", "no stage of its own: the digest arrives when a consumer merges its bump and its merge build deploys to RD DEV; the Guardrails agent and the scheduler there already run on it", "the consumer's merge build", "guardrail_deployment of the consumer", "built"],
      ["RD SIT", "the same digest, with the consumer's SIT deploy; the daily DAG's task pods run on the new workbench", "the consumer's SIT run", "guardrail_deployment of the consumer", "built"],
      ["QC · UAT", "the same digest, when the consumer is promoted; admission runs only signed digests from the internal registry", "the consumer's promotion and approval", "guardrail_deployment of the consumer", "built"],
      ["PROD", "the same digest, with the consumer's approved release; a CVE fix is live in production only when the last consumer has merged its bump and deployed", "the consumer's PROD approval", "guardrail_deployment of the consumer", "built"],
    ] },
];

// The four environments, and what each pipeline does in each. ENV_FACTS is
// the environment itself: what it is for, who gets a change there and how,
// what it is pointed at. ENV_MATRIX is per pipeline: one column per
// environment, one row per question. The names are the ones the delivery
// map uses (RD DEV, RD SIT, QC · UAT, PROD); hostnames stay in Environment 360.
export const ENV_FACTS = [
  { env: "RD DEV", purpose: "the first place a merge lands; where a developer sees their change run against shared data", trigger: "automatic on every merge to the application's main branch",
    approval: "none beyond the pull request's", shape: "one Hub namespace: Airflow webserver and scheduler, the event listener, task pods on demand, at the smallest size", database: "its own IMDS and PBDW instances, tagged dev-build",
    data: "a reduced, refreshed copy; no production records", access: "every engineer", dwell: "hours: the next merge replaces it", status: "partial" },
  { env: "RD SIT", purpose: "system integration: the whole daily run, end to end, on the merge build DEV just took", trigger: "automatic after a successful RD DEV deploy of the same build",
    approval: "none; the SIT run is the gate", shape: "the same namespace shape as DEV, sized for a full daily run", database: "its own IMDS and PBDW instances, tagged sit-build",
    data: "a fuller copy with the interfaces that feed the daily DAG", access: "engineers and the test team", dwell: "a day or two: until the next merge build passes DEV", status: "partial" },
  { env: "QC · UAT", purpose: "acceptance: business users verify the release that will go to production, on the SHA they will get", trigger: "on promotion of a build that passed SIT",
    approval: "one approver, the Tech Lead, plus the UAT verification on record", shape: "production-like sizing; the same objects", database: "its own IMDS and PBDW instances, tagged qc-build",
    data: "masked production-shaped data", access: "engineers, the test team, business verifiers", dwell: "until the release is approved or withdrawn; normally a release or two ahead of PROD", status: "partial" },
  { env: "PROD", purpose: "the warehouse the business reads", trigger: "on approval: a change ticket, inside the change window",
    approval: "two approvals with one Platform Owner; the Release Manager owns the window and the rollback decision", shape: "production replica counts; the same image digest as every other environment", database: "the production IMDS and PBDW, tagged prod-build",
    data: "production", access: "the platform team for deploys; business users through the applications", dwell: "until the next approved release", status: "partial" },
];
export const ENV_MATRIX = {
  data: [
    ["Trigger", "automatic on merge", "automatic after DEV, same SHA", "on promotion, same SHA", "on approval: ticket, window, two approvals, same SHA"],
    ["What is deployed", "the thin artefact: dbt project + DAG bundle on the pinned digest", "the same artefact", "the same artefact", "the same artefact; nothing rebuilt"],
    ["Before it counts", "the deploy stage reads the dev- tag; the scheduler parses the DAGs; a smoke dbt test", "the daily DAG runs end to end; the recon gates pass", "full dbt selection; UAT verification recorded", "post-deploy smoke tests; automatic rollback to the last good commit on failure"],
    ["dbt selection", "state:modified+ against the prod manifest", "state:modified+", "full", "full"],
    ["DAGs", "unpaused; the daily schedule runs on DEV data", "unpaused; the full daily run", "unpaused; business-date runs the verifiers watch", "unpaused; the production schedule"],
    ["Who decides", "the merge", "the SIT run", "the Tech Lead and the verifier", "two approvers; the Release Manager for the window"],
    ["Status", "pending", "pending", "pending", "pending"],
  ],
  db: [
    ["Trigger", "on merge, as the first stage of the application job", "on merge, after DEV, the same commit", "on promotion", "on approval, inside the change window"],
    ["What runs", "validate, status and checksum compare; update under DATABASECHANGELOG_<APP>; tag dev-build", "the same changelog; tag sit-build", "the same changelog; tag qc-build", "the same changelog; tag prod-build"],
    ["Before it counts", "every changeset applied; a changed checksum stops the job", "every changeset applied", "every changeset applied; Gate 2 of the next pull request checks the contracts against QC", "every changeset applied; the deploy stage reads the tag and refuses without it"],
    ["Pull request dry run", "updateSQL against DEV shows what would apply, before merge", "—", "—", "—"],
    ["Rollback", "liquibase rollback to the previous dev- tag; data-safe changesets only", "to the previous sit- tag", "to the previous qc- tag", "to the previous prod- tag, under the Release Manager; a destructive change rolls forward"],
    ["Evidence", "guardrail_changeset · guardrail_changeset_applied (dev)", "guardrail_changeset_applied (sit)", "guardrail_changeset_applied (qc)", "guardrail_changeset_applied (prod)"],
    ["Status", "built", "built", "built", "built"],
  ],
  img: [
    ["How the digest arrives", "with the consumer's merge build, after the bump pull request merges", "with the consumer's SIT deploy", "with the consumer's promotion", "with the consumer's approved release"],
    ["What runs on it", "the Guardrails agent (cp-airflow-agent) for every pull request; the scheduler and webserver on the base; task pods on the workbench", "the scheduler and the daily run's task pods", "the same", "the same, at production replica counts"],
    ["Admission", "signed digests from the internal registry only", "the same", "the same", "the same"],
    ["Before it counts", "the consumer's DEV smoke test on the new image", "the daily DAG completes on the new workbench", "UAT on the new image", "the last consumer merged and deployed: only then is a CVE fix live"],
    ["Rollback", "re-pin the previous digest by pull request", "the same", "the same", "the same; the old image is still signed in the registry"],
    ["Status", "built", "built", "built", "built"],
  ],
};
