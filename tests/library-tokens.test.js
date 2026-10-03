import test from 'node:test';import assert from 'node:assert/strict';
import {numberTokens,linkedLibraryProperties,tokenStyle} from '../src/library-tokens.js';
import {libraryDocument,parseLibraryArchive} from '../src/library-io.js';
const document={base:{$type:'number',stroke:{$value:1.5}},icon:{thickness:{$value:'{base.stroke}'},cornerRadius:{$type:'number',$value:0.4},endRadius:{$type:'number',$value:0.7}}};
test('library token bindings resolve numeric aliases and separate corners from line ends',()=>{
  const properties=linkedLibraryProperties(document,'design.tokens.json');
  assert.deepEqual(tokenStyle(properties),{thickness:1.5,rounding:0.4,endRounding:0.7});assert.equal(properties.bindings.thickness,'icon.thickness');
  assert.equal(numberTokens({...document,colorAlias:{$type:'color',$value:'{icon.thickness}'}}).colorAlias,undefined);
});
test('invalid and cyclic bindings reject before a library can change',()=>{
  assert.throws(()=>numberTokens({a:{$value:'{b}'},b:{$value:'{a}'}}),/Circular/);
  assert.throws(()=>linkedLibraryProperties({thickness:{$value:99}},'bad.json'),/Thickness/);
  assert.throws(()=>tokenStyle({values:{},source:{document},bindings:{thickness:'missing'}}),/Missing/);
});
test('library archives retain local values, linked file source and bindings',()=>{
  const properties=linkedLibraryProperties(document,'design.tokens.json');
  const glyph={name:'token-fixture',layers:[{id:'line',node:{shape:'line',x1:1,y1:1,x2:8,y2:8}}]};
  const archive=parseLibraryArchive(JSON.stringify(libraryDocument([glyph],'all',null,null,properties)));
  assert.deepEqual(archive.libraryProperties,properties);
  assert.equal(parseLibraryArchive(JSON.stringify(glyph)).libraryProperties,null);
});
