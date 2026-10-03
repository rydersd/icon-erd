import { test, expect } from '@playwright/test';

test('Select All works from page focus and Escape clears or cancels selection without touching text input', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async () => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'shortcut-selection', layers: [
      { id: 'first', paint: 'stroke', node: { shape: 'pen', pts: [{ x: 4, y: 4 }, { x: 8, y: 4 }] } },
      { id: 'second', paint: 'stroke', node: { shape: 'pen', pts: [{ x: 12, y: 12 }, { x: 16, y: 12 }] } },
    ] }), 'shortcuts.json');
    w.setTool('select'); document.activeElement.blur();
  });
  await page.keyboard.press('ControlOrMeta+a');
  expect(await page.evaluate(() => window.__gw.S.sel.length)).toBe(2);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__gw.S.sel.length)).toBe(0);
  await page.locator('[data-tool="direct"]').click(); await page.locator('#canvas').focus();
  await page.keyboard.press('ControlOrMeta+a');
  expect(await page.evaluate(() => window.__gw.S.selectedAnchors.length)).toBe(4);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => [window.__gw.S.sel.length, window.__gw.S.selectedAnchors.length, window.__gw.S.anchor])).toEqual([0, 0, null]);
  const original = await page.evaluate(() => JSON.stringify(window.__gw.S.glyph));
  const screen = async (x, y) => page.evaluate(({ x, y }) => { const c = document.querySelector('#canvas'), p = c.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(c.getScreenCTM()); return { x: q.x, y: q.y }; }, { x, y });
  const a = await screen(2, 2), b = await screen(18, 14);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await expect(page.locator('#anchorMarquee')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.locator('#anchorMarquee')).toHaveCount(0); await page.mouse.up();
  expect(await page.evaluate(() => window.__gw.S.selectedAnchors.length)).toBe(0);
  expect(await page.evaluate(() => JSON.stringify(window.__gw.S.glyph))).toBe(original);
  await page.evaluate(() => { const w = window.__gw; w.S.sel = [{ l: 0, p: [] }]; w.isoEnter({ l: 0, p: [] }); });
  await page.locator('#canvas').focus(); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__gw.S.sel.length)).toBe(0);
  expect(await page.evaluate(() => window.__gw.S.iso)).not.toBeNull();
  await page.keyboard.press('Escape'); expect(await page.evaluate(() => window.__gw.S.iso)).toBeNull();
  await page.evaluate(() => { window.__gw.S.sel = [{ l: 0, p: [] }]; window.__gw.refresh(true); });
  const input = page.locator('#libSearch'); await input.fill('search text'); await input.press('ControlOrMeta+a');
  expect(await input.evaluate(e => e.selectionEnd - e.selectionStart)).toBe(11);
  await input.press('Escape');
  expect(await page.evaluate(() => window.__gw.S.sel.length)).toBe(1); // native search Escape must not clear canvas selection
});
