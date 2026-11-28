// The left nav: six sections by what the user is doing, Home and pinned pages
// on top, an accordion when expanded and an icon rail with flyouts when
// collapsed. Every page keeps its route; nothing is lost in the regrouping.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import NavRail, { sectionOf, labelOf, StatusDot, RAIL_W, FULL_W, MAX_PINS } from "../src/NavRail.jsx";
import { MODULE_STATUS } from "../src/navStatus.jsx";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const SRC = fs.existsSync("src/AppShell.jsx") ? "src" : path.join("ui", "src");
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8");
const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
const t = { navy: "#10193b", accent: "#0f4775", text: "#1a1a1a", sub: "#4a5560", border: "#d9dee3", radius: { md: 6 } };

// The groups as AppShell declares them, read from the source so the test and the app cannot drift.
const src = shell.slice(shell.indexOf("const NAV_GROUPS = ["), shell.indexOf("];", shell.indexOf("const NAV_GROUPS = [")) + 2);
const GROUPS = new Function(src.replace("const NAV_GROUPS =", "return") )();
const keys = GROUPS.flatMap((g) => g.items.map((i) => i[0]));

console.log("-- the grouping");
ok(GROUPS.filter((g) => g.group).map((g) => g.group).join("|") === "Catalog|Lineage & Analysis|Build|Operate|Govern|Admin", "six sections in order", GROUPS.map((g) => g.group).join("|"));
ok(GROUPS[0].group === null && GROUPS[0].items[0][0] === "home", "Home stands alone on top");
ok(keys.length === 29 && new Set(keys).size === 29, "29 pages, no duplicates", keys.length);
ok(!/group: '(Governance|Architecture|Utilities|Events|Lineage)'/.test(shell), "the old groups are gone");
ok(GROUPS.filter((g) => g.group).every((g) => g.key && /^(catalog|lineage|build|operate|govern|admin)$/.test(g.key)), "every section names its icon");
const routed = [...app.matchAll(/^\s*([a-z0-9]+): </gm)].map((m) => m[1]);
const missing = keys.filter((k) => k !== "home" && routed.length && !routed.includes(k));
ok(missing.length === 0, "every nav page has a route in App.jsx", missing.join(","));
ok(sectionOf(GROUPS, "guardrails") === "operate" && sectionOf(GROUPS, "hub") === "build" && sectionOf(GROUPS, "security") === "govern" && sectionOf(GROUPS, "event360") === "catalog" && sectionOf(GROUPS, "home") === null, "pages sit where the mockup put them");
ok(labelOf(GROUPS, "dataanalysis") === "Historical Data Analysis" && labelOf(GROUPS, "guardrails") === "Integration 360 - Run", "labels: the long one shortened, the Run/Design pair kept");

