// What each warehouse table IS, in business words.
//
// Same house pattern as seiCrosswalkApi.js and for the same reason: nothing
// here touches api.js, which is ahead in working copies and behind in the
// repo. BizLineage imports from here directly.
//
// EVERY CALL FALLS BACK TO "NOT LOADED", NEVER TO "NOTHING EXISTS". A
// warehouse with no catalogue must render exactly as it does today — the
// physical name — rather than a blank card. The difference between "this
// table has no business name" and "the catalogue did not answer" is the
// whole reason /health exists, and `ok:false` is how a caller tells them
// apart without guessing.

import { useEffect, useState } from "react";

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
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const catalogApi = {
  // Did the load land? Three states an empty payload cannot distinguish:
  // no table, empty table, rows that match nothing in the lineage.
  health: (data_source) =>
    _get(`/business-catalog/health${_qs({ data_source })}`,
      () => ({ data_source, ok: false, table_exists: false, rows: 0,
               reason: "The catalogue service did not answer." })),

  tables: (data_source, group) =>
    _get(`/business-catalog/tables${_qs({ data_source, group })}`,
      () => ({ tables: [], count: 0, ok: false })),

  table: (table_name, data_source) =>
    _get(`/business-catalog/table${_qs({ table_name, data_source })}`,
      () => ({ table_name, found: false, entry: null })),

  groups: (data_source) =>
    _get(`/business-catalog/groups${_qs({ data_source })}`,
      () => ({ groups: [], count: 0 })),
};

/** The catalogue for one warehouse, keyed by table name.
 *
 *  Returns `{ by, ok, health }`. `by` is always an object, so a caller can
 *  write `by[t]?.business_name || t` and get today's behaviour when nothing
 *  is loaded — the physical name — with no branch of its own. */
export function useBusinessCatalog(dataSource) {
  const [state, setState] = useState({ by: {}, ok: false, health: null });

  useEffect(() => {
    let live = true;
    setState({ by: {}, ok: false, health: null });
    Promise.all([catalogApi.tables(dataSource), catalogApi.health(dataSource)])
      .then(([t, h]) => {
        if (!live) return;
        const by = {};
        (t.tables || []).forEach((r) => {
          if (r.table_name) by[_key(r.table_name)] = r;
        });
        setState({ by, ok: Boolean(t.ok), health: h });
      });
    return () => { live = false; };
  }, [dataSource]);

  return state;
}

// TRIM AS WELL AS UPPERCASE. The connector writes `tbl.strip().upper()`, so
// the keys are clean — but the name arriving from a lineage row is whatever
// the workbook held, and a hand-edited sheet is exactly where a trailing
// space comes from. A lookup that matched on case but not on whitespace
// would miss those rows and show the physical name, which looks identical
// to the catalogue not being loaded at all.
const _key = (t) => String(t ?? "").trim().toUpperCase();

/** The business name if there is one, else the physical name. Never blank. */
export const bizName = (by, table) =>
  (by && by[_key(table)]?.business_name) || (table == null ? "" : String(table));

/** The catalogue row, or null. */
export const bizEntry = (by, table) =>
  (by && by[_key(table)]) || null;

export default catalogApi;
