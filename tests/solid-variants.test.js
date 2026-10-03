import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';
import {generateSolid,reviewSolid,sourceSignature,compareSolid} from '../src/solid-variants.js';
import {variantGlyphs} from '../src/variant-export.js';
import {DEFAULT_OUTPUT,validateOutput} from '../src/library-output.js';
import {libraryZIP} from '../src/library-zip.js';
import {unzipSync,strFromU8} from 'fflate';
new paper.Project();const core=createGlyphCore(paper);
const circle=(name,r,paint='stroke')=>({name,weight:2,layers:[{id:'body',paint,node:{shape:'circle',cx:12,cy:12,r}}]});
test('solid boundary follows outer/inner stroke edge and preserves source and Paper project',()=>{
 const glyph=circle('eye-outline',4),before=JSON.stringify(glyph),children=paper.project.activeLayer.children.length;
 for(const [edge,r] of [['outside',5],['inside',3],['center',4]]){const result=generateSolid(glyph,core,{edge});const path=new paper.CompoundPath({pathData:core.resolve(result)[0].d,insert:false});assert.ok(Math.abs(path.bounds.width-2*r)<0.02);path.remove();}
 assert.equal(JSON.stringify(glyph),before);assert.equal(paper.project.activeLayer.children.length,children);
 const review=reviewSolid(glyph,circle('eye',5,'fill'),core);assert.equal(review.status,'candidate');assert.equal(review.recipe.edge,'outside');
 assert.notEqual(sourceSignature(glyph,core),sourceSignature({...glyph,weight:3},core));
});
test('holes are significant even when a silhouette overlap score is high',()=>{
 const outer=new paper.Path.Circle({center:[12,12],radius:8,insert:false}),inner=new paper.Path.Circle({center:[12,12],radius:0.3,insert:false});const donut=outer.subtract(inner,{insert:false});
 const reference={name:'donut',layers:[{id:'ring',paint:'fill',node:{shape:'path',d:donut.pathData}}]},filled=circle('filled',8,'fill');
 const score=compareSolid(filled,reference,core);assert.ok(score.iou>.99);assert.equal(score.topology,false);outer.remove();inner.remove();donut.remove();
});
test('EDS exports deduplicate pairs, preserve naming and block stale or unreviewed solids',()=>{
 const outline=circle('eye-outline',4),filled=circle('eye',5,'fill'),output={...DEFAULT_OUTPUT,variant:'both'};
 assert.throws(()=>variantGlyphs([outline],[outline,filled],core,output),/Review/);
 outline.solidReview=reviewSolid(outline,filled,core);
 assert.deepEqual(variantGlyphs([outline,filled],[outline,filled],core,output).map(g=>g.name),['eye-outline','eye']);
 outline.weight=3;assert.throws(()=>variantGlyphs([outline],[outline,filled],core,output),/Review/);
});
test('output colors distinguish fill/stroke while menu bar templates remain black',()=>{
 const glyph={...circle('eye',5,'both'),output:{...DEFAULT_OUTPUT,colorMode:'multicolor',fillColor:'#ff0000',strokeColor:'#00ff00'}};
 const svg=core.toSVG(glyph,{mode:'baked'});assert.match(svg,/fill="#ff0000"/);assert.match(svg,/stroke="#00ff00"/);
 glyph.output.profile='menu-bar';assert.doesNotMatch(core.toSVG(glyph,{mode:'baked'}),/#ff0000|#00ff00/);
 assert.throws(()=>validateOutput({...DEFAULT_OUTPUT,sizes:[0,1024]}),/sizes/);
});
test('Apple assets reference exported sizes and editable sources remain intact',async()=>{
 for(const [profile,sizes,suffix] of [['menu-bar',[18,36],'imageset'],['mac-app',[16,32,64,128,256,512,1024],'appiconset']]){
 const glyph={...circle('eye',5,'fill'),output:{...DEFAULT_OUTPUT,profile,sizes}},document={glyphs:[glyph]};
 const files=unzipSync(await libraryZIP(document,()=>'<svg/>',{includePNG:true,rasterize:async(svg,size)=>new Uint8Array([size%256])}));
 const asset=JSON.parse(strFromU8(files[`assets/eye.${suffix}/Contents.json`]));for(const image of asset.images)assert.ok(files[`assets/eye.${suffix}/${image.filename}`]);
 assert.deepEqual(JSON.parse(strFromU8(files['library.json'])),document);if(profile==='menu-bar')assert.equal(asset.properties['template-rendering-intent'],'template');else assert.equal(asset.images.length,10);
 }
});
test('resolved rounding and symmetry are baked once and cannot be applied again to a generated solid',()=>{
 const glyph={...circle('eye-outline',4),symmetry:{rotate:2},setStyle:{rounding:0.6,thickness:2,endRounding:0}};
 const generated=generateSolid(glyph,core);assert.equal(generated.setStyle.rounding,0);assert.equal(generated.symmetry.rotate,1);assert.equal(generated.layers[0].symmetry,false);
});
test('open strokes expand without invented closure across gaps and unsupported tips fail explicitly',()=>{
 const line={name:'line-outline',weight:2,layers:[{id:'line',paint:'stroke',node:{shape:'line',x1:4,y1:12,x2:20,y2:12}}]};
 const result=generateSolid(line,core),path=new paper.CompoundPath({pathData:core.resolve(result)[0].d,insert:false});assert.ok(path.bounds.left<3.1 && path.bounds.right>20.9);assert.ok(Math.abs(path.bounds.height-2)<0.02);path.remove();
 assert.throws(()=>generateSolid({...line,setStyle:{endRounding:0.3}},core),/line-end rounding/);
});
test('visibility and opacity edits invalidate the geometry comparison signature',()=>{
 const glyph=circle('eye-outline',4),signature=sourceSignature(glyph,core);glyph.layers[0].visible=false;assert.notEqual(sourceSignature(glyph,core),signature);glyph.layers[0].visible=true;glyph.layers[0].opacity=0.4;assert.notEqual(sourceSignature(glyph,core),signature);
});
