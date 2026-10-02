// Private artwork stays in ignored imports/. Run with the Python environment in argv[2].
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import paper from 'paper';
import sharp from 'sharp';
import { createGlyphCore } from '../src/glyph-core.js';
new paper.Project();const core=createGlyphCore(paper);
const pack=JSON.parse(await readFile('imports/eds-icons-named.json','utf8'));
await mkdir('imports/reconstruction/masks',{recursive:true});
const sources=[];
for(const [index,glyph] of pack.glyphs.entries()){
 const svg=core.toSVG(glyph,{mode:'baked',mono:true,size:384});
 await sharp(Buffer.from(svg)).resize(384,384).png().toFile(`imports/reconstruction/masks/${index}.png`);
 sources.push({name:glyph.name,sourceSignature:JSON.stringify(core.resolve(glyph).map(layer=>({id:layer.id,paint:layer.paint,d:layer.d}))) });
}
await writeFile('imports/reconstruction/sources.json',JSON.stringify(sources));
const result=spawnSync(process.argv[2]||'python3',['scripts/reconstruct-centerlines.py'],{stdio:'inherit'});if(result.status)process.exit(result.status);
const traced=JSON.parse(await readFile('imports/reconstruction/traced.json','utf8')),entries=[];
for(const [index,item] of traced.entries()){
 let candidate=null;
 if(item.paths?.length){
  const children=item.paths.map((points,pathIndex)=>{
   const closed=points.closed;const path=new paper.Path({segments:points.points.map(([x,y])=>[x,y]),closed,insert:false});path.simplify(0.035);
   const node={shape:'pen',endpoints:points.endpoints,name:`Centerline ${pathIndex+1}`,closed,pts:path.segments.map(segment=>({x:+segment.point.x.toFixed(4),y:+segment.point.y.toFixed(4),...(segment.handleIn.length?{in:[segment.handleIn.x,segment.handleIn.y]}:{}),...(segment.handleOut.length?{out:[segment.handleOut.x,segment.handleOut.y]}:{})}))};path.remove();return node;
  });
  const resolved=core.resolve(pack.glyphs[index]);
  if(resolved.length===1){
    const outline=new paper.CompoundPath({pathData:resolved[0].d,insert:false});
    const rings=outline.children.filter(path=>path.closed&&Math.abs(path.bounds.width-path.bounds.height)<.01&&Array.from({length:32},(_,i)=>path.getPointAt(path.length*i/32)).every(point=>Math.abs(point.getDistance(path.bounds.center)-path.bounds.width/2)<.02));
    if(rings.length===2&&rings[0].bounds.center.getDistance(rings[1].bounds.center)<.01){
      const outer=rings.reduce((a,b)=>a.bounds.width>b.bounds.width?a:b),inner=rings.find(ring=>ring!==outer),r=(outer.bounds.width+inner.bounds.width)/4,c=outer.bounds.center;
      const other=children.filter(node=>!node.pts.every(point=>Math.abs(Math.hypot(point.x-c.x,point.y-c.y)-r)<.25));
      children.splice(0,children.length,{shape:'circle',name:'Circular ring centerline',cx:c.x,cy:c.y,r},...other);item.width=(outer.bounds.width-inner.bounds.width)/2;
    }
    outline.remove();
  }
  candidate={name:item.name,grid:0.05,weight:item.width,provenance:'converted-stroke',symmetry:{mirror:null,rotate:1},layers:[{id:'centerlines',name:'Reconstructed centerlines',paint:'stroke',role:'primary',node:{op:'union',name:'Reconstructed paths',children}}]};
  const original=await sharp(`imports/reconstruction/masks/${index}.png`).ensureAlpha().raw().toBuffer();
  const score=async glyph=>{const svg=core.toSVG(glyph,{mode:'baked',mono:true,size:384,join:'round'});const pixels=await sharp(Buffer.from(svg)).resize(384,384).ensureAlpha().raw().toBuffer();let intersection=0,union=0;for(let i=3;i<pixels.length;i+=4){const a=original[i]>127,b=pixels[i]>127;if(a&&b)intersection++;if(a||b)union++;}return intersection/Math.max(1,union);};
  let best=await score(candidate);
  for(const factor of [.4,.5,.6]){
    const flat=structuredClone(candidate);
    for(const node of flat.layers[0].node.children){if(node.shape!=='pen'||node.closed)continue;node.cap='butt';for(const [which,index] of [[0,0],[1,node.pts.length-1]]){if(!node.endpoints?.[which])continue;const point=node.pts[index],next=node.pts[which?index-1:1],dx=point.x-next.x,dy=point.y-next.y,length=Math.hypot(dx,dy);if(length){point.x+=dx/length*flat.weight*factor;point.y+=dy/length*flat.weight*factor;}}}
    const value=await score(flat);if(value>best){best=value;candidate=flat;}
  }
  const svg=core.toSVG(candidate,{mode:'baked',mono:true,size:384,join:'round'});await sharp(Buffer.from(svg)).resize(384,384).png().toFile(`imports/reconstruction/masks/${index}-candidate.png`);
 }
 const existing=core.resolve(pack.glyphs[index]).every(layer=>layer.paint==='stroke');
 entries.push({...sources[index],candidate:existing?null:candidate,existing,widthVariation:item.widthVariation,reason:existing?'Editable stroke centerlines already exist; preserved unchanged.':item.reason});
}
await writeFile('imports/reconstruction/candidates.json',JSON.stringify(entries));
const score=spawnSync(process.argv[2]||'python3',['scripts/reconstruct-centerlines.py','score'],{stdio:'inherit'});if(score.status)process.exit(score.status);
