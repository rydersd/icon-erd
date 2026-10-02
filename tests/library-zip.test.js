import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8, unzipSync } from 'fflate';
import { libraryZIP, readLibraryZIP } from '../src/library-zip.js';
import { libraryDocument, parseLibraryArchive } from '../src/library-io.js';
const glyph={name:'Arrow / right',layers:[{id:'art',paint:'stroke',node:{shape:'line',x1:2,y1:12,x2:22,y2:12}}]};
test('ZIP roundtrip retains editable originals and includes safely named SVGs',async()=>{
 const doc=libraryDocument([glyph],'all',new Map([[glyph.name,glyph]]));const bytes=await libraryZIP(doc,()=>'<svg/>');const files=unzipSync(bytes);
 assert.equal(Object.keys(files).length,3);assert.ok(files['svg/Ungrouped/Arrow%20%2F%20right.svg']);assert.deepEqual(JSON.parse(readLibraryZIP(bytes)),doc);
 assert.equal(parseLibraryArchive(readLibraryZIP(bytes)).originals.size,1);
});
test('ZIP without a manifest imports per-icon JSON and rejects SVG-only archives',()=>{
 const bytes=zipSync({'icons/arrow.json':strToU8(JSON.stringify(glyph))});assert.equal(parseLibraryArchive(readLibraryZIP(bytes)).glyphs[0].name,glyph.name);
 assert.throws(()=>readLibraryZIP(zipSync({'arrow.svg':strToU8('<svg/>')})),/no editable icon JSON/);
});

test('grouped ZIP paths and organization manifest use primary groups and preserve multiple tags',async()=>{
 const icon={...glyph,group:'Navigation/Arrows',tags:['table','pagination']};const files=unzipSync(await libraryZIP(libraryDocument([icon]),()=>'<svg/>',{root:'icons'}));
 assert.ok(files['icons/svg/Navigation/Arrows/Arrow%20%2F%20right.svg']);
 const manifest=JSON.parse(new TextDecoder().decode(files['icons/organization.json']));assert.deepEqual(manifest.icons[0].tags,icon.tags);assert.equal(manifest.icons[0].figmaComponentName,'Navigation/Arrows/Arrow / right');
});
