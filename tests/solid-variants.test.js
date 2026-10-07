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
test('open strokes expand without invented closure across gaps and native square and procedural tips expand',()=>{
 const line={name:'line-outline',weight:2,layers:[{id:'line',paint:'stroke',node:{shape:'line',x1:4,y1:12,x2:20,y2:12}}]};
 const result=generateSolid(line,core),path=new paper.CompoundPath({pathData:core.resolve(result)[0].d,insert:false});assert.ok(path.bounds.left<3.1 && path.bounds.right>20.9);assert.ok(Math.abs(path.bounds.height-2)<0.02);path.remove();
 for(const settings of [{setStyle:{endRounding:.3}},{strokeCap:'square'}]){const generated=generateSolid({...line,...settings},core);const ink=new paper.CompoundPath({pathData:core.resolve(generated)[0].d,insert:false});assert.ok(ink.bounds.left<3.1&&ink.bounds.right>20.9);assert.ok(Math.abs(ink.bounds.height-2)<.02);ink.remove();}
});
test('visibility and opacity edits invalidate the geometry comparison signature',()=>{
 const glyph=circle('eye-outline',4),signature=sourceSignature(glyph,core);glyph.layers[0].visible=false;assert.notEqual(sourceSignature(glyph,core),signature);glyph.layers[0].visible=true;glyph.layers[0].opacity=0.4;assert.notEqual(sourceSignature(glyph,core),signature);
});

test('barcode solids preserve independent widths, tip corners, gaps and source artwork',()=>{
 const widths=[2.4,1.2,2.4],g={name:'barcode-outline',weight:1.6,layers:widths.map((width,i)=>({id:`bar-${i}`,name:`Bar ${i+1}`,paint:'stroke',strokeWidth:width,rounding:0,endRounding:.5,node:{shape:'line',x1:4+i*5,y1:4.8,x2:4+i*5,y2:19.2}}))},before=JSON.stringify(g),count=paper.project.activeLayer.children.length;
 const solid=generateSolid(g,core);assert.equal(solid.layers.length,3);
 for(const [i,layer]of core.resolve(solid).entries()){const p=new paper.CompoundPath({pathData:layer.d,insert:false});assert.equal(layer.paint,'fill');assert.ok(Math.abs(p.bounds.width-widths[i])<.002);assert.ok(Math.abs(p.bounds.height-(14.4+widths[i]))<.003);p.remove();}
 assert.equal(JSON.stringify(g),before);assert.equal(paper.project.activeLayer.children.length,count);
});

test('curved square ends remain explicit review rather than deforming a curved source',()=>{
 const curved={name:'curve-outline',weight:2,strokeCap:'square',layers:[{id:'curve',paint:'stroke',node:{shape:'pen',pts:[{x:4,y:4,out:[4,0]},{x:12,y:12,in:[0,-4]}]}}]};assert.throws(()=>generateSolid(curved,core),/Curved square-ended/);
});

test('rounded box subtracts barcode bars with independent tip widths and tracks library corner rules',()=>{
 const source={name:'barcode-outline',weight:1.6,setStyle:{rounding:.5,endRounding:.3},solidConstruction:{treatment:'cutout',padding:1,cornerRounding:null},layers:[2.4,1.2,2.4].map((w,i)=>({id:`bar-${i}`,paint:'stroke',strokeWidth:w,rounding:0,endRounding:i===0?0:.3,node:{shape:'line',x1:5+i*5,y1:5,x2:5+i*5,y2:19,cap:'butt'}}))},before=JSON.stringify(source),count=paper.project.activeLayer.children.length;
 const solid=generateSolid(source,core);assert.equal(solid.layers.length,1);assert.equal(solid.solidConstruction,undefined);const ink=new paper.CompoundPath({pathData:core.resolve(solid)[0].d,insert:false});assert.equal(ink.children.filter(p=>p.area<0).length,3);assert.ok(ink.contains([3,12]));assert.equal(ink.contains([5,12]),false);assert.equal(ink.contains([10,12]),false);ink.remove();assert.equal(JSON.stringify(source),before);assert.equal(paper.project.activeLayer.children.length,count);
 const changed={...source,setStyle:{...source.setStyle,rounding:.8}};assert.notEqual(sourceSignature(source,core),sourceSignature(changed,core));assert.notEqual(core.resolve(generateSolid(source,core))[0].d,core.resolve(generateSolid(changed,core))[0].d);
 assert.throws(()=>generateSolid({...source,solidConstruction:{treatment:'cutout',padding:-1}},core),/Invalid solid construction/);
});

test('cutout treatment survives editable imports and preserves EDS outline/solid filenames',()=>{
 const source={name:'barcode',eds:{},solidConstruction:{treatment:'cutout',padding:1,cornerRounding:.5},weight:1.2,layers:[{id:'bar',paint:'fill',node:{shape:'rect',x:10,y:4,w:2,h:16,r:.4}}]};source.solidReview={recipe:{edge:'outside',holes:'preserve'},status:'approved',sourceSignature:sourceSignature(source,core)};
 const variants=variantGlyphs([source],[source],core,{...DEFAULT_OUTPUT,variant:'both'});assert.deepEqual(variants.map(g=>g.name),['barcode-outline','barcode']);assert.equal(variants[1].layers[0].name,'Rounded box with bar cutouts');
});

test('canonical cutout boxes require explicit source-bound approval too',()=>{
 const g={name:'barcode',variantFamily:{canonical:'outline',status:'ready'},weight:1.2,solidConstruction:{treatment:'cutout',padding:1,cornerRounding:null},layers:[{id:'line',paint:'stroke',node:{shape:'line',x1:12,y1:4,x2:12,y2:20}}]};assert.throws(()=>variantGlyphs([g],[g],core,{...DEFAULT_OUTPUT,variant:'solid'}),/Review/);
 g.solidReview={recipe:{edge:'outside',holes:'preserve'},status:'approved',sourceSignature:sourceSignature(g,core)};assert.equal(variantGlyphs([g],[g],core,{...DEFAULT_OUTPUT,variant:'solid'})[0].layers[0].name,'Rounded box with bar cutouts');
});
