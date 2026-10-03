import { zip, unzipSync, strToU8, strFromU8 } from 'fflate';
import { parseLibraryArchive } from './library-io.js';
const MAX_BYTES = 128 * 1024 * 1024;
const segment = name => encodeURIComponent(name).replace(/\./g, '%2E');
export async function libraryZIP(document, svgForGlyph, {structure='group',root='',includeSVG=true,renderGlyphs=document.glyphs,includePNG=false,rasterize} = {}) {
  const prefix = root.trim() ? `${segment(root.trim())}/` : '';
  const files = { [`${prefix}library.json`]: strToU8(JSON.stringify(document, null, 2)) };
  const icons = [];
  for (const glyph of renderGlyphs) {
    const group = (glyph.group || '').split('/').map(part=>part.trim()).filter(Boolean);
    const folder = structure === 'flat' ? '' : `${(group.length ? group : ['Ungrouped']).map(segment).join('/')}/`;
    const path = `${prefix}svg/${folder}${segment(glyph.name)}.svg`;
    const svg=(includeSVG || includePNG) ? svgForGlyph(glyph) : null;
    if (includeSVG) files[path] = strToU8(svg);
    const png=[];
    if(includePNG) {
      if(!rasterize)throw new Error('PNG export requires a rasterizer');
      const profile=glyph.output?.profile, sizes=glyph.output?.sizes || [glyph.exportSize || 24],data=new Map();
      for(const size of sizes){const bytes=await rasterize(svg,size),file=`${prefix}png/${folder}${segment(glyph.name)}/${segment(glyph.name)}-${size}.png`;files[file]=bytes;data.set(size,bytes);png.push({size,path:file});}
      if(profile==='menu-bar' && data.has(18) && data.has(36)) {
        const asset=`${prefix}assets/${segment(glyph.name)}.imageset/`;
        for(const size of [18,36])files[`${asset}icon-${size}.png`]=data.get(size);
        files[`${asset}Contents.json`]=strToU8(JSON.stringify({images:[{idiom:'mac',scale:'1x',filename:'icon-18.png'},{idiom:'mac',scale:'2x',filename:'icon-36.png'}],info:{author:'iconerd',version:1},properties:{'template-rendering-intent':'template'}},null,2));
      }
      if(profile==='mac-app' && [16,32,64,128,256,512,1024].every(size=>data.has(size))) {
        const asset=`${prefix}assets/${segment(glyph.name)}.appiconset/`,images=[];
        for(const size of [16,32,128,256,512])for(const scale of [1,2])images.push({idiom:'mac',size:`${size}x${size}`,scale:`${scale}x`,filename:`icon-${size*scale}.png`});
        for(const [size,bytes] of data)files[`${asset}icon-${size}.png`]=bytes;
        files[`${asset}Contents.json`]=strToU8(JSON.stringify({images,info:{author:'iconerd',version:1}},null,2));
      }
    }
    icons.push({ name:glyph.name, source:glyph.generatedFrom || glyph.name,group:group.join('/'), tags:glyph.tags || [], svg:includeSVG?path:null,png, figmaComponentName:[...group,glyph.name].join('/') });
  }
  files[`${prefix}organization.json`] = strToU8(JSON.stringify({format:'glyph-workbench-organization',version:1,structure,icons},null,2));
  return await new Promise((resolve,reject)=>zip(files,{level:6},(error,data)=>error?reject(error):resolve(data)));
}
export function readLibraryZIP(bytes) {
  if (bytes.length > MAX_BYTES) throw new Error('ZIP is too large (128 MB limit)');
  let total = 0;
  const files = unzipSync(bytes, { filter: file => {
    if (file.name.endsWith('organization.json') || !file.name.toLowerCase().endsWith('.json') || file.name.startsWith('__MACOSX/')) return false;
    total += file.originalSize;
    if (total > MAX_BYTES) throw new Error('ZIP JSON contents exceed 128 MB');
    return true;
  } });
  const manifest = Object.keys(files).find(name => name === 'library.json') || Object.keys(files).find(name => name.endsWith('/library.json'));
  if (manifest) return strFromU8(files[manifest]);
  const glyphs = [], originals = [];
  for (const bytes of Object.values(files)) { const archive=parseLibraryArchive(strFromU8(bytes)); glyphs.push(...archive.glyphs); originals.push(...archive.originals.values()); }
  if (!glyphs.length) throw new Error('ZIP contains no editable icon JSON; SVG-only ZIPs are not supported');
  return JSON.stringify({format:'glyph-workbench-library',version:1,glyphs,originals});
}
