import { test, expect } from '@playwright/test';
// UX-02b Layer stroke inherits visibly. Spec: wiki/product-spec/ux-02-inspector-by-selection.md (local wiki).
const glyph = { name: 'pair', group: 'Shapes', weight: 1.2, layers: [
  { id: 'ring', name: 'Ring', paint: 'stroke', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } },
  { id: 'dot', name: 'Dot', paint: 'fill', node: { shape: 'circle', cx: 12, cy: 12, r: 1 } }] };
const boot = async (page, layer = 0) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async ({ g, layer }) => { await window.__gw.importLibraryText(JSON.stringify([g]), 't.json', 'replace'); window.__gw.loadGlyph(0); window.__gw.S.sel = [{ l: layer, p: null }]; window.__gw.refresh(true); }, { g: glyph, layer });
};
const own = page => page.getByLabel('own stroke width', { exact: true });
const source = page => page.locator('#insp .layer-stroke-source');

test('layer stroke shows the icon value it inherits', async ({ page }) => {
  await boot(page);
  await expect(own(page)).not.toBeChecked();
  await expect(source(page)).toHaveText('Icon 1.2');
});

test('own stroke width keeps the icon value beside it', async ({ page }) => {
  await boot(page);
  await own(page).check();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].strokeWidth)).toBe(1.2);
  await expect(page.getByLabel('layer stroke width', { exact: true })).toBeVisible();
  await expect(source(page)).toHaveText('Icon 1.2');
  await own(page).uncheck();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].strokeWidth)).toBeUndefined();
  await page.locator('#undoBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].strokeWidth)).toBe(1.2);
});

test('inherited value follows the icon override', async ({ page }) => {
  await boot(page);
  await page.locator('#iconThicknessOverride').check();
  await page.locator('#iconThickness').fill('2'); await page.locator('#iconThickness').press('Tab');
  await page.evaluate(() => { window.__gw.S.sel = [{ l: 0, p: null }]; window.__gw.refresh(true); });
  await expect(source(page)).toHaveText('Icon 2');
});

test('fill layers have no stroke inheritance', async ({ page }) => {
  await boot(page, 1);
  await expect(own(page)).toHaveCount(0);
  await expect(source(page)).toHaveCount(0);
  await expect(page.locator('#insp label', { hasText: 'layer name' })).toHaveCount(1);
});
