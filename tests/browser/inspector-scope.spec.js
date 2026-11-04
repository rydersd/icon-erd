import { test, expect } from '@playwright/test';
import { openDisclosures, showPlace } from './helpers.js';
// UX-02a Icon section. Spec: wiki/product-spec/ux-02-inspector-by-selection.md (local wiki).
const boot = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); };
const icon = page => page.locator('#pane-details .icon-section');
const disc = { name: 'disc', group: 'Shapes', weight: 1.2, layers: [{ id: 'disc', paint: 'stroke', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] };
const loadDisc = async page => { await page.evaluate(async d => { await window.__gw.importLibraryText(JSON.stringify([d]), 'test.json', 'replace'); window.__gw.loadGlyph(0); window.__gw.S.sel = []; window.__gw.refresh(true); }, disc); };
const libraryThickness = async (page, value) => { await openDisclosures(page, '.set-settings'); await page.locator('#setThicknessEnabled').check(); await page.locator('#setThickness').fill(String(value)); await page.locator('#setThickness').press('Tab'); };

test('icon section holds kind, output size and stroke weight', async ({ page }) => {
  await boot(page);
  await expect(icon(page)).toBeVisible();
  for (const id of ['#drawingMode', '#exportSize', '#iconThicknessOverride', '#iconThickness']) {
    await expect(page.locator(`#pane-details .icon-section ${id}`), id).toHaveCount(1);
    await expect(page.locator(`header.bar ${id}`), id).toHaveCount(0);
    await expect(page.locator(`[data-collapse="pvH"] ${id}`), id).toHaveCount(0);
  }
  await expect(page.locator('#drawingMode')).toBeVisible();
  await expect(page.locator('#iconThickness')).toBeVisible();
});

test('one control per stored stroke value', async ({ page }) => {
  await boot(page); await loadDisc(page);
  await page.locator('#iconThicknessOverride').check();
  await page.locator('#iconThickness').fill('2'); await page.locator('#iconThickness').press('Tab');
  await page.evaluate(() => { window.__gw.S.sel = []; window.__gw.refresh(true); });
  await expect(page.locator('#insp label', { hasText: /stroke override/i })).toHaveCount(0);
  await expect(page.locator('#insp label', { hasText: /base weight \(no library\)/i })).toHaveCount(1);
  // Exactly one visible, enabled number field in the icon and inspector area edits the stroke override.
  const writers = await page.evaluate(async () => {
    const inputs = [...document.querySelectorAll('#pane-details input[type=number]')].filter(e => e.checkVisibility() && !e.disabled);
    const hits = [];
    for (const input of inputs) {
      const before = JSON.stringify(window.__gw.S.glyph.strokeOverride);
      const old = input.value; input.value = '2.7'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
      if (JSON.stringify(window.__gw.S.glyph.strokeOverride) !== before) hits.push(input.id || input.getAttribute('aria-label') || 'unnamed');
      window.__gw.S.glyph.strokeOverride = JSON.parse(before); input.value = old; window.__gw.S.sel = []; window.__gw.refresh(true);
    }
    return hits;
  });
  expect(writers).toEqual(['iconThickness']);
});

test('icon section stays above the inspector with a layer selected', async ({ page }) => {
  await boot(page); await loadDisc(page);
  await page.evaluate(() => { window.__gw.S.sel = [{ l: 0, p: null }]; window.__gw.refresh(true); });
  await expect(icon(page)).toBeVisible();
  const [a, b] = await Promise.all([icon(page).boundingBox(), page.locator('#insp').boundingBox()]);
  expect(a.y).toBeLessThan(b.y);
});

test('stroke weight names the icon base when the library has no thickness', async ({ page }) => {
  await boot(page); await loadDisc(page);
  await expect(page.locator('#pane-details .icon-section .stroke-source')).toHaveText('Icon base 1.2');
});

test('stroke weight says where it comes from', async ({ page }) => {
  await boot(page); await loadDisc(page); await libraryThickness(page, 1.6); await showPlace(page, 'icon');
  const source = page.locator('#pane-details .icon-section .stroke-source');
  await expect(source).toHaveText('Library 1.6');
  await page.locator('#iconThicknessOverride').check();
  await page.locator('#iconThickness').fill('2'); await page.locator('#iconThickness').press('Tab');
  await expect(source).toHaveText('Overrides library 1.6');
  expect(await page.evaluate(() => [window.__gw.S.glyph.strokeOverride, window.__gw.S.glyph.setStyle?.thickness])).toEqual([2, 2]);
  await page.locator('#iconThicknessOverride').uncheck();
  await expect(source).toHaveText('Library 1.6');
  expect(await page.evaluate(() => window.__gw.S.glyph.strokeOverride)).toBeUndefined();
  await page.locator('#undoBtn').click(); await expect(source).toHaveText('Overrides library 1.6');
  expect(await page.evaluate(() => window.__gw.S.glyph.strokeOverride)).toBe(2);
  await page.locator('#redoBtn').click(); await expect(source).toHaveText('Library 1.6');
  expect(await page.evaluate(() => window.__gw.S.glyph.strokeOverride)).toBeUndefined();
});

test('output size says when the library manages it', async ({ page }) => {
  await boot(page); await loadDisc(page);
  const source = page.locator('#pane-details .icon-section .size-source');
  await page.locator('#exportSize').fill('32'); await page.locator('#exportSize').press('Tab');
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.locator('#exportSize')).toHaveValue('32');
  await showPlace(page, 'library', 'output');
  await page.locator('#libraryOutputProfile').selectOption('menu-bar'); await showPlace(page, 'icon');
  await expect(page.locator('#exportSize')).toBeDisabled();
  await expect(source).toBeVisible();
  await expect(source).toHaveText(/From library output/);
  await expect(source).toHaveText(/18/);
});

