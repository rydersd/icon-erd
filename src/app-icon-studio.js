import {defaultGradient,validateGradient} from './app-icon-paint.js';

export function createAppIconStudio({root,getGlyph,getLayer,setLayer,commit,refresh,status}) {
  let rendered=null,renderedGlyph=null;
  const open={};
  const make=(tag,text,parent,attrs={})=>{const e=document.createElement(tag);if(text)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent?.appendChild(e);return e;};
  const save=()=>{commit();refresh();};
  const section=(title,key)=>{
    const d=make('details','',root,{class:'panel disclosure-panel'});try{d.open=open[key]??localStorage.getItem(`gw-studio-${key}`)!=='closed';}catch{d.open=true;}
    make('summary',title,d);d.addEventListener('toggle',()=>{open[key]=d.open;try{localStorage.setItem(`gw-studio-${key}`,d.open?'open':'closed');}catch{}});return make('div','',d,{class:'pad studio-fields'});
  };
  const button=(text,parent,fn)=>{const b=make('button',text,parent,{type:'button',class:'btn sm'});b.onclick=fn;return b;};
  const input=(label,value,parent,onChange,{type='number',min,max,step,disabled=false}={})=>{
    const row=make('label',label,parent,{class:'studio-field'}),e=make('input','',row,{type,'aria-label':label});e.value=value;e.disabled=disabled;
    if(min!=null)e.min=min;if(max!=null)e.max=max;if(step!=null)e.step=step;
    e.onchange=()=>{if(!e.checkValidity()){e.reportValidity();e.value=value;return;}onChange(type==='number'?e.valueAsNumber:type==='checkbox'?e.checked:e.value);};if(type==='checkbox')e.checked=value;return e;
  };
  const modifyGradient=fn=>{const layer=getGlyph().layers[getLayer()],candidate=structuredClone(layer.fillGradient);fn(candidate);candidate.stops.sort((a,b)=>a.offset-b.offset);try{layer.fillGradient=validateGradient(candidate);save();}catch(error){status(error.message,true);rendered=null;render();}};
  function render() {
    const glyph=getGlyph();root.hidden=glyph.kind!=='app-icon';if(root.hidden)return;
    const at=Math.min(getLayer(),glyph.layers.length-1),layer=glyph.layers[at];
    const key=JSON.stringify([glyph.name,at,layer?.fillGradient,layer?.fillColor,layer?.color,glyph.referenceImage,glyph.output?.colorMode]);if(rendered===key && renderedGlyph===glyph)return;rendered=key;renderedGlyph=glyph;root.replaceChildren();
    const fill=section('App icon · Fill','fill');
    const label=make('label','Layer',fill,{class:'studio-field'}),layers=make('select','',label,{'aria-label':'App icon paint layer'});
    glyph.layers.forEach((l,i)=>{const o=make('option',l.name||l.id,layers,{value:i});o.selected=i===at;});layers.onchange=()=>setLayer(Number(layers.value));
    if(layer){
      const row=make('label','Fill',fill,{class:'studio-field'}),type=make('select','',row,{'aria-label':'App icon fill type'});
      for(const [v,name] of [['solid','Solid'],['linear','Linear gradient'],['radial','Radial gradient']])make('option',name,type,{value:v});type.value=layer.fillGradient?.type||'solid';
      type.onchange=()=>{if(type.value==='solid')delete layer.fillGradient;else{layer.fillGradient=defaultGradient(type.value);if(layer.paint==='stroke')layer.paint='both';}save();};
      if(!layer.fillGradient)input('Fill color',layer.fillColor||layer.color||'#0267e0',fill,value=>{layer.fillColor=value;if(layer.paint==='stroke')layer.paint='both';save();},{type:'color'});
      else{
        make('p','Gradient coordinates are fractions of this layer’s bounds. Paint stays local to the layer; linked components share geometry.',fill,{class:'lbl'});
        if(glyph.output?.colorMode==='single' || glyph.output?.profile==='menu-bar')make('p','Single-color/template output overrides gradient appearance. Choose Multicolor in Library tokens to show the gradient.',fill,{class:'warn'});
        const g=layer.fillGradient;
        for(const k of g.type==='linear'?['x1','y1','x2','y2']:['cx','cy','r'])input(`Gradient ${k}`,g[k],fill,value=>modifyGradient(next=>next[k]=value),{min:0,max:1,step:0.01});
        g.stops.forEach((s,i)=>{
          const stop=make('fieldset','',fill,{class:'gradient-stop'});make('legend',`Stop ${i+1}`,stop);
          input(`Stop ${i+1} position`,s.offset,stop,value=>modifyGradient(next=>next.stops[i].offset=value),{min:0,max:1,step:0.01});
          input(`Stop ${i+1} color`,s.color,stop,value=>modifyGradient(next=>next.stops[i].color=value),{type:'color'});
          input(`Stop ${i+1} opacity`,s.opacity,stop,value=>modifyGradient(next=>next.stops[i].opacity=value),{min:0,max:1,step:0.01});
          if(g.stops.length>2)button('Remove stop',stop,()=>modifyGradient(next=>next.stops.splice(i,1)));
        });
        const add=button('Add gradient stop',fill,()=>modifyGradient(next=>{const a=next.stops.at(-2),b=next.stops.at(-1);next.stops.push({offset:(a.offset+b.offset)/2,color:a.color,opacity:(a.opacity+b.opacity)/2});}));add.disabled=g.stops.length>=16;
      }
    }
    const ref=section('Bitmap reference','reference');
    make('p','Trace over an embedded image. Reference images are excluded from export unless you enable inclusion.',ref,{class:'lbl'});
    const file=make('input','',ref,{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':'Import bitmap reference'});
    file.onchange=async()=>{
      const f=file.files[0],owner=getGlyph();if(!f)return;
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(f.type) || f.size>8*1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 8 MB.');
        const bitmap=await createImageBitmap(f),ratio=bitmap.width/bitmap.height;bitmap.close();
        const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image'));reader.readAsDataURL(f);});
        if(getGlyph()!==owner){status('Image import cancelled because the icon changed.');return;}
        const width=ratio>=1?24:24*ratio,height=ratio>=1?24/ratio:24;
        owner.referenceImage={name:f.name.slice(0,256),src,x:(24-width)/2,y:(24-height)/2,width,height,opacity:0.4,visible:true,locked:true,includeInExport:false};save();status('Bitmap reference imported behind the vectors; placement locked.');
      }catch(error){status(error.message,true);}finally{file.value='';}
    };
    const r=glyph.referenceImage;
    if(r){
      make('p',r.name,ref,{class:'lbl'});
      for(const [k,name] of [['visible','Show reference'],['locked','Lock reference placement'],['includeInExport','Include reference in export']])input(name,r[k],ref,v=>{r[k]=v;save();},{type:'checkbox'});
      input('Reference opacity',r.opacity,ref,v=>{r.opacity=v;save();},{min:0,max:1,step:0.05});
      for(const k of ['x','y','width','height'])input(`Reference ${k}`,r[k],ref,v=>{if(k==='width')r.height*=v/r.width;if(k==='height')r.width*=v/r.height;r[k]=v;save();},{min:['width','height'].includes(k)?0.001:-10000,max:10000,step:0.1,disabled:r.locked});
      const fit=button('Fit reference to canvas',ref,()=>{const ratio=r.width/r.height;r.width=ratio>=1?24:24*ratio;r.height=ratio>=1?24/ratio:24;r.x=(24-r.width)/2;r.y=(24-r.height)/2;save();});fit.disabled=r.locked;
      button('Remove reference',ref,()=>{delete glyph.referenceImage;save();});
    }
  }
  return {render};
}
