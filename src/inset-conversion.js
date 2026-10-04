import paper from 'paper';
import {offset} from 'paperjs-offset';
import {normalizeGlyph} from './library-io.js';
export function insetOutline(source,core,{inset=.6,stroke=1.2}={}) {
  if(!Number.isFinite(inset)||inset<0||!Number.isFinite(stroke)||stroke<.1||stroke>8)throw Error('Inset must be nonnegative; stroke must be 0.1–8 units.');
  const layers=[];
  for(const layer of core.resolve(source)){
    if(layer.error)throw Error(layer.error);if(!layer.visible||!layer.d)continue;
    if(layer.paint!=='fill')throw Error('This conversion needs filled source artwork.');
    const outline=new paper.CompoundPath({pathData:layer.d,insert:false});outline.reorient(true,true);const children=[];
    try{for(const contour of outline.children){
      if(!contour.closed||Math.abs(contour.area)<1e-7)continue;
      const path=contour.clone({insert:false}),hole=contour.area<0;path.clockwise=true;let result;
      try{result=inset?offset(path,hole?inset:-inset,{join:'round',insert:false}):path.clone({insert:false});
        if(!result||!Number.isFinite(result.area)||Math.abs(result.area)<1e-7)throw Error('An inset contour collapsed; reduce the inset.');
        for(const p of result.children||[result])children.push({shape:'pen',name:`${hole?'Counter':'Outline'} ${children.length+1}`,closed:true,pts:p.segments.map(s=>({x:s.point.x,y:s.point.y,...(s.handleIn.length?{in:[s.handleIn.x,s.handleIn.y]}:{}),...(s.handleOut.length?{out:[s.handleOut.x,s.handleOut.y]}:{})}))});
      }finally{path.remove();result?.remove();}
    }}finally{outline.remove();}
    if(children.length)layers.push({id:layer.id,name:layer.name||'Converted outline',role:layer.role,color:layer.color,opacity:layer.opacity,paint:'stroke',symmetry:false,node:{op:'compound',name:'Inset centerline contours',children}});
  }
  if(!layers.length)throw Error('No surviving outline contours.');
  const candidate=structuredClone(source);delete candidate.reconstruction;delete candidate.solidReview;delete candidate.referenceImage;
  return normalizeGlyph({...candidate,name:source.name.endsWith('-outline')?source.name:`${source.name}-outline`,layers,weight:stroke,strokeOverride:stroke,setStyle:{thickness:stroke,rounding:0,endRounding:0},symmetry:{rotate:1},provenance:'converted-stroke',insetConversion:{source:source.name,inset,stroke}});
}
export function compareMasks(a,b,size) {
  const topology=mask=>{const seen=new Uint8Array(mask.length);let parts=0,holes=0;
    for(let start=0;start<mask.length;start++){if(seen[start])continue;const ink=mask[start];let border=false;const queue=[start];seen[start]=1;
      for(let p=0;p<queue.length;p++){const i=queue[p],x=i%size,y=Math.floor(i/size);if(!x||!y||x===size-1||y===size-1)border=true;
        for(const j of [x?i-1:-1,x<size-1?i+1:-1,y?i-size:-1,y<size-1?i+size:-1])if(j>=0&&!seen[j]&&mask[j]===ink){seen[j]=1;queue.push(j);}}
      if(ink)parts++;else if(!border)holes++;}return {parts,holes};};
  let intersection=0,union=0;for(let i=0;i<a.length;i++){if(a[i]&&b[i])intersection++;if(a[i]||b[i])union++;}
  const left=topology(a),right=topology(b),iou=intersection/Math.max(1,union);
  return {iou,topology:left.parts===right.parts&&left.holes===right.holes,candidateTopology:left,referenceTopology:right};
}
export async function svgMask(svg,size=192) {
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not compare outline preview'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d');context.drawImage(image,0,0,size,size);const pixels=context.getImageData(0,0,size,size).data;
    return Uint8Array.from({length:size*size},(_,i)=>pixels[i*4+3]>127?1:0);
  }finally{URL.revokeObjectURL(url);}
}