test('kind still drives output size', async ({ page }) => {
  await boot(page); await loadDisc(page);
  await page.locator('#drawingMode').selectOption('app-icon');
  await expect(page.locator('#exportSize')).toHaveValue('1024');
});

test('guided repair locks kind and output size', async ({ page }) => {
  await boot(page);
  await showPlace(page, 'library', 'organize');
  await page.evaluate(async () => { await window.__gw.importLibraryText(JSON.stringify([{ name: 'disc', group: 'Shapes', weight: 1.2, layers: [{ id: 'disc', paint: 'fill', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] }]), 'test.json', 'replace'); });
  await page.locator('#insetReviewBtn').click(); await expect(page.locator('#groupReview')).toContainText('1 / 1 tested');
  await page.getByRole('button', { name: 'Repair on canvas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Guided outline repair' })).toBeVisible();
  expect(await page.evaluate(() => ['drawingMode', 'exportSize'].map(id => !!document.getElementById(id).closest('[inert]')))).toEqual([true, true]);
  await expect(page.locator('#iconThickness')).toBeDisabled();
  await expect(page.locator('#iconThicknessOverride')).toBeDisabled();
  await expect(page.locator('#pane-details .icon-section #drawingMode')).toHaveCount(1);
});

test('stroke source matches the drawn weight when the icon carries a library style', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { await window.__gw.importLibraryText(JSON.stringify([{ name: 'styled', weight: 1.2, setStyle: { thickness: 1.6 }, layers: [{ id: 'ring', paint: 'stroke', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] }]), 'styled.json', 'replace'); window.__gw.loadGlyph(0); window.__gw.S.sel = []; window.__gw.refresh(true); });
  const drawn = await page.evaluate(() => [window.__gw.S.libraryProperties ? 'library' : 'none', window.__gw.S.glyph.setStyle?.thickness]);
  console.log('state', JSON.stringify(drawn));
  await expect(page.locator('#pane-details .icon-section .stroke-source')).toHaveText(`Library ${drawn[1]}`);
  await expect(page.locator('#iconThickness')).toHaveAttribute('aria-describedby', /strokeSource/);
  await expect(page.locator('#exportSize')).toHaveAttribute('aria-describedby', /sizeSource/);
});
