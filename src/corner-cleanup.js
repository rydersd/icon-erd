import paper from 'paper/dist/paper-core.js';
import { mergeAnchorCorners } from './anchor-corner.js';
import { cleanupAnchors } from './anchor-cleanup.js';

const samples = path => path.curves.flatMap(curve => Array.from({length:49},(_,i)=>curve.getPointAtTime(i/48)));
const evaluated = (core,node,matrix) => {
  const path=core.shapeItems(node)[0];
  if(path)path.transform(new paper.Matrix(...matrix));
  return path;
};
const closeTo = (points,path,tolerance) => points.every(point=>point.getDistance(path.getNearestPoint(point))<=tolerance);

// Recognize short selected fillets between straight exterior edges. A smooth
// circular transition becomes one radius-bearing corner; an abrupt join stays
// sharp. Every accepted reconstruction is compared with the original outline.
export function cleanupDrawingAnchors(node,indices,matrix,core,tolerance=0.03) {
  const identity=(node.pts||[]).map((_,i)=>i);
  if(node.shape!=='pen' || node.deform?.length)return {removed:0,rounded:0,sharp:0,indexMap:identity};
  const original=evaluated(core,node,matrix);
  if(!original)return {removed:0,rounded:0,sharp:0,indexMap:identity};
  const reference=samples(original), crossings=original.getCrossings(original).length;
  const fits = candidate => {
    const path=evaluated(core,candidate,matrix);
    const accepted=path && closeTo(reference,path,tolerance) && closeTo(samples(path),original,tolerance)
      && path.getCrossings(path).length===crossings && (!node.closed || path.clockwise===original.clockwise);
    path?.remove();return accepted;
  };
  let selected=new Set(indices), indexMap=identity, removed=0, rounded=0, sharp=0, changed=true;
  while(changed) {
    changed=false;
    const local=core.shapeItems({...node,pts:node.pts.map(point=>({...point,r:0}))})[0];
    const count=node.pts.length, minimum=node.closed?3:2;
    let best=null;
    for(let start=0;start<count;start++) {
      if(!selected.has(start) || !node.closed && start===0)continue;
      const group=[];
      for(let length=1;length<=Math.min(12,count-minimum+1);length++) {
        const i=(start+length-1)%count;
        if(!selected.has(i) || node.pts[i].r>0 || !node.closed && i===count-1)break;
        group.push(i);if(length<2)continue;
        const incoming=local.curves[(start-1+local.curves.length)%local.curves.length], outgoing=local.curves[i%local.curves.length];
        if(!incoming?.isStraight() || !outgoing?.isStraight())continue;
        const a=incoming.getTangentAtTime(1), b=outgoing.getTangentAtTime(0);
        if(a.isZero() || b.isZero())continue;
        const turn=Math.abs(a.getDirectedAngle(b))*Math.PI/180;
        if(turn<0.1 || turn>Math.PI-0.05)continue;
        const smooth=group.every(at=>{
          const prev=local.curves[(at-1+local.curves.length)%local.curves.length],next=local.curves[at%local.curves.length];
          const u=prev?.getTangentAtTime(1),v=next?.getTangentAtTime(0);
          return u && v && !u.isZero() && !v.isZero() && Math.abs(u.getDirectedAngle(v))<8;
        });
        const curved=group.slice(0,-1).some(at=>!local.curves[at%local.curves.length].isStraight());
        // A non-smooth curved junction is not evidence of a rounded corner.
        if(curved && !smooth)continue;
        const candidate=structuredClone(node), result=mergeAnchorCorners(candidate,group);
        if(!result.merged)continue;
        const at=result.indexMap[start], point=candidate.pts[at];
        if(smooth && curved) {
          const first=node.pts[start],last=node.pts[i];
          const d=(Math.hypot(first.x-point.x,first.y-point.y)+Math.hypot(last.x-point.x,last.y-point.y))/2;
          point.r=d/Math.tan(turn/2);
        } else point.r=0;
        if(!fits(candidate))continue;
        if(!best || result.merged>best.result.merged)best={candidate,result,rounded:point.r>0};
      }
    }
    local.remove();
    if(best) {
      Object.assign(node,best.candidate);removed+=best.result.merged;
      if(best.rounded)rounded++;else sharp++;
      indexMap=indexMap.map(i=>i<0?-1:best.result.indexMap[i]);
      selected=new Set([...selected].map(i=>best.result.indexMap[i]));changed=true;
    }
  }
  // Ordinary simplification shares the global outline budget with corner fits.
  const simplified=structuredClone(node), result=cleanupAnchors(simplified,[...selected],matrix,tolerance);
  if(result.removed && fits(simplified)) {
    Object.assign(node,simplified);removed+=result.removed;
    indexMap=indexMap.map(i=>i<0?-1:result.indexMap[i]);
  }
  original.remove();
  return {removed,rounded,sharp,indexMap};
}
