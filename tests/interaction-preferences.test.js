import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorMarker } from '../src/anchor-marker.js';
import { DEFAULT_SHORTCUTS, setShortcut, shortcutFromEvent } from '../src/shortcuts.js';
import { parseLibraryArchive, libraryDocument } from '../src/library-io.js';
import { LIBRARY } from '../src/starter-library.js';
test('marker shape distinguishes rounded, sharp and disconnected points independently of selection', () => {
  const node={shape:'pen',pts:[{x:0,y:0},{x:4,y:0},{x:4,y:4,in:[0,-1],out:[1,0]}]};
  assert.equal(anchorMarker(node,0,{rounding:1,endRounding:0}),'square');
  assert.equal(anchorMarker(node,1,{rounding:1,endRounding:0}),'circle');
  assert.equal(anchorMarker(node,2,{rounding:1,endRounding:1}),'diamond');
  node.roundingAnchors=[];assert.equal(anchorMarker(node,1,{rounding:1}),'square');
  node.pts[2].out=[0,1];assert.equal(anchorMarker(node,2),'circle');
});
test('shortcut remapping rejects conflicts and matches platform modifiers', () => {
  assert.equal(DEFAULT_SHORTCUTS.direct,'A');
  const remapped=setShortcut(DEFAULT_SHORTCUTS,'select','x');assert.equal(remapped.select,'X');
  assert.throws(()=>setShortcut(remapped,'pen','X'),/already assigned/);
  assert.equal(shortcutFromEvent({key:'z',metaKey:true,shiftKey:true}),'Mod+Shift+Z');
  assert.equal(shortcutFromEvent({key:'z',ctrlKey:true,shiftKey:true}),'Mod+Shift+Z');
  assert.equal(shortcutFromEvent({key:'Backspace'}),'Delete');
});
test('editable archives carry reset baselines and reject malformed originals atomically', () => {
  const original=structuredClone(LIBRARY[0]),edited=structuredClone(original);edited.weight=3;
  const text=JSON.stringify(libraryDocument([edited],'one',new Map([[original.name,original]])));
  const archive=parseLibraryArchive(text);assert.equal(archive.glyphs[0].weight,3);assert.equal(archive.originals.get(original.name).weight,original.weight);
  const invalid=JSON.parse(text);invalid.originals[0].name='foreign';assert.throws(()=>parseLibraryArchive(JSON.stringify(invalid)),/Invalid original/);
});
