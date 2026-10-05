import {fuseArea,strokeArea} from './proximity-fusion.js';
import {strokeWeight,layerStyleGlyph} from './stroke-weight.js';
import paper from 'paper';
import {offset,offsetStroke} from 'paperjs-offset';

const paths=item=>item.children || [item];
const combine=(a,b,op='unite')=>{if(!a)return b;const result=a[op](b,{insert:false});a.remove();b.remove();return result;};
const parse=d=>new paper.CompoundPath({pathData:d,insert:false});
export const solidName=name=>name.endsWith('-outline') ? name.slice(0,-8) : `${name}-solid`;
export function sourceSignature(glyph,core) {return JSON.stringify({width:strokeWeight(glyph),endRounding:glyph.setStyle?.endRounding ?? glyph.setStyle?.rounding ?? 0,style:core.strokeStyle(glyph,{}),layers:core.resolve(glyph).map(layer=>({id:layer.id,paint:layer.paint,strokeWidth:layer.strokeWidth,rounding:layer.rounding,endRounding:layer.endRounding,visible:layer.visible,opacity:layer.opacity,d:layer.d,parts:layer.parts.map(part=>({cap:part.cap,fusion:part.fusion && {recipe:part.fusion.recipe,sourceParts:part.fusion.sourceParts}}))}))});}

// Offset closed centerlines to the chosen stroke boundary. Open paths retain
// their expanded stroke; no invented closure is inserted across a real gap.
export function generateSolid(glyph,core,{edge='outside',holes='preserve'}={}) {
  if(!['outside','center','inside'].includes(edge) || !['preserve','fill'].includes(holes))throw new Error('Invalid solid recipe');
  const layers=[];
  for(const [layerIndex,layer] of core.resolve(glyph).entries()) {
    const styled=layerStyleGlyph(glyph,layer),width=layer.strokeWidth ?? strokeWeight(glyph),distance=({outside:1,center:0,inside:-1})[edge]*width/2;
    if(layer.error)throw new Error(layer.error);
    if(!layer.visible || !layer.d)continue;
    let result=null;
    for(const part of layer.parts) {
      let area=solidArea(part.fusion?.sourceParts||[part],layer,styled,width,distance,holes,core,!!part.fusion,layerIndex);
      if(part.fusion){try{const fused=fuseArea(area,part.fusion.recipe);area.remove();area=fused.item;}catch(error){area?.remove();result?.remove();throw error;}}
      if(area)result=combine(result,area);
    }
    if(result){layers.push({id:layer.id,name:layer.name,role:layer.role,color:layer.color,paint:'fill',symmetry:false,opacity:layer.opacity,node:{shape:'path',d:result.pathData}});result.remove();}
  }
  if(!layers.length)throw new Error('No drawable solid geometry');
  return {...structuredClone(glyph),name:solidName(glyph.name),layers,symmetry:{rotate:1},setStyle:{...glyph.setStyle,rounding:0,endRounding:0},generatedFrom:glyph.name};
}
function silhouette(glyph,core) {
  let result=null;
  for(const layer of core.resolve(glyph))if(layer.visible && layer.d)result=combine(result,parse(layer.d));
  return result;
}
const holeCount=item=>paths(item).filter(path=>path.area<0).length;
export function compareSolid(candidate,reference,core) {
  const a=silhouette(candidate,core),b=silhouette(reference,core);
  if(!a || !b){a?.remove();b?.remove();throw new Error('Missing comparison silhouette');}
  a.reorient(true,true);b.reorient(true,true);
  const intersection=a.intersect(b,{insert:false}),union=a.unite(b,{insert:false});
  const iou=Math.abs(union.area)>1e-8 ? Math.abs(intersection.area/union.area) : 0;
  const topology=holeCount(a)===holeCount(b) && paths(a).filter(p=>p.area>0).length===paths(b).filter(p=>p.area>0).length;
  a.remove();b.remove();intersection.remove();union.remove();return {iou,topology};
}
export function reviewSolid(outline,reference,core) {
  let best=null,errors=[];
  for(const edge of ['outside','center','inside'])for(const holes of ['preserve','fill'])try {
    const recipe={edge,holes},candidate=generateSolid(outline,core,recipe),score=compareSolid(candidate,reference,core);
    if(!best || (score.topology && score.iou>=0.97 && !(best.topology && best.iou>=0.97)) || (score.topology===best.topology && score.iou>best.iou))best={recipe,...score};
  }catch(error){errors.push(error.message);}
  if(!best)return {status:'needs-review',reason:errors[0] || 'No safe solid candidate',sourceSignature:sourceSignature(outline,core),reference:reference.name};
  return {...best,status:best.iou>=0.97 && best.topology ? 'candidate' : 'needs-review',reason:`Silhouette overlap ${(best.iou*100).toFixed(1)}%; ${best.topology?'matching':'different'} holes/parts.`,sourceSignature:sourceSignature(outline,core),reference:reference.name};
}

function solidArea(parts,layer,styled,width,distance,holes,core,fused=false,layerIndex) {
    let result=null;
    for(const part of parts) {
      const source=parse(part.d), contours=paths(source);
      const closed=contours.filter(path=>path.closed && Math.abs(path.area)>1e-8);
      const ordered=[...closed].sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
      for(const contour of ordered) {
        const parents=closed.filter(other=>other!==contour && Math.abs(other.area)>Math.abs(contour.area) && contour.segments.every(segment=>other.contains(segment.point)));
        const hole=parents.length%2===1;
        if(hole && holes==='fill')continue;
        const path=contour.clone({insert:false});path.clockwise=true;
        const shift=layer.paint==='fill' ? 0 : (hole ? -distance : distance);
        const boundary=shift ? offset(path,shift,{join:'round',insert:false}) : path.clone({insert:false});path.remove();
        if(!boundary || !Number.isFinite(boundary.area) || Math.abs(boundary.area)<1e-8){boundary?.remove();source.remove();result?.remove();throw new Error('An offset boundary collapsed');}
        result=combine(result,boundary,hole?'subtract':'unite');
      }
      for(const contour of contours.filter(path=>!path.closed)) {
        if(contour.length<1e-8)continue;
        if(fused){const area=strokeArea([{d:contour.pathData,cap:part.cap}],width,p=>core.strokeStyle(styled,{},p.cap),p=>core.strokeTipsSVG(styled,p.d,{mode:'baked',weight:width,layerIndex}));result=combine(result,area);continue;}
        const style=core.strokeStyle(styled,{},part.cap);
        if((styled.setStyle?.endRounding ?? styled.setStyle?.rounding ?? 0)>0)throw new Error('Procedural line-end rounding requires manual solid reconstruction');
        if(style.cap==='square')throw new Error('Square line ends require manual solid review');
        const expanded=offsetStroke(contour,width/2,{join:style.join,cap:style.cap==='butt'?'butt':'round',insert:false});
        result=combine(result,expanded);
      }
      source.remove();
    }
    return result;
}
