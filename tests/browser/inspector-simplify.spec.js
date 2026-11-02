import { test, expect } from '@playwright/test';
import { openDisclosure } from './helpers.js';
// UX-02d Simplify in the Inspector. Spec: wiki/product-spec/ux-02-inspector-by-selection.md (local wiki).
const pts = [{ x: 0, y: 0 }, { x: 1, y: .06 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
const setup = async page => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async pts => { const w = window.__gw; await w.importLibraryText(JSON.stringify({ name: 'tolerance', layers: [{ id: 'curve', paint: 'stroke', node: { shape: 'pen', pts } }] }), 'tolerance.json'); w.S.sel = [{ l: 0, p: [] }]; w.setTool('direct'); w.refresh(true); }, pts);
};
const simplify = page => page.locator('details[data-collapse="tool-settings"]');

test('simplify sits in the inspector with the same controls', async ({ page }) => {
  await setup(page);
  await expect(page.locator('section[aria-labelledby="inspH"] details[data-collapse="tool-settings"]')).toHaveCount(1);
  await expect(page.locator('#insp details[data-collapse="tool-settings"]')).toHaveCount(0);
  const after = await page.evaluate(() => !!(document.querySelector('#insp').compareDocumentPosition(document.querySelector('[data-collapse="tool-settings"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(after).toBe(true);
  await expect(simplify(page).locator(':scope > summary')).toHaveText(/^\s*Simplify\s*$/);
  for (const sel of ['#cleanupTolerance', '#mergeDistance', '#cleanupSelectedBtn']) {
    await expect(simplify(page).locator(sel), sel).toHaveCount(1);
    expect(await page.locator(sel).count(), sel).toBe(1);
  }
  await expect(simplify(page).locator('[data-cleanup-tolerance]')).toHaveCount(6);
});

test('simplify survives inspector rebuilds', async ({ page }) => {
  await setup(page);
  await openDisclosure(page, '[data-collapse="tool-settings"]');
  await page.evaluate(() => { document.getElementById('cleanupTolerance').__probe = 'same-node'; });
  await page.locator('#canvas').press('ControlOrMeta+a');
  await page.locator('[data-cleanup-tolerance="0.1"]').click();
  await page.locator('#cleanupSelectedBtn').click();
  await expect(simplify(page)).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.getElementById('cleanupTolerance').__probe)).toBe('same-node');
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts.length)).toBe(2);
  await page.locator('#undoBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts)).toEqual(pts);
});

test('simplify follows the anchor selection', async ({ page }) => {
  await setup(page);
  await openDisclosure(page, '[data-collapse="tool-settings"]');
  await expect(page.locator('#cleanupSelectedBtn')).toBeDisabled();
  await expect(page.locator('#cleanupSelectionHint')).toHaveText(/^Select anchors to clean up/);
  await page.locator('#canvas').press('ControlOrMeta+a');
  await expect(page.locator('#cleanupSelectedBtn')).toBeEnabled();
  await expect(page.locator('#cleanupSelectionHint')).toHaveText(/^4 selected anchors/);
});

test('merge distance stays reachable while drawing', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(() => { window.__gw.S.sel = []; window.__gw.setTool('pen'); window.__gw.refresh(true); });
  await openDisclosure(page, '[data-collapse="tool-settings"]');
  await expect(page.locator('#mergeDistance')).toBeVisible();
  await page.locator('#mergeDistance').fill('32'); await page.locator('#mergeDistance').press('Tab');
  await expect(page.locator('#proximityMergeBtn')).toHaveAttribute('data-control-tooltip', /32 screen pixels/);
});

test('simplify open state persists', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await openDisclosure(page, '[data-collapse="tool-settings"]');
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(simplify(page)).toHaveAttribute('open', '');
});

test('the simplify action has one name', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.locator('#cleanupSelectedBtn')).toHaveText('Simplify selected anchors');
  await expect(page.locator('details.tool-settings > summary')).toHaveText(/Simplify/);
});
