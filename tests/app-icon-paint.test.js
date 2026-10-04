import test from 'node:test';import assert from 'node:assert/strict';import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';import {normalizeGlyph,libraryDocument,parseLibraryArchive} from '../src/library-io.js';
import {libraryZIP,readLibraryZIP} from '../src/library-zip.js';
import {defaultGradient,validateGradient,validateReferenceImage} from '../src/app-icon-paint.js';
new paper.Project();const core=createGlyphCore(paper);
const icon=()=>({name:'app',kind:'app-icon',layers:[{id:'background',paint:'fill',fillGradient:defaultGradient('linear'),node:{shape:'rect',x:2,y:2,w:20,h:20}}]});
test('linear/radial gradients survive normalization and SVG output with layer bounds and opacity',()=>{
 for(const type of ['linear','radial']){const g=icon();g.layers[0].fillGradient=defaultGradient(type);g.layers[0].fillGradient.stops[1].opacity=.3;
 const out=core.toSVG(normalizeGlyph(g),{mode:'baked'});assert.match(out,new RegExp(type+'Gradient'));assert.match(out,/stop-opacity="0.3"/);assert.match(out,/gradientUnits="userSpaceOnUse"/);assert.match(out,/fill="url\(#export-app-0-[a-f0-9]+\)"/);assert.doesNotMatch(core.toSVG(g,{mono:true}),/Gradient/);
 }
});
test('paint imports reject invalid topology, colors, nonfinite positions and external image URLs',()=>{
 const bad=defaultGradient('linear');bad.stops[0].offset=-0.1;assert.throws(()=>validateGradient(bad));
 const g=icon();g.layers[0].fillGradient.stops[0].color='url(https://example.com)';assert.throws(()=>normalizeGlyph(g));
 assert.throws(()=>validateReferenceImage({src:'https://example.com/a.png'}));
});
test('bitmap reference is excluded by default, opt-in exports it and monochrome/template exports omit it',()=>{
 const g=icon();g.referenceImage={name:'ref.png',src:'data:image/png;base64,AA==',x:0,y:0,width:24,height:24,opacity:.4,visible:true,locked:true,includeInExport:false};
 assert.doesNotMatch(core.toSVG(g),/<image/);g.referenceImage.includeInExport=true;assert.match(core.toSVG(normalizeGlyph(g)),/<image/);assert.doesNotMatch(core.toSVG(g,{mono:true}),/<image/);g.output={profile:'menu-bar'};assert.doesNotMatch(core.toSVG(g),/<image/);
});

test('JSON/ZIP preserve editable gradient stops and embedded reference metadata',async()=>{
 const g=icon();g.referenceImage={name:'ref.png',src:'data:image/png;base64,AA==',x:0,y:0,width:24,height:12,opacity:.4,visible:true,locked:true,includeInExport:false};
 const doc=libraryDocument([g]),zip=await libraryZIP(doc,g=>core.toSVG(g));const result=parseLibraryArchive(readLibraryZIP(zip)).glyphs[0];assert.deepEqual(result.layers[0].fillGradient,g.layers[0].fillGradient);assert.deepEqual(result.referenceImage,g.referenceImage);
});

test('sanitized icon names cannot alias distinct gradient definitions',()=>{
 const a=icon(),b=icon();a.name='a/b';b.name='a-b';b.layers[0].fillGradient.stops[1].color='#ff0000';
 const id=g=>core.toSVG(g).match(/linearGradient id="([^"]+)"/)[1];assert.notEqual(id(a),id(b));
});
