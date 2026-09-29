// The sidebar must hide what a person cannot open, and must not hide
// anything at all when there is no login.
//
// THE BUG THIS EXISTS FOR IS THE SECOND HALF. CP 360 has run without
// authentication since it was built. The moment /auth/me exists, every
// deployment that has not configured AD starts receiving an answer from
// it — and if "no modules listed" is read as "no modules allowed", the
// sidebar empties for everybody and the app looks broken rather than
// unconfigured. So `null` (do not filter) and `[]` (filter to nothing)
// are different values with different renderings, and the difference is
// asserted here rather than left to whichever call site read it last.

import { filterNav, allowed, OFF } from "../src/securityApi.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

const NAV = [
  { group: null, items: [["home", "Home", "H"]] },
  { group: "Catalog", items: [["interface", "Interface 360", "I"],
                              ["api", "API 360", "A"],
                              ["data", "Data 360", "D"]] },
  { group: "Admin", items: [["datasources", "Data Sources", "S"],
                            ["security", "Security Entitlement", "K"]] },
];

const keys = (g) => g.flatMap((x) => x.items.map((i) => i[0]));

// ---- no filtering -------------------------------------------------------
[null, undefined].forEach((v) => {
  ok(filterNav(NAV, v) === NAV,
     `modules=${String(v)} returns the very same array, untouched`);
  ok(allowed(v, "anything") === true, `modules=${String(v)}: everything allowed`);
});
ok(OFF.modules === null, "the offline answer is null, not []", OFF.modules);
ok(OFF.authenticated === false, "and not authenticated");

// ---- filtering ----------------------------------------------------------
const some = filterNav(NAV, ["home", "data"]);
ok(keys(some).join(",") === "home,data", "only granted items survive", keys(some));
ok(some.length === 2, "and a group emptied by the filter is dropped entirely",
   some.map((g) => g.group));
ok(some[1].group === "Catalog", "the surviving group keeps its heading",
   some[1].group);
ok(NAV[1].items.length === 3, "the source array is not mutated",
   NAV[1].items.length);

// ---- the empty answer is a real answer ---------------------------------
const none = filterNav(NAV, []);
ok(Array.isArray(none) && none.length === 0,
   "granted nothing: every group goes, including Home's", none.length);
ok(allowed([], "home") === false, "and allowed() agrees");

// ---- order is the sidebar's, not the grant list's ----------------------
const scrambled = filterNav(NAV, ["security", "api", "home"]);
ok(keys(scrambled).join(",") === "home,api,security",
   "items keep sidebar order however the grants were listed", keys(scrambled));

// ---- a grant naming something that is not in the sidebar ---------------
// The API rejects unknown keys on save, but an older grant can outlive a
// renamed module. It must be ignored, never rendered as a blank row.
const stale = filterNav(NAV, ["home", "module_that_was_removed"]);
ok(keys(stale).join(",") === "home", "a grant for a module that no longer "
   + "exists in the sidebar renders nothing", keys(stale));

// ---- defensive shapes ---------------------------------------------------
ok(filterNav([], ["home"]).length === 0, "an empty sidebar stays empty");
ok(filterNav(null, ["home"]).length === 0, "a missing sidebar does not throw");
ok(filterNav(undefined, null) === undefined,
   "no filtering short-circuits before it touches the groups");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nsecurity-nav assertions pass");
if (bad) process.exit(1);
