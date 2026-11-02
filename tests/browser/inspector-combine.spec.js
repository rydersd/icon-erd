import { test, expect } from '@playwright/test';
import { openDrawingControls } from './helpers.js';
// UX-02c Combine for two or more objects. Spec: wiki/product-spec/ux-02-inspector-by-selection.md (local wiki),
// acceptance from wiki/product-spec/ux/ux-02cde-assessment-2026-11-02.md with owner rulings Q1 A, Q2 A (2026-11-02).
const A = { shape: 'rect', x: 4, y: 4, w: 10, h: 10 };
const B = { shape: 'circle', cx: 14, cy: 14, r: 5 };
const C = { shape: 'circle', cx: 6, cy: 18, r: 2 };
const boot = async (page, layers, sel) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async ({ layers, sel }) => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify([{ name: 'combine', group: 'Shapes', weight: 1.2, layers }]), 'c.json', 'replace');
    w.loadGlyph(0); w.S.sel = sel; w.refresh(true);
  }, { layers, sel });
};
const pair = (page, extra = []) => boot(page, [{ id: 'a', name: 'Art', paint: 'fill', node: { op: 'union', children: [A, B, ...extra] } }], [{ l: 0, p: [0] }, { l: 0, p: [1] }]);
const combine = page => page.locator('#insp').getByRole('group', { name: 'Combine', exact: true });
const glyph = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gw.S.glyph)));

test('two selected objects show combine in the inspector', async ({ page }) => {
  await pair(page);
  for (const name of ['Union', 'Subtract', 'Intersect', 'Exclude', 'Delete']) await expect(combine(page).getByRole('button', { name, exact: true })).toBeVisible();
  // Owner Q2 A: no separate Group button. Amendment: no Duplicate either; duplicate() copies only the primary selection.
  for (const name of ['Group', 'Duplicate']) await expect(combine(page).getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(combine(page).getByRole('button', { name: 'Union', exact: true })).toHaveAttribute('data-control-tooltip', 'Union (⌘G, Group)');
  await boot(page, [{ id: 'a', name: 'Art', paint: 'fill', node: { op: 'union', children: [A, B] } }], [{ l: 0, p: [0] }]);
  await expect(page.locator('#insp [data-combine]')).toHaveCount(0);
  await boot(page, [{ id: 'a', name: 'Art', paint: 'fill', node: { op: 'union', children: [A, B] } }], []);
  await expect(page.locator('#insp [data-combine]')).toHaveCount(0);
});

for (const op of ['union', 'subtract', 'intersect', 'exclude']) test(`combine ${op} builds the expected group`, async ({ page }) => {
  await pair(page, [C]);
  // Import names each node; the expected tree is still written by hand from the imported forms.
  const [a, b, c] = (await glyph(page)).layers[0].node.children;
  expect([a.shape, b.shape, c.cy]).toEqual(['rect', 'circle', 18]);
  await page.locator(`#insp [data-combine="${op}"]`).click();
  const g = await glyph(page);
  expect(g.layers[0].node.children).toEqual([{ op, name: expect.any(String), children: [a, b] }, c]);
  expect(await page.evaluate(() => window.__gw.S.sel)).toEqual([{ l: 0, p: [0] }]);
  await expect(page.locator('#status')).toContainText(`Grouped into ${op}.`);
  await page.locator('#undoBtn').click();
  expect((await glyph(page)).layers[0].node.children).toEqual([a, b, c]);
  await page.locator('#redoBtn').click();
  expect((await glyph(page)).layers[0].node.children).toEqual([{ op, name: expect.any(String), children: [a, b] }, c]);
});

test('combine matches the keyboard group', async ({ page }) => {
  await pair(page);
  await page.locator('#insp [data-combine="union"]').click();
  const viaInspector = await glyph(page);
  await pair(page);
  await page.locator('#canvas').press('ControlOrMeta+g');
  expect(await glyph(page)).toEqual(viaInspector);
});

test('combine delete acts on the whole selection', async ({ page }) => {
  await pair(page, [C]);
  const [a, b, c] = (await glyph(page)).layers[0].node.children;
  await combine(page).getByRole('button', { name: 'Delete', exact: true }).click();
  expect((await glyph(page)).layers[0].node.children).toEqual([c]);
  await page.locator('#undoBtn').click();
  expect((await glyph(page)).layers[0].node.children).toEqual([a, b, c]);
});

test('combine explains when the selection cannot be combined', async ({ page }) => {
  await boot(page, [
    { id: 'a', name: 'Art', paint: 'fill', node: { op: 'union', children: [A, B] } },
    { id: 'b', name: 'More', paint: 'fill', node: { op: 'union', children: [C, B] } }], [{ l: 0, p: [0] }, { l: 1, p: [0] }]);
  for (const op of ['union', 'subtract', 'intersect', 'exclude']) await expect(page.locator(`#insp [data-combine="${op}"]`)).toBeDisabled();
  await expect(page.locator('#insp')).toContainText('Booleans need siblings in the same layer and group.');
  await expect(combine(page).getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
});

test('anchors across two paths show anchor tools, not combine', async ({ page }) => {
  await boot(page, [{ id: 'a', name: 'Art', paint: 'stroke', node: { op: 'union', children: [
    { shape: 'pen', pts: [{ x: 4, y: 4 }, { x: 10, y: 4 }] }, { shape: 'pen', pts: [{ x: 4, y: 12 }, { x: 10, y: 12 }] }] } }], []);
  await page.evaluate(() => { const w = window.__gw; w.setTool('direct'); w.S.selectedAnchors = [{ selection: { l: 0, p: [0] }, index: 0 }, { selection: { l: 0, p: [1] }, index: 1 }]; w.S.sel = [{ l: 0, p: [0] }, { l: 0, p: [1] }]; w.refresh(true); });
  await expect(page.locator('#insp [data-combine]')).toHaveCount(0);
});

test('one visible boolean set', async ({ page }) => {
  await pair(page);
  await openDrawingControls(page);
  await expect(page.locator('[data-group]:not(.lib-group)')).toHaveCount(0);
  const visible = await page.locator('button:visible').evaluateAll(bs => bs.filter(b => ['Union', 'Subtract', 'Intersect', 'Exclude'].includes(b.getAttribute('aria-label'))).map(b => b.closest('#insp') ? 'insp' : 'other'));
  expect(visible).toEqual(['insp', 'insp', 'insp', 'insp']);
});
