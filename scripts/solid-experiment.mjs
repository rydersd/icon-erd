// Private experiment artifacts; never writes artwork into public source/output.
import paper from 'paper';
import {readFile,writeFile} from 'node:fs/promises';
import {createGlyphCore} from '../src/glyph-core.js';
import {parseLibraryArchive,libraryDocument} from '../src/library-io.js';
import {generateSolid,solidName} from '../src/solid-variants.js';
import {projectComponents} from '../src/shared-forms.js';
import {libraryZIP} from '../src/library-zip.js';
new paper.Project();const core=createGlyphCore(paper);
const archive=parseLibraryArchive(await readFile('imports/eds/current-library.json','utf8'));projectComponents(archive.glyphs,archive.components,core);
const report=JSON.parse(await readFile('imports/eds/solid-review.json','utf8')),by=new Map(archive.glyphs.map(g=>[g.name,g]));
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const matched=[],cards=[];
for(const entry of report.entries){const source=by.get(entry.name);source.solidReview=entry;let generated=null,error='';try{if(entry.recipe)generated=generateSolid(source,core,entry.recipe);}catch(e){error=e.message;}if(entry.status==='candidate' && generated)matched.push(generated);
 const svg=g=>g?core.toSVG(g,{mode:'baked',mono:true,size:112}):'<span>No candidate</span>';
 cards.push(`<article data-status="${entry.status}"><h2>${escape(entry.name)}</h2><p>${escape(entry.reason)} ${escape(error)}</p><div>${svg(source)}${svg(by.get(solidName(entry.name)))}${svg(generated)}</div><small>Outline / filled reference / generated solid</small></article>`);
}
await writeFile('imports/eds/solid-experiment.html',`<!doctype html><meta charset="utf-8"><title>EDS solid comparison</title><style>body{font:14px system-ui;background:#eef1f6;padding:24px;color:#17202d}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(370px,1fr));gap:12px}article{padding:12px;background:white;border:1px solid #a8b0bd;border-radius:8px}h2{font-size:14px}article div{display:flex;gap:8px}svg{background:#f8f8f8;max-width:30%}small{color:#555}article[data-status=candidate]{border:2px solid #228055}[hidden]{display:none}</style><h1>EDS solid experiment</h1><p>${report.entries.length} paired families; ${matched.length} matched at ≥97% silhouette overlap and matching holes/parts. Existing originals retained. Approximations need manual review; high overlap alone is insufficient.</p><label><input type="checkbox" onchange="document.querySelectorAll('article').forEach(card=>card.hidden=this.checked&&card.dataset.status==='candidate')"> Problems only</label><main>${cards.join('')}</main>`);
await writeFile('imports/eds/eds-solid-experiment.zip',await libraryZIP(libraryDocument(archive.glyphs,'all',archive.originals,archive.components,archive.libraryProperties),g=>core.toSVG(g,{mode:'baked'}),{renderGlyphs:matched}));
console.log(JSON.stringify({matched:matched.length,html:'imports/eds/solid-experiment.html',zip:'imports/eds/eds-solid-experiment.zip'}));
