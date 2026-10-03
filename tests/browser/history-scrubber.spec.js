import { test, expect } from '@playwright/test';

test('Edited badge scrubs the actual library undo history, restores redo, and branches after an edit', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  const original = await page.evaluate(() => {
    const w = window.__gw;
    const first = w.S.glyph.name, weight = w.S.glyph.weight;
    w.S.glyph.weight = 2; w.commit(); w.refresh(true);
    w.S.glyph.weight = 3; w.commit(); w.refresh(true);
    w.loadGlyph(1); const second = w.S.glyph.name;
    w.S.glyph.weight = 4; w.commit(); w.refresh(true);
    return { first, second, weight };
  });
  await page.getByRole('button', { name: 'Scrub edit history', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'History position', exact: true });
  await expect(slider).toHaveValue('3');
  await slider.press('ArrowLeft');
  await slider.press('ArrowLeft');
  expect(await page.evaluate(() => [window.__gw.S.glyph.name, window.__gw.S.glyph.weight])).toEqual([original.first, 2]);
  await expect(slider).toHaveValue('1');
  await slider.press('Home');
  expect(await page.evaluate(() => window.__gw.S.glyph.weight)).toBe(original.weight);
  await expect(page.locator('#hdrEdited')).toBeVisible();
  await slider.press('End');
  expect(await page.evaluate(() => [window.__gw.S.glyph.name, window.__gw.S.glyph.weight])).toEqual([original.second, 4]);
  await expect(slider).toHaveValue('3');
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
  await page.screenshot({ path: 'artifacts/history-scrubber.png' });
});
