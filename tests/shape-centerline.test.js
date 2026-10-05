import test from 'node:test';import assert from 'node:assert/strict';import paper from 'paper';import {createGlyphCore} from '../src/glyph-core.js';import {centerlineSource,recoverBar,centerlineLayer,estimateSourceWidth} from '../src/shape-centerline.js';import {normalizeGlyph} from '../src/library-io.js';import {layerStyleGlyph} from '../src/stroke-weight.js';import {generateSolid} from '../src/solid-variants.js';
new paper.Project();const core=createGlyphCore(paper);
const bar={name:'bar',setStyle:{rounding:0},layers:[{id:'bar',name:'Bar',paint:'fill',node:{shape:'rect',x:11.4,y:3,w:1.2,h:18,r:.6}}]};
test('thin rounded bar recovers one open axis where half-width inset collapses; rejects noncapsule and short circles',()=>{
 const source=centerlineSource(bar,{l:0,p:[]},core),r=recoverBar(source,core);assert.ok(r);assert.ok(Math.abs(r.stroke-1.2)<.001);assert.ok(Math.abs(r.node.children[0].y1-3.6)<.001);assert.ok(Math.abs(r.node.children[0].y2-20.4)<.001);assert.throws(()=>centerlineLayer(source,core,{inset:.6,stroke:1.2},'x'));
 assert.equal(recoverBar({...bar,layers:[{...bar.layers[0],node:{shape:'rect',x:6,y:3,w:6,h:18}}]},core),null);
 assert.equal(recoverBar({...bar,layers:[{...bar.layers[0],node:{shape:'circle',cx:12,cy:12,r:3}}]},core),null);
});
test('isolation retains parent implicit pivot and symmetry; source and sibling stay untouched',()=>{
 const g={...bar,layers:[{...bar.layers[0],node:{op:'subtract',transform:{rotate:90},children:[bar.layers[0].node,{shape:'circle',cx:3,cy:3,r:2}]}}]};const before=JSON.stringify(g);const s=centerlineSource(g,{l:0,p:[0]},core);assert.equal(s.layers[0].node.op,'union');assert.ok(s.layers[0].node.transform.origin.every(Number.isFinite));assert.equal(JSON.stringify(g),before);assert.equal(centerlineSource({...bar,layers:[{...bar.layers[0],paint:'stroke'}]},{l:0,p:[]},core),null);
});
test('local width and rounding survive validation and SVG/solid resolution while inherited peers follow library settings',()=>{
 const g=normalizeGlyph({name:'local',weight:3,setStyle:{rounding:1,endRounding:1},layers:[{id:'local',paint:'stroke',strokeWidth:1.2,rounding:0,endRounding:0,node:{shape:'line',x1:4,y1:4,x2:4,y2:20,cap:'round'}},{id:'peer',paint:'stroke',node:{shape:'line',x1:12,y1:4,x2:12,y2:20}}]});
 const svg=core.toSVG(g,{mode:'baked'});assert.match(svg,/stroke-width="1.2"/);assert.match(svg,/stroke-width="3"/);assert.match(core.toSVG(g),/stroke-width:1.2;/);assert.equal(layerStyleGlyph(g,g.layers[0]).setStyle.rounding,0);
 const solo={...g,layers:[g.layers[0]]},solid=core.resolve(generateSolid(solo,core))[0];const p=new paper.CompoundPath(solid.d);assert.ok(Math.abs(p.bounds.width-1.2)<.02);p.remove();assert.throws(()=>normalizeGlyph({...g,layers:[{...g.layers[0],strokeWidth:NaN}]}));
});
test('source width measures ink across opposing boundaries rather than library weight or overall diameter',()=>{
 const source={name:'ring',weight:3,layers:[{id:'ring',paint:'fill',node:{op:'subtract',children:[{shape:'circle',cx:12,cy:12,r:6},{shape:'circle',cx:12,cy:12,r:4.6}]}}]},before=JSON.stringify(source),count=paper.project.activeLayer.children.length;
 const measured=estimateSourceWidth(source,core);assert.ok(Math.abs(measured.stroke-1.4)<.005);assert.equal(measured.variable,false);assert.equal(JSON.stringify(source),before);
 const rect={...source,layers:[{id:'bar',paint:'fill',node:{shape:'rect',x:11,y:3,w:2,h:18,transform:{rotate:30}}}]};assert.ok(Math.abs(estimateSourceWidth(rect,core).stroke-2)<.005);
 assert.equal(estimateSourceWidth({...source,layers:[{id:'empty',paint:'fill',node:{op:'union',children:[]}}]},core),null);assert.equal(paper.project.activeLayer.children.length,count);
});
