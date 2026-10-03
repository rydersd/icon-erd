import {test,expect} from '@playwright/test';
const screen=async(page,x,y)=>page.evaluate(({x,y})=>{const svg=document.querySelector('#canvas'),p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
const screenStroke=page=>page.evaluate(()=>{const svg=document.querySelector('#canvas'),marker=document.querySelector('#gPoints [data-point-kind]');return +marker.getAttribute('stroke-width')*svg.getBoundingClientRect().width/window.__gw.S.view.s;});
test('dense anchor selection avoids per-point canvas layout reads and keeps marker width correct after zoom and resize',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
 await page.evaluate(async()=>{
  const w=window.__gw,pts=Array.from({length:100},(_,i)=>({x:12+8*Math.cos(i*Math.PI/50),y:12+8*Math.sin(i*Math.PI/50)}));
  await w.importLibraryText(JSON.stringify({name:'dense-anchors',layers:[{id:'body',paint:'fill',node:{shape:'pen',closed:true,pts}}]}),'dense.json');
  w.setTool('direct');w.S.sel=[];w.refresh(true);
  const canvas=document.querySelector('#canvas'),original=canvas.getBoundingClientRect.bind(canvas);
  window.canvasBoundsReads=0;canvas.getBoundingClientRect=()=>{window.canvasBoundsReads++;return original();};
 });
 await page.locator('#canvas').scrollIntoViewIfNeeded();
 const first=await screen(page,20,12);
 await page.evaluate(()=>window.canvasBoundsReads=0);
 await page.mouse.click(first.x,first.y);
 expect(await page.evaluate(()=>window.canvasBoundsReads)).toBeLessThan(20);
 await expect(page.locator('#pointRows tr')).toHaveCount(1);
 await expect(page.locator('#gSel [data-anchor="0"]')).toHaveAttribute('data-selected','true');
 await page.evaluate(()=>window.canvasBoundsReads=0);
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.canvasBoundsReads)).toBeLessThan(20);
 await expect(page.locator('#pointRows tr')).toHaveCount(100);
 expect(await screenStroke(page)).toBeCloseTo(1.5,5);
 await page.evaluate(()=>{window.__gw.S.view.s=40;window.__gw.refresh(true);});
 expect(await screenStroke(page)).toBeCloseTo(1.5,5);
 await page.setViewportSize({width:1100,height:900});
 await expect.poll(()=>screenStroke(page)).toBeCloseTo(1.5,5);
 // Hit zones still work with the new viewport and drawing scale.
 await page.locator('#canvas').scrollIntoViewIfNeeded();const resized=await screen(page,20,12);await page.mouse.click(resized.x,resized.y);
 await expect(page.locator('#gSel [data-anchor="0"]')).toHaveAttribute('data-selected','true');
});
