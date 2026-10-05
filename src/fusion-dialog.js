import {fusionTarget} from './proximity-fusion.js';
import {generateSolid} from './solid-variants.js';

export function createFusionDialog({root,core,getGlyph,apply,status}) {
  const dialog=document.createElement('dialog');dialog.className='import-dialog fusion-dialog';dialog.setAttribute('aria-labelledby','fusionHeading');root.appendChild(dialog);
  const make=(tag,text,parent,attrs={})=>{const el=document.createElement(tag);el.textContent=text;for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);parent.appendChild(el);return el;};
  make('h2','Fuse nearby strokes',dialog,{id:'fusionHeading'});
  make('p','Join nearby stroke areas within this group using a shared distance recipe. Source paths remain editable. Existing holes are protected by default.',dialog,{id:'fusionHelp'});dialog.setAttribute('aria-describedby','fusionHelp');
  const enabledLabel=make('label','Enabled ',dialog,{class:'studio-field'}),enabled=make('input','',enabledLabel,{type:'checkbox','aria-label':'Enable proximity fusion'});
  const distanceLabel=make('label','Merge distance ',dialog,{class:'studio-field'}),distance=make('input','',distanceLabel,{type:'number',min:0,step:'any','data-scrub-step':.01,'aria-label':'Fusion merge distance'});
  const countersLabel=make('label','Preserve existing holes ',dialog,{class:'studio-field'}),counters=make('input','',countersLabel,{type:'checkbox','aria-label':'Preserve existing holes'});
  make('p','Distance is in drawing units. Gap closing is approximate; review both previews. Zero joins existing overlaps only. Fusion stays inside this group; outline and solid each apply the recipe to their own areas.',dialog);
  const drawings=make('div','',dialog,{class:'review-drawings'}),outline=make('div','',drawings,{class:'review-drawing','aria-label':'Fused outline preview'}),solid=make('div','',drawings,{class:'review-drawing','aria-label':'Derived solid preview'});
  const note=make('p','',dialog,{role:'status'}),buttons=make('div','',dialog,{class:'row'}),cancel=make('button','Cancel',buttons,{type:'button',class:'btn'}),save=make('button','Save fusion',buttons,{type:'button',class:'btn'});
  let selection,snapshot,recipe;
  function update(){recipe=null;save.disabled=true;try{
    if(!distance.checkValidity()||!Number.isFinite(distance.valueAsNumber))throw Error('Enter a nonnegative merge distance.');
    const candidate=structuredClone(getGlyph()),target=fusionTarget(candidate,selection);if(!target)throw Error('Select a stroke union group.');
    const value={enabled:enabled.checked,distance:distance.valueAsNumber,preserveCounters:counters.checked};target.node.fusion=value;
    const layers=core.resolve(candidate);const failure=layers.find(layer=>layer.error);if(failure)throw Error(failure.error);
    outline.innerHTML='<span>Outline</span>'+core.toSVG(candidate,{mode:'baked',size:192});
    try{solid.innerHTML='<span>Solid · outside edge</span>'+core.toSVG(generateSolid(candidate,core),{mode:'baked',size:192});}catch(error){solid.textContent=`Solid needs review: ${error.message}`;}
    const result=layers[selection.l].parts.find(part=>part.fusion&&JSON.stringify(part.fusion.path)===JSON.stringify(selection.p||[]));
    note.textContent=result?`${result.fusion.parts} area(s); holes ${result.fusion.beforeCounters} → ${result.fusion.afterCounters}. Width changes regenerate the geometry. SVG fusion is baked; CSS stroke-width cannot reshape it.`:'Fusion disabled; source strokes are shown.';
    recipe=value;save.disabled=false;
  }catch(error){outline.replaceChildren();solid.replaceChildren();note.textContent=error.message;}}
  for(const input of [enabled,distance,counters])input.onchange=update;
  cancel.onclick=()=>dialog.close();save.onclick=()=>{try{if(JSON.stringify(getGlyph())!==snapshot)throw Error('Artwork changed; reopen fusion settings.');if(!recipe)throw Error('Review a valid recipe first.');apply(selection,recipe);dialog.close();status(recipe.enabled?'Saved group fusion. Original paths remain editable.':'Disabled group fusion.');}catch(error){note.textContent=error.message;save.disabled=true;}};
  return {open(sel){const target=fusionTarget(getGlyph(),sel);if(!target)throw Error('Select a visible stroke union group.');selection=structuredClone(sel);snapshot=JSON.stringify(getGlyph());enabled.checked=target.node.fusion?.enabled??true;distance.value=target.node.fusion?.distance??.6;counters.checked=target.node.fusion?.preserveCounters??true;update();dialog.showModal();},dispose(){dialog.remove();}};
}
