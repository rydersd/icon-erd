import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import { createGlyphCore } from '../src/glyph-core.js';
import { inspectGeometry } from '../src/geometry-inspection.js';
new paper.Project();
const core = createGlyphCore(paper);
const glyph = node => ({ name: 'test', layers: [{ id: 'test', paint: 'fill', node }] });
const item = node => { const result = core.evalNode(node); return result.closed || result.open[0]; };

test('compound conversion preserves two contours and a hole', () => {
  const node = { shape: 'path', d: 'M2 2L22 2L22 22L2 22ZM8 8L8 16L16 16L16 8Z' };
  const converted = core.toPen(node);
  assert.equal(converted.children.length, 2);
  assert.ok(Math.abs(item(node).area - item(converted).area) < 0.001);
  assert.equal(item(converted).contains(new paper.Point(12, 12)), false);
});
test('conversion preserves a compound hole alongside an open stroke', () => {
  const node = { shape: 'path', d: 'M2 2L22 2L22 22L2 22ZM8 8L8 16L16 16L16 8ZM1 1L23 1', fillRule: 'evenodd' };
  const before = core.evalNode(node), after = core.evalNode(core.toPen(node));
  assert.ok(Math.abs(before.closed.area - after.closed.area) < 0.001);
  assert.equal(after.closed.contains(new paper.Point(12, 12)), false);
  assert.equal(after.open.length, 1);
  assert.ok(Math.abs(before.open[0].length - after.open[0].length) < 0.001);
});
test('point insertion preserves Bezier geometry and converted transforms/deformers', () => {
  const node = { shape: 'circle', cx: 10, cy: 10, r: 4, deform: [{ type: 'skew', x: 0.3 }], transform: { origin: [10, 10], rotate: 27, scaleX: 1.3 } };
  const before = item(node), converted = core.toPen(node), after = item(converted);
  assert.equal(converted.deform, undefined);
  assert.ok(Math.abs(before.area - after.area) < 0.01);
  assert.ok(before.bounds.center.getDistance(after.bounds.center) < 0.001);
  const localPath = core.shapeItems(converted)[0], hit = localPath.curves[0].getPointAtTime(0.4);
  const result = core.insertPoint(converted, hit.x, hit.y);
  assert.equal(result.node.pts.length, converted.pts.length + 1);
  const inserted = core.shapeItems(result.node)[0];
  for (let n = 0; n <= 50; n++) {
    const point = localPath.getPointAt(n === 50 ? localPath.length : localPath.length * n / 50);
    assert.ok(inserted.getNearestPoint(point).getDistance(point) < 0.001);
  }
});
test('radial matrices have exact bounded counts and map a point to the requested angles', () => {
  for (const n of [1, 2, 3, 4, 6, 12, 32]) {
    const matrices = core.symmetryMatrices({ rotate: n, axis: { x: 12, y: 12 } });
    assert.equal(matrices.length, n);
    const points = matrices.map(m => new paper.Matrix(...m).transform(new paper.Point(16, 12)));
    assert.equal(new Set(points.map(p => `${p.x.toFixed(5)},${p.y.toFixed(5)}`)).size, n);
  }
  assert.equal(core.symmetryMatrices({ rotate: 3, mirror: 'xy' }).length, 12);
});
test('group radial symmetry leaves other groups unchanged and survives SVG export', () => {
  const node = { op: 'union', children: [{ op: 'union', symmetry: { rotate: 6 }, children: [{ shape: 'circle', cx: 18, cy: 12, r: 0.5 }] }, { shape: 'rect', x: 1, y: 1, w: 1, h: 1 }] };
  const result = item(node);
  assert.ok(result.contains(new paper.Point(18, 12)));
  assert.ok(result.contains(new paper.Point(15, 12 + 3 * Math.sqrt(3))));
  assert.ok(result.contains(new paper.Point(1.5, 1.5)));
  assert.ok(!result.contains(new paper.Point(22.5, 22.5)));
  assert.match(core.toSVG(glyph(node)), /<path/);
});
test('subtraction cuts a hole and open lines without producing a cutter edge', () => {
  const node = { op: 'subtract', children: [{ shape: 'rect', x: 2, y: 2, w: 20, h: 20 }, { shape: 'circle', cx: 12, cy: 12, r: 4 }] };
  const cut = item(node); assert.equal(cut.contains(new paper.Point(12, 12)), false);
  assert.equal(cut.contains(new paper.Point(4, 4)), true);
  const line = core.evalNode({ op: 'subtract', children: [{ shape: 'line', x1: 0, y1: 12, x2: 24, y2: 12 }, node.children[1]] });
  assert.equal(line.open.length, 2);
});
test('inspection catches reversed/partial line overlaps but not distinct curved geometry or crossing lines', () => {
  const forms = nodes => nodes.map((n, index) => ({ l: 0, p: [index], n, fm: core.form(n) }));
  const line = { shape: 'line', x1: 2, y1: 8, x2: 10, y2: 8 };
  assert.equal(inspectGeometry(forms([line, { ...line, x1: 10, x2: 2 }])).overlaps.length, 1);
  assert.equal(inspectGeometry(forms([line, { ...line, x1: 6, x2: 18 }])).overlaps.length, 1);
  assert.equal(inspectGeometry(forms([line, { shape: 'line', x1: 6, y1: 1, x2: 6, y2: 20 }])).overlaps.length, 0);
  const curve = handle => ({ shape: 'pen', closed: false, pts: [{ x: 2, y: 8, out: [0, handle] }, { x: 10, y: 8, in: [0, handle] }] });
  assert.equal(inspectGeometry(forms([curve(3), curve(-3)])).overlaps.length, 0);
});
test('multicolor app SVG retains colors and requested output dimensions', () => {
  const document = { kind: 'app-icon', exportSize: 1024, layers: [{ id: 'a', paint: 'fill', color: '#ff0000', node: { shape: 'circle', cx: 8, cy: 12, r: 4 } }, { id: 'b', paint: 'stroke', color: '#00ff00', node: { shape: 'line', x1: 12, y1: 12, x2: 20, y2: 12 } }] };
  const svg = core.toSVG(document); assert.match(svg, /width="1024" height="1024"/);
  assert.match(svg, /fill="#ff0000"/); assert.match(svg, /stroke="#00ff00"/);
});
test('whole-set rounding and thickness overrides keep parametric sources intact', () => {
  const node = { shape: 'rect', x: 4, y: 4, w: 16, h: 16 }, document = { ...glyph(node), setStyle: { thickness: 2.5, rounding: 1 } };
  const serialized = JSON.stringify(document); const svg = core.toSVG(document);
  assert.match(svg, /C/); assert.equal(JSON.stringify(document), serialized);
  document.layers[0].paint = 'stroke'; assert.match(core.toSVG(document), /stroke-width:var\(--icon-stroke-width,2.5\)/);
});

test('corner rounding rounds stroke caps and joins in runtime and baked exports without changing source choices', () => {
  const document = { ...glyph({ shape: 'path', d: 'M4 16L12 4L20 16', cap: 'butt' }), setStyle: { rounding: 0.5 } };
  document.layers[0].paint = 'stroke';
  const before = JSON.stringify(document);
  assert.match(core.toSVG(document), /stroke-linecap:round;stroke-linejoin:round/);
  assert.match(core.toSVG(document, { mode: 'baked', cap: 'square', join: 'miter' }), /stroke-linecap="round" stroke-linejoin="round"/);
  assert.equal(JSON.stringify(document), before);
  document.setStyle.rounding = 0;
  assert.match(core.toSVG(document), /stroke-linecap:butt;stroke-linejoin:var\(--icon-stroke-linejoin,round\)/);
  assert.match(core.toSVG(document, { mode: 'baked', cap: 'square', join: 'miter' }), /stroke-linecap="butt" stroke-linejoin="miter"/);
});
