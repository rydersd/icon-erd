import { test, expect } from '@playwright/test';

test('Edited badge scrubs only the current icon history, preserves other icons, and branches after an edit', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  const original = await page.evaluate(() => {
    const w = window.__gw;
    const first = w.S.glyph.name, weight = w.S.glyph.weight;
    w.S.glyph.weight = 2; w.commit(); w.refresh(true);
    w.S.glyph.weight = 3; w.commit(); w.refresh(true);
    w.loadGlyph(1); const second = w.S.glyph.name;
    w.S.glyph.weight = 4; w.commit(); w.refresh(true);
    w.S.iconHistories = {}; w.loadGlyph(0); return { first, second, weight }; // migrate legacy global history
  });
  await page.getByRole('button', { name: 'Scrub edit history', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'History position', exact: true });
  await expect(slider).toHaveValue('2');
  await slider.press('ArrowLeft');
  expect(await page.evaluate(() => [window.__gw.S.glyph.name, window.__gw.S.glyph.weight])).toEqual([original.first, 2]);
  await expect(slider).toHaveValue('1');
  await slider.press('Home');
  expect(await page.evaluate(() => window.__gw.S.glyph.weight)).toBe(original.weight);
  expect(await page.evaluate(name => window.__gw.S.lib.find(g => g.name === name).weight, original.second)).toBe(4);
  await expect(page.locator('#hdrEdited')).toBeVisible();
  await slider.press('End');
  expect(await page.evaluate(() => [window.__gw.S.glyph.name, window.__gw.S.glyph.weight])).toEqual([original.first, 3]);
  expect(await page.evaluate(name => window.__gw.S.lib.find(g => g.name === name).weight, original.second)).toBe(4);
  await expect(slider).toHaveValue('2');
  // Pointer scrubbing reaches the oldest end and restores later edits with the same range.
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(slider).toHaveValue('0');
  await slider.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Edit history', exact: true })).toBeHidden();
  await expect(page.locator('#hdrEdited')).toBeFocused();
  await page.evaluate(async () => { const w = window.__gw; w.S.glyph.weight = 5; w.commit(); w.refresh(true); await w.flushSaves(); });
  expect(await page.evaluate(() => window.__gw.S.redo.length)).toBe(0);
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  expect(await page.evaluate(() => window.__gw.S.glyph.weight)).toBe(5);
  await page.locator('#hdrEdited').click(); await expect(slider).toHaveValue('2');
  expect(await page.evaluate(name => window.__gw.S.lib.find(g => g.name === name).weight, original.second)).toBe(4);
  await page.screenshot({ path: 'artifacts/history-scrubber.png' });
});

test('icon history keeps linked geometry live while retaining unrelated peer edits', async ({page}) => {
 await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
 await page.evaluate(async()=>{const make=(name,x)=>({name,weight:0.2,layers:[{id:'body',paint:'stroke',node:{shape:'pen',closed:true,pts:[{x,y:4},{x:x+4,y:4},{x:x+4,y:8},{x,y:8}]}}]});const w=window.__gw;await w.importLibraryText(JSON.stringify({glyphs:[make('history-cloud',2),make('history-peer',12)]}),'history.json');w.loadGlyph(w.idx('history-cloud'));});
 await page.locator('#findSharedFormsBtn').click();await page.locator('#sharedFormsSearch').fill('history-');await page.getByRole('button',{name:'Link repeated form',exact:true}).click();
 await page.evaluate(()=>{const w=window.__gw;w.S.glyph.layers[0].node.pts[1].y=3;w.commit();w.refresh(true);w.loadGlyph(w.idx('history-peer'));w.S.glyph.description='Keep this peer note';w.commit();w.refresh(true);w.loadGlyph(w.idx('history-cloud'));});
 await page.locator('#hdrEdited').click();const slider=page.getByRole('slider',{name:'History position',exact:true});await slider.press('ArrowLeft');
 expect(await page.evaluate(()=>window.__gw.S.glyph.name)).toBe('history-cloud');
 expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].y)).toBe(4);
 expect(await page.evaluate(()=>{const peer=window.__gw.S.lib.find(g=>g.name==='history-peer');return [peer.layers[0].node.pts[1].y,peer.description];})).toEqual([4,'Keep this peer note']);
 await slider.press('End');expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='history-peer').layers[0].node.pts[1].y)).toBe(3);
});

test('returning to an identical earlier drawing keeps the playhead at the latest edit after reload', async ({page}) => {
 await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
 await page.evaluate(async()=>{const w=window.__gw, original=w.S.glyph.weight;w.S.glyph.weight=2;w.commit();w.refresh(true);w.S.glyph.weight=original;w.commit();w.refresh(true);w.S.iconHistories={};w.loadGlyph(0);w.S.glyph.description='legacy migration check';w.commit();w.refresh(true);await w.flushSaves();});
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#hdrEdited').click();
 await expect(page.getByRole('slider',{name:'History position',exact:true})).toHaveValue('3');
 await expect(page.locator('#historyPosition')).toContainText('latest');
});
