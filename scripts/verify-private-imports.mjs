import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import paper from 'paper';
import { createGlyphCore } from '../src/glyph-core.js';
import { parseLibrary, libraryDocument, mergeLibrary } from '../src/library-io.js';
import { LIBRARY } from '../src/starter-library.js';
new paper.Project(); const core = createGlyphCore(paper);
let library = LIBRARY;
for (const set of ['illtool', 'illmater', 'spurious-ecosystem', 'equinix']) {
  const text = await readFile(`imports/${set}-icons.json`, 'utf8');
  const glyphs = parseLibrary(text);
  assert.equal(glyphs.length, JSON.parse(text).count);
  for (const glyph of glyphs) {
    const layers = core.resolve(glyph);
    assert.ok(layers.every(layer => !layer.error), `${glyph.name}: ${layers.find(layer => layer.error)?.error}`);
    assert.ok(layers.some(layer => layer.d), `${glyph.name}: no geometry`);
  }
  assert.deepEqual(parseLibrary(JSON.stringify(libraryDocument(glyphs))), glyphs);
  library = mergeLibrary(library, glyphs, 'add').library;
  console.log(`${set}: ${glyphs.length} icons parsed, resolved and round-tripped; total ${library.length}`);
}