console.log("-- expanded");
const full = renderToStaticMarkup(<NavRail t={t} groups={GROUPS} route="guardrails" onNav={() => {}} collapsed={false} onToggle={() => {}} initial={{ open: {}, pins: ["lineage", "hub"] }} />);
ok(/data-nav-mode="full"/.test(full) && keys.every((k) => new RegExp(`data-nav="${k}"`).test(full)), "all 29 pages render when every section is open");
ok(/data-pinned/.test(full) && /PINNED/.test(full) && (full.match(/data-nav="lineage"/g) || []).length === 2, "pinned pages repeat on top");
ok(/aria-current="page"[^>]*data-nav="guardrails"/.test(full) && /border-left:3px solid #2fc1a9/.test(full), "the current page is marked with the teal bar");
ok((full.match(/aria-expanded="true"/g) || []).length === 6 && !/aria-expanded="false"/.test(full), "sections default open");
const folded = renderToStaticMarkup(<NavRail t={t} groups={GROUPS} route="guardrails" onNav={() => {}} collapsed={false} onToggle={() => {}} initial={{ open: { catalog: false, operate: false, admin: false }, pins: [] }} />);
ok(!/data-nav="interface"/.test(folded) && /data-nav="recon"/.test(folded) && !/data-nav="datasources"/.test(folded), "a closed section hides its pages, except the one holding the current page, which stays open");
ok(/data-section="catalog" data-open="false"/.test(folded) && />6</.test(folded), "a closed section shows its count");
ok(/data-status="wip"/.test(full) && !/IN BUILD/.test(full) && /title="In build · 60%/.test(full), "in build is a dot with a tooltip, not a pill");
ok(/Collapse navigation/.test(full) && /in build/.test(full) && /planned/.test(full), "collapse control and the legend are there");
ok(/aria-label="Unpin Lineage"/.test(full) && /aria-label="Pin Recon 360"/.test(full), "pin controls are real buttons with names");

console.log("-- collapsed rail");
const rail = renderToStaticMarkup(<NavRail t={t} groups={GROUPS} route="guardrails" onNav={() => {}} collapsed={true} onToggle={() => {}} initial={{ open: {}, pins: [] }} />);
ok(/data-nav-mode="rail"/.test(rail) && (rail.match(/data-section="/g) || []).length === 6 && /data-nav="home"/.test(rail) && !/data-nav="recon"/.test(rail), "six section icons and Home; pages wait in flyouts");
ok(/aria-current="true"[^>]*data-section="operate"/.test(rail) || /data-section="operate"[^>]*aria-current="true"/.test(rail), "the section holding the current page is marked");
ok(/aria-label="Catalog"/.test(rail) && /aria-label="Lineage &amp; Analysis"/.test(rail) && /Expand navigation/.test(rail), "icon buttons carry the section names");
const fly = renderToStaticMarkup(<NavRail t={t} groups={GROUPS} route="guardrails" onNav={() => {}} collapsed={true} onToggle={() => {}} initial={{ open: {}, pins: [], fly: "lineage" }} />);
ok(/data-flyout="lineage"/.test(fly) && /role="menu"/.test(fly) && /data-nav="impact"/.test(fly) && /6 pages/.test(fly) && !/data-nav="recon"/.test(fly), "a section's flyout lists its pages and nothing else");
ok(RAIL_W === 60 && FULL_W === 248 && MAX_PINS === 5, "60px rail, 248px nav, five pins");
ok(renderToStaticMarkup(<StatusDot id="lineage" />) === "" && /data-status="wip"/.test(renderToStaticMarkup(<StatusDot id="recon" />)) && MODULE_STATUS.recon, "a live page has no mark");

console.log("-- the shell");
ok(/<NavRail t=\{t\} groups=\{groups\} route=\{route\} onNav=\{onNav\} collapsed=\{collapsed\}/.test(shell) && !/railW/.test(shell), "AppShell draws the nav through NavRail");
ok(/data-breadcrumb/.test(shell) && /<NavBadge id=\{route\} \/>/.test(shell), "the page breadcrumb carries the section and the full status badge");
ok(/filterNav\(NAV_GROUPS/.test(shell), "role filtering still runs before the nav is drawn");

console.log("-- nothing leaks");
const nav = fs.readFileSync(path.join(SRC, "NavRail.jsx"), "utf8");
ok(!/https?:\/\/|testbbh|apps\.ocp|@bbh\.com/.test(nav + full + rail + fly), "no URL, hostname or address in the nav");
const sql = fs.readFileSync(path.join(SRC, "..", "..", "sql", "91_nav_sections.sql"), "utf8");
ok(/'Lineage & Analysis'/.test(sql) && /'Operate'/.test(sql) && /nav_group/.test(sql) && /COMMIT/.test(sql) && !/DELETE|DROP|TRUNCATE/i.test(sql), "the security module groups follow the nav, by update only");

console.log(BAD ? `\n${BAD} assertion(s) failed` : "\nnav-rail assertions pass");
if (BAD) process.exitCode = 1;
