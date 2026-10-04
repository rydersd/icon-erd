import {test,expect} from '@playwright/test';
const open = async page => {await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
async function drag(page,label,dx,{shift=false,cancel=false}={}) {
  const b=await label.boundingBox(),x=b.x+5,y=b.y+8;
  await page.mouse.move(x,y);await page.mouse.down();
  if(shift)await page.keyboard.down('Shift');
  await page.mouse.move(x+dx,y,{steps:4});
  if(cancel)await page.keyboard.press('Escape');
  await page.mouse.up();if(shift)await page.keyboard.up('Shift');
}
test('numeric labels focus on click, scrub their step, Shift changes digit, Escape cancels, preferences persist',async({page})=>{
  await open(page);const label=page.locator('label[for="cleanupTolerance"]'),input=page.locator('#cleanupTolerance');
  await label.click({position:{x:5,y:8}});await expect(input).toBeFocused();
  await input.fill('5');await input.press('Tab');
  await drag(page,label,40);await expect(input).toHaveValue('5.01');
  await drag(page,label,40,{shift:true});await expect(input).toHaveValue('5.11');
  await drag(page,label,40,{cancel:true});await expect(input).toHaveValue('5.11');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(input).toHaveValue('5.11');
  await drag(page,page.locator('label[for="mergeDistance"]'),400);await expect(page.locator('#mergeDistance')).toHaveValue('64');
});
test('scrubbing a document label makes one undoable edit, including dynamic studio fields',async({page})=>{
  await open(page);const before=await page.evaluate(()=>window.__gw.S.undo.length);
  await drag(page,page.locator('label[for="exportSize"]'),40);
  await expect(page.locator('#exportSize')).toHaveValue('34');
  expect(await page.evaluate(()=>window.__gw.S.undo.length)).toBe(before+1);
  await page.locator('#undoBtn').click();await expect(page.locator('#exportSize')).toHaveValue('24');
  await page.locator('#drawingMode').selectOption('app-icon');await page.getByLabel('App icon fill type',{exact:true}).selectOption('linear');
  const field=page.getByLabel('Gradient x1',{exact:true});
  await drag(page,field.locator('..'),40);await expect(field).toHaveValue('0.1');
  await page.locator('#undoBtn').click();await expect(field).toHaveValue('0');
});
test('inspector scrubs preview live, cancel without history, and commit once',async({page})=>{
  await open(page);await page.locator('#canvas').press('Escape');
  const label=page.locator('#insp label').filter({has:page.locator('span', {hasText:'weight (standard)'})});
  const original=await page.evaluate(()=>({weight:window.__gw.S.glyph.weight,undo:window.__gw.S.undo.length}));
  const b=await label.boundingBox();await page.mouse.move(b.x+5,b.y+8);await page.mouse.down();await page.mouse.move(b.x+45,b.y+8,{steps:4});
  expect(await page.evaluate(()=>window.__gw.S.glyph.weight)).toBeCloseTo(original.weight+1);
  expect(await page.evaluate(()=>window.__gw.S.undo.length)).toBe(original.undo);
  await page.keyboard.press('Escape');await page.mouse.up();
  expect(await page.evaluate(()=>window.__gw.S.glyph.weight)).toBe(original.weight);
  expect(await page.evaluate(()=>window.__gw.S.undo.length)).toBe(original.undo);
  await drag(page,label,40);
  expect(await page.evaluate(()=>window.__gw.S.undo.length)).toBe(original.undo+1);
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.weight)).toBe(original.weight);
});
