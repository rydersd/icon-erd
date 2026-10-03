import { test, expect } from '@playwright/test';
const setup = async (page, pts, transforms = []) => {
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  await page.evaluate(async ({ pts, transforms }) => {
    const w = window.__gw;
    await w.importLibraryText(JSON.stringify({ name: 'align-test', layers: pts.map((points, i) => ({ id: `line-${i}`, paint: 'stroke', node: { shape: 'pen', pts: points, ...(transforms[i] ? { transform: transforms[i] } : {}) } })) }), 'align.json');
    w.setTool('direct');
    w.S.sel = pts.map((_, l) => ({ l, p: [] }));
    w.S.selectedAnchors = pts.flatMap((points, l) => points.slice(0, 2).map((_, index) => ({ selection: { l, p: [] }, index })));
    w.S.anchor = 0; w.refresh(true);
  }, { pts, transforms });
};
for (const [direction, points, expected] of [
  ['vertically (X)', [{ x: 4, y: 4, in: [-1, 0], out: [1, 2] }, { x: 6, y: 16 }, { x: 18, y: 18 }], [5, 5]],
  ['horizontally (Y)', [{ x: 4, y: 4 }, { x: 16, y: 6, out: [2, 1] }, { x: 18, y: 18 }], [5, 5]],
]) test(`align chooses ${direction}, preserves handles and other anchors, and supports Undo/Redo`, async ({ page }) => {
  await setup(page, [points]);
  await page.locator('#canvas').press('Shift+F10');
  await page.getByRole('menuitem', { name: `Align points ${direction}`, exact: true }).click();
  const axis = direction.startsWith('vertically') ? 'x' : 'y';
  const aligned = await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts);
  expect(aligned.slice(0, 2).map(p => p[axis])).toEqual(expected);
  for (let i = 0; i < 2; i++) expect(aligned[i]).toEqual({ ...points[i], [axis]: 5 });
  expect(aligned[2]).toEqual(points[2]);
  await page.locator('#undoBtn').click(); expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts)).toEqual(points);
  await page.locator('#redoBtn').click(); expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.pts)).toEqual(aligned);
});
test('alignment operates in drawing coordinates across rotated and scaled objects', async ({ page }) => {
  await setup(page, [[{ x: 2, y: 5 }, { x: 8, y: 6 }], [{ x: 3, y: 2 }, { x: 3.5, y: 8 }]], [{ scaleX: 2, scaleY: 1, origin: [0, 0] }, { rotate: 90, origin: [0, 0] }]);
  const world = () => page.evaluate(() => {
    const w = window.__gw;
    return w.S.selectedAnchors.map(({ selection, index }) => {
      const p = w.S.glyph.layers[selection.l].node.pts[index], m = w.fullMatrix(selection);
      return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
    });
  });
  const before = await world(), meanY = before.reduce((s, p) => s + p.y / 4, 0);
  await page.locator('#canvas').press('Shift+F10'); await page.getByRole('menuitem', { name: 'Align points horizontally (Y)', exact: true }).click();
  const after = await world();
  for (let i = 0; i < 4; i++) { expect(after[i].y).toBeCloseTo(meanY, 3); expect(after[i].x).toBeCloseTo(before[i].x, 3); }
});
test('single-anchor menu does not offer alignment', async ({ page }) => {
  await setup(page, [[{ x: 4, y: 4 }, { x: 8, y: 12 }]]);
  await page.evaluate(() => { window.__gw.S.selectedAnchors = window.__gw.S.selectedAnchors.slice(0, 1); window.__gw.refresh(true); });
  await page.locator('#canvas').press('Shift+F10'); await expect(page.getByRole('menuitem', { name: /Align points/ })).toHaveCount(0);
});
