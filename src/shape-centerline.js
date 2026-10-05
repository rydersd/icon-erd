import paper from 'paper';
import {insetOutline} from './inset-conversion.js';

// Isolate one selected form without inheriting its parents' Boolean operations.
// Parent pivots still belong to the complete parent, not the isolated child.
export function centerlineSource(glyph,selection,core) {
  if(!selection || !glyph.layers[selection.l])return null;
  const layer=glyph.layers[selection.l];
  if(layer.paint!=='fill'||layer.visible===false)return null;
  const path=selection.p||[],ancestors=[];let node=layer.node;
  for(const i of path){ancestors.push(node);node=node.children?.[i];if(!node)return null;}
  if(node.hidden)return null;
  const name=node.name||layer.name||'Shape';node=structuredClone(node);
  for(const ancestor of ancestors.reverse()) {
    let transform=structuredClone(ancestor.transform);
    if(transform&&!transform.origin){const geometry=core.evalNode({...ancestor,transform:undefined}),items=[...(geometry.closed?[geometry.closed]:[]),...geometry.open];const b=items.reduce((bounds,item)=>bounds?bounds.unite(item.bounds):item.bounds.clone(),null);if(b)transform.origin=[b.center.x,b.center.y];for(const item of items)item.remove();}
    node={op:'union',children:[node],transform,symmetry:structuredClone(ancestor.symmetry),symmetryStage:ancestor.symmetryStage,deform:structuredClone(ancestor.deform),hidden:ancestor.hidden};
  }
  return {...structuredClone(glyph),name,layers:[{...structuredClone(layer),node}]};
}

export function centerlineLayer(source,core,settings,id) {
  const candidate=insetOutline(source,core,settings),layer=candidate.layers[0];
  return {...layer,id,name:`${source.name} inset contour`,strokeWidth:settings.stroke,rounding:0,endRounding:0};
}

// Recognize a capsule by its resolved boundary, not by its imported node type.
// Every boundary sample must lie on the capsule envelope, with matching area.
export function recoverBar(source,core) {
  const resolved=core.resolve(source)[0];if(resolved.error||!resolved.d)return null;
  const compound=new paper.CompoundPath({pathData:resolved.d,insert:false}),lines=[],widths=[];
  try{for(const contour of compound.children){
    if(!contour.closed)return null;
    const b=contour.bounds,vertical=b.height>b.width,short=vertical?b.width:b.height,long=vertical?b.height:b.width,r=short/2;
    if(short<.1||short>8||long-short<.1)return null;
    const a=vertical?new paper.Point(b.center.x,b.top+r):new paper.Point(b.left+r,b.center.y),z=vertical?new paper.Point(b.center.x,b.bottom-r):new paper.Point(b.right-r,b.center.y),v=z.subtract(a);
    const tolerance=Math.max(.015,short*.01),area=(long-short)*short+Math.PI*r*r;
    if(Math.abs(Math.abs(contour.area)-area)>area*.015)return null;
    for(let i=0;i<128;i++){const p=contour.getPointAt(contour.length*i/128),t=Math.max(0,Math.min(1,p.subtract(a).dot(v)/v.dot(v)));if(Math.abs(p.getDistance(a.add(v.multiply(t)))-r)>tolerance)return null;}
    widths.push(short);lines.push({shape:'line',name:'Recovered bar',x1:a.x,y1:a.y,x2:z.x,y2:z.y,cap:'round'});
  }}finally{compound.remove();}
  if(!lines.length||widths.some(w=>Math.abs(w-widths[0])>.02))return null;
  return {node:{op:'union',name:'Recovered bar centerline',children:lines},stroke:Math.round(widths[0]*1e6)/1e6};
}

// Measure ink across inward boundary normals, stopping at the first opposing
// boundary. This estimates local thickness, not the overall bounding-box size.
export function estimateSourceWidth(source,core) {
  const resolved=core.resolve(source)[0];if(resolved?.error||!resolved?.d)return null;
  const ink=new paper.CompoundPath({pathData:resolved.d,insert:false}),widths=[];
  try {
    const contours=ink.children.filter(p=>p.closed&&p.length>1e-6);if(!contours.length||contours.length>64)return null;
    const reach=Math.hypot(ink.bounds.width,ink.bounds.height)*2,epsilon=Math.max(1e-5,reach*1e-6),samples=Math.max(8,Math.min(64,Math.floor(512/contours.length)));
    for(const contour of contours)for(let i=0;i<samples;i++) {
      const at=contour.length*(i+.5)/samples,point=contour.getPointAt(at),normal=contour.getNormalAt(at);if(!normal||normal.isZero())continue;
      for(const sign of [1,-1]) {
        const direction=normal.normalize().multiply(sign);if(!ink.contains(point.add(direction.multiply(epsilon))))continue;
        const ray=new paper.Path.Line({from:point,to:point.add(direction.multiply(reach)),insert:false});
        try{const distances=ray.getIntersections(ink).map(hit=>hit.point.subtract(point).dot(direction)).filter(d=>d>epsilon*2).sort((a,b)=>a-b),width=distances[0];
          if(Number.isFinite(width)&&ink.contains(point.add(direction.multiply(width/2))))widths.push(width);
        }finally{ray.remove();}
        break;
      }
    }
    if(widths.length<8)return null; widths.sort((a,b)=>a-b);
    const stroke=Math.round(widths[Math.floor(widths.length/2)]*1e6)/1e6;
    if(stroke<.1||stroke>8)return null;
    return {stroke,variable:widths[Math.floor(widths.length*.75)]-widths[Math.floor(widths.length*.25)]>stroke*.15};
  }finally{ink.remove();}
}

