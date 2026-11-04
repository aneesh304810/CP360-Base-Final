// Cyber Security 360: the inventory page renders from handed-in state, the
// numbers derive from the rows, the not-scanned list groups by constraint,
// the Markdown and CSV carry the rows, the form carries every declaration
// field, and nothing on the page is a person's address or a host.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import Cyber360, { AppForm, ReviewTab } from "../src/Cyber360.jsx";
import { SEED, summarise, unscannedMarkdown, toCsv, applyLocal, blankApp, starterFromSystems, appFromSystem, CLASSES, SCAN, CONSTRAINTS, VALID, DEVSECOPS, POLICY } from "../src/cyber360Api.js";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const tLight = { accent: "#0f4775", navy: "#0f4775", text: "#1a1a1a", sub: "#4a5560", textMuted: "#7a8690", border: "#d9dee3", panel: "#ffffff", bg: "#f4f6f8", radius: { md: 6 } };
const tDark = { ...tLight, text: "#eef2f5", sub: "#b7c0c8", textMuted: "#8793a0", border: "#2b3640", panel: "#1b232b", bg: "#121820" };

console.log("-- the starter inventory and the numbers");
ok(SEED.length === 13 && SEED.every((a) => a.app_id && a.app_name && CLASSES[a.app_class] && SCAN[a.scan_status] && CONSTRAINTS[a.constraint_kind] && DEVSECOPS[a.devsecops_integration]), "thirteen starter applications, every enumeration a known value");
ok(SEED.filter((a) => a.app_class === "HOME_GROWN").length === 9 && SEED.filter((a) => a.app_class === "VENDOR_PACKAGE").length === 4 && !SEED.some((a) => a.app_class === "SAAS"), "nine home-grown, four vendor packages, SaaS added as inventoried");
const s = summarise(SEED);
ok(s.apps === 13 && s.notScanned === 12 && s.serverOnly === 1 && s.scanned === 0 && s.unknown === 0 && s.toReview === 12 && s.accepted === 1 && s.toScan === 0 && s.retiring === 1,
   "the numbers derive from the rows: twelve not scanned, SharePoint server-only and accepted, the Email Tool retiring, every other constraint to review", JSON.stringify(s));
