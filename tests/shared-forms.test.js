import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper/dist/paper-core.js';
import {createGlyphCore} from '../src/glyph-core.js';
import {findSharedForms,linkSharedForms,publishSharedForms,remapSharedForms,collectComponents,projectComponents} from '../src/shared-forms.js';
import {libraryDocument,parseLibraryArchive} from '../src/library-io.js';
new paper.Project();const core=createGlyphCore(paper);
const clone=v=>JSON.parse(JSON.stringify(v));
const glyph=(name,x=0,w=5)=>({name,grid:24,weight:1.2,layers:[{id:'main',paint:'stroke',node:{name:`${name} body`,shape:'rect',x,y:3,w,h:4}}]});
test('translated forms link; shape edits propagate while placement, transform and layer paint stay local',()=>{
 const a=glyph('a'),b=glyph('b',10),c=glyph('c',20,7);b.layers[0].paint='fill';b.layers[0].node.transform={rotate:45};
 const groups=findSharedForms([a,b,c],core);assert.equal(groups.length,1);assert.equal(groups[0].members.length,2);
 linkSharedForms(groups[0],'Body',core,'body');const before=clone(a);
 a.layers[0].node.w=8;const undo=publishSharedForms(a,before,[b,c],core);
 assert.equal(undo.length,1);assert.equal(b.layers[0].node.w,8);assert.equal(b.layers[0].node.x,10);assert.equal(b.layers[0].node.transform.rotate,45);assert.equal(b.layers[0].node.name,'b body');assert.equal(b.layers[0].paint,'fill');assert.equal(c.layers[0].node.w,7);
 delete b.layers[0].node.component;const prev=clone(a);a.layers[0].node.h=9;publishSharedForms(a,prev,[b],core);assert.equal(b.layers[0].node.h,4);
});
test('a shared group publishes edits to its children; linking never nests components',()=>{
 const a=glyph('a'),b=glyph('b');for(const g of [a,b])g.layers[0].node={op:'union',children:[g.layers[0].node,{shape:'circle',cx:10,cy:10,r:2}]};
 const group=findSharedForms([a,b],core).find(g=>g.members[0].node.children);linkSharedForms(group,'Assembly',core,'assembly');
 assert.equal(findSharedForms([a,b],core).length,0);const before=clone(a);a.layers[0].node.children[1].r=4;publishSharedForms(a,before,[b],core);assert.equal(b.layers[0].node.children[1].r,4);
});
test('near matches are explicit, unrelated forms are excluded, and interchange keeps IDs without cross-import collisions',()=>{
 const a=glyph('a'),b=glyph('b',10,5.02),c=glyph('c',20,5.2);
 const group=findSharedForms([a,b,c],core)[0];assert.equal(group.approximate,true);assert.equal(group.members.length,2);linkSharedForms(group,'Body',core,'body');assert.equal(b.layers[0].node.w,5.02);assert.equal(b.layers[0].node.h,4.016);
 const pack=parseLibraryArchive(JSON.stringify(libraryDocument([a,b],'all')));assert.equal(pack.glyphs[0].layers[0].node.component.id,'body');
 let seq=0;remapSharedForms(pack.glyphs,()=>`import-${++seq}`);assert.equal(seq,1);assert.equal(pack.glyphs[1].layers[0].node.component.id,'import-1');
});

test('malformed and nested links cannot enter an archive',()=>{
 const g=glyph('broken');g.layers[0].node.component={id:'body',name:'Body',origin:[NaN,0]};
 assert.throws(()=>parseLibraryArchive(JSON.stringify({glyphs:[g]})),/invalid shared/);
 const a=glyph('nested');const child=a.layers[0].node;child.component={id:'child',name:'Child',origin:[0,0]};a.layers[0].node={op:'union',component:{id:'parent',name:'Parent',origin:[0,0]},children:[child]};
 assert.throws(()=>parseLibraryArchive(JSON.stringify({glyphs:[a]})),/nested shared/);
});

test('uniformly scaled geometry shares edits bidirectionally at its own placement and size',()=>{
 const a=glyph('large'),b=glyph('small',10);b.layers[0].node.h=2;b.layers[0].node.w=2.5;
 const group=findSharedForms([a,b],core)[0];assert.equal(group.members.length,2);assert.equal(group.approximate,false);
 linkSharedForms(group,'Body',core,'body');const old=clone(a);a.layers[0].node.h=6;publishSharedForms(a,old,[b],core);
 assert.ok(Math.abs(b.layers[0].node.h-3)<1e-8);assert.equal(b.layers[0].node.w,2.5);assert.equal(b.layers[0].node.x,10);
 const prev=clone(b);b.layers[0].node.w=4;publishSharedForms(b,prev,[a],core);assert.equal(a.layers[0].node.w,8);
});

test('component definitions are independent vector objects and authoritative during archive projection',()=>{
 const a=glyph('master'),b=glyph('instance',10);const group=findSharedForms([a,b],core)[0];linkSharedForms(group,'Body',core,'body');
 const components=collectComponents([a,b],core);const document=libraryDocument([a,b],'all',undefined,components);assert.equal(document.components.length,1);assert.equal(document.components[0].node.component,undefined);
 document.glyphs[1].layers[0].node.w=999;const archive=parseLibraryArchive(JSON.stringify(document));projectComponents(archive.glyphs,archive.components,core);assert.equal(archive.glyphs[1].layers[0].node.w,5);assert.equal(archive.glyphs[1].layers[0].node.x,10);
 document.components=[];assert.throws(()=>parseLibraryArchive(JSON.stringify(document)),/Missing component/);
});
