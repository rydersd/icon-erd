import {formsIn,makeComponent} from './shared-forms.js';
const active=sym=>sym && sym!==false && (sym.mirror || sym.rotate>1);
const nodeAt=(glyph,s)=>s.p.reduce((node,i)=>node.children[i],glyph.layers[s.l].node);
export function componentTarget(glyph,selection,core) {
  if(!selection || !glyph.layers[selection.l])return null;
  const layer=glyph.layers[selection.l];let p=selection.p||[],captureSymmetry=false;
  if(layer.symmetry!==false && active(glyph.symmetry)){p=[];captureSymmetry=true;}
  else for(let i=0;i<p.length;i++){
    const ancestor=nodeAt(glyph,{l:selection.l,p:p.slice(0,i)});
    if(active(ancestor.symmetry)||core.hasTransform(ancestor.transform)){p=p.slice(0,i);break;}
  }
  const target={l:selection.l,p},node=nodeAt(glyph,target);
  const linkedAncestor=formsIn(glyph).some(f=>f.l===target.l && f.node.component && f.p.length<=p.length && f.p.every((v,i)=>p[i]===v));
  if(linkedAncestor || formsIn({layers:[{node}]}).some(f=>f.node.component))return null;
  return {selection:target,node,captureSymmetry,expanded:captureSymmetry||p.length!==(selection.p||[]).length};
}
export function createSelectedComponent(glyph,selection,name,core,id) {
  const target=componentTarget(glyph,selection,core);
  if(!target)throw Error('Detach existing component instances before creating a containing component.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>256)throw Error('Enter a component name.');
  const layer=glyph.layers[target.selection.l];let node=target.node;
  if(target.captureSymmetry){
    node={op:'union',name:name.trim(),symmetry:structuredClone(glyph.symmetry),symmetryStage:'layer',children:[node]};
    layer.node=node;layer.symmetry=false;
  }
  node.name=name.trim();makeComponent(node,name.trim(),core,id);
  return target.selection;
}
