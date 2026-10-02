import paper from 'paper/dist/paper-core.js';
import { ap, apv, inv } from './affine.js';

// Fit redundant selected anchors conservatively in drawing-plane units.
// Each accepted removal is checked against the original, not the previous fit,
// so many small changes cannot silently accumulate into a different outline.
export function cleanupAnchors(node, indices, matrix, tolerance = 0.03) {
  const points = node.pts || [], selected = new Set(indices);
  const indexMap = points.map((_, i) => i);
  if (node.shape !== 'pen' || !Number.isFinite(tolerance) || tolerance <= 0) return { removed: 0, indexMap };
  const vector = (m,v) => apv(m,{x:v[0],y:v[1]});
  const world = point => {
    const p = ap(matrix, point), incoming = vector(matrix, point.in || [0,0]), outgoing = vector(matrix, point.out || [0,0]);
    return new paper.Segment([p.x,p.y],incoming,outgoing);
  };
  const path = items => new paper.Path({ insert:false, closed:!!node.closed, segments:items.map(item=>world(item.point)) });
  const items = points.map((point,original)=>({point:structuredClone(point),original}));
  const original = path(items), inverse = inv(matrix);
  const samples = p => p.curves.flatMap(curve=>Array.from({length:33},(_,i)=>curve.getPointAtTime(i/32)));
  const reference = samples(original), crossings = original.getCrossings(original).length;
  const protectedIndices = new Set(node.roundingAnchors || []);
  for (let i=0;i<points.length;i++) {
    const p=points[i], a=points[(i+points.length-1)%points.length], b=points[(i+1)%points.length];
    if (p.r > 0 || !node.closed && (i===0 || i===points.length-1)) { protectedIndices.add(i);continue; }
    const incoming=vector(matrix,p.in?.some(v=>v) ? p.in.map(v=>-v) : [p.x-a.x,p.y-a.y]);
    const outgoing=vector(matrix,p.out?.some(v=>v) ? p.out : [b.x-p.x,b.y-p.y]);
    const length=Math.hypot(incoming.x,incoming.y)*Math.hypot(outgoing.x,outgoing.y);
    if(length && (incoming.x*outgoing.x+incoming.y*outgoing.y)/length < Math.cos(Math.PI/6))protectedIndices.add(i);
  }
  const closeTo = (samples, target) => samples.every(p=>p.getDistance(target.getNearestPoint(p)) <= tolerance);
  let removed=0, changed=true;
  while(changed && items.length>(node.closed?3:2)) {
    changed=false;
    for(let i=0;i<items.length && items.length>(node.closed?3:2);i++) {
      const item=items[i];if(!selected.has(item.original) || protectedIndices.has(item.original))continue;
      const before=(i+items.length-1)%items.length, after=(i+1)%items.length;
      const a=items[before], b=items[after];
      const span=new paper.Path({insert:false,segments:[world(a.point),world(item.point),world(b.point)]});
      span.flatten(tolerance/8);span.simplify(tolerance/2);
      if(span.segments.length!==2) { span.remove();continue; }
      const candidate=items.map(entry=>({ ...entry,point:structuredClone(entry.point) }));
      for(const [at,segment,side] of [[before,span.firstSegment,'out'],[after,span.lastSegment,'in']]) {
        const entry=candidate[at];
        if(selected.has(entry.original) && !protectedIndices.has(entry.original)) {
          const vector=side==='out'?segment.handleOut:segment.handleIn;
          const handle=apv(inverse,vector);
          entry.point[side]=[handle.x,handle.y];
        }
      }
      span.remove();candidate.splice(i,1);
      const fitted=path(candidate);
      const accepted=closeTo(reference,fitted) && closeTo(samples(fitted),original)
        && fitted.getCrossings(fitted).length===crossings
        && (!node.closed || fitted.clockwise===original.clockwise);
      fitted.remove();
      if(accepted) { items.splice(0,items.length,...candidate);removed++;changed=true;i--; }
    }
  }
  original.remove();
  if(removed) {
    indexMap.fill(-1);items.forEach((entry,i)=>{indexMap[entry.original]=i;});
    node.pts=items.map(entry=>entry.point);
    if(Array.isArray(node.roundingAnchors))node.roundingAnchors=node.roundingAnchors.map(i=>indexMap[i]).filter(i=>i>=0);
  }
  return {removed,indexMap};
}
