import { ap } from './affine.js';

// Merge only neighboring points touched by a drag. Preserve the two external
// handle vectors and lengths, rather than the tiny segment's internal handles.
export function mergeNearbyAnchors(node, movedIndices, matrix, tolerance, minimum = node.closed ? 3 : 2) {
  const count = node.pts?.length || 0;
  const indexMap = Array.from({ length: count }, (_, i) => i);
  if (node.shape !== 'pen' || !count) return { merged: 0, indexMap };
  const moved = new Set(movedIndices), candidates = [];
  for (let i = 0; i < count - (node.closed ? 0 : 1); i++) {
    const j = (i+1)%count;
    if (moved.has(i) === moved.has(j)) continue;
    const a = ap(matrix, node.pts[i]), b = ap(matrix, node.pts[j]);
    const distance = Math.hypot(a.x-b.x, a.y-b.y);
    if (distance <= tolerance) candidates.push({ i, j, distance });
  }
  candidates.sort((a,b) => a.distance-b.distance);
  const items = node.pts.map((point,i) => ({ point, indices: [i] }));
  let merged = 0;
  for (const { i, j } of candidates) {
    if (items.length <= minimum) break;
    const first = items.findIndex(item => item.indices.length === 1 && item.indices[0] === i);
    const second = items.findIndex(item => item.indices.length === 1 && item.indices[0] === j);
    if (first < 0 || second < 0) continue;
    const a = items[first].point, b = items[second].point;
    const point = { ...a, x: (a.x+b.x)/2, y: (a.y+b.y)/2 };
    delete point.in; delete point.out;
    for (const [source, side] of [[a,'in'],[b,'out']]) {
      if (source[side]) point[side] = [...source[side]];
    }
    if (a.r != null || b.r != null) point.r = ((a.r || 0)+(b.r || 0))/2;
    // Keep a closed path's starting point in slot zero when merging its seam.
    const keep = Math.min(first,second), remove = Math.max(first,second);
    items[keep] = { point, indices: [i,j] };
    items.splice(remove,1); merged++;
  }
  if (merged) {
    node.pts = items.map(item => item.point);
    items.forEach((item,i) => item.indices.forEach(old => { indexMap[old] = i; }));
    if (Array.isArray(node.roundingAnchors)) node.roundingAnchors = [...new Set(node.roundingAnchors.map(i => indexMap[i]))];
  }
  return { merged, indexMap };
}

// Run the same merge on a private copy: preview and release share one decision.
export function previewNearbyAnchors(node, movedIndices, matrix, tolerance, minimum) {
  const copy = structuredClone(node);
  const result = mergeNearbyAnchors(copy, movedIndices, matrix, tolerance, minimum);
  if (!result.merged) return [];
  const groups = new Map();
  result.indexMap.forEach((next, old) => {
    if (!groups.has(next)) groups.set(next, []);
    groups.get(next).push(old);
  });
  return [...groups.entries()].filter(([, indices]) => indices.length > 1).map(([next, indices]) => ({
    indices, points: indices.map(i => ap(matrix, node.pts[i])), point: ap(matrix, copy.pts[next]),
  }));
}
