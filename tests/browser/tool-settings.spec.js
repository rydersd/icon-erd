import {test,expect} from '@playwright/test';
const screen=async(page,x,y)=>page.evaluate(({x,y})=>{const c=document.querySelector('#canvas'),p=c.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(c.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
const setup=async(page,pts)=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);await page.evaluate(async pts=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'tolerance',layers:[{id:'curve',paint:'stroke',node:{shape:'pen',pts}}]}),'tolerance.json');w.S.sel=[{l:0,p:[]}];w.setTool('direct');w.refresh(true);},pts);};
test('cleanup tolerance changes the actual fit budget and persists independently of Undo',async({page})=>{
 const pts=[{x:0,y:0},{x:1,y:.06},{x:2,y:0},{x:3,y:0}];await setup(page,pts);
 await page.locator('#canvas').press('ControlOrMeta+a');await page.locator('#cleanupSelectedBtn').click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(3);
 await page.locator('#undoBtn').click();await page.locator('#canvas').press('ControlOrMeta+a');
 await page.locator('[data-cleanup-tolerance="0.1"]').click();await page.locator('#cleanupSelectedBtn').click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(2);await expect(page.locator('#status')).toContainText('0.1-unit');
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts)).toEqual(pts);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('#cleanupTolerance')).toHaveValue('0.1');
});
test('merge distance controls preview and release using the same screen-pixel threshold',async({page})=>{
 await setup(page,[{x:4,y:4},{x:5,y:4},{x:10,y:4}]);await page.locator('#proximityMergeBtn').click();
 const move=async()=>{await page.locator('#canvas').scrollIntoViewIfNeeded();const a=await screen(page,4,4),b=await screen(page,4.6,4);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);};
 await page.locator('#mergeDistance').fill('2');await page.locator('#mergeDistance').press('Tab');await move();
 await expect(page.locator('#gMergePreview [data-merge-result]')).toHaveCount(0);await page.mouse.up();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(3);await page.locator('#undoBtn').click();
 await page.locator('#mergeDistance').fill('32');await page.locator('#mergeDistance').press('Tab');await move();
 await expect(page.locator('#gMergePreview [data-merge-result]')).toHaveCount(1);await page.mouse.up();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(2);
 await page.locator('#undoBtn').click();await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('#mergeDistance')).toHaveValue('32');
});
test('all right sections and contextual settings collapse persistently; shapes live above the canvas',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
 await expect(page.locator('.canvas-tools #palette')).toHaveCount(1);await expect(page.locator('.col-left #palette')).toHaveCount(0);
 const panels=page.locator('#pane-right > details[data-collapse]');await expect(panels).toHaveCount(5);
 for(let i=0;i<5;i++){await panels.nth(i).locator(':scope > summary').click();await expect(panels.nth(i)).not.toHaveAttribute('open','');}
 await page.locator('[data-collapse="tool-settings"] > summary').click();
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);for(let i=0;i<5;i++)await expect(panels.nth(i)).not.toHaveAttribute('open','');
 await expect(page.locator('[data-collapse="tool-settings"]')).not.toHaveAttribute('open','');
 await page.locator('[data-collapse="measureH"] > summary').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-collapse="measureH"]')).toHaveAttribute('open','');
});

test('cleanup accepts a high tolerance without an upper cap and remembers it after reload',async({page})=>{
 await setup(page,[{x:0,y:0},{x:1,y:.06},{x:2,y:0},{x:3,y:0}]);
 await page.locator('#cleanupTolerance').fill('10');await page.locator('#cleanupTolerance').press('Tab');
 await expect(page.locator('#cleanupTolerance')).toHaveValue('10');
 expect(await page.locator('#cleanupTolerance').getAttribute('max')).toBeNull();
 await page.locator('#canvas').press('ControlOrMeta+a');await page.locator('#cleanupSelectedBtn').click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(2);
 await expect(page.locator('#status')).toContainText('10-unit');await page.locator('#undoBtn').click();
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('#cleanupTolerance')).toHaveValue('10');
 await page.locator('#cleanupTolerance').fill('-1');await page.locator('#cleanupTolerance').press('Tab');await expect(page.locator('#cleanupTolerance')).toHaveValue('10');
});
