import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';
import {componentTarget,createSelectedComponent} from '../src/component-creation.js';
import {collectComponents,projectComponents,publishSharedForms} from '../src/shared-forms.js';
new paper.Project();const core=createGlyphCore(paper);
const bell=()=>({name:'bell',symmetry:{mirror:'x',rotate:1,axis:{x:12,y:12,angle:0}},layers:[{id:'body',name:'Bell',paint:'stroke',node:{shape:'pen',name:'Half bell',pts:[{x:12,y:4},{x:8,y:7},{x:7,y:17},{x:12,y:17}],closed:false}},{id:'other',paint:'stroke',node:{shape:'circle',cx:11,cy:20,r:1}}]});
test('creating a half-bell component captures global symmetry once and leaves unrelated layers unchanged',()=>{
  const g=bell(),before=core.resolve(g).map(l=>l.d),other=structuredClone(g.layers[1]);
  const selection=createSelectedComponent(g,{l:0,p:[]},'Bell',core,'bell-component');
  assert.deepEqual(selection,{l:0,p:[]});assert.equal(g.layers[0].symmetry,false);assert.deepEqual(g.layers[0].node.symmetry,g.symmetry);assert.deepEqual(g.layers[1],other);assert.deepEqual(core.resolve(g).map(l=>l.d),before);
  const components=collectComponents([g],core),copy=structuredClone(g);projectComponents([copy],components,core);assert.deepEqual(core.resolve(copy).map(l=>l.d),before);
  const instance={name:'silence-alarms',symmetry:{mirror:'xy',rotate:2},layers:[{...structuredClone(g.layers[0]),symmetry:false}]};assert.equal(core.resolve(instance)[0].d,before[0]);
  const old=structuredClone(g);g.layers[0].node.symmetry.axis.x=13;publishSharedForms(g,old,[instance],core);assert.equal(instance.layers[0].node.symmetry.axis.x,13);
});
test('a selected path inside a symmetric group promotes the complete group and rejects nested components',()=>{
  const g=bell();g.symmetry={rotate:1};g.layers[0].node={name:'Bell assembly',op:'union',symmetry:{mirror:'x'},children:[g.layers[0].node,{shape:'circle',cx:10,cy:19,r:1}]};
  assert.deepEqual(componentTarget(g,{l:0,p:[0]},core).selection,{l:0,p:[]});createSelectedComponent(g,{l:0,p:[0]},'Bell',core,'bell');assert.equal(g.layers[0].node.children.length,2);assert.equal(componentTarget(g,{l:0,p:[0]},core),null);
});
test('promoting closed rounded half-forms preserves the original rounding/symmetry order, including draw-half and existing transforms',()=>{
  for(const paint of ['fill','stroke'])for(const half of [true,false]){
    const g={name:'rounded',setStyle:{rounding:.8},symmetry:{mirror:'x',half},layers:[{paint,node:{shape:'rect',x:7,y:5,w:5,h:10,transform:{rotate:5,origin:[12,12]}}}]};
    const before=core.resolve(g)[0].d;createSelectedComponent(g,{l:0,p:[]},'Rounded',core,'rounded');assert.equal(core.resolve(g)[0].d,before);
    const components=collectComponents([g],core),copy=structuredClone(g);projectComponents([copy],components,core);assert.equal(core.resolve(copy)[0].d,before);
  }
});
