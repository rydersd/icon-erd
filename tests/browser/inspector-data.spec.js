import { test, expect } from '@playwright/test';
// UX-02e Edit as data. Spec: wiki/product-spec/ux-02-inspector-by-selection.md (local wiki), acceptance C1–C9
// adopted from wiki/product-spec/ux/ux-02cde-assessment-2026-11-02.md.
const boot = async (page, layers, sel = [{ l: 0, p: [] }]) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async ({ layers, sel }) => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify([{ name: 'data', group: 'Shapes', weight: 1.2, layers }]), 'data.json', 'replace');
    w.loadGlyph(0); w.S.sel = sel; w.setTool('direct'); w.refresh(true);
  }, { layers, sel });
};
const pen = (pts, extra = {}) => ({ id: 'p', name: 'Path', paint: 'stroke', node: { shape: 'pen', pts, closed: false, ...extra } });
const tri = [{ x: 4, y: 4 }, { x: 16, y: 4 }, { x: 16, y: 16 }];
const data = page => page.locator('#insp details.edit-as-data');
const open = async page => { const d = data(page); if (await d.getAttribute('open') === null) await d.locator(':scope > summary').click(); return d; };
const anchorsJson = page => data(page).locator('label', { hasText: 'anchors' }).locator('textarea');
const rows = page => data(page).locator('[data-point]');
const pathData = page => page.getByLabel('Path data (SVG d)', { exact: true });

test('edit as data holds the path\'s data fields', async ({ page }) => {
  await boot(page, [pen(tri)]);
  await expect(data(page)).toHaveCount(1);
  await expect(data(page)).not.toHaveAttribute('open', '');
  const summary = data(page).locator(':scope > summary');
  await expect(summary).toHaveText('Edit as data');
  expect(await summary.evaluate(e => getComputedStyle(e).textTransform)).not.toBe('uppercase');
  await expect(anchorsJson(page)).toHaveCount(1);
  await expect(page.locator('#insp label', { hasText: 'anchors (JSON' })).toHaveCount(1);
  await boot(page, [{ id: 'q', name: 'Poly', paint: 'stroke', node: { shape: 'polyline', pts: [[4, 4], [16, 4], [16, 16]] } }]);
  await expect(data(page).locator('label', { hasText: 'points (x,y' })).toHaveCount(1);
  await expect(page.locator('#insp label', { hasText: 'points (x,y' })).toHaveCount(1);
  await boot(page, [{ id: 'r', name: 'Raw', paint: 'fill', node: { shape: 'path', d: 'M4 4L16 4L16 16Z' } }]);
  await expect(data(page).locator('label', { hasText: 'd (escape hatch)' })).toHaveCount(1);
  await expect(page.locator('#insp label', { hasText: 'd (escape hatch)' })).toHaveCount(1);
});

test('editing anchors as data redraws and undoes', async ({ page }) => {
  await boot(page, [pen(tri)]);
  await open(page);
  const before = await page.locator('#canvas path').evaluateAll(ps => ps.map(p => p.getAttribute('d')).join('|'));
  const json = JSON.stringify([{ x: 4, y: 4 }, { x: 18, y: 4 }, { x: 16, y: 16 }]);
  await anchorsJson(page).fill(json); await anchorsJson(page).press('Tab');
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts[1].x)).toBe(18);
  const after = await page.locator('#canvas path').evaluateAll(ps => ps.map(p => p.getAttribute('d')).join('|'));
  expect(after).not.toBe(before);
  await expect(data(page)).toHaveAttribute('open', '');
  await expect(anchorsJson(page)).toHaveCount(1);
  await page.locator('#undoBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts[1].x)).toBe(16);
  await page.locator('#redoBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts[1].x)).toBe(18);
});

test('edit as data lists the path\'s points in canvas coordinates', async ({ page }) => {
  await boot(page, [pen(tri, { transform: { origin: [0, 0], scaleX: 1.25, scaleY: 1 } })]);
  await open(page);
  await expect(rows(page)).toHaveCount(3);
  // Hand-computed: x' = 1.25 · x about origin 0. Not derived from the app's own point helpers.
  expect(await rows(page).evaluateAll(r => r.map(e => Number(e.dataset.x)))).toEqual([5, 20, 20]);
  expect(await rows(page).evaluateAll(r => r.map(e => Number(e.dataset.y)))).toEqual([4, 4, 16]);
  await expect(rows(page).nth(1)).toContainText('20');
});

