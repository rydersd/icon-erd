// Filter an owner-browser ZIP by preserved EDS metadata, never by colliding names.
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/prepare-eds-handoff.mjs <owner-browser-library.zip>');
const files=unzipSync(await readFile(source));const libPath=Object.keys(files).find(name=>name.endsWith('library.json'));const orgPath=Object.keys(files).find(name=>name.endsWith('organization.json'));
const doc=JSON.parse(strFromU8(files[libPath])),org=JSON.parse(strFromU8(files[orgPath]));
const glyphs=doc.glyphs.filter(glyph=>glyph.eds&&typeof glyph.eds==='object');if(glyphs.length!==580)throw new Error(`Expected 580 EDS-sourced icons, found ${glyphs.length}`);
const names=new Set(glyphs.map(glyph=>glyph.name));doc.glyphs=glyphs;doc.originals=doc.originals.filter(glyph=>names.has(glyph.name));doc.count=glyphs.length;doc.scope='eds';org.icons=org.icons.filter(icon=>names.has(icon.name));
if(doc.originals.length!==580||org.icons.length!==580)throw new Error('Missing EDS originals or organization records');
const output={[libPath]:strToU8(JSON.stringify(doc,null,2)),[orgPath]:strToU8(JSON.stringify(org,null,2))};for(const icon of org.icons){if(!icon.svg||!files[icon.svg])throw new Error(`Missing SVG for ${icon.name}`);output[icon.svg]=files[icon.svg];}
const bytes=zipSync(output,{level:6});await writeFile('eds-icons-current.zip',bytes);
console.log(JSON.stringify({icons:glyphs.length,originals:doc.originals.length,svgFiles:org.icons.length,bytes:bytes.length,statuses:glyphs.reduce((counts,glyph)=>{const status=glyph.reconstruction?.status||'not-run';counts[status]=(counts[status]||0)+1;return counts;},{}),renamedArrows:glyphs.filter(glyph=>/^arrow-(right|down|left|up)-2$/.test(glyph.name)).map(glyph=>glyph.name)},null,2));
