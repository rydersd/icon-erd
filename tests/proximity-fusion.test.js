import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';
import {generateSolid,sourceSignature} from '../src/solid-variants.js';
import {fusionTarget} from '../src/proximity-fusion.js';
import {normalizeGlyph,libraryDocument,parseLibraryArchive} from '../src/library-io.js';
import {scaleForm,findSharedForms,linkSharedForms,publishSharedForms} from '../src/shared-forms.js';
new paper.Project();const core=createGlyphCore(paper);
const bars=(distance=.6)=>({name:'bars-outline',weight:1.2,layers:[{id:'bars',name:'Bars',paint:'stroke',node:{op:'union',fusion:{enabled:true,distance,preserveCounters:true},children:[7,8.8,12].map(x=>({shape:'line',x1:x,y1:4,x2:x,y2:20}))}}]});
const parse=d=>new paper.CompoundPath({pathData:d,insert:false});
test('fusion joins threshold neighbors while preserving editable source, distant bars, and export paint',()=>{
  for(const [distance,parts]of [[0,3],[.3,3],[.6,2],[.8,2],[2.4,1]]){
    const glyph=bars(distance),before=JSON.stringify(glyph),r=core.resolve(glyph)[0];assert.equal(r.error,null);assert.equal(r.parts[0].fusion.parts,parts);
    const shape=parse(r.d);assert.equal(shape.contains([7.9,12]),distance>=.6);shape.remove();
    assert.equal(JSON.stringify(glyph),before);const svg=core.toSVG(glyph,{mode:'baked'});assert.doesNotMatch(svg,/stroke-width|data-stroke-tip/);assert.match(svg,/fill="#1d2430"/);
    const solid=core.resolve(generateSolid(glyph,core))[0],ink=parse(solid.d);assert.equal(ink.children.filter(p=>p.area>0).length,parts);ink.remove();
  }
});
test('stroke-ring holes stay open in outline; solid derives its outside boundary from original centerline',()=>{
  const g=bars(10);g.layers[0].node.children=[{shape:'circle',cx:12,cy:12,r:4}];
  const outline=core.resolve(g)[0];assert.equal(outline.parts[0].fusion.beforeCounters,1);assert.equal(outline.parts[0].fusion.afterCounters,1);const a=parse(outline.d);assert.equal(a.contains([12,12]),false);a.remove();
  const solid=parse(core.resolve(generateSolid(g,core))[0].d);assert.equal(solid.contains([12,12]),true);assert.ok(Math.abs(solid.bounds.width-9.2)<.03);solid.remove();
  g.layers[0].node.fusion.preserveCounters=false;assert.equal(core.resolve(g)[0].parts[0].fusion.afterCounters,0);
});
test('fusion remains group-local, freezes implicit pivots, respects hidden source and disabling restores centerlines',()=>{
  const g=bars(),group=g.layers[0].node;group.children.pop();g.layers[0].node={op:'union',transform:{rotate:35},children:[group,{shape:'line',x1:11,y1:4,x2:11,y2:20}]};
  const raw=core.resolve(g,{skipFusion:true})[0],resolved=core.resolve(g)[0];assert.equal(resolved.error,null);assert.equal(resolved.parts.filter(p=>p.fusion).length,1);
  const before=parse(raw.d),after=parse(resolved.parts[0].d);const original=before.children.at(-1);assert.ok(original.firstSegment.point.getDistance(after.firstSegment?.point||after.children[0].firstSegment.point)<.001);before.remove();after.remove();
  group.fusion.enabled=false;assert.deepEqual(core.resolve(g)[0].parts,core.resolve(g,{skipFusion:true})[0].parts);
  group.fusion.enabled=true;group.children[1].hidden=true;assert.equal(core.resolve(g)[0].parts.at(-1).fusion.parts,1);
});
test('width changes regenerate fusion; local widths override preview width; square and procedural tips have matching bounds',()=>{
  const g=bars(),first=core.resolve(g)[0].d;assert.notEqual(core.resolve(g,{weight:2})[0].d,first);g.layers[0].strokeWidth=1.2;assert.equal(core.resolve(g,{weight:2})[0].d,first);
  g.layers[0].node.children=[{shape:'line',x1:4,y1:12,x2:20,y2:12,cap:'square'}];let ink=parse(core.resolve(g)[0].d);assert.ok(Math.abs(ink.bounds.width-17.2)<.03);ink.remove();
  g.layers[0].endRounding=.25;ink=parse(core.resolve(g)[0].d);assert.ok(Math.abs(ink.bounds.width-17.2)<.03);ink.remove();assert.doesNotThrow(()=>generateSolid(g,core));
});
test('recipes round-trip, participate in stale-review signatures and scaled shared components',()=>{
  const g=bars(),old=sourceSignature(g,core),scaled=scaleForm(g.layers[0].node,.5,core);assert.equal(scaled.fusion.distance,.3);
  const archive=libraryDocument([g]);assert.equal(parseLibraryArchive(JSON.stringify(archive)).glyphs[0].layers[0].node.fusion.distance,.6);
  const peer=structuredClone(g);peer.name='peer';linkSharedForms(findSharedForms([g,peer],core).find(group=>group.members[0].node.children),'Bars',core,'bars');
  const prev=structuredClone(g);g.layers[0].node.fusion.distance=.8;publishSharedForms(g,prev,[peer],core);assert.equal(peer.layers[0].node.fusion.distance,.8);peer.layers[0].paint='fill';assert.doesNotThrow(()=>normalizeGlyph(peer));assert.equal(core.resolve(peer)[0].parts[0].fusion,undefined);assert.notEqual(sourceSignature(g,core),old);
});
test('invalid or nested recipes reject imports and exports; no implicit fusion for unrelated Boolean groups',()=>{
  assert.equal(fusionTarget(bars(),{l:4,p:[]}),null);
  for(const distance of [-1,NaN,Infinity]){const g=bars(distance);assert.throws(()=>normalizeGlyph(g),/fusion/);assert.throws(()=>core.toSVG(g),/fusion/i);}
  const g=bars();g.layers[0].node.children.push({...bars().layers[0].node});assert.equal(fusionTarget(g,{l:0,p:[]}),null);assert.throws(()=>normalizeGlyph(g),/fusion/);assert.throws(()=>core.toSVG(g),/fusion/i);
  const fill=bars();fill.layers[0].paint='fill';assert.equal(fusionTarget(fill,{l:0,p:[]}),null);assert.doesNotThrow(()=>normalizeGlyph(fill));assert.equal(core.resolve(fill)[0].parts[0].fusion,undefined);assert.doesNotThrow(()=>core.toSVG(fill));
  const boolean=bars();boolean.layers[0].node.op='subtract';assert.throws(()=>normalizeGlyph(boolean),/fusion/);
});
test('separate enabled groups never fuse across their boundary and fused SVG uses stroke color tokens',()=>{
  const g=bars(2.4),a=g.layers[0].node,b=structuredClone(a);a.children.pop();b.children=b.children.slice(-1);g.layers[0].node={op:'union',children:[a,b]};
  const r=core.resolve(g)[0];assert.equal(r.error,null);assert.equal(r.parts.length,2);assert.deepEqual(r.parts.map(p=>p.fusion.parts),[1,1]);
  const ink=parse(r.d);assert.equal(ink.contains([10.4,12]),false);ink.remove();
  g.output={colorMode:'multicolor',fillColor:'#ff0000',strokeColor:'#00ff00',useColorTokens:true,colorTokens:{fill:'--test-fill',stroke:'--test-stroke'}};
  assert.match(core.toSVG(g,{mode:'baked',useColorTokens:true}),/fill="var\(--test-stroke, #00ff00\)"/);
});
