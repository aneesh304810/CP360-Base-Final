// Browse-by-category for the Non-SEI dictionary on Datapoint 360.
//
// THE RULE. A category is the dictionary's own group ("Basic Information
// (BI)", "Tax (TX)"), which is how AddVantage itself files a field, with
// one exception: every user-defined field, UD/1 to UD/300, is one
// category whatever group the workbook put it in. There are up to 300 of
// them, they share one description, and a reader looks for them as a set.
// A field with no group falls back to its master, then to "Uncategorised",
// never to a guess.

export const UD_CATEGORY = "User-Defined (UD)";
const UD_RE = /^UD_\d+(?:_\d+)?$/;

export function categoryOf(d) {
  const code = String(d?.field_code_norm || "").toUpperCase();
  if (UD_RE.test(code)) return UD_CATEGORY;
  const g = (d?.business_function || "").trim();
  if (g) return g;
  const m = (d?.master_name || "").split(" · ")[0].trim();
  return m || "Uncategorised";
}

/* Numeric order for UD codes (UD_2 before UD_10, UD_23_1 before UD_23_2),
   the dictionary's order for everything else. */
export function udOrder(code) {
  const m = /^UD_(\d+)(?:_(\d+))?$/.exec(String(code || "").toUpperCase());
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : -1] : null;
}

export function categorize(defs) {
  const by = new Map();
  (defs || []).forEach((d) => {
    const c = categoryOf(d);
    const e = by.get(c) || { category: c, count: 0, pii: 0, mapped: 0, ud: c === UD_CATEGORY };
    e.count += 1;
    if (d.is_pii === "Y") e.pii += 1;
    if (Number(d.lineage_count) > 0) e.mapped += 1;
    by.set(c, e);
  });
  // largest first; the UD set pinned to the top because it is what the
  // AddVantage work is about right now, and "Uncategorised" last.
  return [...by.values()].sort((a, b) =>
    (b.ud - a.ud) || ((a.category === "Uncategorised") - (b.category === "Uncategorised")) ||
    (b.count - a.count) || a.category.localeCompare(b.category));
}

export function inCategory(defs, category) {
  if (!category) return defs || [];
  const out = (defs || []).filter((d) => categoryOf(d) === category);
  if (category === UD_CATEGORY) {
    out.sort((a, b) => {
      const x = udOrder(a.field_code_norm) || [1e9, 0], y = udOrder(b.field_code_norm) || [1e9, 0];
      return x[0] - y[0] || x[1] - y[1];
    });
  }
  return out;
}
