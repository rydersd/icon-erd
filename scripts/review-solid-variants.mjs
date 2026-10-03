import paper from 'paper';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createGlyphCore} from '../src/glyph-core.js';
import {parseLibraryArchive} from '../src/library-io.js';
import {projectComponents} from '../src/shared-forms.js';
import {reviewSolid,solidName} from '../src/solid-variants.js';
new paper.Project();const core=createGlyphCore(paper);
const source=process.argv[2] || 'imports/eds/current-library.json',output=process.argv[3] || 'imports/eds/solid-review.json';
const archive=parseLibraryArchive(await readFile(source,'utf8'));projectComponents(archive.glyphs,archive.components,core);const by=new Map(archive.glyphs.map(g=>[g.name,g])),entries=[];
for(const outline of archive.glyphs.filter(g=>g.name.endsWith('-outline') && by.has(solidName(g.name)))) {
  entries.push({name:outline.name,...reviewSolid(outline,by.get(solidName(outline.name)),core)});
}
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({format:'iconerd-solid-review',version:1,createdAt:new Date().toISOString(),entries},null,2)+'\n');
console.log(JSON.stringify({pairs:entries.length,candidates:entries.filter(e=>e.status==='candidate').length,needsReview:entries.filter(e=>e.status==='needs-review').length,output}));
