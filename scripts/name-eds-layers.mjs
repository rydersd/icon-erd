// Local artwork stays under ignored imports/. Labels are inferred from geometry, never bundled.
import { readFile, writeFile } from 'node:fs/promises';
import paper from 'paper';
import { createGlyphCore } from '../src/glyph-core.js';
import { normalizeGlyph } from '../src/library-io.js';
new paper.Project();
const core = createGlyphCore(paper);
const pack = JSON.parse(await readFile('imports/equinix-icons.json', 'utf8'));
const title = name => name.replace(/-outline$/, '').split('-').map(word => word[0].toUpperCase()+word.slice(1)).join(' ');
const generic = name => !name || /^(?:path|subpath|line|polyline|polygon|rect|circle|ellipse|dot|outline|fill|strokes|union group|compound path)(?:[ -]?\d+)*$/i.test(name);
const bounds = node => core.rawBounds(node) || [0,0,0,0];
const leaves = node => node.shape ? [node] : (node.children || []).flatMap(leaves);
const reports = [];
for (const raw of pack.glyphs) {
  const glyph = normalizeGlyph(raw), label = title(glyph.name), review = [];
  for (const layer of glyph.layers) {
    const nodes = leaves(layer.node), largest = nodes.slice().sort((a,b) => { const x=bounds(a), y=bounds(b); return y[2]*y[3]-x[2]*x[3]; })[0];
    const classify = node => {
      const [x,y,w,h] = bounds(node), cx=x+w/2, cy=y+h/2;
      if (!generic(node.name)) return node.name.split(/[- ]/).map(word => word[0].toUpperCase()+word.slice(1)).join(' ')+` of ${label}`;
      if (/^arrow-/.test(glyph.name)) {
        if (node.shape === 'circle' || node.shape === 'ellipse') return 'Circle around Arrow';
        const vertical = /-(up|down)(?:-outline)?$/.test(glyph.name);
        if (node.shape === 'line') return (vertical ? h>w*2 : w>h*2) ? 'Shaft of Arrow' : 'Bar of Arrow';
        if (!node.closed && node.shape === 'pen') return 'Edge of Arrow Head';
        if (node === largest) return 'Arrow (head and shaft)';
      }
      if (/^search/.test(glyph.name)) return node.shape === 'circle' ? 'Lens of Magnifying Glass' : node.shape === 'line' ? 'Handle of Magnifying Glass' : 'Outline of Magnifying Glass';
      if (/^(clock|stopwatch)/.test(glyph.name)) return node.shape === 'circle' || node === largest ? 'Face of Clock' : 'Hands of Clock';
      if (/^face-/.test(glyph.name)) {
        if (node === largest) return 'Outline of Face';
        if (node.shape === 'circle' && w<5) return cx<12 ? 'Left Eye' : 'Right Eye';
        if (cy>12) return 'Mouth of Face';
      }
      if (/^file/.test(glyph.name)) {
        if (node === largest) return 'Body of Document';
        if (node.shape === 'line' && w>h*3) return 'Text Line of Document';
        if (cx>12 && cy<10) return 'Folded Corner of Document';
      }
      if (/^bell/.test(glyph.name)) {
        if (node === largest) return 'Body of Bell';
        if (cy>17 && w<8) return 'Clapper of Bell';
      }
      if (/^chart-bar/.test(glyph.name) && h>w*1.5) return 'Bar of Chart';
      if (/^barcode/.test(glyph.name)) return 'Bar of Barcode';
      if (/^(menu|ellipsis|list)/.test(glyph.name) && w<5 && h<5) return 'Dot of '+label;
      if (/^(menu|list|waves)/.test(glyph.name) && w>h*3) return 'Line of '+label;
      if (/^user/.test(glyph.name) && (node.shape === 'circle' || node.shape === 'ellipse') && w<12 && cy<12) return 'Head of User';
      if (/^user/.test(glyph.name) && node === largest) return 'Body of User';
      if (node.closed) {
        const path = core.shapeItems(node)[0];
        const container = nodes.find(other => { if (other===node || !other.closed) return false; const outer=core.shapeItems(other)[0]; return Math.abs(outer.area)>Math.abs(path.area) && outer.contains(path.getPointAt(path.length*0.37)); });
        if (container && (layer.node.fillRule === 'evenodd' || Math.sign(core.shapeItems(container)[0].area) !== Math.sign(path.area))) return `Interior Opening of ${label}`;
      }
      if (node === largest || nodes.length===1) return `Outline of ${label}`;
      const location = `${cy<8 ? 'Upper' : cy>16 ? 'Lower' : 'Middle'} ${cx<8 ? 'Left' : cx>16 ? 'Right' : 'Centre'}`;
      const name = `${location} Detail of ${label}`;
      review.push({ name, bounds: [x,y,w,h], reason: 'Geometry locates this detail; its semantic part needs visual review.' });
      return name;
    };
    for (const node of nodes) node.name = classify(node);
    const walk = (node, root=true) => { if (node.shape) return; node.name = root ? `${label} Parts` : `${label} ${node.op === 'compound' ? 'Outline and Openings' : 'Parts'}`; node.children.forEach(child=>walk(child,false)); };
    walk(layer.node);
    if (glyph.name.startsWith('arrow-') && layer.paint==='stroke' && layer.node.children) {
      const edges = layer.node.children.filter(node => node.name==='Edge of Arrow Head');
      if (edges.length>1) {
        const first=layer.node.children.indexOf(edges[0]);
        layer.node.children=layer.node.children.filter(node=>!edges.includes(node));
        layer.node.children.splice(first,0,{ op:'union', name:'Head of Arrow', children:edges });
      }
    }
    // Distinguish repeated semantic components without falling back to source path numbers.
    const dedupe = node => { if (!node.children) return; const counts={}; for (const child of node.children) { counts[child.name]=(counts[child.name]||0)+1; const total=node.children.filter(other=>other.name===child.name || other.name.startsWith(child.name+' · ')).length; if(total>1) child.name+=` · ${counts[child.name]}`; dedupe(child); } };
    dedupe(layer.node);
    layer.name = !generic(layer.name) ? title(layer.name)+` · ${label}` : `${label} ${layer.paint==='stroke' ? 'Strokes' : 'Artwork'}`;
  }
  reports.push({ icon:glyph.name, status:review.length ? 'semantic-review-needed' : 'named', details:review });
  const before=core.resolve(raw), after=core.resolve(glyph);
  for(let i=0;i<before.length;i++) {
    if (before[i].d === after[i].d) continue;
    const a=new paper.CompoundPath(before[i].d),b=new paper.CompoundPath(after[i].d);
    if((glyph.layers[i].paint!=='stroke' && Math.abs(a.area-b.area)>0.001) || Math.abs(a.length-b.length)>0.001) throw Error(`Geometry changed: ${glyph.name}`);
    for(const path of a.children) for(let n=0;n<=20;n++) { const point=path.getPointAt(path.length*n/20); if(point && Math.min(...b.children.map(other=>other.getNearestPoint(point).getDistance(point)))>0.001) throw Error(`Outline changed: ${glyph.name}`); }
  }
  raw.layers=glyph.layers;
}
pack.layerNaming={ version:1, method:'semantic rules and geometry', reviewRequired:reports.filter(item=>item.status!=='named').length };
await writeFile('imports/eds-icons-named.json',JSON.stringify(pack,null,2)+'\n');
await writeFile('imports/eds-layer-naming-review.json',JSON.stringify({count:pack.glyphs.length,reviewRequired:pack.layerNaming.reviewRequired,icons:reports},null,2)+'\n');
console.log(`Prepared ${pack.glyphs.length} named EDS icons; ${pack.layerNaming.reviewRequired} icons have details flagged for semantic review. Geometry verified for every icon.`);
