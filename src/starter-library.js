// Original starter drawings: editable 24 × 24 arrow glyphs, independent of any icon pack.
const arrow = (name, rotation) => ({
  name, grid: 0.1, weight: 1.6, provenance: 'hand-built',
  symmetry: { mirror: null, rotate: 1 },
  layers: [{ id: 'arrow', name: 'Arrow', role: 'primary', paint: 'stroke', node: {
    op: 'union', name: 'Arrow', transform: { origin: [12, 12], rotate: rotation }, children: [
      { shape: 'line', name: 'Shaft', x1: 5, y1: 12, x2: 19, y2: 12 },
      { shape: 'polyline', name: 'Arrowhead', pts: [[13, 6], [19, 12], [13, 18]], closed: false },
    ],
  } }],
});
export const LIBRARY = [arrow('arrow-right', 0), arrow('arrow-down', 90), arrow('arrow-left', 180), arrow('arrow-up', 270)];
