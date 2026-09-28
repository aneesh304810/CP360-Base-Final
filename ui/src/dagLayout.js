// Layered left-to-right layout for an operator graph.
//
// Depth is the LONGEST path from a node with no inbound edge, not the
// shortest. With the shortest, a field consumed by both an inner and an
// outer call sits beside the inner one and its edge to the outer call runs
// backwards through the picture. With the longest, an operator is always
// to the right of everything it consumes, which is the one property that
// makes a left-to-right reading true.
//
// The graphs are small — tens of nodes — so longest-path is exact and
// instant, and there is no reason to approximate.

export const NODE_W = 168;
export const NODE_H = 46;
export const LAYER_GAP = 58;
export const ROW_GAP = 12;
export const BAND_PAD = 18;
export const TRACK_GAP = 26;
export const TRACKS = ["legacy", "sei"];

/** Longest-path depth per node. Cycles cannot occur in an expression tree,
 *  but a malformed graph must not hang the page, so the walk carries its
 *  own visiting set and treats a revisit as depth 0. */
export function depths(nodes, edges) {
  const inn = new Map(nodes.map((n) => [n.id, []]));
  edges.forEach(([a, b]) => { if (inn.has(b) && inn.has(a)) inn.get(b).push(a); });
  const d = new Map();
  const visit = (id, seen) => {
    if (d.has(id)) return d.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = inn.get(id) || [];
    const v = parents.length
      ? Math.max(...parents.map((p) => visit(p, seen) + 1)) : 0;
    seen.delete(id);
    d.set(id, v);
    return v;
  };
  nodes.forEach((n) => visit(n.id, new Set()));
  return d;
}

/** Positions for every node, plus one band per track.
 *
 *  Prose nodes are laid out in a column of their own at the far right of
 *  their track rather than interleaved: they are commentary on the rule,
 *  not a step in it, and placing them in the flow would imply they
 *  compute something. */
export function layoutGraph(graph, opt = {}) {
  const nodes = (graph && graph.nodes) || [];
  const edges = (graph && graph.edges) || [];
  if (!nodes.length) return { nodes: [], bands: [], W: 0, H: 0 };

  const nw = opt.nodeW || NODE_W, nh = opt.nodeH || NODE_H;
  const d = depths(nodes.filter((n) => n.kind !== "prose"), edges);
  const placed = nodes.map((n) => ({ ...n }));

  const tracks = TRACKS.filter((t) => placed.some((n) => n.track === t));
  const bands = [];
  let y = 0;
  let maxW = 0;

  tracks.forEach((tr) => {
    const mine = placed.filter((n) => n.track === tr);
    const flow = mine.filter((n) => n.kind !== "prose");
    const prose = mine.filter((n) => n.kind === "prose");

    const layers = new Map();
    flow.forEach((n) => {
      const k = d.get(n.id) || 0;
      if (!layers.has(k)) layers.set(k, []);
      layers.get(k).push(n);
    });
    const maxD = layers.size ? Math.max(...layers.keys()) : 0;
    const proseCol = prose.length ? maxD + 1 : -1;
    if (prose.length) layers.set(proseCol, prose);

    const rows = layers.size ? Math.max(...[...layers.values()].map((a) => a.length)) : 1;
    const bandH = rows * nh + (rows - 1) * ROW_GAP + BAND_PAD * 2;
    const cols = (prose.length ? proseCol : maxD) + 1;

    [...layers.keys()].sort((a, b) => a - b).forEach((k) => {
      const list = layers.get(k);
      const stack = list.length * nh + (list.length - 1) * ROW_GAP;
      let ny = y + BAND_PAD + (bandH - BAND_PAD * 2 - stack) / 2;
      list.forEach((n) => {
        n.x = BAND_PAD + k * (nw + LAYER_GAP);
        n.y = ny; n.w = nw; n.h = nh;
        ny += nh + ROW_GAP;
      });
    });

    const bw = BAND_PAD * 2 + cols * nw + Math.max(0, cols - 1) * LAYER_GAP;
    maxW = Math.max(maxW, bw);
    bands.push({ track: tr, y, h: bandH, w: bw });
    y += bandH + TRACK_GAP;
  });

  return { nodes: placed, bands, W: maxW, H: Math.max(0, y - TRACK_GAP) };
}

export default layoutGraph;
