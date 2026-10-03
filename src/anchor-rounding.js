// Match the evaluator's fillet eligibility and use actual curve tangents,
// retaining the original broken handles when a corner is rounded.
export function roundableAnchor(node, index, core) {
  if (node?.shape !== 'pen' || !Number.isInteger(index) || !node.pts?.[index]) return null;
  const count = node.pts.length;
  if (!node.closed && (index === 0 || index === count-1)) return null;
  const path = core.shapeItems({...node,pts:node.pts.map(point=>({...point,r:0}))})[0];
  if (!path?.curves.length) return null;
  const incoming = path.curves[(index-1+path.curves.length)%path.curves.length];
  const outgoing = path.curves[index%path.curves.length];
  const a = incoming.getTangentAtTime(1), b = outgoing.getTangentAtTime(0);
  if (a.isZero() || b.isZero()) return null;
  const turn = Math.abs(a.getDirectedAngle(b))*Math.PI/180;
  if (turn < 0.1 || turn > Math.PI-0.05) return null;
  const u = a.normalize().multiply(-1), v = b.normalize(), sum = u.add(v).normalize();
  const half = (Math.PI-turn)/2;
  return {bisector:{x:sum.x,y:sum.y},k:1/Math.sin(half)};
}
