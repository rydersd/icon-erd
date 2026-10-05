import {test,expect} from '@playwright/test';
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const screen=async(page,x,y)=>page.evaluate(({x,y})=>{const c=document.querySelector('#canvas'),p=c.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(c.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
const fixture=async page=>page.evaluate(async()=>{
 const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'merge-fixture',weight:1.2,layers:[{id:'line',paint:'stroke',node:{name:'Bent line',shape:'pen',pts:[{x:1,y:1},{x:4,y:4,in:[-2,0],out:[0.01,0.02]},{x:6,y:6,in:[-0.01,-0.02],out:[0,-3]},{x:12,y:12}]}}]}),'merge.json');w.S.sel=[{l:0,p:[]}];w.setTool('direct');w.S.selectedAnchors=[{selection:{l:0,p:[]},index:1}];w.S.anchor=1;w.refresh(true);
});
test('handle hover follows the real hit zone, clears on leave, and optional merge retains broken handles and Undo across icon switches/reload',async({page})=>{
 await ready(page);await expect(page).toHaveTitle('ICONERD');await fixture(page);await page.locator('[data-snap="0"]').click();
 const start=await screen(page,4,4),target=await screen(page,6.1,6.05);
 await page.mouse.move(start.x+5,start.y);await expect(page.locator('#canvas')).toHaveAttribute('data-handle-hover','pt');await expect(page.locator('#gHandleHover circle')).toHaveCount(2);
 await page.mouse.move(10,10);await expect(page.locator('#gHandleHover circle')).toHaveCount(0);
 await page.locator('#proximityMergeBtn').click();await expect(page.locator('#proximityMergeBtn')).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y);await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(2);await expect(page.locator('#gMergePreview [data-merge-result]')).toHaveCount(1);await page.mouse.up();await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(0);
 const merged=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);expect(merged).toHaveLength(3);expect(merged[1].in).toEqual([-2,0]);expect(merged[1].out).toEqual([0,-3]);expect(merged[1].x).toBeCloseTo(6.05,3);expect(merged[1].y).toBeCloseTo(6.025,3);
 await expect(page.locator('#gSel [data-anchor="1"]')).toHaveAttribute('data-point-kind','diamond');
 await page.evaluate(()=>window.__gw.loadGlyph(0));await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.name)).toBe('merge-fixture');expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(4);
 await page.evaluate(()=>window.__gw.flushSaves());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('#proximityMergeBtn')).toHaveAttribute('aria-pressed','true');await page.locator('#redoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(3);
 await page.locator('#proximityMergeBtn').click();await page.locator('#undoBtn').click();await page.evaluate(()=>{const w=window.__gw;w.S.sel=[{l:0,p:[]}];w.S.selectedAnchors=[{selection:{l:0,p:[]},index:1}];w.S.anchor=1;w.setTool('direct');w.refresh(true);});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y);await page.mouse.up();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(4);
});
test('duplicate creates a separately stored component and edits update every instance in place, surviving reload and ZIP JSON interchange',async({page})=>{
 await ready(page);await fixture(page);await page.locator('[data-tool="select"]').click();await page.locator('#dupBtn').click();
 const ids=await page.evaluate(()=>window.__gw.S.glyph.layers.map(l=>l.node.component.id));expect(ids[0]).toBe(ids[1]);
 expect(await page.evaluate(()=>window.__gw.S.components.size)).toBe(1);
 await page.locator('#canvas').focus();await page.keyboard.press('ArrowRight');
 const placement=await page.evaluate(()=>window.__gw.S.glyph.layers[1].node.component.origin);
 await page.evaluate(()=>{const w=window.__gw;w.S.glyph.layers[0].node.pts[1].y+=1;w.commit();w.refresh(true);});
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[1].node.pts[1].y)).toBe(5);expect(await page.evaluate(()=>window.__gw.S.glyph.layers[1].node.component.origin)).toEqual(placement);
 await page.evaluate(()=>window.__gw.flushSaves());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#expJson').click();const doc=JSON.parse(await page.locator('#ioText').inputValue());expect(doc.components).toHaveLength(1);expect(doc.components[0].node.component).toBeUndefined();
 await page.evaluate(()=>window.__gw.loadGlyph(0));await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].y)).toBe(4);expect(await page.evaluate(()=>window.__gw.S.glyph.layers[1].node.pts[1].y)).toBe(4);
});
test('named library checkpoints restore complete libraries and retain the pre-restore set as a safety version',async({page})=>{
 await ready(page);await fixture(page);await page.locator('[data-tool="select"]').click();await page.locator('#dupBtn').click();
 await page.locator('#libraryVersionsBtn').click();await page.locator('#versionName').fill('Linked baseline');await page.locator('#saveLibraryVersionBtn').click();await expect(page.locator('#libraryVersionsList')).toContainText('Linked baseline');await page.locator('#closeLibraryVersionsBtn').click();
 await page.evaluate(async()=>{const w=window.__gw;w.S.glyph.layers[0].node.pts[1].y=9;w.S.glyph.tags=['damaged'];w.commit();w.refresh(true);await w.flushSaves();});
 await page.locator('#libraryVersionsBtn').click();await page.locator('.version-row').filter({hasText:'Linked baseline'}).getByRole('button',{name:'Restore',exact:true}).click();await expect(page.locator('#libraryVersionsList')).toContainText('Before restoring Linked baseline');await page.locator('#closeLibraryVersionsBtn').click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].y)).toBe(4);expect(await page.evaluate(()=>window.__gw.S.glyph.tags)).toBeUndefined();expect(await page.evaluate(()=>window.__gw.S.components.size)).toBe(1);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].y)).toBe(4);
});
test('proximity merge also applies during Pen drawing while ordinary drawing remains unchanged when off',async({page})=>{
 await ready(page);await page.evaluate(async()=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'draw-test',layers:[{id:'empty-area',node:{shape:'circle',cx:22,cy:22,r:0.1}}]}),'draw.json');w.S.sel=[];w.setTool('pen');});
 await page.locator('#proximityMergeBtn').click();await page.locator('[data-snap="0"]').click();
 for(const xy of [[3,3],[5,3],[5.1,3]]){const p=await screen(page,...xy);await page.mouse.click(p.x,p.y);}
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers.flatMap(l=>l.node.shape==='pen'?[l.node]:l.node.children || []).find(n=>n.shape==='pen').pts.length)).toBe(2);
 await page.locator('#canvas').press('Enter');await page.locator('#undoBtn').click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers.flatMap(l=>l.node.shape==='pen'?[l.node]:l.node.children || []).find(n=>n.shape==='pen').pts[1].x)).toBe(5);
});
test('matching and linking scaled forms keeps their local scale when either instance edits the component',async({page})=>{
 await ready(page);await page.evaluate(async()=>{const make=(name,x,size)=>({name,layers:[{id:'body',node:{shape:'rect',x,y:3,w:size,h:size*0.8}}]});const w=window.__gw;await w.importLibraryText(JSON.stringify({glyphs:[make('scale-large',1,5),make('scale-small',12,2.5)]}),'scaled.json');w.loadGlyph(w.idx('scale-large'));});
 await page.locator('#findSharedFormsBtn').click();await page.locator('#sharedFormsSearch').fill('scale-large');await page.getByRole('button',{name:'Link repeated form',exact:true}).click();
 await page.evaluate(()=>{const w=window.__gw;w.S.glyph.layers[0].node.h=6;w.commit();w.refresh(true);});expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='scale-small').layers[0].node.h)).toBeCloseTo(3,6);
 await page.evaluate(()=>{const w=window.__gw;w.loadGlyph(w.idx('scale-small'));w.S.glyph.layers[0].node.w=4;w.commit();w.refresh(true);});expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='scale-large').layers[0].node.w)).toBeCloseTo(8,6);
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.x)).toBe(12);await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='scale-large').layers[0].node.w)).toBe(5);
});
test('canvas right-click converts both selected eyes to regular four-anchor shapes in one undoable edit',async({page})=>{
 await ready(page);await page.evaluate(async()=>{const w=window.__gw;const eye=(name,cx)=>{const n=w.core.toPen({shape:'circle',cx,cy:8,r:1.2,clockwise:false});n.name=name;const p=n.pts[0];n.pts.splice(1,0,{x:p.x,y:p.y});return n;};await w.importLibraryText(JSON.stringify({name:'eyes',layers:[{id:'face',paint:'fill',node:{op:'compound',children:[eye('Left eye',8),eye('Right eye',14)]}}]}),'eyes.json');w.S.sel=[{l:0,p:[0]},{l:0,p:[1]}];w.setTool('select');w.refresh(true);});
 await page.getByText('Left eye',{exact:true}).click();await page.getByText('Right eye',{exact:true}).click({modifiers:['Shift']});
 await page.locator('#canvas').scrollIntoViewIfNeeded();const p=await screen(page,8,8);await page.mouse.click(p.x,p.y,{button:'right'});await page.getByRole('menuitem',{name:'Actions',exact:true}).click();await expect(page.locator('#itemMenu')).toContainText('2 selected objects');await page.screenshot({path:'artifacts/regular-eyes-menu.png'});await page.getByRole('menuitem',{name:'Convert to circle/ellipse (4 anchors)',exact:true}).click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children.map(n=>({shape:n.shape,points:window.__gw.core.toPen(n).pts.length,clockwise:n.clockwise})))).toEqual([{shape:'circle',points:4,clockwise:false},{shape:'circle',points:4,clockwise:false}]);
 await page.screenshot({path:'artifacts/regular-eyes-converted.png'});await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children.map(n=>n.pts.length))).toEqual([5,5]);await page.locator('#redoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children.map(n=>n.shape))).toEqual(['circle','circle']);
});

test('an inserted Pen anchor previews and merges on release rather than bypassing proximity merge', async ({page}) => {
 await ready(page);
 await page.evaluate(async()=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'insert-merge',weight:0.2,layers:[{id:'path',paint:'stroke',node:{shape:'pen',pts:[{x:2,y:4},{x:6,y:4},{x:12,y:4},{x:18,y:4}]}}]}),'insert.json');w.S.sel=[{l:0,p:[]}];w.setTool('pen');w.refresh(true);});
 await page.locator('[data-snap="0"]').click();await page.locator('#proximityMergeBtn').click();
 await page.locator('#canvas').scrollIntoViewIfNeeded();const start=await screen(page,9,4),near=await screen(page,11.9,4),far=await screen(page,10,4);
 await page.mouse.move(start.x,start.y);await page.mouse.down();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(5);
 await page.mouse.move(near.x,near.y);await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(2);
 await page.mouse.move(far.x,far.y);await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(0);
 await page.mouse.move(near.x,near.y);await expect(page.locator('#gMergePreview [data-merge-result]')).toHaveCount(1);
 await page.screenshot({path:'artifacts/merge-preview.png'});await page.mouse.up();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(4);
 await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(0);
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(4);
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[2].x)).toBe(12);
});
