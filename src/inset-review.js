import {insetOutline,compareMasks,svgMask} from './inset-conversion.js';
import {generateSolid,sourceSignature} from './solid-variants.js';
import {iconGroup} from './icon-organization.js';
export function createInsetReview({root,core,getLibrary,getSelection,activate,close,apply,download,status}) {
  let generation=0,entries=[];
  const make=(tag,text,parent,attrs={})=>{const el=document.createElement(tag);if(text)el.textContent=text;for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);parent?.appendChild(el);return el;};
  const svg=g=>core.toSVG(g,{mode:'baked',mono:true,size:160});
  const key=signature=>{let hash=2166136261;for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619);return `gw-inset-review-${hash>>>0}`;};
  let onlyProblems,summary;
  function filter(){let problems=0;for(const e of entries){if(!e.applied&&(!e.score||e.score.manual||e.score.iou<.97||!e.score.topology))problems++;e.card.hidden=onlyProblems.checked&&(e.applied || (!!e.score&&!e.score.manual&&e.score.iou>=.97&&e.score.topology&&!e.dirty));}
    for(const group of root.querySelectorAll('.inset-review-group'))group.hidden=![...group.querySelectorAll('.inset-review-card')].some(c=>!c.hidden);
    summary.textContent=`${entries.filter(e=>e.finished).length} / ${entries.length} tested · ${problems} need review · ${entries.filter(e=>e.applied).length} applied. Matching the old outline is a fidelity check, not a design verdict.`;
  }
  async function update(e,run){
    const revision=++e.revision;e.score=null;e.candidate=null;e.apply.disabled=true;e.export.disabled=true;e.note.textContent='Comparing…';
    try{
      if(JSON.stringify(getLibrary().find(g=>g.name===e.source.name))!==JSON.stringify(e.source))throw Error('Source changed; reopen the conversion review.');
      const candidate=insetOutline(e.source,core,e.settings);e.preview.innerHTML=svg(candidate);
      const reference=getLibrary().find(g=>g.name===candidate.name);
      // A filled-outline source is its own fidelity reference. Broad solids use
      // their paired outline, or a filled round-trip when no outline exists.
      const compare=reference || generateSolid(candidate,core,{edge:'outside',holes:'preserve'});
      const left=reference?candidate:compare,right=reference||e.source;
      const [a,b]=await Promise.all([svgMask(svg(left)),svgMask(svg(right))]);
      if(run!==generation||revision!==e.revision)return;
      e.candidate=candidate;e.targetSignature=reference?JSON.stringify(reference):null;e.score={...compareMasks(a,b,192),manual:!reference};
      e.note.textContent=`${Math.round(e.score.iou*1000)/10}% ${reference?'outline match':'filled round-trip match'} · ${e.score.topology?'matching':'different'} parts/holes${!reference?' · Needs manual review: no paired outline':e.score.iou<.97||!e.score.topology?' · Needs review':''}`;
      e.apply.disabled=false;e.export.disabled=false;
      try{localStorage.setItem(key(e.signature),JSON.stringify({signature:e.signature,...e.settings}));}catch{}
    }catch(error){if(run!==generation||revision!==e.revision)return;e.preview.replaceChildren();e.note.textContent=`Needs review: ${error.message}`;}
    e.finished=true;filter();
  }
  async function open(){
    const run=++generation,selected=getSelection();entries=[];activate();root.replaceChildren();root.setAttribute('aria-label','Inset outline conversion review');
    const header=make('div','',root,{class:'row'});make('h2','Inset outline review',header);
    const done=make('button','Back to canvas',header,{class:'btn sm',type:'button'});done.onclick=()=>{generation++;close();};
    const label=make('label','',root,{class:'row'});onlyProblems=make('input','',label,{type:'checkbox'});onlyProblems.checked=true;make('span','Problems only',label);onlyProblems.onchange=filter;
    summary=make('p','Preparing candidates…',root,{role:'status'});make('p','Left: source fill. Right: candidate outline. Inset and stroke are drawing units; adjust each independently. No source changes until Apply. Low overlap, changed holes/parts and collapsed contours are isolated here.',root,{class:'lbl'});
    const groups=new Map();
    const sources=getLibrary().filter(g=>(!selected.size||selected.has(g.name))&&g.kind!=='app-icon'&&g.layers.some(l=>l.visible!==false&&l.paint==='fill')&&g.layers.filter(l=>l.visible!==false).every(l=>l.paint==='fill'));
    for(const source of sources){const name=iconGroup(source);if(!groups.has(name)){const group=make('section','',root,{class:'inset-review-group'});make('h3',name,group);groups.set(name,make('div','',group,{class:'group-review-grid'}));}
      const card=make('article','',groups.get(name),{class:'group-review-card inset-review-card','data-source':source.name});make('h3',source.name,card);
      const drawings=make('div','',card,{class:'review-drawings'});const original=make('div','',drawings,{class:'review-drawing','aria-label':'Source fill'});original.innerHTML=svg(source);const preview=make('div','',drawings,{class:'review-drawing','aria-label':'Outline candidate'});
      const signature=sourceSignature(source,core);let settings={inset:.6,stroke:1.2};try{const saved=JSON.parse(localStorage.getItem(key(signature))||'null');if(saved?.signature===signature)settings={inset:saved.inset,stroke:saved.stroke};}catch{}
      const e={source:structuredClone(source),signature,settings,card,preview,revision:0,applied:false};entries.push(e);
      for(const [field,min,max]of [['inset',0,null],['stroke',.1,8]]){const row=make('label',field==='inset'?'Inset':'Stroke',card,{class:'studio-field'}),input=make('input','',row,{type:'number',step:.01,min,'aria-label':`${source.name} ${field}`});if(max!=null)input.max=max;input.value=settings[field];input.onchange=()=>{if(!input.checkValidity()||!Number.isFinite(input.valueAsNumber)){input.value=e.settings[field];return;}e.settings[field]=input.valueAsNumber;e.applied=false;e.dirty=true;update(e,run);};}
      e.note=make('p','Waiting…',card,{role:'status'});e.apply=make('button','Apply outline',card,{type:'button',class:'btn sm',disabled:''});e.export=make('button','Download outline ZIP',card,{type:'button',class:'btn sm',disabled:''});
      e.export.onclick=()=>download(e.candidate,e.source);
      e.apply.onclick=async()=>{e.apply.disabled=true;try{const current=getLibrary().find(g=>g.name===e.source.name),target=getLibrary().find(g=>g.name===e.candidate.name);if(!current||JSON.stringify(current)!==JSON.stringify(e.source) || (target?JSON.stringify(target):null)!==e.targetSignature)throw Error('Source or target changed; recompute before applying.');await apply(e.candidate,e.source);if(run!==generation)return;activate();e.applied=true;e.dirty=false;e.note.textContent='Applied. Undo restores the previous outline; original fill remains in Revert/checkpoints.';filter();}catch(error){status(error.message,true);e.note.textContent=error.message;}finally{e.apply.disabled=e.applied;}};
    }
    if(!entries.length){summary.textContent='No filled interface icons in this selection. Clear library selection to review the whole set.';return;}
    for(const e of entries){if(run!==generation)return;if(!e.applied)await update(e,run);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return {open,cancel:()=>{generation++;}};
}
