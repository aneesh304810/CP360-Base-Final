// The 108 architecture-review questions, as data.
//
// WHY A FILE AND NOT A TABLE SEED. These came from a review, not from
// the app, and they are the starting corpus rather than user content —
// so they ship with the code and are keyed by their review number. A
// question raised in the app afterwards gets an id above 1000 and lives
// only in the store. That split means re-deploying never duplicates the
// originals and never deletes somebody's question.
//
// COMPONENT LINKS ARE THE POINT. Each topic carries the Hub component
// ids it concerns and a question may override them. Without a link a
// question is findable only by scrolling this list; with one it appears
// on the component itself in L3.
//
// The owner counts below are the review's own published totals, and a
// test re-derives them from the rows — if a question is re-assigned and
// the summary is not, the suite fails rather than the screen quietly
// disagreeing with the document everyone has in their inbox.

export const OWNERS = {
  KB: { name: "Kelley Barnhardt", focus: "Data model, Stage/INT, ODI→dbt, ownership, DQ, operating model" },
  GL: { name: "Glenn Lasrado", focus: "Risk controls, recovery states, completeness, restatement, retention" },
  GM: { name: "Ganender Middha", focus: "Ingestion framework, SLAs, retention, DR, go-live" },
  SA: { name: "Sudhakar Annam", focus: "OpenShift storage, concurrency, observability" },
  KK: { name: "Kartheek Kollipara", focus: "Platform support, upskilling, threshold controls" },
};

export const OWNER_TOTALS = {"KB": 42, "GL": 29, "GM": 20, "SA": 12, "KK": 5};

export const TOPICS = [
  { no: 1, title: "SEI Data Structure / Enriched Data", comps: ["15", "40", "37"] },
  { no: 2, title: "Stage 2 / INT Layer", comps: ["14", "15", "16"] },
  { no: 3, title: "ODI → dbt Conversion and Ownership", comps: ["15", "16", "37"] },
  { no: 4, title: "Existing DWH Logic Outside Stage 1 / Stage 2", comps: ["37", "16"] },
  { no: 5, title: "BBH vs. SEI Responsibilities and Component Ownership", comps: ["6", "18", "32"] },
  { no: 6, title: "SDC vs. SFTP", comps: ["8", "101"] },
  { no: 7, title: "Post-SEI / SWP Operating Model", comps: ["15", "16", "37", "38"] },
  { no: 8, title: "Data Quality, Thresholds and Reconciliation", comps: ["23", "24", "25", "26", "27", "28", "30"] },
  { no: 9, title: "DIM/FACT Model, History and Validation", comps: ["16", "19", "31"] },
  { no: 10, title: "File Ingestion, Completeness and Idempotency", comps: ["9", "13", "29", "33"] },
  { no: 11, title: "Business-Date Processing, Orchestration and Recovery", comps: ["18", "20", "21", "22", "33"] },
  { no: 12, title: "Restatement, Replay and Corrections", comps: ["17", "21", "29"] },
  { no: 13, title: "Storage, OpenShift and Capacity", comps: ["50", "52", "53", "55"] },
  { no: 14, title: "Observability, Logging and Alerting", comps: ["34", "64"] },
  { no: 15, title: "SLAs", comps: ["20", "34", "7"] },
  { no: 16, title: "Retention, Audit and Disaster Recovery", comps: ["31", "62", "63"] },
  { no: 17, title: "Platform Support, Release and Go-Live", comps: ["57", "59", "60"] },
];

