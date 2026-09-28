// Feed code -> what the feed actually is.
//
// THE PROBLEM THIS SOLVES. The Source view listed three cards reading
// "STAR outbound dataset", with PEDDIFI1, TBMEIFI7 and ACDDIFI1 in small
// grey type underneath. The heading was identical on all three, so the
// only thing telling them apart was an eight-character code — and only
// someone who already knows the estate can read those. The flow diagram's
// middle column had the same problem.
//
// PEDDIFI1 is the portfolio valuation. ACDDIFI1 is the account file. Those
// are the words people use in the meeting where this screen gets opened.
//
// The names come from the API, which reads them out of FEED_ALIAS rather
// than out of this file. That matters: a business renaming a feed should
// be an UPDATE, not a UI release. Nothing is hardcoded here.

import { useEffect, useState } from "react";
import { crosswalkApi } from "./seiCrosswalkApi.js";

// The same normalisation the loader and the SQL use. A name that fails to
// attach because one side wrote a hyphen and the other an underscore is
// exactly the silent miss this codebase keeps hitting.
export function feedKey(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[\s/.-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Load the register for a warehouse. Returns a resolver that is safe to
 *  call before the fetch lands — it simply answers with the code. */
export function useFeedNames(dataSource) {
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (!dataSource) { setMap(null); return; }
    let live = true;
    crosswalkApi.feedNames(dataSource).then((r) => {
      if (!live) return;
      const m = new Map();
      (r.feeds || []).forEach((f) => {
        if (!f.name) return;
        // index under both the code and its normalised key, because the
        // caller may hold either
        if (f.code) m.set(feedKey(f.code), f);
        if (f.key) m.set(feedKey(f.key), f);
      });
      setMap(m);
    });
    return () => { live = false; };
  }, [dataSource]);

  return map;
}

/** The feed's business name, or null. Never the code — a caller that
 *  wants a fallback should say so, because "name or code" and "name only"
 *  are different questions and conflating them is how a code ends up
 *  rendered in a slot meant for prose. */
export function feedName(map, code) {
  if (!map || !code) return null;
  const hit = map.get(feedKey(code));
  return (hit && hit.name) || null;
}

/** `{name, code, both}` for a feed. `both` is what most labels want:
 *  "Portfolio Valuation · PEDDIFI1", collapsing to just the code when no
 *  name is registered. */
export function feedLabel(map, code) {
  const name = feedName(map, code);
  return { name, code: code || null,
           both: name ? `${name} · ${code}` : (code || "") };
}

export default useFeedNames;
