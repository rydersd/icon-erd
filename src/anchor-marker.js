// A point's marker describes its geometry; selection is a separate visual state.
export function anchorMarker(node, index, style = {}) {
  const point = node.pts?.[index];
  if (point && !Array.isArray(point)) {
    if (point.r > 0) return 'circle';
    const incoming = point.in, outgoing = point.out;
    const hasIn = incoming && Math.hypot(...incoming) > 1e-6, hasOut = outgoing && Math.hypot(...outgoing) > 1e-6;
    if (hasIn || hasOut) {
      if (!hasIn || !hasOut) return 'diamond';
      const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
      const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
      return Math.abs(cross) > 1e-5 * Math.hypot(...incoming) * Math.hypot(...outgoing) || dot >= 0 ? 'diamond' : 'circle';
    }
  }
  const tagged = !Array.isArray(node.roundingAnchors) || node.roundingAnchors.includes(index);
  if (!tagged) return 'square';
  const endpoint = !node.closed && (index === 0 || index === (node.pts?.length ?? 2) - 1) && ['pen', 'line', 'polyline', 'arc'].includes(node.shape);
  if (endpoint) return (style.endRounding ?? style.rounding ?? 0) > 0 ? 'circle' : 'square';
  return style.rounding > 0 ? 'circle' : 'square';
}
