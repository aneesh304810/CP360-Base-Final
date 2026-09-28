import { GLOSSARY_SECTIONS } from "../../ui/src/crosswalkGlossary.js";
const out = [];
out.push("# SEI crosswalk — what every tag means", "");
out.push("Generated from `ui/src/crosswalkGlossary.js`, which is what the");
out.push("Mapping & divergence screen shows behind its *what do these mean?*");
out.push("link. Edit that file, re-run the generator, and the two stay in step.");
out.push("");
out.push("The verdicts are not a severity scale and not opinions. They are the");
out.push("output of one algorithm applied in a fixed order, first match wins.");
out.push("");
out.push("**A column is tagged with the rule that stopped it, and nothing below");
out.push("that rule was tested.** A `NO_SOURCE` column is not a column whose");
out.push("types happen to be fine — its types were never compared, because there");
out.push("was nothing to compare them to.");
out.push("");
out.push("---", "");
for (const sec of GLOSSARY_SECTIONS) {
  out.push(`## ${sec.title}`, "");
  out.push(sec.intro, "");
  for (const k of sec.order) {
    const e = sec.info[k];
    if (e && typeof e === "object") {
      out.push(`### \`${k}\`${e.label && e.label !== k ? ` — shown as **${e.label}**` : ""}`, "");
      out.push(e.what || e.short, "");
      if (e.why)    out.push(`**Why a row gets it.** ${e.why}`, "");
      if (e.blocks) out.push(`**Blocks cutover.** ${e.blocks}`, "");
      if (e.clears) out.push(`**What clears it.** ${e.clears}`, "");
      if (e.watch)  out.push(`**What to watch.** ${e.watch}`, "");
    } else {
      out.push(`### \`${k}\``, "", e, "");
    }
  }
  out.push("---", "");
}
out.push("<!-- generated from ui/src/crosswalkGlossary.js — do not edit by hand -->");
process.stdout.write(out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
