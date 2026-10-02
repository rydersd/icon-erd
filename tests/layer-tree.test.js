import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureLayerNames, moveTreeItem, useAsCutter } from '../src/layer-tree.js';
import { normalizeGlyph, parseLibrary, libraryDocument } from '../src/library-io.js';

const leaf = name => ({ shape: 'circle', name, cx: 12, cy: 12, r: 2 });
const document = () => ({ name: 'test', layers: [{ id: 'one', name: 'Artwork', node: { op: 'union', children: [leaf('A'), leaf('B'), { op: 'union', name: 'Group', children: [leaf('C')] }] } }, { id: 'two', name: 'Details', node: { op: 'union', children: [] } }] });

test('tree moves reorder in both directions, nest into groups and move across layers without losing objects', () => {
  const glyph = document(), root = glyph.layers[0].node, a = root.children[0], b = root.children[1], group = root.children[2];
  assert.deepEqual(moveTreeItem(glyph, { l: 0, p: [0] }, { l: 0, p: [1] }, 'after'), { l: 0, p: [1] });
  assert.deepEqual(root.children, [b, a, group]);
  moveTreeItem(glyph, { l: 0, p: [1] }, { l: 0, p: [0] }, 'before');
  assert.deepEqual(root.children, [a, b, group]);
  assert.deepEqual(moveTreeItem(glyph, { l: 0, p: [0] }, { l: 0, p: [2] }, 'inside'), { l: 0, p: [1, 1] });
  assert.equal(group.children[1], a);
  assert.deepEqual(moveTreeItem(glyph, { l: 0, p: [1, 1] }, { l: 1, p: null }, 'inside'), { l: 1, p: [0] });
  assert.equal(glyph.layers[1].node.children[0], a);
  assert.equal(group.children.length, 1);
});
test('tree moves reject self/descendant drops atomically and reorder whole layers', () => {
  const glyph = document(), before = JSON.stringify(glyph);
  assert.equal(moveTreeItem(glyph, { l: 0, p: [] }, { l: 0, p: [2] }, 'inside'), null);
  assert.equal(moveTreeItem(glyph, { l: 0, p: [2] }, { l: 0, p: [2, 0] }, 'after'), null);
  assert.equal(moveTreeItem(glyph, { l: 0, p: [0] }, { l: 0, p: [0] }, 'before'), null);
  assert.equal(JSON.stringify(glyph), before);
  moveTreeItem(glyph, { l: 0, p: null }, { l: 1, p: null }, 'after');
  assert.deepEqual(glyph.layers.map(layer => layer.name), ['Details', 'Artwork']);
});
test('a cutter keeps every other sibling as its subject and retains the selected source object', () => {
  const glyph = document(), root = glyph.layers[0].node, cutter = root.children[1], others = [root.children[0], root.children[2]];
  assert.deepEqual(useAsCutter(glyph, { l: 0, p: [1] }), { l: 0, p: [1] });
  assert.equal(root.op, 'subtract'); assert.equal(root.children[1], cutter);
  assert.deepEqual(root.children[0].children, others);
  useAsCutter(glyph, { l: 0, p: [1] });
  assert.equal(root.op, 'union'); assert.equal(root.children[1], cutter);
  assert.deepEqual(root.children[0].children, others);
  assert.equal(useAsCutter(glyph, { l: 1, p: [] }), null);
});
test('unnamed imported layers and objects get readable persistent names; explicit names survive', () => {
  const glyph = document(); delete glyph.layers[1].name; delete glyph.layers[0].node.children[1].name;
  const snapshot = JSON.stringify(glyph), named = normalizeGlyph(glyph);
  assert.equal(JSON.stringify(glyph), snapshot);
  assert.equal(named.layers[0].name, 'Artwork'); assert.equal(named.layers[1].name, 'Layer 2');
  assert.equal(named.layers[0].node.children[0].name, 'A');
  assert.equal(named.layers[0].node.children[1].name, 'Circle 2');
  assert.deepEqual(parseLibrary(JSON.stringify(libraryDocument([named]))), [named]);
  assert.deepEqual(ensureLayerNames(structuredClone(named)), named);
});

test('turning off one cutter preserves other cutters and clears clearance metadata', () => {
  const subject = { shape: 'rect', x: 0, y: 0, w: 24, h: 24 }, a = { shape: 'circle', cx: 8, cy: 8, r: 2 }, b = { shape: 'line', x1: 4, y1: 4, x2: 20, y2: 20, edge: 'open' };
  const glyph = { layers: [{ node: { op: 'subtract', children: [subject, a, b] } }] };
  assert.deepEqual(useAsCutter(glyph, { l: 0, p: [2] }), { l: 0, p: [1] });
  assert.equal(glyph.layers[0].node.op, 'union');
  assert.equal(glyph.layers[0].node.children[0].op, 'subtract');
  assert.deepEqual(glyph.layers[0].node.children[0].children, [subject, a]);
  assert.equal(glyph.layers[0].node.children[1], b); assert.equal(b.edge, undefined);
});
