import paper from 'paper';
// App-icon paints are layer-local; component definitions continue to own geometry.
const hex=/^#[0-9a-f]{6}$/i;
export function validateGradient(value) {
  if(!value || !['linear','radial'].includes(value.type))throw Error('Invalid gradient type');
  const keys=value.type==='linear'?['x1','y1','x2','y2']:['cx','cy','r'];
  for(const key of keys)if(!Number.isFinite(value[key]) || value[key]<0 || value[key]>1)throw Error(`Gradient ${key} must be from 0 to 1`);
  if(value.type==='linear' && value.x1===value.x2 && value.y1===value.y2 || value.type==='radial' && value.r===0)throw Error('Gradient needs a nonzero span');
  if(!Array.isArray(value.stops) || value.stops.length<2 || value.stops.length>16)throw Error('Gradient needs 2–16 stops');
  let last=-1;
  for(const stop of value.stops){if(!Number.isFinite(stop.offset) || stop.offset<0 || stop.offset<last || stop.offset>1 || !hex.test(stop.color) || !Number.isFinite(stop.opacity) || stop.opacity<0 || stop.opacity>1)throw Error('Invalid gradient stop');last=stop.offset;}
  return structuredClone(value);
}
export function defaultGradient(type) {return {type,...(type==='linear'?{x1:0,y1:0,x2:1,y2:1}:{cx:0.5,cy:0.5,r:0.5}),stops:[{offset:0,color:'#0267e0',opacity:1},{offset:1,color:'#b450ed',opacity:1}]};}
export function gradientSVG(layer,glyph,prefix,mono=false) {
  if(!layer.fillGradient || mono || glyph.output?.profile==='menu-bar' || glyph.output?.colorMode==='single')return null;
  const g=validateGradient(layer.fillGradient);let hash=2166136261;for(const ch of JSON.stringify([glyph.name,layer.d,g]))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  const id=`${prefix.replace(/[^a-z0-9_-]/gi,'-')}-${(hash>>>0).toString(16)}`;
  const tag=g.type==='linear'?'linearGradient':'radialGradient',keys=g.type==='linear'?['x1','y1','x2','y2']:['cx','cy','r'];
  const attrs=keys.map(k=>`${k}="${g[k]}"`).join(' ');
  const path=new paper.CompoundPath({pathData:layer.d||'',insert:false}),bounds=path.bounds;path.remove();
  const transform=`translate(${bounds.x} ${bounds.y}) scale(${Math.max(bounds.width,1e-9)} ${Math.max(bounds.height,1e-9)})`;
  const stops=g.stops.map(s=>`<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`).join('');
  return {fill:`url(#${id})`,defs:`<${tag} id="${id}" gradientUnits="userSpaceOnUse" gradientTransform="${transform}" ${attrs}>${stops}</${tag}>`};
}
export function validateReferenceImage(ref) {
  if(!ref || typeof ref.src!=='string' || ref.src.length>12*1024*1024 || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(ref.src))throw Error('Reference must be an embedded PNG, JPEG or WebP');
  for(const k of ['x','y','width','height','opacity'])if(!Number.isFinite(ref[k]))throw Error('Invalid reference placement');
  if(ref.width<=0 || ref.height<=0 || ref.width>10000 || ref.height>10000 || Math.abs(ref.x)>10000 || Math.abs(ref.y)>10000 || ref.opacity<0 || ref.opacity>1)throw Error('Invalid reference bounds/opacity');
  for(const k of ['visible','locked','includeInExport'])if(typeof ref[k]!=='boolean')throw Error('Invalid reference visibility/export setting');
  if(typeof ref.name!=='string' || ref.name.length>256)throw Error('Invalid reference name');
  return structuredClone(ref);
}
export function referenceSVG(glyph,editing=false) {
  const r=glyph.referenceImage;
  if(!r || !r.visible || !editing && (!r.includeInExport || glyph.output?.profile==='menu-bar'))return '';
  validateReferenceImage(r);
  return `<image data-reference-image="true" href="${r.src}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" opacity="${r.opacity}" preserveAspectRatio="none" pointer-events="none"/>`;
}
