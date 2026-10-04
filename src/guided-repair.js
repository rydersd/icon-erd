import {insetOutline,compareMasks,svgMask} from './inset-conversion.js';
import {strokeWeight} from './stroke-weight.js';
import {normalizeGlyph} from './library-io.js';
import {downloadBlob} from './downloads.js';
import {REPAIR_DRAFT_KEY,geometryIdentity,contentHashes} from './reconstruction-records.js';
const copy=value=>structuredClone(value);
export function createGuidedRepair({root,core,getGlyph,getLibrary,getStyle,enter,leave,replace,refresh,finishPen,publish,status}) {
  let draft=null,busy=false,revision=0,summary,acceptButton,differenceURL=null,lastGuideKey=null,insetCache=null,sourcePaths=[];
  const panel=document.createElement('section');panel.className='repair-toolbar';panel.hidden=true;panel.setAttribute('aria-label','Guided outline repair');root.querySelector('.canvas-wrap').prepend(panel);
  const guide=document.createElementNS('http://www.w3.org/2000/svg','g');guide.id='gRepairGuide';guide.setAttribute('pointer-events','none');root.querySelector('#gLayers').before(guide);
  const difference=document.createElementNS(guide.namespaceURI,'g');difference.id='gRepairDifference';difference.setAttribute('pointer-events','none');root.querySelector('#gLayers').after(difference);
  const make=(tag,text,parent,attrs={})=>{const e=document.createElement(tag);if(text)e.textContent=text;for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  function save(){
    if(!draft)return;
    try{localStorage.setItem(REPAIR_DRAFT_KEY,JSON.stringify({...draft,candidate:copy(getGlyph())}));return true;}catch(error){status(`Repair is in memory; draft could not be saved: ${error.message}`,true);return false;}
  }
  function check(){
    if(JSON.stringify(getLibrary().find(g=>g.name===draft.source.name))!==draft.sourceIdentity || (getLibrary().find(g=>g.name===draft.candidate.name)?JSON.stringify(getLibrary().find(g=>g.name===draft.candidate.name)):null)!==draft.targetIdentity)throw Error('Source or target changed. Keep this draft, reopen review, and compare before accepting.');
  }
  const svg=g=>core.toSVG(g,{mode:'baked',mono:true,size:192});
  async function measure(){
    if(!draft)return;const run=++revision,d=draft,candidate=copy(getGlyph());summary.textContent='Comparing repair…';
    try{
      const reference=d.reference||d.source;
      const [a,b]=await Promise.all([svgMask(svg(candidate)),svgMask(svg(reference))]);
      if(run!==revision||draft!==d)return;
      d.after=compareMasks(a,b,192);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(192,192);
      for(let i=0;i<a.length;i++){if(a[i]===b[i])continue;pixels.data.set(a[i]?[255,75,75,180]:[70,150,255,180],i*4);}ctx.putImageData(pixels,0,0);differenceURL=canvas.toDataURL();drawGuide();
      summary.textContent=`${Math.round(d.after.iou*1000)/10}% ${d.reference?'outline':'source silhouette'} match · ${d.after.topology?'matching':'different'} parts/holes. ${d.reference?'':'Fill-to-outline redesign can differ intentionally.'}`;
    }catch(error){if(run===revision&&draft===d)summary.textContent=error.message;}
  }
  function drawGuide(){
    const key=draft?JSON.stringify([draft.settings,draft.opacity,draft.showSource,draft.showInset,draft.showDifference,differenceURL]):null;
    if(key===lastGuideKey)return;lastGuideKey=key;guide.replaceChildren();difference.replaceChildren();if(!draft)return;
    if(draft.showDifference&&differenceURL){const img=document.createElementNS(guide.namespaceURI,'image');for(const [k,v]of Object.entries({href:differenceURL,x:0,y:0,width:24,height:24}))img.setAttribute(k,v);difference.append(img);}
    const append=(paths,{fill,stroke,opacity,dash,width})=>{for(const layer of paths){if(!layer.visible||!layer.d)continue;const p=document.createElementNS(guide.namespaceURI,'path');for(const [k,v]of Object.entries({d:layer.d,fill,stroke,opacity,'stroke-width':width,'stroke-dasharray':dash,'fill-rule':'nonzero'}))p.setAttribute(k,v);guide.append(p);}};
    if(draft.showSource)append(sourcePaths,{fill:'var(--accent)',stroke:'none',opacity:draft.opacity,dash:'',width:0});
    if(draft.showInset){try{if(insetCache?.inset!==draft.settings.inset)insetCache={inset:draft.settings.inset,paths:core.resolve(insetOutline(draft.source,core,draft.settings))};append(insetCache.paths,{fill:'none',stroke:'var(--accent)',opacity:.8,dash:'.2 .15',width:.045});}catch(error){status(`Inset guide: ${error.message}`,true);}}
  }
  function useWidth(){
    const width=draft.linked?getStyle()?.thickness??draft.settings.stroke:draft.settings.stroke;
    const glyph=getGlyph();glyph.strokeCap??='round';glyph.strokeJoin??='round';glyph.weight=width;glyph.strokeOverride=width;glyph.setStyle={...(glyph.setStyle||{}),thickness:width,rounding:0,endRounding:0};
    glyph.insetConversion={source:draft.source.name,inset:draft.settings.inset,stroke:width};draft.settings.stroke=width;
  }
  function render(){
    panel.replaceChildren();panel.hidden=false;
    make('strong',`Repair · ${draft.source.name}`,panel);make('span','Pen adds paths; Direct Select fixes anchors. Original is locked.',panel,{class:'lbl'});
    const controls=make('div','',panel,{class:'row'});
    const number=(name,value,min,max,change)=>{const l=make('label',name,controls,{class:'studio-field'}),i=make('input','',l,{type:'number',step:.01,min,'aria-label':`Repair ${name.toLowerCase()}`});if(max!=null)i.max=max;i.value=value;i.onchange=()=>{if(!i.checkValidity()||!Number.isFinite(i.valueAsNumber)){i.value=value;return;}change(i.valueAsNumber);recordCommit();save();refresh();measure();};return i;};
    number('Inset',draft.settings.inset,0,null,v=>draft.settings.inset=v);
    const weight=number('Stroke',draft.settings.stroke,.1,8,v=>{draft.settings.stroke=v;useWidth();});weight.disabled=draft.linked;
    const toggle=(text,key,changed=()=>{})=>{const l=make('label','',controls),i=make('input','',l,{type:'checkbox'});i.checked=draft[key];make('span',text,l);i.onchange=()=>{draft[key]=i.checked;changed();save();refresh();};return i;};
    toggle('Use library stroke','linked',()=>{useWidth();weight.value=draft.settings.stroke;weight.disabled=draft.linked;recordCommit();measure();});
    toggle('Difference: red excess / blue missing','showDifference');
    toggle('Source guide','showSource');toggle('Inset guide','showInset');number('Guide opacity',draft.opacity,0,1,v=>draft.opacity=v);
    const intentLabel=make('label','Intent',controls),intent=make('select','',intentLabel,{'aria-label':'Repair intent'});for(const [v,t]of [['faithful','Recover original'],['redesign','New outline design']])make('option',t,intent,{value:v});intent.value=draft.intent;intent.onchange=()=>{draft.intent=intent.value;save();};
    const button=(text,fn)=>{const b=make('button',text,controls,{class:'btn sm',type:'button'});b.onclick=fn;return b;};
    button('Download repair draft',()=>downloadBlob('iconerd-repair-draft.json',new Blob([JSON.stringify({...draft,candidate:copy(getGlyph())},null,2)],{type:'application/json'})));
    button('Save draft & return',()=>exit(false));button('Discard repair',()=>exit(true));
    acceptButton=button('Accept correction',async()=>{
      if(busy)return;busy=true;for(const e of panel.querySelectorAll('button,input,select'))e.disabled=true;root.querySelector('#canvas').inert=true;root.querySelector('#pane-right').inert=true;
      try{
        finishPen();useWidth();recordCommit();check();
        const d=draft,accepted=normalizeGlyph(getGlyph());
        if(!core.resolve(accepted).some(l=>l.visible&&l.d))throw Error('Draw at least one path before accepting.');accepted.name=d.initial.name;
        accepted.insetConversion={...accepted.insetConversion,strokeBinding:d.linked?'library':'override'};
        if(d.linked)delete accepted.strokeOverride;
        const editingIdentity=JSON.stringify(getGlyph()),settingsIdentity=JSON.stringify(d.settings);
        const reference=d.reference||d.source;const [a,b,initialMask]=await Promise.all([svgMask(svg(accepted)),svgMask(svg(reference)),svgMask(svg(d.initial))]);check();if(JSON.stringify(getGlyph())!==editingIdentity||JSON.stringify(d.settings)!==settingsIdentity)throw Error('Draft changed during acceptance; review and accept again.');
        const record={id:`correction-${crypto.randomUUID()}`,schemaVersion:1,status:'accepted',kind:'guided-repair',acceptedAt:new Date().toISOString(),generator:'boundary-inset-v1',build:process.env.NEXT_PUBLIC_ICONERD_VERSION||'dev',source:copy(d.source),initial:copy(d.initial),accepted,acceptedIdentity:geometryIdentity(accepted),group:d.source.group||'Ungrouped',settings:{...copy(d.settings),cap:accepted.strokeCap,join:accepted.strokeJoin},strokeBinding:d.linked?'library':'override',intent:d.intent,before:compareMasks(initialMask,b,192),comparison:d.reference?'paired-outline':'source-silhouette',generationScore:d.generationScore||null,editsTruncated:!!d.editsTruncated,after:compareMasks(a,b,192),edits:copy(d.edits)};
        record.hashes=await contentHashes({...record,reference:d.reference});
        check();if(JSON.stringify(getGlyph())!==editingIdentity)throw Error('Draft changed during acceptance; review and accept again.');
        // Controller publishes geometry and this example in the same IDB transaction.
        await publish(accepted,d.source,record);
        draft=null;revision++;panel.hidden=true;guide.replaceChildren();difference.replaceChildren();let cleanupFailed=false;try{localStorage.removeItem(REPAIR_DRAFT_KEY);}catch{cleanupFailed=true;}leave(accepted.name);status(cleanupFailed?'Correction accepted and saved locally; saved draft cleanup failed.':'Correction accepted and saved locally. Export examples from outline review.');
      }catch(error){revision++;status(error.message,true);summary.textContent=error.message;}finally{busy=false;root.querySelector('#canvas').inert=false;root.querySelector('#pane-right').inert=false;for(const e of panel.querySelectorAll('button,input,select'))e.disabled=false;if(draft)panel.querySelector('[aria-label="Repair stroke"]').disabled=draft.linked;}
    });
    summary=make('p','',panel,{role:'status'});measure();
  }
  function begin(entry){
    if(draft||busy)return;
    let saved=entry?.schemaVersion===1?copy(entry):null;
    if(saved){draft=saved;try{check();}catch(error){draft=null;throw error;}}
    else{
      if(localStorage.getItem(REPAIR_DRAFT_KEY))throw Error('A saved repair draft already exists. Resume or discard it before starting another.');
      const width=getStyle()?.thickness??entry.settings.stroke??1.2,settings={inset:entry.settings.inset,stroke:width};
      let initial=entry.candidate?copy(entry.candidate):{...copy(entry.source),name:entry.source.name.endsWith('-outline')?entry.source.name:`${entry.source.name}-outline`,layers:[{id:'repair',name:'Redrawn outline',paint:'stroke',node:{op:'union',children:[]}}],symmetry:{rotate:1}};
      delete initial.referenceImage;delete initial.reconstruction;delete initial.solidReview;initial.provenance='converted-stroke';
      draft={schemaVersion:1,source:copy(entry.source),sourceIdentity:JSON.stringify(entry.source),targetIdentity:entry.targetIdentity??null,reference:entry.reference?copy(entry.reference):null,initial:copy(initial),candidate:initial,settings,linked:true,opacity:.2,showSource:true,showInset:true,showDifference:false,intent:entry.intent==='redesign'?'redesign':'faithful',generationScore:entry.score||null,edits:[],undo:[],redo:[]};
      try{check();}catch(error){draft=null;throw error;}
    }
    differenceURL=null;lastGuideKey=null;insetCache=null;sourcePaths=core.resolve(draft.source);enter(copy(draft.candidate));useWidth();draft.candidate=copy(getGlyph());if(!saved)draft.initial=copy(draft.candidate);render();save();refresh();
  }
  function exit(discard){if(!draft||busy)return;finishPen();if(!discard&&!save())return;if(discard)localStorage.removeItem(REPAIR_DRAFT_KEY);draft=null;revision++;panel.hidden=true;guide.replaceChildren();difference.replaceChildren();leave();status(discard?'Repair discarded; library unchanged.':'Repair draft saved locally; resume from outline review.');}
  function recordCommit(){
    if(!draft)return false;
    if(draft.linked)useWidth();
    getGlyph().name=draft.initial.name;const next=copy(getGlyph()),before=draft.candidate;
    if(JSON.stringify(next)!==JSON.stringify(before)){draft.undo.push(copy(before));draft.undo=draft.undo.slice(-100);draft.redo=[];draft.edits.push({action:'edit',at:new Date().toISOString(),before:copy(before),after:next});if(draft.edits.length>100)draft.editsTruncated=true;draft.edits=draft.edits.slice(-100);draft.candidate=next;save();measure();}
    return true;
  }
  function history(redo){if(!draft||busy)return;const from=redo?draft.redo:draft.undo,to=redo?draft.undo:draft.redo;finishPen();if(!from.length)return;const before=copy(getGlyph());to.push(before);draft.candidate=from.pop();draft.settings.stroke=strokeWeight(draft.candidate);draft.edits.push({action:redo?'redo':'undo',at:new Date().toISOString(),before,after:copy(draft.candidate)});if(draft.edits.length>100)draft.editsTruncated=true;draft.edits=draft.edits.slice(-100);replace(copy(draft.candidate));panel.querySelector('[aria-label="Repair stroke"]').value=draft.settings.stroke;save();refresh();measure();}
  return {get active(){return !!draft;},get busy(){return busy;},get canUndo(){return !!draft?.undo.length;},get canRedo(){return !!draft?.redo.length;},begin,exit,recordCommit,history,drawGuide,resume(){const saved=JSON.parse(localStorage.getItem(REPAIR_DRAFT_KEY)||'null');if(saved)begin(saved);},discardSaved(){if(!draft)localStorage.removeItem(REPAIR_DRAFT_KEY);},hasDraft(){return !!localStorage.getItem(REPAIR_DRAFT_KEY);},dispose(){save();revision++;}};
}
