// AXIS-01a — library thickness curve by target point size.
// Spec: wiki/product-spec/designspace-axis-01.md (private wiki), owner rulings 2026-10-12:
// curve values are multipliers of the library Thickness token, sizes are points,
// one SVG per configured size when a designspace exists, solid approval binds the reference size.
import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {unzipSync,strFromU8} from 'fflate';
import {createGlyphCore} from '../src/glyph-core.js';
import {validateDesignspace,opticalScale,pointSize,atSize} from '../src/designspace.js';
import {strokeWeight} from '../src/stroke-weight.js';
import {validateLibraryProperties} from '../src/library-tokens.js';
import {libraryDocument,parseLibraryArchive} from '../src/library-io.js';
import {libraryZIP} from '../src/library-zip.js';
import {reviewSolid} from '../src/solid-variants.js';
import {variantGlyphs} from '../src/variant-export.js';
import {DEFAULT_OUTPUT} from '../src/library-output.js';
new paper.Project();const core=createGlyphCore(paper);

const DS={version:1,opticalSize:{reference:24,curve:[[18,1.2121],[24,1]]}};
const close=(a,b,eps=1e-3)=>assert.ok(Math.abs(a-b)<eps,`${a} ≉ ${b}`);
const line=(name,extra={})=>({name,weight:1.1,layers:[{id:'art',paint:'stroke',node:{shape:'line',x1:2,y1:12,x2:22,y2:12}}],...extra});
const circle=(name,r,paint='stroke')=>({name,weight:2,layers:[{id:'body',paint,node:{shape:'circle',cx:12,cy:12,r}}]});

test('validateDesignspace accepts absent values and normalizes curve order',()=>{
  assert.equal(validateDesignspace(null),null);
  assert.equal(validateDesignspace(undefined),null);
  const value=validateDesignspace({version:1,opticalSize:{reference:24,curve:[[24,1],[16,1.4],[18,1.2]]}});
  assert.deepEqual(value.opticalSize.curve,[[16,1.4],[18,1.2],[24,1]]);
  assert.equal(value.opticalSize.reference,24);
});

test('malformed designspace is rejected',()=>{
  for(const bad of [
    {version:2,opticalSize:{reference:24,curve:[[18,1.2]]}},
    {version:1},
    {version:1,opticalSize:{reference:24,curve:[]}},
    {version:1,opticalSize:{reference:24,curve:[[18,'x']]}},
    {version:1,opticalSize:{reference:24,curve:[[18,0]]}},
    {version:1,opticalSize:{reference:24,curve:[[18,9]]}},
    {version:1,opticalSize:{reference:24,curve:[[4,1]]}},
    {version:1,opticalSize:{reference:24,curve:[[5000,1]]}},
    {version:1,opticalSize:{reference:24,curve:[[18,1.2],[18,1.3]]}},
    {version:1,opticalSize:{reference:0,curve:[[18,1.2]]}},
    {version:1,opticalSize:{reference:24,curve:[[18]]}},
  ])assert.throws(()=>validateDesignspace(bad),/designspace|optical|curve/i,JSON.stringify(bad));
});

test('opticalScale is 1 without a designspace and normalizes to the reference size',()=>{
  assert.equal(opticalScale(null,18),1);
  close(opticalScale(DS,24),1);
  close(opticalScale(DS,18),1.2121);
  // Multipliers are relative to the token at the reference size, so a flat curve is a no-op.
  close(opticalScale({version:1,opticalSize:{reference:24,curve:[[18,2],[24,2]]}},18),1);
});

test('opticalScale interpolates linearly in log size and clamps at the ends',()=>{
  close(opticalScale(DS,Math.sqrt(18*24)),(1.2121+1)/2);
  close(opticalScale(DS,12),1.2121);
  close(opticalScale(DS,48),1);
});

test('pointSize maps menu-bar @2x pixels to points and leaves other profiles as pixels',()=>{
  assert.equal(pointSize('menu-bar',18),18);
  assert.equal(pointSize('menu-bar',36),18);
  assert.equal(pointSize('interface',24),24);
  assert.equal(pointSize('custom',48),48);
  assert.equal(pointSize('mac-app',32),32);
  assert.equal(pointSize(undefined,20),20);
});

test('absent designspace is a no-op',()=>{
  const glyph=line('a');
  assert.equal(atSize(glyph,null,18),glyph);
  assert.equal(atSize(glyph,DS,24),glyph);
  const svg=core.toSVG(glyph,{mode:'baked',weight:strokeWeight(glyph),size:18});
  const evaluated=atSize(glyph,null,18);
  assert.equal(core.toSVG(evaluated,{mode:'baked',weight:strokeWeight(evaluated),size:18}),svg);
});