export const QUESTIONS = [
  { n: 1, topic: 1, owner: "KB", body: "What exactly does \"enriched\" SEI data mean within this model?" },
  { n: 2, topic: 1, owner: "KB", body: "Is the enriched layer just normalized SEI data, with no AddVantage-specific transformation?" },
  { n: 3, topic: 1, owner: "KB", body: "Will there be a reusable SEI data structure like today's PB DWH schema, or is Stage 2 meant to serve that purpose?", comps: ["40", "15"], note: "Kartheek agreed" },
  { n: 4, topic: 1, owner: "KB", body: "The documentation says this layer is not a canonical model. Can BBH use it as a consistent data source, or will another transformation/model be needed?" },
  { n: 5, topic: 1, owner: "KB", body: "Does mapping/enrichment mean normalization and reference-data mapping, or does it include transformation into the existing PB DWH model?" },
  { n: 6, topic: 2, owner: "KB", body: "We need a clearer explanation of Stage 2 and how it relates to the architecture diagrams." },
  { n: 7, topic: 2, owner: "KB", body: "What is the purpose of the INT layer, and what processing happens there versus in Stage 2?" },
  { n: 8, topic: 2, owner: "KB", body: "Is this right: Stage standardizes source data and applies source DQ, then INT does further mapping/enrichment before the Dim/Fact models are built?" },
  { n: 9, topic: 2, owner: "KB", body: "What separates Stage → INT → Approved Dim/Fact in terms of transformation, persistence, and business logic?" },
  { n: 10, topic: 2, owner: "KB", body: "Can downstream applications use Stage 2 or INT data directly, or only the approved Dim/Fact models?" },
  { n: 11, topic: 3, owner: "KB", body: "Who is responsible for translating the existing ODI jobs into dbt models?" },
  { n: 12, topic: 3, owner: "KB", body: "Will Professional Services review the ODI implementation and rebuild that logic in dbt, or must BBH analysts reverse-engineer each ODI job and write detailed requirements?" },
  { n: 13, topic: 3, owner: "KB", body: "\"Understand what the ODI job does and provide requirements\": does that mean BBH confirms the business intent, or documents the detailed technical logic?" },
  { n: 14, topic: 3, owner: "KB", body: "Who owns the like-for-like Stage → INT → Approved Dim/Fact mapping and the ODI-to-dbt conversion?" },
  { n: 15, topic: 3, owner: "KB", body: "Who confirms that the new Dim/Fact tables behave the same as the current implementation (e.g., DATEROLL, AUTOPOST)?" },
  { n: 16, topic: 4, owner: "KB", body: "How will processing that currently runs inside the PB DWH itself be handled?" },
  { n: 17, topic: 4, owner: "KB", body: "Who identifies, documents, and rebuilds in dbt the holdings/fact logic that is built inside the PB DWH?" },
  { n: 18, topic: 4, owner: "KB", body: "What does \"unchanged except for how they are populated\" mean in practice?" },
  { n: 19, topic: 4, owner: "KB", body: "Does \"unchanged\" mean the business logic is recreated as-is in dbt, and only the source/population method changes?" },
  { n: 20, topic: 5, owner: "KB", body: "We need clearer separation of BBH and SEI responsibilities across the architecture." },
  { n: 21, topic: 5, owner: "KB", body: "Where does orchestration physically live and run: at BBH or at SEI?" },
  { n: 22, topic: 5, owner: "KB", body: "Which transformations, mappings, DQ checks, and processing does SEI do versus BBH?" },
  { n: 23, topic: 5, owner: "KB", body: "At what point does responsibility pass from SEI-delivered data to BBH-managed processing?" },
  { n: 24, topic: 5, owner: "KB", body: "Who owns each step of exception management: identify, investigate, correct, reprocess, and sign off?" },
  { n: 25, topic: 5, owner: "KB", body: "Can we confirm ownership boundaries across Airflow, dbt, Stage/INT, Dim/Fact loads, reconciliation, and monitoring?" },
  { n: 26, topic: 6, owner: "KB", body: "Should the architecture now show SDC replacing SFTP for transfers from SEI to BBH?" },
  { n: 27, topic: 6, owner: "KB", body: "If SDC is the future-state transfer method, should the diagrams be updated so we review the target-state architecture?" },
  { n: 28, topic: 7, owner: "KB", body: "How will SEI data feed into the Stage → INT → Approved Dim/Fact dbt framework?" },
  { n: 29, topic: 7, owner: "KB", body: "Which existing PB DWH outputs will still be produced from SEI data?" },
  { n: 30, topic: 7, owner: "KB", body: "How will the architecture support the period when BBH processes both AddVantage and SEI data?" },
  { n: 31, topic: 7, owner: "KB", body: "How long will that dual state last after Day 1?" },
  { n: 32, topic: 8, owner: "KB", body: "What happens to records that fail Stage 2 DQ checks, and where are they kept?", comps: ["29", "24"] },
  { n: 33, topic: 8, owner: "KB", body: "How are failed records corrected and reprocessed: resubmitted, reprocessed from source, or picked up in a later SWP feed?", comps: ["17", "29"] },
  { n: 34, topic: 8, owner: "KB", body: "How does the Gold layer stay complete when records fail DQ?", comps: ["16", "27"] },
  { n: 35, topic: 8, owner: "KB", body: "Where are DQ failures shown, and who monitors and resolves the Splunk exceptions?", comps: ["34", "28"] },
  { n: 36, topic: 8, owner: "KB", body: "Will DQ and reconciliation exceptions be visible in a business tool such as 360, or only in Splunk?", comps: ["34"] },
  { n: 37, topic: 8, owner: "KB", body: "What reconciliation controls exist between Raw → Stage → INT → DIM/FACT, especially for completeness and record counts?", comps: ["26", "30"] },
  { n: 38, topic: 8, owner: "GM", body: "Which DQ controls are mandatory before data goes to final tables or reporting applications?", comps: ["25", "28"] },
  { n: 39, topic: 8, owner: "KK", body: "We need requirements from the Data Management team for reasonableness and threshold controls (e.g., market value falls from $300M to $30M overnight → alert).", comps: ["24", "28"] },
  { n: 40, topic: 8, owner: "KK", body: "How will the design catch a full snapshot that loads successfully but has much less data than expected?", comps: ["24", "26"] },
  { n: 41, topic: 8, owner: "KK", body: "Will threshold controls compare against prior-day values, expected ranges, and historical patterns at account, feed, and portfolio level?", comps: ["24", "28"] },
  { n: 42, topic: 8, owner: "GL", body: "DQ resolution: A failure could be marked resolved because a FACT with the same transaction ID exists, even if it isn't the failed record. How is resolution tied to the specific incident, source record, business date, and processing run?", comps: ["28", "29", "31"] },
  { n: 43, topic: 8, owner: "GL", body: "False-green reconciliation: Counts can match while values or relationships are wrong. How are keys, duplicates, values/totals, rejects, replay, and relationship validity reconciled?", comps: ["26", "27", "30"] },
  { n: 44, topic: 9, owner: "KB", body: "Can we confirm the full set of dimensions and facts? Are there more than Account, Client/IP, and Transaction?" },
  { n: 45, topic: 9, owner: "KB", body: "How will the transformed DIM/FACT data be checked against source/AddVantage results at scale?", comps: ["30", "16"] },
  { n: 46, topic: 9, owner: "SA", body: "If facts are built through conformed dimensions or depend on other facts, how do we keep grain consistent and stop upstream changes from silently affecting downstream facts?", comps: ["19", "16"] },
  { n: 47, topic: 9, owner: "GL", body: "Historical accuracy: A Monday transaction replayed after a Wednesday account change could pick up Wednesday's account attributes. Please prove effective-date dimension lookups and revalidation after corrections.", comps: ["19", "21", "31"] },
  { n: 48, topic: 9, owner: "GL", body: "Historical corrections: How are mid-period corrections to closed account history handled (interval splitting, adjacent-period adjustment, handling of affected FACTs)?", comps: ["17", "19"] },
  { n: 49, topic: 10, owner: "GM", body: "What is the expected-interface calendar, who decides it, and where will it live?", comps: ["33", "9"] },
  { n: 50, topic: 10, owner: "GM", body: "What file-readiness mechanism guarantees a file was fully delivered?", comps: ["9", "8"] },
  { n: 51, topic: 10, owner: "GM", body: "Is FILE_NAME + BUSINESS_DATE still enough if a source system resends corrected files?", comps: ["33", "13"] },
  { n: 52, topic: 10, owner: "GL", body: "What is the authoritative source for which interfaces are expected each BUSINESS_DATE?", comps: ["33"] },
  { n: 53, topic: 10, owner: "GL", body: "How are holidays, month-end, weekly files, and one-off exceptions handled?", comps: ["20", "33"] },
  { n: 54, topic: 10, owner: "GL", body: "Is the expected-file set snapshotted/effective-dated, or can a config change alter completeness for a business date that is already open?", comps: ["33"] },
  { n: 55, topic: 10, owner: "GL", body: "Is only one physical delivery per logical interface per business date guaranteed by contract?", comps: ["9", "33"] },
  { n: 56, topic: 10, owner: "GL", body: "If multipart or multiple deliveries are needed, how does (FILE_NAME, BUSINESS_DATE) remain a valid unique key?", comps: ["33", "13"] },
  { n: 57, topic: 10, owner: "SA", body: "Can two concurrent worker tasks claim the same landing file? If so, how is that race condition prevented?", comps: ["13", "52"] },
  { n: 58, topic: 11, owner: "KB", body: "How are weekends and non-business days handled? Will BBH process Saturday/Sunday SWP data?", comps: ["20"] },
  { n: 59, topic: 11, owner: "KB", body: "Please confirm the date-control flow: Pending until all data arrives → Trigger → next date seeded only after success.", comps: ["33", "18"] },
  { n: 60, topic: 11, owner: "KB", body: "If processing fails after the trigger, does it restart from the failed task, and what stops the date from advancing?", comps: ["18", "22"] },
  { n: 61, topic: 11, owner: "GM", body: "How is the transformation trigger recovered when the downstream DAG call fails?", comps: ["18", "21"] },
  { n: 62, topic: 11, owner: "GL", body: "Processing-state gap: DATE_CONTROL can show TRIGGER when no Airflow run exists. Add explicit run states, run ownership, heartbeat/timeout, and recovery of abandoned triggers.", comps: ["18", "22", "33"] },
  { n: 63, topic: 11, owner: "GL", body: "What happens if PENDING → TRIGGER commits but Airflow crashes before the Transformation DAG is created?", comps: ["18", "33"] },
  { n: 64, topic: 11, owner: "GL", body: "Who owns the reconciliation process that detects and fixes this?", comps: ["30", "33"] },
  { n: 65, topic: 11, owner: "GL", body: "What happens if RAW commits but the worker crashes while FILE_REGISTRY still shows LOADING?", comps: ["13", "33"] },
  { n: 66, topic: 11, owner: "GL", body: "How can operations prove for certain whether RAW should be reloaded?", comps: ["14", "31"] },
  { n: 67, topic: 11, owner: "GL", body: "Once DATE_CONTROL = COMPLETE, can ingestion still accept a file for that business date?", comps: ["33", "9"] },
  { n: 68, topic: 11, owner: "GL", body: "If so, how do we stop RAW from going out of sync with Gold data that is already published?", comps: ["14", "16"] },
  { n: 69, topic: 11, owner: "GL", body: "What happens if a worker fails after processing but before moving the file to Archive?", comps: ["13", "29"] },
  { n: 70, topic: 11, owner: "SA", body: "If a pod crashes (OOM, eviction, restart) between processing and the archive move, what state is the file left in, and how is that detected and recovered?", comps: ["13", "29", "52"] },
  { n: 71, topic: 11, owner: "SA", body: "How is asynchronous processing implemented?", comps: ["18", "13"] },
  { n: 72, topic: 12, owner: "GL", body: "Why does the restatement process delete the existing FILE_REGISTRY record?", comps: ["33", "31"] },
  { n: 73, topic: 12, owner: "GL", body: "Should we keep the original lifecycle for audit and add a version/restatement state instead?", comps: ["33", "31"] },
  { n: 74, topic: 12, owner: "GL", body: "Replay durability: A held transaction may be lost if its dependency arrives after the 7-day INT retention. Keep the replay payload or an immutable RAW pointer separately from INT.", comps: ["21", "14"] },
  { n: 75, topic: 12, owner: "GM", body: "How are retries, replay, and exception processing governed?", comps: ["21", "29"] },
  { n: 76, topic: 12, owner: "GM", body: "How are business corrections and data restatements handled?", comps: ["17", "21"] },
  { n: 77, topic: 13, owner: "SA", body: "What access mode is used for the landing, quarantine, and archive volumes, and what storage backend/provisioner sits behind them?", comps: ["50"] },
  { n: 78, topic: 13, owner: "SA", body: "If RWX is needed for multi-pod access, has it been tested against our OpenShift storage class?", comps: ["50", "52"] },
  { n: 79, topic: 13, owner: "SA", body: "What happens if a worker pod lands on a different node from the volume? Is that a documented failure, or does the scheduler prevent it?", comps: ["50", "56"] },
  { n: 80, topic: 13, owner: "SA", body: "What monitoring and alerts warn that volume usage is nearing capacity before it causes an outage?", comps: ["50", "64"] },
  { n: 81, topic: 13, owner: "SA", body: "Has PVC sizing been checked against real numbers rather than assumptions?", comps: ["50", "65"] },
  { n: 82, topic: 13, owner: "GL", body: "Is Landing/Archive/Quarantine storage guaranteed to be visible to all Airflow worker pods?", comps: ["50", "51"] },
  { n: 83, topic: 13, owner: "GL", body: "What are the confirmed maximum file sizes, peak arrival pattern, Oracle connection limit, and processing window?", comps: ["55", "53"] },
  { n: 84, topic: 13, owner: "GL", body: "What evidence supports the proposed Airflow pool size of 8–10?", comps: ["52", "53"] },
  { n: 85, topic: 13, owner: "GM", body: "How will database connection limits and performance be validated?", comps: ["55"] },
  { n: 86, topic: 13, owner: "GM", body: "What is the future scaling strategy?", comps: ["52", "65"] },
  { n: 87, topic: 14, owner: "SA", body: "Is there one correlation ID that tracks a file across ingestion, transformation, and loading in Splunk?", comps: ["34", "31"] },
  { n: 88, topic: 14, owner: "SA", body: "Which logging standard applies: Dynatrace, or another application-logging standard?", comps: ["34", "64"] },
  { n: 89, topic: 14, owner: "GM", body: "How are Splunk alerts correlated, escalated, and routed?", comps: ["34", "64"] },
  { n: 90, topic: 14, owner: "GL", body: "SLA alert state isn't stored in Oracle, so what guarantees duplicate suppression, correlation, recovery closure, and alert delivery in Splunk?", comps: ["34", "33"] },
  { n: 91, topic: 15, owner: "GM", body: "What is the approved common SLA cutoff and exception process?", comps: ["20", "33"] },
  { n: 92, topic: 15, owner: "GM", body: "How are time zones handled during file delivery, especially for multi-currency?", comps: ["20", "9"] },
  { n: 93, topic: 15, owner: "GM", body: "What are the measurable success criteria and operational SLAs for production support?", comps: ["34", "7"] },
  { n: 94, topic: 15, owner: "GM", body: "What are the API availability and performance SLAs?", comps: ["12", "11"] },
  { n: 95, topic: 15, owner: "SA", body: "What is the expected SLA for end-user access to data after the Gold layer?", comps: ["16", "37"] },
  { n: 96, topic: 15, owner: "GL", body: "Who owns the SLA cutoff, time zone, holiday overrides, and exception process?", comps: ["20", "33"] },
  { n: 97, topic: 15, owner: "GL", body: "What happens operationally when a business date stays PENDING for hours past the SLA?", comps: ["33", "34"] },
  { n: 98, topic: 16, owner: "GM", body: "What are the retention requirements for raw and archive data, including compliance and audit?", comps: ["14", "31"] },
  { n: 99, topic: 16, owner: "GM", body: "What are the retention requirements for RAW, Stage 2, and orchestration data?", comps: ["14", "15", "33"] },
  { n: 100, topic: 16, owner: "GL", body: "What are the retention and purge rules for RAW, FILE_REGISTRY, Archive, and Splunk evidence?", comps: ["14", "33", "31"] },
  { n: 101, topic: 16, owner: "GL", body: "How do we make sure purging doesn't remove data needed for audit or restatement?", comps: ["31", "21"] },
  { n: 102, topic: 16, owner: "GM", body: "Are recovery procedures documented for DB, OpenShift, and storage outages?", comps: ["62", "63"] },
  { n: 103, topic: 16, owner: "GM", body: "What are the final RTO/RPO requirements?", comps: ["62", "63"] },
  { n: 104, topic: 17, owner: "KK", body: "What is the long-term plan to keep Airflow, Python, and dbt current and supported? Upgrades may be needed before go-live.", comps: ["51", "45"] },
  { n: 105, topic: 17, owner: "KK", body: "How will staff be trained on Airflow, Python, and dbt for production support?", comps: ["57"] },
  { n: 106, topic: 17, owner: "GM", body: "How are schema changes deployed safely?", comps: ["60", "59"] },
  { n: 107, topic: 17, owner: "GL", body: "Rollback and cutover: Rolling back the software doesn't undo Gold data already committed by a bad release. Provide a tested data compensation/restore process and evidence of ODI-to-dbt record and value parity.", comps: ["59", "63", "16"] },
  { n: 108, topic: 17, owner: "GM", body: "What are the measurable go-live acceptance criteria?", comps: ["57", "30"] },
];

// Resolved from the topic unless the question overrides it.
export const compsFor = (q) =>
  q.comps || (TOPICS.find((t) => t.no === q.topic) || {}).comps || [];
