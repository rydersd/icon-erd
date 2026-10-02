import {test,expect} from '@playwright/test';
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const fixture=async page=>page.evaluate(async()=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'snap-test',grid:0.1,weight:1.2,layers:[{id:'line',paint:'stroke',node:{shape:'pen',closed:false,pts:[{x:1.14,y:2.26},{x:5.05,y:6.34},{x:8.18,y:5.78}]}}]}),'snap.json');w.S.sel=[{l:0,p:[]}];w.setTool('direct');w.S.selectedAnchors=[{selection:{l:0,p:[]},index:0},{selection:{l:0,p:[]},index:1}];w.S.anchor=0;w.refresh(true);});
const pointOnScreen=async(page,index)=>page.evaluate(index=>{const cv=document.querySelector('#canvas'),q=window.__gw.S.glyph.layers[0].node.pts[index];const p=cv.createSVGPoint();const m=window.__gw.fullMatrix({l:0,p:[]});p.x=m[0]*q.x+m[2]*q.y+m[4];p.y=m[1]*q.x+m[3]*q.y+m[5];const screen=p.matrixTransform(cv.getScreenCTM());return {x:screen.x,y:screen.y};},index);
test('anchor canvas menu snaps selected points to the UI spacing, undo redraws, redo redraws, and right-click never draws',async({page})=>{
 await ready(page);await fixture(page);await page.locator('[data-snap="0.3"]').click();
 const initial=await page.locator('#gLayers').innerHTML();const screen=await pointOnScreen(page,0);
 await page.mouse.click(screen.x,screen.y,{button:'right'});await expect(page.locator('#itemMenu')).toContainText('2 selected anchors');
 await page.getByRole('menuitem',{name:'Snap to nearest',exact:true}).click();
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.slice(0,2))).toEqual([{x:1.2,y:2.4},{x:5.1,y:6.3}]);
 const snapped=await page.locator('#gLayers').innerHTML();expect(snapped).not.toBe(initial);
 await page.locator('#canvas').focus();await page.keyboard.press('Shift+F10');await page.getByRole('menuitem',{name:'Undo',exact:true}).click();
 await expect(page.locator('#gLayers')).toHaveJSProperty('innerHTML',initial);
 await page.locator('#canvas').press('Control+Shift+z');await expect(page.locator('#gLayers')).toHaveJSProperty('innerHTML',snapped);
 await page.locator('[data-snap="0"]').click();await page.locator('#canvas').focus();await page.keyboard.press('Shift+F10');
 // Undo clears anchor selection, so select the clicked anchor through the actual context path.
 await page.keyboard.press('Escape');const current=await pointOnScreen(page,0);await page.mouse.click(current.x,current.y,{button:'right'});
 await expect(page.getByRole('menuitem',{name:'Snap to nearest',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await page.locator('[data-tool="pen"]').click();const before=await page.evaluate(()=>JSON.stringify(window.__gw.S.glyph));
 await page.mouse.click(current.x+35,current.y+35,{button:'right'});expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.glyph))).toBe(before);
});
test('Undo/Redo refresh stroke thickness on canvas and previews and restore set settings across the library',async({page})=>{
 await ready(page);const initial=await page.locator('#gLayers path').first().getAttribute('stroke-width');await page.locator('#setThicknessEnabled').check();await page.locator('#setThickness').fill('2.4');await page.locator('#setThickness').press('Tab');
 await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width','2.4');
 await page.locator('#undoBtn').click();await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width','1.6');
 await page.locator('#undoBtn').click();await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width',initial);
 expect(await page.evaluate(()=>window.__gw.S.lib.every(g=>!g.setStyle?.thickness))).toBe(true);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--icon-stroke-width').trim())).toBe(initial);
 await page.locator('#redoBtn').click();await page.locator('#redoBtn').click();await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width','2.4');
 expect(await page.evaluate(()=>window.__gw.S.lib.every(g=>g.setStyle?.thickness===2.4))).toBe(true);
 await page.locator('#undoBtn').click();await page.locator('#undoBtn').click();await page.evaluate(()=>window.__gw.flushSaves());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
 await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width',initial);
});

test('snap uses the drawing-plane grid for anchors in transformed objects, independent of view grid density',async({page})=>{
 await ready(page);await fixture(page);
 await page.evaluate(()=>{const w=window.__gw;w.S.glyph.layers[0].node.transform={rotate:30,origin:[0,0],scaleX:1.4,scaleY:0.8};w.commit();w.refresh(true);});
 await page.locator('[data-snap="0.5"]').click();const screen=await pointOnScreen(page,0);await page.mouse.click(screen.x,screen.y,{button:'right'});await page.getByRole('menuitem',{name:'Snap to nearest',exact:true}).click();
 const world=await page.evaluate(()=>{const w=window.__gw,m=w.fullMatrix({l:0,p:[]});return w.S.glyph.layers[0].node.pts.slice(0,2).map(q=>({x:m[0]*q.x+m[2]*q.y+m[4],y:m[1]*q.x+m[3]*q.y+m[5]}));});
 for(const p of world){expect(Math.abs(p.x/0.5-Math.round(p.x/0.5))).toBeLessThan(0.0003);expect(Math.abs(p.y/0.5-Math.round(p.y/0.5))).toBeLessThan(0.0003);}
});