export function createShapeCenterline({root,core,getGlyph,apply,status}) {
  const dialog=document.createElement('dialog');dialog.className='import-dialog centerline-dialog';dialog.setAttribute('aria-labelledby','centerlineHeading');root.appendChild(dialog);
  let source,snapshot,layer,bar,measurement;
  const make=(tag,text,parent,attrs={})=>{const el=document.createElement(tag);el.textContent=text;for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.appendChild(el);return el;};
  make('h2','Create centerline',dialog,{id:'centerlineHeading'});
  make('p','Recover a rounded bar as a stroke, or review an inset contour for other shapes. Adds a new layer; source stays unchanged.',dialog,{id:'centerlineHelp'});dialog.setAttribute('aria-describedby','centerlineHelp');
  const drawings=make('div','',dialog,{class:'review-drawings'}),original=make('div','',drawings,{'aria-label':'Source shape',class:'review-drawing'}),preview=make('div','',drawings,{'aria-label':'Centerline candidate',class:'review-drawing'});
  const methodLabel=make('label','Method',dialog,{class:'studio-field'}),method=make('select','',methodLabel,{'aria-label':'Centerline method'});make('option','Recover rounded bar',method,{value:'bar'});make('option','Inset contour',method,{value:'inset'});method.onchange=()=>{inputs.inset.disabled=method.value==='bar';update();};
  const inputs={};for(const [key,label,min,max]of [['inset','Inset',0,null],['stroke','Stroke',.1,8]]){const row=make('label',label,dialog,{class:'studio-field'});inputs[key]=make('input','',row,{type:'number',min,step:'any','data-scrub-step':.01,'aria-label':`Centerline ${key}`});if(max!==null)inputs[key].max=max;inputs[key].onchange=update;}
  const note=make('p','',dialog,{role:'status'}),buttons=make('div','',dialog,{class:'row'}),cancel=make('button','Cancel',buttons,{type:'button',class:'btn'}),accept=make('button','Add centerline layer',buttons,{type:'button',class:'btn'});
  const settings=()=>({inset:inputs.inset.valueAsNumber,stroke:inputs.stroke.valueAsNumber});
  function update(){layer=null;accept.disabled=true;try{for(const input of Object.values(inputs))if(!input.checkValidity()||!Number.isFinite(input.valueAsNumber))throw Error('Enter a valid inset and stroke width.');layer=method.value==='bar'?{id:crypto.randomUUID(),name:`${source.name} centerline`,role:source.layers[0].role,color:source.layers[0].color,paint:'stroke',symmetry:false,rounding:0,endRounding:0,strokeWidth:settings().stroke,node:structuredClone(bar.node)}:centerlineLayer(source,core,settings(),crypto.randomUUID());preview.innerHTML=core.toSVG({...source,setStyle:{rounding:0,endRounding:0},symmetry:{rotate:1},layers:[layer]},{mode:'baked',size:192});note.textContent=(bar?`Detected source width ${bar.stroke}. `:measurement?`Estimated source width ${measurement.stroke}${measurement.variable?' (variable thickness)':''}; review the fit. `:'Source width could not be estimated; set stroke manually. ')+(method.value==='bar'?'Recovered rounded-bar axis.':'Boundary offset, not a medial-axis trace; narrow contours can collapse.')+' New layer is excluded from library line width.';accept.disabled=false;}catch(error){preview.replaceChildren();note.textContent=error.message;}}
  cancel.onclick=()=>dialog.close();
  accept.onclick=()=>{try{if(JSON.stringify(getGlyph())!==snapshot)throw Error('Artwork changed; reopen Create centerline.');if(!layer)throw Error('Recompute a valid candidate first.');apply(layer);dialog.close();status('Added an independent centerline layer. Source unchanged; hide the source layer to inspect it. Undo removes the candidate.');}catch(error){note.textContent=error.message;accept.disabled=true;}};
  return {open(selection){source=centerlineSource(getGlyph(),selection,core);if(!source)throw Error('Select a visible filled shape.');delete source.referenceImage;snapshot=JSON.stringify(getGlyph());const width=getGlyph().strokeOverride??getGlyph().setStyle?.thickness??getGlyph().weight??1.2;bar=recoverBar(source,core);measurement=bar?null:estimateSourceWidth(source,core);method.querySelector('[value=bar]').disabled=!bar;method.value=bar?'bar':'inset';inputs.inset.disabled=!!bar;const detected=bar?.stroke??measurement?.stroke??width;inputs.inset.value=detected/2;inputs.stroke.value=detected;original.innerHTML=core.toSVG(source,{mode:'baked',mono:true,size:192});update();dialog.showModal();},dispose(){dialog.remove();}};
}
