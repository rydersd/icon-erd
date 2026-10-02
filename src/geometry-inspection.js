// Diagnose coincident source curves without confusing filled-area intersections with duplicate paths.
const EPS = 1e-5;
const rounded = value => Math.round(value / EPS);
const keyOf = curve => {
  const values = curve.isStraight() ? [curve.point1.x, curve.point1.y, curve.point2.x, curve.point2.y] : curve.values;
  const reverse = curve.isStraight() ? [values[2], values[3], values[0], values[1]] : [values[6], values[7], values[4], values[5], values[2], values[3], values[0], values[1]];
  return [values.map(rounded).join(','), reverse.map(rounded).join(',')].sort()[0];
};
function overlapsLine(a, b) {
  if (!a.isStraight() || !b.isStraight()) return false;
  const p = a.point1, q = a.point2, r = b.point1, s = b.point2;
  const dx = q.x - p.x, dy = q.y - p.y, length = Math.hypot(dx, dy);
  if (length < EPS) return false;
  const distance = t => Math.abs(dx * (t.y - p.y) - dy * (t.x - p.x)) / length;
  if (distance(r) > EPS || distance(s) > EPS) return false;
  const project = t => ((t.x - p.x) * dx + (t.y - p.y) * dy) / length;
  const lo = Math.min(project(r), project(s)), hi = Math.max(project(r), project(s));
  return Math.min(length, hi) - Math.max(0, lo) > EPS;
}
export function inspectGeometry(forms) {
  const points = [], curves = [], overlaps = [];
  for (const form of forms) {
    const key = `${form.l}:${form.p.join('.')}`;
    const name = form.n.name || form.n.shape || 'path';
    const selection = { l: form.l, p: form.p };
    let index = 0;
    const paths = [...(form.fm.closed ? (form.fm.closed.children || [form.fm.closed]) : []), ...form.fm.open];
    for (const path of paths) {
      for (const segment of path.segments) points.push({ key, name, selection, index: index++, x: segment.point.x, y: segment.point.y });
      for (const curve of path.curves) curves.push({ curve, key: keyOf(curve), formKey: key, name, selection });
    }
  }
  // Bounding boxes reject unrelated curves before the exact coincidence tests.
  for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
    const a = curves[i], b = curves[j];
    if (!a.curve.bounds.intersects(b.curve.bounds, EPS)) continue;
    if (a.key === b.key || overlapsLine(a.curve, b.curve)) overlaps.push({ a, b, partial: a.key !== b.key });
  }
  return { points, overlaps };
}
