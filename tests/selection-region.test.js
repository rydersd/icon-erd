import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import { pathEnclosedBy } from '../src/selection-region.js';
new paper.Project();
const region = new paper.Path.Rectangle({ from: [0, 0], to: [10, 10], insert: false });
test('polygon enclosure rejects crossing and surrounding paths and accepts inside and boundary paths', () => {
  assert.equal(pathEnclosedBy(region, new paper.Path({ segments: [[2, 2], [8, 8]], insert: false })), true);
  assert.equal(pathEnclosedBy(region, new paper.Path({ segments: [[0, 0], [10, 0]], insert: false })), true);
  assert.equal(pathEnclosedBy(region, new paper.Path({ segments: [[2, 2], [12, 2]], insert: false })), false);
  assert.equal(pathEnclosedBy(region, new paper.Path.Rectangle({ from: [-2, -2], to: [12, 12], insert: false })), false);
});
test('enclosure tests curved intervals, concave regions, and every compound contour', () => {
  const curve = new paper.Path({ insert: false, segments: [new paper.Segment([2, 2], null, [0, -12]), new paper.Segment([8, 2], [0, -12], null)] });
  assert.equal(pathEnclosedBy(region, curve), false);
  const concave = new paper.Path({ insert: false, closed: true, segments: [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]] });
  assert.equal(pathEnclosedBy(concave, new paper.Path({ insert: false, segments: [[2, 8], [8, 8]] })), false);
  const compound = new paper.CompoundPath({ insert: false, children: [new paper.Path.Circle({ center: [3, 3], radius: 1, insert: false }), new paper.Path.Circle({ center: [9, 9], radius: 2, insert: false })] });
  assert.equal(pathEnclosedBy(region, compound), false);
});
