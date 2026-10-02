// Normalize a single closed contour to a parametric circle/ellipse. The Paper
// primitive has four cubic anchors; preserve winding for nonzero fill counters.
export function regularEllipse(node, core) {
  if (!node?.shape || node.deform?.length) return null;
  const paths = core.shapeItems(node);
  if (paths.length !== 1 || !paths[0].closed) return null;
  const bounds = core.rawBounds(node);
  if (!bounds || bounds[2] <= 0 || bounds[3] <= 0) return null;
  const [x,y,w,h] = bounds;
  const keep = {};
  for (const key of ['name','transform','symmetry','hidden','edge','cap','fillRule','component']) if (node[key] != null) keep[key] = structuredClone(node[key]);
  const shape = Math.abs(w-h) <= Math.max(w,h)*0.001 ? { shape:'circle',cx:x+w/2,cy:y+h/2,r:(w+h)/4 }
    : { shape:'ellipse',cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2 };
  return { ...shape, clockwise: paths[0].clockwise, ...keep };
}
