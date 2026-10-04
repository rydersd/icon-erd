// Correction examples are local document evidence, never automatic telemetry.
export const REPAIR_DRAFT_KEY = 'gw-reconstruction-draft-v1';
export const geometryIdentity = glyph => JSON.stringify([glyph?.name,glyph?.layers,glyph?.symmetry,glyph?.weight,glyph?.strokeOverride,glyph?.setStyle,glyph?.strokeCap,glyph?.strokeJoin]);
export function exampleState(record,library) {
  return geometryIdentity(library.find(g=>g.name===record.accepted.name)) === record.acceptedIdentity ? 'current' : 'superseded';
}
export function learnedInset(records,library,source,stroke) {
  const ratios=records.filter(r=>r.schemaVersion===1 && r.intent==='faithful' && r.group===(source.group||'Ungrouped') && exampleState(r,library)==='current' && r.settings.stroke>0 && Number.isFinite(r.settings.inset)).map(r=>r.settings.inset/r.settings.stroke).sort((a,b)=>a-b);
  if(!ratios.length)return null;
  const m=Math.floor(ratios.length/2),ratio=ratios.length%2?ratios[m]:(ratios[m-1]+ratios[m])/2;
  return {inset:ratio*stroke,count:ratios.length};
}

export async function contentHashes({source,initial,accepted,reference}) {
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  return {source:await digest(source),initial:await digest(initial),accepted:await digest(accepted),target:reference?await digest(reference):null};
}
