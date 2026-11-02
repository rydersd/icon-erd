import { test, expect } from '@playwright/test';
import { openDisclosures } from './helpers.js';
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
});

test('stroke weight says where it comes from', async ({ page }) => {
  await boot(page); await loadDisc(page); await libraryThickness(page, 1.6);
  const source = page.locator('#pane-details .icon-section .stroke-source');
  await expect(source).toHaveText(/Library 1\.6/);
  await page.locator('#iconThicknessOverride').check();
  await page.locator('#iconThickness').fill('2'); await page.locator('#iconThickness').press('Tab');
  await expect(source).toHaveText(/Overrides library 1\.6/);
  expect(await page.evaluate(() => [window.__gw.S.glyph.strokeOverride, window.__gw.S.glyph.setStyle?.thickness])).toEqual([2, 2]);
  await page.locator('#iconThicknessOverride').uncheck();
  await expect(source).toHaveText(/Library 1\.6/);
  expect(await page.evaluate(() => window.__gw.S.glyph.strokeOverride)).toBeUndefined();
  await page.locator('#undoBtn').click(); await expect(source).toHaveText(/Overrides library 1\.6/);
  await page.locator('#redoBtn').click(); await expect(source).toHaveText(/Library 1\.6/);
});

test('output size says when the library manages it', async ({ page }) => {
  await boot(page); await loadDisc(page);
  const source = page.locator('#pane-details .icon-section .size-source');
  await page.locator('#exportSize').fill('32'); await page.locator('#exportSize').press('Tab');
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.locator('#exportSize')).toHaveValue('32');
  await openDisclosures(page, '.set-settings');
  await page.locator('#libraryOutputProfile').selectOption('menu-bar');
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
  await openDisclosures(page, '[data-collapse="libraryActions"]');
  await page.evaluate(async () => { await window.__gw.importLibraryText(JSON.stringify([{ name: 'disc', group: 'Shapes', weight: 1.2, layers: [{ id: 'disc', paint: 'fill', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] }]), 'test.json', 'replace'); });
  await page.locator('#insetReviewBtn').click(); await expect(page.locator('#groupReview')).toContainText('1 / 1 tested');
  await page.getByRole('button', { name: 'Repair on canvas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Guided outline repair' })).toBeVisible();
  expect(await page.evaluate(() => ['drawingMode', 'exportSize'].map(id => !!document.getElementById(id).closest('[inert]')))).toEqual([true, true]);
  await expect(page.locator('#iconThickness')).toBeDisabled();
  await expect(page.locator('#pane-details .icon-section #drawingMode')).toHaveCount(1);
});