test('curve gives 1px strokes at 18',()=>{
  const glyph=line('thin',{setStyle:{thickness:1.1,rounding:0,endRounding:0}});
  const at18=atSize(glyph,DS,18);
  close(strokeWeight(at18)*18/24,1,2e-3);
  assert.equal(glyph.setStyle.thickness,1.1,'source is not mutated');
  assert.match(core.toSVG(at18,{mode:'baked',weight:strokeWeight(at18),size:18}),/stroke-width="1\.333/);
});

test('exceptions keep ratios',()=>{
  const glyph={...line('barcode',{setStyle:{thickness:1.1,rounding:0,endRounding:0},strokeOverride:2}),
    layers:[{id:'a',paint:'stroke',strokeWidth:3,node:{shape:'line',x1:4,y1:4,x2:4,y2:20}},{id:'b',paint:'stroke',node:{shape:'line',x1:8,y1:4,x2:8,y2:20}}],
    insetConversion:{source:'x',inset:.5,stroke:1.5,strokeBinding:'override'}};
  const before=JSON.stringify(glyph),s=opticalScale(DS,18),out=atSize(glyph,DS,18);
  close(out.strokeOverride,2*s);close(out.layers[0].strokeWidth,3*s);assert.equal(out.layers[1].strokeWidth,undefined);
  close(out.insetConversion.stroke,1.5*s);close(out.setStyle.thickness,1.1*s);close(out.weight,1.1*s);
  close(out.layers[0].strokeWidth/strokeWeight(out),3/2);
  assert.equal(JSON.stringify(glyph),before);
});

test('library properties carry a validated designspace through JSON round trips',()=>{
  const props=validateLibraryProperties({values:{thickness:1.1,rounding:0,endRounding:0},designspace:DS});
  assert.deepEqual(props.designspace,DS);
  assert.throws(()=>validateLibraryProperties({values:{thickness:1.1},designspace:{version:1,opticalSize:{reference:24,curve:[[18,-1]]}}}),/curve|optical|designspace/i);
  assert.equal(validateLibraryProperties({values:{thickness:1.1}}).designspace,undefined);
  const archive=parseLibraryArchive(JSON.stringify(libraryDocument([line('a')],'all',null,null,props)));
  assert.deepEqual(archive.libraryProperties.designspace,DS);
});

test('solid at 18 regenerates from evaluated outline',()=>{
  const outline=circle('eye-outline',4),filled=circle('eye',5,'fill'),output={...DEFAULT_OUTPUT,variant:'solid'};
  outline.solidReview=reviewSolid(outline,filled,core);
  const ref=variantGlyphs([outline],[outline,filled],core,output)[0];
  const at18=variantGlyphs([outline],[outline,filled],core,output,{evaluate:g=>atSize(g,DS,18)})[0];
  const width=g=>{const p=new paper.CompoundPath({pathData:core.resolve(g)[0].d,insert:false}),w=p.bounds.width;p.remove();return w;};
  // Reference solid: radius 4 + weight 2 / 2 = 5. At 18 the stroke is 2 × 1.2121, so the outside edge moves out.
  close(width(ref),10,.05);close(width(at18),2*(4+1.2121),.05);
  // Approval still binds the reference-size source: a real source edit stales it.
  outline.weight=3;assert.throws(()=>variantGlyphs([outline],[outline,filled],core,output,{evaluate:g=>atSize(g,DS,18)}),/Review/);
});

test('absent designspace keeps ZIP layout',async()=>{
  const glyph={...line('arrow'),output:{...DEFAULT_OUTPUT,profile:'menu-bar',sizes:[18,36]}};
  const files=unzipSync(await libraryZIP(libraryDocument([glyph]),()=>'<svg/>',{includePNG:true,rasterize:async(svg,size)=>new TextEncoder().encode(`${size}:${svg}`)}));
  assert.deepEqual(Object.keys(files).filter(n=>n.endsWith('.svg')),['svg/Ungrouped/arrow.svg']);
  assert.equal(strFromU8(files['png/Ungrouped/arrow/arrow-36.png']),'36:<svg/>');
});

test('designspace ZIP writes one SVG per size and rasterizes each size from its own SVG',async()=>{
  const glyph={...line('arrow'),output:{...DEFAULT_OUTPUT,profile:'menu-bar',sizes:[18,36]}};
  const files=unzipSync(await libraryZIP(libraryDocument([glyph]),()=>'<svg/>',{includePNG:true,sizeSVG:(g,size)=>`<svg data-size="${size}"/>`,rasterize:async(svg,size)=>new TextEncoder().encode(`${size}:${svg}`)}));
  assert.deepEqual(Object.keys(files).filter(n=>n.endsWith('.svg')).sort(),['svg/Ungrouped/arrow-18.svg','svg/Ungrouped/arrow-36.svg']);
  assert.equal(strFromU8(files['svg/Ungrouped/arrow-36.svg']),'<svg data-size="36"/>');
  assert.equal(strFromU8(files['png/Ungrouped/arrow/arrow-36.png']),'36:<svg data-size="36"/>');
  const manifest=JSON.parse(strFromU8(files['organization.json']));
  assert.deepEqual(manifest.icons[0].svgSizes,[{size:18,path:'svg/Ungrouped/arrow-18.svg'},{size:36,path:'svg/Ungrouped/arrow-36.svg'}]);
  assert.equal(manifest.icons[0].svg,'svg/Ungrouped/arrow-18.svg');
});
