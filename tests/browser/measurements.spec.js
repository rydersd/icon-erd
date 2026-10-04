import { test, expect } from '@playwright/test';
const ready = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); };
const value = (page, name) => page.locator(`[data-measurement="${name}"]`);
test('Measurements below source anchors shows complete transformed object and painted stroke dimensions', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'measure-object', weight: 2, layers: [{ id: 'rect', paint: 'fill', node: { op: 'compound', transform: { scaleX: 2, scaleY: 1, origin: [0, 0] }, children: [{ shape: 'rect', x: 2, y: 3, w: 4, h: 5 }] } }] }), 'object.json');
    w.S.sel = [{ l: 0, p: [0] }]; w.refresh(true);
  });
  await expect(value(page, 'Width')).toHaveText('8 units'); await expect(value(page, 'Height')).toHaveText('5 units');
  expect(await page.locator('#measureH').evaluate(el => el.compareDocumentPosition(document.querySelector('#geometryH')) & Node.DOCUMENT_POSITION_PRECEDING)).toBeTruthy();
  await page.evaluate(async () => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'measure-stroke', weight: 2, layers: [{ id: 'line', paint: 'stroke', node: { shape: 'line', x1: 3, y1: 4, x2: 13, y2: 4 } }] }), 'line.json');
    w.S.sel = [{ l: 0, p: [] }]; w.refresh(true);
  });
  await expect(value(page, 'Width')).toHaveText('12 units'); await expect(value(page, 'Height')).toHaveText('2 units');
  await page.locator('#canvas').press('Escape'); await expect(page.locator('#measurementDetails')).toHaveText('');
});
test('selected range measures first to last; rounding uses pixel or current snap, retains first point and supports undo', async ({ page }) => {
  await ready(page);
  const pts = [{ x: 2, y: 3 }, { x: 4.1, y: 3, out: [1, 0] }, { x: 6.2, y: 3 }, { x: 12, y: 10 }];
  await page.evaluate(async pts => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'measure-points', layers: [{ id: 'line', paint: 'stroke', node: { shape: 'pen', pts } }] }), 'points.json');
    w.setTool('direct'); w.S.sel = [{ l: 0, p: [] }];
    w.S.selectedAnchors = [0, 1, 2].map(index => ({ selection: { l: 0, p: [] }, index })); w.S.anchor = 0; w.refresh(true);
  }, pts);
  await expect(value(page, 'Distance')).toHaveText('4.2 units');
  await page.locator('#roundDistancePixel').click();
  await expect(value(page, 'Distance')).toHaveText('4 units');
  const rounded = await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts);
  expect(rounded[0]).toEqual(pts[0]); expect(rounded[1].x).toBe(4); expect(rounded[1].out[0]).toBeCloseTo(4 / 4.2, 4); expect(rounded[3]).toEqual(pts[3]);
  await page.locator('#undoBtn').click(); expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts)).toEqual(pts);
  await page.evaluate(() => { const w = window.__gw; w.S.sel = [{ l: 0, p: [] }]; w.S.selectedAnchors = [0, 1, 2].map(index => ({ selection: { l: 0, p: [] }, index })); w.S.anchor = 0; w.refresh(true); });
  await page.locator('[data-snap="0"]').click(); await expect(page.locator('#roundDistanceSnap')).toBeDisabled();
  await page.locator('[data-snap="0.5"]').click(); await expect(page.locator('#roundDistanceSnap')).toBeEnabled();
  await page.locator('#roundDistanceSnap').click(); await expect(value(page, 'Distance')).toHaveText('4 units');
});
test('fill and stroke use adjacent previews which update from the saved colors', async ({ page }) => {
  await ready(page);
  const fill = await page.locator('#libraryFillColor').boundingBox(), stroke = await page.locator('#libraryStrokeColor').boundingBox();
  expect(fill.y).toBe(stroke.y);
  await page.locator('#libraryFillColor').fill('#ff0000'); await page.locator('#libraryFillColor').dispatchEvent('change');
  await expect(page.locator('#libraryFillColor')).toHaveValue('#ff0000');
  await expect(page.locator('#libraryFillColor')).toHaveCSS('border-top-width', '0px');
  await page.locator('#libraryStrokeColor').fill('#00ff00'); await page.locator('#libraryStrokeColor').dispatchEvent('change');
  await expect(page.locator('#libraryStrokeColor')).toHaveValue('#00ff00');
  await expect(page.locator('.library-paint-row input[type="color"]')).toHaveCount(2);
});
test('pixel rounding follows export size in transformed paths and never collapses a short range', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'measure-export', exportSize: 48, layers: [{ id: 'line', paint: 'stroke', node: { shape: 'pen', transform: { rotate: 30, scaleX: 2, scaleY: 2, origin: [0, 0] }, pts: [{ x: 2, y: 3 }, { x: 2.65, y: 3.8 }] } }] }), 'export.json');
    w.setTool('direct'); w.S.sel = [{ l: 0, p: [] }]; w.S.selectedAnchors = [0, 1].map(index => ({ selection: { l: 0, p: [] }, index })); w.S.anchor = 0; w.refresh(true);
  });
  const first = await page.evaluate(() => ({ ...window.__gw.S.glyph.layers[0].node.pts[0] }));
  await page.locator('#roundDistancePixel').click();
  const distance = parseFloat(await value(page, 'Distance').textContent()); expect(distance).toBeCloseTo(2, 3);
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts[0])).toEqual(first);
  await page.evaluate(() => { const w = window.__gw; delete w.S.glyph.layers[0].node.transform; w.S.glyph.exportSize = 24; w.S.glyph.layers[0].node.pts = [{ x: 2, y: 3 }, { x: 2.01, y: 3 }]; w.commit(); w.refresh(true); });
  await page.locator('#roundDistancePixel').click(); await expect(value(page, 'Distance')).toHaveText('1 units');
});
test('multiple selected children retain their complete parent implicit transform pivot', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'measure-parent-pivot', layers: [{ id: 'rects', paint: 'fill', node: { op: 'union', transform: { scaleX: 2, scaleY: 2 }, children: [{ shape: 'rect', x: 2, y: 3, w: 2, h: 2 }, { shape: 'rect', x: 10, y: 3, w: 2, h: 2 }] } }] }), 'parent.json');
    w.S.sel = [{ l: 0, p: [0] }, { l: 0, p: [1] }]; w.refresh(true);
  });
  await expect(value(page, 'Width')).toHaveText('20 units'); await expect(value(page, 'Height')).toHaveText('4 units');
});
