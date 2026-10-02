// ---------- templates ----------
export const TEMPLATES = {
  blank: () => ({ name: 'untitled', grid: 0.1, weight: 1.2, symmetry: { mirror: null, rotate: 1 }, layers: [{ id: 'l1', name: 'Layer 1', role: 'primary', paint: 'stroke', node: { op: 'union', children: [] } }] }),
  document: () => ({ name: 'document', grid: 0.1, weight: 1.2, symmetry: { mirror: null, rotate: 1 }, layers: [
    { id: 'sheet', name: 'Sheet', role: 'primary', paint: 'stroke', node: { shape: 'polyline', closed: true, pts: [[5.4, 3, 1.2], [13.8, 3], [18.6, 7.8], [18.6, 21, 1.2], [5.4, 21, 1.2]] } },
    { id: 'fold', name: 'Fold', role: 'secondary', paint: 'stroke', node: { shape: 'polyline', pts: [[13.8, 3], [13.8, 7.8], [18.6, 7.8]] } },
    { id: 'lines', name: 'Lines', role: 'primary', paint: 'stroke', node: { op: 'union', children: [{ shape: 'line', x1: 8.4, y1: 12.6, x2: 15.6, y2: 12.6 }, { shape: 'line', x1: 8.4, y1: 16.2, x2: 15.6, y2: 16.2 }] } }] }),
  app: () => ({ ...TEMPLATES.blank(), name: 'app-icon', kind: 'app-icon', exportSize: 1024, layers: [{ id: 'background', name: 'Background', role: 'primary', paint: 'fill', color: '#0267e0', node: { shape: 'rect', x: 0, y: 0, w: 24, h: 24, r: [4.2, 4.2, 4.2, 4.2] } }, { id: 'artwork', name: 'Artwork', role: 'primary', paint: 'fill', color: '#ffffff', node: { op: 'union', children: [] } }] }),
  person: () => ({ name: 'person', grid: 0.1, weight: 1.2, symmetry: { mirror: null, rotate: 1 }, layers: [
    { id: 'head', name: 'Head', role: 'primary', paint: 'stroke', node: { shape: 'circle', cx: 12, cy: 7.8, r: 4.2 } },
    { id: 'body', name: 'Body', role: 'primary', paint: 'stroke', node: { shape: 'rect', x: 4.2, y: 14.4, w: 15.6, h: 6.6, r: [6, 6, 0.6, 0.6] } }] }),
};
export const DEFAULT_SHAPES = {
  circle: () => ({ shape: 'circle', cx: 12, cy: 12, r: 4.8 }),
  rect: () => ({ shape: 'rect', x: 7.2, y: 7.2, w: 9.6, h: 9.6, r: [0, 0, 0, 0] }),
  triangle: () => ({ shape: 'triangle', x: 6.6, y: 6, w: 10.8, h: 10.8, r: 0.6 }),
  line: () => ({ shape: 'line', x1: 6, y1: 12, x2: 18, y2: 12 }),
  ellipse: () => ({ shape: 'ellipse', cx: 12, cy: 12, rx: 6, ry: 4.2 }),
  polygon: () => ({ shape: 'polygon', cx: 12, cy: 12, r: 6, sides: 6, rotation: 0 }),
  star: () => ({ shape: 'polygon', cx: 12, cy: 12, r: 7.2, sides: 5, rotation: 0, star: { inner: 3.3 } }),
  arc: () => ({ shape: 'arc', cx: 12, cy: 12, r: 6, start: -90, end: 90 }),
  polyline: () => ({ shape: 'polyline', pts: [[6, 15], [12, 9], [18, 15]], closed: false }),
  path: () => ({ shape: 'path', d: 'M6 18L12 6L18 18' }),
};
export const PRIMARY_TOOLS = ['circle', 'rect', 'triangle', 'pen'];
export const MORE_TOOLS = ['line', 'ellipse', 'polygon', 'star', 'arc', 'polyline', 'path'];

