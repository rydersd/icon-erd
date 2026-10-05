import {generateSolid,solidName,sourceSignature} from './solid-variants.js';
export function variantSource(glyph,library,by) {
  if(glyph.variantFamily||glyph.name.endsWith('-outline'))return glyph;
  return (by?by.get(`${glyph.name}-outline`):library.find(g=>g.name===`${glyph.name}-outline`))||glyph;
}
export function variantGlyphs(glyphs,library,core,output) {
  const by=new Map(library.map(g=>[g.name,g])),result=new Map(),owners=new Map(),canonicalLibrary=library.some(g=>g.variantFamily);
  const add=(glyph,source)=>{if(result.has(glyph.name)&&owners.get(glyph.name)!==source)throw Error(`Export name collision: ${glyph.name}. Rename an icon or export these families separately.`);owners.set(glyph.name,source);result.set(glyph.name,glyph);};
  for(const glyph of glyphs) {
    if(canonicalLibrary&&glyph.kind==='app-icon'){add(structuredClone(glyph),glyph.name);continue;}
    if(!output || output.variant==='source'){result.set(glyph.name,{...structuredClone(glyph),...(output?{output}: {})});continue;}
    if(glyph.variantFamily?.status==='needs-review'){if(['solid','both','fill-stroke'].includes(output.variant))throw Error(`Review the outline reconstruction for ${glyph.name} before generating fills.`);add({...structuredClone(glyph),output},glyph.name);continue;}
    const source=variantSource(glyph,library,by);
    const addOutline=()=>{const outline=structuredClone(source);outline.output=output;if(source.variantFamily)outline.name=`${source.name}-outline`;add(outline,source.name);};
    const addSolid=()=>{
      let solid;
      if(!source.variantFamily && !source.name.endsWith('-outline') && source.layers.every(layer=>layer.paint==='fill'))solid=structuredClone(source);
      else {
        const review=source.solidReview;
        if(!source.variantFamily && (!review?.recipe || !['candidate','approved'].includes(review.status) || review.sourceSignature!==sourceSignature(source,core)))throw new Error(`Review the generated solid for ${source.name} first (Library properties → Test solid variants).`);
        solid=generateSolid(source,core,source.variantFamily?{edge:'outside',holes:'preserve'}:review.recipe);if(source.variantFamily)solid.name=source.name;
      }
      solid.output=output;if(output.variant==='fill-stroke')solid.layers=solid.layers.map(layer=>({...layer,paint:'both'}));
      add(solid,source.name);
    };
    if(['outline','both'].includes(output.variant))addOutline();
    if(['solid','both','fill-stroke'].includes(output.variant))addSolid();
  }
  return [...result.values()];
}
export function iconProblems(glyph) {
  const problems=[];
  if(glyph.variantFamily?.status==='needs-review')problems.push(glyph.variantFamily.reason);
  if(glyph.reconstruction?.status==='needs-review')problems.push(glyph.reconstruction.reason || 'Centerline reconstruction needs review');
  if(glyph.solidReview?.status==='needs-review')problems.push(glyph.solidReview.reason || 'Generated solid needs review');
  if(glyph.solidReview?.stale)problems.push('Source changed since solid review');
  return problems;
}
