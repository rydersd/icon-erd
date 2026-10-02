import {test,expect} from '@playwright/test';
const launch=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const setup=async page=>page.evaluate(async()=>{
 const make=(name,x)=>({name,grid:24,weight:1.2,layers:[{id:'body',name:'Cloud body',paint:'stroke',node:{name:'Cloud silhouette',shape:'pen',closed:true,pts:[{x,y:4},{x:x+4,y:4},{x:x+4,y:8},{x,y:8}]}}]});
 await window.__gw.importLibraryText(JSON.stringify({glyphs:[make('test-cloud',2),make('test-cloud-rain',12)]}),'components.json');window.__gw.loadGlyph(window.__gw.idx('test-cloud'));
});
test('shared forms link through UI, propagate direct edits, undo every peer, preserve moves, detach and reload',async({page})=>{
 await launch(page);await setup(page);
 await page.locator('#findSharedFormsBtn').click();await page.locator('#sharedFormsSearch').fill('test-cloud');
 await expect(page.locator('.shared-form-card')).toHaveCount(1);await page.getByRole('button',{name:'Link repeated form',exact:true}).click();
 await expect(page.locator('#gForms [data-component]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.component.name)).toBe('Cloud silhouette');
 const peerThumb=page.locator('.lib-item[data-name="test-cloud-rain"] .thumb');await peerThumb.scrollIntoViewIfNeeded();await expect(peerThumb.locator('svg')).toHaveCount(1);const originalThumb=await peerThumb.innerHTML();
 await page.evaluate(()=>{const w=window.__gw;w.S.sel=[{l:0,p:[]}];w.S.glyph.layers[0].node.pts[1].y=3;w.commit();w.refresh(true);});
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[1])).toMatchObject({x:16,y:3});
 expect(await peerThumb.innerHTML()).not.toBe(originalThumb);
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[1].y)).toBe(4);await expect(peerThumb).toHaveJSProperty('innerHTML',originalThumb);
 await page.locator('#redoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[1].y)).toBe(3);
 // Object movement moves only this instance; direct-selection geometry is shared.
 await page.evaluate(()=>{window.__gw.setTool('select');document.activeElement?.blur();});await page.keyboard.press('ArrowRight');
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[0].x)).toBe(12);
 await page.getByRole('button',{name:'Detach instance',exact:true}).click();
 await page.evaluate(()=>{const w=window.__gw;w.S.glyph.layers[0].node.pts[1].y=1;w.commit();w.refresh(true);});
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[1].y)).toBe(3);
 await page.evaluate(()=>window.__gw.flushSaves());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.component.name)).toBe('Cloud silhouette');
});
test('linking itself is atomic under undo/redo and a ZIP document preserves linked projections',async({page})=>{
 await launch(page);await setup(page);
 await page.evaluate(()=>{const w=window.__gw;const g=w.findSharedForms().find(g=>g.members.some(f=>f.glyph.name==='test-cloud'));w.linkFormGroup(g,'Cloud');});
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.filter(g=>g.name.startsWith('test-cloud')).every(g=>!g.layers[0].node.component))).toBe(true);
 await page.locator('#redoBtn').click();await page.evaluate(()=>window.__gw.flushSaves());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
 expect(await page.evaluate(()=>{const gs=window.__gw.S.lib.filter(g=>g.name.startsWith('test-cloud'));return gs[0].layers[0].node.component.id===gs[1].layers[0].node.component.id;})).toBe(true);
 await page.evaluate(async()=>{const w=window.__gw, gs=w.S.lib.filter(g=>g.name.startsWith('test-cloud'));await w.importLibraryText(JSON.stringify({glyphs:gs}),'linked.json');w.loadGlyph(w.idx('test-cloud-2'));w.S.glyph.layers[0].node.pts[1].y=0;w.commit();});
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain-2').layers[0].node.pts[1].y)).toBe(0);
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='test-cloud-rain').layers[0].node.pts[1].y)).toBe(4);
});
