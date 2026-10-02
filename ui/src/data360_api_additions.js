// Data 360's legacy (Non-SEI) feed client.
//
// SAME HOUSE RULE AS seiCrosswalkApi.js, and for the reason that file
// spells out: nothing here touches api.js. api.js is ahead in working
// copies and behind in the repo, so editing it means a pull can replace a
// good file with a stale one plus these additions, killing the page on
// mount. Data360 imports from here directly.
//
// WHY THESE CALLS EXIST AT ALL. The Inbound Feeds tab read
// /data360/inbound-feeds, which is the SWP EOD dictionary — SWP feeds
// arriving under the SEI programme. It holds no AddVantage, STAR or UAF
// row and never will: those are the incumbent systems SEI replaces, and
// their feeds live in legacy_source_file, the one table in the schema
// that carries SOURCE_SYSTEM.
//
// So picking AddVantage and being shown the SWP Account feed was not a
// filter failing to apply. It was the SEI answer wearing a legacy badge,
// which is worse than no answer because it reads as one.
//
// Every fallback here is EMPTY, never mock. A legacy system with nothing
// ingested has to look empty — that is the whole point of the fix.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return fallback();
  }
}

const _qs = (o) => {
  const q = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const legacyFeedApi = {
  // How many feeds each legacy system has registered, per warehouse. This is
  // what lets the screen tell "this system sends nothing" apart from "this
  // system has not been ingested" — it cannot, so it says the honest thing
  // and names the table rather than rendering another system's rows.
  systems: () =>
    _get("/data360/legacy-feed-systems",
      () => ({ systems: [], table_present: false, registered_total: 0,
               unreachable: true })),

  feeds: (system, data_source, q) =>
    _get(`/data360/legacy-feeds${_qs({ system, data_source, q })}`,
      () => ({ system, data_source, feeds: [], count: 0, unreachable: true })),

  fields: (src_file, data_source) =>
    _get(`/data360/legacy-feed-fields${_qs({ src_file, data_source })}`,
      () => ({ feed: { src_file }, fields: [], field_count: 0,
               unreachable: true })),
};

export default legacyFeedApi;