ok(SEED.every((a) => !/[\w.+-]+@[\w-]+\.[\w.-]+/.test(JSON.stringify(a)) && !/https?:\/\//.test(JSON.stringify(a))), "no address and no URL on any starter row");
ok(POLICY.length === 4 && POLICY.some((p) => /SharePoint/.test(p.text) && p.covers === "SERVER_ONLY"), "the scan policy is the thread's four statements");

console.log("-- the not-scanned list for the reply");
const md = unscannedMarkdown(SEED);
ok(/^# Applications not covered by the application scan/.test(md) && /## No web or API surface \(8\)/.test(md) && /## Vendor binaries, no source \(2\)/.test(md) && /## Legacy stack, retiring \(1\)/.test(md) && /## Covered by the server scan \(1\)/.test(md),
   "grouped by constraint with counts", md.slice(0, 300));
ok(/\| Quarterly Tax Program \(QTP\) \| Home-grown \| RMJ schedule \| Not scanned \|/.test(md) && /\| DevSecOps \|/.test(md) && /Not applicable/.test(md), "one table row per application with the DevSecOps column");
ok(!/@/.test(md), "no address in the Markdown");
const csv = toCsv(SEED);
ok(csv.split("\n").length === 14 && csv.startsWith("app_id,app_name,app_class") && /devsecops_integration/.test(csv.split("\n")[0]), "the CSV is a header and thirteen rows with the DevSecOps columns");

console.log("-- a local save");
const next = applyLocal(SEED, [], { ...SEED[8], scan_status: "SCANNED", scan_types: "web, api", constraint_kind: "NONE", devsecops_integration: "INTEGRATED", devsecops_detail: "Jenkins: SAST, SCA, secrets" }, "pb-team");
ok(next.apps.length === 13 && next.apps[8].scan_status === "SCANNED" && next.log.length === 5 && next.log.every((l) => l.author === "pb-team") && next.log.some((l) => l.field === "scan_status" && l.before === "NOT_SCANNED" && l.after === "SCANNED"),
   "a save replaces the row and logs one line per changed field with who", next.log.map((l) => l.field).join(","));
const added = applyLocal(SEED, [], { ...blankApp(), app_name: "Client portal", app_class: "SAAS", scan_status: "SCANNED" }, "pb-team");
ok(added.apps.length === 14 && added.apps[13].app_id && summarise(added.apps).byClass.SAAS === 1, "a new application gets an id and counts in its class");

console.log("-- the starter from Interface 360");
const SYS = [{ system: "STAR", party: "INTERNAL", owner: "Core Platform", ownerSource: "interfaces", interfaces: 40, inbound: 10, outbound: 30, projectId: "P1", carriesPii: true, appId: null },
  { system: "Vendor Feed", party: "VENDOR", owner: "", interfaces: 2, inbound: 2, outbound: 0, carriesPii: false, appId: null },
  { system: "SharePoint", party: "INTERNAL", owner: "Collab", ownerSource: "interfaces", interfaces: 2, inbound: 1, outbound: 1, carriesPii: false, appId: null }];
const star = starterFromSystems(SYS);
ok(star.length === 2 + 13 && star[0].app_id === "IF-STAR" && star[0].scan_status === "UNKNOWN" && star[0].owner_team === "Core Platform" && /40 interfaces \(10 in, 30 out\); project P1; carries PII/.test(star[0].notes)
   && star[1].app_class === "VENDOR_PACKAGE" && star[2].app_name === "SharePoint" && star[2].source_ref === "Interface 360 system; owner from interfaces",
   "every Interface 360 system is a starter row with its owner, counts, project and PII, not yet declared; a vendor party is a vendor package; a thread row with the same name gives way to the system", star.slice(0, 3).map((a) => [a.app_id, a.app_class, a.owner_team]));
ok(appFromSystem({ system: "A/B C" }).app_id === "IF-ABC" && summarise(star).unknown === 3, "ids are the name folded; the undeclared count follows");

console.log("-- the page");
const page = renderToStaticMarkup(<Cyber360 t={tLight} initial={{ apps: star, log: next.log, live: true, seeded: true, tab: "Inventory", name: "pb-team", starter: { systems: 3, thread: 12 } }} />);
ok(/Cyber Security 360/.test(page) && /starter inventory: 3 systems from Interface 360 and 12 from the Application Scans thread, not yet saved/.test(page) && />live</.test(page), "the page says what it is and where the unsaved starter came from");
ok(/Add an application/.test(page) && /Download Excel/.test(page) && /Upload Excel/.test(page) && /Save the starter inventory/.test(page) && !/Copy the link for developers/.test(page) && !/Copy the not-scanned list/.test(page),
   "the actions sit in the inventory tab: add, download, upload, save the starter; no copy buttons");
ok(/change a row and Save it, or Edit for every field/.test(page) && (page.match(/>Edit</g) || []).length === 15 && /<select[^>]*>[^]*?Not yet declared/.test(page) && /placeholder="owner team"/.test(page) && /placeholder="why a scan is not required"/.test(page),
   "every row is editable in place: runtime, scan status, constraint and why, DevSecOps, owner, lifecycle, with Edit for the whole form (class and surface are in the form)");
ok(/15<\/div>/.test(page) && /not scanned/.test(page) && /not yet declared/.test(page) && /constraints to review/.test(page) && /to scan/.test(page), "the tiles");
ok(/Scan policy, as stated by the scan group/.test(page) && /SharePoint goes through the server scan only/.test(page), "the policy card");
for (const n of ["STAR", "Vendor Feed", "Quarterly Tax Program (QTP)", "BBH_PB_Interfaces", "Email Tool", "EFTPS", "Universal Client", "SharePoint"]) ok(page.includes(n), `row ${n}`);
ok(/Core Platform/.test(page) && /No web or API surface/.test(page) && /Legacy stack, retiring/.test(page) && /To review/.test(page) && /Not integrated/.test(page) && /Not applicable/.test(page), "the owner from Interface 360, the why, the decision and the DevSecOps column");
ok(/apps\.xlsx/.test(page), "the Excel download points at the API workbook when live");
const local = renderToStaticMarkup(<Cyber360 t={tLight} initial={{ apps: SEED, log: [], live: false, seeded: false, name: "" }} />);
ok(/local only/.test(local) && /Download CSV/.test(local) && !/apps\.xlsx/.test(local) && /your name/.test(local), "off the API the page says local only, offers CSV and asks who you are");
const opened = renderToStaticMarkup(<Cyber360 t={tLight} initial={{ apps: SEED, log: [], live: true, seeded: false, open: "CS-009", name: "pb-team" }} />);
ok(/Declare · Email Tool/.test(opened) && /Is it scanned\?/.test(opened) && /why a scan is not required/.test(opened) && /DevSecOps integration/.test(opened) && /Scan group decision/.test(opened) && /Filled by the scan group, not the developer/.test(opened),
   "opening a row shows the declaration form: the application, the scan, the constraint, DevSecOps, and the scan group's own section");
const review = renderToStaticMarkup(<Cyber360 t={tDark} initial={{ apps: [...SEED, { ...blankApp(), app_id: "IF-X", app_name: "Imported system", scan_status: "UNKNOWN" }], log: [], live: true, seeded: false, tab: "Not scanned review", name: "x" }} />);
ok(/Applications not covered by the application scan · 13/.test(review) && /1 application not yet declared by their owners/.test(review) && /No web or API surface/.test(review) && /Copy this list as Markdown/.test(review), "the review tab is the grouped list, says what is still undeclared, and copies itself as Markdown");
const logp = renderToStaticMarkup(<Cyber360 t={tLight} initial={{ apps: next.apps, log: next.log, live: true, seeded: false, tab: "Change log", name: "x" }} />);
ok(/Change log/.test(logp) && /scan_status/.test(logp) && /NOT_SCANNED/.test(logp) && /pb-team/.test(logp), "the change log shows field, before, after and who");
ok(!/Interface 360 systems/.test(page) && (page.match(/role="tab"/g) || []).length === 3, "three tabs: the inventory, the review, the log; the Interface 360 list is the starter, not a tab");
ok(!/NaN|undefined|\[object Object\]/.test(page + local + opened + review + logp), "nothing undefined in any tab, light or dark");
ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(page + opened + review) && !/testbbh|\.bbh\.com|https?:\/\/[a-z]/i.test(page + opened + review), "no address and no host on any screen");
const form = renderToStaticMarkup(<AppForm t={tLight} app={blankApp()} onSave={() => {}} onCancel={() => {}} who="x" />);
ok(/Add an application/.test(form) && Object.values(VALID).every((v) => form.includes(v)) && Object.values(DEVSECOPS).every((v) => form.includes(v)) && /Save declaration/.test(form), "the blank form offers every decision and DevSecOps value");
ok(/Applications not covered/.test(renderToStaticMarkup(<ReviewTab t={tLight} apps={SEED} />)), "the review tab renders alone");

console.log("-- wired in");
const SRC = fs.existsSync("src/Cyber360.jsx") ? "src" : path.join("ui", "src");
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8"), app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), client = fs.readFileSync(path.join(SRC, "cyber360Api.js"), "utf8");
ok(/\['cyber360', 'Cyber Security 360'/.test(shell) && /group: 'Governance'[\s\S]*?cyber360/.test(shell), "Cyber Security 360 sits under Governance in the nav");
ok(/import Cyber360 from "\.\/Cyber360\.jsx"/.test(app) && /cyber360: <Cyber360 t=\{t\} \/>/.test(app), "and routes to the page");
ok(!/from "\.\/api\.js"/.test(client) && !/[\w.+-]+@[\w-]+\.[\w.-]+/.test(client), "the client is self-contained and carries no address");
const sql = fs.readFileSync(path.join(SRC, "..", "..", "sql", "88_cyber360.sql"), "utf8");
ok(/CREATE TABLE cyber_app \(/.test(sql) && /devsecops_integration/.test(sql) && /cyber_app_log/.test(sql) && /-955/.test(sql) && /-1430/.test(sql), "sql/88: the inventory and its log, DevSecOps columns, idempotent");

console.log();
if (BAD) { console.log(`${BAD} assertion(s) failed`); process.exit(1); }
console.log("cyber360 assertions pass");