test('clicking a data point selects that anchor', async ({ page }) => {
  await boot(page, [pen(tri)]);
  await open(page);
  await rows(page).nth(1).click();
  expect(await page.evaluate(() => window.__gw.S.selectedAnchors)).toEqual([{ selection: { l: 0, p: [] }, index: 1 }]);
  await expect(page.locator('#gSel [data-anchor="1"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-collapse="geometryH"] #pointRows')).toHaveCount(1);
  await expect(data(page).locator('input[type="checkbox"]')).toHaveCount(0);
});

test('path data is read-only and matches the outline', async ({ page }) => {
  await boot(page, [pen([{ x: 4, y: 4 }, { x: 16, y: 4 }])]);
  await open(page);
  await expect(pathData(page)).toHaveAttribute('readonly', '');
  await expect(pathData(page)).not.toHaveValue('');
  const geo = await pathData(page).evaluate(t => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', t.value);
    const s = p.getPointAtLength(0); return { len: p.getTotalLength(), x: s.x, y: s.y };
  });
  expect(Math.abs(geo.len - 12)).toBeLessThan(0.01);
  expect(geo.x).toBeCloseTo(4, 2); expect(geo.y).toBeCloseTo(4, 2);
  await boot(page, [{ id: 'r', name: 'Raw', paint: 'fill', node: { shape: 'path', d: 'M4 4L16 4L16 16Z' } }]);
  await open(page);
  await expect(data(page).locator('textarea')).toHaveCount(1);
  await expect(pathData(page)).toHaveCount(0);
  await expect(data(page).locator('textarea')).not.toHaveAttribute('readonly', '');
});

test('primitives and groups have no edit as data', async ({ page }) => {
  await boot(page, [{ id: 'b', name: 'Box', paint: 'stroke', node: { shape: 'rect', x: 4, y: 4, w: 16, h: 16 } }]);
  await expect(page.locator('#insp [data-key], #insp label').first()).toBeVisible();
  await expect(page.locator('#insp .edit-as-data')).toHaveCount(0);
  await boot(page, [{ id: 'g', name: 'Group', paint: 'fill', node: { op: 'union', children: [
    { shape: 'rect', x: 4, y: 4, w: 8, h: 8 }, { shape: 'circle', cx: 14, cy: 14, r: 4 }] } }]);
  await expect(page.locator('#insp label').first()).toBeVisible();
  await expect(page.locator('#insp .edit-as-data')).toHaveCount(0);
});

test('points and overlaps keeps its table', async ({ page }) => {
  await boot(page, [pen(tri), { id: 'b', name: 'Box', paint: 'stroke', node: { shape: 'pen', pts: [{ x: 2, y: 20 }, { x: 8, y: 20 }], closed: false } }], []);
  const panel = page.locator('[data-collapse="geometryH"]');
  if (await panel.getAttribute('open') === null) await panel.locator(':scope > summary').click();
  await expect(page.locator('#pointRows tr')).toHaveCount(5);
  await page.locator('#pointRows').getByLabel('Round Pen path 1 anchor 2', { exact: true }).first().uncheck();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.roundingAnchors)).toEqual([0, 2]);
});

test('edit as data builds rows only when open', async ({ page }) => {
  const many = Array.from({ length: 100 }, (_, i) => ({ x: 2 + (i % 10) * 2, y: 2 + Math.floor(i / 10) * 2 }));
  await boot(page, [pen(many)]);
  await expect(data(page)).toHaveCount(1);
  await expect(rows(page)).toHaveCount(0);
  await open(page);
  await expect(rows(page)).toHaveCount(100);
});

test('clicking a data point keeps the list position and focus', async ({ page }) => {
  const many = Array.from({ length: 100 }, (_, i) => ({ x: 2 + (i % 10) * 2, y: 2 + Math.floor(i / 10) * 2 }));
  await boot(page, [pen(many)]);
  await open(page);
  const row = rows(page).nth(79);
  await row.scrollIntoViewIfNeeded();
  const before = await data(page).locator('.data-points').evaluate(list => list.scrollTop);
  expect(before).toBeGreaterThan(0);
  await row.click();
  expect(await page.evaluate(() => window.__gw.S.selectedAnchors)).toEqual([{ selection: { l: 0, p: [] }, index: 79 }]);
  await expect(rows(page).nth(79)).toHaveAttribute('aria-pressed', 'true');
  await expect(rows(page).nth(79)).toBeFocused();
  expect(await data(page).locator('.data-points').evaluate(list => list.scrollTop)).toBe(before);
});
