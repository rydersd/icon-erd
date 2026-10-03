import {generateSolid,solidName,sourceSignature} from './solid-variants.js';
export function variantGlyphs(glyphs,library,core,output) {
  const by=new Map(library.map(g=>[g.name,g])),result=new Map();
  for(const glyph of glyphs) {
    if(!output || output.variant==='source'){result.set(glyph.name,{...structuredClone(glyph),...(output?{output}: {})});continue;}
    const source=glyph.name.endsWith('-outline') ? glyph : by.get(`${glyph.name}-outline`) || glyph;
    const addOutline=()=>{const outline=structuredClone(source);outline.output=output;result.set(outline.name,outline);};
    const addSolid=()=>{
      let solid;
      if(!source.name.endsWith('-outline') && source.layers.every(layer=>layer.paint==='fill'))solid=structuredClone(source);
      else {
        const review=source.solidReview;
        if(!review?.recipe || !['candidate','approved'].includes(review.status) || review.sourceSignature!==sourceSignature(source,core))throw new Error(`Review the generated solid for ${source.name} first (Library properties → Test solid variants).`);
        solid=generateSolid(source,core,review.recipe);
      }
      solid.output=output;if(output.variant==='fill-stroke')solid.layers=solid.layers.map(layer=>({...layer,paint:'both'}));
      result.set(solid.name,solid);
    };
    if(['outline','both'].includes(output.variant))addOutline();
    if(['solid','both','fill-stroke'].includes(output.variant))addSolid();
  }
  return [...result.values()];
}
export function iconProblems(glyph) {
  const problems=[];
  if(glyph.reconstruction?.status==='needs-review')problems.push(glyph.reconstruction.reason || 'Centerline reconstruction needs review');
  if(glyph.solidReview?.status==='needs-review')problems.push(glyph.solidReview.reason || 'Generated solid needs review');
  if(glyph.solidReview?.stale)problems.push('Source changed since solid review');
  return problems;
}
