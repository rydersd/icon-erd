import { zip, unzipSync, strToU8, strFromU8 } from 'fflate';
import { parseLibraryArchive } from './library-io.js';
const MAX_BYTES = 128 * 1024 * 1024;
const segment = name => encodeURIComponent(name).replace(/\./g, '%2E');
export async function libraryZIP(document, svgForGlyph, {structure='group',root='',includeSVG=true} = {}) {
  const prefix = root.trim() ? `${segment(root.trim())}/` : '';
  const files = { [`${prefix}library.json`]: strToU8(JSON.stringify(document, null, 2)) };
  const icons = [];
  for (const glyph of document.glyphs) {
    const group = (glyph.group || '').split('/').map(part=>part.trim()).filter(Boolean);
    const folder = structure === 'flat' ? '' : `${(group.length ? group : ['Ungrouped']).map(segment).join('/')}/`;
    const path = `${prefix}svg/${folder}${segment(glyph.name)}.svg`;
    if (includeSVG) files[path] = strToU8(svgForGlyph(glyph));
    icons.push({ name:glyph.name, group:group.join('/'), tags:glyph.tags || [], svg:includeSVG?path:null, figmaComponentName:[...group,glyph.name].join('/') });
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
