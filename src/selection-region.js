/** Check every interval between boundary intersections, including curved paths. */
export function pathEnclosedBy(region, path) {
  const curves = path.getCurves();
  if (!curves.length) return false;
  const cuts = new Map(curves.map(curve => [curve, [0, 1]]));
  for (const location of path.getIntersections(region)) {
    const times = cuts.get(location.curve);
    if (times) times.push(location.time);
  }
  const inside = point => region.contains(point) || region.getNearestPoint(point)?.getDistance(point) <= 1e-7;
  return curves.every(curve => {
    const times = cuts.get(curve).sort((a, b) => a - b);
    return times.every(time => inside(curve.getPointAtTime(time))) &&
      times.slice(1).every((time, i) => inside(curve.getPointAtTime((times[i] + time) / 2)));
  });
}
