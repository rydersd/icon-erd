import {test,expect} from '@playwright/test';
const setup=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);await page.evaluate(async()=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'retract-test',layers:[{id:'outline',paint:'stroke',node:{shape:'pen',pts:[{x:2,y:4},{x:8,y:4,in:[-2,0],out:[0,2],r:0.5},{x:8,y:12,in:[0,-2],out:[2,0]},{x:16,y:12}]}}]}),'retract.json');w.S.sel=[{l:0,p:[]}];w.setTool('direct');w.refresh(true);});};
test('Option-click retracts both handles on only the clicked anchor and Undo restores them',async({page})=>{
  await setup(page);const before=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);
  const box=await page.locator('#gSel [data-anchor="1"]').boundingBox();await page.keyboard.down('Alt');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.keyboard.up('Alt');
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1])).toEqual({x:8,y:4,r:0.5});
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[2])).toEqual(before[2]);
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts)).toEqual(before);
});
test('the anchor menu retracts handles on multiple selected anchors in one edit',async({page})=>{
  await setup(page);const before=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);
  for(const i of [1,2]){const box=await page.locator(`#gSel [data-anchor="${i}"]`).boundingBox();if(i===2)await page.keyboard.down('Shift');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);if(i===2)await page.keyboard.up('Shift');}
  await page.locator('#canvas').press('Shift+F10');await page.getByRole('menuitem',{name:'Retract handles',exact:true}).click();
  const points=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);expect(points[1]).toEqual({x:8,y:4,r:0.5});expect(points[2]).toEqual({x:8,y:12});
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts)).toEqual(before);
});
