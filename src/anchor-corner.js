// Collapse consecutive selected clusters to their outer tangent intersection.
// Preserve the exterior control positions and every unselected anchor. This
// deliberately replaces a small rounded corner with a sharp, roundable corner.
export function mergeAnchorCorners(node, indices) {
  const points=node.pts || [], selected=new Set(indices), groups=[];
  const indexMap=points.map((_,i)=>i);
  if(node.shape!=='pen' || selected.size===points.length)return {merged:0,indexMap};
  for(let i=0;i<points.length;i++)if(selected.has(i) && (!i || !selected.has(i-1))) {
    const group=[];while(i<points.length && selected.has(i))group.push(i++);groups.push(group);i--;
  }
  if(node.closed && groups.length>1 && groups[0][0]===0 && groups.at(-1).at(-1)===points.length-1)groups[0]=[...groups.pop(),...groups[0]];
  const replacements=new Map(), removed=new Set();let merged=0, count=points.length;
  for(const group of groups) {
    if(group.length<2 || count-group.length+1<(node.closed?3:2))continue;
    const first=group[0], last=group.at(-1);
    if(!node.closed && (first===0 || last===points.length-1))continue;
    const a=points[first], b=points[last], before=points[(first+points.length-1)%points.length], after=points[(last+1)%points.length];
    const u=a.in?.some(v=>v)?a.in.map(v=>-v):[a.x-before.x,a.y-before.y];
    const v=b.out?.some(v=>v)?b.out:[after.x-b.x,after.y-b.y];
    const cross=u[0]*v[1]-u[1]*v[0];
    let x=group.reduce((sum,i)=>sum+points[i].x,0)/group.length, y=group.reduce((sum,i)=>sum+points[i].y,0)/group.length;
    if(Math.abs(cross)>1e-10) {
      const t=((b.x-a.x)*v[1]-(b.y-a.y)*v[0])/cross;
      const ix=a.x+t*u[0], iy=a.y+t*u[1];
      const diameter=Math.max(...group.map(i=>Math.hypot(points[i].x-a.x,points[i].y-a.y)));
      // Almost parallel tangents can intersect far outside the selected corner.
      if(Math.hypot(ix-x,iy-y)>Math.max(0.03,diameter*4))continue;
      x=ix;y=iy;
    }
    const point={x,y,in:[a.x+(a.in?.[0]||0)-x,a.y+(a.in?.[1]||0)-y],out:[b.x+(b.out?.[0]||0)-x,b.y+(b.out?.[1]||0)-y]};
    const keep=Math.min(...group);replacements.set(keep,{point,group});group.forEach(i=>removed.add(i));count-=group.length-1;merged+=group.length-1;
  }
  if(merged) {
    const result=[];for(let i=0;i<points.length;i++) {
      const replacement=replacements.get(i);
      if(replacement){replacement.group.forEach(old=>{indexMap[old]=result.length;});result.push(replacement.point);}
      else if(!removed.has(i)){indexMap[i]=result.length;result.push(points[i]);}
    }
    node.pts=result;
    if(Array.isArray(node.roundingAnchors))node.roundingAnchors=[...new Set(node.roundingAnchors.map(i=>indexMap[i]))];
  }
  return {merged,indexMap};
}
