import {normalizeGlyph} from './library-io.js';
import {DEFAULT_OUTPUT} from './library-output.js';
import {generateSolid,sourceSignature} from './solid-variants.js';

const hasOutline=glyph=>glyph.kind!=='app-icon' && glyph.layers.some(l=>l.visible!==false && ['stroke','both'].includes(l.paint));
// Consolidate explicit pairs only. A filename is not evidence of a centerline.
// Filled artwork without an editable outline stays intact for guided review.
export function cleanImportedLibrary(archive) {
  const by=new Map(archive.glyphs.map(g=>[g.name,g])),consumed=new Set(),glyphs=[],originals=new Map();
  let paired=0,outlined=0,pending=0;
  for(const glyph of archive.glyphs){
    if(consumed.has(glyph.name))continue;
    if(glyph.kind==='app-icon'){glyphs.push(structuredClone(glyph));originals.set(glyph.name,structuredClone(archive.originals.get(glyph.name)||glyph));consumed.add(glyph.name);continue;}
    const base=glyph.name.endsWith('-outline')?glyph.name.slice(0,-8):glyph.name;
    const plain=by.get(base),outline=by.get(`${base}-outline`);
    // Never collapse an app icon or an independently drawn stroke into a fill pair.
    const pair=plain && outline && plain.kind!=='app-icon' && plain.layers.some(l=>l.visible!==false) && plain.layers.filter(l=>l.visible!==false).every(l=>l.paint==='fill') && outline.kind!=='app-icon';
    const source=pair?outline:glyph;
    const name=pair?base:source.name.endsWith('-outline')&&!by.has(base)?base:source.name;
    if(pair){consumed.add(plain.name);consumed.add(outline.name);paired++;}else consumed.add(glyph.name);
    const ready=hasOutline(source);
    if(ready)outlined++;else pending++;
    const variantFamily={canonical:'outline',status:ready?'ready':'needs-review',reason:ready?'':'No editable outline: review the inset reconstruction before replacing the source.'};
    const copy=normalizeGlyph({...structuredClone(source),name,variantFamily});
    delete copy.output;if(ready){delete copy.solidReview;delete copy.reconstruction;}
    glyphs.push(copy);
    const original=archive.originals.get(source.name)||source;
    originals.set(name,normalizeGlyph({...structuredClone(original),name,variantFamily:hasOutline(original)?{canonical:'outline',status:'ready',reason:''}:{canonical:'outline',status:'needs-review',reason:'Original artwork needs editable outline reconstruction.'}}));
  }
  const properties=structuredClone(archive.libraryProperties||{values:{thickness:null,rounding:0,endRounding:0}});
  properties.output={...DEFAULT_OUTPUT,...properties.output,variant:'outline',familyView:false};
  return {glyphs,originals,libraryProperties:properties,paired,outlined,pending};
}

export function auditDerivedFills(glyphs,core) {
  return glyphs.map(glyph=>{
    if(glyph.variantFamily?.status!=='ready')return glyph;
    try{generateSolid(glyph,core);return glyph;}catch(error){
      return {...glyph,solidReview:{status:'needs-review',reason:`Derived fill: ${error.message}`,sourceSignature:sourceSignature(glyph,core),recipe:{edge:'outside',holes:'preserve'}}};
    }
  });
}
