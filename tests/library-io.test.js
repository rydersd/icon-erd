import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibrary, mergeLibrary, libraryDocument } from '../src/library-io.js';
import { LIBRARY } from '../src/starter-library.js';
const icon = (name, extra = {}) => ({ ...structuredClone(LIBRARY[0]), name, ...extra });

test('one/all JSON round trips preserve metadata, colors, group symmetry and app settings', () => {
  const a = icon('suggestion', { aliases: ['vote', 'ballot'], description: 'Choose an option', kind: 'app-icon', exportSize: 1024, setStyle: { thickness: 2, rounding: 0.5 } });
  a.layers[0].color = '#ff3300'; a.layers[0].node.symmetry = { rotate: 6, axis: { x: 8, y: 9 } };
  assert.deepEqual(parseLibrary(JSON.stringify(libraryDocument([a], 'one'))), [a]);
  assert.equal(parseLibrary(JSON.stringify(libraryDocument([a, icon('other')]))).length, 2);
});
test('add keeps originals and reserves every incoming name before suffixing collisions', () => {
  const original = icon('arrow');
  const result = mergeLibrary([original], [icon('arrow'), icon('arrow-2')], 'add');
  assert.deepEqual(result.library.map(g => g.name), ['arrow', 'arrow-3', 'arrow-2']);
  assert.equal(result.library[0], original);
  assert.equal(result.replaced, 0);
});
test('overwrite replaces only matching names and also adds new names', () => {
  const result = mergeLibrary([icon('arrow'), icon('untouched')], [icon('arrow', { weight: 2 }), icon('new')], 'overwrite');
  assert.equal(result.library[0].weight, 2); assert.equal(result.library[1].name, 'untouched');
  assert.equal(result.replaced, 1); assert.equal(result.added, 1);
});
test('invalid batches and duplicate names fail without mutating original inputs', () => {
  const original = [icon('a')], snapshot = JSON.stringify(original);
  assert.throws(() => parseLibrary(JSON.stringify([icon('a'), { name: 'broken', layers: [{}] }])));
  assert.throws(() => parseLibrary(JSON.stringify([icon('a'), icon('a')])));
  assert.throws(() => parseLibrary(JSON.stringify({ format: 'glyph-workbench-library', version: 2, glyphs: original })));
  assert.equal(JSON.stringify(original), snapshot);
});

test('import rejects injected color, cap and numeric markup without accepting unsafe metadata', () => {
  const injected = icon('unsafe'); injected.layers[0].color = 'red" onload="alert(1)';
  assert.throws(() => parseLibrary(JSON.stringify(injected)), /hex color/);
  delete injected.layers[0].color; injected.layers[0].node.children[0].cap = 'round" onload="alert(1)';
  assert.throws(() => parseLibrary(JSON.stringify(injected)), /line cap/);
  delete injected.layers[0].node.children[0].cap; injected.layers[0].node.children[0].x1 = '<img src=x>';
  assert.throws(() => parseLibrary(JSON.stringify(injected)), /numeric/);
});
