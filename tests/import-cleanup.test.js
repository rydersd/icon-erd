import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {cleanImportedLibrary,auditDerivedFills} from '../src/import-cleanup.js';
import {parseLibraryArchive} from '../src/library-io.js';
import {createGlyphCore} from '../src/glyph-core.js';
import {variantGlyphs,iconProblems} from '../src/variant-export.js';
import {insetOutline} from '../src/inset-conversion.js';
new paper.Project();const core=createGlyphCore(paper);
const circle=(name,paint,r=4)=>({name,weight:1.2,group:'Faces',tags:['eyes'],layers:[{id:'eye',name:'Eye',role:'accent',paint,node:{shape:'circle',cx:12,cy:12,r}}]});
const archive=glyphs=>parseLibraryArchive(JSON.stringify(glyphs));
test('cleanup consolidates explicit fill/outline pairs, keeps metadata and is independent of input ordering',()=>{
  for(const glyphs of [[circle('eye','fill'),circle('eye-outline','stroke')],[circle('eye-outline','stroke'),circle('eye','fill')]]){
    const input=archive(glyphs),before=JSON.stringify(input.glyphs),result=cleanImportedLibrary(input);
    assert.equal(result.glyphs.length,1);assert.equal(result.glyphs[0].name,'eye');assert.equal(result.glyphs[0].layers[0].paint,'stroke');assert.equal(result.glyphs[0].layers[0].name,'Eye');assert.equal(result.glyphs[0].layers[0].role,'accent');assert.deepEqual(result.glyphs[0].tags,['eyes']);assert.equal(result.paired,1);assert.equal(result.pending,0);assert.equal(JSON.stringify(input.glyphs),before);
    const generated=variantGlyphs(result.glyphs,result.glyphs,core,{...result.libraryProperties.output,variant:'both'});
    assert.deepEqual(generated.map(g=>g.name),['eye-outline','eye']);assert.equal(generated[1].layers[0].paint,'fill');assert.equal(generated[1].layers[0].role,'accent');
  }
});
test('cleanup preserves unpaired fills and app icons, does not collapse unrelated stroke drawings or guess from suffixes',()=>{
  const app={...circle('eye','fill'),kind:'app-icon'};
  const result=cleanImportedLibrary(archive([app,circle('eye-outline','stroke'),circle('dot','fill'),circle('bad-outline','fill'),circle('different','stroke'),circle('different-outline','stroke')]));
  assert.equal(result.glyphs.length,6);assert.equal(result.glyphs[0].variantFamily,undefined);assert.equal(result.glyphs[1].name,'eye-outline');assert.equal(result.pending,2);
  const dot=result.glyphs.find(g=>g.name==='dot');assert.equal(dot.layers[0].paint,'fill');assert.equal(iconProblems(dot).length,1);
  assert.throws(()=>variantGlyphs([dot],result.glyphs,core,{...result.libraryProperties.output,variant:'solid'}),/Review the outline/);
  const candidate=insetOutline(dot,core);assert.equal(candidate.name,'dot');assert.equal(candidate.variantFamily.status,'ready');
});
test('canonical generated fills follow edits without a separately maintained solid and survive interchange',()=>{
  const result=cleanImportedLibrary(archive([circle('eye-outline','stroke')]));
  const output={...result.libraryProperties.output,variant:'solid'};
  const before=core.resolve(variantGlyphs(result.glyphs,result.glyphs,core,output)[0])[0].d;
  result.glyphs[0].layers[0].node.r=6;
  const after=core.resolve(variantGlyphs(result.glyphs,result.glyphs,core,output)[0])[0].d;
  assert.notEqual(after,before);assert.equal(result.glyphs.length,1);
  assert.equal(parseLibraryArchive(JSON.stringify(result.glyphs)).glyphs[0].variantFamily.canonical,'outline');
});
test('a baked filled-outline pair becomes one pending family rather than being mistaken for editable stroke geometry',()=>{
  const result=cleanImportedLibrary(archive([circle('eye','fill'),circle('eye-outline','fill')]));
  assert.equal(result.paired,1);assert.equal(result.glyphs.length,1);assert.equal(result.glyphs[0].name,'eye');assert.equal(result.pending,1);assert.equal(iconProblems(result.glyphs[0]).length,1);
});
test('distinct canonical families cannot silently overwrite each other through exported variant names',()=>{
  const result=cleanImportedLibrary(archive([circle('eye','stroke'),circle('eye-outline','stroke')]));
  assert.throws(()=>variantGlyphs(result.glyphs,result.glyphs,core,{...result.libraryProperties.output,variant:'both'}),/Export name collision/);
});
test('unsupported derived fills are flagged without corrupting the editable outline or pretending the source needs reconstruction',()=>{
  const source={name:'line-outline',weight:1.2,setStyle:{endRounding:.4},layers:[{id:'line',paint:'stroke',node:{shape:'line',x1:4,y1:12,x2:20,y2:12}}]};
  const cleaned=cleanImportedLibrary(archive([source])),before=JSON.stringify(cleaned.glyphs),audited=auditDerivedFills(cleaned.glyphs,core);
  assert.equal(audited[0].variantFamily.status,'ready');assert.equal(iconProblems(audited[0]).length,1);assert.match(audited[0].solidReview.reason,/line-end rounding/);assert.equal(JSON.stringify(cleaned.glyphs),before);
});
